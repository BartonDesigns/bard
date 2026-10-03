import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKineticModel, RIG_KINDS, RIG_LIMITS } from '../src/music/kinetic-model.js';
import { createKineticView } from '../src/music/kinetic-view.js';
import { createKinetic } from '../src/music/kinetic.js';
import { kineticFootprint } from '../src/music/kinetic-placement.js';

const roles = {
	garden: ['garden-balls', 'garden-dais'], pendulum: ['pendulum-bobs', 'pendulum-strings', 'frame-beam'],
	dominoes: ['domino-tiles'], chimes: ['chime-tubes', 'chime-stem', 'chime-arm'],
	cradle: ['cradle-bobs', 'cradle-strings', 'frame-beam'], droplets: ['water-drops', 'droplet-pool', 'droplet-halo', 'pool-ripple'],
	harp: ['harp-core', 'harp-orbs'], stairs: ['spiral-steps', 'stair-ball'], fountain: ['fountain-nozzle', 'fountain-pads', 'fountain-shots'], wavebars: ['wave-bars'],
};
function resources(group) {
	const set = new Set(); group.traverse(o => { if(o.geometry)set.add(o.geometry); if(o.material)set.add(o.material); if(o.isInstancedMesh)set.add(o); }); return set;
}
test('all ten rigs retain distinct authored structures with bounded draw calls', () => {
	for (const kind of RIG_KINDS) {
		const model = createKineticModel({kind}), view = createKineticView(model); model.replay(); view.refresh();
		assert.equal(view.group.name, `kinetic-${kind}`);
		for(const role of roles[kind])assert.ok(view.group.getObjectByName(role), `${kind}: ${role}`);
		let draws=0;view.group.traverse(o=>{if(o.isMesh)draws++;});assert.ok(draws<=9,`${kind}: ${draws} draws`);
		for(const r of resources(view.group))r.dispose();
	}
});
test('animated maximum-count geometry stays finite, above ground and inside placement footprints', () => {
	for (const kind of RIG_KINDS) {
		const count=RIG_LIMITS[kind].maxCount, model=createKineticModel({kind,count}), view=createKineticView(model);
		const [width,depth]=kineticFootprint(kind,count), box=new THREE.Box3(), part=new THREE.Box3();model.replay();
		for(let tick=0;tick<400;tick++) {
			model.update(.1); if(tick%10)continue;view.refresh();view.group.updateMatrixWorld(true);box.makeEmpty();
			view.group.traverse(o=>{
				if(!o.isMesh || !o.visible)return;
				if(o.isInstancedMesh){assert.ok(o.instanceMatrix.array.every(Number.isFinite),kind);o.computeBoundingBox();part.copy(o.boundingBox);}
				else {o.geometry.computeBoundingBox();part.copy(o.geometry.boundingBox);}
				part.applyMatrix4(o.matrixWorld);box.union(part);
			});
			assert.ok(box.min.x>=-width/2-.001 && box.max.x<=width/2+.001,`${kind}: x ${box.min.x}..${box.max.x} in ${width}`);
			assert.ok(box.min.z>=-depth/2-.001 && box.max.z<=depth/2+.001,`${kind}: z ${box.min.z}..${box.max.z} in ${depth}`);
			assert.ok(box.min.y>=-.001,`${kind}: ground penetration ${box.min.y}`);
		}
		for(const r of resources(view.group))r.dispose();
	}
});
test('replacement disposes every rig resource once and musical gestures preserve manual voices', () => {
	const calls=[], stops=[], scene=new THREE.Scene(), host={playLead:(...a)=>calls.push(a),stopLead:id=>stops.push(id)};
	const rig=createKinetic({scene,host});
	for(const kind of RIG_KINDS){
		const before=calls.length;assert.equal(rig.spawn({kind,x:7,y:2,z:-8,yaw:.3}),true);assert.equal(calls.length,before);
		assert.equal(rig.state().count,RIG_LIMITS[kind].defaultCount);
		const owned=resources(scene.children[0]), disposed=new Map();for(const r of owned)r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1));
		for(let i=0;i<80;i++)rig.update(.1,{listener:new THREE.Vector3(7,2,-8)});
		assert.ok(calls.length>before,kind);assert.ok(rig.state().voices<=8);
		rig.silence();assert.equal(rig.state().voices,0);rig.clear();rig.clear();assert.equal(scene.children.length,0);
		for(const r of owned)assert.equal(disposed.get(r),1,`${kind} resource cleanup`);
	}
	assert.ok(stops.every(id=>id.startsWith('auto:crysis-rig:')));rig.dispose();
});
