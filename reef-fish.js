// Each school has one shared circuit. Member offsets, sizes and tail beats vary.
const shoals=[
  // kind, number, body length, centre, horizontal radii, angular speed, phase
  ['fusilier',46,.31, 1,-11.2,5.5, 3.8,1.35,.16,.2],
  ['butterfly',8,.21, -5.1,-2.2,2.2, 1.1,1.9,-.21,1.4],
  ['anthias',32,.15, -6,.6,1.9, 1.1,1.6,.27,1.1],
  ['jack',7,.77, 7,10,5.8, 3.4,1.7,-.15,.8],
  ['butterfly',9,.24, 10,5,1.55, .75,1.45,.18,1.8],
  ['grouper',1,1.08, 3,-9,1.4, 2.2,1.1,-.15,.1],
  ['fusilier',51,.30, -16,4,5.5, 1.3,4.1,-.17,.5],
  ['anthias',35,.16, 29,3,4.7, 1.1,3.1,.19,2],
  ['jack',4,.91, 17,-16,4.6, 4.4,2,.14,1.1],
  ['grouper',1,1.23, 5.3,-30.4,-18.0, 1.25,1.4,.16,1.4],
  ['fusilier',29,.35, 12,-36.5,-16.7, 2.3,1.4,-.18,1],
  ['butterfly',5,.25, 13.4,-31.8,-18.2, .72,.9,.20,2.4],
  ['jack',12,.65, -6,12,6.6, 3.7,1.7,.15,2.2],
  ['shark',1,2.05, -5,-16,3.45, 5.1,2.35,.105,1.0]
];
// Individual passes along the glazing. Lateral sweeps, depth and pauses vary independently.
const bayFish=Array.from({length:7},(_,i)=>[[ 'fusilier','butterfly','jack'][i%3],1,.20+.021*i]);
function bayPose(i,t){
  const phase=i*2.397,rate=.24+.019*(i%4),a=t*rate+phase+.31*Math.sin(t*.27+phase);
  const across=1.86*Math.sin(a)+.42*Math.sin(t*.43+phase);
  const out=4.32+.47*Math.sin(t*.27+phase*2)+.17*Math.cos(2*a);
  const dz=3.65+.26*Math.sin(t*.37+phase)+.12*Math.sin(a*1.6);
  const da=rate+.0837*Math.cos(t*.27+phase);
  const va=1.86*Math.cos(a)*da+.1806*Math.cos(t*.43+phase);
  const vo=.1269*Math.cos(t*.27+phase*2)-.34*Math.sin(2*a)*da;
  return [.6505+.887*out+.461*across,-4.0958-.461*out+.887*across,dz,
    Math.atan2(-.461*vo+.887*va,.887*vo+.461*va)];
}
const shark=shoals.find(s=>s[0]==='shark');
function pose(s,t){
  const [, , ,x,y,z,rx,ry,speed,phase]=s,a=t*speed+phase;
  return [x+rx*Math.cos(a),y+ry*Math.sin(a),z+.17*Math.sin(2*a),Math.atan2(ry*Math.cos(a)*speed,-rx*Math.sin(a)*speed)];
}
export const sharkPosition=t=>pose(shark,t).slice(0,3);

const palette={
  fusilier:[[.12,.44,.59],[.68,.81,.75],[.96,.76,.24],.105,.15],
  butterfly:[[.96,.72,.17],[.97,.83,.32],[.24,.23,.15],.10,.33],
  anthias:[[.88,.35,.30],[.96,.57,.38],[.78,.22,.30],.085,.21],
  jack:[[.34,.49,.50],[.78,.84,.79],[.51,.55,.43],.12,.21],
  grouper:[[.35,.36,.23],[.65,.62,.44],[.39,.32,.23],.165,.24]
};
// Shark coordinates run from tail to nose along X. The last two vertex attributes
// use the same GPU tail beat as the shoals, so all the fins flex with the body.
function reefSharkMesh(size,phase){
  const out=[],tau=Math.PI*2;
  const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const clamp=t=>Math.max(0,Math.min(1,t));
  function vertex(p,color){
    out.push(p[0]*size,p[1]*size,p[2]*size,...color,Math.max(0,.07-p[0])**1.5*size*.38,phase);
  }
  function quad(a,b,c,d){
    for(const [p,color] of [a,b,c,a,c,d])vertex(p,color);
  }
  // x, half breadth, vertical radius and centre height. The last narrow
  // sections round the rostrum without giving the head a conical tip.
  const profile=[
    [-.428,0,0,.006],[-.410,.013,.021,.004],[-.354,.021,.026,.002],
    [-.270,.037,.045,0],[-.170,.058,.069,0],[-.055,.077,.088,.001],
    [.075,.087,.099,.003],[.185,.087,.097,.004],[.275,.080,.085,.004],
    [.349,.070,.064,.003],[.408,.056,.046,.003],[.454,.041,.030,.004],
    [.482,.025,.018,.005],[.494,.013,.009,.005],[.498,0,0,.005]
  ];
  // Monotone cubic interpolation keeps the taper smooth through every station.
  function slope(i,k){
    const p=profile[i],a=profile[Math.max(0,i-1)],b=profile[Math.min(profile.length-1,i+1)];
    if(a===p||b===p)return (b[k]-a[k])/(b[0]-a[0]);
    const l=(p[k]-a[k])/(p[0]-a[0]),r=(b[k]-p[k])/(b[0]-p[0]);
    return l*r>0?2*l*r/(l+r):0;
  }
  function section(x){
    const i=profile.findIndex((p,j)=>j<profile.length-1&&x<=profile[j+1][0]);
    const a=profile[i],b=profile[i+1],dx=b[0]-a[0],t=clamp((x-a[0])/dx),u=1-t;
    return [1,2,3].map(k=>u*u*(1+2*t)*a[k]+t*t*(3-2*t)*b[k]+dx*t*u*(u*slope(i,k)-t*slope(i+1,k)));
  }
  function surface(x,angle,lift=0){
    const [w,h,z]=section(x);
    return [x,(w+lift)*Math.cos(angle),z+(h+lift)*Math.sin(angle)];
  }
  const back=[.30,.38,.40],flank=[.48,.55,.55],belly=[.79,.81,.77];
  function skin(x,a){
    const z=Math.sin(a),line=clamp((-z-.11+.04*Math.cos((x-.10)*8))*2.7);
    return blend(blend(flank,back,clamp(z*.92+.12)),belly,line*line*(3-2*line));
  }
  const rings=[],steps=24;
  function addRing(x){
    rings.push(Array.from({length:steps},(_,i)=>{
      const angle=tau*i/steps;return [surface(x,angle),skin(x,angle)];
    }));
  }
  for(let i=0;i<profile.length-1;i++){
    addRing(profile[i][0]);addRing((profile[i][0]+profile[i+1][0])*.5);
  }
  addRing(profile[profile.length-1][0]);
  for(let r=1;r<rings.length;r++)for(let i=0;i<steps;i++){
    const j=(i+1)%steps;quad(rings[r-1][i],rings[r-1][j],rings[r][j],rings[r][i]);
  }

  // Each fin is a closed foil lofted along its span. A rounded leading edge
  // tapers to the trailing edge and the curved tip.
  const finBase=[.39,.46,.47],margin=[.17,.22,.24];
  function fin(stations,normal,darkEdge=0){
    const sides=12;
    const loops=stations.map(([front,rear,y,z,thickness],r)=>Array.from({length:sides},(_,i)=>{
      const a=tau*i/sides,chord=(1-Math.cos(a))*.5;
      const bulge=thickness*Math.sin(a)*(1.42-.83*chord);
      const edge=clamp((chord-.73)*4)*darkEdge;
      const color=blend(finBase,margin,edge).map(c=>c*(.91+.11*Math.sin(a)+.035*r/stations.length));
      return [[front+(rear-front)*chord,y+bulge*normal[0],z+bulge*normal[1]],color];
    }));
    for(let r=1;r<loops.length;r++)for(let i=0;i<sides;i++){
      const j=(i+1)%sides;quad(loops[r-1][i],loops[r-1][j],loops[r][j],loops[r][i]);
    }
  }
  function median(stations,edge){
    fin(stations.map(([front,rear,z,thickness])=>[front,rear,0,z,thickness]),[1,0],edge);
  }
  median([[.147,-.108,.068,.016],[.111,-.090,.110,.013],[.076,-.059,.163,.009],
    [.041,-.041,.210,.006],[.016,-.029,.236,.003],[-.007,-.020,.244,.001],[-.015,-.015,.2445,0]],.18);
  median([[-.232,-.329,.031,.006],[-.251,-.315,.054,.004],[-.276,-.303,.074,.002],[-.290,-.290,.080,0]],.40);
  median([[-.266,-.340,-.025,.006],[-.286,-.327,-.047,.004],[-.312,-.312,-.062,0]],.30);
  // The narrow caudal wrist flows into unequal lobes; their trailing edges
  // meet at the fork, with a small indentation below the upper tip.
  median([[-.351,-.475,.000,.019],[-.400,-.477,.041,.015],[-.445,-.503,.091,.011],
    [-.490,-.545,.145,.008],[-.532,-.579,.190,.005],[-.561,-.580,.215,.003],
    [-.587,-.608,.235,.002],[-.611,-.611,.240,0]],.97);
  median([[-.352,-.475,0,.018],[-.405,-.477,-.039,.013],[-.445,-.488,-.080,.009],
    [-.475,-.506,-.115,.005],[-.509,-.519,-.145,.002],[-.524,-.524,-.149,0]],.9);
  for(const side of [-1,1]){
    const paired=(stations,edge)=>fin(stations.map(([f,r,y,z,h])=>[f,r,side*y,z,h]),[0,1],edge);
    paired([[.183,.009,.054,-.027,.012],[.145,-.011,.099,-.035,.013],
      [.096,-.034,.150,-.049,.010],[.047,-.056,.193,-.063,.006],
      [.003,-.069,.222,-.072,.004],[-.046,-.075,.242,-.076,.002],[-.077,-.077,.248,-.077,0]],.48);
    paired([[-.123,-.219,.024,-.047,.008],[-.152,-.217,.066,-.054,.006],
      [-.183,-.221,.093,-.064,.003],[-.221,-.221,.104,-.066,0]],.22);
  }

  // All face markings follow the curved skin, including the underside of the jaw.
  function patch(x,a,side,lift,color){
    return [surface(x,side>0?a:Math.PI-a,lift),color];
  }
  const crease=[.19,.24,.245];
  for(const side of [-1,1]){
    for(let g=0;g<5;g++){
      const x=.185+.015*g;
      let prev;
      for(let j=0;j<=7;j++){
        const t=j/7,a=.32-(.75-.04*g)*t,bow=.008*Math.sin(Math.PI*t);
        const width=.0018*Math.sin(Math.PI*t);
        const pair=[patch(x-bow-width,a,side,.0008,crease),patch(x-bow+width,a,side,.0008,crease)];
        if(prev)quad(prev[0],prev[1],pair[1],pair[0]);prev=pair;
      }
    }
    const eyeRings=[[1,[.35,.40,.39]],[.78,[.55,.56,.45]],[.58,[.075,.10,.11]],[0,[.025,.045,.05]]];
    const eyes=eyeRings.map(([r,col])=>Array.from({length:16},(_,i)=>{
      const a=tau*i/16;
      return patch(.370+.012*r*Math.cos(a),.24+.208*r*Math.sin(a),side,.0014+.003*(1-r),col);
    }));
    for(let i=0;i<16;i++)for(let r=1;r<eyes.length;r++){
      const j=(i+1)%16;quad(eyes[r-1][i],eyes[r-1][j],eyes[r][j],eyes[r][i]);
    }
  }
  let previous;
  for(let i=0;i<=32;i++){
    const u=i/16-1,a=-Math.PI/2+1.22*u,x=.443-.083*u*u;
    const taper=1-u*u,w=.0045*taper,arc=.10*u*taper;
    const pair=[[surface(x-w,a-arc,.0012),crease],[surface(x+w,a+arc,.0012),crease]];
    if(previous)quad(previous[0],previous[1],pair[1],pair[0]);previous=pair;
  }
  return out;
}

function schoolMesh(s,random){
  const [kind,count,length]=s;
  if(kind==='shark')return reefSharkMesh(length,random()*Math.PI*2);
  const [back,belly,fin,width,height]=palette[kind],out=[],disc=kind==='butterfly';
  for(let j=0;j<count;j++){
    const size=length*(count===1?1:.74+.49*random()),phase=random()*Math.PI*2;
    const spread=Math.pow(count,.40)*size;
    const offset=count===1?[0,0,0]:[(random()-.5)*spread*3.3,(random()-.5)*spread*1.7,(random()-.5)*spread];
    function v([x,y,z],color){
      out.push(offset[0]+x*size,offset[1]+y*size,offset[2]+z*size,...color,Math.max(0,-x+.07)**1.5*size*.38,phase);
    }
    function tri(a,b,c,shade){for(const p of [a,b,c])v(p,shade);}
    const profile=[[.50,.08],[.44,.65],[.32,.94],[.16,1],[0,.93],[-.18,.70],[-.31,.41],[-.41,.16]];
    const steps=12;
    function section(x,r,angle){return [x,r*width*Math.cos(angle),r*height*Math.sin(angle)];}
    const rings=profile.map(([x,r])=>Array.from({length:steps},(_,i)=>section(x,r,2*Math.PI*i/steps)));
    const skin=Array.from({length:steps},(_,i)=>{
      const t=.51+.48*Math.sin(i*2*Math.PI/steps);
      return back.map((c,j)=>c*t+belly[j]*(1-t));
    });
    for(let k=0;k<rings.length-1;k++)for(let i=0;i<steps;i++){
      const n=(i+1)%steps;
      let c0=skin[i],c1=skin[n];
      if(disc&&(k===1||k===4))c0=c1=k===1?[.16,.17,.14]:[.90,.57,.12];
      if(kind==='fusilier'&&(i===0||i===5))c0=c1=[.89,.75,.37];
      if(kind==='grouper'&&(i*3+k*7)%5===1){c0=c0.map(v=>v*.70);c1=c1.map(v=>v*.70);}
      const a=rings[k],b=rings[k+1];
      v(a[i],c0);v(a[n],c1);v(b[i],c0);
      v(a[n],c1);v(b[n],c1);v(b[i],c0);
    }
    for(let i=0;i<steps;i++)tri([profile[0][0]+.002,0,0],rings[0][i],rings[0][(i+1)%steps],back);
    const tailTop=disc?.14:.21,tailBottom=tailTop;
    tri([-.38,0,.018],[-.64,0,tailTop],[-.49,0,.002],fin);
    tri([-.38,0,-.018],[-.49,0,.002],[-.60,0,-tailBottom],fin);
    tri([-.41,0,.025],[-.50,0,.002],[-.41,0,-.025],fin);
    tri([.11,0,height*.93],[-.065,0,height*1.46],[-.17,0,height*.68],fin);
    for(const side of [-1,1]){
      tri([.14,side*width,-height*.1],[-.16,side*width*1.85,-height*.56],[-.04,side*width*.85,-height*.44],fin);
      const e=[.342,side*width*.95,height*.20];
      for(let k=0;k<8;k++){
        const pt=i=>[e[0]+.018*Math.cos(i*Math.PI/4),e[1],e[2]+.018*Math.sin(i*Math.PI/4)];
        tri(e,pt(k),pt(k+1),[.04,.07,.065]);
      }
    }
  }
  return out;
}
const fishVS=`attribute vec3 p,color;attribute vec2 beat;
uniform vec3 eye,forward,right,up;uniform vec2 lens,heading;
uniform mediump vec3 centre;uniform float phase,drift;
varying vec3 pigment;varying float range;
void main(){
  vec3 local=p;
  float stroke=phase+beat.y-beat.x*2.;
  local.y+=beat.x*sin(stroke)+drift*.65*sin(phase*.29+beat.y);
  local.z+=beat.x*.14*cos(stroke)+drift*.42*cos(phase*.23+beat.y);
  local.x+=drift*sin(phase*.19+beat.y);
  vec3 d=centre+vec3(mat2(heading.x,heading.y,-heading.y,heading.x)*local.xy,local.z)-eye;
  float z=dot(d,forward);gl_Position=vec4(dot(d,right)*lens.x,dot(d,up)*lens.y,z*1.00067-.08003,z);
  pigment=color;range=length(d);
}`;
const fishFS=`precision mediump float;uniform vec3 centre;varying vec3 pigment;varying float range;
void main(){
  float deep=smoothstep(-25.,5.,centre.z);
  vec3 fog=mix(vec3(.029,.15,.24),vec3(.055,.31,.44),deep);
  vec3 col=pigment*mix(vec3(.45,.65,.74),vec3(.86,.94,.94),deep);
  gl_FragColor=vec4(mix(fog,col,exp(-range*.051)),1.);
}`;
export function createReefFish(gl,program){
  const shader=program(gl,fishVS,fishFS),beat=gl.getAttribLocation(shader.prog,'beat');
  const uniforms=Object.fromEntries(['centre','heading','phase','drift'].map(k=>[k,gl.getUniformLocation(shader.prog,k)]));
  let seed=1963;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const groups=[];
  const fishGroups=[...shoals,...bayFish];
  const chunks=fishGroups.map(s=>new Float32Array(schoolMesh(s,random)));
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,chunks.reduce((sum,chunk)=>sum+chunk.byteLength,0),gl.STATIC_DRAW);
  let first=0;
  chunks.forEach((chunk,i)=>{
    gl.bufferSubData(gl.ARRAY_BUFFER,first*32,chunk);
    const count=chunk.length/8;groups.push({s:fishGroups[i],bay:i-shoals.length,first,count});first+=count;
  });
  return (time,camera,visible)=>{
    camera(shader);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [slot,width,offset] of [[shader.p,3,0],[shader.color,3,12],[beat,2,24]]){
      gl.enableVertexAttribArray(slot);gl.vertexAttribPointer(slot,width,gl.FLOAT,false,32,offset);
    }
    for(const {s,bay,first,count} of groups){
      const [x,y,z,angle]=bay>=0?bayPose(bay,time):pose(s,time);
      if(!visible(x,y,z,2+s[2]*Math.pow(s[1],.4)*2))continue;
      gl.uniform3f(uniforms.centre,x,y,z);gl.uniform2f(uniforms.heading,Math.cos(angle),Math.sin(angle));
      gl.uniform1f(uniforms.drift,s[1]>1?s[2]*.80:0);
      gl.uniform1f(uniforms.phase,time*(s[0]==='shark'?2.1:4.3+Math.max(bay,0)*.15));gl.drawArrays(gl.TRIANGLES,first,count);
    }
    for(const slot of [shader.p,shader.color,beat])gl.disableVertexAttribArray(slot);
  };
}
