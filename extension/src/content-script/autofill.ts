/**
 * Vaultr Content Script — Native In-Page Form Detection & Autofill
 *
 * Strategy:
 *  - Detect login forms by scanning for password fields + sibling username/email fields
 *  - Show a floating Vaultr dropdown anchored to the focused field
 *  - On selection, fill BOTH username and password fields and dispatch React-compatible events
 *  - Listen for AUTOFILL_CREDENTIAL messages sent directly from the popup
 */

import { resolveDomain, isWebPageUrl } from "@vaultr/core";

interface AutofillCredential {
  id: string;
  name: string;
  domain?: string;
  url?: string;
  username?: string;
  password?: string;
}

let activeDropdown: HTMLElement | null = null;
let activeInput: HTMLInputElement | null = null;
let lastFocusedField: HTMLInputElement | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDomain(): string {
  try {
    if (!isWebPageUrl(window.location.href)) return "";
    return window.location.hostname;
  } catch {
    return "";
  }
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
  activeDropdown.style.width = `${Math.max(rect.width, 320)}px`;
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
    width: ${Math.max(rect.width, 320)}px;
    background: #09090b;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.06);
    z-index: 2147483647;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    color: #f4f4f5;
    padding: 6px;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  `;

  // Branding Header at Top with official Vaultr Brand Logo
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px 9px;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.04em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 5px;
  `;

  const logoUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("brand/logo-dark.png")
    : "";

  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      ${
        logoUrl
          ? `<img src="${logoUrl}" alt="Vaultr" style="height: 18px; width: auto; max-width: 90px; object-fit: contain; display: block;" />`
          : `<span style="font-weight: 700; color: #ffffff; font-size: 12px; letter-spacing: 0.06em;">VAULTR</span>`
      }
    </div>
    <span style="margin-left:auto; font-weight:500; font-size:10px; color:#a1a1aa; background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:9999px; border:1px solid rgba(255,255,255,0.08);">
      ${credentials.length} ${credentials.length === 1 ? "match" : "matches"}
    </span>
  `;
  dropdown.appendChild(header);

  // Credential list
  credentials.forEach((cred) => {
    const item = document.createElement("div");
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 10px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      background: transparent;
    `;

    const effectiveDomain = resolveDomain(cred.domain, cred.name, cred.url);
    const globeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
    const isAndroid = effectiveDomain.startsWith("androidapp") || effectiveDomain.startsWith("android");
    const iconSrc = effectiveDomain
      ? isAndroid
        ? "https://developer.android.com/static/images/brand/android-head_flat.png"
        : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`
      : "";

    item.innerHTML = `
      <div class="vaultr-icon-box" style="
        width: 32px; height: 32px; max-width: 32px; max-height: 32px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; overflow: hidden;
      ">${
        iconSrc
          ? `<img src="${iconSrc}" alt="" style="width: 32px; height: 32px; max-width: 32px; max-height: 32px; object-fit: contain; border-radius: 8px; display: block;" onerror="this.outerHTML='${globeSvg}';" />`
          : globeSvg
      }</div>
      <div style="min-width: 0; flex: 1;">
        <div style="font-weight: 600; font-size: 13.5px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cred.name}</div>
        <div style="font-size: 11.5px; color: #94a3b8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${cred.username || "No username"}</div>
      </div>
    `;

    item.addEventListener("mouseenter", () => {
      item.style.background = "#18181b";
    });

    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
    });

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

  // Only suggest for valid websites, not internal browser pages (newtab, chrome://, etc.)
  if (!isWebPageUrl(window.location.href)) return;

  lastFocusedField = target;

  const domain = getDomain();
  if (!domain) return;

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
