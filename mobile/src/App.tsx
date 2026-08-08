import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useVaultStore } from "./store/vaultStore";
import { VaultItem } from "@vaultr/core";

export default function App() {
  const {
    isUnlocked,
    items,
    isLoading,
    unlock,
    unlockWithBiometrics,
    lock,
    serverUrl,
    setServerUrl,
    searchQuery,
    setSearchQuery,
    decryptItemBlob,
  } = useVaultStore();

  const [passwordInput, setPasswordInput] = useState("");
  const [urlInput, setUrlInput] = useState(serverUrl);

  const handleUnlockSubmit = async () => {
    if (!passwordInput) return;
    try {
      await unlock(passwordInput, urlInput);
    } catch (err: any) {
      Alert.alert("Unlock Error", err?.message || "Failed to unlock vault");
    }
  };

  const handleBiometricUnlock = async () => {
    const success = await unlockWithBiometrics();
    if (!success) {
      Alert.alert("Biometrics Failed", "Could not unlock with fingerprint/face.");
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.domain || "").toLowerCase().includes(q)
    );
  });

  if (!isUnlocked) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#09090b" />
        <View style={styles.unlockCard}>
          <Text style={styles.title}>Vaultr Mobile</Text>
          <Text style={styles.subtitle}>Enter master password to unlock</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="http://10.0.2.2:3000"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Master Password</Text>
            <TextInput
              style={styles.input}
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="••••••••••••"
              placeholderTextColor="#71717a"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleUnlockSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <Text style={styles.primaryButtonText}>Unlock Vault</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleBiometricUnlock}
          >
            <Text style={styles.secondaryButtonText}>Use Fingerprint / Face</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vaultr ({items.length})</Text>
        <TouchableOpacity style={styles.lockButton} onPress={lock}>
          <Text style={styles.lockButtonText}>Lock</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
          placeholderTextColor="#71717a"
        />
      </View>

      {/* Item List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <ItemCard item={item} onDecrypt={decryptItemBlob} />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items found in vault</Text>
        }
      />
    </SafeAreaView>
  );
}

function ItemCard({
  item,
  onDecrypt,
}: {
  item: VaultItem;
  onDecrypt: (blob: string) => Promise<string>;
}) {
  const [decryptedData, setDecryptedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (decryptedData) return;
    setLoading(true);
    try {
      const raw = await onDecrypt(item.encryptedBlob);
      setDecryptedData(JSON.parse(raw));
    } catch (err) {
      Alert.alert("Decryption Error", "Failed to decrypt this item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardBadge}>{item.template || "login"}</Text>
      </View>
      <Text style={styles.cardDomain}>{item.domain || "No domain"}</Text>
      {decryptedData && (
        <View style={styles.decryptedBox}>
          {decryptedData.username && (
            <Text style={styles.decryptedText}>User: {decryptedData.username}</Text>
          )}
          {decryptedData.password && (
            <Text style={styles.decryptedText}>Password: {decryptedData.password}</Text>
          )}
        </View>
      )}
      {loading && <Text style={styles.loadingText}>Decrypting...</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  unlockCard: {
    padding: 24,
    justifyContent: "center",
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f4f4f5",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#a1a1aa",
    textAlign: "center",
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 12,
    color: "#f4f4f5",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#f4f4f5",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#09090b",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#a78bfa",
    fontWeight: "600",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  lockButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockButtonText: {
    color: "#f87171",
    fontWeight: "600",
    fontSize: 12,
  },
  searchContainer: {
    padding: 12,
  },
  searchInput: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 10,
    color: "#f4f4f5",
    fontSize: 13,
  },
  listContainer: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f4f4f5",
  },
  cardBadge: {
    fontSize: 11,
    color: "#a78bfa",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  cardDomain: {
    fontSize: 12,
    color: "#a1a1aa",
    marginTop: 4,
  },
  decryptedBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
  },
  decryptedText: {
    fontSize: 12,
    color: "#4ade80",
    marginTop: 2,
    fontFamily: "monospace",
  },
  loadingText: {
    fontSize: 11,
    color: "#a1a1aa",
    marginTop: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#71717a",
    fontSize: 13,
    marginTop: 32,
  },
});
