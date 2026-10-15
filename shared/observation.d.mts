import type {Aircraft} from '../src/types';
import type {Vessel} from '../src/harborTypes';
import type {ApproachTrack,ApproachView} from './approaches.mjs';
export function arrivalQueue(aircraft:Aircraft[],now:number):{aircraft:Aircraft;seconds:number|null}[];
export function aircraftSpotlights(aircraft:Aircraft[],now:number):{aircraft:Aircraft;description:string;priority:number}[];
export type DirectorScene = {kind:'aircraft'|'vessel';id:string;label:string}|{kind:'scenic';view:'Runways'|'Harbor'|'Skyline'|'Apartment';label:string;approach?:ApproachView}|{kind:'traffic';filter:'arrivals'|'harbor';label:string};
export function directorScene(aircraft:Aircraft[],vessels:Vessel[],now:number,step:number,seen?:Map<string,number>,history?:ApproachTrack[]):DirectorScene;
