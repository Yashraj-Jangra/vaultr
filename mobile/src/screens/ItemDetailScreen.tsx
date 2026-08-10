import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/types";
import { useVaultStore } from "../store/vaultStore";
import * as Clipboard from "expo-clipboard";
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
} from "lucide-react-native";

type Props = StackScreenProps<RootStackParamList, "ItemDetail">;

export function ItemDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { decryptItemBlob } = useVaultStore();

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
          Alert.alert("Decryption Failed", "Could not decrypt this item's payload.");
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate("ItemForm", { item })}
        >
          <Edit2 size={18} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#a78bfa" size="large" />
          <Text style={styles.loadingText}>Decrypting payload...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header Badge Card */}
          <View style={styles.badgeCard}>
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

          {/* Fields List */}
          {payload && (
            <View style={styles.fieldsGroup}>
              {/* Username */}
              {payload.username ? (
                <DetailRow
                  icon={<User size={16} color="#a1a1aa" />}
                  label="Username / Email"
                  value={payload.username}
                  onCopy={() => copyToClipboard("username", payload.username)}
                  isCopied={copiedField === "username"}
                />
              ) : null}

              {/* Password */}
              {payload.password ? (
                <DetailRow
                  icon={<Key size={16} color="#a1a1aa" />}
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
                  icon={<Globe size={16} color="#a1a1aa" />}
                  label="Website URL"
                  value={payload.url || item.domain}
                  onCopy={() =>
                    copyToClipboard("url", payload.url || item.domain)
                  }
                  isCopied={copiedField === "url"}
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

              {/* Custom Fields */}
              {Array.isArray(payload.customFields) &&
                payload.customFields.map((cf: any, idx: number) => (
                  <DetailRow
                    key={idx}
                    icon={<FileText size={16} color="#a1a1aa" />}
                    label={cf.key || "Custom Field"}
                    value={cf.value || ""}
                    onCopy={() => copyToClipboard(`cf_${idx}`, cf.value)}
                    isCopied={copiedField === `cf_${idx}`}
                  />
                ))}
            </View>
          )}

          <View style={styles.footerNote}>
            <ShieldCheck size={14} color="#52525b" />
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
      <View style={styles.fieldHeader}>
        <View style={styles.fieldHeaderLeft}>
          {icon}
          <Text style={styles.fieldLabel}>{label}</Text>
        </View>
        <View style={styles.fieldHeaderActions}>
          {isPassword && onToggleShow && (
            <TouchableOpacity style={styles.actionBtn} onPress={onToggleShow}>
              {showPassword ? (
                <EyeOff size={16} color="#a1a1aa" />
              ) : (
                <Eye size={16} color="#a1a1aa" />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
            {isCopied ? (
              <Check size={16} color="#4ade80" />
            ) : (
              <Copy size={16} color="#a1a1aa" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.fieldValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#18181b",
  },
  navTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f4f4f5",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  editBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#18181b",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  badgeCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 16,
    padding: 16,
  },
  itemName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f4f4f5",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  templatePill: {
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  templatePillText: {
    color: "#a78bfa",
    fontSize: 10,
    fontWeight: "700",
  },
  folderText: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  fieldsGroup: {
    gap: 12,
  },
  fieldBox: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 14,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  actionBtn: {
    padding: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: "#f4f4f5",
    fontFamily: "monospace",
  },
  noteText: {
    fontSize: 13,
    color: "#f4f4f5",
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
    color: "#52525b",
  },
});
