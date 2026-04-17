"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useVault } from "@/context/VaultContext";
import { deriveKey, reEncryptBlobs } from "@/hooks/useCrypto";
import { auth, db } from "@/lib/firebase/client";
import {
  writeBatch,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  KeyRound,
  Timer,
  Clipboard,
  Shield,
  Check,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Mail,
  Loader2,
  Trash2,
} from "lucide-react";
import { saveVaultSession } from "@/hooks/useVaultSession";
import { useSessionManager } from "@/hooks/useSessionManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[var(--border)] rounded-xl p-6 space-y-5 bg-[var(--surface)]">
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-[14px] font-semibold text-neutral-200">{title}</h2>
          {description && (
            <p className="text-[12px] text-neutral-600">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusMsg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <span
      className={`text-[12px] flex items-center gap-1.5 ${
        ok ? "text-emerald-400" : "text-red-400"
      }`}
    >
      {ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      {text}
    </span>
  );
}

// ─── Auto-lock option pill
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
      className={`px-4 py-2 rounded-lg border text-[13px] transition-colors cursor-pointer ${
        active
          ? "border-neutral-500 bg-neutral-800 text-neutral-100"
          : "border-[var(--border)] text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
      }`}
    >
      {active && <Check className="inline w-3.5 h-3.5 mr-1.5 text-emerald-400" />}
      {label}
    </button>
  );
}

// ─── Password field with toggle
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
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9 font-mono"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CLIPBOARD_KEY = (uid: string) => `vaultr_clipboard_clear_s_${uid}`;

export default function SecuritySettingsPage() {
  const { user } = useFirebaseAuth();
  const { items, cryptoKey, autoLockMinutes, setAutoLockMinutes } = useVault();

  // ── Change master password state
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [pwProgress, setPwProgress] = useState(0); // 0-100
  const [pwTotal, setPwTotal] = useState(0);
  const [pwDone, setPwDone] = useState(0);
  const [pwMsg, setPwMsg] = useState({ text: "", ok: true });
  const [lastChanged, setLastChanged] = useState<string | null>(null);

  // ── Clipboard timer
  const [clipboardSecs, setClipboardSecs] = useState<number>(() => {
    if (typeof window === "undefined" || !user?.uid) return 0;
    return Number(localStorage.getItem(CLIPBOARD_KEY(user.uid)) ?? 0);
  });

  // Load last password change date from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid, "profile", "security"))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data().lastPasswordChangedAt;
          if (d) setLastChanged(d);
        }
      })
      .catch(() => {});
  }, [user?.uid]);

  const saveClipboard = (secs: number) => {
    setClipboardSecs(secs);
    if (user?.uid) {
      if (secs === 0) {
        localStorage.removeItem(CLIPBOARD_KEY(user.uid));
      } else {
        localStorage.setItem(CLIPBOARD_KEY(user.uid), String(secs));
      }
    }
  };

  // ── Change master password handler
  const handleChangePw = async () => {
    if (!user?.uid || !auth.currentUser) return;

    setPwMsg({ text: "", ok: true });

    if (!oldPw || !newPw || !confirmPw) {
      setPwMsg({ text: "Please fill in all password fields.", ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ text: "New master password must be at least 8 characters.", ok: false });
      return;
    }
    if (oldPw === newPw) {
      setPwMsg({ text: "New master password must differ from the old one.", ok: false });
      return;
    }

    setPwChanging(true);

    try {
      // 1. Derive old key & verify
      const oldKey = await deriveKey(oldPw, user.uid);

      // If vault has items, verify old key decrypts the first one
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

      // 2. Derive new key
      const newKey = await deriveKey(newPw, user.uid);

      // 3. Re-encrypt all live blobs
      const toReEncrypt = liveItems.map((i) => ({
        id: i.id,
        encryptedBlob: i.encryptedBlob,
      }));

      setPwTotal(toReEncrypt.length);
      setPwDone(0);
      setPwProgress(0);

      const reEncrypted = await reEncryptBlobs(
        toReEncrypt,
        oldKey,
        newKey,
        (done, total) => {
          setPwDone(done);
          setPwProgress(Math.round((done / total) * 100));
        }
      );

      // 4. Batch write to Firestore (500 docs per batch)
      const BATCH_SIZE = 500;
      for (let i = 0; i < reEncrypted.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = reEncrypted.slice(i, i + BATCH_SIZE);
        for (const { id, encryptedBlob } of chunk) {
          batch.update(doc(db, "users", user.uid, "vaultItems", id), {
            encryptedBlob,
          });
        }
        await batch.commit();
      }

      // 5. Save new session password & persist last changed timestamp
      saveVaultSession(user.uid, newPw);
      const now = new Date().toISOString();
      await setDoc(
        doc(db, "users", user.uid, "profile", "security"),
        { lastPasswordChangedAt: now },
        { merge: true }
      );
      setLastChanged(now);

      // 6. Clear form & show success
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setPwProgress(0);
      setPwMsg({
        text: `Master password changed. ${reEncrypted.length} item(s) re-encrypted.`,
        ok: true,
      });
    } catch (err) {
      setPwMsg({ text: (err as Error).message || "An error occurred.", ok: false });
    } finally {
      setPwChanging(false);
    }
  };

  const liveCount = items.filter((i) => !i.deletedAt).length;
  const isVaultLocked = !cryptoKey;

  // ── Session manager
  const {
    sessions, isVerified, loading: sessionsLoading,
    sendingCode, verifying, revoking, otpError, otpSuccess,
    autoVerificationTriggered, autoVerificationEmailSent,
    sendVerificationEmail, verifyOtp, revokeSession, revokeAllOtherSessions, clearOtpState,
  } = useSessionManager(user?.uid ?? null);

  // ── Session notification prefs
  const [newDeviceEmailAlert, setNewDeviceEmailAlert] = useState(true);
  const [requireVerifOnNew, setRequireVerifOnNew] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  // OTP input — auto-open if server triggered verification
  const [otpValue, setOtpValue] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  // Sync codeSent with autoVerificationTriggered when the email was sent
  useEffect(() => {
    if (autoVerificationTriggered && autoVerificationEmailSent) {
      setCodeSent(true);
    }
  }, [autoVerificationTriggered, autoVerificationEmailSent]);

  // Revoke confirmation
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [revokeAllBusy, setRevokeAllBusy] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  // Load notification prefs from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid, "profile", "security")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.newDeviceEmailAlert !== undefined) setNewDeviceEmailAlert(d.newDeviceEmailAlert);
        if (d.requireVerificationOnNew !== undefined) setRequireVerifOnNew(d.requireVerificationOnNew);
      }
    }).catch(() => {});
  }, [user?.uid]);

  const saveNotifPrefs = async (field: string, value: boolean) => {
    if (!user?.uid) return;
    setNotifSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "profile", "security"), { [field]: value }, { merge: true });
    } finally { setNotifSaving(false); }
  };

  const handleSendCode = async () => {
    const res = await sendVerificationEmail();
    if (res.ok) { setCodeSent(true); setTimeout(() => otpRef.current?.focus(), 100); }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    const res = await verifyOtp(otpValue);
    if (res.ok) setOtpValue("");
  };

  const handleRevokeConfirmed = async (sessionId: string) => {
    setConfirmRevoke(null);
    await revokeSession(sessionId);
  };

  const handleRevokeAllConfirmed = async () => {
    setConfirmRevokeAll(false);
    setRevokeAllBusy(true);
    await revokeAllOtherSessions();
    setRevokeAllBusy(false);
  };

  // Relative time helper
  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[18px] font-semibold text-neutral-100">Security</h1>
        <p className="text-[13px] text-neutral-600">
          Change your master password, configure auto-lock, and manage active sessions.
        </p>
      </div>

      {/* ── Change Master Password */}
      <Section
        title="Change Master Password"
        description="Re-derives your AES-256-GCM key and re-encrypts all vault blobs atomically."
        icon={KeyRound}
      >
        {isVaultLocked ? (
          <div className="flex items-center gap-2 text-[13px] text-amber-400 bg-amber-950/20 border border-amber-900/40 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Unlock your vault first before changing the master password.
          </div>
        ) : (
          <div className="space-y-4">
            {lastChanged && (
              <p className="text-[12px] text-neutral-700">
                Last changed:{" "}
                <span className="text-neutral-500">
                  {new Date(lastChanged).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            )}

            <div className="space-y-3">
              <PasswordInput
                id="old-pw"
                value={oldPw}
                onChange={setOldPw}
                placeholder="Current master password"
              />
              <PasswordInput
                id="new-pw"
                value={newPw}
                onChange={setNewPw}
                placeholder="New master password (min 8 chars)"
              />
              <PasswordInput
                id="confirm-pw"
                value={confirmPw}
                onChange={setConfirmPw}
                placeholder="Confirm new master password"
              />
            </div>

            {/* Progress bar */}
            {pwChanging && pwTotal > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-neutral-600">
                  <span>Re-encrypting vault items…</span>
                  <span>
                    {pwDone} / {pwTotal}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                    style={{ width: `${pwProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleChangePw}
                variant="default"
                disabled={pwChanging}
              >
                {pwChanging ? "Changing…" : "Change Master Password"}
              </Button>
              <span className="text-[11px] text-neutral-700">
                {liveCount} item{liveCount !== 1 ? "s" : ""} to re-encrypt
              </span>
            </div>

            <StatusMsg {...pwMsg} />
          </div>
        )}
      </Section>

      {/* ── Auto-lock */}
      <Section
        title="Auto-Lock Timer"
        description="Lock the vault automatically after the selected period of inactivity."
        icon={Timer}
      >
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Never (Off)", value: 0 },
            { label: "5 min", value: 5 },
            { label: "15 min", value: 15 },
            { label: "30 min", value: 30 },
            { label: "1 hour", value: 60 },
            { label: "2 hours", value: 120 },
          ].map(({ label, value }) => (
            <LockOption
              key={value}
              label={label}
              active={autoLockMinutes === value}
              onClick={() => setAutoLockMinutes(value)}
            />
          ))}
        </div>
        <p className="text-[11px] text-neutral-700">
          Stored per-user in this browser. The vault locks automatically after the idle period. When set to &apos;Never&apos;, it only locks when you explicitly lock it or close the tab.
        </p>
      </Section>

      {/* ── Clipboard auto-clear */}
      <Section
        title="Clipboard Auto-Clear"
        description="Automatically clear the clipboard after copying a sensitive field."
        icon={Clipboard}
      >
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Off", value: 0 },
            { label: "30 seconds", value: 30 },
            { label: "60 seconds", value: 60 },
          ].map(({ label, value }) => (
            <LockOption
              key={value}
              label={label}
              active={clipboardSecs === value}
              onClick={() => saveClipboard(value)}
            />
          ))}
        </div>
        <p className="text-[11px] text-neutral-700">
          When set, the clipboard will be cleared after copy. Stored locally in this browser.
        </p>
      </Section>

      {/* ── Two-factor authentication (informational) */}
      <Section
        title="Two-Factor Authentication"
        description="Protect your Firebase account login with an additional factor."
        icon={Shield}
      >
        <div className="space-y-3">
          <p className="text-[13px] text-neutral-500 leading-relaxed">
            Firebase Authentication supports TOTP (Time-based One-Time Password) and phone SMS as
            second factors. Enabling 2FA on your Firebase account protects your{" "}
            <strong className="text-neutral-400">login</strong>, not your vault encryption key — the
            vault remains protected by your master password regardless.
          </p>
          <div className="bg-neutral-900/60 border border-[var(--border)] rounded-lg px-4 py-3 space-y-2">
            <p className="text-[12px] text-neutral-500">
              Your current sign-in providers:
            </p>
            <div className="flex flex-wrap gap-2">
              {user?.providerData?.map((p) => (
                <span
                  key={p.providerId}
                  className="text-[11px] px-2 py-0.5 rounded border border-[var(--border)] text-neutral-400 bg-neutral-900"
                >
                  {p.providerId === "google.com" ? "Google" : "Email / Password"}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-neutral-700">
            To enable phone or TOTP 2FA, manage it through your Firebase project&apos;s Authentication settings or via the Firebase console linked to this account.
          </p>
        </div>
      </Section>

      {/* ── Sessions & Devices */}
      <Section
        title="Sessions & Devices"
        description="Manage where your account is active. Verify devices and revoke access remotely."
        icon={Monitor}
      >
        <div className="space-y-5">

          {/* ── Current device trust status */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-neutral-900/50">
            <div className="mt-0.5 shrink-0">
              {isVerified
                ? <ShieldCheck className="w-5 h-5 text-emerald-400" />
                : <ShieldAlert className="w-5 h-5 text-amber-400" />}
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[13px] font-medium text-neutral-200">
                  This device is{" "}
                  <span className={isVerified ? "text-emerald-400" : "text-amber-400"}>
                    {isVerified ? "verified ✓" : "not verified"}
                  </span>
                </p>
                <p className="text-[12px] text-neutral-600 mt-0.5">
                  {isVerified
                    ? "Email verification was completed for this browser session."
                    : "Verify this device to confirm it's you. A code will be sent to your email."}
                </p>
              </div>

              {/* OTP flow */}
              {!isVerified && !otpSuccess && (
                <div className="space-y-3">
                  {/* Auto-verification: email sent — jump straight to OTP input */}
                  {autoVerificationTriggered && autoVerificationEmailSent && (
                    <p className="text-[12px] text-blue-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      A verification code was automatically sent to your email.
                    </p>
                  )}

                  {/* Auto-verification: no email on account */}
                  {autoVerificationTriggered && !autoVerificationEmailSent && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-900/50 bg-amber-950/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-400">
                        Verification is required but no email is linked to your account.
                        Link an email in{" "}
                        <a href="/settings/account" className="underline hover:text-amber-300">Account Settings</a>
                        {" "}to enable device verification.
                      </p>
                    </div>
                  )}

                  {!codeSent && !autoVerificationTriggered ? (
                    <Button
                      onClick={handleSendCode}
                      disabled={sendingCode}
                      variant="default"
                    >
                      {sendingCode ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Sending…</> : <><Mail className="w-3.5 h-3.5 mr-1.5" />Send verification code</>}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {!autoVerificationTriggered && (
                        <p className="text-[12px] text-neutral-500">Enter the 6-digit code sent to your email:</p>
                      )}
                      {autoVerificationTriggered && autoVerificationEmailSent && (
                        <p className="text-[12px] text-neutral-500">Enter the 6-digit code sent to your email:</p>
                      )}
                      {(codeSent || (autoVerificationTriggered && autoVerificationEmailSent)) && (
                        <div className="flex gap-2">
                          <input
                            ref={otpRef}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpValue}
                            onChange={(e) => { clearOtpState(); setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
                            placeholder="000000"
                            className="w-32 px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-neutral-100 font-mono text-center text-[18px] tracking-[0.3em] focus:outline-none focus:border-neutral-500 transition-colors"
                          />
                          <Button
                            onClick={handleVerifyOtp}
                            disabled={verifying || otpValue.length !== 6}
                            variant="default"
                          >
                            {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Verify"}
                          </Button>
                          <button
                            onClick={handleSendCode}
                            disabled={sendingCode}
                            className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                          >
                            Resend
                          </button>
                        </div>
                      )}
                      {otpError && (
                        <p className="text-[12px] text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />{otpError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {otpSuccess && (
                <p className="text-[13px] text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />Device verified successfully!
                </p>
              )}
            </div>
          </div>

          {/* ── Active sessions list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-neutral-400 uppercase tracking-wider">Active Sessions</p>
              {sessions.filter(s => !s.isCurrentDevice).length > 0 && (
                <button
                  onClick={() => setConfirmRevokeAll(true)}
                  disabled={revokeAllBusy}
                  className="text-[12px] text-red-500 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Sign out all other devices
                </button>
              )}
            </div>

            {sessionsLoading ? (
              <div className="flex items-center gap-2 py-4 text-[13px] text-neutral-600">
                <Loader2 className="w-4 h-4 animate-spin" />Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-[13px] text-neutral-700 py-2">No sessions found. Session data will appear here after your next sign-in.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const DeviceIcon = session.deviceType === "mobile" ? Smartphone : session.deviceType === "tablet" ? Tablet : Monitor;
                  const isRevoking = revoking.has(session.sessionId);
                  return (
                    <div
                      key={session.sessionId}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        session.isCurrentDevice
                          ? "border-emerald-900/60 bg-emerald-950/20"
                          : "border-[var(--border)] bg-neutral-900/30"
                      }`}
                    >
                      {/* Device icon */}
                      <div className={`shrink-0 p-2 rounded-lg ${
                        session.isCurrentDevice ? "bg-emerald-900/40" : "bg-neutral-800"
                      }`}>
                        <DeviceIcon className={`w-4 h-4 ${
                          session.isCurrentDevice ? "text-emerald-400" : "text-neutral-500"
                        }`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-medium text-neutral-200 truncate">{session.deviceName}</p>
                          {session.isCurrentDevice && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-900/60 shrink-0">Current</span>
                          )}
                          {session.isTrusted ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-emerald-500 border border-neutral-700 shrink-0 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />Verified
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-amber-500 border border-neutral-700 shrink-0">Unverified</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {session.location && (
                            <span className="text-[11px] text-neutral-600 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{session.location}
                            </span>
                          )}
                          <span className="text-[11px] text-neutral-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{relativeTime(session.lastSeenAt)}
                          </span>
                        </div>
                      </div>

                      {/* Revoke */}
                      {!session.isCurrentDevice && (
                        confirmRevoke === session.sessionId ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleRevokeConfirmed(session.sessionId)}
                              disabled={isRevoking}
                              className="text-[11px] px-2 py-1 rounded bg-red-900/50 text-red-400 border border-red-900 hover:bg-red-900 transition-colors cursor-pointer"
                            >
                              {isRevoking ? <Loader2 className="w-3 h-3 animate-spin" /> : "Revoke"}
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              className="text-[11px] px-2 py-1 rounded bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(session.sessionId)}
                            title="Revoke this session"
                            className="shrink-0 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Revoke all confirmation dialog */}
          {confirmRevokeAll && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-red-900/60 bg-red-950/20">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <p className="text-[13px] text-red-300">Sign out of all other devices?</p>
                <p className="text-[12px] text-red-500/80">All other sessions will be immediately revoked. This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button onClick={handleRevokeAllConfirmed} variant="danger" disabled={revokeAllBusy}>
                    {revokeAllBusy ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Revoking…</> : "Yes, sign out all"}
                  </Button>
                  <Button onClick={() => setConfirmRevokeAll(false)} variant="ghost">Cancel</Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Notification preferences */}
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <p className="text-[12px] font-medium text-neutral-400 uppercase tracking-wider">Notification Preferences</p>
            {[
              {
                label: "Email me when a new device signs in",
                description: "Get alerted if someone logs into your account from an unrecognised device.",
                key: "newDeviceEmailAlert" as const,
                value: newDeviceEmailAlert,
                setter: setNewDeviceEmailAlert,
              },
              {
                label: "Require email verification for new devices",
                description: "Automatically send a verification code to any new device on login.",
                key: "requireVerificationOnNew" as const,
                value: requireVerifOnNew,
                setter: setRequireVerifOnNew,
              },
            ].map(({ label, description, key, value, setter }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => {
                      setter(e.target.checked);
                      saveNotifPrefs(key, e.target.checked);
                    }}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${
                    value ? "bg-emerald-600" : "bg-neutral-700"
                  }`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      value ? "left-[18px]" : "left-0.5"
                    }`} />
                  </div>
                </div>
                <div>
                  <p className="text-[13px] text-neutral-300 group-hover:text-neutral-100 transition-colors">{label}</p>
                  <p className="text-[11px] text-neutral-600 mt-0.5">{description}</p>
                </div>
              </label>
            ))}
            {notifSaving && <p className="text-[11px] text-neutral-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving…</p>}
          </div>
        </div>
      </Section>
    </div>
  );
}
