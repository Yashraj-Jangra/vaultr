import React, { useState, useEffect, useMemo, useCallback } from "react";
import { VaultItem } from "@vaultr/core";
import {
  Search, Copy, Check, Globe, KeyRound, CreditCard, FileText, User,
  Zap, Eye, EyeOff, ChevronDown, ChevronUp
} from "lucide-react";

interface VaultScreenProps {
  items: VaultItem[];
  onDecryptItem: (encryptedBlob: string) => Promise<any>;
  onAutofill: (cred: { username?: string; password?: string }) => void;
}

/** Multi-tier favicon loader matching the site's SiteIcon component */
function resolveDomain(domain?: string, name?: string): string {
  if (domain && domain.trim()) {
    const c = domain.trim().toLowerCase();
    if (c.includes("://")) { try { return new URL(c).hostname; } catch {} }
    return c.split("/")[0].split(":")[0];
  }
  if (name && name.trim()) {
    const n = name.trim().toLowerCase();
    if (n.includes(".")) {
      const parts = n.split(/\s+/);
      const withDot = parts.find((p) => p.includes(".") && !p.endsWith("."));
      if (withDot) return withDot;
    }
    const brands: Record<string, string> = {
      google: "google.com", github: "github.com", gitlab: "gitlab.com",
      amazon: "amazon.com", aws: "amazon.com", netflix: "netflix.com",
      spotify: "spotify.com", twitter: "twitter.com", x: "x.com",
      facebook: "facebook.com", instagram: "instagram.com", linkedin: "linkedin.com",
      apple: "apple.com", microsoft: "microsoft.com", outlook: "outlook.com",
      gmail: "gmail.com", chatgpt: "openai.com", openai: "openai.com",
      vercel: "vercel.com", figma: "figma.com", notion: "notion.so",
      slack: "slack.com", discord: "discord.com", reddit: "reddit.com",
      youtube: "youtube.com", dropbox: "dropbox.com", steam: "steampowered.com",
      paypal: "paypal.com", stripe: "stripe.com",
    };
    for (const [k, v] of Object.entries(brands)) {
      if (n.includes(k)) return v;
    }
  }
  return "";
}

function SiteIcon({ domain, name }: { domain?: string; name: string }) {
  const [errLevel, setErrLevel] = useState(0);
  const effectiveDomain = useMemo(() => resolveDomain(domain, name), [domain, name]);

  if (!effectiveDomain || errLevel > 2) {
    const initials = name.slice(0, 2).toUpperCase();
    return <div className="site-icon"><span className="site-icon-fallback">{initials}</span></div>;
  }

  let src = `https://www.google.com/s2/favicons?domain=${effectiveDomain}&sz=64`;
  if (errLevel === 1) src = `https://icons.duckduckgo.com/ip3/${effectiveDomain}.ico`;
  if (errLevel === 2) src = `https://logo.clearbit.com/${effectiveDomain}?size=64`;

  return (
    <div className="site-icon">
      <img src={src} alt="" onError={() => setErrLevel((l) => l + 1)} />
    </div>
  );
}

function getTypeIcon(template?: string) {
  const s = 13;
  switch (template) {
    case "card":    return <CreditCard size={s} color="#f59e0b" />;
    case "address": return <Globe size={s} color="#3b82f6" />;
    case "profile": return <User size={s} color="#10b981" />;
    case "note":    return <FileText size={s} color="#a855f7" />;
    default:        return <KeyRound size={s} color="#7c6afa" />;
  }
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: VaultItem;
  onDecrypt: (blob: string) => Promise<any>;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onAutofill: (cred: { username?: string; password?: string }) => void;
  isCurrentSiteMatch?: boolean;
}

function ItemRow({ item, onDecrypt, copiedId, onCopy, onAutofill, isCurrentSiteMatch }: ItemRowProps) {
  const [decrypted, setDecrypted] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !decrypted) {
      setLoading(true);
      try {
        const payload = await onDecrypt(item.encryptedBlob);
        setDecrypted(payload);
      } catch (err) {
        console.error("Decrypt failed:", err);
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, decrypted, item.encryptedBlob, onDecrypt]);

  const handleAutofillClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      let cred = decrypted;
      if (!cred) {
        try {
          cred = await onDecrypt(item.encryptedBlob);
          setDecrypted(cred);
        } catch {
          return;
        }
      }
      onAutofill({ username: cred.username, password: cred.password });
    },
    [decrypted, item.encryptedBlob, onDecrypt, onAutofill]
  );

  const isLogin = !item.template || item.template === "login";

  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {/* Main row */}
      <div
        className={`item-row${expanded ? " expanded" : ""}`}
        onClick={handleExpand}
      >
        <SiteIcon domain={item.domain} name={item.name} />

        <div className="item-meta">
          <div className="item-name">{item.name}</div>
          <div className="item-sub">
            {decrypted?.username || item.domain || item.template || "vault item"}
          </div>
        </div>

        <div className="item-actions">
          {/* Autofill button for current-site matches */}
          {isCurrentSiteMatch && isLogin && (
            <button
              className="autofill-btn"
              onClick={handleAutofillClick}
              title="Autofill on this page"
            >
              <Zap size={11} style={{ marginRight: 3 }} />
              Fill
            </button>
          )}

          {/* Quick copy password */}
          {decrypted?.password && (
            <button
              className={`btn btn-ghost${copiedId === item.id ? " btn-success" : ""}`}
              style={{ padding: "4px 8px", fontSize: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                onCopy(decrypted.password, item.id);
              }}
              title="Copy password"
            >
              {copiedId === item.id ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}

          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="item-details">
          {loading && (
            <div style={{ color: "var(--text-muted)", fontSize: 11, padding: "4px 0" }}>
              Decrypting…
            </div>
          )}

          {decrypted && (
            <>
              {decrypted.username && (
                <div className="detail-row">
                  <span className="detail-label">Username</span>
                  <span className="detail-value">{decrypted.username}</span>
                  <div className="detail-actions">
                    <button
                      className="detail-action-btn"
                      onClick={() => onCopy(decrypted.username, `${item.id}-user`)}
                      title="Copy username"
                    >
                      {copiedId === `${item.id}-user` ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              {decrypted.password && (
                <div className="detail-row">
                  <span className="detail-label">Password</span>
                  <span className={`detail-value${showPassword ? "" : " blur"}`}>
                    {showPassword ? decrypted.password : "••••••••••••"}
                  </span>
                  <div className="detail-actions">
                    <button
                      className="detail-action-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide" : "Show"}
                    >
                      {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <button
                      className="detail-action-btn"
                      onClick={() => onCopy(decrypted.password, item.id)}
                      title="Copy password"
                    >
                      {copiedId === item.id ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              {decrypted.totp && (
                <div className="detail-row">
                  <span className="detail-label">TOTP</span>
                  <span className="detail-value">{decrypted.totp}</span>
                  <div className="detail-actions">
                    <button
                      className="detail-action-btn"
                      onClick={() => onCopy(decrypted.totp, `${item.id}-totp`)}
                    >
                      {copiedId === `${item.id}-totp` ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              {decrypted.url && (
                <div className="detail-row">
                  <span className="detail-label">URL</span>
                  <span className="detail-value" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {decrypted.url}
                  </span>
                </div>
              )}

              {decrypted.notes && (
                <div className="detail-row">
                  <span className="detail-label">Notes</span>
                  <span className="detail-value" style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
                    {decrypted.notes}
                  </span>
                </div>
              )}

              {/* Autofill in expanded view */}
              {isLogin && (decrypted.username || decrypted.password) && (
                <button
                  className="btn btn-accent"
                  style={{ width: "100%", marginTop: 4, padding: "7px", justifyContent: "center" }}
                  onClick={handleAutofillClick}
                >
                  <Zap size={12} />
                  Autofill on Active Tab
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VaultScreen ──────────────────────────────────────────────────────────────

export function VaultScreen({ items, onDecryptItem, onAutofill }: VaultScreenProps) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTabDomain, setActiveTabDomain] = useState<string>("");

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          try {
            const url = new URL(tabs[0].url);
            setActiveTabDomain(url.hostname.replace(/^www\./, ""));
          } catch {}
        }
      });
    }
  }, []);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.domain || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const matchedItems = useMemo(() => {
    if (!activeTabDomain || query) return [];
    return items.filter((i) => {
      const d = (i.domain || "").toLowerCase().replace(/^www\./, "");
      return (
        d.includes(activeTabDomain) ||
        activeTabDomain.includes(d) ||
        i.name.toLowerCase().includes(activeTabDomain)
      );
    });
  }, [items, activeTabDomain, query]);

  const shownItems = query ? filteredItems : items;
  const matchIds = new Set(matchedItems.map((m) => m.id));

  return (
    <div className="screen">
      {/* Search */}
      <div className="search-wrap">
        <div className="search-field">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault…"
          />
        </div>
      </div>

      <div className="screen-body">
        {/* Current site matches */}
        {matchedItems.length > 0 && !query && (
          <div className="match-banner">
            <div className="match-banner-label">
              <Globe size={11} />
              {activeTabDomain}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {matchedItems.map((item) => (
                <ItemRow
                  key={`match-${item.id}`}
                  item={item}
                  onDecrypt={onDecryptItem}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onAutofill={onAutofill}
                  isCurrentSiteMatch={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* All items */}
        {shownItems.length === 0 ? (
          <div className="empty-state">
            <KeyRound size={28} />
            <div style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
              {query ? "No results found" : "No items in vault"}
            </div>
            <div>{query ? `Nothing matched "${query}"` : "Add items on the Vaultr web app"}</div>
          </div>
        ) : (
          <>
            {matchedItems.length > 0 && !query && (
              <div className="section-label">All Items</div>
            )}
            <div className="items-list">
              {shownItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onDecrypt={onDecryptItem}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onAutofill={onAutofill}
                  isCurrentSiteMatch={matchIds.has(item.id) && !query}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
