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
import { Check, Unlink, Link2, AlertCircle, KeySquare } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

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
        <h2 className="text-[14px] font-semibold text-neutral-200">{title}</h2>
        {description && (
          <p className="text-[12px] text-neutral-600">{description}</p>
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
      <label className="text-[11px] text-neutral-600 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  "google.com": { label: "Google", color: "text-blue-400 border-blue-900/50 bg-blue-950/20" },
  "password":   { label: "Email / Password", color: "text-neutral-400 border-[var(--border)] bg-neutral-900" },
};

export default function AccountSettingsPage() {
  const { user } = useFirebaseAuth();
  const { activeTheme, setUserTheme, allThemes } = useTheme();

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

  // ── Theme preference
  const THEME_OPTIONS = [
    { value: "admin",  label: "System Theme" },
    { value: "light",  label: "Light Theme" },
    { value: "dark",   label: "Dark Theme" },
  ] as const;

  const currentThemeChoice = (() => {
    if (typeof window === "undefined") return "admin";
    const storageKey = user ? `vaultr_theme_${user.uid}` : "vaultr_theme";
    const val = localStorage.getItem(storageKey);
    if (!val) return "admin";
    if (val === "light" || val === "dark") return val;
    return "admin";
  })();

  const saveTheme = (val: "admin" | "light" | "dark") => {
    if (val === "admin") {
      setUserTheme(null);
    } else {
      setUserTheme(val);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[18px] font-semibold text-neutral-100">Account</h1>
        <p className="text-[13px] text-neutral-600">
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
              <div className="w-16 h-16 rounded-full bg-neutral-800 border border-[var(--border)] flex items-center justify-center text-[18px] font-semibold text-neutral-300">
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
            const meta = PROVIDER_META[p.providerId] ?? { label: p.providerId, color: "text-neutral-400 border-[var(--border)] bg-neutral-900" };
            return (
              <div
                key={p.providerId}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--border)] bg-neutral-900/60"
              >
                <div className="space-y-0.5">
                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded border text-[11px] ${meta.color}`}>
                    {meta.label}
                  </span>
                  {(p.email || (p.providerId === "password" && user?.email)) && (
                    <p className="text-[11px] text-neutral-600 mt-1">
                      {p.email || user?.email}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleUnlink(p.providerId)}
                  className="flex items-center gap-1.5 text-[12px] text-neutral-600 hover:text-red-400 transition-colors cursor-pointer"
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
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-[13px] text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer w-full"
            >
              <Link2 className="w-4 h-4" />
              Link Google account
            </button>
          )}

          {!hasPassword && !linkingEmail && (
            <button
              onClick={() => setLinkingEmail(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-[13px] text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-colors cursor-pointer w-full"
            >
              <KeySquare className="w-4 h-4" />
              Link Email &amp; Password
            </button>
          )}

          {linkingEmail && (
            <div className="p-4 rounded-lg border border-[var(--border)] bg-neutral-900/40 space-y-3">
              <p className="text-[12px] text-neutral-300 font-medium">Link Email &amp; Password</p>
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

      {/* ── Theme preference */}
      <Section
        title="Theme Preference"
        description="Override the theme for this browser."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => saveTheme(value)}
              className={`px-4 py-3 rounded-lg border text-[13px] text-left transition-colors cursor-pointer ${
                currentThemeChoice === value
                  ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                  : "border-[var(--border)] text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{label}</span>
                {currentThemeChoice === value && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
