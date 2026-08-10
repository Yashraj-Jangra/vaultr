/**
 * Vaultr REST API client wrapper.
 * Can be used by browser extensions, mobile apps, or CLI tools.
 */

import { VaultItem, NewVaultItemPayload, BatchAction } from "./types";

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | Promise<string>;
  getCookies?: () => string | Promise<string>;
  customFetch?: typeof fetch;
}

export class VaultrApiClient {
  private baseUrl: string;
  private getToken?: () => string | Promise<string>;
  private getCookies?: () => string | Promise<string>;
  private fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.getToken = options.getToken;
    this.getCookies = options.getCookies;
    const fn = options.customFetch || globalThis.fetch;
    this.fetchImpl = typeof fn === "function" ? fn.bind(globalThis) : fn;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }

    if (!headers.has("Origin") && this.baseUrl) {
      headers.set("Origin", this.baseUrl);
    }
    if (!headers.has("Referer") && this.baseUrl) {
      headers.set("Referer", `${this.baseUrl}/`);
    }

    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    if (this.getCookies) {
      const cookieStr = await this.getCookies();
      if (cookieStr) {
        headers.set("Cookie", cookieStr);
      }
    }

    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });

    if (!res.ok) {
      let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson.error) errorMessage = errJson.error;
      } catch {
        // ignore JSON parse error
      }
      throw new Error(errorMessage);
    }

    return res.json() as Promise<T>;
  }

  /** Get all vault items for the authenticated user. */
  async getItems(): Promise<VaultItem[]> {
    const data = await this.request<{ items: VaultItem[] }>("/api/vault/items");
    return data.items || [];
  }

  /** Create a new vault item. */
  async createItem(payload: NewVaultItemPayload): Promise<VaultItem> {
    const data = await this.request<{ item: VaultItem }>("/api/vault/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.item;
  }

  /** Update an existing vault item by ID. */
  async updateItem(id: string, patch: Partial<VaultItem>): Promise<VaultItem> {
    const data = await this.request<{ item: VaultItem }>(`/api/vault/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return data.item;
  }

  /** Soft delete (trash) a vault item. */
  async deleteItem(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/vault/items/${id}`, {
      method: "DELETE",
    });
  }

  /** Hard delete (permanently remove) a vault item. */
  async hardDeleteItem(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/vault/items/${id}?permanent=true`, {
      method: "DELETE",
    });
  }

  /** Perform a batch operation (trash/restore/favorite/unfavorite/move) on multiple items. */
  async batchAction(action: BatchAction, ids: string[], payload?: string): Promise<{ count: number }> {
    return this.request<{ count: number }>("/api/vault/items/batch", {
      method: "POST",
      body: JSON.stringify({ action, ids, payload }),
    });
  }

  /** Get list of folders. */
  async getFolders(): Promise<string[]> {
    const data = await this.request<{ folders: string[] }>("/api/vault/folders");
    return data.folders || [];
  }
}
