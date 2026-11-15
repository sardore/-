// Faithful structure of the original Pygame map-generator, adapted to Canvas2D.
// The 2026 source has 60×30 normal floors, 45×27 boss arenas, corridor lattices,
// walled rooms, up to two doors/room, safe furniture, outer windows and treasure rooms.
import {T,TILE,makeRng,clamp} from '../config.js';
import {isReachable,buildFlow,refreshVision} from '../world.js';
import {center} from './rules.js';

export const ORIGINAL_MAP={
  normal:{w:60,h:30,spacing:10,corridor:3,rooms:14,furn:.06,windows:5,gems:6,potions:3,fov:13},
  dark:{w:60,h:30,spacing:8,corridor:2,rooms:18,furn:.09,windows:2,gems:7,potions:3,fov:6},
  boss:{w:45,h:27},
};
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const at=(w,x,y)=>y*w+x;
const inInner=(w,h,x,y)=>x>0&&x<w-1&&y>0&&y<h-1;
const canWalk=t=>t!==T.WALL&&t!==T.RUBBLE;
function cells(w,condition){
  const out=[];
  for(let y=1;y<w.h-1;y++)for(let x=1;x<w.w-1;x++)if(condition(x,y))out.push({x,y});
  return out;
}
function shuffle(rng,a){
  for(let i=a.length-1;i>0;i--){const j=rng.int(0,i);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function choice(rng,a){return a[rng.int(0,a.length-1)];}
function makeWorld(floor,seed,w,h){
  return {floor,seed,w,h,tiles:new Uint8Array(w*h),seen:new Uint8Array(w*h),
    visible:new Uint8Array(w*h),rooms:[],enemies:[],pickups:[],effects:[],projectiles:[],
    decorSeed:seed,start:{x:2,y:2},stairs:null,boss:false,bossDefeated:false,treasure:[]};
}
function flood(w,start,mode='walk'){
  const q=[start],vis=new Uint8Array(w.w*w.h),startId=at(w.w,start.x,start.y);
  vis[startId]=1;
  for(let i=0;i<q.length;i++){
    const p=q[i];
    for(const [dx,dy] of dirs){
      const x=p.x+dx,y=p.y+dy;if(!inInner(w.w,w.h,x,y))continue;
      const k=at(w.w,x,y),t=w.tiles[k];
      if(vis[k])continue;
      if(mode==='floor'?t!==T.FLOOR:!canWalk(t))continue;
      vis[k]=1;q.push({x,y});
    }
  }
  return {vis,count:q.length};
}
function connectRooms(w,base){
  const first=cells(w,(x,y)=>canWalk(w.tiles[at(w.w,x,y)]))[0]||base;
  const reachable=()=>flood(w,first);
  let connected=reachable();
  // 0-1 BFS: cutting through a wall costs 1; traversing an open cell costs 0.
  for(let pass=0;pass<28;pass++){
    const isolated=cells(w,(x,y)=>w.tiles[at(w.w,x,y)]===T.FLOOR&&!connected.vis[at(w.w,x,y)]);
    if(!isolated.length)break;
    const current=isolated[0],n=w.w*w.h,cost=new Uint16Array(n),prev=new Int32Array(n);
    cost.fill(65535);prev.fill(-1);
    const open=[current],src=at(w.w,current.x,current.y);cost[src]=0;
    let head=0,goal=-1;
    // Small 1800-cell grid, dense array is simpler than a separate heap dependency.
    const used=new Uint8Array(n);
    while(true){
      let best=65535,key=-1;
      for(let y=1;y<w.h-1;y++)for(let x=1;x<w.w-1;x++){
        const id=at(w.w,x,y);
        if(!used[id]&&cost[id]<best){best=cost[id];key=id;}
      }
      if(key<0)break;
      used[key]=1;
      if(connected.vis[key]){goal=key;break;}
      const y=Math.floor(key/w.w),x=key%w.w;
      for(const [dx,dy] of dirs){
        const xx=x+dx,yy=y+dy;if(!inInner(w.w,w.h,xx,yy))continue;
        const nid=at(w.w,xx,yy),add=canWalk(w.tiles[nid])?0:1;
        if(cost[key]+add<cost[nid]){cost[nid]=cost[key]+add;prev[nid]=key;}
      }
    }
    if(goal<0)break;
    let u=goal;
    while(u!==src&&u!==-1){
      if(w.tiles[u]===T.WALL)w.tiles[u]=T.FLOOR;
      u=prev[u];
    }
    connected=reachable();
  }
}
function makeCorridors(w,spacing,width){
  for(let y=1;y<w.h-1;y+=spacing)
    for(let j=0;j<width&&y+j<w.h-1;j++)
      for(let x=1;x<w.w-1;x++)w.tiles[at(w.w,x,y+j)]=T.FLOOR;
  for(let x=1;x<w.w-1;x+=spacing)
    for(let j=0;j<width&&x+j<w.w-1;j++)
      for(let y=1;y<w.h-1;y++)w.tiles[at(w.w,x+j,y)]=T.FLOOR;
}
function carveRoom(w,r){
  const {x,y,width,height}=r;
  for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++)
    w.tiles[at(w.w,xx,yy)]=yy===y||yy===y+height-1||xx===x||xx===x+width-1?T.WALL:T.FLOOR;
}
function addDoors(w,r,rng){
  const {x,y,width,height}=r,candidate=[];
  function test(px,py,ox,oy,ix,iy){
    if(!inInner(w.w,w.h,px,py)||!inInner(w.w,w.h,ox,oy)||!inInner(w.w,w.h,ix,iy))return;
    if(w.tiles[at(w.w,px,py)]!==T.WALL)return;
    if(canWalk(w.tiles[at(w.w,ox,oy)])&&canWalk(w.tiles[at(w.w,ix,iy)]))candidate.push({x:px,y:py});
  }
  for(let xx=x+1;xx<x+width-1;xx++){
    test(xx,y,xx,y-1,xx,y+1);
    test(xx,y+height-1,xx,y+height,xx,y+height-2);
  }
  for(let yy=y+1;yy<y+height-1;yy++){
    test(x,yy,x-1,yy,x+1,yy);
    test(x+width-1,yy,x+width,yy,x+width-2,yy);
  }
  shuffle(rng,candidate);
  for(const door of candidate.slice(0,2))w.tiles[at(w.w,door.x,door.y)]=T.DOOR;
}
function traversableCount(w){
  return cells(w,(x,y)=>canWalk(w.tiles[at(w.w,x,y)]));
}
function safeFurniture(w,rng,density){
  const floor=cells(w,(x,y)=>w.tiles[at(w.w,x,y)]===T.FLOOR);
  shuffle(rng,floor);const target=Math.floor(floor.length*density);
  let placed=0;
  for(const p of floor){
    if(placed>=target)break;
    let neighbors=0,nearDoor=false;
    for(const [dx,dy] of dirs){
      const x=p.x+dx,y=p.y+dy;
      if(!inInner(w.w,w.h,x,y))continue;
      const t=w.tiles[at(w.w,x,y)];
      if(t===T.DOOR)nearDoor=true;
      if(canWalk(t))neighbors++;
    }
    if(nearDoor||neighbors<=1)continue;
    const id=at(w.w,p.x,p.y);w.tiles[id]=T.RUBBLE;
    const walks=traversableCount(w);
    if(walks.length){
      const connected=flood(w,walks[0]);
      if(connected.count!==walks.length){w.tiles[id]=T.FLOOR;continue;}
    }
    placed++;
  }
}
function addWindows(w,rng,n){
  const candidate=[];
  for(let x=2;x<w.w-2;x++){
    if(w.tiles[at(w.w,x,0)]===T.WALL&&canWalk(w.tiles[at(w.w,x,1)]))candidate.push({x,y:0});
    if(w.tiles[at(w.w,x,w.h-1)]===T.WALL&&canWalk(w.tiles[at(w.w,x,w.h-2)]))candidate.push({x,y:w.h-1});
  }
  for(let y=2;y<w.h-2;y++){
    if(w.tiles[at(w.w,0,y)]===T.WALL&&canWalk(w.tiles[at(w.w,1,y)]))candidate.push({x:0,y});
    if(w.tiles[at(w.w,w.w-1,y)]===T.WALL&&canWalk(w.tiles[at(w.w,w.w-2,y)]))candidate.push({x:w.w-1,y});
  }
  shuffle(rng,candidate);
  for(const p of candidate.slice(0,n*4))w.tiles[at(w.w,p.x,p.y)]=T.GLASS;
}
function addElevators(w,rng,count){
  const candidate=[];
  for(let y=2;y<w.h-2;y++)for(let x=2;x<w.w-2;x++){
    if(w.tiles[at(w.w,x,y)]!==T.WALL)continue;
    let walls=0,walks=0;
    for(const [dx,dy] of dirs){const t=w.tiles[at(w.w,x+dx,y+dy)];if(t===T.WALL)walls++;if(canWalk(t))walks++;}
    if(walls&&walks)candidate.push({x,y});
  }
  shuffle(rng,candidate);const placed=[];
  for(const p of candidate){
    if(placed.length>=count)break;
    if(placed.some(t=>Math.abs(t.x-p.x)+Math.abs(t.y-p.y)<6))continue;
    w.tiles[at(w.w,p.x,p.y)]=rng.rand()<.25?T.ELEVATOR:T.BROKEN;placed.push(p);
  }
}
function addDrops(w,rng,type,count,region=null){
  const occupied=new Set(w.pickups.map(p=>at(w.w,Math.floor(p.x/TILE),Math.floor(p.y/TILE))));
  const list=(region?region:cells(w,(x,y)=>w.tiles[at(w.w,x,y)]===T.FLOOR))
    .filter(p=>w.tiles[at(w.w,p.x,p.y)]===T.FLOOR&&!occupied.has(at(w.w,p.x,p.y)));
  shuffle(rng,list);
  for(const p of list.slice(0,count)){
    const index=at(w.w,p.x,p.y);
    if(w.tiles[index]!==T.FLOOR)continue;
    // Tile keeps a single ground item; pickup object stores the original item.
    w.tiles[index]=T.FLOOR;
    const place=center(p.x,p.y);
    w.pickups.push({...place,type,value:1});
  }
}
function addMonsters(w,rng,floor,start){
  const theme=floor>=11?'dark':'normal',cfg=ORIGINAL_MAP[theme];
  const entries=cells(w,(x,y)=>{
    const t=w.tiles[at(w.w,x,y)];
    return t===T.FLOOR&&Math.abs(x-start.x)+Math.abs(y-start.y)>=6&&
      !w.pickups.some(p=>Math.floor(p.x/TILE)===x&&Math.floor(p.y/TILE)===y);
  });
  shuffle(rng,entries);
  const max=Math.min(12,4+Math.floor(floor/2)),positions=[];
  const sniper=Math.min(.70,(floor===1?.12:.33)+(theme==='dark'?.12:0));
  const digger=theme==='normal'&&floor>=3?Math.min(.40,.10+.03*(floor-3)):0;
  const witch=floor>=11?Math.min(.22,.06+.01*(floor-11)):0;
  for(const p of entries){
    if(w.enemies.length>=max)break;
    if(positions.some(q=>Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<3))continue;
    const roll=rng.rand();
    const kind=roll<witch?'witch':roll<witch+digger?'digger':rng.rand()<sniper?'sniper':'wanderer';
    positions.push(p);
    const xy=center(p.x,p.y);
    w.enemies.push({kind,x:xy.x,y:xy.y,r:10,hp:1,maxHp:1,damage:kind==='sniper'?1+Math.floor((floor-1)/7):1+Math.floor((floor-1)/3),
      moveAcc:rng.rand()*.34,cd:0,see:0,slow:0,hit:0,digCd:0});
  }
}
function pickSafeSpawn(w,rng){
  const occupied=new Set(w.pickups.map(p=>at(w.w,Math.floor(p.x/TILE),Math.floor(p.y/TILE))));
  const available=cells(w,(x,y)=>w.tiles[at(w.w,x,y)]===T.FLOOR&&!occupied.has(at(w.w,x,y)));
  shuffle(rng,available);
  if(!available.length)return {x:2,y:2};
  return available.find(p=>w.enemies.every(e=>Math.abs(Math.floor(e.x/TILE)-p.x)+Math.abs(Math.floor(e.y/TILE)-p.y)>=4))||available[0];
}
function buildNormal(floor,seed,rng,luck){
  const cfg=ORIGINAL_MAP[floor>=11?'dark':'normal'],w=makeWorld(floor,seed,cfg.w,cfg.h);
  makeCorridors(w,cfg.spacing,cfg.corridor);
  const base={x:2,y:2},rooms=[];
  for(let i=0,tries=cfg.rooms*8;i<cfg.rooms&&tries-->0;){
    const cx=rng.int(1,w.w-2),cy=rng.int(1,w.h-2);
    if(w.tiles[at(w.w,cx,cy)]!==T.FLOOR)continue;
    const width=rng.int(6,12),height=rng.int(5,8);
    let x,y;
    if(rng.rand()<.5){const side=rng.rand()<.5?-1:1;x=cx+(side===1?1:-width-1);y=cy-Math.floor(height/2);}
    else{const side=rng.rand()<.5?-1:1;y=cy+(side===1?1:-height-1);x=cx-Math.floor(width/2);}
    x=clamp(x,1,w.w-1-width);y=clamp(y,1,w.h-1-height);
    const room={x,y,width,height};carveRoom(w,room);addDoors(w,room,rng);rooms.push(room);i++;
  }
  w.rooms=rooms;
  connectRooms(w,base);
  const empty=cells(w,(x,y)=>w.tiles[at(w.w,x,y)]===T.FLOOR);
  w.stairs=choice(rng,empty)||{x:w.w-3,y:w.h-3};
  w.tiles[at(w.w,w.stairs.x,w.stairs.y)]=T.STAIRS;
  addElevators(w,rng,floor>=11?2:3);
  if(rooms.length&&rng.rand()<.50){
    const r=choice(rng,rooms),region=[];
    for(let y=r.y+1;y<r.y+r.height-1;y++)for(let x=r.x+1;x<r.x+r.width-1;x++)region.push({x,y});
    w.treasure=region;
    addDrops(w,rng,'gem',10+floor*2,region);
    addDrops(w,rng,'cheap',6+Math.floor(floor/2),region);
    if(region.length&&rng.rand()<.004+luck*.006)addDrops(w,rng,'ticket',1,region);
  }
  addDrops(w,rng,'gem',cfg.gems+floor*2);
  addDrops(w,rng,'cheap',cfg.potions+Math.floor(floor/2));
  // Keep ground-pickup tiles safe from furniture placement.
  for(const p of w.pickups){const ix=at(w.w,Math.floor(p.x/TILE),Math.floor(p.y/TILE));w.tiles[ix]=T.SHOP;}
  safeFurniture(w,rng,cfg.furn);
  for(const p of w.pickups){const ix=at(w.w,Math.floor(p.x/TILE),Math.floor(p.y/TILE));w.tiles[ix]=T.FLOOR;}
  addWindows(w,rng,cfg.windows);
  // Source generates monsters and then repositions player to a safe empty tile.
  const preStart=pickSafeSpawn(w,rng);addMonsters(w,rng,floor,preStart);
  w.start=pickSafeSpawn(w,rng);
  if(!isReachable(w,w.start,w.stairs)){
    // Global corridors are already connected; this fallback only repairs pathological seeds.
    connectRooms(w,w.start);
  }
  return w;
}
function buildBoss(floor,seed,rng){
  const {w:width,h:height}=ORIGINAL_MAP.boss,w=makeWorld(floor,seed,width,height);
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++)w.tiles[at(width,x,y)]=T.FLOOR;
  for(let i=0;i<10;i++){
    const x=rng.int(2,width-3),y=rng.int(2,height-3);
    const type=rng.rand()<.7?'gem':'cheap';
    w.pickups.push({...center(x,y),type,value:1});
  }
  w.start={x:Math.floor(width/2),y:height-4};
  w.stairs={x:Math.floor(width/2),y:2};
  w.boss=true;
  const pos=center(Math.floor(width/2),4);
  w.enemies=[{kind:floor===10?'bossSpider':'bossKing',x:pos.x,y:pos.y,r:14,hp:floor===10?72:96,
    maxHp:floor===10?72:96,damage:2,moveAcc:0,cd:0,see:0,hit:0,slow:0,
    bossPhase:'idle',bossTimer:0,bossSteps:0,bossDir:{x:0,y:0},
    summon1:false,summon2:false}];
  // Unlike normal floors, the original boss arena has no exit staircase.
  return w;
}
export function generateClassicFloor(floor,seed=Date.now(),luck=.16){
  if(!Number.isInteger(floor)||floor<1||floor>20)throw Error('floor out of bounds');
  const rng=makeRng((seed>>>0)^(Math.imul(floor,0x9e3779b9)>>>0));
  const w=floor===10||floor===20?buildBoss(floor,seed,rng):buildNormal(floor,seed,rng,luck);
  refreshVision(w,(w.start.x+.5)*TILE,(w.start.y+.5)*TILE,w.floor>=11?6:13);
  return w;
}
