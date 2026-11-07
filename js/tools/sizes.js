// Sizes & reference: clothing tables, paper sizes, screen PPI, tire sizes.
import { h, copyText, norm, icon } from '../core/dom.js';
import { parseNum, fmt } from '../core/num.js';
import { numField, seg, selectEl, row, results, chips } from '../core/ui.js';
import { ok, okPos } from '../core/form.js';
import { settings } from '../core/store.js';

/* ---------- Clothing ---------- */
const CLOTHES = {
  women: {
    name: 'Women · tops & dresses', cols: ['Size', 'US', 'UK', 'EU / DE', 'FR / ES', 'IT', 'JP', 'Bust cm'],
    rows: [['XXS', '0', '4', '30', '32', '36', '3', '78–80'], ['XS', '2', '6', '32', '34', '38', '5', '80–83'], ['S', '4', '8', '34', '36', '40', '7', '84–87'], ['M', '6', '10', '36', '38', '42', '9', '88–91'], ['M', '8', '12', '38', '40', '44', '11', '92–95'], ['L', '10', '14', '40', '42', '46', '13', '96–99'], ['L', '12', '16', '42', '44', '48', '15', '100–103'], ['XL', '14', '18', '44', '46', '50', '17', '104–107'], ['XL', '16', '20', '46', '48', '52', '19', '108–111'], ['XXL', '18', '22', '48', '50', '54', '21', '112–115'], ['XXL', '20', '24', '50', '52', '56', '23', '116–119']],
  },
  jeansw: {
    name: 'Women · jeans', cols: ['Waist (in)', 'US', 'UK', 'EU', 'FR', 'IT', 'Waist cm'],
    rows: [['24', '00', '4', '30', '32', '36', '61'], ['25', '0', '6', '32', '34', '38', '64'], ['26', '2', '8', '34', '36', '40', '66'], ['27', '4', '8–10', '34–36', '36–38', '40–42', '69'], ['28', '6', '10', '36', '38', '42', '71'], ['29', '8', '12', '38', '40', '44', '74'], ['30', '10', '14', '40', '42', '46', '76'], ['31', '12', '16', '42', '44', '48', '79'], ['32', '14', '18', '44', '46', '50', '81']],
  },
  suits: {
    name: 'Men · suits & jackets', cols: ['Size', 'US / UK (chest in)', 'EU / FR / IT', 'Chest cm'],
    rows: [['XS', '34', '44', '86'], ['S', '36', '46', '91'], ['M', '38', '48', '97'], ['M', '40', '50', '102'], ['L', '42', '52', '107'], ['XL', '44', '54', '112'], ['XL', '46', '56', '117'], ['XXL', '48', '58', '122'], ['XXL', '50', '60', '127'], ['3XL', '52', '62', '132']],
  },
  shirts: {
    name: 'Men · shirts (collar)', cols: ['Size', 'Collar (in)', 'Collar (cm) / EU', 'Chest cm'],
    rows: [['XS', '14', '36', '86–91'], ['S', '14½', '37', '91–96'], ['S', '15', '38', '91–96'], ['M', '15½', '39', '96–101'], ['M', '16', '40–41', '101–106'], ['L', '16½', '42', '106–111'], ['L', '17', '43', '111–116'], ['XL', '17½', '44', '116–121'], ['XXL', '18', '45–46', '121–126'], ['3XL', '18½', '47', '126–131']],
  },
  trousers: {
    name: 'Men · trousers & jeans', cols: ['Size', 'Waist (in)', 'EU / DE', 'FR', 'IT', 'Waist cm'],
    rows: [['XS', '28', '42', '38', '42', '71'], ['S', '29', '44', '39', '44', '74'], ['S', '30', '46', '40', '46', '76'], ['M', '31', '46', '41', '46', '79'], ['M', '32', '48', '42', '48', '81'], ['L', '34', '50', '44', '50', '86'], ['L', '36', '52', '46', '52', '91'], ['XL', '38', '54', '48', '54', '97'], ['XXL', '40', '56', '50', '56', '102'], ['XXL', '42', '58', '52', '58', '107'], ['3XL', '44', '60', '54', '60', '112']],
  },
  kids: {
    name: 'Kids', cols: ['Age', 'Height cm', 'US', 'UK', 'EU / FR (cm)'],
    rows: [['0–3 m', '56–62', '0–3M', '0–3 m', '56–62'], ['3–6 m', '62–68', '3–6M', '3–6 m', '62–68'], ['6–12 m', '68–80', '6–12M', '6–12 m', '74–80'], ['1–2 y', '80–92', '2T', '1–2 y', '86–92'], ['2–3 y', '92–98', '3T', '2–3 y', '98'], ['3–4 y', '98–104', '4T', '3–4 y', '104'], ['4–5 y', '104–110', '5', '4–5 y', '110'], ['6 y', '110–116', '6', '5–6 y', '116'], ['7 y', '116–122', '7', '6–7 y', '122'], ['8 y', '122–128', '8', '7–8 y', '128'], ['10 y', '134–140', '10', '9–10 y', '140'], ['12 y', '146–152', '12', '11–12 y', '152'], ['14 y', '158–164', '14', '13–14 y', '164']],
  },
};
function mountClothing(root, ctx) {
  const st = Object.assign({ t: 'women', hi: 3 }, ctx.state || {});
  const box = h('div');
  const sel = selectEl(Object.entries(CLOTHES).map(([k, c]) => [k, c.name]), st.t, v => { st.t = v; st.hi = -1; draw(); }, { aria: 'Type' });
  root.append(h('div', { class: 'card form' }, row('Type', sel)), h('p', { class: 'fact' }, 'Tap a row to highlight your size.'), box,
    h('p', { class: 'note' }, 'Standard equivalents. Brands (especially fast fashion and Asian brands) often run a size small or large: check their own chart when you can.'));
  function draw() {
    ctx.save(st);
    const c = CLOTHES[st.t];
    box.replaceChildren(h('div', { class: 'card pad' }, h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl click sizes-tbl' },
      h('thead', null, h('tr', null, c.cols.map(x => h('th', null, x)))),
      h('tbody', null, c.rows.map((r, i) => h('tr', { class: i === st.hi ? 'hi' : null, onclick: () => { st.hi = i === st.hi ? -1 : i; draw(); } }, r.map(x => h('td', null, x)))))))));
  }
  draw();
}

/* ---------- Paper sizes ---------- */
const IN = 25.4;
const PAPER = [
  ['ISO A', [['A0', 841, 1189], ['A1', 594, 841], ['A2', 420, 594], ['A3', 297, 420], ['A4', 210, 297, 'Standard letter paper (most of the world)'], ['A5', 148, 210, 'Notebook'], ['A6', 105, 148, 'Postcard'], ['A7', 74, 105], ['A8', 52, 74]]],
  ['ISO B', [['B0', 1000, 1414], ['B1', 707, 1000], ['B2', 500, 707], ['B3', 353, 500], ['B4', 250, 353], ['B5', 176, 250, 'Books, notebooks'], ['B6', 125, 176], ['B7', 88, 125]]],
  ['Envelopes', [['C4', 229, 324, 'Holds A4 flat'], ['C5', 162, 229, 'Holds A4 folded once'], ['C6', 114, 162, 'Holds A4 folded twice'], ['DL', 110, 220, 'Holds A4 folded in three'], ['US #10', 4.125 * IN, 9.5 * IN, 'Holds Letter folded in three']]],
  ['North America', [['Letter', 8.5 * IN, 11 * IN, 'US standard'], ['Legal', 8.5 * IN, 14 * IN], ['Tabloid / Ledger', 11 * IN, 17 * IN], ['Executive', 7.25 * IN, 10.5 * IN], ['Half Letter', 5.5 * IN, 8.5 * IN], ['Junior Legal', 5 * IN, 8 * IN]]],
  ['Photos', [['9 × 13 cm (3.5 × 5″)', 89, 127], ['10 × 15 cm (4 × 6″)', 4 * IN, 6 * IN, 'Standard print'], ['13 × 18 cm (5 × 7″)', 5 * IN, 7 * IN], ['15 × 20 cm (6 × 8″)', 6 * IN, 8 * IN], ['20 × 25 cm (8 × 10″)', 8 * IN, 10 * IN], ['20 × 30 cm (8 × 12″)', 203, 305], ['30 × 40 cm', 300, 400], ['30 × 45 cm (12 × 18″)', 12 * IN, 18 * IN], ['Passport photo (EU)', 35, 45], ['Passport photo (US)', 2 * IN, 2 * IN]]],
  ['Cards', [['Credit card (ID-1)', 85.6, 53.98], ['Business card (EU)', 85, 55], ['Business card (US)', 3.5 * IN, 2 * IN], ['Business card (Japan)', 91, 55]]],
];
function mountPaper(root, ctx) {
  const st = Object.assign({ u: settings.system === 'us' ? 'in' : 'mm', dpi: '300', q: '' }, ctx.state || {});
  const list = h('div');
  const q = h('input', { class: 'search-in', type: 'search', placeholder: 'Filter: A4, letter, photo…', value: st.q, autocomplete: 'off', 'aria-label': 'Filter sizes' });
  q.addEventListener('input', () => { st.q = q.value; draw(); });
  const useg = seg([['mm', 'mm'], ['cm', 'cm'], ['in', 'inches'], ['px', 'pixels']], st.u, v => { st.u = v; dpiRow.hidden = v !== 'px'; draw(); });
  const dpi = numField({ value: st.dpi, suffix: 'dpi', aria: 'DPI', onInput: (n, raw) => { st.dpi = raw; draw(); } });
  const dpiRow = row('Resolution', dpi, { hint: '300 for print, 72–96 for screen' });
  dpiRow.hidden = st.u !== 'px';
  root.append(h('div', { class: 'card form' }, h('div', { class: 'frow seg-row' }, useg), dpiRow), h('div', { class: 'search-box', style: { marginBottom: '14px', background: 'var(--surface)' } }, icon('search'), q), list);
  const f = mm => {
    if (st.u === 'mm') return fmt(mm, { maxDec: 1 });
    if (st.u === 'cm') return fmt(mm / 10, { maxDec: 2 });
    if (st.u === 'in') return fmt(mm / IN, { maxDec: 2 });
    return fmt(Math.round(mm / IN * (parseNum(st.dpi) || 300)), { dec: 0 });
  };
  function draw() {
    ctx.save(st);
    const qq = norm(st.q);
    const unit = st.u === 'px' ? 'px' : st.u === 'in' ? 'in' : st.u;
    list.replaceChildren(...PAPER.flatMap(([g, items]) => {
      const hits = items.filter(([n, , , d]) => !qq || norm(n).includes(qq) || norm(g).includes(qq) || norm(d || '').includes(qq));
      if (!hits.length) return [];
      return [h('h3', { class: 'sec-title' }, g), h('div', { class: 'card list' }, hits.map(([n, w, hh, d]) => {
        const txt = `${f(w)} × ${f(hh)} ${unit}`;
        return h('button', { class: 'li btn-li', type: 'button', onclick: () => copyText(txt, `${n}: ${txt}`) }, h('span', { class: 'li-main' }, h('span', { class: 'li-title' }, n), d ? h('span', { class: 'li-sub' }, d) : null), h('b', { class: 'li-price' }, txt));
      }))];
    }));
  }
  draw();
}

/* ---------- Screen & PPI ---------- */
const RES = [['1366x768', 'HD'], ['1920x1080', 'Full HD'], ['2560x1440', 'QHD'], ['3840x2160', '4K'], ['5120x2880', '5K'], ['7680x4320', '8K'], ['2556x1179', 'iPhone']];
const screenSpec = {
  fields: [
    { id: 'diag', type: 'num', label: 'Diagonal', suffix: 'inches', default: '27', presets: [[6.1, '6.1″'], [13.3, '13.3″'], [15.6, '15.6″'], [24, '24″'], [27, '27″'], [32, '32″'], [55, '55″'], [65, '65″']] },
    { id: 'w', type: 'num', label: 'Width', suffix: 'px', default: '2560' },
    { id: 'hh', type: 'num', label: 'Height', suffix: 'px', default: '1440' },
  ],
  compute(v) {
    if (!okPos(v.diag) || !okPos(v.w) || !okPos(v.hh)) return [{ note: 'Enter the diagonal and the resolution.' }];
    const px = Math.hypot(v.w, v.hh), ppi = px / v.diag;
    const wIn = v.diag * v.w / px, hIn = v.diag * v.hh / px;
    const g = (a, b) => (b ? g(b, a % b) : a), k = g(Math.round(v.w), Math.round(v.hh));
    const retina = 1 / (ppi * Math.tan(Math.PI / 180 / 60));
    return [
      { k: 'Pixel density', v: `${fmt(ppi, { maxDec: 1 })} PPI`, big: true, sub: `${fmt(25.4 / ppi, { maxDec: 3 })} mm per pixel (dot pitch)` },
      { k: 'Screen width', v: `${fmt(wIn * 2.54, { maxDec: 1 })} cm`, sub: `${fmt(wIn, { maxDec: 1 })} in` },
      { k: 'Screen height', v: `${fmt(hIn * 2.54, { maxDec: 1 })} cm`, sub: `${fmt(hIn, { maxDec: 1 })} in` },
      { k: 'Diagonal', v: `${fmt(v.diag * 2.54, { maxDec: 1 })} cm` },
      { k: 'Aspect ratio', v: `${Math.round(v.w) / k}:${Math.round(v.hh) / k}` },
      { k: 'Total pixels', v: `${fmt(v.w * v.hh / 1e6, { maxDec: 2 })} MP` },
      { k: 'Pixels invisible beyond', v: `${fmt(retina * 2.54, { maxDec: 0 })} cm`, sub: `${fmt(retina, { maxDec: 0 })} in viewing distance (20/20 vision)` },
    ];
  },
};

/* ---------- Tire size ---------- */
function tireDims(w, ar, rim) { const side = w * ar / 100; const d = rim * 25.4 + 2 * side; return { side, d, c: Math.PI * d }; }
function mountTires(root, ctx) {
  const st = Object.assign({ a: ['205', '55', '16'], b: ['225', '45', '17'], cmp: true }, ctx.state || {});
  const out = results();
  const tire = (k, title) => {
    const f = (i, label, sfx) => numField({ value: st[k][i], aria: `${title} ${label}`, suffix: sfx, onInput: (n, raw) => { st[k][i] = raw; upd(); } });
    return h('div', { class: 'card form' }, h('div', { class: 'frow nolabel' }, h('b', null, title)),
      h('div', { class: 'tire-in' }, f(0, 'width', 'mm'), h('span', null, '/'), f(1, 'aspect ratio', '%'), h('span', null, 'R'), f(2, 'rim', 'in')));
  };
  root.append(h('p', { class: 'fact' }, 'Read the size on the sidewall, e.g. 205/55 R16.'), tire('a', 'Current tire'), tire('b', 'New tire (compare)'), out,
    h('p', { class: 'note' }, 'Keep the diameter within about 3 % of the original to avoid speedometer and ABS issues. Check your vehicle’s approved sizes.'));
  function upd() {
    ctx.save(st);
    const A = st.a.map(parseNum), B = st.b.map(parseNum);
    if (!A.every(x => x > 0)) return out.render([{ note: 'Enter width, aspect ratio and rim size.' }]);
    const a = tireDims(...A);
    const items = [
      { k: `${A[0]}/${A[1]} R${A[2]}: diameter`, v: `${fmt(a.d, { maxDec: 0 })} mm`, big: true, sub: `${fmt(a.d / 25.4, { maxDec: 1 })} in · sidewall ${fmt(a.side, { maxDec: 0 })} mm` },
      { k: 'Circumference', v: `${fmt(a.c / 1000, { maxDec: 3 })} m` },
      { k: 'Revolutions', v: `${fmt(1e6 / a.c, { maxDec: 0 })} per km`, sub: `${fmt(1609344 / a.c, { maxDec: 0 })} per mile` },
    ];
    if (B.every(x => x > 0)) {
      const b = tireDims(...B);
      const diff = (b.d / a.d - 1) * 100;
      const speed = settings.system === 'metric' ? 100 : 60, unit = settings.system === 'metric' ? 'km/h' : 'mph';
      items.push({ head: `Compared with ${B[0]}/${B[1]} R${B[2]}` },
        { k: 'Diameter difference', v: `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff), { maxDec: 2 })} %`, tone: Math.abs(diff) > 3 ? 'bad' : Math.abs(diff) > 2 ? 'warn' : 'good', sub: `${fmt(b.d, { maxDec: 0 })} mm vs ${fmt(a.d, { maxDec: 0 })} mm` },
        { k: `Speedometer shows ${speed} ${unit}`, v: `you drive ${fmt(speed * b.d / a.d, { maxDec: 1 })} ${unit}` },
        { k: 'Sidewall', v: `${fmt(b.side, { maxDec: 0 })} mm`, sub: `${fmt(b.side - a.side, { maxDec: 0 })} mm vs current` },
        { k: 'Ground clearance change', v: `${fmt((b.d - a.d) / 2, { maxDec: 1 })} mm` });
    }
    out.render(items);
  }
  upd();
}

const screen = {
  async mount(root, ctx) {
    const { mountForm } = await import('../core/form.js');
    const f = mountForm(root, screenSpec, ctx);
    root.querySelector('.card.form').append(h('div', { class: 'frow nolabel' }, chips(RES, v => { const [w, hh] = v.split('x'); f.set('w', w); f.set('hh', hh); })));
  },
};

export const tools = { clothing: { mount: mountClothing }, paper: { mount: mountPaper }, screen, tires: { mount: mountTires } };
void chips; void ok;
