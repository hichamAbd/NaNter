// Visits every tool at several phone widths: no console errors, nothing wider than the screen, no input under 16px.
// Run: python3 -m http.server 8765 (repo root), then: node tests/test-layout.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const widths = (process.env.WIDTHS || '320,375,390').split(',').map(Number);
  let fails = 0;
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + '#/');
    await p.waitForSelector('.tile');
    const ids = await p.$$eval('.home-main .sec[data-cat] .tile', els => els.map(e => e.getAttribute('href').split('/').pop()));
    for (const id of ['', ...ids.map(i => 't/' + i), 'settings', 'about']) {
      errs.length = 0;
      await p.goto(BASE + '#/' + id);
      await p.waitForTimeout(id ? 350 : 200);
      const r = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('#view *')].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.right > vw + 1 || b.left < -1) && !el.closest('.tbl-wrap, .recent-row, .chips.scroll, .sheet') && getComputedStyle(el).position !== 'fixed'; }).slice(0, 3).map(el => el.className || el.tagName);
        const small = [...document.querySelectorAll('#view input, #view select, #view textarea')].filter(el => el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'color' && parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.className + ':' + getComputedStyle(el).fontSize).slice(0, 3);
        const failed = document.querySelector('.tool-body')?.textContent.includes('failed to load');
        return { wide, small, failed, sw: document.documentElement.scrollWidth, vw };
      });
      const bad = r.wide.length || r.small.length || r.failed || errs.length || r.sw > r.vw;
      if (bad) { fails++; console.log(`✗ ${w}px #/${id}`, JSON.stringify({ wide: r.wide, small: r.small, failed: r.failed, scroll: r.sw > r.vw ? r.sw : undefined, errs })); }
    }
    console.log(`${w}px: checked ${ids.length + 3} pages`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `${fails} problem(s)` : 'All good');
  process.exit(fails ? 1 : 0);
})();
