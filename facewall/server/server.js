// Facewall server — serves the iPad UI and bridges it to Home Assistant.
// Zero dependencies: Node 22+ (built-in WebSocket client).
//
// Runs two ways:
//   1. As a Home Assistant app (add-on): uses SUPERVISOR_TOKEN automatically.
//   2. Standalone (Docker / node): set HA_URL and HA_TOKEN (long-lived access token).

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const VERSION = '1.55.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(__dirname, '..', 'www');
const PORT = Number(process.env.PORT || 8099);
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.resolve(__dirname, '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TIMERS_FILE = path.join(DATA_DIR, 'timers.json');
const ICONS_DIR = path.join(DATA_DIR, 'icons'); // icons uploaded from Facewall
fs.mkdirSync(ICONS_DIR, { recursive: true });
// Home Assistant's custom_icons folder (the one hass-fontawesome uses for "fapro:" icons), read-only.
const FOLDER_ICON_DIRS = [process.env.CUSTOM_ICONS_DIR, '/homeassistant/custom_icons', '/config/custom_icons'].filter(Boolean);

// Photo frame: folders the app can read photos from (Home Assistant's media and share folders, or PHOTOS_DIR).
const PHOTO_ROOTS = Object.fromEntries([['media', '/media'], ['share', '/share'], ['photos', process.env.PHOTOS_DIR]].filter(([, d]) => d && fs.existsSync(d)));
const PHOTO_EXT = /\.(jpe?g|png|webp|gif|heic|avif)$/i;
function photoPath(rel) {
  const [root, ...rest] = String(rel || '').split('/').filter(Boolean);
  const base = PHOTO_ROOTS[root];
  if (!base || rest.some((x) => x === '..' || x.startsWith('.'))) return null;
  const full = path.resolve(base, ...rest);
  return full === base || full.startsWith(base + path.sep) ? full : null;
}
async function listPhotos(folder) {
  const start = photoPath(folder);
  if (!start) return null;
  const out = [];
  const walk = async (dir, depth) => {
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= 3000 || e.name.startsWith('.') || e.name.startsWith('@')) continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory() && depth < 4) await walk(f, depth + 1);
      else if (e.isFile() && PHOTO_EXT.test(e.name)) out.push(path.posix.join(folder.replace(/\/+$/, ''), path.relative(start, f).split(path.sep).join('/')));
    }
  };
  await walk(start, 0);
  return out.sort();
}

// When each photo was taken: the camera's EXIF date, a date in the file name, or the file's own time.
// Remembered (by path and modification time) in photo-dates.json so it is worked out only once.
const PHOTO_DATES_FILE = path.join(DATA_DIR, 'photo-dates.json');
let photoDates = null, photoDatesDirty = false;
function loadPhotoDates() {
  if (photoDates) return photoDates;
  try { photoDates = JSON.parse(fs.readFileSync(PHOTO_DATES_FILE, 'utf8')); } catch { photoDates = {}; }
  return photoDates;
}
function savePhotoDatesSoon() {
  if (photoDatesDirty) return;
  photoDatesDirty = true;
  setTimeout(() => { photoDatesDirty = false; fs.writeFile(PHOTO_DATES_FILE, JSON.stringify(photoDates), () => {}); }, 5000);
}
/** "YYYY:MM:DD HH:MM:SS" from a JPEG's EXIF (DateTimeOriginal, else DateTime), or null. */
function exifDate(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1 && buf.toString('ascii', i + 4, i + 10) === 'Exif\0\0') {
      const t = i + 10;
      const le = buf.toString('ascii', t, t + 2) === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(t + o) : buf.readUInt16BE(t + o));
      const u32 = (o) => (le ? buf.readUInt32LE(t + o) : buf.readUInt32BE(t + o));
      const read = (ifd, want) => {
        if (t + ifd + 2 > buf.length) return {};
        const n = u16(ifd), out = {};
        for (let k = 0; k < n; k++) {
          const e = ifd + 2 + k * 12;
          if (t + e + 12 > buf.length) break;
          const tag = u16(e);
          if (want.includes(tag)) out[tag] = { type: u16(e + 2), count: u32(e + 4), off: u32(e + 8) };
        }
        return out;
      };
      const str = (en) => (en && en.count >= 19 && t + en.off + 19 <= buf.length ? buf.toString('ascii', t + en.off, t + en.off + 19) : null);
      const ifd0 = read(u32(4), [0x0132, 0x8769]);
      if (ifd0[0x8769]) { const ex = read(ifd0[0x8769].off, [0x9003, 0x9004]); const d = str(ex[0x9003]) || str(ex[0x9004]); if (d) return d; }
      return str(ifd0[0x0132]);
    }
    if (marker === 0xda) return null;
    i += 2 + len;
  }
  return null;
}
function parseExif(d) {
  const m = d && d.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m || m[1] === '0000') return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return Number.isFinite(t) ? t : null;
}
function nameDate(name) {
  const m = name.match(/(?:^|[^0-9])((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?![0-9]{3})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12).getTime() : null;
}
async function photoDate(rel) {
  const full = photoPath(rel);
  if (!full) return null;
  let st;
  try { st = await fsp.stat(full); } catch { return null; }
  const cache = loadPhotoDates(), key = rel, hit = cache[key];
  if (hit && hit[0] === st.mtimeMs) return hit[1];
  let t = null;
  if (/\.jpe?g$/i.test(full)) {
    try {
      const fh = await fsp.open(full, 'r');
      const buf = Buffer.alloc(Math.min(131072, st.size));
      await fh.read(buf, 0, buf.length, 0); await fh.close();
      t = parseExif(exifDate(buf));
    } catch { /* unreadable: fall back */ }
  }
  t ??= nameDate(path.basename(full)) ?? Math.round(st.mtimeMs);
  cache[key] = [st.mtimeMs, t];
  savePhotoDatesSoon();
  return t;
}

const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN || '';
const HA_URL = (process.env.HA_URL || '').replace(/\/+$/, '');
const TOKEN = SUPERVISOR_TOKEN || process.env.HA_TOKEN || '';
const WS_URL = SUPERVISOR_TOKEN
  ? 'ws://supervisor/core/websocket'
  : HA_URL ? HA_URL.replace(/^http/i, 'ws') + '/api/websocket' : '';

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------- persistence
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
async function writeJSON(file, data) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, file);
}

let store = readJSON(SETTINGS_FILE, { rev: 0, settings: null });
let timers = readJSON(TIMERS_FILE, {}); // entity_id -> { end, minutes }

// ---------------------------------------------------------------- SSE clients
const clients = new Set();
function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(event, data) {
  for (const res of clients) send(res, event, data);
}

// ---------------------------------------------------------------- Home Assistant link
const ha = {
  ws: null,
  connected: false,
  version: null,
  nextId: 1,
  pending: new Map(),
  subs: new Map(),      // subscription id -> handler(event)
  fcSubs: new Map(),    // "weather.x|daily" -> subscription id
  forecasts: {},        // weather entity -> { daily: [...], hourly: [...] }
  states: new Map(),
  areas: {},        // entity_id -> area name
  backoff: 1000,
  lastError: WS_URL ? null : 'No Home Assistant connection configured (set HA_URL and HA_TOKEN).',
};

function haSend(msg) {
  if (!ha.ws || ha.ws.readyState !== 1) throw new Error('Not connected to Home Assistant');
  ha.ws.send(JSON.stringify(msg));
}
function haRequest(msg, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = ha.nextId++;
    const timer = setTimeout(() => { ha.pending.delete(id); reject(new Error('Home Assistant timed out')); }, timeoutMs);
    ha.pending.set(id, { resolve, reject, timer });
    try { haSend({ ...msg, id }); } catch (e) { clearTimeout(timer); ha.pending.delete(id); reject(e); }
  });
}

/** Subscribe to something that streams events (state changes, forecasts). Resolves with the subscription id. */
function haSubscribe(msg, onEvent, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const id = ha.nextId++;
    ha.subs.set(id, onEvent);
    const timer = setTimeout(() => { ha.pending.delete(id); ha.subs.delete(id); reject(new Error('Home Assistant timed out')); }, timeoutMs);
    ha.pending.set(id, { resolve: () => resolve(id), reject: (e) => { ha.subs.delete(id); reject(e); }, timer });
    try { haSend({ ...msg, id }); } catch (e) { clearTimeout(timer); ha.pending.delete(id); ha.subs.delete(id); reject(e); }
  });
}

function haConnect() {
  if (!WS_URL) { log(ha.lastError); return; }
  if (ha.backoff <= 2000) log('Connecting to Home Assistant at', WS_URL);
  let ws, done = false, openTimer = null;
  // Node's WebSocket may report a failed connection with 'error' and never 'close',
  // so every failure path funnels through here exactly once.
  const fail = (why) => {
    if (done) return; done = true;
    clearTimeout(openTimer);
    try { ws && ws.close(); } catch { /* already closed */ }
    if (ha.ws === ws) ha.ws = null;
    if (ha.fail === fail) ha.fail = null;
    const was = ha.connected;
    ha.connected = false;
    for (const p of ha.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Connection lost')); }
    ha.pending.clear();
    ha.subs.clear(); ha.fcSubs.clear();
    if (was) { log('Disconnected from Home Assistant' + (why ? ` (${why})` : '')); broadcast('status', status()); }
    else if (why && why !== ha.lastError) { ha.lastError = why; log(why + ' — retrying'); }
    scheduleReconnect();
  };
  try { ws = new WebSocket(WS_URL); } catch (e) { return fail(e.message); }
  ha.ws = ws; ha.fail = fail;
  openTimer = setTimeout(() => { if (ws.readyState !== 1) fail('Timed out connecting to Home Assistant'); }, 15000);
  ws.onopen = () => clearTimeout(openTimer);
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    const list = Array.isArray(msg) ? msg : [msg];
    for (const m of list) handleMessage(m);
  };
  ws.onerror = () => { if (ws.readyState !== 1) fail('Cannot reach Home Assistant'); };
  ws.onclose = () => fail();
}
function scheduleReconnect() {
  setTimeout(haConnect, ha.backoff);
  ha.backoff = Math.min(ha.backoff * 2, 30000);
}
// Heartbeat: notice a silently dropped connection.
setInterval(() => {
  if (!ha.connected) return;
  haRequest({ type: 'ping' }, 10000).catch(() => ha.fail && ha.fail('No reply to ping'));
}, 30000);

function handleMessage(m) {
  switch (m.type) {
    case 'auth_required':
      ha.version = m.ha_version;
      ha.ws.send(JSON.stringify({ type: 'auth', access_token: TOKEN }));
      break;
    case 'auth_invalid':
      log('Home Assistant rejected the token: ' + (m.message || ''));
      ha.fail && ha.fail('Home Assistant rejected the access token');
      break;
    case 'pong': {
      const p = ha.pending.get(m.id);
      if (p) { clearTimeout(p.timer); ha.pending.delete(m.id); p.resolve(true); }
      break;
    }
    case 'auth_ok':
      ha.version = m.ha_version || ha.version;
      onReady().catch((e) => { log('Setup failed:', e.message); ha.fail && ha.fail('Setup failed'); });
      break;
    case 'result': {
      const p = ha.pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer); ha.pending.delete(m.id);
      m.success ? p.resolve(m.result) : p.reject(new Error(m.error?.message || 'Home Assistant error'));
      break;
    }
    case 'event': {
      const handler = ha.subs.get(m.id);
      if (handler) handler(m.event);
      break;
    }
      break;
  }
}

async function onReady() {
  await haSubscribe({ type: 'subscribe_events', event_type: 'state_changed' }, (ev) => { if (ev?.event_type === 'state_changed') onStateChanged(ev.data); });
  const states = await haRequest({ type: 'get_states' });
  ha.states = new Map(states.map((s) => [s.entity_id, slim(s)]));
  ha.connected = true; ha.backoff = 1000; ha.lastError = null;
  log(`Connected to Home Assistant ${ha.version || ''} — ${ha.states.size} entities`);
  await loadAreas();
  syncForecasts();
  for (const res of clients) send(res, 'snapshot', snapshot());
  checkTimers();
}

async function loadAreas() {
  try {
    const [areas, devices, entities] = await Promise.all([
      haRequest({ type: 'config/area_registry/list' }),
      haRequest({ type: 'config/device_registry/list' }),
      haRequest({ type: 'config/entity_registry/list' }),
    ]);
    const areaName = Object.fromEntries(areas.map((a) => [a.area_id, a.name]));
    const devArea = Object.fromEntries(devices.map((d) => [d.id, d.area_id]));
    const map = {};
    for (const e of entities) {
      const aid = e.area_id || devArea[e.device_id];
      if (aid && areaName[aid]) map[e.entity_id] = areaName[aid];
    }
    ha.areas = map;
  } catch (e) {
    log('Could not read areas (names will still work):', e.message);
  }
}

function slim(s) {
  if (!s) return null;
  const { entity_id, state, attributes, last_changed } = s;
  const a = { ...attributes };
  delete a.forecast; delete a.entity_picture_local;
  return { entity_id, state, attributes: a, last_changed };
}

function watchedEntities() {
  const s = store.settings;
  if (!s) return null;
  const set = new Set();
  // Every page's tiles, and the tiles in each of its sections.
  const pageLists = (s.pages || []).flatMap((p) => [p.entities || [], ...(p.sections || []).map((x) => x.entities || [])]);
  const lists = [...pageLists, s.dashboard?.entities || []];
  for (const list of lists) for (const e of list) set.add(typeof e === 'string' ? e : e.id);
  for (const f of s.faces || []) for (const k of ['tap', 'tl', 'tr', 'bl', 'br']) if (f[k]) set.add(f[k]);
  // Whole domains some faces and features read.
  const addDomain = (d, test) => { for (const [id, st] of ha.states) if (id.startsWith(d + '.') && (!test || test(st))) set.add(id); };
  const types = new Set((s.faces || []).map((f) => f.type));
  if (types.has('sunclock') || types.has('sky')) { set.add('sun.sun'); addDomain('weather'); }
  if (types.has('board')) { addDomain('calendar'); addDomain('weather'); }
  if (types.has('family')) { addDomain('person'); for (const f of s.faces) if (f.type === 'family') for (const id of f.opts?.people || []) set.add(id); }
  // Sidebars: their readings (chosen, or the room's temperature and the weather).
  for (const p of s.pages || []) {
    for (const x of p.sideInfo || []) if (x?.id) set.add(x.id);
    if ((p.sections || []).length || p.sidebar === 'panel') { addDomain('weather'); addDomain('sensor', (st) => st.attributes?.device_class === 'temperature'); }
  }
  // Now-playing glow follows the media players.
  if (Object.values(s.screens || {}).some((sc) => sc?.glow?.on)) addDomain('media_player');
  if ((s.pages || []).some((p) => p.kind === 'music')) addDomain('media_player');
  for (const id of Object.keys(timers)) set.add(id);
  // Tiles' show-when rules and badges.
  for (const list of pageLists) for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    if (e.showWhen?.id) set.add(e.showWhen.id);
    if (e.badge?.k === 'entity' && e.badge.id) set.add(e.badge.id);
    if (e.badge?.k === 'lights') {
      const members = ha.states.get(e.id)?.attributes?.entity_id;
      if (Array.isArray(members)) members.forEach((m) => set.add(m));
      else { const area = ha.areas?.[e.id]; if (area) for (const [id, a] of Object.entries(ha.areas)) if (a === area && id.startsWith('light.')) set.add(id); }
    }
  }
  // Screens: motion sensors that wake them, and the sun for night themes.
  for (const sc of Object.values(s.screens || {})) {
    if (sc?.motion) set.add(sc.motion);
    if (sc?.night?.theme && sc.night.mode !== 'times') set.add('sun.sun');
  }
  // The doorbell pop-up: its trigger, camera and lock.
  for (const k of ['trigger', 'camera', 'lock']) if (s.doorbell?.[k]) set.add(s.doorbell[k]);
  // The page header: its weather entity, the sun, sensors and alert sensors.
  const WEATHER_PARTS = new Set(['now', 'highlow', 'feels', 'rain', 'wind', 'humidity', 'alerts']);
  const on = (s.header?.parts || [{ k: 'greeting', on: true }, { k: 'date', on: true }]).filter((p) => p && p.on);
  if (on.some((p) => WEATHER_PARTS.has(p.k)) || s.general?.fx?.weather !== false) {
    const w = s.header?.weather && ha.states.has(s.header.weather) ? s.header.weather : [...ha.states.keys()].find((id) => id.startsWith('weather.'));
    if (w) set.add(w);
  }
  if (on.some((p) => p.k === 'sun') || s.general?.tod?.on) set.add('sun.sun');
  for (const p of on) { if (p.k === 'sensor' && p.id) set.add(p.id); if (p.k === 'alerts') for (const e of p.entities || []) set.add(e); }
  return set;
}

function onStateChanged({ entity_id, new_state }) {
  if (new_state) ha.states.set(entity_id, slim(new_state)); else ha.states.delete(entity_id);
  const t = timers[entity_id];
  if (t && new_state && (new_state.state === 'off' || new_state.state === 'unavailable')) {
    delete timers[entity_id]; saveTimers();
  }
  const watched = watchedEntities();
  if (watched && !watched.has(entity_id)) return;
  broadcast('state', { id: entity_id, s: ha.states.get(entity_id) || null });
}

function status() {
  return { connected: ha.connected, haVersion: ha.version, error: ha.lastError, standalone: !SUPERVISOR_TOKEN };
}
function snapshot() {
  return { status: status(), states: [...ha.states.values()], areas: ha.areas, timers, forecasts: ha.forecasts, rev: store.rev };
}

// ---------------------------------------------------------------- your own icons (e.g. Font Awesome Pro SVGs)
// Only plain shapes survive: no scripts, styles, links, images or event handlers.
// Line icons keep their stroke settings; masks, clip paths and gradients are kept for icon sets that use them.
const SVG_TAGS = 'path|circle|rect|ellipse|line|polyline|polygon|g|defs|mask|clipPath|linearGradient|radialGradient|stop';
const SVG_CONTAINERS = new Set(['g', 'defs', 'mask', 'clippath', 'lineargradient', 'radialgradient']);
const SVG_CASE = { clippath: 'clipPath', lineargradient: 'linearGradient', radialgradient: 'radialGradient' };
const SVG_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'transform',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'id', 'mask', 'clip-path', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'fx', 'fy', 'fr', 'maskUnits', 'clipPathUnits'];
const SAFE_VALUE = /^[\w\s.,\-#%()]*$/;
function attrOf(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2]) : null;
}
function sanitizeSvg(text) {
  const open = String(text).match(/<svg\b[^>]*>/i);
  if (!open) return null;
  let vb = attrOf(open[0], 'viewBox');
  if (!vb || !/^[\d.\s,-]+$/.test(vb)) vb = `0 0 ${parseFloat(attrOf(open[0], 'width')) || 24} ${parseFloat(attrOf(open[0], 'height')) || 24}`;
  const inner = String(text).slice(open.index + open[0].length)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|title|desc|metadata|foreignObject|a|image|use|text|filter|pattern|symbol|marker|animate\w*|set)\b[\s\S]*?<\/\1>/gi, '');
  let out = '';
  const stack = [];
  for (const m of inner.matchAll(new RegExp(`<(\\/?)(${SVG_TAGS})\\b([^>]*?)(\\/?)>`, 'gi'))) {
    const [, close, rawTag, attrs, selfClose] = m;
    const key = rawTag.toLowerCase(), tag = SVG_CASE[key] || key;
    if (close) { if (stack.length && stack[stack.length - 1] === tag) { out += `</${tag}>`; stack.pop(); } continue; }
    let a = '';
    for (const name of SVG_ATTRS) { const v = attrOf(' ' + attrs, name); if (v != null && SAFE_VALUE.test(v)) a += ` ${name}="${v}"`; }
    if (/fa-secondary/.test(attrOf(' ' + attrs, 'class') || '') && !/ opacity=/.test(a)) a += ' opacity=".4"';
    if (SVG_CONTAINERS.has(key)) { if (selfClose) continue; out += `<${tag}${a}>`; stack.push(tag); } else out += `<${tag}${a}/>`;
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out ? { vb, body: out } : null;
}
const iconCache = new Map(); // file -> { mtime, icon }
async function readIconDir(dir, source) {
  const icons = {};
  let names = [];
  try { names = (await fsp.readdir(dir)).filter((n) => n.toLowerCase().endsWith('.svg')); } catch { return icons; }
  for (const n of names.slice(0, 2000)) {
    const file = path.join(dir, n);
    try {
      const st = await fsp.stat(file);
      if (st.size > 300000) continue;
      let hit = iconCache.get(file);
      if (!hit || hit.mtime !== st.mtimeMs) { hit = { mtime: st.mtimeMs, icon: sanitizeSvg(await fsp.readFile(file, 'utf8')) }; iconCache.set(file, hit); }
      const name = n.slice(0, -4).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (hit.icon && name) icons[name] = { ...hit.icon, source };
    } catch { /* skip unreadable file */ }
  }
  return icons;
}
async function customIcons() {
  const all = {};
  for (const dir of FOLDER_ICON_DIRS) Object.assign(all, await readIconDir(dir, 'folder'));
  Object.assign(all, await readIconDir(ICONS_DIR, 'upload')); // uploads win on a name clash
  return all;
}

// ---------------------------------------------------------------- weather forecasts
// Home Assistant streams forecasts per weather entity; we follow the ones shown on a page.
const FC_DAILY = 1, FC_HOURLY = 2, FC_TWICE_DAILY = 4;
function syncForecasts() {
  if (!ha.connected) return;
  const want = new Set([...(watchedEntities() || [])].filter((id) => id.startsWith('weather.') && ha.states.has(id)));
  for (const id of want) {
    const sf = Number(ha.states.get(id).attributes.supported_features || 0);
    const types = [];
    if (sf & FC_DAILY) types.push('daily'); else if (sf & FC_TWICE_DAILY) types.push('twice_daily');
    if (sf & FC_HOURLY) types.push('hourly');
    for (const t of types) {
      const key = `${id}|${t}`;
      if (ha.fcSubs.has(key)) continue;
      ha.fcSubs.set(key, 'pending');
      const kind = t === 'hourly' ? 'hourly' : 'daily';
      haSubscribe({ type: 'weather/subscribe_forecast', entity_id: id, forecast_type: t }, (ev) => {
        let list = Array.isArray(ev?.forecast) ? ev.forecast : [];
        if (t === 'twice_daily') list = list.filter((f) => f.is_daytime !== false);
        (ha.forecasts[id] ||= {})[kind] = list.slice(0, kind === 'hourly' ? 48 : 14);
        broadcast('forecast', { id, ...ha.forecasts[id] });
      }).then((subId) => { if (ha.fcSubs.get(key) === 'pending') ha.fcSubs.set(key, subId); })
        .catch((e) => { ha.fcSubs.delete(key); log(`Forecast (${t}) not available for ${id}: ${e.message}`); });
    }
  }
  for (const [key, subId] of ha.fcSubs) {
    const id = key.split('|')[0];
    if (want.has(id) || typeof subId !== 'number') continue;
    ha.fcSubs.delete(key); ha.subs.delete(subId); delete ha.forecasts[id];
    haRequest({ type: 'unsubscribe_events', subscription: subId }).catch(() => {});
  }
}

// ---------------------------------------------------------------- timers ("on for 30 min")
async function saveTimers() {
  broadcast('timers', timers);
  try { await writeJSON(TIMERS_FILE, timers); } catch (e) { log('Could not save timers:', e.message); }
}
async function callService(domain, service, data = {}, target, response = false) {
  const msg = { type: 'call_service', domain, service, service_data: data };
  if (target) msg.target = target;
  if (response) msg.return_response = true;
  return haRequest(msg);
}
// Which integration each entity comes from and which device it belongs to (for TV remotes and Music Assistant).
let registryCache = null, registryAt = 0;
async function registry() {
  if (registryCache && Date.now() - registryAt < 60000) return registryCache;
  const out = { entities: {}, ma: [], maEntries: {}, maDomain: null, maServices: [], searchMedia: false };
  try {
    const r = await haRequest({ type: 'config/entity_registry/list_for_display' });
    for (const e of r?.entities || []) if (e.ei && (e.pl || e.di)) out.entities[e.ei] = { pl: e.pl || null, di: e.di || null };
  } catch (e) { log('Entity registry:', e.message); }
  // Which Music Assistant actions this Home Assistant actually has: the built-in integration (music_assistant)
  // or the older HACS one (mass). Also whether media players can be searched the generic way.
  try {
    const svc = await haRequest({ type: 'get_services' });
    out.maDomain = ['music_assistant', 'mass'].find((d) => svc?.[d] && Object.keys(svc[d]).length) || null;
    out.maServices = out.maDomain ? Object.keys(svc[out.maDomain]) : [];
    out.searchMedia = !!svc?.media_player?.search_media;
  } catch (e) { log('Services:', e.message); delete out.maDomain; delete out.maServices; delete out.searchMedia; }
  // Music Assistant's instance (its config entry), which its actions need.
  for (const domain of ['music_assistant', 'mass']) {
    try {
      const ce = await haRequest({ type: 'config_entries/get', domain });
      out.maEntries[domain] = (ce || []).filter((c) => c.state === 'loaded').map((c) => c.entry_id);
    } catch { /* not installed */ }
  }
  out.ma = out.maEntries[out.maDomain || 'music_assistant'] || [];
  log('Music Assistant:', out.maDomain === undefined ? 'actions unknown' : `${out.maDomain || 'no'} actions (${(out.maServices || []).join(', ') || '-'})`, '| instances:', JSON.stringify(out.maEntries));
  registryCache = out; registryAt = Date.now();
  return out;
}
async function checkTimers() {
  if (!ha.connected) return;
  const now = Date.now();
  for (const [id, t] of Object.entries(timers)) {
    if (t.end > now) continue;
    delete timers[id];
    saveTimers();
    try { await callService('homeassistant', 'turn_off', {}, { entity_id: id }); log('Timer finished:', id); }
    catch (e) { log('Timer turn-off failed for', id, e.message); }
  }
}
setInterval(checkTimers, 5000);

// ---------------------------------------------------------------- HTTP
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
const NAME = /^[a-z0-9_]+$/;
// Safety: the direct port has no login, so Facewall only runs everyday home controls, never admin actions.
const BLOCKED_DOMAINS = new Set(['hassio', 'supervisor', 'shell_command', 'python_script', 'pyscript', 'rest_command', 'command_line', 'recorder', 'logger',
  'system_log', 'backup', 'update', 'cloud', 'frontend', 'auth', 'zwave_js', 'zha', 'matter', 'thread', 'mqtt', 'esphome', 'hacs', 'ffmpeg', 'downloader', 'notify', 'conversation']);
const LIMITED = { homeassistant: ['turn_on', 'turn_off', 'toggle', 'update_entity'], automation: ['turn_on', 'turn_off', 'toggle', 'trigger'] };
const serviceAllowed = (domain, service) => !BLOCKED_DOMAINS.has(domain) && (!LIMITED[domain] || LIMITED[domain].includes(service));
// Only answer devices on the home network, unless the app's option says otherwise (Home Assistant's own sidebar always works).
let ALLOW_OUTSIDE = false;
try { ALLOW_OUTSIDE = !!JSON.parse(fs.readFileSync('/data/options.json', 'utf8')).allow_outside_home_network; } catch { /* not running as an app */ }
function homeNetwork(ip) {
  ip = String(ip || '').replace(/^::ffff:/, '');
  if (ip === '::1' || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  const c = ip.match(/^100\.(\d+)\./); if (c && +c[1] >= 64 && +c[1] <= 127) return true; // Tailscale and carrier-grade NAT
  return /^(fc|fd|fe8|fe9|fea|feb)/i.test(ip);
}

async function handleApi(req, res, route) {
  if (route === 'info' && req.method === 'GET') {
    return json(res, 200, { app: 'facewall', version: VERSION, ...status() });
  }
  if (route === 'snapshot' && req.method === 'GET') return json(res, 200, snapshot());
  // Cameras: a snapshot, or the live MJPEG stream (live=1), fetched with Home Assistant's login.
  if (route === 'camera' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    const id = q.get('id') || '';
    const base = SUPERVISOR_TOKEN ? 'http://supervisor/core' : HA_URL;
    if (!/^camera\.[a-z0-9_]+$/.test(id) || !base) return json(res, 404, { error: 'no camera' });
    const live = q.get('live') === '1';
    const ctl = new AbortController();
    req.on('close', () => ctl.abort());
    try {
      const r = await fetch(`${base}/api/${live ? 'camera_proxy_stream' : 'camera_proxy'}/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: live ? ctl.signal : AbortSignal.timeout(15000) });
      if (!r.ok || !r.body) return json(res, 502, { error: `camera: ${r.status}` });
      res.writeHead(200, { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'no-store' });
      if (!live) return res.end(Buffer.from(await r.arrayBuffer()));
      const { Readable } = await import('node:stream');
      Readable.fromWeb(r.body).on('error', () => res.end()).pipe(res);
      return;
    } catch (e) { if (!res.headersSent) return json(res, 502, { error: e.message }); return res.end(); }
  }
  // Photo frame: the folders on offer, the photos in one (with sub-folders), and one photo.
  if (route === 'photos' && req.method === 'GET') {
    const folder = new URL(req.url, 'http://x').searchParams.get('folder') || '';
    const roots = Object.keys(PHOTO_ROOTS);
    if (!folder) return json(res, 200, { roots, files: [] });
    const files = await listPhotos(folder);
    if (!files) return json(res, 404, { roots, error: 'folder not found', files: [] });
    if (new URL(req.url, 'http://x').searchParams.get('dates')) {
      const dates = [];
      for (const f of files) dates.push(await photoDate(f));
      return json(res, 200, { roots, files, dates });
    }
    return json(res, 200, { roots, files });
  }
  if (route === 'photo' && req.method === 'GET') {
    const f = photoPath(new URL(req.url, 'http://x').searchParams.get('f'));
    if (!f || !PHOTO_EXT.test(f)) return json(res, 404, { error: 'not found' });
    try {
      const st = await fsp.stat(f);
      const ext = path.extname(f).slice(1).toLowerCase();
      const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', avif: 'image/avif' }[ext];
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'max-age=3600' });
      fs.createReadStream(f).on('error', () => res.end()).pipe(res);
      return;
    } catch { return json(res, 404, { error: 'not found' }); }
  }
  // Calendar events for calendar tiles (Home Assistant's calendar REST API).
  if (route === 'calendar' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    const id = q.get('id') || '';
    const base = SUPERVISOR_TOKEN ? 'http://supervisor/core' : HA_URL;
    if (!/^calendar\.[a-z0-9_]+$/.test(id) || !base) return json(res, 400, { error: 'bad calendar' });
    const start = new Date(q.get('start') || Date.now()), end = new Date(q.get('end') || Date.now() + 7 * 864e5);
    if (Number.isNaN(start) || Number.isNaN(end)) return json(res, 400, { error: 'bad dates' });
    try {
      const r = await fetch(`${base}/api/calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) return json(res, 502, { error: `calendar: ${r.status}` });
      const list = await r.json();
      return json(res, 200, { id, events: (Array.isArray(list) ? list : []).slice(0, 300).map((e) => ({
        summary: e.summary || '', location: e.location || '', start: e.start?.dateTime || e.start?.date || e.start, end: e.end?.dateTime || e.end?.date || e.end, allDay: !!e.start?.date,
      })) });
    } catch (e) { return json(res, 502, { error: e.message }); }
  }
  // Sensor history for graph tiles: [[epoch ms, number], ...] for the last N hours.
  if (route === 'history' && req.method === 'GET') {
    const q = new URL(req.url, 'http://x').searchParams;
    const id = q.get('id') || '';
    const hours = Math.min(24 * 14, Math.max(1, Number(q.get('hours')) || 24));
    if (!/^[a-z_]+\.[a-z0-9_]+$/.test(id)) return json(res, 400, { error: 'bad id' });
    if (!ha.connected) return json(res, 503, { error: 'not connected' });
    try {
      const start = new Date(Date.now() - hours * 3600e3).toISOString();
      const r = await haRequest({ type: 'history/history_during_period', start_time: start, entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false }, 30000);
      const rows = r?.[id] || [];
      const points = [];
      for (const x of rows) {
        const v = Number(x.s ?? x.state), t = (x.lu ?? x.lc) ? Math.round((x.lu ?? x.lc) * 1000) : Date.parse(x.last_updated || x.last_changed);
        if (Number.isFinite(v) && Number.isFinite(t)) points.push([t, v]);
      }
      // Keep it light: at most ~600 points.
      const step = Math.ceil(points.length / 600);
      return json(res, 200, { id, hours, points: step > 1 ? points.filter((_, i) => i % step === 0 || i === points.length - 1) : points });
    } catch (e) { return json(res, 502, { error: e.message }); }
  }
  // Music Assistant cover art from its image proxy, for iPads that can't reach the Music Assistant server directly.
  if (route === 'maimg' && req.method === 'GET') {
    let u;
    try { u = new URL(new URL(req.url, 'http://x').searchParams.get('u') || ''); } catch { return json(res, 400, { error: 'bad url' }); }
    if (!/^https?:$/.test(u.protocol) || !u.pathname.includes('imageproxy')) return json(res, 400, { error: 'not allowed' });
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) return json(res, 502, { error: 'no image' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'max-age=86400' });
      return res.end(buf);
    } catch (e) { return json(res, 502, { error: e.message }); }
  }
  // Album art for media players: Home Assistant's picture URLs need its login, so fetch them here.
  if (route === 'art' && req.method === 'GET') {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    const pic = /^(media_player|person)\./.test(id) ? ha.states.get(id)?.attributes?.entity_picture : null;
    if (!pic) return json(res, 404, { error: 'no picture' });
    const external = /^https?:\/\//i.test(pic);
    const base = SUPERVISOR_TOKEN ? 'http://supervisor/core' : HA_URL;
    if (!external && !base) return json(res, 404, { error: 'no picture' });
    try {
      const r = await fetch(external ? pic : base + pic, { headers: external ? {} : { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) return json(res, 502, { error: `picture: ${r.status}` });
      const type = r.headers.get('content-type') || 'image/jpeg';
      if (!/^image\//i.test(type)) return json(res, 502, { error: 'not an image' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=600' });
      return res.end(buf);
    } catch (e) { return json(res, 502, { error: e.message }); }
  }

  if (route === 'events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.write(': hello\n\n');
    clients.add(res);
    send(res, 'snapshot', snapshot());
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (route === 'settings') {
    if (req.method === 'GET') return json(res, 200, store);
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!body.settings || typeof body.settings !== 'object') return json(res, 400, { error: 'settings missing' });
      store = { rev: store.rev + 1, settings: body.settings };
      await writeJSON(SETTINGS_FILE, store);
      broadcast('settings', { rev: store.rev, settings: store.settings, origin: body.origin || null });
      syncForecasts();
      // Push fresh states for anything newly shown.
      const watched = watchedEntities();
      if (watched) for (const id of watched) if (ha.states.has(id)) broadcast('state', { id, s: ha.states.get(id) });
      return json(res, 200, { rev: store.rev });
    }
  }

  if (route === 'service' && req.method === 'POST') {
    const { domain, service, data, target, response } = await readBody(req);
    if (!NAME.test(domain || '') || !NAME.test(service || '')) return json(res, 400, { error: 'bad service' });
    if (!serviceAllowed(domain, service)) { log('Blocked action', `${domain}.${service}`); return json(res, 403, { error: `Facewall doesn't run ${domain}.${service}` }); }
    try { const r = await callService(domain, service, data || {}, target, !!response); return json(res, 200, { ok: true, response: response ? r?.response ?? null : undefined }); }
    catch (e) { return json(res, 502, { error: e.message }); }
  }

  // What Home Assistant says about Music Assistant, for the Music page's "why can't I search" note.
  if (route === 'diag/music' && req.method === 'GET') {
    const out = { services: null, servicesError: null, entries: {}, players: { total: 0, ma: 0 } };
    try {
      const svc = await haRequest({ type: 'get_services' }, 30000);
      out.services = Object.fromEntries(Object.entries(svc || {}).filter(([d]) => /music|mass/i.test(d)).map(([d, v]) => [d, Object.keys(v)]));
    } catch (e) { out.servicesError = e.message; }
    for (const domain of ['music_assistant', 'mass']) {
      try { out.entries[domain] = (await haRequest({ type: 'config_entries/get', domain }) || []).map((c) => ({ title: c.title, state: c.state, reason: c.reason || null })); }
      catch (e) { out.entries[domain] = { error: e.message }; }
    }
    for (const [id, st] of ha.states) if (id.startsWith('media_player.')) { out.players.total++; if (st.attributes?.mass_player_type != null || st.attributes?.active_queue != null) out.players.ma++; }
    log('Music diagnostics:', JSON.stringify(out));
    return json(res, 200, out);
  }
  // Browse a media player's library the generic Home Assistant way (works for any player that can browse).
  if (route === 'browse' && req.method === 'POST') {
    const { entity_id, media_content_id, media_content_type } = await readBody(req);
    if (!/^media_player\.[a-z0-9_]+$/.test(entity_id || '')) return json(res, 400, { error: 'bad player' });
    const msg = { type: 'media_player/browse_media', entity_id };
    if (media_content_id) { msg.media_content_id = String(media_content_id); msg.media_content_type = String(media_content_type || ''); }
    try { return json(res, 200, await haRequest(msg, 30000)); } catch (e) { return json(res, 502, { error: e.message }); }
  }
  // Thumbnails from Home Assistant's media browser, which need its login.
  if (route === 'hathumb' && req.method === 'GET') {
    const p = new URL(req.url, 'http://x').searchParams.get('p') || '';
    if (!/^\/api\/(media_player_proxy|image_proxy|brands|media_source|image)\//.test(p)) return json(res, 400, { error: 'not allowed' });
    const base = SUPERVISOR_TOKEN ? 'http://supervisor/core' : HA_URL;
    try {
      const r = await fetch(base + p, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) return json(res, 502, { error: 'no image' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=3600' });
      return res.end(buf);
    } catch (e) { return json(res, 502, { error: e.message }); }
  }
  if (route === 'registry' && req.method === 'GET') {
    if (!ha.connected) return json(res, 503, { error: 'not connected' });
    if (new URL(req.url, 'http://x').searchParams.get('fresh')) registryCache = null;
    return json(res, 200, await registry());
  }
  if (route === 'icons/custom' && req.method === 'GET') return json(res, 200, { icons: await customIcons() });
  if (route === 'icons/custom' && req.method === 'POST') {
    const { name, svg } = await readBody(req, 400000);
    const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    const icon = slug && sanitizeSvg(svg || '');
    if (!icon) return json(res, 400, { error: 'Not a usable SVG icon' });
    await fsp.writeFile(path.join(ICONS_DIR, slug + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.vb}">${icon.body}</svg>`);
    return json(res, 200, { name: slug });
  }
  if (route.startsWith('icons/custom/') && req.method === 'DELETE') {
    const slug = decodeURIComponent(route.slice('icons/custom/'.length)).replace(/[^a-z0-9-]/g, '');
    await fsp.unlink(path.join(ICONS_DIR, slug + '.svg')).catch(() => {});
    return json(res, 200, { ok: true });
  }

  if (route === 'timer' && req.method === 'POST') {
    const { entity_id, minutes } = await readBody(req);
    const min = Number(minutes);
    if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entity_id || '') || !(min > 0 && min <= 24 * 60)) return json(res, 400, { error: 'bad timer' });
    try {
      await callService('homeassistant', 'turn_on', {}, { entity_id });
      timers[entity_id] = { end: Date.now() + min * 60000, minutes: min };
      saveTimers();
      return json(res, 200, { ok: true, timer: timers[entity_id] });
    } catch (e) { return json(res, 502, { error: e.message }); }
  }
  if (route === 'timer/cancel' && req.method === 'POST') {
    const { entity_id } = await readBody(req);
    if (timers[entity_id]) { delete timers[entity_id]; saveTimers(); }
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}

const gzCache = new Map(); // file -> { etag, buf }
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);
async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(WWW, rel);
  if (!file.startsWith(WWW + path.sep) && file !== WWW) { res.writeHead(403); return res.end(); }
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
    // Revalidate every time (so updates show up), but answer 304 when nothing changed.
    const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    const gz = COMPRESS.has(path.extname(file)) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && stat.size > 1024;
    if (gz) {
      let hit = gzCache.get(file);
      if (!hit || hit.etag !== etag) { hit = { etag, buf: zlib.gzipSync(await fsp.readFile(file), { level: 6 }) }; gzCache.set(file, hit); }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': hit.buf.length });
      return res.end(req.method === 'HEAD' ? undefined : hit.buf);
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!ALLOW_OUTSIDE && !homeNetwork(req.socket.remoteAddress)) {
      log('Refused a request from outside the home network:', req.socket.remoteAddress);
      res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Facewall only answers on your home network.');
    }
    const { pathname } = new URL(req.url, 'http://x');
    const m = pathname.match(/\/api\/(.+)$/);
    if (m) return await handleApi(req, res, m[1].replace(/\/+$/, ''));
    return await serveStatic(req, res, pathname);
  } catch (e) {
    log('Request error:', e.message);
    if (!res.headersSent) json(res, 500, { error: e.message }); else res.end();
  }
});

server.listen(PORT, () => {
  log(`Facewall ${VERSION} listening on port ${PORT} (data: ${DATA_DIR})`);
  haConnect();
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { log('Shutting down'); process.exit(0); });
