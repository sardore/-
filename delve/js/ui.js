import { Game, josa, TMNAME, isGoodTm } from './game.js';
import { RACES, CLASSES, MONSTERS, KINDS, SPELLS, SHOPS, SLOTS, FLAVORS, MAXDEPTH, BIOMES, biomeOf, PERKS } from './data.js';
import { T, F, walk, isShop } from './map.js';
import { S, sprite, spriteURL, tile, FAMILY, BIG, ITEMSPR, PAL } from './gfx.js';
import * as sfx from './sfx.js';

const $ = id => document.getElementById(id), KEY = 'delve_save_v2', HALL = 'delve_hall_v1';
const cv = $('cv'), g2 = cv.getContext('2d'), mini = $('mini'), mg = mini.getContext('2d');
let G = null, cd = 48, camX = 0, camY = 0, anims = [], parts = [], motes = [], ents = new Map(), pe = { x: 0, y: 0 }, shake = 0, time = 0;
let sheet = null, look = null, lastSkill = {}, frameN = 0, zoomAdj = 0;
const FL_COL = ['#7ad0ff', '#ff6a6a', '#7ad67a', '#ffd23f', '#8a8aaa', '#ff8fd0', '#b08050', '#e8e8ff', '#c06bff', '#ff9a3a', '#d8d8e8', '#8fe0c0', '#fff4d8', '#5ad1c0', '#c04a4a', '#aab0c8', '#ffe9a0', '#999999'];
const LOGC = { y: '#ffd23f', r: '#ff6a6a', g: '#8fe08f', b: '#8fc7ff', o: '#ffb36b', v: '#d09bff', d: '#8a8fb0', '': '#e6e8f5' };
const PCOL = { warrior: '#c0392b', mage: '#3b6fd6', ranger: '#3f8f4a', priest: '#e8e8f0', rogue: '#4a4458' };

/* ---------- 저장 ---------- */
function save() { if (!G) return; try { if (G.dead) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(G.toJSON())); } catch (e) {} }
function loadSave() { try { const s = localStorage.getItem(KEY); const o = s ? JSON.parse(s) : null; return o && o.v === 2 ? o : null; } catch (e) { return null; } }
function hall() { try { return JSON.parse(localStorage.getItem(HALL)) || []; } catch (e) { return []; } }
function record() { const p = G.p, h = hall(); h.push({ n: p.name, r: RACES[p.race].name, c: CLASSES[p.cls].name, lv: p.lv, d: G.maxDepth, t: G.pturn, cause: G.won && !G.dead ? '승리' : G.cause, won: G.won }); h.sort((a, b) => (b.won - a.won) || b.d - a.d || b.lv - a.lv); try { localStorage.setItem(HALL, JSON.stringify(h.slice(0, 10))); } catch (e) {} }
function bind(g) { G = g; G.onSave = save; window.__G = G; anims = []; parts = []; ents = new Map(); look = null; snapCam(); resize(); }

/* ---------- 스프라이트 선택 ---------- */
const monSpr = (r, mask) => sprite(FAMILY[r.g] || 'hum', r.c, r.F.has('unique') ? '#ffe14a' : r.F.has('undead') ? '#8fffd0' : '#ff4040', mask);
const plSpr = mask => sprite('p_' + G.p.cls, PCOL[G.p.cls], '#fff', mask);
function itemLook(it) {
  const k = KINDS[it.k], tv = k.tv; let nm = ITEMSPR[tv]; if (typeof nm === 'object') nm = nm[k.g] || 'i_sword';
  let col = k.c; if (FLAVORS[tv]) { const i = FLAVORS[tv].indexOf(G.flav[k.id]); col = FL_COL[(i + tv.length * 3 + 18) % FL_COL.length]; } else if (tv === 'flask') col = '#ffd23f';
  if (col === '#e8e8e8') col = '#b9c0cf';
  return [nm || 'i_food', col];
}
const itemURL = it => { const [n, c] = itemLook(it); return spriteURL(n, c, '#fff'); };
const icon = (url, cls = '') => `<span class="ico ${cls}" style="background-image:url(${url})"></span>`;
const monURL = r => spriteURL(FAMILY[r.g] || 'hum', r.c, r.F.has('unique') ? '#ffe14a' : r.F.has('undead') ? '#8fffd0' : '#ff4040');

/* ---------- 그리기 ---------- */
function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv._d = d; cv._w = w; cv._h = h;
  cd = S * Math.max(2, Math.min(10, Math.round(w * d / ((w < 600 ? 15.5 : 20) * S)) + zoomAdj));
  motes = []; for (let i = 0; i < 26; i++) motes.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, s: 0.5 + Math.random(), p: Math.random() * 7 });
}
function snapCam() { if (G) { camX = pe.x = G.p.x; camY = pe.y = G.p.y; } }
function ent(id, x, y) { let e = ents.get(id); if (!e) { e = { x, y, fl: 0, lt: 9 }; ents.set(id, e); } return e; }
function burst(x, y, c, n, sp = 5) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = sp * (0.3 + Math.random()); parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 0, max: 0.25 + Math.random() * 0.35, c, s: 0.08 + Math.random() * 0.08 }); } }
function takeFx() {
  for (const e of G.fx) {
    if (e.t === 'atk') { const a = e.id === 'p' ? pe : ents.get(e.id); if (a) { a.lt = 0; a.ldx = Math.sign(e.x - Math.round(a.x)); a.ldy = Math.sign(e.y - Math.round(a.y)); } }
    else if (e.t === 'num') { anims.push({ ...e, a: 0, ox: (Math.random() - 0.5) * 0.5 }); if (e.x === G.p.x && e.y === G.p.y) { pe.fl = 0.16; if (e.big) shake = Math.max(shake, 10); } else { const m = G.monAt(e.x, e.y); const en = m && ents.get(m.id); if (en) en.fl = 0.14; if (e.s[0] !== '+') burst(e.x, e.y, '#ffffff', 3, 3); } }
    else if (e.t === 'die') { const r = MONSTERS[e.r]; anims.push({ ...e, a: 0 }); burst(e.x, e.y, r.c, 14, 6); burst(e.x, e.y, '#a01818', 6, 4); }
    else if (e.t === 'ball') { anims.push({ ...e, a: -0.12 }); shake = Math.max(shake, 5); for (let i = 0; i < 22; i++) { const a = Math.random() * 7, v = (e.r + 0.5) * (2 + Math.random() * 3); parts.push({ x: e.x + 0.5, y: e.y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: -0.12, max: 0.3 + Math.random() * 0.3, c: e.c, s: 0.1 + Math.random() * 0.12 }); } }
    else if (e.t === 'lvl') { anims.push({ ...e, a: 0 }); burst(e.x, e.y, '#ffd23f', 26, 7); }
    else anims.push({ ...e, a: 0 });
  }
  G.fx.length = 0;
  for (const n of G.sq) sfx.play(n); G.sq.length = 0;
}
function draw(dt) {
  const W = cv.width, H = cv.height; if (!G || !W) return; const m = G.map, p = G.p, t = m.t, f = m.f, c = cd;
  time += dt; takeFx();
  const bi = m.town ? 5 : biomeOf(G.depth), pal = PAL[bi];
  // 표시 위치 보간
  const lerp = (e, tx, ty) => { if (Math.abs(tx - e.x) > 2.5 || Math.abs(ty - e.y) > 2.5) { e.x = tx; e.y = ty; } else { const k = Math.min(1, dt * 22); e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; } if (e.fl > 0) e.fl -= dt; e.lt += dt; };
  lerp(pe, p.x, p.y);
  camX += (pe.x - camX) * Math.min(1, dt * 10); camY += (pe.y - camY) * Math.min(1, dt * 10);
  let sx = 0, sy = 0; if (shake > 0.3) { sx = (Math.random() - 0.5) * shake * (cv._d || 1); sy = (Math.random() - 0.5) * shake * (cv._d || 1); shake *= Math.pow(0.003, dt); }
  const ox = Math.round(W / 2 - (camX + 0.5) * c + sx), oy = Math.round(H / 2 - (camY + 0.5) * c + sy);
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.imageSmoothingEnabled = false; g2.fillStyle = pal.dark; g2.fillRect(0, 0, W, H);
  const x0 = Math.max(0, Math.floor(-ox / c)), x1 = Math.min(m.w - 1, Math.ceil((W - ox) / c)), y0 = Math.max(0, Math.floor(-oy / c)), y1 = Math.min(m.h - 1, Math.ceil((H - oy) / c));
  const lr = p.d.light + Math.sin(time * 9) * 0.06 + Math.sin(time * 23) * 0.03, af = Math.floor(time * 2.5) % 2;
  const isW = v => v === T.WALL || v === T.PERM;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * m.w + x; if (!(f[k] & F.KNOWN)) continue;
    const tt = t[k], px = ox + x * c, py = oy + y * c, v = (x * 7 + y * 13) % 4;
    if (isW(tt)) { const b = k + m.w, face = y + 1 < m.h && (f[b] & F.KNOWN) && !isW(t[b]); g2.drawImage(tile(m.town ? (face ? 'face' : 'roof') : face ? 'face' : 'top', bi, (x + y) % 2), px, py, c, c); if (tt === T.PERM && !m.town) { g2.fillStyle = 'rgba(10,10,40,.28)'; g2.fillRect(px, py, c, c); }
      const e = Math.max(2, Math.round(c * 0.09)), open = q => q >= 0 && q < t.length && (f[q] & F.KNOWN) && !isW(t[q]); g2.fillStyle = 'rgba(0,0,0,.55)';
      if (open(k - 1)) g2.fillRect(px, py, e, c); if (open(k + 1)) g2.fillRect(px + c - e, py, e, c); if (open(k - m.w)) g2.fillRect(px, py, c, e); }
    else {
      g2.drawImage(tile('floor', bi, v), px, py, c, c);
      const nm = tt === T.DOOR ? 'door' : tt === T.OPEN ? 'open' : tt === T.DOWN ? 'down' : tt === T.UP ? 'up' : tt === T.RUBBLE ? 'rubble' : tt === T.TRAP ? 'trap' : tt === T.WATER ? 'water' : tt === T.LAVA ? 'lava' : tt === T.FOUNTAIN ? 'fountain' : tt === T.ALTAR ? 'altar' : tt === T.TREE ? 'tree' : isShop(tt) ? 'shop' : null;
      if (nm) g2.drawImage(tile(nm, bi, nm === 'water' || nm === 'lava' ? (af + x + y) % 3 : nm === 'fountain' || nm === 'altar' ? af : 0), px, py, c, c);
      if (tt === T.CHEST) g2.drawImage(sprite('chest', '#7a5230'), px, py, c, c);
      if (!isW(t[k - m.w] ?? 1) || !(f[k - m.w] & F.KNOWN)) { } else { g2.fillStyle = 'rgba(0,0,0,.28)'; g2.fillRect(px, py, c, Math.round(c * 0.18)); }
    }
  }
  // 물건
  for (const o of G.items) { if (!o.seen) continue; const k = o.y * m.w + o.x; if (!(f[k] & F.KNOWN)) continue; const px = ox + o.x * c, py = oy + o.y * c; if (px < -c || py < -c || px > W || py > H) continue;
    const rare = o.it && (o.it.a || o.it.e); if (rare && G.seen[k]) { g2.fillStyle = o.it.a ? 'rgba(255,220,80,.28)' : 'rgba(120,190,255,.24)'; g2.beginPath(); g2.arc(px + c / 2, py + c / 2, c * (0.42 + 0.06 * Math.sin(time * 5)), 0, 7); g2.fill(); }
    if (o.gold) g2.drawImage(sprite('i_gold', '#ffd23f'), px, py, c, c); else { const [n, col] = itemLook(o.it); const pad = Math.round(c * 0.08); g2.drawImage(sprite(n, col, '#fff'), px + pad, py + pad, c - pad * 2, c - pad * 2); } }
  // 조명
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * m.w + x; if (!(f[k] & F.KNOWN)) continue; const px = ox + x * c, py = oy + y * c;
    if (!G.seen[k]) { g2.fillStyle = m.town ? 'rgba(6,10,6,.35)' : 'rgba(6,7,16,.52)'; g2.fillRect(px, py, c, c); continue; }
    if (m.town) continue;
    const d = Math.hypot(x - pe.x, y - pe.y), torch = Math.max(0, Math.min(1, 1.08 - d / (lr + 0.9))), L = Math.max((f[k] & F.LIT) ? 0.82 : 0.4, torch);
    if (L < 1) { g2.fillStyle = `rgba(4,4,10,${((1 - L) * 0.72).toFixed(3)})`; g2.fillRect(px, py, c, c); }
    if (torch > 0.05) { g2.fillStyle = `rgba(255,150,60,${(0.11 * torch).toFixed(3)})`; g2.fillRect(px, py, c, c); }
    if (t[k] === T.LAVA) { g2.fillStyle = 'rgba(255,120,30,.18)'; g2.fillRect(px - c * 0.3, py - c * 0.3, c * 1.6, c * 1.6); }
  }
  // 상점 간판
  if (m.town) { g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.font = `800 ${Math.round(c * 0.5)}px system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`; for (let k = 0; k < t.length; k++) if (isShop(t[k])) { const s = SHOPS[t[k] - T.SHOP], x = k % m.w, y = (k / m.w) | 0, up = t[k - m.w] === T.PERM, tx = ox + (x + 0.5) * c, ty = oy + (y + (up ? -1.5 : 2.5)) * c, w = g2.measureText(s.name).width + c * 0.5; g2.fillStyle = 'rgba(20,14,8,.85)'; g2.fillRect(tx - w / 2, ty - c * 0.36, w, c * 0.72); g2.fillStyle = s.c; g2.fillText(s.name, tx, ty); } }
  // 개체
  const live = new Set(), list = [];
  for (const mo of G.mons) { if (mo.dead || !mo.vis) continue; live.add(mo.id); const e = ent(mo.id, mo.x, mo.y); lerp(e, mo.x, mo.y); list.push([e, mo]); }
  for (const id of ents.keys()) if (!live.has(id)) ents.delete(id);
  list.push([pe, null]); list.sort((a, b) => a[0].y - b[0].y);
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  for (const [e, mo] of list) {
    const lu = e.lt < 0.14 ? Math.sin(Math.PI * e.lt / 0.14) * 0.32 : 0, ex = e.x + (e.ldx || 0) * lu, ey = e.y + (e.ldy || 0) * lu, cx = ox + (ex + 0.5) * c, cy = oy + (ey + 0.5) * c;
    const r = mo && MONSTERS[mo.r], big = r && BIG.has(r.g), sz = Math.round(c * (big ? 1.3 : 1)), bob = mo && mo.sleep > 0 ? 0 : Math.round(Math.sin(time * 5 + (mo ? mo.id : 0)) * c * 0.025);
    g2.globalAlpha = mo && !mo.direct ? 0.55 : 1;
    if (r && r.F.has('unique')) { const gr = g2.createRadialGradient(cx, cy + c * 0.2, 0, cx, cy + c * 0.2, c * 0.9); gr.addColorStop(0, 'rgba(255,210,60,.45)'); gr.addColorStop(1, 'rgba(255,210,60,0)'); g2.fillStyle = gr; g2.fillRect(cx - c, cy - c, c * 2, c * 2); }
    g2.fillStyle = 'rgba(0,0,0,.4)'; g2.beginPath(); g2.ellipse(cx, cy + c * 0.42, sz * 0.32, sz * 0.1, 0, 0, 7); g2.fill();
    const spr = mo ? monSpr(r) : plSpr(), dx = Math.round(cx - sz / 2), dy = Math.round(cy + c / 2 - sz + bob);
    if (mo && r.F.has('invis')) g2.globalAlpha *= 0.6;
    if (!mo && G.dead) g2.globalAlpha = 0.35;
    g2.drawImage(spr, dx, dy, sz, sz);
    if (e.fl > 0) { g2.globalAlpha = Math.min(1, e.fl * 8); g2.drawImage(mo ? monSpr(r, true) : plSpr(true), dx, dy, sz, sz); }
    g2.globalAlpha = 1;
    if (mo) {
      if (mo.sleep > 0) { g2.fillStyle = '#cfe0ff'; g2.font = `800 ${Math.round(c * 0.36)}px system-ui,sans-serif`; g2.fillText('z', cx + c * 0.34, cy - c * 0.36 + Math.sin(time * 3 + mo.id) * c * 0.05); g2.font = `800 ${Math.round(c * 0.26)}px system-ui,sans-serif`; g2.fillText('z', cx + c * 0.5, cy - c * 0.56 + Math.sin(time * 3 + mo.id + 1) * c * 0.05); }
      else if (mo.fear > 0) { g2.fillStyle = '#ffe14a'; g2.font = `900 ${Math.round(c * 0.4)}px system-ui,sans-serif`; g2.fillText('!', cx + c * 0.36, cy - c * 0.4); }
      if (mo.hp < mo.mhp) { const bw = c * 0.8, bh = Math.max(2, Math.round(c * 0.09)); g2.fillStyle = '#1a0606'; g2.fillRect(cx - bw / 2 - 1, cy + c * 0.5 - bh - 1, bw + 2, bh + 2); g2.fillStyle = mo.hp > mo.mhp * 0.5 ? '#6fd66f' : mo.hp > mo.mhp * 0.25 ? '#ffd23f' : '#ff5a5a'; g2.fillRect(cx - bw / 2, cy + c * 0.5 - bh, bw * Math.max(0, mo.hp / mo.mhp), bh); }
      if (p.target === mo.id) { g2.strokeStyle = '#ff5a5a'; g2.lineWidth = Math.max(2, c * 0.06); const a = c * (0.5 + 0.04 * Math.sin(time * 8)), b = c * 0.18; g2.beginPath(); for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g2.moveTo(cx + qx * a, cy + qy * (a - b)); g2.lineTo(cx + qx * a, cy + qy * a); g2.lineTo(cx + qx * (a - b), cy + qy * a); } g2.stroke(); }
    }
  }
  if (look && look.k >= 0) { const x = look.k % m.w, y = (look.k / m.w) | 0; g2.strokeStyle = '#ffd23f'; g2.lineWidth = 2; g2.setLineDash([c * 0.15, c * 0.15]); g2.lineDashOffset = -time * c; g2.strokeRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2); g2.setLineDash([]); }
  // 효과
  for (let i = anims.length - 1; i >= 0; i--) {
    const e = anims[i]; e.a += dt; let dur = 0.5;
    if (e.t === 'bolt') { const n = e.cells.length; dur = Math.min(0.3, 0.022 * n + 0.05); const q = Math.min(1, e.a / dur) * (n - 1), i0 = Math.floor(q), fr = q - i0, a = e.cells[i0] || e.cells[n - 1], b = e.cells[Math.min(n - 1, i0 + 1)] || a; if (a) { const fx = a[0] + (b[0] - a[0]) * fr, fy = a[1] + (b[1] - a[1]) * fr, X = ox + (fx + 0.5) * c, Y = oy + (fy + 0.5) * c;
        if (e.el === 'arrow') { const ang = Math.atan2(b[1] - (e.sy ?? a[1]), b[0] - (e.sx ?? a[0])); g2.strokeStyle = '#e8d8a8'; g2.lineWidth = Math.max(2, c * 0.07); g2.beginPath(); g2.moveTo(X - Math.cos(ang) * c * 0.35, Y - Math.sin(ang) * c * 0.35); g2.lineTo(X + Math.cos(ang) * c * 0.2, Y + Math.sin(ang) * c * 0.2); g2.stroke(); }
        else { g2.shadowColor = e.c; g2.shadowBlur = c * 0.6; g2.fillStyle = '#fff'; g2.beginPath(); g2.arc(X, Y, c * 0.16, 0, 7); g2.fill(); g2.fillStyle = e.c; g2.beginPath(); g2.arc(X, Y, c * 0.26, 0, 7); g2.globalAlpha = 0.6; g2.fill(); g2.globalAlpha = 1; g2.shadowBlur = 0; if (Math.random() < 0.9) parts.push({ x: fx + 0.5, y: fy + 0.5, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 0, max: 0.25, c: e.c, s: 0.1 }); } } }
    else if (e.t === 'ball') { dur = 0.36; if (e.a >= 0) { const q = e.a / dur, X = ox + (e.x + 0.5) * c, Y = oy + (e.y + 0.5) * c, R = (e.r + 0.6) * c * (0.25 + 0.75 * Math.sqrt(q)); const gr = g2.createRadialGradient(X, Y, 0, X, Y, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, e.c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g2.globalAlpha = 0.8 * (1 - q); g2.fillStyle = gr; g2.beginPath(); g2.arc(X, Y, R, 0, 7); g2.fill(); g2.strokeStyle = e.c; g2.lineWidth = c * 0.1 * (1 - q); g2.beginPath(); g2.arc(X, Y, R, 0, 7); g2.stroke(); g2.globalAlpha = 1; } }
    else if (e.t === 'die') { dur = 0.3; const r = MONSTERS[e.r], q = e.a / dur, sz = c * (BIG.has(r.g) ? 1.3 : 1) * (1 - q * 0.4); g2.globalAlpha = 1 - q; g2.drawImage(monSpr(r, true), ox + (e.x + 0.5) * c - sz / 2, oy + (e.y + 0.5) * c - sz / 2 - q * c * 0.3, sz, sz); g2.globalAlpha = 1; }
    else if (e.t === 'cast' || e.t === 'lvl' || e.t === 'dash') { dur = e.t === 'lvl' ? 0.8 : 0.35; const q = e.a / dur, X = ox + (e.x + 0.5) * c, Y = oy + (e.y + 0.5) * c; g2.globalAlpha = 1 - q; g2.strokeStyle = e.t === 'lvl' ? '#ffd23f' : e.c || '#fff'; g2.lineWidth = c * 0.08; g2.beginPath(); g2.arc(X, Y, c * (0.3 + q * (e.t === 'lvl' ? 1.6 : 0.7)), 0, 7); g2.stroke(); if (e.t === 'lvl') { g2.fillStyle = 'rgba(255,210,60,.25)'; g2.fillRect(X - c * 0.4, Y - c * 3 * (1 - q) - c, c * 0.8, c * 3); } g2.globalAlpha = 1; }
    else { dur = 0.8; const q = e.a / dur, pop = e.a < 0.1 ? 1 + (0.1 - e.a) * 6 : 1, fs = Math.round(c * (e.big ? 0.72 : 0.5) * pop); g2.globalAlpha = Math.min(1, (dur - e.a) * 3.5); g2.font = `900 ${fs}px system-ui,sans-serif`; const X = ox + (e.x + 0.5 + (e.ox || 0)) * c, Y = oy + (e.y - 0.15) * c - Math.sqrt(q) * c * 0.9; g2.lineWidth = Math.max(3, c * 0.09); g2.strokeStyle = 'rgba(0,0,0,.85)'; g2.strokeText(e.s, X, Y); g2.fillStyle = e.c; g2.fillText(e.s, X, Y); g2.globalAlpha = 1; }
    if (e.a >= dur) anims.splice(i, 1);
  }
  if (anims.length > 80) anims.splice(0, anims.length - 80);
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life += dt; if (q.life < 0) continue; if (q.life > q.max) { parts.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy = q.vy * 0.92 + 6 * dt; g2.globalAlpha = 1 - q.life / q.max; g2.fillStyle = q.c; const s = Math.max(2, Math.round(q.s * c)); g2.fillRect(Math.round(ox + q.x * c - s / 2), Math.round(oy + q.y * c - s / 2), s, s); }
  if (parts.length > 400) parts.splice(0, parts.length - 400);
  g2.globalAlpha = 1;
  // 떠다니는 먼지/눈/불씨
  if (!m.town) for (const q of motes) { const up = bi === 3 ? -1 : bi === 2 ? 1 : 0.2; q.y += up * q.s * 22 * dt * (cv._d || 1); q.x += Math.sin(time * 0.7 + q.p) * 8 * dt * (cv._d || 1); if (q.y < -4) q.y = H + 4; if (q.y > H + 4) q.y = -4; if (q.x < -4) q.x = W + 4; if (q.x > W + 4) q.x = -4; g2.globalAlpha = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(time * 2 + q.p)); g2.fillStyle = pal.mote; const s = Math.max(2, Math.round(q.s * 2.2 * (cv._d || 1))); g2.fillRect(q.x | 0, q.y | 0, s, s); }
  g2.globalAlpha = 1;
  const vg = g2.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, m.town ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.6)'); g2.fillStyle = vg; g2.fillRect(0, 0, W, H);
  const hpf = p.hp / p.d.mhp; if (hpf < 0.3 && !G.dead) { const rg = g2.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); rg.addColorStop(0, 'rgba(160,0,0,0)'); rg.addColorStop(1, `rgba(190,0,0,${(0.3 + 0.15 * Math.sin(time * 6)).toFixed(3)})`); g2.fillStyle = rg; g2.fillRect(0, 0, W, H); }
  if (frameN % 12 === 0) drawMini();
}
function drawMini() {
  const m = G.map, s = 2; if (mini.width !== m.w * s) { mini.width = m.w * s; mini.height = m.h * s; }
  mg.fillStyle = '#05050a'; mg.fillRect(0, 0, mini.width, mini.height); const pal = PAL[m.town ? 5 : biomeOf(G.depth)];
  for (let k = 0; k < m.t.length; k++) { if (!(m.f[k] & F.KNOWN)) continue; const tt = m.t[k]; mg.fillStyle = tt === T.WALL || tt === T.PERM ? pal.face[1] : tt === T.DOWN ? '#5ad1ff' : tt === T.UP ? '#8fe08f' : tt === T.DOOR || tt === T.OPEN ? '#c08a4a' : isShop(tt) ? '#ffd23f' : tt === T.WATER ? '#3a7fc0' : tt === T.LAVA ? '#ff6a2b' : tt === T.CHEST || tt === T.ALTAR || tt === T.FOUNTAIN ? '#ffe14a' : pal.top[0]; mg.fillRect((k % m.w) * s, ((k / m.w) | 0) * s, s, s); }
  for (const o of G.items) if (o.seen) { mg.fillStyle = '#ffd98a'; mg.fillRect(o.x * s, o.y * s, s, s); }
  for (const mo of G.mons) if (mo.vis && !mo.dead) { mg.fillStyle = '#ff5a5a'; mg.fillRect(mo.x * s, mo.y * s, s, s); }
  mg.fillStyle = '#fff'; mg.fillRect(G.p.x * s - 1, G.p.y * s - 1, s + 2, s + 2);
}

/* ---------- HUD ---------- */
let hudC = '', logC = '', barC = '';
const skillOf = () => { const p = G.p, ks = G.spellsKnown().filter(s => G.hasSpell(s) && p.lv >= s.lv); return ks.find(s => s.id === lastSkill[p.cls]) || ks.find(s => s.aim) || ks[0]; };
function hud() {
  const p = G.p, d = p.d, need = G.need(p.lv), prev = p.lv > 1 ? G.need(p.lv - 1) : 0, cl = CLASSES[p.cls];
  const tm = Object.keys(p.tm).filter(k => p.tm[k] > 0 && TMNAME[k]).map(k => `<i class="${isGoodTm(k) ? 'good' : 'bad'}">${TMNAME[k]}</i>`).join('');
  const hungry = p.food < 1000 ? '<i class="bad">굶주림</i>' : p.food < 2000 ? '<i class="warn">배고픔</i>' : '';
  const html = `<div class="l1">${icon(spriteURL('p_' + p.cls, PCOL[p.cls], '#fff'), 'av')}<div class="who"><b>${p.name}</b><span>Lv ${p.lv} ${RACES[p.race].name} ${cl.name}</span></div><div class="where"><b>${G.depth ? '지하 ' + G.depth + '층' : '마을'}</b><span>${G.depth ? BIOMES[biomeOf(G.depth)].name : ''}</span></div><div class="gd">$ ${p.gold}</div></div>
  <div class="bars"><div class="bar hp ${p.hp < d.mhp * 0.3 ? 'low' : ''}"><i style="width:${Math.max(0, 100 * p.hp / d.mhp)}%"></i><em>HP ${Math.max(0, p.hp)}/${d.mhp}</em></div>${d.mmp ? `<div class="bar mp ${cl.mp ? '' : 'st'}"><i style="width:${100 * p.mp / d.mmp}%"></i><em>${cl.res} ${p.mp}/${d.mmp}</em></div>` : ''}<div class="bar xp"><i style="width:${Math.min(100, 100 * (p.exp - prev) / Math.max(1, need - prev))}%"></i><em>AC ${d.ac} · 속도 ${d.speed >= 0 ? '+' : ''}${d.speed}</em></div></div>
  <div class="tm">${tm}${hungry}${G.recall ? '<i class="good">귀환 대기</i>' : ''}${G.deep ? '<i class="good">하강 대기</i>' : ''}${G.won ? '<i class="good">승리</i>' : ''}</div>`;
  if (html !== hudC) { hudC = html; $('hud').innerHTML = html; }
  const ls = G.log.slice(-5), lk = G.log.length + ':' + (ls.length ? ls[ls.length - 1].s + (ls[ls.length - 1].n || '') : '');
  if (lk !== logC) { logC = lk; $('log').innerHTML = ls.map((l, i) => `<div style="color:${LOGC[l.c] || LOGC['']};opacity:${0.45 + 0.55 * (i + 1) / ls.length}">${l.s}${l.n > 1 ? ` <small>x${l.n}</small>` : ''}</div>`).join(''); }
  const here = G.map.t[G.I(p.x, p.y)], hasItem = G.items.some(o => o.x === p.x && o.y === p.y), bow = p.eq.bow && G.ammoIdx() >= 0, flask = p.inv.some(i => KINDS[i.k].id === 'flask');
  const find = ids => { for (const id of ids) { const i = p.inv.findIndex(x => KINDS[x.k].id === id && G.known[id]); if (i >= 0) return [i, p.inv[i]]; } return null; };
  const q1 = find(['p_csw', 'p_clw', 'p_heal', 'p_star']), q2 = find(['s_phase']), q3 = find(['s_recall']), sk = skillOf();
  const ctx = here === T.DOWN ? ['>', '내려감'] : here === T.UP ? ['<', '올라감'] : here === T.FOUNTAIN ? ['~', '마시기'] : here === T.ALTAR ? ['†', '기도'] : hasItem ? [',', '줍기'] : ['·', '대기'];
  const bar = [ctx[1], bow ? 'fire' : flask ? 'throw' : '', sk && sk.id, sk && p.mp >= G.spellCost(sk), q1 && q1[0] + ':' + q1[1].n + KINDS[q1[1].k].id, q2 && q2[0] + ':' + q2[1].n, q3 && q3[0] + ':' + q3[1].n, G.dead].join('|');
  if (bar !== barC) { barC = bar;
    $('quick').innerHTML = (q1 ? `<button data-a="use" data-i="${q1[0]}" class="q heal">${icon(itemURL(q1[1]))}${KINDS[q1[1].k].name}<small>${q1[1].n}</small></button>` : '') + (q2 ? `<button data-a="use" data-i="${q2[0]}" class="q">${icon(itemURL(q2[1]))}순간이동<small>${q2[1].n}</small></button>` : '') + (q3 ? `<button data-a="use" data-i="${q3[0]}" class="q">${icon(itemURL(q3[1]))}귀환<small>${q3[1].n}</small></button>` : '');
    $('bar').innerHTML = `<button data-a="explore"><b>⌕</b>탐험</button>
    ${sk ? `<button data-a="recast" class="${p.mp >= G.spellCost(sk) ? 'sk' : 'sk off'}"><b>✦</b>${sk.name}</button>` : ''}<button data-a="spells"><b>☰</b>${cl.mp ? '주문' : '기술'}</button>
    ${bow ? '<button data-a="fire"><b>➶</b>사격</button>' : flask ? '<button data-a="throw"><b>◍</b>던지기</button>' : ''}
    <button data-a="ctx" class="${ctx[1] !== '대기' ? 'hot' : ''}"><b>${ctx[0]}</b>${ctx[1]}</button>
    <button data-a="rest"><b>z</b>휴식</button><button data-a="inv"><b>▤</b>가방</button><button data-a="more"><b>⋯</b>더보기</button>`; }
}

/* ---------- 시트 ---------- */
function openSheet(html, cls) { sheet = cls || 'x'; $('sheet').innerHTML = `<div class="sh ${cls || ''}">${html}</div>`; $('sheet').classList.add('on'); }
function closeSheet() { sheet = null; $('sheet').classList.remove('on'); $('sheet').innerHTML = ''; if (G && G.shop >= 0) G.shop = -1; }
const head = (t, extra = '') => `<div class="shh"><b>${t}</b>${extra}<button data-a="close" class="x">✕</button></div>`;
const verb = tv => ({ potion: '마시기', scroll: '읽기', wand: '겨누기', rod: '사용', food: '먹기', flask: '던지기' })[tv] || '장착';
function itemRow(it, i, mode, open) {
  const k = KINDS[it.k], desc = G.describe(it), rare = it.a ? 'art' : it.e ? 'ego' : '';
  const acts = mode === 'sell' ? `<button data-a="sell" data-i="${i}" class="pri">팔기 $${G.sellPrice(it) * (k.tv === 'ammo' ? it.n : 1)}</button>` : mode === 'store' ? `<button data-a="store" data-i="${i}" class="pri">맡기기</button>` : mode === 'home' ? `<button data-a="retrieve" data-i="${i}" class="pri">찾기</button>` : mode === 'eq' ? `<button data-a="takeoff" data-s="${i}" class="pri">벗기</button>` : `${k.tv === 'book' || k.tv === 'ammo' ? '' : `<button data-a="use" data-i="${i}" class="pri">${verb(k.tv)}</button>`}<button data-a="drop" data-i="${i}">버리기</button>`;
  return `<div class="it ${open ? 'open' : ''} ${rare}" data-a="pick" data-i="${i}" data-m="${mode}">${icon(itemURL(it))}<span class="nm">${G.name(it)}${mode === 'eq' ? `<small>${SLOTS.find(s => s[0] === i)[1]}</small>` : ''}</span>${open ? `<div class="ds">${desc.map(s => `<p>${s}</p>`).join('') || '<p>특별한 점은 없다.</p>'}<div class="acts">${acts}</div></div>` : ''}</div>`;
}
let invTab = 'inv', invOpen = -1;
function showInv() {
  const p = G.p;
  const tabs = `<div class="tabs"><button data-a="tab" data-t="inv" class="${invTab === 'inv' ? 'on' : ''}">가방 ${p.inv.length}/22</button><button data-a="tab" data-t="eq" class="${invTab === 'eq' ? 'on' : ''}">장비</button></div>`;
  const body = invTab === 'inv' ? (p.inv.map((it, i) => itemRow(it, i, 'inv', invOpen === i)).join('') || '<p class="dim">가방이 비었다.</p>') : SLOTS.map(([s, n]) => p.eq[s] ? itemRow(p.eq[s], s, 'eq', invOpen === s) : `<div class="it empty"><span class="ico"></span><span class="nm dim">${n} — 없음</span></div>`).join('');
  openSheet(head('소지품') + tabs + `<div class="list">${body}</div>`, 'inv');
}
let shopTab = 'buy';
function showShop() {
  const si = G.shop, s = SHOPS[si], p = G.p;
  if (s.guild) {
    const rows = G.bounties().map(b => `<div class="it ${b.claimed ? 'dis' : ''}">${icon(spriteURL(FAMILY[b.g] || 'hum', b.c, '#ffe14a'))}<span class="nm">${b.name}<small>${b.lv}층 수준 · ${b.claimed ? '수령 완료' : b.dead ? '처치함!' : '생존'}</small></span>${b.dead && !b.claimed ? `<button data-a="claim" data-n="${b.name}" class="pr">$${b.gold} 받기</button>` : `<span class="pr no">$${b.gold}</span>`}</div>`).join('');
    return openSheet(head(s.name, `<span class="gd">$ ${p.gold}</span>`) + `<p class="note">이름난 괴물을 쓰러뜨리면 현상금을 준다. 더 깊이 내려가면 새 수배서가 붙는다.</p><div class="list">${rows || '<p class="dim">수배서가 없다.</p>'}</div>`, 'shop');
  }
  if (s.home) {
    const tabs = `<div class="tabs"><button data-a="stab" data-t="buy" class="${shopTab === 'buy' ? 'on' : ''}">보관함 ${G.home.length}/30</button><button data-a="stab" data-t="sell" class="${shopTab === 'sell' ? 'on' : ''}">맡기기</button></div>`;
    const body = shopTab === 'buy' ? (G.home.map((it, i) => itemRow(it, i, 'home', invOpen === i)).join('') || '<p class="dim">맡긴 물건이 없다. 지금 안 쓰는 저항 장비나 물약을 쌓아 두자.</p>') : (p.inv.map((it, i) => itemRow(it, i, 'store', invOpen === i)).join('') || '<p class="dim">가방이 비었다.</p>');
    return openSheet(head(s.name) + tabs + `<div class="list">${body}</div>`, 'shop');
  }
  const st = G.shops[si], tabs = `<div class="tabs"><button data-a="stab" data-t="buy" class="${shopTab === 'buy' ? 'on' : ''}">사기</button><button data-a="stab" data-t="sell" class="${shopTab === 'sell' ? 'on' : ''}">팔기</button></div>`;
  const body = shopTab === 'buy' ? (st.map((e, i) => { const k = KINDS[e.it.k], pr = G.price(e), q = k.tv === 'ammo' ? Math.min(20, e.it.n) : 1, cost = pr * (k.tv === 'ammo' ? q : 1); const open = invOpen === 'b' + i;
    return `<div class="it ${open ? 'open' : ''} ${e.it.a ? 'art' : e.it.e ? 'ego' : ''}" data-a="bpick" data-i="${i}">${icon(itemURL(e.it))}<span class="nm">${G.name(e.it)}</span><button data-a="buy" data-i="${i}" class="pr ${p.gold < cost ? 'no' : ''}">$${cost}${q > 1 ? `<small>${q}개</small>` : ''}</button>${open ? `<div class="ds">${(() => { const kn = G.known[k.id]; G.known[k.id] = 1; const dd = G.describe(e.it); if (!kn) delete G.known[k.id]; return dd.map(x => `<p>${x}</p>`).join('') || '<p>특별한 점은 없다.</p>'; })()}</div>` : ''}</div>`; }).join('') || '<p class="dim">물건이 다 팔렸다.</p>')
    : (p.inv.map((it, i) => itemRow(it, i, 'sell', invOpen === i)).join('') || '<p class="dim">팔 것이 없다.</p>');
  openSheet(head(`${s.name}`, `<span class="gd">$ ${p.gold}</span>`) + tabs + `<div class="list">${body}</div>`, 'shop');
}
function showSpells() {
  const p = G.p, cl = CLASSES[p.cls];
  const rows = G.spellsKnown().map(s => { const has = G.hasSpell(s), ok = has && p.lv >= s.lv, cost = G.spellCost(s); return `<div class="it sp ${ok ? '' : 'dis'} ${ok && p.mp < cost ? 'poor' : ''}" ${ok ? `data-a="cast" data-id="${s.id}"` : ''}><span class="gl" style="color:${cl.mp ? '#c9a8ff' : '#ffd27a'}">✦</span><span class="nm">${s.name}<small>${!has ? '마법서 없음' : p.lv < s.lv ? `Lv ${s.lv}에 배움` : `${cl.res} ${cost}${cl.mp ? ` · 실패 ${G.spellFail(s)}%` : ''}`} · ${s.desc}</small></span></div>`; }).join('');
  openSheet(head(cl.mp ? '주문' : '기술', `<span class="gd" style="color:#8fc7ff">${cl.res} ${p.mp}/${p.d.mmp}</span>`) + `<div class="list">${rows}</div>`, 'spells');
}
function showPerks() {
  const o = G.perkOptions(); if (!o || !o.length) { G.perkPending = 0; return; }
  openSheet(`<div class="perks"><h2>레벨 ${G.p.lv} — 특성 선택</h2><p class="dim">하나를 고른다. 되돌릴 수 없다.</p>${o.map((id, i) => { const k = PERKS.find(x => x.id === id), n = G.p.perks[id] || 0; return `<button class="pkb" data-a="perk" data-i="${i}"><b>${k.name}${k.max > 1 ? ` <i>${n + 1}/${k.max}</i>` : ''}</b><span>${k.desc}</span></button>`; }).join('')}</div>`, 'perk');
}
function showChar() {
  const p = G.p, d = p.d, fl = d.fl, need = G.need(p.lv), FLN = { rFire: '화염 저항', rCold: '냉기 저항', rPois: '독 저항', freeAct: '자유 행동', seeInv: '투명 감지', regen: '재생', telepathy: '텔레파시', pConf: '혼란 면역', pBlind: '실명 면역' };
  const bow = p.eq.bow, pk = Object.keys(p.perks).map(id => { const k = PERKS.find(x => x.id === id); return `${k.name}${p.perks[id] > 1 ? ' ×' + p.perks[id] : ''}`; });
  openSheet(head(p.name) + `<div class="list char"><p>${RACES[p.race].name} ${CLASSES[p.cls].name} · 레벨 ${p.lv} · 경험치 ${Math.floor(p.exp)} / ${need}</p>
  <div class="grid4"><span>힘<b>${d.str}</b></span><span>지능<b>${d.int}</b></span><span>민첩<b>${d.dex}</b></span><span>체질<b>${d.con}</b></span></div>
  <div class="grid4"><span>방어<b>${d.ac}</b></span><span>속도<b>${d.speed >= 0 ? '+' : ''}${d.speed}</b></span><span>은밀<b>${d.stealth}</b></span><span>광원<b>${d.light}</b></span></div>
  <p>근접: ${d.blows}회 × ${d.dd}d${d.ds}${d.td + d.wtd >= 0 ? '+' : ''}${d.td + d.wtd} (명중 ${d.th + d.wth >= 0 ? '+' : ''}${d.th + d.wth}) · 치명타 ${Math.round(d.crit)}%${bow ? `<br>사격: 턴당 ${d.shots.toFixed(2)}발, 배율 x${KINDS[bow.k].mult}` : ''}</p>
  <p>저항·능력: ${Object.keys(fl).filter(k => FLN[k]).map(k => FLN[k]).join(', ') || '없음'}</p><p>특성: ${pk.join(', ') || '아직 없음 (5레벨마다 하나)'}</p>
  <p class="dim">최대 도달 ${G.maxDepth}층 · ${G.pturn}턴 · 처치 ${G.kills} · 포만감 ${Math.round(p.food / 150)}%</p></div>`, 'char');
}
function showMore() {
  openSheet(head('더보기') + `<div class="list menu"><button data-a="char">캐릭터 정보</button><button data-a="logs">기록 보기</button><button data-a="tostairs">가까운 내려가는 계단으로 이동</button><button data-a="zoom" data-d="1">지도 확대</button><button data-a="zoom" data-d="-1">지도 축소</button><button data-a="mute">소리 ${sfx.isMuted() ? '켜기' : '끄기'}</button><button data-a="help">도움말</button><button data-a="title">저장하고 처음 화면으로</button></div>`, 'more');
}
function showLogs() { openSheet(head('기록') + `<div class="list logs">${G.log.slice().reverse().map(l => `<p style="color:${LOGC[l.c] || LOGC['']}">${l.s}${l.n > 1 ? ` x${l.n}` : ''}</p>`).join('')}</div>`, 'logs'); }
function showHelp() {
  openSheet(head('도움말') + `<div class="list help"><p><b>목표</b> 마을에서 준비하고 구덩이를 내려가 ${MAXDEPTH}층의 어둠의 군주를 쓰러뜨린다. 20층의 부관을 먼저 잡아야 그 아래로 갈 수 있다. 죽으면 끝이다.</p>
  <p><b>이동</b> 옆 칸을 누르면 한 칸 이동(적이면 공격), 먼 칸을 누르면 그곳까지 이동, 화면을 밀면 그 방향으로 한 걸음. 키보드는 방향키·숫자패드·hjklyubn.</p>
  <p><b>대상</b> 괴물을 누르면 정보가 뜨고 대상으로 지정된다. 사격·주문·기술은 지정한 대상(없으면 가장 가까운 적)에게 나간다.</p>
  <p><b>기술</b> 모든 직업이 레벨에 따라 기술을 배운다. ✦ 버튼은 마지막에 쓴 기술을 다시 쓴다. 5레벨마다 특성을 하나 고른다.</p>
  <p><b>잠든 적</b>은 반드시 맞고 치명타가 된다. 도적은 여기에 3배가 붙는다. 은밀이 높을수록 덜 깨운다.</p>
  <p><b>지형</b> 8층마다 지형대가 바뀐다(광산·묘지·얼음·용암·심연). 용암은 밟으면 탄다. 샘은 마실 수 있고 제단은 한 번 기도할 수 있다. 상자는 밟으면 열린다.</p>
  <p><b>마을</b> 상점 여섯 곳, 물건을 맡기는 집, 현상금을 주는 길드가 있다.</p>
  <p><b>귀환의 두루마리</b> 던전에선 마을로, 마을에선 가장 깊이 갔던 층으로. 하나는 꼭 들고 다닐 것.</p>
  <p><b>깊은 곳</b> 속도와 원소 저항(화염·냉기·독)이 생존을 가른다. 용의 숨결은 저항 없이는 한 방이다.</p>
  <p><b>키</b> x 탐험 · a 기술 재사용 · m 기술 목록 · f 사격 · i 가방 · g 줍기/계단/샘/제단 · R 휴식 · . 대기 · Tab 대상 · c 캐릭터 · _ 계단으로</p></div>`, 'help');
}
function showLook(k) {
  const m = G.map, x = k % m.w, y = (k / m.w) | 0, mo = G.monAt(x, y), out = []; let img = '';
  if (mo && mo.vis) { out.push(...G.describeMon(mo)); img = icon(monURL(MONSTERS[mo.r]), 'lg'); if (mo.direct) G.p.target = mo.id; }
  for (const o of G.items) if (o.x === x && o.y === y && o.seen) out.push(o.gold ? `금화 ${o.gold}닢` : G.name(o.it));
  if (!out.length) { const tt = m.t[k]; out.push(tt === T.DOWN ? '내려가는 계단' : tt === T.UP ? '올라가는 계단' : tt === T.TRAP ? '함정' : tt === T.DOOR ? '닫힌 문' : tt === T.LAVA ? '용암 — 밟으면 화염 피해' : tt === T.WATER ? '얕은 물' : tt === T.FOUNTAIN ? '샘 — 올라서서 마신다' : tt === T.ALTAR ? '제단 — 올라서서 기도한다' : tt === T.CHEST ? '보물상자 — 밟으면 열린다' : isShop(tt) ? SHOPS[tt - T.SHOP].name : ''); }
  const o2 = out.filter(Boolean); look = o2.length ? { k } : null;
  $('look').innerHTML = look ? `${img}<div>${o2.map((s, i) => `<p class="${i ? '' : 'h'}">${s}</p>`).join('')}</div>` : ''; $('look').classList.toggle('on', !!look);
}
function hideLook() { look = null; $('look').classList.remove('on'); }

/* ---------- 타이틀 / 생성 / 사망 ---------- */
let pick = { race: 'human', cls: 'warrior' };
function title() {
  const sv = loadSave(), h = hall(); G = null; $('game').classList.remove('on'); closeSheet();
  $('title').innerHTML = `<div class="tw"><div class="party">${Object.keys(CLASSES).map(c => icon(spriteURL('p_' + c, PCOL[c], '#fff'), 'xl')).join('')}</div><h1>구덩이</h1><p class="sub">D E L V E</p><p class="tag">마을에서 채비하고, 마흔 층 아래 어둠의 군주에게.</p>
  ${sv ? `<button class="big pri" data-a="resume">이어하기<small>${sv.p.name} · Lv ${sv.p.lv} ${RACES[sv.p.race].name} ${CLASSES[sv.p.cls].name} · ${sv.depth ? '지하 ' + sv.depth + '층' : '마을'}</small></button>` : ''}
  <button class="big ${sv ? '' : 'pri'}" data-a="new">새 모험</button>
  ${h.length ? `<div class="hall"><b>명예의 전당</b>${h.map(e => `<p>${e.won ? '👑 ' : ''}${e.n} — Lv ${e.lv} ${e.r} ${e.c}, ${e.d}층<small>${e.cause}</small></p>`).join('')}</div>` : ''}</div>`;
  $('title').classList.add('on');
}
function creator() {
  const rc = RACES[pick.race], cl = CLASSES[pick.cls], st = s => 12 + rc[s] + cl[s];
  $('title').innerHTML = `<div class="tw cr"><h2>새 모험</h2><input id="nm" maxlength="12" placeholder="이름" value="${pick.name || ''}">
  <h4>종족</h4><div class="opts">${Object.entries(RACES).map(([k, r]) => `<button data-a="race" data-k="${k}" class="${pick.race === k ? 'on' : ''}">${r.name}</button>`).join('')}</div><p class="dim">${rc.desc} (경험치 ${rc.expf}%)</p>
  <h4>직업</h4><div class="opts c5">${Object.entries(CLASSES).map(([k, c]) => `<button data-a="cls" data-k="${k}" class="${pick.cls === k ? 'on' : ''}">${icon(spriteURL('p_' + k, PCOL[k], '#fff'), 'lg')}${c.name}</button>`).join('')}</div><p class="dim">${cl.desc}</p>
  <p class="dim">첫 기술: ${SPELLS.filter(s => (s.cls || 'mage') === pick.cls).slice(0, 3).map(s => s.name).join(', ')}</p>
  <div class="grid4"><span>힘<b>${st('str')}</b></span><span>지능<b>${st('int')}</b></span><span>민첩<b>${st('dex')}</b></span><span>체질<b>${st('con')}</b></span></div>
  <button class="big pri" data-a="begin">내려가기</button><button class="big" data-a="back">뒤로</button></div>`;
}
function startGame(g) { bind(g); $('title').classList.remove('on'); $('game').classList.add('on'); hudC = logC = barC = ''; requestAnimationFrame(() => { resize(); snapCam(); }); save(); }
function showDeath() {
  const p = G.p; record(); save();
  openSheet(`<div class="death"><div class="tomb">${icon(spriteURL('p_' + p.cls, '#777788', '#fff'), 'xl')}<span>R.I.P.</span></div><h2>${p.name}</h2><p>Lv ${p.lv} ${RACES[p.race].name} ${CLASSES[p.cls].name}</p><p class="cause">${G.depth ? '지하 ' + G.depth + '층' : '마을'}에서 ${josa(G.cause, '으로/로')} 쓰러졌다</p><p class="dim">최대 ${G.maxDepth}층 · ${G.pturn}턴 · 처치 ${G.kills}</p><button class="big pri" data-a="title2">처음으로</button><button class="big" data-a="logs2">마지막 기록 보기</button></div>`, 'dead');
}

/* ---------- 행동 ---------- */
function after() { if (!G || G.dead) return; if (G.shop >= 0 && sheet !== 'shop') { shopTab = 'buy'; invOpen = -1; showShop(); } if (G.won && !G.wonShown) { G.wonShown = 1; record(); } }
function act(fn) { if (!G || G.dead) return; hideLook(); G.auto = null; const d = G.depth; fn(); if (G.depth !== d) { ents = new Map(); snapCam(); } after(); }
const ACT = {
  explore() { act(() => { const n = G.log.length; G.start('explore'); if (!G.auto && G.log.slice(n).some(l => l.s.includes('더 탐험할'))) { const k = G.nearest(T.DOWN); if (k >= 0 && k !== G.I(G.p.x, G.p.y)) G.start('travel', k); } }); },
  rest() { act(() => G.start('rest')); }, fire() { act(() => G.fire()); },
  throw() { act(() => { const i = G.p.inv.findIndex(x => KINDS[x.k].id === 'flask'); if (i >= 0) G.use(i); }); },
  recast() { const s = skillOf(); if (s) act(() => G.cast(s.id)); }, spells() { showSpells(); },
  cast(d) { lastSkill[G.p.cls] = d.id; closeSheet(); barC = ''; act(() => G.cast(d.id)); },
  perk(d) { G.choosePerk(+d.i); closeSheet(); sfx.play('level'); },
  ctx() { act(() => { const p = G.p, here = G.map.t[G.I(p.x, p.y)]; if (here === T.DOWN || here === T.UP) G.stairs(); else if (G.hereFeature()) G.interact(); else if (G.items.some(o => o.x === p.x && o.y === p.y)) G.pickup(); else G.wait(); }); },
  inv() { invTab = 'inv'; invOpen = -1; showInv(); }, tab(d) { invTab = d.t; invOpen = -1; showInv(); },
  pick(d) { const i = d.m === 'eq' ? d.i : +d.i; invOpen = invOpen === i ? -1 : i; d.m === 'sell' || d.m === 'store' || d.m === 'home' ? showShop() : showInv(); },
  use(d) { const i = +d.i; closeSheetKeepShop(); act(() => G.use(i)); },
  drop(d) { const i = +d.i; closeSheet(); act(() => G.drop(i)); }, takeoff(d) { closeSheet(); act(() => G.takeoff(d.s)); },
  stab(d) { shopTab = d.t; invOpen = -1; showShop(); }, bpick(d) { invOpen = invOpen === 'b' + d.i ? -1 : 'b' + d.i; showShop(); },
  buy(d) { if (G.buy(G.shop, +d.i)) sfx.play('gold'); invOpen = -1; showShop(); }, sell(d) { if (G.sell(+d.i)) sfx.play('gold'); invOpen = -1; showShop(); },
  store(d) { G.store(+d.i); invOpen = -1; showShop(); }, retrieve(d) { G.retrieve(+d.i); invOpen = -1; showShop(); }, claim(d) { G.claim(d.n); showShop(); },
  more() { showMore(); }, char() { showChar(); }, logs() { showLogs(); }, help() { showHelp(); }, mute() { sfx.toggle(); showMore(); },
  tostairs() { closeSheet(); act(() => { const k = G.nearest(T.DOWN); if (k >= 0) G.start('travel', k); else G.msg('아는 내려가는 계단이 없다.'); }); },
  zoom(d) { zoomAdj = Math.max(-2, Math.min(4, zoomAdj + +d.d)); resize(); },
  close() { closeSheet(); }, title() { save(); title(); }, title2() { title(); }, logs2() { showLogs(); sheet = 'dead'; },
  resume() { const sv = loadSave(); if (sv) startGame(new Game({ load: sv })); }, new() { creator(); }, back() { title(); },
  race(d) { pick.name = $('nm').value; pick.race = d.k; creator(); }, cls(d) { pick.name = $('nm').value; pick.cls = d.k; creator(); },
  begin() { const name = ($('nm').value || '').trim() || ['아린', '도윤', '세라', '카엘', '루오', '하람'][Math.floor(Math.random() * 6)]; try { localStorage.removeItem(KEY); } catch (e) {} startGame(new Game({ name, race: pick.race, cls: pick.cls })); },
};
function closeSheetKeepShop() { sheet = null; $('sheet').classList.remove('on'); $('sheet').innerHTML = ''; if (G) G.shop = -1; }
document.addEventListener('click', e => { sfx.unlock(); const el = e.target.closest('[data-a]'); if (!el) { if (e.target === $('sheet') && sheet !== 'dead' && sheet !== 'perk') closeSheet(); return; } e.stopPropagation(); const f = ACT[el.dataset.a]; if (f) { if (el.closest('#sheet,#title')) sfx.play('ui'); f(el.dataset); } });

function cellAt(cx, cy) { const r = cv.getBoundingClientRect(), d = cv._d || 1, ox = cv.width / 2 - (camX + 0.5) * cd, oy = cv.height / 2 - (camY + 0.5) * cd, x = Math.floor(((cx - r.left) * d - ox) / cd), y = Math.floor(((cy - r.top) * d - oy) / cd); return x < 0 || y < 0 || x >= G.map.w || y >= G.map.h ? -1 : y * G.map.w + x; }
function tapCell(k) {
  if (k < 0 || !G || G.dead) return; const m = G.map, p = G.p, x = k % m.w, y = (k / m.w) | 0, dx = x - p.x, dy = y - p.y, mo = G.monAt(x, y);
  if (G.auto) { G.auto = null; return; }
  if (dx === 0 && dy === 0) return ACT.ctx();
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return act(() => G.move(dx, dy));
  if (mo && mo.vis) return showLook(k);
  if (!(m.f[k] & F.KNOWN)) return;
  if (!walk(m.t[k]) && m.t[k] !== T.DOOR) return showLook(k);
  const hasInfo = G.items.some(o => o.x === x && o.y === y && o.seen) || m.t[k] >= T.WATER;
  act(() => G.start('travel', k)); if (hasInfo) showLook(k);
}
let ps = null;
cv.addEventListener('pointerdown', e => { sfx.unlock(); ps = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
cv.addEventListener('pointerup', e => {
  if (!ps || ps.id !== e.pointerId || !G) return; const dx = e.clientX - ps.x, dy = e.clientY - ps.y, dist = Math.hypot(dx, dy), long = performance.now() - ps.t > 450; const s = ps; ps = null;
  if (dist > 28) { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(a + 8) % 8]; return act(() => G.move(D[0], D[1])); }
  const k = cellAt(s.x, s.y); if (long) { if (k >= 0 && (G.map.f[k] & F.KNOWN)) showLook(k); } else tapCell(k);
});
cv.addEventListener('contextmenu', e => { e.preventDefault(); const k = cellAt(e.clientX, e.clientY); if (G && k >= 0 && (G.map.f[k] & F.KNOWN)) showLook(k); });
mini.addEventListener('click', () => mini.classList.toggle('big'));
const KM = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1], Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1], Home: [-1, -1], PageUp: [1, -1], End: [-1, 1], PageDown: [1, 1] };
window.addEventListener('keydown', e => {
  if (!G || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey) return; sfx.unlock();
  if (e.key === 'Escape') { if (sheet && sheet !== 'dead' && sheet !== 'perk') closeSheet(); hideLook(); if (G) G.auto = null; return; }
  if (sheet === 'perk') { const i = ['1', '2', '3'].indexOf(e.key); if (i >= 0) ACT.perk({ i }); return; }
  if (sheet) return;
  const mv = KM[e.code] || KM[e.key]; if (mv) { e.preventDefault(); return act(() => G.move(mv[0], mv[1])); }
  const K = { x: 'explore', z: 'explore', f: 'fire', v: 'throw', m: 'spells', i: 'inv', g: 'ctx', ',': 'ctx', '>': 'ctx', '<': 'ctx', Enter: 'ctx', R: 'rest', r: 'rest', c: 'char', '?': 'help', _: 'tostairs', a: 'recast' }[e.key];
  if (K) { e.preventDefault(); return ACT[K]({}); }
  if (e.key === '.' || e.key === '5' || e.code === 'Numpad5' || e.key === 's' || e.key === ' ') { e.preventDefault(); return act(() => G.wait()); }
  if (e.key === 'Tab') { e.preventDefault(); const vs = G.mons.filter(o => o.direct && !o.dead); if (vs.length) { const i = vs.findIndex(o => o.id === G.p.target), n = vs[(i + 1) % vs.length]; showLook(G.I(n.x, n.y)); } }
});
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); }); window.addEventListener('pagehide', save);

let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; frameN++;
  if (G && $('game').classList.contains('on')) {
    if (G.dead && !G._ds) { G._ds = 1; const g = G; setTimeout(() => { if (G === g) showDeath(); }, 900); }
    if (G.perkPending > 0 && !sheet && !G.dead) { G.auto = null; showPerks(); }
    if (G.auto && !sheet) { const d = G.depth; for (let i = 0; i < (G.auto === 'rest' ? 4 : 1) && G.auto; i++) G.continue(); if (G.depth !== d) { ents = new Map(); snapCam(); } after(); }
    if (!cv._w || cv.clientWidth !== cv._w || cv.clientHeight !== cv._h) resize();
    draw(dt); hud();
  }
  requestAnimationFrame(frame);
}
title(); requestAnimationFrame(frame);
