/* 타이틀 전용 장면. 화면 비율에 따라 행성과 조작부를 따로 배치한다. */
import { G, V, g } from './state.js';
import { clamp, PI, TAU } from './util.js';
import { reducedMotion, shardIcon, telemetry, txt } from './gfx.js';
import { BOSSES, STAGES } from './data.js';
import { MODE, OPSREC, fmtTime } from './ops.js';
import { OPS_BOSSES } from './ops-data.js';
import { SHOP } from './shop.js';
import { SHIPS } from './ships.js';
import { drawShip } from './ship-art.js';

const planet = new Image();
planet.src = new URL('../art/ringed-world.webp', import.meta.url).href;

const PAPER = '#f4ead8';
const MENU = [{ key: 'shop', label: '상점' }, { key: 'tuto', label: '튜토리얼' }, { key: 'ops', label: '블랙쉽' }];
const LETTERS = [
  [28, [[28, 0], [5, 0], [0, 5], [0, 15], [5, 20], [23, 20], [28, 25], [28, 35], [23, 40], [0, 40]]],
  [44, [[0, 0], [7, 40], [14, 40], [22, 15], [30, 40], [37, 40], [44, 0]]],
  [11, [[0, 0], [11, 0]], [[5.5, 0], [5.5, 40]], [[0, 40], [11, 40]]],
  [29, [[0, 40], [0, 0], [3, 0], [26, 40], [29, 40], [29, 0]]],
  [30, [[30, 0], [6, 0], [0, 6], [0, 34], [6, 40], [24, 40], [30, 34], [30, 21], [16, 21]]],
  [28, [[0, 40], [0, 0], [23, 0], [28, 5], [28, 14], [23, 20], [0, 20]], [[23, 20], [28, 26], [28, 35], [23, 40], [0, 40]]],
  [30, [[0, 0], [15, 22], [30, 0]], [[15, 22], [15, 40]]]
];
const GAP = 11;
const MARK_W = LETTERS.reduce((width, [w]) => width + w, 0) + GAP * (LETTERS.length - 1) + 19;

let seed = 312;
function nextStar() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const stars = Array.from({ length: 148 }, () => [nextStar(), nextStar(), nextStar(), nextStar()]);
let hoverX = -1, hoverY = -1;
export function moveTitlePointer(x, y) { hoverX = x; hoverY = y; }

function layout() {
  const { VW, VH } = V;
  const wide = VW / VH > 1.14;
  const margin = wide ? Math.max(44, (VW - 1050) / 2) : 27;
  const area = wide ? Math.min(500, VW * .48) : Math.min(VW - margin * 2, 480);
  const x = wide ? margin : (VW - area) / 2;
  const y = wide ? VH * .27 : clamp(VH * .17, 85, 150);
  const button = { x, y: wide ? VH * .66 : VH - 154, w: wide ? 222 : area, h: 52 };
  const menu = MENU.map(({ key, label }, i) => ({ key, label, x: x + i * 102, y: button.y + 67, w: 97, h: 38 }));
  const art = wide
    ? { x: VW * .785, y: VH * .50, w: Math.min(VH * 1.72, VW * .93) }
    : { x: VW / 2 + VW * .08, y: VH * .544, w: Math.min(VW * 1.61, VH * 1.19) };
  return { wide, x, y, area, button, menu, art };
}

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export function titleMenuHit(x, y) {
  return layout().menu.find(r => inside(r, x, y))?.key || null;
}

function drawBackdrop({ wide, art }, time) {
  const { VW, VH } = V;
  g.fillStyle = '#0a0c13';
  g.fillRect(0, 0, VW, VH);
  const atmosphere = g.createRadialGradient(art.x, art.y, 0, art.x, art.y, art.w * .62);
  atmosphere.addColorStop(0, '#2b272b');
  atmosphere.addColorStop(.55, '#161822');
  atmosphere.addColorStop(1, '#0a0c1300');
  g.fillStyle = atmosphere; g.fillRect(0, 0, VW, VH);

  for (const [x, y, size, tone] of stars) {
    g.globalAlpha = .18 + tone * .45;
    g.fillStyle = tone > .8 ? '#e9ccac' : '#b0b9c8';
    const radius = size > .95 ? 2 : .6 + size * .85;
    g.fillRect(x * VW, y * VH, radius, radius);
    if (size > .977) {
      g.globalAlpha *= .6;
      g.fillRect(x * VW - 3, y * VH + .5, 8, 1);
      g.fillRect(x * VW + .5, y * VH - 3, 1, 8);
    }
  }
  g.globalAlpha = 1;

  if (planet.complete && planet.naturalWidth) {
    const h = art.w * planet.naturalHeight / planet.naturalWidth;
    g.drawImage(planet, art.x - art.w / 2, art.y - h / 2, art.w, h);
  }

  // 항로는 화면 가장자리에서 들어와 고리 위를 스쳐 지나간다.
  drawFlyby(art, time);

  const shade = g.createLinearGradient(0, 0, wide ? VW * .65 : 0, wide ? 0 : VH);
  if (wide) {
    shade.addColorStop(0, '#090b129e');
    shade.addColorStop(.55, '#090b1260');
    shade.addColorStop(1, '#090b1200');
  } else {
    shade.addColorStop(0, '#0a0c1290');
    shade.addColorStop(.27, '#0a0c1230');
    shade.addColorStop(.43, '#0a0c1200');
    shade.addColorStop(.75, '#0a0c1200');
    shade.addColorStop(1, '#0a0c12ed');
  }
  g.fillStyle = shade; g.fillRect(0, 0, VW, VH);
}

function drawFlyby(art, time) {
  const scale = art.w / 1320;
  const flight = reducedMotion() ? -.82 : -.82 + (time % 12) / 12 * TAU;
  const rx = 531, ry = 183;
  g.save();
  g.translate(art.x, art.y);
  g.scale(scale, scale);
  g.rotate(-.41);
  g.strokeStyle = '#e4c9aa59';
  g.lineWidth = 1.5;
  g.setLineDash([4, 11]);
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, PI + .58, TAU + .53); g.stroke();
  g.setLineDash([]);

  // 행성 뒤로 가려지는 구간에서는 기체와 꼬리를 숨긴다.
  if (Math.sin(flight) < -.18 || Math.abs(Math.cos(flight)) > .57) {
    g.lineWidth = 2.8;
    g.strokeStyle = '#facb8eaf';
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, flight - .19, flight - .025); g.stroke();
    g.translate(Math.cos(flight) * rx, Math.sin(flight) * ry);
    g.rotate(Math.atan2(Math.cos(flight) * ry, -Math.sin(flight) * rx));
    drawShip(g, SHIPS.base, .8, time, 1.38);
  }
  g.restore();
}

function wordmark(x, y, width) {
  const scale = width / MARK_W;
  g.save();
  g.translate(x + 6 * scale, y + 8 * scale);
  g.scale(scale, scale);
  g.transform(1, 0, -.16, 1, 7, 0);
  const face = g.createLinearGradient(0, -5, 0, 45);
  face.addColorStop(0, '#fff7e8'); face.addColorStop(1, '#e9d1ae');
  g.strokeStyle = face;
  g.lineWidth = 7.8; g.lineJoin = 'bevel'; g.lineCap = 'square';
  for (const [w, ...lines] of LETTERS) {
    g.beginPath();
    for (const [first, ...rest] of lines) {
      g.moveTo(...first);
      for (const point of rest) g.lineTo(...point);
    }
    g.stroke();
    g.translate(w + GAP, 0);
  }
  g.restore();
}

function drawControls({ button: b, menu }, accent, time) {
  const hovered = inside(b, hoverX, hoverY);
  const step = hovered && !reducedMotion() ? 2 * Math.sin(time * 7) : 0;
  const edge = 13;
  g.beginPath();
  g.moveTo(b.x, b.y); g.lineTo(b.x + b.w, b.y); g.lineTo(b.x + b.w, b.y + b.h - edge);
  g.lineTo(b.x + b.w - edge, b.y + b.h); g.lineTo(b.x, b.y + b.h); g.closePath();
  g.fillStyle = hovered ? '#fff8eb' : accent; g.fill();
  txt(MODE.ops ? '블랙쉽 출항' : '항해 시작', b.x + 19, b.y + 33, 18, '#191714', 'left', 800);
  const arrowX = b.x + b.w - 29 + step, arrowY = b.y + b.h / 2;
  g.strokeStyle = '#312921'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(arrowX - 16, arrowY); g.lineTo(arrowX, arrowY);
  g.moveTo(arrowX - 5, arrowY - 5); g.lineTo(arrowX, arrowY); g.lineTo(arrowX - 5, arrowY + 5); g.stroke();

  for (const r of menu) {
    const active = r.key === 'ops' && MODE.ops;
    const over = inside(r, hoverX, hoverY);
    if (active || over) {
      g.fillStyle = active ? accent : '#dbc4a9';
      g.fillRect(r.x + 1, r.y + 34, 71, 1);
    }
    txt(r.label, r.x + 2, r.y + 24, 14, active ? accent : over ? PAPER : '#bfc0c7', 'left', active || over ? 800 : 600);
  }
}

export function drawTitle() {
  const L = layout(), { VW, VH } = V;
  const time = reducedMotion() ? 0 : G.T;
  const accent = MODE.ops ? '#d3e0de' : '#f2ba83';
  drawBackdrop(L, time);

  const { x, y, area } = L;
  const wordHeight = area / MARK_W * 53;
  txt('스윙바이', x, y, 17, accent, 'left', 800);
  wordmark(x, y + 16, area);
  txt('행성을 휘감아, 우주 끝까지', x, y + wordHeight + 44, 15, '#d1c7bc', 'left', 500);
  drawControls(L, accent, time);

  const right = VW - x;
  const balance = telemetry(String(SHOP.shards), right, 39, 15, '#e8c28d', 'right');
  shardIcon(right - balance - 12, 34, 6);

  const best = MODE.ops ? OPSREC.best : G.best;
  const boss = MODE.ops ? OPSREC.boss : G.bestBoss;
  const total = MODE.ops ? OPS_BOSSES.length : STAGES.length;
  if (best > 0) {
    const info = '최고 기록 ' + best + (boss > 0 ? '   ·   보스 ' + Math.min(boss, total) + '/' + total : '');
    txt(info, x, L.button.y - 17, 12, '#c8beb4', 'left', 600);
    if (MODE.ops && OPSREC.time > 0) txt('최단 ' + fmtTime(OPSREC.time), x, L.button.y - 35, 11, '#c8beb4', 'left', 600);
  }
  if (G.debug && BOSSES[G.nextBi]) txt('DEBUG · ' + BOSSES[G.nextBi].n, x, 39, 12, '#e8c28d', 'left', 700);
  if (window.__BUILD) telemetry(window.__BUILD, x, VH - 14, 9, '#777981', 'left');
}
