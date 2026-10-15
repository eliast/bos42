import express from 'express';
import {createFlightStoryService} from './flightStory.mjs';
import { createFeedService, createRouteService } from './feed.mjs';
import { createWeatherService } from './weather.mjs';
import { createFaaStatusService } from './faaStatus.mjs';
import { createHarborService } from './harbor.mjs';
import { createJourneyService } from './journey.mjs';

export function createApp({ feed = createFeedService(), routes = createRouteService(), weather = createWeatherService(), faaStatus = createFaaStatusService(), harbor = createHarborService(), journeys = createJourneyService(), stories, corsOrigins = process.env.CORS_ORIGINS || 'capacitor://localhost' } = {}) {
  const app = express();
  app.locals.harbor = harbor;
  app.locals.feed = feed;
  stories ||= createFlightStoryService({routes});
  app.locals.stories=stories;
  feed.subscribe?.((aircraft,time)=>stories.ingest(aircraft,time));
  const allowed = new Set(corsOrigins.split(',').map(origin => origin.trim()).filter(Boolean));
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.vary('Origin');
    const origin = req.headers.origin;
    if (origin) {
      if (!allowed.has(origin)) return res.status(403).json({ error: 'Origin not allowed' });
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'BOS/42', time: Date.now() }));
  app.get('/api/flight-story/status',(_req,res)=>res.json(stories.status()));
  app.get('/api/flight-story/:id',async(req,res)=>{
    if(!/^[a-zA-Z0-9~]{1,12}$/.test(req.params.id))return res.status(400).json({status:'invalid'});
    try{const snapshot=await feed.getSnapshot();const aircraft=snapshot.aircraft.find(a=>a.id===req.params.id);if(snapshot.status!=='live'||!aircraft||snapshot.serverTime-aircraft.observedAt<0||snapshot.serverTime-aircraft.observedAt>=20000)return res.json({status:'unavailable'});res.json(stories.get(aircraft));}catch{res.status(503).json({status:'unavailable'});}
  });
  app.get('/api/approaches', (_req,res) => {
    const history=feed.getApproachHistory?.();
    if(!history)return res.status(503).json({status:'unavailable',tracks:[]});
    res.json({...history,status:history.tracks.length?'available':'collecting'});
  });
  app.get('/api/vessels', (_req, res) => {
    try { const value = harbor.getSnapshot(); res.status(['unavailable', 'unconfigured'].includes(value.status) ? 503 : 200).json(value); }
    catch { res.status(503).json({ status: 'unavailable', vessels: [], error: 'Harbor feed unavailable', serverTime: Date.now() }); }
  });
  app.get('/api/aircraft', async (_req, res) => {
    try { const value = await feed.getSnapshot(); res.status(value.status === 'unavailable' ? 503 : 200).json(value); }
    catch (error) { console.error('feed', error); res.status(503).json({ status: 'unavailable', aircraft: [], error: 'Live feed unavailable', serverTime: Date.now() }); }
  });
  app.get('/api/route/:callsign', async (req, res) => res.json(await routes.get(req.params.callsign.toUpperCase())));
  app.get('/api/journey/:id', async (req, res) => {
    if (!/^[a-zA-Z0-9~]{1,12}$/.test(req.params.id)) return res.status(400).json({status:'invalid',journey:null});
    try {
      const snapshot=await feed.getSnapshot();
      const aircraft=snapshot.aircraft.find(a=>a.id===req.params.id && snapshot.serverTime-a.observedAt>=0 && snapshot.serverTime-a.observedAt<20000);
      if(snapshot.status!=='live'||!aircraft)return res.json({status:'unavailable',journey:null,source:'FlightAware AeroAPI',retrievedAt:null});
      res.json(await journeys.get(aircraft));
    } catch {res.status(503).json({status:'unavailable',journey:null,source:'FlightAware AeroAPI',retrievedAt:null});}
  });
  app.get('/api/weather', async (_req, res) => {
    try { const value = await weather.getSnapshot(); res.status(value.status === 'unavailable' ? 503 : 200).json(value); }
    catch { res.status(503).json({ status: 'unavailable', report: null, error: 'Weather report unavailable', serverTime: Date.now() }); }
  });
  app.get('/api/faa-status', async (_req, res) => {
    try { const value = await faaStatus.getSnapshot(); res.status(value.status === 'unavailable' ? 503 : 200).json(value); }
    catch { res.status(503).json({ status: 'unavailable', report: null, error: 'FAA BOS status unavailable', serverTime: Date.now() }); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));
  return app;
}
