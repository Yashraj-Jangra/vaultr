"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
import { deriveKey, reEncryptBlobs } from "@/hooks/useCrypto";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Timer,
  Clipboard,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Monitor,
  ShieldCheck,
  Trash2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useSession } from "@/lib/auth/auth-client";
import { saveVaultSession } from "@/hooks/useVaultSession";

function StatusMsg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <span className={`text-[12px] flex items-center gap-1.5 ${ok ? "text-emerald-400" : "text-red-400"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      {text}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col md:flex-row gap-8 py-10 border-b border-[var(--border)] last:border-0">
      <div className="w-full md:w-1/3 shrink-0">
        <h2 className="text-[14px] font-semibold text-neutral-200">{title}</h2>
        {description && <p className="text-[13px] text-neutral-500 mt-1.5 pr-4 leading-relaxed">{description}</p>}
      </div>
      <div className="w-full md:flex-1 space-y-4">
        {children}
      </div>
    </section>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-xl p-5">
      {children}
    </div>
  );
}

function LockOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors border ${
        active
          ? "border-[var(--accent)] text-[var(--accent)] bg-neutral-900"
          : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
      }`}
    >
      {label}
    </button>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative max-w-md">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-[13px] bg-neutral-900 border-neutral-800"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const CLIPBOARD_KEY = (uid: string) => `vaultr_clipboard_clear_s_${uid}`;

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const { items, cryptoKey, autoLockMinutes, setAutoLockMinutes } = useVault();

  // Change master password state
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [pwProgress, setPwProgress] = useState(0); 
  const [pwTotal, setPwTotal] = useState(0);
  const [pwDone, setPwDone] = useState(0);
  const [pwMsg, setPwMsg] = useState({ text: "", ok: true });
  const [lastChanged, setLastChanged] = useState<string | null>(null);

  // Clipboard timer
  const [clipboardSecs, setClipboardSecs] = useState<number>(() => {
    if (typeof window === "undefined" || !user?.uid) return 0;
    return Number(localStorage.getItem(CLIPBOARD_KEY(user.uid)) ?? 0);
  });

  // Load profile settings
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/vault/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.lastPasswordChangedAt) setLastChanged(data.lastPasswordChangedAt);
          if (data.newDeviceEmailAlert !== undefined) setNewDeviceEmailAlert(data.newDeviceEmailAlert);
          if (data.requireVerificationOnNew !== undefined) setRequireVerifOnNew(data.requireVerificationOnNew);
        }
      } catch (err) {
        console.error("Could not fetch security profile:", err);
      }
    };
    fetchProfile();
  }, [user]);

  // Load provider accounts
  const [accounts, setAccounts] = useState<{ id: string; providerId: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    authClient.listAccounts().then((res) => {
      if (res.data) setAccounts(res.data.map(acc => ({ id: acc.id, providerId: acc.providerId })));
    }).catch(() => {});
  }, [user]);

  const saveClipboard = (secs: number) => {
    setClipboardSecs(secs);
    if (user?.uid) {
      if (secs === 0) localStorage.removeItem(CLIPBOARD_KEY(user.uid));
      else localStorage.setItem(CLIPBOARD_KEY(user.uid), String(secs));
    }
  };

  const handleChangePw = async () => {
    if (!user?.uid) return;
    setPwMsg({ text: "", ok: true });

    if (!oldPw || !newPw || !confirmPw) return setPwMsg({ text: "Please fill in all password fields.", ok: false });
    if (newPw !== confirmPw) return setPwMsg({ text: "New passwords do not match.", ok: false });
    if (newPw.length < 8) return setPwMsg({ text: "New master password must be at least 8 characters.", ok: false });
    if (oldPw === newPw) return setPwMsg({ text: "New master password must differ from the old one.", ok: false });

    setPwChanging(true);

    try {
      const oldKey = await deriveKey(oldPw, user.uid);
      const liveItems = items.filter((i) => !i.deletedAt);
      if (liveItems.length > 0) {
        const { decrypt } = await import("@/hooks/useCrypto");
        try {
          await decrypt(oldKey, liveItems[0].encryptedBlob);
        } catch {
          setPwMsg({ text: "Old master password is incorrect.", ok: false });
          setPwChanging(false);
          return;
        }
      }

      const newKey = await deriveKey(newPw, user.uid);
      const toReEncrypt = liveItems.map((i) => ({ id: i.id, encryptedBlob: i.encryptedBlob }));

      setPwTotal(toReEncrypt.length);
      setPwDone(0);
      setPwProgress(0);

      const reEncrypted = await reEncryptBlobs(toReEncrypt, oldKey, newKey, (done, total) => {
        setPwDone(done);
        setPwProgress(Math.round((done / total) * 100));
      });

      const reencRes = await fetch("/api/vault/items/reencrypt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: reEncrypted }),
      });
      if (!reencRes.ok) throw new Error((await reencRes.json()).error || "Batch re-encryption failed.");

      saveVaultSession(user.uid, newPw);
      const now = new Date().toISOString();
      await fetch("/api/vault/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastPasswordChangedAt: now }),
      });
      setLastChanged(now);

      setOldPw(""); setNewPw(""); setConfirmPw(""); setPwProgress(0);
      setPwMsg({ text: `Master password changed. ${reEncrypted.length} item(s) re-encrypted.`, ok: true });
    } catch (err) {
      setPwMsg({ text: (err as Error).message || "An error occurred.", ok: false });
    } finally {
      setPwChanging(false);
    }
  };

  const liveCount = items.filter((i) => !i.deletedAt).length;
  const isVaultLocked = !cryptoKey;

  const { data: currentSession } = useSession();
  const [revokeAllBusy, setRevokeAllBusy] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const [newDeviceEmailAlert, setNewDeviceEmailAlert] = useState(true);
  const [requireVerifOnNew, setRequireVerifOnNew] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  const saveNotifPrefs = async (field: string, value: boolean) => {
    if (!user?.uid) return;
    setNotifSaving(true);
    try {
      await fetch("/api/vault/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err) {
      console.error("Failed to save preference:", err);
    } finally {
      setNotifSaving(false);
    }
  };

  const handleRevokeAllConfirmed = async () => {
    setConfirmRevokeAll(false);
    setRevokeAllBusy(true);
    await authClient.revokeOtherSessions();
    setRevokeAllBusy(false);
  };

  return (
    <div className="pb-20 max-w-5xl mx-auto">
      <div className="mb-10 border-b border-[var(--border)] pb-6">
        <h1 className="text-[22px] font-semibold text-neutral-100">Security</h1>
        <p className="text-[14px] text-neutral-500 mt-1">Change your master password, configure auto-lock, and manage sessions.</p>
      </div>

      <Section title="Master Password" description="Re-derives your AES-256-GCM key and re-encrypts all vault blobs atomically.">
        <FieldBox>
          <div className="space-y-5">
            {isVaultLocked ? (
              <div className="text-[13px] text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-4 py-3 inline-flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Unlock your vault first before changing the master password.</span>
              </div>
            ) : (
              <>
                {lastChanged && (
                  <p className="text-[12px] text-neutral-500 font-medium">
                    Last changed: <span className="text-neutral-300">{new Date(lastChanged).toLocaleDateString()}</span>
                  </p>
                )}
                <div className="space-y-4">
                  <PasswordInput id="old-pw" value={oldPw} onChange={setOldPw} placeholder="Current master password" />
                  <PasswordInput id="new-pw" value={newPw} onChange={setNewPw} placeholder="New master password (min 8 chars)" />
                  <PasswordInput id="confirm-pw" value={confirmPw} onChange={setConfirmPw} placeholder="Confirm new master password" />
                </div>
                
                {pwChanging && pwTotal > 0 && (
                  <div className="max-w-md pt-2 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-neutral-400 font-medium">
                      <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-encrypting…</span>
                      <span>{pwDone} / {pwTotal}</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${pwProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2">
                  <Button onClick={handleChangePw} disabled={pwChanging} variant="primary">
                    {pwChanging ? "Changing…" : "Change Password"}
                  </Button>
                  <StatusMsg {...pwMsg} />
                  <span className="text-[12px] text-neutral-500 ml-auto hidden sm:block">{liveCount} item(s) will be re-encrypted.</span>
                </div>
              </>
            )}
          </div>
        </FieldBox>
      </Section>

      <Section title="Behavior" description="Automatically lock your vault or clear your clipboard to prevent unauthorized access.">
        <div className="space-y-6">
          <FieldBox>
            <div className="space-y-4">
              <h3 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Timer className="w-3.5 h-3.5" /> Auto-Lock Timer
              </h3>
              <div className="flex flex-wrap gap-2">
                {[ { label: "Never", value: 0 }, { label: "5 min", value: 5 }, { label: "15 min", value: 15 }, { label: "30 min", value: 30 }, { label: "1 hour", value: 60 }].map(({ label, value }) => (
                  <LockOption key={value} label={label} active={autoLockMinutes === value} onClick={() => setAutoLockMinutes(value)} />
                ))}
              </div>
            </div>
          </FieldBox>

          <FieldBox>
            <div className="space-y-4">
              <h3 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5" /> Clipboard Auto-Clear
              </h3>
              <div className="flex flex-wrap gap-2">
                {[ { label: "Off", value: 0 }, { label: "30 secs", value: 30 }, { label: "60 secs", value: 60 }].map(({ label, value }) => (
                  <LockOption key={value} label={label} active={clipboardSecs === value} onClick={() => saveClipboard(value)} />
                ))}
              </div>
            </div>
          </FieldBox>
        </div>
      </Section>

      <Section title="Two-Factor Auth" description="Protect your account login with an additional factor.">
        <FieldBox>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {accounts.map((p) => (
                <span key={p.id} className="text-[12px] font-medium px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-200">
                  {p.providerId === "google" ? "Google Account" : "Email & Password"}
                </span>
              ))}
            </div>
            <p className="text-[13px] text-neutral-500 pt-2 border-t border-neutral-800">
              To enable TOTP 2FA, contact your administrator.
            </p>
          </div>
        </FieldBox>
      </Section>

      <Section title="Sessions & Devices" description="Review active devices and manage notification preferences.">
        <div className="space-y-6">
          <FieldBox>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5" /> Active Sessions
                </h3>
                <button onClick={() => setConfirmRevokeAll(true)} disabled={revokeAllBusy} className="text-[13px] font-medium text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors">
                  <Trash2 className="w-4 h-4" /> Sign out other devices
                </button>
              </div>

              {confirmRevokeAll && (
                <div className="p-5 rounded-xl border border-red-900/30 bg-red-950/20 space-y-4">
                  <p className="text-[13px] text-red-400 font-medium">Revoke all other sessions? You will be signed out from all devices except this one.</p>
                  <div className="flex gap-3">
                    <Button onClick={handleRevokeAllConfirmed} variant="danger" disabled={revokeAllBusy}>
                      {revokeAllBusy ? "Revoking…" : "Yes, revoke all"}
                    </Button>
                    <Button onClick={() => setConfirmRevokeAll(false)} variant="ghost">Cancel</Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[13px] font-semibold text-emerald-400">Current Device</p>
                  {currentSession?.session?.ipAddress && (
                    <p className="text-[12px] text-emerald-500/70 font-mono">IP: {currentSession.session.ipAddress}</p>
                  )}
                </div>
              </div>
            </div>
          </FieldBox>

          <FieldBox>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-widest">Security Alerts</h3>
                {notifSaving && <span className="text-[11px] text-neutral-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Saving</span>}
              </div>
              
              <div className="space-y-4">
                {[
                  { label: "Email alerts for new sign-ins", key: "newDeviceEmailAlert" as const, val: newDeviceEmailAlert, set: setNewDeviceEmailAlert },
                  { label: "Require email verification for new devices", key: "requireVerificationOnNew" as const, val: requireVerifOnNew, set: setRequireVerifOnNew },
                ].map(({ label, key, val, set }) => (
                  <label key={key} className="flex items-center gap-4 cursor-pointer group">
                    <input type="checkbox" checked={val} onChange={(e) => { set(e.target.checked); saveNotifPrefs(key, e.target.checked); }} className="sr-only" />
                    
                    {/* Improved Sleek Toggle Design */}
                    <div className={`w-[36px] h-[20px] rounded-full transition-colors relative border ${
                      val 
                        ? "bg-[var(--accent)] border-[var(--accent)]" 
                        : "bg-neutral-900 border-neutral-700 group-hover:border-neutral-500"
                    }`}>
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all shadow-sm ${
                        val 
                          ? "bg-white left-[18px]" 
                          : "bg-neutral-500 left-[2px] group-hover:bg-neutral-300"
                      }`} />
                    </div>
                    
                    <span className="text-[13px] text-neutral-300 group-hover:text-neutral-100 transition-colors font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </FieldBox>
        </div>
      </Section>
    </div>
  );
}
