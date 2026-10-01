// Where the places' briefs come from. A brief is made once, on the discovery server
// (server/discovery), and every player gets that one: the world is the same for everyone.

// the discovery server's address, e.g. 'https://l99-discovery.<account>.workers.dev'; empty
// until it is deployed, and then every place has its atlas brief (the same for everyone too)
export const DISCOVERY_URL = 'https://l99-discovery.joshbarton1921.workers.dev';

// how long to wait on it (ms): a kept brief, and one being made (the server waits 25 s)
export const GET_MS = 6000;
export const MAKE_MS = 30000;

// dev only: let this device's own model (the Guide's) write the briefs of places the server
// has not got. Its worlds then differ from everyone else's, so it stays off; the Guide's
// model only talks
export const LOCAL_MODEL_WORLD = false;
