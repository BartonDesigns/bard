// The garments' cut edges and rounded surface (people/garment-tailoring.js) made with fewer
// throwaway objects (each vertex read straight from its arrays, a vertex in a region made once,
// the arrays filled without the lists between): the same geometry to the last bit as before,
// checked here against a copy of the old way over random garments.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { finishGarmentEdges, refineGarmentSurface, armhole, sleeveDistance } from '../src/people/garment-tailoring.js';
import { isRibbed, isShirted } from '../src/people/garment-shape.js';

// ---------- the old way, as it was ----------
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
// Blend bone identities, not their numeric indices. Shared by curved surface samples
// and cut edges so a new vertex follows the same skeleton as its neighbours.
function blendWeights(a, b, t, v) {
 const weights = new Map();
 for (const [q, scale] of [[a, 1-t], [b, t]]) for (let j=0; j<4; j++) weights.set(q.skinIndex[j], (weights.get(q.skinIndex[j]) || 0) + q.skinWeight[j] * scale);
 const top = [...weights].sort((a,b)=>b[1]-a[1]).slice(0,4), total = top.reduce((a,b)=>a+b[1],0) || 1;
 v.skinIndex = [0,0,0,0]; v.skinWeight = [0,0,0,0];
 top.forEach(([id,w],j)=>{v.skinIndex[j]=id;v.skinWeight[j]=w/total;});
}

// One curved split of upper garments, at dressing time. Hermite edge midpoints round
// the cage's shoulders without shrinking the cloth back into the skin. The displacement
// is limited to 4 mm; trousers/shoes and the original vertices stay in place. UV seams
// use the same endpoint positions/normals, so their new positions still coincide.
function oldRefine(g) {
 const names = Object.keys(g.attributes), rows = [], indices = [], cache = new Map();
 const at = i => Object.fromEntries(names.map(k => [k, Array.from({length:g.attributes[k].itemSize}, (_,j)=>g.attributes[k].array[i*g.attributes[k].itemSize+j])]));
 const source = Array.from({length:g.attributes.position.count}, (_,i)=>at(i));
 const put = (key, v) => { if(!cache.has(key)){cache.set(key,rows.length);rows.push(v);}return cache.get(key); };
 const original = (i,s) => put(`v${i}s${s}`,{...source[i],slot:[s]});
 let added=0, maxOffset=0;
 function midpoint(i,j,s) {
  const key=`e${Math.min(i,j)}:${Math.max(i,j)}s${s}`;
  if(cache.has(key))return cache.get(key);
  const a=source[i],b=source[j],v={};
  for(const k of names)v[k]=a[k].map((x,q)=>(x+b[k][q])*.5);
  blendWeights(a,b,.5,v);v.slot=[s];
  const n0=new THREE.Vector3(...a.normal).normalize(),n1=new THREE.Vector3(...b.normal).normalize();
  const edge=new THREE.Vector3(...b.position).sub(new THREE.Vector3(...a.position));
  const off=n0.clone().multiplyScalar(edge.dot(n0)).addScaledVector(n1,-edge.dot(n1)).multiplyScalar(.125);
  const normal=n0.clone().add(n1).normalize();
  // Concave edges retain their clearance rather than rounding inward into a body.
  const inward=off.dot(normal);if(inward<0)off.addScaledVector(normal,-inward);
  off.clampLength(0,Math.min(.004,edge.length()*.12));maxOffset=Math.max(maxOffset,off.length());
  v.position=v.position.map((x,q)=>x+off.getComponent(q));v.normal=normal.toArray();
  added++;return put(key,v);
 }
 const ix=g.index.array;
 for(let i=0;i<ix.length;i+=3){
  const [a,b,c]=[ix[i],ix[i+1],ix[i+2]],s=source[c].slot[0];
  const A=original(a,s),B=original(b,s),C=original(c,s);
  if(Math.round(s)%10>=2){indices.push(A,B,C);continue;}
  const ab=midpoint(a,b,s),bc=midpoint(b,c,s),ca=midpoint(c,a,s);
  indices.push(A,ab,ca,ab,B,bc,ca,bc,C,ab,bc,ca);
 }
 const out=new THREE.BufferGeometry();
 for(const name of names){const Type=name==='skinIndex'?Uint16Array:Float32Array;out.setAttribute(name,new THREE.BufferAttribute(new Type(rows.flatMap(v=>v[name])),g.attributes[name].itemSize));}
 out.setIndex(indices);out.userData.refinement={addedVertices:added,maxOffset};g.dispose();return out;
}
// Cut actual geometry at the neckline, cuffs and hems. Each new edge receives a small
// rolled return with interpolated skin weights, in the same mesh/material/draw call.
// This avoids razor-thin shader-only edges while retaining the fitted sleeve topology.
function oldFinish(g, o, cut, R) {
 const names = Object.keys(g.attributes), rows = [], indices = [], cache = new Map(), rims = new Map();
 const read = (i) => Object.fromEntries(names.map(k => [k, Array.from({ length: g.attributes[k].itemSize }, (_, j) => g.attributes[k].array[i * g.attributes[k].itemSize + j])]));
 const source = new Map();
 const at = (i) => { if (!source.has(i)) source.set(i, { ...read(i), key: 'v' + i, trim: [0] }); return source.get(i); };
 function mix(a, b, t) {
  const key = a.key < b.key ? `${a.key}:${b.key}:${t.toFixed(7)}` : `${b.key}:${a.key}:${(1-t).toFixed(7)}`;
  const v = { key, trim: [0] };
  for (const k of names) v[k] = a[k].map((x, j) => x + (b[k][j] - x) * t);
  blendWeights(a,b,t,v);
  return v;
 }
 const put = (v) => { if (!cache.has(v.key)) { cache.set(v.key, rows.length); rows.push(v); } return cache.get(v.key); };
 const face = (a,b,c) => { indices.push(put(a),put(b),put(c)); };
 function clip(poly, f) {
  const out = [];
  for (let i=0;i<poly.length;i++) {
   const a=poly[i], b=poly[(i+1)%poly.length], da=f(a.position), db=f(b.position);
   if (da>=0) out.push(a);
   if ((da>=0)!==(db>=0)) out.push(mix(a,b,da/(da-db)));
  }
  return out;
 }
 const ix = g.index.array;
 for (let i=0;i<ix.length;i+=3) {
  let poly = [at(ix[i]),at(ix[i+1]),at(ix[i+2])];
  const val=poly[2].slot[0], s=Math.round(val)%10, limb=Math.floor(val/10), item=[o.top,o.outer,o.bottom,o.shoes][s];
  // The shader uses a flat region ID. Intersections must not create fractional IDs
  // between an arm and torso and accidentally address a different garment palette.
  poly=poly.map(v=>({...v,key:`${v.key}s${val}`,slot:[val]}));
  const cuts=[];
  // each edge's turned-back return: a knit's rib and a rolled sleeve are thicker than a hem
  const edge=(f,r=.0016)=>{f.radius=r;return f;}, ribbed=isRibbed(item);
  if (s<2 && item) {
   if (limb===0 || limb===2) {
    // (a shirt worn open over another top has a shirt-tail hem: up at the side seams; garment.js
    // discards the cloth below it the same way)
    const tail=v=>s===1&&isShirted(item)?.035*smooth((Math.abs(v[0])-.08)/.08):0;
    cuts.push(edge(v=>v[1]-(s===0?R.topHem:R.outHem+tail(v))-.012,ribbed?.0034:.0018));
    if (!item.onepiece && item.kind!=='bikini') cuts.push(edge(v=>{
     const fr=smooth((v[2]+.04)/.035), scoop=s===0?(item.kind==='tank'?.045:item.kind==='crop'?.025:0):0;
     return cut.neck-.005-scoop*fr+.035*smooth(Math.abs(v[0])/.09)-.004*fr-v[1];
    },ribbed?.003:.0016));
    // a sleeveless armhole cut clean in a curve (not left to whole triangles)
    if (item.sleeves==='none' && limb===0 && !item.onepiece && item.kind!=='bikini') cuts.push(edge(v=>armhole(v,cut),.0022));
   } else if (limb===1 && item.sleeves==='none') {
    cuts.push(edge(v=>armhole(v,cut),.0022));
    cuts.push(edge(v=>v[1]-cut.chest+.03,.0022));
    cuts.push(edge(v=>cut.neck-.005+.035*smooth(Math.abs(v[0])/.09)-v[1],.0016));
   } else if (limb===1) cuts.push(edge(v=>sleeveDistance(v,item.sleeves,cut),item.sleeves==='rolled'?.009:ribbed?.003:isShirted(item)?.0026:.0018));
  } else if (s===2 && limb===2 && R.legEnd<5) cuts.push(edge(v=>v[1]-R.legEnd-.012));
  // (the waistband's top cut clean, not left to whole triangles, with its edge turned)
  else if (s===2 && limb===0 && item && Number.isFinite(R.rise)) cuts.push(edge(v=>cut.waist+R.rise-.004-v[1],.0022));
  for (const f of cuts) { poly=clip(poly,f); if (poly.length<3) break; }
  if (poly.length<3) continue;
  for (let j=1;j<poly.length-1;j++) face(poly[0],poly[j],poly[j+1]);
  for (const f of cuts) for (let j=0;j<poly.length;j++) {
   const a=poly[j], b=poly[(j+1)%poly.length];
   if (Math.abs(f(a.position))>.0002 || Math.abs(f(b.position))>.0002) continue;
   const key=[a.key,b.key].sort().join('|');
   rims.set(key,{a,b,f});
  }
 }
 let rimId=0;
 for (const {a,b,f} of rims.values()) {
  const ring=[];
  for (let j=0;j<=4;j++) {
   const theta=j/4*Math.PI, band=[];
   for (const [k,v] of [a,b].entries()) {
    const q={...v,key:`r${rimId}:${j}:${k}`,trim:[Math.sin(theta)*.8+.2]}, pos=v.position;
    const n=new THREE.Vector3(...v.normal).normalize(), inward=new THREE.Vector3();
    for(let ax=0;ax<3;ax++){const hi=[...pos],lo=[...pos];hi[ax]+=.0001;lo[ax]-=.0001;inward.setComponent(ax,(f(hi)-f(lo))/.0002);}
    inward.addScaledVector(n,-inward.dot(n)).normalize();
    const radius=f.radius||.0016;
    q.position=new THREE.Vector3(...pos).addScaledVector(n,radius*(Math.cos(theta)-1)).addScaledVector(inward,radius*Math.sin(theta)).toArray();
    q.normal=n.multiplyScalar(Math.cos(theta)).addScaledVector(inward,Math.sin(theta)).normalize().toArray();
    band.push(q);
   }
   ring.push(band);
   if(j){const [c,d]=ring[j-1];face(c,d,band[0]);face(d,band[1],band[0]);}
  }
  rimId++;
 }
 const out=new THREE.BufferGeometry();
 for(const name of [...names,'trim']) {
  const size=name==='trim'?1:g.attributes[name].itemSize, Type=name==='skinIndex'?Uint16Array:Float32Array;
  out.setAttribute(name,new THREE.BufferAttribute(new Type(rows.flatMap(v=>v[name])),size));
 }
 out.setIndex(indices);out.computeBoundingSphere();out.userData.tailoring={edgeSegments:rims.size,vertices:rows.length,refinement:g.userData.refinement};
 g.dispose();return out;
}

// ---------- random garments: a torso, two sleeves and the legs, in their regions ----------
function rng(seed) { let h = seed >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
function garment(seed) {
	const r = rng(seed), rows = { position: [], normal: [], uv: [], skinIndex: [], skinWeight: [], slot: [], drape: [], cuff: [], sleeve: [] }, index = [];
	const part = (slot, cx, cy, rad, h, tilt) => {
		const base = rows.position.length, R = 10, H = 12;
		for (let j = 0; j <= H; j++) for (let i = 0; i < R; i++) {
			const a = i / R * Math.PI * 2, y = cy - h / 2 + h * j / H;
			rows.position.push([cx + Math.cos(a) * rad + tilt * (y - cy), y, Math.sin(a) * rad]);
			rows.normal.push([Math.cos(a), r() * .2 - .1, Math.sin(a)]);
			rows.uv.push([i / R, j / H]);
			const b = Math.floor(r() * 20);
			rows.skinIndex.push([b, b + 1, Math.floor(r() * 30), 0]);
			const w = r(); rows.skinWeight.push([w, 1 - w, 0, 0]);
			rows.slot.push([slot]); rows.drape.push([r()]); rows.cuff.push([r()]); rows.sleeve.push([r(), r() * .03]);
		}
		for (let j = 0; j < H; j++) for (let i = 0; i < R; i++) {
			const a = base + j * R + i, b = base + j * R + (i + 1) % R, c = a + R, d = b + R;
			index.push(a, b, c, b, d, c);
		}
	};
	part(0, 0, 1.25, .16, .6, 0); part(1, 0, 1.2, .18, .7, 0);          // the top and an outer layer
	part(10, .3, 1.3, .05, .5, .8); part(11, -.3, 1.3, .055, .5, -.8);  // sleeves
	part(2, 0, .9, .15, .3, 0); part(22, .09, .5, .06, .8, 0);         // the trousers' waist and a leg
	const g = new THREE.BufferGeometry();
	for (const [k, v] of Object.entries(rows)) g.setAttribute(k, new THREE.BufferAttribute(new (k === 'skinIndex' ? Uint16Array : Float32Array)(v.flat()), v[0].length));
	g.setIndex(index);
	return g;
}
const plane = (y) => [0, -1, 0, -y];
const cut = { shoulderX: .2, chest: 1.3, neck: 1.5, waist: 1.0, shoulder: 1.48, sleevePlanes: { L: { short: plane(1.2), long: plane(1.05), rolled: plane(1.15), none: plane(1.4) }, R: { short: plane(1.22), long: plane(1.0), rolled: plane(1.1), none: plane(1.4) } } };
const outfits = [
	{ top: { kind: 'tee', sleeves: 'short' }, bottom: { kind: 'jeans' } },
	{ top: { kind: 'tank', sleeves: 'none' }, outer: { kind: 'shirt', sleeves: 'rolled' }, bottom: { kind: 'chinos' } },
	{ top: { kind: 'crop', sleeves: 'long', fab: 'rib' }, bottom: { kind: 'shorts' } },
	{ top: { kind: 'hoodie', sleeves: 'long', fab: 'fleece' }, outer: { kind: 'jacket', sleeves: 'long' } },
	{ top: { kind: 'dress', sleeves: 'none', onepiece: true }, bottom: null },
];
const R = [{ topHem: 1.0, outHem: .95, legEnd: .3, rise: .02 }, { topHem: 1.1, outHem: 1.0, legEnd: 9 }, {}];
const same = (a, b) => {
	assert.deepEqual(Object.keys(a.attributes), Object.keys(b.attributes));
	for (const k of Object.keys(a.attributes)) {
		const x = a.attributes[k], y = b.attributes[k];
		assert.equal(x.array.constructor, y.array.constructor, k); assert.equal(x.itemSize, y.itemSize, k);
		assert.deepEqual(Buffer.from(x.array.buffer, x.array.byteOffset, x.array.byteLength), Buffer.from(y.array.buffer, y.array.byteOffset, y.array.byteLength), k);
	}
	assert.deepEqual([...a.index.array], [...b.index.array]);
};

test('garments are cut and rounded exactly as before', () => {
	let edges = 0;
	for (let seed = 1; seed <= 3; seed++) for (const o of outfits) for (const r of R) {
		const want = oldFinish(garment(seed), o, cut, r), got = finishGarmentEdges(garment(seed), o, cut, r);
		same(got, want);
		assert.deepEqual(got.userData.tailoring, want.userData.tailoring);
		edges += want.userData.tailoring.edgeSegments;
		const w2 = oldFinish(oldRefine(garment(seed)), o, cut, r), g2 = finishGarmentEdges(refineGarmentSurface(garment(seed)), o, cut, r);
		same(g2, w2);
		assert.deepEqual(g2.userData.tailoring, w2.userData.tailoring);
	}
	assert.ok(edges > 100, `${edges} edge segments`);
});
