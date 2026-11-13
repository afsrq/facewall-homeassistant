// Facewall app shell: pager (clock ⇄ room pages), face picker, customize, gallery, settings, per-screen settings.
import { Store, domainOf, isOn } from './data.js';
import { FACES, FACE_ORDER, mountFace } from './faces.js';
import { HomePage, TIMER_OK, ALL_OFF, tileName, tileIcon, sizeOf, pageOf, iconHtml, stylesFor, styleOf } from './home.js';
import { loadMdi, mdiSvg, mdiNames, mdiHas, SUGGESTED } from './mdi.js';
import { icon, domainIcon } from './icons.js';
import { h, press, sheet, toast, toggle, segmented, swatches, row, entitySelect, openSheets } from './ui.js';

const uid = () => Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));
const TAP_GROUPS = [['Lights', ['light']], ['Switches', ['switch', 'input_boolean']], ['Fans', ['fan']], ['Scenes', ['scene']], ['Scripts', ['script']], ['Covers', ['cover']]];
const INFO_GROUPS = [['Sensors', ['sensor']], ['Binary sensors', ['binary_sensor']], ['Climate', ['climate']], ['Weather', ['weather']], ['Lights', ['light']], ['Switches', ['switch']]];
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const slug = (t) => String(t || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// What a room page made from a Home Assistant area starts with, in this order.
const AREA_ORDER = ['climate', 'water_heater', 'lock', 'light', 'switch', 'fan', 'input_boolean', 'cover', 'sensor'];
const TILE_DOMAINS = ['light', 'climate', 'water_heater', 'lock', 'switch', 'input_boolean', 'fan', 'cover', 'scene', 'script', 'button', 'sensor', 'binary_sensor', 'automation'];

function defaultSettings(store) {
  const ids = (d, n) => store.list([d]).slice(0, n).map((s) => s.entity_id);
  const ents = [...ids('climate', 1), ...ids('water_heater', 1), ...ids('lock', 1), ...ids('light', 5)];
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
    this.buildShell();
    this.renderFace();
    this.renderRooms();
    this.goTo(this.startIndex(), true);
    document.body.classList.remove('loading');
    // Icons load in the background; tiles switch to their Home Assistant / custom icons when ready.
    loadMdi().then(() => this.rooms.forEach((r) => r.render()));

    this.store.addEventListener('settings', (e) => {
      if (!e.detail.external) return;
      this.renderFace(); this.renderRooms();
    });
    this.store.addEventListener('status', () => this.showStatus());
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
    setInterval(() => this.applyDim(), 20000);
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
  updateScreen(fn) {
    this.update((s) => { s.screens ||= {}; const sc = s.screens[this.screenId] ||= {}; fn(sc); sc.seen = Date.now(); });
  }
  startIndex() {
    const sp = this.screen.startPage;
    if (!sp || sp === 'clock') return 0;
    const i = this.settings.pages.findIndex((p) => p.id === sp);
    return i >= 0 ? i + 1 : 0;
  }
  update(mut) { const s = clone(this.settings); mut(s); this.store.saveSettings(s); return s; }

  // ------------------------------------------------------------------ shell
  buildShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    this.facePage = h('section.page.face-page');
    this.pager = h('div.pager', {}, this.facePage);
    this.rooms = [];
    this.dots = h('div.pager-dots');
    this.dim = h('div.dim');
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
    app.append(this.pager, this.dots, this.navPrev, this.navNext, this.clockBar, this.dim, this.statusPill);
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
  roomFor(pageId) { return this.rooms.find((r) => r.pageId === pageId); }
  get currentRoom() { return this.rooms[this.page - 1] || null; }
  goToRoom(pageId) { const i = this.settings.pages.findIndex((p) => p.id === pageId); if (i >= 0) this.goTo(i + 1); }

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
  faceTap() {
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
    opts.append(h('div.cz-group', { text: 'Home Assistant' }));
    const tapGroups = def.needsTap ? TAP_GROUPS.slice(0, 2) : TAP_GROUPS;
    opts.append(row(def.needsTap ? 'Light' : 'Tap the face to', entitySelect(this.store, work.tap, tapGroups, (v) => change(() => { work.tap = v; }), def.needsTap ? 'Choose…' : 'Do nothing'),
      def.needsTap ? 'The bulb glows when it’s on' : 'Toggle a light, switch or scene'));
    opts.append(row('Top-left info', entitySelect(this.store, work.tl, INFO_GROUPS, (v) => change(() => { work.tl = v; }))));
    opts.append(row('Top-right info', entitySelect(this.store, work.tr, INFO_GROUPS, (v) => change(() => { work.tr = v; }))));

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
      if (!pageOf(s, editPage)) editPage = s.pages[0]?.id;
      const pg = pageOf(s, editPage);
      sh.body.innerHTML = '';

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
        pagesList.append(h('div.ent-row' + (p.id === editPage ? '.sel' : ''), {},
          h('span.ent-ic', { html: icon(i === 0 ? 'home' : 'grid') }),
          h('input.text-in.name-in', { value: p.name, 'aria-label': 'Page name', onchange: (e) => {
            const v = e.target.value.trim(); if (!v) return;
            this.update((x) => { pageOf(x, p.id).name = v; }); this.renderRooms(); render();
          } }),
          h('span.ent-sub.count', { text: `${p.entities.length} tile${p.entities.length === 1 ? '' : 's'}` }),
          h('button.pill.sm' + (p.id === editPage ? '.primary' : ''), { text: p.id === editPage ? 'Editing' : 'Edit', onclick: () => { editPage = p.id; openTile = null; render(); } }),
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
      const L = pg.layout || {};
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
          h('button.size-badge' + (isOpen ? '.on' : ''), { text: `${Math.min(w, cols)} × ${hh}`, 'aria-label': 'Tile options', onclick: () => { openTile = isOpen ? null : i; render(); } }),
          h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Move up', disabled: i === 0, onclick: () => { openTile = null; upd((a) => a.splice(i - 1, 0, a.splice(i, 1)[0])); } }),
          h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Move down', disabled: i === ents.length - 1, onclick: () => { openTile = null; upd((a) => a.splice(i + 1, 0, a.splice(i, 1)[0])); } }),
          h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => { openTile = null; upd((a) => a.splice(i, 1)); } })));
        if (isOpen) list.append(h('div.ent-edit', {}, ...this.tileOptionRows(editPage, i, render),
          h('button.pill.sm', { html: icon('plus') + '<span>Add another copy</span>', onclick: () => { upd((a) => a.splice(i + 1, 0, { id })); toast('Added a copy. Give it a different style or size.'); } })));
      });
      if (!ents.length) list.append(h('div.ent-empty', { text: 'No tiles on this page yet.' }));
      const hasAllOff = ents.some((e) => e.id === ALL_OFF);
      const tilesSec = section(`Tiles on “${pg.name}”`,
        h('button.pill.wide.primary', { html: icon('grid') + '<span>Edit layout on screen</span>', onclick: () => { sh.close(); this.goToRoom(editPage); this.roomFor(editPage)?.setEditing(true); } }),
        list,
        h('button.pill.wide', { html: icon('plus') + '<span>Add tiles</span>', onclick: () => this.entityBrowser(editPage, () => { render(); refreshRoom(); }) }),
        row('“All lights off” tile', toggle(hasAllOff, (v) => upd((a) => { const k = a.findIndex((e) => e.id === ALL_OFF); if (v && k < 0) a.push({ id: ALL_OFF }); if (!v && k >= 0) a.splice(k, 1); })), 'Turns off every light on this page'));
      const setL = (k, v) => { this.update((x) => { const p2 = pageOf(x, editPage); p2.layout = { ...(p2.layout || {}), [k]: v }; }); refreshRoom(); render(); };
      const layoutSec = section(`Grid on “${pg.name}”`,
        row('Columns across', segmented([{ v: null, label: 'Auto' }, ...[3, 4, 5, 6, 7, 8].map((v) => ({ v, label: String(v) }))], L.cols ?? null, (v) => setL('cols', v)), 'More columns = smaller tiles'),
        row('Rows per screen', segmented([{ v: null, label: 'Auto' }, ...[2, 3, 4, 5, 6].map((v) => ({ v, label: String(v) }))], L.rows ?? null, (v) => setL('rows', v)), 'Taller tiles can span several rows'));

      // ---------------- Everywhere
      const g = s.general;
      const clockSec = section('Clock (all screens)',
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
      sh.body.append(screenSec, pagesSec, tilesSec, layoutSec, clockSec, dimSec, aboutSec);
    };
    render();
  }

  /** Rows for a tile's options (name, style, icon, size). Used inline in Settings and in the tile Options panel. */
  tileOptionRows(pageId, i, after) {
    const item = pageOf(this.settings, pageId)?.entities?.[i];
    if (!item) return [];
    const set = (fn) => { this.update((x) => { const it = pageOf(x, pageId)?.entities?.[i]; if (it) fn(it); }); this.roomFor(pageId)?.render(); after?.(); };
    const rows = [];
    rows.push(row('Name', h('input.text-in.wide-in', { value: item.name || '', placeholder: tileName(this.store, { id: item.id }), onchange: (e) => set((it) => { const v = e.target.value.trim(); if (v) it.name = v; else delete it.name; }) }), 'Leave empty to use the name from Home Assistant'));
    const styles = stylesFor(item.id);
    if (styles.length) {
      const cur = styleOf(item);
      rows.push(row('Style', segmented(styles.map((x) => ({ v: x.v, label: x.label })), cur, (v) => set((it) => { it.style = v; delete it.timer; })), styles.find((x) => x.v === cur)?.sub));
    }
    const haIcon = item.id !== ALL_OFF && this.store.get(item.id)?.attributes?.icon;
    rows.push(row('Icon', h('div.icon-ctl', {},
      h('span.icon-prev', { html: iconHtml(this.store, item, tileIcon(item.id)) }),
      h('button.pill.sm', { text: 'Choose…', onclick: () => this.iconPicker(item.icon || haIcon, (name) => set((it) => { if (name) it.icon = name; else delete it.icon; })) }),
      item.icon ? h('button.pill.sm', { text: 'Reset', onclick: () => set((it) => { delete it.icon; }) }) : null),
    item.icon || (haIcon ? `${haIcon} (from Home Assistant)` : 'Built-in icon')));
    const cols = this.roomFor(pageId)?.cols || 5;
    const [w, hh] = sizeOf(item);
    rows.push(row('Width (columns)', segmented(Array.from({ length: Math.min(cols, 8) }, (_, k) => ({ v: k + 1, label: String(k + 1) })), Math.min(w, cols), (v) => set((it) => { it.w = v; }))));
    rows.push(row('Height (rows)', segmented([1, 2, 3, 4].map((v) => ({ v, label: String(v) })), hh, (v) => set((it) => { it.h = v; }))));
    return rows;
  }

  /** A panel with one tile's options (opened from Edit layout). */
  tileOptions(pageId, i) {
    const first = pageOf(this.settings, pageId)?.entities?.[i];
    if (!first) return;
    const sh = sheet({ title: tileName(this.store, first), cls: 'tile-sheet' });
    const render = () => {
      const it = pageOf(this.settings, pageId)?.entities?.[i];
      if (!it) return sh.close();
      sh.setTitle(tileName(this.store, it));
      sh.body.innerHTML = '';
      sh.body.append(...this.tileOptionRows(pageId, i, render), h('div.sheet-actions', {},
        h('button.pill', { html: icon('plus') + '<span>Add another copy</span>', onclick: () => {
          this.update((x) => { pageOf(x, pageId).entities.splice(i + 1, 0, { id: it.id }); });
          this.roomFor(pageId)?.render(); toast('Added a copy next to it. Give it a different style or size.');
        } }),
        h('button.pill.danger-pill', { text: 'Remove tile', onclick: () => { this.update((x) => { pageOf(x, pageId).entities.splice(i, 1); }); this.roomFor(pageId)?.render(); sh.close(); } })));
    };
    render();
  }

  /** Searchable picker over Material Design Icons. onPick('mdi:name'). */
  async iconPicker(current, onPick) {
    const sh = sheet({ title: 'Choose an icon', cls: 'icon-sheet' });
    const search = h('input.search', { type: 'search', placeholder: 'Search 7,000+ icons: lamp, sofa, tv, fan…', autocomplete: 'off', autocapitalize: 'off' });
    const grid = h('div.icon-grid', {}, h('div.ent-empty', { text: 'Loading icons…' }));
    sh.body.append(search, h('div.about.small', { text: 'Material Design Icons, the same set Home Assistant uses. You can paste a name like mdi:ceiling-light.' }), grid);
    await loadMdi();
    const render = () => {
      const q = search.value.trim().toLowerCase().replace(/^mdi:/, '');
      let names;
      if (!q) names = SUGGESTED.filter(mdiHas);
      else {
        const words = q.split(/[\s-]+/).filter(Boolean);
        names = mdiNames().filter((n) => words.every((w) => n.includes(w)));
        names.sort((a, b) => (a === q ? -1 : b === q ? 1 : 0) || (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1) || a.length - b.length);
        names = names.slice(0, 180);
      }
      grid.innerHTML = '';
      for (const n of names) {
        const b = h('button.icon-cell' + (current === 'mdi:' + n ? '.on' : ''), { title: 'mdi:' + n, onclick: () => { onPick('mdi:' + n); sh.close(); } });
        b.innerHTML = mdiSvg(n) + `<span>${n}</span>`;
        grid.append(b);
      }
      if (!names.length) grid.append(h('div.ent-empty', { text: 'No icons match.' }));
    };
    search.addEventListener('input', render);
    render();
    if (document.body.classList.contains('mouse')) setTimeout(() => search.focus(), 60);
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
    const groups = [['all', 'All'], ['light', 'Lights'], ['climate', 'Climate'], ['switch', 'Switches'], ['lock', 'Locks'], ['cover', 'Covers'], ['sensor', 'Sensors'], ['scene', 'Scenes'], ['other', 'Other']];
    const MAIN = ['light', 'climate', 'switch', 'lock', 'cover', 'sensor', 'scene'];
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
    if (!limit) return;
    const anyOverlay = document.querySelector('.overlay, .sheet-backdrop');
    if (anyOverlay && idle > Math.max(limit, 120)) {
      document.querySelectorAll('.sheet-backdrop').forEach((b) => b.remove());
      document.querySelectorAll('.overlay.customize, .overlay.gallery').forEach((o) => o.remove());
      this.gallery = null;
      this.closePicker();
    }
    if (this.page >= 1 && !anyOverlay && !this.rooms.some((r) => r.editing) && idle > limit) this.goTo(0);
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
