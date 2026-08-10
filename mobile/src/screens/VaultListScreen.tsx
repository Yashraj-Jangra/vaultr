import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  Image,
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

const TEMPLATE_LABELS: Record<string, string> = {
  login: "Logins",
  card: "Cards",
  note: "Notes",
  address: "Addresses",
  profile: "Profiles",
};

/** Small icon badge used in Favourites section rows */
function SmallIconBadge({ item }: { item: any }) {
  const template = item.template || "login";
  const tc = TEMPLATE_COLORS[template] || TEMPLATE_COLORS.login;
  const IconComp = TEMPLATE_ICONS[template] || Lock;

  if (template === "login" && item.domain) {
    return <SiteIcon domain={item.domain} name={item.name} size={32} />;
  }
  return (
    <View style={[styles.smallIconBox, { backgroundColor: tc.bg }]}>
      <IconComp size={15} color={tc.icon} />
    </View>
  );
}

export function VaultListScreen({ navigation }: Props) {
  const { accountUser, items, lock, fetchItems } = useVaultStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const activeItems = useMemo(() => items.filter((i) => !i.deletedAt), [items]);
  const trashCount = useMemo(() => items.filter((i) => !!i.deletedAt).length, [items]);

  const favoriteItems = useMemo(
    () => activeItems.filter((i) => i.favorite),
    [activeItems]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      login: 0, card: 0, note: 0, address: 0, profile: 0,
    };
    activeItems.forEach((i) => {
      const t = i.template || "login";
      if (t in counts) counts[t]++;
    });
    return counts;
  }, [activeItems]);

  const folders = useMemo(() => {
    const map: Record<string, number> = {};
    activeItems.forEach((i) => {
      const f = i.folder || "__NONE__";
      map[f] = (map[f] || 0) + 1;
    });
    return map;
  }, [activeItems]);

  const folderNames = useMemo(
    () => Object.keys(folders).filter((f) => f !== "__NONE__").sort(),
    [folders]
  );
  const uncategorizedCount = folders["__NONE__"] || 0;

  const navigateFiltered = (title: string, filterType?: string, filterFolder?: string) => {
    navigation.navigate("VaultFiltered", { title, filterType, filterFolder });
  };

  const avatarInitial = (accountUser?.name || accountUser?.email || "U")[0].toUpperCase();

  const isEmpty = activeItems.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My vault</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate("VaultFiltered", {
              title: "Search",
              filterType: undefined,
              filterFolder: undefined,
              openSearch: true,
            })}
            activeOpacity={0.7}
          >
            <Search size={17} color="#a1a1aa" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accountAvatarBtn}
            onPress={() => navigation.navigate("Settings")}
            activeOpacity={0.85}
          >
            {accountUser?.image ? (
              <Image source={{ uri: accountUser.image }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable Body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
        }
      >
        {isEmpty ? (
          /* Empty vault illustration */
          <View style={styles.emptyWrap}>
            <Illustration name="vault_tyfh" width={260} height={210} style={{ marginBottom: 20 }} />
            <Text style={styles.emptyTitle}>Your vault is empty</Text>
            <Text style={styles.emptyDesc}>Tap + to add your first entry</Text>
          </View>
        ) : (
          <>
            {/* ── FAVOURITES section ── */}
            {favoriteItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  FAVOURITES ({favoriteItems.length})
                </Text>
                <View style={styles.listCard}>
                  {favoriteItems.map((item, idx) => {
                    const template = item.template || "login";
                    const subLine =
                      template === "login" ? (item.domain || "Login") :
                      template === "card" ? "•••• •••• •••• ••••" :
                      template === "note" ? "Secure note" :
                      template === "profile" ? "Identity profile" :
                      template === "address" ? "Saved address" : "";
                    const isLast = idx === favoriteItems.length - 1;
                    return (
                      <React.Fragment key={item.id}>
                        <TouchableOpacity
                          style={styles.listRow}
                          onPress={() => navigation.navigate("ItemDetail", { item })}
                          activeOpacity={0.7}
                        >
                          <View style={styles.listRowIcon}>
                            <SmallIconBadge item={item} />
                          </View>
                          <View style={styles.listRowContent}>
                            <Text style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.listRowSub} numberOfLines={1}>{subLine}</Text>
                          </View>
                          <ChevronRight size={15} color="#3f3f46" />
                        </TouchableOpacity>
                        {!isLast && <View style={styles.rowDivider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── TYPES section ── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                TYPES ({activeItems.length})
              </Text>
              <View style={styles.listCard}>
                {(["login", "card", "note", "address", "profile"] as const).map((t, idx, arr) => {
                  const IconComp = TEMPLATE_ICONS[t];
                  const tc = TEMPLATE_COLORS[t];
                  const count = typeCounts[t];
                  const isLast = idx === arr.length - 1;
                  return (
                    <React.Fragment key={t}>
                      <TouchableOpacity
                        style={styles.listRow}
                        onPress={() => navigateFiltered(TEMPLATE_LABELS[t], t)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.listRowIcon, { backgroundColor: tc.bg, borderRadius: 10, width: 36, height: 36 }]}>
                          <IconComp size={16} color={tc.icon} />
                        </View>
                        <Text style={styles.listRowTitle}>{TEMPLATE_LABELS[t]}</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.listRowCount}>{count}</Text>
                        <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                      {!isLast && <View style={styles.rowDivider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* ── FOLDERS section ── */}
            {(folderNames.length > 0 || uncategorizedCount > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  FOLDERS ({folderNames.length + (uncategorizedCount > 0 ? 1 : 0)})
                </Text>
                <View style={styles.listCard}>
                  {folderNames.map((f, idx) => {
                    const displayName = f.split("/").pop() || f;
                    const depth = f.split("/").length - 1;
                    const isLast = idx === folderNames.length - 1 && uncategorizedCount === 0;
                    return (
                      <React.Fragment key={f}>
                        <TouchableOpacity
                          style={[styles.listRow, depth > 0 && { paddingLeft: 14 + depth * 16 }]}
                          onPress={() => navigateFiltered(displayName, undefined, f)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.listRowIcon}>
                            <Folder size={18} color="#71717a" />
                          </View>
                          <Text style={styles.listRowTitle}>{displayName}</Text>
                          <View style={{ flex: 1 }} />
                          <Text style={styles.listRowCount}>{folders[f]}</Text>
                          <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                        {!isLast && <View style={styles.rowDivider} />}
                      </React.Fragment>
                    );
                  })}

                  {uncategorizedCount > 0 && (
                    <>
                      {folderNames.length > 0 && <View style={styles.rowDivider} />}
                      <TouchableOpacity
                        style={styles.listRow}
                        onPress={() => navigateFiltered("No folder", undefined, "UNCATEGORIZED")}
                        activeOpacity={0.7}
                      >
                        <View style={styles.listRowIcon}>
                          <Folder size={18} color="#52525b" />
                        </View>
                        <Text style={[styles.listRowTitle, { color: "#a1a1aa" }]}>No folder</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={styles.listRowCount}>{uncategorizedCount}</Text>
                        <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* ── TRASH row ── */}
            <View style={styles.section}>
              <View style={styles.listCard}>
                <TouchableOpacity
                  style={styles.listRow}
                  onPress={() => navigation.navigate("Trash")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.listRowIcon, { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, width: 36, height: 36 }]}>
                    <Trash2 size={16} color="#f87171" />
                  </View>
                  <Text style={[styles.listRowTitle, { color: "#f87171" }]}>Trash</Text>
                  <View style={{ flex: 1 }} />
                  {trashCount > 0 && (
                    <Text style={[styles.listRowCount, { color: "#f87171" }]}>{trashCount}</Text>
                  )}
                  <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Bottom spacer for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ── */}
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
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#09090b",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#7c3aed",
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 14, fontWeight: "700", color: "#ffffff" },

  // ── Section ──
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#525252",
    letterSpacing: 1.1,
    marginBottom: 8,
    marginLeft: 4,
  },

  // ── List card ──
  listCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  listRowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  smallIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowContent: { flex: 1, minWidth: 0 },
  listRowTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#f4f4f5",
    flexShrink: 1,
  },
  listRowSub: {
    fontSize: 12,
    color: "#71717a",
    marginTop: 2,
    fontFamily: "monospace",
  },
  listRowCount: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#1c1c1e",
    marginLeft: 62,
  },

  // ── Empty State ──
  emptyWrap: {
    alignItems: "center",
    paddingTop: 130,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#737373",
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
    letterSpacing: -0.3,
  },
  emptyDesc: {
    color: "#525252",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },

  // ── FAB ──
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 18,
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
