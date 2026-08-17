import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { generateTOTP, getTotpCountdown } from "@vaultr/core";
import * as Clipboard from "expo-clipboard";
import { copyToClipboardWithAutoClear } from "../services/clipboard";
import { colors } from "../theme/colors";
import { Copy, Check, ShieldCheck } from "lucide-react-native";
import { SiteIcon } from "./SiteIcon";

interface Props {
  secret: string;
  name?: string;
  domain?: string;
}

export function TotpCode({ secret, name, domain }: Props) {
  const [code, setCode] = useState<string>("------");
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const updateCode = async () => {
      try {
        const totp = await generateTOTP(secret);
        const countdown = getTotpCountdown();
        if (mounted) {
          setCode(totp);
          setSecondsLeft(countdown);
        }
      } catch {
        if (mounted) setCode("ERROR");
      }
    };

    updateCode();
    const timer = setInterval(updateCode, 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [secret]);

  const handleCopy = async () => {
    if (!code || code === "ERROR" || code === "------") return;
    await copyToClipboardWithAutoClear(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));
  const radius = 22;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;
  // Negative offset for COUNTER-CLOCKWISE ring draining
  const strokeDashoffset = -circumference * (1 - progressPercent / 100);
  const isExpiring = secondsLeft <= 5;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handleCopy}
      style={styles.card}
    >
      {/* Header Row: Circular Ring + Identity */}
      <View style={styles.headerRow}>
        <View style={styles.ringWrapper}>
          <Svg width={52} height={52} style={styles.svgRing}>
            {/* Background Track Circle */}
            <Circle
              cx="26"
              cy="26"
              r={radius}
              stroke="#1f1f23"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Animated Progress Circle (Counterclockwise) */}
            <Circle
              cx="26"
              cy="26"
              r={radius}
              stroke={isExpiring ? "#f87171" : "#38bdf8"}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
          </Svg>
          {/* Favicon or Fallback Icon centered in ring — scaled to fit inside countdown ring */}
          <View style={styles.iconInsideRing}>
            <SiteIcon domain={domain} name={name || ""} size={38} fill={true} borderless={true} />
          </View>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.itemName} numberOfLines={1}>
            {name || "2FA Authenticator"}
          </Text>
          <View style={styles.timerRow}>
            <Text style={[styles.timerText, isExpiring && styles.timerExpiring]}>
              {secondsLeft}s remaining
            </Text>
            {copied && <Text style={styles.copiedBadge}>• COPIED TO CLIPBOARD</Text>}
          </View>
        </View>

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          {copied ? (
            <Check size={18} color="#34d399" />
          ) : (
            <Copy size={18} color="#71717a" />
          )}
        </TouchableOpacity>
      </View>

      {/* Code Display: Split Monospace Segments */}
      <View style={styles.codeContainer}>
        {code === "ERROR" || code === "------" ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Invalid TOTP Secret</Text>
          </View>
        ) : (
          <View style={styles.segmentedRow}>
            <View style={[styles.segmentPill, isExpiring && { borderColor: "rgba(248, 113, 113, 0.4)", backgroundColor: "rgba(248, 113, 113, 0.08)" }]}>
              <Text style={[styles.codeSegment, isExpiring && { color: "#f87171" }]}>{code.slice(0, 3)}</Text>
            </View>
            <Text style={[styles.dashDivider, isExpiring && { color: "#f87171" }]}>-</Text>
            <View style={[styles.segmentPill, isExpiring && { borderColor: "rgba(248, 113, 113, 0.4)", backgroundColor: "rgba(248, 113, 113, 0.08)" }]}>
              <Text style={[styles.codeSegment, isExpiring && { color: "#f87171" }]}>{code.slice(3, 6)}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ringWrapper: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  svgRing: {
    position: "absolute",
  },
  iconInsideRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  infoCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f4f4f5",
    letterSpacing: -0.2,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  timerText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#71717a",
    fontFamily: "monospace",
  },
  timerExpiring: {
    color: "#f87171",
  },
  copiedBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34d399",
    letterSpacing: 0.5,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },

  // Code layout
  codeContainer: {
    paddingTop: 2,
  },
  segmentedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  segmentPill: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 110,
    alignItems: "center",
  },
  codeSegment: {
    fontFamily: "monospace",
    fontSize: 22,
    fontWeight: "800",
    color: "#f4f4f5",
    letterSpacing: 4,
  },
  dashDivider: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3f3f46",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f87171",
  },
});
