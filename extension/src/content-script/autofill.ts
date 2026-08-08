/**
 * Vaultr Content Script — Native In-Page Form Detection & Autofill
 *
 * Strategy:
 *  - Detect login forms by scanning for password fields + sibling username/email fields
 *  - Show a floating Vaultr dropdown anchored to the focused field
 *  - On selection, fill BOTH username and password fields and dispatch React-compatible events
 *  - Listen for AUTOFILL_CREDENTIAL messages sent directly from the popup
 */

interface AutofillCredential {
  id: string;
  name: string;
  username?: string;
  password?: string;
}

let activeDropdown: HTMLElement | null = null;
let activeInput: HTMLInputElement | null = null;
let lastFocusedField: HTMLInputElement | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDomain(): string {
  try { return window.location.hostname; } catch { return ""; }
}

/** Dispatch React-compatible input events so frameworks (React/Vue/Angular) pick up changes */
function nativeInputValueSetter(input: HTMLInputElement, value: string) {
  try {
    // React 16+ uses a native input setter
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
  } catch {
    input.value = value;
  }
  // Dispatch both input and change to satisfy all frameworks
  input.dispatchEvent(new Event("input",  { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true }));
}

/** Find username/email field — search the form first, then the closest ancestor */
function findUsernameField(anchor: HTMLInputElement): HTMLInputElement | null {
  const form = anchor.closest("form") || document.body;
  const selectors = [
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="email"]',
    'input[name*="user" i]',
    'input[name*="email" i]',
    'input[name*="login" i]',
    'input[id*="user" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="username" i]',
    'input[type="text"]',
  ];
  for (const sel of selectors) {
    const el = form.querySelector<HTMLInputElement>(sel);
    if (el && el !== anchor && el.offsetParent !== null) return el;
  }
  return null;
}

/** Find password field relative to an anchor element */
function findPasswordField(anchor: HTMLInputElement): HTMLInputElement | null {
  const form = anchor.closest("form") || document.body;
  const selectors = [
    'input[autocomplete="current-password"]',
    'input[type="password"]',
  ];
  for (const sel of selectors) {
    const el = form.querySelector<HTMLInputElement>(sel);
    if (el && el !== anchor && el.offsetParent !== null) return el;
  }
  return null;
}

function fillCredential(focusedField: HTMLInputElement, cred: AutofillCredential) {
  const type = focusedField.type.toLowerCase();

  if (type === "password") {
    // Focused on password field: fill password here, find and fill username sibling
    if (cred.password) nativeInputValueSetter(focusedField, cred.password);
    if (cred.username) {
      const usernameEl = findUsernameField(focusedField);
      if (usernameEl) nativeInputValueSetter(usernameEl, cred.username);
    }
  } else {
    // Focused on username/email field: fill here, find and fill password sibling
    if (cred.username) nativeInputValueSetter(focusedField, cred.username);
    if (cred.password) {
      const passwordEl = findPasswordField(focusedField);
      if (passwordEl) nativeInputValueSetter(passwordEl, cred.password);
    }
  }
}

// ─── Dropdown UI ─────────────────────────────────────────────────────────────

function removeDropdown() {
  if (activeDropdown) {
    const el = activeDropdown;
    activeDropdown = null;
    activeInput = null;
    el.style.opacity = "0";
    el.style.transform = "translateY(-4px)";
    setTimeout(() => { el.remove(); }, 180);
  }
}

function repositionDropdown() {
  if (!activeDropdown || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    removeDropdown();
    return;
  }
  activeDropdown.style.top = `${rect.bottom + 6}px`;
  activeDropdown.style.left = `${rect.left}px`;
  activeDropdown.style.width = `${Math.max(rect.width, 256)}px`;
}

function showDropdown(inputEl: HTMLInputElement, credentials: AutofillCredential[]) {
  if (activeInput === inputEl && activeDropdown) return;
  removeDropdown();
  if (credentials.length === 0) return;

  activeInput = inputEl;
  const rect = inputEl.getBoundingClientRect();

  const dropdown = document.createElement("div");
  dropdown.id = "vaultr-autofill-dropdown";
  dropdown.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 6}px;
    left: ${rect.left}px;
    width: ${Math.max(rect.width, 256)}px;
    background: #0d0e14;
    border: 1px solid #22263a;
    border-radius: 12px;
    box-shadow: 0 16px 48px -8px rgba(0,0,0,0.85), 0 0 0 1px rgba(124,106,250,0.08);
    z-index: 2147483647;
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    color: #f0f0f5;
    padding: 6px;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16,1,0.3,1);
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 8px;
    font-size: 10px;
    font-weight: 700;
    color: #7c6afa;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    border-bottom: 1px solid #181a24;
    margin-bottom: 4px;
  `;

  // Vaultr shield icon (SVG inline)
  header.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c6afa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span>Vaultr</span>
    <span style="margin-left:auto; font-weight:500; color:#52536a;">${credentials.length} saved</span>
  `;
  dropdown.appendChild(header);

  // Credential items
  credentials.forEach((cred) => {
    const item = document.createElement("div");
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.12s ease;
    `;

    const initials = cred.name.slice(0, 2).toUpperCase();
    item.innerHTML = `
      <div style="
        width:30px; height:30px; border-radius:9px;
        background:#1c1e28; border:1px solid #22263a;
        display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:700; color:#8a8ab0;
        flex-shrink:0; letter-spacing:-0.5px;
      ">${initials}</div>
      <div style="min-width:0; flex:1;">
        <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cred.name}</div>
        <div style="font-size:11px; color:#8a8ab0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cred.username || "No username"}</div>
      </div>
      <div style="
        font-size:10px; font-weight:600; color:#7c6afa;
        background:rgba(124,106,250,0.12); border:1px solid rgba(124,106,250,0.2);
        padding:3px 7px; border-radius:5px; flex-shrink:0;
      ">Fill</div>
    `;

    item.addEventListener("mouseenter", () => { item.style.background = "#161820"; });
    item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fillCredential(inputEl, cred);
      removeDropdown();
    });

    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
  activeDropdown = dropdown;

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (activeDropdown) {
        activeDropdown.style.opacity = "1";
        activeDropdown.style.transform = "translateY(0)";
      }
    });
  });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

// Reposition dropdown on scroll/resize
window.addEventListener("scroll", repositionDropdown, { capture: true, passive: true });
window.addEventListener("resize", repositionDropdown, { passive: true });

// Dismiss when clicking outside BOTH active dropdown and active input
document.addEventListener("click", (e) => {
  const target = e.target as Node | null;
  if (!activeDropdown) return;

  const isInsideDropdown = activeDropdown.contains(target);
  const isInsideInput = activeInput && (activeInput === target || activeInput.contains(target));

  if (!isInsideDropdown && !isInsideInput) {
    removeDropdown();
  }
}, true);

// Dismiss on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeDropdown) removeDropdown();
}, true);

// Show dropdown on focus for any login-related field
function isLoginField(input: HTMLInputElement): boolean {
  if (input.type === "password") return true;
  if (input.type === "email") return true;
  if (input.type === "text" || !input.type) {
    const attrs = [input.name, input.id, input.placeholder, input.autocomplete].join(" ").toLowerCase();
    return /user|email|login|account|identifier/.test(attrs);
  }
  return false;
}

document.addEventListener("focusin", (e) => {
  const target = e.target as HTMLInputElement;
  if (!target || target.tagName !== "INPUT") return;
  if (!isLoginField(target)) return;
  if (target.closest("#vaultr-autofill-dropdown")) return;

  lastFocusedField = target;

  const domain = getDomain();
  chrome.runtime.sendMessage({ type: "GET_LOGINS_FOR_DOMAIN", domain }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.logins?.length > 0) {
      if (document.activeElement === target) {
        showDropdown(target, response.logins);
      }
    }
  });
}, true);

// Handle autofill from popup (AUTOFILL_CREDENTIAL message)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUTOFILL_CREDENTIAL" && message.credential) {
    const cred: AutofillCredential = {
      id: "popup",
      name: "Vaultr",
      ...message.credential,
    };

    // Try to find the best field to anchor to
    const activeEl = document.activeElement as HTMLInputElement | null;
    const anchor =
      (activeEl && activeEl.tagName === "INPUT" ? activeEl : null) ||
      lastFocusedField ||
      document.querySelector<HTMLInputElement>('input[type="password"]') ||
      document.querySelector<HTMLInputElement>('input[type="email"]') ||
      document.querySelector<HTMLInputElement>('input[type="text"]');

    if (anchor) {
      fillCredential(anchor, cred);
    }
  }
});

console.log("[Vaultr] Autofill content script loaded for:", getDomain());
