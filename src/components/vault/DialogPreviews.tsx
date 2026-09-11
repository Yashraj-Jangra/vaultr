import React, { useMemo, useState, useRef } from "react";
import { Lock, Globe, User, Shield, Sparkles, RefreshCw } from "lucide-react";
import { SiteIcon } from "@/components/vault/SiteIcon";

// ── Standard Card Network / Brand Detection ──────────────────────────────────
export function detectCardBrand(cardNumber: string, customBins?: { prefix: string; brand: string }[]): string {
  const clean = cardNumber.replace(/\D/g, "");
  if (!clean) return "";
  if (customBins && customBins.length > 0) {
    const sorted = [...customBins].sort((a, b) => b.prefix.length - a.prefix.length);
    for (const bin of sorted) {
      if (clean.startsWith(bin.prefix.trim())) {
        return bin.brand;
      }
    }
  }
  if (/^4/.test(clean)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "AMEX";
  if (/^(652[12]|508|60[6-8]|8[12])/.test(clean)) return "RuPay";
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return "Discover";
  return "";
}

// ── Credit Card Front Face ───────────────────────────────────────────────────
export function DetailedCardFrontFace({
  cardNumber,
  cardName,
  expiry,
  cardBrand,
  fallbackBrand,
  isNumberVisible
}: {
  cardNumber: string;
  cardName: string;
  expiry: string;
  cardBrand?: string;
  fallbackBrand?: string;
  isNumberVisible?: boolean;
}) {
  const resolvedBrand = useMemo(() => {
    if (cardBrand && cardBrand.toLowerCase() !== "auto-detect") return cardBrand;
    return detectCardBrand(cardNumber) || fallbackBrand || "";
  }, [cardBrand, cardNumber, fallbackBrand]);

  const isVisa = resolvedBrand.toLowerCase() === "visa";
  const isMC = resolvedBrand.toLowerCase() === "mastercard";
  const isAmex = resolvedBrand.toLowerCase() === "amex";
  const isDiscover = resolvedBrand.toLowerCase() === "discover";
  const isRuPay = resolvedBrand.toLowerCase() === "rupay";
  const isOther = resolvedBrand.toLowerCase() === "other";

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
        char = (isVisibleBlock || isNumberVisible) ? num[idx] : "•";
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
    <div className={`w-full h-full rounded-[5cqw] overflow-hidden bg-gradient-to-br ${bgClass} shadow-xl flex flex-col justify-between ${textColor} p-[6cqw] transition-colors duration-500 relative select-none`}>
      {graphics}

      {/* Subtle security watermark illustration inside card */}
      <img src="/illustrations/fingerprint_kdwq.svg" className="absolute right-4 bottom-4 w-28 h-28 opacity-10 pointer-events-none select-none mix-blend-overlay" alt="" />

      {/* Top Row: Bank Logo left, Network right */}
      <div className="relative z-10 flex justify-between items-start h-[8cqw]">
        <div className="flex items-center h-full">
          {bankLogo || (
            <div className="w-[10cqw] h-[7cqw] rounded-[1cqw] bg-[#F5D77D] opacity-90 flex flex-col justify-evenly px-[1.5cqw] py-[1cqw]">
              <div className="w-full h-[0.5cqw] bg-black/10 rounded-full" />
              <div className="w-full h-[0.5cqw] bg-black/10 rounded-full" />
              <div className="w-full h-[0.5cqw] bg-black/10 rounded-full" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end max-w-[50%]">
          {logoImg || (
            <>
              {isVisa && <span className={`text-[7cqw] font-bold italic tracking-tighter ${textColor}`}>VISA</span>}
              {isMC && (
                <div className="flex relative items-center">
                  <div className={`w-[6cqw] h-[6cqw] rounded-full ${isLight ? 'bg-black/80' : 'bg-white'} opacity-90`} />
                  <div className={`w-[6cqw] h-[6cqw] rounded-full ${isLight ? 'bg-black' : 'bg-white'} opacity-50 absolute right-[3.5cqw]`} />
                </div>
              )}
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
  );
}

// ── Credit Card Back Face ────────────────────────────────────────────────────
export function DetailedCardBackVisual({
  cardNumber,
  cardName,
  cvv,
  cardBrand,
  fallbackBrand,
  isNumberVisible
}: {
  cardNumber: string;
  cardName: string;
  cvv?: string;
  cardBrand?: string;
  fallbackBrand?: string;
  isNumberVisible?: boolean;
}) {
  const resolvedBrand = useMemo(() => {
    if (cardBrand && cardBrand.toLowerCase() !== "auto-detect") return cardBrand;
    return detectCardBrand(cardNumber) || fallbackBrand || "";
  }, [cardBrand, cardNumber, fallbackBrand]);

  const isVisa = resolvedBrand.toLowerCase() === "visa";
  const isMC = resolvedBrand.toLowerCase() === "mastercard";
  const isAmex = resolvedBrand.toLowerCase() === "amex";
  const isDiscover = resolvedBrand.toLowerCase() === "discover";
  const isRuPay = resolvedBrand.toLowerCase() === "rupay";
  const isOther = resolvedBrand.toLowerCase() === "other";

  let bgClass = "from-[#22252c] to-[#0f1013]";
  if (isVisa) {
    bgClass = "from-[#0A0D1A] via-[#151233] to-[#2B1B54]";
  } else if (isMC) {
    bgClass = "from-[#1a1a1c] via-[#141415] to-[#0a0a0b]";
  } else if (isAmex) {
    bgClass = "from-[#141414] via-[#090909] to-[#000000]";
  } else if (isDiscover) {
    bgClass = "from-[#1F0F07] via-[#0C0603] to-[#020101]";
  } else if (isRuPay) {
    bgClass = "from-[#05111A] via-[#02080D] to-[#000000]";
  } else if (isOther) {
    bgClass = "from-[#0f1d1a] via-[#08100e] to-[#030605]";
  } else if (cardBrand) {
    bgClass = "from-[#1f1a30] via-[#100d1a] to-[#05040d]";
  }

  const displayCvv = cvv ? (isNumberVisible ? cvv : "•••") : "•••";

  return (
    <div className={`w-full h-full rounded-[5cqw] overflow-hidden bg-gradient-to-br ${bgClass} shadow-xl flex flex-col justify-between text-white transition-colors duration-500 relative select-none`}>
      {/* 1. Magnetic Stripe */}
      <div className="w-full h-[15%] bg-[#08080a] border-y border-white/[0.08] relative overflow-hidden mt-[5cqw] shrink-0">
        <div className="absolute top-1 left-0 right-0 h-1 bg-white/[0.04]" />
      </div>

      {/* 2. Signature Panel & CVV Box */}
      <div className="px-[5cqw] flex items-center gap-[2cqw] mt-[2cqw]">
        {/* Signature Panel */}
        <div className="flex-1 h-[8.5cqw] bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 rounded-l-[1cqw] px-[3cqw] flex items-center justify-between border-y border-neutral-300 shadow-inner overflow-hidden">
          <span className="font-serif italic text-neutral-800 text-[3.2cqw] tracking-wider truncate select-none">
            {cardName || "Cardholder Name"}
          </span>
          <span className="text-[1.8cqw] font-mono font-bold text-neutral-400 uppercase tracking-widest shrink-0">
            Signature
          </span>
        </div>

        {/* CVV Box */}
        <div className="h-[8.5cqw] px-[3cqw] bg-white rounded-r-[1cqw] border-y border-r border-neutral-300 flex flex-col justify-center items-center shrink-0 min-w-[14cqw] shadow-sm">
          <span className="text-[1.8cqw] font-sans font-bold uppercase text-neutral-400 tracking-wider">
            CVV / CVC
          </span>
          <span className="font-mono font-bold text-neutral-900 text-[3.4cqw] tracking-widest">
            {displayCvv}
          </span>
        </div>
      </div>

      {/* 3. Security Info & 256-Bit Seal */}
      <div className="px-[5cqw] flex items-center justify-between gap-[3cqw] mt-[1.5cqw]">
        <div className="flex items-center gap-[1.2cqw] bg-emerald-500/10 border border-emerald-500/20 px-[2cqw] py-[0.8cqw] rounded-[1cqw] shrink-0">
          <Shield className="w-[3cqw] h-[3cqw] text-emerald-400" />
          <span className="text-[2cqw] font-mono font-bold text-emerald-400 tracking-wider">256-BIT AES-GCM</span>
        </div>
        <span className="text-[1.8cqw] text-white/45 leading-tight max-w-[65%] text-right font-sans">
          Protected by VaultR zero-knowledge client-side encryption. Authorized cardholder only.
        </span>
      </div>

      {/* 4. Bottom Brand & Hologram Seal */}
      <div className="px-[5cqw] pb-[5cqw] mt-auto flex items-center justify-between text-white/35">
        <span className="text-[2cqw] font-mono tracking-widest font-semibold text-white/40">
          VAULTR ZERO-KNOWLEDGE
        </span>
        <div className="flex items-center gap-[1cqw] bg-amber-500/10 border border-amber-500/20 px-[2cqw] py-[0.6cqw] rounded-[1cqw]">
          <Sparkles className="w-[2.5cqw] h-[2.5cqw] text-amber-400" />
          <span className="text-[1.8cqw] font-mono font-bold text-amber-400/90 tracking-wider">SECURITY SEAL</span>
        </div>
      </div>
    </div>
  );
}

// ── Credit Card Visual with 3D Swipe to Flip Gesture ──────────────────────────
export function DetailedCardVisual({
  cardNumber,
  cardName,
  expiry,
  cvv,
  cardBrand,
  fallbackBrand,
  isNumberVisible
}: {
  cardNumber: string;
  cardName: string;
  expiry: string;
  cvv?: string;
  cardBrand?: string;
  fallbackBrand?: string;
  isNumberVisible?: boolean;
}) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const hasMovedHorizontallyRef = useRef(false);
  const startAngleRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    startAngleRef.current = rotationAngle;
    isPointerDownRef.current = true;
    hasMovedHorizontallyRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (!hasMovedHorizontallyRef.current) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        // Vertical page scroll detected: release drag
        isPointerDownRef.current = false;
        setIsDragging(false);
        setDragDelta(0);
        return;
      }
      if (Math.abs(dx) > 6) {
        hasMovedHorizontallyRef.current = true;
        setIsDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
    }

    if (hasMovedHorizontallyRef.current) {
      setDragDelta(dx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const dx = e.clientX - startXRef.current;
    const dt = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dx / dt;

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    const norm = Math.abs(rotationAngle % 360);
    const currentlyFlipped = norm > 90 && norm < 270;

    // Tap detected -> toggle flip
    if (Math.abs(dx) < 6 && dt < 300) {
      setRotationAngle((prev) => (currentlyFlipped ? (prev > 0 ? prev - 180 : prev + 180) : prev + 180));
    } else if (Math.abs(velocity) > 0.35 || Math.abs(dx) > 40) {
      // Swiping momentum: left rotates forward (+180), right rotates backward (-180)
      if (dx < 0) {
        setRotationAngle(startAngleRef.current + 180);
      } else {
        setRotationAngle(startAngleRef.current - 180);
      }
    } else {
      // Snap back to starting angle
      setRotationAngle(startAngleRef.current);
    }

    setIsDragging(false);
    setDragDelta(0);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    setDragDelta(0);
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  const liveAngle = isDragging ? startAngleRef.current - (dragDelta / 220) * 180 : rotationAngle;
  const tiltX = isDragging ? Math.max(-8, Math.min(8, (dragDelta / 220) * 4)) : 0;
  const norm = Math.abs(rotationAngle % 360);
  const isFlipped = norm > 90 && norm < 270;

  return (
    <div className="w-full flex flex-col items-center">
      <div
        className="@container relative w-full max-w-[440px] mx-auto aspect-[1.586/1] select-none cursor-grab active:cursor-grabbing touch-pan-y"
        style={{ perspective: "1000px" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="w-full h-full relative"
          style={{
            transform: `rotateY(${liveAngle}deg) rotateX(${tiltX}deg) scale(${isDragging ? 1.02 : 1})`,
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            transition: isDragging ? "none" : "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <DetailedCardFrontFace
              cardNumber={cardNumber}
              cardName={cardName}
              expiry={expiry}
              cardBrand={cardBrand}
              fallbackBrand={fallbackBrand}
              isNumberVisible={isNumberVisible}
            />
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0"
            style={{
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <DetailedCardBackVisual
              cardNumber={cardNumber}
              cardName={cardName}
              cvv={cvv}
              cardBrand={cardBrand}
              fallbackBrand={fallbackBrand}
              isNumberVisible={isNumberVisible}
            />
          </div>
        </div>
      </div>

      {/* Accessible Flip Button Pill */}
      <div className="flex justify-center mt-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRotationAngle((prev) => {
              const n = Math.abs(prev % 360);
              const isCurrentlyFlipped = n > 90 && n < 270;
              return isCurrentlyFlipped ? (prev > 0 ? prev - 180 : prev + 180) : prev + 180;
            });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3 h-3 text-neutral-400" />
          <span>{isFlipped ? "Show Front (EMV Chip)" : "Flip Card (CVV & Magnetic Stripe)"}</span>
        </button>
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

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-[var(--fg-muted)] tracking-wider">Access Keycard</div>
          <div className="text-sm font-semibold text-[var(--fg)] truncate max-w-[200px]">{name || "Untitled Login"}</div>
        </div>
        <SiteIcon domain={domain} name={name} url={url} size={48} className="drop-shadow-md rounded-[2cqw]" />
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

function ProfileBadgePreview({ name, fullName, email, phone, dob, idNumber }: { name: string; fullName: string; email: string; phone: string; dob?: string; idNumber?: string }) {
  return (
    <div className="w-full max-w-[440px] mx-auto aspect-[1.586/1] rounded-2xl bg-gradient-to-b from-[#111115] to-[#070709] border border-neutral-800/80 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden select-none">
      {/* Accent left border glow */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[var(--accent)] to-purple-600" />

      {/* Background security emblem vector illustration */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/personal-settings_8xv3.svg" className="absolute -right-6 -bottom-6 w-36 h-36 opacity-10 pointer-events-none select-none mix-blend-overlay" alt="" />

      {/* Top row: Chip and Title */}
      <div className="flex justify-between items-start relative z-10 w-full">
        <div className="space-y-1">
          <div className="text-[9px] uppercase font-bold text-neutral-500 tracking-widest font-mono">SECURE ACCESS BADGE</div>
          <div className="text-sm font-bold text-neutral-100 truncate max-w-[220px]">{fullName || name || "Identity Profile"}</div>
        </div>

        {/* EMV Microchip graphic representation */}
        <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-600 border border-yellow-700/30 opacity-80 flex flex-col justify-between p-1 shadow-md shrink-0">
          <div className="grid grid-cols-3 gap-0.5 h-full opacity-60">
            <div className="border-r border-b border-yellow-950/40" />
            <div className="border-r border-b border-yellow-950/40" />
            <div className="border-b border-yellow-950/40" />
            <div className="border-r border-yellow-950/40" />
            <div className="border-r border-yellow-950/40" />
            <div className="border-yellow-950/40" />
          </div>
        </div>
      </div>

      {/* Middle row: Avatar/Icon and Details */}
      <div className="flex items-center gap-4 relative z-10 mt-2 mb-2">
        <div className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 shadow-inner relative">
          <User className="w-6 h-6 text-neutral-400" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-neutral-950" title="Identity Verified" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 text-[10px] text-neutral-400 font-mono">
          <div className="truncate max-w-[240px]"><span className="text-neutral-600 uppercase text-[9px] mr-1">EMAIL:</span>{email || "email@domain.com"}</div>
          <div className="truncate max-w-[240px]"><span className="text-neutral-600 uppercase text-[9px] mr-1">PHONE:</span>{phone || "Phone Number"}</div>
          {dob && <div className="truncate max-w-[240px]"><span className="text-neutral-600 uppercase text-[9px] mr-1">DOB:</span>{dob}</div>}
        </div>
      </div>

      {/* Bottom row: security metadata */}
      <div className="flex items-center justify-between text-[8px] font-mono border-t border-neutral-900 pt-2.5 relative z-10 text-neutral-600">
        <span>AES-256 ENCRYPTED IDENTITY</span>
        <span className="text-[9px] text-[var(--accent)] font-semibold uppercase tracking-wider">{idNumber ? "ID: " + idNumber : "VAULTR PASS"}</span>
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

export function DynamicPreviewCanvas({ template, name, username, url, line1, line2, city, state, zip, country, fullName, email, phone, dob, idNumber, note, cardName, cardNumber, expiry, cvv, cardBrand, fallbackBrand, isNumberVisible }: any) {
  if (template === "login") {
    return <LoginKeycardPreview name={name} username={username} url={url} />;
  }
  if (template === "card") {
    return <DetailedCardVisual cardName={cardName} cardNumber={cardNumber} expiry={expiry} cvv={cvv} cardBrand={cardBrand} fallbackBrand={fallbackBrand} isNumberVisible={isNumberVisible} />;
  }
  if (template === "address") {
    return <AddressLabelPreview name={name} line1={line1} line2={line2} city={city} state={state} zip={zip} country={country} />;
  }
  if (template === "profile") {
    return <ProfileBadgePreview name={name} fullName={fullName} email={email} phone={phone} dob={dob} idNumber={idNumber} />;
  }
  if (template === "note") {
    return <NotePaperPreview name={name} note={note} />;
  }
  return null;
}
