// JSON from a small model, taken as it comes. They wrap it in ```fences```, talk before and
// after it, use single quotes or smart quotes, leave keys bare, forget commas, leave
// trailing ones, put "quotes" inside strings, write True and None, and stop mid-word when
// the tokens run out. This reads all of that: it parses leniently from the first '{' and
// keeps whatever was complete when the text ends (an element cut off is dropped).
//
// looseJSON(text) -> { value, repaired, truncated } or null when there is nothing to read.

const ESC = { n: '\n', t: '\t', r: '', b: '', f: '', '"': '"', '\'': '\'', '\\': '\\', '/': '/' };
const ENDS = new Set(['}', ']', ':', '\n', '\r']);
const STARTS = /^(["'{[\]}\-\d]|true|false|null)/;

export function looseJSON(text) {
	if (typeof text !== 'string') return null;
	let s = text.replace(/```[a-zA-Z]*\s*/g, '').replace(/[“”„‟″«»]/g, '"').replace(/[‘’‚‛′]/g, '\'');
	const a = s.indexOf('{'), b = s.indexOf('[');
	const at = a < 0 ? b : b < 0 ? a : Math.min(a, b);
	if (at < 0) return null;
	s = s.slice(at);
	try { return { value: JSON.parse(s), repaired: false, truncated: false }; } catch { /* sloppy: read it by hand */ }
	const P = reader(s);
	const value = P.value();
	return value === undefined ? null : { value, repaired: true, truncated: P.truncated() };
}

function reader(s) {
	const n = s.length;
	let i = 0, cut = false;
	function ws() {
		for (;;) {
			while (i < n && /\s/.test(s[i])) i++;
			if (s[i] === '/' && s[i + 1] === '/') { while (i < n && s[i] !== '\n') i++; continue; }
			if (s[i] === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
			return;
		}
	}
	function value() {
		ws();
		if (i >= n) { cut = true; return undefined; }
		const c = s[i];
		if (c === '{') return object();
		if (c === '[') return array();
		if (c === '"' || c === '\'') return string(c);
		return bare();
	}
	function object() {
		i++;
		const o = {};
		for (;;) {
			ws();
			if (i >= n) { cut = true; return o; }
			const c = s[i];
			if (c === '}' || c === ']') { i++; return o; }
			if (c === ',' || c === ';') { i++; continue; }
			let k;
			if (c === '"' || c === '\'') { k = string(c); if (k === undefined) return o; } else {
				const m = /^[^:,{}[\]\s"']+/.exec(s.slice(i, i + 80));
				if (!m) { i++; continue; }
				k = m[0]; i += k.length;
			}
			ws();
			if (s[i] === ':' || s[i] === '=') i++;
			const v = value();
			if (v === undefined) return o;
			o[k] = v;
		}
	}
	function array() {
		i++;
		const a = [];
		for (;;) {
			ws();
			if (i >= n) { cut = true; return a; }
			const c = s[i];
			if (c === ']' || c === '}') { i++; return a; }
			if (c === ',' || c === ';') { i++; continue; }
			const v = value();
			if (v === undefined) return a;
			a.push(v);
		}
	}
	// a quote ends the string only where a separator, another string (a comma forgotten) or the
	// end follows it; a comma counts only when a value follows it. Otherwise the quote was a
	// quote or an apostrophe inside the text
	function string(q) {
		i++;
		let out = '';
		while (i < n) {
			const c = s[i];
			if (c === '\\') {
				const e = s[i + 1];
				if (e === undefined) break;
				if (e === 'u') { const h = parseInt(s.slice(i + 2, i + 6), 16); out += Number.isFinite(h) ? String.fromCharCode(h) : ''; i += 6; continue; }
				out += ESC[e] ?? e; i += 2; continue;
			}
			if (c === q) {
				let j = i + 1;
				while (j < n && (s[j] === ' ' || s[j] === '\t')) j++;
				if (j >= n || ENDS.has(s[j]) || s[j] === q) { i++; return out; }
				if (s[j] === ',') {
					let k = j + 1;
					while (k < n && /\s/.test(s[k])) k++;
					if (k >= n || STARTS.test(s.slice(k, k + 5))) { i++; return out; }
					// a bare word: the string ended, unless its own quote comes before the next separator
					let e = k;
					while (e < n && s[e] !== q && !ENDS.has(s[e]) && s[e] !== ',') e++;
					if (s[e] !== q) { i++; return out; }
				}
			}
			out += c === '\n' || c === '\r' ? ' ' : c;
			i++;
		}
		cut = true;
		return undefined;
	}
	function bare() {
		const m = /^[^,}\]\n]*/.exec(s.slice(i));
		i += m[0].length;
		const t = m[0].trim().replace(/[;]$/, '');
		if (!t) { i++; return undefined; }
		if (i >= n) cut = true;
		if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return +t;
		if (/^(true|True|yes)$/.test(t)) return true;
		if (/^(false|False|no)$/.test(t)) return false;
		if (/^(null|None|undefined|nil)$/.test(t)) return null;
		return t;
	}
	return { value, truncated: () => cut };
}
