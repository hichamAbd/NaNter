// Savings goal: how much to put aside to reach an amount by a date, or when a monthly amount gets you there.
// Several goals, each with an optional log of what you actually saved (ahead / behind plan). All on the device.
import { h, icon, toast, confirmSheet } from '../core/dom.js';
import { fmt, fmtFixed, fmtMoney, parseNum, currencySymbol } from '../core/num.js';
import { numField, dateField, chips, row, isoToday } from '../core/ui.js';
import { settings } from '../core/store.js';
import { ok, okPos, mountForm } from '../core/form.js';
import * as D from '../lib/dates.js';

const M = x => fmtMoney(x, settings.currency);
const M0 = x => fmtMoney(x, settings.currency, { dec: 0 });

/** Whole months from a to b (calendar), never negative. */
export function monthsBetween(a, b) { return D.dayNum(b) <= D.dayNum(a) ? 0 : D.diffYMD(a, b).months; }

/** Round to a friendly amount (2 significant figures, steps of 5 above 50). */
export function niceAmount(x) {
  if (!(x > 0)) return 0;
  let step = 10 ** (Math.floor(Math.log10(x)) - 1);
  if (x / step > 50) step *= 5;
  return Math.max(step, Math.round(x / step) * step);
}

/** Deposit needed each month (end of month) to go from `bal` to `target` in n months at monthly rate i. */
export function perMonthFor(target, bal, n, i = 0) {
  if (n <= 0) return Math.max(0, target - bal);
  if (!i) return Math.max(0, (target - bal) / n);
  const g = (1 + i) ** n;
  return Math.max(0, (target - bal * g) * i / (g - 1));
}

/** Months of `pay` (end of month) needed to reach target, plus the smaller last deposit. null if never. */
export function monthsToReach(target, bal, pay, i = 0, max = 1200) {
  if (bal >= target) return { n: 0, last: 0 };
  let b = bal;
  for (let n = 1; n <= max; n++) {
    const grown = b * (1 + i);
    if (grown + pay >= target - 1e-9) return { n, last: Math.max(0, target - grown) };
    b = grown + pay;
  }
  return null;
}

/**
 * The plan from today. g: { target, saved, mode: 'date'|'monthly', date, monthly, rate }, today ISO.
 * Returns { done, past, never, remaining, n, perMonth, perWeek, perDay, days, end, rows, interest, deposits }.
 */
export function goalPlan(g, today = D.todayISO()) {
  const target = g.target, bal = ok(g.saved) ? g.saved : 0;
  const i = ok(g.rate) && g.rate > 0 ? g.rate / 100 / 12 : 0;
  const remaining = Math.max(0, target - bal);
  if (bal >= target) return { done: true, remaining: 0, bal };
  let n, pay, last;
  const out = { remaining, bal, i };
  if (g.mode === 'monthly') {
    if (!okPos(g.monthly) && !(i && bal > 0)) return { ...out, never: true };
    const r = monthsToReach(target, bal, okPos(g.monthly) ? g.monthly : 0, i);
    if (!r) return { ...out, never: true };
    n = r.n; pay = g.monthly; last = r.last;
  } else {
    if (!g.date || !D.isValidISO(g.date)) return { ...out, nodate: true };
    const days = D.dayNum(g.date) - D.dayNum(today);
    if (days <= 0) return { ...out, past: true };
    n = Math.max(1, monthsBetween(today, g.date));
    pay = perMonthFor(target, bal, n, i);
    // Interest factor so week/day figures stay consistent with the monthly one.
    const k = remaining > 0 && n ? pay / (remaining / n) : 1;
    const weeks = Math.max(1, Math.floor(days / 7));
    Object.assign(out, { days, weeks, perWeek: remaining / weeks * k, perDay: remaining / days * k });
    last = pay;
  }
  // Month-by-month schedule (deposit at the end of each month).
  const rows = [];
  let b = bal, deposits = 0;
  for (let m = 1; m <= n; m++) {
    const dep = m === n ? Math.min(pay, last) : pay;
    const int = b * i;
    b = b + int + dep; deposits += dep;
    rows.push({ m, date: D.addMonths(today, m), dep, int, bal: b });
  }
  const end = g.mode === 'monthly' ? D.addMonths(today, n) : g.date;
  return { ...out, n, perMonth: pay, last, rows, end, deposits, interest: b - bal - deposits, final: b };
}

/** Where you should be by today if you saved evenly since the start. */
export function expectedByNow(g, start, today = D.todayISO()) {
  const saved = ok(g.saved) ? g.saved : 0;
  if (!start || D.dayNum(today) <= D.dayNum(start)) return saved;
  if (g.mode === 'monthly') return Math.min(g.target, saved + (okPos(g.monthly) ? g.monthly : 0) * monthsBetween(start, today));
  if (!g.date) return saved;
  const tot = D.dayNum(g.date) - D.dayNum(start);
  if (tot <= 0) return g.target;
  return saved + (g.target - saved) * Math.min(1, (D.dayNum(today) - D.dayNum(start)) / tot);
}

const monthYear = iso => new Date(D.dayNum(iso) * D.DAY).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShort = iso => new Date(D.dayNum(iso) * D.DAY).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
function duration(n) {
  const y = Math.floor(n / 12), m = n % 12;
  return [y ? `${y} ${y === 1 ? 'year' : 'years'}` : '', m ? `${m} ${m === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(' ') || 'less than a month';
}

function progressNode(have, target, expected) {
  const pct = target > 0 ? Math.max(0, Math.min(100, have / target * 100)) : 0;
  const exp = expected != null && target > 0 ? Math.max(0, Math.min(100, expected / target * 100)) : null;
  return {
    node: h('div', { class: 'custom goal-prog' },
      h('div', { class: 'goal-top' }, h('b', null, M0(have)), h('span', null, `of ${M0(target)}`), h('span', { class: 'goal-pct' }, `${fmt(pct, { maxDec: pct < 10 ? 1 : 0 })} %`)),
      h('div', { class: 'goal-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)) },
        h('span', { class: 'goal-fill', style: { width: pct + '%' } }),
        exp != null ? h('span', { class: 'goal-exp', style: { left: exp + '%' }, title: 'Planned by today' }) : null),
      exp != null ? h('div', { class: 'goal-legend' }, h('span', { class: 'goal-exp-key' }), 'where the plan says you should be today') : null),
  };
}

const spec = {
  fields: [
    { id: 'name', type: 'text', label: 'Goal', placeholder: 'Holiday, car, emergency fund…', default: '' },
    { id: 'target', type: 'money', label: 'Amount to reach', default: '5000' },
    { id: 'saved', type: 'money', label: 'Already saved', hint: 'when you started', placeholder: '0', default: '' },
    { id: 'mode', type: 'seg', options: [['date', 'By a date'], ['monthly', 'Saving each month']], default: 'date' },
    { id: 'date', type: 'date', label: 'Target date', today: false, default: () => D.addMonths(isoToday(), 12), when: v => v.mode === 'date' },
    { id: 'monthly', type: 'money', label: 'Each month', default: '250', when: v => v.mode === 'monthly' },
    { id: 'rate', type: 'pct', label: 'Interest', hint: 'optional, per year (savings account)', placeholder: '0', default: '' },
  ],
  compute(v, c) {
    const goal = c.goal;
    if (!okPos(v.target)) return [{ note: 'Enter the amount you want to reach.' }];
    const logged = goal.log.reduce((s, x) => s + x.a, 0);
    const have = (ok(v.saved) ? v.saved : 0) + logged;
    const g = { target: v.target, saved: have, mode: v.mode, date: v.date, monthly: v.monthly, rate: v.rate };
    const tracking = goal.log.length > 0;
    const expected = tracking ? expectedByNow({ ...g, saved: ok(v.saved) ? v.saved : 0 }, goal.start) : null;
    const items = [progressNode(have, v.target, tracking ? expected : null)];
    if (tracking) {
      const diff = have - expected;
      const tol = Math.max(1, v.target * 0.005);
      items.push({ k: Math.abs(diff) < tol ? 'On track' : diff > 0 ? 'Ahead of plan' : 'Behind plan', v: Math.abs(diff) < tol ? '✓' : M(Math.abs(diff)), tone: diff >= -tol ? 'good' : 'warn',
        sub: `Planned by today: ${M(expected)} · logged ${M(logged)} since ${D.fmtDate(goal.start, 'short')}`, nocopy: true });
    }
    const p = goalPlan(g);
    if (p.done) return [...items, { k: 'Goal reached', v: '🎉', big: true, tone: 'good', sub: have > v.target ? `${M(have - v.target)} more than you needed` : 'Well done!', nocopy: true }];
    if (p.nodate) return [...items, { note: 'Pick a target date.' }];
    if (p.past) return [...items, { k: 'Still to save', v: M(p.remaining) }, { note: 'The target date has passed: pick a new date or switch to “Saving each month”.', tone: 'warn' }];
    if (p.never) return [...items, { note: 'Enter how much you can put aside each month.' }];
    const label = tracking ? 'from now' : '';
    if (v.mode === 'monthly') {
      items.push({ k: 'You reach it in', v: monthYear(p.end), big: true, sub: `${duration(p.n)} · ${p.n} ${p.n === 1 ? 'deposit' : 'deposits'}${p.last < v.monthly - 0.005 ? `, the last one ${M(p.last)}` : ''}` });
    } else {
      items.push({ k: `Put aside each month ${label}`.trim(), v: M(p.perMonth), big: true, sub: `${p.n} ${p.n === 1 ? 'deposit' : 'deposits'} until ${D.fmtDate(v.date, 'short')}` },
        { k: 'Or each week', v: M(p.perWeek), sub: `${p.weeks} weeks` },
        { k: 'Or each day', v: M(p.perDay), sub: `${fmt(p.days)} days` });
    }
    items.push({ k: 'Still to save', v: M(p.remaining) });
    if (p.i) items.push({ k: 'You put in', v: M(p.deposits) }, { k: 'Interest earned', v: M(p.interest), tone: 'good', sub: `at ${fmt(v.rate)} % a year, before tax` });

    // Other timeframes: the answer to “how much, by when?”
    if (v.mode === 'date') {
      const opts = [3, 6, 12, 18, 24, 36, 60].filter(n => n !== p.n);
      const set = [...new Set([...opts, p.n])].sort((a, b) => a - b);
      items.push({ head: 'Other deadlines' }, {
        table: {
          cols: ['In', 'By', 'Per month'],
          rows: set.map(n => [duration(n), monthShort(D.addMonths(isoToday(), n)), M0(Math.ceil(perMonthFor(v.target, have, n, p.i)))]),
          hi: set.indexOf(p.n),
        },
      });
    } else {
      const m = v.monthly;
      const amounts = [...new Set([m * 0.5, m * 0.75, m * 1.25, m * 1.5, m * 2].map(niceAmount).filter(x => x > 0 && Math.abs(x - m) > 1e-9).concat([m]))].sort((a, b) => a - b);
      items.push({ head: 'Save more, get there sooner' }, {
        table: {
          cols: ['Per month', 'Reached', 'Takes'],
          rows: amounts.map(a => { const r = monthsToReach(v.target, have, a, p.i); return [M0(a), r ? monthShort(D.addMonths(isoToday(), r.n)) : '—', r ? duration(r.n) : 'never']; }),
          hi: amounts.indexOf(m),
        },
      });
    }
    // Plan
    const yearly = p.rows.length > 36;
    const rows = yearly
      ? p.rows.filter(r => r.m % 12 === 0 || r.m === p.rows.length).map(r => [String(Math.ceil(r.m / 12)), fmtFixed(p.rows.slice(0, r.m).reduce((s, x) => s + x.dep, 0), 0), fmtFixed(r.bal, 0), `${fmt(Math.min(100, r.bal / v.target * 100), { maxDec: 0 })} %`])
      : p.rows.map(r => [monthShort(r.date), fmtFixed(r.dep, r.dep >= 1000 ? 0 : 2), fmtFixed(r.bal, 0), `${fmt(Math.min(100, r.bal / v.target * 100), { maxDec: 0 })} %`]);
    items.push({ head: yearly ? 'Year by year' : 'Month by month' }, { table: { cols: [yearly ? 'Year' : 'Month', yearly ? 'Put in' : 'Deposit', 'Saved', 'Goal'], rows } });
    items.push({ note: p.i ? 'Deposits at the end of each month; interest added monthly (an estimate: savings accounts often pay it once a year).' : 'Deposits at the end of each month.' });
    return items;
  },
};

const newGoal = (n = 1) => ({ id: String(Date.now()) + n, start: isoToday(), f: { name: '', target: '5000', saved: '', mode: 'date', date: D.addMonths(isoToday(), 12), monthly: '250', rate: '' }, log: [] });
const goalName = (g, i) => (g.f.name || '').trim() || `Goal ${i + 1}`;

function mount(root, ctx) {
  const st = Object.assign({ goals: [], cur: null }, ctx.state || {});
  if (!Array.isArray(st.goals) || !st.goals.length) st.goals = [newGoal()];
  if (!st.goals.some(g => g.id === st.cur)) st.cur = st.goals[0].id;
  st.goals.forEach(g => { g.log = Array.isArray(g.log) ? g.log : []; g.start = g.start || isoToday(); g.f = g.f || newGoal().f; });
  const save = () => ctx.save(st);
  const saveNow = () => ctx.saveNow(st);
  const goal = () => st.goals.find(g => g.id === st.cur);

  const bar = h('div', { class: 'chips scroll goal-chips' });
  const formBox = h('div');
  const tracker = h('div', { class: 'card-group' });
  const delB = h('button', { class: 'btn danger block', type: 'button', onclick: () => removeGoal() }, 'Delete this goal');
  root.append(bar, formBox, tracker, h('div', { style: { marginTop: '14px' } }, delB),
    h('p', { class: 'note', style: { marginTop: '12px' } }, 'Saved on this device only. Log what you actually put aside and the plan adjusts: it always tells you what to save from now on.'));

  function drawBar() {
    bar.replaceChildren(...st.goals.map((g, i) => h('button', { type: 'button', class: 'chip' + (g.id === st.cur ? ' on' : ''), onclick: () => { if (g.id !== st.cur) { st.cur = g.id; saveNow(); draw(); } } }, goalName(g, i))),
      h('button', { type: 'button', class: 'chip add', onclick: () => addGoal() }, icon('plus'), 'New goal'));
  }
  let form;
  function draw() {
    const g = goal();
    drawBar();
    formBox.replaceChildren();
    form = mountForm(formBox, spec, { state: g.f, params: null, goal: g, save: s => { g.f = s; save(); drawBarLater(); } });
    drawTracker();
  }
  let barT;
  const drawBarLater = () => { clearTimeout(barT); barT = setTimeout(drawBar, 300); };
  function addGoal() {
    if (st.goals.length >= 12) return toast('12 goals at most');
    const g = newGoal(st.goals.length + 1);
    st.goals.push(g); st.cur = g.id; saveNow(); draw();
    setTimeout(() => formBox.querySelector('input.text-in')?.focus(), 50);
  }
  async function removeGoal() {
    const g = goal(), i = st.goals.indexOf(g);
    if (!await confirmSheet('Delete this goal?', `${goalName(g, i)}${g.log.length ? ` and its ${g.log.length} logged ${g.log.length === 1 ? 'deposit' : 'deposits'}` : ''} will be removed.`, 'Delete', true)) return;
    st.goals.splice(i, 1);
    if (!st.goals.length) st.goals.push(newGoal());
    st.cur = st.goals[Math.max(0, i - 1)].id; saveNow(); draw();
  }

  function drawTracker() {
    const g = goal();
    let amt = '', date = isoToday(), sign = 1;
    const amtF = numField({ placeholder: '0', aria: 'Amount', prefix: currencySymbol(settings.currency), onInput: (n, raw) => { amt = raw; } });
    const dateF = dateField(date, v => { date = v; }, { today: false, aria: 'Date' });
    const kind = chips([[1, 'Saved'], [-1, 'Took out']], v => { sign = v; kind.mark(v); }, { cls: 'goal-kind', active: 1 });
    const add = () => {
      const n = parseNum(amt);
      if (!(n > 0)) { toast('Enter an amount'); amtF.input.focus(); return; }
      if (!D.isValidISO(date)) return toast('Pick a date');
      g.log.push({ id: String(Date.now()), d: date, a: sign * n });
      g.log.sort((a, b) => a.d.localeCompare(b.d));
      if (D.dayNum(date) < D.dayNum(g.start)) g.start = date;
      saveNow(); form.update(); drawTracker();
      toast(sign > 0 ? `Added ${M(n)}` : `Took out ${M(n)}`);
    };
    amtF.input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    const startF = dateField(g.start, v => { g.start = v; saveNow(); form.update(); }, { today: false, aria: 'Plan started' });
    const list = g.log.slice().reverse().map(x => h('div', { class: 'li goal-li' },
      h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, D.fmtDate(x.d, 'med'))),
      h('b', { class: 'goal-amt' + (x.a < 0 ? ' neg' : '') }, (x.a < 0 ? '−' : '+') + M(Math.abs(x.a))),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove', onclick: async () => {
        if (!await confirmSheet('Remove this entry?', `${D.fmtDate(x.d, 'med')}: ${M(x.a)}`, 'Remove', true)) return;
        g.log = g.log.filter(y => y.id !== x.id); saveNow(); form.update(); drawTracker();
      } }, icon('close'))));
    tracker.replaceChildren(...[
      h('h3', { class: 'sec-title' }, 'Track your savings'),
      h('div', { class: 'card form' },
        h('div', { class: 'frow seg-row' }, kind),
        row('Amount', amtF), row('Date', dateF),
        h('div', { class: 'frow nolabel' }, h('button', { class: 'btn cat block', type: 'button', onclick: add }, icon('plus'), 'Log it')),
        g.log.length ? row('Plan started', startF) : null),
      g.log.length ? h('div', { class: 'card list', style: { marginTop: '10px' } }, list) : null].filter(Boolean));
  }
  draw();
}

export const tools = { goal: { mount } };
