// Data layer: talks to the Facewall server (which talks to Home Assistant),
// or runs a self-contained demo home when no server is reachable.

export const domainOf = (id) => (id || '').split('.')[0];
const CLIENT_ID = Math.random().toString(36).slice(2);

export class Store extends EventTarget {
  constructor() {
    super();
    this.states = new Map();
    this.areas = {};
    this.timers = {};
    this.settings = null;
    this.rev = 0;
    this.status = { connected: false };
    this.mode = 'ha';
  }

  async init() {
    let info = null;
    try {
      info = await fetchJSON('api/info', {}, 4000);
      if (info?.app !== 'facewall') info = null;
    } catch { info = null; }
    this.adapter = info ? new ServerAdapter(this) : new DemoAdapter(this);
    this.mode = info ? 'ha' : 'demo';
    await this.adapter.start();
  }

  // ---- reading
  get(id) { return this.states.get(id) || null; }
  name(id) {
    const s = this.get(id);
    return s?.attributes?.friendly_name || (id ? (id.split('.')[1] || id).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
  }
  area(id) { return this.areas[id] || ''; }
  list(domains) {
    const ds = domains ? new Set(domains) : null;
    return [...this.states.values()]
      .filter((s) => !ds || ds.has(domainOf(s.entity_id)))
      .sort((a, b) => this.name(a.entity_id).localeCompare(this.name(b.entity_id)));
  }

  // ---- internal (used by adapters)
  _setSnapshot({ states, areas, timers, status }) {
    this.states = new Map(states.map((s) => [s.entity_id, s]));
    this.areas = areas || {};
    this.timers = timers || {};
    if (status) this.status = status;
    this.dispatchEvent(new Event('snapshot'));
    this.dispatchEvent(new Event('status'));
  }
  _setState(id, s) {
    if (s) this.states.set(id, s); else this.states.delete(id);
    this.dispatchEvent(new CustomEvent('state', { detail: id }));
  }
  _setTimers(t) { this.timers = t || {}; this.dispatchEvent(new Event('timers')); }
  _setStatus(st) { this.status = st; this.dispatchEvent(new Event('status')); }
  _setSettings(settings, rev, external) {
    this.settings = settings; this.rev = rev;
    this.dispatchEvent(new CustomEvent('settings', { detail: { external } }));
  }

  // ---- actions
  call(domain, service, data = {}, target) { return this.adapter.call(domain, service, data, target); }

  /** Toggle / activate an entity in the most sensible way for its domain. Returns the expected new "on" state. */
  activate(id) {
    const d = domainOf(id);
    const s = this.get(id);
    const on = isOn(s);
    const t = { entity_id: id };
    switch (d) {
      case 'light': case 'switch': case 'fan': case 'input_boolean': case 'automation': case 'siren': case 'humidifier':
        this.call(d, 'toggle', {}, t); return !on;
      case 'lock': this.call('lock', s?.state === 'locked' ? 'unlock' : 'lock', {}, t); return s?.state !== 'locked';
      case 'cover': this.call('cover', 'toggle', {}, t); return !on;
      case 'scene': this.call('scene', 'turn_on', {}, t); return true;
      case 'script': this.call('script', 'turn_on', {}, t); return true;
      case 'button': case 'input_button': this.call(d, 'press', {}, t); return true;
      case 'media_player': this.call('media_player', 'media_play_pause', {}, t); return !on;
      default: this.call('homeassistant', on ? 'turn_off' : 'turn_on', {}, t); return !on;
    }
  }

  startTimer(id, minutes) { return this.adapter.startTimer(id, minutes); }
  cancelTimer(id) { return this.adapter.cancelTimer(id); }

  saveSettings(settings) {
    this.settings = settings;
    this.dispatchEvent(new CustomEvent('settings', { detail: { external: false } }));
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.adapter.saveSettings(settings), 250);
  }
}

// ------------------------------------------------------------------ helpers
export function isOn(s) {
  if (!s) return false;
  const st = s.state;
  if (domainOf(s.entity_id) === 'climate') return st !== 'off' && st !== 'unavailable';
  if (domainOf(s.entity_id) === 'water_heater') return st !== 'off' && st !== 'unavailable' && st !== 'unknown';
  if (domainOf(s.entity_id) === 'lock') return st === 'unlocked' || st === 'open';
  if (domainOf(s.entity_id) === 'media_player') return st === 'playing';
  return ['on', 'open', 'opening', 'playing', 'home', 'heat', 'cool'].includes(st);
}

export function fetchJSON(url, opts = {}, timeout = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  return fetch(url, { ...opts, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } })
    .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.json(); })
    .finally(() => clearTimeout(t));
}

/** Light colour as [r,g,b] for an "on" light. */
export function lightRGB(s) {
  const a = s?.attributes || {};
  if (Array.isArray(a.rgb_color)) return a.rgb_color;
  if (Array.isArray(a.hs_color)) return hsToRgb(a.hs_color[0], a.hs_color[1]);
  const k = a.color_temp_kelvin || (a.color_temp ? 1e6 / a.color_temp : null);
  if (k) return kelvinToRgb(k);
  return [255, 214, 140];
}
export function hsToRgb(h, s) {
  s /= 100; const v = 1;
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
}
export function kelvinToRgb(k) {
  const t = k / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  return [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))));
}

// ------------------------------------------------------------------ server adapter
class ServerAdapter {
  constructor(store) { this.store = store; }

  async start() {
    const st = await fetchJSON('api/settings');
    this.store._setSettings(st.settings, st.rev, true);
    this.connect();
    // Wait (briefly) for the first snapshot so the UI has data on first paint.
    await new Promise((resolve) => {
      const done = () => { this.store.removeEventListener('snapshot', done); resolve(); };
      this.store.addEventListener('snapshot', done);
      setTimeout(done, 5000);
    });
  }

  connect() {
    if (this.es) this.es.close();
    const es = new EventSource('api/events');
    this.es = es;
    let gotData = false;
    es.addEventListener('snapshot', (e) => {
      gotData = true; this.stopPolling();
      const snap = JSON.parse(e.data);
      this.store._setSnapshot(snap);
      if (snap.rev != null && snap.rev !== this.store.rev) this.refreshSettings();
    });
    es.addEventListener('state', (e) => { const { id, s } = JSON.parse(e.data); this.store._setState(id, s); });
    es.addEventListener('timers', (e) => this.store._setTimers(JSON.parse(e.data)));
    es.addEventListener('status', (e) => this.store._setStatus(JSON.parse(e.data)));
    es.addEventListener('settings', (e) => {
      const { rev, settings, origin } = JSON.parse(e.data);
      if (origin === CLIENT_ID) { this.store.rev = rev; return; }
      this.store._setSettings(settings, rev, true);
    });
    es.onerror = () => {
      // EventSource reconnects by itself; if streaming is blocked (some proxies), fall back to polling.
      if (!gotData) this.startPolling();
    };
  }

  async refreshSettings() {
    try { const st = await fetchJSON('api/settings'); if (st.settings) this.store._setSettings(st.settings, st.rev, true); } catch { /* next snapshot will retry */ }
  }

  startPolling() {
    if (this.poll) return;
    const tick = async () => {
      try { this.store._setSnapshot(await fetchJSON('api/snapshot')); } catch { /* keep trying */ }
    };
    tick();
    this.poll = setInterval(tick, 4000);
  }
  stopPolling() { clearInterval(this.poll); this.poll = null; }

  async call(domain, service, data, target) {
    try { await fetchJSON('api/service', { method: 'POST', body: JSON.stringify({ domain, service, data, target }) }); }
    catch (e) { this.store.dispatchEvent(new CustomEvent('error', { detail: e.message })); }
  }
  async startTimer(entity_id, minutes) {
    try { await fetchJSON('api/timer', { method: 'POST', body: JSON.stringify({ entity_id, minutes }) }); }
    catch (e) { this.store.dispatchEvent(new CustomEvent('error', { detail: e.message })); }
  }
  async cancelTimer(entity_id) {
    await fetchJSON('api/timer/cancel', { method: 'POST', body: JSON.stringify({ entity_id }) }).catch(() => {});
  }
  async saveSettings(settings) {
    try {
      const r = await fetchJSON('api/settings', { method: 'PUT', body: JSON.stringify({ settings, origin: CLIENT_ID }) });
      this.store.rev = r.rev;
    } catch (e) { this.store.dispatchEvent(new CustomEvent('error', { detail: 'Could not save: ' + e.message })); }
  }
}

// ------------------------------------------------------------------ demo adapter
const DEMO_KEY = 'facewall-demo-settings';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

function demoStates() {
  const st = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes, last_changed: new Date().toISOString() });
  return [
    st('climate.living_room_ac', 'cool', {
      friendly_name: 'Air Conditioner', hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto'],
      temperature: 23, current_temperature: 21.2, target_temp_step: 0.5, min_temp: 16, max_temp: 30, hvac_action: 'cooling',
    }),
    st('water_heater.bathroom', 'off', { friendly_name: 'Water Heater', operation_list: ['off', 'electric'], temperature: 55 }),
    st('lock.front_door', 'locked', { friendly_name: 'Front Door' }),
    st('light.back_lights', 'off', { friendly_name: 'Back Lights', supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }),
    st('light.front_lights', 'on', { friendly_name: 'Front Lights', brightness: 230, color_mode: 'color_temp', color_temp_kelvin: 2900, supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }),
    st('light.bedroom_light', 'on', { friendly_name: 'Bedroom Light', brightness: 160, color_mode: 'hs', hs_color: [340, 72], rgb_color: [255, 71, 122], supported_color_modes: ['hs', 'color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }),
    st('light.entrance_light', 'on', { friendly_name: 'Entrance Light', brightness: 255, color_mode: 'hs', rgb_color: [214, 240, 92], hs_color: [70, 62], supported_color_modes: ['hs'] }),
    st('light.kitchen', 'off', { friendly_name: 'Kitchen', supported_color_modes: ['brightness'] }),
    st('switch.coffee_machine', 'off', { friendly_name: 'Coffee Machine' }),
    st('cover.living_room_blinds', 'open', { friendly_name: 'Blinds', current_position: 100 }),
    st('scene.movie_night', 'unknown', { friendly_name: 'Movie Night' }),
    st('sensor.outdoor_temperature', '14.5', { friendly_name: 'Outside', unit_of_measurement: '°C', device_class: 'temperature' }),
    st('sensor.indoor_humidity', '46', { friendly_name: 'Humidity', unit_of_measurement: '%', device_class: 'humidity' }),
    st('binary_sensor.back_door', 'off', { friendly_name: 'Back Door', device_class: 'door' }),
  ];
}
const DEMO_AREAS = {
  'climate.living_room_ac': 'Living Room', 'water_heater.bathroom': 'Bathroom', 'lock.front_door': 'Entrance',
  'light.back_lights': 'Garden', 'light.front_lights': 'Porch', 'light.bedroom_light': 'Bedroom', 'light.entrance_light': 'Entrance',
  'light.kitchen': 'Kitchen', 'switch.coffee_machine': 'Kitchen', 'cover.living_room_blinds': 'Living Room',
};

class DemoAdapter {
  constructor(store) { this.store = store; this.lastMode = {}; }

  async start() {
    this.store._setSnapshot({ states: demoStates(), areas: DEMO_AREAS, timers: {}, status: { connected: true, demo: true } });
    let saved = null;
    try { saved = JSON.parse(lsGet(DEMO_KEY) || 'null'); } catch { saved = null; }
    this.store._setSettings(saved, 1, true);
    setInterval(() => this.tickTimers(), 1000);
  }

  set(id, patch, attrs) {
    const s = this.store.get(id); if (!s) return;
    const next = { ...s, ...patch, attributes: { ...s.attributes, ...(attrs || {}) }, last_changed: new Date().toISOString() };
    setTimeout(() => {
      this.store._setState(id, next);
      if (next.state === 'off' && this.store.timers[id]) { const t = { ...this.store.timers }; delete t[id]; this.store._setTimers(t); }
    }, 140);
  }

  async call(domain, service, data = {}, target = {}) {
    const ids = [].concat(target.entity_id || data.entity_id || []);
    for (const id of ids) {
      const s = this.store.get(id); if (!s) continue;
      const d = domainOf(id);
      const on = isOn(s);
      if (service === 'toggle') this.set(id, { state: on ? 'off' : (d === 'cover' ? 'open' : 'on') }, d === 'light' && !on ? { brightness: s.attributes.brightness || 255 } : {});
      else if (service === 'turn_on') {
        if (d === 'water_heater') this.set(id, { state: 'electric' });
        else if (d === 'climate') this.set(id, { state: this.lastMode[id] || 'cool' });
        else if (d === 'scene' || d === 'script') { /* stateless */ }
        else {
          const a = {};
          if (data.brightness_pct != null) a.brightness = Math.round(data.brightness_pct * 2.55);
          else if (!s.attributes.brightness && d === 'light') a.brightness = 255;
          if (data.rgb_color) { a.rgb_color = data.rgb_color; a.color_mode = 'hs'; a.hs_color = undefined; a.color_temp_kelvin = undefined; }
          if (data.color_temp_kelvin) { a.color_temp_kelvin = data.color_temp_kelvin; a.color_mode = 'color_temp'; a.rgb_color = undefined; a.hs_color = undefined; }
          this.set(id, { state: 'on' }, a);
        }
      } else if (service === 'turn_off') {
        if (d === 'climate' && s.state !== 'off') this.lastMode[id] = s.state;
        this.set(id, { state: 'off' });
      }
      else if (service === 'lock') this.set(id, { state: 'locked' });
      else if (service === 'unlock') this.set(id, { state: 'unlocked' });
      else if (service === 'set_temperature') this.set(id, {}, { temperature: data.temperature });
      else if (service === 'set_hvac_mode') { if (data.hvac_mode !== 'off') this.lastMode[id] = data.hvac_mode; else if (s.state !== 'off') this.lastMode[id] = s.state; this.set(id, { state: data.hvac_mode }); }
      else if (service === 'open_cover') this.set(id, { state: 'open' }, { current_position: 100 });
      else if (service === 'close_cover') this.set(id, { state: 'closed' }, { current_position: 0 });
    }
  }

  async startTimer(id, minutes) {
    await this.call('homeassistant', 'turn_on', {}, { entity_id: id });
    this.store._setTimers({ ...this.store.timers, [id]: { end: Date.now() + minutes * 60000, minutes } });
  }
  async cancelTimer(id) { const t = { ...this.store.timers }; delete t[id]; this.store._setTimers(t); }
  tickTimers() {
    const now = Date.now();
    for (const [id, t] of Object.entries(this.store.timers)) {
      if (t.end <= now) { this.cancelTimer(id); this.call('homeassistant', 'turn_off', {}, { entity_id: id }); }
    }
  }
  async saveSettings(settings) { lsSet(DEMO_KEY, JSON.stringify(settings)); }
}

// ------------------------------------------------------------------ display formatting
const BINARY = {
  door: ['Closed', 'Open'], window: ['Closed', 'Open'], garage_door: ['Closed', 'Open'], opening: ['Closed', 'Open'],
  motion: ['Clear', 'Motion'], occupancy: ['Clear', 'Occupied'], presence: ['Away', 'Home'], moisture: ['Dry', 'Wet'],
  lock: ['Locked', 'Unlocked'], smoke: ['Clear', 'Smoke'], battery: ['Normal', 'Low'], connectivity: ['Offline', 'Online'],
};
export function formatState(store, id) {
  const s = store.get(id);
  if (!s) return '—';
  const d = domainOf(id), a = s.attributes || {};
  if (s.state === 'unavailable') return 'Unavailable';
  if (d === 'binary_sensor') { const m = BINARY[a.device_class]; return m ? m[s.state === 'on' ? 1 : 0] : s.state === 'on' ? 'On' : 'Off'; }
  if (d === 'climate') return a.current_temperature != null ? `${a.current_temperature}°` : cap(s.state);
  if (d === 'weather') return a.temperature != null ? `${a.temperature}° ${cap(s.state.replace(/-/g, ' '))}` : cap(s.state);
  if (d === 'light' && s.state === 'on' && a.brightness != null) return `On · ${Math.round(a.brightness / 2.55)}%`;
  const n = Number(s.state);
  if (s.state !== '' && !Number.isNaN(n) && (d === 'sensor' || d === 'input_number' || d === 'number')) {
    const v = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
    const u = a.unit_of_measurement || '';
    return u === '°C' || u === '°F' ? `${v}°` : `${v}${u && u !== '%' ? ' ' : ''}${u}`;
  }
  return cap(s.state.replace(/_/g, ' '));
}
export const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
