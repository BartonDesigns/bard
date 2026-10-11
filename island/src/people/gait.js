// Stable personal gait, independent of spawn order and frame rate. Slow bounded drift
// adds life without shaking planted feet, changing movement speed, or moving the camera.
export function gaitSignature(seed = 1) {
 let s = (seed ^ 0x63c4b92d) >>> 0;
 const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
 return { cadence: .88 + r() * .25, stance: .57 + r() * .065, width: .82 + r() * .4,
  sway: .65 + r() * .8, roll: .65 + r() * .75, twist: .65 + r() * .8,
  lift: .8 + r() * .4, asymmetry: (r() - .5) * .045, armLag: (r() - .5) * .32,
  phase: r(), driftPhase: r() * Math.PI * 2, driftRate: .17 + r() * .19 };
}
export function gaitDrift(g, time) {
 return Math.sin(time * g.driftRate + g.driftPhase) * .018 + Math.sin(time * g.driftRate * 1.618 + g.driftPhase * .7) * .009;
}
