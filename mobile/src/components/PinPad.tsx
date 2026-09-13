import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Vibration,
} from "react-native";
import { Fingerprint } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

function BackspaceIcon({ size = 24, color = "#f4f4f5" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <Path d="m12 9 6 6" />
      <Path d="m18 9-6 6" />
    </Svg>
  );
}

interface PinPadProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  showBiometricButton?: boolean;
  onBiometricPress?: () => void;
  errorMessage?: string;
  shake?: boolean;
}

const DIGIT_KEYS = [
  { num: "1", sub: "" },
  { num: "2", sub: "A B C" },
  { num: "3", sub: "D E F" },
  { num: "4", sub: "G H I" },
  { num: "5", sub: "J K L" },
  { num: "6", sub: "M N O" },
  { num: "7", sub: "P Q R S" },
  { num: "8", sub: "T U V" },
  { num: "9", sub: "W X Y Z" },
];

export function PinPad({
  length = 4,
  value,
  onChange,
  onComplete,
  disabled = false,
  showBiometricButton = false,
  onBiometricPress,
  errorMessage,
  shake = false,
}: PinPadProps) {
  const shakeAnim = useSharedValue(0);

  useEffect(() => {
    if (shake) {
      shakeAnim.value = withSequence(
        withTiming(-12, { duration: 50 }),
        withTiming(12, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      try {
        Vibration.vibrate(30);
      } catch {}
    }
  }, [shake]);

  const handlePressDigit = (digit: string) => {
    if (disabled || value.length >= length) return;
    try {
      Vibration.vibrate(8);
    } catch {}

    const next = value + digit;
    onChange(next);
    if (next.length === length && onComplete) {
      onComplete(next);
    }
  };

  const handlePressDelete = () => {
    if (disabled || value.length === 0) return;
    try {
      Vibration.vibrate(8);
    } catch {}
    onChange(value.slice(0, -1));
  };

  const animatedDotsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Dots Row */}
      <Animated.View style={[styles.dotsContainer, animatedDotsStyle]}>
        {Array.from({ length }).map((_, idx) => {
          const filled = idx < value.length;
          return (
            <View
              key={idx}
              style={[
                styles.dot,
                filled && styles.dotFilled,
                errorMessage ? styles.dotError : null,
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Error text if present */}
      {errorMessage ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {errorMessage}
        </Text>
      ) : null}

      {/* Numeric Keypad Grid */}
      <View style={styles.grid}>
        {DIGIT_KEYS.map((k) => (
          <TouchableOpacity
            key={k.num}
            style={styles.keyBtn}
            activeOpacity={0.65}
            disabled={disabled}
            onPress={() => handlePressDigit(k.num)}
          >
            <Text style={styles.keyNum}>{k.num}</Text>
            {k.sub ? <Text style={styles.keySub}>{k.sub}</Text> : null}
          </TouchableOpacity>
        ))}

        {/* Bottom Row: Biometric Shortcut / Empty, '0', Delete */}
        {showBiometricButton && onBiometricPress ? (
          <TouchableOpacity
            style={[styles.keyBtn, styles.specialKeyBtn]}
            activeOpacity={0.65}
            disabled={disabled}
            onPress={onBiometricPress}
          >
            <Fingerprint size={28} color={colors.accent || "#fafafa"} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.keyBtn, styles.emptyKey]} />
        )}

        <TouchableOpacity
          style={styles.keyBtn}
          activeOpacity={0.65}
          disabled={disabled}
          onPress={() => handlePressDigit("0")}
        >
          <Text style={styles.keyNum}>0</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.keyBtn, styles.specialKeyBtn]}
          activeOpacity={0.65}
          disabled={disabled || value.length === 0}
          onPress={handlePressDelete}
        >
          <BackspaceIcon
            size={24}
            color={value.length > 0 ? "#f4f4f5" : "rgba(255, 255, 255, 0.2)"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 10,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    height: 36,
    marginBottom: 8,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  dotFilled: {
    backgroundColor: "#fafafa",
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 4,
  },
  dotError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#f87171",
    fontSize: 12.5,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: 290,
    gap: 18,
    marginTop: 8,
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  keyNum: {
    fontSize: 27,
    fontWeight: "500",
    color: "#f4f4f5",
    lineHeight: 31,
  },
  keySub: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255, 255, 255, 0.35)",
    marginTop: 1,
  },
  specialKeyBtn: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  emptyKey: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
});
