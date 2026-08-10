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
  size = 32,
}: {
  domain?: string;
  name: string;
  url?: string;
  template?: string;
  size?: number;
}) {
  const [hasError, setHasError] = useState(false);
  const effectiveDomain = useMemo(() => resolveDomain(domain, name, url), [domain, name, url]);

  if (template !== "login" || !effectiveDomain || hasError) {
    let icon = <Globe size={size * 0.7} color={colors.textMuted} />;
    if (template === "card") icon = <CreditCard size={size * 0.7} color={colors.accent} />;
    if (template === "note") icon = <FileText size={size * 0.7} color={colors.warning} />;
    if (template === "address") icon = <MapPin size={size * 0.7} color={colors.success} />;
    if (template === "profile") icon = <User size={size * 0.7} color={colors.cardBlue} />;

    return (
      <View style={[styles.fallbackContainer, { width: size, height: size, borderRadius: size * 0.3 }]}>
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
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`;

  return (
    <View style={[styles.iconWrapper, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Image
        source={{ uri: src }}
        style={{ width: size * 0.7, height: size * 0.7, resizeMode: "contain" }}
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
});
