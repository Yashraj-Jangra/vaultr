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
  ShieldAlert,
  Smartphone,
  Keyboard,
  Globe,
  Sparkles,
  Search,
  Lock,
  Layers,
  Info,
} from "lucide-react-native";

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
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Navigation Header */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={18} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Autofill & System Integration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Status Hero Card */}
        <View style={[styles.heroCard, status.isAutofillEnabled ? styles.heroCardActive : styles.heroCardInactive]}>
          <View style={styles.heroHeader}>
            <View
              style={[
                styles.statusBadgeIcon,
                {
                  backgroundColor: status.isAutofillEnabled ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  borderColor: status.isAutofillEnabled ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)",
                },
              ]}
            >
              {status.isAutofillEnabled ? (
                <CheckCircle2 size={22} color="#10b981" />
              ) : (
                <AlertCircle size={22} color="#fbbf24" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.heroTitle}>
                  {status.isAutofillEnabled ? "Autofill Framework Active" : "Autofill Not Enabled"}
                </Text>
                <View style={[styles.statusPill, status.isAutofillEnabled ? styles.statusPillActive : styles.statusPillInactive]}>
                  <Text style={[styles.statusPillText, status.isAutofillEnabled ? styles.statusPillTextActive : styles.statusPillTextInactive]}>
                    {status.isAutofillEnabled ? "RECOMMENDED" : "REQUIRED"}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroSubtitle}>
                {status.isAutofillEnabled
                  ? "Vaultr is configured as your native Android system autofill provider. Passwords, TOTP codes, and logins fill securely across all apps."
                  : "Set Vaultr as your default autofill service in Android Settings to enable keyboard suggestion chips and 1-tap form filling."}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryActionBtn, status.isAutofillEnabled && styles.secondaryActionBtn]}
            onPress={openAutofillSettings}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryActionText, status.isAutofillEnabled && styles.secondaryActionText]}>
              {status.isAutofillEnabled ? "Change System Provider" : "Enable Native Autofill"}
            </Text>
            <ExternalLink size={14} color={status.isAutofillEnabled ? "#a1a1aa" : "#09090b"} />
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
                Interactive suggestion chips appear directly above your keys in Samsung Keyboard, Gboard & SwiftKey.
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
              <Text style={styles.featureTitle}>Web Browsers & WebViews</Text>
              <Text style={styles.featureDesc}>
                Extracts domain contexts from Chrome, Brave, Edge, Firefox, and in-app WebViews for instant matching.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Quick Settings Tile */}
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(52, 211, 153, 0.12)" }]}>
              <Layers size={18} color="#34d399" />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Quick Settings Shade Tile</Text>
                <View style={styles.miniPill}>
                  <Text style={styles.miniPillText}>Notification Bar</Text>
                </View>
              </View>
              <Text style={styles.featureDesc}>
                Pull down notification shade and tap the "Vaultr" tile to autofill or copy 2FA codes on any active app.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Passkeys & Biometrics */}
          <View style={styles.featureRow}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(251, 191, 36, 0.12)" }]}>
              <Sparkles size={18} color="#fbbf24" />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Passkeys & Credential Manager</Text>
                <View style={styles.miniPill}>
                  <Text style={styles.miniPillText}>Android 14+</Text>
                </View>
              </View>
              <Text style={styles.featureDesc}>
                Hardware-backed Credential Manager support for passwordless FIDO2 WebAuthn passkeys.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Legacy Accessibility Fallback Section (With Clear Warning) ── */}
        <Text style={styles.sectionHeader}>LEGACY ACCESSIBILITY FALLBACK</Text>
        <View style={styles.card}>
          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <ShieldAlert size={16} color="#fbbf24" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningBannerTitle}>Keep Turned OFF on Modern Devices</Text>
              <Text style={styles.warningBannerText}>
                Accessibility services have broad screen-reading permissions that trigger security and anti-fraud alerts in banking apps (BHIM, YONO SBI, PhonePe, Google Pay).
              </Text>
              <Text style={[styles.warningBannerText, { marginTop: 6, color: "#d4d4d8" }]}>
                This service was built exclusively as a fallback for obsolete browsers (5+ years old). Modern Android devices only require <Text style={{ fontWeight: "700", color: "#34d399" }}>Native Autofill</Text> above.
              </Text>
            </View>
          </View>

          <View style={[styles.featureRow, { marginTop: 14 }]}>
            <View style={[styles.iconBox, { backgroundColor: "rgba(244, 114, 182, 0.12)" }]}>
              <Shield size={18} color="#f472b6" />
            </View>
            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <Text style={styles.featureTitle}>Accessibility Service</Text>
                <View
                  style={[
                    styles.miniPill,
                    {
                      backgroundColor: status.isAccessibilityEnabled
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(16, 185, 129, 0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniPillText,
                      {
                        color: status.isAccessibilityEnabled ? "#f87171" : "#10b981",
                      },
                    ]}
                  >
                    {status.isAccessibilityEnabled ? "Active (May alert banking apps)" : "Off (Recommended)"}
                  </Text>
                </View>
              </View>
              <Text style={styles.featureDesc}>
                {status.isAccessibilityEnabled
                  ? "Accessibility is currently ON. If your banking apps report security alerts, turn this service OFF."
                  : "Currently OFF. Your banking apps will run with zero security or overlay warnings."}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { marginTop: 14 }]}
            onPress={openAccessibilitySettings}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryActionText}>
              {status.isAccessibilityEnabled ? "Turn OFF Accessibility Service" : "Open Accessibility Settings"}
            </Text>
            <ExternalLink size={14} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Security & Index Counter */}
        <Text style={styles.sectionHeader}>HARDWARE ENCRYPTION & CACHE</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <KeyRound size={16} color="#38bdf8" />
              <Text style={{ color: "#f4f4f5", fontSize: 13.5, fontWeight: "600" }}>Indexed Vault Items</Text>
            </View>
            <View style={styles.accountCountBadge}>
              <Text style={styles.accountCountText}>
                {status.credentialCount} items
              </Text>
            </View>
          </View>
          <Text style={{ color: "#71717a", fontSize: 12, marginTop: 10, lineHeight: 17 }}>
            Credentials are encrypted with hardware-backed AES-256-GCM keys on your device. When you lock your vault session or sign out, this cache is purged immediately.
          </Text>
        </View>

        {/* Live Autofill Test Simulator */}
        <Text style={styles.sectionHeader}>TEST AUTOFILL MATCHER</Text>
        <View style={styles.card}>
          <Text style={{ color: "#71717a", fontSize: 12, marginBottom: 10 }}>
            Type a domain or package name to simulate what Vaultr Autofill will offer:
          </Text>
          <View style={styles.searchBox}>
            <Search size={15} color="#71717a" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. google.com, netflix.com, com.spotify.music"
              placeholderTextColor="#525252"
              value={testQuery}
              onChangeText={handleTestSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {testQuery.trim().length > 0 && (
            <View style={{ marginTop: 12 }}>
              {testResults.length === 0 ? (
                <Text style={{ color: "#71717a", fontSize: 12.5, fontStyle: "italic", paddingVertical: 4 }}>
                  No credentials matched for "{testQuery}".
                </Text>
              ) : (
                testResults.map((item, idx) => (
                  <View key={item.id || idx} style={styles.testResultRow}>
                    <View style={styles.testResultIcon}>
                      <Lock size={13} color="#34d399" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#f4f4f5", fontSize: 13, fontWeight: "600" }}>{item.name}</Text>
                      <Text style={{ color: "#71717a", fontSize: 11, marginTop: 1 }}>{item.username}</Text>
                    </View>
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>Live Match</Text>
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
    backgroundColor: "#09090b",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    backgroundColor: "#09090b",
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f4f4f5",
    letterSpacing: -0.2,
  },
  content: {
    padding: 16,
    gap: 8,
    paddingBottom: 40,
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#0d0d0d",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    padding: 16,
    marginBottom: 16,
  },
  heroCardActive: {
    borderColor: "rgba(16, 185, 129, 0.3)",
    backgroundColor: "#0d1410",
  },
  heroCardInactive: {
    borderColor: "rgba(245, 158, 11, 0.3)",
    backgroundColor: "#14120a",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statusBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillInactive: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusPillText: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusPillTextActive: {
    color: "#10b981",
  },
  statusPillTextInactive: {
    color: "#fbbf24",
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#a1a1aa",
    marginTop: 4,
    lineHeight: 17,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 10,
    paddingVertical: 11,
    gap: 6,
  },
  primaryActionText: {
    color: "#09090b",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b",
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 6,
  },
  secondaryActionText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },

  // Section Header
  sectionHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: "#525252",
    letterSpacing: 1.1,
    marginBottom: 6,
    marginLeft: 2,
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: "#0d0d0d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    padding: 14,
    marginBottom: 12,
  },

  // Warning banner
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  warningBannerTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#fbbf24",
  },
  warningBannerText: {
    fontSize: 11.5,
    color: "#a1a1aa",
    marginTop: 2,
    lineHeight: 16,
  },

  // Features
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    fontSize: 13.5,
    fontWeight: "600",
    color: "#f4f4f5",
  },
  miniPill: {
    backgroundColor: "#1c1c1e",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  miniPillText: {
    color: "#71717a",
    fontSize: 9.5,
    fontWeight: "700",
  },
  featureDesc: {
    fontSize: 11.5,
    color: "#71717a",
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#18181b",
    marginVertical: 12,
  },

  // Account count badge
  accountCountBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  accountCountText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },

  // Search box
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: "#f4f4f5",
    fontSize: 12.5,
  },
  testResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  testResultIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  matchBadge: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  matchBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
  },
});
