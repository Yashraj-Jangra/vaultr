import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { vaultAlert } from "../../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import {
  Monitor,
  Smartphone,
  Globe,
  Trash2,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Clock,
  LogIn,
} from "lucide-react-native";

export interface SessionWithMeta {
  sessionId: string;
  isCurrent: boolean;
  deviceName: string;
  browser: string;
  os: string;
  isMobile?: boolean;
  clientType?: "mobile_app" | "mobile_browser" | "desktop_web";
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  expiresAt: string;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Just now";
  try {
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return "Just now";
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Recent";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SessionsScreen({ navigation }: any) {
  const { serverUrl, accountToken } = useVaultStore();

  const [sessions, setSessions] = useState<SessionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const cleanUrl = (serverUrl || "").replace(/\/+$/, "");

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "VaultrMobile/1.0 (Android)",
    };
    if (accountToken) {
      headers["Authorization"] = `Bearer ${accountToken}`;
      headers["Cookie"] = `better-auth.session_token=${accountToken}`;
    }
    return headers;
  }, [accountToken]);

  const fetchSessions = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${cleanUrl}/api/settings/sessions`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      } else {
        setSessions([
          {
            sessionId: "current_session",
            deviceName: "Vaultr Mobile App (Android)",
            browser: "Vaultr Mobile App",
            os: "Android",
            isCurrent: true,
            isMobile: true,
            clientType: "mobile_app",
            ipAddress: "Connected Device",
            country: null,
            city: null,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
          },
        ]);
      }
    } catch (err) {
      setSessions([
        {
          sessionId: "current_session",
          deviceName: "Vaultr Mobile App (Android)",
          browser: "Vaultr Mobile App",
          os: "Android",
          isCurrent: true,
          isMobile: true,
          clientType: "mobile_app",
          ipAddress: "Connected Device",
          country: null,
          city: null,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions(false);
  };

  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    vaultAlert.alert(
      "Revoke Session",
      `Are you sure you want to sign out ${deviceName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            setRevokingId(sessionId);
            try {
              const res = await fetch(`${cleanUrl}/api/settings/sessions/${sessionId}`, {
                method: "DELETE",
                headers: getHeaders(),
              });
              if (res.ok) {
                setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
              } else {
                const data = await res.json().catch(() => ({}));
                vaultAlert.alert("Error", data.error || "Failed to revoke session.", undefined, { illustration: "cancel_k4w9" });
              }
            } catch (err: any) {
              vaultAlert.alert("Error", err?.message || "Network error revoking session.", undefined, { illustration: "cancel_k4w9" });
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  const handleRevokeAllOther = () => {
    const otherCount = sessions.filter((s) => !s.isCurrent).length;
    if (otherCount === 0) return;

    vaultAlert.alert(
      "Sign Out All Other Devices",
      `Are you sure you want to sign out ${otherCount} other active device session${otherCount > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out All",
          style: "destructive",
          onPress: async () => {
            setRevokingAll(true);
            try {
              const res = await fetch(`${cleanUrl}/api/settings/sessions`, {
                method: "DELETE",
                headers: getHeaders(),
              });
              if (res.ok) {
                setSessions((prev) => prev.filter((s) => s.isCurrent));
                vaultAlert.alert("Sessions Revoked", "All other device sessions have been logged out.", undefined, { illustration: "completed-task_c11d" });
              } else {
                const data = await res.json().catch(() => ({}));
                vaultAlert.alert("Error", data.error || "Failed to revoke all sessions.", undefined, { illustration: "cancel_k4w9" });
              }
            } catch (err: any) {
              vaultAlert.alert("Error", err?.message || "Network error.", undefined, { illustration: "cancel_k4w9" });
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ]
    );
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentSession = sessions.find((s) => s.isCurrent);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Sessions & Devices</Text>

        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchSessions(true)} disabled={loading}>
          <RefreshCw size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Fetching active sessions…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          {/* Banner */}
          <View style={styles.infoBanner}>
            <ShieldAlert size={20} color={colors.accent} />
            <Text style={styles.infoBannerText}>
              All active sessions for your account. Sessions idle for more than 14 days are automatically removed.
            </Text>
          </View>

          {/* Bulk Revoke Header */}
          {otherSessions.length > 0 && (
            <View style={styles.bulkRow}>
              <Text style={styles.sectionHeader}>ACTIVE SESSIONS ({sessions.length})</Text>
              <TouchableOpacity
                style={styles.revokeAllBtn}
                onPress={handleRevokeAllOther}
                disabled={revokingAll}
              >
                {revokingAll ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Trash2 size={14} color={colors.danger} />
                    <Text style={styles.revokeAllText}>Sign out all other ({otherSessions.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Sessions List */}
          <View style={styles.sessionList}>
            {sessions.map((s) => {
              const location = [s.city, s.country].filter(Boolean).join(", ");
              const isMobileApp = s.clientType === "mobile_app" || (s.browser || "").toLowerCase().includes("vaultr mobile") || (s.deviceName || "").toLowerCase().includes("vaultr mobile");
              const isMobile = s.isMobile || isMobileApp || (s.os || "").toLowerCase().includes("android") || (s.os || "").toLowerCase().includes("iphone") || (s.os || "").toLowerCase().includes("mobile");

              const isRevokingThis = revokingId === s.sessionId;

              return (
                <View
                  key={s.sessionId}
                  style={[
                    styles.sessionCard,
                    s.isCurrent && styles.currentCardBorder,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    {/* Device Icon */}
                    <View
                      style={[
                        styles.iconCircle,
                        s.isCurrent
                          ? styles.iconCircleCurrent
                          : isMobileApp
                          ? styles.iconCircleMobileApp
                          : isMobile
                          ? styles.iconCircleMobileWeb
                          : styles.iconCircleDesktop,
                      ]}
                    >
                      {isMobile ? (
                        <Smartphone
                          size={20}
                          color={
                            s.isCurrent
                              ? "#34d399"
                              : isMobileApp
                              ? "#c084fc"
                              : "#fbbf24"
                          }
                        />
                      ) : (
                        <Monitor
                          size={20}
                          color={s.isCurrent ? "#34d399" : "#a1a1aa"}
                        />
                      )}
                    </View>

                    {/* Main Title & Badges */}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deviceName, s.isCurrent && styles.deviceNameCurrent]} numberOfLines={1}>
                        {s.deviceName || "Unknown Device"}
                      </Text>

                      <View style={styles.badgeRow}>
                        {s.isCurrent && (
                          <View style={styles.currentBadge}>
                            <ShieldCheck size={10} color="#34d399" />
                            <Text style={styles.currentBadgeText}>THIS DEVICE</Text>
                          </View>
                        )}
                        {isMobileApp ? (
                          <View style={styles.appBadge}>
                            <Smartphone size={10} color="#c084fc" />
                            <Text style={styles.appBadgeText}>MOBILE APP</Text>
                          </View>
                        ) : isMobile ? (
                          <View style={styles.mobileBadge}>
                            <Smartphone size={10} color="#fbbf24" />
                            <Text style={styles.mobileBadgeText}>MOBILE BROWSER</Text>
                          </View>
                        ) : (
                          <View style={styles.desktopBadge}>
                            <Monitor size={10} color="#a1a1aa" />
                            <Text style={styles.desktopBadgeText}>DESKTOP WEB</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Revoke Action */}
                    {!s.isCurrent && (
                      <TouchableOpacity
                        style={styles.revokeBtn}
                        onPress={() => handleRevokeSession(s.sessionId, s.deviceName)}
                        disabled={isRevokingThis}
                      >
                        {isRevokingThis ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Trash2 size={16} color={colors.danger} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Metadata Rows */}
                  <View style={styles.metaRowContainer}>
                    {s.ipAddress && (
                      <View style={styles.metaRow}>
                        <Globe size={13} color="#71717a" />
                        <Text style={styles.metaTextIp}>{s.ipAddress}</Text>
                      </View>
                    )}

                    {location ? (
                      <View style={styles.metaRow}>
                        <MapPin size={13} color="#71717a" />
                        <Text style={styles.metaText}>{location}</Text>
                      </View>
                    ) : null}

                    <View style={styles.metaRowDual}>
                      <View style={styles.metaRow}>
                        <LogIn size={13} color="#71717a" />
                        <Text style={styles.metaText}>Signed in {formatDate(s.createdAt)}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Clock size={13} color="#71717a" />
                        <Text style={styles.metaText}>Active {formatRelativeTime(s.lastActiveAt || s.createdAt)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  refreshBtn: {
    padding: 6,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  infoBannerText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textDim,
  },
  revokeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
  },
  revokeAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.danger,
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  currentCardBorder: {
    borderColor: "rgba(6, 95, 70, 0.6)",
    backgroundColor: "rgba(6, 78, 59, 0.15)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleCurrent: {
    backgroundColor: "rgba(6, 95, 70, 0.4)",
  },
  iconCircleMobileApp: {
    backgroundColor: "rgba(88, 28, 135, 0.4)",
  },
  iconCircleMobileWeb: {
    backgroundColor: "rgba(120, 53, 15, 0.4)",
  },
  iconCircleDesktop: {
    backgroundColor: colors.surface2,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  deviceNameCurrent: {
    color: "#a7f3d0",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(6, 95, 70, 0.5)",
    borderColor: "rgba(6, 95, 70, 0.6)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: "#34d399",
    fontSize: 9,
    fontWeight: "700",
  },
  appBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(88, 28, 135, 0.5)",
    borderColor: "rgba(107, 33, 168, 0.5)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  appBadgeText: {
    color: "#c084fc",
    fontSize: 9,
    fontWeight: "700",
  },
  mobileBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(120, 53, 15, 0.5)",
    borderColor: "rgba(146, 64, 14, 0.5)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mobileBadgeText: {
    color: "#fbbf24",
    fontSize: 9,
    fontWeight: "700",
  },
  desktopBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#18181b",
    borderColor: "#27272a",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  desktopBadgeText: {
    color: "#a1a1aa",
    fontSize: 9,
    fontWeight: "700",
  },
  revokeBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerBg,
  },
  metaRowContainer: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaRowDual: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaTextIp: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.textDim,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
