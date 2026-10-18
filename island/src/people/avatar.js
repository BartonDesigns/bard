// You, when the camera steps back to show you (pulling a driver from their seat, and what
// comes after): a MakeHuman body of your own, the same one every visit (its seed kept in
// this browser), moved by the same motion rig as everyone else's, in what you wear
// (people/armor-looks.js): dress(worn) builds you again when that changes, and version counts
// the builds so whoever copied your arms or sleeves (crysis/viewmodel.js) knows to again.

import { loadPeopleAssets, buildPerson, personDNA, freeBody } from './body.js';
import { dressInGear, gearKey } from './armor-looks.js';
import { createMotion } from './motion.js';
import { wearOwnInk } from '../tattoo/studio.js';

const KEY = 'l99-me';

export function createAvatar({ scene, world }) {
	let loading = null, me = null;
	function seed() {
		try {
			let s = +localStorage.getItem(KEY);
			if (!s) { s = (Math.random() * 2 ** 31) >>> 0 || 1; localStorage.setItem(KEY, String(s)); }
			return s;
		} catch { return 7919; }
	}
	let worn = {}, wornKey = gearKey({}), version = 0;
	// you, built: your body, dressed in what you wear over your own clothes
	function build(A) {
		const d = personDNA(seed(), { age: 30 });
		if (d.style) d.style = dressInGear(d.style, worn);
		const P = buildPerson(A, d);
		wearOwnInk(P);                  // (your tattoos, if you have any: tattoo/studio.js)
		const M = createMotion(P, (x, z) => world().island.heightAt(x, z));
		P.root.visible = false;
		scene.add(P.root);
		version++;
		return { P, M };
	}
	function ready() {
		if (me) return Promise.resolve(me);
		if (!loading) loading = loadPeopleAssets().then((A) => (me = build(A)));
		return loading;
	}
	// what you wear now ({ slot: item id }): built again when it changes, where you stood
	function dress(next = {}) {
		const key = gearKey(next);
		if (key === wornKey) return false;
		worn = { ...next }; wornKey = key;
		if (!me) return true;
		loadPeopleAssets().then((A) => {
			if (gearKey(worn) !== key || !me) return;
			const old = me, was = old.P.root.visible, at = old.P.root.position.clone(), yaw = old.P.root.rotation.y;
			me = build(A);
			if (was) { me.M.place(at.x, at.y, at.z, yaw); me.M.stand(); me.P.root.visible = true; }
			old.P.root.removeFromParent(); freeBody(old.P);
		});
		return true;
	}
	// you again, dressed for the tattoo chair: the same body in a sleeveless top and shorts, so
	// the arms and legs show (built once, when first sat in)
	let chairing = null, chairMe = null;
	function chair() {
		if (chairMe) return Promise.resolve(chairMe);
		if (!chairing) chairing = loadPeopleAssets().then((A) => {
			const d = personDNA(seed(), { age: 30 });
			// (the same clothes' colours, cut short: the day's style changed in place, so it is
			// still you, hair and all)
			if (d.style) {
				const S = d.style;
				S.outer = null;
				if (S.top) S.top = { ...S.top, kind: S.top.kind === 'hoodie' || S.top.kind === 'shirt' ? 'tee' : S.top.kind, sleeves: 'none' };
				if (S.bottom) S.bottom = { ...S.bottom, kind: 'shorts', legs: 'shorts', len: undefined };
			} else d.outfit = { ...d.outfit, sleeves: 'none', legs: 'shorts', jacket: null };
			const P = buildPerson(A, d);
			wearOwnInk(P);
			const M = createMotion(P, (x, z) => world().island.heightAt(x, z));
			P.root.visible = false;
			scene.add(P.root);
			chairMe = { P, M };
			return chairMe;
		});
		return chairing;
	}
	// stood at (x, z) facing heading, shown
	function show(x, z, heading) {
		if (!me) return null;
		me.M.place(x, world().island.heightAt(x, z), z, heading);
		me.M.stand(); me.M.setPose('rest'); me.M.act(null);
		me.P.root.visible = true;
		return me;
	}
	function hide() { if (me) { me.P.root.visible = false; me.M.act(null); } }
	function update(dt, t, cam) { if (me?.P.root.visible) me.M.update(dt, t, cam); }
	return { ready, show, hide, update, chair, dress, get me() { return me; }, get chairMe() { return chairMe; }, get version() { return version; }, get worn() { return { ...worn }; } };
}
