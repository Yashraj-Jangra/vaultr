"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { Shield, Eye, EyeOff, ArrowRight, Lock, Zap, Globe } from "lucide-react";

// ── Password strength meter ────────────────────────────────────────────────────
function strengthScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
}

const STRENGTH_LABEL = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
const STRENGTH_COLOR = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = strengthScore(password);
  return (
    <div className="space-y-1.5 mt-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map((i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? STRENGTH_COLOR[score] : "#1a1a1a" }}
          />
        ))}
      </div>
      <p className="text-[11px]" style={{ color: score > 0 ? STRENGTH_COLOR[score] : "#666" }}>
        {STRENGTH_LABEL[score]}
      </p>
    </div>
  );
}

// ── Google G SVG ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ── Main auth page ─────────────────────────────────────────────────────────────
type Tab = "signin" | "signup";

export default function AuthPage() {
  const { user, isAuthLoading, login, register, googleLogin, resetPassword, isAuthenticating, error } = useFirebaseAuth();
  const { config } = useSiteConfig();
  const router = useRouter();

  const [tab,        setTab]        = useState<Tab>("signin");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent,  setResetSent]  = useState(false);

  useEffect(() => {
    if (!isAuthLoading && user) router.replace("/vault");
  }, [user, isAuthLoading, router]);

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-xs text-neutral-600">Loading…</p></div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "signin") { await login(email, password); }
    else                  { await register(email, password); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await resetPassword(email);
    if (ok) setResetSent(true);
  };

  const handleGoogle = async () => { await googleLogin(); };

  const switchTab = (t: Tab) => { setTab(t); setForgotMode(false); setResetSent(false); };

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[46%] flex-col justify-between p-12 relative overflow-hidden bg-neutral-950">
        {/* Gradient orb */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/[0.02] blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/[0.02] blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.03]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/[0.04]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-white/[0.06]" />
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white">{config.name}</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <p className="text-[11px] text-neutral-500 uppercase tracking-widest font-medium">Zero-knowledge security</p>
            <h2 className="text-3xl font-semibold text-white leading-snug">
              Your passwords,<br />
              <span className="text-neutral-400">encrypted before</span><br />
              they leave your browser.
            </h2>
          </div>

          <div className="space-y-4">
            {[
              { icon: <Lock className="w-4 h-4" />,  title: "AES-256-GCM encryption",    desc: "Military-grade, client-side only" },
              { icon: <Zap  className="w-4 h-4" />,  title: "Zero-knowledge model",       desc: "We cannot read your data. Ever." },
              { icon: <Globe className="w-4 h-4" />, title: "Access from anywhere",       desc: "Synced securely via Firebase" },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-white/5 border border-white/5 flex items-center justify-center text-neutral-400 shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <p className="text-[13px] text-neutral-200 font-medium">{f.title}</p>
                  <p className="text-[12px] text-neutral-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-[11px] text-neutral-700">© {new Date().getFullYear()} {config.name}. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-7">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <Shield className="w-5 h-5 text-neutral-400" />
            <span className="text-[14px] font-semibold text-neutral-200">{config.name}</span>
          </div>

          {/* Forgot password flow */}
          {forgotMode ? (
            <div className="space-y-5">
              <div>
                <h1 className="text-[20px] font-semibold text-neutral-100">Reset password</h1>
                <p className="text-[13px] text-neutral-500 mt-1">Enter your email and we&apos;ll send a reset link.</p>
              </div>
              {resetSent ? (
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3">
                  <p className="text-[13px] text-emerald-400">Check your inbox — reset link sent.</p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  {error && <p className="text-[12px] text-red-400">{error}</p>}
                  <AuthInput type="email" placeholder="Email address" value={email} onChange={setEmail} required />
                  <AuthButton type="submit" loading={isAuthenticating}>
                    Send reset link <ArrowRight className="w-3.5 h-3.5" />
                  </AuthButton>
                </form>
              )}
              <button onClick={() => setForgotMode(false)} className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer">
                ← Back to sign in
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-[20px] font-semibold text-neutral-100">
                  {tab === "signin" ? "Welcome back" : "Create account"}
                </h1>
                <p className="text-[13px] text-neutral-500 mt-1">
                  {tab === "signin"
                    ? "Sign in to access your encrypted vault."
                    : "Set up your zero-knowledge vault."}
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-neutral-950">
                {(["signin", "signup"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-all duration-150 cursor-pointer ${
                      tab === t
                        ? "bg-neutral-800 text-neutral-100 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {t === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              {/* Google button */}
              <button
                onClick={handleGoogle}
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-neutral-950 hover:bg-neutral-900 text-[13px] text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-[11px] text-neutral-700">or</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2.5">
                    <p className="text-[12px] text-red-400">{error}</p>
                  </div>
                )}
                <AuthInput type="email" placeholder="Email address" value={email} onChange={setEmail} required />
                <div className="relative">
                  <AuthInput
                    type={showPass ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={setPassword}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Strength meter on sign-up */}
                {tab === "signup" && <StrengthMeter password={password} />}

                <AuthButton type="submit" loading={isAuthenticating}>
                  {tab === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </AuthButton>
              </form>

              {/* Forgot password */}
              {tab === "signin" && (
                <button
                  onClick={() => setForgotMode(true)}
                  className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer w-full text-center"
                >
                  Forgot password?
                </button>
              )}

              {/* Legal */}
              {tab === "signup" && (
                <p className="text-[11px] text-neutral-600 text-center leading-relaxed">
                  By creating an account you agree to our{" "}
                  <a href="/terms" className="text-neutral-400 hover:text-neutral-200 underline">Terms</a>
                  {" "}and{" "}
                  <a href="/privacy" className="text-neutral-400 hover:text-neutral-200 underline">Privacy Policy</a>.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared form atoms ─────────────────────────────────────────────────────────
function AuthInput({
  type, placeholder, value, onChange, required,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full bg-neutral-950 border border-[var(--border)] rounded-lg px-3.5 py-2.5 text-[13px] text-neutral-200 placeholder-neutral-700 outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/30 transition-all"
    />
  );
}

function AuthButton({
  type = "button", children, loading, onClick,
}: {
  type?: "button" | "submit"; children: React.ReactNode;
  loading?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <span className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-neutral-900 rounded-full animate-spin" /> : children}
    </button>
  );
}
