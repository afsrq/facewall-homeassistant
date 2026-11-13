// Small UI helpers: elements, press/long-press, sheets, toasts, form controls.
import { icon } from './icons.js';

export function h(tag, attrs = {}, ...kids) {
  const [name, ...cls] = tag.split('.');
  const e = document.createElement(name || 'div');
  if (cls.length) e.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  // Mouse users get a tooltip from the accessible label.
  if (attrs && attrs['aria-label'] && !attrs.title) e.title = attrs['aria-label'];
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

/** Tap + long-press on one element, without fighting native scrolling. */
export function press(el, { onTap, onLong, longMs = 520 } = {}) {
  let t = null, sx = 0, sy = 0, fired = false, active = false;
  const cancel = () => { clearTimeout(t); t = null; active = false; el.classList.remove('pressing'); };
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    active = true; fired = false; sx = e.clientX; sy = e.clientY;
    el.classList.add('pressing');
    if (onLong) t = setTimeout(() => { fired = true; el.classList.remove('pressing'); navigator.vibrate?.(10); onLong(e); }, longMs);
  });
  el.addEventListener('pointermove', (e) => { if (active && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointerup', (e) => { if (!active) return; const wasFired = fired; cancel(); if (!wasFired && onTap) onTap(e); });
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', () => { if (active && !fired) cancel(); });
  // Right-click does what a long press does (mouse only, so a long touch never fires it twice).
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!onLong || fired || (e.pointerType && e.pointerType !== 'mouse')) return;
    cancel(); onLong(e);
  });
}

/** Open sheets, newest last, so Esc can close the top one. */
export const openSheets = [];

/** Modal sheet. Returns { el, body, close }. */
export function sheet({ title, cls = '', onClose, actions } = {}) {
  const body = h('div.sheet-body');
  const head = h('div.sheet-head', {},
    h('div.sheet-title', { text: title || '' }),
    actions || null,
    h('button.icon-btn', { 'aria-label': 'Close', html: icon('close'), onclick: () => close() }));
  const panel = h(`div.sheet ${cls}`, {}, head, body);
  const back = h('div.sheet-backdrop', {}, panel);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('open'));
  let closed = false;
  openSheets.push(close);
  function close() {
    if (closed) return; closed = true;
    const i = openSheets.indexOf(close); if (i >= 0) openSheets.splice(i, 1);
    back.classList.remove('open');
    setTimeout(() => back.remove(), 280);
    onClose?.();
  }
  return { el: panel, body, head, close, setTitle: (t) => { head.firstChild.textContent = t; } };
}

let toastT;
export function toast(msg, kind = '') {
  let t = document.getElementById('toast-pill');
  if (!t) { t = h('div', { id: 'toast-pill' }); document.body.appendChild(t); }
  t.className = 'show ' + kind;
  t.textContent = msg;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ''; }, 2600);
}

export function toggle(checked, onchange) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = !!checked;
  input.addEventListener('change', () => onchange(input.checked));
  return h('label.switch', {}, input, h('span.switch-track', {}, h('span.switch-thumb')));
}

export function segmented(choices, value, onchange) {
  const wrap = h('div.seg');
  const render = () => {
    wrap.innerHTML = '';
    for (const c of choices) {
      wrap.append(h('button' + (String(c.v) === String(value) ? '.on' : ''), {
        text: c.label, onclick: () => { value = c.v; render(); onchange(c.v); },
      }));
    }
  };
  render();
  return wrap;
}

export function swatches(choices, value, onchange) {
  const wrap = h('div.swatches');
  const render = () => {
    wrap.innerHTML = '';
    for (const c of choices) {
      const sw = h('button.swatch' + (c.v === value ? '.on' : ''), { 'aria-label': c.label, onclick: () => { value = c.v; render(); onchange(c.v); } },
        h('span.swatch-dot', { style: { background: c.color } }),
        h('span.swatch-label', { text: c.label }));
      wrap.append(sw);
    }
  };
  render();
  return wrap;
}

export function row(label, control, sub) {
  return h('div.row', {}, h('div.row-text', {}, h('div.row-label', { text: label }), sub ? h('div.row-sub', { text: sub }) : null), control);
}

/** Native <select> of entities, grouped by domain. */
export function entitySelect(store, value, groups, onchange, noneLabel = 'None') {
  const sel = h('select.select');
  sel.append(h('option', { value: '', text: noneLabel }));
  for (const [label, domains] of groups) {
    const items = store.list(domains);
    if (!items.length) continue;
    const og = h('optgroup', { label });
    for (const s of items) {
      const area = store.area(s.entity_id);
      og.append(h('option', { value: s.entity_id, text: store.name(s.entity_id) + (area ? `  ·  ${area}` : '') }));
    }
    sel.append(og);
  }
  if (value && !store.get(value)) sel.append(h('option', { value, text: value + ' (missing)' }));
  sel.value = value || '';
  sel.addEventListener('change', () => onchange(sel.value || null));
  return sel;
}
