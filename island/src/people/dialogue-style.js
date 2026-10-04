// Bounded player preferences shared by local voices and the cloud endpoint. Never accept
// arbitrary system instructions from a saved setting or a request body.
export const DEFAULT_DIALOGUE_STYLE = Object.freeze({ tone: 'mature', vividness: 'bold', response: 'rich' });

export function normalizeDialogueStyle(value, age) {
	const v = value && typeof value === 'object' ? value : {};
	const child = Number.isFinite(Number(age)) && Number(age) < 18;
	return {
		tone: child ? 'clean' : ['clean', 'mature'].includes(v.tone) ? v.tone : DEFAULT_DIALOGUE_STYLE.tone,
		vividness: ['restrained', 'bold'].includes(v.vividness) ? v.vividness : DEFAULT_DIALOGUE_STYLE.vividness,
		response: ['brief', 'balanced', 'rich'].includes(v.response) ? v.response : DEFAULT_DIALOGUE_STYLE.response,
	};
}

export function dialogueTokenLimit(value, age) {
	return { brief: 96, balanced: 160, rich: 300 }[normalizeDialogueStyle(value, age).response];
}

export function dialogueStylePrompt(value, age) {
	const s = normalizeDialogueStyle(value, age);
	const child = Number.isFinite(Number(age)) && Number(age) < 18;
	return [
		'Keep a distinct voice faithful to this person’s age, temperament, relationships and experience. Have opinions, disagree naturally and ask a relevant question when curious; do not turn everyone into an agreeable tour guide.',
		s.tone === 'mature'
			? 'Mature dialogue is enabled: natural profanity, dark humour and frank discussion of adult life, non-explicit relationships, grief, conflict, politics, alcohol and addiction are welcome when relevant. Swear only when this person would; do not force profanity, cruelty or edgy topics into every reply.'
			: 'Keep the language clean and age-appropriate, without profanity or graphic detail. You can still be funny, flawed, candid and emotionally specific.',
		child ? 'This NPC is a child: use an age-appropriate voice and subjects; never sexualize them or involve them in adult sexual dialogue.' : '',
		s.vividness === 'bold'
			? 'Use vivid, concrete details, distinct opinions, tension, wit and occasional surprises grounded in established game facts. Invent personal colour, never unverified quest outcomes, world changes or rewards.'
			: 'Use a grounded, understated voice with one specific detail when it helps; avoid theatrical speeches.',
		{ brief: 'Answer in one or two short sentences.', balanced: 'Usually answer in two or three short sentences.', rich: 'Use up to five sentences when the topic deserves it; keep simple exchanges short.' }[s.response],
		'Fictional conflict and mature discussion are allowed in context. Do not generate explicit sexual content, sexual content involving minors, hateful abuse toward protected groups, or actionable instructions for real-world harm. Keep refusals brief and in character; ordinary difficult topics do not need a lecture.',
	].filter(Boolean).join('\n');
}
