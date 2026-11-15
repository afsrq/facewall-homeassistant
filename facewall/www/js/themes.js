import { fontCss } from './header.js';

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
  { id: 'linen', name: 'Linen', group: 'Pastel', bg: '#ebe5dc', card: '#f8f5f0', text: '#2b2219', accent: '#7a5a2c', on: '#e8d0a6' },
  { id: 'sage', name: 'Sage', group: 'Pastel', bg: '#e2e8df', card: '#f6f8f4', text: '#1f2a22', accent: '#4c6b52', on: '#bfd8bb' },
  { id: 'fog', name: 'Fog', group: 'Pastel', bg: '#e1e6ed', card: '#f7f8fa', text: '#1d2633', accent: '#3f5f8a', on: '#bdd2ec' },
  { id: 'rose-clay', name: 'Rose clay', group: 'Pastel', bg: '#ecdfdb', card: '#faf4f2', text: '#2e1d1a', accent: '#9c4f43', on: '#ecc0b3' },
  { id: 'lagoon', name: 'Lagoon', group: 'Pastel', bg: '#dce8e6', card: '#f5faf9', text: '#15302c', accent: '#2f7d72', on: '#acdcd2' },
  { id: 'lilac', name: 'Lilac', group: 'Pastel', bg: '#e5e1ef', card: '#f8f7fc', text: '#221d33', accent: '#6b5aa8', on: '#cdc0f1' },
  { id: 'apricot', name: 'Apricot', group: 'Pastel', bg: '#eee1d4', card: '#fbf6f1', text: '#2e2016', accent: '#b8662b', on: '#f3c49a' },
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
  // ---- Architectural: themes that match the style of the house (pattern + title font + colours)
  { id: 'mcm', name: 'Mid-century', group: 'Architectural', bg: '#efe6d2', card: '#faf5ea', text: '#2d2418', accent: '#2f7f7a', date: '#c66a1f', on: '#e8b13a', onText: '#2d2418', onIcon: '#2d2418',
    titleFont: 'futura', pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg stroke='%232f7f7a' stroke-opacity='0.22' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='48' y1='52' x2='66.0' y2='52.0'/%3E%3Cline x1='48' y1='52' x2='55.0' y2='59.0'/%3E%3Cline x1='48' y1='52' x2='48.0' y2='70.0'/%3E%3Cline x1='48' y1='52' x2='41.0' y2='59.0'/%3E%3Cline x1='48' y1='52' x2='30.0' y2='52.0'/%3E%3Cline x1='48' y1='52' x2='41.0' y2='45.0'/%3E%3Cline x1='48' y1='52' x2='48.0' y2='34.0'/%3E%3Cline x1='48' y1='52' x2='55.0' y2='45.0'/%3E%3C/g%3E%3Ccircle cx='48' cy='52' r='2.6' fill='%232f7f7a' fill-opacity='0.22'/%3E%3Cg stroke='%23d9822b' stroke-opacity='0.22' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='190' y1='150' x2='203.0' y2='150.0'/%3E%3Cline x1='190' y1='150' x2='195.1' y2='155.1'/%3E%3Cline x1='190' y1='150' x2='190.0' y2='163.0'/%3E%3Cline x1='190' y1='150' x2='184.9' y2='155.1'/%3E%3Cline x1='190' y1='150' x2='177.0' y2='150.0'/%3E%3Cline x1='190' y1='150' x2='184.9' y2='144.9'/%3E%3Cline x1='190' y1='150' x2='190.0' y2='137.0'/%3E%3Cline x1='190' y1='150' x2='195.1' y2='144.9'/%3E%3C/g%3E%3Ccircle cx='190' cy='150' r='2.6' fill='%23d9822b' fill-opacity='0.22'/%3E%3Cg stroke='%237a5a2c' stroke-opacity='0.22' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='110' y1='215' x2='119.0' y2='215.0'/%3E%3Cline x1='110' y1='215' x2='113.5' y2='218.5'/%3E%3Cline x1='110' y1='215' x2='110.0' y2='224.0'/%3E%3Cline x1='110' y1='215' x2='106.5' y2='218.5'/%3E%3Cline x1='110' y1='215' x2='101.0' y2='215.0'/%3E%3Cline x1='110' y1='215' x2='106.5' y2='211.5'/%3E%3Cline x1='110' y1='215' x2='110.0' y2='206.0'/%3E%3Cline x1='110' y1='215' x2='113.5' y2='211.5'/%3E%3C/g%3E%3Ccircle cx='110' cy='215' r='2.6' fill='%237a5a2c' fill-opacity='0.22'/%3E%3Cpath transform='translate%28150 40%29 rotate%2820%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%23d9822b' fill-opacity='0.17600000000000002'/%3E%3Cpath transform='translate%2830 170%29 rotate%28-30%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%237a5a2c' fill-opacity='0.17600000000000002'/%3E%3Cpath transform='translate%28215 235%29 rotate%2860%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%232f7f7a' fill-opacity='0.17600000000000002'/%3E%3Ccircle cx='120' cy='110' r='3' fill='%237a5a2c' fill-opacity='0.22'/%3E%3Ccircle cx='230' cy='70' r='2.5' fill='%232f7f7a' fill-opacity='0.22'/%3E%3C/svg%3E")`, glow: ['rgba(232,177,58,0.18)', 'rgba(47,127,122,0.12)', 'rgba(217,130,43,0.10)'] },
  { id: 'mcm-walnut', name: 'Walnut', group: 'Architectural', dark: true, glass: true, bg: '#2a1d14', card: 'rgba(255,236,210,0.075)', text: '#f6ead8', accent: '#e8a33d', date: '#e8a33d', on: '#e8a33d', onText: '#2a1d14',
    titleFont: 'futura', pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg stroke='%23e8a33d' stroke-opacity='0.14' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='48' y1='52' x2='66.0' y2='52.0'/%3E%3Cline x1='48' y1='52' x2='55.0' y2='59.0'/%3E%3Cline x1='48' y1='52' x2='48.0' y2='70.0'/%3E%3Cline x1='48' y1='52' x2='41.0' y2='59.0'/%3E%3Cline x1='48' y1='52' x2='30.0' y2='52.0'/%3E%3Cline x1='48' y1='52' x2='41.0' y2='45.0'/%3E%3Cline x1='48' y1='52' x2='48.0' y2='34.0'/%3E%3Cline x1='48' y1='52' x2='55.0' y2='45.0'/%3E%3C/g%3E%3Ccircle cx='48' cy='52' r='2.6' fill='%23e8a33d' fill-opacity='0.14'/%3E%3Cg stroke='%234fb3a9' stroke-opacity='0.14' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='190' y1='150' x2='203.0' y2='150.0'/%3E%3Cline x1='190' y1='150' x2='195.1' y2='155.1'/%3E%3Cline x1='190' y1='150' x2='190.0' y2='163.0'/%3E%3Cline x1='190' y1='150' x2='184.9' y2='155.1'/%3E%3Cline x1='190' y1='150' x2='177.0' y2='150.0'/%3E%3Cline x1='190' y1='150' x2='184.9' y2='144.9'/%3E%3Cline x1='190' y1='150' x2='190.0' y2='137.0'/%3E%3Cline x1='190' y1='150' x2='195.1' y2='144.9'/%3E%3C/g%3E%3Ccircle cx='190' cy='150' r='2.6' fill='%234fb3a9' fill-opacity='0.14'/%3E%3Cg stroke='%23f6ead8' stroke-opacity='0.14' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='110' y1='215' x2='119.0' y2='215.0'/%3E%3Cline x1='110' y1='215' x2='113.5' y2='218.5'/%3E%3Cline x1='110' y1='215' x2='110.0' y2='224.0'/%3E%3Cline x1='110' y1='215' x2='106.5' y2='218.5'/%3E%3Cline x1='110' y1='215' x2='101.0' y2='215.0'/%3E%3Cline x1='110' y1='215' x2='106.5' y2='211.5'/%3E%3Cline x1='110' y1='215' x2='110.0' y2='206.0'/%3E%3Cline x1='110' y1='215' x2='113.5' y2='211.5'/%3E%3C/g%3E%3Ccircle cx='110' cy='215' r='2.6' fill='%23f6ead8' fill-opacity='0.14'/%3E%3Cpath transform='translate%28150 40%29 rotate%2820%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%234fb3a9' fill-opacity='0.11200000000000002'/%3E%3Cpath transform='translate%2830 170%29 rotate%28-30%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%23f6ead8' fill-opacity='0.11200000000000002'/%3E%3Cpath transform='translate%28215 235%29 rotate%2860%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%23e8a33d' fill-opacity='0.11200000000000002'/%3E%3Ccircle cx='120' cy='110' r='3' fill='%23f6ead8' fill-opacity='0.14'/%3E%3Ccircle cx='230' cy='70' r='2.5' fill='%23e8a33d' fill-opacity='0.14'/%3E%3C/svg%3E")`, glow: ['rgba(232,163,61,0.22)', 'rgba(79,179,169,0.14)', 'rgba(190,90,40,0.16)'] },
  { id: 'mcm-atomic', name: 'Atomic', group: 'Architectural', bg: '#cfe3dc', card: '#f7f3ea', text: '#1f2b2a', accent: '#c2541f', date: '#c2541f', on: '#e0662e', onText: '#ffffff', onIcon: '#ffffff',
    titleFont: 'futura', pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg stroke='%23e0662e' stroke-opacity='0.2' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='48' y1='52' x2='66.0' y2='52.0'/%3E%3Cline x1='48' y1='52' x2='55.0' y2='59.0'/%3E%3Cline x1='48' y1='52' x2='48.0' y2='70.0'/%3E%3Cline x1='48' y1='52' x2='41.0' y2='59.0'/%3E%3Cline x1='48' y1='52' x2='30.0' y2='52.0'/%3E%3Cline x1='48' y1='52' x2='41.0' y2='45.0'/%3E%3Cline x1='48' y1='52' x2='48.0' y2='34.0'/%3E%3Cline x1='48' y1='52' x2='55.0' y2='45.0'/%3E%3C/g%3E%3Ccircle cx='48' cy='52' r='2.6' fill='%23e0662e' fill-opacity='0.2'/%3E%3Cg stroke='%231f2b2a' stroke-opacity='0.2' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='190' y1='150' x2='203.0' y2='150.0'/%3E%3Cline x1='190' y1='150' x2='195.1' y2='155.1'/%3E%3Cline x1='190' y1='150' x2='190.0' y2='163.0'/%3E%3Cline x1='190' y1='150' x2='184.9' y2='155.1'/%3E%3Cline x1='190' y1='150' x2='177.0' y2='150.0'/%3E%3Cline x1='190' y1='150' x2='184.9' y2='144.9'/%3E%3Cline x1='190' y1='150' x2='190.0' y2='137.0'/%3E%3Cline x1='190' y1='150' x2='195.1' y2='144.9'/%3E%3C/g%3E%3Ccircle cx='190' cy='150' r='2.6' fill='%231f2b2a' fill-opacity='0.2'/%3E%3Cg stroke='%23f7f3ea' stroke-opacity='0.2' stroke-width='2' stroke-linecap='round'%3E%3Cline x1='110' y1='215' x2='119.0' y2='215.0'/%3E%3Cline x1='110' y1='215' x2='113.5' y2='218.5'/%3E%3Cline x1='110' y1='215' x2='110.0' y2='224.0'/%3E%3Cline x1='110' y1='215' x2='106.5' y2='218.5'/%3E%3Cline x1='110' y1='215' x2='101.0' y2='215.0'/%3E%3Cline x1='110' y1='215' x2='106.5' y2='211.5'/%3E%3Cline x1='110' y1='215' x2='110.0' y2='206.0'/%3E%3Cline x1='110' y1='215' x2='113.5' y2='211.5'/%3E%3C/g%3E%3Ccircle cx='110' cy='215' r='2.6' fill='%23f7f3ea' fill-opacity='0.2'/%3E%3Cpath transform='translate%28150 40%29 rotate%2820%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%231f2b2a' fill-opacity='0.16000000000000003'/%3E%3Cpath transform='translate%2830 170%29 rotate%28-30%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%23f7f3ea' fill-opacity='0.16000000000000003'/%3E%3Cpath transform='translate%28215 235%29 rotate%2860%29' d='M0 0 C 14 -12 30 -10 38 2 C 30 -4 18 -2 8 8 Z' fill='%23e0662e' fill-opacity='0.16000000000000003'/%3E%3Ccircle cx='120' cy='110' r='3' fill='%23f7f3ea' fill-opacity='0.2'/%3E%3Ccircle cx='230' cy='70' r='2.5' fill='%23e0662e' fill-opacity='0.2'/%3E%3C/svg%3E")`, glow: ['rgba(224,102,46,0.14)', 'rgba(255,255,255,0.35)', 'rgba(31,43,42,0.06)'] },
  { id: 'palm-springs', name: 'Palm Springs', group: 'Architectural', bg: '#f6e7e1', card: '#fffaf6', text: '#23302f', accent: '#1fa3a0', date: '#d9466f', on: '#f28aa8', onText: '#2b0f19', onIcon: '#2b0f19',
    titleFont: 'avenir', pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Cg fill='none' stroke='%23e0567f' stroke-opacity='0.08' stroke-width='2.2'%3E%3Crect x='1.5' y='1.5' width='69' height='69' rx='3'/%3E%3Cpath d='M36.0 6 Q 66 6 66 36.0 Q 66 66 36.0 66 Q 6 66 6 36.0 Q 6 6 36.0 6 Z'/%3E%3Ccircle cx='36.0' cy='36.0' r='10.1'/%3E%3C/g%3E%3C/svg%3E")`, glow: ['rgba(31,163,160,0.14)', 'rgba(242,138,168,0.18)', 'rgba(255,210,63,0.12)'] },
  { id: 'palm-pool', name: 'Desert Pool', group: 'Architectural', bg: '#bfe6e3', card: '#ffffff', text: '#123b3a', accent: '#0f7d78', date: '#e2551f', on: '#ffd23f', onText: '#123b3a', onIcon: '#123b3a',
    titleFont: 'avenir', pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.45' stroke-width='2.2'%3E%3Crect x='1.5' y='1.5' width='69' height='69' rx='3'/%3E%3Cpath d='M36.0 6 Q 66 6 66 36.0 Q 66 66 36.0 66 Q 6 66 6 36.0 Q 6 6 36.0 6 Z'/%3E%3Ccircle cx='36.0' cy='36.0' r='10.1'/%3E%3C/g%3E%3C/svg%3E")`, glow: ['rgba(255,255,255,0.4)', 'rgba(242,98,46,0.12)', 'rgba(15,125,120,0.1)'] },
  { id: 'palm-dusk', name: 'Desert Dusk', group: 'Architectural', dark: true, glass: true, bg: '#2b1b2e', card: 'rgba(255,200,220,0.08)', text: '#fdeef2', accent: '#ff8fab', date: '#ffb38a', on: '#ff8fab', onText: '#2b1b2e',
    titleFont: 'avenir', pattern: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Cg fill='none' stroke='%23ff8fab' stroke-opacity='0.09' stroke-width='2.2'%3E%3Crect x='1.5' y='1.5' width='69' height='69' rx='3'/%3E%3Cpath d='M36.0 6 Q 66 6 66 36.0 Q 66 66 36.0 66 Q 6 66 6 36.0 Q 6 6 36.0 6 Z'/%3E%3Ccircle cx='36.0' cy='36.0' r='10.1'/%3E%3C/g%3E%3C/svg%3E")`, glow: ['rgba(255,143,171,0.24)', 'rgba(255,179,138,0.18)', 'rgba(31,163,160,0.14)'] },
];
export const THEME_GROUPS = ['Dark', 'Pastel', 'Electric', 'Architectural'];
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
    '--t-pattern': t.pattern || 'none',
    '--t-title-font': t.titleFont ? fontCss(t.titleFont) : 'inherit',
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
