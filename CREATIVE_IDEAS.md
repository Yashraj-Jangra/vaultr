# 🎨 _vaultr — Creative Vision & Easter Egg Bible
> *A living document of ideas that make this app feel alive, weird, and worth loving.*

---

## 🃏 ALREADY SHIPPED: The Living Credit Card
The card preview morphs in real time — digit masking, BIN auto-detection, network logos, and when you enter an unknown number it pulls a random phrase from the easter egg pool:
`FAKECARD` · `VOID` · `BRUH` · `ANXIETY EXPRESS` · `ALIEN EXPRESS` · and more.

---

## 🔐 AUTH PAGE — *The Gate*

### The Breathing Lock
The padlock SVG on the login screen **inhales and exhales** — a subtle 3s loop scale animation. When you start typing the master password, the breathing **speeds up** (like anxiety). When you submit, the shackle **snaps open** with a tiny spring physics bounce. If the password is wrong, the lock **shakes its head** side-to-side (waggle animation) and goes red for a moment.

### Password Orbs
As you type each character of the master password, instead of plain `●` dots, each character spawns a **tiny floating orb** that rises and fades — like magic particles. Different character types (uppercase, symbol, digit) get different orb colors. Delete a character? An orb **pops** with a micro-burst.

### The Vault Door Entrance
On successful login, instead of a plain fade-in, the entire screen does a **vault door spin-open** — a heavy circular door rotates out of frame (CSS 3D rotate + perspective) revealing the vault behind it.

### Clock-Punching Session Timer
A subtle **wax-seal style timer** in the corner — when your session is about to expire, the wax seal starts "melting" (SVG path morph). You can click it to extend the session. If it fully melts = lockout.

---

## 🗃️ VAULT — *The Sanctum*

### Entry Cards: Breathing Depth
Vault entry cards have a **layered parallax depth effect** on hover — the card background subtly shifts one direction, the icon another, the title a third. Makes them feel physically 3D. Works especially well on cards with favicon or illustration.

### Per-Template Living Illustrations
Every entry type gets a hand-crafted micro-illustration that **reacts to content**:

#### 🔑 Login Entries
- Default: A skeleton key in a lock illustration
- Hover: The key inserts and turns, lock clicks open
- Has TOTP enabled: A tiny clock spins above the lock
- **Breached**: The key is **broken in half**, crack animation on mount, glows red

#### 📝 Secure Notes
- A moleskin notebook with a ribbon bookmark
- Hover: The pages **ruffle** like wind is blowing them
- Long notes: The notebook gets **thicker** (more pages visible on the spine)

#### 🏠 Address Entries
- A tiny isometric house illustration
- **Time-aware**: At night (local time) the house has a lit warm window. During day it's bright. During golden hour the sun is at the horizon.
- Hover: Smoke curls out of the chimney

#### 👤 Profile Entries
- A stylized avatar silhouette with a subtle gradient
- If `fullName` is filled: The silhouette gets a **nameplate** below it
- Has ID number filled: A tiny ID card appears in the avatar's "hand"

#### 💳 Card Entries (in the vault list, not the dialog)
- A tiny angled card preview (not full-size) that shows:
  - Brand logo detected from stored `cardBrand`
  - Last 4 digits (if saved)
  - Cardholder name snippet
- Hover: The mini card **tilts** toward you on the Z axis

#### 🔢 TOTP Codes
- An animated **clock with a sweeping hand** in the icon position
- Hover reveals the live code inline with a countdown arc

---

## 🧮 TOTP — *The Ticking Bomb*

### Countdown Split-Flap Display
When viewing a TOTP code, the digits are rendered as **split-flap display characters** (like an airport arrivals board). As the 30s window resets, each digit **flips** with that satisfying mechanical clack feel, staggered left-to-right.

### Countdown Ring
A **circular progress arc** wraps the TOTP widget. As the 30s window depletes:
- 30–15s: Calm **blue/teal** arc
- 15–7s: Arc turns **amber**, starts pulsing gently
- 7–0s: Arc turns **red**, pulses fast — "hurry!" energy
- On reset: Brief flash of white, then back to blue

### Code Burn
If the TOTP code expires while you're looking at it, it **burns away** — a fire-lick SVG animation consumes each digit before the new code flips in.

---

## 🔍 SEARCH — *The Oracle*

### `Cmd+K` Spotlight
A full-screen, darkened overlay appears with a floating glass search panel (like macOS Spotlight or Linear's search). As you type:
- Results appear in **real-time** grouped by template type (Login, Card, Note…)
- Right panel shows a **live preview** of the hovered result (blurred sensitive fields)
- `↑↓` to navigate, `Enter` to open, `Esc` to close
- Has its own **search history** (last 5 queries, locally stored)

### Empty State Character
When search returns no results, a **tiny detective character** in SVG shrugs with a magnifying glass. The magnifying glass has a small reflection animation. The placeholder text cycles between:
- *"Even the NSA couldn't find that."*
- *"Your secrets are safe from your own search."*
- *"Nothing. Zero. The void is vast."*
- *"404: Password not found in the simulation."*

### Fuzzy Match Highlight
Matched characters in search results are highlighted with a **golden underline glow** — not just background highlight. Each letter lights up individually.

---

## 🛡️ SECURITY / BREACH CHECK — *The Watchtower*

### Breach Pulse
On vault items that have a **detected breach** (HaveIBeenPwned), the card doesn't just turn red — it has a **sonar ripple animation** emanating from a red dot in the corner. Like a warning signal pinging outward in rings. Hypnotic but alarming.

### Shield Health Orb
On the dashboard, a large **orbiting shield** graphic shows overall vault health. Three orbital rings rotate at different speeds:
- Inner ring = password strength distribution
- Middle ring = age of passwords (older = slower, dimmer)
- Outer ring = breach status (any breach = ring glows red and breaks apart)

### Password Age "Decay" Indicator
Passwords older than 90 days start to show a subtle **frost/corrosion overlay** on their card — like old metal rusting. At 180 days the rust is significant. At 1 year the card looks practically archaeological. Click to refresh.

---

## 💪 PASSWORD GENERATOR — *The Forge*

### Entropy Terrain
Below the generated password, a **real-time waveform** (SVG path) represents entropy. Each character added makes the waveform more jagged and tall — like an EKG getting more intense. Weak password = flat line (ominous flatline sound easter egg if you click it). Strong = mountain range. Max entropy = the graph goes **off the chart**.

### The Forge Animation
When you click "Regenerate", a brief **forge/anvil animation** plays — sparks fly, the password briefly becomes `██████ FORGING ██████` then resolves into the new one, characters appearing like they're being cast from metal.

### Character Type Color Coding
Inside the password input/preview, each character type is subtly **color-coded** in a monospace display:
- Lowercase: neutral/white
- Uppercase: blue
- Numbers: green
- Symbols: amber/gold
- Making it beautiful and scannable at once

---

## 🎒 FOLDERS — *The Cabinet*

### 3D File Cabinet
On mobile or a dedicated "folders view", folders are displayed as **3D isometric file drawers** — pulled out slightly on hover, with a sticky label showing the folder name and item count. Click = drawer opens with an animation revealing entries.

### Folder Color Tinting
Users can assign **accent colors** to folders. The entire folder UI (card, sidebar icon, entry cards within it) subtly tints to that color — like color-coded filing tabs. Options: frost, ember, jade, violet, gold, storm.

### Nesting Depth Rings
Folders with sub-folders show **concentric arc rings** inside their icon — one ring per nesting level. Makes depth immediately visually scannable.

---

## 🌙 SETTINGS — *The Control Room*

### Live Theme Puppet
When changing theme settings, a **tiny replica of the vault UI** (miniature, non-interactive) is shown as a "puppet" — it instantly re-renders in the chosen theme so you're previewing it before committing. Like a phone mockup that updates live.

### Pixel Noise Background
The settings page background has an extremely subtle **grain/noise texture** that slowly scrolls — gives it a tactile, printed-paper feel. Very premium.

### Sidebar Hover Trails
On desktop, moving your mouse along the sidebar quickly leaves a **subtle light trail** that fades in 200ms — like the cursor is leaving a bioluminescent wake through the dark sidebar.

---

## 🥚 EASTER EGGS — *The Secret Menu*

### 🃏 The Fake Card Pool (ALREADY LIVE)
When a card number can't be identified → random phrase in Visa-style italic:
`FAKECARD` · `BRUH` · `VOID` · `ANXIETY EXPRESS` · `ALIEN EXPRESS` · `NOPE` · `UH-OH` · `WHATEVERCARD` · `GUESSWORK` · `MYSTERYCARD` · `LMAO` · `OOPS`

---

### 🔑 The Konami Code
`↑ ↑ ↓ ↓ ← → ← → B A` anywhere in the app → the entire UI briefly goes **Matrix green rain** (a canvas overlay with falling katakana/binary for 5 seconds), then snaps back to normal. A small toast says *"You found it. Nice."*

---

### 🦆 The Rubber Duck
Somewhere in the app (changes monthly — hardcoded rotation) there's an **imperceptibly small rubber duck** hidden in a corner. Clicking it plays a `quack.mp3` and increments a hidden "ducks found" counter stored in localStorage. At 5 ducks found, a toast appears: *"You have a problem. A good problem."*

---

### 💣 The "Delete All" Button Hesitation
On the account settings page, if there's a nuclear "Delete All Data" button, hovering it causes it to **slowly back away from the cursor** (moves left, then down, then right) — you have to chase it. After 3 chases it gives up and stays still, but now it's sweating (a little `😅` appears).

---

### 🔢 The Pi Vault
If you name a vault entry exactly `"3.14159"`, when you open it the note field shows:
> *"π goes on forever. So does your paranoia about passwords. You're in good company."*
...and the background briefly shows expanding concentric circles.

---

### 🎰 The Lucky Number
If the first 6 digits of a card entry spell out `420420` or `696969`, the card preview winks — a brief 👀 emoji flashes in the corner of the card for exactly 0.4 seconds, then disappears. Nothing else. No confirmation. Just the wink.

---

### 🌑 The Dark Mode Deepening
If you're in dark mode between 11pm–4am local time, the UI subtly shifts 5% **darker and bluer** — like late-night mode within dark mode. A tiny crescent moon icon appears in the corner. Hovering it shows: *"You shouldn't be doing this at this hour."*

---

### 🕵️ The "Password: password" Detector
If you save a Login entry with the password literally being `password`, `123456`, `qwerty`, or `letmein`, the entry card shows a tiny **spy emoji (🕵️)** as the icon instead of the normal one, with the tooltip: *"Bold strategy. Let's see if it pays off."*

---

### 📱 The Shake to Scramble
On mobile, if you physically shake the device while viewing a TOTP code, the code **scrambles** (random digits flash) for 0.5 seconds before resolving back to the real code. Totally useless, completely delightful.

---

### 🧠 The Forgotten Konami Sibling
`F` `U` `N` typed anywhere (just those 3 letters consecutively, not in an input field) triggers the entire sidebar to briefly **do the worm** — a CSS wave animation bounces each sidebar item up and down in sequence like a wave. Lasts 1.2 seconds. Then stops like nothing happened.

---

### 🎂 Birthday Mode
If today's date matches the user's profile `dob` field (if stored as a Profile entry), the entire app gets a subtle **confetti burst** on login — tiny SVG confetti pieces fall from the top of the screen for 3 seconds. A small toast: *"Happy Birthday! Your passwords are your gift to yourself."*

---

### 👻 The Ghost Cursor
On the completely empty vault state (zero entries ever created), a **ghost cursor** slowly wanders around the screen on its own — like a ghost haunting the empty vault. It moves randomly, pauses, clicks on nothing. Hovering it makes it freeze and stare at you. Clicking it disappears with a `wooo` and a message: *"The vault is haunted by the passwords you haven't added yet."*

---

### 🪞 The Mirror Password
If you create a Login entry and the username and password are identical (e.g., admin/admin), the entry border gets a subtle **mirror/reflection effect** — the card reflects itself. Tooltip: *"Username = Password? Bold. Tragic. Bold."*

---

### 🔇 The Morse Code Favicon
The browser favicon subtly cycles through a **Morse code pattern** for "SAFE" (· · · — — · — ·) using favicon swaps between black and white versions of the lock icon. Completely imperceptible unless you're staring at the tab. Insane for anyone who notices.

---

### 🧩 The Credential Jigsaw
If you delete more than 10 entries in one session, a toast appears: *"Minimalism? Or chaos? Unclear."* with a tiny shredder emoji and confetti.

---

### 🏆 Secret Achievements (localStorage based)
A hidden `/achievements` page (linked from nowhere — you have to know the URL) tracks silent achievements:
- 🔑 **First Lock** — Created your first entry
- 🕵️ **Bad Actor** — Saved a password weaker than "qwerty123"
- 🌑 **Night Owl** — Used the app after 2am
- 🃏 **Card Shark** — Triggered 3 different easter egg card names
- 🦆 **Duck Hunter** — Found all hidden rubber ducks
- 💀 **The Void** — Deleted everything in the vault
- 🧠 **Nerd Alert** — Typed `FUN` in the app
- 🎰 **Nice.** — Triggered the lucky number easter egg
- 👻 **Ghost Whisperer** — Clicked the haunted empty state ghost

Achievement unlocks show a brief **retro achievement toast** (16-bit style badge pop-up) in the corner.

---

## 📐 MICRO-INTERACTION DETAILS

### Staggered List Mounts
When the vault loads entries, they don't all appear at once — they **cascade in** with a 30ms stagger per item, sliding up from 8px below with a fade. Feels like cards being dealt.

### Folder Accordion Spring
Opening a folder uses **spring physics** (not linear easing) — the content overshoots slightly and springs back into position.

### Copy Flash
When you copy any field (password, card number, etc.), the **entire field briefly inverts** (dark becomes light, light becomes dark) for 80ms — then normalizes. Like a camera flash. Crisp, satisfying.

### Toast Stack Choreography
If multiple toasts appear quickly, they **stack and push each other** upward with spring physics — older ones get smaller and more transparent as they push to the back of the stack (like notification stacking on iOS).

### Scroll Momentum Glow
When you scroll the vault list and reach the very bottom, a soft **blue glow bloom** appears at the bottom edge for a moment — signaling the end. Top = same thing. Subtle physical metaphor.

---

## 🎵 OPTIONAL SOUND DESIGN (Mutable)

Off by default, toggleable in settings:

| Action | Sound |
|--------|--------|
| Entry saved | Soft vault-lock `chunk` |
| Entry deleted | Paper `shred` |
| Copy to clipboard | Camera shutter `click` |
| Password breach detected | Low-frequency `ping` |
| Master password correct | Satisfying tumbler `click` |
| Master password wrong | Dull `thud` |
| TOTP refresh | Mechanical `flip` |
| Konami code | 8-bit fanfare |
| Rubber duck | `quack.mp3` |
| Ghost cursor clicked | Faint `wooooo` |

---

*Last updated: June 2026 · This doc is a creative backlog, not a sprint. Build the ones that spark joy.*
