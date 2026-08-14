import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TextInput,
  FlatList,
} from "react-native";
import { vaultAlert } from "../../store/alertStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  parseImportFileContent,
  checkDuplicateItem,
  checkDuplicateItemsBatch,
  ParsedImportItem,
  ConflictMode,
  DuplicateCheckResult,
  Template,
} from "@vaultr/core";
import {
  Download,
  Upload,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  FileText,
  AlertCircle,
  KeyRound,
  CreditCard,
  Folder,
  Search,
  X,
  User,
  MapPin,
} from "lucide-react-native";

export function DataScreen({ navigation }: any) {
  const { items, decryptItemBlob, cryptoKey, bulkImportItems, batchAction, fetchItems, isOnline } = useVaultStore();

  // Export State
  const [exporting, setExporting] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);

  // Import State
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [sourceFileName, setSourceFileName] = useState("");
  const [previewItems, setPreviewItems] = useState<ParsedImportItem[]>([]);
  const [conflictMode, setConflictMode] = useState<ConflictMode>("skip");
  const [searchFilter, setSearchFilter] = useState("");

  // Revert / Undo State
  const [lastImportedBatch, setLastImportedBatch] = useState<{
    insertedIds: string[];
    count: number;
  } | null>(null);
  const [reverting, setReverting] = useState(false);

  const liveItems = useMemo(() => items.filter((i) => !i.deletedAt), [items]);

  // Decrypted index of existing items for multi-factor duplicate matching
  const [decryptedExistingItems, setDecryptedExistingItems] = useState<Array<{
    id: string;
    name: string;
    domain?: string | null;
    template?: string | null;
    username?: string | null;
  }>>([]);

  const itemsSignature = useMemo(
    () => liveItems.map((i) => `${i.id}-${i.updatedAt || ""}`).join("|"),
    [liveItems]
  );

  useEffect(() => {
    let isCancelled = false;
    async function loadExistingDecrypted() {
      if (liveItems.length === 0 || !cryptoKey) {
        setDecryptedExistingItems([]);
        return;
      }
      try {
        const list = await Promise.all(
          liveItems.map(async (item) => {
            let username: string | null = null;
            let domain = item.domain || null;
            try {
              if (item.encryptedBlob) {
                const raw = await decryptItemBlob(item.encryptedBlob);
                const parsed = JSON.parse(raw);
                username = parsed.username || parsed.email || null;
                if (!domain && (parsed.url || parsed.urls?.[0])) {
                  domain = parsed.url || parsed.urls?.[0];
                }
              }
            } catch {}
            return {
              id: item.id,
              name: item.name,
              domain,
              template: item.template || "login",
              username,
            };
          })
        );
        if (!isCancelled) {
          setDecryptedExistingItems(list);
        }
      } catch {}
    }
    loadExistingDecrypted();
    return () => {
      isCancelled = true;
    };
  }, [itemsSignature, cryptoKey]);

  // ─── Export Encrypted JSON ───────────────────────────────────────────────
  const handleExportEncryptedJSON = async () => {
    setExporting(true);
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        itemsCount: items.length,
        items,
      };
      const jsonStr = JSON.stringify(payload, null, 2);

      // Attempt to share file via system share sheet if available
      const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || "";
        const fileUri = `${baseDir}vaultr-export-${new Date().toISOString().split("T")[0]}.json`;
        await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
          encoding: (FileSystem as any).EncodingType?.UTF8 || "utf8",
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Export Vaultr Encrypted Backup",
          UTI: "public.json",
        });
      } else {
        await Clipboard.setStringAsync(jsonStr);
        setCopiedJSON(true);
        vaultAlert.alert(
          "Export Successful",
          `Copied encrypted backup JSON (${items.length} items) to clipboard!`,
          undefined,
          { illustration: "all-the-data_ijgn", glowColor: "rgba(167, 139, 250, 0.12)" }
        );
        setTimeout(() => setCopiedJSON(false), 3000);
      }
    } catch (e: any) {
      vaultAlert.alert("Export Failed", e.message || "Could not export vault.", undefined, {
        illustration: "cancel_k4w9",
        glowColor: "rgba(239, 68, 68, 0.10)",
      });
    } finally {
      setExporting(false);
    }
  };

  // ─── Export Decrypted CSV ────────────────────────────────────────────────
  const handleExportDecryptedCSV = async () => {
    if (!cryptoKey) {
      vaultAlert.alert("Error", "Vault must be unlocked.", undefined, {
        illustration: "cancel_k4w9",
        glowColor: "rgba(239, 68, 68, 0.10)",
      });
      return;
    }

    vaultAlert.alert(
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
              const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
              if (isAvailable) {
                const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || "";
                const fileUri = `${baseDir}vaultr-export-${new Date().toISOString().split("T")[0]}.csv`;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                  encoding: (FileSystem as any).EncodingType?.UTF8 || "utf8",
                });
                await Sharing.shareAsync(fileUri, {
                  mimeType: "text/csv",
                  dialogTitle: "Export Decrypted CSV",
                  UTI: "public.comma-separated-values-text",
                });
              } else {
                await Clipboard.setStringAsync(csvContent);
                vaultAlert.alert(
                  "Export Complete",
                  `Decrypted CSV (${items.length} entries) copied to clipboard!`,
                  undefined,
                  { illustration: "all-the-data_ijgn", glowColor: "rgba(167, 139, 250, 0.12)" }
                );
              }
            } catch (err: any) {
              vaultAlert.alert("Export Error", err.message || "Failed to generate CSV.", undefined, {
                illustration: "cancel_k4w9",
                glowColor: "rgba(239, 68, 68, 0.10)",
              });
            } finally {
              setExporting(false);
            }
          },
        },
      ],
      { illustration: "all-the-data_ijgn", glowColor: "rgba(245, 158, 11, 0.12)" }
    );
  };

  // ─── Pick and Parse File (JSON / CSV) ────────────────────────────────────
  const handleSelectFile = async () => {
    if (!cryptoKey) {
      vaultAlert.alert("Error", "Vault must be unlocked before importing.", undefined, {
        illustration: "cancel_k4w9",
      });
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/csv", "text/comma-separated-values", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;
      const doc = res.assets && res.assets[0] ? res.assets[0] : (res as any);
      if (!doc || !doc.uri) return;

      setSourceFileName(doc.name || "Selected File");

      // Read file content natively using FileSystem
      let content = "";
      try {
        content = await FileSystem.readAsStringAsync(doc.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (readErr) {
        // Fallback to fetch if FileSystem is unavailable
        const response = await fetch(doc.uri);
        if (response && typeof response.text === "function") {
          content = await response.text();
        } else {
          throw new Error("Could not read selected file from storage.");
        }
      }

      if (!content || content.trim().length === 0) {
        vaultAlert.alert("Import Error", "The selected file is empty.", undefined, {
          illustration: "cancel_k4w9",
        });
        return;
      }

      // Universal parser with 1:1 parity with Web site
      const parsed = parseImportFileContent(content, doc.name);

      if (!parsed || parsed.length === 0) {
        vaultAlert.alert(
          "Import Error",
          "Could not detect valid credentials or supported entries in the selected file.",
          undefined,
          { illustration: "cancel_k4w9" }
        );
        return;
      }

      setPreviewItems(parsed);
      setSearchFilter("");
    } catch (err: any) {
      vaultAlert.alert("Import Error", err?.message || "Failed to parse selected file.", undefined, {
        illustration: "cancel_k4w9",
      });
    }
  };

  // ─── Computed Duplicate Map & Stats ───────────────────────────────────────
  const duplicateMap = useMemo(() => {
    return checkDuplicateItemsBatch(previewItems, decryptedExistingItems);
  }, [previewItems, decryptedExistingItems]);

  const stats = useMemo(() => {
    let logins = 0;
    let cards = 0;
    let notes = 0;
    let addresses = 0;
    let profiles = 0;
    let duplicates = 0;
    const folderSet = new Set<string>();

    previewItems.forEach((item) => {
      const t = item.template || item.payload._template;
      if (t === "login") logins++;
      else if (t === "card") cards++;
      else if (t === "note") notes++;
      else if (t === "address") addresses++;
      else if (t === "profile") profiles++;

      if (item.folder && item.folder.trim().length > 0) {
        folderSet.add(item.folder.trim());
      }

      const dup = duplicateMap.get(item.id);
      if (dup?.isDuplicate) {
        duplicates++;
      }
    });

    return {
      total: previewItems.length,
      logins,
      cards,
      notes,
      addresses,
      profiles,
      folders: folderSet.size,
      duplicates,
    };
  }, [previewItems, duplicateMap]);

  // ─── Execute Bulk Import ─────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!isOnline) {
      vaultAlert.alert(
        "Offline Mode",
        "Internet connection is required to import entries. Please connect to the internet.",
        undefined,
        { illustration: "clouds_bmtk" }
      );
      return;
    }
    if (!cryptoKey || previewItems.length === 0) return;

    // Filter duplicates if conflictMode is "skip"
    let itemsToImport = previewItems;
    if (conflictMode === "skip") {
      itemsToImport = previewItems.filter((item) => !duplicateMap.get(item.id)?.isDuplicate);
    }

    if (itemsToImport.length === 0) {
      vaultAlert.alert(
        "Import Info",
        "All entries were skipped because matching items already exist in your vault.",
        undefined,
        { illustration: "all-the-data_ijgn" }
      );
      return;
    }

    setImporting(true);
    setImportProgress(0);

    try {
      const { inserted, updated, insertedIds, failedItems } = await bulkImportItems(
        itemsToImport.map((i) => {
          const dup = duplicateMap.get(i.id);
          const updateId = conflictMode === "overwrite" && dup?.isDuplicate ? dup.matchedItemId : undefined;
          return {
            updateId,
            name: i.name,
            folder: i.folder ? i.folder.trim() : undefined,
            template: i.template,
            payload: i.payload,
          };
        }),
        (percent) => setImportProgress(percent)
      );

      if (insertedIds && insertedIds.length > 0) {
        setLastImportedBatch({ insertedIds, count: insertedIds.length });
      }

      let summaryMsg = "";
      if (updated > 0) {
        summaryMsg = `Successfully imported ${inserted} new item(s) and updated ${updated} existing item(s)!`;
      } else {
        summaryMsg = `Successfully imported ${inserted} item${inserted === 1 ? "" : "s"} into your vault!`;
      }

      if (failedItems && failedItems.length > 0) {
        summaryMsg +=
          `\n\n⚠️ ${failedItems.length} item(s) encountered issues:\n` +
          failedItems
            .slice(0, 3)
            .map((f) => `• ${f.name}: ${f.reason}`)
            .join("\n");
        if (failedItems.length > 3) {
          summaryMsg += `\n...and ${failedItems.length - 3} more.`;
        }
      }

      vaultAlert.alert(
        failedItems && failedItems.length > 0 ? "Import Finished with Warnings" : "Import Successful",
        summaryMsg,
        undefined,
        { illustration: failedItems && failedItems.length > 0 ? "throw-away_k2t5" : "completed-task_c11d" }
      );

      // Reset preview state
      setPreviewItems([]);
      setSourceFileName("");
      setImportProgress(null);
    } catch (err: any) {
      vaultAlert.alert("Import Failed", err?.message || "Failed to import items into vault.", undefined, {
        illustration: "cancel_k4w9",
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleRevertImport = async () => {
    if (!isOnline) {
      vaultAlert.alert(
        "Offline Mode",
        "Internet connection is required to undo imports. Please connect to the internet.",
        undefined,
        { illustration: "clouds_bmtk" }
      );
      return;
    }
    if (!lastImportedBatch || lastImportedBatch.insertedIds.length === 0) return;

    vaultAlert.alert(
      "Revert Import?",
      `Are you sure you want to revert this import and permanently delete the ${lastImportedBatch.count} newly added entries?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revert Import",
          style: "destructive",
          onPress: async () => {
            setReverting(true);
            try {
              await batchAction("purge", lastImportedBatch.insertedIds);
              await fetchItems();
              const count = lastImportedBatch.count;
              setLastImportedBatch(null);
              vaultAlert.alert("Import Reverted", `Successfully deleted ${count} imported entries from your vault.`, undefined, {
                illustration: "completed-task_c11d",
              });
            } catch (err: any) {
              vaultAlert.alert("Revert Failed", err?.message || "Could not undo import.", undefined, {
                illustration: "cancel_k4w9",
              });
            } finally {
              setReverting(false);
            }
          },
        },
      ]
    );
  };

  const handleRemovePreviewItem = (id: string) => {
    setPreviewItems((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredPreviewItems = useMemo(() => {
    if (!searchFilter.trim()) return previewItems;
    const q = searchFilter.toLowerCase();
    return previewItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.payload.username && item.payload.username.toLowerCase().includes(q)) ||
        (item.payload.url && item.payload.url.toLowerCase().includes(q)) ||
        (item.folder && item.folder.toLowerCase().includes(q))
    );
  }, [previewItems, searchFilter]);

  const renderTemplateIcon = (t: Template) => {
    switch (t) {
      case "card":
        return <CreditCard size={16} color="#38bdf8" />;
      case "note":
        return <FileText size={16} color="#fbbf24" />;
      case "address":
        return <MapPin size={16} color="#34d399" />;
      case "profile":
        return <User size={16} color="#a78bfa" />;
      case "login":
      default:
        return <KeyRound size={16} color="#a1a1aa" />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Navigation Header */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (previewItems.length > 0) {
              setPreviewItems([]);
              setSourceFileName("");
            } else {
              navigation.goBack();
            }
          }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {previewItems.length > 0 ? "Review Import Data" : "Import & Export Data"}
        </Text>
      </View>

      {/* If Preview Items exist, render full preview review UI */}
      {previewItems.length > 0 ? (
        <View style={styles.previewContainer}>
          {/* File & Header Info */}
          <View style={styles.previewHeaderCard}>
            <View style={styles.fileRow}>
              <View style={styles.fileIconBox}>
                <FileText size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileNameText} numberOfLines={1}>
                  {sourceFileName}
                </Text>
                <Text style={styles.fileMetaText}>
                  {stats.total} entries parsed ready to import
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeFileBtn}
                onPress={() => {
                  setPreviewItems([]);
                  setSourceFileName("");
                }}
              >
                <Text style={styles.changeFileBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Chips Grid */}
            <View style={styles.statsGrid}>
              {stats.logins > 0 && (
                <View style={styles.statChip}>
                  <KeyRound size={12} color="#a1a1aa" />
                  <Text style={styles.statChipText}>{stats.logins} Logins</Text>
                </View>
              )}
              {stats.cards > 0 && (
                <View style={styles.statChip}>
                  <CreditCard size={12} color="#38bdf8" />
                  <Text style={styles.statChipText}>{stats.cards} Cards</Text>
                </View>
              )}
              {stats.notes > 0 && (
                <View style={styles.statChip}>
                  <FileText size={12} color="#fbbf24" />
                  <Text style={styles.statChipText}>{stats.notes} Notes</Text>
                </View>
              )}
              {stats.addresses > 0 && (
                <View style={styles.statChip}>
                  <MapPin size={12} color="#34d399" />
                  <Text style={styles.statChipText}>{stats.addresses} Addresses</Text>
                </View>
              )}
              {stats.profiles > 0 && (
                <View style={styles.statChip}>
                  <User size={12} color="#a78bfa" />
                  <Text style={styles.statChipText}>{stats.profiles} Profiles</Text>
                </View>
              )}
              {stats.folders > 0 && (
                <View style={styles.statChip}>
                  <Folder size={12} color="#a1a1aa" />
                  <Text style={styles.statChipText}>{stats.folders} Folders</Text>
                </View>
              )}
              {stats.duplicates > 0 && (
                <View style={[styles.statChip, styles.statChipWarning]}>
                  <AlertCircle size={12} color="#f59e0b" />
                  <Text style={[styles.statChipText, { color: "#f59e0b" }]}>
                    {stats.duplicates} Duplicates
                  </Text>
                </View>
              )}
            </View>

            {/* Conflict Resolution Mode */}
            <View style={styles.conflictBox}>
              <Text style={styles.conflictLabel}>Duplicate Handling:</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    conflictMode === "skip" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setConflictMode("skip")}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      conflictMode === "skip" && styles.segmentBtnTextActive,
                    ]}
                  >
                    Skip
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    conflictMode === "overwrite" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setConflictMode("overwrite")}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      conflictMode === "overwrite" && styles.segmentBtnTextActive,
                    ]}
                  >
                    Overwrite
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    conflictMode === "create_all" && styles.segmentBtnActive,
                  ]}
                  onPress={() => setConflictMode("create_all")}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      conflictMode === "create_all" && styles.segmentBtnTextActive,
                    ]}
                  >
                    Keep Both
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search filter */}
            <View style={styles.searchBox}>
              <Search size={14} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search parsed entries..."
                placeholderTextColor={colors.textMuted}
                value={searchFilter}
                onChangeText={setSearchFilter}
                clearButtonMode="while-editing"
              />
              {searchFilter.length > 0 && (
                <TouchableOpacity onPress={() => setSearchFilter("")}>
                  <X size={14} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* List of Parsed Items */}
          <FlatList
            data={filteredPreviewItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.previewList}
            renderItem={({ item }) => {
              const dup = duplicateMap.get(item.id);
              const isDuplicate = dup?.isDuplicate ?? false;
              const subtitle =
                item.payload.username ||
                item.payload.url ||
                item.payload.cardNumber ||
                item.payload.line1 ||
                (item.payload.note ? item.payload.note.substring(0, 30) : "");

              return (
                <View style={styles.previewItemCard}>
                  <View style={styles.previewItemLeft}>
                    <View style={styles.itemIconContainer}>
                      {renderTemplateIcon(item.template || item.payload._template)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {isDuplicate && (
                          <View style={styles.duplicateBadge}>
                            <Text style={styles.duplicateBadgeText}>
                              Duplicate{dup?.matchedItemName ? ` (${dup.matchedItemName})` : ""}
                            </Text>
                          </View>
                        )}
                      </View>
                      {subtitle ? (
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      ) : null}
                      {item.folder ? (
                        <View style={styles.folderPill}>
                          <Folder size={10} color={colors.textMuted} />
                          <Text style={styles.folderPillText} numberOfLines={1}>
                            {item.folder}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeItemBtn}
                    onPress={() => handleRemovePreviewItem(item.id)}
                  >
                    <X size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            }}
          />

          {/* Action Footer */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                importing && { opacity: 0.8 },
              ]}
              onPress={handleConfirmImport}
              disabled={importing}
            >
              {importing ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator size="small" color={colors.bg} />
                  <Text style={styles.primaryBtnText}>
                    {importProgress !== null
                      ? `Importing ${importProgress}%...`
                      : "Importing entries..."}
                  </Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Upload size={16} color={colors.bg} />
                  <Text style={styles.primaryBtnText}>
                    Import {stats.total} Item{stats.total === 1 ? "" : "s"} to Vault
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Default Screen: Export and Import Options */
        <ScrollView contentContainerStyle={styles.content}>
          {/* Export Section */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Download size={20} color={colors.accent} />
              <Text style={styles.cardTitle}>Export Vault Entries</Text>
            </View>
            <Text style={styles.cardDesc}>
              Export an encrypted backup of your vault data or generate an unencrypted CSV for migration to another password manager.
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
                    <Download size={16} color={colors.bg} />
                  )}
                  <Text style={styles.primaryBtnText}>
                    {copiedJSON ? "Copied Encrypted JSON!" : `Export Encrypted Backup (${items.length} items)`}
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
              Import password vaults directly from Bitwarden JSON, 1Password, LastPass, Chrome CSV, or native Vaultr backups.
            </Text>

            <TouchableOpacity
              style={styles.importBtn}
              onPress={handleSelectFile}
              disabled={importing}
            >
              <View style={styles.btnRow}>
                <Upload size={16} color="#f4f4f5" />
                <Text style={styles.importBtnText}>Select File to Import (.json / .csv)</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.supportedRow}>
              <Text style={styles.supportedBadge}>Bitwarden JSON</Text>
              <Text style={styles.supportedBadge}>1Password CSV</Text>
              <Text style={styles.supportedBadge}>LastPass CSV</Text>
              <Text style={styles.supportedBadge}>Chrome CSV</Text>
              <Text style={styles.supportedBadge}>Vaultr Backup</Text>
            </View>
          </View>

          {/* Undo Last Import Option */}
          {lastImportedBatch && (
            <View style={styles.undoCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.undoTitle}>Recent Import</Text>
                <Text style={styles.undoDesc}>
                  {lastImportedBatch.count} item{lastImportedBatch.count === 1 ? "" : "s"} newly added to your vault
                </Text>
              </View>
              <TouchableOpacity
                style={styles.undoBtn}
                onPress={handleRevertImport}
                disabled={reverting}
              >
                {reverting ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Text style={styles.undoBtnText}>Undo Import</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: "700",
  },
  importBtn: {
    backgroundColor: "#27272a",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  importBtnText: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "700",
  },
  dangerBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  supportedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  supportedBadge: {
    backgroundColor: "#18181b",
    borderColor: "#27272a",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },

  // ─── Preview Mode Styles ─────────────────────────────────────────────────
  previewContainer: {
    flex: 1,
  },
  previewHeaderCard: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fileIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(167, 139, 250, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  fileMetaText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  changeFileBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#27272a",
  },
  changeFileBtnText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statChipWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderColor: "rgba(245, 158, 11, 0.30)",
  },
  statChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  conflictBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  conflictLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: "#27272a",
  },
  segmentBtnText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "500",
  },
  segmentBtnTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },
  previewList: {
    padding: 12,
    gap: 8,
  },
  previewItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  previewItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    flexShrink: 1,
  },
  duplicateBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  duplicateBadgeText: {
    fontSize: 9,
    color: "#f59e0b",
    fontWeight: "700",
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  folderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#18181b",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  folderPillText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500",
  },
  removeItemBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  undoCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  undoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  undoDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  undoBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  undoBtnText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "700",
  },
});
