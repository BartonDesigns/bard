// A deep copy of plain saved state (objects, arrays, strings, numbers, booleans, null) by a trip
// through JSON: what a save would keep, and nothing it would not.

export const jsonCopy = (value) => JSON.parse(JSON.stringify(value));
