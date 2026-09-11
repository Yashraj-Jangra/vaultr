import React from "react";
import {
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { usePredictiveBack } from "../services/predictiveBack";
import { colors } from "../theme/colors";

/**
 * "modal"  → Vault Depth Lift: card recedes down + shrinks into depth (item screens).
 * "folder" → Horizontal Slide: card slides right off-screen (folder/list screens).
 */
export type PredictiveBackMode = "modal" | "folder";

interface PredictiveBackWrapperProps {
  children: React.ReactNode;
  navigation: any;
  style?: StyleProp<ViewStyle>;
  /**
   * Called when the user commits the back gesture.
   *  - Return `true`  → you handled it (e.g. showed a "discard changes?" alert).
   *                     The wrapper will spring the card back to its resting position.
   *  - Return `false` / nothing → let the wrapper disable animation & pop the screen.
   */
  onBack?: () => boolean | void;
  mode?: PredictiveBackMode;
}

export function PredictiveBackWrapper({
  children,
  navigation,
  style,
  onBack,
  mode = "modal",
}: PredictiveBackWrapperProps) {
  const { progress, isActive } = usePredictiveBack(navigation, onBack);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // Fast-path: resting position — no transform at all.
    if (!isActive.value && p === 0) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
        opacity: 1,
      };
    }

    if (mode === "folder") {
      // ── Folder screens ────────────────────────────────────────────
      // Pure horizontal slide. The card moves right at 1:1 with the gesture,
      // revealing the parent list beneath it. No scale change.
      const translateX = interpolate(
        p,
        [0, 1],
        [0, screenWidth],
        Extrapolation.CLAMP
      );
      const opacity = interpolate(
        p,
        [0, 0.92, 1],
        [1, 0.96, 0],
        Extrapolation.CLAMP
      );
      return {
        opacity,
        transform: [{ translateX }, { translateY: 0 }, { scale: 1 }],
      };
    }

    // ── Item / modal screens ──────────────────────────────────────
    // Vault Depth Lift: card drops down and recedes in 3D depth.
    const maxY = screenHeight * 0.22;
    const translateY = interpolate(p, [0, 1], [0, maxY], Extrapolation.CLAMP);
    const scale = interpolate(p, [0, 1], [1, 0.76], Extrapolation.CLAMP);
    const opacity = interpolate(
      p,
      [0, 0.6, 1],
      [1, 0.9, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateX: 0 }, { translateY }, { scale }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.card,
          mode === "folder" && styles.folderCard,
          style,
          animatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  folderCard: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255, 255, 255, 0.07)",
  },
});
