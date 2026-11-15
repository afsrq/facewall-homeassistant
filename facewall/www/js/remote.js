// TV remotes: works out which integration a TV comes from (Apple TV, Roku, Android TV, Fire TV, LG, Samsung, Sony…)
// and how to press its buttons.

const KEYS = ['up', 'down', 'left', 'right', 'ok', 'back', 'home'];
// remote.send_command names per integration, in KEYS order.
const REMOTE_CMDS = {
  apple_tv: ['up', 'down', 'left', 'right', 'select', 'menu', 'home'],
  roku: ['up', 'down', 'left', 'right', 'select', 'back', 'home'],
  androidtv_remote: ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT', 'DPAD_CENTER', 'BACK', 'HOME'],
  samsungtv: ['KEY_UP', 'KEY_DOWN', 'KEY_LEFT', 'KEY_RIGHT', 'KEY_ENTER', 'KEY_RETURN', 'KEY_HOME'],
  braviatv: ['Up', 'Down', 'Left', 'Right', 'Confirm', 'Return', 'Home'],
  philips_js: ['CursorUp', 'CursorDown', 'CursorLeft', 'CursorRight', 'Confirm', 'Back', 'Home'],
  firetv: ['up', 'down', 'left', 'right', 'select', 'back', 'home'],
};
const ADB = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'CENTER', 'BACK', 'HOME'];
const WEBOS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'BACK', 'HOME'];

export const PLATFORM_NAMES = { apple_tv: 'Apple TV', roku: 'Roku', androidtv_remote: 'Android TV', androidtv: 'Android TV / Fire TV', webostv: 'LG webOS', samsungtv: 'Samsung', braviatv: 'Sony Bravia', philips_js: 'Philips', firetv: 'Fire TV', cast: 'Chromecast', music_assistant: 'Music Assistant' };

/** The remote.* entity that goes with a media player: chosen on the tile, on the same device, or with the same name. */
export function pairedRemote(store, reg, mpId, chosen) {
  if (chosen && store.get(chosen)) return chosen;
  const di = reg?.entities?.[mpId]?.di;
  const remotes = store.list(['remote']).map((s) => s.entity_id);
  if (di) { const r = remotes.find((r) => reg.entities[r]?.di === di); if (r) return r; }
  const obj = mpId.split('.')[1];
  return remotes.find((r) => r.split('.')[1] === obj) || remotes.find((r) => obj.startsWith(r.split('.')[1]) || r.split('.')[1].startsWith(obj)) || null;
}

/** { platform, name, canNavigate, press(key) } for a media player. */
export function remoteFor(store, reg, mpId, chosen) {
  const remote = pairedRemote(store, reg, mpId, chosen);
  const platform = reg?.entities?.[mpId]?.pl || (remote && reg?.entities?.[remote]?.pl) || null;
  const mp = (service, data = {}) => store.call('media_player', service, data, { entity_id: mpId });
  let nav = null;
  if (platform === 'androidtv') nav = (i) => store.call('androidtv', 'adb_command', { command: ADB[i] }, { entity_id: mpId });
  else if (platform === 'webostv') nav = (i) => store.call('webostv', 'button', { entity_id: mpId, button: WEBOS[i] });
  else if (remote) {
    const cmds = REMOTE_CMDS[platform] || REMOTE_CMDS[reg?.entities?.[remote]?.pl] || REMOTE_CMDS.apple_tv;
    nav = (i) => store.call('remote', 'send_command', { command: cmds[i] }, { entity_id: remote });
  }
  return {
    platform, remote, name: PLATFORM_NAMES[platform] || null, canNavigate: !!nav,
    press(key) {
      const i = KEYS.indexOf(key);
      if (i >= 0 && nav) return nav(i);
      if (key === 'play') return mp('media_play_pause');
      if (key === 'volup') return mp('volume_up');
      if (key === 'voldown') return mp('volume_down');
      if (key === 'mute') return mp('volume_mute', { is_volume_muted: !store.get(mpId)?.attributes?.is_volume_muted });
      if (key === 'power') {
        const off = ['off', 'standby', 'unavailable'].includes(store.get(mpId)?.state);
        if (remote && platform !== 'webostv') return store.call('remote', off ? 'turn_on' : 'turn_off', {}, { entity_id: remote });
        return mp(off ? 'turn_on' : 'turn_off');
      }
    },
  };
}

/** Swipe or tap on a pad: swipes become arrows, taps become OK. */
export function touchpad(el, press) {
  let start = null;
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; start = [e.clientX, e.clientY, Date.now()]; el.setPointerCapture?.(e.pointerId); e.stopPropagation(); });
  el.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1];
    start = null;
    e.stopPropagation();
    if (Math.hypot(dx, dy) < 18) return press('ok');
    press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  el.addEventListener('pointercancel', () => { start = null; });
}
