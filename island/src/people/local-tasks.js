// Player-facing tasks with distinct objectives, sharing the existing favour lifecycle.
export const LOCAL_TASKS = Object.freeze({
	escort: { credits: 65, stage: 'escort', item: 'route', shape: null },
	firstaid: { credits: 80, stage: 'aid', item: 'first-aid kit', shape: 'parcel', deadline: 120 },
	courier: { credits: 70, stage: 'courier', item: 'urgent parcel', shape: 'parcel', deadline: 90 },
	checkin: { credits: 45, stage: 'visit', item: 'message', shape: null },
	survey: { credits: 60, stage: 'tour', item: 'survey notes', shape: 'notebook' },
	cleanup: { credits: 55, stage: 'tour', item: 'street litter', shape: 'bottle' },
});
export function localOffer(kind, who, friend) {
	const d = LOCAL_TASKS[kind]; if (!d) return null;
	const f = friend?.first || 'my neighbour';
	const words = {
		escort: [`Walk with ${who.first} to the meeting point`, 'I am turned around and a little shaken. Could you walk with me to my meeting point? Keep close so I can follow.'],
		firstaid: [`Bring first aid to ${f}`, `${f} needs bandages. Here is a first-aid kit. Can you get it to them within two minutes and help them put it on?`],
		courier: [`Rush a parcel to ${f}`, `${f} is leaving soon. Could you deliver this parcel within ninety seconds? I will cover your time.`],
		checkin: [`Check on ${f}`, `Could you check in with ${f} and come back? I have not heard from them and would like to know they are okay.`],
		survey: ['Survey three trouble spots', 'We are checking the walking route. Could you inspect the three marked spots, then bring your notes back to me?'],
		cleanup: ['Clean up the walking route', 'There is litter scattered along the path. Could you collect the three marked pieces and bring them back for disposal?'],
	};
	return { kind, title: words[kind][0], ask: words[kind][1], deadline: d.deadline || 0, item: { name: d.item, the: `the ${d.item}`, shape: d.shape } };
}
export function stepLocal(E, ev) {
	const d = LOCAL_TASKS[E?.kind]; if (!d) return null;
	const at = (stage, out = {}, extra = {}) => ({ E: { ...E, ...extra, stage }, out });
	if (ev === 'accept' && E.stage === 'offered') return at(d.stage, { say: 'accept' }, { elapsed: 0, checkpoint: 0 });
	if (ev === 'checkpoint' && E.stage === 'tour') {
		const checkpoint = (E.checkpoint || 0) + 1;
		return at(checkpoint >= E.route.length ? 'reportback' : 'tour', {}, { checkpoint, near: 0 });
	}
	if (ev === 'visited' && E.stage === 'visit') return at('reportback', { say: 'checked' });
	if (ev === 'reach' && ['escort', 'aid', 'courier', 'reportback'].includes(E.stage)) return at('done', { done: true, say: 'taskDone' });
	return null;
}
