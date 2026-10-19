/* TREE_SURFACES_204 */
/* NATIVE_TREES_BUILD_127 */
(function(root){
'use strict';
const defaults={version:1,generator:'woodland-1',seed:1937,latitude:38,rainfall:.55,elevation:80,height:7,branches:9,foliage:0.72,spread:1,trees:18,wind:0.35,wetness:0.25,daylight:0.72,moss:0.4};
const limits={latitude:[-80,80,0],rainfall:[0,1,0],elevation:[0,2400,1],seed:[1,999999,1],height:[3,12,0],branches:[4,16,1],foliage:[0.15,1,0],spread:[0.55,1.6,0],trees:[3,32,1],wind:[0,1,0],wetness:[0,1,0],daylight:[0.15,1,0],moss:[0,1,0]};
function validate(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a world recipe object.');if(input.version!==undefined&&input.version!==1)throw Error('Unsupported recipe version.');if(input.generator!==undefined&&input.generator!==defaults.generator)throw Error('Unsupported generator.');let r={...defaults};for(const k in limits)if(input[k]!==undefined){if(typeof input[k]!=='number'||!Number.isFinite(input[k]))throw Error('Invalid '+k);const [a,b,int]=limits[k];r[k]=Math.max(a,Math.min(b,input[k]));if(int)r[k]=Math.round(r[k]);}return r;}
function random(seed){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let x=Math.imul(t^t>>>15,1|t);x^=x+Math.imul(x^x>>>7,61|x);return ((x^x>>>14)>>>0)/4294967296;};}
function tree(input,seed){const r=validate(input),rand=random(seed||r.seed),segments=[],leaves=[];const h=r.height,lean=(rand()-.5)*.8;
const trunk=[];for(let i=0;i<=7;i++)trunk.push([lean*i/7+Math.sin(i*.7)*.12,h*i/7,Math.sin(i*.9)*.12]);
for(let i=0;i<7;i++)segments.push({a:trunk[i],b:trunk[i+1],ra:.23*(1-i/8)*h/7,rb:.23*(1-(i+1)/8)*h/7});
for(let j=0;j<r.branches;j++){let y=h*(.32+.6*j/r.branches),angle=j*2.399963+rand()*.5,len=h*(.29+(1-j/r.branches)*.22)*r.spread,start=[lean*y/h,y,0];
let end=[start[0]+Math.cos(angle)*len,start[1]+len*.38,start[2]+Math.sin(angle)*len];segments.push({a:start,b:end,ra:.075*h/7*(1-j/r.branches*.55),rb:.017});
for(let k=0;k<5;k++){let f=.3+k*.15,twigA=start.map((v,i)=>v+(end[i]-v)*f),ta=angle+(k%2?1:-1)*(.5+rand()*.6),tl=len*(.28+rand()*.22),twigB=[twigA[0]+Math.cos(ta)*tl,twigA[1]+tl*.6,twigA[2]+Math.sin(ta)*tl];segments.push({a:twigA,b:twigB,ra:.018,rb:.004});
// Stable leaf candidates: changing density preserves the remaining foliage.
for(let n=0;n<30;n++){let keep=rand(),t=rand(),radius=rand()*.72,a=rand()*Math.PI*2,offset=(rand()-.5)*.65;let leaf={p:[twigA[0]+(twigB[0]-twigA[0])*t+Math.cos(a)*radius,twigA[1]+(twigB[1]-twigA[1])*t+offset,twigA[2]+(twigB[2]-twigA[2])*t+Math.sin(a)*radius],rotation:[rand()*.9,rand()*Math.PI*2,rand()*.8],size:.13+rand()*.15,tone:rand()};if(keep<=r.foliage)leaves.push(leaf);}
}}
return {segments,leaves};}
function terrain(x,z){if(z<-11&&Math.abs(x)<2.1)return -.035*(-11-z);return Math.sin(x*.11)*.25+Math.cos(z*.16)*.2;}
function placements(input){const r=validate(input),rand=random(r.seed+71),out=[];for(let i=0;i<r.trees;i++){let a=(i+.2)*2.399963,rad=7+rand()*18,x=Math.cos(a)*rad,z=Math.sin(a)*rad;if(z<-8&&Math.abs(x)<5)x+=x<0?-6:6;out.push({x,z,y:terrain(x,z),rotation:rand()*6.283,scale:.72+rand()*.55,variant:i%4});}return out;}
function prompt(input,text){let r=validate(input),s=text.toLowerCase(),applied=[];function set(k,v,label){r[k]=v;applied.push(label);}
if(/dense|lush|overgrown/.test(s)){set('foliage',.94,'Dense foliage');set('trees',28,'More trees');}
if(/sparse|open/.test(s)){set('foliage',.4,'Sparse foliage');set('trees',10,'Open woodland');}
if(/old|ancient/.test(s)){set('height',10,'Older, taller trees');set('branches',14,'More branches');set('moss',.8,'Mossy bark');}
if(/wet|rain|damp/.test(s))set('wetness',.85,'Wet surfaces');
if(/dry/.test(s))set('wetness',.05,'Dry surfaces');
if(/sunset|golden|dusk/.test(s))set('daylight',.28,'Golden evening');
if(/bright|noon|daytime/.test(s))set('daylight',.9,'Daylight');
if(/windy|storm/.test(s))set('wind',.8,'Strong wind');
if(/calm|still/.test(s))set('wind',.08,'Calm wind');
return {recipe:r,applied};}
const api={defaults,limits,validate,random,tree,placements,terrain,prompt};if(typeof module!=='undefined')module.exports=api;else root.ForgeRecipe=api;
})(typeof self!=='undefined'?self:globalThis);

/* TREES_127: bounded native canopy assets and Bard-driven material motion. */
(function(root){'use strict';
const realms=new Map(),types=['temperate','wetland','alpine','scrub','warm','cavern'];
const presets={temperate:{height:7,branches:10,foliage:.8,spread:1},wetland:{height:8,branches:12,foliage:.94,spread:1.3},alpine:{height:6,branches:12,foliage:.55,spread:.58},scrub:{height:4,branches:6,foliage:.35,spread:1.15},warm:{height:8,branches:11,foliage:.86,spread:1.45},cavern:{height:3,branches:6,foliage:.45,spread:.6}};
function kind(field){return field.region==='alpine'?'alpine':field.region==='wetland'?'wetland':field.region==='dry scrub'?'scrub':field.region==='warm woodland'?'warm':field.region.indexOf('cave')>=0?'cavern':'temperate';}
function create(THREE,realm){if(realms.has(realm))return realms.get(realm);const cache={};
const uniforms={uTreeTime127:{value:0},uTreeBass127:{value:0},uTreeMid127:{value:0},uTreeHigh127:{value:0},uTreeWind127:{value:.15},uTreeWet127:{value:0}};
const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.85});
mat.name='World Forge · living canopy';mat.customProgramCacheKey=()=> 'world-forge-canopy-127';
const declarations='uniform float uTreeTime127,uTreeBass127,uTreeMid127,uTreeHigh127,uTreeWind127,uTreeWet127;\n';
const movement=`
vec3 treeOrigin127=vec3(0.0);
#ifdef USE_INSTANCING
treeOrigin127=instanceMatrix[3].xyz;
#endif
float phase127=treeOrigin127.x*.13+treeOrigin127.z*.19;
float weight127=clamp(aHeight127,0.0,1.0);weight127*=weight127;
float sway127=sin(uTreeTime127*.85+phase127)*(uTreeWind127*.16+uTreeBass127*.14)*weight127;
transformed.x+=sway127;
transformed.z+=cos(uTreeTime127*.63+phase127)*uTreeWind127*.07*weight127;
transformed.y+=aLeaf127*sin(uTreeTime127*2.1+position.x*2.0+phase127)*uTreeMid127*.04;
`;
mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=declarations+'attribute float aLeaf127; attribute float aHeight127; varying float vLeaf127;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLeaf127=aLeaf127;\n'+movement);shader.fragmentShader=declarations+'varying float vLeaf127;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.0-uTreeWet127*.16;\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.94,1.08,1.03),uTreeMid127*vLeaf127*.22);');shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.08,.16,.09)*uTreeHigh127*vLeaf127;');};
// Shadows use the same deformation, avoiding stationary shadows beneath swaying trees.
const depthMat=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});depthMat.customProgramCacheKey=()=> 'world-forge-depth-127';depthMat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=declarations+'attribute float aLeaf127; attribute float aHeight127;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+movement);};
function geometry(type,variant=0,lod='near'){
 lod=lod==='far'?'far':'near';const key=type+':'+(variant&1)+':'+lod;if(cache[key])return cache[key];if(!presets[type])throw Error('Unknown tree habitat');
 const settings={...root.ForgeRecipe.defaults,...presets[type],seed:127+types.indexOf(type)*391+(variant&1)*719};
 const data=root.ForgeRecipe.tree(settings),positions=[],colors=[],leaves=[],heights=[],leafUV204=[];
 const green=type==='cavern'?[.3,.56,.52]:type==='scrub'?[.36,.4,.21]:type==='alpine'?[.15,.3,.23]:[.24,.43,.17];
 function tri(a,b,c,color,leaf,uv){let j=0;for(const v of [a,b,c]){positions.push(...v);colors.push(...color);leaves.push(leaf);heights.push(v[1]/settings.height);leafUV204.push(...(uv?uv[j++]:[0,0]));}}
 for(const s of data.segments){const a=new THREE.Vector3(...s.a),b=new THREE.Vector3(...s.b),dir=b.clone().sub(a).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);const sides=lod==='far'?4:6;for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2,u=(i+1)/sides*Math.PI*2;function point(v,r,angle){return new THREE.Vector3(Math.cos(angle)*r,0,Math.sin(angle)*r).applyQuaternion(q).add(v).toArray();}const p0=point(a,s.ra,t),p1=point(a,s.ra,u),p2=point(b,s.rb,t),p3=point(b,s.rb,u);tri(p0,p2,p3,[.24,.19,.13],0);tri(p0,p3,p1,[.27,.22,.16],0);}}
 const limit=lod==='far'?100:420,step=Math.max(1,Math.ceil(data.leaves.length/limit));
 for(let i=0;i<data.leaves.length;i+=step){const l=data.leaves[i],m=new THREE.Matrix4().compose(new THREE.Vector3(...l.p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...l.rotation)),new THREE.Vector3(1,1,1).multiplyScalar(l.size*(lod==='far'?2.1:1.55)));const pts=[[0,0,0],[-.48,.45,.08],[0,1.1,0],[.48,.45,.08]].map(p=>new THREE.Vector3(...p).applyMatrix4(m).toArray());const col=green.map(v=>v*(.82+l.tone*.38));tri(pts[0],pts[1],pts[2],col,1,[[.5,0],[0,.41],[.5,1]]);tri(pts[0],pts[2],pts[3],col,1,[[.5,0],[.5,1],[1,.41]]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('aLeaf127',new THREE.Float32BufferAttribute(leaves,1));g.setAttribute('aHeight127',new THREE.Float32BufferAttribute(heights,1));g.setAttribute('aLeafUV204',new THREE.Float32BufferAttribute(leafUV204,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.boundingSphere.radius+=.3;g.userData.forgeTree127=true;cache[key]=g;return g;
}
function decorate(mesh){mesh.customDepthMaterial=depthMat;mesh.userData.forgeTree127=true;return mesh;}
root.L99WorldSurfaces204.tree(THREE,mat);
const kit={geometry,material:mat,decorate,uniforms,cache,types,kind,last:0};realms.set(realm,kit);return kit;
}
function tick(realm,now,bands,environment={}){const kit=realms.get(realm);if(!kit)return;const finite=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;const dt=Math.min(.1,Math.max(0,(now-kit.last)/1000));kit.last=now;const reduced=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;const enabled=root._BARD_TREE_REACT!==false;
for(const [key,value] of [['uTreeBass127',bands&&bands.bass],['uTreeMid127',bands&&bands.mid],['uTreeHigh127',bands&&bands.high]]){const target=enabled?finite(finite(value)*1.8):0,old=kit.uniforms[key].value;kit.uniforms[key].value=old+(target-old)*(1-Math.exp(-dt*(target>old?14:4)));}
kit.uniforms.uTreeTime127.value=now/1000;kit.uniforms.uTreeWind127.value=reduced?0:finite(environment.wind);kit.uniforms.uTreeWet127.value=finite(environment.wetness);if(reduced){kit.uniforms.uTreeBass127.value=0;kit.uniforms.uTreeMid127.value=0;}kit.material.roughness=.88-finite(environment.wetness)*.25;
}
function state(){return Array.from(realms,([realm,k])=>({realm,geometries:Object.keys(k.cache).length,bass:k.uniforms.uTreeBass127.value,mid:k.uniforms.uTreeMid127.value,high:k.uniforms.uTreeHigh127.value}));}
root.L99Trees127={create,tick,kind,types,state};
})(typeof window!=='undefined'?window:globalThis);
