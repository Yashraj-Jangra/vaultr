import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Illustration } from "./Illustration";
import { RotateCcw } from "lucide-react-native";

export type MobileErrorType =
  | "network"
  | "auth"
  | "security"
  | "not-found"
  | "server"
  | "upload"
  | "generic";

interface ErrorDisplayProps {
  type?: MobileErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  actionText?: string;
  style?: any;
}

const ERROR_CONFIGS: Record<MobileErrorType, { illustration: string; defaultTitle: string; glow: string }> = {
  network: {
    illustration: "connection-lost_am29",
    defaultTitle: "Connection Problem",
    glow: "rgba(59, 130, 246, 0.12)",
  },
  auth: {
    illustration: "goodbye_mkv7",
    defaultTitle: "Authentication Required",
    glow: "rgba(245, 158, 11, 0.12)",
  },
  security: {
    illustration: "firewall_cfej",
    defaultTitle: "Access Restricted",
    glow: "rgba(239, 68, 68, 0.12)",
  },
  "not-found": {
    illustration: "lost_teip",
    defaultTitle: "Item Not Found",
    glow: "rgba(168, 85, 247, 0.12)",
  },
  server: {
    illustration: "server-failure_syqp",
    defaultTitle: "Server Error",
    glow: "rgba(239, 68, 68, 0.12)",
  },
  upload: {
    illustration: "upload-warning_aqma",
    defaultTitle: "Upload Issue",
    glow: "rgba(245, 158, 11, 0.12)",
  },
  generic: {
    illustration: "buggy-code_qtah",
    defaultTitle: "Something Went Wrong",
    glow: "rgba(245, 158, 11, 0.12)",
  },
};

export function ErrorDisplay({
  type = "generic",
  title,
  message,
  onRetry,
  actionText = "Try again",
  style,
}: ErrorDisplayProps) {
  const config = ERROR_CONFIGS[type] || ERROR_CONFIGS.generic;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.illustrationWrap}>
        <View style={[styles.glow, { backgroundColor: config.glow }]} />
        <Illustration name={config.illustration} width={180} height={130} />
      </View>

      <Text style={styles.title}>{title || config.defaultTitle}</Text>

      {!!message && <Text style={styles.message}>{message}</Text>}

      {!!onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <RotateCcw size={14} color="#09090b" style={styles.retryIcon} />
          <Text style={styles.retryBtnText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  illustrationWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 16,
  },
  glow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f4f4f5",
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryIcon: {
    marginRight: 6,
  },
  retryBtnText: {
    color: "#09090b",
    fontSize: 13,
    fontWeight: "700",
  },
});
