// The Home page: greeting, clock and tiles for Home Assistant entities.
import { icon, domainIcon } from './icons.js';
import { domainOf, isOn, lightRGB, formatState, cap } from './data.js';
import { h, press, sheet, toast } from './ui.js';
import { headerOf, headerContent, headerVars } from './header.js';
import { iconSvg } from './iconlib.js';

const TOGGLES = ['switch', 'input_boolean', 'fan', 'automation', 'siren', 'humidifier'];
const ACTIONS = ['scene', 'script', 'button', 'input_button'];
export const TIMER_OK = (id) => ['switch', 'input_boolean', 'fan', 'water_heater', 'light'].includes(domainOf(id));

export const ALL_OFF = '_alloff';
/** A tile's label: its custom name, or the entity's name. Accepts a tile item or an entity id. */
export const tileName = (store, x) => {
  const item = typeof x === 'string' ? { id: x } : x || {};
  return item.name || (item.id === ALL_OFF ? 'All lights off' : store.name(item.id));
};
/** Icon markup for a tile: the tile's own icon, else the entity's Home Assistant icon, else the built-in one. */
export function iconHtml(store, item, fallback) {
  const name = item?.icon || (item?.id ? store.get(item.id)?.attributes?.icon : null);
  return (name && iconSvg(name)) || icon(fallback);
}
/** Tile styles a given entity can use (first = default). */
export function stylesFor(id) {
  const d = domainOf(id);
  if (d === 'light') return [{ v: 'light', label: 'Light', sub: 'Tap on/off · hold for colour' }, { v: 'switch', label: 'Quick switch', sub: 'Tap on/off only' }, { v: 'controls', label: 'Controls', sub: 'Tap opens colour, dim & scenes' }, { v: 'timer', label: 'Timer', sub: '15/30/45/60-minute buttons' }];
  if (['switch', 'input_boolean', 'fan'].includes(d)) return [{ v: 'toggle', label: 'Switch', sub: 'Tap on/off' }, { v: 'timer', label: 'Timer', sub: '15/30/45/60-minute buttons' }];
  if (d === 'weather') return [{ v: 'daily', label: 'Daily', sub: 'Next days · tap for hourly too' }, { v: 'hourly', label: 'Hourly', sub: 'Next hours · tap for daily too' }];
  return [];
}
/** Tile kinds whose icon sits in the corner and can be moved (top left / top right / middle). */
export const ICON_MOVABLE = ['light', 'toggle', 'action', 'cover', 'sensor', 'alloff'];
export const ICON_POSITIONS = [{ v: 'tl', label: 'Top left' }, { v: 'tr', label: 'Top right' }, { v: 'center', label: 'Middle' }];
export const NAME_POSITIONS = [{ v: 'bottom', label: 'Bottom' }, { v: 'below', label: 'Under icon' }, { v: 'above', label: 'Above icon' }];
export const styleOf = (item) => item.style || (item.timer ? 'timer' : stylesFor(item.id)[0]?.v || null);
export const tileIcon = (id) => (id === ALL_OFF ? 'bulbOff' : domainIcon(domainOf(id)));
export const MAX_H = 6;
// Tile sizes are in columns/rows with 0.1 steps; the grid has SUB fine tracks per column and per row.
export const SUB = 10;
export const MIN_SIZE = 0.2;
export const roundSize = (v) => Math.round(Number(v) * SUB) / SUB;
export const fmtSize = (v) => String(roundSize(v));
export const pageOf = (settings, pageId) => settings?.pages?.find((p) => p.id === pageId) || null;

export function kindFor(item) {
  if (item.id === ALL_OFF) return 'alloff';
  const d = domainOf(item.id);
  if (d === 'climate') return 'climate';
  if (d === 'weather') return 'weather';
  const style = styleOf(item);
  if (d === 'water_heater' || (style === 'timer' && TIMER_OK(item.id))) return 'timer';
  if (d === 'lock') return 'lock';
  if (d === 'light') return style === 'switch' ? 'toggle' : 'light';
  if (TOGGLES.includes(d)) return 'toggle';
  if (d === 'cover') return 'cover';
  if (ACTIONS.includes(d)) return 'action';
  return 'sensor';
}
/** [width in columns, height in rows] for a tile (its own size, or the default for its kind). */
export function sizeOf(item) {
  const def = ['climate', 'weather'].includes(kindFor(item)) ? [2, 1] : [1, 1];
  return [item.w || def[0], item.h || def[1]];
}

// ------------------------------------------------------------------ weather helpers
const WX = {
  'clear-night': ['weather-night', 'Clear', 'night'], cloudy: ['weather-cloudy', 'Cloudy', 'cloudy'], exceptional: ['alert-circle-outline', 'Severe weather', 'storm'],
  fog: ['weather-fog', 'Fog', 'cloudy'], hail: ['weather-hail', 'Hail', 'storm'], lightning: ['weather-lightning', 'Thunder', 'storm'],
  'lightning-rainy': ['weather-lightning-rainy', 'Thunderstorms', 'storm'], partlycloudy: ['weather-partly-cloudy', 'Partly cloudy', 'partly'],
  pouring: ['weather-pouring', 'Heavy rain', 'rain'], rainy: ['weather-rainy', 'Rain', 'rain'], snowy: ['weather-snowy', 'Snow', 'snow'],
  'snowy-rainy': ['weather-snowy-rainy', 'Sleet', 'snow'], sunny: ['weather-sunny', 'Sunny', 'sunny'], windy: ['weather-windy', 'Windy', 'cloudy'],
  'windy-variant': ['weather-windy-variant', 'Windy', 'cloudy'],
};
const wxIcon = (c, night) => 'mdi:' + (night && c === 'sunny' ? 'weather-night' : night && c === 'partlycloudy' ? 'weather-night-partly-cloudy' : WX[c]?.[0] || 'weather-partly-cloudy');
const wxLabel = (c) => WX[c]?.[1] || cap(String(c || '').replace(/[-_]/g, ' '));
const wxGroup = (c) => WX[c]?.[2] || 'cloudy';
const fmtNum = (n) => (typeof n === 'number' ? (Math.abs(n) >= 10 || Number.isInteger(n) ? Math.round(n) : Math.round(n * 10) / 10) : n);
const isNightHour = (iso) => { const hr = new Date(iso).getHours(); return hr < 6 || hr >= 20; };
function wxWhen(iso, mode, i, use24h) {
  const d = new Date(iso);
  if (mode === 'hourly') return i === 0 ? 'Now' : d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: !use24h });
  return i === 0 && d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
}

const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

// ------------------------------------------------------------------ custom tile colours
/** The colour slots a tile offers (key in the tile's settings + label). "on" means the tile's active state. */
export function colorSlots(item) {
  const k = kindFor(item);
  if (k === 'sensor' || k === 'weather') return [{ key: 'offColor', label: 'Tile colour', def: 'Default' }];
  if (k === 'lock') return [{ key: 'onColor', label: 'Unlocked colour', def: 'Amber' }, { key: 'offColor', label: 'Locked colour', def: 'Theme' }];
  if (k === 'action') return [{ key: 'onColor', label: 'Colour when tapped', def: 'Theme' }, { key: 'offColor', label: 'Tile colour', def: 'Theme' }];
  if (k === 'alloff') return [{ key: 'onColor', label: 'Colour while lights are on', def: 'Theme' }, { key: 'offColor', label: 'Colour when all are off', def: 'Theme' }];
  if (k === 'climate') return [{ key: 'onColor', label: 'Colour when running', def: 'Mode colour' }, { key: 'offColor', label: 'Colour when off', def: 'Theme' }];
  if (k === 'light') return [{ key: 'onColor', label: 'On colour', def: 'Light’s colour' }, { key: 'offColor', label: 'Off colour', def: 'Theme' }];
  return [{ key: 'onColor', label: 'On colour', def: 'Theme' }, { key: 'offColor', label: 'Off colour', def: 'Theme' }];
}
const HEX = /^#[0-9a-f]{6}$/i;
const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Give a card its own on/off background: a solid colour, or a gradient when a second colour is set.
 *  CSS does the rest, keyed on each card's state class. */
export const GRADIENT_ANGLE = 160;
export function tileBackground(c, c2) { return c2 ? `linear-gradient(${GRADIENT_ANGLE}deg, ${c}, ${c2})` : c; }
export function applyTileColors(el, item) {
  for (const [key, cls] of [['onColor', 'tc-on'], ['offColor', 'tc-off']]) {
    const c = item[key];
    if (!c || !HEX.test(c)) continue;
    const c2 = HEX.test(item[key + '2'] || '') ? item[key + '2'] : null;
    const a = hexRgb(c), b = c2 ? hexRgb(c2) : a;
    const avg = a.map((v, i) => Math.round((v + b[i]) / 2));
    el.classList.add(cls);
    el.style.setProperty('--' + cls + '-bg', tileBackground(c, c2));
    el.style.setProperty('--' + cls + '-rgb', avg.join(','));
    el.style.setProperty('--' + cls + '-fg', lum(avg) > 0.6 ? '#1c1c1e' : '#ffffff');
  }
}
const fmtTemp = (t) => (t == null ? '--' : Number.isInteger(t) ? String(t) : t.toFixed(1));
function fmtLeft(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}

export class HomePage {
  constructor(root, store, app, pageId) {
    this.root = root; this.store = store; this.app = app; this.pageId = pageId;
    this.cards = [];
    this.editing = false;
    this.handlers = {
      state: (e) => this.onState(e.detail),
      snapshot: () => this.render(),
      timers: () => this.cards.forEach((c) => c.timer && c.update()),
      forecast: (e) => this.cards.forEach((c) => c.id === e.detail && c.update()),
      resize: () => { if (this.layout()) this.render(); },
    };
    store.addEventListener('state', this.handlers.state);
    store.addEventListener('snapshot', this.handlers.snapshot);
    store.addEventListener('timers', this.handlers.timers);
    store.addEventListener('forecast', this.handlers.forecast);
    window.addEventListener('resize', this.handlers.resize);
    this.interval = setInterval(() => this.tick(), 1000);
  }

  destroy() {
    this.store.removeEventListener('state', this.handlers.state);
    this.store.removeEventListener('snapshot', this.handlers.snapshot);
    this.store.removeEventListener('timers', this.handlers.timers);
    this.store.removeEventListener('forecast', this.handlers.forecast);
    this.cards.forEach((c) => c.destroy?.());
    window.removeEventListener('resize', this.handlers.resize);
    clearInterval(this.interval);
    this.root.remove();
  }

  get page() { return pageOf(this.store.settings, this.pageId); }
  get items() { return this.page?.entities || []; }
  /** The first page called "Home" keeps the greeting as its title; room pages show their name. */
  get isHome() { return !this.page || /^home$/i.test(this.page.name || ''); }

  render() {
    const s = this.store.settings;
    if (!s) return;
    const scroll = this.grid?.scrollTop || 0;
    this.cards.forEach((c) => c.destroy?.());
    this.root.innerHTML = '';
    this.cards = [];
    this.greet = h('div.greet');
    this.date = h('div.date');
    this.time = h('div.home-time');
    const head = h('header.home-head', {},
      h('div.head-titles', {}, this.greet, this.date),
      h('div.head-right', {},
        this.time,
        h('button.icon-btn.glass', { 'aria-label': 'Edit layout', html: icon('grid'), onclick: () => this.setEditing(!this.editing) }),
        h('button.icon-btn.glass', { 'aria-label': 'Clock', html: icon('clock'), onclick: () => this.app.goTo(0) }),
        h('button.icon-btn.glass', { 'aria-label': 'Settings', html: icon('gear'), onclick: () => this.app.openSettings({ page: this.pageId }) })));
    this.head = head;
    this.applyHeaderStyle(head);
    // Hold (or right-click) the title to change the header.
    press(head.querySelector('.head-titles'), { onLong: () => this.app.headerEditor?.() });
    this.grid = h('div.home-grid' + (this.editing ? '.editing' : ''));
    this.root.classList.toggle('editing', this.editing);
    this.root.append(h('div.home-bg'), head, this.grid);
    this.layout();

    this.items.forEach((item, index) => {
      if (!item?.id) return;
      const card = this.makeCard(item);
      if (!card) return;
      const [w, hgt] = sizeOf(item);
      this.applySize(card.el, w, hgt);
      // Per-tile icon position and size.
      const movable = ICON_MOVABLE.includes(kindFor(item));
      card.el.classList.add('icon-' + (movable ? item.iconPos || 'tl' : 'tl'), 'name-' + (movable ? item.namePos || 'bottom' : 'bottom'));
      if (item.iconScale && item.iconScale !== 1) card.el.style.setProperty('--icon-scale', String(item.iconScale));
      applyTileColors(card.el, item);
      if (this.editing) this.attachEditor(card.el, item, index);
      this.cards.push(card); this.grid.append(card.el); card.update();
    });
    if (!this.cards.length) {
      this.grid.append(h('div.empty', {},
        h('div.empty-title', { text: 'No tiles yet' }),
        h('div.empty-sub', { text: 'Pick the devices you want on this page.' }),
        h('button.pill.primary', { text: 'Choose devices', onclick: () => this.app.entityBrowser(this.pageId, () => this.render()) })));
    }
    if (this.editing) this.root.append(this.editBar());
    this.grid.scrollTop = scroll;
    this.tick();
  }

  applySize(el, w, hgt) {
    const cw = Math.max(MIN_SIZE, Math.min(w, this.cols || 5)), ch = Math.max(MIN_SIZE, Math.min(hgt, MAX_H));
    el.style.gridColumn = `span ${Math.round(cw * SUB)}`;
    el.style.gridRow = `span ${Math.round(ch * SUB)}`;
  }

  /** Works out columns/rows for this screen. Returns true if the column count changed. */
  /** Fonts, sizes, colour and height of the title and the line under it. */
  applyHeaderStyle(head) {
    const hd = this.hd = headerOf(this.store.settings);
    this.lastLine = null;
    const { vars, grad } = headerVars(hd);
    for (const [k, v] of Object.entries(vars)) { if (v == null) head.style.removeProperty(k); else head.style.setProperty(k, v); }
    this.date.classList.toggle('grad', grad);
    this.hdFor = this.store.settings;
  }

  layout() {
    if (!this.grid) return false;
    const L = this.page?.layout || {};
    const W = this.root.clientWidth || innerWidth, H = this.root.clientHeight || innerHeight;
    const portrait = H > W * 1.1;
    const cols = L.cols || (W >= 1050 ? 5 : W >= 760 ? 4 : 3);
    const rows = L.rows || (portrait ? 3 : 2);
    const gap = Math.round(Math.min(W, H) * (cols > 6 || rows > 3 ? 0.015 : 0.02));
    const pad = Math.min(30, Math.max(16, W * 0.022));
    // The header is the height you chose, or taller when its text needs it (the tiles make room).
    const base = Math.round(H * (headerOf(this.store.settings).height || 13) / 100);
    const titles = this.root.querySelector('.head-titles');
    const headPx = Math.max(base, titles ? Math.ceil(titles.scrollHeight) + 14 : 0);
    const head = this.root.querySelector('.home-head');
    if (head) head.style.height = `calc(${headPx}px + env(safe-area-inset-top))`;
    const headH = headPx + 8;
    const reserve = this.editing ? 84 : 0; // room for the edit bar
    // One row = the screen height shared by `rows` (each tile keeps half a gap of margin all round).
    const unitH = Math.max(90, (H - headH - reserve - (pad - gap / 2)) / rows);
    const changed = this.cols !== cols;
    Object.assign(this, { cols, rows, gap, unitH, rowH: unitH - gap });
    this.root.style.setProperty('--subcols', cols * SUB);
    this.root.style.setProperty('--gap', gap + 'px');
    this.root.style.setProperty('--subrow-h', (unitH / SUB).toFixed(3) + 'px');
    return changed;
  }

  setEditing(on) {
    if (this.editing === on) return;
    this.editing = on;
    this.render();
  }

  // ------------------------------------------------------------------ edit layout
  attachEditor(el, item, index) {
    let [w, hgt] = sizeOf(item);
    w = Math.min(w, this.cols);
    const label = h('div.eo-size', {}, h('div.eo-dims', { text: `${fmtSize(w)} × ${fmtSize(hgt)}` }), h('div.eo-name', { text: tileName(this.store, item) }));
    const save = (fn) => { this.app.update((s) => fn(pageOf(s, this.pageId).entities)); this.render(); };
    const last = this.items.length - 1;
    const handle = h('div.eo-handle', { html: icon('resize'), 'aria-label': 'Drag to resize' });
    const ov = h('div.edit-ov', {},
      h('button.eo-remove', { 'aria-label': 'Remove', html: icon('close'), onclick: () => save((a) => a.splice(index, 1)) }),
      h('div.eo-move', {},
        h('button', { 'aria-label': 'Move earlier', html: icon('back'), disabled: index === 0, onclick: () => save((a) => a.splice(index - 1, 0, a.splice(index, 1)[0])) }),
        h('button.flip', { 'aria-label': 'Move later', html: icon('back'), disabled: index === last, onclick: () => save((a) => a.splice(index + 1, 0, a.splice(index, 1)[0])) })),
      label,
      h('button.eo-opts', { html: icon('sliders') + '<span>Options</span>', 'aria-label': 'Tile options (style, icon, name)', onclick: () => this.app.tileOptions(this.pageId, index) }),
      handle);
    // Keep taps from reaching the tile underneath.
    for (const t of ['pointerdown', 'pointerup', 'click', 'contextmenu']) ov.addEventListener(t, (e) => e.stopPropagation());

    // Drag the corner handle: size snaps to whole columns / rows.
    let start = null;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const cs = getComputedStyle(this.grid);
      const inner = this.grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      start = { x: e.clientX, y: e.clientY, w, h: hgt, cx: inner / this.cols, cy: this.unitH };
      el.classList.add('resizing');
    });
    handle.addEventListener('pointermove', (e) => {
      if (!start) return;
      // 0.1 steps; whole and half sizes are a little "sticky" so they're easy to hit.
      const snap = (v) => { const half = Math.round(v * 2) / 2; return Math.abs(v - half) < 0.06 ? half : roundSize(v); };
      const nw = Math.max(MIN_SIZE, Math.min(this.cols, snap(start.w + (e.clientX - start.x) / start.cx)));
      const nh = Math.max(MIN_SIZE, Math.min(MAX_H, snap(start.h + (e.clientY - start.y) / start.cy)));
      if (nw === w && nh === hgt) return;
      w = nw; hgt = nh;
      this.applySize(el, w, hgt);
      label.firstChild.textContent = `${fmtSize(w)} × ${fmtSize(hgt)}`;
    });
    const end = () => {
      if (!start) return;
      const changed = w !== start.w || hgt !== start.h;
      start = null; el.classList.remove('resizing');
      if (changed) save((a) => { a[index].w = w; a[index].h = hgt; });
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    el.append(ov);
  }

  editBar() {
    const setL = (k, v) => { this.app.update((s) => { const pg = pageOf(s, this.pageId); pg.layout = { ...(pg.layout || {}), [k]: v }; }); this.render(); };
    const stepper = (label, value, min, max, key) => h('div.stepper', {},
      h('span.st-label', { text: label }),
      h('button', { html: icon('minus'), 'aria-label': 'Fewer ' + label, disabled: value <= min, onclick: () => setL(key, value - 1) }),
      h('span.st-val', { text: String(value) }),
      h('button', { html: icon('plus'), 'aria-label': 'More ' + label, disabled: value >= max, onclick: () => setL(key, value + 1) }));
    return h('div.edit-bar', {},
      stepper('Columns', this.cols, 2, 8, 'cols'),
      stepper('Rows', this.rows, 2, 6, 'rows'),
      h('button.pill', { html: icon('plus') + '<span>Add tiles</span>', onclick: () => this.app.entityBrowser(this.pageId, () => this.render()) }),
      h('button.pill.primary', { text: 'Done', onclick: () => this.setEditing(false) }));
  }

  tick() {
    const now = new Date();
    if (!this.greet) return;
    if (this.hdFor !== this.store.settings && this.head) this.applyHeaderStyle(this.head);
    const hd = this.hd || headerOf(this.store.settings);
    const { title, html } = headerContent(this.store, hd, now, { isHome: this.isHome, pageName: this.page?.name });
    if (this.greet.textContent !== title) this.greet.textContent = title;
    if (html !== this.lastLine) { this.date.innerHTML = html; this.lastLine = html; this.date.style.display = html ? '' : 'none'; this.layout(); }
    const use24h = this.store.settings?.general?.use24h;
    this.time.textContent = now.toLocaleTimeString(undefined, { hour: use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !use24h });
    for (const c of this.cards) if (c.timer && this.store.timers[c.id]) c.update();
  }

  onState(id) {
    for (const c of this.cards) if (c.id === id || (c.watch && c.watch.includes(id))) c.update();
  }

  // ------------------------------------------------------------------ cards
  makeCard(item) {
    const kind = kindFor(item);
    if (kind === 'alloff') return this.allOffCard([...new Set(this.items.filter((i) => domainOf(i.id) === 'light').map((i) => i.id))], item);
    const fn = { weather: this.weatherCard, climate: this.climateCard, timer: this.timerCard, lock: this.lockCard, light: this.lightCard, toggle: this.toggleCard, cover: this.coverCard, action: this.actionCard, sensor: this.sensorCard }[kind];
    return fn.call(this, item.id, item);
  }

  headEl(id, ic, item = { id }) {
    const area = this.store.area(id);
    return h('div.card-head', {},
      h('span.card-ic', { html: iconHtml(this.store, item, ic) }),
      h('div.card-titles', {}, h('div.card-title', { text: tileName(this.store, item) }), area ? h('div.card-sub', { text: area }) : null));
  }

  climateCard(id, item = { id }) {
    const st = this.store;
    const MODES = { cool: ['snow', 'Cool'], heat: ['sun', 'Heat'], dry: ['drop', 'Dry'], fan_only: ['fan', 'Fan'], auto: ['auto', 'Auto'], heat_cool: ['auto', 'Heat/Cool'] };
    const temp = h('div.cl-temp');
    const inside = h('div.cl-inside');
    const pwr = h('button.round-btn', { html: icon('power'), 'aria-label': 'Power' });
    const up = h('button.round-btn', { html: icon('up'), 'aria-label': 'Warmer' });
    const down = h('button.round-btn', { html: icon('down'), 'aria-label': 'Cooler' });
    const modes = h('div.cl-modes');
    const el = h('div.card.climate', {},
      h('div.card-head-row', {}, this.headEl(id, 'snow', item), pwr),
      h('div.cl-main', {}, h('div', {}, temp, inside), h('div.cl-arrows', {}, up, down)),
      modes);
    let pending = null, sendT = null, clearT = null, lastMode = null;
    const s0 = () => st.get(id);
    const target = () => (pending ?? s0()?.attributes?.temperature ?? null);
    const nudge = (dir) => {
      const a = s0()?.attributes || {};
      const step = a.target_temp_step || (a.temperature_unit === '°F' || a.unit_of_measurement === '°F' ? 1 : 0.5);
      let t = target(); if (t == null) return;
      t = Math.round((t + dir * step) / step) * step;
      if (a.min_temp != null) t = Math.max(a.min_temp, t);
      if (a.max_temp != null) t = Math.min(a.max_temp, t);
      pending = t; update();
      clearTimeout(sendT); clearTimeout(clearT);
      sendT = setTimeout(() => { st.call('climate', 'set_temperature', { temperature: pending }, { entity_id: id }); clearT = setTimeout(() => { pending = null; update(); }, 4000); }, 700);
    };
    up.onclick = () => nudge(1); down.onclick = () => nudge(-1);
    pwr.onclick = () => {
      const s = s0(); if (!s) return;
      if (s.state !== 'off') { lastMode = s.state; st.call('climate', 'set_hvac_mode', { hvac_mode: 'off' }, { entity_id: id }); }
      else {
        const modesList = (s.attributes.hvac_modes || []).filter((m) => m !== 'off');
        const m = lastMode && modesList.includes(lastMode) ? lastMode : modesList[0];
        if (m) st.call('climate', 'set_hvac_mode', { hvac_mode: m }, { entity_id: id });
      }
    };
    const update = () => {
      const s = s0();
      const a = s?.attributes || {};
      const t = target();
      if (t == null && a.target_temp_low != null) temp.innerHTML = `${fmtTemp(a.target_temp_low)}–${fmtTemp(a.target_temp_high)}<span>°</span>`;
      else temp.innerHTML = `${fmtTemp(t)}<span>°</span>`;
      const action = a.hvac_action ? cap(a.hvac_action.replace(/_/g, ' ')) : '';
      inside.textContent = [a.current_temperature != null ? `Inside ${fmtTemp(a.current_temperature)}°` : '', s?.state === 'off' ? 'Off' : action].filter(Boolean).join('  ·  ');
      for (const c of [...el.classList]) if (c.startsWith('mode-')) el.classList.remove(c);
      const active = s && s.state !== 'off' && s.state !== 'unavailable';
      el.classList.toggle('on', !!active);
      if (active) el.classList.add('mode-' + s.state);
      if (s?.state && s.state !== 'off') lastMode = s.state;
      modes.innerHTML = '';
      for (const m of (a.hvac_modes || []).filter((x) => MODES[x]).slice(0, 5)) {
        const b = h('button.mode' + (s?.state === m ? '.on' : ''), { html: icon(MODES[m][0]) + `<span>${MODES[m][1]}</span>` });
        b.onclick = () => st.call('climate', 'set_hvac_mode', { hvac_mode: m }, { entity_id: id });
        modes.append(b);
      }
    };
    return { id, el, update };
  }

  timerCard(id, item = { id }) {
    const st = this.store;
    const minutes = this.store.settings.dashboard?.timerMinutes || [15, 30, 45, 60];
    const C = 2 * Math.PI * 44;
    const ring = h('button.ring', { 'aria-label': 'Toggle', html:
      `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="ring-track"/><circle cx="50" cy="50" r="44" class="ring-arc" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 50 50)"/></svg>` +
      `<div class="ring-label">${icon(domainOf(id) === 'water_heater' ? 'flame' : domainIcon(domainOf(id)))}<span></span></div>` });
    const chips = h('div.chips');
    const small = h('div.tile-state.t-state');
    const el = h('div.card.timer', {}, this.headEl(id, domainOf(id) === 'water_heater' ? 'flame' : domainIcon(domainOf(id)), item), h('div.ring-wrap', {}, ring), small, chips);
    const arc = ring.querySelector('.ring-arc'), label = ring.querySelector('.ring-label span');
    chips.addEventListener('pointerdown', (e) => e.stopPropagation());
    press(el, {
      onTap: () => {
        const on = isOn(st.get(id));
        if (on && st.timers[id]) st.cancelTimer(id);
        st.call('homeassistant', on ? 'turn_off' : 'turn_on', {}, { entity_id: id });
      },
    });
    for (const m of minutes) {
      const b = h('button.chip', { text: String(m), 'data-m': m });
      b.onclick = () => st.startTimer(id, m);
      chips.append(b);
    }
    const update = () => {
      const s = st.get(id), on = isOn(s), t = st.timers[id];
      el.classList.toggle('on', on);
      let frac = on ? 1 : 0;
      if (t && on) { const left = t.end - Date.now(); frac = Math.max(0, left / (t.minutes * 60000)); label.textContent = fmtLeft(left); }
      else label.textContent = !s ? '—' : on ? 'On' : 'Off';
      small.textContent = t && on ? `On · ${label.textContent} left` : label.textContent;
      arc.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
      for (const b of chips.children) b.classList.toggle('on', !!(t && on && Number(b.dataset.m) === t.minutes));
    };
    return { id, el, update, timer: true };
  }

  lockCard(id, item = { id }) {
    const st = this.store;
    const big = h('div.lock-big');
    const label = h('div.tile-state');
    const hint = h('div.tile-hint');
    const el = h('div.card.lock', {}, this.headEl(id, 'lock', item), big, h('div.tile-bottom', {}, label, hint));
    let armed = null;
    press(el, {
      onTap: () => {
        const s = st.get(id); if (!s) return;
        if (s.state === 'locked') {
          if (armed) { clearTimeout(armed); armed = null; st.call('lock', 'unlock', {}, { entity_id: id }); hint.textContent = ''; return; }
          hint.textContent = 'Tap again to unlock';
          armed = setTimeout(() => { armed = null; hint.textContent = ''; }, 3000);
        } else st.call('lock', 'lock', {}, { entity_id: id });
      },
    });
    const update = () => {
      const s = st.get(id), state = s?.state || 'unknown';
      const open = state === 'unlocked' || state === 'open' || state === 'unlocking';
      big.innerHTML = icon(open ? 'unlock' : 'lock');
      label.textContent = cap(state);
      el.classList.toggle('alert', open || state === 'jammed');
      el.classList.toggle('unlocked', open);
    };
    return { id, el, update };
  }

  lightCard(id, item = { id }) {
    const st = this.store;
    const name = h('div.tile-name', { text: tileName(st, item) });
    const state = h('div.tile-state');
    const ic = h('span.tile-ic', { html: iconHtml(st, item, 'bulb') });
    const more = h('button.tile-more', { html: icon('sliders'), 'aria-label': 'Brightness and colour', onclick: (e) => { e.stopPropagation(); this.lightSheet(id, item); } });
    more.addEventListener('pointerdown', (e) => e.stopPropagation());
    const el = h('div.card.tile.light', {}, h('div.tile-top', {}, ic, more), h('div.tile-bottom', {}, name, state));
    // "Controls" style: a tap opens the light's controls; otherwise a tap switches it and a hold opens them.
    if (styleOf(item) === 'controls') press(el, { onTap: () => this.lightSheet(id, item), onLong: () => this.lightSheet(id, item) });
    else press(el, { onTap: () => st.activate(id), onLong: () => this.lightSheet(id, item) });
    const update = () => {
      const s = st.get(id), on = isOn(s);
      el.classList.toggle('on', on);
      if (on) {
        const c = lightRGB(s), rgb = c.join(',');
        const bri = s.attributes.brightness != null ? s.attributes.brightness / 255 : 1;
        el.style.setProperty('--lc', rgb);
        el.style.setProperty('--la', String(0.55 + 0.45 * bri));
        el.classList.toggle('dark-text', lum(c) > 0.62);
        // White-ish bulbs: on light themes these get the theme's "on" colour so they don't look off.
        el.classList.toggle('pale', (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c)) < 0.3);
      } else { el.style.removeProperty('--lc'); el.classList.remove('dark-text', 'pale'); }
      state.textContent = !s ? 'Missing' : on ? (s.attributes.brightness != null ? `On · ${Math.round(s.attributes.brightness / 2.55)}%` : 'On') : cap(s.state);
    };
    return { id, el, update };
  }

  allOffCard(ids, item = { id: ALL_OFF }) {
    const st = this.store;
    const state = h('div.tile-state');
    const el = h('div.card.tile.alloff', {}, h('div.tile-top', {}, h('span.tile-ic', { html: iconHtml(st, item, 'bulbOff') })), h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) }), state));
    press(el, {
      onTap: () => {
        const on = ids.filter((i) => isOn(st.get(i)));
        if (!on.length) return toast('All lights are already off');
        st.call('light', 'turn_off', {}, { entity_id: on });
      },
    });
    const update = () => {
      const n = ids.filter((i) => isOn(st.get(i))).length;
      state.textContent = n ? `${n} light${n > 1 ? 's' : ''} on` : 'Everything is off';
      el.classList.toggle('dim', !n);
    };
    return { id: '_alloff', watch: ids, el, update };
  }

  toggleCard(id, item = { id }) {
    const st = this.store, d = domainOf(id);
    const state = h('div.tile-state');
    const el = h('div.card.tile.toggle', {}, h('div.tile-top', {}, h('span.tile-ic', { html: iconHtml(st, item, domainIcon(d)) })), h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) }), state));
    press(el, { onTap: () => st.activate(id) });
    const update = () => { const s = st.get(id); el.classList.toggle('on', isOn(s)); state.textContent = s ? cap(s.state) : 'Missing'; };
    return { id, el, update };
  }

  actionCard(id, item = { id }) {
    const st = this.store, d = domainOf(id);
    const state = h('div.tile-state', { text: d === 'scene' ? 'Scene' : 'Tap to run' });
    const el = h('div.card.tile.action', {}, h('div.tile-top', {}, h('span.tile-ic', { html: iconHtml(st, item, domainIcon(d)) })), h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) }), state));
    press(el, {
      onTap: () => {
        st.activate(id);
        el.classList.add('fired'); state.textContent = 'Activated';
        setTimeout(() => { el.classList.remove('fired'); state.textContent = d === 'scene' ? 'Scene' : 'Tap to run'; }, 1600);
      },
    });
    return { id, el, update: () => {} };
  }

  coverCard(id, item = { id }) {
    const st = this.store;
    const state = h('div.tile-state');
    const mk = (ic, svc) => { const b = h('button.mini', { html: icon(ic) }); b.onclick = (e) => { e.stopPropagation(); st.call('cover', svc, {}, { entity_id: id }); }; return b; };
    const el = h('div.card.tile.cover', {}, h('div.tile-top', {}, h('span.tile-ic', { html: iconHtml(st, item, 'blinds') })),
      h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) }), state, h('div.mini-row', {}, mk('up', 'open_cover'), mk('stop', 'stop_cover'), mk('down', 'close_cover'))));
    const update = () => {
      const s = st.get(id), p = s?.attributes?.current_position;
      state.textContent = !s ? 'Missing' : p != null && p > 0 && p < 100 ? `${p}% open` : cap(s.state);
      el.classList.toggle('on', isOn(s));
    };
    return { id, el, update };
  }

  sensorCard(id, item = { id }) {
    const st = this.store, d = domainOf(id);
    const val = h('div.sensor-val');
    const el = h('div.card.tile.sensor', {}, h('div.tile-top', {}, h('span.tile-ic', { html: iconHtml(st, item, st.get(id)?.attributes?.device_class === 'temperature' ? 'thermo' : domainIcon(d)) })),
      h('div.tile-bottom', {}, val, h('div.tile-name', { text: tileName(st, item) })));
    const update = () => { val.textContent = formatState(st, id); };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ weather
  weatherCard(id, item = { id }) {
    const st = this.store;
    const mode = styleOf(item) === 'hourly' ? 'hourly' : 'daily';
    const nowIc = h('span.wx-ic');
    const temp = h('div.wx-temp');
    const cond = h('div.wx-cond');
    const hl = h('div.wx-hl');
    const name = h('div.wx-name', { text: tileName(st, item) });
    const fc = h('div.wx-fc');
    const el = h('div.card.weather', {}, h('div.wx-now', {}, nowIc, h('div.wx-main', {}, temp, cond), h('div.wx-side', {}, name, hl)), fc);
    press(el, { onTap: () => this.weatherSheet(id, item) });
    let lastKey = '';
    const draw = () => {
      const s = st.get(id), a = s?.attributes || {};
      const f = st.forecasts?.[id] || {};
      const list = (mode === 'hourly' ? f.hourly : f.daily) || f.daily || f.hourly || [];
      const today = (f.daily || [])[0];
      nowIc.innerHTML = iconHtml(st, { ...item, icon: item.icon || wxIcon(s?.state) }, 'sun');
      temp.textContent = a.temperature != null ? `${fmtNum(a.temperature)}°` : '--';
      cond.textContent = s ? wxLabel(s.state) : 'Missing';
      hl.textContent = today?.temperature != null ? `H ${fmtNum(today.temperature)}°  L ${fmtNum(today.templow ?? '--')}°` : (a.humidity != null ? `Humidity ${a.humidity}%` : '');
      for (const c of [...el.classList]) if (c.startsWith('wx-') ) el.classList.remove(c);
      el.classList.add('wx-' + wxGroup(s?.state));
      // How much forecast fits depends on the tile's size and shape.
      const r = el.getBoundingClientRect();
      const cw = r.width - 36, chh = r.height - 36;
      const vertical = chh > 260 && cw < chh * 1.25;
      const room = vertical ? chh - 110 : cw;
      const n = Math.max(0, Math.min(list.length, vertical ? Math.floor(room / 44) : Math.floor(room / 66), mode === 'hourly' ? 12 : 8));
      const key = [vertical, n, JSON.stringify(list.slice(0, n)), st.settings?.general?.use24h].join('|');
      if (key === lastKey) return; lastKey = key;
      fc.className = 'wx-fc ' + (vertical ? 'wx-list' : 'wx-strip') + (mode === 'hourly' ? ' wx-hourly' : '');
      fc.innerHTML = '';
      const items = list.slice(0, n);
      const lo = Math.min(...items.map((x) => x.templow ?? x.temperature)), hi = Math.max(...items.map((x) => x.temperature));
      items.forEach((x, i) => {
        const when = wxWhen(x.datetime, mode, i, st.settings?.general?.use24h);
        const pop = x.precipitation_probability >= 20 ? h('div.wx-pop', { text: `${Math.round(x.precipitation_probability)}%` }) : h('div.wx-pop');
        const ic = h('span.wx-sic', { html: iconHtml(st, { icon: wxIcon(x.condition, x.is_daytime === false || (mode === 'hourly' && isNightHour(x.datetime))) }, 'sun') });
        if (vertical) {
          const low = x.templow ?? x.temperature;
          const bar = h('div.wx-bar', {}, h('span', { style: { left: `${((low - lo) / Math.max(1, hi - lo)) * 100}%`, right: `${100 - ((x.temperature - lo) / Math.max(1, hi - lo)) * 100}%` } }));
          fc.append(h('div.wx-row', {}, h('div.wx-when', { text: when }), ic, pop, h('div.wx-lo', { text: x.templow != null ? `${fmtNum(x.templow)}°` : '' }), bar, h('div.wx-hi', { text: `${fmtNum(x.temperature)}°` })));
        } else {
          fc.append(h('div.wx-col', {}, h('div.wx-when', { text: when }), ic, h('div.wx-t', {}, `${fmtNum(x.temperature)}°`, x.templow != null && mode === 'daily' ? h('span.wx-lo', { text: ` ${fmtNum(x.templow)}°` }) : null), pop));
        }
      });
      if (!items.length && !vertical) fc.append(h('div.wx-empty', { text: s ? 'Waiting for forecast…' : '' }));
    };
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return { id, el, update: () => { lastKey = ''; draw(); }, destroy: () => ro.disconnect() };
  }

  weatherSheet(id, item = { id }) {
    const st = this.store;
    let onEv = () => {};
    const sh = sheet({ title: tileName(st, item), cls: 'weather-sheet', onClose: () => { st.removeEventListener('state', onEv); st.removeEventListener('forecast', onEv); } });
    const render = () => {
      const s = st.get(id), a = s?.attributes || {}, f = st.forecasts?.[id] || {};
      const use24h = st.settings?.general?.use24h;
      sh.body.innerHTML = '';
      const unit = a.wind_speed_unit || '';
      const details = [
        a.apparent_temperature != null ? ['Feels like', `${fmtNum(a.apparent_temperature)}°`] : null,
        a.humidity != null ? ['Humidity', `${Math.round(a.humidity)}%`] : null,
        a.wind_speed != null ? ['Wind', `${fmtNum(a.wind_speed)} ${unit}`] : null,
        a.pressure != null ? ['Pressure', `${fmtNum(a.pressure)} ${a.pressure_unit || ''}`] : null,
        a.uv_index != null ? ['UV index', fmtNum(a.uv_index)] : null,
      ].filter(Boolean);
      sh.body.append(h('div.ws-now', {},
        h('span.ws-ic', { html: iconHtml(st, { icon: wxIcon(s?.state) }, 'sun') }),
        h('div', {}, h('div.ws-temp', { text: a.temperature != null ? `${fmtNum(a.temperature)}°` : '--' }), h('div.ws-cond', { text: s ? wxLabel(s.state) : '' })),
        h('div.ws-details', {}, details.map(([k, v]) => h('div.ws-d', {}, h('div.ws-k', { text: k }), h('div.ws-v', { text: v }))))));
      if (f.hourly?.length) {
        sh.body.append(h('div.ls-label', { text: 'Next hours' }), h('div.ws-hours', {}, f.hourly.slice(0, 24).map((x, i) => h('div.wx-col', {},
          h('div.wx-when', { text: wxWhen(x.datetime, 'hourly', i, use24h) }),
          h('span.wx-sic', { html: iconHtml(st, { icon: wxIcon(x.condition, isNightHour(x.datetime)) }, 'sun') }),
          h('div.wx-t', { text: `${fmtNum(x.temperature)}°` }),
          h('div.wx-pop', { text: x.precipitation_probability >= 20 ? `${Math.round(x.precipitation_probability)}%` : '' })))));
      }
      if (f.daily?.length) {
        const days = f.daily.slice(0, 10);
        const lo = Math.min(...days.map((x) => x.templow ?? x.temperature)), hi = Math.max(...days.map((x) => x.temperature));
        sh.body.append(h('div.ls-label', { text: 'Next days' }), h('div.wx-fc.wx-list.ws-days', {}, days.map((x, i) => {
          const low = x.templow ?? x.temperature;
          return h('div.wx-row', {}, h('div.wx-when', { text: wxWhen(x.datetime, 'daily', i) }),
            h('span.wx-sic', { html: iconHtml(st, { icon: wxIcon(x.condition) }, 'sun') }),
            h('div.wx-pop', { text: x.precipitation_probability >= 20 ? `${Math.round(x.precipitation_probability)}%` : '' }),
            h('div.wx-lo', { text: x.templow != null ? `${fmtNum(x.templow)}°` : '' }),
            h('div.wx-bar', {}, h('span', { style: { left: `${((low - lo) / Math.max(1, hi - lo)) * 100}%`, right: `${100 - ((x.temperature - lo) / Math.max(1, hi - lo)) * 100}%` } })),
            h('div.wx-hi', { text: `${fmtNum(x.temperature)}°` }));
        })));
      }
      if (!f.hourly?.length && !f.daily?.length) sh.body.append(h('div.about.small', { text: 'No forecast yet. It appears as soon as Home Assistant sends one.' }));
    };
    onEv = (e) => { if (e.detail === id) render(); };
    st.addEventListener('state', onEv); st.addEventListener('forecast', onEv);
    render();
  }

  // ------------------------------------------------------------------ light controls pop-up
  lightSheet(id, item = { id }) {
    const st = this.store;
    let onState = () => {};
    const sh = sheet({ title: tileName(st, item), cls: 'light-sheet', onClose: () => st.removeEventListener('state', onState) });
    const fill = h('div.bri-fill');
    const pct = h('div.bri-label');
    const bar = h('div.bri-bar', {}, fill, pct);
    const pwr = h('button.pill', { onclick: () => st.activate(id) });
    const side = h('div.ls-side', {}, pwr);
    sh.body.append(h('div.ls-body', {}, bar, side));
    const s0 = st.get(id);
    const a0 = s0?.attributes || {};
    const modes = a0.supported_color_modes || [];
    const turnOn = (data) => st.call('light', 'turn_on', data, { entity_id: id });
    const section = (label, ...kids) => side.append(h('div.ls-label', { text: label }), ...kids);

    // Colour: presets + any colour.
    if (modes.some((m) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(m))) {
      const COLORS = [[255, 214, 140], [255, 159, 10], [255, 69, 58], [255, 55, 95], [191, 90, 242], [94, 92, 230], [10, 132, 255], [100, 210, 255], [48, 209, 88], [255, 255, 255]];
      const custom = h('input.ls-picker', { type: 'color', value: '#ff8a3d', 'aria-label': 'Pick any colour' });
      custom.addEventListener('change', () => { const v = custom.value; turnOn({ rgb_color: [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) }); });
      section('Colour', h('div.ls-colors', {},
        COLORS.map((c) => h('button.ls-color', { style: { background: `rgb(${c})` }, 'aria-label': `Colour ${c}`, onclick: () => turnOn({ rgb_color: c }) })),
        h('label.ls-color.ls-custom', { title: 'Any colour' }, custom)));
    }
    // White: warm → cool slider, with quick presets.
    if (modes.includes('color_temp')) {
      const min = a0.min_color_temp_kelvin || 2000, max = a0.max_color_temp_kelvin || 6500;
      const slider = h('input.ls-ct', { type: 'range', min, max, step: 50, value: a0.color_temp_kelvin || Math.round((min + max) / 2), 'aria-label': 'White temperature' });
      slider.addEventListener('change', () => turnOn({ color_temp_kelvin: Number(slider.value) }));
      const temps = [['Warm', Math.max(min, 2700), '#ffc58a'], ['Neutral', Math.min(max, Math.max(min, 4000)), '#fff1dc'], ['Cool', Math.min(max, 6000), '#dfeaff']];
      section('White', slider, h('div.ls-temps', {}, temps.map(([l, k, c]) => h('button.ls-temp', { style: { background: c }, text: l, onclick: () => { slider.value = k; turnOn({ color_temp_kelvin: k }); } }))));
    }
    // Effects the light offers (WLED, Hue, Govee…).
    const effects = (a0.effect_list || []).filter((e) => e && !/^none$/i.test(e)).slice(0, 60);
    const effectBtns = [];
    if (effects.length) {
      section('Effects', h('div.ls-chips', {}, effects.map((e) => {
        const b = h('button.ls-chip', { text: e, 'data-v': e, onclick: () => turnOn({ effect: e }) });
        effectBtns.push(b); return b;
      })));
    }
    // Scenes: the ones in this light's room, or all of them if it has no room.
    const area = st.area(id);
    let scenes = st.list(['scene']);
    const inArea = area ? scenes.filter((sc) => st.area(sc.entity_id) === area) : [];
    scenes = (inArea.length ? inArea : area ? [] : scenes).slice(0, 24);
    if (scenes.length) {
      section(inArea.length ? `Scenes · ${area}` : 'Scenes', h('div.ls-chips', {}, scenes.map((sc) => h('button.ls-chip.scene', {
        onclick: () => { st.call('scene', 'turn_on', {}, { entity_id: sc.entity_id }); toast(`${st.name(sc.entity_id)} on`); },
      }, h('span.chip-ic', { html: iconHtml(st, { id: sc.entity_id }, 'sparkles') }), st.name(sc.entity_id)))));
    }

    let dragging = false, dragPct = null;
    const paint = () => {
      const s = st.get(id), on = isOn(s);
      const p = dragPct ?? (on ? (s?.attributes?.brightness != null ? Math.round(s.attributes.brightness / 2.55) : 100) : 0);
      fill.style.height = p + '%';
      pct.textContent = on || dragging ? `${p}%` : 'Off';
      const c = s && on ? lightRGB(s) : [120, 120, 128];
      fill.style.background = `linear-gradient(to top, rgba(${c},0.75), rgb(${c}))`;
      pwr.textContent = on ? 'Turn off' : 'Turn on';
      pwr.classList.toggle('primary', !on);
      const cur = s?.attributes?.effect;
      for (const b of effectBtns) b.classList.toggle('on', on && b.dataset.v === cur);
    };
    const fromEvent = (e) => { const r = bar.getBoundingClientRect(); return Math.max(1, Math.min(100, Math.round((1 - (e.clientY - r.top) / r.height) * 100))); };
    bar.addEventListener('pointerdown', (e) => { dragging = true; bar.setPointerCapture(e.pointerId); dragPct = fromEvent(e); paint(); });
    bar.addEventListener('pointermove', (e) => { if (dragging) { dragPct = fromEvent(e); paint(); } });
    const end = () => {
      if (!dragging) return; dragging = false;
      turnOn({ brightness_pct: dragPct });
      setTimeout(() => { dragPct = null; paint(); }, 1500);
    };
    bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
    onState = (e) => { if (e.detail === id) paint(); };
    st.addEventListener('state', onState);
    paint();
  }
}
