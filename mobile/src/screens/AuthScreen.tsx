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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import { Lock, Mail, Globe, ArrowRight, Shield } from "lucide-react-native";

export function AuthScreen() {
  const { signInAccount, isLoading, serverUrl } = useVaultStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [showConfig, setShowConfig] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please fill in your email address and password.");
      return;
    }
    setErrorMsg("");
    try {
      await signInAccount(email.trim(), password, urlInput.trim());
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not authenticate with Vaultr server.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <Image
              source={require("../../assets/brand/logo-dark.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.appTagline}>
              Unlock your encrypted vault with AES-256-GCM.
            </Text>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Sign In</Text>

            {errorMsg ? (
              <View style={styles.errorAlert}>
                <View style={styles.errorDot} />
                <Text style={styles.errorAlertText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={16} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#52525b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={16} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="#52525b"
                  secureTextEntry
                />
              </View>
            </View>

            {showConfig && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Server Endpoint URL</Text>
                <View style={styles.inputWrapper}>
                  <Globe size={16} color="#71717a" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="http://192.168.1.15:3000"
                    placeholderTextColor="#52525b"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!email || !password || isLoading) && styles.primaryBtnDisabled,
              ]}
              onPress={handleSignIn}
              disabled={!email || !password || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#09090b" size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.primaryBtnText}>Sign in to Vaultr</Text>
                  <ArrowRight size={16} color="#09090b" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.configToggle}
              onPress={() => setShowConfig(!showConfig)}
            >
              <Text style={styles.configToggleText}>
                {showConfig ? "Hide Server URL" : "Configure Server URL Endpoint"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  scrollContent: {
    padding: 24,
    justifyContent: "center",
    minHeight: "100%",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandLogo: {
    width: 140,
    height: 32,
    marginBottom: 10,
    opacity: 0.8,
  },
  appTagline: {
    fontSize: 13,
    color: "#71717a",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f4f4f5",
    letterSpacing: -0.3,
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
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 44,
    color: "#e4e4e7",
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: "#f4f4f5",
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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
    fontWeight: "600",
    fontSize: 13,
  },
  configToggle: {
    alignItems: "center",
    marginTop: 4,
  },
  configToggleText: {
    color: "#71717a",
    fontSize: 12,
  },
});
