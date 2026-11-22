import {cabinSwimFree} from './expedition.js?v=cabin20';
export const origin=[.650467,-4.095757], angles=[.777214,2.033851,-2.992697,-1.736060];
export const hatch=[-.87,-1.05,1.1], microscope=[3.94,-1.77,3.67];
export const startPose={pos:[9.3,-14.5,5.7],yaw:2.23,pitch:-.18,inside:false};
export function roomPoint(p,a){const x=p[0]-origin[0],y=p[1]-origin[1];return [x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)];}
export function floor(x,y){
  const d=-11.6+1.1*Math.sin(x*.13)+.6*Math.sin(x*.37)-y;
  if(d<=0)return -.025;
  return (d<3?-1.4*d*d/6:-1.4*(d-1.5))+.24*Math.sin(x*.2)*Math.sin(y*.18)*Math.min(1,d/5)-.025;
}
export function canSwim(p,shipAccess=false,extendedReef=false,supplyBerth=false){
  const [x,y,z]=p;
  const westLimit=extendedReef?-35:shipAccess&&y>4&&z>4?-36:-23;
  const eastLimit=supplyBerth&&z>4&&y>-5&&y<16?46:extendedReef?38:32;
  if(x<westLimit||x>eastLimit||y< -41||y>(extendedReef?28:22)||z<floor(x,y)+.35||z>11.7)return false;
  if(z>1.88&&z<4.93){
    if(Math.hypot(x-origin[0],y-origin[1])<2.13)return false;
    if(angles.some(a=>{const [s,v]=roomPoint(p,a);return s>1.1&&s<4.66&&Math.abs(v)<1.3;}))return false;
  }
  if(Math.hypot(x-6.3,y-5)<2.83&&z>1.7&&z<5.36)return false;
  return cabinSwimFree(p);
}
export function makeDeck(grid){
  const {origin:o,cellSize:c,width:w,height:h,rows}=grid;
  function cell(p){return [Math.floor((p[0]-o[0])/c),Math.floor((p[1]-o[1])/c)];}
  function center(x,y){return [o[0]+(x+.5)*c,o[1]+(y+.5)*c,grid.eye??3.88];}
  function open(x,y){return rows[y]?.[x]==='1';}
  function free(p){return open(...cell(p));}
  function path(from,to){
    const [sx,sy]=cell(from),[tx,ty]=cell(to);
    if(!open(sx,sy)||!open(tx,ty))return [];
    const src=sy*w+sx,dst=ty*w+tx,prev=new Int32Array(w*h).fill(-1),q=[src];prev[src]=src;
    for(let i=0;i<q.length&&prev[dst]===-1;i++){
      const id=q[i],x=id%w,y=Math.floor(id/w);
      for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=x+dx,ny=y+dy,next=ny*w+nx;
        if(open(nx,ny)&&prev[next]===-1&&(!dx||!dy||(open(x+dx,y)&&open(x,y+dy)))){
          prev[next]=id;q.push(next);
        }
      }
    }
    if(prev[dst]===-1)return [];
    const chain=[];
    for(let cur=dst;cur!==src;cur=prev[cur])chain.push(center(cur%w,Math.floor(cur/w)));
    chain.reverse();
    // Combine runs only while the whole segment stays on the verified deck.
    const shorter=[];let last=from;
    for(let i=0;i<chain.length;){
      let end=i;
      for(let j=i+1;j<chain.length;j++){
        const p=chain[j],n=Math.ceil(Math.hypot(p[0]-last[0],p[1]-last[1])/(c*.3));
        let clear=true;
        for(let t=1;t<=n;t++){if(!free([last[0]+(p[0]-last[0])*t/n,last[1]+(p[1]-last[1])*t/n])){clear=false;break;}}
        if(!clear)break;end=j;
      }
      last=chain[end];shorter.push(last);i=end+1;
    }
    return shorter;
  }
  return {free,path,entry:[...grid.entry,grid.eye??3.88],lab:grid.lab&&[...grid.lab,3.88]};
}
