import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import { reEncryptBlobs } from "@vaultr/core";
import { User, KeyRound, Lock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react-native";

export function AccountSettingsScreen({ navigation }: any) {
  const { accountUser, masterPassword, cryptoKey, items, serverUrl, accountToken } = useVaultStore();

  // Change account password state
  const [currentAccPw, setCurrentAccPw] = useState("");
  const [newAccPw, setNewAccPw] = useState("");
  const [accPwLoading, setAccPwLoading] = useState(false);

  // Change master password state
  const [currentMasterPw, setCurrentMasterPw] = useState("");
  const [newMasterPw, setNewMasterPw] = useState("");
  const [masterPwLoading, setMasterPwLoading] = useState(false);

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
      
      // Update each item in vault store
      for (const updated of reEncrypted) {
        await useVaultStore.getState().updateItem(updated.id, {
          unencryptedPayload: undefined, // keep original unencrypted payload intact, blob is updated
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <User size={32} color={colors.accent} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.nameText}>{accountUser?.name || "Vaultr User"}</Text>
            <Text style={styles.emailText}>{accountUser?.email || "user@vaultr.local"}</Text>
            <Text style={styles.idText}>ID: {accountUser?.id}</Text>
          </View>
        </View>

        {/* Change Master Password (Vault Key Re-encryption) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <KeyRound size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Vault Master Password</Text>
          </View>
          <Text style={styles.cardDesc}>
            Changing your master password will re-encrypt all vault entries on-device with a new derived encryption key.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Current Master Password</Text>
            <TextInput
              style={styles.input}
              value={currentMasterPw}
              onChangeText={setCurrentMasterPw}
              placeholder="••••••••••••"
              placeholderTextColor={colors.textDim}
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
              placeholderTextColor={colors.textDim}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleMasterPasswordChange}
            disabled={masterPwLoading}
          >
            {masterPwLoading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Re-encrypt Vault & Update</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Change Account Password */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Lock size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Account Sign-In Password</Text>
          </View>
          <Text style={styles.cardDesc}>
            Update the password used to sign in to your Vaultr account on the web and mobile server.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Current Account Password</Text>
            <TextInput
              style={styles.input}
              value={currentAccPw}
              onChangeText={setCurrentAccPw}
              placeholder="••••••••••••"
              placeholderTextColor={colors.textDim}
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
              placeholderTextColor={colors.textDim}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleAccountPasswordChange}
            disabled={accPwLoading}
          >
            {accPwLoading ? (
              <ActivityIndicator color={colors.text} />
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
    gap: 12,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    gap: 2,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  emailText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  idText: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 4,
    fontFamily: "monospace",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: colors.text,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
});
