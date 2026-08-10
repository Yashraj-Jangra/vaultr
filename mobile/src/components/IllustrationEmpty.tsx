import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { Shield } from "lucide-react-native";

interface Props {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export function IllustrationEmpty({ title, description, icon }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.haloGlow} />
      <View style={styles.iconCircle}>
        {icon || <Shield size={36} color={colors.accent} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  haloGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    top: 50,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: colors.textDim,
    textAlign: "center",
    lineHeight: 18,
  },
});
