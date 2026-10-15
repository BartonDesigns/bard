// Illustrated trade marks; names, hours and navigational information remain real text.
// Generated once at build time, never a network image-generation call during play.
import { BRAND_FAMILIES, brandName, brandCategory, brandIdentity } from './brand-catalog.js';
import { hash32, rng } from './rand.js';

export const ART_FAMILIES = Object.freeze(['heritage', 'mystic', 'modern', 'orbital', 'commerce', 'consumer', ...BRAND_FAMILIES]);
export const TRADE_LABELS = Object.freeze(['Baker', 'Smith', 'Apothecary', 'Inn', 'Music', 'Cloth', 'Fishmonger', 'Market']);
const sheets = new Map();
let revision = 0;
export const artRevision = () => revision;
export function artFamily(profile = {}) {
	if (profile.type === 'MYSTICAL' || profile.civ?.village === 'fae') return 'mystic';
	if (profile.realm || profile.type === 'MEDIEVAL') return 'heritage';
	if (profile.airless || ['GAS', 'TOXIC', 'MAGMA'].includes(profile.type) || ['dome', 'bunker'].includes(profile.civ?.village)) return 'orbital';
	return profile.type === 'BAYAREA' ? 'modern' : 'heritage';
}
export function tradeFor(type = '') {
	const t = String(type).toLowerCase();
	if (/bake|bread|cafe|coffee|tea|restaurant|diner|pizza/.test(t)) return 0;
	if (/smith|forge|hardware|repair|mechanic|workshop|garage/.test(t)) return 1;
	if (/apothecary|pharm|herb|florist|garden/.test(t)) return 2;
	if (/^(inn|tavern|pub|bar|hotel|guesthouse|lodging|bnb)$/.test(t)) return 3;
	if (/music|instrument/.test(t)) return 4;
	if (/cloth|tailor|boutique|laundr|textile/.test(t)) return 5;
	if (/fish|bait|seafood|boatyard/.test(t)) return 6;
	if (/market|grocer|general|provision/.test(t)) return 7;
	return -1;
}
export function loadSignArt(family, phone = false) {
	if (!ART_FAMILIES.includes(family) || typeof Image === 'undefined') return Promise.resolve(false);
	const key = family + (phone ? '-mobile' : '');
	if (sheets.has(key)) return sheets.get(key).promise;
	const img = new Image();
	const entry = { img, ready: false, promise: null };
	entry.promise = new Promise(resolve => {
		img.onload = () => { entry.ready = true; revision++; resolve(true); };
		img.onerror = () => resolve(false); // procedural faces remain usable
	});
	sheets.set(key, entry);
	img.decoding = 'async';
	// Resolved beside the shipped island/dist entry bundle (also used by review bundles).
	img.src = new URL(`../assets/signage/${family}-v1${phone ? '-mobile' : ''}.webp`, import.meta.url).href;
	return entry.promise;
}
export function drawEmblem(g, x, y, size, family, trade, phone = false) {
	if (!Number.isInteger(trade) || trade < 0 || trade > 7) return false;
	loadSignArt(family, phone);
	const a = sheets.get(family + (phone ? '-mobile' : ''));
	if (!a?.ready) return false;
	const cw = a.img.naturalWidth / 4, ch = a.img.naturalHeight / 2;
	g.drawImage(a.img, trade % 4 * cw, Math.floor(trade / 4) * ch, cw, ch, x, y, size, size);
	return true;
}
function line(g, str, x, y, maxW, px, color, serif = true) {
	g.textAlign = 'center'; g.textBaseline = 'middle';
	const font = serif ? 'Georgia, "Times New Roman", serif' : 'Arial, sans-serif';
	g.font = `bold ${px}px ${font}`;
	const fit = Math.min(1, maxW / Math.max(1, g.measureText(String(str)).width));
	g.font = `bold ${px * fit}px ${font}`;
	g.fillStyle = color; g.fillText(String(str), x, y);
}
export function drawTradeBoard(g, x, y, w, h, E, { family = 'modern', phone = false, portrait = false } = {}) {
	const trade = E.trade ?? tradeFor(E.type);
	if (trade < 0) return false;
	const old = family === 'heritage' || family === 'mystic', mystical = family === 'mystic';
	const bg = old ? (mystical ? '#183e39' : '#30251d') : E.sign?.bg || '#163c45';
	const ink = old ? '#f2dfae' : E.sign?.fg || '#fff1cb';
	g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
	g.fillStyle = bg; g.fillRect(x, y, w, h);
	if (old) {
		const r = rng(hash32(E.name || E.type || 'guild'));
		for (let i = 0; i < 45; i++) {
			const yy = y + r() * h;
			g.strokeStyle = i % 3 ? 'rgba(9,5,2,.22)' : 'rgba(225,189,123,.12)'; g.lineWidth = Math.max(.4, h / 220);
			g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + w * .3, yy - r() * 6, x + w * .7, yy + r() * 6, x + w, yy); g.stroke();
		}
	}
	const pad = Math.max(2, h * .035);
	if (old || hash32(E.name || '') % 4 === 0) {
	g.strokeStyle = old ? '#b59a59' : ink; g.lineWidth = Math.max(.6, h * .012);
	g.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
	g.globalAlpha = .45; g.strokeRect(x + pad * 1.65, y + pad * 1.65, w - pad * 3.3, h - pad * 3.3); g.globalAlpha = 1;
	}
	const size = portrait ? Math.min(w * .88, h * .66) : h * .82;
	const ex = portrait ? x + (w - size) / 2 : x + h * .09, ey = portrait ? y + h * .055 : y + h * .09;
	if (!drawEmblem(g, ex, ey, size, family, trade, phone)) {
		// A dignified fallback while decoding or offline, not a blank sign.
		line(g, TRADE_LABELS[trade], ex + size / 2, ey + size / 2, size * .9, size * .18, ink);
	}
	const cx = portrait ? x + w / 2 : x + h + (w - h) / 2;
	const room = portrait ? w * .85 : w - h - pad * 4;
	line(g, E.name || TRADE_LABELS[trade], cx, y + h * (portrait ? .78 : .43), room, h * (portrait ? .09 : .28), ink, old || E.sign?.font === 'serif');
	if (E.tag) line(g, E.tag, cx, y + h * (portrait ? .9 : .73), room * .94, h * (portrait ? .048 : .115), ink, false);
	g.restore(); return true;
}

// Brand marks are product suppliers, never a replacement for a place's real name.
export const CONSUMER_BRANDS = Object.freeze(['morrow', 'LOOP', 'DAYBREAK', 'plain', 'OAT & CO.', 'POMIERO', 'little orchard', 'tidy']);
export const PRODUCT_LABELS = Object.freeze(['Mobile', 'Network', 'Coffee', 'Milk', 'Oats', 'Pasta', 'Fruit', 'Home care', 'Snacks', 'Drinks', 'Pantry', 'Bread']);
export function retailIdentity(type = '', seed = '') {
	const category = brandCategory(type), identity = category && brandIdentity(category, seed);
	if (identity) return { ...identity, label: /phone|mobile/.test(type) ? 'PHONE REPAIR' : type.replace(/fix$/, ' repair'), ...(/phone|mobile/.test(type) ? { ad: identity.brand.toLowerCase().replace(/[^a-z0-9]/g, '') + '.example' } : {}) };
	if (/phone|mobile|telecom/.test(type)) return { family: 'consumer', trade: 0, label: 'PHONE REPAIR', ad: 'morrow.example' };
	if (/coffee|cafe/.test(type)) return { family: 'consumer', trade: 2, label: 'COFFEE' };
	const trade = tradeFor(type);
	return { family: 'modern', trade, label: TRADE_LABELS[trade] || type };
}
export function drawBanner(g, x, y, w, h, E, { phone = false } = {}) {
	const family = E.family || 'modern', markFamily = E.artFamily || family, markTrade = E.artTrade ?? E.trade, branded = markFamily.startsWith('brands-'), old = !branded && ['heritage', 'mystic'].includes(family);
	const ink = old ? '#f1ddb2' : '#18282c';
	g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
	g.fillStyle = old ? (family === 'mystic' ? '#214b43' : '#7b3028') : '#f5eedc'; g.fillRect(x, y, w, h);
	// Open composition; no enclosing border, crest, sticker edge or ornamental frame.
	const size = w * .92;
	const ready = drawEmblem(g, x + .04*w, y + .14*h, size, markFamily, markTrade, phone);
	if (!ready) line(g, brandName(markFamily,markTrade) || (family === 'consumer' ? CONSUMER_BRANDS[E.trade] : TRADE_LABELS[E.trade]), x+w/2, y+h*.3, w*.85, w*.16, ink, old);
	const words = String(E.label || E.tag || 'Provisions').split(/\s+/).slice(0, 4);
	words.forEach((word, i) => line(g, word, x + w*.5, y + h*.56 + i*h*.065, w*.82, w*.2, ink, old));
	if (E.request) line(g, 'HELP WANTED', x+w*.5, y+h*.815, w*.87, w*.12, ink, false);
	line(g, E.name || '', x+w*.5, y+h*.88, w*.86, w*.105, ink, old);
	if (E.ad) {
		line(g, 'Join online', x+w*.5, y+h*.935, w*.88, w*.075, ink, false);
		line(g, E.ad, x+w*.5, y+h*.97, w*.9, w*.075, ink, false);
	}
	// One hem, a construction detail rather than a graphic border.
	g.fillStyle = old ? 'rgba(240,213,162,.22)' : 'rgba(20,40,50,.12)'; g.fillRect(x,y+h*.99,w,Math.max(1,h*.006));
	g.restore(); return true;
}
export function drawProduct(g, x, y, w, h, f) {
	const product = Math.max(2, Math.min(11, f.product ?? 4));
	const identity = f.brandFamily ? {family:f.brandFamily,trade:f.brandIndex} : null;
	const colors = ['','','#f2d4b5','#eef4f3','#e9d7ac','#ffeed2','#f5edb9','#e4eef5','#f0d9b2','#e2eef0','#ecdfc5','#f3ddb7'];
	g.save(); g.fillStyle = colors[product]; g.fillRect(x,y,w,h);
	const size = Math.min(w*.96,h*.8);
	if (!drawEmblem(g,x+(w-size)/2,y+h*.08,size,identity?.family || 'consumer',identity?.trade ?? product,!!f.phone)) line(g,identity ? brandName(identity.family,identity.trade) : CONSUMER_BRANDS[product],x+w/2,y+h*.4,w*.9,h*.13,'#213537',false);
	line(g,PRODUCT_LABELS[product].toUpperCase(),x+w/2,y+h*.88,w*.9,h*.10,'#213537',false);
	g.restore();
}

// One campaign, several print formats; type stays real Canvas text at any size.
export function drawCampaign(g,x,y,w,h,f){
 const wide=w>h*1.5, flag=f.format==='flag', mural=f.format==='mural';
 const palette=[['#f7edcf','#cc4b2c'],['#e5efdd','#24705c'],['#e7eff2','#245a88'],['#f0dfd5','#953d55']][f.variant%4||0];
 g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.fillStyle=palette[0];g.fillRect(x,y,w,h);
 // Solid color fields and a single oversized curve: no badge or sticker frame.
 g.fillStyle=palette[1];
 if(f.variant%2){g.beginPath();g.arc(x+w*1.12,y+h*1.08,Math.min(w,h)*.34,0,Math.PI*2);g.fill();}
 else g.fillRect(x,y+h*.93,w,h*.07);
 const size=wide?Math.min(h*.9,w*.43):Math.min(w*.94,h*(flag?.9:.56));
 const ex=wide?x+w*.035:x+(w-size)/2, ey=wide?y+(h-size)/2:y+h*(mural?.13:.025);
 if(!drawEmblem(g,ex,ey,size,f.family,f.trade,!!f.phone))line(g,brandName(f.family,f.trade),ex+size/2,ey+size/2,size*.9,size*.15,'#20352f',false);
 if(!flag){const cx=wide?x+w*.71:x+w/2, room=wide?w*.5:w*.86;
 line(g,f.headline||'',cx,y+h*(wide?.4:.66),room,Math.min(h*.12,w*.075),'#20352f',false);
 line(g,f.label||'',cx,y+h*(wide?.64:.78),room,Math.min(h*.08,w*.05),'#20352f',false);
 if(f.name)line(g,f.name,cx,y+h*(wide?.82:.87),room,Math.min(h*.065,w*.04),'#20352f',false);
 }
 if(f.format==='pamphlet'){g.strokeStyle='rgba(40,40,20,.18)';g.lineWidth=Math.max(1,w*.006);g.beginPath();g.moveTo(x+w*.47,y);g.lineTo(x+w*.52,y+h);g.stroke();}
 g.restore();
}
