// ─────────────────────────────────────────────────────────────────────────────
// lib/generator.ts  — Pure password generation logic (no external deps)
// ─────────────────────────────────────────────────────────────────────────────

// ── EFF Short Word List (200 words, trimmed for bundle size) ─────────────────
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

// ── Character sets ────────────────────────────────────────────────────────────
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
  exclude: string; // chars to exclude
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
}

export interface PinOptions {
  length: number; // 4–12
}

export interface PatternOptions {
  pattern: string; // e.g. "LL-ddd-SS"
}

// ── Crypto-random integer in [0, max) ─────────────────────────────────────────
function secureRandInt(max: number): number {
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

function shuffle(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function applyExclusion(charset: string, exclude: string): string {
  return charset.split("").filter(c => !exclude.includes(c)).join("");
}

// ── Random password ───────────────────────────────────────────────────────────
export function generateRandom(opts: RandomOptions): string {
  const ex = opts.exclude || "";

  if (opts.pronounceable) {
    return generatePronounceable(opts.length, ex);
  }

  const vowels    = applyExclusion("aeiou", ex);
  const consonants = applyExclusion("bcdfghjklmnpqrstvwxyz", ex);

  let charset = "";
  if (opts.useLower)   charset += applyExclusion(LOWER, ex);
  if (opts.useUpper)   charset += applyExclusion(UPPER, ex);
  if (opts.useDigits)  charset += applyExclusion(DIGITS, ex);
  if (opts.useSymbols) charset += applyExclusion(SYMS, ex);

  if (!charset) charset = applyExclusion(LOWER, ex) || LOWER;

  // Build required chars
  const required: string[] = [];
  const upperSet  = applyExclusion(UPPER, ex);
  const digitSet  = applyExclusion(DIGITS, ex);
  const symbolSet = applyExclusion(SYMS, ex);

  for (let i = 0; i < opts.minUpper && upperSet;   i++) required.push(secureChoice(upperSet));
  for (let i = 0; i < opts.minDigits && digitSet;  i++) required.push(secureChoice(digitSet));
  for (let i = 0; i < opts.minSymbols && symbolSet; i++) required.push(secureChoice(symbolSet));

  const remaining = Math.max(0, opts.length - required.length);
  const rest = Array.from({ length: remaining }, () => secureChoice(charset));

  return shuffle([...required, ...rest]).join("");
}

function generatePronounceable(length: number, exclude: string): string {
  const v = applyExclusion("aeiou", exclude) || "aeiou";
  const c = applyExclusion("bcdfghjklmnpqrstvwxyz", exclude) || "bcdfghjklmnpqrstvwxyz";
  let result = "";
  let useVowel = secureRandInt(2) === 0;
  for (let i = 0; i < length; i++) {
    result += secureChoice(useVowel ? v : c);
    useVowel = !useVowel;
  }
  return result;
}

// ── Passphrase ────────────────────────────────────────────────────────────────
export function generatePassphrase(opts: PassphraseOptions): string {
  const words: string[] = [];
  for (let i = 0; i < opts.wordCount; i++) {
    let w = EFF_WORDS[secureRandInt(EFF_WORDS.length)];
    if (opts.capitalize) w = w[0].toUpperCase() + w.slice(1);
    words.push(w);
  }
  return words.join(opts.separator);
}

// ── PIN ───────────────────────────────────────────────────────────────────────
export function generatePin(opts: PinOptions): string {
  return Array.from({ length: opts.length }, () => secureRandInt(10).toString()).join("");
}

// ── Pattern ───────────────────────────────────────────────────────────────────
// L = random lowercase letter
// U = random uppercase letter
// d = random digit
// S = random symbol
// * = random any (lower + digit + symbol)
// Any other char = literal
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

// ── Strength scoring ──────────────────────────────────────────────────────────
export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4; // 0=none, 1=weak, 2=fair, 3=strong, 4=very strong
  label: string;
  color: string;
  crackTime: string;
  entropy: number;
}

export function scorePassword(password: string): StrengthResult {
  if (!password) return { score: 0, label: "", color: "", crackTime: "", entropy: 0 };

  // Estimate charset size
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^A-Za-z0-9]/.test(password)) charsetSize += 32;

  const entropy = Math.log2(Math.max(charsetSize, 1)) * password.length;

  // Crack time @ 10B guesses/sec
  const guesses = Math.pow(2, entropy);
  const seconds = guesses / 10_000_000_000;

  let crackTime: string;
  if (seconds < 1)                       crackTime = "instantly";
  else if (seconds < 60)                 crackTime = `${Math.round(seconds)}s`;
  else if (seconds < 3600)               crackTime = `${Math.round(seconds / 60)}min`;
  else if (seconds < 86400)              crackTime = `${Math.round(seconds / 3600)}hr`;
  else if (seconds < 2592000)            crackTime = `${Math.round(seconds / 86400)}d`;
  else if (seconds < 31536000)          crackTime = `${Math.round(seconds / 2592000)}mo`;
  else if (seconds < 3.15e9)            crackTime = `${Math.round(seconds / 31536000)}yr`;
  else if (seconds < 3.15e12)           crackTime = `${Math.round(seconds / 3.15e9)}K yr`;
  else if (seconds < 3.15e15)           crackTime = `${Math.round(seconds / 3.15e12)}M yr`;
  else                                   crackTime = "centuries";

  let score: 0 | 1 | 2 | 3 | 4;
  let label: string;
  let color: string;

  if (entropy < 28)      { score = 1; label = "Weak";        color = "#ef4444"; }
  else if (entropy < 40) { score = 2; label = "Fair";        color = "#f97316"; }
  else if (entropy < 60) { score = 3; label = "Strong";      color = "#22c55e"; }
  else                   { score = 4; label = "Very strong";  color = "#10b981"; }

  return { score, label, color, crackTime, entropy: Math.round(entropy) };
}
