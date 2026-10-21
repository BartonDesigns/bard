// You, when the camera steps back to show you (pulling a driver from their seat, and what
// comes after): the hero you chose, a man or a woman (people/hero.js, kept in this browser;
// changed in the settings, setHero), moved by the same motion rig as everyone else's, in what
// you wear (people/armor-looks.js): dress(worn) builds you again when that changes, and version
// counts the builds so whoever copied your arms or sleeves (crysis/viewmodel.js) knows to again.

import { loadPeopleAssets, buildPerson, freeBody } from './body.js';
import { heroDNA, heroChoice, setHeroChoice } from './hero.js';
import { dressInGear, gearKey } from './armor-looks.js';
import { createMotion } from './motion.js';
import { wearOwnInk } from '../tattoo/studio.js';

export function createAvatar({ scene, world }) {
	let loading = null, me = null, hero = setHeroChoice(heroChoice()), look = null, chosen = 0;
	let worn = {}, wornKey = gearKey({}), version = 0;
	// you, built: your hero, dressed in what you wear over their own clothes
	function build(A) {
		const d = heroDNA(hero, { look });
		if (d.style) d.style = dressInGear(d.style, worn);
		const P = buildPerson(A, d);
		wearOwnInk(P);                  // (your tattoos, if you have any: tattoo/studio.js)
		const M = createMotion(P, (x, z) => world().island.heightAt(x, z), { space: false });
		P.root.visible = false;
		scene.add(P.root);
		version++;
		return { P, M };
	}
	function ready() {
		if (me) return Promise.resolve(me);
		const c = chosen;
		// (chosen again while it was being made: made as the one chosen now)
		if (!loading) loading = loadPeopleAssets().then((A) => (c !== chosen ? ready() : (me = build(A))));
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
			const d = heroDNA(hero, { look });
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
			const M = createMotion(P, (x, z) => world().island.heightAt(x, z), { space: false });
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
	// (look: a variant to try, for the hero view only; people/hero-view.js)
	async function setHero(sex, nextLook = null) {
		const next = setHeroChoice(sex);
		if (next === hero && JSON.stringify(nextLook) === JSON.stringify(look)) return me;
		look = nextLook;
		hero = next;
		const was = me, chairWas = chairMe;
		me = null; loading = null; chairMe = null; chairing = null; chosen++;
		if (!was) return null;
		const at = was.M.S.pos.clone(), heading = was.M.S.heading, shown = was.P.root.visible;
		const now = await ready();
		if (shown) { now.M.place(at.x, at.y, at.z, heading); now.M.stand(); now.M.setPose('ready'); now.P.root.visible = true; }
		freeBody(was.P);
		if (chairWas) freeBody(chairWas.P);
		return now;
	}
	function update(dt, t, cam) { if (me?.P.root.visible) me.M.update(dt, t, cam); }
	return { ready, show, hide, update, chair, dress, setHero, get hero() { return hero; }, get me() { return me; }, get chairMe() { return chairMe; }, get version() { return version; }, get worn() { return { ...worn }; } };
}
