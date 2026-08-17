import React, { useState, useMemo } from "react";
import { StyleSheet, View, Image, Text } from "react-native";
import { resolveDomain } from "@vaultr/core";
import { Globe, Lock, CreditCard, FileText, User, MapPin } from "lucide-react-native";
import { colors } from "../theme/colors";

export function SiteIcon({
  domain,
  name,
  url,
  template = "login",
  size = 38,
  resizeMode = "contain",
  fill = false,
  borderless = false,
}: {
  domain?: string | null;
  name: string;
  url?: string | null;
  template?: string;
  size?: number;
  resizeMode?: "contain" | "cover";
  fill?: boolean;
  borderless?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const effectiveDomain = useMemo(() => resolveDomain(domain, name, url), [domain, name, url]);

  if (template !== "login" || !effectiveDomain || hasError) {
    let icon = <Globe size={size * 0.62} color={colors.textMuted} />;
    if (template === "card") icon = <CreditCard size={size * 0.62} color={colors.accent} />;
    if (template === "note") icon = <FileText size={size * 0.62} color={colors.warning} />;
    if (template === "address") icon = <MapPin size={size * 0.62} color={colors.success} />;
    if (template === "profile") icon = <User size={size * 0.62} color={colors.cardBlue} />;

    return (
      <View
        style={[
          styles.fallbackContainer,
          borderless && styles.borderless,
          { width: size, height: size, borderRadius: size * 0.28 },
        ]}
      >
        {icon}
      </View>
    );
  }

  const isAndroid =
    effectiveDomain === "android" ||
    effectiveDomain === "androidapp" ||
    effectiveDomain.startsWith("android:");

  const src = isAndroid
    ? "https://developer.android.com/static/images/brand/android-head_flat.png"
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=128`;

  const imgSize = fill ? size : size * 0.9;

  return (
    <View
      style={[
        styles.iconWrapper,
        borderless && styles.borderless,
        { width: size, height: size, borderRadius: size * 0.28, overflow: "hidden" },
      ]}
    >
      <Image
        source={{ uri: src }}
        style={{
          width: imgSize,
          height: imgSize,
          borderRadius: fill ? size * 0.28 : size * 0.15,
          resizeMode: resizeMode,
        }}
        onError={() => setHasError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  borderless: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
});
