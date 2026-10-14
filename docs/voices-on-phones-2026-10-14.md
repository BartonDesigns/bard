# Voices on phones (October 14, 2026)

The local Kokoro voices are a 100 MB model run in WebAssembly. On a phone, on top of the world, loading it was enough for the browser to close the page (the white flash and back to the faceplate on meeting anyone). The hotfix kept phones on the device voice. This change brings the local voices back to phones without the model ever loading in passing.

## Where a line comes from

Every line picks one source before it starts and keeps it to the end (`island/src/guide/local-speech-plan.js` `chooseSource`):

1. **A clip made ahead of time** (`island/assets/voices/<voice>/<id>.mp3`). Used whenever every piece of the line has one, on every device. No model in memory, no processor time. Fetched the first time it is said, then kept by the browser (Cache API, `l99-voices-v1`).
2. **The local model**, when it is loaded (on a computer it loads in the background as before; on a phone only through the guarded load below). A conversation on a computer still waits for it to load.
3. **The device voice** (speechSynthesis), chosen to be near the person's own: a system voice of their sex picked by their seed, pitched and paced like their local voice (`deviceVoiceFor`). A remark in the device voice is as loud as the speaker is near.

A line is never split between sources. A clip that fails to fetch before anything has played hands the whole line to the device voice.

Each person keeps one voice id across clip and model: the voices are now three female (`af_heart`, `af_bella`, `bf_emma`) and three male (`am_michael`, `am_fenrir`, `bm_george`), the same set the clips are made in (`localVoice`).

## The clip bank

`island/tools/voice-bank.mjs` gathers every fixed line: all of `people/chatter-lines.js` (`lineBank()`, including the overheard pairs) and the favours' asks and replies from `people/errands-core.js`, swept over every kind, item, direction and variant. A line with a name in it (a friend's, a dog's) is left out and is said whole by the model or the device. Today: 350 lines, 451 pieces (sentences, as `speechChunks` cuts them). `island/assets/voices/lines.json` lists them by clip id; a test fails when it falls behind the lines.

Clips are MP3, 24 kHz mono, 32 kbps (every browser decodes MP3 with `decodeAudioData`, iPhone Safari included; Ogg Opus is not safe on older iOS). The estimate is about 2.7 MB a voice, 16 MB for all six, fetched one piece at a time only when said.

### Making the clips

The clips are **not in the repository yet**: the model could not be fetched from this build machine (Hugging Face is blocked by its network policy). On a machine that can reach Hugging Face, with ffmpeg:

```
mkdir -p /tmp/kokoro && cd /tmp/kokoro && npm i kokoro-js@1.2.1
cd <repo>/island && node tools/build-voice-clips.mjs --render --kokoro /tmp/kokoro
git add assets/voices
```

It makes only the missing pieces, removes pieces no longer in the bank, and rewrites `manifest.json` (voice to clip ids) with the total size. `--voices af_heart,am_michael` makes some voices only; `--lines` refreshes `lines.json` with no model. Until the clips exist the manifest is empty and every line goes on to the model or the device voice, so nothing breaks.

## The guarded load on a phone

`createLoadGuard` in `local-speech-plan.js`, driven once a frame from `people/chatter.js` through `voice.tick`:

- Only after the world has been calm for three minutes: not loading, not flying, not moving fast (over 9 m/s), frames under 28 ms (a dense build shows up as slow frames), page visible. Any of those resets the wait.
- A mark (`crysis-voice-loading`) is put in localStorage before the load and cleared once the model has loaded and made one line (the worker makes and discards "Hello." before it reports ready). If the page comes back with the mark still there, the load took the page with it: the phone is marked unable (`crysis-voice-unable`) and stays on clips and the device voice until the player chooses a voices setting again (`retry`). Leaving the page normally (pagehide) clears the mark.
- The model is let go when the page is hidden, and when the browser reports the heap above 85% of its limit (`performance.memory`, Chrome only). The next load waits for calm again.
- Passing chatter never warms the model on a phone. A computer still warms it from chatter.
- Smallest quantization: q8 (92 MB). The 4-bit versions of this model are larger (only some weights are 4-bit, the rest stay full size), so q8 stays. One thread: the page is not cross-origin isolated, so WebAssembly has no shared memory for more.
- The old "too slow" guard stays: two lines that take 1.6 times longer to make than to say, on a touch screen, and the model goes.

## The setting

Guide, gear, **Voices**: Best available (default), Device only, Local always (`preferences.js` `voiceMode`, stored as `crysis-voices`). Local always loads the model on any device, phones included, still behind the crash mark. The old `crysis-speech-mode` choice of device is kept; its local becomes Best available.

## Tests and checks

- `island/tools/voice-clips.test.mjs`: source choice (a phone without the model gets a clip, then the device; a computer prefers clip, then model; one missing piece and the line is not from clips), the crash mark (a load that never finished marks the phone unable; retry clears it), the calm wait, voice consistency, the device voice by sex, the setting, the bank coverage of chatter and favours and no em dashes, the manifest against the files, the clip store fetching once and then from the cache, and a phone `createLocalSpeech` that makes no worker for chatter or conversation and loads after calm with the mark set first.
- Headless (Playwright Chromium, SwiftShader, iPhone user agent with touch): no page errors; a remark plays from a clip (an AudioBufferSource is made) with no worker started. The clips were stood in for by a test tone served in place of `assets/voices`, since the real clips are not made yet.

## Left to do

- Render the clips (above) and commit them; check the total size and listen to a few.
- A line with a name could play its fixed sentences from clips and only the name sentence from the model, once the model is loaded (same voice, so it would not be heard as a switch).
- The money lines (`npc-money.js`) and the guide's conversations are dynamic and go to the model or the device voice.
