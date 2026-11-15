import {T,TILE,WEAPONS,ENEMIES,clamp} from './config.js';

const TAU=Math.PI*2;
function hash(x,y,s=1){let n=Math.imul((x+1)|0,374761393)^Math.imul((y+1)|0,668265263)^Math.imul(s|0,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function ellipse(ctx,x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);}
function line(ctx,x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function poly(ctx,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
function rr(ctx,x,y,w,h,r=6){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2));}
function glow(ctx,x,y,r,color){
  const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
export class Renderer{
  constructor(canvas,minimap=null){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');
    this.minimap=minimap;this.minictx=minimap?.getContext('2d')||null;
    this.w=900;this.h=540;this.dpr=1;this.camera={x:0,y:0};this.lastMap=0;
    this.pointer=null;this.reduceMotion=false;this.resize();
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect();
    const w=Math.max(340,Math.floor(rect.width||900)),h=Math.max(320,Math.floor(rect.height||540));
    this.w=w;this.h=h;this.dpr=Math.min(window.devicePixelRatio||1,2);
    this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    if(this.minimap){this.minimap.width=180*2;this.minimap.height=116*2;}
  }
  screenToWorld(x,y){return {x:x+this.camera.x,y:y+this.camera.y};}
  setPointer(x,y){this.pointer={x,y};}
  track(game,dt){
    const p=game.player,w=game.world;
    const targetX=clamp(p.x-this.w*.5,0,Math.max(0,w.w*TILE-this.w));
    const targetY=clamp(p.y-this.h*.5,0,Math.max(0,w.h*TILE-this.h));
    const mix=Math.min(1,dt*10);
    this.camera.x+=(targetX-this.camera.x)*mix;this.camera.y+=(targetY-this.camera.y)*mix;
  }
  drawTile(ctx,x,y,t,theme,seed,now,game){
    const a=x*TILE,b=y*TILE,h=hash(x,y,seed),dark=theme==='swamp';
    if(t===T.WALL){
      ctx.fillStyle=dark?'#182a2c':'#273344';ctx.fillRect(a,b,TILE,TILE);
      ctx.fillStyle=dark?'#26383a':'#394658';ctx.fillRect(a+1,b+1,30,5);
      ctx.fillStyle=dark?'#111f25':'#1a2533';ctx.fillRect(a+1,b+26,30,5);
      ctx.strokeStyle=dark?'#314448':'#485368';ctx.lineWidth=1;
      line(ctx,a+1,b+12,a+31,b+12);line(ctx,a+1,b+23,a+31,b+23);
      line(ctx,a+16,b+2,a+16,b+12);line(ctx,a+8,b+12,a+8,b+23);line(ctx,a+24,b+23,a+24,b+30);
      if(h>.87){ctx.fillStyle='#121e2b';ctx.fillRect(a+23,b+12,7,5);}
      return;
    }
    const base=dark?['#192b2d','#1c3030','#223330','#182d32']:['#192739','#1d2a3a','#202d3d','#1b2b3a'];
    ctx.fillStyle=base[Math.floor(h*4)];ctx.fillRect(a,b,32,32);
    ctx.strokeStyle=dark?'#2b3d3a':'#293b50';ctx.lineWidth=.65;
    ctx.strokeRect(a+.5,b+.5,31,31);
    if(h>.62){
      ctx.strokeStyle=dark?'#385044':'#344558';
      line(ctx,a+3,b+hash(y,x,seed)*11+6,a+15,b+12);
      if(h>.86)line(ctx,a+15,b+12,a+24,b+23);
    }
    if(h<.2){ctx.fillStyle=dark?'#5c756321':'#a5cad31a';ctx.fillRect(a+5,b+7,2,2);ctx.fillRect(a+20,b+23,3,1);}
    if(t===T.FLOOR)return;
    if(t===T.RUBBLE){
      ctx.fillStyle='#0a1322';ctx.fillRect(a+2,b+18,29,10);
      ctx.fillStyle=dark?'#4c5751':'#586575';
      poly(ctx,[[a+4,b+23],[a+7,b+8],[a+19,b+6],[a+29,b+20],[a+26,b+26],[a+12,b+27]]);
      ctx.fill();ctx.strokeStyle='#8592a170';ctx.stroke();
      ctx.fillStyle='#78879a';ctx.fillRect(a+9,b+11,7,4);
    }else if(t===T.GLASS){
      ctx.fillStyle='#58b1cc39';ctx.fillRect(a+3,b+4,26,24);
      ctx.strokeStyle='#95edec99';ctx.strokeRect(a+3,b+4,26,24);
      line(ctx,a+5,b+6,a+25,b+26);
    }else if(t===T.DOOR){
      ctx.fillStyle='#536976';ctx.fillRect(a+8,b+4,17,24);
      ctx.fillStyle='#95b5bd';ctx.fillRect(a+10,b+7,12,2);
      ctx.fillStyle='#e9bc7d';ctx.fillRect(a+19,b+18,2,2);
    }else if(t===T.STAIRS){
      ctx.fillStyle='#122e33';ctx.fillRect(a+2,b+2,28,28);
      for(let j=0;j<5;j++){
        ctx.fillStyle=j%2?'#397d83':'#4ca7a4';ctx.fillRect(a+6,b+5+j*5,20-j*2,3);
      }
      ctx.strokeStyle=game.world.boss&&!game.world.bossDefeated?'#e57086':'#91fff0';
      ctx.lineWidth=2;ctx.strokeRect(a+2,b+2,28,28);
      glow(ctx,a+16,b+16,26,game.world.boss&&!game.world.bossDefeated?'#ed4b5727':'#47f4de44');
    }else if(t===T.ELEVATOR||t===T.BROKEN){
      ctx.fillStyle='#0a1527';ctx.fillRect(a+2,b+2,28,28);
      ctx.fillStyle='#566783';ctx.fillRect(a+4,b+4,11,24);ctx.fillRect(a+17,b+4,11,24);
      ctx.fillStyle=t===T.ELEVATOR?'#69e8e0':'#dd6b76';ctx.fillRect(a+14,b+7,3,17);
      if(t===T.BROKEN){ctx.strokeStyle='#ff8c8c';line(ctx,a+6,b+8,a+25,b+25);}
      glow(ctx,a+16,b+16,26,t===T.ELEVATOR?'#55ffed30':'#fd5c6f24');
    }else if(t===T.SHOP){
      ctx.fillStyle='#352832';ctx.fillRect(a+2,b+4,28,26);
      ctx.fillStyle='#d4b47e';ctx.fillRect(a+4,b+4,24,5);
      ctx.fillStyle='#cf91ac';rr(ctx,a+10,b+12,12,12,3);ctx.fill();
      ctx.fillStyle='#ffe0a8';ctx.fillRect(a+15,b+15,3,6);
      glow(ctx,a+16,b+16,24,'#f5b56736');
    }else if(t===T.WATER){
      ctx.fillStyle='#1a525ca9';ctx.fillRect(a+1,b+1,30,30);
      ctx.strokeStyle='#73c9d455';ctx.lineWidth=1.2;
      const ph=Math.sin(now*1.8+x)*3;
      line(ctx,a+5,b+9+ph,a+25,b+9+ph);
      line(ctx,a+8,b+20-ph,a+27,b+20-ph);
    }else if(t===T.WEB){
      ctx.strokeStyle='#d7e8d655';ctx.lineWidth=.85;
      for(let k=0;k<5;k++)line(ctx,a+2,b+3+k*6,a+29,b+26-k*4);
      for(let k=0;k<3;k++)line(ctx,a+4+k*12,b+3,a+25-k*10,b+29);
    }
  }
  drawPickup(ctx,it,now){
    const t=it.type,x=it.x,y=it.y+Math.sin(now*2.7+it.x)*3;
    ctx.save();ctx.translate(x,y);
    const color=t==='gem'?'#93ffdb':t==='potion'?'#f789a7':t==='shield'?'#b3b3ff':'#ffd384';
    ctx.shadowColor=color;ctx.shadowBlur=15;ctx.strokeStyle=color;ctx.lineWidth=1.5;
    if(t==='gem'){
      ctx.fillStyle='#246d72';
      poly(ctx,[[0,-9],[7,-3],[5,7],[0,10],[-6,4],[-7,-3]]);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#e4fff4';line(ctx,0,-8,0,8);
    }else if(t==='potion'){
      ctx.fillStyle='#823d5f';rr(ctx,-6,-5,12,14,3);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ece7d5';ctx.fillRect(-3,-9,6,5);ctx.fillRect(-4,-10,8,2);
      ctx.fillStyle='#ffb9d2';ctx.fillRect(-4,0,8,5);
    }else if(t==='shield'){
      ctx.fillStyle='#4f4a88';poly(ctx,[[0,-10],[9,-5],[7,6],[0,11],[-7,6],[-9,-5]]);ctx.fill();ctx.stroke();
      ctx.fillStyle='#d9dcff';ctx.fillRect(-1,-6,2,12);
    }else{
      ctx.fillStyle='#6e5033';rr(ctx,-10,-7,20,16,3);ctx.fill();ctx.stroke();
      ctx.fillStyle='#f6cc75';ctx.fillRect(-2,-7,4,16);ctx.fillRect(-10,-1,20,4);
    }
    ctx.restore();
  }
  drawEnemy(ctx,e,now){
    const k=e.kind,c=ENEMIES[k]?.color||'#c8aadf';
    if(k==='bossSpider')return this.drawSpiderBoss(ctx,e,now);
    if(k==='bossKing')return this.drawKing(ctx,e,now);
    ctx.save();ctx.translate(e.x,e.y);
    ellipse(ctx,0,8,e.r+5,e.r*.53);ctx.fillStyle='#0009';ctx.fill();
    ctx.rotate(e.angle+Math.PI/2);
    const bob=Math.sin(now*4+e.id%100)*1.5;
    ctx.translate(0,bob);
    ctx.shadowColor=c;ctx.shadowBlur=e.hit>0?22:8;
    if(k==='hound'){
      ctx.fillStyle='#492c44';ellipse(ctx,0,0,10,15);ctx.fill();
      ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();
      poly(ctx,[[-11,-6],[-4,-9],[-8,-18]]);ctx.fill();
      poly(ctx,[[11,-6],[4,-9],[8,-18]]);ctx.fill();
      ctx.fillStyle='#ffced8';ctx.fillRect(-5,-8,3,3);ctx.fillRect(3,-8,3,3);
    }else if(k==='spider'){
      ctx.lineWidth=2.5;ctx.strokeStyle='#99ca72';
      for(let i=0;i<4;i++){const y=-8+i*5;line(ctx,-7,y,-17,y-5+(i%2)*10);line(ctx,7,y,17,y-5+(i%2)*10);}
      ctx.fillStyle='#405c3b';ellipse(ctx,0,0,10,12);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e6ff97';ctx.fillRect(-5,-5,3,3);ctx.fillRect(3,-5,3,3);
    }else if(k==='witch'){
      ctx.fillStyle='#3c3158';poly(ctx,[[-12,11],[0,-14],[12,11]]);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#ab83d5';ellipse(ctx,0,-3,7,6);ctx.fill();
      ctx.fillStyle='#f7d9ff';ctx.fillRect(-4,-5,3,2);ctx.fillRect(2,-5,3,2);
      ctx.fillStyle='#a88bcd';ctx.fillRect(-15,-11,30,3);
    }else if(k==='sniper'){
      ctx.fillStyle='#333349';rr(ctx,-9,-12,18,25,4);ctx.fill();ctx.strokeStyle=c;ctx.stroke();
      ctx.fillStyle='#f4b7ff';ctx.fillRect(-4,-7,8,3);
      ctx.strokeStyle='#bc80de';ctx.lineWidth=3;line(ctx,6,-4,6,-21);
    }else if(k==='digger'||k==='sentinel'){
      ctx.fillStyle=k==='digger'?'#4e453f':'#3c303a';rr(ctx,-e.r,-e.r,e.r*2,e.r*2+2,5);ctx.fill();
      ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#f7c8aa';ctx.fillRect(-5,-6,10,3);
      if(k==='sentinel'){ctx.fillStyle='#a77b65';ctx.fillRect(-e.r-6,-4,8,18);ctx.fillRect(e.r-2,-4,8,18);}
      else {ctx.strokeStyle='#d7ba8d';ctx.lineWidth=3;line(ctx,-15,0,16,-16);}
    }else{
      ctx.fillStyle='#526277';poly(ctx,[[-11,13],[-9,-6],[0,-14],[9,-6],[11,13],[0,8]]);ctx.fill();
      ctx.strokeStyle=c;ctx.lineWidth=1.8;ctx.stroke();
      ctx.fillStyle='#cfe9fa';ctx.fillRect(-5,-5,3,3);ctx.fillRect(2,-5,3,3);
    }
    ctx.shadowBlur=0;ctx.restore();
    if(e.hp<e.maxHp&&e.hp>0){
      const width=Math.max(22,e.r*2+5),px=e.x-width/2,py=e.y-e.r-17;
      ctx.fillStyle='#09101a';ctx.fillRect(px,py,width,3);
      ctx.fillStyle=e.hit>0?'#fff3c9':c;ctx.fillRect(px,py,width*clamp(e.hp/e.maxHp,0,1),3);
    }
  }
  drawSpiderBoss(ctx,e,now){
    const x=e.x,y=e.y;
    ctx.save();ctx.translate(x,y);
    const phase=e.hp/e.maxHp<.52,anim=Math.sin(now*4);
    glow(ctx,0,0,110,phase?'#f2575930':'#9e70c625');
    ellipse(ctx,0,12,60,35);ctx.fillStyle='#0009';ctx.fill();
    ctx.lineCap='round';ctx.lineWidth=8;ctx.strokeStyle='#33283d';
    for(let i=0;i<4;i++){
      const sy=(i-1.5)*15,by=Math.sin(now*5+i)*8;
      for(const side of [-1,1]){
        line(ctx,side*24,sy,side*(48+i*4),sy-28+by);
        ctx.strokeStyle=phase?'#e47991':'#89629e';ctx.lineWidth=5;
        line(ctx,side*(48+i*4),sy-28+by,side*(80+i*5),sy+6+by);
        ctx.strokeStyle='#33283d';ctx.lineWidth=8;
      }
    }
    ctx.save();ctx.rotate(Math.sin(now*1.1)*.15);
    ctx.fillStyle='#2b2437';ellipse(ctx,0,7,41,43);ctx.fill();
    ctx.strokeStyle=phase?'#e36e80':'#926fbc';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle=phase?'#a13e57':'#6f547e';ellipse(ctx,0,17,26,25);ctx.fill();
    for(let i=-2;i<=2;i++){
      ctx.fillStyle=phase?'#ff9cad':'#cba6ff';ellipse(ctx,i*9,-14,4.5,6);ctx.fill();
    }
    ctx.fillStyle='#f9e9ed';poly(ctx,[[-12,33],[-7,48],[0,34]]);ctx.fill();
    poly(ctx,[[12,33],[7,48],[0,34]]);ctx.fill();
    ctx.restore();ctx.restore();
  }
  drawKing(ctx,e,now){
    ctx.save();ctx.translate(e.x,e.y);
    const low=e.hp/e.maxHp<.52;
    glow(ctx,0,0,110,low?'#ff5c732d':'#ad86ff2a');
    ellipse(ctx,0,16,48,21);ctx.fillStyle='#000a';ctx.fill();
    ctx.fillStyle='#26233e';poly(ctx,[[-28,35],[-22,-28],[0,-39],[22,-28],[28,35],[0,19]]);ctx.fill();
    ctx.strokeStyle=low?'#f095a6':'#918de9';ctx.lineWidth=3;ctx.stroke();
    const wave=Math.sin(now*3)*5;
    ctx.fillStyle='#65547c';
    poly(ctx,[[-24,-28],[-18,-55],[-6,-42],[0,-65],[9,-43],[20,-56],[24,-28]]);ctx.fill();
    ctx.strokeStyle='#c2a4f1';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#e1caff';ellipse(ctx,0,-22,12,16);ctx.fill();
    ctx.fillStyle='#7c395b';ctx.fillRect(-8,-23,5,4);ctx.fillRect(3,-23,5,4);
    ctx.strokeStyle='#9d86ce';ctx.lineWidth=4;
    line(ctx,-26,-16,-41,11+wave);line(ctx,26,-16,41,11-wave);
    ctx.strokeStyle='#e1a9f9';ctx.lineWidth=3;line(ctx,40,11-wave,45,-60+wave);
    ctx.restore();
  }
  drawPlayer(ctx,p,now){
    ctx.save();ctx.translate(p.x,p.y);
    const walk=Math.sin(p.walk)*1.4;
    ellipse(ctx,0,10,15,8);ctx.fillStyle='#0009';ctx.fill();
    glow(ctx,0,0,p.dash>0?55:39,p.dash>0?'#69ffff66':'#7adbdc35');
    ctx.rotate(p.facing+Math.PI/2);
    ctx.translate(0,walk);
    if(p.dash>0){
      ctx.fillStyle='#62e9ff23';poly(ctx,[[-14,10],[-18,35],[18,35],[14,10]]);ctx.fill();
    }
    ctx.fillStyle='#1f344f';
    poly(ctx,[[-15,13],[-12,-9],[0,-18],[12,-9],[15,13],[3,6],[-3,6]]);ctx.fill();
    ctx.strokeStyle=p.invuln>0&&Math.floor(now*16)%2?'#ff9da9':'#9cefff';ctx.lineWidth=2.2;ctx.stroke();
    ctx.fillStyle='#5e8fbb';poly(ctx,[[-8,-6],[0,-16],[8,-6],[0,2]]);ctx.fill();
    ctx.fillStyle='#dffaff';ctx.fillRect(-6,-4,4,3);ctx.fillRect(2,-4,4,3);
    ctx.strokeStyle=WEAPONS[p.weapon]?.color||'#fff';ctx.lineWidth=3.2;
    line(ctx,14,-7,19,-26);ctx.fillStyle='#c5b2ce';ctx.fillRect(14,-8,8,3);
    ctx.restore();
    if(p.parry>0){
      ctx.shadowColor='#c0c7ff';ctx.shadowBlur=16;
      ctx.strokeStyle='#b5beff';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(p.x,p.y,24,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }
    if(p.shield>0){
      ctx.strokeStyle='#abb1ff8b';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,19+Math.sin(now*3)*1.8,0,TAU);ctx.stroke();
    }
  }
  render(game,dt=1/60){
    this.track(game,dt);
    const ctx=this.ctx,w=this.w,h=this.h,world=game.world,p=game.player,now=game.anim;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const night=world.floor>=11;
    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,night?'#080e18':'#091221');bg.addColorStop(1,night?'#0c181b':'#101327');
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const shake=game.shake>0&&!this.reduceMotion?game.shake*9:0;
    ctx.save();ctx.translate(-this.camera.x+(Math.random()-.5)*shake,-this.camera.y+(Math.random()-.5)*shake);
    const x0=Math.max(0,Math.floor(this.camera.x/TILE)-1);
    const y0=Math.max(0,Math.floor(this.camera.y/TILE)-1);
    const x1=Math.min(world.w,Math.ceil((this.camera.x+w)/TILE)+1);
    const y1=Math.min(world.h,Math.ceil((this.camera.y+h)/TILE)+1);
    // Draw the geometry, only visited cells are ever exposed.
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const id=y*world.w+x;
      if(world.seen[id])this.drawTile(ctx,x,y,world.tiles[id],night?'swamp':'city',world.decorSeed,now,game);
      else{ctx.fillStyle=night?'#080f14':'#080e19';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);}
    }
    for(const item of world.pickups){
      const tx=Math.floor(item.x/TILE),ty=Math.floor(item.y/TILE);
      if(tx<x0||ty<y0||tx>=x1||ty>=y1||!world.visible[ty*world.w+tx])continue;
      this.drawPickup(ctx,item,now);
    }
    for(const e of world.enemies){
      const tx=Math.floor(e.x/TILE),ty=Math.floor(e.y/TILE);
      if(tx<x0-4||ty<y0-4||tx>=x1+4||ty>=y1+4)continue;
      if(tx<0||ty<0||tx>=world.w||ty>=world.h||!world.visible[ty*world.w+tx])continue;
      this.drawEnemy(ctx,e,now);
    }
    for(const b of world.projectiles){
      if(b.x<this.camera.x-20||b.x>this.camera.x+w+20||b.y<this.camera.y-20||b.y>this.camera.y+h+20)continue;
      const tx=Math.floor(b.x/TILE),ty=Math.floor(b.y/TILE);
      if(tx<0||ty<0||tx>=world.w||ty>=world.h||!world.visible[ty*world.w+tx])continue;
      ctx.strokeStyle=b.color+'75';ctx.lineWidth=b.r;line(ctx,b.x-b.vx*.026,b.y-b.vy*.026,b.x,b.y);
      ctx.shadowColor=b.color;ctx.shadowBlur=15;ctx.fillStyle=b.color;
      ellipse(ctx,b.x,b.y,b.r,b.r);ctx.fill();ctx.shadowBlur=0;
    }
    // Original rules: attacks are a visible, straight cardinal line of tiles.
    if(game.classic&&game.attackFlash>0&&Array.isArray(game.atkTiles)){
      const opacity=Math.min(1,game.attackFlash/.16);
      for(const hit of game.atkTiles){
        if(hit.x<0||hit.y<0||hit.x>=world.w||hit.y>=world.h)continue;
        if(!world.visible[hit.y*world.w+hit.x])continue;
        const bx=hit.x*TILE,by=hit.y*TILE;
        ctx.fillStyle='rgba(129,236,223,'+(opacity*.19)+')';ctx.fillRect(bx+2,by+2,TILE-4,TILE-4);
        ctx.strokeStyle='rgba(165,250,247,'+(opacity*.75)+')';
        ctx.lineWidth=2;ctx.strokeRect(bx+3,by+3,TILE-6,TILE-6);
      }
    }
    // Short attack-warning telegraphs for lethal ranged enemies and bosses.
    for(const e of world.enemies){
      if(e.dead||e.cd>.48||e.cd<0)continue;
      const tx=Math.floor(e.x/TILE),ty=Math.floor(e.y/TILE);
      if(tx<0||ty<0||tx>=world.w||ty>=world.h||!world.visible[ty*world.w+tx])continue;
      if(e.kind==='bossSpider'||e.kind==='bossKing'){
        ctx.strokeStyle='#ff9db4aa';ctx.lineWidth=2+Math.sin(now*19)*1;
        ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(e.x,e.y,e.r+22+(1-e.cd/.48)*8,0,TAU);ctx.stroke();ctx.setLineDash([]);
      }else if(e.kind==='sniper'){
        ctx.strokeStyle='#ff9aab96';ctx.lineWidth=1.5;ctx.setLineDash([8,8]);
        line(ctx,e.x,e.y,p.x,p.y);ctx.setLineDash([]);
      }
    }
    this.drawPlayer(ctx,p,now);
    for(let i=0;i<p.petCount;i++){
      const a=now*1.75+i*TAU/p.petCount,x=p.x+Math.cos(a)*30,y=p.y-18+Math.sin(a)*18;
      glow(ctx,x,y,28,'#ffe8a545');
      ctx.save();ctx.translate(x,y+Math.sin(now*7+i)*2);
      ctx.fillStyle='#f4d4a4';ellipse(ctx,0,0,6,6);ctx.fill();
      ctx.strokeStyle='#f6efd0';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#ffffffca';
      poly(ctx,[[-3,0],[-15,-7],[-12,6],[-3,4]]);ctx.fill();
      poly(ctx,[[3,0],[15,-7],[12,6],[3,4]]);ctx.fill();
      ctx.restore();
    }
    if(game.slash){
      const sl=game.slash,a=sl.angle,arc=sl.arc;
      const opacity=clamp(sl.life/sl.max,0,1);
      ctx.strokeStyle=sl.color;ctx.globalAlpha=opacity;ctx.lineWidth=10*opacity+3;
      ctx.shadowBlur=23;ctx.shadowColor=sl.color;ctx.beginPath();
      ctx.arc(sl.x,sl.y,sl.range*.75,a-arc/2,a+arc/2);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
    for(const fx of world.effects){
      ctx.globalAlpha=clamp(fx.life/fx.max,0,1);
      if(fx.type==='spark'){ctx.fillStyle=fx.color;ctx.fillRect(fx.x-fx.r/2,fx.y-fx.r/2,fx.r,fx.r);}
      else if(fx.type==='text'){ctx.font='bold 14px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle=fx.color;ctx.fillText(fx.text,fx.x,fx.y);}
      else if(fx.type==='ring'){ctx.strokeStyle=fx.color;ctx.lineWidth=5*fx.life/fx.max;ctx.beginPath();ctx.arc(fx.x,fx.y,fx.radius,0,TAU);ctx.stroke();}
    }
    ctx.globalAlpha=1;
    // Dim previously explored rooms, preserve line-of-sight opacity.
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const id=y*world.w+x;
      if(world.seen[id]&&!world.visible[id]){
        ctx.fillStyle='rgba(3,7,15,.83)';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      }
    }
    // Light is clipped by discovered geometry via the explicit fog above.
    ctx.globalCompositeOperation='screen';
    glow(ctx,p.x,p.y,158,night?'#369b9b21':'#55afdd20');
    for(const b of world.projectiles)if(b.owner==='player')glow(ctx,b.x,b.y,38,'#8e6bcc29');
    ctx.globalCompositeOperation='source-over';
    ctx.restore();
    const vignette=ctx.createRadialGradient(w*.5,h*.47,Math.min(w,h)*.1,w*.5,h*.5,Math.max(w,h)*.78);
    vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#02040fbb');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    if(game.flash>0){ctx.fillStyle='rgba(245,37,81,'+(game.flash*.43)+')';ctx.fillRect(0,0,w,h);}
    // Target reticle; keyboard-only play does not need a cursor.
    if(this.pointer&&game.mode==='playing'){
      const x=this.pointer.x,y=this.pointer.y;
      ctx.strokeStyle='#d8fbffae';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,11,0,TAU);ctx.stroke();
      line(ctx,x-18,y,x-7,y);line(ctx,x+7,y,x+18,y);line(ctx,x,y-18,x,y-7);line(ctx,x,y+7,x,y+18);
    }
    // Cinematic boss nameplate.
    const boss=world.enemies.find(e=>e.kind==='bossSpider'||e.kind==='bossKing');
    if(boss&&game.mode!=='menu'){
      const bx=w/2-150,by=19;
      ctx.fillStyle='#060c1de8';rr(ctx,bx,by,300,27,6);ctx.fill();
      ctx.fillStyle='#923f60';rr(ctx,bx+6,by+19,288,4,2);ctx.fill();
      ctx.fillStyle='#f6a1b9';rr(ctx,bx+6,by+19,288*clamp(boss.hp/boss.maxHp,0,1),4,2);ctx.fill();
      ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillStyle='#ffe6ec';
      ctx.fillText(boss.kind==='bossSpider'?'FLOOR 10 · MEGA SPIDER':'FLOOR 20 · THE GHOST KING',w/2,by+14);
    }
    const inter=game.interactHint();
    if(inter){
      ctx.font='bold 12px system-ui';ctx.textAlign='center';
      const size=Math.max(240,ctx.measureText(inter).width+45);
      ctx.fillStyle='#0b1424ec';rr(ctx,w/2-size/2,h-63,size,33,7);ctx.fill();
      ctx.strokeStyle='#497785';ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='#d4f9f1';ctx.fillText(inter,w/2,h-43);
    }
    // Subtle scanlines are decorative but keep HUD/text sharp.
    ctx.fillStyle='#0000000c';for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);
  }
  drawMinimap(game){
    const cv=this.minimap,ctx=this.minictx;
    if(!cv||!ctx)return;
    const w=180,h=116,world=game.world,sx=w/world.w,sy=h/world.h;
    ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#070e18';ctx.fillRect(0,0,w,h);
    for(let y=0;y<world.h;y++)for(let x=0;x<world.w;x++){
      const i=y*world.w+x;if(!world.seen[i])continue;
      const t=world.tiles[i],visible=world.visible[i];
      ctx.fillStyle=t===T.WALL?'#3c4c61':t===T.STAIRS?'#75f5dd':t===T.SHOP?'#e7b37c':
        t===T.ELEVATOR?'#7bb1ca':t===T.WATER?'#285e67':visible?'#526779':'#263343';
      ctx.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
    }
    const p=game.player;
    ctx.fillStyle='#e6ffff';ctx.beginPath();ctx.arc(p.x/TILE*sx,p.y/TILE*sy,3.5,0,TAU);ctx.fill();
    ctx.strokeStyle='#78ffff';ctx.stroke();
    ctx.strokeStyle='#4b708f';ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);
  }
}
