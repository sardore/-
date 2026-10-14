/* 기체 그리기: 외형 파라미터(look)만으로 절차적으로 그린다. 비행 불꽃·날개·포드·패널·포·가시·링·드론 */
import { PI, TAU } from './util.js';
import { drawOpsShip } from './ops-ship-art.js';

/** 티어별 크기 배율 */
export const SHIP_SC=[0,1,1.35,1.75,2.2];
const HALF={dart:[[11,0],[4,1.8],[-3,3],[-7.5,2],[-7.5,0]],hull:[[10.5,0],[7,3.2],[1,5.2],[-8,5.2],[-9,0]],scout:[[10,0],[3.5,2.3],[-5,2.6],[-7,1.6],[-7,0]]};
/** o(선택): 상점 꾸밈 {fh,fs: 엔진 불꽃 색상·채도, art: 기체 전용 장식을 덧그리는 함수} */
export function drawShip(c,d,flame,tm,scMul,o){
  const L=d.L,sc=SHIP_SC[d.t]*(scMul||1),h=L.h,fh=o&&o.fh!=null?o.fh:h+10,fsa=o&&o.fs!=null?o.fs:100;
  if(L.ops){drawOpsShip(c,d,flame,tm,sc,o);return}   // 블랙쉽 기체는 따로 그린다
  c.save();c.scale(sc,sc);c.lineJoin='round';
  const lite='hsl('+h+',35%,95%)',mid='hsl('+h+',45%,72%)',dark='hsl('+h+',50%,36%)',acc='hsl('+h+',95%,66%)';
  const fl=(x,y,len,w)=>{const gr=c.createLinearGradient(x,0,x-len,0);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(.35,'hsla('+fh+','+fsa+'%,70%,.8)');gr.addColorStop(1,'hsla('+fh+','+fsa+'%,60%,0)');c.fillStyle=gr;c.beginPath();c.moveTo(x,y-w);c.lineTo(x-len,y);c.lineTo(x,y+w);c.closePath();c.fill()};
  const fk=.25+.75*(flame||0);
  if(L.arrow){
    fl(-4,0,4+6*fk*(1+.2*Math.sin(tm*40)),1.5);
    c.fillStyle='#fff';c.beginPath();c.moveTo(10,0);c.lineTo(-7,6);c.lineTo(-3,0);c.lineTo(-7,-6);c.closePath();c.fill();c.restore();return;
  }
  const wide=L.kind==='hull'?1.25:1,E=L.engines||1,ex=L.kind==='dart'?-7.5:-8.5;
  const ys=E===1?[0]:E===2?[-2.6,2.6]:E===3?[-4,0,4]:[-5.2,-1.8,1.8,5.2];
  ys.forEach((y,i)=>fl(ex,y*wide,(3+6.5*fk)*(1+.25*Math.sin(tm*38+i*2)),1.3));
  if(L.halo){const gr=c.createRadialGradient(0,0,4,0,0,19);gr.addColorStop(0,'hsla('+h+',100%,70%,.0)');gr.addColorStop(.7,'hsla('+h+',100%,70%,.22)');gr.addColorStop(1,'hsla('+h+',100%,70%,0)');c.fillStyle=gr;c.beginPath();c.arc(0,0,19,0,TAU);c.fill()}
  c.lineWidth=.9;
  // 태양광 패널
  if(L.panels){for(const sg of[-1,1]){c.strokeStyle=dark;c.lineWidth=.8;c.beginPath();c.moveTo(-1,sg*2.5);c.lineTo(-1,sg*7);c.stroke();
    c.fillStyle='hsl(218,65%,36%)';c.strokeStyle='hsl(205,90%,75%)';c.lineWidth=.7;c.beginPath();c.rect(-5.5,sg>0?7:-14.5,8.5,7.5);c.fill();c.stroke();
    c.beginPath();c.moveTo(-2.7,sg>0?7:-14.5);c.lineTo(-2.7,sg>0?14.5:-7);c.moveTo(.1,sg>0?7:-14.5);c.lineTo(.1,sg>0?14.5:-7);c.moveTo(-5.5,sg>0?10.7:-11);c.lineTo(3,sg>0?10.7:-11);c.stroke()}}
  // 날개
  for(let i=0;i<(L.fins||0);i++){const x0=2.5-i*4.4,w=(L.kind==='hull'?6.5:7.5)+i*2.3;
    for(const sg of[-1,1]){c.fillStyle=mid;c.strokeStyle=dark;c.beginPath();c.moveTo(x0,sg*2.6);c.lineTo(x0-10-i*1.6,sg*w);c.lineTo(x0-6.5,sg*2.6);c.closePath();c.fill();c.stroke();
      c.strokeStyle=acc;c.lineWidth=.6;c.beginPath();c.moveTo(x0-3,sg*3.2);c.lineTo(x0-9.5-i*1.6,sg*(w-.5));c.stroke();c.lineWidth=.9}}
  // 포드
  for(let i=0;i<(L.pods||0);i++){const y=6.2+i*3.6;
    for(const sg of[-1,1]){c.strokeStyle=dark;c.lineWidth=1;c.beginPath();c.moveTo(-1,sg*(y-3));c.lineTo(-1,sg*y);c.stroke();
      c.fillStyle=mid;c.beginPath();c.moveTo(3,sg*(y-1.3));c.lineTo(-6,sg*(y-1.3));c.lineTo(-7,sg*y);c.lineTo(-6,sg*(y+1.3));c.lineTo(3,sg*(y+1.3));c.lineTo(5,sg*y);c.closePath();c.fill();c.stroke();
      c.fillStyle=acc;c.beginPath();c.arc(3.4,sg*y,.8,0,TAU);c.fill();fl(-7,sg*y,3+4*fk,.8)}}
  // 선체
  const half=HALF[L.kind],pts=half.concat(half.slice(1,-1).reverse().map(q=>[q[0],-q[1]]));
  const wd=L.kind==='hull'?5.4:3.4,gr=c.createLinearGradient(0,-wd,0,wd);gr.addColorStop(0,lite);gr.addColorStop(.55,mid);gr.addColorStop(1,dark);
  c.fillStyle=gr;c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.8;c.beginPath();pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();c.fill();c.stroke();
  for(let i=0;i<(L.plates||0);i++){c.strokeStyle='hsla('+h+',60%,25%,.8)';c.lineWidth=1;c.beginPath();c.moveTo(5.5-i*3.6,-wd*.7);c.lineTo(7.5-i*3.6,0);c.lineTo(5.5-i*3.6,wd*.7);c.stroke()}
  // 포·가시
  if(L.cannons){const n=L.cannons;for(let j=0;j<n;j++){const y=n===1?0:(j?2.8:-2.8);c.fillStyle=dark;c.fillRect(3,y-.7,9.5,1.4);c.fillStyle=acc;c.fillRect(11.5,y-.8,1.4,1.6)}}
  if(L.spike){c.fillStyle=lite;c.strokeStyle=acc;c.lineWidth=.8;c.beginPath();c.moveTo(10,-1.8);c.lineTo(20,0);c.lineTo(10,1.8);c.closePath();c.fill();c.stroke()}
  if(L.dish){c.strokeStyle=dark;c.lineWidth=.8;c.beginPath();c.moveTo(2,-2.4);c.lineTo(2,-6);c.stroke();c.strokeStyle=acc;c.lineWidth=1.2;c.beginPath();c.arc(3.5,-6.2,3.2,-PI/2,PI/2,false);c.stroke();c.fillStyle=acc;c.beginPath();c.arc(3.5,-6.2,.8,0,TAU);c.fill()}
  if(L.ring){c.strokeStyle='hsla('+h+',100%,72%,.7)';c.lineWidth=.9;c.beginPath();c.ellipse(0,0,13,8.5,0,0,TAU);c.stroke();const a=tm*2;c.fillStyle=acc;c.beginPath();c.arc(Math.cos(a)*13,Math.sin(a)*8.5,1.1,0,TAU);c.arc(Math.cos(a+PI)*13,Math.sin(a+PI)*8.5,1.1,0,TAU);c.fill()}
  c.fillStyle=acc;c.beginPath();c.ellipse(3,0,2.7,1.5,0,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.ellipse(3.7,-.4,1,.5,0,0,TAU);c.fill();
  for(let i=0;i<(L.drones||0);i++){const a=tm*(1.6+i*.4)+i*TAU/(L.drones),r=15+i*1.5;c.fillStyle=acc;c.beginPath();c.arc(Math.cos(a)*r,Math.sin(a)*r*.7,1.5,0,TAU);c.fill()}
  if(o&&o.art)o.art(c,tm,L,h);
  c.restore();
}
