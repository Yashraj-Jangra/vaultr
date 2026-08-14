import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../store/vaultStore";
import { vaultAlert } from "../store/alertStore";
import { colors } from "../theme/colors";
import { getAvatarUri } from "../utils/avatar";
import { openAutofillSettings } from "../services/autofill";
import {
  Shield,
  Fingerprint,
  LogOut,
  User,
  Monitor,
  Folder,
  Trash2,
  Database,
  ChevronRight,
  Lock,
  ShieldCheck,
  Smartphone,
} from "lucide-react-native";

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badgeText?: string;
  onPress?: () => void;
  last?: boolean;
}

function SettingsRow({ icon, title, subtitle, badgeText, onPress, last }: SettingsRowProps) {
  const Inner = (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowIconWrap}>{icon}</View>
      <View style={styles.rowContent}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {badgeText && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>{badgeText}</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {onPress && <ChevronRight size={15} color="#404040" />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return Inner;
}

export function SettingsScreen({ navigation }: any) {
  const { serverUrl, lock, signOutAccount, accountUser } = useVaultStore();
  const avatarLetter = (accountUser?.name || accountUser?.email || "V")[0].toUpperCase();

  const handleOpenAutofill = () => {
    if (Platform.OS === "android") {
      openAutofillSettings();
    } else {
      vaultAlert.alert(
        "iOS Autofill",
        "To enable Autofill on iOS, open iOS Settings > Passwords > Password Options and select Vaultr.",
        undefined,
        { illustration: "device-sync_d9ei" }
      );
    }
  };

  const handleComingSoon = (feature: string) => {
    vaultAlert.alert(
      "Coming Soon",
      `${feature} is currently under active development and will be available in the next release!`,
      undefined,
      { illustration: "completed-task_c11d" }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/vaultr-full-dark-transparent.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerDivider} />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Security / Encryption Pill */}
        <View style={styles.securityPill}>
          <View style={styles.greenDot} />
          <ShieldCheck size={11} color="#10b981" />
          <Text style={styles.securityPillText}>AES-256 Secured</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card — matches site's user dropdown layout */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate("AccountSettings")}
          activeOpacity={0.75}
        >
          <View style={styles.avatar}>
            {getAvatarUri(accountUser?.image || accountUser?.avatarUrl, serverUrl) ? (
              <Image source={{ uri: getAvatarUri(accountUser?.image || accountUser?.avatarUrl, serverUrl)! }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {accountUser?.name || "Vaultr User"}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {accountUser?.email || ""}
            </Text>
          </View>
          <ChevronRight size={16} color="#525252" />
        </TouchableOpacity>

        {/* ── Security & Access ────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SECURITY & ACCESS</Text>
          <View style={styles.sectionGroup}>
            <SettingsRow
              icon={<User size={15} color={colors.accent} />}
              title="Account Settings"
              subtitle="Passwords, display name, email"
              onPress={() => navigation.navigate("AccountSettings")}
            />
            <View style={styles.groupDivider} />
            <SettingsRow
              icon={<Fingerprint size={15} color={colors.success} />}
              title="Security & Biometrics"
              subtitle="Fingerprint unlock, auto-lock"
              onPress={() => navigation.navigate("SecuritySettings")}
            />
            <View style={styles.groupDivider} />
            <SettingsRow
              icon={<Smartphone size={15} color="#38bdf8" />}
              title="Autofill Credentials"
              subtitle="Auto-fill logins in browser & apps"
              onPress={handleOpenAutofill}
              last
            />
          </View>
        </View>

        {/* ── Sessions ─────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSIONS</Text>
          <View style={styles.sectionGroup}>
            <SettingsRow
              icon={<Monitor size={15} color={colors.cardBlue} />}
              title="Active Sessions"
              subtitle="Manage signed-in devices"
              onPress={() => navigation.navigate("Sessions")}
              last
            />
          </View>
        </View>

        {/* ── Vault Management ───────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VAULT MANAGEMENT</Text>
          <View style={styles.sectionGroup}>
            <SettingsRow
              icon={<Folder size={15} color={colors.warning} />}
              title="Folder Manager"
              subtitle="Organize vault into folders"
              onPress={() => navigation.navigate("FolderManager")}
            />
            <View style={styles.groupDivider} />
            <SettingsRow
              icon={<Database size={15} color={colors.cardIndigo} />}
              title="Import & Export"
              subtitle="Bitwarden, CSV, JSON backups"
              onPress={() => navigation.navigate("DataSettings")}
            />
            <View style={styles.groupDivider} />
            <SettingsRow
              icon={<Trash2 size={15} color={colors.danger} />}
              title="Trash & Recovery"
              subtitle="Restore or purge deleted items"
              onPress={() => navigation.navigate("Trash")}
              last
            />
          </View>
        </View>

        {/* ── Server info ──────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SERVER</Text>
          <View style={styles.sectionGroup}>
            <SettingsRow
              icon={<Shield size={15} color={colors.success} />}
              title="Vaultr Server"
              subtitle={serverUrl || "Not configured"}
              last
            />
          </View>
        </View>

        {/* ── Actions ──────────────────────────── */}
        <TouchableOpacity style={styles.lockBtn} onPress={lock} activeOpacity={0.8}>
          <Lock size={16} color={colors.danger} />
          <Text style={styles.lockBtnText}>Lock Vault Session</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOutAccount} activeOpacity={0.7}>
          <LogOut size={13} color="#525252" />
          <Text style={styles.signOutText}>Sign Out Account</Text>
        </TouchableOpacity>

        {/* Version watermark */}
        <View style={styles.versionWrap}>
          <Image
            source={require("../../assets/vaultr-lock-dark-transparent.png")}
            style={styles.versionLogo}
            resizeMode="contain"
          />
          <Text style={styles.versionText}>Vaultr Mobile</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    backgroundColor: "#09090b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogo: {
    width: 80,
    height: 22,
  },
  headerDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#27272a",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#a1a1aa",
    letterSpacing: -0.2,
  },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10b981",
  },
  securityPillText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#10b981",
    letterSpacing: 0.2,
  },

  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },

  // Profile card
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 14,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarLetter: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 14, fontWeight: "600", color: "#f4f4f5" },
  profileEmail: { fontSize: 12, color: "#737373", marginTop: 2 },

  // Section
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#525252",
    letterSpacing: 1.2,
    paddingHorizontal: 2,
  },
  sectionGroup: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    overflow: "hidden",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLast: {},
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "500", color: "#e4e4e7" },
  rowSubtitle: { fontSize: 11, color: "#71717a", marginTop: 1 },
  comingSoonBadge: {
    backgroundColor: "#27272a",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.4,
  },
  groupDivider: { height: 1, backgroundColor: "#1a1a1a", marginLeft: 58 },

  // Lock button
  lockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(185,28,28,0.35)",
    borderRadius: 12,
    paddingVertical: 13,
  },
  lockBtnText: { fontSize: 13.5, fontWeight: "600", color: "#f87171" },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  signOutText: { fontSize: 12, color: "#525252", fontWeight: "500" },

  // Version
  versionWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
  },
  versionLogo: { width: 16, height: 16, opacity: 0.3 },
  versionText: { fontSize: 10, color: "#404040" },
});
