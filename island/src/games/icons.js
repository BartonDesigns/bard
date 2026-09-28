// The games' icons: one line drawing per game on a 24-unit grid, stroked in the text's
// own colour with round ends, so they sit in a button or a menu row like a letter does.
// icon(id, size) gives the <svg> as a string; ICONS holds the drawings themselves.

const dot = (x, y) => `<path d="M${x} ${y}h.01"/>`;

export const ICONS = {
	// the games button: a controller, its cross and two buttons
	games: '<path d="M7 7h10a4.5 4.5 0 0 1 4.4 3.6l.9 4.8A2.7 2.7 0 0 1 17.6 18l-1.9-2.2a2 2 0 0 0-1.5-.7H9.8a2 2 0 0 0-1.5.7L6.4 18a2.7 2.7 0 0 1-4.7-2.6l.9-4.8A4.5 4.5 0 0 1 7 7z"/><path d="M6 11h4M8 9v4"/>' + dot(15.5, 10.5) + dot(17.5, 12.5),
	// a pin and the ball beside it
	bowling: '<path d="M8 2.5c-1.2 0-2 .9-2 2 0 1.4.8 2 .8 3 0 1-1.8 2.6-1.8 5.5 0 3.3 1 6.5 1.5 8.5h3c.5-2 1.5-5.2 1.5-8.5 0-2.9-1.8-4.5-1.8-5.5 0-1 .8-1.6.8-3 0-1.1-.8-2-2-2z"/><path d="M6.4 8.5h3.2"/><circle cx="17" cy="16.5" r="4.5"/>' + dot(15.7, 15) + dot(17.9, 14.6) + dot(17, 17),
	// the rings at the top of the lane, a ball rolling up it
	skeeball: '<circle cx="12" cy="8" r="6"/><circle cx="12" cy="8" r="2.5"/><path d="M6.5 22 8 16.5M17.5 22 16 16.5"/><circle cx="12" cy="19.5" r="1.6"/>',
	// the flippers, the ball, two bumpers
	pinball: '<path d="M4 16.5l6 3M20 16.5l-6 3"/><circle cx="12" cy="10" r="2.2"/><circle cx="6" cy="6" r="1.7"/><circle cx="18" cy="6.5" r="1.7"/><path d="M3 3v10M21 3v10"/>',
	// a mallet and the puck gliding off
	airhockey: '<circle cx="8.5" cy="15" r="5.5"/><circle cx="8.5" cy="15" r="2"/><ellipse cx="18" cy="6" rx="3" ry="2"/><path d="M13 4.5h-3M13.5 7.5h-2"/>',
	// a basketball
	hoops: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><path d="M5.6 5.5c2.4 3.7 2.4 9.3 0 13M18.4 5.5c-2.4 3.7-2.4 9.3 0 13"/>',
	// the flag in the cup, the ball on the green
	minigolf: '<path d="M7 19V3l9 3.5L7 10"/><path d="M3.5 19.5c1.5-.7 4-1 6.5-1s5 .3 6.5 1"/><circle cx="18.5" cy="17" r="1.8"/>',
	// two bocce balls and the pallino
	bocce: '<circle cx="8" cy="15" r="4.5"/><circle cx="17.5" cy="16" r="3.5"/><circle cx="14" cy="6" r="1.6"/><path d="M5.5 12.5c1.2.9 2.3 2.4 2.7 4.3"/>',
	// the basket: its rim, the chains, the tray, the pole
	discgolf: '<path d="M5 4h14"/><path d="M7 4l3 7M12 4v7M17 4l-3 7"/><path d="M5 11h14l-2 4H7z"/><path d="M12 15v6M9 21h6"/>',
	// a flat stone skipping over the water
	stones: '<ellipse cx="18.5" cy="6.5" rx="3" ry="1.6"/><path d="M3 13c1.5-3 3.5-3 5 0M9.5 13c1-2 2.5-2 3.5 0"/><path d="M2 18c1.7 0 1.7-1.3 3.3-1.3s1.7 1.3 3.4 1.3 1.6-1.3 3.3-1.3 1.7 1.3 3.3 1.3 1.7-1.3 3.4-1.3S20.3 18 22 18"/>',
	// a diamond kite on its tail
	kite: '<path d="M13 2l6.5 6.5L13 17 6.5 8.5z"/><path d="M6.5 8.5h13M13 2v15"/><path d="M13 17c-1.5 1-.5 2-2 3s-2.5 0-3.5 1.5"/>',
	// a board on the face of a wave
	surf: '<path d="M2 19c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.6-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.4-1.2S20.3 19 22 19"/><path d="M4 15c0-5.5 4-9.5 9-9.5 3 0 5 1.8 5 4.2 0 1.7-1.2 2.8-2.7 2.8-1.2 0-2-.8-2-1.8 0-.8.5-1.4 1.2-1.6"/><path d="M4 15h6.5"/>',
	// a skateboard, kicked up at both ends
	skate: '<path d="M2.5 10.5c.3 1.5 1.3 2.5 3 2.5h13c1.7 0 2.7-1 3-2.5"/><path d="M7 13v1.5M17 13v1.5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
	// the cable car's bell
	cablebell: '<path d="M6 16V10a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/><path d="M12 2v2"/>',
	// a sea lion with a ball on its nose
	sealions: '<path d="M6 20c0-4.5 1.2-7.5 3.5-9.5l1.3-3c.6-1.4 2-2.1 3.4-1.7l2.3.7-1.9 1.4c-.9.6-1.3 1.7-1 2.7l1.6 5.4c.4 1.5 1.7 2.5 3.3 2.5"/><path d="M9.5 20l2-3.2M3 20h18"/><circle cx="18" cy="3.5" r="1.8"/>',
	// the claw coming down on its cable
	claw: '<path d="M12 2v5"/><path d="M9 7h6v2.5H9z"/><path d="M9.5 9.5 6 14l2.5 3.5M14.5 9.5 18 14l-2.5 3.5M12 9.5V16"/><circle cx="12" cy="20.5" r="1.5"/>',
	// a drum and its sticks
	drums: '<ellipse cx="12" cy="10" rx="8" ry="3"/><path d="M4 10v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/><path d="M4.5 13.5l3.5 5 4-5.5 4 5.5 3.5-5"/><path d="M5 2l5 6M19 2l-5 6"/>',
	// the board and a dart in the bull
	darts: '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="M11 13l9.5-9.5"/><path d="M18 3v3h3"/>',
	// the sloping board, its hole, a bag
	cornhole: '<path d="M5 21l3-16h8l3 16z"/><circle cx="12" cy="9.5" r="2"/><path d="M9.5 15.5h5v3h-5z"/>',
	// a paper plane
	paperplane: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
	// a sandcastle with its flag, on the beach
	sandcastle: '<path d="M4 20v-8h3v-2h2v2h2V7h2v5h2v-2h2v2h3v8z"/><path d="M10 20v-2.5a2 2 0 0 1 4 0V20"/><path d="M12 7V2.5l3 1.2-3 1.3"/><path d="M2 20h20"/>',
	// a crab
	tidepool: '<path d="M7 15a5 3.5 0 0 0 10 0 5 3.5 0 0 0-10 0z"/><path d="M10 11.5V9M14 11.5V9"/><path d="M7.5 13.5 4 10.5M4 10.5 3.5 7l3 1.5M16.5 13.5l3.5-3M20 10.5l.5-3.5-3 1.5"/><path d="M7.5 17l-3 2M9 18l-1.5 3M16.5 17l3 2M15 18l1.5 3"/>',
	// a star and two small ones
	stargaze: '<path d="M10 3.5l1.9 4.1 4.5.5-3.4 3 1 4.4-4-2.3-3.9 2.3 1-4.4-3.4-3 4.5-.5z"/><path d="M18.5 14v4M16.5 16h4M5 18.5v3M3.5 20h3"/>',
	// the signal lamp, its light, a dot and a dash
	morse: '<path d="M4 7h8v8H4z"/><path d="M6 15v3M10 15v3M5 18h6"/><path d="M15 9l4-2M15 11h5M15 13l4 2"/><path d="M15 21h1M18.5 21h3"/>',
	// a bat and a ball
	batting: '<path d="M4.5 19.5l1.8-1.8"/><path d="M6.3 17.7l10.2-11.9a2.1 2.1 0 0 1 3.1 2.8L8 18.7c-.5.4-1.2.4-1.7-.1z"/><circle cx="6" cy="6" r="2.5"/>',
	// a baseball, its seams
	baseball: '<circle cx="12" cy="12" r="9"/><path d="M6.2 5.2c1.9 1.8 3 4.2 3 6.8s-1.1 5-3 6.8M17.8 5.2c-1.9 1.8-3 4.2-3 6.8s1.1 5 3 6.8"/><path d="M8.4 8.2l1.4-.5M9 11.2l1.5-.1M8.8 14.3l1.4.4M15.6 8.2l-1.4-.5M15 11.2l-1.5-.1M15.2 14.3l-1.4.4"/>',
	// a soccer ball: the pentagon in the middle, its seams out to the edge
	soccer: '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.8 2.8-1.4 4.4H9.6l-1.4-4.4z"/><path d="M12 8V3.2M15.8 10.8l4.3-1.4M14.4 15.2l2.8 3.8M9.6 15.2l-2.8 3.8M8.2 10.8 3.9 9.4"/>',
	// an American football and its laces
	football: '<path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16z"/><path d="M9 15l6-6"/><path d="M10 12l2 2M11.8 10.2l2 2M8.2 13.8l2 2"/><path d="M4.5 16.5l3 3M16.5 4.5l3 3"/>',
	// a ball of magma: crust plates, glowing cracks, the heat rising off it
	magmaball: '<circle cx="11" cy="14" r="7"/><path d="M6.5 11.5l3 1.5 1.5-3M11 13l1 3.5 3.5 1M8 17.5l3-1.5"/><path d="M17 3c-1 1.2 1 2.2 0 3.5M20.5 5c-1 1.2 1 2.2 0 3.5"/>',
	// a flask of acid, a drop off it, and the ball
	toxicdodge: '<path d="M7 3h5M8.5 3v5L4 16.5A2.3 2.3 0 0 0 6 20h7a2.3 2.3 0 0 0 2-3.5L10.5 8V3"/><path d="M5.5 14h8"/><circle cx="18.5" cy="7" r="3"/><path d="M18.5 13.5c-1 1.3-1.5 2.2-1.5 3a1.5 1.5 0 0 0 3 0c0-.8-.5-1.7-1.5-3z"/>',
	// a stick and a puck on the ice
	icepuck: '<path d="M16 2.5l-5.5 14.5a2 2 0 0 1-1.9 1.3H4.5"/><ellipse cx="17" cy="18" rx="3.5" ry="1.5"/><path d="M13.5 18v1.2c0 .8 1.6 1.5 3.5 1.5s3.5-.7 3.5-1.5V18"/><path d="M2 22h20"/>',
	// a stone wicket, its bails, and the ball coming in
	sandball: '<path d="M7 21V8M11 21V8M15 21V8"/><path d="M6.5 7.5h4.5M11 7.5h4.5"/><circle cx="19.5" cy="15" r="2"/><path d="M3 21h18"/>',
	// an orb through a ring of runes
	orbball: '<ellipse cx="12" cy="12" rx="5" ry="9"/><circle cx="12" cy="12" r="2.5"/><path d="M3 12h2M19 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
	// a ball on the water, a floating goal behind it
	waterpolo: '<path d="M3 4h11v6M3 4v6"/><path d="M3 7l3-3M3 10l6-6M7 10l6-6"/><circle cx="16.5" cy="13.5" r="3"/><path d="M2 19c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.6-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.4-1.2S20.3 19 22 19"/>',
	// a ball high over a platform, its slow arc
	moonball: '<circle cx="17" cy="6" r="3"/><path d="M4 16c1.5-6 5.5-10 10-10.5" stroke-dasharray="1.5 2.5"/><path d="M2 18h20M6 18v3M18 18v3"/>',
	// a target and an arrow in it
	archery: '<circle cx="10" cy="14" r="7.5"/><circle cx="10" cy="14" r="4"/><circle cx="10" cy="14" r=".6"/><path d="M10 14l10-10"/><path d="M17 3.5 20 4l.5 3M15.5 5.5l1 3 3 1"/>',
	// a lance couched at a shield
	joust: '<path d="M3 21 16 8"/><path d="M14 6l4 4"/><path d="M16 8l5-5"/><path d="M13.5 13.5 17 17M5.5 16.5l2 2"/><path d="M15 15.5h5.5V20c0 1-2.7 2-2.7 2S15 21 15 20z"/>',
	// (any game without its own)
	play: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M10 8.5v7l5.5-3.5z"/>',
};

export function icon(id, size = 20, css = '') {
	const body = ICONS[id] || ICONS.play;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:middle;flex:none;${css}">${body}</svg>`;
}
