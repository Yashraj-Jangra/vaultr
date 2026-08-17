import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { vaultAlert } from "../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { FolderSelectModal } from "../components/FolderSelectModal";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import { Template } from "@vaultr/core";
import { colors } from "../theme/colors";
import { ItemPreviewCard } from "../components/ItemPreviewCard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  X,
  Save,
  Lock,
  CreditCard,
  FileText,
  MapPin,
  User,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  Upload,
  Star,
  Scan,
} from "lucide-react-native";
import { Modal, Pressable } from "react-native";
import { QrScannerModal } from "../components/QrScannerModal";

type Props = StackScreenProps<RootStackParamList, "ItemForm">;

const TEMPLATES: { id: Template; label: string; icon: any }[] = [
  { id: "login", label: "Login", icon: Lock },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "note", label: "Note", icon: FileText },
  { id: "address", label: "Address", icon: MapPin },
  { id: "profile", label: "Profile", icon: User },
];

export function ItemFormScreen({ route, navigation }: Props) {
  const { item, initialFolder, initialTemplate, initialTotpSecret, initialName } = route.params || {};
  const isEdit = !!item;

  const { isOnline, createItem, updateItem, uploadAttachment, fetchAttachments, cryptoKey, decryptItemBlob, items, customFolders } = useVaultStore();

  const [template, setTemplate] = useState<Template>(item?.template || initialTemplate || "login");
  const [name, setName] = useState(item?.name || initialName || "");
  const [folder, setFolder] = useState(item?.folder || initialFolder || "");
  const [tagsStr, setTagsStr] = useState(item?.tags?.join(", ") || "");
  const [saving, setSaving] = useState(false);

  // Login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [additionalUrls, setAdditionalUrls] = useState<string[]>([]);
  const [totpSecret, setTotpSecret] = useState(initialTotpSecret || "");
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Card fields
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expMonthError, setExpMonthError] = useState(false);
  const [expYear, setExpYear] = useState("");
  const [expYearError, setExpYearError] = useState(false);
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);

  // Sensitive Field Eye Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const CARD_NETWORKS = [
    { value: "",            label: "Auto-detect" },
    { value: "Visa",        label: "Visa" },
    { value: "Mastercard",  label: "Mastercard" },
    { value: "AMEX",        label: "AMEX" },
    { value: "Discover",    label: "Discover" },
    { value: "RuPay",       label: "RuPay" },
    { value: "Other",       label: "Other" },
  ];

  // Address fields
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateStr, setStateStr] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Note fields
  const [note, setNote] = useState("");
  const [entryNotes, setEntryNotes] = useState("");

  // Custom Fields
  const [customFields, setCustomFields] = useState<
    Array<{ id: string; name: string; value: string; type: "text" | "hidden"; showValue?: boolean }>
  >([]);

  // Attachments
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; uri: string; size: number; mimeType?: string }>>([]);

  const existingFoldersList = useMemo(() => {
    const setAll = new Set<string>();
    items.forEach((i) => {
      if (i.folder && !i.deletedAt) {
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
  }, [items, customFolders]);

  useEffect(() => {
    if (isEdit && item) {
      (async () => {
        try {
          const raw = await decryptItemBlob(item.encryptedBlob);
          const p = JSON.parse(raw);
          if (p.username) setUsername(p.username);
          if (p.password) setPassword(p.password);
          if (p.url) setUrl(p.url);
          if (p.urls && Array.isArray(p.urls) && p.urls.length > 1) {
            setAdditionalUrls(p.urls.slice(1));
          }
          if (p.totpSecret || p.totp_secret) setTotpSecret(p.totpSecret || p.totp_secret);

          const rawFields = p.fields || p.customFields;
          if (rawFields && Array.isArray(rawFields)) {
            setCustomFields(
              rawFields.map((f: any, idx: number) => ({
                id: f.id || `cf_${idx}_${Date.now()}`,
                name: f.name || f.key || f.label || "",
                value: f.value || "",
                type: f.type === "hidden" ? "hidden" : "text",
                showValue: false,
              }))
            );
          }
          
          if (p.cardholderName || p.cardName) setCardholderName(p.cardholderName || p.cardName);
          if (p.cardNumber) setCardNumber(p.cardNumber);

          const m = p.expMonth || p.expirationMonth || p.expiryMonth || p.month || "";
          const y = p.expYear || p.expirationYear || p.expiryYear || p.year || "";
          if (m || y) {
            const mNum = parseInt(String(m), 10);
            setExpMonth(!isNaN(mNum) && mNum >= 1 && mNum <= 12 ? String(mNum).padStart(2, "0") : String(m).trim());
            setExpYear(String(y).trim());
          } else if (p.expiry || p.expirationDate) {
            const rawExp = String(p.expiry || p.expirationDate).trim();
            const matchSlash = rawExp.match(/^(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/);
            if (matchSlash) {
              const mNum = parseInt(matchSlash[1], 10);
              setExpMonth(!isNaN(mNum) && mNum >= 1 && mNum <= 12 ? String(mNum).padStart(2, "0") : matchSlash[1]);
              setExpYear(matchSlash[2]);
            } else {
              const parts = rawExp.split(/\s*[\/\-]\s*/);
              if (parts[0]) setExpMonth(parts[0].trim().padStart(2, "0"));
              if (parts[1]) setExpYear(parts[1].trim());
            }
          }
          setExpMonthError(false);
          setExpYearError(false);

          if (p.cvv || p.code) setCvv(p.cvv || p.code);
          if (p.pin) setPin(p.pin);
          if (p.cardBrand || p.brand) setCardBrand(p.cardBrand || p.brand);

          if (p.street || p.line1) setStreet(p.street || p.line1 || "");
          if (p.city) setCity(p.city);
          if (p.state) setStateStr(p.state);
          if (p.zip) setZip(p.zip);
          if (p.country) setCountry(p.country);

          if (p.firstName) setFirstName(p.firstName);
          if (p.lastName) setLastName(p.lastName);
          if (!p.firstName && p.fullName) {
            const parts = p.fullName.trim().split(" ");
            setFirstName(parts[0] || "");
            setLastName(parts.slice(1).join(" ") || "");
          }
          if (p.email) setEmail(p.email);
          if (p.phone) setPhone(p.phone);

          if (p.note) setNote(p.note);
          if (p.entryNotes) setEntryNotes(p.entryNotes);
        } catch {}

        // Fetch attachments from server
        // Note: fetchAttachments already decrypts the names before returning.
        try {
          const serverAttachments = await fetchAttachments(item.id);
          setAttachments(serverAttachments.map(att => ({
            id: att.id,
            name: att.name, // already decrypted by the store
            size: att.sizeBytes,
            mimeType: att.mimeType,
            uri: "", // existing server attachments have no local URI
          })));
        } catch (e) {
          console.warn("[ItemForm] Failed to fetch attachments for edit", e);
        }
      })();
    }
  }, [isEdit, item, fetchAttachments]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        multiple: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // expo-file-system can read content:// URIs directly
        setAttachments((prev) => [
          ...prev,
          {
            id: "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
            uri: file.uri,
            name: file.name,
            size: file.size || 0,
            mimeType: file.mimeType || "application/octet-stream",
          },
        ]);
      }
    } catch (err: any) {
      vaultAlert.alert("Error", "Could not pick file attachment.", undefined, { illustration: "cancel_k4w9" });
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    if (!isOnline) {
      vaultAlert.alert("Offline Mode", "Internet connection is required to save entries. Please connect to internet to save.", undefined, { illustration: "clouds_bmtk" });
      return;
    }
    if (!name.trim()) {
      vaultAlert.alert("Validation Error", "Please enter an item name.", undefined, { illustration: "cancel_k4w9" });
      return;
    }
    if (!cryptoKey) {
      vaultAlert.alert("Error", "Vault is locked.", undefined, { illustration: "cancel_k4w9" });
      return;
    }

    setSaving(true);
    try {
      const unencryptedPayload: any = {
        _template: template,
        _folder: folder.trim() || undefined,
        entryNotes: entryNotes.trim() || undefined,
      };

      if (template === "login") {
        unencryptedPayload.username = username.trim();
        unencryptedPayload.password = password;
        unencryptedPayload.url = url.trim();
        const allUrls = [url.trim(), ...additionalUrls.map((u) => u.trim())].filter(Boolean);
        unencryptedPayload.urls = allUrls;
        if (totpSecret.trim()) unencryptedPayload.totpSecret = totpSecret.trim();
      } else if (template === "card") {
        let normMonth = expMonth.trim();
        if (normMonth) {
          const mNum = parseInt(normMonth, 10);
          if (isNaN(mNum) || mNum < 1 || mNum > 12) {
            setExpMonthError(true);
            vaultAlert.alert("Invalid Expiry Month", "Expiration month must be between 01 and 12.", undefined, { illustration: "cancel_k4w9" });
            setSaving(false);
            return;
          }
          normMonth = String(mNum).padStart(2, "0");
        }

        let normYear = expYear.trim();
        if (normYear) {
          if (normYear.length !== 2 && normYear.length !== 4) {
            setExpYearError(true);
            vaultAlert.alert("Invalid Expiry Year", "Expiration year must be 2 digits (YY) or 4 digits (YYYY).", undefined, { illustration: "cancel_k4w9" });
            setSaving(false);
            return;
          }
          if (normYear.length === 2) {
            const yNum = parseInt(normYear, 10);
            normYear = String(yNum < 50 ? 2000 + yNum : 1900 + yNum);
          }
        }

        unencryptedPayload.cardholderName = cardholderName.trim();
        unencryptedPayload.cardName = cardholderName.trim(); // web compat
        unencryptedPayload.cardNumber = cardNumber.trim();
        unencryptedPayload.expMonth = normMonth || undefined;
        unencryptedPayload.expYear = normYear || undefined;
        unencryptedPayload.expiry = (normMonth || normYear) ? `${normMonth || "MM"} / ${normYear || "YY"}` : "";
        unencryptedPayload.cvv = cvv.trim();
        if (pin.trim()) unencryptedPayload.pin = pin.trim();
        if (cardBrand.trim()) unencryptedPayload.cardBrand = cardBrand.trim();
      } else if (template === "address") {
        unencryptedPayload.street = street.trim();
        unencryptedPayload.line1 = street.trim();
        unencryptedPayload.line2 = "";
        unencryptedPayload.city = city.trim();
        unencryptedPayload.state = stateStr.trim();
        unencryptedPayload.zip = zip.trim();
        unencryptedPayload.country = country.trim();
      } else if (template === "profile") {
        unencryptedPayload.firstName = firstName.trim();
        unencryptedPayload.lastName = lastName.trim();
        unencryptedPayload.fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
        unencryptedPayload.email = email.trim();
        unencryptedPayload.phone = phone.trim();
      } else if (template === "note") {
        unencryptedPayload.note = note;
      }

      if (attachments.length > 0) {
        unencryptedPayload.attachments = attachments;
      }

      const validCustomFields = customFields
        .filter((f) => f.name.trim().length > 0)
        .map((f) => ({ id: f.id, name: f.name.trim(), key: f.name.trim(), value: f.value, type: f.type }));

      if (validCustomFields.length > 0) {
        unencryptedPayload.fields = validCustomFields;
        unencryptedPayload.customFields = validCustomFields.map((f) => ({ key: f.name, value: f.value, type: f.type }));
      }

      const tagsList = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      let domain = url.trim() || undefined;
      if (template === "card" && cardNumber.replace(/\D/g, "").length >= 4) {
        const cleanNum = cardNumber.replace(/\D/g, "");
        const last4 = cleanNum.slice(-4);
        const brand = cardBrand && cardBrand !== "auto-detect" ? cardBrand : "";
        const displayBrand = brand.toLowerCase() === "other" || !brand ? "Credit Card" : brand;
        domain = `${displayBrand} •••• ${last4}`;
      }
      const hasTotp = template === "login" && !!totpSecret.trim();

      let targetItemId = item?.id || "";

      if (isEdit && item) {
        await updateItem(item.id, {
          name: name.trim(),
          template,
          folder: folder.trim() || undefined,
          tags: tagsList,
          domain,
          hasTotp,
          unencryptedPayload,
        });
      } else {
        const created = await createItem({
          name: name.trim(),
          template,
          folder: folder.trim() || undefined,
          tags: tagsList,
          domain,
          hasTotp,
          unencryptedPayload,
        });
        if (created?.id) targetItemId = created.id;
      }

      // Upload newly added local file attachments to S3
      if (targetItemId && attachments.length > 0) {
        for (const att of attachments) {
          if (att.uri && (att.uri.startsWith("file://") || att.uri.startsWith("content://"))) {
            try {
              await uploadAttachment(targetItemId, {
                uri: att.uri,
                name: att.name,
                mimeType: att.mimeType || "application/octet-stream",
                size: att.size,
              });
              FileSystem.deleteAsync(att.uri, { idempotent: true }).catch(() => {});
            } catch (attErr: any) {
              console.warn("[ItemForm] Attachment upload warning:", attErr);
              vaultAlert.alert("Attachment Upload Failed", attErr?.message || "Could not upload one or more attachments.", undefined, { illustration: "cancel_k4w9" });
              return; // Stop saving process if attachment fails
            }
          }
        }
      }

      navigation.goBack();
    } catch (err: any) {
      vaultAlert.alert("Save Failed", err?.message || "Could not save entry.", undefined, { illustration: "cancel_k4w9" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
        >
          <X size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? "Edit Entry" : "New Entry"}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#09090b" />
          ) : (
            <Save size={18} color="#09090b" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 150 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Dynamic Live Preview Canvas */}
        <View style={styles.previewCanvasWrap}>
          <ItemPreviewCard
            template={template}
            name={name}
            username={username}
            url={url}
            cardholderName={cardholderName}
            cardNumber={cardNumber}
            expMonth={expMonth}
            expYear={expYear}
            cvv={cvv}
            cardBrand={cardBrand}
            street={street}
            city={city}
            state={stateStr}
            zip={zip}
            country={country}
            fullName={firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName}
            email={email}
            phone={phone}
            note={note}
          />
        </View>

        {/* Template selector pills */}
        {!isEdit && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Entry Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templateRow}
            >
              {TEMPLATES.map((t) => {
                const IconComponent = t.icon;
                const active = template === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.templatePill, active && styles.templatePillActive]}
                    onPress={() => setTemplate(t.id)}
                  >
                    <IconComponent
                      size={14}
                      color={active ? colors.bg : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.templatePillText,
                        active && styles.templatePillTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Common Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Item Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. GitHub, Netflix, Visa Card"
            placeholderTextColor={colors.textDim}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Folder (Optional)</Text>
          <FolderSelectModal value={folder} onChange={setFolder} />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Tags (Optional)</Text>
          <View style={styles.inputEyeRow}>
            <Star size={15} color={colors.textMuted} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.inputInsideRow}
              value={tagsStr}
              onChangeText={setTagsStr}
              placeholder="e.g. work, finance, personal"
              placeholderTextColor={colors.textDim}
            />
          </View>
        </View>

        {/* Login Template Fields */}
        {template === "login" && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Username / Email</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="user@example.com"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputEyeRow}>
                <TextInput
                  key={showPassword ? "pw_shown" : "pw_hidden"}
                  style={[styles.inputInsideRow, { fontFamily: "monospace" }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Website URL</Text>
              <View style={styles.inputEyeRow}>
                <Globe size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.inputInsideRow}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://github.com"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>

            {/* Additional URIs directly below Website URL */}
            <View style={styles.formGroup}>
              {additionalUrls.map((u, idx) => (
                <View key={idx} style={styles.additionalUrlRow}>
                  <View style={[styles.inputEyeRow, { flex: 1 }]}>
                    <Globe size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
                    <TextInput
                      style={styles.inputInsideRow}
                      value={u}
                      onChangeText={(text) => {
                        const next = [...additionalUrls];
                        next[idx] = text;
                        setAdditionalUrls(next);
                      }}
                      placeholder="https://another-domain.com"
                      placeholderTextColor={colors.textDim}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.removeSmallBtn}
                    onPress={() => setAdditionalUrls(additionalUrls.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={16} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSmallBtn}
                onPress={() => setAdditionalUrls([...additionalUrls, ""])}
                activeOpacity={0.75}
              >
                <Plus size={13} color="#fafafa" style={{ marginRight: 4 }} />
                <Text style={styles.addSmallBtnText}>Add Another URL</Text>
              </TouchableOpacity>
            </View>

            {/* 2FA TOTP Secret Key (Optional) */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>2FA TOTP Secret Key (Optional)</Text>
              <View style={styles.inputEyeRow}>
                <TextInput
                  key={showTotpSecret ? "totp_shown" : "totp_hidden"}
                  style={[styles.inputInsideRow, { fontFamily: "monospace" }]}
                  value={totpSecret}
                  onChangeText={setTotpSecret}
                  placeholder="JBSWY3DPEHPK3PXP"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="characters"
                  secureTextEntry={!showTotpSecret}
                />
                <TouchableOpacity
                  style={[styles.eyeToggleBtn, { marginRight: 4 }]}
                  onPress={() => setShowQrScanner(true)}
                  activeOpacity={0.7}
                >
                  <Scan size={18} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowTotpSecret(!showTotpSecret)}
                  activeOpacity={0.7}
                >
                  {showTotpSecret ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <QrScannerModal
              visible={showQrScanner}
              onClose={() => setShowQrScanner(false)}
              onScan={(parsed) => {
                setTotpSecret(parsed.secret);
                if (!name.trim() && (parsed.issuer || parsed.label)) {
                  setName(parsed.issuer || parsed.label || "");
                }
              }}
            />
          </>
        )}

        {/* Card Template Fields */}
        {template === "card" && (
          <>
            <View style={styles.rowTwo}>
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.label}>Cardholder Name</Text>
                <TextInput
                  style={styles.input}
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Network</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowNetworkPicker(true)}
                >
                  <Text style={[styles.pickerBtnText, !cardBrand && { color: colors.textDim }]}>
                    {cardBrand || "Auto-detect"}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginLeft: 4 }}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Network Picker Modal */}
            <Modal
              visible={showNetworkPicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowNetworkPicker(false)}
            >
              <Pressable style={styles.pickerOverlay} onPress={() => setShowNetworkPicker(false)}>
                <View style={styles.pickerSheet}>
                  <Text style={styles.pickerSheetTitle}>Card Network</Text>
                  {CARD_NETWORKS.map((n) => (
                    <TouchableOpacity
                      key={n.value}
                      style={[
                        styles.pickerOption,
                        cardBrand === n.value && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setCardBrand(n.value);
                        setShowNetworkPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        cardBrand === n.value && styles.pickerOptionTextActive,
                      ]}>
                        {n.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Card Number</Text>
              <TextInput
                style={[styles.input, { fontFamily: "monospace" }]}
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="4532 •••• •••• 8892"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Exp Month</Text>
                <TextInput
                  style={[styles.input, expMonthError && { borderColor: "#ef4444" }]}
                  value={expMonth}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, "").slice(0, 2);
                    setExpMonth(v);
                    setExpMonthError(false);
                  }}
                  onBlur={() => {
                    if (!expMonth.trim()) {
                      setExpMonthError(false);
                      return;
                    }
                    const n = parseInt(expMonth, 10);
                    if (isNaN(n) || n < 1 || n > 12) {
                      setExpMonthError(true);
                    } else {
                      setExpMonth(String(n).padStart(2, "0"));
                      setExpMonthError(false);
                    }
                  }}
                  placeholder="MM"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  maxLength={2}
                />
                {expMonthError && <Text style={styles.errorHint}>Must be 01 – 12</Text>}
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Exp Year</Text>
                <TextInput
                  style={[styles.input, expYearError && { borderColor: "#ef4444" }]}
                  value={expYear}
                  onChangeText={(t) => {
                    const v = t.replace(/\D/g, "").slice(0, 4);
                    setExpYear(v);
                    setExpYearError(false);
                  }}
                  onBlur={() => {
                    if (!expYear.trim()) {
                      setExpYearError(false);
                      return;
                    }
                    const len = expYear.trim().length;
                    if (len !== 2 && len !== 4) {
                      setExpYearError(true);
                    } else {
                      setExpYearError(false);
                    }
                  }}
                  placeholder="YY or YYYY"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  maxLength={4}
                />
                {expYearError && <Text style={styles.errorHint}>Enter YY or YYYY</Text>}
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>CVV / Security Code</Text>
                <View style={styles.inputEyeRow}>
                  <TextInput
                    key={showCvv ? "cvv_shown" : "cvv_hidden"}
                    style={[styles.inputInsideRow, { fontFamily: "monospace" }]}
                    value={cvv}
                    onChangeText={setCvv}
                    placeholder="352"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    secureTextEntry={!showCvv}
                    maxLength={4}
                  />
                  <TouchableOpacity
                    style={styles.eyeToggleBtn}
                    onPress={() => setShowCvv(!showCvv)}
                  >
                    {showCvv ? (
                      <EyeOff size={16} color={colors.textMuted} />
                    ) : (
                      <Eye size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ATM PIN (Optional)</Text>
              <View style={styles.inputEyeRow}>
                <TextInput
                  key={showPin ? "pin_shown" : "pin_hidden"}
                  style={[styles.inputInsideRow, { fontFamily: "monospace" }]}
                  value={pin}
                  onChangeText={setPin}
                  placeholder="e.g. 9842"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  secureTextEntry={!showPin}
                  maxLength={8}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPin(!showPin)}
                >
                  {showPin ? (
                    <EyeOff size={18} color={colors.textMuted} />
                  ) : (
                    <Eye size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Address Template Fields */}
        {template === "address" && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Street Address</Text>
              <TextInput
                style={styles.input}
                value={street}
                onChangeText={setStreet}
                placeholder="123 Main St, Apt 4B"
                placeholderTextColor={colors.textDim}
              />
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="San Francisco"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>State / Province</Text>
                <TextInput
                  style={styles.input}
                  value={stateStr}
                  onChangeText={setStateStr}
                  placeholder="CA"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            <View style={styles.rowTwo}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>ZIP / Postal Code</Text>
                <TextInput
                  style={styles.input}
                  value={zip}
                  onChangeText={setZip}
                  placeholder="94105"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  style={styles.input}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="United States"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>
          </>
        )}

        {/* Profile Template Fields */}
        {template === "profile" && (
          <>
            <View style={styles.rowTwo}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jane"
                  placeholderTextColor={colors.textDim}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor={colors.textDim}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="jane.doe@example.com"
                placeholderTextColor={colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 019-2834"
                placeholderTextColor={colors.textDim}
                keyboardType="phone-pad"
              />
            </View>
          </>
        )}

        {/* Note Template Fields */}
        {template === "note" && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Note Content</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="Type secure note here..."
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={6}
            />
          </View>
        )}

        {/* Custom Fields Section */}
        <View style={styles.formGroup}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.label}>Custom Fields ({customFields.length})</Text>
            <TouchableOpacity
              style={styles.addSmallBtn}
              onPress={() =>
                setCustomFields([
                  ...customFields,
                  { id: "cf_" + Date.now(), name: "", value: "", type: "text", showValue: false },
                ])
              }
              activeOpacity={0.75}
            >
              <Plus size={13} color="#fafafa" style={{ marginRight: 4 }} />
              <Text style={styles.addSmallBtnText}>Add Field</Text>
            </TouchableOpacity>
          </View>

          {customFields.map((cf, idx) => (
            <View key={cf.id} style={styles.customFieldCard}>
              <View style={styles.customFieldInputRow}>
                <View style={[styles.inputEyeRow, { flex: 1 }]}>
                  <TextInput
                    style={styles.inputInsideRow}
                    value={cf.name}
                    onChangeText={(text) => {
                      const next = [...customFields];
                      next[idx].name = text;
                      setCustomFields(next);
                    }}
                    placeholder="Field Label"
                    placeholderTextColor={colors.textDim}
                  />
                </View>
                <View style={[styles.inputEyeRow, { flex: 1 }]}>
                  <TextInput
                    key={cf.showValue ? `cf_shown_${cf.id}` : `cf_hidden_${cf.id}`}
                    style={styles.inputInsideRow}
                    value={cf.value}
                    onChangeText={(text) => {
                      const next = [...customFields];
                      next[idx].value = text;
                      setCustomFields(next);
                    }}
                    placeholder="Value"
                    placeholderTextColor={colors.textDim}
                    secureTextEntry={cf.type === "hidden" && !cf.showValue}
                  />
                  {cf.type === "hidden" && (
                    <TouchableOpacity
                      style={styles.eyeToggleBtn}
                      onPress={() => {
                        const next = [...customFields];
                        next[idx].showValue = !next[idx].showValue;
                        setCustomFields(next);
                      }}
                    >
                      {cf.showValue ? (
                        <EyeOff size={16} color={colors.textMuted} />
                      ) : (
                        <Eye size={16} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeSmallBtn}
                  onPress={() => setCustomFields(customFields.filter((f) => f.id !== cf.id))}
                >
                  <Trash2 size={16} color="#f87171" />
                </TouchableOpacity>
              </View>

              {/* Type Switcher Segmented Control */}
              <View style={styles.fieldTypeSegmentedRow}>
                <TouchableOpacity
                  style={[
                    styles.fieldTypeSegmentBtn,
                    cf.type === "text" && styles.fieldTypeSegmentBtnActive,
                  ]}
                  onPress={() => {
                    const next = [...customFields];
                    next[idx].type = "text";
                    setCustomFields(next);
                  }}
                  activeOpacity={0.8}
                >
                  <FileText size={12} color={cf.type === "text" ? "#09090b" : "#a1a1aa"} />
                  <Text
                    style={[
                      styles.fieldTypeSegmentText,
                      cf.type === "text" && styles.fieldTypeSegmentTextActive,
                    ]}
                  >
                    Text Field
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.fieldTypeSegmentBtn,
                    cf.type === "hidden" && styles.fieldTypeSegmentBtnActive,
                  ]}
                  onPress={() => {
                    const next = [...customFields];
                    next[idx].type = "hidden";
                    setCustomFields(next);
                  }}
                  activeOpacity={0.8}
                >
                  <Lock size={12} color={cf.type === "hidden" ? "#09090b" : "#a1a1aa"} />
                  <Text
                    style={[
                      styles.fieldTypeSegmentText,
                      cf.type === "hidden" && styles.fieldTypeSegmentTextActive,
                    ]}
                  >
                    Secret / Hidden
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Big Dashed File Attachments Box */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>File Attachments ({attachments.length})</Text>

          <TouchableOpacity
            style={styles.bigDashedUploadBtn}
            onPress={handlePickDocument}
            activeOpacity={0.8}
          >
            <View style={styles.uploadIconCircle}>
              <Upload size={20} color="#fafafa" />
            </View>
            <Text style={styles.bigUploadTitle}>Tap to attach encrypted file</Text>
            <Text style={styles.bigUploadSub}>Documents, keys, license files up to 10MB</Text>
          </TouchableOpacity>

          {attachments.length > 0 && (
            <View style={styles.attachBox}>
              {attachments.map((att) => (
                <View key={att.id} style={styles.attachItemRow}>
                  <FileText size={15} color="#60a5fa" />
                  <Text style={styles.attachItemName} numberOfLines={1}>{att.name}</Text>
                  <Text style={styles.attachItemSize}>
                    {att.size ? (att.size / 1024).toFixed(1) + " KB" : ""}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveAttachment(att.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={15} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  saveBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.text,
  },
  saveBtnDisabled: {
    backgroundColor: "#27272a",
    opacity: 0.4,
  },
  inputEyeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  inputInsideRow: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  eyeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  bigDashedUploadBtn: {
    width: "100%",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#3f3f46",
    backgroundColor: "#121215",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1c1c20",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bigUploadTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#fafafa",
  },
  bigUploadSub: {
    fontSize: 11,
    color: "#71717a",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  addSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c20",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  addSmallBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#fafafa",
  },
  removeSmallBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  additionalUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  customFieldCard: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    padding: 10,
    gap: 10,
    marginBottom: 8,
  },
  customFieldInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldTypeSegmentedRow: {
    flexDirection: "row",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  fieldTypeSegmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  fieldTypeSegmentBtnActive: {
    backgroundColor: "#fafafa",
  },
  fieldTypeSegmentText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  fieldTypeSegmentTextActive: {
    color: "#09090b",
  },
  fieldTypeRow: {
    flexDirection: "row",
    gap: 6,
  },
  fieldTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  fieldTypePillActive: {
    backgroundColor: "#fafafa",
    borderColor: "#fafafa",
  },
  fieldTypePillText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  fieldTypePillTextActive: {
    color: "#09090b",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  previewCanvasWrap: {
    marginBottom: 4,
  },
  formGroup: {
    gap: 6,
  },
  rowTwo: {
    flexDirection: "row",
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  textArea: {
    textAlignVertical: "top",
    minHeight: 80,
  },
  attachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attachPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  attachPillText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  pickerBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerBtnText: { fontSize: 14, color: colors.text, flex: 1 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  pickerSheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickerOptionActive: {
    backgroundColor: colors.text,
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  pickerOptionTextActive: {
    color: colors.bg,
    fontWeight: "700",
  },
  attachBox: {
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  attachItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#141417",
    borderRadius: 8,
    padding: 8,
  },
  attachItemName: { flex: 1, fontSize: 13, color: "#f4f4f5", fontWeight: "500" },
  attachItemSize: { fontSize: 11, color: "#71717a", fontFamily: "monospace" },
  templateRow: {
    gap: 8,
    paddingVertical: 4,
  },
  templatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  templatePillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  templatePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  templatePillTextActive: {
    color: colors.bg,
  },

  formFolderPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#27272a",
  },
  formFolderPillActive: {
    backgroundColor: "rgba(250, 250, 250, 0.15)",
    borderColor: "#fafafa",
  },
  formFolderPillText: {
    fontSize: 11.5,
    color: "#a1a1aa",
  },
  formFolderPillTextActive: {
    color: "#fafafa",
    fontWeight: "600",
  },
  errorHint: {
    color: "#ef4444",
    fontSize: 10,
    marginTop: 4,
    fontWeight: "500",
  },
});
