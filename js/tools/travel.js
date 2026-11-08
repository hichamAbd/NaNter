// Distance between two places (great circle), heading, flight time and time difference.
import { h, icon, openSheet, norm, toast } from '../core/dom.js';
import { fmt } from '../core/num.js';
import { results } from '../core/ui.js';
import { settings } from '../core/store.js';
import { CITIES, countryName, flag } from '../data/geo.js';
import { offsetMin, diffLabel, fmtTime } from '../lib/tz.js';

const R = 6371.0088; // mean Earth radius, km
const rad = Math.PI / 180;
export function haversine(a, b) {
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
export function bearing(a, b) {
  const p1 = a.lat * rad, p2 = b.lat * rad, dl = (b.lon - a.lon) * rad;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
export const compass = deg => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16];
/** Typical airliner: ~30 min for take-off and landing + cruise at ~850 km/h. */
export const flightMinutes = km => (km < 150 ? null : Math.round(30 + km / 850 * 60));
export function findCity(q) {
  const n = norm(q);
  if (!n) return null;
  return CITIES.find(c => norm(c.name) === n) || CITIES.find(c => c.al.some(a => norm(a) === n)) || null;
}
export const cityPoint = c => ({ name: c.name, cc: c.cc, lat: c.lat, lon: c.lon, tz: c.tz });

function pickPlace(title, onPick) {
  const input = h('input', { class: 'search-in', type: 'search', placeholder: 'City, country, or “48.85, 2.35”', autocomplete: 'off', 'aria-label': 'Search a place' });
  const list = h('div');
  const draw = () => {
    const raw = input.value.trim();
    const m = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/.exec(raw);
    const items = [];
    if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) {
      items.push(h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); onPick({ name: `${(+m[1]).toFixed(3)}, ${(+m[2]).toFixed(3)}`, lat: +m[1], lon: +m[2], tz: null }); } },
        h('span', { class: 'flag' }, '📍'), h('span', { class: 'p-main' }, h('b', null, 'These coordinates'), h('small', null, `${m[1]}, ${m[2]}`))));
    }
    const q = norm(raw);
    const hits = CITIES.filter(c => !q || norm(c.name).includes(q) || norm(countryName(c.cc)).includes(q) || c.al.some(a => norm(a).includes(q))).slice(0, 80);
    items.push(...hits.map(c => h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); onPick(cityPoint(c)); } },
      h('span', { class: 'flag' }, flag(c.cc)), h('span', { class: 'p-main' }, h('b', null, c.name), h('small', null, countryName(c.cc))))));
    list.replaceChildren(h('div', { class: 'pick-list' }, items));
  };
  input.addEventListener('input', draw);
  draw();
  const s = openSheet({ title, body: h('div', null, h('div', { class: 'search-box' }, icon('search'), input), list) });
}

function mount(root, ctx) {
  const home = CITIES.find(c => c.tz === (Intl.DateTimeFormat().resolvedOptions().timeZone || '')) || CITIES.find(c => c.name === 'Paris');
  const st = Object.assign({ a: cityPoint(home), b: cityPoint(CITIES.find(c => c.name === (home.name === 'New York' ? 'London' : 'New York'))) }, ctx.state || {});
  if (ctx.params?.a) { const c = findCity(ctx.params.a); if (c) st.a = cityPoint(c); }
  if (ctx.params?.b) { const c = findCity(ctx.params.b); if (c) st.b = cityPoint(c); }
  const save = () => ctx.save(st);
  const btn = k => {
    const b = h('button', { class: 'cur-btn', type: 'button', onclick: () => pickPlace(k === 'a' ? 'From' : 'To', p => { st[k] = p; draw(); }) });
    b.set = p => b.replaceChildren(h('span', { class: 'flag' }, p.cc ? flag(p.cc) : '📍'), h('span', null, h('b', null, p.name), h('small', null, p.cc ? countryName(p.cc) : `${fmt(p.lat, { maxDec: 3 })}, ${fmt(p.lon, { maxDec: 3 })}`)), icon('down'));
    return b;
  };
  const aB = btn('a'), bB = btn('b');
  const swap = h('button', { class: 'swap-btn h', type: 'button', 'aria-label': 'Swap', onclick: () => { [st.a, st.b] = [st.b, st.a]; draw(); } }, icon('swapH'));
  const geo = h('button', { class: 'btn ghost', type: 'button', onclick: () => {
    if (!navigator.geolocation) return toast('Location not available');
    navigator.geolocation.getCurrentPosition(p => { st.a = { name: 'My location', lat: p.coords.latitude, lon: p.coords.longitude, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }; draw(); },
      () => toast('Location permission denied'), { timeout: 10000, maximumAge: 6e5 });
  } }, icon('location'), 'From my location');
  const out = results();
  root.append(h('div', { class: 'pair' }, aB, swap, bB), h('div', { class: 'row-btns', style: { justifyContent: 'flex-start', marginTop: '-6px', marginBottom: '8px' } }, geo), out,
    h('p', { class: 'note' }, 'Straight-line (great-circle) distance, the shortest path over the Earth’s surface. Roads are usually 20–40 % longer; flight time assumes a direct flight.'));
  function draw() {
    save();
    aB.set(st.a); bB.set(st.b);
    const km = haversine(st.a, st.b);
    const brg = bearing(st.a, st.b);
    const metric = settings.system === 'metric';
    const fm = flightMinutes(km);
    const items = [
      { k: `${st.a.name} → ${st.b.name}`, v: metric ? `${fmt(km, { maxDec: 0 })} km` : `${fmt(km / 1.609344, { maxDec: 0 })} mi`, big: true, sub: metric ? `${fmt(km / 1.609344, { maxDec: 0 })} miles` : `${fmt(km, { maxDec: 0 })} km` },
      fm ? { k: 'Flight time (direct)', v: `≈ ${Math.floor(fm / 60)} h ${String(fm % 60).padStart(2, '0')}`, sub: 'Typical airliner incl. take-off and landing' } : { k: 'Flight', v: 'Too close to fly' },
      { k: 'Nautical miles', v: fmt(km / 1.852, { maxDec: 0 }) },
      { k: 'Initial heading', v: `${fmt(brg, { maxDec: 0 })}° ${compass(brg)}`, sub: 'Direction to set off in from the first place' },
    ];
    if (st.a.tz && st.b.tz) {
      const now = Date.now();
      const d = offsetMin(st.b.tz, now) - offsetMin(st.a.tz, now);
      items.push({ k: 'Time difference', v: d ? diffLabel(d) : 'Same time', sub: `Now: ${fmtTime(now, st.a.tz, settings.hour12)} in ${st.a.name}, ${fmtTime(now, st.b.tz, settings.hour12)} in ${st.b.name}` });
    }
    out.render(items);
  }
  draw();
}

export const tools = { citydist: { mount } };
