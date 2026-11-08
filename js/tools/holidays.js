// Public holidays (any country, Nager.Date) with long weekends and bridge days, plus French school holidays.
import { h, toast } from '../core/dom.js';
import { seg, selectEl, results, row } from '../core/ui.js';
import { settings } from '../core/store.js';
import * as D from '../lib/dates.js';
import { holidays as fetchHolidays } from '../lib/holidays.js';
import { COUNTRY_CURRENCY, countryName, flag } from '../data/geo.js';
import { SCHOOL_FR, SCHOOL_FR_UNTIL } from '../data/schoolfr.js';
import { LANG } from '../core/store.js';

const ZONES = { A: 'Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers', B: 'Aix-Marseille, Amiens, Lille, Nancy-Metz, Nantes, Nice, Normandie, Orléans-Tours, Reims, Rennes, Strasbourg', C: 'Créteil, Montpellier, Paris, Toulouse, Versailles' };
const n0 = x => Math.round(x).toLocaleString();

/** Bridge-day advice for a holiday on a weekday (weekend = Sat+Sun by default). */
export function bridgeInfo(iso, weekend = [6, 0]) {
  const wd = D.weekday(iso);
  const wk = new Set(weekend);
  if (wk.has(wd)) return { kind: 'weekend', text: 'Falls on a weekend' };
  const before = D.addDays(iso, -1), after = D.addDays(iso, 1);
  if (wk.has(D.weekday(before)) || wk.has(D.weekday(after))) return { kind: 'long', text: 'Long weekend: 3 days off' };
  // Tuesday → take Monday; Thursday → take Friday
  if (wk.has(D.weekday(D.addDays(iso, -2)))) return { kind: 'bridge', day: before, text: `Bridge: take ${D.fmtDate(before, 'dm')} off for 4 days` };
  if (wk.has(D.weekday(D.addDays(iso, 2)))) return { kind: 'bridge', day: after, text: `Bridge: take ${D.fmtDate(after, 'dm')} off for 4 days` };
  return { kind: 'mid', text: 'Mid-week' };
}

/** School holiday periods for a zone with back-to-school dates. */
export function schoolPeriods(zone) {
  return (SCHOOL_FR[zone] || []).map(([name, a, b]) => ({ name, first: a, last: b, back: name.includes('été') ? null : D.addDays(b, 1) }));
}

async function mount(root, ctx) {
  const y0 = new Date().getFullYear();
  const st = Object.assign({ cc: settings.country, y: y0, zone: 'C' }, ctx.state || {});
  if (![y0 - 1, y0, y0 + 1, y0 + 2].includes(+st.y)) st.y = y0;
  const save = () => ctx.save(st);
  const countries = Object.keys(COUNTRY_CURRENCY).map(cc => [cc, `${flag(cc)} ${countryName(cc, LANG)}`]).sort((a, b) => a[1].localeCompare(b[1]));
  const today = D.todayISO();
  const nowBox = results();
  const pubTitle = h('h3', { class: 'sec-title' });
  const pubBox = results();
  const schoolWrap = h('div');
  root.append(
    h('div', { class: 'card form' },
      row('Country', selectEl(countries, st.cc, v => { st.cc = v; save(); drawPublic(); drawSchool(); }, { aria: 'Country' })),
      h('div', { class: 'frow seg-row' }, seg([y0 - 1, y0, y0 + 1, y0 + 2].map(y => [y, String(y)]), +st.y, v => { st.y = v; save(); drawPublic(); }, { aria: 'Year' }))),
    nowBox, pubTitle, pubBox, schoolWrap);

  let seq = 0;
  async function drawPublic() {
    const my = ++seq;
    pubTitle.textContent = `Public holidays ${st.y}`;
    pubBox.render([{ note: 'Loading…' }]);
    let list;
    try { list = await fetchHolidays(st.cc, st.y); }
    catch { if (my === seq) pubBox.render([{ note: navigator.onLine ? 'Couldn’t load holidays for this country.' : 'You’re offline: holidays load once with a connection, then stay saved.' }]); return; }
    if (my !== seq) return;
    if (!list.length) { pubBox.render([{ note: 'No public holiday data for this country.' }]); return; }
    const weekend = settings.weekend || [6, 0];
    let onWeekdays = 0, bridges = 0;
    const items = list.map(x => {
      const b = bridgeInfo(x.date, weekend);
      if (b.kind !== 'weekend') onWeekdays++;
      if (b.kind === 'bridge') bridges++;
      const past = D.dayNum(x.date) < D.dayNum(today);
      const name = x.localName && x.localName !== x.name ? `${x.localName} · ${x.name}` : x.name;
      return { k: name, v: D.fmtDate(x.date, 'dm'), sub: b.text + (past ? '' : ` · ${D.relDays(D.dayNum(x.date) - D.dayNum(today))}`), tone: b.kind === 'bridge' ? 'accent' : b.kind === 'long' ? 'good' : null, nocopy: true, dim: past };
    });
    pubBox.render([{ note: `${list.length} public holidays · ${onWeekdays} on weekdays · ${bridges} bridge ${bridges === 1 ? 'opportunity' : 'opportunities'}` }, ...items]);
    pubBox.querySelectorAll('.res-row').forEach((el, i) => el.classList.toggle('dim', !!items[i].dim));
    drawNow(list);
  }

  async function drawNow(list) {
    // next public holiday (this year or next) + today's school status
    const items = [];
    let next = (list || []).find(x => D.dayNum(x.date) >= D.dayNum(today));
    if (!next && +st.y === y0) { try { next = (await fetchHolidays(st.cc, y0 + 1))[0]; } catch { } }
    if (next && +st.y === y0) items.push({ k: 'Next public holiday', v: next.localName || next.name, big: true, sub: `${D.fmtDate(next.date, 'full')} · ${D.relDays(D.dayNum(next.date) - D.dayNum(today))}`, nocopy: true });
    if (st.cc === 'FR') {
      const ps = schoolPeriods(st.zone);
      const cur = ps.find(p => D.dayNum(p.first) <= D.dayNum(today) && D.dayNum(today) <= D.dayNum(p.last));
      const nxt = ps.find(p => D.dayNum(p.first) > D.dayNum(today));
      if (cur) items.push({ k: `School holidays now · zone ${st.zone}`, v: cur.name, sub: cur.back ? `Back to school ${D.fmtDate(cur.back, 'full')}` : 'Summer holidays', tone: 'good', nocopy: true });
      else if (nxt) items.push({ k: `Next school holidays · zone ${st.zone}`, v: nxt.name, sub: `${D.fmtDate(nxt.first, 'dm')} → ${D.fmtDate(nxt.last, 'dm')} · ${D.relDays(D.dayNum(nxt.first) - D.dayNum(today))}`, nocopy: true });
    }
    nowBox.render(items);
  }

  function drawSchool() {
    if (st.cc !== 'FR') { schoolWrap.replaceChildren(); return; }
    const out = results();
    const zoneSeg = seg([['A', 'Zone A'], ['B', 'Zone B'], ['C', 'Zone C']], st.zone, v => { st.zone = v; save(); fill(); drawPublic(); });
    const zoneHint = h('p', { class: 'fact' });
    schoolWrap.replaceChildren(h('h3', { class: 'sec-title' }, 'School holidays'), h('div', { class: 'card form' }, h('div', { class: 'frow seg-row' }, zoneSeg)), zoneHint, out,
      h('p', { class: 'note' }, `Official calendar (Ministère de l’Éducation nationale) up to ${D.fmtDate(SCHOOL_FR_UNTIL, 'short')}. Corsica and overseas regions have their own dates.`));
    function fill() {
      zoneHint.textContent = `Académies: ${ZONES[st.zone]}`;
      const ps = schoolPeriods(st.zone).filter(p => D.dayNum(p.last) >= D.dayNum(today) - 200);
      out.render(ps.map(p => {
        const past = D.dayNum(p.last) < D.dayNum(today);
        const now = !past && D.dayNum(p.first) <= D.dayNum(today);
        const days = D.dayNum(p.last) - D.dayNum(p.first) + 1;
        return {
          k: `${p.name} ${p.first.slice(0, 4)}`, v: `${D.fmtDate(p.first, 'dm')} → ${D.fmtDate(p.last, 'dm')}`,
          sub: [now ? 'Now' : past ? 'Past' : D.relDays(D.dayNum(p.first) - D.dayNum(today)), `${days} days`, p.back ? `back ${D.fmtDate(p.back, 'dm')}` : null].filter(Boolean).join(' · '),
          tone: now ? 'good' : null, nocopy: true, dim: past,
        };
      }));
      out.querySelectorAll('.res-row').forEach((el, i) => el.classList.toggle('dim', /^Past/.test(el.textContent.split('\n').pop() || '') || el.querySelector('.res-sub')?.textContent.startsWith('Past')));
    }
    fill();
  }

  drawSchool();
  drawPublic();
  void toast;
}

export const tools = { holidays: { mount } };
