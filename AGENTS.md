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

---

# Git Workflow & Commit Rules

1. **Commit Message Format**:
   - Every commit message must start with the most accurate, contextual emoji representing the change type, followed by a single space, and a concise, lowercase, direct description.
   - No robotic AI phrasing (avoid *"Refactored codebase to optimize performance metrics"*).
   - No sprint, ticket, or milestone tags in commit messages (keep purely technical).

### Curated Commit Emoji Guide

| Emoji | Category | Use When | Example |
| :--- | :--- | :--- | :--- |
| ✨ | **Feature** | Adding new features or user capabilities | `✨ add folder collapse toggle to sidebar` |
| 🚀 | **Milestone / Launch** | Major release, new page, or architecture upgrade | `🚀 launch vaultr 2026 information hub` |
| 🐛 | **Bug Fix** | Fixing bugs, crashes, or broken behavior | `🐛 fix crash when opening empty files` |
| 🩹 | **Hotfix** | Quick, minor patch or edge-case handling | `🩹 patch null check on avatar uri` |
| 🛡️ | **Security** | Security hardening, auth, vulnerability fixes | `🛡️ enforce pbkdf2 zero-knowledge key separation` |
| 🔑 | **Cryptography** | Crypto algorithms, WebCrypto, TOTP, key derivation | `🔑 add subtlecrypto aes-gcm binary encryption` |
| 📱 | **Mobile** | React Native, Expo, iOS, Android features/fixes | `📱 fix android 15 scoped storage file staging` |
| 🧩 | **Extension** | Browser extension, popup, autofill, content scripts | `🧩 add instant credential autofill on input focus` |
| 🎨 | **UI & Design** | Styling, colors, dark mode, animations, layouts | `🎨 polish dark mode contrast on settings dialog` |
| ⚡ | **Performance** | Speed improvements, caching, query optimization | `⚡ speed up client vault item decryption` |
| 🧹 | **Cleanup** | Removing dead code, unused assets, tidy up | `🧹 remove deprecated file system calls` |
| ♻️ | **Refactor** | Code restructuring without feature changes | `♻️ extract totp timer into reusable hook` |
| 🗄️ | **Database** | Drizzle ORM, PostgreSQL schema, migrations | `🗄️ add folders table with recursive parent relation` |
| 📦 | **Dependencies** | Package updates, version manifests, npm scripts | `📦 bump vaultr version to 0.2.4 across manifests` |
| 📝 | **Documentation** | Docs, guides, README, changelogs | `📝 document docker compose self-hosting guide` |
| 🔧 | **Config / Tooling** | Config files, webpack, tsconfig, env vars | `🔧 configure path alias for @vaultr/core` |
| 🧪 | **Testing** | Unit tests, mock fixtures, test suites | `🧪 add aes-gcm wire format roundtrip tests` |
| 🌐 | **Networking / API** | API routes, network resilience, endpoints | `🌐 add retry handler for token refresh` |

2. **Local Commits Only (No Auto-Sync)**:
   - Always commit locally to git on the system.
   - **NEVER run `git push` or sync to remote repositories until explicitly asked by the user.**

3. **History Cleanup & Timeline Adjustments**:
   - Whenever asked to clean the commit history:
     - Squash / merge messy or intermediate WIP commits into clean, logical, atomic commits with proper emoji prefixes.
     - Adjust author/committer dates (`GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE`) realistically across active development windows to maintain a realistic, smooth timeline if the project has not committed for several days.

4. **Versioning & Changelog Synchronization**:
   - Source of truth: `packages/core/src/version.ts` (`VAULTR_VERSION`, `VAULTR_EDITION`, `VAULTR_BUILD_NUMBER`, `VAULTR_BUILD_CHANNEL`).
   - Keep all manifests (`package.json`, `extension/manifest.json`, `extension/package.json`, `mobile/package.json`, `mobile/app.json`) in sync when bumping versions.
   - Maintain `src/app/changelog/page.tsx` with release notes and categorized tags (`✨ Feature`, `🛡️ Security`, `⚡ Performance`, `📱 Mobile`, `🧩 Extension`, `🔧 Fix`).


