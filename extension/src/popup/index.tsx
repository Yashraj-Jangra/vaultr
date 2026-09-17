import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyPopupWidth } from "./SettingsScreen";

// Apply persisted popup width before mount to prevent layout shifts
if (typeof chrome !== "undefined" && chrome.storage?.local) {
  chrome.storage.local.get("vaultr_popup_width", (res) => {
    if (res?.vaultr_popup_width) {
      applyPopupWidth(res.vaultr_popup_width);
    }
  });
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
