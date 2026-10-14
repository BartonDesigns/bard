// The way an ambulance or a fire engine takes: the streets round it as a graph, the shortest
// way through it. Plain numbers: roads are polylines [x, z, x, z, ...] (the real city's, a
// grown town's, or a gridded town's streets laid out the way drive.js lays them out).

const WALKS = new Set(['footway', 'path', 'steps', 'cycleway', 'pedestrian', 'track', 'bridleway']);

// roads: [{ pts, cls }]; snap: how close two road ends must be to meet (m)
export function roadGraph(roads, snap = 1.5) {
	const key = (x, z) => Math.round(x / snap) + ',' + Math.round(z / snap);
	const id = new Map(), X = [], Z = [], adj = [];
	const node = (x, z) => {
		const k = key(x, z);
		let n = id.get(k);
		if (n === undefined) { n = X.length; id.set(k, n); X.push(x); Z.push(z); adj.push([]); }
		return n;
	};
	for (const r of roads) {
		if (!r?.pts || r.pts.length < 4 || WALKS.has(r.cls)) continue;
		let prev = node(r.pts[0], r.pts[1]);
		for (let i = 2; i < r.pts.length; i += 2) {
			const n = node(r.pts[i], r.pts[i + 1]);
			if (n === prev) continue;
			const L = Math.hypot(X[n] - X[prev], Z[n] - Z[prev]);
			adj[prev].push(n, L); adj[n].push(prev, L);
			prev = n;
		}
	}
	return { X, Z, adj, size: X.length };
}

function nearestNode(G, x, z, max) {
	let best = -1, bd = max;
	for (let i = 0; i < G.size; i++) {
		if (!G.adj[i].length) continue;
		const d = Math.hypot(G.X[i] - x, G.Z[i] - z);
		if (d < bd) { bd = d; best = i; }
	}
	return best;
}

// the way from a to b ({ x, z }), as points along the streets, from a's nearest corner to b's;
// null when the streets do not join them
export function findRoute(G, a, b, { reach = 120 } = {}) {
	const s = nearestNode(G, a.x, a.z, reach), t = nearestNode(G, b.x, b.z, reach);
	if (s < 0 || t < 0) return null;
	const n = G.size, g = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), done = new Uint8Array(n);
	const h = (i) => Math.hypot(G.X[i] - G.X[t], G.Z[i] - G.Z[t]);
	// a binary heap of [f, node]
	const heap = [];
	const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
	const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
	g[s] = 0; push(h(s), s);
	while (heap.length) {
		const [, i] = pop();
		if (done[i]) continue;
		done[i] = 1;
		if (i === t) break;
		const A = G.adj[i];
		for (let k = 0; k < A.length; k += 2) {
			const j = A[k], ng = g[i] + A[k + 1];
			if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + h(j), j); }
		}
	}
	if (s !== t && from[t] < 0) return null;
	const out = [];
	for (let i = t; i >= 0; i = i === s ? -1 : from[i]) out.push({ x: G.X[i], z: G.Z[i] });
	out.reverse();
	return out;
}

// a polyline's length, and the point and heading at distance s along it
export function pathLength(path) { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); return L; }
export function along(path, s) {
	let acc = 0;
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.z - a.z);
		if (acc + L >= s || i === path.length - 1) {
			const t = L ? Math.max(0, Math.min(1, (s - acc) / L)) : 0;
			// (the turn coming: how sharply the way bends at the next corner)
			const c = path[i + 1], bend = c ? Math.abs(Math.atan2((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z))) : 0;
			return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z), toCorner: L * (1 - t), bend };
		}
		acc += L;
	}
	const p = path[path.length - 1] || { x: 0, z: 0 };
	return { x: p.x, z: p.z, yaw: 0, toCorner: 0, bend: 0 };
}
