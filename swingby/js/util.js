/* 공용 상수·수학·저장 도우미 */
export const W0 = 420;                      // 기본 월드 폭. 화면(HUD)·보스 아레나는 항상 이 폭이고, 항해 중에는 G.w 로 점점 넓어진다
export const PI = Math.PI, TAU = Math.PI * 2;
export const FONT = 'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

export const rnd = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pickOf = a => a[Math.floor(Math.random() * a.length)];
export const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** '#rrggbb' → 'rgba(r,g,b,a)' */
export const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };

/** localStorage 는 막혀 있을 수 있으니 항상 try/catch 로 감싼다 */
export function load(key, def) { try { const v = localStorage.getItem(key); return v == null ? def : v; } catch (e) { return def; } }
export function save(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) { /* 저장 불가 환경 */ } }
