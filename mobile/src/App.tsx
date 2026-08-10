import "react-native-get-random-values";

import { registerRootComponent } from "expo";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./navigation/RootNavigator";
import { initAutoLockService } from "./services/autoLock";

export default function App() {
  useEffect(() => {
    initAutoLockService();
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
