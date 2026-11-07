// NaNter app shell: hash router, home (search, favorites, recents, categories), tool pages, settings.
import { h, $, icon, starIcon, toast, copyText, openSheet, confirmSheet, norm, isIOS, isStandalone, debounce } from './core/dom.js';
import { settings, setSetting, applySettings, resetSettings, favorites, setFavorites, isFav, toggleFav, recents, pushRecent, clearRecents, toolState, saveToolState, clearToolState, load, save, clearAll, on, LANG } from './core/store.js';
import { selectEl, seg, iconBtn } from './core/ui.js';
import { CATS, TOOLS, toolById, glyphOf } from './tools/registry.js';
import { fmt } from './core/num.js';

applySettings();
const view = $('#view');
let cleanups = [];
let homeScroll = 0;
let navDepth = 0; // how many in-app pages we pushed (so Back can use history)

/* ---------- routing ---------- */
export function go(hash, { replace = false } = {}) {
  if (location.hash === hash) return route();
  if (replace) { history.replaceState(null, '', hash); route(); }
  else { navDepth++; location.hash = hash; }
}
function back() {
  if (navDepth > 0) { navDepth--; history.back(); }
  else go('#/', { replace: true });
}
window.addEventListener('hashchange', route);

function route() {
  cleanups.forEach(fn => { try { fn(); } catch { } });
  cleanups = [];
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  if (parts[0] === 't' && toolById(parts[1])) return renderTool(toolById(parts[1]), params);
  if (parts[0] === 'settings') return renderSettings();
  if (parts[0] === 'about') return renderAbout();
  renderHome(params);
}

function glyphEl(t, extra = '') {
  const g = glyphOf(t);
  return h('span', { class: 'glyph ' + extra, dataset: { len: String(Math.min(6, [...g].length)), cat: t.cat }, 'aria-hidden': 'true' }, g);
}
function tile(t) {
  return h('a', { class: 'tile', href: '#/t/' + t.id, dataset: { cat: t.cat }, onclick: e => { e.preventDefault(); openTool(t.id); } },
    glyphEl(t), h('span', { class: 'tile-name' }, t.name));
}
export function openTool(id, params) {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  if (location.hash.startsWith('#/') && location.hash.length <= 2 || location.hash === '') homeScroll = window.scrollY;
  go('#/t/' + id + q);
}

/* ---------- home ---------- */
function logo() {
  return h('img', { class: 'brand-mark', src: 'icons/mark.svg', alt: '', width: 34, height: 34 });
}

function renderHome(params = {}) {
  document.title = 'NaNter';
  const searchIn = h('input', {
    class: 'search-in', type: 'search', placeholder: 'Search, or type “5 ft in cm”', 'aria-label': 'Search tools or ask a conversion',
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go',
  });
  const clearBtn = h('button', { class: 'search-clear', type: 'button', 'aria-label': 'Clear search', hidden: true, onclick: () => { searchIn.value = ''; onSearch(); searchIn.focus(); } }, icon('close'));
  const results = h('div', { class: 'sr-list', hidden: true });
  const main = h('div', { class: 'home-main' });
  const page = h('div', { class: 'wrap home' },
    h('header', { class: 'home-head' },
      h('div', { class: 'brand' }, logo(), h('span', null, 'Na', h('b', null, 'N'), 'ter')),
      iconBtn('settings', () => go('#/settings'), 'Settings')),
    h('div', { class: 'search' }, h('div', { class: 'search-box' }, icon('search'), searchIn, clearBtn)),
    results, main);
  view.replaceChildren(page);

  // --- main content ---
  const favIds = favorites().filter(id => toolById(id));
  const favSec = h('section', { class: 'sec favs' },
    h('h2', { class: 'sec-title' }, 'Favorites', h('button', { class: 'link', type: 'button', onclick: editFavorites }, favIds.length ? 'Edit' : '')),
    favIds.length ? h('div', { class: 'grid' }, favIds.map(id => tile(toolById(id)))) : h('p', { class: 'empty-favs' }, 'Tap ☆ in any tool to pin it here.'));
  main.append(favSec);

  const rec = recents().filter(id => toolById(id) && !favIds.includes(id)).slice(0, 6);
  if (rec.length) {
    main.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-title' }, 'Recent'),
      h('div', { class: 'recent-row' }, rec.map(id => {
        const t = toolById(id);
        return h('button', { class: 'pill', type: 'button', dataset: { cat: t.cat }, onclick: () => openTool(id) }, glyphEl(t), t.name);
      }))));
  }
  const tip = installTip();
  if (tip) main.append(tip);
  for (const c of CATS) {
    const list = TOOLS.filter(t => t.cat === c.id);
    main.append(h('section', { class: 'sec', dataset: { cat: c.id } },
      h('h2', { class: 'sec-title' }, h('span', { class: 'dot' }), c.name, h('span', { class: 'faint', style: { textTransform: 'none', fontWeight: 400 } }, ' · ' + list.length)),
      h('div', { class: 'grid' }, list.map(tile))));
  }
  main.append(h('p', { class: 'footnote' }, `${TOOLS.length} tools · no ads, no tracking, works offline · `, h('a', { href: '#/about' }, 'About')));

  // --- search ---
  let quick = null;
  const loadQuick = () => quick || (quick = import('./lib/quick.js'));
  searchIn.addEventListener('focus', loadQuick, { once: true });
  const onSearch = () => {
    const q = searchIn.value;
    clearBtn.hidden = !q;
    sessionStorage.setItem('nanter:q', q);
    if (!q.trim()) { results.hidden = true; main.hidden = false; renderExamples(); return; }
    main.hidden = true; results.hidden = false;
    renderResults(q);
  };
  const renderExamples = () => {
    if (document.activeElement !== searchIn) { results.hidden = true; main.hidden = false; return; }
    results.hidden = false;
    const ex = ['5 ft 11 in cm', '100 usd in eur', '20% of 85', '72 f', 'days until 25 dec', 'today + 90 days', 'time in tokyo', '3 cups flour in g', '0xff', '1700000000'];
    results.replaceChildren(h('div', { class: 'sec-title' }, 'Try typing'), h('div', { class: 'examples' }, ex.map(e => h('button', { class: 'ex', type: 'button', onpointerdown: ev => ev.preventDefault(), onclick: () => { searchIn.value = e; onSearch(); } }, e))));
  };
  let seq = 0;
  async function renderResults(q) {
    const my = ++seq;
    const tools = searchTools(q);
    let answers = [];
    try { const m = await loadQuick(); answers = await m.answer(q); } catch (e) { console.warn(e); }
    if (my !== seq) return;
    const nodes = [];
    for (const a of answers.slice(0, 3)) {
      const t = a.tool && toolById(a.tool);
      nodes.push(h('button', {
        class: 'answer', type: 'button', dataset: { cat: t?.cat || 'units' },
        onclick: () => (t ? openTool(a.tool, a.params) : copyText(a.copy ?? a.value)),
      },
        t ? h('span', { class: 'a-tag' }, t.name) : null,
        h('div', { class: 'a-q' }, a.query),
        h('div', { class: 'a-v' }, a.value),
        a.sub ? h('div', { class: 'a-sub' }, a.sub) : null,
        h('div', { class: 'a-open' },
          h('span', { role: 'button', tabindex: '0', onclick: e => { e.stopPropagation(); copyText(a.copy ?? a.value); }, style: { marginRight: '14px', color: 'var(--accent)' } }, 'Copy'),
          t ? h('span', null, 'Open ' + t.name) : null, t ? icon('next') : null)));
    }
    if (tools.length) nodes.push(h('div', { class: 'tool-list' }, tools.slice(0, 12).map(t =>
      h('button', { class: 'tool-item', type: 'button', dataset: { cat: t.cat }, onclick: () => openTool(t.id) },
        glyphEl(t), h('span', { class: 'ti-text' }, h('b', null, t.name), h('small', null, t.desc)), icon('next')))));
    if (!nodes.length) nodes.push(h('p', { class: 'sr-empty' }, 'Nothing found. Try “10 km in miles”, “15% of 80”, “days until 1/1” or a tool name.'));
    results.replaceChildren(...nodes);
    results._first = answers[0]?.tool ? () => openTool(answers[0].tool, answers[0].params) : tools[0] ? () => openTool(tools[0].id) : null;
  }
  searchIn.addEventListener('input', onSearch);
  searchIn.addEventListener('focus', () => { if (!searchIn.value) renderExamples(); });
  searchIn.addEventListener('blur', () => setTimeout(() => { if (!searchIn.value.trim()) { results.hidden = true; main.hidden = false; } }, 150));
  searchIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); results._first?.(); } if (e.key === 'Escape') { searchIn.value = ''; onSearch(); searchIn.blur(); } });

  const prevQ = params.q ?? sessionStorage.getItem('nanter:q');
  if (prevQ) { searchIn.value = prevQ; onSearch(); }
  requestAnimationFrame(() => window.scrollTo(0, prevQ ? 0 : homeScroll));
}

/** Fuzzy tool search over name, description and keywords (accent-insensitive). */
export function searchTools(q) {
  const n = norm(q);
  if (!n) return [];
  const words = n.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const t of TOOLS) {
    const name = norm(t.name), desc = norm(t.desc), kw = norm(t.kw);
    let score = 0;
    if (name === n) score += 200;
    if (name.startsWith(n)) score += 120;
    else if (name.split(/\s+/).some(w => w.startsWith(n))) score += 90;
    let all = true;
    for (const w of words) {
      let s = 0;
      if (name.includes(w)) s = 40;
      else if (new RegExp('(^|[\\s/(])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(kw)) s = 25;
      else if (desc.includes(w)) s = 15;
      else if (kw.includes(w)) s = 8;
      if (!s) all = false;
      score += s;
    }
    if (!all) score = score > 100 ? score : 0;
    if (score) scored.push([score, t]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(x => x[1]);
}

function installTip() {
  if (!isIOS() || isStandalone() || load('tipDone', false)) return null;
  const el = h('div', { class: 'install-tip' }, icon('share'),
    h('p', null, h('b', null, 'Install NaNter: '), 'tap ', h('b', null, 'Share'), ' then ', h('b', null, 'Add to Home Screen'), '. It opens full-screen and works offline.'),
    iconBtn('close', () => { save('tipDone', true); el.remove(); }, 'Dismiss', 'x'));
  return el;
}

function editFavorites() {
  let list = favorites().filter(id => toolById(id));
  const body = h('div');
  const draw = () => {
    body.replaceChildren(
      list.length ? h('div', { class: 'pick-list' }, list.map((id, i) => {
        const t = toolById(id);
        return h('div', { class: 'pick', dataset: { cat: t.cat } }, glyphEl(t, 'sm'), h('span', { class: 'p-main' }, h('b', null, t.name)),
          h('span', { class: 'edit-tools' },
            iconBtn('arrowUp', () => { if (i) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); } }, 'Move up'),
            iconBtn('arrowDown', () => { if (i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); } }, 'Move down'),
            iconBtn('trash', () => { list.splice(i, 1); draw(); }, 'Remove', 'del')));
      })) : h('p', { class: 'muted' }, 'No favorites. Open a tool and tap ☆ to add it.'),
      h('p', { class: 'note', style: { marginTop: '12px' } }, 'Tip: the ☆ in each tool adds or removes it.'));
  };
  draw();
  openSheet({ title: 'Edit favorites', body, onClose: () => { setFavorites(list); if (!location.hash.includes('/t/')) renderHome(); } });
}

/* ---------- tool page ---------- */
async function renderTool(t, params) {
  document.title = t.name + ' · NaNter';
  pushRecent(t.id);
  const star = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Favorite', 'aria-pressed': String(isFav(t.id)) }, starIcon(isFav(t.id)));
  star.onclick = () => {
    const now = toggleFav(t.id);
    star.replaceChildren(starIcon(now)); star.setAttribute('aria-pressed', String(now));
    toast(now ? 'Added to favorites' : 'Removed from favorites');
  };
  const more = iconBtn('more', () => toolMenu(t), 'More');
  const bar = h('header', { class: 'bar' },
    h('button', { class: 'bar-back', type: 'button', onclick: back, 'aria-label': 'Back to tools' }, icon('back'), h('span', null, 'Tools')),
    h('div', { class: 'bar-title' }, t.name),
    h('div', { class: 'bar-actions' }, star, more));
  const body = h('div', { class: 'tool-body' });
  const head = h('div', { class: 'page-head' }, h('div', { class: 'page-cat' }, CATS.find(c => c.id === t.cat).name), h('h1', { class: 'page-title' }, t.name));
  const page = h('div', { class: 'wrap tool', dataset: { cat: t.cat, tool: t.id } }, bar, head, body);
  view.replaceChildren(page);
  window.scrollTo(0, 0);
  const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  const ctx = makeCtx(t, params);
  try {
    const mod = await import(`./tools/${t.mod}.js`);
    if (!page.isConnected) return;
    const impl = mod.tools[t.id];
    if (!impl) throw new Error('Tool not found: ' + t.id);
    ctx.impl = impl;
    if (impl.desc) head.append(h('p', { class: 'page-desc' }, impl.desc));
    if (impl.mount) await impl.mount(body, ctx);
    else {
      const { mountForm } = await import('./core/form.js');
      ctx.form = mountForm(body, impl, ctx);
    }
    if (impl.foot) body.append(h('p', { class: 'note' }, impl.foot));
    // Deep-link values are applied once; drop them from the URL so a reload keeps your edits.
    if (Object.keys(params).length) history.replaceState(null, '', '#/t/' + t.id);
  } catch (e) {
    console.error(e);
    body.append(h('div', { class: 'card pad' }, h('p', null, 'This tool failed to load.'), h('p', { class: 'muted' }, String(e.message || e)),
      h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Reload')));
  }
}

function makeCtx(t, params) {
  return {
    tool: t,
    params: Object.keys(params).length ? params : null,
    state: Object.keys(params).length ? Object.assign({}, toolState(t.id) || {}, params) : toolState(t.id),
    save: debounce(st => saveToolState(t.id, st), 200),
    saveNow: st => saveToolState(t.id, st),
    onCleanup: fn => cleanups.push(fn),
    open: openTool,
    settings,
  };
}

function toolMenu(t) {
  const s = openSheet({
    title: t.name,
    body: h('div', { class: 'pick-list' },
      h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); clearToolState(t.id); history.replaceState(null, '', '#/t/' + t.id); route(); toast('Reset'); } }, icon('undo'), h('span', { class: 'p-main' }, h('b', null, 'Reset this tool'), h('small', null, 'Clear inputs and restore defaults'))),
      h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); copyText(location.href.split('?')[0], 'link'); } }, icon('link'), h('span', { class: 'p-main' }, h('b', null, 'Copy link to this tool'))),
      h('button', { class: 'pick', type: 'button', onclick: () => { s.close(); go('#/settings'); } }, icon('settings'), h('span', { class: 'p-main' }, h('b', null, 'Settings'), h('small', null, 'Currency, units, precision, theme')))),
  });
}

/* ---------- settings ---------- */
async function renderSettings() {
  document.title = 'Settings · NaNter';
  const { countryName, COUNTRY_CURRENCY } = await import('./data/geo.js');
  const { currencyName, CURRENCY_LIST } = await import('./lib/currencies.js');
  const bar = h('header', { class: 'bar scrolled' },
    h('button', { class: 'bar-back', type: 'button', onclick: back }, icon('back'), h('span', null, 'Tools')),
    h('div', { class: 'bar-title' }, 'Settings'), h('div'));
  const rowEl = (label, ctl, sub) => h('div', { class: 'set-row' }, h('span', null, label, sub ? h('small', null, sub) : null), h('div', { class: 'ctl' }, ctl));
  const curOpts = CURRENCY_LIST.filter(c => c.iso).map(c => [c.code, `${c.code} · ${currencyName(c.code)}`]).sort((a, b) => a[0].localeCompare(b[0]));
  const countries = Object.keys(COUNTRY_CURRENCY).map(cc => [cc, countryName(cc, LANG)]).sort((a, b) => a[1].localeCompare(b[1]));
  const sample = h('small');
  const updSample = () => { sample.textContent = 'Example: ' + fmt(1234567.891, { sig: 10 }); };
  updSample();
  const numLocales = [['auto', 'Automatic (' + LANG + ')'], ['en-US', '1,234.56'], ['fr-FR', '1 234,56'], ['de-DE', '1.234,56'], ['de-CH', '1’234.56'], ['en-IN', '12,34,567.8 (Indian)']];
  const page = h('div', { class: 'wrap' }, bar,
    h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'Settings')),
    h('h3', { class: 'sec-title' }, 'Region'),
    h('div', { class: 'card set-list' },
      rowEl('Home currency', selectEl(curOpts, settings.currency, v => setSetting('currency', v), { aria: 'Home currency' }), 'Default in money tools'),
      rowEl('Country', selectEl(countries, settings.country, v => { setSetting('country', v); }, { aria: 'Country' }), 'Public holidays & tax presets'),
      rowEl('Units', seg([['metric', 'Metric'], ['uk', 'UK'], ['us', 'US']], settings.system, v => setSetting('system', v), { aria: 'Measurement system' }), 'Default units in calculators'),
      rowEl('Week starts on', seg([[1, 'Mon'], [0, 'Sun'], [6, 'Sat']], settings.weekStart, v => setSetting('weekStart', v)), null),
      rowEl('Clock', seg([[false, '24 h'], [true, '12 h']], settings.hour12, v => setSetting('hour12', v)), null)),
    h('h3', { class: 'sec-title' }, 'Numbers'),
    h('div', { class: 'card set-list' },
      rowEl('Number format', selectEl(numLocales, settings.numLocale, v => { setSetting('numLocale', v); updSample(); }), sample),
      rowEl('Precision', selectEl([[4, '4 digits'], [6, '6 digits'], [8, '8 digits'], [10, '10 digits'], [12, '12 digits'], [15, '15 digits']], settings.sig, v => { setSetting('sig', +v); updSample(); }), 'Significant digits in results')),
    h('h3', { class: 'sec-title' }, 'Appearance'),
    h('div', { class: 'card set-list' },
      rowEl('Theme', seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], settings.theme, v => setSetting('theme', v)), null)),
    h('h3', { class: 'sec-title' }, 'Data'),
    h('div', { class: 'card set-list' },
      h('button', { class: 'set-row', type: 'button', onclick: () => { clearRecents(); toast('Recent tools cleared'); } }, h('span', null, 'Clear recent tools'), icon('next')),
      h('button', { class: 'set-row', type: 'button', onclick: async () => { if (await confirmSheet('Reset settings?', 'Currency, units and formats go back to the defaults for your device.', 'Reset')) { resetSettings(); renderSettings(); } } }, h('span', null, 'Reset settings'), icon('next')),
      h('button', { class: 'set-row danger', type: 'button', onclick: async () => { if (await confirmSheet('Erase everything?', 'Favorites, saved inputs, countdowns, time zones and cached rates are deleted from this device.', 'Erase', true)) { clearAll(); location.hash = '#/'; location.reload(); } } }, h('span', null, 'Erase all data on this device'))),
    h('h3', { class: 'sec-title' }, 'About'),
    h('div', { class: 'card set-list' },
      h('button', { class: 'set-row', type: 'button', onclick: () => go('#/about') }, h('span', null, 'About NaNter', h('small', null, 'Data sources, privacy, install')), icon('next'))));
  view.replaceChildren(page);
  window.scrollTo(0, 0);
}

function renderAbout() {
  document.title = 'About · NaNter';
  const bar = h('header', { class: 'bar scrolled' },
    h('button', { class: 'bar-back', type: 'button', onclick: back }, icon('back'), h('span', null, 'Back')),
    h('div', { class: 'bar-title' }, 'About'), h('div'));
  view.replaceChildren(h('div', { class: 'wrap' }, bar,
    h('div', { class: 'page-head' }, h('div', { class: 'brand' }, logo(), h('span', null, 'Na', h('b', null, 'N'), 'ter')), h('p', { class: 'page-desc' }, `A pocket toolbox of ${TOOLS.length} converters and calculators. No ads, no accounts, no tracking.`)),
    h('div', { class: 'card pad about' },
      h('p', null, h('b', null, 'Private. '), 'Everything is computed on your device. Your inputs, favorites and countdowns stay in this browser only.'),
      h('p', null, h('b', null, 'Offline. '), 'After the first visit the whole app works without a connection. Exchange rates are cached with their date.'),
      h('p', null, h('b', null, 'Search does maths. '), 'Type things like ', h('span', { class: 'kbd' }, '5 ft 11 in cm'), ', ', h('span', { class: 'kbd' }, '100 usd in eur'), ', ', h('span', { class: 'kbd' }, '15% of 80'), ', ', h('span', { class: 'kbd' }, 'days until 25/12'), ', ', h('span', { class: 'kbd' }, '3pm london in tokyo'), '.'),
      h('p', null, h('b', null, 'Number fields accept maths '), '(12*3, 1/3, 1 3/8, 15%) and both 1,5 and 1.5.')),
    h('h3', { class: 'sec-title' }, 'Data sources'),
    h('div', { class: 'card pad about' },
      h('p', null, 'Exchange rates: ', h('a', { href: 'https://github.com/fawazahmed0/exchange-api', target: '_blank', rel: 'noopener' }, 'fawazahmed0/exchange-api'), ' (daily, 200+ currencies, crypto & metals), ', h('a', { href: 'https://www.exchangerate-api.com', target: '_blank', rel: 'noopener' }, 'ExchangeRate-API'), ' (fallback) and ', h('a', { href: 'https://frankfurter.dev', target: '_blank', rel: 'noopener' }, 'Frankfurter'), ' (European Central Bank reference rates, history since 1999).'),
      h('p', null, 'Public holidays: ', h('a', { href: 'https://date.nager.at', target: '_blank', rel: 'noopener' }, 'Nager.Date'), '.'),
      h('p', null, 'Time zones and calendars come from your device (Intl). Sunrise and sunset use the NOAA solar equations.'),
      h('p', null, 'Results are for everyday use. For health, money and legal decisions, double-check with a professional.')),
    h('h3', { class: 'sec-title' }, 'Install on iPhone'),
    h('div', { class: 'card pad about' },
      h('p', null, 'Open this page in Safari, tap ', h('b', null, 'Share'), ', then ', h('b', null, 'Add to Home Screen'), '. NaNter then opens full-screen with its own icon.')),
    h('p', { class: 'footnote' }, 'NaNter · ', h('a', { href: 'https://github.com/hichamAbd/NaNter', target: '_blank', rel: 'noopener' }, 'source on GitHub'))));
  window.scrollTo(0, 0);
}

/* ---------- global behaviours ---------- */
// Tap anywhere outside a field to dismiss the iOS keyboard.
document.addEventListener('click', e => {
  const a = document.activeElement;
  if (!a || a === document.body) return;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if (e.target.closest('input, textarea, select, label, .num, .pm, .sel-wrap, .chip, button')) return;
  a.blur();
}, true);

on('settings', k => { if (k === 'theme') return; });

// Offline: register the service worker; reload once when an update takes over.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => { });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

route();
