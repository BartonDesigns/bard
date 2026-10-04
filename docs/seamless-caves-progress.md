# Seamless caves and street-walking follow-up

4 October 2026. Baseline 44bc216. Branch codex/seamless-cave-worlds.

## Scope and preservation

The rich legacy source remains intact at runtime/caves-179.html.gz. The 27-category preservation matrix is docs/cave-migration-inventory.md; source-audited gaps remain explicit. This release extends the native Crysis underground in the same scene, camera and player. It does not embed the old cave renderer or change URLs at a mouth.

Native cave coverage is the generated surface island for Earth and each supported planet profile. The real Bay Area mainland and the globe's streamed mainland terrain do not yet have inland cave entrances. Existing underwater sea caves remain.

## Implemented

- Enable Earth's island underground; retain its existing ecology without adding alien-world dinosaurs.
- Match visible mouth readiness to floor admission; preload approach geometry, prioritize nearby rock and release distant chunk geometry. Keep surface vistas visible near mouths and skylights.
- Register streamed/lazy cave rock and props as instrument surfaces; exclude hidden ancestors from ray picking. Share the existing faceplate audio and strike system.
- Add small seeded resonance alcoves: three playable stones restore actual local guiding lights, retained per planet on this device. Stable, bounded bat colonies avoid ice/lava environments.
- Preserve exact authored cave-role, soul, vault and depth vocabulary; cave inhabitants use stable saved identities, private conversations and role-specific prompts/offline lore. Followers use cave floors, walls and headroom.
- Mountain door opens cave guidance in the current Crysis world. Guide/Quests list real land mouths and bearings, register cave exploration by underground state, and expose existing exploration goals alongside story quests.

## Verification checkpoint

The final source rebuild, unused-variable lint and 44 cave/social/archive/style/story checks pass. Earlier archive, dialogue-style and story tests also passed. The deep-passage blocker was resolved by reserving the incoming tunnel and plaza route from village props. A production-controller browser walk reached 76.5 metres underground and returned to the surface in 9,833 fixed simulation steps, preserving the same world, scene, URL and audio context with no loading screen or page/shader errors. This is functional automation, not a device performance benchmark. Evidence is in docs/verification/cave-continuity/. A fresh isolated interaction check against the rebuilt bundle passed entrance guidance, three instrument strikes, saved-light restoration after changing bodies and returning, and an adopted cave resident with preserved role lore; there were no page errors. The initial follow probe exposed a resident starting within a prop collision margin. Movement now permits strictly decreasing existing overlap, preserves turning while blocked and counts obstruction time once per frame. The final short browser gate selected the resident through normal facing, used conversational follow, measured 4.625 m of movement over seven simulated seconds with a maximum 0.02501 m step, and maintained valid floor/headroom. All three resonance stones were selectable through actual world rays from clear viewpoints. See docs/verification/cave-gameplay/companion-report.json and ray-report.json; these supersede the earlier zero-movement NPC subsection in report.json, whose prior persistence evidence remains retained. This validates a reachable local route, not general tunnel pathfinding around arbitrary obstacles. Publication and live verification are the next release gate; see the release PR for deployment evidence.

## Remaining preservation work

The native network is finite. Legacy long depth epochs, extreme core journey/trials, lava-heart swimming, cave rivers/waterfalls, geode rooms, portable torches, echo expedition/song shards and homesteads are not all migrated. Exact lore retention is not mechanical parity. Shared universal world progress remains BR-006; all new resonance and resident progress currently belongs to the player's browser.

## Street-walking feedback

See docs/street-walking-playtest.md and its evidence. The actual first walk covered 51.57m with the production controller and no page errors. The empty story journal hid existing exploration goals; the new journal integration addresses that finding. Companion route planning and mainland cave coverage remain follow-ups. These are agent observations, not a human research panel.

## Visual fidelity and release entry point

Cave rock retains its procedural fracture/normal/crack detail, strata, moisture and biome palettes. Nearby lamps, crystals and lava now add restrained roughness-dependent highlights within the existing ten-source shader loop. This adds no new shadow maps, textures, geometry or draw calls. Four reversed GLSL smoothstep ranges were corrected for ceiling glow, light shafts and luminous particles. The final shader build passed the Earth walk/return check with no page or shader errors. Phone geometry/fauna and stream budgets remain bounded; software-rendered checks are not physical iPhone performance certification.

From the main faceplate, use the mountain/caves door. It opens the existing Crysis world and lists actual cave entrances. Choose a bearing and walk through the hillside mouth. The same directions are available from Guide → Quests → Cave entrances. Play the three stones in a resonance alcove to restore its guiding lights; this progress is saved on this device. This release preserves the legacy archive and does not claim the entire old deep-world system has already been ported.

## Rendering smoke

The release smoke rendered the faceplate, generated Earth island, Bay Area, Svalbard globe terrain, and Magma surface/underground without page errors, shader failures or context loss. Maximum active texture samplers were 13 per shader stage and 20 combined, below the 16/32 limits. At 480×320, cave-direction controls fit horizontally and remain scrollable. This rendering pass preceded the isolated companion overlap correction; rendering source did not change. The optional browser-model CDN was unavailable in this environment, and two pending Bay asset requests were cancelled normally on world disposal. Those request URLs and exact scope are retained in docs/verification/cave-release-smoke/report.json.

The faceplate entry test also found and removed the old CSS rule hiding the Caves button. A real click now opens native cave guidance without navigation; the final controller round trip passed again after this change. The legacy cockpit door remains hidden.
