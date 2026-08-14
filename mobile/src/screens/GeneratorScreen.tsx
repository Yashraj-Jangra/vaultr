import React, { useState, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  generateRandom,
  generatePassphrase,
  generatePin,
  scorePassword,
  GeneratorMode,
  StrengthResult,
} from "@vaultr/core";
import * as Clipboard from "expo-clipboard";
import { copyToClipboardWithAutoClear } from "../services/clipboard";
import { colors } from "../theme/colors";
import { CustomSwitch } from "../components/CustomSwitch";
import { Wand2, Copy, Check, RefreshCw, History } from "lucide-react-native";

type Mode = "random" | "passphrase" | "pin";

interface HistoryEntry {
  id: string;
  value: string;
  mode: Mode;
  strength: StrengthResult;
}

// ── Colorize Character Helper ──────────────────────────────────────────────
type CharClass = "lower" | "upper" | "digit" | "symbol";

function classifyChar(c: string): CharClass {
  if (/[a-z]/.test(c)) return "lower";
  if (/[A-Z]/.test(c)) return "upper";
  if (/[0-9]/.test(c)) return "digit";
  return "symbol";
}

const CHAR_COLOR: Record<CharClass, string> = {
  lower: "#e4e4e7",
  upper: "#38bdf8",
  digit: "#fbbf24",
  symbol: "#fb7185",
};

function ColorizedOutput({ value, mode }: { value: string; mode: Mode }) {
  if (!value) return <Text style={{ color: "#525252" }}>—</Text>;

  if (mode === "pin") {
    return (
      <Text style={[styles.outputText, { color: "#fbbf24", letterSpacing: 4 }]}>
        {value}
      </Text>
    );
  }

  if (mode === "passphrase") {
    return (
      <Text style={[styles.outputText, { color: "#7dd3fc" }]}>
        {value}
      </Text>
    );
  }

  return (
    <Text style={styles.outputText}>
      {value.split("").map((c, i) => (
        <Text key={i} style={{ color: CHAR_COLOR[classifyChar(c)] }}>
          {c}
        </Text>
      ))}
    </Text>
  );
}

export function GeneratorScreen() {
  const [mode, setMode] = useState<Mode>("random");
  
  // Random options
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);

  // Passphrase options
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalize, setCapitalize] = useState(true);

  // PIN options
  const [pinLength, setPinLength] = useState(6);
  const [seed, setSeed] = useState(0);

  // Copy state
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Generate current password
  const currentPassword = useMemo(() => {
    try {
      if (mode === "random") {
        return generateRandom({
          length,
          useLower,
          useUpper,
          useDigits,
          useSymbols,
          pronounceable: false,
          minUpper: 0,
          minDigits: 0,
          minSymbols: 0,
          exclude: "",
        });
      }
      if (mode === "passphrase") {
        return generatePassphrase({
          wordCount,
          separator,
          capitalize,
        });
      }
      if (mode === "pin") {
        return generatePin({ length: pinLength });
      }
    } catch {
      return "";
    }
    return "";
  }, [mode, length, useUpper, useLower, useDigits, useSymbols, wordCount, separator, capitalize, pinLength, seed]);

  const strength = useMemo(() => scorePassword(currentPassword), [currentPassword]);

  // Character counts
  const charCounts = useMemo(() => {
    let lower = 0, upper = 0, digit = 0, symbol = 0;
    for (const c of currentPassword) {
      const cls = classifyChar(c);
      if (cls === "lower") lower++;
      if (cls === "upper") upper++;
      if (cls === "digit") digit++;
      if (cls === "symbol") symbol++;
    }
    return { lower, upper, digit, symbol };
  }, [currentPassword]);

  // Regenerate manual trigger & push to history
  const handleRegenerate = useCallback(() => {
    setSeed((s) => s + 1);
    if (currentPassword) {
      setHistory((prev) => [
        { id: String(Date.now()), value: currentPassword, mode, strength },
        ...prev.slice(0, 19),
      ]);
    }
  }, [currentPassword, mode, strength]);

  const handleCopy = async (val?: string) => {
    const textToCopy = val || currentPassword;
    if (!textToCopy) return;
    await copyToClipboardWithAutoClear(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Wand2 size={20} color={colors.accent} />
          <Text style={styles.headerTitle}>Generator</Text>
        </View>
        <TouchableOpacity
          style={[styles.historyBtn, showHistory && styles.historyBtnActive]}
          onPress={() => setShowHistory(!showHistory)}
        >
          <History size={18} color={showHistory ? "#ffffff" : colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Mode Selector Tabs */}
        <View style={styles.modeTabs}>
          {(["random", "passphrase", "pin"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeTab, mode === m && styles.modeTabActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                {m === "random" ? "Password" : m === "passphrase" ? "Passphrase" : "PIN"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Generated Password Output Display Card ── */}
        <View style={styles.outputCard}>
          <View style={styles.outputBox}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ColorizedOutput value={currentPassword} mode={mode} />
            </ScrollView>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleRegenerate}>
                <RefreshCw size={18} color="#a1a1aa" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.copyMainBtn} onPress={() => handleCopy()}>
                {copied ? (
                  <>
                    <Check size={16} color="#34d399" />
                    <Text style={styles.copiedText}>Copied!</Text>
                  </>
                ) : (
                  <>
                    <Copy size={16} color="#09090b" />
                    <Text style={styles.copyBtnText}>Copy Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Color Legend (for Random mode) */}
          {mode === "random" && (
            <View style={styles.colorLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#e4e4e7" }]} />
                <Text style={styles.legendText}>a-z</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#38bdf8" }]} />
                <Text style={[styles.legendText, { color: "#38bdf8" }]}>A-Z</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#fbbf24" }]} />
                <Text style={[styles.legendText, { color: "#fbbf24" }]}>0-9</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#fb7185" }]} />
                <Text style={[styles.legendText, { color: "#fb7185" }]}>!@#</Text>
              </View>
            </View>
          )}

          {/* Strength Bar + Stats */}
          {strength.label ? (
            <View style={styles.strengthSection}>
              <View style={styles.strengthTrack}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthSegment,
                      {
                        backgroundColor: i <= strength.score ? strength.color : "#1f1f23",
                      },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.statsRow}>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
                <Text style={styles.statDot}>•</Text>
                <Text style={styles.statText}>{strength.entropy} bits</Text>
                <Text style={styles.statDot}>•</Text>
                <Text style={styles.statText}>
                  Crack: <Text style={{ color: "#f4f4f5" }}>{strength.crackTime}</Text>
                </Text>
              </View>
            </View>
          ) : null}

          {/* Character Breakdown Counts */}
          {mode === "random" && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownText}>
                {charCounts.lower} lower  •  {charCounts.upper} upper  •  {charCounts.digit} digits  •  {charCounts.symbol} symbols
              </Text>
            </View>
          )}
        </View>

        {/* ── Mode Specific Controls ── */}

        {/* 1. RANDOM PASSWORD CONTROLS */}
        {mode === "random" && (
          <View style={styles.controlsCard}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlTitle}>Length: {length}</Text>
              <View style={styles.counterGroup}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setLength((l) => Math.max(8, l - 1))}
                >
                  <Text style={styles.counterBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{length}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setLength((l) => Math.min(64, l + 1))}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick length presets */}
            <View style={styles.presetRow}>
              {[12, 16, 24, 32, 64].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.presetPill, length === l && styles.presetPillActive]}
                  onPress={() => setLength(l)}
                >
                  <Text style={[styles.presetText, length === l && styles.presetTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Uppercase Characters (A-Z)</Text>
              <CustomSwitch value={useUpper} onValueChange={setUseUpper} />
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Lowercase Characters (a-z)</Text>
              <CustomSwitch value={useLower} onValueChange={setUseLower} />
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Numbers (0-9)</Text>
              <CustomSwitch value={useDigits} onValueChange={setUseDigits} />
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Symbols (!@#$%^&*)</Text>
              <CustomSwitch value={useSymbols} onValueChange={setUseSymbols} />
            </View>
          </View>
        )}

        {/* 2. PASSPHRASE CONTROLS */}
        {mode === "passphrase" && (
          <View style={styles.controlsCard}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlTitle}>Words: {wordCount}</Text>
              <View style={styles.counterGroup}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setWordCount((w) => Math.max(3, w - 1))}
                >
                  <Text style={styles.counterBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{wordCount}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setWordCount((w) => Math.min(10, w + 1))}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionSubLabel}>Word Separator</Text>
            <View style={styles.presetRow}>
              {[
                { label: "Hyphen (-)", val: "-" },
                { label: "Period (.)", val: "." },
                { label: "Underscore (_)", val: "_" },
                { label: "Space", val: " " },
              ].map((item) => (
                <TouchableOpacity
                  key={item.val}
                  style={[styles.presetPill, separator === item.val && styles.presetPillActive]}
                  onPress={() => setSeparator(item.val)}
                >
                  <Text style={[styles.presetText, separator === item.val && styles.presetTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Capitalize Words</Text>
              <CustomSwitch value={capitalize} onValueChange={setCapitalize} />
            </View>
          </View>
        )}

        {/* 3. PIN CONTROLS */}
        {mode === "pin" && (
          <View style={styles.controlsCard}>
            <View style={styles.controlHeader}>
              <Text style={styles.controlTitle}>PIN Length: {pinLength}</Text>
              <View style={styles.counterGroup}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setPinLength((l) => Math.max(4, l - 1))}
                >
                  <Text style={styles.counterBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{pinLength}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setPinLength((l) => Math.min(12, l + 1))}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.presetRow}>
              {[4, 6, 8, 10, 12].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.presetPill, pinLength === l && styles.presetPillActive]}
                  onPress={() => setPinLength(l)}
                >
                  <Text style={[styles.presetText, pinLength === l && styles.presetTextActive]}>
                    {l} Digits
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Recent History Panel ── */}
        {showHistory && history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent Passwords ({history.length})</Text>
            {history.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={styles.historyRow}
                onPress={() => handleCopy(h.value)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyValue} numberOfLines={1}>
                    {h.value}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {h.mode.toUpperCase()} • {h.strength.entropy} bits
                  </Text>
                </View>
                <Copy size={16} color="#71717a" />
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    backgroundColor: "#09090b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  historyBtnActive: {
    backgroundColor: "#27272a",
    borderColor: "#3f3f46",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },

  // Mode Tabs
  modeTabs: {
    flexDirection: "row",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717a",
  },
  modeTabTextActive: {
    color: "#f4f4f5",
  },

  // Output Card
  outputCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  outputBox: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  outputText: {
    fontFamily: "monospace",
    fontSize: 19,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    paddingTop: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  copyMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f4f4f5",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#09090b",
  },
  copiedText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },

  // Color Legend
  colorLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a1a1aa",
    fontFamily: "monospace",
  },

  // Strength Bar & Stats
  strengthSection: {
    gap: 8,
  },
  strengthTrack: {
    flexDirection: "row",
    gap: 4,
    height: 4,
  },
  strengthSegment: {
    flex: 1,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statDot: {
    color: "#3f3f46",
    fontSize: 10,
  },
  statText: {
    fontSize: 11.5,
    color: "#71717a",
  },

  // Breakdown Row
  breakdownRow: {
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    paddingTop: 8,
  },
  breakdownText: {
    fontSize: 11,
    color: "#71717a",
    textAlign: "center",
  },

  // Controls Card
  controlsCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  controlHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  counterGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    padding: 4,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  counterValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f4f4f5",
    paddingHorizontal: 8,
    fontFamily: "monospace",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  presetPill: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetPillActive: {
    backgroundColor: "#f4f4f5",
    borderColor: "#ffffff",
  },
  presetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  presetTextActive: {
    color: "#09090b",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#1c1c1e",
  },
  sectionSubLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  optionLabel: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#f4f4f5",
  },

  // History Card
  historyCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f4f4f5",
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  historyValue: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "600",
    color: "#f4f4f5",
  },
  historyMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#71717a",
    marginTop: 2,
  },
});
