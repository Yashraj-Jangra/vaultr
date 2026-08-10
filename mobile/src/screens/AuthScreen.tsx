import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../store/vaultStore";
import {
  Lock, Mail, Eye, EyeOff, ArrowRight,
  Globe, User, Plus, Shield, X, LogOut,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Illustration } from "../components/Illustration";

function GoogleIcon() {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

const { width } = Dimensions.get("window");
type Tab = "signin" | "signup";

// Password strength helpers
function strengthScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const S_LABEL = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
const S_COLOR = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

function StrengthMeter({ pw }: { pw: string }) {
  if (!pw) return null;
  const s = strengthScore(pw);
  return (
    <View style={{ gap: 4, paddingTop: 6, paddingBottom: 2 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 3,
              backgroundColor: i <= s ? S_COLOR[s] : "#1f1f1f",
            }}
          />
        ))}
      </View>
      {s > 0 && (
        <Text style={{ fontSize: 11, color: S_COLOR[s] }}>
          {S_LABEL[s]}
        </Text>
      )}
    </View>
  );
}

export function AuthScreen() {
  const { signInAccount, registerAccount, signInWithGoogle, isLoading, serverUrl, setServerUrl } = useVaultStore();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl || "");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    setErrorMsg("");
    setPassword("");
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    try {
      await signInWithGoogle(serverInput.trim() || serverUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || "Google sign-in failed.");
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please fill in your email address and password.");
      return;
    }
    setErrorMsg("");
    try {
      await signInAccount(email.trim(), password, serverInput.trim() || serverUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not authenticate with Vaultr server.");
    }
  };

  const handleSignUp = async () => {
    if (!firstName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (strengthScore(password) < 3) {
      setErrorMsg("Password is too weak. Use at least 8 characters with mixed case and numbers.");
      return;
    }
    setErrorMsg("");
    try {
      await registerAccount(firstName.trim(), username.trim() || firstName.trim(), email.trim(), password, serverInput.trim() || serverUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || "Registration failed. Please try again.");
    }
  };

  const isSignUp = tab === "signup";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

            {/* Brand logo */}
            <View style={styles.brandRow}>
              <Image
                source={require("../../assets/brand/logo-dark.png")}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.serverConfigBtn}
                onPress={() => setShowServerConfig(!showServerConfig)}
              >
                <Globe size={13} color="#404040" />
              </TouchableOpacity>
            </View>

            {/* Server config (collapsible) */}
            {showServerConfig && (
              <View style={styles.serverConfigBox}>
                <View style={styles.serverInputRow}>
                  <Globe size={13} color="#525252" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.serverInput}
                    value={serverInput}
                    onChangeText={setServerInput}
                    placeholder="https://your.vaultr.server"
                    placeholderTextColor="#404040"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TouchableOpacity onPress={() => setShowServerConfig(false)}>
                    <X size={13} color="#525252" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Tab switcher — matches web exactly */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === "signin" && styles.tabBtnActive]}
                onPress={() => switchTab("signin")}
                activeOpacity={0.8}
              >
                <LogOut size={13} color={tab === "signin" ? "#f4f4f5" : "#525252"} />
                <Text style={[styles.tabBtnText, tab === "signin" && styles.tabBtnTextActive]}>
                  Sign in
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === "signup" && styles.tabBtnActive]}
                onPress={() => switchTab("signup")}
                activeOpacity={0.8}
              >
                <Plus size={13} color={tab === "signup" ? "#f4f4f5" : "#525252"} />
                <Text style={[styles.tabBtnText, tab === "signup" && styles.tabBtnTextActive]}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hero illustration — exact match with web auth page */}
            <Illustration
              name={isSignUp ? "authentication_1evl" : "secure-login_m11a"}
              width={160}
              height={110}
              style={{ alignSelf: "center", marginVertical: 6 }}
            />

            {/* Heading */}
            <View style={styles.headingWrap}>
              <Text style={styles.heading}>
                {isSignUp ? "Create an account" : "Welcome back"}
              </Text>
              <Text style={styles.subheading}>
                {isSignUp
                  ? "Set up your zero-knowledge vault."
                  : "Sign in to access your encrypted vault."}
              </Text>
            </View>

            {/* Google Social Sign-In — matches web page */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <GoogleIcon />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Error banner — matches web's pill */}
            {errorMsg ? (
              <View style={styles.errorPill}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Name row (signup only) */}
            {isSignUp && (
              <View style={styles.nameRow}>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First name"
                    placeholderTextColor="#404040"
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                  <View style={styles.inputIcon}>
                    <User size={14} color="#525252" />
                  </View>
                </View>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username"
                    placeholderTextColor="#404040"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <View style={styles.inputIcon}>
                    <User size={14} color="#525252" />
                  </View>
                </View>
              </View>
            )}

            {/* Email */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor="#404040"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <View style={styles.inputIcon}>
                <Mail size={14} color="#525252" />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={isSignUp ? "Create a strong password" : "Password"}
                placeholderTextColor="#404040"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={isSignUp ? handleSignUp : handleSignIn}
              />
              <TouchableOpacity style={styles.inputIcon} onPress={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={14} color="#525252" /> : <Eye size={14} color="#525252" />}
              </TouchableOpacity>
            </View>

            {/* Strength meter (signup only) */}
            {isSignUp && password ? <StrengthMeter pw={password} /> : null}

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.spinner} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {isSignUp ? "Create account" : "Sign in"}
                  </Text>
                  <ArrowRight size={14} color="#09090b" />
                </>
              )}
            </TouchableOpacity>

            {/* Footer links */}
            <View style={styles.footerLinks}>
              {isSignUp ? (
                <Text style={styles.legalText}>
                  By signing up you agree to our Terms and Privacy Policy.
                </Text>
              ) : (
                <Text style={styles.footerLink}>Forgot password?</Text>
              )}
            </View>

            {/* AES badge — matches web's status bar aesthetic */}
            <View style={styles.securityBadge}>
              <Shield size={12} color="#404040" />
              <Text style={styles.securityBadgeText}>AES-256-GCM · Zero-knowledge</Text>
            </View>

          </Animated.View>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  card: {
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },

  // Brand
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  brandLogo: { height: 18, width: 90, opacity: 0.7 },
  serverConfigBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },

  // Server config
  serverConfigBox: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    padding: 10,
  },
  serverInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  serverInput: {
    flex: 1,
    color: "#a3a3a3",
    fontSize: 12,
    fontFamily: "monospace",
  },

  // Tab switcher — matches web's rounded-xl border p-0.5 bg-[#0d0d0d]
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    padding: 3,
    gap: 3,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: "#262626",
  },
  tabBtnText: { fontSize: 12, fontWeight: "500", color: "#525252" },
  tabBtnTextActive: { color: "#f4f4f5" },

  // Heading
  headingWrap: { gap: 4, marginBottom: 4 },
  heading: { fontSize: 18, fontWeight: "600", color: "#f4f4f5", letterSpacing: -0.5 },
  subheading: { fontSize: 12, color: "#525252" },

  // Error
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
  },
  errorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f87171", marginTop: 4 },
  errorText: { fontSize: 12, color: "#f87171", flex: 1, lineHeight: 18 },

  // Name row
  nameRow: { flexDirection: "row", gap: 8 },

  // Input — matches web's bg-[#0d0d0d] border rounded-xl
  inputWrap: {
    position: "relative",
  },
  input: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingRight: 42,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 13,
    color: "#e4e4e7",
  },
  inputIcon: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  // Primary button — matches web's bg-neutral-100 hover:bg-white text-neutral-900
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 13.5, fontWeight: "600", color: "#09090b" },

  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#525252",
    borderTopColor: "#09090b",
  },

  // Footer
  footerLinks: { alignItems: "center", paddingVertical: 4 },
  footerLink: { fontSize: 12, color: "#525252" },
  legalText: { fontSize: 11, color: "#404040", textAlign: "center", lineHeight: 16 },

  // Google button — matches web page
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    paddingVertical: 13,
  },
  googleBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#e4e4e7",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1f1f1f",
  },
  dividerText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#525252",
    letterSpacing: 1,
  },

  // Security badge — like the web footer
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  securityBadgeText: { fontSize: 10, color: "#404040", fontFamily: "monospace" },
});
