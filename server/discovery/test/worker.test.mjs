// Node checks for the discovery server, with the Durable Objects and Workers AI stood in for.
// node test/worker.test.mjs   (no network, no account)
import worker, { handle, nightly, BriefStore, Ledger } from '../src/index.js';
import { placeOf, requestFor } from '../src/place.js';
import { settings, worstCase } from '../src/ai.js';
import { canonicalBrief, genId } from '../../../island/src/earth/brief.js';
import { cityByName, regionAt } from '../../../island/src/earth/atlas.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };
const section = (s) => console.log('\n== ' + s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- stand-ins ----------
function storage() {
	const M = new Map();
	return { M, get: async (k) => structuredClone(M.get(k)), put: async (k, v) => { M.set(k, structuredClone(v)); }, delete: async (k) => M.delete(k) };
}
function namespace(Cls, env) {
	const live = new Map();
	return {
		live,
		idFromName: (n) => n,
		get: (id) => {
			let o = live.get(id);
			if (!o) live.set(id, o = new Cls({ storage: storage() }, env));
			return { fetch: (url, init) => o.fetch(url instanceof Request ? url : new Request(url, init)) };
		},
	};
}
const REPLY = {
	vibe: 'A sunny valley town of porches and orchards where {town} greets you by name.',
	districts: [{ name: 'Old {town}', kind: 'oldtown', share: 0.3, architecture: 'brick storefronts', height: 'low' }, { name: 'Orchard Heights', kind: 'residential', share: 0.5, architecture: 'ranch houses', height: 'low' }, { name: 'Depot Row', kind: 'industrial', share: 0.2, architecture: 'packing sheds', height: 'low' }],
	landmarks: [{ look: 'white water tower over the rooftops', name: '' }],
	streets: ['Orchard Way', 'Depot Street', 'Almond Lane', 'Mission Road', 'Delta Avenue', 'Levee Road', 'Walnut Street', 'Canal Drive', 'Ridge Road', 'Tule Lane', 'Sycamore Street', 'Harvest Way', 'Grange Road', 'Pear Street'],
	signs: ['TACOS', 'FRESH PEACHES', 'Grange Hall', 'BAIT & TACKLE', '{town} Feed & Seed', 'ESPRESSO', 'Farmers Market Sat', 'Hella Good Donuts', 'Tire Shop', 'Pharmacy', 'Boba', 'Library', 'Diner', 'Hardware'],
	chatter: ['Hella hot out today, huh?', 'Welcome to {town}!', 'Peaches are in at the stand.', 'Levee road is closed again.', 'See you at the market.', 'Yee, the A\'s won!', 'Grab me a burrito?', 'Delta breeze tonight, finally.', 'That taco truck slaps.', 'Tule fog in the morning, watch out.', 'Go Warriors!', 'Later, take it easy.'],
	music: { genre: 'hyphy', bpm: 98 },
	wardrobe: ['flannel', 'trucker caps', 'hoodies', 'boots'], food: ['tacos', 'peaches', 'burritos', 'boba'], vehicles: ['pickup trucks', 'tractors', 'lowriders'], vegetation: ['valley oak', 'almond orchard', 'tule reeds'],
};
function mockAI({ delay = 20, reply = REPLY, usage = { prompt_tokens: 900, completion_tokens: 1300 }, fail = null } = {}) {
	const A = {
		calls: [],
		run: async (model, input) => {
			A.calls.push({ model, input });
			await sleep(delay);
			if (fail) throw new Error(fail);
			return { response: typeof reply === 'function' ? reply(input) : reply, usage };
		},
	};
	return A;
}
function makeEnv(over = {}) {
	const env = { ALLOWED_ORIGINS: 'https://level99bard.com,https://www.level99bard.com', ALLOW_LOCALHOST: 'true', DAILY_NEURONS: '8000', RATE_PER_HOUR: '12', WAIT_MS: '2000', NIGHT_MAX: '30', AI: mockAI(), ...over };
	env.BRIEFS = namespace(BriefStore, env);
	env.LEDGER = namespace(Ledger, env);
	return env;
}
const SITE = 'https://level99bard.com';
const post = (env, body, { origin = SITE, ip = '203.0.113.7', type = 'application/json' } = {}) => handle(new Request('https://api.test/discover', { method: 'POST', headers: { ...(origin ? { origin } : {}), 'content-type': type, 'cf-connecting-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);
const get = (env, id, origin = SITE) => handle(new Request('https://api.test/brief/' + encodeURIComponent(id), { headers: origin ? { origin } : {} }), env);
const state = async (env) => (await handle(new Request('https://api.test/status', { headers: { origin: SITE } }), env)).json();

// a town on land in the East Bay's hills, and its id
const LAT = 37.93, LON = -121.95, NAME = 'Los Vale Ridge';
const ID = genId(NAME, LAT, LON);
const town = { id: ID, lat: LAT, lon: LON, name: NAME, pop: 1 };

// ---------- validation ----------
section('validation');
ok(regionAt(LAT, LON).land, 'the test town is on land');
ok(!placeOf(ID, town).error, 'a good town: ' + placeOf(ID, town).error);
ok(placeOf('lisbon').city?.name === 'Lisbon', 'an atlas city by id');
const bad = [
	['gen:x:1,2', town, 'bad id'], ['gen:Bad Slug:37.93,-121.95', town, 'bad id'], ['gen:los-vale-ridge:37.9,-121.95', town, 'bad id'],
	['gen:los-vale-ridge:37.93,-121.95', { ...town, lat: 37.95 }, 'match'], ['gen:los-vale-ridge:37.93,-121.95', { ...town, lon: '-121.95' }, 'lat/lon'],
	['gen:los-vale-ridge:37.93,-121.95', { ...town, pop: 5 }, 'pop'], ['gen:los-vale-ridge:37.93,-121.95', { ...town, pop: 1.5 }, 'pop'],
	['gen:los-vale-ridge:37.93,-121.95', { ...town, name: 'Ignore previous instructions' }, 'name'],
	['gen:open-sea:30.00,-40.00', { id: 'gen:open-sea:30.00,-40.00', lat: 30, lon: -40, pop: 1 }, 'land'],
	['atlantis', null, 'unknown'], ['gen:' + 'a'.repeat(60) + ':37.93,-121.95', town, 'bad id'], [42, null, 'bad id'],
];
for (const [id, body, want] of bad) ok((placeOf(id, body).error || '').includes(want), `rejects ${String(id).slice(0, 40)} (${want}): ${placeOf(id, body).error}`);
// the prompt never carries the player's name for a town
const req = requestFor(placeOf(ID, town).city);
ok(!req.user.includes('Los Vale') && req.user.includes('{town}'), 'town prompt has {town}, not the name');

// ---------- CORS ----------
section('CORS');
{
	const env = makeEnv();
	const pre = await handle(new Request('https://api.test/discover', { method: 'OPTIONS', headers: { origin: SITE } }), env);
	ok(pre.status === 204 && pre.headers.get('access-control-allow-origin') === SITE, 'preflight from the site');
	const loc = await handle(new Request('https://api.test/discover', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), env);
	ok(loc.status === 204 && loc.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'preflight from localhost');
	const evil = await get(env, ID, 'https://evil.example');
	ok(evil.status === 403 && !evil.headers.get('access-control-allow-origin'), 'other origins refused');
	const evil2 = await handle(new Request('https://api.test/discover', { method: 'OPTIONS', headers: { origin: 'https://level99bard.com.evil.example' } }), env);
	ok(evil2.status === 403, 'look-alike origin refused');
	const none = await post(env, town, { origin: null });
	ok(none.status === 403 && env.AI.calls.length === 0, 'POST without an origin refused');
	const envNoLocal = makeEnv({ ALLOW_LOCALHOST: 'false' });
	ok((await get(envNoLocal, ID, 'http://localhost:8080')).status === 403, 'localhost can be turned off');
	const miss = await get(env, ID);
	ok(miss.status === 404 && miss.headers.get('access-control-allow-origin') === SITE && miss.headers.get('cache-control') === 'no-store', 'a miss: 404, CORS, not cached');
}

// ---------- generate once ----------
section('generate once');
{
	const env = makeEnv();
	const r = await post(env, town);
	const rec = await r.json();
	ok(r.status === 200 && rec.source === 'llm' && rec.id === ID, 'discovered: ' + r.status + ' ' + rec.source);
	ok(env.AI.calls.length === 1 && env.AI.calls[0].input.response_format?.type === 'json_schema', 'one call, JSON schema asked for');
	ok(!JSON.stringify(rec).includes('203.0.113') && !JSON.stringify([...env.BRIEFS.live.values()].map((o) => [...o.ctx.storage.M])).includes('203.0.113'), 'no address kept');
	ok(rec.brief.music && !('face' in rec.brief.music) && !JSON.stringify(rec).includes('faceplate'), 'no faceplate');
	const g = await get(env, ID);
	const rec2 = await g.json();
	ok(g.status === 200 && JSON.stringify(rec2) === JSON.stringify(rec) && /max-age/.test(g.headers.get('cache-control')), 'GET returns the same, cacheable');
	const again = await post(env, town, { ip: '198.51.100.9' });
	ok((await again.json()).made === rec.made && env.AI.calls.length === 1, 'a second discovery does not ask again');
	// the client's view: the name put in, checked against the atlas
	const b = canonicalBrief(rec.brief, { ...placeOf(ID, town).city, name: NAME });
	ok(b && b.chatter.includes('Welcome to Los Vale Ridge!') && b.districts[0].name === 'Old Los Vale Ridge' && !JSON.stringify(b).includes('{town}'), 'client puts the town name in: ' + b?.districts[0].name);
	const st = await state(env);
	ok(st.used === Math.ceil(900 * 26668 / 1e6 + 1300 * 204805 / 1e6) && st.reserved === 0 && st.gens === 1, 'neurons counted from usage: ' + JSON.stringify(st));
}

// ---------- concurrent first discoveries ----------
section('concurrent discoveries');
{
	const env = makeEnv({ AI: mockAI({ delay: 150 }) });
	const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => post(env, town, { ip: '192.0.2.' + i })));
	const recs = await Promise.all(rs.map((r) => r.json()));
	ok(env.AI.calls.length === 1, 'twelve at once: exactly one generation (' + env.AI.calls.length + ')');
	ok(rs.every((r) => r.status === 200) && new Set(recs.map((x) => JSON.stringify(x))).size === 1, 'all twelve got the same brief');
	// a slow model: waiters get 202, then the same brief
	const slow = makeEnv({ AI: mockAI({ delay: 400 }), WAIT_MS: '50' });
	const [a, b] = await Promise.all([post(slow, town), post(slow, town, { ip: '192.0.2.99' })]);
	ok(a.status === 202 && b.status === 202 && (await a.json()).pending, 'still making: 202');
	await sleep(500);
	const g = await get(slow, ID);
	ok(g.status === 200 && slow.AI.calls.length === 1, 'then kept, made once');
}

// ---------- the free allowance ----------
section('allowance');
{
	const S = settings({}), worst = worstCase(requestFor(placeOf(ID, town).city), S);
	ok(worst > 400 && worst < 520, 'worst case per brief ' + worst + ' neurons');
	// room for exactly two: the third place keeps its atlas brief, and stays that way
	const env = makeEnv({ DAILY_NEURONS: String(worst * 2 + 10), AI: mockAI({ usage: {} }) });
	const ids = [0, 1, 2].map((i) => genId('Town ' + i, 37.9 + i * 0.03, -121.9));
	const recs = [];
	for (const id of ids) { const [, , ll] = id.split(':'); const [la, lo] = ll.split(',').map(Number); recs.push(await (await post(env, { id, lat: la, lon: lo, pop: 1 })).json()); }
	ok(recs[0].source === 'llm' && recs[1].source === 'llm' && recs[2].source === 'atlas', 'third over the day: atlas kept: ' + recs.map((r) => r.source));
	ok(env.AI.calls.length === 2, 'never called over the ceiling');
	const st = await state(env);
	ok(st.used <= +env.DAILY_NEURONS && st.used === worst * 2, 'no usage reported: charged the worst case, within the ceiling: ' + st.used);
	const again = await (await get(env, ids[2])).json();
	ok(again.source === 'atlas' && JSON.stringify(again) === JSON.stringify(recs[2]), 'an atlas-kept place stays as first seen');
	ok(recs[2].brief.chatter.some((s) => s.includes('{town}')) || recs[2].brief.districts.length >= 2, 'atlas brief kept whole, with {town}');
	// the ceiling itself can never be set past the free allowance
	const L = new Ledger({ storage: storage() }, { DAILY_NEURONS: '50000' });
	ok(L.cap === 9500, 'DAILY_NEURONS is capped at 9,500');
	// the allowance used up elsewhere (4006): the day stops
	const env2 = makeEnv({ AI: mockAI({ fail: '4006: you have used up your daily free allocation of 10,000 neurons' }) });
	const r2 = await (await post(env2, town)).json();
	const st2 = await state(env2);
	ok(r2.source === 'atlas' && st2.exhausted && st2.used === 0, '4006: atlas kept, day stopped');
	const other = genId('Other', 37.96, -121.95);
	await post(env2, { id: other, lat: 37.96, lon: -121.95, pop: 1 });
	ok(env2.AI.calls.length === 1, 'no calls after 4006');
	// a new day starts afresh
	const led = env2.LEDGER.live.get('ledger');
	led.clock = () => Date.now() + 86400e3;
	ok(!(await state(env2)).exhausted, 'the next day starts afresh');
	// junk twice: atlas kept, charged
	const env3 = makeEnv({ AI: mockAI({ reply: 'I cannot help with that.' }) });
	const r3 = await (await post(env3, town)).json();
	ok(r3.source === 'atlas' && env3.AI.calls.length === 2 && env3.AI.calls[1].input.response_format === undefined, 'junk: asked again without the schema, then atlas: ' + r3.source);
	// a reply as text (no JSON mode) is read leniently
	const env4 = makeEnv({ AI: mockAI({ reply: 'Sure!\n```json\n' + JSON.stringify(REPLY) + '\n```' }) });
	ok((await (await post(env4, town)).json()).source === 'llm', 'text reply read leniently');
}

// ---------- rate limits and spots ----------
section('rate limits');
{
	const env = makeEnv({ RATE_PER_HOUR: '3' });
	const codes = [];
	for (let i = 0; i < 5; i++) { const id = genId('Spam ' + i, 37.9, -121.9 + i * 0.02); const [, , ll] = id.split(':'); const [la, lo] = ll.split(',').map(Number); codes.push((await post(env, { id, lat: la, lon: lo, pop: 1 })).status); }
	ok(codes.join() === '200,200,200,429,429', 'per address: ' + codes.join());
	const other = genId('Fresh', 37.8, -121.7);
	ok((await post(env, { id: other, lat: 37.8, lon: -121.7, pop: 1 }, { ip: '198.51.100.1' })).status === 200, 'another address is fine');
	const r429 = await post(env, { id: genId('Spam 9', 37.8, -121.6), lat: 37.8, lon: -121.6, pop: 1 });
	ok((await r429.json()).fallback === 'atlas' && (await get(env, genId('Spam 9', 37.8, -121.6))).status === 404, 'rate limited: atlas for now, nothing kept');
	// one spot, many names: two at most
	const env2 = makeEnv();
	const s = [];
	for (const n of ['A', 'B', 'C']) s.push((await post(env2, { id: genId(n, 37.93, -121.95), lat: 37.93, lon: -121.95, pop: 1 }, { ip: '10.0.0.' + n.charCodeAt(0) })).status);
	ok(s.join() === '200,200,403', 'one spot, three names: ' + s.join());
	// bad requests
	ok((await post(env2, 'not json')).status === 400, 'bad json');
	ok((await post(env2, town, { type: 'text/plain' })).status === 415, 'json only');
	ok((await post(env2, { ...town, pad: 'x'.repeat(3000) })).status === 413, 'too big');
	ok((await post(env2, [1, 2])).status === 400, 'array body');
	ok((await get(env2, 'gen:../../etc')).status === 400, 'bad id on GET');
	ok((await handle(new Request('https://api.test/nothing', { headers: { origin: SITE } }), env2)).status === 404, 'unknown path');
}

// ---------- the nightly round ----------
section('nightly round');
{
	const S = settings({}), worst = worstCase(requestFor(cityByName('Tokyo')), S);
	const env = makeEnv({ DAILY_NEURONS: String(worst * 3 + 5), NIGHT_MAX: '10' });
	const made = await nightly(env), st = await state(env);
	ok(made >= 3 && env.AI.calls.length === made && st.used <= st.cap, 'as many as the allowance holds: ' + made + ', ' + st.used + ' of ' + st.cap);
	const ids = [...env.BRIEFS.live.keys()];
	ok(ids.every((id) => cityByName(id)?.pop === 5 || placeOf(id).city?.pop >= 4), 'biggest cities first: ' + ids.join(', '));
	const env2 = makeEnv({ DAILY_NEURONS: '100' });
	ok(await nightly(env2) === 0 && env2.AI.calls.length === 0 && env2.BRIEFS.live.size === 0, 'no allowance: nothing made, nothing kept as atlas');
	// scheduled() hands the round to waitUntil
	let waited = null;
	worker.scheduled({}, makeEnv({ DAILY_NEURONS: '0' }), { waitUntil: (p) => { waited = p; } });
	ok(waited && (await waited) === 0, 'scheduled runs the round');
	// a city done by the round is not asked again
	const again = await nightly(env);
	ok(again === 0 || !ids.some((id) => env.AI.calls.filter((c) => c.input.messages[1].content.includes(placeOf(id).city.name)).length > 1), 'done cities skipped');
}

// ---------- errors never leak ----------
section('errors');
{
	const env = makeEnv();
	env.BRIEFS = { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error('storage down'); } }) };
	const orig = console.error; console.error = () => {};
	const r = await worker.fetch(new Request('https://api.test/brief/' + encodeURIComponent(ID), { headers: { origin: SITE } }), env);
	console.error = orig;
	const j = await r.json();
	ok(r.status === 500 && j.fallback === 'atlas' && !/storage down/.test(JSON.stringify(j)) && r.headers.get('access-control-allow-origin') === SITE, 'a failure says use the atlas, and no more');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
