# Music fidelity: steady tempo, no clipping (13 October 2026)

Reported: with a lot going on in the game, with auto music, or back on the Bard faceplate, the music sometimes clips and the tempo drags behind the set BPM.

## What was wrong

1. **The sequencer's timer added up its own lateness.** Each step set a timer for one step length from whenever the last step had run. A late timer (a busy game frame, a slow page) made every later step late too, so the beat slowed, and when it was 250 ms out it snapped back. The drums also played when the timer ran, not at the step's audio time (only worklet leads used it), so drums and leads drifted apart.
2. **Auto music played each step whenever its timer ran**, up to 150 ms late.
3. **The world's sounds went in after the peak guard.** `soundbus.js` and seven modules played into `window._masterClip`, which sits after the guard and goes straight to the speakers. Music at the guard's ceiling plus a loud world moment went past full scale: real clipping. Spoken voices had a second audio context of their own, also unguarded.

## What changed

- **`L99Clock` (index.html, `clock-code230`).** Steps are worked out a lead ahead (80 ms on the faceplate, 150 ms while the world is shown, 200 ms on a phone; set by `main.js` show/hide through `window._worldAudioLead`). While a step runs, its sounds are stamped with the step's audio time: the context's `currentTime` reads as the stamp, so every kit and voice that starts "now" starts on the beat. Stamps only ever move time forward, by under a second, and fall back to the true time once past.
- **Sequencer:** the next timer is measured from the audio clock, so lateness never adds up; it re-anchors only after a stall longer than the lead. Drum humanizing moves the stamp instead of using a timer.
- **The SPECIAL tools' clock** and the lookahead scheduler now use the same audio-clock pump. A stall no longer fires the missed steps in a burst.
- **Auto music** (`music/automusic.js`) maps each step's time to the audio clock, works a lead ahead and stamps the step; note releases and echoes carry their own audio times.
- **World sounds** go through a world bus (`soundbus.js`): a gentle compressor, then a duck (about 3 dB down while music plays, more while the guard is holding the total down), into the guard's input. Effects on the music itself (the mushroom trip's room, the singularity's stretch) take the music before the master and return it ahead of the guard (`musicSend()`).
- **Spoken voices** play in the Bard's own audio context through a voice bus ahead of the guard (never ducked); their position is worked out relative to you, so the shared context's listener is left alone.
- **Phones** get a `balanced` audio buffer (the small one runs dry under load and crackles). Override with localStorage `l99-audio-latency` = `interactive`, `balanced` or `playback`.

## Measured (headless Chromium, the main thread held busy 45 ms in every 60 ms)

| | before | after |
| --- | --- | --- |
| Sequencer: step timing error, median | 51.9 ms | 1.3 ms |
| Sequencer: step timing error, 95th percentile | 109.9 ms | 2.5 ms |
| Sequencer: onset jitter (no load) | 31.8 ms | 0.9 ms |
| Auto music: drum jitter / 95th percentile | 31.4 / 59 ms | 6.3 / 9.7 ms (the drums' own humanizing) |
| Music plus a loud world sound: output peak | 4.85 (116,071 samples clipped in 3 s) | 0.678 (none) |

The measuring scripts were run in the session against `index.html?offline&safe` (not kept in the repo): they hook `AudioScheduledSourceNode.start` for onsets and meter `window._masterClip` in a worklet.

## Not verified

On a real phone, none of it. With the page frozen longer than the lead (a 1 fps software-rendered world), steps still re-anchor: nothing can play a beat the page never got to.
