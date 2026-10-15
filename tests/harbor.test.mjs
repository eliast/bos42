import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { HarborStore, aisTime, vesselKind } from '../shared/marine.mjs';
import { createHarborService } from '../server/harbor.mjs';
const now = Date.parse('2026-10-04T03:00:00Z');
const packet = (type='PositionReport', fields={}, at=now) => ({ MessageType:type, MetaData:{MMSI:367784560, ShipName:'CHAMPION    ', time_utc:new Date(at).toISOString()}, Message:{[type]:{UserID:367784560,Valid:true,Latitude:42.3584,Longitude:-71.0386,Sog:8,Cog:312.7,TrueHeading:309,NavigationalStatus:0,...fields}} });

test('AIS timestamps, unavailable sentinels and measured zero remain distinct', () => {
  assert.equal(aisTime('2026-10-04 03:00:12.935211548 +0000 UTC'), now+12935);
  assert.equal(aisTime('not a time'), null);
  const store=new HarborStore();
  store.ingest(packet('PositionReport',{Sog:0,Cog:360,TrueHeading:511}),now);
  const [v]=store.snapshot(now);
  assert.equal(v.speedKts,0); assert.equal(v.course,null); assert.equal(v.heading,null); assert.equal(v.name,'CHAMPION');
  store.ingest(packet('PositionReport',{Sog:102.3}),now);
  assert.equal(store.snapshot(now)[0].speedKts,null);
});

test('static and voyage messages never create or refresh a position', () => {
  const store=new HarborStore();
  store.ingest(packet('ShipStaticData',{Name:'CHAMPION',Type:60,Dimension:{A:20,B:10,C:4,D:4},Destination:'BOSTON@@',MaximumStaticDraught:2.1,Eta:{Month:10,Day:4,Hour:4,Minute:30}}),now);
  assert.equal(store.snapshot(now).length,0);
  store.ingest(packet(),now);
  const [v]=store.snapshot(now);
  assert.equal(v.lengthM,30); assert.equal(v.widthM,8); assert.equal(v.destination,'BOSTON'); assert.equal(v.kind,'passenger');
  assert.deepEqual(v.eta,{month:10,day:4,hour:4,minute:30});
  store.ingest(packet('ShipStaticData',{Destination:'',Eta:{Month:0,Day:0,Hour:24,Minute:60}},now+120000),now+120000);
  const stale=store.snapshot(now+120000)[0];
  assert.equal(stale.observedAt,now); assert.equal(stale.stale,true); assert.equal(stale.destination,null); assert.equal(stale.eta,null);
});

test('Class B name and dimensions arrive in separate parts without erasing one another', () => {
  const store=new HarborStore();
  store.ingest(packet('StandardClassBPositionReport'),now);
  store.ingest(packet('StaticDataReport',{ReportA:{Valid:true,Name:'NEW NAME'},ReportB:{Valid:false,ShipType:0}}),now);
  store.ingest(packet('StaticDataReport',{ReportA:{Valid:false,Name:''},ReportB:{Valid:true,ShipType:37,CallSign:'ABC',Dimension:{A:8,B:4,C:2,D:2}}}),now);
  const [v]=store.snapshot(now);
  assert.equal(v.name,'NEW NAME'); assert.equal(v.lengthM,12); assert.equal(v.kind,'pleasure'); assert.equal(v.navigationStatus,null);
});

test('invalid, old and out-of-bounds positions do not become live harbor traffic', () => {
  const store=new HarborStore();
  for(const fields of [{Valid:false},{Latitude:91},{Longitude:181},{Latitude:0,Longitude:0}]) store.ingest(packet('PositionReport',fields),now);
  assert.equal(store.snapshot(now).length,0);
  store.ingest(packet(),now);
  store.ingest(packet('PositionReport',{Latitude:42.4},now-10000),now);
  assert.equal(store.snapshot(now)[0].lat,42.3584);
  assert.equal(store.snapshot(now+16*60000).length,0);
  const bad=packet(); bad.MetaData.time_utc='missing';
  assert.equal(new HarborStore().ingest(bad,now),false);
});

test('stationary boats tolerate normal slow reporting without indefinite extrapolation', () => {
  const store=new HarborStore();
  store.ingest(packet('PositionReport',{Sog:0,NavigationalStatus:5}),now);
  assert.equal(store.snapshot(now+180000)[0].stale,false);
  assert.equal(store.snapshot(now+301000)[0].stale,true);
  assert.equal(vesselKind(0).label,'Vessel');
  assert.equal(vesselKind(80).label,'Tanker');
});

function serviceHarness(apiKey='test-secret') {
  let time=now;
  const sockets=[], jobs=[];
  class Socket extends EventEmitter {
    readyState=1; sent=[];
    send(data){this.sent.push(JSON.parse(data));}
    ping(){this.emit('pong');}
    terminate(){this.emit('close');}
  }
  const service=createHarborService({apiKey,clock:()=>time,random:()=>0,socketFactory:()=>{const s=new Socket();sockets.push(s);return s;},schedule:(fn,delay)=>{const job={fn,delay,cancelled:false};jobs.push(job);return job;},cancel:j=>{j.cancelled=true;}});
  return {service,sockets,jobs,setTime:value=>time=value};
}

test('viewers share one upstream connection and snapshots never expose credentials', () => {
  const {service,sockets}=serviceHarness();
  service.start(); service.getSnapshot();service.getSnapshot();
  assert.equal(sockets.length,1);
  sockets[0].emit('open');
  assert.equal(sockets[0].sent[0].APIKey,'test-secret');
  assert.equal(service.getSnapshot().status,'connecting');
  sockets[0].emit('message',JSON.stringify({MessageType:'SubscriptionConfirmation'}));
  sockets[0].emit('message',JSON.stringify(packet()));
  const snapshot=service.getSnapshot();
  assert.equal(snapshot.status,'live');assert.equal(snapshot.vessels.length,1);
  assert.equal(JSON.stringify(snapshot).includes('test-secret'),false);
  service.stop();
});

test('disconnect preserves stale boats and reconnects with backoff; stop cancels reconnection', () => {
  const {service,sockets,jobs}=serviceHarness();
  service.start();sockets[0].emit('open');sockets[0].emit('message',JSON.stringify(packet()));
  sockets[0].emit('close');
  assert.equal(service.getSnapshot().status,'stale');
  const reconnect=jobs.find(j=>j.delay===2000);assert.ok(reconnect);
  reconnect.fn();assert.equal(sockets.length,2);
  service.stop(); assert.equal(jobs.filter(j=>!j.cancelled && j!==reconnect).length,0);
});

test('unconfigured feed stays explicit and never connects', () => {
  const {service,sockets}=serviceHarness('');
  service.start();assert.equal(service.getSnapshot().status,'unconfigured');assert.equal(sockets.length,0);
  service.stop();
});
