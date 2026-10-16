// Deterministic campaigns anchored to real businesses and usable commercial surfaces.
import { brandIdentity, brandCategory } from './brand-catalog.js';
import { hash32, hash01 } from './rand.js';
import { LAYER } from './layers.js';
const WORDS={mobile:['Stay in touch.','Phones & repairs'],network:['A little closer.','Connections for everyday life'],coffee:['Make time for a cup.','Coffee, made yours'],tea:['Take a quiet moment.','Leaf by leaf'],dairy:['Good mornings start here.','Everyday dairy'],bakery:['Follow the good smell.','Bread & baked goods'],grains:['Start with something good.','Breakfast essentials'],pantry:['Something good for dinner.','Everyday provisions'],pasta:['Gather around the table.','Pasta & pantry'],produce:['A little closer to the field.','Fruit & vegetables'],snacks:['Bring a little crunch.','Snacks to share'],beverages:['Take the scenic sip.','Drinks & refreshments'],cleaning:['A fresh start.','Care for your home'],care:['A little care goes far.','Everyday essentials'],home:['Make room for living.','Goods for your home'],hardware:['Keep good things going.','Tools & repairs'],outdoor:['Take the long way.','Made for outside'],apparel:['Wear your own way.','Clothing & cloth'],books:['Stay for another page.','Books & paper'],music:['Find your sound.','Music & instruments'],transport:['Good things on the way.','Transport & delivery'],retro:['Your everyday corner.','Neighborhood goods'],guild:['Made by hand. Kept for years.','Find us at the market'],fae:['Small wonders, close at hand.','Herbs & crafted wares'],orbital:['Make yourself at home out here.','Habitat supplies']};
export function campaignFace(category,seed,format='poster',name='') {
 const b=brandIdentity(category,seed);if(!b)return null;
 return {k:'campaign',...b,category,format,name,headline:WORDS[category][0],label:WORDS[category][1],variant:hash32(category,seed,'layout')%4};
}
export function shopCampaigns(biz,front,{phone=false}={}) {
 const category=brandCategory(biz.type), out=[],posts=[];
 if(!category || /office|tower|apt|home|residen/.test(biz.use||'') || (front.run||0)<5)return {signs:out,posts};
 const seed=biz.id||biz.name||`${biz.x}:${biz.z}`, nx=front.nx,nz=front.nz,tx=nz,tz=-nx,half=front.run/2,side=(front.door||0)>0?-1:1;
 const put=(along,forward,hy,w,h,format,mat='paper',wear=.1)=>{const face=campaignFace(category,seed,format,biz.name);const q={mat,layer:LAYER.poster,face,x:front.x+tx*along+nx*forward,z:front.z+tz*along+nz*forward,hy,nx,nz,w,h,back:3,wear,base:front.g};out.push(q);return q;};
 // One small window poster away from the door and the existing corner banner.
 if(front.run>=7)put(-side*(half-1.2),.025,1.7,.65,.9,'poster','paper',.12+hash01(seed,'age')*.3);
 // Sparse, worn leaflets lie on the sidewalk, not at eye height or in the road.
 const n=phone?1:1+hash32(seed,'paper')%3;
 for(let i=0;i<n;i++){const q=put(side*(half-1.5)-i*.38,.65+hash01(seed,i)*.65,.03,.2,.28,'pamphlet','paper',.25+hash01(seed,i,'wear')*.4);q.ny=1;}
 // A raised flag at the facade edge, with its pole; always above pedestrian heads.
 if(hash01(seed,'flag')<.48 && (front.height??3.5)>=3.3){const q=put(side*(half-.65),.15,3.05,1.15,.65,'flag','cloth',.07);q.back=1;posts.push({x:q.x-tx*.575,z:q.z-tz*.575,h:3.5,kind:'post'});}
 // A wide wall-mounted billboard above the door only when the facade can contain it.
 if(front.run>=9 && (front.height||0)>=5.5 && hash01(seed,'billboard')<.45){put(0,.045,front.height-1.4,Math.min(6,front.run-1.5),1.9,'billboard','vinyl',.08);}
 return {signs:out,posts};
}
// Blank industrial/commercial sides, never windows, homes, civic buildings or road signs.
export function wallCampaign(surface,seed=0){
 if(surface.civic || surface.storefront || !['industrial','side'].includes(surface.kind) || surface.w<6 || surface.h<5)return null;
 if(hash01(surface.x,surface.z,seed,'mural')>.34)return null;
 const categories=['mobile','network','coffee','beverages','apparel','hardware','transport','home'];
 const category=surface.category||categories[hash32(surface.x,surface.z,seed)%categories.length];
 const height=surface.h-.5, width=Math.min(surface.w-.8,height*.7,12);
 return {mat:'paint',layer:LAYER.poster,face:campaignFace(category,Math.floor(surface.x/250)+':'+Math.floor(surface.z/250),'mural'),x:surface.x,z:surface.z,hy:.25+height/2,nx:surface.nx,nz:surface.nz,w:width,h:height,base:surface.y??null,back:3,wear:.12+hash01(surface.x,surface.z,'faded')*.25};
}
