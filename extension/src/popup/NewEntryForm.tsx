import React, { useState, useMemo } from "react";
import {
  Lock, CreditCard, FileText, User, Plus, Minus, X, Wand2, KeyRound, Star
} from "lucide-react";
import { VaultItem } from "@vaultr/core";

type Template = "login" | "card" | "address" | "profile" | "note";

interface CustomField {
  id: string;
  key: string;
  value: string;
}

export interface DecryptedPayload {
  _template?: Template;
  _folder?: string;
  // login
  username?: string;
  password?: string;
  url?: string;
  urls?: string[];
  // card
  cardName?: string;
  cardNumber?: string;
  cardBrand?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;
  // address
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  // profile
  fullName?: string;
  dob?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  // note
  note?: string;
  // shared
  customFields?: { key: string; value: string }[];
  totpSecret?: string;
  entryNotes?: string;
}

interface NewEntryFormProps {
  folders: string[];
  onSave: (
    name: string,
    template: Template,
    folder: string,
    tags: string[],
    payload: DecryptedPayload,
    editId?: string,
    favorite?: boolean
  ) => Promise<void>;
  onCancel: () => void;
  initialData?: {
    id: string;
    name: string;
    folder?: string;
    tags?: string[];
    template: Template;
    payload: DecryptedPayload;
    favorite?: boolean;
  };
}

// ─── Password Generator Widget ───────────────────────────────────────────────

function generatePassword(len: number, upper: boolean, lower: boolean, nums: boolean, syms: boolean): string {
  const U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const L = "abcdefghijklmnopqrstuvwxyz";
  const N = "0123456789";
  const S = "!@#$%^&*-_=+";
  let pool = "";
  if (upper) pool += U;
  if (lower) pool += L;
  if (nums) pool += N;
  if (syms) pool += S;
  if (!pool) return "";
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(v => pool[v % pool.length]).join("");
}

function PasswordGen({ onUse }: { onUse: (pw: string) => void }) {
  const [len, setLen] = useState(20);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [nums, setNums] = useState(true);
  const [syms, setSyms] = useState(false);
  const [seed, setSeed] = useState(0);

  const pw = useMemo(
    () => generatePassword(len, upper, lower, nums, syms),
    [len, upper, lower, nums, syms, seed]
  );

  return (
    <div style={{ padding: 10, background: "var(--neutral-900)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--neutral-400)" }}>Password Generator</span>
        <button
          type="button"
          onClick={() => setSeed(s => s + 1)}
          className="btn btn-ghost"
          style={{ padding: "2px 6px", fontSize: 10 }}
        >
          Regenerate
        </button>
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 13, background: "#000", padding: "6px 10px", borderRadius: 6, color: "#10b981", wordBreak: "break-all" }}>
        {pw}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--neutral-400)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={upper} onChange={e => setUpper(e.target.checked)} /> A-Z
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={lower} onChange={e => setLower(e.target.checked)} /> a-z
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={nums} onChange={e => setNums(e.target.checked)} /> 0-9
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={syms} onChange={e => setSyms(e.target.checked)} /> !@#
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: "var(--neutral-500)" }}>Length: {len}</span>
        <input
          type="range"
          min={8}
          max={64}
          value={len}
          onChange={e => setLen(Number(e.target.value))}
          style={{ flex: 1 }}
        />
      </div>

      <button
        type="button"
        onClick={() => onUse(pw)}
        className="btn btn-ghost"
        style={{ padding: "6px", fontSize: 11, justifyContent: "center" }}
      >
        Use Password
      </button>
    </div>
  );
}

// ─── Main Form Component ─────────────────────────────────────────────────────

export function NewEntryForm({ folders, onSave, onCancel, initialData }: NewEntryFormProps) {
  const [template, setTemplate] = useState<Template>(initialData?.template || "login");
  const [name, setName] = useState(initialData?.name || "");
  const [folder, setFolder] = useState(initialData?.folder || "");
  const [newFolder, setNewFolder] = useState("");
  const [tags, setTags] = useState<string>(
    Array.isArray(initialData?.tags) ? initialData.tags.join(", ") : ""
  );
  const [favorite, setFavorite] = useState<boolean>(initialData?.favorite || false);
  const [saving, setSaving] = useState(false);
  const [showGen, setShowGen] = useState(false);

  // Login
  const [username, setUsername] = useState(initialData?.payload?.username || "");
  const [password, setPassword] = useState(initialData?.payload?.password || "");
  const [urls, setUrls] = useState<string[]>(() => {
    const arr = Array.isArray(initialData?.payload?.urls) ? [...initialData.payload.urls] : [];
    if (initialData?.payload?.url && !arr.includes(initialData.payload.url)) {
      arr.unshift(initialData.payload.url);
    }
    return arr.length > 0 ? arr : [""];
  });
  const [totpSecret, setTotpSecret] = useState(initialData?.payload?.totpSecret || "");
  const [showTotpField, setShowTotpField] = useState(!!initialData?.payload?.totpSecret);

  // Card
  const [cardName, setCardName] = useState(initialData?.payload?.cardName || "");
  const [cardNumber, setCardNumber] = useState(initialData?.payload?.cardNumber || "");
  const [expiry, setExpiry] = useState(initialData?.payload?.expiry || "");
  const [cvv, setCvv] = useState(initialData?.payload?.cvv || "");
  const [pin, setPin] = useState(initialData?.payload?.pin || "");

  // Address
  const [line1, setLine1] = useState(initialData?.payload?.line1 || "");
  const [line2, setLine2] = useState(initialData?.payload?.line2 || "");
  const [city, setCity] = useState(initialData?.payload?.city || "");
  const [stateVal, setStateVal] = useState(initialData?.payload?.state || "");
  const [zip, setZip] = useState(initialData?.payload?.zip || "");
  const [country, setCountry] = useState(initialData?.payload?.country || "");

  // Profile
  const [fullName, setFullName] = useState(initialData?.payload?.fullName || "");
  const [dob, setDob] = useState(initialData?.payload?.dob || "");
  const [idNumber, setIdNumber] = useState(initialData?.payload?.idNumber || "");
  const [profEmail, setProfEmail] = useState(initialData?.payload?.email || "");
  const [phone, setPhone] = useState(initialData?.payload?.phone || "");

  // Note
  const [note, setNote] = useState(initialData?.payload?.note || "");

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    if (initialData?.payload?.customFields && Array.isArray(initialData.payload.customFields)) {
      return initialData.payload.customFields.map((f, i) => ({
        id: `cf_${i}`,
        key: f.key,
        value: f.value,
      }));
    }
    return [];
  });
  const addCustom = () => setCustomFields(p => [...p, { id: Math.random().toString(), key: "", value: "" }]);

  // Shared
  const [entryNotes, setEntryNotes] = useState(initialData?.payload?.entryNotes || "");

  const activeFolder = folder === "__new__" ? newFolder.trim() : folder;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload: DecryptedPayload = {
      _template: template,
      _folder: activeFolder || undefined,
      customFields: customFields.filter(f => f.key.trim() || f.value.trim()).map(f => ({ key: f.key, value: f.value })),
      entryNotes: entryNotes.trim() ? entryNotes.trim() : undefined,
    };
    if (template === "login") {
      const validUrls = urls.map(u => u.trim()).filter(Boolean);
      Object.assign(payload, {
        username,
        password,
        url: validUrls[0] || "",
        urls: validUrls,
        totpSecret: totpSecret.trim()
      });
    }
    if (template === "card") Object.assign(payload, { cardName, cardNumber, expiry, cvv, pin });
    if (template === "address") Object.assign(payload, { line1, line2, city, state: stateVal, zip, country });
    if (template === "profile") Object.assign(payload, { fullName, dob, idNumber, email: profEmail, phone });
    if (template === "note") Object.assign(payload, { note });

    const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);

    try {
      await onSave(name.trim(), template, activeFolder, parsedTags, payload, initialData?.id, favorite);
    } catch (err) {
      console.error("Save entry failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const TEMPLATES: { id: Template; label: string; icon: React.ReactNode }[] = [
    { id: "login",   label: "Login",   icon: <Lock size={12} /> },
    { id: "card",    label: "Card",    icon: <CreditCard size={12} /> },
    { id: "note",    label: "Note",    icon: <FileText size={12} /> },
    { id: "address", label: "Address", icon: <FileText size={12} /> },
    { id: "profile", label: "Profile", icon: <User size={12} /> },
  ];

  const activeIcon = TEMPLATES.find(t => t.id === template)?.icon;

  return (
    <div className="dialog-panel">
      {/* Header */}
      <div className="dialog-header">
        <div className="dialog-title">
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--neutral-900)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {activeIcon}
          </div>
          <span>{initialData ? "Edit entry" : "New entry"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            className="dialog-close"
            style={{ color: favorite ? "#f59e0b" : "var(--neutral-500)" }}
            title={favorite ? "Favorited" : "Add to Favorites"}
          >
            <Star size={15} fill={favorite ? "#f59e0b" : "none"} />
          </button>
          <button type="button" onClick={onCancel} className="dialog-close">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="dialog-body">
        {/* Type pills (Fixed in edit mode) */}
        <div className="form-group">
          <span className="form-label">Type</span>
          {initialData ? (
            <div style={{ display: "inline-flex", gap: 6, padding: "5px 10px", borderRadius: 8, background: "var(--neutral-900)", border: "1px solid var(--border)", width: "fit-content", fontSize: 12, color: "var(--neutral-400)" }}>
              {activeIcon}
              <span style={{ fontWeight: 600 }}>{template.toUpperCase()}</span>
              <span style={{ color: "var(--neutral-600)" }}>(Type Fixed)</span>
            </div>
          ) : (
            <div className="type-pills">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={`type-pill${template === t.id ? " active" : ""}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="form-group">
          <span className="form-label">Name</span>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={
              template === "login"   ? "Gmail, GitHub" :
              template === "card"    ? "Visa Personal" :
              template === "address" ? "Home, Office" :
              template === "profile" ? "Personal ID" :
                                       "Note title"
            }
          />
        </div>

        {/* Folder */}
        <div className="form-group">
          <span className="form-label">Folder</span>
          <select
            className="form-select"
            value={folder}
            onChange={e => setFolder(e.target.value)}
          >
            <option value="">(No folder)</option>
            {folders.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
            <option value="__new__">+ Create new folder…</option>
          </select>
          {folder === "__new__" && (
            <input
              type="text"
              className="form-input"
              style={{ marginTop: 6 }}
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
              placeholder="New folder name"
            />
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

        {/* Template Specific Fields */}
        {template === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <span className="form-label">Credentials</span>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username / Email"
              />
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input
                  type="text"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  style={{ fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  onClick={() => setShowGen(!showGen)}
                  className={`btn btn-ghost${showGen ? " active" : ""}`}
                  style={{ padding: "8px 12px" }}
                >
                  <Wand2 size={14} />
                </button>
              </div>
              {showGen && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--surface)", marginTop: 6 }}>
                  <PasswordGen onUse={pw => { setPassword(pw); setShowGen(false); }} />
                </div>
              )}
            </div>

            <div className="form-group">
              <span className="form-label">URLs</span>
              {urls.map((u, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input
                    type="text"
                    className="form-input"
                    value={u}
                    onChange={e => setUrls(p => p.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder="https://…"
                  />
                  {i === urls.length - 1 ? (
                    <button type="button" onClick={() => setUrls(p => [...p, ""])} className="btn btn-ghost" style={{ padding: "8px 10px" }}><Plus size={13} /></button>
                  ) : (
                    <button type="button" onClick={() => setUrls(p => p.filter((_, idx) => idx !== i))} className="btn btn-ghost" style={{ padding: "8px 10px" }}><Minus size={13} /></button>
                  )}
                </div>
              ))}
            </div>

            {!showTotpField ? (
              <button type="button" onClick={() => setShowTotpField(true)} className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px", width: "fit-content" }}>
                <Plus size={12} style={{ marginRight: 4 }} /> Add 2FA Secret
              </button>
            ) : (
              <div className="form-group">
                <span className="form-label">2FA Key</span>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    className="form-input"
                    value={totpSecret}
                    onChange={e => setTotpSecret(e.target.value)}
                    placeholder="Base32 secret key"
                    style={{ fontFamily: "monospace", paddingRight: 50 }}
                  />
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: "var(--neutral-600)", background: "var(--neutral-900)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 4px" }}>TOTP</div>
                </div>
              </div>
            )}
          </div>
        )}

        {template === "card" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <span className="form-label">Card Details</span>
              <input
                type="text"
                className="form-input"
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                placeholder="Cardholder Name"
              />
              <input
                type="text"
                className="form-input"
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                placeholder="Card Number"
                style={{ fontFamily: "monospace", marginTop: 6 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
                <input type="text" className="form-input" value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="MM/YY" />
                <input type="password" className="form-input" value={cvv} onChange={e => setCvv(e.target.value)} placeholder="CVV" />
                <input type="password" className="form-input" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" />
              </div>
            </div>
          </div>
        )}

        {template === "address" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <span className="form-label">Address</span>
              <input type="text" className="form-input" value={line1} onChange={e => setLine1(e.target.value)} placeholder="Address Line 1" />
              <input type="text" className="form-input" value={line2} onChange={e => setLine2(e.target.value)} placeholder="Address Line 2" style={{ marginTop: 6 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                <input type="text" className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                <input type="text" className="form-input" value={stateVal} onChange={e => setStateVal(e.target.value)} placeholder="State" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                <input type="text" className="form-input" value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP/Postal" />
                <input type="text" className="form-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
              </div>
            </div>
          </div>
        )}

        {template === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <span className="form-label">Profile</span>
              <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                <input type="email" className="form-input" value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="Email" />
                <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                <input type="text" className="form-input" value={dob} onChange={e => setDob(e.target.value)} placeholder="DOB" />
                <input type="text" className="form-input" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="ID/Passport" />
              </div>
            </div>
          </div>
        )}

        {template === "note" && (
          <div className="form-group">
            <span className="form-label">Note Content</span>
            <textarea
              className="form-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Write secure note content…"
              rows={5}
              style={{ resize: "none", height: 100 }}
            />
          </div>
        )}

        {/* Private Notes (Common to non-notes) */}
        {template !== "note" && (
          <div className="form-group">
            <span className="form-label">Notes</span>
            <textarea
              className="form-input"
              value={entryNotes}
              onChange={e => setEntryNotes(e.target.value)}
              placeholder="Private notes (optional)…"
              rows={3}
              style={{ resize: "none", height: 60 }}
            />
          </div>
        )}

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <div className="form-group">
            <span className="form-label">Custom Fields</span>
            {customFields.map(f => (
              <div key={f.id} className="custom-field-row" style={{ marginBottom: 4 }}>
                <input type="text" className="form-input" value={f.key} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, key: e.target.value } : x))} placeholder="Label" style={{ width: "35%" }} />
                <input type="text" className="form-input" value={f.value} onChange={e => setCustomFields(p => p.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} placeholder="Value" />
                <button type="button" onClick={() => setCustomFields(p => p.filter(x => x.id !== f.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-600)", padding: 4 }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={addCustom} className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px", width: "fit-content" }}>
          <Plus size={12} style={{ marginRight: 4 }} /> Add Custom Field
        </button>
      </div>

      {/* Footer */}
      <div className="dialog-footer">
        <span style={{ fontSize: 10, color: "var(--neutral-600)", display: "flex", alignItems: "center", gap: 4 }}>
          <Lock size={10} /> Encrypted locally
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSave} className="btn btn-primary" disabled={!name.trim() || saving}>
            {saving ? "Saving…" : initialData ? "Save Changes" : "Encrypt & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
