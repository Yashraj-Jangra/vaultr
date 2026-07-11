import React, { useMemo } from "react";
import { Lock, Globe, User } from "lucide-react";

// ── Credit Card Visual (Untouched & Preserved, with subtle watermark) ──────────
export function DetailedCardVisual({ cardNumber, cardName, expiry, cardBrand, fallbackBrand }: { cardNumber: string; cardName: string; expiry: string; cardBrand?: string; fallbackBrand?: string }) {
  const isVisa = cardBrand?.toLowerCase() === "visa";
  const isMC = cardBrand?.toLowerCase() === "mastercard";
  const isAmex = cardBrand?.toLowerCase() === "amex";
  const isDiscover = cardBrand?.toLowerCase() === "discover";
  const isRuPay = cardBrand?.toLowerCase() === "rupay";
  const isOther = cardBrand?.toLowerCase() === "other";
  
  const num = cardNumber.replace(/\D/g, "");

  let bgClass = "from-[#22252c] to-[#0f1013]";
  let graphics = null;
  let bankLogo = null;
  let logoImg = null;
  
  if (isVisa) {
    bgClass = "from-[#0A0D1A] via-[#151233] to-[#2B1B54]";
    logoImg = <img src="/logos/Visa.svg" className="h-[7cqw] w-auto object-contain" alt="Visa" />;
    graphics = (
      <svg className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" viewBox="0 0 320 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="visaWave" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8E2DE2" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4A00E0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M-20,100 C80,40 180,160 340,80 L340,200 L-20,200 Z" fill="url(#visaWave)" />
        <path d="M-20,130 C120,70 160,180 340,110 L340,200 L-20,200 Z" fill="url(#visaWave)" opacity="0.6" />
        <circle cx="280" cy="40" r="80" fill="#4A00E0" opacity="0.15" filter="blur(20px)" />
      </svg>
    );
  } else if (isMC) {
    bgClass = "from-[#1a1a1c] via-[#141415] to-[#0a0a0b]";
    logoImg = <img src="/logos/Mastercard.svg" className="h-[11cqw] w-auto object-contain" alt="Mastercard" />;
    graphics = (
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
        <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-red-500/20 blur-xl" />
        <div className="absolute -right-20 -top-5 w-32 h-32 rounded-full bg-amber-500/20 blur-xl" />
      </div>
    );
  } else if (isAmex) {
    bgClass = "from-[#141414] via-[#090909] to-[#000000]";
    logoImg = <img src="/logos/AMEX.svg" className="h-[12cqw] w-auto object-contain" alt="Amex" />;
    graphics = (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-[3.5cqw] border border-amber-500/20 rounded-[3cqw]" />
        <div className="absolute inset-[4cqw] border border-amber-500/10 rounded-[2.5cqw]" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent" />
      </div>
    );
  } else if (isDiscover) {
    bgClass = "from-[#1F0F07] via-[#0C0603] to-[#020101]";
    logoImg = <img src="/logos/Discover.svg" className="h-[5.5cqw] w-auto object-contain" alt="Discover" />;
    graphics = (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute right-[-15cqw] top-[-10cqw] w-[60cqw] h-[60cqw] rounded-full border-[1.5px] border-orange-500/15" />
        <div className="absolute right-[-10cqw] top-[25cqw] w-[50cqw] h-[50cqw] rounded-full border border-orange-500/10" />
        <div className="absolute right-[-5cqw] top-[0cqw] w-[40cqw] h-[40cqw] rounded-full border border-orange-500/5" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-orange-500/[0.03] rounded-full blur-2xl" />
      </div>
    );
  } else if (isRuPay) {
    bgClass = "from-[#05111A] via-[#02080D] to-[#000000]";
    logoImg = <img src="/logos/Rupay.svg" className="h-[6.5cqw] w-auto object-contain" alt="RuPay" />;
    graphics = (
      <svg className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" viewBox="0 0 320 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rupayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#004e92" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000428" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,40 L320,40 M0,80 L320,80 M0,120 L320,120 M0,160 L320,160" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <path d="M60,0 L60,200 M120,0 L120,200 M180,0 L180,200 M240,0 L240,200" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <path d="M0,100 L120,100 L140,120 L320,120" fill="none" stroke="url(#rupayGrad)" strokeWidth="2" opacity="0.5" />
      </svg>
    );
  } else if (isOther) {
    bgClass = "from-[#0f1d1a] via-[#08100e] to-[#030605]";
  } else if (cardBrand) {
    bgClass = "from-[#1f1a30] via-[#100d1a] to-[#05040d]";
  }

  const isLight = false;
  const textColor = isLight ? "text-neutral-800" : "text-white";
  const mutedColor = isLight ? "text-neutral-500" : "text-white/70";

  // Animated digits rendering
  let groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4];
  if (!isAmex && num.length > 16) {
    groups = [];
    let rem = num.length;
    while (rem > 0) {
      groups.push(Math.min(4, rem));
      rem -= 4;
    }
  }
  
  const digitGroups = [];
  let charIndex = 0;
  for (let g = 0; g < groups.length; g++) {
    let groupSpan = [];
    for (let i = 0; i < groups[g]; i++) {
      const idx = charIndex++;
      const isEntered = idx < num.length;
      const isVisibleBlock = g === groups.length - 1; 
      
      let char = "-";
      let op = isLight ? "opacity-20" : "opacity-30";
      let scale = "scale-90";
      
      if (isEntered) {
        char = isVisibleBlock ? num[idx] : "•";
        op = "opacity-100";
        scale = "scale-100";
      }
      
      groupSpan.push(
        <span key={idx} className={`inline-block transition-all duration-300 transform ${op} ${scale} ${char === '•' ? 'translate-y-[-2px] text-[1.2em]' : ''} w-[4cqw] text-center`}>
          {char}
        </span>
      );
    }
    digitGroups.push(<div key={g} className="flex gap-[0.2cqw]">{groupSpan}</div>);
  }

  return (
    <div className="@container relative w-full max-w-[440px] mx-auto aspect-[1.586/1] select-none">
      <div className={`absolute inset-0 rounded-[5cqw] overflow-hidden bg-gradient-to-br ${bgClass} shadow-xl flex flex-col justify-between ${textColor} p-[6cqw] transition-colors duration-500`}>
        {graphics}
        
        {/* Subtle security watermark illustration inside card */}
        <img src="/illustrations/fingerprint_kdwq.svg" className="absolute right-4 bottom-4 w-28 h-28 opacity-10 pointer-events-none select-none mix-blend-overlay" alt="" />

        {/* Top Row: Bank Logo left, Network right */}
        <div className="relative z-10 flex justify-between items-start h-[8cqw]">
          <div className="flex items-center h-full">
            {bankLogo || <div className="w-[10cqw] h-[7cqw] rounded-[1cqw] bg-[#F5D77D] opacity-90 flex flex-col justify-evenly px-[1.5cqw] py-[1cqw]"><div className="w-full h-[0.5cqw] bg-black/10 rounded-full" /><div className="w-full h-[0.5cqw] bg-black/10 rounded-full" /><div className="w-full h-[0.5cqw] bg-black/10 rounded-full" /></div>}
          </div>
          
          <div className="flex items-center justify-end max-w-[50%]">
             {logoImg || (
               <>
                 {isVisa && <span className={`text-[7cqw] font-bold italic tracking-tighter ${textColor}`}>VISA</span>}
                 {isMC && <div className="flex relative items-center"><div className={`w-[6cqw] h-[6cqw] rounded-full ${isLight ? 'bg-black/80' : 'bg-white'} opacity-90`} /><div className={`w-[6cqw] h-[6cqw] rounded-full ${isLight ? 'bg-black' : 'bg-white'} opacity-50 absolute right-[3.5cqw]`} /></div>}
                 {isAmex && <span className={`text-[4cqw] font-bold uppercase tracking-widest ${textColor}`}>AMEX</span>}
                 {isDiscover && <span className={`text-[4cqw] font-bold tracking-wider ${textColor}`}>DISCOVER</span>}
                 {isRuPay && <span className={`text-[4cqw] font-bold tracking-wider ${textColor}`}>RuPay</span>}
                 {isOther && fallbackBrand && <span className={`text-[4cqw] font-bold tracking-wide truncate ${textColor}`}>{fallbackBrand}</span>}
                 {(!isVisa && !isMC && !isAmex && !isDiscover && !isRuPay && !isOther && cardBrand) && <span className={`text-[4cqw] font-bold tracking-wide truncate ${textColor}`}>{cardBrand}</span>}
               </>
             )}
          </div>
        </div>

        {/* Middle: Card Number Animated */}
        <div className="relative z-10 w-full mt-auto mb-[5cqw] flex justify-center gap-[2.5cqw] text-[5.5cqw] font-mono font-medium leading-none whitespace-nowrap">
          {digitGroups}
        </div>

        {/* Bottom Row */}
        <div className="relative z-10 flex justify-between items-end">
          <div className="flex flex-col min-w-0 pr-[4cqw]">
            <span className={`text-[2.5cqw] uppercase tracking-wider ${mutedColor} mb-[0.5cqw]`}>Cardholder Name</span>
            <span className="text-[4cqw] font-semibold tracking-wide uppercase truncate">
              {cardName || "Name"}
            </span>
          </div>
          
          <div className="flex flex-col shrink-0 text-right">
            <span className={`text-[2.5cqw] uppercase tracking-wider ${mutedColor} mb-[0.5cqw]`}>Expiry Date</span>
            <span className="text-[4cqw] font-medium font-mono">
              {expiry || "00/00"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Previews ──────────────────────────────────────────────────────────────────

function LoginKeycardPreview({ name, username, url }: { name: string; username: string; url: string }) {
  const domain = useMemo(() => {
    try {
      if (!url) return "";
      const parsed = url.startsWith("http") ? new URL(url) : new URL("https://" + url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }, [url]);

  return (
    <div className="w-full max-w-[440px] mx-auto aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-[var(--surface-hover)] to-[var(--surface)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden select-none">
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-[var(--accent)]/5 blur-2xl pointer-events-none" />
      
      {/* Decorative Illustration */}
      <img src="/illustrations/authentication_1evl.svg" className="absolute right-4 bottom-10 w-36 h-36 opacity-20 pointer-events-none select-none" alt="" />

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-[var(--fg-muted)] tracking-wider">Access Keycard</div>
          <div className="text-sm font-semibold text-[var(--fg)] truncate max-w-[200px]">{name || "Untitled Login"}</div>
        </div>
      </div>
      
      <div className="space-y-3 relative z-10 mt-auto">
        <div className="font-mono text-xs text-[var(--fg-muted)] space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-[var(--fg-muted)]/50">Identity</div>
          <div className="truncate max-w-[220px] text-[var(--fg)]">{username || "username@email.com"}</div>
        </div>
        <div className="flex items-center justify-between text-[10px] border-t border-[var(--border)] pt-2.5">
          <span className="text-[var(--fg-muted)]/60 font-mono">ENCRYPTED KEY</span>
          <span className="text-[var(--accent)] font-semibold truncate max-w-[140px]">{domain || "vaultr.auth"}</span>
        </div>
      </div>
    </div>
  );
}

function AddressLabelPreview({ name, line1, line2, city, state, zip, country }: { name: string; line1: string; line2: string; city: string; state: string; zip: string; country: string }) {
  return (
    <div className="w-full max-w-[440px] mx-auto aspect-[1.586/1] rounded-2xl bg-[var(--surface)] border-2 border-dashed border-[var(--border)] p-6 flex flex-col justify-between shadow-lg font-mono relative overflow-hidden select-none">
      
      {/* Decorative Illustration */}
      <img src="/illustrations/connected-world_anke.svg" className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none select-none" alt="" />

      <div className="absolute right-4 top-4 w-10 h-12 border border-[var(--border)] rounded bg-[var(--bg)] flex flex-col items-center justify-center text-[8px] text-[var(--fg-muted)] font-sans">
        <Globe className="w-4 h-4 mb-0.5 text-[var(--fg-muted)]/40" />
        POSTAGE
      </div>
      
      <div className="flex-1 flex flex-col justify-center space-y-1 text-xs text-[var(--fg)] relative z-10">
        <div className="font-sans font-bold text-sm tracking-tight text-[var(--accent)] mb-1 truncate max-w-[200px]">{name || "Shipping Address"}</div>
        <div className="truncate max-w-[220px]">{line1 || "123 Main Street"}</div>
        {line2 && <div className="truncate max-w-[220px]">{line2}</div>}
        <div className="truncate max-w-[220px]">{`${city || "City"}${state ? ", " + state : ""} ${zip || "ZIP"}`}</div>
        <div className="text-[10px] uppercase text-[var(--fg-muted)] mt-1 truncate max-w-[220px]">{country || "United States"}</div>
      </div>
    </div>
  );
}

function ProfileBadgePreview({ name, fullName, email, phone }: { name: string; fullName: string; email: string; phone: string }) {
  return (
    <div className="w-full max-w-[440px] mx-auto aspect-[1.586/1] rounded-2xl bg-gradient-to-b from-[var(--surface)] to-[var(--bg)] border border-[var(--border)] p-6 flex items-center gap-4 shadow-lg relative overflow-hidden select-none">


      <div className="w-16 h-16 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center shrink-0 shadow-inner relative z-10">
        <User className="w-8 h-8 text-[var(--fg-muted)]" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 relative z-10">
        <div className="text-[8px] uppercase font-bold text-[var(--accent)] tracking-widest">Verification Profile</div>
        <div className="text-sm font-bold text-[var(--fg)] truncate max-w-[180px]">{fullName || name || "Identity Profile"}</div>
        <div className="space-y-0.5 text-[10px] text-[var(--fg-muted)] font-mono">
          <div className="truncate max-w-[180px]">{email || "email@domain.com"}</div>
          <div className="truncate max-w-[180px]">{phone || "Phone Number"}</div>
        </div>
      </div>
    </div>
  );
}

function NotePaperPreview({ name, note }: { name: string; note: string }) {
  return (
    <div className="w-full max-w-[440px] mx-auto aspect-[1.586/1] rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden font-mono text-[11px] leading-relaxed text-[var(--fg-muted)] select-none">
      <div className="absolute left-0 top-0 right-0 h-1.5 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600" />
      
      {/* Decorative Illustration */}
      <img src="/illustrations/confidential-letter_k1ni.svg" className="absolute right-4 bottom-10 w-36 h-36 opacity-25 pointer-events-none select-none" alt="" />

      <div className="flex-1 overflow-hidden mt-1.5 relative z-10">
        <div className="font-sans font-bold text-xs text-[var(--fg)] border-b border-[var(--border)] pb-1 mb-2 flex justify-between items-center">
          <span className="truncate max-w-[200px]">{name || "Secure Note"}</span>
          <span className="text-[9px] text-[var(--fg-muted)] uppercase tracking-wider">CONFIDENTIAL</span>
        </div>
        <div className="whitespace-pre-wrap line-clamp-4 leading-normal break-all max-w-[240px]">
          {note || "Type secure note contents on the right..."}
        </div>
      </div>
      <div className="text-[8px] text-[var(--fg-muted)]/40 text-right mt-2 font-sans relative z-10">
        AES-256 ENCRYPTED BUFFER
      </div>
    </div>
  );
}

export function DynamicPreviewCanvas({ template, name, username, url, line1, line2, city, state, zip, country, fullName, email, phone, note, cardName, cardNumber, expiry, cardBrand, fallbackBrand }: any) {
  if (template === "login") {
    return <LoginKeycardPreview name={name} username={username} url={url} />;
  }
  if (template === "card") {
    return <DetailedCardVisual cardName={cardName} cardNumber={cardNumber} expiry={expiry} cardBrand={cardBrand} fallbackBrand={fallbackBrand} />;
  }
  if (template === "address") {
    return <AddressLabelPreview name={name} line1={line1} line2={line2} city={city} state={state} zip={zip} country={country} />;
  }
  if (template === "profile") {
    return <ProfileBadgePreview name={name} fullName={fullName} email={email} phone={phone} />;
  }
  if (template === "note") {
    return <NotePaperPreview name={name} note={note} />;
  }
  return null;
}
