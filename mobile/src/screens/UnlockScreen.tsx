import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import { Shield, KeyRound, Fingerprint, LogOut } from "lucide-react-native";

export function UnlockScreen() {
  const {
    isLoading,
    unlock,
    unlockWithBiometrics,
    accountUser,
    signOutAccount,
  } = useVaultStore();

  const [passwordInput, setPasswordInput] = useState("");

  const handleUnlockSubmit = async () => {
    if (!passwordInput) return;
    try {
      await unlock(passwordInput);
    } catch (err: any) {
      Alert.alert("Unlock Error", err?.message || "Failed to derive key with master password.");
    }
  };

  const handleBiometricUnlock = async () => {
    const success = await unlockWithBiometrics();
    if (!success) {
      Alert.alert("Biometrics Failed", "Could not unlock with fingerprint/face.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.unlockCard}>
        {/* Halo Glow */}
        <View style={styles.iconHeader}>
          <View style={styles.haloGlow} />
          <View style={styles.iconCircle}>
            <Shield size={36} color={colors.accent} />
          </View>
          <Text style={styles.title}>Vaultr</Text>
          <Text style={styles.userBadgeText}>
            Logged in as {accountUser?.email || "user@vaultr.local"}
          </Text>
        </View>

        {/* Master Password Input Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Master Password</Text>
            <View style={styles.inputWrapper}>
              <KeyRound size={18} color={colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="••••••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
                autoFocus
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleUnlockSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryButtonText}>Unlock Vault</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleBiometricUnlock}
          >
            <Fingerprint size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryButtonText}>Use Biometrics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAccountBtn}
            onPress={signOutAccount}
          >
            <LogOut size={14} color={colors.textDim} style={{ marginRight: 6 }} />
            <Text style={styles.switchAccountText}>Switch Server Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  unlockCard: {
    padding: 24,
    justifyContent: "center",
    flex: 1,
  },
  iconHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  haloGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    top: -10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  userBadgeText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.text,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 14,
  },
  switchAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  switchAccountText: {
    color: colors.textDim,
    fontSize: 12,
  },
});
