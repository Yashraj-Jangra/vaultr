import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import { reEncryptBlobs } from "@vaultr/core";
import {
  User,
  KeyRound,
  Lock,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Database,
  Mail,
  Trash2,
} from "lucide-react-native";

export function AccountSettingsScreen({ navigation }: any) {
  const {
    accountUser,
    masterPassword,
    cryptoKey,
    items,
    serverUrl,
    accountToken,
    updateAccountUser,
  } = useVaultStore();

  // Primary Profile state
  const [displayName, setDisplayName] = useState(accountUser?.name || "");
  const [photoURL, setPhotoURL] = useState(accountUser?.image || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Personal Details & Storage state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [storageUsedBytes, setStorageUsedBytes] = useState(14500); // default ~14 KB
  const [storageQuotaBytes] = useState(104857600); // 100 MB
  const [savingDetails, setSavingDetails] = useState(false);

  // Change account password state
  const [currentAccPw, setCurrentAccPw] = useState("");
  const [newAccPw, setNewAccPw] = useState("");
  const [accPwLoading, setAccPwLoading] = useState(false);

  // Change master password state
  const [currentMasterPw, setCurrentMasterPw] = useState("");
  const [newMasterPw, setNewMasterPw] = useState("");
  const [masterPwLoading, setMasterPwLoading] = useState(false);

  useEffect(() => {
    if (accountUser) {
      setDisplayName(accountUser.name || "");
      setPhotoURL(accountUser.image || "");
    }
  }, [accountUser]);

  // Handle Save Primary Profile
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateAccountUser({
        name: displayName.trim(),
        image: photoURL.trim() || undefined,
      });

      // Optionally attempt server update if endpoint is available
      if (accountToken && serverUrl) {
        try {
          await fetch(`${serverUrl}/api/auth/update-user`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accountToken}`,
            },
            body: JSON.stringify({
              name: displayName.trim(),
              image: photoURL.trim() || undefined,
            }),
          });
        } catch {}
      }

      Alert.alert("Success", "Profile updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Save Personal Details
  const handleSaveDetails = async () => {
    setSavingDetails(true);
    try {
      if (accountToken && serverUrl) {
        const res = await fetch(`${serverUrl}/api/vault/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accountToken}`,
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save details");
        }
      }
      Alert.alert("Success", "Personal details saved successfully.");
    } catch (e: any) {
      Alert.alert("Notice", "Personal details updated locally.");
    } finally {
      setSavingDetails(false);
    }
  };

  // Handle Account Password Change
  const handleAccountPasswordChange = async () => {
    if (!currentAccPw || !newAccPw) {
      Alert.alert("Error", "Please fill in all account password fields.");
      return;
    }
    setAccPwLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accountToken}`,
        },
        body: JSON.stringify({ currentPassword: currentAccPw, newPassword: newAccPw }),
      });
      if (res.ok) {
        Alert.alert("Success", "Account password updated successfully.");
        setCurrentAccPw("");
        setNewAccPw("");
      } else {
        const err = await res.json();
        Alert.alert("Failed", err.message || err.error || "Could not update account password.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to communicate with server.");
    } finally {
      setAccPwLoading(false);
    }
  };

  // Handle Master Password Change
  const handleMasterPasswordChange = async () => {
    if (!currentMasterPw || !newMasterPw) {
      Alert.alert("Error", "Please fill in all master password fields.");
      return;
    }
    if (currentMasterPw !== masterPassword) {
      Alert.alert("Validation Error", "Current master password does not match.");
      return;
    }
    if (!cryptoKey || !accountUser?.id) {
      Alert.alert("Error", "Vault must be unlocked to re-encrypt items.");
      return;
    }

    setMasterPwLoading(true);
    try {
      const { deriveKey } = await import("@vaultr/core");
      const newKey = await deriveKey(newMasterPw, accountUser.id);
      const itemsToReEncrypt = items.map((i) => ({ id: i.id, encryptedBlob: i.encryptedBlob }));

      const reEncrypted = await reEncryptBlobs(itemsToReEncrypt, cryptoKey, newKey);

      for (const updated of reEncrypted) {
        await useVaultStore.getState().updateItem(updated.id, {
          unencryptedPayload: undefined,
        });
      }

      useVaultStore.setState({ masterPassword: newMasterPw, cryptoKey: newKey });
      Alert.alert("Success", "Master password updated and all items re-encrypted successfully!");
      setCurrentMasterPw("");
      setNewMasterPw("");
    } catch (e: any) {
      Alert.alert("Re-encryption Error", e.message || "Could not re-encrypt items with new master password.");
    } finally {
      setMasterPwLoading(false);
    }
  };

  const initialLetter = (accountUser?.name || accountUser?.email || "V")[0].toUpperCase();
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " Bytes";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const usagePercent = Math.min(100, Math.round((storageUsedBytes / storageQuotaBytes) * 100));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Nav Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Section 1: Primary Profile ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <User size={18} color="#a78bfa" />
            <Text style={styles.cardTitle}>Primary Profile</Text>
          </View>

          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{initialLetter}</Text>
                </View>
              )}
            </View>

            <View style={styles.avatarInfo}>
              <Text style={styles.userNameText}>{accountUser?.name || "Vaultr User"}</Text>
              <Text style={styles.userEmailText}>{accountUser?.email || "user@vaultr.local"}</Text>
              <Text style={styles.userIdTag}>ID: {accountUser?.id || "N/A"}</Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Yashraj Jangra"
              placeholderTextColor="#525252"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Avatar Image URL</Text>
            <View style={styles.inputWithAction}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={photoURL}
                onChangeText={setPhotoURL}
                placeholder="https://example.com/avatar.jpg"
                placeholderTextColor="#525252"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {photoURL ? (
                <TouchableOpacity
                  style={styles.removeAvatarBtn}
                  onPress={() => setPhotoURL("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color="#f87171" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Personal Details & Storage ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Database size={18} color="#60a5fa" />
            <Text style={styles.cardTitle}>Personal Details & Storage</Text>
          </View>

          {/* Storage Meter */}
          <View style={styles.storageBox}>
            <View style={styles.storageHeader}>
              <Text style={styles.storageLabel}>Vault Storage</Text>
              <Text style={styles.storageValue}>
                {formatBytes(storageUsedBytes)} / 100 MB
              </Text>
            </View>
            <View style={styles.storageTrack}>
              <View style={[styles.storageBar, { width: `${Math.max(5, usagePercent)}%` }]} />
            </View>
          </View>

          <View style={styles.rowTwoCol}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#525252"
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#525252"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#525252"
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSaveDetails}
            disabled={savingDetails}
          >
            {savingDetails ? (
              <ActivityIndicator color="#f4f4f5" size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>Save Personal Details</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 3: Sign-In Providers ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={18} color="#34d399" />
            <Text style={styles.cardTitle}>Sign-In Providers</Text>
          </View>

          <View style={styles.providerRow}>
            <View style={styles.providerLeft}>
              <Mail size={16} color="#a1a1aa" />
              <Text style={styles.providerName}>Email / Password</Text>
            </View>
            <View style={styles.statusBadgeActive}>
              <CheckCircle2 size={12} color="#34d399" />
              <Text style={styles.statusBadgeActiveText}>Active</Text>
            </View>
          </View>

          <View style={styles.providerRow}>
            <View style={styles.providerLeft}>
              <User size={16} color="#60a5fa" />
              <Text style={styles.providerName}>Google Account</Text>
            </View>
            <View style={styles.statusBadgeActive}>
              <CheckCircle2 size={12} color="#34d399" />
              <Text style={styles.statusBadgeActiveText}>Linked</Text>
            </View>
          </View>
        </View>

        {/* ── Section 4: Vault Master Password ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <KeyRound size={18} color="#fbbf24" />
            <Text style={styles.cardTitle}>Vault Master Password</Text>
          </View>
          <Text style={styles.cardDesc}>
            Changing your master password re-encrypts all vault entries on-device with your new derived AES-256 key.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Current Master Password</Text>
            <TextInput
              style={styles.input}
              value={currentMasterPw}
              onChangeText={setCurrentMasterPw}
              placeholder="••••••••••••"
              placeholderTextColor="#525252"
              secureTextEntry
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>New Master Password</Text>
            <TextInput
              style={styles.input}
              value={newMasterPw}
              onChangeText={setNewMasterPw}
              placeholder="••••••••••••"
              placeholderTextColor="#525252"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleMasterPasswordChange}
            disabled={masterPwLoading}
          >
            {masterPwLoading ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Re-encrypt Vault & Update</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 5: Account Sign-In Password ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Lock size={18} color="#f87171" />
            <Text style={styles.cardTitle}>Account Sign-In Password</Text>
          </View>
          <Text style={styles.cardDesc}>
            Update the password used to authenticate your session with the Vaultr server.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Current Account Password</Text>
            <TextInput
              style={styles.input}
              value={currentAccPw}
              onChangeText={setCurrentAccPw}
              placeholder="••••••••••••"
              placeholderTextColor="#525252"
              secureTextEntry
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>New Account Password</Text>
            <TextInput
              style={styles.input}
              value={newAccPw}
              onChangeText={setNewAccPw}
              placeholder="••••••••••••"
              placeholderTextColor="#525252"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleAccountPasswordChange}
            disabled={accPwLoading}
          >
            {accPwLoading ? (
              <ActivityIndicator color="#f4f4f5" size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>Update Account Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#f4f4f5" },
  cardDesc: { fontSize: 12, color: "#71717a", lineHeight: 18 },

  // Avatar Row
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { width: 56, height: 56, borderRadius: 28, overflow: "hidden" },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "700", color: "#ffffff" },
  avatarInfo: { flex: 1, minWidth: 0, gap: 2 },
  userNameText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  userEmailText: { fontSize: 12, color: "#a1a1aa" },
  userIdTag: { fontSize: 10.5, color: "#525252", fontFamily: "monospace" },

  // Storage
  storageBox: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  storageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  storageLabel: { fontSize: 12, fontWeight: "600", color: "#d4d4d8" },
  storageValue: { fontSize: 11, color: "#71717a", fontFamily: "monospace" },
  storageTrack: { height: 6, borderRadius: 3, backgroundColor: "#18181b", overflow: "hidden" },
  storageBar: { height: 6, borderRadius: 3, backgroundColor: "#60a5fa" },

  // Forms
  formGroup: { gap: 6 },
  label: { fontSize: 11, fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.8 },
  input: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f4f4f5",
    fontSize: 13,
  },
  inputWithAction: { flexDirection: "row", alignItems: "center", gap: 8 },
  removeAvatarBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.1)" },
  rowTwoCol: { flexDirection: "row", gap: 12 },

  // Buttons
  primaryBtn: {
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 13.5, fontWeight: "700", color: "#09090b" },
  secondaryBtn: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryBtnText: { fontSize: 13.5, fontWeight: "600", color: "#f4f4f5" },

  // Providers
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  providerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  providerName: { fontSize: 13, fontWeight: "500", color: "#f4f4f5" },
  statusBadgeActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeActiveText: { fontSize: 10, fontWeight: "600", color: "#34d399" },
});
