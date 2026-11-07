// Sun and moon positions, rise/set times and moon phase (after V. Agafonkin's SunCalc, BSD; NOAA-style equations).
const PI = Math.PI, rad = PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545;
const { sin, cos, tan, asin, atan2: atan, acos } = Math;
const toJulian = ms => ms / dayMs - 0.5 + J1970;
const fromJulian = j => (j + 0.5 - J1970) * dayMs;
const toDays = ms => toJulian(ms) - J2000;
const e = rad * 23.4397;
const rightAscension = (l, b) => atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
const declination = (l, b) => asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
const azimuth = (H, phi, dec) => atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi));
const altitude = (H, phi, dec) => asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H));
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
function astroRefraction(h) { if (h < 0) h = 0; return 0.0002967 / tan(h + 0.00312536 / (h + 0.08901179)); }
const solarMeanAnomaly = d => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(M) {
  const C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), P = rad * 102.9372;
  return M + C + P + PI;
}
function sunCoords(d) { const M = solarMeanAnomaly(d), L = eclipticLongitude(M); return { dec: declination(L, 0), ra: rightAscension(L, 0) }; }
const J0 = 0.0009;
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * PI));
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * PI) + n;
const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L);
const hourAngle = (h, phi, d) => acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d)));
function getSetJ(h, lw, phi, dec, n, M, L) { const w = hourAngle(h, phi, dec), a = approxTransit(w, lw, n); return solarTransitJ(a, M, L); }

export function sunPosition(ms, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(ms), c = sunCoords(d), H = siderealTime(d, lw) - c.ra;
  return { azimuth: azimuth(H, phi, c.dec), altitude: altitude(H, phi, c.dec) };
}

const ANGLES = [[-0.833, 'sunrise', 'sunset'], [-6, 'dawn', 'dusk'], [-12, 'nauticalDawn', 'nauticalDusk'], [-18, 'nightEnd', 'night'], [6, 'goldenHourEnd', 'goldenHour'], [-4, 'blueHourEnd', 'blueHour']];
/** Sun times for the day containing `ms` (pass local noon of the place). Values are epoch ms or NaN. */
export function sunTimes(ms, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(ms), n = julianCycle(d, lw), ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L, 0), Jnoon = solarTransitJ(ds, M, L);
  const out = { solarNoon: fromJulian(Jnoon), nadir: fromJulian(Jnoon - 0.5) };
  for (const [a, rise, set] of ANGLES) {
    const Jset = getSetJ(a * rad, lw, phi, dec, n, M, L), Jrise = Jnoon - (Jset - Jnoon);
    out[rise] = fromJulian(Jrise); out[set] = fromJulian(Jset);
  }
  out.noonAltitude = 90 - Math.abs(lat - dec / rad);
  return out;
}

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d);
  const l = L + rad * 6.289 * sin(M), b = rad * 5.128 * sin(F), dt = 385001 - 20905 * cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
}
export function moonPosition(ms, lat, lng) {
  const lw = rad * -lng, phi = rad * lat, d = toDays(ms), c = moonCoords(d), H = siderealTime(d, lw) - c.ra;
  let h = altitude(H, phi, c.dec);
  h += astroRefraction(h);
  return { azimuth: azimuth(H, phi, c.dec), altitude: h, distance: c.dist };
}
/** fraction lit (0..1), phase (0 new → .25 first quarter → .5 full → .75 last quarter) */
export function moonIllumination(ms) {
  const d = toDays(ms), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
  const phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
  const inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi));
  const angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
  return { fraction: (1 + cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / PI };
}
/** Moonrise/moonset during the 24 h after `startMs` (local midnight of the place). */
export function moonTimes(startMs, lat, lng) {
  const hc = 0.133 * rad;
  const at = hrs => moonPosition(startMs + hrs * 36e5, lat, lng).altitude - hc;
  let h0 = at(0), h1, h2, rise, set, a, b, xe, ye = 0, d, roots, x1 = 0, x2 = 0, dx;
  for (let i = 1; i <= 24; i += 2) {
    h1 = at(i); h2 = at(i + 1);
    a = (h0 + h2) / 2 - h1; b = (h2 - h0) / 2; xe = -b / (2 * a); ye = (a * xe + b) * xe + h1; d = b * b - 4 * a * h1; roots = 0;
    if (d >= 0) { dx = Math.sqrt(d) / (Math.abs(a) * 2); x1 = xe - dx; x2 = xe + dx; if (Math.abs(x1) <= 1) roots++; if (Math.abs(x2) <= 1) roots++; if (x1 < -1) x1 = x2; }
    if (roots === 1) { if (h0 < 0) rise = i + x1; else set = i + x1; }
    else if (roots === 2) { rise = i + (ye < 0 ? x2 : x1); set = i + (ye < 0 ? x1 : x2); }
    if (rise && set) break;
    h0 = h2;
  }
  const r = {};
  if (rise) r.rise = startMs + rise * 36e5;
  if (set) r.set = startMs + set * 36e5;
  if (!rise && !set) r[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;
  return r;
}
export function phaseName(p) {
  const names = [['New moon', '🌑'], ['Waxing crescent', '🌒'], ['First quarter', '🌓'], ['Waxing gibbous', '🌔'], ['Full moon', '🌕'], ['Waning gibbous', '🌖'], ['Last quarter', '🌗'], ['Waning crescent', '🌘']];
  return names[Math.round(p * 8) % 8];
}
/** Next instant after `ms` when the phase crosses `target` (0 new, 0.25, 0.5 full, 0.75). */
export function nextPhase(ms, target) {
  const f = t => { const p = moonIllumination(t).phase; return ((p - target + 1.5) % 1) - 0.5; }; // signed distance, wraps
  let t = ms, prev = f(t);
  for (let i = 0; i < 31 * 4; i++) {
    const t2 = t + 6 * 36e5, cur = f(t2);
    if (prev < 0 && cur >= 0) {
      let lo = t, hi = t2;
      for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
    t = t2; prev = cur;
  }
  return NaN;
}
