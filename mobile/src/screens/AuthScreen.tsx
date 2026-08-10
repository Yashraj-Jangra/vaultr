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
} from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import { Shield, Lock, Mail, Globe, ArrowRight } from "lucide-react-native";

export function AuthScreen() {
  const { signInAccount, isLoading, serverUrl } = useVaultStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [showConfig, setShowConfig] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required Fields", "Please enter your account email and password.");
      return;
    }
    try {
      await signInAccount(email.trim(), password, urlInput.trim());
    } catch (err: any) {
      Alert.alert("Sign In Failed", err?.message || "Could not authenticate with Vaultr server.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <Shield size={36} color={colors.accent} />
            </View>
            <Text style={styles.appName}>Vaultr</Text>
            <Text style={styles.appTagline}>
              Zero-Knowledge Password Manager & Safe
            </Text>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Sign In</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={colors.textDim} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Account Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={colors.textDim} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                />
              </View>
            </View>

            {showConfig && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Server Endpoint URL</Text>
                <View style={styles.inputWrapper}>
                  <Globe size={18} color={colors.textDim} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="http://192.168.1.15:3000"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.primaryBtnText}>Sign In to Account</Text>
                  <ArrowRight size={18} color={colors.bg} />
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
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 24,
    justifyContent: "center",
    minHeight: "100%",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBadge: {
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
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
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
  primaryBtn: {
    backgroundColor: colors.text,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 14,
  },
  configToggle: {
    alignItems: "center",
    marginTop: 8,
  },
  configToggleText: {
    color: colors.textDim,
    fontSize: 12,
  },
});
