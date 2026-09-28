# Level 99 Bard: the trailer

- `level99bard-trailer-1080p60.mp4` is the trailer: 1920×1080, 60 fps, H.264 (yuv420p, CRF 18, +faststart).
- `poster.jpg` is a still of the title over the faceplate.
- `teaser-10s.mp4` is the first 10 seconds: the faceplate played, the title, and the hand-off into the world.

The trailer is cut to its own music, which the Bard plays itself.

## The soundtrack is played by the Bard

`soundtrack.mjs` loads the faceplate page (`index.html`) headless and renders the song offline with the Studio's own export path. That path is `window.L99Studio181`: the phrase generator, `plan215`, auto bass and `renderStep`, the same calls as EXPORT DRY WAV. The song is played on the faceplates' own instruments:

- Bars 1–14 play on **BARD**, with its synth voices.
- Bars 15–28 play on **MAESTRO**, with the orchestra's recorded samples: violins on the line, horns an octave below, and a choir on each bar.

It runs at 100 BPM, and a bar is 2.4 s. No recorded or licensed music is used. `encode.mjs` adds a little room reverb.

The same plan is also written out as a note timeline, `timeline.json`. It lists every lead note, bass note and drum hit, in seconds. Picture and sound both follow that one list:

- **Taps:** in the tap shots, each lead note strikes the world where the player would tap it. The strike goes through the world's own tap: its raycast (`music.hitAt`) and its ripple (`music.ripple`). The object rings with its material's colour (wood, stone, crystal, soft).
- **Bands:** kick and bass, lead, and hats become the faceplate's bass, mid and high bands. The world reads them where it reads the live faceplate (`L99Continuity.sample`), so the wind in the trees, the grass, the sea's sparkle and the fireflies move with the song.
- **Cuts:** every cut lands on a bar line.

## The shots

| Bars | Shot | What it shows |
| --- | --- | --- |
| 1–4 | `face` | The BARD faceplate played (the pads pressed on the lead line), the title, then ⧉ pressed |
| 5–6 | `gg` | A white flash into the world: the Golden Gate at golden hour |
| 7–14 | `wood`, `stone`, `mystic`, `soft` | Striking the world on the beat, one material to each pair of bars |
| 15 | `maestro` | Back on the faceplate as it switches to MAESTRO |
| 16–26 | `volcano`, `cave`, `castle`, `town`, `alien`, `ice`, `boardwalk`, `sf`, `diablo`, `gg2` | The worlds on the orchestra, a bar each (the volcano two) |
| 27–28 | end card | level99bard.com |

## Files

| File | What it does |
| --- | --- |
| `shots.mjs` | The shot list in cut order, in bars. For each shot it holds the world, a scene `setup`, the camera keys, and the tap points. It also holds the captions. |
| `soundtrack.mjs` | Renders `song.wav` and `timeline.json` from the faceplate page. |
| `faceplate.mjs` | Captures the faceplate's shots as screenshots of the page on a virtual clock. It presses the pads on the lead notes and shows a soft touch mark. |
| `capture.mjs` | Renders the world's shots frame by frame from the engine's canvas (`island/dev.html`) on a virtual clock. It skips frames already on disk, so a render resumes. `--list` prints the shots. |
| `cine-runtime.js` | The virtual clock and a seeded `Math.random`. |
| `cine-camera.js` | The spline camera rig, plus helpers: a strike-target finder that uses the world's own tap ray, and a street finder. |
| `cine-music.js` | The timeline in the page: the bands, and the taps on the lead notes. |
| `cards.py` | Draws the title, the captions and the end card with Pillow. |
| `encode.mjs` | Cuts the trailer with ffmpeg on the bar lines, adds the soundtrack, and writes the poster and the teaser. |
| `render.sh` | Renders the world's shots, one shot and one browser lock at a time, and logs progress. |

## Rebuilding it

You need Node 22, Playwright with Chromium, Python 3 with Pillow, and ffmpeg. For ffmpeg, `npm i --prefix /tmp/ff ffmpeg-static` works; pass `--ffmpeg /tmp/ff/node_modules/ffmpeg-static/ffmpeg` to `encode.mjs`, or set `FFMPEG`.

Serve the repository root first: `python3 -m http.server 8765`. Then run:

```sh
node trailer/soundtrack.mjs                  # song.wav + timeline.json (the Bard plays it)
node trailer/faceplate.mjs                   # the faceplate's shots
trailer/render.sh --jpeg                     # the world's shots (SwiftShader, CPU only: hours)
python3 trailer/cards.py                     # title, captions, end card
node trailer/encode.mjs                      # the MP4s and the poster
```

To take a quick look before a full render, render every 10th frame of some shots at half size:

```sh
node trailer/capture.mjs --w 960 --h 540 --every 10 --jpeg --frames /tmp/ql --only wood,volcano
```

## 4K 60 fps

Software rendering (SwiftShader) is too slow for 4K on a CPU, so the delivered cut is 1080p. On a machine with a GPU, render the same shots at 3840×2160 and cut them at that size:

```sh
node trailer/soundtrack.mjs --out /tmp/trailer4k
node trailer/faceplate.mjs --frames /tmp/trailer4k/frames --timeline /tmp/trailer4k/timeline.json --scale 3
FRAMES=/tmp/trailer4k/frames TRAILER_TIMELINE=/tmp/trailer4k/timeline.json trailer/render.sh --gpu --w 3840 --h 2160 --jpeg
python3 trailer/cards.py --w 3840 --h 2160 --out /tmp/trailer4k/cards
node trailer/encode.mjs --frames /tmp/trailer4k/frames --cards /tmp/trailer4k/cards --song /tmp/trailer4k/song.wav --w 3840 --h 2160 --out /tmp/trailer4k
```

This writes `level99bard-trailer-2160p60.mp4`. Because the clock is virtual, the motion and the timing are identical to the 1080p cut. `faceplate.mjs` screenshots at twice the page size by default, so for 4K pass it `--scale 3` as above.
