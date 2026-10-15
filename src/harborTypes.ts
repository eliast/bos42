export interface Vessel {
  id: string; mmsi: string; name: string | null; callsign: string | null; imo: number | null;
  shipType: number | null; kind: string; label: string; color: string;
  lat: number; lon: number; speedKts: number | null; course: number | null; heading: number | null;
  navigationStatus: number | null; navigationLabel: string | null;
  lengthM: number | null; widthM: number | null; draftM: number | null;
  destination: string | null; eta: {month: number; day: number; hour: number; minute: number} | null;
  observedAt: number; detailsReportedAt: number | null; ageSeconds: number; stale: boolean;
}
export type HarborStatus = 'connecting' | 'live' | 'stale' | 'unavailable' | 'unconfigured';
export interface HarborFeed {
  status: HarborStatus; vessels: Vessel[]; serverTime: number; lastMessageAt: number | null; error: string | null;
}
