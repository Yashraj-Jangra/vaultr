import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { scorePassword } from "@vaultr/core";
import { colors } from "../theme/colors";

interface Props {
  password?: string;
}

function StrengthSegment({
  index,
  score,
  targetColor,
}: {
  index: number;
  score: number;
  targetColor: string;
}) {
  const active = index < score;
  const fill = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value = withDelay(
      index * 35,
      withSpring(active ? 1 : 0, {
        damping: 18,
        stiffness: 280,
        mass: 0.5,
      })
    );
  }, [active, index]);

  const fillAnimatedStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
    backgroundColor: targetColor,
  }));

  return (
    <View style={styles.segmentTrack}>
      <Animated.View style={[styles.segmentFill, fillAnimatedStyle]} />
    </View>
  );
}

export function PasswordStrengthBar({ password = "" }: Props) {
  const result = scorePassword(password);
  const score = result.score; // 0 to 4

  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const barColors = [
    colors.danger,
    colors.danger,
    colors.warning,
    colors.success,
    colors.success,
  ];

  const currentColor = barColors[score];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Strength</Text>
        <Text style={[styles.statusText, { color: currentColor }]}>
          {labels[score]} ({result.entropy} bits)
        </Text>
      </View>

      <View style={styles.barsRow}>
        {[0, 1, 2, 3].map((idx) => (
          <StrengthSegment
            key={idx}
            index={idx}
            score={score}
            targetColor={currentColor}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  barsRow: {
    flexDirection: "row",
    gap: 5,
    height: 4,
  },
  segmentTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface3,
    overflow: "hidden",
  },
  segmentFill: {
    height: "100%",
    borderRadius: 2,
  },
});
