export interface JourneyAirport {code:string|null;icao:string|null;city:string|null;timezone:string}
export interface Journey {
  flightId:string|null;callsign:string;origin:JourneyAirport|null;destination:JourneyAirport|null;
  times:Record<string,number|null>;departureDelayMinutes:number|null;departureReference:string|null;
  arrivalDelayMinutes:number|null;arrivalReference:string|null;arrivalIsEstimate:boolean;
  frequency:{days:{date:string;operated:boolean}[];count:number;partial:boolean;timezone:string;basis:string};
}
export interface JourneyResult {status:string;journey:Journey|null;source:string;retrievedAt:number|null}
