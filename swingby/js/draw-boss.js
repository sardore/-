/* 보스·공격 예고·존·블랙홀·항성풍 그리기 (논리 상태는 읽기만 한다) */
import { G, V, g } from './state.js';
import { W, PI, TAU, rnd, clamp, hexA, easeOut } from './util.js';
import { ATK } from './data.js';
import { txt } from './gfx.js';

export function drawBoss(b){
  const d=b.d,R=b.R,h=d.hue,k=d.kind,col=d.col;
  let sc=1;if(b.state==='intro')sc=easeOut(b.st/1.8);
  const pulse=k==='pulse'?1+.06*Math.sin(G.T*3.2):(k==='super'||k==='eta')?1+.03*Math.sin(G.T*2):1;
  sc*=pulse;const dy=b.state==='dying';
  g.save();g.translate(b.x+(dy?rnd(-4,4):0),b.y+(dy?rnd(-4,4):0));g.scale(sc*(1+.1*b.sq),sc*(1-.1*b.sq));
  if(dy)g.globalAlpha=clamp(1-(b.st-1.6)/1,0,1);
  const gr=k==='giant'?3.4:k==='quasar'?3:2.5;
  const gl=g.createRadialGradient(0,0,R*.5,0,0,R*gr);
  gl.addColorStop(0,'hsla('+h+',95%,'+(k==='quasar'?'55':'60')+'%,'+(k==='quasar'?.35:.5)+')');gl.addColorStop(1,'hsla('+h+',95%,60%,0)');
  g.fillStyle=gl;g.beginPath();g.arc(0,0,R*gr,0,TAU);g.fill();
  if(b.cast>0){const kc=b.cast/.9,cc=G.castO?G.castO.c:'#fff';g.strokeStyle=hexA(cc.length===7?cc:'#ffffff',.8*(1-kc*.6));g.lineWidth=3+4*(1-kc);g.beginPath();g.arc(0,0,R*(1.1+1.9*kc),0,TAU);g.stroke();g.strokeStyle='rgba(255,255,255,'+.6*(1-kc)+')';g.lineWidth=2;g.beginPath();g.arc(0,0,R*(1.05+.9*kc),0,TAU);g.stroke()}
  if(k==='quasar'){drawQuasar(b,R);g.restore();return}
  // 코로나 / 스파이크
  g.lineCap='round';
  if(k==='eta'){ // 호문쿨루스: 위아래로 부풀어 오른 쌍엽 성운
    for(const sg of[-1,1]){const cy=sg*R*(1.75+.08*Math.sin(G.T*1.4)),lg=g.createRadialGradient(0,cy,R*.1,0,cy,R*1.15);lg.addColorStop(0,'hsla('+(h+14)+',100%,72%,.55)');lg.addColorStop(1,'hsla('+h+',100%,55%,0)');
      g.fillStyle=lg;g.beginPath();g.ellipse(0,cy,R*.78,R*1.1,0,0,TAU);g.fill()}
  }
  if(k==='spike'){const nsp=d.spk||4;for(let i=0;i<nsp;i++){const a=i*TAU/nsp+G.T*.15+PI/4;const L=R*(3+.3*Math.sin(G.T*2+i));const lg=g.createLinearGradient(0,0,Math.cos(a)*L,Math.sin(a)*L);lg.addColorStop(0,'rgba(255,255,255,.9)');lg.addColorStop(1,'rgba(160,220,255,0)');g.strokeStyle=lg;g.lineWidth=3;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*L,Math.sin(a)*L);g.stroke()}
    const ca=G.T*1.3;g.fillStyle='#fff';g.beginPath();g.arc(Math.cos(ca)*R*1.9,Math.sin(ca)*R*1.9*.5,5,0,TAU);g.fill()}
  const rays=k==='giant'?10:(k==='super'||k==='eta')?9:16;
  for(let i=0;i<rays;i++){const a=i/rays*TAU+G.T*.25*(k==='ring'?3:1),L=R*(1.18+.2*Math.sin(G.T*2.2+i*1.9)+(k==='dwarf'&&i%5===0?.28*Math.max(0,Math.sin(G.T*3+i)):0));
    g.strokeStyle='hsla('+h+',100%,70%,.55)';g.lineWidth=k==='giant'?7:4;g.beginPath();g.moveTo(Math.cos(a)*R*.96,Math.sin(a)*R*.96);g.lineTo(Math.cos(a)*L,Math.sin(a)*L);g.stroke()}
  if(k==='ring'){g.save();g.rotate(-.3);for(let i=0;i<3;i++){g.strokeStyle='rgba(190,215,255,'+(.55-i*.12)+')';g.lineWidth=3-i*.6;g.beginPath();g.ellipse(0,0,R*(1.55+i*.22),R*(.42+i*.06),0,0,TAU);g.stroke()}g.restore()}
  if(k==='twin'){ // 북극성: 궤도를 도는 두 동반성
    for(let i=0;i<2;i++){const rx=R*(1.9+i*.7),ry=rx*.45,a=G.T*(1.7-i*.5)+i*2.4,x=Math.cos(a)*rx,y=Math.sin(a)*ry;
      g.strokeStyle='rgba(255,245,170,.22)';g.lineWidth=1.5;g.beginPath();g.ellipse(0,0,rx,ry,0,0,TAU);g.stroke();
      const cg=g.createRadialGradient(x,y,0,x,y,R*.4);cg.addColorStop(0,'rgba(255,255,255,.95)');cg.addColorStop(.35,'hsla('+(h+8)+',100%,75%,.7)');cg.addColorStop(1,'hsla('+h+',100%,60%,0)');
      g.fillStyle=cg;g.beginPath();g.arc(x,y,R*.4,0,TAU);g.fill()}
  }
  // 본체
  const bd=g.createRadialGradient(-R*.3,-R*.35,R*.1,0,0,R);bd.addColorStop(0,col[0]);bd.addColorStop(.55,col[1]);bd.addColorStop(1,col[2]);
  g.fillStyle=bd;g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=2;
  g.beginPath();
  if(k==='super'||k==='eta'){for(let i=0;i<=40;i++){const a=i/40*TAU,rr2=R*(1+.07*Math.sin(a*3+G.T*1.6)+.05*Math.sin(a*5-G.T*2.3));i?g.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2):g.moveTo(Math.cos(a)*rr2,Math.sin(a)*rr2)}g.closePath()}else g.arc(0,0,R,0,TAU);
  g.fill();g.stroke();
  g.save();g.beginPath();g.arc(0,0,R,0,TAU);g.clip();
  const cells=k==='giant'?7:6;
  for(let i=0;i<cells;i++){const a=i*2.1+G.T*(.25+i*.03),rr2=R*(.3+.4*((i*37)%10)/10);g.fillStyle='hsla('+(h+14)+',100%,78%,.28)';g.beginPath();g.arc(Math.cos(a)*rr2,Math.sin(a)*rr2*.9,R*(.18+.06*(i%3)),0,TAU);g.fill()}
  g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.arc(R*.35,R*.4,R*1.05,0,TAU);g.arc(0,0,R,0,TAU,true);g.fill();
  g.restore();
  // 표정 대신 용암 눈(위협감)
  if(b.state!=='intro'){const ey=-R*.12,ex=R*.34;g.fillStyle='rgba(20,0,0,.55)';for(const sx of[-1,1]){g.beginPath();g.ellipse(sx*ex,ey,R*.17,R*.1,sx*.35,0,TAU);g.fill()}
    g.fillStyle='hsla('+(h+30)+',100%,80%,.9)';for(const sx of[-1,1]){g.beginPath();g.ellipse(sx*ex,ey,R*.07,R*.05,0,0,TAU);g.fill()}}
  if(b.flash>0){g.fillStyle='rgba(255,255,255,'+clamp(b.flash*5,0,.9)+')';g.beginPath();g.arc(0,0,R,0,TAU);g.fill()}
  g.restore();
}
function drawQuasar(b,R){
  const rot=G.T*.6;
  // 제트
  for(const sg of[-1,1]){const jl=g.createLinearGradient(0,0,0,sg*R*6);jl.addColorStop(0,'rgba(210,160,255,.75)');jl.addColorStop(1,'rgba(150,90,255,0)');g.fillStyle=jl;g.beginPath();g.moveTo(-R*.25,0);g.lineTo(R*.25,0);g.lineTo(R*(.9+.2*Math.sin(G.T*5)),sg*R*6);g.lineTo(-R*(.9+.2*Math.sin(G.T*5)),sg*R*6);g.closePath();g.fill()}
  g.save();g.rotate(-.28);
  for(let i=0;i<9;i++){const f=i/9,rx=R*(1.15+f*2.1),ry=rx*.26;g.strokeStyle='hsla('+(40-f*60+(f>.6?240:0))+',100%,'+(80-f*35)+'%,'+(.9-f*.55)+')';g.lineWidth=7-f*4.5;g.beginPath();g.ellipse(0,0,rx,ry,0,0,TAU);g.stroke()}
  for(let i=0;i<5;i++){const a=rot*(1.3-i*.1)+i*1.4,f=.15+i*.17,rx=R*(1.15+f*2.1);g.fillStyle='rgba(255,240,200,.9)';g.beginPath();g.arc(Math.cos(a)*rx,Math.sin(a)*rx*.26,3.2,0,TAU);g.fill()}
  g.restore();
  g.fillStyle='#000';g.beginPath();g.arc(0,0,R*.92,0,TAU);g.fill();
  g.strokeStyle='rgba(255,230,190,'+(.8+.2*Math.sin(G.T*4))+')';g.lineWidth=3;g.beginPath();g.arc(0,0,R*.94,0,TAU);g.stroke();
  g.strokeStyle='rgba(190,140,255,.5)';g.lineWidth=2;g.beginPath();g.arc(0,0,R*1.08+2*Math.sin(G.T*3),0,TAU);g.stroke();
  // 앞쪽 원반 (아래쪽 호만 위에 덧그림)
  g.save();g.rotate(-.28);for(let i=0;i<5;i++){const f=i/9,rx=R*(1.15+f*2.1);g.strokeStyle='hsla('+(40-f*60)+',100%,'+(80-f*35)+'%,'+(.9-f*.55)+')';g.lineWidth=7-f*4.5;g.beginPath();g.ellipse(0,0,rx,rx*.26,0,0,PI);g.stroke()}g.restore();
  if(b.flash>0){g.fillStyle='rgba(255,255,255,'+clamp(b.flash*5,0,.9)+')';g.beginPath();g.arc(0,0,R*.95,0,TAU);g.fill()}
}
export function drawTele(a,b){
  const c=ATK[a.k].c,urgent=a.t<=1,pul=.5+.5*Math.sin(G.T*(urgent?13:6)),gr=easeOut(a.age/.45);
  const fa=urgent?.18+.07*pul:.035,la=urgent?.95*(.55+.45*pul):.26;
  const shape=path=>{g.fillStyle=hexA(c,fa);path();g.fill();g.strokeStyle=hexA(c,la);g.lineWidth=urgent?3:1.2;g.setLineDash(urgent?[9,7]:[3,9]);g.lineDashOffset=-G.T*(urgent?30:8);path();g.stroke();g.setLineDash([])};
  const circ=(x,y,r)=>()=>{g.beginPath();g.arc(x,y,Math.max(1,r*gr),0,TAU)};
  const wedge=(an,half,len)=>()=>{g.beginPath();g.moveTo(b.x,b.y);g.arc(b.x,b.y,len*gr,an-half,an+half);g.closePath()};
  const cnt=(x,y,sz)=>{const r=(sz||13)*(urgent?1:.8);g.globalAlpha=urgent?1:.55;g.fillStyle='rgba(10,8,24,.85)';g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.strokeStyle=urgent?'#ff6a6a':c;g.lineWidth=2;g.stroke();txt(String(a.t),x,y+r*.42,r*1.2,urgent?'#ff8a8a':'#fff','center',800);g.globalAlpha=1};
  const warn=(x,y,sz)=>{if(!urgent)return;g.globalAlpha=.5+.5*pul;txt('⚠',x,y+sz*.35,sz,c,'center',800);g.globalAlpha=1};
  if(a.k==='meteor'){a.zs.forEach((z,i)=>{shape(circ(z.x,z.y,z.r));warn(z.x,z.y-2,26);cnt(z.x,z.y+z.r*.62,11)})}
  else if(a.k==='comet'){a.zs.forEach(z=>shape(circ(z.x,z.y,z.r)));const z=a.zs[0];if(z)cnt(z.x,z.y,11)}
  else if(a.k==='beam'){shape(wedge(a.a,a.half,a.len));const d=150;cnt(clamp(b.x+Math.cos(a.a)*d,20,W-20),b.y+Math.sin(a.a)*d)}
  else if(a.k==='jet'){for(const an of a.as)shape(wedge(an,a.half,a.len));cnt(b.x,b.y+b.hr+48)}
  else if(a.k==='flare'){shape(circ(b.x,b.y,a.r));cnt(clamp(b.x+Math.cos(.9)*a.r,22,W-22),b.y+Math.sin(.9)*a.r)}
  else if(a.k==='hole'){g.strokeStyle=hexA(c,.3);g.lineWidth=1.5;g.setLineDash([4,8]);g.beginPath();g.arc(a.x,a.y,150*gr,0,TAU);g.stroke();g.setLineDash([]);shape(circ(a.x,a.y,34));g.fillStyle='#000';g.beginPath();g.arc(a.x,a.y,10*gr,0,TAU);g.fill();cnt(a.x,a.y-48,11)}
  else if(a.k==='collapse'){const p=a.p;shape(circ(p.x,p.y,a.r));g.strokeStyle=hexA(c,.9*(.5+.5*pul));g.lineWidth=3;g.beginPath();g.arc(p.x,p.y,p.R+6,0,TAU);g.stroke();
    g.strokeStyle=hexA('#ffffff',.6);g.lineWidth=1.5;g.beginPath();g.moveTo(p.x-p.R*.5,p.y-p.R*.8);g.lineTo(p.x+2,p.y-2);g.lineTo(p.x-p.R*.2,p.y+p.R*.6);g.moveTo(p.x+2,p.y-2);g.lineTo(p.x+p.R*.7,p.y+p.R*.3);g.stroke();cnt(p.x,p.y-p.R-18,11)}
  else if(a.k==='wind'){const x=a.dir>0?0:W;const gg=g.createLinearGradient(x,0,x+a.dir*120,0);gg.addColorStop(0,hexA(c,.22));gg.addColorStop(1,hexA(c,0));g.fillStyle=gg;g.fillRect(a.dir>0?0:W-120,G.camY,120,V.VH);txt(a.dir>0?'▶▶▶':'◀◀◀',a.dir>0?40:W-40,G.camY+V.VH*.5,24,c,'center',800);cnt(a.dir>0?40:W-40,G.camY+V.VH*.5-30)}
  g.globalAlpha=1;
}
function zonePath(h,k){
  g.beginPath();
  if(h.shape==='c')g.arc(h.x,h.y,Math.max(1,h.r*k),0,TAU);
  else{g.moveTo(h.x,h.y);g.arc(h.x,h.y,h.len*k,h.a-h.half,h.a+h.half);g.closePath()}
}
function drawZone(h){
  const t=h.t,t0=h.delay,t1=t0+h.fuse,t2=t1+h.blast,col=h.col;
  if(t<t0){g.fillStyle=hexA(col,.1);zonePath(h,1);g.fill();g.strokeStyle=hexA(col,.7);g.lineWidth=2;g.setLineDash([8,8]);g.lineDashOffset=-G.T*30;g.stroke();g.setLineDash([]);return}
  if(t<t1){
    const f=(t-t0)/h.fuse,bl=.5+.5*Math.sin(G.T*(26+f*20));
    g.fillStyle=hexA(col,.14+.1*bl);zonePath(h,1);g.fill();
    g.fillStyle=hexA(col,.22+.38*f);zonePath(h,Math.max(.03,f*f*.55+f*.45));g.fill();
    g.strokeStyle=hexA('#ffffff',.45+.55*bl);g.lineWidth=2.5+f*2.5;zonePath(h,1);g.stroke();
    if(h.shape==='c'){
      g.strokeStyle=hexA(col,.9*(1-f));g.lineWidth=2.5;g.beginPath();g.arc(h.x,h.y,h.r*(1.7-.7*f),0,TAU);g.stroke();
      const r=h.r*.5;g.strokeStyle=hexA('#ffffff',.5);g.lineWidth=1.5;g.beginPath();g.moveTo(h.x-r,h.y);g.lineTo(h.x+r,h.y);g.moveTo(h.x,h.y-r);g.lineTo(h.x,h.y+r);g.stroke();
      if(h.kind==='meteor'){const ff=f*f,x=h.x+(1-ff)*70,y=h.y-(1-ff)*(h.y-G.arenaCam+90),tl=g.createLinearGradient(x,y,x+70*(1-ff)+10,y-Math.max(80,(h.y-G.arenaCam)*(1-ff)*.45));
        tl.addColorStop(0,'rgba(255,200,120,.95)');tl.addColorStop(1,'rgba(255,100,40,0)');g.strokeStyle=tl;g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(x+70*(1-ff)*.45+8,y-Math.max(80,(h.y-G.arenaCam)*(1-ff)*.45));g.stroke();g.lineCap='butt';
        g.save();g.translate(x,y);g.rotate(G.T*6);g.fillStyle='#9a6244';g.strokeStyle='#ffd8a8';g.lineWidth=2;g.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU,r2=17*(.8+.35*((i*53)%7)/7);i?g.lineTo(Math.cos(a)*r2,Math.sin(a)*r2):g.moveTo(Math.cos(a)*r2,Math.sin(a)*r2)}g.closePath();g.fill();g.stroke();g.restore()}
      else if(h.kind==='comet'){const ff=f*f,y=h.y-(1-ff)*220,x=h.x-(1-ff)*50;g.strokeStyle='rgba(180,240,255,.9)';g.lineWidth=7;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(x-26*(1-ff),y-80*(1-ff));g.stroke();g.lineCap='butt';g.fillStyle='#fff';g.shadowColor='#9fe8ff';g.shadowBlur=14;g.beginPath();g.arc(x,y,7,0,TAU);g.fill();g.shadowBlur=0}
      else if(h.kind==='collapse'&&h.p){g.strokeStyle=hexA('#ffffff',.8);g.lineWidth=2;g.beginPath();for(let i=0;i<5;i++){const an=i*1.26+G.T*3,r1=h.p.R*.3,r2=h.p.R*(.6+f*.7);g.moveTo(h.p.x+Math.cos(an)*r1,h.p.y+Math.sin(an)*r1);g.lineTo(h.p.x+Math.cos(an+.3)*r2,h.p.y+Math.sin(an+.3)*r2)}g.stroke()}
    }else{ // 부채꼴: 가장자리 레이저가 번쩍
      g.strokeStyle=hexA('#ffffff',.5+.5*bl);g.lineWidth=2;for(const sg of[-1,1]){g.beginPath();g.moveTo(h.x,h.y);g.lineTo(h.x+Math.cos(h.a+sg*h.half)*h.len*f,h.y+Math.sin(h.a+sg*h.half)*h.len*f);g.stroke()}
    }
    return
  }
  if(t<t2){
    const k=(t-t1)/h.blast;
    if(h.shape==='c'){
      const rg=g.createRadialGradient(h.x,h.y,0,h.x,h.y,h.r*(.85+.3*k));rg.addColorStop(0,'rgba(255,255,255,'+(1-k*.5)+')');rg.addColorStop(.45,hexA(col,.85*(1-k*.5)));rg.addColorStop(1,hexA(col,0));
      g.fillStyle=rg;g.beginPath();g.arc(h.x,h.y,h.r*(.85+.3*k),0,TAU);g.fill();
      g.strokeStyle=hexA('#ffffff',1-k);g.lineWidth=5*(1-k)+1;g.beginPath();g.arc(h.x,h.y,h.r*(.7+.4*k),0,TAU);g.stroke();
    }else{
      g.save();zonePath(h,1);g.clip();
      const gg=g.createLinearGradient(h.x,h.y,h.x+Math.cos(h.a)*h.len,h.y+Math.sin(h.a)*h.len);gg.addColorStop(0,'rgba(255,255,255,.95)');gg.addColorStop(.3,hexA(col,.75));gg.addColorStop(1,hexA(col,.3));
      const ap=t<t1+.1?(t-t1)/.1:t>t2-.2?(t2-t)/.2:1;g.globalAlpha=clamp(ap,0,1);g.fillStyle=gg;g.fillRect(h.x-h.len,h.y-h.len,h.len*2,h.len*2);
      for(let i=0;i<7;i++){const r=((G.T*620+i*h.len/7)%h.len);g.strokeStyle=hexA('#ffffff',.5*(1-r/h.len));g.lineWidth=4;g.beginPath();g.arc(h.x,h.y,r,h.a-h.half,h.a+h.half);g.stroke()}
      g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2;for(let i=-3;i<=3;i++){const an=h.a+i/3*h.half*.9;g.beginPath();g.moveTo(h.x,h.y);g.lineTo(h.x+Math.cos(an)*h.len,h.y+Math.sin(an)*h.len);g.stroke()}
      g.restore();g.globalAlpha=clamp(ap,0,1);g.strokeStyle='#fff';g.lineWidth=3;zonePath(h,1);g.stroke();g.globalAlpha=1;
    }
    return
  }
  const fk=1-(t-t2)/h.fade;if(fk<=0)return;
  if(h.shape==='c'){g.fillStyle=hexA(col,.16*fk);g.beginPath();g.arc(h.x,h.y,h.r*.95,0,TAU);g.fill();g.strokeStyle=hexA(col,.5*fk);g.lineWidth=2;g.beginPath();g.arc(h.x,h.y,h.r*.95,0,TAU);g.stroke()}
}
export function drawHaz(h){
  switch(h.k){
    case 'zone':drawZone(h);break;
    case 'hole':{const sc=easeOut(h.born),rr0=h.r*sc;
      g.strokeStyle='rgba(200,140,255,.28)';g.lineWidth=1.5;g.setLineDash([4,8]);g.beginPath();g.arc(h.x,h.y,150,0,TAU);g.stroke();g.setLineDash([]);
      const hg=g.createRadialGradient(h.x,h.y,rr0*.6,h.x,h.y,rr0*6);hg.addColorStop(0,'rgba(170,90,255,.6)');hg.addColorStop(1,'rgba(170,90,255,0)');g.fillStyle=hg;g.beginPath();g.arc(h.x,h.y,rr0*6,0,TAU);g.fill();
      g.strokeStyle='rgba(220,170,255,.9)';g.lineWidth=2;for(let k=0;k<5;k++){g.beginPath();g.arc(h.x,h.y,rr0+4+k*6,G.T*3+k*1.3,G.T*3+k*1.3+1.4);g.stroke()}
      g.fillStyle='#000';g.beginPath();g.arc(h.x,h.y,rr0,0,TAU);g.fill();
      txt(String(h.turns),h.x,h.y-rr0-12,14,'#d8b0ff','center',800);break}
    case 'wind':{const x=h.dir>0?0:W;const gg=g.createLinearGradient(x,0,x+h.dir*100,0);gg.addColorStop(0,'rgba(138,255,200,.2)');gg.addColorStop(1,'rgba(138,255,200,0)');g.fillStyle=gg;g.fillRect(h.dir>0?0:W-100,G.camY,100,V.VH);break}
  }
}
