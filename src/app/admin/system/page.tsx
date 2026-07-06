"use client";

import { useState, useEffect } from "react";
import { ServerCog, ShieldAlert, PauseCircle, Webhook, HardDrive, Save } from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";

interface SystemConfig {
  pauseSignups: boolean;
  maintenanceMode: boolean;
  discordWebhook: string | null;
  backupCron: string | null;
}

interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
}

export default function SystemOpsPage() {
  const { config: siteConfig, updateConfig } = useSiteConfig();
  const [layout, setLayout] = useState<"split" | "bento">("split");

  const [config, setConfig] = useState<SystemConfig>({
    pauseSignups: false,
    maintenanceMode: false,
    discordWebhook: "",
    backupCron: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    if (siteConfig?.vaultDialogLayout) {
      setLayout(siteConfig.vaultDialogLayout);
    }
  }, [siteConfig]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/admin/system");
        if (!res.ok) throw new Error("Failed to load system config");
        const data = await res.json();
        setConfig({
          pauseSignups: data.pauseSignups || false,
          maintenanceMode: data.maintenanceMode || false,
          discordWebhook: data.discordWebhook || "",
          backupCron: data.backupCron || "",
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    const fetchBackups = async () => {
      try {
        const res = await fetch("/api/admin/system/backup");
        if (res.ok) {
          const data = await res.json();
          setBackups(data.backups || []);
        }
      } catch (err) {
        console.error("Failed to fetch backups", err);
      }
    };
    fetchConfig();
    fetchBackups();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      // Save global site config layout toggle too!
      await updateConfig({ vaultDialogLayout: layout });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch("/api/admin/system/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      alert("Backup completed successfully: " + data.file);

      const resList = await fetch("/api/admin/system/backup");
      if (resList.ok) {
        const listData = await resList.json();
        setBackups(listData.backups || []);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBackingUp(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-[var(--fg-muted)]">Loading system operations...</div>;
  }

  return (
    <div className="p-8 pb-20 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--fg)] flex items-center gap-2">
          <ServerCog className="h-6 w-6 text-[var(--accent)]" />
          System Operations
        </h1>
        <p className="text-[var(--fg-muted)] mt-1">
          Global system controls, panic buttons, and webhook integrations.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          Settings saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Panic Buttons */}
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--surface)] overflow-hidden">
            <div className="p-4 border-b border-[var(--danger)]/30 bg-[var(--danger)]/5 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[var(--danger)]" />
              <h3 className="font-semibold text-[var(--danger)]">Emergency Controls</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-[var(--fg)] flex items-center gap-2">
                    <PauseCircle className="h-4 w-4 text-orange-500" />
                    Pause New Signups
                  </h4>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">
                    Prevents any new accounts from being created. Existing users can still log in.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.pauseSignups}
                    onChange={(e) => setConfig({ ...config, pauseSignups: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-[var(--bg)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
                <div>
                  <h4 className="font-medium text-[var(--fg)] flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />
                    Maintenance Mode
                  </h4>
                  <p className="text-sm text-[var(--fg-muted)] mt-1">
                    Takes the entire site offline for non-admins. All API requests will return 503.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.maintenanceMode}
                    onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-[var(--bg)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--danger)]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Webhooks */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center gap-2">
              <Webhook className="h-5 w-5 text-[#5865F2]" />
              <h3 className="font-semibold text-[var(--fg)]">Discord Integration</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                Webhook URL
              </label>
              <input
                type="text"
                value={config.discordWebhook || ""}
                onChange={(e) => setConfig({ ...config, discordWebhook: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--fg)] focus:border-[#5865F2] focus:outline-none"
                placeholder="https://discord.com/api/webhooks/..."
              />
              <p className="text-xs text-[var(--fg-muted)] mt-2">
                If set, Vaultr will post critical alerts (like panic button activations and new admin logins) directly to this Discord channel.
              </p>
            </div>
          </div>

          {/* Vault Layout Customization */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center gap-2">
              <ServerCog className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="font-semibold text-[var(--fg)]">Vault Layout Customization</h3>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-medium text-[var(--fg-muted)]">
                Entry Dialog Global Layout
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setLayout("split")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    layout === "split"
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--fg)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <span className="font-semibold text-sm">Split Preview Layout</span>
                  <span className="text-[11px] text-[var(--fg-muted)] mt-1.5 leading-relaxed">
                    Left-side live-updating mock badge previews (and card details) alongside a structured form list on the right.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLayout("bento")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    layout === "bento"
                      ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--fg)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <span className="font-semibold text-sm">Bento Grid Dashboard</span>
                  <span className="text-[11px] text-[var(--fg-muted)] mt-1.5 leading-relaxed">
                    Modern card configuration arranging previews, inputs, password generators, and security metrics in clean bento blocks.
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div> {/* Closes first space-y-6 */}

        <div className="space-y-6">
          {/* Backups */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="font-semibold text-[var(--fg)]">Automated Backups</h3>
              </div>
              <button
                onClick={handleTriggerBackup}
                disabled={backingUp}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
              >
                {backingUp ? "Running..." : "Trigger Manual Backup"}
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-[var(--fg-muted)] mb-2">
                Backup Cron Schedule (Optional)
              </label>
              <input
                type="text"
                value={config.backupCron || ""}
                onChange={(e) => setConfig({ ...config, backupCron: e.target.value })}
                className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
                placeholder="0 0 * * *"
              />
              <p className="text-xs text-[var(--fg-muted)] mt-2 mb-6">
                Standard cron format. If empty, automated backups are disabled. Note: Backups must be securely configured via the backend worker.
              </p>

              {/* Backups List */}
              {backups.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--fg)] uppercase tracking-wider mb-3">Available Backups</h4>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {backups.map(b => (
                      <div key={b.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono text-[var(--fg)]">{b.name}</span>
                          <span className="text-xs text-[var(--fg-muted)]">
                            {new Date(b.createdAt).toLocaleString()} • {(b.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 font-medium text-white hover:bg-[var(--accent)]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="h-4 w-4" />}
            Save System State
          </button>
        </div>
      </div>
    </div>
  );
}
