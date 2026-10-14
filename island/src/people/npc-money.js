// Money, as the quests see it: a small adapter in front of the bank (the economy keeps every
// account, household wallets and the daily settle in economy/bank.js). Until the bank is
// attached with use(bank) this stands in with balances kept in memory for the session,
// grown from each person's id, so rewards and loot still move and temptation still reads a
// balance.
//
//   earn(id, credits, kind, counterparty)   spend(id, credits, kind, counterparty)
//   transfer(from, to, credits, kind)       balance(id)
//   wealth(id)   -1 broke .. +1 well off, from the balance (the desperate are tempted more)
//   talk(id)     money facts for chatter and conversation (the bank's moneyTalk), or null

// where someone sits before anything has moved (seeded, so not all the same)
const startOf = (id) => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return 40 + ((h >>> 0) % 260); };
// about 150 credits is getting by; a thousand is well off
export const wealthOf = (credits) => Math.round(Math.max(-1, Math.min(1, Math.log10(Math.max(1, credits) / 150) / 0.8)) * 100) / 100;

export function createMoney(bank = null) {
	let B = bank;
	const mem = new Map();
	const has = (f) => typeof B?.[f] === 'function';
	const own = (id) => (mem.has(id) ? mem.get(id) : startOf(id));
	const amount = (c) => Math.max(0, Math.round(+c || 0));
	function earn(id, credits, kind = 'income', counterparty = null) {
		const n = amount(credits);
		if (!id || !n) return null;
		if (has('earn')) return B.earn(id, n, kind, counterparty);
		mem.set(id, own(id) + n);
		if (mem.size > 600) mem.delete(mem.keys().next().value);
		return own(id);
	}
	function spend(id, credits, kind = 'spending', counterparty = null) {
		const n = amount(credits);
		if (!id || !n) return null;
		if (has('spend')) return B.spend(id, n, kind, counterparty);
		mem.set(id, Math.max(0, own(id) - n));
		return own(id);
	}
	function transfer(from, to, credits, kind = 'transfer') {
		if (has('transfer')) return B.transfer(from, to, amount(credits), kind);
		const before = balance(from);
		spend(from, credits, kind, to);
		return earn(to, Math.min(amount(credits), before), kind, from);
	}
	function balance(id) { if (has('balance')) { const b = B.balance(id); return Number.isFinite(b) ? b : b?.credits ?? 0; } return own(id); }
	return {
		earn, spend, transfer, balance,
		wealth: (id) => wealthOf(balance(id)),
		talk: (id) => { try { return has('moneyTalk') ? B.moneyTalk(id) : null; } catch { return null; } },
		// the bank, once it is there (the main session attaches it)
		use(b) { B = b || null; },
		attached: () => !!B,
	};
}
