import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { generateTOTP, getTotpCountdown } from "@vaultr/core";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { Copy, Check, KeyRound } from "lucide-react-native";

interface Props {
  secret: string;
  name?: string;
}

export function TotpCode({ secret, name }: Props) {
  const [code, setCode] = useState<string>("------");
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timer: any;
    const updateCode = async () => {
      try {
        const totp = await generateTOTP(secret);
        const countdown = getTotpCountdown();
        setCode(totp);
        setSecondsLeft(countdown);
      } catch {
        setCode("ERROR");
      }
    };

    updateCode();
    timer = setInterval(updateCode, 1000);
    return () => clearInterval(timer);
  }, [secret]);

  const handleCopy = async () => {
    if (!code || code === "ERROR" || code === "------") return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = (secondsLeft / 30) * 100;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <KeyRound size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nameText}>{name || "2FA Authenticator Code"}</Text>
          <Text style={styles.timerText}>{secondsLeft}s remaining</Text>
        </View>

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          {copied ? (
            <Check size={18} color={colors.success} />
          ) : (
            <Copy size={18} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.codeRow}>
        <Text style={styles.codeText}>{code.slice(0, 3)}</Text>
        <Text style={styles.codeSpacer}> </Text>
        <Text style={styles.codeText}>{code.slice(3)}</Text>
      </View>

      {/* Progress Track */}
      <View style={styles.track}>
        <View
          style={[
            styles.bar,
            {
              width: `${progressPercent}%`,
              backgroundColor: secondsLeft < 6 ? colors.danger : colors.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentBg,
    alignItems: "center",
    justifyContent: "center",
  },
  nameText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  timerText: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  copyBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingVertical: 12,
  },
  codeText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 4,
    fontFamily: "monospace",
  },
  codeSpacer: {
    fontSize: 28,
    width: 12,
  },
  track: {
    height: 4,
    backgroundColor: colors.surface3,
    borderRadius: 2,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 2,
  },
});
