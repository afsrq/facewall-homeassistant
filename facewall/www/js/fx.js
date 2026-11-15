// Living backgrounds: subtle animated weather (rain, snow, clouds, fog, wind, sun, stars) behind the tiles,
// and seasonal touches (spring blossoms, autumn leaves, winter snow) when the weather is calm.
// One canvas per page; only the page on screen animates.

const live = new Set();
let running = false;

/** What to show now: { kind, heavy } or null. */
export function fxMode(store, settings, now = new Date()) {
  const g = settings?.general?.fx || {};
  if (g.weather === false && g.season === false) return null;
  const wid = settings?.header?.weather && store.get(settings.header.weather) ? settings.header.weather : store.list?.(['weather'])?.[0]?.entity_id;
  const w = wid ? store.get(wid) : null;
  const c = w?.state;
  if (g.weather !== false && c) {
    if (c === 'pouring') return { kind: 'rain', heavy: true };
    if (c === 'rainy') return { kind: 'rain' };
    if (c === 'lightning-rainy' || c === 'lightning') return { kind: 'rain', heavy: true, lightning: true };
    if (c === 'snowy' || c === 'snowy-rainy' || c === 'hail') return { kind: 'snow', heavy: c !== 'snowy-rainy' };
    if (c === 'fog') return { kind: 'fog' };
    if (c === 'windy' || c === 'windy-variant') return { kind: 'wind' };
    if (c === 'cloudy') return { kind: 'clouds', heavy: true };
    if (c === 'partlycloudy') return { kind: 'clouds' };
    if (c === 'clear-night') return { kind: 'stars' };
  }
  if (g.season !== false) {
    const m = now.getMonth();
    if (m === 11 || m === 0) return { kind: 'snow', light: true };
    if (m === 9 || m === 10) return { kind: 'leaves' };
    if (m === 3 || m === 4) return { kind: 'petals' };
  }
  if (g.weather !== false && c === 'sunny') return { kind: 'sun' };
  return null;
}

export class Fx {
  constructor(canvas, getMode, getAmount) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.getMode = getMode; this.getAmount = getAmount;
    this.parts = []; this.key = ''; this.t = 0; this.flash = 0;
  }
  start() { live.add(this); if (!running) { running = true; requestAnimationFrame(loop); } }
  stop() { live.delete(this); }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.key = ''; }
    return [w, h];
  }
  visible() {
    if (document.hidden || document.querySelector('.sleep-cover.on')) return false;
    const r = this.canvas.getBoundingClientRect();
    return r.width > 0 && r.right > 1 && r.left < innerWidth - 1;
  }
  seed(mode, w, h) {
    const amt = this.getAmount() === 'more' ? 1.6 : 1;
    const n = Math.round(({ rain: mode.heavy ? 140 : 80, snow: mode.light ? 40 : mode.heavy ? 110 : 70, clouds: mode.heavy ? 7 : 4, fog: 6, wind: 30, stars: 70, leaves: 18, petals: 24, sun: 1 }[mode.kind] || 0) * amt);
    const R = Math.random;
    this.parts = Array.from({ length: n }, () => ({ x: R() * w, y: R() * h, z: 0.4 + R() * 0.6, a: R() * Math.PI * 2, s: R(), r: R() }));
  }
  frame(dt) {
    const mode = this.getMode();
    const ctx = this.ctx;
    const [w, h] = this.resize();
    const key = mode ? `${mode.kind}${mode.heavy ? 'H' : ''}${mode.light ? 'L' : ''}${this.getAmount()}` : '';
    if (key !== this.key) { this.key = key; ctx.clearRect(0, 0, w, h); if (mode) this.seed(mode, w, h); else this.parts = []; }
    if (!mode) return;
    ctx.clearRect(0, 0, w, h);
    const ink = getComputedStyle(this.canvas).color || 'rgb(255,255,255)';
    const rgb = (ink.match(/\d+/g) || [255, 255, 255]).slice(0, 3).join(',');
    this.t += dt;
    const P = this.parts, k = dt / 16.7;
    switch (mode.kind) {
      case 'rain': {
        ctx.strokeStyle = `rgba(${rgb},${mode.heavy ? 0.32 : 0.24})`; ctx.lineWidth = 1.2; ctx.beginPath();
        for (const p of P) {
          const len = 10 + p.z * 16, vx = -1.2 * p.z * k, vy = (9 + p.z * 9) * k;
          p.x += vx; p.y += vy;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * (w + 60); }
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - len * 0.12, p.y - len);
        }
        ctx.stroke();
        if (mode.lightning) {
          if (this.flash <= 0 && Math.random() < 0.0015 * k) this.flash = 1;
          if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.18 * this.flash})`; ctx.fillRect(0, 0, w, h); this.flash -= 0.06 * k; }
        }
        break;
      }
      case 'snow': {
        ctx.fillStyle = `rgba(${rgb},${mode.light ? 0.22 : 0.32})`;
        for (const p of P) {
          p.a += 0.01 * k; p.y += (0.4 + p.z * 0.9) * k; p.x += Math.sin(p.a) * 0.4 * k;
          if (p.y > h + 5) { p.y = -5; p.x = Math.random() * w; }
          ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.z * 2.2, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'clouds': case 'fog': {
        const fog = mode.kind === 'fog';
        for (const p of P) {
          p.x += (0.08 + p.z * 0.15) * k;
          const rad = (fog ? 0.45 : 0.22) * Math.max(w, h) * (0.6 + p.z * 0.6);
          if (p.x - rad > w) p.x = -rad;
          const y = fog ? h * (0.3 + p.r * 0.7) : h * p.r * 0.6;
          const gr = ctx.createRadialGradient(p.x, y, 0, p.x, y, rad);
          gr.addColorStop(0, `rgba(${rgb},${fog ? 0.09 : mode.heavy ? 0.07 : 0.05})`); gr.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(p.x, y, rad, rad * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'wind': {
        ctx.strokeStyle = `rgba(${rgb},0.13)`; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        for (const p of P) {
          p.x += (8 + p.z * 10) * k;
          if (p.x > w + 120) { p.x = -120 - Math.random() * 200; p.y = Math.random() * h; }
          const len = 40 + p.z * 70, wave = Math.sin(this.t / 300 + p.a) * 6;
          ctx.beginPath(); ctx.moveTo(p.x - len, p.y + wave); ctx.quadraticCurveTo(p.x - len / 2, p.y + wave - 6, p.x, p.y + wave); ctx.stroke();
        }
        break;
      }
      case 'stars': {
        for (const p of P) {
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t / (600 + p.r * 900) + p.a));
          ctx.fillStyle = `rgba(${rgb},${0.28 * tw * p.z})`;
          ctx.beginPath(); ctx.arc(p.x, p.y * 0.75, 0.6 + p.z * 1.2, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'sun': {
        const pulse = 0.85 + 0.15 * Math.sin(this.t / 2500);
        const gr = ctx.createRadialGradient(w * 0.9, -h * 0.05, 0, w * 0.9, -h * 0.05, Math.max(w, h) * 0.7 * pulse);
        gr.addColorStop(0, 'rgba(255,214,120,0.20)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'leaves': case 'petals': {
        const pal = mode.kind === 'leaves' ? ['217,130,43', '194,84,31', '232,177,58', '140,90,40'] : ['255,183,197', '255,214,224', '250,160,180', '255,240,245'];
        for (const [i, p] of P.entries()) {
          p.a += (0.02 + p.r * 0.02) * k; p.y += (0.5 + p.z * 0.8) * k; p.x += (Math.sin(p.a) * 0.9 + 0.3) * k;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a * 1.5);
          ctx.fillStyle = `rgba(${pal[i % pal.length]},${mode.kind === 'leaves' ? 0.5 : 0.6})`;
          const sz = 5 + p.z * 7;
          ctx.beginPath();
          if (mode.kind === 'leaves') { ctx.moveTo(0, -sz); ctx.quadraticCurveTo(sz * 0.8, 0, 0, sz); ctx.quadraticCurveTo(-sz * 0.8, 0, 0, -sz); }
          else ctx.ellipse(0, 0, sz * 0.55, sz * 0.32, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.restore();
        }
        break;
      }
    }
  }
}

let last = 0;
function loop(ts) {
  const dt = Math.min(64, last ? ts - last : 16.7); last = ts;
  if (!live.size) { running = false; last = 0; return; }
  for (const f of live) if (f.visible()) f.frame(dt);
  requestAnimationFrame(loop);
}
