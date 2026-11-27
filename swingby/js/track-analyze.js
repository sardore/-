/* 음악 파일 분석: 디코딩한 AudioBuffer 에서 곡 길이·BPM·첫 박 위치·세기 곡선을 뽑는다.
 *  - BPM: 10ms 단위 에너지의 증가분(온셋)을 자기상관해서 70~180 BPM 중 가장 잘 맞는 주기를 고른다(박 연출용, 틀려도 플레이에는 지장 없다)
 *  - 세기(env): 0.5초마다의 음량을 0~1 로 정규화하고 2초 폭으로 부드럽게 한 것. 시끄러운 구간일수록 맵이 촘촘해진다 */
export const ENV_DT = .5;   // 세기 곡선 한 칸의 길이(초)

export function analyzeBuffer(buf) {
  const sr = buf.sampleRate, n = buf.length, hop = Math.max(1, Math.round(sr / 100));
  const chs = []; for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chs.push(buf.getChannelData(c));
  const F = Math.floor(n / hop), e = new Float32Array(F);
  for (let f = 0; f < F; f++) {
    let s = 0; const a = f * hop, b = a + hop;
    for (const d of chs) for (let i = a; i < b; i += 2) s += d[i] * d[i];
    e[f] = s / (hop / 2) / chs.length;
  }
  return analyzeEnergy(e, 100, n / sr);
}

/** e: 10ms 마다의 평균 제곱 에너지(fps 프레임/초) → { dur, bpm, beat0, env } */
export function analyzeEnergy(e, fps, dur) {
  const F = e.length, o = new Float32Array(F);
  let prev = Math.log(1e-9 + e[0]);
  for (let f = 1; f < F; f++) { const l = Math.log(1e-9 + e[f]); o[f] = Math.max(0, l - prev); prev = l; }
  // 온셋 자기상관: 120 BPM 근처를 조금 더 선호한다(배수·절반 템포 오인을 줄인다)
  const lo = Math.round(fps * 60 / 180), hi = Math.round(fps * 60 / 70);
  let best = 0, bl = Math.round(fps / 2);
  const sc = new Float32Array(hi + 2);
  for (let l = lo; l <= hi + 1; l++) { let s = 0; for (let f = 0; f + l < F; f++) s += o[f] * o[f + l]; sc[l] = s; }
  for (let l = lo; l <= hi; l++) { const bpm = fps * 60 / l, w = Math.exp(-Math.pow(Math.log2(bpm / 120), 2) / (2 * .8 * .8)), v = sc[l] * w; if (v > best) { best = v; bl = l; } }
  const a = sc[bl - 1] || 0, b = sc[bl], c = sc[bl + 1] || 0, den = a - 2 * b + c, frac = den < 0 ? .5 * (a - c) / den : 0;   // 포물선 보간으로 주기를 다듬는다
  const L = bl + Math.max(-.5, Math.min(.5, frac)), bpm = Math.round(fps * 60 / L * 10) / 10;
  let bp = 0, bs = -1;
  for (let ph = 0; ph < bl; ph++) { let s = 0; for (let x = ph; x < F; x += L) s += o[Math.round(x)] || 0; if (s > bs) { bs = s; bp = ph; } }
  // 세기 곡선
  const per = Math.round(ENV_DT * fps), K = Math.max(1, Math.ceil(F / per)), db = new Float32Array(K);
  for (let k = 0; k < K; k++) { let s = 0, m = 0; for (let f = k * per; f < Math.min(F, (k + 1) * per); f++) { s += e[f]; m++; } db[k] = 10 * Math.log10(1e-9 + s / Math.max(1, m)); }
  const sorted = Array.from(db).sort((x, y) => x - y), p10 = sorted[Math.floor(K * .1)], p95 = sorted[Math.min(K - 1, Math.floor(K * .95))], rng = Math.max(3, p95 - p10);
  const env = new Float32Array(K);
  for (let k = 0; k < K; k++) { let s = 0, m = 0; for (let j = k - 2; j <= k + 2; j++) if (j >= 0 && j < K) { s += Math.min(1, Math.max(0, (db[j] - p10) / rng)); m++; } env[k] = s / m; }
  return { dur, bpm, beat0: bp / fps, env: Array.from(env, v => Math.round(v * 100) / 100) };
}

/** t 초의 세기(0~1) */
export const envAt = (env, t) => env && env.length ? env[Math.max(0, Math.min(env.length - 1, Math.floor(t / ENV_DT)))] : .5;
