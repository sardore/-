// 합성 효과음. 외부 파일 없음.
let AC = null, muted = false; const last = {};
try { muted = localStorage.getItem('delve_mute') === '1'; } catch (e) {}
export function unlock() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } else if (AC.state === 'suspended') AC.resume(); }
export const isMuted = () => muted;
export function toggle() { muted = !muted; try { localStorage.setItem('delve_mute', muted ? '1' : '0'); } catch (e) {} return muted; }
function tone(f, d, type = 'square', vol = 0.05, to = 0, delay = 0) {
  try { const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.04); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.06); } catch (e) {}
}
let nbuf = null;
function noise(d, vol = 0.05, freq = 1200, delay = 0) {
  try { if (!nbuf) { nbuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate); const a = nbuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime + delay; s.buffer = nbuf; f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); s.stop(t + d + 0.02); } catch (e) {}
}
const GAP = { step: 110, hit: 50, hurt: 80, zap: 60, boom: 90, kill: 60, shoot: 50, miss: 60, pick: 60, gold: 80 };
export function play(n) {
  if (!AC || muted) return; const now = performance.now(); if (now - (last[n] || 0) < (GAP[n] || 30)) return; last[n] = now;
  switch (n) {
    case 'step': noise(0.035, 0.018, 500); break; case 'hit': noise(0.06, 0.07, 1800); tone(170, 0.06, 'square', 0.04, 80); break; case 'miss': tone(320, 0.05, 'sine', 0.025, 200); break;
    case 'kill': tone(280, 0.16, 'square', 0.05, 50); noise(0.12, 0.05, 900); break; case 'hurt': tone(210, 0.16, 'sawtooth', 0.07, 70); noise(0.08, 0.05, 700); break;
    case 'zap': tone(880, 0.13, 'sine', 0.05, 240); tone(1320, 0.08, 'triangle', 0.025, 600); break; case 'boom': noise(0.3, 0.12, 500); tone(110, 0.25, 'sine', 0.09, 35); break;
    case 'shoot': noise(0.05, 0.05, 3000); tone(600, 0.05, 'triangle', 0.02, 300); break; case 'pick': tone(700, 0.06, 'triangle', 0.04, 950); break;
    case 'gold': tone(1250, 0.05, 'square', 0.03); tone(1660, 0.09, 'square', 0.03, 0, 0.05); break; case 'rare': [660, 880, 1320].forEach((f, i) => tone(f, 0.14, 'triangle', 0.06, 0, i * 0.08)); break;
    case 'door': tone(130, 0.09, 'square', 0.05, 80); noise(0.06, 0.03, 400); break; case 'stairs': [300, 240, 190, 150].forEach((f, i) => tone(f, 0.07, 'triangle', 0.045, 0, i * 0.07)); break;
    case 'level': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, 0, i * 0.09)); break; case 'drink': tone(380, 0.1, 'sine', 0.05, 640); tone(300, 0.1, 'sine', 0.04, 560, 0.09); break;
    case 'read': noise(0.12, 0.03, 2500); tone(900, 0.1, 'sine', 0.02, 1100); break; case 'use': tone(520, 0.08, 'triangle', 0.04, 700); break; case 'chest': tone(220, 0.08, 'square', 0.05, 330); tone(880, 0.12, 'triangle', 0.05, 0, 0.09); break;
    case 'pray': [392, 494, 587].forEach(f => tone(f, 0.5, 'sine', 0.035)); break; case 'death': tone(330, 0.9, 'sawtooth', 0.09, 35); noise(0.5, 0.06, 400); break; case 'ui': tone(660, 0.03, 'square', 0.02); break;
  }
}
