/* SHARED_REALISM_BUILD_133 */
/* TREES_133: bounded native canopy assets and Bard-driven material motion. */
(function(root){'use strict';
const realms=new Map(),types=['temperate','wetland','alpine','scrub','warm','cavern'];
const presets={temperate:{height:7,branches:10,foliage:.8,spread:1},wetland:{height:8,branches:12,foliage:.94,spread:1.3},alpine:{height:6,branches:12,foliage:.55,spread:.58},scrub:{height:4,branches:6,foliage:.35,spread:1.15},warm:{height:8,branches:11,foliage:.86,spread:1.45},cavern:{height:3,branches:6,foliage:.45,spread:.6}};
function kind(field){return field.region==='alpine'?'alpine':field.region==='wetland'?'wetland':field.region==='dry scrub'?'scrub':field.region==='warm woodland'?'warm':field.region.indexOf('cave')>=0?'cavern':'temperate';}
function create(THREE,realm){if(realms.has(realm))return realms.get(realm);const cache={};
const uniforms={uTreeTime127:{value:0},uTreeBass127:{value:0},uTreeMid127:{value:0},uTreeHigh127:{value:0},uTreeWind127:{value:.15},uTreeWet127:{value:0}};
const mat=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.85});mat.map=root.L99Leaves227.texture(THREE);mat.alphaTest=.46;mat.roughness=.9;
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
/* LEAVES_227 */function geometry(type,variant=0,lod='near'){
 lod=lod==='far'?'far':'near';const key=type+':'+(variant&1)+':'+lod;if(cache[key])return cache[key];if(!presets[type])throw Error('Unknown tree habitat');
 const settings={...root.ForgeRecipe.defaults,...presets[type],seed:127+types.indexOf(type)*391+(variant&1)*719};
 const data=root.ForgeRecipe.tree(settings),positions=[],colors=[],leaves=[],heights=[],uvs=[];
 const green=type==='cavern'?[.3,.56,.52]:type==='scrub'?[.4,.46,.22]:type==='alpine'?[.16,.34,.24]:[.27,.5,.19];
 function tri(a,b,c,color,leaf,ua,ub,uc){const U=[ua||[.98,.98],ub||[.98,.98],uc||[.98,.98]];let k=0;for(const v of [a,b,c]){positions.push(...v);colors.push(...color);leaves.push(leaf);heights.push(v[1]/settings.height);uvs.push(...U[k++]);}}
 for(const s of data.segments){const a=new THREE.Vector3(...s.a),b=new THREE.Vector3(...s.b),dir=b.clone().sub(a).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir);const sides=lod==='far'?5:7;for(let i=0;i<sides;i++){const t=i/sides*Math.PI*2,u=(i+1)/sides*Math.PI*2;function point(v,r,angle){return new THREE.Vector3(Math.cos(angle)*r,0,Math.sin(angle)*r).applyQuaternion(q).add(v).toArray();}const p0=point(a,s.ra,t),p1=point(a,s.ra,u),p2=point(b,s.rb,t),p3=point(b,s.rb,u);tri(p0,p2,p3,[.24,.19,.13],0);tri(p0,p3,p1,[.27,.22,.16],0);}}
 const cards=lod==='far'?44:118,step=Math.max(1,Math.floor(data.leaves.length/cards)),first=positions.length/3;
 for(let i=0;i<data.leaves.length;i+=step){const l=data.leaves[i],sz=l.size*(lod==='far'?5.2:4.1)*(type==='alpine'?.8:1),m=new THREE.Matrix4().compose(new THREE.Vector3(...l.p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...l.rotation)),new THREE.Vector3(sz,sz,sz)),col=green.map(v=>v*(.78+l.tone*.46));
  const P=[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]].map(p=>new THREE.Vector3(...p).applyMatrix4(m).toArray());
  tri(P[0],P[1],P[2],col,1,[0,0],[.94,0],[.94,.94]);tri(P[0],P[2],P[3],col,1,[0,0],[.94,.94],[0,.94]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('aLeaf127',new THREE.Float32BufferAttribute(leaves,1));g.setAttribute('aHeight127',new THREE.Float32BufferAttribute(heights,1));g.computeVertexNormals();
 /* crown normals: out from the canopy's centre and a little up, so the
    whole crown shades like one soft volume instead of a hundred cards */
 const pa=g.attributes.position,na=g.attributes.normal,n=pa.count;let cx=0,cy=0,cz=0,cn=0;for(let i=first;i<n;i++){cx+=pa.getX(i);cy+=pa.getY(i);cz+=pa.getZ(i);cn++;}
 if(cn){cx/=cn;cy/=cn;cz/=cn;const v=new THREE.Vector3();for(let i=first;i<n;i++){v.set(pa.getX(i)-cx,(pa.getY(i)-cy)*.8,pa.getZ(i)-cz).normalize().multiplyScalar(.78);v.y+=.42;v.normalize();na.setXYZ(i,v.x,v.y,v.z);}na.needsUpdate=true;}
 g.computeBoundingBox();g.computeBoundingSphere();g.boundingSphere.radius+=.6;g.userData.forgeTree127=true;cache[key]=g;return g;
}
function decorate(mesh){mesh.customDepthMaterial=depthMat;mesh.userData.forgeTree127=true;return mesh;}
const kit={geometry,material:mat,decorate,uniforms,cache,types,kind,last:0};realms.set(realm,kit);return kit;
}
function tick(realm,now,bands,environment={}){const kit=realms.get(realm);if(!kit)return;const finite=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;const dt=Math.min(.1,Math.max(0,(now-kit.last)/1000));kit.last=now;const reduced=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;const enabled=root._BARD_TREE_REACT!==false;
for(const [key,value] of [['uTreeBass127',bands&&bands.bass],['uTreeMid127',bands&&bands.mid],['uTreeHigh127',bands&&bands.high]]){const target=enabled?finite(finite(value)*1.8):0,old=kit.uniforms[key].value;kit.uniforms[key].value=old+(target-old)*(1-Math.exp(-dt*(target>old?14:4)));}
kit.uniforms.uTreeTime127.value=now/1000;kit.uniforms.uTreeWind127.value=reduced?0:finite(environment.wind);kit.uniforms.uTreeWet127.value=finite(environment.wetness);if(reduced){kit.uniforms.uTreeBass127.value=0;kit.uniforms.uTreeMid127.value=0;}kit.material.roughness=.88-finite(environment.wetness)*.25;
}
function state(){return Array.from(realms,([realm,k])=>({realm,geometries:Object.keys(k.cache).length,bass:k.uniforms.uTreeBass127.value,mid:k.uniforms.uTreeMid127.value,high:k.uniforms.uTreeHigh127.value}));}
root.L99Trees127={create,tick,kind,types,state};
})(typeof window!=='undefined'?window:globalThis);

/* FOLIAGE_133: seven bounded, shared botanical silhouettes; no animation loop. */
(function(root){'use strict';
function create(THREE){const cache={};
function geometry(kind){if(cache[kind])return cache[kind];const p=[],c=[];const colors={fern:[.18,.39,.16],reed:[.42,.49,.2],grass:[.4,.48,.2],shrub:[.23,.36,.16],succulent:[.32,.49,.38],fungus:[.48,.38,.27],glowmoss:[.15,.48,.42]};const col=colors[kind]||colors.grass;
function tri(a,b,d,tone=1){p.push(...a,...b,...d);for(let i=0;i<3;i++)c.push(...col.map(x=>x*tone));}
function blade(a,b,width,angle,tone){const length=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);function point(t,side){const w=Math.pow(Math.sin(Math.PI*t),.8)*width;return[a[0]+(b[0]-a[0])*t+Math.cos(angle)*w*side,a[1]+(b[1]-a[1])*t+Math.sin(t*Math.PI)*length*.06-side*side*w*.18,a[2]+(b[2]-a[2])*t+Math.sin(angle)*w*side];}for(let j=0;j<3;j++)for(const side of [-1,1]){const t=j/3,u=(j+1)/3;tri(point(t,0),point(t,side),point(u,side),tone);tri(point(t,0),point(u,side),point(u,0),tone*.94);}}
function stem(x,z,height,radius,tone=1){for(let j=0;j<8;j++){const a=j*Math.PI/4,b=(j+1)*Math.PI/4,lo=[x+Math.cos(a)*radius,0,z+Math.sin(a)*radius],lo2=[x+Math.cos(b)*radius,0,z+Math.sin(b)*radius],hi=[x+Math.cos(a)*radius*.7,height,z+Math.sin(a)*radius*.7],hi2=[x+Math.cos(b)*radius*.7,height,z+Math.sin(b)*radius*.7];tri(lo,hi,hi2,tone);tri(lo,hi2,lo2,tone);}}

if(kind==='fern'){for(let f=0;f<7;f++){let a=f*Math.PI*2/7;for(let j=0;j<8;j++){const point=t=>[Math.cos(a)*t*.62,Math.sin(t*Math.PI)*.4+.08,Math.sin(a)*t*.62],b=point(j/8),d=point((j+1)/8),w=.005,off=v=>[v[0]+Math.cos(a+1.57)*w,v[1],v[2]+Math.sin(a+1.57)*w];tri(b,off(b),d,.6);tri(off(b),off(d),d,.6);}for(let i=1;i<8;i++){let t=i/8,base=[Math.cos(a)*t*.62,Math.sin(t*Math.PI)*.4+.08,Math.sin(a)*t*.62];for(let side of [-1,1]){let q=a+side*.8,w=(1-t)*.33;blade(base,[base[0]+Math.cos(q)*w,base[1]-.02,base[2]+Math.sin(q)*w],.035,q+1.57,.85+i*.025);}}}}
else if(kind==='fungus'){for(let j=0;j<4;j++){const x=Math.sin(j*2.4)*.25,z=Math.cos(j*2.4)*.25,h=.25+j*.1,r=.15+j*.025;stem(x,z,h,.017,.74);for(let ring=0;ring<4;ring++)for(let i=0;i<20;i++){const point=(q,angle)=>[x+Math.sin(q*Math.PI*.46)*Math.cos(angle)*r,h+Math.cos(q*Math.PI*.46)*r*.5,z+Math.sin(q*Math.PI*.46)*Math.sin(angle)*r],a=i*Math.PI/10,b=(i+1)*Math.PI/10,t=ring/4,u=(ring+1)/4;tri(point(t,a),point(u,a),point(u,b),.9+j*.035);tri(point(t,a),point(u,b),point(t,b),.9+j*.035);}for(let i=0;i<20;i++){const a=i*Math.PI/10,b=(i+1)*Math.PI/10;tri([x,h,z],[x+Math.cos(a)*r,h+r*.06,z+Math.sin(a)*r],[x+Math.cos(b)*r,h+r*.06,z+Math.sin(b)*r],.72);}}}

else{let n=kind==='shrub'?30:kind==='glowmoss'?18:12;for(let i=0;i<n;i++){let a=i*2.39996,t=(i%7)/7,x=Math.cos(a)*t*.35,z=Math.sin(a)*t*.35,h=kind==='reed'?1.1+t*.55:kind==='succulent'?.15+t*.23:kind==='glowmoss'?.06+t*.12:kind==='shrub'?.3+t*.65:.25+t*.45,w=kind==='succulent'?.1:kind==='shrub'?.13:.025;blade([x,0,z],[x+Math.cos(a)*.2,h,z+Math.sin(a)*.2],w,a+1.57,.8+t*.3);if(kind==='reed'){stem(x,z,h,.007,.7);blade([x,h*.8,z],[x,h,z],.025,a,.6);}}}
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingSphere();cache[kind]=g;return g;}
return {geometry,dispose(){for(const k in cache)cache[k].dispose();}};
}
if(typeof module!=='undefined')module.exports={create};else root.L99Foliage={create};
})(typeof window!=='undefined'?window:globalThis);

window.L99MaterialData133={"skin":{"size":256,"mean":172.936,"rgb":[204.82,166.18,145.96],"tile":0,"data":""},"linen":{"size":256,"mean":176.291,"rgb":[188.97,174.31,158.61],"tile":1,"data":""},"leather":{"size":256,"mean":116.891,"rgb":[131.29,114.13,101.81],"tile":2,"data":""},"fur":{"size":256,"mean":120.953,"rgb":[134.11,118.61,105.47],"tile":3,"data":""},"denim":{"size":256,"mean":77.796,"rgb":[68.9,78.99,92.14],"tile":4,"data":""},"wool":{"size":256,"mean":65.644,"rgb":[68.17,65.03,64.26],"tile":5,"data":""},"scales":{"size":256,"mean":92.813,"rgb":[101.26,91.22,83.75],"tile":6,"data":""},"feathers":{"size":256,"mean":134.506,"rgb":[141.43,133.19,127.12],"tile":7,"data":""},"oak":{"size":256,"mean":93.782,"rgb":[99.54,93.21,82.5],"tile":8,"data":""},"birch":{"size":256,"mean":166.565,"rgb":[169.54,166.06,162.78],"tile":9,"data":""},"leaf":{"size":256,"mean":91.899,"rgb":[68.56,104.36,37.2],"tile":10,"data":""},"needles":{"size":256,"mean":66.89,"rgb":[52.82,73.44,43.49],"tile":11,"data":""},"moss":{"size":256,"mean":87.534,"rgb":[86.99,93.43,30.69],"tile":12,"data":""},"lichen":{"size":256,"mean":131.214,"rgb":[138.3,130.82,114.29],"tile":13,"data":""},"fungus":{"size":256,"mean":174.938,"rgb":[192.71,172.46,147.18],"tile":14,"data":""},"reed":{"size":256,"mean":144.565,"rgb":[161.41,144.68,93.84],"tile":15,"data":""},"banded-fur":{"size":256,"mean":72.763,"rgb":[98.89,67.83,44.72],"tile":16,"data":""},"spotted-fur":{"size":256,"mean":86.56,"rgb":[111.18,81.94,59.81],"tile":17,"data":""},"teal-feathers":{"size":256,"mean":61.778,"rgb":[28.28,69.55,83.44],"tile":18,"data":""},"suede":{"size":256,"mean":54.106,"rgb":[93.83,44.65,30.79],"tile":19,"data":""}};

/* MATERIALS_133: generated image detail compiled to bounded runtime texture maps. */
(function(root){'use strict';const factories=new WeakMap();
function create(T){if(factories.has(T))return factories.get(T);const cache=new Map();
function entry(name){return root.L99MaterialData133[name]||root.L99MaterialData133.linen;}
function get(name){if(cache.has(name))return cache.get(name);const e=entry(name),bytes=Uint8Array.from(atob(e.data),c=>c.charCodeAt(0)),size=e.size,rgba=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);const skin=name==='skin',fur=/fur|wool|feather/.test(name),baseRough=skin?.67:fur?.92:/leather|suede/.test(name)?.76:name==='scales'?.58:.86;
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const j=y*size+x,i=j*4,value=bytes[/linen|denim|wool|suede/.test(name)?((y*3)%size)*size+(x*3)%size:j],relative=Math.max(.38,Math.min(1,value/Math.max(1,e.mean)*.83));let b=Math.round((skin?.92+relative*.08:relative)*255);rgba[i]=rgba[i+1]=rgba[i+2]=b;rgba[i+3]=255;
const dx=(bytes[y*size+(x+1)%size]-bytes[y*size+(x+size-1)%size])/255,dy=(bytes[((y+1)%size)*size+x]-bytes[((y+size-1)%size)*size+x])/255;normal[i]=Math.round(128-dx*65);normal[i+1]=Math.round(128-dy*65);normal[i+2]=255;normal[i+3]=255;rough[i]=rough[i+1]=rough[i+2]=Math.round(Math.max(.3,Math.min(1,baseRough+(relative-.8)*.08))*255);rough[i+3]=255;}
function tex(data){const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.MirroredRepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;}
const result={map:tex(rgba),normalMap:tex(normal),roughnessMap:tex(rough),name};cache.set(name,result);return result;}
function apply(mat,name){const m=get(name);mat.map=m.map;mat.normalMap=m.normalMap;mat.normalScale=new T.Vector2(name==='skin'?.13:.38,name==='skin'?.13:.38);mat.roughnessMap=m.roughnessMap;mat.roughness=1;mat.bumpMap=null;mat.bumpScale=0;mat.userData=mat.userData||{};mat.userData.material133=name;mat.needsUpdate=true;return mat;}
const botanical=['oak','birch','leaf','needles','moss','lichen','fungus','reed'];let atlas=null;
function plantAtlas(){if(atlas)return atlas;const data=new Uint8Array(1024*512*4).fill(255);for(let k=0;k<8;k++){const src=get(botanical[k]).map.image.data;for(let y=0;y<256;y++){const row=((Math.floor(k/4)*256+y)*1024+(k%4)*256)*4;data.set(src.subarray(y*256*4,(y+1)*256*4),row);}}atlas=new T.DataTexture(data,1024,512,T.RGBAFormat);atlas.minFilter=T.LinearFilter;atlas.magFilter=T.LinearFilter;atlas.needsUpdate=true;return atlas;}
function geometry(g,kind,tree=false,variant=0){if(g.userData.material133)return g;const count=g.attributes.position.count,p=g.attributes.position,n=g.attributes.normal,ids=[],project=[];
for(let i=0;i<count;i++){const leaf=tree&&g.attributes.aLeaf127.getX(i)>.5;let id=tree?(leaf?(kind==='alpine'?3:2):(variant?1:0)):{fern:2,reed:7,grass:7,shrub:2,succulent:2,fungus:6,glowmoss:4}[kind];if(id==null)id=4;if(kind==='cavern'&&!leaf)id=5;ids.push(id);const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const axis=Math.abs(n.getY(i))>.65?'up':Math.abs(n.getX(i))>.65?'side':'front';project.push(axis==='side'?z:x,axis==='up'?z:y);}
g.setAttribute('aMatter133',new T.Float32BufferAttribute(ids,1));g.setAttribute('aProject133',new T.Float32BufferAttribute(project,2));g.userData.material133=true;return g;}
function plantMaterial(mat){if(mat.userData&&mat.userData.botanical133)return mat;mat.userData=mat.userData||{};mat.userData.botanical133=true;const previous=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey.bind(mat);mat.onBeforeCompile=function(s){if(previous)previous.call(this,s);s.uniforms.uBotanical133={value:plantAtlas()};s.vertexShader='attribute float aMatter133; attribute vec2 aProject133; varying float vMatter133; varying vec2 vProject133;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMatter133=aMatter133;vProject133=aProject133;');s.fragmentShader='uniform sampler2D uBotanical133; varying float vMatter133; varying vec2 vProject133;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec2 cell133=vec2(mod(floor(vMatter133+.1),4.0),floor(vMatter133/4.0));vec2 tile133=(fract(vProject133*2.0)*.996+.002+cell133)/vec2(4.0,2.0);diffuseColor.rgb*=mix(vec3(1.0),texture2D(uBotanical133,tile133).rgb,0.72);');};mat.customProgramCacheKey=()=>oldKey()+'-botanical133';mat.needsUpdate=true;return mat;}
const api={get,apply,geometry,plantMaterial,state:()=>({textures:cache.size,names:Array.from(cache.keys())})};factories.set(T,api);return api;}
root.L99Materials133={create,names:Object.keys(root.L99MaterialData133)};
})(window);

/* LIFE_133: one ecological seed and physical scale contract for both renderers. */
(function(root){'use strict';const rng=root.L99FaunaGenome131.random,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let worldSeed=null;
function human(seed,child=false){const r=rng((seed^0x36184)>>>0),tail=r(),a=(r()+r()+r()+r()+r()+r()-3)/Math.sqrt(.5);let height=clamp(1.75+a*.105,1.49,2.03),rarity='ordinary';if(tail<.004){height=1.18+r()*.28;rarity='short';}else if(tail>.996){height=2.08+r()*.32;rarity='tall';}if(child){height=.94+r()*.4;rarity='child';}return{height,rarity,breadth:.92+r()*.16};}
function animal(seed,kind){const r=rng((seed^0x781321)>>>0),p=r();if(/grazer|wader/.test(kind)&&p<.0025)return{factor:3.2+r()*1.4,rarity:'giant'};if(!/moth|bat/.test(kind)&&p<.025)return{factor:1.45+r()*.5,rarity:'large'};return{factor:.86+(r()+r()+r())/3*.36,rarity:'ordinary'};}
function units(realm){if(realm!=='flight')return 1;const player=Number.isFinite(root._PLAYER_SCALE)?root._PLAYER_SCALE:.2,world=Number.isFinite(root._WORLD_SCALE)?root._WORLD_SCALE:2;return clamp(6*player/Math.max(1,world)/1.7,.1,4);}
function seed(realm,nativeSeed){if(Number.isFinite(root._L99_BIOSPHERE_SEED))return root._L99_BIOSPHERE_SEED|0;if(worldSeed===null)worldSeed=nativeSeed|0;return worldSeed;}
function enterFlight(nativeSeed){const mount=typeof document!=='undefined'&&document.getElementById('l99-caves-mount');if(mount&&mount.style.display!=='none')return;worldSeed=nativeSeed|0;}
function physical(v,u){return Math.round(v/u*1000000)/1000000;}
function field(realm,x,z,options={}){const u=units(realm);return root.L99Ecology.sample(physical(x,u),physical(z,u),{...options,elevation:(options.elevation||0)/u,seed:seed(realm,options.seed)});}
function choose(realm,field,x,z,nativeSeed){const u=units(realm);return root.L99Ecology.choose(field,physical(x,u),physical(z,u),seed(realm,nativeSeed));}
function variant(realm,x,z,nativeSeed,count=2){const u=units(realm);return Math.floor(root.L99Ecology.hash(Math.floor(physical(x,u)*3),Math.floor(physical(z,u)*3),seed(realm,nativeSeed))*count);}
function fitPerson(T,group,seedValue,realm,baseHeight,child=false){const dna=human(seedValue,child);group.userData.height133=dna.height;group.userData.rarity133=dna.rarity;group.userData.seed133=seedValue;group.userData.realm133=realm;group.userData.baseHeight133=baseHeight;rescale(T,group);return dna;}
function rescale(T,g){const d=g.userData;if(!d.baseHeight133)return;let parent=1;if(g.parent){const s=new T.Vector3();g.parent.getWorldScale(s);parent=Math.max(.001,Math.abs(s.y));}const h=d.child133?human(d.seed133,true).height:d.height133;g.scale.setScalar(h*units(d.realm133)/(d.baseHeight133*parent));}
root.L99Life133={human,animal,units,seed,enterFlight,field,choose,variant,fitPerson,rescale,state:()=>({worldSeed,flightUnits:units('flight')})};
})(window);

/* REALISM_133: shared materials, bounded stature and organic surface refinements. */
(function(root){'use strict';
const oldFauna=root.L99FaunaGenome131.create;
root.L99FaunaGenome131.create=function(T){const old=oldFauna(T),materials=root.L99Materials133.create(T);return{build(kind,seed){const k=old.build(kind,seed),g=k.genome,size=root.L99Life133.animal(seed,kind);g.sizeClass=size.rarity;g.sizeFactor=size.factor;k.scale*=size.factor;g.scale=k.scale;
const coat=g.coat,name=coat==='fur'?(g.marking===0?'banded-fur':g.marking===1?'spotted-fur':'fur'):coat==='feathers'?(g.seed%3?'feathers':'teal-feathers'):coat==='chitin'?'scales':'leather';g.material133=name;const pigment=k.map.image.data;materials.apply(k.material,name);
// Keep each genome's macro pigmentation; generated imagery supplies coat detail.
const detail=k.material.map.image.data,tiles=coat==='feathers'?3:coat==='fur'?2:1,mix=new Uint8Array(detail.length);for(let i=0;i<mix.length;i+=4){const px=(i/4)%256,py=Math.floor(i/1024),di=(((py*tiles)%256)*256+(px*tiles)%256)*4,v=Math.round(detail[di]*(.25+.75*pigment[i]/255));mix[i]=mix[i+1]=mix[i+2]=v;mix[i+3]=255;}
const ownedMap=new T.DataTexture(mix,256,256,T.RGBAFormat);ownedMap.wrapS=ownedMap.wrapT=T.MirroredRepeatWrapping;ownedMap.minFilter=T.LinearMipmapLinearFilter;ownedMap.magFilter=T.LinearFilter;ownedMap.generateMipmaps=true;ownedMap.anisotropy=4;ownedMap.needsUpdate=true;k.material.map=k.map=ownedMap;
for(const d of k.details||[]){materials.apply(d.material,name);d.material.map=ownedMap;}
// Eyes, hooves, beaks and horns are never covered in coat pigment.
const horn=new T.Color().setHSL(.11,.16,.67),dark=new T.Color().setHSL(g.hue,.22,.13),eye=new T.Color().setHSL((g.hue+.42)%1,.75,.56),iris=new T.Color().setHSL(.09+(seed%7)*.015,.35,.16);
function mask(geo){const c=geo.attributes.color,weights=[];for(let i=0;i<c.count;i++){const near=v=>Math.abs(c.getX(i)-v.r)+Math.abs(c.getY(i)-v.g)+Math.abs(c.getZ(i)-v.b)<.00001;const isEye=near(eye);weights.push(near(horn)||near(dark)||isEye?0:1);if(isEye)c.setXYZ(i,iris.r,iris.g,iris.b);}geo.setAttribute('aCoat133',new T.Float32BufferAttribute(weights,1));}
for(const geo of [k.geometry,...k.attachments.map(a=>a.geometry),...(k.details||[]).map(a=>a.geometry)])mask(geo);
function coatShader(mat){mat.onBeforeCompile=function(s){s.vertexShader='attribute float aCoat133; varying float vCoat133;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCoat133=aCoat133;');s.fragmentShader='varying float vCoat133;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec4 uncoated133=diffuseColor;\n#include <map_fragment>\ndiffuseColor=mix(uncoated133,diffuseColor,vCoat133);');s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','vec3 uncoatedNormal133=normal;\n#include <normal_fragment_maps>\nnormal=normalize(mix(uncoatedNormal133,normal,vCoat133));');};mat.customProgramCacheKey=()=> 'coat-regions-133';}
coatShader(k.material);for(const d of k.details||[])coatShader(d.material);
const release=k.dispose;k.dispose=()=>{release();ownedMap.dispose();};
return k;}};};
const oldTrees=root.L99Trees127.create;
root.L99Trees127.create=function(T,realm){const kit=oldTrees(T,realm),m=root.L99Materials133.create(T);if(!kit.realism133){const geom=kit.geometry;kit.geometry=function(kind,v,lod){return m.geometry(geom(kind,v,lod),kind,true,v);};m.plantMaterial(kit.material);kit.realism133=true;}return kit;};
const oldFlora=root.L99Foliage.create;
root.L99Foliage.create=function(T){const kit=oldFlora(T),m=root.L99Materials133.create(T),geom=kit.geometry;kit.geometry=kind=>m.geometry(geom(kind),kind);return kit;};
})(window);

/* CITIZENS_133: articulated fallback people, neutral skin detail and hair strands. */
(function(root){'use strict';const factories=new WeakMap();
function create(T){if(factories.has(T))return factories.get(T);
const textile=root.L99Materials133.create(T),life=root.L99Life133,surf=root.L99Surfaces132.create(T),skinTex=surf.texture('skin'),clothTex=surf.texture('cloth'),hairTex=surf.texture('hair'),sphere=new T.SphereGeometry(.5,16,12),torsoGeo=new T.LatheGeometry([[.185,.84],[.195,.95],[.145,1.12],[.19,1.32],[.185,1.4],[.12,1.47],[.062,1.49]].map(p=>new T.Vector2(...p)),20),bone=new T.CylinderGeometry(.5,.4,1,12),scalp=new T.SphereGeometry(.5,18,12,0,Math.PI*2,0,Math.PI*.56),materials=new Map(),figures=new Set(),rigs=new WeakMap();bone.translate(0,-.5,0);
function material(type,color){const key=type+color;if(materials.has(key))return materials.get(key);const map=type==='skin'?skinTex:type==='hair'?hairTex:clothTex;const m=new T.MeshStandardMaterial({color,map,bumpMap:map,bumpScale:type==='skin'?.0007:type==='hair'?.002:.001,roughness:type==='skin'?.72:type==='hair'?.86:.94});if(type!=='hair')textile.apply(m,type==='cloth'?'linen':type);materials.set(key,m);return m;}
function mesh(parent,geo,mat,pos,scale){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
function make(seed,realm='flight'){const r=root.L99FaunaGenome131.random(seed),g=new T.Group(),body=new T.Group();g.add(body);const tones=[0x4d3024,0x76503a,0xa87251,0xc59572,0xe3b995,0xf0cfb0],clothes=[0x465f73,0x5b7059,0x854a47,0x755c80,0x9c835b,0x436e70];
const skin=material('skin',tones[Math.floor(r()*tones.length)]),cloth=material(['linen','wool','suede'][seed%3],clothes[Math.floor(r()*clothes.length)]),pants=material(seed%2?'denim':'linen',clothes[Math.floor(r()*clothes.length)]),hair=material('hair',[0x201b18,0x493425,0x84623f,0xc1ae82,0x8a8780][Math.floor(r()*5)]),dark=material('leather',0x29282a),broad=.9+r()*.2;
mesh(body,torsoGeo,cloth,[0,0,0],[broad,1,.66]);mesh(body,sphere,pants,[0,.94,0],[.33*broad,.25,.23]);mesh(body,bone,skin,[0,1.53,0],[.12,.14,.12]);
const faceGeo=sphere.clone(),fp=faceGeo.attributes.position;for(let i=0;i<fp.count;i++){const y=fp.getY(i),jaw=y<-.12?.78+.22*(y+.5)/.38:1;fp.setXYZ(i,fp.getX(i)*jaw,fp.getY(i),fp.getZ(i)*(y<-.22?.88:1));}faceGeo.computeVertexNormals();
const head=new T.Group();head.position.y=1.61;body.add(head);mesh(head,faceGeo,skin,[0,0,0],[.225,.275,.235]);mesh(head,sphere,skin,[0,-.01,.116],[.035,.054,.049]);
for(const side of [-1,1]){mesh(head,sphere,material('skin',0xd8cdb8),[side*.047,.028,.105],[.026,.014,.009]);mesh(head,sphere,dark,[side*.047,.028,.11],[.010,.010,.004]);mesh(head,sphere,hair,[side*.047,.047,.103],[.032,.007,.011]);mesh(head,sphere,skin,[side*.115,0,0],[.033,.059,.024]);}
mesh(head,sphere,material('skin',0x8c5c54),[0,-.06,.118],[.05,.011,.007]);
const style=Math.floor(r()*4),hairDetails=[];
if(style){mesh(head,scalp,hair,[0,.043,-.008],[.24,.20,.245]);if(style===2)mesh(head,sphere,hair,[0,-.035,-.07],[.24,.3,.15]);if(style===3)mesh(head,sphere,hair,[0,.16,-.045],[.095,.095,.09]);const strands=surf.fibers(seed,[0,.043,-.008],[.12,.10,.1225],style===2?.04:.015,420,hair.color,true);const hm=new T.Mesh(strands,hair);head.add(hm);hairDetails.push(hm);}
// Sewn collar, waist belt and placket use the garment's own material.
for(const side of [-1,1]){const collar=mesh(body,bone,cloth,[side*.057,1.47,.065],[.025,.105,.013]);collar.rotation.z=side*.55;}
mesh(body,sphere,dark,[0,.99,0],[.355*broad,.032,.244]);for(let i=0;i<4;i++)mesh(body,sphere,dark,[0,1.36-i*.065,.105],[.008,.008,.005]);
const arms=[],legs=[];
for(let i=0;i<2;i++){const side=i?1:-1,shoulder=new T.Group();shoulder.position.set(side*.205*broad,1.43,0);body.add(shoulder);mesh(shoulder,sphere,cloth,[0,-.03,0],[.14,.16,.145]);mesh(shoulder,bone,cloth,[0,0,0],[.11,.28,.11]);const elbow=new T.Group();elbow.position.y=-.28;shoulder.add(elbow);mesh(elbow,sphere,skin,[0,0,0],[.086,.086,.086]);mesh(elbow,bone,skin,[0,0,0],[.085,.25,.085]);mesh(elbow,sphere,skin,[0,-.29,0],[.065,.10,.05]);arms.push({shoulder,elbow});
const hip=new T.Group();hip.position.set(side*.086,.94,0);body.add(hip);mesh(hip,bone,pants,[0,0,0],[.145,.45,.14]);const knee=new T.Group();knee.position.y=-.45;hip.add(knee);mesh(knee,sphere,pants,[0,0,0],[.11,.115,.11]);mesh(knee,bone,pants,[0,0,0],[.105,.43,.105]);mesh(knee,sphere,dark,[0,-.44,.05],[.12,.07,.22]);legs.push({hip,knee});}
const fig={g,body,head,arms,legs,hairDetails,faceGeo,phase:0,previous:g.position.clone(),world:new T.Vector3(),seen:false};g.userData.citizen132=true;life.fitPerson(T,g,seed,realm,1.78);rigs.set(g,fig);figures.add(fig);return g;}
function pose(fig,phase,speed,time){const amount=Math.min(.52,Math.max(0,speed)*.45);for(let i=0;i<2;i++){const s=phase+i*Math.PI;fig.legs[i].hip.rotation.x=Math.sin(s)*amount;fig.legs[i].knee.rotation.x=Math.max(0,-Math.sin(s))*.72*Math.min(1,speed);fig.arms[i].shoulder.rotation.x=-Math.sin(s)*amount*.65;fig.arms[i].elbow.rotation.x=-.16-Math.max(0,Math.sin(s))*.17*Math.min(1,speed);}
fig.body.position.y=Math.abs(Math.sin(phase))*amount*.025;fig.body.rotation.z=Math.sin(phase)*amount*.022;fig.head.rotation.y=Math.sin(time*.35)*.07;}
let last=0;
function tick(now,camera){if(now-last<65)return;const dt=Math.min(.2,Math.max(.001,(now-last)/1000));last=now;
for(const fig of figures){let p=fig.g;while(p.parent)p=p.parent;if(!p.isScene){if(fig.seen){for(const h of fig.hairDetails)h.geometry.dispose();fig.faceGeo.dispose();figures.delete(fig);}continue;}fig.seen=true;life.rescale(T,fig.g);fig.g.getWorldPosition(fig.world);const d=fig.world.distanceTo(camera.position);const unit=life.units(fig.g.userData.realm133);for(const h of fig.hairDetails)h.visible=d<24*unit;if(d>80*unit){fig.previous.copy(fig.g.position);continue;}const moved=fig.g.position.distanceTo(fig.previous);fig.previous.copy(fig.g.position);const speed=moved/dt/Math.max(.1,fig.g.scale.y);fig.phase+=Math.min(moved,1)/Math.max(.1,fig.g.scale.y)*7;pose(fig,fig.phase,speed,now*.001);}}
const api={make,pose,tick,rig:g=>rigs.get(g),material,surf,scalp};factories.set(T,api);return api;}
root.L99Citizens132={create};
})(typeof window!=='undefined'?window:globalThis);

/* NATIVE_FAUNA_133: bounded, seeded wildlife; driven by the worlds' existing frames. */
(function(root){'use strict';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
function hash(x,z,s){let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(s|0);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function species(field,r){if(field.region==='submerged')return null;if(/cave/.test(field.region))return r<.45?'lantern beetle':r<.8?'cave moth':'bat';if(field.region==='alpine')return 'mountain grazer';if(field.region==='wetland')return r<.6?'marsh wader':'moth';if(field.region==='dry scrub')return 'long-ear hopper';return r<.55?'woodland grazer':r<.8?'long-ear hopper':'moth';}
function create(T){
 const sculptor=root.L99FaunaGenome131.create(T),cache=new Map(),animals=[],group=new T.Group();group.name='Procedural wildlife';
 let epoch=null,last=0,spawnAt=0,stepAt=0,cursor=0,bass=0,high=0,disposed=false;
 const reduced=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const cap=root.matchMedia&&root.matchMedia('(pointer: coarse)').matches?4:8;
 function asset(kind,seed){const key=kind+':'+(seed>>>0);if(cache.has(key))return cache.get(key);
  if(cache.size>=16){for(const [id,k] of cache){if(!animals.some(a=>a.k===k)){k.dispose();cache.delete(id);break;}}}
  const k=sculptor.build(kind,seed);cache.set(key,k);return k;
 }
 function spawn(kind,x,y,z,seed,cell,k,unit){const node=new T.Group(),body=new T.Mesh(k.geometry,k.material);node.add(body);let limbs=[];
  const details=[];for(const d of k.details||[]){const m=new T.Mesh(d.geometry,d.material);m.position.set(...d.position);m.userData.detail132=true;body.add(m);details.push(m);}
  for(const a of k.attachments){const pivot=new T.Group(),mesh=new T.Mesh(a.geometry,k.material);pivot.position.set(...a.position);pivot.userData.phase131=a.phase||0;pivot.userData.side131=a.side;pivot.add(mesh);node.add(pivot);limbs.push(pivot);}
  node.scale.setScalar(k.scale*unit);node.position.set(x,y,z);node.userData.fauna130=kind;node.userData.genome131=k.genome;node.name=k.genome.name;
  group.add(node);animals.push({node,k,limbs,body,details,kind,x,z,y,cell,unit,angle:hash(cell[0],cell[1],seed)*6.28,phase:hash(cell[0],cell[1],seed+8)*6.28,state:'roam'});
 }
 function clearance(k,unit=1){return {radius:Math.max(Math.abs(k.bounds.min.x),Math.abs(k.bounds.max.x),Math.abs(k.bounds.min.z),Math.abs(k.bounds.max.z))*k.scale*unit+.12*unit,height:Math.max(.5*unit,k.bounds.max.y*k.scale*unit+.12*unit)};}
 function clear(){for(const a of animals)group.remove(a.node);animals.length=0;}
 function tick(env,now,bands){if(disposed)return;group.visible=!!env.active&&root._L99_FAUNA!==false;if(!group.visible){clear();last=now;return;}if(group.parent!==env.scene){if(group.parent)group.parent.remove(group);env.scene.add(group);}const unit=env.units||1;const key=String(env.seed)+':'+env.cave+':'+unit;
  if(epoch!==key){clear();epoch=key;cursor=0;spawnAt=0;}
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;const react=root._BARD_FAUNA_REACT!==false;
  bass+=(clamp(react&&bands?bands.bass:0)-bass)*Math.min(1,dt*8);high+=(clamp(react&&bands?bands.high:0)-high)*Math.min(1,dt*6);
  const cam=env.camera.position;
  for(let i=animals.length-1;i>=0;i--){let a=animals[i];if(Math.hypot(a.x-cam.x,a.z-cam.z)>75*unit||Math.abs(a.y-cam.y)>24*unit){group.remove(a.node);animals.splice(i,1);}}
  if(now>=spawnAt&&animals.length<cap){spawnAt=now+350;const index=cursor++%25,cx=Math.floor(cam.x/(18*unit))+(index%5)-2,cz=Math.floor(cam.z/(18*unit))+Math.floor(index/5)-2;
   if(!animals.some(a=>a.cell[0]===cx&&a.cell[1]===cz)){
    const x=(cx+.2+hash(cx,cz,env.seed)*.6)*18*unit,z=(cz+.2+hash(cx,cz,env.seed+1)*.6)*18*unit;
    if(Math.hypot(x-cam.x,z-cam.z)>8*unit){let y=env.floor(x,z,cam.y);if(Number.isFinite(y)&&Math.abs(y-cam.y)<20*unit){const field=env.field(x,z,y),kind=species(field,hash(cx,cz,env.seed+9));if(kind){const flying=/moth|bat/.test(kind),yy=y+(flying?1.8*unit:0),dna=Math.floor(hash(cx,cz,env.seed+131)*4294967296),k=asset(kind,dna);if(Math.hypot(x-cam.x,z-cam.z)>clearance(k,unit).radius+3*unit&&env.valid(x,yy,z,flying,clearance(k,unit)))spawn(kind,x,yy,z,env.seed,[cx,cz],k,unit);}}}
   }
  }
  const simulate=now>=stepAt;if(simulate)stepAt=now+100;
  for(const a of animals){const distance=Math.hypot(a.x-cam.x,a.z-cam.z);for(const d of a.details)d.visible=distance<24*unit;const alert=distance<(3.5+a.k.genome.temperament*2)*unit;const listening=!alert&&bass>.08&&distance<20*unit;
   a.state=alert?'flee':listening?'listen':Math.sin(now*.0003+a.phase)>.65?'rest':'roam';
   if(simulate&&a.state!=='listen'&&a.state!=='rest'){
    if(alert)a.angle=Math.atan2(a.x-cam.x,a.z-cam.z);else a.angle+=Math.sin(now*.0004+a.phase)*.08;
    const speed=(alert?2.4:a.k.beetle?.22:a.k.wing?.8:.55)*.1*unit, x=a.x+Math.sin(a.angle)*speed,z=a.z+Math.cos(a.angle)*speed;
    const floor=env.floor(x,z,a.y), y=floor+(a.k.wing?1.8*unit:0);
    if(Math.abs(x/(18*unit)-a.cell[0]-.5)>1||Math.abs(z/(18*unit)-a.cell[1]-.5)>1)a.angle+=Math.PI;
    else if(Number.isFinite(y)&&Math.abs(y-a.y)<.45*unit&&env.valid(x,y,z,a.k.wing,clearance(a.k,unit))){a.x=x;a.z=z;a.y=y;}else a.angle+=1.5;
   }
   const t=now*.001,walk=a.state==='roam'||a.state==='flee';a.node.position.set(a.x,a.y,a.z);a.node.rotation.y=a.angle;
   for(let i=0;i<a.limbs.length;i++){if(a.k.wing)a.limbs[i].rotation.z=a.limbs[i].userData.side131*Math.sin(t*(a.kind==='bat'?13:8)+a.phase)*.65;else a.limbs[i].rotation.x=walk?Math.sin(t*(alert?12:5)+a.limbs[i].userData.phase131+a.phase)*.35:0;}
   a.body.scale.y=1+(reduced?0:Math.sin(t*1.8+a.phase)*.012);
   if(!reduced&&listening)a.node.rotation.z=Math.sin(t*3+a.phase)*bass*.07;else a.node.rotation.z=0;
  }
  for(const k of cache.values())k.material.emissiveIntensity=(k.beetle?.35:0)+high*(k.beetle?.6:.12);
 }
 function dispose(){clear();if(group.parent)group.parent.remove(group);for(const k of cache.values())k.dispose();cache.clear();disposed=true;}
 return{tick,dispose,group,state:()=>({count:animals.length,cap,assets:cache.size,bass,high,species:animals.map(a=>a.kind),behaviors:animals.map(a=>a.state),genomes:animals.map(a=>a.k.genome)})};
}
root.L99Fauna130={create,species,hash};
})(typeof window!=='undefined'?window:globalThis);
