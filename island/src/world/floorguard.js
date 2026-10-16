// The floor guard: the ground you walk on and the ground you see must be the same ground.
//
// A world's ground is one camera-centred grid (terrain.js) whose vertices are lifted on the
// graphics card from the height texture, while the player stands on island.heightAt, the same
// numbers read on the CPU. The two agree only while the grid is centred on the camera, draws
// the texture made from those numbers and is shown. If the grid's centre is left behind (the
// frame loop stopped short of moving it, main.js), the ground under you is drawn by the grid's
// coarse outer triangles, metres to hundreds of metres off, and past its last ring there is
// nothing at all: a void under a floor you still walk on.
//
// So the drawn surface is rebuilt here on the CPU exactly as the vertex shader makes it (the
// grid's own vertex positions round its centre now, each lifted by the texture's own data,
// the triangle under you interpolated) and compared with the walked floor every half second.
// A gap over a few metres is repaired at its source: the grid re-centred, the texture's data
// put back and uploaded again, the mesh shown.
//
//   gridAt(i, G)                         one axis of the grid's vertex positions (radialGrid)
//   drawnTerrainHeight(src, cx, cz, x, z) the drawn surface's height at (x, z), or null
//   floorVerdict({ walk, ground, drawn, visible })   'ok', 'skip', 'hidden', 'void' or 'gap'
//   createFloorGuard({ world, camera, renderer })  the runtime check: check(dt, { open })

import { TERRAIN_GRID } from './terrain.js';
import { farBlend } from './lunarfar.js';

// one axis of radialGrid's vertices: index i of segments + 2 * extra + 1
export function gridAt(i, G = TERRAIN_GRID, far = false) {
	const extra = far ? G.extra : 0, outer = far ? G.far : 0;
	const u = (i - extra) / G.segments * 2 - 1, a = Math.abs(u);
	return Math.sign(u) * (a <= 1 ? Math.pow(a, G.power) * G.radius : G.radius + (outer - G.radius) * Math.pow((a - 1) * G.segments / (2 * extra), 2.2));
}
// the cell holding offset q along one axis: [i, fraction], or null off the grid
function cellOf(q, G, far) {
	const n = G.segments + 2 * (far ? G.extra : 0);
	if (!(q >= gridAt(0, G, far) && q <= gridAt(n, G, far))) return null;
	let lo = 0, hi = n;
	while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (gridAt(mid, G, far) <= q) lo = mid; else hi = mid; }
	const a = gridAt(lo, G, far), b = gridAt(lo + 1, G, far);
	return [lo, b > a ? (q - a) / (b - a) : 0];
}

// the height texture as the vertex shader reads it (terrain.js HEIGHT_GLSL): clamped, bilinear
export function textureHeight(src, x, z) {
	const { data, N, half, cell } = src;
	const fx = Math.min(Math.max((x + half) / cell, 0), N - 1.001), fz = Math.min(Math.max((z + half) / cell, 0), N - 1.001);
	const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
	return (data[k] * (1 - u) + data[k + 1] * u) * (1 - v) + (data[k + N] * (1 - u) + data[k + N + 1] * u) * v;
}

// The drawn ground's height at (x, z) with the grid centred on (cx, cz): src is the texture's
// data ({ data, N, half, cell }) and whether the world runs on to the horizon (far). null where
// nothing is drawn: off the grid, or past the height map's edge on a bounded world.
export function drawnTerrainHeight(src, cx, cz, x, z, G = TERRAIN_GRID) {
	const far = !!src.far;
	if (!far && Math.max(Math.abs(x), Math.abs(z)) > src.half) return null;
	const ci = cellOf(x - cx, G, far), cj = cellOf(z - cz, G, far);
	if (!ci || !cj) return null;
	const [i, fx] = ci, [j, fz] = cj;
	const ground = (wx, wz) => (far ? farBlend(textureHeight(src, wx, wz), wx, wz, src.half) : textureHeight(src, wx, wz));
	const vert = (a, b) => {
		const px = gridAt(a, G, far), pz = gridAt(b, G, far);
		return ground(px + cx, pz + cz) - (far ? (px * px + pz * pz) / G.curve : 0);
	};
	// the two triangles of the cell: (a, c, b) below its diagonal, (b, c, d) above (radialGrid's index order)
	const ha = vert(i, j), hb = vert(i + 1, j), hc = vert(i, j + 1);
	if (fx + fz <= 1) return ha + (hb - ha) * fx + (hc - ha) * fz;
	const hd = vert(i + 1, j + 1);
	return hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
}

// what to make of one look: walk is the floor the player stands on, ground the land's own
// height there, drawn the drawn ground's (null when none), visible whether the ground is shown
export function floorVerdict({ walk, ground, drawn, visible, tolerance = 4 }) {
	if (walk == null || ground == null || !Number.isFinite(walk)) return 'skip';
	// standing on something built (a deck, a platform, a floor): that is its own mesh's business
	if (walk > ground + 1.5) return 'skip';
	if (!visible) return 'hidden';
	if (drawn == null || !Number.isFinite(drawn)) return 'void';
	return Math.abs(walk - drawn) > tolerance ? 'gap' : 'ok';
}

// The runtime check, run from the frame loop's ground step (main.js followGround). open says
// whether the surface ought to be shown (not down in the caves or the Deep).
export function createFloorGuard({ world, camera, renderer = null, every = 0.5, log = (...a) => console.warn(...a) }) {
	let t = 0, bad = 0;
	const stats = { checks: 0, incidents: 0, repairs: 0, last: null, lastBad: null };
	function look(open) {
		const W = world(), I = W?.island, T = W?.terrain, P = W?.player?.state;
		if (!I || !T || !P || P.flying || P.swimming || P.diving || !T.userData.center) return null;
		const x = P.pos.x, z = P.pos.z, foot = P.pos.y - 1.68;
		// down in a cave, the Deep or a dungeon the cave's floor is the ground, not the land
		if (!open || I.underFloor?.(x, z, foot + 0.5) != null) return null;
		const tex = T.userData.heightTex?.(), c = T.userData.center;
		const walk = W.player.floorAt(x, z, foot + 0.5), ground = I.heightAt(x, z);
		// past the map's edge on a bounded world the land is seabed under the sea, which is drawn
		if (!I.far && Math.max(Math.abs(x), Math.abs(z)) > I.half - 2) return null;
		// (where another system shapes the walked land, Earth's graded roads for one, it is not this grid's to draw)
		const own = textureHeight({ data: I.height, N: I.N, half: I.half, cell: I.cell }, x, z);
		if (Math.abs((I.far ? farBlend(own, x, z, I.half) : own) - ground) > 1) return null;
		const data = tex?.image?.data;
		const drawn = data && data.length === I.N * I.N ? drawnTerrainHeight({ data, N: I.N, half: I.half, cell: I.cell, far: I.far }, c.x, c.y, x, z) : null;
		return { x, z, walk, ground, drawn, visible: T.visible && !!T.parent, verdict: floorVerdict({ walk, ground, drawn, visible: T.visible && !!T.parent }), center: [c.x, c.y], dataOk: data === I.height };
	}
	function repair() {
		const W = world(), T = W.terrain, I = W.island, tex = T.userData.heightTex?.();
		const did = [];
		// the grid left behind: back under the camera
		const snap = TERRAIN_GRID.snap, c = T.userData.center;
		if (Math.abs(c.x - Math.round(camera.position.x / snap) * snap) > snap || Math.abs(c.y - Math.round(camera.position.z / snap) * snap) > snap) { T.userData.update(camera); did.push('recentred'); }
		// the texture's data not the land's own numbers, or wrong on the card: put back and sent again
		if (tex && (tex.image.data !== I.height || bad > 1)) { tex.image.data = I.height; tex.needsUpdate = true; did.push('reuploaded'); }
		if (!T.visible) { T.visible = true; did.push('shown'); }
		stats.repairs++;
		return did;
	}
	// the ground's own program: a device that could not build it (or lost it and could not build
	// it again) draws no ground at all, so the lean stand-in takes its place (terrain.js)
	function program() {
		const T = world()?.terrain;
		if (!renderer || !T || T.userData.leanOn || !T.userData.lean) return null;
		const prog = renderer.properties?.get?.(T.material)?.currentProgram;
		if (!prog || prog.diagnostics?.runnable !== false) return null;
		T.material = T.userData.lean();
		T.userData.leanOn = true;
		stats.incidents++; stats.repairs++;
		stats.lastBad = { verdict: 'unbuilt', did: ['lean ground'], at: Math.round(performance.now()) };
		log('[floor guard] the ground\'s program will not run on this device: the lean ground stands in');
		return 'unbuilt';
	}
	function check(dt, { open = true } = {}) {
		t -= dt;
		if (t > 0) return null;
		t = every;
		try { program(); } catch { /* the check is a guard, never a fault of its own */ }
		let r = null;
		try { r = look(open); } catch { return null; }
		if (!r) return null;
		stats.checks++;
		stats.last = r.verdict;
		if (r.verdict === 'ok' || r.verdict === 'skip') { bad = 0; return r; }
		bad++;
		stats.incidents++;
		const did = repair();
		stats.lastBad = { ...r, did, at: Math.round(performance.now()) };
		if (stats.incidents < 20 || stats.incidents % 50 === 0) log('[floor guard]', r.verdict, 'walked', r.walk.toFixed(2), 'drawn', r.drawn == null ? 'none' : r.drawn.toFixed(2), 'at', Math.round(r.x), Math.round(r.z), 'grid centre', r.center.map(Math.round).join(','), did.join(' ') || 'nothing to repair');
		return r;
	}
	return { check, look, stats, info: () => ({ ...stats }) };
}
