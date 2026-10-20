// The touch screen's controls in one look: round, semi-transparent buttons with a white line
// glyph and no words, laid out by thumb. Only on a touch screen (the mount's l99-touch class);
// the mouse and keyboard keep the HUD as it was.
//
// Every module still makes its own buttons and keeps its own bindings. This dresses them: a
// button in the HUD is matched by its name (aria-label, title or text) to a glyph, drawn in CSS
// as an inline SVG mask, and its words are hidden. The name stays on the button for screen
// readers (a button without one is given its own text as its name). A button nothing here
// knows still shows no words: it gets the general "act here" glyph (a pointing hand).
//
// The layout, from the bottom right corner inside the safe area (both orientations):
//   P   the primary action, 68 px: Fire (Draw/Release), Strike, the pedal (go), the cast
//   L1  left of P, 52 px: Aim, Block, the brake
//   D1  up and left of P, 52 px: Reload, Dodge, a vehicle's gun
//   D2  further out on that diagonal: fire Mode, Grab or Takedown
//   L2  left of L1: Surrender
//   the column above P: jump (climb, dive) and descend, then the context buttons (the boat,
//   the rod, leaving the car, which car, assist, the camera); it wraps leftwards when short
// and from the bottom left: the resting stick on foot, or steer left and right in a vehicle
// (with climb and descend above them in an aircraft). Things you can act on nearby (talk,
// use, doors, pick up) sit in a row between the thumbs. Along the top: back on the left (the
// homes and the contract below it), the rest on the right in one row. Tips sit under the
// top row, clear of every button.

const SVG = (paths) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${paths}</svg>`)}")`;

// 24 px line glyphs (a mask: only their shape matters)
export const GLYPHS = {
	back: "<path d='M15 5l-7 7 7 7'/>",
	sun: "<circle cx='12' cy='12' r='4'/><path d='M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'/>",
	music: "<path d='M9 18V5.5l11-2V16'/><circle cx='6.5' cy='18' r='2.5'/><circle cx='17.5' cy='16' r='2.5'/>",
	menu: "<rect x='4' y='4' width='6.5' height='6.5' rx='1.6'/><rect x='13.5' y='4' width='6.5' height='6.5' rx='1.6'/><rect x='4' y='13.5' width='6.5' height='6.5' rx='1.6'/><rect x='13.5' y='13.5' width='6.5' height='6.5' rx='1.6'/>",
	close: "<path d='M6 6l12 12M18 6 6 18'/>",
	plane: "<path d='M12 3.5c1 0 1.5 1 1.5 2.5v3.5l7 4.5v2l-7-2.2V18l2.2 1.8V21L12 20l-3.7 1v-1.2L10.5 18v-4.2l-7 2.2v-2l7-4.5V6c0-1.5.5-2.5 1.5-2.5z'/>",
	bag: "<path d='M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z'/><path d='M9.5 5.5V4.5a2.5 2.5 0 0 1 5 0v1'/><path d='M9 14.5h6v3H9z'/>",
	pin: "<path d='M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z'/><circle cx='12' cy='10' r='2.3'/>",
	warp: "<path d='M5 18c2-8 10-12 14-9s-2 9-7 7'/><path d='M15.5 4.5 19.5 9l-5.2 1'/>",
	jump: "<path d='M12 20V8M6.5 13.5 12 8l5.5 5.5M6 4h12'/>",
	climb: "<path d='M6 12.5l6-6 6 6M6 18.5l6-6 6 6'/>",
	crouch: "<circle cx='14.5' cy='4.8' r='2.2'/><path d='M13.5 8.5 10 14l6 1.5-1.5 5.5M10 14l-2.5 6.5M12.5 10.5l4 1.5'/>",
	descend: "<path d='M6 5.5l6 6 6-6M6 11.5l6 6 6-6'/>",
	dive: "<path d='M12 3v10M7.5 8.5 12 13l4.5-4.5'/><path d='M3 18.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1'/>",
	swimup: "<path d='M12 14V3M7.5 7.5 12 3l4.5 4.5'/><path d='M3 18.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1'/>",
	fire: "<circle cx='12' cy='12' r='7.5'/><circle cx='12' cy='12' r='2.4' fill='#000'/>",
	bow: "<path d='M7 3c6.5 3.5 6.5 14.5 0 18'/><path d='M7 3v18'/><path d='M4 12h14M15 9l3 3-3 3'/>",
	cannon: "<circle cx='12' cy='12' r='3' fill='#000'/><path d='M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M5.3 18.7l2.8-2.8M15.9 8.1l2.8-2.8'/>",
	aim: "<circle cx='12' cy='12' r='6.5'/><path d='M12 2.5v4.5M12 17v4.5M2.5 12H7M17 12h4.5'/><circle cx='12' cy='12' r='1' fill='#000'/>",
	reload: "<path d='M19.5 12.5a7.5 7.5 0 1 1-2.2-5.8'/><path d='M19.5 4v4.5H15'/>",
	semi: "<path d='M10 20v-9.5c0-2.5 1-4.5 2-5.5 1 1 2 3 2 5.5V20z'/>",
	burst: "<path d='M7 20v-9.5c0-2.5 1-4.5 2-5.5 1 1 2 3 2 5.5V20z'/><path d='M13 20v-9.5c0-2.5 1-4.5 2-5.5 1 1 2 3 2 5.5V20z'/>",
	auto: "<path d='M4 20v-9.5c0-2.5 1-4.5 2-5.5 1 1 2 3 2 5.5V20z'/><path d='M10 20v-9.5c0-2.5 1-4.5 2-5.5 1 1 2 3 2 5.5V20z'/><path d='M16 20v-9.5c0-2.5 1-4.5 2-5.5 1 1 2 3 2 5.5V20z'/>",
	fist: "<path d='M7 11V8.5a1.5 1.5 0 0 1 3 0V11m0-2.5V7a1.5 1.5 0 0 1 3 0v4m0-3a1.5 1.5 0 0 1 3 0v3.5m0-2a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 5 14.5V13a2 2 0 0 1 2-2h3'/>",
	swing: "<path d='M5 19 17 7'/><path d='M14.5 4.5a3 3 0 0 1 5 5l-3 3-5-5z'/><path d='M3.5 20.5l2-2'/>",
	slash: "<path d='M4.5 19.5l2.5-2.5M5.5 14.5l4 4'/><path d='M8 16 18.5 5.5c1 2.5 0 6.5-3 9.5L11.5 18.5'/>",
	heavy: "<path d='M7 4h10v7H7zM10 11v8h4v-8M4 12v6m-2-2 2 2 2-2M20 12v6m-2-2 2 2 2-2'/>",
	block: "<path d='M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z'/>",
	dodge: "<path d='M4 12h11M11 7l5 5-5 5M19.5 5v14'/>",
	grab: "<path d='M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12m0-5a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7H9a5 5 0 0 1-4.6-3l-1.2-2.8a1.4 1.4 0 0 1 2.4-1.4L8 15'/>",
	takedown: "<path d='M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12m0-5a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7H9a5 5 0 0 1-4.6-3l-1.2-2.8a1.4 1.4 0 0 1 2.4-1.4L8 15'/><path d='M19 3.5v3M17.5 5h3'/>",
	throw: "<path d='M4 19c2-8 8-12 15-11'/><path d='M15.5 4.5 19 8l-4 2.5'/>",
	surrender: "<path d='M6 21V3.5'/><path d='M6 4.5c2.5-1.5 4.5-.5 6.5.5s4 1.5 6-.5v8c-2 2-4 1.5-6 .5s-4-2-6.5-.5'/>",
	road: "<path d='M9 3 5 21M15 3l4 18'/><path d='M12 4v2.5M12 10v3M12 17v3.5'/>",
	exit: "<path d='M13 4H6v16h7'/><path d='M10.5 12H21M17.5 8.5 21 12l-3.5 3.5'/>",
	car: "<path d='M5.5 15.5l1.6-5A2 2 0 0 1 9 9h6a2 2 0 0 1 1.9 1.5l1.6 5'/><rect x='3.5' y='12.5' width='17' height='5' rx='1.5'/><path d='M6 17.5V20M18 17.5V20'/>",
	wheel: "<circle cx='12' cy='12' r='8.5'/><circle cx='12' cy='12' r='2'/><path d='M12 14v6.5M10.1 11.4 3.8 9.8M13.9 11.4l6.3-1.6'/>",
	assist: "<path d='M7 21 10.5 3M17 21 13.5 3'/><path d='M9.5 14.5 12 12l2.5 2.5M12 12v7'/>",
	camera: "<rect x='2.5' y='7' width='13' height='10' rx='2'/><path d='m15.5 10.5 6-3v9l-6-3'/>",
	left: "<path d='M6.5 12 16 5.5v13z' fill='#000'/>",
	right: "<path d='M17.5 12 8 5.5v13z' fill='#000'/>",
	up: "<path d='M12 6.5 18.5 16h-13z' fill='#000'/>",
	down: "<path d='M12 17.5 18.5 8h-13z' fill='#000'/>",
	boat: "<path d='M3 15h18l-2.5 4.5h-13z'/><path d='M12 3v12M12 4l5.5 8H12'/>",
	rod: "<path d='M3 21 19 4'/><circle cx='7.2' cy='15.2' r='2'/><path d='M19 4v9.5'/><circle cx='19' cy='15.2' r='1.4'/>",
	cast: "<path d='M4 20 16 6'/><path d='M16 6c2.5 2 3.8 5.5 3 10'/><circle cx='19' cy='18' r='1.6'/>",
	hook: "<path d='M15 3v10a4 4 0 0 1-8 0v-1.5l-2.5 2'/><circle cx='15' cy='3.5' r='.8'/>",
	reel: "<circle cx='12' cy='12' r='7.5'/><circle cx='12' cy='12' r='2'/><path d='M13.5 10.5 17 7'/><circle cx='17.5' cy='6.5' r='1.3'/>",
	talk: "<path d='M20 14.5a2 2 0 0 1-2 2H9.5L5 20.5V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z'/>",
	chat: "<path d='M15.5 11a1.8 1.8 0 0 1-1.8 1.8H7.5L4 16V5.8A1.8 1.8 0 0 1 5.8 4h7.9a1.8 1.8 0 0 1 1.8 1.8z'/><path d='M18 9h.2A1.8 1.8 0 0 1 20 10.8V20l-3.5-3.2h-5.7a1.8 1.8 0 0 1-1.8-1.8v-.2'/>",
	help: "<path d='M20 14.5a2 2 0 0 1-2 2H9.5L5 20.5V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z'/><path d='M10.5 8.6a2 2 0 1 1 2.6 1.9c-.6.2-1 .7-1 1.3'/><circle cx='12.1' cy='13.6' r='.35' fill='#000'/>",
	use: "<circle cx='12' cy='12' r='8.5'/><path d='M12 8v8M8 12h8'/>",
	medic: "<path d='M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z'/>",
	crate: "<path d='M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z'/><path d='M3.5 7.5 12 11.5l8.5-4M12 11.5v9'/>",
	door: "<path d='M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17'/><path d='M3.5 21h17'/><circle cx='14.8' cy='12.5' r='.9' fill='#000'/>",
	pickup: "<path d='M12 3v10M8 9l4 4 4-4'/><path d='M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3'/>",
	putdown: "<path d='M12 3v11M7.5 9.5 12 14l4.5-4.5M5 19.5h14'/>",
	pen: "<path d='M15.5 4.5l4 4L9 19l-5 1 1-5z'/><path d='M13.5 6.5l4 4'/>",
	home: "<path d='M4 11.5 12 4.5l8 7'/><path d='M6.5 10v10h11V10'/><path d='M10 20v-5h4v5'/>",
	contract: "<rect x='5.5' y='4.5' width='13' height='16.5' rx='2'/><path d='M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3.5'/>",
	bell: "<path d='M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z'/><path d='M10 20.5a2 2 0 0 0 4 0'/>",
	play: "<path d='M8.5 5.5v13l10-6.5z'/>",
	tap: "<path d='M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1a1.5 1.5 0 0 1 3 0v1.5m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a5 5 0 0 1-4.3-2.5L5 15.8a1.4 1.4 0 0 1 2.3-1.6L9 16'/>",
	scroll: "<path d='M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z'/><path d='M10 9h4M10 12.5h4'/>",
};

// a HUD button's name and words to its glyph (first match wins); a: the name, t: the words
const RULES = [
	[(a) => /^Back to the Bard/.test(a), 'back'],
	[(a) => /^Sky and world settings/.test(a), 'sun'],
	[(a) => /^Chat$/.test(a), 'chat'],
	[(a) => /^Auto music/.test(a), 'music'],
	[(a) => /^All controls/.test(a), 'menu'],
	[(a) => /^Fly\b/.test(a), 'plane'],
	[(a) => /^Gear and trade/.test(a), 'bag'],
	[(a) => /^Teleport to a place/.test(a), 'pin'],
	[(a) => /^Warp\b/.test(a), 'warp'],
	[(a) => a === 'Jump', 'jump'],
	[(a) => a === 'Climb', 'climb'],
	[(a) => a === 'Dive', 'dive'],
	[(a) => a === 'Swim up', 'swimup'],
	[(a) => a === 'Descend', 'descend'],
	[(a) => /^Crouch\b/.test(a), 'crouch'],
	[(a) => /^(Draw|Release|Nocking)$/.test(a), 'bow'],
	[(a) => a === 'Cannon', 'cannon'],
	[(a) => a === 'Fire', 'fire'],
	[(a) => a === 'Up', 'climb'],
	[(a) => a === 'Down', 'descend'],
	[(a) => /^Aim\b/.test(a), 'aim'],
	[(a) => a === 'Reload', 'reload'],
	[(a, t) => a === 'Mode' && /AUTO/i.test(t), 'auto'],
	[(a, t) => a === 'Mode' && /BURST/i.test(t), 'burst'],
	[(a) => a === 'Mode', 'semi'],
	[(a) => a === 'Swing', 'swing'],
	[(a) => a === 'Slash', 'slash'],
	[(a) => /^Strike$|^Strike \(Q\)/.test(a), 'fist'],
	[(a) => a === 'Block', 'block'],
	[(a) => a === 'Heavy strike', 'heavy'],
	[(a) => a === 'Dodge', 'dodge'],
	[(a) => a === 'Grab', 'grab'],
	[(a) => a === 'Takedown', 'takedown'],
	[(a) => a === 'Throw' || /^Throw it/.test(a), 'throw'],
	[(a) => /^Surrender/.test(a), 'surrender'],
	[(a) => /^Stop driving/.test(a), 'exit'],
	[(a) => /^Drive the road/.test(a), 'road'],
	[(a) => /^Which car/.test(a), 'car'],
	[(a) => /^Let the road steer/.test(a), 'assist'],
	[(a) => /^Drive it yourself/.test(a), 'wheel'],
	[(a) => /^Camera\b/.test(a), 'camera'],
	[(a) => /^(Turn left next|Steer left)/.test(a), 'left'],
	[(a) => /^(Turn right next|Steer right)/.test(a), 'right'],
	[(a) => /^(Straight on|Go)$/.test(a), 'up'],
	[(a) => /^(Turn round|Brake)/.test(a), 'down'],
	[(a) => /^Take the boat out/.test(a), 'boat'],
	[(a) => /^Step off the boat/.test(a), 'exit'],
	[(a) => /^Fish\b/.test(a), 'rod'],
	[(a) => /^(Cast|…)/.test(a), 'cast'],
	[(a) => /^Strike!/.test(a), 'hook'],
	[(a) => /reel/i.test(a), 'reel'],
	[(a, t) => /^Talk/.test(a) && /Help/.test(t), 'help'],
	[(a) => /^Talk|^Speak/.test(a), 'talk'],
	[(a) => /^Use what you hold/.test(a), 'use'],
	[(a) => /door|slider/i.test(a) && /^(Open|Close)/.test(a), 'door'],
	[(a) => /^Pick up/.test(a), 'pickup'],
	[(a) => /^Put it down/.test(a), 'putdown'],
	[(a) => /^Tattoo studio/.test(a), 'pen'],
	[(a) => /treated|Pharmacy/.test(a), 'medic'],
	[(a) => /Supply cache/.test(a), 'crate'],
	[(a) => /home/i.test(a) && !/faceplate/.test(a), 'home'],
	[(a) => /^Field contracts/.test(a), 'contract'],
	[(a) => /^Strike the stone|stone/i.test(a), 'bell'],
	[(a) => /^Play\b/.test(a), 'play'],
	[(a) => a === 'Quest log', 'scroll'],
	[(a) => /^(Return to orbit|Leave the horizon)/.test(a), 'exit'],
	[(a) => /rhythm/i.test(a), 'music'],
];

// (the id in :not() lifts every rule here over the HUD's own touch rules in main.js)
const S = '#l99-island-mount.l99-touch.l99-skin:not(#l99-none)';
const P = 'right:calc(16px + var(--sr))!important;bottom:calc(16px + var(--sb))!important;width:68px!important;height:68px!important;';
const L1 = 'right:calc(100px + var(--sr))!important;bottom:calc(24px + var(--sb))!important;';
const D1 = 'right:calc(90px + var(--sr))!important;bottom:calc(90px + var(--sb))!important;';
const D2 = 'right:calc(144px + var(--sr))!important;bottom:calc(144px + var(--sb))!important;';
const L2 = 'right:calc(164px + var(--sr))!important;bottom:calc(24px + var(--sb))!important;';
const SLOT = 'position:absolute!important;left:auto!important;top:auto!important;margin:0!important;';
const CSS = `
${S}{--sl:env(safe-area-inset-left);--sr:env(safe-area-inset-right);--st:calc(env(safe-area-inset-top) + var(--vvt, 0px));--sb:calc(env(safe-area-inset-bottom) + var(--vvb, 0px));--qb:0px;--gs:23px;}
${S} [data-skin]{box-sizing:border-box!important;width:52px!important;height:52px!important;min-width:0!important;min-height:0!important;max-width:none!important;padding:0!important;border-radius:50%!important;border:1px solid rgba(255,255,255,.24)!important;background:rgba(12,16,20,.32)!important;color:rgba(255,255,255,.88)!important;box-shadow:0 1px 8px rgba(0,0,0,.16)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;text-shadow:none!important;opacity:1;touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;transition:scale .08s ease,background-color .12s ease,border-color .12s ease!important;cursor:pointer;}
${S} [data-skin][data-glyph]{font-size:0!important;line-height:0!important;color:transparent!important;overflow:hidden!important;}
${S} [data-skin][data-glyph]>*{display:none!important;}
${S} [data-skin][data-glyph]>[data-chat-badge].on{display:block!important;top:1px;right:1px;}
${S} [data-skin][data-glyph]::before{content:'';position:absolute;left:50%;top:50%;width:var(--gs);height:var(--gs);margin:calc(var(--gs) / -2) 0 0 calc(var(--gs) / -2);background:rgba(255,255,255,.88);-webkit-mask:var(--glyph) center/contain no-repeat;mask:var(--glyph) center/contain no-repeat;pointer-events:none;}
${S} [data-skin][data-glyph]::after{content:none!important;}
${S} [data-skin]:active,${S} [data-skin].on{background:rgba(255,255,255,.26)!important;border-color:rgba(255,255,255,.62)!important;scale:.94;}
${S} [data-skin]:not([data-glyph="exit"]):is([aria-pressed="true"],[aria-expanded="true"],.lit,[style*="1, 169, 130"]){background:rgba(1,169,130,.42)!important;border-color:rgba(160,255,228,.78)!important;}
${S} [data-skin][disabled]{display:none!important;}
${S} [data-size="p"]{width:68px!important;height:68px!important;--gs:30px;}
${S} [data-size="s"]{width:44px!important;height:44px!important;--gs:20px;}
${S} [data-size="m"]{width:60px!important;height:60px!important;--gs:26px;}
${Object.entries(GLYPHS).map(([k, v]) => `${S} [data-glyph="${k}"]{--glyph:${SVG(v)};}`).join('\n')}

${S} .l99-joy{border:1px solid rgba(255,255,255,.3)!important;background:rgba(12,16,20,.22)!important;}
${S} .l99-joy:not(.held){opacity:.35!important;}
${S} .l99-joy>div{background:rgba(255,255,255,.5)!important;}

${S}>[aria-label^="Back to the Bard"]{${SLOT}left:calc(12px + var(--sl))!important;top:calc(12px + var(--st))!important;right:auto!important;bottom:auto!important;}
${S}>[aria-label^="Sky and world settings"]{${SLOT}right:calc(12px + var(--sr))!important;top:calc(12px + var(--st))!important;bottom:auto!important;}
${S}>[aria-label^="Auto music"]{${SLOT}right:calc(64px + var(--sr))!important;top:calc(12px + var(--st))!important;bottom:auto!important;}
${S} .l99-quick{top:max(calc(68px + var(--st)), var(--qb))!important;right:calc(12px + var(--sr))!important;flex-direction:column!important;gap:8px!important;}
${S}>[aria-label^="Warp"]{${SLOT}left:calc(12px + var(--sl))!important;right:auto!important;top:max(calc(68px + var(--st)), var(--qb))!important;bottom:auto!important;}
${S} [data-hud-text="room"]{left:calc(64px + var(--sl))!important;top:max(calc(68px + var(--st)), var(--qb))!important;}
${S} [data-hud-text="quest"]{top:calc(64px + var(--st))!important;max-width:calc(100% - 24px - var(--sl) - var(--sr))!important;}
${S} .l99-drive-hud{top:max(calc(64px + var(--st)), var(--qb))!important;}
${S} .cb-boss{top:max(calc(58px + var(--st)), var(--qb))!important;}
${S} .l99-left{top:max(calc(68px + var(--st)), var(--qb))!important;left:calc(12px + var(--sl))!important;max-width:calc(100% - 88px - var(--sl) - var(--sr))!important;}
${S} .cb-star{top:max(calc(70px + var(--st)), var(--qb))!important;right:calc(66px + var(--sr))!important;}
/* the combat Lock / Next dock: left of the right column and the spell button, not on them */
${S} .combat-focus-controls{right:calc(88px + var(--sr))!important;}
${S} .cb-ammo{background:rgba(12,16,20,.32)!important;border:1px solid rgba(255,255,255,.16);border-radius:12px!important;max-width:min(160px,calc(100% - 204px - var(--sl) - var(--sr)))!important;}
${S} .cb-ammo :is(.w,.rl){display:none!important;}
${S} .cb-hp{width:min(144px,calc(100% - 204px - var(--sl) - var(--sr)))!important;}
${S} .l99-prompts>[data-hud="prompt 99"]{background:rgba(12,16,20,.5)!important;color:rgba(255,255,255,.92)!important;}
@media (orientation:landscape) and (max-height:540px){
${S} .l99-quick{top:calc(12px + var(--st))!important;right:calc(116px + var(--sr))!important;flex-direction:row!important;}
${S} .cb-star{right:calc(16px + var(--sr))!important;}
${S} .cb-ammo{left:calc(120px + var(--sl))!important;top:calc(12px + var(--st))!important;bottom:auto!important;}
${S} .cb-hp{left:calc(292px + var(--sl))!important;top:calc(28px + var(--st))!important;bottom:auto!important;width:120px!important;}
}

${S} .l99-thumb{right:calc(24px + var(--sr))!important;bottom:calc(98px + var(--sb))!important;flex-direction:column-reverse!important;flex-wrap:wrap-reverse!important;align-items:center!important;align-content:flex-start!important;gap:12px!important;max-height:calc(100% - 98px - 80px - var(--sb) - var(--st))!important;}
${S} .l99-thumb>div:not([hidden]){display:contents!important;}
${S} .l99-thumb>.l99-big>*{order:1!important;}
${S} .l99-thumb>.l99-big>[aria-label="Descend"]{order:0!important;}
${S} .l99-thumb>.l99-side>*{order:2!important;}
${S} .l99-thumb>.l99-pill>*{order:3!important;}
${S} .l99-thumb>.l99-mode>*{order:4!important;}
${S} .l99-thumb [data-skin]{margin:0!important;}

${S} .l99-prompts{left:calc(112px + var(--sl))!important;right:calc(160px + var(--sr))!important;bottom:calc(16px + var(--sb))!important;flex-direction:row!important;flex-wrap:wrap-reverse!important;justify-content:center!important;align-items:flex-end!important;gap:12px!important;}
${S} .l99-prompts>[data-hud="prompt 99"]{position:fixed!important;left:50%!important;right:auto!important;top:max(calc(116px + var(--st)), calc(var(--qb) + 44px))!important;bottom:auto!important;transform:translateX(-50%)!important;width:max-content;max-width:calc(100% - 136px - var(--sl) - var(--sr))!important;box-sizing:border-box;z-index:7;}
${S} .l99-prompts>[data-hud="prompt 20"]{${SLOT}position:fixed!important;${P}z-index:7;}
@media (orientation:landscape) and (max-height:540px){
${S} .l99-prompts{left:calc(290px + var(--sl))!important;}
${S} .l99-prompts>[data-hud="prompt 99"]{top:max(calc(104px + var(--st)), calc(var(--qb) + 44px))!important;max-width:calc(100% - 420px - var(--sl) - var(--sr))!important;}
}

${S} .cb-btn[aria-label]{${SLOT}}
${S} .cb-btn:is([aria-label="Fire"],[aria-label="Draw"],[aria-label="Release"],[aria-label="Nocking"]){${P}}
${S} .cb-btn[aria-label="Reload"]{${D1}}
${S} .cb-btn[aria-label="Mode"]{right:calc(144px + var(--sr))!important;bottom:calc(144px + var(--sb))!important;}
${S}>button:is([aria-label="Aim"],[aria-label="Aim held item"]){${SLOT}${L1}touch-action:none!important;}
${S} .mc-btn{${SLOT}touch-action:none!important;}
${S} .mc-strike{${P}}
${S} .mc-block{${L1}}
${S} .mc-dodge{${D1}}
${S} .mc-grab{${D2}}
${S} .mc-heavy{right:calc(150px + var(--sr))!important;bottom:calc(84px + var(--sb))!important;}
${S}>[data-skin][aria-label^="Surrender"]{${SLOT}${L2}z-index:6;}
${S} .l99-mil[data-mil="fire"]{${SLOT}${D1}width:60px!important;height:60px!important;--gs:26px;}
${S} .l99-mil[data-mil="up"]{${SLOT}left:calc(22px + var(--sl))!important;right:auto!important;bottom:calc(94px + var(--sb))!important;}
${S} .l99-mil[data-mil="down"]{${SLOT}left:calc(102px + var(--sl))!important;right:auto!important;bottom:calc(94px + var(--sb))!important;}
${S} .l99-pad{position:absolute!important;inset:0!important;width:auto!important;height:auto!important;pointer-events:none;}
${S} .l99-pad>[data-skin]{${SLOT}pointer-events:auto;touch-action:none!important;}
${S} .l99-pad>[data-pedal="left"]{left:calc(16px + var(--sl))!important;right:auto!important;bottom:calc(16px + var(--sb))!important;width:64px!important;height:64px!important;--gs:26px;}
${S} .l99-pad>[data-pedal="right"]{left:calc(96px + var(--sl))!important;right:auto!important;bottom:calc(16px + var(--sb))!important;width:64px!important;height:64px!important;--gs:26px;}
${S} .l99-pad>[data-pedal="straight"]{${P}--gs:30px;}
${S} .l99-pad>[data-pedal="back"]{${L1}}
${S} [data-field-contract].cv-idle{padding:0!important;border:0!important;background:none!important;box-shadow:none!important;width:auto!important;overflow:visible!important;}
${S} [data-field-contract].cv-idle [data-skin]{flex:none!important;}

${S}.l99-c-fish :is(.mc-btn,.cb-btn,[aria-label="Aim"],[aria-label="Aim held item"]),${S}.l99-c-drive :is(.mc-btn,.cb-btn,[aria-label="Jump"]){display:none!important;}
${S}.l99-tools-open :is([data-skin],.l99-pad){visibility:hidden;}
${S}.l99-tools-open :is(.l99-quick,.l99-rail) [data-skin],${S}.l99-tools-open>[aria-label^="Back to the Bard"],${S}.l99-tools-open>[aria-label^="Sky and world"],${S}.l99-tools-open>[aria-label^="Auto music"]{visibility:visible;}
`;

// where a button may be dressed: straight in the mount, or in one of the HUD's groups (never
// in a menu, a panel or a dialog, which keep their words)
const GROUPS = ['l99-thumb', 'l99-big', 'l99-side', 'l99-pill', 'l99-mode', 'l99-quick', 'l99-prompts', 'l99-left', 'l99-pair', 'l99-pad'];
const name = (b) => (b.getAttribute('aria-label') || b.title || '').trim();
const words = (b) => (b.textContent || '').replace(/\s+/g, ' ').trim();
// a button's own words as its name: without emoji, key hints or a trailing arrow
const spoken = (t) => t.replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/[▸▾▴]/g, '').trim().replace(/^[^\p{L}\p{N}]+/u, '');

export function glyphFor(a, t = '') {
	for (const [test, g] of RULES) if (test(a, t)) return g;
	return null;
}

// once per device (or per visit, without storage): for a first-use tip on a touch screen
const seen = new Set();
export function firstTime(key) {
	if (seen.has(key)) return false;
	seen.add(key);
	try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); } catch { /* the visit's memory only */ }
	return true;
}

export function skinTouch(mount) {
	if (!mount?.classList.contains('l99-touch')) return { refresh() {}, dispose() {} };
	mount.classList.add('l99-skin');
	const style = document.createElement('style');
	style.textContent = CSS;
	mount.appendChild(style);
	const inScope = (b) => {
		// (a chip of text that can be tapped, such as the quest's: text, not a control)
		if (b.hasAttribute('data-hud-text')) return false;
		const cv = b.closest('[data-field-contract]');
		if (cv) return cv.classList.contains('cv-idle') && b.hasAttribute('data-cv-open');
		const p = b.parentElement;
		return !!p && (p === mount || GROUPS.some((g) => p.classList.contains(g)));
	};
	// (a button that leaves the HUD gets its words back, and the name given here goes)
	const undress = (b) => {
		if (b.hasAttribute('data-skin')) { b.removeAttribute('data-skin'); b.removeAttribute('data-glyph'); }
		if (b.dataset.skinName) { b.removeAttribute('aria-label'); delete b.dataset.skinName; }
	};
	function dress(b) {
		if (!(b instanceof HTMLButtonElement)) return;
		if (!inScope(b)) { undress(b); return; }
		const t = words(b);
		// (a name given here follows the button's words as they change)
		if (!b.getAttribute('aria-label') || b.dataset.skinName) {
			const n = spoken(t) || b.title;
			if (n && b.getAttribute('aria-label') !== n) { b.setAttribute('aria-label', n); b.dataset.skinName = '1'; }
		}
		if (!b.title && name(b)) b.title = name(b);
		// (nothing known: the general glyph, never words)
		const g = glyphFor(name(b), t) || glyphFor(spoken(t), t) || glyphFor(b.title || '', t) || 'tap';
		if (!b.hasAttribute('data-skin')) { b.setAttribute('data-skin', ''); b.addEventListener('touchstart', () => {}, { passive: true }); }
		const close = g === 'menu' && b.getAttribute('aria-expanded') === 'true' ? 'close' : g;
		if (close) { if (b.dataset.glyph !== close) b.dataset.glyph = close; } else if (b.hasAttribute('data-glyph')) b.removeAttribute('data-glyph');
		const size = b.matches('.cb-btn:is([aria-label="Fire"],[aria-label="Draw"],[aria-label="Release"],[aria-label="Nocking"]),.mc-strike,[data-hud="prompt 20"]') ? 'p'
			: b.matches('.cb-btn[aria-label="Mode"],.l99-quick>*,[data-cv-open]') || /^(back|sun|music|warp|home|chat)$/.test(g) ? 's' : '';
		if ((b.dataset.size || '') !== size) { if (size) b.dataset.size = size; else delete b.dataset.size; }
	}
	const all = () => { for (const b of mount.querySelectorAll('button')) dress(b); };
	const mo = new MutationObserver((list) => {
		const todo = new Set();
		for (const m of list) {
			const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
			const b = t?.closest?.('button');
			if (b && mount.contains(b)) todo.add(b);
			// (a panel folding to its button, or back)
			else if (m.attributeName === 'class' && t?.matches?.('[data-field-contract]')) for (const q of t.querySelectorAll('button')) todo.add(q);
			for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'BUTTON') todo.add(n); else for (const q of n.querySelectorAll?.('button') || []) todo.add(q); }
		}
		for (const b of todo) dress(b);
	});
	mo.observe(mount, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'aria-expanded', 'class'] });
	all();
	// what is on now, for the controls that only apply then (a few times a second; cheap)
	const shown = (el) => !!el && el.style.display !== 'none' && el.style.display !== '';
	const fishBtn = () => mount.querySelector('[data-hud="prompt 20"]');
	// the room the quest's chip takes (its bottom, measured), for what sits under the top row;
	// and the browser's bars over the page (Safari's address and tool bars), from the visual
	// viewport, added to the safe areas
	const px = (k, v) => { const t = `${Math.round(v)}px`; if (mount.style.getPropertyValue(k) !== t) mount.style.setProperty(k, t); };
	const room = () => {
		const m = mount.getBoundingClientRect(), chip = mount.querySelector('[data-hud-text="quest"]');
		const r = chip && chip.style.display !== 'none' ? chip.getBoundingClientRect() : null;
		px('--qb', r && r.height ? r.bottom - m.top + 8 : 0);
		const vv = window.visualViewport;
		if (vv) { px('--vvt', Math.max(0, vv.offsetTop - m.top)); px('--vvb', Math.max(0, m.bottom - (vv.offsetTop + vv.height))); }
		// a button placed by its own module (not one of the places above) that lands on the
		// quest's chip or the driving line is moved down below it
		const texts = [r, ...[...mount.querySelectorAll('.l99-drive-hud')].filter((e) => e.style.display !== 'none').map((e) => e.getBoundingClientRect())].filter((t) => t && t.height);
		for (const b of mount.children) {
			if (!b.hasAttribute?.('data-skin') || b.style.display === 'none' || b.hidden) continue;
			const was = parseFloat(b.dataset.pushed || '0'), q = b.getBoundingClientRect();
			if (!q.height) continue;
			const top = q.top - was, bottom = q.bottom - was;
			let push = 0;
			for (const t of texts) if (!(q.right <= t.left || t.right <= q.left || bottom <= t.top || t.bottom <= top)) push = Math.max(push, t.bottom + 8 - top);
			if (push !== was) { b.dataset.pushed = String(push); b.style.translate = push ? `0 ${push}px` : ''; }
		}
	};
	window.visualViewport?.addEventListener('resize', room);
	window.visualViewport?.addEventListener('scroll', room);
	const tick = setInterval(() => {
		room();
		const fish = shown(fishBtn()), drive = shown(mount.querySelector('.l99-pad'));
		if (mount.classList.contains('l99-c-fish') !== fish) mount.classList.toggle('l99-c-fish', fish);
		if (mount.classList.contains('l99-c-drive') !== drive) mount.classList.toggle('l99-c-drive', drive);
	}, 250);
	return { refresh: all, dispose() { mo.disconnect(); clearInterval(tick); window.visualViewport?.removeEventListener('resize', room); window.visualViewport?.removeEventListener('scroll', room); style.remove(); mount.classList.remove('l99-skin', 'l99-c-fish', 'l99-c-drive'); } };
}
