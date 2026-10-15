import test from 'node:test';
import assert from 'node:assert/strict';
import {createAircraftModel,animateAircraftRotors,aircraftFamily} from '../src/AircraftModels.ts';

test('helicopters have independent main and tail rotors on their real axes',()=>{
  const model=createAircraftModel('#ffaa00','H145',true);
  assert.equal(model.rotors.length,2);
  const [main,tail]=model.rotors;
  assert.equal(main.axis,'z');assert.equal(tail.axis,'x');
  assert.equal(main.object.position.z,.25);assert.equal(tail.object.position.y,-.64);
  model.group.rotation.z=.7;
  animateAircraftRotors(model.rotors,1);
  const first=main.object.rotation.z;
  animateAircraftRotors(model.rotors,1.1);
  assert.notEqual(main.object.rotation.z,first);
  assert.notEqual(tail.object.rotation.x,0);
  assert.equal(model.group.rotation.z,.7);
  model.material.dispose();
});
test('rotor geometry is shared while rotations remain independent per helicopter',()=>{
  const a=createAircraftModel('#ffaa00','R44',true),b=createAircraftModel('#ff0000','B407',true);
  assert.equal(a.rotors[0].object.geometry,b.rotors[0].object.geometry);
  animateAircraftRotors(a.rotors,2);
  assert.equal(b.rotors[0].object.rotation.z,0);
  a.material.dispose();b.material.dispose();
});
test('fixed-wing planes have no helicopter animation and common helicopter types resolve',()=>{
  const model=createAircraftModel('#fff','A320',true);
  assert.equal(model.rotors.length,0);
  for (const type of ['AW139','H60','H145','B407','R44']) assert.equal(aircraftFamily(type),'helicopter');
  model.material.dispose();
});
