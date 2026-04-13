"use client";

import React, { useEffect, useState } from "react";
import { useVault } from "@/context/VaultContext";
import { useCrypto } from "@/hooks/useCrypto";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Fingerprint, Copy, Check } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { generateTOTP, getTotpPercentage } from "@/lib/totp";
import { DecryptedPayload, VaultItem } from "../page";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";

// ─── Minimal Live TOTP Row ──────────────────────────────────────────────────────

function TotpAuthRow({ item, secret }: { item: VaultItem; secret: string }) {
  const [code, setCode] = useState("------");
  const [percent, setPercent] = useState(100);
  const [copied, setCopied] = useState(false);

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

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[var(--border)] bg-neutral-900/40 rounded-xl hover:border-neutral-700 hover:bg-neutral-800/40 transition-all group">

      <div className="flex items-center gap-4 mb-4 sm:mb-0">
        {/* Minimal Sync Ring */}
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
          <svg className="absolute inset-0 w-10 h-10 -rotate-90 transform" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-neutral-800" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none"
              className={`${percent > 20 ? "text-sky-400" : "text-red-500"} transition-all duration-1000 ease-linear`}
              strokeDasharray="62.8"
              strokeDashoffset={62.8 * (1 - Math.max(0, percent) / 100)}
            />
          </svg>
          <Fingerprint className={`w-4 h-4 transition-colors duration-500 ${percent > 20 ? "text-neutral-500" : "text-red-500 animate-pulse"}`} />
        </div>

        {/* Info */}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-neutral-100 truncate tracking-tight">{item.name}</h3>
          <p className="text-[12px] text-neutral-500 font-medium tracking-wide mt-0.5 truncate">{item.domain || "Authenticator"}</p>
        </div>
      </div>

      {/* Code Display & Actions */}
      <div className="flex items-center gap-6 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
        {/* Clean Segments */}
        <div className="flex items-center gap-1.5 font-mono text-[22px] font-bold tracking-[0.2em] text-neutral-200 select-none">
          {code === "ERROR" || code === "------" ? (
            <span className="text-red-400 font-sans tracking-normal px-2 text-sm border border-red-900/40 bg-red-950/30 py-1 rounded">Invalid Secret</span>
          ) : (
            <>
              <span className="bg-neutral-800/80 px-2 py-0.5 rounded">{code.slice(0, 3)}</span>
              <span className="text-neutral-600 font-sans text-xl opacity-50 mx-1">-</span>
              <span className="bg-neutral-800/80 px-2 py-0.5 rounded">{code.slice(3, 6)}</span>
            </>
          )}
        </div>

        <button
          onClick={copy}
          className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 transition-colors cursor-pointer"
          title="Copy Code"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}


// ─── Page Component ─────────────────────────────────────────────────────────

export default function AuthenticatorPage() {
  const { user } = useFirebaseAuth();
  const { cryptoKey, unlock: ctxUnlock } = useVault();
  const { decrypt } = useCrypto();

  const [items, setItems] = useState<VaultItem[]>([]);

  // Decrypted secrets store: { [itemId]: secret }
  const [secrets, setSecrets] = useState<Record<string, string>>({});

  const [masterPassword, setMasterPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Fetch only items with TOTP flag
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "users", user.uid, "vaultItems"));
    const unsub = onSnapshot(q, snap => {
      const list: VaultItem[] = [];
      snap.forEach(d => {
        const data = { id: d.id, ...d.data() } as VaultItem;
        if (data.hasTotp) list.push(data);
      });
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setItems(list);
    });
    return () => unsub();
  }, [user]);

  // Decrypt items once unlocked
  useEffect(() => {
    if (!cryptoKey || items.length === 0) return;

    const missingItems = items.filter(i => secrets[i.id] === undefined);
    if (missingItems.length === 0) return; // Exit early safely if all decrypted

    let isStale = false;
    const decryptAll = async () => {
      const updates: Record<string, string> = {};
      for (const item of missingItems) {
        try {
          const raw = await decrypt(cryptoKey, item.encryptedBlob);
          const p = JSON.parse(raw) as DecryptedPayload;
          updates[item.id] = p.totpSecret || "";
        } catch {
          console.error("Failed to decrypt TOTP secret for", item.id);
          updates[item.id] = "";
        }
      }
      if (!isStale && Object.keys(updates).length > 0) {
        setSecrets(prev => ({ ...prev, ...updates }));
      }
    };

    decryptAll();
    return () => { isStale = true; };
  }, [cryptoKey, items, decrypt, secrets]);


  const handleUnlock = async () => {
    if (!masterPassword) return;
    setUnlockError("");
    setUnlocking(true);
    const err = await ctxUnlock(masterPassword);
    if (err) {
      setUnlockError(err);
      setShakeKey(k => k + 1);
    }
    setUnlocking(false);
  };

  // Locked State — uses shared VaultContext key, so if vault page is already
  // unlocked this screen will also be unlocked automatically (no re-prompt)
  if (!cryptoKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden h-full min-h-[500px]">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 55% at 50% 45%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 40%, transparent 70%)" }}
        />
        {/* Authenticator illustration — faint background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <Image
            src="/illustrations/two-factor-authentication_ofho.svg"
            alt=""
            width={380}
            height={380}
            className="object-contain opacity-[0.05]"
          />
        </div>
        <div className={`relative w-full max-w-[320px] space-y-7 ${unlocking ? "animate-unlock-open" : "animate-fade-up"}`}>
          <div className="flex flex-col items-center gap-5">
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-24 h-24 rounded-full opacity-20 animate-pulse-ring"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
              />
              <div
                className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-300 ${unlocking ? "bg-neutral-800 border-neutral-600 scale-105" : "bg-neutral-900 border-neutral-800"}`}
              >
                <Fingerprint className={`w-6 h-6 transition-all duration-300 ${unlocking ? "text-neutral-200" : "text-neutral-400"}`} />
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 mb-2 opacity-40">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-500">_vaultr_2fa</span>
              </div>
              <h1 className="text-[17px] font-semibold text-neutral-100 tracking-tight">
                {unlocking ? "Decrypting codes..." : "Unlock Authenticator"}
              </h1>
              <p className="text-[12px] text-neutral-600 font-mono truncate max-w-[260px]">
                {user?.email}
              </p>
            </div>
          </div>

          <div key={shakeKey} className={`space-y-3 ${unlockError && shakeKey > 0 ? "animate-shake" : ""}`}>
            {unlockError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-900/40 bg-red-950/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <p className="text-[12px] text-red-200">{unlockError}</p>
              </div>
            )}
            <Input
              type="password" autoFocus
              placeholder="Master password"
              value={masterPassword} onChange={e => setMasterPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleUnlock()}
            />
            <Button
              className="w-full"
              variant="primary" onClick={handleUnlock}
              disabled={!masterPassword || unlocking}
            >
              Unlock codes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Unlocked State
  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-8 animate-fade-up">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-sky-400" />
            Authenticator
          </h1>
          <p className="text-[13px] text-neutral-500 mt-1">Live synchronized 2-factor authentication codes.</p>
        </div>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-80 h-80 sm:w-80 sm:h-80 opacity-80">
              <Image
                src="/illustrations/authentication_1evl.svg"
                alt=""
                width={160}
                height={160}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-neutral-300">No 2FA Codes</h3>
              <p className="text-[12px] text-neutral-500 max-w-[260px] mx-auto leading-relaxed">Add a TOTP setup key to any of your entries to manage them from this dashboard.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(item => (
              secrets[item.id] ? (
                <TotpAuthRow key={item.id} item={item} secret={secrets[item.id]} />
              ) : (
                // Super Sleek Skeleton
                <div key={item.id} className="flex items-center justify-between p-4 border border-[var(--border)] bg-neutral-900/20 rounded-xl animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-neutral-800" />
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-neutral-800 rounded" />
                      <div className="w-16 h-3 bg-neutral-800/50 rounded" />
                    </div>
                  </div>
                  <div className="w-20 h-6 bg-neutral-800 rounded" />
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
