import * as THREE from 'three';
import { ARMS_CATALOG, isGarment } from '../gameplay/arms.js';
import { RELICS } from '../gameplay/legendary-items.js';

// Small owned meshes: armor is readable on the ground without creating another avatar.
export function armorPickupModel(id) {
	if (!isGarment(id)) return null;
	const root = new THREE.Group(), slot = ARMS_CATALOG[id].slot, relic = RELICS[id];
	root.userData.ownedArmor = true;
	const dark = new THREE.MeshStandardMaterial({color:0x343c43,roughness:.72,metalness:.5});
	const trim = new THREE.MeshStandardMaterial({color:relic?.color || 0x9b9278,roughness:.44,metalness:.65});
	const add = (g, m, x=0,y=0,z=0) => {const a=new THREE.Mesh(g,m);a.position.set(x,y,z);root.add(a);return a;};
	if(slot==='head') {
		add(new THREE.SphereGeometry(.15,12,8,0,Math.PI*2,0,Math.PI*.6),dark);
		add(new THREE.TorusGeometry(.145,.012,4,16),trim,0,-.035,0).rotation.x=Math.PI/2;
	} else if(slot==='body') {
		add(new THREE.CylinderGeometry(.19,.15,.4,8),dark);
		for(const x of [-.21,.21]) add(new THREE.SphereGeometry(.1,8,6),trim,x,.12,0).scale.set(1,.5,.8);
		for(let y=-.12;y<.14;y+=.09) add(new THREE.BoxGeometry(.3,.018,.012),trim,0,y,.16);
	} else {
		for(const x of [-.095,.095]) {
			add(new THREE.CylinderGeometry(.06,.075,slot==='legs'?.36:.18,8),dark,x,0,0);
			add(new THREE.BoxGeometry(.13,.06,slot==='feet'?.24:.12),trim,x,-.08,.04);
		}
	}
	if(relic) for(let n=0;n<3;n++) add(new THREE.OctahedronGeometry(.025,0),trim,(n-1)*.065,.08,.17);
	return root;
}
