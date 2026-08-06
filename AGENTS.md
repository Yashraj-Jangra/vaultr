<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vaultr UI & Modal Design Guidelines

Follow these core UI design and theming principles across the Vaultr application:

## 1. Minimal, Card-Free Dialogs
- **No Div Clutter**: Avoid wrapping confirmation options inside nested div boxes, borders on borders, radio buttons, or multi-step option cards.
- **Direct Layout**: Keep modal dialogs minimal, centered, and visually uncluttered.

## 2. Clear Action Hierarchy
- **Primary Action**: Prominent 1-tap button (`bg-neutral-100 text-neutral-900 font-semibold hover:bg-white`) for the primary/safe workflow (e.g., *"Delete Folder (Keep Items)"*).
- **Secondary Destructive Action**: Subtle red text link or ghost action at the bottom (e.g., *"Delete folder and move X items to Trash"* with a `Trash2` icon) to keep destructive alternatives accessible without crowding the main flow.
- **Dismissal**: Top-right `X` close icon + `Esc` key listener + backdrop click.

## 3. Hero Illustrations
- Anchor modals and empty states with relevant SVG illustrations from `/public/illustrations/` (e.g., `throw-away_k2t5.svg`, `new-entries_xw4m.svg`) centered with subtle ambient glow (`bg-amber-500/5 blur-xl`) instead of generic alert box icons.

## 4. Theme & Surface System
- **Backdrop**: `bg-black/80 backdrop-blur-md`
- **Surface**: `bg-neutral-950 border border-neutral-800/80 rounded-2xl p-6 shadow-2xl`
- **Text**: `text-neutral-100` headings, `text-neutral-400` body text, `text-neutral-200 font-semibold` highlights.

