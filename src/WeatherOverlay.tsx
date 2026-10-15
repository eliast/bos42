import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl } from './api';
import './weather.css';

type Report = {
  station: string; observedAt: number; raw: string;
  temperatureC: number | null; dewpointC: number | null;
  windDirection: number | 'VRB' | null; windSpeedKts: number | null; windGustKts: number | null;
  visibilityMiles: string | null; altimeterHpa: number | null; verticalVisibilityFt: number | null;
  conditions: string | null; category: string | null; clouds: {cover: string; baseFt: number | null}[];
};
type Weather = {status: 'available' | 'stale' | 'unavailable'; report: Report | null; serverTime: number; error: string | null};
const covers: Record<string, string> = {CLR: 'Clear skies', SKC: 'Clear skies', NSC: 'No significant cloud', NCD: 'No cloud detected', FEW: 'Few clouds', SCT: 'Scattered clouds', BKN: 'Broken clouds', OVC: 'Overcast', VV: 'Sky obscured'};
const categories: Record<string, string> = {VFR: 'Visual conditions', MVFR: 'Marginal visual conditions', IFR: 'Instrument conditions', LIFR: 'Low instrument conditions'};
const number = (value: number) => Math.round(value).toLocaleString('en-US');
const celsius = (value: number | null) => value === null ? '—' : `${number(value)}°C`;
const reportTime = (at: number) => new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(at);

export function WeatherIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3v1M2 7H1m1.5-3.5.8.8M9.5 3.5l-.8.8M6 11a3 3 0 1 1 3-3"/><path d="M7 20a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.8-1A4.5 4.5 0 1 1 18 20H7Z"/></svg>;
}

export function WeatherOverlay({ onClose }: { onClose: () => void }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const clockOffset = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    let disposed = false;
    let pending: AbortController | null = null;
    async function refresh() {
      if (document.hidden || pending) return;
      const controller = new AbortController(); pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      setLoading(true);
      try {
        const response = await fetch(apiUrl('/api/weather'), { signal: controller.signal, cache: 'no-store' });
        const value = await response.json() as Weather;
        if (!['available', 'stale', 'unavailable'].includes(value.status) || (value.report && (value.report.station !== 'KBOS' || !Number.isFinite(value.report.observedAt)))) throw new Error('Invalid weather response');
        if (!disposed) {
          clockOffset.current = Number.isFinite(value.serverTime) ? value.serverTime - Date.now() : 0;
          setClock(Date.now()); setWeather(value);
        }
      } catch {
        if (!disposed) setWeather(previous => ({status: previous?.report ? 'stale' : 'unavailable', report: previous?.report || null, serverTime: Date.now(), error: 'Cannot update Logan’s weather. Check your connection.'}));
      } finally { clearTimeout(timeout); pending = null; if (!disposed) setLoading(false); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    const tick = window.setInterval(() => setClock(Date.now()), 30_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; pending?.abort(); clearInterval(timer); clearInterval(tick); document.removeEventListener('visibilitychange', visible); };
  }, []);

  const report = weather?.report;
  const age = report ? Math.max(0, Math.floor((clock + clockOffset.current - report.observedAt) / 60_000)) : 0;
  const old = weather?.status === 'stale' || age > 90;
  const wind = !report || report.windSpeedKts === null ? 'Unavailable' : report.windSpeedKts === 0 ? 'Calm' : `${report.windDirection === 'VRB' ? 'Variable' : report.windDirection === null ? 'Direction unavailable' : `From ${number(report.windDirection)}°`} · ${number(report.windSpeedKts)} kt`;
  const ceilingLayers = report?.clouds.filter(c => ['BKN', 'OVC'].includes(c.cover) && c.baseFt !== null).map(c => c.baseFt as number) || [];
  if (report?.verticalVisibilityFt !== null && report?.verticalVisibilityFt !== undefined) ceilingLayers.push(report.verticalVisibilityFt);
  const ceiling = ceilingLayers.length ? `${number(Math.min(...ceilingLayers))} ft` : report?.clouds.length && report.clouds.every(c => ['CLR', 'SKC', 'FEW', 'SCT', 'NSC', 'NCD'].includes(c.cover)) ? 'None reported' : 'Unavailable';
  const condition = report?.conditions || (report?.clouds[0] ? covers[report.clouds[0].cover] || report.clouds[0].cover : 'Airport observation');

  return createPortal(<aside id="airport-weather" className="weather-overlay" role="dialog" aria-modal="false" aria-labelledby="weather-title">
    <header className="weather-heading"><div><small>KBOS · AIRPORT OBSERVATION</small><h2 id="weather-title">Logan weather</h2></div><button ref={closeButton} className="icon-button" aria-label="Close weather" onClick={onClose}>×</button></header>
    {report ? <>
      <div className="weather-time"><span>{reportTime(report.observedAt)} · {age < 1 ? 'just reported' : `${age} min ago`}</span><span className={old ? 'weather-old' : ''}>{old ? 'LAST REPORT' : 'METAR'}</span></div>
      {old && <p className="weather-notice" role="status">{weather?.error || 'This observation is more than 90 minutes old.'}</p>}
      <div className="weather-current"><div><strong>{report.temperatureC === null ? '—' : `${number(report.temperatureC * 9 / 5 + 32)}°`}</strong><span>F / {celsius(report.temperatureC)}</span></div><div><WeatherIcon/><p>{condition}</p>{report.category && <span className={`weather-category category-${report.category.toLowerCase()}`}>{report.category} · {categories[report.category]}</span>}<small className="weather-dew">Dew point {celsius(report.dewpointC)}</small></div></div>
      <dl className="weather-measures">
        <div className="weather-wind"><dt>Wind</dt><dd>{wind}</dd><small>{report.windGustKts !== null ? `Gusting ${number(report.windGustKts)} kt · ` : ''}Direction is true north</small></div>
        <div><dt>Altimeter</dt><dd>{report.altimeterHpa === null ? '—' : `${(report.altimeterHpa / 33.86389).toFixed(2)} inHg`}</dd></div>
        <div><dt>Visibility</dt><dd>{report.visibilityMiles === null ? '—' : `${report.visibilityMiles} mi`}</dd></div>
        <div className="weather-ceiling"><dt>Ceiling · above airport</dt><dd>{ceiling}</dd></div>
      </dl>
      {!!report.clouds.length && <div className="weather-clouds"><small>CLOUDS · ABOVE AIRPORT</small><span>{report.clouds.map(cloud => `${covers[cloud.cover] || cloud.cover}${cloud.baseFt !== null ? ` ${number(cloud.baseFt)} ft` : ''}`).join(' / ')}</span></div>}
      <div className="weather-raw"><p>{report.raw}</p></div>
    </> : <div className="weather-empty" role="status"><WeatherIcon/><p>{loading ? 'Fetching Logan’s latest observation…' : weather?.error || 'Weather report unavailable.'}</p></div>}
    <footer className="weather-footer"><a href="https://aviationweather.gov/data/metar/?id=KBOS" target="_blank" rel="noreferrer">NOAA Aviation Weather Center ↗</a></footer>
  </aside>, document.body);
}
