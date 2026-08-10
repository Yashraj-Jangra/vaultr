/**
 * Native Item Preview Canvas Component (Web-Parity Match)
 * Renders live visual previews for Vault items (Credit Cards, Login Keycards, Secure Notes, Address Labels, Profile Badges).
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View, Image } from "react-native";
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { Template } from "@vaultr/core";
import { Globe, User, FileText, MapPin } from "lucide-react-native";
import { resolveDomain } from "@vaultr/core";

// ── Brand detection (fallback when no explicit cardBrand) ────────────────────
export function detectCardBrand(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "AMEX";
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return "Discover";
  if (/^(60|6521|6522)/.test(clean)) return "RuPay";
  return "";
}

interface ItemPreviewCardProps {
  template: Template;
  name?: string;
  // Login fields
  username?: string;
  url?: string;
  domain?: string;
  // Card fields
  cardholderName?: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  cardBrand?: string; // Explicit override (Visa, Mastercard, AMEX, Discover, RuPay, Other)
  expiry?: string;    // Combined "MM / YYYY" from web
  cardName?: string;  // Web uses cardName
  // Address fields
  street?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  // Profile fields
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  idNumber?: string;
  // Note fields
  note?: string;
}

export function ItemPreviewCard(props: ItemPreviewCardProps) {
  const { template } = props;

  if (template === "card") return <CreditCardVisual {...props} />;
  if (template === "login") return <LoginKeycardVisual {...props} />;
  if (template === "note") return <NotePaperVisual {...props} />;
  if (template === "address") return <AddressLabelVisual {...props} />;
  if (template === "profile") return <ProfileBadgeVisual {...props} />;

  return null;
}

// ── 1. EMV Chip (Exact Match) ────────────────────────────────────────────────
function EmvChip() {
  return (
    <View style={chip.outer}>
      <View style={chip.grid}>
        <View style={chip.row}>
          <View style={[chip.cell, chip.borderR, chip.borderB]} />
          <View style={[chip.cell, chip.borderR, chip.borderB]} />
          <View style={[chip.cell, chip.borderB]} />
        </View>
        <View style={chip.row}>
          <View style={[chip.cell, chip.borderR]} />
          <View style={[chip.cell, chip.borderR]} />
          <View style={chip.cell} />
        </View>
      </View>
    </View>
  );
}

const chip = StyleSheet.create({
  outer: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F5D77D",
    padding: 4,
    justifyContent: "center",
  },
  grid: { flex: 1, gap: 1 },
  row: { flex: 1, flexDirection: "row", gap: 1 },
  cell: { flex: 1, backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 1 },
  borderR: { borderRightWidth: 1, borderRightColor: "rgba(0,0,0,0.15)" },
  borderB: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.15)" },
});

// ── 2. Brand Logos ───────────────────────────────────────────────────────────

function VisaLogo() {
  return (
    <Svg width={58} height={20} viewBox="27 176 449 145">
      <Path fill="#FFFFFF" d="M428.322,179.488c4.375,0.002,8.763,0.209,13.121-0.065c3.346-0.21,4.728,0.999,5.386,4.277c3.464,17.256,7.134,34.471,10.733,51.7c5.662,27.105,11.319,54.211,16.994,81.313c0.862,4.115,0.801,4.285-3.251,4.298c-8.862,0.027-17.725-0.055-26.587,0.044c-2.689,0.03-4.024-0.758-4.474-3.648c-0.775-4.977-2.1-9.865-3.049-14.818c-0.38-1.983-1.192-2.855-3.33-2.843c-13.573,0.074-27.147,0.076-40.72-0.004c-1.941-0.011-2.837,0.786-3.427,2.465c-1.858,5.29-3.844,10.535-5.651,15.842c-0.725,2.129-1.966,3.001-4.213,2.989c-10.769-0.061-21.539-0.078-32.308,0.014c-3.281,0.028-3.136-1.364-2.137-3.738c10.047-23.878,20.044-47.777,30.051-71.672c7.624-18.205,15.281-36.396,22.846-54.626c3.209-7.732,8.935-11.501,17.227-11.526C419.796,179.475,424.059,179.486,428.322,179.488z M419.993,220.363c-0.616,0.71-0.823,0.852-0.894,1.044c-5.611,15.372-11.191,30.756-16.834,46.116c-0.948,2.58,0.359,2.852,2.393,2.842c7.513-0.037,15.027-0.064,22.539,0.014c2.364,0.025,3.179-0.583,2.615-3.143c-2.17-9.848-4.132-19.742-6.186-29.616c-1.551-7.798-2.737-13.368-4.025-19.48C422.467,232.045,421.281,226.475,419.993,220.363z" />
      <Path fill="#FFFFFF" d="M120.429,272.953c2.395-6.006,4.807-12.005,7.181-18.019c9.515-24.103,19.052-48.198,28.472-72.338c0.946-2.425,2.307-3.175,4.772-3.152c10.323,0.097,20.647,0.033,30.971,0.045c4.4,0.005,4.541,0.21,2.821,4.317c-10.749,25.66-21.514,51.314-32.27,76.971c-7.937,18.932-15.918,37.846-23.747,56.822c-1.087,2.635-2.628,3.487-5.334,3.461c-10.435-0.103-20.872-0.095-31.307-0.01c-2.628,0.021-3.927-0.745-4.641-3.538c-9.251-36.183-18.757-72.301-27.912-108.508c-1.786-7.065-5.498-11.686-12.119-14.522c-9.423-4.036-19.139-7.055-29.088-9.416c-1.877-0.445-3.919-0.783-2.999-3.657c0.586-1.831,1.953-1.921,3.466-1.921c6.845,0.001,13.69-0.004,20.535-0.004c12.456-0.001,24.912-0.016,37.367,0.005c9.704,0.016,16.333,5.095,18.201,14.602c4.15,21.124,8.026,42.301,12.024,63.455c0.968,5.122,1.977,10.237,2.967,15.356c0.978,4.996,1.191,5.013,1.405,5.029C120.002,272.92,120.215,272.937,120.429,272.953z" />
      <Path fill="#FFFFFF" d="M318.913,176.815c10.742,0.128,21.181,1.975,31.4,5.278c2.579,0.834,3.226,2.057,2.601,4.697c-1.834,7.748-3.483,15.542-5.048,23.35c-0.558,2.787-1.562,3.485-4.33,2.324c-11.42-4.79-23.282-6.515-35.57-4.413c-3.375,0.577-6.428,1.994-8.932,4.403c-3.902,3.754-4.185,8.129-0.662,12.231c3.216,3.746,7.62,5.864,11.853,8.16c7.887,4.278,15.934,8.256,22.971,13.958c14.912,12.081,16.772,29.412,10.043,45.348c-6.455,15.287-19.152,23.361-34.511,27.57c-20.866,5.719-41.557,3.995-61.977-2.51c-4.54-1.446-4.542-1.63-3.552-6.226c1.701-7.894,3.557-15.757,5.082-23.685c0.574-2.982,1.66-3.091,4.059-1.912c11.955,5.875,24.615,8.23,37.892,7.237c4.785-0.358,9.259-1.692,13.175-4.571c5.794-4.26,6.118-11.759,0.737-16.543c-4.673-4.155-10.228-6.859-15.756-9.611c-7.361-3.665-14.298-7.913-20.28-13.681c-12.908-12.445-13.602-28.809-6.062-43.276c7.931-15.217,21.836-22.314,37.836-26.017c8.204-1.895,14.579-2.48,21-2.562C306.123,177.482,312.498,176.897,318.913,176.815z" />
      <Path fill="#FFFFFF" d="M229.57,179.488c4.935,0.003,9.875,0.142,14.803-0.047c3.249-0.125,3.736,1.135,3.103,4.03c-4.19,19.163-8.268,38.351-12.365,57.534c-5.361,25.1-10.764,50.191-15.989,75.32c-0.72,3.464-2.013,4.886-5.732,4.778c-8.965-0.26-17.943-0.078-26.915-0.086c-5.587-0.005-5.596-0.016-4.456-5.34c6.993-32.661,13.988-65.322,20.986-97.982c2.489-11.617,5.068-23.215,7.424-34.859c0.542-2.678,1.787-3.463,4.338-3.391C219.698,179.583,224.635,179.485,229.57,179.488z" />
    </Svg>
  );
}

function MastercardLogo() {
  return (
    <View style={{ width: 40, height: 26, position: "relative" }}>
      <Svg width={40} height={26} viewBox="0 0 40 26">
        <Circle cx="15" cy="13" r="13" fill="#eb001b" />
        <Circle cx="25" cy="13" r="13" fill="#f79e1b" />
        <Path d="M 20 4 A 13 13 0 0 1 20 22 A 13 13 0 0 1 20 4 Z" fill="#ff5f00" />
      </Svg>
    </View>
  );
}

function AmexLogo() {
  return (
    <View style={logoStyles.amexBox}>
      <Text style={logoStyles.amexText}>AMEX</Text>
    </View>
  );
}

function DiscoverLogo() {
  return (
    <View style={logoStyles.discoverRow}>
      <Text style={logoStyles.discoverWord}>DISC</Text>
      <View style={logoStyles.discoverDisc} />
      <Text style={logoStyles.discoverWord}>VER</Text>
    </View>
  );
}

function RuPayLogo() {
  return (
    <View style={logoStyles.rupayRow}>
      <Text style={logoStyles.rupayText}>RuPay</Text>
      <View style={logoStyles.rupayBar1} />
      <View style={logoStyles.rupayBar2} />
    </View>
  );
}

const logoStyles = StyleSheet.create({
  amexBox: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  amexText: { fontSize: 11, fontWeight: "900", color: "#ffffff", letterSpacing: 2 },
  discoverRow: { flexDirection: "row", alignItems: "center" },
  discoverWord: { fontSize: 11, fontWeight: "900", color: "#ffffff", letterSpacing: 1 },
  discoverDisc: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#f97316", marginHorizontal: 1 },
  rupayRow: { flexDirection: "row", alignItems: "center" },
  rupayText: { fontSize: 13, fontWeight: "900", color: "#ffffff", fontStyle: "italic" },
  rupayBar1: { width: 7, height: 13, backgroundColor: "#004e92", transform: [{ skewX: "-20deg" }], marginLeft: 4 },
  rupayBar2: { width: 7, height: 13, backgroundColor: "#f79e1b", transform: [{ skewX: "-20deg" }], marginLeft: 2 },
});

// ── 3. Credit Card Visual (1:1 Web Parity) ──────────────────────────────────

function CreditCardVisual({
  cardholderName = "",
  cardName = "",
  cardNumber = "",
  expMonth = "",
  expYear = "",
  expiry = "",
  cardBrand = "",
}: ItemPreviewCardProps) {

  // Resolve effective brand: explicit > auto-detect from number
  const effectiveBrand = useMemo(() => {
    if (cardBrand && cardBrand.toLowerCase() !== "auto-detect") return cardBrand;
    return detectCardBrand(cardNumber);
  }, [cardBrand, cardNumber]);

  const isVisa = effectiveBrand?.toLowerCase() === "visa";
  const isMC = effectiveBrand?.toLowerCase() === "mastercard";
  const isAmex = effectiveBrand?.toLowerCase() === "amex";
  const isDiscover = effectiveBrand?.toLowerCase() === "discover";
  const isRuPay = effectiveBrand?.toLowerCase() === "rupay";

  // Background themes matching web exactly
  const theme = useMemo(() => {
    if (isVisa)     return { bg: "#151233", border: "#2B1B54" };
    if (isMC)       return { bg: "#141415", border: "#26262a" };
    if (isAmex)     return { bg: "#090909", border: "rgba(245,158,11,0.3)" };
    if (isDiscover) return { bg: "#0C0603", border: "#2A1409" };
    if (isRuPay)    return { bg: "#02080D", border: "#004e92" };
    if (effectiveBrand?.toLowerCase() === "other") return { bg: "#0f1d1a", border: "#1a3330" };
    return { bg: "#121215", border: "#242429" };
  }, [isVisa, isMC, isAmex, isDiscover, isRuPay, effectiveBrand]);

  // Format card number: last group visible, rest bullet-masked
  const num = cardNumber.replace(/\D/g, "");
  const groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4];
  const digitGroups: string[] = [];
  let charIndex = 0;
  for (let g = 0; g < groups.length; g++) {
    let group = "";
    const isLastGroup = g === groups.length - 1;
    for (let i = 0; i < groups[g]; i++) {
      const idx = charIndex++;
      if (idx < num.length) {
        group += isLastGroup ? num[idx] : "•";
      } else {
        group += "-";
      }
    }
    digitGroups.push(group);
  }
  const formattedNumber = digitGroups.length
    ? digitGroups.join("  ")
    : "•••• •••• •••• ••••";

  // Expiry: combine from parts or use pre-combined web format
  const expiryStr = useMemo(() => {
    if (expiry) return expiry; // web format "MM / YYYY"
    if (expMonth || expYear) {
      return `${expMonth.padStart(2, "0") || "MM"} / ${expYear || "YY"}`;
    }
    return "00/00";
  }, [expiry, expMonth, expYear]);

  const displayName = cardholderName || cardName || "CARDHOLDER NAME";

  return (
    <View style={[card.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>

      {/* Background Graphics Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {isVisa && (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 320 200" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="visaWave" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#8E2DE2" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#4A00E0" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d="M-20,100 C80,40 180,160 340,80 L340,200 L-20,200 Z" fill="url(#visaWave)" />
            <Path d="M-20,130 C120,70 160,180 340,110 L340,200 L-20,200 Z" fill="url(#visaWave)" opacity="0.6" />
          </Svg>
        )}
        {isMC && (
          <>
            <View style={card.mcGlow1} />
            <View style={card.mcGlow2} />
          </>
        )}
        {isAmex && (
          <>
            <View style={card.amexBorder1} />
            <View style={card.amexBorder2} />
          </>
        )}
        {isDiscover && (
          <>
            <View style={card.discoverArc1} />
            <View style={card.discoverArc2} />
            <View style={card.discoverArc3} />
          </>
        )}
        {isRuPay && (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 320 200" preserveAspectRatio="none">
            <Path d="M0,40 L320,40 M0,80 L320,80 M0,120 L320,120 M0,160 L320,160" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            <Path d="M60,0 L60,200 M120,0 L120,200 M180,0 L180,200 M240,0 L240,200" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </Svg>
        )}
      </View>

      {/* Top Row: EMV Chip (left) + Brand Logo (right) */}
      <View style={card.topRow}>
        <EmvChip />
        <View style={card.logoWrap}>
          {isVisa      && <VisaLogo />}
          {isMC        && <MastercardLogo />}
          {isAmex      && <AmexLogo />}
          {isDiscover  && <DiscoverLogo />}
          {isRuPay     && <RuPayLogo />}
          {!isVisa && !isMC && !isAmex && !isDiscover && !isRuPay && effectiveBrand ? (
            <Text style={card.fallbackBrandText}>{effectiveBrand.toUpperCase()}</Text>
          ) : null}
        </View>
      </View>

      {/* Card Number */}
      <View style={card.numberWrap}>
        <Text style={card.numberText} numberOfLines={1}>{num.length > 0 ? formattedNumber : "•••• •••• •••• ••••"}</Text>
      </View>

      {/* Bottom Row: Name + Expiry */}
      <View style={card.bottomRow}>
        <View style={card.colLeft}>
          <Text style={card.metaLabel}>Cardholder Name</Text>
          <Text style={card.nameText} numberOfLines={1}>{displayName}</Text>
        </View>
        <View style={card.colRight}>
          <Text style={card.metaLabel}>Expiry Date</Text>
          <Text style={card.expiryText}>{expiryStr}</Text>
        </View>
      </View>
    </View>
  );
}

// ── 4. Login Keycard with SiteIcon ───────────────────────────────────────────

function LoginKeycardVisual({ name, username, url, domain }: ItemPreviewCardProps) {
  const [faviconError, setFaviconError] = React.useState(false);

  const effectiveDomain = useMemo(() => {
    return resolveDomain(domain, name || "", url);
  }, [domain, name, url]);

  const displayDomain = useMemo(() => {
    if (!url) return effectiveDomain || "vaultr.auth";
    try {
      const clean = url.startsWith("http") ? url : `https://${url}`;
      return new URL(clean).hostname;
    } catch {
      return url;
    }
  }, [url, effectiveDomain]);

  const faviconSrc = effectiveDomain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`
    : null;

  return (
    <View style={[login.container]}>
      {/* Ambient glow */}
      <View style={login.glow} pointerEvents="none" />

      {/* Top Row: Label + Site Favicon */}
      <View style={login.topRow}>
        <View>
          <Text style={login.cardTag}>ACCESS KEYCARD</Text>
          <Text style={login.title} numberOfLines={1}>{name || "Untitled Login"}</Text>
        </View>
        {/* Site favicon or fallback Globe */}
        <View style={login.faviconBox}>
          {faviconSrc && !faviconError ? (
            <Image
              source={{ uri: faviconSrc }}
              style={login.faviconImg}
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe size={20} color="rgba(255,255,255,0.4)" />
          )}
        </View>
      </View>

      {/* Identity row */}
      <View style={login.identityWrap}>
        <Text style={login.identityLabel}>IDENTITY</Text>
        <Text style={login.identityValue} numberOfLines={1}>{username || "username@email.com"}</Text>
      </View>

      {/* Footer */}
      <View style={login.footer}>
        <Text style={login.footerLabel}>ENCRYPTED KEY</Text>
        <Text style={login.footerDomain} numberOfLines={1}>{displayDomain}</Text>
      </View>
    </View>
  );
}

// ── 5. Secure Note Paper ─────────────────────────────────────────────────────

function NotePaperVisual({ name, note }: ItemPreviewCardProps) {
  return (
    <View style={note_.container}>
      {/* Top amber gradient bar */}
      <View style={note_.topBar} />

      <View style={note_.bodyWrap}>
        <View style={note_.header}>
          <View style={note_.headerLeft}>
            <FileText size={13} color="#e5e5e5" />
            <Text style={note_.title} numberOfLines={1}>{name || "Secure Note"}</Text>
          </View>
          <Text style={note_.confidentialTag}>CONFIDENTIAL</Text>
        </View>
        <Text style={note_.content} numberOfLines={4}>
          {note || "Type secure note contents below..."}
        </Text>
      </View>

      <Text style={note_.footer}>AES-256 ENCRYPTED BUFFER</Text>
    </View>
  );
}

// ── 6. Address Label ─────────────────────────────────────────────────────────

function AddressLabelVisual({
  name, street = "", line2 = "", city = "", state = "", zip = "", country = "",
}: ItemPreviewCardProps) {
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? " " + zip : "");

  return (
    <View style={addr.container}>
      {/* Stamp box */}
      <View style={addr.stampBox}>
        <Globe size={13} color="#737373" />
        <Text style={addr.stampText}>POSTAGE</Text>
      </View>

      <View style={addr.body}>
        <View style={addr.titleRow}>
          <MapPin size={13} color="#ffffff" />
          <Text style={addr.title} numberOfLines={1}>{name || "Shipping Address"}</Text>
        </View>
        <Text style={addr.line} numberOfLines={1}>{street || "123 Main Street"}</Text>
        {line2 ? <Text style={addr.line} numberOfLines={1}>{line2}</Text> : null}
        <Text style={addr.line} numberOfLines={1}>{cityStateZip || "City, State ZIP"}</Text>
        <Text style={addr.country} numberOfLines={1}>{(country || "United States").toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ── 7. Profile Badge ─────────────────────────────────────────────────────────

function ProfileBadgeVisual({ name, fullName = "", email = "", phone = "", dob, idNumber = "" }: ItemPreviewCardProps) {
  return (
    <View style={prof.container}>
      {/* Left white accent bar */}
      <View style={prof.accentBar} />

      {/* Top: Title + Chip */}
      <View style={prof.topRow}>
        <View>
          <Text style={prof.tag}>SECURE ACCESS BADGE</Text>
          <Text style={prof.name} numberOfLines={1}>{fullName || name || "Identity Profile"}</Text>
        </View>
        <View style={prof.chipOuter}>
          <View style={chip.grid}>
            <View style={chip.row}>
              <View style={[chip.cell, chip.borderR, chip.borderB]} />
              <View style={[chip.cell, chip.borderR, chip.borderB]} />
              <View style={[chip.cell, chip.borderB]} />
            </View>
            <View style={chip.row}>
              <View style={[chip.cell, chip.borderR]} />
              <View style={[chip.cell, chip.borderR]} />
              <View style={chip.cell} />
            </View>
          </View>
        </View>
      </View>

      {/* Middle: Avatar + meta */}
      <View style={prof.middle}>
        <View style={prof.avatar}>
          <User size={22} color="#a3a3a3" />
          <View style={prof.onlineDot} />
        </View>
        <View style={prof.metaCol}>
          <Text style={prof.metaLine} numberOfLines={1}>
            <Text style={prof.metaKey}>EMAIL: </Text>{email || "email@domain.com"}
          </Text>
          <Text style={prof.metaLine} numberOfLines={1}>
            <Text style={prof.metaKey}>PHONE: </Text>{phone || "+1 (555) 000-0000"}
          </Text>
          {dob ? (
            <Text style={prof.metaLine} numberOfLines={1}>
              <Text style={prof.metaKey}>DOB: </Text>{dob}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Footer */}
      <View style={prof.footer}>
        <Text style={prof.footerLeft}>AES-256 ENCRYPTED IDENTITY</Text>
        <Text style={prof.footerRight}>{idNumber ? `ID: ${idNumber}` : "VAULTR PASS"}</Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 20;
const CARD_ASPECT = 1.586; // Standard payment card

const card = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  logoWrap: { alignItems: "flex-end", justifyContent: "center" },
  fallbackBrandText: { fontSize: 13, fontWeight: "900", color: "#ffffff", letterSpacing: 1.5, fontStyle: "italic" },
  mcGlow1: {
    position: "absolute", top: -30, right: -20, width: 110, height: 110,
    borderRadius: 55, backgroundColor: "rgba(235,0,27,0.15)",
  },
  mcGlow2: {
    position: "absolute", top: -25, right: -45, width: 110, height: 110,
    borderRadius: 55, backgroundColor: "rgba(247,158,27,0.15)",
  },
  amexBorder1: {
    position: "absolute", top: 12, bottom: 12, left: 12, right: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
  },
  amexBorder2: {
    position: "absolute", top: 16, bottom: 16, left: 16, right: 16,
    borderRadius: 11, borderWidth: 1, borderColor: "rgba(245,158,11,0.1)",
  },
  discoverArc1: {
    position: "absolute", right: -60, top: -40, width: 200, height: 200,
    borderRadius: 100, borderWidth: 1.5, borderColor: "rgba(249,115,22,0.15)",
  },
  discoverArc2: {
    position: "absolute", right: -40, top: 90, width: 160, height: 160,
    borderRadius: 80, borderWidth: 1, borderColor: "rgba(249,115,22,0.1)",
  },
  discoverArc3: {
    position: "absolute", right: -20, top: 0, width: 130, height: 130,
    borderRadius: 65, borderWidth: 1, borderColor: "rgba(249,115,22,0.05)",
  },
  numberWrap: { zIndex: 10, marginVertical: 8 },
  numberText: { fontSize: 17, fontFamily: "monospace", fontWeight: "600", color: "#ffffff", letterSpacing: 2.5 },
  bottomRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", zIndex: 10 },
  colLeft: { flex: 1, marginRight: 12 },
  colRight: { alignItems: "flex-end" },
  metaLabel: { fontSize: 8.5, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 0.8, marginBottom: 2, textTransform: "uppercase" },
  nameText: { fontSize: 13, fontWeight: "700", color: "#ffffff", letterSpacing: 0.8, textTransform: "uppercase" },
  expiryText: { fontSize: 13, fontFamily: "monospace", fontWeight: "600", color: "#e4e4e7" },
});

const login = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#1e1e24",
    backgroundColor: "#0d0d10",
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  glow: {
    position: "absolute", top: -30, right: -30, width: 120, height: 120,
    borderRadius: 60, backgroundColor: "rgba(255,255,255,0.03)",
  },
  topRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
  },
  cardTag: { fontSize: 9, fontWeight: "800", color: "#737373", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 17, fontWeight: "700", color: "#ffffff", marginTop: 4, maxWidth: 200 },
  faviconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#141418", borderWidth: 1, borderColor: "#27272a",
    alignItems: "center", justifyContent: "center",
  },
  faviconImg: { width: 26, height: 26, resizeMode: "contain" },
  identityWrap: {},
  identityLabel: { fontSize: 8.5, fontWeight: "800", color: "rgba(255,255,255,0.3)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  identityValue: { fontSize: 12, fontFamily: "monospace", color: "#e4e4e7" },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#1f1f23", paddingTop: 10,
  },
  footerLabel: { fontSize: 8.5, fontFamily: "monospace", color: "#525252" },
  footerDomain: { fontSize: 11, fontWeight: "600", color: "#ffffff" },
});

const note_ = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#222226",
    backgroundColor: "#111113",
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 22,
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#ca8a04" },
  bodyWrap: { flex: 1, marginTop: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#222226", paddingBottom: 6 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1, marginRight: 8 },
  title: { fontSize: 13, fontWeight: "700", color: "#ffffff", flex: 1 },
  confidentialTag: { fontSize: 8, fontWeight: "800", color: "#ca8a04", letterSpacing: 1.2, textTransform: "uppercase" },
  content: { fontSize: 11, fontFamily: "monospace", color: "#71717a", lineHeight: 17 },
  footer: { fontSize: 8, fontFamily: "monospace", color: "#404040", textAlign: "right" },
});

const addr = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#22242b",
    backgroundColor: "#0d0e12",
    overflow: "hidden",
    position: "relative",
    padding: 20,
    justifyContent: "space-between",
  },
  stampBox: {
    position: "absolute", top: 14, right: 14,
    width: 44, height: 48, borderRadius: 6,
    borderWidth: 1, borderColor: "#27272a",
    backgroundColor: "#18181b",
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  stampText: { fontSize: 7, fontWeight: "700", color: "#71717a", textTransform: "uppercase" },
  body: { gap: 3, paddingRight: 56 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: "700", color: "#ffffff", flex: 1 },
  line: { fontSize: 12, fontFamily: "monospace", color: "#d4d4d8" },
  country: { fontSize: 10, fontWeight: "700", color: "#737373", letterSpacing: 1, marginTop: 4, textTransform: "uppercase" },
});

const prof = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#23232a",
    backgroundColor: "#0f0f13",
    overflow: "hidden",
    position: "relative",
    padding: 20,
    justifyContent: "space-between",
  },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#ffffff" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tag: { fontSize: 8.5, fontFamily: "monospace", fontWeight: "800", color: "#737373", letterSpacing: 1.5, textTransform: "uppercase" },
  name: { fontSize: 15, fontWeight: "700", color: "#ffffff", marginTop: 2 },
  chipOuter: { width: 36, height: 26, borderRadius: 5, backgroundColor: "#d4af37", padding: 4, justifyContent: "center" },
  middle: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", alignItems: "center", justifyContent: "center", position: "relative" },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#10b981", borderWidth: 2, borderColor: "#0f0f13" },
  metaCol: { flex: 1, gap: 3 },
  metaLine: { fontSize: 10.5, fontFamily: "monospace", color: "#a3a3a3" },
  metaKey: { fontSize: 9, color: "#525252", textTransform: "uppercase" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#1f1f25", paddingTop: 8 },
  footerLeft: { fontSize: 8, fontFamily: "monospace", color: "#525252" },
  footerRight: { fontSize: 10, fontWeight: "700", color: "#ffffff", letterSpacing: 0.8 },
});
