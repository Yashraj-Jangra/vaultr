import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, Shield, Eye, EyeOff, LogOut, Fingerprint } from "lucide-react-native";
import Svg, { Pattern, Rect, Line } from "react-native-svg";
import { useVaultStore } from "../store/vaultStore";
import { Illustration } from "../components/Illustration";
import { isBiometricEnabled, unlockWithBiometrics } from "../services/biometrics";

function GridBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Pattern id="unlock-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <Line x1="0" y1="0" x2="40" y2="0" stroke="#ffffff" strokeWidth="1" opacity="0.05" />
          <Line x1="0" y1="0" x2="0" y2="40" stroke="#ffffff" strokeWidth="1" opacity="0.05" />
        </Pattern>
        <Rect width="100%" height="100%" fill="url(#unlock-grid)" />
      </Svg>
    </View>
  );
}

const { width } = Dimensions.get("window");

type UnlockView = "main" | "forgot" | "why";

export function UnlockScreen() {
  const { accountUser, unlock, lock, signOutAccount } = useVaultStore();
  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [currentView, setCurrentView] = useState<UnlockView>("main");

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  // Animations
  const haloAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  const handleBiometricUnlock = async () => {
    if (unlocking) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const savedPw = await unlockWithBiometrics();
      if (savedPw) {
        setMasterPassword(savedPw);
        await unlock(savedPw);
      }
    } catch (err: any) {
      // Biometrics failed or cancelled
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    // Fade in on mount
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    // Check if biometric unlock is enabled in settings
    (async () => {
      const enabled = await isBiometricEnabled();
      if (enabled) {
        setBiometricsAvailable(true);
        // Auto trigger biometric prompt after view mounts
        setTimeout(() => {
          handleBiometricUnlock();
        }, 300);
      }
    })();

    // Pulsing halo animation
    const pulsing = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    pulsing.start();
    return () => pulsing.stop();
  }, []);

  const doShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -3, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleUnlock = async () => {
    if (!masterPassword || unlocking) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      await unlock(masterPassword);
    } catch (err: any) {
      const msg = err?.message || "Incorrect password";
      setUnlockError(msg.includes("decrypt") ? "Incorrect master password." : msg);
      doShake();
    } finally {
      setUnlocking(false);
    }
  };

  const haloOpacity = haloAnim.interpolate ? haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.18],
  }) : 0.12;

  // ── Main unlock view ──────────────────────────────────────────────────────────
  const renderMain = () => (
    <Animated.View style={{ opacity: fadeInAnim }}>
      {/* Halo + lock icon */}
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.halo, { opacity: haloOpacity }]} />
        <Animated.View style={[styles.haloInner, { opacity: haloAnim }]} />
        <View style={[styles.lockBox, unlocking && styles.lockBoxUnlocking]}>
          <Image
            source={require("../../assets/brand/lock-brand-dark.png")}
            style={[styles.lockBrand, { opacity: unlocking ? 1.0 : 0.6 }]}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Brand + headings */}
      <View style={styles.headingWrap}>
        <Image
          source={require("../../assets/brand/logo-dark.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.title}>
          {unlocking ? "Decrypting vault…" : "Unlock your vault"}
        </Text>
        <Text style={styles.emailHint} numberOfLines={1}>
          {accountUser?.email || ""}
        </Text>
      </View>

      {/* Error alert — matches web's pill style */}
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        {unlockError ? (
          <View style={styles.errorPill}>
            <View style={styles.errorDot} />
            <Text style={styles.errorText}>{unlockError}</Text>
          </View>
        ) : null}

        {/* Password input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={masterPassword}
            onChangeText={setMasterPassword}
            placeholder="Master password"
            placeholderTextColor="#404040"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!unlocking}
            returnKeyType="done"
            onSubmitEditing={handleUnlock}
          />
          <TouchableOpacity
            style={styles.inputIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            {showPassword
              ? <EyeOff size={15} color="#525252" />
              : <Eye size={15} color="#525252" />}
          </TouchableOpacity>
        </View>

        {/* Unlock button */}
        <TouchableOpacity
          style={[styles.unlockBtn, (!masterPassword || unlocking) && styles.unlockBtnDisabled]}
          onPress={handleUnlock}
          disabled={!masterPassword || unlocking}
          activeOpacity={0.85}
        >
          {unlocking ? (
            // Spinner
            <View style={styles.spinner} />
          ) : (
            <>
              <Lock size={14} color="#09090b" />
              <Text style={styles.unlockBtnText}>Unlock vault</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Biometrics button (if enabled in settings) */}
        {biometricsAvailable ? (
          <TouchableOpacity
            style={styles.biometricBtn}
            onPress={handleBiometricUnlock}
            disabled={unlocking}
            activeOpacity={0.85}
          >
            <Fingerprint size={16} color="#a78bfa" />
            <Text style={styles.biometricBtnText}>Unlock with Biometrics</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* Footer links */}
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={() => setCurrentView("forgot")}>
          <Text style={styles.footerLink}>Forgot password?</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerWhyBtn}
          onPress={() => setCurrentView("why")}
        >
          <Shield size={13} color="#525252" />
          <Text style={styles.footerLink}>Why is this needed?</Text>
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <View style={styles.signOutWrap}>
        <TouchableOpacity onPress={signOutAccount}>
          <Text style={styles.signOutText}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ── Forgot password view (mirrors web exactly) ────────────────────────────────
  const renderForgot = () => (
    <View>
      <View style={styles.centeredIconWrap}>
        <Illustration name="forgot-password_nttj" width={240} height={180} style={{ marginBottom: 16 }} />
        <Text style={styles.subViewTitle}>Unrecoverable Password</Text>
      </View>

      <View style={styles.subViewContent}>
        <Text style={styles.subViewBody}>
          SecureVault uses strict{" "}
          <Text style={{ color: "#e4e4e7", fontWeight: "600" }}>
            Zero-Knowledge Encryption
          </Text>
          . Your master password is never sent to our servers. It is strictly used
          locally to derive your AES-256-GCM decryption keys.
        </Text>

        <View style={styles.alertBox}>
          <Shield size={14} color="#f87171" style={{ marginTop: 1 }} />
          <Text style={styles.alertBoxText}>
            If you forget your master password,{" "}
            <Text style={{ fontWeight: "700" }}>
              your data cannot be recovered by anyone, including us.
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.subViewActions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => setCurrentView("main")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Try another password</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={signOutAccount}
          activeOpacity={0.75}
        >
          <Text style={styles.ghostBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Why is this needed? view ──────────────────────────────────────────────────
  const renderWhy = () => (
    <View>
      <View style={styles.centeredIconWrap}>
        <Illustration name="mobile-encryption_flk2" width={240} height={180} style={{ marginBottom: 16 }} />
        <Text style={styles.subViewTitle}>Local Decryption</Text>
      </View>

      <View style={styles.subViewContent}>
        <Text style={styles.subViewBody}>
          When you log in, we only authenticate your identity, which pulls down the
          encrypted blobs from the server.
        </Text>
        <Text style={styles.subViewBody}>
          Your{" "}
          <Text style={{ color: "#e4e4e7", fontWeight: "600" }}>Master Password</Text>{" "}
          is mathematically hashed (PBKDF2) locally to derive a cryptographic key.
        </Text>

        <View style={styles.monoChip}>
          <Text style={styles.monoChipText}>AES-256-GCM</Text>
        </View>

        <Text style={styles.subViewBody}>
          This key then decrypts your vault data locally. Without it, your data
          remains secure cipher text.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => setCurrentView("main")}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>← Back to unlock</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Decorative extension/web grid pattern background */}
      <GridBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={styles.card}>
            {currentView === "main" && renderMain()}
            {currentView === "forgot" && renderForgot()}
            {currentView === "why" && renderWhy()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  // Minimal, card-free container (completely invisible wrapper)
  card: {
    width: "100%",
    maxWidth: 340,
  },

  // Lock icon halo — larger hero visual matching website/extension
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    position: "relative",
    height: 140,
  },
  halo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  haloInner: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  lockBox: {
    width: 96,
    height: 96,
    borderRadius: 26,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  lockBoxUnlocking: {
    backgroundColor: "#1f1f1f",
    borderColor: "#333",
  },
  lockBrand: {
    width: 60,
    height: 60,
  },

  // Heading block
  headingWrap: {
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  logoImage: {
    height: 18,
    width: 90,
    opacity: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f4f4f5",
    letterSpacing: -0.5,
  },
  emailHint: {
    fontSize: 12,
    color: "#525252",
    fontFamily: "monospace",
  },

  // Error pill — matches web's red border/bg pill
  errorPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.25)",
    borderWidth: 1,
    borderColor: "rgba(153,27,27,0.4)",
    marginBottom: 12,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f87171",
    marginTop: 4,
  },
  errorText: { fontSize: 12, color: "#f87171", flex: 1, lineHeight: 18 },

  // Input
  inputWrap: {
    position: "relative",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 44,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 14,
    color: "#e4e4e7",
  },
  inputIcon: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  // Unlock button — matches web's bg-neutral-100 primary button
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: "rgba(255,255,255,0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  unlockBtnDisabled: { opacity: 0.4 },
  unlockBtnText: { fontSize: 13.5, fontWeight: "600", color: "#09090b" },

  // Spinner
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#525252",
    borderTopColor: "#09090b",
  },

  // Footer links
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  footerWhyBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerLink: { fontSize: 12, color: "#525252" },

  signOutWrap: { alignItems: "center", marginTop: 24 },
  signOutText: { fontSize: 11, color: "#404040" },

  // Sub-views (forgot / why) — centred icon
  centeredIconWrap: {
    alignItems: "center",
    marginBottom: 24,
    gap: 14,
  },
  forgotIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(127,29,29,0.2)",
    borderWidth: 1,
    borderColor: "rgba(153,27,27,0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(220,38,38,0.1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  whyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(67,56,202,0.15)",
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(99,102,241,0.1)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  subViewTitle: { fontSize: 18, fontWeight: "600", color: "#f4f4f5", letterSpacing: -0.4 },

  subViewContent: { gap: 14, marginBottom: 28 },
  subViewBody: {
    fontSize: 13,
    color: "#a3a3a3",
    lineHeight: 20,
    textAlign: "center",
  },

  alertBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(153,27,27,0.4)",
    backgroundColor: "rgba(127,29,29,0.1)",
  },
  alertBoxText: { fontSize: 12, color: "rgba(254,202,202,0.8)", lineHeight: 18, flex: 1 },

  monoChip: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    backgroundColor: "#0d0d0d",
  },
  monoChipText: { fontSize: 11, color: "#525252", fontFamily: "monospace" },

  subViewActions: { gap: 10, marginBottom: 0 },

  primaryBtn: {
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 13.5, fontWeight: "600", color: "#09090b" },

  ghostBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  ghostBtnText: { fontSize: 13.5, color: "#a3a3a3" },

  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
  },
  biometricBtnText: { fontSize: 13.5, fontWeight: "600", color: "#a78bfa" },
});
