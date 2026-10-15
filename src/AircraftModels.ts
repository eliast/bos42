import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Each aircraft shares four geometry batches with its family. Windows, fans,
// pylons and winglets add detail without a draw call for every small part.
type Family = 'jet' | 'widebody' | 'jumbo' | 'regional' | 'propeller' | 'helicopter';
type Parts = { paint: THREE.BufferGeometry[]; pearl: THREE.BufferGeometry[]; glass: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] };
type ModelGeometry = Record<keyof Parts, THREE.BufferGeometry>;
const models = new Map<string, ModelGeometry>();
const rotorGeometry = new Map<'main'|'tail',THREE.BufferGeometry>();
export interface AircraftRotor {object:THREE.Object3D;axis:'x'|'z';radiansPerSecond:number}
export function animateAircraftRotors(rotors:AircraftRotor[],seconds:number) {
  for (const rotor of rotors) rotor.object.rotation[rotor.axis] = seconds * rotor.radiansPerSecond % (Math.PI * 2);
}
const pearl = new THREE.MeshStandardMaterial({color:'#e2e8e6', roughness:.42, metalness:.22});
const glass = new THREE.MeshStandardMaterial({color:'#081b2b', roughness:.19, metalness:.65, side:THREE.DoubleSide});
const metal = new THREE.MeshStandardMaterial({color:'#768896', roughness:.36, metalness:.75, side:THREE.DoubleSide});
const vertical = new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1), new THREE.Vector3(1,0,0));

function solid(points: number[][], thickness=.018) {
  const shape = new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  return new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1}).translate(0,0,-thickness/2);
}
function fin(points: number[][], x=0, thickness=.014) { return solid(points,thickness).applyMatrix4(vertical).translate(x,0,0); }
function lathe(profile: number[][], segments=32) { return new THREE.LatheGeometry(profile.map(([radius,y])=>new THREE.Vector2(radius,y)),segments); }
function box(x:number,y:number,z:number,at:[number,number,number]) { return new THREE.BoxGeometry(x,y,z).translate(...at); }
function quad(points: number[][]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([points[0],points[1],points[2],points[0],points[2],points[3]].flat(),3));
  geometry.computeVertexNormals(); return geometry;
}
function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map(g=>g.index ? g.toNonIndexed() : g);
  flat.forEach(g=>g.deleteAttribute('uv'));
  const result = mergeGeometries(flat, false);
  if (!result) throw new Error('Could not build aircraft geometry');
  parts.forEach(g=>g.dispose()); flat.forEach((g,i)=>{if(g!==parts[i])g.dispose();});
  result.computeBoundingSphere(); return result;
}

export function aircraftFamily(type=''): Family {
  if (/^(EC|H1|H2|AS3|AS5|A109|A119|A139|A169|AW139|AW169|AW189|H60|B06|B407|B429|B412|R22|R44|R66|S76|S92)/.test(type)) return 'helicopter';
  if (/^(C172|C182|C208|C402|C414|C421|BE20|BE30|PC12|AT4|AT7|DH8|SF34|P28)/.test(type)) return 'propeller';
  if (/^(A38|B74)/.test(type)) return 'jumbo';
  if (/^(A3[345]|B7[678])/.test(type)) return 'widebody';
  if (/^(E1|E7|E2|CRJ|BCS|C25|C56|C68|C700|GLF|CL3|LJ)/.test(type)) return 'regional';
  return 'jet';
}

function engine(parts:Parts, x:number, y:number, z:number, size=1, lowDetail=false) {
  const shell = lathe([[.05,-.13],[.069,-.09],[.078,.065],[.076,.13],[.066,.14],[.060,.12],[.055,.055],[.033,-.12],[.05,-.13]],lowDetail?12:32);
  parts.pearl.push(shell.scale(size,size,size).translate(x,y,z));
  parts.paint.push(box(.025*size,.115*size,.12*size,[x,y-.02,z+.078*size]));
  parts.glass.push(new THREE.CircleGeometry(.063*size,lowDetail?12:28).rotateX(-Math.PI/2).translate(x,y+.116*size,z));
  parts.metal.push(new THREE.ConeGeometry(.013*size,.036*size,12).translate(x,y+.123*size,z));
  for(let i=0;i<(lowDetail?0:12);i++) {
    const blade = solid([[.014,.002],[.05,.012],[.054,.02],[.018,.009]],.001);
    blade.rotateZ(i*Math.PI/6).rotateX(-Math.PI/2).scale(size,size,size).translate(x,y+.119*size,z);
    parts.metal.push(blade);
  }
  parts.glass.push(new THREE.CircleGeometry(.044*size,lowDetail?10:20).rotateX(Math.PI/2).translate(x,y-.133*size,z));
}

function buildAirliner(family:Family, lowDetail=false):ModelGeometry {
  const parts:Parts={paint:[],pearl:[],glass:[],metal:[]};
  const wide=family==='widebody'||family==='jumbo', regional=family==='regional', prop=family==='propeller';
  const length=wide?1.18:regional?.85:prop?.72:1;
  const span=wide?1.22:prop?.86:1;
  const radius=wide?.098:prop?.065:.077;
  parts.paint.push(lathe([[0,-.79],[.014,-.75],[.036,-.65],[radius*.85,-.48],[radius,-.31],[radius,.38],[radius*.91,.49],[radius*.67,.60],[radius*.3,.67],[0,.69]],lowDetail?12:32).scale(1,length,1));
  if(family==='jumbo') parts.paint.push(new THREE.CapsuleGeometry(.084,.49,8,24).scale(1,1,.70).translate(0,.26,.047));

  // Swept, tapered wings with a small upward angle toward the tips.
  for(const side of [-1,1]) {
    const wing=solid([[.045*side,.15],[.26*side,.015],[.81*side,-.27],[.80*side,-.37],[.52*side,-.33],[.10*side,-.19]],.024);
    const position=wing.getAttribute('position');
    for(let i=0;i<position.count;i++) position.setZ(i,position.getZ(i)+Math.abs(position.getX(i))*.05-.015);
    wing.computeVertexNormals(); parts.pearl.push(wing.scale(span,1,1));
    parts.paint.push(fin([[-.27,.027],[-.32,.18],[-.38,.19],[-.385,.027]],.80*span*side,.011));
    parts.pearl.push(solid([[.025*side,-.43],[.29*side,-.63],[.30*side,-.72],[.05*side,-.61]],.013).translate(0,-.10*(length-1),.025));
    parts.metal.push(solid([[.20*side,-.085],[.65*side,-.30],[.66*side,-.303],[.20*side,-.09]],.002).scale(span,1,1).translate(0,0,.028));

    for(let i=0;i<(lowDetail?0:prop?8:wide?31:22);i++) {
      const y=(-.37+i*(prop?.081:wide?.031:.039))*length;
      const window=new THREE.CircleGeometry(prop?.011:.009,10).scale(1,1.22,1).rotateY(side*Math.PI/2).translate(side*(radius+.0007),y,.013);
      parts.glass.push(window);
    }
    parts.pearl.push(box(.001,.71*length,.006,[side*(radius+.001),.015,-.015]));
    engine(parts,.285*span*side,.035,-.13,wide?1.22:prop?.70:1,lowDetail);
    if(family==='jumbo') engine(parts,.53*span*side,-.135,-.095,.92,lowDetail);
    if(prop) {
      parts.metal.push(new THREE.CylinderGeometry(.014,.014,.045,10).translate(.285*span*side,.158,-.13));
      for(let blade=0;blade<4;blade++) parts.glass.push(solid([[-.012,.006],[.014,.006],[.022,.19],[-.008,.20]],.004).rotateZ(blade*Math.PI/2+.35).rotateX(-Math.PI/2).translate(.285*span*side,.18,-.13));
    }
  }
  parts.paint.push(fin([[-.36,.03],[-.62,.38],[-.76,.38],[-.72,.028]]).translate(0,-.11*(length-1),0));
  // Three curved windscreen panes follow the rounded nose surface.
  for(const [a,b] of [[-1.15,-.42],[-.35,.35],[.42,1.15]]) {
    parts.glass.push(quad([[radius*.91*Math.sin(a),.48*length,radius*.91*Math.cos(a)+.002],[radius*.91*Math.sin(b),.48*length,radius*.91*Math.cos(b)+.002],[radius*.65*Math.sin(b),.61*length,radius*.65*Math.cos(b)+.002],[radius*.65*Math.sin(a),.61*length,radius*.65*Math.cos(a)+.002]]));
  }
  // A small white cap provides a visible leading edge on very dark liveries.
  parts.pearl.push(new THREE.SphereGeometry(.018,12,8).scale(1,1.45,.8).translate(0,.668*length,0));
  return {paint:merge(parts.paint),pearl:merge(parts.pearl),glass:merge(parts.glass),metal:merge(parts.metal)};
}

function buildHelicopter():ModelGeometry {
  const parts:Parts={paint:[],pearl:[],glass:[],metal:[]};
  parts.paint.push(new THREE.SphereGeometry(1,24,16).scale(.115,.24,.12).translate(0,.08,0));
  parts.paint.push(new THREE.ConeGeometry(.058,.61,20).rotateZ(Math.PI).translate(0,-.36,.025));
  parts.paint.push(fin([[-.55,.02],[-.62,.23],[-.72,.25],[-.69,.02]]));
  parts.glass.push(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2).rotateX(-Math.PI/2).scale(.112,.22,.10).translate(0,.10,.015));
  parts.metal.push(new THREE.CylinderGeometry(.014,.018,.17,12).rotateX(Math.PI/2).translate(0,.015,.17));
  parts.pearl.push(new THREE.SphereGeometry(.028,10,6).translate(0,0,.25));
  for(const side of [-1,1]) {
    parts.metal.push(box(.014,.40,.015,[side*.125,.05,-.14]));
    for(const y of [-.05,.17]) parts.metal.push(box(.012,.012,.065,[side*.09,y,-.105]));
  }
  parts.glass.push(new THREE.CylinderGeometry(.012,.012,.07,12).rotateZ(Math.PI/2).translate(.025,-.64,.085));

  return {paint:merge(parts.paint),pearl:merge(parts.pearl),glass:merge(parts.glass),metal:merge(parts.metal)};
}

export function createAircraftModel(color:string, type:string|null, lowDetail=false) {
  const family=aircraftFamily(type || '');
  const key=`${family}/${lowDetail}`;
  let geometry=models.get(key);
  if(!geometry) {geometry=family==='helicopter'?buildHelicopter():buildAirliner(family,lowDetail);models.set(key,geometry);}
  const material=new THREE.MeshStandardMaterial({color,roughness:.32,metalness:.26,side:THREE.DoubleSide});
  const group=new THREE.Group();
  group.add(new THREE.Mesh(geometry.paint,material),new THREE.Mesh(geometry.pearl,pearl),new THREE.Mesh(geometry.glass,glass),new THREE.Mesh(geometry.metal,metal));
  const rotors:AircraftRotor[]=[];
  if (family === 'helicopter') {
    let main=rotorGeometry.get('main'),tail=rotorGeometry.get('tail');
    if (!main) {
      main=merge(Array.from({length:4},(_,i)=>solid([[-.017,0],[.026,.04],[.043,.66],[-.019,.65]],.005).rotateZ(i*Math.PI/2+.30)));
      rotorGeometry.set('main',main);
    }
    if (!tail) {
      tail=merge(Array.from({length:3},(_,i)=>solid([[-.011,0],[.018,0],[.02,.14],[-.005,.15]],.004).rotateZ(i*Math.PI*2/3).rotateY(Math.PI/2)));
      rotorGeometry.set('tail',tail);
    }
    const mainRotor=new THREE.Mesh(main,pearl),tailRotor=new THREE.Mesh(tail,pearl);
    mainRotor.position.set(0,0,.25);tailRotor.position.set(.059,-.64,.085);
    group.add(mainRotor,tailRotor);
    rotors.push({object:mainRotor,axis:'z',radiansPerSecond:18},{object:tailRotor,axis:'x',radiansPerSecond:31});
  }
  return {group,material,rotors};
}
