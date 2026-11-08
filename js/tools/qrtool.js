// QR code generator: link/text, Wi-Fi, contact, email, SMS. Made on the device; nothing is sent anywhere.
import { h, icon, toast } from '../core/dom.js';
import { seg, row, toggle, selectEl } from '../core/ui.js';
import { encodeText, toSVG } from '../lib/qr.js';

const esc = s => String(s || '').replace(/([\\;,:"])/g, '\\$1');
export function wifiPayload({ ssid, pass, sec = 'WPA', hidden = false }) {
  return `WIFI:T:${sec === 'none' ? 'nopass' : sec};S:${esc(ssid)};${sec === 'none' ? '' : `P:${esc(pass)};`}${hidden ? 'H:true;' : ''};`;
}
export function vcardPayload({ first, last, phone, email, org, url }) {
  const v = s => String(s || '').replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCARD', 'VERSION:3.0', `N:${v(last)};${v(first)};;;`, `FN:${v([first, last].filter(Boolean).join(' '))}`,
    org ? `ORG:${v(org)}` : null, phone ? `TEL;TYPE=CELL:${v(phone)}` : null, email ? `EMAIL:${v(email)}` : null, url ? `URL:${v(url)}` : null, 'END:VCARD'].filter(Boolean).join('\n');
}
export function mailPayload({ to, subject, body }) {
  const q = [subject ? 'subject=' + encodeURIComponent(subject) : '', body ? 'body=' + encodeURIComponent(body) : ''].filter(Boolean).join('&');
  return `mailto:${to || ''}${q ? '?' + q : ''}`;
}
export const smsPayload = ({ number, message }) => `SMSTO:${number || ''}:${message || ''}`;

function mount(root, ctx) {
  const st = Object.assign({ type: 'text', ecl: 'M', f: { text: 'https://hichamabd.github.io/NaNter/', ssid: '', pass: '', sec: 'WPA', hidden: false, first: '', last: '', phone: '', email: '', org: '', url: '', to: '', subject: '', body: '', number: '', message: '' } }, ctx.state || {});
  const save = () => ctx.save(st);
  const fields = h('div', { class: 'card form' });
  const preview = h('div', { class: 'qr-box', role: 'img', 'aria-label': 'QR code' });
  const info = h('p', { class: 'fact qr-info' });
  const shareB = h('button', { class: 'btn cat', type: 'button', onclick: () => share() }, icon('share'), 'Share / save image');
  const svgB = h('button', { class: 'btn', type: 'button', onclick: () => downloadSVG() }, 'SVG');
  root.append(h('div', { class: 'seg-scroll-wrap' }, seg([['text', 'Link'], ['wifi', 'Wi-Fi'], ['contact', 'Contact'], ['email', 'Email'], ['sms', 'SMS']], st.type, v => { st.type = v; drawFields(); upd(); }, { cls: 'qr-types' })),
    fields, preview, info, h('div', { class: 'row-btns', style: { justifyContent: 'center' } }, shareB, svgB),
    h('div', { class: 'card form', style: { marginTop: '14px' } }, row('Error correction', seg([['L', 'L'], ['M', 'M'], ['Q', 'Q'], ['H', 'H']], st.ecl, v => { st.ecl = v; upd(); }), { hint: 'Higher survives dirt and logos, but makes a denser code' })),
    h('p', { class: 'note' }, 'Generated on your phone: nothing (not even your Wi-Fi password) leaves the device. Test the code with your camera before printing it.'));

  const input = (key, label, { type = 'text', area = false, ph = '', inputmode } = {}) => {
    const el = area ? h('textarea', { class: 'text-area', rows: 4, placeholder: ph, 'aria-label': label }) : h('input', { class: 'text-in', type, placeholder: ph, inputmode, autocomplete: 'off', autocapitalize: type === 'text' ? 'sentences' : 'off', spellcheck: 'false', 'aria-label': label });
    el.value = st.f[key] || '';
    el.addEventListener('input', () => { st.f[key] = el.value; upd(); });
    return row(label, el, { stack: true });
  };
  function drawFields() {
    const f = st.f;
    let kids;
    if (st.type === 'text') kids = [input('text', 'Link or text', { area: true, ph: 'https://… or any text' })];
    if (st.type === 'wifi') kids = [input('ssid', 'Network name (SSID)'), input('pass', 'Password', { ph: 'as written on the router' }),
      row('Security', selectEl([['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['none', 'None (open)']], f.sec, v => { f.sec = v; upd(); })),
      h('div', { class: 'frow toggle-row' }, toggle('Hidden network', f.hidden, v => { f.hidden = v; upd(); }))];
    if (st.type === 'contact') kids = [input('first', 'First name'), input('last', 'Last name'), input('phone', 'Phone', { type: 'tel', inputmode: 'tel' }), input('email', 'Email', { type: 'email' }), input('org', 'Company'), input('url', 'Website', { type: 'url' })];
    if (st.type === 'email') kids = [input('to', 'To', { type: 'email' }), input('subject', 'Subject'), input('body', 'Message', { area: true })];
    if (st.type === 'sms') kids = [input('number', 'Phone number', { type: 'tel', inputmode: 'tel' }), input('message', 'Message', { area: true })];
    fields.replaceChildren(...kids);
  }
  function payload() {
    const f = st.f;
    if (st.type === 'text') return f.text.trim();
    if (st.type === 'wifi') return f.ssid ? wifiPayload(f) : '';
    if (st.type === 'contact') return f.first || f.last || f.phone || f.email ? vcardPayload(f) : '';
    if (st.type === 'email') return f.to ? mailPayload(f) : '';
    if (st.type === 'sms') return f.number ? smsPayload(f) : '';
    return '';
  }
  let current = null;
  function upd() {
    save();
    const text = payload();
    if (!text) { current = null; preview.replaceChildren(h('p', { class: 'muted' }, 'Fill in the fields to make a code.')); info.textContent = ''; shareB.disabled = svgB.disabled = true; return; }
    try {
      current = encodeText(text, st.ecl);
      preview.innerHTML = toSVG(current);
      info.textContent = `Version ${current.version} · ${current.size} × ${current.size} modules · ${new TextEncoder().encode(text).length} bytes`;
      shareB.disabled = svgB.disabled = false;
    } catch (e) { current = null; preview.replaceChildren(h('p', { class: 'muted' }, e.message)); shareB.disabled = svgB.disabled = true; }
  }
  function toPNG(px = 1024) {
    const n = current.size + 8, scale = Math.floor(px / n);
    const c = document.createElement('canvas'); c.width = c.height = n * scale;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    for (let y = 0; y < current.size; y++) for (let x = 0; x < current.size; x++) if (current.modules[y][x]) g.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
  async function share() {
    if (!current) return;
    const blob = await toPNG();
    const file = new File([blob], 'qr-code.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'QR code' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = h('a', { href: URL.createObjectURL(blob), download: 'qr-code.png' }); document.body.append(a); a.click(); a.remove();
    toast('Image saved');
  }
  function downloadSVG() {
    if (!current) return;
    const a = h('a', { href: URL.createObjectURL(new Blob([toSVG(current)], { type: 'image/svg+xml' })), download: 'qr-code.svg' });
    document.body.append(a); a.click(); a.remove();
  }
  drawFields(); upd();
}

export const tools = { qr: { mount } };
