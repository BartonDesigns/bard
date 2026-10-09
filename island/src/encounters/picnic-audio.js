import { soundBus, noise } from '../world/soundbus.js';

// Original plucked-string phrase. No recording from the reference clip is embedded.
const MELODY = [62,69,65,69,67,69,65,64,62,65,69,72,70,69,65,64];
export function createPicnicAudio() {
 const voices = new Set();
 function note(midi, volume, pan, clap = false) {
  const B = soundBus(); if (!B || volume < .0001) return;
  const {ctx,out} = B, t = ctx.currentTime, g = ctx.createGain(), p = ctx.createStereoPanner(), f = ctx.createBiquadFilter();
  const s = clap ? ctx.createBufferSource() : ctx.createOscillator();
  if (clap) s.buffer = noise(ctx); else { s.type = 'triangle'; s.frequency.value = 440 * 2 ** ((midi - 69) / 12); }
  f.type = clap ? 'bandpass' : 'lowpass'; f.frequency.value = clap ? 1400 : 2600; f.Q.value = .6;
  p.pan.value = Math.max(-1,Math.min(1,pan));
  const tail = clap ? .1 : .43;
  g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(volume,t+.005);g.gain.exponentialRampToValueAtTime(.00001,t+tail);
  s.connect(f);f.connect(g);g.connect(p);p.connect(out);
  const v = {s,f,g,p}; voices.add(v);
  s.onended = () => {s.disconnect();f.disconnect();g.disconnect();p.disconnect();voices.delete(v);};
  s.start(t);s.stop(t+tail+.02);
 }
 return {
  beat(n, level, pan, joined) {
   note(MELODY[n % MELODY.length], .045 * level, pan);
   if (n % 2 === 0) {const bass = n % 16 < 8 ? 50 : 57;note(bass,.036*level,pan);note(bass+7,.018*level,pan);}
   if (joined && n % 4 === 2) note(0,.055*level,pan,true);
  },
  silence() {for(const v of [...voices]) {v.s.onended=null;try{v.s.stop();}catch{}v.s.disconnect();v.f.disconnect();v.g.disconnect();v.p.disconnect();}voices.clear();},
  inspect: () => ({voices:voices.size}),
 };
}
