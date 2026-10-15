import type {Aircraft,WindowView} from '../src/types';
export interface Spotting {aircraft:Aircraft;label:string;reason:string;priority:number;range:number}
export function spottingReason(a:Aircraft):Omit<Spotting,'aircraft'|'range'>|null;
export function sightline(a:Aircraft,home:WindowView,bearing:number):{range:number;bearing:number;delta:number;elevation:number};
export function pickSpotting(a:Aircraft[],options:{home:WindowView;now:number;selectedId:string|null;seen?:Map<string,number>}):Spotting|null;
export function relativeDirection(delta:number):string;
