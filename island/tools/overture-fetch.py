# Pull a region's roads, buildings and land use from Overture Maps (CC BY 4.0 / ODbL,
# built from OpenStreetMap, Microsoft and Google footprints and more) straight off its
# public S3 bucket over HTTPS, reading only the parquet row groups whose bounding boxes
# touch the region. Writes one parquet-free JSON per theme for bake-overture.mjs.
#   python3 tools/overture-fetch.py <release> <west> <south> <east> <north> <outdir>
import sys, os, io, json, re, concurrent.futures as cf
import requests, pyarrow.parquet as pq, pyarrow as pa

BASE = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com'
rel, W, S, E, N, out = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
os.makedirs(out, exist_ok=True)
sess = requests.Session()

def keys(prefix):
    ks, tok = [], None
    while True:
        u = f'{BASE}/?list-type=2&prefix={prefix}' + (f'&continuation-token={requests.utils.quote(tok)}' if tok else '')
        t = sess.get(u, timeout=60).text
        ks += re.findall(r'<Key>([^<]+)</Key>', t)
        m = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', t)
        if not m: return [k for k in ks if k.endswith('.parquet')]
        tok = m.group(1)

class Range(io.RawIOBase):
    # a seekable file over HTTP range requests, with a small block cache
    def __init__(self, key):
        self.u = f'{BASE}/{key}'; self.pos = 0; self.cache = {}
        self.size = int(sess.head(self.u, timeout=60).headers['Content-Length'])
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, o, wh=0):
        self.pos = o if wh == 0 else self.pos + o if wh == 1 else self.size + o
        return self.pos
    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0: return 0
        k = (self.pos, n)
        r = sess.get(self.u, headers={'Range': f'bytes={self.pos}-{self.pos + n - 1}'}, timeout=300).content
        b[:len(r)] = r; self.pos += len(r)
        return len(r)

def groups(key):
    f = Range(key); pf = pq.ParquetFile(f); md = pf.metadata
    names = [md.schema.column(i).path for i in range(md.num_columns)]
    ix = {n: names.index(n) for n in ('bbox.xmin', 'bbox.xmax', 'bbox.ymin', 'bbox.ymax')}
    hit = []
    for g in range(md.num_row_groups):
        rg = md.row_group(g)
        st = {n: rg.column(i).statistics for n, i in ix.items()}
        if not all(s is not None and s.has_min_max for s in st.values()): hit.append(g); continue
        if st['bbox.xmin'].min <= E and st['bbox.xmax'].max >= W and st['bbox.ymin'].min <= N and st['bbox.ymax'].max >= S: hit.append(g)
    return key, hit

def fetch(theme, cols):
    ks = keys(f'release/{rel}/theme={theme}/')
    print(theme, len(ks), 'files', flush=True)
    with cf.ThreadPoolExecutor(16) as ex: found = [r for r in ex.map(groups, ks) if r[1]]
    print(' row groups', sum(len(h) for _, h in found), 'in', len(found), 'files', flush=True)
    tables = []
    for key, hit in found:
        pf = pq.ParquetFile(Range(key))
        t = pf.read_row_groups(hit, columns=cols)
        bb = t.column('bbox').combine_chunks()
        xmin, xmax, ymin, ymax = (bb.field(n).to_numpy(zero_copy_only=False) for n in ('xmin', 'xmax', 'ymin', 'ymax'))
        keep = (xmin <= E) & (xmax >= W) & (ymin <= N) & (ymax >= S)
        tables.append(t.filter(pa.array(keep)))
    t = pa.concat_tables(tables)
    print(' rows', t.num_rows, flush=True)
    return t

if __name__ == '__main__':
    import shapely.wkb
    def geo(b): return shapely.wkb.loads(b)
    seg = fetch('transportation/type=segment', ['id', 'geometry', 'bbox', 'subtype', 'class', 'names', 'road_flags', 'road_surface', 'level_rules'])
    roads = []
    for r in seg.to_pylist():
        if r['subtype'] != 'road': continue
        g = geo(r['geometry'])
        nm = (r.get('names') or {}).get('primary')
        flags = [f for rf in (r.get('road_flags') or []) for f in (rf.get('values') or [])]
        roads.append({ 'c': r['class'], 'n': nm, 'f': sorted(set(flags)), 'p': [[round(x, 7), round(y, 7)] for x, y in g.coords] })
    json.dump(roads, open(f'{out}/roads.json', 'w'))
    bld = fetch('buildings/type=building', ['id', 'geometry', 'bbox', 'height', 'num_floors', 'class', 'subtype', 'roof_shape', 'roof_color', 'facade_color', 'facade_material', 'roof_material'])
    bs = []
    for r in bld.to_pylist():
        g = geo(r['geometry'])
        polys = [g] if g.geom_type == 'Polygon' else list(g.geoms) if g.geom_type == 'MultiPolygon' else []
        for p in polys:
            bs.append({ 'h': r.get('height'), 'l': r.get('num_floors'), 'c': r.get('class'), 's': r.get('subtype'), 'r': r.get('roof_shape'), 'p': [[round(x, 7), round(y, 7)] for x, y in p.exterior.coords][:-1] })
    json.dump(bs, open(f'{out}/buildings.json', 'w'))
    lu = fetch('base/type=land_use', ['id', 'geometry', 'bbox', 'subtype', 'class', 'names'])
    ls = []
    for r in lu.to_pylist():
        g = geo(r['geometry'])
        polys = [g] if g.geom_type == 'Polygon' else list(g.geoms) if g.geom_type == 'MultiPolygon' else []
        for p in polys:
            if p.area < 1e-8: continue
            ls.append({ 's': r['subtype'], 'c': r['class'], 'n': (r.get('names') or {}).get('primary'), 'p': [[round(x, 6), round(y, 6)] for x, y in p.exterior.coords][:-1] })
    json.dump(ls, open(f'{out}/landuse.json', 'w'))
    print('done')
