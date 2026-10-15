export type RadioStatus='stopped'|'connecting'|'playing'|'retrying'|'blocked';
export type RadioPlayback={start(url:string):void;recover():void;stop():void;dispose():void};
export function createRadioPlayback(player:HTMLAudioElement,options?:{onStatus?:(status:RadioStatus,delay:number)=>void;now?:()=>number;schedule?:typeof setTimeout;cancel?:typeof clearTimeout}):RadioPlayback;
