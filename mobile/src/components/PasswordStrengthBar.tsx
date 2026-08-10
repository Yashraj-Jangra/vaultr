import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { scorePassword } from "@vaultr/core";
import { colors } from "../theme/colors";

interface Props {
  password?: string;
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Strength</Text>
        <Text style={[styles.statusText, { color: barColors[score] }]}>
          {labels[score]} ({result.entropy} bits)
        </Text>
      </View>

      <View style={styles.barsRow}>
        {[0, 1, 2, 3].map((idx) => {
          const active = idx < score;
          return (
            <View
              key={idx}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? barColors[score] : colors.surface3,
                },
              ]}
            />
          );
        })}
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
    gap: 4,
    height: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 2,
  },
});
