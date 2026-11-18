// The Home page: greeting, clock and tiles for Home Assistant entities.
import { icon, domainIcon } from './icons.js';
import { domainOf, isOn, lightRGB, formatState, cap } from './data.js';
import { h, press, sheet, toast, segmented } from './ui.js';
import { headerOf, headerContent, headerVars } from './header.js';
import { iconSvg } from './iconlib.js';
import { Fx, fxMode } from './fx.js';
import { remoteFor, touchpad } from './remote.js';

const TOGGLES = ['switch', 'input_boolean', 'fan', 'automation', 'siren', 'humidifier'];
const ACTIONS = ['scene', 'script', 'button', 'input_button'];
export const TIMER_OK = (id) => ['switch', 'input_boolean', 'fan', 'water_heater', 'light'].includes(domainOf(id));

export const ALL_OFF = '_alloff';
export const SCENES = '_scenes';
/** A tile's label: its custom name, or the entity's name. Accepts a tile item or an entity id. */
export const tileName = (store, x) => {
  const item = typeof x === 'string' ? { id: x } : x || {};
  return item.name || (item.id === ALL_OFF ? 'All lights off' : item.id === SCENES ? 'Scenes' : store.name(item.id));
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
  if (d === 'climate') return [{ v: 'buttons', label: 'Buttons', sub: 'Up/down buttons and modes' }, { v: 'dial', label: 'Dial', sub: 'Drag around the ring to set the temperature' }];
  if (d === 'cover') return [{ v: 'button', label: 'Button', sub: 'Tap to open or close' }, { v: 'garage', label: 'Garage door', sub: 'An animated door (tap twice to move it)' }];
  if (d === 'media_player') return [{ v: 'player', label: 'Now playing', sub: 'Artwork, title and play controls' }, { v: 'music', label: 'Music Assistant', sub: 'Now playing plus your favourites; browse, search, queue and group speakers' }, { v: 'remote', label: 'TV remote', sub: 'Arrows, OK, back, home, volume and apps (Apple TV, Roku, Android/Fire TV, LG, Samsung, Sony)' }];
  if (d === 'sensor') return [{ v: 'value', label: 'Value', sub: 'The current reading' }, { v: 'graph', label: 'Graph', sub: 'The reading over time (choose how long below)' }, { v: 'ring', label: 'Ring', sub: 'A coloured ring: green, amber, red (great for CO₂, PM2.5, AQI)' }];
  return [];
}
/** Tile kinds whose icon sits in the corner and can be moved (top left / top right / middle). */
export const ICON_MOVABLE = ['light', 'toggle', 'action', 'cover', 'sensor', 'alloff'];
export const ICON_POSITIONS = [{ v: 'tl', label: 'Top left' }, { v: 'tr', label: 'Top right' }, { v: 'center', label: 'Middle' }];
export const NAME_POSITIONS = [{ v: 'bottom', label: 'Bottom' }, { v: 'below', label: 'Under icon' }, { v: 'above', label: 'Above icon' }];
export const styleOf = (item) => item.style || (item.timer ? 'timer' : stylesFor(item.id)[0]?.v || null);
export const tileIcon = (id) => (id === ALL_OFF ? 'bulbOff' : id === SCENES ? domainIcon('scene') : domainIcon(domainOf(id)));
export const MAX_H = 6;
// Tile sizes are in columns/rows with 0.1 steps; the grid has SUB fine tracks per column and per row.
export const SUB = 10;
export const MIN_SIZE = 0.2;
export const roundSize = (v) => Math.round(Number(v) * SUB) / SUB;
export const fmtSize = (v) => String(roundSize(v));
/** A page, or one of its sections when the id is "pageId~sectionId" (sections have their own tiles). */
export const pageOf = (settings, pageId) => {
  if (!pageId) return null;
  const [pid, sid] = String(pageId).split('~');
  const p = settings?.pages?.find((x) => x.id === pid) || null;
  return sid && p ? p.sections?.find((x) => x.id === sid) || null : p;
};
/** Ready-made sections, each filled from the page's room (area) with the right kinds of device. */
export const SECTION_PRESETS = [
  { key: 'lights', name: 'Lights', icon: 'bulb', domains: ['light', 'switch', 'fan', 'scene', 'script'] },
  { key: 'climate', name: 'Climate', icon: 'thermo', domains: ['climate', 'fan', 'humidifier', 'sensor', 'weather', 'water_heater'] },
  { key: 'media', name: 'Media', icon: 'tv', domains: ['media_player'] },
  { key: 'security', name: 'Security', icon: 'lock', domains: ['lock', 'alarm_control_panel', 'camera', 'cover', 'binary_sensor'] },
  { key: 'blinds', name: 'Blinds', icon: 'blinds', domains: ['cover'] },
];

export function kindFor(item) {
  if (item.id === ALL_OFF) return 'alloff';
  if (item.id === SCENES) return 'scenes';
  const d = domainOf(item.id);
  if (d === 'countdown') return 'countdown';
  if (d === 'climate') return styleOf(item) === 'dial' ? 'thermostat' : 'climate';
  if (d === 'person' || d === 'device_tracker') return 'person';
  if (d === 'weather') return 'weather';
  const style = styleOf(item);
  if (d === 'water_heater' || (style === 'timer' && TIMER_OK(item.id))) return 'timer';
  if (d === 'lock') return 'lock';
  if (d === 'light') return style === 'switch' ? 'toggle' : 'light';
  if (TOGGLES.includes(d)) return 'toggle';
  if (d === 'media_player') return style === 'remote' ? 'remote' : style === 'music' ? 'music' : 'media';
  if (d === 'camera') return 'camera';
  if (d === 'calendar') return 'calendar';
  if (d === 'cover') return style === 'garage' ? 'garage' : 'cover';
  if (ACTIONS.includes(d)) return 'action';
  if (d === 'sensor' && style === 'graph') return 'graph';
  if (d === 'sensor' && style === 'ring') return 'airq';
  if (d === 'vacuum') return 'vacuum';
  if (d === 'alarm_control_panel') return 'alarm';
  return 'sensor';
}
/** [width in columns, height in rows] for a tile (its own size, or the default for its kind). */
export function sizeOf(item) {
  const k = kindFor(item);
  const def = k === 'thermostat' ? [1.5, 1.5] : k === 'remote' ? [1.5, 2] : k === 'music' ? [2, 1.5] : k === 'vacuum' || k === 'alarm' ? [2, 1] : k === 'scenes' ? [3, 0.6] : k === 'countdown' ? [1, 1] : ['climate', 'weather', 'media', 'camera', 'graph', 'calendar'].includes(k) ? [2, 1] : [1, 1];
  return [item.w || def[0], item.h || def[1]];
}

// ------------------------------------------------------------------ show-when helpers
/** On, open, unlocked, playing, home, running… */
export const isActive = (s) => !!s && (isOn(s) || ['open', 'opening', 'unlocked', 'unlocking', 'playing', 'home', 'detected', 'cleaning', 'heat', 'cool'].includes(s.state));
/** Is a tile's "show only when" rule met right now? */
export function showWhenMet(store, sw) {
  const s = store.get(sw.id);
  if (!s) return false;
  const v = String(sw.value ?? '').trim().toLowerCase(), st = String(s.state).toLowerCase(), n = Number(s.state);
  switch (sw.op || 'active') {
    case 'active': return isActive(s);
    case 'inactive': return !isActive(s);
    case 'is': return st === v;
    case 'not': return st !== v;
    case 'above': return Number.isFinite(n) && n > Number(v);
    case 'below': return Number.isFinite(n) && n < Number(v);
    default: return true;
  }
}

// ------------------------------------------------------------------ calendar helpers
const CAL_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff'];
/** All-day dates ("2026-11-16") are local days, not UTC midnight. */
const calDate = (v, allDay) => { if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); } return new Date(v); };
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(d) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t) / 864e5);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
/** Events from several calendars for the next `days` days, grouped by day: [[label, [ev…]], …]. */
export async function loadAgenda(store, ids, days) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + days);
  const lists = await Promise.all(ids.map((id, i) => store.events(id, start, end).then((evs) => evs.map((e) => ({ ...e, cal: id, color: CAL_COLORS[i % CAL_COLORS.length], s: calDate(e.start, e.allDay), e: calDate(e.end, e.allDay) })))));
  const all = lists.flat().filter((e) => e.e > start).sort((a, b) => (a.allDay === b.allDay ? a.s - b.s : a.allDay ? -1 : 1) || a.s - b.s);
  const groups = new Map();
  for (let i = 0; i < days; i++) { const d = new Date(start); d.setDate(d.getDate() + i); groups.set(dayKey(d), [dayLabel(d), []]); }
  for (const e of all) {
    // Multi-day events show on each day they cover.
    for (let i = 0; i < days; i++) {
      const d0 = new Date(start); d0.setDate(d0.getDate() + i);
      const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
      if (e.s < d1 && e.e > d0) groups.get(dayKey(d0))[1].push(e);
    }
  }
  return [...groups.values()];
}
function agendaHtml(groups, use24h, { hideEmptyDays = true } = {}) {
  const now = Date.now(), out = [];
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tm = (d) => d.toLocaleTimeString(undefined, { hour: use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !use24h });
  for (const [label, evs] of groups) {
    if (!evs.length && hideEmptyDays && label !== 'Today') continue;
    out.push(`<div class="cal-day">${esc(label)}</div>`);
    if (!evs.length) out.push('<div class="cal-none">Nothing planned</div>');
    for (const e of evs) {
      const past = !e.allDay && e.e.getTime() < now, live = !e.allDay && e.s.getTime() <= now && e.e.getTime() > now;
      out.push(`<div class="cal-ev${past ? ' past' : ''}${live ? ' live' : ''}" style="--cal:${e.color}"><span class="cal-bar"></span><span class="cal-time">${e.allDay ? 'All day' : esc(tm(e.s))}</span>`
        + `<span class="cal-text"><span class="cal-title">${esc(e.summary || 'Busy')}</span>${e.location ? `<span class="cal-loc">${esc(e.location)}</span>` : ''}</span>${live ? '<span class="cal-now">Now</span>' : ''}</div>`);
    }
  }
  return out.join('');
}

// ------------------------------------------------------------------ media helpers
/** Album art URL for a media player (through Facewall's server, which has Home Assistant's login). */
export function mediaArt(store, id) {
  const pic = store.get(id)?.attributes?.entity_picture;
  if (!pic) return null;
  if (store.mode === 'demo' || /^data:/.test(pic)) return pic;
  return `api/art?id=${encodeURIComponent(id)}&v=${encodeURIComponent(pic.slice(-40))}`;
}
/** Where the track is now, in seconds (Home Assistant only reports it when it changes). */
export function mediaPosition(s) {
  const a = s?.attributes || {};
  if (a.media_position == null) return null;
  const extra = s.state === 'playing' && a.media_position_updated_at ? (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000 : 0;
  return Math.max(0, Math.min(a.media_duration || Infinity, a.media_position + extra));
}
const fmtTime = (t) => (t == null || !Number.isFinite(t) ? '' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
const MEDIA_OFF = ['off', 'standby', 'unavailable', 'unknown'];

// ------------------------------------------------------------------ Music Assistant helpers
export const MA_TYPES = [{ v: 'fav', label: 'Favourites' }, { v: 'playlist', label: 'Playlists' }, { v: 'album', label: 'Albums' }, { v: 'artist', label: 'Artists' }, { v: 'track', label: 'Songs' }, { v: 'radio', label: 'Radio' }, { v: 'podcast', label: 'Podcasts' }, { v: 'audiobook', label: 'Audiobooks' }];
const maImg = (it) => {
  const i = it?.image || it?.album?.image, u = typeof i === 'string' ? i : i?.path || null;
  return u && u.startsWith('/api/') ? `api/hathumb?p=${encodeURIComponent(u)}` : u;
};
const maSub = (it) => (it?.artists || []).map((a) => a.name).filter(Boolean).join(', ') || it?.owner || (it?.media_type === 'radio' ? 'Radio' : '');
/** Is this speaker one of Music Assistant's? (by its integration, or by the attributes Music Assistant adds) */
export const isMaPlayer = (reg, s) => ['music_assistant', 'mass'].includes(reg?.entities?.[s?.entity_id]?.pl) || s?.attributes?.mass_player_type != null || s?.attributes?.active_queue != null || s?.attributes?.app_id === 'music_assistant';
/** Which Music Assistant actions this Home Assistant has: the built-in integration's (music_assistant), the older HACS one's (mass), or none. */
async function maInfo(store) {
  const r = await store.registry();
  const d = r.maDomain === undefined ? 'music_assistant' : r.maDomain;
  const sv = new Set(r.maServices || (d ? ['search', 'get_library', 'play_media', 'transfer_queue', 'get_queue'] : []));
  return { r, d, has: (x) => !!d && sv.has(x), searchMedia: r.searchMedia !== false };
}
/** Ask Music Assistant something. Adds its instance when there is one; retries without it if the action doesn't take one. */
async function maAsk(store, service, extra = {}, target) {
  const m = await maInfo(store);
  if (!m.has(service)) throw Object.assign(new Error(`Home Assistant has no ${m.d || 'music_assistant'}.${service} action`), { missing: true });
  const withEntry = m.r.ma?.[0] && !target ? { config_entry_id: m.r.ma[0], ...extra } : extra;
  try { return await store.ask(m.d, service, withEntry, target); }
  catch (e) { if (withEntry !== extra && /extra keys|config_entry_id|not a valid/i.test(e.message || '')) return store.ask(m.d, service, extra, target); throw e; }
}
/** A Home Assistant media-browser entry, shaped like a Music Assistant item. */
const fromBrowse = (b) => ({ name: b.title, uri: b.media_content_id, media_type: b.media_content_type, image: b.thumbnail, _b: true, expand: !!b.can_expand, play: !!b.can_play, cls: b.media_class });
async function maLibrary(store, type, opts = {}) {
  const r = await maAsk(store, 'get_library', { media_type: type, limit: opts.limit || 60, ...(opts.favorite ? { favorite: true } : {}), ...(opts.search ? { search: opts.search } : {}), order_by: opts.favorite ? 'timestamp_added_desc' : 'name' });
  return r?.items || [];
}
async function maFavourites(store, limit = 18) {
  let err = null;
  const lists = await Promise.all(['playlist', 'radio', 'album', 'artist'].map((t) => maLibrary(store, t, { favorite: true, limit }).catch((e) => { err ||= e; return null; })));
  if (lists.every((l) => l === null)) throw err;
  const out = [];
  for (let i = 0; out.length < limit && i < limit; i++) for (const l of lists) if (l?.[i] && out.length < limit) out.push(l[i]);
  return out;
}
async function maPlay(store, id, it, enqueue = 'play', radio = false) {
  const m = it._b ? null : await maInfo(store);
  if (m?.has('play_media')) return store.call(m.d, 'play_media', { media_id: it.uri, media_type: it.media_type, enqueue, ...(radio ? { radio_mode: true } : {}) }, { entity_id: id });
  return store.call('media_player', 'play_media', { media_content_id: it.uri, media_content_type: it.media_type || 'music', ...(enqueue !== 'play' ? { enqueue } : {}) }, { entity_id: id });
}
/** A cover picture: straight from Music Assistant, through Facewall if the iPad can't reach it, else initials. */
function maCover(it, cls = 'div.ma-cover') {
  const el = h(cls, { 'data-ini': (it?.name || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() });
  const url = maImg(it);
  if (url) {
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${img.src}")`; el.classList.add('has-img'); };
    img.onerror = () => { if (/imageproxy/.test(url) && !img.src.includes('api/maimg')) img.src = `api/maimg?u=${encodeURIComponent(url)}`; };
    img.src = url;
  }
  return el;
}

// ------------------------------------------------------------------ camera helpers
/** A demo "camera" picture: a front porch, with the time so you can see it refresh. */
function demoCamera(name) {
  const t = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1d2a3a'/><stop offset='1' stop-color='#3a4756'/></linearGradient></defs>`
    + `<rect width='640' height='360' fill='url(#s)'/><rect x='0' y='250' width='640' height='110' fill='#4a4036'/><rect x='120' y='60' width='400' height='200' fill='#6b5d4f'/>`
    + `<rect x='270' y='110' width='100' height='150' rx='4' fill='#2f7f7a'/><circle cx='355' cy='190' r='5' fill='#e8b13a'/><circle cx='230' cy='120' r='14' fill='#ffd88a' opacity='.9'/><circle cx='230' cy='120' r='40' fill='#ffd88a' opacity='.15'/>`
    + `<rect x='150' y='140' width='70' height='60' fill='#22303d'/><rect x='420' y='140' width='70' height='60' fill='#22303d'/>`
    + `<text x='14' y='26' font-family='monospace' font-size='16' fill='#fff' opacity='.85'>${name.replace(/[<&]/g, '')}</text><text x='626' y='26' text-anchor='end' font-family='monospace' font-size='16' fill='#fff' opacity='.85'>${t}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
/** Picture URL for a camera: a snapshot, or the live stream (both through Facewall's server). */
export function cameraUrl(store, id, live = false) {
  if (store.mode === 'demo') return demoCamera(store.name?.(id) || id);
  return `api/camera?id=${encodeURIComponent(id)}${live ? '&live=1' : `&t=${Date.now()}`}`;
}
const onScreen = (el) => { const r = el.getBoundingClientRect(); return !document.hidden && r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; };

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
  if (k === 'sensor' || k === 'weather' || k === 'scenes') return [{ key: 'offColor', label: 'Tile colour', def: 'Default' }];
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
      resize: () => { if (this.layout()) this.render(); else this.fit(); },
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
    this.musicV?.destroy();
    this.fx?.stop();
    window.removeEventListener('resize', this.handlers.resize);
    clearInterval(this.interval);
    this.root.remove();
  }

  get page() { return pageOf(this.store.settings, this.pageId); }
  /** The section on show (its id), or null for the page's main tiles. */
  get vid() { return this.view && this.page?.sections?.some((x) => x.id === this.view) ? `${this.pageId}~${this.view}` : this.pageId; }
  get items() { return pageOf(this.store.settings, this.vid)?.entities || []; }
  showSection(id) { this.view = id || null; this.grid && (this.grid.scrollTop = 0); this.render(); }
  /** Sidebar: 'panel' (time, date, info and a menu with live summaries) or 'icons' (the compact rail). */
  get panelMode() { const pg = this.page; return !!pg && (pg.sidebar === 'panel' || (pg.sidebar == null && (pg.sections || []).length > 0)); }
  /** One line about a set of tiles: alerts first, then what's on, heating or playing. */
  summaryFor(items) {
    const st = this.store;
    let lights = 0, heat = 0, cool = 0, playing = 0, alerts = 0;
    for (const it of items || []) {
      const s = st.get(it.id); if (!s) continue;
      const d = domainOf(it.id), a = s.attributes || {};
      if (['light', 'switch', 'fan', 'input_boolean'].includes(d) && s.state === 'on') lights++;
      if (d === 'climate') { if (a.hvac_action === 'heating') heat++; else if (a.hvac_action === 'cooling') cool++; }
      if (d === 'media_player' && s.state === 'playing') playing++;
      if (d === 'lock' && ['unlocked', 'open', 'jammed'].includes(s.state)) alerts++;
      if (d === 'alarm_control_panel' && s.state === 'triggered') alerts++;
      if (d === 'binary_sensor' && s.state === 'on' && ['door', 'window', 'garage_door', 'smoke', 'moisture', 'gas', 'safety', 'problem'].includes(a.device_class)) alerts++;
      if (d === 'cover' && a.device_class === 'garage' && s.state === 'open') alerts++;
    }
    if (alerts) return { text: `${alerts} alert${alerts > 1 ? 's' : ''}`, cls: 'alert' };
    if (heat) return { text: `${heat} heating` };
    if (cool) return { text: `${cool} cooling` };
    if (lights) return { text: `${lights} on` };
    if (playing) return { text: 'Playing' };
    return { text: '' };
  }
  /** What the sidebar shows under the date: the page's own picks, or indoor temperature and the weather. */
  sideInfoIds() {
    const pg = this.page, st = this.store;
    if (pg?.sideInfo?.length) return pg.sideInfo.filter((x) => st.get(x.id));
    const out = [];
    const all = [...(pg?.entities || []), ...(pg?.sections || []).flatMap((x) => x.entities || [])].map((e) => e.id);
    const area = pg?.area || [...new Set(Object.values(st.areas || {}))].find((a) => a.toLowerCase() === (pg?.name || '').toLowerCase());
    const temp = all.find((id) => st.get(id)?.attributes?.device_class === 'temperature')
      || (area && st.list(['sensor']).find((x) => x.attributes?.device_class === 'temperature' && st.area(x.entity_id) === area)?.entity_id)
      || all.find((id) => domainOf(id) === 'climate' && st.get(id)?.attributes?.current_temperature != null);
    if (temp) out.push({ id: temp, label: 'indoors' });
    const wx = st.settings?.header?.weather || st.list(['weather'])[0]?.entity_id;
    if (wx && st.get(wx)) out.push({ id: wx, label: 'outdoors' });
    return out;
  }
  rail() {
    const pg = this.page, secs = pg?.sections || [];
    const panel = this.panelMode;
    if (!secs.length && !panel) return null;
    const cur = this.vid === this.pageId ? null : this.view;
    if (!panel) {
      const btn = (id, name, ic) => h('button.rail-btn' + (cur === id ? '.on' : ''), { 'aria-label': name, onclick: () => this.showSection(id) },
        h('span.rail-ic', { html: icon(ic || 'grid') }), h('span.rail-name', { text: name }));
      return h('nav.home-rail', {},
        btn(null, pg.mainName || 'All', pg.mainIcon || 'home'),
        ...secs.map((x) => btn(x.id, x.name, x.icon)),
        this.editing ? h('button.rail-btn.rail-add', { 'aria-label': 'Sections', onclick: () => this.app.sectionsEditor(this.pageId) }, h('span.rail-ic', { html: icon('sliders') }), h('span.rail-name', { text: 'Sections' })) : null);
    }
    // The full sidebar.
    this.side = { time: h('div.side-time'), date: h('div.side-date'), info: h('div.side-info'), sums: [] };
    const item = (id, name, ic, items) => {
      const sum = h('span.side-sum');
      this.side.sums.push([sum, items]);
      return h('button.side-item' + (cur === id ? '.on' : ''), { onclick: () => this.showSection(id) },
        h('span.side-ic', { html: icon(ic || 'grid') }), h('span.side-name', { text: name }), sum);
    };
    const menu = secs.length ? h('div.side-menu', {},
      item(null, pg.mainName || 'All', pg.mainIcon || 'home', pg.entities),
      ...secs.map((x) => item(x.id, x.name, x.icon, x.entities))) : h('div.side-menu');
    this.side.status = h('span.side-status');
    const nav = h('nav.home-side', {},
      h('div.side-page', { text: this.isHome ? '' : pg.name || '' }),
      this.side.time, this.side.date, this.side.info,
      h('div.side-spacer'),
      menu,
      h('div.side-foot', {}, this.side.status,
        h('button.side-btn', { html: icon('grid'), 'aria-label': 'Edit layout', onclick: () => this.setEditing(!this.editing) }),
        h('button.side-btn', { html: icon('clock'), 'aria-label': 'Clock', onclick: () => this.app.goTo(0) }),
        h('button.side-btn', { html: icon('sliders'), 'aria-label': 'Settings', onclick: () => this.app.openSettings({ page: this.pageId }) })));
    press(this.side.info, { onLong: () => this.app.sectionsEditor(this.pageId) });
    this.updateSide();
    return nav;
  }
  updateSide() {
    const sd = this.side;
    if (!sd || !sd.time.isConnected && !this.root.contains(sd.time)) return;
    const st = this.store, now = new Date(), use24h = st.settings?.general?.use24h;
    const t = now.toLocaleTimeString(undefined, { hour: use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !use24h }).replace(/\s?[AP]\.?M\.?$/i, '');
    if (sd.time.textContent !== t) sd.time.textContent = t;
    const d = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    if (sd.date.textContent !== d) sd.date.textContent = d;
    const rows = this.sideInfoIds().map(({ id, label }) => {
      const s = st.get(id), a = s?.attributes || {}, dm = domainOf(id);
      let val, ic, lab = label;
      if (dm === 'weather') { val = a.temperature != null ? `${fmtNum(a.temperature)} ${a.temperature_unit || '°'}` : wxLabel(s.state); ic = iconHtml(st, { icon: wxIcon(s.state, st.get('sun.sun')?.state === 'below_horizon') }, 'sun'); lab ??= wxLabel(s.state).toLowerCase(); }
      else if (dm === 'climate') { val = a.current_temperature != null ? `${fmtNum(a.current_temperature)} °` : cap(s.state); ic = icon('thermo'); }
      else if (dm === 'countdown') { val = a.text; ic = `<span class="side-emoji">${a.emoji || '⏳'}</span>`; lab ??= `to ${a.friendly_name}`; }
      else { val = formatState(st, id); ic = a.device_class === 'temperature' ? icon('thermo') : iconHtml(st, { id }, 'gauge'); }
      return [ic, val, lab ?? st.name(id)];
    });
    const key = JSON.stringify(rows);
    if (key !== sd.infoKey) {
      sd.infoKey = key;
      sd.info.replaceChildren(...rows.map(([ic, val, lab]) => h('div.side-row', {}, h('span.side-row-ic', { html: ic }), h('div', {}, h('div.side-val', { text: val }), h('div.side-lab', { text: lab })))));
    }
    for (const [el, items] of sd.sums) { const r = this.summaryFor(items); el.textContent = r.text; el.className = 'side-sum' + (r.cls ? ' ' + r.cls : ''); }
    const conn = st.status?.connected !== false;
    sd.status.textContent = st.mode === 'demo' ? 'Demo' : conn ? 'Connected' : 'Reconnecting…';
    sd.status.classList.toggle('off', !conn && st.mode !== 'demo');
  }
  /** The first page called "Home" keeps the greeting as its title; room pages show their name. */
  get isHome() { return !this.page || /^home$/i.test(this.page.name || ''); }

  render() {
    const s = this.store.settings;
    if (!s) return;
    const scroll = this.grid?.scrollTop || 0;
    this.cards.forEach((c) => c.destroy?.());
    this.root.innerHTML = '';
    this.cards = [];
    this.side = null;
    this.musicV?.destroy(); this.musicV = null; clearTimeout(this._musicWait);
    if (this.page?.kind === 'music') return this.renderMusic();
    this.root.classList.remove('music-page');
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
    this.fxCanvas ||= h('canvas.home-fx', { 'aria-hidden': 'true' });
    this.fx ||= new Fx(this.fxCanvas, () => this.fxNow, () => this.store.settings?.general?.fx?.amount || 'some');
    this.fxNow = fxMode(this.store, this.store.settings);
    const rail = this.rail();
    this.root.classList.toggle('has-panel', !!rail && this.panelMode);
    this.root.classList.toggle('has-rail', !!rail && !this.panelMode);
    if (this.app.currentRoom === this) { document.body.classList.toggle('rail-page', !!rail && !this.panelMode); document.body.classList.toggle('panel-page', !!rail && this.panelMode); }
    this.root.append(h('div.home-bg'), h('div.home-wall'), this.fxCanvas, head, this.grid, ...(rail ? [rail] : []));
    this.fx.start();
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
      this.dress(card, item);
      this.cards.push(card); this.grid.append(card.el); card.update();
    });
    if (!this.cards.length) {
      this.grid.append(h('div.empty', {},
        h('div.empty-title', { text: 'No tiles yet' }),
        h('div.empty-sub', { text: 'Pick the devices you want on this page.' }),
        h('button.pill.primary', { text: 'Choose devices', onclick: () => this.app.entityBrowser(this.vid, () => this.render()) })));
    }
    if (this.editing) this.root.append(this.editBar());
    this.fit();
    requestAnimationFrame(() => this.fit());
    this.grid.scrollTop = scroll;
    this.root.scrollTop = 0;
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
    const headPx = this.root.classList.contains('has-panel') ? Math.round(pad * 0.6) : Math.max(base, titles ? Math.ceil(titles.scrollHeight) + 14 : 0);
    const head = this.root.querySelector('.home-head');
    if (head) head.style.height = `calc(${headPx}px + var(--sa-top, env(safe-area-inset-top)))`;
    const headH = headPx + 8;
    const reserve = this.editing ? 84 : 0; // room for the edit bar
    // One row = the screen height shared by `rows` (each tile keeps half a gap of margin all round).
    const availH = H - headH - reserve - (pad - gap / 2);
    const unitH = Math.max(90, availH / rows);
    this.availH = availH;
    const changed = this.cols !== cols;
    Object.assign(this, { cols, rows, gap, unitH, rowH: unitH - gap });
    this.root.style.setProperty('--subcols', cols * SUB);
    this.root.style.setProperty('--gap', gap + 'px');
    this.root.style.setProperty('--subrow-h', (unitH / SUB).toFixed(3) + 'px');
    if (!changed) this.fit();
    return changed;
  }

  /** Fit to screen: stretch or shrink the rows so the tiles you placed exactly fill the space, in any orientation. */
  fit() {
    const L = this.page?.layout || {};
    if (L.fit === false || !this.grid || !this.root.clientHeight) return;
    const cards = [...this.grid.children].filter((c) => c.style.gridRow && c.offsetParent !== null);
    if (!cards.length) return;
    const sub = this.unitH / SUB;
    const top = this.grid.getBoundingClientRect().top + parseFloat(getComputedStyle(this.grid).paddingTop) - this.grid.scrollTop;
    let bottom = 0;
    for (const c of cards) bottom = Math.max(bottom, c.getBoundingClientRect().bottom + this.gap / 2 - top);
    const used = Math.round(bottom / sub);
    if (!used) return;
    // Very long pages still scroll rather than squash tiles to nothing.
    const unit = Math.max(70, this.availH / (used / SUB));
    if (Math.abs(unit - this.unitH) < 0.5) return;
    this.unitH = unit; this.rowH = unit - this.gap;
    this.root.style.setProperty('--subrow-h', (unit / SUB).toFixed(3) + 'px');
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
    const save = (fn) => { this.app.update((s) => fn(pageOf(s, this.vid).entities)); this.render(); };
    const last = this.items.length - 1;
    const handle = h('div.eo-handle', { html: icon('resize'), 'aria-label': 'Drag to resize' });
    const ov = h('div.edit-ov', {},
      h('button.eo-remove', { 'aria-label': 'Remove', html: icon('close'), onclick: () => save((a) => a.splice(index, 1)) }),
      h('div.eo-move', {},
        h('button', { 'aria-label': 'Move earlier', html: icon('back'), disabled: index === 0, onclick: () => save((a) => a.splice(index - 1, 0, a.splice(index, 1)[0])) }),
        h('button.flip', { 'aria-label': 'Move later', html: icon('back'), disabled: index === last, onclick: () => save((a) => a.splice(index + 1, 0, a.splice(index, 1)[0])) })),
      label,
      h('button.eo-opts', { html: icon('sliders') + '<span>Options</span>', 'aria-label': 'Tile options (style, icon, name)', onclick: () => this.app.tileOptions(this.vid, index) }),
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
      h('button.pill', { html: icon('plus') + '<span>Add tiles</span>', onclick: () => this.app.entityBrowser(this.vid, () => this.render()) }),
      h('button.pill', { html: icon('sliders') + '<span>Sections</span>', onclick: () => this.app.sectionsEditor(this.pageId) }),
      h('button.pill.primary', { text: 'Done', onclick: () => this.setEditing(false) }));
  }

  tick() {
    if (this.fx) this.fxNow = fxMode(this.store, this.store.settings);
    if (this.side) this.updateSide();
    if ((this._fitN = (this._fitN || 0) + 1) % 2 === 0) this.fit(); // tiles that show/hide on their own
    const now = new Date();
    if (!this.greet) return;
    if (this.hdFor !== this.store.settings && this.head) this.applyHeaderStyle(this.head);
    const hd = this.hd || headerOf(this.store.settings);
    const { title, html } = headerContent(this.store, hd, now, { isHome: this.isHome, pageName: this.page?.name });
    if (this.greet.textContent !== title) this.greet.textContent = title;
    if (html !== this.lastLine) { this.date.innerHTML = html; this.lastLine = html; this.date.style.display = html ? '' : 'none'; this.layout(); }
    const use24h = this.store.settings?.general?.use24h;
    this.time.textContent = now.toLocaleTimeString(undefined, { hour: use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !use24h });
    for (const c of this.cards) { if (c.timer && this.store.timers[c.id]) c.update(); c.tick?.(); }
  }

  onState(id) {
    for (const c of this.cards) if (c.id === id || (c.watch && c.watch.includes(id)) || c.deps?.has(id)) c.update();
  }

  // ------------------------------------------------------------------ show-when and badges
  /** Lights a badge counts: a light group's members, the page's lights (All off), or the lights in the tile's room. */
  badgeLights(item) {
    if (item.id === ALL_OFF) return [...new Set(this.items.filter((i) => domainOf(i.id) === 'light').map((i) => i.id))];
    const members = this.store.get(item.id)?.attributes?.entity_id;
    if (Array.isArray(members) && members.length) return members.filter((m) => domainOf(m) === 'light');
    const area = this.store.area(item.id);
    return area ? Object.keys(this.store.areas || {}).filter((e) => this.store.areas[e] === area && domainOf(e) === 'light') : [];
  }
  /** Add the tile's show-when rule and badge on top of its own update. */
  dress(card, item) {
    const sw = item.showWhen, bd = item.badge;
    if (!sw?.id && !bd?.k) return;
    const deps = new Set();
    if (sw?.id) deps.add(sw.id);
    if (bd?.k === 'entity' && bd.id) deps.add(bd.id);
    const lights = bd?.k === 'lights' ? this.badgeLights(item) : [];
    for (const l of lights) deps.add(l);
    card.deps = deps;
    const badge = bd?.k ? h('div.tile-badge') : null;
    if (badge) card.el.append(badge);
    const base = card.update, baseTick = card.tick;
    let lastSince = 0;
    const decorate = () => {
      if (sw?.id) {
        const show = showWhenMet(this.store, sw);
        card.el.classList.toggle('cond-hidden', !show);
      }
      if (!badge) return;
      let text = '', alert = false;
      if (bd.k === 'since') {
        const s = this.store.get(item.id);
        if (s && isActive(s) && s.last_changed) {
          const min = (Date.now() - new Date(s.last_changed).getTime()) / 60000;
          text = min < 1 ? 'now' : min < 60 ? `${Math.floor(min)} min` : `${Math.floor(min / 60)} h ${Math.floor(min % 60)} m`;
          alert = !!bd.alertMin && min >= bd.alertMin;
        }
      } else if (bd.k === 'lights') {
        const n = lights.filter((l) => isOn(this.store.get(l))).length;
        text = n ? `${n} on` : '';
      } else if (bd.k === 'entity' && bd.id && this.store.get(bd.id)) text = formatState(this.store, bd.id);
      badge.textContent = text;
      badge.style.display = text ? '' : 'none';
      badge.classList.toggle('alert', alert);
    };
    card.update = () => { base(); decorate(); };
    card.tick = () => { baseTick?.(); if (bd?.k === 'since' && Date.now() - lastSince > 15000) { lastSince = Date.now(); decorate(); } };
  }

  // ------------------------------------------------------------------ cards
  makeCard(item) {
    const kind = kindFor(item);
    if (kind === 'alloff') return this.allOffCard([...new Set(this.items.filter((i) => domainOf(i.id) === 'light').map((i) => i.id))], item);
    const fn = { weather: this.weatherCard, climate: this.climateCard, timer: this.timerCard, lock: this.lockCard, light: this.lightCard, toggle: this.toggleCard, cover: this.coverCard, action: this.actionCard, sensor: this.sensorCard, media: this.mediaCard, camera: this.cameraCard, scenes: this.scenesCard, graph: this.graphCard, calendar: this.calendarCard, thermostat: this.thermostatCard, garage: this.garageCard, person: this.personCard, vacuum: this.vacuumCard, alarm: this.alarmCard, airq: this.airqCard, remote: this.remoteCard, music: this.musicCard, countdown: this.countdownCard }[kind];
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

  // ------------------------------------------------------------------ thermostat dial
  thermostatCard(id, item = { id }) {
    const st = this.store;
    const MODE_COLOR = { cool: '#3a8dff', heat: '#ff8a3d', heat_cool: '#30d158', auto: '#30d158', dry: '#ffd60a', fan_only: '#64d2ff', off: '#8e8e93' };
    const MODE_LABEL = { cool: 'Cooling', heat: 'Heating', heat_cool: 'Auto', auto: 'Auto', dry: 'Drying', fan_only: 'Fan', off: 'Off' };
    const NS = 'http://www.w3.org/2000/svg', S = 200, C = S / 2, R = 82, A0 = 135, SWEEP = 270;
    const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
    const svg = mk('svg', { viewBox: `0 0 ${S} ${S}`, class: 'th-svg' });
    const pt = (deg, r = R) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
    const arc = (a1, a2, r = R) => { const [x1, y1] = pt(a1, r), [x2, y2] = pt(a2, r); return `M${x1} ${y1} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
    mk('path', { d: arc(A0, A0 + SWEEP), class: 'th-track' }, svg);
    for (let i = 0; i <= 54; i++) { const a = A0 + (SWEEP * i) / 54; const [x1, y1] = pt(a, R - 13), [x2, y2] = pt(a, R - (i % 6 ? 16 : 19)); mk('line', { x1, y1, x2, y2, class: 'th-tick' }, svg); }
    const fill = mk('path', { class: 'th-fill' }, svg);
    const cur = mk('circle', { r: 4, class: 'th-cur' }, svg);
    const knob = mk('circle', { r: 10, class: 'th-knob' }, svg);
    const big = h('div.th-temp'), sub = h('div.th-sub');
    const modeBtn = h('button.th-mode'), pwr = h('button.round-btn.th-pwr', { html: icon('power'), 'aria-label': 'Power' });
    const el = h('div.card.thermo', {}, h('div.card-head-row', {}, this.headEl(id, 'snow', item), pwr),
      h('div.th-wrap', {}, svg, h('div.th-center', {}, big, sub, modeBtn)));
    let pending = null, sendT = null, clearT = null, lastMode = null, dragging = false;
    const s0 = () => st.get(id);
    const lim = () => { const a = s0()?.attributes || {}; const f = a.temperature_unit === '°F' || a.unit_of_measurement === '°F'; return { min: a.min_temp ?? (f ? 50 : 10), max: a.max_temp ?? (f ? 90 : 32), step: a.target_temp_step || (f ? 1 : 0.5) }; };
    const target = () => pending ?? s0()?.attributes?.temperature ?? null;
    const angleOf = (v) => { const { min, max } = lim(); return A0 + SWEEP * Math.min(1, Math.max(0, (v - min) / (max - min))); };
    const send = () => { clearTimeout(sendT); clearTimeout(clearT); sendT = setTimeout(() => { st.call('climate', 'set_temperature', { temperature: pending }, { entity_id: id }); clearT = setTimeout(() => { pending = null; update(); }, 4000); }, 500); };
    const fromPointer = (e) => {
      const r = svg.getBoundingClientRect();
      let a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
      if (a < 0) a += 360;
      let rel = a - A0; if (rel < 0) rel += 360;
      if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
      const { min, max, step } = lim();
      pending = Math.round((min + (rel / SWEEP) * (max - min)) / step) * step;
      update();
    };
    svg.addEventListener('pointerdown', (e) => { if (this.editing || s0()?.state === 'off') return; dragging = true; svg.setPointerCapture(e.pointerId); fromPointer(e); e.stopPropagation(); });
    svg.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
    const end = () => { if (dragging) { dragging = false; send(); } };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    modeBtn.onclick = () => {
      const s = s0(); if (!s) return;
      const list = (s.attributes.hvac_modes || []).filter((m) => MODE_COLOR[m]);
      const next = list[(list.indexOf(s.state) + 1) % list.length];
      if (next) st.call('climate', 'set_hvac_mode', { hvac_mode: next }, { entity_id: id });
    };
    pwr.onclick = () => {
      const s = s0(); if (!s) return;
      if (s.state !== 'off') { lastMode = s.state; st.call('climate', 'set_hvac_mode', { hvac_mode: 'off' }, { entity_id: id }); }
      else { const m = (s.attributes.hvac_modes || []).filter((x) => x !== 'off'); st.call('climate', 'set_hvac_mode', { hvac_mode: lastMode && m.includes(lastMode) ? lastMode : m[0] }, { entity_id: id }); }
    };
    const update = () => {
      const s = s0(), a = s?.attributes || {}, t = target(), mode = s?.state || 'off';
      const col = MODE_COLOR[mode] || MODE_COLOR.auto;
      el.style.setProperty('--th', col);
      el.classList.toggle('off', mode === 'off');
      if (mode !== 'off') lastMode = mode;
      big.innerHTML = t == null ? '--' : `${fmtTemp(t)}<span>°</span>`;
      sub.textContent = [a.current_temperature != null ? `Inside ${fmtTemp(a.current_temperature)}°` : '', a.hvac_action ? cap(a.hvac_action.replace(/_/g, ' ')) : ''].filter(Boolean).join(' · ');
      modeBtn.textContent = MODE_LABEL[mode] || cap(mode);
      if (t != null) { const ang = angleOf(t); fill.setAttribute('d', arc(A0, Math.max(A0 + 0.01, ang))); const [kx, ky] = pt(ang); knob.setAttribute('cx', kx); knob.setAttribute('cy', ky); }
      if (a.current_temperature != null) { const [cx2, cy2] = pt(angleOf(a.current_temperature), R - 24); cur.setAttribute('cx', cx2); cur.setAttribute('cy', cy2); cur.style.display = ''; } else cur.style.display = 'none';
    };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ garage door
  garageCard(id, item = { id }) {
    const st = this.store;
    const panels = h('div.gd-panels', {}, ...[0, 1, 2, 3].map(() => h('i')));
    const door = h('div.gd-door', {}, h('div.gd-opening', {}, h('div.gd-car')), panels);
    const label = h('div.tile-state'), hint = h('div.tile-hint');
    const el = h('div.card.garage', {}, h('div.gd-house', {}, h('div.gd-roof'), door), h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) }), label, hint));
    let armed = null;
    press(el, { onTap: () => {
      const s = st.get(id); if (!s) return;
      const open = ['open', 'opening'].includes(s.state);
      if (!armed) { hint.textContent = open ? 'Tap again to close' : 'Tap again to open'; armed = setTimeout(() => { armed = null; hint.textContent = ''; }, 3000); return; }
      clearTimeout(armed); armed = null; hint.textContent = '';
      st.call('cover', open ? 'close_cover' : 'open_cover', {}, { entity_id: id });
    } });
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      const pos = a.current_position ?? (s?.state === 'open' ? 100 : s?.state === 'opening' ? 60 : s?.state === 'closing' ? 40 : 0);
      el.style.setProperty('--gd', `${100 - pos}%`);
      el.classList.toggle('on', !!s && s.state !== 'closed');
      el.classList.toggle('moving', ['opening', 'closing'].includes(s?.state));
      label.textContent = !s ? 'Missing' : cap(s.state) + (a.current_position != null && !['open', 'closed'].includes(s.state) ? ` · ${a.current_position}%` : '');
    };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ vacuum
  vacuumCard(id, item = { id }) {
    const st = this.store;
    const call = (svc) => st.call('vacuum', svc, {}, { entity_id: id });
    const bot = h('div.vc-bot', {}, h('i'));
    const state = h('div.vc-state'), batt = h('div.vc-batt');
    const go = h('button.pill.sm.vc-go'), dock = h('button.pill.sm', { html: icon('home') + '<span>Dock</span>' }), find = h('button.pill.sm', { html: icon('bell') + '<span>Find</span>' });
    go.onclick = (e) => { e.stopPropagation(); call(st.get(id)?.state === 'cleaning' ? 'pause' : 'start'); };
    dock.onclick = (e) => { e.stopPropagation(); call('return_to_base'); };
    find.onclick = (e) => { e.stopPropagation(); call('locate'); toast('It should beep now'); };
    const el = h('div.card.vacuum', {}, h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'auto') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) }))),
      h('div.vc-main', {}, bot, h('div', {}, state, batt)), h('div.vc-ctl', {}, go, dock, find));
    const LABEL = { cleaning: 'Cleaning', docked: 'Docked', returning: 'Going home', paused: 'Paused', idle: 'Idle', error: 'Needs help' };
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      const v = s?.state || 'unavailable';
      el.classList.toggle('on', v === 'cleaning' || v === 'returning');
      el.classList.toggle('err', v === 'error');
      state.textContent = LABEL[v] || cap(v);
      const b = a.battery_level;
      batt.textContent = b != null ? `Battery ${Math.round(b)}%${a.status && a.status.toLowerCase() !== v ? ` · ${a.status}` : ''}` : a.status || '';
      go.innerHTML = icon(v === 'cleaning' ? 'pause' : 'play') + `<span>${v === 'cleaning' ? 'Pause' : 'Clean'}</span>`;
    };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ alarm panel
  alarmCard(id, item = { id }) {
    const st = this.store;
    const LABEL = { disarmed: 'Disarmed', armed_home: 'Armed · Home', armed_away: 'Armed · Away', armed_night: 'Armed · Night', armed_vacation: 'Armed · Vacation', armed_custom_bypass: 'Armed', arming: 'Arming…', pending: 'Entry delay…', disarming: 'Disarming…', triggered: 'ALARM' };
    const state = h('div.al-state'), btns = h('div.al-ctl');
    const el = h('div.card.alarm', {}, h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'lock') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) }))),
      h('div.al-main', {}, h('span.al-shield', { html: icon('lock') }), state), btns);
    const act = (svc, needsCode) => {
      const a = st.get(id)?.attributes || {};
      if (needsCode && a.code_format) this.keypad(a.code_format === 'number', svc.includes('disarm') ? 'Disarm' : 'Arm', (code) => st.call('alarm_control_panel', svc, { code }, { entity_id: id }));
      else st.call('alarm_control_panel', svc, {}, { entity_id: id });
    };
    const update = () => {
      const s = st.get(id), a = s?.attributes || {}, v = s?.state || 'unavailable';
      const armed = v.startsWith('armed'), trig = v === 'triggered';
      el.classList.toggle('armed', armed); el.classList.toggle('trig', trig); el.classList.toggle('busy', ['arming', 'pending', 'disarming'].includes(v));
      state.textContent = LABEL[v] || cap(v);
      btns.innerHTML = '';
      const feat = Number(a.supported_features ?? 63);
      if (v === 'disarmed') {
        if (feat & 1) btns.append(h('button.pill.sm', { text: 'Home', onclick: (e) => { e.stopPropagation(); act('alarm_arm_home', a.code_arm_required); } }));
        if (feat & 2) btns.append(h('button.pill.sm', { text: 'Away', onclick: (e) => { e.stopPropagation(); act('alarm_arm_away', a.code_arm_required); } }));
        if (feat & 4) btns.append(h('button.pill.sm', { text: 'Night', onclick: (e) => { e.stopPropagation(); act('alarm_arm_night', a.code_arm_required); } }));
      } else if (s) btns.append(h('button.pill.sm.al-off', { text: 'Disarm', onclick: (e) => { e.stopPropagation(); act('alarm_disarm', true); } }));
      // The whole screen shows it: a red edge while armed, pulsing when triggered.
      document.body.classList.toggle('alarm-armed', armed);
      document.body.classList.toggle('alarm-triggered', trig);
    };
    return { id, el, update };
  }

  /** A number (or text) keypad for alarm codes. */
  keypad(numeric, action, done) {
    let code = '';
    const dots = h('div.kp-dots');
    const sh = sheet({ title: `Enter code to ${action.toLowerCase()}`, cls: 'keypad-sheet' });
    const draw = () => { dots.textContent = code ? '•'.repeat(code.length) : ' '; };
    const go = () => { if (!code) return; sh.close(); done(code); };
    if (numeric) {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
      sh.body.append(dots, h('div.kp-grid', {}, keys.map((k) => h('button.kp-key' + (k === '✓' ? '.ok' : ''), { text: k, onclick: () => { if (k === '⌫') code = code.slice(0, -1); else if (k === '✓') return go(); else code += k; draw(); } }))));
    } else {
      const inp = h('input.text-in.wide-in', { type: 'password', autocomplete: 'off', onkeydown: (e) => { if (e.key === 'Enter') { code = inp.value; go(); } } });
      sh.body.append(inp, h('div.sheet-actions', {}, h('button.pill.primary', { text: action, onclick: () => { code = inp.value; go(); } })));
      setTimeout(() => inp.focus(), 50);
    }
    draw();
  }

  // ------------------------------------------------------------------ air quality ring
  airqCard(id, item = { id }) {
    const st = this.store;
    // [good below, fair below, scale max] by device class.
    const SCALE = { carbon_dioxide: [800, 1200, 2000], pm25: [12, 35, 100], pm10: [54, 154, 250], aqi: [50, 100, 300], volatile_organic_compounds: [250, 2000, 5000], volatile_organic_compounds_parts: [220, 660, 2000], nitrogen_dioxide: [53, 100, 360], ozone: [54, 70, 200], carbon_monoxide: [9, 35, 100] };
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.classList.add('aq-svg');
    svg.innerHTML = '<circle cx="50" cy="50" r="42" class="aq-track"/><circle cx="50" cy="50" r="42" class="aq-fill" transform="rotate(-90 50 50)" pathLength="100"/>';
    const val = h('div.aq-val'), word = h('div.aq-word');
    const el = h('div.card.airq', {}, h('div.aq-wrap', {}, svg, h('div.aq-center', {}, val, word)), h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) })));
    const update = () => {
      const s = st.get(id), a = s?.attributes || {}, v = Number(s?.state);
      const sc = SCALE[a.device_class] || [Infinity, Infinity, Math.max(100, Number.isFinite(v) ? v * 1.5 : 100)];
      const lvl = !Number.isFinite(v) ? 'na' : v < sc[0] ? 'good' : v < sc[1] ? 'fair' : 'poor';
      el.dataset.lvl = lvl;
      val.textContent = s ? formatState(st, id) : 'Missing';
      word.textContent = { good: 'Good', fair: 'Fair', poor: 'Poor', na: '' }[lvl];
      svg.querySelector('.aq-fill').setAttribute('stroke-dasharray', `${Number.isFinite(v) ? Math.max(2, Math.min(100, (v / sc[2]) * 100)) : 0} 100`);
    };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ person
  personCard(id, item = { id }) {
    const st = this.store;
    const pic = h('div.ps-pic'), where = h('div.tile-state');
    const el = h('div.card.person', {}, h('div.ps-wrap', {}, pic), h('div.tile-bottom', {}, h('div.tile-name', { text: tileName(st, item) }), where));
    let last;
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      const home = s?.state === 'home';
      el.classList.toggle('home', home);
      el.classList.toggle('away', !!s && !home);
      where.textContent = !s ? 'Missing' : home ? 'Home' : s.state === 'not_home' ? 'Away' : s.state === 'unknown' ? 'Unknown' : cap(String(s.state).replace(/_/g, ' '));
      const url = a.entity_picture ? (st.mode === 'demo' || /^data:/.test(a.entity_picture) ? a.entity_picture : `api/art?id=${encodeURIComponent(id)}&v=${encodeURIComponent(a.entity_picture.slice(-30))}`) : null;
      if (url !== last) {
        last = url;
        pic.style.backgroundImage = url ? `url("${url}")` : '';
        pic.textContent = url ? '' : (tileName(st, item) || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
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

  // ------------------------------------------------------------------ calendar
  calendarCard(id, item = { id }) {
    const st = this.store;
    const ids = [id, ...(item.calendars || [])].filter((c, i, a) => c && a.indexOf(c) === i);
    const days = item.days || 3;
    const list = h('div.cal-list', {}, h('div.cal-none', { text: 'Loading…' }));
    const el = h('div.card.calendar', {}, h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'calendar') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) }))), list);
    press(el, { onTap: () => this.calendarSheet(ids, tileName(st, item)) });
    let groups = [], loadedAt = 0, lastMin = -1;
    const draw = () => { list.innerHTML = agendaHtml(groups, st.settings?.general?.use24h) || '<div class="cal-none">Nothing planned</div>'; };
    const load = async () => { loadedAt = Date.now(); groups = await loadAgenda(st, ids, days); draw(); };
    load();
    const tick = () => {
      if (Date.now() - loadedAt > 10 * 60000) load();
      const m = new Date().getMinutes(); if (m !== lastMin) { lastMin = m; if (groups.length) draw(); }
    };
    return { id, el, update: () => {}, tick };
  }

  async calendarSheet(ids, title) {
    const sh = sheet({ title, cls: 'calendar-sheet' });
    sh.body.append(h('div.cal-none', { text: 'Loading…' }));
    const groups = await loadAgenda(this.store, ids, 14);
    sh.body.innerHTML = '';
    sh.body.append(h('div.cal-list.big', { html: agendaHtml(groups, this.store.settings?.general?.use24h) }));
  }

  // ------------------------------------------------------------------ graph
  graphCard(id, item = { id }) {
    const st = this.store;
    const hours = item.hours || 24;
    const val = h('div.gr-val'), today = h('div.gr-today'), lo = h('span'), hi = h('span'), span = h('span.gr-span', { text: hours >= 168 ? `${hours / 24} days` : `${hours} h` });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 300'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('gr-svg');
    const el = h('div.card.graph', {},
      h('div.gr-top', {}, h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'gauge') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) }), h('div.card-sub', {}, span))),
        h('div.gr-now', {}, val, today)),
      h('div.gr-chart', {}, svg, h('div.gr-range', {}, hi, lo)));
    let points = [], loadedAt = 0;
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    const draw = () => {
      const s = st.get(id), now = Date.now(), from = now - hours * 3600e3;
      const live = Number(s?.state);
      const pts = points.filter((p) => p[0] >= from);
      if (Number.isFinite(live)) pts.push([now, live]);
      if (pts.length < 2) { svg.innerHTML = ''; lo.textContent = hi.textContent = ''; return; }
      let min = Math.min(...pts.map((p) => p[1])), max = Math.max(...pts.map((p) => p[1]));
      const unit = s?.attributes?.unit_of_measurement || '';
      lo.textContent = `${fmtNum(min)}${unit === '°C' || unit === '°F' ? '°' : ''}`; hi.textContent = `${fmtNum(max)}${unit === '°C' || unit === '°F' ? '°' : ''}`;
      if (max - min < 1e-9) { max += 1; min -= 1; }
      const pad = (max - min) * 0.12; min -= pad; max += pad;
      const X = (t) => ((t - from) / (now - from)) * 1000, Y = (v) => 300 - ((v - min) / (max - min)) * 300;
      // Step-free smooth-ish line through the points.
      let d = `M${X(pts[0][0]).toFixed(1)} ${Y(pts[0][1]).toFixed(1)}`;
      for (const [t, v] of pts.slice(1)) d += ` L${X(t).toFixed(1)} ${Y(v).toFixed(1)}`;
      svg.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>`
        + `<path d="${d} L1000 300 L${X(pts[0][0]).toFixed(1)} 300 Z" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`
        + `<circle cx="${X(pts[pts.length - 1][0]).toFixed(1)}" cy="${Y(pts[pts.length - 1][1]).toFixed(1)}" r="5" fill="currentColor" vector-effect="non-scaling-stroke"/>`;
      // Energy meters: how much since midnight.
      const total = s?.attributes?.state_class === 'total_increasing' || s?.attributes?.device_class === 'energy';
      if (total && Number.isFinite(live)) {
        const mid = new Date(); mid.setHours(0, 0, 0, 0);
        const first = pts.find((p) => p[0] >= mid.getTime());
        today.textContent = first ? `+${fmtNum(Math.max(0, live - first[1]))} ${unit} today` : '';
      } else today.textContent = '';
    };
    const load = async () => { loadedAt = Date.now(); points = await st.history(id, hours); draw(); };
    load();
    const update = () => { const s = st.get(id); val.textContent = s ? formatState(st, id) : 'Missing'; draw(); };
    const tick = () => { if (Date.now() - loadedAt > 5 * 60000) load(); };
    return { id, el, update, tick };
  }

  // ------------------------------------------------------------------ scenes row
  scenesCard(id, item = { id: SCENES }) {
    const st = this.store;
    const ids = (item.scenes || []).filter(Boolean);
    const PAL = ['#e8b13a', '#2f7f7a', '#d9822b', '#5e5ce6', '#ff375f', '#1fa3a0', '#bf5af2', '#30d158'];
    const wrap = h('div.sc-wrap');
    const el = h('div.card.scenes' + (item.plain ? '.plain' : ''), {}, wrap);
    const run = (sid, b) => {
      const d = domainOf(sid);
      st.call(d, d === 'button' || d === 'input_button' ? 'press' : 'turn_on', {}, { entity_id: sid });
      b.classList.add('fired'); setTimeout(() => b.classList.remove('fired'), 1200);
    };
    ids.forEach((sid, i) => {
      const c = PAL[i % PAL.length];
      const b = h('button.sc-btn', { style: item.plain ? {} : { '--sc': c }, onclick: (e) => { e.stopPropagation(); if (!this.editing) run(sid, b); } },
        h('span.sc-ic', { html: iconHtml(st, { id: sid }, domainIcon(domainOf(sid))) }), h('span.sc-name', { text: st.name(sid) || sid }));
      wrap.append(b);
    });
    if (!ids.length) wrap.append(h('div.sc-empty', { text: 'Choose scenes in this tile’s Options' }));
    return { id, el, update: () => {} };
  }

  // ------------------------------------------------------------------ camera
  cameraCard(id, item = { id }) {
    const st = this.store;
    const img = h('img.cam-img', { alt: '' });
    const stamp = h('div.cam-age');
    const el = h('div.card.camera', {}, img, h('div.cam-shade'), h('div.cam-label', {}, h('span.cam-dot'), h('span', { text: tileName(st, item) })), stamp);
    press(el, { onTap: () => this.app.cameraView(id, { title: tileName(st, item) }) });
    let last = 0, loading = false;
    img.addEventListener('load', () => { loading = false; el.classList.add('has-img'); el.classList.remove('cam-err'); });
    img.addEventListener('error', () => { loading = false; el.classList.add('cam-err'); });
    // A fresh snapshot every 10 s while the tile is on screen.
    const tick = () => {
      if (loading || Date.now() - last < 10000 || !onScreen(el)) return;
      last = Date.now(); loading = true;
      img.src = cameraUrl(st, id);
    };
    const update = () => { const s = st.get(id); el.classList.toggle('off', !s || s.state === 'unavailable'); stamp.textContent = !s ? 'Missing' : s.state === 'unavailable' ? 'Unavailable' : ''; tick(); };
    return { id, el, update, tick };
  }

  // ------------------------------------------------------------------ media
  mediaCard(id, item = { id }) {
    const st = this.store;
    const call = (service, data = {}) => st.call('media_player', service, data, { entity_id: id });
    const art = h('div.media-art');
    const title = h('div.media-title'), artist = h('div.media-artist');
    const playBtn = h('button.media-btn.media-play', { 'aria-label': 'Play or pause', onclick: (e) => { e.stopPropagation(); const s = st.get(id); if (s && MEDIA_OFF.includes(s.state)) call('turn_on'); else call('media_play_pause'); } });
    const prev = h('button.media-btn', { html: icon('prev'), 'aria-label': 'Previous', onclick: (e) => { e.stopPropagation(); call('media_previous_track'); } });
    const next = h('button.media-btn', { html: icon('next'), 'aria-label': 'Next', onclick: (e) => { e.stopPropagation(); call('media_next_track'); } });
    const vol = h('input.media-vol', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Volume' });
    vol.addEventListener('pointerdown', (e) => e.stopPropagation());
    vol.addEventListener('change', () => call('volume_set', { volume_level: Number(vol.value) / 100 }));
    const bar = h('div.media-bar', {}, h('i'));
    const el = h('div.card.media', {}, art, h('div.media-shade'),
      h('div.media-body', {},
        h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'play') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) }))),
        h('div.media-info', {}, title, artist),
        h('div.media-ctl', {}, prev, playBtn, next, h('span.media-vol-wrap', {}, h('span.media-vol-ic', { html: icon('volume') }), vol))),
      bar);
    press(el, { onTap: (e) => { if (!e.target.closest('button, input')) this.mediaSheet(id, item); }, onLong: () => this.mediaSheet(id, item) });
    let lastArt = null;
    const tick = () => {
      const s = st.get(id), a = s?.attributes || {}, p = mediaPosition(s);
      bar.firstChild.style.width = p != null && a.media_duration ? `${(100 * p / a.media_duration).toFixed(2)}%` : '0';
    };
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      const off = !s || MEDIA_OFF.includes(s.state);
      const url = off ? null : mediaArt(st, id);
      if (url !== lastArt) { art.style.backgroundImage = url ? `url("${url}")` : ''; lastArt = url; }
      el.classList.toggle('has-art', !!url);
      el.classList.toggle('on', s?.state === 'playing');
      el.classList.toggle('off', off);
      title.textContent = !s ? 'Missing' : off ? (s.state === 'unavailable' ? 'Unavailable' : 'Off') : a.media_title || a.app_name || cap(s.state);
      artist.textContent = off ? '' : [a.media_artist || a.media_album_artist, a.media_album_name && !a.media_artist ? a.media_album_name : null].filter(Boolean).join(' · ') || (a.source && a.media_title ? a.source : '');
      playBtn.innerHTML = icon(off ? 'power' : s.state === 'playing' ? 'pause' : 'play');
      if (document.activeElement !== vol) vol.value = Math.round((a.volume_level ?? 0) * 100);
      vol.parentElement.style.display = a.volume_level == null || off ? 'none' : '';
      prev.style.display = next.style.display = off ? 'none' : '';
      tick();
    };
    return { id, el, update, tick };
  }

  // ------------------------------------------------------------------ countdown
  countdownCard(id, item = { id }) {
    const st = this.store;
    const emoji = h('div.cd-emoji'), num = h('div.cd-num'), unit = h('div.cd-unit'), name = h('div.cd-name');
    const el = h('div.card.countdown', {}, emoji, h('div.cd-main', {}, num, unit), name);
    press(el, { onTap: () => this.app.openSettings({ section: 'Countdowns' }) });
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      if (!s) { num.textContent = '—'; unit.textContent = ''; name.textContent = 'Countdown removed'; emoji.textContent = ''; return; }
      const d = Number(s.state);
      emoji.textContent = a.emoji || '';
      if (d > 1) { num.textContent = String(d); unit.textContent = 'days to'; }
      else if (d === 1) { num.textContent = '1'; unit.textContent = 'day to'; }
      else if (d === 0) { num.textContent = a.text === 'Today!' ? '🎉' : a.text; unit.textContent = a.text === 'Today!' ? 'Today is' : 'to'; }
      else { num.textContent = String(-d); unit.textContent = -d === 1 ? 'day since' : 'days since'; }
      name.textContent = item.name || a.friendly_name;
      el.classList.toggle('today', d === 0);
    };
    return { id, el, update };
  }

  // ------------------------------------------------------------------ TV remote
  remoteCard(id, item = { id }) {
    const st = this.store;
    let rm = remoteFor(st, null, id, item.remote);
    st.registry().then((reg) => { rm = remoteFor(st, reg, id, item.remote); update(); });
    const tap = (key) => (e) => { e.stopPropagation(); rm.press(key); navigator.vibrate?.(8); };
    const btn = (key, ic, label, cls = '') => h('button.rm-btn' + cls, { html: icon(ic), 'aria-label': label, onclick: tap(key) });
    const now = h('div.rm-now'), sub = h('div.rm-sub');
    const power = h('button.rm-btn.rm-power', { html: icon('power'), 'aria-label': 'Power', onclick: tap('power') });
    const pad = h('div.rm-pad', {},
      btn('up', 'up', 'Up', '.rm-up'), btn('left', 'left', 'Left', '.rm-left'), btn('right', 'right', 'Right', '.rm-right'), btn('down', 'down', 'Down', '.rm-down'),
      h('button.rm-ok', { text: 'OK', 'aria-label': 'OK', onclick: tap('ok') }));
    touchpad(pad, (k) => { rm.press(k); navigator.vibrate?.(8); pad.dataset.flash = k; clearTimeout(pad._t); pad._t = setTimeout(() => { delete pad.dataset.flash; }, 180); });
    const playBtn = btn('play', 'play', 'Play or pause');
    const apps = h('button.rm-btn', { html: icon('grid'), 'aria-label': 'Apps', onclick: (e) => { e.stopPropagation(); this.appsSheet(id, item); } });
    const row1 = h('div.rm-row', {}, btn('back', 'undo', 'Back'), btn('home', 'tv', 'Home'), playBtn);
    const row2 = h('div.rm-row', {}, btn('voldown', 'minus', 'Volume down'), h('span.rm-vol', { html: icon('volume') }), btn('volup', 'plus', 'Volume up'), apps);
    const el = h('div.card.remote', {},
      h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'tv') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) }), sub), power),
      now, h('div.rm-padwrap', {}, pad), row1, row2);
    press(el, { onTap: () => {}, onLong: () => this.mediaSheet(id, item) });
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      const off = !s || ['off', 'standby', 'unavailable'].includes(s.state);
      el.classList.toggle('on', !off);
      el.classList.toggle('no-nav', !rm.canNavigate);
      now.textContent = off ? (s?.state === 'unavailable' ? 'Unavailable' : 'Off') : [a.media_title, a.media_artist || a.media_series_title].filter(Boolean).join(' · ') || a.app_name || a.source || cap(s.state);
      sub.textContent = rm.name || '';
      playBtn.innerHTML = icon(s?.state === 'playing' ? 'pause' : 'play');
      apps.style.display = (a.source_list || []).length ? '' : 'none';
    };
    return { id, el, update };
  }
  // ------------------------------------------------------------------ Music Assistant
  musicCard(id, item = { id }) {
    const st = this.store;
    const call = (service, data = {}) => st.call('media_player', service, data, { entity_id: id });
    const art = h('div.mu-art'), title = h('div.mu-title'), artist = h('div.mu-artist');
    const playBtn = h('button.media-btn.media-play', { 'aria-label': 'Play or pause', onclick: (e) => { e.stopPropagation(); call('media_play_pause'); } });
    const favs = h('div.mu-favs');
    const browse = h('button.pill.sm.mu-browse', { html: icon('music') + '<span>Browse</span>', onclick: (e) => { e.stopPropagation(); this.musicSheet(id, item); } });
    const el = h('div.card.music', {},
      h('div.card-head', {}, h('span.card-ic', { html: iconHtml(st, item, 'music') }), h('div.card-titles', {}, h('div.card-title', { text: tileName(st, item) })), browse),
      h('div.mu-now', {}, art, h('div.mu-info', {}, title, artist,
        h('div.mu-ctl', {},
          h('button.media-btn', { html: icon('prev'), 'aria-label': 'Previous', onclick: (e) => { e.stopPropagation(); call('media_previous_track'); } }),
          playBtn,
          h('button.media-btn', { html: icon('next'), 'aria-label': 'Next', onclick: (e) => { e.stopPropagation(); call('media_next_track'); } })))),
      favs);
    press(el, { onTap: (e) => { if (!e.target.closest('button')) this.musicSheet(id, item); }, onLong: () => this.musicSheet(id, item) });
    let favAt = 0;
    const loadFavs = async () => {
      favAt = Date.now();
      const list = await maFavourites(st, 14).catch(() => []);
      favs.replaceChildren(...(list.length ? list.map((it) => h('button.mu-fav', { title: it.name, onclick: (e) => { e.stopPropagation(); maPlay(st, id, it); toast(`Playing ${it.name}`); } }, maCover(it), h('span', { text: it.name })))
        : [h('div.mu-empty', { text: 'Star some playlists, albums or stations in Music Assistant to see them here.' })]));
    };
    loadFavs();
    let lastArt = null;
    const update = () => {
      const s = st.get(id), a = s?.attributes || {};
      const off = !s || MEDIA_OFF.includes(s.state) || (!a.media_title && s.state === 'idle');
      const url = off ? null : mediaArt(st, id);
      if (url !== lastArt) { art.style.backgroundImage = url ? `url("${url}")` : ''; lastArt = url; }
      art.innerHTML = url ? '' : icon('music');
      el.classList.toggle('on', s?.state === 'playing');
      title.textContent = !s ? 'Missing' : off ? 'Nothing playing' : a.media_title || cap(s.state);
      artist.textContent = off ? 'Pick something below' : [a.media_artist, a.media_album_name].filter(Boolean).join(' · ');
      playBtn.innerHTML = icon(s?.state === 'playing' ? 'pause' : 'play');
      if (Date.now() - favAt > 600000) loadFavs();
    };
    return { id, el, update };
  }

  /** A whole page for music: Music Assistant's player and library, full screen. */
  async renderMusic() {
    const st = this.store, pg = this.page;
    const run = (this._musicRun = (this._musicRun || 0) + 1);
    this.root.classList.add('music-page');
    this.grid = h('div.home-grid.music-dummy');
    this.greet = h('div'); this.date = h('div'); this.time = h('div');
    const who = h('span.mp-who');
    const pickBtn = h('button.pill.glass.mp-pick', { onclick: () => this.musicPicker() }, h('span.mp-pick-ic', { html: icon('volume') }), who);
    const top = h('div.mp-top', {},
      h('div.mp-heading', { text: pg.name || 'Music' }),
      h('div.mp-top-btns', {}, pickBtn,
        h('button.icon-btn.glass', { 'aria-label': 'Clock', html: icon('clock'), onclick: () => this.app.goTo(0) }),
        h('button.icon-btn.glass', { 'aria-label': 'Settings', html: icon('gear'), onclick: () => this.app.openSettings({ page: this.pageId }) })));
    const body = h('div.mp-body', {}, h('div.mp-empty', {}, h('div.mp-empty-text', { text: 'Finding your speakers…' })));
    this.root.append(h('div.home-bg'), h('div.home-wall'), top, body);
    const stale = () => run !== this._musicRun || this.page?.kind !== 'music';
    try {
      const { ma, all } = await this.musicPlayers();
      if (stale()) return;
      let id = pg.player && st.get(pg.player) ? pg.player : (ma.find((x) => x.state === 'playing') || ma[0])?.entity_id;
      pickBtn.style.display = all.length ? '' : 'none';
      if (!id) {
        who.textContent = 'Choose a speaker';
        body.replaceChildren(h('div.mp-empty', {},
          h('div.mp-empty-ic', { html: icon('music') }),
          h('div.mp-empty-title', { text: all.length ? 'No Music Assistant speakers found' : 'No speakers yet' }),
          h('div.mp-empty-text', { text: 'This page plays Spotify, Apple Music, Tidal, YouTube Music, Deezer, Qobuz, SoundCloud, your own files and radio through Music Assistant. Install Music Assistant and its integration in Home Assistant, connect your music services there, and its speakers show up here.' }),
          all.length ? h('div.mp-empty-text', { text: 'Or pick any speaker to control it from here:' }) : null,
          all.length ? h('div.mp-empty-list', {}, ...all.map((x) => h('button.pill', { text: st.name(x.entity_id), onclick: () => this.setMusicPlayer(x.entity_id) }))) : null));
        // Speakers can arrive a moment after the page; try again when one does.
        if ((this._musicTries = (this._musicTries || 0) + 1) <= 4) this._musicWait = setTimeout(() => { if (!stale() && !this.musicV) this.render(); }, 6000);
        return;
      }
      who.textContent = st.name(id);
      this.musicV?.destroy();
      this.musicV = this.musicView(id, { page: true, onPlayer: (o) => this.setMusicPlayer(o) });
      body.replaceChildren(this.musicV.el);
    } catch (e) {
      if (stale()) return;
      body.replaceChildren(h('div.mp-empty', {},
        h('div.mp-empty-title', { text: 'The music page hit a problem' }),
        h('div.mp-empty-text', { text: String(e?.message || e) }),
        h('button.pill.primary', { text: 'Try again', onclick: () => { st.registry(true); this.render(); } })));
      console.error('Music page', e);
    }
  }

  /** Media players, with Music Assistant's first. MA players are found by their integration, or by MA's own attributes. */
  async musicPlayers() {
    const st = this.store;
    let reg = await st.registry();
    const isMa = (x) => isMaPlayer(reg, x);
    let all = st.list(['media_player']);
    if (all.length && !all.some(isMa) && !this._regRetried) { this._regRetried = true; reg = await st.registry(true); }
    all = st.list(['media_player']);
    const ma = all.filter(isMa);
    return { ma, all: [...ma, ...all.filter((x) => !ma.includes(x))] };
  }

  setMusicPlayer(id) {
    this.app.update((x) => { const p = pageOf(x, this.pageId); if (p) p.player = id; });
    this.render();
  }

  async musicPicker() {
    const st = this.store, { ma, all } = await this.musicPlayers();
    const cur = this.page?.player;
    const sh = sheet({ title: 'Speaker for this page', cls: 'mp-picker' });
    const row = (x) => h('button.ent-row.mp-pick-row' + (x.entity_id === cur ? '.sel' : ''), { onclick: () => { sh.close(); this.setMusicPlayer(x.entity_id); } },
      h('span.ent-ic', { html: icon('volume') }),
      h('div.ent-text', {}, h('div.ent-name', { text: st.name(x.entity_id) }), h('div.ent-sub', { text: x.state === 'playing' && x.attributes?.media_title ? `Playing ${x.attributes.media_title}` : cap(x.state) })));
    sh.body.append(...[
      h('button.ent-row.mp-pick-row' + (!cur ? '.sel' : ''), { onclick: () => { sh.close(); this.setMusicPlayer(null); } }, h('span.ent-ic', { html: icon('music') }), h('div.ent-text', {}, h('div.ent-name', { text: 'Whichever is playing' }), h('div.ent-sub', { text: 'Follows the Music Assistant speaker that is playing' }))),
      ma.length ? h('div.set-sub', { text: 'Music Assistant speakers' }) : null, ...ma.map(row),
      all.length > ma.length ? h('div.set-sub', { text: ma.length ? 'Other speakers (controls only, no library)' : 'Speakers (controls only, no library)' }) : null,
      ...all.filter((x) => !ma.includes(x)).map(row)].filter(Boolean));
  }

  musicSheet(id, item = { id }) {
    let view;
    const sh = sheet({ title: tileName(this.store, item), cls: 'music-sheet', onClose: () => view?.destroy() });
    view = this.musicView(id, { onPlayer: null });
    sh.body.append(view.el);
  }

  /** The music player and browser, for the sheet and for a full Music page. */
  musicView(id, { page = false, onPlayer } = {}) {
    const st = this.store;
    const call = (service, data = {}) => st.call('media_player', service, data, { entity_id: id });
    // Now playing
    const art = h('div.ms2-art'), title = h('div.ms2-title'), sub = h('div.ms2-sub'), next = h('div.ms2-next'), where = h('div.mp-where');
    const playBtn = h('button.media-btn.media-play', { 'aria-label': 'Play or pause', onclick: () => call('media_play_pause') });
    const vol = h('input.range.ms2-vol', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Volume' });
    vol.addEventListener('change', () => call('volume_set', { volume_level: Number(vol.value) / 100 }));
    const shuffle = h('button.icon-btn.sm.mp-shuffle', { text: '⤮', 'aria-label': 'Shuffle', onclick: () => call('shuffle_set', { shuffle: !st.get(id)?.attributes?.shuffle }) });
    const repeat = h('button.icon-btn.sm.mp-repeat', { text: '↻', 'aria-label': 'Repeat', onclick: () => { const r = st.get(id)?.attributes?.repeat || 'off'; call('repeat_set', { repeat: r === 'off' ? 'all' : r === 'all' ? 'one' : 'off' }); } });
    const prog = h('input.range.mp-prog', { type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Position' });
    const tNow = h('span.mp-t'), tEnd = h('span.mp-t');
    let seeking = false;
    prog.addEventListener('input', () => { seeking = true; });
    prog.addEventListener('change', () => { const a = st.get(id)?.attributes || {}; if (a.media_duration) call('media_seek', { seek_position: Math.round((Number(prog.value) / 1000) * a.media_duration) }); seeking = false; });
    const ctl = h('div.ms2-ctl', {}, shuffle, h('button.media-btn', { html: icon('prev'), 'aria-label': 'Previous', onclick: () => call('media_previous_track') }), playBtn,
      h('button.media-btn', { html: icon('next'), 'aria-label': 'Next', onclick: () => call('media_next_track') }), repeat);
    const nowBar = page
      ? h('div.mp-now', {}, art, h('div.mp-titles', {}, title, sub), h('div.mp-progress', {}, tNow, prog, tEnd), ctl, h('div.ms2-volrow', {}, h('span', { html: icon('volume') }), vol), next, where)
      : h('div.ms2-now', {}, art, h('div.ms2-info', {}, title, sub, next), ctl, h('div.ms2-volrow', {}, h('span', { html: icon('volume') }), vol));
    // Browse
    let type = 'fav', query = '', seq = 0;
    // When Home Assistant has no Music Assistant library actions, browse the speaker's library the generic way.
    let browseMode = false, path = [];
    const q = h('input.text-in.ms2-search', { type: 'search', placeholder: 'Search songs, artists, albums, playlists, radio…' });
    let qt = null;
    q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { query = q.value.trim(); load(); }, 350); });
    const tabs = h('div.ms2-tabs');
    const grid = h('div.ms2-grid');
    const drawTabs = () => {
      if (!browseMode) return tabs.replaceChildren(segmented(MA_TYPES, type, (v) => { type = v; query = ''; q.value = ''; drawTabs(); load(); }));
      const crumbs = [{ name: 'Library' }, ...path];
      tabs.replaceChildren(h('div.ms2-crumbs', {}, ...crumbs.flatMap((c, i) => [
        i ? h('span.ms2-crumb-sep', { text: '›' }) : null,
        h('button.ms2-crumb' + (i === crumbs.length - 1 ? '.on' : ''), { text: c.name, onclick: () => { path = path.slice(0, i); query = ''; q.value = ''; drawTabs(); load(); } })]).filter(Boolean)));
    };
    const open = (it) => { path.push(it); query = ''; q.value = ''; drawTabs(); load(); };
    const tile = (it) => {
      const menu = h('div.ma-menu', {},
        h('button', { text: 'Play now', onclick: (e) => { e.stopPropagation(); maPlay(st, id, it); toast(`Playing ${it.name}`); } }),
        h('button', { text: 'Play next', onclick: (e) => { e.stopPropagation(); maPlay(st, id, it, 'next'); toast('Playing next'); el.classList.remove('menu'); } }),
        h('button', { text: 'Add to queue', onclick: (e) => { e.stopPropagation(); maPlay(st, id, it, 'add'); toast('Added to the queue'); el.classList.remove('menu'); } }),
        it.media_type !== 'radio' && !it._b ? h('button', { text: 'Start radio', onclick: (e) => { e.stopPropagation(); maPlay(st, id, it, 'play', true); toast('Radio based on ' + it.name); } }) : null);
      const more = h('button.ma-more', { text: '•••', 'aria-label': 'More', onclick: (e) => { e.stopPropagation(); grid.querySelectorAll('.menu').forEach((x) => x !== el && x.classList.remove('menu')); el.classList.toggle('menu'); } });
      const folder = it._b && it.expand && !it.play;
      const el = h('div.ma-item' + (it.media_type === 'artist' || it.cls === 'artist' ? '.round' : '') + (folder ? '.folder' : ''), { onclick: () => { if (it._b && it.expand && (!it.play || ['directory', 'app'].includes(it.cls))) return open(it); maPlay(st, id, it); toast(`Playing ${it.name}`); } },
        h('div.ma-cwrap', {}, maCover(it), it._b && !it.play ? null : more, it._b && !it.play ? null : menu), h('div.ma-name', { text: it.name }), h('div.ma-sub', { text: it._b ? (it.expand && it.play ? cap(it.cls || '') : '') : maSub(it) }));
      return el;
    };
    const load = async () => {
      const my = ++seq;
      grid.replaceChildren(h('div.ma-msg', { text: 'Loading…' }));
      let items = [];
      try {
        const m = await maInfo(st);
        if (!browseMode && !m.has('get_library')) { browseMode = true; drawTabs(); }
        if (query) {
          if (m.has('search')) {
            const r = await maAsk(st, 'search', { name: query, limit: 12 });
            const order = type === 'fav' || browseMode ? ['tracks', 'albums', 'artists', 'playlists', 'radio', 'podcasts', 'audiobooks'] : [type === 'radio' ? 'radio' : type + 's'];
            for (const k of order) items.push(...(r?.[k] || []));
          } else if (m.searchMedia) {
            const r = await st.ask('media_player', 'search_media', { search_query: query }, { entity_id: id });
            items = (r?.[id]?.result || r?.result || []).map(fromBrowse);
          } else throw new Error('this speaker can’t be searched from Home Assistant');
        } else if (browseMode) {
          const node = path[path.length - 1];
          const b = await st.browse(id, node?.uri, node?.media_type);
          items = (b?.children || []).map(fromBrowse);
        } else items = type === 'fav' ? await maFavourites(st, 40) : await maLibrary(st, type);
      } catch (e) {
        if (my !== seq) return;
        // Library actions missing: switch to browsing the speaker's library instead.
        if (e.missing && !browseMode && !query) { browseMode = true; drawTabs(); return load(); }
        grid.replaceChildren(h('div.ma-msg', {}, h('div', { text: 'Couldn’t load music: ' + (e.message || e) }),
          h('button.pill.sm', { text: 'Try again', onclick: () => { st.registry(true); load(); } })));
        return;
      }
      if (my !== seq) return;
      grid.replaceChildren(...(items.length ? items.map(tile) : [h('div.ma-msg', { text: query ? 'Nothing found.' : browseMode ? 'Nothing here.' : type === 'fav' ? 'No favourites yet. Star things in Music Assistant, or browse the other tabs.' : 'Nothing here yet.' })]));
    };
    // Speakers: control another one, group them with this one, or move the music over
    const speakers = h('div.ms2-speakers');
    const drawSpeakers = async () => {
      const reg = await st.registry();
      const others = st.list(['media_player']).filter((x) => x.entity_id !== id && isMaPlayer(reg, x)).map((x) => x.entity_id);
      const m = await maInfo(st);
      if (!others.length) { speakers.replaceChildren(); return; }
      const members = st.get(id)?.attributes?.group_members || [];
      speakers.replaceChildren(h('div.set-sub', { text: 'Other speakers' }), ...others.map((o) => {
        const s = st.get(o), inGroup = members.includes(o);
        return h('div.ent-row', {},
          h('span.ent-ic', { html: icon('volume') }),
          h('div.ent-text', {}, h('div.ent-name', { text: st.name(o) }), h('div.ent-sub', { text: s?.attributes?.media_title && s.state === 'playing' ? `Playing ${s.attributes.media_title}` : cap(s?.state || '') })),
          onPlayer ? h('button.pill.sm', { text: 'Control', onclick: () => onPlayer(o) }) : null,
          h('button.pill.sm' + (inGroup ? '.primary' : ''), { text: inGroup ? 'Grouped' : 'Group', onclick: () => { if (inGroup) st.call('media_player', 'unjoin', {}, { entity_id: o }); else st.call('media_player', 'join', { group_members: [o] }, { entity_id: id }); setTimeout(drawSpeakers, 400); } }),
          !m.has('transfer_queue') ? null : h('button.pill.sm', { text: page ? 'Move here' : 'Move music there', title: 'Move the music to this speaker', onclick: () => { st.call(m.d, 'transfer_queue', { source_player: id, auto_play: true }, { entity_id: o }); toast(`Moved to ${st.name(o)}`); if (onPlayer) onPlayer(o); else setTimeout(drawSpeakers, 400); } }));
      }));
    };
    const fmtT = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
    const tickProg = () => {
      const s = st.get(id), a = s?.attributes || {};
      if (!page || seeking) return;
      const dur = a.media_duration || 0;
      let pos = a.media_position || 0;
      if (s?.state === 'playing' && a.media_position_updated_at) pos += (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000;
      pos = Math.min(dur || pos, pos);
      prog.value = dur ? Math.round((pos / dur) * 1000) : 0; prog.disabled = !dur;
      tNow.textContent = dur ? fmtT(pos) : ''; tEnd.textContent = dur ? '-' + fmtT(dur - pos) : '';
    };
    const render = async () => {
      const s = st.get(id), a = s?.attributes || {};
      const off = !s || MEDIA_OFF.includes(s.state) || (!a.media_title && s.state === 'idle');
      const url = off ? null : mediaArt(st, id);
      art.style.backgroundImage = url ? `url("${url}")` : ''; art.innerHTML = url ? '' : icon('music');
      title.textContent = off ? 'Nothing playing' : a.media_title || cap(s.state);
      sub.textContent = off ? (page ? 'Pick something on the right' : '') : [a.media_artist, a.media_album_name].filter(Boolean).join(' · ');
      where.textContent = `Playing on ${st.name(id)}`;
      playBtn.innerHTML = icon(s?.state === 'playing' ? 'pause' : 'play');
      shuffle.classList.toggle('on', !!a.shuffle);
      repeat.classList.toggle('on', !!a.repeat && a.repeat !== 'off'); repeat.textContent = a.repeat === 'one' ? '↻¹' : '↻';
      if (document.activeElement !== vol) vol.value = Math.round((a.volume_level ?? 0) * 100);
      tickProg();
      try {
        const qd = (await maAsk(st, 'get_queue', {}, { entity_id: id }))?.[id];
        next.textContent = qd?.next_item?.name ? `Up next: ${qd.next_item.name}` : '';
      } catch { next.textContent = ''; }
    };
    const onEv = (e) => { const x = e.detail?.id || e.detail; if (x === id) render(); };
    st.addEventListener('state', onEv);
    const timer = page ? setInterval(tickProg, 1000) : null;
    const el = page
      ? h('div.mp', {}, h('div.mp-left', {}, nowBar, speakers), h('div.mp-right', {}, q, tabs, grid))
      : h('div', {}, nowBar, q, tabs, grid, speakers);
    drawTabs(); render(); load(); drawSpeakers();
    return { el, destroy() { st.removeEventListener('state', onEv); clearInterval(timer); } };
  }

  /** Apps / inputs to launch on a TV (its source list). */
  appsSheet(id, item = { id }) {
    const st = this.store, a = st.get(id)?.attributes || {};
    const sh = sheet({ title: `${tileName(st, item)}: apps`, cls: 'apps-sheet' });
    const grid = h('div.app-grid');
    for (const src of a.source_list || []) {
      grid.append(h('button.app-btn' + (src === a.source ? '.sel' : ''), { onclick: () => { st.call('media_player', 'select_source', { source: src }, { entity_id: id }); sh.close(); } },
        h('span.app-ic', { text: src.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '•', style: { '--hue': [...src].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7) } }), h('span.app-name', { text: src })));
    }
    sh.body.append(grid);
  }

  mediaSheet(id, item = { id }) {
    const st = this.store;
    const call = (service, data = {}) => st.call('media_player', service, data, { entity_id: id });
    let onEv = () => {}, timer = null;
    const sh = sheet({ title: tileName(st, item), cls: 'media-sheet', onClose: () => { st.removeEventListener('state', onEv); clearInterval(timer); } });
    const art = h('div.ms-art'), title = h('div.ms-title'), sub = h('div.ms-sub');
    const pos = h('div.ms-time'), dur = h('div.ms-time'), bar = h('div.ms-bar', {}, h('i'));
    const playBtn = h('button.ms-play', { 'aria-label': 'Play or pause', onclick: () => { const s = st.get(id); if (s && MEDIA_OFF.includes(s.state)) call('turn_on'); else call('media_play_pause'); } });
    const vol = h('input.range.ms-vol', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Volume' });
    vol.addEventListener('change', () => call('volume_set', { volume_level: Number(vol.value) / 100 }));
    const mute = h('button.icon-btn', { 'aria-label': 'Mute', onclick: () => call('volume_mute', { is_volume_muted: !st.get(id)?.attributes?.is_volume_muted }) });
    const power = h('button.pill.sm', { onclick: () => call(MEDIA_OFF.includes(st.get(id)?.state) ? 'turn_on' : 'turn_off') });
    const source = h('select.select');
    source.onchange = () => call('select_source', { source: source.value });
    const sourceRow = h('div.ms-row', {}, h('span.ms-label', { text: 'Source' }), source);
    sh.body.append(h('div.ms-wrap', {},
      art,
      h('div.ms-side', {},
        title, sub,
        h('div.ms-prog', {}, bar, h('div.ms-times', {}, pos, dur)),
        h('div.ms-ctl', {},
          h('button.ms-btn', { html: icon('prev'), 'aria-label': 'Previous', onclick: () => call('media_previous_track') }),
          playBtn,
          h('button.ms-btn', { html: icon('next'), 'aria-label': 'Next', onclick: () => call('media_next_track') })),
        h('div.ms-row', {}, mute, vol),
        sourceRow,
        h('div.ms-row.ms-end', {}, power))));
    const tick = () => {
      const s = st.get(id), a = s?.attributes || {}, p = mediaPosition(s);
      pos.textContent = fmtTime(p); dur.textContent = fmtTime(a.media_duration);
      bar.firstChild.style.width = p != null && a.media_duration ? `${(100 * p / a.media_duration).toFixed(2)}%` : '0';
    };
    const render = () => {
      const s = st.get(id), a = s?.attributes || {};
      const off = !s || MEDIA_OFF.includes(s.state);
      const url = off ? null : mediaArt(st, id);
      art.style.backgroundImage = url ? `url("${url}")` : '';
      art.innerHTML = url ? '' : icon('music');
      title.textContent = off ? 'Off' : a.media_title || a.app_name || cap(s.state);
      sub.textContent = off ? '' : [a.media_artist, a.media_album_name].filter(Boolean).join(' · ');
      playBtn.innerHTML = icon(off ? 'power' : s.state === 'playing' ? 'pause' : 'play');
      if (document.activeElement !== vol) vol.value = Math.round((a.volume_level ?? 0) * 100);
      mute.innerHTML = icon(a.is_volume_muted ? 'volumeOff' : 'volume');
      power.textContent = off ? 'Turn on' : 'Turn off';
      const list = a.source_list || [];
      sourceRow.style.display = list.length ? '' : 'none';
      if (source.options.length !== list.length) { source.innerHTML = ''; for (const x of list) source.append(h('option', { value: x, text: x })); }
      source.value = a.source || '';
      tick();
    };
    onEv = (e) => { if (e.detail?.id === id || e.detail === id) render(); };
    st.addEventListener('state', onEv);
    timer = setInterval(tick, 1000);
    render();
    st.registry().then((reg) => {
      if (!isMaPlayer(reg, st.get(id))) return;
      sh.body.querySelector('.ms-end')?.prepend(h('button.pill.sm.primary', { html: icon('music') + '<span>Browse music</span>', onclick: () => { sh.close(); this.musicSheet(id, item); } }));
    });
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
