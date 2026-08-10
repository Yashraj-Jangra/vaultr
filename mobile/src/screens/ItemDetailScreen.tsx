import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Linking,
} from "react-native";
import { vaultAlert } from "../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import * as Clipboard from "expo-clipboard";
import { SiteIcon } from "../components/SiteIcon";
import { TotpCode } from "../components/TotpCode";
import { colors } from "../theme/colors";
import { ItemPreviewCard } from "../components/ItemPreviewCard";
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Edit2,
  Lock,
  Globe,
  User,
  Key,
  FileText,
  ShieldCheck,
  Star,
  Trash2,
  ExternalLink,
  CreditCard,
} from "lucide-react-native";

type Props = StackScreenProps<RootStackParamList, "ItemDetail">;

export function ItemDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { decryptItemBlob, toggleFavorite, trashItem } = useVaultStore();

  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await decryptItemBlob(item.encryptedBlob);
        if (mounted) {
          setPayload(JSON.parse(raw));
        }
      } catch (err) {
        if (mounted) {
          vaultAlert.alert("Decryption Failed", "Could not decrypt this item's payload.", undefined, { illustration: "cancel_k4w9" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [item.encryptedBlob]);

  const copyToClipboard = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleLaunchUrl = (targetUrl?: string) => {
    if (!targetUrl) return;
    let formatted = targetUrl;
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = "https://" + formatted;
    }
    Linking.openURL(formatted).catch(() => {
      vaultAlert.alert("Error", `Could not open URL: ${formatted}`, undefined, { illustration: "cancel_k4w9" });
    });
  };

  const handleMoveToTrash = () => {
    vaultAlert.alert(
      "Move to Trash",
      `Are you sure you want to move "${item.name}" to Trash?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: async () => {
            await trashItem(item.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.navTitle} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.navRight}>
          <TouchableOpacity
            style={styles.navActionBtn}
            onPress={() => toggleFavorite(item.id)}
          >
            <Star
              size={20}
              color={item.favorite ? colors.warning : colors.textMuted}
              fill={item.favorite ? colors.warning : "none"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navActionBtn}
            onPress={() => navigation.navigate("ItemForm", { item })}
          >
            <Edit2 size={20} color={colors.accent} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.trashNavBtn} onPress={handleMoveToTrash}>
            <Trash2 size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Decrypting payload...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Dynamic Live Preview Canvas */}
          <View style={{ marginBottom: 4 }}>
            <ItemPreviewCard
              template={item.template || "login"}
              name={item.name}
              username={payload?.username}
              url={payload?.url || item.domain}
              domain={item.domain || payload?.url}
              cardholderName={payload?.cardholderName || payload?.cardName}
              cardName={payload?.cardName || payload?.cardholderName}
              cardNumber={payload?.cardNumber}
              isNumberVisible={showPassword}
              expMonth={payload?.expMonth}
              expYear={payload?.expYear}
              expiry={payload?.expiry}
              cvv={payload?.cvv}
              cardBrand={payload?.cardBrand}
              street={payload?.street || payload?.line1}
              line2={payload?.line2}
              city={payload?.city}
              state={payload?.state}
              zip={payload?.zip}
              country={payload?.country}
              fullName={
                payload?.fullName ||
                (payload?.firstName && payload?.lastName
                  ? `${payload.firstName} ${payload.lastName}`
                  : payload?.firstName || payload?.lastName)
              }
              email={payload?.email}
              phone={payload?.phone}
              note={payload?.note}
            />
          </View>

          {/* Header Badge Card */}
          <View style={styles.badgeCard}>
            <View style={styles.badgeCardHeader}>
              <SiteIcon
                domain={item.domain}
                name={item.name}
                url={payload?.url || item.domain}
                template={item.template || "login"}
                size={44}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.templatePill}>
                    <Text style={styles.templatePillText}>
                      {(item.template || "login").toUpperCase()}
                    </Text>
                  </View>
                  {item.folder ? (
                    <Text style={styles.folderText}>{item.folder}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {(payload?.url || item.domain) && (
              <TouchableOpacity
                style={styles.launchBtn}
                onPress={() => handleLaunchUrl(payload?.url || item.domain)}
              >
                <ExternalLink size={16} color={colors.bg} />
                <Text style={styles.launchBtnText}>Launch Website</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Live 2FA TOTP Code */}
          {payload && (payload.totpSecret || payload.totp_secret) ? (
            <TotpCode secret={payload.totpSecret || payload.totp_secret} name={item.name} />
          ) : null}

          {/* Fields List */}
          {payload && (
            <View style={styles.fieldsGroup}>
              {/* Username */}
              {payload.username ? (
                <DetailRow
                  icon={<User size={16} color={colors.textMuted} />}
                  label="Username / Email"
                  value={payload.username}
                  onCopy={() => copyToClipboard("username", payload.username)}
                  isCopied={copiedField === "username"}
                />
              ) : null}

              {/* Password */}
              {payload.password ? (
                <DetailRow
                  icon={<Key size={16} color={colors.textMuted} />}
                  label="Password"
                  value={showPassword ? payload.password : "••••••••••••"}
                  onCopy={() => copyToClipboard("password", payload.password)}
                  isCopied={copiedField === "password"}
                  onToggleShow={() => setShowPassword(!showPassword)}
                  isPassword
                  showPassword={showPassword}
                />
              ) : null}

              {/* URL */}
              {payload.url || item.domain ? (
                <DetailRow
                  icon={<Globe size={16} color={colors.textMuted} />}
                  label="Website URL"
                  value={payload.url || item.domain}
                  onCopy={() =>
                    copyToClipboard("url", payload.url || item.domain)
                  }
                  isCopied={copiedField === "url"}
                />
              ) : null}

              {/* Card Template Fields */}
              {payload.cardholderName ? (
                <DetailRow
                  icon={<User size={16} color={colors.textMuted} />}
                  label="Cardholder Name"
                  value={payload.cardholderName}
                  onCopy={() => copyToClipboard("cardholderName", payload.cardholderName)}
                  isCopied={copiedField === "cardholderName"}
                />
              ) : null}

              {payload.cardNumber ? (
                <DetailRow
                  icon={<CreditCard size={16} color={colors.cardBlue} />}
                  label="Card Number"
                  value={
                    showPassword
                      ? (() => {
                          const clean = payload.cardNumber.replace(/\D/g, "");
                          if (!clean) return payload.cardNumber;
                          const groups = clean.length === 15 ? [4, 6, 5] : [4, 4, 4, 4];
                          const parts: string[] = [];
                          let idx = 0;
                          for (const g of groups) {
                            if (idx >= clean.length) break;
                            parts.push(clean.slice(idx, idx + g));
                            idx += g;
                          }
                          if (idx < clean.length) parts.push(clean.slice(idx));
                          return parts.join(" ");
                        })()
                      : (payload.cardNumber.replace(/\D/g, "").length >= 4
                          ? "•••• •••• •••• " + payload.cardNumber.replace(/\D/g, "").slice(-4)
                          : "•••• •••• •••• ••••")
                  }
                  onCopy={() => copyToClipboard("cardNumber", payload.cardNumber)}
                  isCopied={copiedField === "cardNumber"}
                  onToggleShow={() => setShowPassword(!showPassword)}
                  isPassword
                  showPassword={showPassword}
                />
              ) : null}

              {payload.expMonth || payload.expYear ? (
                <DetailRow
                  icon={<CreditCard size={16} color={colors.textMuted} />}
                  label="Expiry Date"
                  value={`${payload.expMonth || "MM"}/${payload.expYear || "YY"}`}
                  onCopy={() => copyToClipboard("exp", `${payload.expMonth}/${payload.expYear}`)}
                  isCopied={copiedField === "exp"}
                />
              ) : null}

              {payload.cvv ? (
                <DetailRow
                  icon={<Lock size={16} color={colors.textMuted} />}
                  label="CVV / Security Code"
                  value={showPassword ? payload.cvv : "•••"}
                  onCopy={() => copyToClipboard("cvv", payload.cvv)}
                  isCopied={copiedField === "cvv"}
                  onToggleShow={() => setShowPassword(!showPassword)}
                  isPassword
                  showPassword={showPassword}
                />
              ) : null}

              {/* Address Template Fields */}
              {payload.street ? (
                <DetailRow
                  icon={<FileText size={16} color={colors.textMuted} />}
                  label="Street Address"
                  value={payload.street}
                  onCopy={() => copyToClipboard("street", payload.street)}
                  isCopied={copiedField === "street"}
                />
              ) : null}

              {payload.city || payload.state || payload.zip ? (
                <DetailRow
                  icon={<FileText size={16} color={colors.textMuted} />}
                  label="City, State & ZIP"
                  value={[payload.city, payload.state, payload.zip].filter(Boolean).join(", ")}
                  onCopy={() => copyToClipboard("cityState", [payload.city, payload.state, payload.zip].filter(Boolean).join(", "))}
                  isCopied={copiedField === "cityState"}
                />
              ) : null}

              {payload.country ? (
                <DetailRow
                  icon={<Globe size={16} color={colors.textMuted} />}
                  label="Country"
                  value={payload.country}
                  onCopy={() => copyToClipboard("country", payload.country)}
                  isCopied={copiedField === "country"}
                />
              ) : null}

              {/* Profile Template Fields */}
              {payload.firstName || payload.lastName ? (
                <DetailRow
                  icon={<User size={16} color={colors.textMuted} />}
                  label="Full Name"
                  value={`${payload.firstName || ""} ${payload.lastName || ""}`.trim()}
                  onCopy={() => copyToClipboard("fullName", `${payload.firstName || ""} ${payload.lastName || ""}`.trim())}
                  isCopied={copiedField === "fullName"}
                />
              ) : null}

              {payload.email ? (
                <DetailRow
                  icon={<User size={16} color={colors.textMuted} />}
                  label="Email Address"
                  value={payload.email}
                  onCopy={() => copyToClipboard("email", payload.email)}
                  isCopied={copiedField === "email"}
                />
              ) : null}

              {payload.phone ? (
                <DetailRow
                  icon={<User size={16} color={colors.textMuted} />}
                  label="Phone Number"
                  value={payload.phone}
                  onCopy={() => copyToClipboard("phone", payload.phone)}
                  isCopied={copiedField === "phone"}
                />
              ) : null}

              {/* Note Content */}
              {payload.note ? (
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Note Content</Text>
                  <Text style={styles.noteText}>{payload.note}</Text>
                </View>
              ) : null}

              {/* Private Entry Notes */}
              {payload.entryNotes ? (
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Private Notes</Text>
                  <Text style={styles.noteText}>{payload.entryNotes}</Text>
                </View>
              ) : null}

              {/* Attachments Section */}
              {payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0 ? (
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>File Attachments ({payload.attachments.length})</Text>
                  <View style={{ gap: 8, marginTop: 6 }}>
                    {payload.attachments.map((att: any, idx: number) => (
                      <TouchableOpacity
                        key={att.id || idx}
                        style={styles.attachDetailRow}
                        onPress={() => {
                          if (att.uri) {
                            Linking.openURL(att.uri).catch(() => vaultAlert.alert("Notice", "Cannot preview file. File URI is local or encrypted.", undefined, { illustration: "cancel_k4w9" }));
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <FileText size={16} color="#60a5fa" />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.attachDetailName} numberOfLines={1}>{att.name}</Text>
                          <Text style={styles.attachDetailSize}>
                            {att.size ? (att.size / 1024).toFixed(1) + " KB" : "Encrypted Attachment"}
                          </Text>
                        </View>
                        <ExternalLink size={14} color="#71717a" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.footerNote}>
            <ShieldCheck size={14} color={colors.textDim} />
            <Text style={styles.footerNoteText}>
              Decrypted securely in memory on device
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onCopy,
  isCopied,
  isPassword,
  showPassword,
  onToggleShow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy: () => void;
  isCopied: boolean;
  isPassword?: boolean;
  showPassword?: boolean;
  onToggleShow?: () => void;
}) {
  return (
    <View style={styles.fieldBox}>
      <View style={styles.fieldContent}>
        <View style={styles.fieldHeaderLeft}>
          {icon}
          <Text style={styles.fieldLabel}>{label}</Text>
        </View>
        <Text style={styles.fieldValue} selectable>
          {value}
        </Text>
      </View>
      <View style={styles.fieldHeaderActions}>
        {isPassword && onToggleShow && (
          <TouchableOpacity style={styles.actionBtn} onPress={onToggleShow}>
            {showPassword ? (
              <EyeOff size={20} color={colors.textMuted} />
            ) : (
              <Eye size={20} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
          {isCopied ? (
            <Check size={20} color={colors.success} />
          ) : (
            <Copy size={20} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  trashNavBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.dangerBg,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  badgeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  badgeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  templatePill: {
    backgroundColor: colors.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  templatePillText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
  },
  folderText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  launchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  launchBtnText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldsGroup: {
    gap: 10,
  },
  fieldBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldContent: {
    flex: 1,
    paddingRight: 8,
  },
  fieldHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  fieldHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attachDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 10,
    padding: 10,
  },
  attachDetailName: { fontSize: 13, color: "#f4f4f5", fontWeight: "500" },
  attachDetailSize: { fontSize: 11, color: "#71717a", fontFamily: "monospace", marginTop: 2 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  actionBtn: {
    padding: 6,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "monospace",
  },
  noteText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.textDim,
  },
});
