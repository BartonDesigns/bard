# Local speech and control release · October 12, 2026

This completes the interrupted speech/control publication on top of `edf1b236`, preserving the 14-image unnumbered loading slideshow and the latest world code.

## Behavior

- Spoken replies use Kokoro 82M q8 locally in a module worker with WebAssembly. No GPU host, paid speech API, or Cloudflare Worker redeploy is required. The conversation provider is separate and retains the existing configured discovery service and user preferences.
- First use downloads the pinned Kokoro JS runtime and roughly 100 MB of model data from jsDelivr/Hugging Face. Transformers.js caches the model where browser storage is available. Device voice is the fallback on failure and can also be selected in Guide settings. Explicit saved mute choices are preserved; new users have spoken replies enabled.
- Full reply text is split into bounded sentences, including a final sentence without punctuation. Audio playback applies backpressure to generation. New replies, closing the Guide, leaving an NPC, and muting cancel stale playback.
- Touch users have visible Fly, Gear, Places, and Controls buttons. Controls opens a labeled two-column scrolling panel. Combat actions are hidden while it is open. Weapon/ammunition details are small and placed in the lower-left area, with separate portrait/landscape positioning. Field contracts now join the shared left-hand layout instead of covering the quick buttons.
- No changes to the existing 14-image randomized, unnumbered slideshow.

## Verification

- Production source browser test generated and played two non-silent sentences, including the punctuation-free final sentence, then another reply with a different voice. No device fallback, page errors, or speech-server POST occurred. A cancelled reply did not play.
- Control interactions passed at 320×568, 390×664, 844×320, 844×390, and 1280×800. Covered action separation, panel selection, scrolling, outside dismissal, Escape, and field-contract expansion/abandonment.
- Eleven guide preference/travel checks passed. Production bundle built successfully.
- Evidence is in `docs/verification/local-speech-controls/`. Browser tests use software Chromium and emulated touch, not a physical iPhone; native-device latency and memory use are not established by these checks.

## Recovery notes

The interrupted session's unpublished speech source and upload checkpoint were no longer present. Its control patch and successful speech-test evidence survived. This implementation was restored on current main and independently checked, rather than treating previously created unattached blobs as a published release. Qwen TTS is not the active speech engine in this release.
