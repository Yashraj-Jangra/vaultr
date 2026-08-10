import "react-native-get-random-values";

import { registerRootComponent } from "expo";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./navigation/RootNavigator";
import { initAutoLockService } from "./services/autoLock";
import { setCustomPbkdf2 } from "@vaultr/core";

// Inject native C++ OpenSSL PBKDF2 engine into @vaultr/core if available (Custom Dev Client / Prod).
// In Expo Go, this gracefully falls back to the pure JS implementation (which takes ~3.5s).
try {
  const QuickCrypto = require("react-native-quick-crypto").default;
  if (QuickCrypto && QuickCrypto.pbkdf2) {
    setCustomPbkdf2(async (password, salt) => {
      return new Promise((resolve, reject) => {
        QuickCrypto.pbkdf2(password, salt, 100000, 32, "sha256", (err: any, derivedKey: any) => {
          if (err) reject(err);
          else resolve(new Uint8Array(derivedKey));
        });
      });
    });
  }
} catch (e) {
  console.log("[Crypto] Native crypto not available in Expo Go. Falling back to JS PBKDF2Async.");
}

export default function App() {
  useEffect(() => {
    initAutoLockService();
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "#09090b" }}>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
