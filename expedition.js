// Main and wet decks share the transform of the two-storey pressure cabin.
const cabinAngle=-14*Math.PI/180;
const cos=Math.cos(cabinAngle),sin=Math.sin(cabinAngle);
export function cabinPoint(x,y,z){return [10+x*cos-y*sin,-30+x*sin+y*cos,-21.51+z];}
function cabinLocal([worldX,worldY,worldZ]){
  const dx=worldX-10,dy=worldY+30;
  return [dx*cos+dy*sin,-dx*sin+dy*cos,worldZ+21.51];
}
export const cabinLadder=cabinPoint(0,.06,.85);
export function atCabinLadder(p){
  const [x,y,z]=cabinLocal(p);
  return Math.abs(x)<.58&&y> -1.66&&y<.19&&z>-.08&&z<1.46;
}
export function cabinSwimFree(p){
  const [x,y,z]=cabinLocal(p),r=Math.hypot(x,y);
  if(r>1.92||z<-.29||z>6.81)return true;
  if(z>1.45)return r>=1.58;
  // The 72-degree opening in the south face runs all the way down to the water.
  if(z>-.06&&r>1.09&&r<1.54&&(y>=0||Math.abs(x)>-.60*y))return false;
  // The gate is hinged at -54 degrees and swung outward by 60 degrees.
  const dx=x-.723,dy=y+.995;
  const along=Math.max(0,Math.min(.58,dx*.5-dy*.866));
  if(z>-.06&&Math.hypot(dx-.5*along,dy+.866*along)<.13)return false;
  return Math.abs(x)>.36||Math.abs(y-.28)>.11;
}
// Distance to the nearest point along the ship's keel.
export function keelDistance(pos,hull){
  const [cx,cy,waterline]=hull.origin;
  const c=Math.cos(hull.yaw),s=Math.sin(hull.yaw);
  const dx=pos[0]-cx,dy=pos[1]-cy;
  const along=Math.max(-19,Math.min(19,dx*c+dy*s));
  return Math.hypot(dx-along*c,dy-along*s,pos[2]-(waterline-2.4));
}
export const expeditionPlaces=[
  {id:'garage-deck',room:true,name:'Ангар',pos:[4.78,3.73,3.58],look:[6.34,7.11,3.02]},
  {id:'cabin-deck',room:true,name:'Хижина · жилой ярус',pos:cabinPoint(.12,.76,5.28),look:cabinPoint(.33,-.69,4.97)},
  {id:'cabin-wet',room:true,name:'Хижина · входной ярус',pos:cabinPoint(.05,-.87,3.03),look:cabinPoint(.45,.37,2.99)},
  {id:'garden',sea:true,name:'Коралловый риф',pos:[-9.48,-3.82,1.73],look:[-11.27,.62,1.23]},
  {id:'canyon',sea:true,name:'Коралловое ущелье',pos:[-16.36,6.86,1.60],look:[-15.57,2.2,1.61]},
  {id:'east-canyon',sea:true,name:'Восточное коралловое ущелье',pos:[29.07,-2.3,2.0],look:[30.48,3.3,2.35]},
  {id:'pens',sea:true,name:'Садки для рыб',pos:[3.38,-1.52,1.49],look:[3.17,1.13,.64]},
  {id:'ships',sea:true,name:'Под «Калипсо»',pos:[9.25,8.55,8.15],look:[6.18,16.3,10.85]},
  {id:'supply',sea:true,name:'Линии снабжения «Розальдо»',pos:[17.5,1.9,5.0],look:[21,7.0,8.0]},
  {id:'denise',sea:true,name:'Ныряющее блюдце «Дениз»'}
];
export function saucerPose(time,motion){
  const pivot=motion?.pivot??[11,-4,3.7];
  const a=time*(motion?.speed??-.102),c=Math.cos(a),s=Math.sin(a);
  function local(x,y,z){return [pivot[0]+x*c-y*s,pivot[1]+x*s+y*c,pivot[2]+z-3.7];}
  return {pos:local(6.3,-3.4,4.28),look:local(3.6,0,3.74)};
}
export function remoteFree(id,p,garageDeck){
  if(id==='garage-deck'){
    if(garageDeck)return Math.abs(p[2]-garageDeck.entry[2])<.001&&garageDeck.free(p);
    const x=p[0]-6.3,y=p[1]-5,r=Math.hypot(x,y);
    return r>=1.82&&r<2.33&&!(y>1.78&&Math.abs(x)<.75)&&!(x>1.10&&y>1.37)&&!(x<-.86&&y>.75);
  }
  const dx=p[0]-10,dy=p[1]+30,x=dx*cos+dy*sin,y=-dx*sin+dy*cos;
  if(Math.hypot(x,y)>1.04)return false;
  if(id==='cabin-deck'){
    const opening=x>.235&&x<.992&&y>-.003&&y<.834;
    return x>-.32&&!opening&&!(x>-.31&&x<.67&&y<-.43)&&!(x>.52&&y<-.33);
  }
  const underSteps=x>.38&&x<.88&&y>.04&&y<.79;
  return Math.hypot(x,y)>.59 && !underSteps && !(y>.48&&x<.76) && x>-.80;
}
// Reserve the netted volume, rock shoulders and the hulls present in this edition.
export function expeditionWaterFree(p,time,calypsoHull,channels,saucer,spurHeads,hasRosaldo=true){
  const [x,y,z]=p;
  for(const passage of channels||[]){
    const j=Math.floor((y-passage.y)/passage.cell), k=Math.floor(z/passage.cell);
    const edges=passage.sections[j]?.[k]||[];
    for(let i=0;i<edges.length;i+=2){
      if(x>edges[i]/100-.13 && x<edges[i+1]/100+.13)return false;
    }
  }
  for(const head of spurHeads||[]){
    const i=Math.floor((x-head.x)/head.cell),j=Math.floor((y-head.y)/head.cell);
    const a=head.rows[j],b=head.rows[j+1];
    const height=Math.max(a?.[i]??-100,a?.[i+1]??-100,b?.[i]??-100,b?.[i+1]??-100);
    if(height>-100 && z<height/100+.16)return false;
  }
  if(z<1.38){
    for(const [cx,cy,w,h] of [[2.74,.82,1.85,1.22],[4.45,1.53,1.20,1.08]]){
      const dx=x-cx,dy=y-cy;
      if(Math.abs(.971*dx-.238*dy)<w*.5+.09&&Math.abs(.238*dx+.971*dy)<h*.5+.09)return false;
    }
  }
  if(z<2.0&&x< -5&&x> -15&&y> -7&&y<9){
    for(let i=0;i<8;i++){
      const ry=-5.5+i*1.65;
      for(const side of [-1,1]){
        const rx=-9.8+side*(2.25+.48*Math.sin(i*.84))+.56*Math.sin(ry*.46);
        if(Math.hypot((x-rx)/1.32,(y-ry)/1.16)<1&&z<1.15)return false;
      }
    }
  }
  for(const [cx,cy,yaw,l,b,draft] of [[-11,15,.12,42,7.4,2.52],[22,10,-.42,22,5.6,1.74]]){
    if(cx===22 && !hasRosaldo)continue;
    if(cx===-11 && calypsoHull){
      const h=calypsoHull,co=Math.cos(h.yaw),si=Math.sin(h.yaw);
      const dx=x-h.origin[0],dy=y-h.origin[1];
      const i=Math.floor(((dx*co+dy*si)-h.xy[0])/h.cell);
      const j=Math.floor(((-dx*si+dy*co)-h.xy[1])/h.cell);
      const depth=Math.max(h.rows[j]?.[i]??-1,h.rows[j]?.[i+1]??-1,h.rows[j+1]?.[i]??-1,h.rows[j+1]?.[i+1]??-1);
      if(depth>=0 && z>h.origin[2]-depth/50-.12)return false;
      continue;
    }
    const dx=x-cx,dy=y-cy,co=Math.cos(yaw),si=Math.sin(yaw);
    const along=(dx*co+dy*si)/(l*.5),across=(-dx*si+dy*co)/(b*.5);
    if(z>12.49-draft-.18&&along*along+across*across+((12.49-z)/draft)**2<1.14)return false;
  }
  const boat=saucerPose(time,saucer).look;
  return ((x-boat[0])/1.5)**2+((y-boat[1])/1.5)**2+((z-boat[2])/.86)**2>1;
}
