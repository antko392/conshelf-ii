import {keelDistance} from './expedition.js?v=berth37';
import {sharkPosition} from './reef-fish.js?v=shark38';
import {floor,origin,angles} from './navigation.js?v=cabin20';

const arms=angles.map(a=>[Math.cos(a),Math.sin(a)]);
// Hide distant labels when another station hull or the shelf lies between it and the swimmer.
function clearSight(from,to,owner){
  const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2];
  const steps=Math.ceil(Math.hypot(dx,dy,dz)/.65);
  for(let i=1;i<steps;i++){
    const u=i/steps,x=from[0]+dx*u,y=from[1]+dy*u,z=from[2]+dz*u;
    if(z<floor(x,y))return false;
    if(owner!=='garage'&&z>2.15&&z<4.86&&Math.hypot(x-6.3,y-5)<2.56*(1-((z-2.15)/2.71)**1.7))return false;
    if(owner!=='cabin'&&z> -19.56&&z< -15.4&&Math.hypot(x-10,y+30)<1.33)return false;
    if(owner!=='salon'&&z>2.40&&z<4.55){
      const a=x-origin[0],b=y-origin[1];
      if(a*a+b*b<3.2||arms.some(([c,n])=>a*c+b*n>1.1&&a*c+b*n<4.25&&Math.abs(b*c-a*n)<.81))return false;
    }
  }
  return true;
}
// Overlay anchors are in the same Z-up world coordinates as the swim camera.
const landmarks={
  salon:{anchor:[.65,-4.1,4.86]},
  garage:{anchor:[6.30,5.0,4.92]},
  reef:{anchor:[3.15,-9.7,1.03]},
  cabin:{anchor:[10,-30,-15.25]},
  denise:{},
  canyon:{anchor:[-16.1,1.7,4.1],other:[30.5,3.3,4.1]},
  ships:{}
};
function marker(container,id,title,minor,activate){
  const button=document.createElement('button'),label=document.createElement('span');
  button.type='button';button.className='sea-marker'+(minor?' minor':'');
  button.dataset.place=id;button.hidden=true;
  button.setAttribute('aria-label',minor?title:'Об объекте — '+title);
  const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');
  const leader=document.createElement('b');leader.setAttribute('aria-hidden','true');
  label.textContent=title;button.append(leader,dot,label);container.append(button);button.onclick=activate;
  return {button,label,leader,activate};
}

function renderMarkers(container,project,collect,canSee,focusRadius){
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  container.hidden=!project;
  if(!project)return null;
  const w=container.clientWidth,h=container.clientHeight,visible=[];
  let focused=null,best=Infinity;
  function place(pin,point,show,priority,enabled=true,owner){
    const xy=project(point);
    const button=pin.button,action=!!pin.ready&&enabled;
    const onScreen=xy&&xy[0]>=14&&xy[0]<=w-14&&xy[1]>=65&&xy[1]<=h-28&&canSee(point,owner);
    button.disabled=!enabled;
    if(!onScreen){button.hidden=true;return;}
    button.hidden=false;
    if(pin.ready){
      const text=action?pin.name:pin.caption;
      if(pin.label.textContent!==text){pin.label.textContent=text;button.setAttribute('aria-label',text);}
    }
    const x=Math.round(xy[0]),y=Math.round(xy[1]);
    button.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-50%)';
    const score=Math.hypot(x-w/2,y-h/2);
    if(enabled&&score<best&&score<focusRadius){best=score;focused=pin.activate;}
    visible.push({pin,x,y,show:show||action,action,priority:action?-1:priority,score});
  }
  collect(place);
  // Reserve the dots themselves first. Nearby entrances get first choice of label position.
  const reserved=visible.map(({x,y})=>({x:x-8,y:y-8,w:16,h:16}));
  visible.sort((a,b)=>a.priority-b.priority||a.score-b.score);
  for(const {pin,x,y,show,action} of visible){
    let position=null;
    if(show){
      const width=pin.label.offsetWidth,height=pin.label.offsetHeight;
      const rows=pin.button.dataset.place==='shark'? [32,-height-32,56,-height-58,5,-height-5]:[-height-5,5,-height-32,32,-height-58,56];
      for(const dy of rows){
        for(const dx of [23,-width-23]){
          const box={x:x+dx,y:y+dy,w:width,h:height};
          if(box.x>=5&&box.x+width<=w-5&&box.y>=62&&box.y+height<h-18&&!reserved.some(r=>overlaps(box,r))){
            position=[dx,dy];break;
          }
        }
        if(position)break;
      }
      if(!position&&action){
        const left=Math.max(5,Math.min(w-width-5,x-width/2));
        const top=Math.max(66,Math.min(h-height-22,y-height/2));
        position=[left-x,top-y];
      }
      if(position)reserved.push({x:x+position[0],y:y+position[1],w:width,h:height});
    }
    pin.button.classList.toggle('captioned',!!position);
    if(position){
      const [dx,dy]=position;
      pin.label.style.marginLeft=dx+'px';pin.label.style.marginTop=dy+'px';
      const endX=dx>0?dx:dx+pin.label.offsetWidth,endY=dy+pin.label.offsetHeight/2;
      pin.leader.style.width=Math.hypot(endX,endY)+'px';
      pin.leader.style.transform='rotate('+Math.atan2(endY,endX)+'rad)';
    }
  }
  return focused;
}

export function createInteriorMarkers(container,actions){
  const pins=actions.map(action=>({...action,...marker(container,action.id,action.caption,true,action.activate)}));
  return (project,zone)=>renderMarkers(container,project,place=>{
    for(const pin of pins){
      if(pin.visible(zone))place(pin,pin.anchor,true,0,pin.ready());
      else pin.button.hidden=true;
    }
  },()=>true,Infinity);
}

export function createSeaWaypoints(container,places,entrances,showInfo){
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const groups=places.filter(p=>landmarks[p.id]).map(({id,name})=>{
    const data=landmarks[id],entry=entrances[id];
    return {...data,id,name,openingLandmark:['reef','salon','garage'].includes(id),intro:false,main:marker(container,id,name,false,()=>showInfo(id)),
      entry:entry&&{...entry,...marker(container,id,entry.name,true,entry.activate)},near:false};
  });
  const shark={caption:'Серая рифовая акула',name:'Об акулах',ready:()=>true,
    ...marker(container,'shark','Серая рифовая акула',true,()=>showInfo('shark'))};
  return (pos,project,boat,zone,time,hull,introduce)=>renderMarkers(container,project,place=>{
    const animal=sharkPosition(time),range=distance(pos,animal);
    if(range<24)place(shark,animal,range<16,2,range<6,'shark');
    else shark.button.hidden=true;
    for(const group of groups){
      let point=group.id==='ships'?[hull.origin[0],hull.origin[1],hull.origin[2]-2.4]:group.anchor??boat;
      if(group.other&&distance(pos,group.other)<distance(pos,point))point=group.other;
      let range=Math.min(distance(pos,point),group.entry?distance(pos,group.entry.anchor):Infinity);
      if(group.id==='ships'){
        range=keelDistance(pos,hull);
      }
      if(group.id==='canyon'&&(zone==='canyon'||zone==='east-canyon'))range=0;
      group.near=range<(group.near?7.8:6.8);
      const intro=introduce&&group.openingLandmark;
      if(group.intro!==intro){
        group.intro=intro;
        group.main.label.textContent=intro?'Нажми меня':group.name;
        group.main.button.classList.toggle('intro-callout',intro);
      }
      place(group.main,point,intro||!group.near,intro?0:1,true,group.id);
      if(group.entry)place(group.entry,group.entry.anchor,group.near,0,group.entry.ready(),group.id);
    }
  },(point,owner)=>clearSight(pos,point,owner),52);
}
