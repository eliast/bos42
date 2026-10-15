import { useEffect, useRef, useState } from 'react';
import { classifyFlight, flightFacts } from '../shared/flightGuide.mjs';
import { apiUrl } from './api';
import type { Aircraft, FeedStatus, Route } from './types';

export function FlightBadge({ aircraft, compact = false }: { aircraft: Aircraft; compact?: boolean }) {
  const kind = classifyFlight(aircraft);
  return <span className={`flight-kind kind-${kind.kind} ${compact ? 'compact' : ''}`} title={kind.basis}>
    <span aria-hidden="true">{kind.kind === 'private' ? '◇' : kind.kind === 'cargo' ? '▣' : kind.kind === 'business' ? '◇' : '↗'}</span>
    {compact ? kind.shortLabel : kind.label}
  </span>;
}

interface Props { gaugesVisible?: boolean; aircraft: Aircraft | null; route: Route | null; aircraftName: string; stale: boolean; nextArrival: Aircraft | null; trafficStatus: FeedStatus; }
type FaaStatus = {status: 'available' | 'stale' | 'unavailable'; report: {airport: 'BOS'; updatedAt: number; departures: string; arrivals: string; destinations: string} | null; source: string};
const time = (value: number) => new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(value);

export function FlightTicker(props: Props) {
  const [faa, setFaa] = useState<FaaStatus | null>(null);
  useEffect(() => {
    let disposed = false;
    let pending: AbortController | null = null;
    async function refresh() {
      if (document.hidden || pending) return;
      const controller = new AbortController(); pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(apiUrl('/api/faa-status'), {signal: controller.signal, cache: 'no-store'});
        const value = await response.json() as FaaStatus;
        if (!['available', 'stale', 'unavailable'].includes(value.status) || (value.report && (value.report.airport !== 'BOS' || !Number.isFinite(value.report.updatedAt)))) throw new Error('Invalid FAA status');
        if (!disposed) setFaa(value);
      } catch {
        if (!disposed) setFaa(previous => ({status: previous?.report ? 'stale' : 'unavailable', report: previous?.report || null, source: previous?.source || 'https://www.fly.faa.gov/fly/flyfaa/flyfaaindex?ARPT=BOS&p=1'}));
      } finally { clearTimeout(timeout); pending = null; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; pending?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return <SelectedFlightTicker key={`${props.aircraft?.id}:${props.aircraft?.callsign}`} {...props} faa={faa}/>;
}

function SelectedFlightTicker({ aircraft, route, aircraftName, stale, faa, nextArrival, trafficStatus, gaugesVisible = false }: Props & {faa: FaaStatus | null}) {
  const [duration, setDuration] = useState(90);
  const group = useRef<HTMLSpanElement>(null);
  const facts = flightFacts(aircraft, route, aircraftName, {telemetry: !gaugesVisible});
  if (faa?.report) {
    const concise = (value: string) => {
      const normal = value.match(/delays lasting (\d+) minutes or less/i);
      return normal ? `Delays ${normal[1]} min or less` : value;
    };
    const status = [
      {label: faa.status === 'available' ? 'FAA BOS' : 'FAA BOS · LAST REPORT', text: time(faa.report.updatedAt)},
      {label: 'Departures', text: concise(faa.report.departures)},
      {label: 'Arrivals', text: concise(faa.report.arrivals)},
    ];
    if (!/no destination-specific delays/i.test(faa.report.destinations)) status.push({label: 'Destinations', text: faa.report.destinations});
    facts.unshift(...status);
  } else facts.unshift({label: 'FAA BOS', text: faa ? 'Airport status temporarily unavailable.' : 'Checking airport status…'});
  const nextName = nextArrival?.callsign ? `${nextArrival.operator === 'Other aircraft' ? '' : `${nextArrival.operator} `}${nextArrival.label}` : nextArrival?.operator && nextArrival.operator !== 'Other aircraft' ? nextArrival.operator : 'Unidentified aircraft';
  facts.unshift({label: 'Next likely arrival', text: nextArrival ? `${nextName} · ${nextArrival.distanceNm.toFixed(1)} nautical miles from Logan` : trafficStatus === 'stale' || trafficStatus === 'unavailable' || trafficStatus === 'connecting' ? 'Waiting for live aircraft updates' : 'No likely arrivals in the latest coverage'});
  useEffect(() => {
    const node = group.current;
    if (!node) return;
    const measure = () => setDuration(Math.max(40, node.getBoundingClientRect().width / 32));
    const observer = new ResizeObserver(measure);
    observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);

  return <section className="flight-ticker" aria-label="Selected flight information">
    <p className="sr-only">{stale ? 'These figures describe the last report. ' : ''}{facts.map(fact => `${fact.label}: ${fact.text}`).join('. ')}</p>
    <div className="ticker-viewport" tabIndex={0} aria-label="Flight facts">
      <span className="ticker-track" aria-hidden="true" style={{ '--ticker-duration': `${duration}s` } as React.CSSProperties}>
        {[0, 1].map(copy => <span className="ticker-group" key={copy} ref={copy === 0 ? group : undefined}>{facts.map(fact => <span className="ticker-fact" key={fact.label}><b>{fact.label}</b><span>{fact.text}</span><i>·</i></span>)}</span>)}
      </span>
    </div>
  </section>;
}
