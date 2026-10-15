import * as THREE from 'three';
import { MercatorCoordinate, type Map as LibreMap, type CustomLayerInterface, type CustomRenderMethodInput } from 'maplibre-gl';
import { angleDifference } from '../shared/aviation.mjs';
import { vesselStaleAfter } from '../shared/marine.mjs';
import { projectedVessel } from './vesselMotion.mjs';
import { LOGAN_CENTER } from './config';
import type { Vessel } from './harborTypes';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function createVessel(v: Vessel) {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({color:v.color,roughness:.65});
  const deck = new THREE.MeshStandardMaterial({color:'#d9e2d8',roughness:.8});
  const glass = new THREE.MeshStandardMaterial({color:'#142f3a',roughness:.3});
  const shape = new THREE.Shape();
  shape.moveTo(0,.5); shape.lineTo(.4,.22); shape.lineTo(.5,-.36); shape.lineTo(.35,-.5); shape.lineTo(-.35,-.5); shape.lineTo(-.5,-.36); shape.lineTo(-.4,.22); shape.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false}),hull); group.add(body);
  const box = (x:number,y:number,z:number,w:number,l:number,h:number,material:THREE.Material) => {const m=new THREE.Mesh(new THREE.BoxGeometry(w,l,h),material);m.position.set(x,y,z);group.add(m);};
  box(0,-.05,.12,.65,.65,.04,deck);
  const large = ['cargo','tanker'].includes(v.kind);
  box(0,large?-.32:-.1,.19,.58,large?.18:.35,.12,deck);
  box(0,large?-.32:-.05,.25,.62,.12,.04,glass);
  if(v.kind==='cargo') for(let row=0;row<3;row++)for(let col=0;col<2;col++)box((col-.5)*.29,row*.13-.04,.2,.25,.11,.12,hull);
  if(v.kind==='tanker') for(let row=0;row<3;row++)box(0,row*.14-.04,.18,.55,.06,.05,hull);
  if(v.kind==='passenger') {box(0,-.06,.3,.55,.4,.08,deck);box(0,.1,.31,.58,.07,.05,glass);}
  if(v.kind==='sail') {box(0,0,.6,.035,.02,1,deck);const sail=new THREE.BufferGeometry();sail.setAttribute('position',new THREE.Float32BufferAttribute([0,.01,1.1,0,.01,.25,0,-.36,.25],3));sail.computeVertexNormals();group.add(new THREE.Mesh(sail,new THREE.MeshStandardMaterial({color:'#edf1e4',side:THREE.DoubleSide,roughness:.9})));}
  // Batch the many hull/deck parts by material: cargo ships otherwise need
  // a separate draw call for every container, even when only a few pixels tall.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of [...group.children]) {
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    mesh.updateMatrix();
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix); geometry.deleteAttribute('uv');
    const parts = batches.get(mesh.material) ?? []; parts.push(geometry); batches.set(mesh.material, parts);
    mesh.geometry.dispose(); group.remove(mesh);
  }
  for (const [material, parts] of batches) {
    const merged = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (merged) group.add(new THREE.Mesh(merged, material));
  }
  return group;
}
function disposeModel(model:THREE.Group) {
  const materials=new Set<THREE.Material>();
  model.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}});
  materials.forEach(m=>m.dispose());
}
type Position={lat:number;lon:number;heading:number|null};
interface Entry {data:Vessel;model:THREE.Group;label:HTMLButtonElement;title:HTMLElement;detail:HTMLElement;correction:THREE.Vector3;blendAt:number;screen:{x:number;y:number;visible:boolean};displayed:Position|null;signature:string}
export class VesselLayer implements CustomLayerInterface {
  id='bos42-vessels';type='custom' as const;renderingMode='3d' as const;
  private map?:LibreMap;private renderer?:THREE.WebGLRenderer;
  private scene=new THREE.Scene();private camera=new THREE.Camera();private entries=new Map<string,Entry>();
  private orderedEntries:Entry[]=[];
  private projection=new THREE.Matrix4();private projected=new THREE.Vector3();private target=new THREE.Vector3();
  private origin=MercatorCoordinate.fromLngLat(LOGAN_CENTER);private meters=this.origin.meterInMercatorCoordinateUnits();
  private transform=new THREE.Matrix4().makeTranslation(this.origin.x,this.origin.y,0).scale(new THREE.Vector3(this.meters,-this.meters,this.meters));
  private labels=document.createElement('div');private selected:string|null=null;private following=false;private clockOffset=0;private disposed=false;
  constructor(container:HTMLElement,private onSelect:(id:string)=>void) {
    this.labels.className='vessel-labels';this.labels.setAttribute('aria-label','Harbor vessels');container.appendChild(this.labels);
    this.scene.add(new THREE.AmbientLight('#ffffff',2));const sun=new THREE.DirectionalLight('#fff4dd',3);sun.position.set(-100,-100,200);this.scene.add(sun);
  }
  onAdd(map:LibreMap,gl:WebGLRenderingContext|WebGL2RenderingContext){this.map=map;this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl as WebGL2RenderingContext});this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;}
  private point(lon:number,lat:number,result=new THREE.Vector3()){const p=MercatorCoordinate.fromLngLat([lon,lat],3);return result.set((p.x-this.origin.x)/this.meters,-(p.y-this.origin.y)/this.meters,p.z/this.meters);}
  update(vessels:Vessel[],offset:number){
    this.clockOffset=offset;const seen=new Set<string>();
    for(const data of vessels){
      seen.add(data.id);let e=this.entries.get(data.id);const signature=`${data.kind}/${data.color}/${data.lengthM}/${data.widthM}`;
      if(!e){
        const label=document.createElement('button');label.type='button';label.className='vessel-label';const title=document.createElement('strong'),detail=document.createElement('small');label.append(title,detail);label.hidden=true;
        label.addEventListener('pointerdown',event=>event.stopPropagation());label.addEventListener('click',event=>{event.stopPropagation();this.onSelect(data.id);});this.labels.appendChild(label);
        const model=createVessel(data),p=projectedVessel(data,Date.now()+offset);model.position.copy(this.point(p.lon,p.lat));model.rotation.z=-(p.heading??0)*Math.PI/180;this.scene.add(model);
        e={data,model,label,title,detail,correction:new THREE.Vector3(),blendAt:0,screen:{x:0,y:0,visible:false},displayed:null,signature};this.entries.set(data.id,e);
      }else{
        if(signature!==e.signature){const model=createVessel(data);model.position.copy(e.model.position);model.rotation.copy(e.model.rotation);this.scene.remove(e.model);disposeModel(e.model);e.model=model;this.scene.add(model);e.signature=signature;}
        if(data.observedAt>e.data.observedAt){const p=projectedVessel(data,Date.now()+offset);e.correction.copy(e.model.position).sub(this.point(p.lon,p.lat));e.blendAt=performance.now();}
      }
      e.data=data;e.title.textContent=data.name||`MMSI ${data.mmsi}`;e.label.style.setProperty('--vessel-color',data.color);e.label.setAttribute('aria-label',`Follow ${data.name||data.mmsi}, ${data.label}`);
    }
    for(const [id,e]of this.entries)if(!seen.has(id))this.remove(id,e);this.sortEntries();this.map?.triggerRepaint();
  }
  private sortEntries(){this.orderedEntries=[...this.entries.values()].sort((a,b)=>a.data.id===this.selected?-1:b.data.id===this.selected?1:(b.data.speedKts??0)-(a.data.speedKts??0));}
  setSelection(id:string|null){this.selected=id;this.sortEntries();this.map?.triggerRepaint();}
  setFollowing(value:boolean){this.following=value;}
  getDisplayedPosition(id:string){return this.entries.get(id)?.displayed??null;}
  pick(x:number,y:number){return [...this.entries.values()].filter(e=>e.screen.visible).map(e=>({id:e.data.id,d:Math.hypot(x-e.screen.x,y-e.screen.y)})).filter(e=>e.d<26).sort((a,b)=>a.d-b.d)[0]?.id??null;}
  private remove(id:string,e:Entry){e.label.remove();this.scene.remove(e.model);disposeModel(e.model);this.entries.delete(id);}
  render(_gl:WebGLRenderingContext|WebGL2RenderingContext,args:CustomRenderMethodInput){
    if(!this.map||!this.renderer||this.disposed)return;
    this.camera.projectionMatrix.copy(this.projection.fromArray(args.defaultProjectionData.mainMatrix).multiply(this.transform));
    const now=Date.now()+this.clockOffset,perf=performance.now(),{width,height}=this.map.getCanvas().getBoundingClientRect();
    const occupied:{x:number;y:number}[]=[];
    for(const e of this.orderedEntries){
      const v=e.data,p=projectedVessel(v,now),t=Math.min(1,Math.max(0,(perf-e.blendAt)/1800));
      e.model.position.copy(this.point(p.lon,p.lat,this.target)).addScaledVector(e.correction,1-t*t*(3-2*t));
      if(p.heading!==null)e.model.rotation.z+=angleDifference(-p.heading,e.model.rotation.z*180/Math.PI)*Math.PI/180*.12;
      const geo=new MercatorCoordinate(this.origin.x+e.model.position.x*this.meters,this.origin.y-e.model.position.y*this.meters).toLngLat();e.displayed={lat:geo.lat,lon:geo.lng,heading:p.heading===null?null:((-e.model.rotation.z*180/Math.PI)%360+360)%360};
      // Fixed world scale keeps tilt from resizing boats. AIS dimensions inform
      // the silhouette; these are illustrative vessel types, not exact models.
      const length=Math.max(18,Math.min(300,v.lengthM??(['cargo','tanker'].includes(v.kind)?100:25))),beam=v.widthM??length*.24;
      e.model.scale.set(Math.max(8,beam)*2.4,length*2.4,Math.min(50,length)*1.5);
      const point=this.projected.copy(e.model.position).project(this.camera),x=(point.x+1)*width/2,y=(1-point.y)*height/2;
      const visible=point.z>-1&&point.z<1&&x>0&&x<width&&y>80&&y<height-10;e.screen={x,y,visible};
      const selected=v.id===this.selected,stale=now-v.observedAt>vesselStaleAfter(v);
      const clear=occupied.every(o=>Math.abs(o.x-x)>155||Math.abs(o.y-y)>65);
      const show=visible&&!(selected&&this.following)&&(selected||(occupied.length<10&&clear&&(this.map.getZoom()>13||!!v.speedKts&&v.speedKts>1)));
      e.label.hidden=!show;e.label.classList.toggle('selected',selected);e.label.classList.toggle('stale',stale);e.label.setAttribute('aria-pressed',String(selected));
      if(show){e.label.style.transform=`translate(${x.toFixed(1)}px,${(y-16).toFixed(1)}px) translate(-50%,-100%)`;const detail=stale?'LAST POSITION':`${v.label}${v.speedKts===null?'':` · ${v.speedKts.toFixed(1)} KT`}`;if(e.detail.textContent!==detail)e.detail.textContent=detail;occupied.push({x,y});}
    }
    this.renderer.resetState();this.renderer.render(this.scene,this.camera);this.renderer.resetState();
    // AircraftLayer already schedules the shared map at 30 fps.
  }
  onRemove(){this.dispose();}
  dispose(){if(this.disposed)return;this.disposed=true;this.labels.remove();for(const[id,e]of this.entries)this.remove(id,e);this.renderer?.dispose();}
}
