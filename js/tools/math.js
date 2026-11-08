// Math tools: percentages, ratios, fractions, bases, roman numerals, statistics, aspect ratio, shapes, words, random.
import { h, icon, copyText, toast } from '../core/dom.js';
import { parseNum, fmt, fmtPct, toFraction, gcd, getDec, normalizeNumberToken } from '../core/num.js';
import { numField, seg, selectEl, toggle, row, results, chips, tabs, stepper, unitInput } from '../core/ui.js';
import { ok, okPos } from '../core/form.js';
import { settings } from '../core/store.js';
import { unitsOf } from '../data/units.js';

const R = (k, v, o = {}) => ({ k, v, ...o });

/* ---------- Percentage: five small calculators on one page ---------- */
function mountPercentage(root, ctx) {
  const st = Object.assign({ a1: '20', b1: '85', a2: '17', b2: '85', a3: '80', b3: '100', a4: '250', b4: '15', s4: 1, a5: '30', b5: '20' }, ctx.state || {});
  const save = () => ctx.save(st);
  const mk = (title, ka, kb, la, lb, calc, extra) => {
    const out = h('div', { class: 'pc-out' });
    const upd = () => { save(); const r = calc(parseNum(st[ka]), parseNum(st[kb])); out.replaceChildren(...r); };
    const fa = numField({ value: st[ka], aria: la, suffix: la === '%' ? '%' : null, onInput: (n, raw) => { st[ka] = raw; upd(); } });
    const fb = numField({ value: st[kb], aria: lb, suffix: lb === '%' ? '%' : null, onInput: (n, raw) => { st[kb] = raw; upd(); } });
    const el = h('div', { class: 'card pad pc' }, h('div', { class: 'pc-title' }, title), extra || null, h('div', { class: 'pc-in' }, fa, h('span', { class: 'pc-mid' }, title.includes(' of ') ? 'of' : '→'), fb), out);
    upd();
    el.upd = upd;
    return el;
  };
  const line = (txt, copy) => h('button', { class: 'pc-res', type: 'button', onclick: () => copyText(copy ?? txt) }, txt);
  const sub = t => h('div', { class: 'pc-sub' }, t);
  const card4 = mk('Increase / decrease by %', 'a4', 'b4', 'value', '%', (a, p) => {
    if (!ok(a) || !ok(p)) return [];
    const r = a * (1 + st.s4 * p / 100);
    return [line(fmt(r)), sub(`${fmt(a)} ${st.s4 > 0 ? '+' : '−'} ${fmt(p)} % (${st.s4 > 0 ? '+' : '−'}${fmt(Math.abs(r - a))})`)];
  });
  card4.querySelector('.pc-title').after(seg([[1, 'Increase'], [-1, 'Decrease']], st.s4, v => { st.s4 = v; card4.upd(); }, { cls: 'pc-seg' }));
  root.append(
    mk('What is X % of Y?', 'a1', 'b1', '%', 'Y', (p, y) => (ok(p) && ok(y) ? [line(fmt(p * y / 100)), sub(`${fmt(p)} % of ${fmt(y)}`)] : [])),
    mk('X is what % of Y?', 'a2', 'b2', 'X', 'Y', (x, y) => (ok(x) && ok(y) && y ? [line(fmtPct(x / y * 100, 4), fmt(x / y * 100)), sub(`${fmt(x)} out of ${fmt(y)}`)] : [])),
    mk('% change from X to Y', 'a3', 'b3', 'from', 'to', (x, y) => {
      if (!ok(x) || !ok(y) || !x) return [];
      const c = (y - x) / Math.abs(x) * 100;
      return [line(`${c >= 0 ? '+' : '−'}${fmtPct(Math.abs(c), 4)}`, fmt(c)), sub(`${c >= 0 ? 'Increase' : 'Decrease'} of ${fmt(Math.abs(y - x))}`)];
    }),
    card4,
    mk('X is Y % of what?', 'a5', 'b5', 'X', '%', (x, p) => (ok(x) && ok(p) && p ? [line(fmt(x / (p / 100))), sub(`${fmt(x)} is ${fmt(p)} % of it`)] : [])),
    h('p', { class: 'note' }, 'Tip: any number field also accepts maths, like 200 + 15% or 1/3.'));
}

/* ---------- Ratio & rule of three ---------- */
const ratio = {
  fields: [
    { group: 'Rule of three: A → B, C → ?' },
    { id: 'a', type: 'num', label: 'A', default: '3' },
    { id: 'b', type: 'num', label: 'B (for A)', default: '450' },
    { id: 'c', type: 'num', label: 'C', default: '5' },
    { id: 'inv', type: 'toggle', label: 'Inverse proportion', hint: 'More of C means less of the result (workers ↔ days)' },
    { group: 'Simplify a ratio' },
    { id: 'x', type: 'num', label: 'First', default: '1920' },
    { id: 'y', type: 'num', label: 'Second', default: '1080' },
  ],
  compute(v) {
    const out = [];
    if (ok(v.a) && ok(v.b) && ok(v.c) && v.a && v.c) {
      const d = v.inv ? v.a * v.b / v.c : v.b * v.c / v.a;
      out.push(R(`${fmt(v.c)} → ?`, fmt(d), { big: true, sub: v.inv ? `${fmt(v.a)} × ${fmt(v.b)} ÷ ${fmt(v.c)}` : `${fmt(v.b)} × ${fmt(v.c)} ÷ ${fmt(v.a)}` }));
    } else out.push({ note: 'Fill A, B and C.' });
    if (okPos(v.x) && okPos(v.y)) {
      const k = 10 ** Math.min(6, Math.max(dec(v.x), dec(v.y)));
      const X = Math.round(v.x * k), Y = Math.round(v.y * k), g = gcd(X, Y);
      out.push({ head: 'Ratio' }, R('Simplified', `${X / g} : ${Y / g}`, { tone: 'accent' }), R('As 1 : n', `1 : ${fmt(v.y / v.x)}`), R('As n : 1', `${fmt(v.x / v.y)} : 1`), R('Shares', `${fmt(v.x / (v.x + v.y) * 100, { maxDec: 2 })} % / ${fmt(v.y / (v.x + v.y) * 100, { maxDec: 2 })} %`));
    }
    return out;
  },
};
const dec = x => { const s = String(x); return s.includes('e-') ? 6 : (s.split('.')[1] || '').length; };

/* ---------- Fractions ---------- */
function parseRational(s) {
  s = String(s || '').trim().replace(/−/g, '-');
  if (!s) return null;
  let m = /^(-)?\s*(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) { const n = +m[2] * +m[4] + +m[3]; return norm([m[1] ? -n : n, +m[4]]); }
  m = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(s);
  if (m) return norm([+m[1], +m[2]]);
  const x = parseNum(s);
  if (!Number.isFinite(x)) return null;
  const str = String(x);
  if (!str.includes('e') && (str.split('.')[1] || '').length <= 9) { const k = 10 ** (str.split('.')[1] || '').length; return norm([Math.round(x * k), k]); }
  return norm(toFraction(x, 1e6));
}
function norm([n, d]) { if (!d) return null; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; }
const fracTxt = ([n, d]) => (d === 1 ? String(n) : `${n}/${d}`);
const mixedTxt = ([n, d]) => { if (d === 1 || Math.abs(n) < d) return fracTxt([n, d]); const w = Math.trunc(n / d), r = Math.abs(n % d); return `${w} ${r}/${d}`; };
function mountFractions(root, ctx) {
  const st = Object.assign({ x: '0.375', a: '1/2', op: '+', b: '1/3' }, ctx.state || {});
  const save = () => ctx.save(st);
  const r1 = results(), r2 = results();
  const t = (k, ph) => { const i = h('input', { class: 'text-in frac-in', type: 'text', value: st[k], placeholder: ph, inputmode: 'decimal', autocomplete: 'off', 'aria-label': ph }); i.addEventListener('input', () => { st[k] = i.value; upd(); }); return i; };
  root.append(h('h3', { class: 'sec-title' }, 'Convert'), h('div', { class: 'card form' }, row('Number', t('x', '0.375 or 3/8'), { hint: 'decimal, fraction or mixed' })), r1,
    h('h3', { class: 'sec-title' }, 'Calculate'), h('div', { class: 'card form' }, row('First', t('a', '1/2')), h('div', { class: 'frow seg-row' }, seg([['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']], st.op, v => { st.op = v; upd(); })), row('Second', t('b', '1/3'))), r2,
    h('p', { class: 'note' }, 'Type fractions with “/”: 3/8, 1 1/2 or -5/4. Decimals work too.'));
  function upd() {
    save();
    const q = parseRational(st.x);
    if (q) {
      const v = q[0] / q[1];
      const inch = toFraction(Math.abs(v) % 1, 64);
      r1.render([R('Fraction', fracTxt(q), { big: true }), R('Mixed number', mixedTxt(q)), R('Decimal', fmt(v, { sig: 12 })), R('Percent', fmtPct(v * 100, 6)),
        R('Nearest 1/16', fracNearest(v, 16)), R('Nearest 1/64 (inches)', fracNearest(v, 64), { sub: inch ? null : null })]);
    } else r1.render([{ note: 'Enter a number like 0.375, 3/8 or 1 1/2.' }]);
    const a = parseRational(st.a), b = parseRational(st.b);
    if (a && b) {
      let r;
      if (st.op === '+') r = [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
      if (st.op === '-') r = [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
      if (st.op === '*') r = [a[0] * b[0], a[1] * b[1]];
      if (st.op === '/') r = b[0] ? [a[0] * b[1], a[1] * b[0]] : null;
      r = r && norm(r);
      r2.render(r ? [R(`${fracTxt(a)} ${{ '+': '+', '-': '−', '*': '×', '/': '÷' }[st.op]} ${fracTxt(b)}`, fracTxt(r), { big: true, sub: mixedTxt(r) !== fracTxt(r) ? mixedTxt(r) : null }), R('Decimal', fmt(r[0] / r[1], { sig: 12 }))] : [{ note: 'Can’t divide by zero.' }]);
    } else r2.render([{ note: 'Enter two fractions.' }]);
  }
  upd();
}
function fracNearest(v, den) {
  const s = v < 0 ? '−' : ''; v = Math.abs(v);
  let w = Math.floor(v), n = Math.round((v - w) * den), d = den;
  if (n === d) { w++; n = 0; }
  while (n && n % 2 === 0) { n /= 2; d /= 2; }
  return s + (n ? (w ? `${w} ${n}/${d}` : `${n}/${d}`) : String(w));
}

/* ---------- Number bases ---------- */
const BASES = [[2, 'Binary', 'bin'], [8, 'Octal', 'oct'], [10, 'Decimal', 'dec'], [16, 'Hexadecimal', 'hex']];
export function toBig(str, base) {
  str = str.trim().toLowerCase().replace(/[\s_]/g, '');
  let neg = false;
  if (str.startsWith('-')) { neg = true; str = str.slice(1); }
  str = str.replace(base === 16 ? /^0x/ : base === 2 ? /^0b/ : base === 8 ? /^0o/ : /^$/, '');
  if (!str) return null;
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
  let v = 0n; const B = BigInt(base);
  for (const c of str) { const i = digits.indexOf(c); if (i < 0) return NaN; v = v * B + BigInt(i); }
  return neg ? -v : v;
}
export const fromBig = (v, base) => (v < 0n ? '-' : '') + (v < 0n ? -v : v).toString(base).toUpperCase();
function mountBases(root, ctx) {
  const st = Object.assign({ src: 10, v: '255', custom: 36 }, ctx.state || {});
  if (st.src !== 'custom') st.src = +st.src || 10;
  const save = () => ctx.save(st);
  const listEl = h('div', { class: 'card ulist' });
  const out = results();
  const rows = [];
  const all = () => [...BASES, [st.custom, `Base ${st.custom}`, 'custom']];
  root.append(h('div', { class: 'ulist-tools' }, h('span', null, 'Type in any row'), h('span', null, 'Tap a name to copy')), listEl, out);
  function draw() {
    rows.length = 0;
    listEl.replaceChildren(...all().map(([b, name, id]) => {
      const input = h('input', { class: 'num-in base-in', type: 'text', inputmode: b <= 10 ? 'decimal' : 'text', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': name });
      const wrap = h('div', { class: 'num' }, input);
      const sub = h('div', { class: 'usub' });
      input.addEventListener('input', () => { st.src = id === 'custom' ? 'custom' : b; st.v = input.value; recompute(); });
      const label = h('button', { class: 'ulabel', type: 'button', onclick: () => input.value && copyText(input.value, `${input.value} (${name})`) }, h('b', null, name), h('span', null, `base ${b}`));
      const extra = id === 'custom' ? selectEl(Array.from({ length: 35 }, (_, i) => [i + 2, String(i + 2)]), st.custom, v => { st.custom = +v; draw(); }, { cls: 'unit-sel', aria: 'Base' }) : null;
      rows.push({ b, id, input, wrap, sub });
      return h('div', { class: 'urow' + ((st.src === b && id !== 'custom') || (st.src === 'custom' && id === 'custom') ? ' src' : '') }, h('div', null, label, extra), h('div', { class: 'uval' }, wrap, sub));
    }));
    const src = rows.find(r => (st.src === 'custom' ? r.id === 'custom' : r.b === st.src && r.id !== 'custom'));
    src.input.value = st.v;
    recompute();
  }
  function recompute() {
    save();
    const src = rows.find(r => (st.src === 'custom' ? r.id === 'custom' : r.b === st.src && r.id !== 'custom'));
    const v = toBig(st.v, src.b);
    src.wrap.classList.toggle('bad', Number.isNaN(v));
    for (const r of rows) {
      r.input.closest('.urow').classList.toggle('src', r === src);
      if (r !== src) r.input.value = typeof v === 'bigint' ? fromBig(v, r.b) : '';
      r.sub.textContent = r.b === 2 && typeof v === 'bigint' && v >= 0n ? fromBig(v, 2).replace(/\B(?=(\d{4})+(?!\d))/g, ' ') : '';
    }
    if (typeof v !== 'bigint') return out.render([]);
    const abs = v < 0n ? -v : v;
    const bits = abs === 0n ? 1 : abs.toString(2).length;
    const items = [R('Bits needed', String(bits) + (v < 0n ? ' (+ sign)' : '')), R('Bytes', String(Math.ceil(bits / 8)))];
    if (v >= 0n && v <= 0x10ffffn && !(v >= 0xd800n && v <= 0xdfffn)) items.push(R('Character', v < 32n ? 'control character' : `“${String.fromCodePoint(Number(v))}”`, { sub: 'U+' + v.toString(16).toUpperCase().padStart(4, '0') }));
    if (v < 0n && bits < 64) { const w = bits <= 8 ? 8 : bits <= 16 ? 16 : bits <= 32 ? 32 : 64; items.push(R(`Two’s complement (${w}-bit)`, ((1n << BigInt(w)) + v).toString(2), { stack: true })); }
    out.render(items);
  }
  draw();
}

/* ---------- Roman numerals ---------- */
const ROM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) { if (!(n >= 1 && n <= 3999)) return null; let s = ''; for (const [v, r] of ROM) while (n >= v) { s += r; n -= v; } return s; }
export function fromRoman(s) {
  s = String(s || '').toUpperCase().trim();
  if (!s || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s)) return null;
  let n = 0, i = 0;
  for (const [v, r] of ROM) while (s.startsWith(r, i)) { n += v; i += r.length; }
  return n;
}
function mountRoman(root, ctx) {
  const st = Object.assign({ n: String(new Date().getFullYear()), r: '' }, ctx.state || {});
  const out = results();
  const nIn = numField({ value: st.n, aria: 'Number', big: true, onInput: (n, raw) => { st.n = raw; const r = toRoman(Math.round(n)); rIn.value = r || ''; upd(Math.round(n), r); } });
  const rIn = h('input', { class: 'text-in roman-in', type: 'text', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'MMXXVI', 'aria-label': 'Roman numeral' });
  rIn.addEventListener('input', () => { const n = fromRoman(rIn.value); st.n = n ? String(n) : ''; nIn.set(n ? String(n) : ''); rIn.classList.toggle('bad', !!rIn.value && !n); upd(n, n ? rIn.value.toUpperCase() : null); });
  root.append(h('div', { class: 'card form' }, row('Number', nIn), row('Roman', rIn)), out, h('p', { class: 'note' }, 'Standard numerals go from I (1) to MMMCMXCIX (3999).'));
  function upd(n, r) {
    ctx.save(st);
    if (!r) return out.render([{ note: 'Enter a number from 1 to 3999 or a Roman numeral.' }]);
    const parts = []; let x = n;
    for (const [v, s] of ROM) while (x >= v) { parts.push([s, v]); x -= v; }
    out.render([R(String(n), r, { big: true }), R('Breakdown', parts.map(p => p[0]).join(' '), { sub: parts.map(p => p[1]).join(' + ') + ' = ' + n })]);
  }
  const n0 = Math.round(parseNum(st.n));
  rIn.value = toRoman(n0) || '';
  upd(n0, toRoman(n0));
}

/* ---------- Statistics ---------- */
export function parseList(txt) {
  txt = String(txt || '').trim();
  if (!txt) return [];
  let toks;
  if (/[\s;\n\t]/.test(txt)) toks = txt.split(/[\s;\n\t]+/);
  else if (txt.includes(',') && getDec() === ',' && !/,\d{3}(,|$)/.test(txt) && txt.split(',').length === 2) toks = [txt];
  else toks = txt.split(',');
  return toks.map(t => t.replace(/,$/, '')).filter(Boolean).map(t => normalizeNumberToken(t)).filter(Number.isFinite);
}
const stats = {
  fields: [{ id: 'txt', type: 'textarea', label: 'Numbers', placeholder: 'One per line, or separated by spaces or ;\n12 15 18 22 22 30', default: '12 15 18 22 22 30 41', rows: 5 }],
  compute(v) {
    const a = parseList(v.txt);
    if (!a.length) return [{ note: 'Enter some numbers.' }];
    const n = a.length, s = [...a].sort((x, y) => x - y), sum = a.reduce((x, y) => x + y, 0), mean = sum / n;
    const q = p => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
    const varP = a.reduce((x, y) => x + (y - mean) ** 2, 0) / n, varS = n > 1 ? varP * n / (n - 1) : NaN;
    const counts = new Map(); a.forEach(x => counts.set(x, (counts.get(x) || 0) + 1));
    const maxC = Math.max(...counts.values());
    const modes = maxC > 1 ? [...counts].filter(([, c]) => c === maxC).map(([x]) => fmt(x)) : [];
    const items = [
      R('Mean (average)', fmt(mean), { big: true, sub: `${n} values · sum ${fmt(sum)}` }),
      R('Median', fmt(q(0.5))),
      R('Mode', modes.length ? modes.join(', ') + ` (×${maxC})` : 'none'),
      R('Minimum', fmt(s[0])), R('Maximum', fmt(s[n - 1])), R('Range', fmt(s[n - 1] - s[0])),
      R('Std deviation (sample)', fmt(Math.sqrt(varS))), R('Std deviation (population)', fmt(Math.sqrt(varP))),
      R('Variance (sample)', fmt(varS)), R('Q1 · Q3', `${fmt(q(0.25))} · ${fmt(q(0.75))}`, { sub: `Interquartile range ${fmt(q(0.75) - q(0.25))}` }),
    ];
    if (s[0] > 0) items.push(R('Geometric mean', fmt(Math.exp(a.reduce((x, y) => x + Math.log(y), 0) / n))), R('Harmonic mean', fmt(n / a.reduce((x, y) => x + 1 / y, 0))));
    items.push(R('Sorted', s.map(x => fmt(x)).join('  '), { stack: true }));
    return items;
  },
};

/* ---------- Aspect ratio ---------- */
const COMMON_AR = [[16, 9], [4, 3], [3, 2], [1, 1], [21, 9], [9, 16], [4, 5], [2, 3], [5, 4], [16, 10], [2.39, 1], [1.85, 1]];
function mountAspect(root, ctx) {
  const st = Object.assign({ w: '1920', h: '1080', nw: '1280', nh: '', last: 'nw' }, ctx.state || {});
  const save = () => ctx.save(st);
  const out = results(), out2 = results();
  const f = (k, label) => numField({ value: st[k], aria: label, onInput: (n, raw) => { st[k] = raw; if (k === 'nw' || k === 'nh') st.last = k; upd(); } });
  const W = f('w', 'Width'), H = f('h', 'Height'), NW = f('nw', 'New width'), NH = f('nh', 'New height');
  const pre = chips(COMMON_AR.slice(0, 8).map(([a, b]) => [`${a}:${b}`, `${a}:${b}`]), v => { const [a, b] = v.split(':').map(Number); st.w = String(a); st.h = String(b); W.set(st.w); H.set(st.h); upd(); });
  root.append(h('h3', { class: 'sec-title' }, 'Original'), h('div', { class: 'card form' }, row('Width', W), row('Height', H), h('div', { class: 'frow nolabel' }, pre)), out,
    h('h3', { class: 'sec-title' }, 'Resize (keep proportions)'), h('div', { class: 'card form' }, row('New width', NW), row('New height', NH)), out2);
  function upd() {
    save();
    const w = parseNum(st.w), hh = parseNum(st.h);
    if (!(w > 0 && hh > 0)) { out.render([{ note: 'Enter width and height.' }]); out2.render([]); return; }
    const k = 10 ** Math.min(4, Math.max(dec(w), dec(hh))); const a = Math.round(w * k), b = Math.round(hh * k), g = gcd(a, b);
    const r = w / hh;
    const near = COMMON_AR.map(([x, y]) => [x, y, Math.abs(x / y - r)]).sort((p, q) => p[2] - q[2])[0];
    out.render([R('Aspect ratio', `${a / g}:${b / g}`, { big: true, sub: `${fmt(r, { maxDec: 4 })} : 1${near[2] < 0.01 && `${a / g}:${b / g}` !== `${near[0]}:${near[1]}` ? ` · ≈ ${near[0]}:${near[1]}` : ''}` }), R('Orientation', r > 1 ? 'Landscape' : r < 1 ? 'Portrait' : 'Square'), R('Pixels', `${fmt(w * hh / 1e6, { maxDec: 2 })} MP`)]);
    if (st.last === 'nw') { const nw = parseNum(st.nw); if (nw > 0) { const nh = nw / r; NH.set(fmt(nh, { maxDec: 2, group: false })); out2.render([R('New size', `${fmt(nw)} × ${fmt(nh, { maxDec: 2 })}`, { big: true, sub: `${fmt(nw / w * 100, { maxDec: 1 })} % of the original` })]); } else out2.render([]); }
    else { const nh = parseNum(st.nh); if (nh > 0) { const nw = nh * r; NW.set(fmt(nw, { maxDec: 2, group: false })); out2.render([R('New size', `${fmt(nw, { maxDec: 2 })} × ${fmt(nh)}`, { big: true, sub: `${fmt(nh / hh * 100, { maxDec: 1 })} % of the original` })]); } else out2.render([]); }
  }
  upd();
}

/* ---------- Shapes: area, perimeter, volume ---------- */
const SHAPES = {
  square: { name: 'Square', d: 2, f: ['a'], L: { a: 'Side' }, area: v => v.a ** 2, per: v => 4 * v.a },
  rect: { name: 'Rectangle', d: 2, f: ['a', 'b'], L: { a: 'Length', b: 'Width' }, area: v => v.a * v.b, per: v => 2 * (v.a + v.b), extra: v => [['Diagonal', Math.hypot(v.a, v.b)]] },
  circle: { name: 'Circle', d: 2, f: ['r'], L: { r: 'Radius' }, area: v => Math.PI * v.r ** 2, per: v => 2 * Math.PI * v.r, extra: v => [['Diameter', 2 * v.r]], perName: 'Circumference' },
  tri: { name: 'Triangle (base × height)', d: 2, f: ['b', 'hh'], L: { b: 'Base', hh: 'Height' }, area: v => v.b * v.hh / 2 },
  tri3: { name: 'Triangle (3 sides)', d: 2, f: ['a', 'b', 'c'], L: { a: 'Side a', b: 'Side b', c: 'Side c' }, area: v => { const s = (v.a + v.b + v.c) / 2; const q = s * (s - v.a) * (s - v.b) * (s - v.c); return q > 0 ? Math.sqrt(q) : NaN; }, per: v => v.a + v.b + v.c },
  right: { name: 'Right triangle', d: 2, f: ['a', 'b'], L: { a: 'Leg a', b: 'Leg b' }, area: v => v.a * v.b / 2, per: v => v.a + v.b + Math.hypot(v.a, v.b), extra: v => [['Hypotenuse', Math.hypot(v.a, v.b)]] },
  trap: { name: 'Trapezoid', d: 2, f: ['a', 'b', 'hh'], L: { a: 'Top side', b: 'Bottom side', hh: 'Height' }, area: v => (v.a + v.b) / 2 * v.hh },
  para: { name: 'Parallelogram', d: 2, f: ['b', 'hh'], L: { b: 'Base', hh: 'Height' }, area: v => v.b * v.hh },
  ellipse: { name: 'Ellipse', d: 2, f: ['a', 'b'], L: { a: 'Semi-axis a', b: 'Semi-axis b' }, area: v => Math.PI * v.a * v.b, per: v => { const hh = ((v.a - v.b) / (v.a + v.b)) ** 2; return Math.PI * (v.a + v.b) * (1 + 3 * hh / (10 + Math.sqrt(4 - 3 * hh))); }, perName: 'Perimeter (approx.)' },
  ring: { name: 'Ring (annulus)', d: 2, f: ['R', 'r'], L: { R: 'Outer radius', r: 'Inner radius' }, area: v => Math.PI * (v.R ** 2 - v.r ** 2) },
  poly: { name: 'Regular polygon', d: 2, f: ['n', 'a'], L: { n: 'Number of sides', a: 'Side' }, plain: ['n'], area: v => v.n * v.a ** 2 / (4 * Math.tan(Math.PI / v.n)), per: v => v.n * v.a },
  cube: { name: 'Cube', d: 3, f: ['a'], L: { a: 'Side' }, vol: v => v.a ** 3, surf: v => 6 * v.a ** 2 },
  box: { name: 'Box (cuboid)', d: 3, f: ['a', 'b', 'c'], L: { a: 'Length', b: 'Width', c: 'Height' }, vol: v => v.a * v.b * v.c, surf: v => 2 * (v.a * v.b + v.b * v.c + v.a * v.c) },
  sphere: { name: 'Sphere', d: 3, f: ['r'], L: { r: 'Radius' }, vol: v => 4 / 3 * Math.PI * v.r ** 3, surf: v => 4 * Math.PI * v.r ** 2 },
  hemi: { name: 'Hemisphere', d: 3, f: ['r'], L: { r: 'Radius' }, vol: v => 2 / 3 * Math.PI * v.r ** 3, surf: v => 3 * Math.PI * v.r ** 2 },
  cyl: { name: 'Cylinder', d: 3, f: ['r', 'hh'], L: { r: 'Radius', hh: 'Height' }, vol: v => Math.PI * v.r ** 2 * v.hh, surf: v => 2 * Math.PI * v.r * (v.r + v.hh) },
  cone: { name: 'Cone', d: 3, f: ['r', 'hh'], L: { r: 'Radius', hh: 'Height' }, vol: v => Math.PI * v.r ** 2 * v.hh / 3, surf: v => Math.PI * v.r * (v.r + Math.hypot(v.r, v.hh)) },
  pyr: { name: 'Pyramid (square base)', d: 3, f: ['a', 'hh'], L: { a: 'Base side', hh: 'Height' }, vol: v => v.a ** 2 * v.hh / 3, surf: v => v.a ** 2 + 2 * v.a * Math.hypot(v.a / 2, v.hh) },
};
const LEN_U = [['mm', 1e-3], ['cm', 1e-2], ['m', 1], ['in', 0.0254], ['ft', 0.3048], ['yd', 0.9144]];
function mountShapes(root, ctx) {
  const st = Object.assign({ s: 'rect', u: settings.system === 'metric' ? 'm' : 'ft', v: { a: '4', b: '3', c: '2', r: '1', R: '2', hh: '2', n: '6' } }, ctx.state || {});
  const save = () => ctx.save(st);
  const formCard = h('div', { class: 'card form' });
  const out = results();
  const sel = selectEl([{ group: 'Flat shapes (area)', options: Object.entries(SHAPES).filter(([, s]) => s.d === 2).map(([k, s]) => [k, s.name]) }, { group: 'Solids (volume)', options: Object.entries(SHAPES).filter(([, s]) => s.d === 3).map(([k, s]) => [k, s.name]) }], st.s, v => { st.s = v; draw(); }, { aria: 'Shape' });
  const usel = seg(LEN_U.map(([u]) => [u, u]), st.u, v => { st.u = v; draw(); }, { aria: 'Unit' });
  root.append(h('div', { class: 'card form' }, row('Shape', sel), h('div', { class: 'frow seg-row' }, usel)), formCard, out,
    h('p', { class: 'note' }, 'Pool or aquarium? Use “Box” or “Cylinder”: the volume is shown in liters and gallons too.'));
  function draw() {
    const sh = SHAPES[st.s];
    formCard.replaceChildren(...sh.f.map(k => row(sh.L[k], numField({ value: st.v[k] ?? '', suffix: sh.plain?.includes(k) ? '' : st.u, aria: sh.L[k], onInput: (n, raw) => { st.v[k] = raw; upd(); } }))));
    upd();
  }
  function upd() {
    save();
    const sh = SHAPES[st.s];
    const f = LEN_U.find(x => x[0] === st.u)[1];
    const v = {};
    for (const k of sh.f) { const n = parseNum(st.v[k]); if (!(n > 0)) return out.render([{ note: 'Fill in all dimensions.' }]); v[k] = n; }
    if (st.s === 'ring' && v.r >= v.R) return out.render([{ note: 'The inner radius must be smaller.' }]);
    const u = st.u, u2 = u + '²', u3 = u + '³';
    const items = [];
    if (sh.d === 2) {
      const A = sh.area(v);
      const m2 = A * f * f;
      items.push(R('Area', `${fmt(A)} ${u2}`, { big: true, sub: [u !== 'm' ? `${fmt(m2)} m²` : null, u !== 'ft' ? `${fmt(m2 / 0.09290304)} ft²` : null].filter(Boolean).join(' · ') }));
      if (sh.per) items.push(R(sh.perName || 'Perimeter', `${fmt(sh.per(v))} ${u}`));
    } else {
      const V = sh.vol(v), m3 = V * f ** 3;
      items.push(R('Volume', `${fmt(V)} ${u3}`, { big: true, sub: `${fmt(m3 * 1000)} L · ${fmt(m3 * 1000 / 3.785411784)} US gal · ${fmt(m3)} m³` }));
      items.push(R('Surface area', `${fmt(sh.surf(v))} ${u2}`));
    }
    (sh.extra?.(v) || []).forEach(([k, x]) => items.push(R(k, `${fmt(x)} ${u}`)));
    out.render(items);
  }
  draw();
}

/* ---------- Numbers in words (English / French) ---------- */
const EN1 = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const EN10 = ',,twenty,thirty,forty,fifty,sixty,seventy,eighty,ninety'.split(',');
function en999(n, and) {
  const hh = Math.floor(n / 100), r = n % 100, out = [];
  if (hh) out.push(EN1[hh] + ' hundred');
  if (r) { if (hh && and) out.push('and'); out.push(r < 20 ? EN1[r] : EN10[Math.floor(r / 10)] + (r % 10 ? '-' + EN1[r % 10] : '')); }
  return out.join(' ');
}
export function toWordsEN(n, and = false) {
  if (n === 0) return 'zero';
  const scales = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion'];
  const parts = []; let i = 0;
  const low = n % 1000;
  while (n > 0) { const c = n % 1000; if (c) parts.unshift(en999(c, and) + scales[i]); n = Math.floor(n / 1000); i++; }
  if (and && parts.length > 1 && low > 0 && low < 100) parts.splice(parts.length - 1, 0, 'and');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const FR1 = 'zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize'.split(' ');
function fr99(n, v) {
  if (n <= 16) return FR1[n];
  if (n < 20) return 'dix-' + FR1[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  const T = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'soixante', 8: 'quatre-vingt', 9: 'quatre-vingt' };
  if (v !== 'FR' && t === 7) return 'septante' + (u === 1 ? ' et un' : u ? '-' + FR1[u] : '');
  if (v !== 'FR' && t === 9) return 'nonante' + (u === 1 ? ' et un' : u ? '-' + FR1[u] : '');
  if (v === 'CH' && t === 8) return 'huitante' + (u === 1 ? ' et un' : u ? '-' + FR1[u] : '');
  if (t === 7 || t === 9) { const r = 10 + u; return T[t] + (r === 11 && t === 7 ? ' et onze' : '-' + fr99(r, v)); }
  if (t === 8) return u ? 'quatre-vingt-' + FR1[u] : 'quatre-vingts';
  return T[t] + (u === 1 ? ' et un' : u ? '-' + FR1[u] : '');
}
function fr999(n, v, last) {
  const hh = Math.floor(n / 100), r = n % 100;
  let s = '';
  if (hh) s = (hh > 1 ? FR1[hh] + ' ' : '') + 'cent' + (hh > 1 && !r && last ? 's' : '');
  if (r) s += (s ? ' ' : '') + fr99(r, v);
  if (!last) s = s.replace(/quatre-vingts$/, 'quatre-vingt');
  return s;
}
export function toWordsFR(n, v = 'FR') {
  if (n === 0) return 'zéro';
  const out = [];
  const units = [[1e12, 'billion'], [1e9, 'milliard'], [1e6, 'million']];
  for (const [k, w] of units) { const c = Math.floor(n / k); if (c) { out.push(fr999(c, v, true) + ' ' + w + (c > 1 ? 's' : '')); n -= c * k; } }
  const th = Math.floor(n / 1000);
  if (th) { out.push(th === 1 ? 'mille' : fr999(th, v, false) + ' mille'); n -= th * 1000; }
  if (n) out.push(fr999(n, v, true));
  return out.join(' ');
}
const CUR_WORDS = {
  EUR: { en: ['euro', 'euros', 'cent', 'cents'], fr: ['euro', 'euros', 'centime', 'centimes'] },
  USD: { en: ['dollar', 'dollars', 'cent', 'cents'], fr: ['dollar', 'dollars', 'cent', 'cents'] },
  CAD: { en: ['dollar', 'dollars', 'cent', 'cents'], fr: ['dollar', 'dollars', 'cent', 'cents'] },
  GBP: { en: ['pound', 'pounds', 'penny', 'pence'], fr: ['livre', 'livres', 'penny', 'pence'] },
  CHF: { en: ['franc', 'francs', 'centime', 'centimes'], fr: ['franc', 'francs', 'centime', 'centimes'] },
  MAD: { en: ['dirham', 'dirhams', 'centime', 'centimes'], fr: ['dirham', 'dirhams', 'centime', 'centimes'] },
};
function mountWords(root, ctx) {
  const frish = /^fr/i.test(navigator.language || '') || ['FR', 'BE', 'CH', 'LU', 'MA', 'DZ', 'TN', 'SN', 'CI'].includes(settings.country);
  const st = Object.assign({ n: '1234.5', lang: frish ? 'fr' : 'en', mode: 'amt', cur: CUR_WORDS[settings.currency] ? settings.currency : 'EUR', v: settings.country === 'BE' ? 'BE' : settings.country === 'CH' ? 'CH' : 'FR', and: settings.system === 'uk' }, ctx.state || {});
  const out = results();
  const opts = h('div');
  const nIn = numField({ value: st.n, aria: 'Number', big: true, onInput: (n, raw) => { st.n = raw; upd(); } });
  root.append(h('div', { class: 'card form' }, row('Number', nIn),
    h('div', { class: 'frow seg-row' }, seg([['en', 'English'], ['fr', 'Français']], st.lang, v => { st.lang = v; drawOpts(); upd(); })),
    h('div', { class: 'frow seg-row' }, seg([['num', 'Number'], ['amt', 'Amount (cheque)']], st.mode, v => { st.mode = v; drawOpts(); upd(); })), opts), out);
  function drawOpts() {
    const kids = [];
    if (st.mode === 'amt') kids.push(row('Currency', selectEl(Object.keys(CUR_WORDS).map(c => [c, c]), st.cur, v => { st.cur = v; upd(); })));
    if (st.lang === 'fr') kids.push(row('Variante', selectEl([['FR', 'France (soixante-dix)'], ['BE', 'Belgique (septante, nonante)'], ['CH', 'Suisse (huitante)']], st.v, v => { st.v = v; upd(); })));
    if (st.lang === 'en') kids.push(h('div', { class: 'frow toggle-row' }, toggle('British style (“and”)', st.and, v => { st.and = v; upd(); })));
    opts.replaceChildren(...kids);
  }
  function upd() {
    ctx.save(st);
    const x = parseNum(st.n);
    if (!Number.isFinite(x) || Math.abs(x) >= 1e15) return out.render([{ note: 'Enter a number (up to 999 trillion).' }]);
    const neg = x < 0; const a = Math.abs(x);
    let int = Math.floor(a), frac = Math.round((a - int) * 100);
    if (frac === 100) { int++; frac = 0; }
    const W = n => (st.lang === 'fr' ? toWordsFR(n, st.v) : toWordsEN(n, st.and));
    let text;
    if (st.mode === 'amt') {
      const cw = CUR_WORDS[st.cur][st.lang];
      const big = /(million|milliard|billion)s?$/.test(W(int)) && st.lang === 'fr';
      const curName = int === 1 || (int === 0 && st.lang === 'fr') ? cw[0] : cw[1];
      text = `${W(int)} ${big ? (/^[aeiouy]/.test(curName) ? 'd’' : 'de ') : ''}${curName}`.replace('d’ ', 'd’').replace(/ d’/, ' d’');
      if (frac) text += ` ${st.lang === 'fr' ? 'et' : 'and'} ${W(frac)} ${frac > 1 ? cw[3] : cw[2]}`;
    } else {
      text = W(int);
      const decStr = String(st.n).replace(/^.*[.,]/, '');
      if (a !== int && /[.,]/.test(String(st.n))) text += (st.lang === 'fr' ? ' virgule ' : ' point ') + (st.lang === 'fr' ? decStr.replace(/^(0*)(\d+)$/, (m, z, d) => (z ? z.split('').map(() => 'zéro').join(' ') + ' ' : '') + W(+d)) : decStr.split('').map(d => EN1[+d]).join(' '));
    }
    if (neg) text = (st.lang === 'fr' ? 'moins ' : 'minus ') + text;
    const cap = text.charAt(0).toUpperCase() + text.slice(1);
    out.render([R(st.mode === 'amt' ? fmt(x, { dec: 2, minDec: 2 }) + ' ' + st.cur : fmt(x, { sig: 15 }), cap, { big: true, copy: cap }), { note: 'Tap to copy. ' + (st.lang === 'fr' ? 'Orthographe traditionnelle (traits d’union sous cent).' : '') }]);
  }
  drawOpts(); upd();
}

/* ---------- Random ---------- */
const rnd = n => { const a = new Uint32Array(1); const lim = Math.floor(0x100000000 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; };
function mountRandom(root, ctx) {
  const st = Object.assign({ tab: 'num', min: '1', max: '100', count: '1', uniq: true, dice: 2, sides: 6, list: 'Alice\nBob\nCharlie\nDiana', coins: { h: 0, t: 0 } }, ctx.state || {});
  const save = () => ctx.save(st);
  const t = tabs([['num', 'Number'], ['dice', 'Dice'], ['coin', 'Coin'], ['list', 'List']], st.tab, v => { st.tab = v; save(); });
  root.append(t.el);
  // number
  const nOut = h('div', { class: 'card display' });
  const f = (k, l, neg = true) => numField({ value: st[k], aria: l, negative: neg, onInput: (n, raw) => { st[k] = raw; save(); } });
  const goN = () => {
    const a = Math.ceil(parseNum(st.min)), b = Math.floor(parseNum(st.max)), c = Math.max(1, Math.min(1000, Math.round(parseNum(st.count) || 1)));
    if (!(Number.isFinite(a) && Number.isFinite(b) && b >= a)) return toast('Check min and max');
    const span = b - a + 1;
    if (st.uniq && c > span) return toast(`Only ${span} different numbers available`);
    const out = []; const seen = new Set();
    while (out.length < c) { const x = a + rnd(span); if (st.uniq && seen.has(x)) continue; seen.add(x); out.push(x); }
    nOut.replaceChildren(h('div', { class: 'd-big' }, out.join(', ')), h('div', { class: 'd-sub' }, `between ${a} and ${b}`));
  };
  t.panes.num.append(h('div', { class: 'card form' }, row('From', f('min', 'From')), row('To', f('max', 'To')), row('How many', f('count', 'How many', false)), h('div', { class: 'frow toggle-row' }, toggle('No repeats', st.uniq, v => { st.uniq = v; save(); }))),
    h('button', { class: 'btn cat block', type: 'button', onclick: goN }, icon('dice'), 'Generate'), nOut);
  // dice
  const dOut = h('div', { class: 'card pad' });
  const goD = () => {
    const rolls = Array.from({ length: st.dice }, () => 1 + rnd(st.sides));
    dOut.replaceChildren(h('div', { class: 'dice' }, rolls.map(r => h('span', { class: 'die' }, String(r)))), h('div', { class: 'display' }, h('div', { class: 'd-big' }, String(rolls.reduce((a, b) => a + b, 0))), h('div', { class: 'd-sub' }, `total of ${st.dice} × d${st.sides}`)));
  };
  t.panes.dice.append(h('div', { class: 'card form' }, row('Dice', stepper(st.dice, { min: 1, max: 12, onChange: v => { st.dice = v; save(); } })), h('div', { class: 'frow seg-row' }, seg([4, 6, 8, 10, 12, 20, 100].map(s => [s, 'd' + s]), st.sides, v => { st.sides = v; save(); }))),
    h('button', { class: 'btn cat block', type: 'button', onclick: goD }, icon('dice'), 'Roll'), dOut);
  // coin
  const cOut = h('div', { class: 'card display' });
  const goC = () => { const head = rnd(2) === 0; st.coins[head ? 'h' : 't']++; save(); cOut.replaceChildren(h('div', { class: 'd-big' }, head ? 'Heads' : 'Tails'), h('div', { class: 'd-sub' }, `So far: ${st.coins.h} heads · ${st.coins.t} tails`)); };
  t.panes.coin.append(h('button', { class: 'btn cat block', type: 'button', onclick: goC }, 'Flip a coin'), cOut,
    h('button', { class: 'btn ghost', type: 'button', onclick: () => { st.coins = { h: 0, t: 0 }; save(); cOut.replaceChildren(); } }, 'Reset count'));
  // list
  const lOut = h('div', { class: 'card pad' });
  const ta = h('textarea', { class: 'text-area', rows: 6, 'aria-label': 'One item per line' }); ta.value = st.list;
  ta.addEventListener('input', () => { st.list = ta.value; save(); });
  const items = () => st.list.split('\n').map(s => s.trim()).filter(Boolean);
  const pickOne = () => { const a = items(); if (!a.length) return toast('Add some items'); lOut.replaceChildren(h('div', { class: 'display' }, h('div', { class: 'd-big' }, a[rnd(a.length)]), h('div', { class: 'd-sub' }, `picked from ${a.length}`))); };
  const shuffle = () => { const a = items(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } lOut.replaceChildren(h('ol', { class: 'shuffled' }, a.map(x => h('li', null, x)))); };
  t.panes.list.append(h('div', { class: 'card pad' }, h('label', { class: 'muted small' }, 'One item per line'), ta), h('div', { class: 'two' }, h('button', { class: 'btn cat', type: 'button', onclick: pickOne }, 'Pick one'), h('button', { class: 'btn', type: 'button', onclick: shuffle }, 'Shuffle')), lOut);
}

export const tools = {
  percentage: { mount: mountPercentage },
  ratio, stats,
  fractions: { mount: mountFractions },
  bases: { mount: mountBases },
  roman: { mount: mountRoman },
  aspect: { mount: mountAspect },
  shapes: { mount: mountShapes },
  words: { mount: mountWords },
  random: { mount: mountRandom },
};
void unitInput; void unitsOf;
