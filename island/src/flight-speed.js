// Keep old boolean boost callers compatible while cycling the four flight speeds.
export const FLIGHT_SPEEDS = Object.freeze([1, 3, 6, 9]);
export function flightMultiplier(value) {
	return value === true ? 3 : FLIGHT_SPEEDS.includes(value) ? value : 1;
}
export function nextFlightSpeed(value) {
	return FLIGHT_SPEEDS[(FLIGHT_SPEEDS.indexOf(flightMultiplier(value)) + 1) % FLIGHT_SPEEDS.length];
}
