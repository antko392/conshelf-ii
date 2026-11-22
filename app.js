import {setupSound} from './ambience.js?v=mobile26';
import {renderFieldNote,fieldPhoto,photoGallery,loadCardPhoto,warmNearbyPhotos} from './field-guide.js?v=atlas40';
import {createSeaWaypoints,createInteriorMarkers} from './sea-waypoints.js?v=atlas40';
import {keelDistance,expeditionPlaces,saucerPose,remoteFree,expeditionWaterFree,cabinLadder,cabinPoint,atCabinLadder} from './expedition.js?v=berth37';
import {createRenderer,getAsset,salonRefit,salonFolder,wetEdition,villageEdition} from './renderer.js?v=shark38';
import {startPose,origin,angles,hatch,makeDeck,roomPoint,canSwim} from './navigation.js?v=berth37';
const byId=id=>document.getElementById(id);
const $={};for(const id of ['sea','intro','start','load','hud','location','hint','forward','backward','action','pin','help','guide','notes','reset'])$[id]=byId(id);
const firstControls=byId('first-controls'),loadingMeter=byId('loading-meter'),progress=byId('load-progress'),percent=byId('load-percent');
let moveButton=null,moveDirection=0;
const sound=setupSound(byId('sound'));
const cam={showerOn:false,...startPose,pos:[...startPose.pos]},keys=new Set();
let draw,deck,garageDeck,running=false,route=null,command=null,lookId=null,moveId=null,previous=0,hintTimer;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const ocular=byId('ocular');
const hasSpecimen=true;
const galleyNotes=byId('galley-notes');
const places=byId('places'),consoleNotes=byId('console-notes');
const dialogs=[$.notes,$.guide,ocular,galleyNotes,places,consoleNotes,byId('sea-info'),...document.querySelectorAll('.salon-story')];
const modal=()=>dialogs.some(d=>d.open);
const wingEdition=true;
function wingPoint(s,v,z,angle=angles[0]){
  const c=Math.cos(angle),n=Math.sin(angle);
  return [origin[0]+s*c-v*n,origin[1]+s*n+v*c,z];
}
const salonPoint=(x,y,z)=>wingPoint(x,y,z,angles[0]+Math.PI/10);
const wetPoint=(s,v,z)=>wingPoint(s,v,z,angles[1]);
const exhibits=[
  {id:'console',salon:true,name:'Пульт связи',target:villageEdition?salonPoint(-.22,1.76,3.51):salonPoint(.02,1.84,3.73),anchor:villageEdition?salonPoint(.24,1.91,3.76):null,stop:villageEdition?salonPoint(.23,1.18,3.68):salonPoint(-.80,.55,3.82),open:()=>openDialog(consoleNotes)},
  ...(salonRefit?[
    {id:'claude',salon:true,name:'Попугай Клод',target:salonPoint(-1.37,-.92,3.73),anchor:salonPoint(-1.40,-.80,3.53),stop:salonPoint(-1.11,-.30,3.79),open:()=>openDialog(byId('claude-notes'))},
    {id:'table',salon:true,name:'Обеденный стол',target:salonPoint(.015,-.40,3.31),stop:salonPoint(.02,.59,3.82),open:()=>openDialog(byId('table-notes'))},
    {id:'windows',salon:true,name:'Иллюминаторы',target:salonPoint(.40,-1.85,3.65),stop:salonPoint(.32,-1.32,3.72),open:()=>openDialog(byId('windows-notes'))}
  ]:[]),
  ...(wetEdition?[
    {id:'shower',wet:true,name:'Душ',target:wetPoint(2.91,-.69,3.68),anchor:wetPoint(2.89,-.93,3.43),stop:wetPoint(2.51,.01,3.74),open:()=>openDialog(byId('shower-notes'))},
    {id:'divegear',wet:true,name:'Снаряжение',target:wetPoint(3.26,.70,3.52),anchor:wetPoint(3.30,.70,3.21),stop:wetPoint(2.76,.03,3.73),open:()=>openDialog(byId('gear-notes'))}
  ]:[]),
  {id:'microscope',name:'Микроскоп',target:[3.954,-1.797,3.545],stop:[3.463,-1.679,3.69],open:examine},
  {id:'aquarium',name:'Аквариум',target:wingPoint(3.13,-.69,3.51),stop:[2.456,-2.109,3.73],open:read},
  {id:'kitchen',name:'Плита',target:wingPoint(2.84,.66,3.43),anchor:wingPoint(2.90,.545,3.365),stop:wingPoint(2.62,-.02,3.76),open:()=>openDialog(galleyNotes)}
];
const kitchenItem=exhibits.find(e=>e.id==='kitchen');
const consolePoint=exhibits.find(item=>item.id==='console').target;
const showerPoint=exhibits.find(item=>item.id==='shower')?.target;
const parrotPoint=exhibits.find(item=>item.id==='claude')?.target;
cam.tapeRunning=true;
function updateAudio(moved){
  if(!sound.active)return;
  const place=cam.inside?(cam.remoteRoom||'station'):'sea';
  const near=(point,radius)=>point?Math.max(0,1-distance(cam.pos,point)/radius):0;
  const station=place==='station';
  const radio=station&&cam.tapeRunning?near(consolePoint,7):0;
  const shower=station&&cam.showerOn?near(showerPoint,3.5)**1.4:0;
  sound.update(place,moved,radio,shower,station?near(parrotPoint,4.5):0,
    place==='garage-deck'?near([6.3,5,2.4],4):0);
}
const fittedHangar=salonFolder==='hangar14/';
const extendedReef=fittedHangar||salonFolder==='reef13/';
function seaDestinations(){
  if(!villageEdition)return [];
  return expeditionPlaces.flatMap(place=>{
    if(fittedHangar&&place.id==='ships')return [{...place,pos:[13.5,-2.5,5.9],look:[21,7.8,10.8]}];
    if(fittedHangar&&place.id==='supply')return [{...place,name:'Шланги снабжения «Калипсо»'}];
    if(fittedHangar&&place.id==='garage-deck')return [{...place,pos:[6.3,3.09,3.39],look:[6.42,7.08,3.10]}];
    if(place.id==='east-canyon'&&!extendedReef)return [];
    if(place.id==='canyon'){
      if(salonFolder==='village10/')return [];
      if(extendedReef)return [{...place,name:'Западное коралловое ущелье',pos:[-16.66,8,2.1],look:[-16.13,3.2,2.5]}];
    }
    return [place];
  });
}
const villageView={sea:true,pos:[8.6,-17.8,4.85],look:[2.35,-1.55,3.45]};
const destinations=[
  {id:'salon',name:'Общий зал',pos:salonPoint(.85,.78,3.86),look:salonPoint(-.13,-.72,3.52)},
  {id:'lab',name:'Лаборатория',pos:[2.76,-1.89,3.86],look:[3.74,-1.92,3.55]},
  {id:'kitchen',name:'Кухня',pos:kitchenItem.stop,look:kitchenItem.target},
  {id:'wc',name:'Санузел',pos:wingPoint(3.52,-.17,3.77),look:wingPoint(3.49,.65,2.98)},
  {id:'darkroom',name:'Фотолаборатория',pos:wingPoint(3.80,-.10,3.80),look:wingPoint(3.95,.68,3.39)},
  {id:'wet',name:'Мокрый отсек',pos:wetEdition?wingPoint(1.96,0,3.77,angles[1]):[-.88,-1.08,3.88],look:wetEdition?wingPoint(3.58,0,3.30,angles[1]):wingPoint(4.10,0,3.12,angles[1])},
  {id:'berth2',name:villageEdition?'Западная спальня':'Двухместная каюта',pos:wingPoint(2.18,.09,3.77,angles[2]),look:wingPoint(4.02,-.10,3.72,angles[2])},
  {id:'berth4',name:villageEdition?'Южная спальня':'Четырёхместная каюта',pos:wingPoint(2.18,.09,3.77,angles[3]),look:wingPoint(4.05,-.12,3.72,angles[3])},
  {id:'reef',name:'Подводная деревня',...villageView},
  {id:'hatch',name:'Нижний люк',sea:true,pos:[.48,.45,1.15],look:hatch},
  {id:'garage',name:'Подводный ангар',sea:true,pos:fittedHangar?[6.74,3.10,1.16]:[9.80,7.85,3.78],look:fittedHangar?[6.30,5.33,2.5]:[6.30,5,3.00]},
  {id:'cabin',name:'Глубоководная хижина',sea:true,pos:fittedHangar?cabinPoint(0,-4.60,1.66):[13.9,-27.2,-15.32],look:fittedHangar?cabinLadder:[10,-30,-18.20]},
  ...seaDestinations()
];
const byPlace=new Map(destinations.map(d=>[d.id,d]));
function arrive(d){
  route=null;climbing=null;controlsOff();cam.inside=!d.sea;cam.remoteRoom=d.room?d.id:null;
  const pose=d.id==='denise'?saucerPose(performance.now()/1000,draw.saucerMotion):d;
  cam.pos=pose.pos.slice();aim(pose.look);
  clearTimeout(hintTimer);$.hint.classList.remove('show');$.hint.textContent='';
}
const majorPlaces=[
  {id:'salon',name:'Морская звезда'}, {id:'garage',name:'Ангар'},
  {id:'reef',name:'Подводная деревня'}, {id:'cabin',name:'Глубоководная хижина'},
  {id:'denise',name:'Блюдце'}, {id:extendedReef?'canyon':'garden',name:'Коралловый риф'},
  {id:'ships',name:'Судно «Калипсо»'}
].filter(place=>byPlace.has(place.id));
function majorLocation(zone){
  if(zone.startsWith('garage'))return 'garage';
  if(zone.startsWith('cabin'))return 'cabin';
  if(cam.inside||zone==='hatch'||zone==='starfish')return 'salon';
  if(['garden','east-canyon','canyon'].includes(zone))return extendedReef?'canyon':'garden';
  return 'reef';
}
const garageReach=()=>cam.pos[2]<1.66&&Math.hypot(cam.pos[0]-ladderWater[0],cam.pos[1]-ladderWater[1])<1.35;
const waterEntrances={
  salon:{caption:'Нижний люк',name:'Войти через нижний люк',anchor:hatch,ready:()=>distance(cam.pos,hatch)<2.35&&cam.pos[2]<1.88,activate:enter},
  garage:{caption:'Лестница в ангар',name:'Войти в ангар',anchor:[6.3,3.32,1.64],ready:garageReach,activate:()=>ladderCross(true)},
  cabin:{caption:'Вход в хижину',name:'Войти в хижину',anchor:cabinLadder,ready:()=>atCabinLadder(cam.pos),activate:()=>arrive(byPlace.get('cabin-wet'))}
};
function openFieldNote(id){
  const dialog=byId('sea-info');renderFieldNote(dialog,id);openDialog(dialog);dialog.scrollTop=0;
}
let introPinsUntil=0;
const seaPins=fittedHangar&&createSeaWaypoints(byId('sea-pins'),majorPlaces,waterEntrances,openFieldNote);
byId('sea-guide').hidden=!seaPins;
const menuPlaces=['reef','salon','garage','cabin',extendedReef?'canyon':'garden']
  .map(id=>majorPlaces.find(place=>place.id===id)).filter(Boolean);
// Arrival views are separate from the close-range ladder and exhibit stops.
const arrivalViews=fittedHangar?{
  salon:{pos:[-.594,-1.94,3.89],look:[.873,-4.492,3.312]},
  garage:{sea:true,pos:[8.65,-.22,1.02],look:[6.30,5,2.33]},
  cabin:{sea:true,pos:[7.234,-35.171,-20.894],look:[8.656,-32.749,-19.839]}
}:{};
const veil=byId('dive-transition'),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let travelling=false;
async function transitionTo(change,opening=false){
  if(travelling)return;
  if(reduceMotion.matches){change();return;}
  travelling=true;controlsOff();veil.hidden=false;
  try{
    if(!opening)await veil.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-in',fill:'forwards'}).finished;
    change();
    await new Promise(requestAnimationFrame);
    await veil.animate([{opacity:1},{opacity:0}],{duration:opening?650:380,easing:'ease-out',fill:'forwards'}).finished;
  }finally{
    veil.hidden=true;for(const anim of veil.getAnimations())anim.cancel();travelling=false;
  }
}
let currentPlace=null;
for(const place of menuPlaces){
  const b=document.createElement('button');
  b.type='button';b.dataset.place=place.id;
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const use=document.createElementNS(icon.namespaceURI,'use');
  const motif=['garden','canyon'].includes(place.id)?'coral':place.id;
  use.setAttribute('href','place-icons.svg#'+motif);icon.setAttribute('viewBox','0 0 64 52');
  icon.setAttribute('aria-hidden','true');icon.append(use);b.append(icon);
  const name=document.createElement('span');name.textContent=place.name;b.append(name);
  const here=document.createElement('small');here.textContent='Вы здесь';here.hidden=true;b.append(here);
  b.onclick=()=>{places.close();transitionTo(()=>arrive(arrivalViews[place.id]??byPlace.get(place.id)));};
  byId('major-places').append(b);place.button=b;
}
function choosePlace(){
  for(const place of menuPlaces){
    place.button.lastElementChild.hidden=place!==currentPlace;
    if(place===currentPlace)place.button.setAttribute('aria-current','location');
    else place.button.removeAttribute('aria-current');
  }
  openDialog(places);
}
for(const item of exhibits){
  const stop=document.createElement('button');stop.textContent=item.name;
  stop.onclick=()=>{$.guide.close();navigateInside(item.stop,item.target);};
  byId('wing-stops').append(stop);
}
byId('wing-guide').hidden=!wingEdition;byId('legacy-guide').hidden=wingEdition;
$.pin.classList.toggle('waypoint',wingEdition);
document.body.classList.toggle('touch-mode',matchMedia('(pointer:coarse)').matches);
document.addEventListener('pointerdown',e=>{
  document.body.classList.toggle('touch-mode',e.pointerType==='touch');
},{passive:true});
function say(text){$.hint.textContent=text;$.hint.classList.add('show');clearTimeout(hintTimer);hintTimer=setTimeout(()=>$.hint.classList.remove('show'),3400);}
function dismissFirstControls(){if(running&&!firstControls.hidden)firstControls.hidden=true;}
document.addEventListener('pointerdown',dismissFirstControls,true);
document.addEventListener('keydown',dismissFirstControls,true);
function controlsOff(){
  keys.clear();
  const captures=[[lookId,$.sea],[moveId,moveButton]];
  lookId=moveId=null;
  moveButton?.classList.remove('held');moveButton=null;moveDirection=0;
  for(const [id,element] of captures){
    if(id!==null&&element.hasPointerCapture(id))element.releasePointerCapture(id);
  }
}
function openDialog(d){controlsOff();route=null;
  if(d===galleyNotes&&!byId('galley-photo').hasChildNodes())byId('galley-photo').append(fieldPhoto('film-salon'));
  const gallery=d.querySelector('[data-gallery]');
  if(gallery&&!gallery.hasChildNodes())gallery.append(photoGallery(gallery.dataset.gallery.split(' ')));
  const photo=d.querySelector('img[data-src]');
  if(photo&&!photo.hasAttribute('src'))loadCardPhoto(photo,photo.dataset.src);
  const article=d.querySelector('article');
  article.tabIndex=-1;
  d.showModal();
  article.focus({preventScroll:true});
}
for(const d of dialogs){
  d.querySelectorAll('.close,.resume').forEach(b=>b.onclick=()=>d.close());
  d.addEventListener('close',()=>{controlsOff();if(!modal())$.sea.focus({preventScroll:true});});
  d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}};
}
$.help.onclick=()=>{byId('wing-stops').hidden=!(wingEdition&&cam.inside&&!cam.remoteRoom);openDialog($.guide);};
const tapeDeck=byId('tape-deck');
tapeDeck.onclick=()=>{
  cam.tapeRunning=!cam.tapeRunning;
  tapeDeck.setAttribute('aria-pressed',String(cam.tapeRunning));
  tapeDeck.title=cam.tapeRunning?'Остановить магнитофон':'Запустить магнитофон';
  updateAudio(0);
};
const showerSwitch=byId('shower-switch');
showerSwitch.onclick=()=>{
  cam.showerOn=!cam.showerOn;
  showerSwitch.textContent=cam.showerOn?'Выключить воду':'Включить воду';
  byId('shower-notes').close();
};
function examine(){
  const image=byId('sample-image');
  if(!image.hasAttribute('src'))image.src='assets/lab4/plankton.jpg';
  if($.notes.open)$.notes.close();
  openDialog(ocular);
}
byId('look-through').hidden=wingEdition||!hasSpecimen;
byId('look-through').onclick=examine;
function aim(point){
  const [x,y,z]=point.map((v,i)=>v-cam.pos[i]);cam.yaw=Math.atan2(y,x);cam.pitch=Math.atan2(z,Math.hypot(x,y));
}
function reset(){
  climbing=null;Object.assign(cam,startPose,{remoteRoom:null,pos:[...startPose.pos]});route=null;controlsOff();
  if(wetEdition&&['#radio-from-berth','#radio-from-wet'].includes(location.hash)){
    cam.inside=true;cam.pos=wingPoint(2.50,0,3.80,angles[location.hash==='#radio-from-wet'?1:2]);aim(salonPoint(.03,1.60,3.48));return;
  }
  const initial=byPlace.get(location.hash.slice(1));
  if(initial){arrive(initial);return;}
  const exhibit=wingEdition&&exhibits.find(item=>'#'+item.id===location.hash);
  if(exhibit){cam.inside=true;cam.pos=exhibit.stop.slice();aim(exhibit.target);return;}
  if(wingEdition&&location.hash==='#entrance'){
    cam.inside=true;cam.pos=wingPoint(.45,.70,3.83);aim(wingPoint(1.98,0,3.97));return;
  }
  if(wingEdition&&location.hash==='#lining'){
    cam.inside=true;cam.pos=wingPoint(1.89,0,3.81);aim(wingPoint(3.68,.19,4.03));return;
  }
  if(location.hash==='#microscope'&&hasSpecimen){
    cam.inside=true;cam.pos=[3.463,-1.679,3.69];
    aim([3.954,-1.797,3.545]);return;
  }
  if(location.hash==='#aquarium'){
    cam.inside=true;cam.pos=[2.456,-2.109,3.73];
    aim([3.36,-2.345,3.40]);say('Аквариум лаборатории');return;
  }
  if(fittedHangar){arrive(villageView);return;}
  aim([1.4,-3,2.6]);say('Подплывите к нижнему люку «Морской звезды»');
}
$.reset.onclick=()=>{$.guide.close();reset();};
const actionKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','KeyE']);
window.addEventListener('keydown',e=>{
  if(!running||modal()||travelling)return;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){keys.add(e.code);return;}
  if(!actionKeys.has(e.code))return;
  if(e.code==='Space'&&e.target instanceof HTMLButtonElement)return;
  e.preventDefault();if(e.code==='KeyE'){if(!e.repeat)command?.();}else{keys.add(e.code);route=null;}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',controlsOff);
document.addEventListener('visibilitychange',()=>{if(document.hidden)controlsOff();previous=0;});
window.addEventListener('pagehide',controlsOff);
$.sea.oncontextmenu=e=>e.preventDefault();
let lastX=0,lastY=0;
$.sea.onpointerdown=e=>{
  if(!running||modal()||lookId!==null||(e.pointerType==='mouse'&&e.button!==0))return;
  $.sea.setPointerCapture(e.pointerId);lookId=e.pointerId;lastX=e.clientX;lastY=e.clientY;route=null;
};
$.sea.onpointermove=e=>{
  if(e.pointerId!==lookId)return;
  cam.yaw-=(e.clientX-lastX)*.0045;cam.pitch=clamp(cam.pitch-(e.clientY-lastY)*.0045,-1.4,1.4);lastX=e.clientX;lastY=e.clientY;
};
function endLook(e){
  if(e.pointerId!==lookId)return;
  lookId=null;
}
$.sea.onpointerup=endLook;
$.sea.onpointercancel=endLook;
$.sea.onlostpointercapture=endLook;
for(const [button,direction] of [[$.forward,1],[$.backward,-1]]){
  button.oncontextmenu=e=>e.preventDefault();
  // Suppress the native long-press preview on iOS; pointer capture still drives movement.
  button.addEventListener('touchstart',event=>event.preventDefault(),{passive:false});
  button.onpointerdown=e=>{
    if(!running||modal()||moveId!==null||e.button!==0)return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    moveId=e.pointerId;moveButton=button;moveDirection=direction;
    button.classList.add('held');route=null;
  };
  function release(e){
    if(moveId!==e.pointerId||moveButton!==button)return;
    moveId=null;moveButton=null;moveDirection=0;
    button.classList.remove('held');
  }
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;
}
$.action.onclick=choosePlace;
function move(dt,steps=1){
  const has=k=>Number(keys.has(k));
  cam.yaw+=(has('ArrowLeft')-has('ArrowRight'))*dt*1.65/steps;
  const f=has('KeyW')+has('ArrowUp')-has('KeyS')-has('ArrowDown')+moveDirection,s=has('KeyD')-has('KeyA'),v=has('Space')-has('KeyC');
  const norm=Math.max(1,Math.hypot(s,f)),speed=dt*(cam.inside?1.28:3.1)/norm,cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
  const forward=f*(cam.inside?1:Math.cos(cam.pitch));
  const deltas=[speed*(cy*forward+sy*s),speed*(sy*forward-cy*s),cam.inside?0:dt*2.35*v+speed*f*Math.sin(cam.pitch)];
  if(cam.remoteRoom==='garage-deck'&&garageDeck){
    moveOnGallery(deltas[0],deltas[1],!!f&&!s&&lookId===null);
    return;
  }
  for(const [i,d] of deltas.entries()){
    if(!d)continue;
    const p=cam.pos.slice();p[i]+=d;const free=cam.remoteRoom?remoteFree(cam.remoteRoom,p,garageDeck):cam.inside?deck.free(p):canSwim(p,!!draw.calypsoHull,extendedReef,fittedHangar)&&(!villageEdition||expeditionWaterFree(p,performance.now()/1000,draw.calypsoHull,draw.reefChannels,draw.saucerMotion,draw.spurHeads,!fittedHangar));
    if(free)cam.pos=p;
  }
}
// Integrate along the curved gallery while respecting the original collision cells.
function moveOnGallery(dx,dy,turnWithPath){
  const length=Math.hypot(dx,dy);
  if(!length)return;
  const slices=Math.ceil(length/.012),x=cam.pos[0]-6.30,y=cam.pos[1]-5;
  let a=Math.atan2(y,x),r=Math.hypot(x,y);
  const along=(-dx*Math.sin(a)+dy*Math.cos(a))/slices;
  const radial=(dx*Math.cos(a)+dy*Math.sin(a))/slices;
  const assist=clamp((Math.abs(along)*slices/length-.34)/.49,0,1);
  for(let i=0;i<slices;i++){
    const next=a+along/r;
    const centre=1.915-.237*Math.max(0,Math.sin(next))**1.5;
    const correction=clamp(centre-r,-length/slices,length/slices);
    const aimed=r+radial*(1-assist)+correction*assist;
    // Check the full input first, then slide along the deck or steer toward its clear centre.
    let advanced=false;
    for(const [angle,radius] of [[next,aimed],[next,r],[a,aimed]]){
      const p=[6.30+radius*Math.cos(angle),5+radius*Math.sin(angle),cam.pos[2]];
      if(!garageDeck.free(p))continue;
      if(turnWithPath)cam.yaw+=(angle-a)*assist;
      cam.pos=p;a=angle;r=radius;advanced=true;break;
    }
    if(!advanced)break;
  }
}
function follow(points,finish,focus){
  controlsOff();if(!points.length){finish?.();return;}route={points,finish,focus};
}
function navigateInside(dest,focus){
  const path=deck.path(cam.pos,dest);
  if(!path.length&&distance(cam.pos,dest)>.25){say('Сделайте шаг в центральный проход');return;}
  if(deck.free(dest))path.push(dest.slice());
  follow(path,()=>{aim(focus);},focus);
}
function swimToHatch(){
  const [x,y,z]=cam.pos,approach=[hatch[0]-1.27,hatch[1]+2.5,1.15],pts=[];
  if(z<1.8 && distance(cam.pos,hatch)<4){
    const near=cam.pos.map((value,i)=>hatch[i]+(value-hatch[i])*.56);
    follow([near],()=>aim(hatch));return;
  }
  // Leave the footprint horizontally when starting below a hull.
  if(z<1.88&&Math.hypot(x-origin[0],y-origin[1])<5.2){
    const a=Math.atan2(y-origin[1],x-origin[0]);pts.push([origin[0]+6*Math.cos(a),origin[1]+6*Math.sin(a),Math.max(.65,z)]);
  }
  const p=pts.at(-1)||cam.pos;
  pts.push([p[0],p[1],Math.max(7.2,p[2])],[approach[0],approach[1],7.2],approach,[hatch[0]-.65,hatch[1]+1.25,1.1]);
  follow(pts,()=>aim(hatch));
}
function enter(){cam.inside=true;cam.pos=[-.56,-1.68,3.88];aim([origin[0],origin[1],3.64]);say('Через салон — к лабораторному столу');}
function leave(){
  cam.inside=false;
  route=null;controlsOff();
  // Frame the hatch cage on the left and the hangar behind it on narrow screens too.
  const aspect=Math.min(1.8,$.sea.clientWidth/Math.max(1,$.sea.clientHeight));
  const halfWidth=aspect*Math.tan((aspect<1?79:68)*Math.PI/360);
  const hatchAngle=Math.atan((aspect<1?.74:.92)*halfWidth),hangarAngle=Math.atan(.16*halfWidth);
  const dx=6.3-hatch[0],dy=5-hatch[1],spread=hatchAngle-hangarAngle;
  const bearing=Math.atan2(dy,dx)+spread+Math.asin(1.97*Math.sin(spread)/Math.hypot(dx,dy));
  cam.pos=[hatch[0]-1.97*Math.cos(bearing),hatch[1]-1.97*Math.sin(bearing),1.21];
  cam.yaw=bearing-hatchAngle;cam.pitch=.155;
  say('Вы снова у рифа');
}
function read(){openDialog($.notes);}
const ladderWater=[6.30,3.60,1.40], ladderTop=[6.30,3.60,3.39];
let climbing=null;
function ladderCross(up){
  const landing=garageDeck.entry;
  const path=up?[ladderWater,ladderTop,landing]:[ladderTop,ladderWater];
  controlsOff();route=null;climbing={path,up};
}
function stepLadder(dt){
  const target=climbing.path[0],delta=target.map((v,i)=>v-cam.pos[i]);
  const length=Math.hypot(...delta),step=dt*1.48;
  if(length<=step){cam.pos=target.slice();climbing.path.shift();}
  else cam.pos=cam.pos.map((v,i)=>v+delta[i]*step/length);
  cam.inside=cam.pos[2]>=2.15;cam.remoteRoom=cam.inside?'garage-deck':null;
  if(!climbing.path.length){
    const up=climbing.up;climbing=null;controlsOff();
    aim(up?[6.46,7.12,3.17]:[6.66,1.12,1.10]);
  }
}
function descendHangar(){
  const path=garageDeck.path(cam.pos,garageDeck.entry);
  if(!path.length&&distance(cam.pos,garageDeck.entry)>.07)return;
  follow([...path,garageDeck.entry],()=>ladderCross(false));
}
function advance(dt){
  if(climbing){stepLadder(dt);return;}
  if(!route){
    const steps=keys.has('ShiftLeft')||keys.has('ShiftRight')?2:1;
    for(let i=0;i<steps;i++)move(dt,steps);
    return;
  }
  const p=route.points[0],d=distance(p,cam.pos),step=dt*(cam.inside?1.28:5.6);
  if(d<=step){
    cam.pos=p.slice();route.points.shift();
    if(!route.points.length){const fn=route.finish;route=null;fn?.();}return;
  }
  const delta=p.map((v,i)=>v-cam.pos[i]);const t=Math.min(1,dt*4);
  if(Math.hypot(delta[0],delta[1])>.10)cam.yaw+=angleDiff(Math.atan2(delta[1],delta[0]),cam.yaw)*t;
  const pitch=cam.inside?-.055:clamp(Math.atan2(delta[2],Math.hypot(delta[0],delta[1])),-.56,.56);
  cam.pitch+=(pitch-cam.pitch)*t;cam.pos=cam.pos.map((v,i)=>v+delta[i]*step/d);
}
function display(el,value){if(el.textContent!==value)el.textContent=value;}
function wingLocation(){
  // Both worktops share one aisle. Resolve the station immediately in front of the visitor.
  const [u,v]=roomPoint(cam.pos,angles[0]);
  const turn=cam.yaw-angles[0];
  const facingSide=v+.58*Math.sin(turn);
  if(facingSide>.21){
    const station=u+.58*Math.cos(turn);
    if(station>=3.76)return 'darkroom';
    if(station>3.255)return 'wc';
    return 'kitchen';
  }
  if(facingSide<-.21)return 'lab';
  return u<2.60?'kitchen':'lab';
}
// A marker in another wing is visible through its doorway and the observer's doorway.
const wingByZone={salon:-1,lab:0,kitchen:0,wc:0,darkroom:0,wet:1,berth2:2,berth4:3};
function wingVisible(zone,targetWing,point){
  if(cam.remoteRoom)return false;
  const fromWing=wingByZone[zone];
  if(fromWing===targetWing)return true;
  for(const wing of [fromWing,targetWing]){
    if(wing<0)continue;
    const [u,v]=roomPoint(cam.pos,angles[wing]),[s,t]=roomPoint(point,angles[wing]);
    const fraction=(1.92-u)/(s-u);
    if(!(fraction>=0&&fraction<=1)||Math.abs(v+fraction*(t-v))>.61)return false;
  }
  return true;
}
const inspectLabels={console:'Осмотреть пульт',claude:'Узнать о Клоде',table:'Осмотреть стол',
  windows:'Осмотреть иллюминаторы',shower:'Осмотреть душ',divegear:'Осмотреть снаряжение',
  microscope:'Посмотреть в микроскоп',aquarium:'Осмотреть аквариум',kitchen:'Осмотреть плиту'};
const withinReach=(point,radius)=>Math.hypot(cam.pos[0]-point[0],cam.pos[1]-point[1])<radius;
function interiorActions(){
  const items=exhibits.map(item=>{
    const anchor=item.anchor??item.target,wing=item.salon?-1:item.wet?1:0;
    return {id:item.id,anchor,caption:item.name,name:inspectLabels[item.id],activate:item.open,
      visible:zone=>wingVisible(zone,wing,anchor),ready:()=>distance(cam.pos,item.target)<1.25};
  });
  const crewAnchor=wingPoint(2.94,.08,3.72,angles[3]);
  items.push({id:'village-crew',anchor:crewAnchor,caption:'Кто жил под водой?',name:'Кто жил под водой?',
    visible:zone=>wingVisible(zone,3,crewAnchor),ready:()=>withinReach(crewAnchor,1.5),activate:()=>openFieldNote('village-crew')});
  const cabinBeds=cabinPoint(-.54,-.15,5.01);
  items.push({id:'cabin-beds',anchor:cabinBeds,caption:'Койки океанавтов',name:'Неделя в хижине',
    visible:zone=>zone==='cabin-deck',ready:()=>withinReach(cabinBeds,1.5),activate:()=>openFieldNote('cabin-beds')});
  const wetHatch=[...deck.entry.slice(0,2),2.67];
  items.push({id:'wet-exit',caption:'Люк в море',name:'Выйти в море',anchor:wetHatch,
    visible:zone=>wingVisible(zone,1,wetHatch),ready:()=>distance(cam.pos,deck.entry)<1.15,activate:leave});
  const hangar=garageDeck?[6.30,3.36,2.70]:[6.30,6.78,2.75];
  const pressureAnchor=[6.95,4.59,2.40];
  const cabinHatch=cabinPoint(0,0,1.88),ladder=cabinPoint(.59,.13,3.04),upper=cabinPoint(.61,.42,4.10);
  items.push(
    ...(garageDeck?[{id:'hangar-winch',caption:'Лебёдка',name:'Осмотреть лебёдку',anchor:[6.3,5,3.97],
      visible:zone=>zone==='garage-deck',ready:()=>withinReach([6.3,5],1.95),activate:()=>openFieldNote('winch')},
      {id:'hangar-pressure',caption:'Воздух над водой',name:'Что удерживало воду?',anchor:pressureAnchor,
        visible:zone=>zone==='garage-deck',ready:()=>withinReach(pressureAnchor,2.30),activate:()=>openFieldNote('hangar-pressure')}]:[]),
    {id:'cabin-instruments',caption:'Пульт контроля воздуха',name:'Осмотреть пульт',anchor:cabinPoint(.78,-.67,5.06),
      visible:zone=>zone==='cabin-deck',ready:()=>withinReach(cabinPoint(.78,-.67,5.06),1.06),activate:()=>openFieldNote('atmosphere')},
    {id:'hangar-exit',caption:'Лестница в море',name:'Спуститься в море',anchor:hangar,visible:zone=>zone==='garage-deck',
      ready:()=>withinReach(garageDeck?.entry??hangar,1.12),activate:garageDeck?descendHangar:()=>arrive({sea:true,pos:[6.3,5,1.42],look:[4.5,2,1.28]})},
    {id:'cabin-exit',caption:'Люк в море',name:'Выйти в море',anchor:cabinHatch,visible:zone=>zone==='cabin-wet',
      ready:()=>withinReach(cabinHatch,.96),activate:()=>arrive({sea:true,pos:cabinPoint(0,-1.78,.84),look:cabinLadder})},
    {id:'cabin-up',caption:'Лестница на жилой ярус',name:'Подняться на жилой ярус',anchor:ladder,visible:zone=>zone==='cabin-wet',
      ready:()=>withinReach(ladder,1.07),activate:()=>arrive(byPlace.get('cabin-deck'))},
    {id:'cabin-down',caption:'Люк на входной ярус',name:'Спуститься на входной ярус',anchor:upper,visible:zone=>zone==='cabin-deck',
      ready:()=>withinReach(upper,.88),activate:()=>arrive({...byPlace.get('cabin-wet'),pos:cabinPoint(.79,-.07,3.03),look:cabinPoint(0,0,1.88)})}
  );
  return items;
}
let interiorPins;
const doorTitle=byId('door-title');
const roomNames=['Кухня и лаборатория','Мокрый отсек',byPlace.get('berth2').name,byPlace.get('berth4').name];
const entrances=angles.map((angle,i)=>({
  angle,name:roomNames[i],anchor:[origin[0]+1.98*Math.cos(angle),origin[1]+1.98*Math.sin(angle),4.19]
}));
function updateDoorTitle(project){
  $.location.hidden=true;
  if(!wingEdition||!cam.inside||cam.remoteRoom){doorTitle.hidden=true;return;}
  const inWing=entrances.find(door=>{
    const [u,v]=roomPoint(cam.pos,door.angle);
    return u>1.90&&Math.abs(v)<1.22;
  });
  let selected=null;
  for(const door of entrances){
    if(inWing&&inWing!==door)continue;
    const [u,v]=roomPoint(cam.pos,door.angle);
    const range=Math.abs(1.98-u);
    if(range<=.36||range>=3.42||Math.abs(v)>range*.80+.19)continue;
    const p=project(door.anchor);
    if(!p||p[0]<40||p[0]>innerWidth-40||p[1]<48||p[1]>innerHeight*.72)continue;
    const offset=Math.abs(p[0]/innerWidth-.5);
    if(selected&&offset>=selected.offset)continue;
    const fade=clamp((range-.36)/.80,0,1)*clamp((3.42-range)/.45,0,1);
    selected={p,offset,fade:fade*fade*(3-2*fade),name:inWing?'Общий зал':door.name};
  }
  doorTitle.hidden=!selected;
  if(selected){
    display(doorTitle,selected.name);
    doorTitle.style.left=selected.p[0]+'px';doorTitle.style.top=selected.p[1]+'px';
    doorTitle.style.opacity=selected.fade;
  }
}
function whereAmI(){
  if(cam.remoteRoom)return cam.remoteRoom;
  if(villageEdition&&!cam.inside){
    const [x,y,z]=cam.pos;
    for(const channel of draw.reefChannels){
      const j=Math.floor((y-channel.y)/channel.cell);
      if(channel.centre){
        if(Math.abs(x-channel.centre[j])<6.2 && z<8.5)return channel.id;
      }else if(x< -13&&j>=0&&j<channel.sections.length&&z<6.7)return 'canyon';
    }
    if(fittedHangar ? z>6.4&&keelDistance(cam.pos,draw.calypsoHull)<9 : z>6.4&&y>6&&x<12)return 'ships';
    if(!fittedHangar&&z>4.2&&y>-.1&&x>12)return 'supply';
    if(x< -6&&y> -8&&y<9&&z<5)return 'garden';
    if(Math.hypot(x-3.3,y-.82)<3.05&&z<2.75)return 'pens';
    if(distance(cam.pos,saucerPose(performance.now()/1000,draw.saucerMotion).look)<5.8)return 'denise';
  }
  if(!cam.inside){
    if(distance(cam.pos,hatch)<2.35)return 'hatch';
    if(Math.hypot(cam.pos[0]-10,cam.pos[1]+30)<8&&cam.pos[2]<-9)return 'cabin';
    if(Math.hypot(cam.pos[0]-6.3,cam.pos[1]-5)<6&&cam.pos[2]<7)return 'garage';
    if(fittedHangar&&Math.min(distance(cam.pos,hatch),distance(cam.pos,[...origin,3.7]))<5)return 'starfish';
    return 'reef';
  }
  const wing=angles.findIndex(a=>{const [u,v]=roomPoint(cam.pos,a);return u>1.92&&Math.abs(v)<1.22;});
  if(wing===0)return wingLocation();
  return ['','wet','berth2','berth4'][wing]||'salon';
}
function hud(project,time){
  updateDoorTitle(project);
  const zone=whereAmI();
  currentPlace=menuPlaces.find(place=>place.id===majorLocation(zone));
  display($.action,currentPlace?.name??'Локации');
  const available=!route&&!climbing;
  const indoorFocus=interiorPins(cam.inside&&available?project:null,zone);
  const exterior=!cam.inside&&available;
  if(introPinsUntil===null)introPinsUntil=performance.now()/1000+3.8;
  const seaFocus=seaPins&&seaPins(cam.pos,exterior?project:null,exterior?saucerPose(time,draw.saucerMotion).look:null,zone,time,draw.calypsoHull,time<introPinsUntil);
  $.pin.hidden=true;
  if(!available){command=route?()=>{route=null;}:null;return;}
  if(cam.inside){command=indoorFocus??choosePlace;return;}
  if(seaPins){command=seaFocus??Object.values(waterEntrances).find(e=>e.ready())?.activate??choosePlace;return;}
  // Archived editions use a single exterior waypoint.
  const atHatch=zone==='hatch';
  let anchor=hatch,caption=atHatch?'Войти через люк':'К люку',nav=atHatch?enter:swimToHatch;
  if(villageEdition&&(zone==='garage'||zone==='cabin')){
    const garage=zone==='garage';
    anchor=garage?[6.30,6.78,2.1]:cabinLadder;
    caption=garage?'Войти в ангар':'Войти в хижину';
    nav=()=>arrive(byPlace.get(garage?'garage-deck':'cabin-wet'));
  }
  const point=project(anchor);
  $.pin.hidden=!(point&&point[0]>12&&point[0]<innerWidth-110&&point[1]>86&&point[1]<innerHeight-28&&distance(cam.pos,anchor)<9);
  command=$.pin.hidden?choosePlace:nav;
  if(!$.pin.hidden){$.pin.onclick=nav;$.pin.setAttribute('aria-label',caption);display($.pin.lastElementChild,caption);$.pin.style.transform='translate('+point[0]+'px,'+point[1]+'px)';}
}
const rateLabel=byId('frame-rate');
const showFrameRate=new URLSearchParams(location.search).get('fps')==='1';
let sampleTime=0,sampleFrames=0;
function frame(now){
  if(!running)return;
  const elapsed=previous?(now-previous)/1000:0;previous=now;
  if(!document.hidden&&!modal()){
    const before=cam.pos.slice();
    advance(Math.min(.045,elapsed));
    updateAudio(distance(before,cam.pos));
    hud(draw(cam,now/1000,elapsed),now/1000);
    if((showFrameRate||['#hatch','#lab','#aquarium','#microscope','#kitchen','#wc','#salon','#console','#claude','#table','#windows'].includes(location.hash))&&elapsed>0){
      sampleTime+=elapsed;sampleFrames++;
      if(sampleTime>=2){
        rateLabel.hidden=false;display(rateLabel,Math.round(sampleFrames/sampleTime)+' кадр/с');
        sampleTime=0;sampleFrames=0;
      }
    }else{rateLabel.hidden=true;}
  }
  requestAnimationFrame(frame);
}
$.sea.addEventListener('webglcontextlost',e=>{e.preventDefault();controlsOff();running=false;loadingMeter.hidden=true;sound.stop();for(const d of dialogs)d.close();$.hud.hidden=true;$.intro.hidden=false;$.load.textContent='Браузер приостановил 3D. Обновите сцену, чтобы вернуться.';$.start.disabled=false;$.start.textContent='Обновить сцену';$.start.onclick=()=>location.reload();});
function showProgress(value,phase){
  const whole=Math.floor(value);
  if(progress.value!==whole){progress.value=whole;percent.textContent=whole+'%';}
  if($.load.textContent!==phase)$.load.textContent=phase;
}
$.start.onclick=async()=>{
  sound.start();
  $.start.disabled=true;loadingMeter.hidden=false;showProgress(0,'Загружаем подводную деревню…');
  try{
    const [renderer,map]=await Promise.all([createRenderer($.sea,showProgress),getAsset(salonRefit?salonFolder+'walk.json':'walk.json','json')]);
    draw=renderer;deck=makeDeck(map);garageDeck=draw.hangarDeck&&makeDeck(draw.hangarDeck);
    interiorPins=createInteriorMarkers(byId('object-pins'),interiorActions());reset();
    showProgress(100,'Мир готов');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await transitionTo(()=>{
      firstControls.hidden=false;$.intro.hidden=true;$.hud.hidden=false;running=true;$.sea.focus();
      if(seaPins&&!cam.inside&&distance(cam.pos,villageView.pos)<.01)introPinsUntil=null;
      requestAnimationFrame(frame);
    },true);
    warmNearbyPhotos();
  }catch(err){loadingMeter.hidden=true;sound.stop();console.error(err);$.load.textContent=err.message.includes('WebGL')?err.message:'Не удалось загрузить сцену. Проверьте соединение и попробуйте ещё раз.';$.start.disabled=false;$.start.textContent='Попробовать снова';}
};
