import React, { useState, useEffect } from "react";
import { VaultItem, generateTOTP, getTotpCountdown } from "@vaultr/core";
import { Search, Copy, Check, ExternalLink, ShieldCheck, KeyRound, Globe, FileText, CreditCard, User } from "lucide-react";

interface VaultScreenProps {
  items: VaultItem[];
  onDecryptItem: (encryptedBlob: string) => Promise<any>;
}

export function VaultScreen({ items, onDecryptItem }: VaultScreenProps) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [totpCountdowns, setTotpCountdowns] = useState<Record<string, number>>({});
  const [activeTabDomain, setActiveTabDomain] = useState<string>("");

  useEffect(() => {
    // Detect active tab domain
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          try {
            const url = new URL(tabs[0].url);
            setActiveTabDomain(url.hostname.replace(/^www\./, ""));
          } catch {
            // ignore non-http urls
          }
        }
      });
    }
  }, []);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = query.toLowerCase();
    return item.name.toLowerCase().includes(q) || (item.domain || "").toLowerCase().includes(q);
  });

  const matchedItems = activeTabDomain
    ? items.filter((item) => (item.domain || "").toLowerCase().includes(activeTabDomain) || item.name.toLowerCase().includes(activeTabDomain))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
      {/* Search Bar */}
      <div style={{ padding: "12px", borderBottom: "1px solid #18181b" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px 8px 32px",
              borderRadius: "8px",
              border: "1px solid #27272a",
              background: "#18181b",
              color: "#f4f4f5",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#71717a" }} />
        </div>
      </div>

      {/* Suggested Logins for Active Tab */}
      {activeTabDomain && matchedItems.length > 0 && !query && (
        <div style={{ background: "rgba(139, 92, 246, 0.08)", borderBottom: "1px solid rgba(139, 92, 246, 0.2)", padding: "10px 12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#a78bfa", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Globe size={12} />
            Matches for {activeTabDomain}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {matchedItems.map((item) => (
              <ItemRow key={item.id} item={item} onDecrypt={onDecryptItem} onCopy={handleCopy} copiedId={copiedId} />
            ))}
          </div>
        </div>
      )}

      {/* Main Items List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#71717a", fontSize: "12px" }}>
            No items found matching your search
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filteredItems.map((item) => (
              <ItemRow key={item.id} item={item} onDecrypt={onDecryptItem} onCopy={handleCopy} copiedId={copiedId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, onDecrypt, onCopy, copiedId }: { item: VaultItem; onDecrypt: (blob: string) => Promise<any>; onCopy: (text: string, id: string) => void; copiedId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [decrypted, setDecrypted] = useState<any>(null);

  const getIcon = () => {
    switch (item.template) {
      case "card": return <CreditCard size={14} color="#f59e0b" />;
      case "address": return <Globe size={14} color="#3b82f6" />;
      case "profile": return <User size={14} color="#10b981" />;
      case "note": return <FileText size={14} color="#a855f7" />;
      default: return <KeyRound size={14} color="#8b5cf6" />;
    }
  };

  const handleFetch = async () => {
    if (decrypted) return;
    setLoading(true);
    try {
      const payload = await onDecrypt(item.encryptedBlob);
      setDecrypted(payload);
    } catch (err) {
      console.error("Failed to decrypt:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleFetch}
      style={{
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "10px",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {getIcon()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </div>
          <div style={{ fontSize: "11px", color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {decrypted?.username || item.domain || item.template || "vault item"}
          </div>
        </div>
      </div>

      {decrypted?.password ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(decrypted.password, item.id);
          }}
          style={{
            background: copiedId === item.id ? "rgba(34, 197, 94, 0.15)" : "#27272a",
            border: "none",
            color: copiedId === item.id ? "#4ade80" : "#f4f4f5",
            borderRadius: "6px",
            padding: "6px 8px",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
          {copiedId === item.id ? "Copied" : "Copy"}
        </button>
      ) : (
        <span style={{ fontSize: "10px", color: "#71717a" }}>{loading ? "Decrypting..." : "Click to view"}</span>
      )}
    </div>
  );
}
