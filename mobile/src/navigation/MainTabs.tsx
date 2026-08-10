import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { VaultListScreen } from "../screens/VaultListScreen";
import { GeneratorScreen } from "../screens/GeneratorScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/colors";
import { Shield, Wand2, Settings as SettingsIcon } from "lucide-react-native";

export function MainTabs({ navigation }: any) {
  const [activeTab, setActiveTab] = React.useState<"vault" | "generator" | "settings">("vault");

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeTab === "vault" && <VaultListScreen navigation={navigation} />}
        {activeTab === "generator" && <GeneratorScreen />}
        {activeTab === "settings" && <SettingsScreen />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("vault")}
        >
          <Shield
            size={20}
            color={activeTab === "vault" ? colors.accent : colors.textDim}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "vault" && styles.tabLabelActive,
            ]}
          >
            Vault
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("generator")}
        >
          <Wand2
            size={20}
            color={activeTab === "generator" ? colors.accent : colors.textDim}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "generator" && styles.tabLabelActive,
            ]}
          >
            Generator
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab("settings")}
        >
          <SettingsIcon
            size={20}
            color={activeTab === "settings" ? colors.accent : colors.textDim}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === "settings" && styles.tabLabelActive,
            ]}
          >
            Settings
          </Text>
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
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textDim,
  },
  tabLabelActive: {
    color: colors.accent,
  },
});
