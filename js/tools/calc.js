// Scientific calculator: big keys, degrees/radians, functions, Ans, history. No system keyboard on phones.
import { h, copyText } from '../core/dom.js';
import { fmt, getDec } from '../core/num.js';

/* ---------- engine ---------- */
function gamma(z) {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}
export function factorial(n) {
  if (Number.isInteger(n) && n >= 0) { if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  return gamma(n + 1);
}
const FN = {
  sin: (x, m) => snap(Math.sin(m === 'deg' ? x * Math.PI / 180 : x)),
  cos: (x, m) => snap(Math.cos(m === 'deg' ? x * Math.PI / 180 : x)),
  tan: (x, m) => (m === 'deg' && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9 ? NaN : snap(Math.tan(m === 'deg' ? x * Math.PI / 180 : x))),
  asin: (x, m) => Math.asin(x) * (m === 'deg' ? 180 / Math.PI : 1),
  acos: (x, m) => Math.acos(x) * (m === 'deg' ? 180 / Math.PI : 1),
  atan: (x, m) => Math.atan(x) * (m === 'deg' ? 180 / Math.PI : 1),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, log2: Math.log2, exp: Math.exp,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
};
const snap = v => (Math.abs(v) < 1e-12 ? 0 : v);
const clean = x => (Number.isFinite(x) && x !== 0 ? Number(x.toPrecision(14)) : x);
export const lit = v => String(v).replace('e', 'E').replace(/^-/, '−');

/** Evaluate a calculator expression. Accepts × ÷ − √ ∛ π e ^ ! % Ans E (×10ⁿ). Missing ")" are closed. */
export function calcEval(expr, { mode = 'deg', ans = 0 } = {}) {
  let s = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt').replace(/π/g, 'pi')
    .replace(/sin⁻¹/g, 'asin').replace(/cos⁻¹/g, 'acos').replace(/tan⁻¹/g, 'atan').replace(/,/g, '.');
  const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
  if (open > 0) s += ')'.repeat(open);
  const t = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)(E[-+]?\d+)?/.exec(s.slice(i));
    if (num) { t.push({ k: 'n', v: parseFloat(num[0].replace('E', 'e')) }); i += num[0].length; continue; }
    const id = /^(asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|log2|log|ln|exp|sqrt|cbrt|abs|Ans|pi|e)/.exec(s.slice(i));
    if (id) { const w = id[0]; if (w === 'Ans') t.push({ k: 'n', v: ans }); else if (w === 'pi') t.push({ k: 'n', v: Math.PI }); else if (w === 'e') t.push({ k: 'n', v: Math.E }); else t.push({ k: 'f', v: w }); i += w.length; continue; }
    if ('+-*/^()!%'.includes(c)) { t.push({ k: c }); i++; continue; }
    throw new Error('bad input');
  }
  let p = 0;
  const peek = () => t[p]?.k;
  const startsOperand = k => k === 'n' || k === 'f' || k === '(';
  function expr0() {
    let a = term();
    while (peek() === '+' || peek() === '-') { const op = t[p++].k; const b = term(); a = op === '+' ? a + b : a - b; }
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') { const op = t[p++].k; const b = unary(); a = op === '*' ? a * b : a / b; }
      else if (startsOperand(peek())) { a *= unary(); } // implicit: 2π, 3(4), 2sin(30)
      else return a;
    }
  }
  function unary() {
    if (peek() === '-') { p++; return -unary(); }
    if (peek() === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const a = postfix();
    if (peek() === '^') { p++; return Math.pow(a, unary()); }
    return a;
  }
  function postfix() {
    let a = primary();
    for (;;) {
      if (peek() === '!') { p++; a = factorial(a); }
      else if (peek() === '%') { p++; a /= 100; }
      else return a;
    }
  }
  function primary() {
    const tk = t[p++];
    if (!tk) throw new Error('incomplete');
    if (tk.k === 'n') return tk.v;
    if (tk.k === '(') { const a = expr0(); if (t[p++]?.k !== ')') throw new Error('paren'); return a; }
    if (tk.k === 'f') { const arg = peek() === '(' ? primary() : power(); return FN[tk.v](arg, mode); }
    throw new Error('unexpected');
  }
  const r = expr0();
  if (p !== t.length) throw new Error('trailing');
  return clean(r);
}

/* ---------- UI ---------- */
function mount(root, ctx) {
  const st = Object.assign({ mode: 'deg', hist: [], ans: 0 }, ctx.state || {});
  let expr = '', toks = [], second = false, justEvaluated = false;
  const dec = getDec();
  const exprEl = h('div', { class: 'calc-expr' });
  const resEl = h('div', { class: 'calc-res' });
  const modeEl = h('span', { class: 'calc-mode' });
  const display = h('button', { class: 'calc-display', type: 'button', 'aria-label': 'Result, tap to copy', onclick: () => { const r = resEl.dataset.v; if (r) copyText(r); } }, modeEl, exprEl, resEl);
  const keys = h('div', { class: 'calc-keys' });
  const histEl = h('div');
  root.append(display, keys, histEl);
  const save = () => ctx.save(st);
  const show = x => fmt(x, { sig: 12 });
  const view = s => s.replace(/\./g, dec);

  function preview() {
    exprEl.textContent = view(expr) || '0';
    exprEl.scrollLeft = exprEl.scrollWidth;
    modeEl.textContent = st.mode === 'deg' ? 'DEG' : 'RAD';
    if (!expr) { resEl.textContent = ''; resEl.dataset.v = ''; return; }
    try {
      const v = calcEval(expr, st);
      resEl.textContent = Number.isFinite(v) ? '= ' + show(v) : (Number.isNaN(v) ? '' : '= ' + (v > 0 ? '∞' : '−∞'));
      resEl.dataset.v = Number.isFinite(v) ? show(v) : '';
    } catch { resEl.textContent = ''; resEl.dataset.v = ''; }
    resEl.classList.remove('final');
  }
  function add(tok) {
    if (justEvaluated) {
      // after "=": an operator continues from the answer, anything else starts afresh
      if (/^[+\-−×÷^!%²³]/.test(tok) || tok === '^(' || tok === '^(−1)') { expr = 'Ans'; toks = ['Ans']; }
      else { expr = ''; toks = []; }
      justEvaluated = false;
    }
    toks.push(tok); expr += tok; preview();
  }
  function back() { if (justEvaluated) { clear(); return; } const t = toks.pop(); if (t) expr = expr.slice(0, -t.length); preview(); }
  function clear() { expr = ''; toks = []; justEvaluated = false; preview(); }
  function negate() {
    const m = /(\(−)?(\d+\.?\d*(E[−-]?\d+)?|Ans|π|e)(\))?$/.exec(expr);
    if (!m) { add('−'); return; }
    let rep;
    if (m[1] && m[4]) rep = m[2]; else rep = `(−${m[2]})`;
    expr = expr.slice(0, m.index) + rep;
    toks = [...expr]; // rebuild as characters (back-space then removes one character)
    preview();
  }
  function equals() {
    if (!expr) return;
    try {
      const v = calcEval(expr, st);
      if (!Number.isFinite(v)) throw new Error('math');
      st.hist.unshift({ e: expr, r: v }); st.hist = st.hist.slice(0, 40); st.ans = v; save();
      exprEl.textContent = view(expr);
      resEl.textContent = '= ' + show(v); resEl.dataset.v = show(v); resEl.classList.add('final');
      expr = 'Ans'; toks = ['Ans'];
      justEvaluated = true;
      drawHist();
    } catch { resEl.textContent = 'Error'; resEl.dataset.v = ''; resEl.classList.add('final'); }
  }
  const K = (label, act, cls = '', aria) => h('button', { type: 'button', class: 'ck ' + cls, 'aria-label': aria || label, onclick: act }, label);
  function drawKeys() {
    const s2 = second;
    keys.replaceChildren(
      K('2nd', () => { second = !second; drawKeys(); }, 'fn' + (s2 ? ' on' : '')),
      K(st.mode === 'deg' ? 'Deg' : 'Rad', () => { st.mode = st.mode === 'deg' ? 'rad' : 'deg'; save(); drawKeys(); preview(); }, 'fn', 'Switch degrees / radians'),
      K('(', () => add('('), 'fn'), K(')', () => add(')'), 'fn'), K('⌫', back, 'fn', 'Delete'),
      K(s2 ? 'sin⁻¹' : 'sin', () => add(s2 ? 'sin⁻¹(' : 'sin('), 'fn'),
      K(s2 ? 'cos⁻¹' : 'cos', () => add(s2 ? 'cos⁻¹(' : 'cos('), 'fn'),
      K(s2 ? 'tan⁻¹' : 'tan', () => add(s2 ? 'tan⁻¹(' : 'tan('), 'fn'),
      K('π', () => add('π'), 'fn'), K('e', () => add('e'), 'fn'),
      K(s2 ? 'x³' : 'x²', () => add(s2 ? '^3' : '^2'), 'fn'),
      K(s2 ? 'ʸ√x' : 'xʸ', () => add(s2 ? '^(1÷' : '^('), 'fn'),
      K(s2 ? '∛' : '√', () => add(s2 ? '∛(' : '√('), 'fn'),
      K(s2 ? 'eˣ' : 'ln', () => add(s2 ? 'e^(' : 'ln('), 'fn'),
      K(s2 ? '10ˣ' : 'log', () => add(s2 ? '10^(' : 'log('), 'fn'),
      K('1/x', () => add('^(−1)'), 'fn'), K('AC', clear, 'clr'), K('±', negate, 'op2'), K('%', () => add('%'), 'op2'), K('÷', () => add('÷'), 'op'),
      K('n!', () => add('!'), 'fn'), K('7', () => add('7'), 'dig'), K('8', () => add('8'), 'dig'), K('9', () => add('9'), 'dig'), K('×', () => add('×'), 'op'),
      K('EE', () => add('E'), 'fn', 'Times ten to the power'), K('4', () => add('4'), 'dig'), K('5', () => add('5'), 'dig'), K('6', () => add('6'), 'dig'), K('−', () => add('−'), 'op'),
      K('Ans', () => add('Ans'), 'fn'), K('1', () => add('1'), 'dig'), K('2', () => add('2'), 'dig'), K('3', () => add('3'), 'dig'), K('+', () => add('+'), 'op'),
      K('Rand', () => add(String(Math.round(Math.random() * 1e6) / 1e6)), 'fn', 'Random number'), K('0', () => add('0'), 'dig zero'), K(dec, () => add('.'), 'dig', 'Decimal point'), K('=', equals, 'eq'),
    );
  }
  function drawHist() {
    if (!st.hist.length) { histEl.replaceChildren(); return; }
    histEl.replaceChildren(h('h3', { class: 'sec-title' }, 'History', h('button', { class: 'link', type: 'button', onclick: () => { st.hist = []; save(); drawHist(); } }, 'Clear')),
      h('div', { class: 'card list' }, st.hist.map(x => h('button', { class: 'li btn-li calc-h', type: 'button', onclick: () => { if (justEvaluated) { expr = ''; toks = []; justEvaluated = false; } add(lit(x.r)); } },
        h('span', { class: 'li-main' }, h('span', { class: 'li-sub' }, view(x.e))), h('b', { class: 'li-price' }, show(x.r))))));
  }
  const onKey = e => {
    if (e.target.closest('input, textarea, select')) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) add(k);
    else if (k === '.' || k === ',') add('.');
    else if (k === '+') add('+'); else if (k === '-') add('−'); else if (k === '*' || k === 'x') add('×'); else if (k === '/') { add('÷'); e.preventDefault(); }
    else if (k === '^') add('^('); else if (k === '(' || k === ')') add(k); else if (k === '%') add('%'); else if (k === '!') add('!');
    else if (k === 'Enter' || k === '=') { equals(); e.preventDefault(); } else if (k === 'Backspace') back(); else if (k === 'Escape') clear();
    else return;
  };
  document.addEventListener('keydown', onKey);
  ctx.onCleanup(() => document.removeEventListener('keydown', onKey));
  drawKeys(); preview(); drawHist();
}

export const tools = { scicalc: { mount } };
