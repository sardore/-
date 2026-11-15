import {T,TILE,MAP_W,MAP_H,BLOCKED,ENEMIES,makeRng,chooseWeighted,clamp} from './config.js';

const around=[[1,0],[-1,0],[0,1],[0,-1]];
const index=(w,x,y)=>y*w+x;
export const gridToPixel=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
export function tileAt(world,x,y){
  const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
  if(tx<0||ty<0||tx>=world.w||ty>=world.h)return T.WALL;
  return world.tiles[ty*world.w+tx];
}
export function isSolid(tile){return BLOCKED.has(tile);}
export function canStand(world,x,y,r=9){
  if(x<r||y<r||x>=world.w*TILE-r||y>=world.h*TILE-r)return false;
  const left=Math.floor((x-r)/TILE),right=Math.floor((x+r)/TILE);
  const top=Math.floor((y-r)/TILE),bottom=Math.floor((y+r)/TILE);
  for(let yy=top;yy<=bottom;yy++)for(let xx=left;xx<=right;xx++){
    const t=world.tiles[index(world.w,xx,yy)];
    if(isSolid(t)){
      const nx=clamp(x,xx*TILE,(xx+1)*TILE),ny=clamp(y,yy*TILE,(yy+1)*TILE);
      if((x-nx)**2+(y-ny)**2<r*r)return false;
    }
  }
  return true;
}
export function moveCircle(world,entity,dx,dy,r=10){
  if(canStand(world,entity.x+dx,entity.y,r))entity.x+=dx;
  if(canStand(world,entity.x,entity.y+dy,r))entity.y+=dy;
}
export function lineOfSight(world,ax,ay,bx,by){
  const deltaX=bx-ax,deltaY=by-ay;
  const steps=Math.ceil(Math.hypot(deltaX,deltaY)/12);
  for(let i=1;i<steps;i++){
    const u=i/steps;
    if(isSolid(tileAt(world,ax+deltaX*u,ay+deltaY*u)))return false;
  }
  return true;
}
export function refreshVision(world,px,py,radius=10){
  const x=Math.floor(px/TILE),y=Math.floor(py/TILE);
  world.visible.fill(0);
  const r=radius;
  for(let yy=Math.max(0,y-r);yy<=Math.min(world.h-1,y+r);yy++)
    for(let xx=Math.max(0,x-r);xx<=Math.min(world.w-1,x+r);xx++){
      if((xx-x)**2+(yy-y)**2>r*r)continue;
      const id=index(world.w,xx,yy);
      if(lineOfSight(world,px,py,(xx+.5)*TILE,(yy+.5)*TILE)){
        world.visible[id]=1;world.seen[id]=1;
      }
    }
}
export function buildFlow(world,px,py){
  const n=world.w*world.h,distance=new Int16Array(n);distance.fill(-1);
  const qx=new Int16Array(n),qy=new Int16Array(n);
  let first=0,last=0,sx=Math.floor(px/TILE),sy=Math.floor(py/TILE);
  if(sx<0||sy<0||sx>=world.w||sy>=world.h)return distance;
  qx[last]=sx;qy[last]=sy;last++;distance[index(world.w,sx,sy)]=0;
  while(first<last){
    const x=qx[first],y=qy[first++],d=distance[index(world.w,x,y)];
    for(const [dx,dy] of around){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=world.w||ny>=world.h)continue;
      const id=index(world.w,nx,ny);
      if(distance[id]!==-1||isSolid(world.tiles[id]))continue;
      distance[id]=d+1;qx[last]=nx;qy[last]=ny;last++;
    }
  }
  return distance;
}
export function flowDirection(world,flow,x,y){
  const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
  if(tx<=0||ty<=0||tx>=world.w-1||ty>=world.h-1)return {x:0,y:0};
  let best=flow[index(world.w,tx,ty)],bestX=tx,bestY=ty;
  if(best<0)return {x:0,y:0};
  for(const [dx,dy] of around){
    const xx=tx+dx,yy=ty+dy,n=flow[index(world.w,xx,yy)];
    if(n>=0&&n<best){best=n;bestX=xx;bestY=yy;}
  }
  if(bestX===tx&&bestY===ty)return {x:0,y:0};
  const ux=(bestX+.5)*TILE-x,uy=(bestY+.5)*TILE-y,d=Math.hypot(ux,uy)||1;
  return {x:ux/d,y:uy/d};
}
export function randomFloorTile(world,rng,away=null,minDistance=0,validator=null){
  for(let tries=0;tries<800;tries++){
    const x=rng.int(2,world.w-3),y=rng.int(2,world.h-3),id=index(world.w,x,y);
    if(world.tiles[id]!==T.FLOOR)continue;
    if(away&&Math.hypot(x-away.x,y-away.y)<minDistance)continue;
    if(validator&&!validator(x,y))continue;
    return {x,y};
  }
  for(let y=2;y<world.h-2;y++)for(let x=2;x<world.w-2;x++)
    if(world.tiles[index(world.w,x,y)]===T.FLOOR)return {x,y};
  return {x:3,y:3};
}
function setTile(world,x,y,t){
  if(x>0&&y>0&&x<world.w-1&&y<world.h-1)world.tiles[index(world.w,x,y)]=t;
}
function carveRect(world,r){
  for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)setTile(world,x,y,T.FLOOR);
}
function carveLine(world,x1,y1,x2,y2,thick=1){
  let x=x1,y=y1;
  while(x!==x2||y!==y2){
    for(let ox=0;ox<thick;ox++)for(let oy=0;oy<thick;oy++)setTile(world,x+ox,y+oy,T.FLOOR);
    if(x!==x2)x+=Math.sign(x2-x);else y+=Math.sign(y2-y);
  }
  setTile(world,x2,y2,T.FLOOR);
}
export function isReachable(world,start,target){
  const flow=buildFlow(world,(start.x+.5)*TILE,(start.y+.5)*TILE);
  return flow[index(world.w,target.x,target.y)]>=0;
}
export function makeEnemy(kind,x,y,floor,rng){
  const spec=ENEMIES[kind],scale=1+(floor-1)*.105;
  return {id:Math.floor(rng.rand()*2e9),kind,x,y,r:kind==='sentinel'?16:kind==='digger'?14:11,
    hp:Math.round(spec.hp*scale),maxHp:Math.round(spec.hp*scale),speed:spec.speed*(1+floor*.008),
    damage:spec.damage,attack:spec.attack,cd:rng.rand()*spec.attack,hit:0,wind:0,
    aiTime:rng.rand(),angle:0,teleport:0,charge:0,marked:false};
}
function bossEnemy(floor,x,y,rng){
  const isSpider=floor===10;
  return {id:Math.floor(rng.rand()*2e9),kind:isSpider?'bossSpider':'bossKing',
    x,y,r:isSpider?45:36,hp:isSpider?730:1050,maxHp:isSpider?730:1050,speed:isSpider?46:62,
    damage:3,attack:1.55,cd:2.7,hit:0,wind:0,aiTime:0,angle:0,teleport:0,
    phase:0,summon:0,attackStage:0,charge:0,marked:false};
}
function loot(world,rng,floor,spawn,stair,boss){
  const place=(type,count,value=1)=>{
    for(let i=0;i<count;i++){
      const p=randomFloorTile(world,rng,spawn,4,(x,y)=>Math.hypot(x-stair.x,y-stair.y)>1.5);
      world.pickups.push({...gridToPixel(p.x,p.y),type,value});
    }
  };
  place('gem',boss?12:8+Math.floor(floor*.8),1);
  place('potion',boss?3:2+Math.floor(floor/6),1);
  if(floor>3)place('shield',2,1);
  if(floor%3===0)place('cache',1,1);
}
export function generateFloor(floor,seed=Date.now()){
  const rng=makeRng((Number(seed)>>>0)^(Math.imul(floor,0x9e3779b9)>>>0));
  const boss=floor===10||floor===20;
  const world={floor,seed,w:MAP_W,h:MAP_H,tiles:new Uint8Array(MAP_W*MAP_H),
    seen:new Uint8Array(MAP_W*MAP_H),visible:new Uint8Array(MAP_W*MAP_H),
    rooms:[],enemies:[],pickups:[],effects:[],projectiles:[],decorSeed:rng.int(1,2147483647),
    start:null,stairs:null,boss,bossDefeated:false};
  if(boss){
    carveRect(world,{x:6,y:5,w:MAP_W-12,h:MAP_H-10});
    for(let i=0;i<14;i++){
      const x=rng.int(10,MAP_W-10),y=rng.int(8,MAP_H-8);
      if(Math.hypot(x-MAP_W/2,y-MAP_H/2)>9)setTile(world,x,y,T.RUBBLE);
    }
    const start={x:Math.floor(MAP_W/2),y:MAP_H-9};
    const stairs={x:Math.floor(MAP_W/2),y:6};
    world.start=start;world.stairs=stairs;
    // The exit only becomes usable when the boss has been killed.
    setTile(world,stairs.x,stairs.y,T.STAIRS);
    const b=gridToPixel(Math.floor(MAP_W/2),Math.floor(MAP_H/2)-2);
    world.enemies.push(bossEnemy(floor,b.x,b.y,rng));
    for(let i=0;i<7;i++){
      const p=randomFloorTile(world,rng,start,8);
      world.enemies.push(makeEnemy(floor===10?'spider':'witch',...Object.values(gridToPixel(p.x,p.y)),floor,rng));
    }
    loot(world,rng,floor,start,stairs,true);
  }else{
    const rooms=[];
    for(let n=0;n<210&&rooms.length<17;n++){
      const w=rng.int(5,12),h=rng.int(5,9);
      const x=rng.int(3,MAP_W-w-3),y=rng.int(3,MAP_H-h-3);
      const rect={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};
      if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
      rooms.push(rect);carveRect(world,rect);
    }
    // A connected hub guarantees every exit is traversable even with unlucky seeds.
    if(rooms.length<5){
      const supplements=[{x:5,y:5,w:10,h:8},{x:20,y:7,w:10,h:8},{x:36,y:19,w:9,h:8},{x:48,y:7,w:9,h:8}];
      for(const r of supplements){r.cx=r.x+Math.floor(r.w/2);r.cy=r.y+Math.floor(r.h/2);rooms.push(r);carveRect(world,r);}
    }
    for(let i=1;i<rooms.length;i++){
      const a=rooms[i-1],b=rooms[i];
      if(rng.chance(.5)){
        carveLine(world,a.cx,a.cy,b.cx,a.cy,rng.chance(.25)?2:1);
        carveLine(world,b.cx,a.cy,b.cx,b.cy,1);
      }else{
        carveLine(world,a.cx,a.cy,a.cx,b.cy,rng.chance(.25)?2:1);
        carveLine(world,a.cx,b.cy,b.cx,b.cy,1);
      }
    }
    for(let i=0;i<Math.floor(rooms.length/3);i++){
      const a=rng.pick(rooms),b=rng.pick(rooms);
      carveLine(world,a.cx,a.cy,b.cx,a.cy,1);
      carveLine(world,b.cx,a.cy,b.cx,b.cy,1);
    }
    world.rooms=rooms;
    const start={x:rooms[0].cx,y:rooms[0].cy};
    const furthest=rooms.slice(1).sort((a,b)=>Math.hypot(b.cx-start.x,b.cy-start.y)-Math.hypot(a.cx-start.x,a.cy-start.y))[0]||rooms[0];
    const stairs={x:furthest.cx,y:furthest.cy};
    world.start=start;world.stairs=stairs;
    // Decorations and obstacles are never placed on the guaranteed corridor network.
    for(let i=0;i<rooms.length;i++){
      const r=rooms[i];
      if(i===0)continue;
      const count=rng.int(0,3);
      for(let j=0;j<count;j++){
        const x=rng.int(r.x+1,r.x+r.w-2),y=rng.int(r.y+1,r.y+r.h-2);
        if((x===start.x&&y===start.y)||(x===stairs.x&&y===stairs.y))continue;
        setTile(world,x,y,floor>=11&&rng.chance(.35)?T.WATER:T.RUBBLE);
      }
    }
    // Ensure the primary exit remains reachable even if decoration blocked a narrow neck.
    if(!isReachable(world,start,stairs)){
      for(let i=1;i<rooms.length;i++){
        const a=rooms[i-1],b=rooms[i];
        carveLine(world,a.cx,a.cy,b.cx,a.cy,2);carveLine(world,b.cx,a.cy,b.cx,b.cy,2);
      }
    }
    setTile(world,stairs.x,stairs.y,T.STAIRS);
    if(floor%3===0){
      const s=rooms[Math.floor(rooms.length/2)];
      if(s&&!(s.cx===stairs.x&&s.cy===stairs.y))setTile(world,s.cx,s.cy,T.SHOP);
    }
    for(let i=0;i<2;i++){
      const p=randomFloorTile(world,rng,start,6,(x,y)=>Math.hypot(x-stairs.x,y-stairs.y)>3);
      setTile(world,p.x,p.y,rng.chance(.2)?T.BROKEN:T.ELEVATOR);
    }
    if(floor>=11)for(let i=0;i<35;i++){
      const p=randomFloorTile(world,rng,start,3);
      if(Math.hypot(p.x-stairs.x,p.y-stairs.y)>3&&rng.chance(.55))setTile(world,p.x,p.y,T.WATER);
      else if(Math.hypot(p.x-stairs.x,p.y-stairs.y)>3)setTile(world,p.x,p.y,T.WEB);
    }
    const count=Math.min(38,7+Math.floor(floor*1.12));
    const pool=floor<=3?[['wanderer',7],['hound',2]]:floor<=9?[['wanderer',5],['hound',4],['sniper',3],['digger',2]]:floor<=15?[['wanderer',2],['hound',2],['sniper',3],['digger',3],['witch',3],['spider',5]]:[['sniper',2],['digger',3],['witch',4],['spider',4],['sentinel',3]];
    for(let i=0;i<count;i++){
      const p=randomFloorTile(world,rng,start,7,(x,y)=>Math.hypot(x-stairs.x,y-stairs.y)>2);
      if(!isReachable(world,start,p))continue;
      const xy=gridToPixel(p.x,p.y);
      world.enemies.push(makeEnemy(chooseWeighted(rng,pool),xy.x,xy.y,floor,rng));
    }
    loot(world,rng,floor,start,stairs,false);
  }
  // A safe 3x3 spawn zone is guaranteed on all seeds, including boss arenas.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const x=world.start.x+dx,y=world.start.y+dy;
    if(x>0&&y>0&&x<world.w-1&&y<world.h-1&&!(x===world.stairs.x&&y===world.stairs.y))
      setTile(world,x,y,T.FLOOR);
  }
  refreshVision(world,(world.start.x+.5)*TILE,(world.start.y+.5)*TILE,11);
  return world;
}
export function serializeWorld(world){
  return {floor:world.floor,seed:world.seed,tiles:Array.from(world.tiles),seen:Array.from(world.seen),
    enemies:world.enemies,pickups:world.pickups,projectiles:world.projectiles,start:world.start,stairs:world.stairs,
    boss:world.boss,bossDefeated:world.bossDefeated,decorSeed:world.decorSeed};
}
export function restoreWorld(data){
  if(!data||!Number.isInteger(data.floor)||data.floor<1||data.floor>20||!Array.isArray(data.tiles)||data.tiles.length!==MAP_W*MAP_H)throw Error('Invalid saved floor');
  const world={floor:data.floor,seed:data.seed,w:MAP_W,h:MAP_H,
    tiles:Uint8Array.from(data.tiles),seen:Uint8Array.from(data.seen||[]),
    visible:new Uint8Array(MAP_W*MAP_H),rooms:[],enemies:data.enemies||[],pickups:data.pickups||[],
    effects:[],projectiles:data.projectiles||[],start:data.start,stairs:data.stairs,
    boss:!!data.boss,bossDefeated:!!data.bossDefeated,decorSeed:data.decorSeed||1};
  if(world.seen.length!==MAP_W*MAP_H)world.seen=new Uint8Array(MAP_W*MAP_H);
  return world;
}
