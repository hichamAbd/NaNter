// Reusable form controls and result rendering. Everything is live: no "Calculate" buttons.
import { h, icon, copyText, isTouch } from './dom.js';
import { parseNum, fmt, isExpression } from './num.js';

let uid = 0;
const nextId = p => `${p}${++uid}`;

/** Select the whole value on focus so typing replaces it (deferred: iOS resets selection after focus). */
function selectOnFocus(input) {
  input.addEventListener('focus', () => setTimeout(() => { try { input.setSelectionRange(0, input.value.length); } catch { } }, 0));
}

/**
 * Numeric text field. Accepts "1,5", "1.5", "12*3", "1 3/8"…
 * opts: value, placeholder, onInput(num, raw), negative (adds ± key), suffix, prefix, cls, aria, big
 */
export function numField(opts = {}) {
  const input = h('input', {
    class: 'num-in' + (opts.big ? ' big' : ''), type: 'text', inputmode: 'decimal', autocomplete: 'off', autocorrect: 'off',
    autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: opts.placeholder ?? '0',
    'aria-label': opts.aria || opts.label || 'Number', id: opts.id,
  });
  input.value = opts.value ?? '';
  const evalHint = h('span', { class: 'eval-hint', 'aria-live': 'polite' });
  const wrap = h('div', { class: 'num' + (opts.cls ? ' ' + opts.cls : '') },
    opts.prefix ? h('span', { class: 'affix pre' }, opts.prefix) : null,
    input,
    opts.suffix ? h('span', { class: 'affix suf' }, opts.suffix) : null,
    opts.negative ? h('button', {
      class: 'pm', type: 'button', 'aria-label': 'Toggle minus', tabindex: '-1',
      onpointerdown: e => e.preventDefault(),
      onclick: () => {
        const v = input.value.trim();
        input.value = v.startsWith('-') || v.startsWith('−') ? v.slice(1) : '-' + (v || '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    }, '±') : null,
    evalHint);
  selectOnFocus(input);
  const fire = () => {
    const n = parseNum(input.value);
    wrap.classList.toggle('bad', Number.isNaN(n));
    evalHint.textContent = isExpression(input.value) && Number.isFinite(n) ? '= ' + fmt(n) : '';
    opts.onInput?.(n, input.value);
  };
  input.addEventListener('input', fire);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  input.addEventListener('blur', () => {
    // Replace an expression by its result once you leave the field.
    const n = parseNum(input.value);
    if (isExpression(input.value) && Number.isFinite(n)) { input.value = fmt(n, { group: false, sig: 12 }); evalHint.textContent = ''; }
  });
  wrap.input = input;
  wrap.get = () => parseNum(input.value);
  wrap.set = (v, { silent = true } = {}) => {
    input.value = v == null ? '' : typeof v === 'number' ? fmt(v, { group: false, sig: 12 }) : v;
    wrap.classList.remove('bad'); evalHint.textContent = '';
    if (!silent) fire();
  };
  wrap.fire = fire;
  return wrap;
}

/** Segmented control. options: [[value, label], …] */
export function seg(options, value, onChange, { cls = '', aria } = {}) {
  const el = h('div', { class: 'seg ' + cls, role: 'radiogroup', 'aria-label': aria });
  const btns = options.map(([v, label]) => h('button', {
    type: 'button', class: 'seg-btn', role: 'radio', dataset: { v: String(v) },
    onclick: () => { if (el.value !== v) { set(v); onChange?.(v); } },
  }, label));
  el.append(...btns);
  function set(v) {
    el.value = v;
    btns.forEach((b, i) => { const on = options[i][0] === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  }
  set(value);
  el.set = set;
  return el;
}

/** Native select (great wheel picker on iOS). options: [[value,label]] or [{group, options:[[v,l]]}] */
export function selectEl(options, value, onChange, { cls = '', aria } = {}) {
  const sel = h('select', { class: 'sel ' + cls, 'aria-label': aria });
  const add = (parent, [v, l]) => parent.append(h('option', { value: String(v) }, l));
  for (const o of options) {
    if (o && o.group) { const g = h('optgroup', { label: o.group }); o.options.forEach(x => add(g, x)); sel.append(g); }
    else add(sel, o);
  }
  sel.value = String(value);
  sel.addEventListener('change', () => onChange?.(sel.value));
  const wrap = h('div', { class: 'sel-wrap ' + cls }, sel, icon('down', 'i sel-chev'));
  wrap.sel = sel;
  wrap.set = v => { sel.value = String(v); };
  Object.defineProperty(wrap, 'value', { get: () => sel.value });
  return wrap;
}

/** Date input with optional "Today" chip. value: 'YYYY-MM-DD' */
export function dateField(value, onChange, { today = true, min, max, aria } = {}) {
  const input = h('input', { type: 'date', class: 'date-in', value, min, max, 'aria-label': aria || 'Date' });
  input.addEventListener('change', () => input.value && onChange?.(input.value));
  input.addEventListener('input', () => input.value && onChange?.(input.value));
  const wrap = h('div', { class: 'date-wrap' }, input,
    today ? h('button', { type: 'button', class: 'chip sm', onclick: () => { input.value = isoToday(); onChange?.(input.value); } }, 'Today') : null);
  wrap.input = input;
  wrap.set = v => { input.value = v; };
  return wrap;
}
export function timeField(value, onChange, { now = false, aria, step } = {}) {
  const input = h('input', { type: 'time', class: 'time-in', value, 'aria-label': aria || 'Time', step });
  const fire = () => input.value && onChange?.(input.value);
  input.addEventListener('change', fire);
  input.addEventListener('input', fire);
  const wrap = h('div', { class: 'date-wrap' }, input,
    now ? h('button', { type: 'button', class: 'chip sm', onclick: () => { const d = new Date(); input.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`; fire(); } }, 'Now') : null);
  wrap.input = input;
  wrap.set = v => { input.value = v; };
  return wrap;
}
export const pad = (n, w = 2) => String(n).padStart(w, '0');
export function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function isoToday() { return isoDate(new Date()); }

/** Time shown as text in your 12/24 h preference, with the native picker on top (transparent). */
export function timePill(value, onChange, { aria = 'Time', hour12 = false } = {}) {
  const input = h('input', { type: 'time', class: 'tp-in', value, 'aria-label': aria });
  const txt = h('span', { class: 'tp-txt', 'aria-hidden': 'true' });
  const show = () => {
    const [hh, mm] = (input.value || '').split(':').map(Number);
    txt.textContent = input.value ? new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hour12 }) : '--:--';
  };
  const fire = () => { show(); onChange?.(input.value); };
  input.addEventListener('change', fire);
  input.addEventListener('input', fire);
  txt.addEventListener('click', () => { try { input.showPicker(); } catch { input.focus(); } });
  show();
  const el = h('span', { class: 'tp' }, txt, input);
  el.input = input;
  el.set = v => { input.value = v; show(); };
  return el;
}

/** iOS-style switch row. */
export function toggle(label, checked, onChange, sub) {
  const id = nextId('tg');
  const input = h('input', { type: 'checkbox', role: 'switch', id, checked: !!checked, class: 'sw-in' });
  input.addEventListener('change', () => onChange?.(input.checked));
  const el = h('label', { class: 'toggle', for: id },
    h('span', { class: 'toggle-text' }, h('span', null, label), sub ? h('small', { class: 'muted' }, sub) : null),
    input, h('span', { class: 'sw', 'aria-hidden': 'true' }));
  el.input = input;
  el.set = v => { input.checked = !!v; };
  return el;
}

/** − value + stepper for small counts. */
export function stepper(value, { min = 0, max = 999, step = 1, aria, onChange } = {}) {
  const f = numField({ value: String(value), aria, cls: 'step-num', onInput: n => { if (Number.isFinite(n)) onChange?.(Math.min(max, Math.max(min, n))); } });
  const bump = d => {
    let n = f.get(); if (!Number.isFinite(n)) n = min;
    n = Math.min(max, Math.max(min, Math.round((n + d) * 1e6) / 1e6));
    f.set(String(n)); onChange?.(n);
  };
  const el = h('div', { class: 'stepper' },
    h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Decrease', onclick: () => bump(-step) }, icon('minus')),
    f,
    h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Increase', onclick: () => bump(step) }, icon('plus')));
  el.get = f.get;
  el.set = v => f.set(String(v));
  return el;
}

/** Quick preset chips. options: [[value,label]] */
export function chips(options, onPick, { cls = '', active } = {}) {
  const el = h('div', { class: 'chips ' + cls });
  for (const [v, l] of options) el.append(h('button', { type: 'button', class: 'chip' + (active === v ? ' on' : ''), onclick: () => onPick(v) }, l));
  el.mark = v => [...el.children].forEach((b, i) => b.classList.toggle('on', options[i][0] === v));
  return el;
}

/** A labelled row inside a card: [label .......... control] or stacked when `stack`. */
export function row(label, control, { hint, stack = false, cls = '' } = {}) {
  return h('div', { class: 'frow' + (stack ? ' stack' : '') + (label == null ? ' nolabel' : '') + (cls ? ' ' + cls : '') },
    label != null ? h('div', { class: 'frow-label' }, h('span', null, label), hint ? h('small', null, hint) : null) : null,
    h('div', { class: 'frow-ctl' }, control));
}

export function card(...kids) { return h('div', { class: 'card' }, ...kids); }
export function section(title, ...kids) {
  return h('section', { class: 'sec' }, title ? h('h3', { class: 'sec-title' }, title) : null, ...kids);
}
export function note(text) { return h('p', { class: 'note' }, text); }

/* ---------- unit-aware number input (number + unit picker, composite units get two boxes) ---------- */
export function splitParts(u, scalar) {
  const parts = u.parts;
  const dec = u.dec ?? 2;
  const neg = scalar < 0; let rem = Math.abs(scalar);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const f = parts[i].f;
    if (i < parts.length - 1) { const n = Math.floor(rem / f + 1e-9); out.push(n); rem -= n * f; }
    else out.push(Math.round(rem / f * 10 ** dec) / 10 ** dec);
  }
  // carry (e.g. 5 ft 12 in → 6 ft 0 in)
  for (let i = parts.length - 1; i > 0; i--) {
    const lim = parts[i - 1].f / parts[i].f;
    if (out[i] >= lim - 1e-9) { out[i] -= lim; out[i - 1] += 1; out[i] = Math.max(0, Math.round(out[i] * 10 ** dec) / 10 ** dec); }
  }
  if (neg) out[0] = -out[0];
  return out;
}
export function joinParts(u, vals) {
  let s = 0, any = false, neg = false;
  u.parts.forEach((p, i) => { const v = vals[i]; if (Number.isFinite(v)) { any = true; if (v < 0) neg = true; s += Math.abs(v) * p.f; } });
  return any ? (neg ? -s : s) : null;
}
export function fmtParts(u, scalar) {
  const vals = splitParts(u, scalar);
  return u.parts.map((p, i) => `${fmt(vals[i], { maxDec: i === u.parts.length - 1 ? (u.dec ?? 2) : 0 })} ${p.sym}`).join(' ');
}

/**
 * unitInput: value + unit selector. units = unit objects of one category.
 * value is held in BASE units; changing the unit converts the shown number.
 */
export function unitInput({ units, unit, base = null, onChange, aria, negative = false, placeholder }) {
  let u = units.find(x => x.id === unit) || units[0];
  const el = h('div', { class: 'uin' + (units.some(x => x.parts) ? ' composite' : '') });
  const boxes = h('div', { class: 'uin-boxes' });
  let fields = [];
  let curBase = base;

  const unitSel = units.length > 1 ? selectEl(units.map(x => [x.id, x.sym]), u.id, id => {
    u = units.find(x => x.id === id);
    build(); show(curBase);
    onChange?.(curBase, u.id);
  }, { cls: 'unit-sel', aria: 'Unit' }) : u.parts ? null : h('span', { class: 'affix suf solo' }, u.sym);

  function readBase() {
    if (u.parts) {
      const vals = fields.map(f => f.get());
      const scalar = joinParts(u, vals.map(v => (v == null ? 0 : v)));
      if (vals.every(v => v == null)) return null;
      if (vals.some(v => Number.isNaN(v))) return NaN;
      return u.toBase(scalar);
    }
    const n = fields[0].get();
    return n == null || Number.isNaN(n) ? n : u.toBase(n);
  }
  function build() {
    boxes.replaceChildren();
    if (u.parts) {
      fields = u.parts.map((p, i) => numField({ aria: (aria || '') + ' ' + p.sym, suffix: p.sym, placeholder: '0', onInput: () => { curBase = readBase(); onChange?.(curBase, u.id); } }));
    } else {
      fields = [numField({ aria, negative, placeholder, onInput: () => { curBase = readBase(); onChange?.(curBase, u.id); } })];
    }
    boxes.append(...fields);
  }
  function show(b) {
    curBase = b;
    if (b == null || !Number.isFinite(b)) { fields.forEach(f => f.set('')); return; }
    if (u.parts) {
      const vals = splitParts(u, u.fromBase(b));
      fields.forEach((f, i) => f.set(vals[i] ? fmt(vals[i], { group: false, maxDec: i === fields.length - 1 ? (u.dec ?? 2) : 0, sig: 10 }) : (i === 0 ? '0' : '')));
    } else fields[0].set(fmt(u.fromBase(b), { group: false, sig: 10 }));
  }
  build(); show(base);
  el.append(boxes);
  if (unitSel) el.append(unitSel);
  el.get = () => curBase;
  el.set = b => show(b);
  el.unit = () => u.id;
  return el;
}

/* ---------- results ---------- */
/**
 * items: { k, v, sub, copy, big, tone, unit } | { head } | { note } | { node } | { table:{cols,rows,hi} } | { gauge }
 */
export function results(cls = '') {
  const el = h('div', { class: 'results ' + cls, 'aria-live': 'polite' });
  el.render = items => el.replaceChildren(...(items || []).filter(Boolean).map(renderItem));
  return el;
}
function renderItem(it) {
  if (it instanceof Node) return it;
  if (it.node) return it.node;
  if (it.head != null) return h('h3', { class: 'res-head' }, it.head);
  if (it.note != null) return h('p', { class: 'note' + (it.tone ? ' ' + it.tone : '') }, it.note);
  if (it.table) return renderTable(it.table);
  if (it.gauge) return renderGauge(it.gauge);
  const copy = it.copy ?? (typeof it.v === 'string' ? it.v : null);
  const tag = copy != null && it.nocopy !== true ? 'button' : 'div';
  const long = !it.big && typeof it.v === 'string' && it.v.length > 22 && String(it.k || '').length > 8;
  const attrs = { class: (it.big ? 'res-hero' : 'res-row') + (it.tone ? ' ' + it.tone : '') + (long || it.stack ? ' long' : ''), type: tag === 'button' ? 'button' : null };
  if (tag === 'button') attrs.onclick = () => copyText(copy, it.copyLabel ?? (copy + (it.unit ? ' ' + it.unit : '')));
  return h(tag, attrs,
    h('span', { class: 'res-k' }, it.k ?? ''),
    h('span', { class: 'res-v' }, it.v ?? '—', it.unit ? h('span', { class: 'res-u' }, ' ' + it.unit) : null),
    it.sub ? h('span', { class: 'res-sub' }, it.sub) : null);
}
function renderTable({ cols, rows, hi, cls = '', onRow }) {
  return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ' + cls },
    cols ? h('thead', null, h('tr', null, cols.map(c => h('th', null, c)))) : null,
    h('tbody', null, rows.map((r, i) => h('tr', { class: i === hi ? 'hi' : null, onclick: onRow ? () => onRow(i) : null }, r.map(c => h('td', null, c)))))));
}
/** Horizontal gauge with coloured zones and a marker. zones: [{to, label, tone}] */
function renderGauge({ value, min, max, zones }) {
  const pct = x => `${Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100))}%`;
  let prev = min;
  const bar = h('div', { class: 'gauge-bar' }, zones.map(z => {
    const seg = h('span', { class: 'gz ' + (z.tone || ''), style: { left: pct(prev), width: `calc(${pct(z.to)} - ${pct(prev)})` } });
    prev = z.to; return seg;
  }), Number.isFinite(value) ? h('span', { class: 'gauge-mark', style: { left: pct(value) } }) : null);
  prev = min;
  const labels = h('div', { class: 'gauge-labels' }, zones.map(z => {
    const l = h('span', { style: { left: pct(prev), width: `calc(${pct(z.to)} - ${pct(prev)})` } }, z.label);
    prev = z.to; return l;
  }));
  return h('div', { class: 'gauge' }, bar, labels);
}

/** Button helper */
export function btn(label, onclick, { cls = '', ico, aria } = {}) {
  return h('button', { type: 'button', class: 'btn ' + cls, onclick, 'aria-label': aria }, ico ? icon(ico) : null, label ? h('span', null, label) : null);
}
export function iconBtn(ico, onclick, aria, cls = '') {
  return h('button', { type: 'button', class: 'icon-btn ' + cls, onclick, 'aria-label': aria, title: aria }, icon(ico));
}

/** Tabs (segmented) that switch between panes; returns {el, panes} */
export function tabs(defs, value, onChange) {
  const panes = {};
  const body = h('div', { class: 'tab-body' });
  const s = seg(defs.map(d => [d[0], d[1]]), value, v => { show(v); onChange?.(v); }, { cls: 'tabs' });
  defs.forEach(([id]) => { panes[id] = h('div', { class: 'tab-pane', hidden: id !== value }); body.append(panes[id]); });
  function show(v) { Object.entries(panes).forEach(([id, p]) => { p.hidden = id !== v; }); }
  return { el: h('div', null, s, body), panes, seg: s, show };
}

export { isTouch };
