// Small line-icon set (24x24, stroke = currentColor).
const P = {
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
  bulbOff: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M16.2 13.4A6 6 0 0 0 8.1 4.6"/><path d="M6.3 7.4A6 6 0 0 0 8.4 13.8c.6.5 1 1.2 1.1 2V16h5"/><path d="M3 3l18 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.7-1.5"/>',
  power: '<path d="M12 3v8"/><path d="M6.4 6.8a8 8 0 1 0 11.2 0"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  snow: '<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C11 6 13 3 15.5 3.6 18 4.2 16.8 8.6 13.4 11.2"/><path d="M13.6 12c4.4-1 7.4 1 6.8 3.5-.6 2.5-5 1.3-7.6-2.1"/><path d="M12 13.6c1 4.4-1 7.4-3.5 6.8-2.5-.6-1.3-5 2.1-7.6"/><path d="M10.4 12C6 13 3 11 3.6 8.5 4.2 6 8.6 7.2 11.2 10.6"/>',
  auto: '<path d="M20 12a8 8 0 0 1-14.3 4.9"/><path d="M4 12a8 8 0 0 1 14.3-4.9"/><path d="M18.5 3.5v4h-4M5.5 20.5v-4h4"/>',
  flame: '<path d="M12 3c.5 3 3.5 4.5 3.5 8.5a3.5 3.5 0 0 1-7 0c0-1.3.5-2.3 1.2-3C10 10 11 10 11 8c0-2 1-3.8 1-5z"/><path d="M6.2 13.2A6 6 0 0 0 12 21a6 6 0 0 0 6-6c0-1.4-.4-2.7-1-3.8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  toggle: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="3"/>',
  blinds: '<path d="M4 3h16M5 3v18M19 3v18"/><path d="M5 7h14M5 11h14M5 15h14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle cx="14.5" cy="12" r=".8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
  resize: '<path d="M14 20h6v-6"/><path d="M20 20l-8-8"/><path d="M10 4H4v6"/><path d="M4 4l8 8"/>',
  minus: '<path d="M5 12h14"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.toggle}</svg>`;
}

export function domainIcon(domain, on) {
  return ({
    light: on ? 'bulb' : 'bulb', switch: 'toggle', input_boolean: 'toggle', fan: 'fan', lock: on ? 'unlock' : 'lock',
    cover: 'blinds', scene: 'sparkles', script: 'play', button: 'play', input_button: 'play', climate: 'snow',
    water_heater: 'flame', sensor: 'gauge', binary_sensor: 'door', automation: 'auto', media_player: 'play',
  })[domain] || 'toggle';
}
