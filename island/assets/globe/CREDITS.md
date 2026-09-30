# The globe's data (assets/globe)

The 72 tiles here (`g<row>-<col>.png`, 30 degrees each) are baked by
`tools/bake-globe.mjs` from open data. See that tool for the format.

## Elevation and bathymetry

Terrain Tiles on AWS (Mapzen / Tilezen "Terrarium" encoding, zoom 5), resampled to a
tenth of a degree. The tiles combine these sources:

- SRTM, NASA
- GMTED2010, USGS
- ETOPO1, NOAA National Centers for Environmental Information
- NOAA Coastal Relief Models, Great Lakes bathymetry
- USGS 3DEP (National Elevation Dataset)
- EU-DEM (Copernicus), Geoscience Australia, NRCan CDEM, LINZ, Kartverket and others

Full attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md

Terrain data made available by Mapzen / Tilezen and Amazon Web Services Open Data,
with the attributions and licences of the sources listed above (mostly public domain;
some CC BY, for example EU-DEM and Geoscience Australia).

## Coastlines, islands and lakes

Natural Earth 1:10m physical vectors: land, minor islands and lakes. Public domain.
https://www.naturalearthdata.com/ (fetched from github.com/nvkelso/natural-earth-vector)

## The places' character

The relief's shape, ground colours, tree cover and climate come from the game's own
Earth atlas (`src/earth/data`), written for the game.
