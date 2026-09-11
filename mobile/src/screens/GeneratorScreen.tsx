import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  generateRandom,
  generatePassphrase,
  generatePin,
  generatePattern,
  scorePassword,
  GeneratorMode,
  StrengthResult,
  PatternOptions,
} from "@vaultr/core";
import * as Clipboard from "expo-clipboard";
import { copyToClipboardWithAutoClear } from "../services/clipboard";
import { colors } from "../theme/colors";
import { CustomSwitch } from "../components/CustomSwitch";
import { PressableScale } from "../components/PressableScale";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Wand2, Copy, Check, RefreshCw, History } from "lucide-react-native";
import { useResponsive } from "../utils/responsive";

type Mode = "random" | "passphrase" | "pin" | "pattern";

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

const CIPHER_LOWER = "abcdefghijklmnopqrstuvwxyz";
const CIPHER_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CIPHER_DIGITS = "0123456789";
const CIPHER_SYMBOLS = "!@#$%^&*()_+-=[]{}|:<>?~";

const ALL_CHAR_POOLS = [CIPHER_LOWER, CIPHER_UPPER, CIPHER_DIGITS, CIPHER_SYMBOLS];

function getRandomScrambleChar(mode: Mode): string {
  if (mode === "pin") {
    return CIPHER_DIGITS[Math.floor(Math.random() * CIPHER_DIGITS.length)];
  }
  if (mode === "passphrase") {
    return CIPHER_LOWER[Math.floor(Math.random() * CIPHER_LOWER.length)];
  }
  // Even distribution: 25% lowercase, 25% uppercase, 25% digits, 25% symbols
  const pool = ALL_CHAR_POOLS[Math.floor(Math.random() * ALL_CHAR_POOLS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

interface CipherChar {
  char: string;
  isLocked: boolean;
}

function CipherScrambleOutput({
  value,
  mode,
  triggerKey,
}: {
  value: string;
  mode: Mode;
  triggerKey?: string | number;
}) {
  const [displayChars, setDisplayChars] = useState<CipherChar[]>(() =>
    value ? value.split("").map((c) => ({ char: c, isLocked: true })) : []
  );

  useEffect(() => {
    if (!value) {
      setDisplayChars([]);
      return;
    }

    const targetLen = value.length;
    const totalFrames = Math.min(Math.max(targetLen, 10), 14);
    let frame = 0;

    // Immediately start with scrambled characters across all categories
    const initialScramble: CipherChar[] = [];
    for (let i = 0; i < targetLen; i++) {
      if (value[i] === "-" || value[i] === " ") {
        initialScramble.push({ char: value[i], isLocked: true });
      } else {
        initialScramble.push({ char: getRandomScrambleChar(mode), isLocked: false });
      }
    }
    setDisplayChars(initialScramble);

    const interval = setInterval(() => {
      frame++;
      const lockedCount = Math.floor((frame / totalFrames) * targetLen);

      if (frame >= totalFrames) {
        clearInterval(interval);
        setDisplayChars(value.split("").map((c) => ({ char: c, isLocked: true })));
      } else {
        const nextChars: CipherChar[] = [];
        for (let i = 0; i < targetLen; i++) {
          if (i < lockedCount) {
            nextChars.push({ char: value[i], isLocked: true });
          } else if (value[i] === "-" || value[i] === " ") {
            nextChars.push({ char: value[i], isLocked: true });
          } else {
            nextChars.push({ char: getRandomScrambleChar(mode), isLocked: false });
          }
        }
        setDisplayChars(nextChars);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [value, triggerKey, mode]);

  if (!value) return <Text style={{ color: "#525252" }}>—</Text>;

  if (mode === "pin") {
    return (
      <Text style={[styles.outputText, { color: "#fbbf24", letterSpacing: 4 }]}>
        {displayChars.map((item, i) => (
          <Text
            key={i}
            style={{
              color: "#fbbf24",
              opacity: item.isLocked ? 1 : 0.75,
            }}
          >
            {item.char}
          </Text>
        ))}
      </Text>
    );
  }

  if (mode === "passphrase") {
    return (
      <Text style={[styles.outputText, { color: "#7dd3fc" }]}>
        {displayChars.map((item, i) => (
          <Text
            key={i}
            style={{
              color: "#7dd3fc",
              opacity: item.isLocked ? 1 : 0.75,
            }}
          >
            {item.char}
          </Text>
        ))}
      </Text>
    );
  }

  return (
    <Text style={styles.outputText}>
      {displayChars.map((item, i) => {
        const cls = classifyChar(item.char);
        const color = CHAR_COLOR[cls];
        return (
          <Text
            key={i}
            style={{
              color,
              opacity: item.isLocked ? 1 : 0.88,
            }}
          >
            {item.char}
          </Text>
        );
      })}
    </Text>
  );
}

function AnimatedRegenerateButton({ onPress }: { onPress: () => void }) {
  const spin = useSharedValue(0);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${spin.value}deg` },
    ],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.85, { duration: 60 }),
      withSpring(1.0, { damping: 18, stiffness: 340 })
    );
    spin.value = withSpring(spin.value + 360, {
      damping: 16,
      stiffness: 220,
      mass: 0.6,
    });
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.iconBtn}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <Animated.View style={animatedStyle}>
        <RefreshCw size={18} color="#a1a1aa" />
      </Animated.View>
    </TouchableOpacity>
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

  // Pattern options
  const [patternStr, setPatternStr] = useState("ULL-ddd-SS");
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
      if (mode === "pattern") {
        return generatePattern({ pattern: patternStr });
      }
    } catch {
      return "";
    }
    return "";
  }, [mode, length, useUpper, useLower, useDigits, useSymbols, wordCount, separator, capitalize, pinLength, patternStr, seed]);

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

  const { isSplitView } = useResponsive();

  const renderOutputPane = () => (
    <View style={{ gap: 16 }}>
      {/* Mode Selector Tabs */}
      <View style={styles.modeTabs}>
        {(["random", "passphrase", "pin", "pattern"] as Mode[]).map((m) => (
          <PressableScale
            key={m}
            scaleTo={0.96}
            style={[styles.modeTab, mode === m && styles.modeTabActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
              {m === "random" ? "Password" : m === "passphrase" ? "Passphrase" : m === "pin" ? "PIN" : "Pattern"}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* ── Generated Password Output Display Card ── */}
      <View style={styles.outputCard}>
        <View style={styles.outputBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <CipherScrambleOutput
              value={currentPassword}
              mode={mode}
              triggerKey={seed}
            />
          </ScrollView>

          <View style={styles.actionRow}>
            <AnimatedRegenerateButton onPress={handleRegenerate} />

            <PressableScale
              style={styles.copyMainBtn}
              onPress={() => handleCopy()}
              scaleTo={0.96}
            >
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
            </PressableScale>
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
    </View>
  );

  const renderControlsPane = () => (
    <View style={{ gap: 16 }}>
      {/* ── Mode Specific Controls ── */}

      {/* 1. RANDOM PASSWORD CONTROLS */}
      {mode === "random" && (
        <View style={styles.controlsCard}>
          <View style={styles.controlHeader}>
            <Text style={styles.controlTitle}>Length: {length}</Text>
            <View style={styles.counterGroup}>
              <PressableScale
                style={styles.counterBtn}
                onPress={() => setLength((l) => Math.max(8, l - 1))}
                scaleTo={0.92}
              >
                <Text style={styles.counterBtnText}>-</Text>
              </PressableScale>
              <Text style={styles.counterValue}>{length}</Text>
              <PressableScale
                style={styles.counterBtn}
                onPress={() => setLength((l) => Math.min(64, l + 1))}
                scaleTo={0.92}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </PressableScale>
            </View>
          </View>

          {/* Quick length presets */}
          <View style={styles.presetRow}>
            {[12, 16, 24, 32, 64].map((l) => (
              <PressableScale
                key={l}
                style={[styles.presetPill, length === l && styles.presetPillActive]}
                onPress={() => setLength(l)}
                scaleTo={0.94}
              >
                <Text style={[styles.presetText, length === l && styles.presetTextActive]}>
                  {l}
                </Text>
              </PressableScale>
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

      {/* 4. PATTERN CONTROLS */}
      {mode === "pattern" && (
        <View style={styles.controlsCard}>
          <Text style={styles.controlTitle}>Pattern Template</Text>
          <TextInput
            style={styles.patternInput}
            value={patternStr}
            onChangeText={setPatternStr}
            placeholder="ULL-ddd-SS"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />

          <View style={styles.divider} />
          <Text style={styles.sectionSubLabel}>Pattern Tokens</Text>
          <View style={styles.patternLegend}>
            {[
              { token: "L", desc: "lowercase (a-z)", color: "#e4e4e7" },
              { token: "U", desc: "uppercase (A-Z)", color: "#38bdf8" },
              { token: "d", desc: "digit (0-9)",     color: "#fbbf24" },
              { token: "S", desc: "symbol (!@#)",    color: "#fb7185" },
              { token: "*", desc: "any random",      color: "#c084fc" },
              { token: "- / _", desc: "literal text", color: "#71717a" },
            ].map(({ token, desc, color }) => (
              <View key={token} style={styles.legendTokenRow}>
                <View style={styles.tokenBadge}>
                  <Text style={[styles.legendToken, { color }]}>{token}</Text>
                </View>
                <Text style={styles.legendTokenDesc}>{desc}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Recent History Panel ── */}
      {(showHistory || isSplitView) && history.length > 0 && (
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
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

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

      {isSplitView ? (
        <ScrollView contentContainerStyle={styles.splitContent} showsVerticalScrollIndicator={false}>
          <View style={styles.splitLeftCol}>
            {renderOutputPane()}
          </View>
          <View style={styles.splitRightCol}>
            {renderControlsPane()}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {renderOutputPane()}
          {renderControlsPane()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  splitContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 24,
    gap: 24,
  },
  splitLeftCol: {
    width: 380,
    maxWidth: "45%",
    gap: 16,
  },
  splitRightCol: {
    flex: 1,
    gap: 16,
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
  patternInput: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "monospace",
    color: "#f4f4f5",
  },
  patternLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  legendTokenRow: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 8,
    padding: 8,
  },
  tokenBadge: {
    backgroundColor: "#18181b",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  legendToken: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  legendTokenDesc: {
    fontSize: 11,
    color: "#a1a1aa",
    flex: 1,
  },
});
