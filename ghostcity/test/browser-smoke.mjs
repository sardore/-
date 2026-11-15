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
  assert.ok(await page.locator('.ranking-panel').isVisible());
  assert.ok(await page.locator('#player-name').isVisible());
  await page.locator('#player-name').fill('PIXEL');
  await page.locator('#player-name').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  assert.equal((await page.locator('#floor-number').textContent()).trim(),'TUT');
  const canvas=await page.locator('#game-canvas').boundingBox();
  assert.ok(canvas.width>400&&canvas.height>300);
  // The live game—not only isolated sprite functions—must render a Pygame
  // white player at the middle of a 30px square viewport.
  const live=await page.locator('#game-canvas').evaluate(cv=>{
    const ctx=cv.getContext('2d'),centerX=Math.floor(cv.width/2),centerY=Math.floor(cv.height/2);
    return {player:Array.from(ctx.getImageData(centerX,centerY,1,1).data),
      imageSmoothing:ctx.imageSmoothingEnabled};
  });
  assert.deepEqual(live.player,[215,245,255,255],'in-game player must be the original white block');
  assert.equal(live.imageSmoothing,false,'pixel art should never be interpolated');
  const design=await page.evaluate(()=>{
    const css=(selector)=>getComputedStyle(document.querySelector(selector));
    return {background:css('body').backgroundColor,
      bodyGradient:css('body').backgroundImage,
      headerGradient:css('.topbar').backgroundImage,
      modalGradient:css('.modal').backgroundImage,
      layout:css('.layout').display,
      pixelScaling:css('#game-canvas').imageRendering,
      extrasInitiallyClosed:!document.querySelector('.utility-details').open,
      font:css('body').fontFamily};
  });
  assert.equal(design.background,'rgb(10, 10, 18)');
  assert.equal(design.bodyGradient,'none');
  assert.equal(design.headerGradient,'none');
  assert.equal(design.modalGradient,'none');
  assert.equal(design.layout,'block');
  assert.equal(design.pixelScaling,'pixelated');
  assert.equal(design.extrasInitiallyClosed,true);
  assert.ok(!design.font.toLowerCase().includes('rajdhani'));
  assert.ok((await page.locator('#explored-text').textContent()).includes('탐색'));
  assert.match(await page.locator('#save-status').textContent(),/저장됨/);
  const persistedName=await page.evaluate(()=>JSON.parse(
    localStorage.getItem('ghost-city-classic-v1')
  ).playerName);
  assert.equal(persistedName,'PIXEL');

  await page.click('#help-toggle');
  await page.waitForSelector('[data-action="help-close"]');
  await page.click('[data-action="help-close"]');
  await page.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  // Pixel-level visual assertions: these must match the original Pygame RGB.
  // The old "not NaN" test was checking rotation from an invented sprite engine.
  const pixels=await page.evaluate(async()=>{
    const [{Renderer},{T,TILE}]=await Promise.all([
      import('/js/render.js'),import('/js/config.js')
    ]);
    const c=document.createElement('canvas');c.width=200;c.height=200;
    const ctx=c.getContext('2d');
    const renderer=Object.create(Renderer.prototype);
    const sample=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
    renderer.drawTile(ctx,10,10,T.FLOOR,'NORMAL',true,false);
    const normalFloor=sample(15,15);
    ctx.clearRect(0,0,200,200);
    renderer.drawTile(ctx,10,10,T.WALL,'NORMAL',true,false);
    const normalWall=sample(15,15);
    ctx.clearRect(0,0,200,200);
    renderer.drawTile(ctx,10,10,T.FLOOR,'DARK',true,false);
    const darkFloor=sample(15,15);
    ctx.clearRect(0,0,200,200);
    renderer.drawEnemy(ctx,{kind:'wanderer',x:75,y:75,r:10,hp:1,maxHp:1,hit:0},1.12);
    const wanderer=sample(75,75);
    ctx.clearRect(0,0,200,200);
    renderer.drawEnemy(ctx,{kind:'sniper',x:75,y:75,r:10,hp:1,maxHp:1,hit:0},1.12);
    const sniper=sample(75,75);
    ctx.clearRect(0,0,200,200);
    renderer.drawPlayer(ctx,{x:75,y:75});
    const player=sample(75,75);
    return {tile:TILE,normalFloor,normalWall,darkFloor,wanderer,sniper,player};
  });
  assert.equal(pixels.tile,30);
  assert.deepEqual(pixels.normalFloor,[60,55,78,255]);
  assert.deepEqual(pixels.normalWall,[150,150,178,255]);
  assert.deepEqual(pixels.darkFloor,[34,30,50,255]);
  assert.deepEqual(pixels.wanderer,[220,90,150,255]);
  assert.deepEqual(pixels.sniper,[255,0,0,255]);
  assert.deepEqual(pixels.player,[215,245,255,255]);
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
  await shopPage.waitForFunction(()=>document.querySelector('#floor-number')?.textContent.trim()==='01');
  const ranking=await shopPage.evaluate(async()=>{
    const {createStorage}=await import('/js/classic/storage.js');
    const storage=createStorage(()=>null);
    storage.finish({name:'PIXEL',score:9250,floor:10,kills:14,time:127,victory:true});
    return storage.ranks();
  });
  assert.equal(ranking[0].name,'PIXEL');
  assert.equal(ranking[0].score,9250);
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
