import test from 'node:test';
import assert from 'node:assert/strict';
import {bresenham,lineOfSight,refreshVision,tileAt,isSolid,buildFlow,isReachable} from '../js/world.js';
import {generateClassicFloor} from '../js/classic/map.js';
import {T,TILE} from '../js/config.js';

test('original line-of-sight is Bresenham and blocks only walls and furniture',()=>{
  const w={w:9,h:9,tiles:new Uint8Array(81),visible:new Uint8Array(81),seen:new Uint8Array(81)};
  w.tiles.fill(T.FLOOR);
  const p=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
  assert.deepEqual(bresenham(2,3,5,3),[[2,3],[3,3],[4,3],[5,3]]);
  assert.equal(lineOfSight(w,p(2,3).x,p(2,3).y,p(5,3).x,p(5,3).y),true);
  w.tiles[3*w.w+3]=T.WALL;
  assert.equal(lineOfSight(w,p(2,3).x,p(2,3).y,p(5,3).x,p(5,3).y),false);
  w.tiles[3*w.w+3]=T.GLASS;
  assert.equal(lineOfSight(w,p(2,3).x,p(2,3).y,p(5,3).x,p(5,3).y),true);
  w.tiles[3*w.w+3]=T.RUBBLE;
  assert.equal(lineOfSight(w,p(2,3).x,p(2,3).y,p(5,3).x,p(5,3).y),false);
});
test('original field-of-view is Euclidean radius with occlusion',()=>{
  const w={w:21,h:21,tiles:new Uint8Array(441),visible:new Uint8Array(441),seen:new Uint8Array(441)};
  w.tiles.fill(T.FLOOR);
  refreshVision(w,10.5*TILE,10.5*TILE,5);
  assert.equal(w.visible[10*w.w+15],1);
  assert.equal(w.visible[10*w.w+16],0);
  w.tiles[10*w.w+11]=T.WALL;
  refreshVision(w,10.5*TILE,10.5*TILE,5);
  assert.equal(w.visible[10*w.w+14],0);
  assert.equal(w.visible[10*w.w+10],1);
});
test('normal corridor map remains connected with seeded generation',()=>{
  for(let floor=1;floor<=20;floor++){
    const w=generateClassicFloor(floor,1000+floor);
    assert.equal(w.tiles.length,w.w*w.h);
    if(!w.boss){
      assert.ok(isReachable(w,w.start,w.stairs),'unreachable '+floor);
      const sx=(w.start.x+.5)*TILE,sy=(w.start.y+.5)*TILE;
      const flow=buildFlow(w,sx,sy);
      assert.equal(flow[w.start.y*w.w+w.start.x],0);
    }
  }
});
