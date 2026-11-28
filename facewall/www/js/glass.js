// Liquid glass refraction: the background bends at each tile's edge, like light through a rounded slab of glass.
//
// Browsers can only bend what's *behind* an element in Chrome, and the wall iPads run Safari's engine. But Facewall
// draws its own background, so each tile gets a small private copy of that background, lined up exactly with the
// real one, and an SVG filter bends the copy. That works in every engine. If a browser can't draw the filter the
// copy simply doesn't show, and the tile falls back to plain clear glass over the real background.

const SVG = 'http://www.w3.org/2000/svg';
const IOR = 1.5;                // glass
const made = new Map();         // "w x h x r" -> filter id
const roots = new Set();        // pages being kept in sync
let holder = null, pending = false;

/** How far light is shifted at each point across the bevel (0 = outer edge, 1 = where the flat top begins), 0..1. */
const bevel = (() => {
  const N = 96, out = new Float32Array(N + 1);
  let max = 0;
  for (let i = 0; i <= N; i++) {
    const t = Math.max(i / N, 0.004), u = 1 - t;
    const f = Math.pow(1 - u ** 4, 0.25);                        // rounded (squircle) shoulder
    const slope = 0.62 * (u ** 3) * Math.pow(1 - u ** 4, -0.75); // its steepness
    const ti = Math.atan(slope), tr = Math.asin(Math.sin(ti) / IOR); // Snell's law
    out[i] = Math.tan(ti - tr) * (0.5 + 0.6 * f);
    max = Math.max(max, out[i]);
  }
  for (let i = 0; i <= N; i++) out[i] /= max;
  return (t) => out[Math.max(0, Math.min(N, Math.round(t * N)))];
})();

/** A picture whose red/green say how far to shift each pixel sideways/up-down (128 = not at all). */
function displacementMap(w, h, r, bez) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const hw = w / 2, hh = h / 2;
  const sdf = (x, y) => { // distance to the rounded rectangle's edge: negative inside
    const qx = Math.abs(x - hw) - (hw - r), qy = Math.abs(y - hh) - (hh - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5, py = y + 0.5, inset = -sdf(px, py);
    let dx = 0, dy = 0;
    if (inset < bez) {
      const nx = sdf(px + 1, py) - sdf(px - 1, py), ny = sdf(px, py + 1) - sdf(px, py - 1), len = Math.hypot(nx, ny) || 1;
      const m = bevel(Math.max(inset, 0) / bez);
      dx = (-nx / len) * m; dy = (-ny / len) * m; // look further in, towards the middle
    }
    const i = (y * w + x) * 4;
    d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

function filterFor(w, h, r, depth) {
  const key = `${w}x${h}x${r}x${depth}`;
  if (made.has(key)) return made.get(key);
  if (!holder) {
    holder = document.createElementNS(SVG, 'svg');
    holder.setAttribute('width', '0'); holder.setAttribute('height', '0'); holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.append(holder);
  }
  const bez = Math.round(Math.max(6, Math.min(30, Math.min(w, h) * 0.2) * (0.45 + 0.55 * depth)));
  const shift = bez * 0.85 * Math.min(1.25, 0.4 + 0.6 * depth), pad = 12, id = `lg-${key}`;
  const el = (name, attrs) => { const n = document.createElementNS(SVG, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const f = el('filter', { id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', x: -pad, y: -pad, width: w + pad * 2, height: h + pad * 2, 'color-interpolation-filters': 'sRGB' });
  const im = el('feImage', { x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'map' });
  const url = displacementMap(w, h, Math.min(r, w / 2, h / 2), bez);
  im.setAttribute('href', url); im.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
  f.append(im,
    el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 1.6, result: 'soft' }),
    el('feDisplacementMap', { in: 'soft', in2: 'map', scale: (shift * 2).toFixed(1), xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' }),
    el('feColorMatrix', { in: 'bent', type: 'saturate', values: 1.35 }));
  holder.append(f);
  made.set(key, id);
  return id;
}

const active = () => document.body.dataset.look === 'glass' && !document.body.classList.contains('no-refract');

function sync(root) {
  const on = active() && root.clientWidth > 0;
  const R = on ? root.getBoundingClientRect() : null;
  for (const card of root.querySelectorAll('.home-grid > .card')) {
    let lens = card.querySelector(':scope > .g-lens');
    const c = on ? card.getBoundingClientRect() : null;
    const w = c ? Math.round(c.width) : 0, h = c ? Math.round(c.height) : 0;
    const cs = on ? getComputedStyle(card) : null;
    const depth = cs ? Math.round((parseFloat(cs.getPropertyValue('--depth')) || 0) * 10) / 10 : 0;
    if (!on || depth <= 0 || w < 40 || h < 40 || w * h > 900000) { lens?.remove(); card.classList.remove('has-lens'); continue; }
    if (!lens) {
      lens = document.createElement('div'); lens.className = 'g-lens';
      lens.innerHTML = '<div class="g-lens-f"><div class="g-world"><div class="home-bg"></div><div class="home-wall"></div></div></div>';
      card.prepend(lens); card.classList.add('has-lens');
    }
    const r = Math.round(parseFloat(cs.borderTopLeftRadius) || 0);
    const key = `${w}x${h}x${r}x${depth}`, fl = lens.firstChild, world = fl.firstChild;
    if (lens.dataset.k !== key) { lens.dataset.k = key; fl.style.filter = `url(#${filterFor(w, h, r, depth)})`; }
    world.style.cssText = `left:${(R.left - c.left).toFixed(1)}px;top:${(R.top - c.top).toFixed(1)}px;width:${R.width}px;height:${R.height}px`;
  }
}

/** Keep this page's tiles bending the background. Safe to call often. */
export function syncGlass(root) {
  if (root) roots.add(root);
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    for (const r of [...roots]) { if (!r.isConnected) { roots.delete(r); continue; } try { sync(r); } catch (e) { console.warn('Glass', e); } }
  });
}

// Style or setting changed: catch up.
new MutationObserver(() => syncGlass()).observe(document.body, { attributes: true, attributeFilter: ['data-look', 'class'] });
new MutationObserver(() => syncGlass()).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
window.addEventListener('resize', () => syncGlass());
