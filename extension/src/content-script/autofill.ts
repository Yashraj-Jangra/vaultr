/**
 * Vaultr Content Script — Native In-Page Form Detection & Autofill
 *
 * Strategy:
 *  - Detect login forms by scanning for password fields + sibling username/email fields
 *  - Show a floating Vaultr dropdown anchored to the focused field (isolated via Shadow DOM)
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

function createGlobeIcon(): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "#a1a1aa");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "10");

  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20");

  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M2 12h20");

  svg.appendChild(circle);
  svg.appendChild(path1);
  svg.appendChild(path2);
  return svg;
}

// ─── Dropdown UI (Shadow DOM Isolated) ───────────────────────────────────────

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

  const host = document.createElement("div");
  host.id = "vaultr-autofill-host";
  host.style.cssText = `
    position: fixed !important;
    top: ${rect.bottom + 6}px !important;
    left: ${rect.left}px !important;
    width: ${Math.max(rect.width, 320)}px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    * {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      line-height: 1.4 !important;
      letter-spacing: normal !important;
      text-transform: none !important;
    }
    .dropdown-container {
      background: #09090b !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      border-radius: 14px !important;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
      overflow: hidden !important;
      font-size: 13px !important;
      color: #f4f4f5 !important;
      padding: 6px !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
    }
    .header {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 7px 10px 9px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      letter-spacing: 0.04em !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      margin-bottom: 5px !important;
    }
    .brand-logo {
      height: 18px !important;
      width: auto !important;
      max-width: 90px !important;
      object-fit: contain !important;
      display: block !important;
    }
    .match-badge {
      margin-left: auto !important;
      font-weight: 500 !important;
      font-size: 10px !important;
      color: #a1a1aa !important;
      background: rgba(255, 255, 255, 0.06) !important;
      padding: 2px 8px !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
    }
    .item {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 9px 10px !important;
      border-radius: 10px !important;
      cursor: pointer !important;
      transition: background 0.15s ease !important;
      background: transparent !important;
    }
    .item:hover {
      background: #18181b !important;
    }
    .icon-box {
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      min-height: 32px !important;
      max-width: 32px !important;
      max-height: 32px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
      overflow: hidden !important;
      border-radius: 8px !important;
      background: transparent !important;
      border: none !important;
    }
    .icon-img {
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      min-height: 32px !important;
      max-width: 32px !important;
      max-height: 32px !important;
      object-fit: contain !important;
      border-radius: 8px !important;
      display: block !important;
      background: transparent !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }
    .meta {
      min-width: 0 !important;
      flex: 1 !important;
    }
    .name {
      font-weight: 600 !important;
      font-size: 13.5px !important;
      color: #ffffff !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .sub {
      font-size: 11.5px !important;
      color: #94a3b8 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      margin-top: 2px !important;
    }
  `;
  shadow.appendChild(styleEl);

  const container = document.createElement("div");
  container.className = "dropdown-container";

  // Branding Header
  const header = document.createElement("div");
  header.className = "header";

  const logoUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("brand/logo-dark.png")
    : "";

  if (logoUrl) {
    const brandImg = document.createElement("img");
    brandImg.src = logoUrl;
    brandImg.alt = "Vaultr";
    brandImg.className = "brand-logo";
    header.appendChild(brandImg);
  } else {
    const title = document.createElement("span");
    title.textContent = "VAULTR";
    title.style.cssText = "font-weight: 700; color: #ffffff; font-size: 12px; letter-spacing: 0.06em;";
    header.appendChild(title);
  }

  const badge = document.createElement("span");
  badge.className = "match-badge";
  badge.textContent = `${credentials.length} ${credentials.length === 1 ? "match" : "matches"}`;
  header.appendChild(badge);

  container.appendChild(header);

  // Credential items
  credentials.forEach((cred) => {
    const item = document.createElement("div");
    item.className = "item";

    const effectiveDomain = resolveDomain(cred.domain, cred.name, cred.url);
    const isAndroid = effectiveDomain.startsWith("androidapp") || effectiveDomain.startsWith("android");
    const iconSrc = effectiveDomain
      ? isAndroid
        ? "https://developer.android.com/static/images/brand/android-head_flat.png"
        : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`
      : "";

    const iconBox = document.createElement("div");
    iconBox.className = "icon-box";

    if (iconSrc) {
      const img = document.createElement("img");
      img.src = iconSrc;
      img.alt = "";
      img.className = "icon-img";
      img.onerror = () => {
        img.replaceWith(createGlobeIcon());
      };
      iconBox.appendChild(img);
    } else {
      iconBox.appendChild(createGlobeIcon());
    }

    item.appendChild(iconBox);

    const meta = document.createElement("div");
    meta.className = "meta";

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = cred.name;

    const subEl = document.createElement("div");
    subEl.className = "sub";
    subEl.textContent = cred.username || "No username";

    meta.appendChild(nameEl);
    meta.appendChild(subEl);
    item.appendChild(meta);

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fillCredential(inputEl, cred);
      removeDropdown();
    });

    container.appendChild(item);
  });

  shadow.appendChild(container);
  document.body.appendChild(host);
  activeDropdown = host;

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

  const isInsideDropdown =
    activeDropdown === target ||
    activeDropdown.contains(target) ||
    (e.composedPath && e.composedPath().includes(activeDropdown));
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
  if (target.closest("#vaultr-autofill-host")) return;

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
