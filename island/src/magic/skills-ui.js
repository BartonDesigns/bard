// The skills and magic menu (Tab, N, the places menu, or a tap on your fabric): every skill on a
// page of its own, laid out as a constellation over the night sky (magic/skills.js has the
// pages, the perks and where each sits). Slide between pages with a swipe, the arrows, the
// keys (← →, A D, Q E) or the wheel; choose a star to read what it does, see it at work, and
// weave it (a spell, with fabric) or unlock it (a perk, with a skill point); a known spell is
// slotted to the keys 6 to 0 from here.
//
// Built once, on first opening. While it is open it covers the world (main.js stops drawing it
// and holds the fight), takes the keys (a capturing listener, so nothing reaches the game but a
// key let go), and draws its sky on one small canvas. All movement is transforms and opacity.

import { SPELL, SCHOOLS, TWILIGHT_NEEDS, SLOTS, weaveCost, manaCost, manaMax, spellPower, shaped, cooldownOf, strandOf } from './spells.js';
import { PAGES, SKILL, LAYOUT, PERK, STRAND_NAME, pageNodes, pageLinks, rankOf, rankFrac, useFor, xpNeed, pointsOf, perkBlock, holds, fxLines, RANK_MAX, spellBlock, isUltimate, ULTIMATE_RANK, MASTERY, MASTERY_POWER, MASTERY_GIFT, NUMERAL, masteryLevel, masteryToNext, feedable, feedCost } from './skills.js';
import { composeMods, powerSources, alteredBy } from './stats.js';

const KEYS = ['6', '7', '8', '9', '0'];
const ICON = { radiance: '☀', restoration: '✚', warding: '⛨', dawn: '☼', shadow: '☾', void: '◆', blight: '☣', umbral: '⛧', storm: 'ϟ', chrono: '⧗', primal: '♨', marksman: '⌖', athletics: '»', resilience: '⛊' };
// a glyph drawn as text, never as a coloured emoji (U+FE0E asks for the text form)
const txt = (g) => (g ? `${g}\uFE0E` : '');
const STRAND_COL = { light: '#ffd27a', dark: '#b39aff', twilight: '#7fd8ff', body: '#9fe8c8' };
const KIND_WORD = { bolt: 'Bolt', beam: 'Held beam', burst: 'Burst at your aim', strike: 'Strike from the sky', nova: 'Nova round you', cone: 'Cone before you', chain: 'Chain', orb: 'Rolling orb', well: 'Void well', cloud: 'Lingering cloud', zone: 'Hallowed ground', storm: 'Storm', heal: 'Heal', hot: 'Heal over time', shield: 'Ward', deathward: 'Death ward', aura: 'Aura', buff: 'Blessing', cloak: 'Cloak', light: 'Light', sight: 'Sight', pact: 'Pact', summon: 'Summoning', blink: 'Blink', recall: 'Mark and return', gate: 'Gate', rewind: 'Rewind', stasis: 'Stasis', douse: 'Rain', daybreak: 'Daybreak', lances: 'Lances from the sky', singularity: 'Black hole on the horizon' };
const DMG_WORD = { radiant: 'radiant', shadow: 'shadow', void: 'void', blight: 'blight', storm: 'storm', frost: 'frost', fire: 'fire' };

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
const r1 = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
const sec = (v) => `${r1(v)} s`;

const CSS = `
.sk{position:absolute;inset:0;z-index:40;display:none;opacity:0;background:#04060b;color:#eef3f7;font:500 13px/1.4 var(--bard-body,system-ui,sans-serif);overflow:hidden;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .32s ease}
.sk.on{display:block}.sk.vis{opacity:1}
.sk *{box-sizing:border-box}
.sk button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
.sk button:focus-visible{outline:2px solid #01a982;outline-offset:2px}
.sk-sky{position:absolute;inset:0;width:100%;height:100%}
.sk-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 45%,transparent 40%,rgba(0,0,0,.55) 100%)}
.sk-flash{position:absolute;inset:0;pointer-events:none;opacity:0}
.sk-flash.go{animation:skFlash .9s ease-out}
@keyframes skFlash{0%{opacity:.9}100%{opacity:0}}
/* header */
.sk-head{position:absolute;left:0;right:0;top:0;height:var(--hh);display:flex;align-items:center;gap:14px;padding:0 calc(16px + env(safe-area-inset-right)) 0 calc(16px + env(safe-area-inset-left));padding-top:env(safe-area-inset-top);z-index:3;background:linear-gradient(180deg,rgba(4,6,11,.92),rgba(4,6,11,0))}
.sk-lv{display:flex;align-items:center;gap:10px;min-width:0}
.sk-ring{position:relative;width:42px;height:42px;flex:none}
.sk-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}
.sk-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 15px/1 var(--bard-body,system-ui,sans-serif)}
.sk-lv .t{display:flex;flex-direction:column;min-width:0}
.sk-lv .t span{font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.6;font-family:var(--bard-display,Georgia,serif)}
.sk-lv .t em{font-style:normal;font-size:12px;opacity:.85;white-space:nowrap}
.sk-sp{flex:1}
.sk-pts{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:20px;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);white-space:nowrap}
.sk-pts i{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;background:radial-gradient(circle,#fff 0,#9ff5dc 30%,#01a982 70%);color:#04130e;font-weight:800}
.sk-pts.has{box-shadow:inset 0 0 0 1px rgba(1,169,130,.7),0 0 18px rgba(1,169,130,.35);animation:skPulse 2.4s ease-in-out infinite}
.sk-pts.none{opacity:.6}.sk-pts.none i{filter:grayscale(1)}
@keyframes skPulse{50%{box-shadow:inset 0 0 0 1px rgba(1,169,130,.9),0 0 28px rgba(1,169,130,.55)}}
.sk-fab{display:flex;gap:10px;font-size:12px;white-space:nowrap}
.sk-fab .l{color:#ffd27a}.sk-fab .d{color:#b39aff}.sk-fab .m{color:#a8c4ff}.sk-fab b{font-weight:inherit}
.sk-x{width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);cursor:pointer;font-size:16px;flex:none;transition:background .2s}
.sk-x:hover{background:rgba(255,255,255,.14)}
/* page chips */
.sk-nav{position:absolute;left:0;right:0;top:var(--hh);height:var(--nh);display:flex;align-items:center;gap:4px;padding:0 calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));overflow-x:auto;overflow-y:hidden;scrollbar-width:none;z-index:3;touch-action:pan-x}
.sk-nav::-webkit-scrollbar{display:none}
.sk-nav .gap{width:10px;flex:none;height:18px;border-left:1px solid rgba(255,255,255,.12);margin-left:6px}
.sk-chip{flex:none;height:32px;min-width:32px;padding:0 9px;border-radius:16px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;gap:6px;opacity:.55;transition:opacity .25s,background .25s;position:relative}
.sk-chip .g{font-size:14px;width:16px;text-align:center}
.sk-chip .n{font-size:12px;font-weight:600;letter-spacing:.04em;max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .35s ease}
.sk-chip:hover{opacity:.85}
.sk-chip.cur{opacity:1;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px var(--c)}
.sk-chip.cur .n{max-width:140px}
.sk-chip .dot{position:absolute;right:3px;top:4px;width:6px;height:6px;border-radius:50%;background:#01a982;box-shadow:0 0 6px #01a982;display:none}
.sk-chip.can .dot{display:block}
/* the stage and its pages */
.sk-stage{position:absolute;left:0;right:0;top:calc(var(--hh) + var(--nh));bottom:0;touch-action:none;overflow:hidden}
.sk-track{position:absolute;left:0;top:0;bottom:0;width:100%;will-change:transform}
.sk-track.glide{transition:transform .55s cubic-bezier(.22,.9,.24,1)}
/* (each page seated along the track by its left; only the page in view, and the one sliding in
   beside it, are shown at all: the rest are display:none, so the compositor backs one or two
   screens, never fourteen) */
.sk-page{position:absolute;top:0;left:0;height:100%}
.sk-page[hidden]{display:none}
.sk-neb{position:absolute;inset:-10%;pointer-events:none;opacity:.9}
/* (the drift is a screen-sized layer of its own: not on a phone, whose graphics memory is spoken for) */
.sk:not(.phone) .sk-page.cur .sk-neb{animation:skDrift 26s ease-in-out infinite alternate}
@keyframes skDrift{to{transform:translate3d(-2%,1.5%,0) scale(1.04)}}
.sk-title{position:absolute;left:var(--tl);top:var(--tt);width:var(--tw);pointer-events:none}
.sk-title .s{font-size:10px;letter-spacing:.24em;text-transform:uppercase;opacity:.65;font-family:var(--bard-display,Georgia,serif)}
.sk-title h2{margin:2px 0 4px;font:600 var(--tf)/1.05 var(--bard-display,Georgia,serif);letter-spacing:.2em;text-transform:uppercase;background:linear-gradient(180deg,#fff 30%,var(--c));-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.sk-title .rk{display:flex;align-items:center;gap:8px;font-size:12px}
.sk-title .rk b{font:700 18px/1 var(--bard-display,system-ui,sans-serif);color:var(--c)}
.sk-title .bar{flex:1;max-width:150px;height:3px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden}
.sk-title .bar i{display:block;height:100%;background:var(--c);transform-origin:left;box-shadow:0 0 8px var(--c)}
.sk-title p{margin:6px 0 0;font-size:12px;opacity:.6;font-style:italic;max-width:260px}
.sk-cons{position:absolute;left:var(--cl);top:var(--ct);width:var(--cw);height:var(--ch)}
.sk-cons svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sk-cons svg *{vector-effect:non-scaling-stroke}
.sk-fig{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;opacity:.16}
.sk-ln{stroke-linecap:round;fill:none}
.sk-ln.far{stroke:rgba(255,255,255,.1);stroke-width:1}
.sk-ln.near{stroke:rgba(255,255,255,.2);stroke-width:1.2}
.sk-ln.can{stroke-width:1.8;stroke-dasharray:5 7}
.sk-page.cur .sk-ln.can{animation:skFlow 1s linear infinite}
@keyframes skFlow{to{stroke-dashoffset:-12}}
.sk-ln.own{stroke-width:2.4}
.sk-ln.glow{stroke-width:9;opacity:.16}
.sk-ln.grow{stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:skGrow .7s ease-out forwards}
@keyframes skGrow{to{stroke-dashoffset:0}}
/* the stars */
.sk-n{position:absolute;width:var(--ns);height:var(--ns);margin:calc(var(--ns) / -2) 0 0 calc(var(--ns) / -2);border:0;padding:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:none}
.sk-n .o{position:absolute;inset:0;border-radius:50%;transition:transform .3s cubic-bezier(.2,.9,.3,1.3),box-shadow .3s,background .3s}
.sk-n.perk .o{border-radius:22%;transform:rotate(45deg) scale(.82)}
.sk-n .g{position:relative;font-size:calc(var(--ns) * .42);line-height:1;transition:color .3s,text-shadow .3s}
.sk-n:hover .lb{opacity:1}
.sk-n .lb{position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);font-size:var(--lf);font-weight:600;letter-spacing:.03em;white-space:nowrap;opacity:.5;pointer-events:none;text-shadow:0 1px 3px #000,0 0 8px #000;transition:opacity .25s}
.sk-n.far .o{background:rgba(255,255,255,.02);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.sk-n.far .g{color:rgba(255,255,255,.22)}
.sk-n.far .lb{opacity:.28}
.sk-n.near .o{background:rgba(255,255,255,.035);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}
.sk-n.near .g{color:rgba(255,255,255,.55)}
.sk-n.can .o{background:radial-gradient(circle,var(--c2) 0,rgba(0,0,0,.2) 70%);box-shadow:inset 0 0 0 1.5px var(--c),0 0 14px var(--c2)}
.sk-n.can .g{color:var(--c)}
.sk-n.can .lb{opacity:.85}
.sk-page.cur .sk-n.can .o{animation:skBeat 2.2s ease-in-out infinite}
.sk-page.cur .sk-n.perk.can .o{animation-name:skBeatD}
@keyframes skBeat{50%{box-shadow:inset 0 0 0 1.5px var(--c),0 0 26px var(--c)}}
@keyframes skBeatD{50%{box-shadow:inset 0 0 0 1.5px var(--c),0 0 26px var(--c)}}
.sk-n.own .o{background:radial-gradient(circle,#fff 0,var(--c) 34%,var(--c3) 62%,transparent 72%);box-shadow:0 0 22px var(--c2),0 0 4px var(--c)}
.sk-n.own .g{color:#0a0d14;text-shadow:0 0 4px rgba(255,255,255,.8)}
.sk-n.own .lb{opacity:.9}
.sk-n.own::before{content:'';position:absolute;left:50%;top:50%;width:calc(var(--ns) * 2.3);height:calc(var(--ns) * 2.3);margin:calc(var(--ns) * -1.15) 0 0 calc(var(--ns) * -1.15);pointer-events:none;background:linear-gradient(90deg,transparent 0,var(--c2) 46%,#fff 50%,var(--c2) 54%,transparent 100%) center/100% 2px no-repeat,linear-gradient(0deg,transparent 0,var(--c2) 46%,#fff 50%,var(--c2) 54%,transparent 100%) center/2px 100% no-repeat;opacity:.55}
.sk-page.cur .sk-n.own::before{animation:skTwinkle 5s ease-in-out infinite;animation-delay:var(--d)}
@keyframes skTwinkle{0%,100%{transform:rotate(0) scale(.85);opacity:.4}50%{transform:rotate(45deg) scale(1.05);opacity:.75}}
.sk-n.sel .o{transform:scale(1.14)}
.sk-n.perk.sel .o{transform:rotate(45deg) scale(.95)}
.sk-n.sel .lb{opacity:1}
.sk-n.sel::after{content:'';position:absolute;inset:-9px;border-radius:50%;border:1px dashed var(--c);opacity:.9;animation:skSpin 9s linear infinite;pointer-events:none}
@keyframes skSpin{to{transform:rotate(360deg)}}
.sk-n.ult{--ns:calc(var(--ns0) * 1.32)}
.sk-n.ult .o::after{content:'';position:absolute;inset:-34%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0,var(--c2) 18%,transparent 34%,var(--c2) 60%,transparent 78%);-webkit-mask:radial-gradient(circle,transparent 52%,#000 56%,transparent 72%);mask:radial-gradient(circle,transparent 52%,#000 56%,transparent 72%);opacity:.75;animation:skSpin 14s linear infinite;pointer-events:none}
.sk-n.ult.far .o::after{opacity:.25}
.sk-n .bh{position:relative;width:46%;height:46%;border-radius:50%;background:#000;box-shadow:0 0 0 1.5px rgba(255,246,236,.9),0 0 10px 2px var(--c),0 0 24px var(--c2)}
.sk-n .bh i{position:absolute;left:-62%;right:-62%;top:44%;height:12%;border-radius:50%;background:linear-gradient(90deg,transparent,var(--c) 22%,#fff 50%,var(--c) 78%,transparent);transform:rotate(-8deg);opacity:.9}
.sk-n.ult.far .bh,.sk-n.ult.near .bh{opacity:.55}
.sk-n.ult .lb{font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-family:var(--bard-display,Georgia,serif)}
.sk-n.pop .o{animation:skPop .8s cubic-bezier(.2,.9,.3,1.4)}
.sk-n .pr{position:absolute;inset:0;border-radius:50%;pointer-events:none;opacity:0}
.sk-n.pop .pr{box-shadow:0 0 0 2px var(--c),0 0 18px var(--c);animation:skRing .9s ease-out forwards}
@keyframes skPop{0%{transform:scale(.6)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
@keyframes skRing{from{transform:scale(1);opacity:1}to{transform:scale(3.6);opacity:0}}
.sk-page.enter .sk-n{animation:skIn .55s cubic-bezier(.2,.9,.3,1.2) backwards;animation-delay:calc(var(--i) * 28ms)}
.sk-page.enter .sk-title{animation:skUp .5s ease-out backwards}
@keyframes skIn{from{opacity:0;transform:scale(.4)}}
@keyframes skUp{from{opacity:0;transform:translateY(10px)}}
/* arrows */
.sk-arr{position:absolute;top:50%;width:44px;height:64px;margin-top:-32px;border:0;border-radius:12px;background:rgba(255,255,255,.04);cursor:pointer;font-size:22px;opacity:.6;z-index:2;transition:opacity .2s,background .2s}
.sk-arr:hover{opacity:1;background:rgba(255,255,255,.1)}
.sk-arr.l{left:calc(8px + env(safe-area-inset-left))}
.sk-arr[hidden]{display:none}
/* what a star does */
.sk-info{position:absolute;z-index:3;display:flex;flex-direction:column;background:linear-gradient(180deg,#0e131c,#080b11);box-shadow:0 0 0 1px rgba(255,255,255,.1),0 20px 60px rgba(0,0,0,.6);overflow:hidden}
.sk.wide .sk-info{right:calc(16px + env(safe-area-inset-right));top:calc(var(--hh) + var(--nh) + 8px);bottom:calc(16px + env(safe-area-inset-bottom));width:var(--iw);border-radius:16px}
.sk.tall .sk-info{left:0;right:0;bottom:0;height:var(--ih);border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom)}
.sk-info .scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:16px 16px 8px}
.sk-info .hd{display:flex;gap:12px;align-items:center}
.sk-med{width:52px;height:52px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;background:radial-gradient(circle,var(--c2),rgba(0,0,0,0) 72%);box-shadow:inset 0 0 0 1px var(--c);color:var(--c)}
.sk-med.perk{border-radius:14px}
.sk-med.own{background:radial-gradient(circle,#fff 0,var(--c) 40%,var(--c3) 70%);color:#0a0d14}
.sk-info h3{margin:0;font:650 19px/1.2 var(--bard-display,system-ui,sans-serif);letter-spacing:.02em}
.sk-info .ty{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-top:2px;font-family:var(--bard-display,Georgia,serif)}
.sk-info .desc{margin:12px 0 0;font-size:13.5px;line-height:1.5;opacity:.9}
.sk-pv{display:block;width:100%;height:110px;margin-top:12px;border-radius:12px;background:radial-gradient(ellipse at 50% 120%,var(--c2),transparent 70%),rgba(255,255,255,.025);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.sk-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
.sk-st{padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.04)}
.sk-st>span{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.55;font-family:var(--bard-display,Georgia,serif)}
.sk-st b{font-size:14px;font-weight:650}
.sk-st s{opacity:.45;font-size:11px;margin-right:5px;font-weight:500}
.sk-st.w{grid-column:span 2}
.sk-st .up{color:#5eead4}
.sk-now{margin-top:8px;font-size:11.5px;opacity:.62}
.sk-src{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.sk-src>span{font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);opacity:.85}
.sk-src b{font-weight:650;margin-right:2px}
.sk-src .perk b{color:#5eead4}.sk-src .gear b{color:#ffd27a}.sk-src .attr b{color:#ffd27a}.sk-src .mastery b{color:#c4b5fd}
.sk-src .gear{border-color:rgba(255,210,122,.25)}
.sk-src .steel b{color:#ff9a8a}.sk-src .steel{border-color:rgba(255,140,120,.25)}
.sk-el{display:flex;gap:10px;align-items:flex-start;margin-top:9px;padding:9px 11px;border-radius:10px;background:var(--elb,rgba(255,255,255,.05));border:1px solid var(--elc,rgba(255,255,255,.12));font-size:12px;line-height:1.4}
.sk-el>i{font-style:normal;font-size:18px;line-height:1;width:22px;text-align:center;color:var(--ell,#fff);filter:drop-shadow(0 0 6px var(--elc,transparent))}
.sk-el b{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ell,#fff);margin-bottom:2px;font-family:var(--bard-display,Georgia,serif)}
.sk-el span{display:block;opacity:.85}
.sk-el em{display:block;font-style:normal;margin-top:4px;font-weight:650;color:var(--ell,#fff)}
.sk-el.el-radiant{--ell:#ffd27a;--elc:rgba(255,210,122,.3);--elb:rgba(255,210,122,.07)}
.sk-el.el-fire{--ell:#ff9a4d;--elc:rgba(255,140,60,.32);--elb:rgba(255,120,40,.08)}
.sk-el.el-frost{--ell:#bfeaff;--elc:rgba(170,225,255,.32);--elb:rgba(170,225,255,.07)}
.sk-el.el-storm{--ell:#9fd4ff;--elc:rgba(140,200,255,.32);--elb:rgba(140,200,255,.07)}
.sk-el.el-shadow{--ell:#c4a6ff;--elc:rgba(150,100,255,.32);--elb:rgba(120,70,255,.08)}
.sk-el.el-void{--ell:#8fc4ff;--elc:rgba(100,130,255,.32);--elb:rgba(80,70,255,.08)}
.sk-el.el-blight{--ell:#b6f05a;--elc:rgba(150,240,60,.3);--elb:rgba(130,220,40,.07)}
.sk-alt{margin-top:9px;padding:8px 10px;border-radius:9px;background:rgba(255,210,122,.07);border:1px solid rgba(255,210,122,.22);font-size:12px;line-height:1.4}
.sk-alt b{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#ffd27a;margin-bottom:2px;font-family:var(--bard-display,Georgia,serif)}
.sk-fx{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px}
.sk-fx li{padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.04);font-size:13px;display:flex;gap:8px;align-items:baseline}
.sk-fx li::before{content:'✦';color:var(--c);font-size:11px}
.sk-cmp{margin-top:8px;font-size:12.5px;opacity:.85}
.sk-cmp b{color:#5eead4;font-weight:650}
.sk-req{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:12.5px}
.sk-req li{display:flex;gap:8px;align-items:baseline;opacity:.9}
.sk-req li i{font-style:normal;width:14px;text-align:center;flex:none}
.sk-req li.ok i{color:#10b981}.sk-req li.no i{color:#f59e0b}
.sk-req li.no{opacity:1}
.sk-ms{margin-top:14px;padding:12px;border-radius:12px;background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.02));box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
.sk-ms .top{display:flex;align-items:baseline;gap:8px}
.sk-ms .top span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;font-family:var(--bard-display,Georgia,serif)}
.sk-ms .top b{font:700 18px/1 var(--bard-display,system-ui,sans-serif);color:var(--c);text-shadow:0 0 12px var(--c2);letter-spacing:.06em}
.sk-ms .top em{margin-left:auto;font-style:normal;font-size:11.5px;opacity:.6}
.sk-ms .seg{display:flex;gap:4px;margin-top:9px}
.sk-ms .seg div{flex:1;position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}
.sk-ms .seg i{position:absolute;inset:0;transform-origin:left;background:linear-gradient(90deg,var(--c3),var(--c));box-shadow:0 0 8px var(--c2);transition:transform .12s linear}
.sk-ms .lv{display:flex;margin-top:4px;font-size:9.5px;letter-spacing:.1em;opacity:.45}
.sk-ms .lv span{flex:1;text-align:right}
.sk-ms .lv span.on{opacity:1;color:var(--c);font-weight:700}
.sk-ms ul{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px;font-size:12.5px}
.sk-ms li{display:flex;gap:8px;align-items:baseline;opacity:.55}
.sk-ms li.on{opacity:1}
.sk-ms li i{font-style:normal;flex:none;min-width:24px;font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--c)}
.sk-ms li b{font-weight:650}
.sk-feed{position:relative;overflow:hidden;width:100%;margin-top:11px;height:42px;border:0;border-radius:11px;cursor:pointer;font-weight:650;font-size:13.5px;color:#fff;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1.5px var(--c);touch-action:none;user-select:none;-webkit-user-select:none;transition:background .2s,box-shadow .2s,transform .15s}
.sk-feed:hover{background:rgba(255,255,255,.1)}
.sk-feed.on{transform:scale(.985);background:var(--c2);box-shadow:inset 0 0 0 1.5px var(--c),0 0 22px var(--c2)}
.sk-feed.on::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(100deg,transparent 0 14px,rgba(255,255,255,.18) 14px 18px);animation:skPour .5s linear infinite}
@keyframes skPour{to{background-position:36px 0}}
.sk-feed:disabled{box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);color:rgba(255,255,255,.5);cursor:default;background:rgba(255,255,255,.03)}
.sk-feed span{position:relative}
.sk-ms small{display:block;margin-top:6px;font-size:11px;opacity:.5;text-align:center}
.sk-ms.up{animation:skMsUp .9s ease-out}
@keyframes skMsUp{0%{box-shadow:inset 0 0 0 1px var(--c),0 0 0 0 var(--c)}100%{box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),0 0 0 14px transparent}}
.sk-n .mp{position:absolute;right:-4px;top:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#0a0d14;box-shadow:inset 0 0 0 1px var(--c);color:var(--c);font:700 9px/16px var(--bard-body,system-ui,sans-serif);letter-spacing:.04em;pointer-events:none;display:none}
.sk-n.own .mp.on{display:block}
.sk-act{flex:none;padding:12px 16px 14px;border-top:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;gap:8px;background:rgba(0,0,0,.2)}
.sk-go{height:46px;border:0;border-radius:12px;cursor:pointer;font-weight:700;font-size:14.5px;letter-spacing:.03em;background:linear-gradient(135deg,#01a982 0%,#10b981 100%);color:#fff;box-shadow:0 4px 18px rgba(1,169,130,.35);transition:transform .15s,box-shadow .2s,filter .2s;position:relative;overflow:hidden;font-family:var(--bard-display,Georgia,serif)!important}
.sk-go:hover{transform:translateY(-1px);box-shadow:0 8px 26px rgba(1,169,130,.45)}
.sk-go:active{transform:scale(.98)}
.sk-go::after{content:'';position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);animation:skShine 2.8s ease-in-out infinite}
@keyframes skShine{60%,100%{left:120%}}
.sk-go:disabled{background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);box-shadow:none;cursor:default;transform:none;font-weight:600;font-size:13px}
.sk-go:disabled::after{display:none}
.sk-go.done{background:rgba(16,185,129,.12);color:#5eead4;box-shadow:inset 0 0 0 1px rgba(16,185,129,.4)}
.sk-slots{display:flex;align-items:center;gap:6px}
.sk-slots span{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin-right:auto;font-family:var(--bard-display,Georgia,serif)}
.sk-slots button{width:40px;height:40px;border-radius:10px;border:0;cursor:pointer;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:11px;font-weight:700;transition:background .2s,box-shadow .2s}
.sk-slots button em{font-style:normal;font-size:13px;line-height:1;opacity:.85}
.sk-slots button.on{background:rgba(1,169,130,.22);box-shadow:inset 0 0 0 1.5px #01a982}
.sk-keys{position:absolute;left:calc(18px + env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom));font-size:11px;opacity:.42;z-index:2;pointer-events:none;white-space:nowrap}
.sk-keys b{display:inline-block;min-width:18px;padding:1px 5px;margin:0 2px;border-radius:4px;background:rgba(255,255,255,.1);text-align:center;font-weight:600}
.sk-toast{position:absolute;left:50%;top:calc(var(--hh) + var(--nh) + 10px);transform:translate(-50%,-8px);padding:8px 16px;border-radius:20px;background:rgba(10,14,20,.92);box-shadow:inset 0 0 0 1px var(--c,#01a982),0 0 24px rgba(0,0,0,.6);font-weight:600;font-size:13px;opacity:0;pointer-events:none;z-index:5;transition:opacity .25s,transform .25s;white-space:nowrap}
.sk-toast.on{opacity:1;transform:translate(-50%,0)}
.sk.tall .sk-keys,.sk.touch .sk-keys{display:none}
.sk.tall .sk-head{gap:10px}
.sk.tall .sk-lv .t,.sk.tall .sk-pts .w{display:none}
.sk.tall .sk-fab{gap:8px;font-size:11.5px}
.sk.tall .sk-title p{display:none}
.sk.tall .sk-title .s{font-size:9.5px}
.sk.tall .sk-title h2{margin:1px 0 3px;letter-spacing:.16em}
.sk.tall .sk-info{transition:height .35s cubic-bezier(.22,.9,.24,1)}
.sk.tall .sk-info.full{height:calc(100% - var(--hh) - 24px)}
.sk.tall .sk-toast{top:auto;bottom:calc(var(--ih) + 14px + env(safe-area-inset-bottom))}
.sk-grab{display:none;flex:none;height:22px;align-items:center;justify-content:center;cursor:pointer;touch-action:none}
.sk-grab i{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.25)}
.sk.tall .sk-grab{display:flex}
.sk.tall .sk-info .scroll{padding-top:2px}
.sk.tall .sk-arr,.sk.short .sk-arr,.sk.short .sk-keys{display:none}
.sk.short .sk-lv .t em,.sk.tall .sk-fab .m{display:none}
@media (prefers-reduced-motion: reduce){.sk *,.sk *::before,.sk *::after{animation:none!important;transition:none!important}}
`;
const STYLE_ID = 'sk-style';

export function createSkillsMenu({ mount, state, light = () => 0.5, onWeave, onPerk, onBind, onFeed = () => ({ fed: 0, levels: 0 }), elements = {}, sound = () => {}, isTouch = false, isPhone = false }) {
	let root = null, built = false, open = false, vis = false, page = 0, sel = null, mode = 'wide', W = 0, H = 0;
	const P = { stage: null, track: null, pages: [], chips: [], info: null, head: {}, flash: null, toast: null, arr: [], sky: null, pv: null };
	const nodesOf = new Map(PAGES.map((k) => [k, pageNodes(k)]));
	const lastSel = {};

	// ---------- building ----------
	const mk = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent?.appendChild(e); return e; };
	const svgEl = (tag, attrs, parent) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
	function colours(el, c) {
		el.style.setProperty('--c', c);
		el.style.setProperty('--c2', rgba(c, 0.35));
		el.style.setProperty('--c3', rgba(c, 0.18));
	}
	function build() {
		built = true;
		if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
		root = mk('div', 'sk' + (isTouch ? ' touch' : '') + (isPhone ? ' phone' : ''), mount);
		root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Skills and magic');
		// (a game controller sends it the arrow keys, Enter and Escape: ui/gamepad.js)
		root.dataset.pad = 'keys';
		// (nothing in here reaches the game underneath)
		for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'wheel', 'click', 'contextmenu', 'dblclick']) root.addEventListener(ev, (e) => e.stopPropagation());
		P.sky = mk('canvas', 'sk-sky', root);
		mk('div', 'sk-vig', root);
		P.flash = mk('div', 'sk-flash', root);
		// the header: level, points, fabric, mana, close
		const head = mk('div', 'sk-head', root);
		const lv = mk('div', 'sk-lv', head);
		const ring = mk('div', 'sk-ring', lv);
		const rs = svgEl('svg', { viewBox: '0 0 42 42' }, ring);
		svgEl('circle', { cx: 21, cy: 21, r: 18, fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 3 }, rs);
		P.head.arc = svgEl('circle', { cx: 21, cy: 21, r: 18, fill: 'none', stroke: '#01a982', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': `${2 * Math.PI * 18}`, 'stroke-dashoffset': `${2 * Math.PI * 18}` }, rs);
		P.head.lvl = mk('b', '', ring, '1');
		const lt = mk('div', 't', lv);
		mk('span', '', lt, 'Level');
		P.head.xp = mk('em', '', lt, '');
		mk('div', 'sk-sp', head);
		P.head.pts = mk('div', 'sk-pts', head);
		P.head.fab = mk('div', 'sk-fab', head);
		const x = mk('button', 'sk-x', head, '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close (Esc)'); x.title = 'Close (Esc)';
		x.addEventListener('click', () => close());
		// the page chips
		const nav = mk('nav', 'sk-nav', root);
		nav.setAttribute('aria-label', 'Skills');
		let lastStrand = null;
		PAGES.forEach((k, i) => {
			const S = SKILL[k];
			if (lastStrand && S.strand !== lastStrand) mk('span', 'gap', nav);
			lastStrand = S.strand;
			const c = mk('button', 'sk-chip', nav, `<span class="g">${txt(ICON[k])}</span><span class="n">${S.name}</span><i class="dot"></i>`);
			c.type = 'button'; c.title = `${S.name} · ${STRAND_NAME[S.strand]}`; c.setAttribute('aria-label', S.name);
			c.style.setProperty('--c', S.color); c.querySelector('.g').style.color = S.color;
			c.addEventListener('click', () => go(i));
			P.chips.push(c);
		});
		// the stage
		P.stage = mk('div', 'sk-stage', root);
		P.track = mk('div', 'sk-track', P.stage);
		PAGES.forEach((k, i) => P.pages.push(buildPage(k, i)));
		P.arr = ['l', 'r'].map((d) => {
			const b = mk('button', 'sk-arr ' + d, P.stage, d === 'l' ? '‹' : '›'); b.type = 'button';
			b.setAttribute('aria-label', d === 'l' ? 'Previous skill' : 'Next skill');
			b.addEventListener('click', () => go(page + (d === 'l' ? -1 : 1)));
			return b;
		});
		P.info = mk('aside', 'sk-info', root);
		P.info.setAttribute('aria-live', 'polite');
		P.keys = mk('div', 'sk-keys', root, '<b>←</b><b>→</b> skills &nbsp; <b>↑</b><b>↓</b> stars &nbsp; <b>Enter</b> weave or unlock &nbsp; <b>6</b>–<b>0</b> slot &nbsp; <b>Tab</b> or <b>Esc</b> close');
		P.toast = mk('div', 'sk-toast', root);
		// (one preview canvas for the menu's life, seated in the sheet whenever a spell is shown: a
		// new canvas at every star would hold its pixels until the next collection, and an
		// iPhone's canvas memory is capped)
		P.pv = mk('canvas', 'sk-pv');
		swipe();
		P.stage.addEventListener('wheel', onWheel, { passive: false });
	}
	function buildPage(k, i) {
		const S = SKILL[k], L = LAYOUT[k];
		const el = mk('section', 'sk-page', P.track);
		colours(el, S.color);
		el.setAttribute('aria-label', S.name);
		const sc = STRAND_COL[S.strand];
		mk('div', 'sk-neb', el).style.background = `radial-gradient(ellipse 50% 42% at 40% 46%,${rgba(S.color, 0.2)},transparent 70%),radial-gradient(ellipse 36% 30% at 68% 64%,${rgba(sc, 0.12)},transparent 70%),radial-gradient(ellipse 30% 26% at 22% 76%,${rgba(S.color, 0.08)},transparent 70%)`;
		const title = mk('div', 'sk-title', el);
		mk('div', 's', title, `${STRAND_NAME[S.strand]}${S.strand === 'twilight' ? ' · both strands' : ''}`);
		// (the name as large as its column allows: thin capitals, widely spaced)
		mk('h2', '', title, S.name).style.fontSize = `min(var(--tf), calc(var(--tw) / ${(S.name.length * 0.86 + 0.4).toFixed(2)}))`;
		const rk = mk('div', 'rk', title, `<span>Rank</span><b>0</b><div class="bar"><i></i></div>`);
		mk('p', '', title, S.line);
		const cons = mk('div', 'sk-cons', el);
		const svg = svgEl('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, cons);
		svgEl('path', { d: L.fig, class: 'sk-fig', stroke: S.color }, svg);
		const nodes = nodesOf.get(k), at = new Map(nodes.map((n) => [n.id, n.at]));
		const links = pageLinks(k).map(([a, b]) => {
			const [x1, y1] = at.get(a), [x2, y2] = at.get(b);
			const g = svgEl('line', { x1, y1, x2, y2, class: 'sk-ln glow', stroke: S.color }, svg);
			const l = svgEl('line', { x1, y1, x2, y2, class: 'sk-ln far', stroke: S.color }, svg);
			return { a, b, l, g, was: '', dx: x2 - x1, dy: y2 - y1 };
		});
		const stars = nodes.map((n, j) => {
			const b = mk('button', 'sk-n ' + n.kind + (n.kind === 'spell' && isUltimate(n.item) ? ' ult' : ''), cons, `<span class="pr"></span><span class="o"></span>${n.kind === 'spell' ? '<span class="mp"></span>' : ''}${n.kind === 'spell' && isUltimate(n.item) ? '<span class="bh"><i></i></span>' : `<span class="g">${txt(n.item.glyph)}</span>`}<span class="lb">${n.item.name}</span>`);
			b.type = 'button';
			b.style.left = n.at[0] + '%'; b.style.top = n.at[1] + '%';
			b.style.setProperty('--i', j); b.style.setProperty('--d', `${(j * 0.7) % 5}s`);
			b.addEventListener('click', () => { if (!dragged) select(n.id, true); });
			b.addEventListener('dblclick', () => { select(n.id, true); act(); });
			return { n, b, was: '' };
		});
		return { k, el, rk, links, stars };
	}

	// ---------- layout ----------
	function layout() {
		if (!root) return;
		const r = mount.getBoundingClientRect();
		W = r.width; H = r.height;
		const tall = W < H * 1.05 && W < 820, short = H < 520;
		mode = tall ? 'tall' : 'wide';
		root.classList.toggle('tall', tall); root.classList.toggle('wide', !tall); root.classList.toggle('short', short);
		const hh = short || tall ? 52 : 60, nh = short || tall ? 38 : 44;
		const v = { '--hh': hh + 'px', '--nh': nh + 'px' };
		const stageH = H - hh - nh;
		let cs, cw, ch, cl, ct, tl, tt, tw, tf, ns, lf, ih = 0, iw = 0, pw = W;
		if (tall) {
			// (a phone held upright: the constellation is drawn taller than wide, the sheet below)
			ih = Math.round(Math.min(Math.max(H * 0.3, 205), 270));
			const titleH = 62, room = stageH - ih - titleH - 26;
			cw = W - 36; ch = Math.max(220, Math.min(room, cw * 1.5));
			cs = Math.min(cw, ch);
			cl = 18; ct = titleH + 8 + Math.max(0, (room - ch) / 2);
			tl = 18; tt = 4; tw = W - 36; tf = '23px';
		} else {
			iw = W >= 1200 ? 380 : W >= 900 ? 340 : 300;
			const col = W >= 1180 ? 270 : short ? 180 : 0;
			pw = W;
			const area = W - iw - 32 - col - 24;
			const titleH = col ? 0 : 92;
			cs = cw = ch = Math.max(200, Math.min(area - 40, stageH - titleH - 40));
			cl = col + 24 + (area - cs) / 2; ct = titleH + 12 + Math.max(0, (stageH - titleH - 24 - cs) / 2);
			tl = 28; tt = col ? 20 : 12; tw = col ? col - 20 : area; tf = W >= 1180 ? '40px' : short ? '22px' : '32px';
			if (col && short) tf = '20px';
		}
		ns = Math.round(Math.max(34, Math.min(52, cs * 0.085)));
		lf = cs < 320 ? '9.5px' : cs < 480 ? '10.5px' : '11.5px';
		Object.assign(v, { '--cw': cw + 'px', '--ch': ch + 'px', '--cl': cl + 'px', '--ct': ct + 'px', '--tl': tl + 'px', '--tt': tt + 'px', '--tw': tw + 'px', '--tf': tf, '--ns': ns + 'px', '--ns0': ns + 'px', '--lf': lf, '--ih': ih + 'px', '--iw': iw + 'px' });
		for (const k in v) root.style.setProperty(k, v[k]);
		P.pageW = pw;
		for (const [j, p] of P.pages.entries()) {
			p.el.style.width = pw + 'px';
			seat(j);
			// (a line's length on screen, for drawing it in when it is first lit)
			for (const L of p.links) L.l.style.setProperty('--len', `${Math.hypot(L.dx * cw / 100, L.dy * ch / 100).toFixed(1)}px`);
		}
		P.arr[1].style.left = `${(tall ? W : W - iw - 32) - 52}px`;
		place(false);
		sizeSky();
	}

	// ---------- the pages: where the track sits, and sliding ----------
	// Where each page is seated along the track: its own place, or, for the length of a leap over
	// several pages (a chip, Home, End), the seat next to the page it leaves. So every turn slides
	// one screen's width, and only the page in view and the one coming in are shown at all. (The
	// track used to be fourteen screens wide, and a slide across it had the compositor back the
	// whole sweep at once: an iPhone, its graphics memory already spoken for by the world, died
	// on the second turn.)
	let dx = 0, dragging = false, dragged = false, settleT = 0, turns = 0;
	const seats = PAGES.map((_, j) => j);
	function seat(j) { P.pages[j].el.style.left = `${seats[j] * P.pageW}px`; }
	function shown(...js) { for (const [j, p] of P.pages.entries()) p.el.hidden = !js.includes(j); }
	function place(glide) {
		P.track.classList.toggle('glide', !!glide);
		const edge = (page === 0 && dx > 0) || (page === PAGES.length - 1 && dx < 0);
		P.track.style.transform = `translate3d(${-seats[page] * P.pageW + (edge ? dx * 0.35 : dx)}px,0,0)`;
	}
	// the slide over: every page back in its own seat, the track on the page in view with no
	// transition (the page and the track move by the same amount, so nothing shifts on screen)
	function settle() {
		clearTimeout(settleT); settleT = 0;
		for (const j of PAGES.keys()) if (seats[j] !== j) { seats[j] = j; seat(j); }
		shown(page);
		place(false);
	}
	// the neighbour a drag is uncovering, shown beside the page
	function uncover() {
		const j = page + (dx < 0 ? 1 : -1);
		if (j >= 0 && j < PAGES.length) shown(page, j); else shown(page);
	}
	function go(i, o = {}) {
		i = Math.max(0, Math.min(PAGES.length - 1, i));
		const from = page, changed = i !== page, wasDx = dx;
		page = i; dx = 0;
		if (changed && from >= 0) turns += Math.sign(i - from);
		if (o.glide !== false && (changed || wasDx)) {
			clearTimeout(settleT);
			if (changed && from >= 0) {
				const d = i - seats[from];
				if (Math.abs(d) !== 1) { seats[i] = seats[from] + Math.sign(d || i - from); seat(i); } else if (seats[i] !== i) { seats[i] = i; seat(i); }
				shown(from, i);
			} else if (changed) shown(i);
			// (a drag let go short of the next page glides back, its neighbour still in view)
			place(true);
			settleT = setTimeout(settle, 620);
		} else settle();
		if (changed || o.force) {
			for (const [j, p] of P.pages.entries()) p.el.classList.toggle('cur', j === page);
			const p = P.pages[page];
			p.el.classList.remove('enter'); void p.el.offsetWidth; p.el.classList.add('enter');
			clearTimeout(p.enterT); p.enterT = setTimeout(() => p.el.classList.remove('enter'), 1100);
			const k = PAGES[page];
			root.style.setProperty('--pc', SKILL[k].color);
			select(lastSel[k] || bestNode(k), false);
			if (changed) sound(k, 0.05);
		}
		for (const [j, c] of P.chips.entries()) c.classList.toggle('cur', j === page);
		P.chips[page].scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: o.glide === false ? 'auto' : 'smooth' });
		P.arr[0].hidden = page === 0; P.arr[1].hidden = page === PAGES.length - 1;
	}
	// the star to show first on a page: one you can take now, else the newest you hold, else the first
	function bestNode(k) {
		const ns = nodesOf.get(k);
		return (ns.find((n) => stateOf(n) === 'can') || [...ns].reverse().find((n) => holds(state, n.id)) || ns[0]).id;
	}
	function swipe() {
		let x0 = 0, y0 = 0, id = null, lastX = 0, lastT = 0, v = 0, decided = false, side = 0;
		P.stage.addEventListener('pointerdown', (e) => {
			if (e.button > 0 || id !== null) return;
			id = e.pointerId; x0 = lastX = e.clientX; y0 = e.clientY; lastT = performance.now(); v = 0;
			dragging = false; dragged = false; decided = false; side = 0;
		});
		P.stage.addEventListener('pointermove', (e) => {
			if (e.pointerId !== id) return;
			const ddx = e.clientX - x0, ddy = e.clientY - y0;
			if (!decided && Math.hypot(ddx, ddy) > 8) {
				decided = true;
				if (Math.abs(ddx) > Math.abs(ddy)) {
					dragging = dragged = true;
					// (a drag that catches a slide still settling ends it, so the pages sit where the drag expects them)
					if (settleT) settle();
					try { P.stage.setPointerCapture(id); } catch { /* gone */ }
				}
			}
			if (!dragging) return;
			const now = performance.now();
			v = (e.clientX - lastX) / Math.max(1, now - lastT) * 0.6 + v * 0.4;
			lastX = e.clientX; lastT = now;
			dx = ddx;
			// (the page the drag uncovers is shown as the drag begins, and again if it turns about)
			const s = dx < 0 ? 1 : -1;
			if (s !== side) { side = s; uncover(); }
			place(false);
		});
		const end = (e) => {
			if (e.pointerId !== id) return;
			id = null;
			if (!dragging) return;
			dragging = false;
			const w = P.pageW || W;
			let to = page;
			if (dx < -w * 0.18 || v < -0.45) to = page + 1;
			else if (dx > w * 0.18 || v > 0.45) to = page - 1;
			// (go clears dx: a drag let go short of a page glides back from where it was)
			go(to);
			// (a drag is not a tap on the star it began on)
			setTimeout(() => { dragged = false; }, 0);
		};
		P.stage.addEventListener('pointerup', end);
		P.stage.addEventListener('pointercancel', end);
	}
	let wheelAcc = 0, wheelLock = 0;
	function onWheel(e) {
		e.preventDefault();
		const now = performance.now();
		if (now < wheelLock) return;
		const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		wheelAcc += d * (e.deltaMode === 1 ? 30 : 1);
		if (Math.abs(wheelAcc) > 60) { go(page + Math.sign(wheelAcc)); wheelAcc = 0; wheelLock = now + 420; }
	}

	// ---------- the state of each star ----------
	function stateOf(n) {
		if (holds(state, n.id)) return 'own';
		const parentOk = !n.parents.length || n.parents.some((p) => holds(state, p));
		if (!parentOk) return 'far';
		const why = n.kind === 'spell' ? spellBlock(state, n.item) : perkBlock(state, n.id);
		return why ? 'near' : 'can';
	}
	let shownSig = '';
	function refresh(fresh = []) {
		if (!built) return;
		for (const p of P.pages) {
			let can = false;
			for (const s of p.stars) {
				const st = stateOf(s.n);
				if (st === 'can') can = true;
				if (st !== s.was) {
					s.b.classList.remove('own', 'can', 'near', 'far'); s.b.classList.add(st);
					s.b.setAttribute('aria-label', `${s.n.item.name}, ${s.n.kind}, ${{ own: s.n.kind === 'spell' ? 'known' : 'unlocked', can: 'ready to ' + (s.n.kind === 'spell' ? 'weave' : 'unlock'), near: 'locked', far: 'out of reach' }[st]}`);
					s.was = st;
				}
				if (s.n.kind === 'spell') {
					const mp = s.b.querySelector('.mp'), L = st === 'own' ? masteryLevel(state.mastery?.[s.n.id] || 0) : 1;
					mp.classList.toggle('on', L > 1); mp.textContent = NUMERAL[L - 1];
				}
				if (fresh.includes(s.n.id)) { s.b.classList.remove('pop'); void s.b.offsetWidth; s.b.classList.add('pop'); setTimeout(() => s.b.classList.remove('pop'), 950); }
			}
			for (const L of p.links) {
				const a = holds(state, L.a), b = holds(state, L.b);
				const st = a && b ? 'own' : a ? (stateOf(p.stars.find((s) => s.n.id === L.b).n) === 'can' ? 'can' : 'near') : 'far';
				if (st !== L.was) {
					L.l.setAttribute('class', `sk-ln ${st}${st === 'own' && L.was && fresh.includes(L.b) ? ' grow' : ''}`);
					L.g.style.display = st === 'own' ? '' : 'none';
					L.was = st;
				}
			}
			const k = p.k, use = state.use[k] || 0, rank = rankOf(use);
			p.rk.querySelector('b').textContent = rank;
			p.rk.querySelector('i').style.transform = `scaleX(${rank >= RANK_MAX ? 1 : rankFrac(use)})`;
			p.rk.title = rank >= RANK_MAX ? 'The highest rank' : `${Math.floor(use)} / ${useFor(rank + 1)} toward rank ${rank + 1}`;
			P.chips[PAGES.indexOf(k)].classList.toggle('can', can);
		}
		// the header
		const need = xpNeed(state.level), f = Math.min(1, state.xp / need), C = 2 * Math.PI * 18;
		P.head.arc.setAttribute('stroke-dashoffset', `${C * (1 - f)}`);
		P.head.lvl.textContent = state.level;
		P.head.xp.textContent = `${Math.floor(state.xp)} / ${need} to level ${state.level + 1}`;
		const pts = pointsOf(state);
		P.head.pts.className = 'sk-pts ' + (pts ? 'has' : 'none');
		P.head.pts.innerHTML = `<i>${pts}</i><span class="w">${pts === 1 ? 'skill point' : 'skill points'}</span>${mode === 'tall' ? (pts === 1 ? 'point' : 'points') : ''}`;
		P.head.pts.title = 'You earn a skill point each level. Spend them on perks (the diamonds).';
		fabric();
		shownSig = sig();
		info();
	}
	function fabric() {
		P.head.fab.innerHTML = `<span class="l" title="Light aether: weaves light spells and feeds them">☀ ${state.fabric.light}</span><span class="d" title="Dark aether: weaves dark spells and feeds them">☾ ${state.fabric.dark}</span><span class="m" title="Mana">✧ <b>${Math.round(state.mana)}</b>/${manaMax(state)}</span>`;
	}
	// (what, changed, means drawing it all again: not the mana, which only its number shows)
	const sig = () => `${state.known.length}|${state.perks.length}|${state.level}|${Math.floor(state.xp)}|${state.fabric.light}|${state.fabric.dark}|${state.binds.join()}|${PAGES.map((k) => rankOf(state.use[k] || 0)).join()}|${Object.values(state.mastery || {}).map(masteryLevel).join('')}|${(state.gear || []).map((x) => `${x.u}:${x.l}`).join()}`;

	// ---------- choosing a star, and what it does ----------
	function select(id, sticky) {
		sel = id;
		lastSel[PAGES[page]] = id;
		for (const p of P.pages) for (const s of p.stars) s.b.classList.toggle('sel', s.n.id === id && p === P.pages[page]);
		info();
		if (sticky) sound(PAGES[page], 0.03);
	}
	function node(id) { return nodesOf.get(PAGES[page]).find((n) => n.id === id); }
	function info() {
		const n = node(sel);
		if (!n || !P.info) return;
		const k = PAGES[page], S = SKILL[k], el = P.info, st = stateOf(n);
		colours(el, S.color);
		el.innerHTML = '';
		// (on a phone held upright the sheet is short; its handle, or a swipe up, opens it fully)
		const grab = mk('div', 'sk-grab', el, '<i></i>');
		grab.setAttribute('role', 'button'); grab.setAttribute('aria-label', 'Show more');
		let gy = null, swiped = false;
		grab.addEventListener('click', () => { if (swiped) { swiped = false; return; } el.classList.toggle('full'); });
		grab.addEventListener('pointerdown', (e) => { gy = e.clientY; swiped = false; });
		grab.addEventListener('pointerup', (e) => { if (gy != null && Math.abs(e.clientY - gy) > 20) { el.classList.toggle('full', e.clientY < gy); swiped = true; } gy = null; });
		const sc = mk('div', 'scroll', el);
		const hd = mk('div', 'hd', sc);
		mk('div', `sk-med ${n.kind}${st === 'own' ? ' own' : ''}`, hd, txt(n.item.glyph));
		const ht = mk('div', '', hd);
		mk('h3', '', ht, n.item.name);
		mk('div', 'ty', ht, n.kind === 'spell' ? isUltimate(n.item) ? `Ultimate spell · ${KIND_WORD[n.item.kind] || n.item.kind}` : `Tier ${n.item.tier} spell · ${KIND_WORD[n.item.kind] || n.item.kind}` : (n.item.rank ? `Perk · ${S.name} rank ${n.item.rank}` : `Perk · ${S.name}`));
		mk('p', 'desc', sc, n.item.desc);
		const act = mk('div', 'sk-act', el);
		if (n.kind === 'spell') spellInfo(sc, act, n.item, st);
		else perkInfo(sc, act, n.item, st);
	}
	function spellInfo(sc, act, sp, st) {
		// (the one preview canvas, seated here; a perk's sheet leaves it out)
		sc.appendChild(P.pv);
		const k = spellPower(state, sp, { light: light() }), s2 = shaped(sp, state.mods);
		// (the preview shows it as your gear has it: a fan of sparks, a shard through everyone)
		P.pv.spell = s2;
		if (st === 'own') mastery(sc, sp);
		const stats = mk('div', 'sk-stats', sc);
		const row = (label, val, base, wide) => { const d = mk('div', 'sk-st' + (wide ? ' w' : ''), stats); mk('span', '', d, label); const b = mk('b', '', d); b.innerHTML = base != null && base !== val ? `<s>${base}</s><span class="up">${val}</span>` : val; };
		const type = sp.type ? ` ${DMG_WORD[sp.type] || ''}` : '';
		if (sp.dmg && s2.split > 1) row('Harm', `${s2.split} × ${Math.round(sp.dmg * (s2.dmgK || 1) * k)}${type}`, `${Math.round(sp.dmg * k)}`);
		else if (sp.dmg) row(sp.kind === 'chain' ? 'Harm, first' : sp.kind === 'orb' || sp.kind === 'storm' ? 'Harm a strike' : 'Harm', `${Math.round(sp.dmg * k)}${type}`);
		if (sp.dps) row('Harm a second', `${Math.round(sp.dps * k)}${type}`);
		if (sp.heal && sp.kind === 'heal') row('Heals', `${Math.round(sp.heal * k)}`);
		if (sp.heal && sp.kind === 'hot') row('Heals in all', `${Math.round(sp.heal * k)}`);
		if (sp.heal && sp.kind === 'zone') row('Heals a second', `${r1(sp.heal * k)}`);
		if (sp.absorb) row('Absorbs', sp.absorb > 1e5 ? 'Everything' : `${Math.round(sp.absorb * k)}`);
		const mc = manaCost(state, sp), cd = cooldownOf(state, sp);
		row('Mana', `${mc || 'None'}`, sp.mana !== mc ? sp.mana : null);
		row('Cooldown', sec(cd), cd !== sp.cd ? sec(sp.cd) : null);
		if (sp.range) row('Reach', `${Math.round(s2.range)} m`, s2.range !== sp.range ? `${Math.round(sp.range)} m` : null);
		if (sp.r) row('Radius', `${r1(s2.r)} m`, s2.r !== sp.r ? `${r1(sp.r)} m` : null);
		if (sp.t) row('Lasts', sec(s2.t), s2.t !== sp.t ? sec(sp.t) : null);
		if (sp.bossCut) row('Bosses lose', `${Math.round(sp.bossCut * 100)}% of their life`);
		if (s2.jumps) row('Leaps', `${s2.jumps} more foes`, sp.jumps !== s2.jumps ? `${sp.jumps || 0}` : null);
		// (what your gear's alteration adds: magic/caster.js does it)
		if (s2.n > 1 && s2.n !== sp.n) row('Calls', `${s2.n}`, `${sp.n || 1}`);
		if (s2.renew) row('Heals after', `${Math.round(sp.heal * k * s2.renew)} over ${sec(s2.renewT)}`);
		if (s2.aura) row('Radiant aura', `${Math.round(s2.aura.dps * k)} a second for ${sec(s2.aura.t)}`);
		if (s2.burn) row('Burning ground', `${Math.round(s2.burn.dps * k)} fire a second for ${sec(s2.burn.t)}`, null, true);
		if (s2.pierce === 'all') row('Passes through', 'Everyone in its path');
		if (s2.cloakAfter) row('Cloaked after', sec(s2.cloakAfter));
		if (s2.waterWalk) row('Water', 'Walk across it');
		if (s2.recallHeal) row('On return', `Heals ${Math.round(s2.recallHeal * 100)}% of your wounds`);
		if (sp.speedK) row('Pace', `+${Math.round((sp.speedK - 1) * 100)}%`);
		const S1 = s2.status || {}, S0 = sp.status || {};
		if (sp.status || s2.status) {
			const bits = [];
			if (S0.hold) bits.push(`holds ${sec(S1.hold)}`);
			if (S0.fear) bits.push(`frightens ${sec(S1.fear)}`);
			if (S0.slow) bits.push(`slows to ${Math.round(S0.slow * 100)}% pace`);
			if (S0.dot) bits.push(`rots ${Math.round(S0.dot * k)} a second for ${sec(S1.t)}`);
			if (S1.spread) bits.push('spreads when its victim falls');
			if (bits.length) row('On those struck', bits.join(', '), null, true);
		}
		// what its element leaves on the one struck (magic/elements.js; bosses take only the harm and
		// the dread)
		const E = elements[sp.type];
		if (E) {
			const blow = sp.dmg ? sp.dmg * (s2.dmgK || 1) * k : 0, n = (v) => Math.round(blow * v);
			const nums = [];
			if (E.share) nums.push(blow ? `${n(E.share)} ${sp.type === 'blight' ? 'rot' : 'burn'} over ${sec(E.t)}` : `${Math.round(E.share * 100)}% of each blow again over ${sec(E.t)}`);
			if (E.echo) nums.push(blow ? `${n(E.echo)} again after ${sec(E.delay)}` : `${Math.round(E.echo * 100)}% of each blow again`);
			if (E.leap) nums.push(blow ? `${n(E.leap)} leaps to a foe within ${E.r} m` : `${Math.round(E.leap * 100)}% leaps within ${E.r} m`);
			if (E.vuln) nums.push(`+${Math.round(E.vuln * 100)}% from you for ${sec(E.t)}`);
			if (E.slow) nums.push(`${Math.round(E.slow * 100)}% pace for ${sec(E.t)}, frozen on the ${E.freeze === 3 ? 'third' : `${E.freeze}th`}`);
			if (E.stun) nums.push(`jolted ${E.stun} s`);
			const firm = E.slow ? ' Bosses are never slowed or frozen.' : E.stun ? ' Bosses are never jolted.' : '';
			mk('div', `sk-el el-${sp.type}`, sc, `<i>${E.glyph}</i><div><b>${E.name}</b><span>${E.text}${firm}</span>${nums.length ? `<em>${blow ? 'Yours: ' : ''}${nums.join(' · ')}</em>` : ''}</div>`);
		}
		const strand = strandOf(sp);
		// what your gear does to it, then where its strength comes from
		const alt = alteredBy(state, sp);
		if (alt) mk('div', 'sk-alt', sc, `<b>${alt.item}</b><span>${alt.desc}</span>`);
		const src = powerSources(state, sp);
		if (src.length) {
			const d = mk('div', 'sk-src', sc);
			for (const q of src) mk('span', q.kind, d, `<b>${q.n < 0 ? '−' : '+'}${Math.abs(Math.round(q.n * 100))}%</b> ${q.label}`);
		}
		mk('div', 'sk-now', sc, `Power now ×${(Math.round(k * 100) / 100).toFixed(2)}: ${strand === 'light' ? 'light spells are stronger by day' : strand === 'dark' ? 'dark spells are stronger by night' : 'twilight spells are strongest at dusk and dawn'}, and with your affinity${src.length ? `, ${src.map((q) => q.kind === 'gear' ? 'gear' : q.kind === 'perk' ? 'perks' : q.kind === 'attr' ? 'Potency' : q.kind === 'steel' ? 'less for the steel you wear' : 'mastery').filter((w, i, a) => a.indexOf(w) === i).join(', ')}` : ''}.`);
		// what it takes
		if (st !== 'own') {
			const req = mk('ul', 'sk-req', sc);
			const li = (ok, text) => mk('li', ok ? 'ok' : 'no', req, `<i>${ok ? '✓' : '✕'}</i><span>${text}</span>`);
			if (sp.tier > 1) {
				const below = nodesOf.get(sp.school).filter((q) => q.kind === 'spell' && q.item.tier === sp.tier - 1);
				li(below.some((q) => holds(state, q.id)), `Know ${below.map((q) => q.item.name).join(' or ')}`);
			}
			if (isUltimate(sp)) {
				const r = rankOf(state.use[sp.school] || 0);
				li(r >= ULTIMATE_RANK, `${SKILL[sp.school].name} rank ${ULTIMATE_RANK}: mastery (yours is ${r})`);
			}
			if (strand === 'twilight') {
				const need = TWILIGHT_NEEDS[sp.tier - 1];
				li(state.affinity.light >= need && state.affinity.dark >= need, `${need} affinity with each strand (you have ${state.affinity.light} light, ${state.affinity.dark} dark)`);
			}
			const c = weaveCost(sp);
			if (c.light) li(state.fabric.light >= c.light, `☀ ${c.light} light fabric (you have ${state.fabric.light})`);
			if (c.dark) li(state.fabric.dark >= c.dark, `☾ ${c.dark} dark fabric (you have ${state.fabric.dark})`);
		}
		// what you can do with it
		if (st === 'own') {
			const g = mk('div', 'sk-slots', act);
			mk('span', '', g, 'Slot to key');
			for (let i = 0; i < SLOTS; i++) {
				const on = state.binds[i] === sp.id, b = mk('button', on ? 'on' : '', g, `${KEYS[i]}<em>${txt(SPELL[state.binds[i]]?.glyph) || '·'}</em>`);
				b.type = 'button'; b.title = on ? `On ${KEYS[i]}: tap to clear` : `Put on ${KEYS[i]}${state.binds[i] ? ` (now ${SPELL[state.binds[i]].name})` : ''}`;
				b.addEventListener('click', () => slot(i));
			}
		} else {
			const why = spellBlock(state, sp), c = weaveCost(sp);
			const b = mk('button', 'sk-go', act, why ? why : `Weave · ${[c.light && `☀ ${c.light}`, c.dark && `☾ ${c.dark}`].filter(Boolean).join(' + ')}`);
			b.type = 'button'; b.disabled = !!why;
			b.addEventListener('click', act_);
		}
	}
	// a spell's mastery: its level, the way to the next, what its levels open, and the aether you
	// can pour into it (held: it keeps pouring, faster as it goes)
	function mastery(sc, sp) {
		const S = SKILL[sp.school], box = mk('div', 'sk-ms', sc);
		const top = mk('div', 'top', box);
		mk('span', '', top, 'Mastery');
		const lv = mk('b', '', top), nx = mk('em', '', top);
		const seg = mk('div', 'seg', box), bars = [];
		for (let i = 1; i < MASTERY.length; i++) bars.push(mk('i', '', mk('div', '', seg)));
		const lvs = mk('div', 'lv', box), marks = [];
		for (let i = 1; i < MASTERY.length; i++) marks.push(mk('span', '', lvs, NUMERAL[i]));
		const ul = mk('ul', '', box);
		const pw = mk('li', 'on', ul);
		const gifts = Object.entries(MASTERY_GIFT[sp.id] || {}).map(([at, g]) => ({ at: +at, li: mk('li', '', ul, `<i>${NUMERAL[at - 1]}</i><span><b>${g.name}.</b> ${g.text}</span>`) }));
		const c1 = feedCost(sp, 1), word = c1.light && c1.dark ? '☀☾ light and dark' : c1.light ? '☀ light' : '☾ dark';
		const btn = mk('button', 'sk-feed', box, '<span></span>');
		btn.type = 'button';
		mk('small', '', box, `Hold to pour. Casting it adds mastery too.`);
		function show() {
			const pts = state.mastery?.[sp.id] || 0, L = masteryLevel(pts), top = L >= MASTERY.length;
			lv.textContent = NUMERAL[L - 1];
			nx.textContent = top ? 'Mastered' : `${pts} / ${MASTERY[L]} to ${NUMERAL[L]}`;
			bars.forEach((b, i) => { const a = MASTERY[i], z = MASTERY[i + 1]; b.style.transform = `scaleX(${Math.max(0, Math.min(1, (pts - a) / (z - a)))})`; });
			marks.forEach((m, i) => m.classList.toggle('on', L >= i + 2));
			pw.innerHTML = `<i>+${Math.round((L - 1) * MASTERY_POWER * 100)}%</i><span>power on ${sp.name} (each level adds ${Math.round(MASTERY_POWER * 100)}%)</span>`;
			for (const g of gifts) g.li.classList.toggle('on', L >= g.at);
			const can = feedable(state, sp.id, 1);
			btn.disabled = top || !can;
			btn.firstChild.textContent = top ? 'Fully mastered' : can ? `Pour ${word} aether · ${masteryToNext(pts)} to ${NUMERAL[L]}` : `No ${word} aether to pour`;
		}
		show();
		let t = 0, n = 0, rose = false;
		function pour() {
			const step = Math.min(20, 2 + n);
			n++;
			const r = onFeed(sp.id, step);
			if (!r?.fed) { stop(); return; }
			fabric(); show(); shownSig = sig();
			if (n % 3 === 1) sound(sp.school, 0.025);
			if (r.levels) {
				rose = true;
				const L = masteryLevel(state.mastery[sp.id]), g = MASTERY_GIFT[sp.id]?.[L];
				toast(`${sp.name}: mastery ${NUMERAL[L - 1]}${g ? ` · ${g.name}` : ''}`, S.color);
				box.classList.remove('up'); void box.offsetWidth; box.classList.add('up');
				sound('level', 0.1);
			}
		}
		function stop() {
			if (!t && !btn.classList.contains('on')) return;
			clearInterval(t); t = 0; n = 0;
			btn.classList.remove('on');
			if (rose) { rose = false; refresh([sp.id]); }
		}
		btn.addEventListener('pointerdown', (e) => {
			if (btn.disabled || e.button > 0) return;
			e.preventDefault(); btn.setPointerCapture?.(e.pointerId);
			btn.classList.add('on'); pour();
			t = setInterval(pour, 90);
		});
		for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, stop);
		// (from the keyboard: a measure at a press)
		btn.addEventListener('click', (e) => { if (e.detail === 0 && !btn.disabled) { btn.classList.add('on'); n = 10; pour(); stop(); } });
	}
	function perkInfo(sc, act, p, st) {
		const ul = mk('ul', 'sk-fx', sc);
		for (const line of fxLines(p)) mk('li', '', ul, line);
		// on your own spells: before and after
		const cmp = compare(p);
		if (cmp) mk('div', 'sk-cmp', sc, cmp);
		if (st !== 'own') {
			const req = mk('ul', 'sk-req', sc);
			const li = (ok, text) => mk('li', ok ? 'ok' : 'no', req, `<i>${ok ? '✓' : '✕'}</i><span>${text}</span>`);
			if (p.parent != null) {
				const ps = [].concat(p.parent);
				li(ps.some((q) => holds(state, q)), `${SPELL[ps[0]] ? 'Know' : 'Unlock'} ${ps.map((q) => SPELL[q]?.name || PERK[q]?.name).join(' or ')}`);
			}
			const r = rankOf(state.use[p.page] || 0);
			if (p.rank) li(r >= p.rank, `${SKILL[p.page].name} rank ${p.rank} (yours is ${r}; it rises as you ${p.page === 'marksman' ? 'hit with your weapons' : p.page === 'athletics' ? 'cover ground on foot' : p.page === 'resilience' ? 'take harm and live' : 'cast its spells'})`);
			li(pointsOf(state) > 0, `1 skill point (you have ${pointsOf(state)}; one comes with every level)`);
		}
		const why = st === 'own' ? null : perkBlock(state, p.id);
		const b = mk('button', 'sk-go' + (st === 'own' ? ' done' : ''), act, st === 'own' ? '✓ Unlocked' : why || 'Unlock · 1 skill point');
		b.type = 'button'; b.disabled = st === 'own' || !!why;
		b.addEventListener('click', act_);
	}
	// a perk's effect on the first spell of its school you know (or its first spell): "X → Y"
	function compare(p) {
		const fx = p.fx.filter(([stat]) => ['power', 'mana', 'cd', 'dur', 'area', 'range'].includes(stat));
		if (!fx.length) return '';
		const scopes = fx.map(([, , sc]) => sc || p.page);
		const pool = Object.values(SPELL).filter((sp) => scopes.some((sc) => sc === 'all' || sc === sp.school || sc === strandOf(sp)));
		const sp = pool.find((q) => state.known.includes(q.id)) || pool[0];
		if (!sp) return '';
		// (with your attributes and gear as they are: magic/stats.js)
		const others = state.perks.filter((id) => id !== p.id), now = composeMods(state, others), then = composeMods(state, [...others, p.id]);
		const out = [];
		const with_ = (mods, f) => { const was = state.mods; state.mods = mods; try { return f(); } finally { state.mods = was; } };
		for (const [stat] of fx) {
			if (stat === 'power' && (sp.dmg || sp.dps || sp.heal || sp.absorb)) {
				const base = sp.dmg || sp.dps || sp.heal || sp.absorb, a = with_(now, () => spellPower(state, sp, { light: light() })), b = with_(then, () => spellPower(state, sp, { light: light() }));
				out.push(`${sp.dmg || sp.dps ? 'harm' : sp.absorb ? 'ward' : 'healing'} ${Math.round(base * a)} → <b>${Math.round(base * b)}</b>`);
			}
			if (stat === 'mana') out.push(`mana ${with_(now, () => manaCost(state, sp))} → <b>${with_(then, () => manaCost(state, sp))}</b>`);
			if (stat === 'cd') out.push(`cooldown ${sec(with_(now, () => cooldownOf(state, sp)))} → <b>${sec(with_(then, () => cooldownOf(state, sp)))}</b>`);
			if (stat === 'dur' && sp.t) out.push(`lasts ${sec(shaped(sp, now).t)} → <b>${sec(shaped(sp, then).t)}</b>`);
			if (stat === 'area' && (sp.r || sp.splash)) out.push(`radius ${r1(shaped(sp, now).r || shaped(sp, now).splash)} m → <b>${r1(shaped(sp, then).r || shaped(sp, then).splash)} m</b>`);
			if (stat === 'range' && sp.range) out.push(`reach ${Math.round(shaped(sp, now).range)} m → <b>${Math.round(shaped(sp, then).range)} m</b>`);
		}
		return out.length ? `On ${sp.name}: ${out.join(', ')}` : '';
	}

	// ---------- acting ----------
	function act_() { act(); }
	function act() {
		const n = node(sel);
		if (!n || holds(state, n.id)) return;
		const ok = n.kind === 'spell' ? onWeave(n.id) : onPerk(n.id);
		if (!ok) { sound('fizzle', 0.05); return; }
		const S = SKILL[PAGES[page]];
		P.flash.style.background = `radial-gradient(circle at 50% 50%,${rgba(S.color, 0.32)},transparent 60%)`;
		P.flash.classList.remove('go'); void P.flash.offsetWidth; P.flash.classList.add('go');
		toast(`${n.kind === 'spell' ? 'Woven' : 'Unlocked'}: ${n.item.name}`, S.color);
		refresh([n.id]);
	}
	function slot(i) {
		const n = node(sel);
		if (!n || n.kind !== 'spell' || !holds(state, n.id)) return;
		onBind(i, state.binds[i] === n.id ? null : n.id);
		toast(state.binds[i] === n.id ? `${n.item.name} on ${KEYS[i]}` : `${KEYS[i]} cleared`, SKILL[PAGES[page]].color);
		info();
	}
	let toastT = 0;
	function toast(text, c) {
		P.toast.textContent = text; P.toast.style.setProperty('--c', c);
		P.toast.classList.add('on');
		clearTimeout(toastT); toastT = setTimeout(() => P.toast.classList.remove('on'), 1800);
	}
	// the stars of the page in reading order, for the keys
	function step(d) {
		const ns = [...nodesOf.get(PAGES[page])].sort((a, b) => b.at[1] - a.at[1] || a.at[0] - b.at[0]);
		const i = ns.findIndex((n) => n.id === sel);
		select(ns[(i + d + ns.length) % ns.length].id, true);
	}

	// ---------- the keys (captured while open) ----------
	function onKey(e) {
		if (!open) return;
		if (e.metaKey || e.ctrlKey) return;
		const c = e.code;
		// (everything else is kept from the game; a key let go still reaches it)
		e.stopImmediatePropagation();
		if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
		const handled = () => e.preventDefault();
		if (c === 'Escape' || c === 'Tab' || c === 'KeyN') { handled(); close(); return; }
		if (e.repeat && !/Arrow/.test(c)) { handled(); return; }
		if (c === 'ArrowRight' || c === 'KeyD' || c === 'KeyE' || c === 'PageDown') { handled(); go(page + 1); return; }
		if (c === 'ArrowLeft' || c === 'KeyA' || c === 'KeyQ' || c === 'PageUp') { handled(); go(page - 1); return; }
		if (c === 'ArrowUp' || c === 'KeyW') { handled(); step(1); return; }
		if (c === 'ArrowDown' || c === 'KeyS') { handled(); step(-1); return; }
		if (c === 'Home') { handled(); go(0); return; }
		if (c === 'End') { handled(); go(PAGES.length - 1); return; }
		if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') { if (document.activeElement?.tagName === 'BUTTON' && root.contains(document.activeElement) && c !== 'NumpadEnter') return; handled(); act(); return; }
		const slotI = { Digit6: 0, Digit7: 1, Digit8: 2, Digit9: 3, Digit0: 4 }[c];
		if (slotI !== undefined) { handled(); slot(slotI); return; }
	}

	// ---------- the sky ----------
	let stars = [], sprite = null, raf = 0, dpr = 1, skyX = 0;
	function sizeSky() {
		dpr = Math.min(isPhone ? 1.25 : 2, devicePixelRatio || 1);
		P.sky.width = Math.round(W * dpr); P.sky.height = Math.round(H * dpr);
		const n = Math.round(Math.min(isPhone ? 140 : 260, W * H / 5200));
		let seed = 7;
		const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
		stars = [...Array(n)].map(() => ({ x: rnd(), y: rnd(), z: 0.15 + rnd() * 0.85, s: 0.4 + rnd() * rnd() * 2.2, p: rnd() * 6.28, w: 0.6 + rnd() * 1.8, c: rnd() < 0.15 ? 1 : rnd() < 0.25 ? 2 : 0 }));
		if (!sprite) {
			sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
			const g = sprite.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
			gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.7)'); gr.addColorStop(0.45, 'rgba(200,220,255,.12)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
			g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
		}
	}
	const TINT = [[255, 255, 255], [255, 226, 180], [180, 200, 255]];
	function frame(now) {
		if (!open) { raf = 0; return; }
		raf = requestAnimationFrame(frame);
		const t = now / 1000, g = P.sky.getContext('2d');
		const w = P.sky.width, h = P.sky.height;
		g.clearRect(0, 0, w, h);
		// (the stars drift with the page, the nearer ones more: one notch a turn, eased, however
		// far the turn leapt)
		skyX += (turns - skyX) * Math.min(1, (now - (frame.last || now)) * 0.007);
		frame.last = now;
		const off = (-(skyX * (P.pageW || W)) + dx) / Math.max(1, W);
		for (const s of stars) {
			const x = (((s.x + off * 0.08 * s.z + t * 0.002 * s.z) % 1) + 1) % 1 * w, y = s.y * h;
			const tw = 0.55 + 0.45 * Math.sin(t * s.w + s.p);
			const r = s.s * dpr * (0.7 + 0.5 * s.z) * 3;
			g.globalAlpha = Math.min(1, (0.25 + 0.75 * s.z) * tw);
			if (r < 2.4) { const c = TINT[s.c]; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(x, y, Math.max(1, r * 0.4), Math.max(1, r * 0.4)); } else g.drawImage(sprite, x - r, y - r, r * 2, r * 2);
		}
		g.globalAlpha = 1;
		if (P.pv && P.pv.isConnected) preview(P.pv, t);
		// (anything changed while open: fabric gathered, mana, a rank)
		if (((t * 4) | 0) !== frame.q) {
			frame.q = (t * 4) | 0;
			if (sig() !== shownSig) refresh();
			else { const m = P.head.fab.querySelector('.m b'); if (m) m.textContent = Math.round(state.mana); }
		}
	}

	// ---------- a spell at work, in small ----------
	function preview(cv, t) {
		const sp = cv.spell, cw = cv.clientWidth, ch = cv.clientHeight;
		if (!cw) return;
		const d = Math.min(isPhone ? 1.5 : 2, devicePixelRatio || 1);
		if (cv.width !== Math.round(cw * d) || cv.height !== Math.round(ch * d)) { cv.width = Math.round(cw * d); cv.height = Math.round(ch * d); }
		// (a browser out of canvas memory gives no context: the sky goes on without the preview)
		const g = cv.getContext('2d');
		if (!g) return;
		g.setTransform(d, 0, 0, d, 0, 0);
		g.clearRect(0, 0, cw, ch);
		drawSpell(g, cw, ch, sp, (t % 2.2) / 2.2, SCHOOLS[sp.school].color, t, { night: light() < -0.02, moonlit: !!state.moonlit?.includes?.(sp.id), el: elements[sp.type] });
	}

	// ---------- opening and closing ----------
	function openAt(k) {
		if (!built) build();
		if (open) { if (k) go(PAGES.indexOf(k)); return; }
		open = true;
		root.classList.add('on');
		layout();
		const i = k ? PAGES.indexOf(k) : page;
		page = -1; go(i >= 0 ? i : 0, { glide: false, force: true });
		refresh();
		// (faded in by a transition, not a frame: a slow frame does not hold it back)
		void root.offsetWidth;
		root.classList.add('vis');
		setTimeout(() => { if (open) vis = true; }, 340);
		addEventListener('keydown', onKey, true);
		addEventListener('resize', layout);
		if (document.pointerLockElement) document.exitPointerLock?.();
		if (!raf) raf = requestAnimationFrame(frame);
		sound(PAGES[page], 0.08);
	}
	function close() {
		if (!open) return;
		open = false; vis = false;
		root.classList.remove('vis');
		removeEventListener('keydown', onKey, true);
		removeEventListener('resize', layout);
		setTimeout(() => { if (!open) root.classList.remove('on'); }, 340);
	}
	return {
		open: openAt, close,
		toggle: (k) => (open ? close() : openAt(k)),
		isOpen: () => open,
		// (fully over the world: it need not be drawn)
		covering: () => open && vis,
		refresh: () => { if (open) refresh(); },
		page: () => PAGES[page],
		dispose() { close(); cancelAnimationFrame(raf); clearTimeout(settleT); root?.remove(); },
	};
}

// ---------- the small pictures of spells at work ----------
// g: the 2D context; w, h: its size; u: the moment (0 .. 1, looping); c: the school's colour
function drawSpell(g, w, h, sp, u, c, t, env = {}) {
	const [cr, cg, cb] = hexRgb(c);
	const col = (a) => `rgba(${cr},${cg},${cb},${a})`;
	const gy = h * 0.72, me = { x: w * 0.14, y: gy };
	const foes = [{ x: w * 0.7, y: gy }, { x: w * 0.8, y: gy - 6 }, { x: w * 0.88, y: gy + 4 }];
	const near = [{ x: w * 0.3, y: gy }, { x: w * 0.4, y: gy - 4 }];
	const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
	const glow = (x, y, r, a = 1) => { if (!(r > 0.5) || !(a > 0)) return; a = Math.min(1, a); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.3, col(0.8 * a)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
	const ring = (x, y, r, a, lw = 2, dash) => { g.strokeStyle = col(a); g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.ellipse(x, y, r, r * 0.38, 0, 0, 6.283); g.stroke(); g.setLineDash([]); };
	const line = (a, b, wd, al, jit = 0) => { g.strokeStyle = col(al); g.lineWidth = wd; g.beginPath(); g.moveTo(a.x, a.y); const n = jit ? 6 : 1; for (let i = 1; i <= n; i++) { const f = i / n; g.lineTo(a.x + (b.x - a.x) * f + (i < n ? (Math.random() - 0.5) * jit : 0), a.y + (b.y - a.y) * f + (i < n ? (Math.random() - 0.5) * jit : 0)); } g.stroke(); };
	const figure = (p, a = 1, hit = 0, foe = false) => {
		g.globalAlpha = a;
		g.fillStyle = foe ? `rgba(255,${120 - hit * 60},${110 - hit * 60},${0.75 + hit * 0.25})` : 'rgba(235,245,255,.9)';
		g.beginPath(); g.arc(p.x, p.y - 22, 4, 0, 6.283); g.fill();
		g.beginPath(); g.moveTo(p.x - 5, p.y); g.lineTo(p.x, p.y - 17); g.lineTo(p.x + 5, p.y); g.closePath(); g.fill();
		if (hit) { g.fillStyle = col(hit * 0.6); g.beginPath(); g.arc(p.x, p.y - 12, 12 * hit, 0, 6.283); g.fill(); }
		g.globalAlpha = 1;
	};
	const hand = { x: me.x + 7, y: me.y - 14 };
	// (the ground)
	g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, gy + 1); g.lineTo(w, gy + 1); g.stroke();
	const K = sp.kind;
	// what stays on the one struck: its status, else its element's mark (env.el: magic/elements.js),
	// with embers rising off a burn and rot
	const status = (p, a) => {
		const E = env.el, mark = sp.status ? (sp.status.hold ? '❄' : sp.status.fear ? '!' : sp.status.dot ? '☣' : sp.status.slow ? '≀' : '') : E?.glyph || '';
		if (!mark || a <= 0) return;
		g.globalAlpha = a; g.fillStyle = col(0.9); g.font = '10px system-ui'; g.textAlign = 'center'; g.fillText(mark, p.x, p.y - 32); g.globalAlpha = 1;
		if (E?.share) for (let i = 0; i < 4; i++) { const q = (t * 0.9 + i / 4) % 1; glow(p.x + Math.sin(i * 2.1 + t * 3) * 5, p.y - 8 - q * 22, 2.6 * (1 - q), a * (1 - q)); }
	};
	if (K === 'bolt' || K === 'orb') {
		const slow = K === 'orb';
		const T0 = foes[0];
		const end = sp.pierce ? foes[2] : T0;
		const travel = slow ? u * 0.95 : Math.min(1, u / 0.45);
		const x = hand.x + (end.x - hand.x) * (sp.pierce ? travel : Math.min(1, travel)), y = hand.y + (end.y - 14 - hand.y) * travel;
		const hitA = slow ? 0 : Math.max(0, 1 - (u - 0.45) / 0.3);
		figure(me);
		const fan = Math.max(1, Math.min(3, sp.split | 0));
		for (const [i, p] of foes.entries()) figure(p, 1, (i < fan || (sp.pierce && i < 3 && x > p.x)) && u > (slow ? 2 : 0.45) ? hitA : slow && Math.abs(x - p.x) < 34 ? 0.6 : 0, true);
		if (u < (slow ? 1 : 0.46) || sp.pierce && u < 0.6) {
			// (a fan: the others fly to the foes beside, a little apart)
			for (let j = 0; j < fan; j++) {
				const E = foes[j], bx = hand.x + (E.x - hand.x) * Math.min(1, travel), by = hand.y + (E.y - 14 - hand.y) * travel + (j === 1 ? -1 : j === 2 ? 1 : 0) * 12 * Math.sin(Math.PI * Math.min(1, travel));
				const px = j ? bx : x, py = j ? by : y, sz = fan > 1 ? 0.8 : 1;
				for (let i = 1; i < 6; i++) glow(px - i * 6 * (slow ? 0.3 : 1), py, (slow ? 9 : 4) * (1 - i / 7) * sz, 0.5);
				glow(px, py, (slow ? 12 : 7) * sz);
			}
			if (slow) for (const p of foes) if (Math.abs(x - p.x) < 34) line({ x, y }, { x: p.x, y: p.y - 12 }, 1.2, 0.8, 8);
		} else {
			const q = (u - 0.45) / 0.4;
			for (let j = 1; j < fan; j++) glow(foes[j].x, foes[j].y - 14, 14 * (1 - q) + 3, 1 - q);
			glow(T0.x, T0.y - 14, 18 * (1 - q) + 4, 1 - q);
			if (sp.splash) ring(T0.x, T0.y, 6 + 26 * q, 1 - q);
			status(T0, 1 - q * 0.5);
		}
		return;
	}
	if (sp.id === 'gargantua' || K === 'singularity') {
		// a black hole opens on the horizon; the foes are drawn up into it one by one and gone, and
		// the boss, too vast to swallow, bleeds a quarter of its strength (its own longer loop)
		const v = (t % 6) / 6, hx = w * 0.8, hy = gy - h * 0.3;
		const grow = ease(v / 0.12) * (1 - ease((v - 0.86) / 0.06)), Rb = Math.min(h * 0.17, w * 0.07) * grow;
		figure(me);
		// the boss: a hulk with its health bar
		const boss = { x: w * 0.36, y: gy };
		const bossHit = v > 0.15 && v < 0.86 ? 0.25 + 0.2 * Math.sin(t * 9) : 0;
		g.save(); g.translate(boss.x, boss.y); g.scale(1.9, 1.9); g.translate(-boss.x, -boss.y);
		figure(boss, 1, bossHit, true);
		g.restore();
		const lost = 0.25 * ease((v - 0.15) / 0.7), bw = 46, by = gy - 58;
		g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(boss.x - bw / 2, by, bw, 4);
		g.fillStyle = 'rgba(255,96,90,.95)'; g.fillRect(boss.x - bw / 2, by, bw * (1 - lost), 4);
		if (lost > 0.01) { g.fillStyle = col(0.9); g.fillRect(boss.x - bw / 2 + bw * (1 - lost), by, bw * lost, 4); g.font = '600 10px system-ui'; g.textAlign = 'center'; g.fillStyle = col(Math.min(1, lost * 8)); g.fillText(`−${Math.round(lost * 100)}%`, boss.x, by - 5); }
		if (Rb > 0.5) {
			// the light from round it, and the ground lit by it
			glow(hx, hy, Rb * 5, 0.22 * grow);
			const disk = (front) => {
				// the accretion disk, nearly edge on: hot white within, the Void's colour without;
				// the side turning toward you the brighter
				for (let i = 0; i < 26; i++) {
					const f = i / 25, rx = Rb * (1.5 + f * 2.2), ry = rx * 0.2;
					const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : Math.PI * 2;
					g.lineWidth = 1.6;
					for (let j = 0; j < 18; j++) {
						const a = a0 + (a1 - a0) * j / 18, b = a + (a1 - a0) / 18;
						const doppler = 0.55 + 0.45 * Math.cos(a + 0.4), shimmer = 0.75 + 0.25 * Math.sin(a * 7 - t * 5 + i);
						const al = (1 - f) * 0.5 * doppler * shimmer * grow;
						g.strokeStyle = f < 0.3 ? `rgba(255,240,225,${al})` : col(al);
						g.beginPath(); g.ellipse(hx, hy, rx, ry, -0.08, a, b); g.stroke();
					}
				}
			};
			disk(false);
			// the lensed far side of the disk, bent up over the top and under the bottom
			for (let i = 0; i < 6; i++) { g.strokeStyle = i < 2 ? `rgba(255,236,220,${0.28 * grow})` : col(0.24 * grow * (1 - i / 6)); g.lineWidth = 1.1; g.beginPath(); g.ellipse(hx, hy, Rb * (1.18 + i * 0.09), Rb * (1.1 + i * 0.08), -0.08, 0, 6.283); g.stroke(); }
			// the shadow, and the thin ring of light at its edge
			g.fillStyle = '#000'; g.beginPath(); g.arc(hx, hy, Rb, 0, 6.283); g.fill();
			g.strokeStyle = `rgba(255,250,240,${0.7 * grow})`; g.lineWidth = 0.8; g.beginPath(); g.arc(hx, hy, Rb * 1.03, 0, 6.283); g.stroke();
			disk(true);
		}
		// the foes, each drawn up and stretched into the dark in turn
		const take = [0.2, 0.36, 0.52, 0.66];
		const fs = [{ x: w * 0.5, y: gy - 2 }, { x: w * 0.58, y: gy + 3 }, { x: w * 0.47, y: gy + 4 }, { x: w * 0.64, y: gy - 3 }];
		for (const [i, p] of fs.entries()) {
			const f = (v - take[i]) / 0.16;
			if (f >= 1) continue;
			if (f <= 0) { figure(p, 1, v > 0.1 ? 0.3 : 0, true); continue; }
			const k = f * f, x = p.x + (hx - p.x) * k, y = p.y + (hy + 8 - p.y) * k;
			g.save(); g.translate(x, y); g.rotate(Math.atan2(hy - p.y, hx - p.x) * k + Math.PI / 2 * k); g.scale(Math.max(0.05, 1 - k * 0.95), 1 + k * 1.6); g.translate(-x, -y);
			figure({ x, y }, 1 - k * 0.6, 0.8, true);
			g.restore();
			for (let n = 1; n < 5; n++) glow(x - (hx - p.x) * 0.04 * n, y - (hy - p.y) * 0.04 * n, 4 * (1 - n / 6), 0.5 * k);
		}
		// dust streaming in along the ground and up into the disk
		if (Rb > 0.5) for (let i = 0; i < 16; i++) {
			const q = (t * 0.45 + i / 16) % 1, sx = w * 0.42 + (i * 53 % 100) / 100 * w * 0.3, sy = gy - (i * 29 % 7);
			const x = sx + (hx - sx) * q * q, y = sy + (hy - sy) * q * q;
			g.fillStyle = col(0.6 * (1 - q) * grow); g.fillRect(x, y, 1.6, 1.6);
		}
		// it closes with a flash
		const end = (v - 0.9) / 0.1;
		if (end > 0 && end < 1) { glow(hx, hy, 40 * (1 - end) + 6, 1 - end); ring(hx, hy, 10 + 60 * end, 1 - end, 2); }
		return;
	}
	if (sp.id === 'solar-flare') {
		// directed energy from wherever the sun stands; by night, once mastered, from the moon, and
		// before that, nothing: the sun is down
		const moon = !!env.night, can = !moon || env.moonlit;
		const c0 = { x: w * 0.7, y: gy }, R = Math.min(w * 0.13, 38), sky = { x: Math.min(w - 14, c0.x + w * 0.16), y: Math.max(11, h * 0.12) };
		g.fillStyle = moon ? 'rgba(200,215,255,.92)' : 'rgba(255,236,170,.96)';
		g.beginPath(); g.arc(sky.x, sky.y, 7.5, 0, 6.283); g.fill();
		if (moon) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(sky.x + 3, sky.y - 2, 6.5, 0, 6.283); g.fill(); g.globalCompositeOperation = 'source-over'; }
		const charge = Math.min(1, u / 0.3), fire = u > 0.3 && u < 0.55, q = (u - 0.55) / 0.45;
		glow(sky.x, sky.y, 14 + (can ? charge * 14 : 0), can ? 0.5 + charge * 0.5 : 0.25);
		figure(me);
		const fs = [{ x: c0.x - R * 0.6, y: gy + 2 }, { x: c0.x + R * 0.1, y: gy - 3 }, { x: c0.x + R * 0.7, y: gy + 3 }];
		const hit = can && u > 0.3 ? Math.max(0, 1 - (u - 0.3) / 0.5) : 0;
		for (const p of fs) figure(p, 1, hit, true);
		if (!can) {
			// the sun is down and the moon not yet mastered
			ring(c0.x, c0.y, R, 0.25 + 0.15 * Math.sin(t * 4), 1.2, [3, 5]);
			g.font = '600 10px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.55)';
			g.fillText('The sun is down. Moonfall comes at mastery III.', w * 0.42, h * 0.24);
			return;
		}
		const tint = moon ? 'rgba(215,228,255,' : 'rgba(255,244,214,';
		if (!fire && u <= 0.3) {
			// the aim marked on the ground, the light gathering above
			ring(c0.x, c0.y, R, 0.4 + 0.3 * Math.sin(t * 14), 1.5, [5, 5]);
			line(sky, { x: c0.x, y: c0.y }, 1, 0.12 * charge);
		}
		if (fire) {
			// the blast: a thick column from the sky body to the ground, white at its heart
			const f = (u - 0.3) / 0.25, wd = 14 * (1 - f * 0.5);
			g.strokeStyle = tint + (0.28 * (1 - f) + 0.1) + ')'; g.lineWidth = wd * 2.2; g.beginPath(); g.moveTo(sky.x, sky.y); g.lineTo(c0.x, c0.y - 4); g.stroke();
			g.strokeStyle = moon ? 'rgba(190,208,255,.8)' : col(0.75); g.lineWidth = wd; g.beginPath(); g.moveTo(sky.x, sky.y); g.lineTo(c0.x, c0.y - 4); g.stroke();
			g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = wd * 0.3; g.beginPath(); g.moveTo(sky.x, sky.y); g.lineTo(c0.x, c0.y - 4); g.stroke();
			glow(c0.x, c0.y - 6, R * (0.9 + f), 1);
		}
		if (q > 0) {
			glow(c0.x, c0.y - 8, R * (0.6 + q * 0.9), Math.max(0, 1 - q));
			ring(c0.x, c0.y, R * (0.4 + q * 0.9), Math.max(0, 1 - q), 3);
			// (blinded: held where they stand)
			fs.forEach((p) => status(p, 1 - q * 0.6));
		}
		return;
	}
	if (sp.id === 'lance-of-dawn' || K === 'lances') {
		// three lances fall point first from the sun (or, every other loop, the moon) onto the ground round the aim
		const c0 = { x: w * 0.68, y: gy }, R = Math.min(w * 0.16, 46);
		const moon = Math.floor(t / 2.2) % 2 === 1, sky = { x: Math.min(w - 12, c0.x + R * 0.9), y: Math.max(10, h * 0.1) };
		const spots = [{ x: c0.x - R * 0.7, y: gy + 2 }, { x: c0.x + R * 0.15, y: gy - 3 }, { x: c0.x + R * 0.8, y: gy + 3 }];
		const at = [0.18, 0.3, 0.42], fall = 0.2;
		g.fillStyle = moon ? 'rgba(200,215,255,.9)' : 'rgba(255,236,170,.95)';
		g.beginPath(); g.arc(sky.x, sky.y, 7, 0, 6.283); g.fill();
		if (moon) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(sky.x + 3, sky.y - 2, 6, 0, 6.283); g.fill(); g.globalCompositeOperation = 'source-over'; }
		glow(sky.x, sky.y, 16 + 4 * Math.sin(t * 6), u < 0.45 ? 0.7 : 0.35);
		figure(me);
		const fs = foes.map((p, i) => ({ x: c0.x + (i - 1) * R * 0.55, y: p.y }));
		const hitOf = (p) => Math.max(0, ...at.map((a, i) => (Math.abs(spots[i].x - p.x) < R * 0.9 && u > a + fall ? Math.max(0, 1 - (u - a - fall) / 0.3) : 0)));
		for (const p of fs) figure(p, 1, hitOf(p), true);
		ring(c0.x, c0.y, R * 1.3, u < 0.5 ? 0.35 + 0.2 * Math.sin(t * 12) : Math.max(0, 0.6 - (u - 0.5)), 1.5, [5, 5]);
		for (const [i, s] of spots.entries()) {
			const f = (u - at[i]) / fall;
			if (f < 0) continue;
			const dx = s.x - sky.x, dy = s.y - sky.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
			if (f < 1) {
				// the lance in flight: a bright point leading a long shaft and a fading trail
				const k = ease(f), tip = { x: sky.x + dx * k, y: sky.y + dy * k }, len = 30, back = { x: tip.x - ux * len, y: tip.y - uy * len };
				line({ x: tip.x - ux * len * 2.4, y: tip.y - uy * len * 2.4 }, back, 3, 0.18);
				g.fillStyle = col(0.95); g.beginPath();
				g.moveTo(tip.x, tip.y); g.lineTo(tip.x - ux * 9 + px * 3, tip.y - uy * 9 + py * 3); g.lineTo(back.x + px * 1.2, back.y + py * 1.2);
				g.lineTo(back.x - px * 1.2, back.y - py * 1.2); g.lineTo(tip.x - ux * 9 - px * 3, tip.y - uy * 9 - py * 3); g.closePath(); g.fill();
				glow(tip.x, tip.y, 7, 0.9);
			} else {
				// planted, point down, then burning out with a ring of light
				const q = Math.min(1, (u - at[i] - fall) / 0.35), sink = 6;
				g.globalAlpha = Math.max(0, 1 - q * 0.9);
				line({ x: s.x - ux * 30 + ux * sink, y: s.y - uy * 30 + uy * sink }, { x: s.x + ux * sink * 0.4, y: s.y + uy * sink * 0.4 }, 2.6, 0.9);
				g.globalAlpha = 1;
				glow(s.x, s.y - 6, 22 * (1 - q) + 4, 1 - q);
				ring(s.x, s.y, 6 + R * 0.7 * q, Math.max(0, 1 - q), 2.5);
			}
		}
		fs.forEach((p) => status(p, u > 0.5 ? 1 - (u - 0.5) * 1.4 : 0));
		return;
	}
	if (K === 'beam') {
		figure(me);
		const T0 = foes[0], on = u < 0.85;
		for (const [i, p] of foes.entries()) figure(p, 1, i === 0 && on ? 0.5 + 0.3 * Math.sin(t * 20) : 0, true);
		if (on) {
			line(hand, { x: T0.x, y: T0.y - 14 }, 7, 0.25); line(hand, { x: T0.x, y: T0.y - 14 }, 2.4, 0.9, 3);
			glow(T0.x, T0.y - 14, 12 + Math.sin(t * 25) * 3);
			if (sp.drain) for (let i = 0; i < 4; i++) { const f = (u * 3 + i / 4) % 1; glow(T0.x + (hand.x - T0.x) * f, T0.y - 14 + (hand.y - T0.y + 14) * f, 4, 0.8); }
		}
		return;
	}
	if (K === 'burst' || K === 'strike' || K === 'well' || K === 'cloud' || K === 'storm') {
		const c0 = { x: w * 0.76, y: gy }, R = Math.min(w * 0.17, 50);
		figure(me);
		const pull = K === 'well' ? ease(u / 0.8) * 0.6 : 0;
		const fs = foes.map((p) => ({ x: p.x + (c0.x - p.x) * pull, y: p.y }));
		const boom = K === 'cloud' || K === 'storm' ? u > 0.15 : u > (K === 'well' ? 0.8 : 0.5);
		const q = K === 'well' ? (u - 0.8) / 0.2 : (u - 0.5) / 0.5;
		for (const p of fs) figure(p, 1, boom && K !== 'cloud' && K !== 'storm' ? Math.max(0, 1 - q) : K === 'cloud' && boom ? 0.3 : 0, true);
		if (K === 'cloud') { for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 0.4; glow(c0.x + Math.cos(a) * R * 0.7 * ((i % 3) / 3 + 0.3), c0.y - 10 - Math.sin(a * 1.3) * 8, 16, 0.25 * Math.min(1, u * 4)); } fs.forEach((p) => status(p, Math.min(1, u * 3))); return; }
		if (K === 'storm') { ring(c0.x, c0.y, R, 0.4, 1.5, [4, 4]); if ((t * 6 | 0) % 2 === 0) { const p = fs[(t * 3 | 0) % 3]; line({ x: p.x + 8, y: 0 }, { x: p.x, y: p.y - 10 }, 2, 1, 10); glow(p.x, p.y - 8, 14, 0.8); } for (let i = 0; i < 14; i++) { const x = c0.x - R + ((i * 37 + t * 60) % (2 * R)), y = ((i * 23 + t * 140) % (gy - 10)); g.fillStyle = 'rgba(160,190,230,.35)'; g.fillRect(x, y, 1, 5); } return; }
		if (K === 'well') { ring(c0.x, c0.y, R * (1 - pull * 0.5), 0.6, 1.5); for (let i = 0; i < 10; i++) { const a = i * 0.63 + t * 3, r = R * (1 - ((t * 0.8 + i / 10) % 1)); glow(c0.x + Math.cos(a) * r, c0.y - 12 + Math.sin(a) * r * 0.38, 3, 0.8); } }
		if (!boom) {
			ring(c0.x, c0.y, R, 0.5 + 0.3 * Math.sin(t * 12), 1.5, [5, 5]);
			if (K === 'strike') glow(c0.x, 4, 8, 0.6);
		} else {
			if (K === 'strike') { g.fillStyle = col(0.5 * (1 - q)); g.fillRect(c0.x - 12 * (1 - q * 0.5), 0, 24 * (1 - q * 0.5), gy); glow(c0.x, gy - 10, 30, 1 - q); }
			glow(c0.x, c0.y - 10, R * (0.6 + q), Math.max(0, 1 - q));
			ring(c0.x, c0.y, R * (0.4 + q * 0.9), Math.max(0, 1 - q), 3);
			fs.forEach((p) => status(p, 1 - q * 0.5));
		}
		return;
	}
	if (K === 'nova' || K === 'aura' || K === 'zone') {
		const R = Math.min(w * 0.26, 70), q = K === 'nova' ? ease(u / 0.5) : 1;
		const pts = near.concat([{ x: w * 0.06, y: gy - 2 }]);
		const shift = { x: w * 0.36 - me.x };
		const m2 = { x: me.x + shift.x, y: me.y };
		const fs = pts.map((p, i) => ({ x: m2.x + (i === 2 ? -R * 0.6 : (i ? R * 0.75 : R * 0.45)), y: p.y }));
		const pushK = sp.push && K === 'nova' ? ease((u - 0.2) / 0.5) * 18 : 0;
		figure(m2);
		fs.forEach((p) => { p.x += Math.sign(p.x - m2.x) * pushK; figure(p, 1, K === 'nova' ? Math.max(0, 1 - Math.abs(u - 0.35) * 4) : K === 'aura' ? 0.4 + 0.2 * Math.sin(t * 10) : 0, true); });
		if (K === 'nova') { ring(m2.x, m2.y, R * q, Math.max(0, 1 - u * 1.3), 3); glow(m2.x, m2.y - 12, 26 * (1 - u), 1 - u); fs.forEach((p) => status(p, u > 0.3 ? 1 - u : 0)); }
		else if (K === 'aura') { ring(m2.x, m2.y, R * 0.8, 0.55 + 0.2 * Math.sin(t * 4), 2); for (let i = 0; i < 8; i++) { const a = i * 0.785 + t; glow(m2.x + Math.cos(a) * R * 0.8, m2.y - Math.sin(a) * R * 0.3 - (t * 20 + i * 5) % 20, 3, 0.7); } }
		else { g.fillStyle = col(0.12); g.beginPath(); g.ellipse(m2.x, m2.y, R, R * 0.38, 0, 0, 6.283); g.fill(); ring(m2.x, m2.y, R, 0.6, 1.5); for (let i = 0; i < 5; i++) { const y = m2.y - ((t * 30 + i * 9) % 40); g.fillStyle = col(1 - (m2.y - y) / 40); g.font = '10px system-ui'; g.fillText('+', m2.x - 20 + i * 10, y); } }
		return;
	}
	if (K === 'cone') {
		figure(me);
		const R = w * 0.55, a = 0.42, q = ease(u / 0.5);
		const pushK = sp.push ? q * 22 : 0;
		const fs = foes.map((p) => ({ x: p.x - w * 0.25 + pushK, y: p.y }));
		fs.forEach((p) => figure(p, 1, Math.max(0, 1 - Math.abs(u - 0.4) * 3), true));
		const gr = g.createRadialGradient(hand.x, hand.y, 0, hand.x, hand.y, R * q);
		gr.addColorStop(0, col(0.6)); gr.addColorStop(1, col(0));
		g.fillStyle = gr; g.globalAlpha = Math.max(0, 1 - u); g.beginPath(); g.moveTo(hand.x, hand.y); g.arc(hand.x, hand.y, R * q, -a, a); g.closePath(); g.fill(); g.globalAlpha = 1;
		fs.forEach((p) => status(p, u > 0.3 ? 1 : 0));
		return;
	}
	if (K === 'chain') {
		figure(me);
		const fs = [{ x: w * 0.46, y: gy }, { x: w * 0.65, y: gy - 5 }, { x: w * 0.84, y: gy + 3 }];
		const hops = [hand, ...fs.map((p) => ({ x: p.x, y: p.y - 14 }))];
		const n = Math.min(3, Math.floor(u / 0.18));
		fs.forEach((p, i) => figure(p, 1, i < n ? 0.7 : 0, true));
		if (u < 0.8) for (let i = 0; i < n; i++) { line(hops[i], hops[i + 1], 4, 0.25); line(hops[i], hops[i + 1], 1.6, 1, 10); glow(hops[i + 1].x, hops[i + 1].y, 10, 0.8); }
		return;
	}
	// ---------- the spells on yourself ----------
	const m2 = { x: w * 0.5, y: gy };
	if (K === 'blink' || K === 'gate' || K === 'recall' || K === 'rewind') {
		const A = { x: w * 0.25, y: gy }, B = { x: w * 0.72, y: gy };
		const back = K === 'rewind' || K === 'recall';
		const from = back ? B : A, to = back ? A : B;
		const q = ease((u - 0.3) / 0.25);
		if (K === 'gate' || K === 'recall') { ring(to.x, to.y - 2, 16, 0.6 + 0.3 * Math.sin(t * 6), 2); glow(to.x, to.y - 14, 18, 0.35); }
		if (K === 'rewind') { g.setLineDash([3, 4]); g.strokeStyle = col(0.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(from.x, from.y - 12); g.quadraticCurveTo((from.x + to.x) / 2, gy - 50, to.x, to.y - 12); g.stroke(); g.setLineDash([]); }
		figure(from, Math.max(0, 1 - q * 1.5));
		figure(to, Math.max(0, q * 1.3 - 0.3));
		if (u > 0.25 && u < 0.6) { glow(from.x, from.y - 12, 20 * (1 - q), 1 - q); glow(to.x, to.y - 12, 20 * q, q); }
		return;
	}
	if (K === 'stasis') {
		figure(me);
		const T0 = foes[0], q = ease(u / 0.3);
		figure(T0, 1, 0, true);
		if (u > 0.15) { g.strokeStyle = col(0.9 * q); g.fillStyle = col(0.15 * q); g.lineWidth = 1.5; g.beginPath(); g.rect(T0.x - 12, T0.y - 32, 24, 34); g.fill(); g.stroke(); g.font = '12px system-ui'; g.textAlign = 'center'; g.fillStyle = col(q); g.fillText('⌛', T0.x, T0.y - 38); }
		return;
	}
	figure(m2, K === 'cloak' ? 1 - 0.75 * ease(u / 0.4) : 1);
	if (K === 'heal' || K === 'hot') { const n = K === 'hot' ? 3 : 6; for (let i = 0; i < n; i++) { const f = (u * (K === 'hot' ? 1 : 1.6) + i / n) % 1; g.fillStyle = col(1 - f); g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText('✚', m2.x - 16 + (i * 13) % 32, m2.y - 8 - f * 40); } glow(m2.x, m2.y - 12, 22, 0.35); return; }
	if (K === 'shield' || K === 'deathward') {
		const big = sp.absorb > 1e5 || K === 'deathward';
		g.strokeStyle = col(0.7); g.fillStyle = col(0.1); g.lineWidth = 2; g.beginPath(); g.arc(m2.x, m2.y, 30, Math.PI, 0); g.fill(); g.stroke();
		const f = (u * 1.5) % 1, x = m2.x + 160 - f * 130;
		if (x > m2.x + 32) glow(x, m2.y - 14, 4, 0.9); else glow(m2.x + 30, m2.y - 14, 12 * (1 - f), big ? 1 : 0.6);
		if (K === 'deathward') { g.font = '12px system-ui'; g.textAlign = 'center'; g.fillStyle = col(0.9); g.fillText('♱', m2.x, m2.y - 36); }
		return;
	}
	if (K === 'buff') {
		for (let i = 0; i < 6; i++) { const y = m2.y - 4 - i * 5, l = 20 + ((t * 80 + i * 17) % 30); g.strokeStyle = col(0.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(m2.x - 10 - l, y); g.lineTo(m2.x - 10, y); g.stroke(); }
		if (sp.waterWalk) { g.strokeStyle = 'rgba(120,190,255,.6)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < w; x += 4) g.lineTo(x, gy + 3 + Math.sin(x * 0.08 + t * 4) * 2); g.stroke(); }
		if (sp.cdK) { g.strokeStyle = col(0.8); g.lineWidth = 2; g.beginPath(); g.arc(m2.x + 30, m2.y - 26, 9, -1.57, -1.57 + ((t * 2) % 1) * 6.283); g.stroke(); }
		return;
	}
	if (K === 'cloak') { for (let i = 0; i < 3; i++) { g.font = '11px system-ui'; g.fillStyle = 'rgba(255,140,120,.7)'; g.fillText('?', w * 0.78 + i * 14, gy - 26 - i * 3); figure({ x: w * 0.78 + i * 14, y: gy }, 1, 0, true); } return; }
	if (K === 'light') { const a = t * 2; glow(m2.x + Math.cos(a) * 14, m2.y - 30 + Math.sin(a) * 4, 10); const gr = g.createRadialGradient(m2.x, m2.y - 20, 0, m2.x, m2.y - 20, 70); gr.addColorStop(0, col(0.18)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); return; }
	if (K === 'sight') { const a = t * 2.5; g.strokeStyle = col(0.6); g.lineWidth = 1; ring(m2.x, m2.y, 60, 0.3, 1); g.beginPath(); g.moveTo(m2.x, m2.y); g.lineTo(m2.x + Math.cos(a) * 60, m2.y + Math.sin(a) * 23); g.stroke(); for (let i = 0; i < 6; i++) { const b = i * 1.05, r = 25 + (i * 13) % 32; const vis = ((a - b) % 6.283 + 6.283) % 6.283 < 2.5; if (vis) glow(m2.x + Math.cos(b) * r, m2.y + Math.sin(b) * r * 0.38, 4, 0.9); } return; }
	if (K === 'pact') { const q = ease(u / 0.6); g.fillStyle = 'rgba(255,80,90,.8)'; g.fillRect(m2.x - 40, m2.y - 50, 30 * (1 - q * 0.33), 4); g.fillStyle = 'rgba(120,150,255,.9)'; g.fillRect(m2.x + 10, m2.y - 50, 30 * (0.2 + 0.8 * q), 4); glow(m2.x, m2.y - 14, 24 * q, q * 0.7); return; }
	if (K === 'summon') { const n = sp.n || 1; figure(foes[0], 1, 0.2 + 0.2 * Math.sin(t * 9), true); for (let i = 0; i < n; i++) { const a = t * 1.4 + i * 6.283 / n; const p = { x: m2.x + Math.cos(a) * 26, y: m2.y - 16 + Math.sin(a) * 9 }; glow(p.x, p.y, 8, 0.85); if ((t * 2 + i) % 1 < 0.3) line(p, { x: foes[0].x, y: foes[0].y - 14 }, 1.2, 0.6); } return; }
	if (K === 'douse') { for (let i = 0; i < 30; i++) { const x = (i * 29 + t * 30) % w, y = (i * 47 + t * 160) % gy; g.fillStyle = 'rgba(160,200,240,.5)'; g.fillRect(x, y, 1, 6); } for (let i = 0; i < 3; i++) { g.font = '12px system-ui'; g.globalAlpha = Math.max(0, 1 - u * 1.4); g.fillText('🔥', w * 0.7 + i * 18, gy - 2); g.globalAlpha = 1; } return; }
	if (K === 'daybreak') { const q = ease(u / 0.7); const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, `rgba(20,30,60,${0.5 * (1 - q)})`); gr.addColorStop(1, col(0.5 * q)); g.fillStyle = gr; g.fillRect(0, 0, w, gy); glow(w * 0.8, gy - q * 30, 20 * q + 4, q); return; }
	glow(m2.x, m2.y - 14, 18 + Math.sin(t * 4) * 4, 0.5);
}
