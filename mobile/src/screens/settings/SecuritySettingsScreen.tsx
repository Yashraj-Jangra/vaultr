import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import { isBiometricAvailable, isBiometricEnabled, enrollBiometricPassword, clearBiometricPassword } from "../../services/biometrics";
import { Fingerprint, Shield, Clock, Copy, ArrowLeft, CheckCircle2 } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_LOCK_KEY = "vaultr_auto_lock_timeout";
const CLIPBOARD_TIMEOUT_KEY = "vaultr_clipboard_clear_timeout";

export function SecuritySettingsScreen({ navigation }: any) {
  const { masterPassword } = useVaultStore();

  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
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

      const savedAutoLock = await AsyncStorage.getItem(AUTO_LOCK_KEY);
      if (savedAutoLock) setAutoLockTimeout(savedAutoLock);

      const savedClip = await AsyncStorage.getItem(CLIPBOARD_TIMEOUT_KEY);
      if (savedClip) setClipboardTimeout(savedClip);
    })();
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    if (val) {
      if (!masterPassword) {
        Alert.alert("Error", "Vault must be unlocked with master password first.");
        return;
      }
      const res = await enrollBiometricPassword(masterPassword);
      if (res.success) {
        setBiometricsEnabled(true);
        Alert.alert("Biometrics Enabled", "Fingerprint / Face ID unlock enrolled successfully!");
      } else {
        setBiometricsEnabled(false);
        if (res.error && res.error !== "cancel") {
          Alert.alert("Enrollment Cancelled", res.error);
        }
      }
    } else {
      await clearBiometricPassword();
      setBiometricsEnabled(false);
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
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: colors.surface3, true: colors.accent }}
              />
            )}
          </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
