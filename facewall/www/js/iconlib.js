// Icon libraries: Material Design Icons (Home Assistant's set), Font Awesome Free,
// and your own icons (e.g. Font Awesome Pro SVGs) uploaded or placed in custom_icons.
// Names: "mdi:lamp", "fas:couch", "far:lightbulb", "fab:apple", "fapro:lightbulb-on".
import { loadMdi, mdiSvg, mdiNames, mdiHas, SUGGESTED } from './mdi.js';

let fa = null, faLoading = null, faAliasOf = {};
let custom = {}, customLoaded = false, customLoading = null, serverIcons = true;
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());
export const onIconsChanged = (fn) => listeners.add(fn);

export function loadFa() {
  if (fa) return Promise.resolve(fa);
  return (faLoading ||= fetch('icons/fa.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
    fa = j || { icons: {}, aliases: {} };
    // other names an icon goes by (e.g. "home" for house), for searching
    for (const [p, al] of Object.entries(fa.aliases || {})) { const m = (faAliasOf[p] = {}); for (const [a, real] of Object.entries(al)) m[real] = (m[real] ? m[real] + ' ' : '') + a; }
    return fa;
  }).catch(() => (fa = { icons: {}, aliases: {} })));
}

// ---- your own icons (server, or this browser in demo mode)
const DEMO_KEY = 'facewall-demo-icons';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '{}'); } catch { return {}; } };
const lsSet = (v) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };
export function loadCustom(force) {
  if (customLoaded && !force) return Promise.resolve(custom);
  return (customLoading = (async () => {
    try {
      const r = await fetch('api/icons/custom');
      if (!r.ok) throw new Error('no server');
      custom = (await r.json()).icons || {};
      serverIcons = true;
    } catch {
      serverIcons = false;
      custom = Object.fromEntries(Object.entries(lsGet()).map(([k, v]) => [k, { ...v, source: 'upload' }]));
    }
    customLoaded = true; customLoading = null;
    return custom;
  })());
}
export const customList = () => Object.entries(custom).map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name));
export const slugName = (t) => String(t || '').toLowerCase().replace(/\.svg$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Upload SVG files. Returns the names added. */
export async function uploadIcons(files) {
  const added = [];
  for (const file of files) {
    const name = slugName(file.name);
    const text = await file.text();
    if (!name || text.length > 300000) continue;
    if (serverIcons) {
      const r = await fetch('api/icons/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, svg: text }) });
      if (r.ok) added.push(name);
    } else {
      const clean = sanitizeSvg(text);
      if (clean) { const all = lsGet(); all[name] = clean; lsSet(all); added.push(name); }
    }
  }
  await loadCustom(true); changed();
  return added;
}
export async function deleteIcon(name) {
  if (serverIcons) await fetch('api/icons/custom/' + encodeURIComponent(name), { method: 'DELETE' });
  else { const all = lsGet(); delete all[name]; lsSet(all); }
  await loadCustom(true); changed();
}

/** Load every library (in the background at start). */
export function loadIcons() { return Promise.all([loadMdi(), loadFa(), loadCustom()]).then(changed); }

// ---- rendering
const split = (name) => {
  const m = String(name || '').trim().match(/^([a-z]+):(.+)$/);
  return m ? [m[1], m[2]] : ['mdi', String(name || '').trim()];
};
/** SVG markup for an icon name, or null if unknown or its library hasn't loaded yet. */
export function iconSvg(name, cls = '') {
  const [prefix, id] = split(name);
  if (prefix === 'mdi') return mdiSvg(id, cls);
  if (prefix === 'fapro' || prefix === 'custom') {
    const c = custom[id];
    return c ? `<svg class="ic custom ${cls}" viewBox="${c.vb}" fill="currentColor" aria-hidden="true">${c.body}</svg>` : null;
  }
  if (['fas', 'far', 'fab'].includes(prefix) && fa) {
    const real = fa.icons[prefix]?.[id] ? id : fa.aliases[prefix]?.[id];
    const ic = real && fa.icons[prefix][real];
    if (!ic) return null;
    const [w, h, d] = ic;
    const paths = Array.isArray(d) ? `<path opacity=".4" d="${d[0]}"/><path d="${d[1]}"/>` : `<path d="${d}"/>`;
    return `<svg class="ic fa ${cls}" viewBox="0 0 ${w} ${h}" fill="currentColor" aria-hidden="true">${paths}</svg>`;
  }
  return null;
}

// ---- searching (for the picker)
export const LIBRARIES = [
  { v: 'all', label: 'All' }, { v: 'mdi', label: 'Home Assistant' }, { v: 'fa', label: 'Font Awesome' }, { v: 'pro', label: 'Your icons / Pro' },
];
const FA_SUGGESTED = ['lightbulb', 'house', 'couch', 'bed', 'tv', 'fan', 'temperature-half', 'snowflake', 'fire', 'lock', 'door-open', 'shower', 'bath', 'utensils', 'mug-hot', 'car', 'music', 'gamepad', 'sun', 'moon'];
/** [{ name: 'fas:couch', label: 'couch', lib: 'Font Awesome Solid' }] */
export function searchIcons(lib, query, limit = 180) {
  let q = query.trim().toLowerCase();
  let only = null;
  const pm = q.match(/^([a-z]+):(.*)$/);
  if (pm) { only = pm[1]; q = pm[2]; }
  const words = q.split(/[\s-]+/).filter(Boolean);
  const match = (n) => words.every((w) => n.includes(w));
  const out = [];
  const want = (p) => !only || only === p;
  // Best first: exact name or alternate name, then starts-with, then whole word, then anything containing it.
  const score = (it) => {
    const names = [it.label, ...(it.aka ? it.aka.split(' ') : [])];
    if (names.some((n) => n === q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    if (names.some((n) => n.split('-').includes(q))) return 2;
    return 3;
  };
  const rank = (arr) => arr.map((it) => [score(it), it]).sort((a, b) => a[0] - b[0] || a[1].label.length - b[1].label.length).map((x) => x[1]);
  if ((lib === 'all' || lib === 'pro') && (want('fapro') || want('custom'))) {
    const items = customList().filter((c) => !q || match(c.name)).map((c) => ({ name: 'fapro:' + c.name, label: c.name, lib: c.source === 'folder' ? 'custom_icons folder' : 'Uploaded', deletable: c.source === 'upload' }));
    out.push(...rank(items));
  }
  if ((lib === 'all' || lib === 'mdi') && want('mdi')) {
    const names = q ? mdiNames().filter(match) : SUGGESTED.filter(mdiHas);
    out.push(...rank(names.map((n) => ({ name: 'mdi:' + n, label: n, lib: 'Home Assistant (MDI)' }))).slice(0, q ? limit : 999));
  }
  if ((lib === 'all' || lib === 'fa') && fa) {
    const styles = [['fas', 'Solid'], ['far', 'Regular'], ['fab', 'Brands']];
    const items = [];
    for (const [p, label] of styles) {
      if (!want(p)) continue;
      const names = Object.keys(fa.icons[p] || {});
      const hits = q ? names.filter((n) => match(n) || match(faAliasOf[p]?.[n] || '')) : FA_SUGGESTED.filter((n) => fa.icons[p]?.[n]);
      items.push(...hits.map((n) => ({ name: `${p}:${n}`, label: n, aka: faAliasOf[p]?.[n] || '', lib: `Font Awesome ${label}` })));
    }
    out.push(...rank(items).slice(0, q ? limit : 999));
  }
  return out.slice(0, lib === 'all' && !q ? 400 : limit);
}

// ---- SVG clean-up for icons kept in this browser (demo); the server does the same for real uploads.
const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'g']);
const ALLOWED_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'opacity', 'fill-opacity', 'fill-rule', 'clip-rule', 'transform'];
export function sanitizeSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return null;
  let vb = svg.getAttribute('viewBox');
  if (!vb || !/^[\d.\s,-]+$/.test(vb)) vb = `0 0 ${parseFloat(svg.getAttribute('width')) || 24} ${parseFloat(svg.getAttribute('height')) || 24}`;
  const walk = (node) => {
    let out = '';
    for (const el of node.children) {
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) continue;
      let attrs = '';
      for (const a of ALLOWED_ATTRS) { const v = el.getAttribute(a); if (v != null && /^[\w\s.,\-#%()]*$/.test(v)) attrs += ` ${a}="${v}"`; }
      if (/fa-secondary/.test(el.getAttribute('class') || '') && !el.hasAttribute('opacity')) attrs += ' opacity=".4"';
      if (el.getAttribute('fill') === 'none') attrs += ' fill="none"';
      out += tag === 'g' ? `<g${attrs}>${walk(el)}</g>` : `<${tag}${attrs}/>`;
    }
    return out;
  };
  const body = walk(svg);
  return body ? { vb, body } : null;
}
