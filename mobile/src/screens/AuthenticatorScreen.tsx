import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, StatusBar, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../store/vaultStore";
import { TotpCode } from "../components/TotpCode";
import { colors } from "../theme/colors";
import { KeyRound } from "lucide-react-native";
import { Illustration } from "../components/Illustration";

function AuthenticatorItemRow({ item }: { item: any }) {
  const { decryptItemBlob } = useVaultStore();
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await decryptItemBlob(item.encryptedBlob);
        const p = JSON.parse(raw);
        if (mounted && (p.totpSecret || p.totp_secret)) {
          setTotpSecret(p.totpSecret || p.totp_secret);
        }
      } catch {
        // failed to decrypt
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [item.encryptedBlob]);

  if (loading) {
    return (
      <View style={styles.cardLoading}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Decrypting 2FA seed for {item.name}...</Text>
      </View>
    );
  }

  if (!totpSecret) {
    return (
      <View style={styles.cardFallback}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.subtext}>No TOTP secret string stored in payload</Text>
      </View>
    );
  }

  return <TotpCode secret={totpSecret} name={item.name} />;
}

export function AuthenticatorScreen() {
  const { items } = useVaultStore();

  const totpItems = items.filter((i) => i.hasTotp && !i.deletedAt);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <KeyRound size={20} color={colors.accent} />
          <Text style={styles.headerTitle}>Authenticator ({totpItems.length})</Text>
        </View>
      </View>

      <FlatList
        data={totpItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => <AuthenticatorItemRow item={item} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Illustration name="two-factor-authentication_ofho" width={260} height={200} style={{ marginBottom: 20 }} />
            <Text style={styles.emptyTitle}>No TOTP Tokens Enrolled</Text>
            <Text style={styles.emptyDesc}>
              Add 2FA secret seeds to your login items to view live authenticator codes here.
            </Text>
          </View>
        }
      />
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  cardLoading: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardFallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  subtext: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 4,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 130,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyDesc: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
