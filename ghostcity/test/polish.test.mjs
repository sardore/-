import test from 'node:test';
import assert from 'node:assert/strict';
import {ClassicGame} from '../js/classic.js';
import {TILE} from '../js/config.js';

test('tutorial inventory correctly reports the starting cheap potion',()=>{
  const g=new ClassicGame();g.newRun(7);
  assert.equal(g.player.potions,1);
  assert.equal(g.player.slots.filter(Boolean).length,2);
});
test('staircase E action opens the original fixed shop instead of skipping it',()=>{
  const g=new ClassicGame();g.newRun(11);g.advance(1);
  const firstFloor=g.world.floor,stair=g.world.stairs;
  g.player.x=(stair.x+.5)*TILE;g.player.y=(stair.y+.5)*TILE;
  assert.equal(g.interact(),true);
  assert.equal(g.mode,'shop');
  assert.equal(g.world.floor,firstFloor);
  assert.equal(g.shopOffers.length,4);
});
test('floor transition checkpoints are emitted after playing mode is restored',()=>{
  let g,seen;
  g=new ClassicGame((type)=>{
    if(type==='floor')seen=JSON.parse(g.serialize());
  });
  g.newRun(6);g.advance(1);
  assert.ok(seen);
  assert.equal(seen.mode,'playing');
  assert.equal(seen.world.floor,1);
  assert.equal(seen.tutorial,false);
});
test('saved games continue the random sequence without rerolling outcomes',()=>{
  const g=new ClassicGame();g.newRun(812);
  for(let i=0;i<19;i++)g.rng.rand();
  const other=new ClassicGame();assert.equal(other.restore(g.serialize()),true);
  for(let i=0;i<25;i++)assert.equal(other.rng.rand(),g.rng.rand());
});
test('field of view only recalculates on tile movement or map edits',()=>{
  const g=new ClassicGame();g.newRun(31);
  const visible=g.world.visible;
  let recalculations=0;
  const originalFill=visible.fill.bind(visible);
  visible.fill=(...args)=>{recalculations++;return originalFill(...args);};
  for(let i=0;i<30;i++)g.tick(.016,{});
  assert.equal(recalculations,0,'idle animation must not recalculate FOV');
  g.tick(.016,{moveX:1});
  assert.equal(recalculations,1,'changing tile must refresh FOV');
  for(let i=0;i<30;i++)g.tick(.016,{});
  assert.equal(recalculations,1);
  g.visionDirty=true;g.tick(.016,{});
  assert.equal(recalculations,2,'terrain destruction must refresh FOV');
});
test('a legitimate hit produces readable floating damage without altering combat values',()=>{
  const g=new ClassicGame();g.newRun(90);
  g.player.facing=0;
  const enemy={kind:'wanderer',x:g.player.x+TILE,y:g.player.y,
    r:10,hp:20,maxHp:20,hit:0,damage:1,moveAcc:0};
  g.world.enemies=[enemy];
  const expected=g.weaponStats().power;
  assert.equal(g.attack(),true);
  assert.equal(enemy.hp,20-expected);
  const fx=g.world.effects.filter(e=>e.type==='text');
  assert.equal(fx.length,1);
  assert.ok(fx[0].text.includes(String(expected)));
  const y=fx[0].y;g.tick(.016,{});
  assert.ok(fx[0].y<y,'floating text must rise');
});
