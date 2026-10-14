import * as THREE from 'three';
import { worldPosition } from '../people/social-actors.js';

export function routeMarkSpot(W, stop) {
	for(const radius of [3,6,10])for(let i=0;i<12;i++) {
		const a=i*Math.PI/6,x=stop.x+Math.cos(a)*radius,z=stop.z+Math.sin(a)*radius;
		const heights=[[0,0],[.6,0],[-.6,0],[0,.6],[0,-.6]].map(([dx,dz])=>W.player.floorAt?.(x+dx,z+dz,stop.y) ?? W.island?.heightAt(x+dx,z+dz));
		if(heights.every(Number.isFinite)&&Math.min(...heights)>.3&&Math.max(...heights)-Math.min(...heights)<.6&&Math.abs(heights[0]-stop.y)<5)return{x,y:heights[0],z};
	}
	return null;
}

// Small, persistent consequences at surveyed places. No new scene, lights or colliders.
export function createRouteMarks({ scene, world, camera, chronicle }) {
	const group = new THREE.Group(); group.name = 'Routes we marked'; scene.add(group);
	const stone = new THREE.MeshStandardMaterial({color:0x665c4d,roughness:.95});
	const brass = new THREE.MeshStandardMaterial({color:0xcbb785,roughness:.65,metalness:.25});
	const glass = new THREE.MeshStandardMaterial({color:0x85d0be,emissive:0x238a74,emissiveIntensity:.7,roughness:.4});
	const footGeo=new THREE.CylinderGeometry(.19,.28,.25,7),postGeo=new THREE.BoxGeometry(.12,1.2,.12),signGeo=new THREE.BoxGeometry(.7,.18,.08),gemGeo=new THREE.OctahedronGeometry(.11);
	const marks=new Map();
	function update() {
		const W=world(); if(!W) {group.visible=false;return;} group.visible=true;
		const candidates=[],seen=new Set();
		for(const project of chronicle.projects(W.body?.key)) if(project.choice==='marked') for(const stop of project.landmarks) {
			if(stop.markerEligible===false)continue;
			const p=worldPosition(W,stop.pos),id=project.body+':'+stop.id;
			if(!p || seen.has(id))continue; seen.add(id);
			const d=Math.hypot(p.x-camera.position.x,p.z-camera.position.z); if(d<180 && Math.abs(p.y-camera.position.y)<50)candidates.push({id,p,d});
		}
		candidates.sort((a,b)=>a.d-b.d); const keep=new Set(candidates.slice(0,16).map(c=>c.id));
		for(const [id,m]of marks)if(!keep.has(id)){m.removeFromParent();marks.delete(id);}
		for(const {id,p}of candidates.slice(0,16)) {
			let m=marks.get(id);if(!m){m=new THREE.Group();const foot=new THREE.Mesh(footGeo,stone),post=new THREE.Mesh(postGeo,stone),sign=new THREE.Mesh(signGeo,brass),gem=new THREE.Mesh(gemGeo,glass);foot.position.y=.125;post.position.y=.65;sign.position.y=1;gem.position.y=1.38;m.add(foot,post,sign,gem);group.add(m);marks.set(id,m);}
			// The saved footing was checked when this route was offered. Re-sample for LOD.
			const x=p.x,z=p.z,y=W.player.floorAt?.(x,z,p.y) ?? p.y;
			m.visible=Number.isFinite(y)&&y>.3&&Math.abs(y-p.y)<3;if(m.visible)m.position.set(x,y,z);
		}
	}
	return {update,info:()=>({visible:[...marks.values()].filter(m=>m.visible).length,positions:[...marks.values()].filter(m=>m.visible).map(m=>m.position.toArray())}),dispose(){group.removeFromParent();for(const g of[footGeo,postGeo,signGeo,gemGeo])g.dispose();for(const m of[stone,brass,glass])m.dispose();}};
}
