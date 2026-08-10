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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
