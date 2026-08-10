import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVaultStore } from "../../store/vaultStore";
import { colors } from "../../theme/colors";
import { Folder, ArrowLeft, ChevronRight, Plus } from "lucide-react-native";

export function FolderManagerScreen({ navigation }: any) {
  const { items, setSelectedFolder } = useVaultStore();

  const folderStats = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i) => {
      if (i.folder) {
        map.set(i.folder, (map.get(i.folder) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [items]);

  const handleSelectFolder = (name: string) => {
    setSelectedFolder(name);
    navigation.navigate("MainTabs");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Folder Manager</Text>
      </View>

      <FlatList
        data={folderStats}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.folderRow}
            onPress={() => handleSelectFolder(item.name)}
          >
            <View style={styles.iconCircle}>
              <Folder size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.folderName}>{item.name}</Text>
              <Text style={styles.folderCount}>{item.count} items</Text>
            </View>
            <ChevronRight size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Folder size={36} color={colors.surface3} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>No Folders Created</Text>
            <Text style={styles.emptyDesc}>
              Assign folders when adding or editing items to organize your vault.
            </Text>
          </View>
        }
      />
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
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 8,
  },
  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  folderName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  folderCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
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
  },
});
