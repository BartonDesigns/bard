// Shared civic surfaces. Artwork is albedo only; lighting, relief and wear remain physical.
import * as THREE from 'three';
const images=new Map(), textures=new Map();let revision=0;
export const civicRevision=()=>revision;
export const civicPhone=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
export function civicImage(id,phone=false){
 const key=id+(phone?'-mobile':'');if(images.has(key))return images.get(key);
 const e={image:null,ready:false,promise:Promise.resolve(false)};images.set(key,e);
 if(typeof Image==='undefined')return e;
 const im=new Image();e.image=im;e.promise=new Promise(resolve=>{im.onload=()=>{e.ready=true;revision++;resolve(true);};im.onerror=()=>resolve(false);});im.decoding='async';im.src=new URL(`../assets/civic/${id}-v1${phone?'-mobile':''}.webp`,import.meta.url).href;return e;
}
export function civicTexture(id,phone=false){
 const key=id+(phone?'-mobile':'');if(textures.has(key))return textures.get(key);
 const alpha=id==='damage'||id.startsWith('graffiti');let t;
 if(typeof document==='undefined'){t=new THREE.DataTexture(new Uint8Array([255,255,255,alpha?0:255]),1,1);}
 else {const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d');if(!alpha){g.fillStyle='#fff';g.fillRect(0,0,1,1);}t=new THREE.CanvasTexture(c);}
 t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=alpha?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;t.anisotropy=phone?2:4;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.name='civic-'+key;
 // Reallocate GPU storage when replacing the 1px placeholder with a larger image.
 const e=civicImage(id,phone);if(typeof document!=='undefined')e.promise.then(ok=>{if(ok){t.dispose();t.image=e.image;t.needsUpdate=true;}});textures.set(key,t);return t;
}
// drawImage respects source alpha; multiply/darken can be used on any existing Canvas face.
export function drawCivicDecal(g,x,y,w,h,{id='damage',tile=0,phone=false,blend='source-over',opacity=1}={}){
 const e=civicImage(id,phone);if(!e.ready)return false;
 const cols=id.startsWith('graffiti')&&!['graffiti-characters','graffiti-devotional'].includes(id)?4:2,rows=2,n=cols*rows,index=((tile%n)+n)%n,cw=e.image.naturalWidth/cols,ch=e.image.naturalHeight/rows;
 if(['graffiti-characters','graffiti-devotional'].includes(id)){const fit=Math.min(w/cw,h/ch);x+=(w-cw*fit)/2;y+=(h-ch*fit)/2;w=cw*fit;h=ch*fit;}
 g.save();g.globalCompositeOperation=['source-over','multiply','darken'].includes(blend)?blend:'source-over';g.globalAlpha=Math.max(0,Math.min(1,opacity));g.drawImage(e.image,index%cols*cw,Math.floor(index/cols)*ch,cw,ch,x,y,w,h);g.restore();return true;
}
let diamond;
export function diamondPlateMaps(){
 if(diamond)return diamond;
 const size=256,height=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const cx=Math.floor(x/64),cy=Math.floor(y/64),u=(x%64-31.5)/64,v=(y%64-31.5)/64,sign=(cx+cy)%2?1:-1;
  const a=(u+sign*v)*.70710678,b=(-sign*u+v)*.70710678;
  const d=Math.sqrt((a/.37)**2+(b/.075)**2),ridge=Math.max(0,1-d);const z=Math.round(35+190*Math.sin(ridge*Math.PI/2));
  const r=Math.round(175-ridge*65+Math.sin(x*2.1+y*3.7)*3),i=(y*size+x)*4;
  height.set([z,z,z,255],i);roughness.set([r,r,r,255],i);
 }
 const tex=(data,name)=>{const t=new THREE.DataTexture(data,size,size);t.name=name;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 diamond={height:tex(height,'diamond-height-linear'),roughness:tex(roughness,'diamond-roughness-linear')};return diamond;
}
export function createDiamondPlateMaterial({phone=civicPhone()}={}){
 const maps=diamondPlateMaps();return new THREE.MeshStandardMaterial({name:'civic-diamond-plate',color:0xbac1c5,map:civicTexture('galvanized',phone),metalness:.82,roughness:.76,roughnessMap:maps.roughness,bumpMap:maps.height,bumpScale:.003});
}
// Called before merging geometry: 40 cm repeat, independent of panel dimensions.
export function projectPlateUV(g,period=.4){
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));uv.setXY(i,(ay>ax&&ay>az?p.getX(i):ax>az?p.getZ(i):p.getX(i))/period,(ay>ax&&ay>az?p.getZ(i):p.getY(i))/period);}return g;
}
// Compose damage into base color BEFORE Three's lighting, never as a glowing screen quad.
export function applyCivicWear(material,{amount=.15,tile=0,blend='multiply',phone=civicPhone(),lowerBody=true}={}){
 const prior=material.onBeforeCompile,priorKey=material.customProgramCacheKey.bind(material);const key=priorKey();
 material.onBeforeCompile=function(sh,renderer){prior.call(this,sh,renderer);sh.uniforms.uCivicDamage={value:civicTexture('damage',phone)};sh.uniforms.uCivicWear={value:amount};
 sh.vertexShader='varying vec3 vCivicP; varying vec3 vCivicN;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCivicP=position;vCivicN=normal;');
 sh.fragmentShader='uniform sampler2D uCivicDamage;uniform float uCivicWear;varying vec3 vCivicP;varying vec3 vCivicN;\n'+sh.fragmentShader;
 sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 cn=abs(vCivicN);vec2 cp=cn.y>max(cn.x,cn.z)?vCivicP.xz:cn.x>cn.z?vCivicP.zy:vCivicP.xy;
 vec2 cq=fract(cp*.33+vec2(.17,.29));vec4 cd=texture2D(uCivicDamage,(cq+vec2(${tile%2}.0,${1-Math.floor(tile/2)}.0))*.5);
 float cw=clamp(cd.a*uCivicWear*${lowerBody?'(.25+.75*(1.0-smoothstep(.35,1.55,vCivicP.y)))':'1.0'},0.0,1.0);
 diffuseColor.rgb=mix(diffuseColor.rgb,${blend==='darken'?'min(diffuseColor.rgb,cd.rgb)':'diffuseColor.rgb*cd.rgb'},cw);`);
 sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(roughnessFactor,.9),cw);').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=1.0-cw*.65;');
 };
 material.customProgramCacheKey=()=>key+'|civic-wear-1|'+tile+'|'+blend+'|'+lowerBody;return material;
}
