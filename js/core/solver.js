// "Fill in any two, get the rest": rows you typed in are inputs, the others are calculated.
import { h } from './dom.js';
import { unitInput, results } from './ui.js';

const sameVal = (a, b) => (a == null && b == null) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)));

/**
 * vars: [{ id, label, units:[unit objs], unit: default unit id, presets:[[base,label,unitId]] }]
 * solve(known: {id: base}) → {id: base} for every var
 * extra(values, known, state) → result items shown below
 * defaults: { known: [ids], vals: {id: base}, units: {id: unitId} }
 */
export function mountSolver(root, ctx, { vars, need = 2, solve, extra, defaults = {}, hint = 'Fill in any two: the others are calculated.' }) {
  const st = Object.assign({ known: defaults.known || vars.slice(0, need).map(v => v.id), vals: { ...(defaults.vals || {}) }, units: { ...(defaults.units || {}) } }, ctx.state || {});
  const card = h('div', { class: 'card form solver' });
  const out = results();
  const rows = {};
  root.append(h('p', { class: 'fact' }, hint), card, out);
  const save = () => ctx.save(st);

  const markKnown = id => {
    st.known = st.known.filter(k => k !== id);
    if (Number.isFinite(st.vals[id])) st.known.push(id);
    while (st.known.length > need) st.known.shift();
  };
  const handler = v => (b, u) => {
    const unitOnly = st.units[v.id] !== u && sameVal(b, st.vals[v.id]);
    st.units[v.id] = u;
    if (unitOnly) { save(); return; }
    st.vals[v.id] = b;
    markKnown(v.id);
    update(v.id);
  };
  const makeInput = v => unitInput({ units: v.units, unit: st.units[v.id] || v.unit, base: st.vals[v.id] ?? null, aria: v.label, onChange: handler(v) });

  for (const v of vars) {
    const badge = h('small', { class: 'calc-badge' });
    const inp = makeInput(v);
    const ctl = h('div', { class: 'frow-ctl' }, inp);
    const r = h('div', { class: 'frow' }, h('div', { class: 'frow-label' }, h('span', null, v.label), badge), ctl);
    rows[v.id] = { r, inp, ctl, badge, v };
    if (v.presets) {
      r.append(h('div', { class: 'chips presets' }, v.presets.map(([b, label, u]) => h('button', {
        type: 'button', class: 'chip', onclick: () => {
          st.vals[v.id] = b; if (u) st.units[v.id] = u;
          markKnown(v.id);
          const fresh = makeInput(v);
          rows[v.id].inp.replaceWith(fresh); rows[v.id].inp = fresh;
          update(v.id);
        },
      }, label))));
    }
    card.append(r);
  }

  function update(editing) {
    const known = {};
    st.known.forEach(k => { if (Number.isFinite(st.vals[k])) known[k] = st.vals[k]; });
    let solved = null;
    if (Object.keys(known).length >= need) { try { solved = solve(known); } catch { solved = null; } }
    for (const id in rows) {
      const isKnown = id in known;
      rows[id].r.classList.toggle('calc', !isKnown);
      rows[id].badge.textContent = isKnown ? '' : solved ? '= calculated' : '';
      if (!isKnown && id !== editing) {
        const b = solved?.[id];
        st.vals[id] = Number.isFinite(b) ? b : null;
        rows[id].inp.set(Number.isFinite(b) ? b : null);
      }
    }
    save();
    out.render(solved && extra ? extra({ ...st.vals, ...solved }, known, st) : [{ note: 'Fill in two of the values above.' }]);
  }
  update(null);
  return { st, update };
}
