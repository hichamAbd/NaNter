// The app opens and every tool works with no network once the service worker has installed.
// Run: python3 -m http.server 8765 (repo root), then: node tests/test-offline.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE);
  await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  await p.waitForTimeout(1500);
  await p.reload(); // now controlled by the worker
  await p.waitForSelector('.tile');
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.tile', { timeout: 5000 });
  const ids = await p.$$eval('.home-main .sec[data-cat] .tile', els => els.map(e => e.getAttribute('href').split('/').pop()));
  let bad = 0;
  for (const id of ids) {
    await p.goto(BASE + '#/t/' + id);
    await p.waitForTimeout(150);
    const failed = await p.evaluate(() => !document.querySelector('.tool-body')?.children.length || document.querySelector('.tool-body').textContent.includes('failed to load'));
    if (failed) { bad++; console.log('✗ offline', id); }
  }
  console.log(`offline: ${ids.length - bad}/${ids.length} tools render`, errs.length ? errs : '');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
