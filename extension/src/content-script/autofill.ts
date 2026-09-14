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
  totp?: string;
  hasTotp?: boolean;
}

let activeDropdown: HTMLElement | null = null;
let activeInput: HTMLInputElement | null = null;
let lastFocusedField: HTMLInputElement | null = null;
let activeToastTimeout: any = null;

// ─── Toast UI (Shadow DOM Isolated) ──────────────────────────────────────────

function showInPageToast(messageHtml: string, durationMs = 3500) {
  const existing = document.getElementById("vaultr-toast-host");
  if (existing) existing.remove();
  if (activeToastTimeout) clearTimeout(activeToastTimeout);

  const host = document.createElement("div");
  host.id = "vaultr-toast-host";
  host.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    left: 50% !important;
    transform: translateX(-50%) translateY(16px) !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  `;

  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 18px;
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 9999px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
    }
    .badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 50%;
      color: #10b981;
      font-size: 11px;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      color: #38bdf8;
      letter-spacing: 1px;
    }
  `;
  shadow.appendChild(styleEl);

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <div class="badge">✓</div>
    <span>${messageHtml}</span>
  `;
  shadow.appendChild(toast);

  document.body.appendChild(host);

  requestAnimationFrame(() => {
    host.style.opacity = "1";
    host.style.transform = "translateX(-50%) translateY(0)";
  });

  activeToastTimeout = setTimeout(() => {
    host.style.opacity = "0";
    host.style.transform = "translateX(-50%) translateY(16px)";
    setTimeout(() => host.remove(), 250);
  }, durationMs);
}

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

  // Auto-copy 2FA code to clipboard
  if (cred.totp) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get("vaultr_autocopy_2fa", (res) => {
        if (res?.vaultr_autocopy_2fa !== false && cred.totp) {
          try {
            navigator.clipboard.writeText(cred.totp).then(() => {
              showInPageToast(`2FA code copied: <span class="code">${cred.totp}</span>`);
            }).catch(() => {
              showInPageToast(`2FA code: <span class="code">${cred.totp}</span>`);
            });
          } catch {
            showInPageToast(`2FA code: <span class="code">${cred.totp}</span>`);
          }
        }
      });
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

function isOtpField(input: HTMLInputElement): boolean {
  if (input.type === "password" || input.type === "hidden" || input.type === "checkbox") return false;
  const ac = (input.autocomplete || "").toLowerCase();
  if (ac === "one-time-code") return true;

  const id = (input.id || "").toLowerCase();
  const name = (input.name || "").toLowerCase();
  const placeholder = (input.placeholder || "").toLowerCase();
  const aria = (input.getAttribute("aria-label") || "").toLowerCase();
  const combined = `${id} ${name} ${placeholder} ${aria}`;

  if (/otp|totp|2fa|mfa|verification.*code|two.*factor|security.*code|auth.*code/.test(combined)) {
    return true;
  }

  // Split-cell inputs (e.g. 6 boxes of maxlength=1)
  if (input.maxLength === 1) {
    const parent = input.parentElement;
    if (parent) {
      const siblingInputs = parent.querySelectorAll<HTMLInputElement>('input[maxlength="1"]');
      if (siblingInputs.length >= 4 && siblingInputs.length <= 8) {
        return true;
      }
    }
  }

  return false;
}

function fillTotpCode(target: HTMLInputElement, code: string) {
  // Check if it is a split cell input (e.g. 6 boxes)
  if (target.maxLength === 1) {
    const parent = target.closest("form") || target.parentElement;
    if (parent) {
      const splitInputs = Array.from(parent.querySelectorAll<HTMLInputElement>('input[maxlength="1"]'))
        .filter((el) => el.offsetParent !== null);
      if (splitInputs.length >= code.length) {
        for (let i = 0; i < code.length; i++) {
          nativeInputValueSetter(splitInputs[i], code[i]);
        }
        splitInputs[Math.min(code.length - 1, splitInputs.length - 1)].focus();
        showInPageToast(`2FA code filled: <span class="code">${code}</span>`);
        navigator.clipboard?.writeText(code).catch(() => {});
        return;
      }
    }
  }

  // Otherwise single input field
  nativeInputValueSetter(target, code);
  navigator.clipboard?.writeText(code).catch(() => {});
  showInPageToast(`2FA code filled: <span class="code">${code}</span>`);
}

function showOtpDropdown(inputEl: HTMLInputElement, credentials: AutofillCredential[]) {
  if (activeInput === inputEl && activeDropdown) return;
  removeDropdown();
  const withTotp = credentials.filter((c) => c.totp);
  if (withTotp.length === 0) return;

  activeInput = inputEl;
  const rect = inputEl.getBoundingClientRect();

  const host = document.createElement("div");
  host.id = "vaultr-autofill-host";
  host.style.cssText = `
    position: fixed !important;
    top: ${rect.bottom + 6}px !important;
    left: ${rect.left}px !important;
    width: ${Math.max(rect.width, 280)}px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    * { box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
    .dropdown {
      background: #09090b !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      border-radius: 12px !important;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
      overflow: hidden !important;
      padding: 6px !important;
      backdrop-filter: blur(16px) !important;
    }
    .item {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 8px 10px !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      transition: background 0.15s ease !important;
    }
    .item:hover { background: #18181b !important; }
    .badge {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 26px !important;
      height: 26px !important;
      border-radius: 6px !important;
      background: rgba(56, 189, 248, 0.15) !important;
      color: #38bdf8 !important;
      font-size: 13px !important;
      font-weight: 700 !important;
    }
    .meta { min-width: 0 !important; flex: 1 !important; }
    .title { font-size: 12.5px !important; font-weight: 600 !important; color: #ffffff !important; display: flex !important; align-items: center !important; gap: 6px !important; }
    .code-pill { font-family: ui-monospace, monospace !important; font-size: 12px !important; font-weight: 700 !important; color: #38bdf8 !important; letter-spacing: 0.5px !important; }
    .sub { font-size: 11px !important; color: #a1a1aa !important; margin-top: 2px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
  `;
  shadow.appendChild(styleEl);

  const container = document.createElement("div");
  container.className = "dropdown";

  withTotp.forEach((cred) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="badge">🔑</div>
      <div class="meta">
        <div class="title">
          <span>Fill 2FA</span>
          <span class="code-pill">${cred.totp}</span>
        </div>
        <div class="sub">${cred.name}${cred.username ? ` · ${cred.username}` : ""}</div>
      </div>
    `;

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (cred.totp) {
        fillTotpCode(inputEl, cred.totp);
      }
      removeDropdown();
    });

    container.appendChild(item);
  });

  shadow.appendChild(container);
  document.body.appendChild(host);
  activeDropdown = host;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (activeDropdown) {
        activeDropdown.style.opacity = "1";
        activeDropdown.style.transform = "translateY(0)";
      }
    });
  });
}

document.addEventListener("focusin", (e) => {
  const target = e.target as HTMLInputElement;
  if (!target || target.tagName !== "INPUT") return;
  if (target.closest("#vaultr-autofill-host")) return;
  if (!isWebPageUrl(window.location.href)) return;

  const isLogin = isLoginField(target);
  const isOtp = isOtpField(target);
  if (!isLogin && !isOtp) return;

  lastFocusedField = target;

  const domain = getDomain();
  if (!domain) return;

  chrome.runtime.sendMessage({ type: "GET_LOGINS_FOR_DOMAIN", domain }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.logins?.length > 0) {
      if (document.activeElement === target) {
        if (isOtp) {
          showOtpDropdown(target, response.logins);
        } else {
          showDropdown(target, response.logins);
        }
      }
    }
  });
}, true);

// Handle autofill, copy TOTP, and password fill messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUTOFILL_CREDENTIAL" && message.credential) {
    const cred: AutofillCredential = {
      id: "popup",
      name: "Vaultr",
      ...message.credential,
    };
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
  } else if (message.type === "TRIGGER_AUTOFILL" && message.credential) {
    const cred: AutofillCredential = message.credential;
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
  } else if (message.type === "COPY_TOTP_CLIPBOARD" && message.totp) {
    try {
      navigator.clipboard.writeText(message.totp).then(() => {
        showInPageToast(`2FA code copied: <span class="code">${message.totp}</span>`);
      }).catch(() => {
        showInPageToast(`2FA code: <span class="code">${message.totp}</span>`);
      });
    } catch {
      showInPageToast(`2FA code: <span class="code">${message.totp}</span>`);
    }
  } else if (message.type === "FILL_GENERATED_PASSWORD" && message.password) {
    const activeEl = document.activeElement as HTMLInputElement | null;
    const target =
      (activeEl && activeEl.tagName === "INPUT" ? activeEl : null) ||
      lastFocusedField ||
      document.querySelector<HTMLInputElement>('input[type="password"]');
    if (target) {
      nativeInputValueSetter(target, message.password);
      navigator.clipboard?.writeText(message.password).catch(() => {});
      showInPageToast("Generated password filled & copied");
    }
  }
});

// ─── Save / Update Password Prompt on Form Submission ────────────────────────

let activeSavePrompt: HTMLElement | null = null;
let lastSubmittedUsername = "";
let lastSubmittedPassword = "";
let lastSubmittedDomain = "";

function removeSavePrompt() {
  if (activeSavePrompt) {
    const el = activeSavePrompt;
    activeSavePrompt = null;
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    setTimeout(() => el.remove(), 200);
  }
}

function showSaveOrUpdatePrompt(opts: {
  mode: "save" | "update";
  domain: string;
  username: string;
  password: string;
  itemId?: string;
  itemName?: string;
}) {
  removeSavePrompt();
  lastSubmittedUsername = opts.username;
  lastSubmittedPassword = opts.password;
  lastSubmittedDomain = opts.domain;

  const host = document.createElement("div");
  host.id = "vaultr-save-prompt-host";
  host.style.cssText = `
    position: fixed !important;
    top: 16px !important;
    right: 16px !important;
    width: 320px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .card {
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05);
      padding: 14px 16px;
      color: #f4f4f5;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .close-btn {
      background: none;
      border: none;
      color: #71717a;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 2px;
    }
    .close-btn:hover { color: #f4f4f5; }
    .title {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .sub {
      font-size: 12px;
      color: #a1a1aa;
      margin-bottom: 14px;
      line-height: 1.4;
      word-break: break-word;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .btn-primary {
      flex: 1;
      height: 34px;
      background: #f4f4f5;
      color: #09090b;
      border: none;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #ffffff; }
    .btn-ghost {
      height: 34px;
      padding: 0 12px;
      background: #18181b;
      color: #a1a1aa;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 9px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-ghost:hover { color: #f4f4f5; border-color: rgba(255,255,255,0.2); }
  `;
  shadow.appendChild(styleEl);

  const card = document.createElement("div");
  card.className = "card";

  const isSave = opts.mode === "save";
  card.innerHTML = `
    <div class="header">
      <div class="badge">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>VaultR Password Manager</span>
      </div>
      <button class="close-btn" title="Dismiss">✕</button>
    </div>
    <div class="title">${isSave ? "Save password to VaultR?" : "Update password in VaultR?"}</div>
    <div class="sub">
      ${
        isSave
          ? `Save login for <strong>${opts.domain}</strong>${opts.username ? ` (${opts.username})` : ""}?`
          : `Update saved password for <strong>${opts.username || opts.itemName || opts.domain}</strong>?`
      }
    </div>
    <div class="actions">
      <button class="btn-primary">${isSave ? "Save Password" : "Update Password"}</button>
      <button class="btn-ghost">Not now</button>
    </div>
  `;

  card.querySelector(".btn-primary")?.addEventListener("click", () => {
    removeSavePrompt();
    if (isSave) {
      chrome.runtime.sendMessage(
        {
          type: "SAVE_NEW_LOGIN",
          domain: opts.domain,
          username: opts.username,
          password: opts.password,
        },
        (res) => {
          if (res?.success) {
            showInPageToast(`Password saved to VaultR for <strong>${opts.domain}</strong>`);
          }
        }
      );
    } else if (opts.itemId) {
      chrome.runtime.sendMessage(
        {
          type: "UPDATE_LOGIN_PASSWORD",
          itemId: opts.itemId,
          password: opts.password,
        },
        (res) => {
          if (res?.success) {
            showInPageToast(`Password updated in VaultR for <strong>${opts.username || opts.domain}</strong>`);
          }
        }
      );
    }
  });

  const handleDismiss = () => removeSavePrompt();
  card.querySelector(".btn-ghost")?.addEventListener("click", handleDismiss);
  card.querySelector(".close-btn")?.addEventListener("click", handleDismiss);

  shadow.appendChild(card);
  document.body.appendChild(host);
  activeSavePrompt = host;

  requestAnimationFrame(() => {
    host.style.opacity = "1";
    host.style.transform = "translateY(0)";
  });

  // Auto-dismiss after 20 seconds
  setTimeout(() => {
    if (activeSavePrompt === host) removeSavePrompt();
  }, 20000);
}

function checkAndShowSavePrompt(username: string, password: string, domain: string) {
  if (!password || !domain) return;
  if (lastSubmittedUsername === username && lastSubmittedPassword === password && lastSubmittedDomain === domain) {
    return;
  }

  chrome.runtime.sendMessage({ type: "GET_LOGINS_FOR_DOMAIN", domain }, (res) => {
    if (chrome.runtime.lastError) return;
    const logins: AutofillCredential[] = res?.logins || [];

    const matchingUser = logins.find(
      (l) => l.username && username && l.username.toLowerCase() === username.toLowerCase()
    );

    if (matchingUser) {
      if (matchingUser.password && matchingUser.password === password) {
        return;
      }
      showSaveOrUpdatePrompt({
        mode: "update",
        domain,
        username: matchingUser.username || username,
        password,
        itemId: matchingUser.id,
        itemName: matchingUser.name,
      });
    } else {
      showSaveOrUpdatePrompt({
        mode: "save",
        domain,
        username,
        password,
      });
    }
  });
}

function setupFormSubmitInterceptor() {
  document.addEventListener("submit", (e) => {
    const form = e.target as HTMLFormElement;
    if (!form || form.tagName !== "FORM") return;
    const pwdInput = form.querySelector<HTMLInputElement>('input[type="password"]');
    if (!pwdInput || !pwdInput.value || pwdInput.value.length < 4) return;
    const userInput = findUsernameField(pwdInput);
    const username = userInput?.value || "";
    const password = pwdInput.value;
    const domain = getDomain();
    if (!domain) return;
    checkAndShowSavePrompt(username, password, domain);
  }, true);

  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement)?.closest('button[type="submit"], input[type="submit"], button:not([type])');
    if (!btn) return;
    const form = btn.closest("form");
    if (form) {
      const pwdInput = form.querySelector<HTMLInputElement>('input[type="password"]');
      if (!pwdInput || !pwdInput.value || pwdInput.value.length < 4) return;
      const userInput = findUsernameField(pwdInput);
      const username = userInput?.value || "";
      const password = pwdInput.value;
      const domain = getDomain();
      if (!domain) return;
      checkAndShowSavePrompt(username, password, domain);
    } else {
      const pwd = document.querySelector<HTMLInputElement>('input[type="password"]');
      if (pwd && pwd.value.trim().length >= 4) {
        const usr = findUsernameField(pwd);
        checkAndShowSavePrompt(usr?.value || "", pwd.value, getDomain());
      }
    }
  }, true);
}

setupFormSubmitInterceptor();


// ─── WebAuthn Passkey Interceptor Bridge ───────────────────────────────────────

let activePasskeyPrompt: HTMLElement | null = null;

function removePasskeyPrompt() {
  if (activePasskeyPrompt) {
    const el = activePasskeyPrompt;
    activePasskeyPrompt = null;
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    setTimeout(() => el.remove(), 200);
  }
}

function showPasskeyPrompt(opts: {
  mode: "create" | "get";
  rpId: string;
  username?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  removePasskeyPrompt();

  const host = document.createElement("div");
  host.id = "vaultr-passkey-prompt-host";
  host.style.cssText = `
    position: fixed !important;
    top: 16px !important;
    right: 16px !important;
    width: 320px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .card {
      background: #09090b;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      padding: 14px 16px;
      color: #f4f4f5;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .close-btn {
      background: none;
      border: none;
      color: #71717a;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 2px;
    }
    .close-btn:hover { color: #f4f4f5; }
    .title {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .sub {
      font-size: 12px;
      color: #a1a1aa;
      margin-bottom: 14px;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .btn-primary {
      flex: 1;
      height: 34px;
      background: #f4f4f5;
      color: #09090b;
      border: none;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #ffffff; }
    .btn-ghost {
      height: 34px;
      padding: 0 10px;
      background: #18181b;
      color: #a1a1aa;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 9px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-ghost:hover { color: #f4f4f5; border-color: rgba(255,255,255,0.2); }
  `;

  shadow.appendChild(styleEl);

  const card = document.createElement("div");
  card.className = "card";

  const isCreate = opts.mode === "create";
  card.innerHTML = `
    <div class="header">
      <div class="badge">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="m21 2-2 2m-1.5 1.5L10 13a5 5 0 1 0 4 4l7.5-7.5M15.5 7.5l3 3"/></svg>
        <span>VaultR Passkey</span>
      </div>
      <button class="close-btn" title="Dismiss">✕</button>
    </div>
    <div class="title">${isCreate ? "Save Passkey to VaultR" : "Sign In with Passkey"}</div>
    <div class="sub">
      ${
        isCreate
          ? `Save passkey for <strong>${opts.rpId}</strong>${opts.username ? ` (${opts.username})` : ""}`
          : `Use passkey stored in VaultR for <strong>${opts.rpId}</strong>${opts.username ? ` (${opts.username})` : ""}`
      }
    </div>
    <div class="actions">
      <button class="btn-primary">${isCreate ? "Save Passkey" : "Sign In"}</button>
      <button class="btn-ghost">Use Browser</button>
    </div>
  `;

  card.querySelector(".btn-primary")?.addEventListener("click", () => {
    removePasskeyPrompt();
    opts.onConfirm();
  });

  const handleDismiss = () => {
    removePasskeyPrompt();
    opts.onCancel();
  };

  card.querySelector(".btn-ghost")?.addEventListener("click", handleDismiss);
  card.querySelector(".close-btn")?.addEventListener("click", handleDismiss);

  shadow.appendChild(card);
  const targetParent = document.body || document.documentElement;
  if (targetParent) {
    targetParent.appendChild(host);
  }
  activePasskeyPrompt = host;

  requestAnimationFrame(() => {
    host.style.opacity = "1";
    host.style.transform = "translateY(0)";
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== "VAULTR_WEBAUTHN_PAGE") {
    return;
  }

  const { action, reqId, payload } = event.data;

  chrome.runtime.sendMessage({ type: "CHECK_PASSKEY_AVAILABLE" }, (status) => {
    if (chrome.runtime.lastError || !status?.enabled) {
      window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false }, "*");
      return;
    }

    if (!status.isUnlocked) {
      // Vault is locked; delegate to browser native
      window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false, error: "locked" }, "*");
      return;
    }

    if (action === "CREATE") {
      const rpId = payload.rp?.id || window.location.hostname;
      const username = payload.user?.name || payload.user?.displayName;

      showPasskeyPrompt({
        mode: "create",
        rpId,
        username,
        onConfirm: () => {
          chrome.runtime.sendMessage({ type: "WEBAUTHN_CREATE", payload }, (res) => {
            if (chrome.runtime.lastError || !res) {
              window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false }, "*");
              return;
            }
            window.postMessage(
              {
                source: "VAULTR_WEBAUTHN_CONTENT",
                reqId,
                handled: res?.handled ?? true,
                credential: res?.credential,
                error: res?.error,
              },
              "*"
            );
          });
        },
        onCancel: () => {
          window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false }, "*");
        },
      });
    } else if (action === "GET") {
      const rpId = payload.rpId || window.location.hostname;

      chrome.runtime.sendMessage({ type: "GET_PASSKEYS_FOR_RP", rpId }, (res) => {
        if (chrome.runtime.lastError || !res?.passkeys || res.passkeys.length === 0) {
          // No passkeys in vault for this RP; let browser handle natively
          window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false }, "*");
          return;
        }

        const passkey = res.passkeys[0];
        showPasskeyPrompt({
          mode: "get",
          rpId,
          username: passkey.username,
          onConfirm: () => {
            chrome.runtime.sendMessage({ type: "WEBAUTHN_GET", payload }, (getRes) => {
              if (chrome.runtime.lastError || !getRes) {
                window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false }, "*");
                return;
              }
              window.postMessage(
                {
                  source: "VAULTR_WEBAUTHN_CONTENT",
                  reqId,
                  handled: getRes?.handled ?? true,
                  credential: getRes?.credential,
                  error: getRes?.error,
                },
                "*"
              );
            });
          },
          onCancel: () => {
            window.postMessage({ source: "VAULTR_WEBAUTHN_CONTENT", reqId, handled: false }, "*");
          },
        });
      });
    }
  });
});
