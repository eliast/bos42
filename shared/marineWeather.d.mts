export function marineForecast(payload:unknown):{updatedAt:number;period:string;text:string}|null;
export function harborWaterLevel(payload:unknown):{at:number;feet:number}|null;
export function marineAdvisories(payload:unknown,now:number):{event:string;expires:number;severity:string}[]|null;
export interface TidePrediction {at:number;feet:number;type:'H'|'L'}
export function tidePredictions(payload:unknown):TidePrediction[]|null;
export function tidePhase(predictions:TidePrediction[]|null,now:number):{previous:TidePrediction;next:TidePrediction;afterNext:TidePrediction|null;progress:number;rising:boolean;minutesToNext:number}|null;
