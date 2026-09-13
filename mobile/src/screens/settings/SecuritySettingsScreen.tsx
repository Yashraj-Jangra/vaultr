import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
} from "react-native";
import { vaultAlert } from "../../store/alertStore";
import { CustomSwitch } from "../../components/CustomSwitch";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import { isBiometricAvailable, isBiometricEnabled, enrollBiometricPassword, clearBiometricPassword } from "../../services/biometrics";
import { isPinSet, getPinLength, setupPin, clearPin } from "../../services/pin";
import { PinPad } from "../../components/PinPad";
import { Fingerprint, Shield, Clock, Copy, ArrowLeft, CheckCircle2, KeyRound, X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_LOCK_KEY = "vaultr_auto_lock_timeout";
const CLIPBOARD_TIMEOUT_KEY = "vaultr_clipboard_clear_timeout";

export function SecuritySettingsScreen({ navigation }: any) {
  const { masterPassword } = useVaultStore();

  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinLength, setPinLength] = useState(4);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [enteredPin, setEnteredPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinModalError, setPinModalError] = useState("");
  const [shakeModalPin, setShakeModalPin] = useState(false);

  const [autoLockTimeout, setAutoLockTimeout] = useState("5"); // minutes
  const [clipboardTimeout, setClipboardTimeout] = useState("30"); // seconds

  useEffect(() => {
    (async () => {
      const avail = await isBiometricAvailable();
      setBiometricsSupported(avail);
      if (avail) {
        const enabled = await isBiometricEnabled();
        setBiometricsEnabled(enabled);
      }

      const hasPin = await isPinSet();
      setPinEnabled(hasPin);
      if (hasPin) {
        const len = await getPinLength();
        setPinLength(len);
      }

      const savedAutoLock = await AsyncStorage.getItem(AUTO_LOCK_KEY);
      if (savedAutoLock) setAutoLockTimeout(savedAutoLock);

      const savedClip = await AsyncStorage.getItem(CLIPBOARD_TIMEOUT_KEY);
      if (savedClip) setClipboardTimeout(savedClip);
    })();
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    if (val) {
      if (!masterPassword) {
        vaultAlert.alert("Error", "Vault must be unlocked with master password first.", undefined, {
          illustration: "fingerprint_kdwq",
          glowColor: "rgba(239, 68, 68, 0.12)",
        });
        return;
      }
      const res = await enrollBiometricPassword(masterPassword);
      if (res.success) {
        setBiometricsEnabled(true);
        vaultAlert.alert("Biometrics Enabled", "Fingerprint / Face ID unlock enrolled successfully!", undefined, {
          illustration: "fingerprint_kdwq",
          glowColor: "rgba(52, 211, 153, 0.12)",
        });
      } else {
        setBiometricsEnabled(false);
        if (res.error && res.error !== "cancel") {
          vaultAlert.alert("Enrollment Cancelled", res.error, undefined, {
            illustration: "fingerprint_kdwq",
            glowColor: "rgba(239, 68, 68, 0.12)",
          });
        }
      }
    } else {
      await clearBiometricPassword();
      setBiometricsEnabled(false);
    }
  };

  const handleTogglePin = async (val: boolean) => {
    if (val) {
      if (!masterPassword) {
        vaultAlert.alert("Error", "Vault must be unlocked with master password first.", undefined, {
          illustration: "cancel_k4w9",
        });
        return;
      }
      setPinStep("enter");
      setEnteredPin("");
      setConfirmPin("");
      setPinModalError("");
      setShowPinModal(true);
    } else {
      vaultAlert.alert(
        "Disable PIN Unlock?",
        "Are you sure you want to disable PIN unlock on this device?",
        [
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              await clearPin();
              setPinEnabled(false);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
        { illustration: "cancel_k4w9" }
      );
    }
  };

  const handlePinPadChange = (val: string) => {
    if (pinStep === "enter") {
      setEnteredPin(val);
      if (pinModalError) setPinModalError("");
    } else {
      setConfirmPin(val);
      if (pinModalError) setPinModalError("");
    }
  };

  const handlePinPadComplete = async (pin: string) => {
    if (pinStep === "enter") {
      setEnteredPin(pin);
      setPinStep("confirm");
      setConfirmPin("");
      setPinModalError("");
    } else {
      if (pin !== enteredPin) {
        setShakeModalPin(true);
        setTimeout(() => setShakeModalPin(false), 500);
        setPinModalError("PINs do not match. Please re-enter.");
        setConfirmPin("");
        return;
      }

      if (!masterPassword) {
        setShowPinModal(false);
        vaultAlert.alert("Error", "Master password is required to configure PIN.", undefined, {
          illustration: "cancel_k4w9",
        });
        return;
      }

      const res = await setupPin(pin, masterPassword);
      if (res.success) {
        setPinEnabled(true);
        setShowPinModal(false);
        vaultAlert.alert("PIN Enabled", "4-digit PIN unlock configured successfully!", undefined, {
          illustration: "fingerprint_kdwq",
          glowColor: "rgba(52, 211, 153, 0.12)",
        });
      } else {
        setPinModalError(res.error || "Failed to configure PIN");
      }
    }
  };

  const handleSelectAutoLock = async (val: string) => {
    setAutoLockTimeout(val);
    await AsyncStorage.setItem(AUTO_LOCK_KEY, val);
  };

  const handleSelectClipboard = async (val: string) => {
    setClipboardTimeout(val);
    await AsyncStorage.setItem(CLIPBOARD_TIMEOUT_KEY, val);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Security & Biometrics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Biometrics Section */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Fingerprint size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Biometric Unlock</Text>
              <Text style={styles.cardDesc}>
                {biometricsSupported
                  ? "Use Fingerprint or Face ID to unlock your vault without typing master password."
                  : "Biometric hardware is not available or enrolled on this device."}
              </Text>
            </View>
            {biometricsSupported && (
              <CustomSwitch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
              />
            )}
          </View>
        </View>

        {/* Quick PIN Unlock Section */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <KeyRound size={22} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Quick PIN Unlock</Text>
              <Text style={styles.cardDesc}>
                {pinEnabled
                  ? "4-digit PIN is active. Use it to quickly unlock your vault."
                  : "Set a 4-digit PIN for lightning-fast hardware-encrypted re-unlock."}
              </Text>
            </View>
            <CustomSwitch
              value={pinEnabled}
              onValueChange={handleTogglePin}
            />
          </View>
          {pinEnabled && (
            <TouchableOpacity
              style={{ marginTop: 4, alignSelf: "flex-start", paddingVertical: 4 }}
              onPress={() => {
                setPinStep("enter");
                setEnteredPin("");
                setConfirmPin("");
                setPinModalError("");
                setShowPinModal(true);
              }}
            >
              <Text style={{ color: colors.accent || "#fafafa", fontSize: 12, fontWeight: "600" }}>
                Change PIN →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Auto Lock Timeout */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Auto-Lock Timeout</Text>
          </View>
          <Text style={styles.cardDesc}>Automatically lock vault when app remains in background.</Text>

          <View style={styles.pillGrid}>
            {[
              { label: "Immediate", val: "0" },
              { label: "1 min", val: "1" },
              { label: "5 mins", val: "5" },
              { label: "15 mins", val: "15" },
              { label: "1 hour", val: "60" },
              { label: "Never", val: "-1" },
            ].map((item) => (
              <TouchableOpacity
                key={item.val}
                style={[
                  styles.pill,
                  autoLockTimeout === item.val && styles.pillActive,
                ]}
                onPress={() => handleSelectAutoLock(item.val)}
              >
                <Text
                  style={[
                    styles.pillText,
                    autoLockTimeout === item.val && styles.pillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Clipboard Clear Timeout */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Copy size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Auto-Clear Clipboard</Text>
          </View>
          <Text style={styles.cardDesc}>Clear copied passwords from clipboard memory automatically.</Text>

          <View style={styles.pillGrid}>
            {[
              { label: "15s", val: "15" },
              { label: "30s", val: "30" },
              { label: "60s", val: "60" },
              { label: "Never", val: "0" },
            ].map((item) => (
              <TouchableOpacity
                key={item.val}
                style={[
                  styles.pill,
                  clipboardTimeout === item.val && styles.pillActive,
                ]}
                onPress={() => handleSelectClipboard(item.val)}
              >
                <Text
                  style={[
                    styles.pillText,
                    clipboardTimeout === item.val && styles.pillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* WebCrypto Security Specs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={20} color={colors.success} />
            <Text style={styles.cardTitle}>Zero-Knowledge Crypto</Text>
          </View>
          <View style={styles.specRow}>
            <CheckCircle2 size={14} color={colors.success} />
            <Text style={styles.specText}>PBKDF2-SHA256 (100,000 iterations)</Text>
          </View>
          <View style={styles.specRow}>
            <CheckCircle2 size={14} color={colors.success} />
            <Text style={styles.specText}>AES-256-GCM End-to-End Encryption</Text>
          </View>
          <View style={styles.specRow}>
            <CheckCircle2 size={14} color={colors.success} />
            <Text style={styles.specText}>Hardware EncryptedSharedPreferences Cache</Text>
          </View>
        </View>
      </ScrollView>

      {/* PIN Setup / Change Modal */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPinModal(false)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowPinModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {pinStep === "enter" ? "Set Up Quick PIN" : "Confirm Your PIN"}
              </Text>
              <View style={{ width: 36 }} />
            </View>

            <Text style={styles.modalSubtitle}>
              {pinStep === "enter"
                ? "Enter a 4-digit numeric code for fast local re-unlock."
                : "Re-enter your 4-digit PIN to confirm."}
            </Text>

            <PinPad
              length={4}
              value={pinStep === "enter" ? enteredPin : confirmPin}
              onChange={handlePinPadChange}
              onComplete={handlePinPadComplete}
              errorMessage={pinModalError}
              shake={shakeModalPin}
            />

            {pinStep === "confirm" && (
              <TouchableOpacity
                style={styles.resetPinBtn}
                onPress={() => {
                  setPinStep("enter");
                  setEnteredPin("");
                  setConfirmPin("");
                  setPinModalError("");
                }}
              >
                <Text style={styles.resetPinBtnText}>Start over</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  modalContent: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  resetPinBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetPinBtnText: {
    color: colors.textMuted,
    fontSize: 12.5,
    textDecorationLine: "underline",
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  pill: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  pillTextActive: {
    color: colors.bg,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  specText: {
    fontSize: 13,
    color: colors.text,
  },
});
