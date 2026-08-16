import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useVaultStore } from "../store/vaultStore";
import { vaultAlert } from "../store/alertStore";
import { TotpCode } from "../components/TotpCode";
import { SiteIcon } from "../components/SiteIcon";
import { colors } from "../theme/colors";
import {
  KeyRound,
  Plus,
  Edit3,
  X,
  Search,
  Lock,
  ChevronRight,
  ShieldCheck,
  Scan,
} from "lucide-react-native";
import { Illustration } from "../components/Illustration";
import { QrScannerModal } from "../components/QrScannerModal";
import { parseOtpAuthUri, ParsedOtpAuth } from "../utils/otpauth";

function AuthenticatorItemRow({ item }: { item: any }) {
  const { decryptItemBlob } = useVaultStore();
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await decryptItemBlob(item.encryptedBlob);
        const p = JSON.parse(raw);
        if (mounted && (p.totpSecret || p.totp_secret)) {
          setTotpSecret(p.totpSecret || p.totp_secret);
        }
      } catch {
        // failed to decrypt
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [item.encryptedBlob]);

  if (loading) {
    return (
      <View style={styles.cardLoading}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Decrypting 2FA seed for {item.name}...</Text>
      </View>
    );
  }

  if (!totpSecret) {
    return (
      <View style={styles.cardFallback}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.subtext}>No TOTP secret string stored in payload</Text>
      </View>
    );
  }

  return <TotpCode secret={totpSecret} name={item.name} domain={item.domain} />;
}

// Global cache for decrypted usernames in assign modal to avoid repeated decrypts
const usernameCache = new Map<string, string>();

const AssignLoginRow = React.memo(function AssignLoginRow({
  item,
  onPress,
  disabled,
}: {
  item: any;
  onPress: () => void;
  disabled: boolean;
}) {
  const { decryptItemBlob } = useVaultStore();
  const [username, setUsername] = useState<string>(usernameCache.get(item.id) || "");

  useEffect(() => {
    if (usernameCache.has(item.id)) {
      setUsername(usernameCache.get(item.id)!);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const raw = await decryptItemBlob(item.encryptedBlob);
        const p = JSON.parse(raw);
        const user = p.username || p.email || p.user || "";
        if (user) {
          usernameCache.set(item.id, user);
          if (mounted) setUsername(user);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [item.id, item.encryptedBlob]);

  return (
    <TouchableOpacity
      style={styles.loginTargetRow}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.loginRowIcon}>
        <SiteIcon domain={item.domain} name={item.name} size={32} />
      </View>
      <View style={styles.loginRowMeta}>
        <Text style={styles.loginRowTitle} numberOfLines={1}>
          {item.name}
        </Text>
        {username ? (
          <Text style={styles.loginRowUsername} numberOfLines={1}>
            {username}
          </Text>
        ) : item.domain ? (
          <Text style={styles.loginRowUsername} numberOfLines={1}>
            {item.domain}
          </Text>
        ) : null}
        {item.hasTotp && (
          <Text style={styles.loginRowSubWarning}>Will overwrite existing 2FA key</Text>
        )}
      </View>
      <ChevronRight size={16} color="#52525b" />
    </TouchableOpacity>
  );
});

export function AuthenticatorScreen() {
  const navigation = useNavigation<any>();
  const { items, decryptItemBlob, updateItem } = useVaultStore();

  const totpItems = items.filter((i) => i.hasTotp && !i.deletedAt);
  const availableLoginItems = useMemo(
    () => items.filter((i) => (!i.template || i.template === "login") && !i.deletedAt),
    [items]
  );

  // Modals state
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Draft TOTP secret state
  const [pendingSecret, setPendingSecret] = useState<ParsedOtpAuth | null>(null);
  const [manualSecretInput, setManualSecretInput] = useState("");
  const [manualLabelInput, setManualLabelInput] = useState("");

  // Assign modal search
  const [assignSearchQuery, setAssignSearchQuery] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Handle scanned result from QR code camera
  const handleQrScanResult = (parsed: ParsedOtpAuth) => {
    setPendingSecret(parsed);
    setShowOptionsModal(false);
    setShowAssignModal(true);
  };

  // Handle manual input submit
  const handleManualSubmit = () => {
    const parsed = parseOtpAuthUri(manualSecretInput);
    if (!parsed) {
      vaultAlert.alert(
        "Invalid 2FA Secret Key",
        "Please enter a valid Base32 secret key (e.g. JBSWY3DPEHPK3PXP).",
        undefined,
        { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.12)" }
      );
      return;
    }

    setPendingSecret({
      secret: parsed.secret,
      issuer: manualLabelInput.trim() || parsed.issuer,
      label: manualLabelInput.trim() || parsed.label,
    });
    setShowManualModal(false);
    setManualSecretInput("");
    setManualLabelInput("");
    setShowAssignModal(true);
  };

  // Choice A: Create New Login Entry
  const handleCreateNewItem = () => {
    setShowAssignModal(false);
    navigation.navigate("ItemForm", {
      initialTemplate: "login",
      initialTotpSecret: pendingSecret?.secret || "",
      initialName: pendingSecret?.issuer || pendingSecret?.label || "2FA Account",
    });
    setPendingSecret(null);
  };

  // Choice B: Attach 2FA secret to existing login item
  const handleAttachToExistingItem = async (targetItem: any) => {
    if (!pendingSecret || assigning) return;
    setAssigning(true);

    try {
      // 1. Decrypt target item payload
      const raw = await decryptItemBlob(targetItem.encryptedBlob);
      const unencryptedPayload = JSON.parse(raw);

      // 2. Attach single TOTP secret
      unencryptedPayload.totpSecret = pendingSecret.secret;

      // 3. Update item in store (re-encrypts payload automatically)
      await updateItem(targetItem.id, {
        unencryptedPayload,
        hasTotp: true,
      });

      setShowAssignModal(false);
      setPendingSecret(null);

      vaultAlert.alert(
        "2FA Token Enrolled",
        `Successfully linked 2FA authenticator key to "${targetItem.name}".`,
        undefined,
        { illustration: "security-on_3ykb", glowColor: "rgba(52, 211, 153, 0.12)" }
      );
    } catch (err: any) {
      vaultAlert.alert(
        "Failed to Attach 2FA Key",
        err?.message || "Could not update item payload.",
        undefined,
        { illustration: "cancel_k4w9", glowColor: "rgba(239, 68, 68, 0.12)" }
      );
    } finally {
      setAssigning(false);
    }
  };

  // Filter existing logins by search query (memoized to eliminate typing lag)
  const filteredLogins = useMemo(() => {
    if (!assignSearchQuery.trim()) return availableLoginItems;
    const q = assignSearchQuery.toLowerCase();
    return availableLoginItems.filter((i) => {
      const matchName = i.name.toLowerCase().includes(q);
      const matchDomain = i.domain && i.domain.toLowerCase().includes(q);
      const cachedUser = usernameCache.get(i.id);
      const matchUser = cachedUser && cachedUser.toLowerCase().includes(q);
      return matchName || matchDomain || matchUser;
    });
  }, [availableLoginItems, assignSearchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <KeyRound size={20} color="#fafafa" />
          <Text style={styles.headerTitle}>Authenticator</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{totpItems.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtnHeader}
          onPress={() => setShowOptionsModal(true)}
          activeOpacity={0.8}
        >
          <Plus size={15} color="#fafafa" />
          <Text style={styles.addBtnHeaderText}>Add 2FA</Text>
        </TouchableOpacity>
      </View>

      {/* 2FA Items List */}
      <FlatList
        data={totpItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => <AuthenticatorItemRow item={item} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Illustration
              name="two-factor-authentication_ofho"
              width={240}
              height={180}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.emptyTitle}>No TOTP Tokens Enrolled</Text>
            <Text style={styles.emptyDesc}>
              Scan a 2FA QR code or enter your secret key manually to generate live 30-second verification codes.
            </Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => setShowOptionsModal(true)}
              activeOpacity={0.85}
            >
              <KeyRound size={16} color="#09090b" />
              <Text style={styles.emptyCtaBtnText}>Add 2FA Token</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Floating Scan QR Button (Circular) ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCameraScanner(true)}
        activeOpacity={0.85}
      >
        <Scan size={24} color="#09090b" strokeWidth={2.4} />
      </TouchableOpacity>

      {/* ─── Modal 1: Choose Add Method (Camera QR or Manual) ───────────────── */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowOptionsModal(false)}>
          <Pressable style={styles.optionsModalCard} onPress={(e: any) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add 2FA Secret Key</Text>
              <TouchableOpacity onPress={() => setShowOptionsModal(false)} style={styles.closeBtn}>
                <X size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.optionRowBtn}
              onPress={() => {
                setShowOptionsModal(false);
                setShowCameraScanner(true);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                <Scan size={20} color="#38bdf8" />
              </View>
              <View style={styles.optionTextMeta}>
                <Text style={styles.optionTitle}>Scan QR Code (Camera)</Text>
                <Text style={styles.optionSub}>Scan 2FA QR barcode with your device camera</Text>
              </View>
              <ChevronRight size={18} color="#52525b" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRowBtn}
              onPress={() => {
                setShowOptionsModal(false);
                setShowManualModal(true);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "rgba(168, 85, 247, 0.12)" }]}>
                <Edit3 size={20} color="#c084fc" />
              </View>
              <View style={styles.optionTextMeta}>
                <Text style={styles.optionTitle}>Enter Secret Key Manually</Text>
                <Text style={styles.optionSub}>Type in base32 seed key string directly</Text>
              </View>
              <ChevronRight size={18} color="#52525b" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Camera QR Scanner Modal ────────────────────────────────────────── */}
      <QrScannerModal
        visible={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleQrScanResult}
      />

      {/* ─── Modal 2: Manual Key Entry Form ────────────────────────────────── */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowManualModal(false)}>
          <Pressable style={styles.manualModalCard} onPress={(e: any) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Enter 2FA Key</Text>
              <TouchableOpacity onPress={() => setShowManualModal(false)} style={styles.closeBtn}>
                <X size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>2FA Secret Key</Text>
              <TextInput
                style={[styles.inputBox, { fontFamily: "monospace" }]}
                placeholder="e.g. JBSWY3DPEHPK3PXP"
                placeholderTextColor="#52525b"
                autoCapitalize="characters"
                value={manualSecretInput}
                onChangeText={setManualSecretInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Account / Service Name (Optional)</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="e.g. GitHub, Google, Work Email"
                placeholderTextColor="#52525b"
                value={manualLabelInput}
                onChangeText={setManualLabelInput}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryModalBtn}
              onPress={handleManualSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryModalBtnText}>Continue to Assign Item</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modal 3: Assign Scanned 2FA Key to Vault Item ─────────────────── */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAssignModal(false)}>
          <Pressable style={styles.assignModalCard} onPress={(e: any) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Assign 2FA Key</Text>
                {pendingSecret && (
                  <Text style={styles.secretBadgeText} numberOfLines={1}>
                    Key: {pendingSecret.secret.slice(0, 10)}…
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)} style={styles.closeBtn}>
                <X size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            {/* Create New Item Option with + icon */}
            <TouchableOpacity
              style={styles.createNewBtnCard}
              onPress={handleCreateNewItem}
              activeOpacity={0.8}
            >
              <View style={styles.createBtnLeft}>
                <Plus size={18} color="#09090b" strokeWidth={2.6} />
                <Text style={styles.createNewBtnText}>Create New Login Item</Text>
              </View>
              <ChevronRight size={18} color="#09090b" />
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR ATTACH TO EXISTING ITEM</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Search Input for Existing Items */}
            <View style={styles.searchBox}>
              <Search size={16} color="#71717a" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search existing logins..."
                placeholderTextColor="#71717a"
                value={assignSearchQuery}
                onChangeText={setAssignSearchQuery}
              />
            </View>

            {/* List of Existing Logins (Optimized FlatList with Favicons and Usernames) */}
            <FlatList
              data={filteredLogins}
              keyExtractor={(item) => item.id}
              style={styles.loginsList}
              initialNumToRender={8}
              maxToRenderPerBatch={10}
              windowSize={5}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <AssignLoginRow
                  item={item}
                  onPress={() => handleAttachToExistingItem(item)}
                  disabled={assigning}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyLoginsBox}>
                  <Text style={styles.emptyLoginsText}>No matching logins found</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
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
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    backgroundColor: "#09090b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fafafa",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: "#27272a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "700",
  },
  addBtnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnHeaderText: {
    color: "#fafafa",
    fontSize: 12,
    fontWeight: "600",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  cardLoading: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#71717a",
    fontSize: 12,
  },
  cardFallback: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    padding: 16,
  },
  itemName: {
    color: "#fafafa",
    fontSize: 15,
    fontWeight: "600",
  },
  subtext: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 4,
  },
  emptyBox: {
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#fafafa",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyDesc: {
    color: "#71717a",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fafafa",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaBtnText: {
    color: "#09090b",
    fontSize: 13.5,
    fontWeight: "700",
  },

  // Modal Sheet common
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  optionsModalCard: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  assignModalCard: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 20,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  manualModalCard: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "700",
  },
  secretBadgeText: {
    color: "#38bdf8",
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
    justifyContent: "center",
  },
  optionRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  optionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextMeta: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "600",
  },
  optionSub: {
    color: "#71717a",
    fontSize: 11.5,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
  },
  inputBox: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10.5,
    color: "#fafafa",
    fontSize: 13.5,
  },
  primaryModalBtn: {
    backgroundColor: "#fafafa",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryModalBtnText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "700",
  },
  createNewBtnCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fafafa",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 8,
  },
  createBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  createNewBtnText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#27272a",
  },
  dividerText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    letterSpacing: 0.8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#fafafa",
    fontSize: 13,
  },
  loginsList: {
    maxHeight: 250,
  },
  emptyLoginsBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyLoginsText: {
    color: "#71717a",
    fontSize: 13,
  },
  loginTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  loginRowIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  loginRowMeta: {
    flex: 1,
    minWidth: 0,
  },
  loginRowTitle: {
    color: "#fafafa",
    fontSize: 13.5,
    fontWeight: "600",
  },
  loginRowUsername: {
    color: "#a1a1aa",
    fontSize: 11.5,
    marginTop: 1.5,
    fontFamily: "monospace",
  },
  loginRowSubWarning: {
    color: "#f59e0b",
    fontSize: 10.5,
    marginTop: 1.5,
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
});
