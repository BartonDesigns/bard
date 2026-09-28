// What the ball-field games share (baseball.js, soccer.js, football.js): their venues are
// the fields sportsfields.js has laid out round you; a game started on one sets its stage on
// the field's own spot (the plate, the penalty spot, the goal line) and builds the same
// field round it while it runs (the world's copy is hidden meanwhile); started anywhere
// else it lays a field down on the most open ground about, inside a painted backdrop.
// Also: the players (simple figures in a team's colours), the trail a swipe leaves on the
// screen, and where a point on the screen falls on an upright plane across the stage.

import { buildField, fieldSpec, playSpot } from '../sportsfields.js';

// a game's `where`: the fields of its sport near a point
export const fieldVenue = (kind) => ({
	kind: 'dynamic',
	sites: (W, x, z, R) => (W?.fields?.near?.(x, z, R) || []).filter((f) => f.kind === kind).map((f) => f.site),
});

// the field the game was started on (or a stand-in), and where its stage goes on it:
// `spot` is the stage's origin in the field's frame (the stage faces the field's -z). An
// arena (arenas.js) is matched by its theme, which it carries as its size.
export function fieldStage(ctx, kind, size, spot = null) {
	const sf = ctx.site?.field;
	const real = sf?.kind === kind && (kind !== 'arena' || sf.theme === size) ? sf : null;
	const f = real || { kind, x: 0, z: 0, yaw: 0, ...fieldSpec(kind, size) };
	const at = spot ? spot(f) : playSpot(f);
	const S = { field: f, real: !!real, at };
	// the kit's pose: the stage's origin in the world, turned as the field is
	S.pose = () => {
		if (!real) return null;
		const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
		const x = f.x + c * at[0] + s * at[1], z = f.z - s * at[0] + c * at[1];
		return { x, z, yaw: f.yaw, y: ctx.groundAt?.(x, z) };
	};
	// the field round the stage (its ground as the stage finds it), the world's own hidden
	// (an arena has things that move on it: S.tick runs them)
	let texs = [];
	S.lay = (K) => {
		const out = buildField(f, (lx, lz) => K.groundY(lx - at[0], lz - at[1]), { res: ctx.isPhone ? 8 : 14, shadows: false });
		out.group.position.set(-at[0], 0, -at[1]);
		K.root.add(out.group);
		texs = out.tex || [];
		S.tick = out.tick || null;
		if (real) ctx.getWorld?.()?.fields?.hide(real, true);
		return out.group;
	};
	S.unlay = () => { for (const t of texs) t.dispose(); texs = []; if (real) ctx.getWorld?.()?.fields?.hide(real, false); };
	return S;
}

// a player: legs, body, arms, head and cap, in a team's colours, standing at (x, z) facing
// -z; its arms (and the throwing arm) can be swung
export function figure(K, { shirt = '#c8322c', pants = '#e8e4d8', cap = null, skin = '#c68a62', scale = 1 } = {}, parent) {
	const g = K.group(parent);
	const mat = (c) => K.mat(c, { rough: 0.8, glow: 0.1 });
	for (const sx of [-0.11, 0.11]) K.cyl(0.07, 0.06, 0.85, mat(pants), sx, 0.42, 0, g, 8);
	K.box(0.42, 0.62, 0.24, mat(shirt), 0, 1.15, 0, g);
	const head = K.ball(0.12, mat(skin), 0, 1.6, 0, g);
	if (cap) { K.cyl(0.13, 0.13, 0.08, mat(cap), 0, 1.69, 0, g, 12); K.box(0.16, 0.02, 0.12, mat(cap), 0, 1.66, -0.12, g); }
	const arms = [];
	for (const sx of [-1, 1]) {
		const sh = K.group(g); sh.position.set(sx * 0.27, 1.42, 0);
		K.cyl(0.05, 0.045, 0.6, mat(shirt), 0, -0.3, 0, sh, 6);
		K.ball(0.055, mat(skin), 0, -0.62, 0, sh);
		arms.push(sh);
	}
	g.scale.setScalar(scale);
	return { g, arms, head };
}

// the swipe's trail on the screen: a line that follows the finger and fades
export function trail(K, color = '#ffffff') {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(NS, 'svg');
	svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible');
	const pl = document.createElementNS(NS, 'polyline');
	pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', color); pl.setAttribute('stroke-width', '5'); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round');
	svg.appendChild(pl);
	const host = K.el('position:absolute;inset:0;pointer-events:none;');
	host.appendChild(svg);
	let fade = 0;
	return {
		draw() { const r = K.size(); pl.setAttribute('points', K.ptr.hist.map(([x, y]) => `${x - r.left},${y - r.top}`).join(' ')); pl.setAttribute('opacity', '0.8'); fade = 0; },
		tick(dt) { fade += dt; if (fade > 0.2) pl.setAttribute('opacity', String(Math.max(0, 0.8 - (fade - 0.2) * 2))); },
	};
}

// where a screen point falls on the upright plane z = z0 of the stage (null if it doesn't)
export function onWall(K, x, y, z0) {
	const { THREE } = K, r = K.size();
	const ndc = new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
	const ray = new THREE.Raycaster(), cam = K.camera;
	cam.updateMatrixWorld();
	ray.setFromCamera(ndc, cam);
	ray.ray.applyMatrix4(new THREE.Matrix4().copy(K.root.matrixWorld).invert());
	const d = ray.ray.direction.z;
	if (Math.abs(d) < 1e-6 || (z0 - ray.ray.origin.z) / d <= 0) return null;
	const s = (z0 - ray.ray.origin.z) / d;
	return s > 0 ? ray.ray.origin.clone().addScaledVector(ray.ray.direction, s) : null;
}
