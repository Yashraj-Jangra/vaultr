import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { generateTOTP, getTotpCountdown } from "@vaultr/core";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeInUp,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { copyToClipboardWithAutoClear } from "../services/clipboard";
import { colors } from "../theme/colors";
import { Copy, Check, ShieldCheck } from "lucide-react-native";
import { SiteIcon } from "./SiteIcon";
import { PressableScale } from "./PressableScale";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  secret: string;
  name?: string;
  domain?: string;
}

export function TotpCode({ secret, name, domain }: Props) {
  const [code, setCode] = useState<string>("------");
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  const radius = 22;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * radius;

  // Continuous smooth countdown ring progress
  const progressAnim = useSharedValue(30);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    let mounted = true;
    const updateCode = async () => {
      try {
        const totp = await generateTOTP(secret);
        const countdown = getTotpCountdown();
        if (mounted) {
          setCode(totp);
          setSecondsLeft(countdown);
          // Smooth continuous transition to the target countdown second
          progressAnim.value = withTiming(countdown, {
            duration: 980,
            easing: Easing.linear,
          });
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

  const isExpiring = secondsLeft <= 5;

  // Gentle heartbeat pulse when token is about to expire (<= 5s)
  useEffect(() => {
    if (isExpiring) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 200 });
    }
  }, [isExpiring]);

  const handleCopy = async () => {
    if (!code || code === "ERROR" || code === "------") return;
    await copyToClipboardWithAutoClear(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const animatedCircleProps = useAnimatedProps(() => {
    const frac = Math.max(0, Math.min(1, progressAnim.value / 30));
    const offset = -circumference * (1 - frac);
    return {
      strokeDashoffset: offset,
    };
  });

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <PressableScale
      scaleTo={0.985}
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
            {/* Animated Smooth Progress Circle (Counterclockwise) */}
            <AnimatedCircle
              cx="26"
              cy="26"
              r={radius}
              stroke={isExpiring ? "#f87171" : "#38bdf8"}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference}`}
              animatedProps={animatedCircleProps}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
          </Svg>
          {/* Favicon or Fallback Icon centered in ring */}
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

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.75}>
          {copied ? (
            <Check size={18} color="#34d399" />
          ) : (
            <Copy size={18} color="#71717a" />
          )}
        </TouchableOpacity>
      </View>

      {/* Code Display: Split Monospace Segments with Digit Refresh Cascade */}
      <View style={styles.codeContainer}>
        {code === "ERROR" || code === "------" ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Invalid TOTP Secret</Text>
          </View>
        ) : (
          <Animated.View
            key={code}
            entering={FadeInUp.duration(160)}
            style={[styles.segmentedRow, isExpiring && pulseAnimatedStyle]}
          >
            <View
              style={[
                styles.segmentPill,
                isExpiring && styles.segmentPillExpiring,
              ]}
            >
              <Text style={[styles.codeSegment, isExpiring && { color: "#f87171" }]}>
                {code.slice(0, 3)}
              </Text>
            </View>
            <Text style={[styles.dashDivider, isExpiring && { color: "#f87171" }]}>-</Text>
            <View
              style={[
                styles.segmentPill,
                isExpiring && styles.segmentPillExpiring,
              ]}
            >
              <Text style={[styles.codeSegment, isExpiring && { color: "#f87171" }]}>
                {code.slice(3, 6)}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </PressableScale>
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
    gap: 3,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fafafa",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timerText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#71717a",
  },
  timerExpiring: {
    color: "#f87171",
    fontWeight: "600",
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
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  codeContainer: {
    width: "100%",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
  segmentedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  segmentPill: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  segmentPillExpiring: {
    borderColor: "rgba(248, 113, 113, 0.35)",
    backgroundColor: "rgba(248, 113, 113, 0.08)",
  },
  codeSegment: {
    fontFamily: "monospace",
    fontSize: 22,
    fontWeight: "700",
    color: "#38bdf8",
    letterSpacing: 3,
  },
  dashDivider: {
    fontSize: 20,
    fontWeight: "600",
    color: "#3f3f46",
  },
});
