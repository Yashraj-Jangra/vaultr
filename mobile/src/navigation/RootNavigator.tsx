import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";
import { useVaultStore } from "../store/vaultStore";

import { AuthScreen } from "../screens/AuthScreen";
import { UnlockScreen } from "../screens/UnlockScreen";
import { MainTabs } from "./MainTabs";
import { ItemDetailScreen } from "../screens/ItemDetailScreen";
import { ItemFormScreen } from "../screens/ItemFormScreen";
import { AccountSettingsScreen } from "../screens/settings/AccountSettingsScreen";
import { SecuritySettingsScreen } from "../screens/settings/SecuritySettingsScreen";
import { SessionsScreen } from "../screens/settings/SessionsScreen";
import { DataScreen } from "../screens/settings/DataScreen";
import { FolderManagerScreen } from "../screens/settings/FolderManagerScreen";
import { TrashScreen } from "../screens/TrashScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, isUnlocked, initSession } = useVaultStore();

  useEffect(() => {
    initSession();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !isUnlocked ? (
          <Stack.Screen
            name="Unlock"
            component={UnlockScreen}
            options={{ animation: "fade" }}
          />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
            <Stack.Screen
              name="ItemForm"
              component={ItemFormScreen}
              options={{ animation: "slide_from_bottom" }}
            />
            <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
            <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <Stack.Screen name="Sessions" component={SessionsScreen} />
            <Stack.Screen name="DataSettings" component={DataScreen} />
            <Stack.Screen name="FolderManager" component={FolderManagerScreen} />
            <Stack.Screen name="Trash" component={TrashScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
