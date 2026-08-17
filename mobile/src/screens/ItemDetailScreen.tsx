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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { copyToClipboardWithAutoClear } from "../services/clipboard";
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
  const rawItem = route.params.item;
  const item = useVaultStore((state) => state.items.find((i) => i.id === rawItem.id)) || rawItem;
  const { isOnline, decryptItemBlob, toggleFavorite, trashItem, fetchAttachments, downloadAndDecryptAttachment, deleteAttachment } = useVaultStore();

  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [serverAttachments, setServerAttachments] = useState<Array<{ id: string; name: string; sizeBytes: number; mimeType: string; createdAt: string }>>([]);

  useEffect(() => {
    let mounted = true;
    if (item.id) {
      fetchAttachments(item.id)
        .then((atts) => {
          if (mounted) setServerAttachments(atts);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [item.id]);

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
    await copyToClipboardWithAutoClear(value);
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

  const handleToggleFavorite = async () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to update favorites.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    try {
      await toggleFavorite(item.id);
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to update favorite.", undefined, { illustration: "cancel_k4w9" });
    }
  };

  const handleEdit = () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to edit items.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    navigation.navigate("ItemForm", { item });
  };

  const handleMoveToTrash = async () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to move items to trash.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    try {
      await trashItem(item.id);
      navigation.goBack();
    } catch (e: any) {
      vaultAlert.alert("Error", e.message || "Failed to move item to trash.", undefined, { illustration: "cancel_k4w9" });
    }
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
            onPress={handleToggleFavorite}
          >
            <Star
              size={20}
              color={item.favorite ? colors.warning : colors.textMuted}
              fill={item.favorite ? colors.warning : "none"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navActionBtn}
            onPress={handleEdit}
          >
            <Edit2 size={20} color={isOnline ? colors.accent : colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.trashNavBtn} onPress={handleMoveToTrash}>
            <Trash2 size={20} color={isOnline ? colors.danger : colors.textMuted} />
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
          {/* Dynamic Live Preview Canvas (Kept as requested) */}
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
                {item.tags && item.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    <Star size={11} color={colors.textMuted} style={{ marginRight: 2 }} />
                    {item.tags.map((t: string, idx: number) => (
                      <View key={idx} style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {item.template !== "card" && (payload?.url || (item.domain && !item.domain.includes("••••"))) ? (
              <TouchableOpacity
                style={styles.launchBtn}
                onPress={() => handleLaunchUrl(payload?.url || item.domain)}
              >
                <ExternalLink size={16} color={colors.bg} />
                <Text style={styles.launchBtnText}>Launch Website</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Live 2FA TOTP Code */}
          {payload && (payload.totpSecret || payload.totp_secret) ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>AUTHENTICATOR</Text>
              <TotpCode secret={payload.totpSecret || payload.totp_secret} name={item.name} />
            </View>
          ) : null}

          {/* Grouped Fields Sections */}
          {payload && (
            <View style={{ gap: 16 }}>
              {/* Credentials Section */}
              {(payload.username || payload.password) && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>LOGIN CREDENTIALS</Text>
                  <View style={styles.sectionGroup}>
                    {payload.username ? (
                      <FieldRow
                        label="Username"
                        value={payload.username}
                        onCopy={() => copyToClipboard("username", payload.username)}
                        isCopied={copiedField === "username"}
                      />
                    ) : null}

                    {payload.password ? (
                      <FieldRow
                        label="Password"
                        value={showPassword ? payload.password : "••••••••••••"}
                        onCopy={() => copyToClipboard("password", payload.password)}
                        isCopied={copiedField === "password"}
                        onToggleShow={() => setShowPassword(!showPassword)}
                        isPassword
                        showPassword={showPassword}
                        hasDivider={false}
                      />
                    ) : null}
                  </View>
                </View>
              )}

              {/* URLs Section */}
              {item.template !== "card" && (payload?.url || (item.domain && !item.domain.includes("••••"))) ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>AUTOFILL / WEBSITE OPTIONS</Text>
                  <View style={styles.sectionGroup}>
                    <FieldRow
                      label="Website (URI)"
                      value={payload?.url || item.domain}
                      onCopy={() => copyToClipboard("url", payload?.url || item.domain)}
                      isCopied={copiedField === "url"}
                      onLaunch={() => handleLaunchUrl(payload?.url || item.domain)}
                      hasDivider={payload?.urls && Array.isArray(payload.urls) && payload.urls.length > 1}
                    />

                    {payload?.urls && Array.isArray(payload.urls) && payload.urls.length > 1 ? (
                      payload.urls.slice(1).map((extraUrl: string, idx: number) => (
                        <FieldRow
                          key={idx}
                          label={`Website (URI #${idx + 2})`}
                          value={extraUrl}
                          onCopy={() => copyToClipboard(`extra_url_${idx}`, extraUrl)}
                          isCopied={copiedField === `extra_url_${idx}`}
                          onLaunch={() => handleLaunchUrl(extraUrl)}
                          hasDivider={idx < payload.urls.length - 2}
                        />
                      ))
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Card Details Section */}
              {(payload.cardholderName || payload.cardNumber) && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>CARD DETAILS</Text>
                  <View style={styles.sectionGroup}>
                    {payload.cardholderName ? (
                      <FieldRow
                        label="Cardholder Name"
                        value={payload.cardholderName}
                        onCopy={() => copyToClipboard("cardholderName", payload.cardholderName)}
                        isCopied={copiedField === "cardholderName"}
                        hasDivider={!!payload.cardNumber}
                      />
                    ) : null}

                    {payload.cardNumber ? (
                      <FieldRow
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
                        hasDivider={false}
                      />
                    ) : null}
                  </View>
                </View>
              )}

              {/* Card Validity Section */}
              {(payload.expiry || payload.expMonth || payload.expYear || payload.cvv || payload.pin) && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>SECURITY & VALIDITY</Text>
                  <View style={styles.sectionGroup}>
                    {(payload.expiry || payload.expMonth || payload.expYear) ? (
                      <FieldRow
                        label="Expiry Date"
                        value={payload.expiry || `${payload.expMonth || "MM"}/${payload.expYear || "YY"}`}
                        onCopy={() => copyToClipboard("exp", payload.expiry || `${payload.expMonth}/${payload.expYear}`)}
                        isCopied={copiedField === "exp"}
                        hasDivider={!!(payload.cvv || payload.pin)}
                      />
                    ) : null}

                    {payload.cvv ? (
                      <FieldRow
                        label="CVV / Security Code"
                        value={showPassword ? payload.cvv : "•••"}
                        onCopy={() => copyToClipboard("cvv", payload.cvv)}
                        isCopied={copiedField === "cvv"}
                        onToggleShow={() => setShowPassword(!showPassword)}
                        isPassword
                        showPassword={showPassword}
                        hasDivider={!!payload.pin}
                      />
                    ) : null}

                    {payload.pin ? (
                      <FieldRow
                        label="ATM PIN"
                        value={showPassword ? payload.pin : "••••"}
                        onCopy={() => copyToClipboard("pin", payload.pin)}
                        isCopied={copiedField === "pin"}
                        onToggleShow={() => setShowPassword(!showPassword)}
                        isPassword
                        showPassword={showPassword}
                        hasDivider={false}
                      />
                    ) : null}
                  </View>
                </View>
              )}

              {/* Address Section */}
              {(payload.street || payload.city || payload.state || payload.zip || payload.country) && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>ADDRESS DETAILS</Text>
                  <View style={styles.sectionGroup}>
                    {payload.street ? (
                      <FieldRow
                        label="Street Address"
                        value={payload.street}
                        onCopy={() => copyToClipboard("street", payload.street)}
                        isCopied={copiedField === "street"}
                        hasDivider={!!(payload.city || payload.state || payload.zip || payload.country)}
                      />
                    ) : null}

                    {payload.city || payload.state || payload.zip ? (
                      <FieldRow
                        label="City, State & ZIP"
                        value={[payload.city, payload.state, payload.zip].filter(Boolean).join(", ")}
                        onCopy={() => copyToClipboard("cityState", [payload.city, payload.state, payload.zip].filter(Boolean).join(", "))}
                        isCopied={copiedField === "cityState"}
                        hasDivider={!!payload.country}
                      />
                    ) : null}

                    {payload.country ? (
                      <FieldRow
                        label="Country"
                        value={payload.country}
                        onCopy={() => copyToClipboard("country", payload.country)}
                        isCopied={copiedField === "country"}
                        hasDivider={false}
                      />
                    ) : null}
                  </View>
                </View>
              )}

              {/* Profile Identity Section */}
              {(payload.firstName || payload.lastName || payload.email || payload.phone) && (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>PERSONAL IDENTITY</Text>
                  <View style={styles.sectionGroup}>
                    {payload.firstName || payload.lastName ? (
                      <FieldRow
                        label="Full Name"
                        value={`${payload.firstName || ""} ${payload.lastName || ""}`.trim()}
                        onCopy={() => copyToClipboard("fullName", `${payload.firstName || ""} ${payload.lastName || ""}`.trim())}
                        isCopied={copiedField === "fullName"}
                        hasDivider={!!(payload.email || payload.phone)}
                      />
                    ) : null}

                    {payload.email ? (
                      <FieldRow
                        label="Email Address"
                        value={payload.email}
                        onCopy={() => copyToClipboard("email", payload.email)}
                        isCopied={copiedField === "email"}
                        hasDivider={!!payload.phone}
                      />
                    ) : null}

                    {payload.phone ? (
                      <FieldRow
                        label="Phone Number"
                        value={payload.phone}
                        onCopy={() => copyToClipboard("phone", payload.phone)}
                        isCopied={copiedField === "phone"}
                        hasDivider={false}
                      />
                    ) : null}
                  </View>
                </View>
              )}

              {/* Note Content */}
              {(payload.note || ((item.template === "note" || payload._template === "note") && payload.entryNotes)) ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>SECURE NOTE</Text>
                  <View style={styles.noteCardBox}>
                    <View style={styles.noteCardHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <FileText size={15} color="#fbbf24" />
                        <Text style={styles.noteCardTitle}>CONTENT</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.noteCopyBtn}
                        onPress={() => copyToClipboard("noteContent", payload.note || payload.entryNotes)}
                        activeOpacity={0.7}
                      >
                        {copiedField === "noteContent" ? (
                          <Check size={13} color="#34d399" />
                        ) : (
                          <Copy size={13} color="#a1a1aa" />
                        )}
                        <Text style={[styles.noteCopyBtnText, copiedField === "noteContent" && { color: "#34d399" }]}>
                          {copiedField === "noteContent" ? "COPIED" : "COPY"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator>
                      <Text style={styles.noteContentBody} selectable>{payload.note || payload.entryNotes}</Text>
                    </ScrollView>
                  </View>
                </View>
              ) : null}

              {/* Custom Fields */}
              {((payload.fields && Array.isArray(payload.fields) && payload.fields.length > 0) ||
                (payload.customFields && Array.isArray(payload.customFields) && payload.customFields.length > 0)) ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>CUSTOM FIELDS</Text>
                  <View style={styles.sectionGroup}>
                    {(payload.fields || payload.customFields).map((field: any, idx: number) => {
                      const isHidden = field.type === "hidden";
                      const labelStr = field.name || field.key || "Custom Field";
                      const valStr = String(field.value || "");
                      const allFields = payload.fields || payload.customFields;
                      return (
                        <FieldRow
                          key={field.id || idx}
                          label={labelStr}
                          value={isHidden && !showPassword ? "••••••••••••" : valStr}
                          onCopy={() => copyToClipboard(`cf_${idx}`, valStr)}
                          isCopied={copiedField === `cf_${idx}`}
                          isPassword={isHidden}
                          showPassword={showPassword}
                          onToggleShow={isHidden ? () => setShowPassword(!showPassword) : undefined}
                          hasDivider={idx < allFields.length - 1}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Attachments Section */}
              {((payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) || serverAttachments.length > 0) ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionHeaderLabel}>
                    FILE ATTACHMENTS ({(serverAttachments.length || payload.attachments?.length || 0)})
                  </Text>
                  <View style={styles.sectionGroup}>
                    {(serverAttachments.length > 0 ? serverAttachments : (payload.attachments || [])).map((att: any, idx: number) => {
                      const totalCount = serverAttachments.length > 0 ? serverAttachments.length : payload.attachments.length;
                      return (
                        <TouchableOpacity
                          key={att.id || idx}
                          style={[
                            styles.attachDetailRow,
                            idx < totalCount - 1 && styles.rowDivider,
                          ]}
                          onPress={async () => {
                            if (att.uri) {
                              Linking.openURL(att.uri).catch(() =>
                                vaultAlert.alert("Notice", "Cannot open local file URI.", undefined, { illustration: "cancel_k4w9" })
                              );
                            } else if (att.id) {
                              try {
                                const decrypted = await downloadAndDecryptAttachment(att.id, att.encryptedName || att.name);

                                // Save decrypted bytes to a temp file then open system share sheet
                                const safeFilename = decrypted.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
                                const outUri = FileSystem.cacheDirectory + safeFilename;

                                // Write raw bytes via base64
                                const { uint8ArrayToBase64 } = require('../utils/base64');
                                const b64 = uint8ArrayToBase64(new Uint8Array(decrypted.bytes.buffer ?? decrypted.bytes));
                                await FileSystem.writeAsStringAsync(outUri, b64, { encoding: FileSystem.EncodingType.Base64 });

                                const canShare = await Sharing.isAvailableAsync();
                                if (canShare) {
                                  await Sharing.shareAsync(outUri, {
                                    mimeType: att.mimeType || 'application/octet-stream',
                                    dialogTitle: `Save ${decrypted.name}`,
                                  });
                                } else {
                                  vaultAlert.alert("Saved", `"${decrypted.name}" has been saved to cache. Sharing not available on this device.`, undefined, { illustration: "completed-task_c11d" });
                                }

                                // Clean up temp file after share
                                FileSystem.deleteAsync(outUri, { idempotent: true }).catch(() => {});
                              } catch (err: any) {
                                vaultAlert.alert("Download Error", err?.message || "Failed to download attachment.", undefined, { illustration: "cancel_k4w9" });
                              }
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <FileText size={16} color="#60a5fa" />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.attachDetailName} numberOfLines={1}>{att.name}</Text>
                            <Text style={styles.attachDetailSize}>
                              {att.sizeBytes ? (att.sizeBytes / 1024).toFixed(1) + " KB" : att.size ? (att.size / 1024).toFixed(1) + " KB" : "Encrypted S3 Attachment"}
                            </Text>
                          </View>
                          <ExternalLink size={14} color="#71717a" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {/* Timestamps & Password History Footer */}
          <View style={styles.metadataFooter}>
            {item.updatedAt && (
              <Text style={styles.metaTimeText}>
                Last edited: {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            )}
            {item.createdAt && (
              <Text style={styles.metaTimeText}>
                Created: {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            )}

            {/* Password History Button */}
            {payload?.passwordHistory && Array.isArray(payload.passwordHistory) && payload.passwordHistory.length > 0 ? (
              <PasswordHistoryButton history={payload.passwordHistory} onCopy={copyToClipboard} copiedField={copiedField} />
            ) : null}
          </View>

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

function FieldRow({
  label,
  value,
  onCopy,
  isCopied,
  isPassword,
  showPassword,
  onToggleShow,
  onLaunch,
  hasDivider = true,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  isCopied: boolean;
  isPassword?: boolean;
  showPassword?: boolean;
  onToggleShow?: () => void;
  onLaunch?: () => void;
  hasDivider?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, hasDivider && styles.rowDivider]}>
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue} selectable numberOfLines={3}>
          {value}
        </Text>
      </View>
      <View style={styles.fieldHeaderActions}>
        {onLaunch && (
          <TouchableOpacity style={styles.actionBtn} onPress={onLaunch}>
            <ExternalLink size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {isPassword && onToggleShow && (
          <TouchableOpacity style={styles.actionBtn} onPress={onToggleShow}>
            {showPassword ? (
              <EyeOff size={18} color={colors.textMuted} />
            ) : (
              <Eye size={18} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
          {isCopied ? (
            <Check size={18} color={colors.success} />
          ) : (
            <Copy size={18} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PasswordHistoryButton({ history, onCopy, copiedField }: { history: string[]; onCopy: (label: string, val: string) => void; copiedField: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null);

  return (
    <View style={{ marginTop: 6, width: "100%" }}>
      <TouchableOpacity
        style={styles.historyToggleBtn}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.historyToggleText}>
          Password history: {history.length}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.historyBox}>
          {history.map((prevPw, idx) => {
            const isRevealed = revealedIdx === idx;
            return (
              <View key={idx} style={[styles.historyRow, idx < history.length - 1 && styles.rowDivider]}>
                <Text style={styles.historyValue} selectable>
                  {isRevealed ? prevPw : "••••••••••••"}
                </Text>
                <View style={styles.fieldHeaderActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setRevealedIdx(isRevealed ? null : idx)}
                  >
                    {isRevealed ? (
                      <EyeOff size={16} color={colors.textMuted} />
                    ) : (
                      <Eye size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => onCopy(`hist_${idx}`, prevPw)}
                  >
                    {copiedField === `hist_${idx}` ? (
                      <Check size={16} color={colors.success} />
                    ) : (
                      <Copy size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  tagBadge: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    color: "#d4d4d8",
    fontSize: 10.5,
    fontWeight: "500",
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
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 4,
    marginBottom: 2,
  },
  sectionGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  fieldRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldContent: {
    flex: 1,
    paddingRight: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "monospace",
  },
  fieldHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtn: {
    padding: 6,
  },
  attachDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  attachDetailName: { fontSize: 13, color: "#f4f4f5", fontWeight: "500" },
  attachDetailSize: { fontSize: 11, color: "#71717a", fontFamily: "monospace", marginTop: 2 },
  noteCardBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  noteCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteCardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d4d4d8",
    letterSpacing: 0.8,
  },
  noteCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1c1c20",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  noteCopyBtnText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#a1a1aa",
  },
  noteContentBody: {
    fontSize: 13.5,
    color: "#f4f4f5",
    lineHeight: 20,
    fontFamily: "monospace",
  },
  metadataFooter: {
    marginTop: 8,
    gap: 4,
  },
  metaTimeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyToggleBtn: {
    paddingVertical: 4,
  },
  historyToggleText: {
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: "500",
  },
  historyBox: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  historyValue: {
    fontSize: 13,
    color: colors.text,
    fontFamily: "monospace",
    flex: 1,
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

