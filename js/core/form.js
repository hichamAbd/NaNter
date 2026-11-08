// Declarative calculators: a list of fields + compute(values) → result items. State persists per tool.
import { h } from './dom.js';
import { parseNum, currencySymbol, fmt } from './num.js';
import { numField, seg, selectEl, dateField, timeField, toggle, stepper, unitInput, chips, row, results, isoToday } from './ui.js';
import { settings } from './store.js';

/**
 * spec.fields entries:
 *  { group: 'Title' }                          starts a new card
 *  { id, type, label, hint, default, when(v), presets:[[v,l]], …type options }
 * types: num, money, pct, unit, seg, select, date, time, toggle, stepper, text, textarea, hms
 */
export function mountForm(root, spec, ctx) {
  const state = Object.assign({}, defaults(spec, ctx), ctx.state || {}, ctx.params || {});
  const controls = {};
  const rows = {};
  const out = results();
  const cards = [];
  let cur = null;
  const newCard = title => {
    cur = h('div', { class: 'card form' });
    cards.push(title ? h('div', { class: 'card-group' }, h('h3', { class: 'sec-title' }, title), cur) : cur);
  };

  for (const f of spec.fields) {
    if (f.group !== undefined) { newCard(f.group); continue; }
    if (!cur) newCard();
    const c = build(f);
    controls[f.id] = c;
    const presets = f.presets ? chips(f.presets, val => {
      state[f.id] = typeof val === 'number' ? String(val) : val;
      c.set?.(state[f.id]); update();
    }, { cls: 'presets' }) : null;
    const r = (f.type === 'toggle' || f.type === 'seg' && !f.label)
      ? h('div', { class: 'frow ' + (f.type === 'seg' ? 'seg-row' : 'toggle-row') }, c)
      : row(f.label, c, { hint: f.hint, stack: f.stack || f.type === 'textarea' || f.type === 'seg' || f.type === 'hms' && !!f.stackLabel });
    if (presets) r.append(presets);
    rows[f.id] = r;
    cur.append(r);
  }
  root.append(...cards, out);
  if (spec.footer) root.append(spec.footer);

  function build(f) {
    const set = v => { state[f.id] = v; update(); };
    switch (f.type) {
      case 'money': return numField({ value: state[f.id], prefix: currencySymbol(f.currency || settings.currency), aria: f.label, placeholder: f.placeholder, onInput: (n, raw) => set(raw) });
      case 'pct': return numField({ value: state[f.id], suffix: '%', aria: f.label, negative: f.negative, placeholder: f.placeholder, onInput: (n, raw) => set(raw) });
      case 'num': return numField({ value: state[f.id], suffix: f.suffix, prefix: f.prefix, aria: f.label, negative: f.negative, placeholder: f.placeholder, onInput: (n, raw) => set(raw) });
      case 'unit': {
        const s = state[f.id] || {};
        const units = typeof f.units === 'function' ? f.units() : f.units;
        const el = unitInput({ units, unit: s.u || (typeof f.unit === 'function' ? f.unit() : f.unit), base: s.b ?? null, aria: f.label, negative: f.negative, onChange: (b, u) => set({ b, u }) });
        const setBase = el.set;
        el.set = v => setBase(v?.b ?? null);
        return el;
      }
      case 'seg': return seg(f.options, state[f.id], set, { aria: f.label });
      case 'select': return selectEl(typeof f.options === 'function' ? f.options() : f.options, state[f.id], set, { aria: f.label });
      case 'date': return dateField(state[f.id], set, { today: f.today !== false, aria: f.label });
      case 'time': return timeField(state[f.id], set, { now: f.now, aria: f.label });
      case 'toggle': return toggle(f.label, state[f.id], set, f.hint);
      case 'stepper': return stepper(state[f.id], { min: f.min, max: f.max, step: f.step, aria: f.label, onChange: set });
      case 'text': {
        const i = h('input', { type: 'text', class: 'text-in', value: state[f.id] || '', placeholder: f.placeholder || '', 'aria-label': f.label, autocomplete: 'off' });
        i.addEventListener('input', () => set(i.value));
        i.set = v => { i.value = v; };
        return i;
      }
      case 'textarea': {
        const t = h('textarea', { class: 'text-area', rows: f.rows || 6, placeholder: f.placeholder || '', 'aria-label': f.label, spellcheck: 'false' });
        t.value = state[f.id] || '';
        t.addEventListener('input', () => set(t.value));
        t.set = v => { t.value = v; };
        return t;
      }
      case 'hms': {
        const parts = f.parts || ['h', 'min', 's'];
        if (typeof state[f.id] === 'string') state[f.id] = state[f.id].split(',');
        const vals = (state[f.id] || []).slice();
        const boxes = parts.map((p, i) => numField({ value: vals[i] ?? '', suffix: p, placeholder: '0', aria: `${f.label} ${p}`, onInput: (n, raw) => { vals[i] = raw; set(vals.slice()); } }));
        const el = h('div', { class: 'hms' }, boxes);
        el.set = v => { (v || []).forEach((x, i) => boxes[i]?.set(x ?? '')); };
        return el;
      }
      default: throw new Error('Unknown field type ' + f.type);
    }
  }

  function values() {
    const v = {};
    for (const f of spec.fields) {
      if (!f.id) continue;
      const s = state[f.id];
      switch (f.type) {
        case 'num': case 'money': case 'pct': v[f.id] = parseNum(s); break;
        case 'unit': v[f.id] = s?.b ?? null; v[f.id + '_u'] = s?.u || (typeof f.unit === 'function' ? f.unit() : f.unit); break;
        case 'hms': {
          const mul = f.mul || [3600, 60, 1];
          const nums = (typeof s === 'string' ? s.split(',') : s || []).map(parseNum);
          v[f.id] = nums.some(x => Number.isFinite(x)) ? nums.reduce((a, x, i) => a + (Number.isFinite(x) ? x : 0) * mul[i], 0) : null;
          v[f.id + '_parts'] = nums;
          break;
        }
        default: v[f.id] = s;
      }
    }
    v.raw = state;
    return v;
  }

  function update() {
    const v = values();
    for (const f of spec.fields) if (f.id && f.when && rows[f.id]) rows[f.id].hidden = !f.when(v);
    ctx.save?.(state);
    let items;
    try { items = spec.compute(v, ctx); } catch (e) { console.error(e); items = [{ note: 'Could not compute: ' + e.message }]; }
    out.render(items);
  }

  update();
  return {
    state, controls, update,
    set(id, val) { state[id] = val; controls[id]?.set?.(val); update(); },
  };
}

function defaults(spec, ctx) {
  const d = {};
  for (const f of spec.fields) {
    if (!f.id) continue;
    let v = typeof f.default === 'function' ? f.default(ctx) : f.default;
    if (v === undefined) {
      if (f.type === 'date') v = isoToday();
      else if (f.type === 'toggle') v = false;
      else if (f.type === 'seg' || f.type === 'select') v = (typeof f.options === 'function' ? f.options() : f.options)[0]?.[0];
      else if (f.type === 'stepper') v = f.min ?? 1;
    }
    if (v !== undefined) d[f.id] = v;
  }
  return d;
}

/** Shared small helpers for compute functions */
export const ok = x => typeof x === 'number' && Number.isFinite(x);
export const okPos = x => ok(x) && x > 0;
export const dash = '—';
export { fmt };
