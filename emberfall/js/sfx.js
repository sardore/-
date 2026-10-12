// 합성 효과음과 아주 작은 앰비언트 드론. 외부 파일 없음.
let AC = null, muted = false, drone = null; const last = {};
try { muted = localStorage.getItem('emberfall_mute') === '1'; } catch (e) {}
export function unlock() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } else if (AC.state === 'suspended') AC.resume(); }
export const isMuted = () => muted;
export function toggle() { muted = !muted; try { localStorage.setItem('emberfall_mute', muted ? '1' : '0'); } catch (e) {} if (muted) stopDrone(); return muted; }
function tone(f, d, type = 'square', vol = 0.05, to = 0, delay = 0) {
  try { const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.04); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.06); } catch (e) {}
}
let nbuf = null;
function noise(d, vol = 0.05, freq = 1200, delay = 0, q = 0) {
  try { if (!nbuf) { nbuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate); const a = nbuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime + delay; s.buffer = nbuf; f.type = q ? 'bandpass' : 'lowpass'; f.frequency.value = freq; if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); s.stop(t + d + 0.02); } catch (e) {}
}
const GAP = { step: 90, hit: 40, smash: 60, hurt: 80, zap: 70, boom: 80, kill: 50, splash: 80, ash: 60, pick: 60 };
export function startDrone(z = 0) {
  if (!AC || muted || drone) return; try { const g = AC.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.018, AC.currentTime + 3); g.connect(AC.destination); const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 55 * (1 + z * 0.06); o2.frequency.value = 82.4 * (1 + z * 0.06); const lf = AC.createOscillator(), lg = AC.createGain(); lf.frequency.value = 0.12; lg.gain.value = 0.006; lf.connect(lg); lg.connect(g.gain); o1.connect(g); o2.connect(g); o1.start(); o2.start(); lf.start(); drone = { g, o1, o2, lf }; } catch (e) {}
}
export function stopDrone() { if (!drone) return; try { drone.g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.5); const d = drone; setTimeout(() => { try { d.o1.stop(); d.o2.stop(); d.lf.stop(); } catch (e) {} }, 700); } catch (e) {} drone = null; }
export function droneZone(z) { if (!drone) return; try { drone.o1.frequency.setTargetAtTime(55 * (1 + z * 0.06), AC.currentTime, 1); drone.o2.frequency.setTargetAtTime(82.4 * (1 + z * 0.06), AC.currentTime, 1); } catch (e) {} }
export function play(n) {
  if (!AC || muted) return; const now = performance.now(); if (now - (last[n] || 0) < (GAP[n] || 30)) return; last[n] = now;
  switch (n) {
    case 'step': noise(0.03, 0.02, 420); break; case 'hit': noise(0.06, 0.08, 1800); tone(180, 0.06, 'square', 0.04, 80); break; case 'smash': noise(0.14, 0.14, 700); tone(120, 0.14, 'sawtooth', 0.07, 40); tone(900, 0.04, 'square', 0.04, 300); break;
    case 'hurt': tone(210, 0.18, 'sawtooth', 0.07, 70); noise(0.1, 0.06, 700); break; case 'kill': tone(300, 0.16, 'square', 0.05, 50); noise(0.14, 0.05, 900); break; case 'bosskill': [260, 200, 150, 90].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.07, 0, i * 0.12)); noise(0.8, 0.1, 500); break;
    case 'zap': tone(900, 0.16, 'sine', 0.05, 220); noise(0.1, 0.04, 3000, 0, 4); break; case 'boom': noise(0.32, 0.12, 520); tone(110, 0.25, 'sine', 0.09, 35); break;
    case 'splash': noise(0.1, 0.04, 1500, 0, 2); break; case 'pick': tone(700, 0.06, 'triangle', 0.04, 950); break; case 'ash': tone(1250, 0.04, 'square', 0.025); tone(1660, 0.07, 'square', 0.025, 0, 0.04); break;
    case 'rare': [660, 880, 1320].forEach((f, i) => tone(f, 0.16, 'triangle', 0.06, 0, i * 0.08)); break; case 'door': tone(130, 0.09, 'square', 0.05, 80); noise(0.07, 0.03, 400); break;
    case 'stairs': [300, 240, 190, 150, 110].forEach((f, i) => tone(f, 0.08, 'triangle', 0.05, 0, i * 0.07)); break; case 'level': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, 0, i * 0.09)); break;
    case 'herb': tone(380, 0.1, 'sine', 0.05, 640); tone(300, 0.1, 'sine', 0.04, 560, 0.09); break; case 'read': noise(0.12, 0.03, 2500); tone(900, 0.1, 'sine', 0.02, 1100); break;
    case 'chest': tone(220, 0.08, 'square', 0.05, 330); tone(880, 0.12, 'triangle', 0.05, 0, 0.09); break; case 'rest': [392, 494, 587].forEach(f => tone(f, 0.6, 'sine', 0.035)); break;
    case 'ignite': noise(0.3, 0.07, 2200, 0, 1); tone(220, 0.3, 'sawtooth', 0.04, 440); break; case 'cart': noise(0.3, 0.07, 400); tone(80, 0.3, 'square', 0.04, 60); break; case 'chain': noise(0.2, 0.06, 4000, 0, 6); tone(400, 0.15, 'square', 0.04, 150); break;
    case 'boss': [110, 98, 82].forEach((f, i) => tone(f, 0.6, 'sawtooth', 0.07, 0, i * 0.2)); noise(0.7, 0.08, 300); break; case 'fall': tone(400, 0.5, 'sine', 0.06, 60); break; case 'web': noise(0.08, 0.03, 3000); break;
    case 'death': tone(330, 1.0, 'sawtooth', 0.09, 35); noise(0.6, 0.06, 400); break; case 'ending': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.9, 'sine', 0.045, 0, i * 0.2)); break; case 'ui': tone(660, 0.03, 'square', 0.02); break;
  }
}
