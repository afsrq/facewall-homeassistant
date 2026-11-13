// The Home page: greeting, clock and tiles for Home Assistant entities.
import { icon, domainIcon } from './icons.js';
import { domainOf, isOn, lightRGB, formatState, cap } from './data.js';
import { h, press, sheet, toast } from './ui.js';

const TOGGLES = ['switch', 'input_boolean', 'fan', 'automation', 'siren', 'humidifier'];
const ACTIONS = ['scene', 'script', 'button', 'input_button'];
export const TIMER_OK = (id) => ['switch', 'input_boolean', 'fan', 'water_heater', 'light'].includes(domainOf(id));

export const ALL_OFF = '_alloff';
export const tileName = (store, id) => (id === ALL_OFF ? 'All lights off' : store.name(id));
export const tileIcon = (id) => (id === ALL_OFF ? 'bulbOff' : domainIcon(domainOf(id)));
export const MAX_H = 4;
export const pageOf = (settings, pageId) => settings?.pages?.find((p) => p.id === pageId) || null;

export function kindFor(item) {
  if (item.id === ALL_OFF) return 'alloff';
  const d = domainOf(item.id);
  if (d === 'climate') return 'climate';
  if (d === 'water_heater' || (item.timer && TIMER_OK(item.id))) return 'timer';
  if (d === 'lock') return 'lock';
  if (d === 'light') return 'light';
  if (TOGGLES.includes(d)) return 'toggle';
  if (d === 'cover') return 'cover';
  if (ACTIONS.includes(d)) return 'action';
  return 'sensor';
}
/** [width in columns, height in rows] for a tile (its own size, or the default for its kind). */
export function sizeOf(item) {
  const def = kindFor(item) === 'climate' ? [2, 1] : [1, 1];
  return [item.w || def[0], item.h || def[1]];
}

const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const fmtTemp = (t) => (t == null ? '--' : Number.isInteger(t) ? String(t) : t.toFixed(1));
function fmtLeft(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}
function greeting(d) {
  const hr = d.getHours();
  if (hr >= 5 && hr < 12) return 'Good morning';
  if (hr >= 12 && hr < 17) return 'Good afternoon';
  if (hr >= 17 && hr < 22) return 'Good evening';
  return 'Good night';
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
      resize: () => { if (this.layout()) this.render(); },
    };
    store.addEventListener('state', this.handlers.state);
    store.addEventListener('snapshot', this.handlers.snapshot);
    store.addEventListener('timers', this.handlers.timers);
    window.addEventListener('resize', this.handlers.resize);
    this.interval = setInterval(() => this.tick(), 1000);
  }

  destroy() {
    this.store.removeEventListener('state', this.handlers.state);
    this.store.removeEventListener('snapshot', this.handlers.snapshot);
    this.store.removeEventListener('timers', this.handlers.timers);
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
    this.root.innerHTML = '';
    this.cards = [];
    this.greet = h('div.greet');
    this.date = h('div.date');
    this.time = h('div.home-time');
    const head = h('header.home-head', {},
      h('div', {}, this.greet, this.date),
      h('div.head-right', {},
        this.time,
        h('button.icon-btn.glass', { 'aria-label': 'Edit layout', html: icon('grid'), onclick: () => this.setEditing(!this.editing) }),
        h('button.icon-btn.glass', { 'aria-label': 'Clock', html: icon('clock'), onclick: () => this.app.goTo(0) }),
        h('button.icon-btn.glass', { 'aria-label': 'Settings', html: icon('gear'), onclick: () => this.app.openSettings({ page: this.pageId }) })));
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
    el.style.gridColumn = `span ${Math.min(w, this.cols || 5)}`;
    el.style.gridRow = `span ${Math.min(hgt, MAX_H)}`;
  }

  /** Works out columns/rows for this screen. Returns true if the column count changed. */
  layout() {
    if (!this.grid) return false;
    const L = this.page?.layout || {};
    const W = this.root.clientWidth || innerWidth, H = this.root.clientHeight || innerHeight;
    const portrait = H > W * 1.1;
    const cols = L.cols || (W >= 1050 ? 5 : W >= 760 ? 4 : 3);
    const rows = L.rows || (portrait ? 3 : 2);
    const gap = Math.round(Math.min(W, H) * (cols > 6 || rows > 3 ? 0.015 : 0.02));
    const headH = Math.round(H * 0.13) + 8;
    const reserve = this.editing ? 84 : 0; // room for the edit bar
    const rowH = Math.max(96, Math.floor((H - headH - reserve - gap * (rows + 1)) / rows));
    const changed = this.cols !== cols;
    Object.assign(this, { cols, rows, gap, rowH });
    this.root.style.setProperty('--cols', cols);
    this.root.style.setProperty('--gap', gap + 'px');
    this.root.style.setProperty('--row-h', rowH + 'px');
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
    const label = h('div.eo-size', {}, h('div.eo-dims', { text: `${w} × ${hgt}` }), h('div.eo-name', { text: tileName(this.store, item.id) }));
    const save = (fn) => { this.app.update((s) => fn(pageOf(s, this.pageId).entities)); this.render(); };
    const last = this.items.length - 1;
    const handle = h('div.eo-handle', { html: icon('resize'), 'aria-label': 'Drag to resize' });
    const ov = h('div.edit-ov', {},
      h('button.eo-remove', { 'aria-label': 'Remove', html: icon('close'), onclick: () => save((a) => a.splice(index, 1)) }),
      h('div.eo-move', {},
        h('button', { 'aria-label': 'Move earlier', html: icon('back'), disabled: index === 0, onclick: () => save((a) => a.splice(index - 1, 0, a.splice(index, 1)[0])) }),
        h('button.flip', { 'aria-label': 'Move later', html: icon('back'), disabled: index === last, onclick: () => save((a) => a.splice(index + 1, 0, a.splice(index, 1)[0])) })),
      label, handle);
    // Keep taps from reaching the tile underneath.
    for (const t of ['pointerdown', 'pointerup', 'click', 'contextmenu']) ov.addEventListener(t, (e) => e.stopPropagation());

    // Drag the corner handle: size snaps to whole columns / rows.
    let start = null;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const cs = getComputedStyle(this.grid);
      const inner = this.grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const colW = (inner - this.gap * (this.cols - 1)) / this.cols;
      start = { x: e.clientX, y: e.clientY, w, h: hgt, cx: colW + this.gap, cy: this.rowH + this.gap };
      el.classList.add('resizing');
    });
    handle.addEventListener('pointermove', (e) => {
      if (!start) return;
      const nw = Math.max(1, Math.min(this.cols, Math.round(start.w + (e.clientX - start.x) / start.cx)));
      const nh = Math.max(1, Math.min(MAX_H, Math.round(start.h + (e.clientY - start.y) / start.cy)));
      if (nw === w && nh === hgt) return;
      w = nw; hgt = nh;
      this.applySize(el, w, hgt);
      label.firstChild.textContent = `${w} × ${hgt}`;
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
    const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    this.greet.textContent = this.isHome ? greeting(now) : this.page.name;
    this.date.textContent = this.isHome ? date : `${greeting(now)}  ·  ${date}`;
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
    if (kind === 'alloff') return this.allOffCard(this.items.filter((i) => domainOf(i.id) === 'light').map((i) => i.id));
    const fn = { climate: this.climateCard, timer: this.timerCard, lock: this.lockCard, light: this.lightCard, toggle: this.toggleCard, cover: this.coverCard, action: this.actionCard, sensor: this.sensorCard }[kind];
    return fn.call(this, item.id);
  }

  headEl(id, ic) {
    const area = this.store.area(id);
    return h('div.card-head', {},
      h('span.card-ic', { html: icon(ic) }),
      h('div.card-titles', {}, h('div.card-title', { text: this.store.name(id) }), area ? h('div.card-sub', { text: area }) : null));
  }

  climateCard(id) {
    const st = this.store;
    const MODES = { cool: ['snow', 'Cool'], heat: ['sun', 'Heat'], dry: ['drop', 'Dry'], fan_only: ['fan', 'Fan'], auto: ['auto', 'Auto'], heat_cool: ['auto', 'Heat/Cool'] };
    const temp = h('div.cl-temp');
    const inside = h('div.cl-inside');
    const pwr = h('button.round-btn', { html: icon('power'), 'aria-label': 'Power' });
    const up = h('button.round-btn', { html: icon('up'), 'aria-label': 'Warmer' });
    const down = h('button.round-btn', { html: icon('down'), 'aria-label': 'Cooler' });
    const modes = h('div.cl-modes');
    const el = h('div.card.climate', {},
      h('div.card-head-row', {}, this.headEl(id, 'snow'), pwr),
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

  timerCard(id) {
    const st = this.store;
    const minutes = this.store.settings.dashboard?.timerMinutes || [15, 30, 45, 60];
    const C = 2 * Math.PI * 44;
    const ring = h('button.ring', { 'aria-label': 'Toggle', html:
      `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="ring-track"/><circle cx="50" cy="50" r="44" class="ring-arc" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 50 50)"/></svg>` +
      `<div class="ring-label">${icon(domainOf(id) === 'water_heater' ? 'flame' : domainIcon(domainOf(id)))}<span></span></div>` });
    const chips = h('div.chips');
    const small = h('div.tile-state.t-state');
    const el = h('div.card.timer', {}, this.headEl(id, domainOf(id) === 'water_heater' ? 'flame' : domainIcon(domainOf(id))), h('div.ring-wrap', {}, ring), small, chips);
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

  lockCard(id) {
    const st = this.store;
    const big = h('div.lock-big');
    const label = h('div.tile-state');
    const hint = h('div.tile-hint');
    const el = h('div.card.lock', {}, this.headEl(id, 'lock'), big, h('div.tile-bottom', {}, label, hint));
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
    };
    return { id, el, update };
  }

  lightCard(id) {
    const st = this.store;
    const name = h('div.tile-name', { text: st.name(id) });
    const state = h('div.tile-state');
    const ic = h('span.tile-ic', { html: icon('bulb') });
    const more = h('button.tile-more', { html: icon('sliders'), 'aria-label': 'Brightness and colour', onclick: (e) => { e.stopPropagation(); this.lightSheet(id); } });
    more.addEventListener('pointerdown', (e) => e.stopPropagation());
    const el = h('div.card.tile.light', {}, h('div.tile-top', {}, ic, more), h('div.tile-bottom', {}, name, state));
    press(el, { onTap: () => st.activate(id), onLong: () => this.lightSheet(id) });
    const update = () => {
      const s = st.get(id), on = isOn(s);
      el.classList.toggle('on', on);
      if (on) {
        const c = lightRGB(s), rgb = c.join(',');
        const bri = s.attributes.brightness != null ? s.attributes.brightness / 255 : 1;
        el.style.setProperty('--lc', rgb);
        el.style.setProperty('--la', String(0.55 + 0.45 * bri));
        el.classList.toggle('dark-text', lum(c) > 0.62);
      } else { el.style.removeProperty('--lc'); el.classList.remove('dark-text'); }
      state.textContent = !s ? 'Missing' : on ? (s.attributes.brightness != null ? `On · ${Math.round(s.attributes.brightness / 2.55)}%` : 'On') : cap(s.state);
    };
    return { id, el, update };
  }

  allOffCard(ids) {
    const st = this.store;
    const state = h('div.tile-state');
    const el = h('div.card.tile.alloff', {}, h('div.tile-top', {}, h('span.tile-ic', { html: icon('bulbOff') })), h('div.tile-bottom', {}, h('div.tile-name', { text: 'All lights off' }), state));
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

  toggleCard(id) {
    const st = this.store, d = domainOf(id);
    const state = h('div.tile-state');
    const el = h('div.card.tile.toggle', {}, h('div.tile-top', {}, h('span.tile-ic', { html: icon(domainIcon(d)) })), h('div.tile-bottom', {}, h('div.tile-name', { text: st.name(id) }), state));
    press(el, { onTap: () => st.activate(id) });
    const update = () => { const s = st.get(id); el.classList.toggle('on', isOn(s)); state.textContent = s ? cap(s.state) : 'Missing'; };
    return { id, el, update };
  }

  actionCard(id) {
    const st = this.store, d = domainOf(id);
    const state = h('div.tile-state', { text: d === 'scene' ? 'Scene' : 'Tap to run' });
    const el = h('div.card.tile.action', {}, h('div.tile-top', {}, h('span.tile-ic', { html: icon(domainIcon(d)) })), h('div.tile-bottom', {}, h('div.tile-name', { text: st.name(id) }), state));
    press(el, {
      onTap: () => {
        st.activate(id);
        el.classList.add('fired'); state.textContent = 'Activated';
        setTimeout(() => { el.classList.remove('fired'); state.textContent = d === 'scene' ? 'Scene' : 'Tap to run'; }, 1600);
      },
    });
    return { id, el, update: () => {} };
  }

  coverCard(id) {
    const st = this.store;
    const state = h('div.tile-state');
    const mk = (ic, svc) => { const b = h('button.mini', { html: icon(ic) }); b.onclick = (e) => { e.stopPropagation(); st.call('cover', svc, {}, { entity_id: id }); }; return b; };
    const el = h('div.card.tile.cover', {}, h('div.tile-top', {}, h('span.tile-ic', { html: icon('blinds') })),
      h('div.tile-bottom', {}, h('div.tile-name', { text: st.name(id) }), state, h('div.mini-row', {}, mk('up', 'open_cover'), mk('stop', 'stop_cover'), mk('down', 'close_cover'))));
    const update = () => {
      const s = st.get(id), p = s?.attributes?.current_position;
      state.textContent = !s ? 'Missing' : p != null && p > 0 && p < 100 ? `${p}% open` : cap(s.state);
      el.classList.toggle('on', isOn(s));
    };
    return { id, el, update };
  }

  sensorCard(id) {
    const st = this.store, d = domainOf(id);
    const val = h('div.sensor-val');
    const el = h('div.card.tile.sensor', {}, h('div.tile-top', {}, h('span.tile-ic', { html: icon(st.get(id)?.attributes?.device_class === 'temperature' ? 'thermo' : domainIcon(d)) })),
      h('div.tile-bottom', {}, val, h('div.tile-name', { text: st.name(id) })));
    const update = () => { val.textContent = formatState(st, id); };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ light detail
  lightSheet(id) {
    const st = this.store;
    const sh = sheet({ title: st.name(id), cls: 'light-sheet', onClose: () => st.removeEventListener('state', onState) });
    const fill = h('div.bri-fill');
    const pct = h('div.bri-label');
    const bar = h('div.bri-bar', {}, fill, pct);
    const pwr = h('button.pill', { onclick: () => st.activate(id) });
    const side = h('div.ls-side', {}, pwr);
    sh.body.append(h('div.ls-body', {}, bar, side));
    const s0 = st.get(id);
    const modes = s0?.attributes?.supported_color_modes || [];
    if (modes.some((m) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(m))) {
      const COLORS = [[255, 214, 140], [255, 159, 10], [255, 69, 58], [255, 55, 95], [191, 90, 242], [94, 92, 230], [10, 132, 255], [100, 210, 255], [48, 209, 88], [255, 255, 255]];
      side.append(h('div.ls-label', { text: 'Colour' }), h('div.ls-colors', {}, COLORS.map((c) => h('button.ls-color', { style: { background: `rgb(${c})` }, onclick: () => st.call('light', 'turn_on', { rgb_color: c }, { entity_id: id }) }))));
    }
    if (modes.includes('color_temp')) {
      const temps = [['Warm', 2700, '#ffc58a'], ['Neutral', 4000, '#fff1dc'], ['Cool', 6000, '#dfeaff']];
      side.append(h('div.ls-label', { text: 'White' }), h('div.ls-temps', {}, temps.map(([l, k, c]) => h('button.ls-temp', { style: { background: c }, text: l, onclick: () => st.call('light', 'turn_on', { color_temp_kelvin: k }, { entity_id: id }) }))));
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
    };
    const fromEvent = (e) => { const r = bar.getBoundingClientRect(); return Math.max(1, Math.min(100, Math.round((1 - (e.clientY - r.top) / r.height) * 100))); };
    bar.addEventListener('pointerdown', (e) => { dragging = true; bar.setPointerCapture(e.pointerId); dragPct = fromEvent(e); paint(); });
    bar.addEventListener('pointermove', (e) => { if (dragging) { dragPct = fromEvent(e); paint(); } });
    const end = () => {
      if (!dragging) return; dragging = false;
      st.call('light', 'turn_on', { brightness_pct: dragPct }, { entity_id: id });
      setTimeout(() => { dragPct = null; paint(); }, 1500);
    };
    bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
    const onState = (e) => { if (e.detail === id) paint(); };
    st.addEventListener('state', onState);
    paint();
  }
}
