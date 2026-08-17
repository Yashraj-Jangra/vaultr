import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "./types";
import { VaultListScreen } from "../screens/VaultListScreen";
import { GeneratorScreen } from "../screens/GeneratorScreen";
import { AuthenticatorScreen } from "../screens/AuthenticatorScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/colors";
import { Shield, Wand2, KeyRound, Settings as SettingsIcon, Lock } from "lucide-react-native";
import { useResponsive } from "../utils/responsive";
import { useVaultStore } from "../store/vaultStore";

const Tab = createBottomTabNavigator<MainTabParamList>();
const TABLET_RAIL_WIDTH = 72;

function TabletTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { lock } = useVaultStore();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabletRail,
        {
          paddingTop: Math.max(insets.top, 16) + 4,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        },
      ]}
    >
      {/* Top balance spacer */}
      <View style={styles.topSpacer} />

      {/* Nav Items List — Vertically Centered */}
      <View style={styles.tabletNavList}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          let IconComp = Shield;
          if (route.name === "GeneratorTab") IconComp = Wand2;
          else if (route.name === "AuthenticatorTab") IconComp = KeyRound;
          else if (route.name === "SettingsTab") IconComp = SettingsIcon;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabletTabBtn,
                isFocused && styles.tabletTabBtnActive,
              ]}
              activeOpacity={0.65}
            >
              <IconComp
                size={21}
                color={isFocused ? "#ffffff" : "#71717a"}
                strokeWidth={isFocused ? 2.3 : 1.8}
              />
              <Text
                style={[
                  styles.tabletTabLabel,
                  isFocused && styles.tabletTabLabelActive,
                ]}
                numberOfLines={1}
              >
                {typeof label === "string" ? label : route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lock Button at bottom with red shade */}
      <TouchableOpacity
        style={styles.lockRailBtn}
        onPress={lock}
        activeOpacity={0.65}
      >
        <Lock size={17} color="#f87171" strokeWidth={2.2} />
        <Text style={styles.lockRailText}>Lock</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 4;

  return (
    <View
      style={[
        styles.mobileTabBar,
        {
          height: 52 + bottomInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        let IconComp = Shield;
        if (route.name === "GeneratorTab") IconComp = Wand2;
        else if (route.name === "AuthenticatorTab") IconComp = KeyRound;
        else if (route.name === "SettingsTab") IconComp = SettingsIcon;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.mobileTabBtn}
            activeOpacity={0.7}
          >
            <IconComp
              size={22}
              color={isFocused ? colors.accent : colors.textDim}
            />
            <Text
              style={[
                styles.mobileTabLabel,
                isFocused && styles.mobileTabLabelActive,
              ]}
            >
              {typeof label === "string" ? label : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function MainTabs() {
  const { isTablet } = useResponsive();

  return (
    <Tab.Navigator
      tabBar={(props) => (isTablet ? <TabletTabBar {...props} /> : <MobileTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.bg,
          marginLeft: isTablet ? TABLET_RAIL_WIDTH : 0,
        },
      }}
    >
      <Tab.Screen
        name="VaultTab"
        component={VaultListScreen}
        options={{
          tabBarLabel: "Vault",
        }}
      />
      <Tab.Screen
        name="GeneratorTab"
        component={GeneratorScreen}
        options={{
          tabBarLabel: "Generator",
        }}
      />
      <Tab.Screen
        name="AuthenticatorTab"
        component={AuthenticatorScreen}
        options={{
          tabBarLabel: "2FA",
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Tablet Left Navigation Rail
  tabletRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: TABLET_RAIL_WIDTH,
    backgroundColor: "#09090b",
    borderRightWidth: 1,
    borderRightColor: "#18181b",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 100,
    paddingHorizontal: 6,
  },
  topSpacer: {
    height: 16,
  },
  tabletNavList: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  tabletTabBtn: {
    width: 60,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    gap: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabletTabBtnActive: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  tabletTabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#71717a",
    textAlign: "center",
  },
  tabletTabLabelActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  lockRailBtn: {
    width: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 3,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  lockRailText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#f87171",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // Mobile Bottom Tab Bar
  mobileTabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
  },
  mobileTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  mobileTabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textDim,
  },
  mobileTabLabelActive: {
    color: colors.accent,
    fontWeight: "700",
  },
});
