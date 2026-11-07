// Unit converters: every row is editable. Type in any unit and all the others update.
import { h, icon, copyText } from '../core/dom.js';
import { parseNum, fmt, fmtFixed, fractionText, currencySymbol } from '../core/num.js';
import { numField, selectEl, chips, splitParts, joinParts } from '../core/ui.js';
import { CATEGORIES, localName } from '../data/units.js';
import { settings } from '../core/store.js';

// [metric unit, value, US unit, value, UK unit, value]
const DEF = {
  length: ['m', 1, 'ft', 1, 'm', 1], mass: ['kg', 1, 'lb', 1, 'kg', 1], temperature: ['C', 20, 'F', 68, 'C', 20],
  volume: ['l', 1, 'gal', 1, 'l', 1], area: ['m2', 1, 'ft2', 1, 'm2', 1], speed: ['kmh', 100, 'mph', 60, 'mph', 60],
  time: ['h', 1, 'h', 1, 'h', 1], pressure: ['bar', 1, 'psi', 30, 'bar', 1], energy: ['kcal', 1, 'kcal', 1, 'kcal', 1],
  power: ['kw', 1, 'hp', 1, 'kw', 1], force: ['n', 1, 'lbf', 1, 'n', 1], torque: ['nm', 1, 'lbfft', 1, 'nm', 1],
  angle: ['deg', 90, 'deg', 90, 'deg', 90], frequency: ['hz', 1, 'hz', 1, 'hz', 1], fuel: ['l100', 6, 'mpg', 30, 'mpguk', 45],
  ev: ['kwh100', 16, 'mikwh', 4, 'mikwh', 4], density: ['gcm3', 1, 'lbft3', 62.4, 'gcm3', 1], flow: ['lmin', 10, 'gpm', 5, 'lmin', 10],
  acceleration: ['g0', 1, 'g0', 1, 'g0', 1], light: ['lx', 500, 'fc', 50, 'lx', 500], data: ['GB', 1, 'GB', 1, 'GB', 1],
  datarate: ['Mbps', 100, 'Mbps', 100, 'Mbps', 100], numbers: ['billion', 1, 'billion', 1, 'billion', 1], css: ['px', 16, 'px', 16, 'px', 16],
  salary: ['month', 2500, 'year', 60000, 'year', 35000], oven: ['c', 180, 'f', 350, 'c', 180], shoes: ['eu', 42, 'usm', 9, 'uk', 8],
  rings: ['circ', 54, 'us', 7, 'uk', 13.5], wire: ['awg', 12, 'awg', 12, 'awg', 12],
};
const BLOOD_DEF = { glucose: ['mmol', 5.5, 'mgdl', 100], a1c: ['pct', 6, 'pct', 6], chol: ['mmol', 5, 'mgdl', 190], tg: ['mmol', 1.7, 'mgdl', 150], creat: ['umol', 80, 'mgdl', 0.9], vitd: ['nmol', 75, 'ngml', 30] };

const NOTES = {
  temperature: 'Water freezes at 0 °C / 32 °F and boils at 100 °C / 212 °F. Normal body temperature ≈ 37 °C / 98.6 °F.',
  time: 'Month = 30.44 days and year = 365.24 days (Gregorian averages). For calendar dates use Date difference.',
  fuel: 'L/100 km: lower is better. mpg and km/L: higher is better. US and UK gallons differ (3.79 L vs 4.55 L).',
  ev: 'kWh/100 km and Wh/mi: lower is better. km/kWh and mi/kWh: higher is better.',
  energy: 'Food “Calories” on labels are kilocalories (kcal).',
  power: 'PS / CV / ch is the metric horsepower used in Europe; hp is the mechanical (imperial) one.',
  pressure: 'Tire pressure: 2.2 bar ≈ 32 psi. Weather pressure is usually in hPa (= mbar).',
  numbers: 'In French, German and most of Europe 10⁹ is a “milliard” and 10¹² a “billion” (long scale). In English a billion is 10⁹.',
  data: 'kB, MB, GB use powers of 1000 (drive makers, macOS). KiB, MiB, GiB use 1024 (what Windows calls “GB”).',
  datarate: 'Internet plans are in megabits (Mbit/s); downloads show megabytes (MB/s). 1 MB/s = 8 Mbit/s.',
  css: 'CSS assumes 96 px per inch. Set density to 300 dpi to work out print sizes.',
  salary: 'Gross amounts. Change hours, days and weeks to match your contract (35 h is the French legal week).',
  oven: 'Fan (convection) ovens cook hotter: use about 20 °C less. French thermostat: Th × 30 = °C.',
  shoes: 'Sizes vary between brands. For the best match, measure your foot from heel to longest toe.',
  rings: 'Measure the inside diameter of a ring that fits, or wrap a paper strip around your finger and measure its length (circumference).',
  wire: 'Smaller AWG numbers are thicker wires. Each step of 6 AWG halves the diameter.',
  blood: 'Unit conversions only. Ask a health professional what your values mean.',
  angle: 'Slope: 100 % = 45°. Degrees + minutes + seconds is the GPS format (48° 51′ 24″).',
  light: 'Typical: office 300–500 lx, overcast day 1 000 lx, direct sun 100 000 lx.',
  speed: 'Pace rows (min/km, min/mi) are how runners measure speed.',
  length: 'Tap a unit name to copy its value.',
};

function sysIdx() { return settings.system === 'metric' ? 0 : settings.system === 'us' ? 1 : 2; }

export function mountUnits(root, ctx, catId) {
  const cat = CATEGORIES[catId];
  const st = Object.assign({ more: false, p: {} }, ctx.state || {});
  if (ctx.params?.u) { st.u = ctx.params.u; st.v = ctx.params.v; }
  const groupIds = cat.groups ? Object.keys(cat.groups) : null;
  if (groupIds && !groupIds.includes(st.g)) st.g = groupIds[0];
  (cat.params || []).forEach(p => { if (st.p[p.id] == null) st.p[p.id] = String(p.def); });
  if (catId === 'salary' && st.p.hpw == null) st.p.hpw = settings.country === 'FR' ? '35' : '40';

  const paramVals = () => Object.fromEntries((cat.params || []).map(p => { const n = parseNum(st.p[p.id]); return [p.id, Number.isFinite(n) && n > 0 ? n : p.def]; }));
  const money = !!cat.money;
  const curSym = money ? currencySymbol(settings.currency) : '';

  // ---- group switcher (blood values) ----
  if (groupIds) {
    const gc = chips(groupIds.map(g => [g, cat.groups[g].name]), g => { st.g = g; gc.mark(g); draw(); save(); }, { cls: 'scroll group-chips', active: st.g });
    root.append(gc);
  }
  // ---- params ----
  if (cat.params) {
    const pc = h('div', { class: 'card params' });
    for (const p of cat.params) {
      const f = numField({ value: st.p[p.id], suffix: p.suffix, aria: p.label, onInput: (n, raw) => { st.p[p.id] = raw; recompute(); save(); } });
      pc.append(h('div', { class: 'frow' }, h('div', { class: 'frow-label' }, h('span', null, p.label), p.hint ? h('small', null, p.hint) : null), h('div', { class: 'frow-ctl' }, f)));
    }
    root.append(pc);
  }
  const listCard = h('div', { class: 'card ulist' });
  const fact = h('p', { class: 'fact' });
  root.append(h('div', { class: 'ulist-tools' }, h('span', null, 'Type in any row'), h('span', null, 'Tap a name to copy')), listCard, fact);
  if (NOTES[catId]) root.append(h('p', { class: 'note' }, NOTES[catId]));

  let rows = [];
  let units = [];
  const save = () => ctx.save(st);

  function groupState() {
    if (!groupIds) return st;
    st.gv ||= {};
    if (!st.gv[st.g]) {
      const d = BLOOD_DEF[st.g] || [];
      st.gv[st.g] = settings.system === 'metric' ? { u: d[0], v: String(d[1]) } : { u: d[2], v: String(d[3]) };
    }
    return st.gv[st.g];
  }

  function draw() {
    units = groupIds ? cat.groups[st.g].units : cat.units;
    const gs = groupState();
    if (!gs.u || !units.find(u => u.id === gs.u)) {
      const d = DEF[catId] || [units[0].id, 1];
      const i = sysIdx();
      gs.u = d[i * 2] || d[0]; gs.v = String(d[i * 2 + 1] ?? d[1]);
      if (!units.find(u => u.id === gs.u)) gs.u = units[0].id;
    }
    rows = units.map(makeRow);
    listCard.replaceChildren(...rows.map(r => r.row));
    const hasMore = units.some(u => !u.c);
    if (hasMore) {
      const btn = h('button', { class: 'more-btn', type: 'button', onclick: () => { st.more = !st.more; applyMore(); save(); } });
      listCard.append(btn);
      listCard._more = btn;
    } else listCard._more = null;
    const src = rows.find(r => r.u.id === gs.u);
    src.setRaw(gs.v);
    applyMore();
    recompute();
  }
  function applyMore() {
    const gs = groupState();
    rows.forEach(r => { r.row.hidden = !(r.u.c || st.more || r.u.id === gs.u); });
    if (listCard._more) {
      const n = units.filter(u => !u.c).length;
      listCard._more.replaceChildren(icon(st.more ? 'up' : 'down'), h('span', null, st.more ? 'Fewer units' : `${n} more units`));
    }
  }

  function recompute() {
    const gs = groupState();
    const src = rows.find(r => r.u.id === gs.u);
    if (!src) return;
    const p = paramVals();
    const base = src.read(p);
    rows.forEach(r => { r.row.classList.toggle('src', r === src); if (r !== src) r.show(base, p); });
    src.subFor?.(base, p);
    // reference fact for linear units: 1 unit = x base
    const u = src.u;
    if (typeof u.f === 'number' && !u.parts) {
      const refU = units.find(x => x.f === 1 && x.id !== u.id);
      fact.replaceChildren(refU ? h('span', null, `1 ${u.sym} = `, h('b', null, fmt(u.f, { sig: 12 }) + ' ' + refU.sym)) : '');
    } else fact.textContent = '';
  }

  function makeRow(u) {
    const row = h('div', { class: 'urow', dataset: { u: u.id } });
    const sub = h('div', { class: 'usub' });
    const label = h('button', { class: 'ulabel', type: 'button', 'aria-label': `Copy ${u.name}` },
      h('b', null, localName(u.name)), h('span', null, money ? `${curSym} ${u.sym}` : u.sym));
    let api;
    const onEdit = raw => {
      const gs = groupState();
      gs.u = u.id; gs.v = raw;
      recompute(); save();
    };
    if (u.options) {
      const sel = selectEl(u.options, '', v => onEdit(v), { aria: u.name });
      api = {
        read: () => { const v = parseFloat(sel.value); return Number.isFinite(v) ? u.toBase(v) : null; },
        show: (b, p) => {
          if (b == null || !Number.isFinite(b)) { sel.set(''); sub.textContent = ''; return; }
          const x = u.fromBase(b, p);
          let best = u.options[0], bd = Infinity;
          for (const o of u.options) { const d = Math.abs(o[0] - x); if (d < bd) { bd = d; best = o; } }
          sel.set(best[0]);
          sub.textContent = bd > 0.2 ? `≈ ${fmt(x, { maxDec: 1 })}` : '';
        },
        setRaw: v => sel.set(v),
        text: () => sel.sel.selectedOptions[0]?.textContent || '',
      };
      row.append(label, h('div', { class: 'uval' }, sel, sub));
    } else if (u.parts) {
      const boxes = u.parts.map(p => numField({ suffix: p.sym, aria: `${u.name} ${p.sym}`, placeholder: '0', onInput: () => onEdit(boxes.map(b => b.input.value)) }));
      api = {
        read: () => {
          const vals = boxes.map(b => b.get());
          if (vals.every(v => v == null)) return null;
          if (vals.some(v => Number.isNaN(v))) return NaN;
          return u.toBase(joinParts(u, vals.map(v => v ?? 0)));
        },
        show: (b, p) => {
          if (b == null || !Number.isFinite(b)) { boxes.forEach(x => x.set('')); return; }
          const scalar = u.fromBase(b, p);
          if (!Number.isFinite(scalar)) { boxes.forEach(x => x.set('')); return; }
          const vals = splitParts(u, scalar);
          boxes.forEach((x, i) => x.set(fmt(vals[i], { maxDec: i === boxes.length - 1 ? (u.dec ?? 2) : 0, sig: 12 })));
        },
        setRaw: v => { (Array.isArray(v) ? v : [v]).forEach((x, i) => boxes[i]?.set(x ?? '')); },
        text: () => u.parts.map((p, i) => `${boxes[i].input.value || 0} ${p.sym}`).join(' '),
      };
      row.append(label, h('div', { class: 'uval' }, h('div', { class: 'parts' }, boxes), sub));
    } else {
      const f = numField({ negative: cat.negative, aria: u.name, onInput: (n, raw) => onEdit(raw) });
      const fit = () => { const L = f.input.value.length; f.input.dataset.len = L > 14 ? 'xl' : L > 10 ? 'l' : ''; };
      f.input.addEventListener('input', fit);
      api = {
        read: p => { const n = f.get(); return n == null || Number.isNaN(n) ? n : u.toBase(n, p); },
        show: (b, p) => {
          if (b == null || Number.isNaN(b)) { f.set(''); sub.textContent = ''; fit(); return; }
          const x = u.fromBase(b, p);
          if (!Number.isFinite(x)) { f.set(''); sub.textContent = ''; fit(); return; }
          if (money) f.set(fmtFixed(x, 2));
          else if (u.step) {
            const r = Math.round(x / u.step) * u.step;
            f.set(fmt(r, { maxDec: 3 }));
            sub.textContent = Math.abs(r - x) > u.step * 0.15 ? `exact ${fmt(x, { maxDec: 2 })}` : '';
          } else f.set(fmt(x));
          if (u.frac) sub.textContent = fracSub(x);
          fit();
        },
        setRaw: v => { f.set(v ?? ''); fit(); },
        text: () => f.input.value,
      };
      api.subFor = (b) => { if (u.frac && Number.isFinite(b)) sub.textContent = fracSub(u.fromBase(b)); else if (!u.step) sub.textContent = ''; };
      row.append(label, h('div', { class: 'uval' }, f, sub));
    }
    label.onclick = () => { const t = api.text(); if (t) copyText(t.replace(/\s+/g, ' '), `${t} ${u.parts ? '' : u.sym}`.trim()); };
    return { u, row, ...api };
  }

  draw();
}

function fracSub(x) {
  if (!Number.isFinite(x) || Math.abs(x) > 1e4 || Number.isInteger(Math.round(x * 1e6) / 1e6)) return '';
  const t = fractionText(x, 16);
  return t.includes('/') ? `≈ ${t}″` : '';
}

const IDS = ['length', 'mass', 'temperature', 'volume', 'area', 'speed', 'time', 'pressure', 'energy', 'power', 'force', 'torque', 'angle', 'frequency', 'fuel', 'ev', 'density', 'flow', 'acceleration', 'light', 'data', 'datarate', 'numbers', 'css', 'salary', 'oven', 'shoes', 'rings', 'wire', 'blood'];
export const tools = Object.fromEntries(IDS.map(id => [id, { mount: (root, ctx) => mountUnits(root, ctx, id) }]));
