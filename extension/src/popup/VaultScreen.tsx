import React, { useState, useEffect, useMemo, useCallback } from "react";
import { VaultItem } from "@vaultr/core";
import {
  Search, Copy, Check, Globe, KeyRound, CreditCard, FileText, User,
  Zap, Eye, EyeOff, ChevronDown, ChevronUp, Edit2, Trash2, Plus, Lock
} from "lucide-react";
import { generateTOTP, getTotpPercentage } from "@vaultr/core";

type Template = "login" | "card" | "address" | "profile" | "note";

interface VaultScreenProps {
  items: VaultItem[];
  onDecryptItem: (encryptedBlob: string) => Promise<any>;
  onAutofill: (cred: { username?: string; password?: string }) => void;
  onEditItem: (item: VaultItem, decryptedPayload: any) => void;
  onDeleteItem: (id: string) => Promise<void>;
  onAddNew: () => void;
}

// ─── SiteIcon Fallback ───────────────────────────────────────────────────────

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

function getItemIcon(item: VaultItem) {
  const template = item.template || "login";
  if (template === "login") {
    return <SiteIcon domain={item.domain} name={item.name} />;
  }

  // Icons and backgrounds matching the site
  let icon: React.ReactNode = <Lock size={14} />;
  let bgClass = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

  if (template === "card") {
    icon = <CreditCard size={14} />;
    bgClass = "bg-violet-500/10 text-violet-400 border-violet-500/20";
  } else if (template === "address") {
    icon = <Globe size={14} />;
    bgClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  } else if (template === "profile") {
    icon = <User size={14} />;
    bgClass = "bg-sky-500/10 text-sky-400 border-sky-500/20";
  } else if (template === "note") {
    icon = <FileText size={14} />;
    bgClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }

  return (
    <div className={`site-icon ${bgClass}`} style={{ borderStyle: "solid" }}>
      {icon}
    </div>
  );
}

// ─── Ported Small Components ─────────────────────────────────────────────────

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="detail-action-btn"
      title="Copy value"
    >
      {copied ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
    </button>
  );
}

function MaskedValue({ value }: { value: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, width: "100%" }}>
      <span className={`detail-value${visible ? "" : " blur"}`}>
        {visible ? value : "••••••••••••"}
      </span>
      <div className="detail-actions">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setVisible(!visible); }}
          className="detail-action-btn"
          title={visible ? "Hide" : "Show"}
        >
          {visible ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

function DetailRow({ label, value, masked = false }: { label: string; value: string; masked?: boolean }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
        {masked ? (
          <MaskedValue value={value} />
        ) : (
          <>
            <span className="detail-value">{value}</span>
            <CopyBtn value={value} />
          </>
        )}
      </div>
    </div>
  );
}

function TotpDisplay({ secret }: { secret: string }) {
  const [code, setCode] = useState("------");
  const [percent, setPercent] = useState(100);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const _code = await generateTOTP(secret);
        if (mounted) {
          setCode(_code);
          setPercent(getTotpPercentage());
        }
      } catch {
        if (mounted) setCode("ERROR");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [secret]);

  return (
    <div className="detail-row">
      <span className="detail-label">2FA Code</span>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
        {/* Countdown Ring */}
        <div style={{ position: "relative", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg style={{ width: 14, height: 14, transform: "rotate(-90deg)" }} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="var(--neutral-800)" strokeWidth="4" fill="none" />
            <circle cx="12" cy="12" r="10" stroke="#0ea5e9" strokeWidth="4" fill="none"
              strokeDasharray="62.8"
              strokeDashoffset={62.8 * (1 - percent / 100)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
        </div>
        <span className="detail-value" style={{ color: "#0ea5e9", fontWeight: 700, letterSpacing: "1px" }}>
          {code.slice(0, 3)} {code.slice(3, 6)}
        </span>
        <CopyBtn value={code} />
      </div>
    </div>
  );
}



// ─── ItemRow Component ───────────────────────────────────────────────────────

interface ItemRowProps {
  item: VaultItem;
  onDecrypt: (blob: string) => Promise<any>;
  onAutofill: (cred: { username?: string; password?: string }) => void;
  onEdit: (item: VaultItem, decryptedPayload: any) => void;
  onDelete: (id: string) => Promise<void>;
  isCurrentSiteMatch?: boolean;
}

function ItemRow({ item, onDecrypt, onAutofill, onEdit, onDelete, isCurrentSiteMatch }: ItemRowProps) {
  const [decrypted, setDecrypted] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (decrypted) {
        onEdit(item, decrypted);
      }
    },
    [item, decrypted, onEdit]
  );

  const handleDeleteClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`Move "${item.name}" to Trash?`)) {
        await onDelete(item.id);
      }
    },
    [item, onDelete]
  );

  const isLogin = !item.template || item.template === "login";

  return (
    <div className={`item-container${expanded ? " expanded" : ""}`}>
      {/* Main Row */}
      <div
        className="item-row"
        onClick={handleExpand}
      >
        {getItemIcon(item)}

        <div className="item-meta">
          <div className="item-name">{item.name}</div>
          <div className="item-sub">
            {decrypted?.username || item.domain || item.template || "vault item"}
          </div>
        </div>

        <div className="item-actions">
          {/* Fill indicator badge for active site */}
          {isCurrentSiteMatch && isLogin && (
            <button
              className="btn btn-accent"
              style={{ padding: "4px 8px", fontSize: 10 }}
              onClick={handleAutofillClick}
              title="Autofill on active tab"
            >
              <Zap size={11} style={{ marginRight: 2 }} />
              Fill
            </button>
          )}

          <span style={{ color: "var(--neutral-600)", display: "flex" }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <div className="item-details">
          {loading && (
            <div style={{ color: "var(--neutral-600)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>
              Decrypting secure payload…
            </div>
          )}

          {decrypted && (
            <>
              {/* Login Template */}
              {item.template === "login" && (
                <>
                  <DetailRow label="Username" value={decrypted.username} />
                  <DetailRow label="Password" value={decrypted.password} masked />
                  {decrypted.totpSecret && <TotpDisplay secret={decrypted.totpSecret} />}
                  <DetailRow label="URL" value={decrypted.url} />
                </>
              )}

              {/* Card Template */}
              {item.template === "card" && (
                <>
                  <DetailRow label="Cardholder" value={decrypted.cardName} />
                  <DetailRow label="Number" value={decrypted.cardNumber} masked />
                  <DetailRow label="Expires" value={decrypted.expiry} />
                  <DetailRow label="CVV" value={decrypted.cvv} masked />
                  <DetailRow label="PIN" value={decrypted.pin} masked />
                </>
              )}

              {/* Address Template */}
              {item.template === "address" && (
                <>
                  <DetailRow label="Line 1" value={decrypted.line1} />
                  <DetailRow label="Line 2" value={decrypted.line2} />
                  <DetailRow label="City" value={decrypted.city} />
                  <DetailRow label="State" value={decrypted.state} />
                  <DetailRow label="ZIP Code" value={decrypted.zip} />
                  <DetailRow label="Country" value={decrypted.country} />
                </>
              )}

              {/* Profile Template */}
              {item.template === "profile" && (
                <>
                  <DetailRow label="Full Name" value={decrypted.fullName} />
                  <DetailRow label="Email" value={decrypted.email} />
                  <DetailRow label="Phone" value={decrypted.phone} />
                  <DetailRow label="DOB" value={decrypted.dob} />
                  <DetailRow label="ID Number" value={decrypted.idNumber} masked />
                </>
              )}

              {/* Note Template */}
              {item.template === "note" && decrypted.note && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 24 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "var(--neutral-600)" }}>NOTE CONTENT</span>
                    <CopyBtn value={decrypted.note} />
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 11, color: "var(--neutral-300)" }}>{decrypted.note}</pre>
                </div>
              )}

              {/* Entry Notes (Shared) */}
              {decrypted.entryNotes && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 24 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: "var(--neutral-600)" }}>NOTES</span>
                    <CopyBtn value={decrypted.entryNotes} />
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>{decrypted.entryNotes}</p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8 }}>
                {isLogin && (decrypted.username || decrypted.password) && (
                  <button
                    className="btn btn-accent"
                    style={{ flex: 1, padding: "6px", justifyContent: "center" }}
                    onClick={handleAutofillClick}
                  >
                    <Zap size={12} />
                    Fill Page
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, padding: "6px", justifyContent: "center" }}
                  onClick={handleEditClick}
                >
                  <Edit2 size={12} />
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: "6px 10px" }}
                  onClick={handleDeleteClick}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VaultScreen Component ───────────────────────────────────────────────────

export function VaultScreen({
  items,
  onDecryptItem,
  onAutofill,
  onEditItem,
  onDeleteItem,
  onAddNew
}: VaultScreenProps) {
  const [query, setQuery] = useState("");
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

      <div className="screen-body" style={{ paddingBottom: 72 }}>
        {/* Matches */}
        {matchedItems.length > 0 && !query && (
          <div className="match-banner">
            <div className="match-banner-label">
              <Globe size={11} />
              {activeTabDomain}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {matchedItems.map((item) => (
                <ItemRow
                  key={`match-${item.id}`}
                  item={item}
                  onDecrypt={onDecryptItem}
                  onAutofill={onAutofill}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
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
            <div className="empty-state-title">
              {query ? "No results found" : "No items in vault"}
            </div>
            <div style={{ fontSize: 11 }}>{query ? `Nothing matched "${query}"` : "Tap + to add your first secure record"}</div>
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
                  onAutofill={onAutofill}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                  isCurrentSiteMatch={matchIds.has(item.id) && !query}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <button className="fab" onClick={onAddNew} title="Add secure entry">
        <Plus size={20} />
      </button>
    </div>
  );
}
