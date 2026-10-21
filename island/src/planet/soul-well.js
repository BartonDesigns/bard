import * as THREE from 'three';
import { SOUL_SITE, atSoulWell } from '../reputation/sanctuary.js';
import { createWaypoint } from '../ui/waypoint.js';

export function createSoulWell({ world, profile, scene, camera, mount, shared, soul, hint, blocked = () => false }) {
	const site = world.underworld?.plan?.soul;
	if (!site) return null;
	const group = new THREE.Group(); group.name = 'The Quiet Well';
	group.position.set(site.x, world.underworld.floor(site.x, site.z, site.y + 1) ?? site.y, site.z); scene.add(group);
	const stone = new THREE.MeshStandardMaterial({ color: 0x28363a, roughness: .83, metalness: .12 });
	const glow = new THREE.MeshStandardMaterial({ color: 0x83dfdc, emissive: 0x36a0ae, emissiveIntensity: .7, roughness: .28, metalness: .55 });
	const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, .16, 10, 48), stone); ring.rotation.x = Math.PI / 2; ring.position.y = .16; group.add(ring);
	const water = new THREE.Mesh(new THREE.CircleGeometry(1.12, 48), glow); water.rotation.x = -Math.PI / 2; water.position.y = .09; group.add(water);
	for (let i=0;i<8;i++) { const p=new THREE.Mesh(new THREE.OctahedronGeometry(.09,0),glow);const a=i*Math.PI/4;p.position.set(Math.cos(a)*1.25,.34,Math.sin(a)*1.25);group.add(p); }
	world.underworld.addGlow?.(site.x, site.y + 2, site.z, 16, [0.28, .7, .85], 1.5, 0, true);
	const waypoint = createWaypoint({ scene, camera, mount, top: 126, onTap: () => hint('Walk through the marked tunnel. The Quiet Well lies beneath the island.', 5000) });
	const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Cleanse your soul';
	button.style.cssText = 'position:absolute;bottom:calc(190px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);padding:14px 20px;border-radius:14px;border:1px solid #9cdddb;background:#102f36;color:#edfffb;font:600 16px var(--bard-display,system-ui,sans-serif);z-index:12;display:none;touch-action:manipulation';
	for (const e of ['pointerdown','pointerup','touchstart','keydown']) button.addEventListener(e, e => e.stopPropagation());
	mount.append(button);
	let ritual = null, generation = 0, pending = false, disposed = false, confirming = false;
	const pose = () => ({ w: SOUL_SITE.world, type: profile.type, p: world.player.state.pos.toArray(), flying: world.player.state.flying, driving: blocked() });
	function cancel() { generation++; ritual = null; confirming = false; pending = false; button.disabled = false; button.textContent = 'Cleanse your soul'; }
	button.onclick = async () => {
		if (!atSoulWell(pose()) || blocked() || pending || ritual) return;
		if (!confirming) { confirming = true; button.textContent = 'Reset all standing · begin ritual'; hint('This releases your good and harmful reputation. Your possessions, quests and world changes remain. Tap again to begin.', 8000); return; }
		const run = ++generation; pending = true; button.disabled = true; button.textContent = 'Listening…';
		try { const challenge = await soul.begin(pose()); if (disposed || run !== generation || !atSoulWell(pose())) return; ritual = { challenge, started: performance.now() }; }
		catch (e) { if (run === generation) { cancel(); hint(e.message, 7000); } }
		finally { if (run === generation) { pending = false; button.disabled = false; } }
	};
	function update(dt, time) {
		const p = world.player.state, near = atSoulWell(pose()) && !blocked();
		if (!near && (ritual || confirming || pending)) { cancel(); hint('You left the well. Your reputation is unchanged.', 3500); }
		button.style.display = near ? '' : 'none';
		const underground = (world.underworld.inside() || 0) > .5;
		const target = underground ? site : site.entrance;
		waypoint.set({ x: target.x, y: underground ? site.y : target.y, z: target.z, title: underground ? 'The Quiet Well' : 'Soul tunnel', detail: underground ? 'Reputation can be released here' : 'Beneath Gargantua’s island', radius: underground ? 4 : 8 });
		waypoint.update(dt, time, !near && !world.orbit?.high?.() && !blocked());
		group.visible = underground || p.pos.distanceTo(group.position) < 40;
		glow.emissiveIntensity = .65 + Math.sin(time * 1.2) * .08 + (shared.uMid?.value || 0) * .45;
		if (!ritual || pending) return;
		const left = Math.max(0, SOUL_SITE.seconds + .25 - (performance.now() - ritual.started)/1000);
		button.textContent = `Remain at the well · ${Math.ceil(left)}s`;
		if (left > 0) return;
		const run = generation, challenge = ritual.challenge; pending = true; button.disabled = true; button.textContent = 'Releasing…';
		soul.cleanse(challenge, pose()).then(() => { if (!disposed && run === generation) { cancel(); hint('Your soul is cleansed. Your standing begins anew.', 7000); } }).catch(e => { if (!disposed && run === generation) { cancel(); hint(e.message, 7000); } });
	}
	return { update, cancel, info: () => ({ name: site.name, at: [site.x,site.y,site.z], entrance: [site.entrance.x,site.entrance.y,site.entrance.z], ritual: !!ritual }), dispose() { disposed = true; cancel(); waypoint.dispose(); button.remove(); group.removeFromParent(); group.traverse(o => o.geometry?.dispose()); stone.dispose(); glow.dispose(); } };
}
