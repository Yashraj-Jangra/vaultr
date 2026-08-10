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
  Image,
} from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import { Lock, Fingerprint, LogOut, Shield } from "lucide-react-native";

export function UnlockScreen() {
  const {
    isLoading,
    unlock,
    unlockWithBiometrics,
    accountUser,
    signOutAccount,
  } = useVaultStore();

  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUnlockSubmit = async () => {
    if (!passwordInput || isLoading) return;
    setErrorMsg("");
    try {
      await unlock(passwordInput);
    } catch (err: any) {
      setErrorMsg(err?.message || "Incorrect master password");
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
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Grid Dot Pattern Background Accent */}
      <View style={styles.contentWrap}>
        {/* Halo Radial Glow & Lock Box */}
        <View style={styles.lockHaloWrap}>
          <View style={styles.haloGlow} />
          <View style={[styles.lockBox, isLoading && styles.lockBoxUnlocking]}>
            <Image
              source={require("../../assets/brand/lock-brand-dark.png")}
              style={styles.lockBrandImg}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Header Branding Info */}
        <View style={styles.headerInfo}>
          <Image
            source={require("../../assets/brand/logo-dark.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            {isLoading ? "Decrypting vault…" : "Unlock your vault"}
          </Text>
          {accountUser?.email && (
            <Text style={styles.emailText} numberOfLines={1}>
              {accountUser.email}
            </Text>
          )}
        </View>

        {/* Form Inputs */}
        <View style={styles.formWrap}>
          {errorMsg ? (
            <View style={styles.errorAlert}>
              <View style={styles.errorDot} />
              <Text style={styles.errorAlertText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.formInput}
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="Master password"
              placeholderTextColor="#52525b"
              secureTextEntry
              autoFocus
              editable={!isLoading}
            />
            <Lock size={16} color="#71717a" style={styles.inputLockIcon} />
          </View>

          {/* Primary Unlock Button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!passwordInput || isLoading) && styles.primaryBtnDisabled,
            ]}
            onPress={handleUnlockSubmit}
            disabled={!passwordInput || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#09090b" />
            ) : (
              <View style={styles.btnRow}>
                <Lock size={14} color="#09090b" />
                <Text style={styles.primaryBtnText}>Unlock vault</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Biometrics Action */}
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometricUnlock}
            activeOpacity={0.7}
          >
            <Fingerprint size={16} color="#a78bfa" style={{ marginRight: 8 }} />
            <Text style={styles.biometricBtnText}>Unlock with Biometrics</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Links */}
        <View style={styles.footerRow}>
          <TouchableOpacity onPress={signOutAccount}>
            <Text style={styles.footerLinkText}>Switch account</Text>
          </TouchableOpacity>
          <View style={styles.footerLinkRight}>
            <Shield size={13} color="#52525b" style={{ marginRight: 4 }} />
            <Text style={styles.footerLinkText}>Zero-Knowledge</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  contentWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  lockHaloWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  haloGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(124, 106, 250, 0.15)",
  },
  lockBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  lockBoxUnlocking: {
    backgroundColor: "#18181b",
    borderColor: "#52525b",
  },
  lockBrandImg: {
    width: 48,
    height: 48,
  },
  headerInfo: {
    alignItems: "center",
    marginBottom: 24,
  },
  brandLogo: {
    height: 20,
    width: 110,
    marginBottom: 12,
    opacity: 0.7,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f4f4f5",
    letterSpacing: -0.4,
  },
  emailText: {
    fontSize: 12,
    color: "#71717a",
    fontFamily: "monospace",
    marginTop: 4,
  },
  formWrap: {
    width: "100%",
    gap: 14,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(185, 28, 28, 0.4)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ef4444",
  },
  errorAlertText: {
    color: "#f87171",
    fontSize: 12,
    flex: 1,
  },
  inputContainer: {
    position: "relative",
    width: "100%",
    justifyContent: "center",
  },
  formInput: {
    width: "100%",
    height: 46,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 44,
    color: "#e4e4e7",
    fontSize: 14,
  },
  inputLockIcon: {
    position: "absolute",
    right: 14,
  },
  primaryBtn: {
    width: "100%",
    height: 46,
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#09090b",
    fontSize: 13,
    fontWeight: "600",
  },
  biometricBtn: {
    width: "100%",
    height: 42,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  biometricBtnText: {
    color: "#a78bfa",
    fontSize: 13,
    fontWeight: "600",
  },
  footerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
  },
  footerLinkText: {
    fontSize: 12,
    color: "#71717a",
  },
  footerLinkRight: {
    flexDirection: "row",
    alignItems: "center",
  },
});
