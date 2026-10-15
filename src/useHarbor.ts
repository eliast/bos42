import { useEffect, useState } from 'react';
import { apiUrl } from './api';
import type { HarborFeed } from './harborTypes';
const initial: HarborFeed = {status:'connecting',vessels:[],serverTime:Date.now(),lastMessageAt:null,error:null};
export function useHarbor(enabled: boolean) {
  const [feed, setFeed] = useState<HarborFeed>(initial);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    let pending: AbortController | null = null;
    async function poll() {
      if (cancelled || pending) return;
      if (document.hidden) { timer=setTimeout(poll,5000); return; }
      const controller=new AbortController(); pending=controller;
      const timeout=setTimeout(()=>controller.abort(),15000);
      try {
        const response=await fetch(apiUrl('/api/vessels'),{signal:controller.signal,cache:'no-store'});
        const value=await response.json() as HarborFeed;
        if (!Array.isArray(value.vessels) || !['connecting','live','stale','unavailable','unconfigured'].includes(value.status)) throw new Error('Invalid harbor feed');
        if (!cancelled) setFeed(value);
      } catch {
        if (!cancelled) setFeed(previous=>({...previous,status:previous.vessels.length?'stale':'unavailable',error:'Harbor updates interrupted. Reconnecting.'}));
      } finally { clearTimeout(timeout);pending=null;if(!cancelled)timer=setTimeout(poll,5000); }
    }
    const visible=()=>{if(!document.hidden&&!pending){clearTimeout(timer);void poll();}};
    document.addEventListener('visibilitychange',visible);void poll();
    return ()=>{cancelled=true;clearTimeout(timer);pending?.abort();document.removeEventListener('visibilitychange',visible);};
  },[enabled]);
  return feed;
}
