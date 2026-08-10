import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import { VaultItem } from "@vaultr/core";
import { SiteIcon } from "../components/SiteIcon";
import { colors } from "../theme/colors";
import {
  Search,
  Lock,
  Plus,
  Settings,
  ChevronRight,
  Shield,
  Folder,
} from "lucide-react-native";

type Props = { navigation: any };

export function VaultListScreen({ navigation }: Props) {
  const {
    items,
    searchQuery,
    setSearchQuery,
    selectedFolder,
    setSelectedFolder,
    selectedTemplate,
    setSelectedTemplate,
    lock,
    accountUser,
  } = useVaultStore();

  // Extract unique folders
  const folders = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.folder) set.add(i.folder);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search query
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.domain || "").toLowerCase().includes(q) ||
        (item.folder || "").toLowerCase().includes(q);

      // Folder filter
      const matchesFolder =
        selectedFolder === "ALL" ||
        (selectedFolder === "UNCATEGORIZED" && !item.folder) ||
        item.folder === selectedFolder;

      // Template filter
      const matchesTemplate =
        selectedTemplate === "ALL" ||
        (item.template || "login") === selectedTemplate;

      return matchesSearch && matchesFolder && matchesTemplate;
    });
  }, [items, searchQuery, selectedFolder, selectedTemplate]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandBadge}>
            <Shield size={18} color={colors.accent} />
          </View>
          <Text style={styles.headerTitle}>Vaultr</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredItems.length}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.lockBtn} onPress={lock}>
          <Lock size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={16} color={colors.textDim} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vault entries..."
            placeholderTextColor={colors.textDim}
          />
        </View>
      </View>

      {/* Folder Pills Filter */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[
              styles.filterPill,
              selectedFolder === "ALL" && styles.filterPillActive,
            ]}
            onPress={() => setSelectedFolder("ALL")}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedFolder === "ALL" && styles.filterPillTextActive,
              ]}
            >
              All Items
            </Text>
          </TouchableOpacity>

          {folders.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                selectedFolder === f && styles.filterPillActive,
              ]}
              onPress={() => setSelectedFolder(f)}
            >
              <Folder
                size={12}
                color={selectedFolder === f ? colors.bg : colors.textMuted}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterPillText,
                  selectedFolder === f && styles.filterPillTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Vault List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.itemCard}
            onPress={() => navigation.navigate("ItemDetail", { item })}
            activeOpacity={0.7}
          >
            <SiteIcon
              domain={item.domain}
              name={item.name}
              url={(item as any).url}
              template={item.template || "login"}
              size={36}
            />

            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemSubtext} numberOfLines={1}>
                {item.domain || item.folder || (item.template || "login").toUpperCase()}
              </Text>
            </View>

            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Shield size={36} color={colors.surface3} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>No Entries Found</Text>
            <Text style={styles.emptyDesc}>Tap + below to add your first encrypted item</Text>
          </View>
        }
      />

      {/* Floating Action Button (+) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("ItemForm", {})}
        activeOpacity={0.85}
      >
        <Plus size={24} color={colors.bg} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  brandBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  lockBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  filterSection: {
    paddingVertical: 6,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: colors.bg,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 80,
    gap: 8,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2,
  },
  itemSubtext: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyDesc: {
    color: colors.textDim,
    fontSize: 13,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
