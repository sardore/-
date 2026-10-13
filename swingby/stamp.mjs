/* 캐시 무효화 도장: js/*.js 마다 내용 해시를 구해 index.html 의 import map 에 `파일?h=해시` 로 적는다.
 * GitHub Pages 는 파일을 몇 분간 캐시해서, 모듈이 안 바뀐 것처럼 보이는 일이 생긴다 — 내용이 바뀐 파일만 주소가 바뀌어 새로 받게 된다.
 * 코드를 고친 뒤 커밋하기 전에 `node swingby/stamp.mjs` 를 돌린다. */
import fs from 'fs'; import crypto from 'crypto'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const imports = {}; const all = crypto.createHash('sha1');
for (const f of fs.readdirSync(path.join(dir, 'js')).filter(f => f.endsWith('.js')).sort()) {
  const h = crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, 'js', f))).digest('hex').slice(0, 8);
  imports['./js/' + f] = './js/' + f + '?h=' + h; all.update(h);
}
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const build = all.digest('hex').slice(0, 6);   // 화면 구석에 작게 보이는 빌드 번호(어느 버전을 받았는지 확인용)
const out = html.replace(/<!--IM-->[\s\S]*?<!--\/IM-->/, '<!--IM--><script>window.__BUILD=\'' + build + '\';</script><script type="importmap">' + JSON.stringify({ imports }) + '</script><!--/IM-->');
if (out !== html) fs.writeFileSync(path.join(dir, 'index.html'), out);
console.log('stamped', Object.keys(imports).length, 'modules, build', build);
