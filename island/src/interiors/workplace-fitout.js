import * as THREE from 'three';
// Shared construction primitives keep each furnished floor to one draw per material.
// Dimensions are metres. The centre aisle and lift landing are never furniture zones.
export function fitWorkplace(T, L, B) {
 const { box, cyl, chair, plant, sign, M } = B;
 const accent = M.art[(Math.floor(L.seed * 4) + (T.region === 'Japan' ? 3 : 0)) % 4];
 const work=(role,group,side=0)=>({role,group:T.key+':'+L.n+':'+group,side,floor:L.n,program:L.program});
 const stats = { desks: 0, meetingSeats: 0, stores: 0, zones: L.zones.map(z => z.type) };
 const legs = (x, z, w, d, h) => { for (const sx of [-1,1]) for (const sz of [-1,1]) cyl(M.steel,x+sx*(w/2-.1),0,z+sz*(d/2-.1),.025,h,8); };
 const desk = (x,z,privateDesk=false) => {
  const w=privateDesk?1.7:1.4;
  box(M.desk,x-w/2,.72,z-.36,x+w/2,.77,z+.36,true); legs(x,z,w,.72,.72);
  box(M.dark,x-.33,.82,z-.28,x+.33,1.24,z-.22);
  box(M.screen,x-.30,.85,z-.215,x+.30,1.21,z-.20);
  cyl(M.steel,x,.77,z-.25,.028,.08,8);
  box(M.dark,x-.23,.77,z+.03,x+.23,.79,z+.18);
  box(M.dark,x+.33,.77,z+.03,x+.44,.795,z+.17);
  box(accent,x-.6,.77,z+.02,x-.42,.8,z+.28);
  cyl(M.bed,x+.55,.77,z-.1,.04,.1,10);
  chair(x,z+.86,0); B.seats.at(-1)[5]=work('office worker','desk:'+x+':'+z);stats.desks++;
 };
 const sofa=(x,z,w=2)=>{box(M.sofa,x-w/2,.1,z-.38,x+w/2,.46,z+.38,true);box(M.sofa,x-w/2,.46,z+.25,x+w/2,.88,z+.4);for(const s of [-1,1])box(M.sofa,x+s*w/2-.08,.35,z-.38,x+s*w/2+.08,.65,z+.38);B.seats.push([x,z,0,true,.48]);};
 const room=(r,label,opaque=false)=>{
  const wall=opaque?M.wall:M.glass, y=Math.min(L.h-.35,2.8), mid=(r.x0+r.x1)/2;
  box(wall,r.x0,0,r.z0,r.x1,y,r.z0+.07,true);
  for(const x of [r.x0,r.x1]){box(wall,x-.04,0,r.z0,x+.04,y,r.z1,true);box(M.mull,x-.055,0,r.z0,x+.055,y,r.z0+.1);}
  for(const [a,b] of [[r.x0,mid-.65],[mid+.65,r.x1]])box(wall,a,0,r.z1-.04,b,y,r.z1+.04,true);
  box(M.mull,r.x0,y-.06,r.z1-.05,r.x1,y+.02,r.z1+.05);
  sign(label,mid,2.45,r.z1+.06,Math.min(2.3,r.x1-r.x0-.3),.3);
  // Frosted privacy strip remains visible even against a bright exterior.
  if(!opaque)for(const [a,b]of [[r.x0,mid-.65],[mid+.65,r.x1]])box(M.wall,a,1.1,r.z1-.046,b,1.19,r.z1+.046);
 };
 sign(`${L.n === 0 ? 'G' : L.n}  /  ${L.program}`,0,2.9,T.coreZ+.065,Math.min(T.coreW-1,7),.46);
 sign(`${T.region}  /  LIFTS`,0,2.58,T.coreZ+.067,3.2,.22);
 if(L.kind==='office') {
  // Carpet borders and continuous ceiling strips articulate the circulation spine.
  box(accent,-.035,.002,T.coreZ+2,.035,.008,T.hd-.8);
  box(M.panel,-.045,L.h-.31,T.coreZ+2,.045,L.h-.27,T.hd-.8);
  for(const r of L.zones){
   const w=r.x1-r.x0,d=r.z1-r.z0,cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2;
   box(r.type==='pantry'||r.type==='restroom'?M.stone:M.carpet,r.x0,.002,r.z0,r.x1,.01,r.z1);
   if(r.type==='work'){
    const pitch=T.profile.deskPitch;
    for(let z=r.z0+.9;z<r.z1-1.2;z+=3.1)for(let x=r.x0+1;x<r.x1-.8;x+=pitch)desk(x,z);
    sign(L.program,cx,2.35,r.z0+.08,Math.min(3,w-.5),.32);
    for(const x of [r.x0+.45,r.x1-.45])plant(x,r.z0+.45);
    if(T.profile.baffles)for(let x=r.x0+.3;x<r.x1;x+=.6)box(M.oak,x,L.h-.46,r.z0+.3,x+.06,L.h-.28,Math.min(r.z1-.3,r.z0+2));
    if(L.program==='Engineering'||L.program==='Product studio'){
     box(M.wall,r.x0+.4,1.3,r.z0+.08,r.x1-.4,2.3,r.z0+.12);
     for(let x=r.x0+.6;x<r.x1-.6;x+=.6)box(accent,x,1.55,r.z0+.13,x+.22,1.8,r.z0+.15);
    }
   }else if(r.type==='meeting'){
    room(r,'Meeting / '+String(L.n).padStart(2,'0'));
    const tw=Math.min(w-2,5),td=Math.min(d-2.1,1.65);
    if(tw>.8&&td>.5){box(M.oak,cx-tw/2,.73,cz-td/2,cx+tw/2,.79,cz+td/2,true);legs(cx,cz,tw,td,.73);for(let x=cx-tw/2+.45;x<cx+tw/2;x+=.85){chair(x,cz-td/2-.5,Math.PI);B.seats.at(-1)[5]=work('meeting colleague','meeting:'+cx+':'+cz,0);chair(x,cz+td/2+.5,0);B.seats.at(-1)[5]=work('meeting colleague','meeting:'+cx+':'+cz,1);stats.meetingSeats+=2;}}
    box(M.dark,cx-1.1,1.2,r.z0+.08,cx+1.1,2.45,r.z0+.15);
    box(M.screen,cx-1.04,1.26,r.z0+.15,cx+1.04,2.39,r.z0+.17);
    sign('PROJECT REVIEW',cx,1.8,r.z0+.18,1.7,.24);
   }else if(r.type==='focus'||r.type==='private'){
    const n=Math.max(1,Math.floor(w/3.5));
    for(let j=0;j<n;j++){
     const q={x0:r.x0+j*w/n+.08,x1:r.x0+(j+1)*w/n-.08,z0:r.z0,z1:r.z1};room(q,r.type==='focus'?'Focus room':'Private office');
     if(d>3)desk((q.x0+q.x1)/2,r.z0+1.1,true);
     box(M.oak,q.x0+.2,0,r.z0+.15,q.x1-.2,.65,r.z0+.55,true);
    }
   }else if(r.type==='pantry'){
    room(r,T.region==='Japan'?'Tea pantry / Print':'Pantry / Print',false);
    B.seats.push([cx,r.z0+1.5,0,false,0,{...work('refreshment','pantry:'+cx+':'+cz),routineOnly:true}]);
    box(M.wall,r.x0+.2,0,r.z0+.2,r.x1-.2,.91,r.z0+.9,true);
    box(M.stoneD,r.x0+.18,.91,r.z0+.18,r.x1-.18,.96,r.z0+.93);
    box(M.dark,r.x0+.4,.96,r.z0+.35,r.x0+.9,1.4,r.z0+.75);
    box(M.steel,r.x1-1,.96,r.z0+.25,r.x1-.35,.98,r.z0+.78);
    cyl(M.steel,r.x1-.6,.98,r.z0+.3,.024,.3,8);
    box(M.bed,r.x0+.2,1.55,r.z0+.2,r.x1-.2,2.2,r.z0+.5,true);
    if(d>3){box(M.dark,r.x0+.25,0,r.z1-1.1,r.x0+1.15,.85,r.z1-.3,true);box(M.bed,r.x0+.3,.85,r.z1-1.02,r.x0+1.1,1.0,r.z1-.4);}
   }else if(r.type==='restroom'){
    room(r,'RESTROOMS',true);
    for(let x=r.x0+.9;x<r.x1-.7;x+=1.4){box(M.wall,x-.62,0,r.z0+.1,x-.55,2.15,r.z0+1.9,true);cyl(M.bed,x,.14,r.z0+.65,.26,.27,16);box(M.bed,x-.28,.2,r.z0+.1,x+.28,.78,r.z0+.35);box(M.oak,x-.52,0,r.z0+1.85,x-.06,2.08,r.z0+1.92,true);}
   }else if(r.type==='lounge'){
    for(let x=r.x0+1.3;x<r.x1-1;x+=3.2){sofa(x,cz);box(M.oak,x-.6,0,cz-1.25,x+.6,.38,cz-.7,true);}
    sign('SKY COMMONS',cx,2.35,r.z0+.1,Math.min(w-1,3.5),.35);plant(r.x0+.5,r.z1-.6);
   }
  }
 }else if(L.kind==='mall'){
  const a=T.atrium, front=T.hd-.8, back=T.coreZ+3.4;
  // Shop units occupy the perimeter; the open central promenade serves every entrance.
  for(const side of [-1,1]){
   const x0=side<0?-T.hw+.8:a.x1+4.2,x1=side<0?a.x0-4.2:T.hw-.8;
   const count=Math.max(1,Math.floor((front-back)/8.5)),depth=(front-back)/count;
   for(let j=0;j<count;j++){
    const z0=back+j*depth+.12,z1=z0+depth-.24,cx=(x0+x1)/2,cz=(z0+z1)/2;
    if(x1-x0<2.5)continue;
    const name=L.program==='Food court'?['Noodle kitchen','Bakery & coffee','Market grill','Tea counter'][j%4]:['FORM / home','PAPER / books','SIGNAL / tech','THREAD / apparel'][(j+Math.floor(L.seed*4))%4];
    stats.stores++;
    const group='shop:'+side+':'+j;
    B.seats.push([side<0?x1-.95:x0+.95,cz-1,side<0?-Math.PI/2:Math.PI/2,false,0,{...work('stock check',group),routineOnly:true}]);
    B.seats.push([side<0?x1-2:x0+2,cz-1,side<0?Math.PI/2:-Math.PI/2,false,0,{...work('browse',group),routineOnly:true}]);
    // Cashier and customer face each other at a counter beside the entrance.
    const counterX=side<0?x1:x0;
    B.seats.push([counterX+side*.9,cz+.9,side<0?-Math.PI/2:Math.PI/2,false,0,work('vendor',group)]);
    B.seats.push([counterX-side*1.2,cz+.9,side<0?Math.PI/2:-Math.PI/2,false,0,work('shopper',group)]);
    box(M.oak,x0,.005,z0,x1,.025,z1);
    box(M.wall,x0,0,z0,x1,Math.min(3.1,L.h-.4),z0+.1,true);
    const edge=side<0?x1:x0;
    for(const [za,zb]of [[z0,cz-2],[cz+2,z1]])box(M.glass,edge-.04,0,za,edge+.04,2.6,zb,true);
    box(M.oak,edge-.26,0,cz+.3,edge+.26,.94,cz+1.5,true);
    box(M.stone,edge-.29,.94,cz+.27,edge+.29,1.0,cz+1.53);
    box(M.dark,edge-.16,1.0,cz+.8,edge+.16,1.07,cz+1.1);
    box(M.screen,edge-.025,1.09,cz+.8,edge+.025,1.29,cz+1.1);
    box(accent,edge-.12,2.65,z0,edge+.12,3.1,z1);
    sign(name,edge-side*.13,2.87,cz,Math.min(4.4,depth-1),.38,side<0?Math.PI/2:-Math.PI/2);
    if(L.program==='Food court'){
     box(M.stone,cx-.6,0,z0+1,cx+.6,1.02,z1-1,true);
     for(let z=z0+1.5;z<z1-1;z+=1.25){cyl(M.steel,cx,1.03,z,.23,.05,16);box(M.dark,cx-.35,1.03,z-.3,cx+.35,1.6,z+.02);}
    }else{
     for(let z=z0+1.3;z<z1-.8;z+=2.8){box(M.desk,cx-.6,0,z-.4,cx+.6,.8,z+.4,true);for(let k=0;k<4;k++){const m=M.art[(j+k)%4];box(m,cx-.5+k*.26,.8,z-.22,cx-.3+k*.26,1+(.12*k% .3),z+.22);}}
     box(M.oak,side<0?x0+.2:x1-.8,0,z0+.4,side<0?x0+.8:x1-.2,2.2,z1-.4,true);
    }
   }
   // Promenade seating stays outside the atrium guards and clear of shop entrances.
   const x=side*(a.x1+2.1);
   for(let z=a.z0+1.7;z<a.z1;z+=4.5){if(L.program==='Food court'){cyl(M.desk,x, .72,z,.55,.06,20);cyl(M.steel,x,0,z,.05,.72);chair(x,z+.95,0);chair(x,z-.95,Math.PI);}else{plant(x,z);}}
  }
  if(L.n===0){
   for(const x of [-5,5]){box(M.stoneD,x-.7,0,-1.2,x+.7,.35,1.2,true);plant(x,0);}
   sign('CENTRAL GALLERIA',0,2.8,T.hd-.12,5.5,.55,Math.PI);
  }
  if(L.holes.length){
   for(const x of [a.x0,a.x1]){box(M.glass,x-.04,0,a.z0,x+.04,1.14,a.z1,true);box(M.steel,x-.055,1.14,a.z0,x+.055,1.19,a.z1);}
   for(const z of [a.z0,a.z1])for(const [x0,x1]of [[a.x0,-2.55],[2.55,a.x1]]){box(M.glass,x0,0,z-.04,x1,1.14,z+.04,true);box(M.steel,x0,1.14,z-.055,x1,1.19,z+.055);}
  }
  // Paired walkable escalator treads link the galleries through the atrium.
  // Their collision heights use the identical 32-step profile in floorAt().
  if(L.n<T.levels.length-2)for(const side of [-1,1]){
   const x0=side<0?-2.2:.4,x1=side<0?-.4:2.2,len=a.z1-a.z0;
   for(let i=0;i<32;i++){const z0=a.z0+i*len/32,y=(side<0?i+1:32-i)*L.h/32;box(M.steel,x0,y-.15,z0,x1,y,z0+len/32);box(M.dark,x0,y+.002,z0,x1,y+.012,z0+.035);}
   const angle=Math.atan2((side<0?1:-1)*L.h,len);
   B.add(M.steel,new THREE.BoxGeometry(x1-x0,.38,Math.hypot(len,L.h)).rotateX(-angle).translate((x0+x1)/2,L.h/2-.22,(a.z0+a.z1)/2));
   for(const x of [x0-.08,x1+.08]){
    B.add(M.glass,new THREE.BoxGeometry(.06,.82,Math.hypot(len,L.h)).rotateX(-angle).translate(x,L.h/2+.57,(a.z0+a.z1)/2));
    B.add(M.dark,new THREE.BoxGeometry(.1,.09,Math.hypot(len,L.h)).rotateX(-angle).translate(x,L.h/2+1,(a.z0+a.z1)/2));
   }
  }
 }
 return stats;
}
