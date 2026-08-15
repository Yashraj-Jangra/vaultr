import { create } from "zustand";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface AlertOptions {
  illustration?: string;
  glowColor?: string;
  cancelable?: boolean;
}

interface AlertState {
  isVisible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  options?: AlertOptions;

  show: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => void;

  hide: () => void;
}

function resolveSmartIllustration(title: string, message: string, buttons?: AlertButton[]): { illustration: string; glowColor: string } {
  const text = `${title} ${message}`.toLowerCase();

  // 1. Connection / Network
  if (text.includes("offline") || text.includes("network") || text.includes("internet") || text.includes("connection") || text.includes("timeout")) {
    return { illustration: "connection-lost_am29", glowColor: "rgba(59, 130, 246, 0.15)" };
  }

  // 2. Master Password / Decryption
  if (text.includes("password") || text.includes("decrypt") || text.includes("wrong") || text.includes("incorrect")) {
    return { illustration: "data-thief_d66l", glowColor: "rgba(239, 68, 68, 0.15)" };
  }

  // 3. Destructive / Trash / Deletion
  if (text.includes("delete") || text.includes("trash") || text.includes("purge") || text.includes("empty") || buttons?.some(b => b.style === "destructive")) {
    return { illustration: "throw-away_k2t5", glowColor: "rgba(239, 68, 68, 0.15)" };
  }

  // 4. Session / Auth
  if (text.includes("session") || text.includes("unauthorized") || text.includes("sign in") || text.includes("signed out") || text.includes("revoked")) {
    return { illustration: "goodbye_mkv7", glowColor: "rgba(245, 158, 11, 0.15)" };
  }

  // 5. Security / Permission
  if (text.includes("security") || text.includes("forbidden") || text.includes("denied") || text.includes("firewall")) {
    return { illustration: "firewall_cfej", glowColor: "rgba(239, 68, 68, 0.15)" };
  }

  // 6. Biometrics
  if (text.includes("biometric") || text.includes("fingerprint") || text.includes("face id")) {
    return { illustration: "fingerprint_kdwq", glowColor: "rgba(16, 185, 129, 0.15)" };
  }

  // 7. Upload / Import / Files
  if (text.includes("upload") || text.includes("import") || text.includes("file") || text.includes("attachment")) {
    return { illustration: "upload-warning_aqma", glowColor: "rgba(245, 158, 11, 0.15)" };
  }

  // 8. 404 / Missing
  if (text.includes("not found") || text.includes("missing")) {
    return { illustration: "lost_teip", glowColor: "rgba(168, 85, 247, 0.15)" };
  }

  // 9. Server / Error
  if (text.includes("error") || text.includes("failed") || text.includes("server")) {
    return { illustration: "server-failure_syqp", glowColor: "rgba(239, 68, 68, 0.15)" };
  }

  // Default
  return { illustration: "alert_w756", glowColor: "rgba(245, 158, 11, 0.12)" };
}

export const useAlertStore = create<AlertState>((set) => ({
  isVisible: false,
  title: "",
  message: "",
  buttons: [],
  options: undefined,

  show: (title, message = "", buttons, options) => {
    const defaultButtons: AlertButton[] = [{ text: "OK" }];
    const smart = resolveSmartIllustration(title, message, buttons);

    const mergedOptions: AlertOptions = {
      illustration: options?.illustration || smart.illustration,
      glowColor: options?.glowColor || smart.glowColor,
      cancelable: options?.cancelable,
    };

    set({
      isVisible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : defaultButtons,
      options: mergedOptions,
    });
  },

  hide: () => {
    set({ isVisible: false });
  },
}));

// Export a singleton imperative API to drop-in replace Alert.alert
export const vaultAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    useAlertStore.getState().show(title, message, buttons, options);
  },
};
