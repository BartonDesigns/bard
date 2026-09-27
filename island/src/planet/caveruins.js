// The ruins under the hill. Whoever lived here before built a hall in the great cave: a
// stepped platform with a colonnade on it, a free-standing arch, a carved gate sealed into
// the far wall, standing stones cut with rows of glyphs whose inlays still glow faintly,
// and the head of a colossal statue lying where it fell. Columns have broken and toppled,
// their drums rolled across the floor; blocks lie where they dropped. The style is the
// world's own (profile.civ.ruin): limestone, coral, sandstone, ice, basalt, rusted iron,
// crystal-set stone or dark alien metal.
//
// All the stone is one merged mesh with one material; the glowing crystal inlays another.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rockDetail, TRI_GLSL, crystalMaterial } from './cavemat.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';

const STYLES = {
	stone: { col: [0.64, 0.61, 0.55], rough: 0.88, metal: 0, column: 'fluted', moss: 0.6 },
	coral: { col: [0.82, 0.68, 0.64], rough: 0.9, metal: 0, column: 'bulb', moss: 0.15, pores: 1 },
	sandstone: { col: [0.82, 0.60, 0.40], rough: 0.92, metal: 0, column: 'square', moss: 0 },
	ice: { col: [0.70, 0.84, 0.95], rough: 0.14, metal: 0, column: 'fluted', moss: 0, ice: 1 },
	basalt: { col: [0.15, 0.14, 0.135], rough: 0.8, metal: 0, column: 'hex', moss: 0 },
	rust: { col: [0.40, 0.23, 0.13], rough: 0.75, metal: 0.45, column: 'beam', moss: 0.2, rust: 1 },
	crystal: { col: [0.72, 0.68, 0.80], rough: 0.7, metal: 0, column: 'crystal', moss: 0 },
	metal: { col: [0.30, 0.32, 0.35], rough: 0.38, metal: 0.8, column: 'panel', moss: 0, panel: 1 },
};

// ---------- the stone ----------
function ruinMaterial(L, st, glow) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: st.rough, metalness: st.metal });
	const U = { uDetail: { value: rockDetail() }, uGlyphC: { value: new THREE.Color(...glow) }, uMoss: { value: st.moss }, uIce: { value: st.ice || 0 }, uRust: { value: st.rust || 0 }, uPanel: { value: st.panel || 0 }, uPores: { value: st.pores || 0 } };
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = 'attribute float aGlyph;\nvarying float vGlyph;\nvarying vec3 vSN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlyph = aGlyph;\nvSN = normalize(mat3(modelMatrix) * normal);');
		sh.fragmentShader = `uniform sampler2D uDetail; uniform vec3 uGlyphC; uniform float uMoss, uIce, uRust, uPanel, uPores, uTime;
			varying float vGlyph; varying vec3 vSN;
			${TRI_GLSL}
			float gSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
			// one carved sign per cell: strokes between points of a 3x3 lattice, sometimes a ring
			float glyph(vec2 uv){
				vec2 cell = floor(uv), f = fract(uv);
				float h0 = rH(vec3(cell, 7.0));
				// rows with a line between them, and gaps between words
				if (h0 < 0.14 || f.y < 0.08 || f.y > 0.92) return 0.0;
				float d = 1.0;
				for (int i = 0; i < 4; i++) {
					if (i == 3 && h0 < 0.55) break;
					float a = rH(vec3(cell, float(i) * 3.1 + 1.0)), b = rH(vec3(cell, float(i) * 5.7 + 2.0));
					vec2 A = vec2(floor(a * 3.0), floor(fract(a * 7.0) * 3.0)) * 0.3 + 0.2;
					vec2 B = vec2(floor(b * 3.0), floor(fract(b * 7.0) * 3.0)) * 0.3 + 0.2;
					if (length(A - B) < 0.1) B = vec2(0.5);
					d = min(d, gSeg(f, A, B));
				}
				if (rH(vec3(cell, 9.0)) > 0.78) d = min(d, abs(length(f - 0.5) - 0.22));
				return 1.0 - smoothstep(0.03, 0.06, d);
			}
			float gInlay = 0.0;
			` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				vec3 sn = normalize(vSN);
				float h1, c1, h2, c2;
				vec3 d1 = rTri(vCvW, sn, 0.5, h1, c1);
				vec3 d2 = rTri(vCvW + 5.3, sn, 0.13, h2, c2);
				vec3 snD = normalize(sn + d1 * 0.35 + d2 * 0.25);
				vec3 col = diffuseColor.rgb * (0.8 + 0.35 * h1) * (0.85 + 0.25 * h2);
				// pores and pits (coral), weathering streaks running down, big cracks
				col *= 1.0 - uPores * smoothstep(0.55, 0.75, h1) * 0.5;
				float streak = texture2D(uDetail, vec2(vCvW.x * 0.3 + vCvW.z * 0.2, vCvW.y * 0.03)).b;
				col *= 0.82 + 0.3 * streak;
				col *= 1.0 - smoothstep(0.35, 0.7, c2) * 0.7;
				// dust and moss settle on what faces up
				float upK = smoothstep(0.5, 0.95, snD.y);
				col = mix(col, col * 0.6 + vec3(0.05, 0.05, 0.04), upK * 0.25);
				col = mix(col, vec3(0.1, 0.16, 0.06) * (0.7 + 0.6 * h1), upK * uMoss * smoothstep(0.45, 0.7, h2));
				// rust: orange bloom and dark scale on the iron
				col = mix(col, mix(vec3(0.45, 0.2, 0.07), vec3(0.16, 0.08, 0.05), h1), uRust * smoothstep(0.35, 0.65, h2 + streak * 0.3));
				// panel seams on the metal
				if (uPanel > 0.0) {
					vec3 g = abs(fract(vCvW * vec3(0.6, 0.45, 0.6)) - 0.5);
					float seam = 1.0 - smoothstep(0.47, 0.49, max(max(g.x * (1.0 - abs(sn.x)), g.y * (1.0 - abs(sn.y))), g.z * (1.0 - abs(sn.z))));
					col *= 0.7 + 0.3 * seam;
				}
				// paving: the platform's upper faces are laid in courses
				if (vGlyph > 1.5 && upK > 0.5) {
					vec2 pv = vCvW.xz * vec2(1.1, 0.8);
					pv.x += floor(pv.y) * 0.5;
					vec2 e = abs(fract(pv) - 0.5);
					col *= 0.72 + 0.28 * smoothstep(0.47, 0.44, max(e.x, e.y));
					col *= 0.9 + 0.2 * rH(vec3(floor(pv), 3.0));
				}
				// glyphs, cut into the upright faces, their channels holding a glowing inlay
				if (vGlyph > 0.5 && vGlyph < 1.5 && abs(sn.y) < 0.5) {
					vec2 gp = abs(sn.x) > abs(sn.z) ? vCvW.zy : vCvW.xy;
					// in registers of a few lines, plain stone between
					float reg = step(0.18, fract(gp.y / 2.2)) * step(fract(gp.y / 2.2), 0.72);
					float g = glyph(gp / vec2(0.26, 0.3)) * reg;
					col *= 1.0 - g * 0.6;
					gInlay = g;
				}
				diffuseColor.rgb = col;`)
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				normal = normalize((viewMatrix * vec4(snD, 0.0)).xyz);`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				totalEmissiveRadiance += uGlyphC * gInlay * (0.5 + 0.5 * sin(uTime * 0.7 + vCvW.y * 0.8 + vCvW.x * 0.2)) * (1.0 - cvSun * 0.9) * 0.7;
				// ice: lit from within
				totalEmissiveRadiance += uIce * vec3(0.25, 0.5, 0.75) * (0.04 + 0.12 * pow(1.0 - abs(dot(cvWorldN(normal), normalize(cameraPosition - vCvW))), 3.0)) * (1.0 - cvSun);`);
	};
	m.customProgramCacheKey = () => 'ruinstone';
	return L.lit(m, 'ruin');
}

// ---------- building blocks ----------
function bevelBox(w, h, d, rad = 0.06) { return new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 1.5 ? 2 : 1, Math.min(rad, w / 3, h / 3, d / 3)); }
// a column shaft: tapering, swelling a little a third of the way up, fluted, in drums
function shaftGeo(r, h, style) {
	if (style === 'square' || style === 'panel') {
		const g = new THREE.BoxGeometry(r * 1.7, h, r * 1.7, 1, Math.max(1, Math.round(h / 1.2)), 1);
		g.translate(0, h / 2, 0);
		const p = g.attributes.position;
		for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h, k = 1 - 0.08 * t; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
		return g;
	}
	const flutes = style === 'fluted' ? 20 : 0, radial = style === 'hex' ? 6 : flutes ? flutes * 4 : 24;
	const rows = Math.max(2, Math.round(h / 0.4));
	const g = new THREE.CylinderGeometry(r, r, h, radial, rows, true);
	g.translate(0, h / 2, 0);
	const p = g.attributes.position, drum = 1.1 + (r * 7 % 0.5);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), z = p.getZ(i), y = p.getY(i), t = y / h, a = Math.atan2(z, x);
		let k = 1 - 0.12 * t + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.5));
		if (flutes) { const f = ((a / (2 * Math.PI) * flutes) % 1 + 1) % 1; k -= 0.06 * Math.sqrt(Math.max(0, 1 - (f * 2 - 1) ** 2)); }
		if (style === 'bulb') k *= 1 + 0.12 * Math.sin(t * h * 2.2) ** 2;
		// the joints between drums
		const j = (y % drum) / drum;
		if (style !== 'hex' && (j < 0.03 || j > 0.97)) k *= 0.965;
		p.setX(i, x * k); p.setZ(i, z * k);
	}
	g.computeVertexNormals();
	return g;
}
// a broken end: a jagged disc
function breakGeo(r, rough, rnd) {
	const g = new THREE.CircleGeometry(r, 16, 0);
	g.rotateX(-Math.PI / 2);
	const p = g.attributes.position;
	for (let i = 0; i < p.count; i++) p.setY(i, (rnd() - 0.3) * rough * (Math.hypot(p.getX(i), p.getZ(i)) / r + 0.4));
	g.computeVertexNormals();
	return g;
}
function lathe(profile, segs) { const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segs); g.computeVertexNormals(); return g; }
function iBeam(w, h, len) {
	const s = new THREE.Shape(), t = w * 0.12, f = w * 0.14;
	s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, -h / 2 + f); s.lineTo(t / 2, -h / 2 + f); s.lineTo(t / 2, h / 2 - f); s.lineTo(w / 2, h / 2 - f);
	s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, h / 2 - f); s.lineTo(-t / 2, h / 2 - f); s.lineTo(-t / 2, -h / 2 + f); s.lineTo(-w / 2, -h / 2 + f); s.closePath();
	const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
	g.rotateX(-Math.PI / 2);
	return g;
}

export function* buildRuins(ctx) {
	const { chamber: c, group, L, civ, rng: r, rockFloor, addGlow, props, glowC, crystalC, field, isPhone } = ctx;
	const style = civ.ruin in STYLES ? civ.ruin : 'stone';
	const st = STYLES[style];
	const pieces = [], glowPieces = [];
	const base = new THREE.Color(...st.col);
	const tmpC = new THREE.Color();
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
	// a piece of stone into the one mesh: placed, tinted a little its own, carved or plain
	function add(geo, x, y, z, rx, ry, rz, flag = 0, tint = 1, sx = 1, sy = 1, sz = 1) {
		let g = geo.index ? geo.toNonIndexed() : geo.clone();
		for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
		if (!g.attributes.normal) g.computeVertexNormals();
		M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
		g.applyMatrix4(M);
		const n = g.attributes.position.count;
		const k = tint * (0.86 + r() * 0.24);
		tmpC.copy(base).multiplyScalar(k);
		tmpC.offsetHSL((r() - 0.5) * 0.02, 0, 0);
		const col = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) { col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b; }
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aGlyph', new THREE.BufferAttribute(new Float32Array(n).fill(flag), 1));
		pieces.push(g);
		return g;
	}
	// the chamber's own frame: u along its long axis
	const W = (u, v) => ({ x: c.x + u * c.cos - v * c.sin, z: c.z + u * c.sin + v * c.cos });
	const yawOf = (a) => -c.rot + a;
	const floorAt = (x, z) => rockFloor(x, z, c.fy + 4) ?? c.fy;
	const solidAt = (u, v, y) => { const p = W(u, v); return field.cave(p.x, y, p.z) >= 0; };

	// ---------- the platform: three steps up to a paved floor ----------
	const pu = c.rx * 0.34, pv = c.rz * 0.3;
	let pBase = 1e9;
	for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const p = W(a * (pu + 1.4), b * (pv + 1.4)); pBase = Math.min(pBase, floorAt(p.x, p.z)); }
	pBase -= 0.25;
	const STEP = 0.4;
	const pc = W(0, 0);
	for (let k = 0; k < 3; k++) {
		const grow = (2 - k) * 0.5;
		add(bevelBox((pu + grow) * 2, STEP + 0.25, (pv + grow) * 2, 0.05), pc.x, pBase + STEP * k + (STEP - 0.25) / 2 + 0.125, pc.z, 0, yawOf(0), 0, 2, 0.95);
	}
	const pTop = pBase + STEP * 3;
	props.push({
		floor: (x, z, y) => {
			const dx = x - c.x, dz = z - c.z, u = Math.abs(dx * c.cos + dz * c.sin), v = Math.abs(-dx * c.sin + dz * c.cos);
			for (let k = 2; k >= 0; k--) { const grow = (2 - k) * 0.5; if (u < pu + grow && v < pv + grow) { const top = pBase + STEP * (k + 1); return y > top - 1.2 ? top : null; } }
			return null;
		},
	});

	// ---------- the colonnade ----------
	const colR = style === 'hex' ? 0.5 : 0.42, colH = Math.min(c.h * 0.5, 6.5);
	const nCol = Math.max(4, Math.round(pu * 2 / 2.6));
	function column(x, y, z, h, broken, yaw) {
		const s = st.column;
		if (s === 'beam') {
			add(iBeam(colR * 1.6, colR * 1.8, broken ? h * broken : h), x, y, z, 0, yaw, 0);
			add(bevelBox(colR * 3, 0.12, colR * 3, 0.02), x, y + 0.06, z, 0, yaw, 0, 0, 0.7);
			return;
		}
		if (s === 'crystal') {
			// a pillar of living crystal on a stone foot
			add(bevelBox(colR * 3, 0.5, colR * 3), x, y + 0.25, z, 0, yaw, 0);
			const g = new THREE.CylinderGeometry(colR * 0.9, colR, (broken ? h * broken : h) - 0.5, 6, 1);
			g.translate(0, (broken ? h * broken : h) / 2 + 0.25, 0);
			glowPieces.push(g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z)));
			return;
		}
		// the foot: a square plinth and a rounded base
		add(bevelBox(colR * 2.9, 0.28, colR * 2.9, 0.04), x, y + 0.14, z, 0, yaw, 0);
		if (s !== 'square' && s !== 'panel' && s !== 'hex') add(lathe([[0, 0], [colR * 1.3, 0], [colR * 1.32, 0.08], [colR * 1.18, 0.2], [colR * 1.05, 0.26], [0, 0.26]], 24), x, y + 0.28, z, 0, 0, 0);
		const sh = broken ? Math.max(0.6, (h - 1) * broken) : h - 1.1;
		add(shaftGeo(colR, sh, s), x, y + 0.5, z, 0, yaw, 0);
		if (broken) { add(breakGeo(colR * 0.9, colR * 0.5, r), x, y + 0.5 + sh, z, 0, r() * 6, 0); return; }
		// the head: a cushion and a square slab (a flared bell on the sandstone)
		if (s === 'square') add(lathe([[colR * 0.8, 0], [colR * 1.0, 0.15], [colR * 1.45, 0.45], [colR * 1.5, 0.55], [0, 0.55]], 16), x, y + 0.5 + sh, z, 0, 0, 0);
		else if (s !== 'hex' && s !== 'panel') add(lathe([[colR * 0.9, 0], [colR * 1.05, 0.08], [colR * 1.3, 0.22], [colR * 1.35, 0.3], [0, 0.3]], 24), x, y + 0.5 + sh, z, 0, 0, 0);
		add(bevelBox(colR * 3, 0.3, colR * 3, 0.04), x, y + 0.5 + sh + (s === 'square' ? 0.7 : 0.45), z, 0, yaw, 0);
	}
	for (const side of [-1, 1]) {
		const row = [];
		for (let i = 0; i < nCol; i++) {
			const u = -pu + 0.9 + i * ((pu * 2 - 1.8) / (nCol - 1)), v = side * (pv - 0.9);
			const p = W(u, v);
			const roll = r();
			// most stand; some broken off, a few fallen
			const status = roll < 0.5 ? 'whole' : roll < 0.8 ? 'broken' : 'fallen';
			row.push({ u, v, p, status });
			if (status === 'fallen') {
				// the drums rolled apart across the floor, the base still in place
				add(bevelBox(colR * 2.9, 0.28, colR * 2.9, 0.04), p.x, pTop + 0.14, p.z, 0, yawOf(0), 0);
				const dir = r() * 6.283, nd = 3 + Math.floor(r() * 2);
				for (let k = 0; k < nd; k++) {
					const d = 1.2 + k * 1.25 + r() * 0.3, x = p.x + Math.cos(dir) * d, z = p.z + Math.sin(dir) * d;
					const onPlat = (() => { const dx = x - c.x, dz = z - c.z; return Math.abs(dx * c.cos + dz * c.sin) < pu && Math.abs(-dx * c.sin + dz * c.cos) < pv; })();
					const fy = onPlat ? pTop : floorAt(x, z);
					add(shaftGeo(colR, 1.15, st.column === 'beam' ? 'square' : st.column === 'crystal' ? 'fluted' : st.column), x, fy + colR * 0.85, z, Math.PI / 2, 0, -dir + (r() - 0.5) * 0.3 + Math.PI / 2, 0, 1, 1, 1, 1);
					props.push({ x, z, r: 0.7, y0: fy, y1: fy + 0.9 });
				}
				continue;
			}
			column(p.x, pTop, p.z, colH, status === 'broken' ? 0.25 + r() * 0.55 : 0, yawOf(0));
			yield;
			props.push({ x: p.x, z: p.z, r: colR + 0.15, y0: pTop - 0.5, y1: pTop + colH });
		}
		// the lintels still spanning the columns that stand
		for (let i = 0; i < row.length - 1; i++) {
			if (row[i].status !== 'whole' || row[i + 1].status !== 'whole' || r() < 0.2) continue;
			const a = row[i].p, b = row[i + 1].p, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z) + colR * 2.4;
			if (st.column === 'beam') add(iBeam(0.35, 0.5, len), mx - (b.x - a.x) / Math.hypot(b.x - a.x, b.z - a.z) * len / 2, pTop + colH + 0.25, mz - (b.z - a.z) / Math.hypot(b.x - a.x, b.z - a.z) * len / 2, 0, Math.atan2(b.x - a.x, b.z - a.z), 0);
			else {
				add(bevelBox(len, 0.7, colR * 2.2, 0.05), mx, pTop + colH + 0.3, mz, 0, yawOf(0), 0, 1);
				add(bevelBox(len, 0.35, colR * 2.6, 0.04), mx, pTop + colH + 0.85, mz, 0, yawOf(0), 0, 0, 0.9);
			}
		}
	}

	yield;
	// ---------- the gate in the far wall ----------
	// walk out along the axis until the rock: the gate stands against it, facing the hall
	let gu = pu + 3;
	for (; gu < c.rx * 1.3; gu += 0.5) if (solidAt(gu, 0, c.fy + 4)) break;
	gu -= 1.6;
	{
		const g = W(gu, 0), gy = floorAt(g.x, g.z) - 0.3;
		const face = yawOf(-Math.PI / 2);
		const at = (du, dv) => W(gu + du, dv);
		// a landing in front of it, and steps down to the hall
		const landU = gu - 1.8, lw = 7.5;
		const land = W(landU, 0);
		const ly = gy;
		add(bevelBox(3.2, 1.2, lw, 0.05), land.x, ly + 0.6, land.z, 0, yawOf(0), 0, 2);
		for (let k = 0; k < 3; k++) { const s = W(landU - 1.6 - k * 0.45 - 0.2, 0); add(bevelBox(0.5, 0.4 * (3 - k), lw - 1 - k * 0.3, 0.04), s.x, ly + 0.2 * (3 - k), s.z, 0, yawOf(0), 0, 2, 0.95); }
		props.push({
			floor: (x, z, y) => {
				const dx = x - c.x, dz = z - c.z, u = dx * c.cos + dz * c.sin, v = Math.abs(-dx * c.sin + dz * c.cos);
				if (v > lw / 2) return null;
				if (u > landU - 1.6 && u < gu + 0.2) return y > ly + 1.2 - 1.2 ? ly + 1.2 : null;
				for (let k = 0; k < 3; k++) { const u0 = landU - 1.6 - k * 0.45 - 0.45; if (u > u0 && u <= u0 + 0.45 + (k === 0 ? 0 : 0)) { const top = ly + 0.4 * (3 - k); return y > top - 1.2 ? top : null; } }
				return null;
			},
		});
		// the jambs, carved; the lintel and its cornice; the sealed door between
		const top = ly + 1.2;
		for (const s of [-1, 1]) {
			const j = at(0, s * 2.6);
			add(bevelBox(1.6, 7, 1.5, 0.06), j.x, top + 3.5, j.z, 0, face, 0, 1);
			props.push({ x: j.x, z: j.z, r: 1, y0: top, y1: top + 7 });
		}
		const li = at(0, 0);
		add(bevelBox(2.0, 1.4, 7.4, 0.06), li.x, top + 7.7, li.z, 0, yawOf(0), 0, 1);
		add(bevelBox(2.4, 0.5, 8.2, 0.05), li.x, top + 8.65, li.z, 0, yawOf(0), 0, 0, 0.92);
		const door = at(0.5, 0);
		add(bevelBox(0.6, 6.9, 3.8, 0.03), door.x, top + 3.45, door.z, 0, yawOf(0), 0, 1, 0.55);
		props.push({ x: door.x, z: door.z, r: 1.9, y0: top, y1: top + 7 });
		// the seal: a ring of inlay on the door, glowing
		const ring = new THREE.TorusGeometry(1.2, 0.07, 8, 48);
		ring.rotateY(Math.PI / 2);
		const ringIn = new THREE.TorusGeometry(0.55, 0.05, 8, 32);
		ringIn.rotateY(Math.PI / 2);
		const rp = at(0.15, 0);
		for (const g2 of [ring, ringIn]) { g2.applyMatrix4(new THREE.Matrix4().makeRotationY(yawOf(0))); g2.translate(rp.x, top + 3.6, rp.z); glowPieces.push(g2); }
		addGlow(rp.x - c.cos * 1.2, top + 3.6, rp.z - c.sin * 1.2, 12, glowC, 1.2);
	}

	yield;
	// ---------- the arch at the other end ----------
	{
		const au = -pu - 3.2, a0 = W(au, 0), ay = floorAt(a0.x, a0.z) - 0.2;
		const span = 3, pierH = 4.2;
		for (const s of [-1, 1]) {
			const p = W(au, s * span);
			add(bevelBox(1.2, pierH, 1.2, 0.05), p.x, ay + pierH / 2, p.z, 0, yawOf(0), 0, 1);
			add(bevelBox(1.5, 0.35, 1.5, 0.05), p.x, ay + pierH + 0.17, p.z, 0, yawOf(0), 0, 0, 0.9);
			props.push({ x: p.x, z: p.z, r: 0.85, y0: ay, y1: ay + pierH });
		}
		// the voussoirs, one missing where it broke, lying below
		const nv = 13, rIn = span - 0.6, rOut = span + 0.6, gap = Math.floor(r() * 4) + 8;
		for (let i = 0; i < nv; i++) {
			const t0 = i / nv * Math.PI, t1 = (i + 1) / nv * Math.PI, tm = (t0 + t1) / 2;
			const w = (rIn + rOut) / 2 * (t1 - t0) - 0.04, rm = (rIn + rOut) / 2;
			if (i === gap || i === gap + 1) {
				const f = W(au + (r() - 0.5) * 2, (Math.cos(tm) * rm) + (r() - 0.5));
				add(bevelBox(0.9, w, rOut - rIn, 0.05), f.x, floorAt(f.x, f.z) + 0.3, f.z, r() * 3, r() * 3, r() * 3);
				continue;
			}
			const p = W(au, Math.cos(tm) * rm);
			const yy = ay + pierH + 0.35 + Math.sin(tm) * rm;
			// a wedge, turned about the arch's own axis to point at its centre
			const g = add(bevelBox(0.9, w, (rOut - rIn) * (i === 6 ? 1.15 : 1), 0.05), p.x, yy, p.z, 0, yawOf(0), 0);
			const mt = new THREE.Matrix4().makeTranslation(-p.x, -yy, -p.z), mr = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(c.cos, 0, c.sin), -(tm - Math.PI / 2)), mb = new THREE.Matrix4().makeTranslation(p.x, yy, p.z);
			g.applyMatrix4(mt); g.applyMatrix4(mr); g.applyMatrix4(mb);
		}
	}

	yield;
	// ---------- standing stones with glyphs, some fallen ----------
	const nStelae = 5;
	for (let i = 0; i < nStelae; i++) {
		const a = (i / nStelae) * Math.PI * 2 + r() * 0.5, q = 0.66;
		const u = Math.cos(a) * c.rx * q, v = Math.sin(a) * c.rz * q;
		if (Math.abs(v) < pv + 2 && Math.abs(u) > pu) continue;
		const p = W(u, v), y = floorAt(p.x, p.z) - 0.3;
		const face = Math.atan2(c.x - p.x, c.z - p.z);
		if (r() < 0.25) {
			add(bevelBox(1.5, 0.5, 3.2, 0.05), p.x, y + 0.45, p.z, (r() - 0.5) * 0.2, face, (r() - 0.5) * 0.1, 1);
			props.push({ x: p.x, z: p.z, r: 1.3, y0: y, y1: y + 0.8 });
		} else {
			add(bevelBox(1.5, 3.4, 0.5, 0.05), p.x, y + 1.7, p.z, (r() - 0.5) * 0.12, face, (r() - 0.5) * 0.12, 1);
			props.push({ x: p.x, z: p.z, r: 0.9, y0: y, y1: y + 3.4 });
			addGlow(p.x + Math.sin(face) * 1.2, y + 2, p.z + Math.cos(face) * 1.2, 5, glowC, 0.35);
		}
	}

	// ---------- fallen blocks ----------
	const nb = isPhone ? 16 : 26;
	for (let i = 0; i < nb; i++) {
		const a = r() * 6.283, q = 0.25 + r() * 0.6;
		const u = Math.cos(a) * c.rx * q, v = Math.sin(a) * c.rz * q;
		if (Math.abs(u) < pu + 0.6 && Math.abs(v) < pv + 0.6) continue;
		const p = W(u, v), w = 0.6 + r() * 1.1, h = 0.5 + r() * 0.7, d = 0.5 + r() * 0.9;
		const y = floorAt(p.x, p.z) + h * 0.3 - 0.15;
		add(bevelBox(w, h, d, 0.06), p.x, y, p.z, (r() - 0.5) * 0.4, r() * 6.283, (r() - 0.5) * 0.4, r() < 0.2 ? 1 : 0);
		if (w > 0.9) props.push({ x: p.x, z: p.z, r: Math.max(w, d) * 0.5, y0: y - h, y1: y + h * 0.5 });
		if (i % 6 === 5) yield;
	}

	// ---------- the mesh ----------
	yield;
	const geo = mergeGeometries(pieces, false);
	geo.computeBoundingSphere();
	const mat = ruinMaterial(L, st, glowC);
	const mesh = new THREE.Mesh(geo, mat);
	mesh.userData.material175 = st.metal > 0.3 ? 'metal' : 'stone';
	group.add(mesh);
	if (glowPieces.length) {
		for (const g of glowPieces) { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); }
		const gg = mergeGeometries(glowPieces.map((g) => (g.index ? g.toNonIndexed() : g)), false);
		const cm = crystalMaterial(L, style === 'crystal' ? crystalC : glowC);
		cm.emissiveIntensity = 1.4;
		group.add(new THREE.Mesh(gg, cm));
	}
	// a colossal head, lying where it fell (made from a person's own face, in stone)
	let head = null;
	(async () => {
		try {
			const A = await loadPeopleAssets();
			const d = personDNA((c.x * 131 + c.z * 71) >>> 0, { age: 45 });
			const Pp = buildPerson(A, d);
			const src = Pp.skin.geometry, pos = src.attributes.position, idx = src.index;
			const neck = Pp.rest.heads[Pp.map.neck01].y + 0.02;
			const out = [];
			for (let i = 0; i < idx.count; i += 3) {
				const a = idx.getX(i), b = idx.getX(i + 1), e = idx.getX(i + 2);
				if (pos.getY(a) > neck && pos.getY(b) > neck && pos.getY(e) > neck) for (const v of [a, b, e]) out.push(pos.getX(v), pos.getY(v), pos.getZ(v));
			}
			// (the person's own meshes are not needed)
			Pp.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
			g.computeBoundingBox();
			const bb = g.boundingBox, cy = (bb.min.y + bb.max.y) / 2;
			g.translate(0, -cy, 0);
			g.computeVertexNormals();
			const sc = 6.5;
			// on its side, cheek to the floor, gazing across the hall
			const hp = W(pu * 0.3, -pv - 3.6 - r()), hy = floorAt(hp.x, hp.z);
			const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(0), gl = new Float32Array(n).fill(0);
			for (let i = 0; i < n; i++) { col[i * 3] = base.r * 0.95; col[i * 3 + 1] = base.g * 0.95; col[i * 3 + 2] = base.b * 0.95; }
			g.setAttribute('color', new THREE.BufferAttribute(col, 3));
			g.setAttribute('aGlyph', new THREE.BufferAttribute(gl, 1));
			head = new THREE.Mesh(g, mat);
			head.scale.setScalar(sc);
			head.rotation.set(0, yawOf(0.4 + r() * 0.5), Math.PI / 2 - 0.15);
			head.position.set(hp.x, hy + (bb.max.x - bb.min.x) * sc * 0.36, hp.z);
			group.add(head);
			props.push({ x: hp.x, z: hp.z, r: 1.3, y0: hy, y1: hy + 2 });
		} catch (e) { console.warn('[underworld] statue', e); }
	})();

	// a few crystals grown over the old stones, and light from the platform's heart
	addGlow(pc.x, pTop + 2.5, pc.z, 16, glowC, 0.5);
	return { update() {}, mesh, head: () => head };
}
