import * as THREE from 'three';
import { isRibbed, isShirted } from './garment-shape.js';

const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

// how far inside a sleeveless garment's armhole a point lies (metres; negative outside)
export const armhole = (v, cut) => cut.shoulderX - .03 + Math.max(0, cut.chest - .07 - v[1]) * 1.5 - Math.abs(v[0]);

export function sleeveDistance(v, sleeve, cut) {
 const plane=cut.sleevePlanes[v[0]>=0?'L':'R'][sleeve||'short'];
 return plane[3]-plane[0]*v[0]-plane[1]*v[1]-plane[2]*v[2];
}

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
export function refineGarmentSurface(g) {
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

// A woven top bridges the hollows of a torso rather than following every skin normal.
// Fit the front/back panels to a rounded cross section; retain shoulders and armholes.
// All movement is outward, and stretch garments keep their original body fit.
export function drapePanels(g, o, cut, R) {
 const p = g.attributes.position, slot = g.attributes.slot;
 const rx = Math.max(cut.waistX, cut.shoulderX * .94, .08);
 const front = cut.drapeFront, back = cut.drapeBack, zc = (front + back) / 2;
 if (![front, back, rx].every(Number.isFinite)) return;
 for (let i = 0; i < p.count; i++) {
  const s = Math.round(slot.getX(i)) % 10, limb = Math.floor(slot.getX(i) / 10);
  const item = s === 0 ? o.top : s === 1 ? o.outer : null;
  if (!item || limb !== 0 || item.fit === 'tight' || /bikini|swim/.test(item.kind || '')) continue;
  const x = p.getX(i), y = p.getY(i), z = p.getZ(i), hem = s === 0 ? R.topHem : R.outHem;
  const upper = smooth((cut.shoulder - .025 - y) / .12);
  const side = 1 - smooth((Math.abs(x) / rx - .72) / .32);
  const ease = /slim|fitted/.test(item.fit || '') ? .6 : 1;
  const lower = item.tuck ? smooth((y - hem) / .1) : 1;
  const blend = upper * side * ease * lower;
  if (blend === 0 || y < hem - .02) continue;
  // Superellipse with a broad front, plus a few shallow hanging folds.
  const curve = Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / rx), 4)));
  const fold = (.5 + .5 * Math.cos(x * 48 + Math.sin(y * 7) * .65)) * .0035 * smooth((cut.chest - y) / .18);
  const allowance = s === 1 ? .026 : .012;
  const target = z >= zc ? zc + (front - zc) * curve + allowance + fold : zc - (zc - back) * curve - allowance - fold;
  p.setZ(i, z + (z >= zc ? Math.max(0, target - z) : Math.min(0, target - z)) * blend);
 }
}

// Cut actual geometry at the neckline, cuffs and hems. Each new edge receives a small
// rolled return with interpolated skin weights, in the same mesh/material/draw call.
// This avoids razor-thin shader-only edges while retaining the fitted sleeve topology.
export function finishGarmentEdges(g, o, cut, R) {
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
