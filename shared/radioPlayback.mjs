// Own one media element and one retry chain. A deliberate stop always wins.
export function createRadioPlayback(player,{onStatus,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}){
  let wanted=false,url='',generation=0,retries=0,retryTimer=null,watchdog=null;
  let status='stopped',lastTime=0,lastProgressAt=0,playingSince=null;
  const emit=(next,delay=0)=>{status=next;onStatus?.(next,delay);};
  const clear=()=>{if(retryTimer!==null)cancel(retryTimer);if(watchdog!==null)cancel(watchdog);retryTimer=watchdog=null;};
  const release=()=>{player.removeAttribute('src');player.pause();player.load();};
  const active=()=>wanted&&!!player.getAttribute('src');
  function fail(error){
    if(!wanted)return;
    ++generation;clear();release();playingSince=null;
    if(error?.name==='NotAllowedError'){emit('blocked');return;}
    const delay=[2000,5000,10000,20000,30000][Math.min(retries++,4)];
    emit('retrying',delay);
    retryTimer=schedule(()=>{retryTimer=null;if(wanted)connect();},delay);
  }
  function check(){
    watchdog=null;if(!active())return;
    const time=now(),position=player.currentTime;
    if(Number.isFinite(position)&&position>lastTime+.01){
      lastTime=position;lastProgressAt=time;
      if(!player.paused&&status==='connecting'){playingSince??=time;emit('playing');}
      if(playingSince!==null&&time-playingSince>=30000)retries=0;
    }
    if(player.paused||player.ended||time-lastProgressAt>=25000){fail();return;}
    watchdog=schedule(check,5000);
  }
  function connect(){
    if(!wanted)return;
    clear();const id=++generation;
    release();playingSince=null;lastTime=0;lastProgressAt=now();emit('connecting');
    player.src=url;player.load();
    watchdog=schedule(check,5000);
    // play() remains directly in the user's event stack for gesture-based playback.
    try{Promise.resolve(player.play()).catch(error=>{if(wanted&&id===generation)fail(error);});}
    catch(error){if(id===generation)fail(error);}
  }
  const events={
    playing:()=>{if(active()&&!player.paused){lastTime=player.currentTime;lastProgressAt=now();playingSince??=now();emit('playing');}},
    waiting:()=>{if(active())emit('connecting');},
    stalled:()=>{if(active())emit('connecting');},
    error:()=>{if(active())fail();},
    ended:()=>{if(active())fail();},
    pause:()=>{if(active()&&player.paused)fail();},
  };
  for(const [event,listener]of Object.entries(events))player.addEventListener(event,listener);
  function stop(){wanted=false;++generation;clear();release();emit('stopped');}
  return{
    start(nextUrl){url=nextUrl;wanted=true;retries=0;connect();},
    recover(){if(wanted&&status!=='blocked'&&(status==='retrying'||player.paused||now()-lastProgressAt>=25000))connect();},
    stop,
    dispose(){stop();for(const [event,listener]of Object.entries(events))player.removeEventListener(event,listener);},
  };
}
