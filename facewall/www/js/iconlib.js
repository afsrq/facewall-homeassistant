// Icon libraries: Material Design Icons (Home Assistant's set), Font Awesome Free, Phosphor, Tabler,
// Material Symbols, and your own icons (uploaded SVGs, Home Assistant's custom_icons folder, or icons
// saved from the online Iconify search).
// Names: "mdi:lamp", "fas:couch", "ph:lamp-duotone", "tabler:lamp", "material-symbols:light-rounded",
// "fapro:lightbulb-on" / "custom:fluent-lamp-24-regular" (your own).
import { loadMdi, mdiSvg, mdiNames, mdiHas, SUGGESTED } from './mdi.js';

let fa = null, faLoading = null, faAliasOf = {};
let custom = {}, customLoaded = false, customLoading = null, serverIcons = true;
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());
/** Call fn whenever icons load or change. Returns a function that stops it. */
export const onIconsChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function loadFa() {
  if (fa) return Promise.resolve(fa);
  return (faLoading ||= fetch('icons/fa.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
    fa = j || { icons: {}, aliases: {} };
    // other names an icon goes by (e.g. "home" for house), for searching
    for (const [p, al] of Object.entries(fa.aliases || {})) { const m = (faAliasOf[p] = {}); for (const [a, real] of Object.entries(al)) m[real] = (m[real] ? m[real] + ' ' : '') + a; }
    return fa;
  }).catch(() => (fa = { icons: {}, aliases: {} })));
}

// ---- bundled icon sets in Iconify's style (loaded only when a tile or the picker needs them)
export const SETS = {
  ph: { label: 'Phosphor', lib: 'Phosphor', def: 'regular',
    styles: [['regular', 'Regular'], ['thin', 'Thin'], ['light', 'Light'], ['bold', 'Bold'], ['fill', 'Fill'], ['duotone', 'Duotone']],
    styleOf: (n) => (n.match(/-(thin|light|bold|fill|duotone)$/) || [])[1] || 'regular' },
  tabler: { label: 'Tabler', lib: 'Tabler', def: 'all',
    styles: [['outline', 'Outline'], ['filled', 'Filled']],
    styleOf: (n) => (n.endsWith('-filled') ? 'filled' : 'outline') },
  'material-symbols': { label: 'Material Symbols', lib: 'Material Symbols', def: 'rounded',
    styles: [['rounded', 'Rounded'], ['outline-rounded', 'Rounded outline'], ['standard', 'Standard'], ['outline', 'Outline'], ['sharp', 'Sharp'], ['outline-sharp', 'Sharp outline']],
    styleOf: (n) => (n.match(/-(outline-rounded|outline-sharp|rounded|sharp|outline)$/) || [])[1] || 'standard' },
};
const setData = {}, setLoading = {};
export function loadSet(prefix) {
  if (setData[prefix]) return Promise.resolve(setData[prefix]);
  return (setLoading[prefix] ||= fetch(`icons/${prefix}.json`).then((r) => (r.ok ? r.json() : null))
    .catch(() => null).then((j) => { setData[prefix] = j || { icons: {}, aliases: {} }; changed(); return setData[prefix]; }));
}
export const setLoaded = (prefix) => !!setData[prefix];
function setBody(set, id) {
  let e = set.icons[id];
  if (e === undefined) { const real = set.aliases?.[id]; if (real) e = set.icons[real]; }
  if (e === undefined) return null;
  let w = set.w, hh = set.h, body;
  if (typeof e === 'string') body = e.startsWith('<') ? e : set.t1.replace('{}', e);
  else if (typeof e[0] === 'number') { [w, hh, body] = e; }
  else body = set.g[0] + e.map((d, i) => `<path d="${d}"${i === 0 ? set.g[2] : ''}/>`).join('') + set.g[1];
  return { w, h: hh, body };
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

async function saveSvg(name, text) {
  if (!name || text.length > 300000) return false;
  if (serverIcons) {
    const r = await fetch('api/icons/custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, svg: text }) });
    return r.ok;
  }
  const clean = sanitizeSvg(text);
  if (!clean) return false;
  const all = lsGet(); all[name] = clean; lsSet(all);
  return true;
}
/** Upload SVG files. Returns the names added. */
export async function uploadIcons(files) {
  await loadCustom();
  const added = [];
  for (const file of files) {
    const name = slugName(file.name);
    if (await saveSvg(name, await file.text())) added.push(name);
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
  const m = String(name || '').trim().match(/^([a-z][a-z0-9-]*):(.+)$/);
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
  if (SETS[prefix]) {
    const set = setData[prefix];
    if (!set) { loadSet(prefix); return null; }
    const ic = setBody(set, id);
    return ic ? `<svg class="ic set ${cls}" viewBox="0 0 ${ic.w} ${ic.h}" aria-hidden="true">${ic.body}</svg>` : null;
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
  { v: 'all', label: 'All' }, { v: 'mdi', label: 'Home Assistant' }, { v: 'ph', label: 'Phosphor' }, { v: 'material-symbols', label: 'Material Symbols' },
  { v: 'tabler', label: 'Tabler' }, { v: 'fa', label: 'Font Awesome' }, { v: 'online', label: 'Search online' }, { v: 'pro', label: 'Your icons / Pro' },
];
const FA_SUGGESTED = ['lightbulb', 'house', 'couch', 'bed', 'tv', 'fan', 'temperature-half', 'snowflake', 'fire', 'lock', 'door-open', 'shower', 'bath', 'utensils', 'mug-hot', 'car', 'music', 'gamepad', 'sun', 'moon'];
// With no search text, the bundled sets show icons for the usual home tiles.
const HOME_WORDS = ['lamp', 'lightbulb', 'light', 'bulb', 'ceiling', 'chandelier', 'house', 'home', 'couch', 'sofa', 'armchair', 'bed', 'television', 'tv', 'fan', 'thermometer', 'thermostat', 'snowflake', 'fire', 'flame', 'lock', 'door', 'garage', 'window', 'blinds', 'curtains', 'shower', 'bathtub', 'toilet', 'coffee', 'cooking', 'oven', 'fridge', 'washing', 'plug', 'power', 'speaker', 'wifi', 'plant', 'potted', 'dog', 'cat', 'baby', 'sun', 'moon', 'car'];
/** [{ name: 'fas:couch', label: 'couch', lib: 'Font Awesome Solid' }] */
export function searchIcons(lib, query, limit = 180, style = null) {
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
  for (const [prefix, set] of Object.entries(SETS)) {
    if (!(lib === 'all' || lib === prefix) || !want(prefix)) continue;
    const data = setData[prefix];
    if (!data) { loadSet(prefix); continue; }
    // In "All", each set shows its main style; in its own tab, the style you pick (or every style).
    const st = lib === prefix ? (style || set.def) : set.def;
    const okStyle = (n) => st === 'all' || set.styleOf(n) === st;
    const names = Object.keys(data.icons).filter(okStyle);
    const hits = q ? names.filter(match) : names.filter((n) => HOME_WORDS.some((w) => n === w || n.startsWith(w + '-'))).slice(0, 300);
    out.push(...rank(hits.map((n) => ({ name: `${prefix}:${n}`, label: n, lib: set.lib }))).slice(0, q ? limit : 300));
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
const CONTAINERS = new Set(['g', 'defs', 'mask', 'clippath', 'lineargradient', 'radialgradient']);
const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'stop', ...CONTAINERS]);
const TAG_CASE = { clippath: 'clipPath', lineargradient: 'linearGradient', radialgradient: 'radialGradient' };
const ALLOWED_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'transform',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'id', 'mask', 'clip-path', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'fx', 'fy', 'fr', 'maskUnits', 'clipPathUnits'];
export function sanitizeSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return null;
  let vb = svg.getAttribute('viewBox');
  if (!vb || !/^[\d.\s,-]+$/.test(vb)) vb = `0 0 ${parseFloat(svg.getAttribute('width')) || 24} ${parseFloat(svg.getAttribute('height')) || 24}`;
  const walk = (node) => {
    let out = '';
    for (const el of node.children) {
      const key = el.tagName.toLowerCase(), tag = TAG_CASE[key] || key;
      if (!ALLOWED_TAGS.has(key)) continue;
      // Animated icons (e.g. line-md) start hidden and animate in: keep each animation's end state instead.
      const end = {};
      for (const an of el.children) {
        const t = an.tagName.toLowerCase();
        if (t !== 'animate' && t !== 'set') continue;
        const name = an.getAttribute('attributeName'), v = an.getAttribute('to') ?? an.getAttribute('values')?.split(';').pop();
        if (name && v != null) end[name] = v.trim();
      }
      let attrs = '';
      for (const a of ALLOWED_ATTRS) { const v = end[a] ?? el.getAttribute(a); if (v != null && /^[\w\s.,\-#%()]*$/.test(v)) attrs += ` ${a}="${v}"`; }
      if (/fa-secondary/.test(el.getAttribute('class') || '') && !el.hasAttribute('opacity')) attrs += ' opacity=".4"';
      out += CONTAINERS.has(key) ? `<${tag}${attrs}>${walk(el)}</${tag}>` : `<${tag}${attrs}/>`;
    }
    return out;
  };
  const body = walk(svg);
  return body ? { vb, body } : null;
}

// ---- online search: Iconify's free API (200,000+ open-source icons). Picked icons are saved as your own,
// so the iPads never need the internet to show them. Icons from the bundled sets are used directly.
const IFY = 'https://api.iconify.design';
const BUNDLED_FROM_IFY = { mdi: 'mdi', ph: 'ph', tabler: 'tabler', 'material-symbols': 'material-symbols', 'fa7-solid': 'fas', 'fa7-regular': 'far', 'fa7-brands': 'fab', 'fa6-solid': 'fas', 'fa6-regular': 'far', 'fa6-brands': 'fab' };
function ifyIcon(set, id, depth = 0) {
  const ic = set.icons?.[id];
  if (ic) return { body: ic.body, w: ic.width || set.width || 16, h: ic.height || set.height || 16, left: ic.left ?? set.left ?? 0, top: ic.top ?? set.top ?? 0 };
  const al = set.aliases?.[id];
  if (!al || depth > 5) return null;
  const base = ifyIcon(set, al.parent, depth + 1);
  if (!base) return null;
  const w = al.width || base.w, hh = al.height || base.h, tr = [];
  if (al.hFlip) tr.push(`translate(${w} 0) scale(-1 1)`);
  if (al.vFlip) tr.push(`translate(0 ${hh}) scale(1 -1)`);
  if (al.rotate) tr.push(`rotate(${al.rotate * 90} ${w / 2} ${hh / 2})`);
  return { ...base, w, h: hh, body: tr.length ? `<g transform="${tr.join(' ')}">${base.body}</g>` : base.body };
}
/** Search Iconify. Returns [{ name, label, lib, svg, pick }] where svg is cleaned preview markup. */
export async function searchOnline(query, { limit = 120, signal } = {}) {
  const r = await fetch(`${IFY}/search?query=${encodeURIComponent(query)}&limit=${limit}`, { signal });
  if (!r.ok) throw new Error('search failed');
  const res = await r.json();
  const split2 = (full) => { const i = full.indexOf(':'); return [full.slice(0, i), full.slice(i + 1)]; };
  const want = {};
  for (const full of res.icons || []) { const [p, n] = split2(full); (want[p] ||= []).push(n); }
  const sets = {};
  await Promise.all(Object.entries(want).map(async ([p, names]) => {
    try {
      const rr = await fetch(`${IFY}/${encodeURIComponent(p)}.json?icons=${names.map(encodeURIComponent).join(',')}`, { signal });
      if (rr.ok) sets[p] = await rr.json();
    } catch (e) { if (e.name === 'AbortError') throw e; }
  }));
  const out = [];
  for (const full of res.icons || []) {
    const [p, n] = split2(full);
    const ic = sets[p] && ifyIcon(sets[p], n);
    if (!ic) continue;
    const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.left} ${ic.top} ${ic.w} ${ic.h}">${ic.body}</svg>`);
    if (!clean) continue;
    const coll = res.collections?.[p] || {};
    out.push({
      name: full, prefix: p, id: n, label: n,
      lib: [coll.name || p, coll.license?.title].filter(Boolean).join(' · '),
      svg: `<svg class="ic" viewBox="${clean.vb}" fill="currentColor" aria-hidden="true">${clean.body}</svg>`,
      raw: clean,
    });
  }
  return out;
}
/** Use an online result: the bundled copy if we ship that set, otherwise save it as one of your icons. Returns the icon name. */
export async function useOnlineIcon(it) {
  const local = BUNDLED_FROM_IFY[it.prefix];
  if (local) {
    const name = `${local}:${it.id}`;
    if (local === 'mdi') { await loadMdi(); if (iconSvg(name)) return name; }
    else if (['fas', 'far', 'fab'].includes(local)) { await loadFa(); if (iconSvg(name)) return name; }
    else { await loadSet(local); if (iconSvg(name)) return name; }
  }
  await loadCustom();
  const slug = slugName(`${it.prefix}-${it.id}`);
  // Keep ids unique on the page (masks and gradients refer to them).
  const body = it.raw.body.replace(/\bid="([^"]+)"/g, `id="${slug}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${slug}-$1)`);
  if (!(await saveSvg(slug, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${it.raw.vb}">${body}</svg>`))) throw new Error('could not save');
  await loadCustom(true); changed();
  return 'custom:' + slug;
}
