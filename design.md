# VaultR Design System & Component Guidelines

A minimal, div-less, and typography-focused design specification for the VaultR ecosystem across Extension, Web, and Mobile.

---

## 1. Core Philosophy: Div-Less & Card-Free

VaultR interfaces prioritize **content over containers**. We avoid artificial card clutter, nested borders-on-borders, and generic AI-template widgets.

### Principles:
1. **No Div Clutter**: Avoid wrapping options inside nested div boxes, cards within cards, or unnecessary container elements.
2. **Flat List Rhythm**: Use clean, flat list rows separated by subtle 1px hairlines (`borderBottom: 1px solid var(--border)`) rather than heavy isolated card boxes (`.settings-card`).
3. **Typographic Hierarchy**: Group related settings using clean, uppercase section labels with subtle letter-spacing rather than card headers with icons.
4. **Ergonomic Viewport Constraints**: On wide screens or extended popup widths (460px–620px), constrain settings and forms to a centered container (`max-width: 440px; margin: 0 auto;`) so controls do not stretch excessively.
5. **Direct & Focused Copy**: Keep labels punchy and human. Never use marketing buzzwords or AI-style filler copy.

---

## 2. Theme & Token System

VaultR supports three native themes, dynamically driven by CSS variables on `html[data-theme="..."]`:

| Token | Dark (Obsidian) | Light (Zinc Light) | Midnight (Deep Slate) | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `--bg` | `#0a0a0a` | `#fafafa` | `#070a13` | Root viewport backdrop |
| `--surface` | `#111111` | `#ffffff` | `#0c1222` | Form controls, segment bars |
| `--surface-2` | `#161618` | `#f4f4f5` | `#131c31` | Secondary backgrounds, active states |
| `--border` | `#1a1a1a` | `#e4e4e7` | `#1e293b` | 1px hairline dividers and borders |
| `--border-hover` | `#333333` | `#d4d4d8` | `#334155` | Hover states |
| `--neutral-100` | `#f5f5f5` | `#18181b` | `#f1f5f9` | Primary headings & active text |
| `--neutral-200` | `#e5e5e5` | `#27272a` | `#e2e8f0` | Body text |
| `--neutral-400` | `#a3a3a3` | `#52525b` | `#94a3b8` | Subtext & secondary labels |
| `--neutral-500` | `#737373` | `#71717a` | `#64748b` | Muted section labels & metadata |
| `--neutral-800` | `#262626` | `#e4e4e7` | `#1e293b` | Active segment fill / pill fill |
| `--danger` | `#ef4444` | `#ef4444` | `#f87171` | Destructive actions |

---

## 3. UI Component Patterns

### 3.1. Section Header (`section-label`)
A clean, small, uppercase label indicating group semantics:
```css
.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--neutral-500);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 8px;
  padding: 0 2px;
}
```

### 3.2. Segmented Control
Used for mode pickers (e.g., Theme: Dark / Light / Midnight, Window Width: 380px / 460px / 540px / 620px).
* **Container**: `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 10px`, `padding: 3px`, `gap: 3px`.
* **Button (Active)**: `background: var(--neutral-800)`, `color: var(--neutral-100)`, `font-weight: 600`, `box-shadow: 0 1px 3px rgba(0,0,0,0.2)`.
* **Button (Inactive)**: `background: transparent`, `color: var(--neutral-400)`, `font-weight: 500`.

### 3.3. Flat Setting Row (Div-Less)
Used for preference toggles and settings rows:
* **Layout**: `display: flex; align-items: center; justify-content: space-between; padding: 12px 2px;`
* **Divider**: `border-bottom: 1px solid var(--border)` on preceding rows.
* **Text Hierarchy**:
  - Title: `font-size: 13px; font-weight: 500; color: var(--neutral-100);`
  - Subtitle: `font-size: 11px; color: var(--neutral-500); margin-top: 2px; line-height: 1.4;`
* **Control**: Sleek native `<label className="toggle">` or `<select className="form-select">`.

### 3.4. Navigation Rows (Settings Folders)
For navigating between settings views:
* Direct row with clean icon tile (`30x30`, subtle accent background), title, subtext, and `ChevronRight` icon (`15px`, `var(--neutral-500)`).
* Hairline divider between rows: `height: 1px, background: var(--border)`.

### 3.5. Form Inputs
* `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 10px`, `color: var(--neutral-100)`, `font-size: 12.5px`.
* Focus: `border-color: var(--neutral-500)`.

### 3.6. Dialogs & Modals
* Minimal, centered popover.
* Max width: 280px–360px.
* Backdrop: `rgba(0, 0, 0, 0.8)` with subtle `backdrop-filter: blur(8px)`.
* Clear 1-tap primary action, subtle ghost cancel.

---

## 4. Viewport Scaling & Width Bounds

| Popup Width Preset | Dimensions | Target Layout Behavior |
| :--- | :--- | :--- |
| **Normal** | 380 × 560 px | Compact view; settings fill 100% (340px content width) |
| **Wide** | 460 × 560 px | Settings & forms constrained to `max-width: 440px; margin: 0 auto;` |
| **Wider** | 540 × 560 px | Settings & forms constrained to `max-width: 440px; margin: 0 auto;` |
| **Extended** | 620 × 600 px | Settings & forms constrained to `max-width: 440px; margin: 0 auto;` |

*Note*: The **Vault Items List**, **Entry Edit Form**, and **Active Sessions List** take advantage of fluid width (`100%`) so long URLs, usernames, notes, and session diagnostics are never truncated.
