# Music timing: on the beat as it is heard (17 October 2026)

Follows `docs/music-fidelity-2026-10-13.md`, which put the sequencer and auto music on the audio
clock. That left the sequencer itself steady (about 1 ms), but everything around it still went by
the page's timers: what you play against it, what is drawn with it, the arpeggiator, and the
world's auto music.

## What was wrong (measured before the change)

1. **Loop recording put a hit on the beat one step late, every time** (0 of 20 on the right
   step). It counted from when the page's step timer last ran, and that timer runs a lead
   (80 to 200 ms) ahead of the sound, more than a sixteenth at 120 bpm.
2. **HARD-quantized drum pads (the default) sounded 55 ms late on the faceplate and 111 ms in the
   world**, nearly a sixteenth, and recorded on the wrong step (0 of 14). They waited for the next
   step timer and played when it ran, not when its step sounds.
3. **The arpeggiator ran on `setInterval`**: 43 ms of wobble at the 95th percentile under load
   (67 ms worst), its own phase against the pattern (58 ms off a step, typically), a tempo change
   ignored until the next key. The audio-clock path existed but was off: its release ran from a
   timer and could land before its note began.
4. **The world's auto music shared the faceplate's tempo but not its downbeat.** With the
   faceplate's pattern running, every auto music note was off the pattern's steps (0 of 30, up to
   60 ms) and its swing was a different shape.
5. **After a phone call, Siri or another app took the audio**, the sequencer had kept working out
   steps against a clock that stood still: 53 to 77 sounds queued, all fired at once on return.
6. **The playhead (the step dots) lit 115 ms before its step was heard**: the lead plus the
   output's delay.
7. **A page stall longer than the lead moved the beat** (4 times in 9 s of 190 ms stalls): the
   lead was fixed however often the page was held up.

## What changed

- **`L99Clock` (index.html, `clock-code230`, tagged music233)** learns how late the music's timers
  run (the sequencer, the arp, SPECIAL's clock and auto music report each wake, and the browser's
  long-task reports give whole stalls) and widens the lead to cover it, up to 300 ms, easing back
  with a 15 s half-life. Live playing never waits on the lead; only scheduled music does. New:
  `lag(ctx)` (output delay, from `getOutputTimestamp`, else `outputLatency + baseLatency`),
  `heard(ctx)` (the audio time reaching the ears now) and `perfAt(ctx, t)`.
- **Sequencer:** keeps the last steps' audio times (`window._seqRing`, `_seqLastAt`); holds where
  it is while the audio context is not running and picks up on the beat after; lights each step
  dot when the step is heard; calls `window._seqStepHooks` inside each step, stamped.
- **Recording** (`quantizedRecordStep`, via `nearestSeqStep` / `heardRecordStep`): the step nearest
  what was being heard when you played, or for a note stamped for later (the arp) its own time.
- **HARD drum pads** snap to the step nearest what is heard: one still to come sounds exactly on
  it, one just gone sounds at once. Recorded on that step.
- **Arpeggiator** on the audio clock by default (`window._useLookaheadARP = false` restores the
  timer); release stamped at onset plus gate; starts on the pattern's next step while it plays;
  follows tempo changes; skips missed steps after a stall instead of restarting the phase; waits
  while the audio is held.
- **Auto music** (`island/src/music/automusic.js`): while the faceplate's sequencer runs, it plays
  inside the sequencer's steps (bars on its bar lines, its swing, its tempo at once); otherwise
  its own clock, as before. Plays nothing while the faceplate's audio is held.
- **SPECIAL tools' clock** waits while the audio is held, and reports its lateness.

## The beat clock: the steps' times on the audio thread

Chosen next by Josh: no page freeze should move or drop the beat. `L99Beat233` (index.html,
`beat-code233`) is a small audio worklet processor that owns the sequencer's step times: the
page sends it the tempo and swing (as the four step lengths of a beat), the loop length and the
lead, and it tells the page each step a lead ahead, on the audio thread's own clock. The page's
tick runs as before on that message (the step stamped with its time) and claims the step. Its
`setTimeout` chain is gone while the beat clock runs; message wakes are also not throttled in a
background tab.

If the page reaches a step too late to start its drums (under 25 ms plus twice the output
buffer before it), it does not claim it, and the processor plays the step's drums itself, on
its exact time, from the face's kit rendered to samples: `_renderBeatKit233` plays each drum
twice into an offline context through the same kit code (`_drumKit233`, split out of
`playDrum`), at the drum's balance, trimmed. The pattern it plays is `_beatPattern233`: the
same seed beat, built layers and recorded hits the tick plays, sent whenever it changes. Hats
choke each other there as in the kits. A step too late to sound at all (30 ms past) drops its
leads, metronome and launch grid instead of firing them late in a burst, and auto music
(through `_seqStepHooks`, which now pass a `late` flag) keeps its place and plays nothing.

The processor loads with the audio (`initAudio`); a sequencer started before it is ready runs
on the timer and moves onto the beat clock at its next step. The kit re-renders on a face
change (about 150 to 300 ms, in the background). Kill: `window._BEAT_CLOCK = false`.

Not covered by the audio thread: lead notes (recorded leads, the arp, auto music) still need
the page, and are dropped for a step it misses; SPECIAL tools and held drums (`startDrumHold`)
still run on their own timers.

## Measured after (headless Chromium, software audio)

| | before | after |
| --- | --- | --- |
| Loop recording: hit on the beat recorded on the right step | 0 / 20 | 20 / 20 |
| HARD drum pad, hit on the beat: sound after its step (faceplate / world lead) | 55 / 111 ms | 47 / 36 ms (the output's delay, 31 to 35 ms here, plus the hit's own spread) |
| HARD drum pad recorded on the right step | 0 / 14 | 14 / 14 |
| Arp interval error under load, 95th percentile / worst | 43 / 67 ms | 0 / 0 ms |
| Arp against the pattern's steps | 58 ms typical | 0 ms |
| Auto music notes on the pattern's steps (full game, island open) | 0 / 30 | 14 / 14, 27 / 27 |
| Sounds queued while the audio was suspended 3 s | 53 to 77 | 0 |
| Step dot lit vs step heard | -115 ms | +4 ms |
| Beat moved by 190 ms stalls every 1.4 s, in 9 s | 4 | 0 to 1 |
| Sequencer step error under load, 95th percentile | 1.4 to 1.8 ms | 1.4 to 2.0 ms (unchanged) |
| Page frozen 0.6 s and 1.2 s, a hi-hat on every sixteenth: steps missing / off the grid | 18 to 20 missing, 11 to 22 off | 0 / 0 (11 played by the audio thread) |
| Steps left to the audio thread while the page keeps up (start, stop, face change) | | 0 |

Checks: `tools/music-timing-browser.cjs` (the faceplate scenarios above; fails off the beat),
`tools/music-timing-world-browser.cjs` (the full game with the island open; fails on a page or
console error or an auto music note off a step), `island/tools/music-timing.test.mjs` (auto music
against a stand-in sequencer). The browser checks need Playwright (`PLAYWRIGHT_MODULE` to point at
it).

## Not done, and not verified

- Lead notes in HARD quantize still wait for the step timer (lead mode defaults to SOFT). Moving
  them needs care with a quick release on the node-built voices, which the worklet already handles.
- The output delay is the browser's estimate; on Bluetooth it can be off by tens of ms. A
  tap-along calibration would measure it.
- Dancers (`music/performance.js` beat) still free-run at the tempo, not on the heard beat.
- On a real phone, none of it. A freeze no longer moves the drums; lead notes in it are dropped.
