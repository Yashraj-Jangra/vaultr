"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useVault } from "@/context/VaultContext";
import { useTheme } from "@/context/ThemeContext";
import { Lock, Shield } from "lucide-react";

export function MasterPasswordPrompt() {
  const { user, logout } = useAuth();
  const { activeTheme } = useTheme();
  const router = useRouter();
  const { unlock } = useVault();

  const [masterPassword, setMasterPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [unlockOverlay, setUnlockOverlay] = useState<"main" | "forgot" | "why">("main");
  const passwordInputRef = React.useRef<HTMLInputElement>(null);

  // Random SVG pair — picked once on mount using lazy initializer (avoids setState-in-effect)
  const [randomSvgs] = useState<[string, string]>(() => {
    const svgs = [
      "/illustrations/unlock_m0yr.svg",
      "/illustrations/safe_0mei.svg",
      "/illustrations/security_0ubl.svg",
      "/illustrations/firewall_cfej.svg",
      "/illustrations/private-files_m2bw.svg",
      "/illustrations/two-factor-authentication_ofho.svg",
      "/illustrations/mobile-encryption_flk2.svg"
    ];
    const shuffled = [...svgs].sort(() => 0.5 - Math.random());
    return [shuffled[0], shuffled[1]];
  });

  const handleUnlock = async () => {
    if (!masterPassword || unlocking) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      await unlock(masterPassword);
    } catch (err: any) {
      const msg = err?.message || "Incorrect master password.";
      setUnlockError(msg.includes("decrypt") ? "Incorrect master password." : msg);
      setShakeKey(k => k + 1);
      setTimeout(() => {
        passwordInputRef.current?.select();
      }, 50);
    } finally {
      setUnlocking(false);
    }
  };

  if (!user) return null; // Wait for user object to render prompt

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--fg)] overflow-hidden">
      {/* ══════════════════════ DECORATIVE BACKGROUND ══════════════════════ */}

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)" }} />

      {/* Left side illustration */}
      <div key={`left-${randomSvgs[0]}`} className="absolute top-1/2 -translate-y-1/2 -left-16 hidden md:block w-[400px] h-[400px] pointer-events-none select-none opacity-[0.04]">
        <Image src={randomSvgs[0]} alt="" width={400} height={400} className="object-contain" priority />
      </div>

      {/* Bottom right illustration */}
      <div key={`right-${randomSvgs[1]}`} className="absolute -bottom-16 -right-16 hidden md:block w-[450px] h-[450px] pointer-events-none select-none opacity-[0.04]">
        <Image src={randomSvgs[1]} alt="" width={450} height={450} className="object-contain" priority />
      </div>

      {/* Mobile background illustration (fall back) */}
      <div key={`mob-${randomSvgs[0]}`} className="absolute bottom-10 right-0 w-48 h-48 pointer-events-none select-none md:hidden opacity-[0.03]">
        <Image src={randomSvgs[0]} alt="" width={192} height={192} className="object-contain" />
      </div>

      {/* ══════════════════════ CENTER FORM ══════════════════════ */}
      <div className="w-full max-w-[340px] relative z-10">

        {/* ✨ Main Unlock View ✨ */}
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: unlockOverlay === "main" ? 1 : 0,
            transform: unlockOverlay === "main" ? "translateY(0)" : "translateY(20px)",
            pointerEvents: unlockOverlay === "main" ? "auto" : "none",
            position: unlockOverlay === "main" ? "relative" : "absolute",
            top: 0, left: 0
          }}
        >
          {/* Lock icon halo */}
          <div className="flex flex-col items-center gap-5 animate-auth-panel-in">
            <div className="relative flex items-center justify-center mb-2">
              <div
                className="absolute w-28 h-28 rounded-full opacity-20 animate-pulse-ring"
                style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
              />
              <div
                className="w-24 h-24 rounded-2xl border border-[var(--border)] bg-[#0d0d0d] flex items-center justify-center transition-all duration-300 relative z-10"
              >
                <Image
                  src={activeTheme.mode === "dark" ? "/brand/vaultr-lock-dark-transparent.svg" : "/brand/vaultr-lock-light-transparent.svg"}
                  alt="_vaultr"
                  width={78}
                  height={78}
                  className="w-20 h-20 object-contain transition-opacity duration-300 opacity-90"
                />
              </div>
            </div>

            <div className="text-center space-y-1.5 mb-2">
              <div className="flex items-center justify-center mb-1 opacity-60">
                <Image
                  src="/brand/vaultr-full-dark-transparent.png"
                  alt="_vaultr"
                  width={100}
                  height={20}
                  className="h-5 w-auto object-contain"
                />
              </div>
              <h1 className="text-[18px] font-semibold text-neutral-100 tracking-tight">
                {unlocking ? "Decrypting vault…" : "Unlock your vault"}
              </h1>
              <p className="text-[12px] text-neutral-500 font-mono truncate max-w-[260px]">
                {user.email}
              </p>
            </div>
          </div>

          <div key={shakeKey} className={`space-y-4 mt-6 ${unlockError && shakeKey > 0 ? "animate-shake" : ""}`}>
            {unlockError && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-red-900/40 bg-red-950/25 animate-auth-form-in">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1" />
                <p className="text-[12px] text-red-400">{unlockError}</p>
              </div>
            )}

            <div className="relative">
              <input
                ref={passwordInputRef}
                type="password"
                value={masterPassword}
                onChange={e => setMasterPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUnlock()}
                placeholder="Master password"
                autoFocus
                disabled={unlocking}
                className="w-full bg-[#0d0d0d] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-neutral-200 placeholder-neutral-700 outline-none focus:border-neutral-600 focus:ring-1 focus:ring-white/5 transition-all duration-200 pr-12 disabled:opacity-40 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700 pointer-events-none" />
            </div>

            <button
              onClick={handleUnlock}
              disabled={!masterPassword || unlocking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-[0_4px_16px_rgba(255,255,255,0.05)]"
            >
              {unlocking
                ? <span className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-900 rounded-full animate-spin" />
                : <><Lock className="w-3.5 h-3.5" /> Unlock vault</>}
            </button>
          </div>

          <div className="flex items-center justify-between mt-6 text-[12px]">
            <button
              onClick={() => { setUnlockOverlay("forgot"); }}
              className="text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              Forgot password?
            </button>
            <button
              onClick={() => { setUnlockOverlay("why"); }}
              className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" /> Why is this needed?
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={async () => { await logout(); router.push("/"); }}
              className="text-[11px] text-neutral-700 hover:text-neutral-500 transition-colors cursor-pointer"
            >
              Sign out instead
            </button>
          </div>
        </div>

        {/* ✨ Forgot Password View ✨ */}
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: unlockOverlay === "forgot" ? 1 : 0,
            transform: unlockOverlay === "forgot" ? "translateY(0)" : "translateY(20px)",
            pointerEvents: unlockOverlay === "forgot" ? "auto" : "none",
            position: unlockOverlay === "forgot" ? "relative" : "absolute",
            top: 0, left: 0
          }}
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-950/20 border border-red-900/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
              <Lock className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-[18px] font-semibold text-neutral-100">Unrecoverable Password</h2>
          </div>

          <div className="space-y-4">
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              SecureVault uses strict <strong>Zero-Knowledge Encryption</strong>. Your master password is never sent to our servers. It is strictly used locally to derive your AES-256-GCM decryption keys.
            </p>
            <div className="flex items-start gap-2.5 p-4 rounded-xl border border-red-900/40 bg-red-950/10">
              <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-200/80 leading-relaxed">
                This means if you forget your master password, <strong>your data cannot be recovered by anyone, including us.</strong>
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => { setUnlockOverlay("main"); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98]"
            >
              Try another password
            </button>
            <button
              onClick={async () => { await logout(); router.push("/"); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-all active:scale-[0.98] bg-transparent"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ✨ Why Is This Needed View ✨ */}
        <div
          className="w-full transition-all duration-500"
          style={{
            opacity: unlockOverlay === "why" ? 1 : 0,
            transform: unlockOverlay === "why" ? "translateY(0)" : "translateY(20px)",
            pointerEvents: unlockOverlay === "why" ? "auto" : "none",
            position: unlockOverlay === "why" ? "relative" : "absolute",
            top: 0, left: 0
          }}
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-[18px] font-semibold text-neutral-100">Local Decryption</h2>
          </div>

          <div className="space-y-4">
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              When you log in, we only authenticate your identity, which pulls down the encrypted blobs from the server.
            </p>
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              Your <strong>Master Password</strong> is mathematically hashed (PBKDF2) locally inside your browser to derive a cryptographic key.
            </p>
            <div className="flex justify-center py-2">
              <div className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[#0d0d0d] font-mono text-[11px] text-neutral-500">
                AES-256-GCM
              </div>
            </div>
            <p className="text-[13px] text-neutral-400 leading-relaxed text-center">
              This key then decrypts your vault data locally. Without it, your data remains secure cipher text.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={() => { setUnlockOverlay("main"); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-all active:scale-[0.98]"
            >
              ← Back to unlock
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
