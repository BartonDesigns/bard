// Small, data-only presentation helpers. No journal line is an instruction and
// no rendered explanation can complete a task or transfer an item.
const text = (v, max = 240) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const stateLabel = state => ({open:'Looking for help',active:'Under way',working:'Under way',reserved:'Reserved for you',paused:'Paused','awaiting-confirmation':'Awaiting a report',completed:'Completed',failed:'Could not finish'}[state] || text(state,90).replaceAll('-', ' '));
const reasonLabel = reason => ({'player-reserved':'Reserved for your help.','site-destroyed':'The work site was destroyed.','site-inaccessible':'The work site cannot be reached safely.','local-emergency':'People are waiting for the local emergency to pass.','giver-unavailable':'The requester is unavailable.','actor-unavailable':'The helper is unavailable.','agreed-delay':'The requester agreed to wait for a better moment.'}[reason] || text(reason,320));
export function activityScopeText(snapshot = {}) {
	if(typeof snapshot.scope==='string')return text(snapshot.scope,300);
	const name=text(snapshot.scope?.name,120), status=snapshot.mode==='shared'?'Shared local activity':snapshot.mode==='offline'?'Shared record offline; reconnect before changing reservations':snapshot.savedLocally===false?'Activity is not safely saved yet':'Activity saved on this device';
	return [name,status].filter(Boolean).join(' · ');
}
export function activityCards(snapshot = {}, offset = 0) {
	const priority=a=>a.canProgress?0:a.state==='active'?1:/^(completed|failed)/.test(a.state)?3:2;
	return (Array.isArray(snapshot.activities) ? snapshot.activities : []).filter(a => a && typeof a.id === 'string').slice().sort((a,b)=>priority(a)-priority(b)).slice(Math.max(0,offset), Math.max(0,offset)+6).map(a => {
		const history = (Array.isArray(a.history) ? a.history : []).slice(-3).map(h => text(typeof h === 'string' ? h : h?.message || h?.text || h?.line, 220)).filter(Boolean);
		const choices = (Array.isArray(a.choices) ? a.choices : []).slice(0, 4).filter(c => c && typeof c.id === 'string').map(c => ({id:c.id,label:text(c.label, 100),reason:text(c.reason, 180)}));
		return { ...a, title:text(a.title, 120) || 'Local work', npcName:text(a.npcName, 80), place:text(typeof a.place === 'string' ? a.place : a.place?.name, 100), reason:reasonLabel(a.reason), state:stateLabel(a.state), instruction:text(a.instruction, 240), history, choices,
			line:[`${text(a.title, 120) || 'Local work'}${a.state ? ' · '+stateLabel(a.state) : ''}`, [text(a.npcName,80),text(typeof a.place === 'string' ? a.place : a.place?.name,100)].filter(Boolean).join(' · '), reasonLabel(a.reason), text(a.instruction,240)].filter(Boolean).join('\n') };
	});
}
export function agreementTerms(offer) {
	if (!offer || !offer.id || !Number.isFinite(offer.price) || offer.price < 0) return null;
	const condition = text(typeof offer.condition === 'string' ? offer.condition : offer.condition?.label, 300);
	const lines = [`${text(offer.itemName,100) || 'Item'} · ${offer.price.toLocaleString()} credits`];
	if (Number.isFinite(offer.askingPrice) && offer.askingPrice !== offer.price) lines.push(`Usual asking price: ${offer.askingPrice.toLocaleString()} credits.`);
	if (condition) lines.push('Condition: '+condition);
	if (offer.status === 'redeemed') lines.push('Exchange completed.');
	else if (offer.status === 'accepted') lines.push(condition ? 'Agreement saved. The condition must be verified before exchange.' : 'Agreement saved. Confirm the exchange to receive the item.');
	else lines.push('Review these terms. Nothing is purchased until you confirm.');
	return {line:lines.join('\n'),action:offer.status === 'quoted' ? 'confirm' : offer.status === 'accepted' ? 'redeem' : null,label:offer.status === 'quoted' ? 'Confirm these terms' : 'Complete agreed exchange'};
}
