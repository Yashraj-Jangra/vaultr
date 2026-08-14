import React, { useState } from "react";
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
import { PurgeConfirmModal, PurgeTarget } from "../components/PurgeConfirmModal";

export function TrashScreen({ navigation }: any) {
  const { items, restoreItem, deleteItem, batchAction, isOnline } = useVaultStore();
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const trashedItems = items.filter((i) => !!i.deletedAt);

  const handleRestore = (id: string, name: string) => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to restore items.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    vaultAlert.alert(
      `Restore "${name}"?`,
      `This item will be moved back to your active vault.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "default",
          onPress: async () => {
            try {
              await restoreItem(id);
            } catch (e: any) {
              vaultAlert.alert("Error", e.message || "Failed to restore item.", undefined, {
                illustration: "cancel_k4w9",
                glowColor: "rgba(239, 68, 68, 0.10)",
              });
            }
          },
        },
      ],
      { illustration: "clean-up_af4s", glowColor: "rgba(52, 211, 153, 0.12)" }
    );
  };

  const handleRestoreAll = () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to restore items.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    if (trashedItems.length === 0) return;
    vaultAlert.alert(
      `Restore All (${trashedItems.length}) Items?`,
      `All ${trashedItems.length} item${trashedItems.length === 1 ? "" : "s"} in Trash will be moved back to your active vault.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore All",
          style: "default",
          onPress: async () => {
            try {
              const ids = trashedItems.map((i) => i.id);
              await batchAction("restore", ids);
            } catch (e: any) {
              vaultAlert.alert("Error", e.message || "Failed to restore all items.", undefined, {
                illustration: "cancel_k4w9",
                glowColor: "rgba(239, 68, 68, 0.10)",
              });
            }
          },
        },
      ],
      { illustration: "clean-up_af4s", glowColor: "rgba(52, 211, 153, 0.12)" }
    );
  };

  const handlePermanentDelete = (id: string, name: string) => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to delete items.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    setPurgeTarget({ type: "single", id, name, count: 1 });
  };

  const handleEmptyTrash = () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to empty trash.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    if (trashedItems.length === 0) return;
    setPurgeTarget({ type: "all", count: trashedItems.length });
  };

  const executePurge = async () => {
    if (!purgeTarget) return;
    try {
      if (purgeTarget.type === "single" && purgeTarget.id) {
        await deleteItem(purgeTarget.id);
      } else if (purgeTarget.type === "all") {
        const ids = trashedItems.map((i) => i.id);
        await batchAction("purge", ids);
      }
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to purge item(s).", undefined, { illustration: "cancel_k4w9" });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Trash ({trashedItems.length})</Text>

        {trashedItems.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.restoreAllBtn} onPress={handleRestoreAll} activeOpacity={0.8}>
              <RotateCcw size={13} color="#34d399" style={{ marginRight: 4 }} />
              <Text style={styles.restoreAllText}>Restore All</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.emptyTrashBtn} onPress={handleEmptyTrash} activeOpacity={0.8}>
              <Trash2 size={13} color="#f87171" style={{ marginRight: 4 }} />
              <Text style={styles.emptyTrashText}>Empty</Text>
            </TouchableOpacity>
          </View>
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

      {/* Master Password Reprompt Confirmation Modal for Permanent Deletion */}
      <PurgeConfirmModal
        open={!!purgeTarget}
        target={purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={executePurge}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  restoreAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  restoreAllText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyTrashBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
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
