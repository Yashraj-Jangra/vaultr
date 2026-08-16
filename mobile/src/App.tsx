import "react-native-get-random-values";

import { registerRootComponent } from "expo";
import React, { useEffect } from "react";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { RootNavigator } from "./navigation/RootNavigator";
import { initAutoLockService } from "./services/autoLock";
import { setCustomPbkdf2 } from "@vaultr/core";
import { useVaultStore } from "./store/vaultStore";
import { CustomAlertOverlay } from "./components/CustomAlertOverlay";

// Complete any pending web browser auth sessions on app launch / redirect
WebBrowser.maybeCompleteAuthSession();

// Inject native C++ OpenSSL PBKDF2 engine into @vaultr/core if available (Custom Dev Client / Prod).
// In Expo Go, this gracefully falls back to the pure JS implementation (which takes ~3.5s).
try {
  const QuickCryptoModule = require("react-native-quick-crypto");
  const QuickCrypto = QuickCryptoModule.default || QuickCryptoModule;
  if (QuickCrypto && QuickCrypto.pbkdf2) {
    setCustomPbkdf2(async (password: string, salt: string) => {
      return new Promise<Uint8Array>((resolve, reject) => {
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

    // Deep link listener for OAuth redirects (e.g. vaultr://auth-callback?token=...)
    const handleDeepLink = (event: { url: string }) => {
      if (event.url && (event.url.includes("auth-callback") || event.url.includes("token="))) {
        useVaultStore.getState().handleAuthRedirectUrl(event.url);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url && (url.includes("auth-callback") || url.includes("token="))) {
        useVaultStore.getState().handleAuthRedirectUrl(url);
      }
    });

    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: "#09090b" }}>
      <RootNavigator />
      <CustomAlertOverlay />
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
