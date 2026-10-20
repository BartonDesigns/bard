import { createSoul } from './reputation/soul.js';
import { createCloudSave } from './persistence/cloud-save.js';
import { createAccountPanel } from './ui/account.js';
import { createGuild } from './guild/index.js';
import { createLivingWorld, livingActorId } from './people/living-world.js';
import { createNegotiationRuntime } from './economy/negotiation-runtime.js';
import { createCommunityProjects } from './people/community-projects.js';
import { createCommunityProjectSites } from './people/community-project-sites.js';
import { createCommunityProjectMarks } from './guide/community-project-marks.js';
import { worldPosition } from './people/social-actors.js';
import { roomsURL } from './net/config.js';
// Island engine, stage 1. Loaded by the Bard faceplate on demand; runs as a
// third world beside the caves and space flight, sharing the faceplate's
// music, keyboard, play surfaces and Journey transfers.

import '../../loading-screen.js';
import { scrollable } from './ui/scroll.js';
import * as THREE from 'three';
import { updateIslandReach } from './world/surfacevisibility.js';
import { createGroundProbe } from './world/groundprobe.js';
import { createFloorGuard } from './world/floorguard.js';
import { createSeaMirror } from './world/seamirror.js';
import { createSeaDepth } from './world/seadepth.js';
import { loadAimSensitivity } from './aim-sensitivity.js';
import { flightMultiplier, nextFlightSpeed, speedLabel } from './flight-speed.js';
import { createStriker, createRipples, ring } from './planet/resonance.js';
import { describe } from './crysis/ecology.js';
import { describeLand } from './crysis/land.js';
import { board as requestBoard, requestsNear, takeRequest, completeRequest } from './economy/requests.js';
import { payroll } from './economy/payroll.js';
import { bank } from './economy/bank.js';
import { createFamilyLife } from './people/family-life.js';
import { bindCarSky } from './bay/cars.js';
import { createBridgeSound } from './bay/bridgesound.js';
import { createCrosswalks } from './bay/crosswalks.js';
import { createDogWalkers } from './people/dogwalkers.js';
import { createShaderWarm } from './world/shaderwarm.js';
import { preferLite } from './world/gpulite.js';
import { createGovernor, qualityNow } from './world/governor.js';
import { createGraphicsRenderer, graphicsMode, renderRatio } from './world/graphics-startup.js';
import { createGraphicsRecovery, graphicsReloadError } from './world/graphics-recovery.js';
import { bindSignLighting, recoverSignage, syncSignageMaterials } from './signage/materials.js';
import { meterGL } from './world/gpumeter.js';
import { bodyCount } from './people/body.js';
import { createCataclysm } from './cataclysm/index.js';
import { createMagic } from './magic/index.js';
import { createFishing } from './fishing.js';
import { createArcade } from './arcade.js';
import { worldAir } from './world/soundbus.js';
import { REAL_U } from './bay/realcity.js';
import { createDrive } from './drive.js';
import { createAutoMusic } from './music/automusic.js';
import { createExplore } from './explore.js';
import { today, onMonth, monthPicked, pickMonth } from './calendar.js';
import { createTattooStudio } from './tattoo/studio.js';

// the hills by the calendar: green from the winter rains into spring, gold by summer
// (the naturalist's curve: inland gold by late May; the foggy coast lags into July)
// (and the month picked in the Sky & World panel, when one is)
function applySeason(d) {
	const m = d.getMonth();
	REAL_U.uSeason.value = [0, 0, 0, 0.1, 0.45, 0.8, 1, 1, 1, 1, 0.8, 0.4][m];
	REAL_U.uSeasonLag.value = [0, 0, 0, 0, 0.2, 0.25, 0.2, 0.05, 0, 0, 0, 0][m];
	// the wildflower peak: late March and April
	REAL_U.uBloom.value = [0, 0.3, 0.8, 1, 0.45, 0, 0, 0, 0, 0, 0, 0][m];
	// dead leaves in the gutters
	REAL_U.uLeafFall.value = [0.5, 0.2, 0, 0, 0, 0, 0, 0.05, 0.2, 0.6, 1, 0.8][m];
}
applySeason(today());
onMonth(applySeason);
import { toGrid as gridTo, fromGrid as gridFrom, BLOCKS as gridBlocks } from './bay/styles.js';
import { toWorld } from './bay/geo.js';
import { createDirector } from './earth/director.js';
// the rest of the Earth, one engine with the Bay (earth/globe.js); its frame's latitude and longitude
import { BAY_WILD_KM } from './earth/globe.js';
import { toLL as globeLL, bayKm } from './earth/globeframe.js';
import { citiesAround, kmLabel } from './space/landing.js';
import { createGuide } from './guide/guide.js';
import { createWaypoint } from './ui/waypoint.js';
import { createSurprises } from './surprises.js';
import { createPeople, addTalkers, talkers } from './people/people.js';
import { createChatter } from './people/chatter.js';
import { createEncounterPacing } from './people/encounter-pacing.js';
import { createErrands } from './people/errands.js';
import { createNpcQuests } from './people/npc-quests.js';
import { createMoney } from './people/npc-money.js';
import { fromRequests } from './people/npc-quests-core.js';
import { commercialEstablishments } from './people/bag-spots.js';
import { registerSiting } from './economy/establishments.js';
import { createCommons } from './combat/morality.js';
import { createFares } from './vehicles/fares.js';
import { createItemUse } from './gameplay/item-use.js';
import { createDaily } from './gameplay/daily.js';
import { createNpcSocial } from './people/social.js';
import { createGhost } from './people/ghost.js';
import { createPicnicJam } from './encounters/picnic-jam.js';
import { createRagdolls } from './people/ragdoll.js';
import { createImpacts } from './vehicles/impact.js';
import { createCarjack } from './vehicles/carjack.js';
import { createAvatar } from './people/avatar.js';
import { createHeroView } from './people/hero-view.js';
import { createSelf } from './people/self.js';
import * as CREATURES from './world/creatures.js';
import { createShare } from './share.js';
import { createMultiplayer } from './net/multiplayer.js';
import { createWorldAudio } from './audio/audio.js';
import { worldBody, sameBody } from './space/body.js';
import { findKineticSpot } from './music/kinetic-placement.js';
import { createArmsRuntime } from './crysis/arms-runtime.js';
import { createGear } from './ui/gear.js';
import { createCombat } from './combat/combat.js';
import { createMilitary } from './military/index.js';
import { createLaw } from './law/index.js';
import { installAirFog } from './world/airfog.js';
import { skinTouch, firstTime } from './ui/touch-skin.js';
import { PHONE_DEVICE, GFX_PHONE, ULTRA, ULTRA_DROPPED } from './world/device.js';
import { islandBuild } from './island-build.js';
import { islandTeardown } from './island-teardown.js';
import { islandPanel } from './island-panel.js';
import { islandFrame } from './island-frame.js';
import { createPerfMeter } from './ui/perfmeter.js';

const REALM = 'island';
// where the sky's glow is sampled: the cities round you wash out the faint stars
const GLOW_AT = [[0, 0], [6000, 0], [-6000, 0], [0, 6000], [0, -6000], [15000, 0], [-15000, 0], [0, 15000], [0, -15000]];

// The air: haze thickest low down and lit toward the sun, whole by the far plane; under water
// (a negative density) light absorbed red first, then green (world/airfog.js)
installAirFog();

// Muffle the whole Bard under water: a low-pass between the faceplate's master output
// and the speakers, eased in as you go under and out as you surface.
const muffle = { lp: null, ctx: null, k: 0 };
function underwaterAudio(target, dt) {
	const out = window._masterClip, ctx = out && out.context;
	if (!ctx || ctx.state !== 'running') return;
	if (!muffle.lp || muffle.ctx !== ctx) {
		try {
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.9;
			out.disconnect(ctx.destination);
			out.connect(lp); lp.connect(ctx.destination);
			muffle.lp = lp; muffle.ctx = ctx;
		} catch { return; }
	}
	const k = muffle.k += (target - muffle.k) * Math.min(1, dt * 3);
	muffle.lp.frequency.setTargetAtTime(20000 * Math.pow(420 / 20000, k), ctx.currentTime, 0.05);
	muffle.lp.Q.setTargetAtTime(0.9 + k * 2.5, ctx.currentTime, 0.05);
}
// things made inside the engine that the Crysis console handle reaches
const HOOKS = {};
// isPhone is the device (touch controls, labels, memory); GFX is the graphics' phone, false on a phone set to Ultra
const isPhone = PHONE_DEVICE, GFX = GFX_PHONE;
const TOUCH_UI = isPhone || !!globalThis.matchMedia?.('(pointer: coarse)')?.matches;
// no zooming the page: a double tap or a pinch on the game is play, not Safari's zoom (iOS ignores
// user-scalable=no, and touch-action isn't inherited, so every element opts out; the rule goes in
// first, so an element's own touch-action still wins)
if (typeof document !== 'undefined' && !document.getElementById('no-page-zoom')) {
	const st = document.createElement('style');
	st.id = 'no-page-zoom';
	st.textContent = '*,*::before,*::after{touch-action:manipulation}';
	document.head.prepend(st);
	for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}

function css(el, s) { el.style.cssText = s; return el; }
function button(label, title, style, hud) {
	const b = document.createElement('button');
	if (hud) b.dataset.hud = hud;
	b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
	// hand focus back after a click, so Space and the play keys keep driving the game
	b.addEventListener('click', () => b.blur());
	css(b, 'position:absolute;min-width:44px;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(8,20,26,.55);color:#eafaf6;font:600 13px system-ui;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;cursor:pointer;' + style);
	return b;
}

// The HUD's groups. Buttons sit in flex and grid boxes rather than at fixed offsets, so a
// hidden one closes its gap; any module's element joins one by its data-hud ('rail 60':
// the group, then its place in it: from the top in the rail, from the bottom in the thumb's
// groups). Everything you press with the right thumb is one stack up the right edge, 8 px
// apart (16 px between the thumb's groups and the rail), from the bottom:
//   thumb: big (jump, descend), side (boat, rod, strike), pill (the car's labelled buttons)
//          and mode (drive, camera, fly, ×3)
//   rail: above them, the ways to go elsewhere (places, games, the guide, the ship); a
//         grid, so when it runs out of height it carries on in a second column leftwards
// and beside it:
//   prompt: bottom centre, between the thumbs, one over another (pick up, talk, doors...),
//           with the hint on top
//   left: under ◀ Bard (homes, the quest purse)
// The joystick rests bottom left, opposite the jump, until a thumb takes it.
// A short landscape screen lays the thumb buttons in a row and puts the modes in the
// rail, to leave the rail its height (the 44 px ones lifted 10 px, to centre on the round
// 64 px ones).
const HUD_LAND = '(orientation: landscape) and (max-height: 540px)';
const HUD_CSS = `
#l99-island-mount .l99-rail{position:absolute;right:calc(12px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + env(safe-area-inset-bottom));height:min(calc(var(--l99-rail-n, 1) * 52px - 8px),calc(100% - 64px - env(safe-area-inset-top) - var(--l99-low, 88px) - env(safe-area-inset-bottom)));display:grid;grid-auto-flow:column;grid-template-rows:repeat(auto-fill,44px);grid-auto-columns:max-content;gap:8px;direction:rtl;justify-items:start;align-content:end;pointer-events:none;}
#l99-island-mount .l99-thumb{position:absolute;right:calc(12px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column-reverse;align-items:flex-end;gap:8px;pointer-events:none;}
#l99-island-mount .l99-thumb>div{display:flex;flex-direction:column-reverse;align-items:flex-end;gap:8px;}
#l99-island-mount .l99-big{align-self:flex-end;}
#l99-island-mount .l99-prompts{position:absolute;left:calc(var(--l99-left, 88px) + env(safe-area-inset-left));right:calc(var(--l99-side, 88px) + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column-reverse;align-items:center;gap:8px;pointer-events:none;}
#l99-island-mount .l99-left{position:absolute;left:calc(12px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none;}
#l99-island-mount .l99-pair{display:flex;gap:8px;}
#l99-island-mount :is(.l99-rail,.l99-thumb>div,.l99-prompts,.l99-left,.l99-pair)>*{position:relative !important;inset:auto !important;transform:none !important;margin:0;flex:none;pointer-events:auto;}
#l99-island-mount :is(.l99-rail,.l99-mode)>*{direction:ltr;display:flex;align-items:center;justify-content:center;width:44px;padding:0;}
#l99-island-mount .l99-prompts>*{max-width:100%;box-sizing:border-box;}
#l99-island-mount .l99-pill>*{align-items:center;justify-content:center;}
#l99-island-mount :is(.l99-thumb>div,.l99-pair)[hidden]{display:none;}
#l99-island-mount:not(.l99-touch) .l99-big{display:none;}
#l99-island-mount .l99-joy{display:none;}
#l99-island-mount.l99-touch .l99-joy{display:block;}
#l99-island-mount.l99-touch .l99-joy:not(.held){left:calc(16px + env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom));transform:scale(.8);transform-origin:0 100%;opacity:.5;}
#l99-island-mount.l99-still .l99-joy:not(.held){display:none;}
@media ${HUD_LAND}{#l99-island-mount .l99-thumb,#l99-island-mount .l99-thumb>.l99-big{flex-direction:row-reverse;}#l99-island-mount.l99-touch .l99-big:not([hidden])~:is(.l99-side,.l99-pill){margin-bottom:10px;}}
#l99-island-mount .l99-quick{display:none;}
#l99-island-mount.l99-touch .l99-quick{position:absolute;top:calc(64px + env(safe-area-inset-top));right:calc(12px + env(safe-area-inset-right));display:flex;gap:6px;z-index:14;}
#l99-island-mount.l99-touch .l99-quick>button{position:relative!important;inset:auto!important;width:54px!important;min-height:48px;box-sizing:border-box;padding:5px!important;flex-direction:column;gap:2px;font-size:16px!important;}
#l99-island-mount.l99-touch .l99-quick>button::after{content:attr(data-control-label);font:600 10px/1.1 system-ui;}
#l99-island-mount.l99-touch .l99-left{top:calc(120px + env(safe-area-inset-top));max-width:calc(100% - 24px);}
#l99-island-mount.l99-touch .l99-rail{display:none;top:calc(120px + env(safe-area-inset-top));bottom:auto;right:calc(12px + env(safe-area-inset-right));height:auto;max-height:calc(100% - 136px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;width:min(460px,calc(100% - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));padding:10px;box-sizing:border-box;background:#102129fa;border:1px solid #66818a;border-radius:14px;z-index:15;pointer-events:auto;touch-action:pan-y;overscroll-behavior:contain;direction:ltr;box-shadow:0 8px 30px #0008;}
#l99-island-mount.l99-touch.l99-tools-open .l99-rail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none;grid-auto-flow:row;grid-auto-columns:auto;gap:8px;align-content:start;}
#l99-island-mount.l99-touch .l99-rail>button{width:100%!important;min-width:0;min-height:56px;height:auto!important;gap:10px;justify-content:flex-start!important;padding:10px!important;box-sizing:border-box;white-space:normal;}
#l99-island-mount.l99-touch .l99-rail>button>svg{width:22px;min-width:22px;flex:none;}
#l99-island-mount.l99-touch .l99-rail>button::after{content:attr(data-control-label);font:600 13px/1.3 system-ui;text-align:left;overflow-wrap:normal;}
#l99-island-mount.l99-touch.l99-tools-open :is(.cb-btn,button:is([aria-label="Aim"],[aria-label="Aim held item"])){visibility:hidden;}
#l99-island-mount.l99-touch .cb-btn[aria-label="Fire"],#l99-island-mount.l99-touch .cb-btn[aria-label="Draw"],#l99-island-mount.l99-touch .cb-btn[aria-label="Release"],#l99-island-mount.l99-touch .cb-btn[aria-label="Nocking"]{right:calc(12px + env(safe-area-inset-right))!important;bottom:calc(96px + env(safe-area-inset-bottom))!important;width:80px!important;height:80px!important;}
#l99-island-mount.l99-touch>button:is([aria-label="Aim"],[aria-label="Aim held item"]){right:calc(104px + env(safe-area-inset-right))!important;bottom:calc(88px + env(safe-area-inset-bottom))!important;width:64px!important;height:64px!important;touch-action:none!important;}
#l99-island-mount.l99-touch .cb-btn[aria-label="Reload"]{right:calc(100px + env(safe-area-inset-right))!important;bottom:calc(160px + env(safe-area-inset-bottom))!important;}
#l99-island-mount.l99-touch .cb-btn[aria-label="Mode"]{right:calc(100px + env(safe-area-inset-right))!important;bottom:calc(212px + env(safe-area-inset-bottom))!important;}
#l99-island-mount.l99-touch .cb-hp{left:calc(16px + env(safe-area-inset-left));bottom:calc(174px + env(safe-area-inset-bottom));width:144px;transform:none;}
#l99-island-mount.l99-touch .cb-ammo{bottom:calc(114px + env(safe-area-inset-bottom));left:calc(16px + env(safe-area-inset-left));right:auto;transform:none;text-align:left;max-width:160px;padding:6px 8px;border-radius:8px;background:#08141ab8;box-sizing:border-box;}
#l99-island-mount.l99-touch .cb-ammo .n{font-size:22px;}
#l99-island-mount.l99-touch .cb-ammo .r{font-size:12px;}
#l99-island-mount.l99-touch .cb-ammo .w{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.3px;}
#l99-island-mount.l99-touch .cb-ammo .rl:empty{display:none;}
#l99-island-mount.l99-touch .l99-prompts{left:calc(112px + env(safe-area-inset-left));right:calc(88px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));}
@media (orientation:landscape) and (max-height:540px){
#l99-island-mount.l99-touch .l99-quick{top:calc(12px + env(safe-area-inset-top));right:calc(116px + env(safe-area-inset-right));}
#l99-island-mount.l99-touch .l99-left{top:calc(64px + env(safe-area-inset-top));max-width:40%;}
#l99-island-mount.l99-touch .l99-rail{top:calc(68px + env(safe-area-inset-top));max-height:calc(100% - 84px - env(safe-area-inset-top) - env(safe-area-inset-bottom));width:min(460px,60%);}
#l99-island-mount.l99-touch .cb-ammo{bottom:calc(12px + env(safe-area-inset-bottom));left:calc(116px + env(safe-area-inset-left));}
#l99-island-mount.l99-touch .cb-hp{bottom:calc(74px + env(safe-area-inset-bottom));left:calc(124px + env(safe-area-inset-left));}
#l99-island-mount.l99-touch .l99-prompts{left:calc(290px + env(safe-area-inset-left));right:calc(100px + env(safe-area-inset-right));}
}

`;

function buildDom(canvas = document.createElement('canvas')) {
	const mount = css(document.createElement('div'), 'position:fixed;inset:0;z-index:40;display:none;background:#000;overflow:hidden;touch-action:none;');
	mount.id = 'l99-island-mount';
	// (the jump and descend buttons, and the resting joystick, only on touch screens: the
	// keyboard has Space and C)
	mount.classList.toggle('l99-touch', isPhone || matchMedia('(pointer: coarse)').matches);
	const style = document.createElement('style');
	style.textContent = HUD_CSS;
	css(canvas, 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;');
	const joy = css(document.createElement('div'), 'position:absolute;width:110px;height:110px;box-sizing:border-box;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06);pointer-events:none;transition:opacity .2s;');
	joy.className = 'l99-joy';
	const knob = css(document.createElement('div'), 'position:absolute;left:31px;top:31px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.45);');
	joy.appendChild(knob);
	const box = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };
	const quick = box('l99-quick');
	const rail = box('l99-rail'), thumb = box('l99-thumb'), big = box('l99-big'), side = box('l99-side'), pill = box('l99-pill'), mode = box('l99-mode'), prompts = box('l99-prompts'), left = box('l99-left'), pair = box('l99-pair');
	thumb.append(big, side, pill, mode);
	const land = matchMedia(HUD_LAND);
	const groups = { rail, big, side, pill, mode, prompt: prompts, left };
	// (the modes join the rail on a short landscape screen)
	const home = (g) => (g === 'mode' && (land.matches || mount.classList.contains('l99-touch')) ? rail : groups[g]);
	const tools = button('☷', 'All controls', 'right:calc(12px + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));z-index:13;');
	tools.dataset.controlLabel = 'Controls'; tools.style.order = '999';
	quick.appendChild(tools);
	tools.hidden = !mount.classList.contains('l99-touch');
	tools.setAttribute('aria-expanded', 'false'); tools.setAttribute('aria-controls', 'l99-controls-menu'); rail.id = 'l99-controls-menu'; rail.setAttribute('aria-label', 'World controls');
	const closeTools = () => { mount.classList.remove('l99-tools-open'); tools.setAttribute('aria-expanded', 'false'); tools.dataset.controlLabel = 'Controls'; };
	tools.addEventListener('click', (e) => { e.stopPropagation(); const on = mount.classList.toggle('l99-tools-open'); tools.setAttribute('aria-expanded', String(on)); tools.dataset.controlLabel = on ? 'Close' : 'Controls'; });
	rail.addEventListener('click', (e) => { if (e.target.closest('button')) closeTools(); }, true);
	mount.addEventListener('pointerdown', (e) => { if (!rail.contains(e.target) && !tools.contains(e.target)) closeTools(); });
	addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTools(); });
	const back = button('◀ Bard', 'Back to the Bard faceplate', 'left:calc(12px + env(safe-area-inset-left));top:calc(12px + env(safe-area-inset-top));');
	const jump = button('⤒', 'Jump', 'width:64px;height:64px;border-radius:50%;font-size:22px;', 'big 10');
	const gear = button('☀', 'Sky and world settings', 'right:calc(12px + env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top));');
	const fly = button('✈', 'Fly (F)', 'width:44px;font-size:18px;', 'mode 20');
	const boost = button('×1', 'Cycle flight speed: 1×, 3×, 6×, 9×, and in space up to 100,000× (B)', 'width:44px;font-size:13px;display:none;', 'mode 21');
	const down = button('⇣', 'Descend', 'width:64px;height:64px;border-radius:50%;font-size:22px;display:none;', 'big 20');
	const shell = button('🐚', 'Pick up the shell (E)', 'display:none;', 'prompt 30');
	const toss = button('Throw', 'Throw it (T)', 'display:none;');
	const place = button('Put down', 'Put it down (E)', 'display:none;');
	pair.append(toss, place);
	pair.dataset.hud = 'prompt 31';
	const act = button('', '', 'display:none;', 'side 10');
	// at the top of the rail: a line rocket, back to the ship
	const launch = button('', 'Climb to space (steer to take control)', 'width:44px;padding:6px 10px;align-items:center;justify-content:center;display:none;', 'rail 30');
	launch.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c3 2.4 4.5 6 4.5 10.5l-1.5 3.5h-6L7.5 13C7.5 8.5 9 4.9 12 2.5z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M7.8 12.5 5 15.5V19l4-2.5M16.2 12.5 19 15.5V19l-4-2.5M10.5 19.5 12 22l1.5-2.5"/></svg>';
	const veil = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 30%,rgba(40,140,150,.10),rgba(2,30,40,.55));');
	// (the hint rides on top of the prompts, so it never covers one)
	const hint = css(document.createElement('div'), 'padding:8px 14px;border-radius:12px;background:rgba(8,20,26,.5);color:#eafaf6;font:13px system-ui;pointer-events:none;transition:opacity .6s;text-align:center;white-space:pre-line;');
	hint.dataset.hud = 'prompt 99';
	const loading = document.createElement('div');
	loading.hidden = true; // Kept for integrations; the shared loading screen owns presentation.
	// (beside the rail, stopping short of the thumb buttons, as the places and games menus do)
	const panel = css(document.createElement('div'), 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));width:min(300px,78vw);box-sizing:border-box;padding:14px;border-radius:14px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;display:none;max-height:calc(100% - 64px - var(--l99-low, 88px) - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:5;');
	const set = (k, v) => { if (mount.style.getPropertyValue(k) !== v) mount.style.setProperty(k, v); };
	// a group with nothing showing is hidden, so it leaves no gap either; and the rail is as
	// tall as what it shows, so it sits right on the thumb buttons
	const showing = (g) => [...g.children].filter((c) => c.style.display !== 'none').length;
	const tidy = () => {
		for (const g of [big, side, pill, mode, pair]) {
			const none = !showing(g);
			if (g.hidden !== none) g.hidden = none;
		}
		set('--l99-rail-n', String(Math.max(1, showing(rail))));
	};
	for (const g of [thumb, pair, rail]) new MutationObserver(tidy).observe(g, { subtree: true, attributes: true, attributeFilter: ['style'] });
	const dock = (el) => {
		const [g, n] = (el.dataset?.hud || '').split(' ');
		const fast = mount.classList.contains('l99-touch') && ((g === 'mode' && n === '20') || (g === 'rail' && ['55', '60'].includes(n)));
		const to = fast ? quick : groups[g] && home(g);
		if (!to || el.parentNode === to) return;
		el.style.order = n || '0';
		to.appendChild(el);
		if (to === quick) el.dataset.controlLabel = g === 'mode' ? 'Fly' : n === '55' ? 'Gear' : 'Places';
		else if (to === rail) {
			const title = (el.getAttribute('aria-label') || el.title || '').replace(/\s*\([^)]*\)/g, '');
			el.dataset.controlLabel = /^Explore/.test(title) ? 'Explore' : /^Cycle flight/.test(title) ? 'Flight speed' : /^Camera:/.test(title) ? 'Camera view' : title;
		}
		tidy();
	};
	new MutationObserver((list) => { for (const m of list) for (const el of m.addedNodes) if (el.nodeType === 1) dock(el); }).observe(mount, { childList: true });
	// the groups' sizes, for what is laid out round them: the prompts take the room between
	// the resting joystick (or the left edge) and the right-hand stack, and the rail and the
	// menus stop short of the thumb's groups
	const fit = () => {
		// (a short landscape screen: the rail can reach down beside a tall stack of prompts too)
		const right = Math.max(12 + thumb.offsetWidth, land.matches && !mount.classList.contains('l99-touch') ? 12 + rail.offsetWidth : 0) + 8;
		const ring = mount.classList.contains('l99-touch') && !mount.classList.contains('l99-still');
		set('--l99-side', `${right}px`);
		set('--l99-left', `${ring ? 16 + 88 + 8 : 24}px`);
		// (16 px between the thumb's stack and the rail: two groups, one column)
		set('--l99-low', `${16 + thumb.offsetHeight + 16}px`);
		set('--l99-menu-r', mount.classList.contains('l99-touch') ? '12px' : `${12 + rail.offsetWidth + 8}px`);
	};
	// (a frame later: sizes set inside the observer's own call would loop it)
	const ro = new ResizeObserver(() => requestAnimationFrame(fit));
	for (const el of [mount, rail, thumb]) ro.observe(el);
	land.addEventListener?.('change', () => {
		for (const el of mount.querySelectorAll('[data-hud^="mode "]')) dock(el);
		tidy(); fit();
	});
	// driving, a game, the tattoo chair: no resting joystick
	const still = (on) => { if (mount.classList.contains('l99-still') !== on) { mount.classList.toggle('l99-still', on); fit(); } };
	mount.append(style, canvas, veil, joy, rail, thumb, prompts, left, back, gear, quick, fly, boost, jump, down, act, shell, pair, launch, hint, panel, loading);
	document.body.appendChild(mount);
	return { mount, canvas, joy, knob, back, jump, gear, fly, boost, down, act, shell, toss, place, launch, veil, hint, loading, panel, still };
}

function slider(panel, label, min, max, step, get, set, fmt) {
	const row = css(document.createElement('label'), 'display:block;margin:6px 0 10px;');
	const top = css(document.createElement('div'), 'display:flex;justify-content:space-between;margin-bottom:4px;opacity:.9');
	const name = document.createElement('span'); name.textContent = label;
	const val = document.createElement('span');
	const input = document.createElement('input');
	input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = get();
	css(input, 'width:100%;accent-color:#01a982;');
	const show = () => { val.textContent = fmt ? fmt(+input.value) : input.value; };
	input.addEventListener('input', () => { set(+input.value); show(); });
	show();
	top.append(name, val); row.append(top, input); panel.appendChild(row);
	return { input, refresh: () => { input.value = get(); show(); } };
}

export function createIslandWorld() {
	// The island world: what the build, the frame, the settings panel and the teardown
	// (island-build.js, island-frame.js, island-panel.js, island-teardown.js) use from this function.
	// Each getter and setter reaches the binding of that name here.
	const iw = {
		get _voidFog() { return _voidFog; }, get actions() { return actions; },
		get applyQuality() { return applyQuality; }, get arcade() { return arcade; }, get arms() { return arms; },
		get arrival() { return arrival; }, get arriving() { return arriving; },
		get autoMusic() { return autoMusic; }, get avatar() { return avatar; },
		get bridgeSound() { return bridgeSound; }, get building() { return building; },
		get buildPanel() { return buildPanel; }, get button() { return button; }, get camera() { return camera; },
		get carjack() { return carjack; }, get chatter() { return chatter; }, get combat() { return combat; },
		get communityProjects() { return communityProjects; }, get crosswalks() { return crosswalks; },
		get css() { return css; }, get dogWalkers() { return dogWalkers; }, get dom() { return dom; },
		get drive() { return drive; }, get earthDirector() { return earthDirector; },
		get encounterPacing() { return encounterPacing; }, get errands() { return errands; },
		get explore() { return explore; }, get families() { return families; }, get fares() { return fares; },
		get farNight() { return farNight; }, get fishing() { return fishing; },
		get fitShadow() { return fitShadow; }, get followFarGround() { return followFarGround; },
		get followGround() { return followGround; }, get frame() { return frame; },
		get frameAvg() { return frameAvg; }, set frameAvg(next) { frameAvg = next; }, get gear() { return gear; },
		get GFX() { return GFX; }, get ghost() { return ghost; }, get glare() { return glare; },
		get GLOW_AT() { return GLOW_AT; }, get governor() { return governor; }, get guide() { return guide; },
		get hint() { return hint; }, get HOOKS() { return HOOKS; },
		get indoorK() { return indoorK; }, set indoorK(next) { indoorK = next; }, get inkBtn() { return inkBtn; },
		get isPhone() { return isPhone; }, get KICK() { return KICK; },
		get last() { return last; }, set last(next) { last = next; }, get legacyLaunch() { return legacyLaunch; },
		get livingWorld() { return livingWorld; }, get lost() { return lost; }, get magic() { return magic; },
		get muffle() { return muffle; }, get multiplayer() { return multiplayer; },
		get npcQuests() { return npcQuests; }, get origin() { return origin; },
		get panelClock() { return panelClock; }, set panelClock(next) { panelClock = next; },
		get people() { return people; }, get picnic() { return picnic; },
		get placeKinetic() { return placeKinetic; }, get projectMarks() { return projectMarks; },
		get projectRefresh() { return projectRefresh; }, set projectRefresh(next) { projectRefresh = next; },
		get projectSnapshot() { return projectSnapshot; }, set projectSnapshot(next) { projectSnapshot = next; },
		get quality() { return quality; }, set quality(next) { quality = next; },
		get ragdolls() { return ragdolls; }, get recovery() { return recovery; },
		get renderer() { return renderer; }, get replayKinetic() { return replayKinetic; },
		get running() { return running; }, get scene() { return scene; }, get seaDepth() { return seaDepth; },
		get seaLifeVisibility() { return seaLifeVisibility; }, get seaLook() { return seaLook; },
		get seaMirror() { return seaMirror; }, get shaderWarm() { return shaderWarm; },
		get share() { return share; }, get shared() { return shared; }, get slider() { return slider; },
		get social() { return social; }, get soul() { return soul; }, get stampPrints() { return stampPrints; },
		get state() { return state; }, get stepWind() { return stepWind; }, get striker() { return striker; },
		get strikeRipples() { return strikeRipples; }, get studio() { return studio; },
		get sunGlare() { return sunGlare; }, get surfaceOpen() { return surfaceOpen; },
		get surprises() { return surprises; }, get teardown() { return teardown; }, get tick() { return tick; },
		get time() { return time; }, set time(next) { time = next; }, get travel() { return travel; },
		get underwaterAudio() { return underwaterAudio; },
		get updateFlightControls() { return updateFlightControls; }, get visible() { return visible; },
		get voyage() { return voyage; }, get watchDoor() { return watchDoor; },
		get watchTalk() { return watchTalk; }, get watchTeleport() { return watchTeleport; },
		get waypoint() { return waypoint; }, get world() { return world; }, set world(next) { world = next; },
		get worldAudio() { return worldAudio; }, get yieldBuild() { return yieldBuild; }, get you() { return you; },
	};
	const storage = (() => { try { return localStorage; } catch { return null; } })();
	const initialMode = graphicsMode(storage), SAFE = new URLSearchParams(location.search).has('safe');
	// No HUD, observers, or game listeners exist until a valid graphics context does.
	const graphics = createGraphicsRenderer({ canvas: document.createElement('canvas'), Renderer: THREE.WebGLRenderer,
		replaceCanvas: () => document.createElement('canvas'), storage, phone: GFX, safe: SAFE, mode: initialMode });
	const renderer = graphics.renderer;
	const recovery = createGraphicsRecovery({ onTimeout: failGraphicsRecovery }), draw = renderer.render.bind(renderer);
	renderer.render = (...args) => {
		if (recovery.blocked()) throw graphicsReloadError();
		if (renderer.getContext().isContextLost()) return;
		return draw(...args);
	};
	const dom = buildDom(graphics.canvas);
	// a touch screen's controls: icons only, laid out by thumb (ui/touch-skin.js)
	skinTouch(dom.mount);
	// declared here, made once the hint and camera exist (see below)
	let drive = { update: () => false, stop() {}, active: () => false };
	// three numbers a program's textures across both its stages and warns past the one stage's
	// limit (16 on Macs and phones), every draw; the units themselves go up to the combined limit
	// (32 there), and each stage keeps inside its 16 (the smoke's samplers check)
	// the shader last linked (if the graphics are lost while one is being built, it is the one):
	// its size and its own uniforms, for the console
	const linking = { what: '', failedGround: false };
	{
		const gl = renderer.getContext(), src = new WeakMap(), ss = gl.shaderSource.bind(gl), lp = gl.linkProgram.bind(gl), at = gl.attachShader.bind(gl), parts = new WeakMap();
		gl.shaderSource = (sh, text) => { if (sh) src.set(sh, text); ss(sh, text); };
		gl.attachShader = (pr, sh) => { if (pr && sh) { const l = parts.get(pr) || []; l.push(sh); parts.set(pr, l); } at(pr, sh); };
		gl.linkProgram = (pr) => {
			const text = pr ? (parts.get(pr) || []).map((sh) => src.get(sh) || '').join('\n') : '';
			const own = [...new Set((text.match(/uniform\s+\w+\s+(u[A-Z]\w*)/g) || []).map((x) => x.split(/\s+/).pop()))];
			linking.what = `${Math.round(text.length / 1000)} KB, ${(text.match(/#define SHADER_NAME (.*)/) || [])[1] || ''} uniforms: ${own.slice(0, 16).join(' ')}`;
			lp(pr);
		};
	}
	// a shader that fails: say which (its features and its own uniforms), then three's usual report
	renderer.debug.onShaderError = (gl, program, vs, fs) => {
		const text = (gl.getShaderSource(vs) || '') + (gl.getShaderSource(fs) || '');
		const defs = [...new Set((text.match(/#define (USE_\w+|\w*SHADOW\w*|ALPHA\w+|DOUBLE_SIDED|FLIP_SIDED|INSTANCED\w*)/g) || []).map((d) => d.slice(8)))];
		const own = [...new Set((text.match(/uniform\s+\w+\s+(u[A-Z]\w*)/g) || []).map((x) => x.split(/\s+/).pop()))];
		// Remember the first ground failure, even if many other programs fail before
		// the browser finally dispatches contextlost. The last linked shader alone
		// can be an unrelated tiny effect by then.
		if (own.includes('uBayOn')) { linking.failedGround = true; preferLite(); }
		if (own.includes('uSgFar')) recoverSignage(storage);
		console.error('[shader failed]', Math.round(text.length / 1000) + ' KB', 'lost:', gl.isContextLost(), 'link:', gl.getProgramInfoLog(program), 'vs:', gl.getShaderInfoLog(vs), 'fs:', gl.getShaderInfoLog(fs), 'defines:', defs.join(' '), 'uniforms:', own.join(' '));
	};
	const fullUnits = () => { const gl = renderer.getContext(); renderer.capabilities.maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS); };
	fullUnits();
	// what the graphics hold, for the quality governor (world/gpumeter.js, world/governor.js)
	const gpuMeter = meterGL(renderer.getContext());
	// the graphics can be lost (a phone short of memory): the world holds still, three rebuilds
	// what it draws when they come back, and the governor takes the device a tier lower from then
	// on (and for a few days), so the next frames ask less of it. If they do not come back within a
	// few seconds, say to reload; nothing reloads by itself, so a device cannot go round in a loop.
	let lost = false;
	function failGraphicsRecovery() {
		recoverSignage(storage);
		governor.lost(3);
		window.L99Loading.fail(graphicsReloadError(), { exit: () => api.close() });
	}
	dom.canvas.addEventListener('webglcontextlost', (event) => {
		event.preventDefault();
		lost = true;
		const blocked = recovery.lost();
		if (blocked || /signage-|uSgFar/.test(linking.what)) recoverSignage(storage);
		// remembered, so the next load starts somewhere safe; and what was being built, for the console
		try { localStorage.setItem('l99-gl-lost', String(Date.now())); } catch { /* private mode */ }
		// (the light ground only when it was the ground being built: a loss elsewhere is no reason)
		if (linking.failedGround || /uBayOn/.test(linking.what)) preferLite();
		graphics.lighter = true;
		governor.lost(blocked ? 3 : 2);
		// Stop optional passes and discard their targets/unfinished warm-up. The
		// same large attachments must not be recreated on the first restored frame.
		seaMirror.reset(); seaDepth.reset();
		if (!building && world) { share.keep(true, true); social.flush(); world.player.clearInput(); }
		console.error('[graphics lost] at', camera.position.toArray().map(Math.round).join(', '), 'being built:', linking.what, 'last shaders warmed:', shaderWarm.recent(), 'governor:', JSON.stringify(governor.info()));
		shaderWarm.reset();
		if (blocked) {
			failGraphicsRecovery();
			return;
		}
		hint('The graphics were reset. Restoring…', 6000, 3);
	});
	dom.canvas.addEventListener('webglcontextrestored', () => {
		if (!recovery.restored()) return; // The recovery screen owns the next user action.
		lost = false; gpuMeter.reset(); fullUnits(); shaderWarm.reset();
		applyQuality();
		// (the frame clock starts again from now, not from before the loss)
		last = performance.now(); frameAvg = 16;
		hint('Graphics restored, at lighter settings.', 3000, 3);
	});
	// AgX: a film-like curve that rolls highlights off gently and keeps greens from going
	// neon; ACES crushed the shade and pushed saturation, which read as harsh
	renderer.toneMapping = THREE.AgXToneMapping;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.shadowMap.enabled = !SAFE;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	let pixelRatio = renderRatio({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, phone: GFX, safe: SAFE || graphics.lighter, mode: initialMode });
	renderer.setPixelRatio(pixelRatio);
	const camera = new THREE.PerspectiveCamera(70, 1, 0.25, 16000);
	const scene = HOOKS.scene = new THREE.Scene();
	const shaderWarm = createShaderWarm(renderer, scene, camera);

	const shared = {
		aimSensitivity: loadAimSensitivity(),
		uTime: { value: 0 }, uWet: { value: 0 }, uWind: { value: 0.5 }, uGust: { value: 0 }, uWindT: { value: 0 }, uWindDir: { value: new THREE.Vector2(0.93, 0.35) }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uPulse: { value: 0 },
		uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uSunColor: { value: new THREE.Color(1, 0.95, 0.86) },
		uSkyZen: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color(0.3, 0.35, 0.4) },
		uWave: { value: 1 }, uUnder: { value: 0 }, startHours: 10.5,
	};
	// the land, the village and the boats drawn upside down for the sea to reflect (world/seamirror.js)
	const seaMirror = createSeaMirror(renderer, { phone: GFX, safe: SAFE });
	shared.mirrorU = seaMirror.uniforms;
	// and what stands in the water, by its depth, for its tint and the foam round it (world/seadepth.js)
	const seaDepth = createSeaDepth(renderer, { phone: GFX, safe: SAFE });
	shared.seaDepthU = seaDepth.uniforms;
	// (the cars' paint and glass reflect this sky)
	bindCarSky(shared);
	bindSignLighting(shared);
	// ground occupancy around the player (filled by vegetation, read by terrain and grass)
	// r: bare, shaded earth (trees, palms, rocks); g: a soil mound that grass hugs (every plant)
	shared.occ = new THREE.DataTexture(new Uint8Array(256 * 256 * 2), 256, 256, THREE.RGFormat, THREE.UnsignedByteType);
	shared.occ.magFilter = shared.occ.minFilter = THREE.LinearFilter;
	shared.occ.needsUpdate = true;
	shared.uOcc = { value: shared.occ };
	shared.uOccO = { value: new THREE.Vector3(0, 0, 160) };
	// footprints: a 64 m patch of soft ground round the player that each step presses into
	const PR = 512, PSPAN = 32, prints = new Uint8Array(PR * PR);
	shared.prints = new THREE.DataTexture(prints, PR, PR, THREE.RedFormat, THREE.UnsignedByteType);
	shared.prints.magFilter = shared.prints.minFilter = THREE.LinearFilter;
	shared.prints.needsUpdate = true;
	shared.uPrints = { value: shared.prints };
	shared.uPrintsO = { value: new THREE.Vector3(-1e5, -1e5, PSPAN) };
	const step = { dist: 0, side: 1, x: 0, z: 0, init: false, stamps: 0, calls: 0, why: '' };
	shared.printStep = step;
	function stampPrints(P) {
		const O = shared.uPrintsO.value, px = PR / PSPAN;
		step.calls++;
		if (!step.init || Math.abs(P.pos.x - (O.x + PSPAN / 2)) > 8 || Math.abs(P.pos.z - (O.y + PSPAN / 2)) > 8) {
			// recentre on the player, carrying the prints already made across
			const nx = Math.round((P.pos.x - PSPAN / 2) / (PSPAN / PR)) * (PSPAN / PR), nz = Math.round((P.pos.z - PSPAN / 2) / (PSPAN / PR)) * (PSPAN / PR);
			const di = Math.round((nx - O.x) * px), dj = Math.round((nz - O.y) * px), old = prints.slice();
			prints.fill(0);
			if (step.init) for (let j = 0; j < PR; j++) for (let i = 0; i < PR; i++) {
				const si = i + di, sj = j + dj;
				if (si >= 0 && sj >= 0 && si < PR && sj < PR) prints[j * PR + i] = old[sj * PR + si];
			}
			O.set(nx, nz, PSPAN); step.init = true; step.x = P.pos.x; step.z = P.pos.z;
			shared.prints.needsUpdate = true;
		}
		const d = Math.min(1.5, Math.hypot(P.pos.x - step.x, P.pos.z - step.z));
		step.x = P.pos.x; step.z = P.pos.z;
		if (!P.grounded || P.swimming || P.locked) { step.why = 'air'; return; }
		step.dist += d;
		if (step.dist < 0.72) return;
		step.dist = 0; step.side = -step.side; step.stamps++;
		const hx = -Math.sin(P.yaw), hz = -Math.cos(P.yaw), sx = -hz * step.side * 0.14, sz = hx * step.side * 0.14;
		const cx = (P.pos.x + sx - O.x) * px, cz = (P.pos.z + sz - O.y) * px;
		// an oval heel-to-toe along the heading
		for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
			const x = Math.round(cx + i), z = Math.round(cz + j);
			if (x < 0 || z < 0 || x >= PR || z >= PR) continue;
			const wx = i / px, wz = j / px, a = wx * hx + wz * hz, b = wx * -hz + wz * hx;
			const e = (a / 0.15) * (a / 0.15) + (b / 0.065) * (b / 0.065);
			if (e >= 1) continue;
			const v = Math.round(255 * Math.pow(1 - e, 0.6)), k = z * PR + x;
			if (v > prints[k]) prints[k] = v;
		}
		shared.prints.needsUpdate = true;
	}

	let world = null, running = false, visible = false, last = 0, time = 0, frameAvg = 16, quality = initialMode;
	// Desktop also adapts to slow frames; an explicit saved High/Low choice is retained.
	// (a phone on Ultra holds the desktop's graphics: a larger share of its memory before stepping down)
	const governor = HOOKS.governor = createGovernor({ phone: isPhone, mode: () => quality, meter: gpuMeter, storage, ...(isPhone && ULTRA ? { budgetMB: 1400 } : {}) });
	if (graphics.lighter && !SAFE && governor.state.ceiling < 2) governor.lost();
	if (governor.crashedLastTime) console.warn('[governor] the last visit ended without a goodbye: starting lighter', JSON.stringify(governor.info()));
	// what the graphics hold, for the loading screen's black box (loading-screen.js), and the
	// on-screen frame readout (?perf, ui/perfmeter.js)
	window.L99GpuMB = () => Math.round(gpuMeter.bytes() / 1048576);
	const perf = HOOKS.perf = createPerfMeter({ mount: dom.mount, renderer, governor, storage, search: location.search });
	applyQuality();
	let panelClock = null;
	setInterval(() => { if (panelClock && dom.panel.style.display === 'block') panelClock.refresh(); }, 1000);
	const state = { seed: null };

	// (a hint with priority holds the line for its time: a place name passing by can't
	// clear a found verse)
	function hint(text, ms = 4000, pri = 0) {
		const now = performance.now();
		if (pri < (hint.pri || 0) && now < (hint.until || 0)) return;
		hint.pri = pri; hint.until = now + ms;
		dom.hint.textContent = text;
		dom.hint.style.opacity = '1';
		clearTimeout(hint.t);
		hint.t = setTimeout(() => { dom.hint.style.opacity = '0'; }, ms);
	}
	// the Guide: talk, ask, be taken places (a model on this device, or the built-in guide)
	// people is filled in just below; the guide reaches it through this api object
	// Arms/world-sites are injected as pure data. The adapter keeps all inventory
	// mutations in one place for the Guide, NPC conversations and the Crysis console.
	const arms = createArmsRuntime({ world: () => world, sites: (W) => W?.worldSites || W?.sites || [], startingCredits: 1000, hint: (t, ms) => hint(t, ms, 1) });
	HOOKS.arms = arms;
	const guideApi = { world: () => world, scene, camera, shared, hint, people: null, arms, goTo: (lat, lon, agl) => HOOKS.goTo?.(lat, lon, agl) ?? 'Earth only.' };
	const guide = createGuide(dom.mount, guideApi);
	// the pin and direction chip for the meeting or quest place the guide is tracking
	// (the wayfinder's trail lies on the floor you walk: the ground, a bridge's deck, a cave's floor)
	const waypoint = guideApi.waypoint = createWaypoint({ scene, camera, mount: dom.mount, onTap: () => guide.showQuests(), wayfinder: true, groundAt: (x, z, y) => world?.player?.floorAt?.(x, z, y) ?? world?.island?.heightAt?.(x, z) });
	HOOKS.waypoint = waypoint;
	// the city director (earth/): what should be in the towns and cities you come to, the same
	// for every player (the discovery server's brief, else the Earth atlas's); the Guide's
	// model is passed only for the dev flag in earth/config.js
	const earthDirector = HOOKS.earth = createDirector({ llm: guide.llm, toLatLon: globeLL });
	// secrets and surprises: the Bard's lost verses, fireworks, the foghorns, the calendar
	const surprises = createSurprises({ scene, camera, getWorld: () => world, hint: (t, ms) => hint(t, ms, 1), say: (t, w) => guide.say(t, w), isPhone });
	guideApi.secret = (t) => surprises.secret(t);
	HOOKS.surprises = surprises;
	// fishing, wherever there is water
	const fishing = createFishing({ scene, camera, getWorld: () => world, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount });
	HOOKS.fishing = fishing;
	// the minigames (games/*.js): a games button, and a Play button at their venues
	const arcade = createArcade({ scene, camera, mount: dom.mount, getWorld: () => world, hint: (t, ms) => hint(t, ms, 1), isPhone, teleportTo: (name, lat, lon) => teleport([name, lat, lon, world?.player.state.yaw || 0]) });
	HOOKS.arcade = arcade;
	// drive the roads, streets and trails: snap on, choose the turns
	drive = createDrive({ world: () => world, camera, mount: dom.mount, isPhone, hint, strike: (car) => HOOKS.impacts?.strike(car) || 0 });
	// the overpasses' joints underfoot and overhead (bay/bridgesound.js)
	const bridgeSound = createBridgeSound({ world: () => world, carAt: () => drive.carAt() });
	HOOKS.drive = drive;
	// anyone struck down or thrown: limp, weighed bodies (people/ragdoll.js)
	const ragdolls = createRagdolls({ world: () => world, isPhone: GFX });
	HOOKS.ragdolls = ragdolls;
	HOOKS.impacts = createImpacts({ people: () => ({pool:[...people.pool,...social.actors.all()]}), ragdolls, onImpact:p=>{HOOKS.combat?.vehicleImpact(p);world?.services?.injury(p);}, ward: (p) => HOOKS.combat?.ward(p) });
	// taking a car off its driver (E beside one in the traffic): you, shown, haul them out
	const avatar = HOOKS.avatar = createAvatar({ scene, world: () => world });
	const carjack = createCarjack({ world: () => world, camera, drive, ragdolls, avatar, hint: (t, ms) => hint(t, ms, 1) });
	HOOKS.carjack = carjack;
	// you, seen (P), knocked down by the traffic, and a shove (X) (people/self.js)
	// the tattoo studio (in a parlour, or Crysis.tattoo()): your own designs, worn from then on
	const studio = createTattooStudio({ mount: dom.mount, avatar, player: () => world.player, setCine: (fn) => { HOOKS.cine = fn; }, hint: (t, ms) => hint(t, ms, 1), isPhone });
	const inkBtn = button('🖋 Tattoo studio', 'Tattoo studio (T)', 'display:none;', 'prompt 61');
	dom.mount.appendChild(inkBtn);
	inkBtn.addEventListener('click', (e) => { e.stopPropagation(); studio.start(); });
	HOOKS.tattoo = () => studio.start();
	HOOKS.tattooInfo = () => studio.info();
	for (const ev of ['pointerdown', 'touchstart']) inkBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if ((e.key === 't' || e.key === 'T') && !e.repeat && world?.bizSeen?.type === 'tattoo' && !studio.active() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); studio.start(); } });
	const you = createSelf({ world: () => world, camera, avatar, ragdolls, people: () => people, busy: () => carjack.active() || drive.active() || !!world?.boat?.boarded?.(), driving: () => (drive.active() && !carjack.active()) || !!world?.boat?.boarded?.(), hint: (t, ms) => hint(t, ms, 1), ward: (p) => HOOKS.combat?.ward(p) });
	HOOKS.self = you;
	// a look at your hero in the game itself, for development (?heroview, Crysis.heroView)
	const heroView = HOOKS.heroView = createHeroView({ scene, renderer, avatar, self: you, world: () => world, setCine: (fn) => { HOOKS.cine = fn; } });
	// your body made in a quiet moment soon after the world is entered, not when it is first
	// needed (the first weapon taken up, whose arms are yours, or the first look at yourself):
	// its making takes some hundreds of milliseconds
	{ const t = setInterval(() => { if (world?.player && !window.L99Loading?.active()) { clearInterval(t); (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(() => avatar.ready().catch(() => {}), { timeout: 4000 }); } }, 2000); }
	if (/[?&]heroview\b/.test(location.search)) { const t = setInterval(() => { if (world?.player && !window.L99Loading?.active()) { clearInterval(t); heroView.open(); } }, 1000); }
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || window._KEYS_PLAY_ON || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
		if (e.key === 'p' || e.key === 'P') { you.toggle(); e.preventDefault(); } else if (e.key === 'x' || e.key === 'X') { you.shove(); e.preventDefault(); }
	});
	addEventListener('keydown', (e) => { if ((e.key === 'e' || e.key === 'E') && !e.repeat && document.activeElement?.tagName !== 'INPUT' && carjack.candidate()) { carjack.begin(); e.preventDefault(); } });
	// auto music: a generative score on the faceplate's own instruments (music/automusic.js)
	const autoMusic = createAutoMusic({ world: () => world, camera, shared, drive, arcade, mount: dom.mount, active: () => running && visible });
	HOOKS.autoMusic = autoMusic;
	// explore: a hands-free cruise filmed to the auto music (O, explore.js)
	const explore = HOOKS.explore = createExplore({ world: () => world, camera, drive, music: autoMusic, you, avatar, mount: dom.mount, button, hint: (t, ms) => hint(t, ms, 1), isPhone, busy: () => window.L99Loading.active() || arcade.active() || studio.active() || carjack.active() || !!world?.boardwalk?.riding?.() });
	// people: real bodies about the village and the city streets
	const people = createPeople(scene, () => world, camera);
	// some of them out with their dogs on a lead (people/dogwalkers.js)
	const dogWalkers = createDogWalkers({ scene, people, world: () => world, isPhone: GFX });
	guideApi.people = people;
	// households, their days and their food, and the moments of it you see (people/family-life.js)
	const families = HOOKS.families = createFamilyLife({ scene, world: () => world, camera, people, isPhone, mount: dom.mount, hint,
		wallet: { credits: () => arms.state().credits, spend: c => arms.spendCredits(c, { reason: 'community-aid' }) },
		releaseBody: P => ragdolls.release(P), morality: () => HOOKS.morality || null });
	addTalkers(() => families.actors().filter(p => p.active && p.P.root.visible));
	const social = createNpcSocial({ scene, world: () => world, camera, people, isPhone, hint });
	addTalkers(() => world?.underworld?.village?.()?.folk.filter(p => !p.socialOwned && p.P.root.visible) || []);
	guideApi.social = social;
	HOOKS.social = social;
	addEventListener('pagehide', () => social.flush());
	// the colour of what a foot kicks up, by what is underfoot (audio/sensing.js's surfaces)
	const KICK = { dirt: [0.5, 0.44, 0.36], sand: [0.72, 0.66, 0.54], grass: [0.46, 0.43, 0.34], gravel: [0.55, 0.53, 0.5], snow: [0.92, 0.94, 0.97], water: [0.8, 0.86, 0.9] };
	// the world's audio: footsteps, the room's sound, the places' ambience (audio/*.js)
	const worldAudio = createWorldAudio({ getWorld: () => world, camera, people, busy: () => arcade.active() || drive.active() || !!world?.boat?.boarded?.() || !!world?.boardwalk?.riding?.(), planet: () => shared.planet });
	HOOKS.audio = worldAudio;
	// and, very rarely, in the woods after dark, someone who is not one of them
	const ghost = createGhost(scene, { world: () => world, mount: dom.mount, canvas: dom.canvas, hush: (k) => world?.natureSound?.hush?.(k) });
	HOOKS.ghost = (at) => ghost.summon(camera, at);
	HOOKS.ghostInfo = () => ghost.inspect();
	const picnic = createPicnicJam({ scene, world: () => world, camera, profile: () => shared.planet, mount: dom.mount, isPhone, hint,
		busy: () => arcade.active() || drive.active() || !!world?.boat?.boarded?.() || !!world?.orbit?.active?.() });
	HOOKS.picnic = picnic;
	// the sculpted animals in a row in front of you (a look at them: Crysis.creatures())
	HOOKS.creatures = () => {
		const P = world.player.state, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
		const list = [CREATURES.harborSeal(0.3), CREATURES.harborSeal(0.8), CREATURES.seaLion(0.5), CREATURES.elephantSeal(true), CREATURES.deer(), CREATURES.waterfowl('mallard'), CREATURES.waterfowl('goose'), CREATURES.bird('gull'), CREATURES.bird('pelican'), CREATURES.bird('vulture'), CREATURES.bird('hawk')];
		const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6 }), g = new THREE.Group();
		list.forEach((geo, i) => { const m = new THREE.Mesh(geo, mat), off = (i - (list.length - 1) / 2) * 2.4, x = P.pos.x + fx * 7 + rx * off, z = P.pos.z + fz * 7 + rz * off; m.position.set(x, world.island.heightAt(x, z) + (i >= 7 ? 1.2 : 0), z); m.rotation.y = P.yaw + Math.PI / 2 + 0.5; m.castShadow = true; g.add(m); });
		scene.add(g);
		return list.length;
	};
	// walk up to someone and talk: a button with their name, or Enter
	const talkBtn = button('💬 Talk', 'Talk (Enter)', 'display:none;', 'prompt 50');
	dom.mount.appendChild(talkBtn);
	let talkTarget = null, talkT = 0;
	// (someone asking a favour: the same control says yes to it, people/errands.js)
	const talkNow = () => { if (!talkTarget) return; if (HOOKS.errands?.asking(talkTarget)) HOOKS.errands.accept(); else guide.talkTo(talkTarget); };
	talkBtn.addEventListener('click', (e) => { e.stopPropagation(); talkNow(); });
	for (const ev of ['pointerdown', 'touchstart']) talkBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if (e.key === 'Enter' && talkTarget && document.activeElement?.tagName !== 'INPUT' && dom.mount.style.display !== 'none') { e.preventDefault(); talkNow(); } });
	// teleport while flying: a line pin button in the rail, and a list of places to land
	const PLACES_TP = [
		['Golden Gate Bridge, Vista Point', 37.8326, -122.4814, 2.6], ['Downtown San Francisco', 37.7936, -122.3965, 0.9], ['Twin Peaks', 37.7544, -122.4477, 0.2],
		['San Ramon', 37.7700, -121.9380, 0], ['Lake Annabel, Bishop Ranch', 37.7646, -121.9660, -2.2], ['Mt Diablo summit', 37.8816, -121.9142, 0.8], ['Rock City, Mt Diablo', 37.8452, -121.9400, -1.3],
		['Mt Tamalpais, East Peak', 37.9293, -122.5780, 2.2], ['Mission Peak', 37.5125, -121.8806, 1.5], ['Berkeley Hills', 37.8812, -122.2425, 1.9],
		['Tide pools, Moss Beach', 37.5214, -122.5166, 1.75], ['Devil\'s Slide, Highway 1', 37.5738, -122.5148, 3.1], ['Half Moon Bay, Highway 1', 37.4640, -122.4330, 0], ['Duxbury Reef, Bolinas', 37.8936, -122.6972, 2.3],
		['Bay Area Discovery Museum, Fort Baker', 37.8345, -122.4782, 3.3], ['Pacifica Pier', 37.6336, -122.4935, 1.8], ['San Ramon Central Park', 37.7643, -121.9528, 0.5], ['Apple Park, Cupertino', 37.3310, -122.0040, 0.6], ['Downtown San Jose', 37.3330, -121.8890, 0], ['Pescadero State Beach, Highway 1', 37.2680, -122.4105, 1.7], ['Pigeon Point Light Station', 37.1845, -122.3925, 2.3], ['Santa Cruz Beach Boardwalk', 36.96317, -122.01846, -1.29], ['Santa Cruz Municipal Wharf', 36.96263, -122.02233, -2.97], ['San Lorenzo River, the Riverwalk', 36.97440, -122.02088, 3.14],
		['Lake Chabot', 37.72148, -122.10911, -1.28], ['Crystal Springs Reservoir', 37.52951, -122.3625, 2.31], ['Lexington Reservoir', 37.2003, -121.98768, 2.09], ['San Lorenzo River, Ben Lomond', 37.08781, -122.08775, -1.57],
		['The island village', null, null, 0], ['A town beyond the map', 'town', null, 0],
	];
	const tpBtn = button('', 'Teleport to a place', 'width:44px;padding:6px 10px;align-items:center;justify-content:center;display:none;', 'rail 60');
	tpBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
	dom.mount.appendChild(tpBtn);
	const tpMenu = css(document.createElement('div'), 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));max-height:calc(100% - 64px - var(--l99-low, 88px) - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:none;flex-direction:column;gap:4px;padding:8px;border-radius:12px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:7;');
	dom.mount.appendChild(scrollable(tpMenu));
	for (const el of [tpBtn, tpMenu]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());
	// travelling: the view fades to dark with the place's name, you are moved behind it, and
	// it only lifts once the new place is built and the frames are running smoothly again
	const travelVeil = css(document.createElement('div'), 'position:absolute;inset:0;z-index:8;pointer-events:none;opacity:0;transition:opacity .22s ease;background:radial-gradient(ellipse at 50% 45%,rgba(8,22,28,.92),rgba(2,8,12,.98));display:flex;align-items:center;justify-content:center;color:#eafaf6;font:600 15px system-ui;letter-spacing:.06em;text-align:center;padding:24px;');
	dom.mount.appendChild(travelVeil);
	let travelling = false, nextTrip = null;
	function travel(label, move) {
		// (a trip asked for while the last one's veil is still up goes once it lifts, not never)
		if (travelling) { nextTrip = [label, move]; return; }
		travelling = true;
		travelVeil.textContent = label || '';
		travelVeil.style.opacity = '1';
		setTimeout(() => {
			try { move(); } catch (err) { console.error('[travel]', err); }
			const t0 = performance.now();
			let last = t0, calm = 0;
			const watch = (now) => {
				calm = now - last < 70 ? calm + 1 : 0;
				last = now;
				// a dozen smooth frames in a row (or eight seconds, whatever happens)
				if ((calm >= 12 && now - t0 > 600) || now - t0 > 8000) {
					travelling = false;
					if (nextTrip) { const [l, m] = nextTrip; nextTrip = null; travel(l, m); return; }
					travelVeil.style.opacity = '0';
					return;
				}
				requestAnimationFrame(watch);
			};
			requestAnimationFrame(watch);
		}, 240);
	}
	function teleport(pl) { tpMenu.style.display = 'none'; travel(pl[0], () => teleportNow(pl)); }
	function teleportNow([name, lat, lon, yaw]) {
		world?.labels?.hide();
		world?.kinetic?.clear();
		world?.orbit?.cancel();
		fishing.drop();
		const W = world, P = W?.player.state;
		if (!P) return;
		let x, z;
		if (lat === null) {
			// the village: in among the houses, walked inland until on dry ground (not under the pier)
			const v = W.island.village, sd = v.seaDir || { x: 0, z: 0 };
			x = v.x; z = v.z;
			for (let k = 0; k < 40 && W.island.heightAt(x, z) < 1.2; k++) { x -= sd.x * 3; z -= sd.z * 3; }
		}
		else if (lat === 'town') {
			const towns = (W.bayArea?.towns || []).filter((t) => W.bayArea.heightAt(t.x, t.z) > 5 && !W.real?.inside(t.x, t.z));
			const t = towns[Math.floor(Math.random() * towns.length)];
			if (!t) return;
			x = t.x; z = t.z; name = t.name;
		} else { const p = toWorld(lat, lon); x = p.x; z = p.z; }
		drive.stop();
		// land on the ground, facing the view
		P.flying = false; P.boost = false; P.diving = false; P.vel.set(0, 0, 0);
		P.pos.set(x, W.island.heightAt(x, z) + 1.7, z);
		P.yaw = yaw; P.pitch = 0.02;
		camera.position.copy(P.pos);
		tpMenu.style.display = 'none';
		hint(name, 2500);
	}
	// globe: anywhere on Earth by latitude and longitude, arriving in the air above it (Crysis.goTo,
	// a landing from orbit with a place, a shared link far off); agl 0 is stood on the ground
	HOOKS.goTo = (lat, lon, agl = 700) => {
		const W = world, P = W?.player.state;
		if (!W?.globe || !P || !Number.isFinite(+lat) || !Number.isFinite(+lon)) return 'Earth only: Crysis.goTo(lat, lon).';
		W.labels?.hide();
		W.kinetic?.clear();
		W.orbit?.cancel();
		drive.stop();
		if (W.boat?.boarded?.()) W.boat.leave();
		const p = W.globe.place(+lat, +lon);
		P.flying = true; P.diving = false; P.vel.set(0, 0, 0); P.pitch = -0.25;
		P.pos.set(p.x, 3000, p.z); camera.position.copy(P.pos);
		p.ready.then(() => { if (world === W) { const g = W.island.heightAt(p.x, p.z); P.pos.y = (Number.isFinite(g) ? Math.max(0, g) : 0) + (agl > 0 ? agl : 1.7); if (agl <= 0) P.flying = false; camera.position.copy(P.pos); } });
		return `To ${(+lat).toFixed(3)}, ${(+lon).toFixed(3)}.`;
	};
	const tpPlaces = [];
	for (const pl of PLACES_TP) {
		const b = css(document.createElement('button'), 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;');
		b.textContent = pl[0];
		b.onclick = (e) => { e.stopPropagation(); teleport(pl); };
		tpMenu.appendChild(b);
		tpPlaces.push(b);
	}
	// the cities round you on Earth (space/landing.js citiesAround): the nearest and the region's
	// biggest, a tap away, stood in the middle of its streets (they grow round you there)
	const cityHead = css(document.createElement('div'), 'flex:none;display:none;padding:8px 4px 2px;font:600 11px system-ui;letter-spacing:.12em;color:#a5f6e2;');
	cityHead.textContent = 'CITIES NEAR YOU';
	const cityList = css(document.createElement('div'), 'flex:none;display:none;flex-direction:column;gap:4px;');
	cityList.dataset.cities = '';
	tpMenu.append(cityHead, cityList);
	function goCity(c) {
		tpMenu.style.display = 'none';
		travel(c.name, () => { HOOKS.goTo(c.lat, c.lon, 0); hint(`${c.name}. Its streets and people grow round you.`, 3500); });
	}
	function refreshCities() {
		const W = world, ll = W?.globe && !W.orbit?.active?.() ? globeLL(camera.position.x, camera.position.z) : null;
		const list = ll ? citiesAround(ll.lat, ll.lon, 8) : [];
		cityList.replaceChildren(...list.map((c) => {
			const b = css(document.createElement('button'), 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(165,246,226,.28);background:rgba(1,169,130,.10);color:#eafaf6;font:13px system-ui;min-height:44px;cursor:pointer;');
			b.dataset.city = c.id;
			const here = c.km < 3;
			const name = document.createElement('div'); name.style.cssText = 'font-weight:600;'; name.textContent = `${here ? '◉' : '⌖'} ${c.name}`;
			const sub = document.createElement('div'); sub.style.cssText = 'font-size:11px;color:rgba(234,250,246,.66);'; sub.textContent = here ? `You are in this ${c.size}` : `${c.size[0].toUpperCase() + c.size.slice(1)}, ${kmLabel(c.km)} away`;
			b.append(name, sub);
			b.onclick = (e) => { e.stopPropagation(); goCity(c); };
			return b;
		}));
		cityHead.style.display = cityList.style.display = list.length ? '' : 'none';
		if (list.length) cityList.style.display = 'flex';
		// (the atlas comes in the first time: the list when it has)
		else if (ll) setTimeout(() => { if (tpMenu.style.display !== 'none' && !cityList.childElementCount) refreshCities(); }, 1200);
	}
	HOOKS.cities = { list: () => { refreshCities(); return [...cityList.children].map((b) => b.dataset.city); }, go: (i = 0) => { const W = world, ll = W?.globe ? globeLL(camera.position.x, camera.position.z) : null, c = ll && citiesAround(ll.lat, ll.lon, 8)[i]; if (!c) return 'No cities known here yet.'; goCity(c); return `To ${c.name}.`; } };
	// share where you are, and homes to come back to (share.js): at the top of the menu
	const openTp = () => { share.refresh(); for (const b of tpPlaces) b.style.display = world?.bayArea ? '' : 'none'; refreshCities(); tpMenu.style.display = 'flex'; };
	const share = createShare({ world: () => world, state, shared, camera, scene, hint, mount: dom.mount, menu: tpMenu, places: PLACES_TP, origin: () => origin, visible: () => visible, enter: (p) => api.open(p), beforeMove: () => { world?.labels?.hide(); world?.kinetic?.clear(); world?.orbit?.cancel(); fishing.drop(); drive.stop(); tpMenu.style.display = 'none'; }, openMenu: openTp, closeMenu: () => { tpMenu.style.display = 'none'; }, arriving, arrived, covered: () => !!arrival, warm: (progress) => { if (arrival) arrival.blind = false; return shaderWarm.all({ budget: 4000, progress }); } });
	HOOKS.share = share;
	// friends in a room (net/): nothing at all until a rooms server is set in net/config.js
	const multiplayer = HOOKS.multiplayer = createMultiplayer({ scene, camera, world: () => world, state, share, hint: (t, ms) => hint(t, ms, 1), mount: dom.mount, menu: tpMenu, canvas: dom.canvas, isPhone, drive, social: () => social, enter: (p) => api.open(p) });
	guideApi.multiplayer=multiplayer;
	tpBtn.addEventListener('click', (e) => { e.stopPropagation(); if (tpMenu.style.display === 'none') openTp(); else tpMenu.style.display = 'none'; });
	// your gear, shops and trading with friends (ui/gear.js)
	const gear = HOOKS.gear = createGear({ arms, multiplayer, mount: dom.mount, menu: tpMenu, button, hint: (t, ms) => hint(t, ms, 1), world: () => world, camera, scene, renderer, avatar, self: you, busy: () => arcade.active() || drive.active() || studio.active(), isPhone, magic: () => HOOKS.magic });
	// fights: your arms in use, the world's squads and their wars, fire, bosses, the morality compass (combat/)
	const combat = HOOKS.combat = createCombat({ scene, camera, mount: dom.mount, world: () => world, services: () => world?.services, people: () => ({ pool: [...people.pool, ...families.actors(), ...social.actors.all()] }), ragdolls, arms, gear: () => gear, multiplayer, hint, isPhone: GFX, shared, drive, menu: tpMenu, busy: () => window.L99Loading.active() || arcade.active() || studio.active() || carjack.active() || !!world?.boardwalk?.riding?.() });
	// magic (magic/): spells on the keys 6 to 0, the spellbook on N, the aether in the world; weapons on 1 to 5
	const magic = HOOKS.magic = createMagic({ scene, camera, mount: dom.mount, combat, arms, world: () => world, light: () => shared.uSunDir.value.y, heavens: () => ({ sun: shared.uSunDir.value, moon: shared.uMoonDir?.value }), hint: (t, ms) => hint(t, ms, 1), busy: () => window.L99Loading.active() || arcade.active() || studio.active() || carjack.active() || drive.active() || !!world?.orbit?.active?.() || !!world?.boat?.boarded?.(), menu: tpMenu, isPhone: GFX, isTouch: isPhone || !!matchMedia?.('(pointer: coarse)')?.matches, me: () => avatar.me, third: () => !!you.state.third });
	// your account: progress saved to the cloud, and back on any device (persistence/cloud-save.js)
	const cloudSave = createCloudSave({ url: roomsURL() });
	HOOKS.account = createAccountPanel({ mount: dom.mount, menu: tpMenu, cloud: cloudSave, hint: (t, ms) => hint(t, ms, 1) });
	// your guild: the townsfolk you ask into it walk and fight beside you, level up and learn
	// magic; with an account, players join it and guilds ally with it (guild/)
	HOOKS.guild = guideApi.guild = createGuild({ combat, guide, social, nearby: () => [...people.pool, ...social.actors.all()], cloud: cloudSave, url: roomsURL(), mount: dom.mount, menu: tpMenu, onFoot: () => !!world?.player && !drive.active() && !world.orbit?.active?.() && !world.boat?.boarded?.(), yaw: () => world?.player?.yaw ?? 0, hint: (t, ms) => hint(t, ms, 1), isPhone: GFX });
	// (the fog's colour under Gargantua's black sky)
	const _voidFog = new THREE.Color(0.012, 0.008, 0.02);
	guideApi.combat=combat;
	// the military's bases, soldiers and vehicles, and the police (military/): they answer to combat's hooks
	const military = HOOKS.military = createMilitary({ scene, camera, mount: dom.mount, world: () => world, combat, isPhone, hint: (t, ms, pri = 1) => hint(t, ms, pri) });
	combat.hooks.posts = military.posts; combat.hooks.trespass = military.trespass;
	// close combat sees your body in third person (combat/melee.js)
	combat.melee.bind({ avatar, self: you });
	// the compass, for every system that records a deed (families' food deeds, favours)
	HOOKS.morality = combat.morality;
	const soul = guideApi.soul = HOOKS.soul = createSoul({ morality: combat.morality, changed: () => multiplayer.refreshSoul?.() });
	multiplayer.linkSoul?.(soul);
	// people you pass notice you and say something, in their own voices (people/chatter.js)
	const chatter = HOOKS.chatter = createChatter({ mount: dom.mount, camera, world: () => world, people, talkers, voice: guide.voice, relationship: p => guide.relationshipFor(p), combat: () => combat, driving: () => drive.active(), isPhone, frameMs: () => frameAvg, errands: () => HOOKS.errands, deeds: () => HOOKS.npcQuests });
	// today's three goals, paid as they are done (gameplay/daily.js)
	const daily = guideApi.daily = HOOKS.daily = createDaily({ arms: () => arms, hint: (t, ms) => hint(t, ms, 1) });
	const note = (kind, data) => daily.note(kind, data);
	// the crosswalks: the signal's tick at the curb, and crossings that count (bay/crosswalks.js)
	const crosswalks = createCrosswalks({ world: () => world, note, driving: () => drive.active() });
	// favours people ask of you as you pass (people/errands.js)
	const encounterPacing = createEncounterPacing({ store: { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) } });
	const errands = guideApi.errands = HOOKS.errands = createErrands({ pacing: encounterPacing, scene, camera, world: () => world, people, chatter, persona: (p) => guide.personaOf(p), arms: () => arms, morality: () => HOOKS.morality, hint: (t, ms) => hint(t, ms, 1), driving: () => drive.active(), isPhone, worldKey: () => HOOKS.combat?.worldKey?.() || 'here', placeName: () => HOOKS.combat?.placeName?.() || '', note, handoff: () => HOOKS.npcQuests?.handoff, money: () => HOOKS.npcMoney, potholes: () => world?.streets });
	// everyone else on the compass: people's deeds, their regions' tallies, their wallets, and the
	// quests they do for each other with or without you (people/npc-quests.js)
	const npcStore = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
	const commons = HOOKS.commons = createCommons({ store: npcStore });
	// (money through the bank's adapter: HOOKS.npcMoney.use(bank) attaches economy/bank.js)
	const npcMoney = HOOKS.npcMoney = createMoney();
	const npcQuests = HOOKS.npcQuests = createNpcQuests({ pacing: encounterPacing, scene, camera, world: () => world, people, chatter, persona: (p) => guide.personaOf(p), errands: () => HOOKS.errands, commons, money: npcMoney, isPhone, livingManaged: true, worldKey: () => HOOKS.combat?.worldKey?.() || 'here', placeName: () => HOOKS.combat?.placeName?.() || '', hint: (t, ms) => hint(t, ms, 1), others: () => [...families.actors(), ...social.actors.all()] });
	commons.follow(combat.morality, npcQuests.regionNow);
	guideApi.npcQuests = npcQuests;
	const livingActors = () => [...people.pool, ...families.actors(), ...social.actors.all(),
		...(world?.colony?.crew?.people?.folk || []).map(f => ({ ...f, actor: f, npcId: livingActorId(f), position: f.pos,
			workSpot: !f.place || f.place === 'work' ? f.goal || f.pos : null, home: f.place === 'quarters' ? f.goal || f.pos : null,
			sites: { ...(!f.place || f.place === 'work' ? { work: 'colony-work:' + f.id } : {}), ...(f.place === 'quarters' ? { home: 'colony-home:' + f.id } : {}) } }))];
	const livingWorld = guideApi.livingWorld = HOOKS.livingWorld = createLivingWorld({
		worldKey: social.bodyKey, region: npcQuests.regionNow, placeName: () => combat.placeName?.() || '',
		position: () => camera.position, world: () => world, structures: () => world?.structures,
		requests: () => world?.city?.economy ? requestBoard : null, npcQuests, actors: livingActors, soul, url: roomsURL(),
		persona: p => guide.personaOf(p), employerOf: id => payroll.employerOf(id), moneyFor: id => { const p = livingActors().find(a => livingActorId(a) === id); if (p?.P?.home) bank.household(p); return bank.moneyTalk(id); },
		utcOffsetMinutes: () => { const date = new Date(), utc = date.getUTCHours() * 60 + date.getUTCMinutes(); return Number.isFinite(world?.sky?.state?.hours) ? Math.round(((world.sky.state.hours * 60 - utc + 2160) % 1440) - 720) : 0; },
		hint: (t, ms) => hint(t, ms, 1),
		onComplete: ({ request, receiptId }) => combat.morality.record({ id: receiptId, kind: request.deeds?.done || 'favour', target: request.giver.name, world: combat.worldKey(), place: combat.placeName(), region: npcQuests.regionNow().id }),
		onContact: (id, context) => {
			const actor = livingActors().find(p => p.active && livingActorId(p) === id);
			if (actor?.M?.S?.pos && actor.M.S.pos.distanceTo(camera.position) < 8) return { actor: actor.actor || actor };
			const at = actor?.M?.S?.pos || actor?.position || context.request?.giver;
			if (at && Number.isFinite(at.x) && Number.isFinite(at.z)) return { message: `Look for ${context.request?.giver?.name || 'the requester'} in this region. Approach them to talk.`, at: { x: at.x, z: at.z } };
			return null;
		},
	});
	guideApi.negotiation = HOOKS.negotiation = createNegotiationRuntime({ arms, world: () => world, bodyKey: social.bodyKey,
		position: () => camera.position, livingWorld, relationship: p => guide.relationshipFor(p), morality: () => combat.morality, structures: () => world?.structures });
	const projectSites = createCommunityProjectSites({ world: () => world, position: () => camera.position,
		targets: () => guide.storyContext().targets, activities: () => livingWorld.snapshot().activities, projects: () => projectSnapshot.projects });
	let projectMarks, projectSnapshot = {projects:[]}, projectRefresh = 0;
	const communityProjects = guideApi.communityProjects = HOOKS.communityProjects = createCommunityProjects({
		worldKey: social.bodyKey, region: npcQuests.regionNow, world: () => world, position: () => camera.position,
		candidates: projectSites.list, toPosition: anchor => worldPosition(world,anchor),
		eligible: () => !!world && !world.player.state.flying && !world.player.state.diving && !world.orbit?.active() && !arcade.active() && !drive.active() && !world.boat?.boarded() && document.visibilityState !== 'hidden' && dom.mount.style.display !== 'none' && !window.L99Loading.active(),
		situation: () => projectSites.situation(projectSnapshot.projects), livingWorld, soul, url: roomsURL(),
		onChange: () => {projectRefresh=0;},
		mark: target => {if(target.initial || waypoint.mark()?.projectId===target.projectId)waypoint.set(target);},
		play: id => { const near=projectMarks?.nearest(camera.position); if(near?.id!==id)return false; window.initAudio?.(); return projectMarks.playNearest(camera.position).ok === true; },
		hint: (text,ms) => hint(text,ms,1),
	});
	projectMarks = HOOKS.projectMarks = createCommunityProjectMarks({scene,world:()=>world,camera,projects:()=>projectSnapshot.projects,maxVisible:GFX?6:8});
	document.addEventListener('visibilitychange',()=>{if(document.hidden)communityProjects.reset();});
	// the economy behind the people: their money in the bank, the businesses' requests among their
	// quests, the businesses' doors among their places (a walk-in's door and tables from
	// commercial.js, named from the registry; the rest at their doors)
	npcMoney.use(bank);
	npcQuests.addSource(fromRequests({ requestsNear, takeRequest, completeRequest }));
	npcQuests.establishments((x, z, r) => {
		const W = world, out = commercialEstablishments(W?.commercial)(x, z, r), E = W?.city?.economy?.near(x, z, r + 20) || [];
		for (const o of out) { let best = null, bd = 25; for (const e of E) { const d = Math.hypot(e.door[0] - o.door.x, e.door[1] - o.door.z); if (d < bd) { bd = d; best = e; } } if (best) { o.id = best.id; o.name = best.name; } }
		for (const e of E) {
			const kind = e.venue === 'cafe' || e.venue === 'restaurant' || e.venue === 'shop' ? e.venue : null;
			if (!kind || out.some((o) => o.id === e.id)) continue;
			out.push({ id: e.id, kind, name: e.name, door: { x: e.door[0], y: W.island.heightAt(e.door[0], e.door[1]), z: e.door[1], heading: Math.atan2(e.door[0] - e.x, e.door[1] - e.z) }, tables: [] });
		}
		return out;
	});
	// the services claim their buildings from the economy, and its boards carry their names
	for (const kind of ['hospital', 'police', 'fire', 'armory']) registerSiting(kind, (b) => { const F = world?.services?.list?.().find((f) => f.kind === kind && Math.abs(f.x - b.x) < 1 && Math.abs(f.z - b.z) < 1); return F ? F.name || true : false; });
	// (a hospital hears of people knocked down here: HOOKS.npcHurt(fn); it bills through the bank)
	HOOKS.npcHurt = npcQuests.onHurt;
	// (the nearest hospital sends for whoever is knocked down: services/)
	HOOKS.npcHurt((e, p) => world?.services?.injury(p, e.why, e.child ? 0.5 : 0.6));
	// city-wide catastrophes, rare (cataclysm/): quakes, wildfires, a magma world's eruption; the
	// crews held off, the services sent, people sheltering, things to do. HOOKS.cataclysm.on(fn)
	guideApi.cataclysm = HOOKS.cataclysm = createCataclysm({ scene, camera, mount: dom.mount, world: () => world, shared, renderer, isPhone, people, hooks: HOOKS, hint: (t, ms) => hint(t, ms, 1), persona: (p) => guide.personaOf(p) });
	// law and order over combat's and the police's hooks: witnesses and calls, the escalation
	// ladder, arrests and fines, the gangs' corners by region, tactics (law/)
	HOOKS.law = createLaw({ world: () => world, combat, military, people: () => ({ pool: [...people.pool, ...families.actors(), ...social.actors.all()] }), services: () => world?.services, money: () => HOOKS.npcMoney, arms, hint: (t, ms, pri = 1) => hint(t, ms, pri), isPhone, mount: dom.mount, touch: isPhone || !!matchMedia?.('(pointer: coarse)')?.matches, hours: () => world?.sky?.state?.hours ?? 12, region: () => { const R = npcQuests.regionNow(); return { id: R.id, name: R.name, tally: commons.region(R.id), situation: npcQuests.situation?.() }; } });
	// using what you hold: a medkit on you or on someone hurt (gameplay/item-use.js)
	const itemUse = HOOKS.itemUse = createItemUse({ arms, combat: () => HOOKS.combat, people, persona: (p) => guide.personaOf(p), camera, hint: (t, ms) => hint(t, ms, 1), chatter, morality: () => HOOKS.morality, worldKey: () => HOOKS.combat?.worldKey?.() || 'here', note, errands: () => HOOKS.errands });
	const useBtn = button('🩹 Use', 'Use what you hold (U)', 'display:none;', 'prompt 55');
	dom.mount.appendChild(useBtn);
	useBtn.addEventListener('click', (e) => { e.stopPropagation(); itemUse.use(); });
	for (const ev of ['pointerdown', 'touchstart']) useBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if ((e.key === 'u' || e.key === 'U') && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && dom.mount.style.display !== 'none' && itemUse.usable()) { e.preventDefault(); itemUse.use(); } });
	// fares: people hail you while you drive (vehicles/fares.js)
	const fares = guideApi.fares = HOOKS.fares = createFares({ camera, world: () => world, people, chatter, persona: (p) => guide.personaOf(p), drive, arms: () => arms, hint: (t, ms) => hint(t, ms, 1), isPhone, note });
	function watchTeleport() {
		// (shown on every world, walking too: sharing and homes live in the menu)
		const P = world?.player.state, on = !!P && !arcade.active();
		const d = on ? 'flex' : 'none';
		if (tpBtn.style.display !== d) tpBtn.style.display = d;
		if (!on && tpMenu.style.display !== 'none') tpMenu.style.display = 'none';
	}
	// the singing stones (planet/resonance.js): look at one within reach and strike it, by the
	// button, E, or a click or tap on the stone; the caves' alcoves, the Deep Gate and the
	// Deep's own, and the boulders that bob with the music
	const striker = HOOKS.striker = createStriker({ camera, mount: dom.mount, button, isPhone, canvas: dom.canvas, shared });
	const strikeRipples = createRipples(scene, 6);
	striker.add(() => world?.underworld?.elements?.targets?.());
	striker.add(() => world?.deep?.targets?.());
	striker.add(() => {
		const W = world, B = W?.vegetation?.boulders?.();
		if (!B?.length || (W.underworld?.inside?.() || 0) > 0.5 || W.deep?.active()) return null;
		const out = [], seen = new Set(), cam = camera.position;
		for (const { it } of B) {
			if (seen.has(it) || Math.hypot(it.x - cam.x, it.z - cam.z) > 6 + it.scale) continue;
			seen.add(it);
			const lift = it.resonance?.y || 0;
			out.push({ pos: new THREE.Vector3(it.x, it.y + lift + it.scale * 0.45, it.z), r: it.scale * 0.85, label: 'Strike the boulder', icon: '🔔', reach: 2.6, color: 0xffe7b8, act: () => {
				W.vegetation.kick(it, 0.8);
				ring([0, 1, 2, 4, 5][Math.abs(Math.floor(it.x * 7 + it.z * 13)) % 5] - 7, { vel: 0.55, dur: 1.8, bell: true });
				strikeRipples.spawn(new THREE.Vector3(it.x, it.y + lift + 0.05, it.z), 0xffe7b8, 4 + it.scale * 2);
			} });
		}
		return out;
	});
	// doors within reach: a button, or E
	const doorBtn = button('🚪 Open', 'Open the door (E)', 'display:none;', 'prompt 60');
	dom.mount.appendChild(doorBtn);
	let doorHere = null, doorT = 0, indoorK = 0;
	const useDoor = () => { if (doorHere) { doorHere.toggle(); doorT = 1; } };
	doorBtn.addEventListener('click', (e) => { e.stopPropagation(); useDoor(); });
	for (const ev of ['pointerdown', 'touchstart']) doorBtn.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if ((e.key === 'e' || e.key === 'E') && doorHere && document.activeElement?.tagName !== 'INPUT' && dom.mount.style.display !== 'none') { e.preventDefault(); useDoor(); } });
	function watchDoor(dt) {
		doorT += dt;
		if (doorT < 0.15) return;
		doorT = 0;
		const P = world?.player.state;
		doorHere = P && !P.flying && world.houses ? world.houses.doorNear(camera) || world.interiors?.doorNear(camera) : null;
		doorBtn.style.display = doorHere ? '' : 'none';
		if (doorHere) {
			const what = doorHere.kind === 'garage' ? 'garage door' : doorHere.kind === 'slider' ? 'slider' : 'door';
			doorBtn.textContent = `🚪 ${doorHere.open ? 'Close' : 'Open'} ${what}${isPhone ? '' : ' (E)'}`;
		}
	}
	function watchTalk(dt) {
		talkT += dt;
		if (talkT < 0.25) return;
		talkT = 0;
		const P = world?.player.state, cur = guide.partner();
		// walked away from someone you were talking with: the conversation ends
		if (cur && P && cur.p.M.S.pos.distanceTo(camera.position) > 7) { guide.endTalk(); hint(`${cur.persona.first} goes back to what they were doing.`, 2500); }
		// (nobody to talk to from a moving maglev or rover)
		talkTarget = P && !P.flying && !cur && !world?.colony?.riding?.() ? people.facing(camera.position, P.yaw) : null;
		talkBtn.style.display = talkTarget ? '' : 'none';
		const U = HOOKS.itemUse?.usable(), showUse = !!U && !P?.flying && !drive.active();
		useBtn.style.display = showUse ? '' : 'none';
		if (showUse) useBtn.textContent = isPhone ? U.label : `${U.label} (U)`;
		if (talkTarget) talkBtn.textContent = HOOKS.errands?.asking(talkTarget) ? (isPhone ? '🤝 Help' : '🤝 Help (Enter)') : isPhone ? '💬 Talk' : '💬 Talk (Enter)';
	}

	// the loading card over a whole arrival (api.open with a spot, lifted by share.js)
	let arrival = null, building = false, buildPromise = null;
	function arriving(k) { if (arrival) window.L99Loading.stage(k < .3 ? 'Lighting the world' : k < .67 ? 'Finding your place' : k < .95 ? 'Preparing the surroundings' : 'Settling your arrival'); }
	function arrived() {
		if (!arrival) return;
		arrival = null;
		window.L99Loading.stage('Your place is ready');
	}
	function build(params) {
		if (recovery.blocked()) return Promise.reject(graphicsReloadError());
		if (buildPromise) return buildPromise;
		building = true;
		buildPromise = recovery.wait().then(() => buildWorld(params)).catch(error => { teardown(); throw error; }).finally(() => { building = false; buildPromise = null; });
		return buildPromise;
	}
	const yieldBuild = async (label) => {
		window.L99Loading.stage(label);
		await new Promise((resolve) => setTimeout(resolve, 0));
		await recovery.wait();
	};
	function seaLifeVisibility(W, dt, time, under) {
		const bay = W.island.village.bay;
		const inBay = !!bay && Math.hypot(camera.position.x - bay.x, camera.position.z - bay.z) < bay.r * 1.6 && camera.position.y < (qualityNow().far >= 1 || under ? 40 : 6);
		W.sealife.update(dt, time, inBay); W.reef.update(inBay, camera.position, under); W.fish.update(dt, time, inBay); W.inverts.update(dt, time, inBay);
	}
	function buildWorld(params) { return islandBuild(iw, params); }

	function teardown() { return islandTeardown(iw); }

	function placeKinetic(kind) {
		const W = world, P = W?.player.state;
		if (!W || W.orbit?.active() || P.locked || drive.active() || arcade.active() || studio.active()) return false;
		if (P.pos.y - Math.max(0, W.island.heightAt(P.pos.x, P.pos.z)) > 20) { hint('Come down near clear ground to place an instrument.', 3500); return false; }
		const spot = findKineticSpot({ player: P, kind, ground: (x, z) => W.island.heightAt(x, z),
			wet: (x, z) => !!W.island.inWater?.(x, z) || W.lake?.waterAt?.(x, z) != null,
			blocked: (x, z) => {
				if (W.vegetation.obstacles(x, z, 1).length || W.globe?.regional?.settlements.blocked(x, z, 1)) return true;
				if (W.village.footprints.some(f => Math.hypot(x - f.x, z - f.z) < Math.max(f.w || 0, f.d || 0) * .75 + 1)) return true;
				return (W.real?.near?.('boxes', x, z, 20) || []).some(b => Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) * .75 + 1);
			},
		});
		if (!spot) { hint('Find a flatter, open patch for the instrument.', 3500); return false; }
		window.initAudio?.();
		const ok = W.kinetic.spawn({ ...spot, bpm: W.music.performance.bpm });
		if (ok) { W.kineticEpoch = W.globe?.frame?.epoch; hint('Instrument placed nearby. It plays your current faceplate; Stop and Replay are in Sky & World.', 5000); }
		return ok;
	}
	function replayKinetic() { if (!world || world.orbit?.active()) return; window.initAudio?.(); world.kinetic.replay(); }
	HOOKS.kinetic = { place: placeKinetic, state: () => world?.kinetic?.state(), replay: replayKinetic, stop: () => world?.kinetic?.silence(), clear: () => world?.kinetic?.clear(), configure: (v) => world?.kinetic?.configure(v) };
	function buildPanel() { return islandPanel(iw); }

	// the tier the governor (or the setting) has chosen, applied: resolution, shadows (their map's
	// size and how often they are drawn), the clouds in the water, the sunbeams and spray. The crowd,
	// the cars' detail and the view's reach read the tier themselves (qualityNow).
	function applyQuality() {
		governor.apply();
		const Q = qualityNow();
		renderer.shadowMap.enabled = !SAFE && Q.shadows;
		fitShadow();
		// (the clouds in the water: the plain sky there on low)
		shared.cloudReflect = Q.reflect;
		if (!Q.reflect) { seaMirror.reset(); seaDepth.reset(); }
		syncSignageMaterials(scene);
		world?.rays?.quality(Q.fx);
		world?.spray?.quality(Q.fx);
		resize();
	}

	// the sun's shadow map at the tier's size (sky.js makes it at the device's full size)
	function fitShadow() {
		const sun = world?.sky?.sun, size = (GFX ? 1024 : 2048) * qualityNow().shadowSize;
		if (sun?.shadow && !renderer.shadowMap.enabled) { sun.shadow.dispose(); sun.shadow.map = sun.shadow.mapPass = null; return; }
		if (sun?.shadow && sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); sun.shadow.map?.dispose(); sun.shadow.map = null; }
	}

	function resize() {
		if (lost || recovery.blocked()) return;
		const w = dom.mount.clientWidth || innerWidth, h = dom.mount.clientHeight || innerHeight;
		// (the resolution holds whatever the tier: the governor's relief is shadows, crowds and reach,
		// never a blocky picture)
		pixelRatio = renderRatio({ width: w, height: h, dpr: window.devicePixelRatio, phone: GFX, safe: SAFE || graphics.lighter, mode: quality });
		renderer.setDrawingBufferSize(w, h, pixelRatio);
		camera.aspect = w / Math.max(1, h);
		camera.updateProjectionMatrix();
	}
	addEventListener('resize', () => { if (visible) resize(); });

	// looking into a low sun the eye (and a windscreen) floods with warm light: a glare
	// over everything round where the sun is, unless the land stands between
	const glare = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen;');
	dom.mount.insertBefore(glare, dom.veil);
	let glareK = 0;
	const gv = new THREE.Vector3(), gf = new THREE.Vector3();
	function sunGlare(dt) {
		const W = world, sd = shared.uSunDir.value;
		let want = 0, sx = 50, sy = 50;
		if (W && sd.y > -0.02 && sd.y < 0.45 && !W.houses?.inside(camera.position) && camera.position.y > -0.5) {
			camera.getWorldDirection(gf);
			const facing = gf.dot(sd);
			if (facing > 0.35) {
				gv.copy(camera.position).addScaledVector(sd, 1000).project(camera);
				sx = (gv.x * 0.5 + 0.5) * 100; sy = (-gv.y * 0.5 + 0.5) * 100;
				// hills or mountains in the way?
				let seen = 1;
				for (const t of [80, 200, 500, 1200, 3000, 7000]) { const x = camera.position.x + sd.x * t, z = camera.position.z + sd.z * t; if (W.island.heightAt(x, z) > camera.position.y + sd.y * t + 3) { seen = 0; break; } }
				want = seen * THREE.MathUtils.smoothstep(facing, 0.35, 0.95) * (1 - THREE.MathUtils.smoothstep(sd.y, 0.12, 0.45)) * (1 - (W.weather?.state?.cover ?? 0) * 0.5);
			}
		}
		glareK += (want - glareK) * Math.min(1, dt * 3);
		if (glareK < 0.01) { if (glare.style.opacity !== '0') glare.style.opacity = '0'; return; }
		glare.style.opacity = glareK.toFixed(3);
		// the bloom round the sun, a wide warm wash, and a ghost or two across the frame
		const gx = 100 - sx, gy = 100 - sy;
		glare.style.background = `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,236,190,.85) 0, rgba(255,200,110,.45) 6%, rgba(255,170,70,.18) 22%, rgba(255,150,60,0) 55%), radial-gradient(circle at ${(sx + gx) / 2}% ${(sy + gy) / 2}%, rgba(255,210,140,.10) 0, rgba(255,210,140,0) 4%), radial-gradient(circle at ${gx}% ${gy}%, rgba(170,255,210,.10) 0, rgba(170,255,210,.05) 2.5%, rgba(170,255,210,0) 5%)`;
	}
	function updateFlightControls(W) {
		const P = W?.player?.state;
		if (!P) return;
		const B = W.boat;
		// (flying, it is the plane: held it climbs, a double tap lands)
		const j = B?.boarded?.() ? '' : P.flying ? '✈' : P.swimming ? (P.diving ? '⇡' : '⤓') : '⤒';
		if (dom.jump.textContent !== j) {
			dom.jump.textContent = j; dom.jump.style.display = j ? 'block' : 'none';
			const t = P.flying ? 'Fly up (hold); double-tap to land' : P.diving ? 'Swim up' : P.swimming ? 'Dive' : 'Jump';
			dom.jump.title = t; dom.jump.setAttribute('aria-label', t);
		}
		// (on foot on a touch screen the same button crouches: a tap down or up, a slide from a sprint)
		const crouchUI = !P.flying && !P.swimming && !B?.boarded?.() && TOUCH_UI;
		const dd = P.flying || crouchUI ? 'block' : 'none'; if (dom.down.style.display !== dd) dom.down.style.display = dd;
		const dl = P.flying ? '⇣' : '⇩'; if (dom.down.textContent !== dl) { dom.down.textContent = dl; const t = P.flying ? 'Descend' : 'Crouch (C); from a sprint, slide'; dom.down.title = t; dom.down.setAttribute('aria-label', t); }
		const db = !P.flying && P.crouch ? '#01a982' : 'rgba(8,20,26,.55)'; if (dom.down.style.background !== db) dom.down.style.background = db;
		const fb = P.flying ? '#01a982' : 'rgba(8,20,26,.55)'; if (dom.fly.style.background !== fb) dom.fly.style.background = fb;
		if (!P.flying && !W.orbit?.active?.()) P.boost = 1;
		const speed = flightMultiplier(P.boost), speedTitle = `Flight speed ${speed}×; next ${nextFlightSpeed(speed, !!P.orbit?.deep?.())}× (B)`;
		if (dom.boost.textContent !== speedLabel(speed)) dom.boost.textContent = speedLabel(speed);
		if (dom.boost.title !== speedTitle) { dom.boost.title = speedTitle; dom.boost.setAttribute('aria-label', speedTitle); }
		const bd = P.flying ? '' : 'none', bb = speed > 1 ? '#01a982' : 'rgba(8,20,26,.55)';
		if (dom.boost.style.display !== bd) dom.boost.style.display = bd; if (dom.boost.style.background !== bb) dom.boost.style.background = bb;
		const L = W.orbit && !drive.active() && !arcade.active() ? 'flex' : 'none'; if (dom.launch.style.display !== L) dom.launch.style.display = L;
		dom.launch.style.background = P.climbAssist ? '#01a982' : 'rgba(8,20,26,.55)';
		const title = P.climbAssist ? 'Stop automatic climb' : 'Climb to space (steer to take control)';
		if (dom.launch.title !== title) { dom.launch.title = title; dom.launch.setAttribute('aria-label', title); }
	}
	// one part of the world failing must not stop the rest: the frame goes on, and each
	// distinct error is reported once
	const seenErr = new Set();
	// each distinct failure of the frame, kept on this device (a phone shows no console): the
	// last eight with where they were thrown, for Crysis.frameErrors() on a later visit
	function keepFrameError(key, err) {
		try {
			const list = JSON.parse(localStorage.getItem('l99-frame-errors') || '[]');
			list.push({ at: new Date().toISOString(), msg: key.slice(0, 200), where: String(err?.stack || '').split('\n').slice(0, 3).join(' | ').slice(0, 300), world: shared.planet?.type || null });
			localStorage.setItem('l99-frame-errors', JSON.stringify(list.slice(-8)));
		} catch { /* private mode */ }
	}
	function frame(now) {
		if (!running) return;
		requestAnimationFrame(frame);
		try { tick(now); } catch (err) {
			if (lost || recovery.blocked()) return;
			const key = String(err?.message || err);
			if (!seenErr.has(key)) { seenErr.add(key); console.error('[frame]', err); keepFrameError(key, err); }
			// The player has already moved this frame, and the steps after the failing one never
			// ran: among them the one that keeps the ground under the camera. Left behind, the
			// ground is drawn by the far rings of a grid centred where the failure began (hundreds
			// of metres off, and nothing at all past 2.2 km) while you walk on the right height.
			// So the ground follows here too, whatever else failed.
			try { if (world && !building && visible) followGround(world, Math.min(0.05, Math.max(0.001, (now - groundT) / 1000)), surfaceOpen(world)); } catch (e2) { const k2 = 'ground: ' + String(e2?.message || e2); if (!seenErr.has(k2)) { seenErr.add(k2); console.error('[frame]', e2); } }
			// (and the Bay's and the globe's ground, which follow the camera the same way: left
			// behind, you walk off their fine rings onto the coarse ones, metres to hundreds of
			// metres below the land you stand on, the owner's see-through floor off the island)
			if (world && !building && visible && farT !== now) { try { followFarGround(world, Math.min(0.05, Math.max(0.001, (now - groundT) / 1000)), farNight); } catch (e3) { const k3 = 'far ground: ' + String(e3?.message || e3); if (!seenErr.has(k3)) { seenErr.add(k3); console.error('[frame]', e3); keepFrameError(k3, e3); } } }
			try { renderer.render(scene, camera); } catch { /* nothing more to do this frame */ }
		}
	}
	// Whether the surface is shown (not from down in the caves or the Deep), and the camera-centred
	// ground kept under the camera: the terrain, sea, grass and turf, their reach, and the floor
	// guard's look (world/floorguard.js). Called from the frame's own place and, should any step
	// of the frame throw, from frame()'s catch, so a failure elsewhere never leaves the ground behind.
	let groundT = 0;
	// Earth's ground past the island (the Bay's survey, bay/terrain.js, and the globe's past it,
	// earth/globe.js): camera-centred rings like the island's, kept under the camera straight
	// after it, before the forty systems that could fail between, and from frame()'s catch
	let farT = -1, farNight = 0;
	function followFarGround(W, dt, night) {
		farT = last; farNight = night;
		W.bayArea?.update(camera, night);
		// orbital departure retains the ground frame; a new place chosen on the way down streams its own
		if (!W.orbit?.active() || W.orbit.streams?.()) W.globe?.update(dt, camera, night);
	}
	function surfaceOpen(W) {
		const caveK = W.underworld?.inside?.() || 0;
		// Keep the surface visible through mouths and skylights, even from deep shade.
		const vista = W.underworld?.plan?.holes.some(h => Math.hypot(camera.position.x - h.x, camera.position.z - h.z) < h.r + 80);
		// (an eye above the land and in no cave sees the surface, whatever the caves' own
		// reckoning says: that eases out over a moment, and stands still if their step failed)
		const cam = camera.position, I = W.island;
		const above = cam.y > I.heightAt(cam.x, cam.z) + 0.5 && I.underFloor?.(cam.x, cam.z, cam.y - 1.68) == null;
		const open = above || ((caveK < 0.9 || !!vista) && !W.deep?.active());
		if (W.underworld) for (const o of [W.ocean, W.vegetation.group, W.distant?.group, W.alien?.group, W.plumes?.mesh, W.powerlines?.group, W.contrails?.mesh, W.farForest?.group]) { const v = open && (o !== W.ocean || seaLook.on); if (o && o.visible !== v) o.visible = v; }
		return open;
	}
	function followGround(W, dt, open) {
		groundT = performance.now();
		for (const o of [W.terrain, W.ocean, W.grass, W.turf]) o.userData.update(camera);
		seaView(W, camera, dt, open);
		W.litter.update(camera);
		updateIslandReach(W, camera, open);
		floorGuard.check(dt, { open });
	}
	// (what the card really drew: the ground alone, drawn from above the player now and then and
	// read back; undefined where the float read-back is not to be had, and the guard stops asking)
	let floorProbe = null;
	const drawnGround = (x, z, keep = null) => {
		if (!renderer.extensions.has('EXT_color_buffer_float')) return undefined;
		floorProbe ||= createGroundProbe(renderer);
		const T = world?.terrain;
		return floorProbe.probe(scene, x, z, { top: camera.position.y + 3000, span: 9000, keep: keep || ((o) => o === T) });
	};
	// (off the island on Earth: the Bay's ground and the globe's, put back under the camera)
	const wideGround = {
		keep: (o) => o === world?.bayArea?.group || o === world?.globe?.terrain?.group,
		follow: () => { const W = world; if (!W) return null; followFarGround(W, 0.016, farNight); return 'the Bay and globe ground re-centred'; },
	};
	const floorGuard = HOOKS.floorGuard = createFloorGuard({ world: () => world, camera, renderer, probe: drawnGround, wide: wideGround, gpuEvery: GFX ? 6 : 12 });
	function tick(now) { return islandFrame(iw, now); }

	// the context button: board or leave the boat; the jump button dives in the sea
	let actState = '';
	function actions() {
		const W = world, B = W.boat;
		dom.still(drive.active() || arcade.active() || studio.active() || !!W.boardwalk?.riding?.());
		const want = B.boarded() ? 'leave' : B.near() ? 'board' : '';
		if (want !== actState) {
			actState = want;
			dom.act.style.display = want ? 'block' : 'none';
			dom.act.textContent = want === 'board' ? '⛵ Board' : '⛵ Leave boat';
			dom.act.title = want === 'board' ? 'Take the boat out' : 'Step off the boat';
			dom.act.setAttribute('aria-label', dom.act.title);
			if (want === 'board' && (!isPhone || firstTime('l99-tip-boat'))) hint(isPhone ? 'Board the boat: left thumb is the throttle and rudder.' : 'Board the boat: W/S throttle, A/D steer.', 3000);
		}
	}
	let origin = null;   // the planet flight landed us from, if any
	let launchedAt = null;   // globe: where on Earth you launched from, when far from the Bay
	// Earth, where it sits in the Sol system: flight puts the ship in orbit round it
	const EARTH_ORIGIN = { id: 'earth', seed: 1337, type: 'TERRAN', name: 'Earth', earth: true, colorA: [0.2, 0.45, 0.85], colorB: [0.25, 0.65, 0.4] };

	function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
	function show() {
		visible = true;
		// the music is worked out further ahead while the world draws (its frames can hold the
		// page up longer than the faceplate's): index.html's L99Clock reads this
		window._worldAudioLead = isPhone ? 0.2 : 0.15;
		if (world) world.player.state.active = true;
		governor.live(true);
		dom.mount.style.display = 'block';
		resize();
		start();
		window.L99Keyboard149?.sync?.();
	}
	function hide() {
		visible = false;
		communityProjects.reset();
		governor.live(false);
		window._worldAudioLead = undefined;
		world?.orbit?.pause?.();
		picnic.pause();
		social.update(0, time, false); social.flush();
		world?.labels?.hide();
		world?.globe?.regional?.pause();
		world?.kinetic?.silence();
		if (world) world.player.state.active = false;
		worldAir(0);
		if (muffle.lp) { muffle.k = 0; muffle.lp.frequency.value = 20000; muffle.lp.Q.value = 0.9; }
		dom.mount.style.display = 'none';
		world?.player.clearInput();
		window.L99TouchMusic175?.cancel?.();
		window.L99Keyboard149?.sync?.();
	}

	// a page put away or closed says goodbye; one that goes while a world is on screen did not
	// (the governor's crash mark: world/governor.js)
	document.addEventListener('visibilitychange', () => governor.live(visible && !document.hidden));
	addEventListener('pagehide', () => governor.live(false));
	dom.back.onclick = (e) => { e.stopPropagation(); api.close(); };
	function toggleFly() {
		const P = world?.player.state;
		if (!P || world.boat.boarded()) return;
		if (!P.orbit?.high()) { P.flying = !P.flying; P.vel.y = 0; }
		P.climbAssist = P.descendAssist = false;
		hint(P.flying ? (isPhone ? 'Flying: steer with the left thumb, look with the right. Hold ✈ to climb, ⇣ to sink; double-tap ✈ to land.' : 'Flying: WASD moves where you look, Space climbs, C sinks, Shift is fast, B cycles ×1 / ×3 / ×6 / ×9. F or a double tap of Space to land.') : 'Landing.', 3500);
	}
	dom.fly.addEventListener('click', (e) => { e.stopPropagation(); toggleFly(); });
	dom.boost.addEventListener('click', (e) => { e.stopPropagation(); const P = world?.player.state; if (P?.flying) world.player.cycleBoost(); });
	dom.shell.addEventListener('click', (e) => { e.stopPropagation(); world?.shells.pick(); });
	dom.toss.addEventListener('click', (e) => { e.stopPropagation(); world?.shells.throwIt(); });
	dom.place.addEventListener('click', (e) => { e.stopPropagation(); world?.shells.putDown(); });
	const hold = (el, key) => {
		el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (world?.player.state.flying) { world.player.state.climbAssist = world.player.state.descendAssist = false; world.player.state[key] = true; } });
		for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { if (world) world.player.state[key] = false; });
	};
	hold(dom.jump, 'flyUp'); hold(dom.down, 'flyDown');
	dom.down.addEventListener('pointerdown', (e) => { e.stopPropagation(); const P = world?.player.state; if (P && !P.flying && !P.swimming) world.player.crouch(); });
	// a quick double tap of jump takes to the air (still held, it climbs on), and on the plane
	// it shows while flying, lands
	let jumpAt = 0;
	dom.jump.addEventListener('pointerdown', (e) => {
		e.stopPropagation();
		const P = world?.player.state, now = performance.now();
		if (P && !P.swimming && now - jumpAt < 300) { jumpAt = 0; toggleFly(); P.flyUp = P.flying; return; }
		jumpAt = now;
		if (P?.flying) return;
		if (P?.diving) { P.vel.y = 2.4; P.diving = P.pos.y < (P.surface ?? 0) - 0.4; return; }
		world?.player.jump();
	});
	dom.act.addEventListener('click', (e) => {
		e.stopPropagation();
		const B = world?.boat;
		if (!B) return;
		if (B.boarded()) B.leave(); else if (B.near()) B.board();
	});
	// back to the ship: the island hands the view to space flight above the same planet
	dom.launch.addEventListener('click', (e) => {
		e.stopPropagation();
		if (!world || drive.active() || arcade.active() || studio.active()) return;
		if (world.boat.boarded()) world.boat.leave();
		const P = world.player.state;
		P.flying = true; P.diving = false; P.climbAssist = !P.climbAssist; P.descendAssist = false;
		hint(P.climbAssist ? 'Climbing to space. Steer, look, or press ⇣ / C to take control.' : 'Climb stopped. You have control.', 4000);
	});
	// The original galaxy remains reachable until its complete feature set is migrated.
	async function legacyLaunch() {
		const J = window.L99Journey170;
		if (!origin || !J || J.busy()) return;
		if (world?.boat.boarded()) world.boat.leave();
		dom.launch.disabled = true;
		// the ship and this world never both fill the phone's memory: keep your place, let the
		// world go behind the veil, then fly (landing builds it again; a failed launch rebuilds here)
		const departure = world.orbit?.info().anchor;
		const yaw = departure?.yaw ?? world.player.state.yaw;
		// globe: launching far from the Bay, the ship brings you back down there
		{ const ll = departure || globeLL(camera.position.x, camera.position.z); launchedAt = world.globe && bayKm(ll.lat, ll.lon) > BAY_WILD_KM ? { lat: ll.lat, lon: ll.lon } : null; }
		if (!departure) share.keep(true);
		travelVeil.textContent = 'Launching…';
		travelVeil.style.opacity = '1';
		await new Promise((r) => setTimeout(r, 260));
		teardown();
		try {
			const ok = await J.request(REALM, 'flight', { kind: 'atmosphere', planet: origin, altitude: 420, piloting: true, yaw, pitch: 0.25, velocity: [0, 0, 0], fov: 72 });
			if (!ok) throw new Error('the ship is not ready');
		} catch (err) {
			// no launch: back to exactly where you were
			console.warn('[launch]', err);
			hint('The ship is not ready yet. Try again in a moment.');
			const c = share.resumeCode();
			await (c ? share.openAt(c, { resume: true }) : api.open(origin?.earth ? { seed: 1337, earth: true } : { seed: origin.seed, biome: origin.type, earth: false, origin }));
		} finally { dom.launch.disabled = false; travelVeil.style.opacity = '0'; }
	}
	dom.gear.onclick = (e) => { e.stopPropagation(); dom.panel.style.display = dom.panel.style.display === 'block' ? 'none' : 'block'; };
	for (const el of [dom.back, dom.jump, dom.gear, dom.panel, dom.act, dom.launch, dom.fly, dom.boost, dom.down, dom.shell, dom.toss, dom.place]) for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation());

	// A warp or a touchdown to another world: the same world build a flight landing uses.
	// With dest.orbit the ship drops out that high above the new world's island.
	async function voyage(dest) {
		const params = dest.earth ? { seed: 1337, earth: true } : { seed: dest.seed, biome: dest.type, earth: false, origin: { seed: dest.seed, type: dest.type, id: `warp-${dest.type.toLowerCase()}`, earth: false } };
		await api.open(params);
		const P = world?.player.state;
		if (!P || !visible || !sameBody(state.body, worldBody(params))) return false;
		if (dest.colony && world.colony?.port) { world.colony.go(); return true; }
		if (dest.beyond) { if (!world.beyond) return false; world.beyond.enter(true); return true; }
		if (dest.orbit) {
			P.flying = true; P.vel.set(0, 0, 0); P.pos.y = dest.orbit; P.pitch = -1.1; P.boost = 1;
			camera.position.copy(P.pos);
			hint(`${dest.name} below. Descend (C) to land, or warp on.`, 5000);
		} else hint(world.island.gravity < 1 ? `${dest.name}: low gravity. Jump and see.` : `Landed on ${dest.name}.`, 5000);
		return true;
	}
	const worldOf = (planet) => ({ ...planet, seed: (planet.seed >>> 0) || hashString(String(planet.id || 'island')), biome: planet.type || 'tropical', earth: planet.earth === true });
	const api = {
		T: THREE, REALM,
		open(params = {}) {
			const enter = () => api.enter(params);
			return !visible || !world ? window.L99Loading.run(enter, { exit: () => api.close() }) : enter();
		},
		async enter(params = {}) {
			if (recovery.blocked()) throw graphicsReloadError();
			// on Earth the ship waits in orbit: ⇪ always has somewhere to go
			origin = params.origin || (params.earth !== false ? EARTH_ORIGIN : null);
			// a kept or shared spot: one loading card, with its name, until share.js has you there
			if (params.spot) {
				arrival = { label: params.spot.label || 'Arriving…', blind: true };
				window.L99Loading.stage(arrival.label);
			}
			// (the sky starts at the spot's hour)
			const hours = params.spot?.hours;
			shared.startHours = Number.isFinite(hours) ? hours : 10.5;
			show();
			await build(params);
			await recovery.wait();
			if (Number.isFinite(hours) && world?.sky) world.sky.state.hours = hours;
			if (params.earth !== false && params.at) HOOKS.goTo(params.at.lat, params.at.lon);      // globe: straight to a place
			api.link();
			if (!arrival) {
				world.player.update(0, time);
				renderer.render(scene, camera);
				if (renderer.getContext().isContextLost()) throw new Error('Graphics were interrupted while preparing the world.');
			}
			if (ULTRA_DROPPED) hint('Ultra graphics are off: the page closed while drawing them last time. High is on now; Ultra is still in the settings.', 7000);
			else if (!isPhone || firstTime('l99-tip-move')) hint(isPhone ? 'Left thumb moves. Drag the view or hold and drag Fire to aim. Tap Aim for sights. ✈ to fly.' : 'Click the world to capture the mouse. Move mouse to aim, left-click to fire, hold right-click for sights. Esc releases the cursor. WASD moves; R reloads.');
			return true;
		},
		close() {
			HOOKS.combat?.reset();
			HOOKS.gear?.suspend();
			families.clear();
			hide();
			window.L99IslandDoor?.closed?.();
		},
		active: () => visible && running,
		// walking or riding a road hands-free: the keyboard plays music meanwhile
		autoWalk: () => visible && running && !!drive.auto?.(),
		world: () => world,
		// open straight at a shared spot (?at=... from index.html); a bad link opens as usual
		openAt: (code) => window.L99Loading.run(() => share.openAt(code), { exit: () => api.close() }),
		// ?room=CODE: join a friend's room and go to them (net/multiplayer.js)
		joinRoom: (code) => multiplayer.join(code),
		// back to the last place you were (after a crash or a reload); false if there is none
		resume: () => { const c = share.resumeCode(); return c ? window.L99Loading.run(() => share.openAt(c, { resume: true }), { exit: () => api.close() }) : false; },
		// flight's landing builds the world here first, out of sight, so Journey's own clock
		// only covers the hand-over (a slow phone building the Bay Area outran it, and the
		// failed passage left you on the old flight surface)
		warm: async (planet = {}) => { await build(worldOf(planet)); return true; },
		guide, people,
		async exploreCaves() {
			if (!world) await api.open({ seed: 1337, earth: true });
			else show();
			guide.showCaves();
			return true;
		},
		renderer: () => renderer, camera: () => camera, scene: () => scene, dom, shared,
	};

	// Journey: space flight can land here; the island is one of the resident engines.
	// Linked once the faceplate's world core (Journey, play surfaces) is present.
	let linked = false;
	api.link = () => {
		if (world) world.music.register();
		if (linked || !window.L99Journey170) return;
		linked = true;
		window.L99Journey170.register(REALM, {
		T: THREE,
		renderer: () => renderer,
		element: () => dom.mount,
		active: () => visible,
		boot: async () => { start(); },
		prepare: async (packet, check) => {
			const planet = packet.planet || {};
			origin = planet.origin || null;
			if (planet.earth) origin = EARTH_ORIGIN;
			await build(worldOf(planet));
			// globe: a landing that names a place on Earth comes down there; one back from a launch far
			// off comes down where it left
			if (planet.earth) { const at = planet.at || launchedAt; launchedAt = null; if (at && Number.isFinite(at.lat)) HOOKS.goTo(at.lat, at.lon, 900); }
			check?.();
			for (let i = 0; i < 6; i++) { world.player.update(0.016, time); world.sky.update(0.016, camera.position); world.vegetation.stream(camera, true); renderer.render(scene, camera); await new Promise((r) => requestAnimationFrame(r)); check?.(); }
		},
		align: async (packet) => { world.player.state.pitch = Math.max(-0.4, Math.min(0.3, packet.pitch || 0)); world.player.update(0, time); },
		pose: () => ({ yaw: world?.player.state.yaw || 0, pitch: world?.player.state.pitch || 0, velocity: [0, 0, 0], fov: camera.fov }),
		render: () => renderer.render(scene, camera),
		resize,
		activate: () => show(),
		park: () => hide(),
		arrived: () => hint(state.earth ? 'Earth. An island off the Golden Gate: fly or sail east to reach San Francisco.' + (origin ? ' ⇪ returns you to your ship.' : '') : (() => { const P = shared.planet, what = P && P.type !== 'TROPICAL' ? `You come down on a ${P.name}. Its caves go deep: look for the dark mouths in the hills.` : 'You come down on a tropical shore.'; return what + (origin ? ' ⇪ returns you to your ship.' : ''); })(), 6000),
	});
	};
	api.link();
	return api;
}

// Wind that behaves like wind: gusts come at random, each with its own strength, rise,
// hold and fall; between them the air eddies on a few slow incommensurate beats. The
// Wind slider sets how often gusts come and how hard: at nothing the grass barely
// stirs and gusts are rare; turned up, they come harder and more often. The field's
// clock (uWindT) runs at the wind's speed, so a lull slows everything, a gust hurries
// it, and the direction veers slowly.
const wind = { gusts: [], next: 3, veer: 0.36, t: 0 };
function stepWind(dt, shared) {
	dt = Math.min(dt, 0.1);
	const W = shared.uWind.value;
	wind.t += dt;
	wind.next -= dt;
	if (wind.next <= 0) {
		// mean wait between gusts: ~25 s when calm, ~2.5 s at full wind
		const rate = 0.02 + Math.pow(Math.min(1.5, W), 1.4) * 0.35;
		wind.next = -Math.log(1 - Math.random()) / rate;
		const k = Math.random();
		wind.gusts.push({ age: 0, peak: (0.25 + k * k * 0.75) * (0.15 + W * 0.9), rise: 0.6 + Math.random() * 1.6, hold: 0.5 + Math.random() * 3.5, fall: 1.5 + Math.random() * 4 });
	}
	let g = 0;
	for (let i = wind.gusts.length - 1; i >= 0; i--) {
		const q = wind.gusts[i];
		q.age += dt;
		const a = q.age;
		const env = a < q.rise ? Math.sin(a / q.rise * Math.PI / 2) : a < q.rise + q.hold ? 1 - 0.15 * Math.sin((a - q.rise) * 3.1) : Math.max(0, 1 - (a - q.rise - q.hold) / q.fall);
		if (a > q.rise + q.hold + q.fall) { wind.gusts.splice(i, 1); continue; }
		g = Math.max(g, q.peak * env);
	}
	// eddies between gusts, a little livelier as the wind rises
	const t = wind.t, eddy = (Math.sin(t * 0.31) * Math.sin(t * 0.137 + 1.7) + Math.sin(t * 0.53 + 0.4) * 0.5) * 0.5 + 0.5;
	g += eddy * W * 0.12;
	shared.uGust.value += (g - shared.uGust.value) * Math.min(1, dt * 3);
	// the field moves at the wind's own speed
	shared.uWindT.value += dt * (0.15 + W * 0.7 + shared.uGust.value * 1.2);
	wind.veer += (Math.sin(t * 0.021) * 0.25 + Math.sin(t * 0.0057 + 2) * 0.3 - (wind.veer - 0.36)) * dt * 0.02;
	shared.uWindDir.value.set(Math.cos(wind.veer), Math.sin(wind.veer));
}

// the sea is only drawn where some of it is within reach: far inland (the Diablo foothills,
// the Sierra) a look round every couple of seconds, out to 40 km on sixteen bearings, finds
// none, and the ocean under the whole map stops being drawn (its waves, its shading)
const seaLook = { t: 0, on: true };
function seaView(W, camera, dt, open) {
	if (!W.bayArea?.loaded() || !open) return;
	seaLook.t -= dt;
	if (seaLook.t > 0) return;
	seaLook.t = 2;
	const x = camera.position.x, z = camera.position.z;
	let sea = W.island.heightAt(x, z) < 2;
	for (let k = 0; k < 16 && !sea; k++) {
		const a = k / 16 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
		for (const r of [300, 800, 1600, 3000, 5500, 9000, 14000, 20000, 28000, 40000]) if (W.island.heightAt(x + c * r, z + sn * r) < -1.5) { sea = true; break; }
	}
	seaLook.on = sea;
	if (W.ocean.visible !== sea) W.ocean.visible = sea;
}

const groundProbe = { at: null };
function hashString(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// one world per page
export function island() {
	if (!window.L99Island) window.L99Island = createIslandWorld();
	return window.L99Island;
}
if (typeof window !== 'undefined') {
	window.L99IslandModule = { island };
	// Crysis: the engine's name. L99Island stays the faceplate contract; this is the
	// handle for the generated world (Crysis.ecology() prints this place's food web)
	window.Crysis = {
		version: 1,
		world: () => window.L99Island?.world?.(),
		performance: () => window.L99Island?.world?.()?.music?.performance,
		get kinetic() { return HOOKS.kinetic; },
		body: () => window.L99Island?.world?.()?.body,
		orbit: () => window.L99Island?.world?.()?.orbit?.info(),
		// Crysis.orbitOver(lat, lon, km) puts the ship in orbit above a place (once in orbit); .landing() what is below
		orbitOver: (lat, lon, km = 400) => window.L99Island?.world?.()?.orbit?.over?.(lat, lon, km * 1000) ?? 'Climb to orbit first.',
		landing: () => window.L99Island?.world?.()?.orbit?.landing?.() ?? 'no orbit',
		orbitImagery: () => window.L99Island?.world?.()?.orbit?.imagery?.() ?? 'no orbit',
		// the cities round you (the map pin's list): Crysis.cities() their ids, .go(i) to the i-th
		cities: Object.assign(() => HOOKS.cities?.list() ?? [], { go: (i) => HOOKS.cities?.go(i) }),
		// game-only hunting, home-defense and supply state. Crysis.arms() reads the
		// current inventory/nearby sources; pass a natural request to execute it.
		arms: (request) => request == null ? HOOKS.arms?.info(window.L99Island?.world?.()?.player?.state?.pos) : HOOKS.arms?.command(request, { position: window.L99Island?.world?.()?.player?.state?.pos }),
		gear: () => HOOKS.gear?.info(),
		// the frame readout in the corner (?perf in the address): Crysis.perf(true|false); and the
		// loading screen's black box, the loads that went without a goodbye: Crysis.loadTrail()
		perf: (on) => (on == null ? HOOKS.perf?.on() : HOOKS.perf?.show(on)),
		loadTrail: () => window.L99Loading?.trail?.(),
		// what you hold, in view: Crysis.viewmodel({ hold: ['aurora-trail-rifle', 7, 4], aim: true })
		viewmodel: (o) => HOOKS.gear?.viewmodel(o),
		// the held item in use: fire(), reload(done), aim(on), equip(id), holster(), muzzle(), data(), state()
		get weapon() { return HOOKS.gear?.weapon; },
		// your home on Earth: stored only in this browser, never published
		guide: () => window.L99Island?.guide,
		people: () => window.L99Island?.people,
		social: () => HOOKS.social,
		// what passers-by last said and when the next may speak: Crysis.chatter()
		chatter: () => HOOKS.chatter?.info(),
		// favours in passing: Crysis.errands() what is under way; .accept() / .cancel(); .pet() a lost dog now
		// fares while you drive: Crysis.fares() the current one and your totals; .hail() someone ahead hails now
		// today's goals: Crysis.daily()
		daily: () => HOOKS.daily?.list(),
		// the businesses (economy/): Crysis.economy() counts them and the share of the buildings round
		// you that are one; .near(x, z, r) each one's name, kind and door (round you with no x, z);
		// .find('pasta') the nearest of a kind or a name; .requests(r) what the businesses round you ask
		// (.take(id), .complete(id, outcome) as the player); .payroll() wages, top earners, balances
		economy: Object.assign((r = 600) => { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos; if (!p || !W.city?.economyInfo) return 'no city here'; const L = payroll.ledger(3); return { ...W.city.economyInfo(p.x, p.z, r), requests: requestsNear(p.x, p.z, 400).length, payroll: { paid: L.paid, wages: L.wages, employed: L.employed }, topEarners: L.topEarners, balances: L.best }; }, {
			requests: (r = 400) => { const p = window.L99Island?.world?.()?.player?.state?.pos; return p ? requestsNear(p.x, p.z, r) : []; },
			take: (id) => takeRequest(id, 'player'),
			complete: (id, outcome = 'done') => completeRequest(id, 'player', outcome),
			payroll: (n = 5) => payroll.ledger(n),
			near: (x, z, r = 300) => { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos; if (x == null && p) { x = p.x; z = p.z; } return W?.city?.economy?.near(x, z, r) || []; },
			find: (what) => { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos; const k = String(what || '').toLowerCase(); return (p && W?.city?.economy?.near(p.x, p.z, 3000).find((E) => E.type === k || E.name.toLowerCase().includes(k) || E.label.includes(k))) || null; },
		}),
		// the bank (economy/bank.js): Crysis.bank(id) an account ('player', 'hh:<household>', 'npc:<seed>',
		// or the nearest person with no id); .talk(id) what they might say about money; .daily(id, days);
		// .history(id); .sync() to the ledger Worker; .panel(id) a chart of it (with ?admin in the address)
		bank: Object.assign((id) => { if (id == null) { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos, q = p && W?.people?.pool?.filter((a) => a.active).sort((a, b) => a.M.S.pos.distanceTo(p) - b.M.S.pos.distanceTo(p))[0]; return q ? bank.account(q) : { ...bank.info(), player: bank.account('player') }; } return bank.account(id); }, {
			talk: (id) => bank.moneyTalk(id), daily: (id, n = 30) => bank.daily(id, n), history: (id) => bank.history(id), sync: () => bank.sync(), info: () => bank.info(),
			panel: (id = 'player') => {
				if (!/[?&]admin\b/.test(location.search)) return 'Add ?admin to the address first.';
				const d = bank.daily(id, 90), v = d.map((q) => q.balance), lo = Math.min(...v, 0), hi = Math.max(...v, 1), W = 560, H = 160;
				const pts = d.map((q, i) => `${(10 + i * (W - 20) / Math.max(1, d.length - 1)).toFixed(1)},${(H - 10 - (q.balance - lo) * (H - 20) / Math.max(1, hi - lo)).toFixed(1)}`).join(' ');
				let el = document.getElementById('bank-panel');
				if (!el) { el = document.createElement('div'); el.id = 'bank-panel'; el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;background:rgba(18,20,24,.92);color:#eee;padding:12px;border-radius:10px;font:13px system-ui;max-width:92vw'; document.body.appendChild(el); el.onclick = () => el.remove(); }
				const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
				el.innerHTML = `<b>${esc(bank.household(id))}</b> ${bank.balance(bank.household(id))} credits<br><svg width="${W}" height="${H}" style="max-width:100%"><polyline fill="none" stroke="#7fb4ff" stroke-width="2" points="${pts}"/></svg><br>` + bank.history(id).slice(0, 8).map((t) => `day ${t.day} ${esc(t.kind)} ${t.amount} ${esc(t.counterparty)}`).join('<br>');
				return 'shown (click it to close)';
			},
		}),
		fares: Object.assign(() => HOOKS.fares?.info(), { hail: () => HOOKS.fares?.hailNow(), mark: () => HOOKS.fares?.mark() }),
		errands: Object.assign(() => HOOKS.errands?.info(), { ask: () => HOOKS.errands?.askNearest(), pet: () => HOOKS.errands?.petNow(), snatch: () => HOOKS.errands?.snatch(), accept: () => HOOKS.errands?.accept(), cancel: () => HOOKS.errands?.cancel(), mark: () => HOOKS.errands?.mark() }),
		// the streets by era and season (bay/streets.js): Crysis.streets() the era here and the counts;
		// .holes() the potholes round you; .report() the nearest to its crew; .crew() a crew to it now; .month(12) as the Sky panel's month
		streets: Object.assign(() => window.L99Island?.world?.()?.streets?.info(), { month: (m) => { pickMonth(m); return monthPicked(); }, holes: (r) => { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos; return p && W.streets?.potholes.around(p.x, p.z, r); }, report: () => { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos, h = p && W.streets?.nearest(p.x, p.z, 200); return h ? (W.streets.report(h), h.id) : 'no pothole near'; }, crew: () => { const W = window.L99Island?.world?.(), p = W?.player?.state?.pos, h = p && W.streets?.potholes.nearest(p.x, p.z, 200); return h ? (W.streets.potholes.report(h), W.streets.crew.now(h), h) : 'no pothole near'; } }),
		// the scene itself, for checks that walk what is drawn (island/tools/zfight-browser.cjs)
		scene: () => HOOKS.scene,
		// families, schools and food: Crysis.families().info(), .stage('school-run'), .help('stock'), .quests()
		families: () => HOOKS.families,
		// the child in the woods (people/ghost.js): very rare; this calls her now
		ghost: (at) => HOOKS.ghost?.(at),
		ghostInfo: () => HOOKS.ghostInfo?.(),
		// Rare daytime picnic: actual held armaments as comic sky-shot percussion.
		picnic: () => HOOKS.picnic?.inspect(),
		picnicGo: (at) => HOOKS.picnic?.summon(at),
		// the mushrooms (planet/mushrooms.js): Crysis.trip('psilocybe'), or from a moment in
		// (seconds in): Crysis.trip('amanita', 90); Crysis.tripInfo() tells where it is
		trip: (kind, at) => window.L99Island?.world?.()?.shrooms?.eat(kind, at != null ? { at: +at } : undefined),
		tripInfo: () => window.L99Island?.world?.()?.shrooms?.state(),
		creatures: () => HOOKS.creatures?.(),
		// the buildings built inside round you (interiors/): Crysis.interiors() tells how they stand,
		// Crysis.interiorGo('row') takes you to the front door of one ('shop', 'apt', 'warehouse'...)
		interiors: () => window.L99Island?.world?.()?.interiors?.info() ?? 'none here',
		// the buildings (structures/): Crysis.structures() tells of the overlaps settled, the alleys,
		// the glass, the damage near and the rebuilds under way; .cataclysm(true) holds the crews off
		// while a citywide catastrophe lasts (false lets them back); .crack() / .shatter() the nearest
		// pane; .vault() over what is in front of you; .advance(h) moves the crews' clock on.
		// Crysis.demolish(x, z, k) brings the building nearest (x, z) down (k 1 all of it, 0.5 a part)
		signage: Object.assign(() => HOOKS.signage?.info() ?? 'none here', { headlights: (on) => HOOKS.signage?.headlights(on), refresh: () => HOOKS.signage?.refresh(), where: (k, n) => HOOKS.signage?.where(k, n) }),
		structures: Object.assign(() => HOOKS.structures?.info() ?? 'none here', {
			cataclysm: (on) => HOOKS.structures?.cataclysm(on), crack: (x, z) => { const p = window.L99Island?.world?.()?.player?.state?.pos; return HOOKS.structures?.crack(x ?? p?.x, z ?? p?.z); },
			shatter: (x, z) => { const p = window.L99Island?.world?.()?.player?.state?.pos; return HOOKS.structures?.shatter(x ?? p?.x, z ?? p?.z); },
			vault: () => HOOKS.structures?.vault('key'), ahead: () => HOOKS.structures?.ahead(), advance: (h) => HOOKS.structures?.advance(+h || 0), recount: () => HOOKS.structures?.recount(),
		}),
		demolish: (x, z, k = 1) => { const p = window.L99Island?.world?.()?.player?.state?.pos; return HOOKS.structures?.demolish(x ?? p?.x, z ?? p?.z, k) ?? 'none here'; },
		// catastrophes (cataclysm/): Crysis.cataclysm() how it stands and the next one due here;
		// .quake(6.9), .wildfire(0.7), .eruption(), .end(), .recover(), .clear(), .upcoming(365), .rate(k), .skip(s)
		get cataclysm() { return HOOKS.cataclysm?.api; },
		workplace: () => window.L99Island?.world?.()?.towers?.diagnostics() ?? 'none here',
		interiorGo: (use, i = 0, room = null) => { const w = window.L99Island?.world?.(); return w?.interiors?.goTo(w.player.state, use, i, room) ?? 'none here'; },
		// the services (services/): Crysis.services() tells of the hospitals, stations and armories
		// near, who is on duty, the patients and the units; Crysis.serviceGo('hospital') takes you
		// to the door of the nearest ('police', 'fire', 'armory'; a room: serviceGo('armory', 'warRoom'));
		// Crysis.serviceCall() calls an ambulance out to near you
		services: () => window.L99Island?.world?.()?.services?.info() ?? 'Earth only',
		// magic (magic/): Crysis.magic.info(), .give('light', 100), .all(), .cast('sunspark'), .learn(id), .bind(slot, id)
		get magic() { return HOOKS.magic; },
		// your account (ui/account.js): Crysis.account.open()
		get account() { return HOOKS.account; },
		serviceGo: (kind = 'hospital', room = null) => window.L99Island?.world?.()?.services?.go(kind, room) ?? 'Earth only',
		serviceCall: (severity = 0.6, minor = false) => window.L99Island?.world?.()?.services?.testCall(severity, minor) ?? 'Earth only',
		// the caves of another world: Crysis.caves() lists the mouths, Crysis.cave(i) takes you into one
		// the Deep (planet/deep.js): Crysis.deep() tells of it; Crysis.deepGo('gate'), ('open') or a depth in metres
		deep: () => window.L99Island?.world?.()?.deep?.info() || 'no Deep Gate on this world',
		deepGo: (where = 'gate') => window.L99Island?.world?.()?.deep?.go(where) || 'no Deep Gate on this world',
		// what the strike prompt is offering now (planet/resonance.js)
		striking: () => { const t = HOOKS.striker?.current(); return t ? { label: t.label, at: t.pos.toArray().map((v) => Math.round(v * 10) / 10) } : null; },
		reputation: () => ({ ...HOOKS.soul?.info(), ...HOOKS.morality?.info(), well: window.L99Island?.world()?.soulWell?.info() || null }),
		caves: () => window.L99Island?.world?.()?.underworld?.entrances || [],
		cave: (i = 0) => window.L99Island?.world?.()?.underworld?.go(i),
		// the alien works (planet/alien.js): Crysis.alien() lists the sites, Crysis.alienGo(i) takes you to look at one
		alien: () => window.L99Island?.world?.()?.alien?.sites || [],
		alienGo: (i = 0) => window.L99Island?.world?.()?.alien?.go(i) || 'no alien works on this world',
		// an off-world colony (planet/colony/): Crysis.colony() tells of it, Crysis.colonyGo() lands at its spaceport
		colony: () => window.L99Island?.world?.()?.colony?.info() || null,
		colonyGo: () => window.L99Island?.world?.()?.colony?.go() || 'no colony on this world',
		// a cliff settlement (planet/arch/): Crysis.arch() tells of it, Crysis.archGo(i) stands you on house i's deck (then the towers)
		arch: () => window.L99Island?.world?.()?.arch?.info() || null,
		archGo: (i = 0) => window.L99Island?.world?.()?.arch?.go(i) || 'no cliff settlement on this world',
		// the settlements' glow: 'on', 'off' (phones start off), or a threshold 0..1
		archGlow: (v) => window.L99Island?.world?.()?.arch?.glow?.(v) ?? 'no cliff settlement on this world',
		// a realm of castles (planet/medieval/): Crysis.medieval() tells of it, Crysis.medieval('castle')
		// goes to look (castle, realm, gate, keep, wall, town, square, chapel, windmill, bridge, barrow…);
		// Crysis.quests() lists its quests; Crysis.dungeon(i) goes down into one ('stair', 'last' or
		// 'breach', where it meets the caves, as a second argument)
		medieval: (where) => { const m = window.L99Island?.world?.()?.medieval; return !m ? 'no realm on this world' : where ? m.go(where) : m.info(); },
		quests: () => window.L99Island?.world?.()?.medieval?.quests.info() || 'no realm on this world',
		dungeon: (i = 0, where) => window.L99Island?.world?.()?.medieval?.dungeonGo(i, where) || 'no realm on this world',
		// a volcanic world's eruptions (planet/volcano.js): Crysis.erupt() starts one now (or
		// from a moment in: Crysis.erupt(30)),
		// Crysis.volcano() tells where the cycle is ({ phase, next: seconds to the next, k })
		erupt: (at) => window.L99Island?.world?.()?.volcano?.erupt(at) || 'no volcano on this world',
		volcano: () => window.L99Island?.world?.()?.volcano?.state() || null,
		// sunbeams in the mist (world/sunrays.js): Crysis.rays() tells how they stand; 'on', 'off',
		// 'force' (whatever the hour and the trees), a strength (1 is as made), or { burst: false }
		rays: (v) => window.L99Island?.world?.()?.rays?.control(v) ?? 'no world yet',
		// the quality governor (world/governor.js): the tier now and the best allowed, the frame time,
		// the graphics' memory, the people's bodies alive, whether the last visit ended in a crash
		governor: () => ({ ...HOOKS.governor?.info(), bodies: bodyCount(), pixelRatio: window.L99Island?.renderer?.()?.getPixelRatio() }),
		// the ground as drawn under a point (world/groundprobe.js), for the harnesses: Crysis.groundProbe(x, z)
		// draws the scene from above once and reads the height back; { keep: (o) => bool } limits what is drawn
		// (tests: put the governor on a tier now; in AUTO it moves on from there by its own rules)
		governorTier: (t) => { const G = HOOKS.governor; if (!G) return null; G.state.tier = Math.max(0, Math.min(3, Math.round(+t || 0))); G.state.since = G.state.sinceDown = 0; return G.info(); },
		// the floor guard (world/floorguard.js): how many looks, incidents and repairs, the last bad one
		floorGuard: () => HOOKS.floorGuard?.info() ?? null,
		// the frame's own failures kept on this device (main.js keepFrameError), newest last
		frameErrors: () => { try { return JSON.parse(localStorage.getItem('l99-frame-errors') || '[]'); } catch { return []; } },
		groundProbe: (x, z, opts) => { const I = window.L99Island, W = I?.world?.(), p = W?.player?.state?.pos; if (!W) return null; groundProbe.at ||= createGroundProbe(I.renderer()); return groundProbe.at.probe(I.scene(), x ?? p.x, z ?? p.z, opts); },
		grid: { toGrid: gridTo, fromGrid: gridFrom, BLOCKS: gridBlocks },
		// knock someone over: Crysis.ragdoll(P, { vel, mass, point, lift }); Crysis.ragdolls() tells how many
		ragdoll: (P, how) => HOOKS.ragdolls?.hit(P, how),
		ragdolls: () => HOOKS.ragdolls?.info(),
		// the fight (combat/): Crysis.combat.info(), .spawn('ashfang'), .boss('walker'), .fight(), .raid(), .ignite(); Crysis.morality()
		get combat() { return HOOKS.combat; },
		// your guild: Crysis.guild.info(), .found({ name, tag }), .ask(person), .candidates(), .open('folk')
		get guild() { return HOOKS.guild; },
		living: Object.assign(() => HOOKS.livingWorld?.snapshot(), { sync: () => HOOKS.livingWorld?.sync(), action: (id, action, options) => HOOKS.livingWorld?.action(id, action, options) }),
		projects: Object.assign(() => HOOKS.communityProjects?.snapshot(), {sync:()=>HOOKS.communityProjects?.sync(),action:(id,action,options)=>HOOKS.communityProjects?.action(id,action,options),visuals:()=>HOOKS.projectMarks?.info()}),
		// Crysis.morality(): your compass, this region's tally, the people near you and what they have
		// done; .bag('return'|'steal'|'auto') leaves a bag near you now; .favour() someone asks another;
		// .tick(n) n far-away quests now; .run(s) the scenes on by s seconds; .money('npc:123'); .regions()
		morality: Object.assign(() => ({ ...HOOKS.combat?.morality.info(), npc: HOOKS.npcQuests?.info() }), {
			bag: (mode) => HOOKS.npcQuests?.bag(mode), favour: (kind) => HOOKS.npcQuests?.favour(kind), tick: (n = 1) => HOOKS.npcQuests?.farTick(n), run: (s) => HOOKS.npcQuests?.fastForward(s),
			lead: (kind) => HOOKS.npcQuests?.lead(kind), leads: () => HOOKS.npcQuests?.leads(), spots: () => HOOKS.npcQuests?.spots(),
			money: (id) => ({ balance: HOOKS.npcMoney?.balance(id), wealth: HOOKS.npcMoney?.wealth(id), bank: HOOKS.npcMoney?.attached() }), regions: () => Object.fromEntries((HOOKS.commons?.regions() || []).map((r) => [r, HOOKS.commons.region(r)])),
			log: (n = 20) => HOOKS.commons?.log(n), where: () => HOOKS.npcQuests?.where(),
		}),
		// the military (military/): Crysis.military() the bases near, their garrisons, the patrols sent and
		// the vehicles parked; Crysis.base('Diablo') takes you to a base's gate (the nearest with no name)
		military: Object.defineProperty(() => HOOKS.military?.info(), 'api', { get: () => HOOKS.military }),
		base: (name) => HOOKS.military?.goTo(name) ?? 'Earth only.',
		// law and order (law/): Crysis.law() the level, the calls on their way, the plan, the corners;
		// .surrender(), .arrest(), .territory(); Crysis.lawStep(dt) runs it on (tests)
		law: Object.assign(() => HOOKS.law?.info(), { surrender: () => HOOKS.law?.surrender(), arrest: () => HOOKS.law?.arrest(), reset: () => HOOKS.law?.reset(), incident: (e) => HOOKS.law?.incident(e), territory: (x, z) => HOOKS.law?.territory(x, z), corner: () => HOOKS.law?.corner() }),
		lawStep: (dt = 1 / 30) => HOOKS.law?.update(dt),
		// take the car beside you off its driver (as E does); Crysis.jackable() tells if there is one
		jack: () => HOOKS.carjack?.begin(),
		jackable: () => !!HOOKS.carjack?.candidate(),
		// see yourself (as P does), shove (as X does)
		thirdPerson: () => HOOKS.self?.toggle(),
		// your hero (people/hero.js): Crysis.hero() which, Crysis.hero('female') the other
		hero: (sex) => (sex ? HOOKS.avatar?.setHero(sex).then(() => HOOKS.avatar.hero) : HOOKS.avatar?.hero),
		heroView: () => HOOKS.heroView,
		shove: () => HOOKS.self?.shove(),
		// (tests: run the fallen on by n steps of 1/60 s)
		ragdollStep: (n = 1) => { for (let i = 0; i < n; i++) HOOKS.ragdolls?.update(1 / 60); return HOOKS.ragdolls?.info(); },
		// drive the roads: Crysis.drive.start(), .stop(), .state
		drive: { start: () => HOOKS.drive?.start(), stop: () => HOOKS.drive?.stop(), update: (dt) => HOOKS.drive?.update(dt), options: () => HOOKS.drive?.debugOptions(), physics: () => HOOKS.drive?.physics?.(), get state() { return HOOKS.drive?.state; } },
		// the hills' season: 0 spring green .. 1 summer gold
		season: (v) => { if (v !== undefined) REAL_U.uSeason.value = Math.max(0, Math.min(1, +v)); return REAL_U.uSeason.value; },
		// the month the world keeps: 0 today's, 1..12 that month
		month: (m) => { if (m !== undefined) pickMonth(m); return monthPicked(); },
		// the tattoo studio, wherever you are
		tattoo: () => { HOOKS.tattoo?.(); return 'Tattoo studio'; },
		tattooInfo: () => HOOKS.tattooInfo?.(),
		bloom: (v) => { if (v !== undefined) REAL_U.uBloom.value = Math.max(0, Math.min(1, +v)); return REAL_U.uBloom.value; },
		// share where you are: Crysis.share() (a link and a line of text), Crysis.share({ silent: true, from: 'Sam' })
		share: (opts) => HOOKS.share?.share(opts),
		openAt: (code) => HOOKS.share?.openAt(code),
		// friends: Crysis.rooms() how the room stands; .invite(), .join(code), .follow(id), .leave()
		rooms: Object.assign(() => HOOKS.multiplayer?.info(), { invite: () => HOOKS.multiplayer?.invite?.(), join: (c) => HOOKS.multiplayer?.join(c), follow: (id) => HOOKS.multiplayer?.follow?.(id), goTo: (id) => HOOKS.multiplayer?.goTo?.(id), leave: () => HOOKS.multiplayer?.leave?.() }),
		// homes kept in this browser: Crysis.homes.list(), .add(name), .go(i or id), .rename(id, name), .remove(id)
		homes: { list: () => HOOKS.share?.homes(), add: (name) => HOOKS.share?.addHome(name), go: (i) => HOOKS.share?.goHome(i), rename: (id, n) => HOOKS.share?.renameHome(id, n), remove: (id) => HOOKS.share?.removeHome(id), here: () => HOOKS.share?.building(window.L99Island?.world?.()?.player.state.pos, true) },
		// (a home set by lat/lon here still works: it joins the homes list)
		setHome: (lat, lon, name = 'Home') => { localStorage.setItem('crysis-home', JSON.stringify({ lat: +lat, lon: +lon, name })); HOOKS.share?.refresh(); return 'Home set. Crysis.goHome() takes you there.'; },
		clearHome: () => { localStorage.removeItem('crysis-home'); HOOKS.share?.refresh(); return 'Home cleared.'; },
		goHome: (i = 0) => {
			if (HOOKS.share?.homes().length) { HOOKS.share.goHome(i); return 'Home.'; }
			let h = null; try { h = JSON.parse(localStorage.getItem('crysis-home') || 'null'); } catch { /* no home stored */ }
			const w = window.L99Island?.world?.();
			if (!h || !w?.bayArea?.loaded()) return h ? 'The Bay Area is still loading.' : 'Set it first: Crysis.setHome(lat, lon)';
			const p = toWorld(h.lat, h.lon), P = w.player.state;
			P.flying = true; P.diving = false; P.pos.set(p.x - 40, w.island.heightAt(p.x, p.z) + 60, p.z + 40); P.yaw = Math.atan2(-40, 40); P.pitch = -0.5;
			return 'Home.';
		},
		// a secret or two: Crysis.fireworks(), Crysis.verses()
		fireworks: () => { HOOKS.surprises?.fireworks(); return '✦'; },
		verses: () => HOOKS.surprises?.verses(),
		get surprises() { return HOOKS.surprises; },
		get fishing() { return HOOKS.fishing; },
		// the Santa Cruz Beach Boardwalk: Crysis.boardwalk() tells how it stands, Crysis.ride('dipper')
		// (or 'wheel', 'bumper', 'carousel', 'glider', 'drop') takes you aboard
		boardwalk: () => window.L99Island?.world?.()?.boardwalk?.info() ?? 'No Boardwalk on this world.',
		ride: (name = 'dipper') => window.L99Island?.world?.()?.boardwalk?.rideNow(name) ?? 'No Boardwalk on this world.',
		// the minigames: Crysis.arcade.start('bowling'), .stop(), .games()
		get arcade() { return HOOKS.arcade; },
		// explore: Crysis.explore() how it stands, .start(), .stop()
		explore: Object.assign(() => HOOKS.explore?.info(), { start: () => HOOKS.explore?.start(), stop: () => HOOKS.explore?.stop() }),
		// auto music: Crysis.music.auto(true), .state(), .log(true), .level(0.5), .queue('chorus')
		music: { auto: (on) => HOOKS.autoMusic?.auto(on), state: () => HOOKS.autoMusic?.state(), log: (on) => HOOKS.autoMusic?.log(on), level: (v) => HOOKS.autoMusic?.level(v), queue: (to, now) => HOOKS.autoMusic?.queue(to, now) },
		surprisesDbg: () => { const S = HOOKS.surprises; return S ? { busy: S.fw.busy(), n: S.fw.count(), ...S.fw.dbg() } : 'none'; },
		// the world's audio: Crysis.audio() (surface, room, beds, levels), .set({ amb, feet, steps }), .record(s)
		audio: Object.assign(() => HOOKS.audio?.debug(), { set: (v) => HOOKS.audio?.set(v), record: (s) => HOOKS.audio?.record(s), tick: (dt, o) => HOOKS.audio?.tick(dt, o) }),
		// the trailer's camera: Crysis.cine((camera, dt, time) => { ... }) poses it every frame; Crysis.cine() lets go
		cine: (fn) => { HOOKS.cine = typeof fn === 'function' ? fn : null; return !!HOOKS.cine; },
		// the Earth atlas and the city director (earth/): Crysis.atlas(lat, lon) tells what a place
		// is like (here, with no arguments); Crysis.brief('Lisbon') gives a city's brief (a promise);
		// Crysis.earth() how the director stands. The people can read chatter from earth/hub.js.
		atlas: (lat, lon) => { if (lat == null) { const p = window.L99Island?.world?.()?.player?.state?.pos; const ll = p ? globeLL(p.x, p.z) : { lat: 37.77, lon: -122.42 }; lat = ll.lat; lon = ll.lon; } return HOOKS.earth?.describe(+lat, +lon); },
		brief: (name) => HOOKS.earth?.briefFor(name),
		earth: () => HOOKS.earth?.info(),
		// the globe (earth/globe.js): Crysis.globe() where you are on it and how it streams;
		// Crysis.goTo(lat, lon) flies you there, anywhere on Earth
		globe: () => window.L99Island?.world?.()?.globe?.info() ?? 'Earth only.',
		// the regional kit (region/): which kit, culture, weather and places are round you
		region: () => window.L99Island?.world?.()?.globe?.regional?.info() ?? 'Earth only.',
		goTo: (lat, lon, agl) => HOOKS.goTo?.(lat, lon, agl) ?? 'Earth only.',
		ecology: () => { const w = window.L99Island?.world?.(); return w?.eco ? describeLand(w.land) + '\n\n' + describe(w.eco) : 'no world open'; },
	};
}
