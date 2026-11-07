// Health & fitness calculators. Estimates for everyday use, not medical advice.
import { h } from '../core/dom.js';
import { fmt } from '../core/num.js';
import { seg, timeField, results, row, pad } from '../core/ui.js';
import { ok, okPos } from '../core/form.js';
import { settings } from '../core/store.js';
import { unitsOf } from '../data/units.js';
import * as D from '../lib/dates.js';

const pick = (cat, ids) => unitsOf(cat).filter(u => ids.includes(u.id));
const W_UNITS = () => pick('mass', ['kg', 'lb', 'stlb']);
const H_UNITS = () => pick('length', ['cm', 'm', 'ftin', 'in']);
const C_UNITS = () => pick('length', ['cm', 'in']);
const sysW = () => (settings.system === 'metric' ? 'kg' : settings.system === 'uk' ? 'stlb' : 'lb');
const sysH = () => (settings.system === 'metric' ? 'cm' : 'ftin');
const sysC = () => (settings.system === 'metric' ? 'cm' : 'in');
const W = (kg, u) => (u === 'lb' ? `${fmt(kg / 0.45359237, { maxDec: 1 })} lb` : u === 'stlb' ? `${Math.floor(kg / 6.35029318)} st ${fmt((kg % 6.35029318) / 0.45359237, { maxDec: 0 })} lb` : `${fmt(kg, { maxDec: 1 })} kg`);
const weight = { id: 'w', type: 'unit', label: 'Weight', units: W_UNITS, unit: sysW, default: () => ({ b: 70, u: sysW() }) };
const height = { id: 'hgt', type: 'unit', label: 'Height', units: H_UNITS, unit: sysH, default: () => ({ b: 1.75, u: sysH() }) };
const sex = { id: 'sex', type: 'seg', options: [['f', 'Female'], ['m', 'Male']], default: 'f' };

const bmi = {
  fields: [weight, height],
  compute(v) {
    if (!okPos(v.w) || !okPos(v.hgt)) return [{ note: 'Enter weight and height.' }];
    const b = v.w / (v.hgt * v.hgt);
    const cat = b < 18.5 ? ['Underweight', 'warn'] : b < 25 ? ['Healthy weight', 'good'] : b < 30 ? ['Overweight', 'warn'] : b < 35 ? ['Obesity (class I)', 'bad'] : b < 40 ? ['Obesity (class II)', 'bad'] : ['Obesity (class III)', 'bad'];
    const lo = 18.5 * v.hgt ** 2, hi = 24.9 * v.hgt ** 2;
    const u = v.w_u;
    const toRange = b < 18.5 ? `Gain ${W(lo - v.w, u)} to reach the healthy range` : b >= 25 ? `Lose ${W(v.w - hi, u)} to reach the healthy range` : 'You are within the healthy range';
    return [
      { k: 'BMI', v: fmt(b, { maxDec: 1 }), big: true, tone: cat[1], sub: cat[0] },
      { gauge: { value: b, min: 15, max: 40, zones: [{ to: 18.5, label: '<18.5', tone: 'cool' }, { to: 25, label: 'Healthy', tone: 'good' }, { to: 30, label: 'Over', tone: 'warn' }, { to: 40, label: 'Obese', tone: 'bad' }] } },
      { k: 'Healthy weight for your height', v: `${W(lo, u)} – ${W(hi, u)}`, sub: toRange },
      { k: 'BMI Prime', v: fmt(b / 25, { maxDec: 2 }), sub: '1.00 = upper limit of healthy' },
      { note: 'Adults only. BMI doesn’t tell muscle from fat (athletes score high) and some guidelines use lower thresholds for people of Asian descent (23 and 27.5).' },
    ];
  },
};

const ACTIVITY = [['1.2', 'Sedentary (desk job, little exercise)'], ['1.375', 'Light (exercise 1–3 days/week)'], ['1.55', 'Moderate (3–5 days/week)'], ['1.725', 'Very active (6–7 days/week)'], ['1.9', 'Athlete (twice a day, physical job)']];
const calories = {
  fields: [sex, { id: 'age', type: 'num', label: 'Age', suffix: 'years', default: '35' }, weight, height, { id: 'act', type: 'select', label: 'Activity', options: ACTIVITY, default: '1.375' }],
  compute(v) {
    if (!okPos(v.age) || !okPos(v.w) || !okPos(v.hgt)) return [{ note: 'Fill in age, weight and height.' }];
    const bmr = 10 * v.w + 625 * v.hgt - 5 * v.age + (v.sex === 'm' ? 5 : -161);
    const tdee = bmr * +v.act;
    const imp = settings.system !== 'metric';
    const step = imp ? 500 : 550; // kcal/day for 1 lb or 0.5 kg per week
    const k = x => `${fmt(Math.round(x / 10) * 10, { dec: 0 })} kcal`;
    const floor = v.sex === 'm' ? 1500 : 1200;
    const loseFast = Math.max(floor, tdee - step * 2), lose = Math.max(floor, tdee - step);
    return [
      { k: 'Maintenance (TDEE)', v: k(tdee), big: true, sub: 'Calories per day to keep your weight' },
      { k: 'Basal metabolic rate', v: k(bmr), sub: 'At complete rest (Mifflin–St Jeor)' },
      { head: 'Goals' },
      { k: imp ? 'Lose 1 lb a week' : 'Lose 0.5 kg a week', v: k(lose) },
      { k: imp ? 'Lose 2 lb a week' : 'Lose 1 kg a week', v: k(loseFast), sub: loseFast === floor ? `Not below ${floor} kcal without medical supervision` : null },
      { k: imp ? 'Gain 1 lb a week' : 'Gain 0.5 kg a week', v: k(tdee + step) },
      { k: 'Protein for active people', v: `${fmt(v.w * 1.6, { dec: 0 })}–${fmt(v.w * 2.2, { dec: 0 })} g / day`, sub: '1.6–2.2 g per kg of body weight' },
      { note: 'Estimates: real needs vary by ±10 % or more. Adjust after 2–3 weeks based on your weight trend.' },
    ];
  },
};

const bodyfat = {
  fields: [sex,
    { id: 'hgt', type: 'unit', label: 'Height', units: H_UNITS, unit: sysH, default: () => ({ b: 1.75, u: sysH() }) },
    { id: 'neck', type: 'unit', label: 'Neck', hint: 'below the larynx', units: C_UNITS, unit: sysC, default: () => ({ b: 0.36, u: sysC() }) },
    { id: 'waist', type: 'unit', label: 'Waist', hint: 'men: at the navel · women: narrowest', units: C_UNITS, unit: sysC, default: () => ({ b: 0.8, u: sysC() }) },
    { id: 'hip', type: 'unit', label: 'Hips', hint: 'widest point', units: C_UNITS, unit: sysC, when: v => v.sex === 'f', default: () => ({ b: 0.98, u: sysC() }) },
    { id: 'w', type: 'unit', label: 'Weight', hint: 'optional, for fat mass', units: W_UNITS, unit: sysW, default: () => ({ b: null, u: sysW() }) },
  ],
  compute(v) {
    const cm = x => x * 100;
    if (!okPos(v.hgt) || !okPos(v.neck) || !okPos(v.waist) || (v.sex === 'f' && !okPos(v.hip))) return [{ note: 'Fill in the measurements.' }];
    const H = cm(v.hgt), N = cm(v.neck), Wa = cm(v.waist), Hi = cm(v.hip || 0);
    const bf = v.sex === 'm' ? 495 / (1.0324 - 0.19077 * Math.log10(Wa - N) + 0.15456 * Math.log10(H)) - 450
      : 495 / (1.29579 - 0.35004 * Math.log10(Wa + Hi - N) + 0.22100 * Math.log10(H)) - 450;
    if (!Number.isFinite(bf) || bf <= 0 || bf > 70) return [{ note: 'These measurements look off: check the units.' }];
    const z = v.sex === 'm' ? [[6, 'Essential fat'], [14, 'Athletic'], [18, 'Fit'], [25, 'Average'], [99, 'High']] : [[14, 'Essential fat'], [21, 'Athletic'], [25, 'Fit'], [32, 'Average'], [99, 'High']];
    const cat = z.find(([t]) => bf < t)[1];
    const items = [{ k: 'Body fat', v: `${fmt(bf, { maxDec: 1 })} %`, big: true, sub: cat }];
    if (okPos(v.w)) items.push({ k: 'Fat mass', v: W(v.w * bf / 100, v.w_u) }, { k: 'Lean mass', v: W(v.w * (1 - bf / 100), v.w_u) });
    items.push({ note: 'US Navy tape method: typically within 3–4 % of a DEXA scan. Measure relaxed, in the morning.' });
    return items;
  },
};

const hrzones = {
  fields: [
    { id: 'age', type: 'num', label: 'Age', suffix: 'years', default: '35' },
    { id: 'rest', type: 'num', label: 'Resting heart rate', hint: 'optional: more precise zones', suffix: 'bpm', placeholder: 'e.g. 60', default: '' },
    { id: 'max', type: 'num', label: 'Known max heart rate', hint: 'optional', suffix: 'bpm', placeholder: 'auto', default: '' },
    { id: 'f', type: 'seg', options: [['tanaka', 'Tanaka (208 − 0.7 × age)'], ['fox', '220 − age']], default: 'tanaka' },
  ],
  compute(v) {
    if (!okPos(v.age) && !okPos(v.max)) return [{ note: 'Enter your age.' }];
    const max = okPos(v.max) ? v.max : v.f === 'fox' ? 220 - v.age : 208 - 0.7 * v.age;
    const rest = okPos(v.rest) ? v.rest : null;
    const at = p => Math.round(rest ? rest + p * (max - rest) : p * max);
    const Z = [[0.5, 0.6, 'Zone 1 · Recovery', 'Easy, can chat freely'], [0.6, 0.7, 'Zone 2 · Endurance', 'Fat burning, long runs'], [0.7, 0.8, 'Zone 3 · Aerobic', 'Tempo, breathing harder'], [0.8, 0.9, 'Zone 4 · Threshold', 'Hard, short sentences'], [0.9, 1, 'Zone 5 · Maximum', 'All-out sprints']];
    return [
      { k: 'Maximum heart rate', v: `${Math.round(max)} bpm`, big: true, sub: rest ? `Karvonen method with a resting rate of ${rest} bpm` : 'Add your resting rate for personalised zones' },
      ...Z.map(([a, b, n, d]) => ({ k: n, v: `${at(a)}–${at(b)} bpm`, sub: d })),
    ];
  },
};

const duedate = {
  fields: [
    { id: 'm', type: 'seg', options: [['lmp', 'Last period'], ['conc', 'Conception'], ['ivf5', 'IVF day 5'], ['ivf3', 'IVF day 3']], default: 'lmp' },
    { id: 'd', type: 'date', label: 'Date', default: () => D.addDays(D.todayISO(), -70) },
    { id: 'cyc', type: 'num', label: 'Cycle length', suffix: 'days', default: '28', when: v => v.m === 'lmp' },
  ],
  compute(v) {
    if (!D.isValidISO(v.d)) return [{ note: 'Pick a date.' }];
    const cyc = v.m === 'lmp' && ok(v.cyc) ? v.cyc : 28;
    const lmp = v.m === 'lmp' ? D.addDays(v.d, Math.round(cyc - 28)) : v.m === 'conc' ? D.addDays(v.d, -14) : v.m === 'ivf5' ? D.addDays(v.d, -19) : D.addDays(v.d, -17);
    const due = D.addDays(lmp, 280);
    const today = D.todayISO();
    const ga = D.dayNum(today) - D.dayNum(lmp);
    const items = [{ k: 'Estimated due date', v: D.fmtDate(due, 'full'), big: true, sub: ga >= 0 && ga <= 300 ? `${D.relDays(D.dayNum(due) - D.dayNum(today)).replace(/^in /, '')} to go` : null }];
    if (ga >= 0 && ga <= 310) {
      const w = Math.floor(ga / 7), d = ga % 7;
      const tri = ga < 14 * 7 ? '1st trimester' : ga < 28 * 7 ? '2nd trimester' : '3rd trimester';
      items.push({ k: 'Today', v: `${w} weeks + ${d} days`, sub: `${tri} · month ${Math.min(9, Math.floor(ga / 30.44) + 1)}` });
    }
    items.push({ k: 'Conception (approx.)', v: D.fmtDate(D.addDays(lmp, 14), 'med') },
      { head: 'Milestones' },
      { k: 'End of 1st trimester (13 w 6 d)', v: D.fmtDate(D.addDays(lmp, 97), 'med') },
      { k: 'End of 2nd trimester (27 w 6 d)', v: D.fmtDate(D.addDays(lmp, 195), 'med') },
      { k: 'Full term (37 weeks)', v: D.fmtDate(D.addDays(lmp, 259), 'med') },
      { k: 'Due date (40 weeks)', v: D.fmtDate(due, 'med') },
      { k: '42 weeks', v: D.fmtDate(D.addDays(lmp, 294), 'med') },
      { note: 'Only about 1 baby in 25 arrives on the due date; most come within two weeks either side. Your midwife or doctor may adjust it after the first scan.' });
    return items;
  },
};

function mountSleep(root, ctx) {
  const st = Object.assign({ mode: 'wake', t: '07:00' }, ctx.state || {});
  const out = results();
  const tIn = timeField(st.t, v => { st.t = v; upd(); }, { now: true, aria: 'Time' });
  const lbl = h('span');
  root.append(h('div', { class: 'card form' }, h('div', { class: 'frow seg-row' }, seg([['wake', 'I want to wake up at'], ['bed', 'I go to bed at']], st.mode, v => { st.mode = v; upd(); })), row(lbl, tIn)), out,
    h('p', { class: 'note' }, 'A sleep cycle lasts about 90 minutes. Waking at the end of a cycle feels easier than in deep sleep. Times include ~15 minutes to fall asleep. Adults need 7–9 hours.'));
  function upd() {
    ctx.save(st);
    lbl.textContent = st.mode === 'wake' ? 'Wake-up time' : 'Bedtime';
    const t = D.timeToSec(st.t);
    if (t == null) return out.render([{ note: 'Pick a time.' }]);
    const fmtT = s => { const [hh, mm] = D.secToTime(s).split(':').map(Number); return new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: settings.hour12 }); };
    const items = [{ head: st.mode === 'wake' ? 'Go to bed at' : 'Set your alarm for' }];
    for (const c of [6, 5, 4, 3]) {
      const dur = c * 5400;
      const x = st.mode === 'wake' ? t - dur - 900 : t + 900 + dur;
      items.push({ k: `${c} cycles · ${D.hmText(dur).replace(' 00 min', ' h').replace(/ h (\d+) min/, ' h $1')}`, v: fmtT(x), tone: c >= 5 ? 'good' : null, sub: c >= 5 ? 'Recommended' : c === 4 ? 'Short night' : 'Nap territory' });
    }
    out.render(items);
  }
  upd();
}

export const tools = { bmi, calories, bodyfat, hrzones, duedate, sleep: { mount: mountSleep } };
void pad;
