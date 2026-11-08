// Kitchen: cups ↔ grams per ingredient, recipe scaler, coffee ratio. (Oven temperature lives in the unit engine.)
import { h, copyText } from '../core/dom.js';
import { parseNum, fmt, fractionText } from '../core/num.js';
import { numField, seg, selectEl, row, results, chips, stepper } from '../core/ui.js';
import { ok, okPos } from '../core/form.js';
import { settings } from '../core/store.js';

// grams per US cup (236.6 mL). Typical values for spooned & levelled dry ingredients.
const ING = [
  ['Flours & starches', [['flour', 'All-purpose flour', 125], ['bread', 'Bread flour', 127], ['wholewheat', 'Whole-wheat flour', 120], ['cake', 'Cake / pastry flour', 114], ['almond', 'Almond flour', 96], ['rye', 'Rye flour', 102], ['riceflour', 'Rice flour', 158], ['cornstarch', 'Cornstarch', 128], ['cocoa', 'Cocoa powder', 85], ['semolina', 'Semolina', 167], ['cornmeal', 'Cornmeal / polenta', 150]]],
  ['Sugars & syrups', [['sugar', 'Granulated sugar', 200], ['brown', 'Brown sugar (packed)', 220], ['icing', 'Powdered / icing sugar', 120], ['honey', 'Honey', 340], ['maple', 'Maple syrup', 322], ['cornsyrup', 'Corn / golden syrup', 328], ['molasses', 'Molasses', 337]]],
  ['Liquids, fats & dairy', [['water', 'Water', 237], ['milk', 'Milk', 245], ['cream', 'Heavy cream', 238], ['butter', 'Butter', 227], ['oil', 'Vegetable oil', 218], ['olive', 'Olive oil', 216], ['yogurt', 'Yogurt', 245], ['sourcream', 'Sour cream / crème fraîche', 240], ['creamcheese', 'Cream cheese', 232], ['parmesan', 'Grated Parmesan', 100], ['cheese', 'Shredded cheese', 113]]],
  ['Grains & legumes', [['rice', 'White rice (raw)', 185], ['brownrice', 'Brown rice (raw)', 190], ['oats', 'Rolled oats', 90], ['quinoa', 'Quinoa (raw)', 170], ['couscous', 'Couscous (dry)', 175], ['lentils', 'Lentils (dry)', 192], ['breadcrumbs', 'Breadcrumbs', 108]]],
  ['Other', [['salt', 'Table salt', 288], ['bakingpowder', 'Baking powder', 192], ['soda', 'Baking soda', 220], ['yeast', 'Instant yeast', 150], ['chips', 'Chocolate chips', 170], ['nuts', 'Chopped nuts', 115], ['almonds', 'Whole almonds', 143], ['raisins', 'Raisins', 150], ['coconut', 'Shredded coconut', 85], ['peanut', 'Peanut butter', 270], ['jam', 'Jam', 320], ['coffee', 'Ground coffee', 80], ['sesame', 'Sesame seeds', 144]]],
];
export const ALL = ING.flatMap(([, a]) => a);
export const ML_PER_CUP = 236.5882365;
// units: [id, label, kind, factor] — volume factors in mL, weight factors in g
export const KU = [['tsp', 'Teaspoon (US)', 'v', 4.92892159375], ['tbsp', 'Tablespoon (US)', 'v', 14.78676478125], ['cup', 'Cup (US)', 'v', ML_PER_CUP], ['cupm', 'Cup (metric 250 mL)', 'v', 250], ['cupuk', 'Cup (UK 284 mL)', 'v', 284.130625], ['floz', 'Fluid ounce (US)', 'v', 29.5735295625], ['ml', 'Milliliter', 'v', 1], ['dl', 'Deciliter', 'v', 100], ['l', 'Liter', 'v', 1000], ['stick', 'Stick of butter (US)', 'v', ML_PER_CUP / 2], ['g', 'Gram', 'w', 1], ['kg', 'Kilogram', 'w', 1000], ['oz', 'Ounce', 'w', 28.349523125], ['lb', 'Pound', 'w', 453.59237]];

function mountCooking(root, ctx) {
  const st = Object.assign({ ing: 'flour', u: 'cup', v: '1' }, ctx.state || {});
  const save = () => ctx.save(st);
  const sel = selectEl(ING.map(([g, a]) => ({ group: g, options: a.map(([id, n]) => [id, n]) })), st.ing, v => { st.ing = v; recompute(); }, { aria: 'Ingredient' });
  const listEl = h('div', { class: 'card ulist' });
  const dens = h('p', { class: 'fact' });
  root.append(h('div', { class: 'card form' }, row('Ingredient', sel)), h('div', { class: 'ulist-tools' }, h('span', null, 'Type in any row'), h('span', null, 'Tap a name to copy')), listEl, dens,
    h('p', { class: 'note' }, 'Weights are for spooned-and-levelled cups. Packed or sifted ingredients can vary by 10–20 %: for baking, a kitchen scale is the most reliable.'));
  const rows = KU.map(([id, label, kind, f]) => {
    const inp = numField({ aria: label, onInput: (n, raw) => { st.u = id; st.v = raw; recompute(); } });
    const lab = h('button', { class: 'ulabel', type: 'button', onclick: () => inp.input.value && copyText(inp.input.value, `${inp.input.value} ${label}`) }, h('b', null, label), h('span', null, kind === 'v' ? 'volume' : 'weight'));
    const sub = h('div', { class: 'usub' });
    const r = h('div', { class: 'urow' }, lab, h('div', { class: 'uval' }, inp, sub));
    listEl.append(r);
    return { id, kind, f, inp, r, sub };
  });
  function recompute() {
    save();
    const ing = ALL.find(x => x[0] === st.ing) || ALL[0];
    const gPerMl = ing[2] / ML_PER_CUP;
    rows.find(r => r.id === 'stick').r.hidden = st.ing !== 'butter';
    const src = rows.find(r => r.id === st.u) || rows[2];
    const n = parseNum(st.v);
    const grams = Number.isFinite(n) ? (src.kind === 'v' ? n * src.f * gPerMl : n * src.f) : null;
    for (const r of rows) {
      r.r.classList.toggle('src', r === src);
      if (r === src) { if (r.inp.input.value !== st.v) r.inp.set(st.v); continue; }
      if (grams == null) { r.inp.set(''); r.sub.textContent = ''; continue; }
      const x = r.kind === 'v' ? grams / gPerMl / r.f : grams / r.f;
      r.inp.set(fmt(x, { sig: 4 }));
      r.sub.textContent = ['tsp', 'tbsp', 'cup', 'cupm', 'cupuk', 'stick'].includes(r.id) && x < 20 && Math.abs(x - Math.round(x)) > 0.03 ? '≈ ' + fractionText(x, 8) : '';
    }
    dens.replaceChildren(h('span', null, `1 cup of ${ing[1].toLowerCase()} ≈ `, h('b', null, `${ing[2]} g`), ` · 1 tbsp ≈ ${fmt(ing[2] / 16, { maxDec: 1 })} g · 1 tsp ≈ ${fmt(ing[2] / 48, { maxDec: 1 })} g`));
  }
  recompute();
}

/* ---------- Recipe scaler ---------- */
const VUL = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2 };
const QTY = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½⅓⅔¼¾⅛⅜⅝⅞⅕]|\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞⅕])/g;
const qtyVal = s => {
  s = s.trim();
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s); if (m) return +m[1] + +m[2] / +m[3];
  m = /^(\d+)\/(\d+)$/.exec(s); if (m) return +m[1] / +m[2];
  m = /^(\d+(?:[.,]\d+)?)\s*([½⅓⅔¼¾⅛⅜⅝⅞⅕])$/.exec(s); if (m) return +m[1].replace(',', '.') + VUL[m[2]];
  if (VUL[s]) return VUL[s];
  return +s.replace(',', '.');
};
function fmtQty(x, unitWord, wasFraction) {
  const frac = wasFraction || /\b(cups?|tsp|tbsp|teaspoons?|tablespoons?|oz|c\.|cuill)/i.test(unitWord);
  if (x >= 100 && /\b(g|ml|gr|grams?)\b/i.test(unitWord)) return fmt(Math.round(x / 5) * 5, { group: false });
  if (x >= 20) return fmt(Math.round(x), { group: false });
  if (frac) { const t = fractionText(x, 8); if (Math.abs(eval0(t) - x) / x < 0.04) return t.replace(/ (\d)\/(\d)/, ' $1/$2'); }
  if (Number.isInteger(Math.round(x * 100) / 100)) return String(Math.round(x));
  if (x < 20 && Math.abs(x * 4 - Math.round(x * 4)) < 0.02) return fractionText(x, 4);
  return fmt(x, { maxDec: x < 1 ? 2 : 1, group: false });
}
const eval0 = t => { const [w, f] = t.includes(' ') ? t.split(' ') : t.includes('/') ? ['0', t] : [t, '0/1']; const [a, b] = f.split('/').map(Number); return +w + a / b; };
export function scaleLine(line, k) {
  // Scale the first quantity of the line (and a range like "2-3"); skip temperatures and percentages.
  const wasF = /\d\/\d|[½⅓⅔¼¾⅛⅜⅝⅞⅕]/.test(line);
  const re = new RegExp(QTY.source, 'g');
  let m;
  while ((m = re.exec(line))) {
    const after = line.slice(m.index + m[0].length);
    if (/^\s*(°|degrees?\b|%)/i.test(after)) continue;
    const range = /^(\s*(?:-|–|to|à|or)\s*)(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)/.exec(after);
    const unitWord = (range ? after.slice(range[0].length) : after).trim().split(/\s+/)[0] || '';
    let out = fmtQty(qtyVal(m[0]) * k, unitWord, wasF);
    let tailStart = m.index + m[0].length;
    if (range) { out += range[1] + fmtQty(qtyVal(range[2]) * k, unitWord, wasF); tailStart += range[0].length; }
    return line.slice(0, m.index) + out + line.slice(tailStart);
  }
  return line;
}
const PAN = { round: d => Math.PI * (d / 2) ** 2, square: s => s * s };
function mountRecipe(root, ctx) {
  const st = Object.assign({ mode: 'serv', from: 4, to: 6, k: '2', p1: 'round', d1: '20', w1: '', p2: 'round', d2: '24', w2: '', txt: '200 g flour\n100 g butter\n3 eggs\n1/2 cup milk\n1 ½ tsp baking powder\n1 pinch of salt' }, ctx.state || {});
  const save = () => ctx.save(st);
  const how = h('div');
  const outT = h('div', { class: 'card pad out-lines' });
  const factorEl = h('div', { class: 'factor' });
  const ta = h('textarea', { class: 'text-area', rows: 8, 'aria-label': 'Ingredients, one per line', placeholder: 'One ingredient per line' }); ta.value = st.txt;
  ta.addEventListener('input', () => { st.txt = ta.value; upd(); });
  const copyB = h('button', { class: 'btn ghost', type: 'button', onclick: () => copyText(outT.textContent, 'scaled recipe') }, 'Copy');
  root.append(h('div', { class: 'card form' }, h('div', { class: 'frow seg-row' }, seg([['serv', 'Servings'], ['k', 'Multiply'], ['pan', 'Pan size']], st.mode, v => { st.mode = v; drawHow(); upd(); })), how), factorEl,
    h('h3', { class: 'sec-title' }, 'Ingredients'), h('div', { class: 'card pad' }, ta),
    h('h3', { class: 'sec-title' }, 'Scaled', copyB), outT,
    h('p', { class: 'note' }, 'Quantities at the start of each line are scaled. Eggs and spoons are rounded to sensible fractions; temperatures are left alone. Baking times don’t scale linearly: check early.'));
  function drawHow() {
    if (st.mode === 'serv') how.replaceChildren(row('Recipe serves', stepper(st.from, { min: 1, max: 200, onChange: v => { st.from = v; upd(); } })), row('I want to serve', stepper(st.to, { min: 1, max: 200, onChange: v => { st.to = v; upd(); } })));
    else if (st.mode === 'k') how.replaceChildren(row('Multiply by', numField({ value: st.k, aria: 'Factor', onInput: (n, raw) => { st.k = raw; upd(); } })), h('div', { class: 'frow nolabel' }, chips([['0.25', '¼'], ['0.5', '½'], ['0.75', '¾'], ['1.5', '1½'], ['2', '×2'], ['3', '×3']], v => { st.k = v; drawHow(); upd(); })));
    else {
      const unit = settings.system === 'metric' ? 'cm' : 'in';
      const pan = (p, d) => [row(p === 'p1' ? 'Recipe pan' : 'My pan', seg([['round', 'Round'], ['square', 'Square'], ['rect', 'Rectangle']], st[p], v => { st[p] = v; drawHow(); upd(); })),
        row(st[p] === 'round' ? 'Diameter' : st[p] === 'square' ? 'Side' : 'Length', numField({ value: st[d], suffix: unit, aria: 'Size', onInput: (n, raw) => { st[d] = raw; upd(); } })),
        st[p] === 'rect' ? row('Width', numField({ value: st[d.replace('d', 'w')], suffix: unit, aria: 'Width', onInput: (n, raw) => { st[d.replace('d', 'w')] = raw; upd(); } })) : null];
      how.replaceChildren(...pan('p1', 'd1'), ...pan('p2', 'd2'));
    }
  }
  function factor() {
    if (st.mode === 'serv') return st.to / st.from;
    if (st.mode === 'k') return parseNum(st.k);
    const area = (p, d, w) => (p === 'round' ? PAN.round(parseNum(d)) : p === 'square' ? PAN.square(parseNum(d)) : parseNum(d) * parseNum(w));
    return area(st.p2, st.d2, st.w2) / area(st.p1, st.d1, st.w1);
  }
  function upd() {
    save();
    const k = factor();
    if (!(k > 0 && Number.isFinite(k))) { factorEl.textContent = ''; outT.textContent = 'Set the scaling first.'; return; }
    factorEl.replaceChildren(h('span', null, 'Scale × '), h('b', null, fmt(k, { maxDec: 3 })));
    outT.textContent = st.txt.split('\n').map(l => (l.trim() ? scaleLine(l, k) : l)).join('\n');
  }
  drawHow(); upd();
}

/* ---------- Coffee ratio ---------- */
const METHODS = [['16', 'Pour-over / V60 (1:16)'], ['17', 'Drip machine (1:17)'], ['15', 'French press (1:15)'], ['13', 'AeroPress (1:13)'], ['10', 'Moka pot (1:10)'], ['2', 'Espresso (1:2, coffee → drink)'], ['8', 'Cold brew concentrate (1:8)'], ['c', 'Custom']];
const coffee = {
  fields: [
    { id: 'meth', type: 'select', label: 'Method', options: METHODS, default: '16' },
    { id: 'r', type: 'num', label: 'Ratio 1 :', default: '16', when: v => v.meth === 'c' },
    { id: 'mode', type: 'seg', label: 'Start from', options: [['cups', 'Cups'], ['water', 'Water'], ['beans', 'Coffee']], default: 'cups' },
    { id: 'cups', type: 'stepper', label: 'Cups', default: 2, min: 1, max: 20, when: v => v.mode === 'cups' },
    { id: 'cupml', type: 'num', label: 'Cup size', suffix: 'mL', default: '250', when: v => v.mode === 'cups', presets: [[30, 'Espresso'], [150, 'Small'], [250, 'Mug'], [350, 'Large']] },
    { id: 'water', type: 'num', label: 'Water', suffix: 'mL', default: '500', when: v => v.mode === 'water' },
    { id: 'beans', type: 'num', label: 'Coffee', suffix: 'g', default: '30', when: v => v.mode === 'beans' },
  ],
  compute(v) {
    const r = v.meth === 'c' ? v.r : +v.meth;
    if (!okPos(r)) return [{ note: 'Enter a ratio.' }];
    let water, beans;
    if (v.mode === 'cups') { if (!okPos(v.cupml)) return []; water = v.cups * v.cupml; beans = water / r; }
    if (v.mode === 'water') { if (!okPos(v.water)) return []; water = v.water; beans = water / r; }
    if (v.mode === 'beans') { if (!okPos(v.beans)) return []; beans = v.beans; water = beans * r; }
    const esp = v.meth === '2';
    return [
      { k: esp ? 'Ground coffee (dose)' : 'Ground coffee', v: `${fmt(beans, { maxDec: 1 })} g`, big: true, sub: `≈ ${fmt(beans / 5.3, { maxDec: 1 })} level tablespoons · ${fmt(beans / 7, { maxDec: 1 })} scoops (7 g)` },
      { k: esp ? 'Espresso out' : 'Water', v: `${fmt(water, { maxDec: 0 })} ${esp ? 'g' : 'mL'}`, sub: `${fmt(water / 29.5735, { maxDec: 1 })} fl oz` },
      { k: 'Ratio', v: `1 : ${fmt(r)}` },
      !esp ? { note: 'Brewed coffee absorbs about 2 g of water per gram of grounds, so you get slightly less in the cup.' } : null,
    ];
  },
};

export const tools = { cooking: { mount: mountCooking }, recipe: { mount: mountRecipe }, coffee };
void ok;
