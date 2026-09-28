# Level 99 Bard: the trailer

- `level99bard-trailer-1080p60.mp4` is the trailer: 1920×1080, 60 fps, H.264 (yuv420p, CRF 18, +faststart), with an ambient pad that ffmpeg synthesises from sine tones. It uses no recorded or licensed audio.
- `poster.jpg` is a still of the opening title over the Golden Gate.
- `teaser-10s.mp4` is the first 10 seconds.

Every frame is rendered by the engine itself (`island/dev.html`) in headless Chromium, on a virtual clock. The engine steps exactly 1/60 s per frame, however long the frame takes to draw, so the motion is smooth at any render speed.

## Files

| File | What it does |
| --- | --- |
| `shots.mjs` | The shot list in cut order. For each shot it holds the world, the duration, the warm-up, a scene `setup`, and the camera keys (`cam`). It also holds the place captions. |
| `capture.mjs` | Renders the frames of each shot to `<frames>/<shot>/f00000.png…`. It skips frames that are already on disk, so an interrupted render resumes where it stopped. `--list` prints the shot list with timings. |
| `cine-runtime.js` | The virtual clock and a seeded `Math.random`, injected before the page loads. |
| `cine-camera.js` | The spline camera rig: centripetal Catmull-Rom paths, eased timing and a faint handheld drift. It drives the camera through the engine's `Crysis.cine` hook. |
| `cards.py` | Draws the opening title, the place captions and the end card as PNGs with Pillow. |
| `encode.mjs` | Cuts the trailer with ffmpeg: captions, crossfades, the title, the end card and the pad. It also writes the poster and the teaser. |
| `render.sh` | Renders every shot, one shot and one browser lock at a time, and logs progress. |

## Rebuilding it

You need Node 22, Playwright with Chromium, and ffmpeg. For ffmpeg, `npm i --prefix /tmp/ff ffmpeg-static` works; pass `--ffmpeg /tmp/ff/node_modules/ffmpeg-static/ffmpeg` to `encode.mjs`, or set `FFMPEG`.

Serve the repository root first: `python3 -m http.server 8765`. Then run:

```sh
trailer/render.sh                            # 1080p frames (SwiftShader, CPU only: hours)
python3 trailer/cards.py                     # title, captions, end card (Pillow)
node trailer/encode.mjs                      # the MP4s and the poster
```

To take a quick look before a full render, render every 10th frame of some shots at half size:

```sh
node trailer/capture.mjs --w 960 --h 540 --every 10 --jpeg --frames /tmp/ql --only gg,volcano
```

## 4K 60 fps

Software rendering (SwiftShader) runs at about 1 fps at 4K, so the delivered cut is 1080p. On a machine with a GPU, render the same shots at 3840×2160 and cut them at that size:

```sh
FRAMES=/tmp/trailer4k/frames trailer/render.sh --gpu --w 3840 --h 2160
python3 trailer/cards.py --w 3840 --h 2160 --out /tmp/trailer4k/cards
node trailer/encode.mjs --frames /tmp/trailer4k/frames --cards /tmp/trailer4k/cards --w 3840 --h 2160 --out /tmp/trailer4k
```

This writes `level99bard-trailer-2160p60.mp4`. Because the clock is virtual, the motion is identical to the 1080p cut.
