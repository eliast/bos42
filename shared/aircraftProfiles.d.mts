export interface AircraftProfile {
  name: string;
  manufacturer: string;
  length: number;
  span: number;
  engineCount: number;
  enginePosition: 'wing' | 'rear' | 'rotor';
  engineKind?:'turbofan'|'turboshaft';
  airframeKind?:'helicopter';
  price?:string;
  fuelBurn?:string;
  fuelEfficiency?:string;
  fuelCapacity?:string;
  engines: string;
  capacity: string | null;
  range: string | null;
  cruise?: string;
  firstFlight?: string;
  fact?: string;
  note?: string;
  fallback?: string;
  sources: { label: string; url: string }[];
}
export const supportedAircraftTypes: readonly string[];
export function resolveAircraftProfile(type: string | null | undefined): AircraftProfile | null;

export const aircraftByLength: readonly (AircraftProfile & { code: string })[];
export const aircraftCatalogReviewed:string;
export function aircraftModelFacts(type:string|null|undefined):{label:string;text:string}[];
