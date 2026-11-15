// Themes for the pages (background, cards, text, buttons). Clock faces keep their own colours.
// Each theme is a few base colours; everything else is derived in themeVars().

export const THEMES = [
  // ---- Dark
  { id: 'glass', name: 'Glass', group: 'Dark', dark: true, glass: true, bg: '#0b0c10', card: 'rgba(255,255,255,0.085)', text: '#ffffff', accent: '#30a14e', date: '#8fb3ff', on: 'rgba(255,255,255,0.92)', onText: '#111111',
    glow: ['rgba(70,110,190,0.35)', 'rgba(120,70,170,0.28)', 'rgba(40,130,140,0.18)'] },
  { id: 'midnight', name: 'Midnight', group: 'Dark', dark: true, glass: true, bg: '#060a17', card: 'rgba(130,160,255,0.09)', text: '#eef2ff', accent: '#7c9cff', date: '#9db4ff', on: '#d2ddff', onText: '#0b1430',
    glow: ['rgba(60,90,220,0.35)', 'rgba(30,60,160,0.3)', 'rgba(110,80,220,0.18)'] },
  { id: 'carbon', name: 'Carbon', group: 'Dark', dark: true, bg: '#000000', card: '#141416', text: '#f5f5f7', accent: '#30d158', date: '#8e8e93', on: '#f5f5f7', onText: '#000000' },
  { id: 'forest', name: 'Forest', group: 'Dark', dark: true, glass: true, bg: '#07110c', card: 'rgba(140,255,190,0.07)', text: '#eaf6ee', accent: '#3ccf85', date: '#8fd6ad', on: '#cdeedb', onText: '#0b2416',
    glow: ['rgba(40,140,90,0.32)', 'rgba(20,90,70,0.3)', 'rgba(120,170,60,0.14)'] },
  { id: 'plum', name: 'Plum', group: 'Dark', dark: true, glass: true, bg: '#11081a', card: 'rgba(220,160,255,0.08)', text: '#f6eefc', accent: '#c27cf2', date: '#d1a6f5', on: '#ecd6ff', onText: '#2a0f3d',
    glow: ['rgba(150,60,200,0.32)', 'rgba(90,40,160,0.3)', 'rgba(200,80,150,0.16)'] },
  // ---- Pastel (light)
  { id: 'linen', name: 'Linen', group: 'Pastel', bg: '#ebe5dc', card: '#f8f5f0', text: '#2b2219', accent: '#7a5a2c', on: '#eedfc6' },
  { id: 'sage', name: 'Sage', group: 'Pastel', bg: '#e2e8df', card: '#f6f8f4', text: '#1f2a22', accent: '#4c6b52', on: '#d4e4d2' },
  { id: 'fog', name: 'Fog', group: 'Pastel', bg: '#e1e6ed', card: '#f7f8fa', text: '#1d2633', accent: '#3f5f8a', on: '#d3e0ef' },
  { id: 'rose-clay', name: 'Rose clay', group: 'Pastel', bg: '#ecdfdb', card: '#faf4f2', text: '#2e1d1a', accent: '#9c4f43', on: '#f0d4cc' },
  { id: 'lagoon', name: 'Lagoon', group: 'Pastel', bg: '#dce8e6', card: '#f5faf9', text: '#15302c', accent: '#2f7d72', on: '#cbe5df' },
  { id: 'lilac', name: 'Lilac', group: 'Pastel', bg: '#e5e1ef', card: '#f8f7fc', text: '#221d33', accent: '#6b5aa8', on: '#ddd5f3' },
  { id: 'apricot', name: 'Apricot', group: 'Pastel', bg: '#eee1d4', card: '#fbf6f1', text: '#2e2016', accent: '#b8662b', on: '#f3d6bd' },
  // ---- Electric (switched-on buttons light up in a vivid colour)
  { id: 'coral', name: 'Coral', group: 'Electric', bg: '#fbe6df', card: '#ffffff', text: '#2a1410', accent: '#e8481f', on: '#f2552c', onText: '#ffffff', onIcon: '#ffffff',
    glow: ['rgba(255,110,70,0.22)', 'rgba(255,170,90,0.18)', 'rgba(255,90,120,0.12)'] },
  { id: 'bubblegum', name: 'Bubblegum', group: 'Electric', bg: '#fbe4ee', card: '#ffffff', text: '#2b1020', accent: '#e02a74', on: '#ef3a85', onText: '#ffffff', onIcon: '#ffffff',
    glow: ['rgba(255,80,150,0.2)', 'rgba(190,110,255,0.14)', 'rgba(255,150,190,0.16)'] },
  { id: 'ultraviolet', name: 'Ultraviolet', group: 'Electric', bg: '#e9e5fe', card: '#ffffff', text: '#17123a', accent: '#5b3cff', on: '#5b3cff', onText: '#ffffff', onIcon: '#ffffff',
    glow: ['rgba(100,70,255,0.22)', 'rgba(60,140,255,0.14)', 'rgba(200,90,255,0.14)'] },
  { id: 'lime', name: 'Lime', group: 'Electric', bg: '#eef5d6', card: '#ffffff', text: '#1b2405', accent: '#4f8a00', on: '#c8f031', onText: '#1b2405', onIcon: '#1b2405',
    glow: ['rgba(190,240,40,0.3)', 'rgba(110,210,80,0.16)', 'rgba(240,230,60,0.16)'] },
  { id: 'mint', name: 'Mint', group: 'Electric', bg: '#dcf4e9', card: '#ffffff', text: '#0d2a1d', accent: '#0f9d63', on: '#34d695', onText: '#05261a', onIcon: '#05261a',
    glow: ['rgba(40,210,140,0.22)', 'rgba(60,190,220,0.14)', 'rgba(150,230,120,0.14)'] },
  { id: 'ink', name: 'Ink', group: 'Electric', bg: '#e8e8ea', card: '#ffffff', text: '#0b0b0c', accent: '#0b0b0c', on: '#0b0b0c', onText: '#ffffff', onIcon: '#ffffff', date: '#55555c' },
];
export const THEME_GROUPS = ['Dark', 'Pastel', 'Electric'];
export const DEFAULT_THEME = 'glass';
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

const rgb = (hex) => {
  const m = String(hex).match(/^#?([0-9a-f]{6})$/i);
  if (!m) return '255,255,255';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** CSS custom properties for a theme. */
export function themeVars(t) {
  const tx = rgb(t.text);
  return {
    '--t-bg': t.bg,
    '--t-glow1': t.glow?.[0] || 'transparent',
    '--t-glow2': t.glow?.[1] || 'transparent',
    '--t-glow3': t.glow?.[2] || 'transparent',
    '--t-card': t.card,
    '--t-card-border': t.dark ? 'rgba(255,255,255,0.08)' : `rgba(${tx},0.07)`,
    '--t-card-shadow': t.dark ? '0 10px 30px rgba(0,0,0,0.25)' : `0 6px 18px rgba(${tx},0.07)`,
    '--t-card-blur': t.glass ? 'blur(28px) saturate(150%)' : 'none',
    '--t-text': t.text,
    '--t-date': t.date || t.accent,
    '--t-soft': `rgba(${tx},${t.dark ? 0.14 : 0.07})`,
    '--t-soft-2': `rgba(${tx},${t.dark ? 0.28 : 0.15})`,
    '--t-on-bg': t.on,
    '--t-on-text': t.onText || (t.dark ? '#111111' : t.text),
    '--t-on-icon': t.onIcon || t.accent,
    '--t-dots-bg': `rgba(${tx},${t.dark ? 0.12 : 0.08})`,
    '--t-dot': `rgba(${tx},0.4)`,
    '--t-dot-on': t.text,
  };
}

/** Apply a theme to an element (the whole app by default). */
export function applyTheme(id, el = document.documentElement) {
  const t = themeById(id);
  const vars = themeVars(t);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  if (el === document.documentElement) {
    document.body.classList.toggle('theme-light', !t.dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  }
  return t;
}
