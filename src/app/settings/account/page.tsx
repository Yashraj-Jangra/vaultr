"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Check, Link2, AlertCircle, KeySquare, Moon, Sun, Monitor, CheckCircle2 } from "lucide-react";
import { useTheme, AppMode } from "@/context/ThemeContext";
import { ThemeConfig } from "@/lib/themes";

export const dynamic = "force-dynamic";

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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-neutral-400 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  "google.com": { label: "Google", color: "text-blue-400 border-blue-900/50 bg-blue-950/20" },
  "password":   { label: "Email / Password", color: "text-neutral-400 border-neutral-700 bg-neutral-900" },
};

function ThemeCard({ theme, selected, onSelect }: { theme: ThemeConfig; selected: boolean; onSelect: () => void; }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
        selected ? "border-neutral-500 bg-neutral-800" : "border-transparent bg-neutral-900 hover:border-neutral-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: theme.colors.bg }} />
          <span className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: theme.colors.accent }} />
        </div>
        <span className={`text-[13px] ${selected ? "text-neutral-200 font-medium" : "text-neutral-400"}`}>{theme.name}</span>
      </div>
      {selected && <Check className="w-4 h-4 text-neutral-300" />}
    </button>
  );
}

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { themes, mode, darkThemeId, lightThemeId, setMode, setDarkTheme, setLightTheme } = useTheme();

  // Basic Profile
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? "");
  const [authSaving, setAuthSaving] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: "", ok: true });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setAuthMsg({ text: "", ok: true });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to upload avatar.");
      const data = await res.json();
      setPhotoURL(data.avatarUrl);
      setAuthMsg({ text: "Avatar uploaded successfully.", ok: true });
    } catch (err) {
      setAuthMsg({ text: (err as Error).message, ok: false });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveAuthProfile = async () => {
    if (!user) return;
    setAuthSaving(true);
    setAuthMsg({ text: "", ok: true });
    try {
      const result = await authClient.updateUser({ name: displayName.trim(), image: photoURL.trim() || undefined });
      if (result.error) throw new Error(result.error.message);
      setAuthMsg({ text: "Primary profile updated.", ok: true });
    } catch (e) {
      setAuthMsg({ text: (e as Error).message || "Error updating profile.", ok: false });
    } finally {
      setAuthSaving(false);
    }
  };

  // Personal Details
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
        const res = await fetch("/api/vault/profile");
        if (res.ok) {
          const data = await res.json();
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
      const res = await fetch("/api/vault/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save details");
      setDetailsMsg({ text: "Personal details saved.", ok: true });
    } catch (e) {
      setDetailsMsg({ text: (e as Error).message || "Error saving details.", ok: false });
    } finally {
      setDetailsSaving(false);
    }
  };

  // Providers
  const [accounts, setAccounts] = useState<{ id: string; providerId: string; email?: string }[]>([]);
  const [providerMsg, setProviderMsg] = useState({ text: "", ok: true });
  const [linkingEmail, setLinkingEmail] = useState(false);
  const [linkEmailStr, setLinkEmailStr] = useState("");
  const [linkPassStr, setLinkPassStr] = useState("");

  useEffect(() => {
    if (!user) return;
    authClient.listAccounts().then(res => {
      if (res.data) setAccounts(res.data.map(acc => ({ id: acc.id, providerId: acc.providerId, email: acc.accountId ?? undefined })));
    }).catch(console.error);
  }, [user]);

  const handleUnlink = async (providerId: string) => {
    if (accounts.length <= 1) {
      setProviderMsg({ text: "Can't unlink — this is your only sign-in method.", ok: false });
      return;
    }
    try {
      const result = await authClient.unlinkAccount({ providerId });
      if (result.error) throw new Error(result.error.message);
      setProviderMsg({ text: "Provider unlinked.", ok: true });
      const res = await authClient.listAccounts();
      if (res.data) setAccounts(res.data.map(acc => ({ id: acc.id, providerId: acc.providerId, email: acc.accountId ?? undefined })));
    } catch (err) {
      setProviderMsg({ text: (err as Error).message, ok: false });
    }
  };

  const handleLinkGoogle = async () => {
    try {
      const result = await authClient.linkSocial({ provider: "google" });
      if (result.error) throw new Error(result.error.message);
      setProviderMsg({ text: "Google account linked.", ok: true });
    } catch (err) {
      setProviderMsg({ text: (err as Error).message, ok: false });
    }
  };

  const handleLinkEmailPassword = async () => {
    if (!linkEmailStr || !linkPassStr) return;
    try {
      const res = await fetch("/api/settings/set-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: linkPassStr }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to link email/password");
      setProviderMsg({ text: "Email & Password linked.", ok: true });
      setLinkingEmail(false);
      const accRes = await authClient.listAccounts();
      if (accRes.data) setAccounts(accRes.data.map(acc => ({ id: acc.id, providerId: acc.providerId, email: acc.accountId ?? undefined })));
    } catch (err) {
      setProviderMsg({ text: (err as Error).message, ok: false });
    }
  };

  const hasGoogle = accounts.some((p) => p.providerId === "google");
  const hasPassword = accounts.some((p) => p.providerId === "credential");

  const MODE_OPTIONS: { value: AppMode; label: string; icon: React.ReactNode }[] = [
    { value: "dark",   label: "Dark",   icon: <Moon   className="w-3.5 h-3.5" /> },
    { value: "light",  label: "Light",  icon: <Sun    className="w-3.5 h-3.5" /> },
    { value: "system", label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
  ];

  const initials = user?.displayName ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="pb-20 max-w-5xl mx-auto">
      <div className="mb-10 border-b border-[var(--border)] pb-6">
        <h1 className="text-[22px] font-semibold text-neutral-100">Account</h1>
        <p className="text-[14px] text-neutral-500 mt-1">Manage your profile, sign-in methods, and visual themes.</p>
      </div>

      <Section title="Primary Profile" description="Publicly visible information tied to your authentication record.">
        <FieldBox>
          <div className="flex items-start gap-6">
            <div className="relative group shrink-0 mt-1">
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoURL} alt="Avatar" className="w-16 h-16 rounded-full object-cover border border-neutral-700" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-16 h-16 rounded-full border border-neutral-700 bg-neutral-800 flex items-center justify-center text-lg font-bold text-neutral-300">{initials}</div>
              )}
              <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-white cursor-pointer backdrop-blur-sm">
                {uploadingAvatar ? "..." : "Change"}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleAvatarFileChange} accept="image/*" className="hidden" />
            </div>
            <div className="flex-1 max-w-md space-y-4">
              <FieldRow label="Display Name">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your full name" className="bg-neutral-900 border-neutral-800" />
              </FieldRow>
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={saveAuthProfile} disabled={authSaving} variant="primary">
                  {authSaving ? "Saving…" : "Save Profile"}
                </Button>
                <StatusMsg {...authMsg} />
              </div>
            </div>
          </div>
        </FieldBox>
      </Section>

      <Section title="Personal Details" description="Encrypted extra information stored locally before syncing.">
        <FieldBox>
          <div className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="First Name"><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!detailsLoaded} className="bg-neutral-900 border-neutral-800" /></FieldRow>
              <FieldRow label="Last Name"><Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!detailsLoaded} className="bg-neutral-900 border-neutral-800" /></FieldRow>
            </div>
            <FieldRow label="Phone Number">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!detailsLoaded} className="bg-neutral-900 border-neutral-800" />
            </FieldRow>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={savePersonalDetails} disabled={detailsSaving || !detailsLoaded} variant="primary">
                {detailsSaving ? "Saving…" : "Save Details"}
              </Button>
              <StatusMsg {...detailsMsg} />
            </div>
          </div>
        </FieldBox>
      </Section>

      <Section title="Sign-in Methods" description="Manage providers linked to your account.">
        <FieldBox>
          <div className="space-y-6">
            <div className="space-y-3">
              {accounts.map((p) => {
                const meta = PROVIDER_META[p.providerId] ?? { label: p.providerId, color: "text-neutral-400 border-neutral-700 bg-neutral-900" };
                return (
                  <div key={p.id} className="flex items-center justify-between py-3 px-4 border border-neutral-800 bg-neutral-900/50 rounded-lg">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
                        {meta.label}
                      </span>
                      {(p.email || (p.providerId === "credential" && user?.email)) && (
                        <p className="text-[13px] text-neutral-300 font-medium">{p.email || user?.email}</p>
                      )}
                    </div>
                    {p.providerId !== "credential" && (
                      <button onClick={() => handleUnlink(p.providerId)} className="text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors bg-red-950/20 px-3 py-1.5 rounded-md border border-red-900/30">
                        Unlink
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              {!hasGoogle && (
                <button onClick={handleLinkGoogle} className="text-[13px] text-neutral-300 hover:text-white bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 transition-colors flex items-center gap-2">
                  <Link2 className="w-4 h-4" /> Link Google
                </button>
              )}
              {!hasPassword && !linkingEmail && (
                <button onClick={() => setLinkingEmail(true)} className="text-[13px] text-neutral-300 hover:text-white bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 transition-colors flex items-center gap-2">
                  <KeySquare className="w-4 h-4" /> Link Password
                </button>
              )}
            </div>

            {linkingEmail && (
              <div className="p-5 border border-neutral-800 rounded-xl bg-neutral-900/80 space-y-4">
                <p className="text-[13px] font-semibold text-neutral-200">Link Email & Password</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input value={linkEmailStr} onChange={(e) => setLinkEmailStr(e.target.value)} placeholder="Email" type="email" className="bg-neutral-950" />
                  <Input value={linkPassStr} onChange={(e) => setLinkPassStr(e.target.value)} placeholder="Password" type="password" className="bg-neutral-950" />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleLinkEmailPassword} disabled={!linkEmailStr || !linkPassStr} variant="primary">Submit</Button>
                  <Button variant="ghost" onClick={() => setLinkingEmail(false)}>Cancel</Button>
                </div>
              </div>
            )}
            <StatusMsg {...providerMsg} />
          </div>
        </FieldBox>
      </Section>

      <Section title="Appearance" description="Select an active mode and preferred themes.">
        <FieldBox>
          <div className="space-y-8">
            <FieldRow label="Mode">
              <div className="flex gap-3">
                {MODE_OPTIONS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-colors border ${
                      mode === value ? "border-[var(--accent)] text-[var(--accent)] bg-neutral-900" : "border-neutral-800 text-neutral-400 bg-neutral-900/50 hover:text-neutral-200 hover:border-neutral-600"
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </FieldRow>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FieldRow label="Dark Themes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {themes.filter((t) => t.mode === "dark").map((t) => (
                    <ThemeCard key={t.id} theme={t} selected={darkThemeId === t.id} onSelect={() => setDarkTheme(t.id)} />
                  ))}
                </div>
              </FieldRow>

              <FieldRow label="Light Themes">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {themes.filter((t) => t.mode === "light").map((t) => (
                    <ThemeCard key={t.id} theme={t} selected={lightThemeId === t.id} onSelect={() => setLightTheme(t.id)} />
                  ))}
                </div>
              </FieldRow>
            </div>
          </div>
        </FieldBox>
      </Section>
    </div>
  );
}
