# Baking the orbital Earth's imagery

`island/assets/earth/` holds the real Earth seen from orbit (`src/space/earthmap.js` reads it):

- `earth-4k.webp` (desktop) and `earth-2k.webp` (phones): the whole globe, equirectangular, north up,
  longitude -180 at the left. Alpha is land (1) and water (0), which the orbital shader uses for sun glint.
- `l1/{row}/{col}.webp`: 6° tiles, 360 px (about 1.9 km a pixel), row 0 at 90° N, col 0 at 180° W.
- `l2/{row}/{col}.webp`: 2° tiles, 360 px (about 600 m a pixel).
- `night-2k.webp`: the night side's city lights (see CREDITS.md), the source less its grey land floor.
- `tiles.json`: which tiles exist, `{ "l1": [30 strings of 60 '0'/'1'], "l2": [90 strings of 180] }`.

Bump `EARTH_MAP_VERSION` in `earthmap.js` when the files change.

## Sources

- Land: the Sentinel-2 L2A 120 m cloudless mosaic (Copernicus Sentinel data 2020, mosaic by Sinergise,
  public on AWS at `sentinel-s2-l2a-mosaic-120`), read at its 480 m overview. North of the equator
  the 2020/6/12 ten-day mosaic, south of it 2020/1/11, so each hemisphere is in summer.
- Sea, the poles beyond 84° N and anything the mosaic misses: NASA Blue Marble Next Generation (public domain),
  toned to match Sentinel on land so the two meet without a seam.
- Night lights: three.js's `earth_lights_2048.png` (NASA), as `clip((L - 48) / 200) ^ 1.3`.
- Coastlines: Natural Earth 10 m land and minor islands (public domain). The mosaic's own sea is striped
  by the satellite's passes, so the sea always comes from Blue Marble.

## Running it

Python 3 with rasterio, numpy, pillow, scipy and pyshp. In an empty work folder (it needs about 9 GB):

```sh
cp island/tools/earth-imagery/*.py work/ && cd work
# Blue Marble at 5400x2700 as bmng.jpg (e.g. bmng.jpg from the basemap-data wheel on PyPI)
# Natural Earth 10m_physical ne_10m_land.* and ne_10m_minor_islands.* into ne/
python3 fetch.py            # about 650 zones into s2.npy (64800x32400 RGB); resumable via done.txt
python3 landmask.py         # land.npy at the same grid
python3 build.py out        # out/earth-4k.webp, earth-2k.webp, l1/, l2/, tiles.json
```

`build.py` drops Sentinel pixels that are empty, cloud (all channels bright, below 55° latitude) or off the coast,
feathers the imagery into Blue Marble only where the mosaic has gaps (never at the coast), and keeps Blue
Marble's own white on snow and ice.
