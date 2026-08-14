"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/context/SiteConfigContext";
import {
  Shield, Eye, EyeOff, ArrowRight, Lock, Zap, Globe,
  Mail, CheckCircle2, KeyRound, UserPlus, LogIn, User
} from "lucide-react";

// ── Strength meter ─────────────────────────────────────────────────────────────
function strengthScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const S_LABEL = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
const S_COLOR = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

function StrengthMeter({ pw }: { pw: string }) {
  if (!pw) return null;
  const s = strengthScore(pw);
  return (
    <div className="space-y-1.5 pt-1.5 pb-0.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[3px] flex-1 rounded-full transition-all duration-500"
            style={{ background: i <= s ? S_COLOR[s] : "#1f1f1f" }}
          />
        ))}
      </div>
      <p className="text-[11px] transition-colors duration-300" style={{ color: s > 0 ? S_COLOR[s] : "#555" }}>
        {s > 0 ? S_LABEL[s] : ""}
      </p>
    </div>
  );
}

// ── Google icon ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ── Shared Input ──────────────────────────────────────────────────────────────
function AuthInput({
  type, placeholder, value, onChange, required, autoFocus, disabled, children,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; required?: boolean;
  autoFocus?: boolean; disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative w-full">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        className="w-full bg-[#0d0d0d] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] text-neutral-200 placeholder-neutral-700 outline-none focus:border-neutral-600 focus:ring-1 focus:ring-white/5 transition-all duration-200 disabled:opacity-50 pr-10"
      />
      {children}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-[var(--border)]" />
      <span className="text-[11px] font-medium text-neutral-600 uppercase tracking-widest">or</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[var(--border)] to-[var(--border)]" />
    </div>
  );
}

// ── Primary Button ────────────────────────────────────────────────────────────
function AuthBtn({
  type = "button", children, loading, disabled, onClick, variant = "primary",
}: {
  type?: "button" | "submit"; children: React.ReactNode;
  loading?: boolean; disabled?: boolean; onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  const base = "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = variant === "primary"
    ? "bg-neutral-100 hover:bg-white active:scale-[0.98] text-neutral-900 shadow-sm"
    : "border border-[var(--border)] hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 bg-transparent";
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${styles}`}>
      {loading
        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
        : children}
    </button>
  );
}

// ── Error Banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-red-900/40 bg-red-950/25 animate-auth-form-in">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1" />
      <p className="text-[12px] text-red-400">{msg}</p>
    </div>
  );
}

// ── Left-panel dynamic content ────────────────────────────────────────────────
type LeftView = "signin" | "signup" | "forgot";

const LEFT = {
  signin: {
    badge: "Welcome back",
    headline: "Unlock your\nencrypted vault.",
    sub: "Your passwords are waiting — secured with AES-256-GCM and decrypted only by you.",
    illustration: "/illustrations/data-thief_d66l.svg",
    formIcon: "/illustrations/secure-login_m11a.svg",
    bullets: [
      { icon: <Lock className="w-3.5 h-3.5" />, title: "AES-256-GCM", desc: "Industry-standard encryption" },
      { icon: <Zap className="w-3.5 h-3.5" />, title: "Zero-knowledge", desc: "We can't read your data. Ever." },
      { icon: <Globe className="w-3.5 h-3.5" />, title: "Access from anywhere", desc: "Synced securely" },
    ],
  },
  signup: {
    badge: "Get started free",
    headline: "Zero-knowledge\nsecurity, day one.",
    sub: "Your vault is encrypted before it leaves your browser. Not even we can see inside.",
    illustration: "/illustrations/security_0ubl.svg",
    formIcon: "/illustrations/vault_tyfh.svg",
    bullets: [
      { icon: <UserPlus className="w-3.5 h-3.5" />, title: "30-second setup", desc: "No credit card required" },
      { icon: <Lock className="w-3.5 h-3.5" />, title: "Master password", desc: "Only you know it — ever" },
      { icon: <Globe className="w-3.5 h-3.5" />, title: "All your devices", desc: "Sync across everything you use" },
    ],
  },
  forgot: {
    badge: "Account recovery",
    headline: "Forgot your\npassword?",
    sub: "Enter your email and we'll send a secure reset link. Your encrypted data stays safe.",
    illustration: "/illustrations/forgot-password_nttj.svg",
    formIcon: "/illustrations/forgot-password_nttj.svg",
    bullets: [
      { icon: <Mail className="w-3.5 h-3.5" />, title: "Check your inbox", desc: "Reset link expires in 1 hour" },
      { icon: <KeyRound className="w-3.5 h-3.5" />, title: "Set new password", desc: "Your vault data is preserved" },
    ],
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────
type Tab = "signin" | "signup";
type View = "main" | "forgot" | "sent";

export default function AuthPage() {
  const { user, isAuthLoading, login, register, googleLogin, resetPassword, isAuthenticating, error } = useAuth();
  const { config } = useSiteConfig();
  const router = useRouter();

  // ─ state
  const [tab, setTab] = useState<Tab>("signin");
  const [view, setView] = useState<View>("main");

  // ─ form fields
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // ─ forgot overlay & crossfades
  const [forgotMounted, setForgotMounted] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [leftView, setLeftView] = useState<LeftView>("signin"); // drives text content (delayed)
  const [activeView, setActiveView] = useState<LeftView>("signin"); // drives illustrations (instant)
  const [fading, setFading] = useState(false);

  // ─ redirect if already logged in
  useEffect(() => {
    if (!isAuthLoading && user) router.replace("/vault");
  }, [user, isAuthLoading, router]);

  const triggerAnim = useCallback((lv: LeftView) => {
    if (lv === leftView) return;
    setActiveView(lv);
    setFading(true);
    setTimeout(() => {
      setLeftView(lv);
      setFading(false);
    }, 150);
  }, [leftView]);

  const switchTab = useCallback((t: Tab) => {
    triggerAnim(t);
    setTimeout(() => setTab(t), 150);
  }, [triggerAnim]);

  const openForgot = useCallback(() => {
    setForgotMounted(true);
    triggerAnim("forgot");
    setTimeout(() => {
      setForgotVisible(true);
      setView("forgot");
    }, 150);
  }, [triggerAnim]);

  const closeForgot = useCallback(() => {
    setForgotVisible(false);
    triggerAnim(tab);
    setTimeout(() => {
      setForgotMounted(false);
      setView("main");
    }, 380);
  }, [tab, triggerAnim]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "signin") await login(email, password);
    else await register(email, password, firstName, username);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await resetPassword(email);
    if (ok) setView("sent");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <span className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  const lc = LEFT[leftView];
  const isSignUp = tab === "signup";

  return (
    <div className="h-screen overflow-hidden flex bg-[var(--bg)] text-[var(--fg)]">

      {/* ══════════════════════ LEFT BRAND PANEL ══════════════════════ */}
      <div className="hidden lg:flex w-[44%] xl:w-[42%] 2xl:w-[40%] shrink-0 h-screen sticky top-0 flex-col justify-between p-12 relative overflow-hidden bg-[#080808] border-r border-[var(--border)]">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 60% at 30% 40%, rgba(255,255,255,0.025) 0%, transparent 70%)" }} />

        {/* Illustration — smooth opacity crossfade without remounts */}
        <div className="absolute inset-0 flex items-end justify-end pr-8 pb-24 pointer-events-none select-none">
          {(["signin", "signup"] as const).map((t) => (
            <Image
              key={t}
              src={LEFT[t].illustration}
              alt=""
              width={400}
              height={400}
              className="absolute object-contain w-[240px] lg:w-[280px] xl:w-[360px] h-auto transition-all duration-700 ease-in-out"
              style={{
                opacity: activeView === t ? 0.6 : 0,
                transform: activeView === t ? "translateX(0px) scale(1)" : "translateX(-20px) scale(0.95)",
                filter: activeView === t ? "blur(0px)" : "blur(4px)"
              }}
              priority
            />
          ))}
        </div>

        {/* ── Logo */}
        <div className="flex items-center relative z-10">
          <Image
            src="/brand/vaultr-full-dark-transparent.png"
            alt={config.name}
            width={120}
            height={24}
            className="h-6 w-auto object-contain"
            priority
          />
        </div>

        {/* ── Center content — crossfades using CSS */}
        <div
          className="relative z-10 space-y-8 transition-all duration-300"
          style={{ opacity: fading ? 0 : 1, transform: fading ? "translateY(8px)" : "translateY(0)" }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[11px] text-neutral-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {lc.badge}
          </div>

          <div className="space-y-3">
            <h2 className="text-[28px] font-semibold text-white leading-tight tracking-tight whitespace-pre-line">
              {lc.headline}
            </h2>
            <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs">
              {lc.sub}
            </p>
          </div>

          <div className="space-y-4">
            {lc.bullets.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-white/5 border border-white/[0.06] flex items-center justify-center text-neutral-500 shrink-0 mt-0.5">
                  {b.icon}
                </div>
                <div>
                  <p className="text-[13px] text-neutral-300 font-medium">{b.title}</p>
                  <p className="text-[11px] text-neutral-600 mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom */}
        <div className="relative z-10">
          <p className="text-[11px] text-neutral-800">
            © {new Date().getFullYear()} {config.name}. Zero-knowledge. Always.
          </p>
        </div>
      </div>

      {/* ══════════════════════ RIGHT FORM PANEL ══════════════════════ */}
      <div className="flex-1 h-screen overflow-y-auto flex items-center justify-center p-6 sm:p-10 relative">

        <div className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none select-none lg:hidden opacity-[0.04]">
          <Image src={lc.illustration} priority alt="" width={192} height={192} className="object-contain w-auto h-auto" style={{ height: "100%", width: "auto" }} />
        </div>

        <div className="w-full max-w-[360px] animate-auth-panel-in relative z-10">

          <div className="flex items-center mb-8 lg:hidden">
            <div className="flex items-center">
              <Image
                src="/brand/vaultr-full-dark-transparent.png"
                alt={config.name}
                width={100}
                height={20}
                className="h-5 w-auto object-contain"
                priority
              />
            </div>
            <Link href="/" className="text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors">← Home</Link>
          </div>

          {/* ── Tab switcher ── */}
          <div className="flex rounded-xl border border-[var(--border)] p-0.5 bg-[#0d0d0d] mb-6">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { if (view !== "main") closeForgot(); switchTab(t); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium rounded-lg transition-all duration-200 cursor-pointer
                  ${tab === t && view === "main" ? "bg-neutral-800 text-neutral-100 shadow-sm" : "text-neutral-600 hover:text-neutral-400"}`}
              >
                {t === "signin" ? <><LogIn className="w-3.5 h-3.5" /> Sign in</> : <><UserPlus className="w-3.5 h-3.5" /> Sign up</>}
              </button>
            ))}
          </div>

          {/* ── Unified Morphing Form ── */}
          <div className="relative overflow-hidden">

            {/* Static Google Button & Title */}
            <div className="space-y-4">

              {/* Contextual Illustration — crossfades via CSS */}
              <div className="relative w-full h-[120px] sm:h-[160px] flex justify-center items-center mb-6 pointer-events-none select-none">
                {(["signin", "signup"] as const).map((t) => (
                  <Image
                    key={t}
                    src={LEFT[t].formIcon}
                    priority
                    alt=""
                    width={200}
                    height={200}
                    className="absolute object-contain w-[120px] sm:w-[160px] h-auto transition-all duration-700 ease-in-out"
                    style={{
                      opacity: activeView === t ? 0.8 : 0,
                      transform: activeView === t ? "scale(1)" : "scale(0.92)",
                      filter: activeView === t ? "blur(0px)" : "blur(2px)"
                    }}
                  />
                ))}
              </div>

              <div
                className="mb-2 text-center transition-all duration-300"
                style={{ opacity: fading ? 0 : 1, transform: fading ? "translateY(4px)" : "translateY(0)" }}
              >
                <h1 className="text-[18px] font-semibold text-neutral-100">
                  {isSignUp ? "Create an account" : "Welcome back"}
                </h1>
                <p className="text-[12px] text-neutral-600 mt-0.5">
                  {isSignUp ? "Set up your zero-knowledge vault." : "Sign in to access your encrypted vault."}
                </p>
              </div>

              <button
                onClick={() => googleLogin()}
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[#0d0d0d] hover:bg-neutral-900 hover:border-neutral-700 text-[13px] text-neutral-300 transition-all duration-200 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                <GoogleIcon /> Continue with Google
              </button>
              <Divider />

              {/* Form starts here */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && <ErrorBanner msg={error} />}

                {/* ── Morphing New Fields (Grid Expansion) ── */}
                <div className={`expand-grid ${isSignUp ? 'expand-open' : 'expand-closed'}`}>
                  <div>
                    <div className="pb-3 flex gap-3">
                      <AuthInput type="text" placeholder="First name" value={firstName} onChange={setFirstName} required={isSignUp} disabled={!isSignUp}>
                        <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-700 pointer-events-none" />
                      </AuthInput>
                      <AuthInput type="text" placeholder="Username" value={username} onChange={setUsername} required={isSignUp} disabled={!isSignUp}>
                        <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-700 pointer-events-none" />
                      </AuthInput>
                    </div>
                  </div>
                </div>

                {/* Static base fields */}
                <AuthInput type="email" placeholder="Email address" value={email} onChange={setEmail} required>
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-700 pointer-events-none" />
                </AuthInput>

                <AuthInput type={showPass ? "text" : "password"} placeholder={isSignUp ? "Create a strong password" : "Password"} value={password} onChange={setPassword} required>
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-700 hover:text-neutral-400 transition-colors cursor-pointer p-0.5" tabIndex={-1}>
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </AuthInput>

                {/* Morphing strength meter */}
                <div className={`expand-grid ${isSignUp ? 'expand-open' : 'expand-closed'}`}>
                  <div>
                    <StrengthMeter pw={password} />
                  </div>
                </div>

                {/* Submit button (text swaps via key to trigger fade) */}
                <div className="pt-1">
                  <AuthBtn type="submit" loading={isAuthenticating}>
                    <span
                      className="flex items-center gap-2 transition-all duration-300"
                      style={{ opacity: fading ? 0 : 1, transform: fading ? "translateY(4px)" : "translateY(0)" }}
                    >
                      {isSignUp ? "Create account" : "Sign in"} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </AuthBtn>
                </div>
              </form>

              {/* Morphing Bottom Links */}
              <div className="relative h-6 mt-2">
                {/* Forget password (Signin Only) */}
                <div className={`absolute inset-x-0 transition-opacity duration-300 ${!isSignUp ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                  <button onClick={openForgot} type="button" className="w-full text-center text-[12px] text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer">
                    Forgot password?
                  </button>
                </div>
                {/* Legal text (Signup Only) */}
                <div className={`absolute inset-x-0 transition-opacity duration-300 ${isSignUp ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
                  <p className="text-[11px] text-neutral-700 text-center leading-relaxed">
                    By signing up you agree to our{" "}
                    <Link href="/terms" className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2">Terms</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2">Privacy Policy</Link>.
                  </p>
                </div>
              </div>

            </div>

            {/* ── FORGOT PASSWORD overlay ── */}
            {forgotMounted && (
              <div
                className="absolute inset-0 bg-[var(--bg)] z-20 flex flex-col justify-center"
                style={{
                  transform: forgotVisible ? "translateY(0)" : "translateY(16px)",
                  opacity: forgotVisible ? 1 : 0,
                  transition: "transform 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.38s ease",
                }}
              >
                {view === "sent" ? (
                  <div className="space-y-5 animate-auth-success text-center">
                    <div className="relative w-full h-[140px] flex justify-center items-center pointer-events-none select-none my-1">
                      <Image
                        src="/illustrations/message-sent_iyz6.svg"
                        alt="Reset link sent"
                        width={180}
                        height={180}
                        priority
                        className="w-[140px] h-auto object-contain opacity-90 filter drop-shadow(0 10px 20px rgba(0,0,0,0.5))"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Reset Link Sent
                      </div>
                      <h2 className="text-[18px] font-bold text-neutral-100 pt-1">Check your inbox</h2>
                      <p className="text-[12px] text-neutral-400 leading-relaxed max-w-xs mx-auto">
                        We&apos;ve sent a password reset link to <br />
                        <span className="text-neutral-200 font-semibold">{email}</span>
                      </p>
                    </div>
                    <div className="pt-2">
                      <AuthBtn onClick={closeForgot} variant="ghost">← Back to sign in</AuthBtn>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center mb-6">
                      <Image src={lc.formIcon} priority alt="" width={140} height={140} className="w-[120px] sm:w-[140px] h-auto mx-auto opacity-80 mb-4" />
                      <h2 className="text-[18px] font-semibold text-neutral-100">Reset password</h2>
                      <p className="text-[12px] text-neutral-600 mt-1">Enter your email and we&apos;ll send a link.</p>
                    </div>
                    {error && <ErrorBanner msg={error} />}
                    <form onSubmit={handleForgot} className="space-y-3">
                      <AuthInput type="email" placeholder="Email address" value={email} onChange={setEmail} required autoFocus>
                        <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-700 pointer-events-none" />
                      </AuthInput>
                      <AuthBtn type="submit" loading={isAuthenticating}>
                        Send link <ArrowRight className="w-3.5 h-3.5" />
                      </AuthBtn>
                    </form>
                    <button onClick={closeForgot} className="w-full text-center text-[12px] text-neutral-700 hover:text-neutral-400 transition-colors py-1">
                      ← Back to sign in
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
