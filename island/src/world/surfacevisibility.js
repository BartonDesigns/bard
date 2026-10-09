// The local island's camera-centred meshes belong only to its finite height map.
// Cave visibility and distance visibility must be composed every frame. A cached
// distance-band early return used to let the cave loop re-enable the island mesh
// after it had been hidden over the Bay, Pacific or an inland city.
const bands = new WeakMap();
const show = (object, visible) => { if (object && object.visible !== visible) object.visible = visible; };

export function updateIslandReach(world, camera, surfaceOpen = true) {
	const off = Math.max(Math.abs(camera.position.x), Math.abs(camera.position.z)) - world.island.half;
	const band = off < 150 ? 0 : off < 3300 ? 1 : off < 6000 ? 2 : 3;
	show(world.terrain, surfaceOpen && (band < 2 || !!world.island.far));
	show(world.grass, surfaceOpen && band < 1);
	show(world.turf, surfaceOpen && band < 1);
	for (const object of world.litter.meshes) show(object, surfaceOpen && band < 1);

	// Fixed scenery only changes when crossing a distance band. Never switch lights:
	// adding/removing one from a render would recompile every lit material.
	if (bands.get(world) === band) return band;
	bands.set(world, band);
	show(world.underwater.group, band < 3);
	for (const object of world.caverns.group.children) if (!object.isLight) show(object, band < 3);
	for (const object of world.village.group.children) if (object !== world.village.boat) show(object, band < 3);
	return band;
}
