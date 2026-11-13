// Material Design Icons (the set Home Assistant uses), loaded on demand from icons/mdi.json.
let cache = null, loading = null;

export function loadMdi() {
  if (cache) return Promise.resolve(cache);
  return (loading ||= fetch('icons/mdi.json').then((r) => (r.ok ? r.json() : {})).then((j) => (cache = j)).catch(() => (cache = {})));
}
export const mdiReady = () => !!cache;
export const mdiNames = () => (cache ? Object.keys(cache) : []);
const clean = (name) => String(name || '').replace(/^mdi:/, '').trim();
export const mdiHas = (name) => !!(cache && cache[clean(name)]);

/** SVG markup for "mdi:name" (or "name"), or null if unknown / not loaded yet. */
export function mdiSvg(name, cls = '') {
  const d = cache && cache[clean(name)];
  return d ? `<svg class="ic mdi ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>` : null;
}

/** Handy starting set shown before you search. */
export const SUGGESTED = [
  'lightbulb', 'lightbulb-outline', 'lightbulb-group', 'lightbulb-group-outline', 'ceiling-light', 'ceiling-light-multiple', 'floor-lamp', 'desk-lamp',
  'lamp', 'lamps', 'chandelier', 'wall-sconce', 'wall-sconce-round', 'led-strip-variant', 'string-lights', 'track-light', 'light-recessed',
  'outdoor-lamp', 'coach-lamp', 'lightbulb-night', 'fan', 'ceiling-fan', 'air-conditioner', 'thermostat', 'radiator', 'water-boiler',
  'heat-wave', 'snowflake', 'lock', 'lock-open-variant', 'door', 'door-open', 'garage', 'gate', 'blinds', 'curtains', 'window-shutter',
  'television', 'speaker', 'cast', 'power-plug', 'power-socket-us', 'power', 'coffee-maker', 'kettle', 'washing-machine', 'tumble-dryer',
  'dishwasher', 'fridge', 'stove', 'microwave', 'robot-vacuum', 'sofa', 'bed', 'bed-king', 'desk', 'silverware-fork-knife', 'shower',
  'bathtub', 'toilet', 'home', 'home-assistant', 'sun-thermometer', 'weather-sunny', 'weather-night', 'alarm-light', 'bell', 'cctv',
  'motion-sensor', 'thermometer', 'water-percent', 'flash', 'play', 'movie-open', 'music', 'gamepad-variant', 'party-popper', 'leaf',
  'flower', 'pool', 'car', 'ev-station', 'solar-power', 'battery', 'wifi', 'router-wireless', 'printer', 'baby-carriage', 'dog', 'cat',
];
