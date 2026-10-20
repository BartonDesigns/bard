/* COAT_GEOMETRY_203 */
/* COAT_UV_203 */
/* ECOSYSTEM_BUILD_138 */
/* LIFE_135: one ecological seed and physical scale contract for both renderers. */
(function(root){'use strict';const rng=root.L99FaunaGenome131.random,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let worldSeed=null;
function human(seed,child=false){const r=rng((seed^0x36184)>>>0),tail=r(),a=(r()+r()+r()+r()+r()+r()-3)/Math.sqrt(.5);let height=clamp(1.75+a*.105,1.49,2.03),rarity='ordinary';if(tail<.015){height=1.18+r()*.28;rarity='short';}else if(tail>.985){height=2.08+r()*.32;rarity='tall';}if(child){height=.94+r()*.4;rarity='child';}return{height,rarity,breadth:.92+r()*.16};}
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

/* ANATOMICAL_LANDMARKS_162 / ANIMAL_PROPORTIONS_161 / FAUNA_GENOME_135: habitat-constrained anatomy and procedural pigmentation. */
(function(root){'use strict';
function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function genome(kind,seed){const r=random(seed),range=(a,b)=>a+(b-a)*r();
const wing=/moth|bat|glider/.test(kind),beetle=/beetle/.test(kind),hopper=/hopper/.test(kind),wader=/wader/.test(kind),alpine=/mountain/.test(kind),bat=kind==='bat';
const cave=/cave|bat|lantern/.test(kind),body=range(.48,.8)*(beetle?.75:wing?.55:hopper?1:1.10),girth=body*(wing||beetle||hopper?range(.37,.56):alpine?range(.35,.46):range(.30,.43)),legs=wing?0:beetle?6:wader?2:4;
const leg=beetle?range(.12,.2):hopper?range(.26,.4):wader?range(.85,1.18):alpine?range(.59,.78):range(.65,1.03);
const hue=cave?range(.54,.62):alpine?range(.065,.095):wader?range(.10,.16):range(.055,.09);
return{version:138,seed:seed>>>0,kind,wing,beetle,hopper,wader,alpine,bat,cave,feathered:/glider/.test(kind),body,girth,legs,leg,
 neck:wader?range(.48,.82):hopper?range(.15,.24):range(.25,.55),head:range(.145,.205)*(wing?.68:beetle?.8:1),tail:wing?range(.18,.35):beetle?.05:hopper?.14:range(.5,1.05),ear:hopper?range(.3,.53):range(.12,.22),
 horns:!wing&&!beetle&&!hopper&&!wader&&(alpine||r()>.4),hornLength:range(.25,.57),hornCurl:range(.1,.65),crest:r()>.55,crestHeight:range(.09,.22),wingSpan:range(.62,1.05),wingSweep:range(.28,.65),wingLobes:bat?3:Math.floor(range(2,5)),
 hue,saturation:range(.13,.30),lightness:cave?range(.075,.15):range(.09,.23),marking:Math.floor(range(0,4)),patternScale:range(3,8),patternPhase:range(0,6.283),scale:range(.82,1.13),temperament:range(.2,.9),name:['Velvet','Crested','Ribbon','Dappled','Amber','Veiled'][Math.floor(r()*6)]+' '+kind+' · '+(seed>>>0).toString(36).toUpperCase()};}
function create(T){
function colors(g){return{body:new T.Color().setHSL(g.hue,g.saturation,g.lightness),belly:new T.Color().setHSL(g.hue,.19,Math.min(.78,g.lightness+.10)),accent:new T.Color().setHSL((g.hue+.025)%1,.25,g.lightness*.8),dark:new T.Color().setHSL(g.hue,.22,.13),horn:new T.Color().setHSL(.11,.16,.35),eye:new T.Color().setHSL((g.hue+.42)%1,.75,.56)};}
function texture(g){const size=256,data=new Uint8Array(size*size*4),r=random(g.seed+781),spots=Array.from({length:18},()=>[r(),r(),.018+r()*.035]);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size;let pat;
if(g.marking===0)pat=.84+.16*Math.tanh((Math.sin(u*g.patternScale*6.283+Math.sin(v*14)*1.2+g.patternPhase)-.35)*4);
else if(g.marking===1)pat=spots.reduce((value,s)=>Math.min(value,.6+.4*Math.max(0,Math.min(1,(Math.hypot((u-s[0])*1.1,v-s[1])-s[2]+.008)/.016))),1);
else if(g.marking===2){const f=Math.sin(u*35+Math.sin(v*24)*2)*Math.sin(v*29);pat=.77+.23*f;}
else pat=.83+.17*Math.sin(v*48+Math.sin(u*11));
const pores=.95+r()*.05,grain=Math.round(255*Math.max(.65,.48+.52*pat*pores)),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=grain;data[i+3]=255;}
const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=2;t.needsUpdate=true;return t;}
function builder(palette){const positions=[],normals=[],uvs=[],cols=[];
function add(geo,color){const g=geo.index?geo.toNonIndexed():geo,pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv;for(let i=0;i<pa.count;i++){positions.push(pa.getX(i),pa.getY(i),pa.getZ(i));normals.push(na.getX(i),na.getY(i),na.getZ(i));uvs.push(ua?ua.getX(i):0,ua?ua.getY(i):0);const vc=g.attributes.color;cols.push(vc?vc.getX(i):color.r,vc?vc.getY(i):color.g,vc?vc.getZ(i):color.b);}if(g!==geo)g.dispose();geo.dispose();}
function ellipsoid(pos,scale,color,rotation=0){const g=new T.SphereGeometry(1,18,12);g.scale(...scale);g.rotateX(rotation);g.translate(...pos);add(g,color);}
// Continuous skin envelope with correlated shoulder, rib, loin and gluteal volumes.
function trunk(g,y,palette){const p=[],uv=[],color=[],indices=[],rings=28,sides=28,gauss=(v,c,w)=>Math.exp(-(((v-c)/w)**2));
for(let j=0;j<=rings;j++){const t=j/rings,q=t*2-1,round=Math.sqrt(Math.max(0,1-q*q));for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,nx=Math.cos(a),ny=Math.sin(a),shoulder=gauss(q,.48,.25),haunch=gauss(q,-.5,.29),rib=gauss(q,.03,.52),flank=gauss(q,-.12,.23),side=Math.pow(Math.abs(nx),3),muscle=1+(shoulder*.14+haunch*(g.hopper?.25:.16))*side;
const x=nx*g.girth*round*muscle,z=q*g.body,back=ny>0?.035*g.girth*(shoulder+haunch):0,tuck=ny<0?.18*g.girth*flank:0;
p.push(x,y+ny*g.girth*round*(.92+.06*rib)+back+tuck,z);uv.push(i/sides,t);const belly=Math.max(0,-ny)*.45,c=palette.body.clone().lerp(palette.belly,belly);color.push(c.r,c.g,c.b);if(j<rings&&i<sides){const k=j*(sides+1)+i;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(color,3));geo.setIndex(indices);geo.computeVertexNormals();add(geo,palette.body);}
// A single longitudinal skin surface from haunch through withers, neck, cheek and muzzle.
function mammal(g,y,palette){const h=g.head,b=g.body,r=g.girth,hy=y+g.neck,hz=b*.73+g.neck*.3;
const sections=[[-b*.98,y+.03*r,.025*r,.025*r],[-b*.78,y+.025*r,.67*r,.83*r],[-b*.55,y+.025*r,.96*r,.98*r],[-b*.24,y+.04*r,.82*r,.85*r],[b*.04,y+.015*r,.94*r,1.04*r],[b*.30,y+.045*r,.93*r,.94*r],[b*.50,y+.09*r,.80*r,.78*r],[b*.67,y+g.neck*.36,.52*r,.70*r],[hz-h*.80,hy-h*.20,h*.68,h*.74],[hz,hy,h*.98,h*.85],[hz+h*.48,hy-h*.025,h*.94,h*.74],[hz+h*.95,hy-h*.18,h*.62,h*.49],[hz+h*1.65,hy-h*.24,h*.48,h*.34],[hz+h*1.85,hy-h*.24,h*.035,h*.035]];
// Keep the sweep ordered even on the shortest-neck genomes.
for(let j=1;j<sections.length;j++)sections[j][0]=Math.max(sections[j][0],sections[j-1][0]+h*.06);
const p=[],uv=[],cc=[],idx=[],rings=72,sides=40,ga=(v,c,w)=>Math.exp(-(((v-c)/w)**2));
const lerp=(a,b,t)=>a+(b-a)*t,first=sections[0][0],last=sections[sections.length-1][0];
for(let j=0;j<=rings;j++){const z=lerp(first,last,j/rings);let k=0;while(k<sections.length-2&&z>sections[k+1][0])k++;const A=sections[k],B=sections[k+1],t=(z-A[0])/(B[0]-A[0]),f=t*t*(3-2*t),shape=(channel)=>{const P=sections[Math.max(0,k-1)],Q=sections[Math.min(sections.length-1,k+2)],span=B[0]-A[0],m0=(B[channel]-P[channel])/(B[0]-P[0])*.8,m1=(Q[channel]-A[channel])/(Q[0]-A[0])*.8;return (2*t*t*t-3*t*t+1)*A[channel]+(t*t*t-2*t*t+t)*span*m0+(-2*t*t*t+3*t*t)*B[channel]+(t*t*t-t*t)*span*m1;},cy=shape(1),rx=Math.max(.002,shape(2)),ry=Math.max(.002,shape(3));
for(let i=0;i<=sides;i++){const theta=(i%sides)/sides*Math.PI*2,nx=Math.cos(theta),ny=Math.sin(theta),bodyZone=1-ga(z,hz,h*1.0),side=Math.abs(nx)**3;
const scapula=ga(z,b*.38,b*.18)*ga(ny,.35,.48),deltoid=ga(z,b*.53,b*.15)*ga(ny,-.26,.38),haunch=ga(z,-b*.58,b*.23)*ga(ny,.06,.7),flank=ga(z,-b*.21,b*.17)*ga(ny,-.34,.45),rib=ga(z,b*.06,b*.26)*ga(ny,-.05,.7);
const contour=r*side*(.12*scapula+.09*deltoid+(g.hopper?.24:.14)*haunch-.13*flank+.035*rib),withers=r*.13*ga(z,b*.39,b*.2)*Math.max(0,ny)**5;
const x=nx*(rx+contour*bodyZone),yy=cy+ny*ry+withers; p.push(x,yy,z);uv.push(i/sides,(z-first)/(last-first));
const underside=Math.max(0,-ny),dorsal=Math.max(0,ny),c=palette.body.clone().lerp(palette.belly,underside*.65).multiplyScalar(1-dorsal*.10);cc.push(c.r,c.g,c.b);
if(j<rings&&i<sides){const n=j*(sides+1)+i;idx.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}}}
const filtered=[];for(let i=0;i<idx.length;i+=3){const a=idx.slice(i,i+3),cx=a.reduce((v,k)=>v+p[k*3]/3,0),cy=a.reduce((v,k)=>v+p[k*3+1]/3,0),cz=a.reduce((v,k)=>v+p[k*3+2]/3,0),ey=(cy-hy-h*.16)/(h*.15),ez=(cz-hz-h*.48)/(h*.20);if(Math.abs(cx)>h*.72&&ey*ey+ez*ez<1)continue;filtered.push(...a);}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(cc,3));geo.setIndex(filtered);geo.computeVertexNormals();const normals=geo.attributes.normal;for(let j=0;j<=rings;j++){const a=j*(sides+1),b=a+sides,v=new T.Vector3(normals.getX(a)+normals.getX(b),normals.getY(a)+normals.getY(b),normals.getZ(a)+normals.getZ(b)).normalize();normals.setXYZ(a,v.x,v.y,v.z);normals.setXYZ(b,v.x,v.y,v.z);}add(geo,palette.body);g.anatomy137={surface:'continuous torso-neck-skull',landmarks:['scapula','withers','deltoid','ribcage','flank','haunch'],rings,sides};
}
function head(g,y,z,palette){const geo=new T.SphereGeometry(1,48,36);geo.scale(g.head,g.head*.88,g.head*1.32);geo.translate(0,y,z);const raw=geo.toNonIndexed(),p=raw.attributes.position,n=raw.attributes.normal,u=raw.attributes.uv,pp=[],nn=[],uu=[];
for(let i=0;i<p.count;i+=3){let cx=0,cy=0,cz=0;for(let j=0;j<3;j++){cx+=p.getX(i+j)/3;cy+=p.getY(i+j)/3;cz+=p.getZ(i+j)/3;}
// Small bilateral orbital openings. Eyelid rims conceal the tessellated boundary.
const ey=(cy-y-g.head*.16)/(g.head*.145),ez=(cz-z-g.head*.48)/(g.head*.18);if(Math.abs(cx)>g.head*.72&&ey*ey+ez*ez<1)continue;
for(let j=0;j<3;j++){pp.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));nn.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));uu.push(u.getX(i+j),u.getY(i+j));}}
const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(pp,3));out.setAttribute('normal',new T.Float32BufferAttribute(nn,3));out.setAttribute('uv',new T.Float32BufferAttribute(uu,2));raw.dispose();geo.dispose();add(out,palette.body);}
function tube(points,radii,color,segments=20,sides=9){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(segments,false),p=[],uv=[],indices=[];
for(let i=0;i<=segments;i++){const t=i/segments,c=curve.getPointAt(t),index=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(index)),f=index-j,rad=radii[j]*(1-f)+radii[j+1]*f;
for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2;const v=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*rad).addScaledVector(frames.binormals[i],Math.sin(a)*rad);p.push(v.x,v.y,v.z);uv.push(k/sides,t);if(i<segments&&k<sides){const a0=i*(sides+1)+k,b=a0+sides+1;indices.push(a0,b,a0+1,b,b+1,a0+1);}}}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();add(geo,color);}
function ear(g,side,headY,headZ){const p=[],u=[],ix=[],colors=[],rows=18,cols=10,base=[side*g.head*.60,headY+g.head*.55,headZ-.05];for(let j=0;j<=rows;j++){const t=j/rows,width=Math.pow(Math.sin(Math.PI*t),.70)*g.head*(g.hopper?.36:.42);for(let i=0;i<=cols;i++){const v=i/cols*2-1,x=base[0]+side*(g.ear*.30*t+width*v),y=base[1]+g.ear*.92*t,z=base[2]-.10*t-.023*(1-v*v)*Math.sin(Math.PI*t);p.push(x,y,z);u.push(i/cols,t);const inner=(1-v*v)*Math.sin(Math.PI*t),c=palette.body.clone().lerp(palette.belly,inner*.45);colors.push(c.r,c.g,c.b);if(j<rows&&i<cols){const k=j*(cols+1)+i;ix.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(u,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ix);geo.computeVertexNormals();add(geo,palette.body);}
function hoof(foot,color){for(const side of [-1,1]){const geo=new T.SphereGeometry(1,14,10);geo.scale(.023,.035,.069);const p=geo.attributes.position;for(let i=0;i<p.count;i++){p.setY(i,Math.max(-.023,p.getY(i)));p.setZ(i,p.getZ(i)+Math.max(0,p.getZ(i))*.15);}geo.translate(foot[0]+side*.025,foot[1]+.009,foot[2]+.014);geo.computeVertexNormals();add(geo,color);}}
function membrane(side,g,color){const p=[],uv=[],indices=[],colsLocal=[],rows=12,columns=24;
for(let i=0;i<=rows;i++){const v=i/rows;for(let j=0;j<=columns;j++){const u=j/columns,edge=g.wingSpan*Math.pow(Math.sin(Math.PI*u),.52)*(1-.13*Math.cos(u*g.wingLobes*Math.PI*2)),x=side*(.055+edge*v),z=(u-.45)*g.body*3.4-v*g.wingSweep*.3,y=Math.sin(v*Math.PI)*.08; p.push(x,y,z);uv.push(u,v);if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,a+1,b,b,a+1,b+1);}}}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();add(geo,color);
// Curved supporting fingers give membranes an anatomical structure.
for(let i=1;i<5;i++){const u=i/5,edge=g.wingSpan*Math.pow(Math.sin(Math.PI*u),.52)*(1-.13*Math.cos(u*g.wingLobes*Math.PI*2)),z=(u-.45)*g.body*3.4;
tube([[side*.055,0,0],[side*edge*.5,.06,z*.5],[side*edge,0,z-g.wingSweep*.3]],[.018,.012,.003],palette.dark,9,6);}}
function finish(){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(cols,3));geo.computeBoundingBox();geo.computeBoundingSphere();return geo;}
return{ellipsoid,trunk,mammal,head,tube,ear,hoof,membrane,finish};}
function build(kind,seed){const g=genome(kind,seed),c=colors(g),b=builder(c),attachments=[];
let y=g.wing?0:g.beetle?.23:g.leg+g.girth*.6;
const mammal=!g.wing&&!g.beetle&&!g.wader;
if(mammal)b.mammal(g,y,c);else if(!g.wing&&!g.beetle)b.trunk(g,y,c);else b.ellipsoid([0,y,0],[g.girth,g.girth*(g.beetle?.7:1),g.body],c.body);
g.anatomy135={shoulder:[0,y,g.body*.48],ribcage:[0,y,0],gluteal:[0,y,-g.body*.5],surface:"continuous muscle envelope"};
const headY=g.wing?.07:g.beetle?.22:y+g.neck,headZ=g.body*.73+g.neck*.3;
if(!g.wing&&!g.beetle&&!mammal)b.tube([[0,y,g.body*.45],[0,y+g.neck*.5,g.body*.62],[0,headY,headZ]],[g.girth*.7,g.head*.75,g.head*.85],c.body);
if(!mammal)b.head(g,headY,headZ,c);g.eyeLayout135={y:headY,z:headZ};
if(mammal){b.ellipsoid([0,headY-g.head*.24,headZ+g.head*1.70],[g.head*.40,g.head*.20,g.head*.13],c.dark);for(const side of [-1,1])b.ellipsoid([side*g.head*.26,headY-g.head*.20,headZ+g.head*1.81],[g.head*.085,g.head*.065,g.head*.025],c.dark.clone().multiplyScalar(.18));b.tube([[-g.head*.48,headY-g.head*.47,headZ+g.head*1.12],[0,headY-g.head*.48,headZ+g.head*1.64],[g.head*.48,headY-g.head*.47,headZ+g.head*1.12]],[.002,.003,.002],c.dark,16,5);}
if(!mammal&&!g.wing&&!g.beetle&&!g.wader)b.ellipsoid([0,headY-g.head*.2,headZ+g.head*.9],[g.head*.64,g.head*.44,g.head*.92],c.body.clone().lerp(c.belly,.28));
for(const side of [-1,1]){
 if(!g.beetle&&!g.wader&&(!g.wing||g.bat)){b.ear(g,side,headY,headZ);}
 if(g.horns)b.tube([[side*g.head*.65,headY+g.head*.65,headZ-.04],[side*(g.head+g.hornCurl*.25),headY+g.hornLength*.65,headZ-.15],[side*(g.head+g.hornCurl*.3),headY+g.hornLength,headZ-.25-g.hornCurl*.2]],[.065,.043,.002],c.horn);
 if(g.beetle||(g.wing&&!g.feathered&&!g.bat))b.tube([[side*.06,headY,headZ+.1],[side*.18,headY+.15,headZ+.3],[side*.25,headY+.19,headZ+.4]],[.014,.009,.002],c.accent,12,6);
}
if(g.feathered){b.tube([[0,0,g.body*.6],[0,.04,headZ-g.head*.6],[0,headY,headZ]],[g.girth*.6,g.head*.8,g.head*.65],c.body,12,12);b.tube([[0,headY-.015,headZ+g.head*.75],[0,headY-.03,headZ+g.head*1.5],[0,headY-.06,headZ+g.head*2.1]],[g.head*.5,g.head*.29,.002],c.horn,12,12);}
if(g.wader)b.tube([[0,headY,headZ+.12],[0,headY-.02,headZ+.4],[0,headY-.1,headZ+.65]],[.065,.04,.001],c.horn,12);
if(g.crest&&g.wader){for(let i=0;i<5;i++){const z=g.body*(.6-i*.27);b.ellipsoid([0,y+g.girth*.88,z],[.035,g.crestHeight,.09],c.accent,-.4);}}
if(g.wing&&!g.feathered&&!g.bat){for(let i=0;i<4;i++)b.ellipsoid([0,0,-g.body*.2-i*g.body*.21],[g.girth*(.85-i*.12),g.girth*(.85-i*.12),g.body*.17],i%2?c.accent:c.body);}
if(g.beetle){for(let i=0;i<5;i++)for(const side of [-1,1])b.ellipsoid([side*g.girth*.55,y+g.girth*.55,(i-2)*g.body*.3],[.045,.022,.055],c.accent);}
if(!g.wing&&g.tail>.2)b.tube([[0,y,-g.body*.7],[0,y-.05,-g.body-g.tail*.25],[g.tail*.15,y+.08,-g.body-g.tail*.7],[g.tail*.25,y+.22,-g.body-g.tail]],[g.girth*.18,.04,.025,.012],c.body,24);
if(g.wing){for(const side of [-1,1]){const w=builder(c);w.membrane(side,g,g.bat?c.body:c.accent);attachments.push({geometry:w.finish(),position:[0,0,0],wing:true,side});}}
else for(let i=0;i<g.legs;i++){const side=i%2?1:-1,pair=Math.floor(i/2),limbLength=g.leg+(g.beetle?0:g.girth*.35),hip=[side*g.girth*.68,limbLength,g.beetle?(pair-1)*g.body*.6:g.wader?0:(pair?-.5:.5)*g.body],l=builder(c),splay=g.beetle?.3:.06,knee=[side*splay,-limbLength*.53,g.hopper?-.15:.08],foot=[side*splay*1.2,-limbLength,.05];
if(mammal){const hind=pair>0,thigh=Math.min(g.girth*(g.hopper&&hind?.57:hind?.34:.22),limbLength*.22),joint=g.girth*(hind?.14:.11),kneeZ=(hind?.11:-.055)*Math.min(1,g.leg/.7),hockZ=(hind?-.06:.025)*Math.min(1,g.leg/.7);
l.tube([[0,.10*g.girth,0],[side*.015,-limbLength*.22,hind?-.015:-.06],[side*.03,-limbLength*.47,kneeZ],[side*.04,-limbLength*.76,hockZ],foot],[thigh*.94,thigh,thigh*.80,thigh*.38,joint,joint*.85,.029,.022,.024],c.body,28,14);
}else l.tube([[0,0,0],knee,foot],[g.beetle?.045:g.girth*.27,g.beetle?.038:g.girth*.30,g.beetle?.032:.069,g.beetle?.029:.052,.032,.024],c.body,20,10);
if(mammal&&!g.hopper)l.hoof(foot,c.dark);else l.ellipsoid(foot,[g.wader?.075:.052,g.wader?.025:.04,g.hopper?.13:.085],c.dark);
if(g.wader||g.beetle)for(let toe=-1;toe<=1;toe++)l.tube([foot,[foot[0]+toe*.045,-limbLength,foot[2]+.08],[foot[0]+toe*.09,-limbLength,foot[2]+.17]],[.014,.009,.001],c.dark,6,5);
attachments.push({geometry:l.finish(),position:hip,wing:false,side,phase:g.hopper?(pair?Math.PI:0):i===0||i===3?0:Math.PI});}
const geometry=b.finish(),map=texture(g),material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,map,bumpMap:map,bumpScale:g.beetle?.009:.018,roughness:g.beetle?.43:.82,metalness:g.beetle?.12:0,side:T.DoubleSide,emissive:g.beetle?new T.Color().setHSL(g.hue,.6,.22):0x15201c,emissiveIntensity:g.beetle?.3:0});
const bounds=geometry.boundingBox.clone();for(const a of attachments){const box=a.geometry.boundingBox.clone().translate(new T.Vector3(...a.position));bounds.union(box);}
return{genome:g,geometry,material,map,attachments,bounds,wing:g.wing,beetle:g.beetle,hopper:g.hopper,wader:g.wader,scale:g.scale,dispose(){geometry.dispose();for(const a of attachments)a.geometry.dispose();material.dispose();map.dispose();}};
}
return{build};}
root.L99FaunaGenome131={genome,random,create};
})(typeof window!=='undefined'?window:globalThis);

/* UNIVERSAL_ANATOMY_144: seeded anatomical fields and soft joints shared by living actors. */
(function(root){'use strict';
const ga=(x,c,w)=>Math.exp(-(((x-c)/w)**2)),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function dna(seed){const r=root.L99FaunaGenome131.random((seed^144381)>>>0);return{muscle:.82+r()*.38,condition:.85+r()*.30,jaw:.88+r()*.22,shoulder:.92+r()*.16};}
function change(T,geo,fn){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const v=fn(p.getX(i),p.getY(i),p.getZ(i));p.setXYZ(i,...v);}p.needsUpdate=true;geo.computeVertexNormals();if(!geo.index){const n=geo.attributes.normal,groups=new Map(),keys=[];for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');keys.push(key);const a=groups.get(key)||[0,0,0];a[0]+=n.getX(i);a[1]+=n.getY(i);a[2]+=n.getZ(i);groups.set(key,a);}for(let i=0;i<p.count;i++){const a=groups.get(keys[i]),l=Math.hypot(...a)||1;n.setXYZ(i,a[0]/l,a[1]/l,a[2]/l);}}geo.computeBoundingBox();geo.computeBoundingSphere();geo.userData.anatomy144=true;}
function animal(T,k,seed){const g=k.genome,d=dna(seed),h=g.head,b=g.body,r=g.girth,y=g.wing?0:g.beetle?.23:g.leg+r*.6,hy=g.eyeLayout135.y,hz=g.eyeLayout135.z;
 change(T,k.geometry,(x,yy,z)=>{const side=Math.min(1,Math.abs(x)/Math.max(.01,r)),body=ga(z,0,b*.8),shoulder=ga(z,b*.36,b*.19),haunch=ga(z,-b*.52,b*.23),flank=ga(z,-b*.17,b*.20),top=clamp((yy-y)/r),low=clamp((y-yy)/r);
  if(g.beetle){const shell=ga(yy,y+r*.38,r*.30)*body;x*=1+.055*shell;yy+=r*.025*shell*Math.cos(z/b*13);}
  else {const mass=(g.wing?.10:.075)*d.condition*shoulder+(!g.wing?.085*haunch:0)-.040*flank;x*=1+d.muscle*mass*side*ga(yy,y,r*.9);yy+=r*d.muscle*(.06*shoulder*top-.055*body*low*(g.wing?1.8:1));}
  // Restrict cheek and mandibular shaping below the fixed eye sockets; ears and horns are untouched.
  const face=ga(z,hz+h*.68,h*.68)*ga(yy,hy-h*.30,h*.20),angle=ga(z,hz+h*.45,h*.20);x*=1+face*(.10*d.jaw*angle-.035);yy-=h*.05*face;
  return[x,yy,z];});
 for(const a of k.attachments){if(a.wing){if(g.bat)change(T,a.geometry,(x,y,z)=>[x,y-.035*Math.sin(Math.min(Math.PI,Math.abs(x)/g.wingSpan*Math.PI)),z]);continue;}
  a.geometry.computeBoundingBox();const box=a.geometry.boundingBox,L=Math.max(.01,-box.min.y);change(T,a.geometry,(x,y,z)=>{const t=clamp(-y/L),muscle=ga(t,.22,.18)*.10*d.muscle-ga(t,.52,.065)*.035+ga(t,.70,.14)*.055;return[x*(1+muscle),y,z*(1+muscle*.8)];});a.softJoint144={length:L,knee:.52};
 }
 k.bounds.copy(k.geometry.boundingBox);for(const a of k.attachments)k.bounds.union(a.geometry.boundingBox.clone().translate(new T.Vector3(...a.position)));
 g.anatomy144={family:g.beetle?'exoskeleton':g.wing?'flight muscles':g.wader?'wading bird':'mammal',dna:d,coatFollowsSurface:true};return k;
}
// Joints remain the original animated pivots. Skin weights add deformation between them.
function skin(T,g,meshes,joints,next=new Map(),defaultJoint=g,owned=false){g.updateMatrixWorld(true);const unique=[...new Set([g,...joints])],skeleton=new T.Skeleton(unique),world=unique.map(j=>j.getWorldPosition(new T.Vector3())),ownedGeos=[],ownedMats=[],replaced=new Map();
 for(const old of meshes){if(old.isSkinnedMesh||!old.geometry.attributes.position.count)continue;const geo=old.geometry.clone(),p=geo.attributes.position,ids=[],weights=[],v=new T.Vector3();let joint=old.parent;while(joint&& !unique.includes(joint))joint=joint.parent;if(!joint||joint===g)joint=defaultJoint;const i=unique.indexOf(joint),child=next.get(joint),j=child?unique.indexOf(child):i,axis=world[j].clone().sub(world[i]),length=axis.lengthSq();
  for(let n=0;n<p.count;n++){v.fromBufferAttribute(p,n).applyMatrix4(old.matrixWorld);const t=length?clamp(v.sub(world[i]).dot(axis)/length):0,w=j!==i?(geo.userData.limb145?smooth((t-.60)/.65):smooth((t-.55)/.45)*.48):0;if(geo.userData.chain146&&geo.attributes.aChain146){const a=geo.attributes.aChain146,chain=geo.userData.chain146,first=chain[a.getX(n)]==='@body'?unique.indexOf(defaultJoint):unique.findIndex(b=>b.uuid===chain[a.getX(n)]),second=chain[a.getY(n)]==='@body'?unique.indexOf(defaultJoint):unique.findIndex(b=>b.uuid===chain[a.getY(n)]),blend=a.getZ(n);if(first<0||second<0)throw Error('Missing axial tissue bone');ids.push(first,second,0,0);weights.push(1-blend,blend,0,0);}else {ids.push(i,j,0,0);weights.push(1-w,w,0,0);}}
  geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const mat=old.material.clone();mat.onBeforeCompile=old.material.onBeforeCompile;mat.customProgramCacheKey=old.material.customProgramCacheKey.bind(old.material);mat.skinning=true;mat.needsUpdate=true;
  const m=new T.SkinnedMesh(geo,mat);m.position.copy(old.position);m.quaternion.copy(old.quaternion);m.scale.copy(old.scale);m.userData={...old.userData,softSkin144:true};m.visible=old.visible;m.castShadow=m.receiveShadow=true;const parent=old.parent;parent.add(m);for(const c of [...old.children])m.add(c);parent.remove(old);m.updateMatrixWorld(true);m.bind(skeleton,m.matrixWorld.clone());replaced.set(old,m);ownedGeos.push(geo);ownedMats.push(mat);if(!owned)old.geometry.dispose();
 }
 let released=false;const release=()=>{if(released)return;released=true;skeleton.dispose();if(owned){ownedGeos.forEach(x=>x.dispose());ownedMats.forEach(x=>x.dispose());}};
 return{skeleton,replaced,release,meshes:[...replaced.values()]};
}
function native(T,g,mats,kind,seed){if(g.userData.anatomy144)return;const P=g.userData.parts;if(!P)return;const d=dna(seed);
 if(g._theropod142){g.userData.anatomy144={family:mats.family,dna:d,rig:'existing 23-bone skin'};return;}
 // Shape actual torso vertices in actor space, preserving the established attachment locations.
 for(const host of [P.chest])if(host&&host.geometry.attributes.position.count&&!host.geometry.userData.axial146){g.updateMatrixWorld(true);const to=g.matrixWorld.clone().invert().multiply(host.matrixWorld),back=to.clone().invert(),box=host.geometry.boundingBox||(()=>{host.geometry.computeBoundingBox();return host.geometry.boundingBox;})(),center=box.getCenter(new T.Vector3()).applyMatrix4(to),extent=box.getSize(new T.Vector3()).multiply(host.scale),v=new T.Vector3();const reshape=(x,y,z)=>{v.set(x,y,z).applyMatrix4(to);const q=(v.z-center.z)/Math.max(.2,extent.z),side=clamp(Math.abs(v.x)/Math.max(.15,extent.x*.5)),shoulder=ga(q,.20,.19),rib=ga(q,-.05,.25),lower=clamp((center.y-v.y)/Math.max(.15,extent.y*.5));v.x*=1+d.muscle*side*(.10*shoulder+.035*rib);v.y-=Math.max(.03,extent.y)*lower*(kind==='bird'?.13:.035)*rib;return v.applyMatrix4(back).toArray();};change(T,host.geometry,reshape);for(const child of host.children)if(child.isMesh&&child.userData.dinoDown139){const normal=child.geometry.attributes.normal.clone();change(T,child.geometry,reshape);child.geometry.setAttribute('normal',normal);}}
 const breath=new T.Group();breath.name='ribcage144';g.add(breath);if(P.chest)breath.position.copy(P.chest.position);P.breathChest=breath;
 const joints=[breath,...(P.legs||[]),...(P.knees||[]),...(P.feet||[]),...(P.neckSegments||[]),...(P.tailSegments||[]),...(P.wings||[]),...(P.arms||[]),P.head,P.jaw].filter(Boolean),next=new Map();
 for(let i=0;i<(P.legs||[]).length;i++){next.set(P.legs[i],P.knees[i]);next.set(P.knees[i],P.feet[i]);}for(const chain of [P.neckSegments||[],P.tailSegments||[]])for(let i=0;i<chain.length-1;i++)next.set(chain[i],chain[i+1]);
 const meshes=[];g.traverse(o=>{if(o.isMesh&&([mats.body,mats.underside,mats.membrane].includes(o.material)||o.userData.dinoDown139))meshes.push(o);});
 const rig=skin(T,g,meshes,joints,next,breath);for(const key of Object.keys(P))if(rig.replaced.has(P[key]))P[key]=rig.replaced.get(P[key]);g.userData.detailMeshes=(g.userData.detailMeshes||[]).map(m=>rig.replaced.get(m)||m);g._anatomy144=rig;g.userData.anatomy144={family:mats.family,dna:d,rig:'soft weighted native pivots',joints:rig.skeleton.bones.length};
}
function citizen(T,fig,seed){const {g,body,head,arms,legs}=fig,d=dna(seed),owned=[];
 // Clothing follows chest, waist and shoulder structure rather than uniform lathe widths.
 for(const m of body.children)if(m.isMesh&&m.geometry.type==='LatheGeometry'&&m.geometry.attributes.position.count>300&&m.position.y===0){m.geometry=m.geometry.clone();owned.push(m.geometry);change(T,m.geometry,(x,y,z)=>{const chest=ga(y,1.31,.13),waist=ga(y,1.10,.10),clavicle=ga(y,1.43,.045);return[x*(1+.07*d.shoulder*chest-.035*waist),y,z*(1+.13*d.muscle*chest-.055*waist)+.008*clavicle];});}
 for(const [limbs,upper,lower] of [[arms,'shoulder','elbow'],[legs,'hip','knee']])for(const limb of limbs)for(const key of [upper,lower])for(const m of limb[key].children)if(m.isMesh&&m.geometry.type==='LatheGeometry'){m.geometry=m.geometry.clone();owned.push(m.geometry);change(T,m.geometry,(x,y,z)=>{const t=-y,f=1+.12*d.muscle*ga(t,.30,.20)-.08*ga(t,.88,.13);return[x*f,y,z*(1+(f-1)*.8)];});}
 const face=fig.faceGeo;change(T,face,(x,y,z)=>{const front=clamp(z*3),jaw=ga(y,-.28,.13),chin=ga(y,-.42,.085),cheek=ga(y,-.01,.12)*ga(Math.abs(x),.30,.15),brow=ga(y,.16,.055),orbit=ga(y,.10,.055)*ga(Math.abs(x),.21,.06);return[x*(1+.13*d.jaw*jaw-.07*chin),y,z+front*(.035*cheek+.018*brow-.018*orbit+.023*chin)];});
 // Four separated fingers and an opposing thumb per hand use the existing wrist motion.
 for(const limb of arms){const hand=limb.elbow.children.find(m=>m.isMesh&&m.geometry.type==='SphereGeometry'&&m.position.y<-.2);if(!hand)continue;hand.scale.set(.070,.080,.035);for(let i=0;i<4;i++){const len=.038+(.012-Math.abs(i-1.4)*.005),geo=new T.SphereGeometry(1,10,8);geo.scale(.007,len*.5,.008);const m=new T.Mesh(geo,hand.material);m.position.set((i-1.5)*.015,-.338-len*.35,.002);limb.elbow.add(m);owned.push(geo);}const geo=new T.SphereGeometry(1,10,8);geo.scale(.010,.025,.010);const thumb=new T.Mesh(geo,hand.material);thumb.position.set(.040,-.304,.014);thumb.rotation.z=-.45;limb.elbow.add(thumb);owned.push(geo);}
 const joints=[body,head,...arms.flatMap(a=>[a.shoulder,a.elbow]),...legs.flatMap(a=>[a.hip,a.knee])],next=new Map();arms.forEach(a=>next.set(a.shoulder,a.elbow));legs.forEach(a=>next.set(a.hip,a.knee));const meshes=[];g.traverse(o=>{if(o.isMesh&&!o.material.userData.eye135&&!fig.hairDetails.includes(o))meshes.push(o);});const rig=skin(T,g,meshes,joints,next,body,true);g._anatomy144=rig;fig.release144=()=>{rig.release();owned.forEach(x=>x.dispose());};g.userData.anatomy144={family:'humanoid',dna:d,rig:'soft weighted shoulders elbows hips knees',fingers:10};
}
function faunaRig(T,node,k,limbs){const joints=[],next=new Map(),meshes=[];for(const [i,limb] of limbs.entries()){const a=k.attachments[i],joint=new T.Group();if(a.wing)joint.position.set(a.side*k.genome.wingSpan*.45,0,0);else joint.position.set(0,-(a.softJoint144?a.softJoint144.length:k.genome.leg)*.52,0);limb.add(joint);limb.userData.softJoint144=joint;joints.push(limb,joint);next.set(limb,joint);limb.traverse(o=>{if(o.isMesh)meshes.push(o);});}const rig=skin(T,node,meshes,joints,next,node,true);node._anatomy144=rig;node.userData.anatomy144=k.genome.anatomy144;return rig;}
function legacy(T,mesh,kind,seed){if(!mesh.geometry||mesh.userData.anatomy144)return;const geo=mesh.geometry;geo.computeBoundingBox();const box=geo.boundingBox,c=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),d=dna(seed);if(size.length()<.001)return;change(T,geo,(x,y,z)=>{const q=(z-c.z)/Math.max(.01,size.z),side=(x-c.x)/Math.max(.01,size.x),mass=.07*d.muscle*ga(q,.16,.22)-.035*ga(q,-.20,.17);return[c.x+(x-c.x)*(1+mass),y-Math.max(0,c.y-y)*.025*ga(q,.1,.3),z];});mesh.userData.anatomy144={family:kind,dna:d,rig:'preserved native motion',surface:'seeded axial contours'};}
function installNative(){const fit=root.L99Life133.fitPerson;root.L99Life133.fitPerson=function(T,g,seed,realm,height,child){const result=fit(T,g,seed,realm,height,child);if(!g.userData.citizen132&&!g.userData.anatomy144){g.traverse(o=>{if(!o.isMesh)return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m||m.transparent||m.userData.eye135||m.metalness>.25||m.roughness<.15)continue;if(Number.isFinite(m.roughness))m.roughness=Math.max(.72,m.roughness);if(Number.isFinite(m.envMapIntensity))m.envMapIntensity=Math.min(.5,m.envMapIntensity);}});g.userData.anatomy144={family:'authored humanoid',rig:'authored anatomy preserved',surface:'restrained nonmetal highlights'};}return result;};const old=root.L99Dinos141.finish;root.L99Dinos141.finish=function(T,g,mats,kind,seed){old(T,g,mats,kind,seed);native(T,g,mats,kind,Number.isFinite(g.userData.paletteSeed140)?g.userData.paletteSeed140:seed);return g;};}
const base=root.L99FaunaGenome131.create;root.L99FaunaGenome131.create=function(T){const kit=base(T);return{build(kind,seed){return animal(T,kit.build(kind,seed),seed);}};};
root.L99Anatomy144={dna,animal,native,skin,citizen,faunaRig,legacy,installNative};
})(window);

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
root.L99FaunaGenome131.create=function(T){const kit=original(T),surfaces=create(T);return{build(kind,seed){const k=kit.build(kind,seed),g=k.genome,coat=g.feathered?'feathers':g.wing?'membrane':g.beetle?'chitin':g.wader?'feathers':'fur';g.coat=coat;
 const bump=surfaces.texture(coat,seed);k.material.bumpMap=bump;k.material.bumpScale=coat==='fur'?.012:coat==='chitin'?.008:.004;k.material.roughness=coat==='membrane'?.62:coat==='chitin'?.42:.9;k.details=[];
 if(coat==='feathers'){const y=g.wing?0:g.leg+g.girth*.6,col=new T.Color().setHSL(g.hue,g.saturation,g.lightness),geometry=surfaces.fibers(seed,[0,y,0],[g.girth,g.girth,g.body],g.alpine?.04:g.hopper?.028:.02,coat==='feathers'?500:2200,col,false,coat==='feathers'),mat=k.material.clone();mat.bumpMap=null;mat.bumpScale=0;mat.roughness=.97;
  k.details.push({geometry,material:mat,position:[0,0,0],detail132:true});k.bounds.union(geometry.boundingBox);}
 const dispose=k.dispose;k.dispose=function(){dispose();bump.dispose();for(const d of k.details){d.geometry.dispose();d.material.dispose();}};return k;}};};
})(typeof window!=='undefined'?window:globalThis);

/* APPEARANCE_135: shared materials, bounded stature and organic surface refinements. */
(function(root){'use strict';
const oldFauna=root.L99FaunaGenome131.create;
root.L99FaunaGenome131.create=function(T){const old=oldFauna(T),materials=root.L99Materials133.create(T);return{build(kind,seed){const k=old.build(kind,seed),g=k.genome,size=root.L99Life133.animal(seed,kind);g.sizeClass=size.rarity;g.sizeFactor=size.factor;k.scale*=size.factor;g.scale=k.scale;
const coat=g.coat,name=coat==='fur'?(g.marking===0?'banded-fur':g.marking===1?'spotted-fur':'fur'):coat==='feathers'?(g.seed%3?'feathers':'teal-feathers'):coat==='chitin'?'scales':'leather';g.material133=name;const pigment=k.map.image.data;materials.apply(k.material,name);
// Keep each genome's macro pigmentation; generated imagery supplies coat detail.
const detail=k.material.map.image.data,tiles=coat==='feathers'?3:coat==='fur'?2:1,mix=new Uint8Array(detail.length);for(let i=0;i<mix.length;i+=4){const px=(i/4)%256,py=Math.floor(i/1024),di=(((py*tiles)%256)*256+(px*tiles)%256)*4,v=Math.round(255*(.55+.45*detail[di]/255)*(.35+.65*pigment[i]/255));mix[i]=mix[i+1]=mix[i+2]=v;mix[i+3]=255;}
const ownedMap=new T.DataTexture(mix,256,256,T.RGBAFormat);ownedMap.wrapS=ownedMap.wrapT=T.MirroredRepeatWrapping;ownedMap.minFilter=T.LinearMipmapLinearFilter;ownedMap.magFilter=T.LinearFilter;ownedMap.generateMipmaps=true;ownedMap.anisotropy=4;ownedMap.needsUpdate=true;k.material.map=k.map=ownedMap;
for(const d of k.details||[]){materials.apply(d.material,name);d.material.map=ownedMap;}
// Eyes, hooves, beaks and horns are never covered in coat pigment.
const horn=new T.Color().setHSL(.11,.16,.35),dark=new T.Color().setHSL(g.hue,.22,.13),eye=new T.Color().setHSL((g.hue+.42)%1,.75,.56),iris=new T.Color().setHSL(.09+(seed%7)*.015,.35,.16);
function mask(geo){const c=geo.attributes.color,weights=[];for(let i=0;i<c.count;i++){const near=v=>Math.abs(c.getX(i)-v.r)+Math.abs(c.getY(i)-v.g)+Math.abs(c.getZ(i)-v.b)<.00001;const isEye=near(eye);weights.push(near(horn)||near(dark)||isEye?0:1);if(isEye)c.setXYZ(i,iris.r,iris.g,iris.b);}geo.setAttribute('aCoat133',new T.Float32BufferAttribute(weights,1));}
for(const geo of [k.geometry,...k.attachments.map(a=>a.geometry),...(k.details||[]).map(a=>a.geometry)])mask(geo);
function coatShader(mat){mat.onBeforeCompile=function(s){s.vertexShader='attribute float aCoat133; varying float vCoat133;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCoat133=aCoat133;');s.fragmentShader='varying float vCoat133;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','vec4 uncoated133=diffuseColor;\n#include <map_fragment>\ndiffuseColor=mix(uncoated133,diffuseColor,vCoat133);');s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','vec3 uncoatedNormal133=normal;\n#include <normal_fragment_maps>\nnormal=normalize(mix(uncoatedNormal133,normal,vCoat133));');};mat.customProgramCacheKey=()=> 'coat-regions-133';}
coatShader(k.material);for(const d of k.details||[])coatShader(d.material);
const release=k.dispose;k.dispose=()=>{release();ownedMap.dispose();};
return k;}};};
})(window);

/* SOFTNESS_136: bounded, image-derived microrelief, not inferred true depth. */
(function(root){'use strict';const factories=new WeakMap();
function create(T){if(factories.has(T))return factories.get(T);const cache=new Map();
function bake(name){if(cache.has(name))return cache.get(name);const source=root.L99MaterialData133[name]||root.L99MaterialData133.fur,N=source.size,raw=Uint8Array.from(atob(source.data),c=>c.charCodeAt(0)),blur=new Float32Array(N*N),height=new Float32Array(N*N),normal=new Uint8Array(N*N*4),rough=new Uint8Array(N*N*4),depth=new Uint8Array(N*N*4);
// Remove broad pigment changes before deriving microrelief. Color is not measured depth.
for(let y=0;y<N;y++)for(let x=0;x<N;x++){let sum=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)sum+=raw[((y+dy+N)%N)*N+(x+dx+N)%N];blur[y*N+x]=sum/49;}
for(let i=0;i<height.length;i++)height[i]=Math.max(.2,Math.min(.8,.5+(raw[i]-blur[i])/255*.65));
const sample=(x,y)=>height[((y+N)%N)*N+(x+N)%N];
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const j=y*N+x,i=j*4,dx=(sample(x+1,y)-sample(x-1,y))*1.8,dy=(sample(x,y+1)-sample(x,y-1))*1.8,inv=1/Math.sqrt(1+dx*dx+dy*dy);normal[i]=Math.round((.5-dx*inv*.5)*255);normal[i+1]=Math.round((.5-dy*inv*.5)*255);normal[i+2]=Math.round((.5+inv*.5)*255);normal[i+3]=255;rough[i]=rough[i+1]=rough[i+2]=Math.round((.87+(1-height[j])*.1)*255);rough[i+3]=255;depth[i]=depth[i+1]=depth[i+2]=Math.round(height[j]*255);depth[i+3]=255;}
function tex(data){const tiled=new Uint8Array(data.length);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const a=(((y*2)%N)*N+(x*2)%N)*4;tiled.set(data.subarray(a,a+4),(y*N+x)*4);}data=tiled;const t=new T.DataTexture(data,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.MirroredRepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
const result={normalMap:tex(normal),roughnessMap:tex(rough),heightMap:tex(depth),size:N};cache.set(name,result);return result;}
const api={bake,state:()=>({entries:cache.size})};factories.set(T,api);return api;}
const prev=root.L99FaunaGenome131.create;root.L99FaunaGenome131.create=function(T){const factory=prev(T),kit=create(T);return{build(kind,seed){const k=factory.build(kind,seed),g=k.genome;if(g.coat==='fur'){const maps=kit.bake(g.material133),mat=k.material;mat.normalMap=maps.normalMap;mat.roughnessMap=maps.roughnessMap;mat.normalScale.set(.24,.24);mat.roughness=1;mat.userData.relief136='high-pass image microrelief';const before=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat);mat.onBeforeCompile=function(s){before.call(this,s);s.uniforms.uRelief136={value:maps.heightMap};s.vertexShader='varying vec2 vReliefUV203;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvReliefUV203=uv;');s.fragmentShader='uniform sampler2D uRelief136;varying vec2 vReliefUV203;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat cavity136=texture2D(uRelief136,vReliefUV203).r;diffuseColor.rgb*=mix(1.0,0.94+0.06*cavity136,vCoat133);');};mat.customProgramCacheKey=()=>key()+'-relief136';g.softness136={microrelief:true,geometricDisplacement:false};}return k;}};};root.L99Softness136={create};
})(window);

/* GROOM_136: area-weighted fur roots on actual skin, including articulated limbs. */
(function(root){'use strict';const previous=root.L99FaunaGenome131.create;
function originalGroom203(T,geo,seed,count,length,anatomy=null){const p=geo.attributes.position,n=geo.attributes.normal,u=geo.attributes.uv,c=geo.attributes.color,mask=geo.attributes.aCoat133,cumulative=[],triangles=[];let area=0;const a=new T.Vector3(),b=new T.Vector3(),d=new T.Vector3();
for(let i=0;i<p.count;i+=3){if(mask&&mask.getX(i)<.5)continue;a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);d.fromBufferAttribute(p,i+2);const ar=b.sub(a).cross(d.sub(a)).length()*.5;if(ar<1e-10)continue;area+=ar;cumulative.push(area);triangles.push(i);}
const pos=[],norm=[],uv=[],col=[],strand=[];if(!area)return new T.BufferGeometry();const r=root.L99FaunaGenome131.random(seed),comb=new T.Vector3(0,-.23,-1);
for(let j=0;j<count;j++){const target=(j+r())/count*area;let lo=0,hi=cumulative.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cumulative[m]<target)lo=m+1;else hi=m;}const i=triangles[lo],s=Math.sqrt(r()),w=[1-s,s*(1-r()),0];w[2]=1-w[0]-w[1];const point=new T.Vector3(),normal=new T.Vector3(),color=new T.Color(0,0,0);let tx=0,ty=0;
for(let k=0;k<3;k++){point.addScaledVector(a.fromBufferAttribute(p,i+k),w[k]);normal.addScaledVector(a.fromBufferAttribute(n,i+k),w[k]);tx+=u.getX(i+k)*w[k];ty+=u.getY(i+k)*w[k];color.r+=c.getX(i+k)*w[k];color.g+=c.getY(i+k)*w[k];color.b+=c.getZ(i+k)*w[k];}normal.normalize();point.addScaledVector(normal,.0006);
const flow=comb.clone().addScaledVector(normal,-comb.dot(normal)).normalize(),direction=normal.clone().multiplyScalar(.43).addScaledVector(flow,.95).normalize(),side=new T.Vector3().crossVectors(direction,normal);if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();let facial=1;if(anatomy&&anatomy.eyeLayout135){const h=anatomy.head,dy=(point.y-anatomy.eyeLayout135.y-h*.16)/(h*.4),dz=(point.z-anatomy.eyeLayout135.z-h*.48)/(h*.42),dx=(Math.abs(point.x)-h*.92)/(h*.6),distance=Math.sqrt(dx*dx+dy*dy+dz*dz);facial=.035+.965*Math.max(0,Math.min(1,(distance-.65)/.8));}const len=length*facial*(.6+r()*.7),width=len*(.045+r()*.025),tip=point.clone().addScaledVector(direction,len);tip.y-=len*.13;
const vertices=[point.clone().addScaledVector(side,-width),point.clone().addScaledVector(side,width),tip];for(let k=0;k<3;k++){pos.push(...vertices[k].toArray());norm.push(...normal.toArray());uv.push(tx,ty);strand.push(k===0?0:k===1?1:.5,k===2?1:0);const shade=k===2?1.02:.96;col.push(color.r*shade,color.g*shade,color.b*shade);}}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('aStrand136',new T.Float32BufferAttribute(strand,2));g.setAttribute('aCoat133',new T.Float32BufferAttribute(new Float32Array(pos.length/3).fill(1),1));g.computeBoundingBox();g.computeBoundingSphere();g.userData.groom135={roots:count,area};return g;}
function groom(T,geo,seed,count,length,anatomy=null){return root.L99Groom203.groom(T,geo,seed,count,length,anatomy);}
root.L99FaunaGenome131.create=function(T){const factory=previous(T);return{build(kind,seed){const k=factory.build(kind,seed),g=k.genome,coarse=!!(root.matchMedia&&root.matchMedia('(pointer: coarse)').matches),furry=g.coat==='fur'||(g.wing&&!g.feathered);
if(furry){const mat=k.material.clone();mat.normalMap=null;mat.roughnessMap=null;mat.roughness=.97;mat.onBeforeCompile=k.material.onBeforeCompile;mat.customProgramCacheKey=k.material.customProgramCacheKey;
// Fine strand cutouts soften the broad triangular silhouette without transparent sorting.
const previousShader=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey.bind(mat);mat.alphaTest=.10;mat.onBeforeCompile=function(s){previousShader.call(this,s);s.vertexShader='attribute vec2 aStrand136; varying vec2 vStrand136;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStrand136=aStrand136;');s.fragmentShader='varying vec2 vStrand136;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','float edge136=smoothstep(0.0,.16,vStrand136.x)*smoothstep(0.0,.16,1.0-vStrand136.x);float fiber136=.4+.6*pow(abs(sin(vStrand136.x*12.56637)),.6);diffuseColor.a*=edge136*fiber136*(1.0-smoothstep(.65,1.0,vStrand136.y));\n#include <alphatest_fragment>');};mat.customProgramCacheKey=()=>previousKey()+'-soft-strands136';const count=g.wing?(coarse?1600:2800):(coarse?7000:12000),length=g.wing?.009:g.alpine?.046:g.hopper?.032:.025,geo=groom(T,k.geometry,seed+135,count,length,g);k.details.push({geometry:geo,material:mat,position:[0,0,0],detail132:true,groom135:true});k.bounds.union(geo.boundingBox);
let roots=geo.userData.groom135.roots;const bodyRoots203=roots;const limbs=[];if(!g.wing)for(let i=0;i<k.attachments.length;i++){const a=k.attachments[i],n=coarse?800:1400,d=groom(T,a.geometry,seed+331+i,n,length*.65);a.detail135={geometry:d,material:mat};roots+=d.userData.groom135.roots;limbs.push(d);k.bounds.union(d.boundingBox.clone().translate(new T.Vector3(...a.position)));}g.groom135={roots,bodyRoots:bodyRoots203,limbRoots:roots-bodyRoots203,coverage:'surface-area stratified',coarse};
const release=k.dispose;k.dispose=()=>{release();for(const geo of limbs)geo.dispose();};}
return k;}};};root.L99Groom135={groom:originalGroom203};
})(window);

window.L99EyeData135={};

/* EYES_135: native iris textures, orbital rims and separate corneal surfaces. */
(function(root){'use strict';const factories=new WeakMap();
function create(T){if(factories.has(T))return factories.get(T);const maps=new Map();
function texture(name){if(maps.has(name))return maps.get(name);const raw=Uint8Array.from(atob(root.L99EyeData135[name]),c=>c.charCodeAt(0)),t=new T.DataTexture(raw,128,128,T.RGBAFormat);t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.encoding=T.sRGBEncoding;t.needsUpdate=true;maps.set(name,t);return t;}
function merge(list){const p=[],n=[],uv=[];for(const geo of list){const g=geo.index?geo.toNonIndexed():geo;for(const v of g.attributes.position.array)p.push(v);for(const v of g.attributes.normal.array)n.push(v);if(g.attributes.uv)for(const v of g.attributes.uv.array)uv.push(v);else for(let i=0;i<g.attributes.position.count;i++)uv.push(0,0);if(g!==geo)g.dispose();geo.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeBoundingBox();g.computeBoundingSphere();return g;}
function darkTexture(){if(maps.has('dark136'))return maps.get('dark136');const data=new Uint8Array(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const r=Math.hypot((x-127.5)/128,(y-127.5)/128),i=(y*256+x)*4,pupil=r<.74,grain=Math.sin(x*17+y*29)*1.5;data[i]=pupil?5:Math.round(27+grain);data[i+1]=pupil?6:Math.round(21+grain);data[i+2]=pupil?7:Math.round(14+grain);data[i+3]=255;}const t=new T.DataTexture(data,256,256,T.RGBAFormat);t.encoding=T.sRGBEncoding;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;maps.set('dark136',t);return t;}
function pair(layout,name,color,compound=false,darkPupil=false){const parts={iris:[],rim:[],cornea:[],socket:[]};
for(const e of layout){const radius=e.radius,center=new T.Vector3(...e.center),out=new T.Vector3(...e.normal).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),out),world=(g)=>{g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q));g.translate(...center.toArray());return g;};
const socket=new T.SphereGeometry(radius*1.18,20,14);socket.scale(1,.82,.45);socket.translate(0,0,-radius*.19);parts.socket.push(world(socket));
if(compound){const facets=new T.SphereGeometry(radius,16,10);facets.scale(1,.86,.5);parts.iris.push(world(facets));}
else{const p=[],uv=[],idx=[],segments=40,rings=8;for(let j=0;j<=rings;j++){const r=j/rings;for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r;p.push(x*radius,y*radius*.76,radius*(.15+.22*(1-r*r)));uv.push(.5+x*.425,.5+y*.425);if(j<rings&&i<segments){const n=j*(segments+1)+i;idx.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}}}const iris=new T.BufferGeometry();iris.setAttribute('position',new T.Float32BufferAttribute(p,3));iris.setAttribute('uv',new T.Float32BufferAttribute(uv,2));iris.setIndex(idx);iris.computeVertexNormals();parts.iris.push(world(iris));const cornea=new T.SphereGeometry(radius*1.01,28,18,0,Math.PI*2,0,Math.PI);cornea.scale(1,.76,.26);cornea.translate(0,0,radius*.18);parts.cornea.push(world(cornea));}
const points=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;points.push(new T.Vector3(Math.cos(a)*radius*1.13,Math.sin(a)*radius*.83,radius*.08));}const rim=new T.TubeGeometry(new T.CatmullRomCurve3(points),48,radius*.09,6,false);parts.rim.push(world(rim));}
const materials={iris:new T.MeshPhysicalMaterial({color:compound?0x171b15:0xffffff,map:compound?null:darkPupil?darkTexture():texture(name),roughness:compound?.23:.42,clearcoat:1,clearcoatRoughness:.08,side:T.DoubleSide}),rim:new T.MeshStandardMaterial({color:color.clone().multiplyScalar(.48),roughness:.67}),socket:new T.MeshStandardMaterial({color:0x171510,roughness:.47}),cornea:new T.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.08,roughness:.035,clearcoat:1,clearcoatRoughness:.025,depthWrite:false})};
const features=[];for(const [name,list] of Object.entries(parts)){if(!list.length){materials[name].dispose();continue;}materials[name].userData.eye135=name;features.push({geometry:merge(list),material:materials[name],position:[0,0,0],eye135:name});}return features;}
const api={pair,texture,state:()=>({textures:maps.size})};factories.set(T,api);return api;}
const previous=root.L99FaunaGenome131.create;
root.L99FaunaGenome131.create=function(T){const factory=previous(T),eyes=create(T);return{build(kind,seed){const k=factory.build(kind,seed),g=k.genome,compound=g.beetle||(g.wing&&!g.bat&&!g.feathered),name=(g.wader||g.feathered)?(seed%2?'owl':'raven'):g.bat?'raven':g.hopper?(seed%2?'wolf':'raven'):(seed%2?'deer':'goat'),layout=[-1,1].map(side=>({center:[side*g.head*.92,g.eyeLayout135.y+g.head*.16,g.eyeLayout135.z+g.head*.48],normal:[side*.94,.02,.34],radius:g.head*(compound?.18:(g.hopper||g.bat)?.20:.16)}));k.features=eyes.pair(layout,name,new T.Color().setHSL(g.hue,g.saturation,g.lightness),compound,!!(g.hopper||g.bat));g.eyes135={type:compound?'compound':'iris',atlas:compound?null:(g.hopper||g.bat)?'dark136':name,recessed:true};for(const f of k.features)k.bounds.union(f.geometry.boundingBox);const release=k.dispose;k.dispose=()=>{release();for(const f of k.features){f.geometry.dispose();f.material.dispose();}};return k;}};};
root.L99Eyes135={create};
})(window);


(function(root){const prior=root.L99FaunaGenome131.create;root.L99FaunaGenome131.create=T=>{const kit=prior(T);return{build(kind,seed){return root.L99Groom203.finish(T,kit.build(kind,seed));}};};})(window);