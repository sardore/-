// The Ghost City: Reborn — shared deterministic data and helpers.
export const TILE = 32;
export const MAP_W = 62;
export const MAP_H = 38;
export const MAX_FLOOR = 20;
export const T = Object.freeze({ WALL:0, FLOOR:1, RUBBLE:2, GLASS:3, DOOR:4, STAIRS:5, ELEVATOR:6, BROKEN:7, SHOP:8, WATER:9, WEB:10 });
export const BLOCKED = new Set([T.WALL,T.RUBBLE,T.GLASS]);
export const WEAPONS = Object.freeze({
  sword:{id:'sword',name:'유령검',eng:'PHANTOM BLADE',power:15,rate:.38,range:68,arc:1.8,knock:80,color:'#94e7ff',icon:'⚔',description:'빠른 근접 연속 공격'},
  spear:{id:'spear',name:'영혼창',eng:'SOUL LANCE',power:21,rate:.59,range:114,arc:.59,knock:145,color:'#85f8d9',icon:'♜',description:'좁지만 긴 관통 찌르기'},
  axe:{id:'axe',name:'그림자 도끼',eng:'SHADE AXE',power:35,rate:.82,range:76,arc:2.2,knock:185,color:'#ffb56a',icon:'◆',description:'느리지만 강력한 광역 공격'},
  hammer:{id:'hammer',name:'묘지 파쇄기',eng:'GRAVE HAMMER',power:49,rate:1.14,range:73,arc:2.0,knock:225,color:'#f8cc8c',icon:'✦',description:'가구까지 부수는 충격파'},
  crossbow:{id:'crossbow',name:'월광 석궁',eng:'MOON CROSSBOW',power:17,rate:.46,range:380,arc:.1,knock:55,color:'#cf9cff',icon:'➶',description:'사거리가 긴 원거리 무기'}
});
export const ENEMIES = Object.freeze({
  wanderer:{name:'배회자',hp:31,speed:64,damage:1,range:24,attack:1.05,score:45,color:'#a3b4cc'},
  hound:{name:'망령 사냥개',hp:22,speed:106,damage:1,range:23,attack:1.0,score:55,color:'#fe8e9c'},
  sniper:{name:'폐허의 저격수',hp:28,speed:51,damage:1,range:250,attack:2.35,score:80,color:'#e5a3e8'},
  digger:{name:'굴착 망령',hp:48,speed:48,damage:2,range:25,attack:1.45,score:100,color:'#e2ac82'},
  witch:{name:'심연의 마녀',hp:40,speed:53,damage:2,range:235,attack:2.1,score:125,color:'#c69aff'},
  spider:{name:'늪거미',hp:26,speed:87,damage:1,range:23,attack:1.15,score:85,color:'#b6ee89'},
  sentinel:{name:'검은 수문장',hp:92,speed:42,damage:2,range:34,attack:1.85,score:150,color:'#ff9e7b'}
});
export const PERKS = Object.freeze([
  {id:'blood',name:'피의 서약',desc:'최대 체력 +2 및 체력 2 회복',color:'#fa8da2'},
  {id:'steel',name:'강화된 영혼',desc:'모든 무기 피해량 +18%',color:'#fbd09b'},
  {id:'rush',name:'재빠른 발',desc:'이동 속도 +12%, 대시 재사용 -10%',color:'#79e9f2'},
  {id:'fortune',name:'보석의 축복',desc:'보석 획득량 +35%',color:'#badb8a'},
  {id:'guard',name:'보호의 룬',desc:'받는 피해 -15%, 대시 무적 +0.08초',color:'#b3adff'},
  {id:'vamp',name:'생명의 잔향',desc:'적 처치 시 15% 확률로 체력 1 회복',color:'#f5a2cf'},
  {id:'fury',name:'검술의 달인',desc:'무기 공격 간격 -12%',color:'#e6b2ff'},
  {id:'hunter',name:'사냥꾼의 직감',desc:'치명타 확률 +9%',color:'#f7d27a'}
]);
export const SHOP = Object.freeze([
  {id:'heal',name:'응급 치료',desc:'체력 4 회복',cost:7,icon:'+'},
  {id:'heart',name:'심장 조각',desc:'최대 체력 +1, 체력 회복',cost:15,icon:'♥'},
  {id:'blade',name:'무기 제련',desc:'현재 무기 레벨 +1',cost:12,icon:'⚒'},
  {id:'potion',name:'치유 물약',desc:'휴대 물약 +1',cost:9,icon:'◉'},
  {id:'ward',name:'보호막 부적',desc:'보호막 +2',cost:12,icon:'✧'},
  {id:'crossbow',name:'월광 석궁',desc:'원거리 무기 해금',cost:18,icon:'➶'}
]);
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function makeRng(seed=1){
  let x=(Number(seed)>>>0)||0x9e3779b9;
  function rand(){x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
  return {rand,int:(a,b)=>Math.floor(a+rand()*(b-a+1)),pick:arr=>arr[Math.floor(rand()*arr.length)],chance:p=>rand()<p,get state(){return x>>>0;}};
}
export function chooseWeighted(rng,entries){
  const sum=entries.reduce((a,x)=>a+x[1],0);
  let roll=rng.rand()*sum;
  for(const [value,weight] of entries){roll-=weight;if(roll<=0)return value;}
  return entries[entries.length-1][0];
}
export function formatTime(seconds){const s=Math.max(0,Math.floor(seconds));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
