import {createReefFish} from './reef-fish.js?v=shark38';
// The export is in Blender world space, with Z up and one interleaved vertex buffer.
const meshVS = `
attribute vec3 p,n,color;
attribute vec2 paintUV;
varying vec2 enamelUV;
varying vec3 restPosition;
uniform vec3 eye,forward,right,up;
uniform vec2 lens;
varying vec3 pos,norm,tint;
varying float depth;
uniform vec4 shoalTurn,spin;
uniform vec3 pivot;
void main(){
  pos=p; norm=n; restPosition=p;
  if(dot(shoalTurn.xy,shoalTurn.xy)>.5){
    mat2 rotation=mat2(shoalTurn.x,shoalTurn.y,-shoalTurn.y,shoalTurn.x);
    pos.xy=shoalTurn.zw+rotation*(pos.xy-shoalTurn.zw);
    norm.xy=rotation*n.xy;
  }
  if(spin.w!=0.){
    vec3 v=pos-pivot,a=spin.xyz;
    float c=cos(spin.w),s=sin(spin.w);
    pos=pivot+v*c+cross(a,v)*s+a*dot(a,v)*(1.-c);
    norm=n*c+cross(a,n)*s+a*dot(a,n)*(1.-c);
  }
  vec3 v=pos-eye; depth=dot(v,forward);
  gl_Position=vec4(dot(v,right)*lens.x,dot(v,up)*lens.y,depth*1.00067-.08003,depth);
  tint=color; enamelUV=paintUV;
}`;
// The far seabed and the open-water background converge to the same ray colour.
const waterHorizon=`
vec3 openWater(vec3 ray,float altitude,float seconds){
  float h=smoothstep(-.75,.85,ray.z);
  float beam=pow(.5+.5*sin(21.*ray.x+9.*ray.y+4.*ray.z+.8*sin(ray.y*12.+seconds*.12)),7.);
  vec3 water=mix(vec3(.018,.145,.23),vec3(.14,.55,.63),h);
  return (water+vec3(.045,.075,.062)*beam*(.15+.85*h))*mix(.53,1.,smoothstep(-30.,4.,altitude));
}`;
const meshFS = `
precision highp float;
varying vec3 pos,norm,tint;
varying float depth;
uniform vec3 eye;
uniform float clock,inside,terrain,painted,reefSurface,village;
uniform sampler2D enamel,shelf,benchMap;
uniform vec3 labLamp,labWindow;
uniform float labEnabled,benchSurface;
uniform sampler2D fieldAtlas,salonMap;
uniform sampler2D labVolume;
uniform mat4 roomInverse;
uniform vec3 volumeMin,volumeMax;
uniform float study,finishType;
uniform bool stationSkin;
uniform bool berthLight,shipPaint;
uniform vec4 shipFrame;
uniform bool wingLining,wetLining,salonRoom;
uniform vec3 tankLow,tankHigh;
uniform bool tankOptics;
varying vec2 enamelUV;
varying vec3 restPosition;
float waterHash(vec2 p){return fract(sin(dot(p,vec2(63.31,41.29)))*4321.34);}
float waterNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+1.),f.x),f.y);
}
float substrate(vec2 uv){
  vec2 mirror=1.-abs(mod(uv,2.)-1.);
  return texture2D(salonMap,.01+.98*mirror).r;
}
vec3 readVolume(vec2 grid,float slice){
  vec2 tile=vec2(mod(slice,8.),floor(slice/8.));
  return texture2D(labVolume,(tile*vec2(72.,48.)+grid+.5)/vec2(576.,288.)).rgb;
}
vec3 illumination(vec3 local){
  vec3 uv=(local-volumeMin)/(volumeMax-volumeMin);
  vec3 outer=max(-uv,uv-1.);
  float fade=smoothstep(0.,.14,max(outer.x,max(outer.y,outer.z)));
  vec3 grid=clamp(uv,0.,1.)*vec3(71.,47.,47.);
  vec3 light=mix(readVolume(grid.xy,floor(grid.z)),readVolume(grid.xy,min(47.,floor(grid.z)+1.)),fract(grid.z));
  return mix(light,vec3(1.),fade);
}
// Reuse the lab's paint sample. Mirrored tiles keep the atlas border out of the mip chain.
float liningGrain(vec2 uv){
  vec2 tile=1.-abs(mod(uv,2.)-1.);
  return texture2D(fieldAtlas,(vec2(4.)+248.*tile)/1024.).r-.5;
}
vec3 galleyLining(vec3 base,vec3 p,vec3 normal){
  vec2 radial=vec2(p.y,p.z-3.34);
  float coverage=smoothstep(1.95,2.10,p.x)*(1.-smoothstep(4.18,4.40,p.x))
                *smoothstep(-.40,.18,p.y)*smoothstep(3.18,3.39,p.z);
  // The inner skin faces the aisle. This also excludes the end bulkhead and outer paint.
  coverage*=smoothstep(.54,.89,-dot(normal.yz,radial/max(length(radial),.001)));
  if(coverage<=0.)return base;
  // Distance along the arc keeps the same grain scale as the wall turns into the ceiling.
  vec2 sheet=vec2(p.x,1.13*atan(radial.x,radial.y));
  float fine=liningGrain(sheet*2.8);
  float coarse=liningGrain(sheet*vec2(.40,.34)+vec2(.27,.61));
  vec2 joints=abs(fract((sheet-vec2(2.12,.04))/vec2(1.14,.68)+.5)-.5)*vec2(1.14,.68);
  float seam=1.-smoothstep(.001,.005,min(joints.x,joints.y));
  float finish=.99+.20*fine+.075*coarse-.038*seam;
  return mix(base,base*vec3(1.022,.985,.915)*finish,coverage);
}
// Deformed intersecting wave fronts produce narrow caustic ridges.
float caustic(vec2 p,float t){
  p+=.33*vec2(sin(2.3*p.y+t*.47),cos(1.8*p.x-t*.37));
  vec2 wave=vec2(sin(4.3*p.x+p.y+.6*t),sin(4.1*p.y-.6*p.x-.44*t));
  return 1.-smoothstep(.035,.19,min(abs(wave.x),abs(wave.y)));
}
uniform float workshop;
uniform vec3 right,up;
uniform vec2 poolPixel;

// A single air/water boundary. The opaque pass supplies the actual view through
// the opening, including the seabed, the ladder and the lamps inside the bell.
uniform vec4 pool; // centre in world coordinates and clear radius
uniform float vessel; // 1 cabin, 2 saucer, 3 glazing, 4 printed cabin surfaces

vec3 wellWater(vec3 viewDir){
  vec2 p=pos.xy-pool.xy;
  float t=clock*.74;
  // Long swell crosses shorter capillaries; the wall damps lateral displacement.
  vec2 k=vec2(.87,.49),b=vec2(-.39,.92);
  float a=dot(k,p)*8.-t*1.34+.57*sin(dot(p,b)*4.2-t*.46);
  float c=dot(b,p)*15.+t*1.61+.72*sin(a);
  float fine=sin(dot(p,vec2(29.,-16.))+1.5*sin(c)-t*2.1);
  vec2 slope=.060*k*cos(a)+.034*b*cos(c)+.013*vec2(.83,-.56)*fine;
  float edge=max(0.,pool.w-length(p));
  bool hut=pool.z<0.;
  slope*=hut?(.56+.44*smoothstep(.0,.055,edge)):1.;
  vec3 normal=normalize(vec3(slope,1.))*sign(viewDir.z);
  float facing=clamp(dot(normal,viewDir),.0,1.);
  vec2 offset=vec2(dot(right,vec3(slope,0.)),dot(up,vec3(slope,0.)));
  vec2 uv=gl_FragCoord.xy*poolPixel;
  vec2 distortion=offset*min(.22,.19/max(.65,depth))*smoothstep(.0,.09,edge);
  vec3 through=texture2D(salonMap,clamp(uv+distortion,vec2(.001),vec2(.999))).rgb;
  vec3 ray=reflect(-viewDir,normal);
  float fresnel=.022+.978*pow(1.-facing,5.);
  vec3 reflected;
  if(viewDir.z<0.){
    fresnel=max(fresnel,.85*(1.-smoothstep(.62,.70,facing)));
    reflected=mix(vec3(.027,.145,.19),vec3(.10,.31,.34),.48+.32*ray.z+.13*sin(a+c));
  }else{
    float wallRadius=pool.w*1.42;
    float aa=max(.001,dot(ray.xy,ray.xy)),bb=dot(p,ray.xy);
    vec3 hit=vec3(p,0.)+ray*min(9.,(-bb+sqrt(max(.0,bb*bb+aa*(wallRadius*wallRadius-dot(p,p)))))/aa);
    float az=atan(hit.y,hit.x);
    float port=exp(-27.*pow(abs(sin(az*3.+.6)),2.)-3.*pow(abs(hit.z-1.15),2.));
    float lamp=exp(-22.*pow(abs(sin(az*2.-.4)),2.)-2.6*pow(abs(hit.z-1.8),2.));
    reflected=mix(vec3(.29,.30,.26),vec3(.72,.67,.52),smoothstep(.3,1.6,hit.z));
    reflected+=vec3(.03,.26,.33)*port+vec3(.47,.40,.27)*lamp;
  }
  if(hut && viewDir.z<0.){
    // The lit changing bay is visible in the transmission cone beneath the hatch.
    fresnel=.072+.57*(1.-smoothstep(.48,.73,facing));
    reflected+=vec3(.05,.09,.10)*(.5+.5*fine);
  }
  float rim=(1.-smoothstep(.0,hut?.006:.013,edge))*(.48+.36*sin(c));
  return mix(through*vec3(.93,.982,.986),reflected,fresnel)+vec3(.12,.16,.15)*rim;
}
vec3 upperCabinLight(vec3 worldOffset,vec3 normal){
  // Work in the pressure hull's axes so the two reading lights stay at the headboards.
  mat2 toHull=mat2(.970296,.241922,-.241922,.970296);
  vec3 p=vec3(toHull*worldOffset.xy,worldOffset.z);
  vec3 n=vec3(toHull*normal.xy,normal.z);
  float lampFill=0.;
  for(int level=0;level<2;level++){
    vec3 lamp=vec3(-.64,.85,4.81+.84*float(level))-p;
    lampFill+=(.23+.77*max(0.,dot(n,normalize(lamp))))/(1.+4.8*dot(lamp,lamp));
  }
  vec3 daylight=vec3(.0,-1.20,5.12)-p;
  float portFill=(.18+.82*max(0.,dot(n,normalize(daylight))))/(1.+1.6*dot(daylight,daylight));
  float belowTray=exp(-9.*max(0.,5.19-p.z))*smoothstep(0.,.025,5.19-p.z);
  float shade=.15*belowTray*(1.-smoothstep(-.50,-.28,p.x))*smoothstep(.05,.22,.99-abs(p.y));
  return vec3(.90,.90,.89)-shade+vec3(.27,.21,.12)*lampFill+vec3(.08,.15,.20)*portFill;
}
vec3 workshopLight(vec3 p,vec3 n,vec3 v){
  float az=atan(p.y,p.x);
  float a=floor((az+radians(120.))/(3.14159/3.)+.5)*(3.14159/3.)-radians(120.);
  vec3 lamp=vec3(2.15*cos(a),2.15*sin(a),3.31)-p;
  vec3 task=vec3(.32,1.99,3.418)-p;
  vec3 bounce=vec3(-p.xy,2.15-p.z);
  float wallGlow=(.27+.73*max(0.,dot(n,normalize(lamp))))/(.47+1.75*dot(lamp,lamp));
  float benchGlow=max(0.,normalize(task).z)*max(0.,dot(n,normalize(task)))/(.27+5.*dot(task,task));
  float seaGlow=(.22+.78*max(0.,dot(n,normalize(bounce))))*exp(-.74*abs(p.z-2.15));
  vec3 light=vec3(.45,.39,.33)+vec3(.39,.31,.20)*wallGlow+vec3(.26,.21,.13)*benchGlow+vec3(.12,.23,.27)*seaGlow;
  float grain=waterNoise(p.xy*62.+p.z*vec2(23.,47.))-.5;
  vec3 paint=tint;
  if(workshop<1.5){
    vec2 panel=vec2(atan(p.y,p.x)*2.15,p.z);
    float salt=waterNoise(panel*2.7+waterNoise(panel*7.));
    float drip=waterNoise(panel*vec2(21.,1.7));
    paint*=vec3(1.09,.82,.72)*(.95+.10*grain+.20*(salt-.5));
    paint=mix(paint,vec3(.49,.35,.25),smoothstep(.56,.80,salt*.62+drip*.38)*.35);
  }else if(workshop<2.5){
    bool plank=p.z<2.4;
    vec2 wood=plank?vec2(length(p.xy),az*2.):p.xy;
    float fibre=waterNoise(wood*vec2(5.,130.)+sin(wood.x*5.)*.58);
    float stripe=sin(wood.y*220.+4.*fibre+2.*sin(wood.x*4.));
    paint*=.83+.26*fibre+.075*stripe+.08*grain;
    if(plank)paint*=.79+.20*smoothstep(1.75,2.35,length(p.xy));
  }else if(workshop<3.5){
    paint*=.96+.16*grain;
    light+=vec3(.33,.29,.21)*pow(max(0.,dot(n,normalize(normalize(lamp)+v))),27.);
  }else if(workshop<4.5){
    paint*=.94+.15*grain;
  }else{
    return mix(vec3(.63,.65,.60),vec3(.90,.91,.83),pow(abs(dot(v,n)),.8));
  }
  return paint*light+vec3(.016,.020,.022);
}
${waterHorizon}
void main(){
  vec3 n=length(norm)>.003?normalize(norm):vec3(0.,0.,1.);
  if(village>.5 && inside<.5 && pos.z>12.50)discard;
  if(pool.w>0.){gl_FragColor=vec4(wellWater(normalize(eye-pos)),1.);return;}
  if(vessel==3.){
    float rim=pow(1.-abs(dot(n,normalize(eye-pos))),3.);
    gl_FragColor=vec4(mix(vec3(.29,.55,.58),vec3(.67,.80,.79),rim),.085+.32*rim);return;
  }
  if(workshop>.5){
    vec3 q=pos-vec3(6.3,5.,0.);
    vec3 view=normalize(eye-pos);

    bool innerFace=workshop>1.5 || dot(n,normalize(vec3(-q.xy,-1.55)))>.05;
    if(innerFace){
      vec3 lit=workshopLight(q,n,view);
      float haze=inside>.5?0.:1.-exp(-.045*length(eye-pos));
      gl_FragColor=vec4(mix(lit,vec3(.045,.31,.46),haze),1.);return;
    }
  }
  if(finishType>2.90 && finishType<2.94){
    vec2 q=enamelUV;
    float screen=floor(q.x*3.),v=q.y;
    float sync=fract(clock*.21+screen*.287);
    float dist=abs(fract(v-sync+.5)-.5);
    float band=exp(-dist*dist*1800.);
    float line=sin(v*149.*6.283+clock*.65);
    q.x+=.00045*band*sin(v*340.+clock*12.);
    float signal=texture2D(salonMap,q).r;
    vec2 local=vec2(fract(q.x*3.),v)*2.-1.;
    float phosphor=pow(signal,.90)*(1.-.15*dot(local,local))*(.98-.12*band+.024*line);
    float grain=fract(sin(dot(floor(q*vec2(1024.,320.))+floor(clock*18.),vec2(57.21,92.37)))*2145.);
    vec3 glow=mix(vec3(.018,.073,.099),vec3(.62,.89,.96),clamp(phosphor+.022*(grain-.5),0.,1.));
    glow+=vec3(.039,.048,.048)*smoothstep(.43,.88,v)*(1.-abs(local.x));
    gl_FragColor=vec4(glow,1.);return;
  }
  vec3 sun=normalize(vec3(.44,-.43,.82));
  float light=dot(n,sun);
  float shade=.62+.20*smoothstep(-.28,.0,light)+.18*smoothstep(.4,.56,light);
  vec2 uv=pos.xy+.38*pos.z;
  float laces=caustic(uv*.87,clock);
  laces*=.40+.60*smoothstep(-.55,.72,sin(uv.x*1.3+clock*.18)+cos(uv.y*1.6));
  float deep=smoothstep(-30.,1.,pos.z);
  vec3 waterLight=mix(vec3(.37,.66,.78),vec3(1.05,.99,.94),deep);
  vec3 albedo=tint;
  if(painted>.5)albedo=texture2D(enamel,enamelUV).rgb;
  if(stationSkin && tint.r>.68 && tint.g>tint.r*.61 && tint.b<tint.g*.61){
    vec2 surface=vec2(pos.x+.61*pos.y,pos.z+.37*pos.y);
    float cloud=waterNoise(surface*1.26+.63*waterNoise(surface*2.7));
    float bloom=waterNoise(surface*5.2+cloud*2.);
    float scuff=waterNoise(surface*19.+1.7*bloom);
    float grit=waterNoise(surface*92.);
    float streak=waterNoise(surface*vec2(14.,1.30)+bloom*.31);
    float chipped=smoothstep(.64,.82,scuff*.67+grit*.33)*smoothstep(.33,.77,bloom);
    float deposit=smoothstep(.32,.82,cloud*.65+bloom*.35)*(.14+.27*max(-n.z,0.));
    albedo*=.90+.17*cloud+.092*(grit-.5)+.064*(streak-.5);
    albedo=mix(albedo,vec3(.84,.76,.43),.19*smoothstep(.36,.76,cloud));
    albedo=mix(albedo,vec3(.34,.32,.18),deposit+.44*chipped);
    shade=.54+.41*max(0.,dot(n,sun))+.09*max(n.z,0.);
    laces*=.58;
  }
  if(shipPaint){
    vec2 d=pos.xy-shipFrame.xy;
    vec2 ship=vec2(dot(d,shipFrame.zw),dot(d,vec2(-shipFrame.w,shipFrame.z)));
    float depth=12.49-pos.z;
    float arc=abs(ship.y)*.88-depth*.72;
    float fine=waterNoise(vec2(ship.x*.63,arc*8.5));
    float stain=waterNoise(vec2(ship.x*.38,arc*1.7));
    float seam=1.-smoothstep(.001,.011,abs(fract(arc/.19+.5)-.5)*.19);
    albedo*=.97+.12*(fine-.5)+.12*(stain-.5)-.10*seam;
    albedo=mix(albedo,vec3(.36,.295,.207),.09*smoothstep(.53,.77,stain)*exp(-2.5*abs(depth-.33)));
  }
  vec3 pigment=mix(vec3(dot(albedo,vec3(.299,.587,.114))),albedo,1.16);
  vec3 c=pigment*shade*waterLight;
  float sunMask=1.;
  if(painted>.5){
    vec3 viewDir=normalize(eye-pos);
    float glint=pow(max(dot(n,normalize(sun+viewDir)),0.),24.);
    c+=glint*vec3(.18,.15,.09);
  }
  if(reefSurface>.5){
    vec2 q=vec2(pos.x*.84+pos.y*.54,pos.z+.28*pos.y)*31.;
    q+=.31*sin(q.yx*1.7);
    float pores=1.-smoothstep(.11,.32,length(fract(q)-.5));
    float nearDetail=1.-smoothstep(1.,5.,length(eye-pos));
    c*=1.-nearDetail*(.095*pores+.035*(.5+.5*cos(q.x*.92+q.y)));
  }
  if(terrain>.5){
    vec2 shelfUV=(pos.xy+vec2(12.,14.))/24.;
    float shadow=texture2D(shelf,shelfUV).r;
    float edge=min(min(shelfUV.x,shelfUV.y),min(1.-shelfUV.x,1.-shelfUV.y));
    shadow*=smoothstep(0.,.04,edge);
    c*=mix(vec3(1.),vec3(.57,.69,.73),shadow);
    sunMask=1.-.93*shadow;
    c*=.96+.04*sin(pos.x*2.+sin(pos.y*1.7));
  }
  if(village>.5 && inside<.5){
    if(reefSurface>.5 || terrain>.5){
      vec2 p=pos.xy;
      vec3 weight=abs(n);weight/=max(.001,weight.x+weight.y+weight.z);
      float pores=dot(weight,vec3(substrate(pos.yz*1.12),substrate(pos.zx*1.12),substrate(pos.xy*1.12)));
      float crust=substrate(p*.32+pos.z*.29);
      float stains=waterNoise(p*.87+pos.z*.31);
      if(reefSurface>1.5){
        float flood=clamp(.35+.46*n.z+.24*dot(n,normalize(vec3(.28,-.50,.80))),.12,1.);
        float relief=.59+.88*pores+.18*crust;
        if(reefSurface<2.5){
          float bedding=waterNoise(vec2(pos.y*.71,pos.z*4.6)+stains*.9);
          float strata=waterNoise(vec2(pos.y*.47,pos.z*8.+1.4*sin(pos.y*.63)+stains));
          float crustose=smoothstep(.49,.73,crust*.46+stains*.54)*(.42+.58*flood);
          vec3 rockTint=mix(tint,tint*vec3(1.23,.74,.73),crustose*.76);
          c=rockTint*relief*(.32+.83*flood)*(.64+.38*bedding+.15*strata)*vec3(.78,.91,.91);
        }else if(reefSurface<3.5){
          float ripple=sin(pos.y*17.+pos.x*4.+stains*6.);
          c=tint*(.77+.26*pores+.041*ripple)*vec3(.82,.94,.94);
        }else{
          c=tint*(.48+.58*flood)*(.82+.34*pores);
        }
      }else if(reefSurface>.5){
        float lightface=max(0.,dot(n,normalize(vec3(.32,-.38,.86))));
        c*=vec3(.64,.72,.70)*(.45+.72*pores+.38*crust)*(.65+.35*lightface);
        c=mix(c,c*vec3(.64,.66,.49),smoothstep(.49,.82,stains)*.64);
      }else{
        float grains=substrate(p*3.6);
        float ridges=sin(8.*p.y+2.6*p.x+6.*waterNoise(p*.40));
        c=mix(c,vec3(.48,.55,.48),.32)*(.78+.14*grains+.15*stains+.043*ridges);
        float scarp=smoothstep(.3,2.4,pos.z)*(1.-.25*max(n.z,0.));
        vec3 limestone=vec3(.39,.40,.34)*(.48+.55*max(dot(n,sun),0.))*(.55+.82*pores+.20*crust);
        c=mix(c,limestone,scarp);
        laces*=1.-.78*scarp;
      }
    }
    c*=mix(vec3(.39,.68,.80),vec3(.87,.94,.91),smoothstep(-15.,10.,pos.z)*.77);
    c-=vec3(.042,.068,.057)*laces*sunMask*deep*(1.-smoothstep(6.,21.,length(pos-eye)))*max(0.,light);
  }
  vec3 delta=pos-eye;
  float d=length(delta);
  float nearWaves=1.-smoothstep(6.,21.,d);
  c+=vec3(.11,.17,.14)*laces*max(0.,light)*deep*sunMask*nearWaves;
  vec3 warm=tint*(.68+.22*max(n.z,0.)+.19*max(0.,dot(n,normalize(vec3(-.2,-.5,.5)))))*
            vec3(1.06,1.01,.91);
  if(labEnabled>.5){
    vec3 toLamp=labLamp-pos,toWindow=labWindow-pos;
    float lampD=dot(toLamp,toLamp),windowD=dot(toWindow,toWindow);
    float room=1.-smoothstep(1.35,2.22,min(sqrt(lampD),sqrt(windowD)));
    float lamp=clamp(dot(n,normalize(toLamp)),0.,1.)/(1.+2.65*lampD);
    float sky=clamp(dot(n,normalize(toWindow)),0.,1.)/(1.+3.*windowD);
    vec3 lit=tint*(vec3(.62,.60,.54)+vec3(.20,.20,.18)*max(0.,n.z)
      +vec3(.69,.39,.13)*lamp+vec3(.12,.40,.54)*sky);
    vec3 radial=pos-labWindow;
    float waterPattern=caustic(vec2(radial.x+radial.y*.28,radial.z+radial.y*.32)*3.6,clock*.52);
    lit+=vec3(.018,.055,.068)*waterPattern*sky;
    warm=mix(warm,lit,room);
    if(benchSurface>.5){
      warm=texture2D(benchMap,enamelUV).rgb+vec3(.012,.033,.043)*waterPattern*sky;
    }
  }
  c=mix(c,warm,inside);
  if(inside<.5&&benchSurface>.5)c=texture2D(benchMap,enamelUV).rgb;
  if(study>.5){
    vec3 viewDir=normalize(eye-pos);
    vec3 L=labLamp-pos,W=labWindow-pos;
    float dl=length(L),dw=length(W);
    vec3 l=L/max(dl,.001),w=W/max(dw,.001);
    float room=(1.-smoothstep(1.35,2.25,min(dl,dw)))*inside;
    float ndv=clamp(abs(dot(n,viewDir)),0.,1.);
    vec3 refl=reflect(-viewDir,n);
    float highlight=max(0.,dot(refl,l)), port=max(0.,dot(refl,w));
    if(finishType>7.5){
      float phase=enamelUV.y*17.-clock*6.2+enamelUV.x*38.;
      float drop=smoothstep(.32,.95,sin(phase+1.3*sin(phase*.43)));
      gl_FragColor=vec4(.76,.87,.88,(.08+.50*drop)*(1.-.69*enamelUV.y));
      return;
    }
    if(finishType>6.5){
      float ripples=caustic(pos.xy*2.8,clock*.65);
      float glint=smoothstep(.68,.99,sin(21.*pos.x+8.*pos.y+clock+sin(pos.y*34.-clock)));
      gl_FragColor=vec4(mix(vec3(.025,.44,.57),vec3(.37,.83,.85),.37*ripples+.35*glint),.42+.12*ripples+.15*glint);
      return;
    }
    if(finishType>3.5){
      if(!gl_FrontFacing)discard;
      // A reflected strip lamp and broad porthole show the shape of thin glass.
      bool isWater=finishType<4.5;
      float rim=pow(1.-ndv,3.);
      if(isWater){
        n=normalize(n+vec3(.013*sin(pos.x*38.+clock*.60),.016*cos(pos.y*29.-clock*.72),0.));
        refl=reflect(-viewDir,n);
      }
      if(isWater && tankOptics){
        vec3 q=(roomInverse*vec4(pos,1.)).xyz-tankLow;
        vec3 size=tankHigh-tankLow;
        float depthBelow=max(0.,size.z-q.z);
        float phase=37.*q.x+12.*q.y+clock*1.15+.67*sin(q.y*26.-clock*.63);
        float crossWave=31.*q.y-13.*q.x-clock*.84;
        float slope=.62*sin(phase)+.38*cos(crossWave);
        bool surface=norm.z>.7;
        if(surface){
          vec3 waveNormal=normalize(vec3(.052*cos(phase),.042*sin(crossWave),1.));
          vec3 reflected=reflect(-viewDir,normalize(waveNormal*mat3(roomInverse)));
          float sky=exp(-7.*dot(reflected-w,reflected-w));
          float lightStrip=pow(max(dot(reflected,l),0.),16.);
          float ripple=smoothstep(.43,.99,slope);
          vec2 edge=min(q.xy,size.xy-q.xy);
          float lip=1.-smoothstep(.0008,.006,min(edge.x,edge.y));
          vec3 hue=mix(vec3(.073,.46,.50),vec3(.65,.89,.86),.57*ripple+.34*sky);
          hue+=vec3(.28,.23,.14)*lightStrip+vec3(.16,.23,.22)*lip;
          gl_FragColor=vec4(hue,clamp(.20+.19*ripple+.19*rim+.23*lip+.17*lightStrip,0.,.76));
        }else{
          float toLine=(depthBelow-.0015-.0009*slope)/.0027;
          float line=exp(-toLine*toLine);
          float volume=smoothstep(0.,size.z,depthBelow);
          vec3 hue=mix(vec3(.07,.52,.53),vec3(.028,.32,.36),volume);
          gl_FragColor=vec4(mix(hue,vec3(.66,.91,.86),line),.19+.12*volume+.37*line);
        }
        return;
      }
      vec3 skyDelta=refl-w;
      float windowPatch=exp(-12.*dot(skyDelta.xy,skyDelta.xy)-21.*skyDelta.z*skyDelta.z);
      vec3 lampDelta=refl-l;
      float lampPatch=exp(-41.*dot(lampDelta.xy,lampDelta.xy)-10.*lampDelta.z*lampDelta.z);
      float alpha=(isWater?.11:.065)+.32*rim+.39*windowPatch+.56*lampPatch;
      vec3 reflected=mix(isWater?vec3(.15,.43,.42):vec3(.34,.56,.57),vec3(.71,.87,.86),rim+windowPatch*.4);
      gl_FragColor=vec4(mix(reflected,vec3(1.,.88,.64),lampPatch),min(alpha,.85));
      if(finishType>5.5){
        gl_FragColor=vec4(mix(vec3(.045,.34,.46),vec3(.48,.74,.77),windowPatch*.5+lampPatch*.4),
                          .38+.23*rim);
      }
      return;
    }
    vec3 localPos=(roomInverse*vec4(pos,1.)).xyz;
    vec3 visibility=vec3(1.);
    if((room>.0&&benchSurface<.5)||finishType>.5)
      visibility=illumination((roomInverse*vec4(pos+n*.024,1.)).xyz);
    if(room>.0){
      // A small tiled grain sample keeps painted surfaces tactile in close-up.
      vec3 localNormal=mat3(roomInverse)*n;
      vec2 plane=abs(localNormal.x)>.65?localPos.yz:localPos.xz;
      if(abs(n.z)>.73)plane=localPos.xy;
      float grain=texture2D(fieldAtlas,(vec2(2.)+fract(plane*2.8)*252.)/1024.).r-.5;
      float mottling=sin(pos.x*12.+sin(pos.z*23.))*cos(pos.y*17.-pos.z*10.);
      float wall=smoothstep(.47,.81,tint.r)*(1.-smoothstep(.72,.97,abs(n.z)));
      if(finishType<.5 && benchSurface<.5){
        c*=mix(vec3(1.),vec3(1.025,.955,.82)*(1.+.20*grain+.011*mottling),room*wall);
        c*=mix(vec3(1.),vec3(.67+.33*visibility.b)*
               (.72+.18*visibility.r+.10*visibility.g),room);
      }
      if(benchSurface>.5)c+=room*(vec3(.053,.060,.057)*pow(port,6.)+vec3(.038,.031,.019)*pow(highlight,9.));
    }
    if(salonRoom){
      // Project the two front bays into the central pentagon; let the light fade at wing doors.
      vec2 h=mat2(.95106,-.30902,.30902,.95106)*localPos.xy;
      float salon=1.-smoothstep(1.83,2.19,length(h));
      vec2 aperture=vec2(abs(h.x)-.66,h.y+1.86);
      float falloff=1./(1.+1.4*dot(aperture,aperture));
      vec3 incoming=normalize(vec3(.887,-.461,.25));
      float lit=max(dot(n,incoming),0.)*falloff;
      float grain=liningGrain(vec2(h.x+.47*h.y,localPos.z+.33*h.y)*2.4);
      c=mix(c,c*(vec3(.94,.948,.918)+lit*vec3(.03,.18,.23))*(1.+.12*grain),salon);
    }
    if(wingLining)c=galleyLining(c,localPos,mat3(roomInverse)*n);
    if(wetLining){
      vec2 wet=mat2(.309017,-.951057,.951057,.309017)*localPos.xy;
      float mask=smoothstep(1.99,2.14,wet.x)*(1.-smoothstep(1.22,1.34,abs(wet.y)));
      float grain=liningGrain(vec2(wet.x,wet.y+.7*localPos.z)*2.);
      float enamel=smoothstep(.44,.69,tint.r);
      vec3 blue=vec3(.30,.383,.419)*(.78+.21*max(n.z,0.)+.19*max(dot(n,normalize(vec3(.23,-.63,.74))),0.)+.17*grain);
      if(localPos.z<2.52)blue=vec3(.121,.154,.160)*(.94+.2*grain);
      c=mix(c,blue,mask*max(enamel,1.-smoothstep(2.50,2.52,localPos.z)));
    }
    if(finishType>2.48 && finishType<2.52){
      vec2 wet=mat2(.309017,-.951057,.951057,.309017)*localPos.xy;
      vec2 uv=vec2(wet.x+.43*wet.y,localPos.z);
      bool locker=finishType>2.505, towel=finishType<2.495;
      if(locker)uv=vec2(wet.y+.25*wet.x,localPos.z);
      float coarse=liningGrain(uv*(towel?5.:3.));
      float detail=liningGrain(uv*(towel?23.:14.));
      float closeUp=1.-smoothstep(.35,1.9,length(eye-pos));
      float warp=sin(uv.x*1120.+coarse*3.);
      float weft=sin(uv.y*970.+warp*1.4);
      float lustre=pow(1.-abs(dot(n,viewDir)),3.);
      float fill=.75+.14*max(n.z,0.)+.13*max(dot(n,normalize(vec3(.4,-.5,.72))),0.);
      if(towel){
        float pile=.38*detail+.17*coarse+.075*warp*weft*closeUp;
        c=tint*fill*(1.+pile);
      }else if(locker){
        float rolled=liningGrain(uv*vec2(1.2,9.));
        c=tint*fill*(.98+.17*coarse+.11*rolled+.14*detail)+vec3(.043,.055,.057)*lustre;
      }else{
        float compression=cos(uv.y*65.+2.4*sin(uv.x*24.));
        c=tint*fill*(.93+.19*coarse+.18*detail+.04*compression+.036*weft*closeUp)+vec3(.055)*lustre;
      }
    }else if(finishType>2.89 && finishType<2.90){
      vec3 textile=texture2D(salonMap,enamelUV).rgb;
      c=textile*(.86+.14*max(n.z,0.));
    }else if(finishType>2.85 && finishType<2.89){
      vec2 cloth=vec2(localPos.x+localPos.y*.18,localPos.y+localPos.z*.58);
      float thread=.5+.5*sin(cloth.x*760.)*sin(cloth.y*710.);
      float falloff=1.-smoothstep(.28,1.5,length(eye-pos));
      vec3 face=gl_FrontFacing?n:-n;
      c=tint*vec3(.98,.96,.91)*(.74+.19*abs(face.z)+.13*max(dot(face,normalize(vec3(.45,-.64,.48))),0.))*(.98+.045*thread*falloff);
    }else if(finishType>2.54 && finishType<2.85){
      // Diffuse daylight from the two salon bays and a broad overhead reflection.
      vec3 windowDir=normalize(vec3(.89,-.46,.42));
      float key=max(dot(n,windowDir),0.);
      vec3 fill=vec3(.72,.72,.67)+.20*key*vec3(.78,.96,1.)+.12*max(n.z,0.);
      if(finishType>2.7)c=texture2D(salonMap,enamelUV).rgb*fill;
      else{
        float gloss=pow(max(dot(refl,windowDir),0.),mix(55.,8.,enamelUV.x));
        c=tint*fill+(.13+.32*enamelUV.y)*gloss+.07*pow(1.-ndv,4.);
        if(finishType>2.63){
          vec2 wet=mat2(.309017,-.951057,.951057,.309017)*localPos.xy;
          vec2 wood=localPos.z>2.539?wet.yx:wet;
          float pores=liningGrain(wood*vec2(1.3,24.));
          float fibre=sin(wood.y*480.+1.1*sin(wood.x*5.)+.7*sin(wood.y*59.));
          c=tint*fill*(.77+.32*pores+.045*fibre)+.055*gloss;
        }
      }
    }else if(finishType>.5){
      float inc=max(dot(n,l),0.),blue=max(dot(n,w),0.);
      vec3 fill=vec3(.48,.50,.47)+max(n.z,0.)*vec3(.18,.18,.17);
      vec3 lighting=fill*(.40+.60*visibility.b)+inc*vec3(.83,.63,.38)*visibility.r/(1.+1.65*dl*dl)
                    +blue*vec3(.19,.45,.62)*visibility.g/(1.+1.9*dw*dw);
      if(finishType<1.5){
        float rough=enamelUV.x,metal=enamelUV.y;
        vec3 base=tint*lighting*(1.-.22*metal);
        float shine=mix(95.,4.,rough);
        vec3 coat=mix(vec3(.25),mix(tint,vec3(.91),.4),metal)*(1.-.68*rough);
        vec3 lampSpec=vec3(1.,.83,.61)*pow(highlight,shine)/(1.+dl*dl);
        vec3 skySpec=vec3(.51,.73,.90)*pow(port,.42*shine)/(1.+dw*dw);
        c=base+coat*(lampSpec*visibility.r+skySpec*visibility.g+.16*pow(1.-ndv,4.));
        if(finishType>1.02 && finishType<1.1){
          float strip=smoothstep(.55,.90,refl.z)*(.74+.26*max(refl.x,0.));
          c+=metal*(vec3(.13,.14,.14)+vec3(.46,.44,.40)*strip);
          vec2 castUV=localPos.xz+localPos.y*vec2(.53,.69);
          float stipple=texture2D(fieldAtlas,(vec2(2.)+fract(castUV*10.)*252.)/1024.).r-.5;
          c*=1.+.55*rough*stipple;
        }
        if(finishType>1.1 && finishType<1.3){
          // Soft tissue in a backlit fan transmits some of the porthole light.
          float wrap=.5+.5*dot(n,w);
          c=tint*(.51+.32*wrap+.22*inc)+vec3(.14,.045,.021)*(1.-ndv);
        }
        if(finishType>1.3){
          // Light reflected by the aisle floor reaches the shadowed cupboard faces.
          c+=tint*vec3(.215,.203,.174)*(1.-.65*max(n.z,0.));
        }
        if(finishType>1.45 && n.z>.8){
          vec2 grid=localPos.xy/.024;
          grid.x+=.5*mod(floor(grid.y),2.);
          vec2 dotUV=(fract(grid)-.5)*vec2(1.,1.36);
          float stud=1.-smoothstep(.24,.34,length(dotUV));
          c*=.93+stud*(.10+.19*dotUV.y);
        }
        if(rough>.79){
          vec2 detail=localPos.xy+vec2(.41,.8)*localPos.z;
          float speckle=texture2D(fieldAtlas,(vec2(2.)+fract(detail*2.1)*252.)/1024.).r-.5;
          c*=1.+.36*speckle;
        }
        if(tankOptics && all(greaterThan(localPos,tankLow)) && all(lessThan(localPos,tankHigh))){
          float ray=caustic(localPos.xy*14.+localPos.z*3.,clock*.60);
          float top=.28+.72*max(n.z,0.);
          c=c*vec3(.93,1.02,1.02)+ray*top*vec3(.065,.105,.093);
        }
      }else if(finishType<2.5){
        c=texture2D(fieldAtlas,enamelUV).rgb*(vec3(.18,.175,.16)+.86*lighting);
      }else{
        c=mix(vec3(.83,.75,.54),vec3(1.,.97,.84),.45+.55*ndv);
      }
    }
  }
  if(berthLight){
    vec2 offset=pos.xy-vec2(.650467,-4.095757);
    vec2 west=vec2(-.98894,-.14835),south=vec2(-.16451,-.98638);
    vec2 axis=dot(offset,west)>dot(offset,south)?west:south;
    vec2 side=vec2(-axis.y,axis.x);
    vec3 berth=vec3(dot(offset,axis),dot(offset,side),pos.z);
    if((finishType>3.05 && finishType<3.45) || (berth.x>1.96 && berth.x<4.59 && abs(berth.y)<1.14 && berth.z>2.48 && berth.z<4.47)){
      vec3 bn=vec3(dot(n.xy,axis),dot(n.xy,side),n.z);
      vec3 dl=vec3(2.94,0.,4.35)-berth;
      vec3 dw=vec3(3.45,1.085,3.50)-berth;
      float bounce=.58+.16*smoothstep(2.63,4.28,berth.z)+.06*max(bn.z,0.);
      float lamp=max(0.,dot(bn,normalize(dl)))/(.70+dot(dl,dl));
      float port=max(0.,dot(bn,normalize(dw)))/(.76+2.*dot(dw,dw));
      float under=(1.-smoothstep(-.36,.12,berth.y))*(1.-smoothstep(3.32,3.70,berth.z));
      under=max(under,smoothstep(3.73,4.12,berth.x)*(1.-smoothstep(3.33,3.72,berth.z)));
      vec3 light=vec3(bounce-.18*under)+vec3(.35,.27,.17)*lamp+vec3(.065,.16,.23)*port;
      if(finishType>3.05 && finishType<3.4){
        bool sole=finishType>3.25;
        vec2 uv=sole?berth.xy:vec2(berth.x,1.103*atan(berth.y,berth.z-3.34));
        if(!sole && abs(bn.x)>.55)uv=berth.yz;
        float grain=liningGrain(uv*3.6);
        float broad=liningGrain(uv*vec2(.73,1.09)+.28);
        float textureGain=1.+.23*grain+.07*broad;
        if(finishType<3.16){
          float fibre=liningGrain(uv*vec2(1.3,17.)+broad*.14);
          textureGain+=.11*fibre;
        }
        if(sole)textureGain+=.20*liningGrain(uv*12.5);
        c=tint*light*textureGain;
      }else if(finishType>3.4 && finishType<3.45){
        c=texture2D(salonMap,enamelUV).rgb*light*vec3(1.,.98,.90);
      }else if(finishType<2.90){
        c*=light*1.09;
      }
    }
  }
  if(vessel==4.){
    // Shared woven linen and instrument printing under the upper cabin lights.
    vec3 q=restPosition-vec3(10.,-30.,-21.51);
    vec3 lamp=normalize(vec3(-.45,.66,5.92)-q);
    vec3 port=normalize(vec3(.18,-1.21,5.12)-q);
    vec3 light=vec3(.64,.64,.61)+vec3(.25,.22,.16)*max(0.,dot(n,lamp))+vec3(.10,.15,.17)*max(0.,dot(n,port));
    c=texture2D(salonMap,enamelUV).rgb*light*upperCabinLight(q,n);
  }else if(vessel>.5){
    bool cabin=vessel<1.5;
    vec3 local=restPosition-(cabin?vec3(10.,-30.,-21.51):vec3(27.6,-16.,3.7));
    vec2 st=vec2(atan(local.y,local.x)*1.32,local.z);
    float family=floor(enamelUV.x*255.+.5);
    vec2 surface=abs(n.z)>.76?local.xy:st;
    float patina=waterNoise(surface*4.6+waterNoise(surface*13.));
    float speck=waterNoise(surface*64.);
    vec3 view=normalize(eye-pos);
    float gloss=pow(max(0.,dot(reflect(-sun,n),view)),28.);
    bool room=cabin&&local.z>1.56&&length(local.xy)<1.30;
    vec3 base=room?tint*vec3(.78,.75,.64)*(.90+.13*n.z):c;
    if(room){
      // The changing bay is painted pale yellow, the bunks and upper instruments sit in a grey liner.
      if(family==8.)base=tint*(.89+.085*dot(n,normalize(vec3(.4,-.6,.38)))+.024*speck);
      float windowLight=exp(-1.4*length(local-vec3(-.3,-1.23,5.12)));
      float glow=exp(-1.3*length(local-vec3(-.55,.98,5.65)));
      base+=tint*(vec3(.12,.24,.30)*windowLight+vec3(.59,.42,.24)*glow);
    }
    if(family==2.){
      float thread=sin(dot(local,vec3(181.,13.,110.)))*sin(dot(local,vec3(9.,157.,102.)));
      base*=.96+.055*thread+.08*(speck-.5);
    }else if(family==4.){
      base=mix(base,vec3(.022,.11,.15),.46)+vec3(.12,.26,.30)*pow(1.-abs(dot(view,n)),2.)+gloss*.56;
    }else if(family==3.){
      base*=.93+.14*speck;base+=vec3(.21,.25,.24)*gloss;
    }else if(family==7.){
      vec2 sheet=local.yz*110.;
      float hatch=mod(floor(sheet.x)+floor(sheet.y),2.)<1.?sheet.x:sheet.y;
      base*=.95+.09*smoothstep(.55,.86,fract(4.*hatch));
    }else if(family==8.){
      base*=.992+.012*patina;
    }else if(family==9.){
      float weave=sin(dot(local.xy,vec2(.242,.970))*360.)*sin(local.z*305.);
      base*=.98+.042*weave+.05*(speck-.5)+.17*dot(n,normalize(vec3(.30,-.55,.40)));
    }else if(family==10.){
      base*=.97+.085*speck;
      base+=vec3(.055,.062,.062)*pow(1.-abs(dot(view,n)),3.);
    }else if(family==11.){
      base*=.92+.10*speck+.13*dot(n,normalize(vec3(.5,-.7,.45)));
      base+=vec3(.14,.15,.14)*pow(max(0.,dot(reflect(-normalize(vec3(.4,-.5,.7)),n),view)),18.);
    }else if(family==6.){
      vec2 studs=fract(local.xy*28.)-.5;
      base*=.89+.13*smoothstep(.10,.29,length(studs))+.06*speck;
    }else if(family==5.)base*=.91+.14*speck;
    else{
      base*=.95+.12*patina+.06*(speck-.5);
      if(!room)base=mix(base,vec3(.20,.19,.11),.13*smoothstep(.62,.85,patina)*smoothstep(.55,.85,speck));
      base+=gloss*(room?.028:.064);
    }
    c=room&&local.z>4.04?base*upperCabinLight(local,n):base;
  }
  vec3 fog=mix(vec3(.045,.23,.32),vec3(.085,.43,.53),deep);
  float mist=1.-exp(-d*mix(.024,.013,inside));
  if(village>.5 && inside<.5){
    fog=mix(vec3(.026,.14,.235),vec3(.045,.31,.46),deep);
    mist=1.-exp(-d*.044);
    float farWater=smoothstep(20.,78.,d);
    fog=mix(fog,openWater(delta/max(d,.001),eye.z,clock),farWater);
    mist=mix(mist,1.,farWater);
  }
  gl_FragColor=vec4(mix(c,fog,mist),1.);
}`;
const skyVS=`attribute vec2 p; varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.,1.);}`;
const skyFS=`
precision highp float;
uniform float village;
varying vec2 uv;uniform vec3 forward,right,up,eye;uniform vec2 lens;uniform float clock;
float hashSea(vec2 p){return fract(sin(dot(p,vec2(37.17,78.62)))*4152.8);}
float noiseSea(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hashSea(i),hashSea(i+vec2(1.,0.)),f.x),mix(hashSea(i+vec2(0.,1.)),hashSea(i+1.),f.x),f.y);
}
${waterHorizon}
void main(){
  vec3 ray=normalize(forward+uv.x*right/lens.x+uv.y*up/lens.y);
  float attenuation=mix(.53,1.,smoothstep(-30.,4.,eye.z));
  vec3 c=openWater(ray,eye.z,clock);
  if(village>.5 && ray.z>.035){
    float distanceToSurface=(12.49-eye.z)/ray.z;
    vec2 q=eye.xy+ray.xy*distanceToSurface;
    float slow=noiseSea(q*.43+vec2(clock*.08,0.)),small=noiseSea(q*1.19-vec2(0.,clock*.12));
    float swell=sin(q.x*.64+q.y*.23+clock*.92+4.*slow)+.38*sin(q.y*1.85-q.x*.31-clock*1.05);
    float wave=sin(q.y*3.1+.78*q.x+2.35*swell+9.*small-clock*1.24);
    float ripples=smoothstep(.60,.99,wave)*(.35+.65*smoothstep(-.7,1.,swell));
    float window=smoothstep(.56,.76,ray.z+.032*swell);
    vec3 surface=mix(vec3(.072,.33,.47),vec3(.49,.77,.82),window)*(.85+.20*slow);
    surface+=vec3(.12,.15,.14)*ripples*exp(-distanceToSurface*.022);
    c=mix(c,surface*attenuation,.90*exp(-.017*max(distanceToSurface,0.))*smoothstep(.035,.15,ray.z));
  }
  gl_FragColor=vec4(c,1.);
}`;
const particleVS=`
attribute vec3 seed; uniform vec3 eye,forward,right,up;uniform vec2 lens;uniform float clock,scale;
varying float fade;
void main(){
 vec3 v=mod(seed+vec3(clock*.041,clock*.015,clock*.064)-eye+6.,12.)-6.;
 float d=dot(v,forward);fade=smoothstep(.25,1.,d)*(1.-smoothstep(3.,6.,length(v)));
 gl_Position=vec4(dot(v,right)*lens.x,dot(v,up)*lens.y,d*1.00067-.08003,d);
 gl_PointSize=clamp(scale*2./max(.4,d),1.,3.);
}`;
const particleFS=`precision mediump float;varying float fade;void main(){gl_FragColor=vec4(.78,.94,.86,fade*.34*(1.-smoothstep(.2,.5,length(gl_PointCoord-.5))));}`;

const bubblesVS=`
attribute vec3 seed;
uniform vec3 source,eye,forward,right,up;
uniform vec2 lens,jet;
uniform float clock,height,scale;
varying float life,isJet;
void main(){
  vec3 s=seed/12.;
  isJet=step(.5,dot(jet,jet));
  float age=fract(s.x+clock*(isJet>.5?.87+s.z*.40:(.50+s.z*.25)/height));
  vec3 p=source;
  float size;
  if(isJet>.5){
    p.xy+=jet*(age*1.9)+vec2(-jet.y,jet.x)*sin(s.y*37.+age*7.)*(.018+.14*age);
    p.z+=cos(age*11.+s.z*23.)*(.018+.13*age);
    size=.028+.065*age;
  }else{
    float z=age*height;
    p+=vec3(.048*z+sin(s.y*32.+z*2.3)*(.055+.018*z),sin(s.z*41.+z*2.8)*(.055+.014*z),z);
    size=(.012+.046*s.z*s.z)*(1.+age*.57);
  }
  vec3 d=p-eye;float f=dot(d,forward);
  gl_Position=vec4(dot(d,right)*lens.x,dot(d,up)*lens.y,f*1.00067-.08003,f);
  gl_PointSize=clamp(scale*size/max(.12,f),1.,36.);
  life=(1.-smoothstep(.78,1.,age))*smoothstep(.0,.06,age);
}`;
const bubblesFS=`
precision mediump float;
varying float life,isJet;
void main(){
  vec2 q=gl_PointCoord*2.-1.;float r=length(q);if(r>1.)discard;
  float rim=smoothstep(.46,.82,r)*(1.-smoothstep(.82,1.,r));
  float glint=1.-smoothstep(.06,.32,length(q-vec2(-.32,-.53)));
  if(isJet>.5)gl_FragColor=vec4(.64,.87,.86,.14*life*(1.-r*r));
  else gl_FragColor=vec4(.54+.43*glint,.85+.14*glint,.94,life*(.08+.48*rim+.76*glint));
}`;
const steamVS=`
attribute vec2 p;
uniform vec2 plumeSize;
uniform vec3 steamOrigin,eye,forward,right,up;
uniform vec2 lens;
varying vec2 plume;
void main(){
  plume=vec2(p.x,(p.y+1.)*.5);
  vec3 world=steamOrigin+right*plumeSize.x*p.x+vec3(0.,0.,plume.y*plumeSize.y);
  vec3 delta=world-eye;
  float d=dot(delta,forward);
  gl_Position=vec4(dot(delta,right)*lens.x,dot(delta,up)*lens.y,d*1.00067-.08003,d);
}`;
const steamFS=`
precision mediump float;
varying vec2 plume;
uniform float clock;
void main(){
  float y=plume.y;
  float mist=0.;
  for(int i=0;i<3;i++){
    float k=float(i),t=clock*.88+k*2.08;
    float center=(k-1.)*.18 + y*(.19*sin(6.8*y-t)+.16*sin(11.*y-t*1.28))+.12*y*y;
    float width=.051+.16*y;
    float x=(plume.x-center)/width;
    float density=.62+.38*sin(11.*y-t*1.63);
    mist+=exp(-x*x)*density;
  }
  float a=.27*mist*smoothstep(.0,.095,y)*(1.-smoothstep(.34,1.,y));
  gl_FragColor=vec4(.93,.90,.79,min(a,.46));
}`;

function program(gl,vs,fs){
  const prog=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
    const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog,sh);gl.deleteShader(sh);
  }
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
  const loc={};
  for(const k of ['eye','right','up','forward','lens','clock','inside','terrain','scale','painted','shelf','enamel','reefSurface','benchMap','labLamp','labWindow','labEnabled','benchSurface','fieldAtlas','salonMap','study','workshop','pool','vessel','poolPixel','berthLight','shipPaint','shipFrame','stationSkin','finishType','labVolume','roomInverse','volumeMin','volumeMax'])loc[k]=gl.getUniformLocation(prog,k);
  for(const k of ['p','n','color','seed','paintUV'])loc[k]=gl.getAttribLocation(prog,k);
  for(const k of ['pivot','spin','source','jet','height','plumeSize','village','tankOptics','tankLow','tankHigh','shoalTurn','steamOrigin','wingLining','wetLining','salonRoom'])loc[k]=gl.getUniformLocation(prog,k);
  return {prog,...loc};
}
export async function getAsset(name,type,onBytes){
  if(onBytes){
    return new Promise((resolve,reject)=>{
      const request=new XMLHttpRequest();
      request.open('GET','assets/'+name);
      request.responseType=type==='blob'?'blob':'arraybuffer';
      request.onprogress=e=>onBytes(e.loaded,e.total);
      const failed=()=>reject(new Error('Ошибка загрузки '+name));
      request.onload=()=>{
        if(request.status<200||request.status>=300){failed();return;}
        const result=request.response;
        onBytes(result.size??result.byteLength,result.size??result.byteLength);
        resolve(result);
      };
      request.onerror=request.onabort=failed;
      request.send();
    });
  }
  const r=await fetch('assets/'+name,{cache:'no-cache'});
  if(!r.ok)throw new Error('Ошибка загрузки '+name);
  return r[type]();
}
const version='hangar14';
export const salonRefit=!['lab1','lab2','lab3','lab4','wing5','wing6','wing6.2','salon7','salon7.1'].includes(version);
export const villageEdition=salonRefit&&!['salon8','salon9'].includes(version);
export const salonFolder=villageEdition?(version==='village10'?'village10/':version==='berths12'?'berths12/':version==='reef13'?'reef13/':'hangar14/'):version==='salon8'?'salon8/':'salon9/';
export const wetEdition=salonRefit&&version!=='salon8';
export async function createRenderer(canvas,onProgress=()=>{}){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});
  if(!gl || !gl.getExtension('OES_element_index_uint'))throw Error('Для прогулки нужен браузер с поддержкой WebGL.');
  const mesh=program(gl,meshVS,meshFS),sky=program(gl,skyVS,skyFS),dust=program(gl,particleVS,particleFS);
  const folder=version==='lab1'?'':['lab2','lab3','lab4'].includes(version)?version+'/':salonRefit?salonFolder:'salon7/';
  const mobile=folder==='hangar14/' && matchMedia('(pointer: coarse)').matches;
  const meshRevision=folder==='hangar14/'?'?v=berth37':'';
  const info=await getAsset(folder+(mobile?'mobile.json':'village.json')+meshRevision,'json');
  const pack=info.pack||'village.pack';
  const emission=info.expedition?program(gl,bubblesVS,bubblesFS):null;
  const steam=info.steamOrigin?program(gl,steamVS,steamFS):null;
  const sizes=info.assetBytes||{};
  const textureBytes=Object.entries(sizes).reduce((sum,[name,size])=>sum+(name===pack?0:size),0);
  let meshBytes=0,meshTotal=sizes[pack]||0,decodedBytes=0;
  function report(phase){
    const total=meshTotal+textureBytes;
    if(total)onProgress(Math.min(99,100*(meshBytes+decodedBytes)/total),phase);
  }
  function meshProgress(loaded,total){
    meshBytes=loaded;
    meshTotal=total||meshTotal;
    report('Загружаем модель рифа и станции…');
  }
  const packed=await getAsset(folder+pack+meshRevision,'blob',meshProgress);
  let data;
  if(typeof DecompressionStream==='function'){
    data=await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }else{
    await import('./vendor/pako_inflate.min.js');
    data=globalThis.pako.ungzip(new Uint8Array(await packed.arrayBuffer())).buffer;
  }
  const offset=info.vertexCount*info.vertexStride;
  if(offset+4*info.indexCount!==data.byteLength)throw Error('Модель загрузилась не полностью.');
  async function loadTexture(name,unit){
    const image=new Image();
    if(name){image.src='assets/'+folder+name;await image.decode();}
    gl.activeTexture(gl.TEXTURE0+unit);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    if(name)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const hasMipmaps=name && (image.width & (image.width-1))===0 && (image.height & (image.height-1))===0;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,hasMipmaps?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    if(hasMipmaps)gl.generateMipmap(gl.TEXTURE_2D);
    decodedBytes+=sizes[name]||0;
    report('Готовим поверхности и освещение…');
    return texture;
  }
  const textures=await Promise.all([loadTexture(info.enamelTexture,0),loadTexture(info.shelfShadow,1),loadTexture(info.benchTexture,2),loadTexture(info.paperTexture,3),loadTexture(info.labVolume?.texture,4),loadTexture(info.salonTexture,5),loadTexture(info.plumageTexture,6),loadTexture(info.tvTexture,7)]);
  const reefMaterial=info.reefTexture?await loadTexture(info.reefTexture,7):null;
  const berthPhoto=info.berthTexture?await loadTexture(info.berthTexture,7):null;
  gl.useProgram(mesh.prog);
  const hull=info.expedition?.calypso;
  if(hull)gl.uniform4f(mesh.shipFrame,hull.origin[0],hull.origin[1],Math.cos(hull.yaw),Math.sin(hull.yaw));
  gl.uniform1f(mesh.village,info.expedition?1:0);gl.uniform1i(mesh.enamel,0);gl.uniform1i(mesh.shelf,1);gl.uniform1i(mesh.benchMap,2);
  gl.uniform1i(mesh.fieldAtlas,3);gl.uniform1i(mesh.salonMap,5);
  gl.uniform1i(mesh.labVolume,4);
  gl.uniform1i(mesh.tankOptics,info.aquarium?1:0);
  if(info.aquarium){
    gl.uniform3fv(mesh.tankLow,info.aquarium.low);
    gl.uniform3fv(mesh.tankHigh,info.aquarium.high);
  }
  if(info.labVolume){
    gl.uniformMatrix4fv(mesh.roomInverse,false,info.labVolume.worldToLocal);
    gl.uniform3fv(mesh.volumeMin,info.labVolume.low);
    gl.uniform3fv(mesh.volumeMax,info.labVolume.high);
  }
  const hangarModes={hangarShell:1,hangarWood:2,hangarMetal:3,hangarRubber:4,hangarLamp:5,hangarWater:6};
  const drawFish=info.expedition?.hangarDeck&&createReefFish(gl,program);
  const poolView=info.expedition?.hangarDeck?gl.createTexture():null;
  const pools={hangarWater:[6.30,5,2.15,1.746],moonpool:[-.869,-1.054,2.36,.485],cabinWater:[10,-30,-19.829,.525]};
  const isWell=g=>poolView&&pools[g.name];
  const drawGroups=[...info.groups.filter(g=>!isWell(g)),...info.groups.filter(isWell)];
  let poolW=0,poolH=0;
  function capturePool(w,h){
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,poolView);
    if(w!==poolW||h!==poolH){
      poolW=w;poolH=h;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,w,h,0,gl.RGB,gl.UNSIGNED_BYTE,null);
    }
    gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h);
    gl.uniform1i(mesh.salonMap,7);gl.uniform2f(mesh.poolPixel,1/w,1/h);
  }
  const bedTextures={};
  for(const [batch,file] of Object.entries({coverWest:info.westCover,coverSouth:info.southCover,pillowTick:info.pillowFabric})){
    if(file)bedTextures[batch]=await loadTexture(file,7);
  }
  bedTextures.hutCover=bedTextures.coverWest;
  bedTextures.hutPillow=bedTextures.pillowTick;
  bedTextures.hutPrint=textures[5];
  const fittedBerths=info.groups.some(g=>g.name==='berthWall'&&g.indexCount>0);
  const finishes={wetTerry:2.49,wetSuit:2.50,wetLocker:2.51,instrument:1,scope:1.06,coral:1.2,cabinet:1.4,deckFinish:1.48,bunkCloth:2.87,coverWest:2.895,coverSouth:2.895,pillowTick:2.895,berthPrint:3.41,berthWall:3.11,berthCrown:3.21,berthDeck:3.31,television:2.92,reelA:2.6,reelB:2.6,salonSolid:2.6,wetTeak:2.64,salonPrint:2.8,plumage:2.83,moonpool:7,spray:8,paper:2,opal:3,water:4,glass:5,port:6};
  if(info.labLighting){
    gl.uniform3fv(mesh.labLamp,info.labLighting.lamp);gl.uniform3fv(mesh.labWindow,info.labLighting.window);
  }
  function buffer(target,bytes){
    const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,bytes,gl.STATIC_DRAW);return b;
  }
  const verts=buffer(gl.ARRAY_BUFFER,new Uint8Array(data,0,offset));
  buffer(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(data,offset,info.indexCount));
  const backdrop=buffer(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]));
  const steamQuad=steam?buffer(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1])):null;
  const dustData=new Float32Array(1050);
  let seed=1963;
  for(let i=0;i<dustData.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;dustData[i]=seed/4294967296*12;}
  const motes=buffer(gl.ARRAY_BUFFER,dustData);
  function attr(loc,size,type,stride=0,offset=0,norm=false){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,type,norm,stride,offset);}
  const maxBudget=Math.min(devicePixelRatio||1,mobile?1.25:1.6);
  const minBudget=Math.min(maxBudget,mobile?.68:.72);
  let budget=maxBudget,slowTime=0,fastTime=0;
  // Interior furnishings cannot be distinguished through another habitat at these distances.
  const stationFurniture=new Set([...Object.keys(finishes),'interior','bench','moonpool']);
  for(const name of ['hutCover','hutPillow','hutPrint'])stationFurniture.delete(name);
  const hangarFurniture=new Set(['hangarWood','hangarRubber','hangarMetal','hangarLamp']);
  let tapeSeconds=0;
  function draw(cam,time,dt){
    if(cam.tapeRunning)tapeSeconds+=dt;
    // Bound a single stall's vote, so a pause cannot lower resolution on its own.
    const sample=Math.min(dt,.20);
    slowTime=dt>.040?slowTime+sample:Math.max(0,slowTime-2*sample);
    fastTime=dt>0&&dt<.022?fastTime+sample:0;
    if(slowTime>=.95){
      budget=Math.max(minBudget,budget*(dt>.10?.76:.88));
      slowTime=0;
    }else if(fastTime>=10){
      budget=Math.min(maxBudget,budget+.10);
      fastTime=0;
    }
    const factor=Math.min(budget,1500/Math.max(canvas.clientWidth,canvas.clientHeight));
    const w=Math.max(1,Math.round(canvas.clientWidth*factor)),h=Math.max(1,Math.round(canvas.clientHeight*factor));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);
    const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
    const f=[cy*cp,sy*cp,sp],r=[sy,-cy,0],u=[-cy*sp,-sy*sp,cp];
    const ly=1/Math.tan((w/h<1?79:68)*Math.PI/360),lx=ly*h/w;
    const marginX=Math.hypot(1,lx), marginY=Math.hypot(1,ly);
    function visiblePatch(x,y,z,radius){
      x-=cam.pos[0];y-=cam.pos[1];z-=cam.pos[2];
      const depth=x*f[0]+y*f[1]+z*f[2];
      return depth+radius>0 && depth-radius<78 &&
        Math.abs(x*r[0]+y*r[1])*lx<depth+radius*marginX &&
        Math.abs(x*u[0]+y*u[1]+z*u[2])*ly<depth+radius*marginY;
    }
    function camera(p){
      gl.useProgram(p.prog);gl.uniform3fv(p.eye,cam.pos);gl.uniform3fv(p.forward,f);
      gl.uniform3fv(p.right,r);gl.uniform3fv(p.up,u);gl.uniform2f(p.lens,lx,ly);gl.uniform1f(p.clock,time%12000);
    }
    gl.disable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);camera(sky);gl.uniform1f(sky.village,info.expedition?1:0);gl.bindBuffer(gl.ARRAY_BUFFER,backdrop);
    attr(sky.p,2,gl.FLOAT);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(sky.p);
    gl.enable(gl.DEPTH_TEST);drawFish?.(time,camera,visiblePatch);camera(mesh);gl.bindBuffer(gl.ARRAY_BUFFER,verts);
    attr(mesh.paintUV,2,gl.UNSIGNED_BYTE,20,18,true);attr(mesh.p,3,gl.FLOAT,20);attr(mesh.n,3,gl.BYTE,20,12,true);attr(mesh.color,3,gl.UNSIGNED_BYTE,20,15,true);
    let waterCaptured=false;
    const remoteStation=mobile&&Math.hypot(cam.pos[0]-.65,cam.pos[1]+4.10,cam.pos[2]-3.55)>15;
    const remoteHangar=mobile&&Math.hypot(cam.pos[0]-6.3,cam.pos[1]-5,cam.pos[2]-3.4)>15;
    for(const g of drawGroups){
      if(!g.indexCount || (g.bounds&&!visiblePatch(...g.bounds)))continue;
      if(remoteStation&&stationFurniture.has(g.name)&&(cam.inside||g.name==='moonpool'))continue;
      if(remoteHangar&&hangarFurniture.has(g.name))continue;
      if(drawFish&&g.name==='shoal')continue;
      const hangarMode=hangarModes[g.name]||0;
      const well=isWell(g);
      if(well&&!visiblePatch(...well))continue;
      gl.uniform4f(mesh.pool,...(well||[0,0,0,0]));
      gl.uniform1f(mesh.vessel,g.name.startsWith('hut')?4:g.name==='cabinGlass'?3:g.name==='denise'?2:g.name==='cabin'?1:0);
      gl.uniform1f(mesh.workshop,hangarMode);
      const batch=g.name.endsWith('East')?g.name.slice(0,-4):g.name;
      if(batch.startsWith('canyon')){
        const reefX=g.name.endsWith('East')?29:-17;
        const distance=Math.hypot(cam.pos[0]-reefX,Math.max(0,-10-cam.pos[1],cam.pos[1]-26));
        if(cam.inside || (batch!=='canyonWall' && distance>66))continue;
      }
      if(g.name==='spray'&&(!cam.inside||!cam.showerOn))continue;
      const animated=info.expedition?.motion[g.name];
      if(animated){
        gl.uniform3fv(mesh.pivot,animated.pivot);
        const clock=g.name==='reelA'||g.name==='reelB'?tapeSeconds:time;
        gl.uniform4f(mesh.spin,...animated.axis,clock*animated.speed);
      }else gl.uniform4f(mesh.spin,0,0,1,0);
      const seaView=['windowReef','shoal','terrain','exterior','shipSkin','canyonFish','canyonFishB','canyonLife','canyonWall','canyonSand','gardenShoal','gardenShoalB','penShoal','denise'].includes(batch);
      gl.uniform1f(mesh.inside,cam.inside&&!seaView?1:0);
      if(g.name==='shoal'){
        const heading=(time%12000)*.32;
        gl.uniform4f(mesh.shoalTurn,Math.cos(heading),Math.sin(heading),...info.shoalCenter);
      }else gl.uniform4f(mesh.shoalTurn,0,0,0,0);
      const finish=finishes[g.name]||0;
      if((g.name==='interior'||g.name==='bench'||finish)&&!cam.inside&&!visiblePatch(.65,-4.10,3.55,5.2))continue;
      if(cam.inside&&!cam.remoteRoom&&(g.name==='reef'||g.name==='cabin'))continue;
      const local=cam.inside&&(g.name==='interior'||g.name==='house'||g.name==='bench');
      gl.uniform1i(mesh.wingLining,cam.inside&&g.name==='house'&&!!info.steamOrigin?1:0);
      gl.uniform1f(mesh.study,info.paperTexture&&(local||finish)?1:0);
      gl.uniform1i(mesh.salonRoom,local&&info.salonTexture&&!finish&&g.name!=='bench'?1:0);
      gl.uniform1f(mesh.finishType,finish);
      gl.uniform1i(mesh.stationSkin,!!(info.expedition?.passage||info.expedition?.channels)&&!cam.inside&&['house','garage','hangarShell','cabin','exterior'].includes(g.name)?1:0);
      gl.uniform1i(mesh.shipPaint,g.name==='shipSkin'?1:0);
      gl.uniform1i(mesh.berthLight,fittedBerths&&cam.inside&&(local||finish>0)?1:0);
      const seabed=reefMaterial&&['reef','windowReef','terrain','canyonWall','canyonSand','canyonLife'].includes(batch);
      const picture=g.name==='television'?textures[7]:g.name==='berthPrint'?berthPhoto:bedTextures[g.name];
      if(seabed||picture){
        gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,seabed?reefMaterial:picture);
      }
      gl.uniform1i(mesh.salonMap,seabed||picture?7:g.name==='plumage'?6:5);
      gl.uniform1i(mesh.wetLining,local&&info.plumageTexture&&g.name!=='bench'?1:0);
      const transparent=!well&&(finish>=4||g.name==='cabinGlass');
      if(transparent){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
      gl.uniform1f(mesh.benchSurface,g.name==='bench'?1:0);
      gl.uniform1f(mesh.labEnabled,cam.inside&&info.labLighting&&(g.name==='interior'||g.name==='house'||g.name==='bench')?1:0);
      gl.uniform1f(mesh.reefSurface,({reef:1,windowReef:1,canyonWall:2,canyonSand:3,canyonLife:4})[batch]||0);
      gl.uniform1f(mesh.painted,g.name==='enamel'?1:0);
      gl.uniform1f(mesh.terrain,g.name==='terrain'?1:0);
      if(well){
        if(!waterCaptured){capturePool(w,h);waterCaptured=true;}
        gl.uniform1i(mesh.salonMap,7);
      }
      if(!cam.inside && g.throughWindow){
        const [first,count]=g.throughWindow;
        gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,first*4);
      }else if(g.patches){
        // Adjacent visible tiles share the same material and contiguous index buffer.
        let start=0,pending=0;
        for(const [first,count,x,y,z,radius] of g.patches){
          if(visiblePatch(x,y,z,radius)){
            if(!pending)start=first;
            pending+=count;
          }else if(pending){
            gl.drawElements(gl.TRIANGLES,pending,gl.UNSIGNED_INT,start*4);
            pending=0;
          }
        }
        if(pending)gl.drawElements(gl.TRIANGLES,pending,gl.UNSIGNED_INT,start*4);
      }else gl.drawElements(gl.TRIANGLES,g.indexCount,gl.UNSIGNED_INT,g.firstIndex*4);
      if(transparent){gl.depthMask(true);gl.disable(gl.BLEND);}
    }
    for(const a of [mesh.p,mesh.n,mesh.color,mesh.paintUV])gl.disableVertexAttribArray(a);
    if(steam && cam.inside && !cam.remoteRoom){
      camera(steam);gl.uniform3fv(steam.steamOrigin,info.steamOrigin);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER,steamQuad);attr(steam.p,2,gl.FLOAT);
      gl.uniform2f(steam.plumeSize,.158,.39);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      for(const source of info.expedition?.smoke||[]){
        gl.uniform3fv(steam.steamOrigin,source);gl.uniform2f(steam.plumeSize,.056,.22);
        gl.uniform1f(steam.clock,time*.68+source[0]*11.);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      }
      gl.disableVertexAttribArray(steam.p);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    if(!cam.inside){
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);camera(dust);
      gl.uniform1f(dust.scale,factor);gl.bindBuffer(gl.ARRAY_BUFFER,motes);attr(dust.seed,3,gl.FLOAT);
      gl.drawArrays(gl.POINTS,0,dustData.length/3);gl.disableVertexAttribArray(dust.seed);gl.depthMask(true);gl.disable(gl.BLEND);
    }
    if(emission&&!cam.inside){
      camera(emission);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER,motes);attr(emission.seed,3,gl.FLOAT);
      gl.uniform1f(emission.scale,h*ly*.5);gl.uniform2f(emission.jet,0,0);
      for(const source of info.expedition.exhaust){
        gl.uniform3fv(emission.source,source);gl.uniform1f(emission.height,12.49-source[2]);gl.drawArrays(gl.POINTS,0,185);
      }
      const {pivot,speed}=info.expedition.motion.denise;
      const angle=time*speed,c=Math.cos(angle),s=Math.sin(angle);
      gl.uniform2f(emission.jet,-s,c);
      for(const side of [-1,1]){
        const x=3.6+side*1.392,y=-.78;
        gl.uniform3f(emission.source,pivot[0]+x*c-y*s,pivot[1]+x*s+y*c,pivot[2]+.045);
        gl.drawArrays(gl.POINTS,0,110);
      }
      gl.disableVertexAttribArray(emission.seed);gl.depthMask(true);gl.disable(gl.BLEND);
    }
    return function project(point){
      const v=point.map((p,i)=>p-cam.pos[i]),dot=a=>v[0]*a[0]+v[1]*a[1]+v[2]*a[2],z=dot(f);
      return z>.18?[(1+lx*dot(r)/z)*canvas.clientWidth/2,(1-ly*dot(u)/z)*canvas.clientHeight/2]:null;
    };
  }
  draw.hangarDeck=info.expedition?.hangarDeck;
  draw.spurHeads=info.expedition?.spurHeads;
  draw.reefChannels=info.expedition?.channels ?? (info.expedition?.passage?[info.expedition.passage]:[]);
  draw.saucerMotion=info.expedition?.motion.denise;
  draw.calypsoHull=info.expedition?.calypso;
  return draw;
}
