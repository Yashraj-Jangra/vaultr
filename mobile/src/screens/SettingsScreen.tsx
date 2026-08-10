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
  Fingerprint,
  LogOut,
  User,
  CheckCircle,
  Monitor,
  Folder,
  Trash2,
  Database,
  ChevronRight,
} from "lucide-react-native";

export function SettingsScreen({ navigation }: any) {
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
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate("AccountSettings")}
        >
          <View style={styles.avatarCircle}>
            <User size={26} color={colors.accent} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {accountUser?.name || "Vaultr User"}
            </Text>
            <Text style={styles.profileEmail}>
              {accountUser?.email || "user@vaultr.local"}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textDim} />
        </TouchableOpacity>

        {/* Navigation Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES & SECURITY</Text>

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => navigation.navigate("AccountSettings")}
          >
            <User size={18} color={colors.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Account Settings</Text>
              <Text style={styles.rowSubtext}>Update passwords, master key, user profile</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => navigation.navigate("SecuritySettings")}
          >
            <Fingerprint size={18} color={colors.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Security & Biometrics</Text>
              <Text style={styles.rowSubtext}>Fingerprint unlock, auto-lock timeout</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => navigation.navigate("Sessions")}
          >
            <Monitor size={18} color={colors.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Active Sessions</Text>
              <Text style={styles.rowSubtext}>Manage signed in devices and sessions</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Data & Vault Organization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA & VAULT MANAGEMENT</Text>

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => navigation.navigate("DataSettings")}
          >
            <Database size={18} color={colors.cardBlue} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Import & Export</Text>
              <Text style={styles.rowSubtext}>Backups, Bitwarden/CSV migration</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => navigation.navigate("FolderManager")}
          >
            <Folder size={18} color={colors.warning} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Folder Manager</Text>
              <Text style={styles.rowSubtext}>Organize items into custom folders</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => navigation.navigate("Trash")}
          >
            <Trash2 size={18} color={colors.danger} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Trash & Recovery</Text>
              <Text style={styles.rowSubtext}>View or restore deleted vault entries</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Server Endpoint */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SERVER ENDPOINT</Text>
          <View style={styles.cardRow}>
            <Shield size={18} color={colors.success} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Vaultr Server</Text>
              <Text style={styles.rowSubtext}>{serverUrl}</Text>
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
