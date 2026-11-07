// Date & time tools.
import { h, icon, copyText, openSheet, norm, toast, confirmSheet } from '../core/dom.js';
import { parseNum, fmt, fmtMoney, currencySymbol } from '../core/num.js';
import { numField, seg, selectEl, toggle, row, results, iconBtn, dateField, timeField, timePill, tabs, chips, pad, card, btn } from '../core/ui.js';
import { mountForm, ok, okPos } from '../core/form.js';
import { mountSolver } from '../core/solver.js';
import { settings } from '../core/store.js';
import { unitsOf, CATEGORIES } from '../data/units.js';
import { CITIES, countryName, flag, safeZone } from '../data/geo.js';
import * as D from '../lib/dates.js';
import { wall, offsetMin, instantOf, offsetLabel, diffLabel, zoneAbbr, fmtTime, fmtDay, zoneEntries, isDST } from '../lib/tz.js';
import { sunTimes, moonIllumination, moonTimes, phaseName, nextPhase } from '../lib/sun.js';
import { holidaySet } from '../lib/holidays.js';

const T = D.todayISO;
const n0 = x => Math.round(x).toLocaleString();
const WEEKENDS = [['60', 'Sat–Sun'], ['56', 'Fri–Sat'], ['0', 'Sun'], ['x', 'None']];
const weekendOf = code => (code === 'x' ? [] : [...String(code)].map(Number));
const LOCAL_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
const nextNewYear = () => `${new Date().getFullYear() + 1}-01-01`;

/* ---------- holidays helper for forms ---------- */
function holidayLoader(onReady) {
  let key = '', data = { set: new Set(), list: [] }, loading = false;
  return (cc, a, b) => {
    const k = `${cc}|${a.slice(0, 4)}|${b.slice(0, 4)}`;
    if (k !== key && !loading) {
      loading = true; key = k;
      holidaySet(cc, a, b).then(r => { data = r; loading = false; onReady(); });
    }
    return k === key && !loading ? data : { set: new Set(), list: [], loading: true };
  };
}

/* ---------- Date difference ---------- */
async function mountDateDiff(root, ctx) {
  let form;
  const getHol = holidayLoader(() => form?.update());
  form = mountForm(root, {
    fields: [
      { id: 'a', type: 'date', label: 'From', default: T },
      { id: 'b', type: 'date', label: 'To', default: nextNewYear },
      { id: 'inc', type: 'toggle', label: 'Include the end date', hint: 'Counts both the first and the last day' },
      { id: 'times', type: 'toggle', label: 'Add times of day' },
      { id: 'ta', type: 'time', label: 'Start time', default: '09:00', when: v => v.times },
      { id: 'tb', type: 'time', label: 'End time', default: '17:00', when: v => v.times },
      { group: 'Working days' },
      { id: 'wk', type: 'seg', label: 'Weekend', options: WEEKENDS, default: '60' },
      { id: 'hol', type: 'toggle', label: `Skip public holidays`, hint: countryName(settings.country) + ' · change country in Settings' },
    ],
    compute(v) {
      if (!D.isValidISO(v.a) || !D.isValidISO(v.b)) return [{ note: 'Pick two dates.' }];
      let a = v.a, b = v.b;
      const back = D.dayNum(b) < D.dayNum(a);
      if (back) [a, b] = [b, a];
      const ymd = D.diffYMD(a, v.inc ? D.addDays(b, 1) : b);
      let days = D.dayNum(b) - D.dayNum(a) + (v.inc ? 1 : 0);
      let secs = days * 86400;
      if (v.times && !v.inc) {
        const ta = D.timeToSec(back ? v.tb : v.ta) || 0, tb = D.timeToSec(back ? v.ta : v.tb) || 0;
        secs += tb - ta;
      }
      const hol = v.hol ? getHol(settings.country, a, b) : { set: new Set(), list: [] };
      const c = D.countDays(a, b, { weekend: weekendOf(v.wk), holidays: hol.set, inclusive: v.inc });
      const w = Math.floor(Math.abs(days) / 7), wd = Math.abs(days) % 7;
      const hm = v.times && !v.inc ? D.hmText(secs - Math.floor(secs / 86400) * 86400) : '';
      const items = [
        { k: back ? 'Going back' : 'Difference', v: v.times && !v.inc ? `${n0(Math.floor(secs / 86400))} days ${hm}` : D.ymdText(ymd), big: true, sub: v.times && !v.inc ? D.ymdText(D.diffYMD(a, b)) + ' + ' + hm : `${n0(days)} ${days === 1 ? 'day' : 'days'}${v.inc ? ', end date included' : ''}` },
        { k: 'Total days', v: n0(days) },
        { k: 'In weeks', v: `${n0(w)} wk${wd ? ` ${wd} d` : ''}` },
        { k: 'In months', v: `${n0(ymd.months)} mo${ymd.d ? ` ${ymd.d} d` : ''}` },
        { k: `Working days`, v: hol.loading ? '…' : n0(c.working), tone: 'accent', sub: v.hol ? (hol.error ? hol.error : hol.loading ? 'Loading holidays…' : `${c.holidays} public ${c.holidays === 1 ? 'holiday' : 'holidays'} excluded`) : `Excludes weekends (${WEEKENDS.find(x => x[0] === v.wk)?.[1] || ''})` },
        { k: 'Weekend days', v: n0(c.weekend) },
        { k: 'Hours', v: n0(secs / 3600) },
        { k: 'Minutes', v: n0(secs / 60) },
        { k: 'Seconds', v: n0(secs) },
        { k: 'From', v: D.fmtDate(a, 'full') },
        { k: 'To', v: D.fmtDate(b, 'full') },
      ];
      if (v.hol && c.holidayDates.length) {
        const byDate = new Map(hol.list.map(x => [x.date, x]));
        items.push({ head: 'Holidays in this period' }, ...c.holidayDates.map(d => ({ k: byDate.get(d)?.localName || byDate.get(d)?.name || 'Holiday', v: D.fmtDate(d, 'med'), nocopy: true })));
      }
      return items;
    },
  }, ctx);
}

/* ---------- Add to date ---------- */
async function mountDateAdd(root, ctx) {
  let form;
  const getHol = holidayLoader(() => form?.update());
  form = mountForm(root, {
    fields: [
      { id: 'a', type: 'date', label: 'Start date', default: T },
      { id: 'op', type: 'seg', options: [['add', '＋ Add'], ['sub', '− Subtract']], default: 'add' },
      { id: 'mode', type: 'seg', options: [['cal', 'Calendar days'], ['work', 'Working days']], default: 'cal' },
      { id: 'y', type: 'num', label: 'Years', when: v => v.mode === 'cal', placeholder: '0' },
      { id: 'm', type: 'num', label: 'Months', when: v => v.mode === 'cal', placeholder: '0' },
      { id: 'w', type: 'num', label: 'Weeks', when: v => v.mode === 'cal', placeholder: '0' },
      { id: 'd', type: 'num', label: 'Days', when: v => v.mode === 'cal', default: '30', presets: [[7, '7'], [14, '14'], [30, '30'], [45, '45'], [60, '60'], [90, '90'], [100, '100'], [180, '180'], [365, '365']] },
      { id: 'wd', type: 'num', label: 'Working days', when: v => v.mode === 'work', default: '10', presets: [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30'], [60, '60']] },
      { id: 'wk', type: 'seg', label: 'Weekend', options: WEEKENDS, default: '60', when: v => v.mode === 'work' },
      { id: 'hol', type: 'toggle', label: 'Skip public holidays', hint: countryName(settings.country), when: v => v.mode === 'work' },
    ],
    compute(v) {
      if (!D.isValidISO(v.a)) return [{ note: 'Pick a start date.' }];
      const s = v.op === 'sub' ? -1 : 1;
      let res, note = null;
      if (v.mode === 'work') {
        if (!ok(v.wd)) return [{ note: 'Enter a number of working days.' }];
        const end = D.addDays(v.a, s * Math.ceil(Math.abs(v.wd) * 1.6 + 30));
        const hol = v.hol ? getHol(settings.country, s > 0 ? v.a : end, s > 0 ? end : v.a) : { set: new Set() };
        if (hol.loading) return [{ note: 'Loading public holidays…' }];
        res = D.addWorkingDays(v.a, s * v.wd, { weekend: weekendOf(v.wk), holidays: hol.set });
        if (hol.error) note = hol.error;
      } else {
        const y = ok(v.y) ? v.y : 0, m = ok(v.m) ? v.m : 0, w = ok(v.w) ? v.w : 0, d = ok(v.d) ? v.d : 0;
        const totalMonths = Math.trunc(y * 12 + m);
        const r1 = D.addMonths(v.a, s * totalMonths);
        if (totalMonths && D.parts(r1).d !== D.parts(v.a).d) note = `${D.fmtDate(v.a, 'short')} has no equivalent in that month, so the last day of the month is used.`;
        res = D.addDays(r1, Math.round(s * (w * 7 + d)));
      }
      const diff = D.dayNum(res) - D.dayNum(T());
      const iw = D.isoWeek(res);
      return [
        { k: 'Result', v: D.fmtDate(res, 'full'), big: true, sub: D.relDays(diff).replace(/^./, c => c.toUpperCase()), copy: D.fmtDate(res, 'full') },
        { k: 'ISO date', v: res },
        { k: 'Week', v: `W${iw.week} · ${iw.year}` },
        { k: 'Day of the year', v: `${D.dayOfYear(res)} / ${D.isLeap(+res.slice(0, 4)) ? 366 : 365}` },
        { k: 'Calendar days from start', v: n0(Math.abs(D.dayNum(res) - D.dayNum(v.a))) },
        note ? { note } : null,
      ];
    },
  }, ctx);
}

/* ---------- Age ---------- */
const age = {
  fields: [
    { id: 'b', type: 'date', label: 'Date of birth', default: '1990-06-15', today: false },
    { id: 'on', type: 'date', label: 'Age on', default: T },
  ],
  compute(v) {
    if (!D.isValidISO(v.b) || !D.isValidISO(v.on)) return [{ note: 'Pick a date of birth.' }];
    if (D.dayNum(v.on) < D.dayNum(v.b)) return [{ note: 'The date of birth is after the other date.' }];
    const a = D.diffYMD(v.b, v.on);
    const days = D.dayNum(v.on) - D.dayNum(v.b);
    const { y: by, m: bm, d: bd } = D.parts(v.b);
    const onY = D.parts(v.on).y;
    const bdayIn = yy => { const iso = `${yy}-${pad(bm)}-${pad(Math.min(bd, D.daysInMonth(yy, bm)))}`; return iso; };
    let next = bdayIn(onY);
    if (D.dayNum(next) <= D.dayNum(v.on)) next = bdayIn(onY + 1);
    if (a.m === 0 && a.d === 0) next = v.on;
    const isToday = next === v.on;
    const until = D.dayNum(next) - D.dayNum(v.on);
    const z = D.zodiac(v.b);
    const milestones = [[10000, 'days'], [20000, 'days'], [30000, 'days']].map(([n]) => [D.addDays(v.b, n), `${n0(n)} days old`]);
    milestones.push([D.addDays(v.b, 11574), '1 billion seconds old'], [D.addDays(v.b, 23148), '2 billion seconds old']);
    const upcoming = milestones.filter(([d]) => D.dayNum(d) >= D.dayNum(v.on)).slice(0, 2);
    return [
      { k: 'Age', v: `${a.y} years`, big: true, sub: D.ymdText(a) },
      { k: isToday ? '🎉 Birthday' : 'Next birthday', v: isToday ? 'Today!' : D.relDays(until), sub: `${D.fmtDate(next, 'full')} · turns ${D.parts(next).y - by}` },
      { k: 'Born on a', v: D.weekdayName(D.weekday(v.b)) },
      { k: 'Months', v: n0(a.y * 12 + a.m) },
      { k: 'Weeks', v: n0(Math.floor(days / 7)) },
      { k: 'Days', v: n0(days) },
      { k: 'Hours (approx.)', v: n0(days * 24) },
      { k: 'Star sign', v: `${z[1]} ${z[0]}` },
      { k: 'Chinese zodiac', v: D.chineseZodiac(by), sub: bm <= 2 ? 'Born in Jan/Feb: check the Chinese New Year date of that year' : null },
      { k: 'Generation', v: D.generation(by) },
      ...upcoming.map(([d, label]) => ({ k: label, v: D.fmtDate(d, 'med'), sub: D.relDays(D.dayNum(d) - D.dayNum(v.on)) })),
    ];
  },
};

/* ---------- Countdowns ---------- */
function nextOccurrence(ev, now = Date.now()) {
  const [hh, mm] = (ev.time || '00:00').split(':').map(Number);
  const at = iso => { const p = D.parts(iso); return new Date(p.y, p.m - 1, p.d, hh, mm).getTime(); };
  let t = at(ev.date);
  if (ev.yearly) {
    const p = D.parts(ev.date);
    let y = new Date(now).getFullYear();
    for (let i = 0; i < 3; i++) {
      const iso = `${y + i}-${pad(p.m)}-${pad(Math.min(p.d, D.daysInMonth(y + i, p.m)))}`;
      const tt = at(iso);
      if (tt + (ev.time ? 0 : 864e5) > now) { t = tt; break; }
    }
  }
  return t;
}
function mountCountdown(root, ctx) {
  const y = new Date().getFullYear();
  const st = Object.assign({ events: [
    { id: 'ny', name: 'New Year', date: `${y + 1}-01-01`, yearly: true },
    { id: 'xmas', name: 'Christmas', date: `${y}-12-25`, yearly: true },
    { id: 'summer', name: 'First day of summer', date: `${y}-06-21`, yearly: true },
  ] }, ctx.state || {});
  const list = h('div');
  const addB = h('button', { class: 'btn cat block', type: 'button', onclick: () => editEvent(null) }, icon('plus'), 'Add a countdown');
  root.append(list, addB, h('p', { class: 'note', style: { marginTop: '12px' } }, 'Saved on this device. Yearly events (birthdays, holidays) roll over automatically.'));
  const save = () => ctx.saveNow(st);
  let cards = [];
  function draw() {
    const now = Date.now();
    const evs = st.events.map(e => ({ e, t: nextOccurrence(e, now) })).sort((a, b) => (a.t < now) - (b.t < now) || (a.t < now ? b.t - a.t : a.t - b.t));
    cards = evs.map(({ e, t }) => {
      const big = h('div', { class: 'cd-big' }), sub = h('div', { class: 'cd-sub' }), live = h('div', { class: 'cd-live' });
      const c = h('button', { class: 'card pad cd', type: 'button', onclick: () => editEvent(e) },
        h('div', { class: 'cd-name' }, e.name, e.yearly ? h('span', { class: 'badge' }, 'yearly') : null), big, live, sub);
      return { e, t, big, sub, live, c };
    });
    list.replaceChildren(...(cards.length ? cards.map(x => x.c) : [h('p', { class: 'muted' }, 'No countdowns yet.')]));
    tick();
  }
  function tick() {
    const now = Date.now();
    for (const x of cards) {
      const ms = x.t - now;
      const past = ms < 0;
      const a = Math.abs(ms);
      const days = Math.floor(a / 864e5);
      const dDate = new Date(x.t);
      const iso = `${dDate.getFullYear()}-${pad(dDate.getMonth() + 1)}-${pad(dDate.getDate())}`;
      const calDays = D.dayNum(iso) - D.dayNum(D.todayISO());
      x.big.textContent = calDays === 0 && !x.e.time ? 'Today 🎉' : past ? `${n0(Math.abs(calDays))} days ago` : `${n0(calDays)} ${calDays === 1 ? 'day' : 'days'}`;
      const hh = Math.floor(a / 36e5) % 24, mm = Math.floor(a / 6e4) % 60, ss = Math.floor(a / 1000) % 60;
      x.live.textContent = past ? '' : `${days} d ${pad(hh)} h ${pad(mm)} m ${pad(ss)} s`;
      const w = Math.floor(Math.abs(calDays) / 7), r = Math.abs(calDays) % 7;
      x.sub.textContent = `${D.fmtDate(iso, 'full')}${x.e.time ? ' · ' + x.e.time : ''}${Math.abs(calDays) >= 7 ? ` · ${w} wk ${r} d` : ''}`;
      x.c.classList.toggle('past', past);
    }
  }
  const timer = setInterval(() => { if (!document.hidden) tick(); }, 1000);
  ctx.onCleanup(() => clearInterval(timer));
  function editEvent(e) {
    const isNew = !e;
    const ev = e ? { ...e } : { id: String(Date.now()), name: '', date: D.addDays(T(), 30), time: '', yearly: false };
    const nameIn = h('input', { class: 'text-in', type: 'text', value: ev.name, placeholder: 'Holiday, birthday, exam…', 'aria-label': 'Name', autocomplete: 'off' });
    const dateIn = dateField(ev.date, v => { ev.date = v; }, { today: false });
    const timeIn = timeField(ev.time || '', v => { ev.time = v; });
    const yearly = toggle('Repeat every year', ev.yearly, v => { ev.yearly = v; });
    const yy = new Date().getFullYear();
    const quick = chips([
      ['ny', 'New Year'], ['val', 'Valentine’s'], ['easter', 'Easter'], ['hall', 'Halloween'], ['xmas', 'Christmas'], ['bday', 'Birthday'],
    ], k => {
      const m = { ny: ['New Year', `${yy + 1}-01-01`, true], val: ['Valentine’s Day', `${yy}-02-14`, true], easter: ['Easter', D.dayNum(D.easter(yy)) >= D.dayNum(T()) ? D.easter(yy) : D.easter(yy + 1), false], hall: ['Halloween', `${yy}-10-31`, true], xmas: ['Christmas', `${yy}-12-25`, true], bday: ['Birthday', ev.date, true] }[k];
      nameIn.value = m[0]; ev.date = m[1]; dateIn.set(m[1]); ev.yearly = m[2]; yearly.set(m[2]);
    });
    const body = h('div', { class: 'stack' },
      isNew ? quick : null,
      h('div', { class: 'card form' }, row('Name', nameIn, { stack: true }), row('Date', dateIn), row('Time', timeIn, { hint: 'optional' }), h('div', { class: 'frow toggle-row' }, yearly)),
      h('div', { class: 'row-btns' },
        !isNew ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { s.close(); if (await confirmSheet('Delete this countdown?', ev.name, 'Delete', true)) { st.events = st.events.filter(x => x.id !== ev.id); save(); draw(); } } }, 'Delete') : null,
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          ev.name = nameIn.value.trim() || 'Event';
          if (!D.isValidISO(ev.date)) return toast('Pick a date');
          const i = st.events.findIndex(x => x.id === ev.id);
          if (i >= 0) st.events[i] = ev; else st.events.push(ev);
          save(); s.close(); draw();
        } }, 'Save')));
    const s = openSheet({ title: isNew ? 'New countdown' : 'Edit countdown', body });
  }
  draw();
}

/* ---------- Time zones ---------- */
function pickZone({ onPick, title = 'Add a city or time zone' }) {
  const input = h('input', { class: 'search-in', type: 'search', placeholder: 'City, country or zone', autocomplete: 'off', autocorrect: 'off', 'aria-label': 'Search time zones' });
  const list = h('div');
  const all = zoneEntries();
  const now = Date.now();
  const item = e => h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); onPick(e); } },
    h('span', { class: 'flag' }, e.flag), h('span', { class: 'p-main' }, h('b', null, e.name), h('small', null, `${e.cc ? countryName(e.cc) + ' · ' : ''}${e.tz.replace(/_/g, ' ')}`)),
    h('span', { class: 'p-side' }, fmtTime(now, e.tz, settings.hour12), h('br'), offsetLabel(offsetMin(e.tz, now))));
  const draw = () => {
    const q = norm(input.value);
    let hits;
    if (!q) hits = all.filter(e => e.cc).slice(0, 60);
    else hits = all.filter(e => norm(e.name).includes(q) || norm(e.tz).includes(q) || (e.cc && norm(countryName(e.cc)).includes(q)) || e.al.some(a => norm(a).includes(q)) || norm(zoneAbbr(e.tz, now)) === q || norm(offsetLabel(offsetMin(e.tz, now))) === q.replace(/^gmt/, 'utc')).slice(0, 80);
    list.replaceChildren(hits.length ? h('div', { class: 'pick-list' }, hits.map(item)) : h('p', { class: 'muted' }, 'No match.'));
  };
  input.addEventListener('input', draw);
  draw();
  const s = openSheet({ title, body: h('div', null, h('div', { class: 'search-box' }, icon('search'), input), list) });
}
function cityForZone(tz) { const c = CITIES.find(c => c.tz === tz); return c ? c.name : tz.split('/').pop().replace(/_/g, ' '); }
function mountZones(root, ctx) {
  const defaults = ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'Asia/Dubai', 'America/Los_Angeles', 'Australia/Sydney'].filter(z => z !== LOCAL_TZ).slice(0, 4);
  const st = Object.assign({ zones: [{ tz: LOCAL_TZ, name: cityForZone(LOCAL_TZ) }, ...defaults.map(tz => ({ tz, name: cityForZone(tz) }))] }, ctx.state || {});
  let ref = null; // null = live now, else instant ms
  let shift = 0; // minutes from the slider
  let edit = false;
  const nowBtn = h('button', { class: 'chip on', type: 'button', onclick: () => { ref = null; shift = 0; slider.value = 0; draw(); } }, 'Now');
  const slider = h('input', { type: 'range', class: 'scrub', min: -720, max: 720, step: 15, value: 0, 'aria-label': 'Shift time' });
  const shiftLbl = h('span', { class: 'muted' });
  slider.addEventListener('input', () => { if (ref == null) ref = Date.now(); shift = +slider.value; draw(); });
  const listEl = h('div', { class: 'card list' });
  const addB = h('button', { class: 'add-btn', type: 'button', onclick: () => pickZone({ onPick: e => { st.zones.push({ tz: e.tz, name: e.name }); save(); draw(); } }) }, icon('plus'), 'Add city or zone');
  const editB = h('button', { class: 'btn ghost', type: 'button', onclick: () => { edit = !edit; editB.textContent = edit ? 'Done' : 'Edit list'; draw(); } }, 'Edit list');
  root.append(
    h('div', { class: 'card pad tz-ctl' }, h('div', { class: 'tz-top' }, nowBtn, shiftLbl), slider, h('div', { class: 'chart-axis' }, h('span', null, '−12 h'), h('span', null, 'Drag to plan a meeting'), h('span', null, '+12 h'))),
    listEl, h('div', { class: 'row-btns' }, editB),
    h('p', { class: 'note' }, 'Tap a time to change it: every other city follows. Green = 8:00–18:00, orange = early/late, grey = night. Daylight-saving rules come from your device.'));
  const save = () => ctx.save(st);
  function draw() {
    const t = (ref ?? Date.now()) + shift * 60000;
    nowBtn.classList.toggle('on', ref == null && shift === 0);
    shiftLbl.textContent = ref == null && shift === 0 ? 'Live' : `${new Date(t).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: settings.hour12 })} your time`;
    const localOff = offsetMin(LOCAL_TZ, t);
    const localDay = wall(t, LOCAL_TZ).day;
    listEl.replaceChildren(...st.zones.map((z, i) => {
      const w = wall(t, z.tz);
      const off = offsetMin(z.tz, t);
      const hr = w.hour + w.minute / 60;
      const tone = hr >= 8 && hr < 18 ? 'good' : (hr >= 6 && hr < 8) || (hr >= 18 && hr < 22) ? 'warn' : 'night';
      const dayDiff = w.day !== localDay ? (Date.UTC(w.year, w.month - 1, w.day) > Date.UTC(...ymdOf(t, LOCAL_TZ)) ? ' · next day' : ' · previous day') : '';
      const timeIn = h('input', { type: 'time', class: 'tz-in', value: `${pad(w.hour)}:${pad(w.minute)}`, 'aria-label': `Time in ${z.name}` });
      const timeTxt = h('span', { class: 'tz-txt', 'aria-hidden': 'true' }, fmtTime(t, z.tz, settings.hour12));
      timeTxt.addEventListener('click', () => { try { timeIn.showPicker(); } catch { timeIn.focus(); } });
      timeIn.addEventListener('change', () => {
        if (!timeIn.value) return;
        const [hh, mm] = timeIn.value.split(':').map(Number);
        ref = instantOf(z.tz, w.year, w.month, w.day, hh, mm); shift = 0; slider.value = 0; draw();
      });
      const abbr = off === 0 && /^(GMT|UTC)$/.test(zoneAbbr(z.tz, t)) ? '' : zoneAbbr(z.tz, t);
      const sub = `${fmtDay(t, z.tz)} · ${offsetLabel(off)}${abbr ? ' ' + abbr : ''}${z.tz === LOCAL_TZ ? ' · you' : ' · ' + diffLabel(off - localOff)}${isDST(z.tz, t) ? ' · DST' : ''}${dayDiff}`;
      const tools = edit ? h('span', { class: 'edit-tools' },
        iconBtn('arrowUp', () => { if (i) { [st.zones[i - 1], st.zones[i]] = [st.zones[i], st.zones[i - 1]]; save(); draw(); } }, 'Move up'),
        iconBtn('trash', () => { st.zones.splice(i, 1); save(); draw(); }, 'Remove', 'del')) : null;
      return h('div', { class: 'li tz-row' },
        h('span', { class: 'dot-day ' + tone, title: tone }),
        h('div', { class: 'li-main' }, h('div', { class: 'li-title' }, z.name), h('div', { class: 'li-sub' }, sub)),
        edit ? tools : h('div', { class: 'zone-time' }, timeTxt, timeIn));
    }), addB);
  }
  const ymdOf = (t, tz) => { const w = wall(t, tz); return [w.year, w.month - 1, w.day]; };
  draw();
  const timer = setInterval(() => { if (ref == null && shift === 0 && !document.hidden && !listEl.contains(document.activeElement)) draw(); }, 10000);
  ctx.onCleanup(() => clearInterval(timer));
}

/* ---------- Time calculator ---------- */
function mountTimeCalc(root, ctx) {
  const st = Object.assign({ tab: 'between', a: '09:00', b: '17:30', brk: '30', rows: [{ s: 1, h: '1', m: '30', sec: '' }, { s: 1, h: '2', m: '45', sec: '' }], ct: '22:30', cs: 1, ch: '8', cm: '15' }, ctx.state || {});
  const save = () => ctx.save(st);
  const t = tabs([['between', 'Between times'], ['sum', 'Add durations'], ['clock', 'Time ± duration']], st.tab, v => { st.tab = v; save(); });
  root.append(t.el);
  // between
  const r1 = results();
  const aIn = timeField(st.a, v => { st.a = v; upd1(); }, { now: true, aria: 'Start' });
  const bIn = timeField(st.b, v => { st.b = v; upd1(); }, { now: true, aria: 'End' });
  const brk = numField({ value: st.brk, suffix: 'min', aria: 'Break', onInput: (n, raw) => { st.brk = raw; upd1(); } });
  t.panes.between.append(h('div', { class: 'card form' }, row('Start', aIn), row('End', bIn), row('Break', brk, { hint: 'optional' })), r1);
  function upd1() {
    save();
    const a = D.timeToSec(st.a), b = D.timeToSec(st.b);
    if (a == null || b == null) return r1.render([{ note: 'Pick two times.' }]);
    let d = b - a; const over = d < 0; if (over) d += 86400;
    const br = (parseNum(st.brk) || 0) * 60;
    const net = Math.max(0, d - br);
    r1.render([
      { k: 'Duration', v: D.hmText(net), big: true, sub: over ? 'Ends the next day' : null, copy: D.hhmm(net) },
      { k: 'Decimal hours', v: fmt(net / 3600, { maxDec: 2 }) + ' h', copy: fmt(net / 3600, { maxDec: 2 }) },
      { k: 'Minutes', v: n0(net / 60) },
      br ? { k: 'Before break', v: D.hmText(d) } : null,
    ]);
  }
  // sum
  const sumList = h('div', { class: 'card list' });
  const r2 = results();
  const addRow = h('button', { class: 'add-btn', type: 'button', onclick: () => { st.rows.push({ s: 1, h: '', m: '', sec: '' }); drawRows(); } }, icon('plus'), 'Add a duration');
  t.panes.sum.append(sumList, r2);
  function drawRows() {
    sumList.replaceChildren(...st.rows.map((r, i) => {
      const sign = h('button', { class: 'sign-btn' + (r.s < 0 ? ' neg' : ''), type: 'button', 'aria-label': 'Add or subtract', onclick: () => { r.s = -r.s; drawRows(); } }, r.s < 0 ? '−' : '+');
      const f = (k, sfx) => numField({ value: r[k], suffix: sfx, placeholder: '0', aria: sfx, onInput: (n, raw) => { r[k] = raw; upd2(); } });
      return h('div', { class: 'li sum-row' }, sign, h('div', { class: 'hms' }, f('h', 'h'), f('m', 'min'), f('sec', 's')),
        st.rows.length > 1 ? iconBtn('close', () => { st.rows.splice(i, 1); drawRows(); }, 'Remove') : null);
    }), addRow);
    upd2();
  }
  function upd2() {
    save();
    const tot = st.rows.reduce((a, r) => a + r.s * ((parseNum(r.h) || 0) * 3600 + (parseNum(r.m) || 0) * 60 + (parseNum(r.sec) || 0)), 0);
    r2.render([
      { k: 'Total', v: D.hmText(tot, { seconds: tot % 60 !== 0 }), big: true, copy: D.hhmmss(tot) },
      { k: 'h:mm:ss', v: D.hhmmss(tot) },
      { k: 'Decimal hours', v: fmt(tot / 3600, { maxDec: 4 }) },
      Math.abs(tot) >= 86400 ? { k: 'In days', v: D.hmText(tot, { days: true }) } : null,
      { k: 'Minutes', v: fmt(tot / 60, { maxDec: 2 }) },
    ]);
  }
  // clock
  const r3 = results();
  const ctIn = timeField(st.ct, v => { st.ct = v; upd3(); }, { now: true, aria: 'Time' });
  const cop = seg([[1, '＋ Add'], [-1, '− Subtract']], st.cs, v => { st.cs = v; upd3(); });
  const chIn = numField({ value: st.ch, suffix: 'h', aria: 'Hours', onInput: (n, raw) => { st.ch = raw; upd3(); } });
  const cmIn = numField({ value: st.cm, suffix: 'min', aria: 'Minutes', onInput: (n, raw) => { st.cm = raw; upd3(); } });
  t.panes.clock.append(h('div', { class: 'card form' }, row('Time', ctIn), h('div', { class: 'frow seg-row' }, cop), row('Duration', h('div', { class: 'hms' }, chIn, cmIn))), r3);
  function upd3() {
    save();
    const a = D.timeToSec(st.ct);
    if (a == null) return r3.render([{ note: 'Pick a time.' }]);
    const d = (parseNum(st.ch) || 0) * 3600 + (parseNum(st.cm) || 0) * 60;
    const r = a + st.cs * d;
    const days = Math.floor(r / 86400);
    const tm = D.secToTime(r);
    const [hh, mm] = tm.split(':').map(Number);
    const label = new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: settings.hour12 });
    r3.render([{ k: 'Result', v: label, big: true, sub: days === 0 ? 'Same day' : days > 0 ? (days === 1 ? 'Next day' : `${days} days later`) : (days === -1 ? 'Previous day' : `${-days} days earlier`), copy: tm }]);
  }
  upd1(); drawRows(); upd3();
}

/* ---------- Timesheet ---------- */
function mountTimesheet(root, ctx) {
  const days = Array.from({ length: 5 }, (_, i) => D.weekdayName((settings.weekStart + i) % 7, 'short'));
  const st = Object.assign({ rows: days.map(d => ({ l: d, a: '09:00', b: '17:00', br: '60' })), rate: '', ot: settings.country === 'FR' ? '35' : '40' }, ctx.state || {});
  const save = () => ctx.save(st);
  const listEl = h('div', { class: 'card list ts' });
  const out = results();
  const rateIn = numField({ value: st.rate, prefix: currencySymbol(settings.currency), placeholder: 'optional', aria: 'Hourly rate', onInput: (n, raw) => { st.rate = raw; upd(); } });
  const otIn = numField({ value: st.ot, suffix: 'h / week', aria: 'Overtime after', onInput: (n, raw) => { st.ot = raw; upd(); } });
  const addB = h('button', { class: 'add-btn', type: 'button', onclick: () => { const i = st.rows.length; st.rows.push({ l: D.weekdayName((settings.weekStart + i) % 7, 'short'), a: '09:00', b: '17:00', br: '60' }); drawRows(); } }, icon('plus'), 'Add a day');
  const copyB = h('button', { class: 'btn ghost', type: 'button', onclick: () => copyText(st.rows.map(r => `${r.l}\t${r.a}–${r.b}\tbreak ${r.br || 0} min\t${D.hhmm(rowSec(r))}`).join('\n') + `\nTotal\t${D.hhmm(total())}`, 'timesheet') }, 'Copy as text');
  root.append(h('div', { class: 'ts-head' }, h('span', null, 'Day'), h('span', null, 'Start'), h('span', null, 'End'), h('span', null, 'Break'), h('span', null, 'Hours')), listEl,
    h('div', { class: 'card form' }, row('Hourly rate', rateIn), row('Overtime after', otIn)), out, h('div', { class: 'row-btns' }, copyB));
  const rowSec = r => { const a = D.timeToSec(r.a), b = D.timeToSec(r.b); if (a == null || b == null) return 0; let d = b - a; if (d < 0) d += 86400; return Math.max(0, d - (parseNum(r.br) || 0) * 60); };
  const total = () => st.rows.reduce((s, r) => s + rowSec(r), 0);
  let cells = [];
  function drawRows() {
    cells = [];
    listEl.replaceChildren(...st.rows.map((r, i) => {
      const lab = h('input', { class: 'ts-l', type: 'text', value: r.l, 'aria-label': 'Day', autocomplete: 'off' });
      lab.addEventListener('input', () => { r.l = lab.value; save(); });
      const a = timePill(r.a, v => { r.a = v; upd(); }, { aria: 'Start', hour12: settings.hour12 });
      const b = timePill(r.b, v => { r.b = v; upd(); }, { aria: 'End', hour12: settings.hour12 });
      const br = numField({ value: r.br, placeholder: '0', aria: 'Break minutes', onInput: (n, raw) => { r.br = raw; upd(); } });
      const tot = h('span', { class: 'ts-tot' });
      cells.push(tot);
      const del = h('button', { class: 'ts-del', type: 'button', 'aria-label': 'Remove day', onclick: () => { st.rows.splice(i, 1); drawRows(); } }, '×');
      return h('div', { class: 'ts-row' }, lab, a, b, br, tot, del);
    }), addB);
    upd();
  }
  function upd() {
    save();
    st.rows.forEach((r, i) => { if (cells[i]) cells[i].textContent = D.hhmm(rowSec(r)); });
    const t = total(), ot = parseNum(st.ot), rate = parseNum(st.rate);
    const over = Number.isFinite(ot) ? Math.max(0, t - ot * 3600) : 0;
    out.render([
      { k: 'Total worked', v: D.hmText(t), big: true, sub: `${fmt(t / 3600, { maxDec: 2 })} h in decimal`, copy: D.hhmm(t) },
      { k: 'Average per day', v: D.hmText(st.rows.length ? t / st.rows.length : 0) },
      over ? { k: 'Overtime', v: D.hmText(over), tone: 'warn', sub: `Above ${fmt(ot)} h` } : null,
      Number.isFinite(rate) && rate > 0 ? { k: 'Pay', v: fmtMoney(t / 3600 * rate, settings.currency), sub: `${fmt(t / 3600, { maxDec: 2 })} h × ${fmtMoney(rate, settings.currency)}` } : null,
    ]);
  }
  drawRows();
}

/* ---------- Travel time & running pace (solvers) ---------- */
const len = ids => unitsOf('length').filter(u => ids.includes(u.id));
const spd = ids => unitsOf('speed').filter(u => ids.includes(u.id));
const HM = { id: 'hm', name: 'Hours + minutes', sym: 'h min', parts: [{ sym: 'h', f: 3600 }, { sym: 'min', f: 60 }], dec: 0, toBase: x => x, fromBase: b => b };
const HMS = unitsOf('time').find(u => u.id === 'hms');
const metric = () => settings.system === 'metric';
function mountTravel(root, ctx) {
  const st0 = ctx.state || {};
  const dep = { t: st0.dep || '' };
  const s = mountSolver(root, ctx, {
    vars: [
      { id: 'd', label: 'Distance', units: len(['km', 'mi', 'm', 'nmi']), unit: metric() ? 'km' : 'mi' },
      { id: 'v', label: 'Average speed', units: spd(['kmh', 'mph', 'kn', 'ms']), unit: metric() ? 'kmh' : 'mph' },
      { id: 't', label: 'Time', units: [HM] },
    ],
    defaults: { known: ['d', 'v'], vals: { d: metric() ? 250000 : 160934.4, v: metric() ? 100 / 3.6 : 26.8224 } },
    solve(k) {
      if ('d' in k && 'v' in k) return { t: k.d / k.v };
      if ('d' in k && 't' in k) return { v: k.d / k.t };
      return { d: k.v * k.t };
    },
    extra(v) {
      const items = [{ k: 'Travel time', v: D.hmText(v.t), big: true, sub: `${fmt(v.d / 1000, { maxDec: 1 })} km · ${fmt(v.d / 1609.344, { maxDec: 1 })} mi · ${fmt(v.v * 3.6, { maxDec: 1 })} km/h · ${fmt(v.v / 0.44704, { maxDec: 1 })} mph` }];
      const dt = D.timeToSec(dep.t);
      if (dt != null && Number.isFinite(v.t)) {
        const arr = dt + v.t; const days = Math.floor(arr / 86400); const tm = D.secToTime(arr); const [hh, mm] = tm.split(':').map(Number);
        items.push({ k: `Leaving at ${dep.t}, you arrive`, v: new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: settings.hour12 }), sub: days ? (days === 1 ? 'next day' : `${days} days later`) : 'same day' });
      }
      items.push({ k: 'With a 15 min break every 2 h', v: D.hmText(v.t + Math.floor(v.t / 7200) * 900) });
      return items;
    },
  });
  const depIn = timeField(dep.t, x => { dep.t = x; s.st.dep = x; s.update(null); }, { now: true, aria: 'Departure time' });
  root.insertBefore(h('div', { class: 'card form' }, row('Departure', depIn, { hint: 'optional: get the arrival time' })), root.lastElementChild);
}
const RACES = [[5000, '5K'], [10000, '10K'], [21097.5, 'Half'], [42195, 'Marathon']];
function mountPace(root, ctx) {
  mountSolver(root, ctx, {
    vars: [
      { id: 'd', label: 'Distance', units: len(['km', 'mi', 'm']), unit: metric() ? 'km' : 'mi', presets: RACES.map(([m, l]) => [m, l, metric() ? 'km' : 'mi']) },
      { id: 't', label: 'Time', units: [HMS] },
      { id: 'v', label: 'Pace', units: spd(['minkm', 'minmi', 'kmh', 'mph']), unit: metric() ? 'minkm' : 'minmi' },
    ],
    defaults: { known: ['d', 't'], vals: { d: 10000, t: 3000 } },
    solve(k) {
      if ('d' in k && 't' in k) return { v: k.d / k.t };
      if ('d' in k && 'v' in k) return { t: k.d / k.v };
      return { d: k.v * k.t };
    },
    extra(v) {
      const perKm = 1000 / v.v, perMi = 1609.344 / v.v;
      const ms = s => { s = Math.round(s); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
      const splitLen = metric() ? 1000 : 1609.344, unit = metric() ? 'km' : 'mi';
      const n = Math.min(60, Math.ceil(v.d / splitLen - 1e-9));
      const splits = [];
      for (let i = 1; i <= n; i++) { const dd = Math.min(v.d, i * splitLen); splits.push([`${fmt(dd / splitLen, { maxDec: 2 })} ${unit}`, D.hhmmss(dd / v.v)]); }
      return [
        { k: 'Pace', v: `${ms(perKm)} /km`, big: true, sub: `${ms(perMi)} /mi · ${fmt(v.v * 3.6, { maxDec: 2 })} km/h · ${fmt(v.v / 0.44704, { maxDec: 2 })} mph` },
        { k: 'Finish time', v: D.hhmmss(v.d / v.v) },
        { head: 'Predicted race times (Riegel)' },
        ...RACES.map(([m, l]) => ({ k: l, v: D.hhmmss((v.d / v.v) * Math.pow(m / v.d, 1.06)) })),
        { head: `Splits per ${unit}` },
        { table: { cols: ['Distance', 'Time'], rows: splits } },
      ];
    },
  });
}

/* ---------- Unix time ---------- */
function mountUnix(root, ctx) {
  const st = Object.assign({ ts: String(Math.floor(Date.now() / 1000)), d: D.todayISO(), t: '12:00', z: 'local' }, ctx.state || {});
  const save = () => ctx.save(st);
  const nowS = h('div', { class: 'd-big mono-big' }), nowSub = h('div', { class: 'd-sub' });
  const copyNow = h('div', { class: 'row-btns', style: { justifyContent: 'center' } },
    h('button', { class: 'btn', type: 'button', onclick: () => copyText(String(Math.floor(Date.now() / 1000)), 'seconds') }, 'Copy seconds'),
    h('button', { class: 'btn', type: 'button', onclick: () => copyText(String(Date.now()), 'milliseconds') }, 'Copy ms'));
  const r1 = results(), r2 = results();
  const tsIn = numField({ value: st.ts, aria: 'Timestamp', onInput: (n, raw) => { st.ts = raw; upd1(); } });
  const dIn = dateField(st.d, v => { st.d = v; upd2(); });
  const tIn = timeField(st.t, v => { st.t = v; upd2(); }, { now: true });
  const zSeg = seg([['local', 'Local time'], ['utc', 'UTC']], st.z, v => { st.z = v; upd2(); });
  root.append(h('div', { class: 'card display' }, h('div', { class: 'page-cat' }, 'Now'), nowS, nowSub, copyNow),
    h('h3', { class: 'sec-title' }, 'Timestamp → date'), h('div', { class: 'card form' }, row('Timestamp', tsIn, { hint: 'seconds or milliseconds' })), r1,
    h('h3', { class: 'sec-title' }, 'Date → timestamp'), h('div', { class: 'card form' }, row('Date', dIn), row('Time', tIn), h('div', { class: 'frow seg-row' }, zSeg)), r2);
  const tick = () => { const n = Date.now(); nowS.textContent = String(Math.floor(n / 1000)); nowSub.textContent = new Date(n).toISOString().replace('.000', ''); };
  tick();
  const timer = setInterval(tick, 1000);
  ctx.onCleanup(() => clearInterval(timer));
  function upd1() {
    save();
    const raw = String(st.ts).replace(/[^\d-]/g, '');
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) return r1.render([{ note: 'Enter a Unix timestamp, e.g. 1700000000.' }]);
    const digits = raw.replace('-', '').length;
    const unit = digits >= 16 ? 'µs' : digits >= 12 ? 'ms' : 's';
    const ms = unit === 'µs' ? n / 1000 : unit === 'ms' ? n : n * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return r1.render([{ note: 'Out of range.' }]);
    const rel = Math.round((ms - Date.now()) / 1000);
    const relTxt = Math.abs(rel) < 60 ? 'now' : (rel > 0 ? 'in ' : '') + D.hmText(Math.abs(rel), { days: true }) + (rel < 0 ? ' ago' : '');
    r1.render([
      { k: `Your time (read as ${unit === 's' ? 'seconds' : unit === 'ms' ? 'milliseconds' : 'microseconds'})`, v: d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium', hour12: settings.hour12 }), big: true, sub: relTxt },
      { k: 'UTC', v: d.toUTCString().replace('GMT', 'UTC') },
      { k: 'ISO 8601', v: d.toISOString() },
      { k: 'Seconds', v: String(Math.floor(ms / 1000)) },
      { k: 'Milliseconds', v: String(Math.round(ms)) },
    ]);
  }
  function upd2() {
    save();
    if (!D.isValidISO(st.d) || !st.t) return r2.render([{ note: 'Pick a date and a time.' }]);
    const { y, m, d } = D.parts(st.d); const [hh, mm] = st.t.split(':').map(Number);
    const ms = st.z === 'utc' ? Date.UTC(y, m - 1, d, hh, mm) : new Date(y, m - 1, d, hh, mm).getTime();
    r2.render([{ k: 'Unix timestamp (seconds)', v: String(Math.floor(ms / 1000)), big: true }, { k: 'Milliseconds', v: String(ms) }, { k: 'ISO 8601', v: new Date(ms).toISOString() }]);
  }
  upd1(); upd2();
}

/* ---------- Date info ---------- */
const CALS = [['islamic-umalqura', 'Hijri (Umm al-Qura)'], ['islamic-civil', 'Hijri (civil)'], ['hebrew', 'Hebrew'], ['persian', 'Persian (Solar Hijri)'], ['chinese', 'Chinese'], ['dangi', 'Korean'], ['buddhist', 'Buddhist (Thai)'], ['japanese', 'Japanese era'], ['roc', 'Minguo (Taiwan)'], ['indian', 'Indian national'], ['ethiopic', 'Ethiopian'], ['coptic', 'Coptic']];
function calFmt(iso, cal, opts = { dateStyle: 'full' }) {
  try {
    const lang = (navigator.language || 'en').split('-')[0];
    return new Intl.DateTimeFormat(`${lang}-u-ca-${cal}`, { ...opts, timeZone: 'UTC' }).format(new Date(D.dayNum(iso) * D.DAY));
  } catch { return '—'; }
}
function mountDateInfo(root, ctx) {
  const yNow = new Date().getFullYear();
  const st = Object.assign({ d: D.todayISO(), wy: String(D.isoWeek(D.todayISO()).year), wn: String(D.isoWeek(D.todayISO()).week) }, ctx.state || {});
  const save = () => ctx.save(st);
  const r1 = results(), r2 = results();
  const dIn = dateField(st.d, v => { st.d = v; upd1(); });
  const wy = numField({ value: st.wy, aria: 'Year', onInput: (n, raw) => { st.wy = raw; upd2(); } });
  const wn = numField({ value: st.wn, aria: 'Week number', onInput: (n, raw) => { st.wn = raw; upd2(); } });
  root.append(h('div', { class: 'card form' }, row('Date', dIn)), r1,
    h('h3', { class: 'sec-title' }, 'Week number → dates'), h('div', { class: 'card form' }, row('Year', wy), row('Week', wn)), r2);
  function upd1() {
    save();
    if (!D.isValidISO(st.d)) return r1.render([]);
    const { y, m, d } = D.parts(st.d);
    const iw = D.isoWeek(st.d);
    const doy = D.dayOfYear(st.d), diy = D.isLeap(y) ? 366 : 365;
    const ms = Date.UTC(y, m - 1, d, 12);
    const moon = moonIllumination(ms); const [pn, pe] = phaseName(moon.phase);
    const firstWd = (D.weekday(`${y}-${pad(m)}-01`) - settings.weekStart + 7) % 7;
    r1.render([
      { k: 'Day', v: D.fmtDate(st.d, 'full'), big: true, sub: D.relDays(D.dayNum(st.d) - D.dayNum(D.todayISO())) },
      { k: 'ISO week', v: `W${iw.week}`, sub: iw.year !== y ? `of ${iw.year}` : `of ${D.weeksInYear(y)} in ${y}` },
      { k: 'Week of the month', v: String(Math.ceil((d + firstWd) / 7)) },
      { k: 'Day of the year', v: `${doy} / ${diy}`, sub: `${fmt(doy / diy * 100, { maxDec: 1 })} % of the year has passed` },
      { k: 'Days left this year', v: String(diy - doy) },
      { k: 'Quarter', v: `Q${Math.ceil(m / 3)}` },
      { k: 'Days in this month', v: String(D.daysInMonth(y, m)) },
      { k: 'Leap year', v: D.isLeap(y) ? 'Yes' : 'No', sub: D.isLeap(y) ? null : `Next: ${[1, 2, 3, 4, 5, 6, 7, 8].map(i => y + i).find(D.isLeap)}` },
      { k: 'Moon', v: `${pe} ${pn}`, sub: `${Math.round(moon.fraction * 100)} % lit` },
      { k: 'Hijri', v: calFmt(st.d, 'islamic-umalqura') },
      { k: 'Hebrew', v: calFmt(st.d, 'hebrew') },
      { k: 'Chinese', v: calFmt(st.d, 'chinese') },
      { k: 'Julian day number', v: String(D.julianDay(st.d)) },
    ]);
  }
  function upd2() {
    save();
    const y = Math.round(parseNum(st.wy)), w = Math.round(parseNum(st.wn));
    if (!(y > 0 && y < 10000)) return r2.render([{ note: 'Enter a year.' }]);
    const max = D.weeksInYear(y);
    if (!(w >= 1 && w <= max)) return r2.render([{ note: `${y} has weeks 1 to ${max}.` }]);
    const mon = D.isoWeekStart(y, w), sun = D.addDays(mon, 6);
    r2.render([{ k: `Week ${w} of ${y}`, v: `${D.fmtDate(mon, 'dm')} → ${D.fmtDate(sun, 'dm')}`, big: true, sub: `${D.fmtDate(mon, 'short')} to ${D.fmtDate(sun, 'short')} (Monday to Sunday)` }]);
  }
  upd1(); upd2();
  void yNow;
}

/* ---------- Calendars ---------- */
const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiʻ al-awwal', 'Rabiʻ al-thani', 'Jumada al-ula', 'Jumada al-akhirah', 'Rajab', 'Shaʻban', 'Ramadan', 'Shawwal', 'Dhu al-Qaʻdah', 'Dhu al-Hijjah'];
const PERSIAN_MONTHS = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];
function calParts(n, cal) {
  const p = {};
  for (const x of new Intl.DateTimeFormat(`en-u-ca-${cal}`, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(n * D.DAY))) if (/year|month|day|relatedYear/.test(x.type)) p[x.type] = x.value;
  return { y: parseInt(p.year ?? p.relatedYear, 10), m: parseInt(p.month, 10), d: parseInt(p.day, 10), mRaw: p.month };
}
/** Gregorian ISO for a date in an Islamic or Persian calendar, by searching around an estimate. */
function toGregorian(cal, y, m, d) {
  let est;
  if (cal.startsWith('islamic')) est = Math.round(1948439.5 - 2440588 + (y - 1) * 354.36667 + (m - 1) * 29.5306 + (d - 1));
  else est = Math.round(1948320.5 - 2440588 + (y - 1) * 365.2422 + (m <= 6 ? (m - 1) * 31 : 186 + (m - 7) * 30) + (d - 1));
  for (let k = 0; k <= 40; k++) for (const s of k ? [k, -k] : [0]) {
    const p = calParts(est + s, cal);
    if (p.y === y && p.m === m && p.d === d) return D.fromDayNum(est + s);
  }
  return null;
}
function nextHijri(m, d, fromISO) {
  const cur = calParts(D.dayNum(fromISO), 'islamic-umalqura');
  for (const y of [cur.y, cur.y + 1]) { const g = toGregorian('islamic-umalqura', y, m, d); if (g && D.dayNum(g) >= D.dayNum(fromISO)) return { g, y }; }
  return null;
}
const CNY = { 2024: '02-10', 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08', 2036: '01-28', 2037: '02-15', 2038: '02-04', 2039: '01-24', 2040: '02-12' };
function nextChineseNewYear(fromISO) {
  const y0 = +fromISO.slice(0, 4);
  for (const y of [y0, y0 + 1]) if (CNY[y] && D.dayNum(`${y}-${CNY[y]}`) >= D.dayNum(fromISO)) return `${y}-${CNY[y]}`;
  for (let y = +fromISO.slice(0, 4); y <= +fromISO.slice(0, 4) + 1; y++) {
    for (let n = D.dayNum(`${y}-01-19`); n <= D.dayNum(`${y}-02-21`); n++) { const p = calParts(n, 'chinese'); if (p.mRaw === '1' && p.d === 1 && n >= D.dayNum(fromISO)) return D.fromDayNum(n); }
  }
  return null;
}
function nextRoshHashanah(fromISO) {
  const fmt2 = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  for (let y = +fromISO.slice(0, 4); y <= +fromISO.slice(0, 4) + 1; y++) {
    for (let n = D.dayNum(`${y}-09-01`); n <= D.dayNum(`${y}-10-10`); n++) {
      const p = Object.fromEntries(fmt2.formatToParts(new Date(n * D.DAY)).map(x => [x.type, x.value]));
      if (/^Tishri/.test(p.month) && p.day === '1' && n >= D.dayNum(fromISO)) return D.fromDayNum(n);
    }
  }
  return null;
}
function mountCalendars(root, ctx) {
  const today = D.todayISO();
  const cur = calParts(D.dayNum(today), 'islamic-umalqura');
  const st = Object.assign({ d: today, cal: 'islamic-umalqura', y: String(cur.y), m: String(cur.m), dd: String(cur.d) }, ctx.state || {});
  const save = () => ctx.save(st);
  const r1 = results(), r2 = results(), r3 = results();
  const dIn = dateField(st.d, v => { st.d = v; upd1(); });
  root.append(h('div', { class: 'card form' }, row('Gregorian date', dIn)), r1);
  const calSeg = seg([['islamic-umalqura', 'Hijri'], ['islamic-civil', 'Hijri (civil)'], ['persian', 'Persian']], st.cal, v => { st.cal = v; drawMonth(); upd2(); });
  const yIn = numField({ value: st.y, aria: 'Year', onInput: (n, raw) => { st.y = raw; upd2(); } });
  const mWrap = h('div');
  const dayIn = numField({ value: st.dd, aria: 'Day', onInput: (n, raw) => { st.dd = raw; upd2(); } });
  root.append(h('h3', { class: 'sec-title' }, 'Convert to Gregorian'), h('div', { class: 'card form' }, h('div', { class: 'frow seg-row' }, calSeg), row('Year', yIn), row('Month', mWrap), row('Day', dayIn)), r2,
    h('h3', { class: 'sec-title' }, 'Coming up'), r3,
    h('p', { class: 'note' }, 'Islamic dates use the Umm al-Qura calculation; in many countries (e.g. Morocco) the month starts with the local moon sighting and can differ by a day.'));
  function drawMonth() {
    const names = st.cal === 'persian' ? PERSIAN_MONTHS : HIJRI_MONTHS;
    mWrap.replaceChildren(selectEl(names.map((n, i) => [String(i + 1), `${i + 1} · ${n}`]), st.m, v => { st.m = v; upd2(); }, { aria: 'Month' }));
  }
  function upd1() {
    save();
    if (!D.isValidISO(st.d)) return r1.render([]);
    r1.render([{ k: 'Gregorian', v: D.fmtDate(st.d, 'full'), big: true }, ...CALS.map(([c, n]) => ({ k: n, v: calFmt(st.d, c) }))]);
  }
  function upd2() {
    save();
    const y = Math.round(parseNum(st.y)), m = Math.round(parseNum(st.m)), d = Math.round(parseNum(st.dd));
    if (!(y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return r2.render([{ note: 'Enter a year, month and day.' }]);
    const g = toGregorian(st.cal, y, m, d);
    r2.render(g ? [{ k: `${d} ${(st.cal === 'persian' ? PERSIAN_MONTHS : HIJRI_MONTHS)[m - 1]} ${y}`, v: D.fmtDate(g, 'full'), big: true, sub: D.relDays(D.dayNum(g) - D.dayNum(today)) }] : [{ note: 'That day doesn’t exist in this month.' }]);
  }
  function upd3() {
    const items = [];
    const add = (label, iso, sub) => { if (iso) items.push({ k: label, v: D.fmtDate(iso, 'med'), sub: [D.relDays(D.dayNum(iso) - D.dayNum(today)), sub].filter(Boolean).join(' · ') }); };
    const ram = nextHijri(9, 1, today); add('Ramadan begins', ram?.g, ram && `${ram.y} AH`);
    const fitr = nextHijri(10, 1, today); add('Eid al-Fitr', fitr?.g);
    const adha = nextHijri(12, 10, today); add('Eid al-Adha', adha?.g);
    const ny = nextHijri(1, 1, today); add('Islamic New Year', ny?.g, ny && `${ny.y} AH`);
    const mawlid = nextHijri(3, 12, today); add('Mawlid', mawlid?.g);
    const cny = nextChineseNewYear(today); add('Chinese New Year', cny, cny && `Year of the ${D.chineseZodiac(+cny.slice(0, 4))}`);
    const rh = nextRoshHashanah(today); add('Rosh Hashanah', rh);
    const y = +today.slice(0, 4);
    const e1 = D.dayNum(D.easter(y)) >= D.dayNum(today) ? D.easter(y) : D.easter(y + 1); add('Easter', e1);
    const e2 = D.dayNum(D.orthodoxEaster(y)) >= D.dayNum(today) ? D.orthodoxEaster(y) : D.orthodoxEaster(y + 1); add('Orthodox Easter', e2);
    items.sort((a, b) => 0);
    r3.render(items);
  }
  drawMonth(); upd1(); upd2(); upd3();
}

/* ---------- Sun & moon ---------- */
function mountSun(root, ctx) {
  const home = CITIES.find(c => c.tz === LOCAL_TZ) || CITIES.find(c => c.name === 'Paris');
  const st = Object.assign({ loc: { name: home.name, lat: home.lat, lon: home.lon, tz: home.tz }, d: D.todayISO() }, ctx.state || {});
  const save = () => ctx.save(st);
  const locB = h('button', { class: 'cur-btn', type: 'button', onclick: () => pickCity() });
  const geoB = h('button', { class: 'btn', type: 'button', onclick: () => geo() }, icon('location'), 'Use my location');
  const dIn = dateField(st.d, v => { st.d = v; upd(); });
  const out = results();
  root.append(h('div', { class: 'pair one' }, locB), h('div', { class: 'row-btns', style: { justifyContent: 'flex-start', marginBottom: '14px' } }, geoB), h('div', { class: 'card form' }, row('Date', dIn)), out,
    h('p', { class: 'note' }, 'Times for the chosen place, in its local time. Accuracy ≈ 1–2 minutes; hills and buildings change what you actually see.'));
  const drawLoc = () => locB.replaceChildren(icon('location'), h('span', null, h('b', null, st.loc.name), h('small', null, `${fmt(st.loc.lat, { maxDec: 2 })}°, ${fmt(st.loc.lon, { maxDec: 2 })}° · ${st.loc.tz.replace(/_/g, ' ')}`)), icon('down'));
  function pickCity() {
    const input = h('input', { class: 'search-in', type: 'search', placeholder: 'Search a city', autocomplete: 'off', 'aria-label': 'Search a city' });
    const list = h('div');
    const draw = () => {
      const q = norm(input.value);
      const hits = CITIES.filter(c => !q || norm(c.name).includes(q) || norm(countryName(c.cc)).includes(q) || c.al.some(a => norm(a).includes(q))).slice(0, 80);
      list.replaceChildren(h('div', { class: 'pick-list' }, hits.map(c => h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); st.loc = { name: c.name, lat: c.lat, lon: c.lon, tz: c.tz }; drawLoc(); upd(); } },
        h('span', { class: 'flag' }, flag(c.cc)), h('span', { class: 'p-main' }, h('b', null, c.name), h('small', null, countryName(c.cc)))))));
    };
    input.addEventListener('input', draw); draw();
    const s = openSheet({ title: 'Choose a place', body: h('div', null, h('div', { class: 'search-box' }, icon('search'), input), list) });
  }
  function geo() {
    if (!navigator.geolocation) return toast('Location not available');
    geoB.classList.add('spin');
    navigator.geolocation.getCurrentPosition(p => {
      geoB.classList.remove('spin');
      st.loc = { name: 'My location', lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), tz: LOCAL_TZ };
      drawLoc(); upd();
    }, () => { geoB.classList.remove('spin'); toast('Location permission denied'); }, { timeout: 10000, maximumAge: 6e5 });
  }
  function upd() {
    save();
    if (!D.isValidISO(st.d)) return;
    const { lat, lon, tz } = st.loc;
    const { y, m, d } = D.parts(st.d);
    const noon = instantOf(tz, y, m, d, 12, 0);
    const midnight = instantOf(tz, y, m, d, 0, 0);
    const s = sunTimes(noon, lat, lon);
    const sPrev = sunTimes(noon - 864e5, lat, lon);
    const tm = ms => (Number.isFinite(ms) ? fmtTime(ms, tz, settings.hour12) : '—');
    const dayLen = s.sunset - s.sunrise, prevLen = sPrev.sunset - sPrev.sunrise;
    const items = [];
    if (!Number.isFinite(s.sunrise)) {
      items.push({ k: 'Today', v: s.noonAltitude > 0 ? 'Sun up all day' : 'Polar night', big: true, sub: s.noonAltitude > 0 ? 'Midnight sun: the sun doesn’t set' : 'The sun doesn’t rise' });
    } else {
      const ch = Math.round((dayLen - prevLen) / 60000 * 10) / 10;
      items.push(
        { k: 'Sunrise → sunset', v: `${tm(s.sunrise)} → ${tm(s.sunset)}`, big: true, sub: `Daylight ${D.hmText(dayLen / 1000)} · ${ch >= 0 ? '+' : '−'}${fmt(Math.abs(ch), { maxDec: 1 })} min vs the day before` },
        { k: 'Sunrise', v: tm(s.sunrise) }, { k: 'Sunset', v: tm(s.sunset) },
        { k: 'Solar noon', v: tm(s.solarNoon), sub: `Sun at ${fmt(s.noonAltitude, { maxDec: 1 })}° above the horizon` },
        { k: 'Golden hour (evening)', v: `${tm(s.goldenHour)} → ${tm(s.sunset)}` },
        { k: 'Golden hour (morning)', v: `${tm(s.sunrise)} → ${tm(s.goldenHourEnd)}` },
        { k: 'Blue hour (evening)', v: `${tm(s.blueHour)} → ${tm(s.dusk)}` },
        { k: 'Civil twilight', v: `${tm(s.dawn)} · ${tm(s.dusk)}`, sub: 'Bright enough to be outside without lights' },
        { k: 'Nautical twilight', v: `${tm(s.nauticalDawn)} · ${tm(s.nauticalDusk)}` },
        { k: 'Astronomical twilight', v: `${tm(s.nightEnd)} · ${tm(s.night)}`, sub: 'Fully dark sky outside these times' },
      );
    }
    const ill = moonIllumination(noon); const [pn, pe] = phaseName(ill.phase);
    const mt = moonTimes(midnight, lat, lon);
    const full = nextPhase(midnight, 0.5), nw = nextPhase(midnight, 0);
    const dayTxt = ms => new Date(ms).toLocaleDateString(undefined, { timeZone: safeZone(tz), weekday: 'short', day: 'numeric', month: 'short' });
    items.push({ head: 'Moon' },
      { k: `${pe} ${pn}`, v: `${Math.round(ill.fraction * 100)} % lit` },
      { k: 'Moonrise', v: mt.rise ? tm(mt.rise) : mt.alwaysUp ? 'up all day' : '—' },
      { k: 'Moonset', v: mt.set ? tm(mt.set) : mt.alwaysDown ? 'down all day' : '—' },
      { k: 'Next full moon', v: dayTxt(full), sub: tm(full) },
      { k: 'Next new moon', v: dayTxt(nw), sub: tm(nw) });
    out.render(items);
  }
  drawLoc(); upd();
}

export const tools = {
  datediff: { mount: mountDateDiff },
  dateadd: { mount: mountDateAdd },
  age,
  countdown: { mount: mountCountdown },
  timezones: { mount: mountZones },
  timecalc: { mount: mountTimeCalc },
  timesheet: { mount: mountTimesheet },
  travel: { mount: mountTravel },
  pace: { mount: mountPace },
  unix: { mount: mountUnix },
  dateinfo: { mount: mountDateInfo },
  calendars: { mount: mountCalendars },
  sun: { mount: mountSun },
};
void CATEGORIES; void card; void btn; void okPos;
