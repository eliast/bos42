// Local visual QA harness; no live API or map required. Not included in the production entry.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FollowFacts } from '../src/FollowFacts';
import { AircraftInfo } from '../src/AircraftInfo';
import { supportedAircraftTypes } from '../shared/aircraftProfiles.mjs';
import { demoFeed } from '../src/demo';
function Preview() {
  const [type, setType] = useState('A359');
  const [open, setOpen] = useState(false);
  return <main style={{position:'relative', background:'#102536', color:'#e7f1f5', minHeight:'100vh', padding:24, fontFamily:'system-ui'}}><h1>Aircraft information preview</h1><p>Local fixtures · no live flight data</p><label>Aircraft type <select value={type} onChange={e=>setType(e.target.value)}>{[...supportedAircraftTypes, 'ZZZZ', ''].map(code=><option key={code} value={code}>{code || 'Missing type'}</option>)}</select></label><button onClick={()=>setOpen(true)} style={{margin:20,padding:16}}>View Info</button><FollowFacts key={type} aircraft={{...demoFeed().aircraft[0],aircraftType:type||null}} onInfo={()=>setOpen(true)}/>{open && <AircraftInfo aircraft={{...demoFeed().aircraft[0], aircraftType:type || null}} onClose={()=>setOpen(false)}/>}</main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
