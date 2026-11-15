import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassicGame} from '../js/classic.js';
import {T,TILE} from '../js/config.js';

function stage(seed=100){
  const game=new ClassicGame();
  game.newRun(seed);game.advance(1);return game;
}
test('original start is tutorial with exactly seven shared slots and spear Lv-3',()=>{
  const g=new ClassicGame();g.newRun(25);
  assert.equal(g.tutorial,true);
  assert.equal(g.world.w,40);assert.equal(g.world.h,22);
  assert.equal(g.player.hp,6);assert.equal(g.player.maxHp,6);
  assert.equal(g.player.slots.length,7);
  assert.equal(g.player.slots[0].type,'cheap');
  assert.deepEqual(g.player.slots[1],{type:'weapon',id:'spear',level:-3});
});
test('movement is discrete cardinal tile stepping, held movement waits 90ms',()=>{
  const g=new ClassicGame();g.newRun(8);
  const oldX=g.player.x,oldY=g.player.y;
  g.tick(.016,{moveX:1,moveY:1});
  assert.equal(g.player.x,oldX+TILE);
  assert.equal(g.player.y,oldY);
  g.tick(.016,{moveX:1});
  assert.equal(g.player.x,oldX+TILE);
  for(let i=0;i<6;i++)g.tick(.016,{moveX:1});
  assert.equal(g.player.x,oldX+2*TILE);
});
test('attacks cover exactly a line of cardinal grid tiles, no mouse aim',()=>{
  const g=stage(71),p=g.player;
  const w=g.world;w.enemies=[];
  const near={kind:'wanderer',x:p.x+2*TILE,y:p.y,r:10,hp:1,maxHp:1,damage:1,moveAcc:0,hit:0};
  const offAxis={kind:'wanderer',x:p.x,y:p.y+2*TILE,r:10,hp:1,maxHp:1,damage:1,moveAcc:0,hit:0};
  w.enemies=[near,offAxis];
  p.facing=0;assert.ok(g.attack());
  assert.ok(near.dead);
  assert.equal(offAxis.dead,undefined);
  assert.ok(g.atkTiles.every(t=>t.y===Math.floor(p.y/TILE)));
});
test('weapon upgrades reduce cooldown but keep base damage unchanged',()=>{
  const g=stage(85),p=g.player;
  const item=p.slots[1];
  const first=g.weaponStats();
  item.level=4;
  const second=g.weaponStats();
  assert.ok(second.rate<first.rate);
  assert.equal(second.power,first.power);
});
test('ordinary enemies use elapsed-time movement and stop during pause',()=>{
  const g=stage(177),w=g.world,p=g.player;
  const startX=p.x+3*TILE,startY=p.y;
  w.enemies=[{kind:'wanderer',x:startX,y:startY,r:10,hp:1,maxHp:1,
    damage:1,moveAcc:0,cd:3,slow:0,hit:0}];
  const oldX=w.enemies[0].x,oldY=w.enemies[0].y;
  g.tick(.04,{});
  assert.equal(w.enemies[0].x,oldX);assert.equal(w.enemies[0].y,oldY);
  for(let i=0;i<9;i++)g.tick(.04,{});
  assert.ok(w.enemies[0].x!==oldX||w.enemies[0].y!==oldY);
  g.setMode('paused');const x=w.enemies[0].x,y=w.enemies[0].y;
  for(let i=0;i<20;i++)g.tick(.04,{});
  assert.equal(w.enemies[0].x,x);assert.equal(w.enemies[0].y,y);
});
test('XP gain increases max HP every 25 XP, cap base 18',()=>{
  const g=stage(21);
  g.addXP(25);assert.equal(g.player.baseMaxHp,7);
  assert.equal(g.player.maxHp,7);
  g.addXP(1200);assert.equal(g.player.baseMaxHp,18);
});
test('stairs open a four-offer shop, always offering +10% max HP',()=>{
  const g=stage(992),w=g.world,p=g.player;
  p.x=(w.stairs.x+.5)*TILE;p.y=(w.stairs.y+.5)*TILE;
  g.onStep();assert.equal(g.mode,'shop');
  assert.equal(g.shopOffers.length,4);
  assert.deepEqual(g.shopOffers[3],{type:'maxhp'});
  p.gems=100;const oldMax=p.maxHp;
  assert.ok(g.buy(3));assert.ok(p.maxHp>oldMax);
  assert.equal(g.buy(3),false);
  g.closeShop();assert.equal(g.world.floor,2);
});
test('special spear dash requires level 3 and is limited to once per floor',()=>{
  const g=stage(202),p=g.player;
  assert.equal(g.dash(),false);
  p.slots[p.equippedSlot].level=3;
  p.facing=0;
  assert.equal(g.dash(),true);
  assert.equal(p.dashUsed,true);
  assert.equal(g.dash(),false);
});
test('elevator cost is five gems and broken elevators remove half current HP',()=>{
  const g=stage(103),p=g.player,w=g.world;
  const idx=w.tiles.findIndex(v=>v===T.BROKEN);
  if(idx<0)return;
  const x=idx%w.w,y=Math.floor(idx/w.w);
  p.x=(x+.5)*TILE;p.y=(y+.5)*TILE;p.gems=10;p.hp=6;p.invuln=0;
  assert.equal(g.interact(),true);
  assert.equal(p.gems,5);assert.equal(g.world.floor,2);
  assert.equal(p.hp,3);
});
test('10F and 20F boss health matches original source',()=>{
  const g=stage(41);
  g.world.floor=9;g.advance(1);
  assert.equal(g.world.enemies.find(e=>e.kind.startsWith('boss')).hp,72);
  g.world.floor=19;g.advance(1);
  assert.equal(g.world.enemies.find(e=>e.kind.startsWith('boss')).hp,96);
});
test('tutorial save and restore round-trip remains possible',()=>{
  const g=new ClassicGame();g.newRun(555);
  g.player.gems=4;const data=g.serialize();
  const second=new ClassicGame();
  assert.equal(second.restore(data),true);
  assert.equal(second.tutorial,true);
  assert.equal(second.player.gems,4);
  assert.equal(second.world.floor,0);
});
