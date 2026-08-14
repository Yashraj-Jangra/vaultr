import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useVaultStore } from "../store/vaultStore";
import { vaultAlert } from "../store/alertStore";
import { colors } from "../theme/colors";
import {
  Folder,
  FolderOpen,
  ChevronDown,
  Check,
  Plus,
  X,
  Search,
  Inbox,
  CornerDownRight,
} from "lucide-react-native";

interface FolderSelectModalProps {
  value: string;
  onChange: (val: string) => void;
}

export function FolderSelectModal({ value, onChange }: FolderSelectModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createParent, setCreateParent] = useState("");

  const { items, customFolders, addCustomFolder } = useVaultStore();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.93);

  useEffect(() => {
    if (open) {
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      scale.value = withSpring(1, { damping: 22, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      scale.value = withTiming(0.93, { duration: 140 });
    }
  }, [open]);

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.93, { duration: 140 });
    setTimeout(() => {
      setOpen(false);
      setCreating(false);
    }, 140);
  };

  // Build combined unique sorted list of all folder paths
  const allFolderPaths = useMemo(() => {
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
    if (value) {
      const parts = value.split("/").filter(Boolean);
      let cur = "";
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        setAll.add(cur);
      }
    }
    return Array.from(setAll).sort((a, b) => a.localeCompare(b));
  }, [items, customFolders, value]);

  // Tree items with depth and displayName
  const treeItems = useMemo(() => {
    return allFolderPaths.map((fullPath) => {
      const parts = fullPath.split("/").filter(Boolean);
      const name = parts[parts.length - 1];
      const depth = parts.length - 1;
      return { fullPath, name, depth };
    });
  }, [allFolderPaths]);

  // Filtered by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return treeItems;
    const q = search.toLowerCase();
    return treeItems.filter(
      (t) => t.name.toLowerCase().includes(q) || t.fullPath.toLowerCase().includes(q)
    );
  }, [treeItems, search]);

  const handleCreateSubmit = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    if (trimmed.includes("/")) {
      vaultAlert.alert("Invalid Name", "Folder name cannot contain slashes.", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }

    const fullPath = createParent ? `${createParent}/${trimmed}` : trimmed;
    const depth = fullPath.split("/").filter(Boolean).length;
    if (depth > 3) {
      vaultAlert.alert("Max Depth Reached", "Folder depth cannot exceed 3 levels (e.g. Root/Sub1/Sub2).", undefined, { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.10)" });
      return;
    }

    await addCustomFolder(fullPath);
    onChange(fullPath);
    setNewFolderName("");
    setCreateParent("");
    setCreating(false);
    handleClose();
  };

  const currentLabel = value ? value : "No folder";

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View>
      {/* Dropdown Trigger Button */}
      <TouchableOpacity
        style={styles.triggerBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        {value ? (
          <Folder size={18} color="#fafafa" style={{ marginRight: 8 }} />
        ) : (
          <Inbox size={18} color="#71717a" style={{ marginRight: 8 }} />
        )}
        <Text style={[styles.triggerText, !value && { color: "#a1a1aa" }]} numberOfLines={1}>
          {currentLabel}
        </Text>
        <ChevronDown size={16} color="#71717a" style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      {/* Selector Modal */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <Animated.View style={[styles.modalOverlay, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
          <Animated.View style={[styles.modalCard, surfaceStyle]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <FolderOpen size={20} color="#fafafa" />
                <Text style={styles.modalTitle}>Select Folder</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
              >
                <X size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={styles.searchWrap}>
              <Search size={14} color="#71717a" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search folders..."
                placeholderTextColor="#52525b"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <X size={14} color="#71717a" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Options List */}
            <ScrollView style={styles.optionsList} contentContainerStyle={{ paddingVertical: 4 }}>
              {/* No Folder Option */}
              {!search.trim() && (
                <TouchableOpacity
                  style={[styles.optionRow, value === "" && styles.optionRowActive]}
                  onPress={() => {
                    onChange("");
                    handleClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Inbox size={18} color={value === "" ? "#fafafa" : "#71717a"} style={{ marginRight: 10 }} />
                  <Text style={[styles.optionTitle, value === "" && styles.optionTitleActive]}>
                    No folder
                  </Text>
                  {value === "" && <Check size={16} color="#fafafa" style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              )}

              {/* Tree Items */}
              {filteredItems.map((item) => {
                const isSelected = value === item.fullPath;
                const isSubfolder = item.depth > 0;
                return (
                  <TouchableOpacity
                    key={item.fullPath}
                    style={[
                      styles.optionRow,
                      { paddingLeft: 12 + item.depth * 16 },
                      isSelected && styles.optionRowActive,
                    ]}
                    onPress={() => {
                      onChange(item.fullPath);
                      handleClose();
                    }}
                    activeOpacity={0.7}
                  >
                    {isSubfolder && (
                      <CornerDownRight size={13} color="#71717a" style={{ marginRight: 6 }} />
                    )}
                    {isSelected ? (
                      <FolderOpen size={18} color="#fafafa" style={{ marginRight: 10 }} />
                    ) : (
                      <Folder size={18} color="#fafafa" style={{ marginRight: 10 }} />
                    )}
                    <Text
                      style={[
                        styles.optionTitle,
                        isSelected && styles.optionTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {isSelected && <Check size={16} color="#fafafa" style={{ marginLeft: "auto" }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Bottom Create Button */}
            {!creating ? (
              <TouchableOpacity
                style={styles.createBtnTrigger}
                onPress={() => setCreating(true)}
                activeOpacity={0.75}
              >
                <Plus size={16} color="#fafafa" style={{ marginRight: 6 }} />
                <Text style={styles.createBtnTriggerText}> Create Folder / Subfolder</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.createFormWrap}>
                <Text style={styles.createFormLabel}>CREATE NEW FOLDER</Text>

                {/* Parent selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.parentPill, createParent === "" && styles.parentPillActive]}
                    onPress={() => setCreateParent("")}
                  >
                    <Text style={[styles.parentPillText, createParent === "" && styles.parentPillTextActive]}>
                      Root Level
                    </Text>
                  </TouchableOpacity>
                  {treeItems
                    .filter((t) => t.depth < 2) // Max depth 3 constraint
                    .map((t) => (
                      <TouchableOpacity
                        key={t.fullPath}
                        style={[styles.parentPill, createParent === t.fullPath && styles.parentPillActive]}
                        onPress={() => setCreateParent(t.fullPath)}
                      >
                        <Text style={[styles.parentPillText, createParent === t.fullPath && styles.parentPillTextActive]}>
                          Under {t.fullPath}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <TextInput
                  style={styles.createInput}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Folder name"
                  placeholderTextColor="#52525b"
                  autoFocus
                />

                <View style={styles.createActions}>
                  <TouchableOpacity
                    style={styles.createCancelBtn}
                    onPress={() => setCreating(false)}
                  >
                    <Text style={styles.createCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.createConfirmBtn}
                    onPress={handleCreateSubmit}
                  >
                    <Text style={styles.createConfirmText}>Create & Select</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 20,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  closeBtn: {
    padding: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f4f4f5",
    fontSize: 14,
    padding: 0,
  },
  optionsList: {
    maxHeight: 260,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 1,
  },
  optionRowActive: {
    backgroundColor: "rgba(250, 250, 250, 0.1)",
  },
  optionTitle: {
    fontSize: 14,
    color: "#a1a1aa",
    fontWeight: "500",
  },
  optionTitleActive: {
    color: "#fafafa",
    fontWeight: "600",
  },
  createBtnTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    marginTop: 8,
  },
  createBtnTriggerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fafafa",
  },
  createFormWrap: {
    borderTopWidth: 1,
    borderTopColor: "#18181b",
    paddingTop: 12,
    marginTop: 8,
  },
  createFormLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  parentPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    marginRight: 6,
  },
  parentPillActive: {
    backgroundColor: "rgba(250, 250, 250, 0.15)",
    borderColor: "#fafafa",
  },
  parentPillText: {
    fontSize: 11,
    color: "#a1a1aa",
  },
  parentPillTextActive: {
    color: "#fafafa",
    fontWeight: "600",
  },
  createInput: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#f4f4f5",
    fontSize: 14,
    marginBottom: 10,
  },
  createActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  createCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#18181b",
  },
  createCancelText: {
    fontSize: 13,
    color: "#a1a1aa",
  },
  createConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f4f4f5",
  },
  createConfirmText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#09090b",
  },
});
