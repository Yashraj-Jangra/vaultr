import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../store/vaultStore";
import { SiteIcon } from "../components/SiteIcon";
import { colors, TEMPLATE_COLORS } from "../theme/colors";
import {
  ArrowLeft,
  Search,
  Lock,
  Star,
  KeyRound,
  Folder,
  CreditCard,
  FileText,
  MapPin,
  User,
  ChevronRight,
  X,
  Plus,
} from "lucide-react-native";
import { Illustration } from "../components/Illustration";

type Props = {
  navigation: any;
  route: {
    params: {
      title: string;
      filterType?: string;   // 'login' | 'card' | 'note' | 'address' | 'profile'
      filterFolder?: string; // folder path or 'UNCATEGORIZED'
      filterFavorite?: boolean;
      openSearch?: boolean;
    };
  };
};

const TEMPLATE_ICONS: Record<string, any> = {
  login: Lock,
  card: CreditCard,
  note: FileText,
  address: MapPin,
  profile: User,
};

function ItemIconBadge({ item }: { item: any }) {
  const template = item.template || "login";
  const tc = TEMPLATE_COLORS[template] || TEMPLATE_COLORS.login;
  const IconComp = TEMPLATE_ICONS[template] || Lock;

  if (template === "login" && item.domain) {
    return <SiteIcon domain={item.domain} name={item.name} size={36} />;
  }

  return (
    <View style={[styles.templateIconBox, { backgroundColor: tc.bg }]}>
      <IconComp size={20} color={tc.icon} />
    </View>
  );
}

export function VaultFilteredScreen({ navigation, route }: Props) {
  const { title, filterType, filterFolder, filterFavorite, openSearch } = route.params;
  const { items, customFolders, fetchItems, toggleFavorite } = useVaultStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const handleAddItem = () => {
    navigation.navigate("ItemForm", {
      initialFolder: filterFolder && filterFolder !== "UNCATEGORIZED" ? filterFolder : undefined,
      initialTemplate: (filterType as any) || undefined,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const activeItems = useMemo(() => items.filter((i) => !i.deletedAt), [items]);

  const childSubfolders = useMemo(() => {
    if (!filterFolder || filterFolder === "UNCATEGORIZED") return [];
    const prefix = `${filterFolder}/`;
    const setChild = new Set<string>();

    activeItems.forEach((i) => {
      if (i.folder && i.folder.startsWith(prefix)) {
        const rel = i.folder.slice(prefix.length);
        const firstSegment = rel.split("/")[0];
        if (firstSegment) {
          setChild.add(`${filterFolder}/${firstSegment}`);
        }
      }
    });

    (customFolders || []).forEach((cf) => {
      const fName = typeof cf === "string" ? cf : (cf as any)?.name || (cf as any)?.path || "";
      if (fName && fName.startsWith(prefix)) {
        const rel = fName.slice(prefix.length);
        const firstSegment = rel.split("/")[0];
        if (firstSegment) {
          setChild.add(`${filterFolder}/${firstSegment}`);
        }
      }
    });

    return Array.from(setChild)
      .sort((a, b) => a.localeCompare(b))
      .map((subPath) => {
        const subName = subPath.split("/").pop() || subPath;
        let count = 0;
        activeItems.forEach((i) => {
          if (
            i.folder &&
            (i.folder === subPath || i.folder.startsWith(`${subPath}/`))
          ) {
            count++;
          }
        });
        return { fullPath: subPath, name: subName, count };
      });
  }, [filterFolder, activeItems, customFolders]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activeItems.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.domain || "").toLowerCase().includes(q) ||
        (item.tags || []).some((t: string) => t.toLowerCase().includes(q));

      const matchesType = filterType
        ? (item.template || "login") === filterType
        : true;

      const matchesFolder = filterFolder
        ? filterFolder === "UNCATEGORIZED"
          ? !item.folder
          : item.folder === filterFolder
        : true;

      const matchesFavorite = filterFavorite ? item.favorite === true : true;

      return matchesSearch && matchesType && matchesFolder && matchesFavorite;
    });
  }, [activeItems, searchQuery, filterType, filterFolder, filterFavorite]);

  const renderItem = ({ item }: { item: any }) => {
    const template = item.template || "login";
    const subLine =
      template === "login" ? (item.domain || "Login credential") :
      template === "card" ? (item.domain || "•••• ••••") :
      template === "note" ? "Encrypted note" :
      template === "profile" ? "Identity profile" :
      template === "address" ? "Saved address" : "";

    const folderName = item.folder ? item.folder.split("/").pop() : null;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => navigation.navigate("ItemDetail", { item })}
        activeOpacity={0.7}
      >
        <View style={styles.itemIconWrap}>
          <ItemIconBadge item={item} />
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemTopRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.hasTotp && (
              <View style={styles.totpBadge}>
                <KeyRound size={9} color="#a78bfa" />
                <Text style={styles.totpBadgeText}>2FA</Text>
              </View>
            )}
          </View>

          <View style={styles.itemSubRow}>
            <Text style={styles.itemSubLine} numberOfLines={1}>
              {subLine}
            </Text>
            {folderName && !filterFolder ? (
              <View style={styles.folderTag}>
                <Folder size={9} color="#71717a" style={{ marginRight: 3 }} />
                <Text style={styles.folderTagText}>{folderName}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.itemRightWrap}>
          <TouchableOpacity
            onPress={() => toggleFavorite(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Star
              size={14}
              color={item.favorite ? "#fbbf24" : "#3f3f46"}
              fill={item.favorite ? "#fbbf24" : "none"}
            />
          </TouchableOpacity>
          <ChevronRight size={14} color="#3f3f46" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={18} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerCountBadge}>
          <Text style={styles.headerCountText}>{filteredItems.length}</Text>
        </View>

        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={handleAddItem}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Plus size={18} color="#fafafa" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={14} color="#71717a" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search…"
          placeholderTextColor="#525252"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={!!openSearch}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
            <X size={14} color="#71717a" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
        }
        ListHeaderComponent={
          childSubfolders.length > 0 ? (
            <View style={styles.subfoldersSection}>
              <Text style={styles.subfoldersLabel}>
                SUBFOLDERS ({childSubfolders.length})
              </Text>
              <View style={styles.subfoldersCard}>
                {childSubfolders.map((sub, idx) => (
                  <React.Fragment key={sub.fullPath}>
                    <TouchableOpacity
                      style={styles.subfolderRow}
                      onPress={() =>
                        navigation.push("VaultFiltered", {
                          title: sub.name,
                          filterFolder: sub.fullPath,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.subfolderIconBox}>
                        <Folder size={18} color="#fafafa" />
                      </View>
                      <View style={{ flex: 1, justifyContent: "center" }}>
                        <Text style={styles.subfolderTitle}>{sub.name}</Text>
                        <Text style={styles.subfolderSubtitle}>{sub.count} items</Text>
                      </View>
                      <ChevronRight size={16} color="#3f3f46" />
                    </TouchableOpacity>
                    {idx < childSubfolders.length - 1 && (
                      <View style={styles.subfolderDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Illustration name="the-search_cjxa" width={250} height={200} style={{ marginBottom: 18 }} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No results found" : "Nothing here yet"}
            </Text>
            <Text style={styles.emptyDesc}>
              {searchQuery ? "Try a different search" : "Items in this category will appear here"}
            </Text>
          </View>
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddItem}
        activeOpacity={0.85}
      >
        <Plus size={22} color="#09090b" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#141417",
    gap: 12,
  },
  backBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  headerCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  headerCountText: {
    fontSize: 12,
    color: "#71717a",
    fontWeight: "600",
    fontFamily: "monospace",
  },
  headerAddBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: "#f4f4f5", fontSize: 13, height: 42 },

  // Item card
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#18181b",
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    paddingHorizontal: 14,
    elevation: 2,
  },
  itemIconWrap: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  templateIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: { flex: 1, minWidth: 0, marginLeft: 12 },
  itemTopRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  itemName: { fontSize: 14.5, fontWeight: "600", color: "#ffffff", flexShrink: 1, minWidth: 0 },
  itemSubRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  itemSubLine: { fontSize: 11.5, color: "#71717a", fontFamily: "monospace", flexShrink: 1 },
  folderTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  folderTagText: { fontSize: 9.5, color: "#a1a1aa", fontWeight: "500" },
  totpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(109,40,217,0.25)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  totpBadgeText: { fontSize: 9, color: "#a78bfa", fontWeight: "700", letterSpacing: 0.5 },
  itemRightWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },

  emptyState: { alignItems: "center", paddingTop: 130, paddingHorizontal: 24 },
  emptyTitle: { color: "#737373", fontSize: 15, fontWeight: "600", marginTop: 14, letterSpacing: -0.3 },
  emptyDesc: { color: "#525252", fontSize: 12, marginTop: 6, textAlign: "center" },

  /* Subfolders Top Section */
  subfoldersSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  subfoldersLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#71717a",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  subfoldersCard: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#18181b",
    borderRadius: 14,
    overflow: "hidden",
  },
  subfolderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  subfolderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  subfolderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f4f4f5",
  },
  subfolderSubtitle: {
    fontSize: 11,
    color: "#71717a",
    marginTop: 1,
  },
  subfolderDivider: {
    height: 1,
    backgroundColor: "#18181b",
    marginLeft: 60,
  },
});
