// France: gross ↔ net pay (salaire brut ↔ net) and income tax (impôt sur le revenu). Official 2026 figures.
import { h } from '../core/dom.js';
import { fmt, fmtFixed, fmtMoney, fmtPct } from '../core/num.js';
import { ok, okPos } from '../core/form.js';

/* ---------- 2026 parameters (update every January) ---------- */
export const PAYROLL = {
  year: 2026,
  pmss: 4005, // plafond mensuel de la Sécurité sociale 2026 (PASS 48 060 €)
  hoursMonth: 151.67, // 35 h a week
};
// Barème 2026 on 2025 income (loi de finances 2026 n° 2026-103 of 19 February 2026, +0.9 %).
export const IR = {
  year: 2026, incomeYear: 2025,
  brackets: [[0, 0], [11600, 11], [29579, 30], [84577, 41], [181917, 45]],
  halfPartCap: 1807, // plafond du quotient familial per half-part
  singleParentCap: 4262, // for the first child of a single parent (case T)
  decote: { single: 897, couple: 1483, rate: 0.4525 },
  allowance: { min: 509, max: 14555 }, // 10 % for salaries, per person
  minCollected: 61,
};
// Neutral withholding rates (grille de taux par défaut, mainland France, from 1 May 2026): [monthly net taxable from, rate %].
export const NEUTRAL = [[0, 0], [1635, 0.5], [1698, 1.3], [1807, 2.1], [1928, 2.9], [2060, 3.5], [2170, 4.1], [2315, 5.3], [2738, 7.5], [3135, 9.9], [3571, 11.9], [4019, 13.8], [4690, 15.8], [5624, 17.9], [7037, 20], [8789, 24], [12200, 28], [16523, 33], [25937, 38], [55558, 43]];

export function neutralRate(monthlyTaxable) {
  let r = 0;
  for (const [from, rate] of NEUTRAL) if (monthlyTaxable >= from) r = rate;
  return r;
}

export const STATUTS = [['noncadre', 'Private sector · non-cadre'], ['cadre', 'Private sector · cadre'], ['fonct', 'Civil servant (fonctionnaire)'], ['contract', 'Public sector · contractuel']];

/**
 * Employee contributions for one month of gross pay.
 * opts: statut, primes (bonuses included in gross, civil servants), alsace (Alsace-Moselle), mutuelle (€ your share)
 */
export function brutToNet(brut, { statut = 'noncadre', primes = 0, alsace = false, mutuelle = 0 } = {}) {
  const P = PAYROLL.pmss;
  const B = Math.max(0, brut);
  const t1 = Math.min(B, P), t2 = Math.min(Math.max(0, B - P), 7 * P);
  const lines = [];
  const add = (label, base, rate, kind = 'social') => { if (base > 0 && rate > 0) lines.push({ label, base, rate, amount: base * rate / 100, kind }); };
  if (statut === 'fonct') {
    const pr = Math.min(Math.max(0, primes || 0), B);
    const tib = B - pr;
    add('Pension civile', tib, 11.10);
    add('RAFP', Math.min(pr, 0.2 * tib), 5);
  } else {
    add('Vieillesse plafonnée', t1, 6.90);
    add('Vieillesse déplafonnée', B, 0.40);
    if (statut === 'contract') {
      add('IRCANTEC A', t1, 2.80);
      add('IRCANTEC B', t2, 6.95);
    } else {
      add('Retraite compl. T1', t1, 3.15);
      add('Retraite compl. T2', t2, 8.64);
      add('CEG T1', t1, 0.86);
      add('CEG T2', t2, 1.08);
      if (B > P) add('CET', t1 + t2, 0.14);
      if (statut === 'cadre') add('APEC', Math.min(B, 4 * P), 0.024);
    }
    if (alsace) add('Maladie Alsace-Moselle', B, 1.30);
  }
  // CSG / CRDS on 98.25 % of gross up to 4 PMSS, 100 % above.
  const csgBase = 0.9825 * Math.min(B, 4 * P) + Math.max(0, B - 4 * P);
  add('CSG déductible', csgBase, 6.80, 'csg');
  add('CSG non déductible', csgBase, 2.40, 'nd');
  add('CRDS', csgBase, 0.50, 'nd');
  if (mutuelle > 0) lines.push({ label: 'Mutuelle (your share)', base: null, rate: null, amount: mutuelle, kind: 'mutuelle' });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const net = B - total;
  const nd = lines.filter(l => l.kind === 'nd').reduce((s, l) => s + l.amount, 0);
  return { brut: B, lines, total, net, taxable: net + nd, rate: B ? total / B * 100 : 0 };
}

/** Gross monthly pay giving this net (before income tax). */
export function netToBrut(net, opts = {}) {
  if (!(net > 0)) return 0;
  let lo = net, hi = net * 2 + 1000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (brutToNet(mid, { ...opts, primes: opts.primesRatio != null ? mid * opts.primesRatio : opts.primes }).net < net) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ---------- income tax ---------- */
export function salaryAllowance(x) {
  if (!(x > 0)) return 0;
  return Math.min(x, Math.min(IR.allowance.max, Math.max(IR.allowance.min, x * 0.1)));
}
export function familyParts({ couple = false, kids = 0, alone = false }) {
  let p = couple ? 2 : 1;
  for (let k = 1; k <= kids; k++) p += k <= 2 ? 0.5 : 1;
  if (!couple && alone && kids > 0) p += 0.5;
  return p;
}
/** Tax for a quotient (income per part) with the barème, and the slices. */
export function taxPerPart(q) {
  let tax = 0;
  const slices = [];
  IR.brackets.forEach(([from, rate], i) => {
    const to = IR.brackets[i + 1]?.[0] ?? Infinity;
    const taxed = Math.max(0, Math.min(q, to) - from);
    tax += taxed * rate / 100;
    slices.push({ from, to, rate, taxed, tax: taxed * rate / 100 });
  });
  return { tax, slices };
}
const marginal = q => { let r = 0; for (const [from, rate] of IR.brackets) if (q > from) r = rate; return r; };

/**
 * Household income tax. rni = revenu net imposable (after allowances & deductions).
 * Returns every step: parts, gross tax, family cap, décote, credits, high-income contribution, rates.
 */
export function incomeTax({ rni, couple = false, kids = 0, alone = false, credits = 0 }) {
  const R = Math.max(0, rni || 0);
  const parts = familyParts({ couple, kids, alone });
  const baseParts = couple ? 2 : 1;
  const q = R / parts;
  const { tax: perPart, slices } = taxPerPart(q);
  const withParts = perPart * parts;
  const base = taxPerPart(R / baseParts).tax * baseParts;
  const extraHalves = Math.round((parts - baseParts) * 2);
  const singleParent = !couple && alone && kids > 0;
  const cap = singleParent ? IR.singleParentCap + Math.max(0, extraHalves - 2) * IR.halfPartCap : extraHalves * IR.halfPartCap;
  const capped = base - cap > withParts + 1e-9;
  const afterCap = capped ? base - cap : withParts;
  const thr = couple ? IR.decote.couple : IR.decote.single;
  const decote = afterCap > 0 ? Math.max(0, Math.min(afterCap, thr - IR.decote.rate * afterCap)) : 0;
  let net = Math.round(afterCap - decote);
  const notCollected = net > 0 && net < IR.minCollected;
  if (notCollected) net = 0;
  // Contribution exceptionnelle sur les hauts revenus (taxable income used as a stand-in for the RFR).
  const s = couple ? 2 : 1;
  const cehr = Math.round(Math.max(0, Math.min(R, 500000 * s) - 250000 * s) * 0.03 + Math.max(0, R - 500000 * s) * 0.04);
  const cred = Math.max(0, credits || 0);
  const final = net + cehr - cred;
  const tmi = marginal(capped ? R / baseParts : q);
  return {
    rni: R, parts, q, slices, withParts, base, cap, capped, afterCap, decote, net, notCollected, cehr, credits: cred, final,
    tmi, decoteMarginal: decote > 0 && afterCap > 0 ? tmi * (1 + IR.decote.rate) : null,
    avg: R > 0 ? Math.max(0, net + cehr) / R * 100 : 0,
  };
}

/* ---------- UI ---------- */
const E = x => fmtMoney(x, 'EUR');
const E0 = x => fmtMoney(x, 'EUR', { dec: 0 });
const PER_LABEL = { m: 'a month', y: 'a year', h: 'an hour' };

/**
 * Everything the pay tool shows, for a regular month and for the whole year.
 * per: 'm' | 'y' | 'h'. months: 12, or 13 when there's a 13th month (one more month's pay, usually with December's).
 * A yearly amount is spread over `months` payments; the mutuelle is only taken 12 times.
 */
export function payFigures({ dir = 'b2n', amount, per = 'm', months = 12, hours = 35, statut = 'noncadre', primes = 0, alsace = false, mutuelle = 0, pas = null }) {
  const extra = months === 13 ? 1 : 0;
  const mut = mutuelle > 0 ? mutuelle : 0;
  const perHour = hours * 52 / 12;
  const toMonth = per === 'h' ? perHour : per === 'y' ? 1 / months : 1;
  const mAmt = per === 'y' && dir === 'n2b' ? (amount - extra * mut) / months : amount * toMonth;
  const primesM = statut === 'fonct' ? Math.max(0, primes || 0) * toMonth : 0;
  const opts = { statut, alsace: alsace && statut !== 'fonct', mutuelle: mut, primes: primesM };
  const brutM = dir === 'b2n' ? mAmt : netToBrut(mAmt, opts);
  const r = brutToNet(brutM, opts);
  const r13 = brutToNet(brutM, { ...opts, mutuelle: 0 });
  const auto = pas == null || !Number.isFinite(pas);
  const rate = auto ? neutralRate(r.taxable) : Math.max(0, Math.min(60, pas));
  const pasM = r.taxable * rate / 100;
  // Paid with December's pay: the neutral grid then applies to that bigger month as a whole.
  const dec = r.taxable + r13.taxable;
  const pas13 = extra ? (auto ? dec * neutralRate(dec) / 100 - pasM : r13.taxable * rate / 100) : 0;
  const year = {
    brut: brutM * months,
    total: r.total * 12 + r13.total * extra,
    net: r.net * 12 + r13.net * extra,
    taxable: r.taxable * 12 + r13.taxable * extra,
    pas: pasM * 12 + pas13,
  };
  year.after = year.net - year.pas;
  return { months, brutM, primesM, r, r13: extra ? r13 : null, pas13, auto, rate, pasM, afterM: r.net - pasM, year, perHour };
}

const brutnet = {
  fields: [
    { id: 'dir', type: 'seg', options: [['b2n', 'Gross → net'], ['n2b', 'Net → gross']], default: 'b2n' },
    { id: 'brut', type: 'money', currency: 'EUR', label: 'Gross pay (brut)', default: '2500', when: v => v.dir === 'b2n' },
    { id: 'net', type: 'money', currency: 'EUR', label: 'Net pay', hint: 'before income tax', default: '2000', when: v => v.dir === 'n2b' },
    { id: 'per', type: 'seg', options: [['m', 'Monthly'], ['y', 'Yearly'], ['h', 'Hourly']], default: 'm' },
    { id: 'hours', type: 'num', label: 'Hours a week', default: '35', suffix: 'h', when: v => v.per === 'h' },
    { id: 'months', type: 'seg', options: [['12', '12 months a year'], ['13', '13 months a year']], default: '12' },
    { group: '' },
    { id: 'statut', type: 'select', label: 'Status', options: STATUTS, default: 'noncadre', stack: true },
    { id: 'primes', type: 'money', currency: 'EUR', label: 'Of which bonuses', hint: 'primes & indemnités, same period', placeholder: '0', default: '', when: v => v.statut === 'fonct' },
    { id: 'mutuelle', type: 'money', currency: 'EUR', label: 'Mutuelle', hint: 'optional: your share, per month', placeholder: '0', default: '' },
    { id: 'alsace', type: 'toggle', label: 'Alsace-Moselle', hint: 'local health scheme: +1.30 %', when: v => v.statut !== 'fonct' },
    { id: 'pas', type: 'pct', label: 'Withholding rate', hint: 'on your payslip; empty = neutral rate', placeholder: 'auto', default: '' },
  ],
  compute(v, ctx) {
    const per = v.per || 'm';
    const amount = v.dir === 'b2n' ? v.brut : v.net;
    if (!okPos(amount)) return [{ note: v.dir === 'b2n' ? 'Enter your gross pay.' : 'Enter the net pay you want.' }];
    const months = String(v.months) === '13' ? 13 : 12;
    const P = payFigures({
      dir: v.dir, amount, per, months, hours: okPos(v.hours) ? v.hours : 35, statut: v.statut, primes: okPos(v.primes) ? v.primes : 0,
      alsace: !!v.alsace, mutuelle: okPos(v.mutuelle) ? v.mutuelle : 0, pas: ok(v.pas) ? v.pas : null,
    });
    const { r, year } = P;
    if (v.statut === 'fonct' && P.primesM > P.brutM) return [{ note: 'The bonuses can’t be more than the gross pay.', tone: 'warn' }];
    if (!(P.brutM > 0)) return [{ note: 'Enter the net pay you want.' }];
    // In the period you chose; "yearly" is the real total for the year, 13th month included.
    const show = (m, y) => (per === 'y' ? y : per === 'h' ? m / P.perHour : m);
    const yr = months === 13 ? 'a year (13 months)' : 'a year';
    const monthTxt = months === 13 ? `${E(r.net)} a month + a 13th month` : `${E(r.net)} a month`;
    const items = v.dir === 'b2n'
      ? [{ k: 'Net pay before income tax', v: E(show(r.net, year.net)), big: true, sub: per === 'y' ? monthTxt : `${E0(year.net)} ${yr}` }]
      : [{ k: 'Gross pay (brut)', v: E(show(P.brutM, year.brut)), big: true, sub: per === 'y' ? `${E(P.brutM)} a month × ${months}` : `${E0(year.brut)} ${yr}` }];
    if (v.dir === 'n2b') items.push({ k: 'Net pay before income tax', v: E(show(r.net, year.net)), sub: per === 'y' ? monthTxt : null });
    items.push(
      { k: 'Net after withholding tax', v: E(show(P.afterM, year.after)), sub: `${fmt(P.rate)} % ${P.auto ? 'neutral rate' : 'your rate'}: ${E(show(P.pasM, year.pas))} withheld ${PER_LABEL[per]}` },
      { k: 'Net taxable (net imposable)', v: E(show(r.taxable, year.taxable)), sub: 'what your income tax is based on' },
      { k: 'Your contributions', v: E(show(r.total, year.total)), sub: `${fmt(r.rate, { maxDec: 1 })} % of gross` },
    );
    if (P.r13) items.push({ k: '13th month, net', v: E(P.r13.net), sub: `${E(P.r13.brut)} gross, usually paid with December’s pay · ${E(P.pas13)} withheld${P.auto ? ' (neutral rate on the double month)' : ''}` });
    items.push({ head: months === 13 ? 'Month and year (13 months)' : 'Month and year' }, {
      table: {
        cols: ['', 'Month', 'Year'],
        rows: [['Gross', r.brut, year.brut], ['Contributions', -r.total, -year.total], ['Net before tax', r.net, year.net], ['Net taxable', r.taxable, year.taxable], ['Withholding', -P.pasM, -year.pas], ['Net after tax', P.afterM, year.after]]
          .map(([k, m, y]) => [k, fmtFixed(m, 2), fmtFixed(y, 0)]),
        hi: 5,
      },
    });
    items.push({ head: 'Contributions, per month' }, {
      table: {
        cols: ['', 'Rate', 'Amount'],
        rows: r.lines.map(l => [l.label, l.rate != null ? `${fmt(l.rate, { maxDec: 3 })} %` : '', fmtFixed(l.amount, 2)]),
      },
    });
    if (P.auto) items.push({ node: h('div', { class: 'custom' }, h('button', { class: 'btn block', type: 'button', onclick: () => ctx.open('impot', { kind: 'sal', inc1: String(Math.round(year.taxable)) }) }, 'Estimate your own tax rate')) });
    items.push({ note: `${PAYROLL.year} rates, ceiling (PMSS) ${E0(PAYROLL.pmss)} a month. Full-time ceiling assumed; ${v.statut === 'fonct' ? 'no SFT or residence allowance specifics' : 'no overtime exemption, no company-specific prévoyance'}.${months === 13 ? ' The 13th month is counted like a regular month’s pay.' : ''} A payslip can differ by a few euros.` });
    return items;
  },
};

const impot = {
  fields: [
    { id: 'sit', type: 'seg', options: [['single', 'Single'], ['couple', 'Married / PACS']], default: 'single' },
    { id: 'kids', type: 'stepper', label: 'Children', hint: 'dependants', min: 0, max: 12, default: 0 },
    { id: 'alone', type: 'toggle', label: 'Raising them alone', hint: 'single parent (case T): +½ part', when: v => v.sit === 'single' && v.kids > 0 },
    { group: 'Income for the year' },
    { id: 'kind', type: 'seg', options: [['sal', 'Salaries'], ['rni', 'Net taxable income']], default: 'sal' },
    { id: 'inc1', type: 'money', currency: 'EUR', label: 'Your salaries', hint: 'net imposable (December payslip)', default: '30000', when: v => v.kind === 'sal' },
    { id: 'inc2', type: 'money', currency: 'EUR', label: 'Partner’s salaries', hint: 'net imposable', placeholder: '0', default: '', when: v => v.kind === 'sal' && v.sit === 'couple' },
    { id: 'other', type: 'money', currency: 'EUR', label: 'Other income', hint: 'optional, taxable: rents, pensions…', placeholder: '0', default: '', when: v => v.kind === 'sal' },
    { id: 'ded', type: 'money', currency: 'EUR', label: 'Deductions', hint: 'optional: PER, alimony paid', placeholder: '0', default: '', when: v => v.kind === 'sal' },
    { id: 'rni', type: 'money', currency: 'EUR', label: 'Revenu net imposable', hint: 'on your tax notice (avis d’impôt)', default: '27000', when: v => v.kind === 'rni' },
    { id: 'cred', type: 'money', currency: 'EUR', label: 'Tax credits', hint: 'optional: home help, childcare, gifts…', placeholder: '0', default: '' },
  ],
  compute(v, ctx) {
    const couple = v.sit === 'couple';
    const kids = Math.max(0, Math.round(+v.kids || 0));
    let rni, allowance = 0, salaries = 0, salNet = 0;
    if (v.kind === 'rni') {
      if (!ok(v.rni) || v.rni < 0) return [{ note: 'Enter your net taxable income.' }];
      rni = v.rni;
    } else {
      const s1 = okPos(v.inc1) ? v.inc1 : 0, s2 = couple && okPos(v.inc2) ? v.inc2 : 0;
      salaries = s1 + s2;
      allowance = salaryAllowance(s1) + salaryAllowance(s2);
      salNet = salaries - allowance;
      rni = Math.max(0, salNet + (okPos(v.other) ? v.other : 0) - (okPos(v.ded) ? v.ded : 0));
      if (!salaries && !okPos(v.other)) return [{ note: 'Enter your yearly salaries (net imposable).' }];
    }
    const t = incomeTax({ rni, couple, kids, alone: !!v.alone, credits: okPos(v.cred) ? v.cred : 0 });
    const items = [
      t.final < 0
        ? { k: 'Refund', v: E0(-t.final), big: true, tone: 'good', sub: 'your credits are more than the tax' }
        : { k: 'Income tax', v: E0(t.final), big: true, sub: t.final > 0 ? `${E0(t.final / 12)} a month · on ${IR.incomeYear} income, paid in ${IR.year}` : `on ${IR.incomeYear} income` },
      { k: 'Average rate', v: fmtPct(t.avg, 1), sub: 'of net taxable income' },
      { k: 'Marginal rate (TMI)', v: `${t.tmi} %`, sub: t.decoteMarginal ? `≈ ${fmt(t.decoteMarginal, { maxDec: 1 })} % on your next euro while the décote applies` : 'on your next euro of taxable income' },
    ];
    if (salaries > 0) {
      const share = rni > 0 ? Math.min(1, salNet / (salNet + (okPos(v.other) ? v.other : 0))) : 0;
      const rate = Math.max(0, t.net) * share / salaries * 100;
      items.push({ k: 'Withholding rate', v: fmtPct(Math.round(rate * 10) / 10, 1), sub: 'about your prélèvement à la source rate', copy: fmt(Math.round(rate * 10) / 10) });
      items.push({ node: h('div', { class: 'custom' }, h('button', { class: 'btn block', type: 'button', onclick: () => ctx.open('brutnet', { pas: String(Math.round(rate * 10) / 10) }) }, 'Use this rate for my net pay')) });
    }
    items.push({ head: 'How it’s worked out' });
    if (v.kind === 'sal') items.push({ k: 'Salaries', v: E0(salaries) }, { k: '10 % allowance', v: '−' + E0(allowance), sub: `per person, ${E0(IR.allowance.min)} to ${E0(IR.allowance.max)}` });
    items.push(
      { k: 'Net taxable income', v: E0(t.rni) },
      { k: 'Parts', v: fmt(t.parts), sub: `quotient familial: ${E0(t.q)} per part` },
      { k: 'Tax from the brackets', v: E0(t.withParts) },
    );
    if (t.capped) items.push({ k: 'Family-part cap', v: '+' + E0(t.afterCap - t.withParts), tone: 'warn', sub: `the extra parts can save at most ${E0(t.cap)}` });
    if (t.decote > 0) items.push({ k: 'Décote', v: '−' + E0(t.decote), tone: 'good', sub: 'reduction for small tax bills' });
    if (t.notCollected) items.push({ k: 'Not collected', v: E0(0), tone: 'good', sub: `tax under ${IR.minCollected} € isn’t collected` });
    if (t.cehr) items.push({ k: 'High-income contribution', v: '+' + E0(t.cehr), sub: 'CEHR, 3 % / 4 % (estimate)' });
    if (t.credits) items.push({ k: 'Credits & reductions', v: '−' + E0(t.credits) });
    items.push({ head: 'Brackets, per part' }, {
      table: {
        cols: ['Income per part', 'Rate', 'Tax'],
        rows: t.slices.map(s => [s.to === Infinity ? `over ${fmt(s.from)}` : `${fmt(s.from)} – ${fmt(s.to)}`, `${s.rate} %`, fmtFixed(s.tax * t.parts, 0)]),
        hi: t.slices.findIndex(s => s.rate === marginal(t.q)),
      },
    });
    items.push({ note: `Barème ${IR.year} on ${IR.incomeYear} income (loi de finances ${IR.year}). Simplified: credits are subtracted as given, no differential contribution for very high incomes, no special cases (veterans, disability, widowers). Check with the simulator on impots.gouv.fr.` });
    return items;
  },
};

export const tools = { brutnet, impot };
