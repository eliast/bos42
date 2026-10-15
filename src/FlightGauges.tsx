import { useEffect, useId, useState, type ReactNode } from 'react';
import { continueAngle, dialAngle, instrumentReadings } from '../shared/instruments.mjs';
import type { Aircraft } from './types';
import type { Vessel } from './harborTypes';
import { vesselIsStale } from './VesselInfo';
import './cockpit.css';

const C = 110;
const point = (angle: number, radius: number) => ({ x: C + Math.sin(angle * Math.PI / 180) * radius, y: C - Math.cos(angle * Math.PI / 180) * radius });
const format = (value: number | null) => value === null ? '—' : Math.round(value).toLocaleString('en-US');

function Scale({ min, max, step, major, start, end, label = String }: { min: number; max: number; step: number; major: number; start: number; end: number; label?: (n: number) => string }) {
  return <g className="dial-scale">{Array.from({length: Math.round((max - min) / step) + 1}, (_, index) => {
    const value = min + index * step, angle = dialAngle(value, min, max, start, end), isMajor = index % (major / step) === 0;
    const outer = point(angle, 91), inner = point(angle, isMajor ? 83 : 87), text = point(angle, 65);
    return <g key={index}><line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} strokeWidth={isMajor ? 2 : 1}/>{isMajor && <text x={text.x} y={text.y} dominantBaseline="central">{label(value)}</text>}</g>;
  })}</g>;
}

function Hand({ angle, short = false }: { angle: number; short?: boolean }) {
  return <g className={`dial-hand ${short ? 'short-hand' : ''}`} style={{transform: `rotate(${angle}deg)`}}>
    <path d={short ? 'M110 57 104 71 106 105 105 121 115 121 114 105 116 71Z' : 'M110 27 107 47 108 103 105 123 115 123 112 103 113 47Z'}/>
  </g>;
}

function Readout({ value, wide = false }: { value: string; wide?: boolean }) {
  return <g className="dial-readout"><rect x={wide ? 64 : 78} y="125" width={wide ? 92 : 64} height="26" rx="2"/><text x="110" y="145">{value}</text></g>;
}

function Instrument({ name, caption, accessibleValue, children, unavailable = false }: { name: string; caption: string; accessibleValue: string; children: ReactNode; unavailable?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <figure className={`instrument ${unavailable ? 'instrument-unavailable' : ''}`} aria-label={`${name}: ${accessibleValue}`}>
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-face`} cx="43%" cy="28%" r="75%"><stop stopColor="#19313d" stopOpacity=".42"/><stop offset="1" stopColor="#071820" stopOpacity=".7"/></radialGradient>
      </defs>
      <circle cx="110" cy="110" r="103" fill={`url(#${id}-face)`} stroke="#c0d4da" strokeOpacity=".32" strokeWidth="2"/>
      <circle cx="110" cy="110" r="97" fill="none" stroke="#c0d4da" strokeOpacity=".12"/>
      {children}
      <path d="M35 68a88 88 0 0 1 139-28" fill="none" stroke="#fff" strokeWidth="2" opacity=".04"/>
    </svg>
    <figcaption>{caption}</figcaption>
  </figure>;
}

function TrackGauge({ value, vessel = false }: {value: number | null; vessel?: boolean}) {
  const [angle, setAngle] = useState(value ?? 0);
  useEffect(() => { if (value !== null) setAngle(previous => continueAngle(previous, value)); }, [value]);
  return <Instrument name="Ground track" caption="TRACK · TRUE" accessibleValue={value === null ? 'Unavailable' : `${Math.round(value) % 360} degrees true`} unavailable={value === null}>
    <g className="compass-card" style={{transform: `rotate(${-angle}deg)`, opacity: value === null ? .25 : 1}}>
      {Array.from({length: 72}, (_, i) => {
        const degrees = i * 5, p1 = point(degrees, 91), p2 = point(degrees, i % 6 === 0 ? 83 : 87), t = point(degrees, 65);
        const cardinal = ({0:'N',90:'E',180:'S',270:'W'} as Record<number,string>)[degrees];
        return <g key={i} className="dial-scale"><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} strokeWidth={i % 6 === 0 ? 2 : 1}/>{i % 6 === 0 && <text x={t.x} y={t.y} dominantBaseline="central" className={cardinal ? 'cardinal' : ''} transform={`rotate(${degrees},${t.x},${t.y})`}>{cardinal || degrees / 10}</text>}</g>;
      })}
    </g>
    <path className="compass-index" d="m104 13 6 12 6-12Z"/>
    <text className="dial-title" x="110" y="79">GROUND TRACK</text>
    <path className="compass-airplane" d={vessel ? "M110 89 119 105 116 121 104 121 101 105Z M110 97v16" : "m110 89 2 13 17 8v3l-17-4v9l5 3v2l-7-1-7 1v-2l5-3v-9l-17 4v-3l17-8Z"}/>
    <Readout value={value === null ? '—' : `${String(Math.round(value) % 360).padStart(3,'0')}°`}/>
    <text className="dial-unit" x="110" y="164">TRUE</text>
  </Instrument>;
}

export function FlightGauges({aircraft, now, interrupted, demo}: {aircraft: Aircraft; now: number; interrupted: boolean; demo: boolean}) {
  const values = instrumentReadings(aircraft), age = Math.max(0, Math.floor((now - aircraft.observedAt) / 1000));
  const stale = interrupted || age > 20;
  const roundedAltitude = values.altitude === null ? null : Math.round(values.altitude / 25) * 25;
  const altitudeDisplay = roundedAltitude === null ? '—' : `${roundedAltitude < 0 ? '−' : ''}${String(Math.abs(roundedAltitude)).padStart(5,'0')}`;
  const rate = values.verticalSpeed === null ? null : Math.round(values.verticalSpeed / 50) * 50;
  const rateDisplay = rate === null ? '—' : `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${Math.abs(rate)}`;
  return <div className={`instruments ${stale ? 'instruments-stale' : ''}`}>
    {stale && <div className="instrument-status" role="status">{demo ? 'SIMULATED · ' : ''}LAST REPORT · {age}s AGO</div>}
    <div className="instrument-bank">
      <Instrument name="Groundspeed" caption="SPEED · KT" accessibleValue={values.speed === null ? 'Unavailable' : `${format(values.speed)} knots`} unavailable={values.speed === null}>
        <Scale min={0} max={600} step={10} major={100} start={-135} end={135}/>
        <text className="dial-title" x="110" y="85">GROUND SPEED</text><text className="dial-unit" x="110" y="99">KNOTS</text>
        {values.speed !== null && <Hand angle={dialAngle(values.speed,0,600,-135,135)}/>}
        <circle className="dial-hub" cx="110" cy="110" r="7"/><Readout value={values.speed === null ? '—' : String(Math.round(values.speed))}/>
      </Instrument>
      <Instrument name="Altitude" caption={`ALT · ${values.altitudeUnit}`} accessibleValue={values.altitude === null ? aircraft.ground ? 'On ground' : 'Unavailable' : `${format(roundedAltitude)} ${values.altitudeUnit}`} unavailable={values.altitude === null}>
        <Scale min={0} max={9.8} step={.2} major={1} start={0} end={352.8}/>
        <text className="dial-title" x="110" y="83">ALTITUDE</text><text className="dial-unit" x="110" y="97">{values.altitudeUnit}</text>
        {values.altitude !== null && <><Hand angle={values.altitude * .036} short/><Hand angle={values.altitude * .36}/></>}
        <circle className="dial-hub" cx="110" cy="110" r="7"/><Readout value={altitudeDisplay} wide/>
      </Instrument>
      <Instrument name="Vertical speed" caption="V/S · FT/MIN" accessibleValue={rate === null ? aircraft.ground ? 'On ground' : 'Unavailable' : `${rate > 0 ? 'Climbing' : rate < 0 ? 'Descending' : 'Level'}, ${format(Math.abs(rate))} feet per minute`} unavailable={rate === null}>
        <Scale min={-3000} max={3000} step={250} major={1000} start={-250} end={70} label={v => String(Math.abs(v) / 1000)}/>
        <text className="dial-title" x="113" y="80">VERTICAL SPEED</text><text className="dial-unit" x="113" y="95">1,000 FT / MIN</text>
        <text className="dial-direction" x="45" y="91">UP</text><text className="dial-direction" x="45" y="137">DN</text>
        {values.verticalSpeed !== null && <Hand angle={dialAngle(values.verticalSpeed,-3000,3000,-250,70)}/>}
        <circle className="dial-hub" cx="110" cy="110" r="7"/><Readout value={rateDisplay} wide/><text className="dial-unit" x="110" y="189">FT / MIN</text>
      </Instrument>
      <TrackGauge value={values.track}/>
    </div>
  </div>;
}

export function VesselGauges({vessel,now,interrupted}:{vessel:Vessel;now:number;interrupted:boolean}) {
  const speed=vessel.speedKts,stale=interrupted||vesselIsStale(vessel,now);
  return <div className={`instruments ${stale?'instruments-stale':''}`}>
    {stale&&<div className="instrument-status">LAST AIS REPORT</div>}
    <div className="instrument-bank">
      <Instrument name="Speed over ground" caption="SPEED · KT" accessibleValue={speed===null?'Unavailable':`${speed.toFixed(1)} knots`} unavailable={speed===null}>
        <Scale min={0} max={50} step={1} major={10} start={-135} end={135}/>
        {speed!==null&&<Hand angle={dialAngle(speed,0,50,-135,135)}/>}
        <circle className="dial-hub" cx="110" cy="110" r="7"/><Readout value={speed===null?'—':speed.toFixed(1)}/>
      </Instrument>
      <TrackGauge value={vessel.course} vessel/>
    </div>
  </div>;
}
