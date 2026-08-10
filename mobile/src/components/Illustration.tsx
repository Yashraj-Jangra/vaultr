import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { ILLUSTRATION_DATA } from "./illustrationData";

interface IllustrationProps {
  name: string; // e.g. "secure-login_m11a", "forgot-password_nttj", "vault_tyfh", "empty_4zx0", or short names "secure-login", "forgot-password", "vault", "empty", "throw-away"
  width?: number;
  height?: number;
  style?: any;
}

/** Resolves illustration key by exact match or prefix match */
function getSvgXml(name: string): string {
  const cleanName = name.replace(/\.svg$/, "");
  if (ILLUSTRATION_DATA[cleanName]) {
    return ILLUSTRATION_DATA[cleanName];
  }
  // Try finding by prefix match (e.g. "secure-login" -> "secure-login_m11a")
  const key = Object.keys(ILLUSTRATION_DATA).find((k) =>
    k === cleanName || k.startsWith(cleanName + "_") || k.startsWith(cleanName)
  );
  if (key && ILLUSTRATION_DATA[key]) {
    return ILLUSTRATION_DATA[key];
  }
  // Fallback to vault_tyfh
  return ILLUSTRATION_DATA["vault_tyfh"] || "";
}

export function Illustration({ name, width = 160, height = 120, style }: IllustrationProps) {
  const xml = useMemo(() => getSvgXml(name), [name]);

  if (!xml) return null;

  return (
    <View style={[styles.container, style]}>
      {/* Subtle ambient glow highlight per design system guidelines */}
      <View style={styles.ambientGlow} />
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ambientGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(167, 139, 250, 0.05)",
  },
});
