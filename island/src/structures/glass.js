// Glass that breaks. The offices and towers near you are hung with curtain walls (floor to
// ceiling panes on every storey, mullions between), the shops have their plate-glass fronts,
// a modern house its sliders out the back; the buildings built inside (interiors/) have their
// own windows. A shot stars a pane with radial cracks where it struck; another, or a heavy
// one, brings it down in shards that spin to the pavement. Run at it (sprinting) or drive
// into it with enough behind you (speed and weight) and you go through. A blast breaks the
// panes round it and cracks those further off. What is broken stays broken, the opening
// open, until it is repaired (structures/rebuild.js), kept by building (structures/store.js).
//
// One instanced mesh draws every pane near you (an opaque reflecting glass of its own, the sky
// in it, the lit rooms behind at night); the windows the interiors built are their own glass,
// and only their cracks are drawn over them by the same mesh.

import * as THREE from 'three';
import { bid, frameOf, FACES, onFace, uOn, faceLen, hash } from './ids.js';
import { facadeOf } from './shell.js';

const VERT = /* glsl */`
attribute vec4 aCrack; attribute vec4 aGlass;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vN; varying vec4 vCrack; varying vec4 vGlass; varying vec2 vSize;
#include <fog_pars_vertex>
void main() {
	vUv = uv; vCrack = aCrack; vGlass = aGlass;
	vSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
	vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
	vWorld = wp.xyz;
	vN = normalize(mat3(modelMatrix) * normalize(instanceMatrix[2].xyz));
	vec4 mvPosition = viewMatrix * wp;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const FRAG = /* glsl */`
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNight;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vN; varying vec4 vCrack; varying vec4 vGlass; varying vec2 vSize;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
	vec2 m = vUv * vSize;
	// the cracks: spokes out from where it was struck, rings between them, a white star at the heart
	float crack = 0.0;
	if (vCrack.z > 0.0) {
		vec2 q = m - vCrack.xy * vSize;
		float r = length(q), a = atan(q.y, q.x) / 6.2832 + 0.5, N = 11.0;
		float sp = a * N + h21(vec2(vCrack.w, 3.1)) ;
		float cell = floor(sp), jit = (h21(vec2(cell, vCrack.w)) - 0.5) * 0.6;
		float line = abs(fract(sp + jit * sin(r * 3.0)) - 0.5) * r * 6.2832 / N;
		float reach = vCrack.z * min(vSize.x, vSize.y) * (0.5 + 0.6 * h21(vec2(cell, 7.0)));
		crack = (1.0 - smoothstep(0.004, 0.014, line)) * (1.0 - smoothstep(reach * 0.8, reach, r));
		float ring = abs(fract(r * 2.6 + h21(vec2(cell, 2.0))) - 0.5);
		crack = max(crack, (1.0 - smoothstep(0.012, 0.03, ring * 0.38)) * step(h21(vec2(cell, floor(r * 2.6))), 0.45) * (1.0 - smoothstep(reach * 0.4, reach * 0.55, r)));
		crack = max(crack, 1.0 - smoothstep(0.03, 0.09, r));
	}
	if (vGlass.a < -0.5 && crack < 0.05) discard;
	vec3 V = normalize(vWorld - cameraPosition), N2 = normalize(vN);
	if (dot(N2, V) > 0.0) N2 = -N2;
	// (panes are never quite flat: a slight waver in what they reflect)
	vec3 R = reflect(V, normalize(N2 + vec3(sin(vWorld.y * 1.7 + vWorld.x * 0.3), 0.0, cos(vWorld.y * 1.3 + vWorld.z * 0.3)) * 0.012));
	vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, R.y));
	vec3 refl = R.y > 0.0 ? sky : mix(uHorizon * 0.55, uHorizon * 0.18, smoothstep(0.0, -0.25, R.y));
	float fres = 0.18 + 0.82 * pow(1.0 - max(0.0, dot(-V, N2)), 3.0);
	float lit = step(0.5, vGlass.a) * uNight;
	vec3 room = vGlass.rgb * 0.12 + vec3(1.0, 0.78, 0.52) * lit * (0.55 + 0.45 * h21(floor(m * 0.5)));
	vec3 col = mix(room, refl * mix(vec3(1.0), vGlass.rgb * 1.6, 0.35), fres * (1.0 - lit * 0.6));
	col += uSunColor * pow(max(0.0, dot(R, uSunDir)), 260.0) * 2.5 * (1.0 - uNight);
	// the frame round each pane (the mullions and transoms of the curtain wall)
	vec2 e = min(m, vSize - m);
	float frame = 1.0 - smoothstep(0.035, 0.055, min(e.x, e.y));
	col = mix(col, vec3(0.06, 0.065, 0.07) + uHorizon * 0.08, frame * step(-0.5, vGlass.a));
	col = mix(col, vec3(0.86, 0.9, 0.92) * (0.35 + 0.65 * max(0.2, dot(uSunDir, vec3(0.0, 1.0, 0.0)))), crack * 0.85);
	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;

const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export function createGlass(ctx) {
	const { scene, isPhone, shared, store, sounds, debris } = ctx;
	const CAP = isPhone ? 2400 : 7000, R = isPhone ? 95 : 170;
	const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0, 0);
	const aCrack = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4), aGlass = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
	geo.setAttribute('aCrack', aCrack); geo.setAttribute('aGlass', aGlass);
	const mat = new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uZenith: { value: new THREE.Color(0.35, 0.5, 0.75) }, uHorizon: { value: new THREE.Color(0.7, 0.75, 0.8) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) }, uNight: { value: 0 } }]),
		vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide,
	});
	const mesh = new THREE.InstancedMesh(geo, mat, CAP);
	mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'structures-glass';
	scene.add(mesh);

	// every pane near you: { key, id, o, f, u0, u1, y0, y1 (above the foot), x, y, z (its
	// middle), nx, nz (outward), w, h, plan (an interior's window: { B, wall, op, k }), crack, slot }
	let panes = [], byKey = new Map(), lastList = null, bx = 1e9, bz = 1e9, dirty = true, liveSig = '';
	const recOf = (id) => store.get(id);
	const broken = (id, f, u0, u1, y0, y1) => { const g = recOf(id)?.g; if (!g) return false; for (const [gf, gu, gy] of g) if (gf === f && gu > u0 - 0.15 && gu < u1 + 0.15 && gy > y0 - 0.15 && gy < y1 + 0.15) return true; return false; };
	// the side of a surveyed shop facing its street (the grid's lots face theirs with local +z)
	function frontOf(o) {
		if (!o.mapped) return 0;
		const real = ctx.real();
		if (!real?.near) return 0;
		let best = 0, bd = 1e9;
		const F = frameOf(o);
		for (const r of real.near('roads', o.x, o.z, Math.max(o.w, o.d) / 2 + 30)) {
			if (!r.drive || r.cls === 'service') continue;
			const p = r.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / l2));
				const qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(qx - o.x, qz - o.z);
				if (d >= bd) continue;
				bd = d;
				const [lx, lz] = F.l(qx, qz);
				best = Math.abs(lx) / o.w > Math.abs(lz) / o.d ? (lx > 0 ? 2 : 3) : lz > 0 ? 0 : 1;
			}
		}
		return best;
	}
	// what a lot is hung with: curtain walls, a shop front, sliders; or nothing
	function design(o) {
		const k = Math.floor(o.kind), src = o.src?.kind, H = o.h - 1.2;
		if (o.src?.grp?.near || H < 2.6 || o.w < 4 || o.d < 4) return null;
		const id = bid(o), F = facadeOf(o);
		if (F.curtain && H > 7 && hash(o.x * 0.37, o.z * 0.61) < 0.7) return { id, kind: 'curtain', faces: [0, 1, 2, 3], storey: F.storey };
		if ((k === 9 || k === 6 || src === 5 || src === 6) && H < 24) return { id, kind: 'shop', faces: [frontOf(o)], storey: F.storey };
		if ((k === 1 || k === 11 || k === 12) && o.era === 'modern' && !o.mapped) return { id, kind: 'home', faces: [1] };
		return null;
	}
	function lay(o, D, out, claimed) {
		const F = frameOf(o), H = o.h - 1.2, foot = o.y + 1.2;
		for (const f of D.faces) {
			const L = faceLen(o, f), [nx, nz] = FACES[f], [wnx, wnz] = F.dir(nx, nz);
			const add = (u0, u1, y0, y1) => {
				if (out.length >= CAP) return;
				const um = (u0 + u1) / 2, [lx, lz] = onFace(o, f, um), [x, z] = F.w(lx + nx * 0.06, lz + nz * 0.06);
				const key = D.id + ':' + f + ':' + um.toFixed(1) + ':' + y0.toFixed(1);
				if (broken(D.id, f, u0, u1, y0, y1)) return;
				out.push({ key, id: D.id, o, f, u0, u1, y0, y1, x, y: foot + (y0 + y1) / 2, z, nx: wnx, nz: wnz, w: u1 - u0, h: y1 - y0, crack: byKey.get(key)?.crack || null, lit: hash(x * 3.1, foot + y0) < 0.45 ? 1 : 0 });
			};
			if (D.kind === 'curtain') {
				const n = Math.max(1, Math.round(L / 1.75)), cw = L / n;
				for (let y = 0; y + 2 < H - 0.4; y += D.storey) for (let i = 0; i < n; i++) add(-L / 2 + i * cw + 0.02, -L / 2 + (i + 1) * cw - 0.02, y + 0.04, Math.min(H - 0.4, y + D.storey - 0.04));
			} else if (D.kind === 'shop') {
				const n = Math.max(2, Math.round((L - 1.6) / 2.4)), cw = (L - 1.2) / n, door = Math.floor(n / 2);
				for (let i = 0; i < n; i++) { if (i === door && n > 2) continue; add(-L / 2 + 0.6 + i * cw, -L / 2 + 0.6 + (i + 1) * cw - 0.04, 0.35, Math.min(H - 0.3, D.storey - 0.4)); }
			} else {
				const n = L > 9 ? 3 : 2, pw = 1.5;
				for (let i = 0; i < n; i++) add(-n * pw / 2 + i * pw, -n * pw / 2 + (i + 1) * pw - 0.03, 0.08, 2.5);
			}
		}
		claimed.add(D.id);
	}
	// the windows of the buildings built inside (interiors/): their own glass, by the plan
	function layPlans(out, claimed) {
		const I = ctx.interiors();
		if (!I?.live) return;
		for (const B of I.live.values()) {
			if (!B.ready || !B.P || B.site) continue;
			const o = B.o, P = B.P, id = bid(o), F = frameOf(o), foot = o.y + 1.2;
			claimed.add(id);
			for (const w of P.walls) {
				if (w.kind !== 'ext' || !B.levels[w.k]) continue;
				for (const op of w.open) {
					if (op.type !== 'window' && op.type !== 'store') continue;
					// (its face, and where it is along it, in the lot's frame)
					const [lnx, lnz] = w.axis === 'x' ? [0, w.out] : [w.out, 0];
					const f = lnz > 0 ? 0 : lnz < 0 ? 1 : lnx > 0 ? 2 : 3;
					const sm = (op.s0 + op.s1) / 2, [lx, lz] = w.axis === 'x' ? [sm, w.pos] : [w.pos, sm];
					const u = uOn(f, lx, lz), y0 = P.f0 + op.y0 - foot, y1 = P.f0 + op.y1 - foot, hw = (op.s1 - op.s0) / 2;
					const key = id + ':p:' + w.k + ':' + lx.toFixed(1) + ':' + lz.toFixed(1) + ':' + op.y0.toFixed(1);
					const gone = broken(id, f, u - hw, u + hw, y0, y1);
					const plan = { B, wall: w, op, k: w.k };
					if (gone) { openPlan(plan); continue; }
					const [wx, wz] = F.w(lx + lnx * 0.012, lz + lnz * 0.012), [wnx, wnz] = F.dir(lnx, lnz);
					out.push({ key, id, o, f, u0: u - hw, u1: u + hw, y0, y1, x: wx, y: foot + (y0 + y1) / 2, z: wz, nx: wnx, nz: wnz, w: hw * 2, h: y1 - y0, plan, crack: byKey.get(key)?.crack || null, store: op.type === 'store' });
				}
			}
		}
	}
	// a plan's window gone: its glass taken out of the level's mesh, the wall's box in it (and
	// a shop front's low sill, to step over) taken out of what stops you
	function openPlan(plan) {
		const { B, wall: w, op, k } = plan, Lb = B.levels[k];
		if (!Lb || Lb.opened?.has(op)) return;
		(Lb.opened || (Lb.opened = new Set())).add(op);
		const a0 = w.pos - w.t / 2 - 0.02, a1 = w.pos + w.t / 2 + 0.02;
		const inBox = (x, y, z) => (w.axis === 'x' ? x > op.s0 - 0.01 && x < op.s1 + 0.01 && z > a0 && z < a1 : z > op.s0 - 0.01 && z < op.s1 + 0.01 && x > a0 && x < a1) && y > op.y0 - 0.01 && y < op.y1 + 0.01;
		Lb.root.traverse((m) => {
			if (!m.isMesh || m.name !== 'glass') return;
			const p = m.geometry.attributes.position;
			let changed = false;
			for (let i = 0; i + 2 < p.count; i += 3) {
				const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
				if (!inBox(cx, cy, cz)) continue;
				for (let j = 0; j < 3; j++) p.setXYZ(i + j, cx, cy, cz);
				changed = true;
			}
			if (changed) p.needsUpdate = true;
		});
		const sill = op.type === 'store' && op.y0 < 0.6;
		Lb.col = Lb.col.filter((b) => {
			const s0 = w.axis === 'x' ? b[0] : b[1], s1 = w.axis === 'x' ? b[2] : b[3], c0 = w.axis === 'x' ? b[1] : b[0], c1 = w.axis === 'x' ? b[3] : b[2];
			const inWall = c0 > a0 - 0.05 && c1 < a1 + 0.05 && s0 > op.s0 - 0.05 && s1 < op.s1 + 0.05;
			if (!inWall) return true;
			if (Math.abs(b[4] - op.y0) < 0.02 && Math.abs(b[5] - op.y1) < 0.02) return false;
			if (sill && b[5] <= op.y0 + 0.02 && b[4] >= P0(B, k) - 0.02) return false;
			return true;
		});
	}
	const P0 = (B, k) => B.P.levels[k]?.y ?? 0;

	function rebuild(cam) {
		const city = ctx.city();
		if (!city?.lotsNear) { panes = []; mesh.count = 0; return; }
		bx = cam.position.x; bz = cam.position.z; dirty = false;
		const out = [], claimed = new Set();
		layPlans(out, claimed);
		const lots = city.lotsNear(bx, bz, R).filter((o) => !o.wrecked).sort((p, q) => Math.hypot(p.x - bx, p.z - bz) - Math.hypot(q.x - bx, q.z - bz));
		for (const o of lots) {
			if (out.length >= CAP) break;
			const D = design(o);
			if (D && !claimed.has(D.id)) lay(o, D, out, claimed);
		}
		panes = out;
		byKey = new Map(panes.map((p) => [p.key, p]));
		upload();
	}
	function upload() {
		let n = 0;
		for (const p of panes) {
			if (n >= CAP) break;
			p.slot = -1;
			// (an interior's window draws only its cracks, over its own glass)
			if (p.plan && !p.crack) continue;
			QT.setFromAxisAngle(UP, Math.atan2(p.nx, p.nz));
			mesh.setMatrixAt(n, M4.compose(P3.set(p.x, p.y, p.z), QT, S3.set(p.w, p.h, 1)));
			const cr = p.crack;
			aCrack.setXYZW(n, cr ? cr[0] : 0, cr ? cr[1] : 0, cr ? cr[2] : 0, cr ? cr[3] : 0);
			const t = p.o.col || [0.5, 0.6, 0.65];
			aGlass.setXYZW(n, 0.35 + t[0] * 0.4, 0.42 + t[1] * 0.4, 0.5 + t[2] * 0.35, p.plan ? -1 : p.lit || 0);
			p.slot = n++;
		}
		mesh.count = n;
		mesh.instanceMatrix.needsUpdate = true; aCrack.needsUpdate = true; aGlass.needsUpdate = true;
	}

	// ---------- breaking ----------
	// where a ray meets the nearest whole pane before max: { t, pane, n }
	function ray(o, d, max) {
		let best = null;
		for (const p of panes) {
			const den = d.x * p.nx + d.z * p.nz;
			if (Math.abs(den) < 1e-4) continue;
			const t = ((p.x - o.x) * p.nx + (p.z - o.z) * p.nz) / den;
			if (t < 0 || t > (best?.t ?? max)) continue;
			const hx = o.x + d.x * t - p.x, hy = o.y + d.y * t - p.y, hz = o.z + d.z * t - p.z;
			const u = hx * p.nz - hz * p.nx;
			if (Math.abs(u) > p.w / 2 || Math.abs(hy) > p.h / 2) continue;
			best = { t, pane: p, u: u / p.w + 0.5, v: hy / p.h + 0.5, n: new THREE.Vector3(p.nx, 0, p.nz) };
		}
		return best;
	}
	// a pane struck at (u, v) of it (0..1): cracked, or (hard enough, or cracked already) broken
	function strike(p, u, v, power = 30, push = null) {
		if (!p || p.gone) return false;
		if (p.crack || power >= 50) return shatter(p, push);
		p.crack = [u, v, Math.min(1, 0.45 + power / 60), Math.random() * 100];
		sounds.crack(p);
		upload();
		return false;
	}
	// (later: many at once, the panes put away and drawn again once, by the caller)
	function shatter(p, push = null, later = false) {
		if (p.gone) return false;
		p.gone = true;
		const area = p.w * p.h;
		debris.shatter(p.x, p.y, p.z, p.w / 2, p.h / 2, p.nx, p.nz, Math.min(isPhone ? 30 : 70, Math.round(8 + area * 7)), push);
		sounds.glass(p, area);
		// (kept: the building's broken panes, by face and place)
		const rec = store.get(p.id) || ctx.record(p.o);
		rec.g = rec.g || [];
		if (rec.g.length < 96) rec.g.push([p.f, +((p.u0 + p.u1) / 2).toFixed(2), +((p.y0 + p.y1) / 2).toFixed(2)]);
		rec.t0 = rec.t0 ?? store.now();
		store.put(p.id, rec);
		ctx.damaged?.(p.id, rec);
		if (p.plan) openPlan(p.plan);
		byKey.delete(p.key);
		if (!later) settle();
		return true;
	}
	function settle() {
		panes = panes.filter((q) => !q.gone);
		upload();
	}
	// a blast: panes within r break, out to 2.4 r crack
	function blast(at, r) {
		let n = 0;
		for (const p of panes) {
			const d = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
			if (d < r * 1.1) { shatter(p, [(p.x - at.x) / d * 6, 2, (p.z - at.z) / d * 6], true); n++; }
			else if (d < r * 2.4 && !p.crack) { p.crack = [Math.random(), Math.random(), 0.6 + Math.random() * 0.4, Math.random() * 100]; n++; }
		}
		if (n) settle();
		return n;
	}
	// a body or a car moving into the panes: (x, z) its middle, its half width across its
	// motion, its velocity, its mass; panes it meets break if it has the momentum, and the
	// first of them says whether it was through
	function bodyInto(x, y0, y1, z, half, vx, vz, mass, reach = 0.6) {
		const sp = Math.hypot(vx, vz);
		if (sp < 2) return 0;
		let n = 0, cracked = false;
		for (const p of panes) {
			if (p.gone || Math.abs(p.x - x) > p.w + half + 3 || Math.abs(p.z - z) > p.w + half + 3) continue;
			const into = -(vx * p.nx + vz * p.nz);
			if (into < 1.5) continue;
			const dn = (x - p.x) * p.nx + (z - p.z) * p.nz;
			if (dn < -0.3 || dn > reach + half * 0.2) continue;
			const u = (x - p.x) * p.nz - (z - p.z) * p.nx;
			if (Math.abs(u) > p.w / 2 + half) continue;
			if (p.y + p.h / 2 < y0 + 0.4 || p.y - p.h / 2 > y1) continue;
			// (momentum against the pane's: a sprint breaks a shop front; a car at a walking pace
			// cracks it, at a jog it is through)
			const need = 420 + p.w * p.h * 60;
			if (mass * into > need) { shatter(p, [vx * 0.6, 0.5, vz * 0.6], true); n++; }
			else if (mass * into > need * 0.45 && !p.crack) { p.crack = [0.5 + u / p.w, Math.min(0.9, Math.max(0.1, (y0 + 1 - (p.y - p.h / 2)) / p.h)), 0.7, Math.random() * 100]; sounds.crack(p); cracked = true; }
		}
		if (n) settle(); else if (cracked) upload();
		return n;
	}

	function update(cam, nightK) {
		const city = ctx.city();
		const list = city?.nearList?.();
		const I = ctx.interiors();
		const sig = I?.live ? [...I.live.values()].filter((B) => B.ready).map((B) => B.key).join('|') : '';
		if (list !== lastList || sig !== liveSig || dirty || Math.hypot(cam.position.x - bx, cam.position.z - bz) > 35) { lastList = list; liveSig = sig; rebuild(cam); }
		const U = mat.uniforms;
		U.uNight.value = nightK;
		U.uSunDir.value.copy(shared.uSunDir.value);
		U.uSunColor.value.copy(shared.uSunColor.value);
		const amb = shared.uAmbient.value;
		U.uZenith.value.setRGB(amb.r * 0.9 + 0.05, amb.g * 1.0 + 0.08, amb.b * 1.25 + 0.12);
		U.uHorizon.value.setRGB(amb.r * 1.5 + 0.1, amb.g * 1.5 + 0.1, amb.b * 1.5 + 0.12);
	}
	return { mesh, update, ray, strike, shatter, blast, bodyInto, frontOf, panes: () => panes, refresh: () => { dirty = true; }, count: () => ({ panes: panes.length, drawn: mesh.count, cracked: panes.filter((p) => p.crack).length }) };
}
