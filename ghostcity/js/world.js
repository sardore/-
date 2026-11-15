// Pure tile-grid and line-of-sight utilities. No generation or combat in this module.
// Cell walkability mirrors Pygame Tile walkable/blocking (windows are traversable).
import {T,TILE} from './config.js';

const steps=[[1,0],[-1,0],[0,1],[0,-1]];
const index=(w,x,y)=>y*w+x;
export const gridToPixel=(x,y)=>({x:(x+.5)*TILE,y:(y+.5)*TILE});
export function inside(w,x,y){return x>=0&&y>=0&&x<w.w&&y<w.h;}
export function isSolid(t){return t===T.WALL||t===T.RUBBLE;}
export function tileAt(w,x,y){
  const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
  return inside(w,tx,ty)?w.tiles[index(w.w,tx,ty)]:T.WALL;
}
export function bresenham(x0,y0,x1,y1){
  const pts=[],dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),
    sx=x0<x1?1:-1,sy=y0<y1?1:-1;
  let x=x0,y=y0,err=dx+dy;
  while(true){
    pts.push([x,y]);if(x===x1&&y===y1)break;
    const e2=err*2;
    if(e2>=dy){err+=dy;x+=sx;}
    if(e2<=dx){err+=dx;y+=sy;}
  }
  return pts;
}
export function lineOfSight(w,ax,ay,bx,by){
  const x0=Math.floor(ax/TILE),y0=Math.floor(ay/TILE),
    x1=Math.floor(bx/TILE),y1=Math.floor(by/TILE);
  if(!inside(w,x0,y0)||!inside(w,x1,y1))return false;
  const line=bresenham(x0,y0,x1,y1);
  // Original has_los ignores both endpoints and blocks WALL/FURN only.
  for(let i=1;i<line.length-1;i++){
    const [x,y]=line[i];
    if(isSolid(w.tiles[index(w.w,x,y)]))return false;
  }
  return true;
}
export function refreshVision(w,px,py,radius=13){
  const cx=Math.floor(px/TILE),cy=Math.floor(py/TILE),r2=radius*radius;
  w.visible.fill(0);
  for(let y=Math.max(0,cy-radius);y<=Math.min(w.h-1,cy+radius);y++)
    for(let x=Math.max(0,cx-radius);x<=Math.min(w.w-1,cx+radius);x++){
      const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy>r2)continue;
      const id=index(w.w,x,y);
      if(lineOfSight(w,px,py,(x+.5)*TILE,(y+.5)*TILE)){
        w.visible[id]=1;w.seen[id]=1;
      }
    }
}
export function isReachable(w,start,target){
  if(!inside(w,start.x,start.y)||!inside(w,target.x,target.y))return false;
  const visited=new Uint8Array(w.w*w.h),queue=[start];
  visited[index(w.w,start.x,start.y)]=1;
  for(let i=0;i<queue.length;i++){
    const p=queue[i];if(p.x===target.x&&p.y===target.y)return true;
    for(const [dx,dy] of steps){
      const x=p.x+dx,y=p.y+dy;
      if(!inside(w,x,y))continue;
      const id=index(w.w,x,y);
      if(visited[id]||isSolid(w.tiles[id]))continue;
      visited[id]=1;queue.push({x,y});
    }
  }
  return false;
}
export function buildFlow(w,px,py){
  const distance=new Int16Array(w.w*w.h);distance.fill(-1);
  const origin={x:Math.floor(px/TILE),y:Math.floor(py/TILE)};
  if(!inside(w,origin.x,origin.y))return distance;
  const q=[origin];distance[index(w.w,origin.x,origin.y)]=0;
  for(let i=0;i<q.length;i++){
    const p=q[i],depth=distance[index(w.w,p.x,p.y)];
    for(const [dx,dy] of steps){
      const x=p.x+dx,y=p.y+dy;if(!inside(w,x,y))continue;
      const id=index(w.w,x,y);
      if(distance[id]!==-1||isSolid(w.tiles[id]))continue;
      distance[id]=depth+1;q.push({x,y});
    }
  }
  return distance;
}
