// The page header: the title (room name, or the greeting on Home) and the line under it.
// The line is made of pieces you pick and order: greeting, date, weather bits, warnings, sensors, your own text.
import { formatState } from './data.js';
import { iconSvg } from './iconlib.js';

// Fonts that come with iPadOS (and look similar elsewhere thanks to the fallbacks).
export const FONTS = [
  { v: 'system', label: 'System', css: 'var(--font)' },
  { v: 'rounded', label: 'Rounded', css: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", var(--font)' },
  { v: 'serif', label: 'New York', css: 'ui-serif, "New York", "Iowan Old Style", Georgia, serif' },
  { v: 'avenir', label: 'Avenir Next', css: '"Avenir Next", Avenir, "Century Gothic", "Segoe UI", sans-serif' },
  { v: 'futura', label: 'Futura', css: 'Futura, "Futura PT", "Trebuchet MS", sans-serif' },
  { v: 'gill', label: 'Gill Sans', css: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif' },
  { v: 'optima', label: 'Optima', css: 'Optima, Candara, "Segoe UI", sans-serif' },
  { v: 'condensed', label: 'Condensed', css: '"Avenir Next Condensed", "DIN Condensed", "Arial Narrow", sans-serif-condensed, sans-serif' },
  { v: 'didot', label: 'Didot', css: 'Didot, "Bodoni 72", "Bodoni MT", "Times New Roman", serif' },
  { v: 'baskerville', label: 'Baskerville', css: 'Baskerville, "Baskerville Old Face", "Libre Baskerville", Georgia, serif' },
  { v: 'mono', label: 'Mono', css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  { v: 'typewriter', label: 'Typewriter', css: '"American Typewriter", "Courier New", Courier, monospace' },
  { v: 'script', label: 'Script', css: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive' },
];
export const fontCss = (v) => (FONTS.find((f) => f.v === v) || FONTS[0]).css;
export const WEIGHTS = [{ v: 400, label: 'Regular' }, { v: 500, label: 'Medium' }, { v: 600, label: 'Semibold' }, { v: 700, label: 'Bold' }, { v: 800, label: 'Heavy' }];
export const SEPARATORS = [{ v: ' · ', label: '·' }, { v: ' | ', label: '|' }, { v: ' — ', label: '—' }, { v: ' / ', label: '/' }, { v: '   ', label: 'Space' }];

// The pieces, in the order they're offered. "multi" pieces can be added more than once.
export const PARTS = {
  greeting: { label: 'Greeting', sub: 'Good morning… or your own words' },
  date: { label: 'Date' },
  now: { label: 'Weather now', sub: 'Temperature and conditions', weather: true },
  highlow: { label: 'Today’s high and low', weather: true },
  feels: { label: 'Feels like', weather: true },
  rain: { label: 'Chance of rain', weather: true },
  wind: { label: 'Wind', weather: true },
  humidity: { label: 'Humidity', weather: true },
  sun: { label: 'Sunrise / sunset', sub: 'Whichever comes next' },
  alerts: { label: 'Weather warnings', sub: 'Storms, strong wind, hurricane or other alerts', weather: true },
  sensor: { label: 'A sensor', multi: true },
  text: { label: 'Your own text', multi: true },
};
export const DATE_FORMATS = [
  { v: 'long', opts: { weekday: 'long', month: 'long', day: 'numeric' } },
  { v: 'full', opts: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } },
  { v: 'medium', opts: { weekday: 'short', month: 'short', day: 'numeric' } },
  { v: 'daymonth', opts: { month: 'long', day: 'numeric' } },
  { v: 'weekday', opts: { weekday: 'long' } },
  { v: 'numeric', opts: { month: 'numeric', day: 'numeric' } },
];
export const fmtDate = (d, v) => d.toLocaleDateString(undefined, (DATE_FORMATS.find((f) => f.v === v) || DATE_FORMATS[0]).opts);

export function defaultHeader() {
  return {
    sep: ' · ', homeTitle: 'greeting',
    parts: [
      { k: 'greeting', on: true, mode: 'auto' }, { k: 'date', on: true, fmt: 'long' },
      { k: 'now', on: false, show: 'both', icon: true }, { k: 'highlow', on: false }, { k: 'feels', on: false },
      { k: 'rain', on: false, when: 'likely' }, { k: 'wind', on: false, when: 'always' }, { k: 'humidity', on: false },
      { k: 'sun', on: false }, { k: 'alerts', on: false, storms: true, wind: true, entities: [] },
    ],
  };
}
/** The header settings with every piece present (new pieces are added, off, at the end). */
export function headerOf(settings) {
  const hd = settings?.header ? { ...defaultHeader(), ...settings.header } : defaultHeader();
  const have = new Set(hd.parts.map((p) => p.k));
  const extra = defaultHeader().parts.filter((p) => !have.has(p.k));
  return extra.length ? { ...hd, parts: [...hd.parts, ...extra] } : hd;
}
export const usesWeather = (hd) => hd.parts.some((p) => p.on && PARTS[p.k]?.weather);
export const weatherEntity = (store, hd) => (hd.weather && store.get(hd.weather) ? hd.weather : store.list?.(['weather'])?.[0]?.entity_id || null);

export function greetingFor(d, p = {}) {
  if (p.mode === 'custom') return p.text || '';
  const hr = d.getHours();
  const g = hr >= 5 && hr < 12 ? 'Good morning' : hr >= 12 && hr < 17 ? 'Good afternoon' : hr >= 17 && hr < 22 ? 'Good evening' : 'Good night';
  return p.name ? `${g}, ${p.name}` : g;
}

const num = (n) => (typeof n === 'number' ? (Math.abs(n) >= 10 || Number.isInteger(n) ? Math.round(n) : Math.round(n * 10) / 10) : n);
const WX_ICON = { 'clear-night': 'weather-night', cloudy: 'weather-cloudy', exceptional: 'alert-circle-outline', fog: 'weather-fog', hail: 'weather-hail', lightning: 'weather-lightning', 'lightning-rainy': 'weather-lightning-rainy', partlycloudy: 'weather-partly-cloudy', pouring: 'weather-pouring', rainy: 'weather-rainy', snowy: 'weather-snowy', 'snowy-rainy': 'weather-snowy-rainy', sunny: 'weather-sunny', windy: 'weather-windy', 'windy-variant': 'weather-windy-variant' };
const WX_TEXT = { 'clear-night': 'Clear', cloudy: 'Cloudy', exceptional: 'Extreme weather', fog: 'Fog', hail: 'Hail', lightning: 'Thunderstorms', 'lightning-rainy': 'Thunderstorms', partlycloudy: 'Partly cloudy', pouring: 'Heavy rain', rainy: 'Rain', snowy: 'Snow', 'snowy-rainy': 'Sleet', sunny: 'Sunny', windy: 'Windy', 'windy-variant': 'Windy' };
const STORMY = { lightning: 'Thunderstorms', 'lightning-rainy': 'Thunderstorms', hail: 'Hail', exceptional: 'Extreme weather', pouring: 'Heavy rain' };
// "Strong wind" from this speed, in the weather entity's unit.
const STRONG_WIND = { 'km/h': 40, mph: 25, 'm/s': 11, kn: 22, 'ft/s': 36 };
const icon = (name) => iconSvg('mdi:' + name, 'hd-ic') || '';

/** Words an alert entity is showing, or null when it's quiet. Understands the common alert integrations. */
export function alertText(store, id) {
  const s = store.get(id);
  if (!s) return null;
  const st = String(s.state).toLowerCase();
  if (['off', 'unknown', 'unavailable', '', '0', 'none', 'no', 'false', 'clear', 'ok', 'safe'].includes(st)) return null;
  const a = s.attributes || {};
  for (const key of ['Alerts', 'alerts', 'warnings', 'Warnings']) {
    const list = a[key];
    if (Array.isArray(list) && list.length) {
      const names = [...new Set(list.map((x) => x?.Event || x?.event || x?.headline || x?.Headline || x?.title || x?.name).filter(Boolean))];
      if (names.length) return names.slice(0, 2).join(', ');
    }
  }
  for (const key of ['event', 'Event', 'headline', 'title', 'warning']) if (typeof a[key] === 'string' && a[key]) return a[key];
  if (st === 'on' || !Number.isNaN(Number(st))) return a.friendly_name || id;
  return s.state.length < 40 ? s.state : a.friendly_name || id;
}

/** The pieces of the line under the title, as [{ html, alert }]. */
export function headerSegments(store, hd, now, { skipGreeting = false } = {}) {
  const out = [];
  const wid = weatherEntity(store, hd);
  const w = wid ? store.get(wid) : null, a = w?.attributes || {};
  const today = wid ? (store.forecasts?.[wid]?.daily || [])[0] : null;
  const hourly = wid ? store.forecasts?.[wid]?.hourly || [] : [];
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const push = (text, extra = {}) => { if (text) out.push({ html: (extra.icon || '') + esc(text), alert: !!extra.alert }); };
  for (const p of hd.parts) {
    if (!p.on) continue;
    switch (p.k) {
      case 'greeting': if (!skipGreeting) push(greetingFor(now, p)); break;
      case 'date': push(fmtDate(now, p.fmt)); break;
      case 'now': {
        if (!w) break;
        const t = a.temperature != null ? `${num(a.temperature)}°` : '';
        const c = WX_TEXT[w.state] || '';
        push(p.show === 'temp' ? t : p.show === 'cond' ? c : [t, c].filter(Boolean).join(' '), { icon: p.icon !== false ? icon(WX_ICON[w.state] || 'weather-partly-cloudy') : '' });
        break;
      }
      case 'highlow': if (today?.temperature != null) push(`H ${num(today.temperature)}°  L ${num(today.templow ?? '--')}°`); break;
      case 'feels': if (a.apparent_temperature != null) push(`Feels like ${num(a.apparent_temperature)}°`); break;
      case 'humidity': if (a.humidity != null) push(`Humidity ${Math.round(a.humidity)}%`); break;
      case 'rain': {
        const next12 = hourly.slice(0, 12).map((x) => x.precipitation_probability).filter((x) => x != null);
        const pop = today?.precipitation_probability ?? (next12.length ? Math.max(...next12) : null);
        if (pop == null || (p.when === 'likely' && pop < 30)) break;
        push(`Rain ${Math.round(pop)}%`, { icon: icon('weather-rainy') });
        break;
      }
      case 'wind': {
        if (a.wind_speed == null) break;
        const unit = a.wind_speed_unit || 'km/h';
        const strong = a.wind_speed >= (STRONG_WIND[unit] || 40) || (a.wind_gust_speed ?? 0) >= (STRONG_WIND[unit] || 40) * 1.4;
        if (p.when === 'strong' && !strong) break;
        const gust = a.wind_gust_speed != null && a.wind_gust_speed > a.wind_speed ? `, gusts ${num(a.wind_gust_speed)}` : '';
        push(`${strong ? 'Strong wind' : 'Wind'} ${num(a.wind_speed)} ${unit}${gust}`, { icon: icon('weather-windy') });
        break;
      }
      case 'sun': {
        const s = store.get('sun.sun')?.attributes;
        if (!s) break;
        const rise = s.next_rising && new Date(s.next_rising), set = s.next_setting && new Date(s.next_setting);
        const nextIsSet = set && (!rise || set < rise);
        const t = nextIsSet ? set : rise;
        if (!t || Number.isNaN(t)) break;
        const use24h = store.settings?.general?.use24h;
        push(`${nextIsSet ? 'Sunset' : 'Sunrise'} ${t.toLocaleTimeString(undefined, { hour: use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !use24h })}`, { icon: icon(nextIsSet ? 'weather-sunset-down' : 'weather-sunset-up') });
        break;
      }
      case 'alerts': {
        const found = [];
        if (p.storms !== false && w && STORMY[w.state]) found.push(STORMY[w.state]);
        if (p.wind !== false && a.wind_speed != null) {
          const unit = a.wind_speed_unit || 'km/h';
          if (a.wind_speed >= (STRONG_WIND[unit] || 40) * 1.5 || (a.wind_gust_speed ?? 0) >= (STRONG_WIND[unit] || 40) * 2) found.push(`High wind ${num(Math.max(a.wind_speed, a.wind_gust_speed ?? 0))} ${unit}`);
        }
        for (const id of p.entities || []) { const t = alertText(store, id); if (t) found.push(t); }
        for (const t of [...new Set(found)]) push(t, { icon: icon('alert'), alert: true });
        break;
      }
      case 'sensor': {
        if (!p.id || !store.get(p.id)) break;
        if (p.id.startsWith('countdown.')) { const a = store.get(p.id).attributes; push([a.emoji, p.label || a.long].filter(Boolean).join(' ')); break; }
        const label = p.label ?? store.name?.(p.id) ?? '';
        push([label, formatState(store, p.id)].filter(Boolean).join(' '));
        break;
      }
      case 'text': push(p.text); break;
    }
  }
  return out;
}

/** Entities the header needs updates for (the server watches the same ones). */
export function headerEntities(store, hd) {
  const ids = new Set();
  const on = hd.parts.filter((p) => p.on);
  if (on.some((p) => PARTS[p.k]?.weather)) { const w = weatherEntity(store, hd); if (w) ids.add(w); }
  if (on.some((p) => p.k === 'sun')) ids.add('sun.sun');
  for (const p of on) { if (p.k === 'sensor' && p.id) ids.add(p.id); if (p.k === 'alerts') for (const e of p.entities || []) ids.add(e); }
  return ids;
}

/** CSS variables for the header's fonts, sizes, colour and height. { vars: {name: value|null}, grad } */
export function headerVars(hd) {
  const c = /^#[0-9a-f]{6}$/i.test(hd.subColor || '') ? hd.subColor : null;
  const c2 = c && /^#[0-9a-f]{6}$/i.test(hd.subColor2 || '') ? hd.subColor2 : null;
  return {
    grad: !!c2,
    vars: {
      '--hd-h': hd.height && hd.height !== 13 ? hd.height + 'vh' : null,
      '--hd-title-font': hd.titleFont && hd.titleFont !== 'system' ? fontCss(hd.titleFont) : null,
      '--hd-title-scale': hd.titleSize && hd.titleSize !== 100 ? String(hd.titleSize / 100) : null,
      '--hd-title-weight': hd.titleWeight ? String(hd.titleWeight) : null,
      '--hd-sub-font': hd.subFont && hd.subFont !== 'system' ? fontCss(hd.subFont) : null,
      '--hd-sub-scale': hd.subSize && hd.subSize !== 100 ? String(hd.subSize / 100) : null,
      '--hd-sub-weight': hd.subWeight ? String(hd.subWeight) : null,
      '--hd-sub-color': c && !c2 ? c : null,
      '--hd-sub-grad': c2 ? `linear-gradient(90deg, ${c}, ${c2})` : null,
      '--hd-sub-c1': c2 ? c : null,
    },
  };
}
/** The title and the line's HTML for a page. */
export function headerContent(store, hd, now, { isHome, pageName }) {
  const greetTitle = isHome && hd.homeTitle !== 'name';
  const gPart = hd.parts.find((p) => p.k === 'greeting') || {};
  const title = greetTitle ? greetingFor(now, gPart) || 'Home' : pageName || 'Home';
  const segs = headerSegments(store, hd, now, { skipGreeting: greetTitle });
  const sep = `<span class="hd-sep">${(hd.sep ?? ' · ').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`;
  return { title, html: segs.map((x) => `<span class="${x.alert ? 'hd-alert' : 'hd-seg'}">${x.html}</span>`).join(sep) };
}
