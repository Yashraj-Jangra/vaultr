import { VaultItem, Template } from "@vaultr/core";

export type RootStackParamList = {
  Auth: undefined;
  Unlock: undefined;
  MainTabs: undefined;
  ItemDetail: { item: VaultItem };
  ItemForm: {
    item?: VaultItem;
    initialFolder?: string;
    initialTemplate?: Template;
    initialTotpSecret?: string;
    initialName?: string;
  };
  AccountSettings: undefined;
  SecuritySettings: undefined;
  DataSettings: undefined;
  Sessions: undefined;
  FolderManager: undefined;
  Trash: undefined;
  VaultFiltered: {
    title: string;
    filterType?: string;
    filterFolder?: string;
    openSearch?: boolean;
  };
};

export type MainTabParamList = {
  VaultTab: undefined;
  GeneratorTab: undefined;
  AuthenticatorTab: undefined;
  SettingsTab: undefined;
};

