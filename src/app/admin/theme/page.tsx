"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { ThemeConfig, FONT_OPTIONS, ThemeColors } from "@/lib/themes";
import { Plus, Trash2, Edit2, Eye, EyeOff, Save, X } from "lucide-react";

const randomId = () => Math.random().toString(36).slice(2, 11);

export default function ThemeBuilderPage() {
  const { allThemes, saveTheme, deleteTheme, togglePublished } = useTheme();
  
  const [editingTheme, setEditingTheme] = useState<ThemeConfig | null>(null);
  const [formData, setFormData] = useState<Partial<ThemeConfig>>({});

  const handleCreate = () => {
    setEditingTheme(null);
    setFormData({
      id: "theme_" + randomId(),
      name: "New Theme",
      mode: "dark",
      radius: 6,
      font: "Inter",
      builtIn: false,
      published: false,
      colors: {
        bg: "#0a0a0a",
        fg: "#ededed",
        fgMuted: "#888888",
        surface: "#111111",
        border: "#1a1a1a",
        borderHover: "#333333",
        accent: "#ffffff",
        danger: "#ef4444",
      }
    });
  };

  const handleEdit = (theme: ThemeConfig) => {
    setEditingTheme(theme);
    setFormData(JSON.parse(JSON.stringify(theme))); // Deep copy
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.colors) return;
    try {
      await saveTheme(formData as ThemeConfig);
      setFormData({});
      setEditingTheme(null);
    } catch (error) {
      console.error("Failed to save theme:", error);
      alert("Failed to save theme. Check console for details.");
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setFormData((prev) => ({
      ...prev,
      colors: { ...prev.colors!, [key]: value },
    }));
  };

  if (Object.keys(formData).length > 0) {
    return (
      <div className="p-8 pb-20 max-w-4xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">
            {editingTheme ? "Edit Theme" : "Create New Theme"}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setFormData({})}
              className="flex items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--border)] transition-colors"
            >
              <X className="mr-2 h-4 w-4" /> Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center rounded-md bg-[var(--accent)] text-[var(--bg)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Save className="mr-2 h-4 w-4" /> Save Theme
            </button>
          </div>
        </div>

        <div className="gap-8 grid grid-cols-1 md:grid-cols-2">
          {/* Settings Form */}
          <div className="space-y-6">
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h3 className="font-semibold border-b border-[var(--border)] pb-2">General</h3>
              <div>
                <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Theme Name</label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                  disabled={formData.builtIn}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Mode</label>
                  <select
                    value={formData.mode || "dark"}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value as "dark" | "light" })}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                    disabled={formData.builtIn}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Border Radius</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={formData.radius || 0}
                    onChange={(e) => setFormData({ ...formData, radius: Number(e.target.value) })}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--fg-muted)] block mb-1">Typography (Font)</label>
                <select
                  value={formData.font || "Inter"}
                  onChange={(e) => setFormData({ ...formData, font: e.target.value })}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h3 className="font-semibold border-b border-[var(--border)] pb-2">Colors</h3>
              <p className="text-xs text-[var(--fg-muted)] mb-2">Use HEX codes (e.g. #0a0a0a)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {Object.entries(formData.colors || {}).map(([key, val]) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-[var(--fg-muted)] block mb-1">{key}</label>
                    <div className="flex bg-[var(--bg)] border border-[var(--border)] rounded-md overflow-hidden">
                      <input
                         type="color"
                         value={val}
                         onChange={(e) => handleColorChange(key as keyof ThemeColors, e.target.value)}
                         className="w-8 h-8 cursor-pointer border-0 p-0"
                      />
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleColorChange(key as keyof ThemeColors, e.target.value)}
                        className="w-full bg-transparent px-2 text-xs focus:outline-none uppercase"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview (Simulated by inline style injection) */}
          <div className="sticky top-8 space-y-6">
            <h3 className="font-semibold mb-2">Live Preview</h3>
            <div 
              className="rounded-xl border border-2 overflow-hidden shadow-2xl transition-all"
              style={{
                borderColor: formData.colors?.border,
                backgroundColor: formData.colors?.bg,
                color: formData.colors?.fg,
                fontFamily: `"${formData.font}", sans-serif`,
                colorScheme: formData.mode,
              } as React.CSSProperties}
            >
              <div 
                className="p-6 border-b"
                style={{ borderColor: formData.colors?.border, backgroundColor: formData.colors?.surface }}
              >
                <div className="flex gap-4 items-center">
                  <div 
                    className="w-10 h-10 flex items-center justify-center font-bold"
                    style={{ 
                      backgroundColor: formData.colors?.accent, 
                      color: formData.colors?.bg,
                      borderRadius: `${formData.radius}px`
                    }}
                  >
                    V
                  </div>
                  <div>
                    <h4 className="font-bold">Vault Dashboard</h4>
                    <p className="text-xs" style={{ color: formData.colors?.fgMuted }}>Welcome back to your secure vault.</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Add new item</span>
                  <button 
                    className="px-4 py-2 text-sm font-medium shadow-sm transition-opacity hover:opacity-90"
                    style={{ 
                      backgroundColor: formData.colors?.accent, 
                      color: formData.colors?.bg,
                      borderRadius: `${formData.radius}px`
                    }}
                  >
                    Create
                  </button>
                </div>
                
                <div 
                  className="p-4 border transition-colors hover:border-[var(--borderHover)]"
                  style={{ 
                    borderColor: formData.colors?.border, 
                    backgroundColor: formData.colors?.surface,
                    borderRadius: `${formData.radius}px`
                  }}
                >
                  <div className="font-medium mb-1">Netflix</div>
                  <div className="text-xs font-mono" style={{ color: formData.colors?.fgMuted }}>jane@example.com</div>
                </div>

                <div 
                  className="p-4 border transition-colors"
                  style={{ 
                    borderColor: formData.colors?.danger, 
                    backgroundColor: `${formData.colors?.danger}10`, // 10% opacity
                    borderRadius: `${formData.radius}px`
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: formData.colors?.danger }}>Danger Zone</div>
                  <button 
                    className="mt-2 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
                    style={{ 
                      backgroundColor: formData.colors?.danger, 
                      color: "#fff",
                      borderRadius: `${formData.radius}px`
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Theme Builder</h2>
        <button
          onClick={handleCreate}
          className="flex items-center rounded-md bg-[var(--accent)] text-[var(--bg)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="mr-2 h-4 w-4" /> New Theme
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {allThemes.map((theme) => (
          <div 
            key={theme.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col"
          >
            {/* Mini preview header */}
            <div 
              className="h-24 p-4 flex flex-col justify-between"
              style={{ 
                backgroundColor: theme.colors.bg, 
                color: theme.colors.fg,
                fontFamily: `"${theme.font}", sans-serif`
              }}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-sm tracking-tight">{theme.name}</span>
                <span 
                  className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold"
                  style={{ backgroundColor: theme.colors.accent, color: theme.colors.bg, borderRadius: '4px' }}
                >
                  {theme.mode}
                </span>
              </div>
              <div className="flex space-x-1">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}` }} />
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.colors.danger }} />
              </div>
            </div>
            
            <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface)] text-[var(--fg)]">
              <div className="flex items-center space-x-2">
                {theme.builtIn ? (
                   <span className="text-xs font-medium text-[var(--fg-muted)] px-2 py-1 rounded bg-[var(--border)]">Built-in</span>
                ) : (
                   <button
                     onClick={() => togglePublished(theme.id, !theme.published)}
                     className={`flex items-center text-xs font-medium px-2 py-1 rounded transition-colors ${
                       theme.published 
                         ? "bg-[#34d399]/10 text-[#34d399] hover:bg-[#34d399]/20" 
                         : "bg-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                     }`}
                   >
                     {theme.published ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                     {theme.published ? "Published" : "Draft"}
                   </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(theme)}
                  className="p-2 rounded text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--border)] transition-colors"
                  title="Edit theme"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!theme.builtIn && (
                  <button
                    onClick={async () => {
                      if (confirm(`Delete theme "${theme.name}"? This cannot be undone.`)) {
                        await deleteTheme(theme.id);
                      }
                    }}
                    className="p-2 rounded text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
                    title="Delete theme"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
