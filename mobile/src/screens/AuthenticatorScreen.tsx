import React, { useEffect, useState } from "react";
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

export function AuthenticatorScreen() {
  const navigation = useNavigation<any>();
  const { items, decryptItemBlob, updateItem } = useVaultStore();

  const totpItems = items.filter((i) => i.hasTotp && !i.deletedAt);
  const availableLoginItems = items.filter((i) => (!i.template || i.template === "login") && !i.deletedAt);

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

  // Filter existing logins by search query
  const filteredLogins = availableLoginItems.filter((i) => {
    if (!assignSearchQuery.trim()) return true;
    const q = assignSearchQuery.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.domain && i.domain.toLowerCase().includes(q));
  });

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
                <KeyRound size={20} color="#38bdf8" />
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
                value={manualSecretInput}
                onChangeText={setManualSecretInput}
                autoCapitalize="characters"
                autoCorrect={false}
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

            {/* Create New Item Option */}
            <TouchableOpacity
              style={styles.createNewBtnCard}
              onPress={handleCreateNewItem}
              activeOpacity={0.8}
            >
              <View style={styles.createBtnLeft}>
                <ShieldCheck size={18} color="#09090b" />
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

            {/* List of Existing Logins */}
            <ScrollView style={styles.loginsScrollView} keyboardShouldPersistTaps="handled">
              {filteredLogins.length === 0 ? (
                <View style={styles.emptyLoginsBox}>
                  <Text style={styles.emptyLoginsText}>No matching logins found</Text>
                </View>
              ) : (
                filteredLogins.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.loginTargetRow}
                    onPress={() => handleAttachToExistingItem(item)}
                    disabled={assigning}
                    activeOpacity={0.7}
                  >
                    <View style={styles.loginRowIcon}>
                      <Lock size={16} color="#fafafa" />
                    </View>
                    <View style={styles.loginRowMeta}>
                      <Text style={styles.loginRowTitle} numberOfLines={1}>{item.name}</Text>
                      {item.hasTotp && (
                        <Text style={styles.loginRowSubWarning}>Will overwrite existing 2FA key</Text>
                      )}
                    </View>
                    {assigning ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <ChevronRight size={16} color="#52525b" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fafafa",
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: "#27272a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a1a1aa",
  },
  addBtnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  addBtnHeaderText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#fafafa",
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  cardLoading: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardFallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  subtext: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 4,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
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
  emptyCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fafafa",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyCtaBtnText: {
    color: "#09090b",
    fontSize: 13.5,
    fontWeight: "700",
  },
  // Modal Backdrops & Cards
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  optionsModalCard: {
    backgroundColor: "#09090b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    gap: 12,
  },
  manualModalCard: {
    backgroundColor: "#09090b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    gap: 16,
  },
  assignModalCard: {
    backgroundColor: "#09090b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    maxHeight: "82%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fafafa",
  },
  secretBadgeText: {
    fontSize: 11.5,
    color: colors.accent,
    marginTop: 2,
    fontFamily: "monospace",
  },
  closeBtn: {
    padding: 4,
  },
  optionRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272a",
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
  },
  optionTitle: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "600",
  },
  optionSub: {
    color: "#a1a1aa",
    fontSize: 12,
    marginTop: 2,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#a1a1aa",
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
  loginsScrollView: {
    maxHeight: 240,
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
    padding: 12,
    marginBottom: 8,
  },
  loginRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  loginRowMeta: {
    flex: 1,
  },
  loginRowTitle: {
    color: "#fafafa",
    fontSize: 13.5,
    fontWeight: "600",
  },
  loginRowSubWarning: {
    color: "#f59e0b",
    fontSize: 11,
    marginTop: 1.5,
  },
});
