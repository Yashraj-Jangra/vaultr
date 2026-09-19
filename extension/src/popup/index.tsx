import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyPopupWidth } from "./SettingsScreen";

// Apply persisted popup width & theme before mount to prevent layout/theme shifts
if (typeof chrome !== "undefined" && chrome.storage?.local) {
  chrome.storage.local.get(["vaultr_popup_width", "vaultr_theme", "vaultr_show_animations"], (res) => {
    if (res?.vaultr_popup_width) {
      applyPopupWidth(res.vaultr_popup_width);
    }
    if (res?.vaultr_theme) {
      document.documentElement.setAttribute("data-theme", res.vaultr_theme);
    }
    if (res?.vaultr_show_animations === false) {
      document.documentElement.setAttribute("data-animations", "disabled");
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
