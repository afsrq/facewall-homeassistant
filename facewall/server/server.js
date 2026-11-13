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
import { fileURLToPath } from 'node:url';

const VERSION = '1.2.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.resolve(__dirname, '..', 'www');
const PORT = Number(process.env.PORT || 8099);
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.resolve(__dirname, '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TIMERS_FILE = path.join(DATA_DIR, 'timers.json');

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
    case 'event':
      if (m.event?.event_type === 'state_changed') onStateChanged(m.event.data);
      break;
  }
}

async function onReady() {
  await haRequest({ type: 'subscribe_events', event_type: 'state_changed' });
  const states = await haRequest({ type: 'get_states' });
  ha.states = new Map(states.map((s) => [s.entity_id, slim(s)]));
  ha.connected = true; ha.backoff = 1000; ha.lastError = null;
  log(`Connected to Home Assistant ${ha.version || ''} — ${ha.states.size} entities`);
  await loadAreas();
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
  const lists = [...(s.pages || []).map((p) => p.entities || []), s.dashboard?.entities || []];
  for (const list of lists) for (const e of list) set.add(typeof e === 'string' ? e : e.id);
  for (const f of s.faces || []) for (const k of ['tap', 'tl', 'tr']) if (f[k]) set.add(f[k]);
  for (const id of Object.keys(timers)) set.add(id);
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
  return { status: status(), states: [...ha.states.values()], areas: ha.areas, timers, rev: store.rev };
}

// ---------------------------------------------------------------- timers ("on for 30 min")
async function saveTimers() {
  broadcast('timers', timers);
  try { await writeJSON(TIMERS_FILE, timers); } catch (e) { log('Could not save timers:', e.message); }
}
async function callService(domain, service, data = {}, target) {
  const msg = { type: 'call_service', domain, service, service_data: data };
  if (target) msg.target = target;
  return haRequest(msg);
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

async function handleApi(req, res, route) {
  if (route === 'info' && req.method === 'GET') {
    return json(res, 200, { app: 'facewall', version: VERSION, ...status() });
  }
  if (route === 'snapshot' && req.method === 'GET') return json(res, 200, snapshot());

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
      // Push fresh states for anything newly shown.
      const watched = watchedEntities();
      if (watched) for (const id of watched) if (ha.states.has(id)) broadcast('state', { id, s: ha.states.get(id) });
      return json(res, 200, { rev: store.rev });
    }
  }

  if (route === 'service' && req.method === 'POST') {
    const { domain, service, data, target } = await readBody(req);
    if (!NAME.test(domain || '') || !NAME.test(service || '')) return json(res, 400, { error: 'bad service' });
    try { await callService(domain, service, data || {}, target); return json(res, 200, { ok: true }); }
    catch (e) { return json(res, 502, { error: e.message }); }
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

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(WWW, rel);
  if (!file.startsWith(WWW + path.sep) && file !== WWW) { res.writeHead(403); return res.end(); }
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size, 'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
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
