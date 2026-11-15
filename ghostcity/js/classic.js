// Classic rules port, based on the user's original 2026 Pygame source.
// Unlike the Reborn remix, actions are tile-aligned and the world advances on
// elapsed-time intervals (90ms player movement; 340ms ordinary monster movement).
// This is NOT a turn-based game: enemies can act while the player is standing still.
import {Game} from './game.js';
import {T,TILE,makeRng,clamp} from './config.js';
import {generateFloor,gridToPixel,refreshVision,buildFlow,tileAt,serializeWorld,restoreWorld,flowDirection,lineOfSight} from './world.js';

const TIMES={player:.09,monster:.340,iframe:.40,pet:.9,sniper:.9,witch:2.7};
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const D=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pt=(x,y)=>({x:Math.floor(x/TILE),y:Math.floor(y/TILE)});
const center=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
const at=(a,b)=>a.x===b.x&&a.y===b.y;
const spec={
  axe:{name:'도끼',range:2,base:1.7,power:3,scale:.94,breaks:false},
  spear:{name:'창',range:4,base:1.5,power:2,scale:.95,breaks:false},
  sword:{name:'검',range:3,base:1.2,power:2,scale:.93,breaks:false},
  shield:{name:'방패',range:2,base:1.8,power:1,scale:.97,breaks:false},
  hammer:{name:'망치',range:3,base:1.65,power:3,scale:.94,breaks:true}
};
const keys=Object.keys(spec);
const makeWeapon=(id,level=1)=>({type:'weapon',id,level});
const makeItem=(type)=>({type});
function status(w,p){
  const t=pt(p.x,p.y);
  if(t.x<0||t.y<0||t.x>=w.w||t.y>=w.h)return T.WALL;
  return w.tiles[t.y*w.w+t.x];
}
function safeTile(w,x,y,ignore=null){
  if(x<1||y<1||x>=w.w-1||y>=w.h-1)return false;
  const t=w.tiles[y*w.w+x];
  if(t===T.WALL||t===T.RUBBLE||t===T.GLASS)return false;
  if(ignore!==true&&w.enemies.some(e=>!e.dead&&Math.floor(e.x/TILE)===x&&Math.floor(e.y/TILE)===y))return false;
  return true;
}
function tutorialWorld(seed){
  const w=40,h=22,tiles=new Uint8Array(w*h);tiles.fill(T.WALL);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)tiles[y*w+x]=T.FLOOR;
  for(let x=10;x<16;x++)tiles[8*w+x]=T.WALL;
  for(let y=12;y<15;y++)tiles[y*w+22]=T.WALL;
  tiles[14*w+23]=T.RUBBLE;tiles[14*w+24]=T.RUBBLE;
  const stair={x:w-3,y:h-3};
  tiles[stair.y*w+stair.x]=T.STAIRS;
  return {floor:0,w,h,tiles,visible:new Uint8Array(w*h),seen:new Uint8Array(w*h),
    start:{x:2,y:2},stairs:stair,rooms:[],enemies:[],pickups:[
      {...center(30,6),type:'gem',value:1},
      {...center(30,7),type:'cheap',value:1}
    ],effects:[],projectiles:[],boss:false,bossDefeated:false,seed,decorSeed:seed};
}
const price={potion:6,amulet:16,ticket:22,pet:18,maxhp:12,axe:12,spear:12,sword:12,shield:12,hammer:12};
function owned(p,id){return p.slots.some(s=>s?.type==='weapon'&&s.id===id);}
function addSlot(p,item){const index=p.slots.findIndex(s=>!s);if(index<0)return false;p.slots[index]=item;return true;}
function kindFor(e){return e.kind==='sniper'?'sniper':e.kind==='witch'?'witch':e.kind==='digger'?'digger':e.kind==='spider'?'spider':e.kind==='hound'?'hound':'wanderer';}
export class ClassicGame extends Game {
  constructor(notify=()=>{}){
    super(notify);this.classic=true;this.mode='menu';this.tutorial=true;
    this.world=tutorialWorld(this.seed);this.player=this.makePlayer();this.shopOffers=[];
    this.shopSold=[];this.moveCd=0;this.attackFlash=0;this.atkTiles=[];this.floorEnding=false;
  }
  makePlayer(){
    const start=this.world?.start||{x:2,y:2};
    const p=center(start.x,start.y);
    return {...super.makePlayer(),x:p.x,y:p.y,hp:6,maxHp:6,shield:0,
      level:1,xp:0,xpNext:25,gems:0,potions:0,energy:0,
      weapon:'spear',inventory:['spear'],weaponLevels:{spear:-3},
      slots:[makeItem('cheap'),makeWeapon('spear',-3),null,null,null,null,null],
      equippedSlot:1,petCount:0,petCd:0,parry:0,moveCd:0,dashUsed:false,facing:Math.PI/2,
      inventoryCapacity:7,maxHpBonus:0,baseMaxHp:6,
      // Adapter fields for the shared UI.
      damageMult:1,speedMult:1,dashMult:1,guard:0,crit:0,luck:1,vamp:0,attackMult:1,
      dash:0,dashCd:0,invuln:0,attackCd:0,skillCd:0,walk:0,maxFloor:1,perks:[],kills:0,attackPulse:0};
  }
  activeSlot(){return this.player.slots?.[this.player.equippedSlot]||null;}
  syncInventory(){
    const p=this.player;const weapons=p.slots.filter(s=>s?.type==='weapon');
    p.inventory=weapons.map(s=>s.id);p.weaponLevels=Object.fromEntries(weapons.map(s=>[s.id,s.level]));
    const e=this.activeSlot();p.weapon=e?.type==='weapon'?e.id:'spear';
    if(!e||e.type!=='weapon')p.equippedSlot=null;
    p.potions=p.slots.filter(s=>s?.type==='potion'||s?.type==='cheap').length;
  }
  newRun(seed=((Math.random()*4294967295)>>>0)){
    this.seed=seed>>>0;this.rng=makeRng(this.seed);
    this.world=tutorialWorld(this.seed);this.player=this.makePlayer();
    this.elapsed=0;this.kills=0;this.score=0;this.time=0;
    this.mode='playing';this.tutorial=true;this.floorEnding=false;
    this.shopOffers=[];this.shopSold=[];this.moveCd=0;this.attackFlash=0;this.atkTiles=[];
    this.flow=null;this.flowTimer=0;this.visionTimer=0;this.visionTile='';
    this.runEnded=false;this.shake=0;this.flash=0;this.slash=null;this.messages=[];
    refreshVision(this.world,this.player.x,this.player.y,13);
    this.say('튜토리얼: WASD 이동 · SPACE 직선 공격 · 노란 출구에서 ENTER',5);
    this.notify('start',{floor:0});
  }
  weapon(){
    const item=this.activeSlot();
    if(item?.type==='weapon')return {...spec[item.id],id:item.id,level:item.level};
    return {name:'맨손',id:null,level:0,base:.7,power:.5,range:1,scale:1,breaks:false};
  }
  weaponLevel(){return this.activeSlot()?.level||0;}
  weaponStats(){
    const w=this.weapon();
    return {...w,rate:Math.max(w.id?.42:.25,w.base*Math.pow(w.scale,w.level))};
  }
  setMode(mode){this.mode=mode;this.notify('mode',{mode});}
  changeWeapon(id){
    const idx=this.player.slots.findIndex(s=>s?.type==='weapon'&&s.id===id);
    return idx<0?false:this.useSlot(idx);
  }
  cycleWeapon(dir=1){
    const p=this.player;let index=p.equippedSlot??0;
    for(let i=0;i<7;i++){
      index=(index+dir+7)%7;
      if(p.slots[index]?.type==='weapon')return this.useSlot(index);
    }
    return false;
  }
  useSlot(index){
    const p=this.player,item=p.slots[index];if(!item)return false;
    if(item.type==='weapon'){
      p.equippedSlot=index;this.syncInventory();this.say(spec[item.id].name+' Lv.'+item.level+' 장착',1.4);this.sound('equip');return true;
    }
    if(item.type==='potion'||item.type==='cheap'){
      p.slots[index]=null;this.syncInventory();
      if(p.hp>=p.maxHp){this.say('이미 체력이 가득합니다.',2);return true;}
      if(item.type==='potion'){p.hp=Math.min(p.maxHp,p.hp+3);this.say('회복 물약 +3 HP',2);}
      else if(this.rng.rand()<.5){p.hp=Math.min(p.maxHp,p.hp+1);this.say('싸구려 물약 성공 +1 HP',2);}
      else this.say('싸구려 물약 실패',2);
      this.sound('heal');return true;
    }
    if(item.type==='ticket'){
      p.slots[index]=null;
      const weapons=p.slots.filter(s=>s?.type==='weapon');
      if(weapons.length){const w=this.rng.pick(weapons);if(w.level<=3){w.level=4;this.say('강화권: '+spec[w.id].name+' Lv.4',2);}}
      else{p.maxHpBonus+=.1;this.recomputeHp();this.say('무기가 없어 최대 HP +10%',2);}
      this.syncInventory();return true;
    }
    if(item.type==='amulet'){
      p.slots[index]=null;this.syncInventory();
      const cp=pt(p.x,p.y);
      for(const e of this.world.enemies){
        if(D(cp,pt(e.x,e.y))<=7){e.dead=true;this.score+=50;this.addXP(5);}
      }
      this.world.enemies=this.world.enemies.filter(e=>!e.dead);
      for(let y=Math.max(1,cp.y-7);y<Math.min(this.world.h-1,cp.y+8);y++)
        for(let x=Math.max(1,cp.x-7);x<Math.min(this.world.w-1,cp.x+8);x++)
          if(Math.hypot(x-cp.x,y-cp.y)<=7&&[T.WALL,T.RUBBLE].includes(this.world.tiles[y*this.world.w+x]))
            this.world.tiles[y*this.world.w+x]=T.FLOOR;
      this.sparks(p.x,p.y,'#cbafff',75,210);this.shake=.5;this.say('수호 부적 폭발!',3);
      return true;
    }
    return false;
  }
  dropSlot(index){
    if(this.mode!=='inventory'&&this.mode!=='playing')return false;
    const p=this.player,item=p.slots[index];if(!item)return false;
    const here=pt(p.x,p.y);const around=[here,...DIRS.map(d=>({x:here.x+d[0],y:here.y+d[1]}))];
    const place=around.find(q=>q.x>0&&q.y>0&&q.x<this.world.w-1&&q.y<this.world.h-1&&this.world.tiles[q.y*this.world.w+q.x]===T.FLOOR);
    if(!place){this.say('버릴 공간이 없습니다.',2);return false;}
    this.world.pickups.push({...center(place.x,place.y),type:item.type==='weapon'?'weapon':item.type,weapon:item.id,level:item.level,value:1});
    p.slots[index]=null;if(p.equippedSlot===index)p.equippedSlot=null;
    this.syncInventory();this.say('아이템을 버렸습니다.',2);return true;
  }
  addXP(amount){
    const p=this.player;const before=p.baseMaxHp;p.xp+=Math.max(0,amount);
    p.baseMaxHp=Math.min(18,6+Math.floor(p.xp/25));
    this.recomputeHp();
    p.level=1+Math.floor(p.xp/25);p.xpNext=25;
    if(p.baseMaxHp>before)this.say('최대 HP '+before+' → '+p.baseMaxHp,2);
  }
  recomputeHp(){
    const p=this.player,next=Math.max(1,Math.ceil(p.baseMaxHp*(1+p.maxHpBonus)));
    if(next>p.maxHp)p.hp+=next-p.maxHp;
    p.maxHp=next;p.hp=Math.min(p.hp,p.maxHp);
  }
  // All combat is cardinal, tracing a line of grid tiles until a wall.
  attack(){
    if(this.mode!=='playing'||this.player.attackCd>0)return false;
    const p=this.player,w=this.world,st=this.weaponStats();
    p.attackCd=st.rate;this.attackFlash=.16;this.atkTiles=[];p.attackPulse=.16;
    const face=DIRS[Math.round(p.facing/(Math.PI/2))&3]||DIRS[0],start=pt(p.x,p.y);
    for(let k=1;k<=st.range;k++){
      const x=start.x+face[0]*k,y=start.y+face[1]*k;
      if(x<0||y<0||x>=w.w||y>=w.h)break;
      this.atkTiles.push({x,y});
      if(st.breaks&&w.tiles[y*w.w+x]===T.RUBBLE){
        w.tiles[y*w.w+x]=T.FLOOR;this.sparks((x+.5)*TILE,(y+.5)*TILE,'#cbb99e',16);
      }
      for(const e of w.enemies){
        if(e.dead)continue;
        const t=pt(e.x,e.y),onBoss=(e.kind==='bossSpider'||e.kind==='bossKing');
        if(onBoss?this.bossTiles(e).some(t=>t.x===x&&t.y===y):t.x===x&&t.y===y){
          // Each enemy is hit once per attack, even if a multi-tile boss spans several cells.
          if(e.lastHit===this.time)continue;
          e.lastHit=this.time;e.hp-=st.power;e.hit=.16;
          this.sparks(e.x,e.y,'#a9deff',12);
          if(onBoss)this.score+=3;
          if(e.hp<=0)this.killEnemy(e);
        }
      }
      if(w.tiles[y*w.w+x]===T.WALL)break;
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
    this.sound('swing');return true;
  }
  bossTiles(e){
    const t=pt(e.x,e.y);
    return [t,{x:t.x-1,y:t.y-1},{x:t.x+1,y:t.y-1},{x:t.x-1,y:t.y+1},{x:t.x+1,y:t.y+1}];
  }
  killEnemy(e){
    if(e.dead)return;
    e.dead=true;this.sparks(e.x,e.y,'#acbdeb',23);
    const isBoss=e.kind==='bossSpider'||e.kind==='bossKing';
    if(isBoss){
      this.score+=1200;
      this.world.bossDefeated=true;
      // Original: either boss fight ends the game. The 10F boss is a mid-boss
      // in the source constants but the loop terminates on boss defeat.
      // Here the 10F win transitions to 11F, honoring intended 20F progression.
      if(this.world.floor===20){this.end(true);}
      else this.say('중간보스 격파! 다음 층으로 이동 가능.',5);
    }else{
      this.score+=50;this.addXP(5);this.kills++;this.player.kills++;
    }
    this.sound(isBoss?'boss':'hit');
  }
  damagePlayer(amount){
    const p=this.player;
    if(this.mode!=='playing'||p.invuln>0||p.dash>0)return false;
    let value=amount;
    if(p.equippedSlot!==null&&this.activeSlot()?.id==='shield'){
      const lvl=this.activeSlot().level;
      if(this.rng.rand()<Math.min(.18,.04+.015*lvl))value=0;
      else if(this.rng.rand()<Math.min(.45,.18+.025*lvl))value=Math.max(0,value-1);
    }
    if(value<=0){this.say('방패로 공격을 막았습니다!',1.2);return false;}
    if(p.hp-value<=0&&p.petCount>0){p.petCount--;p.hp=1;this.say('수호 천사가 희생했습니다! 남은 '+p.petCount,4);}
    else p.hp=Math.max(0,p.hp-value);
    p.invuln=TIMES.iframe;this.flash=.14;this.shake=.17;this.sparks(p.x,p.y,'#ff9aab',12);
    this.sound('hurt');if(p.hp<=0)this.end(false);
    return true;
  }
  // Spear Lv3+ gets one powerful path-based dash per floor.
  dash(){
    const p=this.player,s=this.activeSlot();
    if(this.mode!=='playing'||!s||s.type!=='weapon'||s.id!=='spear'||s.level<3||p.dashUsed)return false;
    p.dashUsed=true;p.dash=.52;p.invuln=.52;const face=DIRS[Math.round(p.facing/(Math.PI/2))&3]||DIRS[0],w=this.world;
    let t=pt(p.x,p.y);
    for(let n=0;n<Math.max(1,s.level*2);n++){
      const x=t.x+face[0],y=t.y+face[1];
      if(x<1||y<1||x>=w.w-1||y>=w.h-1)break;
      const ix=y*w.w+x;if([T.WALL,T.RUBBLE].includes(w.tiles[ix]))w.tiles[ix]=T.FLOOR;
      for(const e of w.enemies){
        if(e.dead)continue;
        if(this.bossTiles(e).some(a=>a.x===x&&a.y===y)&&e.kind.startsWith('boss')){
          e.hp-=this.weaponStats().power*10;if(e.hp<=0)this.killEnemy(e);
        }else if(Math.floor(e.x/TILE)===x&&Math.floor(e.y/TILE)===y)this.killEnemy(e);
      }
      t={x,y};this.sparks((x+.5)*TILE,(y+.5)*TILE,'#7cf6f2',5);
    }
    const end=center(t.x,t.y);p.x=end.x;p.y=end.y;w.enemies=w.enemies.filter(e=>!e.dead);
    this.say('창 돌진! 이번 층 사용 완료',2);this.sound('dash');return true;
  }
  onStep(){
    const p=this.player,w=this.world,t=pt(p.x,p.y);
    for(let i=w.pickups.length-1;i>=0;i--){
      const item=w.pickups[i],it=pt(item.x,item.y);
      if(!at(t,it))continue;
      if(item.type==='gem'){w.pickups.splice(i,1);p.gems+=1;this.score+=10;this.addXP(1);this.sound('coin');continue;}
      const payload=item.type==='weapon'?makeWeapon(item.weapon||'sword',item.level||1):makeItem(item.type==='shield'?'amulet':item.type);
      if(addSlot(p,payload)){w.pickups.splice(i,1);this.syncInventory();this.say('아이템 획득: '+(payload.type==='weapon'?spec[payload.id]?.name:payload.type),2);this.sound('coin');}
      else this.say('가방이 가득 찼습니다.',1);
    }
    const tile=w.tiles[t.y*w.w+t.x];
    if(this.tutorial&&tile===T.STAIRS)this.say('노란 출구입니다. Enter를 누르세요.',1.4);
    if(!this.tutorial&&tile===T.STAIRS){
      if(w.boss){if(w.bossDefeated)this.advance(1);else this.say('보스를 먼저 처치해야 합니다.',2);}
      else this.openShop();
    }
  }
  interact(){
    if(this.mode!=='playing')return false;
    const p=this.player,w=this.world,t=pt(p.x,p.y);
    const tile=w.tiles[t.y*w.w+t.x];
    if(this.tutorial&&tile===T.STAIRS){this.advance(1);return true;}
    if(tile===T.STAIRS){if(w.boss&&!w.bossDefeated)return false;this.advance(1);return true;}
    if(tile!==T.ELEVATOR&&tile!==T.BROKEN){this.say('엘리베이터 위에서 E를 누르세요.',2);return false;}
    if([9,19].includes(w.floor)){this.say('이 층의 엘리베이터는 작동하지 않습니다.',2);return false;}
    if(p.gems<5){this.say('엘리베이터에는 보석 5개가 필요합니다.',2);return false;}
    p.gems-=5;
    if(tile===T.BROKEN){this.damagePlayer(Math.floor(p.hp/2));if(this.mode!=='playing')return false;}
    this.advance(1);return true;
  }
  offerPool(){
    const p=this.player,pool=[];
    for(let i=0;i<9;i++)pool.push({type:'potion'});
    if(this.world.floor===4){for(let i=0;i<50;i++)pool.push({type:'ticket'});}
    else if(this.rng.rand()<.01)pool.push({type:'ticket'});
    if(this.rng.rand()<.05)pool.push({type:'amulet'});
    for(const id of keys){
      const count=owned(p,id)?3:1;
      for(let i=0;i<count;i++)pool.push({type:'weapon',id});
    }
    if(p.petCount<4&&this.rng.rand()<.15)pool.push({type:'pet'});
    const offers=[];
    while(offers.length<3&&pool.length){
      const i=this.rng.int(0,pool.length-1);
      offers.push(pool.splice(i,1)[0]);
    }
    return [...offers,{type:'maxhp'}];
  }
  openShop(){
    if(this.shopFloor!==this.world.floor){
      this.shopFloor=this.world.floor;this.shopOffers=this.offerPool();this.shopSold=[false,false,false,false];
    }
    this.setMode('shop');this.say('층 출구 상점 · 물건을 구매하거나 다음 층으로',3);
  }
  buy(index){
    if(this.mode!=='shop')return false;
    const n=Number(index),offer=this.shopOffers[n],p=this.player;
    if(!offer||this.shopSold[n])return false;
    const id=offer.type==='weapon'?offer.id:offer.type;
    const cost=price[id]??12;
    if(p.gems<cost){this.say('보석이 부족합니다.',2);return false;}
    if(offer.type==='weapon'){
      const old=p.slots.find(x=>x?.type==='weapon'&&x.id===offer.id);
      if(!old&&!addSlot(p,makeWeapon(offer.id,1))){this.say('가방이 가득 찼습니다.',2);return false;}
      if(old)old.level++;
    }else if(['potion','ticket','amulet'].includes(offer.type)){
      if(!addSlot(p,makeItem(offer.type))){this.say('가방이 가득 찼습니다.',2);return false;}
    }else if(offer.type==='pet'){p.petCount=Math.min(4,p.petCount+1);}
    else if(offer.type==='maxhp'){p.maxHpBonus+=.1;this.recomputeHp();}
    p.gems-=cost;this.shopSold[n]=true;this.syncInventory();
    this.say('구매 완료',2);this.sound('buy');return true;
  }
  closeShop(){
    if(this.mode==='shop')this.advance(1);
  }
  advance(n=1){
    const next=this.tutorial?1:this.world.floor+n;
    if(next>20){this.end(true);return;}
    this.tutorial=false;this.world=generateFloor(next,this.seed);
    const w=this.world,p=this.player;const isBoss=next===10||next===20;
    for(const e of w.enemies){
      const originalKind={hound:'wanderer',spider:'wanderer',sentinel:'digger'};
      e.kind=originalKind[e.kind]||e.kind;
      e.moveAcc=this.rng.rand()*.34;e.cd=this.rng.rand()*.35;e.see=0;e.slow=0;
      e.hp=e.maxHp=e.kind.startsWith('boss')?(next===10?72:96):1;
      e.damage=e.kind==='sniper'?1+Math.floor((next-1)/7):1+Math.floor((next-1)/3);
      e.r=e.kind.startsWith('boss')?14:10;
      e.bossPhase='idle';e.bossTimer=0;e.bossSteps=0;e.bossDir={x:0,y:0};e.summon1=false;e.summon2=false;
    }
    w.enemies=w.enemies.filter(e=>isBoss?e.kind.startsWith('boss'):!e.kind.startsWith('boss'));
    if(isBoss){
      const boss=w.enemies.find(e=>e.kind.startsWith('boss'));
      if(boss){const dest=center(Math.floor(w.w/2),5);boss.x=dest.x;boss.y=dest.y;}
    }
    p.x=(w.start.x+.5)*TILE;p.y=(w.start.y+.5)*TILE;
    p.dashUsed=false;p.invuln=.5;p.dash=0;p.dashCd=0;p.attackCd=0;
    p.maxFloor=Math.max(next,p.maxFloor);
    if(next!==1){this.score+=200;this.addXP(10);}
    this.shopFloor=null;this.shopOffers=[];this.shopSold=[];
    this.flow=null;this.flowTimer=0;this.visionTimer=0;this.visionTile='';
    refreshVision(w,p.x,p.y,13);
    this.say(next===10?'10층 · 메가 스파이더':next===20?'20층 · 최종 보스':next+'층에 진입했습니다.',4);
    this.notify('floor',{floor:next});
    this.notify('autosave',{floor:next});
    this.setMode('playing');
  }
  enemyStep(e){
    const w=this.world,p=this.player,from=pt(e.x,e.y),target=pt(p.x,p.y);
    // Once per discrete monster action, choose the nearest reachable adjacent tile.
    let best=null,bestScore=Infinity;
    for(const [dx,dy] of DIRS){
      const nx=from.x+dx,ny=from.y+dy;
      if(nx===target.x&&ny===target.y){
        this.damagePlayer(e.damage);
        const kb={x:target.x+dx,y:target.y+dy};
        if(safeTile(w,kb.x,kb.y)){const c=center(kb.x,kb.y);p.x=c.x;p.y=c.y;}
        return;
      }
      if(!safeTile(w,nx,ny)){
        if(e.kind==='digger'&&nx>0&&ny>0&&nx<w.w-1&&ny<w.h-1&&w.tiles[ny*w.w+nx]===T.RUBBLE){
          w.tiles[ny*w.w+nx]=T.FLOOR;this.sparks((nx+.5)*TILE,(ny+.5)*TILE,'#ccb79a',12);
        }
        continue;
      }
      const candidate={x:nx,y:ny},sc=D(candidate,target)+this.rng.rand()*.04;
      if(sc<bestScore){bestScore=sc;best=candidate;}
    }
    if(best){const c=center(best.x,best.y);e.x=c.x;e.y=c.y;}
  }
  shooterTick(e,dt){
    const w=this.world,p=this.player;
    const visible=w.visible[Math.floor(e.y/TILE)*w.w+Math.floor(e.x/TILE)]&&
      lineOfSight(w,e.x,e.y,p.x,p.y);
    if(e.kind==='witch'){
      if(visible)e.see=(e.see||0)+dt;
      else e.see=0;
      if(e.see>=4){
        e.see=0;
        for(let i=0;i<2;i++){
          for(let tries=0;tries<30;tries++){
            const pos=pt(e.x,e.y),x=pos.x+this.rng.int(-2,2),y=pos.y+this.rng.int(-2,2);
            if(safeTile(w,x,y)){const c=center(x,y);w.enemies.push({kind:'wanderer',x:c.x,y:c.y,r:10,hp:1,maxHp:1,
              damage:1+Math.floor((w.floor-1)/3),moveAcc:0,cd:0,hit:0,teleport:0});break;}
          }
        }
        this.say('마녀가 망령 2마리를 소환했습니다.',2);
      }
    }
    e.cd-=dt;
    if(visible&&e.cd<=0){
      e.cd=e.kind==='witch'?TIMES.witch:TIMES.sniper;
      this.world.effects.push({x:e.x,y:e.y,life:.28,max:.28,type:'ring',radius:0,
        color:e.kind==='witch'?'#c77dff':'#ff7f9a'});
      this.damagePlayer(e.damage);
      this.sound('enemyShoot');
    }
  }
  bossTick(e,dt){
    const w=this.world,p=this.player;
    e.bossTimer+=dt;const t=pt(e.x,e.y),target=pt(p.x,p.y);
    const bossRange=Math.max(0,1-e.hp/e.maxHp);
    if(e.bossPhase==='idle'){
      if(e.bossTimer>=1.3-.88*Math.pow(bossRange,.85)){
        e.bossPhase='blink';e.bossTimer=0;e.blinkCount=0;
      }
    }else if(e.bossPhase==='blink'){
      if(e.bossTimer>=.09){
        e.blinkCount++;e.bossTimer=0;
        if(e.blinkCount>=5){
          e.bossPhase='dash';e.bossSteps=14;
          e.bossDir=Math.abs(target.x-t.x)>=Math.abs(target.y-t.y)?
            {x:Math.sign(target.x-t.x),y:0}:{x:0,y:Math.sign(target.y-t.y)};
        }
      }
    }else if(e.bossPhase==='dash'){
      while(e.bossTimer>=.026&&e.bossSteps>0){
        e.bossTimer-=.026;e.bossSteps--;
        const q=pt(e.x,e.y),xx=q.x+e.bossDir.x,yy=q.y+e.bossDir.y;
        const blocks=[{x:xx,y:yy},{x:xx-1,y:yy-1},{x:xx+1,y:yy-1},
          {x:xx-1,y:yy+1},{x:xx+1,y:yy+1}];
        if(!blocks.every(a=>a.x>1&&a.y>1&&a.x<w.w-2&&a.y<w.h-2&&w.tiles[a.y*w.w+a.x]!==T.WALL)){
          e.bossSteps=0;break;
        }
        const c=center(xx,yy);e.x=c.x;e.y=c.y;
        for(const b of blocks)if(w.tiles[b.y*w.w+b.x]===T.RUBBLE)w.tiles[b.y*w.w+b.x]=T.FLOOR;
      }
      if(e.bossSteps<=0){e.bossPhase='recover';e.bossTimer=0;}
    }else if(e.bossPhase==='recover'&&e.bossTimer>.3){e.bossPhase='idle';e.bossTimer=0;}
    if(this.bossTiles(e).some(q=>at(q,pt(p.x,p.y))))this.damagePlayer(2);
    if(!e.summon1&&e.hp<=e.maxHp*.66){e.summon1=true;this.spawnMinions(e,4);}
    if(!e.summon2&&e.hp<=e.maxHp*.33){e.summon2=true;this.spawnMinions(e,4);}
  }
  spawnMinions(boss,n){
    const w=this.world,base=pt(boss.x,boss.y);
    for(let i=0;i<n;i++)for(let j=0;j<50;j++){
      const x=base.x+this.rng.int(-6,6),y=base.y+this.rng.int(-6,6);
      if(safeTile(w,x,y)){const c=center(x,y);w.enemies.push({kind:'wanderer',x:c.x,y:c.y,r:10,hp:1,maxHp:1,
        damage:1+Math.floor((w.floor-1)/3),moveAcc:0,cd:0,hit:0,teleport:0});break;}
    }
    this.say('보스가 망령을 소환했습니다.',2);
  }
  tick(dt,input={}){
    dt=clamp(Number(dt)||0,0,.04);
    this.anim+=dt;if(this.mode!=='playing')return;
    this.elapsed+=dt;this.time+=dt;
    const p=this.player,w=this.world;
    p.attackCd=Math.max(0,p.attackCd-dt);p.invuln=Math.max(0,p.invuln-dt);
    p.dash=Math.max(0,p.dash-dt);this.moveCd=Math.max(0,this.moveCd-dt);
    this.flash=Math.max(0,this.flash-dt);this.shake=Math.max(0,this.shake-dt);
    this.attackFlash=Math.max(0,this.attackFlash-dt);
    for(const e of w.effects){e.life-=dt;if(e.type==='spark'){e.x+=e.vx*dt;e.y+=e.vy*dt;}}
    w.effects=w.effects.filter(e=>e.life>0);
    for(const m of this.messages)m.life-=dt;
    this.messages=this.messages.filter(m=>m.life>0);
    if(input.dash)this.dash();
    if(input.potion)this.usePotion();
    if(input.interact)this.interact();
    if(this.mode!=='playing')return;
    if(input.attack)this.attack();
    if(this.mode!=='playing')return;
    // Cardinal one-tile steps; no diagonal movement.
    let dx=0,dy=0;
    if(Math.abs(input.moveX||0)>.18)dx=Math.sign(input.moveX);
    else if(Math.abs(input.moveY||0)>.18)dy=Math.sign(input.moveY);
    if((dx||dy)&&this.moveCd<=0){
      p.facing=dx===1?0:dx===-1?Math.PI:dy===1?Math.PI/2:Math.PI*1.5;
      const t=pt(p.x,p.y),nx=t.x+dx,ny=t.y+dy;
      if(safeTile(w,nx,ny)){const c=center(nx,ny);p.x=c.x;p.y=c.y;}
      this.moveCd=TIMES.player;p.walk+=1.1;this.onStep();
    }
    if(this.mode!=='playing')return;
    refreshVision(w,p.x,p.y,13);
    if(this.tutorial)return;
    for(const e of [...w.enemies]){
      if(e.dead)continue;
      e.hit=Math.max(0,(e.hit||0)-dt);
      if(e.kind.startsWith('boss')){this.bossTick(e,dt);continue;}
      e.moveAcc=(e.moveAcc||0)+dt*(e.slow>0?.70:1);
      if(e.kind==='sniper'||e.kind==='witch')this.shooterTick(e,dt);
      if(this.mode!=='playing')return;
      if(e.moveAcc>=TIMES.monster){
        e.moveAcc-=TIMES.monster;
        if(e.kind!=='sniper'||this.rng.rand()>=.55)this.enemyStep(e);
      }
    }
    w.enemies=w.enemies.filter(e=>!e.dead);
    p.petCd=Math.max(0,p.petCd-dt);
    if(p.petCount>0&&p.petCd===0){
      let e=null,near=11*TILE;
      for(const monster of w.enemies){
        if(monster.dead)continue;
        const d=dist(p,monster);
        if(d<near){near=d;e=monster;}
      }
      if(e){
        e.hp-=.1;e.slow=1.6;
        this.sparks(e.x,e.y,'#ffe4a1',12);
        p.petCd=p.petCount>=2?.65:.9;
        if(e.hp<=0){this.killEnemy(e);w.enemies=w.enemies.filter(q=>!q.dead);}
      }
    }
    for(const e of w.enemies)e.slow=Math.max(0,(e.slow||0)-dt);
  }
  usePotion(){
    const index=this.player.slots.findIndex(i=>i?.type==='potion'||i?.type==='cheap');
    return index<0?false:this.useSlot(index);
  }
  burst(){return false;} // Spirit burst is not an original mechanic.
  interactHint(){
    if(this.mode!=='playing')return '';
    const w=this.world,p=this.player,t=pt(p.x,p.y),tile=status(w,p);
    if(this.tutorial&&tile===T.STAIRS)return '[ENTER] 튜토리얼 완료';
    if(tile===T.ELEVATOR||tile===T.BROKEN)return '[E] 엘리베이터 · 보석 5개';
    if(tile===T.STAIRS)return w.boss&&!w.bossDefeated?'보스를 먼저 처치하세요':'계단 · 다음 층 상점';
    return this.tutorial?'노란 출구로 이동':'';
  }
  serialize(){
    return JSON.stringify({version:1,seed:this.seed,player:this.player,world:serializeWorld(this.world),
      tutorial:this.tutorial,elapsed:this.elapsed,kills:this.kills,score:this.score,time:this.time,
      shopFloor:this.shopFloor,shopOffers:this.shopOffers,shopSold:this.shopSold});
  }
  restore(raw){
    try{
      const data=JSON.parse(raw);
      if(data.version!==1||!data.player?.slots||!data.world)throw Error('Invalid save');
      this.seed=data.seed>>>0;this.rng=makeRng(this.seed);
      if(data.tutorial){
        const w=tutorialWorld(this.seed);
        w.tiles=Uint8Array.from(data.world.tiles||[]);
        w.pickups=data.world.pickups||[];
        w.seen=Uint8Array.from(data.world.seen||[]);
        if(w.tiles.length!==w.w*w.h)throw Error('bad tutorial tiles');
        if(w.seen.length!==w.w*w.h)w.seen=new Uint8Array(w.w*w.h);
        this.world=w;
      }else this.world=restoreWorld(data.world);
      this.player=data.player;
      this.tutorial=!!data.tutorial;this.elapsed=data.elapsed||0;
      this.kills=data.kills||0;this.score=data.score||0;this.time=data.time||0;
      this.shopFloor=data.shopFloor;this.shopOffers=data.shopOffers||[];
      this.shopSold=data.shopSold||[];this.runEnded=false;this.mode='playing';
      this.flow=null;this.flowTimer=0;this.moveCd=0;this.messages=[];
      this.syncInventory();refreshVision(this.world,this.player.x,this.player.y,13);
      this.notify('mode',{mode:'playing'});return true;
    }catch{return false;}
  }
  summary(){return {...super.summary(),floor:this.world.floor||0};}
}