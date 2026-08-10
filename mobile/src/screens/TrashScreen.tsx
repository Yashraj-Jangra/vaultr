import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from "react-native";
import { vaultAlert } from "../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../store/vaultStore";
import { colors } from "../theme/colors";
import { Trash2, RotateCcw, ArrowLeft, ShieldAlert } from "lucide-react-native";
import { Illustration } from "../components/Illustration";

export function TrashScreen({ navigation }: any) {
  const { items, restoreItem, deleteItem } = useVaultStore();

  const trashedItems = items.filter((i) => !!i.deletedAt);

  const handleRestore = async (id: string, name: string) => {
    try {
      await restoreItem(id);
      vaultAlert.alert("Restored", `Restored "${name}" to vault.`, undefined, { illustration: "completed-task_c11d" });
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to restore item.", undefined, { illustration: "cancel_k4w9" });
    }
  };

  const handlePermanentDelete = (id: string, name: string) => {
    vaultAlert.alert(
      "Permanent Delete",
      `Are you sure you want to permanently delete "${name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteItem(id);
            } catch (e: any) {
              vaultAlert.alert("Error", e.message || "Failed to delete item.", undefined, { illustration: "cancel_k4w9" });
            }
          },
        },
      ]
    );
  };

  const handleEmptyTrash = () => {
    if (trashedItems.length === 0) return;
    vaultAlert.alert(
      "Empty Trash",
      `Permanently delete all ${trashedItems.length} items in Trash?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: async () => {
            for (const item of trashedItems) {
              await deleteItem(item.id);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Trash ({trashedItems.length})</Text>

        {trashedItems.length > 0 && (
          <TouchableOpacity style={styles.emptyTrashBtn} onPress={handleEmptyTrash}>
            <Text style={styles.emptyTrashText}>Empty</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={trashedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.deletedDate}>
                Deleted {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : ""}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleRestore(item.id, item.name)}
            >
              <RotateCcw size={16} color={colors.success} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handlePermanentDelete(item.id, item.name)}
            >
              <Trash2 size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Illustration name="throw-away_k2t5" width={260} height={200} style={{ marginBottom: 20 }} />
            <Text style={styles.emptyTitle}>Trash is Empty</Text>
            <Text style={styles.emptyDesc}>Items moved to trash will appear here.</Text>
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
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  emptyTrashBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
  },
  emptyTrashText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  deletedDate: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
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
  },
});
