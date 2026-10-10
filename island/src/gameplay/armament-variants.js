// Cosmetic chassis identities follow the existing five quality tiers. Inventory IDs,
// upgrade/combine rules and combat balance remain owned by their existing systems.
const names = {
 'aurora-trail-rifle': ['Field', 'Ranger', 'Pathfinder', 'Vanguard', 'Sunward'],
 'mossback-scout-rifle': ['Trail', 'Tracker', 'Outrider', 'Wayfinder', 'Elderwood'],
 'warden-spark-carbine': ['Patrol', 'Watchkeeper', 'Sentinel', 'Bastion', 'Citadel'],
 'reedline-hunting-bow': ['Reed', 'Grove', 'Windrunner', 'Moonstring', 'Dawnbound'],
};
export const ARMAMENT_IDS = Object.freeze(Object.keys(names));
export function armamentVariant(id, tier = 0) {
 const list = names[id]; if (!list) return null;
 const rank = Math.max(0, Math.min(4, Number.isFinite(tier) ? Math.trunc(tier) : 0));
 return { rank, name: list[rank], mark: rank + 1 };
}
