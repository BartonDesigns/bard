// Following a friend: you are carried along to stay a few metres from them, walking, running
// or flying as they do. You can look anywhere, and nudge yourself aside, and are drawn back;
// keep moving on your own and the follow ends. Too far behind (or a jump away), you are put
// beside them.

export const RADIUS = 4.5, NEAR = 3, JUMP = 150, BREAK_S = 1.5;

// this frame's carry, in your own frame of reference (the player's s.auto: x right, z back)
export function followStep(me, lead, radius = RADIUS) {
	const dx = lead.x - me.x, dz = lead.z - me.z, dy = lead.y - me.y, d = Math.hypot(dx, dz);
	const out = { mx: 0, mz: 0, run: false, up: false, down: false, fly: !!lead.fly, jump: false, d };
	if (d > JUMP || Math.abs(dy) > JUMP) { out.jump = true; return out; }
	if (out.fly) { out.up = dy > 2.5; out.down = dy < -2.5; }
	// inside the ring: stand easy; outside it: come on, harder the further behind
	if (d > radius) {
		const k = Math.min(1, (d - NEAR) / 2), wx = dx / d * k, wz = dz / d * k;
		const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw);
		out.mz = -(wx * fx + wz * fz);
		out.mx = wx * rx + wz * rz;
		out.run = d > radius + 1.5 || (lead.speed || 0) > 4.5;
	}
	return out;
}
// the spot to be put down at: behind the friend, on their line
export function besideOf(lead, radius = RADIUS) {
	const hx = -Math.sin(lead.yaw || 0), hz = -Math.cos(lead.yaw || 0);
	return { x: lead.x - hx * (radius - 1), z: lead.z - hz * (radius - 1) };
}
