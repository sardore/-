// Shared mechanics primitives for the original-rule Pygame port.
// Weapon and enemy balance are defined ONLY in classic/rules.js.
// Visual RGB is defined ONLY in retro/palette.js.
export const TILE = 30;
export const MAX_FLOOR = 20;
export const T = Object.freeze({
  WALL:0,FLOOR:1,RUBBLE:2,GLASS:3,DOOR:4,STAIRS:5,
  ELEVATOR:6,BROKEN:7,SHOP:8,WATER:9,WEB:10,TUTOR_EXIT:11
});
export function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
export function makeRng(seed=1){
  let x=(Number(seed)>>>0)||0x9e3779b9;
  function rand(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
  return {
    rand,
    int:(a,b)=>Math.floor(a+rand()*(b-a+1)),
    pick:items=>items[Math.floor(rand()*items.length)],
    chance:p=>rand()<p,
    get state(){return x>>>0;}
  };
}
export function formatTime(seconds){
  const s=Math.max(0,Math.floor(seconds));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
