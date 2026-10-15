// Bounded, physical shop signs for authored settlements, independent of Earth's roads.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { campaignFace } from './campaigns.js';
import { brandIdentity } from './brand-catalog.js';
import { artFamily, drawTradeBoard, drawBanner, drawCampaign, loadSignArt } from './art.js';

export function realmSignRecords(realm) {
	const out = [], family = 'heritage';
	const front = (b, along, forward) => ({ x: b.x + Math.cos(b.yaw) * along + Math.sin(b.yaw) * forward, z: b.z - Math.sin(b.yaw) * along + Math.cos(b.yaw) * forward });
	for (const [b, name, trade, tag] of [[realm.inn, "Bess's Inn", 3, 'Supper & shelter'], [realm.smithy, "Godric's Forge", 1, 'Iron & craft']]) {
		if (!b) continue;
		out.push({ ...front(b, -b.w / 2 + 1, b.d / 2 + .75), y: b.y, yaw: b.yaw, family, name, tag, trade, width: 1.08, height: 1.5, bottom: 2.25, mount: 'bracket', wallDepth: .75 });
		out.push({ ...front(b, b.w / 2 - .75, b.d / 2 + .15), y: b.y, yaw: b.yaw, family, name, tag, label: tag, trade, width: .85, height: 2.65, bottom: .2, mount: 'wall', format: 'banner' });
	}
	const goods = [[0, 'Bread', 'Fresh loaves'], [7, 'Orchard Stall', 'Fruit & produce'], [7, 'Dairy Stall', 'Cheese & provisions'], [7, 'Earthenware', 'Pots & vessels'], [5, 'Thread & Linen', 'Cloth & colour']];
	for (const s of realm.stalls || []) {
		const [trade, name, tag] = goods[s.goods % goods.length];
		out.push({ ...front(s, 0, .57), y: s.y, yaw: s.yaw, family, name, tag, trade, width: .61, height: .77, bottom: .08, mount: 'wall' });
	}
	return out;
}
export function caveSignRecords(stalls, civ) {
	const family = artFamily({ civ });
	return stalls.slice(0, 3).flatMap(s => {
		const at = (along, forward) => ({x:s.x+Math.cos(s.face)*along+Math.sin(s.face)*forward,z:s.z-Math.sin(s.face)*along+Math.cos(s.face)*forward,y:s.y,yaw:s.face});
		return [
			{...at(0,.78),family,name:'Cavern Market',tag:'Pots, baskets & wares',trade:7,width:.64,height:.77,bottom:.08,mount:'wall'},
			{...at(1.05,.78),family,name:'Cavern Market',label:'Pots & wares',trade:7,width:.42,height:2.05,bottom:.12,mount:'post',format:'banner'},
		];
	});
}
// Site-specific markers, not invented businesses or promises of available quests.
export function colonySignRecords(plan, heightAt) {
	return [{...plan.hub,name:plan.name,kind:'habitat'},...(plan.port ? [{...plan.port,kind:'port'}] : []),...plan.outposts].slice(0,8).map(s => {
		const x=s.x+(s.r||15)+4,z=s.z;
		return {x,z,y:heightAt(x,z),yaw:s.yaw||0,family:'orbital',name:s.name,label:s.kind,trade:s.kind==='mine'?1:s.kind==='scrubbers'?6:s.kind==='habitat'?3:7,width:1.1,height:3.6,bottom:.2,mount:'post',format:'banner'};
	});
}

export function createArtSigns({ parent, records, isPhone = false }) {
	const group = new THREE.Group(); group.name = 'crafted-trade-signs'; parent.add(group);
	const expanded=records.flatMap(s=>s.format==='banner' && ['heritage','mystic','orbital'].includes(s.family) ? [s,{...s,x:s.x+Math.cos(s.yaw)*1.1,z:s.z-Math.sin(s.yaw)*1.1,width:1.1,height:.65,bottom:3.05,mount:'post',campaign:'flag'}] : [s]);
	const list = expanded.slice(0, isPhone ? 16 : 32).map(s => {
		if (s.format !== 'banner' || !['heritage','mystic','orbital'].includes(s.family)) return s;
		const brand = brandIdentity(({heritage:'guild',mystic:'fae',orbital:'orbital'})[s.family],`${s.name}:${s.x}:${s.z}`);
		// Keep trade-specific guild and orbital imagery truthful to the actual place.
		const trade = s.family === 'heritage' ? [2,4,1,3,3,5,7,7][s.trade] : s.family === 'orbital' ? ({mine:3,scrubbers:1,habitat:5,port:2})[s.label] : undefined;
		return {...s,artFamily:brand.family,artTrade:trade ?? brand.trade};
	}), CW = isPhone ? 192 : 384, CH = isPhone ? 256 : 512;
	const cols = Math.min(4, Math.max(1, list.length)), rows = Math.max(1, Math.ceil(list.length / cols));
	const cv = document.createElement('canvas'); cv.width = cols * CW; cv.height = rows * CH;
	const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
	const wood = new THREE.MeshStandardMaterial({ color: 0x493126, roughness: .88 });
	const metal = new THREE.MeshStandardMaterial({ color: 0x756448, roughness: .56, metalness: .7 });
	const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .84, metalness: 0, alphaTest: .5 });
	const parts = { wood: [], metal: [], face: [] }, anchors = [];
	let disposed = false;
	const paint = () => {
		if (disposed) return;
		g.clearRect(0, 0, cv.width, cv.height);
		list.forEach((s, i) => {
			// Draw at the physical aspect ratio, then fit the cell; round emblems stay round.
			const w = CW-8, h = w*s.height/s.width;
			g.save(); g.translate(i%cols*CW+4,Math.floor(i/cols)*CH+4); g.scale(1,(CH-8)/h);
			if(s.campaign){const f=campaignFace(({heritage:'guild',mystic:'fae',orbital:'orbital'})[s.family],s.name,'flag');drawCampaign(g,0,0,w,h,{...f,family:s.artFamily,trade:s.artTrade,phone:isPhone});}
			else (s.format === 'banner' ? drawBanner : drawTradeBoard)(g,0,0,w,h,s,{family:s.family,phone:isPhone,portrait:true});
			g.restore();
		});
		tex.needsUpdate = true;
	};
	for (let i = 0; i < list.length; i++) {
		const s = list[i], w = s.width, h = s.height, bottom = s.bottom;
		const M = new THREE.Matrix4().makeRotationY(s.yaw).setPosition(s.x, s.y, s.z);
		const add = (bucket, geo) => parts[bucket].push(geo.applyMatrix4(M));
		const box = (bucket, x, y, z, bw, bh, bd) => add(bucket, new THREE.BoxGeometry(bw, bh, bd).translate(x, y, z));
		// Solid bevelled timber, not a poster floating in space. Bottoms clear door heads.
		if (s.format !== 'banner') {
		const shape = new THREE.Shape();
		shape.moveTo(-w / 2 + .035, 0); shape.lineTo(w / 2 - .035, 0); shape.lineTo(w / 2, .04);
		shape.lineTo(w / 2, h - .1); shape.quadraticCurveTo(0, h + .1, -w / 2, h - .1); shape.lineTo(-w / 2, .04); shape.closePath();
		add('wood', new THREE.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .018, bevelThickness: .012, curveSegments: 5 }).translate(0, bottom, -.028));
		} else {
			const material = s.family === 'orbital' ? 'metal' : 'wood';
			for (const yy of [bottom, bottom+h]) box(material,0,yy,0,w+.08,.045,.055);
		}
		if (s.mount === 'bracket') {
			const top = bottom + h + .25, depth = s.wallDepth || .75;
			box('wood', 0, top, -depth / 2, .1, .11, depth + .2);
			box('wood', 0, top - .3, -depth, .14, .75, .12);
			for (const xx of [-w * .29, w * .29]) {
				box('metal', xx, top - .12, 0, .018, .28, .018);
				add('metal', new THREE.TorusGeometry(.046, .009, 5, 10).translate(xx, bottom + h - .02, .035));
			}
		} else if (s.mount === 'post') {
			box(s.family === 'orbital' ? 'metal' : 'wood', -.55 * w, (bottom + h + .2) / 2, -.08, .12, bottom + h + .2, .12);
			box(s.family === 'orbital' ? 'metal' : 'wood', 0, bottom + h + .15, -.08, w * 1.3, .12, .12);
		}
		if (s.format !== 'banner') for (const xx of [-w * .43, w * .43]) for (const yy of [bottom + .08, bottom + h - .12]) add('metal', new THREE.SphereGeometry(.017, 6, 4).translate(xx, yy, .045));
		for (const side of [1, -1]) {
			const f = new THREE.PlaneGeometry(w - .045, h - .07, 4, s.format === 'banner' ? 12 : 1);
			if (s.format === 'banner' && s.family !== 'orbital') {
				const p = f.attributes.position;
				for (let j=0;j<p.count;j++) p.setZ(j,.035*Math.sin((p.getY(j)/h+.5)*Math.PI)*Math.cos(p.getX(j)/w*4));
				f.computeVertexNormals();
			}
			// Two outward faces, each correctly readable rather than mirrored from behind.
			const uv = f.attributes.uv;
			for (let j = 0; j < uv.count; j++) uv.setXY(j, (i % cols + (.5 + uv.getX(j) * (CW - 1)) / CW) / cols, 1 - (Math.floor(i / cols) + 1 - (.5 + uv.getY(j) * (CH - 1)) / CH) / rows);
			f.rotateY(side < 0 ? Math.PI : 0).translate(0, bottom + h / 2, side * .047);
			add('face', f);
		}
		anchors.push({ x: s.x, y: s.y + bottom + h / 2, z: s.z, name: s.name, family: s.family, format: s.format || 'board' });
	}
	for (const [key, mat] of [['wood', wood], ['metal', metal], ['face', faceMat]]) {
		if (!parts[key].length) continue;
		// Extrusions are unindexed; normalize other primitives before merging.
		const src = parts[key].map(p => p.index ? p.toNonIndexed() : p);
		const geometry = mergeGeometries(src, false), mesh = new THREE.Mesh(geometry, mat);
		mesh.name = 'crafted-sign-' + key; mesh.castShadow = key !== 'face' && !isPhone; mesh.receiveShadow = true; group.add(mesh);
		new Set([...src, ...parts[key]]).forEach(p => p.dispose());
	}
	paint();
	for (const family of new Set(list.map(s => s.artFamily || s.family))) loadSignArt(family, isPhone).then(paint);
	return {
		group, anchors,
		update(camera) { group.visible = anchors.some(a => Math.hypot(camera.position.x - a.x, camera.position.y - a.y, camera.position.z - a.z) < (isPhone ? 110 : 220)); },
		info: () => ({ count: list.length, draws: group.children.length, atlas: [cv.width, cv.height], families: [...new Set(list.map(s => s.family))] }),
		dispose() { if (disposed) return; disposed = true; group.removeFromParent(); group.traverse(o => o.geometry?.dispose()); wood.dispose(); metal.dispose(); faceMat.dispose(); tex.dispose(); },
	};
}
