// Keep a walking crew member clear of the room and the other bodies on this deck.
// Called before the motion rig plants feet, so the knees follow the corrected position.
export function constrainCrew(pos, self, folk, push, dt) {
	push?.(pos, pos.y);
	for (let pass = 0; pass < 2; pass++) {
		for (const other of folk) {
			if (other === self || !other.built) continue;
			const q = other.M.S.pos;
			if (Math.abs(pos.y - q.y) > 1.5) continue;
			const dx = pos.x - q.x, dz = pos.z - q.z, d = Math.hypot(dx, dz);
			const space = self.dress === 'eva' || other.dress === 'eva' ? 0.86 : 0.72;
			if (d >= space) continue;
			const a = self.j + other.j + (self.j < other.j ? 0 : Math.PI);
			const nx = d > 1e-5 ? dx / d : Math.cos(a), nz = d > 1e-5 ? dz / d : Math.sin(a);
			const step = Math.min(space - d, Math.max(0, dt) * 2);
			pos.x += nx * step; pos.z += nz * step;
		}
		// A neighbour must never push someone through a bulkhead or a table.
		push?.(pos, pos.y);
	}
}
