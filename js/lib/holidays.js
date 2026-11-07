// Public holidays from Nager.Date (free, no key), cached per country and year for offline use.
import { load, save } from '../core/store.js';

const mem = new Map();
/** Nationwide public holidays for a year: [{date, name, localName}] (regional ones excluded). */
export async function holidays(cc, year) {
  const key = `hol:${cc}:${year}`;
  if (mem.has(key)) return mem.get(key);
  const cached = load(key, null);
  if (cached) { mem.set(key, cached); return cached; }
  const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
  if (r.status === 404 || r.status === 204) { mem.set(key, []); return []; }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const list = j.filter(x => x.global !== false && (x.types || ['Public']).includes('Public')).map(x => ({ date: x.date, name: x.name, localName: x.localName }));
  mem.set(key, list);
  save(key, list);
  return list;
}
/** Holidays for every year in [a, b] as a Set of ISO dates plus the list. Fails soft (empty). */
export async function holidaySet(cc, fromISO, toISO) {
  let y1 = +fromISO.slice(0, 4), y2 = +toISO.slice(0, 4);
  if (y2 < y1) [y1, y2] = [y2, y1];
  if (y2 - y1 > 30) return { set: new Set(), list: [], error: 'Range too long for holidays' };
  const list = [];
  try {
    const all = await Promise.all(Array.from({ length: y2 - y1 + 1 }, (_, i) => holidays(cc, y1 + i)));
    all.flat().forEach(x => list.push(x));
    return { set: new Set(list.map(x => x.date)), list };
  } catch (e) { return { set: new Set(), list: [], error: navigator.onLine ? 'Holidays unavailable' : 'Offline: holidays not loaded' }; }
}
