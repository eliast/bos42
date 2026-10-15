import {FlightStory} from './FlightStory';
import { useEffect, useRef, useState, useId } from 'react';
import { resolveAircraftProfile, aircraftByLength, aircraftCatalogReviewed } from '../shared/aircraftProfiles.mjs';
import type { Aircraft } from './types';
import './AircraftInfo.css';

type Profile = NonNullable<ReturnType<typeof resolveAircraftProfile>>;
function distance(m: number) { return `${m.toLocaleString('en-US', { maximumFractionDigits: 2 })} m / ${Math.round(m * 3.28084)} ft`; }
function HelicopterDiagram({profile:p,compact=false}:{profile:Profile;compact?:boolean}) {
  const Container=compact?'span':'figure';
  return <Container className={`aircraft-side-profile ${compact?'compact-profile':''}`}><svg viewBox="0 0 1000 320" role="img" aria-label={`Illustrative helicopter profile, ${p.name}. Rotor diameter ${distance(p.span)}.`}>
    <g stroke="var(--info-accent)" strokeWidth="4" strokeLinejoin="round" fill="#9bb6c53d">
      <path d="M235 195 Q220 130 325 120 Q435 118 490 164 L820 148 827 172 485 203 Q385 250 270 220Z"/>
      <path d="m790 151 40-65h35l-30 83"/><path d="M390 124V83M175 82H630M285 243H475M319 223v20M427 218v25" fill="none"/>
      <path d="M246 168q13-38 71-40l-3 60h-68Z" fill="#0a2533"/><path d="M329 128h69l55 43-4 26H329Z" fill="#0a2533"/>
      <circle cx="827" cy="160" r="33" fill="none"/><path d="m804 137 46 46m0-46-46 46"/>
    </g><text x="500" y="290" textAnchor="middle" fill="#bfd0d8" fontSize="16">ROTOR Ø {distance(p.span)} · LENGTH {distance(p.length)}</text>
  </svg>{!compact&&<figcaption>Illustrative helicopter silhouette · rotor diameter replaces wingspan</figcaption>}</Container>;
}

function Schematic({ profile: p }: { profile: Profile }) {
  // Scale the main dimensions together; the airframe outline and engine positions remain illustrative.
  if(p.airframeKind==='helicopter')return <HelicopterDiagram profile={p}/>;
  const scale = Math.min(270 / p.length, 330 / p.span);
  const l = p.length * scale, w = p.span * scale, x = 240, y = 54;
  const rear = p.enginePosition === 'rear';
  const engineY = y + l * (rear ? .76 : .43), engineX = rear ? 24 : w * .2;
  return <figure className="aircraft-schematic"><svg viewBox="0 0 520 390" role="img" aria-label={`Illustrative top view of ${p.name}. Length ${distance(p.length)}, wingspan ${distance(p.span)}; two ${rear ? 'rear-mounted' : 'underwing'} engines.`}>
    <defs><pattern id="aircraft-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#8eb6cb" strokeOpacity=".08"/></pattern></defs>
    <rect width="520" height="390" fill="url(#aircraft-grid)"/>
    <g fill="var(--info-accent)" fillOpacity=".13" stroke="var(--info-accent)" strokeWidth="1.6" strokeLinejoin="round">
      <path d={`M${x-8} ${y+l*.38} L${x-w/2} ${y+l*.65} v12 L${x-8} ${y+l*.56} M${x+8} ${y+l*.38} L${x+w/2} ${y+l*.65} v12 L${x+8} ${y+l*.56}`}/>
      <path d={`M${x-5} ${y+l*.82} l${-w*.19} ${l*.13} v7 l${w*.2} ${-l*.04} M${x+5} ${y+l*.82} l${w*.19} ${l*.13} v7 l${-w*.2} ${-l*.04}`}/>
      <path d={`M${x} ${y} Q${x-12} ${y+12} ${x-12} ${y+38} L${x-10} ${y+l*.8} Q${x-5} ${y+l} ${x} ${y+l} Q${x+5} ${y+l} ${x+10} ${y+l*.8} L${x+12} ${y+38} Q${x+12} ${y+12} ${x} ${y} Z`}/>
      {[-1, 1].map(side => <g key={side}><rect x={x+side*engineX-7} y={engineY} width="14" height="29" rx="5" fillOpacity=".6"/><path d={`M${x+side*engineX-6} ${engineY+7} h12`}/></g>)}
      <path d={`M${x-7} ${y+27} Q${x} ${y+20} ${x+7} ${y+27}`} fill="none"/>
    </g>
    <g stroke="#94adba" strokeWidth="1" fill="none"><path d={`M${x-w/2} 344 H${x+w/2} M${x-w/2} 337 v14 M${x+w/2} 337 v14 M458 ${y} V${y+l} M451 ${y} h14 M451 ${y+l} h14`}/><path d={`M${x+engineX+8} ${engineY+15} H418 V94`} strokeDasharray="3 4"/></g>
    <g fill="#dce9ee" fontSize="12" fontFamily="system-ui"><text x={x} y="367" textAnchor="middle">WINGSPAN · {distance(p.span)}</text><text transform={`translate(482 ${(y+y+l)/2}) rotate(-90)`} textAnchor="middle">LENGTH · {distance(p.length)}</text><text x="410" y="76" textAnchor="end">2 × {rear ? 'rear-mounted' : 'underwing'}</text><text x="410" y="92" textAnchor="end">turbofan engines</text><text x="22" y="26" fill="#8ca5b3" fontSize="10" letterSpacing="2">PLAN VIEW / {p.name.includes('CRJ') ? 'REGIONAL JET' : p.enginePosition === 'rear' ? 'BUSINESS JET' : 'AIRLINER'}</text></g>
  </svg><figcaption>Illustrative schematic · outline and engine positions are approximate</figcaption></figure>;
}

function SideProfile({ profile: p, compact = false }: { profile: Profile; compact?: boolean }) {
  const paintId = useId().replace(/:/g, '');
  const Container = compact ? 'span' : 'figure';
  if(p.airframeKind==='helicopter')return <HelicopterDiagram profile={p} compact={compact}/>;
  const rear = p.enginePosition === 'rear';
  const wide = /777|787|767|A330|A350|A300/.test(p.name);
  const bodyHeight = rear ? 33 : wide ? 59 : 46;
  const top = 174 - bodyHeight / 2;
  const count = rear ? 8 : Math.round(p.length * 1.35);
  const windowStart = rear ? 190 : 160;
  const windowEnd = rear ? 585 : 709;
  return <Container className={`aircraft-side-profile ${compact ? 'compact-profile' : ''}`}>
    <svg aria-hidden={compact || undefined} viewBox={compact ? "60 35 880 220" : "0 0 1000 320"} role="img" aria-label={`Illustrative side profile of ${p.name}, with airline-color accents. Not an exact livery or engineering drawing.`}>
      <defs>
        <linearGradient id={`${paintId}-aircraft-metal`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5fbff"/><stop offset=".45" stopColor="#cadce7"/><stop offset=".72" stopColor="#91a9b9"/><stop offset="1" stopColor="#4c6678"/></linearGradient>
        <linearGradient id={`${paintId}-aircraft-engine`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dce9f1"/><stop offset=".5" stopColor="#8ca5b6"/><stop offset="1" stopColor="#3b5365"/></linearGradient>
        <radialGradient id={`${paintId}-aircraft-halo`}><stop stopColor="var(--info-accent)" stopOpacity=".09"/><stop offset="1" stopColor="var(--info-accent)" stopOpacity="0"/></radialGradient>
      </defs>
      <ellipse cx="500" cy="180" rx="440" ry="130" fill={`url(#${paintId}-aircraft-halo)`}/>
      <text x="36" y="33" fill="#94afbd" fontSize="11" fontFamily="monospace" letterSpacing="3">PROFILE / {p.name.includes('CRJ') ? 'REGIONAL JET' : rear ? 'BUSINESS JET' : wide ? 'WIDEBODY' : 'SINGLE AISLE'}</text>
      <path d={`M712 ${top+9} Q744 ${top-6} 768 ${top-42} L832 51 L881 51 L831 ${top+22} Z`} fill="var(--info-accent)" stroke="#b7cfda" strokeWidth="1"/>
      <path d={`M758 ${top-9} L844 57 H856 L795 ${top+10} Z`} fill="#f6fbff" fillOpacity=".7"/>
      <path d={`M90 ${top+bodyHeight*.56} Q114 ${top-2} 160 ${top} H749 Q817 ${top+4} 889 ${top+bodyHeight*.48} Q820 ${top+bodyHeight*.83} 734 ${top+bodyHeight} H154 Q112 ${top+bodyHeight} 90 ${top+bodyHeight*.56}Z`} fill={`url(#${paintId}-aircraft-metal)`} stroke="#73909f" strokeWidth="1.2"/>
      <path d={`M102 ${top+bodyHeight*.66} Q350 ${top+bodyHeight*.85} 768 ${top+bodyHeight*.6} L829 ${top+bodyHeight*.66} Q450 ${top+bodyHeight*.99} 133 ${top+bodyHeight*.8}Z`} fill="var(--info-accent)" opacity=".9"/>
      <path d={`M110 ${top+bodyHeight*.32} l17 -8 h21 l-6 11 h-34Z`} fill="#233d53" stroke="#b9d1de"/>
      {Array.from({length:count},(_,i)=><rect key={i} x={windowStart+i*(windowEnd-windowStart)/count} y={top+bodyHeight*.32} width={rear ? 15 : 4.4} height={rear ? 12 : 6.5} rx={rear ? 5 : 2} fill="#253e50" stroke="#eaf7ff" strokeWidth=".6"/>)}
      {(rear ? [164] : [153,385,711]).map(dx=><g key={dx} stroke="#708897" fill="none" strokeWidth=".8"><rect x={dx} y={top+7} width={rear ? 17 : 13} height={bodyHeight-12} rx="3"/><path d={`M${dx+9} ${top+bodyHeight*.56} h3`}/></g>)}
      <path d={`M396 ${top+bodyHeight*.7} L560 ${top+bodyHeight+43} L682 ${top+bodyHeight+47} L468 ${top+bodyHeight*.62} Z`} fill={`url(#${paintId}-aircraft-metal)`} stroke="#6d8797"/>
      <path d={`M446 ${top+bodyHeight*.8} L615 ${top+bodyHeight+40} M474 ${top+bodyHeight*.84} L642 ${top+bodyHeight+42}`} fill="none" stroke="#5d7c90" strokeWidth=".8"/>
      <path d={`M768 ${top+bodyHeight*.48} L858 ${top+bodyHeight*.03} L915 ${top+bodyHeight*.03} L823 ${top+bodyHeight*.64}Z`} fill={`url(#${paintId}-aircraft-metal)`} stroke="#637f90"/>
      {rear ? <g><path d={`M674 ${top+12} h54 l21 12 -15 14 h-64Z`} fill={`url(#${paintId}-aircraft-engine)`} stroke="#698393"/><ellipse cx="674" cy={top+25} rx="7" ry="13" fill="#263f51"/><path d={`M683 ${top+17} h45`} stroke="var(--info-accent)" strokeWidth="3"/></g> : <g><path d={`M414 ${top+bodyHeight-2} l24 14 h32 l-24 -22Z`} fill="#718b9b"/><path d={`M403 ${top+bodyHeight+7} Q442 ${top+bodyHeight+2} 486 ${top+bodyHeight+16} v17 Q440 ${top+bodyHeight+45} 402 ${top+bodyHeight+38}Z`} fill={`url(#${paintId}-aircraft-engine)`} stroke="#627f90"/><ellipse cx="403" cy={top+bodyHeight+22} rx="11" ry="17" fill="#21394b" stroke="#d2e4ef" strokeWidth="3"/><ellipse cx="403" cy={top+bodyHeight+22} rx="4" ry="7" fill="#6d8798"/><path d={`M425 ${top+bodyHeight+9} v30`} stroke="#5b768a"/></g>}
      <g stroke="#7594a6" strokeWidth="1"><path d="M90 279H915M90 273v12M915 273v12"/></g>
      <text x="502" y="303" textAnchor="middle" fill="#bdd1de" fontSize="12" fontFamily="system-ui">LENGTH · {distance(p.length)}</text>
    </svg>{!compact && <figcaption>Illustrative profile · airline-color accents, not an exact livery · not to scale</figcaption>}
  </Container>;
}

export function AircraftInfo({ aircraft, onClose }: { aircraft: Aircraft; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const flightProfile = resolveAircraftProfile(aircraft.aircraftType);
  const [browseCode, setBrowseCode] = useState<string | null>(null);
  const p = browseCode ? resolveAircraftProfile(browseCode) : flightProfile;
  const browsingOther = p !== flightProfile;
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const current = rail.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (current && rail.current) rail.current.scrollLeft = current.offsetLeft - (rail.current.clientWidth - current.clientWidth) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [browseCode]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  const fields = p ? [
    ['Manufacturer', p.manufacturer], [`Engine options · ${p.engineCount} ${p.engineKind==='turboshaft'?'turboshafts':'turbofans'}`, p.engines],
    ['Length', distance(p.length)], [p.airframeKind==='helicopter'?'Rotor diameter':'Wingspan', distance(p.span)],
    ['Seating / occupancy', p.capacity], ['Published model range', p.range],
    ['Cruise speed', p.cruise], ['Historical list price', p.price], ['Published fuel reference', p.fuelBurn], ['Manufacturer fuel comparison', p.fuelEfficiency], ['Fuel capacity · not fuel aboard', p.fuelCapacity], ['First flight', p.firstFlight],
  ].filter(([, value]) => value) : [];
  return <dialog ref={dialog} className="aircraft-info" aria-labelledby="aircraft-info-title" style={{ '--info-accent': aircraft.color } as React.CSSProperties} onCancel={onClose} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], summary')].filter(item => item.getClientRects().length > 0);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <header className="aircraft-info-heading"><div><small>AIRCRAFT FIELD GUIDE <span>AVAILABLE OFFLINE</span></small><h2 id="aircraft-info-title">{p?.name || 'Aircraft information'}</h2><p>{aircraft.label} · {aircraft.registration || 'Registration unavailable'} · {aircraft.aircraftType || 'Type unavailable'}</p>{browsingOther && <p className="browsing-model">Comparing with {flightProfile?.name || aircraft.aircraftType || 'unidentified aircraft'} {flightProfile && p && ` · ${Math.abs(Math.round((p.length / flightProfile.length - 1) * 100))}% ${p.length >= flightProfile.length ? 'longer' : 'shorter'}`} · <button onClick={() => setBrowseCode(null)}>Back to selected</button></p>}</div><button autoFocus onClick={onClose} aria-label="Close aircraft information">×</button></header>
    <div className="aircraft-info-body"><FlightStory aircraft={aircraft}/>
      <section className="aircraft-size-browser" aria-label="Aircraft sorted by length">
        <div className="size-browser-heading"><strong>THE SIZE LINEUP</strong><span>Shortest → longest · swipe to explore · same scale</span></div>
        <div className="aircraft-size-rail" ref={rail}>{aircraftByLength.map(model => <button key={model.code} className="aircraft-size-card" aria-label={`${model.name}, length ${distance(model.length)}`} aria-pressed={p === resolveAircraftProfile(model.code)} onClick={() => setBrowseCode(model.code)}>
          <span className="size-card-art"><span style={{width:`${model.length / 73.9 * 100}%`}}><SideProfile profile={model} compact/></span></span>
          <strong>{model.name.replace(' family', '')}</strong><span>{distance(model.length)}{flightProfile === resolveAircraftProfile(model.code) ? ' · SELECTED FLIGHT' : ''}</span>
        </button>)}</div>
      </section>
      {p ? <>
      {p.fallback && <p className="aircraft-info-notice"><strong>Family-level profile</strong>{p.fallback}</p>}
      <div className="aircraft-overview"><SideProfile profile={p}/><div className="aircraft-info-layout"><div><p className="aircraft-info-eyebrow">DESIGN & CAPABILITY</p><dl className="aircraft-info-stats">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></div></div><p className="aircraft-capability-note">Model capabilities · not this flight’s distance or fitted configuration</p><details className="aircraft-plan-details"><summary>Dimension plan view <span>Dimensions & engine layout</span></summary><Schematic profile={p}/></details>
      <details className="aircraft-source-details"><summary>Facts & sources <span>Specifications, context and references</span></summary>
      {p.fact && <p className="aircraft-info-fact">{p.fact}</p>}
      <p className="aircraft-info-note">{p.note} Specifications vary with equipment, payload and cabin layout. Range is the model’s published capability, not this flight’s distance, duration or remaining range. Engine options do not confirm the engines fitted to this registration.</p>
      <footer className="aircraft-info-sources"><p>SOURCES <span>Curated {aircraftCatalogReviewed} · links open online</span></p>{p.sources.map((s: {url: string; label: string}) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.label} <span aria-hidden="true">↗</span></a>)}</footer></details>
    </> : <div className="aircraft-info-empty"><span aria-hidden="true">◇</span><h3>{aircraft.aircraftType ? `No offline profile for ${aircraft.aircraftType}` : 'Aircraft type not reported'}</h3><p>{aircraft.aircraftType ? 'This model is not in the curated guide yet. Dimensions and performance are unavailable.' : 'The live feed has not identified this aircraft’s model. A callsign or airline alone cannot establish its type.'}</p><p>You can close this sheet and keep watching the flight.</p></div>}</div>
  </dialog>;
}
