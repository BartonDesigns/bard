/* SCULPTED_FAUNA_BUILD_131 */
/* NATIVE_FAUNA_BUILD_130 */
/* FAUNA_GENOME_131: habitat-constrained anatomy and procedural pigmentation. */
(function(root){'use strict';
function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function genome(kind,seed){const r=random(seed),range=(a,b)=>a+(b-a)*r();
const wing=/moth|bat/.test(kind),beetle=/beetle/.test(kind),hopper=/hopper/.test(kind),wader=/wader/.test(kind),alpine=/mountain/.test(kind),bat=kind==='bat';
const cave=/cave|bat|lantern/.test(kind),body=range(.48,.8)*(beetle?.75:wing?.55:1),girth=body*range(.37,.56),legs=wing?0:beetle?6:wader?2:4;
const leg=beetle?range(.12,.2):hopper?range(.26,.4):wader?range(.85,1.18):alpine?range(.52,.7):range(.55,.95);
const hue=cave?range(.46,.69):alpine?range(.08,.15):wader?range(.45,.59):range(.06,.18);
return{version:131,seed:seed>>>0,kind,wing,beetle,hopper,wader,alpine,bat,cave,body,girth,legs,leg,
 neck:wader?range(.48,.82):hopper?range(.15,.24):range(.25,.55),head:range(.17,.25)*(wing?.68:beetle?.8:1),tail:wing?range(.18,.35):beetle?.05:hopper?.14:range(.5,1.05),ear:hopper?range(.3,.53):range(.12,.22),
 horns:!wing&&!beetle&&!hopper&&!wader&&(alpine||r()>.4),hornLength:range(.25,.57),hornCurl:range(.1,.65),crest:r()>.55,crestHeight:range(.09,.22),wingSpan:range(.62,1.05),wingSweep:range(.28,.65),wingLobes:bat?3:Math.floor(range(2,5)),
 hue,saturation:range(.2,.48),lightness:cave?range(.28,.48):range(.35,.58),marking:Math.floor(range(0,4)),patternScale:range(3,8),patternPhase:range(0,6.283),scale:range(.82,1.13),temperament:range(.2,.9),name:['Velvet','Crested','Ribbon','Dappled','Amber','Veiled'][Math.floor(r()*6)]+' '+kind+' · '+(seed>>>0).toString(36).toUpperCase()};}
function create(T){
function colors(g){return{body:new T.Color().setHSL(g.hue,g.saturation,g.lightness),belly:new T.Color().setHSL(g.hue,.19,Math.min(.78,g.lightness+.2)),accent:new T.Color().setHSL((g.hue+.15)%1,.55,.5),dark:new T.Color().setHSL(g.hue,.22,.13),horn:new T.Color().setHSL(.11,.16,.67),eye:new T.Color().setHSL((g.hue+.42)%1,.75,.56)};}
function texture(g){const size=256,data=new Uint8Array(size*size*4),r=random(g.seed+781),spots=Array.from({length:18},()=>[r(),r(),.018+r()*.035]);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size;let pat;
if(g.marking===0)pat=.84+.16*Math.tanh((Math.sin(u*g.patternScale*6.283+Math.sin(v*14)*1.2+g.patternPhase)-.35)*4);
else if(g.marking===1)pat=spots.reduce((value,s)=>Math.min(value,.6+.4*Math.max(0,Math.min(1,(Math.hypot((u-s[0])*1.1,v-s[1])-s[2]+.008)/.016))),1);
else if(g.marking===2){const f=Math.sin(u*35+Math.sin(v*24)*2)*Math.sin(v*29);pat=.77+.23*f;}
else pat=.83+.17*Math.sin(v*48+Math.sin(u*11));
const pores=.95+r()*.05,grain=Math.round(255*Math.max(.38,pat*pores)),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=grain;data[i+3]=255;}
const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=2;t.needsUpdate=true;return t;}
function builder(palette){const positions=[],normals=[],uvs=[],cols=[];
function add(geo,color){const g=geo.index?geo.toNonIndexed():geo,pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv;for(let i=0;i<pa.count;i++){positions.push(pa.getX(i),pa.getY(i),pa.getZ(i));normals.push(na.getX(i),na.getY(i),na.getZ(i));uvs.push(ua?ua.getX(i):0,ua?ua.getY(i):0);cols.push(color.r,color.g,color.b);}if(g!==geo)g.dispose();geo.dispose();}
function ellipsoid(pos,scale,color,rotation=0){const g=new T.SphereGeometry(1,18,12);g.scale(...scale);g.rotateX(rotation);g.translate(...pos);add(g,color);}
function tube(points,radii,color,segments=20,sides=9){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),p=[],uv=[],indices=[];
for(let i=0;i<=segments;i++){const t=i/segments,c=curve.getPointAt(t),index=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(index)),f=index-j,rad=radii[j]*(1-f)+radii[j+1]*f;
for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2;const v=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*rad).addScaledVector(frames.binormals[i],Math.sin(a)*rad);p.push(v.x,v.y,v.z);uv.push(k/sides,t);if(i<segments&&k<sides){const a0=i*(sides+1)+k,b=a0+sides+1;indices.push(a0,b,a0+1,b,b+1,a0+1);}}}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();add(geo,color);}
function membrane(side,g,color){const p=[],uv=[],indices=[],colsLocal=[],rows=12,columns=24;
for(let i=0;i<=rows;i++){const v=i/rows;for(let j=0;j<=columns;j++){const u=j/columns,edge=g.wingSpan*Math.pow(Math.sin(Math.PI*u),.52)*(1-.13*Math.cos(u*g.wingLobes*Math.PI*2)),x=side*(.055+edge*v),z=(u-.45)*g.body*3.4-v*g.wingSweep*.3,y=Math.sin(v*Math.PI)*.08; p.push(x,y,z);uv.push(u,v);if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,a+1,b,b,a+1,b+1);}}}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();add(geo,color);
// Curved supporting fingers give membranes an anatomical structure.
for(let i=1;i<5;i++){const u=i/5,edge=g.wingSpan*Math.pow(Math.sin(Math.PI*u),.52)*(1-.13*Math.cos(u*g.wingLobes*Math.PI*2)),z=(u-.45)*g.body*3.4;
tube([[side*.055,0,0],[side*edge*.5,.06,z*.5],[side*edge,0,z-g.wingSweep*.3]],[.018,.012,.003],palette.dark,9,6);}}
function finish(){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.computeBoundingBox();geo.computeBoundingSphere();return geo;}
return{ellipsoid,tube,membrane,finish};}
function build(kind,seed){const g=genome(kind,seed),c=colors(g),b=builder(c),attachments=[];
let y=g.wing?0:g.beetle?.23:g.leg+g.girth*.6;
b.ellipsoid([0,y,0],[g.girth,g.girth*(g.beetle?.7:1),g.body],c.body);
if(!g.wing&&!g.beetle)b.ellipsoid([0,y-g.girth*.35,.03],[g.girth*.87,g.girth*.64,g.body*.87],c.belly);
const headY=g.wing?.07:g.beetle?.22:y+g.neck,headZ=g.body*.73+g.neck*.3;
if(!g.wing&&!g.beetle)b.tube([[0,y,g.body*.45],[0,y+g.neck*.5,g.body*.62],[0,headY,headZ]],[g.girth*.7,g.head*.75,g.head*.85],c.body);
b.ellipsoid([0,headY,headZ],[g.head,g.head*.95,g.head*1.3],c.body);
if(!g.wing&&!g.beetle&&!g.wader)b.ellipsoid([0,headY-g.head*.2,headZ+g.head*.9],[g.head*.64,g.head*.44,g.head*.92],c.body.clone().lerp(c.belly,.28));
for(const side of [-1,1]){
 b.ellipsoid([side*g.head*.85,headY+g.head*.19,headZ+g.head*.45],[g.head*.18,g.head*.2,g.head*.2],c.dark);
 b.ellipsoid([side*g.head*1.035,headY+g.head*.2,headZ+g.head*.48],[g.head*.04,g.head*.085,g.head*.095],c.eye);
 b.ellipsoid([side*g.head*1.08,headY+g.head*.25,headZ+g.head*.5],[.003,.005,.004],c.belly);
 if(!g.beetle&&!g.wader&&(!g.wing||g.bat)){b.tube([[side*g.head*.6,headY+g.head*.6,headZ-.05],[side*(g.head*.9+g.ear*.25),headY+g.ear*.7,headZ-.12],[side*(g.head+g.ear*.4),headY+g.ear,headZ-.18]],[g.head*.35,g.head*.29,.007],c.body,14);}
 if(g.horns)b.tube([[side*g.head*.65,headY+g.head*.65,headZ-.04],[side*(g.head+g.hornCurl*.25),headY+g.hornLength*.65,headZ-.15],[side*(g.head+g.hornCurl*.3),headY+g.hornLength,headZ-.25-g.hornCurl*.2]],[.065,.043,.002],c.horn);
 if(g.beetle||g.wing)b.tube([[side*.06,headY,headZ+.1],[side*.18,headY+.15,headZ+.3],[side*.25,headY+.19,headZ+.4]],[.014,.009,.002],c.accent,12,6);
}
if(g.wader)b.tube([[0,headY,headZ+.12],[0,headY-.02,headZ+.4],[0,headY-.1,headZ+.65]],[.065,.04,.001],c.horn,12);
if(g.crest&&!g.beetle&&!g.wing&&!g.hopper){for(let i=0;i<5;i++){const z=g.body*(.6-i*.27);b.ellipsoid([0,y+g.girth*.88,z],[.035,g.crestHeight,.09],c.accent,-.4);}}
if(g.wing){for(let i=0;i<4;i++)b.ellipsoid([0,0,-g.body*.2-i*g.body*.21],[g.girth*(.85-i*.12),g.girth*(.85-i*.12),g.body*.17],i%2?c.accent:c.body);}
if(g.beetle){for(let i=0;i<5;i++)for(const side of [-1,1])b.ellipsoid([side*g.girth*.55,y+g.girth*.55,(i-2)*g.body*.3],[.045,.022,.055],c.accent);}
if(!g.wing&&g.tail>.2)b.tube([[0,y,-g.body*.7],[0,y-.05,-g.body-g.tail*.25],[g.tail*.15,y+.08,-g.body-g.tail*.7],[g.tail*.25,y+.22,-g.body-g.tail]],[g.girth*.18,.04,.025,.012],c.body,24);
if(g.wing){for(const side of [-1,1]){const w=builder(c);w.membrane(side,g,g.bat?c.body:c.accent);attachments.push({geometry:w.finish(),position:[0,0,0],wing:true,side});}}
else for(let i=0;i<g.legs;i++){const side=i%2?1:-1,pair=Math.floor(i/2),limbLength=g.leg+(g.beetle?0:g.girth*.35),hip=[side*g.girth*.68,limbLength,g.beetle?(pair-1)*g.body*.6:g.wader?0:(pair?-.5:.5)*g.body],l=builder(c),splay=g.beetle?.3:.06,knee=[side*splay,-limbLength*.53,g.hopper?-.15:.08],foot=[side*splay*1.2,-limbLength,.05];
l.tube([[0,0,0],knee,foot],[g.beetle?.045:g.hopper?.105:.075,g.beetle?.029:.052,.024],c.body,16,8);
l.ellipsoid(foot,[g.wader?.075:.052,g.wader?.025:.04,g.hopper?.13:.085],c.dark);
if(g.wader||g.beetle)for(let toe=-1;toe<=1;toe++)l.tube([foot,[foot[0]+toe*.045,-limbLength,foot[2]+.08],[foot[0]+toe*.09,-limbLength,foot[2]+.17]],[.014,.009,.001],c.dark,6,5);
attachments.push({geometry:l.finish(),position:hip,wing:false,side,phase:g.hopper?(pair?Math.PI:0):i===0||i===3?0:Math.PI});}
const geometry=b.finish(),map=texture(g),material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,map,bumpMap:map,bumpScale:g.beetle?.009:.018,roughness:g.beetle?.43:.82,metalness:g.beetle?.12:0,side:T.DoubleSide,emissive:g.beetle?new T.Color().setHSL(g.hue,.6,.22):0x15201c,emissiveIntensity:g.beetle?.3:0});
const bounds=geometry.boundingBox.clone();for(const a of attachments){const box=a.geometry.boundingBox.clone().translate(new T.Vector3(...a.position));bounds.union(box);}
return{genome:g,geometry,material,map,attachments,bounds,wing:g.wing,beetle:g.beetle,hopper:g.hopper,wader:g.wader,scale:g.scale,dispose(){geometry.dispose();for(const a of attachments)a.geometry.dispose();material.dispose();map.dispose();}};
}
return{build};}
root.L99FaunaGenome131={genome,random,create};
})(typeof window!=='undefined'?window:globalThis);

/* LIVING_SURFACES_BUILD_132 */
/* SURFACES_132: neutral microdetail, modeled fur/feathers, and citizen hair. */
(function(root){'use strict';
function create(T){
function texture(kind,seed=132){const r=root.L99FaunaGenome131.random(seed),size=128,data=new Uint8Array(size*size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){let v=.88+r()*.12;
 if(kind==='hair'||kind==='fur')v=.66+.25*Math.sin(x*.82+Math.sin(y*.1))**2+r()*.09;
 if(kind==='cloth')v=.94+.025*(x%3===0)+.025*(y%3===0)+r()*.01;
 if(kind==='feathers')v=.78+.12*Math.sin((x+y*.5)*.9)**2+r()*.1;
 if(kind==='chitin')v=.7+.25*Math.abs(Math.sin(x*.32+Math.sin(y*.3)))+r()*.05;
 const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(v*255);data[i+3]=255;}
const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.needsUpdate=true;return t;}
function fibers(seed,center,radii,length,count,color,scalp=false,feathers=false){const r=root.L99FaunaGenome131.random(seed),p=[],n=[],uv=[],c=[];
for(let i=0;i<count;i++){const a=r()*Math.PI*2,cos=scalp?r()*.93:2*r()-1,sin=Math.sqrt(1-cos*cos),v=new T.Vector3(Math.cos(a)*sin,cos,Math.sin(a)*sin);if(!scalp&&v.y<-.55)continue;
const base=new T.Vector3(center[0]+v.x*radii[0],center[1]+v.y*radii[1],center[2]+v.z*radii[2]);const normal=new T.Vector3(v.x/radii[0],v.y/radii[1],v.z/radii[2]).normalize(),side=new T.Vector3().crossVectors(normal,new T.Vector3(0,0,1));if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();
const len=length*(.45+r()*.75),width=feathers?.018:length*.028,tip=base.clone().addScaledVector(normal,len*(feathers?.12:.65)).add(new T.Vector3(0,-len*.25,-len*(feathers?.9:.45)));
const verts=[base.clone().addScaledVector(side,-width),base.clone().addScaledVector(side,width),tip];for(let j=0;j<3;j++){p.push(...verts[j].toArray());n.push(...normal.toArray());uv.push(a/(Math.PI*2),Math.acos(cos)/Math.PI);const tint=j===2?1.08:.83;c.push(color.r*tint,color.g*tint,color.b*tint);}}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeBoundingBox();g.computeBoundingSphere();return g;}
return{texture,fibers};}
root.L99Surfaces132={create};
const original=root.L99FaunaGenome131.create;
root.L99FaunaGenome131.create=function(T){const kit=original(T),surfaces=create(T);return{build(kind,seed){const k=kit.build(kind,seed),g=k.genome,coat=g.wing?'membrane':g.beetle?'chitin':g.wader?'feathers':'fur';g.coat=coat;
 const bump=surfaces.texture(coat,seed);k.material.bumpMap=bump;k.material.bumpScale=coat==='fur'?.012:coat==='chitin'?.008:.004;k.material.roughness=coat==='membrane'?.62:coat==='chitin'?.42:.9;k.details=[];
 if(coat==='fur'||coat==='feathers'){const y=g.leg+g.girth*.6,col=new T.Color().setHSL(g.hue,g.saturation,g.lightness),geometry=surfaces.fibers(seed,[0,y,0],[g.girth,g.girth,g.body],g.alpine?.04:g.hopper?.028:.02,coat==='feathers'?500:2200,col,false,coat==='feathers'),mat=k.material.clone();mat.bumpMap=null;mat.bumpScale=0;mat.roughness=.97;
  k.details.push({geometry,material:mat,position:[0,0,0],detail132:true});k.bounds.union(geometry.boundingBox);}
 const dispose=k.dispose;k.dispose=function(){dispose();bump.dispose();for(const d of k.details){d.geometry.dispose();d.material.dispose();}};return k;}};};
})(typeof window!=='undefined'?window:globalThis);

/* CITIZENS_132: articulated fallback people, neutral skin detail and hair strands. */
(function(root){'use strict';const factories=new WeakMap();
function create(T){if(factories.has(T))return factories.get(T);
const surf=root.L99Surfaces132.create(T),skinTex=surf.texture('skin'),clothTex=surf.texture('cloth'),hairTex=surf.texture('hair'),sphere=new T.SphereGeometry(.5,16,12),torsoGeo=new T.LatheGeometry([[.185,.84],[.195,.95],[.145,1.12],[.19,1.32],[.185,1.4],[.12,1.47],[.062,1.49]].map(p=>new T.Vector2(...p)),20),bone=new T.CylinderGeometry(.5,.4,1,12),scalp=new T.SphereGeometry(.5,18,12,0,Math.PI*2,0,Math.PI*.56),materials=new Map(),figures=new Set(),rigs=new WeakMap();bone.translate(0,-.5,0);
function material(type,color){const key=type+color;if(materials.has(key))return materials.get(key);const map=type==='skin'?skinTex:type==='hair'?hairTex:clothTex;const m=new T.MeshStandardMaterial({color,map,bumpMap:map,bumpScale:type==='skin'?.0007:type==='hair'?.002:.001,roughness:type==='skin'?.72:type==='hair'?.86:.94});materials.set(key,m);return m;}
function mesh(parent,geo,mat,pos,scale){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
function make(seed){const r=root.L99FaunaGenome131.random(seed),g=new T.Group(),body=new T.Group();g.add(body);const tones=[0x4d3024,0x76503a,0xa87251,0xc59572,0xe3b995,0xf0cfb0],clothes=[0x465f73,0x5b7059,0x854a47,0x755c80,0x9c835b,0x436e70];
const skin=material('skin',tones[Math.floor(r()*tones.length)]),cloth=material('cloth',clothes[Math.floor(r()*clothes.length)]),pants=material('cloth',clothes[Math.floor(r()*clothes.length)]),hair=material('hair',[0x201b18,0x493425,0x84623f,0xc1ae82,0x8a8780][Math.floor(r()*5)]),dark=material('cloth',0x29282a),broad=.9+r()*.2;
mesh(body,torsoGeo,cloth,[0,0,0],[broad,1,.66]);mesh(body,sphere,pants,[0,.94,0],[.33*broad,.25,.23]);mesh(body,bone,skin,[0,1.53,0],[.12,.14,.12]);
const head=new T.Group();head.position.y=1.61;body.add(head);mesh(head,sphere,skin,[0,0,0],[.225,.275,.235]);mesh(head,sphere,skin,[0,-.035,.035],[.17,.15,.19]);mesh(head,sphere,skin,[0,-.01,.116],[.035,.054,.049]);
for(const side of [-1,1]){mesh(head,sphere,dark,[side*.047,.028,.105],[.023,.016,.015]);mesh(head,sphere,skin,[side*.115,0,0],[.033,.059,.024]);}
mesh(head,sphere,material('skin',0x8c5c54),[0,-.06,.118],[.05,.011,.007]);
const style=Math.floor(r()*4),hairDetails=[];
if(style){mesh(head,scalp,hair,[0,.043,-.008],[.24,.20,.245]);if(style===2)mesh(head,sphere,hair,[0,-.035,-.07],[.24,.3,.15]);if(style===3)mesh(head,sphere,hair,[0,.16,-.045],[.095,.095,.09]);const strands=surf.fibers(seed,[0,.043,-.008],[.12,.10,.1225],style===2?.04:.015,420,hair.color,true);const hm=new T.Mesh(strands,hair);head.add(hm);hairDetails.push(hm);}
const arms=[],legs=[];
for(let i=0;i<2;i++){const side=i?1:-1,shoulder=new T.Group();shoulder.position.set(side*.205*broad,1.43,0);body.add(shoulder);mesh(shoulder,sphere,cloth,[0,-.03,0],[.14,.16,.145]);mesh(shoulder,bone,cloth,[0,0,0],[.11,.28,.11]);const elbow=new T.Group();elbow.position.y=-.28;shoulder.add(elbow);mesh(elbow,sphere,skin,[0,0,0],[.086,.086,.086]);mesh(elbow,bone,skin,[0,0,0],[.085,.25,.085]);mesh(elbow,sphere,skin,[0,-.29,0],[.065,.10,.05]);arms.push({shoulder,elbow});
const hip=new T.Group();hip.position.set(side*.086,.94,0);body.add(hip);mesh(hip,bone,pants,[0,0,0],[.145,.45,.14]);const knee=new T.Group();knee.position.y=-.45;hip.add(knee);mesh(knee,sphere,pants,[0,0,0],[.11,.115,.11]);mesh(knee,bone,pants,[0,0,0],[.105,.43,.105]);mesh(knee,sphere,dark,[0,-.44,.05],[.12,.07,.22]);legs.push({hip,knee});}
const fig={g,body,head,arms,legs,hairDetails,phase:0,previous:g.position.clone(),world:new T.Vector3(),seen:false};g.userData.citizen132=true;rigs.set(g,fig);figures.add(fig);return g;}
function pose(fig,phase,speed,time){const amount=Math.min(.52,Math.max(0,speed)*.45);for(let i=0;i<2;i++){const s=phase+i*Math.PI;fig.legs[i].hip.rotation.x=Math.sin(s)*amount;fig.legs[i].knee.rotation.x=Math.max(0,-Math.sin(s))*.72*Math.min(1,speed);fig.arms[i].shoulder.rotation.x=-Math.sin(s)*amount*.65;fig.arms[i].elbow.rotation.x=-.16-Math.max(0,Math.sin(s))*.17*Math.min(1,speed);}
fig.body.position.y=Math.abs(Math.sin(phase))*amount*.025;fig.body.rotation.z=Math.sin(phase)*amount*.022;fig.head.rotation.y=Math.sin(time*.35)*.07;}
let last=0;
function tick(now,camera){if(now-last<65)return;const dt=Math.min(.2,Math.max(.001,(now-last)/1000));last=now;
for(const fig of figures){let p=fig.g;while(p.parent)p=p.parent;if(!p.isScene){if(fig.seen){for(const h of fig.hairDetails)h.geometry.dispose();figures.delete(fig);}continue;}fig.seen=true;fig.g.getWorldPosition(fig.world);const d=fig.world.distanceTo(camera.position);for(const h of fig.hairDetails)h.visible=d<24;if(d>80){fig.previous.copy(fig.g.position);continue;}const moved=fig.g.position.distanceTo(fig.previous);fig.previous.copy(fig.g.position);const speed=moved/dt/Math.max(.1,fig.g.scale.y);fig.phase+=Math.min(moved,1)/Math.max(.1,fig.g.scale.y)*7;pose(fig,fig.phase,speed,now*.001);}}
const api={make,pose,tick,rig:g=>rigs.get(g),material,surf,scalp};factories.set(T,api);return api;}
root.L99Citizens132={create};
})(typeof window!=='undefined'?window:globalThis);

/* NATIVE_FAUNA_131: bounded, seeded wildlife; driven by the worlds' existing frames. */
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
 function spawn(kind,x,y,z,seed,cell,k){const node=new T.Group(),body=new T.Mesh(k.geometry,k.material);node.add(body);let limbs=[];
  const details=[];for(const d of k.details||[]){const m=new T.Mesh(d.geometry,d.material);m.position.set(...d.position);m.userData.detail132=true;body.add(m);details.push(m);}
  for(const a of k.attachments){const pivot=new T.Group(),mesh=new T.Mesh(a.geometry,k.material);pivot.position.set(...a.position);pivot.userData.phase131=a.phase||0;pivot.userData.side131=a.side;pivot.add(mesh);node.add(pivot);limbs.push(pivot);}
  node.scale.setScalar(k.scale);node.position.set(x,y,z);node.userData.fauna130=kind;node.userData.genome131=k.genome;node.name=k.genome.name;
  group.add(node);animals.push({node,k,limbs,body,details,kind,x,z,y,cell,angle:hash(cell[0],cell[1],seed)*6.28,phase:hash(cell[0],cell[1],seed+8)*6.28,state:'roam'});
 }
 function clearance(k){return {radius:Math.max(Math.abs(k.bounds.min.x),Math.abs(k.bounds.max.x),Math.abs(k.bounds.min.z),Math.abs(k.bounds.max.z))*k.scale+.12,height:Math.max(.5,k.bounds.max.y*k.scale+.12)};}
 function clear(){for(const a of animals)group.remove(a.node);animals.length=0;}
 function tick(env,now,bands){if(disposed)return;group.visible=!!env.active&&root._L99_FAUNA!==false;if(!group.visible){clear();last=now;return;}if(group.parent!==env.scene){if(group.parent)group.parent.remove(group);env.scene.add(group);}const key=String(env.seed)+':'+env.cave;
  if(epoch!==key){clear();epoch=key;cursor=0;spawnAt=0;}
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;const react=root._BARD_FAUNA_REACT!==false;
  bass+=(clamp(react&&bands?bands.bass:0)-bass)*Math.min(1,dt*8);high+=(clamp(react&&bands?bands.high:0)-high)*Math.min(1,dt*6);
  const cam=env.camera.position;
  for(let i=animals.length-1;i>=0;i--){let a=animals[i];if(Math.hypot(a.x-cam.x,a.z-cam.z)>75||Math.abs(a.y-cam.y)>24){group.remove(a.node);animals.splice(i,1);}}
  if(now>=spawnAt&&animals.length<cap){spawnAt=now+350;const index=cursor++%25,cx=Math.floor(cam.x/18)+(index%5)-2,cz=Math.floor(cam.z/18)+Math.floor(index/5)-2;
   if(!animals.some(a=>a.cell[0]===cx&&a.cell[1]===cz)){
    const x=(cx+.2+hash(cx,cz,env.seed)*.6)*18,z=(cz+.2+hash(cx,cz,env.seed+1)*.6)*18;
    if(Math.hypot(x-cam.x,z-cam.z)>8){let y=env.floor(x,z,cam.y);if(Number.isFinite(y)&&Math.abs(y-cam.y)<20){const field=env.field(x,z,y),kind=species(field,hash(cx,cz,env.seed+9));if(kind){const flying=/moth|bat/.test(kind),yy=y+(flying?1.8:0),dna=Math.floor(hash(cx,cz,env.seed+131)*4294967296),k=asset(kind,dna);if(env.valid(x,yy,z,flying,clearance(k)))spawn(kind,x,yy,z,env.seed,[cx,cz],k);}}}
   }
  }
  const simulate=now>=stepAt;if(simulate)stepAt=now+100;
  for(const a of animals){const distance=Math.hypot(a.x-cam.x,a.z-cam.z);for(const d of a.details)d.visible=distance<24;const alert=distance<3.5+a.k.genome.temperament*2;const listening=!alert&&bass>.08&&distance<20;
   a.state=alert?'flee':listening?'listen':Math.sin(now*.0003+a.phase)>.65?'rest':'roam';
   if(simulate&&a.state!=='listen'&&a.state!=='rest'){
    if(alert)a.angle=Math.atan2(a.x-cam.x,a.z-cam.z);else a.angle+=Math.sin(now*.0004+a.phase)*.08;
    const speed=(alert?2.4:a.k.beetle?.22:a.k.wing?.8:.55)*.1, x=a.x+Math.sin(a.angle)*speed,z=a.z+Math.cos(a.angle)*speed;
    const floor=env.floor(x,z,a.y), y=floor+(a.k.wing?1.8:0);
    if(Math.abs(x/18-a.cell[0]-.5)>1||Math.abs(z/18-a.cell[1]-.5)>1)a.angle+=Math.PI;
    else if(Number.isFinite(y)&&Math.abs(y-a.y)<.45&&env.valid(x,y,z,a.k.wing,clearance(a.k))){a.x=x;a.z=z;a.y=y;}else a.angle+=1.5;
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
