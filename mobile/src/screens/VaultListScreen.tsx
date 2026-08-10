import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ScrollView,
  RefreshControl,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  X,
  ChevronRight,
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
      <SiteIcon domain={item.domain} name={item.name} size={36} />
    );
  }

  return (
    <View style={[styles.templateIconBox, { backgroundColor: tc.bg }]}>
      <IconComp size={18} color={tc.icon} />
    </View>
  );
}

export function VaultListScreen({ navigation }: Props) {
  const {
    accountUser,
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

    const folderName = item.folder ? item.folder.split("/").pop() : null;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => navigation.navigate("ItemDetail", { item })}
        activeOpacity={0.7}
      >
        {/* Left Icon Badge */}
        <View style={styles.itemIconWrap}>
          <ItemIconBadge item={item} />
        </View>

        {/* Center Details */}
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

            {folderName ? (
              <View style={styles.folderTag}>
                <Folder size={9} color="#71717a" style={{ marginRight: 3 }} />
                <Text style={styles.folderTagText}>{folderName}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Right Actions & Meta */}
        <View style={styles.itemRightWrap}>
          {dateStr ? (
            <Text style={styles.dateText}>{dateStr}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => toggleFavorite(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Star
              size={14}
              color={item.favorite ? "#fbbf24" : "#3f3f46"}
              fill={item.favorite ? "#fbbf24" : "none"}
            />
          </TouchableOpacity>

          <ChevronRight size={14} color="#3f3f46" style={{ marginLeft: 2 }} />
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

      {/* Top Header — web & mobile premium header bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/brand/logo-dark.png")}
            style={styles.headerBrandLogo}
            resizeMode="contain"
          />
          <View style={styles.zeroKnowledgeBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.zeroKnowledgeText}>AES-256</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate("Trash")}
            activeOpacity={0.7}
          >
            <Trash2 size={15} color="#a1a1aa" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={lock}
            activeOpacity={0.7}
          >
            <Lock size={15} color="#a1a1aa" />
          </TouchableOpacity>

          {/* Account Profile Avatar Option at Top */}
          <TouchableOpacity
            style={styles.accountAvatarBtn}
            onPress={() => navigation.navigate("Settings")}
            activeOpacity={0.85}
          >
            {accountUser?.image ? (
              <Image source={{ uri: accountUser.image }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(accountUser?.name || accountUser?.email || "U")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar — website & extension high-contrast styling */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={14} color="#71717a" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search passwords, domains, notes…"
            placeholderTextColor="#525252"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <X size={14} color="#71717a" />
            </TouchableOpacity>
          ) : (
            <View style={styles.itemCountTag}>
              <Text style={styles.itemCountTagText}>{filteredItems.length} items</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.favFilterBtn, showOnlyFavorites && styles.favFilterBtnActive]}
          onPress={() => setShowOnlyFavorites(!showOnlyFavorites)}
          activeOpacity={0.8}
        >
          <Star size={14} color={showOnlyFavorites ? "#fbbf24" : "#71717a"} fill={showOnlyFavorites ? "#fbbf24" : "none"} />
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
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textDim}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Illustration name="vault_tyfh" width={180} height={150} style={{ marginBottom: 12 }} />
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
    paddingVertical: 12,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBrandLogo: { height: 20, width: 95, opacity: 0.9 },
  zeroKnowledgeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
  },
  greenDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#10b981" },
  zeroKnowledgeText: { fontSize: 10, color: "#34d399", fontWeight: "600", fontFamily: "monospace" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#a78bfa",
  },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 13, fontWeight: "700", color: "#ffffff" },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#09090b",
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
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: "#f4f4f5", fontSize: 13, height: 42 },
  itemCountTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  itemCountTagText: { fontSize: 10, color: "#71717a", fontFamily: "monospace" },
  favFilterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  favFilterBtnActive: { borderColor: "rgba(251,191,36,0.5)", backgroundColor: "rgba(251,191,36,0.1)" },

  // Filter pills
  filterScroll: { borderBottomWidth: 1, borderBottomColor: "#18181b", backgroundColor: "#09090b" },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
  },
  filterPillActive: { backgroundColor: "#f4f4f5", borderColor: "#f4f4f5" },
  filterPillText: { fontSize: 12, color: "#a1a1aa", fontWeight: "500" },
  filterPillTextActive: { color: "#09090b", fontWeight: "600" },
  filterDivider: { width: 1, height: 20, backgroundColor: "#1f1f1f", marginHorizontal: 2 },

  // Elevated card row design
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
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

  // Right metadata & actions
  itemRightWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
  dateText: { fontSize: 10.5, color: "#525252", fontFamily: "monospace" },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { color: "#737373", fontSize: 15, fontWeight: "600", marginTop: 14, letterSpacing: -0.3 },
  emptyDesc: { color: "#525252", fontSize: 12, marginTop: 6, textAlign: "center" },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
});
