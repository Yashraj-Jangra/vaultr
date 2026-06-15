"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSiteConfig } from "@/context/SiteConfigContext";

export default function CardsSettingsPage() {
  const { user } = useAuth();
  const { config, loading, updateConfig } = useSiteConfig();
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [bins, setBins] = useState<{prefix: string, brand: string}[]>([]);
  const [easterEggs, setEasterEggs] = useState<string[]>([]);
  const [newEgg, setNewEgg] = useState("");

  // Sync state when config loads
  useEffect(() => {
    if (!loading && config) {
      setBins(config.cardBins || []);
      setEasterEggs(config.cardEasterEggs || []);
    }
  }, [config, loading]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateConfig({
        cardBins: bins,
        cardEasterEggs: easterEggs,
      });
      setMessage({ type: 'success', text: "Card settings saved successfully." });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: (err as Error).message || "Failed to save card settings." });
    } finally {
      setSaving(false);
    }
  };

  const addBin = () => {
    setBins([{ prefix: "", brand: "Visa" }, ...bins]);
  };

  const removeBin = (index: number) => {
    setBins(bins.filter((_, i) => i !== index));
  };

  const updateBin = (index: number, field: "prefix" | "brand", value: string) => {
    const newBins = [...bins];
    newBins[index][field] = value;
    setBins(newBins);
  };

  const addEasterEgg = () => {
    if (!newEgg.trim()) return;
    if (easterEggs.includes(newEgg.trim())) return;
    setEasterEggs([newEgg.trim(), ...easterEggs]);
    setNewEgg("");
  };

  const removeEasterEgg = (egg: string) => {
    setEasterEggs(easterEggs.filter((e) => e !== egg));
  };

  if (loading) {
    return <div className="p-8 pb-20 animate-pulse bg-[var(--surface)] min-h-screen" />;
  }

  return (
    <div className="p-8 pb-20 w-full max-w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Card Features Settings</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-1">Configure Bank Identification Numbers (BINs) and Easter eggs for the Vault's credit card preview.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center border ${
          message.type === 'error' 
            ? 'bg-[var(--danger)]/5 text-[var(--danger)] border-[var(--danger)]/20' 
            : 'bg-[#34d399]/5 text-[#34d399] border-[#34d399]/20'
        }`}>
          {message.type === 'error' ? (
            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
        
        {/* BIN Configurations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[var(--fg)]">BIN Network Mappings</h3>
              <p className="text-xs text-[var(--fg-muted)] mt-1">
                Define the prefix strings used to automatically detect the card brand when a user enters a card number.
              </p>
            </div>
            <button
              type="button"
              onClick={addBin}
              className="shrink-0 flex items-center justify-center rounded-md bg-[var(--bg)] border border-[var(--border)] px-4 py-2 text-xs font-medium hover:bg-[var(--border)] transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" /> Add BIN
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {bins.length === 0 ? (
              <p className="text-xs text-[var(--fg-muted)] italic">No BINs configured.</p>
            ) : (
              bins.map((bin, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Prefix (e.g. 4)"
                    value={bin.prefix}
                    onChange={(e) => updateBin(i, "prefix", e.target.value)}
                    className="w-1/3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Brand (e.g. Visa)"
                    value={bin.brand}
                    onChange={(e) => updateBin(i, "brand", e.target.value)}
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => removeBin(i)}
                    className="p-2 text-[var(--fg-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fallback Brands */}
        <div className="pt-8 mt-8 border-t border-[var(--border)] space-y-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[var(--fg)]">Fallback Brands</h3>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              Random brand names that will be assigned when a card number doesn't match any BIN and is marked as "Other".
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="e.g. NOPE"
              value={newEgg}
              onChange={(e) => setNewEgg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEasterEgg();
                }
              }}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={addEasterEgg}
              className="shrink-0 flex items-center justify-center rounded-md bg-[var(--bg)] border border-[var(--border)] px-4 py-2 text-xs font-medium hover:bg-[var(--border)] transition-colors"
            >
              Add Phrase
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {easterEggs.length === 0 ? (
              <p className="text-xs text-[var(--fg-muted)] italic">No Easter eggs configured.</p>
            ) : (
              easterEggs.map((egg) => (
                <div key={egg} className="flex items-center gap-1.5 bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-full text-xs font-medium">
                  {egg}
                  <button
                    type="button"
                    onClick={() => removeEasterEgg(egg)}
                    className="text-[var(--fg-muted)] hover:text-[var(--danger)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center rounded-md bg-neutral-100 text-neutral-900 px-6 py-2.5 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
               <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
            ) : (
               <Save className="mr-2 h-4 w-4" />
            )}{" "}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
