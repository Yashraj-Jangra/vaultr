import React, { useMemo, useState, useEffect } from "react";
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
import { getAvatarUri } from "../utils/avatar";
import {
  Search,
  Lock,
  Plus,
  Star,
  Trash2,
  KeyRound,
  Folder,
  FolderOpen,
  ChevronDown,
  CreditCard,
  FileText,
  MapPin,
  User,
  ChevronRight,
  CornerDownRight,
  Shield,
  Clock,
} from "lucide-react-native";
import { Illustration } from "../components/Illustration";
import { PressableScale } from "../components/PressableScale";
import { vaultAlert } from "../store/alertStore";
import { useResponsive } from "../utils/responsive";

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
    return <SiteIcon domain={item.domain} name={item.name} size={38} />;
  }
  return (
    <View style={[styles.smallIconBox, { backgroundColor: tc.bg }]}>
      <IconComp size={20} color={tc.icon} />
    </View>
  );
}

export function VaultListScreen({ navigation }: Props) {
  const { accountUser, serverUrl, items, customFolders, lock, fetchItems, isOnline, checkConnection } = useVaultStore();
  const [refreshing, setRefreshing] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchItems().catch(() => {});
  }, []);

  const toggleCollapse = (folderPath: string) => {
    setCollapsedMap((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

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

  const folderNames = useMemo(() => {
    const setAll = new Set<string>();
    activeItems.forEach((i) => {
      if (i.folder) {
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
    return Array.from(setAll).sort((a, b) => a.localeCompare(b));
  }, [activeItems, customFolders]);

  const visibleFolders = useMemo(() => {
    return folderNames.filter((f) => {
      const parts = f.split("/").filter(Boolean);
      let ancestor = "";
      for (let i = 0; i < parts.length - 1; i++) {
        ancestor = ancestor ? `${ancestor}/${parts[i]}` : parts[i];
        if (collapsedMap[ancestor]) {
          return false;
        }
      }
      return true;
    });
  }, [folderNames, collapsedMap]);

  const uncategorizedCount = folders["__NONE__"] || 0;

  const navigateFiltered = (title: string, filterType?: string, filterFolder?: string) => {
    navigation.navigate("VaultFiltered", { title, filterType, filterFolder });
  };

  const avatarInitial = (accountUser?.name || accountUser?.email || "U")[0].toUpperCase();

  const isEmpty = activeItems.length === 0;

  const avatarUri = getAvatarUri(accountUser?.image || accountUser?.avatarUrl, serverUrl);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [accountUser?.image, accountUser?.avatarUrl]);

  const recentItems = useMemo(
    () => activeItems.slice(0, 6),
    [activeItems]
  );

  const { isLandscape, isTablet, width } = useResponsive();
  const isLandscapeLayout = isLandscape && width >= 640;

  const renderFavoritesSection = () => (
    favoriteItems.length > 0 ? (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          FAVOURITES ({favoriteItems.length})
        </Text>
        <View style={styles.listCard}>
          {favoriteItems.slice(0, 5).map((item, idx, arr) => {
            const template = item.template || "login";
            const subLine =
              template === "login" ? (item.domain || "Login") :
              template === "card" ? (item.domain || "•••• ••••") :
              template === "note" ? "Secure note" :
              template === "profile" ? "Identity profile" :
              template === "address" ? "Saved address" : "";
            const isLast = idx === arr.length - 1 && favoriteItems.length <= 5;
            return (
              <React.Fragment key={item.id}>
                <PressableScale
                  style={styles.listRow}
                  onPress={() => navigation.navigate("ItemDetail", { item })}
                >
                  <View style={styles.listRowIcon}>
                    <SmallIconBadge item={item} />
                  </View>
                  <View style={styles.listRowContent}>
                    <Text style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                    {subLine ? <Text style={styles.listRowSub}>{subLine}</Text> : null}
                  </View>
                  <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
                </PressableScale>
                {!isLast && <View style={styles.rowDivider} />}
              </React.Fragment>
            );
          })}

          {favoriteItems.length > 5 && (
            <TouchableOpacity
              style={styles.viewAllRow}
              onPress={() => navigation.navigate("VaultFiltered", { title: "Favorites", filterFavorite: true })}
            >
              <Text style={styles.viewAllText}>... View All ({favoriteItems.length})</Text>
              <ChevronRight size={15} color="#3f3f46" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    ) : null
  );

  const renderTypesSection = () => (
    <View style={isLandscapeLayout ? undefined : styles.section}>
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
              <PressableScale
                style={styles.listRow}
                onPress={() => navigateFiltered(TEMPLATE_LABELS[t], t)}
              >
                <View style={[styles.listRowIcon, { backgroundColor: tc.bg, borderRadius: 11, width: 38, height: 38 }]}>
                  <IconComp size={22} color={tc.icon} />
                </View>
                <Text style={styles.listRowTitle}>{TEMPLATE_LABELS[t]}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.listRowCount}>{count}</Text>
                <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
              </PressableScale>
              {!isLast && <View style={styles.rowDivider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  const renderFoldersSection = () => (
    (visibleFolders.length > 0 || uncategorizedCount > 0) ? (
      <View style={isLandscapeLayout ? undefined : styles.section}>
        <Text style={styles.sectionLabel}>
          FOLDERS ({visibleFolders.length + (uncategorizedCount > 0 ? 1 : 0)})
        </Text>
        <View style={styles.listCard}>
          {visibleFolders.map((f, idx) => {
            const parts = f.split("/").filter(Boolean);
            const displayName = parts[parts.length - 1];
            const depth = parts.length - 1;
            const isLast = idx === visibleFolders.length - 1 && uncategorizedCount === 0;

            const hasChildren = folderNames.some((other) => other !== f && other.startsWith(`${f}/`));
            const isCollapsed = !!collapsedMap[f];
            const isOpened = hasChildren ? !isCollapsed : true;

            let count = 0;
            activeItems.forEach((i) => {
              if (i.folder && (i.folder === f || i.folder.startsWith(`${f}/`))) {
                count++;
              }
            });

            return (
              <React.Fragment key={f}>
                <TouchableOpacity
                  style={[
                    styles.listRow,
                    depth > 0 && { paddingLeft: 12 + depth * 14 },
                  ]}
                  onPress={() => navigateFiltered(displayName, undefined, f)}
                  activeOpacity={0.7}
                >
                  {depth > 0 && (
                    <CornerDownRight size={14} color="#71717a" style={{ marginRight: 4 }} />
                  )}

                  <View style={styles.listRowIcon}>
                    {isOpened ? (
                      <FolderOpen size={24} color="#fafafa" />
                    ) : (
                      <Folder size={24} color="#fafafa" />
                    )}
                  </View>

                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text style={styles.listRowTitle}>{displayName}</Text>
                  </View>

                  <Text style={styles.listRowCount}>{count}</Text>

                  {hasChildren ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleCollapse(f);
                      }}
                      style={{ padding: 6, marginLeft: 4, width: 28, alignItems: "center" }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={16} color="#a1a1aa" />
                      ) : (
                        <ChevronDown size={16} color="#fafafa" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ padding: 6, marginLeft: 4, width: 28, alignItems: "center" }}>
                      <ChevronRight size={16} color="#3f3f46" />
                    </View>
                  )}
                </TouchableOpacity>
                {!isLast && <View style={styles.rowDivider} />}
              </React.Fragment>
            );
          })}

          {uncategorizedCount > 0 && (
            <>
              {visibleFolders.length > 0 && <View style={styles.rowDivider} />}
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => navigateFiltered("No folder", undefined, "UNCATEGORIZED")}
                activeOpacity={0.7}
              >
                <View style={styles.listRowIcon}>
                  <Folder size={24} color="#52525b" />
                </View>
                <Text style={[styles.listRowTitle, { color: "#a1a1aa" }]}>No folder</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.listRowCount}>{uncategorizedCount}</Text>
                <View style={{ padding: 6, marginLeft: 4, width: 28, alignItems: "center" }}>
                  <ChevronRight size={16} color="#3f3f46" />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    ) : null
  );

  const renderTrashSection = () => (
    <View style={isLandscapeLayout ? undefined : styles.section}>
      <View style={styles.listCard}>
        <TouchableOpacity
          style={styles.listRow}
          onPress={() => navigation.navigate("Trash")}
          activeOpacity={0.7}
        >
          <View style={[styles.listRowIcon, { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 11, width: 38, height: 38 }]}>
            <Trash2 size={18} color="#f87171" />
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
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/vaultr-full-dark-transparent.png")}
          style={{ width: 138, height: 32, resizeMode: "contain" }}
        />

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconOnlyBtn}
            onPress={() => navigation.navigate("VaultFiltered", {
              title: "Search",
              filterType: undefined,
              filterFolder: undefined,
              openSearch: true,
            })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Search size={20} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconOnlyBtn}
            onPress={lock}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Lock size={20} color="#e4e4e7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accountAvatarBtn}
            onPress={() => navigation.navigate("AccountSettings")}
            activeOpacity={0.85}
          >
            {avatarUri && !imageError ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Offline Status Banner ── */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineBannerLeft}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineBannerText}>Offline — Viewing local cache (Read-Only)</Text>
          </View>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={async () => {
              setCheckingConnection(true);
              await checkConnection();
              setCheckingConnection(false);
            }}
            disabled={checkingConnection}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>
              {checkingConnection ? "Checking…" : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Scrollable Body ── */}
      {isLandscapeLayout ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.landscapeScrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
          }
        >
          {/* Left Pane: Categories & Directory */}
          <View style={styles.landscapeLeftPane}>
            {renderTypesSection()}
            {renderFoldersSection()}
            {renderTrashSection()}
          </View>

          {/* Right Pane: Vault Hub, Favourites Grid & Recent Items */}
          <View style={styles.landscapeRightPane}>
            {/* Top Stats & Quick Action Hub */}
            <View style={styles.landscapeStatsCard}>
              <View style={styles.statsHeaderRow}>
                <View style={styles.securityPill}>
                  <Shield size={13} color="#10b981" />
                  <Text style={styles.securityPillText}>Zero-Knowledge AES-256</Text>
                </View>
                <TouchableOpacity
                  style={styles.landscapeAddBtn}
                  onPress={() => {
                    if (!isOnline) {
                      vaultAlert.alert(
                        "Offline Mode",
                        "Internet connection is required to create new items.",
                        undefined,
                        { illustration: "clouds_bmtk" }
                      );
                      return;
                    }
                    navigation.navigate("ItemForm", {});
                  }}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#09090b" strokeWidth={2.4} />
                  <Text style={styles.landscapeAddBtnText}>New Item</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsNumbersRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{activeItems.length}</Text>
                  <Text style={styles.statLabel}>Total Entries</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{favoriteItems.length}</Text>
                  <Text style={styles.statLabel}>Favourites</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{visibleFolders.length + (uncategorizedCount > 0 ? 1 : 0)}</Text>
                  <Text style={styles.statLabel}>Folders</Text>
                </View>
              </View>
            </View>

            {/* Favourites Grid in Landscape */}
            {favoriteItems.length > 0 ? (
              <View style={styles.landscapeSection}>
                <View style={styles.landscapeSectionHeader}>
                  <Text style={styles.sectionLabel}>FAVOURITES ({favoriteItems.length})</Text>
                  {favoriteItems.length > 6 && (
                    <TouchableOpacity onPress={() => navigation.navigate("VaultFiltered", { title: "Favorites", filterFavorite: true })}>
                      <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.favGrid}>
                  {favoriteItems.slice(0, 6).map((item) => {
                    const template = item.template || "login";
                    const subLine =
                      template === "login" ? (item.domain || "Login") :
                      template === "card" ? (item.domain || "•••• ••••") :
                      template === "note" ? "Secure note" :
                      template === "profile" ? "Identity profile" :
                      template === "address" ? "Saved address" : "";
                    return (
                      <PressableScale
                        key={item.id}
                        style={styles.favGridCard}
                        onPress={() => navigation.navigate("ItemDetail", { item })}
                      >
                        <View style={styles.favGridCardTop}>
                          <SmallIconBadge item={item} />
                          <Star size={16} color={colors.warning} fill={colors.warning} />
                        </View>
                        <Text style={styles.favGridCardTitle} numberOfLines={1}>{item.name}</Text>
                        {subLine ? (
                          <Text style={styles.favGridCardSub} numberOfLines={1}>{subLine}</Text>
                        ) : null}
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Recent Items in Landscape */}
            {recentItems.length > 0 && (
              <View style={styles.landscapeSection}>
                <Text style={styles.sectionLabel}>RECENT ITEMS</Text>
                <View style={styles.listCard}>
                  {recentItems.map((item, idx, arr) => {
                    const template = item.template || "login";
                    const subLine =
                      template === "login" ? (item.domain || "Login") :
                      template === "card" ? (item.domain || "•••• ••••") :
                      template === "note" ? "Secure note" :
                      template === "profile" ? "Identity profile" :
                      template === "address" ? "Saved address" : "";
                    const isLast = idx === arr.length - 1;
                    return (
                      <React.Fragment key={item.id}>
                        <PressableScale
                          style={styles.listRow}
                          onPress={() => navigation.navigate("ItemDetail", { item })}
                        >
                          <View style={styles.listRowIcon}>
                            <SmallIconBadge item={item} />
                          </View>
                          <View style={styles.listRowContent}>
                            <Text style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                            {subLine ? <Text style={styles.listRowSub}>{subLine}</Text> : null}
                          </View>
                          <ChevronRight size={15} color="#3f3f46" style={{ marginLeft: 6 }} />
                        </PressableScale>
                        {!isLast && <View style={styles.rowDivider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        /* Portrait Mode: Phone-like hierarchy centered on tablets */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.tabletPortraitScrollContent,
            { paddingBottom: 100 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
          }
        >
          <View style={isTablet ? styles.portraitWrapper : undefined}>
            {isEmpty && (
              /* Empty vault illustration */
              <View style={styles.emptyWrap}>
                <Illustration name="empty_4zx0" width={220} height={180} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>Your vault is empty</Text>
                <Text style={styles.emptyDesc}>Tap + to add your first entry</Text>
              </View>
            )}

            {renderFavoritesSection()}
            {renderTypesSection()}
            {renderFoldersSection()}
            {renderTrashSection()}
            <View style={{ height: 28 }} />
          </View>
        </ScrollView>
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, !isOnline && styles.fabDisabled]}
        onPress={() => {
          if (!isOnline) {
            vaultAlert.alert(
              "Offline Mode",
              "Internet connection is required to create new items. Connect to internet to sync and add entries.",
              undefined,
              { illustration: "clouds_bmtk" }
            );
            return;
          }
          navigation.navigate("ItemForm", {});
        }}
        activeOpacity={0.85}
      >
        <Plus size={24} color={isOnline ? "#09090b" : "#71717a"} strokeWidth={2.4} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  tabletPortraitScrollContent: { paddingTop: 16 },
  portraitWrapper: {
    maxWidth: 580,
    width: "100%",
    alignSelf: "center",
  },
  landscapeScrollContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    gap: 20,
  },
  landscapeLeftPane: {
    width: 320,
    gap: 16,
  },
  landscapeRightPane: {
    flex: 1,
    gap: 16,
  },

  // ── Landscape Stats & Quick Action Hub ──
  landscapeStatsCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  statsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  securityPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34d399",
  },
  landscapeAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  landscapeAddBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#09090b",
  },
  statsNumbersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 4,
  },
  statBox: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "monospace",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#71717a",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#1f1f23",
  },

  // ── Landscape Favourites Grid ──
  landscapeSection: {
    gap: 8,
  },
  landscapeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 4,
  },
  favGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  favGridCard: {
    width: "48.5%",
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1c1c1e",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  favGridCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  favGridCardTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#f4f4f5",
  },
  favGridCardSub: {
    fontSize: 11.5,
    color: "#71717a",
    fontFamily: "monospace",
  },

  // ── Offline Banner ──
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 158, 11, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  offlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#f59e0b",
  },
  offlineBannerText: {
    fontSize: 12,
    color: "#fcd34d",
    fontWeight: "500",
  },
  retryBtn: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fbbf24",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  headerBrandLogo: {
    height: 26,
    width: 112,
    opacity: 1,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerIconOnlyBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
  },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 13, fontWeight: "700", color: "#ffffff" },

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
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  smallIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#1c1c1e",
  },
  viewAllText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
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

  // ── FAB (Circular) ──
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabDisabled: {
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    opacity: 0.7,
  },
});
