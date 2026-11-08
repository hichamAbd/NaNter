// Phone sensors: spirit level (motion sensor) and GPS speedometer / altitude.
import { h, icon, toast } from '../core/dom.js';
import { fmt } from '../core/num.js';
import { seg, results } from '../core/ui.js';
import { settings } from '../core/store.js';
import * as D from '../lib/dates.js';
import { haversine, compass } from './travel.js';

const deg = r => r * 180 / Math.PI;
function screenAngle() {
  const a = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((a % 360) + 360) % 360;
}
/** Gravity (device axes, pointing down) → screen axes {sx: right, sy: down, sz}. */
export function toScreen(g, angle) {
  switch (angle) {
    case 90: return { sx: -g.y, sy: -g.x, sz: g.z };
    case 180: return { sx: -g.x, sy: g.y, sz: g.z };
    case 270: return { sx: g.y, sy: g.x, sz: g.z };
    default: return { sx: g.x, sy: -g.y, sz: g.z };
  }
}
/** Tilts in degrees from a screen-space gravity vector. flat: phone lying on its back; edge: standing on a side. */
export function tilts({ sx, sy, sz }) {
  const flat = Math.abs(sz) > Math.hypot(sx, sy);
  return {
    flat,
    x: deg(Math.atan2(sx, Math.abs(sz))), // + = right side lower
    y: deg(Math.atan2(-sy, Math.abs(sz))), // + = top side lower
    edge: (() => { const a = deg(Math.atan2(sx, sy)); return a - Math.round(a / 90) * 90; })(), // deviation from the nearest side, + = clockwise
  };
}

/** Gravity in device axes from the (standardised) orientation angles: W3C Z-X'-Y'' Euler angles. */
export function gravityFromOrientation(beta, gamma) {
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180;
  return { x: Math.sin(g) * Math.cos(b), y: -Math.sin(b), z: -Math.cos(g) * Math.cos(b) };
}
async function askMotion() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      return (await DeviceOrientationEvent.requestPermission()) === 'granted';
    }
    return typeof DeviceOrientationEvent !== 'undefined';
  } catch { return false; }
}

/* ---------- Spirit level ---------- */
function mountLevel(root, ctx) {
  const st = Object.assign({ zx: 0, zy: 0, ze: 0 }, ctx.state || {});
  const save = () => ctx.saveNow(st);
  const bubble = h('div', { class: 'lv-bubble' });
  const circle = h('div', { class: 'lv-circle' }, h('div', { class: 'lv-ring' }), h('div', { class: 'lv-cross h' }), h('div', { class: 'lv-cross v' }), bubble);
  const barBubble = h('div', { class: 'lv-barbubble' });
  const bar = h('div', { class: 'lv-bar' }, h('div', { class: 'lv-mark l' }), h('div', { class: 'lv-mark r' }), barBubble);
  const big = h('div', { class: 'lv-big' }, '—');
  const sub = h('div', { class: 'lv-sub' }, 'Tap Start, then lay the phone on the surface');
  const flatView = h('div', { class: 'lv-view' }, circle);
  const edgeView = h('div', { class: 'lv-view', hidden: true }, bar);
  const startB = h('button', { class: 'btn cat block', type: 'button', onclick: () => start() }, 'Start the level');
  const zeroB = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => { if (!last) return; st.zx = last.x; st.zy = last.y; st.ze = last.edge; save(); toast('Calibrated: this position is now level'); } }, 'Set as zero');
  const resetB = h('button', { class: 'btn ghost', type: 'button', onclick: () => { st.zx = st.zy = st.ze = 0; save(); toast('Calibration reset'); } }, 'Reset');
  const holdB = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => { hold = !hold; holdB.textContent = hold ? 'Release' : 'Hold'; } }, 'Hold');
  const panel = h('div', { class: 'card pad lv' }, big, sub, flatView, edgeView);
  root.append(panel, startB, h('div', { class: 'row-btns', style: { justifyContent: 'center', marginTop: '10px' } }, holdB, zeroB, resetB),
    h('p', { class: 'note' }, 'Lay the phone on its back to level a surface, or stand it on one of its edges (against a shelf or a frame). The camera bump tilts the phone slightly: put it on a flat surface and tap “Set as zero” once. Turn off rotation lock if the screen should follow the phone.'));
  let last = null, hold = false, sm = null, got = false;
  const onOrient = e => {
    if (e.beta == null || e.gamma == null) return;
    got = true;
    if (hold) return;
    const g = gravityFromOrientation(e.beta, e.gamma);
    sm = sm ? { x: sm.x * 0.75 + g.x * 0.25, y: sm.y * 0.75 + g.y * 0.25, z: sm.z * 0.75 + g.z * 0.25 } : g;
    const t = tilts(toScreen(sm, screenAngle()));
    last = t;
    draw(t);
  };
  function draw(t) {
    flatView.hidden = !t.flat; edgeView.hidden = t.flat;
    if (t.flat) {
      const x = t.x - st.zx, y = t.y - st.zy;
      const total = Math.hypot(x, y);
      const k = 6; // px per degree
      const lim = 100;
      let bx = -x * k, by = y * k; // bubble goes to the high side
      const m = Math.hypot(bx, by); if (m > lim) { bx *= lim / m; by *= lim / m; }
      bubble.style.transform = `translate(calc(-50% + ${bx}px), calc(-50% + ${by}px))`;
      const level = total < 0.3;
      panel.classList.toggle('ok', level);
      big.textContent = `${fmt(total, { dec: 1, minDec: 1 })}°`;
      sub.textContent = level ? 'Level ✓' : `Left–right ${fmt(Math.abs(x), { dec: 1, minDec: 1 })}° · front–back ${fmt(Math.abs(y), { dec: 1, minDec: 1 })}°`;
    } else {
      const e = t.edge - st.ze;
      const k = 8, lim = 120;
      const bx = Math.max(-lim, Math.min(lim, -e * k));
      barBubble.style.transform = `translate(calc(-50% + ${bx}px), -50%)`;
      const level = Math.abs(e) < 0.3;
      panel.classList.toggle('ok', level);
      big.textContent = `${fmt(Math.abs(e), { dec: 1, minDec: 1 })}°`;
      sub.textContent = level ? 'Level ✓' : `Slope ${fmt(Math.abs(Math.tan(e * Math.PI / 180) * 100), { dec: 1, minDec: 1 })} % · ${fmt(Math.abs(Math.tan(e * Math.PI / 180) * 1000), { dec: 0 })} mm per metre`;
    }
  }
  function start() {
    if (typeof DeviceOrientationEvent === 'undefined') { toast('No motion sensor on this device'); return; }
    // Listen first: events start flowing as soon as access is granted (iOS asks once).
    window.addEventListener('deviceorientation', onOrient);
    startB.hidden = true; zeroB.disabled = holdB.disabled = false;
    sub.textContent = 'Reading the sensor…';
    askMotion().then(okd => { if (!okd && !got) sub.textContent = 'Motion access was refused. Allow it, then open the level again.'; });
    setTimeout(() => { if (!got) sub.textContent = 'No motion data yet: this needs a phone or tablet (and motion access).'; }, 3000);
  }
  ctx.onCleanup(() => window.removeEventListener('deviceorientation', onOrient));
}

/* ---------- GPS speedometer & altitude ---------- */
function mountSpeedo(root, ctx) {
  const st = Object.assign({ unit: settings.system === 'metric' ? 'kmh' : 'mph' }, ctx.state || {});
  const U = { kmh: [3.6, 'km/h'], mph: [2.2369362921, 'mph'], kn: [1.9438444924, 'kn'], ms: [1, 'm/s'] };
  const speedEl = h('div', { class: 'sp-big' }, '—');
  const unitEl = h('div', { class: 'sp-unit' });
  const statusEl = h('div', { class: 'sp-status' }, 'Tap Start to use GPS');
  const out = results();
  const startB = h('button', { class: 'btn cat', type: 'button', onclick: () => (watch == null ? start() : stop()) }, icon('play'), 'Start');
  const resetB = h('button', { class: 'btn', type: 'button', onclick: () => { trip = newTrip(); render(); } }, 'Reset trip');
  const unitSeg = seg(Object.keys(U).map(k => [k, U[k][1]]), st.unit, v => { st.unit = v; ctx.save(st); render(); });
  root.append(h('div', { class: 'card display sp' }, speedEl, unitEl, statusEl), h('div', { class: 'row-btns', style: { justifyContent: 'center', margin: '4px 0 14px' } }, startB, resetB),
    h('div', { class: 'card form' }, h('div', { class: 'frow seg-row' }, unitSeg)), out,
    h('p', { class: 'note' }, 'Uses your phone’s GPS; works best outdoors with a clear sky. The screen stays on while tracking. Like any web app, tracking pauses when NaNter is in the background. Your position never leaves the phone.'));
  const newTrip = () => ({ dist: 0, max: 0, moving: 0, start: Date.now(), prev: null, fix: null });
  let trip = newTrip(), watch = null, lock = null, speed = null;
  async function wake() { try { lock = await navigator.wakeLock?.request('screen'); } catch { lock = null; } }
  const onVis = () => { if (!document.hidden && watch != null) wake(); };
  document.addEventListener('visibilitychange', onVis);
  function onPos(p) {
    const c = p.coords, t = p.timestamp || Date.now();
    const pt = { lat: c.latitude, lon: c.longitude, t, acc: c.accuracy };
    let v = c.speed != null && c.speed >= 0 && !Number.isNaN(c.speed) ? c.speed : null;
    if (trip.prev) {
      const dt = (t - trip.prev.t) / 1000;
      const d = haversine(trip.prev, pt) * 1000;
      if (v == null && dt > 0.5) v = d / dt;
      // count distance only when the move is larger than the GPS noise
      if (dt > 0 && d > Math.max(3, (pt.acc + trip.prev.acc) * 0.25) && (v ?? 0) > 0.4) { trip.dist += d; trip.moving += dt; trip.prev = pt; }
      else if (dt > 30) trip.prev = pt;
    } else trip.prev = pt;
    if (v != null) { speed = speed == null ? v : speed * 0.4 + v * 0.6; if (v < 0.3) speed = 0; trip.max = Math.max(trip.max, speed); }
    trip.fix = { alt: c.altitude, altAcc: c.altitudeAccuracy, acc: c.accuracy, heading: c.heading, at: t };
    render();
  }
  function onErr(e) { statusEl.textContent = e.code === 1 ? 'Location permission denied: allow it in Settings › Privacy › Location Services › Safari Websites' : 'Waiting for GPS…'; }
  function start() {
    if (!navigator.geolocation) { toast('No GPS on this device'); return; }
    watch = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    statusEl.textContent = 'Searching for GPS…';
    startB.replaceChildren(icon('pause'), 'Pause');
    wake();
  }
  function stop() {
    if (watch != null) navigator.geolocation.clearWatch(watch);
    watch = null; speed = null;
    lock?.release?.(); lock = null;
    startB.replaceChildren(icon('play'), 'Start');
    statusEl.textContent = 'Paused';
    render();
  }
  function render() {
    const [k, label] = U[st.unit];
    unitEl.textContent = label;
    speedEl.textContent = speed == null ? '—' : fmt(speed * k, { dec: speed * k < 10 ? 1 : 0 });
    const f = trip.fix;
    if (f && watch != null) statusEl.textContent = `GPS accuracy ± ${fmt(f.acc, { dec: 0 })} m`;
    const metric = settings.system === 'metric';
    const dist = metric ? `${fmt(trip.dist / 1000, { dec: 2 })} km` : `${fmt(trip.dist / 1609.344, { dec: 2 })} mi`;
    const items = [
      { k: 'Trip distance', v: dist, nocopy: true },
      { k: 'Max speed', v: `${fmt(trip.max * k, { dec: 1 })} ${label}`, nocopy: true },
      { k: 'Average moving speed', v: trip.moving > 0 ? `${fmt(trip.dist / trip.moving * k, { dec: 1 })} ${label}` : '—', nocopy: true },
      { k: 'Moving time', v: D.hhmmss(trip.moving), nocopy: true },
    ];
    if (f) {
      items.push(
        { k: 'Altitude', v: f.alt != null ? (metric ? `${fmt(f.alt, { dec: 0 })} m` : `${fmt(f.alt / 0.3048, { dec: 0 })} ft`) : 'not available', sub: f.altAcc != null ? `± ${fmt(metric ? f.altAcc : f.altAcc / 0.3048, { dec: 0 })} ${metric ? 'm' : 'ft'}` : null, nocopy: true },
        { k: 'Heading', v: f.heading != null && !Number.isNaN(f.heading) && (speed ?? 0) > 1 ? `${fmt(f.heading, { dec: 0 })}° ${compass(f.heading)}` : '—', sub: 'Direction of travel (when moving)', nocopy: true },
      );
    }
    out.render(items);
  }
  ctx.onCleanup(() => { if (watch != null) navigator.geolocation.clearWatch(watch); lock?.release?.(); document.removeEventListener('visibilitychange', onVis); });
  render();
}

export const tools = { level: { mount: mountLevel }, speedo: { mount: mountSpeedo } };
