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
  assert.equal((await page.locator('#floor-number').textContent()).trim(),'01');
  const canvas=await page.locator('#game-canvas').boundingBox();
  assert.ok(canvas.width>400&&canvas.height>300);
  await page.keyboard.down('d');await page.waitForTimeout(270);await page.keyboard.up('d');
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
  await page.mouse.down();await page.waitForTimeout(240);await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-action="resume"]');
  await page.click('[data-action="resume"]');
  await page.reload({waitUntil:'networkidle'});
  await page.waitForSelector('[data-action="continue"]');
  await page.click('[data-action="continue"]');
  await page.waitForFunction(()=>document.querySelector('#overlay').classList.contains('hidden'));
  assert.equal((await page.locator('#floor-number').textContent()).trim(),'01');

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
  assert.equal((await mp.locator('#floor-number').textContent()).trim(),'01');
  await mobile.close();
  assert.deepEqual(errors,[],'browser JavaScript must not throw');
  console.log('Browser smoke PASS: menu, game, controls, pause, save-resume, mobile viewport');
}finally{
  if(browserInstance)await browserInstance.close();
  await new Promise(ok=>server.close(ok));
}
