// Time zones with Intl only: offsets, wall time ↔ instant (DST-safe), labels.
import { safeZone, CITIES, flag } from '../data/geo.js';

const dtf = new Map();
function partsFmt(tz) {
  if (!dtf.has(tz)) dtf.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  return dtf.get(tz);
}
/** Wall-clock parts of an instant in a zone. */
export function wall(ms, tz) {
  const p = {};
  for (const x of partsFmt(tz).formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = +x.value;
  if (p.hour === 24) p.hour = 0;
  return p; // year month day hour minute second
}
/** Offset of the zone from UTC at an instant, in minutes (Paris summer = +120). */
export function offsetMin(tz, ms = Date.now()) {
  const p = wall(ms, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}
/** Instant for a wall-clock time in a zone (picks the later one on DST overlaps). */
export function instantOf(tz, y, mo, d, hh = 0, mm = 0, ss = 0) {
  const guess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  let t = guess - offsetMin(tz, guess) * 60000;
  t = guess - offsetMin(tz, t) * 60000;
  return t;
}
export function offsetLabel(min) {
  const s = min < 0 ? '−' : '+'; const a = Math.abs(min);
  const hh = Math.floor(a / 60), mm = a % 60;
  return `UTC${min === 0 ? '+0' : s + hh + (mm ? ':' + String(mm).padStart(2, '0') : '')}`;
}
export function diffLabel(min) {
  if (!min) return 'same time';
  const s = min > 0 ? '+' : '−'; const a = Math.abs(min);
  const hh = Math.floor(a / 60), mm = a % 60;
  return `${s}${hh}${mm ? ':' + String(mm).padStart(2, '0') : ''} h`;
}
const abbrCache = new Map();
export function zoneAbbr(tz, ms = Date.now()) {
  const key = tz + Math.floor(ms / 36e5);
  if (abbrCache.has(key)) return abbrCache.get(key);
  let a = '';
  try { a = new Intl.DateTimeFormat('en-US', { timeZone: safeZone(tz), timeZoneName: 'short' }).formatToParts(new Date(ms)).find(p => p.type === 'timeZoneName')?.value || ''; } catch { }
  if (/^GMT[+-]/.test(a)) a = '';
  abbrCache.set(key, a);
  return a;
}
export function fmtTime(ms, tz, hour12, withSec = false) {
  return new Date(ms).toLocaleTimeString(undefined, { timeZone: safeZone(tz), hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', second: withSec ? '2-digit' : undefined, hour12: !!hour12 });
}
export function fmtDay(ms, tz) {
  return new Date(ms).toLocaleDateString(undefined, { timeZone: safeZone(tz), weekday: 'short', day: 'numeric', month: 'short' });
}
export function isDST(tz, ms = Date.now()) {
  const y = new Date(ms).getUTCFullYear();
  const jan = offsetMin(tz, Date.UTC(y, 0, 1)), jul = offsetMin(tz, Date.UTC(y, 6, 1));
  return jan !== jul && offsetMin(tz, ms) === Math.max(jan, jul);
}

/** Zone search entries: cities first, then every IANA zone. */
let ALL;
export function zoneEntries() {
  if (ALL) return ALL;
  const seen = new Set();
  ALL = CITIES.map(c => ({ id: c.tz + '|' + c.name, tz: c.tz, name: c.name, cc: c.cc, flag: flag(c.cc), al: c.al }));
  ALL.forEach(e => seen.add(e.tz));
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { }
  for (const z of zones) if (!seen.has(z)) ALL.push({ id: z + '|', tz: z, name: z.split('/').pop().replace(/_/g, ' '), region: z.split('/')[0], cc: '', flag: '🌐', al: [] });
  ALL.push({ id: 'UTC|UTC', tz: 'UTC', name: 'UTC', cc: '', flag: '🌐', al: ['gmt', 'zulu', 'coordinated universal time'] });
  return ALL;
}
export function cityName(e) { return e.name; }
