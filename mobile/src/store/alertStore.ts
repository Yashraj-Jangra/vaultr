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

export const useAlertStore = create<AlertState>((set) => ({
  isVisible: false,
  title: "",
  message: "",
  buttons: [],
  options: undefined,

  show: (title, message = "", buttons, options) => {
    // If no buttons provided, provide a default "OK" button
    const defaultButtons: AlertButton[] = [{ text: "OK" }];
    
    set({
      isVisible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : defaultButtons,
      options,
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
  }
};
