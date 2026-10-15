// A magma world's great eruption: not the mountain's regular fountain (planet/volcano.js keeps
// that clock) but the big one. The vent is made to blow (volcano.erupt), the ground trembles
// for minutes with booms rolling down off the cone, and the ash comes down over everything:
// grey flakes falling round you, the sky going brown-grey and the sun a dull disc, and
// lightning in the ash cloud (the dirty thunderstorm of a real eruption) with its thunder
// late behind it. With no volcano on the world, it is the ash and the tremors alone.

export function createEruption(ctx) {
	const { world, isPhone, fx, sound } = ctx;
	const W = () => world();
	let E = null;
	function start(ev) {
		const v = W()?.volcano;
		let at = null;
		try { v?.erupt?.(); at = v?.vent ? { x: v.vent.x, z: v.vent.z, y: v.vent.y } : null; } catch { at = null; }
		const me = ctx.camera.position;
		at ||= { x: me.x + Math.cos(ev.bearing) * 2500, z: me.z + Math.sin(ev.bearing) * 2500, y: 400 };
		E = { ev, at, t: 0, ashAcc: 0, boomT: 2, flashT: 6, flash: 0 };
		sound.boom(1.4, at);
		return at;
	}
	// how hard the ground trembles here (0..1)
	function intensity() {
		if (!E) return 0;
		const me = ctx.camera.position, d = Math.hypot(me.x - E.at.x, me.z - E.at.z);
		const near = Math.max(0.12, 1 - d / 9000);
		const env = E.t < 3 ? E.t / 3 : Math.max(0, 1 - (E.t - 3) / 90);
		return Math.min(0.55, near * env * (0.25 + 0.4 * E.ev.severity) + (Math.sin(E.t * 0.7) > 0.96 ? 0.15 : 0));
	}
	// how thick the ash is (0..1)
	function ash() { return E ? Math.min(1, E.t / 25) * (E.ending ? Math.max(0, 1 - (E.t - E.ending) / 60) : 1) * (0.55 + 0.45 * E.ev.severity) : 0; }
	function update(dt) {
		if (!E) return 0;
		E.t += dt;
		const k = intensity(), a = ash(), me = ctx.camera.position;
		// the ash falling round you
		E.ashAcc += dt * a * (isPhone ? 30 : 110);
		while (E.ashAcc >= 1) { E.ashAcc -= 1; const r = Math.random() * 45, an = Math.random() * Math.PI * 2; fx.ash(me.x + Math.cos(an) * r, me.y + 8 + Math.random() * 14, me.z + Math.sin(an) * r); }
		// booms off the cone
		if ((E.boomT -= dt) <= 0) { E.boomT = 6 + Math.random() * 14; sound.boom(0.5 + Math.random() * 0.6, E.at); }
		// lightning in the cloud
		E.flash = Math.max(0, E.flash - dt * 6);
		if (a > 0.3 && (E.flashT -= dt) <= 0) { E.flashT = 3 + Math.random() * 8; E.flash = 1; sound.boom(0.7, { x: E.at.x + (Math.random() - 0.5) * 3000, z: E.at.z + (Math.random() - 0.5) * 3000 }, true); }
		sound.setRumble(k * 0.8);
		return k;
	}
	function settle() { if (E && !E.ending) E.ending = E.t; }
	function stop() { sound.setRumble(0); E = null; }
	function info() { return E && { t: +E.t.toFixed(1), vent: [Math.round(E.at.x), Math.round(E.at.z)], ash: +ash().toFixed(2), here: +intensity().toFixed(2), volcano: !!W()?.volcano }; }
	return { start, update, stop, settle, intensity, ash, flash: () => E?.flash || 0, info, state: () => E };
}
