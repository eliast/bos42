import * as THREE from 'three';
import {APPROACH_WINDOW_MS, type ApproachPoint, type ApproachTrack} from '../shared/approaches.mjs';
import {distanceNm} from '../shared/aviation.mjs';

export const MAX_GHOST_TRACKS=6;
type ProjectPoint=(point:ApproachPoint)=>THREE.Vector3;
const valid=(p:ApproachPoint)=>[p.lat,p.lon,p.altitudeFt,p.at].every(Number.isFinite)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};

export function buildApproachGeometry(tracks:ApproachTrack[],now:number,project:ProjectPoint){
  const positions:number[]=[],previous:number[]=[],next:number[]=[],sides:number[]=[],colors:number[]=[],indices:number[]=[];
  // The newest six flights retain their measured altitude. Never bridge a feed
  // gap or extend the curve beyond the first/last observed position.
  const recent=tracks.filter(t=>t.points.some(p=>valid(p)&&p.at<=now&&p.at>now-APPROACH_WINDOW_MS))
    .slice().sort((a,b)=>(b.points.at(-1)?.at||0)-(a.points.at(-1)?.at||0)).slice(0,MAX_GHOST_TRACKS);
  for(const [rank,track] of recent.entries()){
    const chunks:ApproachPoint[][]=[];
    let chunk:ApproachPoint[]=[];
    const flush=()=>{if(chunk.length>1)chunks.push(chunk);chunk=[];};
    for(const point of track.points){
      if(!valid(point)||point.at>now||point.at<=now-APPROACH_WINDOW_MS){flush();continue;}
      const last=chunk.at(-1);
      if(last&&(point.breakBefore||point.at<=last.at||point.at-last.at>25000||distanceNm(last,point)>Math.max(.25,(point.at-last.at)/3600000*550)))flush();
      // Repeated positions make zero-length tangents. Preserve the most recent
      // timestamp, without manufacturing a line where the plane hasn't moved.
      const previous=chunk.at(-1);
      if(previous&&distanceNm(previous,point)<.001){chunk[chunk.length-1]=point;continue;}
      chunk.push(point);
    }
    flush();
    const color=new THREE.Color(/^#[0-9a-f]{6}$/i.test(track.color)?track.color:'#b7cbd2').lerp(new THREE.Color('#d5e3e5'),.42);
    for(const points of chunks){
      const observed=points.map(project);
      const distance=observed.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(observed[i]),0);
      if(distance<300)continue;
      const curve=new THREE.CatmullRomCurve3(observed,false,'centripetal');
      const steps=Math.min(600,Math.max(8,points.length*4));
      const samples:THREE.Vector3[]=[],opacities:number[]=[];
      for(let i=0;i<=steps;i++){
        const t=i/steps,p=curve.getPoint(t);
        const atIndex=t*(points.length-1),index=Math.min(points.length-2,Math.floor(atIndex));
        const at=THREE.MathUtils.lerp(points[index].at,points[index+1].at,atIndex-index);
        const age=Math.max(0,1-(now-at)/APPROACH_WINDOW_MS);
        samples.push(p);
        opacities.push(.48*Math.pow(.68,rank)*Math.pow(age,1.6)*smooth(t/.08)*smooth((1-t)/.08));
      }
      const base=positions.length/3;
      for(let i=0;i<samples.length;i++){
        const p=samples[i],before=samples[Math.max(0,i-1)],after=samples[Math.min(samples.length-1,i+1)];
        for(const side of [-1,1]){
          positions.push(p.x,p.y,p.z);previous.push(before.x,before.y,before.z);next.push(after.x,after.y,after.z);
          sides.push(side);colors.push(color.r,color.g,color.b,opacities[i]);
        }
        if(i<samples.length-1){const v=base+i*2;indices.push(v,v+1,v+2,v+2,v+1,v+3);}
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('previous',new THREE.Float32BufferAttribute(previous,3));
  geometry.setAttribute('next',new THREE.Float32BufferAttribute(next,3));
  geometry.setAttribute('side',new THREE.Float32BufferAttribute(sides,1));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geometry.setIndex(indices);
  return geometry;
}

export class ApproachTrails extends THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>{
  private viewport=new THREE.Vector2(1,1);
  constructor(){
    const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,side:THREE.DoubleSide});
    super(new THREE.BufferGeometry(),material);
    material.onBeforeCompile=shader=>{
      shader.uniforms.ghostViewport={value:this.viewport};
      shader.vertexShader=shader.vertexShader.replace('void main() {',`
        uniform vec2 ghostViewport;
        attribute vec3 previous;
        attribute vec3 next;
        attribute float side;
        varying float vGhostSide;
        vec2 safeDirection(vec2 v){return v/max(length(v),0.00001);}
        void main() {
          vGhostSide=side;`)
        .replace('#include <project_vertex>',`
          #include <project_vertex>
          vec4 before=projectionMatrix*modelViewMatrix*vec4(previous,1.0);
          vec4 after=projectionMatrix*modelViewMatrix*vec4(next,1.0);
          vec2 center=gl_Position.xy/max(gl_Position.w,0.00001)*ghostViewport;
          vec2 incoming=safeDirection(center-before.xy/max(before.w,0.00001)*ghostViewport);
          vec2 outgoing=safeDirection(after.xy/max(after.w,0.00001)*ghostViewport-center);
          if(length(incoming)<0.1)incoming=outgoing;
          if(length(outgoing)<0.1)outgoing=incoming;
          vec2 tangent=safeDirection(incoming+outgoing);
          if(length(tangent)<0.1)tangent=outgoing;
          vec2 normal=vec2(-tangent.y,tangent.x);
          float join=max(0.5,abs(dot(normal,vec2(-outgoing.y,outgoing.x))));
          gl_Position.xy+=normal*side*2.6/join/ghostViewport*gl_Position.w;
        `);
      shader.fragmentShader=shader.fragmentShader
        .replace('void main() {','varying float vGhostSide;\nvoid main() {')
        .replace('#include <color_fragment>',`
          #include <color_fragment>
          diffuseColor.a*=1.0-smoothstep(0.12,1.0,abs(vGhostSide));
        `);
    };
    material.customProgramCacheKey=()=> 'bos42-ghost-trails-v3';
    this.frustumCulled=false;this.visible=false;
  }
  setTracks(tracks:ApproachTrack[],now:number,project:ProjectPoint){
    const geometry=buildApproachGeometry(tracks,now,project);
    this.geometry.dispose();this.geometry=geometry;this.visible=!!geometry.index?.count;
  }
  setViewport(width:number,height:number){this.viewport.set(Math.max(1,width),Math.max(1,height));}
  dispose(){this.geometry.dispose();this.material.dispose();}
}
