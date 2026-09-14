import React, { useEffect } from "react";
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
  withSpring,
  Easing,
} from "react-native-reanimated";
import { colors } from "../theme/colors";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function BackspaceIcon({ size = 24, color = "#f4f4f5" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <Path d="m12 9 6 6" />
      <Path d="m18 9-6 6" />
    </Svg>
  );
}

interface AnimatedDotProps {
  filled: boolean;
  error: boolean;
  size: number;
}

function AnimatedDot({ filled, error, size }: AnimatedDotProps) {
  const scale = useSharedValue(filled ? 1 : 0.82);
  const opacity = useSharedValue(filled ? 1 : 0.3);

  useEffect(() => {
    if (filled) {
      scale.value = withSequence(
        withTiming(1.25, { duration: 75, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 14, stiffness: 360 })
      );
      opacity.value = withTiming(1, { duration: 60 });
    } else {
      scale.value = withTiming(0.82, { duration: 80 });
      opacity.value = withTiming(0.3, { duration: 80 });
    }
  }, [filled]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2 },
        filled ? styles.dotFilled : styles.dotEmpty,
        error && styles.dotError,
        animStyle,
      ]}
    />
  );
}

interface KeypadDigitButtonProps {
  item: { num: string; sub?: string };
  disabled?: boolean;
  onPress: () => void;
}

function KeypadDigitButton({ item, disabled, onPress }: KeypadDigitButtonProps) {
  const scale = useSharedValue(1);
  const bgAlpha = useSharedValue(0.04);

  const handlePressIn = () => {
    if (disabled) return;
    try {
      Vibration.vibrate(10);
    } catch {}
    scale.value = withTiming(0.92, { duration: 45, easing: Easing.out(Easing.quad) });
    bgAlpha.value = withTiming(0.14, { duration: 45 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 420 });
    bgAlpha.value = withTiming(0.04, { duration: 140 });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: `rgba(255, 255, 255, ${bgAlpha.value})`,
  }));

  return (
    <AnimatedTouchable
      style={[styles.keyBtn, animStyle]}
      activeOpacity={1}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Text style={styles.keyNum}>{item.num}</Text>
      {item.sub ? <Text style={styles.keySub}>{item.sub}</Text> : null}
    </AnimatedTouchable>
  );
}

interface KeypadActionButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}

function KeypadActionButton({ children, disabled, onPress }: KeypadActionButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (disabled) return;
    try {
      Vibration.vibrate(10);
    } catch {}
    scale.value = withTiming(0.88, { duration: 45 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 420 });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[styles.keyBtn, styles.specialKeyBtn, animStyle]}
      activeOpacity={1}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      {children}
    </AnimatedTouchable>
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
        withTiming(-12, { duration: 40 }),
        withTiming(12, { duration: 40 }),
        withTiming(-8, { duration: 40 }),
        withTiming(8, { duration: 40 }),
        withTiming(-4, { duration: 40 }),
        withTiming(0, { duration: 40 })
      );
      try {
        Vibration.vibrate(25);
      } catch {}
    }
  }, [shake]);

  const handlePressDigit = (digit: string) => {
    if (disabled || value.length >= length) return;
    const next = value + digit;
    onChange(next);
    if (next.length === length && onComplete) {
      onComplete(next);
    }
  };

  const handlePressDelete = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const animatedDotsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  const dotSize = length === 6 ? 12.5 : 14;
  const dotGap = length === 6 ? 13 : 18;

  return (
    <View style={styles.container}>
      {/* Dots Row */}
      <Animated.View style={[styles.dotsContainer, { gap: dotGap }, animatedDotsStyle]}>
        {Array.from({ length }).map((_, idx) => {
          const filled = idx < value.length;
          return (
            <AnimatedDot
              key={idx}
              filled={filled}
              error={Boolean(errorMessage)}
              size={dotSize}
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
          <KeypadDigitButton
            key={k.num}
            item={k}
            disabled={disabled}
            onPress={() => handlePressDigit(k.num)}
          />
        ))}

        {/* Bottom Row: Biometric Shortcut / Empty, '0', Delete */}
        {showBiometricButton && onBiometricPress ? (
          <KeypadActionButton disabled={disabled} onPress={onBiometricPress}>
            <Fingerprint size={28} color={colors.accent || "#fafafa"} />
          </KeypadActionButton>
        ) : (
          <View style={[styles.keyBtn, styles.emptyKey]} />
        )}

        <KeypadDigitButton
          item={{ num: "0", sub: "" }}
          disabled={disabled}
          onPress={() => handlePressDigit("0")}
        />

        <KeypadActionButton
          disabled={disabled || value.length === 0}
          onPress={handlePressDelete}
        >
          <BackspaceIcon
            size={24}
            color={value.length > 0 ? "#f4f4f5" : "rgba(255, 255, 255, 0.2)"}
          />
        </KeypadActionButton>
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
    height: 36,
    marginBottom: 8,
  },
  dot: {
    borderWidth: 1,
  },
  dotEmpty: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  dotFilled: {
    backgroundColor: "#fafafa",
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 4,
  },
  dotError: {
    borderColor: "#ef4444",
    backgroundColor: "#ef4444",
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
