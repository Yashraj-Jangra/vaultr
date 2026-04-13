"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { saveVaultSession } from "@/hooks/useVaultSession";

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
        const { useCrypto } = await import("@/hooks/useCrypto");
        const { decrypt } = useCrypto();
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[18px] font-semibold text-neutral-100">Security</h1>
        <p className="text-[13px] text-neutral-600">
          Change your master password, configure auto-lock, and manage session security.
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
          Stored per-user in this browser. The vault locks automatically after the idle period. When set to 'Never', it only locks when you explicitly lock it or close the tab.
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
    </div>
  );
}
