// Home: heater / air-conditioner sizing and the cost of heat per kWh by energy.
import { h, icon } from '../core/dom.js';
import { parseNum, fmt, fmtMoney, currencySymbol } from '../core/num.js';
import { numField, results, row } from '../core/ui.js';
import { ok, okPos } from '../core/form.js';
import { settings } from '../core/store.js';
import { unitsOf } from '../data/units.js';

const metric = () => settings.system === 'metric';
const pick = (cat, ids) => unitsOf(cat).filter(u => ids.includes(u.id));
const W_TO_BTU = 3.412142;

/* ---------- Heating & cooling ---------- */
const HEAT_SIZES = [500, 750, 1000, 1250, 1500, 1750, 2000, 2500, 3000];
const AC_SIZES = [5000, 7000, 9000, 12000, 18000, 24000, 30000, 36000];
/** Heat loss (W) ≈ volume (m³) × G (W/m³·K) × (inside − outside) (K). */
export function heatNeed({ area, height, g, tin, tout }) { return area * height * g * Math.max(0, tin - tout); }
/** Cooling (BTU/h): 20 BTU per ft² for a 8 ft ceiling, then sun, people and kitchen adjustments (ENERGY STAR guide). */
export function coolNeed({ area, height, sun, people, kitchen }) {
  let btu = area / 0.09290304 * 20 * Math.max(1, height / 2.44);
  btu *= sun === 'shade' ? 0.9 : sun === 'sunny' ? 1.1 : 1;
  btu += Math.max(0, people - 2) * 600;
  if (kitchen) btu += 4000;
  return btu;
}
export const heating = {
  fields: [
    { id: 'mode', type: 'seg', options: [['heat', 'Heating'], ['cool', 'Air-con']], default: 'heat' },
    { id: 'area', type: 'unit', label: 'Room area', units: () => pick('area', ['m2', 'ft2']), unit: () => (metric() ? 'm2' : 'ft2'), default: () => ({ b: 20, u: metric() ? 'm2' : 'ft2' }) },
    { id: 'height', type: 'unit', label: 'Ceiling height', units: () => pick('length', ['m', 'ft']), unit: () => (metric() ? 'm' : 'ft'), default: () => ({ b: 2.5, u: metric() ? 'm' : 'ft' }) },
    { id: 'g', type: 'select', label: 'Insulation', when: v => v.mode === 'heat', default: '1.1', options: [['0.6', 'Very good (new build)'], ['0.8', 'Good (renovated, after 2000)'], ['1.1', 'Average (1980s–90s)'], ['1.5', 'Poor (before 1975)'], ['2', 'None (old, single glazing)']] },
    { id: 'tin', type: 'unit', label: 'Wanted temperature', when: v => v.mode === 'heat', units: () => pick('temperature', ['C', 'F']), unit: () => (settings.system === 'us' ? 'F' : 'C'), default: () => ({ b: 293.15, u: settings.system === 'us' ? 'F' : 'C' }) },
    { id: 'tout', type: 'unit', label: 'Coldest outdoor temperature', hint: 'Paris −7 °C, coast −2, mountains −15', negative: true, when: v => v.mode === 'heat', units: () => pick('temperature', ['C', 'F']), unit: () => (settings.system === 'us' ? 'F' : 'C'), default: () => ({ b: 266.15, u: settings.system === 'us' ? 'F' : 'C' }) },
    { id: 'sun', type: 'seg', label: 'Sun', when: v => v.mode === 'cool', options: [['shade', 'Shaded'], ['normal', 'Normal'], ['sunny', 'Very sunny']], default: 'normal' },
    { id: 'people', type: 'stepper', label: 'People usually in the room', when: v => v.mode === 'cool', default: 2, min: 1, max: 20 },
    { id: 'kitchen', type: 'toggle', label: 'It’s a kitchen', when: v => v.mode === 'cool' },
  ],
  compute(v) {
    if (!okPos(v.area) || !okPos(v.height)) return [{ note: 'Enter the room size.' }];
    if (v.mode === 'heat') {
      if (!ok(v.tin) || !ok(v.tout)) return [{ note: 'Enter both temperatures.' }];
      const w = heatNeed({ area: v.area, height: v.height, g: +v.g, tin: v.tin, tout: v.tout });
      const size = HEAT_SIZES.find(s => s >= w);
      const n = size ? 1 : Math.ceil(w / 2000);
      return [
        { k: 'Heating power needed', v: w >= 1000 ? `${fmt(w / 1000, { maxDec: 1 })} kW` : `${fmt(w, { dec: 0 })} W`, big: true, sub: `${fmt(w * W_TO_BTU, { dec: 0 })} BTU/h · ${fmt(w / v.area, { dec: 0 })} W per m²` },
        { k: 'Suggested heater', v: size ? `${fmt(size, { dec: 0 })} W` : `${n} × 2,000 W`, sub: 'Rounded up to a standard size' },
        { k: 'Room volume', v: `${fmt(v.area * v.height, { maxDec: 1 })} m³` },
        { k: 'Temperature difference', v: `${fmt(v.tin - v.tout, { maxDec: 0 })} °C` },
        { note: 'Rule of thumb (volume × insulation × temperature gap). Big windows, a top floor or an outside wall on several sides need more; a heat-loss survey gives the exact figure.' },
      ];
    }
    const btu = coolNeed({ area: v.area, height: v.height, sun: v.sun, people: v.people || 2, kitchen: v.raw.kitchen });
    const size = AC_SIZES.find(s => s >= btu) || Math.ceil(btu / 1000) * 1000;
    return [
      { k: 'Cooling power needed', v: `${fmt(btu / W_TO_BTU / 1000, { maxDec: 1 })} kW`, big: true, sub: `${fmt(Math.round(btu / 100) * 100, { dec: 0 })} BTU/h` },
      { k: 'Suggested air-conditioner', v: `${fmt(size, { dec: 0 })} BTU`, sub: `≈ ${fmt(size / W_TO_BTU / 1000, { maxDec: 1 })} kW cooling` },
      { note: 'Based on the ENERGY STAR sizing guide (20 BTU per ft², adjusted for sun, people and kitchens). An oversized unit cools in short bursts and dehumidifies badly.' },
    ];
  },
};

/* ---------- Energy prices: cost of 1 kWh of useful heat ---------- */
// [id, name, unit label, kWh per unit, default price (EUR, France 2026), default efficiency %]
const ENERGIES = [
  ['elec', 'Electric radiators', 'kWh', 1, 0.20, 100],
  ['hp', 'Heat pump (air-water)', 'kWh', 1, null, 300],
  ['gas', 'Natural gas (condensing boiler)', 'kWh', 1, 0.12, 95],
  ['propane', 'Propane', 'kg', 12.8, 2.1, 92],
  ['oil', 'Heating oil (fioul)', 'L', 10, 1.15, 85],
  ['pellets', 'Wood pellets', 'kg', 4.8, 0.38, 88],
  ['logs', 'Firewood (hardwood)', 'stère', 1800, 90, 70],
];
export function costPerUsefulKWh(price, kwhPerUnit, eff) { return price / kwhPerUnit / (eff / 100); }
function mountEnergyPrices(root, ctx) {
  const eur = settings.currency === 'EUR';
  const st = Object.assign({ prices: {}, eff: {}, need: '12000' }, ctx.state || {});
  for (const [id, , , , p, e] of ENERGIES) { if (st.prices[id] == null && id !== 'hp') st.prices[id] = eur && p != null ? String(p) : ''; if (st.eff[id] == null) st.eff[id] = String(e); }
  const save = () => ctx.save(st);
  const sym = currencySymbol(settings.currency);
  const out = results();
  const priceCard = h('div', { class: 'card form' });
  for (const [id, name, unit] of ENERGIES) {
    if (id === 'hp') continue;
    priceCard.append(row(name, numField({ value: st.prices[id], prefix: sym, suffix: `/ ${unit}`, aria: `${name} price`, placeholder: 'price', onInput: (n, raw) => { st.prices[id] = raw; upd(); } })));
  }
  const effCard = h('details', { class: 'card pad eff' }, h('summary', null, 'Efficiency of each system'),
    ...ENERGIES.map(([id, name]) => row(id === 'hp' ? 'Heat pump (COP × 100)' : name, numField({ value: st.eff[id], suffix: '%', aria: `${name} efficiency`, onInput: (n, raw) => { st.eff[id] = raw; upd(); } }))));
  const needIn = numField({ value: st.need, suffix: 'kWh / year', aria: 'Yearly heat need', onInput: (n, raw) => { st.need = raw; upd(); } });
  root.append(h('h3', { class: 'sec-title' }, 'Your prices'), priceCard, effCard,
    h('div', { class: 'card form' }, row('Heat needed per year', needIn, { hint: 'optional · a French house uses ~12,000–15,000 kWh' })),
    out, h('p', { class: 'note' }, eur ? 'Default prices are rough French averages for late 2026: replace them with the figures on your bills. Efficiency is what reaches the room (a heat pump gives about 3 kWh of heat per kWh of electricity).' : 'Enter your local prices. Efficiency is what reaches the room (a heat pump gives about 3 kWh of heat per kWh of electricity).'));
  function upd() {
    save();
    const need = parseNum(st.need);
    const rows = [];
    for (const [id, name, , kwh] of ENERGIES) {
      const price = parseNum(id === 'hp' ? st.prices.elec : st.prices[id]);
      const eff = parseNum(st.eff[id]);
      if (!(price > 0) || !(eff > 0)) continue;
      rows.push({ id, name, c: costPerUsefulKWh(price, kwh, eff) });
    }
    rows.sort((a, b) => a.c - b.c);
    if (!rows.length) return out.render([{ note: 'Enter at least one price.' }]);
    const best = rows[0].c;
    out.render([{ head: 'Cost of 1 kWh of heat' }, ...rows.map((r, i) => ({
      k: r.name, v: fmtMoney(r.c, settings.currency, { dec: 3 }), tone: i === 0 ? 'good' : null,
      sub: [i === 0 ? 'Cheapest' : `+${fmt((r.c / best - 1) * 100, { maxDec: 0 })} %`, okPos(need) ? `${fmtMoney(r.c * need, settings.currency, { dec: 0 })} per year` : null].filter(Boolean).join(' · '),
    }))]);
  }
  upd();
  void icon;
}

export const tools = { heating, energyprices: { mount: mountEnergyPrices } };
