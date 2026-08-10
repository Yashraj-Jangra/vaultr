import React from "react";
import { StyleSheet, Text, View, SafeAreaView, StatusBar, FlatList } from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import { KeyRound, ShieldCheck } from "lucide-react-native";

export function AuthenticatorScreen() {
  const { items } = useVaultStore();

  const totpItems = items.filter((i) => i.hasTotp);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <KeyRound size={20} color={colors.accent} />
          <Text style={styles.headerTitle}>Authenticator</Text>
        </View>
      </View>

      <FlatList
        data={totpItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.subtext}>{item.domain || "2FA Token"}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <ShieldCheck size={40} color={colors.surface3} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No TOTP Tokens Enrolled</Text>
            <Text style={styles.emptyDesc}>
              Add 2FA seeds to your login items to view live authenticator codes here.
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
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  subtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
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
