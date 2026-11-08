// Logic tests (no browser): node tests/test-logic.mjs
import * as N from '../js/core/num.js';
import { CATEGORIES, convert, unit } from '../js/data/units.js';
import * as D from '../js/lib/dates.js';
import { offsetMin, instantOf } from '../js/lib/tz.js';
import { sunTimes, nextPhase } from '../js/lib/sun.js';
import { toWordsEN, toWordsFR, toRoman, fromRoman, parseList } from '../js/tools/math.js';
import { scaleLine } from '../js/tools/kitchen.js';
import { answer, parseDate } from '../js/lib/quick.js';

let pass = 0, fail = 0;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function eq(name, got, want, tol) {
  const ok = typeof want === 'number' ? near(got, want, tol ?? 1e-9) : JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); }
}

// --- number parsing (en) ---
N.setNumberLocale('en-US');
for (const [s, v] of [['1,5', 1.5], ['1.5', 1.5], ['1,234', 1234], ['1,234.5', 1234.5], ['1.234,5', 1234.5], ['1 234,5', 1234.5], ['12*3+4', 40], ['200+10%', 220], ['50%', 0.5], ['1/4', 0.25], ['1 3/8', 1.375], ['2½', 2.5], ['√16', 4], ['10^3', 1000], ['1e3', 1000], ['-1,5', -1.5], ['3×4', 12], ['8÷2', 4]]) eq(`parse ${s}`, N.parseNum(s), v);
eq('parse empty', N.parseNum(''), null);
eq('parse junk', Number.isNaN(N.parseNum('abc')), true);
eq('parse 5 11 invalid', Number.isNaN(N.parseNum('5 11')), true);
N.setNumberLocale('fr-FR');
eq('fr 1,234', N.parseNum('1,234'), 1.234);
eq('fr 1 234,5', N.parseNum('1 234,5'), 1234.5);
eq('fr fmt', N.fmt(1234.5).replace(/\s/g, ' '), '1 234,5');
N.setNumberLocale('de-DE');
eq('de 1.234', N.parseNum('1.234'), 1234);
N.setNumberLocale('en-US');
eq('fmt sig', N.fmt(37.77777777), '37.7778');
eq('fmt int part kept', N.fmt(1234567.891), '1,234,568');
eq('fmt sci', N.fmt(1.5e20), '1.5 × 10²⁰');
eq('fmt noise', N.fmt(212.00000000000006), '212');
eq('money', N.fmtMoney(1234.5, 'EUR'), '€1,234.50');
eq('money JPY', N.fmtMoney(1234.5, 'JPY'), '¥1,235');
eq('fraction', N.toFraction(0.375), [3, 8]);

// --- units ---
eq('mile', convert('length', 1, 'mi', 'm'), 1609.344);
eq('inch', convert('length', 1, 'in', 'cm'), 2.54);
eq('lb', convert('mass', 1, 'lb', 'kg'), 0.45359237);
eq('stone', convert('mass', 1, 'st', 'lb'), 14, 1e-9);
eq('100C', convert('temperature', 100, 'C', 'F'), 212);
eq('-40', convert('temperature', -40, 'F', 'C'), -40);
eq('0K', convert('temperature', 0, 'K', 'C'), -273.15);
eq('gal', convert('volume', 1, 'gal', 'l'), 3.785411784);
eq('acre', convert('area', 1, 'ac', 'm2'), 4046.8564224);
eq('knot', convert('speed', 1, 'kn', 'kmh'), 1.852);
eq('mpg', convert('fuel', 30, 'mpg', 'l100'), 7.840486111, 1e-8);
eq('mpg uk', convert('fuel', 6, 'l100', 'mpguk'), 47.0801560553, 1e-8);
eq('psi', convert('pressure', 1, 'bar', 'psi'), 14.503773773, 1e-8);
eq('kWh', convert('energy', 1, 'kwh', 'kcal'), 860.4206501, 1e-8);
eq('hp', convert('power', 1, 'hp', 'w'), 745.69987158227);
eq('GiB', convert('data', 1, 'GiB', 'MB'), 1073.741824);
eq('Mbps', convert('datarate', 100, 'Mbps', 'MBps'), 12.5);
eq('slope 100% = 45°', convert('angle', 100, 'slope', 'deg'), 45, 1e-9);
eq('pace', unit('speed', 'minkm').toBase(300), 1000 / 300);
eq('milliard', convert('numbers', 1, 'billion', 'million'), 1000);
const sal = { hpw: 35, dpw: 5, wpy: 52 };
eq('salary month→hour', convert('salary', 2500, 'month', 'hour', sal), 2500 / (35 * 52 / 12));
eq('salary hour→year', convert('salary', 20, 'hour', 'year', sal), 20 * 35 * 52);
eq('salary year→month', convert('salary', 60000, 'year', 'month', sal), 5000);
eq('oven gas 4', unit('oven', 'gas').toBase(4), 176.6666667, 1e-6);
eq('shoe EU42→UK', Math.round(unit('shoes', 'uk').fromBase(unit('shoes', 'eu').toBase(42)) * 2) / 2, 8);
eq('ring US7→EU', Math.round(unit('rings', 'us').toBase(7) * 10) / 10, 54.4);
eq('AWG 12 mm', unit('wire', 'awg').toBase(12), 2.0525, 1e-3);
for (const [id, c] of Object.entries(CATEGORIES)) {
  const units = c.groups ? Object.values(c.groups).flatMap(g => g.units) : c.units;
  for (const u of units) {
    if (u.parts || u.options) continue;
    const x = 3.7, p = Object.fromEntries((c.params || []).map(q => [q.id, q.def]));
    eq(`roundtrip ${id}.${u.id}`, u.fromBase(u.toBase(x, p), p), x, 1e-9);
  }
}

// --- dates ---
eq('diff 31 Jan → 1 Mar', D.diffYMD('2026-01-31', '2026-03-01'), { y: 0, m: 1, d: 1, months: 1, sign: 1 });
eq('diff leap anniversary', D.diffYMD('2024-02-29', '2025-02-28'), { y: 1, m: 0, d: 0, months: 12, sign: 1 });
eq('diff plain', D.diffYMD('2026-03-15', '2027-05-20'), { y: 1, m: 2, d: 5, months: 14, sign: 1 });
eq('addMonths clamp', D.addMonths('2026-01-31', 1), '2026-02-28');
eq('addMonths leap', D.addMonths('2024-01-31', 1), '2024-02-29');
eq('addMonths neg', D.addMonths('2026-03-31', -1), '2026-02-28');
eq('iso week 2026-01-01', D.isoWeek('2026-01-01'), { week: 1, year: 2026 });
eq('iso week 2027-01-01', D.isoWeek('2027-01-01'), { week: 53, year: 2026 });
eq('weeks in 2026', D.weeksInYear(2026), 53);
eq('week 1 2027 starts', D.isoWeekStart(2027, 1), '2027-01-04');
eq('easter 2026', D.easter(2026), '2026-04-05');
eq('easter 2027', D.easter(2027), '2027-03-28');
eq('orthodox 2026', D.orthodoxEaster(2026), '2026-04-12');
eq('work Mon→Fri', D.countDays('2026-11-02', '2026-11-06').working, 4);
eq('work Mon→Fri incl', D.countDays('2026-11-02', '2026-11-06', { inclusive: true }).working, 5);
eq('work with holiday', D.countDays('2026-11-09', '2026-11-16', { holidays: new Set(['2026-11-11']) }).working, 4);
eq('add 5 working days from Fri', D.addWorkingDays('2026-11-06', 5), '2026-11-13');
eq('add -1 working day from Mon', D.addWorkingDays('2026-11-09', -1), '2026-11-06');
eq('leap', [D.isLeap(2024), D.isLeap(1900), D.isLeap(2000)], [true, false, true]);
eq('day of year', D.dayOfYear('2026-12-31'), 365);

// --- time zones ---
eq('Paris winter', offsetMin('Europe/Paris', Date.UTC(2026, 0, 15)), 60);
eq('Paris summer', offsetMin('Europe/Paris', Date.UTC(2026, 6, 15)), 120);
eq('India', offsetMin('Asia/Kolkata', Date.UTC(2026, 6, 15)), 330);
eq('NY 9:00 in July', instantOf('America/New_York', 2026, 7, 15, 9, 0), Date.UTC(2026, 6, 15, 13, 0));
eq('Paris DST day 03:30', instantOf('Europe/Paris', 2026, 3, 29, 12, 0), Date.UTC(2026, 2, 29, 10, 0));

// --- sun & moon (Paris, 7 Nov 2026: sunrise ≈ 07:48, sunset ≈ 17:22 CET) ---
const s = sunTimes(Date.UTC(2026, 10, 7, 11), 48.86, 2.35);
eq('sunrise', (s.sunrise - Date.UTC(2026, 10, 7, 6, 48)) / 60000, 0, 3);
eq('sunset', (s.sunset - Date.UTC(2026, 10, 7, 16, 22)) / 60000, 0, 3);
eq('full moon 24 Nov 2026', new Date(nextPhase(Date.UTC(2026, 10, 7), 0.5)).toISOString().slice(0, 10), '2026-11-24');

// --- words, roman, lists, recipes ---
eq('fr 80', toWordsFR(80), 'quatre-vingts');
eq('fr 81', toWordsFR(81), 'quatre-vingt-un');
eq('fr 71', toWordsFR(71), 'soixante et onze');
eq('fr 91', toWordsFR(91), 'quatre-vingt-onze');
eq('fr 21', toWordsFR(21), 'vingt et un');
eq('fr 200', toWordsFR(200), 'deux cents');
eq('fr 201', toWordsFR(201), 'deux cent un');
eq('fr 80000', toWordsFR(80000), 'quatre-vingt mille');
eq('fr 200000', toWordsFR(200000), 'deux cent mille');
eq('fr 1234', toWordsFR(1234), 'mille deux cent trente-quatre');
eq('fr 2e6', toWordsFR(2000000), 'deux millions');
eq('fr BE 70', toWordsFR(70, 'BE'), 'septante');
eq('fr CH 80', toWordsFR(80, 'CH'), 'huitante');
eq('en 1234', toWordsEN(1234), 'one thousand two hundred thirty-four');
eq('en uk 1234', toWordsEN(1234, true), 'one thousand two hundred and thirty-four');
eq('en uk 1005', toWordsEN(1005, true), 'one thousand and five');
eq('en uk 1005000', toWordsEN(1005000, true), 'one million five thousand');
eq('roman', [toRoman(1994), toRoman(2026), fromRoman('MMXXVI'), fromRoman('IIII')], ['MCMXCIV', 'MMXXVI', 2026, null]);
N.setNumberLocale('fr-FR');
eq('list fr', parseList('1,5 2,5 3'), [1.5, 2.5, 3]);
N.setNumberLocale('en-US');
eq('list en', parseList('1,2,3'), [1, 2, 3]);
eq('list en spaces', parseList('1.5 2.5\n3'), [1.5, 2.5, 3]);
eq('recipe g', scaleLine('200 g flour', 1.5), '300 g flour');
eq('recipe cup', scaleLine('1/2 cup milk', 1.5), '3/4 cup milk');
eq('recipe temp untouched', scaleLine('Bake at 180 °C', 2), 'Bake at 180 °C');
eq('recipe range', scaleLine('2-3 apples', 2), '4-6 apples');

// --- search answers (no network needed) ---
const A = async q => (await answer(q))[0]?.value;
eq('q ft-in', await A('5 ft 11 in cm'), '180.34 cm');
eq('q shorthand', await A("5'11 in cm"), '180.34 cm');
eq('q temp', await A('20c to f'), '68 °F');
eq('q pct', await A('20% of 85'), '17');
eq('q off', await A('30% off 120'), '84');
eq('q hex', await A('255 in hex'), 'FF (hex)');
eq('q roman', await A('MMXXVI'), '2026');
eq('q not roman', (await answer('mix')).length, 0);
eq('q math', await A('12*3+4'), '40');
eq('q data', await A('100 mbps in MB/s'), '12.5 MB/s');
eq('q cooking', await A('1 cup flour in grams'), '125 grams');
eq('q date parse', parseDate('25 dec', 'future').slice(5), '12-25');
eq('q offset', (await answer('today + 7 days'))[0]?.tool, 'dateadd');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
