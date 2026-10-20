/* ECOLOGY_BUILD_126 */
/* ECOLOGY_126: deterministic geography shared by workshop, caves and flight. */
(function(root){'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
function hash(x,z,seed){let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
function noise(x,z,seed,size){let a=Math.floor(x/size),b=Math.floor(z/size),u=x/size-a,v=z/size-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(a,b,seed)*(1-u)+hash(a+1,b,seed)*u)*(1-v)+(hash(a,b+1,seed)*(1-u)+hash(a+1,b+1,seed)*u)*v;}
let settings={latitude:38,rainfall:.55};
function configure(value){if(value&&Number.isFinite(value.latitude))settings.latitude=clamp(value.latitude,-80,80);if(value&&Number.isFinite(value.rainfall))settings.rainfall=clamp(value.rainfall);return {...settings};}
function sample(x,z,options={}){let seed=options.seed|0,elevation=clamp(options.elevation||0,-100,6000),slope=clamp(options.slope||0),shade=clamp(options.shade||0),depth=clamp(options.depth||0,0,2000);let latitude=Number.isFinite(options.latitude)?clamp(options.latitude,-80,80):settings.latitude;
const rain=Number.isFinite(options.rainfall)?clamp(options.rainfall):settings.rainfall;
const moisture=clamp(rain*.55+noise(x,z,seed+41,480)*.5+(Number.isFinite(options.wetness)?clamp(options.wetness)*.22:0)+shade*.1-slope*.2);
const temperature=clamp(1-Math.abs(latitude)/100-elevation/2400+(noise(x,z,seed+93,1300)-.5)*.35);
let region,species;
if(options.cave){region=depth>8?'deep cave':'cave mouth';species=depth>8?(moisture>.5?['fungus','glowmoss']:['glowmoss']):['fern','fungus','glowmoss'];}
else if(elevation<0){region='submerged';species=[];}
else if(temperature<.28){region='alpine';species=['grass','shrub'];}
else if(moisture>.64){region='wetland';species=elevation<45?['reed','fern','grass']:['fern','shrub','fungus'];}
else if(moisture<.39){region='dry scrub';species=['succulent','grass','shrub'];}
else if(temperature>.68){region='warm woodland';species=['shrub','fern','grass'];}
else{region='temperate woodland';species=['fern','grass','shrub'];}
return {region,temperature,moisture,species,cover:clamp((.35+moisture*.55)*(1-slope*.75)),hue:temperature<.28?.23:.19+moisture*.08};}
function choose(field,x,z,seed){return field.species[Math.floor(hash(Math.floor(x*3),Math.floor(z*3),seed)*field.species.length)]||null;}
function flightPalette(field,available){let map={fern:'fern',reed:'reed',grass:'tuft',shrub:'bush',succulent:'ice_plant',fungus:'mushroom',glowmoss:'nebula_moss'};return field.species.map(s=>map[s]).filter(n=>available.includes(n));}
const api={sample,choose,configure,flightPalette,noise,hash};if(typeof module!=='undefined')module.exports=api;else root.L99Ecology=api;
})(typeof window!=='undefined'?window:globalThis);

/* FOLIAGE_126: seven bounded, shared botanical silhouettes; no animation loop. */
(function(root){'use strict';
function create(THREE){const cache={};
function geometry(kind){if(cache[kind])return cache[kind];const p=[],c=[];const colors={fern:[.18,.39,.16],reed:[.42,.49,.2],grass:[.4,.48,.2],shrub:[.23,.36,.16],succulent:[.32,.49,.38],fungus:[.37,.55,.54],glowmoss:[.15,.48,.42]};const col=colors[kind]||colors.grass;
function tri(a,b,d,tone=1){p.push(...a,...b,...d);for(let i=0;i<3;i++)c.push(...col.map(x=>x*tone));}
function blade(a,b,width,angle,tone){const mx=(a[0]+b[0])*.5,mz=(a[2]+b[2])*.5,my=(a[1]+b[1])*.5,dx=Math.cos(angle)*width,dz=Math.sin(angle)*width;tri(a,[mx+dx,my+.02,mz+dz],b,tone);tri(a,b,[mx-dx,my+.02,mz-dz],tone*.9);}
if(kind==='fern'){for(let f=0;f<7;f++){let a=f*Math.PI*2/7;for(let i=1;i<8;i++){let t=i/8,base=[Math.cos(a)*t*.62,Math.sin(t*Math.PI)*.4+.08,Math.sin(a)*t*.62];for(let side of [-1,1]){let q=a+side*.8,w=(1-t)*.33;blade(base,[base[0]+Math.cos(q)*w,base[1]-.02,base[2]+Math.sin(q)*w],.035,q+1.57,.85+i*.025);}}}}
else if(kind==='fungus'){for(let j=0;j<4;j++){const x=Math.sin(j*2.4)*.25,z=Math.cos(j*2.4)*.25,h=.25+j*.1,r=.15+j*.025;blade([x,0,z],[x,h,z],.035,0,.6);for(let i=0;i<10;i++){let a=i*Math.PI/5,b=(i+1)*Math.PI/5;tri([x,h+.1,z],[x+Math.cos(a)*r,h,z+Math.sin(a)*r],[x+Math.cos(b)*r,h,z+Math.sin(b)*r],.9+j*.06);}}}
else{let n=kind==='shrub'?30:kind==='glowmoss'?18:12;for(let i=0;i<n;i++){let a=i*2.39996,t=(i%7)/7,x=Math.cos(a)*t*.35,z=Math.sin(a)*t*.35,h=kind==='reed'?1.1+t*.55:kind==='succulent'?.15+t*.23:kind==='glowmoss'?.06+t*.12:kind==='shrub'?.3+t*.65:.25+t*.45,w=kind==='succulent'?.1:kind==='shrub'?.13:.025;blade([x,0,z],[x+Math.cos(a)*.2,h,z+Math.sin(a)*.2],w,a+1.57,.8+t*.3);if(kind==='reed')blade([x,h*.8,z],[x,h,z],.045,a,.6);}}
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingSphere();cache[kind]=g;return g;}
return {geometry,dispose(){for(const k in cache)cache[k].dispose();}};
}
if(typeof module!=='undefined')module.exports={create};else root.L99Foliage={create};
})(typeof window!=='undefined'?window:globalThis);
