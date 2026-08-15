import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Platform,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import {
  getAutofillStatus,
  openAutofillSettings,
  openAccessibilitySettings,
  testAutofillMatch,
  AutofillStatus,
} from "../../services/autofill";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ExternalLink,
  Shield,
  Smartphone,
  Keyboard,
  Globe,
  Sparkles,
  Search,
  Lock,
} from "lucide-react-native";
import { Illustration } from "../../components/Illustration";

export function AutofillSettingsScreen({ navigation }: any) {
  const [status, setStatus] = useState<AutofillStatus>({
    isAutofillSupported: true,
    isAutofillEnabled: false,
    isAccessibilityEnabled: false,
    credentialCount: 0,
  });

  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<Array<{ id: string; name: string; domain?: string; username: string }>>([]);

  const refreshStatus = async () => {
    const s = await getAutofillStatus();
    setStatus(s);
  };

  useEffect(() => {
    refreshStatus();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshStatus();
    });
    return () => sub.remove();
  }, []);

  const handleTestSearch = async (query: string) => {
    setTestQuery(query);
    if (!query.trim()) {
      setTestResults([]);
      return;
    }
    const matches = await testAutofillMatch(query.trim());
    setTestResults(matches);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navigation Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Autofill & System Service</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Status Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View
              style={[
                styles.statusBadgeIcon,
                { backgroundColor: status.isAutofillEnabled ? "rgba(52, 211, 153, 0.12)" : "rgba(245, 158, 11, 0.12)" },
              ]}
            >
              {status.isAutofillEnabled ? (
                <CheckCircle2 size={24} color="#34d399" />
              ) : (
                <AlertCircle size={24} color="#fbbf24" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.heroTitle}>
                {status.isAutofillEnabled ? "Autofill Service Active" : "Autofill Not Enabled"}
              </Text>
              <Text style={styles.heroSubtitle}>
                {status.isAutofillEnabled
                  ? "Vaultr is set as your default Android autofill provider."
                  : "Enable Vaultr in Android Settings to autofill passwords in apps & browsers."}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryActionBtn, status.isAutofillEnabled && styles.secondaryActionBtn]}
            onPress={openAutofillSettings}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryActionText, status.isAutofillEnabled && styles.secondaryActionText]}>
              {status.isAutofillEnabled ? "Change System Provider" : "Enable Vaultr Autofill"}
            </Text>
            <ExternalLink size={16} color={status.isAutofillEnabled ? colors.text : "#09090b"} />
          </TouchableOpacity>
        </View>

        {/* Feature Overview Section */}
        <Text style={styles.sectionHeader}>SUPPORTED CAPABILITIES</Text>
        <View style={styles.card}>
          {/* Keyboard Suggestions */}
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(167, 139, 250, 0.12)" }]}>
              <Keyboard size={18} color="#a78bfa" />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Inline Keyboard Suggestions</Text>
                <View style={styles.miniPill}>
                  <Text style={styles.miniPillText}>Android 11+</Text>
                </View>
              </View>
              <Text style={styles.featureDesc}>
                Credentials appear directly in Gboard, SwiftKey & Samsung Keyboard suggestion strips.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Browser Integrations */}
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
              <Globe size={18} color="#38bdf8" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Chrome, Brave & Web Browsers</Text>
              <Text style={styles.featureDesc}>
                Extracts web domains from Chrome, Brave, Firefox, Edge, and Android WebViews.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Dropdown Popups */}
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(52, 211, 153, 0.12)" }]}>
              <Smartphone size={18} color="#34d399" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Popup Dropdown Overlays</Text>
              <Text style={styles.featureDesc}>
                Dark-themed Vaultr dropdowns anchored directly below active password inputs.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Passkeys */}
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(251, 191, 36, 0.12)" }]}>
              <Sparkles size={18} color="#fbbf24" />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Passkey Manager Integration</Text>
                <View style={styles.miniPill}>
                  <Text style={styles.miniPillText}>Android 14+</Text>
                </View>
              </View>
              <Text style={styles.featureDesc}>
                Hardware-backed Credential Manager support for FIDO2 WebAuthn passkeys.
              </Text>
            </View>
          </View>
        </View>

        {/* Accessibility Fallback Section */}
        <Text style={styles.sectionHeader}>ACCESSIBILITY FALLBACK</Text>
        <View style={styles.card}>
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(244, 114, 182, 0.12)" }]}>
              <Shield size={18} color="#f472b6" />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Accessibility Service</Text>
                <View
                  style={[
                    styles.miniPill,
                    { backgroundColor: status.isAccessibilityEnabled ? "rgba(52, 211, 153, 0.15)" : "rgba(113, 113, 122, 0.15)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniPillText,
                      { color: status.isAccessibilityEnabled ? "#34d399" : colors.textMuted },
                    ]}
                  >
                    {status.isAccessibilityEnabled ? "Active" : "Optional"}
                  </Text>
                </View>
              </View>
              <Text style={styles.featureDesc}>
                Fills login fields in apps and hybrid WebViews that block standard Android autofill.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { marginTop: 12 }]}
            onPress={openAccessibilitySettings}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryActionText}>
              {status.isAccessibilityEnabled ? "Manage Accessibility Service" : "Enable Accessibility Fallback"}
            </Text>
            <ExternalLink size={15} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Security & Index Counter */}
        <Text style={styles.sectionHeader}>HARDWARE ENCRYPTION & STATUS</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <KeyRound size={18} color={colors.accent} style={{ marginRight: 10 }} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Indexed Credentials</Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "bold" }}>
              {status.credentialCount} accounts
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
            Credentials are encrypted with hardware AES-256-GCM keys on your device. When you lock your vault or sign out, this cache is wiped immediately.
          </Text>
        </View>

        {/* Live Autofill Test Simulator */}
        <Text style={styles.sectionHeader}>TEST AUTOFILL MATCHER</Text>
        <View style={styles.card}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10 }}>
            Type a domain or package name to test what Vaultr Autofill will offer:
          </Text>
          <View style={styles.searchBox}>
            <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. google.com, twitter.com, com.spotify.music"
              placeholderTextColor={colors.textMuted}
              value={testQuery}
              onChangeText={handleTestSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {testQuery.trim().length > 0 && (
            <View style={{ marginTop: 12 }}>
              {testResults.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13, fontStyle: "italic" }}>
                  No credentials matched for "{testQuery}".
                </Text>
              ) : (
                testResults.map((item, idx) => (
                  <View key={item.id || idx} style={styles.testResultRow}>
                    <View style={styles.testResultIcon}>
                      <Lock size={14} color="#34d399" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{item.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.username}</Text>
                    </View>
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>Match</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
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
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statusBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  primaryActionText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  miniPill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniPillText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  featureDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  testResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  testResultIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  matchBadge: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  matchBadgeText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
});
