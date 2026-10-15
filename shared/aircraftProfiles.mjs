// Curated offline catalog. Reviewed 2026-10-14. Never infer a subvariant from an airline.
// Sources describe model capability, not the performance or equipment of a tracked flight.
const wiki = title => `https://en.wikipedia.org/wiki/${title}`;
const airbus = slug => `https://www.aircraft.airbus.com/en/aircraft/${slug}`;
const boeing = slug => `https://www.boeing.com/commercial/${slug}`;
const source = (label, url) => ({ label, url });
const families = {
  ceo: { manufacturer: 'Airbus', engines: 'CFM56-5B or IAE V2500', cruise: 'Mach 0.78', firstFlight: '22 Feb 1987 · A320 family', fact: 'The A320 introduced digital fly-by-wire controls to commercial airliners, with side-sticks in place of conventional control columns.', sources: [source('Wikipedia · A320 family', wiki('Airbus_A320_family')), source('Airbus · A320 family', 'https://www.airbus.com/en/products-services/commercial-aircraft/passenger-aircraft/a320-family')] },
  neo: { manufacturer: 'Airbus', engines: 'CFM LEAP-1A or Pratt & Whitney PW1100G', fact: '“neo” means New Engine Option. New engines and Sharklet wingtips distinguish this generation from the original A320 family.', sources: [source('Wikipedia · A320neo family', wiki('Airbus_A320neo_family')), source('Airbus · A320 family', 'https://www.airbus.com/en/products-services/commercial-aircraft/passenger-aircraft/a320-family')] },
  ng: { manufacturer: 'Boeing', engines: 'CFM International CFM56-7B', fact: 'The Next Generation series has a larger wing than the earlier 737 Classic generation.', sources: [source('Boeing · 737NG specifications', boeing('737ng')), source('Wikipedia · 737 Next Generation', wiki('Boeing_737_Next_Generation'))] },
  max: { manufacturer: 'Boeing', engines: 'CFM International LEAP-1B', sources: [source('Boeing · 737 MAX specifications', boeing('737max')), source('Wikipedia · 737 MAX', wiki('Boeing_737_MAX'))] },
  dreamliner: { manufacturer: 'Boeing', engines: 'GE GEnx-1B or Rolls-Royce Trent 1000', firstFlight: '15 Dec 2009 · 787 family', fact: 'The Dreamliner uses a composite primary structure. The -8, -9 and -10 share a common wingspan, with successively longer fuselages.', sources: [source('Boeing · 787 specifications', boeing('787')), source('Wikipedia · 787 Dreamliner', wiki('Boeing_787_Dreamliner'))] },
};
const profiles = {};
function add(code, family, name, length, span, capacity, range, extra = {}) {
  profiles[code] = { engineCount: 2, enginePosition: 'wing', engineKind:'turbofan', ...families[family], name, length, span, capacity, range, ...extra };
}
add('A319', 'ceo', 'Airbus A319', 33.84, 35.8, '124 · typical two-class', 'Up to 3,750 NM · Sharklets', { note: 'Wingspan shown with Sharklets; older wingtip fences give a 34.1 m span.' });
add('A320', 'ceo', 'Airbus A320', 37.57, 35.8, '150 · typical two-class', 'Up to 3,350 NM · Sharklets', { note: 'Wingspan shown with Sharklets; older wingtip fences give a 34.1 m span.' });
add('A321', 'ceo', 'Airbus A321', 44.51, 35.8, '185 · typical two-class', 'Up to 3,200 NM · Sharklets', { note: 'Wingspan shown with Sharklets; older wingtip fences give a 34.1 m span.' });
add('A20N', 'neo', 'Airbus A320neo', 37.57, 35.8, '150–180 · typical two-class', 'Up to 3,400 NM', { sources: [...families.neo.sources, source('Airbus · A320neo dimensions & range', airbus('a320-family/a320neo'))] });
add('A21N', 'neo', 'Airbus A321neo family', 44.51, 35.8, '180–220 · typical two-class', 'Up to 4,000 NM · LR configuration', { fallback: 'A21N does not establish the fuel-tank configuration. Family-level information; LR capability shown, not confirmed for this aircraft.', sources: [...families.neo.sources, source('Airbus · A321neo / LR specifications', airbus('a320-family/a321neo'))] });
add('B737', 'ng', 'Boeing 737-700', 33.6, 35.8, '125–145 · two-class', 'Up to 2,900 NM');
add('B738', 'ng', 'Boeing 737-800', 39.5, 35.8, '160–180 · two-class', 'Up to 2,800 NM');
add('B739', 'ng', 'Boeing 737-900 family', 42.1, 35.8, '175–195 · two-class', 'Up to 2,700 NM · Boeing catalog', { fallback: 'Family-level information. B739 does not distinguish the -900 from the -900ER.' });
add('B38M', 'max', 'Boeing 737 MAX 8', 39.5, 35.9, '160–180 · two-class', 'Up to 3,500 NM');
add('B39M', 'max', 'Boeing 737 MAX 9', 42.1, 35.9, '175–195 · two-class', 'Up to 3,300 NM');
add('B788', 'dreamliner', 'Boeing 787-8', 56.7, 60.1, '200–275 · two-class', 'Up to 8,000 NM');
add('B789', 'dreamliner', 'Boeing 787-9', 62.8, 60.1, '250–325 · two-class', 'Up to 8,300 NM');
add('B78X', 'dreamliner', 'Boeing 787-10', 68.3, 60.1, '300–375 · two-class', 'Up to 7,500 NM');
add('BCS3', null, 'Airbus A220-300', 38.7, 35.1, '120–150 · typical two-class', 'Up to 3,400 NM', { manufacturer: 'Airbus (originally Bombardier)', engines: 'Pratt & Whitney PW1500G', sources: [source('Airbus · A220-300 specifications', airbus('a220/a220-300')), source('Wikipedia · A220', wiki('Airbus_A220'))] });
add('B772', null, 'Boeing 777-200 family', 63.7, 60.9, '300–375 · two-class, -200ER', 'Up to 7,500 NM · -200ER', { manufacturer: 'Boeing', engines: 'PW4000, Rolls-Royce Trent 800 or GE90', fallback: 'Family-level fallback: B772 covers the -200 and -200ER. Performance and seating shown are for the -200ER; the feed does not confirm ER equipment.', sources: [source('Boeing · 777 specifications', boeing('777')), source('Wikipedia · 777', wiki('Boeing_777'))] });
add('B77W', null, 'Boeing 777-300ER', 73.9, 64.8, '350–425 · two-class', 'Up to 7,500 NM', { manufacturer: 'Boeing', engines: 'GE Aerospace GE90', sources: profiles.B772.sources });
add('B763', null, 'Boeing 767-300 family', 54.94, 47.57, null, null, { manufacturer: 'Boeing', engines: 'Engine option not confirmed', fallback: 'Family-level information. B763 can represent passenger, extended-range and cargo versions. Seating and range are omitted because the feed does not identify the configuration.', sources: [source('Boeing · 767 airport planning data', 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/767_REV_K.pdf'), source('Wikipedia · 767', wiki('Boeing_767'))] });
add('C68A', null, 'Cessna Citation Latitude', 19, 22.05, '9 · maximum occupants', 'Up to 2,700 NM', { manufacturer: 'Textron Aviation / Cessna', engines: 'Pratt & Whitney Canada PW306D1', enginePosition: 'rear', cruise: '446 KTAS · maximum cruise', firstFlight: '18 Feb 2014', fact: 'A flat cabin floor and 1.83 m stand-up cabin height give this midsize business jet room to move.', sources: [source('Cessna · Citation Latitude specifications', 'https://cessna.txtav.com/citation/latitude'), source('Wikipedia · Citation Latitude', wiki('Cessna_Citation_Latitude'))] });

// Added for aircraft actually observed over Boston. Reference variants stay explicit.
export const aircraftCatalogReviewed = '14 Oct 2026';
const manufacturerSource=(label,url)=>[source(label,url)];
const ejets='https://www.gov.br/anac/pt-br/assuntos/regulados/aeronaves/avaliacao-operacional/RelAvOp_ERJ170_190.pdf';
const e175='https://www.embraer.com/media/o3sjzbwl/e175_spec.pdf';
const cf34='https://www.geaerospace.com/commercial/aircraft-engines/cf34';
for(const [code,name,length,span,engine] of [
  ['E170','Embraer E170',29.90,26.00,'GE CF34-8E'],
  ['E75L','Embraer E175 · long wing',31.68,28.65,'GE CF34-8E'],
  ['E75S','Embraer E175 · short wing',31.68,26.00,'GE CF34-8E'],
  ['E190','Embraer E190',36.24,28.72,'GE CF34-10E'],
]) add(code,null,name,length,span,null,null,{manufacturer:'Embraer',engines:engine,fact:'A two-by-two cabin layout means this regional-jet family has no middle seats.',note:'Range and seating depend on the certified weight and cabin variant.',sources:[source('ANAC · Embraer operational suitability & dimensions',ejets),source('Embraer · E175 specifications',e175),source('GE Aerospace · CF34 engines',cf34)]});
profiles.E75L.fuelCapacity='3,071 US gal · E175 manufacturer reference';
profiles.E75L.sources.push(source('Embraer · E175 fuel capacity',e175));
for(const [code,name,length,span,capacity,engines] of [
  ['CRJ2','Bombardier CRJ200',26.77,21.21,'50 · maximum passengers','GE CF34-3B1'],
  ['CRJ7','Bombardier CRJ700 family',32.3,23.2,'78 · maximum, CRJ700 reference','GE CF34-8C5B1'],
  ['CRJ9','Bombardier CRJ900',36.2,24.9,'90 · maximum passengers','GE CF34-8C5'],
]) add(code,null,name,length,span,capacity,null,{manufacturer:'Bombardier / MHIRJ',engines,enginePosition:'rear',note:'Cabin layouts vary by operator; maximum seating is not a live passenger count.',sources:manufacturerSource('MHI · CRJ specifications','https://www.mhi.com/business/products-services/aviation/aircraft-aftermarket-service/crj')});
profiles.CRJ7.fallback='CRJ7 does not establish the cabin layout; CRJ550/700 configurations differ. CRJ700 reference shown.';
add('BCS1',null,'Airbus A220-100',35,35.1,'100–120 · typical two-class','Up to 3,600 NM',{manufacturer:'Airbus (originally Bombardier)',engines:'Pratt & Whitney PW1500G',fuelCapacity:'5,760 US gal · maximum',fuelEfficiency:'Airbus: 25% lower fuel burn per seat vs previous-generation aircraft',sources:manufacturerSource('Airbus · A220-100',airbus('a220/a220-100'))});
for(const [code,name,length,span,seats,range,engine,url] of [
  ['A332','Airbus A330-200',58.82,60.3,'210–250 · typical three-class','Up to 7,250 NM','GE CF6-80E1, PW4000 or Rolls-Royce Trent 700','a330/a330-200'],
  ['A333','Airbus A330-300',63.66,60.3,'250–290 · typical three-class','Up to 6,350 NM','GE CF6-80E1, PW4000 or Rolls-Royce Trent 700','a330/a330-300'],
  ['A339','Airbus A330-900',63.69,64,'287 · typical three-class',null,'Rolls-Royce Trent 7000','a330/a330-900'],
  ['A359','Airbus A350-900',66.8,64.75,'332–352 · typical three-class','Up to 8,600 NM · published reference','Rolls-Royce Trent XWB-84','a350/a350-900'],
  ['A35K','Airbus A350-1000',73.78,64.75,'375–400 · typical three-class','Up to 9,100 NM · published reference','Rolls-Royce Trent XWB-97','a350/a350-1000'],
]) add(code,null,name,length,span,seats,range,{manufacturer:'Airbus',engines:engine,cruise:/A35/.test(code)?'Mach 0.85':undefined,note:'Published design capability varies by weight, payload and fuel configuration.',sources:manufacturerSource('Airbus · model specifications',airbus(url))});
profiles.A333.fuelCapacity='36,750 US gal · maximum';
profiles.A359.fuelCapacity='166,488 litres · maximum';
profiles.A35K.fuelCapacity='168,300 litres · maximum';
profiles.A359.fuelEfficiency='Airbus: 25% lower fuel burn vs previous-generation aircraft';
profiles.A35K.fuelEfficiency=profiles.A359.fuelEfficiency;
profiles.A339.fuelEfficiency='Airbus: 25% lower fuel use vs previous-generation 777-200ER';
add('A306',null,'Airbus A300-600 family',54.08,44.84,null,null,{manufacturer:'Airbus',engines:'GE CF6-80C2 or Pratt & Whitney PW4000',fallback:'A306 does not establish passenger, freighter or conversion configuration. Seating and range are omitted.',sources:manufacturerSource('Airbus · A300-600 airport planning','https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-02/Airbus-Commercial-Aircraft-AC-A300-600-Dec-2009.pdf')});
for(const [code,name,length] of [['B752','Boeing 757-200 family',47.32],['B753','Boeing 757-300',54.47]]) add(code,null,name,length,38.05,null,null,{manufacturer:'Boeing',engines:'Pratt & Whitney PW2000 or Rolls-Royce RB211-535',fallback:'Reference airframe dimensions. The feed does not confirm passenger/cargo layout, winglet retrofit or certified performance variant.',sources:manufacturerSource('Boeing · 757 airport planning','https://www.boeing.com/content/dam/boeing/v2/airports/acaps/757_Rev_H.pdf')});
add('CL35',null,'Bombardier Challenger 350 / 3500',20.9,21,'10 · maximum passengers, 3500 reference','Up to 3,400 NM · 3500 reference',{manufacturer:'Bombardier',engines:'Honeywell HTF7350',enginePosition:'rear',fallback:'CL35 does not distinguish the 350 and 3500. Specifications and fuel study are 3500 references, not confirmation of this aircraft.',fuelBurn:'3500 study: 1,512 kg over an 800 NM mission · 4 passengers, 2 crew, NBAA IFR reserves',sources:manufacturerSource('Bombardier · Challenger 3500 environmental product declaration','https://bombardier.com/en/Bombardier-EPD-Challenger3500-en.pdf?attachment=')});
add('C700',null,'Cessna Citation Longitude',22.3,21.01,'12 · maximum occupants','Up to 3,500 NM',{manufacturer:'Textron Aviation / Cessna',engines:'Honeywell HTF7700L',enginePosition:'rear',cruise:'483 KTAS · maximum cruise',fuelCapacity:'2,164 US gal · usable',sources:manufacturerSource('Cessna · Citation Longitude','https://cessna.txtav.com/citation/longitude')});
add('C25B',null,'Cessna Citation CJ3 family',15.6,16.26,null,'Up to 2,040 NM · Gen3 reference',{manufacturer:'Textron Aviation / Cessna',engines:'Williams International FJ44-3A',enginePosition:'rear',cruise:'416 KTAS · maximum, Gen3 reference',fuelCapacity:'703 US gal · usable, Gen3 reference',fallback:'C25B does not confirm CJ3 generation or avionics. Current manufacturer Gen3 reference shown.',sources:manufacturerSource('Cessna · CJ3 Gen3','https://cessna.txtav.com/citation/cj3')});
add('C25C',null,'Cessna Citation CJ4 family',16.3,15.77,null,'Up to 2,165 NM · Gen3 reference',{manufacturer:'Textron Aviation / Cessna',engines:'Williams International FJ44-4A',enginePosition:'rear',cruise:'451 KTAS · maximum, Gen3 reference',fuelCapacity:'870 US gal · usable, Gen3 reference',fallback:'C25C does not confirm CJ4 generation or avionics. Current manufacturer Gen3 reference shown.',sources:manufacturerSource('Cessna · CJ4 Gen3','https://cessna.txtav.com/citation/cj4')});
add('H145',null,'Airbus H145',13.54,10.8,'Up to 10 passengers + 1 or 2 pilots','Up to 351 NM · standard fuel, sea level',{manufacturer:'Airbus Helicopters',engines:'Safran Arriel 2E',engineKind:'turboshaft',enginePosition:'rotor',airframeKind:'helicopter',cruise:'130 kt · recommended cruise',fuelCapacity:'723 kg · standard tanks',note:'Current H145 reference. Rotor diameter is shown instead of wingspan; length is the published D-value.',fact:'Turboshaft engines power the rotors rather than producing jet thrust directly.',sources:manufacturerSource('Airbus · H145 technical information','https://www.airbus.com/en/products-services/helicopters/civil-helicopters/h145/h145-technical-information')});
profiles.EC45={...profiles.H145,name:'EC145 / H145 family · H145 reference',engines:'Safran Arriel family · exact version not confirmed',fallback:'EC45 does not confirm the generation or fitted engine variant. Current H145 dimensions and performance are reference values, not verified equipment for this helicopter.'};
const historicPrices=source('Airbus · 2018 average list prices (historical)','https://www.airbus.com/sites/g/files/jlcbta136/files/2021-07/new-airbus-list-prices-2018.pdf');
for(const [code,price] of Object.entries({A319:92.3,A320:101,A321:118.3,A20N:110.6,A21N:129.5,A332:238.5,A333:264.2,A339:296.4,A359:317.4,A35K:366.5})) {
  profiles[code].price=`US$${price} million · Airbus 2018 list price`;
  profiles[code].sources=[...profiles[code].sources,historicPrices];
}
profiles.BCS3.fuelCapacity='5,681 US gal · maximum';
profiles.BCS3.fuelEfficiency='Airbus: 25% lower fuel burn per seat vs previous-generation aircraft';
profiles.A20N.fuelEfficiency='Airbus: up to 20% lower fuel burn per seat vs previous generation';
profiles.A21N.fuelEfficiency=profiles.A20N.fuelEfficiency;
profiles.A20N.sources.push(source('Airbus · A320neo family','https://www.airbus.com/en/products-services/commercial-aircraft/passenger-aircraft/a320-family'));

// Additional regional, business and rotorcraft coverage, reviewed 14 Oct 2026.
add('E195',null,'Embraer E195',38.65,28.72,null,null,{manufacturer:'Embraer',engines:'GE CF34-10E',sources:[source('ANAC · E-Jet dimensions',ejets),source('Embraer · E195','https://embraer.com/e-jets/e195/en/')]});
for(const [code,name,length,span,url] of [
  ['E290','Embraer E190-E2',36.24,33.72,'e190e2'],
  ['E295','Embraer E195-E2',41.5,35.12,'e195e2'],
]) add(code,null,name,length,span,null,code==='E295'?'Up to 3,000 NM · full passengers, LRC, typical reserves':null,{manufacturer:'Embraer',engines:'Pratt & Whitney PW1900G',cruise:'Mach 0.82 · maximum',sources:[source('Embraer · E2 specifications',`https://www.embraer.com/e-jets-e2/${url}/en/`),source('Embraer · E195-E2 specification sheet','https://www.embraer.com/media/ue1bdfnq/e195-e2-spec-1.pdf'),source('Pratt & Whitney · PW1900G','https://filecache.mediaroom.com/mr5mr_prattwhitney/183119/download/PW_GTF_PC_PW1900G.pdf')]});
profiles.E295.fuelCapacity='13,690 kg · maximum usable';
add('C25M',null,'Cessna Citation M2 family',13,14.39,'7 · M2 Gen3 maximum passengers','Up to 1,550 NM · M2 Gen3 reference',{manufacturer:'Textron Aviation / Cessna',engines:'Williams FJ44 family · FJ44-1AP-21 on M2 Gen3',enginePosition:'rear',cruise:'404 KTAS · M2 Gen3 maximum cruise',fuelCapacity:'492 US gal · M2 Gen3 usable',fallback:'C25M identifies the M2 family. M2 Gen3 reference shown; generation and fitted equipment are not identified.',sources:manufacturerSource('Cessna · Citation M2 Gen3','https://cessna.txtav.com/en/citation/m2-gen3')});
add('E550',null,'Embraer Legacy 500 / Praetor 600 family',20.74,21.5,'12 · Praetor 600 maximum passengers','Up to 4,018 NM · Praetor 600, 4 passengers, NBAA IFR reserves',{manufacturer:'Embraer',engines:'Honeywell HTF7500E',enginePosition:'rear',cruise:'466 KTAS · Praetor 600 high-speed cruise',fallback:'E550 covers Legacy 500 and Praetor 600 variants. Praetor 600 dimensions and performance are reference values; variant is not established.',sources:manufacturerSource('Embraer · Praetor 600 brochure','https://www.embraer.com/media/gjunfh2i/praetor-600-eletronic.pdf')});
for(const [code,name,length,reference] of [
  ['GL5T','Bombardier Global 5000 / 5500 family',29.51,'5500'],
  ['GLEX','Bombardier Global Express / 6000 / 6500 family',30.3,'6500'],
]) add(code,null,name,length,28.65,null,null,{manufacturer:'Bombardier',engines:'Rolls-Royce BR710 or Pearl 15 · variant dependent',enginePosition:'rear',fallback:`Type code spans several generations. Global ${reference} dimensions shown; engine version and performance variant are unconfirmed.`,sources:manufacturerSource('MHI · Global 5500 / 6500 specifications','https://www.mhi.com/group/mhica/product-service')});
add('H135',null,'Airbus H135',12.26,10.4,'Up to 6 passengers + 1 or 2 pilots','Up to 342 NM · standard fuel tanks',{manufacturer:'Airbus Helicopters',engines:'Safran Arrius 2B2 Plus or Pratt & Whitney PW206B3',engineKind:'turboshaft',enginePosition:'rotor',airframeKind:'helicopter',note:'Length is the published rotor-turning D-value.',sources:manufacturerSource('Airbus · H135 technical information','https://www.airbus.com/en/products-services/helicopters/civil-helicopters/h135/h135-technical-information')});
profiles.EC35={...profiles.H135,name:'Eurocopter EC135 / Airbus H135 family',fallback:'EC35 includes earlier generations. Current H135 reference dimensions and capability shown; fitted engine version is unconfirmed.'};
add('H160',null,'Airbus H160',15.67,13.4,'Up to 12 passengers + 1 or 2 pilots','Up to 480 NM · standard fuel tanks',{manufacturer:'Airbus Helicopters',engines:'Safran Arrano 1A',engineKind:'turboshaft',enginePosition:'rotor',airframeKind:'helicopter',cruise:'138 kt · recommended cruise',note:'Length is the published rotor-turning D-value.',sources:manufacturerSource('Airbus · H160 technical information','https://www.airbus.com/en/products-services/helicopters/civil-helicopters/h160/h160-technical-information')});

profiles.H160.sources.push(source('Safran · Arrano 1A','https://www.safran-group.com/products-services/arrano-1a-new-generation-helicopter-engine'));

// Deliberate aliases only: no prefix matching that could turn an unknown variant into a false exact match.
const aliases = { A320NEO: 'A20N', A321NEO: 'A21N', '737-800': 'B738', '787-9': 'B789', 'A220-300': 'BCS3' };
export const aircraftByLength = Object.freeze(Object.entries(profiles)
  .map(([code, profile]) => ({ code, ...profile }))
  .sort((a, b) => a.length - b.length || a.name.localeCompare(b.name)));
export const supportedAircraftTypes = Object.freeze(Object.keys(profiles));
export function resolveAircraftProfile(type) {
  const code = typeof type === 'string' ? type.trim().toUpperCase() : '';
  const key = aliases[code] || code;
  return Object.hasOwn(profiles, key) ? profiles[key] : null;
}

export function aircraftModelFacts(type) {
  const p=resolveAircraftProfile(type);
  if(!p)return [];
  const facts=[];
  const addFact=(label,text)=>{if(text)facts.push({label,text});};
  addFact('Engine options',`${p.engineCount} × ${p.engines}`);
  addFact('Published model range',p.range);
  addFact('Published cruise',p.cruise);
  addFact('Historical list price',p.price);
  addFact('Published fuel reference',p.fuelBurn);
  addFact('Manufacturer fuel comparison',p.fuelEfficiency);
  addFact('Fuel capacity',p.fuelCapacity);
  addFact('Size',`${p.length} m long · ${p.span} m ${p.airframeKind==='helicopter'?'rotor diameter':'wingspan'}`);
  addFact('Seating / occupancy',p.capacity);
  addFact('About this model',p.fact);
  return facts;
}
