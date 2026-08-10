import React, { useMemo, useState } from "react";
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
  RefreshControl,
  Image,
} from "react-native";
import { useVaultStore } from "../store/vaultStore";
import { SiteIcon } from "../components/SiteIcon";
import { colors, TEMPLATE_COLORS } from "../theme/colors";
import {
  Search,
  Lock,
  Plus,
  Star,
  Trash2,
  KeyRound,
  Folder,
  CreditCard,
  FileText,
  MapPin,
  User,
  Shield,
} from "lucide-react-native";
import { Illustration } from "../components/Illustration";

type Props = { navigation: any };

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
    return (
      <SiteIcon domain={item.domain} name={item.name} size={32} />
    );
  }

  return (
    <View style={[styles.templateIconBox, { backgroundColor: tc.bg }]}>
      <IconComp size={16} color={tc.icon} />
    </View>
  );
}

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
    fetchItems,
    toggleFavorite,
  } = useVaultStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const activeItems = useMemo(() => items.filter((i) => !i.deletedAt), [items]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    activeItems.forEach((i) => { if (i.folder) set.add(i.folder); });
    return Array.from(set).sort();
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.domain || "").toLowerCase().includes(q) ||
        (item.folder || "").toLowerCase().includes(q);
      const matchesFolder =
        selectedFolder === "ALL" ||
        (selectedFolder === "UNCATEGORIZED" && !item.folder) ||
        item.folder === selectedFolder;
      const matchesTemplate =
        selectedTemplate === "ALL" ||
        (item.template || "login") === selectedTemplate;
      const matchesFavorites = !showOnlyFavorites || !!item.favorite;
      return matchesSearch && matchesFolder && matchesTemplate && matchesFavorites;
    });
  }, [activeItems, searchQuery, selectedFolder, selectedTemplate, showOnlyFavorites]);

  const renderItem = ({ item }: { item: any }) => {
    const template = item.template || "login";
    const subLine =
      template === "login" ? (item.domain || "Login credential") :
      template === "card" ? "•••• •••• •••• ••••" :
      template === "note" ? "Encrypted note" :
      template === "profile" ? "Identity profile" :
      template === "address" ? "Saved address" : "";

    const dateStr = item.updatedAt || item.createdAt
      ? new Date(item.updatedAt || item.createdAt || "").toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;

    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => navigation.navigate("ItemDetail", { item })}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={styles.itemIconWrap}>
          <ItemIconBadge item={item} />
        </View>

        {/* Content */}
        <View style={styles.itemContent}>
          <View style={styles.itemTopRow}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            {item.favorite && (
              <Star size={13} color="#fbbf24" fill="#fbbf24" style={{ marginLeft: 4 }} />
            )}
            {item.hasTotp && (
              <View style={styles.totpBadge}>
                <Text style={styles.totpBadgeText}>2FA</Text>
              </View>
            )}
            {dateStr && (
              <Text style={styles.dateText}>{dateStr}</Text>
            )}
          </View>
          <View style={styles.itemSubRow}>
            <Text style={styles.itemSubLine} numberOfLines={1}>{subLine}</Text>
            {item.folder && selectedFolder === "ALL" && (
              <View style={styles.folderPill}>
                <Folder size={9} color="#525252" style={{ marginRight: 2 }} />
                <Text style={styles.folderPillText}>{item.folder.split("/").pop()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={[styles.actionBtn, item.favorite && styles.actionBtnFav]}
            onPress={() => toggleFavorite(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Star
              size={13}
              color={item.favorite ? "#fbbf24" : "#404040"}
              fill={item.favorite ? "#fbbf24" : "none"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {/* trash */}}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={13} color="#404040" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const TEMPLATES = [
    { id: "ALL", label: "All" },
    { id: "login", label: "Logins" },
    { id: "card", label: "Cards" },
    { id: "note", label: "Notes" },
    { id: "address", label: "Addresses" },
    { id: "profile", label: "Profiles" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/brand/logo-mark-dark.png")}
            style={styles.headerBrandMark}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Vaultr</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredItems.length}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate("Trash")}
          >
            <Trash2 size={16} color={colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={lock}
          >
            <Lock size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar — matches site's search input style */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={14} color="#525252" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vault…"
            placeholderTextColor="#404040"
          />
          {showOnlyFavorites && (
            <TouchableOpacity onPress={() => setShowOnlyFavorites(false)}>
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.favFilterBtn, showOnlyFavorites && styles.favFilterBtnActive]}
          onPress={() => setShowOnlyFavorites(!showOnlyFavorites)}
        >
          <Star size={14} color={showOnlyFavorites ? "#fbbf24" : "#525252"} fill={showOnlyFavorites ? "#fbbf24" : "none"} />
        </TouchableOpacity>
      </View>

      {/* Type filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.filterPill, selectedTemplate === t.id && styles.filterPillActive]}
            onPress={() => setSelectedTemplate(t.id)}
          >
            <Text style={[styles.filterPillText, selectedTemplate === t.id && styles.filterPillTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Folder pills */}
        {folders.length > 0 && (
          <>
            <View style={styles.filterDivider} />
            <TouchableOpacity
              style={[styles.filterPill, selectedFolder === "ALL" && styles.filterPillActive]}
              onPress={() => setSelectedFolder("ALL")}
            >
              <Text style={[styles.filterPillText, selectedFolder === "ALL" && styles.filterPillTextActive]}>
                All Folders
              </Text>
            </TouchableOpacity>
            {folders.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, selectedFolder === f && styles.filterPillActive]}
                onPress={() => setSelectedFolder(f)}
              >
                <Folder size={10} color={selectedFolder === f ? colors.neutral950 : colors.textFaint} style={{ marginRight: 4 }} />
                <Text style={[styles.filterPillText, selectedFolder === f && styles.filterPillTextActive]}>
                  {f.split("/").pop()}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Items List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textDim}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Illustration name="empty_vault" width={180} height={150} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No results found" : "Your vault is empty"}
            </Text>
            <Text style={styles.emptyDesc}>
              {searchQuery
                ? "Try a different search query"
                : "Tap + to add your first entry"}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("ItemForm", {})}
        activeOpacity={0.85}
      >
        <Plus size={22} color="#09090b" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBrandMark: { width: 24, height: 24 },
  headerTitle: { fontSize: 15, fontWeight: "600", color: "#f4f4f5", letterSpacing: -0.3 },
  countBadge: {
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: { fontSize: 10, color: "#525252", fontFamily: "monospace" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#141414",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: { flex: 1, color: "#e4e4e7", fontSize: 13, height: 36 },
  favFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  favFilterBtnActive: { borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(251,191,36,0.08)" },

  // Filter pills
  filterScroll: { maxHeight: 40, borderBottomWidth: 1, borderBottomColor: "#141414" },
  filterRow: { paddingHorizontal: 16, paddingVertical: 6, gap: 6, alignItems: "center" },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },
  filterPillActive: { backgroundColor: "#f4f4f5", borderColor: "#f4f4f5" },
  filterPillText: { fontSize: 11, color: "#737373", fontWeight: "500" },
  filterPillTextActive: { color: "#09090b" },
  filterDivider: { width: 1, height: 20, backgroundColor: "#1f1f1f", marginHorizontal: 4 },

  // Item row — matches web list view
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  itemIconWrap: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  templateIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: { flex: 1, minWidth: 0 },
  itemTopRow: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  itemName: { fontSize: 13.5, fontWeight: "500", color: "#f4f4f5", flexShrink: 1, minWidth: 0 },
  itemSubRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  itemSubLine: { fontSize: 11, color: "#525252", fontFamily: "monospace", flexShrink: 1 },
  dateText: { fontSize: 10, color: "#404040", fontFamily: "monospace", marginLeft: "auto" },
  folderPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(38,38,38,0.6)",
    borderWidth: 1,
    borderColor: "rgba(64,64,64,0.5)",
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  folderPillText: { fontSize: 9, color: "#525252" },
  totpBadge: {
    backgroundColor: "rgba(109,40,217,0.3)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  totpBadgeText: { fontSize: 9, color: "#a78bfa", fontWeight: "700", letterSpacing: 0.5 },

  // Action buttons
  itemActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnFav: { backgroundColor: "rgba(251,191,36,0.1)" },

  // Separator — matches web's 1px divider
  separator: { height: 1, backgroundColor: "#1a1a1a", marginLeft: 58 },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { color: "#737373", fontSize: 15, fontWeight: "600", marginTop: 14, letterSpacing: -0.3 },
  emptyDesc: { color: "#525252", fontSize: 12, marginTop: 6, textAlign: "center" },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
