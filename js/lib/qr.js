// QR Code encoder (ISO/IEC 18004), byte mode with UTF-8, versions 1–40, error correction L/M/Q/H.
// Written for NaNter; structure follows the standard: bit stream → Reed–Solomon blocks → interleave →
// function patterns → zigzag placement → best of 8 masks → format/version information.

const ECL = { L: { ord: 0, fmt: 1 }, M: { ord: 1, fmt: 0 }, Q: { ord: 2, fmt: 3 }, H: { ord: 3, fmt: 2 } };
// [ecl][version] error-correction codewords per block
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
// [ecl][version] number of error-correction blocks
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** Number of modules available for data + ECC (after function patterns), in bits. */
export function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
export function dataCodewords(ver, ecl) {
  const e = ECL[ecl].ord;
  return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];
}
/** Max bytes of payload in byte mode. */
export function byteCapacity(ver, ecl) {
  const bits = dataCodewords(ver, ecl) * 8 - 4 - (ver < 10 ? 8 : 16);
  return Math.floor(bits / 8);
}

/* ---------- Reed–Solomon over GF(256), primitive polynomial 0x11D ---------- */
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
export function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
export function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

export function utf8(str) { return Array.from(new TextEncoder().encode(str)); }

/** Encode text → { size, modules: boolean[][] (row-major), version, mask, ecl }. */
export function encodeText(text, ecl = 'M', { minVersion = 1, mask: forcedMask = -1 } = {}) {
  const bytes = utf8(text);
  let ver = minVersion;
  for (; ver <= 40; ver++) if (bytes.length <= byteCapacity(ver, ecl)) break;
  if (ver > 40) throw new Error('Too much data for a QR code');
  // Bit stream
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(b => push(b, 8));
  const cap = dataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const all = addEccAndInterleave(data, ver, ecl);
  return buildMatrix(all, ver, ecl, forcedMask);
}

function addEccAndInterleave(data, ver, ecl) {
  const e = ECL[ecl].ord;
  const numBlocks = NUM_BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= numShort) out.push(b[i]); });
  }
  return out;
}

export function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}
export function formatBits(ecl, mask) {
  const data = (ECL[ecl].fmt << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
export function versionBits(ver) {
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (ver << 12) | rem;
}
export const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Function-pattern map for a version (true = reserved), shared by encoder and the test decoder. */
export function functionMap(ver) {
  const size = ver * 4 + 17;
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { mod[y][x] = dark; f[y][x] = true; } };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  }
  const al = alignmentPositions(ver);
  const n = al.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // reserve format areas (values written later) and the dark module
  for (let i = 0; i <= 8; i++) { if (i !== 6) { set(8, i, false); set(i, 8, false); } }
  for (let i = 0; i < 8; i++) { set(size - 1 - i, 8, false); set(8, size - 1 - i, false); }
  set(8, size - 8, true);
  if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, false); set(b, a, false); }
  return { size, f, mod };
}
/** Zigzag order of the data module coordinates. */
export function dataOrder(ver, f) {
  const size = ver * 4 + 17;
  const out = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!f[y][x]) out.push([x, y]);
      }
    }
  }
  return out;
}
function drawFormat(mod, size, ecl, mask) {
  const b = formatBits(ecl, mask);
  const bit = i => ((b >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) mod[i][8] = bit(i);
  mod[7][8] = bit(6); mod[8][8] = bit(7); mod[8][7] = bit(8);
  for (let i = 9; i < 15; i++) mod[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) mod[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) mod[size - 15 + i][8] = bit(i);
  mod[size - 8][8] = true;
}
function drawVersion(mod, size, ver) {
  if (ver < 7) return;
  const b = versionBits(ver);
  for (let i = 0; i < 18; i++) {
    const v = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3);
    mod[c][a] = v; mod[a][c] = v;
  }
}
function penalty(m, size) {
  let p = 0;
  const line = get => {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    for (let i = 0; i + 10 < size; i++) {
      const s = Array.from({ length: 11 }, (_, k) => (get(i + k) ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') p += 40;
    }
  };
  for (let y = 0; y < size; y++) line(x => m[y][x]);
  for (let x = 0; x < size; x++) line(y => m[y][x]);
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  }
  const total = size * size;
  p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}
function buildMatrix(codewords, ver, ecl, forcedMask) {
  const { size, f, mod } = functionMap(ver);
  const order = dataOrder(ver, f);
  order.forEach(([x, y], i) => { mod[y][x] = i < codewords.length * 8 ? ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1 : false; });
  drawVersion(mod, size, ver);
  let best = null;
  for (let m = 0; m < 8; m++) {
    if (forcedMask >= 0 && m !== forcedMask) continue;
    const t = mod.map(r => r.slice());
    for (const [x, y] of order) if (MASKS[m](x, y)) t[y][x] = !t[y][x];
    drawFormat(t, size, ecl, m);
    const p = forcedMask >= 0 ? 0 : penalty(t, size);
    if (!best || p < best.p) best = { p, t, m };
  }
  return { size, modules: best.t, version: ver, mask: best.m, ecl };
}

/** SVG markup (black on white, 4-module quiet zone). */
export function toSVG(qr, { border = 4, dark = '#000', light = '#fff' } = {}) {
  const n = qr.size + border * 2;
  let d = '';
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) d += `M${x + border},${y + border}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
