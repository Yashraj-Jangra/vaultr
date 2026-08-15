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
  public baseUrl: string;
  public getToken?: () => string | Promise<string>;
  public getCookies?: () => string | Promise<string>;
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
        if (errJson.error || errJson.message) errorMessage = errJson.error || errJson.message;
      } catch {
        // ignore JSON parse error
      }
      const err = new Error(errorMessage);
      (err as any).status = res.status;
      throw err;
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

  /** Perform a batch operation (trash/restore/favorite/unfavorite/move/purge) on multiple items. */
  async batchAction(action: BatchAction, ids: string[], payload?: string): Promise<{ count: number }> {
    if (!ids || ids.length === 0) return { count: 0 };
    const CHUNK_SIZE = 500;
    let totalUpdated = 0;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const res = await this.request<{ updated?: number; count?: number }>("/api/vault/items/batch", {
        method: "POST",
        body: JSON.stringify({ action, ids: chunk, payload: payload || undefined }),
      });
      totalUpdated += res.updated ?? res.count ?? chunk.length;
    }
    return { count: totalUpdated };
  }

  /** Get list of folders. */
  async getFolders(): Promise<string[]> {
    const data = await this.request<{ folders: Array<string | { name?: string; path?: string }> }>("/api/vault/folders");
    if (!data || !Array.isArray(data.folders)) return [];
    return data.folders
      .map((f) => (typeof f === "string" ? f : f?.name || f?.path || ""))
      .filter((f): f is string => typeof f === "string" && f.trim().length > 0);
  }

  /** Create a new empty folder (POST /api/vault/folders) */
  async createFolder(name: string): Promise<{ success: boolean; folder: string; customFolders?: string[] }> {
    return this.request<{ success: boolean; folder: string; customFolders?: string[] }>("/api/vault/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  /** Rename a folder across all items (PATCH /api/vault/folders) */
  async renameFolder(from: string, to: string): Promise<{ updated: number }> {
    return this.request<{ updated: number }>("/api/vault/folders", {
      method: "PATCH",
      body: JSON.stringify({ from, to }),
    });
  }

  /** Delete a folder (DELETE /api/vault/folders) */
  async deleteFolder(name: string, disposition: "uncategorize" | "trash" = "uncategorize"): Promise<{ updated: number; disposition: string }> {
    return this.request<{ updated: number; disposition: string }>("/api/vault/folders", {
      method: "DELETE",
      body: JSON.stringify({ name, disposition }),
    });
  }

  /** Re-encrypt vault items with new key (POST /api/vault/items/reencrypt) */
  async reencryptItems(items: Array<{ id: string; encryptedBlob: string }>): Promise<{ success: boolean; count: number }> {
    return this.request<{ success: boolean; count: number }>("/api/vault/items/reencrypt", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }

  /** List attachments for a vault entry (GET /api/vault/attachments?vaultItemId=...) */
  async getAttachments(vaultItemId: string): Promise<Array<{ id: string; encryptedName: string; mimeType: string; sizeBytes: number; createdAt: string }>> {
    const res = await this.request<{ attachments: Array<{ id: string; encryptedName: string; mimeType: string; sizeBytes: number; createdAt: string }> }>(
      `/api/vault/attachments?vaultItemId=${encodeURIComponent(vaultItemId)}`
    );
    return res.attachments || [];
  }

  /** Upload an encrypted attachment (POST /api/vault/attachments) */
  async uploadAttachment(formData: FormData): Promise<{ attachment: any }> {
    const headers = new Headers();
    if (this.baseUrl) {
      headers.set("Origin", this.baseUrl);
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
    const response = await this.fetchImpl(`${this.baseUrl}/api/vault/attachments`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Upload failed with status ${response.status}`);
    }
    return response.json();
  }

  /** Download raw encrypted attachment bytes (GET /api/vault/attachments/:id/download) */
  async downloadAttachment(attachmentId: string): Promise<ArrayBuffer> {
    const headers = new Headers();
    if (this.baseUrl) {
      headers.set("Origin", this.baseUrl);
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
    const response = await this.fetchImpl(`${this.baseUrl}/api/vault/attachments/${encodeURIComponent(attachmentId)}/download`, {
      method: "GET",
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }
    return response.arrayBuffer();
  }

  /** Delete an attachment (DELETE /api/vault/attachments/:id) */
  async deleteAttachment(attachmentId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/vault/attachments/${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
    });
  }

  /** Bulk import encrypted items (POST /api/vault/items/import) */
  async importItems(items: Array<{
    id?: string | null;
    name: string;
    encryptedBlob: string;
    domain?: string | null;
    folder?: string | null;
    template?: "login" | "card" | "address" | "profile" | "note";
    favorite?: boolean;
    hasTotp?: boolean;
    tags?: string[];
  }>): Promise<{ inserted: number; updated?: number; insertedIds?: string[]; failedItems?: Array<{ name: string; reason: string }> }> {
    return this.request<{ inserted: number; updated?: number; insertedIds?: string[]; failedItems?: Array<{ name: string; reason: string }> }>("/api/vault/items/import", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }
}
