// Facewall app shell: pager (clock ⇄ home), face picker, customize, gallery, settings.
import { Store, domainOf, isOn } from './data.js';
import { FACES, FACE_ORDER, mountFace } from './faces.js';
import { HomePage, TIMER_OK, ALL_OFF, tileName, tileIcon, sizeOf } from './home.js';
import { icon, domainIcon } from './icons.js';
import { h, press, sheet, toast, toggle, segmented, swatches, row, entitySelect } from './ui.js';

const uid = () => Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));
const TAP_GROUPS = [['Lights', ['light']], ['Switches', ['switch', 'input_boolean']], ['Fans', ['fan']], ['Scenes', ['scene']], ['Scripts', ['script']], ['Covers', ['cover']]];
const INFO_GROUPS = [['Sensors', ['sensor']], ['Binary sensors', ['binary_sensor']], ['Climate', ['climate']], ['Weather', ['weather']], ['Lights', ['light']], ['Switches', ['switch']]];
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
    dashboard: { entities: [...ents, ...(ents.filter((e) => domainOf(e) === 'light').length >= 2 ? [ALL_OFF] : [])].map((id) => ({ id })), timerMinutes: [15, 30, 45, 60] },
    layout: { cols: null, rows: null },
    general: { use24h: hc === 'h23' || hc === 'h24', idleSec: 60, startPage: 'face', dim: { on: false, from: '23:00', to: '06:30', level: 0.55 } },
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
  if (!s.layout) { s.layout = { cols: null, rows: null }; changed = true; }
  return changed;
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
    this.buildShell();
    this.renderFace();
    this.home.render();
    this.goTo(this.settings.general.startPage === 'home' ? 1 : 0, true);
    document.body.classList.remove('loading');

    this.store.addEventListener('settings', (e) => {
      if (!e.detail.external) return;
      this.renderFace(); this.home.render();
    });
    this.store.addEventListener('status', () => this.showStatus());
    this.store.addEventListener('error', (e) => toast(e.detail, 'error'));
    this.showStatus();

    window.addEventListener('resize', () => { clearTimeout(this.rt); this.rt = setTimeout(() => { this.renderFace(); this.goTo(this.page, true); }, 150); });
    document.addEventListener('pointerdown', () => { this.lastActivity = Date.now(); this.wake(); }, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.wake(true); });
    setInterval(() => this.idleCheck(), 2000);
    setInterval(() => this.applyDim(), 20000);
    this.applyDim();
  }

  get settings() { return this.store.settings; }
  update(mut) { const s = clone(this.settings); mut(s); this.store.saveSettings(s); return s; }

  // ------------------------------------------------------------------ shell
  buildShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    this.facePage = h('section.page.face-page');
    this.homePage = h('section.page.home-page');
    this.pager = h('div.pager', {}, this.facePage, this.homePage);
    this.dots = h('div.pager-dots', {}, h('span'), h('span'));
    this.dim = h('div.dim');
    this.faceToast = h('div.face-toast');
    this.facePage.append(this.faceToast);
    this.statusPill = h('div.status-pill');
    app.append(this.pager, this.dots, this.dim, this.statusPill);
    this.pager.addEventListener('scroll', () => {
      const p = Math.round(this.pager.scrollLeft / Math.max(1, this.pager.clientWidth));
      if (p !== this.page) { this.page = p; this.onPage(); }
      this.dots.classList.add('show'); clearTimeout(this.dt);
      this.dt = setTimeout(() => this.dots.classList.toggle('show', this.page === 1), 1200);
    }, { passive: true });
    press(this.facePage, { onTap: () => this.faceTap(), onLong: () => this.openPicker() });
    this.home = new HomePage(this.homePage, this.store, this);
  }

  goTo(p, instant) {
    this.page = p;
    this.pager.scrollTo({ left: p * this.pager.clientWidth, behavior: instant ? 'auto' : 'smooth' });
    this.onPage();
  }
  onPage() {
    [...this.dots.children].forEach((d, i) => d.classList.toggle('on', i === this.page));
    this.dots.classList.toggle('show', this.page === 1);
    if (this.face) this.face.paused = this.page !== 0;
    if (this.page === 0 && this.home?.editing) this.home.setEditing(false);
  }

  // ------------------------------------------------------------------ live face
  activeFace() {
    const s = this.settings;
    return s.faces.find((f) => f.id === s.active) || s.faces[0];
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
      if (!this.hinted) { this.hinted = true; this.showFaceToast(null, 'Hold to change the face', 'Swipe left for Home'); }
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
      track, h('div.pk-foot', {}, dots, h('div.pk-actions', {}, trash, custom)));
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
      const idx = Math.max(0, faces.findIndex((f) => f.id === (focusId || this.settings.active)));
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
      });
      this.renderFace();
      build(s.faces[Math.min(this.picker.index, s.faces.length - 1)].id);
    };
    custom.onclick = () => { const f = this.settings.faces[this.picker.index]; if (f) this.openCustomize(f, 'edit'); };
    this.picker.build = build;
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
    this.update((s) => { s.active = id; });
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
        this.update((s) => { s.faces.push(clone(work)); s.active = work.id; });
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
  openSettings(section) {
    const sh = sheet({ title: 'Settings', cls: 'settings-sheet' });
    let openTile = null;
    const render = () => {
      const s = this.settings;
      sh.body.innerHTML = '';
      // Tiles
      const list = h('div.ent-list');
      const L = s.layout || {};
      const cols = this.home.cols || 5;
      s.dashboard.entities.forEach((item, i) => {
        const id = item.id, d = domainOf(id);
        const area = id === ALL_OFF ? '' : this.store.area(id);
        const [w, hh] = sizeOf(item);
        const mv = (dir) => { this.update((x) => { const a = x.dashboard.entities; const [it] = a.splice(i, 1); a.splice(i + dir, 0, it); }); render(); this.home.render(); };
        const set = (fn) => { this.update((x) => fn(x.dashboard.entities[i])); render(); this.home.render(); };
        const isOpen = openTile === id;
        list.append(h('div.ent-row', {},
          h('span.ent-ic', { html: icon(tileIcon(id)) }),
          h('div.ent-text', {}, h('div.ent-name', { text: tileName(this.store, id) }), h('div.ent-sub', { text: id === ALL_OFF ? 'Turns off every light on this page' : [area, id].filter(Boolean).join('  ·  ') })),
          h('button.size-badge' + (isOpen ? '.on' : ''), { text: `${Math.min(w, cols)} × ${hh}`, 'aria-label': 'Tile size', onclick: () => { openTile = isOpen ? null : id; render(); } }),
          h('button.icon-btn.sm', { html: icon('up'), 'aria-label': 'Move up', disabled: i === 0, onclick: () => mv(-1) }),
          h('button.icon-btn.sm', { html: icon('down'), 'aria-label': 'Move down', disabled: i === s.dashboard.entities.length - 1, onclick: () => mv(1) }),
          h('button.icon-btn.sm.danger', { html: icon('close'), 'aria-label': 'Remove', onclick: () => { this.update((x) => { x.dashboard.entities.splice(i, 1); }); render(); this.home.render(); } })));
        if (isOpen) {
          const widths = Array.from({ length: Math.min(cols, 8) }, (_, k) => ({ v: k + 1, label: String(k + 1) }));
          list.append(h('div.ent-edit', {},
            row('Width (columns)', segmented(widths, Math.min(w, cols), (v) => set((it) => { it.w = v; }))),
            row('Height (rows)', segmented([1, 2, 3, 4].map((v) => ({ v, label: String(v) })), hh, (v) => set((it) => { it.h = v; }))),
            TIMER_OK(id) && d !== 'water_heater' ? row('Timer buttons', toggle(item.timer, (v) => set((it) => { it.timer = v; })), 'Show 15/30/45/60-minute buttons') : null));
        }
      });
      if (!s.dashboard.entities.length) list.append(h('div.ent-empty', { text: 'No tiles yet.' }));
      const hasAllOff = s.dashboard.entities.some((e) => e.id === ALL_OFF);
      const tilesSec = h('section.set-sec', {},
        h('div.set-title', { text: 'Home page tiles' }),
        h('button.pill.wide.primary', { html: icon('grid') + '<span>Edit layout on screen</span>', onclick: () => { sh.close(); this.goTo(1); this.home.setEditing(true); } }),
        list,
        h('button.pill.wide', { html: icon('plus') + '<span>Add tiles</span>', onclick: () => this.entityBrowser(() => { render(); this.home.render(); }) }),
        row('“All lights off” tile', toggle(hasAllOff, (v) => { this.update((x) => { const a = x.dashboard.entities; const k = a.findIndex((e) => e.id === ALL_OFF); if (v && k < 0) a.push({ id: ALL_OFF }); if (!v && k >= 0) a.splice(k, 1); }); render(); this.home.render(); }), 'Turns off every light on this page'),
        row('Timer buttons (minutes)', h('input.text-in', { value: (s.dashboard.timerMinutes || []).join(', '), inputmode: 'numeric', onchange: (e) => {
          const mins = e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0 && n <= 1440).slice(0, 5);
          if (mins.length) { this.update((x) => { x.dashboard.timerMinutes = mins; }); this.home.render(); }
        } })));
      const setL = (k, v) => { this.update((x) => { x.layout = { ...(x.layout || {}), [k]: v }; }); this.home.render(); render(); };
      const layoutSec = h('section.set-sec', {},
        h('div.set-title', { text: 'Grid' }),
        row('Columns across', segmented([{ v: null, label: 'Auto' }, ...[3, 4, 5, 6, 7, 8].map((v) => ({ v, label: String(v) }))], L.cols ?? null, (v) => setL('cols', v)), 'More columns = smaller tiles'),
        row('Rows per screen', segmented([{ v: null, label: 'Auto' }, ...[2, 3, 4, 5, 6].map((v) => ({ v, label: String(v) }))], L.rows ?? null, (v) => setL('rows', v)), 'Taller tiles can span several rows'));
      // Clock
      const g = s.general;
      const clockSec = h('section.set-sec', {},
        h('div.set-title', { text: 'Clock' }),
        row('24-hour time', toggle(g.use24h, (v) => { this.update((x) => { x.general.use24h = v; }); this.renderFace(); this.home.tick(); })),
        row('Go back to the clock after', segmented([{ v: 0, label: 'Never' }, { v: 30, label: '30s' }, { v: 60, label: '1m' }, { v: 120, label: '2m' }, { v: 300, label: '5m' }], g.idleSec, (v) => this.update((x) => { x.general.idleSec = v; })), 'when nobody touches the screen'),
        row('Open on', segmented([{ v: 'face', label: 'Clock' }, { v: 'home', label: 'Home' }], g.startPage, (v) => this.update((x) => { x.general.startPage = v; }))));
      // Night dim
      const dim = g.dim || {};
      const dimSec = h('section.set-sec', {},
        h('div.set-title', { text: 'Night dimming' }),
        row('Dim the screen at night', toggle(dim.on, (v) => { this.update((x) => { x.general.dim = { ...dim, on: v }; }); this.applyDim(); render(); })),
        dim.on ? row('From', h('input.time-in', { type: 'time', value: dim.from || '23:00', onchange: (e) => { this.update((x) => { x.general.dim.from = e.target.value; }); this.applyDim(); } })) : null,
        dim.on ? row('Until', h('input.time-in', { type: 'time', value: dim.to || '06:30', onchange: (e) => { this.update((x) => { x.general.dim.to = e.target.value; }); this.applyDim(); } })) : null,
        dim.on ? row('How dark', segmented([{ v: 0.35, label: 'A little' }, { v: 0.55, label: 'Medium' }, { v: 0.75, label: 'Very' }], dim.level ?? 0.55, (v) => { this.update((x) => { x.general.dim.level = v; }); this.applyDim(); })) : null);
      // About
      const st = this.store.status;
      const conn = this.store.mode === 'demo' ? 'Demo mode — not connected to Home Assistant'
        : st.connected ? `Connected to Home Assistant${st.haVersion ? ' ' + st.haVersion : ''}` : `Not connected${st.error ? ': ' + st.error : ''}`;
      const aboutSec = h('section.set-sec', {}, h('div.set-title', { text: 'Connection' }), h('div.about', { text: conn }),
        h('div.about.small', { text: 'Tip: long-press the clock to change faces. Swipe left for Home.' }));
      sh.body.append(tilesSec, layoutSec, clockSec, dimSec, aboutSec);
    };
    render();
    if (section === 'tiles') this.entityBrowser(() => { render(); this.home.render(); });
  }

  entityBrowser(onChange) {
    const sh = sheet({ title: 'Add tiles', cls: 'browser-sheet' });
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
      const chosen = new Set(this.settings.dashboard.entities.map((e) => e.id));
      list.innerHTML = '';
      const items = this.store.list(TILE_DOMAINS).filter((s) => {
        const d = domainOf(s.entity_id);
        if (filter === 'other' ? MAIN.includes(d) : filter !== 'all' && d !== filter && !(filter === 'switch' && d === 'input_boolean') && !(filter === 'climate' && d === 'water_heater') && !(filter === 'sensor' && d === 'binary_sensor') && !(filter === 'scene' && d === 'script')) return false;
        if (!q) return true;
        return (this.store.name(s.entity_id) + ' ' + s.entity_id + ' ' + this.store.area(s.entity_id)).toLowerCase().includes(q);
      }).slice(0, 300);
      for (const s of items) {
        const id = s.entity_id, on = chosen.has(id);
        const rowEl = h('button.ent-row.pickable' + (on ? '.on' : ''), {},
          h('span.ent-ic', { html: icon(domainIcon(domainOf(id), isOn(s))) }),
          h('div.ent-text', {}, h('div.ent-name', { text: this.store.name(id) }), h('div.ent-sub', { text: [this.store.area(id), id].filter(Boolean).join('  ·  ') })),
          h('span.ent-check', { html: icon(on ? 'check' : 'plus') }));
        rowEl.onclick = () => {
          this.update((x) => {
            const a = x.dashboard.entities;
            const i = a.findIndex((e) => e.id === id);
            if (i >= 0) a.splice(i, 1); else a.push({ id });
          });
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
    if (this.page === 1 && !anyOverlay && !this.home.editing && idle > limit) this.goTo(0);
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
