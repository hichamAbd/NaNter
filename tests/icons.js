// Regenerates the PNG icons from the SVG design (run: node tests/icons.js).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'icons');

function icon({ rx = 0, scale = 1, minor = true, stroke = 40 } = {}) {
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    if (!major && !minor) continue;
    const a = (i / 60) * 2 * Math.PI, r1 = 212, r2 = major ? 182 : 198;
    const f = n => n.toFixed(2);
    ticks += `<line x1="${f(256 + r1 * Math.sin(a))}" y1="${f(256 - r1 * Math.cos(a))}" x2="${f(256 + r2 * Math.sin(a))}" y2="${f(256 - r2 * Math.cos(a))}" stroke="#fff" stroke-opacity="${major ? 1 : 0.5}" stroke-width="${major ? 10 : 5}" stroke-linecap="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4cf5"/><stop offset="1" stop-color="#11b3cc"/></linearGradient><radialGradient id="hl" cx=".22" cy=".12" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="512" height="512" rx="${rx}" fill="url(#g)"/><rect width="512" height="512" rx="${rx}" fill="url(#hl)"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${ticks}<path d="M188 334V178l136 156V178" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'icon.svg'), icon({ rx: 112 }));
  fs.writeFileSync(path.join(out, 'mark.svg'), icon({ rx: 112, minor: false, stroke: 48 }));
  const b = await chromium.launch();
  const p = await b.newPage();
  const shots = [
    ['apple-touch-icon.png', 180, icon({})],                       // iOS masks the corners itself: full bleed, no transparency
    ['icon-192.png', 192, icon({ rx: 112 })],
    ['icon-512.png', 512, icon({ rx: 112 })],
    ['icon-maskable-512.png', 512, icon({ scale: 0.8 })],          // content inside the 80 % safe zone
    ['favicon-32.png', 32, icon({ rx: 112, minor: false, stroke: 52 })],
  ];
  for (const [name, size, svg] of shots) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(out, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close();
  console.log('icons written to', out);
})();
