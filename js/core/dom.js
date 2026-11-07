// DOM helpers: h() element builder, inline icons, toast, clipboard, bottom sheets.
const SVGNS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'text', 'defs', 'linearGradient', 'stop', 'clipPath', 'ellipse', 'tspan']);
const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'textContent', 'readOnly', 'multiple', 'indeterminate', 'open']);

export function h(tag, attrs, ...kids) {
  const svg = SVG_TAGS.has(tag);
  const el = svg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') svg ? el.setAttribute('class', v) : (el.className = v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- icons (24×24, stroked) ---------- */
const ICONS = {
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM20 20l-4.8-4.8',
  star: 'M12 3.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.62 6.9 19.3l.98-5.68L3.75 9.6l5.7-.83z',
  swap: 'M7 4v15M7 4L4 7M7 4l3 3M17 20V5M17 20l-3-3M17 20l3-3',
  swapH: 'M4 7h15M19 7l-3-3M19 7l-3 3M20 17H5M5 17l3-3M5 17l3 3',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  refresh: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  edit: 'M4 20h4l10.5-10.5a2.12 2.12 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5h11l1-12.5M9 7V4h6v3',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  location: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2',
  info: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 11v5.5M12 7.8v.01',
  share: 'M12 3.5v11M8 7l4-4 4 4M6 11H5v9.5h14V11h-1',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  dice: 'M5 5h14v14H5zM9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14M16 5v14',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  globe: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5M12 3.5C9.5 6.1 8.5 8.9 8.5 12s1 5.9 3.5 8.5',
};
export function icon(name, cls = 'i') {
  const s = h('svg', { class: cls, viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  const d = ICONS[name] || ICONS.info;
  s.append(h('path', { d }));
  if (name === 'more') s.querySelector('path').setAttribute('stroke-width', '3');
  return s;
}
export function starIcon(filled) {
  const s = icon('star', 'i star' + (filled ? ' on' : ''));
  return s;
}

/* ---------- toast ---------- */
let toastEl, toastTimer;
export function toast(msg, ms = 1600) {
  if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- clipboard ---------- */
export async function copyText(text, label) {
  const s = String(text).replace(/ | /g, ' ');
  let ok = false;
  try { await navigator.clipboard.writeText(s); ok = true; } catch {
    try {
      const ta = h('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' } });
      ta.value = s; document.body.append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
    } catch { ok = false; }
  }
  toast(ok ? `Copied ${label ?? s}` : 'Copy not available');
  return ok;
}

/* ---------- bottom sheet (dialog) ---------- */
export function openSheet({ title, body, onClose, wide = false, actions }) {
  const close = () => dlg.close();
  const head = h('header', { class: 'sheet-head' },
    h('h2', { class: 'sheet-title' }, title || ''),
    actions || null,
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close')));
  const card = h('div', { class: 'sheet-card' + (wide ? ' wide' : '') }, head, h('div', { class: 'sheet-body' }, body));
  const dlg = h('dialog', { class: 'sheet' }, card);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('locked'); dlg.remove(); onClose?.(); });
  document.body.append(dlg);
  document.documentElement.classList.add('locked');
  dlg.showModal();
  // Don't pop the keyboard on touch devices unless the sheet asks for it.
  if (!dlg.querySelector('[autofocus]')) dlg.focus?.();
  return { el: dlg, card, close };
}

/** Confirm via sheet. Resolves true/false. */
export function confirmSheet(title, text, okLabel = 'OK', danger = false) {
  return new Promise(res => {
    let result = false;
    const s = openSheet({
      title,
      body: h('div', { class: 'stack' },
        text ? h('p', { class: 'muted' }, text) : null,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn', type: 'button', onclick: () => s.close() }, 'Cancel'),
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => { result = true; s.close(); } }, okLabel))),
      onClose: () => res(result),
    });
  });
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Normalize text for search: lowercase, no accents. */
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
