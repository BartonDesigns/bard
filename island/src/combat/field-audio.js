// Short layered Foley and radio cues, through the game's shared volume/mute bus.
import { soundBus } from '../world/soundbus.js';
export const FIELD_CUES = Object.freeze({
	pickup: [[0, .08, 140, .12, 'noise'], [.055, .1, 850, .07, 'triangle'], [.13, .13, 1700, .045, 'sine']],
	cache: [[0, .16, 250, .11, 'noise'], [.09, .12, 390, .08, 'triangle'], [.24, .22, 980, .04, 'sine']],
	accept: [[0, .09, 660, .06, 'sine'], [.12, .14, 880, .06, 'sine']],
	wave: [[0, .09, 330, .07, 'triangle'], [.15, .09, 440, .07, 'triangle'], [.29, .14, 330, .06, 'triangle']],
	complete: [[0, .23, 523, .055, 'sine'], [.13, .25, 659, .055, 'sine'], [.26, .4, 784, .06, 'sine']],
});
export function createFieldAudio() {
	const live = new Set(); let played = 0;
	function play(kind) {
		try {
			const bus = soundBus(), cue = FIELD_CUES[kind]; if (!bus || !cue || live.size > 18) return;
			const A = bus.ctx; if (A.state === 'suspended') A.resume().catch(() => {});
			played++;
			for (const [delay, duration, freq, volume, shape] of cue) {
				const gain = A.createGain(), filter = A.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq * 4;
				let src;
				if (shape === 'noise') {
					src = A.createBufferSource(); const b = A.createBuffer(1, Math.ceil(A.sampleRate * duration), A.sampleRate), data = b.getChannelData(0);
					for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
					src.buffer = b;
				} else { src = A.createOscillator(); src.type = shape; src.frequency.value = freq; }
				const t = A.currentTime + delay;
				gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
				src.connect(filter); filter.connect(gain); gain.connect(bus.out); live.add(src);
				src.onended = () => { live.delete(src); src.disconnect(); filter.disconnect(); gain.disconnect(); };
				src.start(t); src.stop(t + duration + .01);
			}
		} catch { /* Audio can be unavailable; gameplay remains operable. */ }
	}
	function clear() { for (const n of live) { try { n.stop(); } catch {} } live.clear(); }
	return { play, clear, info: () => ({ played, voices: live.size }) };
}
