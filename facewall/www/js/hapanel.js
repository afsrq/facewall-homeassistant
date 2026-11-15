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
