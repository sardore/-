// 렌더러: 32px 픽셀아트 타일 + 동적 조명(광원 맵) + 파티클 + 연출
import { T, P, DECOR, ZONES, MONSTERS, RELICS, RIDX } from './data.js';
import { W, H } from './gen.js';
import * as TL from './tiles.js';
import * as SP from './sprites.js';
import { flame } from './sprites.js';
import { mk, tint, flipH, shade } from './pix.js';
const I = (x, y) => y * W + x;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hs = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = (h ^ (h >> 13)) * 1274126177 >>> 0; return (h ^ (h >> 16)) >>> 0; };
const PROPNAME = { [P.PILLAR]: 'pillar', [P.STATUE]: 'statue', [P.SHELF]: 'shelf', [P.BRAZIER]: 'brazier', [P.BRAZIERLIT]: 'brazier', [P.ALTAR]: 'altar', [P.CHEST]: 'chest', [P.CHEST_OPEN]: 'chestopen', [P.GRAVE]: 'grave', [P.ANVIL]: 'anvil', [P.FURNACE]: 'furnace', [P.CART]: 'cart', [P.BARREL]: 'barrel', [P.PEW]: 'pew', [P.TABLE]: 'table', [P.STALAG]: 'stalag', [P.ROOT]: 'root', [P.VENT]: 'vent', [P.SPIKE]: 'spike', [P.WEB]: 'web', [P.BELL]: 'bell', [P.CANDLE]: 'candle', [P.FUNGUS]: 'fungus', [P.BONES]: 'bones', [P.LAMPPOST]: 'lamppost', [P.SIGN]: 'sign', [P.REMAINS]: 'remains', [P.TREE]: 'tree', [P.FENCE]: 'fence', [P.BED]: 'bed', [P.WELLPIT]: 'wellpit', [P.MIRROR]: 'mirror' };
const HAZC = { slam: [255, 70, 60], line: [120, 200, 255], fire: [255, 140, 40], water: [80, 160, 255], rock: [210, 120, 70], sweep: [200, 120, 255], void: [150, 90, 255], charge: [255, 60, 60], pull: [110, 160, 255], summon: [190, 90, 255], explode: [220, 230, 60] };

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.G = game; this.S = 2; this.tp = 64; this.cam = { x: 0, y: 0, init: false };
    this.ents = new Map(); this.parts = []; this.floats = []; this.fades = []; this.shake = 0; this.flash = 0; this.flashC = '255,60,50'; this.time = 0; this.dpr = 1; this.cw = 0; this.ch = 0;
    this.lc = mk(1, 1); this.lg = this.lc.getContext('2d'); this.fog = this.makeFog(); this.mini = null; this.hurtT = 0; this.zoneFlash = 0; this.sleepT = 0;
  }
  makeFog() { const c = mk(256, 256), g = c.getContext('2d'); for (let i = 0; i < 26; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 30 + Math.random() * 50; for (const [ox, oy] of [[0, 0], [-256, 0], [256, 0], [0, -256], [0, 256]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); } } return c; }
  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1), cw = this.cv.clientWidth, ch = this.cv.clientHeight; this.dpr = dpr;
    this.cv.width = Math.max(2, Math.round(cw * dpr)); this.cv.height = Math.max(2, Math.round(ch * dpr)); this.cw = this.cv.width; this.ch = this.cv.height;
    const target = clamp(cw / 58, 10.5, 19), S = Math.max(1, Math.round((this.cw / target) / 32)); this.S = S; this.tp = 32 * S; this.cols = Math.ceil(this.cw / this.tp) + 3; this.rows = Math.ceil(this.ch / this.tp) + 3;
    this.lc.width = this.cols; this.lc.height = this.rows; this.lg = this.lc.getContext('2d', { willReadFrequently: true });
  }
  /* ---------- 이벤트 → 연출 ---------- */
  ent(id) { let e = this.ents.get(id); if (!e) { e = { x: 0, y: 0, fx: 0, fy: 0, t0: -999, dur: 110, lunge: null, flash: 0, face: 1, wind: 0, init: false, hop: 0 }; this.ents.set(id, e); } return e; }
  syncPos(e, x, y) { if (!e.init) { e.x = e.fx = x; e.y = e.fy = y; e.init = true; } }
  tweenTo(e, x, y, dur = 110) { e.fx = e.cx ?? e.x; e.fy = e.cy ?? e.y; e.x = x; e.y = y; e.t0 = this.time; e.dur = dur; }
  pos(e) { const t = clamp((this.time - e.t0) / e.dur, 0, 1), k = 1 - (1 - t) * (1 - t); e.cx = lerp(e.fx, e.x, k); e.cy = lerp(e.fy, e.y, k); e.hopv = Math.sin(Math.PI * t); return [e.cx, e.cy]; }
  burst(x, y, n, c, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (o.s || 2) * (0.4 + Math.random()); this.parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * s * 0.02, vy: Math.sin(a) * s * 0.02 - (o.up || 0), life: (o.life || 600) * (0.6 + Math.random() * 0.8), t0: this.time, c: Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c, sz: o.sz || 2, g: o.g ?? 0.00004, add: o.add }); } }
  onEvents(evs) {
    const G = this.G;
    for (const e of evs) {
      switch (e.type) {
        case 'floor': this.ents.clear(); this.parts.length = 0; this.floats.length = 0; this.fades.length = 0; this.cam.init = false; this.zoneFlash = 1; break;
        case 'move': { const en = this.ent('pl'); this.syncPos(en, e.from[0], e.from[1]); this.tweenTo(en, e.to[0], e.to[1], 100); en.face = G.pl.face; break; }
        case 'lunge': { const en = this.ent('pl'); en.lunge = { dx: e.dx, dy: e.dy, t0: this.time, big: e.charged }; if (e.dx) en.face = Math.sign(e.dx); break; }
        case 'mmove': { const en = this.ent(e.id); this.syncPos(en, e.from[0], e.from[1]); this.tweenTo(en, e.to[0], e.to[1], 120); if (e.to[0] !== e.from[0]) en.face = Math.sign(e.to[0] - e.from[0]); break; }
        case 'mlunge': { const en = this.ent(e.id); en.lunge = { dx: Math.sign(e.dx), dy: Math.sign(e.dy), t0: this.time }; break; }
        case 'wind': { const en = this.ent(e.id); en.wind = this.time + 700; break; }
        case 'hit': { const en = this.ent(e.id); en.flash = this.time + 130; en.shk = this.time + 160; this.burst(e.x, e.y, e.charged ? 12 : 6, ['#ffffff', '#ffe9a0', '#ff9a50'], { s: 4, life: 300, sz: 2 }); this.floats.push({ x: e.x + 0.5, y: e.y, text: e.tag ? `${e.tag} ${e.dmg}` : `${e.dmg}`, c: e.tag ? '#ffd45a' : '#ffffff', t0: this.time, big: !!e.tag }); if (e.charged) this.shake = Math.max(this.shake, 4); break; }
        case 'knock': { const en = this.ent(e.id); this.tweenTo(en, e.x, e.y, 130); break; }
        case 'dash': { const en = this.ent(e.id); this.syncPos(en, e.from[0], e.from[1]); this.tweenTo(en, e.to[0], e.to[1], 160); break; }
        case 'blink': { const en = this.ent(e.id); this.burst(e.from[0], e.from[1], 10, ['#c8a0ff', '#ffffff'], { s: 3, life: 400 }); en.x = en.fx = e.to[0]; en.y = en.fy = e.to[1]; en.t0 = -999; this.burst(e.to[0], e.to[1], 10, ['#c8a0ff', '#ffffff'], { s: 3, life: 400 }); break; }
        case 'pulled': { const en = this.ent('pl'); this.tweenTo(en, e.x, e.y, 140); break; }
        case 'kill': { const m = e; const img = SP.monSprite(m.type, 0), en = this.ents.get(m.id); const pos = en ? [en.cx ?? en.x, en.cy ?? en.y] : [m.x, m.y]; this.fades.push({ img, x: pos[0], y: pos[1], t0: this.time, face: en?.face || 1, big: !!m.big }); this.burst(m.x, m.y, m.big ? 40 : 16, ['#e8e0d0', '#8a8478', '#ffb060'], { s: 5, life: 700, sz: 3 }); this.ents.delete(m.id); if (m.big) this.shake = 12; break; }
        case 'hurt': this.flash = 1; this.flashC = '255,50,40'; this.shake = Math.max(this.shake, 5); this.hurtT = this.time; break;
        case 'float': this.floats.push({ x: e.x + 0.5, y: e.y, text: e.text, c: e.c, t0: this.time }); break;
        case 'shake': this.shake = Math.max(this.shake, e.p || 4); break;
        case 'fx': if (e.k === 'spark') this.burst(e.x, e.y, 14, ['#ffd070', '#fff4c8'], { s: 4, up: 0.01, life: 600 }); if (e.k === 'burst') this.burst(e.x, e.y, 24, ['#ff9a3a', '#ffd070', '#fff4c8'], { s: 6, up: 0.012, life: 800, add: 1 }); if (e.k === 'splash') this.burst(e.x, e.y, 8, ['#8fc8f0', '#ffffff'], { s: 3, up: 0.01, life: 350 }); if (e.k === 'dust') this.burst(e.x, e.y, 14, ['#8a8478', '#5a554e'], { s: 4, life: 600 }); break;
        case 'boom': { const c = HAZC[e.kind] || [255, 120, 60]; for (const [x, y] of e.tiles) this.burst(x, y, 4, `rgb(${c[0]},${c[1]},${c[2]})`, { s: 4, life: 400, add: 1, sz: 3 }); break; }
        case 'spawn': this.burst(e.x, e.y, 14, ['#c890ff', '#ffffff'], { s: 3, life: 500, add: 1 }); break;
        case 'lit': this.burst(e.x, e.y, 30, ['#ff9a3a', '#ffd070', '#fff4c8'], { s: 6, up: 0.015, life: 900, add: 1 }); break;
        case 'vanish': this.burst(e.x, e.y, 22, ['#cfe8ff', '#ffffff'], { s: 3, up: 0.012, life: 900, add: 1 }); break;
        case 'bossdown': this.burst(e.x, e.y, 60, ['#ffd070', '#ffffff', '#ff9a3a'], { s: 8, up: 0.01, life: 1200, add: 1, sz: 3 }); this.flash = 0.8; this.flashC = '255,230,160'; break;
        case 'door': this.burst(e.x, e.y, 6, '#8a7a60', { s: 2, life: 300 }); break;
        case 'bump': break;
      }
    }
  }
  /* ---------- 그리기 ---------- */
  blit(img, tx, ty, ox = 0, oy = 0, o = {}) {
    const g = this.g, S = this.S, w = img.width * S, h = img.height * S, x = Math.round((tx - this.cx) * this.tp + this.cw / 2 + ox), y = Math.round((ty - this.cy) * this.tp + this.ch / 2 + oy);
    // 스프라이트는 타일 가운데 아래에 맞춘다 (큰 스프라이트는 위로 튀어나옴)
    const dx = x + Math.round((this.tp - w) / 2), dy = y + this.tp - h;
    if (o.flip) { g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); } else g.drawImage(img, dx, dy, w, h);
  }
  sx(tx) { return Math.round((tx - this.cx) * this.tp + this.cw / 2); } sy(ty) { return Math.round((ty - this.cy) * this.tp + this.ch / 2); }
  frame(ts) {
    const G = this.G, g = this.g, f = G.f; if (!f) return; const dt = Math.min(50, ts - (this.time || ts)); this.time = ts; const S = this.S, tp = this.tp, z = Math.max(0, f.zone);
    const pe = this.ent('pl'); this.syncPos(pe, G.pl.x, G.pl.y); const [ppx, ppy] = this.pos(pe);
    if (!this.cam.init) { this.cam.x = ppx; this.cam.y = ppy; this.cam.init = true; } this.cam.x += (ppx - this.cam.x) * 0.2; this.cam.y += (ppy - this.cam.y) * 0.2;
    this.shake *= 0.88; const shx = (Math.random() - 0.5) * this.shake * S, shy = (Math.random() - 0.5) * this.shake * S; this.cx = this.cam.x + 0.5 + shx / tp; this.cy = this.cam.y + 0.5 + shy / tp; this.cx -= 0.5; this.cy -= 0.5;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.fillStyle = '#000'; g.fillRect(0, 0, this.cw, this.ch);
    const x0 = Math.floor(this.cx - this.cw / 2 / tp) - 1, y0 = Math.floor(this.cy - this.ch / 2 / tp) - 1, x1 = x0 + this.cols, y1 = y0 + this.rows;
    const exp = f.explored, seen = G.seen, wf = Math.floor(ts / 260) % 4, village = f.village;
    const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || f.t[I(x, y)] === T.WALL;
    /* 1) 지형 */
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue; const k = I(x, y); if (!exp[k]) continue; const t = f.t[k], h = hs(x, y);
      let img;
      switch (t) {
        case T.WALL: img = isWall(x, y + 1) && !(f.p[I(x, Math.min(H - 1, y + 1))] === P.TORCH) ? TL.wallTop(z, h % 2) : TL.wallFace(z, h % 3); break;
        case T.GROUND: img = TL.villageGround(h % 4); break;
        case T.DOOR: case T.LOCKED: img = TL.doorTile(t === T.LOCKED ? 'locked' : 'closed'); break; case T.DOOROPEN: img = TL.doorTile('open'); break;
        case T.WATER: img = TL.waterTile(wf, false); break; case T.DEEP: img = TL.waterTile(wf, true); break; case T.LAVA: img = TL.lavaTile(wf); break;
        case T.CHASM: img = TL.chasmTile(); break; case T.BRIDGE: img = TL.bridgeTile(); break; case T.RUBBLE: img = TL.rubbleTile(z); break; case T.WELL: img = TL.wellTile(f.zone); break;
        default: img = TL.floorTile(z, h % 4);
      }
      this.blit(img, x, y); const dc = f.s[k];
      if (dc && t !== T.WALL && t !== T.WATER && t !== T.DEEP && t !== T.LAVA && t !== T.CHASM && dc < 20) this.blit(TL.decorTile(dc, z), x, y);
      if (t === T.CHASM && !(f.t[I(x, y - 1)] === T.CHASM) && y > 0) this.blit(TL.cliffTile(z), x, y);
      if (t !== T.WALL && t !== T.DOOR && t !== T.LOCKED && t !== T.DOOROPEN && isWall(x, y - 1) && f.p[I(x, Math.max(0, y - 1))] !== P.HOUSE) this.blit(TL.shadowGrad(), x, y);
      // 벽 위의 소품: 횃불/수정/광석
      const pr = f.p[k];
      if (t === T.WALL && (pr === P.TORCH || pr === P.CRYSTAL || pr === P.ORE)) { if (pr === P.TORCH) { this.blit(SP.propSprite('torch'), x, y); this.flameAt(x, y, 0.9, -7, 3.2, ts + h, [255, 180, 80]); } else this.blit(SP.propSprite(pr === P.CRYSTAL ? 'crystal' : 'ore'), x, y); }
      if (pr === P.HOUSE) { const sk = f.s[k]; this.blit(TL.houseTile(sk === 1 ? 1 : sk === 3 ? 3 : 2, sk === 20), x, y); }
    }
    /* 2) 위험 지대 */
    for (const hz of G.haz) { const c = HAZC[hz.kind] || [255, 80, 60], urg = hz.t <= 1, pulse = 0.5 + 0.5 * Math.sin(ts / (urg ? 70 : 150)); for (const [x, y] of hz.tiles) { if (!seen[I(x, y)]) continue; const px = this.sx(x), py = this.sy(y); g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(urg ? 0.28 : 0.15) + pulse * (urg ? 0.28 : 0.12)})`; g.fillRect(px, py, tp, tp); g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.55 + pulse * 0.4})`; g.lineWidth = Math.max(1, S); g.strokeRect(px + S, py + S, tp - 2 * S, tp - 2 * S); if (hz.kind === 'charge' || hz.kind === 'pull') { g.fillStyle = `rgba(255,255,255,${0.3 + pulse * 0.4})`; g.fillRect(px + tp / 2 - S, py + tp / 2 - S, 2 * S, 2 * S); } } }
    /* 3) 소품/아이템/인물 (y 정렬) */
    const draws = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue; const k = I(x, y); if (!exp[k]) continue; const pr = f.p[k], sn = seen[k]; if (!pr || f.t[k] === T.WALL) continue;
      if (pr === P.HOUSE) continue; if (pr === P.CAMP || pr === P.CAMPOUT) draws.push({ y, kind: 'camp', x, yy: y, p: pr }); else if (PROPNAME[pr]) draws.push({ y, kind: 'prop', x, yy: y, p: pr, sn });
    }
    for (const it of G.items) if (seen[I(it.x, it.y)]) draws.push({ y: it.y - 0.01, kind: 'item', it });
    for (const n of G.npcs) if (seen[I(n.x, n.y)] || village) draws.push({ y: n.y + 0.01, kind: 'npc', n });
    for (const m of G.mons) if (seen[I(m.x, m.y)]) draws.push({ y: (this.ent(m.id).cy ?? m.y) + 0.02, kind: 'mon', m });
    draws.push({ y: ppy + 0.03, kind: 'pl' }); draws.sort((a, b) => a.y - b.y);
    for (const d of draws) {
      switch (d.kind) {
        case 'prop': this.drawProp(d, ts, f); break; case 'camp': this.drawCamp(d.x, d.yy, ts, d.p === P.CAMPOUT); break;
        case 'item': this.drawItem(d.it, ts); break; case 'npc': this.drawNpc(d.n, ts, G); break; case 'mon': this.drawMon(d.m, ts); break; case 'pl': this.drawPlayer(ts, pe); break;
      }
    }
    for (const fd of this.fades) { const t = (ts - fd.t0) / 380; if (t > 1) continue; g.globalAlpha = 1 - t; this.blit(fd.big ? SP.monSprite('otol', 0) : fd.img, fd.x, fd.y - t * 0.3, 0, 0, { flip: fd.face < 0 }); g.globalAlpha = 1; } this.fades = this.fades.filter(fd => ts - fd.t0 < 380);
    /* 4) 조명 */
    this.drawLight(ts, f, z, village);
    /* 5) 파티클/글로우/텍스트 */
    this.drawParts(ts, dt, f, village); this.drawFloats(ts);
    // 비네트
    const vg = g.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.35, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = vg; g.fillRect(0, 0, this.cw, this.ch);
    if (this.flash > 0.01) { g.fillStyle = `rgba(${this.flashC},${this.flash * 0.35})`; g.fillRect(0, 0, this.cw, this.ch); this.flash *= 0.9; }
    if (G.f.darkness) { g.fillStyle = 'rgba(20,0,40,0.18)'; g.fillRect(0, 0, this.cw, this.ch); }
    this.drawMini();
  }
  flameAt(tx, ty, sc, oy, size, fr, col) { const g = this.g, S = this.S; const px = this.sx(tx) + this.tp / 2, py = this.sy(ty) + this.tp / 2 + oy * S; g.save(); g.translate(px, py); g.scale(S, S); flame(g, 0, 0, size * sc, fr / 90, col); g.restore(); }
  drawProp(d, ts, f) {
    const pr = d.p, name = PROPNAME[pr], img = SP.propSprite(name, f.zone), g = this.g, S = this.S; if (!img) return; const dim = !d.sn;
    this.blit(img, d.x, d.yy);
    if (pr === P.BRAZIERLIT) this.flameAt(d.x, d.yy, 1, -2, 5, ts + d.x * 40, [255, 170, 60]);
    else if (pr === P.BRAZIER) { /* 꺼진 화로: 불씨 한 점 */ g.fillStyle = `rgba(255,120,40,${0.4 + 0.3 * Math.sin(ts / 400 + d.x)})`; g.fillRect(this.sx(d.x) + 14 * S, this.sy(d.yy) + 14 * S, 2 * S, S); }
    else if (pr === P.FURNACE) { g.fillStyle = `rgba(255,${120 + 60 * Math.sin(ts / 200 + d.x)},40,0.9)`; g.fillRect(this.sx(d.x) + 11 * S, this.sy(d.yy) + 17 * S, 10 * S, 8 * S); }
    else if (pr === P.CANDLE) { for (const [fx, h] of [[10, 7], [16, 11], [22, 8]]) this.flameAt(d.x, d.yy, 1, (26 - h - 16) - 3 + 0, 1.5, ts + fx * 30, [255, 210, 120]); }
    else if (pr === P.WELLPIT) { g.fillStyle = `rgba(255,120,40,${0.25 + 0.15 * Math.sin(ts / 300)})`; g.fillRect(this.sx(d.x) + 8 * S, this.sy(d.yy) + 18 * S, 16 * S, 6 * S); }
    else if (pr === P.ALTAR) { const it = this.G.itemAt(d.x, d.yy); if (it && it.altar && d.sn) { const r = RELICS[RIDX[it.v]], bob = Math.sin(ts / 400 + d.x) * 2; this.blit(SP.relicIcon(r.c), d.x, d.yy, 0, (-12 + bob) * S); } }
    else if (pr === P.REMAINS) { g.fillStyle = `rgba(150,200,255,${0.2 + 0.12 * Math.sin(ts / 350)})`; g.beginPath(); g.arc(this.sx(d.x) + this.tp / 2, this.sy(d.yy) + this.tp * 0.6, this.tp * 0.38, 0, 6.28); g.fill(); }
    else if (pr === P.VENT) { const ph = (f.turn || 0) % 6; if (ph >= 2 && ph <= 3 && d.sn) { g.fillStyle = 'rgba(255,90,50,0.35)'; g.fillRect(this.sx(d.x) + 8 * S, this.sy(d.yy) + 18 * S, 16 * S, 8 * S); } }
  }
  drawCamp(x, y, ts, out) {
    const g = this.g, S = this.S, px = this.sx(x), py = this.sy(y); g.fillStyle = '#2a1c12'; g.fillRect(px + 7 * S, py + 24 * S, 18 * S, 4 * S); g.fillStyle = '#5a3a20'; g.save(); g.translate(px + 16 * S, py + 24 * S); g.rotate(0.4); g.fillRect(-9 * S, -2 * S, 18 * S, 4 * S); g.rotate(-0.8); g.fillRect(-9 * S, -2 * S, 18 * S, 4 * S); g.restore();
    g.fillStyle = '#2a1c12'; for (let i = 0; i < 6; i++) g.fillRect(px + (8 + i * 3) * S, py + 28 * S, 2 * S, S);
    if (!out) { const sc = this.G.f.village ? 1.5 : 1; this.flameAt(x, y, sc, 6, 6, ts + x * 31, [255, 160, 60]); } else { g.fillStyle = `rgba(255,100,30,${0.4 + 0.3 * Math.sin(ts / 300)})`; g.fillRect(px + 14 * S, py + 22 * S, 3 * S, 2 * S); }
  }
  drawItem(it, ts) {
    const img = SP.itemSprite(it.kind) || SP.itemSprite('ash'), bob = Math.sin(ts / 300 + it.x * 3) * 2 * this.S, g = this.g; if (it.altar) return;
    if (it.kind === 'ember') { g.fillStyle = 'rgba(255,170,60,0.28)'; g.beginPath(); g.arc(this.sx(it.x) + this.tp / 2, this.sy(it.y) + this.tp / 2 + bob, this.tp * 0.42, 0, 6.28); g.fill(); }
    this.blit(img, it.x, it.y, 0, it.kind === 'ember' || it.kind === 'note' || it.kind === 'key' ? bob : 0);
  }
  drawNpc(n, ts, G) {
    const img = SP.personSprite(n.look, Math.floor(ts / 420) % 2), g = this.g, S = this.S; const ghost = n.role === 'ghost', bob = Math.sin(ts / 500 + n.x) * (ghost ? 3 : 1) * S;
    if (ghost) g.globalAlpha = 0.65 + 0.15 * Math.sin(ts / 400); this.blit(img, n.x, n.y, 0, ghost ? bob - 4 * S : 0, { flip: n.role !== 'ghost' && G.pl.x < n.x }); g.globalAlpha = 1;
    if (n.role === 'heir') { const sel = G.meta.heirSel === n.idx; if (sel) { g.fillStyle = 'rgba(255,220,120,0.9)'; const px = this.sx(n.x) + this.tp / 2, py = this.sy(n.y) - 4 * S; g.beginPath(); g.moveTo(px, py + 6 * S); g.lineTo(px - 4 * S, py); g.lineTo(px + 4 * S, py); g.fill(); } }
    if (Math.abs(G.pl.x - n.x) + Math.abs(G.pl.y - n.y) <= 3) this.label(n.name, this.sx(n.x) + this.tp / 2, this.sy(n.y) - 8 * S, '#ffe9b0');
  }
  label(text, x, y, c = '#fff') { const g = this.g, S = this.S; g.font = `700 ${Math.max(11, 6 * S + 4)}px system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`; g.textAlign = 'center'; g.lineWidth = 3 * (this.dpr > 1 ? 1.4 : 1); g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, x, y); g.fillStyle = c; g.fillText(text, x, y); }
  drawMon(m, ts) {
    const en = this.ent(m.id), S = this.S, g = this.g, def = MONSTERS[m.type]; this.syncPos(en, m.x, m.y); if (!en.moved && (en.x !== m.x || en.y !== m.y)) { this.tweenTo(en, m.x, m.y, 100); } const [px, py] = this.pos(en);
    const fr = Math.floor((ts + m.id * 130) / (m.awake ? 260 : 700)) % 2; let img = SP.monSprite(m.type, fr); const big = SP.isBigSprite(m.type);
    let ox = 0, oy = -Math.sin(Math.PI * (en.hopv || 0)) * 3 * S;
    if (en.lunge) { const t = (ts - en.lunge.t0) / 150; if (t < 1) { const k = Math.sin(Math.PI * t) * 10 * S; ox += en.lunge.dx * k; oy += en.lunge.dy * k; } else en.lunge = null; }
    if (en.shk > ts) { ox += (Math.random() - 0.5) * 3 * S; }
    const winding = en.wind > ts || m.winding > 0; if (en.flash > ts) img = tint(img, '#ffffff', 0.85); else if (winding) img = tint(img, '#ff3a2a', 0.35 + 0.25 * Math.sin(ts / 60));
    if (!m.awake && !def.boss) g.globalAlpha = 0.85; if (def.fly) oy -= (2 + Math.sin(ts / 300 + m.id) * 2) * S;
    this.blit(img, px, py, ox, oy, { flip: (en.face || 1) < 0 }); g.globalAlpha = 1;
    const sxp = this.sx(px) + this.tp / 2, syp = this.sy(py) - (big ? 24 : 6) * S;
    if (!m.awake && !def.boss) this.label('z', sxp + 6 * S, this.sy(py) + 2 * S, '#9fc0ff'); if (winding) this.label('!', sxp, this.sy(py) - (big ? 28 : 6) * S, '#ff6a5a'); if (m.stun > 0) this.label('★', sxp, this.sy(py) - 6 * S, '#ffe060');
    if (!def.boss && m.hp < m.maxhp) { const w = 18 * S, h = 2 * S, bx = sxp - w / 2, by = this.sy(py) + 31 * S; g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(bx - 1, by - 1, w + 2, h + 2); g.fillStyle = '#d04040'; g.fillRect(bx, by, w * m.hp / m.maxhp, h); }
  }
  drawPlayer(ts, pe) {
    const G = this.G, g = this.g, S = this.S, [px, py] = [pe.cx ?? G.pl.x, pe.cy ?? G.pl.y]; const fr = Math.floor(ts / 380) % 2; let img = SP.personSprite('player', fr), ox = 0, oy = -Math.sin(Math.PI * (pe.hopv || 0)) * 3 * S;
    if (pe.lunge) { const t = (ts - pe.lunge.t0) / 140; if (t < 1) { const k = Math.sin(Math.PI * t) * (pe.lunge.big ? 14 : 9) * S; ox += pe.lunge.dx * k; oy += pe.lunge.dy * k; } else pe.lunge = null; }
    if (G.run && G.isCharged() && G.mode === 'play') { const [dx, dy] = G.pl.lastDir || [0, 0]; for (let i = 1; i <= 3; i++) { g.globalAlpha = 0.28 / i; this.blit(tint(img, '#ffd070', 0.8), px - dx * i * 0.28, py - dy * i * 0.28, ox, oy, { flip: G.pl.face < 0 }); } g.globalAlpha = 1; }
    if (ts - this.hurtT < 140) img = tint(img, '#ff5a4a', 0.6);
    this.blit(img, px, py, ox, oy, { flip: G.pl.face < 0 });
    if (G.pl.stuck > 0) this.label('끈적', this.sx(px) + this.tp / 2, this.sy(py) - 4 * S, '#e8e8f0');
  }
  /* ---------- 조명 ---------- */
  drawLight(ts, f, z, village) {
    const G = this.G, g = this.g, lg = this.lg, tp = this.tp, cols = this.cols, rows = this.rows, Zc = village ? { amb: 0.5, tint: [255, 190, 130] } : ZONES[z];
    const x0 = Math.floor(this.cx - this.cw / 2 / tp) - 1, y0 = Math.floor(this.cy - this.ch / 2 / tp) - 1; const img = lg.createImageData(cols, rows), d = img.data;
    const amb = Zc.amb, tn = Zc.tint, pl = G.pl, flick = 1 + 0.045 * Math.sin(ts / 110) + 0.03 * Math.sin(ts / 53) + 0.02 * Math.sin(ts / 29);
    const lights = f.lights || []; const near = lights.filter(l => l.x > x0 - 8 && l.x < x0 + cols + 8 && l.y > y0 - 8 && l.y < y0 + rows + 8);
    const dark = !!f.darkness;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = x0 + i, y = y0 + j, o = (j * cols + i) * 4; let r = 0, gg = 0, b = 0;
      if (x >= 0 && y >= 0 && x < W && y < H) { const k = I(x, y);
        if (f.explored[k]) {
          if (G.seen[k]) {
            let I_ = Math.min(1, G.light[k] * flick); // 위치별 약한 일렁임
            I_ = Math.min(1, I_ * (1 + 0.04 * Math.sin(ts / 170 + k * 1.7)));
            // 가까운 광원의 색 섞기
            let wr = 0, wg = 0, wb = 0, ws = 0; for (const l of near) { const dd = Math.hypot(l.x - x, l.y - y); if (dd < l.r + 1) { const w = l.i * Math.pow(Math.max(0, 1 - dd / (l.r + 1)), 1.2); wr += l.c[0] * w; wg += l.c[1] * w; wb += l.c[2] * w; ws += w; } }
            const pd = Math.hypot(pl.x - x, pl.y - y), pw = Math.max(0, 1 - pd / (G.lightR() + 1)) * 0.9; if (!village) { wr += 255 * pw; wg += 205 * pw; wb += 150 * pw; ws += pw; }
            let cr = 255, cg = 215, cb = 170; if (ws > 0.001) { cr = wr / ws; cg = wg / ws; cb = wb / ws; } if (village) { cr = 255; cg = 215; cb = 175; }
            const ar = amb * tn[0] / 255 * 0.8, ag = amb * tn[1] / 255 * 0.85, ab = amb * Math.min(255, tn[2] * 1.15) / 255 * 1.1;
            const lr = I_ * (0.35 + 0.65 * cr / 255) , lgc = I_ * (0.3 + 0.7 * cg / 255), lb = I_ * (0.25 + 0.75 * cb / 255);
            r = Math.min(1, ar + lr) * 255; gg = Math.min(1, ag + lgc) * 255; b = Math.min(1, ab + lb) * 255;
            if (dark) { r *= 0.8; gg *= 0.7; b *= 0.95; }
          } else { r = 22 + amb * 40; gg = 24 + amb * 40; b = 34 + amb * 50; }
        } } d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // 1픽셀=1타일 → 중심 보간: 타일 중심이 픽셀 중심에 오도록 반 칸 이동해서 그린다
    g.drawImage(this.lc, this.sx(x0) - 0, this.sy(y0) - 0, cols * tp, rows * tp); g.restore(); g.imageSmoothingEnabled = false;
    // 보이지 않는 탐험 영역은 한 번 더 어둡게 (가장자리 스며듦 방지는 비네트가 담당)
    // 광원 글로우 (가산)
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of near) { if (!G.seen[I(l.x, l.y)] && !(l.wallsrc !== undefined && G.seen[I(l.x, l.wallsrc)])) continue; const fl = l.fl ? 1 + 0.08 * Math.sin(ts / 120 + l.x * 3 + l.y) + 0.05 * Math.sin(ts / 47 + l.y) : 1; const px = this.sx(l.x) + tp / 2, py = this.sy(l.y) + tp / 2, rad = l.r * tp * 0.8 * fl; const gr = g.createRadialGradient(px, py, 0, px, py, rad); const a = 0.16 * l.i; gr.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${a})`); gr.addColorStop(1, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},0)`); g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    // 플레이어 등불
    if (G.run && !village) { const R = G.lightR(), px = this.sx(this.ent('pl').cx ?? pl.x) + tp / 2, py = this.sy(this.ent('pl').cy ?? pl.y) + tp / 2, rad = R * tp * 0.9 * flick, gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, 'rgba(255,190,110,0.22)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    g.restore();
    // 안개
    if ((z === 1 || z === 2 || z === 4) && !village) { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = z === 4 ? 0.1 : 0.07; const sc = 3 * this.S; for (const [sp, ox] of [[0.012, 0], [-0.008, 90]]) { const offx = (ts * sp + ox + this.cx * tp * 0.2) % (256 * sc), offy = (ts * sp * 0.4 + this.cy * tp * 0.2) % (256 * sc); for (let yy = -1; yy < this.ch / (256 * sc) + 1; yy++) for (let xx = -1; xx < this.cw / (256 * sc) + 1; xx++) g.drawImage(this.fog, xx * 256 * sc - offx, yy * 256 * sc - offy, 256 * sc, 256 * sc); } g.restore(); }
  }
  drawParts(ts, dt, f, village) {
    const g = this.g, tp = this.tp, S = this.S, G = this.G;
    // 환경 입자: 불씨 오르기
    if (Math.random() < 0.5) { const lights = (f.lights || []).filter(l => l.fl && G.seen[I(l.x, l.y)] && Math.abs(l.x - G.pl.x) < 12 && Math.abs(l.y - G.pl.y) < 9); if (lights.length) { const l = lights[(Math.random() * lights.length) | 0]; this.parts.push({ x: l.x + 0.3 + Math.random() * 0.4, y: l.y + 0.4, vx: (Math.random() - 0.5) * 0.00004, vy: -0.00014 - Math.random() * 0.0001, life: 1200 + Math.random() * 900, t0: ts, c: ['#ff9a3a', '#ffd070', '#ff6a20'][(Math.random() * 3) | 0], sz: 1.5, g: 0, add: 1, amb: 1 }); } }
    if (Math.random() < 0.12 && !village) this.parts.push({ x: G.pl.x + (Math.random() - 0.5) * 9, y: G.pl.y + (Math.random() - 0.5) * 7, vx: 0.00002, vy: 0.00001, life: 2500, t0: ts, c: 'rgba(255,230,180,0.7)', sz: 1, g: 0, amb: 1, add: 1 });
    if (G.f.zone === 4 && Math.random() < 0.15) this.parts.push({ x: G.pl.x + (Math.random() - 0.5) * 12, y: G.pl.y + 4, vx: 0, vy: -0.00008, life: 3000, t0: ts, c: 'rgba(170,130,255,0.8)', sz: 1.5, g: 0, amb: 1, add: 1 });
    g.save(); const keep = [];
    for (const p of this.parts) { const age = ts - p.t0; if (age > p.life) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; const a = 1 - age / p.life; keep.push(p); g.globalAlpha = Math.min(1, a * (p.amb ? 1.4 : 1.2)); g.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; g.fillStyle = p.c; const sz = Math.max(1, Math.round(p.sz * S * (0.6 + a * 0.6))); g.fillRect(Math.round((p.x - this.cx) * tp + this.cw / 2 - tp / 2 + tp / 2), Math.round((p.y - this.cy) * tp + this.ch / 2 - tp / 2 + tp / 2) - 0, sz, sz); }
    g.restore(); this.parts = keep.length > 900 ? keep.slice(-900) : keep;
  }
  drawFloats(ts) {
    const g = this.g, S = this.S, keep = []; for (const f of this.floats) { const t = (ts - f.t0) / 800; if (t > 1) continue; keep.push(f); g.globalAlpha = 1 - t * t; g.font = `800 ${(f.big ? 9 : 7) * S + 6}px system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.9)'; const x = this.sx(f.x - 0.5) + this.tp / 2, y = this.sy(f.y) - 6 * S - t * 22 * S; g.strokeText(f.text, x, y); g.fillStyle = f.c; g.fillText(f.text, x, y); } g.globalAlpha = 1; this.floats = keep;
  }
  drawMini() {
    const el = this.mini; if (!el) return; const G = this.G, f = G.f, g = el.getContext('2d'); if (el.width !== W * 3) { el.width = W * 3; el.height = H * 3; } if ((this.mt = (this.mt || 0) + 1) % 4 !== 0) return;
    g.clearRect(0, 0, el.width, el.height); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, el.width, el.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = I(x, y); if (!f.explored[k]) continue; const t = f.t[k]; g.fillStyle = t === T.WALL ? '#3a3640' : t === T.WATER || t === T.DEEP ? '#2a5a82' : t === T.LAVA ? '#c8501a' : t === T.CHASM ? '#08060c' : t === T.WELL ? '#ffd070' : (f.p[k] === P.BRAZIERLIT || f.p[k] === P.CAMP) ? '#ff9a3a' : '#6a6458'; g.fillRect(x * 3, y * 3, 3, 3); }
    for (const m of G.mons) if (G.seen[I(m.x, m.y)]) { g.fillStyle = '#ff5050'; g.fillRect(m.x * 3, m.y * 3, 3, 3); }
    g.fillStyle = '#ffffff'; g.fillRect(G.pl.x * 3 - 1, G.pl.y * 3 - 1, 5, 5);
  }
}
