import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import { Template } from "@vaultr/core";
import {
  X,
  Lock,
  CreditCard,
  FileText,
  User,
  MapPin,
  Save,
  Wand2,
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

  // Template specific fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [entryNotes, setEntryNotes] = useState("");

  useEffect(() => {
    if (isEdit && item) {
      (async () => {
        try {
          const raw = await decryptItemBlob(item.encryptedBlob);
          const p = JSON.parse(raw);
          if (p.username) setUsername(p.username);
          if (p.password) setPassword(p.password);
          if (p.url) setUrl(p.url);
          if (p.note) setNote(p.note);
          if (p.entryNotes) setEntryNotes(p.entryNotes);
        } catch {}
      })();
    }
  }, [isEdit, item]);

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
      } else if (template === "note") {
        unencryptedPayload.note = note;
      }

      const domain = url.trim() || undefined;

      if (isEdit && item) {
        await updateItem(item.id, {
          name: name.trim(),
          template,
          folder: folder.trim() || undefined,
          domain,
          unencryptedPayload,
        });
      } else {
        await createItem({
          name: name.trim(),
          template,
          folder: folder.trim() || undefined,
          domain,
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
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
        >
          <X size={20} color="#a1a1aa" />
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
            <ActivityIndicator size="small" color="#09090b" />
          ) : (
            <Save size={18} color="#09090b" />
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
                      color={active ? "#09090b" : "#a1a1aa"}
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
            placeholder="e.g. GitHub, Netflix, Work WiFi"
            placeholderTextColor="#71717a"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Folder (Optional)</Text>
          <TextInput
            style={styles.input}
            value={folder}
            onChangeText={setFolder}
            placeholder="e.g. Work, Personal"
            placeholderTextColor="#71717a"
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
                placeholderTextColor="#71717a"
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
                placeholderTextColor="#71717a"
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
                placeholderTextColor="#71717a"
                autoCapitalize="none"
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
              placeholderTextColor="#71717a"
              multiline
              numberOfLines={6}
            />
          </View>
        )}

        {/* Private Notes */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Private Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={entryNotes}
            onChangeText={setEntryNotes}
            placeholder="Additional details..."
            placeholderTextColor="#71717a"
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
    backgroundColor: "#09090b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  closeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#18181b",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f4f4f5",
  },
  saveBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f4f4f5",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  input: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 12,
    color: "#f4f4f5",
    fontSize: 14,
  },
  textArea: {
    textAlignVertical: "top",
    minHeight: 80,
  },
  templateRow: {
    gap: 8,
    paddingVertical: 4,
  },
  templatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  templatePillActive: {
    backgroundColor: "#f4f4f5",
    borderColor: "#f4f4f5",
  },
  templatePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  templatePillTextActive: {
    color: "#09090b",
  },
});
