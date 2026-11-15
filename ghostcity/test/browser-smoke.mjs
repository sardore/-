import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/', 'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+'/')&&file!==root)throw Error('Forbidden');
    const contents=await readFile(file);
    res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});
    res.end(contents);
  }catch{res.writeHead(404);res.end('Not Found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const address=server.address();
const url='http://127.0.0.1:'+address.port+'/';
let browserInstance;
try{
  browserInstance=await chromium.launch({headless:true});
  const errors=[];
  const page=await browserInstance.newPage({viewport:{width:1366,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const response=await page.goto(url,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.waitForSelector('[data-action="new"]');
  assert.equal(await page.title(),'THE GHOST CITY: CLASSIC');
  await page.click('[data-action="new"]');
  await page.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  assert.equal((await page.locator('#floor-number').textContent()).trim(),'TUT');
  const canvas=await page.locator('#game-canvas').boundingBox();
  assert.ok(canvas.width>400&&canvas.height>300);
  assert.ok((await page.locator('#explored-text').textContent()).includes('탐색'));
  assert.match(await page.locator('#save-status').textContent(),/저장됨/);
  await page.click('#help-toggle');
  await page.waitForSelector('[data-action="help-close"]');
  await page.click('[data-action="help-close"]');
  await page.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  // Original monster data omits id/angle; no Canvas transform may receive NaN.
  const transforms=await page.evaluate(async()=>{
    const {Renderer}=await import('/js/render.js');
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
    const ctx=canvas.getContext('2d'),angles=[],moves=[];
    const originalRotate=ctx.rotate,originalTranslate=ctx.translate;
    ctx.rotate=function(angle){angles.push(Number.isFinite(angle));return originalRotate.call(this,angle);};
    ctx.translate=function(x,y){moves.push(Number.isFinite(x)&&Number.isFinite(y));return originalTranslate.call(this,x,y);};
    const drawer=Object.create(Renderer.prototype);
    drawer.drawEnemy(ctx,{kind:'wanderer',x:80,y:80,r:10,hp:1,maxHp:1,hit:0},1.12);
    return {angles,moves};
  });
  assert.ok(transforms.angles.length>0&&transforms.angles.every(Boolean));
  assert.ok(transforms.moves.length>0&&transforms.moves.every(Boolean));
  await page.keyboard.down('d');await page.waitForTimeout(270);await page.keyboard.up('d');
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
  await page.keyboard.press('Space');await page.waitForTimeout(100);
  assert.match(await page.locator('#attack-text').textContent(),/\d+\.\d\ds/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-action="resume"]');
  await page.click('[data-action="resume"]');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForSelector('[data-action="continue"]');
  await page.click('[data-action="continue"]');
  await page.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  assert.equal((await page.locator('#floor-number').textContent()).trim(),'TUT');

  // Pressing Escape in an end-of-floor shop must not skip the shop or advance.
  const shopPage=await browserInstance.newPage();
  shopPage.on('pageerror',e=>errors.push('shop: '+(e.stack||e.message)));
  await shopPage.goto(url,{waitUntil:'networkidle'});
  await shopPage.evaluate(async()=>{
    const {ClassicGame}=await import('/js/classic.js');
    const game=new ClassicGame();game.newRun(55);game.advance(1);
    game.player.gems=20;game.openShop();
    localStorage.setItem('ghost-city-classic-v1',game.serialize());
  });
  await shopPage.reload({waitUntil:'networkidle'});
  await shopPage.click('[data-action="continue"]');
  await shopPage.waitForSelector('[data-action="next"]');
  await shopPage.keyboard.press('Escape');
  assert.ok(await shopPage.locator('[data-action="next"]').isVisible(),
    'shop must remain visible after Escape');
  assert.equal((await shopPage.locator('#floor-number').textContent()).trim(),'01');
  await shopPage.close();

  const mobile=await browserInstance.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true});
  const mp=await mobile.newPage();
  mp.on('pageerror',e=>errors.push('mobile: '+(e.stack||e.message)));
  await mp.goto(url,{waitUntil:'networkidle'});
  await mp.click('[data-action="new"]');
  await mp.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  const displayed=await mp.locator('#mobile-pad').evaluate(el=>getComputedStyle(el).display);
  assert.notEqual(displayed,'none','touch pad should be visible on mobile');
  await mp.locator('[data-touch="dash"]').tap();
  await mp.waitForTimeout(150);
  assert.equal((await mp.locator('#floor-number').textContent()).trim(),'TUT');
  await mobile.close();
  assert.deepEqual(errors,[],'browser JavaScript must not throw');
  console.log('Browser smoke PASS: menu, game, controls, pause, save-resume, mobile viewport');
}finally{
  if(browserInstance)await browserInstance.close();
  await new Promise(ok=>server.close(ok));
}
