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
    this.forecasts = {};   // weather entity -> { daily: [...], hourly: [...] }
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
  get(id) { return this.states.get(id) || this.virtual?.get(id) || null; }
  name(id) {
    const s = this.get(id);
    return s?.attributes?.friendly_name || (id ? (id.split('.')[1] || id).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
  }
  area(id) { return this.areas[id] || ''; }
  list(domains) {
    const ds = domains ? new Set(domains) : null;
    return [...this.states.values(), ...(this.virtual?.values() || [])]
      .filter((s) => !ds || ds.has(domainOf(s.entity_id)))
      .sort((a, b) => this.name(a.entity_id).localeCompare(this.name(b.entity_id)));
  }

  /** Countdowns from Settings, as pretend entities (countdown.xyz) so tiles, faces and the header can show them. */
  syncCountdowns(now = new Date()) {
    const next = new Map();
    for (const c of this.settings?.countdowns || []) {
      const id = 'countdown.' + c.id, info = countdownInfo(c, now);
      next.set(id, { entity_id: id, state: String(info.days), attributes: { friendly_name: c.name || 'Countdown', emoji: c.emoji || '', target: info.target.toISOString(), text: info.text, long: info.long, hours: info.hours, icon: 'mdi:calendar-clock' } });
    }
    const old = this.virtual || new Map();
    this.virtual = next;
    for (const [id, st] of next) { const o = old.get(id); if (!o || o.state !== st.state || o.attributes.text !== st.attributes.text || o.attributes.friendly_name !== st.attributes.friendly_name || o.attributes.emoji !== st.attributes.emoji) this.dispatchEvent(new CustomEvent('state', { detail: id })); }
    for (const id of old.keys()) if (!next.has(id)) this.dispatchEvent(new CustomEvent('state', { detail: id }));
  }

  // ---- internal (used by adapters)
  _setSnapshot({ states, areas, timers, status, forecasts }) {
    this.states = new Map(states.map((s) => [s.entity_id, s]));
    this.areas = areas || {};
    this.timers = timers || {};
    if (forecasts) this.forecasts = forecasts;
    if (status) this.status = status;
    this.dispatchEvent(new Event('snapshot'));
    this.dispatchEvent(new Event('status'));
  }
  _setState(id, s) {
    if (s) this.states.set(id, s); else this.states.delete(id);
    this.dispatchEvent(new CustomEvent('state', { detail: id }));
  }
  _setForecast(id, f) {
    this.forecasts = { ...this.forecasts, [id]: f };
    this.dispatchEvent(new CustomEvent('forecast', { detail: id }));
  }
  _setTimers(t) { this.timers = t || {}; this.dispatchEvent(new Event('timers')); }
  _setStatus(st) { this.status = st; this.dispatchEvent(new Event('status')); }
  _setSettings(settings, rev, external) {
    this.settings = settings; this.rev = rev;
    this.dispatchEvent(new CustomEvent('settings', { detail: { external } }));
  }

  // ---- actions
  call(domain, service, data = {}, target) { return this.adapter.call(domain, service, data, target); }
  /** Call a service that answers (e.g. Music Assistant search). Resolves to the response, or throws. */
  ask(domain, service, data = {}, target) { return this.adapter.ask ? this.adapter.ask(domain, service, data, target) : Promise.reject(new Error('not supported')); }
  /** Browse a media player's library (Home Assistant's media browser). */
  musicDiag() { return this.adapter.musicDiag ? this.adapter.musicDiag() : Promise.resolve(null); }
  browse(id, uri, type) { return this.adapter.browse ? this.adapter.browse(id, uri, type) : Promise.reject(new Error('not supported')); }
  /** { entities: { id: { pl: integration, di: device } }, ma: [Music Assistant entry ids] } — fetched once, then cached. */
  registry(fresh) {
    if (!this._reg || fresh) this._reg = (this.adapter.registry ? this.adapter.registry(fresh) : Promise.resolve(null)).then((r) => r || { entities: {}, ma: [] }).catch(() => { this._reg = null; return { entities: {}, ma: [] }; });
    return this._reg;
  }

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
  /** Calendar events between two dates: [{ summary, location, start, end, allDay }]. */
  photos(folder, dates) { return this.adapter.photos ? this.adapter.photos(folder, dates) : Promise.resolve({ roots: [], files: [] }); }
  photoUrl(f) { return this.adapter.photoUrl ? this.adapter.photoUrl(f) : ''; }
  events(id, start, end) { return this.adapter.events ? this.adapter.events(id, start, end) : Promise.resolve([]); }
  /** A sensor's recent history: [[epoch ms, number], ...]. */
  history(id, hours = 24) { return this.adapter.history ? this.adapter.history(id, hours) : Promise.resolve([]); }
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
    es.addEventListener('forecast', (e) => { const { id, ...f } = JSON.parse(e.data); this.store._setForecast(id, f); });
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
  async ask(domain, service, data, target) {
    return (await fetchJSON('api/service', { method: 'POST', body: JSON.stringify({ domain, service, data, target, response: true }) }, 30000)).response;
  }
  async registry(fresh) { return fetchJSON('api/registry' + (fresh ? '?fresh=1' : ''), {}, 20000); }
  async musicDiag() { return fetchJSON('api/diag/music', {}, 35000); }
  async browse(entity_id, media_content_id, media_content_type) {
    return fetchJSON('api/browse', { method: 'POST', body: JSON.stringify({ entity_id, media_content_id, media_content_type }) }, 35000);
  }
  async photos(folder, dates) {
    try { return await fetchJSON(`api/photos?folder=${encodeURIComponent(folder || '')}${dates ? '&dates=1' : ''}`, {}, dates ? 120000 : 30000); } catch (e) { return { roots: [], files: [], error: e.message }; }
  }
  photoUrl(f) { return `api/photo?f=${encodeURIComponent(f)}`; }
  async events(id, start, end) {
    try { return (await fetchJSON(`api/calendar?id=${encodeURIComponent(id)}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`, {}, 20000)).events || []; } catch { return []; }
  }
  async history(id, hours) {
    try { return (await fetchJSON(`api/history?id=${encodeURIComponent(id)}&hours=${hours}`, {}, 30000)).points || []; } catch { return []; }
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

// Made-up tracks for the demo media player.
const DEMO_TRACKS = [
  { media_title: 'Desert Modern', media_artist: 'The Breeze Blocks', media_album_name: 'Palm Canyon Drive', media_duration: 214, entity_picture: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23f2a65a'/%3E%3Cstop offset='1' stop-color='%23c2541f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23g)'/%3E%3Ccircle cx='150' cy='150' r='78' fill='%232f7f7a' opacity='.85'/%3E%3Ccircle cx='150' cy='150' r='18' fill='%23f6ead8'/%3E%3C/svg%3E" },
  { media_title: 'Pool Light', media_artist: 'Atomic Ranch', media_album_name: 'Butterfly Roof', media_duration: 187, entity_picture: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%231fa3a0'/%3E%3Cstop offset='1' stop-color='%230f4c5c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23g)'/%3E%3Crect x='60' y='60' width='180' height='180' rx='40' fill='none' stroke='%23f28aa8' stroke-width='16'/%3E%3Ccircle cx='150' cy='150' r='40' fill='%23f28aa8'/%3E%3C/svg%3E" },
  { media_title: 'Dusk Over San Jacinto', media_artist: 'Mustard & Teal', media_album_name: 'Sunburst', media_duration: 251, entity_picture: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%232b1b2e'/%3E%3Cstop offset='1' stop-color='%235a2d59'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23g)'/%3E%3Cpath d='M40 220 Q150 40 260 220' fill='none' stroke='%23ffb38a' stroke-width='14'/%3E%3Ccircle cx='150' cy='120' r='26' fill='%23ffb38a'/%3E%3C/svg%3E" },
];
// A tiny made-up Music Assistant library for the demo.
const demoCover = (a, b, shape) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/>${shape}</svg>`)}`;
const SHAPES = ["<circle cx='150' cy='150' r='70' fill='white' opacity='.35'/>", "<rect x='75' y='75' width='150' height='150' rx='30' fill='none' stroke='white' stroke-width='14' opacity='.5'/>", "<path d='M40 220 Q150 40 260 220' fill='none' stroke='white' stroke-width='14' opacity='.5'/>", "<path d='M150 60 L240 230 H60Z' fill='white' opacity='.3'/>"];
const PAL = [['#f2a65a', '#c2541f'], ['#1fa3a0', '#0f4c5c'], ['#5a2d59', '#2b1b2e'], ['#e94f64', '#7b1e3a'], ['#7bb662', '#2f5a3a'], ['#3a7bd5', '#1a2a6c'], ['#f6d365', '#fda085'], ['#a18cd1', '#5f4b8b']];
const mk = (media_type, name, i, extra = {}) => ({ media_type, uri: `library://${media_type}/${i}`, name, image: demoCover(...PAL[i % PAL.length], SHAPES[i % SHAPES.length]), favorite: i % 3 !== 2, ...extra });
const ART = ['The Breeze Blocks', 'Atomic Ranch', 'Mustard & Teal', 'Kidney Pool', 'Terrazzo', 'Sputnik Lights'];
export const DEMO_MA = {
  playlist: ['Sunday Morning', 'Dinner Party', 'Focus', 'Pool Day', 'Late Night Jazz', 'Kids’ Favourites'].map((n, i) => mk('playlist', n, i, { owner: 'You' })),
  album: ['Palm Canyon Drive', 'Butterfly Roof', 'Sunburst', 'Breeze Block', 'Clerestory', 'Carport'].map((n, i) => mk('album', n, i + 2, { artists: [{ name: ART[i] }] })),
  artist: ART.map((n, i) => mk('artist', n, i + 4)),
  track: ['Desert Modern', 'Pool Light', 'Dusk Over San Jacinto', 'Walnut & Brass', 'Indian Canyons', 'Starburst', 'Eichler Afternoon', 'Low Slung'].map((n, i) => mk('track', n, i + 1, { artists: [{ name: ART[i % ART.length] }], album: { name: 'Sunburst' }, duration: 180 + i * 13 })),
  radio: ['KCRW Eclectic', 'Jazz 24', 'Lofi Beats', 'BBC Radio 6'].map((n, i) => mk('radio', n, i + 5)),
  podcast: ['Design Matters', 'Home Assistant Podcast'].map((n, i) => mk('podcast', n, i + 3)),
  audiobook: [],
};

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
    st('light.bedroom_light', 'on', { friendly_name: 'Bedroom Light', brightness: 160, color_mode: 'hs', hs_color: [340, 72], rgb_color: [255, 71, 122], supported_color_modes: ['hs', 'color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, effect_list: ['None', 'Candle', 'Fireplace', 'Sunrise', 'Colorloop', 'Sparkle'], effect: 'None' }),
    st('light.all_lights', 'on', { friendly_name: 'All Lights', icon: 'mdi:lightbulb-group', brightness: 200, supported_color_modes: ['hs', 'color_temp'], color_mode: 'color_temp', color_temp_kelvin: 3000, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, entity_id: ['light.back_lights', 'light.front_lights', 'light.bedroom_light'] }),
    st('scene.bedroom_relax', 'unknown', { friendly_name: 'Relax', icon: 'mdi:sofa' }),
    st('scene.bedroom_reading', 'unknown', { friendly_name: 'Reading', icon: 'mdi:book-open-variant' }),
    st('scene.bedroom_night', 'unknown', { friendly_name: 'Nightlight', icon: 'mdi:weather-night' }),
    st('light.entrance_light', 'on', { friendly_name: 'Entrance Light', brightness: 255, color_mode: 'hs', rgb_color: [214, 240, 92], hs_color: [70, 62], supported_color_modes: ['hs'] }),
    st('light.kitchen', 'off', { friendly_name: 'Kitchen', supported_color_modes: ['brightness'] }),
    st('switch.coffee_machine', 'off', { friendly_name: 'Coffee Machine' }),
    st('cover.living_room_blinds', 'open', { friendly_name: 'Blinds', current_position: 100 }),
    st('scene.movie_night', 'unknown', { friendly_name: 'Movie Night' }),
    st('weather.home', 'partlycloudy', { friendly_name: 'Forecast Home', temperature: 14.5, apparent_temperature: 12.9, temperature_unit: '°C', humidity: 58, wind_speed: 12, wind_speed_unit: 'km/h', supported_features: 3 }),
    (() => { const d = new Date(), rise = new Date(d), set = new Date(d); rise.setHours(6, 52, 0, 0); set.setHours(16, 58, 0, 0); if (rise < d) rise.setDate(rise.getDate() + 1); if (set < d) set.setDate(set.getDate() + 1);
      return st('sun.sun', set < rise ? 'above_horizon' : 'below_horizon', { friendly_name: 'Sun', next_rising: rise.toISOString(), next_setting: set.toISOString() }); })(),
    st('vacuum.robo', 'docked', { friendly_name: 'Robo', battery_level: 92, status: 'Charging', supported_features: 16383 }),
    st('alarm_control_panel.home', 'disarmed', { friendly_name: 'Home Alarm', code_format: 'number', code_arm_required: false, supported_features: 7 }),
    st('sensor.living_room_co2', '720', { friendly_name: 'Living Room CO₂', unit_of_measurement: 'ppm', device_class: 'carbon_dioxide' }),
    st('sensor.living_room_pm25', '41', { friendly_name: 'PM2.5', unit_of_measurement: 'µg/m³', device_class: 'pm25' }),
    st('cover.garage_door', 'closed', { friendly_name: 'Garage Door', device_class: 'garage', current_position: 0 }),
    st('person.alex', 'home', { friendly_name: 'Alex' }),
    st('person.sam', 'not_home', { friendly_name: 'Sam' }),
    st('person.jo', 'Work', { friendly_name: 'Jo Rivera' }),
    st('camera.front_door', 'idle', { friendly_name: 'Front Door Camera' }),
    st('binary_sensor.living_room_motion', 'off', { friendly_name: 'Living Room Motion', device_class: 'motion' }),
    st('binary_sensor.doorbell', 'off', { friendly_name: 'Doorbell', device_class: 'occupancy' }),
    st('media_player.living_room_tv', 'playing', { friendly_name: 'Living Room TV', media_title: 'Nature’s Wonders', media_series_title: 'Episode 3', app_name: 'TV', source: 'TV', source_list: ['TV', 'Netflix', 'YouTube', 'Disney+', 'Prime Video', 'Plex', 'Music', 'Photos'], volume_level: 0.4, supported_features: 22463 }),
    st('remote.living_room_tv', 'on', { friendly_name: 'Living Room TV' }),
    st('media_player.kitchen_speaker', 'idle', { friendly_name: 'Kitchen', volume_level: 0.3, supported_features: 152511, group_members: [] }),
    st('media_player.bedroom_speaker', 'off', { friendly_name: 'Bedroom', volume_level: 0.2, supported_features: 152511, group_members: [] }),
    st('media_player.living_room_speaker', 'playing', { friendly_name: 'Living Room Speaker', ...DEMO_TRACKS[0], media_position: 74, media_position_updated_at: new Date().toISOString(),
      volume_level: 0.35, is_volume_muted: false, source: 'Spotify', source_list: ['Spotify', 'AirPlay', 'TV'], app_name: 'Spotify', supported_features: 152511 }),
    (() => { const t = new Date(); t.setHours(t.getHours() + 2, 30, 0, 0); const p = (n) => String(n).padStart(2, '0');
      return st('calendar.family', 'off', { friendly_name: 'Family', message: 'Dentist', all_day: false, location: 'Main St Dental', start_time: `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:00` }); })(),
    st('calendar.work', 'off', { friendly_name: 'Work' }),
    st('sensor.home_power', '1430', { friendly_name: 'Home Power', unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement' }),
    st('sensor.home_energy', '8421.6', { friendly_name: 'Energy Used', unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing' }),
    st('sensor.outdoor_temperature', '14.5', { friendly_name: 'Outside', unit_of_measurement: '°C', device_class: 'temperature' }),
    st('sensor.indoor_humidity', '46', { friendly_name: 'Humidity', unit_of_measurement: '%', device_class: 'humidity' }),
    st('binary_sensor.back_door', 'off', { friendly_name: 'Back Door', device_class: 'door' }),
  ];
}
const DEMO_AREAS = {
  'climate.living_room_ac': 'Living Room', 'water_heater.bathroom': 'Bathroom', 'lock.front_door': 'Entrance',
  'light.back_lights': 'Garden', 'light.front_lights': 'Porch', 'light.bedroom_light': 'Bedroom', 'light.entrance_light': 'Entrance',
  'light.kitchen': 'Kitchen', 'switch.coffee_machine': 'Kitchen', 'cover.living_room_blinds': 'Living Room',
  'scene.bedroom_relax': 'Bedroom', 'scene.bedroom_reading': 'Bedroom', 'scene.bedroom_night': 'Bedroom',
};

function demoForecast() {
  const now = new Date(); now.setMinutes(0, 0, 0);
  const days = ['partlycloudy', 'sunny', 'rainy', 'pouring', 'cloudy', 'sunny', 'snowy'];
  const daily = days.map((c, i) => ({ datetime: new Date(now.getTime() + i * 864e5).toISOString(), condition: c, temperature: [16, 19, 13, 11, 12, 17, 4][i], templow: [7, 9, 8, 6, 5, 8, -2][i], precipitation_probability: [10, 0, 70, 90, 30, 5, 60][i] }));
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now.getTime() + i * 36e5), hr = t.getHours();
    const night = hr < 7 || hr >= 19;
    const c = i < 5 ? (night ? 'clear-night' : 'partlycloudy') : i < 10 ? 'cloudy' : i < 15 ? 'rainy' : night ? 'clear-night' : 'sunny';
    return { datetime: t.toISOString(), condition: c, temperature: Math.round(10 + 5 * Math.sin(((hr - 9) / 24) * 2 * Math.PI)), precipitation_probability: i >= 10 && i < 15 ? 60 + i : 5 };
  });
  return { daily, hourly };
}

class DemoAdapter {
  constructor(store) { this.store = store; this.lastMode = {}; }

  async start() {
    this.store._setSnapshot({ states: demoStates(), areas: DEMO_AREAS, timers: {}, status: { connected: true, demo: true }, forecasts: { 'weather.home': demoForecast() } });
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
      if (d === 'media_player' && domain === 'music_assistant') { this.maCall(id, s, service, data); continue; }
      if (d === 'media_player') { this.media(id, s, service, data); continue; }
      if (d === 'remote') { const tv = 'media_player.' + id.split('.')[1]; if (service === 'turn_off') this.set(tv, { state: 'standby' }); else if (service === 'turn_on') this.set(tv, { state: 'paused' }); continue; }
      if (d === 'vacuum') { const m = { start: 'cleaning', pause: 'paused', return_to_base: 'returning', stop: 'idle' }[service]; if (m) { this.set(id, { state: m }); if (m === 'returning') setTimeout(() => this.set(id, { state: 'docked' }), 2500); } continue; }
      if (d === 'alarm_control_panel') {
        if (service === 'alarm_disarm') { if (data.code === '1234') this.set(id, { state: 'disarmed' }); else this.store.dispatchEvent(new CustomEvent('error', { detail: 'Wrong code (the demo code is 1234)' })); }
        else if (service.startsWith('alarm_arm_')) { this.set(id, { state: 'arming' }); setTimeout(() => this.set(id, { state: 'armed_' + service.slice(10) }), 1500); }
        else if (service === 'alarm_trigger') this.set(id, { state: 'triggered' });
        continue;
      }
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
          if (data.effect) a.effect = data.effect;
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
      else if ((service === 'open_cover' || service === 'close_cover') && s.attributes.device_class === 'garage') {
        const opening = service === 'open_cover';
        clearInterval(this.garageT?.[id]); (this.garageT ||= {})[id] = setInterval(() => {
          const p = Math.max(0, Math.min(100, (this.store.get(id).attributes.current_position ?? 0) + (opening ? 20 : -20)));
          const done = opening ? p >= 100 : p <= 0;
          this.set(id, { state: done ? (opening ? 'open' : 'closed') : opening ? 'opening' : 'closing' }, { current_position: p });
          if (done) clearInterval(this.garageT[id]);
        }, 500);
      }
      else if (service === 'open_cover') this.set(id, { state: 'open' }, { current_position: 100 });
      else if (service === 'close_cover') this.set(id, { state: 'closed' }, { current_position: 0 });
    }
  }

  async registry() {
    return { entities: { 'media_player.living_room_tv': { pl: 'apple_tv', di: 'tv1' }, 'remote.living_room_tv': { pl: 'apple_tv', di: 'tv1' }, 'media_player.living_room_speaker': { pl: 'music_assistant', di: 'sp1' }, 'media_player.kitchen_speaker': { pl: 'music_assistant', di: 'sp2' }, 'media_player.bedroom_speaker': { pl: 'music_assistant', di: 'sp3' } }, ma: ['demo'], maDomain: 'music_assistant', maServices: ['search', 'get_library', 'play_media', 'transfer_queue', 'get_queue'], searchMedia: true };
  }
  async ask(domain, service, data = {}, target = {}) {
    await new Promise((r) => setTimeout(r, 150));
    if (domain !== 'music_assistant') throw new Error('not in the demo');
    if (service === 'get_library') {
      let items = DEMO_MA[data.media_type] || [];
      if (data.favorite) items = items.filter((x) => x.favorite);
      if (data.search) items = items.filter((x) => x.name.toLowerCase().includes(data.search.toLowerCase()));
      return { items: items.slice(data.offset || 0, (data.offset || 0) + (data.limit || 50)), media_type: data.media_type };
    }
    if (service === 'search') {
      const q = (data.name || '').toLowerCase(), out = {};
      for (const [t, list] of Object.entries(DEMO_MA)) out[t + 's'] = list.filter((x) => x.name.toLowerCase().includes(q) || x.artists?.some((a) => a.name.toLowerCase().includes(q)));
      out.radio = out.radios; delete out.radios;
      return out;
    }
    if (service === 'get_queue') {
      const id = [].concat(target.entity_id)[0], a = this.store.get(id)?.attributes || {};
      return { [id]: { active: true, current_item: a.media_title ? { name: a.media_title } : null, next_item: { name: DEMO_MA.track[(DEMO_MA.track.findIndex((t) => t.name === a.media_title) + 1) % DEMO_MA.track.length].name }, shuffle_enabled: false, repeat_mode: 'off' } };
    }
    throw new Error('not in the demo');
  }
  /** Made-up 'photos' for the demo: painted skies and hills. */
  async photos(folder) {
    if (!folder) return { roots: ['media', 'share'], files: [] };
    const files = Array.from({ length: 6 }, (_, i) => `demo/${i}`);
    const now = new Date();
    // Two of the demo "photos" were taken on this day in past years.
    const dates = files.map((_, i) => (i < 2 ? new Date(now.getFullYear() - (i + 2), now.getMonth(), now.getDate(), 15).getTime() : new Date(now.getFullYear() - 1, (now.getMonth() + i * 2) % 12, 9).getTime()));
    return { roots: ['media', 'share'], files, dates };
  }
  photoUrl(f) {
    const i = Number(f.split('/').pop()) || 0;
    const P = [['#ff9a8b', '#ff6a88', '#3a1c71', '#2d1b4e'], ['#a1c4fd', '#c2e9fb', '#4b7f52', '#2f5a3a'], ['#f6d365', '#fda085', '#7a4b2a', '#4a2c17'], ['#0f2027', '#2c5364', '#16222a', '#0b1116'], ['#ffecd2', '#fcb69f', '#5d8a8a', '#33585a'], ['#89f7fe', '#66a6ff', '#e0c3fc', '#8ec5fc']][i % 6];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${P[0]}'/><stop offset='1' stop-color='${P[1]}'/></linearGradient></defs><rect width='1600' height='1000' fill='url(%23s)'/><circle cx='${400 + i * 170}' cy='${300 + (i % 3) * 60}' r='90' fill='white' opacity='.55'/><path d='M0 700 Q400 ${520 + i * 20} 800 680 T1600 640 V1000 H0Z' fill='${P[2]}'/><path d='M0 820 Q500 ${700 + i * 15} 1000 800 T1600 780 V1000 H0Z' fill='${P[3]}'/></svg>`;
    return 'data:image/svg+xml;utf8,' + svg.replace(/#/g, '%23').replace(/%23s\)/g, '%23s)');
  }
  /** Made-up events for the demo calendars. */
  async events(id, start, end) {
    const day = (n, hh, mm) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); if (hh != null) d.setHours(hh, mm || 0); return d; };
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ev = (summary, s, e, location = '') => ({ summary, location, start: s.toISOString(), end: e.toISOString(), allDay: false });
    const all = (summary, n) => ({ summary, location: '', start: ymd(day(n)), end: ymd(day(n + 1)), allDay: true });
    const sets = {
      'calendar.family': [ev('School drop-off', day(0, 8, 0), day(0, 8, 30)), ev('Dentist', day(0, 15, 30), day(0, 16, 15), 'Main St Dental'), ev('Pizza night', day(0, 18, 30), day(0, 20, 0)),
        all('Trash day', 1), ev('Soccer practice', day(1, 17, 0), day(1, 18, 30), 'Riverside Park'), ev('Book club', day(2, 19, 0), day(2, 21, 0)), all('Grandma visiting', 3), ev('Farmers market', day(4, 9, 0), day(4, 11, 0))],
      'calendar.work': [ev('Stand-up', day(0, 9, 30), day(0, 9, 45)), ev('Design review', day(1, 13, 0), day(1, 14, 0)), ev('1:1', day(2, 11, 0), day(2, 11, 30))],
    };
    return (sets[id] || []).filter((e) => new Date(e.end) > start && new Date(e.start) < end);
  }

  /** Made-up history around the sensor's current value (a daily wave and a little noise). */
  async history(id, hours) {
    const s = this.store.get(id), now = Date.now(), v = Number(s?.state);
    if (!Number.isFinite(v)) return [];
    const total = /energy|kwh/i.test(s.attributes?.unit_of_measurement || '') || s.attributes?.state_class === 'total_increasing';
    const n = Math.min(400, hours * 12), pts = [];
    let seed = id.length * 97;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i <= n; i++) {
      const t = now - hours * 3600e3 * (1 - i / n);
      const hr = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      const val = total ? v - (n - i) * ((hours * 1.1) / n) : v + Math.sin(((hr - 15) / 24) * 2 * Math.PI) * Math.max(1, Math.abs(v) * 0.12) + (rnd() - 0.5) * Math.max(0.4, Math.abs(v) * 0.03);
      pts.push([Math.round(t), Math.round(val * 10) / 10]);
    }
    pts[pts.length - 1][1] = v;
    return pts;
  }

  /** The demo media player: play/pause, tracks, volume, source, power. */
  maCall(id, s, service, data) {
    const now = new Date().toISOString();
    if (service === 'play_media') {
      const all = Object.values(DEMO_MA).flat();
      const it = all.find((x) => x.uri === data.media_id) || all[0];
      const track = it.media_type === 'track' ? it : DEMO_MA.track[all.indexOf(it) % DEMO_MA.track.length];
      if (data.enqueue === 'add' || data.enqueue === 'next') return;
      this.set(id, { state: 'playing' }, { media_title: it.media_type === 'radio' ? it.name : track.name, media_artist: it.media_type === 'radio' ? 'Live radio' : track.artists?.[0]?.name, media_album_name: it.media_type === 'album' ? it.name : 'Sunburst', entity_picture: it.image, media_duration: it.media_type === 'radio' ? null : track.duration, media_position: 0, media_position_updated_at: now });
    } else if (service === 'transfer_queue') {
      const src = this.store.get(data.source_player);
      if (!src) return;
      const keep = ['media_title', 'media_artist', 'media_album_name', 'entity_picture', 'media_duration', 'media_position'];
      this.set(id, { state: 'playing' }, { ...Object.fromEntries(keep.map((k) => [k, src.attributes[k]])), media_position_updated_at: now });
      this.set(data.source_player, { state: 'idle' }, { media_title: null, media_artist: null, entity_picture: null });
    }
  }
  media(id, s, service, data) {
    const a = s.attributes, now = new Date().toISOString();
    const pos = () => (s.state === 'playing' ? Math.min(a.media_duration || 0, (a.media_position || 0) + (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000) : a.media_position || 0);
    const track = (step) => {
      const i = (DEMO_TRACKS.findIndex((t) => t.media_title === a.media_title) + step + DEMO_TRACKS.length) % DEMO_TRACKS.length;
      this.set(id, { state: 'playing' }, { ...DEMO_TRACKS[i], media_position: 0, media_position_updated_at: now });
    };
    switch (service) {
      case 'media_play_pause': case 'toggle': this.set(id, { state: s.state === 'playing' ? 'paused' : 'playing' }, { media_position: pos(), media_position_updated_at: now }); break;
      case 'media_play': this.set(id, { state: 'playing' }, { media_position: pos(), media_position_updated_at: now }); break;
      case 'media_pause': this.set(id, { state: 'paused' }, { media_position: pos(), media_position_updated_at: now }); break;
      case 'media_next_track': track(1); break;
      case 'media_previous_track': track(-1); break;
      case 'volume_set': this.set(id, {}, { volume_level: data.volume_level, is_volume_muted: false }); break;
      case 'volume_mute': this.set(id, {}, { is_volume_muted: !!data.is_volume_muted }); break;
      case 'select_source': this.set(id, {}, { source: data.source, ...(id.endsWith('_tv') ? { app_name: data.source, media_title: data.source === 'TV' ? 'Nature’s Wonders' : null, media_series_title: data.source === 'TV' ? 'Episode 3' : null } : {}) }); break;
      case 'volume_up': case 'volume_down': this.set(id, {}, { volume_level: Math.max(0, Math.min(1, (a.volume_level || 0) + (service === 'volume_up' ? 0.05 : -0.05))) }); break;
      case 'turn_off': this.set(id, { state: 'off' }); break;
      case 'turn_on': this.set(id, { state: 'paused' }, { media_position_updated_at: now }); break;
      case 'join': this.set(id, {}, { group_members: [...new Set([id, ...(a.group_members || []), ...(data.group_members || [])])] }); break;
      case 'unjoin': for (const o of this.store.list(['media_player'])) if (o.attributes.group_members?.includes(id)) this.set(o.entity_id, {}, { group_members: o.attributes.group_members.filter((x) => x !== id) }); break;
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
// ------------------------------------------------------------------ countdowns
/** Days (and hours) until a countdown's date. Yearly ones roll on to next year once passed. */
export function countdownInfo(c, now = new Date()) {
  const [y, mo, d] = String(c.date || '').split('-').map(Number);
  const [hh, mm] = String(c.time || '').split(':').map(Number);
  const at = (yr) => new Date(yr, (mo || 1) - 1, d || 1, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
  let target = at(y || now.getFullYear());
  const dayStart = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (c.yearly) { target = at(now.getFullYear()); if (dayStart(target) < dayStart(now)) target = at(now.getFullYear() + 1); }
  const days = Math.round((dayStart(target) - dayStart(now)) / 86400000);
  const ms = target - now, hours = Math.max(0, Math.floor(ms / 3600000)), mins = Math.max(0, Math.floor(ms / 60000) % 60);
  const name = c.name || 'it';
  let text, long;
  if (days < 0) { text = `${-days} day${days === -1 ? '' : 's'} ago`; long = `${name} was ${text}`; }
  else if (days === 0) { text = c.time && ms > 0 ? `${hours ? hours + ' h ' : ''}${mins} min` : 'Today!'; long = c.time && ms > 0 ? `${text} to ${name}` : `${name} is today!`; }
  else if (days === 1) { text = 'Tomorrow'; long = `${name} is tomorrow`; }
  else { text = `${days} days`; long = `${days} days to ${name}`; }
  return { days, target, text, long, hours };
}
export const COUNTDOWN_PRESETS = [
  { name: 'Christmas', emoji: '🎄', date: '12-25', yearly: true },
  { name: 'New Year', emoji: '🎆', date: '01-01', yearly: true },
  { name: 'Halloween', emoji: '🎃', date: '10-31', yearly: true },
  { name: 'Valentine’s Day', emoji: '❤️', date: '02-14', yearly: true },
  { name: 'Independence Day', emoji: '🎇', date: '07-04', yearly: true },
  { name: 'Birthday', emoji: '🎂', date: '', yearly: true },
  { name: 'Vacation', emoji: '🏖️', date: '', yearly: false },
];

export function formatState(store, id) {
  const s = store.get(id);
  if (!s) return '—';
  const d = domainOf(id), a = s.attributes || {};
  if (d === 'countdown') return a.text;
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
