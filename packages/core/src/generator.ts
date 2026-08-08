/**
 * Pure password generation logic (no framework dependencies).
 * Portable across web, extensions, Node, and mobile.
 */

// ── EFF Short Word List (200 words) ──────────────────────────────────────────
const EFF_WORDS = [
  "acid","aged","also","area","army","away","baby","back","ball","band",
  "bank","base","bath","bear","beat","been","bell","best","bike","bill",
  "bird","bite","blog","blue","boat","body","bomb","bone","book","boom",
  "boot","bore","born","boss","both","bowl","bulk","burn","calm","came",
  "card","care","cash","cast","cave","cell","chat","chef","chin","chip",
  "city","clam","clan","clay","clip","club","clue","coal","coat","code",
  "coil","cold","come","cone","cook","cool","cope","copy","core","corn",
  "cost","cozy","crab","crew","crop","crow","cube","cure","cute","dark",
  "dart","data","date","dawn","dead","deal","dear","deed","deep","deer",
  "deny","desk","diet","dime","dire","dirt","dive","dock","dome","done",
  "door","dose","dove","down","draw","drew","drop","drum","duck","dull",
  "dump","dusk","dust","each","earn","ease","east","edge","emit","epic",
  "even","ever","exam","face","fact","fail","fair","fall","fame","farm",
  "fast","fate","feel","feet","fell","felt","file","fill","film","find",
  "fine","fire","firm","fish","fist","fizz","flag","flat","flew","flip",
  "flow","foam","fold","folk","fond","font","food","fool","ford","fore",
  "fork","form","fort","foul","free","frog","from","fuel","full","fund",
  "fuse","game","gang","gate","gave","gaze","gear","germ","gift","give",
  "glad","glow","glue","goal","goat","gold","golf","good","grab","gram",
];

const LOWER  = "abcdefghijklmnopqrstuvwxyz";
const UPPER  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMS   = "!@#$%^&*()-_=+[]{}|;:,.<>?";

export type GeneratorMode = "random" | "passphrase" | "pin" | "pattern";

export interface RandomOptions {
  length: number;
  useLower: boolean;
  useUpper: boolean;
  useDigits: boolean;
  useSymbols: boolean;
  pronounceable: boolean;
  minUpper: number;
  minDigits: number;
  minSymbols: number;
  exclude: string;
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
}

export interface PinOptions {
  length: number;
}

export interface PatternOptions {
  pattern: string;
}

function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    return globalThis.crypto as Crypto;
  }
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto;
  }
  throw new Error("WebCrypto is not available in this environment.");
}

function secureRandInt(max: number): number {
  const crypto = getCrypto();
  const arr = new Uint32Array(1);
  let result: number;
  do {
    crypto.getRandomValues(arr);
    result = arr[0];
  } while (result >= Math.floor(4294967296 / max) * max);
  return result % max;
}

function secureChoice(str: string): string {
  return str[secureRandInt(str.length)];
}

function shuffleString(str: string): string {
  const arr = str.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export function generateRandomPassword(opts: RandomOptions): string {
  let lowerSet  = LOWER;
  let upperSet  = UPPER;
  let digitSet  = DIGITS;
  let symbolSet = SYMS;

  if (opts.exclude) {
    const ex = new Set(opts.exclude.split(""));
    lowerSet  = lowerSet.split("").filter(c => !ex.has(c)).join("");
    upperSet  = upperSet.split("").filter(c => !ex.has(c)).join("");
    digitSet  = digitSet.split("").filter(c => !ex.has(c)).join("");
    symbolSet = symbolSet.split("").filter(c => !ex.has(c)).join("");
  }

  let pool = "";
  if (opts.useLower)   pool += lowerSet;
  if (opts.useUpper)   pool += upperSet;
  if (opts.useDigits)  pool += digitSet;
  if (opts.useSymbols) pool += symbolSet;

  if (!pool) pool = lowerSet;

  const result: string[] = [];

  if (opts.useUpper && opts.minUpper > 0 && upperSet.length > 0) {
    for (let i = 0; i < opts.minUpper; i++) result.push(secureChoice(upperSet));
  }
  if (opts.useDigits && opts.minDigits > 0 && digitSet.length > 0) {
    for (let i = 0; i < opts.minDigits; i++) result.push(secureChoice(digitSet));
  }
  if (opts.useSymbols && opts.minSymbols > 0 && symbolSet.length > 0) {
    for (let i = 0; i < opts.minSymbols; i++) result.push(secureChoice(symbolSet));
  }

  while (result.length < opts.length) {
    result.push(secureChoice(pool));
  }

  return shuffleString(result.slice(0, opts.length).join(""));
}

export function generatePassphrase(opts: PassphraseOptions): string {
  const words: string[] = [];
  for (let i = 0; i < opts.wordCount; i++) {
    let word = EFF_WORDS[secureRandInt(EFF_WORDS.length)];
    if (opts.capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }
  return words.join(opts.separator);
}

export function generatePin(opts: PinOptions): string {
  const result: string[] = [];
  for (let i = 0; i < opts.length; i++) {
    result.push(secureChoice(DIGITS));
  }
  return result.join("");
}

export function generatePattern(opts: PatternOptions): string {
  return opts.pattern.split("").map(ch => {
    switch (ch) {
      case "L": return secureChoice(LOWER);
      case "U": return secureChoice(UPPER);
      case "d": return secureChoice(DIGITS);
      case "S": return secureChoice(SYMS);
      case "*": return secureChoice(LOWER + DIGITS + SYMS);
      default:  return ch;
    }
  }).join("");
}

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  crackTime: string;
  entropy: number;
}

export function scorePassword(password: string): StrengthResult {
  if (!password) return { score: 0, label: "", color: "", crackTime: "", entropy: 0 };

  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^A-Za-z0-9]/.test(password)) charsetSize += 32;

  const entropy = Math.log2(Math.max(charsetSize, 1)) * password.length;
  const guesses = Math.pow(2, entropy);
  const seconds = guesses / 10_000_000_000;

  let crackTime: string;
  if (seconds < 1)              crackTime = "instantly";
  else if (seconds < 60)        crackTime = `${Math.round(seconds)}s`;
  else if (seconds < 3600)      crackTime = `${Math.round(seconds / 60)}min`;
  else if (seconds < 86400)     crackTime = `${Math.round(seconds / 3600)}hr`;
  else if (seconds < 2592000)   crackTime = `${Math.round(seconds / 86400)}d`;
  else if (seconds < 31536000)  crackTime = `${Math.round(seconds / 2592000)}mo`;
  else if (seconds < 3.15e9)    crackTime = `${Math.round(seconds / 31536000)}yr`;
  else if (seconds < 3.15e12)   crackTime = `${Math.round(seconds / 3.15e9)}K yr`;
  else if (seconds < 3.15e15)   crackTime = `${Math.round(seconds / 3.15e12)}M yr`;
  else                          crackTime = "centuries";

  let score: 0 | 1 | 2 | 3 | 4;
  let label: string;
  let color: string;

  if (entropy < 28)      { score = 1; label = "Weak";        color = "#ef4444"; }
  else if (entropy < 40) { score = 2; label = "Fair";        color = "#f97316"; }
  else if (entropy < 60) { score = 3; label = "Strong";      color = "#22c55e"; }
  else                   { score = 4; label = "Very strong";  color = "#10b981"; }

  return { score, label, color, crackTime, entropy: Math.round(entropy) };
}
