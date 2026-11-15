// Original-rules game orchestration. Rendering and UI remain separate.
import {ClassicBase} from './classic/base.js';
import {TILE,makeRng,clamp} from './config.js';
import {refreshVision} from './world.js';
import {TIMES,dist,pt,center,makeWeapon,makeItem,safeTile,tutorialWorld} from './classic/rules.js';
import * as inventory from './classic/inventory.js';
import * as combat from './classic/combat.js';
import * as enemies from './classic/enemies.js';
import * as progression from './classic/progression.js';
import * as persistence from './classic/persistence.js';
import * as companions from './classic/companions.js';

export class ClassicGame extends ClassicBase {
  constructor(notify=()=>{}){
    super(notify);this.classic=true;this.mode='menu';this.tutorial=true;this.luck=.16;this.sniperWarnings=[];
    this.world=tutorialWorld(this.seed);this.player=this.makePlayer();this.shopOffers=[];
    this.shopSold=[];this.moveCd=0;this.attackFlash=0;this.atkTiles=[];this.floorEnding=false;
  }
  makePlayer(){
    const start=this.world?.start||{x:2,y:2};
    const p=center(start.x,start.y);
    return {x:p.x,y:p.y,r:10,hp:6,maxHp:6,shield:0,
      level:1,xp:0,xpNext:25,gems:0,potions:0,energy:0,
      weapon:'spear',inventory:['spear'],weaponLevels:{spear:-3},
      slots:[makeItem('cheap'),makeWeapon('spear',-3),null,null,null,null,null],
      equippedSlot:1,petCount:0,petCd:0,parry:0,moveCd:0,dashUsed:false,facing:Math.PI/2,
      inventoryCapacity:7,maxHpBonus:0,baseMaxHp:6,
      // Adapter fields for the shared UI.
      damageMult:1,speedMult:1,dashMult:1,guard:0,crit:0,luck:1,vamp:0,attackMult:1,
      dash:0,dashCd:0,invuln:0,attackCd:0,skillCd:0,walk:0,maxFloor:1,perks:[],kills:0,attackPulse:0};
  }
  activeSlot(){return inventory.activeSlot(this);}
  syncInventory(){return inventory.syncInventory(this);}
  newRun(seed=((Math.random()*4294967295)>>>0)){
    this.seed=seed>>>0;this.rng=makeRng(this.seed);
    this.world=tutorialWorld(this.seed);this.player=this.makePlayer();
    this.syncInventory();
    this.sniperWarnings=[];this.visionDirty=false;
    this.elapsed=0;this.kills=0;this.score=0;this.time=0;
    this.mode='playing';this.tutorial=true;this.floorEnding=false;
    this.shopOffers=[];this.shopSold=[];this.moveCd=0;this.attackFlash=0;this.atkTiles=[];
    this.flow=null;this.flowTimer=0;this.visionTimer=0;this.visionTile='';
    this.runEnded=false;this.shake=0;this.flash=0;this.slash=null;this.messages=[];
    refreshVision(this.world,this.player.x,this.player.y,13);
    this.visionTile='0:'+pt(this.player.x,this.player.y).x+':'+pt(this.player.x,this.player.y).y;
    this.say('튜토리얼: WASD 이동 · SPACE 직선 공격 · 노란 출구에서 ENTER',5);
    this.notify('start',{floor:0});
  }
  weapon(){return inventory.weapon(this);}
  weaponLevel(){return inventory.weaponLevel(this);}
  weaponStats(){return inventory.weaponStats(this);}
  setMode(mode){this.mode=mode;this.notify('mode',{mode});}
  changeWeapon(id){return inventory.changeWeapon(this,id);}
  cycleWeapon(dir=1){return inventory.cycleWeapon(this,dir);}
  useSlot(index){return inventory.useSlot(this,index);}
  dropSlot(index){return inventory.dropSlot(this,index);}
  addXP(amount){return progression.addXP(this,amount);}
  recomputeHp(){return progression.recomputeHp(this);}
  attack(){return combat.attack(this);}
  bossTiles(e){return combat.bossTiles(this,e);}
  killEnemy(e){return combat.killEnemy(this,e);}
  damagePlayer(amount){return combat.damagePlayer(this,amount);}
  dash(){return combat.dash(this);}
  onStep(){return progression.onStep(this);}
  interact(){return progression.interact(this);}
  offerPool(){return inventory.offerPool(this);}
  openShop(){return inventory.openShop(this);}
  buy(index){return inventory.buy(this,index);}
  closeShop(){return inventory.closeShop(this);}
  advance(n=1){return progression.advance(this,n);}
  confirmTutorial(){return progression.confirmTutorial(this);}
  continueMidBoss(){if(this.mode!=='midclear')return false;this.advance(1);return true;}
  finishMidBoss(){if(this.mode!=='midclear')return false;this.end(true);return true;}
  enemyStep(e){return enemies.enemyStep(this,e);}
  shooterTick(e,dt){return enemies.shooterTick(this,e,dt);}
  bossTick(e,dt){return enemies.bossTick(this,e,dt);}
  spawnMinions(boss,n){return enemies.spawnMinions(this,boss,n);}
  tick(dt,input={}){
    dt=clamp(Number(dt)||0,0,.04);
    this.anim+=dt;if(this.mode!=='playing')return;
    this.elapsed+=dt;this.time+=dt;
    const p=this.player,w=this.world;
    p.attackCd=Math.max(0,p.attackCd-dt);p.invuln=Math.max(0,p.invuln-dt);
    p.dash=Math.max(0,p.dash-dt);this.moveCd=Math.max(0,this.moveCd-dt);
    this.flash=Math.max(0,this.flash-dt);this.shake=Math.max(0,this.shake-dt);
    this.attackFlash=Math.max(0,this.attackFlash-dt);
    for(const warning of this.sniperWarnings)warning.life-=dt;
    this.sniperWarnings=this.sniperWarnings.filter(w=>w.life>0);
    for(const e of w.effects){
      e.life-=dt;
      if(e.type==='spark'){e.x+=e.vx*dt;e.y+=e.vy*dt;}
      else if(e.type==='text')e.y+=(e.vy??-26)*dt;
    }
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
    // Visibility depends on grid position and terrain, not animation frames.
    // Recompute only when the player changes tile or the map is modified.
    const position=pt(p.x,p.y);
    const visibleKey=w.floor+':'+position.x+':'+position.y;
    if(this.visionDirty||visibleKey!==this.visionTile){
      refreshVision(w,p.x,p.y,w.floor>=11?6:13);
      this.visionDirty=false;this.visionTile=visibleKey;
    }
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
    this.petTick(dt);
    for(const e of w.enemies)e.slow=Math.max(0,(e.slow||0)-dt);
  }
  petTick(dt){return companions.petTick(this,dt);}
  usePotion(){return inventory.usePotion(this);}
  burst(){return combat.burst(this);}
  interactHint(){return progression.interactHint(this);}
  serialize(){return persistence.serialize(this);}
  restore(raw){return persistence.restore(this,raw);}
  summary(){return {...super.summary(),floor:this.world.floor||0};}
}
