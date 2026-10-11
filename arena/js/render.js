import { UNITS } from './data.js';

const TAU = Math.PI * 2, W = 1000, H = 620, GY = 350, SZ = 1.8;
export const laneY = slot => 410 + slot * 54;
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

function weapon(g, L, o) {
  const sw = Math.sin(o.atk * Math.PI), hx = 13, hy = -20, w = L.weapon;
  g.save(); g.translate(hx, hy);
  if (w === 'sword' || w === 'axe' || w === 'hammer' || w === 'club' || w === 'dagger') {
    g.rotate(0.5 + sw * 1.3 - o.cast * 0.8);
    if (w === 'sword') { g.fillStyle = '#e8eef8'; g.fillRect(-2, -30, 4, 28); g.fillStyle = '#c9a15a'; g.fillRect(-6, -4, 12, 3); }
    else if (w === 'dagger') { g.fillStyle = '#d8d8f0'; g.fillRect(-1.5, -17, 3, 15); g.fillStyle = '#555'; g.fillRect(-4, -3, 8, 2.5); }
    else if (w === 'axe') { g.fillStyle = '#7a4a2a'; g.fillRect(-1.5, -30, 3, 30); g.fillStyle = '#d8dce8'; g.beginPath(); g.arc(0, -25, 10, -Math.PI / 2, Math.PI / 2); g.fill(); }
    else if (w === 'hammer') { g.fillStyle = '#7a4a2a'; g.fillRect(-1.5, -30, 3, 30); g.fillStyle = '#f2d16b'; rr(g, -9, -37, 18, 11, 3); g.fill(); }
    else { g.fillStyle = '#6a4a2a'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(-7, -34); g.lineTo(7, -34); g.lineTo(2, 0); g.fill(); }
  } else if (w === 'spear') {
    g.rotate(-0.2); g.translate(sw * 14, 0); g.fillStyle = '#8a5a2a'; g.fillRect(-16, -1.5, 46, 3);
    g.fillStyle = '#e8eef8'; g.beginPath(); g.moveTo(30, -5); g.lineTo(44, 0); g.lineTo(30, 5); g.fill();
  } else if (w === 'staff' || w === 'wand') {
    const len = w === 'staff' ? 36 : 18; g.rotate(0.15 - o.cast * 0.5 - sw * 0.3);
    g.fillStyle = '#7a5a3a'; g.fillRect(-1.5, -len, 3, len + 12);
    g.shadowColor = L.orb || '#fff'; g.shadowBlur = 8 + o.cast * 14; g.fillStyle = L.orb || '#fff'; circ(g, 0, -len - 4, 5 + o.cast * 3); g.shadowBlur = 0;
  } else if (w === 'bow') {
    g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.beginPath(); g.arc(-2, -4, 15, -1.25, 1.25); g.stroke();
    g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(2.7, -18.2); g.lineTo(2.7 - sw * 6, -4); g.lineTo(2.7, 10.2); g.stroke();
  } else if (w === 'gun') {
    g.translate(-sw * 5, 0); g.fillStyle = '#2a2f3a'; g.fillRect(-6, -8, 32, 5); g.fillStyle = '#6a4a2a'; g.fillRect(-10, -6, 9, 9);
    if (sw > 0.5) { g.fillStyle = '#ffe14a'; circ(g, 30, -5.5, 5); }
  } else if (w === 'lute') {
    g.rotate(-0.5 + sw * 0.2); g.fillStyle = '#c98a3a'; g.beginPath(); g.ellipse(0, 0, 8, 10, 0, 0, TAU); g.fill(); g.fillStyle = '#7a4a2a'; g.fillRect(-1.5, -24, 3, 16); g.fillStyle = '#3a2a1a'; circ(g, 0, 0, 3);
  } else if (w === 'bomb') {
    g.translate(sw * 8, -sw * 10); g.fillStyle = '#1b1b24'; circ(g, 2, -2, 8); g.strokeStyle = '#a88'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, -9); g.lineTo(9, -14); g.stroke();
    g.fillStyle = Math.sin(o.t * 30) > 0 ? '#ffe14a' : '#ff7a2b'; circ(g, 9.5, -15, 2.5);
  } else if (w === 'fist') { g.translate(sw * 10, 0); g.fillStyle = shade(L.body, 0.8); rr(g, -6, -6, 16, 14, 5); g.fill(); }
  g.restore();
}

function chibi(g, L, o) {
  const bob = o.moving ? Math.abs(Math.sin(o.t * 10 + o.ph)) * 3 : Math.sin(o.t * 3 + o.ph) * 1.2, fl = o.hit > 0.55;
  const skin = fl ? '#fff' : L.skin || '#ffd9b8', body = fl ? '#fff' : L.body;
  const step = o.moving ? Math.sin(o.t * 12 + o.ph) * 3 : 0;
  g.fillStyle = shade(L.body, 0.45); g.fillRect(-9, -9 - Math.max(0, step), 7, 9 + Math.max(0, step)); g.fillRect(2, -9 - Math.max(0, -step), 7, 9 + Math.max(0, -step));
  g.translate(Math.sin(o.atk * Math.PI) * 6, -bob);
  g.fillStyle = body; rr(g, -12, -30, 24, 23, 7); g.fill();
  g.fillStyle = shade(L.body, 0.7); g.fillRect(-12, -13, 24, 3);
  if (L.off === 'shield') { g.fillStyle = '#b8c2d6'; rr(g, 2, -30, 16, 22, 6); g.fill(); g.fillStyle = body; circ(g, 10, -19, 4); }
  weapon(g, L, o);
  g.fillStyle = skin; circ(g, 0, -42, 15);
  const hat = L.hat;
  if (hat !== 'skull' && hat !== 'helm' && hat !== 'hood') { g.fillStyle = L.hair; g.beginPath(); g.arc(0, -44, 15.5, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.fillRect(-15.5, -46, 6, 12); }
  if (hat === 'helm') { g.fillStyle = '#b8c2d6'; g.beginPath(); g.arc(0, -44, 16.5, Math.PI * 0.9, Math.PI * 2.1); g.fill(); g.fillRect(-16, -48, 7, 16); g.fillStyle = '#d6455b'; g.beginPath(); g.ellipse(-3, -62, 9, 5, -0.4, 0, TAU); g.fill(); }
  else if (hat === 'band') { g.fillStyle = '#f2d16b'; g.fillRect(-15, -50, 30, 4); }
  else if (hat === 'horn') { g.fillStyle = '#f2ead6'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8, -54); g.lineTo(s * 17, -68); g.lineTo(s * 14, -50); g.fill(); } }
  else if (hat === 'halo') { g.strokeStyle = '#ffe98a'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -63, 11, 4, 0, 0, TAU); g.stroke(); }
  else if (hat === 'crystal') { g.fillStyle = '#9ff0e0'; for (const [x, h] of [[-9, 12], [0, 20], [9, 13]]) { g.beginPath(); g.moveTo(x - 5, -54); g.lineTo(x, -54 - h); g.lineTo(x + 5, -54); g.fill(); } }
  else if (hat === 'wizard') { g.fillStyle = shade(L.body, 0.65); g.beginPath(); g.moveTo(-14, -52); g.lineTo(-4, -84); g.lineTo(14, -52); g.fill(); g.beginPath(); g.ellipse(0, -52, 21, 5, 0, 0, TAU); g.fill(); }
  else if (hat === 'hood') { g.fillStyle = shade(L.body, 0.7); g.beginPath(); g.arc(0, -43, 17.5, Math.PI * 0.75, Math.PI * 2.1); g.lineTo(2, -62); g.fill(); g.fillRect(-17.5, -44, 8, 16); }
  else if (hat === 'cap') { g.fillStyle = shade(L.body, 0.6); g.beginPath(); g.arc(0, -47, 15, Math.PI, 0); g.fill(); g.fillRect(4, -49, 18, 4); }
  else if (hat === 'feather') { g.fillStyle = shade(L.body, 0.6); g.beginPath(); g.arc(0, -49, 14, Math.PI, 0); g.fill(); g.fillStyle = '#ff6a6a'; g.beginPath(); g.ellipse(-8, -64, 4, 11, -0.5, 0, TAU); g.fill(); }
  else if (hat === 'crown') { g.fillStyle = '#f2d16b'; g.beginPath(); g.moveTo(-12, -54); g.lineTo(-12, -68); g.lineTo(-6, -60); g.lineTo(0, -70); g.lineTo(6, -60); g.lineTo(12, -68); g.lineTo(12, -54); g.fill(); }
  g.fillStyle = hat === 'skull' ? '#15151f' : '#1b1b2a';
  if (o.stun) { g.strokeStyle = g.fillStyle; g.lineWidth = 1.6; for (const x of [3, 10]) { g.beginPath(); g.moveTo(x - 2, -42); g.lineTo(x + 2, -38); g.moveTo(x + 2, -42); g.lineTo(x - 2, -38); g.stroke(); } }
  else if ((o.t + o.ph) % 3.2 < 0.12) { g.fillRect(1, -40, 4, 1.5); g.fillRect(8, -40, 4, 1.5); }
  else { const r = hat === 'skull' ? 3.4 : 2.1; g.beginPath(); g.ellipse(3, -40, r, r * 1.35, 0, 0, TAU); g.ellipse(10, -40, r, r * 1.35, 0, 0, TAU); g.fill(); }
  if (hat === 'skull') g.fillRect(2, -32, 9, 1.5);
}
function slime(g, L, o) {
  const sq = 1 + Math.sin(o.t * (o.moving ? 12 : 4) + o.ph) * 0.08, body = o.hit > 0.55 ? '#fff' : L.body;
  g.translate(Math.sin(o.atk * Math.PI) * 10, 0); g.fillStyle = body; g.beginPath(); g.ellipse(0, -15 * sq, 22 / sq, 16 * sq, 0, Math.PI, 0); g.lineTo(22 / sq, -2); g.quadraticCurveTo(0, 4, -22 / sq, -2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.5)'; circ(g, -8, -22 * sq, 4); g.fillStyle = '#1b1b2a'; circ(g, 4, -15 * sq, 2.5); circ(g, 12, -15 * sq, 2.5);
}
function bat(g, L, o) {
  const fl = Math.sin(o.t * 18 + o.ph), y = -34 + Math.sin(o.t * 5 + o.ph) * 4, body = o.hit > 0.55 ? '#fff' : L.body;
  g.translate(Math.sin(o.atk * Math.PI) * 12, 0); g.fillStyle = shade(L.body, 0.7);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, y); g.lineTo(s * 30, y - 12 * fl - 6); g.lineTo(s * 24, y + 6); g.lineTo(s * 14, y + 2); g.fill(); }
  g.fillStyle = body; circ(g, 0, y, 11); g.beginPath(); g.moveTo(-8, y - 8); g.lineTo(-6, y - 18); g.lineTo(-1, y - 9); g.moveTo(8, y - 8); g.lineTo(6, y - 18); g.lineTo(1, y - 9); g.fill();
  g.fillStyle = '#ff5a5a'; circ(g, 2, y - 1, 2); circ(g, 8, y - 1, 2);
}
function dragon(g, L, o) {
  const body = o.hit > 0.55 ? '#fff' : L.body, fl = Math.sin(o.t * 4 + o.ph), lu = Math.sin(o.atk * Math.PI);
  g.fillStyle = shade(L.body, 1.5); g.beginPath(); g.moveTo(-8, -32); g.lineTo(-34, -66 - fl * 8); g.lineTo(-4, -56); g.lineTo(-18, -74 - fl * 8); g.lineTo(10, -40); g.fill();
  g.fillStyle = body; g.beginPath(); g.moveTo(-22, -18); g.quadraticCurveTo(-46, -14, -52, -30); g.quadraticCurveTo(-40, -22, -22, -28); g.fill();
  g.beginPath(); g.ellipse(-2, -22, 26, 17, 0, 0, TAU); g.fill();
  g.fillStyle = shade(L.body, 1.9); g.beginPath(); g.ellipse(2, -14, 18, 8, 0, 0, Math.PI); g.fill();
  g.fillStyle = body; g.fillRect(-16, -8, 9, 8); g.fillRect(6, -8, 9, 8);
  g.save(); g.translate(lu * 12, lu * 4);
  g.beginPath(); g.moveTo(10, -30); g.quadraticCurveTo(22, -52, 30, -54); g.lineTo(38, -44); g.quadraticCurveTo(26, -38, 22, -22); g.fill();
  g.beginPath(); g.ellipse(36, -52, 14, 9, 0.15, 0, TAU); g.fill();
  g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(26, -58); g.lineTo(18, -72); g.lineTo(32, -60); g.fill();
  g.fillStyle = '#ffd23f'; circ(g, 39, -55, 2.6); g.fillStyle = '#000'; g.fillRect(38.4, -57, 1.4, 4);
  if (lu > 0.3 || o.cast > 0.3) { g.fillStyle = '#a04bff'; g.globalAlpha *= 0.8; g.beginPath(); g.moveTo(49, -50); g.lineTo(80 + o.cast * 30, -60); g.lineTo(80 + o.cast * 30, -36); g.fill(); }
  g.restore();
}
export function drawUnit(g, id, o) {
  const L = UNITS[id].look;
  (L.kind === 'slime' ? slime : L.kind === 'bat' ? bat : L.kind === 'dragon' ? dragon : chibi)(g, L, o);
}
const PCACHE = {};
export function portrait(id) {
  if (PCACHE[id]) return PCACHE[id];
  const c = document.createElement('canvas'), L = UNITS[id].look; c.width = c.height = 96;
  const g = c.getContext('2d'), k = L.kind === 'dragon' ? 0.95 : L.kind ? 1.5 : 1.35;
  g.translate(L.kind === 'dragon' ? 44 : 44, L.kind === 'dragon' ? 88 : L.kind ? 84 : 100); g.scale(k, k);
  drawUnit(g, id, { t: 0.5, ph: 0, moving: false, atk: 0, hit: 0, cast: 0 });
  return PCACHE[id] = c.toDataURL();
}

const NUM = { hit: '#ffffff', skill: '#ffd27a', crit: '#ffe14a', heal: '#7dffb0', burn: '#ff8a3a', poison: '#b6ff5a', miss: '#aab3d6' };
export class Arena {
  constructor(cv) { this.cv = cv; this.g = cv.getContext('2d'); this.fx = []; this.nums = []; this.parts = []; this.shake = 0; this.t = 0; this.ribbon = null; this.resize(); }
  resize() { const d = Math.min(window.devicePixelRatio || 1, 2), w = this.cv.clientWidth || 360; this.cv.width = Math.round(w * d); this.cv.height = Math.round(w * H / W * d); this.k = this.cv.width / W; }
  reset() { this.fx.length = this.nums.length = this.parts.length = 0; this.ribbon = null; this.shake = 0; }
  take(evs) {
    for (const e of evs) {
      if (e.t === 'num') { const big = e.kind === 'crit'; this.nums.push({ x: e.u.x + (Math.random() - 0.5) * 26, y: laneY(e.u.y) - 100 * (UNITS[e.u.id].look.size || 1), s: e.s + (big ? '!' : ''), c: NUM[e.kind] || '#fff', t: 0, sz: big ? 38 : e.kind === 'burn' || e.kind === 'poison' ? 22 : e.kind === 'heal' ? 30 : 28 }); }
      else if (e.t === 'cast') { this.ribbon = { s: `${UNITS[e.u.id].name} — ${e.name}`, team: e.u.team, t: 0 }; this.fx.push({ t: 'ring', x: e.u.x, y: laneY(e.u.y), c: e.u.team ? '#ff8f8f' : '#8fc7ff', a: 0 }); }
      else if (e.t === 'proj') this.fx.push({ t: 'proj', ax: e.a.x, ay: laneY(e.a.y) - 45, bx: e.b.x, by: laneY(e.b.y) - 45, c: e.c, big: e.big, a: 0 });
      else if (e.t === 'shake') this.shake = Math.max(this.shake, e.v);
      else if (e.t === 'die') { for (let i = 0; i < 16; i++) this.parts.push({ x: e.u.x, y: laneY(e.u.y) - 40, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 220, t: 0, c: '#dfe6ff' }); }
      else this.fx.push({ ...e, a: 0 });
    }
  }
  bg(theme) {
    const g = this.g;
    g.save(); g.scale(1, GY / 300);
    const sky = [['#16222e', '#35584a'], ['#0d1533', '#3d5f92'], ['#14080e', '#6a1e1a'], ['#0a0b16', '#12142a']][theme];
    const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, 300);
    if (theme === 0) { g.fillStyle = '#1e3a30'; for (let i = 0; i < 14; i++) { const x = i * 80 - 20 + (i * 37 % 30), h = 90 + (i * 53 % 70); g.beginPath(); g.moveTo(x, 300); g.lineTo(x + 38, 300 - h); g.lineTo(x + 76, 300); g.fill(); } }
    else if (theme === 1) { g.fillStyle = '#22335c'; for (let i = 0; i < 7; i++) { const x = i * 150 + 20, h = 110 + (i * 71 % 80); g.fillRect(x, 300 - h, 70, h); g.beginPath(); g.moveTo(x - 8, 300 - h); g.lineTo(x + 35, 300 - h - 50); g.lineTo(x + 78, 300 - h); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) g.fillRect((i * 137 + this.t * 20 * (1 + i % 3)) % W, (i * 71 + this.t * 40 * (1 + i % 2)) % 300, 2, 2); }
    else if (theme === 2) { g.fillStyle = '#2a0f14'; g.beginPath(); g.moveTo(250, 300); g.lineTo(480, 70); g.lineTo(540, 70); g.lineTo(780, 300); g.fill(); g.fillStyle = '#ff6a2b'; g.globalAlpha = 0.6 + 0.3 * Math.sin(this.t * 3); g.fillRect(480, 70, 60, 8); g.globalAlpha = 1;
      g.fillStyle = '#ff9a4a'; for (let i = 0; i < 30; i++) g.fillRect((i * 173) % W, 300 - ((i * 91 + this.t * 50 * (1 + i % 3)) % 300), 2, 2); }
    else { g.strokeStyle = 'rgba(120,140,255,.14)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x += 50) { g.moveTo(x, 0); g.lineTo(x, 300); } for (let y = 0; y <= 300; y += 50) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); }
    g.restore();
    const gd = [['#2f4a35', '#1c2e22'], ['#4a6a9a', '#27395c'], ['#4a2420', '#22100f'], ['#1a1d3a', '#0e1022']][theme];
    const g2 = g.createLinearGradient(0, GY, 0, H); g2.addColorStop(0, gd[0]); g2.addColorStop(1, gd[1]); g.fillStyle = g2; g.fillRect(0, GY, W, H - GY);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, GY, W, 3);
    if (theme === 3) { g.fillStyle = 'rgba(160,180,255,.5)'; g.font = '16px ui-monospace,monospace'; g.textAlign = 'center'; for (let x = 100; x < W; x += 100) g.fillText(x, x, H - 8); g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(500, GY); g.lineTo(500, H); g.stroke(); g.setLineDash([]); }
  }
  draw(b, dt, theme, debug) {
    const g = this.g; this.t += dt; const t = this.t;
    g.setTransform(this.k, 0, 0, this.k, 0, 0);
    if (this.shake > 0.3) { g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= Math.pow(0.002, dt); }
    this.bg(theme);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const f of this.fx) if (f.t === 'aoe') { const p = Math.min(1, f.a / 0.35); g.globalAlpha = 0.35 * (1 - p); g.fillStyle = f.c; g.beginPath(); g.ellipse(f.x, 490, f.r * (0.4 + 0.6 * p), 120 * (0.4 + 0.6 * p), 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
    const us = b.units.slice().sort((a, c) => a.y - c.y);
    for (const u of us) {
      if (!u.alive && u.anim.dead >= 1) continue;
      const L = u.d.look, sz = (L.size || 1) * SZ, y = laneY(u.y), ev = b.has(u, 'evade');
      g.globalAlpha = (u.alive ? 1 : 1 - u.anim.dead) * (ev ? 0.45 : 1);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(u.x, y, 22 * sz, 6 * sz, 0, 0, TAU); g.fill();
      const stun = b.has(u, 'stun');
      g.save(); g.translate(u.x, y + (u.alive ? 0 : u.anim.dead * 8)); g.scale(u.face * sz, sz);
      drawUnit(g, u.id, { t: stun ? 0 : t, ph: u.uid * 1.7, moving: u.moving, atk: u.anim.atk, hit: u.anim.hit, cast: u.anim.cast, stun });
      g.restore();
      if (!u.alive) { g.globalAlpha = 1; continue; }
      const top = y - (L.kind === 'slime' ? 44 : L.kind === 'dragon' ? 92 : 76) * sz;
      if (u.st.some(s => s.k === 'shield')) { g.strokeStyle = 'rgba(170,220,255,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(u.x, y - 30 * sz, 26 * sz, 38 * sz, 0, 0, TAU); g.stroke(); }
      if (u.st.some(s => s.k === 'stun' && s.ice)) { g.fillStyle = 'rgba(170,230,255,.45)'; rr(g, u.x - 22 * sz, y - 62 * sz, 44 * sz, 64 * sz, 8); g.fill(); }
      g.globalAlpha = 1;
      const bw = 50 * Math.sqrt(sz) * 1.15, hpw = bw * u.hp / u.maxHp;
      g.fillStyle = 'rgba(0,0,0,.6)'; rr(g, u.x - bw / 2 - 2, top - 2, bw + 4, 13, 4); g.fill();
      g.fillStyle = u.team ? '#ff5a6a' : '#5ad18a'; g.fillRect(u.x - bw / 2, top, hpw, 9);
      let sh = 0; for (const s of u.st) if (s.k === 'shield') sh += s.v;
      if (sh > 0) { g.fillStyle = 'rgba(220,240,255,.9)'; g.fillRect(u.x - bw / 2, top, Math.min(bw, bw * sh / u.maxHp), 4); }
      if (u.d.skill) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(u.x - bw / 2, top + 11, bw, 4); g.fillStyle = u.cd <= 0 ? '#ffe14a' : '#7a86c4'; g.fillRect(u.x - bw / 2, top + 11, bw * (1 - Math.max(0, u.cd) / u.d.skill.cd), 4); }
      let ix = u.x - bw / 2 + 8; g.font = '700 20px system-ui,sans-serif';
      const pip = (c, s) => { g.fillStyle = c; g.fillText(s, ix, top - 7); ix += 19; };
      if (stun) pip('#ffe14a', '✶'); if (b.has(u, 'taunt')) pip('#ff8f8f', '!');
      if (u.st.some(s => s.k === 'dot' && s.kind === 'burn')) pip('#ff8a3a', '●'); if (u.st.some(s => s.k === 'dot' && s.kind === 'poison')) pip('#b6ff5a', '●');
      if (u.st.some(s => s.k === 'buff' && !s.bad)) pip('#7dd3ff', '▲'); if (u.st.some(s => s.k === 'buff' && s.bad)) pip('#c48aff', '▼'); if (b.has(u, 'wound')) pip('#ff5a9a', '✚');
      if (debug) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '600 17px system-ui,sans-serif'; g.fillText(`${u.d.name} ${Math.ceil(u.hp)}`, u.x, y + 24); }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.a += dt; let dur = 0.4;
      if (f.t === 'proj') { dur = 0.14; const p = Math.min(1, f.a / dur), x = f.ax + (f.bx - f.ax) * p, y = f.ay + (f.by - f.ay) * p - Math.sin(p * Math.PI) * 14;
        g.strokeStyle = f.c; g.lineWidth = f.big ? 8 : 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - (f.bx - f.ax) * 0.08, y - (f.by - f.ay) * 0.08); g.lineTo(x, y); g.stroke();
        if (f.big) { g.globalAlpha = 0.4; g.lineWidth = 2; g.beginPath(); g.moveTo(f.ax, f.ay); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1; } }
      else if (f.t === 'ring') { dur = 0.5; const p = f.a / dur; g.globalAlpha = 1 - p; g.strokeStyle = f.c; g.lineWidth = 4; g.beginPath(); g.ellipse(f.x, f.y - 45, 30 + p * 60, 50 + p * 60, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
      else if (f.t === 'meteor') { dur = 0.36; const p = f.a / dur; g.fillStyle = f.c; g.shadowColor = f.c; g.shadowBlur = 20; circ(g, f.x - 120 * (1 - p), 480 - 500 * (1 - p), 26); g.shadowBlur = 0; }
      else if (f.t === 'screen') { dur = 0.45; g.globalAlpha = 0.28 * (1 - f.a / dur); g.fillStyle = f.c; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      else if (f.t === 'slash') { dur = 0.22; const p = f.a / dur; g.strokeStyle = '#fff'; g.lineWidth = 5 * (1 - p); g.beginPath(); g.moveTo(f.x - 45, laneY(f.y) - 100); g.lineTo(f.x + 45, laneY(f.y)); g.stroke(); }
      else if (f.t === 'blink') { dur = 0.3; const p = f.a / dur; g.globalAlpha = 1 - p; g.fillStyle = '#8a7ad6'; circ(g, f.x, laneY(f.y) - 45, 40 * (1 - p)); g.globalAlpha = 1; }
      if (f.a >= dur) this.fx.splice(i, 1);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += dt; if (p.t > 0.6) { this.parts.splice(i, 1); continue; } p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = 1 - p.t / 0.6; g.fillStyle = p.c; g.fillRect(p.x, p.y, 7, 7); }
    g.globalAlpha = 1;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt; if (n.t > 0.8) { this.nums.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, (0.8 - n.t) * 4); g.font = `900 ${n.sz}px system-ui,sans-serif`; const y = n.y - n.t * 60;
      g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(n.s, n.x, y); g.fillStyle = n.c; g.fillText(n.s, n.x, y);
    }
    g.globalAlpha = 1;
    if (this.ribbon) {
      const r = this.ribbon; r.t += dt;
      if (r.t > 1.1) this.ribbon = null;
      else { const a = Math.min(1, r.t * 8, (1.1 - r.t) * 5); g.globalAlpha = a; g.fillStyle = r.team ? 'rgba(120,20,40,.85)' : 'rgba(20,50,120,.85)'; g.fillRect(0, 30, W, 66);
        g.fillStyle = '#fff'; g.font = '900 40px system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif'; g.fillText(r.s, 500 + (r.team ? 1 : -1) * (1 - a) * 60, 77); g.globalAlpha = 1; }
    }
  }
}
