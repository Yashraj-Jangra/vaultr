import React, { useMemo, useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Modal,
  TextInput,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { vaultAlert } from "../../store/alertStore";
import { Illustration } from "../../components/Illustration";
import { colors } from "../../theme/colors";
import {
  Folder,
  ArrowLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  CornerDownRight,
  FolderPlus,
  FolderOpen,
} from "lucide-react-native";

export function FolderManagerScreen({ navigation }: any) {
  const { items, customFolders, addCustomFolder, renameFolder, deleteFolder, isOnline } =
    useVaultStore();

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createParent, setCreateParent] = useState("");
  const [createName, setCreateName] = useState("");

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    name: string;
    count: number;
  } | null>(null);

  // Compute combined unique folder list with counts & depth
  const folderTree = useMemo(() => {
    const countsMap = new Map<string, number>();
    items.forEach((i) => {
      if (i.folder && !i.deletedAt) {
        countsMap.set(i.folder, (countsMap.get(i.folder) || 0) + 1);
      }
    });

    const setAll = new Set<string>();
    items.forEach((i) => {
      if (i.folder && !i.deletedAt) {
        const parts = i.folder.split("/").filter(Boolean);
        let cur = "";
        for (const p of parts) {
          cur = cur ? `${cur}/${p}` : p;
          setAll.add(cur);
        }
      }
    });
    (customFolders || []).forEach((cf) => {
      const fName = typeof cf === "string" ? cf : (cf as any)?.name || (cf as any)?.path || "";
      if (fName) {
        const parts = fName.split("/").filter(Boolean);
        let cur = "";
        for (const p of parts) {
          cur = cur ? `${cur}/${p}` : p;
          setAll.add(cur);
        }
      }
    });

    const sortedList = Array.from(setAll).sort((a, b) => a.localeCompare(b));

    return sortedList.map((fullPath) => {
      const parts = fullPath.split("/").filter(Boolean);
      const name = parts[parts.length - 1];
      const depth = parts.length - 1;
      const parent = parts.slice(0, -1).join("/");
      // Total count includes items in this exact folder OR any child subfolders
      let count = 0;
      items.forEach((i) => {
        if (
          !i.deletedAt &&
          i.folder &&
          (i.folder === fullPath || i.folder.startsWith(`${fullPath}/`))
        ) {
          count++;
        }
      });

      return {
        fullPath,
        name,
        parent,
        depth,
        count,
      };
    });
  }, [items, customFolders]);

  const handleOpenFolder = (fullPath: string, name: string) => {
    navigation.navigate("VaultFiltered", {
      title: name,
      filterFolder: fullPath,
    });
  };

  const handleCreateSubmit = async () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to create folders.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    const trimmed = createName.trim();
    if (!trimmed) {
      vaultAlert.alert("Validation Error", "Please enter a folder name.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }
    if (trimmed.includes("/")) {
      vaultAlert.alert("Validation Error", "Folder name cannot contain slashes.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }

    const fullPath = createParent ? `${createParent}/${trimmed}` : trimmed;
    const depth = fullPath.split("/").filter(Boolean).length;
    if (depth > 3) {
      vaultAlert.alert("Max Depth Reached", "Folder depth cannot exceed 3 levels (e.g. Root/Sub1/Sub2).", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }

    try {
      await addCustomFolder(fullPath);
      setCreateName("");
      setCreateParent("");
      setShowCreateModal(false);
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to create folder.", undefined, { illustration: "cancel_k4w9" });
    }
  };

  const handleRenameSubmit = async () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to rename folders.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    if (!renameTarget) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      vaultAlert.alert("Validation Error", "Folder name cannot be empty.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }

    const parts = renameTarget.split("/").filter(Boolean);
    parts[parts.length - 1] = trimmed;
    const newPath = parts.join("/");

    if (newPath !== renameTarget) {
      try {
        await renameFolder(renameTarget, newPath);
      } catch (e: any) {
        vaultAlert.alert("Error", e.message || "Failed to rename folder.", undefined, { illustration: "cancel_k4w9" });
      }
    }
    setRenameTarget(null);
    setRenameName("");
  };

  const handleDeleteExecute = async (disposition: "uncategorize" | "trash") => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to delete folders.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    if (!deleteTarget) return;
    try {
      await deleteFolder(deleteTarget.name, disposition);
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to delete folder.", undefined, { illustration: "cancel_k4w9" });
    }
    setDeleteTarget(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Folder Manager</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.newFolderHeaderBtn}
          onPress={() => {
            if (!isOnline) {
              vaultAlert.alert("Offline Mode", "Internet connection is required to create folders.", undefined, { illustration: "clouds_bmtk" });
              return;
            }
            setCreateParent("");
            setCreateName("");
            setShowCreateModal(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#09090b" />
          <Text style={styles.newFolderHeaderText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      {/* Folder Tree List */}
      <FlatList
        data={folderTree}
        keyExtractor={(item) => item.fullPath}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSubfolder = item.depth > 0;
          return (
            <View
              style={[
                styles.folderCard,
                isSubfolder && { marginLeft: item.depth * 16 },
              ]}
            >
              {/* Left Tree Branch Indicator if Subfolder */}
              {isSubfolder && (
                <View style={styles.treeBranchWrap}>
                  <CornerDownRight size={14} color="#71717a" />
                </View>
              )}

              {/* Folder Row Details */}
              <TouchableOpacity
                style={styles.rowMainArea}
                onPress={() => handleOpenFolder(item.fullPath, item.name)}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Folder size={18} color="#fafafa" />
                </View>
                <View style={{ flex: 1, justifyContent: "center" }}>
                  <Text style={styles.folderName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.folderCount}>{item.count} items</Text>
                </View>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {/* Sleek Arrow to Open */}
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={() => handleOpenFolder(item.fullPath, item.name)}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={18} color="#a1a1aa" />
                </TouchableOpacity>

                {/* Edit (Rename) Button */}
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={() => {
                    setRenameTarget(item.fullPath);
                    setRenameName(item.name);
                  }}
                  activeOpacity={0.7}
                >
                  <Pencil size={15} color="#a1a1aa" />
                </TouchableOpacity>

                {/* Delete Button */}
                <TouchableOpacity
                  style={[styles.actionIconButton, styles.deleteActionBtn]}
                  onPress={() => {
                    if (item.count === 0) {
                      deleteFolder(item.fullPath, "uncategorize");
                    } else {
                      setDeleteTarget({ name: item.fullPath, count: item.count });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Illustration name="empty_4zx0" width={220} height={160} style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Folders Created</Text>
            <Text style={styles.emptyDesc}>
              Organize your passwords, credit cards, and secure notes into custom folders and subfolders.
            </Text>
            <TouchableOpacity
              style={styles.createFirstBtn}
              onPress={() => {
                setCreateParent("");
                setCreateName("");
                setShowCreateModal(true);
              }}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#09090b" />
              <Text style={styles.createFirstBtnText}>Create First Folder</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── CREATE FOLDER / SUBFOLDER MODAL ── */}
      <ReanimatedModal visible={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <View style={styles.modalCard}>
          <TouchableOpacity
            onPress={() => setShowCreateModal(false)}
            style={styles.closeModalBtn}
          >
            <X size={18} color="#a1a1aa" />
          </TouchableOpacity>

          <View style={styles.heroWrap}>
            <View style={styles.ambientGlowViolet} />
            <Illustration name="new-entries_xw4m" width={170} height={115} />
          </View>

          <Text style={[styles.modalTitle, { textAlign: "center", marginBottom: 14 }]}>New Folder</Text>

          <View style={{ width: "100%" }}>
            <Text style={styles.inputLabel}>PARENT FOLDER (OPTIONAL)</Text>
            <View style={styles.parentPickerRow}>
              <ScrollViewHorizontalParentPicker
                folderTree={folderTree}
                createParent={createParent}
                setCreateParent={setCreateParent}
              />
            </View>

            <Text style={styles.inputLabel}>FOLDER NAME</Text>
            <TextInput
              style={styles.textInput}
              value={createName}
              onChangeText={setCreateName}
              placeholder="e.g. Work, Finance, 2026..."
              placeholderTextColor="#52525b"
              autoFocus
            />

            {createName.trim().length > 0 && (
              <View style={styles.pathPreviewWrap}>
                <Text style={styles.pathPreviewLabel}>Full Path:</Text>
                <Text style={styles.pathPreviewText}>
                  {createParent ? `${createParent}/${createName.trim()}` : createName.trim()}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCreateSubmit}
              >
                <Text style={styles.confirmBtnText}>Create Folder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ReanimatedModal>

      {/* ── RENAME FOLDER MODAL ── */}
      <ReanimatedModal visible={!!renameTarget} onClose={() => setRenameTarget(null)}>
        <View style={styles.modalCard}>
          <TouchableOpacity
            onPress={() => setRenameTarget(null)}
            style={styles.closeModalBtn}
          >
            <X size={18} color="#a1a1aa" />
          </TouchableOpacity>

          <View style={styles.heroWrap}>
            <View style={styles.ambientGlowViolet} />
            <Illustration name="personal-notebook_blje" width={170} height={115} />
          </View>

          <Text style={[styles.modalTitle, { textAlign: "center", marginBottom: 14 }]}>Rename Folder</Text>

          <View style={{ width: "100%" }}>
            <Text style={styles.inputLabel}>NEW FOLDER NAME</Text>
            <TextInput
              style={styles.textInput}
              value={renameName}
              onChangeText={setRenameName}
              placeholder="Folder name"
              placeholderTextColor="#52525b"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleRenameSubmit}
              >
                <Text style={styles.confirmBtnText}>Save Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ReanimatedModal>

      {/* ── MINIMAL DELETE CONFIRMATION MODAL (AGENTS.md guidelines) ── */}
      <ReanimatedModal visible={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <View style={styles.deleteModalCard}>
          <TouchableOpacity
            onPress={() => setDeleteTarget(null)}
            style={styles.deleteCloseBtn}
          >
            <X size={18} color="#a1a1aa" />
          </TouchableOpacity>

          {/* Hero Illustration */}
          <View style={styles.heroWrap}>
            <View style={styles.ambientGlowRed} />
            <Illustration name="throw-away_k2t5" width={180} height={125} />
          </View>

          <Text style={styles.deleteModalTitle}>
            Delete "{deleteTarget?.name.split("/").pop()}"?
          </Text>
          <Text style={styles.deleteModalDesc}>
            Choose what happens to the {deleteTarget?.count || 0} item
            {(deleteTarget?.count || 0) === 1 ? "" : "s"} inside this folder.
          </Text>

          {/* Primary Action Button (Safe Workflow) */}
          <TouchableOpacity
            style={styles.primarySafeButton}
            onPress={() => handleDeleteExecute("uncategorize")}
            activeOpacity={0.8}
          >
            <Text style={styles.primarySafeButtonText}>
              Keep Items (Move to Uncategorized)
            </Text>
          </TouchableOpacity>

          {/* Secondary Destructive Action (Red Link) */}
          <TouchableOpacity
            style={styles.secondaryRedLink}
            onPress={() => handleDeleteExecute("trash")}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={styles.secondaryRedLinkText}>
              Delete folder and move {deleteTarget?.count || 0} item
              {(deleteTarget?.count || 0) === 1 ? "" : "s"} to Trash
            </Text>
          </TouchableOpacity>
        </View>
      </ReanimatedModal>
    </SafeAreaView>
  );
}

function ReanimatedModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.93);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      scale.value = withSpring(1, { damping: 22, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      scale.value = withTiming(0.93, { duration: 140 });
    }
  }, [visible]);

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.93, { duration: 140 });
    setTimeout(onClose, 140);
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <Animated.View style={[styles.modalOverlay, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleDismiss} />
        <Animated.View style={[{ width: "100%", maxWidth: 380, alignItems: "center" }, surfaceStyle]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Sub-component for horizontal parent folder picker in creation modal
function ScrollViewHorizontalParentPicker({
  folderTree,
  createParent,
  setCreateParent,
}: {
  folderTree: any[];
  createParent: string;
  setCreateParent: (val: string) => void;
}) {
  return (
    <View style={styles.parentPillContainer}>
      <TouchableOpacity
        style={[
          styles.parentPill,
          createParent === "" && styles.parentPillActive,
        ]}
        onPress={() => setCreateParent("")}
      >
        <Text
          style={[
            styles.parentPillText,
            createParent === "" && styles.parentPillTextActive,
          ]}
        >
          None (Root Folder)
        </Text>
      </TouchableOpacity>

      {folderTree
        .filter((f) => f.depth < 2)
        .map((f) => (
          <TouchableOpacity
            key={f.fullPath}
            style={[
              styles.parentPill,
              createParent === f.fullPath && styles.parentPillActive,
            ]}
            onPress={() => setCreateParent(f.fullPath)}
          >
          <Text
            style={[
              styles.parentPillText,
              createParent === f.fullPath && styles.parentPillTextActive,
            ]}
          >
            {f.fullPath}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  newFolderHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  newFolderHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#09090b",
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  folderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  treeBranchWrap: {
    marginRight: 6,
  },
  rowMainArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  parentBreadcrumb: {
    fontSize: 10,
    fontWeight: "600",
    color: "#71717a",
    marginBottom: 1,
  },
  folderName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  folderCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },
  actionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteActionBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyDesc: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  createFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  createFirstBtnText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "600",
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "rgba(38,38,38,0.8)",
    borderRadius: 24,
    padding: 24,
    position: "relative",
  },
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 4,
    position: "relative",
  },
  ambientGlowViolet: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(167, 139, 250, 0.10)",
    top: 5,
  },
  ambientGlowRed: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    top: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  closeModalBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    padding: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  parentPillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  parentPickerRow: {
    marginBottom: 12,
  },
  parentPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  parentPillActive: {
    backgroundColor: "rgba(250, 250, 250, 0.15)",
    borderColor: "#fafafa",
  },
  parentPillText: {
    fontSize: 12,
    color: "#a1a1aa",
  },
  parentPillTextActive: {
    color: "#fafafa",
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f4f4f5",
    fontSize: 15,
    marginBottom: 16,
  },
  pathPreviewWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    backgroundColor: "#141416",
    padding: 8,
    borderRadius: 8,
  },
  pathPreviewLabel: {
    fontSize: 12,
    color: "#71717a",
  },
  pathPreviewText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f59e0b",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#18181b",
  },
  cancelBtnText: {
    fontSize: 14,
    color: "#a1a1aa",
    fontWeight: "500",
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f4f4f5",
  },
  confirmBtnText: {
    fontSize: 14,
    color: "#09090b",
    fontWeight: "600",
  },

  /* Minimal Delete Modal */
  deleteModalCard: {
    width: "100%",
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  deleteCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  heroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f4f4f5",
    marginBottom: 8,
    textAlign: "center",
  },
  deleteModalDesc: {
    fontSize: 13,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  primarySafeButton: {
    width: "100%",
    backgroundColor: "#f4f4f5",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primarySafeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#09090b",
  },
  secondaryRedLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  secondaryRedLinkText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "500",
  },
});
