// Watch faces. Each face draws into an SVG sized to the full screen (w × h CSS px);
// previews reuse the same drawing scaled down via viewBox, so everything stays crisp.
import { lightRGB, isOn, formatState } from './data.js';
import { FONTS } from './header.js';

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
function el(tag, attrs = {}, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const rad = (d) => (d * Math.PI) / 180;
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];
function makeSvg(root, w, h) {
  return el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet', class: 'face-svg' }, root);
}
function angles(now) {
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  return { h: h * 30, m: m * 6, s: s * 6, sTick: now.getSeconds() * 6 };
}
const rot = (g, cx, cy, a) => g.setAttribute('transform', `translate(${cx} ${cy}) rotate(${a})`);
const pad = (n) => String(n).padStart(2, '0');
function hhmm(now, use24h) {
  let h = now.getHours();
  const ampm = h < 12 ? 'AM' : 'PM';
  if (!use24h) h = h % 12 || 12;
  return { hh: use24h ? pad(h) : String(h), mm: pad(now.getMinutes()), ss: pad(now.getSeconds()), ampm };
}
const dayName = (d, style = 'short') => d.toLocaleDateString(undefined, { weekday: style });
const monthName = (d, style = 'short') => d.toLocaleDateString(undefined, { month: style });
function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Hands-only faces can show the time as text too, in a corner or above/below the dial. */
export const TIME_FACES = new Set(['classic', 'numerals', 'roman', 'gradient', 'starburst', 'atomic', 'confetti']);
export const TIME_POS = [{ v: '', label: 'Off' }, { v: 'tl', label: 'Top left' }, { v: 'tr', label: 'Top right' }, { v: 'top', label: 'Above' }, { v: 'bottom', label: 'Below' }, { v: 'bl', label: 'Bottom left' }, { v: 'br', label: 'Bottom right' }];
const TIME_SIZE = { s: 0.07, m: 0.1, l: 0.14 };
/** Where the dial sits: centred, or nudged and shrunk to leave room for the time above or below it. */
function dialBox(w, h, k, ctx = {}, wk = 1) {
  const pos = ctx.face?.time?.pos;
  if ((pos === 'top' || pos === 'bottom') && TIME_FACES.has(ctx.face?.type)) {
    const sz = TIME_SIZE[ctx.face.time.size || 'm'] * Math.min(w, h);
    const band = sz * (ctx.face.time.date ? 1.75 : 1.25) + Math.min(w, h) * 0.05;
    const avail = h - band;
    const R = Math.min(Math.min(w * wk, h) * k, Math.min(w * wk, avail) * k);
    const cy = pos === 'top' ? band + avail / 2 : avail / 2;
    return { cx: w / 2, cy, R };
  }
  return { cx: w / 2, cy: h / 2, R: Math.min(w * wk, h) * k };
}

export const FONT = {
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
  sans: '-apple-system, "SF Pro Display", system-ui, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, "New York", "Iowan Old Style", Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, "DejaVu Sans Mono", monospace',
  condensed: '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", system-ui, sans-serif',
};

const ACCENTS = [
  { v: 'orange', label: 'Orange', color: '#ff9f0a' }, { v: 'blue', label: 'Blue', color: '#0a84ff' },
  { v: 'red', label: 'Red', color: '#ff453a' }, { v: 'yellow', label: 'Yellow', color: '#ffd60a' },
  { v: 'green', label: 'Green', color: '#30d158' }, { v: 'pink', label: 'Pink', color: '#ff375f' },
  { v: 'cyan', label: 'Cyan', color: '#64d2ff' },
];
const HEX = /^#[0-9a-f]{6}$/i;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const mixC = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return toHex(A.map((x, i) => x + (B[i] - x) * t)); };
const lumOf = (hex) => { const [r, g, b] = rgbOf(hex).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** A dial or background in any colour (from the colour picker), with matching text, shading and hands. */
function customChoice(list, hex) {
  const base = list[0], dark = lumOf(hex) < 0.22, out = { v: hex, label: 'Custom', color: hex };
  if ('ink' in base) out.ink = dark ? '#f4f1ea' : '#1c1a17';
  if ('c1' in base) out.c1 = mixC(hex, '#ffffff', 0.2);
  if ('c2' in base) out.c2 = lumOf(base.c2) < lumOf(base.color) ? mixC(hex, '#000000', 0.5) : mixC(hex, '#ffffff', 0.1);
  if ('metal' in base) out.metal = dark ? '#d9a441' : mixC(hex, '#000000', 0.7);
  if ('dim' in base) { out.dim = dark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.13)'; out.light = !dark; }
  if ('bg' in base) out.bg = `radial-gradient(120% 100% at 50% 40%, ${mixC(hex, '#ffffff', 0.12)}, ${mixC(hex, '#000000', 0.45)})`;
  if ('ring' in base) out.ring = dark ? '#30d158' : '#2f9e5b';
  return out;
}
const pick = (list, v) => (typeof v === 'string' && HEX.test(v) ? customChoice(list, v) : list.find((c) => c.v === v) || list[0]);

// ============================================================ Classic
const CLASSIC_DIALS = [
  { v: 'ivory', label: 'Ivory', color: '#f3f0e8', ink: '#151515' },
  { v: 'white', label: 'White', color: '#ffffff', ink: '#111111' },
  { v: 'black', label: 'Black', color: '#0b0b0c', ink: '#f2f2f2' },
  { v: 'navy', label: 'Navy', color: '#14213d', ink: '#eef1f7' },
  { v: 'forest', label: 'Forest', color: '#17352a', ink: '#eef3ee' },
  { v: 'sand', label: 'Sand', color: '#e8d6b5', ink: '#2b2116' },
];

const classic = {
  name: 'Classic', blurb: 'Timeless hands and numerals.', category: 'Analog',
  options: [
    { key: 'dial', label: 'Dial', type: 'swatch', choices: CLASSIC_DIALS, custom: true },
    { key: 'accent', label: 'Seconds hand', type: 'swatch', choices: ACCENTS },
    { key: 'numerals', label: 'Numerals', type: 'choice', choices: [{ v: 'all', label: 'All' }, { v: 'quarters', label: 'Quarters' }, { v: 'none', label: 'None' }] },
    { key: 'seconds', label: 'Seconds hand', type: 'bool' },
    { key: 'date', label: 'Date', type: 'bool' },
  ],
  defaults: { dial: 'ivory', accent: 'orange', numerals: 'all', seconds: true, date: true },
  ink: (o) => pick(CLASSIC_DIALS, o.dial).ink,
  create(root, o, { w, h }) {
    const dial = pick(CLASSIC_DIALS, o.dial), accent = pick(ACCENTS, o.accent).color;
    const svg = makeSvg(root, w, h);
    el('rect', { width: w, height: h, fill: dial.color }, svg);
    const { cx, cy, R } = dialBox(w, h, 0.46, arguments[2]);
    const ticks = el('g', { stroke: dial.ink, 'stroke-linecap': 'round' }, svg);
    for (let i = 0; i < 60; i++) {
      const hr = i % 5 === 0;
      const [x1, y1] = polar(cx, cy, R * (hr ? 0.9 : 0.945), i * 6);
      const [x2, y2] = polar(cx, cy, R, i * 6);
      el('line', { x1, y1, x2, y2, 'stroke-width': hr ? R * 0.014 : R * 0.006, opacity: hr ? 1 : 0.5 }, ticks);
    }
    const nums = o.numerals === 'all' ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : o.numerals === 'quarters' ? [12, 3, 6, 9] : [];
    const big = o.numerals === 'quarters';
    for (const n of nums) {
      const [x, y] = polar(cx, cy, R * (big ? 0.68 : 0.77), n * 30);
      el('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': R * (big ? 0.22 : 0.145), 'font-family': FONT.sans, 'font-weight': big ? 600 : 450, fill: dial.ink }, svg, n);
    }
    // Date: in the side margin when the screen is wide, otherwise under the centre.
    let dateDay, dateNum;
    if (o.date) {
      const side = w / 2 - R;
      if (side > R * 0.42) {
        const x = cx + R + side / 2;
        dateDay = el('text', { x, y: cy - R * 0.13, 'text-anchor': 'middle', 'font-size': R * 0.085, 'font-family': FONT.sans, 'font-weight': 600, fill: accent, 'letter-spacing': '0.02em' }, svg);
        dateNum = el('text', { x, y: cy + R * 0.12, 'text-anchor': 'middle', 'font-size': R * 0.24, 'font-family': FONT.sans, 'font-weight': 300, fill: dial.ink }, svg);
      } else {
        dateDay = el('text', { x: cx, y: cy + R * 0.4, 'text-anchor': 'middle', 'font-size': R * 0.07, 'font-family': FONT.sans, 'font-weight': 600, fill: accent }, svg);
      }
    }
    const handG = (L, wide, tail) => {
      const g = el('g', {}, svg);
      el('rect', { x: -wide * 0.22, y: -L * 0.24, width: wide * 0.44, height: L * 0.24 + tail, rx: wide * 0.22, fill: dial.ink }, g);
      el('rect', { x: -wide / 2, y: -L, width: wide, height: L * 0.8, rx: wide / 2, fill: dial.ink }, g);
      return g;
    };
    const hourH = handG(R * 0.52, R * 0.048, R * 0.02);
    const minH = handG(R * 0.84, R * 0.036, R * 0.02);
    el('circle', { cx, cy, r: R * 0.028, fill: dial.ink }, svg);
    let secH = null;
    if (o.seconds) {
      secH = el('g', {}, svg);
      el('line', { x1: 0, y1: R * 0.16, x2: 0, y2: -R * 0.93, stroke: accent, 'stroke-width': R * 0.008, 'stroke-linecap': 'round' }, secH);
      el('circle', { cx: 0, cy: 0, r: R * 0.02, fill: accent }, secH);
      el('circle', { cx: 0, cy: 0, r: R * 0.008, fill: dial.color }, secH);
    }
    let lastDay = -1;
    return {
      update(now, smooth) {
        const a = angles(now);
        rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m);
        if (secH) rot(secH, cx, cy, smooth ? a.s : a.sTick);
        if (now.getDate() !== lastDay) {
          lastDay = now.getDate();
          if (dateNum) { dateDay.textContent = `${dayName(now)} ${monthName(now)}`; dateNum.textContent = now.getDate(); }
          else if (dateDay) dateDay.textContent = `${dayName(now).toUpperCase()} ${now.getDate()}`;
        }
      },
    };
  },
};

// ============================================================ Numerals
const BRIGHTS = [
  { v: 'green', label: 'Green', color: '#33e07a' }, { v: 'mint', label: 'Mint', color: '#66e3c4' },
  { v: 'sky', label: 'Sky', color: '#5ac8fa' }, { v: 'indigo', label: 'Indigo', color: '#5e5ce6' },
  { v: 'pink', label: 'Pink', color: '#ff2d78' }, { v: 'orange', label: 'Orange', color: '#ff9f0a' },
  { v: 'yellow', label: 'Yellow', color: '#ffd60a' }, { v: 'white', label: 'White', color: '#f2f2f7' },
  { v: 'black', label: 'Black', color: '#111113' },
];
const numerals = {
  name: 'Numerals', blurb: 'Huge numbers, bold colour.', category: 'Analog',
  options: [
    { key: 'color', label: 'Colour', type: 'swatch', choices: BRIGHTS },
    { key: 'font', label: 'Font', type: 'choice', choices: [{ v: 'rounded', label: 'Rounded' }, { v: 'sans', label: 'Sans' }, { v: 'serif', label: 'Serif' }] },
    { key: 'weight', label: 'Weight', type: 'choice', choices: [{ v: '400', label: 'Regular' }, { v: '700', label: 'Bold' }, { v: '900', label: 'Heavy' }] },
    { key: 'seconds', label: 'Seconds hand', type: 'bool' },
  ],
  defaults: { color: 'green', font: 'rounded', weight: '400', seconds: true },
  ink: (o) => (luminance(pick(BRIGHTS, o.color).color) > 0.3 ? '#111' : '#fff'),
  create(root, o, { w, h }) {
    const bg = pick(BRIGHTS, o.color).color;
    const dark = luminance(bg) > 0.3;
    const ink = dark ? '#111111' : '#ffffff';
    const svg = makeSvg(root, w, h);
    const id = 'n' + ++uid;
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: id + 's', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feDropShadow', { dx: 0, dy: h * 0.004, stdDeviation: h * 0.006, 'flood-color': '#000', 'flood-opacity': 0.35 }, f);
    el('rect', { width: w, height: h, fill: bg }, svg);
    const { cx, cy, R: S } = dialBox(w, h, 1, arguments[2], 0.75);
    const size = S * 0.42, off = Math.min(w * 0.31, S * 0.62);
    const t = { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size, 'font-family': FONT[o.font] || FONT.rounded, 'font-weight': o.weight, fill: ink, opacity: dark ? 0.9 : 0.95 };
    el('text', { ...t, x: cx, y: cy - S * 0.29 }, svg, '12');
    el('text', { ...t, x: cx, y: cy + S * 0.31 }, svg, '6');
    el('text', { ...t, x: cx + off, y: cy }, svg, '3');
    el('text', { ...t, x: cx - off, y: cy }, svg, '9');
    const handCol = dark ? '#ffffff' : '#ffffff';
    const hand = (L, wd) => {
      const g = el('g', { filter: `url(#${id}s)` }, svg);
      el('rect', { x: -wd * 0.2, y: -L * 0.22, width: wd * 0.4, height: L * 0.22, fill: handCol }, g);
      el('rect', { x: -wd / 2, y: -L, width: wd, height: L * 0.8, rx: wd / 2, fill: handCol }, g);
      return g;
    };
    const hourH = hand(S * 0.27, S * 0.034);
    const minH = hand(S * 0.43, S * 0.034);
    let secH = null;
    if (o.seconds) {
      secH = el('g', {}, svg);
      el('line', { x1: 0, y1: S * 0.06, x2: 0, y2: -S * 0.44, stroke: dark ? '#111' : '#fff', 'stroke-width': S * 0.005, 'stroke-linecap': 'round', opacity: 0.85 }, secH);
    }
    el('circle', { cx, cy, r: S * 0.02, fill: handCol, stroke: dark ? '#111' : 'none', 'stroke-width': S * 0.005 }, svg);
    return {
      update(now, smooth) {
        const a = angles(now);
        rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m);
        if (secH) rot(secH, cx, cy, smooth ? a.s : a.sTick);
      },
    };
  },
};

// ============================================================ Digital
const DIGI = [
  { v: 'cyan', label: 'Cyan', color: '#64d2ff' }, { v: 'white', label: 'White', color: '#f5f5f7' },
  { v: 'green', label: 'Green', color: '#32d74b' }, { v: 'orange', label: 'Orange', color: '#ff9f0a' },
  { v: 'pink', label: 'Pink', color: '#ff375f' }, { v: 'purple', label: 'Purple', color: '#bf5af2' },
  { v: 'yellow', label: 'Yellow', color: '#ffd60a' }, { v: 'red', label: 'Red', color: '#ff453a' },
];
const DIGI_FONTS = { rounded: [FONT.rounded, 600], bold: [FONT.sans, 700], thin: [FONT.sans, 200], mono: [FONT.mono, 500], condensed: [FONT.condensed, 700] };
const digital = {
  name: 'Digital', blurb: 'Big, bold time you can read across the room.', category: 'Digital',
  options: [
    { key: 'color', label: 'Colour', type: 'swatch', choices: DIGI },
    { key: 'style', label: 'Style', type: 'choice', choices: [{ v: 'dark', label: 'Dark' }, { v: 'tinted', label: 'Tinted' }, { v: 'solid', label: 'Solid' }] },
    { key: 'layout', label: 'Layout', type: 'choice', choices: [{ v: 'stacked', label: 'Stacked' }, { v: 'inline', label: 'Inline' }] },
    { key: 'font', label: 'Font', type: 'choice', choices: [{ v: 'rounded', label: 'Rounded' }, { v: 'bold', label: 'Bold' }, { v: 'thin', label: 'Thin' }, { v: 'mono', label: 'Mono' }, { v: 'condensed', label: 'Narrow' }] },
    { key: 'seconds', label: 'Seconds', type: 'bool' },
    { key: 'date', label: 'Date', type: 'bool' },
  ],
  defaults: { color: 'cyan', style: 'dark', layout: 'stacked', font: 'rounded', seconds: false, date: true },
  ink: (o) => (o.style === 'solid' ? '#000' : '#fff'),
  create(root, o, { w, h, use24h }) {
    const col = pick(DIGI, o.color).color;
    const svg = makeSvg(root, w, h);
    const bg = o.style === 'solid' ? col : '#000';
    el('rect', { width: w, height: h, fill: bg }, svg);
    if (o.style === 'tinted') {
      const id = 'd' + ++uid;
      const g = el('radialGradient', { id, cx: '50%', cy: '50%', r: '75%' }, el('defs', {}, svg));
      el('stop', { offset: '0', 'stop-color': col, 'stop-opacity': 0.32 }, g);
      el('stop', { offset: '1', 'stop-color': col, 'stop-opacity': 0.08 }, g);
      el('rect', { width: w, height: h, fill: `url(#${id})` }, svg);
    }
    const fg = o.style === 'solid' ? '#000000' : col;
    const sub = o.style === 'solid' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.62)';
    const [family, weight] = DIGI_FONTS[o.font] || DIGI_FONTS.rounded;
    const base = { 'font-family': family, 'font-weight': weight, fill: fg, style: 'font-variant-numeric: tabular-nums' };
    const landscape = w > h * 1.15;
    const nodes = {};
    if (o.layout === 'stacked') {
      const size = Math.min(h * 0.47, w * (landscape ? 0.34 : 0.5));
      const x = landscape ? w * 0.37 : w / 2;
      nodes.hh = el('text', { ...base, x, y: h * 0.5 - size * 0.06, 'text-anchor': 'middle', 'font-size': size }, svg);
      nodes.mm = el('text', { ...base, x, y: h * 0.5 + size * 0.86, 'text-anchor': 'middle', 'font-size': size }, svg);
      const rx = landscape ? w * 0.79 : w / 2;
      const ry = landscape ? h / 2 : h * 0.1;
      if (o.date) {
        nodes.day = el('text', { x: rx, y: ry - size * 0.2, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 600, 'font-size': size * 0.13, fill: fg, 'letter-spacing': '0.08em' }, svg);
        nodes.date = el('text', { x: rx, y: ry + size * 0.12, 'text-anchor': 'middle', 'font-family': family, 'font-weight': weight, 'font-size': size * 0.32, fill: o.style === 'solid' ? '#000' : '#fff' }, svg);
        nodes.month = el('text', { x: rx, y: ry + size * 0.3, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 500, 'font-size': size * 0.1, fill: sub, 'letter-spacing': '0.1em' }, svg);
      }
      if (o.seconds || !use24h) {
        nodes.ss = el('text', { x: rx, y: ry + (o.date ? size * 0.62 : 0), 'text-anchor': 'middle', 'font-family': family, 'font-weight': weight, 'font-size': size * 0.16, fill: sub, style: 'font-variant-numeric: tabular-nums' }, svg);
      }
    } else {
      const size = Math.min(w * 0.27, h * 0.6);
      const y = h / 2 + size * 0.35;
      nodes.line = el('text', { ...base, x: w / 2, y, 'text-anchor': 'middle', 'font-size': size }, svg);
      if (o.date) nodes.dateLine = el('text', { x: w / 2, y: y - size * 0.98, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 600, 'font-size': size * 0.12, fill: sub, 'letter-spacing': '0.12em' }, svg);
      if (o.seconds || !use24h) nodes.ss = el('text', { x: w / 2, y: y + size * 0.36, 'text-anchor': 'middle', 'font-family': family, 'font-weight': weight, 'font-size': size * 0.16, fill: sub, style: 'font-variant-numeric: tabular-nums' }, svg);
    }
    let last = '';
    return {
      update(now) {
        const t = hhmm(now, use24h);
        const key = t.hh + t.mm + t.ss + now.getDate();
        if (key === last) return; last = key;
        if (nodes.hh) { nodes.hh.textContent = t.hh; nodes.mm.textContent = t.mm; }
        if (nodes.line) nodes.line.textContent = `${t.hh}:${t.mm}`;
        if (nodes.ss) nodes.ss.textContent = [o.seconds ? t.ss : '', use24h ? '' : t.ampm].filter(Boolean).join('  ');
        if (nodes.day) { nodes.day.textContent = dayName(now).toUpperCase(); nodes.date.textContent = now.getDate(); nodes.month.textContent = monthName(now, 'long').toUpperCase(); }
        if (nodes.dateLine) nodes.dateLine.textContent = `${dayName(now, 'long')} ${now.getDate()} ${monthName(now, 'long')}`.toUpperCase();
      },
    };
  },
};

// ============================================================ Roman
const ROMAN_DIALS = [
  { v: 'ivory', label: 'Ivory', color: '#efe7d4', c1: '#f8f3e7', c2: '#d6c8a8', ink: '#1f1b16' },
  { v: 'silver', label: 'Silver', color: '#dfe2e7', c1: '#f3f5f8', c2: '#b4bac4', ink: '#1a1c20' },
  { v: 'navy', label: 'Navy', color: '#1f3a66', c1: '#2f5288', c2: '#0b1830', ink: '#eef1f7' },
  { v: 'forest', label: 'Forest', color: '#1f523d', c1: '#2f6f54', c2: '#0a2219', ink: '#eef4ef' },
  { v: 'burgundy', label: 'Burgundy', color: '#6b1a2a', c1: '#8f2639', c2: '#2a0710', ink: '#f7eef0' },
  { v: 'black', label: 'Black', color: '#1e1e21', c1: '#36363b', c2: '#0a0a0b', ink: '#f2f2f2' },
];
const METALS = [
  { v: 'gold', label: 'Gold', color: '#d9b86c', dark: '#9c7a38' },
  { v: 'silver', label: 'Steel', color: '#e3e6ea', dark: '#8e949d' },
  { v: 'rose', label: 'Rose', color: '#e8b39c', dark: '#a86f59' },
];
const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const roman = {
  name: 'Roman', blurb: 'A refined dress dial with a sunburst finish.', category: 'Analog',
  options: [
    { key: 'dial', label: 'Dial', type: 'swatch', choices: ROMAN_DIALS, custom: true },
    { key: 'metal', label: 'Hands & case', type: 'swatch', choices: METALS },
    { key: 'seconds', label: 'Seconds hand', type: 'bool' },
  ],
  defaults: { dial: 'navy', metal: 'gold', seconds: true },
  ink: () => '#e5e5ea',
  create(root, o, { w, h }) {
    const d = pick(ROMAN_DIALS, o.dial), m = pick(METALS, o.metal);
    const svg = makeSvg(root, w, h);
    const id = 'r' + ++uid;
    const defs = el('defs', {}, svg);
    const bgG = el('radialGradient', { id: id + 'bg', cx: '50%', cy: '45%', r: '75%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#1d1d21' }, bgG); el('stop', { offset: '1', 'stop-color': '#040405' }, bgG);
    const dg = el('radialGradient', { id: id + 'd', cx: '50%', cy: '42%', r: '62%' }, defs);
    el('stop', { offset: '0', 'stop-color': d.c1 }, dg); el('stop', { offset: '1', 'stop-color': d.c2 }, dg);
    const cg = el('linearGradient', { id: id + 'c', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': m.color }, cg); el('stop', { offset: '0.5', 'stop-color': m.dark }, cg); el('stop', { offset: '1', 'stop-color': m.color }, cg);
    const sh = el('filter', { id: id + 's', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feDropShadow', { dx: 0, dy: h * 0.004, stdDeviation: h * 0.005, 'flood-color': '#000', 'flood-opacity': 0.4 }, sh);

    el('rect', { width: w, height: h, fill: `url(#${id}bg)` }, svg);
    const { cx, cy, R } = dialBox(w, h, 0.44, arguments[2]);
    el('circle', { cx, cy, r: R * 1.045, fill: `url(#${id}c)` }, svg);
    el('circle', { cx, cy, r: R, fill: `url(#${id}d)` }, svg);
    // sunburst texture
    const rays = el('g', { stroke: d.ink, 'stroke-width': R * 0.004, opacity: 0.045 }, svg);
    for (let i = 0; i < 180; i++) { const [x, y] = polar(cx, cy, R * 0.98, i * 2); el('line', { x1: cx, y1: cy, x2: x, y2: y }, rays); }
    // minute dots
    for (let i = 0; i < 60; i++) {
      const hr = i % 5 === 0;
      const [x, y] = polar(cx, cy, R * 0.91, i * 6);
      el('circle', { cx: x, cy: y, r: hr ? R * 0.014 : R * 0.0055, fill: hr ? `url(#${id}c)` : d.ink, opacity: hr ? 1 : 0.55 }, svg);
    }
    ROMAN.forEach((n, i) => {
      const [x, y] = polar(cx, cy, R * 0.75, i * 30);
      el('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT.serif, 'font-size': R * 0.12, 'font-weight': 500, fill: d.ink, 'letter-spacing': '-0.02em' }, svg, n);
    });
    const dauphine = (L, wd) => {
      const g = el('g', { filter: `url(#${id}s)` }, svg);
      el('path', { d: `M0 ${-L} L${-wd} ${-L * 0.08} L0 ${L * 0.1} Z`, fill: m.dark }, g);
      el('path', { d: `M0 ${-L} L${wd} ${-L * 0.08} L0 ${L * 0.1} Z`, fill: m.color }, g);
      return g;
    };
    const hourH = dauphine(R * 0.52, R * 0.05);
    const minH = dauphine(R * 0.8, R * 0.038);
    let secH = null;
    if (o.seconds) {
      secH = el('g', { filter: `url(#${id}s)` }, svg);
      el('line', { x1: 0, y1: R * 0.18, x2: 0, y2: -R * 0.88, stroke: m.color, 'stroke-width': R * 0.007, 'stroke-linecap': 'round' }, secH);
      el('circle', { cx: 0, cy: R * 0.14, r: R * 0.022, fill: m.color }, secH);
    }
    el('circle', { cx, cy, r: R * 0.03, fill: `url(#${id}c)` }, svg);
    return {
      update(now, smooth) {
        const a = angles(now);
        rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m);
        if (secH) rot(secH, cx, cy, smooth ? a.s : a.sTick);
      },
    };
  },
};

// ============================================================ Flip
const FLIP = [
  { v: 'graphite', label: 'Graphite', color: '#2c2c2e', c2: '#1c1c1e', ink: '#f5f5f7', bg: '#000000' },
  { v: 'paper', label: 'Paper', color: '#f7f7f5', c2: '#e2e2de', ink: '#141414', bg: '#151515' },
  { v: 'red', label: 'Red', color: '#e5383b', c2: '#b51d25', ink: '#ffffff', bg: '#110304' },
  { v: 'blue', label: 'Blue', color: '#2f6fed', c2: '#1c4cc0', ink: '#ffffff', bg: '#020818' },
  { v: 'olive', label: 'Olive', color: '#5a6640', c2: '#3c4529', ink: '#f3f1e6', bg: '#0a0b06' },
];
const flip = {
  name: 'Flip', blurb: 'Split-flap cards that turn every minute.', category: 'Digital',
  options: [
    { key: 'color', label: 'Cards', type: 'swatch', choices: FLIP },
    { key: 'font', label: 'Font', type: 'choice', choices: [{ v: 'sans', label: 'Sans' }, { v: 'rounded', label: 'Rounded' }, { v: 'condensed', label: 'Narrow' }] },
    { key: 'date', label: 'Date', type: 'bool' },
  ],
  defaults: { color: 'graphite', font: 'sans', date: true },
  ink: () => '#d1d1d6',
  create(root, o, { w, h, use24h, preview }) {
    const c = pick(FLIP, o.color);
    const svg = makeSvg(root, w, h);
    const id = 'f' + ++uid;
    const defs = el('defs', {}, svg);
    const g1 = el('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': c.color }, g1); el('stop', { offset: '1', 'stop-color': c.c2 }, g1);
    el('rect', { width: w, height: h, fill: c.bg }, svg);
    const cardH = Math.min(h * (o.date ? 0.6 : 0.66), w * 0.42 * 1.12);
    const cardW = cardH / 1.12, gap = cardW * 0.09;
    const x0 = w / 2 - cardW - gap / 2, y0 = h / 2 - cardH / 2 - (o.date ? h * 0.04 : 0);
    const hy = y0 + cardH / 2, rx = cardW * 0.075;
    const family = FONT[o.font] || FONT.sans;
    const cards = [0, 1].map((i) => {
      const x = x0 + i * (cardW + gap);
      const cpT = el('clipPath', { id: `${id}t${i}` }, defs); el('rect', { x, y: y0 - 2, width: cardW, height: cardH / 2 + 2 }, cpT);
      const cpB = el('clipPath', { id: `${id}b${i}` }, defs); el('rect', { x, y: hy, width: cardW, height: cardH / 2 + 2 }, cpB);
      el('rect', { x: x + cardW * 0.02, y: y0 + cardH * 0.03, width: cardW, height: cardH, rx, fill: '#000', opacity: 0.45 }, svg);
      const layer = (clip) => {
        const g = el('g', { 'clip-path': `url(#${clip})` }, svg);
        el('rect', { x, y: y0, width: cardW, height: cardH, rx, fill: `url(#${id}g)` }, g);
        const t = el('text', { x: x + cardW / 2, y: y0 + cardH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': family, 'font-weight': 700, 'font-size': cardH * 0.7, fill: c.ink, style: 'font-variant-numeric: tabular-nums', 'letter-spacing': '-0.02em' }, g);
        const shade = el('rect', { x, y: y0, width: cardW, height: cardH, rx, fill: '#000', opacity: 0 }, g);
        return { g, t, shade };
      };
      const card = { x, sT: layer(`${id}t${i}`), sB: layer(`${id}b${i}`), fT: layer(`${id}t${i}`), fB: layer(`${id}b${i}`), val: '' };
      card.fT.g.style.display = 'none'; card.fB.g.style.display = 'none';
      el('rect', { x: x - 1, y: hy - cardH * 0.006, width: cardW + 2, height: cardH * 0.012, fill: c.bg, opacity: 0.85 }, svg);
      for (const sx of [x + cardW * 0.012, x + cardW * 0.988]) el('rect', { x: sx - cardW * 0.012, y: hy - cardH * 0.028, width: cardW * 0.024, height: cardH * 0.056, rx: cardW * 0.008, fill: c.bg }, svg);
      return card;
    });
    let ampm = null, dateT = null;
    if (!use24h) ampm = el('text', { x: x0 + cardW * 0.08, y: y0 + cardH * 0.92, 'font-family': FONT.sans, 'font-weight': 700, 'font-size': cardH * 0.06, fill: c.ink, opacity: 0.7 }, svg);
    if (o.date) dateT = el('text', { x: w / 2, y: y0 + cardH + h * 0.1, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 600, 'font-size': h * 0.034, fill: '#8e8e93', 'letter-spacing': '0.3em' }, svg);
    const scaleY = (g, k) => g.setAttribute('transform', `translate(0 ${hy}) scale(1 ${Math.max(k, 0.0001)}) translate(0 ${-hy})`);
    const animate = (card, from, to) => {
      card.sT.t.textContent = to; card.sB.t.textContent = from;
      card.fT.t.textContent = from; card.fB.t.textContent = to;
      card.fT.g.style.display = ''; card.fB.g.style.display = 'none';
      const t0 = performance.now(), dur = 520;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        if (p < 0.5) {
          const k = Math.cos(p * Math.PI);
          scaleY(card.fT.g, k); card.fT.shade.setAttribute('opacity', (1 - k) * 0.45);
          card.sT.shade.setAttribute('opacity', k * 0.3);
        } else {
          card.fT.g.style.display = 'none'; card.fB.g.style.display = '';
          const k = -Math.cos(p * Math.PI);
          scaleY(card.fB.g, k); card.fB.shade.setAttribute('opacity', (1 - k) * 0.45);
          card.sB.shade.setAttribute('opacity', (1 - k) * 0.3);
          card.sT.shade.setAttribute('opacity', 0);
        }
        if (p < 1) requestAnimationFrame(step);
        else { card.sB.t.textContent = to; card.fB.g.style.display = 'none'; card.sB.shade.setAttribute('opacity', 0); }
      };
      requestAnimationFrame(step);
    };
    let lastDay = -1;
    return {
      update(now) {
        const t = hhmm(now, use24h);
        [t.hh, t.mm].forEach((v, i) => {
          const card = cards[i];
          if (card.val === v) return;
          const from = card.val; card.val = v;
          if (!from || preview || document.hidden) { for (const l of [card.sT, card.sB, card.fT, card.fB]) l.t.textContent = v; }
          else animate(card, from, v);
        });
        if (ampm) ampm.textContent = t.ampm;
        if (dateT && now.getDate() !== lastDay) { lastDay = now.getDate(); dateT.textContent = `${dayName(now, 'long')}  ·  ${monthName(now, 'long')} ${now.getDate()}`.toUpperCase(); }
      },
    };
  },
};

// ============================================================ Lamp (linked to a Home Assistant light)
const GLOWS = [
  { v: 'match', label: 'Match light', color: 'conic-gradient(#ffd38a, #ff7aa8, #8ad1ff, #ffd38a)' },
  { v: 'warm', label: 'Warm', color: '#ffbe6e', rgb: [255, 190, 110] },
  { v: 'cool', label: 'Cool', color: '#cfe4ff', rgb: [207, 228, 255] },
  { v: 'rose', label: 'Rose', color: '#ff7a96', rgb: [255, 122, 150] },
];
const lamp = {
  name: 'Lamp', blurb: 'A pendant bulb that glows with your real light. Tap to switch it.', category: 'Home',
  needsTap: true,
  options: [
    { key: 'glow', label: 'Glow', type: 'swatch', choices: GLOWS },
    { key: 'bulb', label: 'Bulb', type: 'choice', choices: [{ v: 'globe', label: 'Globe' }, { v: 'pear', label: 'Pear' }] },
    { key: 'time', label: 'Show time', type: 'bool' },
  ],
  defaults: { glow: 'match', bulb: 'pear', time: true },
  ink: () => '#c7c7cc',
  create(root, o, { w, h, use24h, store, face }) {
    const svg = makeSvg(root, w, h);
    const id = 'l' + ++uid;
    const defs = el('defs', {}, svg);
    const glow = el('radialGradient', { id: id + 'g', cx: '50%', cy: '50%', r: '50%' }, defs);
    const stops = [[0, 0.85], [0.18, 0.5], [0.45, 0.16], [1, 0]].map(([off, op]) => el('stop', { offset: off, 'stop-color': '#ffbe6e', 'stop-opacity': op }, glow));
    const glass = el('radialGradient', { id: id + 'b', cx: '42%', cy: '38%', r: '65%' }, defs);
    const gs = [el('stop', { offset: 0, 'stop-color': '#fff' }, glass), el('stop', { offset: 1, 'stop-color': '#ffbe6e' }, glass)];
    const blur = el('filter', { id: id + 'f', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
    el('feGaussianBlur', { stdDeviation: h * 0.006 }, blur);

    el('rect', { width: w, height: h, fill: '#060607' }, svg);
    const cx = w / 2, by = h * 0.4, br = h * 0.12;
    const glowC = el('circle', { cx, cy: by, r: Math.max(w, h) * 0.75, fill: `url(#${id}g)`, style: 'transition: opacity .6s ease', opacity: 0 }, svg);
    const pend = el('g', {}, svg);
    el('line', { x1: cx, y1: -10, x2: cx, y2: by - br * 1.32, stroke: '#3a3a3c', 'stroke-width': Math.max(2, h * 0.004) }, pend);
    el('rect', { x: cx - br * 0.3, y: by - br * 1.38, width: br * 0.6, height: br * 0.5, rx: br * 0.07, fill: '#2c2c2e' }, pend);
    for (let i = 0; i < 3; i++) el('line', { x1: cx - br * 0.3, x2: cx + br * 0.3, y1: by - br * (1.22 - i * 0.12), y2: by - br * (1.22 - i * 0.12), stroke: '#1c1c1e', 'stroke-width': br * 0.03 }, pend);
    const shape = o.bulb === 'globe'
      ? el('circle', { cx, cy: by + br * 0.1, r: br }, pend)
      : el('path', { d: `M${cx - br * 0.26} ${by - br * 0.9} C${cx - br * 0.3} ${by - br * 0.45} ${cx - br} ${by - br * 0.2} ${cx - br} ${by + br * 0.35} A${br} ${br} 0 0 0 ${cx + br} ${by + br * 0.35} C${cx + br} ${by - br * 0.2} ${cx + br * 0.3} ${by - br * 0.45} ${cx + br * 0.26} ${by - br * 0.9} Z` }, pend);
    shape.setAttribute('stroke-width', Math.max(1.5, h * 0.003));
    const filPath = `M${cx - br * 0.18} ${by - br * 0.85} L${cx - br * 0.18} ${by + br * 0.05} M${cx + br * 0.18} ${by - br * 0.85} L${cx + br * 0.18} ${by + br * 0.05} M${cx - br * 0.18} ${by + br * 0.05} l${br * 0.06} ${-br * 0.1} l${br * 0.06} ${br * 0.1} l${br * 0.06} ${-br * 0.1} l${br * 0.06} ${br * 0.1} l${br * 0.06} ${-br * 0.1} l${br * 0.06} ${br * 0.1}`;
    const filGlow = el('path', { d: filPath, fill: 'none', 'stroke-width': br * 0.06, filter: `url(#${id}f)`, 'stroke-linecap': 'round' }, pend);
    const fil = el('path', { d: filPath, fill: 'none', 'stroke-width': br * 0.022, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, pend);
    let timeT = null;
    const sub = el('text', { x: cx, y: h * (o.time ? 0.9 : 0.8), 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 500, 'font-size': h * 0.03, fill: '#8e8e93', 'letter-spacing': '0.04em' }, svg);
    if (o.time) timeT = el('text', { x: cx, y: h * 0.8, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 250, 'font-size': h * 0.15, fill: '#f2f2f7', style: 'font-variant-numeric: tabular-nums' }, svg);

    const paint = () => {
      const s = face?.tap ? store?.get(face.tap) : null;
      const on = isOn(s);
      const g = pick(GLOWS, o.glow);
      const rgb = g.rgb || (s ? lightRGB(s) : [255, 190, 110]);
      const col = `rgb(${rgb.join(',')})`;
      const bri = s?.attributes?.brightness != null ? 0.35 + 0.65 * (s.attributes.brightness / 255) : 1;
      stops.forEach((st) => st.setAttribute('stop-color', col));
      gs[1].setAttribute('stop-color', col);
      glowC.style.opacity = on ? bri : 0;
      shape.setAttribute('fill', on ? `url(#${id}b)` : 'rgba(255,255,255,0.05)');
      shape.setAttribute('stroke', on ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.28)');
      shape.setAttribute('fill-opacity', on ? 0.92 : 1);
      fil.setAttribute('stroke', on ? '#fffaf0' : '#5a5a5e');
      filGlow.setAttribute('stroke', on ? '#fff3d6' : 'none');
      if (timeT) timeT.setAttribute('fill', on ? '#ffffff' : '#d1d1d6');
      sub.textContent = !face?.tap ? 'Long-press › Customize to pick a light'
        : `${store.name(face.tap)}  ·  ${on ? (s?.attributes?.brightness != null ? Math.round(s.attributes.brightness / 2.55) + '%' : 'On') : 'Off'}`;
    };
    paint();
    let swingT0 = null, raf = 0;
    const swing = () => {
      cancelAnimationFrame(raf);
      swingT0 = performance.now();
      const step = (t) => {
        const s = (t - swingT0) / 1000;
        const a = 7 * Math.exp(-s / 0.7) * Math.sin(s * 7.5);
        pend.setAttribute('transform', `rotate(${a} ${cx} 0)`);
        if (s < 3) raf = requestAnimationFrame(step); else pend.removeAttribute('transform');
      };
      raf = requestAnimationFrame(step);
    };
    let last = '';
    return {
      update(now) {
        if (!timeT) return;
        const t = hhmm(now, use24h);
        const k = t.hh + t.mm;
        if (k !== last) { last = k; timeT.textContent = `${t.hh}:${t.mm}`; }
      },
      onState(eid) { if (eid === face?.tap || eid === '*') paint(); },
      onTap() { swing(); },
      destroy() { cancelAnimationFrame(raf); },
    };
  },
};

// ============================================================ Gradient
const PALETTES = [
  { v: 'sunset', label: 'Sunset', stops: ['#ff3d6e', '#ff8a4c', '#ffd36e', '#7d3cff', '#ff3d6e'] },
  { v: 'ocean', label: 'Ocean', stops: ['#00d2ff', '#3a7bd5', '#0b1f4d', '#1b3d8f', '#00d2ff'] },
  { v: 'aurora', label: 'Aurora', stops: ['#00f5a0', '#00d9f5', '#7a5cff', '#2b1a6b', '#00f5a0'] },
  { v: 'ember', label: 'Ember', stops: ['#ffb000', '#ff4e00', '#3a0a00', '#8a1c00', '#ffb000'] },
  { v: 'mono', label: 'Mono', stops: ['#ffffff', '#8e8e93', '#1c1c1e', '#48484a', '#ffffff'] },
].map((p) => ({ ...p, color: `conic-gradient(${p.stops.join(',')})` }));
const gradient = {
  name: 'Hourglow', blurb: 'Colour that sweeps around the dial with the time.', category: 'Analog',
  options: [
    { key: 'palette', label: 'Palette', type: 'swatch', choices: PALETTES },
    { key: 'follow', label: 'Colour follows', type: 'choice', choices: [{ v: 'hour', label: 'Hour' }, { v: 'minute', label: 'Minute' }] },
    { key: 'ticks', label: 'Hour marks', type: 'bool' },
    { key: 'seconds', label: 'Seconds hand', type: 'bool' },
  ],
  defaults: { palette: 'sunset', follow: 'hour', ticks: true, seconds: false },
  ink: () => '#ffffff',
  create(root, o, { w, h }) {
    const p = pick(PALETTES, o.palette);
    const bg = document.createElement('div');
    bg.className = 'face-fill';
    root.appendChild(bg);
    const vign = document.createElement('div');
    vign.className = 'face-fill';
    vign.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)';
    root.appendChild(vign);
    const svg = makeSvg(root, w, h);
    svg.style.position = 'absolute'; svg.style.inset = '0';
    const { cx, cy, R } = dialBox(w, h, 0.45, arguments[2]);
    if (o.ticks) for (let i = 0; i < 12; i++) {
      const [x1, y1] = polar(cx, cy, R * 0.88, i * 30), [x2, y2] = polar(cx, cy, R, i * 30);
      el('line', { x1, y1, x2, y2, stroke: '#fff', 'stroke-width': R * (i % 3 ? 0.012 : 0.022), 'stroke-linecap': 'round', opacity: 0.9 }, svg);
    }
    const hand = (L, wd) => {
      const g = el('g', {}, svg);
      el('rect', { x: -wd / 2, y: -L, width: wd, height: L + wd, rx: wd / 2, fill: '#fff' }, g);
      return g;
    };
    const hourH = hand(R * 0.52, R * 0.035), minH = hand(R * 0.82, R * 0.025);
    let secH = null;
    if (o.seconds) { secH = el('g', {}, svg); el('line', { x1: 0, y1: R * 0.1, x2: 0, y2: -R * 0.9, stroke: '#fff', 'stroke-width': R * 0.007, opacity: 0.8 }, secH); }
    el('circle', { cx, cy, r: R * 0.035, fill: '#fff' }, svg);
    let lastBg = '';
    return {
      update(now, smooth) {
        const a = angles(now);
        rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m);
        if (secH) rot(secH, cx, cy, smooth ? a.s : a.sTick);
        const ang = Math.round((o.follow === 'minute' ? a.m : a.h) * 4) / 4;
        const css = `conic-gradient(from ${ang}deg at 50% 50%, ${p.stops.join(',')})`;
        if (css !== lastBg) { bg.style.background = css; lastBg = css; }
      },
    };
  },
};

// ============================================================ Modular
const modular = {
  name: 'Modular', blurb: 'Big time with four live panels: pick what they show in Customize (weather, calendar, sensors, music…).', category: 'Digital',
  options: [
    { key: 'color', label: 'Colour', type: 'swatch', choices: DIGI },
    { key: 'font', label: 'Font', type: 'choice', choices: [{ v: 'rounded', label: 'Rounded' }, { v: 'bold', label: 'Bold' }, { v: 'thin', label: 'Thin' }, { v: 'condensed', label: 'Narrow' }] },
    { key: 'seconds', label: 'Seconds', type: 'bool' },
  ],
  defaults: { color: 'white', font: 'rounded', seconds: false },
  ink: () => '#fff',
  modular: true,
  create(root, o, { w, h, use24h }) {
    const col = pick(DIGI, o.color).color;
    root.parentElement.style.setProperty('--mod', col);
    const svg = makeSvg(root, w, h);
    el('rect', { width: w, height: h, fill: '#000' }, svg);
    const [family, weight] = DIGI_FONTS[o.font] || DIGI_FONTS.rounded;
    const size = Math.min(w * 0.24, h * 0.34);
    const time = el('text', { x: w / 2, y: h / 2 + size * 0.34, 'text-anchor': 'middle', 'font-family': family, 'font-weight': weight, 'font-size': size, fill: col, style: 'font-variant-numeric: tabular-nums' }, svg);
    const date = el('text', { x: w / 2, y: h / 2 - size * 0.62, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-weight': 600, 'font-size': size * 0.13, fill: 'rgba(255,255,255,0.7)', 'letter-spacing': '0.12em' }, svg);
    const small = el('text', { x: w / 2, y: h / 2 + size * 0.68, 'text-anchor': 'middle', 'font-family': family, 'font-weight': weight, 'font-size': size * 0.15, fill: 'rgba(255,255,255,0.55)', style: 'font-variant-numeric: tabular-nums' }, svg);
    let last = '';
    return {
      update(now) {
        const t = hhmm(now, use24h), key = t.hh + t.mm + t.ss + now.getDate();
        if (key === last) return; last = key;
        time.textContent = `${t.hh}:${t.mm}`;
        date.textContent = `${dayName(now, 'long')} ${now.getDate()} ${monthName(now, 'long')}`.toUpperCase();
        small.textContent = [o.seconds ? t.ss : '', use24h ? '' : t.ampm].filter(Boolean).join('  ');
      },
    };
  },
};

// ============================================================ Word clock
/** Letter size: share of each grid cell the letter fills, and its weight. */
const LETTER = { normal: [0.56, 600], large: [0.7, 700], huge: [0.84, 800] };
const SIZE_OPT = { key: 'size', label: 'Letter size', type: 'choice', choices: [{ v: 'normal', label: 'Normal' }, { v: 'large', label: 'Large' }, { v: 'huge', label: 'Huge' }] };
const WORD_ROWS = ['ITLISASAMPM', 'ACQUARTERDC', 'TWENTYFIVEX', 'HALFSTENFTO', 'PASTERUNINE', 'ONESIXTHREE', 'FOURFIVETWO', 'EIGHTELEVEN', 'SEVENTWELVE', 'TENSEOCLOCK'];
const WORDS = {
  IT: [0, 0, 2], IS: [0, 3, 2], A: [1, 0, 1], QUARTER: [1, 2, 7], TWENTY: [2, 0, 6], FIVE_M: [2, 6, 4], HALF: [3, 0, 4], TEN_M: [3, 5, 3], TO: [3, 9, 2], PAST: [4, 0, 4],
  9: [4, 7, 4], 1: [5, 0, 3], 6: [5, 3, 3], 3: [5, 6, 5], 4: [6, 0, 4], 5: [6, 4, 4], 2: [6, 8, 3], 8: [7, 0, 5], 11: [7, 5, 6], 7: [8, 0, 5], 12: [8, 5, 6], 10: [9, 0, 3], OCLOCK: [9, 5, 6],
};
function wordsFor(now) {
  const m = Math.floor(now.getMinutes() / 5) * 5;
  let hr = now.getHours() % 12 || 12;
  const w = ['IT', 'IS'];
  const next = () => (hr % 12) + 1;
  const ms = { 5: ['FIVE_M', 'PAST'], 10: ['TEN_M', 'PAST'], 15: ['A', 'QUARTER', 'PAST'], 20: ['TWENTY', 'PAST'], 25: ['TWENTY', 'FIVE_M', 'PAST'], 30: ['HALF', 'PAST'],
    35: ['TWENTY', 'FIVE_M', 'TO'], 40: ['TWENTY', 'TO'], 45: ['A', 'QUARTER', 'TO'], 50: ['TEN_M', 'TO'], 55: ['FIVE_M', 'TO'] };
  if (m === 0) w.push(String(hr), 'OCLOCK');
  else { w.push(...ms[m]); if (m > 30) hr = next(); w.push(String(hr)); }
  return w;
}
const WORD_BG = [
  { v: 'black', label: 'Black', color: '#000000', dim: 'rgba(255,255,255,0.10)' },
  { v: 'walnut', label: 'Walnut', color: '#2a1d14', dim: 'rgba(255,236,210,0.12)' },
  { v: 'slate', label: 'Slate', color: '#1c2430', dim: 'rgba(255,255,255,0.11)' },
  { v: 'paper', label: 'Paper', color: '#efe6d2', dim: 'rgba(45,36,24,0.14)', light: true },
];
const wordclock = {
  name: 'Word clock', blurb: 'The time in words: “It is half past ten.”', category: 'Words',
  options: [
    { key: 'color', label: 'Lit letters', type: 'swatch', choices: [...DIGI, { v: 'ink', label: 'Ink', color: '#2d2418' }] },
    { key: 'bg', label: 'Background', type: 'swatch', choices: WORD_BG, custom: true },
    { key: 'font', label: 'Font', type: 'choice', choices: [{ v: 'sans', label: 'Sans' }, { v: 'serif', label: 'Serif' }, { v: 'mono', label: 'Mono' }, { v: 'condensed', label: 'Narrow' }] },
    { key: 'dots', label: 'Minute dots', type: 'bool' },
    SIZE_OPT,
  ],
  defaults: { color: 'white', bg: 'black', font: 'sans', dots: true, size: 'normal' },
  ink: (o) => (pick(WORD_BG, o.bg).light ? '#2d2418' : '#fff'),
  create(root, o, { w, h }) {
    const bg = pick(WORD_BG, o.bg);
    const litC = o.color === 'ink' ? '#2d2418' : pick(DIGI, o.color).color;
    const lit = bg.light && /^#[0-9a-f]{6}$/i.test(litC) && lumOf(litC) > 0.6 ? '#2d2418' : litC;
    const svg = makeSvg(root, w, h);
    el('rect', { width: w, height: h, fill: bg.color }, svg);
    const id = 'wg' + ++uid;
    const f = el('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }, el('defs', {}, svg));
    el('feGaussianBlur', { stdDeviation: Math.min(w, h) * 0.006, result: 'b' }, f);
    const mg = el('feMerge', {}, f); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
    const cols = 11, rows = WORD_ROWS.length;
    const cell = Math.min((w * 0.84) / cols, (h * 0.84) / rows);
    const x0 = (w - cell * cols) / 2 + cell / 2, y0 = (h - cell * rows) / 2 + cell / 2;
    const family = FONT[o.font] || FONT.sans;
    const [lk, lw] = LETTER[o.size] || [0.58, 600];
    const letters = WORD_ROWS.map((r, ri) => [...r].map((ch, ci) => el('text', { x: x0 + ci * cell, y: y0 + ri * cell + cell * lk * 0.36, 'text-anchor': 'middle', 'font-family': family, 'font-weight': lw, 'font-size': cell * lk, fill: bg.dim }, svg, ch)));
    const dots = [];
    if (o.dots) {
      const r = cell * 0.09, inset = cell * 0.55;
      for (const [dx, dy] of [[inset, inset], [w - inset, inset], [w - inset, h - inset], [inset, h - inset]]) dots.push(el('circle', { cx: dx, cy: dy, r, fill: bg.dim }, svg));
    }
    let last = '';
    return {
      update(now) {
        const key = `${now.getHours()}:${now.getMinutes()}`;
        if (key === last) return; last = key;
        const on = new Set();
        for (const wd of wordsFor(now)) { const [r, c, n] = WORDS[wd]; for (let i = 0; i < n; i++) on.add(`${r},${c + i}`); }
        letters.forEach((row, ri) => row.forEach((t, ci) => {
          const yes = on.has(`${ri},${ci}`);
          t.setAttribute('fill', yes ? lit : bg.dim);
          if (yes && !bg.light) t.setAttribute('filter', `url(#${id})`); else t.removeAttribute('filter');
        }));
        const extra = now.getMinutes() % 5;
        dots.forEach((d, i) => d.setAttribute('fill', i < extra ? lit : bg.dim));
      },
    };
  },
};

// ============================================================ Mid-century faces (original designs in the spirit of the era)
const MCM_DIALS = [
  { v: 'walnut', label: 'Walnut', color: '#2a1d14', c2: '#3b2a1d', ink: '#f6ead8', metal: '#d9a441' },
  { v: 'teal', label: 'Teal', color: '#1f5f5b', c2: '#2a7671', ink: '#f6ead8', metal: '#e8b13a' },
  { v: 'cream', label: 'Cream', color: '#efe6d2', c2: '#f7f1e3', ink: '#2d2418', metal: '#b8862b' },
  { v: 'mustard', label: 'Mustard', color: '#d9a441', c2: '#e6b85a', ink: '#2a1d14', metal: '#2a1d14' },
  { v: 'charcoal', label: 'Charcoal', color: '#1c1c1e', c2: '#2a2a2d', ink: '#f2ede2', metal: '#d9a441' },
];
const MCM_PAL = ['#e8b13a', '#2f7f7a', '#d9822b', '#e0567f', '#4fb3a9', '#c2541f'];
/** A tapered, rounded hand drawn pointing up (rotated by the ticker). */
function taperHand(svg, L, wBase, fill, tail = 0) {
  const g = el('g', {}, svg);
  el('path', { d: `M${-wBase / 2} ${tail} L${-wBase * 0.18} ${-L} Q0 ${-L - wBase * 0.4} ${wBase * 0.18} ${-L} L${wBase / 2} ${tail} Z`, fill }, g);
  return g;
}
const dialBg = (svg, w, h, d) => {
  const id = 'mg' + ++uid;
  const g = el('radialGradient', { id, cx: '50%', cy: '45%', r: '70%' }, el('defs', {}, svg));
  el('stop', { offset: '0', 'stop-color': d.c2 }, g); el('stop', { offset: '1', 'stop-color': d.color }, g);
  el('rect', { width: w, height: h, fill: `url(#${id})` }, svg);
};

const starburst = {
  name: 'Starburst', blurb: 'Brass rays bursting from the centre, like a 1950s living-room clock.', category: 'Mid-century',
  options: [
    { key: 'dial', label: 'Dial', type: 'swatch', choices: MCM_DIALS, custom: true },
    { key: 'rays', label: 'Rays', type: 'choice', choices: [{ v: 'long', label: 'Long & short' }, { v: 'even', label: 'Even' }, { v: 'dots', label: 'With dots' }] },
    { key: 'seconds', label: 'Seconds hand', type: 'bool' },
  ],
  defaults: { dial: 'walnut', rays: 'long', seconds: true },
  ink: (o) => pick(MCM_DIALS, o.dial).ink,
  create(root, o, { w, h }) {
    const d = pick(MCM_DIALS, o.dial);
    const svg = makeSvg(root, w, h);
    dialBg(svg, w, h, d);
    const { cx, cy, R } = dialBox(w, h, 0.47, arguments[2]);
    const rays = el('g', { fill: d.metal }, svg);
    for (let i = 0; i < 48; i++) {
      const hour = i % 4 === 0;
      const inner = R * 0.3, outer = o.rays === 'even' ? R * 0.92 : hour ? R : i % 2 ? R * 0.72 : R * 0.84;
      const wid = hour ? R * 0.022 : R * 0.012;
      const a = i * 7.5;
      const [x1, y1] = polar(cx, cy, inner, a - 0.6), [x2, y2] = polar(cx, cy, inner, a + 0.6);
      const [tx, ty] = polar(cx, cy, outer, a);
      const [lx, ly] = polar(cx, cy, outer - wid * 2, a - (wid / outer) * 57), [rx2, ry2] = polar(cx, cy, outer - wid * 2, a + (wid / outer) * 57);
      el('path', { d: `M${x1} ${y1} L${lx} ${ly} L${tx} ${ty} L${rx2} ${ry2} L${x2} ${y2} Z`, opacity: hour ? 1 : 0.7 }, rays);
      if (o.rays === 'dots' && hour) { const [dx, dy] = polar(cx, cy, R * 0.97 + R * 0.04, a); el('circle', { cx: dx, cy: dy, r: R * 0.03 }, rays); }
    }
    el('circle', { cx, cy, r: R * 0.3, fill: d.color }, svg);
    el('circle', { cx, cy, r: R * 0.3, fill: 'none', stroke: d.metal, 'stroke-width': R * 0.012, opacity: 0.8 }, svg);
    const hourH = taperHand(svg, R * 0.5, R * 0.07, d.ink, R * 0.05);
    const minH = taperHand(svg, R * 0.78, R * 0.05, d.ink, R * 0.05);
    let secH = null;
    if (o.seconds) {
      secH = el('g', {}, svg);
      el('line', { x1: 0, y1: R * 0.12, x2: 0, y2: -R * 0.88, stroke: d.metal, 'stroke-width': R * 0.01, 'stroke-linecap': 'round' }, secH);
      el('circle', { cx: 0, cy: -R * 0.88, r: R * 0.025, fill: d.metal }, secH);
    }
    el('circle', { cx, cy, r: R * 0.035, fill: d.metal }, svg);
    return { update(now, smooth) { const a = angles(now); rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m); if (secH) rot(secH, cx, cy, smooth ? a.s : a.sTick); } };
  },
};

function atomStar(g, x, y, r, fill) {
  for (let i = 0; i < 4; i++) {
    const a = i * 45;
    const [x1, y1] = polar(x, y, r, a), [x2, y2] = polar(x, y, r, a + 180);
    el('line', { x1, y1, x2, y2, stroke: fill, 'stroke-width': r * (i % 2 ? 0.08 : 0.14), 'stroke-linecap': 'round' }, g);
  }
  el('circle', { cx: x, cy: y, r: r * 0.2, fill }, g);
}
function boomerangPath(x, y, s, rotDeg, fill, parent, opacity = 1) {
  return el('path', { transform: `translate(${x} ${y}) rotate(${rotDeg}) scale(${s})`, d: 'M-20 6 C-12 -10 10 -14 22 -4 C10 -8 -2 -2 -6 10 C-10 16 -18 14 -20 6 Z', fill, opacity }, parent);
}
const atomic = {
  name: 'Atomic', blurb: 'Atomic stars for hours, orbiting dots and a boomerang second hand.', category: 'Mid-century',
  options: [
    { key: 'dial', label: 'Dial', type: 'swatch', choices: MCM_DIALS, custom: true },
    { key: 'accent', label: 'Accent', type: 'swatch', choices: MCM_PAL.map((c, i) => ({ v: String(i), label: ['Mustard', 'Teal', 'Orange', 'Coral', 'Aqua', 'Rust'][i], color: c })) },
    { key: 'scatter', label: 'Boomerangs in the background', type: 'bool' },
  ],
  defaults: { dial: 'cream', accent: '2', scatter: true },
  ink: (o) => pick(MCM_DIALS, o.dial).ink,
  create(root, o, { w, h }) {
    const d = pick(MCM_DIALS, o.dial), acc = MCM_PAL[Number(o.accent) || 0];
    const svg = makeSvg(root, w, h);
    dialBg(svg, w, h, d);
    const { cx, cy, R } = dialBox(w, h, 0.45, arguments[2]);
    if (o.scatter) {
      const bg = el('g', {}, svg);
      let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 26; i++) {
        const x = rnd() * w, y = rnd() * h;
        if (Math.hypot(x - cx, y - cy) < R * 1.08) continue;
        if (i % 3) boomerangPath(x, y, (0.6 + rnd() * 0.8) * Math.min(w, h) / 500, rnd() * 360, MCM_PAL[i % MCM_PAL.length], bg, 0.35);
        else el('circle', { cx: x, cy: y, r: Math.min(w, h) * (0.006 + rnd() * 0.008), fill: d.ink, opacity: 0.25 }, bg);
      }
    }
    // Orbit ring with dots for the minutes.
    el('circle', { cx, cy, r: R * 0.93, fill: 'none', stroke: d.ink, 'stroke-width': R * 0.004, opacity: 0.25 }, svg);
    for (let i = 0; i < 60; i++) if (i % 5) { const [x, y] = polar(cx, cy, R * 0.93, i * 6); el('circle', { cx: x, cy: y, r: R * 0.008, fill: d.ink, opacity: 0.45 }, svg); }
    const stars = el('g', {}, svg);
    for (let i = 0; i < 12; i++) {
      const [x, y] = polar(cx, cy, R * 0.93, i * 30);
      atomStar(stars, x, y, i % 3 === 0 ? R * 0.085 : R * 0.05, i % 3 === 0 ? acc : d.ink);
    }
    // Hands: a slim hour lozenge, a long minute needle with a disc, and a boomerang seconds hand.
    const hourH = taperHand(svg, R * 0.5, R * 0.06, d.ink, R * 0.06);
    const minH = el('g', {}, svg);
    el('path', { d: `M${-R * 0.018} ${R * 0.08} L${-R * 0.008} ${-R * 0.8} L${R * 0.008} ${-R * 0.8} L${R * 0.018} ${R * 0.08} Z`, fill: d.ink }, minH);
    el('circle', { cx: 0, cy: -R * 0.62, r: R * 0.045, fill: 'none', stroke: d.ink, 'stroke-width': R * 0.014 }, minH);
    const secH = el('g', {}, svg);
    el('line', { x1: 0, y1: R * 0.1, x2: 0, y2: -R * 0.72, stroke: acc, 'stroke-width': R * 0.008, 'stroke-linecap': 'round' }, secH);
    boomerangPath(0, -R * 0.76, R / 260, -90, acc, secH);
    el('circle', { cx, cy, r: R * 0.04, fill: acc }, svg);
    el('circle', { cx, cy, r: R * 0.015, fill: d.color }, svg);
    return { update(now, smooth) { const a = angles(now); rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m); rot(secH, cx, cy, smooth ? a.s : a.sTick); } };
  },
};

const CONFETTI_SHAPES = ['circle', 'square', 'tri', 'lozenge', 'half', 'ring'];
function shapeAt(g, kind, x, y, r, fill, rotDeg) {
  const t = `translate(${x} ${y}) rotate(${rotDeg})`;
  if (kind === 'circle') return el('circle', { cx: x, cy: y, r, fill }, g);
  if (kind === 'ring') return el('circle', { cx: x, cy: y, r: r * 0.8, fill: 'none', stroke: fill, 'stroke-width': r * 0.42 }, g);
  if (kind === 'square') return el('rect', { x: -r * 0.85, y: -r * 0.85, width: r * 1.7, height: r * 1.7, rx: r * 0.25, fill, transform: t }, g);
  if (kind === 'tri') return el('path', { d: `M0 ${-r * 1.1} L${r} ${r * 0.75} L${-r} ${r * 0.75} Z`, fill, transform: t }, g);
  if (kind === 'lozenge') return el('rect', { x: -r * 0.45, y: -r * 1.2, width: r * 0.9, height: r * 2.4, rx: r * 0.45, fill, transform: t }, g);
  return el('path', { d: `M${-r} 0 A${r} ${r} 0 0 1 ${r} 0 Z`, fill, transform: t }, g);
}
const confetti = {
  name: 'Confetti', blurb: 'A different playful shape for every hour, in mustard, teal, orange and coral.', category: 'Mid-century',
  options: [
    { key: 'dial', label: 'Dial', type: 'swatch', choices: MCM_DIALS, custom: true },
    { key: 'size', label: 'Shapes', type: 'choice', choices: [{ v: 'small', label: 'Small' }, { v: 'big', label: 'Big' }] },
    { key: 'seconds', label: 'Seconds hand', type: 'bool' },
  ],
  defaults: { dial: 'cream', size: 'big', seconds: true },
  ink: (o) => pick(MCM_DIALS, o.dial).ink,
  create(root, o, { w, h }) {
    const d = pick(MCM_DIALS, o.dial);
    const svg = makeSvg(root, w, h);
    dialBg(svg, w, h, d);
    const { cx, cy, R } = dialBox(w, h, 0.46, arguments[2]);
    const g = el('g', {}, svg);
    const r = o.size === 'small' ? R * 0.055 : R * 0.085;
    for (let i = 0; i < 12; i++) {
      const [x, y] = polar(cx, cy, R * 0.86, i * 30);
      shapeAt(g, CONFETTI_SHAPES[i % CONFETTI_SHAPES.length], x, y, i % 3 === 0 ? r * 1.25 : r, MCM_PAL[i % MCM_PAL.length], i * 30);
    }
    const hourH = el('g', {}, svg);
    el('rect', { x: -R * 0.035, y: -R * 0.5, width: R * 0.07, height: R * 0.58, rx: R * 0.035, fill: d.ink }, hourH);
    const minH = el('g', {}, svg);
    el('rect', { x: -R * 0.022, y: -R * 0.76, width: R * 0.044, height: R * 0.84, rx: R * 0.022, fill: d.ink }, minH);
    el('circle', { cx: 0, cy: -R * 0.76, r: R * 0.035, fill: MCM_PAL[0] }, minH);
    let secH = null;
    if (o.seconds) {
      secH = el('g', {}, svg);
      el('line', { x1: 0, y1: R * 0.14, x2: 0, y2: -R * 0.8, stroke: MCM_PAL[3], 'stroke-width': R * 0.009, 'stroke-linecap': 'round' }, secH);
    }
    el('circle', { cx, cy, r: R * 0.045, fill: MCM_PAL[1] }, svg);
    return { update(now, smooth) { const a = angles(now); rot(hourH, cx, cy, a.h); rot(minH, cx, cy, a.m); if (secH) rot(secH, cx, cy, smooth ? a.s : a.sTick); } };
  },
};

// ------------------------------------------------------------------ exact word clock
// "It is one twenty one in the afternoon": every word sits in the grid in reading order; the grid is
// packed to suit the screen's shape and filled with spare letters.
const HOUR_W = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const TEEN_W = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS_W = { 2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty' };
const ONES_W = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
// Teens are built from shorter pieces (FOUR + TEEN, THIR + TEEN), so the grid needs far fewer letters.
const TEEN_ROOT = { 13: 'thir', 14: 'four', 15: 'fif', 16: 'six', 17: 'seven', 18: 'eigh', 19: 'nine' };
function exactSeq(short) {
  return [
    ...(short ? [] : ['it', 'is']),
    ...['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'].map((w) => 'h:' + w),
    'm:oh', 'm:ten', 'm:eleven', 'm:twelve', ...Object.values(TENS_W).map((w) => 'm:' + w),
    ...ONES_W.slice(1).map((w) => 'o:' + w), 'o:thir', 'o:fif', 'teen', 'oclock',
    ...(short ? [] : ['in', 'at', 'the']), 'morning', 'afternoon', 'evening', 'night',
  ];
}
const wordText = (k) => (k === 'oclock' ? 'OCLOCK' : k.split(':').pop().toUpperCase());
/** The words lit for a time, e.g. 13:21 → it is one twenty one in the afternoon. */
export function exactWords(now, short = false) {
  const H = now.getHours(), M = now.getMinutes();
  const out = short ? [] : ['it', 'is'];
  out.push('h:' + HOUR_W[H % 12]);
  if (M === 0) out.push('oclock');
  else if (M < 10) out.push('m:oh', 'o:' + ONES_W[M]);
  else if (M < 13) out.push('m:' + TEEN_W[M - 10]);
  else if (M < 20) out.push('o:' + TEEN_ROOT[M], 'teen');
  else { out.push('m:' + TENS_W[Math.floor(M / 10)]); if (M % 10) out.push('o:' + ONES_W[M % 10]); }
  const part = H >= 5 && H < 12 ? 'morning' : H >= 12 && H < 17 ? 'afternoon' : H >= 17 && H < 21 ? 'evening' : 'night';
  if (!short) out.push(...(part === 'night' ? ['at'] : ['in', 'the']));
  out.push(part);
  return out;
}
/** Pack the words into rows `cols` wide (one spare letter between words). */
function packWords(seq, cols) {
  const rows = [];
  let cur = [];
  const len = (r) => r.reduce((n, k) => n + wordText(k).length, 0) + Math.max(0, r.length - 1);
  for (const k of seq) {
    if (cur.length && len([...cur, k]) > cols) { rows.push(cur); cur = []; }
    cur.push(k);
  }
  if (cur.length) rows.push(cur);
  return rows;
}
function exactGrid(w, h, short, margin) {
  const seq = exactSeq(short);
  const target = (w * margin) / (h * margin);
  let best = null;
  for (let c = 9; c <= 26; c++) {
    const rows = packWords(seq, c);
    if (rows.some((r) => r.reduce((n, k) => n + wordText(k).length, 0) + r.length - 1 > c)) continue;
    // Prefer the grid whose letters come out biggest on this screen.
    const cell = Math.min((w * margin) / c, (h * margin) / rows.length);
    const score = cell - Math.abs(Math.log(c / rows.length / target)) * 0.01;
    if (!best || score > best.score) best = { c, rows, score };
  }
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const FILL = 'ABCDEFGHIJKLMNOPRSTUVWXYZ';
  const cells = [], where = {};
  best.rows.forEach((r, ri) => {
    const used = r.reduce((n, k) => n + wordText(k).length, 0);
    const gaps = r.length + 1, spare = best.c - used;
    const gapLen = Array.from({ length: gaps }, (_, i) => (i === 0 || i === gaps - 1 ? 0 : 1));
    let left = spare - (r.length - 1);
    for (let i = 0; left > 0; i = (i + 1) % gaps) { gapLen[i]++; left--; }
    const row = [];
    r.forEach((k, i) => {
      for (let g = 0; g < gapLen[i]; g++) row.push(FILL[Math.floor(rnd() * FILL.length)]);
      where[k] = [ri, row.length, wordText(k).length];
      row.push(...wordText(k));
    });
    for (let g = 0; g < gapLen[gaps - 1]; g++) row.push(FILL[Math.floor(rnd() * FILL.length)]);
    cells.push(row);
  });
  where['o:eigh'] = where['o:eight'] && [where['o:eight'][0], where['o:eight'][1], 4]; // EIGHteen lights the first four letters of EIGHT
  return { cols: best.c, cells, where };
}
const wordexact = {
  name: 'Word clock: exact', blurb: 'The exact time in words: “It is one twenty one in the afternoon.”', category: 'Words',
  options: [
    ...wordclock.options.filter((x) => x.key !== 'dots' && x.key !== 'size'),
    { key: 'words', label: 'Words', type: 'choice', choices: [{ v: 'full', label: 'Full sentence' }, { v: 'short', label: 'Short (bigger letters)' }] },
    SIZE_OPT,
  ],
  defaults: { color: 'white', bg: 'black', font: 'sans', words: 'full', size: 'large' },
  ink: wordclock.ink,
  create(root, o, { w, h }) {
    const bg = pick(WORD_BG, o.bg);
    const litC = o.color === 'ink' ? '#2d2418' : pick(DIGI, o.color).color;
    const lit = bg.light && /^#[0-9a-f]{6}$/i.test(litC) && lumOf(litC) > 0.6 ? '#2d2418' : litC;
    const short = o.words === 'short';
    const svg = makeSvg(root, w, h);
    el('rect', { width: w, height: h, fill: bg.color }, svg);
    const id = 'we' + ++uid;
    const f = el('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }, el('defs', {}, svg));
    el('feGaussianBlur', { stdDeviation: Math.min(w, h) * 0.005, result: 'b' }, f);
    const mg = el('feMerge', {}, f); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
    const margin = 0.93;
    const g = exactGrid(w, h, short, margin);
    const rows = g.cells.length;
    const cell = Math.min((w * margin) / g.cols, (h * margin) / rows);
    const x0 = (w - cell * g.cols) / 2 + cell / 2, y0 = (h - cell * rows) / 2 + cell / 2;
    const family = FONT[o.font] || FONT.sans;
    const [k, weight] = LETTER[o.size] || LETTER.large;
    const letters = g.cells.map((r, ri) => r.map((ch, ci) => el('text', { x: x0 + ci * cell, y: y0 + ri * cell + cell * k * 0.36, 'text-anchor': 'middle', 'font-family': family, 'font-weight': weight, 'font-size': cell * k, fill: bg.dim }, svg, ch)));
    let last = '';
    return {
      update(now) {
        const key = `${now.getHours()}:${now.getMinutes()}`;
        if (key === last) return; last = key;
        const on = new Set();
        for (const wd of exactWords(now, short)) { const p = g.where[wd]; if (!p) continue; const [r, c, n] = p; for (let i = 0; i < n; i++) on.add(`${r},${c + i}`); }
        letters.forEach((row, ri) => row.forEach((t, ci) => {
          const yes = on.has(`${ri},${ci}`);
          t.setAttribute('fill', yes ? lit : bg.dim);
          if (yes && !bg.light) t.setAttribute('filter', `url(#${id})`); else t.removeAttribute('filter');
        }));
      },
    };
  },
};

// ------------------------------------------------------------------ sunrise / sunset dial
const SUN_PAL = [
  { v: 'night', label: 'Night', bg: '#0b1020', bg2: '#1b2340', ring: '#1d2747', day: ['#ffb347', '#ffd77a'], ink: '#f4f1e8', dim: 'rgba(244,241,232,0.45)' },
  { v: 'paper', label: 'Paper', bg: '#f3eee2', bg2: '#fbf8f0', ring: '#dcd3bf', day: ['#f08a24', '#f6c046'], ink: '#2b2418', dim: 'rgba(43,36,24,0.45)', moon: '#5b6380' },
  { v: 'teal', label: 'MCM teal', bg: '#14403d', bg2: '#1f5f5b', ring: '#173f3c', day: ['#e8b13a', '#f6d77a'], ink: '#f6ead8', dim: 'rgba(246,234,216,0.5)' },
];
const minsOf = (iso) => { const d = iso && new Date(iso); return d && !Number.isNaN(d.getTime()) ? d.getHours() * 60 + d.getMinutes() : null; };
const sunclock = {
  name: 'Sunrise & sunset', blurb: 'A 24-hour dial with today’s daylight, the sun moving round it, and the next sunrise or sunset.', category: 'Fun',
  options: [{ key: 'pal', label: 'Colours', type: 'swatch', choices: SUN_PAL.map((p) => ({ v: p.v, label: p.label, color: p.bg2 })) }],
  defaults: { pal: 'night' },
  ink: (o) => pick(SUN_PAL, o.pal).ink,
  create(root, o, ctx) {
    const { w, h, store } = ctx;
    const P = pick(SUN_PAL, o.pal);
    const svg = makeSvg(root, w, h);
    const id = 'sun' + ++uid;
    const defs = el('defs', {}, svg);
    const bgG = el('radialGradient', { id: id + 'bg', cx: '50%', cy: '45%', r: '75%' }, defs);
    el('stop', { offset: '0', 'stop-color': P.bg2 }, bgG); el('stop', { offset: '1', 'stop-color': P.bg }, bgG);
    const dayG = el('linearGradient', { id: id + 'day', x1: '0', y1: '1', x2: '0', y2: '0' }, defs);
    el('stop', { offset: '0', 'stop-color': P.day[0] }, dayG); el('stop', { offset: '1', 'stop-color': P.day[1] }, dayG);
    const glow = el('filter', { id: id + 'gl', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
    el('feGaussianBlur', { stdDeviation: Math.min(w, h) * 0.012 }, glow);
    el('rect', { width: w, height: h, fill: `url(#${id}bg)` }, svg);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4, sw = R * 0.11;
    const ang = (m) => (m / 1440) * Math.PI * 2 + Math.PI; // midnight at the bottom, noon at the top
    const pt = (m, r = R) => [cx + r * Math.sin(ang(m)), cy - r * Math.cos(ang(m))];
    el('circle', { cx, cy, r: R, fill: 'none', stroke: P.ring, 'stroke-width': sw }, svg);
    const dayArc = el('path', { fill: 'none', stroke: `url(#${id}day)`, 'stroke-width': sw, 'stroke-linecap': 'round' }, svg);
    // Hour marks: long every 6 hours with labels, short every hour.
    for (let hr = 0; hr < 24; hr++) {
      const m = hr * 60, major = hr % 6 === 0;
      const [x1, y1] = pt(m, R - sw * 0.9), [x2, y2] = pt(m, R - sw * (major ? 1.6 : 1.2));
      el('line', { x1, y1, x2, y2, stroke: P.dim, 'stroke-width': major ? 2.4 : 1.2, 'stroke-linecap': 'round' }, svg);
      if (major) {
        const [tx, ty] = pt(m, R + sw * 1.35);
        const label = hr === 0 ? 'midnight' : hr === 12 ? 'noon' : ctx.use24h ? `${hr}:00` : `${hr % 12} ${hr < 12 ? 'am' : 'pm'}`;
        el('text', { x: tx, y: ty + R * 0.025, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-size': R * 0.07, 'font-weight': 600, fill: P.dim }, svg, label);
      }
    }
    const sunG = el('g', {}, svg);
    el('circle', { r: sw * 0.95, fill: P.day[1], filter: `url(#${id}gl)` }, sunG);
    const sunDot = el('circle', { r: sw * 0.62, fill: P.day[1] }, sunG);
    const moon = el('path', { d: `M ${sw * 0.3} ${-sw * 0.6} A ${sw * 0.62} ${sw * 0.62} 0 1 0 ${sw * 0.3} ${sw * 0.6} A ${sw * 0.48} ${sw * 0.48} 0 1 1 ${sw * 0.3} ${-sw * 0.6} Z`, fill: P.moon || '#e8e6f0' }, sunG);
    const riseT = el('text', { 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-size': R * 0.065, 'font-weight': 700, fill: P.day[0] }, svg);
    const setT = el('text', { 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-size': R * 0.065, 'font-weight': 700, fill: P.day[0] }, svg);
    const timeT = el('text', { x: cx, y: cy + R * 0.06, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-size': R * 0.36, 'font-weight': 300, fill: P.ink, 'letter-spacing': '-0.02em' }, svg);
    const dateT = el('text', { x: cx, y: cy - R * 0.32, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-size': R * 0.075, 'font-weight': 600, fill: P.dim }, svg);
    const nextT = el('text', { x: cx, y: cy + R * 0.3, 'text-anchor': 'middle', 'font-family': FONT.sans, 'font-size': R * 0.08, 'font-weight': 600, fill: P.ink }, svg);
    const fmt = (m) => { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !ctx.use24h }); };
    const dur = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`);
    let lastKey = '';
    return {
      update(now) {
        const sun = store?.get('sun.sun')?.attributes || {};
        const rise = minsOf(sun.next_rising) ?? 390, set = minsOf(sun.next_setting) ?? 1080;
        const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        const key = `${rise}|${set}|${Math.floor(m)}`;
        const [sx, sy] = pt(m);
        sunG.setAttribute('transform', `translate(${sx} ${sy})`);
        const isDay = m >= rise && m < set;
        sunDot.style.display = isDay ? '' : 'none'; sunG.firstChild.style.display = isDay ? '' : 'none'; moon.style.display = isDay ? 'none' : '';
        if (key === lastKey) return; lastKey = key;
        const [ax, ay] = pt(rise), [bx, by] = pt(set);
        const span = (set - rise + 1440) % 1440;
        dayArc.setAttribute('d', `M ${ax} ${ay} A ${R} ${R} 0 ${span > 720 ? 1 : 0} 1 ${bx} ${by}`);
        const [rx, ry] = pt(rise, R - sw * 2.4), [qx, qy] = pt(set, R - sw * 2.4);
        riseT.setAttribute('x', rx); riseT.setAttribute('y', ry); riseT.textContent = '↑ ' + fmt(rise);
        setT.setAttribute('x', qx); setT.setAttribute('y', qy); setT.textContent = '↓ ' + fmt(set);
        timeT.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !ctx.use24h }).replace(/\s?[AP]\.?M\.?$/i, '');
        dateT.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const toSet = Math.round(set - m), toRise = Math.round((rise - m + 1440) % 1440);
        nextT.textContent = isDay ? `Sunset in ${dur(toSet)}` : `Sunrise in ${dur(toRise)}`;
      },
    };
  },
};

// ------------------------------------------------------------------ weather sky
const SKY = { // top, bottom colours at each phase
  night: ['#060b1d', '#1b2850'], dawn: ['#3d5a9e', '#f4a07c'], day: ['#2f86d6', '#a9d6f5'], golden: ['#4f62b0', '#ff9d5c'], dusk: ['#1d1d4a', '#c9677a'],
};
const mixHex = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const sky = {
  name: 'Weather sky', blurb: 'The whole screen becomes the sky outside: sun or moon, clouds, rain, snow or stars, with the time and temperature.', category: 'Fun',
  options: [
    { key: 'layout', label: 'Time', type: 'choice', choices: [{ v: 'corner', label: 'Bottom left' }, { v: 'center', label: 'Centre' }] },
  ],
  defaults: { layout: 'corner' },
  ink: () => '#fff',
  create(root, o, ctx) {
    const { w, h, store } = ctx;
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    const cv = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    root.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const center = o.layout === 'center';
    const txt = document.createElement('div');
    txt.style.cssText = `position:absolute;${center ? 'inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center' : 'left:5vmin;bottom:5vmin'};color:#fff;font-family:${FONT.sans};text-shadow:0 2px 24px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.3)`;
    txt.innerHTML = `<div class="sk-time" style="font-size:${center ? 24 : 19}vmin;font-weight:250;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums"></div><div class="sk-temp" style="font-size:${center ? 6 : 5.4}vmin;font-weight:500;margin-top:1.4vmin;opacity:.95"></div><div class="sk-date" style="font-size:3vmin;font-weight:600;opacity:.8;margin-top:.8vmin"></div>`;
    root.appendChild(txt);
    const [tEl, wEl, dEl] = txt.children;
    const R = Math.random;
    const stars = Array.from({ length: 140 }, () => ({ x: R() * w, y: R() * h * 0.7, r: R() * 1.3 + 0.3, p: R() * 6 }));
    const clouds = Array.from({ length: 9 }, (_, i) => ({ x: R() * w * 1.4 - w * 0.2, y: h * (0.08 + R() * 0.45), s: 0.6 + R() * 0.9, v: 0.06 + R() * 0.12, k: i }));
    const drops = Array.from({ length: 220 }, () => ({ x: R() * w, y: R() * h, z: 0.4 + R() * 0.6, a: R() * 6 }));
    let last = 0, flash = 0, lastText = '';
    const weatherId = () => store?.settings?.header?.weather && store.get(store.settings.header.weather) ? store.settings.header.weather : store?.list?.(['weather'])?.[0]?.entity_id;
    const cloud = (x, y, s, col) => {
      g.fillStyle = col;
      g.beginPath();
      for (const [dx, dy, r] of [[0, 0, 60], [55, -22, 52], [105, 0, 58], [50, 18, 55], [-45, 12, 42], [150, 14, 40]]) { g.moveTo(x + (dx + r) * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
      g.fill();
    };
    return {
      update(now) {
        const t = now.getTime();
        if (t - last < 40) return; // ~25 frames a second is plenty
        const dt = last ? Math.min(100, t - last) / 16.7 : 1; last = t;
        const wid = weatherId(), ws = wid ? store.get(wid) : null, cond = ws?.state || 'sunny', a = ws?.attributes || {};
        const sun = store?.get('sun.sun')?.attributes || {};
        const rise = minsOf(sun.next_rising) ?? 390, set = minsOf(sun.next_setting) ?? 1080;
        const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
        // Where we are in the day, as sky colours.
        const near = (c, span) => Math.max(0, 1 - Math.abs(m - c) / span);
        let top, bot;
        if (m < rise - 45 || m > set + 60) [top, bot] = SKY.night;
        else if (m < rise + 40) { const k = (m - (rise - 45)) / 85; [top, bot] = [mixHex(SKY.night[0], SKY.dawn[0], Math.min(1, k * 1.6)), mixHex(SKY.night[1], SKY.dawn[1], Math.min(1, k * 1.6))]; if (k > 0.6) [top, bot] = [mixHex(SKY.dawn[0], SKY.day[0], (k - 0.6) / 0.4), mixHex(SKY.dawn[1], SKY.day[1], (k - 0.6) / 0.4)]; }
        else if (m < set - 70) [top, bot] = SKY.day;
        else if (m < set + 10) { const k = (m - (set - 70)) / 80; [top, bot] = [mixHex(SKY.day[0], SKY.golden[0], k), mixHex(SKY.day[1], SKY.golden[1], k)]; }
        else { const k = (m - (set + 10)) / 50; [top, bot] = [mixHex(SKY.dusk[0], SKY.night[0], k), mixHex(SKY.dusk[1], SKY.night[1], k)]; }
        const overcast = { cloudy: 0.65, rainy: 0.6, pouring: 0.75, 'lightning-rainy': 0.8, lightning: 0.7, snowy: 0.55, 'snowy-rainy': 0.6, fog: 0.7, hail: 0.7, partlycloudy: 0.15, windy: 0.25, 'windy-variant': 0.35 }[cond] || 0;
        const isNight = m < rise - 20 || m > set + 30;
        const grey = isNight ? '#1a1d26' : '#8a93a3';
        const sky = g.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, top); sky.addColorStop(1, bot);
        g.fillStyle = sky; g.fillRect(0, 0, w, h);
        if (overcast) { g.globalAlpha = overcast * 0.85; g.fillStyle = grey; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
        // Stars and moon at night; the sun by day.
        if (isNight && overcast < 0.5) {
          for (const s of stars) { g.globalAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 900 + s.p))) * (1 - overcast * 1.6); g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill(); }
          g.globalAlpha = 1 - overcast;
          const mx = w * 0.78, my = h * 0.2, mr = Math.min(w, h) * 0.05;
          const mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 4); mg.addColorStop(0, 'rgba(230,235,255,0.35)'); mg.addColorStop(1, 'rgba(230,235,255,0)');
          g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
          g.fillStyle = '#f2f0e6'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        } else if (!isNight && overcast < 0.6) {
          const p = Math.max(0, Math.min(1, (m - rise) / (set - rise)));
          const sx = w * (0.1 + 0.8 * p), sy = h * (0.75 - Math.sin(p * Math.PI) * 0.6), sr = Math.min(w, h) * 0.06;
          const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
          sg.addColorStop(0, `rgba(255,240,200,${0.9 - overcast})`); sg.addColorStop(0.2, `rgba(255,220,150,${0.45 - overcast * 0.5})`); sg.addColorStop(1, 'rgba(255,210,140,0)');
          g.fillStyle = sg; g.fillRect(0, 0, w, h);
          g.globalAlpha = 1 - overcast; g.fillStyle = '#fff7df'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        }
        // Clouds drift across.
        const nClouds = overcast >= 0.5 ? 9 : cond === 'partlycloudy' || cond.startsWith('windy') ? 5 : cond === 'sunny' || cond === 'clear-night' ? 1 : 3;
        const speed = cond.startsWith('windy') ? 4 : 1;
        for (const c of clouds.slice(0, nClouds)) {
          c.x += c.v * speed * dt * (0.6 + c.s * 0.4);
          if (c.x - 200 * c.s > w) c.x = -260 * c.s;
          const col = isNight ? `rgba(70,78,100,${0.55 + overcast * 0.3})` : overcast > 0.4 ? `rgba(200,205,215,${0.75})` : 'rgba(255,255,255,0.85)';
          cloud(c.x, c.y, c.s * Math.min(w, h) / 700, col);
        }
        // Rain, snow, fog, lightning.
        if (/rain|pouring|lightning|hail/.test(cond)) {
          const n = cond === 'pouring' ? 220 : 130;
          g.strokeStyle = 'rgba(210,225,255,0.45)'; g.lineWidth = 1.3; g.beginPath();
          for (const d of drops.slice(0, n)) { d.y += (12 + d.z * 10) * dt; d.x -= 2 * dt; if (d.y > h) { d.y = -20; d.x = R() * (w + 80); } g.moveTo(d.x, d.y); g.lineTo(d.x + 3, d.y - 16 * d.z); }
          g.stroke();
          if (/lightning/.test(cond)) { if (flash <= 0 && R() < 0.004) flash = 1; if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.5})`; g.fillRect(0, 0, w, h); flash -= 0.08 * dt; } }
        } else if (/snow/.test(cond)) {
          g.fillStyle = 'rgba(255,255,255,0.85)';
          for (const d of drops.slice(0, 160)) { d.a += 0.02 * dt; d.y += (0.8 + d.z * 1.4) * dt; d.x += Math.sin(d.a) * 0.6 * dt; if (d.y > h) { d.y = -5; d.x = R() * w; } g.beginPath(); g.arc(d.x, d.y, 1.2 + d.z * 2.4, 0, Math.PI * 2); g.fill(); }
        } else if (cond === 'fog') {
          for (let i = 0; i < 4; i++) { const y = h * (0.35 + i * 0.17) + Math.sin(t / 4000 + i) * 12; const fg = g.createLinearGradient(0, y - 80, 0, y + 80); fg.addColorStop(0, 'rgba(220,225,230,0)'); fg.addColorStop(0.5, 'rgba(220,225,230,0.35)'); fg.addColorStop(1, 'rgba(220,225,230,0)'); g.fillStyle = fg; g.fillRect(0, y - 80, w, 160); }
        }
        // The words.
        const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !ctx.use24h }).replace(/\s?[AP]\.?M\.?$/i, '');
        const label = WX_TEXT[cond] || cond;
        const temp = a.temperature != null ? `${Math.round(a.temperature)}° · ${label}` : label;
        const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        const key = time + temp + date;
        if (key !== lastText) { lastText = key; tEl.textContent = time; wEl.textContent = temp; dEl.textContent = date; }
      },
    };
  },
};

// ------------------------------------------------------------------ departure board (split-flap)
const FLAP_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.,°-/!?&+%#';
const BOARD_COL = [
  { v: 'classic', label: 'Airport yellow', ink: '#f6c945', bg: '#0d0d0f', tile: '#1c1c20' },
  { v: 'white', label: 'Station white', ink: '#f2f2f2', bg: '#0a0c10', tile: '#1a1d24' },
  { v: 'amber', label: 'Amber', ink: '#ffae42', bg: '#100b06', tile: '#22180e' },
  { v: 'green', label: 'Green', ink: '#7ee08a', bg: '#06100a', tile: '#0f2116' },
];
const board = {
  name: 'Departure board', blurb: 'A split-flap board: the time, weather, your next events, sunset and countdowns, clattering into place.', category: 'Fun',
  options: [
    { key: 'col', label: 'Colours', type: 'swatch', choices: BOARD_COL.map((c) => ({ v: c.v, label: c.label, color: c.ink })) },
    { key: 'sound', label: 'Flap sound', type: 'bool' },
  ],
  defaults: { col: 'classic', sound: false },
  ink: (o) => pick(BOARD_COL, o.col).ink,
  create(root, o, ctx) {
    const { w, h, store } = ctx;
    const C = pick(BOARD_COL, o.col);
    const portrait = h > w * 1.1;
    const COLS = portrait ? 16 : 28, ROWS = 6;
    const cw = Math.min((w * 0.92) / COLS, (h * 0.8) / (ROWS + 2.6) / 1.35);
    root.style.cssText = `position:absolute;inset:0;background:${C.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${cw * 0.5}px;font-family:'Helvetica Neue',Arial,${FONT.sans}`;
    const mkRow = (n, size, cls = '') => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;gap:${size * 0.08}px`;
      const cells = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div');
        c.className = 'flap ' + cls;
        c.style.cssText = `width:${size}px;height:${size * 1.35}px;font-size:${size * 1.02}px;color:${C.ink};background:${C.tile}`;
        c.textContent = ' ';
        row.appendChild(c); cells.push({ el: c, cur: ' ', target: ' ', next: 0 });
      }
      root.appendChild(row);
      return cells;
    };
    const head = document.createElement('div');
    head.style.cssText = `width:${cw * COLS + cw * 0.08 * (COLS - 1)}px;display:flex;justify-content:space-between;color:${C.ink};opacity:.7;font-size:${cw * 0.42}px;font-weight:700;letter-spacing:.18em`;
    head.innerHTML = '<span>✈ DEPARTURES</span><span class="bd-date"></span>';
    const clock = mkRow(portrait ? 8 : 8, cw * (portrait ? 1.7 : 1.9), 'big');
    root.appendChild(head);
    const rows = Array.from({ length: ROWS }, () => mkRow(COLS, cw));
    const all = [...clock, ...rows.flat()];
    const dateEl = head.querySelector('.bd-date');
    // Content: weather now, next events, sun, countdowns.
    let events = [], loadedAt = 0, lastMin = -1, lastStep = 0;
    const loadEvents = async () => {
      loadedAt = Date.now();
      const cals = store?.list?.(['calendar']) || [];
      const start = new Date(), end = new Date(Date.now() + 2 * 86400000);
      const lists = await Promise.all(cals.map((c) => store.events(c.entity_id, start, end).catch(() => [])));
      events = lists.flat().filter((e) => !e.allDay && new Date(e.start) > new Date(Date.now() - 15 * 60000)).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 4);
      lastMin = -1; // redraw with them
    };
    const pad = (s, n) => { s = String(s).toUpperCase().replace(/[’']/g, '').normalize('NFD').replace(/[̀-ͯ]/g, ''); s = [...s].map((ch) => (FLAP_CHARS.includes(ch) ? ch : ' ')).join(''); return s.length > n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
    const line = (left, mid, right = '') => {
      const L = 6, R = portrait || !right ? 0 : 9;
      return pad(left, L) + pad(mid, COLS - L - R) + (R ? pad(right.padStart(R), R) : '');
    };
    const hm = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !ctx.use24h }).replace(/\s?([AP])\.?M\.?$/i, '$1');
    const content = (now) => {
      const out = [];
      const wid = store?.settings?.header?.weather && store.get(store.settings.header.weather) ? store.settings.header.weather : store?.list?.(['weather'])?.[0]?.entity_id;
      const wx = wid && store.get(wid);
      if (wx) out.push(line('NOW', `${wx.attributes?.temperature != null ? Math.round(wx.attributes.temperature) + '° ' : ''}${WX_TEXT[wx.state] || wx.state}`));
      for (const e of events) {
        const st = new Date(e.start), soon = st - now < 3600000 && st > now, past = st <= now;
        out.push(line(hm(st), e.summary, past ? 'NOW' : soon ? 'BOARDING' : st.toDateString() === now.toDateString() ? 'ON TIME' : 'TOMORROW'));
      }
      const sun = store?.get('sun.sun')?.attributes;
      if (sun) { const rs = new Date(sun.next_rising), ss = new Date(sun.next_setting); const sunset = ss < rs; out.push(line(hm(sunset ? ss : rs), sunset ? 'SUNSET' : 'SUNRISE')); }
      for (const c of (store?.list?.(['countdown']) || []).filter((x) => Number(x.state) >= 0).sort((a, b) => a.state - b.state)) out.push(line(c.state === '0' ? 'TODAY' : `${c.state}D`, `${c.state === '0' ? '' : 'TO '}${c.attributes.friendly_name}`));
      while (out.length < ROWS) out.push(' '.repeat(COLS));
      return out.slice(0, ROWS);
    };
    let audio = null;
    const click = () => {
      if (!o.sound || ctx.preview) return;
      try {
        audio ||= new (window.AudioContext || window.webkitAudioContext)();
        const n = audio.createBufferSource(), buf = audio.createBuffer(1, 600, audio.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6) * 0.25;
        n.buffer = buf; n.connect(audio.destination); n.start();
      } catch { /* no sound */ }
    };
    return {
      update(now) {
        const t = now.getTime();
        if (Date.now() - loadedAt > 600000) loadEvents();
        const mnt = now.getHours() * 60 + now.getMinutes();
        if (mnt !== lastMin) {
          lastMin = mnt;
          const tm = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: !ctx.use24h }).replace(/\s?([AP])\.?M\.?$/i, ' $1M').replace(/^0/, ' ');
          const big = pad(tm.padStart(8), 8);
          [...big].forEach((ch, i) => { clock[i].target = ch; });
          content(now).forEach((ln, r) => [...ln].forEach((ch, i) => { rows[r][i].target = ch; }));
          dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
        }
        // Each flap steps through the characters until it lands on its target.
        if (t - lastStep < 55) return;
        lastStep = t;
        let moved = 0;
        for (const c of all) {
          if (c.cur === c.target) continue;
          const i = FLAP_CHARS.indexOf(c.cur), j = FLAP_CHARS.indexOf(c.target);
          const dist = (j - i + FLAP_CHARS.length) % FLAP_CHARS.length;
          c.cur = dist > 6 && Math.random() < 0.5 ? FLAP_CHARS[(i + 3) % FLAP_CHARS.length] : FLAP_CHARS[(i + 1) % FLAP_CHARS.length];
          if (ctx.preview) c.cur = c.target;
          c.el.textContent = c.cur;
          c.el.classList.remove('flip'); void c.el.offsetWidth; c.el.classList.add('flip');
          moved++;
        }
        if (moved) click();
      },
      destroy() { try { audio?.close(); } catch { /* ignore */ } },
    };
  },
};

// ------------------------------------------------------------------ lava lamp & aquarium
const LAVA = [
  { v: 'red', label: 'Red & orange', bg: ['#2a0710', '#4a0f10'], blob: [[255, 80, 40], [255, 170, 60]], glow: 'rgba(255,90,40,0.35)' },
  { v: 'purple', label: 'Purple & pink', bg: ['#14062a', '#2b0b3d'], blob: [[190, 70, 255], [255, 110, 190]], glow: 'rgba(200,80,255,0.3)' },
  { v: 'teal', label: 'Teal & lime', bg: ['#04201f', '#073535'], blob: [[40, 220, 190], [190, 255, 90]], glow: 'rgba(60,230,190,0.28)' },
  { v: 'mcm', label: 'Mustard & teal', bg: ['#10302e', '#1f5f5b'], blob: [[232, 177, 58], [242, 140, 60]], glow: 'rgba(232,177,58,0.3)' },
];
/** A small canvas that runs at ~30 frames a second, scaled up smoothly. */
function slowCanvas(root, w, h) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  root.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  return g;
}
function timeOverlay(root, css, size) {
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;color:#fff;font-family:${FONT.sans};text-shadow:0 2px 20px rgba(0,0,0,.45);${css}`;
  d.innerHTML = `<div style="font-size:${size}vmin;font-weight:250;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums"></div><div style="font-size:${size * 0.17}vmin;font-weight:600;opacity:.75;margin-top:1vmin"></div>`;
  root.appendChild(d);
  let last = '';
  return (now, use24h) => {
    const t = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !use24h }).replace(/\s?[AP]\.?M\.?$/i, '');
    const dt = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (t + dt !== last) { last = t + dt; d.children[0].textContent = t; d.children[1].textContent = dt; }
  };
}
const lava = {
  name: 'Lava lamp', blurb: 'Slow, glowing blobs that rise, stretch and merge. Calming at night.', category: 'Fun',
  options: [
    { key: 'pal', label: 'Colours', type: 'swatch', choices: LAVA.map((p) => ({ v: p.v, label: p.label, color: `rgb(${p.blob[0].join(',')})` })) },
    { key: 'shape', label: 'Shape', type: 'choice', choices: [{ v: 'lamp', label: 'Lamp' }, { v: 'full', label: 'Whole screen' }] },
    { key: 'speed', label: 'Speed', type: 'choice', choices: [{ v: 'slow', label: 'Slow' }, { v: 'normal', label: 'Normal' }] },
  ],
  defaults: { pal: 'red', shape: 'lamp', speed: 'slow' },
  ink: () => '#fff',
  create(root, o, ctx) {
    const { w, h } = ctx;
    const P = pick(LAVA, o.pal);
    root.style.cssText = `position:absolute;inset:0;overflow:hidden;background:radial-gradient(90% 90% at 50% 60%, ${P.bg[1]}, ${P.bg[0]})`;
    const g = slowCanvas(root, w, h);
    const lamp = o.shape !== 'full';
    // Where the goo lives: the lamp's glass, or the whole screen.
    const L = lamp ? (() => { const lh = h * 0.82, lw = Math.min(w * 0.36, lh * 0.42); return { x: (w - lw) / 2, y: h * 0.06, w: lw, h: lh * 0.72 }; })() : { x: 0, y: 0, w, h };
    // The goo is worked out on a small grid, then drawn big and soft.
    const S = lamp ? 3 : 5;
    const gw = Math.max(20, Math.round(L.w / S)), gh = Math.max(20, Math.round(L.h / S));
    const off = document.createElement('canvas'); off.width = gw; off.height = gh;
    const og = off.getContext('2d'), img = og.createImageData(gw, gh);
    const R = Math.random, N = lamp ? 7 : 11;
    const blobs = Array.from({ length: N }, (_, i) => ({ x: R() * gw, y: R() * gh, r: (lamp ? 0.13 : 0.09) * Math.min(gw * (lamp ? 1.6 : 1), gh) * (0.7 + R() * 0.7), vy: 0, heat: R(), ph: R() * 6 }));
    const spd = o.speed === 'normal' ? 1.8 : 1;
    const glass = (gg) => {
      const { x, y, w: lw, h: lh } = L, top = lw * 0.28;
      gg.beginPath(); gg.moveTo(x + (lw - top) / 2, y); gg.lineTo(x + (lw + top) / 2, y);
      gg.quadraticCurveTo(x + lw * 1.02, y + lh * 0.55, x + lw * 0.9, y + lh); gg.lineTo(x + lw * 0.1, y + lh);
      gg.quadraticCurveTo(x - lw * 0.02, y + lh * 0.55, x + (lw - top) / 2, y); gg.closePath();
    };
    const tick = timeOverlay(root, lamp ? (w > h ? 'left:6vmin;bottom:6vmin' : 'left:0;right:0;bottom:4vmin;text-align:center') : 'left:6vmin;bottom:6vmin', lamp && w > h ? 16 : 18);
    let last = 0;
    return {
      update(now) {
        tick(now, ctx.use24h);
        const t = now.getTime();
        if (t - last < 33 && !ctx.preview) return;
        const dt = last ? Math.min(80, t - last) / 33 : 1; last = t;
        // Blobs heat at the bottom and rise, cool at the top and sink.
        for (const b of blobs) {
          const yN = b.y / gh;
          b.heat += (yN > 0.85 ? 0.012 : yN < 0.15 ? -0.012 : -0.0012) * dt * spd;
          b.heat = Math.max(0, Math.min(1, b.heat));
          b.vy += (0.5 - b.heat) * 0.006 * dt * spd; b.vy *= 0.985;
          b.y += b.vy * dt * spd;
          b.x += Math.sin(t / 3000 + b.ph) * 0.03 * dt * spd;
          if (b.y < b.r * 0.3) { b.y = b.r * 0.3; b.vy = Math.abs(b.vy) * 0.3; }
          if (b.y > gh - b.r * 0.3) { b.y = gh - b.r * 0.3; b.vy = -Math.abs(b.vy) * 0.3; }
          b.x = Math.max(b.r * 0.4, Math.min(gw - b.r * 0.4, b.x));
        }
        const d = img.data, [c1, c2] = P.blob;
        for (let yy = 0; yy < gh; yy++) {
          const k = yy / gh;
          const cr = c1[0] + (c2[0] - c1[0]) * k, cg = c1[1] + (c2[1] - c1[1]) * k, cb = c1[2] + (c2[2] - c1[2]) * k;
          for (let xx = 0; xx < gw; xx++) {
            let f = 0;
            for (const b of blobs) { const dx = xx - b.x, dy = (yy - b.y) * 0.8; f += (b.r * b.r) / (dx * dx + dy * dy + 1); }
            const i = (yy * gw + xx) * 4;
            const a = f < 0.94 ? 0 : f > 1.06 ? 1 : (f - 0.94) / 0.12;
            const shade = Math.min(1.25, 0.8 + (f - 1) * 0.12);
            d[i] = Math.min(255, cr * shade); d[i + 1] = Math.min(255, cg * shade); d[i + 2] = Math.min(255, cb * shade); d[i + 3] = a * 255;
          }
        }
        og.putImageData(img, 0, 0);
        g.clearRect(0, 0, w, h);
        if (lamp) {
          // Glow behind, glass, goo, base and cap.
          const gl = g.createRadialGradient(w / 2, L.y + L.h * 0.6, 0, w / 2, L.y + L.h * 0.6, L.h * 0.9);
          gl.addColorStop(0, P.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gl; g.fillRect(0, 0, w, h);
          g.save(); glass(g); g.clip();
          const liq = g.createLinearGradient(0, L.y, 0, L.y + L.h);
          liq.addColorStop(0, `rgba(${P.blob[1].join(',')},0.18)`); liq.addColorStop(1, `rgba(${P.blob[0].join(',')},0.32)`);
          g.fillStyle = liq; g.fillRect(L.x - 10, L.y, L.w + 20, L.h);
          g.imageSmoothingEnabled = true; g.drawImage(off, L.x, L.y, L.w, L.h);
          const sh = g.createLinearGradient(L.x, 0, L.x + L.w, 0);
          sh.addColorStop(0, 'rgba(255,255,255,0.0)'); sh.addColorStop(0.18, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.3, 'rgba(255,255,255,0)');
          g.fillStyle = sh; g.fillRect(L.x, L.y, L.w, L.h);
          g.restore();
          glass(g); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.stroke();
          const metal = (y0, y1, wTop, wBot) => {
            const mg = g.createLinearGradient(w / 2 - wBot / 2, 0, w / 2 + wBot / 2, 0);
            mg.addColorStop(0, '#5b5f66'); mg.addColorStop(0.35, '#d9dde3'); mg.addColorStop(0.6, '#8a9099'); mg.addColorStop(1, '#3d4046');
            g.fillStyle = mg; g.beginPath(); g.moveTo(w / 2 - wTop / 2, y0); g.lineTo(w / 2 + wTop / 2, y0); g.lineTo(w / 2 + wBot / 2, y1); g.lineTo(w / 2 - wBot / 2, y1); g.closePath(); g.fill();
          };
          const by = L.y + L.h;
          metal(by, by + h * 0.03, L.w * 0.8, L.w * 0.62);
          metal(by + h * 0.03, by + h * 0.2, L.w * 0.62, L.w * 1.08);
          metal(L.y - h * 0.045, L.y + 1, L.w * 0.14, L.w * 0.28);
        } else {
          g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, w, h);
        }
      },
    };
  },
};
const FISH_COL = ['#ff8a3d', '#ffd23f', '#3fb8ff', '#ff5d8f', '#7ce38b', '#b48cff', '#ffffff'];
const aquarium = {
  name: 'Aquarium', blurb: 'Fish drifting past swaying plants, light rays and rising bubbles.', category: 'Fun',
  options: [{ key: 'water', label: 'Water', type: 'choice', choices: [{ v: 'tropical', label: 'Tropical' }, { v: 'deep', label: 'Deep sea' }] }, { key: 'fish', label: 'Fish', type: 'choice', choices: [{ v: 6, label: 'A few' }, { v: 12, label: 'Lots' }] }],
  defaults: { water: 'tropical', fish: 6 },
  ink: () => '#fff',
  create(root, o, ctx) {
    const { w, h } = ctx;
    const deep = o.water === 'deep';
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    const g = slowCanvas(root, w, h);
    const tick = timeOverlay(root, w > h ? 'left:6vmin;top:6vmin' : 'left:0;right:0;top:6vmin;text-align:center', 17);
    const R = Math.random;
    const fish = Array.from({ length: Number(o.fish) || 6 }, (_, i) => ({ x: R() * w, y: h * (0.4 + R() * 0.42), s: (0.6 + R() * 0.9) * Math.min(w, h) / 900, v: (0.4 + R() * 0.8) * (R() < 0.5 ? -1 : 1), c: FISH_COL[i % FISH_COL.length], ph: R() * 6, stripe: R() < 0.5 }));
    const bubbles = Array.from({ length: 26 }, () => ({ x: R() * w, y: R() * h, r: 1.5 + R() * 4, v: 0.4 + R() * 0.9, ph: R() * 6 }));
    const weeds = Array.from({ length: Math.round(w / 90) }, (_, i) => ({ x: (i + 0.3 + R() * 0.4) * 90, hgt: h * (0.15 + R() * 0.28), c: R() < 0.5 ? '#2f8f5b' : '#3aa36a', ph: R() * 6 }));
    let last = 0;
    return {
      update(now) {
        tick(now, ctx.use24h);
        const t = now.getTime();
        if (t - last < 33 && !ctx.preview) return;
        const dt = last ? Math.min(80, t - last) / 16.7 : 1; last = t;
        const water = g.createLinearGradient(0, 0, 0, h);
        if (deep) { water.addColorStop(0, '#0a3a5c'); water.addColorStop(1, '#020c1c'); } else { water.addColorStop(0, '#2bb3d6'); water.addColorStop(0.6, '#0d6f9c'); water.addColorStop(1, '#063d63'); }
        g.fillStyle = water; g.fillRect(0, 0, w, h);
        // Light rays from the surface.
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const x = w * (0.1 + i * 0.17) + Math.sin(t / 4000 + i) * 40;
          const rg = g.createLinearGradient(0, 0, 0, h * 0.8); rg.addColorStop(0, `rgba(255,255,255,${deep ? 0.05 : 0.09})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = rg; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 40, 0); g.lineTo(x + 160, h * 0.8); g.lineTo(x + 40, h * 0.8); g.closePath(); g.fill();
        }
        g.restore();
        // Sand and plants.
        const sand = g.createLinearGradient(0, h * 0.86, 0, h); sand.addColorStop(0, deep ? '#1b2a33' : '#d9c48f'); sand.addColorStop(1, deep ? '#0d151b' : '#b59a5c');
        g.fillStyle = sand; g.beginPath(); g.moveTo(0, h * 0.9); for (let x = 0; x <= w; x += 40) g.lineTo(x, h * 0.88 + Math.sin(x / 90) * 8); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
        for (const wd of weeds) {
          g.strokeStyle = deep ? '#1f5a45' : wd.c; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
          const base = h * 0.9;
          g.moveTo(wd.x, base);
          for (let k = 1; k <= 6; k++) { const yy = base - (wd.hgt * k) / 6; g.lineTo(wd.x + Math.sin(t / 1400 + wd.ph + k * 0.6) * k * 4, yy); }
          g.stroke();
        }
        // Fish.
        for (const f of fish) {
          f.x += f.v * dt * 0.9; f.y += Math.sin(t / 1600 + f.ph) * 0.15 * dt;
          if (f.v > 0 && f.x > w + 80) { f.x = -80; f.y = h * (0.4 + R() * 0.42); }
          if (f.v < 0 && f.x < -80) { f.x = w + 80; f.y = h * (0.4 + R() * 0.42); }
          const s = f.s * 60, dir = f.v > 0 ? 1 : -1, wig = Math.sin(t / 180 + f.ph) * 0.25;
          g.save(); g.translate(f.x, f.y); g.scale(dir, 1);
          g.fillStyle = f.c;
          g.beginPath(); g.ellipse(0, 0, s, s * 0.48, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(-s * 0.85, 0); g.lineTo(-s * 1.45, -s * (0.5 + wig)); g.lineTo(-s * 1.45, s * (0.5 - wig)); g.closePath(); g.fill();
          if (f.stripe) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-s * 0.2, -s * 0.45, s * 0.16, s * 0.9); }
          g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 0.5, -s * 0.1, s * 0.13, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#111'; g.beginPath(); g.arc(s * 0.54, -s * 0.1, s * 0.07, 0, Math.PI * 2); g.fill();
          g.restore();
        }
        // Bubbles.
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2;
        for (const b of bubbles) {
          b.y -= b.v * dt; b.x += Math.sin(t / 700 + b.ph) * 0.3;
          if (b.y < -10) { b.y = h + 10; b.x = R() * w; }
          g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.stroke();
        }
      },
    };
  },
};

// ------------------------------------------------------------------ family
const FAM_BG = [
  { v: 'night', label: 'Night', bg: 'radial-gradient(120% 100% at 50% 40%, #1d2340, #0a0d1a)', ink: '#fff', ring: '#30d158' },
  { v: 'linen', label: 'Linen', bg: 'radial-gradient(120% 100% at 50% 40%, #fbf7ef, #e9e0cf)', ink: '#2b2418', ring: '#2f9e5b' },
  { v: 'teal', label: 'MCM teal', bg: 'radial-gradient(120% 100% at 50% 40%, #2a7671, #143f3c)', ink: '#f6ead8', ring: '#e8b13a' },
  { v: 'sunset', label: 'Sunset', bg: 'linear-gradient(160deg, #ff9a6b, #7b3fa0)', ink: '#fff', ring: '#ffe27a' },
];
const BUBBLE = ['#e0567f', '#4fb3a9', '#e8b13a', '#5e5ce6', '#d9822b', '#30a46c'];
const family = {
  name: 'Family', blurb: 'A photo bubble for each person around the time, glowing when they’re home.', category: 'Fun',
  options: [
    { key: 'people', label: 'People', type: 'people' },
    { key: 'bg', label: 'Background', type: 'swatch', choices: FAM_BG.map((b) => ({ v: b.v, label: b.label, color: b.bg.match(/#[0-9a-f]{6}/i)[0] })), custom: true },
  ],
  defaults: { bg: 'night' },
  ink: (o) => pick(FAM_BG, o.bg).ink,
  create(root, o, ctx) {
    const { w, h, store } = ctx;
    const B = pick(FAM_BG, o.bg);
    root.style.cssText = `position:absolute;inset:0;background:${B.bg};color:${B.ink};font-family:${FONT.sans};overflow:hidden`;
    const mid = document.createElement('div');
    mid.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center';
    mid.innerHTML = `<div style="font-size:${Math.min(w, h) * 0.2}px;font-weight:250;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums"></div><div style="font-size:${Math.min(w, h) * 0.035}px;font-weight:600;opacity:.7;margin-top:${Math.min(w, h) * 0.015}px"></div><div style="font-size:${Math.min(w, h) * 0.032}px;font-weight:600;margin-top:${Math.min(w, h) * 0.02}px;opacity:.9"></div>`;
    root.appendChild(mid);
    const [tEl, dEl, sEl] = mid.children;
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0';
    root.appendChild(layer);
    const ids = () => {
      const all = (store?.list?.(['person']) || []).map((x) => x.entity_id);
      const chosen = (o.people || []).filter((x) => store?.get(x));
      return chosen.length ? chosen : all;
    };
    let key = '', lastT = '';
    const draw = () => {
      const list = ids();
      const states = list.map((id) => store.get(id));
      const k = JSON.stringify(states.map((s) => [s?.entity_id, s?.state, s?.attributes?.entity_picture]));
      if (k === key) return; key = k;
      layer.innerHTML = '';
      const n = Math.max(1, list.length), m = Math.min(w, h);
      const size = Math.min(m * 0.17, (Math.PI * m * 0.7) / n * 0.8);
      const rx = w > h ? Math.min(w * 0.36, m * 0.62) : m * 0.34, ry = w > h ? m * 0.3 : Math.min(h * 0.32, m * 0.58);
      let homeN = 0;
      states.forEach((s, i) => {
        if (!s) return;
        const a = s.attributes || {}, home = s.state === 'home';
        if (home) homeN++;
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2 + (n === 2 ? Math.PI / 2 : 0);
        const x = w / 2 + Math.cos(ang) * rx, y = h / 2 + Math.sin(ang) * ry;
        const pic = a.entity_picture ? (store.mode === 'demo' || /^data:/.test(a.entity_picture) ? a.entity_picture : `api/art?id=${encodeURIComponent(s.entity_id)}&v=${encodeURIComponent(a.entity_picture.slice(-30))}`) : null;
        const name = a.friendly_name || s.entity_id.split('.')[1];
        const ini = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
        const where = home ? 'Home' : s.state === 'not_home' ? 'Away' : s.state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const b = document.createElement('div');
        b.className = 'fam' + (home ? ' home' : '');
        b.style.cssText = `left:${x}px;top:${y}px;--sz:${size}px;--ring:${B.ring};--bub:${BUBBLE[i % BUBBLE.length]}`;
        b.innerHTML = `<div class="fam-pic"${pic ? ` style="background-image:url('${pic.replace(/'/g, '%27')}')"` : ''}>${pic ? '' : ini}</div><div class="fam-name"></div><div class="fam-where"></div>`;
        b.querySelector('.fam-name').textContent = name.split(' ')[0];
        b.querySelector('.fam-where').textContent = where;
        layer.appendChild(b);
      });
      sEl.textContent = !list.length ? 'Add people in Home Assistant to see them here' : homeN === list.length ? 'Everyone’s home' : homeN === 0 ? 'Nobody’s home' : `${homeN} of ${list.length} home`;
    };
    return {
      update(now) {
        const t = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !ctx.use24h }).replace(/\s?[AP]\.?M\.?$/i, '');
        if (t !== lastT) { lastT = t; tEl.textContent = t; dEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
        if (store) draw();
      },
      onState(id) { if (id === '*' || String(id).startsWith('person.')) key = ''; },
    };
  },
};

// ------------------------------------------------------------------ countdown
const CD_BG = [
  { v: 'night', label: 'Night', color: '#101828', c2: '#2b2350', ink: '#fff' },
  { v: 'festive', label: 'Festive', color: '#7a1020', c2: '#1d5c3a', ink: '#fff' },
  { v: 'sunset', label: 'Sunset', color: '#ff7e5f', c2: '#7b2ff7', ink: '#fff' },
  { v: 'ocean', label: 'Ocean', color: '#0f5e7a', c2: '#2bc0b4', ink: '#fff' },
  { v: 'teal', label: 'MCM teal', color: '#1f5f5b', c2: '#2a7671', ink: '#f6ead8' },
  { v: 'cream', label: 'Cream', color: '#efe6d2', c2: '#f7f1e3', ink: '#2d2418' },
];
const countdown = {
  name: 'Countdown', blurb: 'Days to go, big enough to read across the room, with the time below.', category: 'Fun',
  options: [
    { key: 'which', label: 'Countdown', type: 'countdown' },
    { key: 'bg', label: 'Background', type: 'swatch', choices: CD_BG, custom: true },
    { key: 'time', label: 'Show the time', type: 'bool' },
  ],
  defaults: { which: 'next', bg: 'night', time: true },
  ink: (o) => pick(CD_BG, o.bg).ink,
  create(root, o, ctx) {
    const { w, h, store } = ctx;
    const bg = pick(CD_BG, o.bg);
    root.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2vmin;color:${bg.ink};background:radial-gradient(120% 120% at 20% 10%, ${bg.c2}, ${bg.color} 70%);font-family:${FONT.sans};text-align:center;container-type:size;`;
    const mk = (css, text = '') => { const d = document.createElement('div'); d.style.cssText = css; d.textContent = text; root.appendChild(d); return d; };
    const emoji = mk('font-size:16cqmin;line-height:1');
    const num = mk('font-size:38cqmin;font-weight:800;line-height:.9;letter-spacing:-0.04em;font-variant-numeric:tabular-nums');
    const what = mk('font-size:7cqmin;font-weight:650;opacity:.92;max-width:90cqw');
    const clock = mk('font-size:5.5cqmin;font-weight:600;opacity:.7;margin-top:2cqmin;font-variant-numeric:tabular-nums');
    if (!o.time) clock.style.display = 'none';
    const pickOne = () => {
      const all = store?.list?.(['countdown']) || [];
      if (o.which && o.which !== 'next') return all.find((x) => x.entity_id === 'countdown.' + o.which) || null;
      return all.filter((x) => Number(x.state) >= 0).sort((a, b) => Number(a.state) - Number(b.state))[0] || all[0] || null;
    };
    return {
      update(now) {
        const c = pickOne();
        clock.textContent = now.toLocaleTimeString(undefined, { hour: ctx.use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !ctx.use24h });
        if (!c) { emoji.textContent = '⏳'; num.textContent = ''; what.textContent = 'Add a countdown in Settings → Countdowns'; return; }
        const a = c.attributes, d = Number(c.state);
        emoji.textContent = a.emoji || '';
        if (d === 0) { num.textContent = a.text === 'Today!' ? '🎉' : a.text; what.textContent = a.text === 'Today!' ? `${a.friendly_name} is today!` : `to ${a.friendly_name}`; }
        else if (d < 0) { num.textContent = String(-d); what.textContent = `day${d === -1 ? '' : 's'} since ${a.friendly_name}`; }
        else { num.textContent = String(d); what.textContent = `${d === 1 ? 'day' : 'days'} to ${a.friendly_name}`; }
      },
    };
  },
};

export const FACES = { classic, numerals, digital, roman, flip, lamp, gradient, modular, wordclock, wordexact, starburst, atomic, confetti, countdown, sunclock, sky, board, lava, aquarium, family };
export const FACE_ORDER = ['classic', 'numerals', 'gradient', 'roman', 'starburst', 'atomic', 'confetti', 'digital', 'modular', 'wordclock', 'wordexact', 'countdown', 'sunclock', 'sky', 'board', 'lava', 'aquarium', 'family', 'flip', 'lamp'];

/** What a complication shows for an entity: smarter for weather, calendars and media. */
const WX_TEXT = { 'clear-night': 'Clear', cloudy: 'Cloudy', exceptional: 'Extreme', fog: 'Fog', hail: 'Hail', lightning: 'Storms', 'lightning-rainy': 'Storms', partlycloudy: 'Partly cloudy', pouring: 'Heavy rain', rainy: 'Rain', snowy: 'Snow', 'snowy-rainy': 'Sleet', sunny: 'Sunny', windy: 'Windy', 'windy-variant': 'Windy' };
function compValue(store, id) {
  const s = store.get(id);
  if (!s) return '—';
  const a = s.attributes || {}, d = id.split('.')[0];
  if (d === 'weather') return [a.temperature != null ? `${Math.round(a.temperature)}°` : '', WX_TEXT[s.state] || ''].filter(Boolean).join(' ');
  if (d === 'calendar') {
    if (!a.message) return 'Nothing planned';
    const t = a.start_time ? new Date(String(a.start_time).replace(' ', 'T')) : null;
    const when = a.all_day || !t || Number.isNaN(t) ? '' : t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return [when, a.message].filter(Boolean).join(' ');
  }
  if (d === 'media_player') return s.state === 'playing' ? [a.media_title, a.media_artist].filter(Boolean).join(' · ') || 'Playing' : s.state === 'paused' ? 'Paused' : 'Off';
  return formatState(store, id);
}

// ============================================================ host + ticker
const live = new Set();
let lastSecond = -1;
function loop() {
  const now = new Date();
  const sec = now.getSeconds();
  const newSecond = sec !== lastSecond; lastSecond = sec;
  for (const f of live) {
    if (f.paused) continue;
    if (newSecond) f.tickTime?.(now);
    if (f.smooth) f.inst.update(now, true);
    else if (newSecond || f.dirty) { f.dirty = false; f.inst.update(now, false); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/**
 * Mount a face into `container`.
 * ctx: { store, w, h, use24h, preview }
 */
/** The colours at the top and bottom edges of a mounted face, e.g. to paint the strips around it. */
export function faceEdgeColors(host) {
  const svg = host?.querySelector('.face-layer svg');
  const solid = (c) => c && c !== 'none' && !/^rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent';
  if (svg) {
    const W = Number(svg.getAttribute('width')) || svg.clientWidth;
    for (const r of svg.querySelectorAll(':scope > rect')) {
      if (r.getAttribute('x') || r.getAttribute('y') || Number(r.getAttribute('width')) < W * 0.98) continue;
      const fill = r.getAttribute('fill') || '';
      const m = fill.match(/url\(#([^)]+)\)/);
      if (!m) { if (solid(fill)) return [fill, fill]; continue; }
      const g = svg.querySelector('#' + CSS.escape(m[1]));
      const stops = g ? [...g.querySelectorAll('stop')].map((x) => x.getAttribute('stop-color') || x.style.stopColor) : [];
      if (!stops.length) continue;
      if (g.tagName.toLowerCase() === 'radialgradient') return [stops.at(-1), stops.at(-1)];
      const y1 = parseFloat(g.getAttribute('y1') || '0'), y2 = parseFloat(g.getAttribute('y2') || '0');
      return y2 > y1 ? [stops[0], stops.at(-1)] : y2 < y1 ? [stops.at(-1), stops[0]] : [stops[0], stops.at(-1)];
    }
  }
  for (const el of [host?.querySelector('.face-layer > *'), host?.querySelector('.face-layer'), host]) {
    if (!el) continue;
    const c = getComputedStyle(el).backgroundColor;
    if (solid(c)) return [c, c];
  }
  return ['#000', '#000'];
}

export function mountFace(container, face, ctx) {
  const def = FACES[face.type] || classic;
  const opts = { ...def.defaults, ...(face.opts || {}) };
  const host = document.createElement('div');
  host.className = 'face-host';
  const layer = document.createElement('div');
  layer.className = 'face-layer';
  host.appendChild(layer);
  const comps = document.createElement('div');
  comps.className = 'face-comps' + (def.modular ? ' modular' : '');
  comps.style.color = def.ink(opts);
  host.appendChild(comps);
  container.appendChild(host);

  const inst = def.create(layer, opts, { ...ctx, face });
  // Time as text, for the hands-only faces.
  const tm = face.time || {};
  let timeEl = null, timeT = null, timeD = null;
  if (tm.pos && TIME_FACES.has(face.type)) {
    timeEl = document.createElement('div');
    timeEl.className = 'face-time ft-' + tm.pos;
    timeEl.style.fontFamily = (FONTS.find((f) => f.v === tm.font) || FONTS[0]).css;
    timeEl.style.fontWeight = tm.weight || 600;
    timeEl.style.setProperty('--ft-size', (TIME_SIZE[tm.size || 'm'] * 100) + 'cqmin');
    timeEl.style.color = tm.color || def.ink(opts);
    timeT = document.createElement('div'); timeT.className = 'ft-time';
    timeEl.append(timeT);
    if (tm.date) { timeD = document.createElement('div'); timeD.className = 'ft-date'; timeEl.append(timeD); }
    host.appendChild(timeEl);
    host.style.setProperty('--ft-push', `calc(var(--ft-size, 0px) * ${tm.date ? 1.6 : 1.2} + 2cqmin)`);
    timeEl.style.setProperty('--ft-size', (TIME_SIZE[tm.size || 'm'] * 100) + 'cqmin');
    host.style.setProperty('--ft-size', (TIME_SIZE[tm.size || 'm'] * 100) + 'cqmin');
  }
  // In a corner beside a round dial, shrink the text until it fits the space next to the dial.
  const fitTime = () => {
    if (!timeEl || !['tl', 'tr', 'bl', 'br'].includes(tm.pos)) return;
    const W = host.clientWidth, H = host.clientHeight;
    if (!W) return;
    const side = W > H * 1.05 ? (W - Math.min(W, H) * 0.94) / 2 - Math.min(W, H) * 0.06 : W * 0.46;
    timeT.style.fontSize = '';
    const wNow = timeT.scrollWidth;
    if (wNow > side && side > 0) timeT.style.fontSize = `calc(var(--ft-size) * ${Math.max(0.35, side / wNow).toFixed(3)})`;
  };
  const tickTime = (now) => {
    if (!timeEl) return;
    const h24 = ctx.use24h;
    let t = now.toLocaleTimeString(undefined, { hour: h24 ? '2-digit' : 'numeric', minute: '2-digit', hour12: !h24 });
    if (!h24 && tm.ampm === false) t = t.replace(/\s?[AP]\.?M\.?$/i, '');
    if (timeT.textContent !== t) { timeT.textContent = t; fitTime(); }
    if (timeD) { const d = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); if (timeD.textContent !== d) timeD.textContent = d; }
  };
  const renderComps = () => {
    comps.innerHTML = '';
    for (const slot of ['tl', 'tr', 'bl', 'br']) {
      const id = face[slot];
      if (!id || !ctx.store) continue;
      const c = document.createElement('div');
      c.className = 'comp comp-' + slot + (timeEl && tm.pos === slot ? ' pushed' : '');
      const v = compValue(ctx.store, id);
      c.innerHTML = `<div class="comp-label"></div><div class="comp-value"></div>`;
      c.firstChild.textContent = ctx.store.name(id);
      c.lastChild.textContent = v;
      comps.appendChild(c);
    }
  };
  renderComps();
  const onState = (e) => {
    const id = e.type === 'snapshot' ? '*' : e.detail;
    if (id === '*' || [face.tl, face.tr, face.bl, face.br].includes(id)) renderComps();
    inst.onState?.(id);
  };
  ctx.store?.addEventListener('state', onState);
  ctx.store?.addEventListener('snapshot', onState);

  const api = {
    face, def, inst, host, smooth: !ctx.preview, paused: false, dirty: true,
    destroy() {
      live.delete(api);
      ro?.disconnect();
      ctx.store?.removeEventListener('state', onState);
      ctx.store?.removeEventListener('snapshot', onState);
      inst.destroy?.();
      host.remove();
    },
  };
  api.tickTime = tickTime;
  inst.update(new Date(), !ctx.preview);
  tickTime(new Date());
  requestAnimationFrame(fitTime);
  document.fonts?.ready?.then(fitTime);
  const ro = timeEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitTime()) : null;
  ro?.observe(host);
  live.add(api);
  return api;
}
