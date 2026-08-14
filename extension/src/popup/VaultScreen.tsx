import React, { useState, useEffect, useMemo, useCallback } from "react";
import { VaultItem } from "@vaultr/core";
import {
  Search, Copy, Check, Globe, KeyRound, CreditCard, FileText, User, MapPin,
  Zap, Eye, EyeOff, ChevronDown, ChevronUp, Edit2, Trash2, Plus, Lock, Folder, CornerDownLeft, Star
} from "lucide-react";
import { generateTOTP, getTotpPercentage, resolveDomain, isWebPageUrl, isInternalBrowserHost } from "@vaultr/core";

type Template = "login" | "card" | "address" | "profile" | "note";

interface VaultScreenProps {
  items: VaultItem[];
  onDecryptItem: (encryptedBlob: string, itemId?: string) => Promise<any>;
  onAutofill: (cred: { username?: string; password?: string }) => void;
  onEditItem: (item: VaultItem, decryptedPayload: any) => void;
  onDeleteItem: (id: string) => Promise<void>;
  onToggleFavorite?: (id: string) => void;
  onAddNew: () => void;
}

// ─── SiteIcon Component (Reusing @vaultr/core resolveDomain) ────────────────

function SiteIcon({ domain, name, url }: { domain?: string; name: string; url?: string }) {
  const [hasError, setHasError] = useState(false);
  const effectiveDomain = useMemo(() => resolveDomain(domain, name, url), [domain, name, url]);

  if (!effectiveDomain || hasError) {
    return (
      <div className="site-icon">
        <Globe size={20} style={{ color: "#a3a3a3" }} />
      </div>
    );
  }

  const isAndroid = effectiveDomain === "android" || effectiveDomain === "androidapp"
    || effectiveDomain.startsWith("android:") || effectiveDomain.startsWith("androidapp:");

  const src = isAndroid
    ? "https://developer.android.com/static/images/brand/android-head_flat.png"
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`;

  return (
    <div className="site-icon">
      <img
        src={src}
        alt=""
        onError={() => setHasError(true)}
        style={{ width: "32px", height: "32px", maxWidth: "32px", maxHeight: "32px", objectFit: "contain" }}
      />
    </div>
  );
}


function getItemIcon(item: VaultItem) {
  const template = item.template || "login";

  if (template === "login") {
    return <SiteIcon domain={item.domain} name={item.name} url={(item as any).url} />;
  }

  if (template === "card") {
    const nameLower = item.name.toLowerCase();
    const isVisa = nameLower.includes("visa");
    const isMastercard = nameLower.includes("mastercard") || nameLower.includes("master card") || nameLower.includes(" mc");
    const isAmex = nameLower.includes("amex") || nameLower.includes("american express");
    const isDiscover = nameLower.includes("discover");
    const isRupay = nameLower.includes("rupay");

    let cardBadge: React.ReactNode;
    if (isVisa) {
      cardBadge = <img src="logos/Visa.svg" style={{ height: "16px", width: "auto", objectFit: "contain" }} alt="Visa" />;
    } else if (isMastercard) {
      cardBadge = <img src="logos/Mastercard.svg" style={{ height: "20px", width: "auto", objectFit: "contain" }} alt="Mastercard" />;
    } else if (isAmex) {
      cardBadge = <img src="logos/AMEX.svg" style={{ height: "20px", width: "auto", objectFit: "contain" }} alt="AMEX" />;
    } else if (isDiscover) {
      cardBadge = <img src="logos/Discover.svg" style={{ height: "14px", width: "auto", objectFit: "contain" }} alt="Discover" />;
    } else if (isRupay) {
      cardBadge = <img src="logos/Rupay.svg" style={{ height: "14px", width: "auto", objectFit: "contain" }} alt="RuPay" />;
    } else {
      cardBadge = <CreditCard size={20} style={{ color: "#a78bfa" }} />;
    }

    return (
      <div className="site-icon">
        {cardBadge}
      </div>
    );
  }

  let icon: React.ReactNode = <Lock size={20} style={{ color: "#818cf8" }} />;

  if (template === "address") {
    icon = <MapPin size={20} style={{ color: "#34d399" }} />;
  } else if (template === "profile") {
    icon = <User size={20} style={{ color: "#38bdf8" }} />;
  } else if (template === "note") {
    icon = <FileText size={20} style={{ color: "#fbbf24" }} />;
  }

  return (
    <div className="site-icon">
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

function MaskedValue({ value, dots = 12 }: { value: string; dots?: number }) {
  const [visible, setVisible] = useState(false);
  const maskText = "•".repeat(dots);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, width: "100%" }}>
      <span className="detail-value" style={{ color: visible ? "var(--neutral-200)" : "var(--neutral-500)", letterSpacing: visible ? "normal" : "2px" }}>
        {visible ? value : maskText}
      </span>
      <div className="detail-actions">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setVisible(!visible); }}
          className="detail-action-btn"
          title={visible ? "Hide" : "Show"}
        >
          {visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

function DetailRow({ label, value, masked = false, dots = 12 }: { label: string; value: string; masked?: boolean; dots?: number }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
        {masked ? (
          <MaskedValue value={value} dots={dots} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, width: "100%" }}>
            <span className="detail-value">{value}</span>
            <div className="detail-actions">
              <CopyBtn value={value} />
            </div>
          </div>
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

  const isExpiring = percent <= (5 / 30) * 100;

  return (
    <div className="detail-row">
      <span className="detail-label">2FA Code</span>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Countdown Ring */}
          <div style={{ position: "relative", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg style={{ width: 14, height: 14, transform: "rotate(-90deg)" }} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="var(--neutral-800)" strokeWidth="4" fill="none" />
              <circle cx="12" cy="12" r="10" stroke={isExpiring ? "#ef4444" : "#0ea5e9"} strokeWidth="4" fill="none"
                strokeDasharray="62.8"
                strokeDashoffset={62.8 * (1 - percent / 100)}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
              />
            </svg>
          </div>
          <span className="detail-value" style={{ color: isExpiring ? "#ef4444" : "#0ea5e9", fontWeight: 700, letterSpacing: "1px" }}>
            {code.slice(0, 3)} {code.slice(3, 6)}
          </span>
        </div>
        <div className="detail-actions">
          <CopyBtn value={code} />
        </div>
      </div>
    </div>
  );
}

function PasswordHistorySection({ history }: { history: string[] }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<number | null>(null);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          color: "#38bdf8",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          padding: 0,
        }}
      >
        Password history: {history.length}
      </button>

      {open && (
        <div className="detail-section-box" style={{ marginTop: 4 }}>
          {history.map((pw, i) => (
            <div key={i} className="detail-row">
              <span className="detail-value">
                {revealed === i ? pw : "••••••••••••"}
              </span>
              <div className="detail-actions">
                <button
                  type="button"
                  onClick={() => setRevealed(revealed === i ? null : i)}
                  className="detail-action-btn"
                >
                  {revealed === i ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <CopyBtn value={pw} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ItemRow Component ───────────────────────────────────────────────────────

interface ItemRowProps {
  item: VaultItem;
  onDecrypt: (blob: string, itemId?: string) => Promise<any>;
  onAutofill: (cred: { username?: string; password?: string }) => void;
  onEdit: (item: VaultItem, decryptedPayload: any) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite?: (id: string) => void;
  isCurrentSiteMatch?: boolean;
}

function ItemRow({ item, onDecrypt, onAutofill, onEdit, onDelete, onToggleFavorite, isCurrentSiteMatch }: ItemRowProps) {
  const [decrypted, setDecrypted] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !decrypted) {
      setLoading(true);
      try {
        const payload = await onDecrypt(item.encryptedBlob, item.id);
        setDecrypted(payload);
      } catch (err) {
        console.error("Decrypt failed:", err);
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, decrypted, item.encryptedBlob, item.id, onDecrypt]);

  const handleAutofillClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      let cred = decrypted;
      if (!cred) {
        try {
          cred = await onDecrypt(item.encryptedBlob, item.id);
          setDecrypted(cred);
        } catch {
          return;
        }
      }
      onAutofill({ username: cred.username, password: cred.password });
    },
    [decrypted, item.encryptedBlob, item.id, onDecrypt, onAutofill]
  );

  const handleEditClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      let payload = decrypted;
      if (!payload) {
        setLoading(true);
        try {
          payload = await onDecrypt(item.encryptedBlob, item.id);
          setDecrypted(payload);
        } catch (err) {
          console.error("Decrypt failed:", err);
          return;
        } finally {
          setLoading(false);
        }
      }
      if (payload) {
        onEdit(item, payload);
      }
    },
    [item, decrypted, onDecrypt, onEdit]
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
          {/* Favorite button */}
          <button
            type="button"
            className={`btn-favorite-icon${item.favorite ? " active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(item.id);
            }}
            title={item.favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star
              size={14}
              style={{
                color: item.favorite ? "#f59e0b" : "var(--neutral-600)",
                fill: item.favorite ? "#f59e0b" : "none",
              }}
            />
          </button>

          {/* Fill indicator badge for active site */}
          {isCurrentSiteMatch && isLogin && (
            <button
              type="button"
              className="btn-fill-badge"
              onClick={handleAutofillClick}
              title="Autofill on active page"
            >
              <CornerDownLeft size={11} />
              <span>Fill</span>
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
                  {(decrypted.username || decrypted.password) && (
                    <div className="detail-section-group">
                      <div className="detail-section-title">LOGIN CREDENTIALS</div>
                      <div className="detail-section-box">
                        {decrypted.username && <DetailRow label="Username" value={decrypted.username} />}
                        {decrypted.password && <DetailRow label="Password" value={decrypted.password} masked />}
                      </div>
                    </div>
                  )}

                  {decrypted.totpSecret && (
                    <div className="detail-section-group">
                      <div className="detail-section-title">AUTHENTICATOR</div>
                      <div className="detail-section-box">
                        <TotpDisplay secret={decrypted.totpSecret} />
                      </div>
                    </div>
                  )}

                  {(decrypted.url || (decrypted.urls && decrypted.urls.length > 0)) && (
                    <div className="detail-section-group">
                      <div className="detail-section-title">WEBSITE URLS</div>
                      <div className="detail-section-box">
                        {decrypted.urls && decrypted.urls.length > 0 ? (
                          decrypted.urls.map((u: string, i: number) => (
                            <DetailRow key={i} label={i === 0 ? "Website (URI)" : `Website #${i+1}`} value={u} />
                          ))
                        ) : (
                          <DetailRow label="Website (URI)" value={decrypted.url} />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Card Template */}
              {item.template === "card" && (
                <>
                  <div className="detail-section-group">
                    <div className="detail-section-title">CARD DETAILS</div>
                    <div className="detail-section-box">
                      {decrypted.cardName && <DetailRow label="Cardholder" value={decrypted.cardName} />}
                      {decrypted.cardNumber && <DetailRow label="Number" value={decrypted.cardNumber} masked />}
                    </div>
                  </div>

                  {(decrypted.expiry || decrypted.cvv || decrypted.pin) && (
                    <div className="detail-section-group">
                      <div className="detail-section-title">SECURITY & VALIDITY</div>
                      <div className="detail-section-box">
                        {decrypted.expiry && <DetailRow label="Expires" value={decrypted.expiry} />}
                        {decrypted.cvv && <DetailRow label="CVV" value={decrypted.cvv} masked dots={3} />}
                        {decrypted.pin && <DetailRow label="PIN" value={decrypted.pin} masked dots={3} />}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Address Template */}
              {item.template === "address" && (
                <>
                  {(decrypted.line1 || decrypted.line2) && (
                    <div className="detail-section-group">
                      <div className="detail-section-title">STREET ADDRESS</div>
                      <div className="detail-section-box">
                        {decrypted.line1 && <DetailRow label="Line 1" value={decrypted.line1} />}
                        {decrypted.line2 && <DetailRow label="Line 2" value={decrypted.line2} />}
                      </div>
                    </div>
                  )}
                  {(decrypted.city || decrypted.state || decrypted.zip || decrypted.country) && (
                    <div className="detail-section-group">
                      <div className="detail-section-title">LOCATION</div>
                      <div className="detail-section-box">
                        {decrypted.city && <DetailRow label="City" value={decrypted.city} />}
                        {decrypted.state && <DetailRow label="State" value={decrypted.state} />}
                        {decrypted.zip && <DetailRow label="ZIP Code" value={decrypted.zip} />}
                        {decrypted.country && <DetailRow label="Country" value={decrypted.country} />}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Profile Template */}
              {item.template === "profile" && (
                <div className="detail-section-group">
                  <div className="detail-section-title">PERSONAL IDENTITY</div>
                  <div className="detail-section-box">
                    {decrypted.fullName && <DetailRow label="Full Name" value={decrypted.fullName} />}
                    {decrypted.email && <DetailRow label="Email" value={decrypted.email} />}
                    {decrypted.phone && <DetailRow label="Phone" value={decrypted.phone} />}
                    {decrypted.dob && <DetailRow label="DOB" value={decrypted.dob} />}
                    {decrypted.idNumber && <DetailRow label="ID Number" value={decrypted.idNumber} masked />}
                  </div>
                </div>
              )}

              {/* Note Template */}
              {item.template === "note" && decrypted.note && (
                <div className="detail-section-group">
                  <div className="detail-section-title">SECURE NOTE</div>
                  <div className="detail-section-box" style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--neutral-600)" }}>CONTENT</span>
                      <CopyBtn value={decrypted.note} />
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 11, color: "var(--neutral-300)" }}>{decrypted.note}</pre>
                  </div>
                </div>
              )}

              {/* Entry Notes (Shared) */}
              {decrypted.entryNotes && (
                <div className="detail-section-group">
                  <div className="detail-section-title">PRIVATE NOTES</div>
                  <div className="detail-section-box" style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--neutral-600)" }}>NOTES</span>
                      <CopyBtn value={decrypted.entryNotes} />
                    </div>
                    <p style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "var(--neutral-400)", lineHeight: 1.4 }}>{decrypted.entryNotes}</p>
                  </div>
                </div>
              )}

              {/* Password History */}
              {decrypted.passwordHistory && Array.isArray(decrypted.passwordHistory) && decrypted.passwordHistory.length > 0 && (
                <PasswordHistorySection history={decrypted.passwordHistory} />
              )}

              {/* Action buttons */}
              <div className="expanded-actions-row">
                {isLogin && (decrypted.username || decrypted.password) ? (
                  <button
                    className="btn-expanded-primary"
                    onClick={handleAutofillClick}
                  >
                    <CornerDownLeft size={14} />
                    <span>Autofill</span>
                  </button>
                ) : <div />}

                <div className="expanded-icon-actions">
                  <button
                    className="btn-expanded-icon"
                    onClick={handleEditClick}
                    title="Edit entry"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn-expanded-icon-danger"
                    onClick={handleDeleteClick}
                    title="Move to Trash"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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
  onToggleFavorite,
  onAddNew
}: VaultScreenProps) {
  const [query, setQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("All");
  const [activeTabDomain, setActiveTabDomain] = useState<string>("");

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabUrl = tabs[0]?.url || "";
        if (tabUrl && isWebPageUrl(tabUrl)) {
          try {
            const url = new URL(tabUrl);
            const host = url.hostname.replace(/^www\./, "").toLowerCase();
            if (host && !isInternalBrowserHost(host)) {
              setActiveTabDomain(host);
              return;
            }
          } catch {}
        }
        setActiveTabDomain("");
      });
    }
  }, []);

  // Filter out Trash (soft deleted) items
  const activeItems = useMemo(() => {
    return items.filter((i) => !i.deletedAt);
  }, [items]);

  // Extract unique folders from active items
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const item of activeItems) {
      if (item.folder && item.folder.trim()) {
        set.add(item.folder.trim());
      }
    }
    return Array.from(set).sort();
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    let list = activeItems;
    if (selectedFolder !== "All") {
      list = list.filter((i) => (i.folder || "").trim() === selectedFolder);
    }
    const q = query.toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.domain || "").toLowerCase().includes(q)
    );
  }, [activeItems, selectedFolder, query]);

  const matchedItems = useMemo(() => {
    if (!activeTabDomain || query) return [];
    return activeItems.filter((i) => {
      const template = i.template || "login";
      if (template !== "login") return false;

      const rawDomain = (i.domain || (i as any).url || "").trim();
      if (!rawDomain) return false;

      const d = rawDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
      if (!d) return false;

      return (
        d === activeTabDomain ||
        d.includes(activeTabDomain) ||
        (d.length >= 4 && activeTabDomain.includes(d))
      );
    });
  }, [activeItems, activeTabDomain, query]);

  const shownItems = filteredItems;
  const matchIds = new Set(matchedItems.map((m) => m.id));

  return (
    <div className="screen">
      {/* Search & Add Bar */}
      <div className="search-wrap" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div className="search-field" style={{ flex: 1 }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault…"
          />
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className="btn btn-primary"
          style={{
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            borderRadius: 10,
            cursor: "pointer"
          }}
          title="Add New Entry"
        >
          <Plus size={14} />
          <span>New</span>
        </button>
      </div>

      {/* Folder Navigation Bar */}
      {folders.length > 0 && (
        <div className="folder-nav-wrap">
          <button
            className={`folder-pill${selectedFolder === "All" ? " active" : ""}`}
            onClick={() => setSelectedFolder("All")}
          >
            <Folder size={11} />
            All
          </button>
          {folders.map((f) => (
            <button
              key={f}
              className={`folder-pill${selectedFolder === f ? " active" : ""}`}
              onClick={() => setSelectedFolder(f)}
            >
              <Folder size={11} />
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="screen-body" style={{ paddingBottom: 72 }}>
        {/* Matches */}
        {matchedItems.length > 0 && !query && selectedFolder === "All" && (
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
                  onToggleFavorite={onToggleFavorite}
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
              {query ? "No results found" : selectedFolder !== "All" ? `No items in ${selectedFolder}` : "No items in vault"}
            </div>
            <div style={{ fontSize: 11 }}>{query ? `Nothing matched "${query}"` : "Tap + to add your first secure record"}</div>
          </div>
        ) : (
          <>
            {matchedItems.length > 0 && !query && selectedFolder === "All" && (
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
                  onToggleFavorite={onToggleFavorite}
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
