/* 소리: 효과음(WebAudio 합성) + 절차 생성 배경음악. 파일 없음.
 * 게임 쪽은 musicSet({mode,bi,phase}) 로 원하는 곡 상태만 알려 준다. */
import { pickOf, load, save } from './util.js';

let AC = null, NB = null;
let muted = load('swingby_mute', '0') === '1';
export const isMuted = () => muted;

/** 첫 입력에서 호출: 오디오 컨텍스트 생성/재개 */
export function audioUnlock() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 오디오 불가 */ }
    musicInit();
  } else if (AC.state === 'suspended') AC.resume();
}
export function toggleMute() {
  muted = !muted; save('swingby_mute', muted ? '1' : '0');
  if (MU.g) MU.g.gain.value = muted ? 0 : .65;
  if (!muted) audioUnlock();
}

/* ---------- 효과음 ---------- */
export function beep(f, d, type, vol) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), ga = AC.createGain(), t = AC.currentTime;
    o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t);
    ga.gain.setValueAtTime(vol || .11, t); ga.gain.exponentialRampToValueAtTime(.001, t + d + .08);
    o.connect(ga); ga.connect(AC.destination); o.start(t); o.stop(t + d + .1);
  } catch (e) { /* 무시 */ }
}
/** 피치가 뚝 떨어지는 묵직한 타격음 */
export function thump(f0, f1, d, vol, type) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), ga = AC.createGain(), t = AC.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
    ga.gain.setValueAtTime(vol || .3, t); ga.gain.exponentialRampToValueAtTime(.001, t + d + .05);
    o.connect(ga); ga.connect(AC.destination); o.start(t); o.stop(t + d + .08);
  } catch (e) { /* 무시 */ }
}
/** 피치가 오르내리는 경고·충전음 */
export function sweep(f0, f1, d, vol, type) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), ga = AC.createGain(), t = AC.currentTime;
    o.type = type || 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
    ga.gain.setValueAtTime(.001, t); ga.gain.linearRampToValueAtTime(vol || .1, t + d * .25); ga.gain.exponentialRampToValueAtTime(.001, t + d + .04);
    o.connect(ga); ga.connect(AC.destination); o.start(t); o.stop(t + d + .06);
    return () => { // 도중에 끊는 함수 (짧게 줄여서 딱 소리가 나지 않게)
      try { const n = AC.currentTime; ga.gain.cancelScheduledValues(n); ga.gain.setValueAtTime(Math.max(.001, ga.gain.value), n); ga.gain.linearRampToValueAtTime(.0001, n + .05); o.stop(n + .06); } catch (e) { /* 이미 끝남 */ }
    };
  } catch (e) { /* 무시 */ }
}
function noiseBuf() {
  if (!NB) { const n = AC.sampleRate; NB = AC.createBuffer(1, n, AC.sampleRate); const a = NB.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; }
  return NB;
}
/** 필터 걸린 노이즈: 폭발·바람·균열 */
export function noise(d, vol, f0, f1) {
  if (!AC) return;
  try {
    const t = AC.currentTime, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), ga = AC.createGain();
    s.buffer = noiseBuf(); s.loop = true; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1 || f0 * .15), t + d);
    ga.gain.setValueAtTime(vol, t); ga.gain.exponentialRampToValueAtTime(.001, t + d);
    s.connect(fl); fl.connect(ga); ga.connect(AC.destination); s.start(t); s.stop(t + d + .05);
  } catch (e) { /* 무시 */ }
}
export const vibe = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 무시 */ } };

/* ---------- 배경음악 ---------- */
const MU = { g: null, dry: null, send: null, next: 0, step: 0, mode: 'off', want: { mode: 'calm', bi: 0, phase: 0 } };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const CH = { Dm: { r: 38, t: [50, 57, 62, 65, 69] }, Bb: { r: 34, t: [46, 53, 58, 62, 65] }, Gm: { r: 31, t: [43, 50, 55, 58, 62] }, A: { r: 33, t: [45, 52, 57, 61, 64] }, C: { r: 36, t: [48, 55, 60, 64, 67] }, Eb: { r: 39, t: [51, 58, 63, 67, 70] }, F: { r: 41, t: [53, 57, 60, 65, 69] } };
const PROG = { calm: ['Dm', 'Bb', 'Gm', 'A'], boss: ['Dm', 'Bb', 'C', 'A'], boss2: ['Dm', 'Eb', 'Bb', 'A'], boss3: ['Dm', 'Dm', 'Eb', 'A'] };

/** mode: 'calm' | 'boss' | 'off', bi: 보스 번호(조성·템포), phase: 보스 분노 단계 */
export function musicSet(w) { MU.want = w; }

function musicInit() {
  if (!AC || MU.g) return;
  try {
    MU.g = AC.createGain(); MU.g.gain.value = muted ? 0 : .65; MU.g.connect(AC.destination);
    const dl = AC.createDelay(1); dl.delayTime.value = .36; const fb = AC.createGain(); fb.gain.value = .4;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    MU.send = AC.createGain(); MU.send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(MU.g);
    MU.dry = AC.createGain(); MU.dry.connect(MU.g);
    MU.next = AC.currentTime + .1; setInterval(musicTick, 50);
  } catch (e) { MU.g = null; }
}
function mnote(t, m, dur, type, vol, o) {
  o = o || {};
  const os = AC.createOscillator(), ga = AC.createGain(), f = AC.createBiquadFilter();
  os.type = type; os.frequency.value = mtof(m); if (o.det) os.detune.value = o.det;
  f.type = 'lowpass'; f.frequency.value = o.lp || 3000;
  ga.gain.setValueAtTime(.0001, t); ga.gain.linearRampToValueAtTime(vol, t + (o.a || .01)); ga.gain.exponentialRampToValueAtTime(.0001, t + dur);
  os.connect(f); f.connect(ga); ga.connect(MU.dry);
  if (o.send) { const sg = AC.createGain(); sg.gain.value = o.send; ga.connect(sg); sg.connect(MU.send); }
  os.start(t); os.stop(t + dur + .05);
}
function mkick(t, v) {
  const o = AC.createOscillator(), ga = AC.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
  ga.gain.setValueAtTime(v, t); ga.gain.exponentialRampToValueAtTime(.001, t + .2);
  o.connect(ga); ga.connect(MU.dry); o.start(t); o.stop(t + .22);
}
function mnoise(t, d, v, hp, bp) {
  const sr = AC.createBufferSource(), f = AC.createBiquadFilter(), ga = AC.createGain();
  sr.buffer = noiseBuf(); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = hp;
  ga.gain.setValueAtTime(v, t); ga.gain.exponentialRampToValueAtTime(.001, t + d);
  sr.connect(f); f.connect(ga); ga.connect(MU.dry); sr.start(t, Math.random() * .5); sr.stop(t + d + .02);
}
function musicTick() {
  if (!AC || !MU.g) return;
  const now = AC.currentTime, w = MU.want;
  MU.g.gain.value = muted ? 0 : .65;
  if (muted || AC.state !== 'running') { MU.next = now + .1; return; }
  if (MU.next < now - .4) MU.next = now + .05;
  while (MU.next < now + .3) {
    if (w.mode !== MU.mode) { MU.mode = w.mode; MU.step = 0; }
    const bpm = MU.mode === 'boss' ? 132 + w.phase * 10 + w.bi * 3 : 76, sd = 60 / bpm / 4;
    if (MU.mode !== 'off') musicStep(MU.next, sd, w);
    MU.step++; MU.next += sd;
  }
}
function musicStep(t, sd, w) {
  const bi = w.bi, k = MU.step % 16, bar = Math.floor(MU.step / 16);
  const prog = MU.mode === 'boss' ? (bi >= 6 ? PROG.boss3 : bi >= 4 ? PROG.boss2 : PROG.boss) : PROG.calm, ch = CH[prog[bar % 4]];
  const tp = MU.mode === 'boss' ? (bi === 2 ? 2 : bi === 3 ? -2 : bi === 4 ? 3 : 0) : 0; // 보스마다 조성을 살짝 옮긴다
  if (MU.mode === 'calm') {
    if (k === 0) {
      ch.t.slice(0, 4).forEach((m, i) => mnote(t, m + tp, sd * 17, 'triangle', .05, { a: .9, lp: 1100, send: .55, det: i * 4 - 6 }));
      mnote(t, ch.r, sd * 7, 'sine', .17, { a: .03, lp: 400 });
      if (Math.random() < .65) mnote(t + sd * 2, pickOf([74, 77, 79, 81, 84]), sd * 7, 'sine', .05, { a: .05, send: .9 });
    }
    if (k === 8) mnote(t, ch.r, sd * 7, 'sine', .14, { a: .03, lp: 400 });
    if (k % 2 === 0 && Math.random() < .8) { const idx = [0, 2, 4, 2, 1, 3, 4, 3][(k / 2) | 0]; mnote(t, ch.t[idx % ch.t.length] + 12, sd * 3, 'triangle', .045, { lp: 2600, send: .75 }); }
  } else {
    const ph = w.phase;
    if (k === 0) ch.t.slice(0, 4).forEach((m, i) => mnote(t, m + tp, sd * 17, 'sawtooth', .026, { a: .2, lp: 1000, send: .35, det: i * 7 - 10 }));
    if (k % 4 === 0) mkick(t, .34);
    if (k % 4 === 2) mnoise(t, .05, .07, 7000);
    if (k === 4 || k === 12) mnoise(t, .1, .12, 1700, true);
    if (ph > 0 && (k === 7 || k === 15)) mkick(t, .2);
    if (k % 2 === 0) mnote(t, ch.r + tp + (k === 6 || k === 14 ? 12 : 0), sd * 1.7, 'sawtooth', .11, { lp: 520 + ph * 120 });
    const ai = [0, 2, 3, 4, 3, 2, 4, 1][k % 8]; mnote(t, ch.t[ai % ch.t.length] + 12 + tp, sd * 1.4, 'square', .03, { lp: 2200, send: .45 });
    if (k === 0 && bar % 2 === 1) mnote(t, pickOf([74, 77, 79, 81, 86]) + tp, sd * 6, 'sawtooth', .04, { a: .02, lp: 2400, send: .7 });
  }
}
