// Taking a world down before another is built or the island closes, moved out of main.js's
// createIslandWorld: every system let go and the scene emptied.
// The rest of what it uses from main.js's createIslandWorld comes from iw at the top, once per
// call; none of it changes after the world is set up. A name not yet there needs a getter in
// main.js's iw (island/tools/split-contexts.test.mjs checks).
// What changes as the game runs it reaches through iw: drive, projectMarks, projectRefresh,
// projectSnapshot, world. It sets projectRefresh, projectSnapshot, world.

import { captureResources } from './world/resources.js';
import { worldAir } from './world/soundbus.js';

export function islandTeardown(iw) {
	const { communityProjects, families, guide, HOOKS, picnic, renderer, scene, seaDepth, seaMirror,
		shaderWarm, shared, social } = iw;
	seaMirror.reset(); seaDepth.reset();
	if (!iw.world) return;
	picnic.clear();
	HOOKS.combat?.reset();
	HOOKS.gear?.suspend();
	families.clear();
	HOOKS.errands?.dispose();
	HOOKS.npcQuests?.dispose();
	HOOKS.fares?.dispose();
	HOOKS.multiplayer?.reset();
	guide.endTalk();
	guide.routeMarks?.reset(); // keep reusable marker resources out of departing-world disposal
	communityProjects.reset(); iw.projectMarks.reset(); iw.projectSnapshot={projects:[]}; iw.projectRefresh=0;
	social.reset();
	iw.world.labels?.dispose();
	iw.world.plumes?.dispose();
	iw.world.powerlines?.dispose();
	iw.world.contrails?.dispose();
	iw.world.flush?.dispose();
	iw.world.farForest?.dispose();
	iw.world.discovery?.dispose();
	iw.world.services?.dispose();
	iw.world.signage?.dispose();
	iw.world.structures?.dispose?.();          // (phone audit: its quality listener let go)
	iw.world.kinetic?.dispose();
	iw.world.orbit?.dispose();
	iw.world.music?.dispose();
	worldAir(1);
	shaderWarm.reset();
	const release = captureResources(scene, {
		renderer,
		textures: [shared.heightTex, shared.maskTex, iw.world.island.biomes?.tex],
		keepTextures: [shared.occ, shared.prints],
	});
	iw.world.globe?.dispose();         // globe: the frame back to the Bay's, its hooks off
	iw.world.water?.dispose();
	iw.world.bayArea?.dispose();
	iw.world.real?.dispose();
	iw.world.streets?.dispose();
	iw.drive.stop();
	iw.world.player.dispose();
	iw.world.cottages?.dispose();
	iw.world.shells?.dispose();
	iw.world.shrooms?.dispose();
	iw.world.deep?.dispose();
	iw.world.soulWell?.dispose();
	iw.world.underworld?.dispose();
	iw.world.volcano?.dispose();
	iw.world.alien?.dispose();
	iw.world.colony?.dispose();
	iw.world.arch?.dispose();
	iw.world.medieval?.dispose();
	iw.world.village?.dispose?.();
	iw.world.beyond?.dispose();
	iw.world.boardwalk?.destroy();
	iw.world.rays?.dispose();
	iw.world.spray?.dispose();
	release();
	while (scene.children.length) scene.remove(scene.children[0]);
	renderer.renderLists.dispose();
	shared.heightTex = shared.maskTex = null;
	shared.uBiome.value = null;
	iw.world = null;
}
