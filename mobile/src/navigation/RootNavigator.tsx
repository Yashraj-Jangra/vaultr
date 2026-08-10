import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { RootStackParamList } from "./types";
import { useVaultStore } from "../store/vaultStore";

import { AuthScreen } from "../screens/AuthScreen";
import { UnlockScreen } from "../screens/UnlockScreen";
import { MainTabs } from "./MainTabs";
import { ItemDetailScreen } from "../screens/ItemDetailScreen";
import { ItemFormScreen } from "../screens/ItemFormScreen";
import { colors } from "../theme/colors";

const Stack = createStackNavigator<RootStackParamList>();

const NavContainer = NavigationContainer as any;
const StackNavigator = Stack.Navigator as any;
const StackScreen = Stack.Screen as any;

export function RootNavigator() {
  const { isAuthenticated, isUnlocked, initSession } = useVaultStore();

  useEffect(() => {
    initSession();
  }, []);

  return (
    <NavContainer>
      <StackNavigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.bg },
        }}
      >
        {!isAuthenticated ? (
          <StackScreen name="Auth" component={AuthScreen} />
        ) : !isUnlocked ? (
          <StackScreen name="Unlock" component={UnlockScreen} />
        ) : (
          <>
            <StackScreen name="MainTabs" component={MainTabs} />
            <StackScreen name="ItemDetail" component={ItemDetailScreen} />
            <StackScreen name="ItemForm" component={ItemFormScreen} />
          </>
        )}
      </StackNavigator>
    </NavContainer>
  );
}
