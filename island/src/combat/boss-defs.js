// The three set-piece bosses as rules: health, phases, attacks (each with its warning time) and
// weak points, read by combat/boss-machine.js; their bodies and arenas are combat/bosses.js.
// Pure data.

export const BOSSES = Object.freeze({
	// the Deep's crystal galleries: a serpent of living crystal that sings the cave apart
	leviathan: {
		name: 'The Lumen Leviathan', where: 'the Crystal Galleries of the Deep', hp: 6000, gap: 2.2, transition: 3,
		phases: [
			{ at: 1, name: 'Shell of Song', attacks: ['volley', 'charge'] },
			{ at: 0.62, name: 'Cracked Crest', attacks: ['volley', 'charge', 'pulse', 'mites'] },
			{ at: 0.28, name: 'Heartlight', attacks: ['charge', 'pulse', 'volley'], speed: 1.35 },
		],
		attacks: {
			volley: { warn: 1.4, active: 1.6, recover: 1.4, weight: 1.2 },
			charge: { warn: 1.8, active: 1.4, recover: 2.2, weight: 1 },
			pulse: { warn: 2.0, active: 0.8, recover: 1.6, weight: 0.9 },
			mites: { warn: 1.2, active: 0.5, recover: 1.2, weight: 0.6 },
		},
		weak: { eye: { mult: 2.2, open: null }, heart: { mult: 3, open: [1, 2] } },
		reward: { credits: 6000, item: 'warden-spark-carbine', level: 6 },
	},
	// a hostile world's ash plains: an abandoned war machine still walking its old patrol
	walker: {
		name: 'The Cinder Colossus', where: 'the ash plains', hp: 8000, gap: 2.4, transition: 3.2,
		phases: [
			{ at: 1, name: 'Advance', attacks: ['mortar', 'beam', 'stomp'] },
			{ at: 0.6, name: 'Kneeling', attacks: ['beam', 'mortar', 'vent'], broken: ['legL', 'legR'] },
			{ at: 0.25, name: 'Meltdown', attacks: ['beam', 'mortar', 'stomp', 'vent'], speed: 1.3 },
		],
		attacks: {
			mortar: { warn: 1.8, active: 2.2, recover: 1.2, weight: 1.2 },
			beam: { warn: 1.6, active: 2.4, recover: 1.6, weight: 1 },
			stomp: { warn: 1.3, active: 0.6, recover: 1.4, weight: 0.8 },
			vent: { warn: 1.5, active: 2.0, recover: 2.4, weight: 0.7 },
		},
		weak: { legL: { mult: 1.6, hp: 900, open: null }, legR: { mult: 1.6, hp: 900, open: null }, core: { mult: 3, open: [1, 2] } },
		reward: { credits: 8000, item: 'aurora-trail-rifle', level: 7 },
	},
	// over the cliff settlements and the cloud seas: a storm-grey gunship that owns the sky
	gunship: {
		name: 'The Stormwarden', where: 'the sky over the cliffs', hp: 7000, gap: 2.0, transition: 3,
		phases: [
			{ at: 1, name: 'Patrol', attacks: ['sweep', 'salvo'] },
			{ at: 0.6, name: 'Pursuit', attacks: ['sweep', 'salvo', 'drones'], broken: ['podL', 'podR'] },
			{ at: 0.25, name: 'Last Stand', attacks: ['barrage', 'sweep', 'salvo'], speed: 1.3 },
		],
		attacks: {
			sweep: { warn: 1.5, active: 2.2, recover: 1.3, weight: 1.2 },
			salvo: { warn: 1.4, active: 1.6, recover: 1.4, weight: 1 },
			drones: { warn: 1.2, active: 0.6, recover: 1.6, weight: 0.6 },
			barrage: { warn: 2.0, active: 2.6, recover: 2.2, weight: 0.9 },
		},
		weak: { podL: { mult: 1.8, hp: 800, open: null }, podR: { mult: 1.8, hp: 800, open: null }, core: { mult: 3, open: [2] } },
		reward: { credits: 7000, item: 'mossback-scout-rifle', level: 7 },
	},
});
