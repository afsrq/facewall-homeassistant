// Facewall app shell: pager (clock ⇄ room pages), face picker, customize, gallery, settings, per-screen settings.
import { Store, domainOf, isOn } from './data.js';
import { FACES, FACE_ORDER, mountFace, TIME_FACES, TIME_POS, faceEdgeColors } from './faces.js';
import { HomePage, SECTION_PRESETS, cameraUrl, TIMER_OK, ALL_OFF, SCENES, tileName, tileIcon, sizeOf, pageOf, iconHtml, stylesFor, styleOf, kindFor, ICON_MOVABLE, ICON_POSITIONS, NAME_POSITIONS, MAX_H, MIN_SIZE, roundSize, fmtSize, colorSlots, tileBackground } from './home.js';
import { THEMES, THEME_GROUPS, DEFAULT_THEME, themeById, themeVars, applyTheme, LOOKS, applyLook } from './themes.js';
import { loadIcons, loadCustom, customList, iconSvg, searchIcons, LIBRARIES, SETS, uploadIcons, deleteIcon, onIconsChanged, searchOnline, useOnlineIcon } from './iconlib.js';
import { icon, domainIcon } from './icons.js';
import { inHaPanel, setHaKiosk, openHaMenu, setHaFill, canFill, setHaChrome } from './hapanel.js';
import { FONTS, WEIGHTS, SEPARATORS, PARTS, DATE_FORMATS, fmtDate, defaultHeader, headerOf, headerSegments, headerContent, headerVars, weatherEntity } from './header.js';
import { h, press, sheet, toast, toggle, segmented, swatches, row, entitySelect, openSheets } from './ui.js';

const uid = () => Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));
const TAP_GROUPS = [['Lights', ['light']], ['Switches', ['switch', 'input_boolean']], ['Fans', ['fan']], ['Scenes', ['scene']], ['Scripts', ['script']], ['Covers', ['cover']]];
const INFO_GROUPS = [['Weather', ['weather']], ['Calendars', ['calendar']], ['Sensors', ['sensor']], ['Binary sensors', ['binary_sensor']], ['Climate', ['climate']], ['Media', ['media_player']], ['Lights', ['light']], ['Switches', ['switch']]];
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const slug = (t) => String(t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// What a room page made from a Home Assistant area starts with, in this order.
const AREA_ORDER = ['climate', 'water_heater', 'lock', 'light', 'switch', 'fan', 'input_boolean', 'cover', 'sensor'];
const TILE_DOMAINS = ['weather', 'light', 'climate', 'water_heater', 'lock', 'switch', 'input_boolean', 'fan', 'cover', 'scene', 'script', 'button', 'input_button', 'sensor', 'binary_sensor', 'automation', 'media_player', 'camera', 'calendar', 'person', 'device_tracker', 'vacuum', 'alarm_control_panel'];

function defaultSettings(store) {
  const ids = (d, n) => store.list([d]).slice(0, n).map((s) => s.entity_id);
  const ents = [...ids('weather', 1), ...ids('climate', 1), ...ids('water_heater', 1), ...ids('lock', 1), ...ids('light', 5)];
  if (ents.length < 4) ents.push(...ids('switch', 4 - ents.length));
  const firstLight = store.list(['light'])[0]?.entity_id || null;
  const temp = store.list(['sensor']).find((s) => s.attributes.device_class === 'temperature')?.entity_id || null;
  const hc = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
  const faces = [
    { id: uid(), type: 'classic', opts: {}, tap: null, tl: null, tr: null },
    { id: uid(), type: 'numerals', opts: { color: 'green' }, tap: null, tl: null, tr: null },
    { id: uid(), type: 'gradient', opts: {}, tap: null, tl: null, tr: null },
    { id: uid(), type: 'digital', opts: {}, tap: null, tl: temp, tr: null },
    { id: uid(), type: 'lamp', opts: {}, tap: firstLight, tl: null, tr: null },
  ];
  return {
    version: 1,
    faces,
    active: faces[0].id,
    pages: [{ id: 'home', name: 'Home', layout: { cols: null, rows: null },
      entities: [...ents, ...(ents.filter((e) => domainOf(e) === 'light').length >= 2 ? [ALL_OFF] : [])].map((id) => ({ id })) }],
    screens: {},
    dashboard: { timerMinutes: [15, 30, 45, 60] },
    general: { use24h: hc === 'h23' || hc === 'h24', idleSec: 60, dim: { on: false, from: '23:00', to: '06:30', level: 0.55 } },
  };
}

/** Bring settings saved by an older version up to date. Returns true if anything changed. */
function migrate(s) {
  let changed = false;
  const d = s.dashboard || (s.dashboard = { entities: [] });
  if ('allOff' in d) {
    const lights = d.entities.filter((e) => domainOf(e.id) === 'light').length;
    if (d.allOff !== false && lights >= 2 && !d.entities.some((e) => e.id === ALL_OFF)) d.entities.push({ id: ALL_OFF });
    delete d.allOff; changed = true;
  }
  if (!s.layout && !s.pages) { s.layout = { cols: null, rows: null }; changed = true; }
  // 1.2: one dashboard → several room pages.
  if (!Array.isArray(s.pages)) {
    s.pages = [{ id: 'home', name: 'Home', entities: d.entities || [], layout: s.layout || { cols: null, rows: null } }];
    delete d.entities; delete s.layout; changed = true;
  }
  if (!s.screens) { s.screens = {}; changed = true; }
  if (!d.timerMinutes) { d.timerMinutes = [15, 30, 45, 60]; changed = true; }
  return changed;
}

/** Entities worth a tile on a room page made from a Home Assistant area. */
function areaEntities(store, area) {
  const picked = store.list(AREA_ORDER).filter((st) => store.area(st.entity_id) === area).filter((st) => {
    const d = domainOf(st.entity_id);
    if (d === 'sensor') return ['temperature', 'humidity'].includes(st.attributes.device_class);
    return st.state !== 'unavailable' || d !== 'switch';
  });
  picked.sort((a, b) => AREA_ORDER.indexOf(domainOf(a.entity_id)) - AREA_ORDER.indexOf(domainOf(b.entity_id)));
  const ids = picked.slice(0, 16).map((st) => st.entity_id);
  if (ids.filter((id) => domainOf(id) === 'light').length >= 2) ids.push(ALL_OFF);
  return ids.map((id) => ({ id }));
}

class App {
  constructor() {
    this.store = new Store();
    this.page = 0;
    this.overlays = [];
    this.lastActivity = Date.now();
  }

  async start() {
    const setAR = () => document.documentElement.style.setProperty('--ar', String(innerWidth / innerHeight));
    setAR(); window.addEventListener('resize', setAR);
    document.body.classList.add('loading');
    await this.store.init();
    if (!this.store.settings) this.store.saveSettings(defaultSettings(this.store));
    else { const m = clone(this.store.settings); if (migrate(m)) this.store.saveSettings(m); }
    if (this.store.mode === 'demo') document.body.classList.add('demo');
    this.screenId = this.resolveScreen();
    { this.appliedTheme = applyTheme(this.themeId()).id; applyLook(this.settings.general.look); }
    setTimeout(() => { this.syncTheme(); this.shiftPixels(true); }, 2500);
    this.applyHa();
    this.buildShell();
    this.renderFace();
    this.renderRooms();
    this.goTo(this.startIndex(), true);
    document.body.classList.remove('loading');
    // Icons load in the background; tiles switch to their Home Assistant / custom icons when ready.
    onIconsChanged(() => this.rooms.forEach((r) => r.render()));
    loadIcons();

    this.store.addEventListener('settings', (e) => {
      if (!e.detail.external) return;
      if (!this.themePreviewing) { this.appliedTheme = applyTheme(this.themeId()).id; applyLook(this.settings.general.look); }
      this.applyHa();
      this.renderFace(); this.renderRooms();
    });
    this.store.addEventListener('status', () => { this.showStatus(); this.syncTheme(); });
    this.store.addEventListener('state', (e) => { this.checkDoorbell(e.detail); this.checkMotion(e.detail); if (e.detail === 'sun.sun') this.syncTheme(); });
    this.store.addEventListener('error', (e) => toast(e.detail, 'error'));
    this.showStatus();

    window.addEventListener('resize', () => { clearTimeout(this.rt); this.rt = setTimeout(() => { this.renderFace(); this.goTo(this.page, true); }, 150); });
    document.addEventListener('pointerdown', (e) => {
      this.lastActivity = Date.now(); this.wake();
      if (e.pointerType === 'touch') this.setMouse(false);
    }, true);
    // Mouse & keyboard (a computer): show navigation controls, and count movement/typing as activity.
    this.setMouse(matchMedia('(any-hover: hover) and (any-pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches);
    document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.setMouse(true); this.showNav(); this.lastActivity = Date.now(); } }, { passive: true });
    document.addEventListener('wheel', () => { this.lastActivity = Date.now(); }, { passive: true });
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.wake(true); });
    setInterval(() => this.idleCheck(), 2000);
    setInterval(() => { this.applyDim(); this.syncTheme(); this.shiftPixels(); }, 20000);
    this.applyDim();
  }

  get settings() { return this.store.settings; }

  // ------------------------------------------------------------------ this screen (per iPad)
  /** Which screen this is: ?screen=kitchen in the address wins, otherwise an id remembered by this browser. */
  resolveScreen() {
    const q = slug(new URLSearchParams(location.search).get('screen'));
    if (q) return q;
    let id = lsGet('facewall-screen');
    if (!id) { id = 'screen-' + uid(); lsSet('facewall-screen', id); }
    return id;
  }
  get screen() { return this.settings.screens?.[this.screenId] || {}; }
  /** This screen's theme: its own choice, else the house theme. */
  baseThemeId() { return this.screen.theme || this.settings.general?.theme || DEFAULT_THEME; }
  /** The theme to show now: this iPad's night theme after dark, otherwise its own or the house theme. */
  themeId() { const n = this.screen.night; return n?.theme && this.isNight(n) ? n.theme : this.baseThemeId(); }
  isNight(n) {
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
    if (n.mode === 'times') {
      const toMin = (t) => { const [a, b] = (t || '0:0').split(':').map(Number); return a * 60 + b; };
      const from = toMin(n.from || '20:00'), to = toMin(n.to || '07:00');
      return from <= to ? m >= from && m < to : m >= from || m < to;
    }
    const sun = this.store.get('sun.sun');
    return sun ? sun.state === 'below_horizon' : m >= 19 * 60 || m < 7 * 60;
  }
  /** Switch between the day and night theme when it's time. */
  syncTheme() { if (this.themePreviewing) return; const t = this.themeId(); if (t !== this.appliedTheme) { applyTheme(t); this.appliedTheme = t; } }
  updateScreen(fn) {
    this.update((s) => { s.screens ||= {}; const sc = s.screens[this.screenId] ||= {}; fn(sc); sc.seen = Date.now(); });
  }
  startIndex() {
    const sp = this.screen.startPage;
    if (!sp || sp === 'clock') return 0;
    const i = this.settings.pages.findIndex((p) => p.id === sp);
    return i >= 0 ? i + 1 : 0;
  }
  update(mut) {
    const s = clone(this.settings); mut(s); this.store.saveSettings(s);
    if (!this.themePreviewing) { this.appliedTheme = applyTheme(this.themeId()).id; applyLook(this.settings.general.look); }
    this.applyHa();
    return s;
  }

  // ------------------------------------------------------------------ shell
  buildShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    this.facePage = h('section.page.face-page');
    this.pager = h('div.pager', {}, this.facePage);
    this.rooms = [];
    this.dots = h('div.pager-dots');
    this.dim = h('div.dim');
    this.sleepCover = h('div.sleep-cover', { onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); this.setSleep(false); } });
    this.faceToast = h('div.face-toast');
    this.facePage.append(this.faceToast);
    this.statusPill = h('div.status-pill');
    this.navPrev = h('button.nav-arrow.prev', { 'aria-label': 'Previous page (←)', html: icon('back'), onclick: () => this.step(-1) });
    this.navNext = h('button.nav-arrow.next', { 'aria-label': 'Next page (→)', html: icon('back'), onclick: () => this.step(1) });
    this.clockBar = h('div.clock-bar', {},
      h('button.pill', { html: icon('grid') + '<span>Change face</span>', onclick: () => this.openPicker() }),
      h('button.pill', { html: icon('sliders') + '<span>Customize</span>', onclick: () => this.openCustomize(this.activeFace(), 'edit') }),
      h('button.pill', { html: icon('home') + '<span>Pages</span>', onclick: () => this.goTo(1) }),
      h('button.icon-btn.glass', { 'aria-label': 'Settings', html: icon('gear'), onclick: () => this.openSettings() }));
    app.append(this.pager, this.dots, this.navPrev, this.navNext, this.clockBar, this.dim, this.sleepCover, this.statusPill);
    this.pager.addEventListener('scroll', () => {
      const p = Math.round(this.pager.scrollLeft / Math.max(1, this.pager.clientWidth));
      if (p !== this.page) { this.page = p; this.onPage(); }
      this.dots.classList.add('show'); clearTimeout(this.dt);
      this.dt = setTimeout(() => this.dots.classList.toggle('show', this.page >= 1), 1200);
    }, { passive: true });
    press(this.facePage, { onTap: () => this.faceTap(), onLong: () => this.openPicker() });
  }

  /** (Re)build one pager page per room page, keeping the clock first. */
  renderRooms() {
    const pages = this.settings.pages || [];
    const sameIds = this.rooms.length === pages.length && this.rooms.every((r, i) => r.pageId === pages[i].id);
    if (!sameIds) {
      const editing = this.rooms.find((r) => r.editing)?.pageId;
      this.rooms.forEach((r) => r.destroy());
      this.rooms = pages.map((pg) => {
        const sec = h('section.page.home-page', { 'data-page': pg.id });
        this.pager.append(sec);
        const room = new HomePage(sec, this.store, this, pg.id);
        if (pg.id === editing) room.editing = true;
        return room;
      });
      this.dots.innerHTML = '';
      for (let i = 0; i <= pages.length; i++) this.dots.append(h('button' + (i === 0 ? '.clock-dot' : ''), { 'aria-label': i === 0 ? 'Clock' : pages[i - 1].name, onclick: () => this.goTo(i) }));
      if (this.page > pages.length) this.goTo(pages.length, true);
    }
    this.rooms.forEach((r) => r.render());
    this.onPage();
  }
  get pageCount() { return 1 + (this.settings.pages || []).length; }
  step(d) { this.goTo(Math.max(0, Math.min(this.pageCount - 1, this.page + d))); }
  setMouse(on) { document.body.classList.toggle('mouse', !!on); }
  showNav() {
    document.body.classList.add('nav-show');
    clearTimeout(this.navT);
    this.navT = setTimeout(() => document.body.classList.remove('nav-show'), 2600);
  }
  /** Keyboard: ← → switch pages, Esc closes the top panel, Enter picks in the face picker. */
  onKey(e) {
    this.lastActivity = Date.now();
    const tag = (e.target?.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { this.closeTop(); return; }
    const panel = document.querySelector('.sheet-backdrop, .overlay.customize, .overlay.gallery');
    if (this.picker && !panel) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); this.picker.step(e.key === 'ArrowLeft' ? -1 : 1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.picker.chooseCenter(); }
      return;
    }
    if (panel || this.picker) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); this.step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); this.goTo(0); }
  }
  closeTop() {
    if (openSheets.length) return openSheets[openSheets.length - 1]();
    const cz = document.querySelector('.overlay.customize');
    if (cz) return cz.querySelector('.cz-head .icon-btn')?.click();
    if (this.gallery) return this.gallery.close();
    if (this.picker) return this.closePicker();
    const ed = this.rooms.find((r) => r.editing);
    if (ed) ed.setEditing(false);
  }
  /** Inside Home Assistant: hide its sidebar and top bar, and (by default) fill the whole screen. */
  applyHa() {
    const hide = !!this.screen.hideHa;
    setHaKiosk(hide);
    setHaFill(hide && this.screen.edge !== false);
    if (inHaPanel && !this._chromeTimer) this._chromeTimer = setInterval(() => this.syncHaChrome(), 1500);
    this.syncHaChrome();
  }
  /** Colour the Home Assistant app's own strips (status bar, edges) to match what's on screen. */
  syncHaChrome() {
    if (!inHaPanel) return;
    if (this.screen.edge === false) return setHaChrome(null, null);
    let c;
    if (this.sleeping || this.frame) c = ['rgb(0, 0, 0)', 'rgb(0, 0, 0)'];
    else if (this.page === 0) c = faceEdgeColors(this.facePage?.querySelector('.face-host'));
    else { const bg = getComputedStyle(document.documentElement).getPropertyValue('--t-bg').trim() || '#000'; c = [bg, bg]; }
    setHaChrome(c[0], c[1]);
  }
  roomFor(pageId) { const id = String(pageId || '').split('~')[0]; return this.rooms.find((r) => r.pageId === id); }
  get currentRoom() { return this.rooms[this.page - 1] || null; }
  goToRoom(pageId) {
    const [id, sec] = String(pageId || '').split('~');
    const i = this.settings.pages.findIndex((p) => p.id === id);
    if (i < 0) return;
    const r = this.roomFor(id);
    if (r && (r.view || null) !== (sec || null)) r.showSection(sec || null);
    this.goTo(i + 1);
  }

  goTo(p, instant) {
    this.page = p;
    this.pager.scrollTo({ left: p * this.pager.clientWidth, behavior: instant ? 'auto' : 'smooth' });
    this.onPage();
  }
  onPage() {
    [...this.dots.children].forEach((d, i) => d.classList.toggle('on', i === this.page));
    this.dots.classList.toggle('show', this.page >= 1);
    if (this.face) this.face.paused = this.page !== 0;
    document.body.classList.toggle('on-clock', this.page === 0);
    if (this.navPrev) { this.navPrev.hidden = this.page === 0; this.navNext.hidden = this.page >= this.pageCount - 1; }
    document.body.classList.toggle('rail-page', !!this.currentRoom?.root.classList.contains('has-rail'));
    setTimeout(() => this.syncHaChrome(), 50);
    this.rooms?.forEach((r, i) => { if (r.editing && i + 1 !== this.page) r.setEditing(false); });
  }

  // ------------------------------------------------------------------ live face
  activeFace() {
    const s = this.settings;
    const own = this.screen.faceId;
    return s.faces.find((f) => f.id === own) || s.faces.find((f) => f.id === s.active) || s.faces[0];
  }
  renderFace() {
    this.face?.destroy();
    const f = this.activeFace();
    if (!f) return;
    this.face = mountFace(this.facePage, f, { store: this.store, w: innerWidth, h: innerHeight, use24h: this.settings.general.use24h, preview: false });
    this.facePage.prepend(this.face.host);
    this.face.paused = this.page !== 0;
  }
  /** What tapping the clock does on this screen: 'face' (the face's own tap action) or a page id to open. */
  clockTapTarget() {
    const sc = this.screen, pages = this.settings.pages || [];
    if (sc.clockTap === 'face') return 'face';
    if (sc.clockTap && pages.some((p) => p.id === sc.clockTap)) return sc.clockTap;
    if (this.activeFace()?.tap) return 'face'; // e.g. the Lamp face switches its light
    if (sc.startPage && pages.some((p) => p.id === sc.startPage)) return sc.startPage;
    return pages[0]?.id || 'face';
  }
  faceTap() {
    const target = this.clockTapTarget();
    if (target !== 'face') { this.goToRoom(target); return; }
    const f = this.activeFace();
    if (!f?.tap) {
      if (!this.hinted) {
        this.hinted = true;
        if (document.body.classList.contains('mouse')) this.showFaceToast(null, 'Right-click to change the face', 'Move the mouse for buttons  ·  ← → for pages');
        else this.showFaceToast(null, 'Hold to change the face', 'Swipe left for your pages');
      }
      return;
    }
    const id = f.tap, d = domainOf(id);
    const s = this.store.get(id);
    this.face.inst.onTap?.();
    const willBeOn = this.store.activate(id);
    if (FACES[f.type]?.needsTap) return; // the Lamp face shows the change itself
    const noun = d === 'light' ? 'Light' : d === 'fan' ? 'Fan' : d === 'cover' ? (willBeOn ? 'Opening' : 'Closing') : '';
    let title;
    if (d === 'scene' || d === 'script') title = 'Activated';
    else if (d === 'cover') title = noun;
    else title = `${noun ? noun + ' ' : 'Turned '}${willBeOn ? 'on' : 'off'}`;
    this.showFaceToast(d === 'light' ? (willBeOn ? 'bulb' : 'bulbOff') : domainIcon(d, willBeOn), title, s ? this.store.name(id) : id, d === 'light');
  }
  showFaceToast(ic, title, sub, swing) {
    const t = this.faceToast;
    t.innerHTML = '';
    if (ic) t.append(h('div.ft-icon' + (swing ? '.swing' : ''), { html: icon(ic) }));
    t.append(h('div.ft-title', { text: title }), h('div.ft-sub', { text: sub || '' }));
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(this.ftT); this.ftT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ------------------------------------------------------------------ picker (long-press)
  openPicker() {
    if (this.picker) return;
    const vw = innerWidth, vh = innerHeight;
    const name = h('div.pk-name'), sub = h('div.pk-sub', { text: 'Tap to choose' });
    const track = h('div.pk-track');
    const dots = h('div.pk-dots');
    const trash = h('button.icon-btn.glass', { 'aria-label': 'Remove face', html: icon('trash') });
    const custom = h('button.pill', { html: icon('sliders') + '<span>Customize</span>' });
    const ov = h('div.overlay.picker', {},
      h('div.pk-head', {}, h('div.pk-titles', {}, name, sub),
        h('div.pk-head-btns', {},
          h('button.icon-btn.glass', { 'aria-label': 'Settings', html: icon('gear'), onclick: () => this.openSettings() }),
          h('button.icon-btn.glass', { 'aria-label': 'Close', html: icon('close'), onclick: () => this.closePicker() }))),
      track,
      h('button.pk-arrow.prev', { 'aria-label': 'Previous face', html: icon('back'), onclick: () => this.picker?.step(-1) }),
      h('button.pk-arrow.next', { 'aria-label': 'Next face', html: icon('back'), onclick: () => this.picker?.step(1) }),
      h('div.pk-foot', {}, dots, h('div.pk-actions', {}, trash, custom)));
    document.body.append(ov);
    this.picker = { ov, track, mounts: [], index: 0 };

    const build = (focusId) => {
      this.picker.mounts.forEach((m) => m.destroy());
      this.picker.mounts = [];
      track.innerHTML = ''; dots.innerHTML = '';
      const faces = this.settings.faces;
      faces.forEach((f, i) => {
        const prev = h('div.pk-preview');
        const card = h('div.pk-card', {}, prev);
        const m = mountFace(prev, f, { store: this.store, w: vw, h: vh, use24h: this.settings.general.use24h, preview: true });
        this.picker.mounts.push(m);
        card.addEventListener('click', () => { if (this.picker.index === i) this.chooseFace(f.id, card); else scrollToIndex(i); });
        track.append(card);
        dots.append(h('span'));
      });
      const add = h('div.pk-card.pk-add', {}, h('button.add-btn', { html: icon('plus'), 'aria-label': 'Add face' }), h('div.add-label', { text: 'Add face' }));
      add.addEventListener('click', () => { if (this.picker.index === faces.length) this.openGallery(); else scrollToIndex(faces.length); });
      track.append(add); dots.append(h('span.plus'));
      const idx = Math.max(0, faces.findIndex((f) => f.id === (focusId || this.activeFace()?.id)));
      requestAnimationFrame(() => { scrollToIndex(idx, true); onScroll(); });
    };
    const step = () => { const c = track.children[0], c2 = track.children[1]; return c && c2 ? c2.offsetLeft - c.offsetLeft : 1; };
    const scrollToIndex = (i, instant) => track.scrollTo({ left: i * step(), behavior: instant ? 'auto' : 'smooth' });
    const onScroll = () => {
      const faces = this.settings.faces;
      const i = Math.max(0, Math.min(faces.length, Math.round(track.scrollLeft / step())));
      this.picker.index = i;
      [...track.children].forEach((c, j) => c.classList.toggle('center', j === i));
      [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
      const f = faces[i];
      name.textContent = f ? FACES[f.type]?.name || f.type : 'Add a face';
      sub.textContent = f ? 'Tap to choose' : 'Browse the gallery';
      custom.style.visibility = trash.style.visibility = f ? 'visible' : 'hidden';
      trash.disabled = faces.length <= 1;
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    trash.onclick = () => {
      const f = this.settings.faces[this.picker.index];
      if (!f || this.settings.faces.length <= 1) return;
      const s = this.update((s) => {
        s.faces = s.faces.filter((x) => x.id !== f.id);
        if (s.active === f.id) s.active = s.faces[Math.min(this.picker.index, s.faces.length - 1)].id;
        for (const scr of Object.values(s.screens || {})) if (scr.faceId === f.id) delete scr.faceId;
      });
      this.renderFace();
      build(s.faces[Math.min(this.picker.index, s.faces.length - 1)].id);
    };
    custom.onclick = () => { const f = this.settings.faces[this.picker.index]; if (f) this.openCustomize(f, 'edit'); };
    this.picker.build = build;
    this.picker.step = (d) => scrollToIndex(Math.max(0, Math.min(this.settings.faces.length, this.picker.index + d)));
    this.picker.chooseCenter = () => track.querySelector('.pk-card.center')?.click();
    let wheelT = 0;
    track.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // trackpads scroll sideways natively
      e.preventDefault();
      const now = Date.now(); if (now - wheelT < 320) return; wheelT = now;
      this.picker.step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    build();
    requestAnimationFrame(() => ov.classList.add('open'));
  }
  closePicker() {
    if (!this.picker) return;
    const { ov, mounts } = this.picker;
    this.picker = null;
    ov.classList.remove('open');
    setTimeout(() => { mounts.forEach((m) => m.destroy()); ov.remove(); }, 300);
  }
  chooseFace(id, card) {
    // This screen remembers its own face; it also becomes the default for screens that haven't picked one.
    this.update((s) => { s.active = id; s.screens ||= {}; const sc = s.screens[this.screenId] ||= {}; sc.faceId = id; sc.seen = Date.now(); });
    this.renderFace();
    // Zoom a copy of the chosen card up to full screen, then reveal the live face underneath.
    const r = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.className = 'pk-ghost';
    Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: getComputedStyle(card).borderRadius });
    this.picker.ov.append(ghost);
    this.picker.ov.classList.add('choosing');
    const k = innerWidth / r.width;
    const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight / 2 - (r.top + r.height / 2);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
      ghost.style.borderRadius = '0px';
    }));
    setTimeout(() => this.closePicker(), 400);
  }

  // ------------------------------------------------------------------ customize
  openCustomize(face, mode) {
    const def = FACES[face.type];
    const work = clone(face);
    work.opts = { ...def.defaults, ...(work.opts || {}) };
    const preview = h('div.cz-card');
    let mounted = null;
    const remount = () => {
      mounted?.destroy();
      mounted = mountFace(preview, work, { store: this.store, w: innerWidth, h: innerHeight, use24h: this.settings.general.use24h, preview: true });
    };
    const commit = () => {
      if (mode === 'edit') { this.update((s) => { const i = s.faces.findIndex((f) => f.id === work.id); if (i >= 0) s.faces[i] = clone(work); }); this.renderFace(); }
    };
    const change = (fn) => { fn(); remount(); commit(); };
    const opts = h('div.cz-options');
    for (const o of def.options) {
      const val = work.opts[o.key];
      let ctl;
      if (o.type === 'swatch') ctl = swatches(o.choices, val, (v) => change(() => { work.opts[o.key] = v; }));
      else if (o.type === 'choice') ctl = segmented(o.choices, val, (v) => change(() => { work.opts[o.key] = v; }));
      else ctl = toggle(val, (v) => change(() => { work.opts[o.key] = v; }));
      opts.append(o.type === 'bool' ? row(o.label, ctl) : h('div.cz-section', {}, h('div.cz-label', { text: o.label }), ctl));
    }
    if (TIME_FACES.has(face.type)) {
      const tm = () => (work.time ||= {});
      const sel = (choices, val, on) => { const x = h('select.select'); for (const c of choices) x.append(h('option', { value: c.v, text: c.label })); x.value = val; x.onchange = () => on(x.value); return x; };
      const timeBox = h('div');
      const drawTime = () => {
        const t = work.time || {};
        timeBox.replaceChildren(
          h('div.cz-group', { text: 'Time as text' }),
          row('Show the time', sel(TIME_POS, t.pos || '', (v) => { change(() => { if (v) tm().pos = v; else delete work.time; }); drawTime(); }), 'In a corner, or above or below the dial'),
          ...(t.pos ? [
            row('Font', (() => { const x = sel(FONTS.map((f) => ({ v: f.v, label: f.label })), t.font || 'system', (v) => change(() => { tm().font = v; })); for (const o of x.options) o.style.fontFamily = FONTS.find((f) => f.v === o.value).css; return x; })()),
            h('div.cz-section', {}, h('div.cz-label', { text: 'Size' }), segmented([{ v: 's', label: 'Small' }, { v: 'm', label: 'Medium' }, { v: 'l', label: 'Large' }], t.size || 'm', (v) => change(() => { tm().size = v; }))),
            h('div.cz-section', {}, h('div.cz-label', { text: 'Weight' }), segmented([{ v: 300, label: 'Light' }, { v: 450, label: 'Regular' }, { v: 600, label: 'Semibold' }, { v: 800, label: 'Heavy' }], t.weight || 600, (v) => change(() => { tm().weight = v; }))),
            h('div.cz-section', {}, h('div.cz-label', { text: 'Colour' }), h('div.cs-row', {},
              h('button.cs.cs-match' + (!t.color ? '.sel' : ''), { text: 'Dial', title: 'Match the dial', onclick: () => { change(() => { delete tm().color; }); drawTime(); } }),
              ['#ffffff', '#111111', '#ff9f0a', '#ff453a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#e8d6b5'].map((c) => h('button.cs' + (t.color === c ? '.sel' : ''), { style: { background: c }, 'aria-label': c, onclick: () => { change(() => { tm().color = c; }); drawTime(); } })),
              h('label.cs.cs-custom', { title: 'Any colour' }, h('span', { html: icon('plus') }), (() => { const i = h('input', { type: 'color', value: t.color || '#ffffff' }); i.addEventListener('change', () => { change(() => { tm().color = i.value; }); drawTime(); }); return i; })()))),
            row('Date underneath', toggle(!!t.date, (v) => change(() => { tm().date = v; }))),
            this.settings.general.use24h ? null : row('Show AM/PM', toggle(t.ampm !== false, (v) => change(() => { tm().ampm = v; }))),
          ] : []));
      };
      drawTime();
      opts.append(timeBox);
    }
    opts.append(h('div.cz-group', { text: 'Home Assistant' }));
    const tapGroups = def.needsTap ? TAP_GROUPS.slice(0, 2) : TAP_GROUPS;
    opts.append(row(def.needsTap ? 'Light' : 'Tap the face to', entitySelect(this.store, work.tap, tapGroups, (v) => change(() => { work.tap = v; }), def.needsTap ? 'Choose…' : 'Do nothing'),
      def.needsTap ? 'The bulb glows when it’s on' : 'Toggle a light, switch or scene'));
    opts.append(row('Top-left info', entitySelect(this.store, work.tl, INFO_GROUPS, (v) => change(() => { work.tl = v; }))));
    opts.append(row('Top-right info', entitySelect(this.store, work.tr, INFO_GROUPS, (v) => change(() => { work.tr = v; }))));
    opts.append(row('Bottom-left info', entitySelect(this.store, work.bl, INFO_GROUPS, (v) => change(() => { work.bl = v; }))));
    opts.append(row('Bottom-right info', entitySelect(this.store, work.br, INFO_GROUPS, (v) => change(() => { work.br = v; }))));

    const done = h('button.pill.primary', { text: mode === 'add' ? 'Add' : 'Done' });
    const back = h('button.icon-btn.glass', { 'aria-label': 'Back', html: icon('back') });
    const ov = h('div.overlay.customize', {},
      h('div.cz-head', {}, back, h('div.cz-title', {}, h('div.cz-name', { text: def.name }), h('div.cz-blurb', { text: def.blurb })), done),
      h('div.cz-body', {}, h('div.cz-preview', {}, preview), opts));
    document.body.append(ov);
    remount();
    requestAnimationFrame(() => ov.classList.add('open'));
    const close = () => { ov.classList.remove('open'); setTimeout(() => { mounted?.destroy(); ov.remove(); }, 300); };
    back.onclick = () => { close(); if (mode === 'edit') this.picker?.build(work.id); };
    done.onclick = () => {
      if (mode === 'add') {
        this.update((s) => { s.faces.push(clone(work)); s.active = work.id; s.screens ||= {}; (s.screens[this.screenId] ||= {}).faceId = work.id; });
        this.renderFace();
        this.gallery?.close();
      }
      close();
      this.picker?.build(work.id);
    };
  }

  // ------------------------------------------------------------------ gallery
  openGallery() {
    const mounts = [];
    const body = h('div.gl-body');
    const cats = {};
    for (const type of FACE_ORDER) { const d = FACES[type]; (cats[d.category] ||= []).push(type); }
    for (const [cat, types] of Object.entries(cats)) {
      const grid = h('div.gl-grid');
      for (const type of types) {
        const d = FACES[type];
        const prev = h('div.gl-preview');
        const tile = h('button.gl-tile', {}, prev, h('div.gl-name', { text: d.name }), h('div.gl-blurb', { text: d.blurb }));
        const f = { id: 'g-' + type, type, opts: {}, tap: d.needsTap ? this.store.list(['light'])[0]?.entity_id || null : null };
        mounts.push(mountFace(prev, f, { store: this.store, w: innerWidth, h: innerHeight, use24h: this.settings.general.use24h, preview: true }));
        tile.onclick = () => this.openCustomize({ id: uid(), type, opts: {}, tap: f.tap, tl: null, tr: null }, 'add');
        grid.append(tile);
      }
      body.append(h('div.gl-cat', { text: cat }), grid);
    }
    const ov = h('div.overlay.gallery', {},
      h('div.gl-head', {}, h('div.gl-title', { text: 'Face Gallery' }), h('button.icon-btn.glass', { 'aria-label': 'Close', html: icon('close'), onclick: () => close() })),
      body);
    document.body.append(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    const close = () => { this.gallery = null; ov.classList.remove('open'); setTimeout(() => { mounts.forEach((m) => m.destroy()); ov.remove(); }, 300); };
    this.gallery = { close };
  }

  // ------------------------------------------------------------------ settings
  openSettings(opts = {}) {
    if (typeof opts !== 'object' || !opts) opts = {};
    const sh = sheet({ title: 'Settings', cls: 'settings-sheet' });
    let openTile = null, armedDelete = null, armedT = null;
    let editPage = opts.page || this.currentRoom?.pageId || this.settings.pages[0]?.id;
    const refreshRoom = () => this.roomFor(editPage)?.render();
    const section = (title, ...kids) => h('section.set-sec', {}, h('div.set-title', { text: title }), ...kids);
    const faceLabel = (id) => FACES[(this.settings.faces.find((f) => f.id === id) || this.settings.faces.find((f) => f.id === this.settings.active) || {}).type]?.name || 'Shared';
    const pageLabel = (id) => (!id || id === 'clock' ? 'Clock' : pageOf(this.settings, id)?.name || 'Clock');

    const render = () => {
      const s = this.settings;
      if (!pageOf(s, editPage)) editPage = pageOf(s, String(editPage).split('~')[0]) ? String(editPage).split('~')[0] : s.pages[0]?.id;
      const pg = pageOf(s, editPage);
      const base = String(editPage).split('~')[0], basePg = pageOf(s, base);
      sh.body.innerHTML = '';

      // ---------------- Appearance
      const th = themeById(this.baseThemeId());
      const appearanceSec = section('Appearance',
        ...(() => {
          const lk = s.general.look || {};
          const setLook = (fn) => { this.update((x) => { x.general.look = { ...(x.general.look || {}) }; fn(x.general.look); for (const k of Object.keys(x.general.look)) if (x.general.look[k] == null) delete x.general.look[k]; }); render(); };
          const cur = LOOKS.find((l) => l.id === lk.style) || LOOKS[0];
          const alpha = h('input.range', { type: 'range', min: 10, max: 100, step: 5, value: lk.alpha ?? 100, 'aria-label': 'Tile opacity' });
          const alphaVal = h('span.row-value', { text: lk.alpha == null || lk.alpha >= 100 ? 'Solid' : `${100 - lk.alpha}% see-through` });
          alpha.addEventListener('input', () => { const v = Number(alpha.value); alphaVal.textContent = v >= 100 ? 'Solid' : `${100 - v}% see-through`; applyLook({ ...(this.settings.general.look || {}), alpha: v >= 100 ? null : v }); });
          alpha.addEventListener('change', () => { const v = Number(alpha.value); setLook((L) => { L.alpha = v >= 100 ? null : v; }); });
          return [
            h('div.look-pick', {}, ...LOOKS.map((l) => h('button.look-card' + (l.id === cur.id ? '.sel' : ''), { 'data-look-preview': l.id, onclick: () => setLook((L) => { L.style = l.id === 'apple' ? null : l.id; }) },
              h('div.look-mini', {}, h('i.lm-a'), h('i.lm-b.on'), h('i.lm-c'), h('i.lm-d.on')), h('div.look-name', { text: l.name })))),
            h('div.row-sub.look-sub', { text: cur.sub + '. Your theme below sets the colours.' }),
            row('Tile transparency', h('div.icon-ctl', {}, alpha, alphaVal), 'Let the background show through the tiles'),
            row('Blur behind tiles', segmented([{ v: null, label: 'Auto' }, { v: 0, label: 'None' }, { v: 12, label: 'Light' }, { v: 30, label: 'Strong' }], lk.blur ?? null, (v) => setLook((L) => { L.blur = v; }))),
            row('Corners', segmented([{ v: null, label: 'Auto' }, { v: 6, label: 'Square' }, { v: 18, label: 'Rounded' }, { v: 34, label: 'Round' }], lk.radius ?? null, (v) => setLook((L) => { L.radius = v; }))),
          ];
        })(),
        row('Theme', h('div.icon-ctl', {}, this.themeSwatch(th, { small: true }), h('div.row-value', { text: th.name }),
          h('button.pill.sm.primary', { text: 'Change…', onclick: () => this.openThemePicker(render) })),
        this.screen.theme ? 'Only on this iPad (the other screens use ' + themeById(s.general?.theme || DEFAULT_THEME).name + ')' : 'Used on every screen'),
        row('Night theme on this iPad', (() => {
          const sel = h('select.select');
          sel.append(h('option', { value: '', text: 'None (same day and night)' }));
          for (const g of THEME_GROUPS) { const og = h('optgroup', { label: g }); for (const t of THEMES.filter((x) => x.group === g)) og.append(h('option', { value: t.id, text: t.name })); sel.append(og); }
          sel.value = this.screen.night?.theme || '';
          sel.onchange = () => { this.updateScreen((x) => { if (sel.value) x.night = { mode: 'sun', ...(x.night || {}), theme: sel.value }; else delete x.night; }); this.syncTheme(); render(); };
          return sel;
        })(), 'Switches by itself after dark, e.g. Walnut or Desert Dusk at night'),
        this.screen.night?.theme ? row('Switch', segmented([{ v: 'sun', label: 'At sunset and sunrise' }, { v: 'times', label: 'At set times' }], this.screen.night.mode || 'sun', (v) => { this.updateScreen((x) => { x.night.mode = v; }); this.syncTheme(); render(); })) : null,
        this.screen.night?.theme && this.screen.night.mode === 'times' ? row('Night from', h('div.icon-ctl', {},
          h('input.time-in', { type: 'time', value: this.screen.night.from || '20:00', onchange: (e) => { this.updateScreen((x) => { x.night.from = e.target.value; }); this.syncTheme(); } }),
          h('span', { text: 'to' }),
          h('input.time-in', { type: 'time', value: this.screen.night.to || '07:00', onchange: (e) => { this.updateScreen((x) => { x.night.to = e.target.value; }); this.syncTheme(); } }))) : null,
        row('Weather in the background', toggle(s.general?.fx?.weather !== false, (v) => { this.update((x) => { x.general.fx = { ...(x.general.fx || {}), weather: v }; }); this.rooms.forEach((r) => r.tick()); }), 'Gentle rain, snow, clouds, fog or stars behind the tiles, matching outside'),
        row('Seasonal touches', toggle(s.general?.fx?.season !== false, (v) => { this.update((x) => { x.general.fx = { ...(x.general.fx || {}), season: v }; }); this.rooms.forEach((r) => r.tick()); }), 'Blossoms in spring, falling leaves in autumn, light snow in December and January, when the weather is calm'),
        row('How much', segmented([{ v: 'some', label: 'A little' }, { v: 'more', label: 'More' }], s.general?.fx?.amount || 'some', (v) => { this.update((x) => { x.general.fx = { ...(x.general.fx || {}), amount: v }; }); })),
        row('Page header', h('button.pill.sm.primary', { text: 'Change…', onclick: () => this.headerEditor(render) }), 'Title font and size, and what the line under the title shows: greeting, date, weather, warnings… Tip: hold the title on a page.'));

      // ---------------- Doorbell
      const db = s.doorbell || {};
      const updDb = (fn) => { this.update((x) => { x.doorbell ||= {}; fn(x.doorbell); }); render(); };
      const doorSec = section('Doorbell pop-up',
        row('When this rings', entitySelect(this.store, db.trigger, [['Binary sensors', ['binary_sensor']], ['Events', ['event']], ['Switches and helpers', ['input_boolean', 'switch', 'input_button']], ['Sensors', ['sensor']]], (v) => updDb((x) => { if (v) x.trigger = v; else delete x.trigger; }), 'Off (no pop-up)'),
          'Your doorbell button, event or sensor from Home Assistant. Every iPad shows the camera full screen when it rings.'),
        db.trigger ? row('Camera', entitySelect(this.store, db.camera, [['Cameras', ['camera']]], (v) => updDb((x) => { if (v) x.camera = v; else delete x.camera; }), 'No camera')) : null,
        db.trigger ? row('Door lock', entitySelect(this.store, db.lock, [['Locks', ['lock']]], (v) => updDb((x) => { if (v) x.lock = v; else delete x.lock; }), 'No lock'), 'Adds an Unlock button (tap twice)') : null,
        db.trigger ? row('Close after', segmented([{ v: 30, label: '30 s' }, { v: 60, label: '1 min' }, { v: 120, label: '2 min' }, { v: 300, label: '5 min' }], db.seconds || 60, (v) => updDb((x) => { x.seconds = v; }))) : null,
        db.trigger ? row('Show on this iPad', toggle(!this.screen.noDoorbell, (v) => { this.updateScreen((x) => { if (v) delete x.noDoorbell; else x.noDoorbell = true; }); render(); })) : null,
        row('Try it', h('button.pill.sm', { text: 'Show the pop-up', onclick: () => this.ringDoorbell() })));

      // ---------------- This screen
      const sc = this.screen;
      const startSel = h('select.select');
      for (const c of [{ v: 'clock', label: 'Clock' }, ...s.pages.map((p) => ({ v: p.id, label: p.name }))]) startSel.append(h('option', { value: c.v, text: c.label }));
      startSel.value = sc.startPage && (sc.startPage === 'clock' || pageOf(s, sc.startPage)) ? sc.startPage : 'clock';
      startSel.onchange = () => { this.updateScreen((x) => { x.startPage = startSel.value; }); };
      const link = location.origin + location.pathname + '?screen=' + encodeURIComponent(this.screenId);
      const others = Object.entries(s.screens || {}).filter(([id]) => id !== this.screenId);
      const screenSec = section('This screen',
        row('Name', h('input.text-in.wide-in', { value: sc.name || '', placeholder: 'e.g. Kitchen iPad', onchange: (e) => { this.renameScreen(e.target.value); render(); } }), 'Each iPad keeps its own start page and clock face'),
        row('Opens on', startSel, 'Where it starts, and after a restart'),
        row('Clock face', h('div.row-value', { text: faceLabel(sc.faceId) }), 'Hold the clock on this screen to change it'),
        row('Tap the clock to', (() => {
          const sel = h('select.select');
          for (const p of s.pages) sel.append(h('option', { value: p.id, text: `Open ${p.name}` }));
          sel.append(h('option', { value: 'face', text: 'Use the face’s tap action' }));
          sel.value = this.clockTapTarget();
          sel.onchange = () => this.updateScreen((x) => { x.clockTap = sel.value; });
          return sel;
        })(), 'A quick way to this iPad’s room without swiping'),
        row('Screen off after', segmented([{ v: 0, label: 'Never' }, { v: 5, label: '5 min' }, { v: 15, label: '15 min' }, { v: 30, label: '30 min' }, { v: 60, label: '1 hour' }], sc.sleepMin || 0, (v) => { this.updateScreen((x) => { if (v) x.sleepMin = v; else delete x.sleepMin; }); render(); }),
          'The screen goes black when nobody touches it or moves in the room. Tap it to wake it.'),
        row('Wake on motion', entitySelect(this.store, sc.motion, [['Motion and presence', ['binary_sensor']]], (v) => { this.updateScreen((x) => { if (v) x.motion = v; else delete x.motion; }); render(); }, 'No sensor'),
          'A motion or presence sensor in this room wakes the screen and keeps it on while someone is there'),
        sc.sleepMin || sc.motion ? row('When it wakes', segmented([{ v: 'clock', label: 'Clock' }, { v: 'page', label: 'This iPad’s page' }, { v: 'stay', label: 'Where it was' }], sc.wakeTo || 'clock', (v) => this.updateScreen((x) => { x.wakeTo = v; }))) : null,
        row('Hide Home Assistant’s sidebar and top bar', toggle(!!sc.hideHa, (v) => { this.updateScreen((x) => { if (v) x.hideHa = true; else delete x.hideHa; }); render(); }),
          inHaPanel ? 'Full screen inside Home Assistant on this iPad' : 'For when Facewall is opened inside Home Assistant (its sidebar or the app)'),
        inHaPanel ? row('Edge to edge', toggle(sc.edge !== false, (v) => { this.updateScreen((x) => { if (v) delete x.edge; else x.edge = false; }); render(); }),
          'Colours the Home Assistant app’s own strips (behind the status bar and around the page) to match the screen, and covers them when the sidebar is hidden. In the app’s Kiosk mode, also turn on “Hide status bar”.') : null,
        inHaPanel && sc.hideHa ? row('Home Assistant menu', h('button.pill.sm', { text: 'Open', onclick: () => { openHaMenu(); } }), 'Opens Home Assistant’s sidebar over Facewall') : null,
        h('div.about.small', { text: 'To keep these even if Safari’s data is cleared, add this address to the iPad’s Home Screen:' }),
        h('div.copy-row', {}, h('code.addr', { text: link }), h('button.pill.sm', { text: 'Copy', onclick: async () => {
          try { await navigator.clipboard.writeText(link); toast('Address copied'); } catch { toast('Couldn’t copy. Select the address instead.'); }
        } })),
        others.length ? h('div.set-sub', { text: 'Other screens' }) : null,
        ...others.map(([id, o]) => h('div.ent-row', {},
          h('span.ent-ic', { html: icon('grid') }),
          h('div.ent-text', {}, h('div.ent-name', { text: o.name || id }), h('div.ent-sub', { text: `Opens on ${pageLabel(o.startPage)}  ·  ${faceLabel(o.faceId)} face` })),
          h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Forget this screen', onclick: () => { this.update((x) => { delete x.screens[id]; }); render(); } }))));

      // ---------------- Pages
      const pagesList = h('div.ent-list');
      s.pages.forEach((p, i) => {
        const mv = (dir) => { this.update((x) => { x.pages.splice(i + dir, 0, x.pages.splice(i, 1)[0]); }); this.renderRooms(); render(); };
        const del = () => {
          if (armedDelete !== p.id) { armedDelete = p.id; clearTimeout(armedT); armedT = setTimeout(() => { armedDelete = null; render(); }, 3000); render(); return; }
          armedDelete = null;
          this.update((x) => {
            x.pages = x.pages.filter((q) => q.id !== p.id);
            for (const scr of Object.values(x.screens || {})) if (scr.startPage === p.id) scr.startPage = 'clock';
          });
          this.renderRooms(); render();
        };
        pagesList.append(h('div.ent-row' + (p.id === base ? '.sel' : ''), {},
          h('span.ent-ic', { html: icon(i === 0 ? 'home' : 'grid') }),
          h('input.text-in.name-in', { value: p.name, 'aria-label': 'Page name', onchange: (e) => {
            const v = e.target.value.trim(); if (!v) return;
            this.update((x) => { pageOf(x, p.id).name = v; }); this.renderRooms(); render();
          } }),
          h('span.ent-sub.count', { text: `${p.entities.length} tile${p.entities.length === 1 ? '' : 's'}${p.sections?.length ? ` · ${p.sections.length + 1} sections` : ''}` }),
          h('button.pill.sm' + (p.id === base ? '.primary' : ''), { text: p.id === base ? 'Editing' : 'Edit', onclick: () => { editPage = p.id; openTile = null; render(); } }),
          h('button.icon-btn.sm', { html: icon('copy'), 'aria-label': 'Copy this page', onclick: () => {
            const id = 'p-' + uid();
            this.update((x) => { const src = pageOf(x, p.id); x.pages.splice(i + 1, 0, { ...structuredClone(src), id, name: `${src.name} copy` }); });
            editPage = id; this.renderRooms(); render(); toast(`Copied “${p.name}”. Rename it and change its tiles.`);
          } }),
          h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Move page up', disabled: i === 0, onclick: () => mv(-1) }),
          h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Move page down', disabled: i === s.pages.length - 1, onclick: () => mv(1) }),
          armedDelete === p.id
            ? h('button.pill.sm.danger-pill', { text: 'Delete?', onclick: del })
            : h('button.icon-btn.sm.danger', { html: icon('trash'), 'aria-label': 'Delete page', disabled: s.pages.length <= 1, onclick: del })));
      });
      const areaCounts = {};
      for (const [eid, area] of Object.entries(this.store.areas || {})) if (this.store.get(eid) && AREA_ORDER.includes(domainOf(eid))) areaCounts[area] = (areaCounts[area] || 0) + 1;
      const areas = Object.keys(areaCounts).sort();
      const areaSel = h('select.select');
      areaSel.append(h('option', { value: '', text: areas.length ? 'Add a room from an area…' : 'No areas in Home Assistant yet' }));
      for (const a of areas) areaSel.append(h('option', { value: a, text: `${a}  (${areaCounts[a]} device${areaCounts[a] === 1 ? '' : 's'})` }));
      areaSel.disabled = !areas.length;
      areaSel.onchange = () => {
        const area = areaSel.value; if (!area) return;
        const id = 'p-' + uid();
        const ents = areaEntities(this.store, area);
        this.update((x) => { x.pages.push({ id, name: area, entities: ents, layout: { cols: null, rows: null } }); });
        editPage = id; this.renderRooms(); render();
        toast(`Added ${area} with ${ents.length} tile${ents.length === 1 ? '' : 's'}`);
      };
      const pagesSec = section('Pages',
        h('div.about.small', { text: 'Swipe left from the clock to move through your pages.' }),
        pagesList,
        h('div.add-page-row', {},
          h('button.pill', { html: icon('plus') + '<span>Blank page</span>', onclick: () => {
            const id = 'p-' + uid();
            this.update((x) => { x.pages.push({ id, name: `Page ${x.pages.length + 1}`, entities: [], layout: { cols: null, rows: null } }); });
            editPage = id; this.renderRooms(); render();
          } }),
          areaSel));

      // ---------------- Tiles on the page being edited
      const list = h('div.ent-list');
      const L = basePg.layout || {};
      const cols = this.roomFor(editPage)?.cols || 5;
      const ents = pg.entities;
      const upd = (fn) => { this.update((x) => fn(pageOf(x, editPage).entities)); render(); refreshRoom(); };
      ents.forEach((item, i) => {
        const id = item.id;
        const area = id === ALL_OFF ? '' : this.store.area(id);
        const [w, hh] = sizeOf(item);
        const isOpen = openTile === i;
        const style = stylesFor(id).find((x) => x.v === styleOf(item));
        const sub = id === ALL_OFF ? 'Turns off every light on this page' : [style && style !== stylesFor(id)[0] ? style.label : null, area, id].filter(Boolean).join('  ·  ');
        list.append(h('div.ent-row', {},
          h('span.ent-ic', { html: iconHtml(this.store, item, tileIcon(id)) }),
          h('div.ent-text', {}, h('div.ent-name', { text: tileName(this.store, item) }), h('div.ent-sub', { text: sub })),
          h('button.size-badge' + (isOpen ? '.on' : ''), { text: `${fmtSize(Math.min(w, cols))} × ${fmtSize(hh)}`, 'aria-label': 'Tile options', onclick: () => { openTile = isOpen ? null : i; render(); } }),
          h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Move up', disabled: i === 0, onclick: () => { openTile = null; upd((a) => a.splice(i - 1, 0, a.splice(i, 1)[0])); } }),
          h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Move down', disabled: i === ents.length - 1, onclick: () => { openTile = null; upd((a) => a.splice(i + 1, 0, a.splice(i, 1)[0])); } }),
          h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => { openTile = null; upd((a) => a.splice(i, 1)); } })));
        if (isOpen) list.append(h('div.ent-edit', {}, ...this.tileOptionRows(editPage, i, render), this.tileCopyRow(editPage, i, () => { this.renderRooms(); render(); })));
      });
      if (!ents.length) list.append(h('div.ent-empty', { text: 'No tiles on this page yet.' }));
      const hasAllOff = ents.some((e) => e.id === ALL_OFF);
      const secs = basePg.sections || [];
      const tilesSec = section(`Tiles on “${basePg.name}${base !== editPage ? ' › ' + pg.name : ''}”`,
        secs.length ? row('Section', segmented([{ v: base, label: basePg.mainName || 'All' }, ...secs.map((x) => ({ v: `${base}~${x.id}`, label: x.name }))], editPage, (v) => { editPage = v; openTile = null; render(); })) : null,
        row('Sections', h('button.pill.sm', { html: icon('sliders') + '<span>' + (secs.length ? 'Edit sections' : 'Add sections') + '</span>', onclick: () => this.sectionsEditor(base, () => render()) }), 'A menu down the left of the page, e.g. Lights, Climate and Media, each with its own tiles'),
        h('button.pill.wide.primary', { html: icon('grid') + '<span>Edit layout on screen</span>', onclick: () => { sh.close(); this.goToRoom(editPage); this.roomFor(editPage)?.setEditing(true); } }),
        list,
        h('button.pill.wide', { html: icon('plus') + '<span>Add tiles</span>', onclick: () => this.entityBrowser(editPage, () => { render(); refreshRoom(); }) }),
        row('Scenes row', h('button.pill.sm', { html: icon('plus') + '<span>Add</span>', onclick: () => {
          const pick = this.store.list(['scene']).map((x) => x.entity_id);
          upd((a) => a.push({ id: SCENES, scenes: pick.slice(0, 4) }));
          toast('Added a scenes row. Choose its buttons in the tile’s Options.');
        } }), 'One tile with a row of one-tap scene and script buttons'),
        row('“All lights off” tile', toggle(hasAllOff, (v) => upd((a) => { const k = a.findIndex((e) => e.id === ALL_OFF); if (v && k < 0) a.push({ id: ALL_OFF }); if (!v && k >= 0) a.splice(k, 1); })), 'Turns off every light on this page'));
      const setL = (k, v) => { this.update((x) => { const p2 = pageOf(x, base); p2.layout = { ...(p2.layout || {}), [k]: v }; }); refreshRoom(); render(); };
      const layoutSec = section(`Grid on “${basePg.name}”`,
        row('Columns across', segmented([{ v: null, label: 'Auto' }, ...[3, 4, 5, 6, 7, 8].map((v) => ({ v, label: String(v) }))], L.cols ?? null, (v) => setL('cols', v)), 'More columns = smaller tiles'),
        row('Fit to screen', toggle(L.fit !== false, (v) => setL('fit', v ? null : false)), 'Stretch or shrink the rows so your tiles exactly fill the screen, upright or sideways'),
        L.fit === false ? row('Rows per screen', segmented([{ v: null, label: 'Auto' }, ...[2, 3, 4, 5, 6].map((v) => ({ v, label: String(v) }))], L.rows ?? null, (v) => setL('rows', v)), 'Taller tiles can span several rows') : null);

      // ---------------- Everywhere
      const g = s.general;
      const clockSec = section('Clock (all screens)',
        row('Burn-in protection', toggle(g.shift !== false, (v) => { this.update((x) => { x.general.shift = v; }); this.shiftPixels(true); }), 'Moves everything by a few pixels every few minutes, so nothing stays in one spot'),
        row('24-hour time', toggle(g.use24h, (v) => { this.update((x) => { x.general.use24h = v; }); this.renderFace(); this.rooms.forEach((r) => r.tick()); })),
        row('Go back to the clock after', segmented([{ v: 0, label: 'Never' }, { v: 30, label: '30s' }, { v: 60, label: '1m' }, { v: 120, label: '2m' }, { v: 300, label: '5m' }], g.idleSec, (v) => this.update((x) => { x.general.idleSec = v; })), 'when nobody touches the screen'),
        row('Timer buttons (minutes)', h('input.text-in', { value: (s.dashboard?.timerMinutes || []).join(', '), inputmode: 'numeric', onchange: (e) => {
          const mins = e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0 && n <= 1440).slice(0, 5);
          if (mins.length) { this.update((x) => { x.dashboard = { ...(x.dashboard || {}), timerMinutes: mins }; }); this.rooms.forEach((r) => r.render()); }
        } })));
      const dim = g.dim || {};
      const dimSec = section('Night dimming (all screens)',
        row('Dim the screen at night', toggle(dim.on, (v) => { this.update((x) => { x.general.dim = { ...dim, on: v }; }); this.applyDim(); render(); })),
        dim.on ? row('From', h('input.time-in', { type: 'time', value: dim.from || '23:00', onchange: (e) => { this.update((x) => { x.general.dim.from = e.target.value; }); this.applyDim(); } })) : null,
        dim.on ? row('Until', h('input.time-in', { type: 'time', value: dim.to || '06:30', onchange: (e) => { this.update((x) => { x.general.dim.to = e.target.value; }); this.applyDim(); } })) : null,
        dim.on ? row('How dark', segmented([{ v: 0.35, label: 'A little' }, { v: 0.55, label: 'Medium' }, { v: 0.75, label: 'Very' }], dim.level ?? 0.55, (v) => { this.update((x) => { x.general.dim.level = v; }); this.applyDim(); })) : null);
      const st = this.store.status;
      const conn = this.store.mode === 'demo' ? 'Demo mode — not connected to Home Assistant'
        : st.connected ? `Connected to Home Assistant${st.haVersion ? ' ' + st.haVersion : ''}` : `Not connected${st.error ? ': ' + st.error : ''}`;
      const aboutSec = section('Connection', h('div.about', { text: conn }),
        h('div.about.small', { text: 'Tip: hold the clock to change faces and swipe for your pages. With a mouse: right-click the clock, use the ‹ › arrows or ← → keys, and Esc to close panels.' }));
      // ---------------- Backup
      const restoreIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
      restoreIn.addEventListener('change', async () => { const f = restoreIn.files[0]; restoreIn.value = ''; if (f) await this.restoreBackup(f); render(); });
      const backupSec = section('Backup',
        row('Save a backup', h('button.pill.sm', { html: icon('download') + '<span>Download</span>', onclick: () => this.downloadBackup() }), 'Every page, tile, theme, header, screen and doorbell setting, plus your uploaded icons, in one file'),
        row('Restore a backup', h('button.pill.sm', { html: icon('upload') + '<span>Choose file…</span>', onclick: () => restoreIn.click() }), 'Replaces the current setup on every screen'),
        restoreIn);
      // ---------------- Photo frame (this iPad)
      const pf = sc.photos || {};
      const updPf = (fn, re = true) => { this.updateScreen((x) => { x.photos ||= {}; fn(x.photos); }); if (re) render(); };
      const pfStatus = h('div.row-sub', { text: 'Looking…' });
      const folderIn = h('input.text-in.wide-in', { value: pf.folder || '', placeholder: 'media/photos', onchange: (e) => { updPf((p) => { p.folder = e.target.value.trim().replace(/^\/+|\/+$/g, ''); }); } });
      const photoSec = section('Photo frame (this iPad)',
        row('Show photos', toggle(!!pf.on, (v) => updPf((p) => { p.on = v; if (v && !p.folder) p.folder = 'media'; })), 'After a while on the clock, show a slideshow of your photos with the time in the corner. Tap to go back.'),
        pf.on ? row('Folder', folderIn, pfStatus) : null,
        pf.on ? row('Start after', segmented([{ v: 0.5, label: '30s' }, { v: 2, label: '2 min' }, { v: 5, label: '5 min' }, { v: 15, label: '15 min' }, { v: 30, label: '30 min' }], pf.after ?? 5, (v) => updPf((p) => { p.after = v; })), 'on the clock, with nobody touching the screen') : null,
        pf.on ? row('Each photo for', segmented([{ v: 10, label: '10s' }, { v: 20, label: '20s' }, { v: 30, label: '30s' }, { v: 60, label: '1m' }, { v: 300, label: '5m' }], pf.every || 20, (v) => updPf((p) => { p.every = v; }))) : null,
        pf.on ? row('Order', segmented([{ v: 'shuffle', label: 'Shuffle' }, { v: 'name', label: 'By name' }], pf.order || 'shuffle', (v) => updPf((p) => { p.order = v; }))) : null,
        pf.on ? row('Photos', segmented([{ v: 'fill', label: 'Fill the screen' }, { v: 'fit', label: 'Show whole photo' }], pf.fit || 'fill', (v) => updPf((p) => { p.fit = v; }))) : null,
        pf.on ? row('Slow zoom', toggle(pf.zoom !== false, (v) => updPf((p) => { p.zoom = v; })), 'A gentle pan and zoom, like a documentary') : null,
        pf.on ? row('Time in the corner', segmented([{ v: 'time', label: 'Time' }, { v: 'full', label: 'Time, date and weather' }, { v: 'none', label: 'Nothing' }], pf.clock || 'full', (v) => updPf((p) => { p.clock = v; }))) : null,
        pf.on ? row('Try it', h('button.pill.sm.primary', { text: 'Start now', onclick: () => { sh.close(); this.goTo(0, true); this.startFrame(); } })) : null);
      if (pf.on) this.store.photos(pf.folder || 'media').then((r) => {
        const roots = (r.roots || []).map((x) => x + '/').join(', ');
        pfStatus.textContent = r.files?.length ? `${r.files.length} photo${r.files.length === 1 ? '' : 's'} found (sub-folders too).` : `No photos found there. ${roots ? 'Start with ' + roots + ' e.g. media/photos. In Home Assistant, upload to Media → My media.' : 'Facewall can’t see any photo folders.'}`;
      });

      sh.body.append(appearanceSec, screenSec, photoSec, doorSec, pagesSec, tilesSec, layoutSec, clockSec, dimSec, backupSec, aboutSec);
    };
    render();
  }

  /** Rows for a tile's options (name, style, icon, size). Used inline in Settings and in the tile Options panel. */
  /** A background choice: the default, a solid colour, or a gradient (ready-made or two colours of your own). */
  colorCtl(value, value2, defLabel, onPick) {
    const SOLID = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ffffff', '#8e8e93', '#1c1c1e'];
    const GRADIENTS = [
      ['Sunset', '#ff7e5f', '#feb47b'], ['Fire', '#f12711', '#f5af19'], ['Peach', '#ffd3a5', '#fd6585'], ['Berry', '#c33764', '#1d2671'],
      ['Grape', '#8e2de2', '#4a00e0'], ['Ocean', '#2193b0', '#6dd5ed'], ['Aurora', '#00c9a7', '#845ec2'], ['Forest', '#134e5e', '#71b280'],
      ['Mint', '#d4fc79', '#96e6a1'], ['Night', '#141e30', '#243b55'], ['Steel', '#485563', '#29323c'], ['Cloud', '#f5f7fa', '#c3cfe2'],
    ];
    const v = value?.toLowerCase(), v2 = value2?.toLowerCase();
    let mode = !v ? 'default' : v2 ? 'gradient' : 'solid';
    const wrap = h('div.color-ctl');
    const picker = (val, onChange, label) => {
      const inp = h('input', { type: 'color', value: val, 'aria-label': label });
      inp.addEventListener('change', () => onChange(inp.value.toLowerCase()));
      return inp;
    };
    const draw = () => {
      wrap.innerHTML = '';
      wrap.append(segmented([{ v: 'default', label: defLabel }, { v: 'solid', label: 'Solid' }, { v: 'gradient', label: 'Gradient' }], mode, (m) => {
        if (m === 'default') { if (v) onPick(null, null); else { mode = m; draw(); } return; }
        mode = m; draw();
      }));
      if (mode === 'solid') {
        const isCustom = !!v && !v2 && !SOLID.includes(v);
        wrap.append(h('div.cs-row', {},
          SOLID.map((c) => h('button.cs' + (v === c && !v2 ? '.sel' : ''), { style: { background: c }, 'aria-label': c, onclick: () => onPick(c, null) })),
          h('label.cs.cs-custom' + (isCustom ? '.sel' : ''), { style: isCustom ? { background: v } : {}, title: 'Any colour' },
            h('span', { html: icon('plus') }), picker(v || '#0a84ff', (c) => onPick(c, null), 'Pick any colour'))));
      } else if (mode === 'gradient') {
        const preset = GRADIENTS.find(([, a, b]) => a === v && b === v2);
        const from = v2 ? v : GRADIENTS[0][1], to = v2 || GRADIENTS[0][2];
        let fromVal = from, toVal = to;
        wrap.append(
          h('div.cs-row', {}, GRADIENTS.map(([name, a, b]) => h('button.cs.cs-grad' + (preset && preset[0] === name ? '.sel' : ''), { style: { background: tileBackground(a, b) }, 'aria-label': name, title: name, onclick: () => onPick(a, b) }))),
          h('div.cs-row.cs-own', {},
            h('span.cs-own-label', { text: 'Your own:' }),
            h('label.cs.cs-end', { style: { background: from }, title: 'From' }, picker(from, (c) => { fromVal = c; onPick(fromVal, toVal); }, 'Gradient start colour')),
            h('span.cs-arrow', { html: icon('back') }),
            h('label.cs.cs-end', { style: { background: to }, title: 'To' }, picker(to, (c) => { toVal = c; onPick(fromVal, toVal); }, 'Gradient end colour')),
            h('span.cs-sample', { style: { background: tileBackground(from, to) } })));
      }
    };
    draw();
    return wrap;
  }

  tileOptionRows(pageId, i, after) {
    const item = pageOf(this.settings, pageId)?.entities?.[i];
    if (!item) return [];
    const set = (fn) => { this.update((x) => { const it = pageOf(x, pageId)?.entities?.[i]; if (it) fn(it); }); this.roomFor(pageId)?.render(); after?.(); };
    const rows = [];
    rows.push(row('Name', h('input.text-in.wide-in', { value: item.name || '', placeholder: tileName(this.store, { id: item.id }), onchange: (e) => set((it) => { const v = e.target.value.trim(); if (v) it.name = v; else delete it.name; }) }), 'Leave empty to use the name from Home Assistant'));
    if (!item.id.startsWith('_')) {
      // Swap what the tile shows/controls, keeping its size, style, icon, colours and name.
      const dom = item.id.split('.')[0];
      const NAMES = { light: 'Lights', switch: 'Switches', input_boolean: 'Toggles', fan: 'Fans', cover: 'Blinds, doors & covers', lock: 'Locks', climate: 'Climate', media_player: 'Media players', sensor: 'Sensors', binary_sensor: 'Binary sensors', camera: 'Cameras', scene: 'Scenes', script: 'Scripts', weather: 'Weather', calendar: 'Calendars', vacuum: 'Vacuums', alarm_control_panel: 'Alarms', person: 'People', device_tracker: 'Trackers', timer: 'Timers', button: 'Buttons', input_button: 'Buttons', input_number: 'Numbers', input_select: 'Choices', select: 'Choices', number: 'Numbers', remote: 'Remotes', humidifier: 'Humidifiers', water_heater: 'Water heaters', valve: 'Valves', lawn_mower: 'Mowers' };
      const domains = [...new Set(this.store.list().map((x) => x.entity_id.split('.')[0]))].filter((d) => d !== dom).sort((a, b) => (NAMES[a] || a).localeCompare(NAMES[b] || b));
      const groups = [[`Same kind: ${NAMES[dom] || dom}`, [dom]], ...domains.map((d) => [NAMES[d] || d.replace(/_/g, ' '), [d]])];
      const pick = entitySelect(this.store, item.id, groups, (v) => {
        if (!v || v === item.id) return;
        set((it) => {
          it.id = v;
          if (it.style && !stylesFor(v).some((x) => x.v === it.style)) delete it.style;
          delete it.timer;
        });
        toast(`Now showing ${this.store.name(v)}`);
      }, 'Choose…');
      if (!this.store.get(item.id)) pick.prepend(h('option', { value: item.id, text: `${item.id} (missing)` }));
      pick.value = item.id;
      rows.push(row('Entity', pick, item.id));
    }
    const styles = stylesFor(item.id);
    if (styles.length) {
      const cur = styleOf(item);
      rows.push(row('Style', segmented(styles.map((x) => ({ v: x.v, label: x.label })), cur, (v) => set((it) => { it.style = v; delete it.timer; })), styles.find((x) => x.v === cur)?.sub));
    }
    if (item.id === SCENES) {
      const list = item.scenes || [];
      rows.push(...list.map((sid, j) => row(this.store.name(sid) || sid, h('div.icon-ctl', {},
        h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Earlier', disabled: j === 0, onclick: () => set((it) => { it.scenes.splice(j - 1, 0, it.scenes.splice(j, 1)[0]); }) }),
        h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Later', disabled: j === list.length - 1, onclick: () => set((it) => { it.scenes.splice(j + 1, 0, it.scenes.splice(j, 1)[0]); }) }),
        h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => set((it) => { it.scenes.splice(j, 1); }) })), j === 0 ? 'Buttons, in order' : null)));
      rows.push(row('Add a button', entitySelect(this.store, null, [['Scenes', ['scene']], ['Scripts', ['script']], ['Buttons', ['button', 'input_button']]], (v) => { if (v) set((it) => { (it.scenes ||= []).push(v); }); }, 'Choose…')));
      rows.push(row('Button colours', segmented([{ v: false, label: 'Colourful' }, { v: true, label: 'Theme' }], !!item.plain, (v) => set((it) => { if (v) it.plain = true; else delete it.plain; }))));
    }
    const haIcon = item.id !== ALL_OFF && item.id !== SCENES && this.store.get(item.id)?.attributes?.icon;
    if (item.id !== SCENES) rows.push(row('Icon', h('div.icon-ctl', {},
      h('span.icon-prev', { html: iconHtml(this.store, item, tileIcon(item.id)) }),
      h('button.pill.sm', { text: 'Choose…', onclick: () => this.iconPicker(item.icon || haIcon, (name) => set((it) => { if (name) it.icon = name; else delete it.icon; })) }),
      item.icon ? h('button.pill.sm', { text: 'Reset', onclick: () => set((it) => { delete it.icon; }) }) : null),
    item.icon || (haIcon ? `${haIcon} (from Home Assistant)` : 'Built-in icon')));
    if (ICON_MOVABLE.includes(kindFor(item))) {
      rows.push(row('Icon position', segmented(ICON_POSITIONS, item.iconPos || 'tl', (v) => set((it) => { if (v === 'tl') delete it.iconPos; else it.iconPos = v; }))));
      rows.push(row('Name position', segmented(NAME_POSITIONS, item.namePos || 'bottom', (v) => set((it) => { if (v === 'bottom') delete it.namePos; else it.namePos = v; })), 'Under or above the icon follows the icon’s position'));
    }
    // Icon size: 50%–300% of normal. The label follows the slider; the tile updates when you let go.
    const scale = item.iconScale || 1;
    const sizeLabel = h('span.range-val', { text: `${Math.round(scale * 100)}%` });
    const slider = h('input.range', { type: 'range', min: 50, max: 300, step: 10, value: Math.round(scale * 100), 'aria-label': 'Icon size' });
    slider.addEventListener('input', () => { sizeLabel.textContent = `${slider.value}%`; });
    slider.addEventListener('change', () => set((it) => { const v = Number(slider.value) / 100; if (v === 1) delete it.iconScale; else it.iconScale = v; }));
    if (item.id !== SCENES) rows.push(row('Icon size', h('div.range-ctl', {}, slider, sizeLabel,
      scale !== 1 ? h('button.pill.sm', { text: 'Reset', onclick: () => set((it) => { delete it.iconScale; }) }) : null)));
    // Tile colours: one for when it's on (or unlocked, running…) and one for when it's off.
    const slots = colorSlots(item);
    for (const sl of slots) {
      rows.push(row(sl.label, this.colorCtl(item[sl.key], item[sl.key + '2'], sl.def, (c, c2) => set((it) => {
        if (c) it[sl.key] = c; else delete it[sl.key];
        if (c && c2) it[sl.key + '2'] = c2; else delete it[sl.key + '2'];
      }))));
    }
    if (kindFor(item) === 'calendar') {
      rows.push(row('Show', segmented([{ v: 1, label: 'Today' }, { v: 3, label: '3 days' }, { v: 7, label: '7 days' }], item.days || 3, (v) => set((it) => { if (v === 3) delete it.days; else it.days = v; }))));
      (item.calendars || []).forEach((c, j) => rows.push(row(this.store.name(c) || c, h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => set((it) => { it.calendars.splice(j, 1); }) }), j === 0 ? 'Also shown here' : null)));
      rows.push(row('Add another calendar', entitySelect(this.store, null, [['Calendars', ['calendar']]], (v) => { if (v && v !== item.id) set((it) => { (it.calendars ||= []).includes(v) || it.calendars.push(v); }); }, 'Choose…'), 'Each calendar gets its own colour'));
    }
    if (kindFor(item) === 'remote') rows.push(row('Remote', entitySelect(this.store, item.remote, [['Remotes', ['remote']]], (v) => set((it) => { if (v) it.remote = v; else delete it.remote; }), 'Find it for me'), 'Usually found on its own (same device). Pick one if the arrows don’t work.'));
    if (kindFor(item) === 'graph') rows.push(row('Time span', segmented([{ v: 6, label: '6 h' }, { v: 24, label: '24 h' }, { v: 48, label: '2 days' }, { v: 168, label: '7 days' }], item.hours || 24, (v) => set((it) => { if (v === 24) delete it.hours; else it.hours = v; }))));
    // Show the tile only when something is true, and a badge in its corner.
    const DEP_GROUPS = [['Binary sensors', ['binary_sensor']], ['Sensors', ['sensor']], ['Covers and doors', ['cover', 'lock']], ['Lights and switches', ['light', 'switch', 'input_boolean', 'fan']], ['Media', ['media_player']], ['People', ['person', 'device_tracker']], ['Other', ['vacuum', 'climate', 'alarm_control_panel', 'input_select', 'water_heater']]];
    const special = item.id === ALL_OFF || item.id === SCENES;
    const sw = item.showWhen;
    const swMode = !sw ? 'always' : !special && sw.id === item.id && sw.op === 'active' ? 'active' : 'other';
    rows.push(row('Show the tile', segmented([{ v: 'always', label: 'Always' }, ...(special ? [] : [{ v: 'active', label: 'Only when on / open' }]), { v: 'other', label: 'Depends on…' }], swMode, (v) => set((it) => {
      if (v === 'always') delete it.showWhen;
      else if (v === 'active') it.showWhen = { id: it.id, op: 'active' };
      else it.showWhen = { id: sw?.id && sw.id !== it.id ? sw.id : '', op: 'active' };
    })), swMode === 'always' ? 'Hidden tiles stay visible (faded) while you edit the layout' : swMode === 'active' ? 'e.g. the garage appears only while it’s open' : null));
    if (swMode === 'other') {
      rows.push(row('When', entitySelect(this.store, sw.id || null, DEP_GROUPS, (v) => set((it) => { it.showWhen.id = v || ''; }), 'Choose…')));
      const ops = [{ v: 'active', label: 'is on / open' }, { v: 'inactive', label: 'is off / closed' }, { v: 'is', label: 'is…' }, { v: 'above', label: 'above' }, { v: 'below', label: 'below' }];
      rows.push(row('Is', h('div.icon-ctl', {}, segmented(ops, sw.op || 'active', (v) => set((it) => { it.showWhen.op = v; })),
        ['is', 'above', 'below'].includes(sw.op) ? h('input.text-in', { value: sw.value ?? '', placeholder: sw.op === 'is' ? 'e.g. home' : 'e.g. 25', style: { width: '110px' }, onchange: (e) => set((it) => { it.showWhen.value = e.target.value.trim(); }) }) : null)));
    }
    const bd = item.badge || {};
    const badgeKinds = [{ v: '', label: 'None' }, ...(special ? [] : [{ v: 'since', label: 'Time on / open' }]), ...(item.id === SCENES ? [] : [{ v: 'lights', label: 'Lights on' }]), { v: 'entity', label: 'A sensor' }];
    rows.push(row('Badge', segmented(badgeKinds, bd.k || '', (v) => set((it) => { if (v) it.badge = { k: v }; else delete it.badge; })),
      bd.k === 'since' ? 'How long it’s been on or open' : bd.k === 'lights' ? 'Lights on in this group or room' : bd.k === 'entity' ? 'e.g. a battery or temperature' : 'A small label in the tile’s corner'));
    if (bd.k === 'since') rows.push(row('Turn orange after', segmented([{ v: 0, label: 'Never' }, { v: 5, label: '5 min' }, { v: 10, label: '10 min' }, { v: 30, label: '30 min' }, { v: 60, label: '1 hour' }], bd.alertMin || 0, (v) => set((it) => { if (v) it.badge.alertMin = v; else delete it.badge.alertMin; })), 'e.g. a door left open'));
    if (bd.k === 'entity') rows.push(row('Sensor', entitySelect(this.store, bd.id || null, [['Sensors', ['sensor']], ['Binary sensors', ['binary_sensor']]], (v) => set((it) => { if (v) it.badge.id = v; else delete it.badge.id; }), 'Choose…')));
    const kind = kindFor(item);
    const alike = pageOf(this.settings, pageId).entities.filter((e, j) => j !== i && e?.id && kindFor(e) === kind);
    if (alike.length && slots.some((sl) => item[sl.key])) {
      const noun = { light: 'light', toggle: 'switch', cover: 'cover', lock: 'lock', climate: 'climate', timer: 'timer', action: 'scene/button', sensor: 'sensor', weather: 'weather' }[kind] || 'tile';
      rows.push(row('Same colours elsewhere', h('button.pill.sm', { text: alike.length === 1 ? `Use on the other ${noun} tile` : `Use on all ${alike.length + 1} ${noun} tiles`, onclick: () => {
        this.update((x) => { for (const e of pageOf(x, pageId).entities) if (e?.id && kindFor(e) === kind) for (const sl of slots) for (const k of [sl.key, sl.key + '2']) { if (item[k]) e[k] = item[k]; else delete e[k]; } });
        this.roomFor(pageId)?.render(); after?.(); toast('Colours copied');
      } }), 'Copies these colours to the other tiles like this on this page'));
    }
    const cols = this.roomFor(pageId)?.cols || 5;
    const [w, hh] = sizeOf(item);
    // Free sizes in 0.1 steps: slider plus − / + for fine nudges.
    const sizeCtl = (value, max, apply) => {
      const val = h('span.range-val', { text: fmtSize(value) });
      const slider = h('input.range', { type: 'range', min: MIN_SIZE, max, step: 0.1, value, 'aria-label': 'Size' });
      slider.addEventListener('input', () => { val.textContent = fmtSize(slider.value); });
      slider.addEventListener('change', () => apply(roundSize(slider.value)));
      const nudge = (d) => apply(roundSize(Math.max(MIN_SIZE, Math.min(max, value + d))));
      return h('div.range-ctl', {},
        h('button.icon-btn.sm', { html: icon('minus'), 'aria-label': 'Smaller by 0.1', disabled: value <= MIN_SIZE, onclick: () => nudge(-0.1) }),
        slider,
        h('button.icon-btn.sm', { html: icon('plus'), 'aria-label': 'Bigger by 0.1', disabled: value >= max, onclick: () => nudge(0.1) }),
        val);
    };
    const count = pageOf(this.settings, pageId).entities.length;
    const move = (d) => { this.update((x) => { const a = pageOf(x, pageId).entities; a.splice(i + d, 0, a.splice(i, 1)[0]); }); this.roomFor(pageId)?.render(); after?.(i + d); };
    rows.push(row('Order on the page', h('div.icon-ctl', {},
      h('button.pill.sm', { html: icon('back') + '<span>Earlier</span>', disabled: i === 0, onclick: () => move(-1) }),
      h('button.pill.sm.flip-ic', { html: '<span>Later</span>' + icon('back'), disabled: i >= count - 1, onclick: () => move(1) })), `Tile ${i + 1} of ${count}`));
    rows.push(row('Width (columns)', sizeCtl(roundSize(Math.min(w, cols)), cols, (v) => set((it) => { it.w = v; })), `0.2 to ${cols}, in steps of 0.1`));
    rows.push(row('Height (rows)', sizeCtl(roundSize(hh), MAX_H, (v) => set((it) => { it.h = v; })), `0.2 to ${MAX_H}, in steps of 0.1`));
    return rows;
  }

  /** The page's area in Home Assistant: one you chose, or one named like the page. None means the whole house. */
  pageArea(pg) {
    const areas = new Set(Object.values(this.store.areas || {}));
    if (pg.area && areas.has(pg.area)) return pg.area;
    const byName = [...areas].find((a) => a.toLowerCase() === (pg.name || '').toLowerCase());
    return byName || null;
  }
  /** Tiles for a ready-made section: matching devices in the page's room, else matching tiles already on the page. */
  sectionTiles(pg, preset) {
    const doms = new Set(preset.domains);
    const area = this.pageArea(pg);
    const okSensor = (st) => preset.key !== 'climate' || ['temperature', 'humidity', 'carbon_dioxide', 'pm25', 'pm10', 'aqi', 'volatile_organic_compounds', 'pressure'].includes(st.attributes?.device_class);
    const okBinary = (st) => preset.key !== 'security' || ['door', 'window', 'garage_door', 'motion', 'occupancy', 'smoke', 'moisture'].includes(st.attributes?.device_class);
    const fits = (st) => { const d = domainOf(st.entity_id); return doms.has(d) && (d !== 'sensor' || okSensor(st)) && (d !== 'binary_sensor' || okBinary(st)) && st.state !== 'unavailable'; };
    let ids = area ? this.store.list([...doms]).filter((st) => this.store.area(st.entity_id) === area && fits(st)).map((st) => st.entity_id) : [];
    if (!area) {
      // Whole house: what's on the page first, then everything else that fits.
      const onPage = (pg.entities || []).map((e) => e.id).filter((id) => this.store.get(id) && fits(this.store.get(id)));
      ids = [...new Set([...onPage, ...this.store.list([...doms]).filter(fits).map((st) => st.entity_id)])];
    }
    ids.sort((a, b) => preset.domains.indexOf(domainOf(a)) - preset.domains.indexOf(domainOf(b)));
    const tiles = ids.slice(0, 16).map((id) => {
      const t = { id };
      if (preset.key === 'climate' && domainOf(id) === 'climate') t.style = 'dial';
      if (preset.key === 'media' && domainOf(id) === 'media_player' && /tv|apple|roku|shield|chromecast|fire|android/i.test(id + this.store.name(id))) t.style = 'remote';
      return t;
    });
    if (preset.key === 'lights' && tiles.filter((t) => domainOf(t.id) === 'light').length >= 2) tiles.push({ id: ALL_OFF });
    return tiles;
  }
  /** The menu down the left of a page: its sections, each with its own tiles. */
  sectionsEditor(pageId, after) {
    const base = String(pageId).split('~')[0];
    const RAIL_ICONS = ['home', 'grid', 'bulb', 'thermo', 'fan', 'drop', 'snow', 'sun', 'tv', 'music', 'volume', 'lock', 'door', 'blinds', 'bell', 'gauge', 'power', 'calendar', 'sparkles', 'clock', 'toggle', 'flame'];
    const sh = sheet({ title: 'Sections', cls: 'sections-sheet', onClose: () => after?.() });
    const refresh = () => { this.roomFor(base)?.render(); render(); };
    const upd = (fn) => { this.update((x) => { const p = pageOf(x, base); if (p) fn(p); }); refresh(); };
    const iconChoice = (cur, on) => {
      const wrap = h('div.rail-icons');
      for (const n of RAIL_ICONS) wrap.append(h('button.rail-pick' + (n === cur ? '.sel' : ''), { html: icon(n), 'aria-label': n, onclick: () => on(n) }));
      return wrap;
    };
    let openIc = null;
    const render = () => {
      const pg = pageOf(this.settings, base);
      if (!pg) return sh.close();
      const secs = pg.sections || [];
      const line = (key, name, ic, count, extra, onName, onIcon) => {
        const r = h('div.sec-row', {},
          h('button.rail-pick.big' + (openIc === key ? '.sel' : ''), { html: icon(ic), 'aria-label': 'Change icon', onclick: () => { openIc = openIc === key ? null : key; render(); } }),
          h('input.text-in.name-in', { value: name, 'aria-label': 'Section name', onchange: (e) => { const v = e.target.value.trim(); if (v) onName(v); } }),
          h('span.ent-sub.count', { text: `${count} tile${count === 1 ? '' : 's'}` }),
          ...extra);
        return openIc === key ? [r, iconChoice(ic, (n) => { openIc = null; onIcon(n); })] : [r];
      };
      const rows = [
        ...line('_main', pg.mainName || 'All', pg.mainIcon || 'home', pg.entities.length, [h('span.sec-tag', { text: 'The page’s own tiles' })],
          (v) => upd((p) => { p.mainName = v; }), (n) => upd((p) => { p.mainIcon = n; })),
        ...secs.flatMap((x, i) => line(x.id, x.name, x.icon || 'grid', (x.entities || []).length, [
          h('button.pill.sm', { text: 'Tiles', onclick: () => { sh.close(); this.goToRoom(`${base}~${x.id}`); this.roomFor(base)?.setEditing(true); } }),
          h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Move up', disabled: i === 0, onclick: () => upd((p) => { p.sections.splice(i - 1, 0, p.sections.splice(i, 1)[0]); }) }),
          h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Move down', disabled: i === secs.length - 1, onclick: () => upd((p) => { p.sections.splice(i + 1, 0, p.sections.splice(i, 1)[0]); }) }),
          h('button.icon-btn.sm.danger', { html: icon('trash'), 'aria-label': 'Delete section', onclick: () => { if (!confirmDel[x.id]) { confirmDel[x.id] = true; toast('Tap again to delete this section and its tiles'); setTimeout(() => { delete confirmDel[x.id]; }, 3000); return; } upd((p) => { p.sections.splice(i, 1); if (!p.sections.length) delete p.sections; }); } }),
        ], (v) => upd((p) => { p.sections[i].name = v; }), (n) => upd((p) => { p.sections[i].icon = n; }))),
      ];
      const area = this.pageArea(pg);
      const add = (preset) => {
        const id = 's-' + uid();
        const tiles = preset ? this.sectionTiles(pg, preset) : [];
        upd((p) => { (p.sections ||= []).push({ id, name: preset?.name || 'New section', icon: preset?.icon || 'grid', entities: tiles }); });
        toast(preset ? `Added ${preset.name} with ${tiles.length} tile${tiles.length === 1 ? '' : 's'}${area && tiles.length ? ` from ${area}` : ''}` : 'Added a section. Rename it and add tiles.');
      };
      const used = new Set(secs.map((x) => x.name));
      sh.body.replaceChildren(
        h('div.about.small', { text: 'Sections put a menu down the left side of this page. Each one has its own tiles, so one room can have Lights, Climate and Media screens. Tap an icon to change it.' }),
        h('div.ent-list', {}, ...rows),
        h('div.set-sub', { text: area ? `Add a section (filled from ${area})` : 'Add a section (filled from the whole house)' }),
        h('div.add-page-row', {},
          ...SECTION_PRESETS.filter((p) => !used.has(p.name)).map((p) => h('button.pill', { html: icon(p.icon) + `<span>${p.name}</span>`, onclick: () => add(p) })),
          h('button.pill', { html: icon('plus') + '<span>Blank</span>', onclick: () => add(null) })),
        row('Room', (() => {
          const sel = h('select.select');
          sel.append(h('option', { value: '', text: 'Whole house' }));
          for (const a of [...new Set(Object.values(this.store.areas || {}))].sort()) sel.append(h('option', { value: a, text: a }));
          sel.value = pg.area || '';
          sel.onchange = () => upd((p) => { if (sel.value) p.area = sel.value; else delete p.area; });
          return sel;
        })(), area && !pg.area ? `Using ${area}, because the page has the same name` : 'Which Home Assistant area ready-made sections take their devices from'));
    };
    const confirmDel = {};
    render();
  }

  /** A panel with one tile's options (opened from Edit layout). */
  tileOptions(pageId, i) {
    const first = pageOf(this.settings, pageId)?.entities?.[i];
    if (!first) return;
    const sh = sheet({ title: tileName(this.store, first), cls: 'tile-sheet' });
    const render = (moved) => {
      if (typeof moved === 'number') i = moved;
      const it = pageOf(this.settings, pageId)?.entities?.[i];
      if (!it) return sh.close();
      sh.setTitle(tileName(this.store, it));
      sh.body.innerHTML = '';
      sh.body.append(...this.tileOptionRows(pageId, i, render), this.tileCopyRow(pageId, i, () => { this.renderRooms(); render(); }), h('div.sheet-actions', {},
        h('button.pill.danger-pill', { text: 'Remove tile', onclick: () => { this.update((x) => { pageOf(x, pageId).entities.splice(i, 1); }); this.roomFor(pageId)?.render(); sh.close(); } })));
    };
    render();
  }

  /** Duplicate a tile (with all its settings) next to it, or copy it to another page. */
  tileCopyRow(pageId, i, after) {
    const pages = this.settings.pages || [];
    const sel = h('select.select');
    sel.append(h('option', { value: '', text: 'Copy to another page…' }));
    for (const p of pages) if (p.id !== pageId) sel.append(h('option', { value: p.id, text: p.name }));
    sel.disabled = pages.length < 2;
    sel.onchange = () => {
      const to = sel.value; if (!to) return;
      const item = pageOf(this.settings, pageId)?.entities?.[i];
      if (!item) return;
      this.update((x) => { pageOf(x, to).entities.push(structuredClone(item)); });
      toast(`Copied to ${pageOf(this.settings, to)?.name}`); sel.value = ''; after?.();
    };
    return h('div.icon-ctl.copy-row', {},
      h('button.pill.sm', { html: icon('copy') + '<span>Duplicate</span>', onclick: () => {
        this.update((x) => { const a = pageOf(x, pageId).entities; a.splice(i + 1, 0, structuredClone(a[i])); });
        toast('Duplicated, with the same size, style, icon and colours'); after?.();
      } }),
      sel);
  }

  /** Download every setting (and uploaded icons) as one file. */
  async downloadBackup() {
    await loadCustom(true);
    const icons = {};
    for (const c of customList()) if (c.source === 'upload' || !c.source) icons[c.name] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.vb}">${c.body}</svg>`;
    const data = { app: 'facewall', kind: 'backup', created: new Date().toISOString(), settings: this.settings, icons };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `facewall-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup downloaded');
  }

  /** Restore a backup file: settings for every screen, and its icons. */
  async restoreBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { return toast('That file isn’t a Facewall backup', 'error'); }
    if (data?.app !== 'facewall' || !data.settings || !Array.isArray(data.settings.pages)) return toast('That file isn’t a Facewall backup', 'error');
    if (!confirm(`Restore the backup from ${new Date(data.created).toLocaleString()}? It replaces the current setup on every screen.`)) return;
    const icons = Object.entries(data.icons || {}).map(([n, svg]) => new File([svg], n + '.svg', { type: 'image/svg+xml' }));
    if (icons.length) await uploadIcons(icons);
    const restored = structuredClone(data.settings); migrate(restored);
    this.update((x) => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, restored); });
    this.appliedTheme = null; this.syncTheme(); this.renderFace(); this.renderRooms();
    toast(`Restored: ${data.settings.pages.length} page${data.settings.pages.length === 1 ? '' : 's'}${icons.length ? `, ${icons.length} icon${icons.length === 1 ? '' : 's'}` : ''}`);
  }

  /** Icon picker: Home Assistant (MDI), Font Awesome Free and your own icons (e.g. Font Awesome Pro SVGs). */
  async iconPicker(current, onPick) {
    let lib = 'all', style = null, onlineTimer = null, onlineCtl = null, onlineFor = null, online = null;
    const stop = onIconsChanged(() => { if (lib !== 'online') render(); });
    const sh = sheet({ title: 'Choose an icon', cls: 'icon-sheet', onClose: () => { stop(); onlineCtl?.abort(); } });
    const search = h('input.search', { type: 'search', placeholder: 'Search icons: lamp, sofa, tv… (or ph:lamp, fas:couch, fapro:…)', autocomplete: 'off', autocapitalize: 'off' });
    const chips = h('div.filter-chips');
    const styleChips = h('div.filter-chips.style-chips');
    const grid = h('div.icon-grid', {}, h('div.ent-empty', { text: 'Loading icons…' }));
    const files = h('input', { type: 'file', accept: '.svg,image/svg+xml', multiple: true, style: { display: 'none' } });
    const proBar = h('div.pro-bar', {},
      h('div.about.small', { html: 'Add your <b>Font Awesome Pro</b> (or any) icons: download the SVGs from fontawesome.com and upload them here, or put them in Home Assistant’s <code>custom_icons</code> folder. They’re used as <code>fapro:name</code>.' }),
      h('button.pill.sm.primary', { html: icon('plus') + '<span>Upload SVG</span>', onclick: () => files.click() }));
    const onlineBar = h('div.about.small.online-bar', { html: 'Searches <b>Iconify</b>: 200,000+ free, open-source icons from 200+ sets. The icon you choose is saved in Facewall, so the iPads don’t need the internet to show it. Each set keeps its own licence (shown under the icon).' });
    files.addEventListener('change', async () => {
      const added = await uploadIcons([...files.files]);
      files.value = '';
      toast(added.length ? `Added ${added.length} icon${added.length === 1 ? '' : 's'}` : 'No usable SVG icons in those files', added.length ? '' : 'error');
      lib = 'pro'; renderChips(); render();
    });
    sh.body.append(search, chips, styleChips, proBar, onlineBar, files, grid);
    const renderChips = () => {
      chips.innerHTML = '';
      for (const l of LIBRARIES) chips.append(h('button.fchip' + (lib === l.v ? '.on' : ''), { text: l.label, onclick: () => { lib = l.v; style = null; renderChips(); render(); } }));
      proBar.style.display = lib === 'pro' || lib === 'all' ? '' : 'none';
      onlineBar.style.display = lib === 'online' ? '' : 'none';
      const set = SETS[lib];
      styleChips.innerHTML = '';
      styleChips.style.display = set ? '' : 'none';
      if (set) {
        const cur = style || set.def;
        for (const [v, label] of [...set.styles, ['all', 'Every style']]) {
          styleChips.append(h('button.fchip.sm' + (cur === v ? '.on' : ''), { text: label, onclick: () => { style = v; renderChips(); render(); } }));
        }
      }
    };
    const cell = (it, svg, onclick) => {
      const c = h('button.icon-cell' + (current === it.name ? '.on' : ''), { title: `${it.name}  ·  ${it.lib}`, onclick });
      c.innerHTML = svg;
      c.append(h('span', { text: it.label }));
      return c;
    };
    const message = (text) => { grid.innerHTML = ''; grid.append(h('div.ent-empty', { text })); };
    const renderOnline = () => {
      const q = search.value.trim();
      if (q.length < 2) { onlineFor = null; return message('Type what you’re looking for, e.g. floor lamp, ceiling fan, dog.'); }
      if (online && onlineFor === q) {
        grid.innerHTML = '';
        for (const it of online) {
          const c = cell(it, it.svg, async () => {
            c.classList.add('busy');
            try { const name = await useOnlineIcon(it); onPick(name); sh.close(); } catch { c.classList.remove('busy'); toast('Couldn’t save that icon. Try again.', 'error'); }
          });
          c.append(h('span.icon-lib', { text: it.lib }));
          grid.append(c);
        }
        if (!online.length) message('Nothing found. Try another word (searches are in English).');
        return;
      }
      clearTimeout(onlineTimer);
      message('Searching…');
      onlineTimer = setTimeout(async () => {
        onlineCtl?.abort(); onlineCtl = new AbortController();
        try {
          const res = await searchOnline(q, { signal: onlineCtl.signal });
          if (search.value.trim() !== q || lib !== 'online') return;
          online = res; onlineFor = q; renderOnline();
        } catch (e) {
          if (e.name !== 'AbortError' && lib === 'online') message('Couldn’t reach Iconify. This needs an internet connection on the device you’re using.');
        }
      }, 350);
    };
    const render = () => {
      if (lib === 'online') return renderOnline();
      const items = searchIcons(lib, search.value, 180, style);
      grid.innerHTML = '';
      for (const it of items) {
        const svg = iconSvg(it.name);
        if (!svg) continue;
        const c = cell(it, svg, () => { onPick(it.name); sh.close(); });
        if (it.deletable) c.append(h('span.icon-del', { html: icon('close'), title: 'Delete this uploaded icon', onclick: async (e) => { e.stopPropagation(); await deleteIcon(it.label); render(); } }));
        grid.append(c);
      }
      if (!grid.children.length) {
        const loading = SETS[lib] || lib === 'all';
        grid.append(h('div.ent-empty', { text: lib === 'pro' ? 'No icons of your own yet. Upload SVGs above.' : loading && !items.length && !search.value ? 'Loading icons…' : 'No icons match.' }));
      }
    };
    search.addEventListener('input', render);
    renderChips();
    await loadIcons();
    render();
    if (document.body.classList.contains('mouse')) setTimeout(() => search.focus(), 60);
  }

  // ------------------------------------------------------------------ screen care
  /** Black out the screen (on) or wake it (off). Waking goes where this iPad is set to. */
  setSleep(on) {
    if (!!this.sleeping === on) return;
    this.sleeping = on;
    this.sleepCover.classList.toggle('on', on);
    if (on) this.stopFrame();
    if (on) return;
    this.lastActivity = Date.now();
    this.wake(true);
    const to = this.screen.wakeTo || 'clock';
    if (to === 'clock') this.goTo(0, true);
    else if (to === 'page') this.goTo(this.startIndex(), true);
  }
  // ------------------------------------------------------------------ photo frame
  frameCheck(idle, anyOverlay) {
    const pf = this.screen.photos;
    if (!pf?.on || this.frame || this.sleeping || this.bell || anyOverlay || this.page !== 0) return;
    if (idle >= Math.max(20, (pf.after ?? 5) * 60)) this.startFrame();
  }
  async startFrame() {
    const pf = this.screen.photos || {};
    if (this.frame) return;
    const r = await this.store.photos(pf.folder || 'media');
    let files = r.files || [];
    if (!files.length) { this.lastActivity = Date.now(); if (!this._pfWarned) { this._pfWarned = true; toast('Photo frame: no photos found in “' + (pf.folder || 'media') + '”'); } return; }
    if ((pf.order || 'shuffle') === 'shuffle') files = files.map((f) => [Math.random(), f]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const A = h('div.pf-img'), B = h('div.pf-img');
    const time = h('div.pf-time'), sub = h('div.pf-sub');
    const corner = h('div.pf-corner', {}, time, sub);
    const el = h('div.photo-frame' + (pf.fit === 'fit' ? '.fit' : '') + (pf.zoom === false ? '.still' : ''), { onpointerdown: (e) => { e.preventDefault(); e.stopPropagation(); this.stopFrame(); } }, A, B, (pf.clock || 'full') !== 'none' ? corner : null);
    document.body.append(el);
    let i = 0, front = A;
    const show = () => {
      const f = files[i++ % files.length];
      if (i % files.length === 0 && (pf.order || 'shuffle') === 'shuffle') files.sort(() => Math.random() - 0.5);
      const url = this.store.photoUrl(f);
      const img = new Image();
      img.onload = img.onerror = () => {
        if (!this.frame) return;
        if (!img.naturalWidth) return; // skip photos the iPad can't show
        const back = front === A ? B : A;
        back.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
        back.style.setProperty('--pf-x', (Math.random() * 6 - 3).toFixed(1) + '%');
        back.style.setProperty('--pf-y', (Math.random() * 6 - 3).toFixed(1) + '%');
        back.style.setProperty('--pf-dur', ((pf.every || 20) + 4) + 's');
        back.classList.remove('on'); void back.offsetWidth; back.classList.add('on');
        front.classList.remove('on');
        front = back;
      };
      img.src = url;
    };
    const tickClock = () => {
      const now = new Date(), use24h = this.settings.general.use24h;
      time.textContent = now.toLocaleTimeString(undefined, { hour: use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !use24h });
      if ((pf.clock || 'full') === 'full') {
        const wid = this.settings.header?.weather || this.store.list(['weather'])[0]?.entity_id;
        const w = wid ? this.store.get(wid) : null;
        const temp = w?.attributes?.temperature != null ? ` · ${Math.round(w.attributes.temperature)}°` : '';
        sub.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + temp;
      } else sub.textContent = '';
    };
    tickClock(); show();
    this.frame = { el, timers: [setInterval(show, (pf.every || 20) * 1000), setInterval(tickClock, 5000)] };
    requestAnimationFrame(() => el.classList.add('in'));
  }
  stopFrame() {
    if (!this.frame) return;
    const { el, timers } = this.frame;
    this.frame = null;
    timers.forEach(clearInterval);
    this.lastActivity = Date.now();
    el.classList.remove('in');
    setTimeout(() => el.remove(), 600);
  }
  /** Go black after the chosen minutes without touches or motion (motion sensor optional). */
  sleepCheck() {
    const after = this.screen.sleepMin;
    if (!after || this.sleeping || this.bell || document.querySelector('.sheet-backdrop') || this.rooms.some((r) => r.editing)) return;
    const m = this.screen.motion ? this.store.get(this.screen.motion) : null;
    if (m && m.state === 'on') return;
    const moved = Math.max(this.lastActivity, this.lastMotion || 0, m?.last_changed ? new Date(m.last_changed).getTime() : 0);
    if (Date.now() - moved > after * 60000) this.setSleep(true);
  }
  /** Someone walked in: wake up. */
  checkMotion(id) {
    if (!this.screen.motion || id !== this.screen.motion) return;
    if (this.store.get(id)?.state === 'on') { this.lastMotion = Date.now(); if (this.sleeping) this.setSleep(false); }
  }
  /** Burn-in protection: move everything by a few pixels every few minutes. */
  shiftPixels(force) {
    const app = document.getElementById('app');
    if (this.settings?.general?.shift === false) { app.style.transform = ''; return; }
    if (!force && Date.now() - (this.lastShift || 0) < 180000) return;
    this.lastShift = Date.now();
    const r = () => Math.round(Math.random() * 6 - 3);
    app.style.transform = `translate(${r()}px, ${r()}px)`;
  }

  // ------------------------------------------------------------------ cameras and the doorbell
  /** Full-screen camera view. For the doorbell: a title, an Unlock button and closing by itself. */
  cameraView(id, { title, doorbell = false, lock = null, seconds = 0, onClose } = {}) {
    let refresh = null, countdown = null, closeAt = 0;
    const img = h('img.cv-img', { alt: '' });
    const sh = sheet({ title: title || (id ? this.store.name(id) : 'Camera'), cls: 'camera-sheet' + (doorbell ? '.doorbell' : ''), onClose: () => {
      clearInterval(refresh); clearInterval(countdown); img.removeAttribute('src'); onClose?.();
    } });
    if (id) {
      img.src = cameraUrl(this.store, id, true);
      if (this.store.mode === 'demo') refresh = setInterval(() => { img.src = cameraUrl(this.store, id, true); }, 1000);
      img.addEventListener('error', () => { img.replaceWith(h('div.cv-none', { html: icon('close') + '<span>Couldn’t load the camera</span>' })); });
      sh.body.append(h('div.cv-wrap', {}, img));
    } else sh.body.append(h('div.cv-none', { html: icon('bell') + '<span>No camera chosen</span>' }));
    const bar = h('div.cv-bar');
    const note = h('span.cv-note');
    if (lock && this.store.get(lock)) {
      let armed = null;
      const btn = h('button.pill.cv-unlock');
      const draw = () => { const locked = this.store.get(lock)?.state === 'locked'; btn.innerHTML = icon(locked ? 'unlock' : 'lock') + `<span>${armed ? 'Tap again to unlock' : locked ? 'Unlock the door' : 'Lock the door'}</span>`; btn.classList.toggle('armed', !!armed); };
      btn.onclick = () => {
        const locked = this.store.get(lock)?.state === 'locked';
        if (!locked) { this.store.call('lock', 'lock', {}, { entity_id: lock }); return; }
        if (armed) { clearTimeout(armed); armed = null; this.store.call('lock', 'unlock', {}, { entity_id: lock }); toast('Unlocking'); draw(); return; }
        armed = setTimeout(() => { armed = null; draw(); }, 3000); draw();
      };
      const onEv = (e) => { if (e.detail === lock) draw(); };
      this.store.addEventListener('state', onEv);
      draw();
      bar.append(btn);
    }
    bar.append(note, h('button.pill.primary', { text: doorbell ? 'Dismiss' : 'Close', onclick: () => sh.close() }));
    sh.body.append(bar);
    if (seconds) {
      const restart = () => { closeAt = Date.now() + seconds * 1000; };
      restart();
      countdown = setInterval(() => { const left = Math.ceil((closeAt - Date.now()) / 1000); if (left <= 0) sh.close(); else note.textContent = `Closes in ${left} s`; }, 500);
      sh.el.addEventListener('pointerdown', restart);
      return { close: () => sh.close(), restart };
    }
    return { close: () => sh.close() };
  }

  /** Show the doorbell pop-up (also used by the Try it button). */
  ringDoorbell() {
    const db = this.settings.doorbell || {};
    if (this.bell) { this.bell.restart?.(); return; }
    this.lastActivity = Date.now();
    this.wake(true);
    if (this.sleeping) { this.sleeping = false; this.sleepCover.classList.remove('on'); }
    this.dim.style.opacity = 0;
    this.stopFrame();
    this.bell = this.cameraView(db.camera || null, { title: 'Someone’s at the door', doorbell: true, lock: db.lock, seconds: db.seconds || 60, onClose: () => { this.bell = null; this.applyDim(); } });
  }

  /** Watch the doorbell trigger: a button/sensor turning on, or a new event. */
  checkDoorbell(id) {
    const db = this.settings?.doorbell;
    if (!db?.trigger || id !== db.trigger || this.screen.noDoorbell) return;
    const s = this.store.get(id);
    this.bellPrev ||= {};
    const prev = this.bellPrev[id];
    this.bellPrev[id] = s?.state;
    if (!s || s.state === prev || ['unavailable', 'unknown'].includes(s.state)) return;
    // Only fresh changes (a state re-sent after a settings change isn't a ring).
    if (s.last_changed && Date.now() - new Date(s.last_changed).getTime() > 30000) return;
    const d = domainOf(id);
    if (d === 'event' || d === 'input_button' || d === 'sensor' || s.state === 'on') this.ringDoorbell();
  }

  // ------------------------------------------------------------------ page header
  /** Edit the title and the line under it (all pages). */
  headerEditor(after) {
    const sh = sheet({ title: 'Page header', cls: 'header-sheet', onClose: () => after?.() });
    const page = this.rooms[Math.max(0, this.page - 1)]?.page || this.settings.pages?.[0];
    let open = null;
    const save = (fn) => {
      this.update((x) => { const hd = headerOf(x); fn(hd); x.header = hd; });
      this.rooms.forEach((r) => r.render());
      render();
    };
    const preview = h('div.hd-preview.home-page');
    const drawPreview = () => {
      const hd = headerOf(this.settings);
      for (const [k, v] of Object.entries(themeVars(themeById(this.themeId())))) preview.style.setProperty(k, v);
      const { title, html } = headerContent(this.store, hd, new Date(), { isHome: /^home$/i.test(page?.name || ''), pageName: page?.name });
      const line = h('div.date', { html });
      if (!html) line.style.display = 'none';
      const head = h('header.home-head', {}, h('div.head-titles', {}, h('div.greet', { text: title }), line));
      const { vars, grad } = headerVars(hd);
      for (const [k, v] of Object.entries(vars)) if (v != null && k !== '--hd-h') head.style.setProperty(k, v);
      line.classList.toggle('grad', grad);
      preview.innerHTML = '';
      preview.append(h('div.home-bg'), head);
    };
    const fontPicker = (cur, pick) => h('div.font-grid', {}, FONTS.map((f) => h('button.font-chip' + ((cur || 'system') === f.v ? '.on' : ''), { style: { fontFamily: f.css }, onclick: () => pick(f.v) },
      h('span.fc-aa', { text: 'Aa' }), h('span.fc-name', { text: f.label }))));
    const sizeCtl = (value, min, max, step, apply, unit = '%') => {
      const val = h('span.range-val', { text: `${value}${unit}` });
      const slider = h('input.range', { type: 'range', min, max, step, value });
      slider.addEventListener('input', () => { val.textContent = `${slider.value}${unit}`; });
      slider.addEventListener('change', () => apply(Number(slider.value)));
      return h('div.range-ctl', {}, slider, val);
    };
    const textIn = (value, placeholder, apply) => h('input.text-in.wide-in', { value: value || '', placeholder, onchange: (e) => apply(e.target.value.trim()) });
    const partNow = (hd, p) => headerSegments(this.store, { ...hd, parts: [{ ...p, on: true }] }, new Date()).map((x) => x.html.replace(/<[^>]+>/g, '')).join(', ');

    const partOptions = (hd, p, i) => {
      const upd = (fn) => save((x) => fn(x.parts[i]));
      switch (p.k) {
        case 'greeting': return [
          row('Words', segmented([{ v: 'auto', label: 'Good morning…' }, { v: 'custom', label: 'My own' }], p.mode || 'auto', (v) => upd((q) => { q.mode = v; }))),
          p.mode === 'custom'
            ? row('Text', textIn(p.text, 'e.g. Welcome home', (v) => upd((q) => { q.text = v; })))
            : row('Add a name', textIn(p.name, 'e.g. Alex', (v) => upd((q) => { if (v) q.name = v; else delete q.name; })), '“Good evening, Alex”'),
        ];
        case 'date': {
          const sel = h('select.select');
          for (const f of DATE_FORMATS) sel.append(h('option', { value: f.v, text: fmtDate(new Date(), f.v) }));
          sel.value = p.fmt || 'long';
          sel.onchange = () => upd((q) => { q.fmt = sel.value; });
          return [row('Format', sel)];
        }
        case 'now': return [
          row('Show', segmented([{ v: 'both', label: 'Both' }, { v: 'temp', label: 'Temperature' }, { v: 'cond', label: 'Conditions' }], p.show || 'both', (v) => upd((q) => { q.show = v; }))),
          row('Weather icon', toggle(p.icon !== false, (v) => upd((q) => { q.icon = v; }))),
        ];
        case 'rain': return [row('Show', segmented([{ v: 'always', label: 'Always' }, { v: 'likely', label: 'When rain is likely' }], p.when || 'likely', (v) => upd((q) => { q.when = v; })), 'Likely = 30% or more today')];
        case 'wind': return [row('Show', segmented([{ v: 'always', label: 'Always' }, { v: 'strong', label: 'Only when windy' }], p.when || 'always', (v) => upd((q) => { q.when = v; })), 'Windy = about 25 mph / 40 km/h or more')];
        case 'alerts': return [
          row('Storms', toggle(p.storms !== false, (v) => upd((q) => { q.storms = v; })), 'Thunderstorms, hail, heavy rain or extreme weather from the weather entity'),
          row('Very strong wind', toggle(p.wind !== false, (v) => upd((q) => { q.wind = v; })), 'About 40 mph / 60 km/h or more, or big gusts'),
          ...(p.entities || []).map((id, j) => row(this.store.name(id) || id, h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => upd((q) => { q.entities.splice(j, 1); }) }), 'Shown while it has an active alert')),
          row('Add an alert sensor', entitySelect(this.store, null, [['Sensors', ['sensor']], ['Binary sensors', ['binary_sensor']]], (v) => { if (v) upd((q) => { (q.entities ||= []).includes(v) || q.entities.push(v); }); }, 'Choose…'),
            'For hurricane, storm or flood warnings, add your weather service’s alert sensor (e.g. NWS Alerts, Meteoalarm, Met Office). It shows its warning only while one is active.'),
        ];
        case 'sensor': return [
          row('Sensor', entitySelect(this.store, p.id, INFO_GROUPS, (v) => upd((q) => { q.id = v; }), 'Choose…')),
          row('Label', textIn(p.label, p.id ? this.store.name(p.id) : 'e.g. Inside', (v) => upd((q) => { if (v) q.label = v; else delete q.label; })), 'Leave empty to use its name; a single space shows just the value'),
        ];
        case 'text': return [row('Text', textIn(p.text, 'e.g. Trash day', (v) => upd((q) => { q.text = v; })))];
        default: return [];
      }
    };

    const render = () => {
      const hd = headerOf(this.settings);
      drawPreview();
      sh.body.innerHTML = '';
      const sec = (title, ...kids) => h('section.set-sec', {}, h('div.set-title', { text: title }), ...kids);
      // ---- the line's pieces
      const list = h('div.hd-parts');
      hd.parts.forEach((p, i) => {
        const def = PARTS[p.k] || { label: p.k };
        const nowText = p.on ? partNow(hd, p) : '';
        const label = p.k === 'sensor' && p.id ? (p.label || this.store.name(p.id)) : p.k === 'text' && p.text ? `“${p.text}”` : def.label;
        const move = (d) => save((x) => { const a = x.parts; a.splice(i + d, 0, a.splice(i, 1)[0]); if (open === i) open = i + d; });
        const rowEl = h('div.hd-part' + (p.on ? '.on' : ''), {},
          toggle(!!p.on, (v) => save((x) => { x.parts[i].on = v; if (v && PARTS[p.k]?.weather && !x.weather) { const w = weatherEntity(this.store, x); if (w) x.weather = w; } })),
          h('button.hd-part-main', { onclick: () => { open = open === i ? null : i; render(); } },
            h('div.hd-part-name', { text: label }),
            h('div.hd-part-sub', { text: p.on ? (nowText || 'Nothing to show right now') : def.sub || '' })),
          h('div.hd-part-btns', {},
            h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Move earlier', disabled: i === 0, onclick: () => move(-1) }),
            h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Move later', disabled: i === hd.parts.length - 1, onclick: () => move(1) }),
            def.multi ? h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => save((x) => { x.parts.splice(i, 1); open = null; }) }) : null));
        list.append(rowEl);
        if (open === i) {
          const opts = partOptions(hd, p, i);
          if (opts.length) list.append(h('div.ent-edit.hd-part-opts', {}, ...opts));
        }
      });
      const lineSec = sec('Line under the title',
        h('div.about.small', { text: 'Turn on the pieces you want and put them in order. Tap one for its options.' }),
        list,
        h('div.icon-ctl.hd-add', {},
          h('button.pill.sm', { html: icon('plus') + '<span>Add a sensor</span>', onclick: () => save((x) => { x.parts.push({ k: 'sensor', on: true }); open = x.parts.length - 1; }) }),
          h('button.pill.sm', { html: icon('plus') + '<span>Add your own text</span>', onclick: () => save((x) => { x.parts.push({ k: 'text', on: true, text: '' }); open = x.parts.length - 1; }) })),
        row('Weather from', entitySelect(this.store, weatherEntity(this.store, hd), [['Weather', ['weather']]], (v) => save((x) => { if (v) x.weather = v; else delete x.weather; }), 'None'), 'Used by the weather pieces'),
        row('Between pieces', segmented(SEPARATORS, hd.sep ?? ' · ', (v) => save((x) => { x.sep = v; }))));
      const lineLook = sec('Line: font and size',
        fontPicker(hd.subFont, (v) => save((x) => { x.subFont = v; })),
        row('Size', sizeCtl(hd.subSize || 100, 60, 250, 5, (v) => save((x) => { x.subSize = v; }))),
        row('Weight', segmented(WEIGHTS, hd.subWeight || 600, (v) => save((x) => { x.subWeight = v; }))),
        row('Colour', this.colorCtl(hd.subColor, hd.subColor2, 'Theme', (c, c2) => save((x) => { if (c) x.subColor = c; else delete x.subColor; if (c && c2) x.subColor2 = c2; else delete x.subColor2; }))));
      const titleSec = sec('Title',
        fontPicker(hd.titleFont, (v) => save((x) => { x.titleFont = v; })),
        row('Size', sizeCtl(hd.titleSize || 100, 60, 200, 5, (v) => save((x) => { x.titleSize = v; }))),
        row('Weight', segmented(WEIGHTS, hd.titleWeight || 750, (v) => save((x) => { x.titleWeight = v; }))),
        row('On the Home page', segmented([{ v: 'greeting', label: 'Greeting' }, { v: 'name', label: 'Page name' }], hd.homeTitle || 'greeting', (v) => save((x) => { x.homeTitle = v; })), 'Room pages always show the room’s name'));
      const sizeSec = sec('Header height',
        row('Space for the header', sizeCtl(hd.height || 13, 8, 30, 1, (v) => save((x) => { x.height = v; }), '%'), 'Share of the screen’s height; the tiles make room'),
        h('div.sheet-actions', {}, h('button.pill', { text: 'Reset the header', onclick: () => save((x) => { const d = defaultHeader(); for (const k of Object.keys(x)) delete x[k]; Object.assign(x, d); open = null; }) })));
      sh.body.append(h('div.hd-preview-wrap', {}, preview), lineSec, lineLook, titleSec, sizeSec);
    };
    render();
  }

  // ------------------------------------------------------------------ themes
  /** A small picture of a theme: background, a card with the accent, and an "on" tile. */
  themeSwatch(t, { small } = {}) {
    return h('div.th-mini' + (small ? '.sm' : ''), { style: { background: t.pattern ? `${t.pattern} center / 120px repeat, ${t.bg}` : t.bg } },
      h('div.th-mini-card', { style: { background: t.card } },
        h('span.th-dot', { style: { background: t.dark ? t.date || t.accent : t.accent } }),
        h('span.th-ticks', { style: { color: t.dark ? t.date || t.accent : t.accent } }, h('i'), h('i'), h('i'), h('i'))),
      h('div.th-mini-on', { style: { background: t.on } }));
  }

  /** A mock page in a theme, made of real tiles so it looks exactly like the result. */
  themePreview(el, t) {
    el.innerHTML = '';
    for (const [k, v] of Object.entries(themeVars(t))) el.style.setProperty(k, v);
    const tile = (cls, ic, name, state, style) => h(`div.card.tile.${cls}`, { style }, h('div.tile-top', {}, h('span.tile-ic', { html: icon(ic) })), h('div.tile-bottom', {}, h('div.tile-name', { text: name }), h('div.tile-state', { text: state })));
    const now = new Date();
    el.append(
      h('div.home-bg'),
      h('div.th-head', {}, h('div.greet', { text: 'Good evening' }), h('div.date', { text: now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) })),
      h('div.th-grid', {},
        tile('light.on.dark-text', 'bulb', 'Living room', 'On · 70%', { '--lc': '255,196,120', '--la': '0.87' }),
        tile('toggle.on', 'toggle', 'Coffee', 'On'),
        tile('toggle', 'fan', 'Kitchen fan', 'Off'),
        h('div.card.climate.th-wide', {},
          h('div.card-head-row', {}, h('div.card-head', {}, h('span.card-ic', { html: icon('sun') }), h('div.card-titles', {}, h('div.card-title', { text: 'Bedroom' }), h('div.card-sub', { text: 'Heating off' }))), h('button.round-btn', { html: icon('power') })),
          h('div.cl-main', {}, h('div', {}, h('div.cl-temp', { html: '21.5<span>°</span>' }), h('div.cl-inside', { text: 'Inside 20.8°' })), h('div.cl-arrows', {}, h('button.round-btn', { html: icon('up') }), h('button.round-btn', { html: icon('down') }))),
          h('div.cl-modes', {}, ['sun', 'snow', 'auto'].map((m, i) => h('button.mode', { html: icon(m) + `<span>${['Heat', 'Cool', 'Auto'][i]}</span>` })))),
        tile('light', 'bulb', 'Hall', 'Off'),
        tile('lock', 'lock', 'Front door', 'Locked')));
  }

  openThemePicker(after) {
    const current = this.baseThemeId();
    let selected = current, tryOn = false, done = false;
    this.themePreviewing = false;
    const restore = () => { this.themePreviewing = false; applyTheme(this.themeId()); applyLook(this.settings.general.look); };
    const sh = sheet({ title: 'Theme', cls: 'theme-sheet', onClose: () => { if (!done) restore(); } });
    const preview = h('div.th-preview.home-page');
    const grid = h('div.th-groups');
    const fromTo = h('div.th-fromto');
    const onlyBtn = h('button.pill', { text: 'Only this iPad' });
    const allBtn = h('button.pill.primary', { text: 'Apply to all screens' });
    const discard = h('button.pill', { text: 'Discard', onclick: () => sh.close() });
    const tryToggle = toggle(false, (v) => { tryOn = v; this.themePreviewing = v; applyTheme(v ? selected : this.themeId()); });
    const renderGrid = () => {
      grid.innerHTML = '';
      for (const g of THEME_GROUPS) {
        grid.append(h('div.th-group', { text: g }));
        const wrap = h('div.th-grid-sw');
        for (const t of THEMES.filter((x) => x.group === g)) {
          wrap.append(h('button.th-sw' + (t.id === selected ? '.sel' : ''), { 'aria-label': `${t.name} theme`, onclick: () => { selected = t.id; update(); } },
            this.themeSwatch(t),
            h('div.th-name', {}, h('span', { text: t.name }), t.id === current ? h('span.th-check', { html: icon('check'), title: 'Current theme' }) : null)));
        }
        grid.append(wrap);
      }
    };
    const update = () => {
      renderGrid();
      const t = themeById(selected);
      this.themePreview(preview, t);
      fromTo.textContent = selected === current ? `${t.name} (current)` : `${themeById(current).name} → ${t.name}`;
      onlyBtn.disabled = selected === this.screen.theme;
      allBtn.disabled = selected === (this.settings.general?.theme || DEFAULT_THEME) && !this.screen.theme;
      if (tryOn) applyTheme(selected);
    };
    onlyBtn.onclick = () => { done = true; this.updateScreen((x) => { x.theme = selected; }); this.themePreviewing = false; applyTheme(this.themeId()); toast(`${themeById(selected).name} on this iPad`); sh.close(); after?.(); };
    allBtn.onclick = () => {
      done = true;
      this.update((s) => { s.general.theme = selected; const sc = s.screens?.[this.screenId]; if (sc) delete sc.theme; });
      this.themePreviewing = false; applyTheme(this.themeId()); toast(`${themeById(selected).name} on every screen`); sh.close(); after?.();
    };
    sh.body.append(h('div.th-layout', {},
      h('div.th-left', {}, grid),
      h('div.th-right', {},
        h('div.th-label', { text: 'Preview' }),
        preview,
        row('Try it on this whole screen', tryToggle, 'Until you apply or leave'))));
    sh.el.append(h('div.th-bar', {}, fromTo, discard, onlyBtn, allBtn));
    update();
  }

  /** Name this screen. A remembered (random) screen id switches to the name, so the ?screen= address is readable. */
  renameScreen(name) {
    name = String(name || '').trim();
    const fromUrl = !!new URLSearchParams(location.search).get('screen');
    this.update((s) => {
      s.screens ||= {};
      const cur = s.screens[this.screenId] || {};
      cur.name = name || undefined; cur.seen = Date.now();
      const want = slug(name);
      if (!fromUrl && want && want !== this.screenId) {
        let id = want, n = 2;
        while (s.screens[id]) id = `${want}-${n++}`;
        delete s.screens[this.screenId];
        s.screens[id] = cur;
        this.screenId = id; lsSet('facewall-screen', id);
      } else s.screens[this.screenId] = cur;
    });
  }

  entityBrowser(pageId, onChange) {
    const pg = pageOf(this.settings, pageId);
    if (!pg) return;
    const sh = sheet({ title: `Add tiles to ${pg.name}`, cls: 'browser-sheet' });
    const search = h('input.search', { type: 'search', placeholder: 'Search devices', autocomplete: 'off' });
    let filter = 'all';
    const chips = h('div.filter-chips');
    const list = h('div.ent-list');
    sh.body.append(search, chips, list);
    const groups = [['all', 'All'], ['light', 'Lights'], ['climate', 'Climate'], ['switch', 'Switches'], ['lock', 'Locks'], ['cover', 'Covers'], ['sensor', 'Sensors'], ['weather', 'Weather'], ['media_player', 'Media'], ['camera', 'Cameras'], ['calendar', 'Calendars'], ['person', 'People'], ['vacuum', 'Vacuums'], ['alarm_control_panel', 'Alarm'], ['scene', 'Scenes'], ['other', 'Other']];
    const MAIN = ['light', 'climate', 'switch', 'lock', 'cover', 'sensor', 'scene', 'weather', 'media_player', 'camera', 'calendar', 'person', 'vacuum', 'alarm_control_panel'];
    const renderChips = () => {
      chips.innerHTML = '';
      for (const [v, l] of groups) chips.append(h('button.fchip' + (filter === v ? '.on' : ''), { text: l, onclick: () => { filter = v; renderChips(); renderList(); } }));
    };
    const renderList = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      const items = this.store.list(TILE_DOMAINS).filter((st) => {
        const d = domainOf(st.entity_id);
        if (filter === 'other' ? MAIN.includes(d) : filter !== 'all' && d !== filter && !(filter === 'switch' && d === 'input_boolean') && !(filter === 'climate' && d === 'water_heater') && !(filter === 'sensor' && d === 'binary_sensor') && !(filter === 'scene' && d === 'script')) return false;
        if (!q) return true;
        return (this.store.name(st.entity_id) + ' ' + st.entity_id + ' ' + this.store.area(st.entity_id)).toLowerCase().includes(q);
      }).slice(0, 300);
      for (const st of items) {
        const id = st.entity_id;
        const count = (pageOf(this.settings, pageId)?.entities || []).filter((e) => e.id === id).length;
        const minus = count ? h('button.icon-btn.sm', { html: icon('minus'), 'aria-label': 'Remove one from this page', onclick: (e) => {
          e.stopPropagation();
          this.update((x) => { const a = pageOf(x, pageId).entities; for (let k = a.length - 1; k >= 0; k--) if (a[k].id === id) { a.splice(k, 1); break; } });
          renderList(); onChange?.();
        } }) : null;
        const rowEl = h('button.ent-row.pickable' + (count ? '.on' : ''), {},
          h('span.ent-ic', { html: iconHtml(this.store, { id }, domainIcon(domainOf(id), isOn(st))) }),
          h('div.ent-text', {}, h('div.ent-name', { text: this.store.name(id) }), h('div.ent-sub', { text: [this.store.area(id), id].filter(Boolean).join('  ·  ') })),
          count ? h('span.ent-count', { text: count > 1 ? `On page ×${count}` : 'On page' }) : null,
          minus,
          h('span.ent-check', { html: icon('plus'), title: count ? 'Add another copy' : 'Add' }));
        rowEl.onclick = () => {
          this.update((x) => { pageOf(x, pageId).entities.push({ id }); });
          if (count) toast(`Added another ${this.store.name(id)}. Set its style in Options.`);
          renderList(); onChange?.();
        };
        list.append(rowEl);
      }
      if (!items.length) list.append(h('div.ent-empty', { text: 'Nothing matches.' }));
    };
    search.addEventListener('input', renderList);
    renderChips(); renderList();
  }

  // ------------------------------------------------------------------ housekeeping
  idleCheck() {
    const idle = (Date.now() - this.lastActivity) / 1000;
    const limit = this.settings.general.idleSec;
    if (!limit) { this.frameCheck(idle, document.querySelector('.overlay, .sheet-backdrop')); return this.sleepCheck(); }
    const anyOverlay = document.querySelector('.overlay, .sheet-backdrop');
    if (anyOverlay && idle > Math.max(limit, 120)) {
      document.querySelectorAll('.sheet-backdrop').forEach((b) => b.remove());
      document.querySelectorAll('.overlay.customize, .overlay.gallery').forEach((o) => o.remove());
      this.gallery = null;
      this.closePicker();
    }
    if (this.page >= 1 && !anyOverlay && !this.rooms.some((r) => r.editing) && idle > limit) this.goTo(0);
    this.frameCheck(idle, anyOverlay);
    this.sleepCheck();
  }
  applyDim() {
    const d = this.settings.general.dim || {};
    let level = 0;
    if (d.on) {
      const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
      const toMin = (t) => { const [a, b] = (t || '0:0').split(':').map(Number); return a * 60 + b; };
      const from = toMin(d.from), to = toMin(d.to);
      const inside = from <= to ? m >= from && m < to : m >= from || m < to;
      if (inside) level = d.level ?? 0.55;
    }
    this.dim.style.opacity = level;
  }
  async wake(force) {
    if (!('wakeLock' in navigator)) return;
    if (this.lock && !this.lock.released && !force) return;
    try { this.lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed yet */ }
  }
  showStatus() {
    const st = this.store.status;
    const p = this.statusPill;
    if (!p) return;
    if (this.store.mode === 'demo') { p.textContent = 'Demo'; p.className = 'status-pill show demo'; return; }
    if (st.connected) { p.className = 'status-pill'; return; }
    p.textContent = 'Reconnecting to Home Assistant…';
    p.className = 'status-pill show warn';
  }
}

const app = new App();
window.facewall = app;
app.start().catch((e) => {
  console.error(e);
  document.getElementById('app').innerHTML = `<div class="fatal">Facewall couldn’t start: ${String(e.message || e)}</div>`;
});
