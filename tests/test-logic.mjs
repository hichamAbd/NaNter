// Logic tests (no browser): node tests/test-logic.mjs
import * as N from '../js/core/num.js';
import { CATEGORIES, convert, unit } from '../js/data/units.js';
import * as D from '../js/lib/dates.js';
import { offsetMin, instantOf } from '../js/lib/tz.js';
import { sunTimes, nextPhase } from '../js/lib/sun.js';
import { toWordsEN, toWordsFR, toRoman, fromRoman, parseList } from '../js/tools/math.js';
import { scaleLine } from '../js/tools/kitchen.js';
import { answer, parseDate } from '../js/lib/quick.js';
import * as QR from '../js/lib/qr.js';
import { calcEval } from '../js/tools/calc.js';
import { haversine, bearing, flightMinutes } from '../js/tools/travel.js';
import { heatNeed, coolNeed, costPerUsefulKWh } from '../js/tools/home.js';
import { zakatCalc } from '../js/tools/money.js';
import { grainPlan } from '../js/tools/kitchen.js';
import { bridgeInfo, schoolPeriods } from '../js/tools/holidays.js';
import { wifiPayload, vcardPayload } from '../js/tools/qrtool.js';
import { gravityFromOrientation, toScreen, tilts } from '../js/tools/phone.js';
import * as FR from '../js/tools/frtax.js';
import * as GOAL from '../js/tools/goal.js';

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
eq('q brut net', await A('2500 brut en net'), '1,979 € net');
eq('q brut short', (await answer('2500 brut'))[0]?.tool, 'brutnet');
eq('q gross yearly k', await A('36k gross'), '28,498 € net');
eq('q net en brut', await A('1979 net en brut'), '2,500 € gross');
eq('q brut 13 mois', await A('32500 brut sur 13 mois'), (() => { const f = FR.payFigures({ amount: 32500, per: 'y', months: 13 }); return Math.round(f.year.net).toLocaleString('en-US') + ' € net'; })());
eq('q brut 13 mois params', (await answer('32500 brut sur 13 mois'))[0]?.params?.months, '13');
eq('q plain net is not pay', (await answer('2500 net')).some(a => a.tool === 'brutnet'), false);
eq('q impot', await A('impôt 30000'), (() => { const t = FR.incomeTax({ rni: 27000 }); return t.final.toLocaleString('en-US') + ' €'; })());
eq('q impot tool', (await answer('income tax 45k'))[0]?.tool, 'impot');


// --- QR encoder: published known answers ---
eq('qr rs HELLO WORLD 1-Q', QR.rsRemainder([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236], QR.rsDivisor(13)), [168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
eq('qr format M-0', QR.formatBits('M', 0).toString(2).padStart(15, '0'), '101010000010010');
eq('qr format L-0', QR.formatBits('L', 0).toString(2).padStart(15, '0'), '111011111000100');
eq('qr version 7', QR.versionBits(7).toString(2).padStart(18, '0'), '000111110010010100');
eq('qr capacities', [[1, 'L'], [1, 'M'], [1, 'Q'], [1, 'H'], [10, 'L'], [10, 'M'], [10, 'Q'], [10, 'H'], [40, 'L'], [40, 'M'], [40, 'Q'], [40, 'H']].map(([v, e]) => QR.byteCapacity(v, e)), [17, 14, 11, 7, 271, 213, 151, 119, 2953, 2331, 1663, 1273]);
eq('qr align v7', QR.alignmentPositions(7), [6, 22, 38]);
eq('qr align v32', QR.alignmentPositions(32), [6, 34, 60, 86, 112, 138]);
for (let v = 1; v <= 40; v++) { const { f, size } = QR.functionMap(v); eq(`qr data modules v${v}`, QR.dataOrder(v, f).length, QR.rawDataModules(v)); void size; }
// --- QR: decode our own matrices back (format check, unmask, de-interleave, RS check, byte mode) ---
function decodeMatrix(m) {
  const size = m.length, ver = (size - 17) / 4;
  let bits = 0; const rd = (x, y) => (m[y][x] ? 1 : 0);
  const pos = []; for (let i = 0; i <= 5; i++) pos.push([8, i]); pos.push([8, 7], [8, 8], [7, 8]); for (let i = 9; i < 15; i++) pos.push([14 - i, 8]);
  pos.forEach(([x, y], i) => { bits |= rd(x, y) << i; });
  let ecl, mask;
  for (const e of ['L', 'M', 'Q', 'H']) for (let k = 0; k < 8; k++) if (QR.formatBits(e, k) === bits) { ecl = e; mask = k; }
  if (ecl == null) throw new Error('format');
  const { f } = QR.functionMap(ver);
  const order = QR.dataOrder(ver, f);
  const cw = [];
  order.forEach(([x, y], i) => { const b = (m[y][x] !== QR.MASKS[mask](x, y)) ? 1 : 0; if (i >>> 3 >= cw.length) cw.push(0); cw[i >>> 3] = (cw[i >>> 3] << 1) | b; });
  const total = Math.floor(QR.rawDataModules(ver) / 8);
  const data = QR.dataCodewords(ver, ecl);
  const nb = { L: 0, M: 1, Q: 2, H: 3 }[ecl];
  const numBlocks = [[1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]][nb][ver - 1];
  const ecc = (total - data) / numBlocks;
  const numShort = numBlocks - (total % numBlocks), shortLen = Math.floor(total / numBlocks);
  const blocks = Array.from({ length: numBlocks }, (_, j) => []);
  let k = 0;
  for (let i = 0; i < shortLen + 1; i++) for (let j = 0; j < numBlocks; j++) { if (i === shortLen - ecc && j < numShort) continue; if (k < total) blocks[j].push(cw[k++]); }
  const out = [];
  for (const b of blocks) {
    const d = b.slice(0, b.length - ecc), e = b.slice(b.length - ecc);
    if (JSON.stringify(QR.rsRemainder(d, QR.rsDivisor(ecc))) !== JSON.stringify(e)) throw new Error('rs');
    out.push(...d);
  }
  const bitsArr = out.flatMap(byte => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let p = 0; const take = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bitsArr[p++]; return v; };
  if (take(4) !== 4) throw new Error('mode');
  const len = take(ver < 10 ? 8 : 16);
  return new TextDecoder().decode(new Uint8Array(Array.from({ length: len }, () => take(8))));
}
for (const [txt, e] of [['HELLO WORLD', 'Q'], ['https://hichamabd.github.io/NaNter/', 'M'], [wifiPayload({ ssid: 'Maison été', pass: 'p;a,s:s', sec: 'WPA' }), 'H'], ['x'.repeat(300), 'L'], ['Ünïcödé ✓ 日本 '.repeat(20), 'Q']]) {
  const q = QR.encodeText(txt, e);
  let got; try { got = decodeMatrix(q.modules); } catch (err) { got = 'ERR ' + err.message; }
  eq(`qr roundtrip v${q.version}-${e} mask ${q.mask}`, got, txt);
}
for (let m = 0; m < 8; m++) { const q = QR.encodeText('mask test ' + m, 'M', { mask: m }); eq(`qr forced mask ${m}`, decodeMatrix(q.modules), 'mask test ' + m); }
eq('wifi escape', wifiPayload({ ssid: 'a;b', pass: 'c:d', sec: 'WPA', hidden: true }), String.raw`WIFI:T:WPA;S:a\;b;P:c\:d;H:true;;`);
eq('vcard', vcardPayload({ first: 'Hicham', last: 'A', phone: '+33 6' }).split('\n')[2], 'N:A;Hicham;;;');

// --- scientific calculator ---
for (const [e, w] of [['2+3×4', 14], ['−2^2', -4], ['sin(30)', 0.5], ['sin(180)', 0], ['tan(45)', 1], ['√(16', 4], ['5!', 120], ['log(1000)', 3], ['1.5E−3', 0.0015], ['0.1+0.2', 0.3], ['2π', 2 * Math.PI], ['sin⁻¹(1)', 90], ['Ans×2', 84]]) eq(`calc ${e}`, calcEval(e, { mode: 'deg', ans: 42 }), w, 1e-12);
eq('calc rad', calcEval('cos(π)', { mode: 'rad' }), -1);

// --- city distance ---
const paris = { lat: 48.8566, lon: 2.3522 }, ny = { lat: 40.7128, lon: -74.006 };
eq('paris–new york km', Math.round(haversine(paris, ny)), 5837, 0.01);
eq('bearing paris→ny', Math.round(bearing(paris, ny)), 292);
eq('flight paris-ny', flightMinutes(5837), 442);

// --- home ---
eq('heat 20m2 avg', heatNeed({ area: 20, height: 2.5, g: 1.1, tin: 20, tout: -7 }), 1485);
eq('cool 20m2', Math.round(coolNeed({ area: 20, height: 2.44, sun: 'normal', people: 2, kitchen: false })), 4306);
eq('heat pump cost', costPerUsefulKWh(0.2, 1, 300), 0.2 / 3);
eq('oil cost', costPerUsefulKWh(1.15, 10, 85), 1.15 / 10 / 0.85);

// --- zakat ---
const z = zakatCalc({ cash: 10000, goldG: 100, karat: 18, g24: 100, ag: 1, nisab: 'gold' });
eq('zakat gold value', z.goldValue, 7500);
eq('zakat due', z.due, (10000 + 7500) * 0.025);
eq('zakat below nisab', zakatCalc({ cash: 5000, g24: 100, ag: 1, nisab: 'gold' }).due, 0);

// --- grains ---
eq('basmati 2 main dry', grainPlan('basmati', 2, 1).dry, 150);
eq('pasta 4 main pot', grainPlan('pasta', 4, 1).boilL, 4);

// --- holidays ---
eq('bridge thursday', bridgeInfo('2026-05-14').kind, 'bridge');
eq('bridge day', bridgeInfo('2026-05-14').day, '2026-05-15');
eq('long weekend monday', bridgeInfo('2026-04-06').kind, 'long');
eq('weekend holiday', bridgeInfo('2026-11-01').kind, 'weekend');
eq('school C toussaint 2026', schoolPeriods('C').find(p => p.first.startsWith('2026-10')), { name: 'Vacances de la Toussaint', first: '2026-10-17', last: '2026-11-01', back: '2026-11-02' });
eq('school A hiver 2027', schoolPeriods('A').find(p => p.first.startsWith('2027-02'))?.first, '2027-02-13');

// --- spirit level geometry ---
const lv = (b, g, a = 0) => tilts(toScreen(gravityFromOrientation(b, g), a));
eq('level flat', [lv(0, 0).flat, Math.round(lv(0, 0).x), Math.round(lv(0, 0).y)], [true, 0, 0]);
eq('level right side down', Math.round(lv(0, 3).x), 3);
eq('level top raised', Math.round(lv(5, 0).y), -5);
eq('level edge clockwise', Math.round(lv(88, 90).edge), 2);
eq('level edge landscape', Math.round(lv(2, -88, 90).edge), 2);

// --- France: brut ↔ net (2026 rates) ---
const bn = FR.brutToNet(2500);
eq('brut 2500 non-cadre net', Math.round(bn.net * 100) / 100, 1978.99);
eq('brut 2500 net imposable', bn.taxable, 2050.225, 1e-6);
eq('brut 2500 contributions', Math.round(bn.total * 100) / 100, 521.01);
eq('brut 6000 cadre has T2 + CET + APEC', ['Retraite compl. T2', 'CET', 'APEC'].every(l => FR.brutToNet(6000, { statut: 'cadre' }).lines.some(x => x.label === l)), true);
eq('brut 3000 no CET under PMSS', FR.brutToNet(3000).lines.some(x => x.label === 'CET'), false);
eq('fonctionnaire 2500 no primes', Math.round(FR.brutToNet(2500, { statut: 'fonct' }).net * 100) / 100, 1984.24);
eq('fonct RAFP capped at 20% TIB', FR.brutToNet(3000, { statut: 'fonct', primes: 1000 }).lines.find(l => l.label === 'RAFP').base, 400);
eq('alsace adds 1.30%', Math.round((FR.brutToNet(2500).net - FR.brutToNet(2500, { alsace: true }).net) * 100) / 100, 32.5);
eq('mutuelle lowers net', Math.round((FR.brutToNet(2500).net - FR.brutToNet(2500, { mutuelle: 40 }).net) * 100) / 100, 40);
eq('net → brut round trip', FR.netToBrut(FR.brutToNet(3456).net), 3456, 1e-6);
eq('net → brut cadre round trip', FR.netToBrut(FR.brutToNet(7000, { statut: 'cadre' }).net, { statut: 'cadre' }), 7000, 1e-6);
eq('neutral rate 2500', FR.neutralRate(2500), 5.3);
const p12 = FR.payFigures({ amount: 30000, per: 'y', months: 12, pas: 0 });
eq('yearly 12 months: month gross', p12.brutM, 2500);
eq('yearly 12 months: year net', p12.year.net, p12.r.net * 12, 1e-12);
const p13 = FR.payFigures({ amount: 32500, per: 'y', months: 13, pas: 0 });
eq('yearly 13 months: month gross', p13.brutM, 2500);
eq('yearly 13 months: year net', p13.year.net, p13.r.net * 13, 1e-12);
eq('13th month net', p13.r13.net, p13.r.net, 1e-12);
eq('monthly input, 13 months: yearly gross', FR.payFigures({ amount: 2500, months: 13 }).year.brut, 32500);
const pm = FR.payFigures({ amount: 2500, months: 13, mutuelle: 40, pas: 0 });
eq('mutuelle only 12 times', pm.year.net, (FR.brutToNet(2500).net - 40) * 12 + FR.brutToNet(2500).net, 1e-12);
const nm = FR.payFigures({ dir: 'n2b', amount: 30000, per: 'y', months: 13, mutuelle: 40, pas: 0 });
eq('net → gross yearly 13 months round trip', nm.year.net, 30000, 1e-9);
const nn = FR.payFigures({ amount: 2500, months: 13 });
eq('13th month neutral rate on the double month', nn.pas13, (nn.r.taxable * 2) * FR.neutralRate(nn.r.taxable * 2) / 100 - nn.pasM, 1e-12);
eq('13th month personal rate', FR.payFigures({ amount: 2500, months: 13, pas: 10 }).year.pas, FR.brutToNet(2500).taxable * 13 * 0.1, 1e-12);
eq('neutral rate under 1635', FR.neutralRate(1634.99), 0);
eq('neutral rate top', FR.neutralRate(60000), 43);

// --- France: income tax (barème 2026, 2025 income) ---
eq('allowance 10%', FR.salaryAllowance(30000), 3000);
eq('allowance min', FR.salaryAllowance(3000), 509);
eq('allowance not above salary', FR.salaryAllowance(300), 300);
eq('allowance max', FR.salaryAllowance(200000), 14555);
eq('parts couple 3 kids', FR.familyParts({ couple: true, kids: 3 }), 4);
eq('parts single parent 1 kid', FR.familyParts({ kids: 1, alone: true }), 2);
eq('tax single 30000', FR.incomeTax({ rni: 30000 }).net, 2104);
eq('tax single 30000 TMI', FR.incomeTax({ rni: 30000 }).tmi, 30);
eq('tax single 27000 with décote', FR.incomeTax({ rni: 27000 }).net, 1564);
eq('tax single 13000 wiped by décote', FR.incomeTax({ rni: 13000 }).net, 0);
eq('tax couple 2 kids 50000', FR.incomeTax({ rni: 50000, couple: true, kids: 2 }).net, 946);
const capT = FR.incomeTax({ rni: 150000, couple: true, kids: 2 });
eq('family cap applies', [capT.capped, capT.net, capT.tmi], [true, 27594, 30]);
eq('single parent cap', FR.incomeTax({ rni: 80000, kids: 1, alone: true }).net, 12842);
eq('under 61 € not collected', (() => { const t = FR.incomeTax({ rni: 13400 }); return t.net === 0; })(), true);
eq('CEHR 300k single', FR.incomeTax({ rni: 300000 }).cehr, 1500);
eq('credits give refund', FR.incomeTax({ rni: 13000, credits: 500 }).final, -500);

// --- savings goal ---
const TD = '2026-11-08';
eq('goal per month', GOAL.goalPlan({ target: 5000, saved: 500, mode: 'date', date: '2027-11-08' }, TD).perMonth, 375);
const gi = GOAL.goalPlan({ target: 5000, saved: 500, mode: 'date', date: '2027-11-08', rate: 3 }, TD);
eq('goal with interest reaches target', gi.final, 5000, 1e-9);
eq('goal interest lowers deposit', gi.perMonth < 375, true);
const gm = GOAL.goalPlan({ target: 2050, saved: 0, mode: 'monthly', monthly: 200 }, TD);
eq('goal monthly months + last deposit', [gm.n, gm.end, Math.round(gm.last)], [11, '2027-10-08', 50]);
const gs = GOAL.goalPlan({ target: 1000, saved: 0, mode: 'date', date: '2026-12-25' }, TD);
eq('goal short deadline', [gs.n, gs.perMonth, gs.weeks, gs.days], [1, 1000, 6, 47]);
eq('goal done', GOAL.goalPlan({ target: 100, saved: 150, mode: 'date', date: '2027-01-01' }, TD).done, true);
eq('goal date passed', GOAL.goalPlan({ target: 100, saved: 0, mode: 'date', date: '2026-01-01' }, TD).past, true);
eq('goal never without deposits', GOAL.goalPlan({ target: 100, saved: 0, mode: 'monthly', monthly: 0 }, TD).never, true);
eq('expected by now (monthly)', GOAL.expectedByNow({ target: 1200, saved: 0, mode: 'monthly', monthly: 100 }, '2026-08-08', TD), 300);
eq('expected by now (date, linear)', Math.round(GOAL.expectedByNow({ target: 1200, saved: 0, mode: 'date', date: '2027-08-08' }, '2026-08-08', TD)), 302);
eq('nice amounts', [75, 150, 333, 750, 1234].map(GOAL.niceAmount), [75, 150, 330, 750, 1200]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
