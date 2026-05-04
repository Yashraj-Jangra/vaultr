"use client";

import React, { useState, useEffect } from "react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { auth, db } from "@/lib/firebase/client";
import {
  updateProfile,
  unlink,
  GoogleAuthProvider,
  linkWithPopup,
  EmailAuthProvider,
  linkWithCredential
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Check, Unlink, Link2, AlertCircle, KeySquare, Moon, Sun, Monitor } from "lucide-react";
import { useTheme, AppMode } from "@/context/ThemeContext";
import { ThemeConfig } from "@/lib/themes";

// We export dynamic so SSR doesn't complain about useFirebaseAuth
export const dynamic = "force-dynamic";

function StatusMsg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <span
      className={`text-[12px] flex items-center gap-1.5 ${ok ? "text-emerald-400" : "text-red-400"}`}
    >
      {ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
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
    <section className="border border-[var(--border)] rounded-xl p-6 space-y-5 bg-[var(--surface)]">
      <div className="space-y-1">
        <h2 className="text-[14px] font-semibold text-[var(--fg)]">{title}</h2>
        {description && (
          <p className="text-[12px] text-[var(--fg-muted)]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  "google.com": { label: "Google", color: "text-blue-400 border-blue-900/50 bg-blue-950/20" },
  "password":   { label: "Email / Password", color: "text-[var(--fg-muted)] border-[var(--border)] bg-[var(--bg)]" },
};

// ── Theme card ─────────────────────────────────────────────────────────────
function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={theme.name}
      className={`relative flex flex-col gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer text-left w-full focus:outline-none ${
        selected
          ? "border-[var(--accent)] bg-[var(--bg)]"
          : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-hover)]"
      }`}
    >
      {/* Color swatches */}
      <div className="flex gap-1 items-center">
        <span
          className="w-3 h-3 rounded-full border border-black/10 shrink-0"
          style={{ backgroundColor: theme.colors.bg }}
        />
        <span
          className="w-3 h-3 rounded-full border border-black/10 shrink-0"
          style={{ backgroundColor: theme.colors.accent }}
        />
        <span
          className="w-3 h-3 rounded-full border border-black/10 shrink-0"
          style={{ backgroundColor: theme.colors.surface }}
        />
        <span
          className="w-3 h-3 rounded-full border border-black/10 shrink-0"
          style={{ backgroundColor: theme.colors.danger }}
        />
      </div>

      {/* Name */}
      <span className="text-[11px] font-medium text-[var(--fg)] truncate leading-tight">
        {theme.name}
      </span>

      {/* Selected checkmark */}
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--accent)] flex items-center justify-center">
          <Check className="w-2 h-2 text-[var(--bg)]" />
        </span>
      )}
    </button>
  );
}

// ── Theme slot group ────────────────────────────────────────────────────────
function ThemeSlotGroup({
  label,
  icon,
  themes,
  selectedId,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  themes: ThemeConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--fg-muted)] shrink-0">{icon}</span>
        <span className="text-[11px] font-semibold text-[var(--fg)] uppercase tracking-wider">{label}</span>
      </div>
      {themes.length === 0 ? (
        <p className="text-[12px] text-[var(--fg-muted)] italic">No published themes in this mode yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {themes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              selected={selectedId === t.id}
              onSelect={() => onSelect(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AccountSettingsPage() {
  const { user } = useFirebaseAuth();
  const {
    themes,
    mode,
    darkThemeId,
    lightThemeId,
    setMode,
    setDarkTheme,
    setLightTheme,
  } = useTheme();

  // ── Basic Profile (Auth)
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? "");
  const [authSaving, setAuthSaving] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: "", ok: true });

  const saveAuthProfile = async () => {
    if (!auth.currentUser) return;
    setAuthSaving(true);
    setAuthMsg({ text: "", ok: true });
    try {
      await updateProfile(auth.currentUser, { 
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || null
      });
      setAuthMsg({ text: "Primary profile updated.", ok: true });
    } catch (e) {
      setAuthMsg({ text: (e as Error).message || "Error updating profile.", ok: false });
    } finally {
      setAuthSaving(false);
    }
  };

  // ── Extra Personal Details (Firestore)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState({ text: "", ok: true });
  const [detailsLoaded, setDetailsLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchPersonal = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "profile", "personal"));
        if (snap.exists()) {
          const data = snap.data();
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setPhone(data.phone || "");
        }
      } catch (err) {
        console.error("Could not fetch personal profile:", err);
      } finally {
        setDetailsLoaded(true);
      }
    };
    fetchPersonal();
  }, [user]);

  const savePersonalDetails = async () => {
    if (!user) return;
    setDetailsSaving(true);
    setDetailsMsg({ text: "", ok: true });
    try {
      await setDoc(doc(db, "users", user.uid, "profile", "personal"), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setDetailsMsg({ text: "Personal details saved.", ok: true });
    } catch (e) {
      setDetailsMsg({ text: (e as Error).message || "Error saving details.", ok: false });
    } finally {
      setDetailsSaving(false);
    }
  };

  // ── Provider management
  const [providerMsg, setProviderMsg] = useState({ text: "", ok: true });
  const [linkingEmail, setLinkingEmail] = useState(false);
  const [linkEmailStr, setLinkEmailStr] = useState("");
  const [linkPassStr, setLinkPassStr] = useState("");

  const handleUnlink = async (providerId: string) => {
    if (!auth.currentUser) return;
    if ((auth.currentUser.providerData?.length ?? 0) <= 1) {
      setProviderMsg({ text: "Can't unlink — this is your only sign-in method.", ok: false });
      return;
    }
    try {
      await unlink(auth.currentUser, providerId);
      setProviderMsg({ text: "Provider unlinked.", ok: true });
    } catch (err) {
      setProviderMsg({ text: (err as Error).message, ok: false });
    }
  };

  const handleLinkGoogle = async () => {
    if (!auth.currentUser) return;
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(auth.currentUser, provider);
      setProviderMsg({ text: "Google account linked.", ok: true });
    } catch (err) {
      setProviderMsg({ text: (err as Error).message, ok: false });
    }
  };

  const handleLinkEmailPassword = async () => {
    if (!auth.currentUser || !linkEmailStr || !linkPassStr) return;
    try {
      const credential = EmailAuthProvider.credential(linkEmailStr, linkPassStr);
      await linkWithCredential(auth.currentUser, credential);
      setProviderMsg({ text: "Email & Password linked.", ok: true });
      setLinkingEmail(false);
      setLinkEmailStr("");
      setLinkPassStr("");
    } catch (err) {
      setProviderMsg({ text: (err as Error).message, ok: false });
    }
  };

  const providers = user?.providerData ?? [];
  const hasGoogle = providers.some((p) => p.providerId === "google.com");
  const hasPassword = providers.some((p) => p.providerId === "password");

  // ── Theme data ─────────────────────────────────────────────────────────
  const darkThemes  = themes.filter((t) => t.mode === "dark");
  const lightThemes = themes.filter((t) => t.mode === "light");

  const MODE_OPTIONS: { value: AppMode; label: string; icon: React.ReactNode }[] = [
    { value: "dark",   label: "Dark",   icon: <Moon   className="w-3.5 h-3.5" /> },
    { value: "light",  label: "Light",  icon: <Sun    className="w-3.5 h-3.5" /> },
    { value: "system", label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
  ];

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[18px] font-semibold text-[var(--fg)]">Account</h1>
        <p className="text-[13px] text-[var(--fg-muted)]">
          Manage your profile, sign-in methods, and theme preference.
        </p>
      </div>

      {/* ── Primary Profile (Auth) */}
      <Section
        title="Primary Profile"
        description="This information is publicly visible and tied to your authentication record."
      >
        <div className="flex items-center gap-5 mb-4">
          <div className="relative shrink-0">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoURL}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border border-[var(--border)]"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--border)] border border-[var(--border)] flex items-center justify-center text-[18px] font-semibold text-[var(--fg)]">
                {initials}
              </div>
            )}
          </div>
          <div className="space-y-1 flex-1">
            <FieldRow label="Avatar Photo URL">
              <Input
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
            </FieldRow>
          </div>
        </div>

        <FieldRow label="Display Name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </FieldRow>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={saveAuthProfile} disabled={authSaving}>
            {authSaving ? "Saving…" : "Save Primary Profile"}
          </Button>
          <StatusMsg {...authMsg} />
        </div>
      </Section>

      {/* ── Personal Details (Firestore) */}
      <Section
        title="Personal Details"
        description="Optional additional information stored securely in your vault."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="First Name">
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Satoshi"
              disabled={!detailsLoaded}
            />
          </FieldRow>
          <FieldRow label="Last Name">
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Nakamoto"
              disabled={!detailsLoaded}
            />
          </FieldRow>
        </div>
        <FieldRow label="Phone Number">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            disabled={!detailsLoaded}
          />
        </FieldRow>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={savePersonalDetails} disabled={detailsSaving || !detailsLoaded} variant="ghost" className="border border-[var(--border)]">
            {detailsSaving ? "Saving…" : "Save Personal Details"}
          </Button>
          <StatusMsg {...detailsMsg} />
        </div>
      </Section>

      {/* ── Connected providers */}
      <Section
        title="Sign-in Methods"
        description="Manage which providers are linked to your account. You must have at least one."
      >
        <div className="space-y-2">
          {providers.map((p) => {
            const meta = PROVIDER_META[p.providerId] ?? { label: p.providerId, color: "text-[var(--fg-muted)] border-[var(--border)] bg-[var(--bg)]" };
            return (
              <div
                key={p.providerId}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]"
              >
                <div className="space-y-0.5">
                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded border text-[11px] ${meta.color}`}>
                    {meta.label}
                  </span>
                  {(p.email || (p.providerId === "password" && user?.email)) && (
                    <p className="text-[11px] text-[var(--fg-muted)] mt-1">
                      {p.email || user?.email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleUnlink(p.providerId)}
                  className="flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                  title="Unlink provider"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Unlink
                </button>
              </div>
            );
          })}

          {!hasGoogle && (
            <button
              onClick={handleLinkGoogle}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-hover)] transition-colors cursor-pointer w-full"
            >
              <Link2 className="w-4 h-4" />
              Link Google account
            </button>
          )}

          {!hasPassword && !linkingEmail && (
            <button
              onClick={() => setLinkingEmail(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-hover)] transition-colors cursor-pointer w-full"
            >
              <KeySquare className="w-4 h-4" />
              Link Email &amp; Password
            </button>
          )}

          {linkingEmail && (
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] space-y-3">
              <p className="text-[12px] text-[var(--fg)] font-medium">Link Email &amp; Password</p>
              <div className="space-y-2">
                <Input 
                  value={linkEmailStr} 
                  onChange={(e) => setLinkEmailStr(e.target.value)} 
                  placeholder="Email address" 
                  type="email"
                />
                <Input 
                  value={linkPassStr} 
                  onChange={(e) => setLinkPassStr(e.target.value)} 
                  placeholder="Password" 
                  type="password"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleLinkEmailPassword} disabled={!linkEmailStr || !linkPassStr}>Link Account</Button>
                <Button variant="ghost" onClick={() => setLinkingEmail(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <StatusMsg {...providerMsg} />
        </div>
      </Section>

      {/* ── Theme Preference */}
      <Section
        title="Theme Preference"
        description="Choose your active mode, then pick a theme for each mode independently."
      >
        {/* Mode toggle */}
        <div className="space-y-2">
          <p className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wider font-semibold">Active Mode</p>
          <div className="flex gap-2">
            {MODE_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-medium transition-all cursor-pointer ${
                  mode === value
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                    : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-hover)] hover:text-[var(--fg)]"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          {mode === "system" && (
            <p className="text-[11px] text-[var(--fg-muted)] pl-1">
              Automatically follows your OS dark/light preference.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--border)]" />

        {/* Dark theme slot */}
        <ThemeSlotGroup
          label="Dark Theme"
          icon={<Moon className="w-4 h-4" />}
          themes={darkThemes}
          selectedId={darkThemeId}
          onSelect={(id) => setDarkTheme(id)}
        />

        {/* Light theme slot */}
        <ThemeSlotGroup
          label="Light Theme"
          icon={<Sun className="w-4 h-4" />}
          themes={lightThemes}
          selectedId={lightThemeId}
          onSelect={(id) => setLightTheme(id)}
        />
      </Section>
    </div>
  );
}
