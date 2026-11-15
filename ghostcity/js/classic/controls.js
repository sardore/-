// All desktop/touch input translation and the requestAnimationFrame loop.
export function startControls({game,renderer,ui,store,audio}){
  const $=id=>document.getElementById(id);
  const cv=$('game-canvas');
  let stamp=0,savedAt=0,mapAt=0,hudAt=0;
  let held=new Set(),pressed={attack:false,dash:false,interact:false,potion:false};
  let finger=false,joy={x:0,y:0,id:null};
function togglePause(){
  if(game.mode==='playing')game.setMode('paused');
  else if(['paused','inventory'].includes(game.mode))game.setMode('playing');
  else if(game.mode==='shop')game.closeShop();
  ui.drawOverlay();
}
const codes=new Set([' ','arrowup','arrowdown','arrowleft','arrowright']);
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(codes.has(k))e.preventDefault();
  held.add(k);
  if(e.repeat)return;
  if(k==='escape'){togglePause();return;}
  if(game.mode==='shop'&&k==='enter'){game.closeShop();store.persist();ui.drawOverlay();return;}
  if(game.mode==='shop'&&k>='1'&&k<='4'){game.buy(Number(k)-1);ui.drawOverlay();store.persist();return;}
  if(game.mode==='info'&&k==='enter'){game.confirmTutorial();ui.drawOverlay();store.persist();return;}
  if(game.mode==='midclear'&&k==='enter'){game.continueMidBoss();ui.drawOverlay();store.persist();return;}
  if(game.mode==='inventory'){
    if(k==='g'){ui.toggleDrop();return;}
    if(k>='1'&&k<='7'){
      ui.useSlot(Number(k)-1);return;
    }
  }
  if(game.mode!=='playing')return;
  if(game.tutorial&&![' ','enter','e'].includes(k))return;
  if(k===' '){if(e.shiftKey)pressed.dash=true;else pressed.attack=true;}
  else if(k==='e'||(k==='enter'&&game.tutorial))pressed.interact=true;
  else if(k==='h')pressed.potion=true;
  else if(k==='i'){game.setMode('inventory');ui.drawOverlay();}
  else if(k==='q')game.cycleWeapon();
  else if(k>='1'&&k<='7'){game.useSlot(Number(k)-1);ui.invalidateWeapons();}
});
window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{held.clear();finger=false;joy.x=joy.y=0;if(game.mode==='playing')game.setMode('paused');});
$('pause-toggle').addEventListener('click',togglePause);
$('audio-toggle').addEventListener('click',()=>{const muted=audio.toggle();$('audio-toggle').textContent=muted?'♪̸':'♫';});
const stick=$('joystick'),core=$('joystick-core');
function joyMove(e){
  const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
  const d=Math.hypot(x,y)||1,scale=Math.min(d,34)/d;
  joy.x=x/d*Math.min(1,d/20);joy.y=y/d*Math.min(1,d/20);
  core.style.transform='translate(calc(-50% + '+x*scale+'px),calc(-50% + '+y*scale+'px))';
}
stick.addEventListener('pointerdown',e=>{joy.id=e.pointerId;stick.setPointerCapture(e.pointerId);joyMove(e);e.preventDefault();});
stick.addEventListener('pointermove',e=>{if(joy.id===e.pointerId)joyMove(e);});
function endJoy(e){if(e.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;core.style.transform='translate(-50%,-50%)';}
stick.addEventListener('pointerup',endJoy);stick.addEventListener('pointercancel',endJoy);
for(const b of document.querySelectorAll('[data-touch]')){
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();b.setPointerCapture(e.pointerId);
    const a=b.dataset.touch;
    if(a==='attack')finger=true;
    else if(a==='dash')pressed.dash=true;
    else if(a==='interact')pressed.interact=true;
    else if(a==='potion')pressed.potion=true;
    else if(a==='skill'){game.setMode('inventory');ui.drawOverlay();}
  });
  const up=()=>{if(b.dataset.touch==='attack')finger=false;};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);
}
cv.addEventListener('contextmenu',e=>e.preventDefault());
renderer.reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>renderer.resize()).observe(cv);
else window.addEventListener('resize',()=>renderer.resize());
function loop(now){
  const dt=stamp?Math.min(.033,(now-stamp)/1000):0;stamp=now;
  const x=(held.has('d')||held.has('arrowright')?1:0)-(held.has('a')||held.has('arrowleft')?1:0)+joy.x;
  const y=(held.has('s')||held.has('arrowdown')?1:0)-(held.has('w')||held.has('arrowup')?1:0)+joy.y;
  const input={moveX:x,moveY:y,attack:pressed.attack||finger,
    dash:pressed.dash,interact:pressed.interact,potion:pressed.potion};
  pressed={attack:false,dash:false,interact:false,potion:false};
  game.tick(dt,input);
  renderer.render(game,dt);
  if(now-mapAt>220){renderer.drawMinimap(game);mapAt=now;}
  if(now-hudAt>70){ui.hud();hudAt=now;}
  if(game.mode==='playing'&&now-savedAt>14000){store.persist();savedAt=now;}
  requestAnimationFrame(loop);
}

  ui.hud();ui.drawOverlay();requestAnimationFrame(loop);
}
