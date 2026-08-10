import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import { Template } from "@vaultr/core";
import { colors } from "../theme/colors";
import * as DocumentPicker from "expo-document-picker";
import {
  X,
  Lock,
  CreditCard,
  FileText,
  User,
  MapPin,
  Save,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react-native";

type Props = StackScreenProps<RootStackParamList, "ItemForm">;

const TEMPLATES: { id: Template; label: string; icon: any }[] = [
  { id: "login", label: "Login", icon: Lock },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "note", label: "Note", icon: FileText },
  { id: "address", label: "Address", icon: MapPin },
  { id: "profile", label: "Profile", icon: User },
];

export function ItemFormScreen({ route, navigation }: Props) {
  const { item } = route.params || {};
  const isEdit = !!item;

  const { createItem, updateItem, cryptoKey, decryptItemBlob } = useVaultStore();

  const [template, setTemplate] = useState<Template>(item?.template || "login");
  const [name, setName] = useState(item?.name || "");
  const [folder, setFolder] = useState(item?.folder || "");
  const [saving, setSaving] = useState(false);

  // Login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");

  // Card fields
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");

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

  // Attachments
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; uri: string; size: number; mimeType?: string }>>([]);

  useEffect(() => {
    if (isEdit && item) {
      (async () => {
        try {
          const raw = await decryptItemBlob(item.encryptedBlob);
          const p = JSON.parse(raw);
          if (p.username) setUsername(p.username);
          if (p.password) setPassword(p.password);
          if (p.url) setUrl(p.url);
          if (p.totpSecret || p.totp_secret) setTotpSecret(p.totpSecret || p.totp_secret);
          
          if (p.cardholderName) setCardholderName(p.cardholderName);
          if (p.cardNumber) setCardNumber(p.cardNumber);
          if (p.expMonth) setExpMonth(p.expMonth);
          if (p.expYear) setExpYear(p.expYear);
          if (p.cvv) setCvv(p.cvv);

          if (p.street) setStreet(p.street);
          if (p.city) setCity(p.city);
          if (p.state) setStateStr(p.state);
          if (p.zip) setZip(p.zip);
          if (p.country) setCountry(p.country);

          if (p.firstName) setFirstName(p.firstName);
          if (p.lastName) setLastName(p.lastName);
          if (p.email) setEmail(p.email);
          if (p.phone) setPhone(p.phone);

          if (p.note) setNote(p.note);
          if (p.entryNotes) setEntryNotes(p.entryNotes);
          if (p.attachments && Array.isArray(p.attachments)) setAttachments(p.attachments);
        } catch {}
      })();
    }
  }, [isEdit, item]);

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!res.canceled && res.assets[0]) {
        const doc = res.assets[0];
        setAttachments((prev) => [
          ...prev,
          {
            id: "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
            name: doc.name,
            uri: doc.uri,
            size: doc.size || 0,
            mimeType: doc.mimeType || "application/octet-stream",
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Error", "Could not pick file attachment.");
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation Error", "Please enter an item name.");
      return;
    }
    if (!cryptoKey) {
      Alert.alert("Error", "Vault is locked.");
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
        unencryptedPayload.urls = url.trim() ? [url.trim()] : [];
        if (totpSecret.trim()) unencryptedPayload.totpSecret = totpSecret.trim();
      } else if (template === "card") {
        unencryptedPayload.cardholderName = cardholderName.trim();
        unencryptedPayload.cardNumber = cardNumber.trim();
        unencryptedPayload.expMonth = expMonth.trim();
        unencryptedPayload.expYear = expYear.trim();
        unencryptedPayload.cvv = cvv.trim();
      } else if (template === "address") {
        unencryptedPayload.street = street.trim();
        unencryptedPayload.city = city.trim();
        unencryptedPayload.state = stateStr.trim();
        unencryptedPayload.zip = zip.trim();
        unencryptedPayload.country = country.trim();
      } else if (template === "profile") {
        unencryptedPayload.firstName = firstName.trim();
        unencryptedPayload.lastName = lastName.trim();
        unencryptedPayload.email = email.trim();
        unencryptedPayload.phone = phone.trim();
      } else if (template === "note") {
        unencryptedPayload.note = note;
      }

      if (attachments.length > 0) {
        unencryptedPayload.attachments = attachments;
      }

      const domain = url.trim() || undefined;
      const hasTotp = template === "login" && !!totpSecret.trim();

      if (isEdit && item) {
        await updateItem(item.id, {
          name: name.trim(),
          template,
          folder: folder.trim() || undefined,
          domain,
          hasTotp,
          unencryptedPayload,
        });
      } else {
        await createItem({
          name: name.trim(),
          template,
          folder: folder.trim() || undefined,
          domain,
          hasTotp,
          unencryptedPayload,
        });
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Save Failed", err?.message || "Could not save entry.");
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
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Save size={18} color={colors.bg} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
          <TextInput
            style={styles.input}
            value={folder}
            onChangeText={setFolder}
            placeholder="e.g. Work, Personal, Finance"
            placeholderTextColor={colors.textDim}
          />
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
              <TextInput
                style={[styles.input, { fontFamily: "monospace" }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor={colors.textDim}
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Website URL</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://github.com"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>2FA TOTP Secret Key (Optional)</Text>
              <TextInput
                style={[styles.input, { fontFamily: "monospace" }]}
                value={totpSecret}
                onChangeText={setTotpSecret}
                placeholder="JBSWY3DPEHPK3PXP"
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
              />
            </View>
          </>
        )}

        {/* Card Template Fields */}
        {template === "card" && (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Cardholder Name</Text>
              <TextInput
                style={styles.input}
                value={cardholderName}
                onChangeText={setCardholderName}
                placeholder="John Doe"
                placeholderTextColor={colors.textDim}
              />
            </View>

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
                  style={styles.input}
                  value={expMonth}
                  onChangeText={setExpMonth}
                  placeholder="08"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Exp Year</Text>
                <TextInput
                  style={styles.input}
                  value={expYear}
                  onChangeText={setExpYear}
                  placeholder="2028"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>CVV</Text>
                <TextInput
                  style={[styles.input, { fontFamily: "monospace" }]}
                  value={cvv}
                  onChangeText={setCvv}
                  placeholder="•••"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                />
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

        {/* File Attachments */}
        <View style={styles.formGroup}>
          <View style={styles.attachHeader}>
            <Text style={styles.label}>File Attachments ({attachments.length})</Text>
            <TouchableOpacity style={styles.attachPillBtn} onPress={handlePickDocument} activeOpacity={0.75}>
              <FileText size={12} color="#a78bfa" />
              <Text style={styles.attachPillText}>+ Attach File</Text>
            </TouchableOpacity>
          </View>

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

        {/* Private Notes */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Private Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={entryNotes}
            onChangeText={setEntryNotes}
            placeholder="Additional details..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>
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
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
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
  content: {
    padding: 16,
    gap: 16,
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
    backgroundColor: "rgba(124,58,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  attachPillText: { fontSize: 11, fontWeight: "600", color: "#a78bfa" },
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
});
