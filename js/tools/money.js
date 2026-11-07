// Money: currency (live rates), history, travel cheat sheet, crypto & gold, and everyday money calculators.
import { h, icon, copyText, openSheet, norm, toast } from '../core/dom.js';
import { parseNum, fmt, fmtFixed, fmtMoney, fmtAmount, fmtPct, currencySymbol } from '../core/num.js';
import { numField, seg, selectEl, chips, row, results, iconBtn, dateField, isoDate, isoToday } from '../core/ui.js';
import { settings } from '../core/store.js';
import { getRates, cachedRates, rate, currencyName, currencyFlag, kindOf, listCodes, rateOn, series, ECB, ensureCryptoNames, METALS } from '../lib/currencies.js';
import { unitsOf } from '../data/units.js';
import { ok, okPos } from '../core/form.js';

const M = (x, cur = settings.currency) => fmtMoney(x, cur);
const today = () => isoToday();
const shortDate = iso => { try { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } };
const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const hr = Math.round(m / 60); if (hr < 48) return `${hr} h ago`; return `${Math.round(hr / 24)} days ago`; };

/* ---------- status line + currency picker ---------- */
function statusLine(onRefresh) {
  const el = h('div', { class: 'status-line' });
  el.update = (r, err) => {
    const btn = h('button', { type: 'button', onclick: onRefresh }, icon('refresh'), 'Refresh');
    if (!r) { el.replaceChildren(h('span', { class: 'dot off' }), h('span', null, err ? 'Can’t load rates. Check your connection.' : 'Loading rates…'), err ? btn : null); return; }
    const old = (Date.now() - Date.parse(r.date + 'T23:59:59Z')) > 3 * 864e5;
    el.replaceChildren(h('span', { class: 'dot' + (r.stale || err ? ' off' : old ? ' old' : '') }),
      h('span', { class: 'st-text' }, h('b', null, `Rates of ${shortDate(r.date)}`), ` · ${r.stale || err ? 'offline, saved ' : 'checked '}${ago(r.fetched)} · ${r.source}`), btn);
  };
  el.busy = () => el.classList.add('spin');
  el.idle = () => el.classList.remove('spin');
  return el;
}

export function pickCurrency({ title = 'Choose currency', rates, exclude = [], selected, onPick, allowCrypto = true }) {
  const codes = Object.keys(rates || {}).filter(c => !exclude.includes(c));
  if (!codes.length) { toast('Rates not loaded yet'); return; }
  ensureCryptoNames();
  const input = h('input', { class: 'search-in', type: 'search', placeholder: 'Search code, name or country', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Search currencies' });
  const list = h('div');
  const groups = [['Popular', c => listCodes(rates).popular.includes(c)], ['All currencies', c => kindOf(c) === 'fiat'], ['Crypto', c => kindOf(c) === 'crypto'], ['Precious metals', c => kindOf(c) === 'metal'], ['Old currencies (fixed rates)', c => kindOf(c) === 'legacy']];
  const item = c => h('button', { class: 'pick' + (c === selected ? ' on' : ''), type: 'button', onclick: () => { s.close(); onPick(c); } },
    h('span', { class: 'flag' }, currencyFlag(c)), h('span', { class: 'p-main' }, h('b', null, c), h('small', null, currencyName(c))));
  const draw = () => {
    const q = norm(input.value);
    if (q) {
      const hits = codes.filter(c => norm(c).startsWith(q) || norm(currencyName(c)).includes(q)).filter(c => allowCrypto || kindOf(c) !== 'crypto');
      hits.sort((a, b) => (norm(b).startsWith(q) - norm(a).startsWith(q)) || a.localeCompare(b));
      list.replaceChildren(hits.length ? h('div', { class: 'pick-list' }, hits.slice(0, 80).map(item)) : h('p', { class: 'muted' }, 'No match.'));
      return;
    }
    list.replaceChildren(...groups.flatMap(([name, f], gi) => {
      if (!allowCrypto && name === 'Crypto') return [];
      let cs = codes.filter(f);
      if (gi > 0) cs = cs.filter(c => !listCodes(rates).popular.includes(c) || gi !== 1);
      if (gi === 1) cs.sort((a, b) => currencyName(a).localeCompare(currencyName(b)));
      return cs.length ? [h('div', { class: 'pick-head' }, name), h('div', { class: 'pick-list' }, cs.map(item))] : [];
    }));
  };
  input.addEventListener('input', draw);
  draw();
  const s = openSheet({ title, body: h('div', null, h('div', { class: 'search-box' }, icon('search'), input), list) });
}

function curButton(code, onclick) {
  const b = h('button', { class: 'cur-btn', type: 'button', onclick });
  b.set = c => b.replaceChildren(h('span', { class: 'flag' }, currencyFlag(c)), h('span', null, h('b', null, c), h('small', null, currencyName(c))), icon('down'));
  b.set(code);
  return b;
}

/* ---------- Currency converter: type in any row ---------- */
const DEFAULT_LIST = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'];
async function mountCurrency(root, ctx) {
  const st = Object.assign({ list: [...new Set([settings.currency, ...DEFAULT_LIST])].slice(0, 6), src: settings.currency, v: '100' }, ctx.state || {});
  const p = ctx.params || {};
  if (p.from && p.to) { for (const c of [p.from, p.to]) if (!st.list.includes(c)) st.list.splice(1, 0, c); st.src = p.from; st.v = p.v || '1'; }
  if (!st.list.includes(st.src)) st.src = st.list[0];
  let rates = cachedRates()?.rates || null;
  let edit = false;
  const status = statusLine(() => refresh(true));
  const card = h('div', { class: 'card list' });
  const addBtn = h('button', { class: 'add-btn', type: 'button', onclick: () => pickCurrency({ rates, exclude: st.list, title: 'Add currency', onPick: c => { st.list.push(c); save(); draw(); } }) }, icon('plus'), 'Add currency');
  const editBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { edit = !edit; editBtn.textContent = edit ? 'Done' : 'Edit list'; draw(); } }, 'Edit list');
  const histLink = h('button', { class: 'btn ghost', type: 'button', onclick: () => { const to = st.list.find(c => c !== st.src) || 'USD'; ctx.open('fxhistory', { from: st.src, to }); } }, 'History & charts');
  root.append(status, card, h('div', { class: 'row-btns', style: { justifyContent: 'space-between', marginTop: '-6px' } }, histLink, editBtn),
    h('p', { class: 'note' }, 'Mid-market reference rates, updated daily. Banks and card networks usually add 1–3 %. Works offline with the last rates.'));
  const save = () => ctx.save(st);
  let rowsApi = [];

  function draw() {
    card.replaceChildren();
    rowsApi = st.list.map((c, i) => {
      const f = numField({ aria: c + ' amount', onInput: (n, raw) => { st.src = c; st.v = raw; recompute(); save(); } });
      const sub = h('div', { class: 'li-sub' });
      const left = h('button', { class: 'cur-left', type: 'button', onclick: () => { const t = f.input.value; if (t) copyText(t, `${t} ${c}`); } },
        h('span', { class: 'flag' }, currencyFlag(c)), h('span', { class: 'li-main' }, h('span', { class: 'li-title' }, c), sub));
      const tools = edit ? h('span', { class: 'edit-tools' },
        iconBtn('arrowUp', () => { if (i) { [st.list[i - 1], st.list[i]] = [st.list[i], st.list[i - 1]]; save(); draw(); } }, 'Move up'),
        iconBtn('trash', () => { if (st.list.length <= 2) return toast('Keep at least two currencies'); st.list.splice(i, 1); if (st.src === c) st.src = st.list[0]; save(); draw(); }, 'Remove', 'del')) : null;
      const rateEl = h('div', { class: 'usub' });
      const li = h('div', { class: 'li cur-row' + (c === st.src ? ' src' : '') }, left, edit ? tools : h('div', { class: 'cur-val' }, f, rateEl));
      card.append(li);
      return { c, f, sub, li, rateEl };
    });
    card.append(addBtn);
    const src = rowsApi.find(r => r.c === st.src);
    src?.f.set(st.v);
    recompute();
  }
  function recompute() {
    const amt = parseNum(st.v);
    for (const r of rowsApi) {
      r.li.classList.toggle('src', r.c === st.src);
      const k = rate(rates, st.src, r.c);
      r.sub.textContent = currencyName(r.c);
      r.rateEl.textContent = r.c === st.src || !Number.isFinite(k) ? '' : `1 ${st.src} = ${fmt(k, { sig: 5 })}`;
      if (r.c === st.src) continue;
      r.f.set(Number.isFinite(amt) && Number.isFinite(k) ? fmtAmount(amt * k, r.c) : '');
    }
  }
  async function refresh(force) {
    status.busy();
    try { const r = await getRates({ force }); rates = r.rates; status.update(r); recompute(); }
    catch (e) { status.update(cachedRates(), e); }
    finally { status.idle(); }
  }
  status.update(cachedRates());
  draw();
  refresh(false);
}

/* ---------- Exchange history: chart + rate on a date ---------- */
function lineChart(points, { fmtV, fmtD }) {
  // points: [[iso, value]]  — single series: no legend; title above names it.
  const W = 600, H = 200, padT = 10, padB = 6;
  const el = h('div', { class: 'chart', tabindex: '0', role: 'img' });
  if (points.length < 2) { el.append(h('p', { class: 'muted' }, 'Not enough data for a chart.')); return el; }
  const vals = points.map(p => p[1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) { hi += hi * 0.01 || 1; lo -= lo * 0.01 || 1; }
  const span = hi - lo; lo -= span * 0.08; hi += span * 0.08;
  const x = i => (i / (points.length - 1)) * W;
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p[1]).toFixed(2)}`).join('');
  // clean y ticks
  const step = niceStep((hi - lo) / 3);
  const ticks = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', style: { height: '200px' } },
    ticks.map(t => h('line', { class: 'ch-grid', x1: 0, x2: W, y1: y(t), y2: y(t) })),
    h('path', { class: 'ch-area', d: `${d}L${W},${H}L0,${H}Z` }),
    h('path', { class: 'ch-line', d }));
  const plot = h('div', { class: 'ch-plot' }, svg,
    ticks.map(t => h('span', { class: 'ch-tick', style: { top: `${(y(t) / H) * 100}%` } }, fmtV(t))));
  const cross = h('div', { class: 'ch-x', hidden: true });
  const dot = h('div', { class: 'ch-pt' });
  const endDot = h('div', { class: 'ch-pt end', style: { left: '100%', top: `${(y(vals[vals.length - 1]) / H) * 100}%` } });
  plot.append(cross, dot, endDot);
  const readV = h('b'), readD = h('span');
  const read = h('div', { class: 'chart-read' }, readV, readD);
  const axis = h('div', { class: 'chart-axis' }, h('span', null, fmtD(points[0][0])), h('span', null, fmtD(points[points.length - 1][0])));
  el.append(read, plot, axis);
  el.setAttribute('aria-label', `Chart from ${fmtD(points[0][0])} to ${fmtD(points.at(-1)[0])}, low ${fmtV(Math.min(...vals))}, high ${fmtV(Math.max(...vals))}`);
  let idx = points.length - 1;
  const show = (i, active) => {
    idx = Math.max(0, Math.min(points.length - 1, i));
    const [dt, v] = points[idx];
    readV.textContent = fmtV(v); readD.textContent = fmtD(dt, true);
    const lx = (x(idx) / W) * 100, ly = (y(v) / H) * 100;
    cross.hidden = !active; cross.style.left = lx + '%';
    dot.hidden = !active; dot.style.left = lx + '%'; dot.style.top = ly + '%';
  };
  const fromEvent = e => { const r = plot.getBoundingClientRect(); return Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)); };
  plot.addEventListener('pointermove', e => show(fromEvent(e), true));
  plot.addEventListener('pointerdown', e => show(fromEvent(e), true));
  plot.addEventListener('pointerleave', () => show(points.length - 1, false));
  el.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { show(idx - 1, true); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(idx + 1, true); e.preventDefault(); }
  });
  el.addEventListener('blur', () => show(points.length - 1, false));
  show(points.length - 1, false);
  return el;
}
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

async function mountFxHistory(root, ctx) {
  const home = settings.currency;
  const st = Object.assign({ from: home, to: home === 'USD' ? 'EUR' : 'USD', period: '1Y', date: isoDate(new Date(Date.now() - 365 * 864e5)), amt: '100' }, ctx.state || {});
  if (ctx.params?.from) { st.from = ctx.params.from; st.to = ctx.params.to || st.to; }
  let rates = cachedRates()?.rates;
  getRates().then(r => { rates = r.rates; }).catch(() => { });
  const save = () => ctx.save(st);
  const fromB = curButton(st.from, () => pickCurrency({ rates, selected: st.from, title: 'From', onPick: c => { st.from = c; fromB.set(c); changed(); } }));
  const toB = curButton(st.to, () => pickCurrency({ rates, selected: st.to, title: 'To', onPick: c => { st.to = c; toB.set(c); changed(); } }));
  const swap = h('button', { class: 'swap-btn h', type: 'button', 'aria-label': 'Swap currencies', onclick: () => { [st.from, st.to] = [st.to, st.from]; fromB.set(st.from); toB.set(st.to); changed(); } }, icon('swapH'));
  const periods = h('div');
  const chartBox = h('div', { class: 'card pad chart-card' });
  const stats = results();
  const tableBox = h('details', { class: 'card pad data-table' });
  root.append(h('div', { class: 'pair' }, fromB, swap, toB), periods, chartBox, stats);

  // rate on a date
  const onDate = results();
  const dateIn = dateField(st.date, v => { st.date = v; save(); loadDate(); }, { today: false, max: today(), aria: 'Date' });
  const amtIn = numField({ value: st.amt, aria: 'Amount', onInput: (n, raw) => { st.amt = raw; save(); renderDate(); } });
  root.append(h('h3', { class: 'sec-title' }, 'Rate on a specific date'), h('div', { class: 'card form' }, row('Date', dateIn), row('Amount', amtIn)), onDate, tableBox,
    h('p', { class: 'note' }, 'European Central Bank reference rates (since 1999) for its 30 currencies; other currencies use daily snapshots available since March 2024.'));

  function changed() { save(); drawPeriods(); load(); loadDate(); }
  function drawPeriods() {
    const ecb = ECB.has(st.from) && ECB.has(st.to);
    const opts = ecb ? [['1M', '1M'], ['3M', '3M'], ['6M', '6M'], ['1Y', '1Y'], ['5Y', '5Y'], ['10Y', '10Y'], ['MAX', 'Max']] : [['1M', '1M'], ['3M', '3M'], ['6M', '6M'], ['1Y', '1Y'], ['MAX', 'Max']];
    if (!opts.find(o => o[0] === st.period)) st.period = '1Y';
    const c = chips(opts, v => { st.period = v; c.mark(v); save(); load(); }, { cls: 'scroll period-chips', active: st.period });
    periods.replaceChildren(c);
  }
  function startFor(period) {
    const d = new Date();
    const m = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '5Y': 60, '10Y': 120 }[period];
    if (m) d.setMonth(d.getMonth() - m); else return ECB.has(st.from) && ECB.has(st.to) ? '1999-01-04' : '2024-03-02';
    return isoDate(d);
  }
  let seq = 0;
  async function load() {
    const my = ++seq;
    chartBox.style.opacity = chartBox.childElementCount ? '.5' : '1';
    if (!chartBox.childElementCount) chartBox.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
    if (st.from === st.to) { chartBox.style.opacity = '1'; chartBox.replaceChildren(h('p', { class: 'muted' }, 'Pick two different currencies.')); stats.render([]); return; }
    try {
      const pts = await series(st.from, st.to, startFor(st.period), today());
      if (my !== seq) return;
      const sigs = v => fmt(v, { sig: 5 });
      chartBox.replaceChildren(h('div', { class: 'chart-title' }, `1 ${st.from} in ${st.to}`),
        lineChart(pts, { fmtV: sigs, fmtD: (d, long) => (long ? shortDate(d) : new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })) }));
      chartBox.style.opacity = '1';
      if (pts.length) {
        const vals = pts.map(p => p[1]);
        const first = pts[0], last = pts[pts.length - 1];
        const hiI = vals.indexOf(Math.max(...vals)), loI = vals.indexOf(Math.min(...vals));
        const ch = (last[1] / first[1] - 1) * 100;
        stats.render([
          { k: `Latest (${shortDate(last[0])})`, v: `${sigs(last[1])} ${st.to}`, copy: String(last[1]) },
          { k: 'Change over period', v: (ch >= 0 ? '+' : '') + fmtPct(ch), sub: `${st.from} ${ch >= 0 ? 'gained' : 'lost'} ${fmtPct(Math.abs(ch))} against ${st.to}` },
          { k: 'Highest', v: sigs(vals[hiI]), sub: shortDate(pts[hiI][0]) },
          { k: 'Lowest', v: sigs(vals[loI]), sub: shortDate(pts[loI][0]) },
          { k: 'Average', v: sigs(vals.reduce((a, b) => a + b, 0) / vals.length) },
          { k: `1 ${st.to} =`, v: `${sigs(1 / last[1])} ${st.from}` },
        ]);
        tableBox.replaceChildren(h('summary', null, `All ${pts.length} values`),
          h('div', { class: 'tbl-wrap scroll-y' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Date'), h('th', null, `${st.from} → ${st.to}`))),
            h('tbody', null, pts.slice().reverse().map(p => h('tr', null, h('td', null, p[0]), h('td', null, sigs(p[1]))))))));
      }
    } catch (e) {
      if (my !== seq) return;
      chartBox.style.opacity = '1';
      chartBox.replaceChildren(h('p', { class: 'muted' }, navigator.onLine ? 'History unavailable: ' + e.message : 'You’re offline. History needs a connection.'));
      stats.render([]);
    }
  }
  let dateRate = null;
  async function loadDate() {
    onDate.render([{ note: 'Loading…' }]);
    try { dateRate = await rateOn(st.date, st.from, st.to); renderDate(); }
    catch (e) { dateRate = null; onDate.render([{ note: e.message }]); }
  }
  function renderDate() {
    if (!dateRate) return;
    const a = parseNum(st.amt);
    const note = dateRate.date !== st.date ? `Markets closed that day: rate of ${shortDate(dateRate.date)}.` : null;
    onDate.render([
      { k: `${Number.isFinite(a) ? fmtAmount(a, st.from) : '—'} ${st.from} on ${shortDate(st.date)}`, v: Number.isFinite(a) ? `${fmtAmount(a * dateRate.rate, st.to)} ${st.to}` : '—', big: true, copy: Number.isFinite(a) ? fmtAmount(a * dateRate.rate, st.to) : '' },
      { k: 'Rate', v: `1 ${st.from} = ${fmt(dateRate.rate, { sig: 6 })} ${st.to}`, sub: (note ? note + ' ' : '') + 'Source: ' + dateRate.source },
      rates && Number.isFinite(a) ? { k: 'Same amount today', v: `${fmtAmount(a * rate(rates, st.from, st.to), st.to)} ${st.to}`, sub: `${fmtPct((rate(rates, st.from, st.to) / dateRate.rate - 1) * 100)} vs that date` } : null,
    ]);
  }
  drawPeriods(); load(); loadDate();
}

/* ---------- Cheat sheet for travel ---------- */
async function mountCheatSheet(root, ctx) {
  const home = settings.currency;
  const st = Object.assign({ from: home === 'USD' ? 'EUR' : 'USD', to: home }, ctx.state || {});
  let rates = cachedRates()?.rates;
  const status = statusLine(() => refresh(true));
  const fromB = curButton(st.from, () => pickCurrency({ rates, selected: st.from, title: 'Prices in', onPick: c => { st.from = c; fromB.set(c); ctx.save(st); draw(); } }));
  const toB = curButton(st.to, () => pickCurrency({ rates, selected: st.to, title: 'Shown in', onPick: c => { st.to = c; toB.set(c); ctx.save(st); draw(); } }));
  const swap = h('button', { class: 'swap-btn h', type: 'button', 'aria-label': 'Swap', onclick: () => { [st.from, st.to] = [st.to, st.from]; fromB.set(st.from); toB.set(st.to); ctx.save(st); draw(); } }, icon('swapH'));
  const box = h('div', { class: 'two cheat' });
  root.append(status, h('div', { class: 'pair' }, fromB, swap, toB), box, h('p', { class: 'note' }, 'Screenshot this table before you travel: it also works offline. Rounded for quick mental maths.'));
  function table(a, b) {
    const k = rate(rates, a, b);
    if (!Number.isFinite(k)) return h('div', { class: 'card pad' }, h('p', { class: 'muted' }, 'Rates unavailable.'));
    const mag = k >= 1 ? 1 : 10 ** Math.floor(Math.log10(1 / k));
    const seq = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].map(x => x * mag);
    return h('div', { class: 'card list' }, h('div', { class: 'cheat-head' }, h('span', null, currencyFlag(a) + ' ' + a), h('span', null, b + ' ' + currencyFlag(b))),
      seq.map(x => h('button', { class: 'cheat-row', type: 'button', onclick: () => copyText(fmtAmount(x * k, b), `${fmtAmount(x * k, b)} ${b}`) }, h('span', null, fmt(x, { dec: 0 })), h('b', null, fmtAmount(x * k, b)))));
  }
  function draw() { box.replaceChildren(table(st.from, st.to), table(st.to, st.from)); }
  async function refresh(force) { try { const r = await getRates({ force }); rates = r.rates; status.update(r); draw(); } catch (e) { status.update(cachedRates(), e); } }
  status.update(cachedRates()); draw(); refresh(false);
}

/* ---------- Crypto & precious metals ---------- */
const OZT = 31.1034768;
async function mountCrypto(root, ctx) {
  const st = Object.assign({ cur: settings.currency, coins: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'USDT', 'DOGE', 'ADA'], amt: '1', coin: 'BTC' }, ctx.state || {});
  let rates = cachedRates()?.rates;
  const status = statusLine(() => refresh(true));
  const curB = curButton(st.cur, () => pickCurrency({ rates, selected: st.cur, title: 'Prices in', allowCrypto: false, onPick: c => { st.cur = c; curB.set(c); ctx.save(st); draw(); } }));
  const cryptoCard = h('div', { class: 'card list' });
  const metalCard = results();
  const conv = results();
  const amtIn = numField({ value: st.amt, aria: 'Amount', onInput: (n, raw) => { st.amt = raw; ctx.save(st); drawConv(); } });
  const coinSel = h('div');
  root.append(status, h('div', { class: 'pair one' }, curB), h('h3', { class: 'sec-title' }, 'Crypto'), cryptoCard,
    h('h3', { class: 'sec-title' }, 'Convert'), h('div', { class: 'card form' }, row('Amount', amtIn), row('Asset', coinSel)), conv,
    h('h3', { class: 'sec-title' }, 'Gold & precious metals'), metalCard,
    h('p', { class: 'note' }, 'Daily reference prices, not live trading prices. Jewellery prices include making charges on top of the metal value.'));
  const price = (code) => { const k = rate(rates, code, st.cur); return k; };
  function draw() {
    if (!rates) { cryptoCard.replaceChildren(h('div', { class: 'li' }, h('span', { class: 'muted' }, 'Loading prices…'))); return; }
    cryptoCard.replaceChildren(...st.coins.filter(c => rates[c]).map(c => h('button', { class: 'li btn-li', type: 'button', onclick: () => copyText(fmtFixed(price(c), price(c) < 1 ? 6 : 2), `${c} price`) },
      h('span', { class: 'flag' }, currencyFlag(c)), h('span', { class: 'li-main' }, h('span', { class: 'li-title' }, currencyName(c)), h('span', { class: 'li-sub' }, c)),
      h('span', { class: 'li-side' }, h('b', { class: 'li-price' }, M(price(c), st.cur))))));
    const opts = [{ group: 'Crypto', options: st.coins.filter(c => rates[c]).map(c => [c, `${c} · ${currencyName(c)}`]) }, { group: 'Metals (troy oz)', options: Object.keys(METALS).map(c => [c, METALS[c]]) }];
    coinSel.replaceChildren(selectEl(opts, st.coin, v => { st.coin = v; ctx.save(st); drawConv(); }, { aria: 'Asset' }));
    const g = price('XAU') / OZT, s = price('XAG') / OZT, pt = price('XPT') / OZT, pd = price('XPD') / OZT;
    metalCard.render([
      { k: 'Gold · 1 troy ounce', v: M(g * OZT, st.cur), big: true, sub: '24 carat, 31.10 g' },
      { k: 'Gold 24k · per gram', v: M(g, st.cur) },
      { k: 'Gold 22k (91.7 %) · per gram', v: M(g * 22 / 24, st.cur) },
      { k: 'Gold 21k (87.5 %) · per gram', v: M(g * 0.875, st.cur) },
      { k: 'Gold 18k (75 %) · per gram', v: M(g * 0.75, st.cur) },
      { k: 'Gold 14k (58.5 %) · per gram', v: M(g * 0.585, st.cur) },
      { k: 'Gold · per kilogram', v: M(g * 1000, st.cur) },
      { k: 'Silver · per troy ounce', v: M(s * OZT, st.cur), sub: `${M(s, st.cur)} per gram · ${M(s * 1000, st.cur)} per kg` },
      { k: 'Platinum · per troy ounce', v: M(pt * OZT, st.cur), sub: `${M(pt, st.cur)} per gram` },
      { k: 'Palladium · per troy ounce', v: M(pd * OZT, st.cur), sub: `${M(pd, st.cur)} per gram` },
    ]);
    drawConv();
  }
  function drawConv() {
    const a = parseNum(st.amt), k = price(st.coin);
    conv.render([{ k: `${Number.isFinite(a) ? fmt(a) : '—'} ${st.coin}`, v: Number.isFinite(a) && Number.isFinite(k) ? M(a * k, st.cur) : '—', big: true }, Number.isFinite(k) ? { k: `1 ${st.cur} buys`, v: `${fmt(1 / k, { sig: 6 })} ${st.coin}` } : null]);
  }
  async function refresh(force) { try { const r = await getRates({ force }); rates = r.rates; status.update(r); draw(); } catch (e) { status.update(cachedRates(), e); draw(); } }
  status.update(cachedRates()); draw(); refresh(false);
}

/* ---------- Unit price comparison ---------- */
const QTY_UNITS = [['g', 'g', 'w', 1e-3], ['kg', 'kg', 'w', 1], ['oz', 'oz', 'w', 0.028349523125], ['lb', 'lb', 'w', 0.45359237], ['ml', 'mL', 'v', 1e-3], ['cl', 'cL', 'v', 1e-2], ['l', 'L', 'v', 1], ['floz', 'fl oz', 'v', 0.0295735295625], ['pc', 'pieces', 'n', 1], ['m', 'm', 'len', 1]];
function mountUnitPrice(root, ctx) {
  const us = settings.system === 'us';
  const st = Object.assign({ items: [{ name: '', p: '', q: '', u: us ? 'oz' : 'g' }, { name: '', p: '', q: '', u: us ? 'oz' : 'g' }] }, ctx.state || {});
  const list = h('div');
  const out = results();
  const add = h('button', { class: 'add-btn', type: 'button', onclick: () => { if (st.items.length >= 8) return; const u = st.items.at(-1)?.u || 'g'; st.items.push({ name: '', p: '', q: '', u }); ctx.save(st); draw(); } }, icon('plus'), 'Add another product');
  root.append(list, add, out, h('p', { class: 'note' }, 'Enter the shelf price and the pack size. Multipacks: put the total quantity (e.g. 6 × 33 cL = 198 cL).'));
  function draw() {
    list.replaceChildren(...st.items.map((it, i) => {
      const letter = String.fromCharCode(65 + i);
      const pIn = numField({ value: it.p, prefix: currencySymbol(settings.currency), aria: `Price ${letter}`, onInput: (n, raw) => { it.p = raw; upd(); } });
      const qIn = numField({ value: it.q, aria: `Quantity ${letter}`, onInput: (n, raw) => { it.q = raw; upd(); } });
      const uSel = selectEl(QTY_UNITS.map(u => [u[0], u[1]]), it.u, v => { it.u = v; upd(); }, { cls: 'unit-sel', aria: 'Unit' });
      const del = st.items.length > 2 ? iconBtn('trash', () => { st.items.splice(i, 1); ctx.save(st); draw(); }, 'Remove', 'del') : null;
      return h('div', { class: 'card form item-card' }, h('div', { class: 'item-head' }, h('span', { class: 'badge' }, letter), h('span', { class: 'item-res', dataset: { i } }), del),
        row('Price', pIn), row('Pack size', h('div', { class: 'uin' }, h('div', { class: 'uin-boxes' }, qIn), uSel)));
    }));
    upd();
  }
  function upd() {
    ctx.save(st);
    const calc = st.items.map(it => {
      const u = QTY_UNITS.find(x => x[0] === it.u); const p = parseNum(it.p), q = parseNum(it.q);
      if (!(p > 0 && q > 0)) return null;
      const base = q * u[3];
      return { kind: u[2], per: p / base, u };
    });
    const byKind = {};
    calc.forEach((c, i) => { if (c) (byKind[c.kind] ||= []).push(i); });
    const items = [];
    const kName = { w: us ? 'lb' : 'kg', v: us ? 'fl oz' : 'L', n: 'piece', len: 'm' };
    const kMul = { w: us ? 0.45359237 : 1, v: us ? 0.0295735295625 : 1, n: 1, len: 1 };
    list.querySelectorAll('.item-res').forEach(el => { el.textContent = ''; el.className = 'item-res'; });
    for (const [kind, idx] of Object.entries(byKind)) {
      const best = Math.min(...idx.map(i => calc[i].per));
      idx.forEach(i => {
        const c = calc[i]; const letter = String.fromCharCode(65 + i);
        const per = c.per * kMul[kind];
        const diff = (c.per / best - 1) * 100;
        const cheapest = Math.abs(diff) < 1e-9;
        const label = list.querySelector(`.item-res[data-i="${i}"]`);
        if (label) { label.textContent = `${M(per)} / ${kName[kind]}` + (idx.length > 1 ? (cheapest ? ' · cheapest' : ` · +${fmt(diff, { maxDec: 1 })} %`) : ''); label.classList.add(cheapest && idx.length > 1 ? 'good' : 'n'); }
        items.push({ k: `${letter}${st.items[i].name ? ' · ' + st.items[i].name : ''}`, v: `${M(per)} / ${kName[kind]}`, tone: cheapest && idx.length > 1 ? 'good' : null, sub: idx.length > 1 ? (cheapest ? 'Cheapest' : `${fmt(diff, { maxDec: 1 })} % more expensive`) : null });
      });
    }
    if (Object.keys(byKind).length > 1) items.push({ note: 'Weights, volumes and pieces are compared separately.' });
    out.render(items.length ? [{ head: 'Price per unit' }, ...items] : []);
  }
  draw();
}

/* ---------- form-based calculators ---------- */
const VAT_PRESETS = { FR: [20, 10, 5.5, 2.1], GB: [20, 5], DE: [19, 7], ES: [21, 10, 4], IT: [22, 10, 5, 4], BE: [21, 12, 6], NL: [21, 9], PT: [23, 13, 6], CH: [8.1, 3.8, 2.6], AT: [20, 13, 10], IE: [23, 13.5, 9], LU: [17, 14, 8, 3], MA: [20, 14, 10, 7], DZ: [19, 9], TN: [19, 13, 7], US: [5, 6, 7, 8.25, 8.875, 10], CA: [5, 13, 15], AU: [10], NZ: [15], JP: [10, 8], IN: [5, 12, 18, 28], AE: [5], SA: [15], SE: [25, 12, 6], DK: [25], NO: [25, 15], PL: [23, 8, 5], GR: [24, 13, 6] };
const vatPresets = () => (VAT_PRESETS[settings.country] || [20, 10, 5]).map(v => [v, v + ' %']);
const fr = () => settings.country === 'FR' || settings.country === 'BE' || settings.country === 'LU' || settings.country === 'MA';

const tip = {
  fields: [
    { id: 'bill', type: 'money', label: 'Bill', default: '' , placeholder: '0.00' },
    { id: 'pct', type: 'pct', label: 'Tip', default: '15', presets: [[0, '0 %'], [5, '5 %'], [10, '10 %'], [12, '12 %'], [15, '15 %'], [18, '18 %'], [20, '20 %'], [25, '25 %']] },
    { id: 'people', type: 'stepper', label: 'People', default: 1, min: 1, max: 100 },
    { id: 'round', type: 'seg', label: 'Round up', options: [['no', 'Exact'], ['total', 'Round total'], ['each', 'Round each']], default: 'no' },
  ],
  compute(v) {
    if (!okPos(v.bill)) return [{ note: 'Enter the bill to see the tip and the split.' }];
    const n = Math.max(1, Math.round(v.people || 1));
    let tipAmt = v.bill * (ok(v.pct) ? v.pct : 0) / 100;
    let total = v.bill + tipAmt, each = total / n;
    if (v.round === 'total') { total = Math.ceil(total); tipAmt = total - v.bill; each = total / n; }
    if (v.round === 'each') { each = Math.ceil(each); total = each * n; tipAmt = total - v.bill; }
    return [
      n > 1 ? { k: `Each of ${n} people pays`, v: M(each), big: true, sub: `Tip ${M(tipAmt / n)} each` } : { k: 'Total to pay', v: M(total), big: true },
      { k: 'Tip', v: M(tipAmt), sub: v.round !== 'no' ? `${fmt(tipAmt / v.bill * 100, { maxDec: 1 })} % after rounding` : null },
      { k: 'Total', v: M(total) },
      n > 1 ? { k: 'Bill per person (before tip)', v: M(v.bill / n) } : null,
    ];
  },
};

const discount = {
  fields: [
    { id: 'mode', type: 'seg', options: [['sale', 'Sale price'], ['pct', 'Find % off'], ['orig', 'Original price']], default: 'sale' },
    { id: 'orig', type: 'money', label: 'Original price', when: v => v.mode !== 'orig' },
    { id: 'sale', type: 'money', label: 'Sale price', when: v => v.mode !== 'sale' },
    { id: 'pct', type: 'pct', label: 'Discount', default: '20', when: v => v.mode !== 'pct', presets: [[10, '−10 %'], [20, '−20 %'], [25, '−25 %'], [30, '−30 %'], [40, '−40 %'], [50, '−50 %'], [70, '−70 %']] },
    { id: 'extra', type: 'pct', label: 'Extra discount', hint: 'Applied after the first', default: '', placeholder: 'optional', when: v => v.mode === 'sale' },
  ],
  compute(v) {
    if (v.mode === 'sale') {
      if (!ok(v.orig)) return [{ note: 'Enter the original price.' }];
      const p1 = v.orig * (1 - (v.pct || 0) / 100);
      const fin = p1 * (1 - (ok(v.extra) ? v.extra : 0) / 100);
      const eff = (1 - fin / v.orig) * 100;
      return [{ k: 'You pay', v: M(fin), big: true, sub: ok(v.extra) && v.extra ? `−${fmt(v.pct)} % then −${fmt(v.extra)} % = −${fmt(eff, { maxDec: 2 })} % in total (not −${fmt((v.pct || 0) + v.extra)} %)` : null }, { k: 'You save', v: M(v.orig - fin), tone: 'good' }];
    }
    if (v.mode === 'pct') {
      if (!(okPos(v.orig) && ok(v.sale))) return [{ note: 'Enter both prices.' }];
      const pct = (1 - v.sale / v.orig) * 100;
      return [{ k: pct >= 0 ? 'Discount' : 'Price increase', v: fmtPct(Math.abs(pct)), big: true }, { k: pct >= 0 ? 'You save' : 'You pay more', v: M(Math.abs(v.orig - v.sale)) }];
    }
    if (!(ok(v.sale) && ok(v.pct) && v.pct < 100)) return [{ note: 'Enter the sale price and the discount.' }];
    const o = v.sale / (1 - v.pct / 100);
    return [{ k: 'Original price', v: M(o), big: true }, { k: 'Discount amount', v: M(o - v.sale) }];
  },
};

const vat = {
  fields: [
    { id: 'mode', type: 'seg', options: [['add', 'Add tax'], ['remove', 'Remove tax']], default: 'add' },
    { id: 'amt', type: 'money', label: 'Amount', hint: null },
    { id: 'rate', type: 'pct', label: 'Tax rate', default: () => String(vatPresets()[0][0]), presets: vatPresets() },
  ],
  compute(v) {
    if (!ok(v.amt) || !ok(v.rate)) return [{ note: 'Enter an amount and a rate.' }];
    const r = v.rate / 100;
    const net = v.mode === 'add' ? v.amt : v.amt / (1 + r);
    const gross = v.mode === 'add' ? v.amt * (1 + r) : v.amt;
    const F = fr();
    return [
      { k: v.mode === 'add' ? (F ? 'Price incl. tax (TTC)' : 'Price incl. tax') : (F ? 'Price excl. tax (HT)' : 'Price excl. tax'), v: M(v.mode === 'add' ? gross : net), big: true },
      { k: F ? 'Tax (TVA)' : 'Tax amount', v: M(gross - net) },
      { k: F ? 'Excl. tax (HT)' : 'Net (excl. tax)', v: M(net) },
      { k: F ? 'Incl. tax (TTC)' : 'Gross (incl. tax)', v: M(gross) },
    ];
  },
};

const margin = {
  fields: [
    { id: 'mode', type: 'seg', options: [['both', 'Cost & price'], ['margin', 'Target margin'], ['markup', 'Target markup']], default: 'both' },
    { id: 'cost', type: 'money', label: 'Cost' },
    { id: 'price', type: 'money', label: 'Selling price', when: v => v.mode === 'both' },
    { id: 'pct', type: 'pct', label: 'Margin', when: v => v.mode === 'margin', default: '30' },
    { id: 'mk', type: 'pct', label: 'Markup', when: v => v.mode === 'markup', default: '50' },
  ],
  compute(v) {
    if (!okPos(v.cost)) return [{ note: 'Enter the cost.' }];
    let price = v.price;
    if (v.mode === 'margin') { if (!(ok(v.pct) && v.pct < 100)) return [{ note: 'Margin must be under 100 %.' }]; price = v.cost / (1 - v.pct / 100); }
    if (v.mode === 'markup') { if (!ok(v.mk)) return []; price = v.cost * (1 + v.mk / 100); }
    if (!ok(price) || price <= 0) return [{ note: 'Enter the selling price.' }];
    const profit = price - v.cost;
    return [
      v.mode === 'both' ? { k: 'Profit', v: M(profit), big: true, tone: profit < 0 ? 'bad' : null } : { k: 'Selling price', v: M(price), big: true },
      { k: 'Margin', v: fmtPct(profit / price * 100), sub: 'Profit ÷ selling price' },
      { k: 'Markup', v: fmtPct(profit / v.cost * 100), sub: 'Profit ÷ cost' },
      v.mode !== 'both' ? { k: 'Profit', v: M(profit) } : null,
    ];
  },
};

function amortize(P, annual, months, extra = 0) {
  const r = annual / 100 / 12;
  const pay = r ? P * r / (1 - Math.pow(1 + r, -months)) : P / months;
  let bal = P, interest = 0, n = 0;
  const years = [];
  let yI = 0, yP = 0;
  while (bal > 1e-6 && n < months + 1) {
    const i = bal * r;
    let pr = Math.min(bal, pay - i + extra);
    bal -= pr; interest += i; n++;
    yI += i; yP += pr;
    if (n % 12 === 0 || bal <= 1e-6) { years.push({ y: Math.ceil(n / 12), i: yI, p: yP, bal: Math.max(0, bal) }); yI = 0; yP = 0; }
  }
  return { pay, interest, n, years };
}
const loan = {
  fields: [
    { id: 'mode', type: 'seg', options: [['pay', 'Monthly payment'], ['cap', 'Max I can borrow']], default: 'pay' },
    { id: 'amt', type: 'money', label: 'Loan amount', default: '200000', when: v => v.mode === 'pay' },
    { id: 'mpay', type: 'money', label: 'Monthly payment', default: '1000', when: v => v.mode === 'cap' },
    { id: 'rate', type: 'pct', label: 'Interest rate', hint: 'per year', default: '3.5', presets: [[1, '1 %'], [2, '2 %'], [3, '3 %'], [3.5, '3.5 %'], [4, '4 %'], [5, '5 %'], [7, '7 %']] },
    { id: 'term', type: 'hms', label: 'Duration', parts: ['yr', 'mo'], mul: [12, 1], default: ['25', ''] },
    { id: 'ins', type: 'pct', label: 'Insurance', hint: '% of loan per year (optional)', placeholder: '0', default: '' },
    { id: 'extra', type: 'money', label: 'Extra each month', hint: 'optional overpayment', placeholder: '0', default: '', when: v => v.mode === 'pay' },
    { id: 'start', type: 'date', label: 'First payment', today: true },
  ],
  compute(v) {
    const months = Math.round(v.term || 0);
    if (!(months > 0) || !ok(v.rate)) return [{ note: 'Enter a rate and a duration.' }];
    const r = v.rate / 100 / 12;
    if (v.mode === 'cap') {
      if (!okPos(v.mpay)) return [{ note: 'Enter the monthly payment you can afford.' }];
      const insFactor = ok(v.ins) && v.ins > 0 ? v.ins / 100 / 12 : 0;
      // payment = P*(annuity factor) + P*ins  →  P = pay / (af + ins)
      const af = r ? r / (1 - Math.pow(1 + r, -months)) : 1 / months;
      const P = v.mpay / (af + insFactor);
      const tot = v.mpay * months;
      return [{ k: 'You can borrow', v: M(P), big: true, sub: `over ${fmtDuration(months)} at ${fmt(v.rate)} %` }, { k: 'Total repaid', v: M(tot) }, { k: 'Cost of the loan', v: M(tot - P), sub: 'Interest' + (insFactor ? ' + insurance' : '') }];
    }
    if (!okPos(v.amt)) return [{ note: 'Enter the loan amount.' }];
    const base = amortize(v.amt, v.rate, months, 0);
    const withX = okPos(v.extra) ? amortize(v.amt, v.rate, months, v.extra) : null;
    const insM = ok(v.ins) && v.ins > 0 ? v.amt * v.ins / 100 / 12 : 0;
    const sched = withX || base;
    const start = v.start ? new Date(v.start + 'T12:00:00') : new Date();
    const end = new Date(start); end.setMonth(end.getMonth() + sched.n - 1);
    const items = [
      { k: 'Monthly payment', v: M(base.pay + insM), big: true, sub: insM ? `${M(base.pay)} loan + ${M(insM)} insurance` : `${fmtDuration(months)} · ${months} payments` },
      { k: 'Total interest', v: M(sched.interest) },
      insM ? { k: 'Total insurance', v: M(insM * sched.n) } : null,
      { k: 'Total cost of credit', v: M(sched.interest + insM * sched.n), sub: 'Interest + insurance' },
      { k: 'Total repaid', v: M(v.amt + sched.interest + insM * sched.n) },
      { k: 'Last payment', v: end.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) },
    ];
    if (withX) items.push({ k: 'Extra payments save', v: M(base.interest - withX.interest), tone: 'good', sub: `Paid off ${fmtDuration(base.n - withX.n)} earlier` });
    const startYear = start.getFullYear();
    items.push({ head: 'Year by year' }, { table: { cols: ['Year', 'Principal', 'Interest', 'Left'], rows: sched.years.map(y => [String(v.start ? startYear + y.y - 1 : y.y), fmtFixed(y.p, 0), fmtFixed(y.i, 0), fmtFixed(y.bal, 0)]) } });
    return items;
  },
};
function fmtDuration(months) {
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} yr` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ') || '0 mo';
}

const savings = {
  fields: [
    { id: 'init', type: 'money', label: 'Starting amount', default: '1000' },
    { id: 'monthly', type: 'money', label: 'Monthly deposit', default: '200' },
    { id: 'rate', type: 'pct', label: 'Interest', hint: 'per year', default: '3', presets: [[1, '1 %'], [2, '2 %'], [3, '3 %'], [5, '5 %'], [7, '7 %'], [10, '10 %']] },
    { id: 'years', type: 'num', label: 'Years', default: '10', suffix: 'years' },
    { id: 'comp', type: 'select', label: 'Compounding', options: [['12', 'Monthly'], ['4', 'Quarterly'], ['1', 'Yearly'], ['365', 'Daily']], default: '12' },
    { id: 'infl', type: 'pct', label: 'Inflation', hint: 'optional, per year', placeholder: '0', default: '' },
  ],
  compute(v) {
    const yrs = v.years;
    if (!(okPos(yrs) && yrs <= 100) || !ok(v.rate)) return [{ note: 'Enter a rate and a number of years.' }];
    const init = ok(v.init) ? v.init : 0, dep = ok(v.monthly) ? v.monthly : 0;
    const k = +v.comp, r = v.rate / 100;
    const mRate = Math.pow(1 + r / k, k / 12) - 1; // effective monthly growth
    let bal = init, deposits = init;
    const rows = [];
    const months = Math.round(yrs * 12);
    for (let m = 1; m <= months; m++) {
      bal = bal * (1 + mRate) + dep; deposits += dep;
      if (m % 12 === 0 || m === months) rows.push([String(Math.ceil(m / 12)), fmtFixed(deposits, 0), fmtFixed(bal - deposits, 0), fmtFixed(bal, 0)]);
    }
    const real = ok(v.infl) && v.infl ? bal / Math.pow(1 + v.infl / 100, yrs) : null;
    return [
      { k: `After ${fmt(yrs)} years`, v: M(bal), big: true, sub: real != null ? `≈ ${M(real)} in today’s money` : null },
      { k: 'Total deposited', v: M(deposits) },
      { k: 'Interest earned', v: M(bal - deposits), tone: 'good' },
      { k: 'Effective annual rate', v: fmtPct((Math.pow(1 + mRate, 12) - 1) * 100) },
      { head: 'Year by year' }, { table: { cols: ['Year', 'Deposited', 'Interest', 'Balance'], rows } },
      { note: 'Deposits are added at the end of each month. Before tax.' },
    ];
  },
};

const isUS = () => settings.system === 'us';
const lenUnits = () => unitsOf('length').filter(u => ['km', 'mi'].includes(u.id));
const fuelUnits = () => unitsOf('fuel').filter(u => ['l100', 'mpg', 'mpguk', 'kml'].includes(u.id));
const evUnits = () => unitsOf('ev').filter(u => ['kwh100', 'whkm', 'mikwh', 'whmi'].includes(u.id));
const tripcost = {
  fields: [
    { id: 'kind', type: 'seg', options: [['fuel', 'Fuel'], ['ev', 'Electric']], default: 'fuel' },
    { id: 'dist', type: 'unit', label: 'Distance', units: lenUnits, unit: () => (settings.system === 'metric' ? 'km' : 'mi'), default: () => ({ b: settings.system === 'metric' ? 100000 : 160934.4, u: settings.system === 'metric' ? 'km' : 'mi' }) },
    { id: 'rt', type: 'toggle', label: 'Round trip', default: false },
    { id: 'cons', type: 'unit', label: 'Consumption', units: fuelUnits, unit: () => (isUS() ? 'mpg' : settings.system === 'uk' ? 'mpguk' : 'l100'), when: v => v.kind === 'fuel', default: () => (isUS() ? { b: 235.2145833333 / 30, u: 'mpg' } : settings.system === 'uk' ? { b: 282.480936332 / 45, u: 'mpguk' } : { b: 6.5, u: 'l100' }) },
    { id: 'price', type: 'money', label: 'Fuel price', hint: isUS() ? 'per US gallon' : settings.system === 'uk' ? 'per litre' : 'per liter', when: v => v.kind === 'fuel', default: isUS() ? '3.50' : '1.80' },
    { id: 'evc', type: 'unit', label: 'Consumption', units: evUnits, unit: () => (settings.system === 'metric' ? 'kwh100' : 'mikwh'), when: v => v.kind === 'ev', default: () => (settings.system === 'metric' ? { b: 17, u: 'kwh100' } : { b: 100 / (3.5 * 1.609344), u: 'mikwh' }) },
    { id: 'kwh', type: 'money', label: 'Electricity price', hint: 'per kWh', when: v => v.kind === 'ev', default: '0.25' },
    { id: 'extra', type: 'money', label: 'Tolls & parking', hint: 'optional', placeholder: '0', default: '' },
    { id: 'people', type: 'stepper', label: 'Split between', default: 1, min: 1, max: 9 },
  ],
  compute(v) {
    if (!okPos(v.dist)) return [{ note: 'Enter the distance.' }];
    const km = v.dist / 1000 * (v.raw.rt ? 2 : 1);
    const n = Math.max(1, v.people || 1);
    const extra = ok(v.extra) ? v.extra : 0;
    const usePerMi = settings.system !== 'metric';
    let energy, cost, eLabel;
    if (v.kind === 'fuel') {
      if (!okPos(v.cons) || !ok(v.price)) return [{ note: 'Enter consumption and price.' }];
      const liters = v.cons * km / 100;
      const perL = isUS() ? v.price / 3.785411784 : v.price;
      cost = liters * perL; energy = isUS() ? `${fmt(liters / 3.785411784, { maxDec: 1 })} US gal (${fmt(liters, { maxDec: 1 })} L)` : `${fmt(liters, { maxDec: 1 })} L`; eLabel = 'Fuel needed';
    } else {
      if (!okPos(v.evc) || !ok(v.kwh)) return [{ note: 'Enter consumption and price.' }];
      const kwh = v.evc * km / 100; cost = kwh * v.kwh; energy = `${fmt(kwh, { maxDec: 1 })} kWh`; eLabel = 'Energy needed';
    }
    const total = cost + extra;
    return [
      n > 1 ? { k: `Per person (${n})`, v: M(total / n), big: true, sub: `Total ${M(total)}` } : { k: 'Trip cost', v: M(total), big: true },
      { k: eLabel, v: energy },
      { k: v.kind === 'fuel' ? 'Fuel cost' : 'Charging cost', v: M(cost) },
      extra ? { k: 'Tolls & parking', v: M(extra) } : null,
      { k: usePerMi ? 'Cost per mile' : 'Cost per km', v: fmtMoney(cost / (usePerMi ? km / 1.609344 : km), settings.currency, { dec: 3 }) },
      { k: 'Distance driven', v: usePerMi ? `${fmt(km / 1.609344, { maxDec: 1 })} mi` : `${fmt(km, { maxDec: 1 })} km` },
    ];
  },
};

const APPLIANCES = [[9, 'LED bulb'], [60, 'Laptop'], [100, 'TV'], [150, 'Fridge'], [400, 'Gaming PC'], [1000, 'Microwave'], [2000, 'Heater'], [2200, 'Kettle'], [2500, 'Oven'], [7400, 'EV charger']];
const energycost = {
  fields: [
    { id: 'w', type: 'num', label: 'Power', suffix: 'W', default: '100', presets: APPLIANCES.map(([w, n]) => [w, n]) },
    { id: 'hours', type: 'num', label: 'Use per day', suffix: 'h', default: '4', presets: [[0.5, '30 min'], [1, '1 h'], [2, '2 h'], [4, '4 h'], [8, '8 h'], [24, '24 h']] },
    { id: 'qty', type: 'stepper', label: 'How many', default: 1, min: 1, max: 100 },
    { id: 'price', type: 'money', label: 'Price per kWh', default: '0.25' },
  ],
  compute(v) {
    if (!okPos(v.w) || !ok(v.hours) || !ok(v.price)) return [{ note: 'Enter power, hours and price.' }];
    const kwhDay = v.w / 1000 * v.hours * (v.qty || 1);
    const c = kwhDay * v.price;
    return [
      { k: 'Per month', v: M(c * 365.25 / 12), big: true, sub: `${fmt(kwhDay * 365.25 / 12, { maxDec: 1 })} kWh` },
      { k: 'Per hour of use', v: M(v.w / 1000 * v.price * (v.qty || 1)) },
      { k: 'Per day', v: M(c), sub: `${fmt(kwhDay, { maxDec: 2 })} kWh` },
      { k: 'Per year', v: M(c * 365.25), sub: `${fmt(kwhDay * 365.25, { maxDec: 0 })} kWh` },
      { note: 'Fridges and heaters cycle on and off: their average draw is often a third of the label power.' },
    ];
  },
};

export const tools = {
  currency: { mount: mountCurrency },
  fxhistory: { mount: mountFxHistory },
  cheatsheet: { mount: mountCheatSheet },
  crypto: { mount: mountCrypto },
  unitprice: { mount: mountUnitPrice },
  tip, discount, vat, margin, loan, savings, tripcost, energycost,
};
