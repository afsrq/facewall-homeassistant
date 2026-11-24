// When Facewall is opened inside Home Assistant (its app panel), Home Assistant shows its sidebar
// and a top bar around it. Home Assistant lets an app inside that panel ask for kiosk mode, which
// hides both; the sidebar can still be opened as an overlay with the "toggle-menu" message.

/** True when we're shown inside another page (Home Assistant's app panel). */
export const inHaPanel = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

let kiosk = false;
const post = (msg) => { try { window.parent.postMessage(msg, '*'); } catch { /* not in a frame */ } };

/** Hide (true) or show (false) Home Assistant's sidebar and top bar around Facewall. */
export function setHaKiosk(on) {
  if (!inHaPanel || on === kiosk) return;
  kiosk = on;
  if (on) post({ type: 'home-assistant/subscribe-properties', kioskMode: true });
  else post({ type: 'home-assistant/unsubscribe-properties' });
}

/** Open Home Assistant's sidebar (as an overlay while it's hidden). */
export function openHaMenu() { post({ type: 'home-assistant/toggle-menu' }); }

// ------------------------------------------------------------------ edge to edge
// Facewall is served by Home Assistant itself (same address), so inside its app panel it can reach the
// frame it sits in. Stretching that frame over the whole screen covers the strips Home Assistant
// leaves for the iPad's status bar and home bar, which otherwise show its own colours.
let filled = null, watch = null;
const FILL = { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', margin: '0', border: '0', zIndex: '2147483000' };
function frameEl() { try { return window.frameElement || null; } catch { return null; } }
/** The screen's safe areas (status bar, home bar) as the page around us sees them, in px. */
function parentInsets() {
  try {
    const d = window.parent.document;
    const probe = d.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    d.body.appendChild(probe);
    const cs = window.parent.getComputedStyle(probe);
    const r = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
    probe.remove();
    return r;
  } catch { return null; }
}
function applyInsets(r) {
  const st = document.documentElement.style;
  for (const k of ['top', 'right', 'bottom', 'left']) { if (r) st.setProperty('--sa-' + k, r[k] + 'px'); else st.removeProperty('--sa-' + k); }
}
/** Pin the frame over the whole screen. If something above it makes "fixed" relative to itself, offset to make up for it. */
function cover(fe) {
  Object.assign(fe.style, FILL);
  try {
    const r = fe.getBoundingClientRect(), W = window.parent.innerWidth, H = window.parent.innerHeight;
    if (Math.abs(r.left) > 1 || Math.abs(r.top) > 1 || Math.abs(r.width - W) > 2 || Math.abs(r.height - H) > 2) {
      Object.assign(fe.style, { top: -r.top + 'px', left: -r.left + 'px', width: W + 'px', height: H + 'px', right: 'auto', bottom: 'auto' });
    }
  } catch { /* ignore */ }
}
/** Fill the whole screen (true) or sit where Home Assistant puts us (false). Returns whether it worked. */
export function setHaFill(on) {
  const fe = frameEl();
  if (!inHaPanel || !fe) return false;
  if (on && !filled) {
    filled = {};
    for (const k of Object.keys(FILL)) { filled[k] = fe.style[k]; fe.style[k] = FILL[k]; }
    watch = () => { cover(fe); applyInsets(parentInsets()); };
    watch();
    setTimeout(watch, 400);
    try { window.parent.addEventListener('resize', watch); } catch { /* ignore */ }
  } else if (!on && filled) {
    for (const [k, v] of Object.entries(filled)) fe.style[k] = v;
    filled = null;
    try { window.parent.removeEventListener('resize', watch); } catch { /* ignore */ }
    applyInsets(null);
  }
  return true;
}
/** True when we can stretch over the whole screen (inside Home Assistant on the same address). */
export const canFill = () => inHaPanel && !!frameEl();

// ------------------------------------------------------------------ the app's own strips
// The Home Assistant app paints the strip behind the iPad's status bar and the area around the web page
// itself, in colours it reads from Home Assistant's theme (--app-header-background-color, --app-theme-color,
// --primary-background-color) whenever the page fires "settheme". Facewall sets those to the colours on its
// screen and fires the event, so the strips blend in. Put back when Facewall is closed.
let chromeKey = '';
export function setHaChrome(top, bottom) {
  if (!inHaPanel) return;
  let d;
  try { d = window.parent.document; } catch { return; }
  const key = top && bottom ? top + '|' + bottom : '';
  if (key === chromeKey) return;
  chromeKey = key;
  let st = d.getElementById('facewall-chrome');
  if (!key) { st?.remove(); }
  else {
    if (!st) { st = d.createElement('style'); st.id = 'facewall-chrome'; d.head.appendChild(st); }
    st.textContent = `html, body, home-assistant { --app-header-background-color: ${top} !important; --app-theme-color: ${top} !important; --primary-background-color: ${bottom} !important; }`;
    d.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
  }
  try { window.parent.dispatchEvent(new Event('settheme')); } catch { /* ignore */ }
}
if (inHaPanel) addEventListener('pagehide', () => setHaChrome(null, null));

// ------------------------------------------------------------------ open Facewall when Home Assistant starts
// Home Assistant opens each user's "default panel" when the app starts. Its settings only offer dashboards,
// but the value can be any panel, including this app's. Facewall sits in Home Assistant's own page (same
// address), so it can read the signed-in user and save that choice the same way Home Assistant's settings do.
function haHass() { try { return window.parent.document.querySelector('home-assistant')?.hass || null; } catch { return null; } }
/** Facewall's own panel (its place in Home Assistant's sidebar), if we're inside it. */
function facewallPanel(hass) {
  let here = '';
  try { here = window.parent.location.pathname.split('/')[1] || ''; } catch { /* not reachable */ }
  const panels = hass?.panels || {};
  if (panels[here]) return here;
  return Object.keys(panels).find((k) => /(^|_)facewall$/.test(k)) || null;
}
/** { user, panel, on } for the signed-in Home Assistant user, or null when Facewall isn't inside Home Assistant. */
export function haStartInfo() {
  const hass = haHass();
  if (!hass?.connection) return null;
  const panel = facewallPanel(hass);
  if (!panel) return null;
  return { user: hass.user?.name || 'this user', admin: !!hass.user?.is_admin, panel, on: hass.userData?.default_panel === panel };
}
/** Make Home Assistant open on Facewall for the signed-in user (on = true), or go back to its usual start page. */
export async function setHaStart(on) {
  const hass = haHass(), info = haStartInfo();
  if (!hass || !info) throw new Error('Open Facewall from Home Assistant’s sidebar to set this');
  const cur = { ...(hass.userData || {}) };
  let before = null;
  try { before = JSON.parse(localStorage.getItem('facewall.prevDefaultPanel') || 'null'); } catch { /* ignore */ }
  if (on) {
    if (cur.default_panel !== info.panel) { try { localStorage.setItem('facewall.prevDefaultPanel', JSON.stringify(cur.default_panel ?? null)); } catch { /* ignore */ } }
    cur.default_panel = info.panel;
  } else if (before && before !== info.panel) cur.default_panel = before;
  else delete cur.default_panel;
  await hass.connection.sendMessagePromise({ type: 'frontend/set_user_data', key: 'core', value: cur });
}
