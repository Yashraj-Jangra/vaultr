import React from "react";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "./types";
import { VaultListScreen } from "../screens/VaultListScreen";
import { GeneratorScreen } from "../screens/GeneratorScreen";
import { AuthenticatorScreen } from "../screens/AuthenticatorScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/colors";
import { Shield, Wand2, KeyRound, Settings as SettingsIcon } from "lucide-react-native";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 54 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="VaultTab"
        component={VaultListScreen}
        options={{
          tabBarLabel: "Vault",
          tabBarIcon: ({ color, size }) => <Shield size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="GeneratorTab"
        component={GeneratorScreen}
        options={{
          tabBarLabel: "Generator",
          tabBarIcon: ({ color, size }) => <Wand2 size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AuthenticatorTab"
        component={AuthenticatorScreen}
        options={{
          tabBarLabel: "2FA",
          tabBarIcon: ({ color, size }) => <KeyRound size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
