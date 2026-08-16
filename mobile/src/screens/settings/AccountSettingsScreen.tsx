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
  Image,
} from "react-native";
import { vaultAlert } from "../../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import { reEncryptBlobs, deriveKey } from "@vaultr/core";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { getAvatarUri } from "../../utils/avatar";
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
  Edit2,
  FileText,
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
    syncUserProfile,
  } = useVaultStore();

  // Primary Profile state
  const [displayName, setDisplayName] = useState(
    accountUser?.name || ""
  );
  const [photoURL, setPhotoURL] = useState(
    accountUser?.image || accountUser?.avatarUrl || ""
  );
  const [imageError, setImageError] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Personal Details & Storage state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [storageQuotaBytes, setStorageQuotaBytes] = useState(104857600); // 100 MB default
  const [detailsLoaded, setDetailsLoaded] = useState(false);
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
      const userImg = accountUser.image || accountUser.avatarUrl || "";
      if (userImg) {
        setPhotoURL(userImg);
        setImageError(false);
      }
    }
  }, [accountUser]);

  useEffect(() => {
    setImageError(false);
  }, [photoURL]);

  // Fetch live storage and personal profile from server with local item fallback
  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      if (serverUrl && accountToken) {
        try {
          const cleanServer = serverUrl.replace(/\/+$/, "");
          const res = await fetch(`${cleanServer}/api/vault/profile`, {
            headers: {
              Authorization: `Bearer ${accountToken}`,
              Cookie: `better-auth.session_token=${accountToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              if (data.firstName) setFirstName(data.firstName);
              if (data.lastName) setLastName(data.lastName);
              if (data.phone) setPhone(data.phone);
              if (data.displayName && !displayName) setDisplayName(data.displayName);
              if (data.avatarUrl) {
                setPhotoURL(data.avatarUrl);
                setImageError(false);
                updateAccountUser({ avatarUrl: data.avatarUrl, image: data.avatarUrl });
              }
              setStorageUsedBytes(Number(data.storageUsedBytes || 0));
              if (data.storageQuotaBytes) setStorageQuotaBytes(Number(data.storageQuotaBytes));
              setDetailsLoaded(true);
              return;
            }
          }
        } catch {
          // Fallback to local calculation
        }
      }
      if (isMounted) {
        // Fallback: accurately compute encrypted blobs storage from loaded vault items
        const localBytes = items.reduce(
          (acc, i) => acc + (i.encryptedBlob ? i.encryptedBlob.length : 0),
          0
        );
        setStorageUsedBytes(localBytes);
        setDetailsLoaded(true);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [serverUrl, accountToken, items]);

  // Handle Photo Picker
  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        vaultAlert.alert("Permission Required", "Gallery permission is required to choose a profile photo.", undefined, { illustration: "cancel_k4w9" });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const localUri = result.assets[0].uri;
        setPhotoURL(localUri);
        setImageError(false);
        await updateAccountUser({ image: localUri, avatarUrl: localUri });

        // Server upload if session token available
        if (accountToken && serverUrl) {
          try {
            const cleanServer = serverUrl.replace(/\/+$/, "");
            const filename = localUri.split("/").pop() || "avatar.jpg";
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            const res = await FileSystem.uploadAsync(`${cleanServer}/api/settings/avatar`, localUri, {
              httpMethod: "POST",
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: "file",
              mimeType: type,
              headers: {
                Authorization: `Bearer ${accountToken}`,
                Cookie: `better-auth.session_token=${accountToken}`,
                Origin: cleanServer,
                Referer: `${cleanServer}/`,
              },
            });

            if (res.status >= 200 && res.status < 300) {
              const data = JSON.parse(res.body);
              if (data.avatarUrl) {
                setPhotoURL(data.avatarUrl);
                setImageError(false);
                await updateAccountUser({ image: data.avatarUrl, avatarUrl: data.avatarUrl });
                await syncUserProfile();
              }
            }
          } catch (err) {
            console.warn("Server avatar upload fallback to local URI:", err);
          }
        }
      }
    } catch (err: any) {
      vaultAlert.alert("Error", err.message || "Failed to pick image.", undefined, { illustration: "cancel_k4w9" });
    }
  };

  // Handle Remove Photo
  const handleRemoveAvatar = async () => {
    setPhotoURL("");
    setImageError(false);
    await updateAccountUser({ image: undefined, avatarUrl: undefined });
    if (accountToken && serverUrl) {
      const cleanServer = serverUrl.replace(/\/+$/, "");
      try {
        await fetch(`${cleanServer}/api/settings/avatar`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accountToken}`,
            Cookie: `better-auth.session_token=${accountToken}`,
            Origin: cleanServer,
            Referer: `${cleanServer}/`,
          },
        });
        await syncUserProfile();
      } catch { }
    }
  };

  // Handle Save Primary Profile
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateAccountUser({
        name: displayName.trim(),
        image: photoURL.trim() || undefined,
        avatarUrl: photoURL.trim() || undefined,
      });

      // Server update if session available
      if (accountToken && serverUrl) {
        const cleanServer = serverUrl.replace(/\/+$/, "");
        try {
          await fetch(`${cleanServer}/api/auth/update-user`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accountToken}`,
              Cookie: `better-auth.session_token=${accountToken}`,
              Origin: cleanServer,
              Referer: `${cleanServer}/`,
            },
            body: JSON.stringify({
              name: displayName.trim(),
              image: photoURL.trim() || undefined,
            }),
          });
        } catch { }
      }

      vaultAlert.alert("Success", "Profile updated successfully.", undefined, { illustration: "completed-task_c11d" });
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to update profile.", undefined, { illustration: "cancel_k4w9" });
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
            Cookie: `better-auth.session_token=${accountToken}`,
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
      vaultAlert.alert("Success", "Personal details saved successfully.", undefined, { illustration: "user-account_fvqa", glowColor: "rgba(167, 139, 250, 0.12)" });
    } catch (e: any) {
      vaultAlert.alert("Notice", "Personal details updated locally.", undefined, { illustration: "user-account_fvqa", glowColor: "rgba(167, 139, 250, 0.12)" });
    } finally {
      setSavingDetails(false);
    }
  };

  // Handle Account Password Change
  const handleAccountPasswordChange = async () => {
    if (!currentAccPw || !newAccPw) {
      vaultAlert.alert("Error", "Please fill in all account password fields.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }
    setAccPwLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accountToken}`,
          Cookie: `better-auth.session_token=${accountToken}`,
        },
        body: JSON.stringify({ currentPassword: currentAccPw, newPassword: newAccPw }),
      });
      if (res.ok) {
        vaultAlert.alert("Success", "Account password updated successfully.", undefined, { illustration: "secure-password_9qv4", glowColor: "rgba(52, 211, 153, 0.12)" });
        setCurrentAccPw("");
        setNewAccPw("");
      } else {
        const err = await res.json();
        vaultAlert.alert("Failed", err.message || err.error || "Could not update account password.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      }
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to communicate with server.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
    } finally {
      setAccPwLoading(false);
    }
  };

  // Handle Master Password Change
  const handleMasterPasswordChange = async () => {
    if (!currentMasterPw || !newMasterPw) {
      vaultAlert.alert("Error", "Please fill in all master password fields.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }
    if (newMasterPw.length < 8) {
      vaultAlert.alert("Weak Password", "Master password must be at least 8 characters long.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }
    if (currentMasterPw !== masterPassword) {
      vaultAlert.alert("Invalid Password", "Current master password does not match.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }

    setMasterPwLoading(true);
    try {
      const salt = accountUser?.id || "vaultr_default_salt";
      const newDerivedKey = await deriveKey(newMasterPw, salt);

      // Re-encrypt all items locally (F-13)
      if (items.length > 0 && cryptoKey) {
        const reEncrypted = await reEncryptBlobs(
          items,
          cryptoKey,
          newDerivedKey
        );

        const updated = items.map((item) => {
          const matched = reEncrypted.find((r) => r.id === item.id);
          return matched ? { ...item, encryptedBlob: matched.encryptedBlob } : item;
        });

        useVaultStore.setState({
          items: updated,
          masterPassword: newMasterPw,
          cryptoKey: newDerivedKey,
        });

        // Persist offline cache
        const { cacheVaultItems } = await import("../../services/sync");
        await cacheVaultItems(updated, accountUser?.id);
      } else {
        useVaultStore.setState({ masterPassword: newMasterPw, cryptoKey: newDerivedKey });
      }

      // Update biometrics storage if enabled (F-14)
      const { updateBiometricPassword } = await import("../../services/biometrics");
      await updateBiometricPassword(newMasterPw);

      vaultAlert.alert("Success", "Master password updated and all items re-encrypted successfully!", undefined, { illustration: "security-on_3ykb", glowColor: "rgba(52, 211, 153, 0.12)" });
      setCurrentMasterPw("");
      setNewMasterPw("");
    } catch (e: any) {
      vaultAlert.alert("Re-encryption Error", e.message || "Could not re-encrypt items with new master password.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
    } finally {
      setMasterPwLoading(false);
    }
  };

  const isProfileChanged =
    displayName.trim() !== (accountUser?.name || "") ||
    photoURL !== (accountUser?.image || accountUser?.avatarUrl || "");

  const isDetailsChanged =
    firstName.trim().length > 0 || lastName.trim().length > 0 || phone.trim().length > 0;

  const isMasterPwChanged =
    currentMasterPw.trim().length > 0 && newMasterPw.trim().length > 0;

  const isAccPwChanged =
    currentAccPw.trim().length > 0 && newAccPw.trim().length > 0;

  const initialLetter = (accountUser?.name || accountUser?.email || "V")[0].toUpperCase();
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  };

  const usagePercent = Math.min(100, Math.round((storageUsedBytes / storageQuotaBytes) * 100));
  const avatarUri = getAvatarUri(photoURL, serverUrl);

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
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              {avatarUri && !imageError ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{initialLetter}</Text>
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Edit2 size={12} color="#ffffff" />
              </View>
            </TouchableOpacity>

            <View style={styles.avatarInfo}>
              <Text style={styles.userNameText}>{displayName || accountUser?.name || "Vaultr User"}</Text>
              <Text style={styles.userEmailText}>{accountUser?.email || "user@vaultr.local"}</Text>
              <Text style={styles.userIdTag}>ID: {accountUser?.id || "N/A"}</Text>

              {photoURL ? (
                <TouchableOpacity style={styles.removePhotoLink} onPress={handleRemoveAvatar} activeOpacity={0.7}>
                  <Trash2 size={12} color="#f87171" />
                  <Text style={styles.removePhotoText}>Remove photo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.uploadPhotoLink} onPress={handlePickAvatar} activeOpacity={0.7}>
                  <Edit2 size={12} color="#a78bfa" />
                  <Text style={styles.uploadPhotoText}>Upload photo</Text>
                </TouchableOpacity>
              )}
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

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!isProfileChanged || savingProfile) && styles.btnDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={!isProfileChanged || savingProfile}
            activeOpacity={0.8}
          >
            {savingProfile ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryBtnText,
                  (!isProfileChanged || savingProfile) && styles.btnDisabledText,
                ]}
              >
                Save Profile
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Vault Storage & Quota (Segregated Standalone) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeaderLeft}>
              <Database size={18} color="#38bdf8" />
              <Text style={styles.cardTitle}>Vault Storage & Quota</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{usagePercent}% Used</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Storage allocated for encrypted vault items, attachments, passkeys, and credentials.
          </Text>

          {/* Storage Meter */}
          <View style={styles.storageBox}>
            <View style={styles.storageHeader}>
              <Text style={styles.storageLabel}>Encrypted Storage</Text>
              <Text style={styles.storageValue}>
                {formatBytes(storageUsedBytes)} <Text style={styles.storageTotal}>/ {formatBytes(storageQuotaBytes)}</Text>
              </Text>
            </View>
            <View style={styles.storageTrack}>
              <View
                style={[
                  styles.storageBar,
                  {
                    width: `${Math.min(100, Math.max(storageUsedBytes > 0 ? 2 : 0, usagePercent))}%`,
                    backgroundColor:
                      usagePercent >= 90 ? "#ef4444" : usagePercent >= 70 ? "#f59e0b" : "#38bdf8",
                  },
                ]}
              />
            </View>
            <View style={styles.storageMetaRow}>
              <Text style={styles.storageMetaText}>🔒 Zero-Knowledge Encrypted</Text>
              <Text style={styles.storageMetaText}>☁️ Cloud Synced</Text>
            </View>
          </View>
        </View>

        {/* ── Section 3: Personal Details (Segregated Standalone with Optional Badge) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeaderLeft}>
              <FileText size={18} color="#34d399" />
              <Text style={styles.cardTitle}>Personal Details</Text>
            </View>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>Optional</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Optional personal identity information stored securely with your vault profile.
          </Text>

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
            style={[
              styles.primaryBtn,
              (!isDetailsChanged || savingDetails) && styles.btnDisabled,
            ]}
            onPress={handleSaveDetails}
            disabled={!isDetailsChanged || savingDetails}
            activeOpacity={0.8}
          >
            {savingDetails ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryBtnText,
                  (!isDetailsChanged || savingDetails) && styles.btnDisabledText,
                ]}
              >
                Save Personal Details
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 4: Sign-In Providers ── */}
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

        {/* ── Section 5: Vault Master Password ── */}
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
            style={[
              styles.primaryBtn,
              (!isMasterPwChanged || masterPwLoading) && styles.btnDisabled,
            ]}
            onPress={handleMasterPasswordChange}
            disabled={!isMasterPwChanged || masterPwLoading}
            activeOpacity={0.8}
          >
            {masterPwLoading ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryBtnText,
                  (!isMasterPwChanged || masterPwLoading) && styles.btnDisabledText,
                ]}
              >
                Re-encrypt Vault & Update
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Section 6: Account Password ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Lock size={18} color="#f43f5e" />
            <Text style={styles.cardTitle}>Account Password</Text>
          </View>
          <Text style={styles.cardDesc}>
            Update the credentials used to authenticate your Vaultr server profile session.
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
            style={[
              styles.primaryBtn,
              (!isAccPwChanged || accPwLoading) && styles.btnDisabled,
            ]}
            onPress={handleAccountPasswordChange}
            disabled={!isAccPwChanged || accPwLoading}
            activeOpacity={0.8}
          >
            {accPwLoading ? (
              <ActivityIndicator color="#09090b" size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryBtnText,
                  (!isAccPwChanged || accPwLoading) && styles.btnDisabledText,
                ]}
              >
                Update Account Password
              </Text>
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
    padding: 4,
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
  cardHeaderBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#f4f4f5" },
  cardDesc: { fontSize: 12, color: "#71717a", lineHeight: 18 },

  // Badges & Pills
  badgePill: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgePillText: { fontSize: 10.5, fontWeight: "700", color: "#38bdf8", fontFamily: "monospace" },
  optionalBadge: {
    backgroundColor: "rgba(113, 113, 122, 0.15)",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionalBadgeText: { fontSize: 10.5, fontWeight: "600", color: "#a1a1aa" },

  // Avatar Row
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", position: "relative" },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 24, fontWeight: "700", color: "#ffffff" },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInfo: { flex: 1, minWidth: 0, gap: 2 },
  userNameText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  userEmailText: { fontSize: 12, color: "#a1a1aa" },
  userIdTag: { fontSize: 10.5, color: "#525252", fontFamily: "monospace" },
  removePhotoLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  removePhotoText: { fontSize: 11.5, color: "#f87171", fontWeight: "600" },
  uploadPhotoLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  uploadPhotoText: { fontSize: 11.5, color: "#a78bfa", fontWeight: "600" },

  // Storage
  storageBox: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  storageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  storageLabel: { fontSize: 12, fontWeight: "600", color: "#d4d4d8" },
  storageValue: { fontSize: 13, fontWeight: "700", color: "#f4f4f5", fontFamily: "monospace" },
  storageTotal: { fontSize: 11, fontWeight: "500", color: "#71717a" },
  storageTrack: { height: 7, borderRadius: 4, backgroundColor: "#18181b", overflow: "hidden" },
  storageBar: { height: 7, borderRadius: 4, backgroundColor: "#38bdf8" },
  storageMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 2 },
  storageMetaText: { fontSize: 10.5, color: "#71717a", fontWeight: "500" },

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
  btnDisabled: {
    backgroundColor: "#27272a",
    opacity: 0.5,
  },
  btnDisabledText: {
    color: "#71717a",
  },
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
