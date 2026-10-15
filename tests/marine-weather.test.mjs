import test from 'node:test';
import assert from 'node:assert/strict';
import {marineForecast,harborWaterLevel,marineAdvisories} from '../shared/marineWeather.mjs';
const now=Date.parse('2026-10-15T02:00:00Z');
test('marine forecast accepts only Boston Harbor and preserves wind and wave text',()=>{
  const data={properties:{zone:'https://api.weather.gov/zones/forecast/ANZ230',updated:'2026-10-14T22:00:00-04:00',periods:[{name:'Overnight',detailedForecast:'NW winds 10 kt. Waves 2 ft.'}]}};
  assert.deepEqual(marineForecast(data),{updatedAt:now,period:'Overnight',text:'NW winds 10 kt. Waves 2 ft.'});
  assert.equal(marineForecast({properties:{...data.properties,zone:'https://api.weather.gov/zones/forecast/ANZ250'}}),null);
  assert.equal(marineForecast({}),null);
});
test('Boston tide data stays in feet MLLW and uses UTC observation timestamps',()=>{
  const data={metadata:{id:'8443970'},data:[{t:'2026-10-15 02:00',v:'2.578'}]};
  assert.deepEqual(harborWaterLevel(data),{at:now,feet:2.578});
  for(const v of ['', 'garbage', '100'])assert.equal(harborWaterLevel({...data,data:[{t:'2026-10-15 02:00',v}]}),null);
  assert.equal(harborWaterLevel({...data,metadata:{id:'other'}}),null);
});
test('advisories exclude expired, exercise and other marine zones',()=>{
  const p={status:'Actual',event:'Small Craft Advisory',severity:'Moderate',expires:'2026-10-15T09:00:00Z',affectedZones:['https://api.weather.gov/zones/forecast/ANZ230']};
  const features=[p,{...p,status:'Exercise'},{...p,expires:'2026-10-15T01:00:00Z'},{...p,affectedZones:['https://api.weather.gov/zones/forecast/ANZ250']}].map(properties=>({properties}));
  assert.equal(marineAdvisories({features},now).length,1);
  assert.deepEqual(marineAdvisories({features:[]},now),[]);
  assert.equal(marineAdvisories({},now),null);
});

test('tide phase locates now between the surrounding high and low predictions',async()=>{
  const {tidePredictions,tidePhase}=await import('../shared/marineWeather.mjs');
  const rows=tidePredictions({predictions:[{t:'2026-10-15 00:00',v:'1',type:'L'},{t:'2026-10-15 06:00',v:'9',type:'H'},{t:'2026-10-15 12:00',v:'1',type:'L'}]});
  const rising=tidePhase(rows,Date.parse('2026-10-15T03:00Z'));
  assert.equal(rising.rising,true);assert.equal(rising.progress,.5);assert.equal(rising.minutesToNext,180);assert.equal(rising.afterNext.type,'L');
  const falling=tidePhase(rows,Date.parse('2026-10-15T09:00Z'));
  assert.equal(falling.rising,false);assert.equal(falling.next.type,'L');
  assert.equal(tidePhase(rows,Date.parse('2026-10-14T23:00Z')),null);
  assert.equal(tidePhase(rows,Date.parse('2026-10-15T12:00Z')),null);
  assert.equal(tidePredictions({error:{message:'No data'}}),null);
});
