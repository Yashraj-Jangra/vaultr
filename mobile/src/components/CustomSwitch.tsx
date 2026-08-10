import React, { useEffect, useRef } from "react";
import { TouchableOpacity, Animated, StyleSheet, View } from "react-native";

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
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3f3f46", "#ffffff"],
  });

  const thumbColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveThumbColor, activeThumbColor],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor,
            borderColor,
          },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
              backgroundColor: thumbColor,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
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
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
