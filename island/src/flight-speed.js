// Keep old boolean boost callers compatible while cycling the flight speeds.
// Near a world the booster cycles 1-9; in space it carries on through four
// tenfold gears before wrapping back to 1.
export const FLIGHT_SPEEDS = Object.freeze([1, 3, 6, 9]);
export const SPACE_SPEEDS = Object.freeze([1, 3, 6, 9, 100, 1000, 10000, 100000]);
export function flightMultiplier(value) {
	return value === true ? 3 : SPACE_SPEEDS.includes(value) ? value : 1;
}
export function nextFlightSpeed(value, space = false) {
	const list = space ? SPACE_SPEEDS : FLIGHT_SPEEDS;
	return list[(list.indexOf(flightMultiplier(value)) + 1) % list.length];
}
export const speedLabel = (n) => `×${n >= 1000 ? `${n / 1000}k` : n}`;
