import type {Aircraft} from '../src/types';
import type {Journey} from '../src/journeyTypes';
export function normalizeJourney(body:unknown,aircraft:Pick<Aircraft,'callsign'|'registration'|'ground'>,now:number):Journey|null;
export function delayText(minutes:number|null,estimated?:boolean):string|null;
