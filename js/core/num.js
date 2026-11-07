// Numbers: locale-aware parsing (accepts "1,5" and "1.5", grouping, fractions, simple maths)
// and formatting with a significant-digit budget that never rounds the integer part.

let LOCALE = 'en-US';
let DEC = '.';
let GRP = ',';
let SIG = 6;
const nfCache = new Map();

export function systemLocale() {
  try { return navigator.languages?.[0] || navigator.language || 'en-US'; } catch { return 'en-US'; }
}

/** Set the locale used for number output (and to disambiguate "1,234"). */
export function setNumberLocale(loc) {
  try { new Intl.NumberFormat(loc); } catch { loc = 'en-US'; }
  LOCALE = loc;
  nfCache.clear();
  const parts = new Intl.NumberFormat(loc, { useGrouping: true }).formatToParts(1234567.5);
  DEC = parts.find(p => p.type === 'decimal')?.value || '.';
  GRP = parts.find(p => p.type === 'group')?.value || ',';
}
export function setSig(n) { SIG = Math.max(2, Math.min(15, n | 0)); }
export const getLocale = () => LOCALE;
export const getDec = () => DEC;
export const getSig = () => SIG;

setNumberLocale(systemLocale());

const isSpaceGrp = c => /[\s  '’_]/.test(c);
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
const VULGAR = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅐': '1/7', '⅑': '1/9', '⅒': '1/10' };

/** Turn a numeric token like "1 234,5" / "1,234.5" / "1.234,5" into a JS number. */
export function normalizeNumberToken(tok) {
  let t = String(tok).replace(/[   ]/g, ' ').trim();
  if (/[\s'’_]/.test(t)) {
    // Spaces, apostrophes and underscores are only valid as thousands separators: 1 234 567,5 / 1'234.5 / 1_000
    const m = /^([-+]?)(\d{1,3}(?:[\s'’_]\d{3})+)([.,]\d*)?$/.exec(t);
    if (!m) return NaN;
    return Number(m[1] + m[2].replace(/[\s'’_]/g, '') + (m[3] ? '.' + m[3].slice(1) : ''));
  }
  const hasDot = t.includes('.'), hasComma = t.includes(',');
  if (hasDot && hasComma) {
    const last = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    const decCh = t[last], grpCh = decCh === '.' ? ',' : '.';
    const intPart = t.slice(0, last).split(grpCh).join('');
    if (intPart.includes(decCh)) return NaN;
    t = intPart + '.' + t.slice(last + 1);
  } else if (hasDot || hasComma) {
    const ch = hasDot ? '.' : ',';
    const parts = t.split(ch);
    if (parts.length > 2) {
      if (parts[0].replace(/^[-+]/, '').length && parts[0].replace(/^[-+]/, '').length <= 3 && parts.slice(1).every(p => p.length === 3)) t = parts.join('');
      else return NaN;
    } else {
      const [a, b] = parts;
      const ad = a.replace(/^[-+]/, '');
      // "1,234" is a thousands group only when "," is this locale's group separator.
      if (ch === GRP && b.length === 3 && ad.length >= 1 && ad.length <= 3 && ad !== '0') t = a + b;
      else t = a + '.' + b;
    }
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

function prep(s) {
  s = String(s).trim()
    .replace(/[−‒–—‐]/g, '-')
    .replace(/[×✕✖⋅·]/g, '*')
    .replace(/[÷∶]/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/π/g, '(pi)')
    .replace(/√\s*(\d[\d.,]*|\()/g, (m, a) => 'sqrt' + (a === '(' ? '(' : `(${a})`));
  // Superscript exponents: 10⁻³ → 10^-3, x² → x^2
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, m => '^(' + [...m].map(c => SUP[c]).join('') + ')');
  // Vulgar fractions: 1½ → (1+1/2), ½ → (1/2)
  s = s.replace(/(\d)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞⅐⅑⅒])/g, (m, d, f) => d ? `(${d}+${VULGAR[f]})` : `(${VULGAR[f]})`);
  // Mixed numbers: "1 3/8" → (1+3/8), only for proper fractions so "1 500/3" stays 1500/3
  s = s.replace(/(^|[^\d.,])(\d+)\s+(\d+)\/(\d+)(?![\d.,])/g, (m, pre, w, n, d) => (+n < +d ? `${pre}(${w}+${n}/${d})` : m));
  return s;
}

/**
 * Parse user input. Returns null for empty input, NaN when invalid, else a number.
 * Supports locale decimals, grouping, fractions, %, + - * / ^ ( ), sqrt, pi.
 */
export function parseNum(input) {
  if (input == null) return null;
  if (typeof input === 'number') return input;
  const raw = String(input).trim();
  if (!raw) return null;
  // Fast path: a plain number.
  if (/^[-+]?[\d\s  '’_.,]*\d[\d\s  '’_.,]*$/.test(raw) && !/\d\s+\d+\/\d/.test(raw)) {
    const n = normalizeNumberToken(raw.replace(/^\+/, ''));
    if (!Number.isNaN(n)) return n;
  }
  try {
    const v = evaluate(prep(raw));
    return typeof v === 'number' ? v : NaN;
  } catch { return NaN; }
}

/* ---------- expression evaluator (recursive descent, no eval) ---------- */
const FUNCS = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  sin: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180),
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.,]/.test(c)) {
      // number token: digits with separators (spaces only between digit groups), optional exponent
      let j = i;
      while (j < s.length && (/[\d.,'’_]/.test(s[j]) || (isSpaceGrp(s[j]) && /\d/.test(s[j + 1] || '') && /\d/.test(s[j - 1] || '') && /^\d{3}(?!\d)/.test(s.slice(j + 1))))) j++;
      let tok = s.slice(i, j);
      const ex = /^e[-+]?\d+/i.exec(s.slice(j));
      if (ex && !/^e[a-z]/i.test(s.slice(j))) { tok += ex[0]; j += ex[0].length; }
      const n = normalizeNumberToken(tok);
      if (Number.isNaN(n)) throw new Error('bad number');
      toks.push({ t: 'n', v: n });
      i = j; continue;
    }
    if (/[a-z]/i.test(c)) {
      let j = i; while (j < s.length && /[a-z]/i.test(s[j])) j++;
      const w = s.slice(i, j).toLowerCase();
      if (w in FUNCS) toks.push({ t: 'f', v: w });
      else if (w in CONSTS) toks.push({ t: 'n', v: CONSTS[w] });
      else throw new Error('unknown ' + w);
      i = j; continue;
    }
    if ('+-*/^%()'.includes(c)) { toks.push({ t: c }); i++; continue; }
    throw new Error('bad char ' + c);
  }
  return toks;
}

function evaluate(s) {
  const toks = tokenize(s);
  let p = 0;
  const peek = () => toks[p]?.t;
  const eat = t => { if (toks[p]?.t !== t) throw new Error('expected ' + t); p++; };

  // Each value carries pct=true when it is a bare "x%" so that "200 + 10%" means 220.
  function expr() {
    let a = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[p++].t;
      const b = term();
      const bv = b.pct ? a.v * b.v : b.v;
      a = { v: op === '+' ? a.v + bv : a.v - bv };
    }
    return a;
  }
  function term() {
    let a = power();
    for (;;) {
      const t = peek();
      if (t === '*' || t === '/') {
        p++;
        const b = power();
        a = { v: t === '*' ? a.v * b.v : a.v / b.v };
      } else if (t === '(' || t === 'f' || (t === 'n' && toks[p - 1]?.t === ')')) {
        // implicit multiplication: 2(3+1), 2pi, (1+2)(3)
        const b = power();
        a = { v: a.v * b.v };
      } else break;
    }
    return a;
  }
  function power() {
    const a = unary();
    if (peek() === '^') { p++; const b = power(); return { v: Math.pow(a.v, b.v) }; }
    return a;
  }
  function unary() {
    if (peek() === '-') { p++; const a = unary(); return { v: -a.v, pct: a.pct }; }
    if (peek() === '+') { p++; return unary(); }
    return postfix();
  }
  function postfix() {
    let a = primary();
    while (peek() === '%') { p++; a = { v: a.v / 100, pct: true }; }
    return a;
  }
  function primary() {
    const tk = toks[p];
    if (!tk) throw new Error('end');
    if (tk.t === 'n') { p++; return { v: tk.v }; }
    if (tk.t === '(') { p++; const a = expr(); eat(')'); return { v: a.v }; }
    if (tk.t === 'f') { p++; let a; if (peek() === '(') { p++; a = expr(); eat(')'); } else a = power(); return { v: FUNCS[tk.v](a.v) }; }
    throw new Error('unexpected ' + tk.t);
  }
  const r = expr();
  if (p !== toks.length) throw new Error('trailing');
  return r.v;
}

/** True when the input contains an operator (so we can show "= result"). */
export function isExpression(str) {
  const s = String(str || '').trim();
  if (!s) return false;
  return /[+*/^%×÷()√π⁰¹²³⁴⁵⁶⁷⁸⁹]|\d\s*-\s*\d|[a-z]{2,}\(/i.test(s.replace(/^[-+]/, '')) || /[½⅓⅔¼¾⅛⅜⅝⅞]/.test(s) || /\d\s+\d+\/\d+/.test(s);
}

/* ---------- formatting ---------- */
function nf(maxDec, minDec = 0, group = true) {
  const key = maxDec + '|' + minDec + '|' + group;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: Math.min(20, maxDec), minimumFractionDigits: Math.min(minDec, maxDec, 20), useGrouping: group });
    nfCache.set(key, f);
  }
  return f;
}

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const toSup = n => String(n).replace(/-/, '⁻').replace(/\d/g, d => SUPS[d]);

/** Decimals needed to show `sig` significant digits of x without rounding its integer part. */
export function decimalsFor(x, sig = SIG) {
  const ax = Math.abs(x);
  if (!ax) return 0;
  const mag = Math.floor(Math.log10(ax));
  return Math.max(0, sig - 1 - mag);
}

/**
 * Smart number formatting.
 * opts: sig (significant digits), dec (fixed max decimals), minDec, group (default true), sci (allow scientific, default true)
 */
export function fmt(x, opts = {}) {
  if (x == null || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  const sig = opts.sig ?? SIG;
  let ax = Math.abs(x);
  if (opts.dec == null && opts.sci !== false && ax !== 0 && (ax >= 1e15 || ax < 1e-6)) return sci(x, sig);
  let dec = opts.dec != null ? opts.dec : decimalsFor(x, sig);
  if (opts.maxDec != null) dec = Math.min(dec, opts.maxDec);
  const r = Math.round(x * 10 ** Math.min(dec, 15)) / 10 ** Math.min(dec, 15);
  if (r === 0) x = 0; // avoid "-0"
  return nf(dec, opts.minDec ?? 0, opts.group ?? true).format(x).replace(/^-/, '−');
}

/** Scientific notation with locale decimals: 1.23457 × 10¹⁵ */
export function sci(x, sig = SIG) {
  if (!x) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = x / 10 ** e;
  if (Math.abs(m) < 1) { m *= 10; e -= 1; }
  const f = 10 ** (sig - 1);
  if (Math.abs(Math.round(m * f) / f) >= 10) { m /= 10; e += 1; }
  return nf(Math.max(0, sig - 1), 0, false).format(m).replace(/^-/, '−') + ' × 10' + toSup(e);
}

/** Plain value for an editable field: no grouping is cleaner to edit, but keep the locale decimal. */
export function fmtEdit(x, opts = {}) {
  return fmt(x, { ...opts, group: opts.group ?? true });
}

/** Fixed decimals (e.g. money). */
export function fmtFixed(x, dec = 2, group = true) {
  if (x == null || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return '∞';
  if (Math.abs(x) < 0.5 * 10 ** -dec) x = 0;
  return nf(dec, dec, group).format(x).replace(/^-/, '−');
}

export function fmtInt(x) { return fmt(Math.round(x), { dec: 0 }); }

export function fmtPct(x, dec = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  return fmt(x, { maxDec: dec, sig: 8 }) + ' %';
}

/* ---------- money ---------- */
const curDigitsCache = new Map();
export function currencyDigits(code) {
  if (curDigitsCache.has(code)) return curDigitsCache.get(code);
  let d = 2;
  if (code.length === 3) {
    try { d = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; } catch { d = 8; }
  } else d = 8;
  curDigitsCache.set(code, d);
  return d;
}

/** Format an amount of a currency: 2 decimals for EUR, 0 for JPY, sig digits for crypto / tiny values. */
export function fmtAmount(x, code, { forceDec } = {}) {
  if (x == null || !Number.isFinite(x)) return '—';
  const d = forceDec ?? currencyDigits(code);
  const ax = Math.abs(x);
  if (d >= 8 || (ax > 0 && ax < 1)) return fmt(x, { sig: Math.max(SIG, 4), maxDec: 10 });
  return fmtFixed(x, ax >= 1e6 && d > 0 ? d : d);
}

export function currencySymbol(code) {
  if (!code || code.length !== 3) return code || '';
  try {
    const p = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
    return p.find(x => x.type === 'currency')?.value || code;
  } catch { return code; }
}

/** "€1,234.56" in the user's locale (falls back to "1,234.56 BTC"). */
export function fmtMoney(x, code, opts = {}) {
  if (x == null || !Number.isFinite(x)) return '—';
  if (code && code.length === 3) {
    try {
      const d = opts.dec ?? currencyDigits(code);
      return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace(/^-/, '−');
    } catch { /* fall through */ }
  }
  return fmtAmount(x, code || '') + ' ' + (code || '');
}

/* ---------- misc helpers ---------- */
export function round(x, dec = 0) { const f = 10 ** dec; return Math.round(x * f) / f; }
export function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
export const isNum = x => typeof x === 'number' && Number.isFinite(x);

/** Nearest fraction with a power-of-two denominator (for inches): 0.376 → [3, 8]. */
export function nearestFraction(x, maxDen = 16) {
  const whole = Math.floor(x + 1e-9);
  let frac = x - whole;
  let n = Math.round(frac * maxDen), d = maxDen;
  if (n === d) return [whole + 1, 0, 1];
  while (n && n % 2 === 0 && d % 2 === 0) { n /= 2; d /= 2; }
  return [whole, n, d];
}
export function fractionText(x, maxDen = 16) {
  const neg = x < 0; x = Math.abs(x);
  const [w, n, d] = nearestFraction(x, maxDen);
  const s = n ? (w ? `${w} ${n}/${d}` : `${n}/${d}`) : `${w}`;
  return (neg ? '−' : '') + s;
}

/** Best rational approximation (continued fractions). */
export function toFraction(x, maxDen = 10000, tol = 1e-9) {
  if (!Number.isFinite(x)) return null;
  const sign = Math.sign(x) || 1; x = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(x - h1 / k1) < tol * Math.max(1, x)) break;
    b = 1 / (b - a);
    if (!Number.isFinite(b)) break;
  }
  return [sign * h1, k1];
}

export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

export function plural(n, one, many) {
  const word = Math.abs(n) === 1 ? one : (many || one + 's');
  return `${typeof n === 'number' ? fmt(n, { dec: Number.isInteger(n) ? 0 : 2 }) : n} ${word}`;
}
