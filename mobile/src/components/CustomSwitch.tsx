import React, { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  activeThumbColor?: string;
  inactiveThumbColor?: string;
}

export function CustomSwitch({
  value,
  onValueChange,
  disabled = false,
  activeColor = "#ffffff",
  inactiveColor = "#1f1f23",
  activeThumbColor = "#09090b",
  inactiveThumbColor = "#71717a",
}: CustomSwitchProps) {
  // 0 = off, 1 = on
  const switchProgress = useSharedValue(value ? 1 : 0);
  const isPressed = useSharedValue(0);

  useEffect(() => {
    switchProgress.value = withSpring(value ? 1 : 0, {
      damping: 18,
      stiffness: 260,
      mass: 0.5,
    });
  }, [value]);

  const handlePressIn = () => {
    if (disabled) return;
    isPressed.value = withSpring(1, { damping: 16, stiffness: 350 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    isPressed.value = withSpring(0, { damping: 16, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      switchProgress.value,
      [0, 1],
      [inactiveColor, activeColor]
    );
    const borderColor = interpolateColor(
      switchProgress.value,
      [0, 1],
      ["#3f3f46", "#ffffff"]
    );
    return {
      backgroundColor,
      borderColor,
    };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(switchProgress.value, [0, 1], [2, 20]);
    // Authentic Apple thumb stretch: horizontally elongates slightly during touch/travel
    const stretch = interpolate(isPressed.value, [0, 1], [1, 1.14]);
    const thumbColor = interpolateColor(
      switchProgress.value,
      [0, 1],
      [inactiveThumbColor, activeThumbColor]
    );

    return {
      transform: [
        { translateX },
        { scaleX: stretch },
        { scaleY: interpolate(isPressed.value, [0, 1], [1, 0.94]) },
      ],
      backgroundColor: thumbColor,
    };
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={[styles.track, trackAnimatedStyle, disabled && { opacity: 0.5 }]}
      >
        <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
