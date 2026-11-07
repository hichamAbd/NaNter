// Persistence (localStorage, always wrapped: private mode can throw) + settings with locale-derived defaults.
import { COUNTRY_CURRENCY, countryOfZone } from '../data/geo.js';
import { setNumberLocale, setSig, systemLocale } from './num.js';

const P = 'nanter:';
export function load(key, def) {
  try { const v = localStorage.getItem(P + key); return v == null ? def : JSON.parse(v); } catch { return def; }
}
export function save(key, val) {
  try { localStorage.setItem(P + key, JSON.stringify(val)); } catch { /* storage full or blocked */ }
}
export function remove(key) { try { localStorage.removeItem(P + key); } catch { } }
export function clearAll() {
  try { Object.keys(localStorage).filter(k => k.startsWith(P)).forEach(k => localStorage.removeItem(k)); } catch { }
}

/* ---------- tiny event bus ---------- */
const subs = new Map();
export function on(evt, fn) { if (!subs.has(evt)) subs.set(evt, new Set()); subs.get(evt).add(fn); return () => subs.get(evt).delete(fn); }
export function emit(evt, data) { subs.get(evt)?.forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }

/* ---------- locale guesses ---------- */
export const LANG = systemLocale();
export const ZONE = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();

function guessCountry() {
  const fromZone = countryOfZone(ZONE);
  if (fromZone) return fromZone;
  const m = /[-_]([A-Z]{2})\b/.exec(LANG);
  return m ? m[1] : 'US';
}
function guessSystem(cc) {
  if (['US', 'LR', 'MM', 'PR', 'GU', 'AS'].includes(cc)) return 'us';
  if (cc === 'GB') return 'uk';
  return 'metric';
}
function guessWeekStart(cc) {
  try {
    const loc = new Intl.Locale(LANG.includes('-') ? LANG : LANG + '-' + cc);
    const wi = loc.getWeekInfo?.() || loc.weekInfo;
    if (wi?.firstDay) return wi.firstDay % 7; // 1 = Monday … 7 = Sunday → 0 = Sunday
  } catch { }
  return ['US', 'CA', 'MX', 'BR', 'JP', 'KR', 'TW', 'HK', 'IL', 'PH', 'IN', 'ZA', 'SA', 'AU'].includes(cc) ? 0 : 1;
}
function guessHour12() {
  try { return new Intl.DateTimeFormat(LANG, { hour: 'numeric' }).resolvedOptions().hour12 ?? false; } catch { return false; }
}

const COUNTRY = guessCountry();
const DEFAULTS = {
  theme: 'auto',            // auto | light | dark
  country: COUNTRY,         // used for holidays, VAT presets
  currency: COUNTRY_CURRENCY[COUNTRY] || 'USD',
  system: guessSystem(COUNTRY), // metric | us | uk
  sig: 6,                   // significant digits
  numLocale: 'auto',        // auto or a BCP-47 tag used for number display
  weekStart: guessWeekStart(COUNTRY), // 0 Sunday, 1 Monday, 6 Saturday
  hour12: guessHour12(),
  weekend: [6, 0],          // Saturday, Sunday
};

export const settings = Object.assign({}, DEFAULTS, load('settings', {}));
// First run: persist the guesses so travelling (new time zone) does not change your home currency.
if (!load('settings', null)) save('settings', settings);

export function applySettings() {
  setNumberLocale(settings.numLocale === 'auto' ? LANG : settings.numLocale);
  setSig(settings.sig);
  const root = document.documentElement;
  if (settings.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = settings.theme;
}
export function setSetting(k, v) {
  settings[k] = v;
  save('settings', settings);
  applySettings();
  emit('settings', k);
}
export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  save('settings', settings);
  applySettings();
  emit('settings', '*');
}
export const isMetric = () => settings.system === 'metric';
export const isUS = () => settings.system === 'us';

/* ---------- favorites, recents, per-tool state ---------- */
const DEFAULT_FAVS = ['currency', 'length', 'mass', 'temperature', 'datediff', 'timezones', 'percentage', 'tip'];
export function favorites() { return load('favs', DEFAULT_FAVS); }
export function isFav(id) { return favorites().includes(id); }
export function setFavorites(list) { save('favs', list); emit('favs'); }
export function toggleFav(id) {
  const f = favorites();
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  setFavorites(f);
  return i < 0;
}
export function recents() { return load('recent', []); }
export function pushRecent(id) {
  const r = recents().filter(x => x !== id);
  r.unshift(id);
  save('recent', r.slice(0, 8));
}
export function clearRecents() { save('recent', []); }

export function toolState(id) { return load('t:' + id, null); }
export function saveToolState(id, st) { save('t:' + id, st); }
export function clearToolState(id) { remove('t:' + id); }
