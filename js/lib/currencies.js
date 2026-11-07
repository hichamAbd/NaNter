// Exchange rates: several free sources with fallback, cached for offline use. Rates are "units per 1 EUR".
import { load, save, LANG } from '../core/store.js';
import { flag } from '../data/geo.js';

const UP = o => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number' && v > 0).map(([k, v]) => [k.toUpperCase(), v]));
const SOURCES = [
  { name: 'fawazahmed0 / jsDelivr', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json', parse: j => ({ date: j.date, rates: UP(j.eur) }) },
  { name: 'fawazahmed0 / Cloudflare', url: 'https://latest.currency-api.pages.dev/v1/currencies/eur.min.json', parse: j => ({ date: j.date, rates: UP(j.eur) }) },
  { name: 'ExchangeRate-API', url: 'https://open.er-api.com/v6/latest/EUR', parse: j => ({ date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), rates: UP(j.rates) }) },
  { name: 'ECB via Frankfurter', url: 'https://api.frankfurter.dev/v1/latest?base=EUR', parse: j => ({ date: j.date, rates: { ...UP(j.rates), EUR: 1 } }) },
];
export const ECB = new Set('AUD BGN BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF IDR ILS INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON SEK SGD THB TRY USD ZAR'.split(' '));
export const METALS = { XAU: 'Gold (troy oz)', XAG: 'Silver (troy oz)', XPT: 'Platinum (troy oz)', XPD: 'Palladium (troy oz)' };
const LEGACY = new Set('ATS BEF DEM ESP FIM FRF GRD IEP ITL LUF NLG PTE CYP EEK LTL LVL MTL SIT SKK HRK BGN ZMK ZWD ZWL VEF VEB MRO STD BYR GHC MZM ROL SDD SRG TMM TRL AZM SLL CUC ANG XBT'.split(' '));
const POPULAR = 'EUR USD GBP JPY CHF CAD AUD CNY MAD AED SAR TRY INR HKD SGD SEK NOK DKK PLN CZK HUF RON ZAR BRL MXN KRW THB DZD TND EGP QAR NZD'.split(' ');
const CRYPTO_NAMES = { BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', USDC: 'USD Coin', BNB: 'BNB', SOL: 'Solana', XRP: 'XRP', ADA: 'Cardano', DOGE: 'Dogecoin', TRX: 'TRON', DOT: 'Polkadot', LTC: 'Litecoin', BCH: 'Bitcoin Cash', LINK: 'Chainlink', AVAX: 'Avalanche', XLM: 'Stellar', XMR: 'Monero', SHIB: 'Shiba Inu', ATOM: 'Cosmos', UNI: 'Uniswap', ETC: 'Ethereum Classic', PEPE: 'Pepe', SUI: 'Sui', NEAR: 'NEAR', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism', FIL: 'Filecoin', ICP: 'Internet Computer', HBAR: 'Hedera', VET: 'VeChain', ALGO: 'Algorand', DAI: 'Dai', ZEC: 'Zcash', DASH: 'Dash', EOS: 'EOS', XTZ: 'Tezos', AAVE: 'Aave', MKR: 'Maker', PAXG: 'PAX Gold', XAUT: 'Tether Gold', TON: 'Toncoin', KAS: 'Kaspa', POL: 'Polygon' };
const EXTRA_NAMES = { XCG: 'Caribbean guilder', ZWG: 'Zimbabwe Gold', SLE: 'Sierra Leonean leone', VES: 'Venezuelan bolívar', MRU: 'Mauritanian ouguiya', STN: 'São Tomé dobra', CNH: 'Chinese yuan (offshore)', XDR: 'IMF Special Drawing Rights' };

let curNames;
export function currencyName(code) {
  if (METALS[code]) return METALS[code];
  if (CRYPTO_NAMES[code]) return CRYPTO_NAMES[code];
  if (EXTRA_NAMES[code]) return EXTRA_NAMES[code];
  try { curNames ||= new Intl.DisplayNames([LANG, 'en'], { type: 'currency' }); const n = code.length === 3 && curNames.of(code); if (n && n !== code) return n.charAt(0).toUpperCase() + n.slice(1); } catch { }
  return load('cryptoNames', {})[code] || code;
}
export function kindOf(code) {
  if (METALS[code]) return 'metal';
  if (LEGACY.has(code)) return 'legacy';
  if (CRYPTO_NAMES[code] || code.length !== 3 || /^\d/.test(code)) return 'crypto';
  try { curNames ||= new Intl.DisplayNames([LANG, 'en'], { type: 'currency' }); const n = curNames.of(code); if (!n || n === code) return EXTRA_NAMES[code] ? 'fiat' : 'crypto'; } catch { }
  return 'fiat';
}
let regionNames;
export function currencyFlag(code) {
  if (code === 'EUR') return '🇪🇺';
  if (METALS[code]) return { XAU: '🥇', XAG: '🥈', XPT: '⚪️', XPD: '⚫️' }[code];
  const k = kindOf(code);
  if (k === 'crypto') return code === 'BTC' ? '₿' : '🪙';
  if (code === 'ANG' || code === 'XCG') return flag('CW');
  if (code.startsWith('X')) return '🌐';
  const cc = code.slice(0, 2);
  try { regionNames ||= new Intl.DisplayNames(['en'], { type: 'region' }); if (regionNames.of(cc) === cc) return '🌐'; } catch { }
  return flag(cc) || '🌐';
}

/* ---------- latest rates ---------- */
const MAX_AGE = 6 * 3600 * 1000;
let mem = load('rates', null);
let inflight = null;
export function cachedRates() { return mem; }
async function fetchJSON(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
/** Returns {date, fetched, source, rates}. Uses cache when fresh unless force. Never throws when a cache exists. */
export async function getRates({ force = false } = {}) {
  if (!force && mem && Date.now() - mem.fetched < MAX_AGE) return mem;
  if (inflight) return inflight;
  inflight = (async () => {
    let lastErr;
    for (const s of SOURCES) {
      try {
        const data = s.parse(await fetchJSON(s.url));
        if (!data.rates || Object.keys(data.rates).length < 25) throw new Error('incomplete');
        data.rates.EUR = 1;
        mem = { ...data, fetched: Date.now(), source: s.name };
        save('rates', mem);
        return mem;
      } catch (e) { lastErr = e; }
    }
    if (mem) return { ...mem, stale: true };
    throw lastErr || new Error('No rates');
  })().finally(() => { inflight = null; });
  return inflight;
}
/** Cross rate: how many `to` for 1 `from`. */
export function rate(rates, from, to) {
  const a = rates?.[from], b = rates?.[to];
  return a && b ? b / a : NaN;
}
export function listCodes(rates) {
  const codes = Object.keys(rates || {});
  const pop = POPULAR.filter(c => codes.includes(c));
  return { popular: pop, codes };
}
export const CURRENCY_LIST = POPULAR.concat('AFN ALL AMD AOA ARS AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BSD BTN BWP BYN BZD CDF CLP COP CRC CUP CVE DJF DOP ERN ETB FJD FKP GEL GGP GHS GIP GMD GNF GTQ GYD HNL HTG IDR ILS IMP IQD IRR ISK JEP JMD JOD KES KGS KHR KMF KPW KWD KYD KZT LAK LBP LKR LRD LSL LYD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MYR MZN NAD NGN NIO NPR OMR PAB PEN PGK PHP PKR PYG RSD RUB RWF SBD SCR SDG SHP SLE SOS SRD SSP STN SVC SYP SZL TJS TMT TOP TTD TWD TZS UAH UGX UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZMW ZWG'.split(' ')).map(code => ({ code, iso: true }));

export async function ensureCryptoNames() {
  if (Object.keys(load('cryptoNames', {})).length) return;
  try {
    const j = await fetchJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.min.json');
    const out = {};
    for (const [k, v] of Object.entries(j)) if (v) out[k.toUpperCase()] = v;
    save('cryptoNames', out);
  } catch { }
}

/* ---------- history ---------- */
const histCache = new Map();
/** Rate on a given date (YYYY-MM-DD): ECB (since 1999) for ECB pairs, else fawazahmed0 (since 2024-03-02). */
export async function rateOn(date, from, to) {
  const key = `${date}|${from}|${to}`;
  if (histCache.has(key)) return histCache.get(key);
  let r = null;
  if (ECB.has(from) && ECB.has(to) && date >= '1999-01-04') {
    const j = await fetchJSON(`https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`);
    if (from === to) r = { rate: 1, date: j.date, source: 'ECB' };
    else r = { rate: j.rates?.[to], date: j.date, source: 'ECB' };
  } else {
    if (date < '2024-03-02') throw new Error(`History for ${from}/${to} starts on 2 Mar 2024 (ECB currencies go back to 1999).`);
    const j = await fetchJSON(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${from.toLowerCase()}.min.json`);
    r = { rate: j[from.toLowerCase()]?.[to.toLowerCase()], date: j.date, source: 'fawazahmed0' };
  }
  if (!r.rate) throw new Error('No rate for that date');
  histCache.set(key, r);
  return r;
}
/** Daily series [[date, rate]] between two dates. */
export async function series(from, to, start, end) {
  const key = `s|${from}|${to}|${start}|${end}`;
  if (histCache.has(key)) return histCache.get(key);
  let out;
  if (ECB.has(from) && ECB.has(to)) {
    const j = await fetchJSON(`https://api.frankfurter.dev/v1/${start}..${end}?base=${from}&symbols=${to}`, 12000);
    out = Object.entries(j.rates || {}).map(([d, r]) => [d, r[to]]).filter(x => x[1]);
  } else {
    // Sample ~24 days across the range from the daily snapshots.
    const s = new Date(Math.max(Date.parse(start), Date.parse('2024-03-02'))), e = new Date(end);
    const n = 24, step = Math.max(1, Math.round((e - s) / 864e5 / (n - 1)));
    const dates = [];
    for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + step)) dates.push(d.toISOString().slice(0, 10));
    if (dates[dates.length - 1] !== end) dates.push(end);
    const res = await Promise.allSettled(dates.map(d => rateOn(d, from, to)));
    out = res.map((r, i) => (r.status === 'fulfilled' ? [dates[i], r.value.rate] : null)).filter(Boolean);
  }
  histCache.set(key, out);
  return out;
}
