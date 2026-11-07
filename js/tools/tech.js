// Tech: download time, colour converter, Ohm's law, battery, text counter.
import { h, copyText } from '../core/dom.js';
import { parseNum, fmt } from '../core/num.js';
import { numField, seg, selectEl, row, results, chips } from '../core/ui.js';
import { mountSolver } from '../core/solver.js';
import { ok, okPos } from '../core/form.js';
import { unitsOf } from '../data/units.js';
import * as D from '../lib/dates.js';

/* ---------- Download time ---------- */
const sub = (cat, ids) => unitsOf(cat).filter(u => ids.includes(u.id));
function mountDownload(root, ctx) {
  mountSolver(root, ctx, {
    vars: [
      { id: 's', label: 'File size', units: sub('data', ['MB', 'GB', 'TB', 'kB', 'MiB', 'GiB']), unit: 'GB', presets: [[7e8, '700 MB', 'MB'], [4.7e9, 'DVD', 'GB'], [5e10, '50 GB', 'GB'], [1e11, '100 GB game', 'GB']] },
      { id: 'v', label: 'Connection speed', units: sub('datarate', ['Mbps', 'Gbps', 'kbps', 'MBps', 'kBps']), unit: 'Mbps', presets: [[2e7, '4G 20', 'Mbps'], [1e8, '100 Mb', 'Mbps'], [5e8, '500 Mb', 'Mbps'], [1e9, 'Fibre 1 Gb', 'Gbps']] },
      { id: 't', label: 'Time', units: [unitsOf('time').find(u => u.id === 'hms')] },
    ],
    defaults: { known: ['s', 'v'], vals: { s: 5e10, v: 1e8 } },
    solve(k) {
      if ('s' in k && 'v' in k) return { t: k.s * 8 / k.v };
      if ('s' in k && 't' in k) return { v: k.s * 8 / k.t };
      return { s: k.v * k.t / 8 };
    },
    extra(v) {
      return [
        { k: 'Download time', v: D.hmText(v.t, { seconds: v.t < 3600, days: v.t >= 86400 }), big: true, sub: `${fmt(v.v / 8e6, { maxDec: 2 })} MB/s at full speed` },
        { k: 'With 10 % overhead', v: D.hmText(v.t / 0.9, { seconds: v.t < 3600, days: v.t >= 86400 }), sub: 'Typical real-world Wi-Fi / protocol losses' },
      ];
    },
  });
  root.append(h('p', { class: 'note' }, 'Internet speeds are in megabits; file sizes in megabytes (8 bits = 1 byte). A 100 Mbit/s line downloads at most 12.5 MB per second.'));
}

/* ---------- Ohm's law ---------- */
const U = (id, sym, f) => ({ id, name: sym, sym, f, toBase: x => x * f, fromBase: b => b / f });
const VU = [U('mV', 'mV', 1e-3), U('V', 'V', 1), U('kV', 'kV', 1e3)];
const IU = [U('uA', 'µA', 1e-6), U('mA', 'mA', 1e-3), U('A', 'A', 1)];
const RU = [U('ohm', 'Ω', 1), U('kohm', 'kΩ', 1e3), U('Mohm', 'MΩ', 1e6)];
const PU = [U('mW', 'mW', 1e-3), U('W', 'W', 1), U('kW', 'kW', 1e3)];
function mountOhm(root, ctx) {
  mountSolver(root, ctx, {
    vars: [
      { id: 'V', label: 'Voltage', units: VU, unit: 'V' },
      { id: 'I', label: 'Current', units: IU, unit: 'A' },
      { id: 'R', label: 'Resistance', units: RU, unit: 'ohm' },
      { id: 'P', label: 'Power', units: PU, unit: 'W' },
    ],
    defaults: { known: ['V', 'R'], vals: { V: 230, R: 52.9 } },
    solve(k) {
      const { V, I, R, P } = k;
      if (V != null && I != null) return { R: V / I, P: V * I };
      if (V != null && R != null) return { I: V / R, P: V * V / R };
      if (V != null && P != null) return { I: P / V, R: V * V / P };
      if (I != null && R != null) return { V: I * R, P: I * I * R };
      if (I != null && P != null) return { V: P / I, R: P / (I * I) };
      return { V: Math.sqrt(P * R), I: Math.sqrt(P / R) };
    },
    extra(v) {
      return [
        { k: 'V = I × R', v: `${fmt(v.V)} V = ${fmt(v.I)} A × ${fmt(v.R)} Ω`, big: true },
        { k: 'Power', v: `${fmt(v.P)} W`, sub: `${fmt(v.P / 1000 * 24, { maxDec: 3 })} kWh per day if always on` },
      ];
    },
  });
  root.append(h('p', { class: 'note' }, 'For DC circuits and resistive AC loads (heaters, kettles). Motors and electronics have a power factor below 1.'));
}

/* ---------- Battery ---------- */
const battery = {
  fields: [
    { id: 'cap', type: 'num', label: 'Capacity', default: '10000' },
    { id: 'cu', type: 'seg', options: [['mah', 'mAh'], ['ah', 'Ah'], ['wh', 'Wh']], default: 'mah' },
    { id: 'v', type: 'num', label: 'Voltage', suffix: 'V', default: '3.7', presets: [[1.2, 'NiMH 1.2'], [1.5, 'AA 1.5'], [3.7, 'Li-ion 3.7'], [5, 'USB 5'], [12, 'Car 12'], [48, '48']] },
    { id: 'load', type: 'num', label: 'Device power', hint: 'optional, for runtime', suffix: 'W', placeholder: 'e.g. 10', default: '' },
    { id: 'eff', type: 'pct', label: 'Efficiency', hint: 'power banks ≈ 85 %', default: '85' },
    { id: 'phone', type: 'num', label: 'Phone battery', hint: 'optional, to count charges', suffix: 'mAh', placeholder: 'e.g. 4000', default: '' },
  ],
  compute(v) {
    if (!okPos(v.cap) || !okPos(v.v)) return [{ note: 'Enter the capacity and the voltage.' }];
    const wh = v.cu === 'wh' ? v.cap : v.cu === 'ah' ? v.cap * v.v : v.cap / 1000 * v.v;
    const mah = wh / v.v * 1000;
    const eff = ok(v.eff) ? v.eff / 100 : 1;
    const items = [
      { k: 'Energy', v: `${fmt(wh, { maxDec: 2 })} Wh`, big: true, sub: wh <= 100 ? 'OK in cabin baggage (under 100 Wh)' : wh <= 160 ? 'Needs airline approval (100–160 Wh)' : 'Not allowed on passenger planes (over 160 Wh)', tone: wh <= 100 ? 'good' : wh <= 160 ? 'warn' : 'bad' },
      { k: `Capacity at ${fmt(v.v)} V`, v: `${fmt(mah, { maxDec: 0 })} mAh` },
      { k: 'Equivalent at 5 V (USB)', v: `${fmt(wh / 5 * 1000 * eff, { maxDec: 0 })} mAh`, sub: `after ${fmt(eff * 100)} % efficiency` },
    ];
    if (okPos(v.load)) items.push({ k: `Runtime at ${fmt(v.load)} W`, v: D.hmText(wh * eff / v.load * 3600) });
    if (okPos(v.phone)) items.push({ k: 'Phone charges', v: fmt(wh * eff / (v.phone / 1000 * 3.85), { maxDec: 1 }), sub: `for a ${fmt(v.phone)} mAh phone battery (3.85 V)` });
    return items;
  },
};

/* ---------- Colour ---------- */
let cvs;
export function parseColor(s) {
  s = String(s || '').trim();
  if (!s) return null;
  if (/^[0-9a-f]{3,8}$/i.test(s)) s = '#' + s;
  if (/^\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}$/.test(s)) s = `rgb(${s.split(/[\s,]+/).join(',')})`;
  cvs ||= document.createElement('canvas').getContext('2d');
  cvs.fillStyle = '#010203'; cvs.fillStyle = s;
  const v = cvs.fillStyle;
  if (v === '#010203' && !/^#?010203$/i.test(s) && !/rgb\(\s*1\s*,\s*2\s*,\s*3\s*\)/.test(s)) return null;
  let r, g, b, a = 1;
  if (v.startsWith('#')) { r = parseInt(v.slice(1, 3), 16); g = parseInt(v.slice(3, 5), 16); b = parseInt(v.slice(5, 7), 16); }
  else { const m = v.match(/[\d.]+/g).map(Number); [r, g, b] = m; a = m[3] ?? 1; }
  return { r, g, b, a };
}
const hex2 = n => Math.round(n).toString(16).padStart(2, '0');
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; } return [hh, s * 100, l * 100]; }
function rgbToHsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0; if (d) hh = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; return [hh, mx ? d / mx * 100 : 0, mx * 100]; }
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function oklch({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.hypot(A, Bb); let H = Math.atan2(Bb, A) * 180 / Math.PI; if (H < 0) H += 360;
  return [L * 100, C, H];
}
function mix(c, t, k) { return { r: c.r + (t.r - c.r) * k, g: c.g + (t.g - c.g) * k, b: c.b + (t.b - c.b) * k }; }
const toHex = c => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b);
function mountColor(root, ctx) {
  const st = Object.assign({ c: '#4f46e5' }, ctx.state || {});
  const sw = h('div', { class: 'swatch' });
  const pick = h('input', { type: 'color', class: 'color-in', 'aria-label': 'Pick a colour' });
  const txt = h('input', { class: 'text-in', type: 'text', value: st.c, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '#4f46e5, rgb(…), hsl(…), red', 'aria-label': 'Colour' });
  const out = results();
  const shades = h('div', { class: 'shades' });
  root.append(sw, h('div', { class: 'card form' }, h('div', { class: 'frow nolabel' }, h('div', { class: 'color-row' }, pick, txt))), out, h('h3', { class: 'sec-title' }, 'Tints & shades'), shades,
    h('p', { class: 'note' }, 'Accepts HEX, rgb(), hsl(), hwb(), oklch() and the 148 CSS colour names. Tap any value to copy it.'));
  txt.addEventListener('input', () => { st.c = txt.value; upd(); });
  pick.addEventListener('input', () => { st.c = pick.value; txt.value = pick.value; upd(); });
  function upd() {
    ctx.save(st);
    const c = parseColor(st.c);
    txt.classList.toggle('bad', !c && !!st.c);
    if (!c) { out.render([{ note: 'Type a colour.' }]); return; }
    const hex = toHex(c);
    pick.value = hex;
    const [hh, s, l] = rgbToHsl(c.r, c.g, c.b), [hv, sv, vv] = rgbToHsv(c.r, c.g, c.b);
    const k = 1 - Math.max(c.r, c.g, c.b) / 255;
    const cmyk = k === 1 ? [0, 0, 0, 100] : [(1 - c.r / 255 - k) / (1 - k), (1 - c.g / 255 - k) / (1 - k), (1 - c.b / 255 - k) / (1 - k), k].map((x, i) => (i < 3 ? x * 100 : x * 100));
    const ok1 = oklch(c);
    const white = contrast(c, { r: 255, g: 255, b: 255 }), black = contrast(c, { r: 0, g: 0, b: 0 });
    sw.style.background = hex; sw.style.color = white >= black ? '#fff' : '#000'; sw.textContent = hex.toUpperCase();
    const grade = x => (x >= 7 ? 'AAA' : x >= 4.5 ? 'AA' : x >= 3 ? 'AA large' : 'fail');
    const R0 = n => Math.round(n);
    out.render([
      { k: 'HEX', v: hex.toUpperCase() + (c.a < 1 ? hex2(c.a * 255).toUpperCase() : '') },
      { k: 'RGB', v: `rgb(${R0(c.r)}, ${R0(c.g)}, ${R0(c.b)}${c.a < 1 ? ', ' + fmt(c.a, { maxDec: 2 }) : ''})` },
      { k: 'HSL', v: `hsl(${R0(hh)}, ${R0(s)}%, ${R0(l)}%)` },
      { k: 'HSV / HSB', v: `${R0(hv)}°, ${R0(sv)}%, ${R0(vv)}%` },
      { k: 'CMYK', v: cmyk.map(x => R0(x) + '%').join(', ') },
      { k: 'OKLCH', v: `oklch(${fmt(ok1[0], { maxDec: 1 })}% ${fmt(ok1[1], { maxDec: 3 })} ${fmt(ok1[2], { maxDec: 1 })})` },
      { k: 'Contrast with white', v: `${fmt(white, { maxDec: 2 })} : 1`, sub: grade(white), tone: white >= 4.5 ? 'good' : white >= 3 ? 'warn' : 'bad' },
      { k: 'Contrast with black', v: `${fmt(black, { maxDec: 2 })} : 1`, sub: grade(black), tone: black >= 4.5 ? 'good' : black >= 3 ? 'warn' : 'bad' },
    ]);
    const W = { r: 255, g: 255, b: 255 }, B = { r: 0, g: 0, b: 0 };
    const list = [0.8, 0.6, 0.4, 0.2].map(x => mix(c, W, x)).concat([c], [0.2, 0.4, 0.6, 0.8].map(x => mix(c, B, x)));
    shades.replaceChildren(...list.map(x => { const hx = toHex(x); return h('button', { class: 'shade', type: 'button', style: { background: hx }, 'aria-label': hx, onclick: () => copyText(hx.toUpperCase()) }); }));
  }
  upd();
}

/* ---------- Text counter ---------- */
function mountText(root, ctx) {
  const st = Object.assign({ t: '' }, ctx.state || {});
  const ta = h('textarea', { class: 'text-area', rows: 9, placeholder: 'Paste or type your text…', 'aria-label': 'Text' }); ta.value = st.t;
  const out = results();
  const clear = h('button', { class: 'btn ghost', type: 'button', onclick: () => { ta.value = ''; st.t = ''; upd(); ta.focus(); } }, 'Clear');
  root.append(h('div', { class: 'card pad' }, ta, h('div', { class: 'row-btns' }, clear)), out);
  ta.addEventListener('input', () => { st.t = ta.value; upd(); });
  function upd() {
    ctx.save(st);
    const t = st.t;
    const words = t.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
    const chars = [...t].length, noSpace = [...t.replace(/\s/g, '')].length;
    const sentences = (t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).filter(s => /[\p{L}\p{N}]/u.test(s)).length;
    const paras = t.split(/\n\s*\n/).filter(p => p.trim()).length;
    const lines = t ? t.split('\n').length : 0;
    const bytes = new TextEncoder().encode(t).length;
    const freq = new Map();
    words.forEach(w => { const k = w.toLowerCase(); if (k.length > 3) freq.set(k, (freq.get(k) || 0) + 1); });
    const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 5).filter(x => x[1] > 1);
    const mins = n => (n < 1 ? `${Math.max(1, Math.round(n * 60))} s` : `${fmt(n, { maxDec: 1 })} min`);
    out.render([
      { k: 'Words', v: fmt(words.length, { dec: 0 }), big: true, sub: `${fmt(chars, { dec: 0 })} characters` },
      { k: 'Characters', v: fmt(chars, { dec: 0 }), sub: `${fmt(noSpace, { dec: 0 })} without spaces` },
      { k: 'Sentences', v: fmt(sentences, { dec: 0 }) },
      { k: 'Paragraphs', v: fmt(paras, { dec: 0 }) },
      { k: 'Lines', v: fmt(lines, { dec: 0 }) },
      { k: 'Reading time', v: mins(words.length / 238), sub: '238 words per minute' },
      { k: 'Speaking time', v: mins(words.length / 140), sub: '140 words per minute' },
      { k: 'Size (UTF-8)', v: `${fmt(bytes, { dec: 0 })} bytes` },
      { k: 'Fits in an SMS', v: chars <= 160 ? 'Yes (1 SMS)' : `${Math.ceil(chars / 153)} SMS`, sub: '160 characters, 153 per part when split' },
      { k: 'Fits in a post on X', v: chars <= 280 ? `Yes (${280 - chars} left)` : `No (${chars - 280} too many)` },
      top.length ? { k: 'Most used words', v: top.map(([w, n]) => `${w} ×${n}`).join(', '), stack: true } : null,
    ]);
  }
  upd();
}

export const tools = { download: { mount: mountDownload }, ohm: { mount: mountOhm }, battery, color: { mount: mountColor }, text: { mount: mountText } };
void seg; void selectEl; void chips; void row; void parseNum; void numField;
