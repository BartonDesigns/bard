// You, when the camera steps back to show you (pulling a driver from their seat, and what
// comes after): the hero you chose, a man or a woman (people/hero.js, kept in this browser;
// changed in the settings, setHero), moved by the same motion rig as everyone else's.

import { loadPeopleAssets, buildPerson, freeBody } from './body.js';
import { heroDNA, heroChoice, setHeroChoice } from './hero.js';
import { createMotion } from './motion.js';
import { wearOwnInk } from '../tattoo/studio.js';

export function createAvatar({ scene, world }) {
	let loading = null, me = null, hero = setHeroChoice(heroChoice()), version = 0;
	function ready() {
		if (me) return Promise.resolve(me);
		const v = version, h = hero;
		// (chosen again while it was being made: made as the one chosen now)
		if (!loading) loading = loadPeopleAssets().then((A) => {
			if (v !== version) return ready();
			const P = buildPerson(A, heroDNA(h));
			wearOwnInk(P);                  // (your tattoos, if you have any: tattoo/studio.js)
			const M = createMotion(P, (x, z) => world().island.heightAt(x, z));
			P.root.visible = false;
			scene.add(P.root);
			me = { P, M };
			return me;
		});
		return loading;
	}
	// you again, dressed for the tattoo chair: the same body in a sleeveless top and shorts, so
	// the arms and legs show (built once, when first sat in)
	let chairing = null, chairMe = null;
	function chair() {
		if (chairMe) return Promise.resolve(chairMe);
		if (!chairing) chairing = loadPeopleAssets().then((A) => {
			const d = heroDNA(hero);
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
		me.M.stand(); me.M.setPose(me.P.dna.hero ? 'ready' : 'rest'); me.M.act(null);
		me.P.root.visible = true;
		return me;
	}
	function hide() { if (me) { me.P.root.visible = false; me.M.act(null); } }
	// the other hero: you are made again, where you stood, as you were shown (the hands that
	// were yours follow on their own: combat/melee-view.js, magic/hands.js, crysis/viewmodel.js)
	async function setHero(sex) {
		const next = setHeroChoice(sex);
		if (next === hero) return me;
		hero = next;
		const was = me, chairWas = chairMe;
		me = null; loading = null; chairMe = null; chairing = null; version++;
		if (!was) return null;
		const at = was.M.S.pos.clone(), heading = was.M.S.heading, shown = was.P.root.visible;
		const now = await ready();
		if (shown) { now.M.place(at.x, at.y, at.z, heading); now.M.stand(); now.M.setPose('ready'); now.P.root.visible = true; }
		freeBody(was.P);
		if (chairWas) freeBody(chairWas.P);
		return now;
	}
	function update(dt, t, cam) { if (me?.P.root.visible) me.M.update(dt, t, cam); }
	return { ready, show, hide, update, chair, setHero, get hero() { return hero; }, get version() { return version; }, get me() { return me; }, get chairMe() { return chairMe; } };
}
