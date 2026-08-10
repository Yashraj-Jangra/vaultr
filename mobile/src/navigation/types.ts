import { VaultItem } from "@vaultr/core";

export type RootStackParamList = {
  Auth: undefined;
  Unlock: undefined;
  MainTabs: undefined;
  ItemDetail: { item: VaultItem };
  ItemForm: { item?: VaultItem };
};

export type MainTabParamList = {
  Vault: undefined;
  Generator: undefined;
  Settings: undefined;
};
