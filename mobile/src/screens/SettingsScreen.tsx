import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import {
  Shield,
  Globe,
  Fingerprint,
  LogOut,
  User,
  CheckCircle,
} from "lucide-react-native";

export function SettingsScreen() {
  const { serverUrl, lock, signOutAccount, accountUser } = useVaultStore();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navigation Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <User size={28} color={colors.accent} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {accountUser?.name || "Vaultr User"}
            </Text>
            <Text style={styles.profileEmail}>
              {accountUser?.email || "user@vaultr.local"}
            </Text>
          </View>
          <View style={styles.verifiedBadge}>
            <CheckCircle size={14} color={colors.success} />
          </View>
        </View>

        {/* Server Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SERVER CONFIGURATION</Text>
          <View style={styles.cardRow}>
            <Globe size={18} color={colors.textMuted} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Server Endpoint</Text>
              <Text style={styles.rowSubtext}>{serverUrl}</Text>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY & BIOMETRICS</Text>
          <View style={styles.cardRow}>
            <Fingerprint size={18} color={colors.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Biometric Unlock</Text>
              <Text style={styles.rowSubtext}>Fingerprint / Face ID Hardware Active</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <Shield size={18} color={colors.success} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>WebCrypto Encryption</Text>
              <Text style={styles.rowSubtext}>AES-256-GCM On-Device Key Derivation</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.lockBtn} onPress={lock}>
          <LogOut size={18} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.lockText}>Lock Vault Session</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOutAccount}>
          <Text style={styles.signOutText}>Sign Out Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 18,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  verifiedBadge: {
    padding: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textDim,
    letterSpacing: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  rowSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  lockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
  },
  lockText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  signOutBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  signOutText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
});
