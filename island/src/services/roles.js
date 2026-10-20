// What the people who work in the services do at their posts and where they go between
// spells there (people/workplace-life.js WORK_ROLES, people/workplace-routine.js WORK_TRIPS).
// An activity is { activity (what dialogue and the console say they are doing), pose, talk,
// gesture, line (said aloud when you are near) }; phase runs 0..64 seconds and round again.

import { WORK_ROLES } from '../people/workplace-life.js';
import { WORK_TRIPS } from '../people/workplace-routine.js';

const say = (lines, cycle) => lines[cycle % lines.length];
// a pair working together: the one whose side it is speaks, the other listens
function pair(phase, side, partnered) { return partnered && Math.floor(phase / 4) % 2 === side; }

const ROLES = {
	// ---------- the hospital ----------
	doctor: (m, phase, cycle, partnered) => {
		if (m.group.endsWith(':hub') || m.group.endsWith(':station')) return phase < 38 ? { activity: 'writing up notes', pose: 'type', talk: false } : { activity: 'reading a chart', pose: 'read', talk: false };
		const talk = pair(phase, m.side, partnered);
		return { activity: 'examining a patient', pose: talk ? 'rest' : 'listen', talk, gesture: talk ? 'explain' : 'nod', line: say(['How is the pain now, on a scale of one to ten?', 'Your scans look clear. We will keep you a little longer.', 'Follow my finger with your eyes, please.'], cycle) };
	},
	nurse: (m, phase, cycle, partnered) => {
		if (m.group.endsWith(':desk') || m.group.endsWith(':hub') || m.group.endsWith(':station')) return phase < 30 ? { activity: 'triaging the next arrival', pose: 'type', talk: false } : { activity: 'checking the board', pose: 'read', talk: false };
		if (m.group.endsWith(':op')) return { activity: 'assisting in surgery', pose: 'table', talk: false };
		const talk = pair(phase, m.side, partnered);
		return { activity: 'checking vital signs', pose: talk ? 'rest' : 'read', talk, gesture: talk ? 'explain' : null, line: say(['I am just going to take your blood pressure.', 'Press the button if you need anything.', 'Try to drink a little water for me.'], cycle) };
	},
	surgeon: () => ({ activity: 'operating', pose: 'table', talk: false }),
	receptionist: (m, phase) => (phase < 44 ? { activity: 'booking in a patient', pose: 'type', talk: false } : { activity: 'answering the phone', pose: 'phone', talk: false }),
	paramedic: (m, phase) => (phase < 32 ? { activity: 'restocking the stretcher', pose: 'read', talk: false } : { activity: 'waiting for the next call', pose: 'rest', talk: false }),
	pharmacist: (m, phase) => (phase < 40 ? { activity: 'filling a prescription', pose: 'read', talk: false } : { activity: 'counting medication', pose: 'type', talk: false }),
	patient: (m, phase, cycle, partnered) => {
		const talk = pair(phase, m.side, partnered);
		return { activity: partnered ? 'being examined' : 'resting in bed', pose: talk ? 'rest' : 'lap', talk, gesture: talk ? 'shake' : null, line: say(['It hurts less than it did.', 'When can I go home?', 'Thank you, I feel a lot better.'], cycle) };
	},
	visitor: (m, phase) => (phase < 34 ? { activity: 'waiting to be seen', pose: 'lap', talk: false } : { activity: 'looking at their phone', pose: 'phone', talk: false }),

	// ---------- the police station ----------
	'desk officer': (m, phase, cycle, partnered) => {
		const talk = pair(phase, m.side, partnered);
		return partnered ? { activity: 'taking a report at the desk', pose: talk ? 'rest' : 'type', talk, gesture: talk ? 'explain' : null, line: say(['Can you describe what they looked like?', 'Take a seat. An officer will be with you shortly.', 'I will need your name and a number to reach you.'], cycle) } : { activity: 'logging calls', pose: 'type', talk: false };
	},
	officer: (m, phase, cycle, partnered) => {
		if (m.group.includes(':map') || m.group.includes(':brief')) return { activity: 'at the briefing', pose: 'listen', talk: pair(phase, m.side, partnered), line: say(['Two units on the east side tonight.', 'Copy that. We will keep the roads clear.'], cycle) };
		return phase < 40 ? { activity: 'writing up a report', pose: 'type', talk: false } : phase < 52 ? { activity: 'reviewing a case file', pose: 'read', talk: false } : { activity: 'on the phone', pose: 'phone', talk: false };
	},
	chief: (m, phase) => (phase < 36 ? { activity: 'reading reports', pose: 'read', talk: false } : { activity: 'signing duty rosters', pose: 'type', talk: false }),
	detective: (m, phase, cycle, partnered) => ({ activity: 'going over a case', pose: 'listen', talk: pair(phase, m.side, partnered), gesture: 'explain', line: say(['The timeline does not add up.', 'Pull the footage from the corner store.'], cycle) }),
	'evidence clerk': (m, phase) => (phase < 40 ? { activity: 'logging evidence', pose: 'type', talk: false } : { activity: 'labelling an evidence bag', pose: 'read', talk: false }),
	detainee: (m, phase) => (phase < 40 ? { activity: 'held in a cell', pose: 'lap', talk: false } : { activity: 'pacing the cell', pose: 'rest', talk: false }),

	// ---------- the fire station ----------
	firefighter: (m, phase, cycle, partnered) => {
		if (m.group.endsWith(':table')) return { activity: 'eating with the crew', pose: 'table', talk: pair(phase, m.side, partnered), gesture: 'explain', line: say(['Who made the chili this time?', 'Engine is checked and ready.', 'Long night if this wind keeps up.'], cycle) };
		if (m.group.endsWith(':sofa')) return { activity: 'watching the news', pose: 'lap', talk: false };
		if (m.group.includes(':bunk')) return { activity: 'resting between calls', pose: 'lap', talk: false };
		if (m.group.includes(':gear')) return { activity: 'checking turnout gear', pose: 'read', talk: false };
		if (m.group.endsWith(':gym')) return { activity: 'working out', pose: 'rest', talk: false };
		return { activity: 'on shift', pose: 'rest', talk: false };
	},
	dispatcher: (m, phase) => (phase < 46 ? { activity: 'monitoring the radio', pose: 'type', talk: false } : { activity: 'logging a call', pose: 'read', talk: false }),

	// ---------- the armory ----------
	'duty officer': (m, phase, cycle, partnered) => ({ activity: 'running the map table', pose: pair(phase, m.side, partnered) ? 'rest' : 'read', talk: pair(phase, m.side, partnered), gesture: 'explain', line: say(['Mark the roadblock here, and here.', 'Get me a status on the north gate.', 'Units are holding. Keep the channel clear.'], cycle) }),
	'radio operator': (m, phase) => (phase < 44 ? { activity: 'on the radio net', pose: 'type', talk: false } : { activity: 'copying a message', pose: 'read', talk: false }),
	soldier: (m, phase, cycle, partnered) => (m.group.includes(':mess') ? { activity: 'at mess', pose: 'table', talk: pair(phase, m.side, partnered), line: say(['Same rations as yesterday.', 'Drill at oh six hundred.'], cycle) } : { activity: 'off duty in the barracks', pose: 'lap', talk: false }),
	guard: (m, phase) => (phase < 50 ? { activity: 'on guard at the post', pose: 'rest', talk: false } : { activity: 'checking the log', pose: 'read', talk: false }),
	quartermaster: (m, phase) => (phase < 40 ? { activity: 'checking the stock sheets', pose: 'type', talk: false } : { activity: 'signing out supplies', pose: 'read', talk: false }),
	cook: () => ({ activity: 'serving at the line', pose: 'rest', talk: false }),

	// ---------- the places walked to between ----------
	'patient check': () => ({ activity: 'checking on a patient', pose: 'read', talk: false }),
	'ward round': () => ({ activity: 'on the ward round', pose: 'listen', talk: false }),
	coffee: () => ({ activity: 'getting a coffee', pose: 'rest', talk: false }),
	'cell check': () => ({ activity: 'checking the cells', pose: 'rest', talk: false }),
	'evidence log': () => ({ activity: 'bringing in evidence', pose: 'read', talk: false }),
	'gear check': () => ({ activity: 'checking the gear racks', pose: 'read', talk: false }),
	kitchen: () => ({ activity: 'cooking for the crew', pose: 'rest', talk: false }),
	workout: () => ({ activity: 'working out', pose: 'rest', talk: false }),
	'comms check': () => ({ activity: 'checking the radio racks', pose: 'read', talk: false }),
	inventory: () => ({ activity: 'counting the stores', pose: 'read', talk: false }),
	'map review': () => ({ activity: 'studying the map', pose: 'read', talk: false }),
};
// who walks where: the roles a worker's trips are to, by how many they have made
const TRIPS = {
	doctor: (n) => (n % 2 ? ['ward round'] : ['ward round', 'patient check']),
	nurse: (n) => (n % 3 === 2 ? ['stock check'] : ['patient check']),
	pharmacist: () => ['stock check'],
	officer: (n) => (n % 2 ? ['coffee'] : ['cell check', 'evidence log', 'coffee']),
	'desk officer': () => ['coffee'],
	'evidence clerk': () => ['evidence log'],
	firefighter: (n) => (n % 2 ? ['gear check', 'workout'] : ['kitchen', 'gear check']),
	dispatcher: () => ['kitchen'],
	'duty officer': () => ['map review', 'comms check'],
	'radio operator': () => ['comms check'],
	quartermaster: () => ['inventory'],
	soldier: () => ['inventory', 'workout'],
};
Object.assign(WORK_ROLES, ROLES);
Object.assign(WORK_TRIPS, TRIPS);
