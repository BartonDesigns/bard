// A building kit describes climate and architecture; a person's community also depends
// on the settlement and culture. Reuse authored work pools without exporting one
// community's traditions to everyone who happens to share its weather.
import { KITS } from './kits.js';

const SEA = /sailor|harbour|ferry|boat builder|fisherman/;
const ROLE_JOB = {
	stall: /sell|merchant|smith|stall|shop|market|carpet|spice|baker|fruit|tailor/,
	tea: /tea|chai|café|cafe|barista/, fish: /fish/, herd: /herd|cattle|yak|llama|horse|camel|goat|cow|dairy/,
	farm: /grow|farm|rice|tea|olive|date|millet|garden|terrace/, monk: /temple|monastery/,
};
const URBAN = /office worker|delivery rider|nurse|student|programmer|shopkeeper|taxi driver|chef|barista/;
export const communityKey = (H) => `${H.regionId}|${H.culture?.key}|${H.kit?.id}|${H.town?.name || ''}|${H.town?.pop ?? -1}|${H.coast !== false}`;
export const communityName = (H) => H.town?.pop >= 3 ? 'city' : H.kit?.name || '';

export function communityFolk(H) {
	const F = H.kit?.folk || {};
	let out = F;
	if (H.town?.pop >= 3 && !/city/.test(H.kit?.id || '')) {
		// Urban neighbours retain their local culture; rural work is not imposed by
		// the surrounding landscape. Keep market occupations in bazaar districts.
		const market = H.kit?.id === 'bazaar' ? F.jobs || [] : [];
		out = { ...F, roles: KITS.eastcity.folk.roles.filter(([role]) => role !== 'tea'),
			jobs: [...market, ...KITS.eastcity.folk.jobs.filter((j) => URBAN.test(j))],
			errands: ['walking home', 'buying groceries', 'meeting a friend', 'on the way to work'],
			hobbies: ['music', 'cooking', 'photography', 'walking', 'reading'] };
	}
	if (H.kit?.id === 'polar' && !/^(inuit|inupiat|kalaallit)$/.test(H.culture?.key || '')) {
		out = { ...F, roles: KITS.station.folk.roles,
			jobs: [...F.jobs.filter((j) => /teacher|nurse|mechanic|researcher/.test(j)), ...KITS.station.folk.jobs.filter((j) => /field guide|electrician|pilot|meteorologist/.test(j))],
			errands: ['walking home', 'buying groceries', 'visiting a friend', 'on the way to work'],
			hobbies: ['photography', 'music', 'reading', 'walking'] };
	}
	return { ...out, jobs: (out.jobs || []).filter((j) => H.coast !== false || !SEA.test(j)),
		errands: (out.errands || []).filter((e) => H.coast !== false || !/harbour|boats|shore/.test(e)) };
}

export function communityJob(H, task, r) {
	const jobs = communityFolk(H).jobs;
	const matched = ROLE_JOB[task] ? jobs.filter((j) => ROLE_JOB[task].test(j)) : [];
	// A temple attendant need not be a monk: preserve the authored occupation.
	const choices = matched.length ? matched : jobs;
	return choices[Math.floor(r() * choices.length)] || 'working locally';
}
