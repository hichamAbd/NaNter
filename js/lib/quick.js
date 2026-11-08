// Instant answers for the search box: "5 ft 11 in cm", "100 usd in eur", "15% of 80", "days until christmas",
// "3pm london in tokyo", "0xff", "1700000000", "MMXXVI", "1 cup flour in g", "12*3+4".
import { parseNum, fmt, fmtPct, fmtAmount, isExpression, getLocale } from '../core/num.js';
import { settings } from '../core/store.js';
import { CATEGORIES } from '../data/units.js';
import { CITIES } from '../data/geo.js';
import { getRates, cachedRates, rate, currencyName, kindOf } from './currencies.js';
import * as D from './dates.js';
import { wall, offsetMin, instantOf, offsetLabel, fmtTime, fmtDay } from './tz.js';
import { ALL as INGREDIENTS, KU, ML_PER_CUP } from '../tools/kitchen.js';
import { toBig, fromBig, toRoman, fromRoman } from '../tools/math.js';

const NUM = String.raw`[-−]?(?:\d+\s+\d+\/\d+|\d+\/\d+|\d[\d\s.,'’]*\d|\d|[.,]\d+)(?:e[-+]?\d+)?`;
const SEP = String.raw`\s+(?:to|in|into|as|en|vers|=)\s+|\s*(?:->|→|=>|=)\s*`;
const n0 = x => Math.round(x).toLocaleString();

/* ---------- unit alias index ---------- */
const CAT_ORDER = ['length', 'mass', 'temperature', 'volume', 'area', 'speed', 'time', 'data', 'datarate', 'pressure', 'energy', 'power', 'fuel', 'ev', 'force', 'torque', 'angle', 'frequency', 'density', 'flow', 'acceleration', 'light', 'numbers'];
// aliases are space separated, but some are several words ("fl oz", "metric ton"): keep those together
const MULTI = ['fl oz', 'fluid ounce', 'fluid ounces', 'metric ton', 'metric tons', 'short ton', 'long ton', 'us ton', 'imperial ton', 'troy ounce', 'troy ounces', 'troy oz', 'square metre', 'square meters', 'square feet', 'square inches', 'square yards', 'square miles', 'sq ft', 'sq m', 'sq in', 'sq yd', 'sq mi', 'sq cm', 'sq km', 'sq mm', 'cubic meters', 'cubic metre', 'cubic feet', 'cubic inches', 'cubic yards', 'cu ft', 'cu in', 'nautical miles', 'light years', 'miles per hour', 'meters per second', 'feet per second', 'acre foot', 'acre feet', 'deg c', 'deg f', 'degrees c', 'degrees f', 'us gallon', 'uk gallon', 'imperial gallon', 'us pint', 'uk pint', 'imperial pint', 'metric cup', 'metric teaspoon', 'metric tablespoon', 'us mpg', 'uk mpg', 'imperial mpg', 'small calorie', 'food calorie', 'metric hp', 'watt hour', 'kilowatt hour', 'newton meter', 'foot pound', 'light speed', 'per mil', 'refrigeration ton', 'astronomical units', 'kg/cm2', 'tr/min'];
function splitAliases(al) {
  if (!al) return [];
  let s = ' ' + al + ' ';
  const out = [];
  for (const m of MULTI) { const re = new RegExp(' ' + m.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?= )', 'g'); if (re.test(s)) { out.push(m); s = s.replace(re, ' '); } }
  return out.concat(s.trim().split(/\s+/).filter(Boolean));
}
let INDEX;
function index() {
  if (INDEX) return INDEX;
  INDEX = new Map();
  const add = (alias, cat, u) => {
    const a = String(alias).toLowerCase().trim();
    if (!a) return;
    if (!INDEX.has(a)) INDEX.set(a, []);
    const arr = INDEX.get(a);
    if (!arr.some(x => x.cat === cat && x.u.id === u.id)) arr.push({ cat, u });
  };
  for (const cat of CAT_ORDER) {
    for (const u of CATEGORIES[cat].units) {
      if (u.parts && !u.to) continue;
      if (cat === 'speed' && u.id === 'c') continue;
      add(u.id, cat, u); add(u.sym, cat, u); add(u.sym.replace(/²/, '2').replace(/³/, '3'), cat, u);
      const nm = u.name.toLowerCase().replace(/\s*\(.*\)/, '');
      for (const v of [nm, nm.replace(/meter/g, 'metre'), nm.replace(/liter/g, 'litre')]) { add(v, cat, u); add(v + 's', cat, u); }
      if (u.name.includes('(')) add(u.name.toLowerCase(), cat, u);
      for (const a of splitAliases(u.al)) add(a, cat, u);
    }
  }
  return INDEX;
}
const EXACT = { 'Mb/s': ['datarate', 'Mbps'], 'Mbps': ['datarate', 'Mbps'], 'Mbit/s': ['datarate', 'Mbps'], 'MB/s': ['datarate', 'MBps'], 'MBps': ['datarate', 'MBps'], 'Gb/s': ['datarate', 'Gbps'], 'Gbps': ['datarate', 'Gbps'], 'GB/s': ['datarate', 'GBps'], 'kb/s': ['datarate', 'kbps'], 'kbps': ['datarate', 'kbps'], 'kB/s': ['datarate', 'kBps'], 'KB/s': ['datarate', 'kBps'], 'Mb': ['data', 'Mbit'], 'Gb': ['data', 'Gbit'], 'kb': ['data', 'kbit'], 'MB': ['data', 'MB'], 'GB': ['data', 'GB'], 'TB': ['data', 'TB'], 'kB': ['data', 'kB'], 'KB': ['data', 'kB'], 'B': ['data', 'B'] };
function lookupUnit(phrase) {
  const ex = EXACT[phrase.trim()];
  if (ex) return [{ cat: ex[0], u: CATEGORIES[ex[0]].units.find(u => u.id === ex[1]) }];
  const p = phrase.toLowerCase().replace(/[.]$/, '').replace(/\s+/g, ' ').trim().replace(/^(?:of |d'|de |des )/, '').replace(/^°\s*/, '°');
  if (!p) return null;
  const idx = index();
  for (const cand of [p, p.replace(/^square /, 'sq '), p.replace(/^cubic /, 'cu '), p.replace(/s$/, ''), p.replace(/es$/, ''), p.replace(/^degrees? /, 'deg '), p.replace(/^°/, '')]) {
    if (idx.has(cand)) return idx.get(cand);
  }
  return null;
}

/* ---------- quantities ---------- */
const WORDNUM = { a: 1, an: 1, one: 1, un: 1, une: 1, two: 2, deux: 2, three: 3, trois: 3, half: 0.5, quarter: 0.25, ten: 10 };
function readNum(s) { const t = String(s).trim().replace(/−/g, '-'); if (WORDNUM[t.toLowerCase()] != null) return WORDNUM[t.toLowerCase()]; return parseNum(t); }

/** "5 ft 11 in", "1 h 30 min", "2 lb 3 oz", "3.5 km", "5'11" → { base, cat, u, cands, value, multi, text } */
function parseQuantity(s) {
  s = s.trim();
  let m = /^(\d+(?:[.,]\d+)?)\s*['’′]\s*(\d+(?:[.,]\d+)?)?\s*(?:["”″]|''|in(?:ch(?:es)?)?)?$/i.exec(s);
  if (m) { const ft = readNum(m[1]), inch = m[2] ? readNum(m[2]) : 0; return { base: ft * 0.3048 + inch * 0.0254, cat: 'length', u: CATEGORIES.length.units.find(u => u.id === 'ftin'), multi: true, text: `${m[1]}′${m[2] ? ' ' + m[2] + '″' : ''}` }; }
  const re = new RegExp(`^(${NUM}|a|an|one|un|une|half)\\s*([^\\d\\s][^\\d]*?)?(?:\\s+(${NUM})\\s*([^\\d\\s][^\\d]*?)?)?(?:\\s+(${NUM})\\s*([^\\d\\s][^\\d]*?)?)?$`, 'i');
  m = re.exec(s);
  if (!m) return null;
  const pairs = [[m[1], m[2]], [m[3], m[4]], [m[5], m[6]]].filter(p => p[0] != null);
  const SUB = { ft: 'in', feet: 'in', foot: 'in', st: 'lb', stone: 'lb', lb: 'oz', lbs: 'oz', pound: 'oz', pounds: 'oz', h: 'min', hr: 'min', hour: 'min', hours: 'min', min: 's', '°': '′' };
  for (let i = 1; i < pairs.length; i++) if (!pairs[i][1] && pairs[i - 1][1]) pairs[i][1] = SUB[pairs[i - 1][1].trim().toLowerCase()];
  let cat = null, base = 0, first = null;
  for (const [num, unitTxt] of pairs) {
    const v = readNum(num);
    if (!Number.isFinite(v) || !unitTxt) return null;
    const cands = lookupUnit(unitTxt);
    if (!cands) return null;
    const c = cat ? cands.find(x => x.cat === cat) : cands[0];
    if (!c) return null;
    if (!cat) { cat = c.cat; first = { c, v, cands }; }
    if (c.u.to && pairs.length > 1) return null;
    base += c.u.toBase(v);
  }
  return { base, cat, u: first.c.u, cands: pairs.length === 1 ? first.cands : null, value: first.v, multi: pairs.length > 1, text: pairs.map(([n, u]) => `${n.trim()} ${u.trim()}`).join(' ') };
}

function fmtPartsTxt(u, scalar) {
  const parts = u.parts; let rem = Math.abs(scalar); const out = [];
  parts.forEach((p, i) => { if (i < parts.length - 1) { const n = Math.floor(rem / p.f + 1e-9); out.push(n); rem -= n * p.f; } else out.push(Math.round(rem / p.f * 10) / 10); });
  if (u.id === 'ftin') { if (out[1] >= 12) { out[0]++; out[1] = 0; } return `${out[0]}′ ${fmt(out[1], { maxDec: 1 })}″`; }
  return parts.map((p, i) => `${fmt(out[i], { maxDec: 1 })} ${p.sym}`).join(' ');
}
function unitAnswer(q) {
  const s = q.replace(/^(?:convert|how many|how much|what is|what's|combien de?)\s+/i, '').replace(/\?$/, '').trim();
  const sepRe = new RegExp(SEP, 'gi');
  let m;
  const splits = [];
  while ((m = sepRe.exec(s))) splits.push([m.index, m.index + m[0].length]);
  for (const [a, b] of splits.reverse()) {
    const left = s.slice(0, a), right = s.slice(b);
    const toC = lookupUnit(right);
    if (!toC) continue;
    const qty = parseQuantity(left);
    if (!qty) continue;
    const fromCands = qty.cands || [{ cat: qty.cat, u: qty.u }];
    let pair = null;
    for (const cat of CAT_ORDER) {
      const f = fromCands.find(x => x.cat === cat), t = toC.find(x => x.cat === cat);
      if (f && t) { pair = { cat, f: f.u, t: t.u }; break; }
    }
    if (!pair) continue;
    const base = qty.multi ? qty.base : pair.f.toBase(qty.value);
    const out = pair.t.fromBase(base);
    if (!Number.isFinite(out)) continue;
    const nameOf = u => u.name.split(/ \(| =/)[0].toLowerCase();
    const valTxt = pair.t.parts ? fmtPartsTxt(pair.t, out) : pair.cat === 'numbers' ? `${fmt(out)} ${nameOf(pair.t)}` : `${fmt(out)} ${pair.t.sym}`;
    if (pair.cat === 'numbers') return [{ query: `${qty.text} =`, value: valTxt, sub: `= ${fmt(base, { sig: 15 })}${/billion|trillion|quadrillion/.test(pair.t.id) ? ' · ' + pair.t.name.split('= ')[1] + ' in French' : ''}`, copy: fmt(out, { group: false, sig: 12 }), tool: 'numbers', params: { u: pair.f.id, v: String(qty.value) } }];
    const params = qty.multi ? (pair.t.parts ? null : { u: pair.t.id, v: String(out) }) : { u: pair.f.id, v: String(qty.value) };
    return [{ query: `${qty.text} =`, value: valTxt, copy: pair.t.parts ? valTxt : fmt(out, { group: false, sig: 10 }), tool: pair.cat, params, sub: CATEGORIES[pair.cat].name }];
  }
  const qty = parseQuantity(s);
  if (!qty) return [];
  const cat = qty.cat, from = qty.u;
  const base = qty.multi ? qty.base : from.toBase(qty.value);
  const targets = defaultTargets(cat, from);
  if (!targets.length) return [];
  const lines = targets.map(t => (t.parts ? fmtPartsTxt(t, t.fromBase(base)) : `${fmt(t.fromBase(base))} ${t.sym}`));
  const t0 = targets.find(t => !t.parts) || targets[0];
  return [{ query: `${qty.text} =`, value: lines[0], sub: lines.slice(1).join(' · '), copy: lines[0], tool: cat, params: qty.multi ? { u: t0.id, v: String(t0.fromBase(base)) } : { u: from.id, v: String(qty.value) } }];
}
const PREF = {
  length: { m: ['mm', 'cm', 'm', 'km'], i: ['in', 'ft', 'ftin', 'yd', 'mi'] },
  mass: { m: ['mg', 'g', 'kg', 't'], i: ['oz', 'lb', 'stlb'] },
  volume: { m: ['ml', 'l', 'm3', 'cl', 'dl'], i: ['tsp', 'tbsp', 'floz', 'cup', 'pt', 'gal', 'galuk', 'ptuk'] },
  area: { m: ['cm2', 'm2', 'ha', 'km2'], i: ['in2', 'ft2', 'yd2', 'ac', 'mi2'] },
  speed: { m: ['kmh', 'ms'], i: ['mph', 'kn', 'fts'] },
};
function defaultTargets(cat, from) {
  const units = CATEGORIES[cat].units;
  const get = id => units.find(u => u.id === id);
  if (cat === 'temperature') return (from.id === 'C' ? ['F', 'K'] : from.id === 'F' ? ['C', 'K'] : ['C', 'F']).map(get);
  if (PREF[cat]) {
    const metric = PREF[cat].m.includes(from.id);
    let pick;
    if (cat === 'length') pick = metric ? (['mm', 'cm'].includes(from.id) ? ['in', 'ftin'] : from.id === 'm' ? ['ft', 'ftin', 'yd'] : ['mi', 'ft']) : (['in', 'ft', 'ftin'].includes(from.id) ? ['cm', 'm'] : ['km', 'm']);
    else if (cat === 'mass') pick = metric ? (['mg', 'g'].includes(from.id) ? ['oz'] : ['lb', 'stlb']) : ['kg', 'g'];
    else if (cat === 'volume') pick = metric ? ['floz', 'cup', 'gal'] : ['ml', 'l'];
    else pick = (metric ? PREF[cat].i : PREF[cat].m).slice(0, 2);
    return pick.map(get).filter(Boolean).filter(u => u.id !== from.id);
  }
  return units.filter(u => u.c && u.id !== from.id && !u.parts).slice(0, 3);
}

/* ---------- currency ---------- */
const CUR_WORDS = { pound: 'GBP', pounds: 'GBP', '$': 'USD', 'us$': 'USD', dollar: 'USD', dollars: 'USD', buck: 'USD', bucks: 'USD', '€': 'EUR', euro: 'EUR', euros: 'EUR', '£': 'GBP', 'pound sterling': 'GBP', 'pounds sterling': 'GBP', quid: 'GBP', sterling: 'GBP', '¥': 'JPY', yen: 'JPY', yuan: 'CNY', rmb: 'CNY', renminbi: 'CNY', '₹': 'INR', rupee: 'INR', rupees: 'INR', '₩': 'KRW', won: 'KRW', '₺': 'TRY', lira: 'TRY', '₽': 'RUB', ruble: 'RUB', rubles: 'RUB', rouble: 'RUB', '₿': 'BTC', bitcoin: 'BTC', bitcoins: 'BTC', ether: 'ETH', ethereum: 'ETH', franc: 'CHF', francs: 'CHF', 'franc suisse': 'CHF', dirham: 'MAD', dirhams: 'MAD', dh: 'MAD', dhs: 'MAD', peso: 'MXN', pesos: 'MXN', real: 'BRL', reais: 'BRL', rand: 'ZAR', baht: 'THB', ringgit: 'MYR', zloty: 'PLN', 'złoty': 'PLN', forint: 'HUF', riyal: 'SAR', riyals: 'SAR', shekel: 'ILS', shekels: 'ILS', krona: 'SEK', kronor: 'SEK', dinar: 'DZD', dinars: 'DZD', gold: 'XAU', silver: 'XAG' };
const NOT_CURRENCY = new Set(['min', 'cup', 'day', 'mph', 'kph', 'rpm', 'bpm', 'cal', 'gal', 'lbs', 'mol', 'lux', 'bar', 'atm', 'psi', 'ton', 'yds', 'kgs', 'hrs', 'sec', 'pcs', 'all', 'top', 'try', 'mad', 'bob']);
function curCode(tok, rates) {
  const t = String(tok || '').toLowerCase().trim().replace(/\.$/, '');
  if (!t) return null;
  if (CUR_WORDS[t]) return CUR_WORDS[t];
  const up = t.toUpperCase();
  if (NOT_CURRENCY.has(t) && t !== 'mad' && t !== 'try') return null;
  if (rates && rates[up] && (up.length === 3 || kindOf(up) === 'crypto')) return up;
  return null;
}
async function currencyAnswer(q) {
  let rates = cachedRates()?.rates;
  const s = q.trim().replace(/\?$/, '');
  const re = new RegExp(`^(?:([$€£¥₹₩₺₽₿])\\s*(${NUM})|(${NUM})\\s*([$€£¥₹₩₺₽₿]|[a-zA-Zéłü$]{2,}(?:\\s+(?:sterling|suisse))?)|([a-zA-Z]{3})\\s*(${NUM}))(?:(?:${SEP})(.+))?$`, 'i');
  const m = re.exec(s);
  if (!m) return [];
  const sym = m[1] || m[4] || m[5], amtTxt = m[2] || m[3] || m[6], target = m[7];
  const looksLike = x => CUR_WORDS[String(x).toLowerCase()] || /^[a-z]{3}$/i.test(String(x).trim());
  if (!looksLike(sym) || (target && !looksLike(target.trim()))) return [];
  if (!rates) { try { rates = (await getRates()).rates; } catch { return []; } }
  const from = curCode(sym, rates);
  if (!from) return [];
  let to = target ? curCode(target, rates) : null;
  if (target && !to) return [];
  if (!to) to = from === settings.currency ? (from === 'USD' ? 'EUR' : 'USD') : settings.currency;
  const amt = readNum(amtTxt);
  const k = rate(rates, from, to);
  if (!Number.isFinite(amt) || !Number.isFinite(k)) return [];
  const r = cachedRates();
  return [{ query: `${fmtAmount(amt, from)} ${from} =`, value: `${fmtAmount(amt * k, to)} ${to}`, copy: fmtAmount(amt * k, to), sub: `1 ${from} = ${fmt(k, { sig: 5 })} ${to} · ${currencyName(to)} · rates of ${r?.date || 'today'}`, tool: 'currency', params: { from, to, v: String(amt) } }];
}

/* ---------- percentages ---------- */
function percentAnswer(q) {
  const s = q.toLowerCase().replace(/^(?:what(?:'s| is)|calculate)\s+/, '').replace(/\?$/, '').trim();
  let m = new RegExp(`^(${NUM})\\s*%\\s*(?:of|de|from)\\s+(${NUM})$`).exec(s);
  if (m) { const p = readNum(m[1]), x = readNum(m[2]); return [{ query: `${m[1]} % of ${m[2]} =`, value: fmt(p * x / 100), tool: 'percentage', params: { a1: m[1], b1: m[2] } }]; }
  m = new RegExp(`^(${NUM})\\s*%\\s*(?:off|discount)\\s*(?:on|of|from)?\\s*(${NUM})$`).exec(s);
  if (m) { const p = readNum(m[1]), x = readNum(m[2]); return [{ query: `${m[2]} − ${m[1]} % =`, value: fmt(x * (1 - p / 100)), sub: `You save ${fmt(x * p / 100)}`, tool: 'discount', params: { mode: 'sale', orig: m[2], pct: m[1], extra: '' } }]; }
  m = new RegExp(`^(${NUM})\\s+(?:is what (?:%|percent|percentage) of|out of|sur)\\s+(${NUM})$`).exec(s) || new RegExp(`^(${NUM})\\s*/\\s*(${NUM})\\s*(?:in|as|en)\\s*(?:%|percent)$`).exec(s);
  if (m) { const x = readNum(m[1]), y = readNum(m[2]); return [{ query: `${m[1]} out of ${m[2]} =`, value: fmtPct(x / y * 100, 4), tool: 'percentage', params: { a2: m[1], b2: m[2] } }]; }
  m = new RegExp(`^(?:% ?change|change|percent change|evolution)?\\s*(?:from\\s+|de\\s+)?(${NUM})\\s+(?:to|a|à)\\s+(${NUM})\\s*(?:in\\s*%|%|percent)$`).exec(s);
  if (m) { const x = readNum(m[1]), y = readNum(m[2]); const c = (y - x) / Math.abs(x) * 100; return [{ query: `${m[1]} → ${m[2]}`, value: `${c >= 0 ? '+' : '−'}${fmtPct(Math.abs(c), 3)}`, tool: 'percentage', params: { a3: m[1], b3: m[2] } }]; }
  m = new RegExp(`^(${NUM})\\s*%\\s*tip\\s*(?:on|of|for)?\\s*(${NUM})$`).exec(s) || new RegExp(`^tip\\s*(${NUM})\\s*%\\s*(?:on|of|for)?\\s*(${NUM})$`).exec(s);
  if (m) { const p = readNum(m[1]), x = readNum(m[2]); return [{ query: `${m[1]} % tip on ${m[2]}`, value: `Tip ${fmt(x * p / 100, { maxDec: 2 })} · total ${fmt(x * (1 + p / 100), { maxDec: 2 })}`, tool: 'tip', params: { bill: m[2], pct: m[1] } }]; }
  return [];
}

/* ---------- dates ---------- */
const MONTHS = { jan: 1, january: 1, janvier: 1, janv: 1, feb: 2, february: 2, fev: 2, fevr: 2, fevrier: 2, mar: 3, march: 3, mars: 3, apr: 4, april: 4, avr: 4, avril: 4, may: 5, mai: 5, jun: 6, june: 6, juin: 6, jul: 7, july: 7, juil: 7, juillet: 7, aug: 8, august: 8, aout: 8, sep: 9, sept: 9, september: 9, septembre: 9, oct: 10, october: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, december: 12, decembre: 12 };
const WD = { sunday: 0, sun: 0, dimanche: 0, monday: 1, mon: 1, lundi: 1, tuesday: 2, tue: 2, mardi: 2, wednesday: 3, wed: 3, mercredi: 3, thursday: 4, thu: 4, jeudi: 4, friday: 5, fri: 5, vendredi: 5, saturday: 6, sat: 6, samedi: 6 };
const deacc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function nextYearly(m, d, dir) {
  const today = D.todayISO(); const y = +today.slice(0, 4);
  const mk = yy => `${yy}-${String(m).padStart(2, '0')}-${String(Math.min(d, D.daysInMonth(yy, m))).padStart(2, '0')}`;
  if (dir === 'past') return D.dayNum(mk(y)) <= D.dayNum(today) ? mk(y) : mk(y - 1);
  return D.dayNum(mk(y)) >= D.dayNum(today) ? mk(y) : mk(y + 1);
}
const FIXED = { christmas: [12, 25], xmas: [12, 25], 'christmas day': [12, 25], noel: [12, 25], 'christmas eve': [12, 24], 'new year': [1, 1], "new year's day": [1, 1], 'new years day': [1, 1], 'new years': [1, 1], "new year's": [1, 1], 'nouvel an': [1, 1], "jour de l'an": [1, 1], "new year's eve": [12, 31], 'new years eve': [12, 31], reveillon: [12, 31], halloween: [10, 31], valentine: [2, 14], "valentine's day": [2, 14], 'valentines day': [2, 14], 'saint valentin': [2, 14], 'st valentine': [2, 14], summer: [6, 21], ete: [6, 21], winter: [12, 21], hiver: [12, 21], spring: [3, 20], printemps: [3, 20], autumn: [9, 22], fall: [9, 22], automne: [9, 22], 'bastille day': [7, 14], '14 juillet': [7, 14], 'independence day': [7, 4], '4th of july': [7, 4], 'fourth of july': [7, 4] };
export function parseDate(txt, dir = 'future') {
  const s = deacc(String(txt).toLowerCase().trim()).replace(/[,.]$/, '').replace(/\bthe\b|\ble\b/g, '').replace(/(\d)(st|nd|rd|th|er)\b/g, '$1').replace(/\s+/g, ' ').trim();
  const today = D.todayISO();
  if (/^(today|now|aujourd'?hui|maintenant)$/.test(s)) return today;
  if (/^(tomorrow|demain)$/.test(s)) return D.addDays(today, 1);
  if (/^(yesterday|hier)$/.test(s)) return D.addDays(today, -1);
  if (FIXED[s]) return nextYearly(...FIXED[s], dir);
  if (/^(easter|paques)$/.test(s)) { const y = +today.slice(0, 4); const e = D.easter(y); return dir === 'past' ? (D.dayNum(e) <= D.dayNum(today) ? e : D.easter(y - 1)) : (D.dayNum(e) >= D.dayNum(today) ? e : D.easter(y + 1)); }
  let m = /^(?:(next|last|prochain|dernier) )?([a-z]+)(?: (prochain|dernier))?$/.exec(s);
  if (m && WD[m[2]] != null) {
    const wd = WD[m[2]], cur = D.weekday(today);
    const past = /last|dernier/.test(s) || dir === 'past';
    return D.addDays(today, past ? -((cur - wd + 7) % 7 || 7) : ((wd - cur + 7) % 7 || 7));
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) { const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return D.isValidISO(iso) ? iso : null; }
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
  if (m) {
    const us = /^en-US/i.test(getLocale()) || settings.country === 'US';
    let d = us ? +m[2] : +m[1], mo = us ? +m[1] : +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    if (!m[3]) return nextYearly(mo, d, dir);
    let y = +m[3]; if (y < 100) y += 2000;
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return D.isValidISO(iso) ? iso : null;
  }
  m = /^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/.exec(s) || /^([a-z]+) (\d{1,2})(?: (\d{4}))?$/.exec(s);
  if (m) {
    let d, mo; const y = m[3] ? +m[3] : null;
    if (/^\d/.test(m[1])) { d = +m[1]; mo = MONTHS[m[2]]; } else { mo = MONTHS[m[1]]; d = +m[2]; }
    if (!mo) return null;
    if (!y) return nextYearly(mo, d, dir);
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return D.isValidISO(iso) ? iso : null;
  }
  return null;
}
const DUR = { d: 'd', day: 'd', days: 'd', jour: 'd', jours: 'd', j: 'd', w: 'w', wk: 'w', week: 'w', weeks: 'w', semaine: 'w', semaines: 'w', mo: 'm', month: 'm', months: 'm', mois: 'm', y: 'y', yr: 'y', yrs: 'y', year: 'y', years: 'y', an: 'y', ans: 'y', annee: 'y', annees: 'y', 'business day': 'b', 'business days': 'b', 'working day': 'b', 'working days': 'b', workday: 'b', workdays: 'b', 'jour ouvre': 'b', 'jours ouvres': 'b' };
const UNIT = '(business days?|working days?|workdays?|jours? ouvres?|days?|jours?|weeks?|semaines?|months?|mois|years?|ans?|annees?|wk|mo|yrs?|d|w|y|j)';
function applyOffset(iso, n, u) {
  if (u === 'd') return D.addDays(iso, n);
  if (u === 'w') return D.addDays(iso, n * 7);
  if (u === 'm') return D.addMonths(iso, n);
  if (u === 'y') return D.addYears(iso, n);
  if (u === 'b') return D.addWorkingDays(iso, n, { weekend: settings.weekend || [6, 0] });
  return null;
}
function dateAnswer(q) {
  const s = deacc(q.toLowerCase().trim()).replace(/\?$/, '').replace(/^(?:how many|combien de)\s+/, '');
  const today = D.todayISO();
  const diffAns = (a, b, label) => {
    const d = D.dayNum(b) - D.dayNum(a);
    const w = Math.floor(Math.abs(d) / 7), r = Math.abs(d) % 7;
    return [{ query: label, value: `${n0(Math.abs(d))} ${Math.abs(d) === 1 ? 'day' : 'days'}`, sub: `${D.ymdText(D.diffYMD(a, b))} · ${w} wk ${r} d`, tool: 'datediff', params: { a: d >= 0 ? a : b, b: d >= 0 ? b : a, inc: '', times: '' } }];
  };
  let m = /^(?:days?|weeks?|months?|jours?|semaines?|time|countdown)\s*(?:until|till|til|to|before|avant|jusqu'?a)\s+(.+)$/.exec(s) || /^(?:countdown to|how long until|how long till)\s+(.+)$/.exec(s);
  if (m) { const t = parseDate(m[1], 'future'); if (t) return diffAns(today, t, `Until ${D.fmtDate(t, 'med')}`); }
  m = /^(?:days?|weeks?|months?|years?|jours?|time)\s*(?:since|depuis)\s+(.+)$/.exec(s) || /^how long since\s+(.+)$/.exec(s);
  if (m) { const t = parseDate(m[1], 'past'); if (t) return diffAns(t, today, `Since ${D.fmtDate(t, 'med')}`); }
  m = /^(?:(?:days )?(?:from|between|du|entre)\s+)?(.+?)\s+(?:to|and|until|→|au|et)\s+(.+)$/.exec(s);
  if (m && !/^\d+$/.test(m[1].trim())) { const a = parseDate(m[1], 'past'), b = parseDate(m[2], 'future'); if (a && b) return diffAns(a, b, `${D.fmtDate(a, 'short')} → ${D.fmtDate(b, 'short')}`); }
  let base = null, n, u;
  m = new RegExp(`^(.+?)\\s*([+-])\\s*(\\d+)\\s*${UNIT}$`).exec(s);
  if (m) { base = parseDate(m[1]); n = +m[3] * (m[2] === '-' ? -1 : 1); u = DUR[m[4]]; }
  if (!base) { m = new RegExp(`^(?:in|dans)\\s+(\\d+)\\s*${UNIT}$`).exec(s); if (m) { base = today; n = +m[1]; u = DUR[m[2]]; } }
  if (!base) { m = new RegExp(`^(\\d+)\\s*${UNIT}\\s+(ago|from now|from today|later|after|before|from|avant|apres|depuis)\\s*(.*)$`).exec(s); if (m) { const dir = /ago|before|avant/.test(m[3]) ? -1 : 1; base = m[4] ? parseDate(m[4]) : today; n = +m[1] * dir; u = DUR[m[2]]; } }
  if (base && u && Number.isFinite(n)) {
    const r = applyOffset(base, n, u);
    if (r) {
      const unitName = { d: 'day', w: 'week', m: 'month', y: 'year', b: 'working day' }[u];
      const abs = String(Math.abs(n));
      const params = u === 'b' ? { a: base, op: n < 0 ? 'sub' : 'add', mode: 'work', wd: abs } : { a: base, op: n < 0 ? 'sub' : 'add', mode: 'cal', ymw: [u === 'y' ? abs : '', u === 'm' ? abs : '', u === 'w' ? abs : ''].join(','), d: u === 'd' ? abs : '' };
      return [{ query: `${D.fmtDate(base, 'short')} ${n < 0 ? '−' : '+'} ${abs} ${unitName}${abs === '1' ? '' : 's'} =`, value: D.fmtDate(r, 'full'), sub: D.relDays(D.dayNum(r) - D.dayNum(today)), copy: D.fmtDate(r, 'full'), tool: 'dateadd', params }];
    }
  }
  const t = parseDate(s);
  if (t && !/^\d+$/.test(s)) {
    const d = D.dayNum(t) - D.dayNum(today);
    return [{ query: s, value: D.fmtDate(t, 'full'), sub: `${D.relDays(d)} · week ${D.isoWeek(t).week}`, copy: D.fmtDate(t, 'full'), tool: 'datediff', params: { a: today, b: t, inc: '', times: '' } }];
  }
  return [];
}

/* ---------- time zones ---------- */
const ABBR = { est: 'America/New_York', edt: 'America/New_York', et: 'America/New_York', cst: 'America/Chicago', cdt: 'America/Chicago', mst: 'America/Denver', mdt: 'America/Denver', pst: 'America/Los_Angeles', pdt: 'America/Los_Angeles', pt: 'America/Los_Angeles', akst: 'America/Anchorage', hst: 'Pacific/Honolulu', gmt: 'UTC', utc: 'UTC', bst: 'Europe/London', wet: 'Europe/Lisbon', cet: 'Europe/Paris', cest: 'Europe/Paris', eet: 'Europe/Athens', eest: 'Europe/Athens', msk: 'Europe/Moscow', ist: 'Asia/Kolkata', pkt: 'Asia/Karachi', gst: 'Asia/Dubai', sgt: 'Asia/Singapore', hkt: 'Asia/Hong_Kong', jst: 'Asia/Tokyo', kst: 'Asia/Seoul', aest: 'Australia/Sydney', aedt: 'Australia/Sydney', acst: 'Australia/Adelaide', awst: 'Australia/Perth', nzst: 'Pacific/Auckland', nzdt: 'Pacific/Auckland', brt: 'America/Sao_Paulo', wat: 'Africa/Lagos', eat: 'Africa/Nairobi', sast: 'Africa/Johannesburg', ict: 'Asia/Bangkok', wib: 'Asia/Jakarta', pht: 'Asia/Manila' };
const LOCAL = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();
function zoneOf(txt) {
  const s = deacc(String(txt).toLowerCase().trim()).replace(/^(?:in|a|en)\s+/, '').replace(/\s+time$/, '');
  if (!s) return null;
  if (/^(here|local|me|my time|chez moi|ici)$/.test(s)) return { tz: LOCAL, name: 'your time' };
  if (ABBR[s]) return { tz: ABBR[s], name: s.toUpperCase() };
  const c = CITIES.find(c => deacc(c.name.toLowerCase()) === s) || CITIES.find(c => c.al.some(a => deacc(a) === s));
  return c ? { tz: c.tz, name: c.name } : null;
}
function parseClock(t) {
  const m = /^(\d{1,2})(?:([:h.])(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|h)?$/.exec(String(t).trim().toLowerCase());
  if (!m) return null;
  let hh = +m[1]; const mm = m[3] ? +m[3] : 0; const ap = m[4]?.replace(/\./g, '');
  if (!ap && !m[3]) return null; // a bare "3" is not a time
  if (ap === 'pm' && hh < 12) hh += 12;
  if (ap === 'am' && hh === 12) hh = 0;
  return hh < 24 && mm < 60 ? [hh, mm] : null;
}
function tzAnswer(q) {
  const s = q.trim().replace(/\?$/, '');
  const h12 = settings.hour12;
  let m = /^(?:what time is it in|time in|current time in|heure (?:a|à)|quelle heure (?:est-il )?(?:a|à)|now in)\s+(.+)$/i.exec(s) || /^(.+?)\s+time$/i.exec(s);
  if (m) {
    const z = zoneOf(m[1]);
    if (z) { const now = Date.now(); return [{ query: `Time in ${z.name}`, value: fmtTime(now, z.tz, h12), sub: `${fmtDay(now, z.tz)} · ${offsetLabel(offsetMin(z.tz, now))}`, tool: 'timezones' }]; }
  }
  m = /^(\d{1,2}(?:[:h.]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.|h)?)\s+(.+?)\s+(?:to|in|en|=|->|→)\s+(.+)$/i.exec(s);
  if (m) {
    const t = parseClock(m[1]), za = zoneOf(m[2]), zb = zoneOf(m[3]);
    if (t && za && zb) {
      const w = wall(Date.now(), za.tz);
      const inst = instantOf(za.tz, w.year, w.month, w.day, t[0], t[1]);
      const wb = wall(inst, zb.tz);
      const dd = Date.UTC(wb.year, wb.month - 1, wb.day) - Date.UTC(w.year, w.month - 1, w.day);
      return [{ query: `${m[1]} ${za.name} =`, value: `${fmtTime(inst, zb.tz, h12)} ${zb.name}`, sub: dd > 0 ? 'next day' : dd < 0 ? 'previous day' : 'same day', tool: 'timezones' }];
    }
  }
  m = /^(\d{1,2}(?:[:h.]\d{2})?\s*(?:am|pm|h)?)\s+(?:in\s+)?(.+)$/i.exec(s);
  if (m) {
    const t = parseClock(m[1]), z = zoneOf(m[2]);
    if (t && z && z.tz !== LOCAL) {
      const w = wall(Date.now(), z.tz);
      const inst = instantOf(z.tz, w.year, w.month, w.day, t[0], t[1]);
      return [{ query: `${m[1]} in ${z.name} =`, value: `${fmtTime(inst, LOCAL, h12)} your time`, sub: fmtDay(inst, LOCAL), tool: 'timezones' }];
    }
  }
  return [];
}

/* ---------- unix, bases, roman, maths ---------- */
function unixAnswer(q) {
  const m = /^(?:unix\s+|timestamp\s+|epoch\s+|@)?(\d{9,13})$/.exec(q.trim());
  if (!m) return [];
  const n = +m[1], ms = m[1].length >= 12 ? n : n * 1000;
  const d = new Date(ms);
  return [{ query: `Unix ${m[1].length >= 12 ? 'milliseconds' : 'time'} ${m[1]} =`, value: d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', hour12: settings.hour12 }), sub: d.toISOString(), copy: d.toISOString(), tool: 'unix', params: { ts: m[1] } }];
}
function basesAnswer(q) {
  const s = q.trim().toLowerCase();
  let v = null, src = s, want = null;
  let m = /^(0x[0-9a-f]+|0b[01]+|0o[0-7]+)$/.exec(s);
  if (m) v = toBig(s, s.startsWith('0x') ? 16 : s.startsWith('0b') ? 2 : 8);
  m = /^(0x[0-9a-f]+|0b[01]+|\d+)\s*(?:in|to|en|as)?\s*(hex|hexadecimal|binary|bin|octal|oct|decimal|dec)$/.exec(s);
  if (!v && m) { src = m[1]; want = m[2].slice(0, 3); v = m[1].startsWith('0x') ? toBig(m[1], 16) : m[1].startsWith('0b') ? toBig(m[1], 2) : toBig(m[1], 10); }
  if (typeof v !== 'bigint') return [];
  const all = [['dec', 10], ['hex', 16], ['bin', 2], ['oct', 8]].map(([k, b]) => [k, fromBig(v, b)]);
  const top = all.find(([k]) => k === (want || 'dec'));
  return [{ query: `${src} =`, value: `${top[1]}${top[0] !== 'dec' ? ` (${top[0]})` : ''}`, copy: top[1], sub: all.filter(x => x !== top).map(([k, x]) => `${k} ${x}`).join(' · '), tool: 'bases', params: { src: 10, v: v.toString() } }];
}
function romanAnswer(q, raw) {
  const s = q.trim();
  let m = /^(\d{1,4})\s*(?:in|to|en)?\s*roman(?: numerals?)?$/i.exec(s) || /^roman\s+(\d{1,4})$/i.exec(s);
  if (m) { const r = toRoman(+m[1]); return r ? [{ query: `${m[1]} in Roman numerals =`, value: r, tool: 'roman', params: { n: m[1] } }] : []; }
  m = /^(?:roman\s+)?([ivxlcdm]{2,})$/i.exec(s);
  if (m && (/^[IVXLCDM]{2,}$/.test(String(raw).trim()) || /^roman/i.test(s))) { const n = fromRoman(m[1]); if (n) return [{ query: `${m[1].toUpperCase()} =`, value: String(n), tool: 'roman', params: { n: String(n) } }]; }
  return [];
}
function mathAnswer(q) {
  const s = q.trim().replace(/=$/, '');
  if (!isExpression(s)) return [];
  const v = parseNum(s);
  if (!Number.isFinite(v)) return [];
  return [{ query: s + ' =', value: fmt(v, { sig: 12 }), copy: fmt(v, { sig: 12, group: false }) }];
}

/* ---------- cooking: "1 cup flour in grams" ---------- */
const KITCHEN_U = { cup: 'cup', cups: 'cup', c: 'cup', tasse: 'cup', tasses: 'cup', tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', cas: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', cac: 'tsp', ml: 'ml', l: 'l', g: 'g', gram: 'g', grams: 'g', gr: 'g', grammes: 'g', kg: 'kg', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', stick: 'stick', sticks: 'stick' };
function cookingAnswer(q) {
  const s = deacc(q.toLowerCase().trim()).replace(/\?$/, '');
  let hit = null, word = '';
  for (const ing of INGREDIENTS) {
    const full = deacc(ing[1].toLowerCase().replace(/\s*\(.*\)/, ''));
    const words = full.split(/[ /]+/).filter(Boolean);
    for (const w of [full, words.slice(-2).join(' '), words[words.length - 1], words[0]]) if (w.trim().length > 2 && new RegExp(`\\b${w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s) && w.length > word.length) { hit = ing; word = w.trim(); }
  }
  if (!hit) return [];
  const rest = s.replace(word, ' ').replace(/\b(of|de|d')\b/g, ' ').replace(/\s+/g, ' ').trim();
  const m = new RegExp(`^(${NUM}|a|an|one|half)\\s*([a-z]+)\\s+(?:to|in|into|en)\\s+([a-z]+)$`).exec(rest);
  if (!m) return [];
  const fu = KU.find(k => k[0] === KITCHEN_U[m[2]]), tu = KU.find(k => k[0] === KITCHEN_U[m[3]]);
  if (!fu || !tu) return [];
  const v = readNum(m[1]), gPerMl = hit[2] / ML_PER_CUP;
  const grams = fu[2] === 'v' ? v * fu[3] * gPerMl : v * fu[3];
  const out = tu[2] === 'v' ? grams / gPerMl / tu[3] : grams / tu[3];
  return [{ query: `${m[1]} ${m[2]} of ${hit[1].toLowerCase()} =`, value: `${fmt(out, { sig: 3 })} ${m[3]}`, copy: fmt(out, { sig: 3 }), sub: `1 cup ≈ ${hit[2]} g`, tool: 'cooking', params: { ing: hit[0], u: fu[0], v: String(v) } }];
}

/** Up to three answers for a query. */
export async function answer(raw) {
  const q = String(raw || '').trim();
  if (q.length < 2) return [];
  const out = [];
  const add = a => { for (const x of a || []) if (out.length < 3 && !out.some(o => o.value === x.value)) out.push(x); };
  for (const t of [() => unixAnswer(q), () => basesAnswer(q), () => romanAnswer(q, raw), () => percentAnswer(q), () => cookingAnswer(q), () => unitAnswer(q), () => tzAnswer(q), () => dateAnswer(q)]) {
    try { add(t()); } catch (e) { console.warn(e); }
  }
  try { add(await currencyAnswer(q)); } catch (e) { console.warn(e); }
  if (!out.length) { try { add(mathAnswer(q)); } catch { } }
  return out;
}
