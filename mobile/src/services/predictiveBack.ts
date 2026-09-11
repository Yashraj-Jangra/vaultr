import { useEffect, useRef } from "react";
import { NativeModules, Platform, DeviceEventEmitter } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";

const { PredictiveBackModule } = NativeModules;

export interface PredictiveBackEvent {
  progress: number;
  swipeEdge: number; // 0 = Left, 1 = Right
  touchX: number;
  touchY: number;
}

export function setPredictiveBackEnabled(enabled: boolean) {
  if (Platform.OS === "android" && PredictiveBackModule?.setEnabled) {
    try {
      PredictiveBackModule.setEnabled(enabled);
    } catch {
      // Safe no-op on unsupported environments
    }
  }
}

export interface UsePredictiveBackResult {
  progress: SharedValue<number>;
  swipeEdge: SharedValue<number>;
  isActive: SharedValue<boolean>;
}

/**
 * usePredictiveBack
 *
 * Drives the predictive-back gesture animation on Android 14+.
 *
 * Design contract:
 *  - `onBack` (optional): called when the back gesture is committed.
 *      - Return `true`  → you handled it (e.g. closed a modal). The wrapper
 *                         will spring the card back to its resting position.
 *      - Return `false` / `undefined` → let the wrapper pop the screen.
 *        The wrapper will disable the screen's close animation, run our own
 *        Reanimated exit to completion, then pop the screen (no double animation).
 *
 *  - Only the focused (top-most) screen listens. When a child screen is pushed
 *    on top, the parent automatically unbinds its listeners.
 */
export function usePredictiveBack(
  navigation?: any,
  onBack?: () => boolean | void
): UsePredictiveBackResult {
  const isFocused = useIsFocused();
  const progress = useSharedValue(0);
  const swipeEdge = useSharedValue(0);
  const isActive = useSharedValue(false);
  // Stable ref so the worklet callback always sees the latest navigation/onBack
  // without the effect having to re-run every render.
  const navRef = useRef(navigation);
  const onBackRef = useRef(onBack);
  navRef.current = navigation;
  onBackRef.current = onBack;

  useEffect(() => {
    if (Platform.OS !== "android" || !PredictiveBackModule || !isFocused) {
      return;
    }

    progress.value = 0;
    isActive.value = false;
    setPredictiveBackEnabled(true);

    // Called on the JS thread after our Reanimated exit animation finishes.
    const doExit = () => {
      const nav = navRef.current;
      const back = onBackRef.current;

      // If the back handler intercepts (returns true), snap the card back.
      if (back && back() === true) {
        isActive.value = false;
        progress.value = withSpring(0, { damping: 28, stiffness: 320 });
        return;
      }

      // Otherwise pop — but first disable the navigator's own close animation
      // so our Reanimated exit IS the only animation that plays.
      if (nav?.canGoBack && nav.canGoBack()) {
        nav.setOptions({ animationEnabled: false });
        nav.goBack();
      }
    };

    const onStarted = DeviceEventEmitter.addListener(
      "onPredictiveBackStarted",
      (event: PredictiveBackEvent) => {
        isActive.value = true;
        swipeEdge.value = event.swipeEdge;
        progress.value = 0;
      }
    );

    const onProgressed = DeviceEventEmitter.addListener(
      "onPredictiveBackProgressed",
      (event: PredictiveBackEvent) => {
        isActive.value = true;
        swipeEdge.value = event.swipeEdge;
        progress.value = event.progress;
      }
    );

    const onInvoked = DeviceEventEmitter.addListener(
      "onPredictiveBackInvoked",
      () => {
        if (!isActive.value) return;
        // Run our exit animation fully, then pop (no second animation).
        progress.value = withTiming(1, { duration: 180 }, (finished) => {
          if (finished) runOnJS(doExit)();
        });
      }
    );

    const onCancelled = DeviceEventEmitter.addListener(
      "onPredictiveBackCancelled",
      () => {
        if (!isActive.value) return;
        // User cancelled the swipe — spring the card back.
        progress.value = withSpring(0, { damping: 24, stiffness: 280 }, (finished) => {
          if (finished) isActive.value = false;
        });
      }
    );

    return () => {
      onStarted.remove();
      onProgressed.remove();
      onInvoked.remove();
      onCancelled.remove();
      setPredictiveBackEnabled(false);
      isActive.value = false;
      progress.value = 0;
    };
    // Re-run only when focus changes — navRef/onBackRef are stable refs.
  }, [isFocused]);

  return { progress, swipeEdge, isActive };
}
