// You, when the camera steps back to show you (pulling a driver from their seat, and what
// comes after): a MakeHuman body of your own, the same one every visit (its seed kept in
// this browser), moved by the same motion rig as everyone else's.

import { loadPeopleAssets, buildPerson, personDNA } from './body.js';
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
	function ready() {
		if (me) return Promise.resolve(me);
		if (!loading) loading = loadPeopleAssets().then((A) => {
			const P = buildPerson(A, personDNA(seed(), { age: 30 }));
			wearOwnInk(P);                  // (your tattoos, if you have any: tattoo/studio.js)
			const M = createMotion(P, (x, z) => world().island.heightAt(x, z));
			P.root.visible = false;
			scene.add(P.root);
			me = { P, M };
			return me;
		});
		return loading;
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
	return { ready, show, hide, update, get me() { return me; } };
}
