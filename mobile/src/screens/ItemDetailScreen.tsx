import React, { useEffect, useState, useRef } from "react";
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
  TextInput,
  Platform,
  BackHandler,
} from "react-native";
import { vaultAlert } from "../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
  FadeInUp,
  FadeOut,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { copyToClipboardWithAutoClear } from "../services/clipboard";
import { TotpCode } from "../components/TotpCode";
import { colors } from "../theme/colors";
import { ItemPreviewCard } from "../components/ItemPreviewCard";
import { PredictiveBackWrapper } from "../components/PredictiveBackWrapper";
import { detectCardBrand } from "@vaultr/core";
import { useResponsive } from "../utils/responsive";
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
  Folder,
  Tag,
} from "lucide-react-native";

type Props = StackScreenProps<RootStackParamList, "ItemDetail">;

export function ItemDetailScreen({ route, navigation }: Props) {
  const rawItem = route.params.item;
  const item = useVaultStore((state) => state.items.find((i) => i.id === rawItem.id)) || rawItem;
  const { isOnline, decryptItemBlob, toggleFavorite, trashItem, fetchAttachments, downloadAndDecryptAttachment, deleteAttachment, updateItem } = useVaultStore();

  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [serverAttachments, setServerAttachments] = useState<Array<{ id: string; name: string; sizeBytes: number; mimeType: string; createdAt: string }>>([]);
  const [downloadingAttId, setDownloadingAttId] = useState<string | null>(null);

  // In-place Note content editing state
  const [editedNote, setEditedNote] = useState("");
  const [lastSavedNote, setLastSavedNote] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const isInitialLoadedRef = useRef(false);

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
          const parsed = JSON.parse(raw);
          setPayload(parsed);
          if (!isInitialLoadedRef.current) {
            const noteVal = parsed.note ?? parsed.entryNotes ?? "";
            setEditedNote(noteVal);
            setLastSavedNote(noteVal);
            isInitialLoadedRef.current = true;
          }
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

  const { isSplitView } = useResponsive();

  const isNoteTemplate = item.template === "note" || payload?._template === "note";
  const isDirty = isNoteTemplate && !loading && editedNote !== lastSavedNote;

  useEffect(() => {
    if (!isDirty) return;
    const backAction = () => {
      vaultAlert.alert(
        "Unsaved Changes",
        "You have unsaved edits on this note. Are you sure you want to discard them?",
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
        ],
        { illustration: "throw-away_k2t5" }
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [isDirty]);

  const handleSaveNote = async (): Promise<boolean> => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to save changes.", undefined, { illustration: "clouds_bmtk" });
      return false;
    }
    setIsSavingNote(true);
    try {
      const updatedPayload = {
        ...payload,
        note: editedNote,
      };
      if (payload?.entryNotes !== undefined) {
        updatedPayload.entryNotes = editedNote;
      }
      await updateItem(item.id, {
        unencryptedPayload: updatedPayload,
      });
      setPayload(updatedPayload);
      setLastSavedNote(editedNote);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      return true;
    } catch (err: any) {
      vaultAlert.alert("Error", err?.message || "Failed to save note.", undefined, { illustration: "cancel_k4w9" });
      return false;
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleToggleEditMode = async () => {
    if (isEditingNote) {
      if (isDirty) {
        const success = await handleSaveNote();
        if (success) {
          setIsEditingNote(false);
        }
      } else {
        setIsEditingNote(false);
      }
    } else {
      setIsEditingNote(true);
    }
  };

  const renderMetaChips = () => {
    const hasFolder = !!item.folder;
    const tags = item.tags;
    const hasTags = !!(tags && tags.length > 0);
    if (!hasFolder && !hasTags) return null;

    return (
      <View style={styles.metaChipBar}>
        {hasFolder && (
          <View style={styles.folderChip}>
            <Folder size={12} color="#fbbf24" />
            <Text style={styles.folderChipText} numberOfLines={1}>
              {item.folder}
            </Text>
          </View>
        )}
        {hasTags &&
          tags?.map((tag: string, idx: number) => (
            <View key={idx} style={styles.tagChip}>
              <Tag size={11} color="#a1a1aa" />
              <Text style={styles.tagChipText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
      </View>
    );
  };

  const renderVisualPreviewAndHeader = () => {
    if (isNoteTemplate) {
      return renderMetaChips();
    }
    return (
      <View style={{ gap: 8 }}>
        <View>
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

        {renderMetaChips()}
      </View>
    );
  };

  const renderDetailSections = () => (
    <View style={{ gap: 16 }}>
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
          {item.template !== "card" && (payload?.url || payload?.urls?.[0] || (item.domain && !item.domain.includes("••••"))) ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>AUTOFILL / WEBSITE OPTIONS</Text>
              <View style={styles.sectionGroup}>
                <FieldRow
                  label="Website (URI)"
                  value={payload?.url || payload?.urls?.[0] || item.domain}
                  onCopy={() => copyToClipboard("url", payload?.url || payload?.urls?.[0] || item.domain)}
                  isCopied={copiedField === "url"}
                  onLaunch={() => handleLaunchUrl(payload?.url || payload?.urls?.[0] || item.domain)}
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
          {(payload.cardholderName || payload.cardName || payload.cardNumber || payload.cardBrand) && (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>CARD DETAILS</Text>
              <View style={styles.sectionGroup}>
                {(payload.cardholderName || payload.cardName) ? (
                  <FieldRow
                    label="Cardholder Name"
                    value={payload.cardholderName || payload.cardName}
                    onCopy={() => copyToClipboard("cardholderName", payload.cardholderName || payload.cardName)}
                    isCopied={copiedField === "cardholderName"}
                    hasDivider={!!(payload.cardNumber || payload.cardBrand || detectCardBrand(payload.cardNumber || ""))}
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
                    hasDivider={!!((payload.cardBrand && payload.cardBrand.toLowerCase() !== "auto-detect" ? payload.cardBrand : "") || detectCardBrand(payload.cardNumber || ""))}
                  />
                ) : null}

                {((payload.cardBrand && payload.cardBrand.toLowerCase() !== "auto-detect" ? payload.cardBrand : "") || detectCardBrand(payload.cardNumber || "")) ? (
                  <FieldRow
                    label="Card Network"
                    value={(payload.cardBrand && payload.cardBrand.toLowerCase() !== "auto-detect" ? payload.cardBrand : "") || detectCardBrand(payload.cardNumber || "")}
                    onCopy={() => copyToClipboard("cardBrand", (payload.cardBrand && payload.cardBrand.toLowerCase() !== "auto-detect" ? payload.cardBrand : "") || detectCardBrand(payload.cardNumber || ""))}
                    isCopied={copiedField === "cardBrand"}
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
          {(payload.street || payload.line1 || payload.line2 || payload.city || payload.state || payload.zip || payload.country) && (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>ADDRESS DETAILS</Text>
              <View style={styles.sectionGroup}>
                {payload.street || payload.line1 ? (
                  <FieldRow
                    label="Street Address"
                    value={payload.street || payload.line1}
                    onCopy={() => copyToClipboard("street", payload.street || payload.line1)}
                    isCopied={copiedField === "street"}
                    hasDivider={!!(payload.line2 || payload.city || payload.state || payload.zip || payload.country)}
                  />
                ) : null}

                {payload.line2 ? (
                  <FieldRow
                    label="Apartment / Suite"
                    value={payload.line2}
                    onCopy={() => copyToClipboard("line2", payload.line2)}
                    isCopied={copiedField === "line2"}
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
          {(() => {
            const profileName = payload.fullName || `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
            const hasProfile = !!(profileName || payload.email || payload.phone || payload.dob || payload.idNumber);
            if (!hasProfile) return null;
            return (
              <View style={{ gap: 6 }}>
                <Text style={styles.sectionHeaderLabel}>PERSONAL IDENTITY</Text>
                <View style={styles.sectionGroup}>
                  {profileName ? (
                    <FieldRow
                      label="Full Name"
                      value={profileName}
                      onCopy={() => copyToClipboard("fullName", profileName)}
                      isCopied={copiedField === "fullName"}
                      hasDivider={!!(payload.email || payload.phone || payload.dob || payload.idNumber)}
                    />
                  ) : null}

                  {payload.email ? (
                    <FieldRow
                      label="Email Address"
                      value={payload.email}
                      onCopy={() => copyToClipboard("email", payload.email)}
                      isCopied={copiedField === "email"}
                      hasDivider={!!(payload.phone || payload.dob || payload.idNumber)}
                    />
                  ) : null}

                  {payload.phone ? (
                    <FieldRow
                      label="Phone Number"
                      value={payload.phone}
                      onCopy={() => copyToClipboard("phone", payload.phone)}
                      isCopied={copiedField === "phone"}
                      hasDivider={!!(payload.dob || payload.idNumber)}
                    />
                  ) : null}

                  {payload.dob ? (
                    <FieldRow
                      label="Date of Birth"
                      value={payload.dob}
                      onCopy={() => copyToClipboard("dob", payload.dob)}
                      isCopied={copiedField === "dob"}
                      hasDivider={!!payload.idNumber}
                    />
                  ) : null}

                  {payload.idNumber ? (
                    <FieldRow
                      label="ID / Passport No."
                      value={showPassword ? payload.idNumber : "••••••••"}
                      onCopy={() => copyToClipboard("idNumber", payload.idNumber)}
                      isCopied={copiedField === "idNumber"}
                      onToggleShow={() => setShowPassword(!showPassword)}
                      isPassword
                      showPassword={showPassword}
                      hasDivider={false}
                    />
                  ) : null}
                </View>
              </View>
            );
          })()}

          {/* Note Content / Living Plain-Text Canvas */}
          {isNoteTemplate ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>NOTE CONTENT</Text>
              <View style={styles.livingNoteCanvas}>
                <View style={styles.noteCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <FileText size={15} color="#fbbf24" />
                    <Text style={styles.noteCardTitle}>CONTENT</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {savedSuccess && (
                      <View style={styles.savedBadge}>
                        <Check size={12} color="#10b981" />
                        <Text style={styles.savedBadgeText}>SAVED</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.noteEditToggleBtn, isEditingNote && styles.noteEditToggleBtnActive]}
                      onPress={handleToggleEditMode}
                      activeOpacity={0.7}
                      disabled={isSavingNote}
                    >
                      {isSavingNote ? (
                        <ActivityIndicator size="small" color="#09090b" />
                      ) : isEditingNote ? (
                        <>
                          <Check size={13} color="#09090b" />
                          <Text style={styles.noteEditToggleBtnActiveText}>Done</Text>
                        </>
                      ) : (
                        <>
                          <Edit2 size={13} color="#d4d4d8" />
                          <Text style={styles.noteEditToggleBtnText}>Edit</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {isEditingNote ? (
                  <TextInput
                    style={styles.livingNoteInput}
                    value={editedNote}
                    onChangeText={setEditedNote}
                    placeholder="Type secure note content here..."
                    placeholderTextColor={colors.textDim}
                    multiline
                    textAlignVertical="top"
                    scrollEnabled={false}
                    autoFocus
                  />
                ) : (
                  <View style={styles.noteReadView}>
                    <Text style={styles.noteContentBody} selectable>
                      {editedNote || "Empty note. Tap Edit above to add content."}
                    </Text>
                  </View>
                )}

                <View style={styles.livingNoteFooter}>
                  <Text style={styles.noteStatsText}>
                    {editedNote.trim() ? editedNote.trim().split(/\s+/).length : 0} words · {editedNote.length} characters
                  </Text>
                  <TouchableOpacity
                    style={styles.noteCopyBtn}
                    onPress={() => copyToClipboard("noteContent", editedNote)}
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
                  const attKey = att.id || att.name || String(idx);
                  const isDownloading = downloadingAttId === attKey;
                  return (
                    <TouchableOpacity
                      key={att.id || idx}
                      style={[
                        styles.attachDetailRow,
                        idx < totalCount - 1 && styles.rowDivider,
                        isDownloading && { opacity: 0.7 },
                      ]}
                      onPress={async () => {
                        if (isDownloading) return;
                        if (att.uri) {
                          Linking.openURL(att.uri).catch(() =>
                            vaultAlert.alert("Notice", "Cannot open local file URI.", undefined, { illustration: "cancel_k4w9" })
                          );
                        } else if (att.id) {
                          setDownloadingAttId(attKey);
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
                          } finally {
                            setDownloadingAttId(null);
                          }
                        }
                      }}
                      disabled={isDownloading}
                      activeOpacity={0.7}
                    >
                      <FileText size={16} color="#60a5fa" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.attachDetailName} numberOfLines={1}>{att.name}</Text>
                        <Text style={styles.attachDetailSize}>
                          {att.sizeBytes ? (att.sizeBytes / 1024).toFixed(1) + " KB" : att.size ? (att.size / 1024).toFixed(1) + " KB" : "Encrypted S3 Attachment"}
                        </Text>
                      </View>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#60a5fa" />
                      ) : (
                        <ExternalLink size={14} color="#71717a" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Private Notes (non-note templates) */}
          {!isNoteTemplate && (payload.entryNotes || payload.note) ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionHeaderLabel}>PRIVATE NOTES</Text>
              <View style={styles.noteCardBox}>
                <View style={styles.noteCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <FileText size={15} color="#fbbf24" />
                    <Text style={styles.noteCardTitle}>NOTES</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.noteCopyBtn}
                      onPress={() => navigation.navigate("ItemForm", { item })}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={13} color="#a1a1aa" />
                      <Text style={styles.noteCopyBtnText}>EDIT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.noteCopyBtn}
                      onPress={() => copyToClipboard("entryNotes", payload.entryNotes || payload.note)}
                      activeOpacity={0.7}
                    >
                      {copiedField === "entryNotes" ? (
                        <Check size={13} color="#34d399" />
                      ) : (
                        <Copy size={13} color="#a1a1aa" />
                      )}
                      <Text style={[styles.noteCopyBtnText, copiedField === "entryNotes" && { color: "#34d399" }]}>
                        {copiedField === "entryNotes" ? "COPIED" : "COPY"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  <Text style={styles.noteContentBody} selectable>{payload.entryNotes || payload.note}</Text>
                </ScrollView>
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
    </View>
  );

  return (
    <PredictiveBackWrapper
      navigation={navigation}
      onBack={() => {
        if (isDirty) {
          // Return true = intercepted: show alert, the wrapper springs card back to identity.
          vaultAlert.alert(
            "Unsaved Changes",
            "You have unsaved edits on this note. Are you sure you want to discard them?",
            [
              { text: "Keep Editing", style: "cancel" },
              { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
            ],
            { illustration: "throw-away_k2t5" }
          );
          return true;
        }
        // Return false/undefined: let the wrapper do the non-animated pop.
      }}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

        {/* Nav Header */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (isDirty) {
                vaultAlert.alert(
                  "Unsaved Changes",
                  "You have unsaved edits on this note. Are you sure you want to discard them?",
                  [
                    { text: "Keep Editing", style: "cancel" },
                    { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
                  ],
                  { illustration: "throw-away_k2t5" }
                );
              } else {
                navigation.goBack();
              }
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.navTitle} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.navRight}>
            {isDirty ? (
              <TouchableOpacity
                style={[styles.saveNavBtn, isSavingNote && { opacity: 0.7 }]}
                onPress={handleSaveNote}
                disabled={isSavingNote}
                activeOpacity={0.8}
              >
                {isSavingNote ? (
                  <ActivityIndicator size="small" color="#09090b" />
                ) : (
                  <Text style={styles.saveNavBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.navActionBtn}
                onPress={handleEdit}
              >
                <Edit2 size={20} color={isOnline ? colors.accent : colors.textMuted} />
              </TouchableOpacity>
            )}

            <AnimatedFavoriteButton
              isFavorite={!!item.favorite}
              onPress={handleToggleFavorite}
            />

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
        ) : isSplitView && !isNoteTemplate ? (
          <ScrollView contentContainerStyle={styles.splitContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.splitLeftCol}>
              {renderVisualPreviewAndHeader()}
            </View>
            <View style={styles.splitRightCol}>
              {renderDetailSections()}
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderVisualPreviewAndHeader()}
            {renderDetailSections()}
          </ScrollView>
        )}

        {/* Floating Copied Pill */}
        {copiedField ? (
          <Animated.View
            entering={FadeInUp.duration(180)}
            exiting={FadeOut.duration(140)}
            style={styles.floatingCopiedPill}
          >
            <Check size={13} color="#10b981" strokeWidth={2.5} />
            <Text style={styles.floatingCopiedText}>Copied to clipboard</Text>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </PredictiveBackWrapper>
  );
}

function AnimatedFavoriteButton({
  isFavorite,
  onPress,
}: {
  isFavorite: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePress = () => {
    // Magnetic click: tactile compression -> crisp micro-pop overshoot -> settles precisely at 1.0
    scale.value = withSequence(
      withTiming(0.84, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(1.15, { damping: 20, stiffness: 420 }),
      withSpring(1.0, { damping: 18, stiffness: 320 })
    );
    // Subtle amber ambient bloom behind icon
    glowOpacity.value = withSequence(
      withTiming(0.65, { duration: 60 }),
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) })
    );
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.navActionBtn}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(234, 179, 8, 0.22)",
            },
            glowAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        <Animated.View style={animatedStyle}>
          <Star
            size={20}
            color={isFavorite ? colors.warning : colors.textMuted}
            fill={isFavorite ? colors.warning : "transparent"}
          />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

function AnimatedCopyButton({
  isCopied,
  onPress,
}: {
  isCopied: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    // Physical ink stamp: quick press-in, then instant damped return to exactly 1.0 (no bounce/float)
    scale.value = withSequence(
      withTiming(0.82, { duration: 65, easing: Easing.out(Easing.quad) }),
      withSpring(1.0, { damping: 22, stiffness: 380 })
    );
    onPress();
  };

  return (
    <TouchableOpacity style={styles.actionBtn} onPress={handlePress} activeOpacity={0.85}>
      <Animated.View style={animatedStyle}>
        {isCopied ? (
          <Check size={18} color={colors.success} />
        ) : (
          <Copy size={18} color={colors.textMuted} />
        )}
      </Animated.View>
    </TouchableOpacity>
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
        <AnimatedCopyButton isCopied={isCopied} onPress={onCopy} />
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
        <Animated.View
          entering={FadeInUp.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.historyBox}
        >
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
        </Animated.View>
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
    marginLeft: 8,
    marginRight: 8,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveNavBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 58,
    minHeight: 32,
  },
  saveNavBtnText: {
    color: "#09090b",
    fontSize: 13,
    fontWeight: "700",
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
  splitContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 24,
    gap: 24,
  },
  splitLeftCol: {
    width: 380,
    maxWidth: "42%",
    gap: 16,
  },
  splitRightCol: {
    flex: 1,
    gap: 16,
  },
  metaChipBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  folderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.22)",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  folderChipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#fef3c7",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#d4d4d8",
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
  noteSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: 4,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savedBadgeText: {
    color: "#10b981",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  livingNoteCanvas: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    minHeight: 280,
  },
  noteEditToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1c1c20",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  noteEditToggleBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#d4d4d8",
  },
  noteEditToggleBtnActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  noteEditToggleBtnActiveText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#09090b",
  },
  noteReadView: {
    minHeight: 180,
    paddingVertical: 4,
  },
  livingNoteInput: {
    fontSize: 15,
    lineHeight: 24,
    color: "#f4f4f5",
    minHeight: 200,
    textAlignVertical: "top",
    padding: 0,
  },
  livingNoteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 12,
  },
  noteStatsText: {
    fontSize: 11,
    color: colors.textDim,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
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
  floatingCopiedPill: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  floatingCopiedText: {
    color: "#fafafa",
    fontSize: 12,
    fontWeight: "600",
  },
});

