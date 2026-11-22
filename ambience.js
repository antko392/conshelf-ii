// Recordings are local. Decode each layer on its first visit, after sound is enabled.
function createMixer(context){
  const decoded=new Map(),tracks=new Map(),retryAfter=new Map(),layers=new Map();
  const master=context.createGain();
  master.gain.value=.85;
  master.connect(context.destination);
  const mobilePlayback=matchMedia('(any-pointer:coarse)').matches;
  function load(name){
    if(tracks.has(name))return tracks.get(name);
    if(context.currentTime<(retryAfter.get(name)??0))return Promise.resolve(null);
    const task=fetch(new URL('./assets/sound/'+name+'.mp3',import.meta.url))
      .then(response=>{
        if(!response.ok)throw new Error('Audio '+response.status);
        return response.arrayBuffer();
      })
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{decoded.set(name,buffer);return buffer;})
      .catch(()=>{
        tracks.delete(name);
        retryAfter.set(name,context.currentTime+15);
        return null;
      });
    tracks.set(name,task);
    return task;
  }

  function layer(name,volume){
    let item=layers.get(name);
    if(!item){
      if(volume<=0||context.currentTime<(retryAfter.get(name)??0))return;
      const gain=context.createGain();
      gain.gain.value=0;
      gain.connect(master);
      item={gain,volume:0};
      layers.set(name,item);
      load(name).then(buffer=>{
        if(!buffer){gain.disconnect();layers.delete(name);return;}
        const source=context.createBufferSource();
        source.buffer=buffer;source.loop=true;
        source.connect(gain);source.start();
      });
    }
    if(Math.abs(item.volume-volume)<.003&&!(volume===0&&item.volume!==0))return;
    item.volume=volume;
    item.gain.gain.setTargetAtTime(volume,context.currentTime,.22);
  }

  let scene=null,stepDistance=0,stride=0,nextChirp=0;
  function play(name,variant,duration,volume,pan){
    const buffer=decoded.get(name);
    if(!buffer){load(name);return;}
    const voice=context.createBufferSource(),gain=context.createGain();
    voice.buffer=buffer;
    voice.playbackRate.value=.95+Math.random()*.09;
    gain.gain.value=volume;
    voice.connect(gain);
    const stereo=context.createStereoPanner?.();
    if(stereo){stereo.pan.value=pan;gain.connect(stereo);stereo.connect(master);}
    else gain.connect(master);
    voice.onended=()=>{voice.disconnect();gain.disconnect();stereo?.disconnect();};
    voice.start(0,variant*2,duration);
  }
  return {
    invalidate(){stepDistance=0;},
    update(place,moved,radio,shower,bird,pool){
      const water=place==='sea',hangar=place==='garage-deck',cabin=place.startsWith('cabin-');
      if(place!==scene){
        scene=place;stepDistance=0;nextChirp=context.currentTime+3+Math.random()*5;
        load(water?'stroke':'foot');
        if(place==='station')load('claude');
      }
      layer('shell',water?.4:0);
      layer('instruments',water?0:hangar?.095:cabin?.14:.12);
      layer('pool',hangar?.09+.17*pool:place==='cabin-wet'?.065:0);
      layer('shower',shower*.40);
      layer('radio',mobilePlayback&&radio>0?.23+.52*radio:.32*radio);
      // Distance accumulates only from collision-resolved locomotion.
      if(moved>0&&moved<.6){
        stepDistance+=moved;
        const interval=water?2.85:.7;
        if(stepDistance>=interval){
          stepDistance%=interval;
          play(water?'stroke':'foot',stride%3,water?.85:.42,water?.41:.35,stride%2?.14:-.14);
          stride++;
        }
      }
      if(bird>.04&&context.currentTime>=nextChirp){
        play('claude',Math.floor(Math.random()*3),1.05,.26*bird,0);
        nextChirp=context.currentTime+16+Math.random()*21;
      }
    }
  };
}

export function setupSound(button){
  const Audio=window.AudioContext||window.webkitAudioContext;
  button.hidden=!Audio;
  let context,mixer,enabled=false;
  function updateButton(){
    button.setAttribute('aria-pressed',String(enabled));
    button.title=enabled?'Выключить звук':'Включить звук';
  }
  function sync(){
    if(!context)return;
    mixer.invalidate();
    if(enabled&&!document.hidden){
      context.resume().catch(()=>{});
    }else{
      context.suspend().catch(()=>{});
    }
  }
  function setEnabled(value){
    if(!Audio||button.disabled)return;
    if(value&&!context){
      try{
        // Ask iOS to use the media playback route for the expedition soundtrack.
        if(navigator.audioSession){
          try{navigator.audioSession.type='playback';}catch{}
        }
        context=new Audio();
        const unlock=context.createBufferSource();
        unlock.buffer=context.createBuffer(1,1,context.sampleRate);
        unlock.connect(context.destination);unlock.onended=()=>unlock.disconnect();unlock.start();
        mixer=createMixer(context);
      }catch{
        context?.close();context=null;
        button.disabled=true;button.title='Звук недоступен в этом браузере';return;
      }
    }
    enabled=value;updateButton();sync();
  }
  function resumeOnInput(){
    if(enabled&&context&&context.state!=='running'&&!document.hidden)context.resume().catch(()=>{});
  }
  document.addEventListener('pointerup',resumeOnInput,{passive:true});
  document.addEventListener('keydown',resumeOnInput);
  button.onclick=()=>setEnabled(!enabled);
  document.addEventListener('visibilitychange',sync);
  return {
    start(){setEnabled(true);},
    get active(){return enabled&&context?.state==='running'&&!document.hidden;},
    update(...args){mixer.update(...args);},
    stop(){enabled=false;updateButton();sync();}
  };
}
