import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import * as Clipboard from "expo-clipboard";
import { Download, Upload, ShieldAlert, ArrowLeft, CheckCircle2, FileText } from "lucide-react-native";

export function DataScreen({ navigation }: any) {
  const { items, decryptItemBlob, cryptoKey } = useVaultStore();

  const [exporting, setExporting] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);

  const handleExportEncryptedJSON = async () => {
    setExporting(true);
    try {
      const payload = {
        vaultrVersion: "1.0.0",
        exportedAt: new Date().toISOString(),
        itemsCount: items.length,
        items,
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      await Clipboard.setStringAsync(jsonStr);
      setCopiedJSON(true);
      Alert.alert(
        "Export Successful",
        `Copied encrypted backup JSON (${items.length} items) to clipboard!`
      );
      setTimeout(() => setCopiedJSON(false), 3000);
    } catch (e: any) {
      Alert.alert("Export Failed", e.message || "Could not export vault.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportDecryptedCSV = async () => {
    if (!cryptoKey) {
      Alert.alert("Error", "Vault must be unlocked.");
      return;
    }

    Alert.alert(
      "Export Unencrypted CSV",
      "WARNING: This will generate plain-text CSV data containing your decrypted passwords. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export Plain Text CSV",
          style: "destructive",
          onPress: async () => {
            setExporting(true);
            try {
              let csvRows = ["folder,favorite,type,name,notes,fields,login_username,login_password,login_uri"];
              for (const item of items) {
                let username = "";
                let password = "";
                let url = "";
                let notes = "";

                try {
                  const raw = await decryptItemBlob(item.encryptedBlob);
                  const p = JSON.parse(raw);
                  username = p.username || "";
                  password = p.password || "";
                  url = p.url || item.domain || "";
                  notes = p.entryNotes || p.note || "";
                } catch {}

                const row = [
                  `"${item.folder || ""}"`,
                  item.favorite ? "1" : "0",
                  `"${item.template || "login"}"`,
                  `"${(item.name || "").replace(/"/g, '""')}"`,
                  `"${notes.replace(/"/g, '""')}"`,
                  '""',
                  `"${username.replace(/"/g, '""')}"`,
                  `"${password.replace(/"/g, '""')}"`,
                  `"${url.replace(/"/g, '""')}"`,
                ].join(",");
                csvRows.push(row);
              }

              const csvContent = csvRows.join("\n");
              await Clipboard.setStringAsync(csvContent);
              Alert.alert(
                "Export Complete",
                `Decrypted CSV (${items.length} entries) copied to clipboard!`
              );
            } catch (err: any) {
              Alert.alert("Export Error", err.message || "Failed to generate CSV.");
            } finally {
              setExporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Import & Export Data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Export Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Download size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Export Vault Entries</Text>
          </View>
          <Text style={styles.cardDesc}>
            Export your encrypted vault backup or generate an unencrypted CSV for migration to another password manager.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleExportEncryptedJSON}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <View style={styles.btnRow}>
                {copiedJSON ? (
                  <CheckCircle2 size={16} color={colors.bg} />
                ) : (
                  <FileText size={16} color={colors.bg} />
                )}
                <Text style={styles.primaryBtnText}>
                  {copiedJSON ? "Copied Encrypted JSON!" : "Export Encrypted Backup (JSON)"}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleExportDecryptedCSV}
            disabled={exporting}
          >
            <View style={styles.btnRow}>
              <ShieldAlert size={16} color={colors.danger} />
              <Text style={styles.dangerBtnText}>Export Unencrypted CSV</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Import Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Upload size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Import Credentials</Text>
          </View>
          <Text style={styles.cardDesc}>
            Import password vaults directly from Bitwarden, 1Password, LastPass, or another Vaultr backup.
          </Text>

          <View style={styles.supportedRow}>
            <Text style={styles.supportedBadge}>Bitwarden JSON</Text>
            <Text style={styles.supportedBadge}>1Password CSV</Text>
            <Text style={styles.supportedBadge}>LastPass CSV</Text>
            <Text style={styles.supportedBadge}>Vaultr Backup</Text>
          </View>
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
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.text,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 13,
  },
  dangerBtn: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  dangerBtnText: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 13,
  },
  supportedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  supportedBadge: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
