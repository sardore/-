// Pygame-source-faithful Canvas2D renderer.
// The original always places the player at the centre of an odd tile viewport.
// All world geometry is drawn on 30px grid coordinates; there is no smoothing,
// neon glow, gradients, particle shaders, sprite rotation or camera easing.
import {T,TILE,clamp} from '../config.js';
import {ORIGINAL_COLOR as C,ORIGINAL_THEME} from './palette.js';
import {drawGround,drawPickup as drawPickupSprite,drawEnemy as drawEnemySprite,
  drawBossCell,drawPlayer as drawPlayerSprite,drawAngel} from './sprites.js';

const TAU=Math.PI*2;
const isBoss=e=>e.kind==='bossSpider'||e.kind==='bossKing';
const tilePos=(x,y)=>({x:Math.floor(x/TILE),y:Math.floor(y/TILE)});

export class Renderer {
  constructor(canvas,minimap=null){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.minimap=minimap;
    this.minictx=minimap?.getContext('2d')||null;
    this.w=900;this.h=600;this.dpr=1;
    this.camera={x:0,y:0};
    this.pointer=null;this.reduceMotion=false;
    this.resize();
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect();
    this.w=Math.max(300,Math.floor(rect.width||900));
    this.h=Math.max(300,Math.floor(rect.height||600));
    this.dpr=Math.min(2,window.devicePixelRatio||1);
    this.canvas.width=Math.round(this.w*this.dpr);
    this.canvas.height=Math.round(this.h*this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.ctx.imageSmoothingEnabled=false;
    if(this.minimap){
      this.minimap.width=360;this.minimap.height=232;
      this.minictx.imageSmoothingEnabled=false;
    }
  }
  screenToWorld(x,y){return {x:x+this.camera.x,y:y+this.camera.y};}
  setPointer(x,y){this.pointer={x,y};}
  viewport(p){
    const maxCols=Math.max(1,Math.floor(this.w/TILE));
    const maxRows=Math.max(1,Math.floor(this.h/TILE));
    const cols=maxCols%2===1?maxCols:Math.max(1,maxCols-1);
    const rows=maxRows%2===1?maxRows:Math.max(1,maxRows-1);
    const padX=Math.floor((this.w-cols*TILE)/2),padY=Math.floor((this.h-rows*TILE)/2);
    const center=tilePos(p.x,p.y);
    const minX=center.x-Math.floor(cols/2),minY=center.y-Math.floor(rows/2);
    this.camera.x=minX*TILE-padX;this.camera.y=minY*TILE-padY;
    return {cols,rows,padX,padY,minX,minY,center};
  }
  track(game){this.viewport(game.player);}
  drawTile(ctx,x,y,t,theme='NORMAL',seen=true,treasure=false){
    drawGround(ctx,x,y,t,seen,theme,treasure);
  }
  drawPickup(ctx,it){
    const cell=tilePos(it.x,it.y);
    drawPickupSprite(ctx,it,cell.x*TILE,cell.y*TILE);
  }
  drawEnemy(ctx,e,now=0){
    const cell=tilePos(e.x,e.y);
    drawEnemySprite(ctx,e,cell.x*TILE,cell.y*TILE,now);
  }
  drawPlayer(ctx,p){
    const cell=tilePos(p.x,p.y);
    drawPlayerSprite(ctx,cell.x*TILE,cell.y*TILE);
  }
  render(game,dt=1/60){
    const ctx=this.ctx,w=this.w,h=this.h,world=game.world,p=game.player;
    const view=this.viewport(p);
    const {cols,rows,padX,padY,minX,minY}=view;
    const night=world.floor>=11;
    const theme=night?'DARK':'NORMAL';
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=C.black;ctx.fillRect(0,0,w,h);

    // Original draw_world draws visible cells at full palette colors, explored
    // cells at floorDim/wallDim, and unexplored cells as solid black.
    const treasure=new Set((world.treasure||[]).map(q=>q.y*world.w+q.x));
    for(let row=0;row<rows;row++){
      const wy=minY+row,sy=padY+row*TILE;
      for(let col=0;col<cols;col++){
        const wx=minX+col,sx=padX+col*TILE;
        if(wx<0||wy<0||wx>=world.w||wy>=world.h)continue;
        const index=wy*world.w+wx;
        if(!world.seen[index])continue;
        this.drawTile(ctx,sx,sy,world.tiles[index],theme,!!world.visible[index],
          treasure.has(index));
      }
    }
    const screenCell=(wx,wy)=>({x:padX+(wx-minX)*TILE,y:padY+(wy-minY)*TILE});
    const visible=(wx,wy)=>wx>=0&&wy>=0&&wx<world.w&&wy<world.h&&
      !!world.visible[wy*world.w+wx];
    for(const it of world.pickups||[]){
      const pt=tilePos(it.x,it.y);
      if(!visible(pt.x,pt.y)||pt.x<minX||pt.x>=minX+cols||pt.y<minY||pt.y>=minY+rows)continue;
      const xy=screenCell(pt.x,pt.y);
      drawPickupSprite(ctx,it,xy.x,xy.y);
    }
    for(const e of world.enemies||[]){
      if(e.dead)continue;
      const cell=tilePos(e.x,e.y);
      if(isBoss(e)){
        const offsets=[[0,0],[-1,-1],[1,-1],[-1,1],[1,1]];
        for(const [dx,dy] of offsets){
          const wx=cell.x+dx,wy=cell.y+dy;
          if(!visible(wx,wy)||wx<minX||wy<minY||wx>=minX+cols||wy>=minY+rows)continue;
          const xy=screenCell(wx,wy);
          drawBossCell(ctx,e,xy.x,xy.y,dx!==0||dy!==0,game.anim);
        }
      }else if(visible(cell.x,cell.y)){
        const xy=screenCell(cell.x,cell.y);
        drawEnemySprite(ctx,e,xy.x,xy.y,game.anim);
      }
    }

    // Source draw_attack_overlay: 160ms flat red cells with a bright border.
    if(game.attackFlash>0&&Array.isArray(game.atkTiles)){
      const alpha=clamp(game.attackFlash/.16,0,1);
      ctx.save();ctx.globalAlpha=alpha;
      for(const cell of game.atkTiles){
        if(!visible(cell.x,cell.y))continue;
        const xy=screenCell(cell.x,cell.y);
        ctx.fillStyle='rgba(255,40,40,.353)';
        ctx.fillRect(xy.x,xy.y,TILE,TILE);
        ctx.strokeStyle='rgba(255,120,120,.745)';ctx.lineWidth=2;
        ctx.strokeRect(xy.x+1,xy.y+1,TILE-2,TILE-2);
      }
      ctx.restore();
    }
    // Original laser: a red core + pale red edge. This is a hit effect,
    // not a fabricated attack telegraph or an animated projectile.
    for(const marker of game.sniperWarnings||[]){
      if(marker.life<=0)continue;
      const from=tilePos(marker.x,marker.y),to=tilePos(marker.tx,marker.ty);
      const a=screenCell(from.x,from.y),b=screenCell(to.x,to.y);
      ctx.save();ctx.globalAlpha=clamp(marker.life/(marker.max||.28),.17,.94);
      ctx.lineWidth=5;ctx.strokeStyle=marker.color||C.sniper;ctx.beginPath();
      ctx.moveTo(a.x+TILE/2,a.y+TILE/2);ctx.lineTo(b.x+TILE/2,b.y+TILE/2);ctx.stroke();
      ctx.lineWidth=2;ctx.strokeStyle='#ffaaaa';ctx.stroke();
      ctx.restore();
    }

    // Source draws the player after monsters; player is a 24x24 white block.
    const playerScreen=screenCell(view.center.x,view.center.y);
    drawPlayerSprite(ctx,playerScreen.x,playerScreen.y);
    const angels=Math.min(4,p.petCount||0);
    const offsets=[[-Math.floor(TILE/2),-Math.floor(TILE/2)],
      [Math.floor(TILE/2),-Math.floor(TILE/2)],[-Math.floor(TILE/2),Math.floor(TILE/2)],
      [Math.floor(TILE/2),Math.floor(TILE/2)]];
    for(let i=0;i<angels;i++){
      drawAngel(ctx,playerScreen.x+TILE/2+offsets[i][0],
        playerScreen.y+TILE/2+offsets[i][1]);
    }
    if(p.petLaserTime>0&&p.petLaserFrom&&p.petLaserTo){
      const a=screenCell(Math.floor(p.petLaserFrom.x/TILE),Math.floor(p.petLaserFrom.y/TILE));
      const b=screenCell(Math.floor(p.petLaserTo.x/TILE),Math.floor(p.petLaserTo.y/TILE));
      ctx.save();ctx.globalAlpha=clamp(p.petLaserTime/.14,0,1);
      ctx.strokeStyle='#46aaff';ctx.lineWidth=8;ctx.beginPath();
      ctx.moveTo(a.x+TILE/2,a.y+TILE/2);ctx.lineTo(b.x+TILE/2,b.y+TILE/2);ctx.stroke();
      ctx.strokeStyle='#beebff';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    // Original sparks are unlit rectangular pixels, not a particle bloom.
    for(const fx of world.effects||[]){
      const tile=tilePos(fx.x,fx.y);
      if(!visible(tile.x,tile.y)||fx.life<=0)continue;
      const xy={x:Math.round(fx.x-this.camera.x),y:Math.round(fx.y-this.camera.y)};
      ctx.save();ctx.globalAlpha=clamp(fx.life/(fx.max||.6),0,1);
      if(fx.type==='spark'){
        ctx.fillStyle=fx.color||C.particle;
        const size=Math.max(1,Math.round(fx.r||2));ctx.fillRect(xy.x,xy.y,size,size);
      }else if(fx.type==='text'){
        ctx.fillStyle=fx.color||'#ffffff';
        ctx.font='bold 14px Consolas, "Courier New", monospace';
        ctx.textAlign='center';ctx.fillText(fx.text,xy.x,xy.y);
      }else if(fx.type==='ring'){
        ctx.strokeStyle=fx.color||C.particle;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(xy.x,xy.y,fx.radius||10,0,TAU);ctx.stroke();
      }
      ctx.restore();
    }

    // The source health effect is a stack of red frame rectangles.
    if(p.maxHp>0&&p.hp<p.maxHp){
      const ratio=(p.maxHp-p.hp)/p.maxHp;
      const alpha=Math.floor(220*ratio**1.35);
      for(let i=0;i<10;i++){
        const pad=Math.floor(i*9),a=alpha*(i+1)/10*.55/255;
        ctx.strokeStyle='rgba(255,0,40,'+a+')';ctx.lineWidth=18;
        ctx.strokeRect(pad+9,pad+9,Math.max(0,w-pad*2-18),Math.max(0,h-pad*2-18));
      }
    }
    if(game.flash>0){
      ctx.fillStyle='rgba(255,80,80,'+clamp(game.flash/.14*.45,0,.45)+')';
      ctx.fillRect(0,0,w,h);
    }
    if(world.boss){
      const e=(world.enemies||[]).find(a=>isBoss(a)&&!a.dead);
      if(e){
        ctx.fillStyle='#12121a';ctx.fillRect(10,10,225,25);
        ctx.fillStyle='#f5f5ff';ctx.font='14px Consolas, "Courier New", monospace';
        ctx.textAlign='left';ctx.fillText('BOSS HP '+Math.ceil(e.hp)+' / '+Math.ceil(e.maxHp),17,28);
      }
    }
    const hint=game.interactHint?.();
    if(hint){
      ctx.font='14px Consolas, "Courier New", monospace';
      const tw=ctx.measureText(hint).width,boxW=Math.min(w-14,tw+22);
      ctx.fillStyle='#12121a';ctx.fillRect(Math.floor((w-boxW)/2),h-44,boxW,30);
      ctx.strokeStyle='#666678';ctx.lineWidth=2;
      ctx.strokeRect(Math.floor((w-boxW)/2),h-44,boxW,30);
      ctx.fillStyle='#ffdc8c';ctx.textAlign='center';ctx.fillText(hint,w/2,h-24);
    }
  }
  drawMinimap(game){
    const cv=this.minimap,ctx=this.minictx;
    if(!cv||!ctx)return;
    const w=180,h=116,world=game.world;
    const sx=w/world.w,sy=h/world.h;
    ctx.setTransform(2,0,0,2,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    const pal=world.floor>=11?ORIGINAL_THEME.DARK:ORIGINAL_THEME.NORMAL;
    for(let y=0;y<world.h;y++)for(let x=0;x<world.w;x++){
      const i=y*world.w+x;
      if(!world.seen[i])continue;
      const t=world.tiles[i];
      ctx.fillStyle=t===T.WALL?(world.visible[i]?pal.wall:pal.wallDim):
        t===T.STAIRS?'#50dca0':t===T.TUTOR_EXIT?'#ffdc78':
        world.visible[i]?pal.floor:pal.floorDim;
      ctx.fillRect(Math.floor(x*sx),Math.floor(y*sy),Math.ceil(sx),Math.ceil(sy));
    }
    const p=tilePos(game.player.x,game.player.y);
    ctx.fillStyle=C.player;ctx.fillRect(Math.floor(p.x*sx)-2,Math.floor(p.y*sy)-2,5,5);
    ctx.strokeStyle='#666678';ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);
  }
}
