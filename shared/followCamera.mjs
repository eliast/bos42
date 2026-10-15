import {angleDifference} from './aviation.mjs';

// Time-based damping gives the same chase at 30 or 60 fps. Clamp long gaps so
// resuming after a suspended tab cannot jump directly to a new camera target.
export function smoothFollowCamera(current,target,elapsedMs){
  const dt=Math.min(100,Math.max(0,elapsedMs));
  const weight=tau=>1-Math.exp(-dt/tau);
  const mix=(a,b,tau)=>a+(b-a)*weight(tau);
  return{
    lon:current.lon+angleDifference(target.lon,current.lon)*weight(300),
    lat:mix(current.lat,target.lat,300),
    bearing:current.bearing+angleDifference(target.bearing,current.bearing)*weight(1100),
    zoom:mix(current.zoom,target.zoom,500),
    pitch:mix(current.pitch,target.pitch,500),
    elevation:mix(current.elevation,target.elevation,500),
  };
}
