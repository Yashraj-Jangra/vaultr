/**
 * Vaultr Content Script — Native In-Page Form Detection & Autofill Injection
 * Scans active page DOM for login forms and shows interactive Vaultr autofill dropdowns.
 */

interface AutofillCredential {
  id: string;
  name: string;
  username?: string;
  password?: string;
}

let activeDropdown: HTMLElement | null = null;

function getCurrentDomain(): string {
  try {
    return window.location.hostname;
  } catch {
    return "";
  }
}

function fillFormFields(usernameField: HTMLInputElement | null, passwordField: HTMLInputElement, cred: AutofillCredential) {
  if (usernameField && cred.username) {
    usernameField.value = cred.username;
    usernameField.dispatchEvent(new Event("input", { bubbles: true }));
    usernameField.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (cred.password) {
    passwordField.value = cred.password;
    passwordField.dispatchEvent(new Event("input", { bubbles: true }));
    passwordField.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function removeActiveDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
}

function showAutofillDropdown(inputEl: HTMLInputElement, credentials: AutofillCredential[]) {
  removeActiveDropdown();

  if (credentials.length === 0) return;

  const rect = inputEl.getBoundingClientRect();
  const dropdown = document.createElement("div");
  dropdown.id = "vaultr-autofill-dropdown";
  dropdown.style.cssText = `
    position: absolute;
    top: ${rect.bottom + window.scrollY + 4}px;
    left: ${rect.left + window.scrollX}px;
    width: ${Math.max(rect.width, 240)}px;
    background: #0f0f11;
    border: 1px solid #27272a;
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7);
    z-index: 2147483647;
    overflow: hidden;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #f4f4f5;
    padding: 6px;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #a1a1aa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #18181b;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  header.innerHTML = `<span>Vaultr Autofill</span><span style="font-size: 10px; color: #71717a;">${credentials.length} saved</span>`;
  dropdown.appendChild(header);

  credentials.forEach((cred) => {
    const itemEl = document.createElement("div");
    itemEl.style.cssText = `
      padding: 8px 10px;
      margin-top: 4px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background 0.15s ease;
    `;
    itemEl.innerHTML = `
      <div style="font-weight: 500; font-size: 13px; color: #f4f4f5;">${cred.name}</div>
      <div style="font-size: 11px; color: #a1a1aa;">${cred.username || "No username"}</div>
    `;

    itemEl.addEventListener("mouseenter", () => {
      itemEl.style.background = "#18181b";
    });
    itemEl.addEventListener("mouseleave", () => {
      itemEl.style.background = "transparent";
    });

    itemEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Find matching username input in same form or parent
      const form = inputEl.closest("form") || document.body;
      const usernameInput = form.querySelector<HTMLInputElement>("input[type=text], input[type=email], input[name*=user], input[name*=email]");
      
      fillFormFields(usernameInput, inputEl, cred);
      removeActiveDropdown();
    });

    dropdown.appendChild(itemEl);
  });

  document.body.appendChild(dropdown);
  activeDropdown = dropdown;
}

// Dismiss dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (activeDropdown && !activeDropdown.contains(e.target as Node)) {
    removeActiveDropdown();
  }
});

// Scan inputs on focus
document.addEventListener(
  "focusin",
  (e) => {
    const target = e.target as HTMLInputElement;
    if (target && target.tagName === "INPUT" && (target.type === "password" || target.type === "text" || target.type === "email")) {
      const domain = getCurrentDomain();
      chrome.runtime.sendMessage({ type: "GET_LOGINS_FOR_DOMAIN", domain }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.logins && response.logins.length > 0) {
          if (target.type === "password") {
            showAutofillDropdown(target, response.logins);
          }
        }
      });
    }
  },
  true
);

console.log("[Vaultr Content Script] In-page autofill initialized for:", getCurrentDomain());
