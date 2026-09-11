import { Easing, ViewStyle } from "react-native";
import {
  StackCardInterpolationProps,
  StackCardStyleInterpolator,
  StackNavigationOptions,
} from "@react-navigation/stack";

// ─────────────────────────────────────────────────────────────────────────────
// Transition Architecture
//
// All back navigation for custom-handled screens (ItemDetail, ItemForm,
// VaultFiltered, FolderManager) is driven entirely by PredictiveBackWrapper +
// usePredictiveBack. Those screens set `gestureEnabled: false` so the navigator
// never runs its own swipe gesture.
//
// The transitionSpec here only governs the OPEN animation (push onto the stack).
// The CLOSE animation is suppressed by `nav.setOptions({ animationEnabled: false })`
// in predictiveBack.ts right before `nav.goBack()` — so the Reanimated exit IS
// the only animation that plays on back.
//
// Two flavours:
//  1. Vault Depth Lift  – item/form screens zoom up from below.
//  2. Folder Drill-Down – folder/list screens slide in from the right.
// ─────────────────────────────────────────────────────────────────────────────

type TransitionSpec = NonNullable<StackNavigationOptions["transitionSpec"]>["open"];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Vault Depth Lift — Item & Form Screens
// ─────────────────────────────────────────────────────────────────────────────

const depthLiftOpenSpec: TransitionSpec = {
  animation: "spring",
  config: {
    damping: 22,
    mass: 0.9,
    stiffness: 220,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

// Close spec is instant (animationEnabled is set to false before goBack).
const instantCloseSpec: TransitionSpec = {
  animation: "timing",
  config: { duration: 0, easing: Easing.linear },
};

const depthLiftInterpolator: StackCardStyleInterpolator = ({
  current,
  layouts,
}: StackCardInterpolationProps) => {
  const progress = current.progress;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [layouts.screen.height * 0.22, 0],
    extrapolate: "clamp",
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.76, 1],
    extrapolate: "clamp",
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.85, 1],
    extrapolate: "clamp",
  });

  // Background dim fades in as the card lifts into view.
  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.72],
    extrapolate: "clamp",
  });

  const cardStyle: ViewStyle = {
    backgroundColor: "transparent",
    opacity,
    transform: [{ translateY }, { scale }],
  };

  return {
    cardStyle,
    overlayStyle: { backgroundColor: "#000000", opacity: overlayOpacity },
  };
};

export function getItemTransitionConfig(): Partial<StackNavigationOptions> {
  return {
    transitionSpec: { open: depthLiftOpenSpec, close: instantCloseSpec },
    cardStyleInterpolator: depthLiftInterpolator,
    gestureEnabled: false,
    detachPreviousScreen: false,
    cardOverlayEnabled: true,
    cardShadowEnabled: false,
    cardStyle: { backgroundColor: "transparent" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Folder Drill-Down — Folder & Filtered-List Screens
// ─────────────────────────────────────────────────────────────────────────────

const folderOpenSpec: TransitionSpec = {
  animation: "spring",
  config: {
    damping: 26,
    mass: 0.9,
    stiffness: 240,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

const folderInterpolator: StackCardStyleInterpolator = ({
  current,
  layouts,
}: StackCardInterpolationProps) => {
  const progress = current.progress;

  // This screen slides in from the right edge.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [layouts.screen.width, 0],
    extrapolate: "clamp",
  });

  // NOTE: No parallax offset on the screen below. The exit animation is driven
  // entirely by PredictiveBackWrapper (which slides the top card right). If we
  // also shift the parent left here, animationEnabled:false on goBack() never
  // reverses that offset, leaving the parent permanently misaligned to the left.

  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
    extrapolate: "clamp",
  });

  return {
    cardStyle: {
      backgroundColor: "transparent",
      transform: [{ translateX }],
    },
    overlayStyle: { backgroundColor: "#000000", opacity: overlayOpacity },
  };
};

export function getFolderTransitionConfig(): Partial<StackNavigationOptions> {
  return {
    transitionSpec: { open: folderOpenSpec, close: instantCloseSpec },
    cardStyleInterpolator: folderInterpolator,
    gestureEnabled: false,
    detachPreviousScreen: false,
    cardOverlayEnabled: true,
    cardShadowEnabled: false,
    cardStyle: { backgroundColor: "transparent" },
  };
}
