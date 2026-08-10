import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
} from "react-native";
import { generateRandomPassword, scorePassword } from "@vaultr/core";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { Wand2, Copy, Check, RefreshCw, Shield } from "lucide-react-native";

export function GeneratorScreen() {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [copied, setCopied] = useState(false);

  const [seed, setSeed] = useState(0);

  const generatedPassword = useMemo(() => {
    return generateRandomPassword({
      length,
      useUpper,
      useLower,
      useDigits: useNumbers,
      useSymbols,
      pronounceable: false,
      minUpper: 0,
      minDigits: 0,
      minSymbols: 0,
      exclude: "",
    });
  }, [length, useUpper, useLower, useNumbers, useSymbols, seed]);

  const strength = useMemo(() => scorePassword(generatedPassword), [generatedPassword]);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Wand2 size={20} color={colors.accent} />
          <Text style={styles.headerTitle}>Password Generator</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Output Display Card */}
        <View style={styles.outputCard}>
          <Text style={styles.passwordText} selectable numberOfLines={3}>
            {generatedPassword}
          </Text>

          <View style={styles.outputActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setSeed((s) => s + 1)}
            >
              <RefreshCw size={18} color={colors.textMuted} />
              <Text style={styles.actionBtnText}>Regenerate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
              {copied ? (
                <>
                  <Check size={18} color={colors.success} />
                  <Text style={[styles.copyBtnText, { color: colors.success }]}>
                    Copied
                  </Text>
                </>
              ) : (
                <>
                  <Copy size={18} color={colors.bg} />
                  <Text style={styles.copyBtnText}>Copy Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Strength Meter Bar */}
          <View style={styles.strengthRow}>
            <Text style={styles.strengthLabel}>
              Strength: {strength.label} ({strength.score}/100)
            </Text>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${Math.max(10, strength.score)}%`,
                    backgroundColor:
                      strength.score > 70
                        ? colors.success
                        : strength.score > 40
                        ? colors.warning
                        : colors.danger,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Options Card */}
        <View style={styles.optionsCard}>
          <Text style={styles.sectionTitle}>CHARACTER OPTIONS</Text>

          {/* Length Row */}
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Length ({length})</Text>
            <View style={styles.lengthControls}>
              <TouchableOpacity
                style={styles.lenBtn}
                onPress={() => setLength((l) => Math.max(8, l - 1))}
              >
                <Text style={styles.lenBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.lenValText}>{length}</Text>
              <TouchableOpacity
                style={styles.lenBtn}
                onPress={() => setLength((l) => Math.min(64, l + 1))}
              >
                <Text style={styles.lenBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Uppercase Toggle */}
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Uppercase (A-Z)</Text>
            <Switch
              value={useUpper}
              onValueChange={setUseUpper}
              trackColor={{ false: colors.surface3, true: colors.accent }}
            />
          </View>

          {/* Lowercase Toggle */}
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Lowercase (a-z)</Text>
            <Switch
              value={useLower}
              onValueChange={setUseLower}
              trackColor={{ false: colors.surface3, true: colors.accent }}
            />
          </View>

          {/* Numbers Toggle */}
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Numbers (0-9)</Text>
            <Switch
              value={useNumbers}
              onValueChange={setUseNumbers}
              trackColor={{ false: colors.surface3, true: colors.accent }}
            />
          </View>

          {/* Symbols Toggle */}
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Symbols (!@#$%^&*)</Text>
            <Switch
              value={useSymbols}
              onValueChange={setUseSymbols}
              trackColor={{ false: colors.surface3, true: colors.accent }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  outputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  passwordText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "monospace",
    letterSpacing: 1,
    textAlign: "center",
  },
  outputActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  copyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  copyBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 13,
  },
  strengthRow: {
    gap: 6,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  meterTrack: {
    height: 6,
    backgroundColor: colors.surface3,
    borderRadius: 3,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 3,
  },
  optionsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDim,
    letterSpacing: 1,
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },
  lengthControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lenBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  lenBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  lenValText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
});
