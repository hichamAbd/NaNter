// Calendar maths on plain dates (YYYY-MM-DD), done in UTC day numbers so DST never shifts a day.
export const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');

export function parts(iso) { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; }
export function dayNum(iso) { const { y, m, d } = parts(iso); return Math.round(Date.UTC(y, m - 1, d) / DAY); }
export function fromDayNum(n) { const t = new Date(n * DAY); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
export function isValidISO(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && !Number.isNaN(dayNum(iso)) && fromDayNum(dayNum(iso)) === iso; }
export function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12
export const weekday = iso => new Date(dayNum(iso) * DAY).getUTCDay(); // 0 Sunday
export function addDays(iso, n) { return fromDayNum(dayNum(iso) + n); }
/** Add months, clamping to the end of the month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso, n) {
  const { y, m, d } = parts(iso);
  const tot = y * 12 + (m - 1) + n;
  const ny = Math.floor(tot / 12), nm = tot - ny * 12 + 1;
  return `${String(ny).padStart(4, '0')}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}
export const addYears = (iso, n) => addMonths(iso, n * 12);

/** Calendar difference a→b as {y, m, d, sign}. */
export function diffYMD(a, b) {
  let sign = 1;
  if (dayNum(b) < dayNum(a)) { [a, b] = [b, a]; sign = -1; }
  const pa = parts(a), pb = parts(b);
  let months = (pb.y - pa.y) * 12 + (pb.m - pa.m);
  if (dayNum(addMonths(a, months)) > dayNum(b)) months--;
  const anchor = addMonths(a, months);
  const d = dayNum(b) - dayNum(anchor);
  return { y: Math.floor(months / 12), m: months % 12, d, months, sign };
}

/** Count days in [a, b) (or [a, b] when inclusive) split into working/weekend/holiday. */
export function countDays(a, b, { weekend = [6, 0], holidays = new Set(), inclusive = false } = {}) {
  let s = dayNum(a), e = dayNum(b);
  if (e < s) [s, e] = [e, s];
  if (inclusive) e += 1;
  const total = e - s;
  let weekendDays = 0, hol = 0;
  const wk = new Set(weekend);
  // whole weeks fast path
  const full = Math.floor(total / 7);
  weekendDays = full * wk.size;
  for (let n = s + full * 7; n < e; n++) if (wk.has(new Date(n * DAY).getUTCDay())) weekendDays++;
  const holList = [];
  for (const iso of holidays) {
    const n = dayNum(iso);
    if (n >= s && n < e && !wk.has(new Date(n * DAY).getUTCDay())) { hol++; holList.push(iso); }
  }
  return { total, weekend: weekendDays, holidays: hol, holidayDates: holList.sort(), working: total - weekendDays - hol };
}

/** Add (or subtract) working days, skipping weekends and holidays. */
export function addWorkingDays(iso, n, { weekend = [6, 0], holidays = new Set() } = {}) {
  const wk = new Set(weekend);
  let d = dayNum(iso);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(Math.round(n));
  while (left > 0) {
    d += step;
    const day = new Date(d * DAY).getUTCDay();
    if (!wk.has(day) && !holidays.has(fromDayNum(d))) left--;
  }
  return fromDayNum(d);
}

/** ISO 8601 week number and week-year. */
export function isoWeek(iso) {
  const n = dayNum(iso);
  const wd = (new Date(n * DAY).getUTCDay() + 6) % 7; // Monday 0
  const thursday = n - wd + 3;
  const ty = new Date(thursday * DAY).getUTCFullYear();
  const jan1 = dayNum(`${ty}-01-01`);
  return { week: Math.floor((thursday - jan1) / 7) + 1, year: ty };
}
/** Monday of ISO week w of year y. */
export function isoWeekStart(y, w) {
  const jan4 = dayNum(`${y}-01-04`);
  const wd = (new Date(jan4 * DAY).getUTCDay() + 6) % 7;
  return fromDayNum(jan4 - wd + (w - 1) * 7);
}
export const weeksInYear = y => isoWeek(`${y}-12-28`).week;
export const dayOfYear = iso => dayNum(iso) - dayNum(`${parts(iso).y}-01-01`) + 1;

/** Julian day number at noon UTC. */
export const julianDay = iso => dayNum(iso) + 2440588;

/** Western (Gregorian) Easter — Meeus/Jones/Butcher. */
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const month = Math.floor((hh + l - 7 * m + 114) / 31), day = ((hh + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(month)}-${pad(day)}`;
}
/** Orthodox Easter (Julian computus, shown in Gregorian). */
export function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  const julian = `${y}-${pad(month)}-${pad(day)}`;
  return addDays(julian, Math.floor(y / 100) - Math.floor(y / 400) - 2);
}

/* ---------- formatting ---------- */
let LOC;
try { LOC = navigator.languages?.[0] || navigator.language; } catch { LOC = 'en'; }
export function fmtDate(iso, style = 'full') {
  const t = new Date(dayNum(iso) * DAY);
  const o = style === 'full' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : style === 'med' ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
      : style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
        : style === 'dm' ? { weekday: 'short', day: 'numeric', month: 'short' } : style;
  return t.toLocaleDateString(LOC, { ...o, timeZone: 'UTC' });
}
export function weekdayName(i, style = 'long') { return new Date(Date.UTC(2023, 0, 1 + i)).toLocaleDateString(LOC, { weekday: style, timeZone: 'UTC' }); }
export function relDays(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n.toLocaleString(LOC)} days` : `${(-n).toLocaleString(LOC)} days ago`;
}
export function ymdText({ y, m, d }) {
  const p = [];
  if (y) p.push(`${y} ${y === 1 ? 'year' : 'years'}`);
  if (m) p.push(`${m} ${m === 1 ? 'month' : 'months'}`);
  if (d || !p.length) p.push(`${d} ${d === 1 ? 'day' : 'days'}`);
  return p.join(', ');
}
/** "2 h 05 min" from seconds. */
export function hmText(sec, { seconds = false, days = false } = {}) {
  const neg = sec < 0; sec = Math.abs(Math.round(sec));
  let d = 0;
  if (days) { d = Math.floor(sec / 86400); sec -= d * 86400; }
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const out = [];
  if (d) out.push(`${d} d`);
  if (hh || d) out.push(`${hh} h`);
  out.push(`${pad(mm)} min`);
  if (seconds) out.push(`${pad(ss)} s`);
  return (neg ? '−' : '') + out.join(' ');
}
export const hhmm = sec => { sec = Math.round(sec); const neg = sec < 0; sec = Math.abs(sec); return `${neg ? '−' : ''}${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}`; };
export const hhmmss = sec => { sec = Math.round(sec); const neg = sec < 0; sec = Math.abs(sec); return `${neg ? '−' : ''}${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`; };
export function timeToSec(t) { if (!t) return null; const [a, b, c] = t.split(':').map(Number); return a * 3600 + (b || 0) * 60 + (c || 0); }
export function secToTime(s) { s = ((Math.round(s) % 86400) + 86400) % 86400; return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}`; }

const ZODIAC = [['Capricorn', '♑', 120], ['Aquarius', '♒', 219], ['Pisces', '♓', 321], ['Aries', '♈', 420], ['Taurus', '♉', 521], ['Gemini', '♊', 621], ['Cancer', '♋', 723], ['Leo', '♌', 823], ['Virgo', '♍', 923], ['Libra', '♎', 1023], ['Scorpio', '♏', 1122], ['Sagittarius', '♐', 1222], ['Capricorn', '♑', 1232]];
export function zodiac(iso) { const { m, d } = parts(iso); const k = m * 100 + d; return ZODIAC.find(z => k < z[2]); }
const CHINESE = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
/** Chinese zodiac animal by Gregorian year (approximate: the year changes at Chinese New Year). */
export function chineseZodiac(y) { return CHINESE[((y - 4) % 12 + 12) % 12]; }
export function generation(y) {
  if (y >= 2013) return 'Generation Alpha'; if (y >= 1997) return 'Generation Z'; if (y >= 1981) return 'Millennial';
  if (y >= 1965) return 'Generation X'; if (y >= 1946) return 'Baby boomer'; if (y >= 1928) return 'Silent generation'; return 'Greatest generation';
}
