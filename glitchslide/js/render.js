import { COLS, CH, IT } from './gen.js';
import { HUES } from './data.js';

const TAU = Math.PI * 2;
const PLACE = {
  [IT.ALTAR]: { g: '✦', c: '#c4a8ff' }, [IT.SHOP]: { g: '$', c: '#7dffb0' },
  [IT.REST]: { g: '♥', c: '#ff8fa8' }, [IT.VAULT]: { g: '◆', c: '#ffd23f' },
};
const FACE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

export class Renderer {
  constructor(cv) { this.cv = cv; this.g = cv.getContext('2d'); this.parts = []; this.texts = []; this.trail = []; this.cam = 0.5; this.shake = 0; this.time = 0; this.resize(); }
  resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight; this.d = d;
    this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d);
    this.T = Math.max(12, Math.floor(Math.min(this.W / COLS, this.H / 19)));
    this.ox = Math.round((this.W - this.T * COLS) / 2); this.cy = this.H * 0.62;
  }
  X(c) { return this.ox + (c + 0.5) * this.T; }
  Y(r) { return this.cy - (r + 0.5 - this.cam) * this.T; }

  ghost(x, y, s, col, lookX, lookY, scared) {
    const g = this.g;
    g.fillStyle = col; g.beginPath(); g.arc(x, y - s * 0.06, s * 0.4, Math.PI, 0);
    g.lineTo(x + s * 0.4, y + s * 0.4);
    for (let i = 0; i < 3; i++) { g.lineTo(x + s * 0.4 - (i + 0.5) * s * 0.2667, y + s * 0.26); g.lineTo(x + s * 0.4 - (i + 1) * s * 0.2667, y + s * 0.4); }
    g.closePath(); g.fill();
    if (scared) {
      g.fillStyle = '#fff'; g.fillRect(x - s * 0.2, y - s * 0.12, s * 0.1, s * 0.1); g.fillRect(x + s * 0.1, y - s * 0.12, s * 0.1, s * 0.1);
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, s * 0.05); g.beginPath();
      for (let i = 0; i <= 4; i++) g.lineTo(x - s * 0.22 + i * s * 0.11, y + s * 0.16 + (i % 2 ? -1 : 1) * s * 0.04);
      g.stroke(); return;
    }
    const m = Math.hypot(lookX, lookY) || 1, ex = lookX / m * s * 0.06, ey = lookY / m * s * 0.06;
    for (const o of [-0.16, 0.16]) {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + o * s, y - s * 0.08, s * 0.11, s * 0.14, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a1f5c'; g.beginPath(); g.arc(x + o * s + ex, y - s * 0.08 + ey, s * 0.06, 0, TAU); g.fill();
    }
  }

  draw(game, dt) {
    const g = this.g, T = this.T, W = this.W, H = this.H, p = game.p, w = game.w;
    this.time += dt; const t = this.time;
    for (const e of game.ev) {
      if (e.type === 'shake') this.shake = Math.max(this.shake, e.v);
      else if (e.type === 'text') this.texts.push({ x: e.x, y: e.y + 0.7, s: e.s, c: e.c, t: 0 });
      else for (let i = 0; i < e.n; i++) { const a = Math.random() * TAU, v = 2 + Math.random() * 7; this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, l: 0.3 + Math.random() * 0.5, c: e.c }); }
    }
    game.ev.length = 0;
    this.cam += (p.y + 0.5 - this.cam) * Math.min(1, dt * 9);

    g.setTransform(this.d, 0, 0, this.d, 0, 0);
    g.fillStyle = '#05050d'; g.fillRect(0, 0, W, H);
    g.save();
    if (this.shake > 0.1) { g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= Math.pow(0.001, dt); }

    const r0 = Math.floor(this.cam - (H - this.cy) / T) - 1, r1 = Math.ceil(this.cam + this.cy / T) + 1;
    const lw = Math.max(2, T * 0.09);
    // 바닥 격자 + 벽
    for (let r = r0; r <= r1; r++) {
      const hue = HUES[w.zoneOf(r) % HUES.length], y = this.Y(r) - T / 2;
      g.fillStyle = `hsl(${hue},45%,9%)`;
      for (let c = 0; c < COLS; c++) if (w.wall(c, r)) g.fillRect(this.ox + c * T, y, T + 0.5, T + 0.5);
      g.strokeStyle = `hsl(${hue},95%,64%)`; g.lineWidth = lw; g.lineCap = 'round'; g.shadowColor = `hsl(${hue},100%,60%)`; g.shadowBlur = T * 0.3;
      g.beginPath();
      for (let c = 0; c < COLS; c++) {
        if (!w.wall(c, r)) continue;
        const x = this.ox + c * T, i = lw / 2;
        if (!w.wall(c, r + 1)) { g.moveTo(x + i, y + i); g.lineTo(x + T - i, y + i); }
        if (!w.wall(c, r - 1)) { g.moveTo(x + i, y + T - i); g.lineTo(x + T - i, y + T - i); }
        if (c > 0 && !w.wall(c - 1, r)) { g.moveTo(x + i, y + i); g.lineTo(x + i, y + T - i); }
        if (c < COLS - 1 && !w.wall(c + 1, r)) { g.moveTo(x + T - i, y + i); g.lineTo(x + T - i, y + T - i); }
      }
      g.stroke(); g.shadowBlur = 0;
    }
    // 아이템
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = Math.max(0, r0); r <= r1; r++) for (let c = 1; c < COLS - 1; c++) {
      const it = w.items.get(r * 16 + c); if (!it) continue;
      const x = this.X(c), y = this.Y(r);
      if (it === IT.DOT || it === IT.GOLD) {
        const gold = it === IT.GOLD || game.gold > 0;
        g.fillStyle = gold ? '#ffd23f' : '#ffe9c9'; g.beginPath(); g.arc(x, y, T * (gold ? 0.11 : 0.085), 0, TAU); g.fill();
      } else if (it === IT.POWER) {
        const s = T * (0.24 + 0.05 * Math.sin(t * 7));
        g.shadowColor = '#7dd3ff'; g.shadowBlur = T * 0.5; g.fillStyle = '#bfeaff'; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); g.shadowBlur = 0;
      } else if (PLACE[it]) {
        const pl = PLACE[it], b = Math.sin(t * 3 + c) * T * 0.05, s = T * 0.4;
        g.strokeStyle = pl.c; g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, T * (0.55 + 0.12 * ((t * 0.9) % 1)), 0, TAU); g.stroke(); g.globalAlpha = 1;
        g.shadowColor = pl.c; g.shadowBlur = T * 0.6; g.fillStyle = pl.c;
        g.beginPath(); g.roundRect ? g.roundRect(x - s, y - s + b, s * 2, s * 2, s * 0.35) : g.rect(x - s, y - s + b, s * 2, s * 2); g.fill(); g.shadowBlur = 0;
        g.fillStyle = '#0b0b1a'; g.font = `800 ${Math.round(T * 0.52)}px system-ui,sans-serif`; g.fillText(pl.g, x, y + b + T * 0.03);
      }
    }
    // 유령
    const fr = game.fright > 0, blink = fr && game.fright < 1.6 && Math.floor(t * 8) % 2 === 0;
    for (const gh of game.ghosts) {
      const x = this.X(gh.x), y = this.Y(gh.y);
      if (y < -T || y > H + T) continue;
      let jx = 0;
      if (gh.kind === 'dash' && gh.state === 'aim' && !fr) {
        jx = (Math.random() - 0.5) * T * 0.14;
        const dx = [0, 1, 0, -1][gh.dir], dy = [-1, 0, 1, 0][gh.dir];
        let n = 0; while (!w.wall(Math.round(gh.x) + [0, 1, 0, -1][gh.dir] * (n + 1), Math.round(gh.y) + [1, 0, -1, 0][gh.dir] * (n + 1)) && n < 14) n++;
        g.strokeStyle = 'rgba(255,90,90,.75)'; g.lineWidth = T * 0.16; g.setLineDash([T * 0.2, T * 0.22]); g.lineDashOffset = -t * T * 3;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * n * T, y + dy * n * T); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ff5a5a'; g.font = `900 ${Math.round(T * 0.6)}px system-ui,sans-serif`; g.fillText('!', x, y - T * 0.75);
      }
      const col = fr ? (blink ? '#e8ecff' : '#3048ff') : gh.kind === 'dash' ? '#ff4d4d' : '#ff8fd0';
      this.ghost(x + jx, y, T, col, p.x - gh.x, gh.y - p.y, fr);
      if (gh.kind === 'dash' && !fr && gh.state === 'idle') { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `700 ${Math.round(T * 0.3)}px system-ui,sans-serif`; g.fillText('z', x + T * 0.34, y - T * 0.42 + Math.sin(t * 3) * 2); }
    }
    // 플레이어
    if (!game.dead) {
      const x = this.X(p.x), y = this.Y(p.y);
      this.trail.push(x, y, this.cam); if (this.trail.length > 30) this.trail.splice(0, 3);
      const ram = game.ramOn(), body = game.gold > 0 ? '#ffd23f' : '#ffe14a';
      for (let i = 0; i < this.trail.length; i += 3) {
        const a = i / this.trail.length;
        g.globalAlpha = a * 0.35; g.fillStyle = ram ? '#ff9d7a' : body;
        g.beginPath(); g.arc(this.trail[i], this.trail[i + 1] + (this.cam - this.trail[i + 2]) * T, T * 0.36 * a, 0, TAU); g.fill();
      }
      g.globalAlpha = p.inv > 0 && Math.floor(t * 14) % 2 ? 0.3 : 1;
      if (ram) { g.strokeStyle = '#ff9d7a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, T * 0.5, 0, TAU); g.stroke(); }
      const m = p.moving ? 0.08 + 0.32 * Math.abs(Math.sin(t * 22)) : 0.2;
      g.save(); g.translate(x, y); g.rotate(FACE[p.face]);
      g.shadowColor = body; g.shadowBlur = T * 0.5; g.fillStyle = body;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, T * 0.4, m * Math.PI, (2 - m) * Math.PI); g.closePath(); g.fill();
      g.restore(); g.shadowBlur = 0; g.globalAlpha = 1;
    } else this.trail.length = 0;
    // 파티클, 텍스트
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.t += dt; if (q.t > q.l) { this.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; g.globalAlpha = 1 - q.t / q.l; g.fillStyle = q.c;
      const s = T * 0.12; g.fillRect(this.X(q.x) - s / 2, this.Y(q.y) - s / 2, s, s);
    }
    g.font = `800 ${Math.round(T * 0.46)}px system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const q = this.texts[i]; q.t += dt; if (q.t > 1.1) { this.texts.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, (1.1 - q.t) * 2.5); g.fillStyle = q.c;
      g.fillText(q.s, Math.max(this.ox + T * 3, Math.min(this.ox + T * (COLS - 3), this.X(q.x))), this.Y(q.y + q.t * 1.2));
    }
    g.globalAlpha = 1;
    // 글리치
    const gy = this.Y(game.glitch) + T * 0.35;
    if (gy < H + T * 2) {
      const cols = ['#ff2bd6', '#22e6ff', '#ffffff', '#7a2bff'];
      g.fillStyle = '#000'; g.fillRect(0, gy, W, H - gy + T);
      for (let c = 0; c < COLS * 2; c++) {
        const h = Math.random() * T * 1.5; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = 0.5 + Math.random() * 0.5;
        g.fillRect(this.ox + c * T / 2, gy - h, T / 2, h + 2);
      }
      for (let i = 0; i < 46; i++) {
        g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = Math.random() * 0.55;
        g.fillRect(Math.random() * W, gy + Math.random() * (H - gy), 8 + Math.random() * T * 3, 2 + Math.random() * T * 0.5);
      }
      g.globalAlpha = 0.8; g.fillStyle = '#fff'; g.font = `700 ${Math.round(T * 0.4)}px ui-monospace,monospace`;
      for (let i = 0; i < 4; i++) g.fillText(['0x100', 'ERR', '256', '▓▒░', 'NaN', 'FATAL'][(Math.random() * 6) | 0], Math.random() * W, gy + T + Math.random() * Math.max(1, H - gy - T));
      g.globalAlpha = 1;
    }
    g.restore();
    const danger = 1 - Math.min(1, Math.max(0, (p.y - game.glitch - 1.5) / 5));
    if (danger > 0 && game.started && !game.dead) {
      const gr = g.createLinearGradient(0, H, 0, H * 0.45); gr.addColorStop(0, `rgba(255,30,120,${0.4 * danger})`); gr.addColorStop(1, 'rgba(255,30,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (game.fright > 0) { g.fillStyle = '#7dd3ff'; g.fillRect(0, 0, W * game.fright / 6, 4); }
    if (game.gold > 0) { g.fillStyle = '#ffd23f'; g.fillRect(0, 4, W * game.gold / 8, 4); }
  }
}
