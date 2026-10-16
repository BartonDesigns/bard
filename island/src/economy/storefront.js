// The businesses' fronts, drawn: the glazed shopfront on the facade (its frame, mullions,
// kick plate and glazed door; through the glass a room with the business's goods on its
// shelves, its counter and the person behind it, the tables and who sits at them, the
// racks and the mannequins, the cars on the lifts), its roller shutter coming down after
// hours, the office window with its blinds, the workshop's roll-up doors; the fascia
// behind the name board (economy/layer.js draws the boards); the awnings in their colours
// and stripes; and what stands out on the pavement (A-frame boards, tables and their
// chairs, umbrellas, planters, a bike rack, a parking sign, pallets by the loading door).
//
// Everything is instanced: one draw for every shopfront (the room behind the glass is
// worked out in its fragment shader, nothing is modelled inside), one for the fascias, one
// for the awnings, one per kind of pavement thing. The lit, open and shutter state of each
// front is an instance attribute, refreshed once a game minute from economy/frontage.js;
// nothing is allocated per frame.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stateAt } from './frontage.js';
import { qualityNow, tierNow } from '../world/governor.js';

// ---------- the room behind the glass ----------
const GLASS_VS = /* glsl */`
	attribute vec4 aDim; attribute vec4 aShop; attribute vec4 aState; attribute vec3 aFrame;
	varying vec3 vPosM; varying vec3 vCamM; varying vec4 vDim; varying vec4 vShop; varying vec4 vState; varying vec3 vFrame;`;
const GLASS_VS_MAIN = /* glsl */`
	{
		mat4 IM = modelMatrix * instanceMatrix;
		vec3 o4 = (IM * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
		vec3 ax = normalize((IM * vec4(1.0, 0.0, 0.0, 0.0)).xyz), ay = normalize((IM * vec4(0.0, 1.0, 0.0, 0.0)).xyz), az = normalize((IM * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
		vec3 dc = cameraPosition - o4;
		vCamM = vec3(dot(dc, ax), dot(dc, ay), dot(dc, az));
		vPosM = vec3(position.x * aDim.x, position.y * aDim.y, 0.0);
		vDim = aDim; vShop = aShop; vState = aState; vFrame = aFrame;
	}`;
// the fragment: a frame, a door, a shutter; inside, a box room (back wall, sides, floor,
// ceiling) with a counter, its staff, tables or racks standing in it, by display kind
const GLASS_FS = /* glsl */`
	uniform float uSfNight;
	varying vec3 vPosM; varying vec3 vCamM; varying vec4 vDim; varying vec4 vShop; varying vec4 vState; varying vec3 vFrame;
	vec3 sfInside = vec3(0.0); vec3 sfBase = vec3(0.5); float sfGlass = 0.0; float sfRough = 0.6;
	float sfH(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	vec3 sfPal(float h) {
		return h < 0.17 ? vec3(0.75, 0.2, 0.15) : h < 0.33 ? vec3(0.9, 0.72, 0.2) : h < 0.5 ? vec3(0.2, 0.45, 0.7) : h < 0.67 ? vec3(0.3, 0.6, 0.3) : h < 0.83 ? vec3(0.92, 0.9, 0.85) : vec3(0.55, 0.3, 0.55);
	}
	// shelving along a wall: boards every 0.42 m from 0.3 to 2.1, goods between them in blocks
	vec3 sfShelves(vec2 q, float seed, vec3 wall, float dense) {
		float row = floor((q.y - 0.3) / 0.42), fy = fract((q.y - 0.3) / 0.42);
		if (q.y < 0.3 || q.y > 2.2) return wall;
		if (fy < 0.07) return vec3(0.55, 0.42, 0.3);
		float w = mix(0.22, 0.09, dense), cx = floor(q.x / w), hh = sfH(vec2(cx, row) + seed * 17.0);
		float top = 0.4 + hh * 0.5;
		if (fy > top || fract(q.x / w) > 0.88) return mix(wall, vec3(0.2), 0.35);
		return sfPal(sfH(vec2(cx * 1.3, row + 7.0) + seed)) * (0.75 + 0.25 * hh);
	}
	vec3 sfWall(float kind, vec2 q, float seed, float side) {
		vec3 wall = mix(vec3(0.86, 0.83, 0.76), vec3(0.62, 0.68, 0.64), step(0.5, sfH(vec2(seed * 31.0, 2.0))));
		if (kind < 0.5) return wall;
		if (kind < 1.5 || kind > 16.5 && kind < 17.5) {
			// a cafe or a bakery: the menu board up high, shelves of cups, bags and loaves behind
			if (q.y > 1.9 && q.y < 2.6 && abs(q.x) < 1.2 && side < 0.5) return mix(vec3(0.08, 0.09, 0.08), vec3(0.9), step(0.6, sfH(floor(q * vec2(9.0, 14.0)) + seed)) * step(abs(q.x), 1.1));
			if (kind > 16.5) return sfShelves(q, seed, wall, 0.2) * vec3(1.0, 0.85, 0.6) + vec3(0.12, 0.06, 0.0);
			return q.y < 1.8 ? sfShelves(q, seed, wall, 0.5) : wall;
		}
		if (kind < 2.5) {
			// a dining room: wainscot and pictures; the kitchen's pass at the back (bright, steel)
			if (side < 0.5 && abs(q.x) < 1.1 && q.y > 1.0 && q.y < 1.6) return vec3(1.0, 0.92, 0.75) * 1.3;
			if (q.y < 0.95) return wall * 0.6;
			if (fract(q.x / 2.2) < 0.3 && q.y > 1.4 && q.y < 1.9) return sfPal(sfH(vec2(floor(q.x / 2.2), side) + seed)) * 0.7;
			return wall * vec3(1.0, 0.92, 0.82);
		}
		if (kind < 3.5) {
			// a bar: the back bar's bottles in rows on a mirror, glowing a little
			if (side < 0.5 && q.y > 1.05 && q.y < 2.3) { float b = step(0.4, fract(q.x / 0.11)) * step(fract((q.y - 1.05) / 0.4), 0.7); return mix(vec3(0.3, 0.28, 0.25), sfPal(sfH(vec2(floor(q.x / 0.11), floor(q.y / 0.4)) + seed)) * 1.2, b); }
			return wall * vec3(0.5, 0.38, 0.28);
		}
		if (kind < 4.5) {
			// a counter place: lit menu panels across the top, a clean bright wall
			if (side < 0.5 && q.y > 1.85 && q.y < 2.5) return mix(vec3(0.95, 0.9, 0.75), sfPal(sfH(vec2(floor(q.x / 0.9), 3.0) + seed)), step(0.5, fract(q.x / 0.9))) * 1.35;
			return vec3(0.92, 0.9, 0.86);
		}
		if (kind < 5.5) return sfShelves(q, seed, wall, 0.35) * (q.y < 1.0 ? vec3(0.8, 1.0, 0.6) : vec3(1.0));
		if (kind < 6.5) return sfShelves(q, seed, wall, 0.6);
		if (kind < 7.5) {
			// books: floor to ceiling, spines
			if (q.y < 2.4) { float row = floor(q.y / 0.36); float sp = floor(q.x / (0.03 + 0.03 * sfH(vec2(floor(q.x / 0.06), row)))); return fract(q.y / 0.36) < 0.08 ? vec3(0.4, 0.28, 0.18) : sfPal(sfH(vec2(sp, row) + seed)) * 0.7; }
			return wall;
		}
		if (kind < 8.5) {
			// clothes: a rail along the wall, garments hanging
			if (q.y > 0.7 && q.y < 1.75) { float g = floor(q.x / 0.12); return fract(q.x / 0.12) > 0.85 ? wall * 0.6 : sfPal(sfH(vec2(g, 4.0) + seed)) * mix(0.55, 0.9, sfH(vec2(g, 5.0))); }
			if (abs(q.y - 1.8) < 0.02) return vec3(0.7);
			return wall;
		}
		if (kind < 9.5) return q.y < 1.0 ? mix(vec3(0.25, 0.45, 0.2), sfPal(sfH(floor(q * 6.0) + seed)), step(0.55, sfH(floor(q * 9.0)))) : wall;
		if (kind < 10.5) {
			// gear: rods and paddles up the wall, boxes below
			if (q.y > 0.9 && q.y < 2.4 && fract(q.x / 0.35) < 0.12) return vec3(0.25, 0.2, 0.15);
			if (q.y > 1.4 && q.y < 1.9 && abs(fract(q.x / 1.8) - 0.5) < 0.4) return sfPal(sfH(vec2(floor(q.x / 1.8), 9.0) + seed)) * 0.8;
			return q.y < 0.9 ? sfShelves(q + vec2(0.0, 0.3), seed, wall, 0.2) : wall * vec3(0.85, 0.8, 0.72);
		}
		if (kind < 11.5) {
			// a salon: mirrors along the sides, bright
			if (side > 0.5 && q.y > 0.9 && q.y < 2.0 && fract(q.x / 1.3) < 0.75) return vec3(0.8, 0.85, 0.9) * 1.2;
			return vec3(0.95, 0.93, 0.92);
		}
		if (kind < 12.5) {
			// a laundromat: the machines along the wall, their round doors
			if (q.y < 1.0) { vec2 c = vec2(fract(q.x / 0.72) - 0.5, (q.y - 0.5) / 0.72); return length(c) < 0.28 ? vec3(0.1, 0.12, 0.15) : vec3(0.92); }
			if (q.y < 1.9) { vec2 c = vec2(fract(q.x / 0.72) - 0.5, (q.y - 1.45) / 0.72); return length(c) < 0.28 ? vec3(0.1, 0.12, 0.15) : vec3(0.88); }
			return vec3(0.8, 0.9, 0.95);
		}
		if (kind < 13.5) return q.y < 0.4 ? vec3(0.15) : side > 0.5 && q.y < 2.0 ? vec3(0.75, 0.8, 0.85) : vec3(0.3, 0.32, 0.35);
		if (kind < 14.5) return q.y > 1.0 && q.y < 1.6 && fract(q.x / 2.4) < 0.45 ? sfPal(sfH(vec2(floor(q.x / 2.4), 1.0) + seed)) * 0.6 : wall * 0.95;
		if (kind < 16.5) {
			// a garage or workshop: pegboard of tools, tyres stacked, strip lights
			if (q.y > 1.0 && q.y < 2.2 && side < 0.5) { vec2 g = fract(q * 4.0); return mix(vec3(0.6, 0.5, 0.35), vec3(0.15), step(0.8, sfH(floor(q * 4.0) + seed)) * step(0.3, g.x)); }
			if (q.y < 0.9 && side > 0.5 && fract(q.x / 0.7) < 0.9) return vec3(0.06);
			return vec3(0.55, 0.56, 0.55);
		}
		if (kind < 18.5) return q.y < 1.2 ? vec3(0.85, 0.88, 0.9) : wall * vec3(0.95, 1.0, 1.0);
		if (kind < 19.5) {
			// a guest house's hall: the keys on their board behind the desk, pictures, warm paper
			if (side < 0.5 && q.y > 1.2 && q.y < 1.7 && abs(q.x) < 0.5) return mix(vec3(0.4, 0.26, 0.15), vec3(0.85, 0.75, 0.4), step(0.6, fract(q.x / 0.1)) * step(0.5, fract(q.y / 0.12)));
			return wall * vec3(1.0, 0.9, 0.75);
		}
		if (kind < 20.5) return mix(vec3(0.05, 0.04, 0.08), sfPal(sfH(floor(q * 3.0) + seed)) * 1.6, step(0.7, sfH(floor(q * 3.0) + seed + 3.0)));
		return vec3(0.5, 0.52, 0.5);
	}
	void sfRoom() {
		float W = vDim.x, Hh = vDim.y, kick = vDim.z, doorX = vDim.w;
		float kind = vShop.x, D = vShop.y, seed = vShop.z, fk = mod(vShop.w, 4.0), hasSh = step(3.5, vShop.w);
		vec2 p = vPosM.xy;
		float lit = vState.x, shut = vState.y, open = vState.z;
		// the frame: a border, mullions, a transom bar, the kick plate
		float fr = 0.07;
		float inner = step(abs(p.x), W * 0.5 - fr) * step(p.y, Hh - fr);
		float bays = max(1.0, floor(W / 2.1 + 0.5)), bw = W / bays;
		float mull = step(abs(fract((p.x + W * 0.5) / bw + 0.5) - 0.5) * bw, 0.03);
		float trans = Hh > 2.6 ? step(abs(p.y - (Hh - 0.42)), 0.03) : 0.0;
		float doorIn = step(abs(p.x - doorX), 0.5);
		float doorFr = step(abs(p.x - doorX), 0.56) * (1.0 - step(abs(p.x - doorX), 0.48) * step(0.1, p.y) * step(p.y, 2.12));
		float kp = step(p.y, kick) * (1.0 - doorIn);
		float glass = inner * (1.0 - mull * (1.0 - doorIn)) * (1.0 - trans) * (1.0 - kp) * (1.0 - doorFr);
		if (fk > 1.5) glass = inner;                                   // (a workshop's bay: one opening)
		vec3 frameC = vFrame;
		sfBase = mix(frameC, frameC * 0.55, kp);
		sfRough = 0.45;
		// the door's handle
		if (doorIn > 0.5 && abs(abs(p.x - doorX) - 0.36) < 0.025 && p.y > 0.9 && p.y < 1.25) { sfBase = vec3(0.75, 0.72, 0.65); glass = 0.0; }
		// an office: blinds behind the glass, closed more after hours
		float blind = 0.0;
		if (fk > 0.5 && fk < 1.5) blind = step(fract(p.y / 0.06), mix(0.35, 0.85, 1.0 - open)) * step(Hh - (0.4 + 0.5 * fract(seed * 7.0)) * Hh, p.y);
		// the shutter, rolled down from the top (its box always there over a shop that has one)
		float shutTop = Hh - shut * Hh;
		float sh = step(shutTop, p.y) * step(0.001, shut);
		float boxSh = hasSh * step(Hh - 0.2, p.y);
		if (sh + boxSh > 0.5) {
			float rib = 0.5 + 0.5 * sin(p.y * 6.2831 / 0.075);
			vec3 sc = fk > 1.5 ? mix(vec3(0.7, 0.71, 0.72), frameC, 0.25) : vec3(0.52, 0.53, 0.54);
			sfBase = sc * (0.82 + 0.18 * rib) * (0.9 + 0.1 * sfH(floor(p * vec2(0.5, 3.0)) + seed));
			sfRough = 0.55; sfGlass = 0.0;
			return;
		}
		if (glass < 0.5) return;
		// the room: a ray from the eye through this point of the glass into a box D deep
		vec3 ro = vec3(p, 0.0), rd = normalize(ro - vCamM);
		if (rd.z > -0.02) rd.z = -0.02;
		float RH = max(Hh + 0.25, 2.9);
		float sx = rd.x >= 0.0 ? 1.0 : -1.0, sy = rd.y >= 0.0 ? 1.0 : -1.0;
		float tb = -D / rd.z;
		float ts = (sx * W * 0.5 - ro.x) / (rd.x + sx * 1e-4);
		float tf = ((sy > 0.0 ? RH : 0.02) - ro.y) / (rd.y + sy * 1e-4);
		float t = min(tb, min(ts, tf));
		vec3 hp = ro + rd * t;
		vec3 col;
		if (t == tf) {
			if (sy > 0.0) {
				// the ceiling and its lamps (pendants over a counter or the tables)
				vec2 c = vec2(fract(hp.x / 1.8) - 0.5, fract(hp.z / 1.6) - 0.5);
				col = vec3(0.9, 0.88, 0.84) * 0.7 + vec3(1.0, 0.85, 0.6) * smoothstep(0.12, 0.05, length(c)) * (0.6 + 2.5 * lit);
			} else {
				float chk = step(0.5, fract(floor(hp.x / 0.5) * 0.5 + floor(hp.z / 0.5) * 0.5));
				col = kind > 14.5 && kind < 16.5 ? vec3(0.42, 0.42, 0.4) : mix(vec3(0.45, 0.32, 0.22), vec3(0.72, 0.7, 0.66), step(0.5, fract(seed * 13.0))) * (0.9 + 0.1 * chk);
			}
		} else if (t == ts) col = sfWall(kind, vec2(hp.z * sx, hp.y), seed + 0.5, 1.0) * 0.85;
		else col = sfWall(kind, vec2(hp.x, hp.y), seed, 0.0);
		// the things standing in it, nearest first: a table top, mannequins or racks, the counter, its staff
		float cz = D * (kind > 1.5 && kind < 2.5 ? 0.82 : 0.55), ch = kind > 14.5 && kind < 16.5 ? 0.0 : 1.02;
		float cw = kind > 1.5 && kind < 2.5 ? 0.5 : kind > 5.5 && kind < 10.5 ? 0.35 : 0.7;
		// tables (a dining room, a cafe, a bar's stools)
		if ((kind < 3.5 && kind > 0.5) || (kind > 16.5 && kind < 17.5) || (kind > 13.5 && kind < 14.5)) {
			float ty = kind > 13.5 ? 0.76 : 0.74;
			if (rd.y < 0.0) {
				float tt = (ty - ro.y) / rd.y;
				vec3 q = ro + rd * tt;
				if (tt < t && q.z < -0.7 && q.z > -cz + 0.6 && abs(q.x) < W * 0.5 - 0.4) {
					vec2 g = vec2(q.x / 1.7, q.z / 1.6), f = fract(g) - 0.5;
					float desk = kind > 13.5 ? step(abs(f.x), 0.38) * step(abs(f.y), 0.22) : step(length(f * vec2(1.7, 1.6)), 0.36);
					if (desk > 0.5) { col = kind > 13.5 ? vec3(0.8, 0.78, 0.74) : mix(vec3(0.95, 0.94, 0.9), vec3(0.45, 0.32, 0.2), step(0.5, fract(seed * 5.0))); t = tt; hp = q; }
				}
			}
			// someone sat at a table (seen across the room, from the shoulders up)
			float pz = -1.3 - 1.6 * floor(fract(seed * 3.7) * 2.0);
			float tp = pz / rd.z;
			vec3 q = ro + rd * tp;
			float px2 = fract((q.x + 0.85) / 1.7) * 1.7 - 0.85 + 0.35;
			float body = step(abs(px2), 0.2 - max(0.0, q.y - 1.05) * 0.4) * step(0.75, q.y) * step(q.y, 1.2) + step(length(vec2(px2, q.y - 1.33)), 0.11);
			if (tp < t && open > 0.5 && body > 0.5 && sfH(vec2(floor((q.x + 0.85) / 1.7), 3.0) + seed) < 0.55 * lit + 0.1 && abs(q.x) < W * 0.5 - 0.3) { col = sfPal(sfH(vec2(floor(q.x / 1.7), 8.0) + seed)) * 0.45; t = tp; }
		}
		// mannequins in a clothes shop's window, racks of gear on stands
		if ((kind > 7.5 && kind < 8.5) || (kind > 9.5 && kind < 10.5)) {
			float tm = -0.75 / rd.z;
			vec3 q = ro + rd * tm;
			float mx = fract(q.x / 1.6) * 1.6 - 0.8;
			float fig = kind < 8.5 ? step(length(vec2(mx, q.y - 1.62)), 0.1) + step(abs(mx), 0.17 - abs(q.y - 1.25) * 0.15) * step(0.95, q.y) * step(q.y, 1.5) + step(abs(mx), 0.12) * step(0.15, q.y) * step(q.y, 0.95) * step(0.04, abs(mx)) + step(abs(mx), 0.02) * step(q.y, 0.15)
				: step(abs(mx), 0.45) * step(0.2, q.y) * step(q.y, 1.6) * step(0.55, fract(mx / 0.15));
			if (tm < t && fig > 0.5 && abs(q.x) < W * 0.5 - 0.5) { col = kind < 8.5 ? (q.y > 0.95 ? sfPal(sfH(vec2(floor(q.x / 1.6), 2.0) + seed)) * 0.8 : vec3(0.85, 0.82, 0.78)) : sfPal(sfH(vec2(floor(q.x / 0.15), 6.0) + seed)) * 0.7; t = tm; }
		}
		// a car on the lift, or a hull on its cradle
		if (kind > 14.5 && kind < 15.5 || kind > 20.5) {
			float tc = -(D * 0.6) / rd.z;
			vec3 q = ro + rd * tc;
			float lift = kind < 15.5 ? 0.9 * step(0.5, fract(seed * 9.0)) : 0.4;
			float y = q.y - lift, car = kind < 15.5 ? step(abs(q.x), 2.2) * step(0.15, y) * step(y, 0.75) + step(abs(q.x), 1.2) * step(0.75, y) * step(y, 1.25) : step(abs(q.x), 3.0 - y * 1.4) * step(0.0, y) * step(y, 1.2);
			if (tc < t && car > 0.5) { col = kind < 15.5 ? (y > 0.78 && y < 1.2 && abs(q.x) < 1.1 ? vec3(0.1, 0.12, 0.14) : sfPal(sfH(vec2(seed, 4.0))) * 0.8) : vec3(0.9, 0.9, 0.88); t = tc; }
			if (kind < 15.5 && tc < t && step(abs(abs(q.x) - 1.6), 0.08) * step(q.y, lift + 0.2) > 0.5) { col = vec3(0.7, 0.6, 0.1); t = tc; }
		}
		// the counter across the room (its top lighter), the till on it, and whoever works it
		if (ch > 0.0 && kind != 12.0 && kind != 13.0) {
			float tc = -cz / rd.z;
			vec3 q = ro + rd * tc;
			float xc = (fract(seed * 11.0) - 0.5) * W * 0.3;
			if (tc < t && q.y < ch && abs(q.x - xc) < W * cw * 0.5) { col = q.y > ch - 0.06 ? vec3(0.85, 0.83, 0.8) : (kind > 17.5 && kind < 18.5 ? vec3(0.85, 0.9, 0.95) : mix(vec3(0.42, 0.28, 0.18), vFrame, 0.35)); t = tc; }
			// the staff behind it (from the waist up over the counter), while it is open
			float ts2 = -(cz + 0.55) / rd.z;
			vec3 s2 = ro + rd * ts2;
			float sxp = s2.x - xc - (fract(seed * 23.0) - 0.5) * W * cw * 0.6;
			float fig = step(length(vec2(sxp, s2.y - 1.6)), 0.105) + step(abs(sxp), 0.21 - max(0.0, s2.y - 1.3) * 0.5) * step(ch - 0.05, s2.y) * step(s2.y, 1.48);
			if (ts2 < t && fig > 0.5 && lit > 0.5) { col = s2.y > 1.48 ? vec3(0.55, 0.4, 0.32) : (kind < 4.5 ? vec3(0.9, 0.9, 0.88) : sfPal(fract(seed * 41.0)) * 0.5); t = ts2; }
		}
		// the light inside: depth darkens it a little; lamps on when lit
		float fade = 1.0 - smoothstep(1.0, D + 2.0, t) * 0.35;
		sfInside = col * fade;
		sfGlass = 1.0;
		sfRough = 0.08;
	}`;

// ---------- the pavement's things ----------
const colored = (geo, c) => { const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const B = (w, h, d, x, y, z, c) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
const C = (r, h, x, y, z, c, seg = 10, r2 = r) => colored(new THREE.CylinderGeometry(r, r2, h, seg).translate(x, y + h / 2, z), c);
const DARK = [0.08, 0.08, 0.09], WOOD = [0.5, 0.36, 0.22], WHITE = [0.93, 0.93, 0.91];
function chair(x, z, turn) {
	const p = [B(0.42, 0.04, 0.42, 0, 0.44, 0, [1, 1, 1]), B(0.42, 0.42, 0.04, 0, 0.46, -0.2, [1, 1, 1])];
	for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) p.push(B(0.03, 0.44, 0.03, a, 0, b, DARK));
	const g = mergeGeometries(p);
	g.rotateY(turn); g.translate(x, 0, z);
	return g;
}
function furnitureShapes() {
	const S = {};
	// a bistro set: a round table, a chair either side (the chairs tinted)
	S.bistro = mergeGeometries([C(0.32, 0.03, 0, 0.72, 0, WHITE, 14), C(0.03, 0.72, 0, 0, 0, DARK, 6), C(0.18, 0.02, 0, 0, 0, DARK, 10), chair(0, 0.62, Math.PI), chair(0, -0.62, 0)]);
	// a pavement chalkboard, legs apart
	{
		const board = (s) => colored(new THREE.BoxGeometry(0.6, 0.95, 0.025).translate(0, 0.475, 0).rotateX(s * 0.2).translate(0, 0, s * 0.02), [0.13, 0.16, 0.14]);
		const frame = (s) => colored(new THREE.BoxGeometry(0.66, 1.0, 0.02).translate(0, 0.5, -s * 0.004).rotateX(s * 0.2).translate(0, 0, s * 0.015), WOOD);
		const p = [frame(1), frame(-1), board(1), board(-1)];
		for (let k = 0; k < 4; k++) p.push(colored(new THREE.BoxGeometry(0.4 - k * 0.07, 0.035, 0.01).translate(0, 0.72 - k * 0.13, 0.115 - k * 0.026).rotateX(0.2), k === 0 ? [1, 1, 1] : [0.92, 0.9, 0.82]));
		S.aboard = mergeGeometries(p);
	}
	// an umbrella, open (the canopy tinted) and furled
	S.umbrella = mergeGeometries([C(0.03, 2.3, 0, 0, 0, [0.85, 0.85, 0.83], 6), colored(new THREE.ConeGeometry(1.3, 0.42, 8, 1, true).translate(0, 2.33, 0), [1, 1, 1]), colored(new THREE.ConeGeometry(1.3, 0.42, 8, 1, true).rotateX(Math.PI).translate(0, 2.33, 0), [0.75, 0.75, 0.75]), C(0.25, 0.1, 0, 0, 0, DARK, 10)]);
	S.furled = mergeGeometries([C(0.03, 2.3, 0, 0, 0, [0.85, 0.85, 0.83], 6), colored(new THREE.CylinderGeometry(0.1, 0.03, 1.3, 8).translate(0, 1.75, 0), [1, 1, 1]), C(0.25, 0.1, 0, 0, 0, DARK, 10)]);
	// a planter box of shrubs, a bike rack, a parking sign, pallets with a hand truck
	S.planter = mergeGeometries([B(1.0, 0.45, 0.45, 0, 0, 0, [0.35, 0.33, 0.3]), colored(new THREE.SphereGeometry(0.3, 7, 5).scale(1.4, 0.8, 0.7).translate(0, 0.62, 0), [0.22, 0.38, 0.16])]);
	{
		const p = [];
		for (let k = 0; k < 4; k++) p.push(colored(new THREE.TorusGeometry(0.36, 0.025, 4, 10, Math.PI).translate(-0.9 + k * 0.6, 0, 0), [0.6, 0.62, 0.64]));
		S.bikerack = mergeGeometries(p);
	}
	S.psign = mergeGeometries([C(0.035, 2.2, 0, 0, 0, [0.6, 0.6, 0.62], 6), B(0.45, 0.6, 0.03, 0, 1.55, 0.04, [0.12, 0.3, 0.62]), B(0.18, 0.36, 0.035, 0, 1.67, 0.045, WHITE)]);
	S.pallets = mergeGeometries([B(1.2, 0.14, 1.0, 0, 0, 0, [0.62, 0.5, 0.34]), B(1.2, 0.14, 1.0, 0, 0.15, 0, [0.6, 0.48, 0.32]), B(1.1, 0.7, 0.9, 0, 0.3, 0, [0.78, 0.7, 0.55]), B(0.05, 1.2, 0.05, 0.9, 0, -0.2, [0.75, 0.2, 0.15]), B(0.5, 0.05, 0.3, 0.9, 0, 0, [0.3, 0.3, 0.3])]);
	return S;
}
// [cap desktop, cap phone, casts shadow]
const FURN = { bistro: [500, 160, true], aboard: [260, 100, true], umbrella: [160, 60, true], furled: [160, 60, false], planter: [300, 80, true], bikerack: [120, 0, false], psign: [120, 50, false], pallets: [120, 40, true] };

// an awning: a canvas sloping out and down from the wall a metre, its valance, its cheeks;
// unit wide (x), its depth and drop scaled per instance
function awningGeometry() {
	const pos = [], nrm = [];
	const quad = (a, b, c, d, n) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) nrm.push(...n); };
	const s = Math.hypot(1, 0.55);
	quad([-0.5, 0, 0], [-0.5, -0.55, 1], [0.5, -0.55, 1], [0.5, 0, 0], [0, 1 / s, 0.55 / s]);
	quad([-0.5, -0.55, 1], [-0.5, -0.8, 1], [0.5, -0.8, 1], [0.5, -0.55, 1], [0, 0, 1]);
	quad([0.5, 0, 0], [0.5, -0.55, 1], [0.5, -0.8, 1], [0.5, -0.25, 0], [1, 0, 0]);
	quad([-0.5, -0.25, 0], [-0.5, -0.8, 1], [-0.5, -0.55, 1], [-0.5, 0, 0], [-1, 0, 0]);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
	return g;
}

// how much of a device's cap is drawn on a quality tier (world/governor.js): all of it on the high
// and medium tiers, three quarters on low, a little over half on minimal. The fronts come nearest
// first, so the far ones go (tools/phone-audit.test.mjs)
export const frontShare = (tier = qualityNow()) => Math.min(1, (tier?.far ?? 1) / 0.8);

export function createStorefronts({ group, wrap = (m) => m, isPhone = false }) {
	const CAP = isPhone ? 160 : 420, FCAP = CAP * 2, ACAP = CAP;
	let share = frontShare(), tierSeen = tierNow();
	const night = { value: 0 };
	// ---- the glazing ----
	const gGeo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0));
	const aDim = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4), aShop = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
	const aState = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4), aFrame = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
	aState.setUsage(THREE.DynamicDrawUsage);
	gGeo.setAttribute('aDim', aDim); gGeo.setAttribute('aShop', aShop); gGeo.setAttribute('aState', aState); gGeo.setAttribute('aFrame', aFrame);
	const gMat = wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
	{
		const prev = gMat.onBeforeCompile;
		gMat.onBeforeCompile = (sh, r) => {
			prev?.call(gMat, sh, r);
			sh.uniforms.uSfNight = night;
			sh.vertexShader = GLASS_VS + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLASS_VS_MAIN);
			sh.fragmentShader = GLASS_FS + '\n' + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vState.w < 0.5) discard;')
				.replace('#include <color_fragment>', '#include <color_fragment>\nsfRoom();\ndiffuseColor.rgb = sfGlass > 0.5 ? vec3(0.04, 0.05, 0.055) : sfBase;')
				.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = sfRough;')
				.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				if (sfGlass > 0.5) {
					// what is seen of the room: by day a dim daylit room (darker shut); after dark its own
					// lamps when lit, nothing when not; less of it at a glancing angle (the glass reflects)
					vec3 vd = normalize(vCamM - vPosM);
					float fres = pow(1.0 - clamp(abs(vd.z), 0.0, 1.0), 3.0);
					float k = mix(0.22 + 0.18 * vState.x, vState.x * 1.15, uSfNight);
					totalEmissiveRadiance += sfInside * k * (1.0 - fres * 0.75) * mix(vec3(1.0), vec3(1.0, 0.86, 0.66), uSfNight * vState.x);
				}`);
		};
		const pk = gMat.customProgramCacheKey?.bind(gMat);
		gMat.customProgramCacheKey = () => (pk ? pk() : '') + '|storefront1';
	}
	const glass = new THREE.InstancedMesh(gGeo, gMat, CAP);
	glass.count = 0; glass.frustumCulled = false; glass.castShadow = false; glass.receiveShadow = true; glass.visible = false;
	glass.name = 'storefront-glass';
	group.add(glass);

	// ---- the fascias (and the pilasters either side of a house's new shop window) ----
	const fMat = wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 }));
	const fascia = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), fMat, FCAP);
	fascia.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FCAP * 3).fill(1), 3);
	fascia.count = 0; fascia.frustumCulled = false; fascia.castShadow = !isPhone; fascia.receiveShadow = true; fascia.visible = false;
	fascia.name = 'storefront-fascia';
	group.add(fascia);

	// ---- the awnings, striped or plain ----
	const aGeo = new THREE.InstancedBufferGeometry().copy(awningGeometry());
	const aStripe = new THREE.InstancedBufferAttribute(new Float32Array(ACAP), 1);
	aGeo.setAttribute('aStripe', aStripe);
	const aMat = wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
	{
		const prev = aMat.onBeforeCompile;
		aMat.onBeforeCompile = (sh, r) => {
			prev?.call(aMat, sh, r);
			sh.vertexShader = 'attribute float aStripe; varying float vStripe; varying float vAwX;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStripe = aStripe; vAwX = position.x * length(instanceMatrix[0].xyz);');
			sh.fragmentShader = 'varying float vStripe; varying float vAwX;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
				if (vStripe > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.91, 0.85), step(0.5, fract(vAwX / 0.36)));`);
		};
		const pk = aMat.customProgramCacheKey?.bind(aMat);
		aMat.customProgramCacheKey = () => (pk ? pk() : '') + '|awning1';
	}
	const awnings = new THREE.InstancedMesh(aGeo, aMat, ACAP);
	awnings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(ACAP * 3).fill(1), 3);
	awnings.count = 0; awnings.frustumCulled = false; awnings.castShadow = !isPhone; awnings.receiveShadow = true; awnings.visible = false;
	awnings.name = 'storefront-awnings';
	group.add(awnings);

	// ---- the pavement's things ----
	const FS = furnitureShapes();
	const furnMat = wrap(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }));
	const furn = {};
	for (const [k, [cd, cp, cast]] of Object.entries(FURN)) {
		const n = isPhone ? cp : cd;
		if (!n) continue;
		const im = new THREE.InstancedMesh(FS[k], furnMat, n);
		im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
		im.count = 0; im.frustumCulled = false; im.castShadow = cast && !isPhone; im.receiveShadow = true; im.visible = false;
		im.name = 'storefront-' + k;
		group.add(im);
		furn[k] = im;
	}

	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
	const put = (im, n, x, y, z, yaw, sx, sy, sz, tilt = 0) => {
		q.setFromAxisAngle(Y, yaw);
		if (tilt) q.multiply(qt.setFromAxisAngle(X, tilt));
		im.setMatrixAt(n, m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz)));
	};
	// the fronts as they stand now (economy/layer.js gives them): each { E, x, y, z, yaw, nx, nz,
	// spec, fascia, awning, items, o } and its state
	let fronts = [], furnOpen = -1;
	const st = { open: false, lit: 0, shutter: 0, sign: 0, phase: '', shutters: false };
	// set(list, built): the fronts round you, nearest first; built(o) says a building has its
	// rooms built for real near you (its own windows then show them: the painted room goes)
	let builtFn = null;
	function set(list, built = builtFn) {
		builtFn = built;
		fronts = list;
		let n = 0, nf = 0, na = 0;
		const cap = Math.round(CAP * share), fcap = Math.round(FCAP * share), acap = Math.round(ACAP * share);
		const D = aDim.array, Sh = aShop.array, Fr = aFrame.array, Sa = aState.array;
		for (const R of list) {
			const sp = R.spec;
			if (sp && n < cap) {
				// the glazing, a few centimetres proud of the wall
				// (an office window from its sill; a shopfront from the ground, its kick plate drawn)
				const h = sp.kind === 'office' ? sp.y1 - sp.y0 : sp.y1, kick = sp.kind === 'office' ? 0 : sp.y0;
				put(glass, n, R.x + R.nx * 0.05, R.y + (sp.kind === 'office' ? sp.y0 : 0), R.z + R.nz * 0.05, R.yaw, sp.w, h, 1);
				D[n * 4] = sp.w; D[n * 4 + 1] = h; D[n * 4 + 2] = kick; D[n * 4 + 3] = sp.kind === 'office' || sp.kind === 'bays' ? 99 : R.doorX;
				Sh[n * 4] = R.display; Sh[n * 4 + 1] = R.depth; Sh[n * 4 + 2] = R.seed; Sh[n * 4 + 3] = (sp.kind === 'office' ? 1 : sp.kind === 'bays' ? 2 : 0) + (R.shutters ? 4 : 0);
				Fr[n * 3] = R.frame[0]; Fr[n * 3 + 1] = R.frame[1]; Fr[n * 3 + 2] = R.frame[2];
				Sa[n * 4 + 3] = 1;
				R.slot = n;
				n++;
			} else R.slot = -1;
			// the fascia behind the board, and a house's pilasters and sill either side of its window
			for (const b of R.boxes || []) {
				if (nf >= fcap) break;
				put(fascia, nf, b[0], b[1], b[2], R.yaw, b[3], b[4], b[5]);
				fascia.instanceColor.array.set(b[6], nf * 3);
				nf++;
			}
			if (R.awning && na < acap) {
				const A = R.awning;
				put(awnings, na, A.x, A.y, A.z, R.yaw, A.w, A.drop, A.depth);
				awnings.instanceColor.array.set(A.col, na * 3);
				aStripe.array[na] = A.stripe ? 1 : 0;
				na++;
			}
		}
		glass.count = n; glass.visible = n > 0;
		fascia.count = nf; fascia.visible = nf > 0;
		awnings.count = na; awnings.visible = na > 0;
		for (const a of [aDim, aShop, aFrame, aState, glass.instanceMatrix, fascia.instanceMatrix, fascia.instanceColor, awnings.instanceMatrix, awnings.instanceColor, aStripe]) a.needsUpdate = true;
		furnOpen = -1;
		lastH = -99;
	}
	// the pavement's things, packed away when the place is shut (the boards in, the umbrellas furled)
	const fc = {};
	function uploadFurniture() {
		for (const k in furn) fc[k] = 0;
		for (const R of fronts) {
			for (const e of R.items || []) {
				let k = e.k;
				if (!R.open && (k === 'aboard')) continue;
				if (!R.open && k === 'umbrella') k = 'furled';
				const im = furn[k];
				if (!im || fc[k] >= Math.round(im.instanceMatrix.count * share)) continue;
				const n = fc[k]++;
				put(im, n, e.x, e.y, e.z, e.yaw, 1, 1, 1);
				if (e.col) im.instanceColor.array.set(e.col, n * 3); else im.instanceColor.array.fill(1, n * 3, n * 3 + 3);
			}
		}
		for (const k in furn) { const im = furn[k]; im.count = fc[k]; im.visible = fc[k] > 0; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
	}
	// once a game minute (or when asked): every front's open, lit and shutter, and whether its
	// rooms are built (then it hides); the pavement's things when anything opened or shut
	let lastH = -99, lastBuilt = 0, openSig = 0;
	function tick(hours, dow, nightK, now = 0) {
		night.value = nightK;
		// (a new quality tier: the fronts drawn again to its share)
		if (tierNow() !== tierSeen) { tierSeen = tierNow(); share = frontShare(); set(fronts); }
		const builtNow = now - lastBuilt > 0.5;
		if (Math.abs(hours - lastH) < 1 / 60 && !builtNow) return;
		if (builtNow) lastBuilt = now;
		lastH = hours;
		const Sa = aState.array;
		let sig = 0;
		for (let i = 0; i < fronts.length; i++) {
			const R = fronts[i];
			stateAt(R.E, hours, dow, st);
			R.open = st.open; R.lit = st.lit;
			if (st.open) sig = (sig * 31 + i + 1) | 0;
			const n = R.slot;
			if (n === undefined || n < 0) continue;
			Sa[n * 4] = st.lit; Sa[n * 4 + 1] = st.shutter; Sa[n * 4 + 2] = st.open ? 1 : 0;
			Sa[n * 4 + 3] = builtFn && builtFn(R.o) ? 0 : 1;
		}
		aState.needsUpdate = true;
		if (sig !== openSig || furnOpen < 0) { openSig = sig; furnOpen = 1; uploadFurniture(); }
	}
	const info = () => ({ fronts: fronts.length, glass: glass.count, fascias: fascia.count, awnings: awnings.count, furniture: Object.fromEntries(Object.entries(furn).map(([k, im]) => [k, im.count])), open: fronts.filter((R) => R.open).length });
	return { set, tick, info, meshes: { glass, fascia, awnings, ...furn } };
}
