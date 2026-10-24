// The animation contract: a different visual verb for every named relic. Cosmetic only;
// damage, loot odds and school alterations stay in the authoritative gameplay catalogues.
export const RELIC_MOTION = Object.freeze({
 'sunbreak-testament': 'Three lighthouse beacons sweep in staggered phases.',
 'black-tide': 'Salt ribbons sway in an invisible returning tide.',
 'stormglass-repeater': 'A contained arc crawls between the tuning forks.',
 'widows-meridian': 'Three clock hands slip backward on different schedules.',
 'orchard-of-ashes': 'Charred seed petals unfold around a breathing ember.',
 'pilgrims-last-light': 'A hanging sanctuary lantern swings beneath its arch.',
 'event-horizon': 'Violet accretion spirals inward against a counter-turning halo.',
 'copper-saint': 'Protective copper seams expand into a shield outline.',
 'moth-kings-lantern': 'A spectral moth flutters around the lantern.',
 'choir-of-thorns': 'Thorn chimes answer each other in a traveling wave.',
 'dawn-engine': 'A geared sunwheel turns around its luminous axle.',
 'winter-debt': 'Suspended ice shards pause, then retrace their orbit.',
 'cathedral-of-sparks': 'Five organ pipes charge in a rising sequence.',
 'gravesong-resonator': 'Funeral bells swing in alternating pendulum rhythms.',
 'hearth-of-the-exile': 'Green hearth flames breathe and bend in three vents.',
 'gargantuas-whisper': 'Broken island fragments orbit an impossible stone.',
 'wildfire-canticle': 'Ember pressure corkscrews forward toward the horn.',
 'oathkeeper-lattice': 'Crystal ward panes fold into alignment one by one.',
 'hollow-crown': 'Five broken crown tips levitate independently.',
 'first-morning': 'A watchful slit-pupil eye glances, rests and occasionally blinks.',
 'lumencrest-circlet': 'Crystal rays sweep around a quiet prismatic crest.',
 'gallery-scale-mail': 'A descending caustic wave ripples across crystal scales.',
 'cinder-core-cuirass': 'Reactor shutters breathe around the living furnace.',
 'ashwalker-greaves': 'Heat travels downward through the greave seams.',
 'stormwarden-flightcoat': 'Armored flight vanes open and settle like gills.',
 'stormwarden-gauntlets': 'Charge crawls across the knuckle conductors.',
 'fogmothers-veil': 'Mourning threads drift and curl in a private fog.',
 'drowned-procession-boots': 'Remembered footfalls send out alternating tide rings.',
});

const mod = (t, n) => ((t % n) + n) % n;
const smooth = x => x * x * (3 - 2 * x);
// Infrequent, complete, asymmetric blink; deterministic so pause/resume cannot accumulate.
export function eyeOpenness(t) {
 const q = mod(t, 8.7);
 if (q < 6.8 || q > 7.08) return 1;
 return q < 6.9 ? 1 - smooth((q - 6.8) / .1) : smooth((q - 6.9) / .18);
}
export function eyeGaze(t, out) {
 const q = mod(t, 12), targets = [0, -.33, .28, .08], phase = Math.floor(q / 3), u = Math.min(1, (q % 3) / .35);
 out.x = targets[(phase + 3) % 4] + (targets[phase] - targets[(phase + 3) % 4]) * smooth(u);
 out.y = .08 * Math.sin(t * .43);
 return out;
}
