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
const pick = (list, v) => (list.find((c) => c.v === v) || list[0]);

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
    { key: 'dial', label: 'Dial', type: 'swatch', choices: CLASSIC_DIALS },
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
    { key: 'dial', label: 'Dial', type: 'swatch', choices: ROMAN_DIALS },
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
    { key: 'bg', label: 'Background', type: 'swatch', choices: WORD_BG },
    { key: 'font', label: 'Font', type: 'choice', choices: [{ v: 'sans', label: 'Sans' }, { v: 'serif', label: 'Serif' }, { v: 'mono', label: 'Mono' }, { v: 'condensed', label: 'Narrow' }] },
    { key: 'dots', label: 'Minute dots', type: 'bool' },
    SIZE_OPT,
  ],
  defaults: { color: 'white', bg: 'black', font: 'sans', dots: true, size: 'normal' },
  ink: (o) => (pick(WORD_BG, o.bg).light ? '#2d2418' : '#fff'),
  create(root, o, { w, h }) {
    const bg = pick(WORD_BG, o.bg);
    const lit = o.color === 'ink' ? '#2d2418' : pick(DIGI, o.color).color;
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
    { key: 'dial', label: 'Dial', type: 'swatch', choices: MCM_DIALS },
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
    { key: 'dial', label: 'Dial', type: 'swatch', choices: MCM_DIALS },
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
    { key: 'dial', label: 'Dial', type: 'swatch', choices: MCM_DIALS },
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
    const lit = o.color === 'ink' ? '#2d2418' : pick(DIGI, o.color).color;
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
    { key: 'bg', label: 'Background', type: 'swatch', choices: CD_BG },
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

export const FACES = { classic, numerals, digital, roman, flip, lamp, gradient, modular, wordclock, wordexact, starburst, atomic, confetti, countdown };
export const FACE_ORDER = ['classic', 'numerals', 'gradient', 'roman', 'starburst', 'atomic', 'confetti', 'digital', 'modular', 'wordclock', 'wordexact', 'countdown', 'flip', 'lamp'];

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
