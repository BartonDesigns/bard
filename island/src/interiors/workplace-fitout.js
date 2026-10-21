import * as THREE from 'three';
import { screenTile, TILE } from './screen-atlas.js';
// Shared construction primitives keep each furnished floor to one draw per material.
// Dimensions are metres. The centre aisle and lift landing are never furniture zones.
// An office floor is mostly not desks: a few pods of four by the windows, then what its
// trade needs (a hardware lab, a makers' studio, a market wall, a café, a foyer, a library),
// meeting rooms, and a lounge with a coffee point. The coffee, the vending machine, the
// water and the first-aid box are yours to use too (B.perk: interiors/office-perks.js).
export function fitWorkplace(T, L, B) {
 const { box, cyl, chair, plant, sign, M } = B;
 const screen = B.screen || (() => {}), solid = B.solid || (() => {}), perk = B.perk || (() => {});
 // (an office floor carries its company's colour: towers.js dressed)
 const accent = M.brand || M.art[(Math.floor(L.seed * 4) + (T.region === 'Japan' ? 3 : 0)) % 4];
 const work=(role,group,side=0)=>({role,group:T.key+':'+L.n+':'+group,side,floor:L.n,program:L.program});
 const stats = { desks: 0, meetingSeats: 0, stores: 0, amenities: 0, zones: L.zones.map(z => z.type) };
 const legs = (x, z, w, d, h) => { for (const sx of [-1,1]) for (const sz of [-1,1]) cyl(M.steel,x+sx*(w/2-.1),0,z+sz*(d/2-.1),.025,h,8); };
 // (a box from any two corners; f flips a thing to face the other way along z)
 const bb=(m,x0,y0,z0,x1,y1,z1,s=false)=>box(m,Math.min(x0,x1),y0,Math.min(z0,z1),Math.max(x0,x1),y1,Math.max(z0,z1),s);
 const H=(a,b)=>{const s=Math.sin(a*127.1+b*311.7+L.seed*91.3)*43758.5453;return s-Math.floor(s);};
 const yawOf=f=>f>0?0:Math.PI;
 const stand=(x,z,yaw,role,group)=>B.seats.push([x,z,yaw,false,0,{...work(role,group),routineOnly:true}]);
 // a workstation: its screen on the far side, the sitter at the keyboard on the near (+f) side
 // (the desk blocks you only to its front edge, so the one sitting at it is clear to walk off)
 const desk = (x,z,f=1,privateDesk=false) => {
  const w=privateDesk?1.7:1.4, Z=d=>z+f*d;
  box(M.desk,x-w/2,.72,z-.36,x+w/2,.77,z+.36); solid(x-w/2,Z(-.36),x+w/2,Z(.26),0,.77); legs(x,z,w,.72,.72);
  bb(M.dark,x-.33,.82,Z(-.28),x+.33,1.24,Z(-.22));
  screen(x,1.03,Z(-.218),.6,.36,screenTile(L.program,x,z,L.seed),yawOf(f));
  cyl(M.steel,x,.77,Z(-.25),.028,.08,8);
  bb(M.dark,x-.23,.77,Z(.03),x+.23,.79,Z(.18));
  bb(M.dark,x+f*.33,.77,Z(.03),x+f*.44,.795,Z(.17));
  bb(accent,x-f*.6,.77,Z(.02),x-f*.42,.8,Z(.28));
  cyl(M.bed,x+f*.55,.77,Z(-.1),.04,.1,10);
  if(H(x,z)<.35){cyl(M.pot,x-f*.55,.77,Z(-.22),.06,.1,10);B.add(M.green,new THREE.SphereGeometry(.1,8,6).translate(x-f*.55,.92,Z(-.22)));}
  chair(x,Z(.62),yawOf(f)); B.seats.at(-1)[5]=work('office worker','desk:'+x+':'+z);stats.desks++;
 };
 // four desks back to back, a screen between them
 const pod=(cx,cz)=>{for(const dx of [-.72,.72]){desk(cx+dx,cz+.36,1);desk(cx+dx,cz-.36,-1);}bb(accent,cx-1.42,.77,cz-.02,cx+1.42,1.22,cz+.02);};
 // seats with their backs to +f, the sitters facing -f
 const sofa=(x,z,w=2,f=1,m=M.sofa)=>{bb(m,x-w/2,.1,z-.38,x+w/2,.46,z+.38,true);bb(m,x-w/2,.46,z+f*.25,x+w/2,.88,z+f*.4);for(const s of [-1,1])bb(m,x+s*w/2-.08,.35,z-.38,x+s*w/2+.08,.65,z+.38);for(const s of w>1.7?[-1,1]:[0])B.seats.push([x+s*w/4,z,yawOf(f),true,.48]);};
 const armchair=(x,z,f=1,m=M.sofa2)=>{bb(m,x-.42,.1,z-.4,x+.42,.44,z+.4,true);bb(m,x-.42,.44,z+f*.26,x+.42,.85,z+f*.4);for(const s of [-1,1])bb(m,x+s*.42-.07,.3,z-.4,x+s*.42+.07,.62,z+.4);B.seats.push([x,z,yawOf(f),true,.46]);};
 const table=(x,z,w,d,h=.74,m=M.oak)=>{box(m,x-w/2,h-.05,z-d/2,x+w/2,h,z+d/2,true);legs(x,z,w,d,h-.05);};
 const rug=(x0,z0,x1,z1)=>box(M.rug,x0,.011,z0,x1,.022,z1);
 // a screen on its stand, facing f
 const tv=(x,z,w,f,tile)=>{const h=w*.5625;bb(M.dark,x-w/2-.04,.95,z,x+w/2+.04,.95+h+.08,z+f*.06);screen(x,.99+h/2,z+f*.062,w,h,tile,yawOf(f));bb(M.dark,x-.04,0,z-f*.05,x+.04,.95,z);bb(M.dark,x-.35,0,z-.25,x+.35,.04,z+.25,true);};
 const bookcase=(x,z,f,w=1)=>{bb(M.oak,x-w/2,0,z,x+w/2,2.0,z+f*.36,true);for(let y=.3;y<1.9;y+=.38){bb(M.dark,x-w/2+.04,y,z+f*.02,x+w/2-.04,y+.02,z+f*.34);let bx=x-w/2+.06;while(bx<x+w/2-.2){const bw=.12+H(bx,y)*.3;bb(M.art[Math.floor(H(y,bx)*4)],bx,y+.02,z+f*.05,Math.min(bx+bw,x+w/2-.06),y+.22+H(bx*3,y)*.08,z+f*.3);bx+=bw+.03;}}};
 const shelves=(cx,z,f,w)=>{const n=Math.min(6,Math.floor((w-1)/1.05));for(let i=0;i<n;i++)bookcase(cx+(i-(n-1)/2)*1.05,z,f);};
 const whiteboard=(x,z,w,f)=>{bb(M.steel,x-w/2-.03,.85,z,x+w/2+.03,2.05,z+f*.04);bb(M.bed,x-w/2,.88,z+f*.04,x+w/2,2.02,z+f*.045);for(let i=0;i<5;i++)bb(i%2?accent:M.dark,x-w/2+.2+i*w*.17,1.3+H(i,x)*.5,z+f*.046,x-w/2+.2+i*w*.17+.3,1.315+H(i,x)*.5,z+f*.05);for(const s of [-1,1]){bb(M.steel,x+s*w/2-.02,0,z-.02,x+s*w/2+.02,.85,z+.02);bb(M.steel,x+s*w/2-.03,0,z-.3,x+s*w/2+.03,.03,z+.3);}};
 // the things you can use: a wall unit behind (z, the face toward f)
 const coffeeMachine=(x,z,f,y=.94)=>{bb(M.dark,x-.2,y,z+f*.06,x+.2,y+.46,z+f*.44);bb(M.steel,x-.17,y+.16,z+f*.44,x+.17,y+.4,z+f*.46);bb(M.glow,x-.06,y+.34,z+f*.461,x+.06,y+.37,z+f*.47);cyl(M.bed,x,y+.01,z+f*.3,.04,.09,10);perk('coffee',x,z+f*.95,1.1);stats.amenities++;};
 const fridge=(x,z,f)=>{bb(M.steel,x-.37,0,z,x+.37,1.85,z+f*.7,true);bb(M.dark,x+.26,.9,z+f*.71,x+.3,1.5,z+f*.74);bb(M.dark,x-.37,1.2,z+f*.701,x+.37,1.21,z+f*.705);perk('fridge',x,z+f*1.05,1);stats.amenities++;};
 const vending=(x,z,f)=>{bb(M.art[1],x-.45,0,z,x+.45,1.85,z+f*.8,true);bb(M.panel,x-.38,.62,z+f*.8,x+.16,1.76,z+f*.805);for(let r=0;r<5;r++)for(let c=0;c<4;c++)bb(M.art[(r+c)%4],x-.36+c*.13,.7+r*.21,z+f*.805,x-.27+c*.13,.82+r*.21,z+f*.82);bb(M.dark,x+.22,1.0,z+f*.8,x+.4,1.45,z+f*.83);bb(M.dark,x-.38,.15,z+f*.8,x+.16,.45,z+f*.83);perk('vending',x,z+f*1.15,1);stats.amenities++;};
 const water=(x,z)=>{box(M.bed,x-.16,0,z-.16,x+.16,1.0,z+.16,true);cyl(M.throw,x,1.0,z,.13,.42,12);perk('water',x,z,1);stats.amenities++;};
 const firstAid=(x,z,f,y=1.2,panel=false)=>{if(panel)bb(M.wall,x-.45,0,z-f*.1,x+.45,2.3,z,true);bb(M.bed,x-.25,y,z,x+.25,y+.45,z+f*.14);bb(M.art[0],x-.035,y+.11,z+f*.141,x+.035,y+.34,z+f*.15);bb(M.art[0],x-.11,y+.19,z+f*.141,x+.11,y+.26,z+f*.15);perk('firstaid',x,z+f*.65,1.4);stats.amenities++;};
 // a coffee point: a partition, its counter, the machine, the sink, the fridge, the vending
 // machine and the water, the first-aid box on the partition; a break spot in front
 const coffeePoint=(x0,z,f,span,group)=>{
  const x1=x0+Math.max(1.8,Math.min(3,span-2.2));
  bb(M.wall,x0-.1,0,z-f*.1,Math.min(x0+span,x1+1.9),2.3,z,true);
  bb(M.bed,x0,0,z,x1,.9,z+f*.62,true);bb(M.stoneD,x0-.02,.9,z,x1+.02,.94,z+f*.65);bb(M.bed,x0,1.5,z,x1-1.15,2.2,z+f*.35);
  coffeeMachine(x0+.45,z,f);bb(M.steel,x1-1.0,.94,z+f*.14,x1-.45,.945,z+f*.5);cyl(M.steel,x1-.72,.94,z+f*.12,.02,.28,8);
  firstAid(x1-.6,z,f,1.35);water(x0-.38,z+f*.35);
  stand(x0+.45,z+f*1.0,yawOf(f),'refreshment',group);stand(x1-.7,z+f*1.0,yawOf(f),'refreshment',group);
  if(span>x1-x0+1)fridge(x1+.45,z,f);
  if(span>x1-x0+2)vending(x1+1.4,z,f);
 };
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
 // a ping-pong table across x, a player at each end; bean bags in a row
 const pong=(px,pz,g)=>{box(M.art[3],px-1.37,.72,pz-.76,px+1.37,.76,pz+.76,true);box(M.bed,px-1.37,.761,pz-.01,px+1.37,.763,pz+.01);box(M.bed,px-.01,.76,pz-.82,px+.01,.92,pz+.82);legs(px,pz,2.4,1.3,.72);stand(px-2.05,pz,-Math.PI/2,'break',g+':pong');stand(px+2.05,pz,Math.PI/2,'break',g+':pong');};
 const beanbags=(x,z,n)=>{for(let i=0;i<n;i++)B.add(M.sofa2,new THREE.SphereGeometry(1,10,8).scale(.42,.32,.42).translate(x+(i-(n-1)/2)*.9,.3,z));};
 // ---------- the breakout spaces that fill the rest of a big floor, a cell at a time ----------
 // each sits in a cell cw by cd centred on x,z; NEED is the least cell it takes
 const NEED={sofas:[3.4,4.2],armchairs:[2.4,3.4],huddle:[2.6,3],library:[2.8,3.2],standing:[2,2.2],pong:[5,2.8],beanbags:[3,3.2],foosball:[2.2,2.6],bikes:[3,2.6],mats:[3,2.6],planter:[0,0]};
 const VIG={
  sofas:(x,z)=>{rug(x-1.5,z-1.65,x+1.5,z+1.65);sofa(x,z+1.25,2,1);sofa(x,z-1.25,2,-1);table(x,z,1.1,.55,.42);},
  armchairs:(x,z,cw)=>{for(const dx of cw>4.6?[-1.15,1.15]:[0]){cyl(M.oak,x+dx,0,z,.42,.42,18);armchair(x+dx,z+1.15,1);armchair(x+dx,z-1.15,-1);}},
  // a round table for four and the board they think at
  huddle:(x,z,cw,cd,g)=>{cyl(M.oak,x,.7,z,.6,.04,20);cyl(M.steel,x,0,z,.05,.7,8);cyl(M.steel,x,0,z,.3,.03,14);for(const [dx,dz,yaw] of [[0,.95,0],[0,-.95,Math.PI],[.95,0,Math.PI/2],[-.95,0,-Math.PI/2]]){chair(x+dx,z+dz,yaw);B.seats.at(-1)[5]=work('meeting colleague',g+':huddle',dz>0||dx>0?1:0);}if(cd>4.8)whiteboard(x,z-1.85,1.4,1);},
  // a quiet corner: the shelves, two armchairs before them, a reading lamp
  library:(x,z,cw,cd)=>{const n=Math.min(3,Math.floor((cw-.8)/1.05)),zb=z-cd/2+.35;for(let i=0;i<n;i++)bookcase(x+(i-(n-1)/2)*1.05,zb,1);for(const k of [-1,1])armchair(x+k*.7,zb+2.1,1);cyl(M.oak,x,0,zb+2.1,.2,.5,14);if(cw>3.6){cyl(M.steel,x+1.4,0,zb+2.3,.02,1.5,8);cyl(M.bed,x+1.4,1.45,zb+2.3,.17,.22,14);}},
  // high tables to stand at with a coffee, and the water
  standing:(x,z,cw,cd,g)=>{(cw>3.8?[x-.95,x+.95]:[x]).forEach((tx,i)=>{cyl(M.oak,tx,1.02,z,.38,.04,18);cyl(M.steel,tx,0,z,.04,1.02,8);cyl(M.steel,tx,0,z,.25,.03,14);stand(tx,z+.7,0,'refreshment',g+':high'+i);stand(tx,z-.7,Math.PI,'refreshment',g+':high'+i);});if(cw>4.4&&cd>3)water(x+cw/2-.55,z-cd/2+.55);},
  pong:(x,z,cw,cd,g)=>pong(x,z,g),
  beanbags:(x,z,cw,cd)=>{tv(x,z-cd/2+.45,1.4,1,[TILE.game,TILE.sports,TILE.news][Math.floor(H(x,z)*3)]);beanbags(x,z+.55,3);},
  foosball:(x,z,cw,cd,g)=>{box(M.oak,x-.65,.6,z-.4,x+.65,.92,z+.4,true);box(M.green,x-.6,.88,z-.36,x+.6,.9,z+.36);for(let i=0;i<4;i++)B.add(M.steel,new THREE.CylinderGeometry(.012,.012,1.3,6).rotateX(Math.PI/2).translate(x-.45+i*.3,.84,z));stand(x,z+1.0,0,'break',g+':foos');stand(x,z-1.0,Math.PI,'break',g+':foos');},
  // exercise bikes in a row, facing -z
  bikes:(x,z,cw)=>{const n=Math.min(3,Math.floor((cw-.6)/.9));for(let i=0;i<n;i++){const bx=x+(i-(n-1)/2)*.9;box(M.dark,bx-.12,0,z-.6,bx+.12,.1,z+.45);solid(bx-.22,z-.6,bx+.22,z+.45,0,1);B.add(M.dark,new THREE.CylinderGeometry(.24,.24,.06,16).rotateZ(Math.PI/2).translate(bx,.34,z-.35));cyl(M.steel,bx,.1,z+.25,.025,.7,8);bb(M.dark,bx-.1,.8,z+.12,bx+.1,.86,z+.38);cyl(M.steel,bx,.1,z-.3,.025,.95,8);bb(M.steel,bx-.22,1.02,z-.36,bx+.22,1.05,z-.3);bb(accent,bx-.12,1.05,z-.4,bx+.12,1.2,z-.36);}},
  mats:(x,z,cw,cd,g)=>{const n=Math.min(3,Math.floor(cw/1.1));for(let i=0;i<n;i++){const mx=x+(i-(n-1)/2)*1.1;box(accent,mx-.3,.022,z-.9,mx+.3,.03,z+.9);stand(mx,z,Math.PI,'break',g+':mat'+i);}},
  planter:(x,z)=>plant(x,z),
 };
 const fill=(x0,z0,x1,z1,list,g)=>{
  const w=x1-x0,d=z1-z0;if(w<2.2||d<2.2)return;
  const nc=Math.max(1,Math.round(w/5.4)),nr=Math.max(1,Math.floor(d/4.4)),cw=w/nc,cd=d/nr,fits=v=>cw>=NEED[v][0]&&cd>=NEED[v][1];
  let k=Math.floor(H(x0,z1)*list.length);
  for(let i=0;i<nc;i++)for(let j=0;j<nr;j++,k++){let v=null;for(let t=0;t<list.length&&!v;t++)if(fits(list[(k+t)%list.length]))v=list[(k+t)%list.length];VIG[v||(fits('armchairs')?'armchairs':'planter')](x0+(i+.5)*cw,z0+(j+.5)*cd,cw,cd,g+':'+i+j);}
 };
 // what each trade's people take their breaks at
 const BREAK={'Engineering':['pong','beanbags','huddle','sofas','standing'],'Product studio':['huddle','armchairs','standing','sofas','library'],'Finance':['library','armchairs','huddle','sofas'],'Client services':['armchairs','sofas','huddle','library'],'Coworking':['standing','sofas','pong','huddle','beanbags','armchairs'],'Conference centre':['standing','armchairs','sofas','huddle'],'Executive offices':['library','armchairs','sofas','huddle']};
 BREAK['Sky commons']=BREAK.Coworking;
 const brk=BREAK[L.program]||BREAK.Coworking;
 // ---------- the floor's own trade, in the half of a zone toward the aisle or all of one ----------
 const FEATURE={
  'Engineering':['HARDWARE LAB',(r,cx,cz,w,d,g)=>{
   // the server racks on the back line, a lab bench, a ping-pong table, bean bags by a screen
   for(let i=0;i<Math.min(4,Math.floor((w-1)/.7));i++){const x=r.x0+.7+i*.68;bb(M.dark,x-.3,0,r.z0+.2,x+.3,2.0,r.z0+1.1,true);for(let y=.3;y<1.85;y+=.14)bb(M.glow,x-.22,y,r.z0+1.101,x-.22+.06+H(i,y)*.2,y+.02,r.z0+1.11);}
   const bz=r.z0+2.4;if(d>4.5){table(cx-w*.2,bz,3,.8,.92);for(const k of [-1,1]){bb(M.dark,cx-w*.2+k*.75-.2,.92,bz-.3,cx-w*.2+k*.75+.2,1.2,bz-.05);screen(cx-w*.2+k*.75,1.06,bz-.049,.36,.22,k<0?TILE.htop:TILE.terminal);bb(M.green,cx-w*.2+k*.75-.25,.92,bz+.02,cx-w*.2+k*.75+.25,.93,bz+.3);chair(cx-w*.2+k*.75,bz+.85,0);B.seats.at(-1)[5]=work('office worker','lab:'+k);}}
   if(w>7.5&&d>5.5)pong(cx+w*.22,r.z1-2.6,g);
   if(d>6){beanbags(cx-w*.2,r.z1-1.0,3);tv(cx-w*.2,r.z1-2.4,1.4,1,TILE.game);}
  }],
  'Product studio':['MAKERS STUDIO',(r,cx,cz,w,d,g)=>{
   // the long worktable of prototypes, a pin-up wall, the 3D printers, armchairs
   const tw=Math.min(3.4,w-2.4);if(tw>1.5&&d>4){table(cx,cz,tw,1.4,.9);bb(M.green,cx-tw/2+.3,.9,cz-.45,cx-tw/2+1.3,.905,cz+.2);for(let i=0;i<6;i++){const x=cx-tw/2+.5+i*(tw-1)/5,h=.08+H(i,cz)*.2;bb(M.art[i%4],x-.1,.9,cz+.25-H(i,1)*.3,x+.1,.9+h,cz+.4-H(i,1)*.3);}for(let x=cx-tw/2+.5;x<cx+tw/2-.3;x+=1.1){chair(x,cz-1.15,Math.PI);B.seats.at(-1)[5]=work('meeting colleague','studio',0);chair(x,cz+1.15,0);B.seats.at(-1)[5]=work('meeting colleague','studio',1);}}
   const pw=Math.min(4,w-1.5);bb(M.wall,cx-pw/2,0,r.z0+.25,cx+pw/2,2.2,r.z0+.35,true);for(let i=0;i<12;i++)bb(M.art[i%4],cx-pw/2+.15+(i%6)*(pw-.3)/6,1.0+Math.floor(i/6)*.55,r.z0+.351,cx-pw/2+.15+(i%6)*(pw-.3)/6+.4,1.0+Math.floor(i/6)*.55+.3+H(i,2)*.12,r.z0+.36);
   for(const k of [0,1]){const x=r.x1-1.2-k*.9,z=r.z0+.8;bb(M.oak,x-.4,0,z-.3,x+.4,.8,z+.3,true);bb(M.dark,x-.25,.8,z-.25,x+.25,1.3,z+.25);bb(M.glow,x-.06,.86,z-.06,x+.06,.92,z+.06);}
   if(d>6)for(const k of [-1,1])armchair(cx+k*1.1,r.z1-1.1,1);
  }],
  'Finance':['MARKETS',(r,cx,cz,w,d,g)=>{
   // a wall of the markets, chesterfields before it, the library of reports
   const n=Math.min(3,Math.floor((w-1)/1.4)),sw=1.3,sh=.73,x0=cx-n*sw/2;bb(M.dark,x0-.08,.95,r.z0+.25,x0+n*sw+.08,1.05+2*sh+.12,r.z0+.35,true);
   for(let i=0;i<n;i++)for(let j=0;j<2;j++)screen(x0+sw/2+i*sw,1.05+sh/2+j*(sh+.06),r.z0+.351,sw-.06,sh,[TILE.ticker,TILE.bars,TILE.dashboard,TILE.pie,TILE.sheet,TILE.ticker][(i+j*3)%6]);
   if(d>4){sofa(cx,r.z0+3.2,2.2,1,M.sofa2);table(cx,r.z0+2.2,1.2,.6,.42);for(const k of [-1,1])armchair(cx+k*1.9,r.z0+2.4,1);rug(cx-2.4,r.z0+1.6,cx+2.4,r.z0+3.7);}
   if(d>6)shelves(cx,r.z1-.25,-1,w);
  }],
  'Client services':['CLIENT LOUNGE',(r,cx,cz,w,d,g)=>{
   // a reception desk, two rings of armchairs, the leaflets, a screen of today's slides
   bb(M.oak,cx-1.3,0,r.z0+1.0,cx+1.3,1.05,r.z0+1.6,true);bb(M.stone,cx-1.35,1.05,r.z0+.95,cx+1.35,1.1,r.z0+1.65);bb(M.dark,cx-.25,1.1,r.z0+1.15,cx+.25,1.42,r.z0+1.2);screen(cx,1.26,r.z0+1.148,.42,.26,TILE.crm,Math.PI);
   B.seats.push([cx,r.z0+.55,Math.PI,false,0,work('office worker','reception')]);
   for(const k of w>7?[-1,1]:[0]){const x=cx+k*w*.25,z=Math.min(r.z1-2,cz+1.2);if(z<r.z0+3.4)continue;cyl(M.oak,x,0,z,.45,.42,20);armchair(x,z+1.15,1);armchair(x,z-1.15,-1);}
   bb(M.oak,r.x1-.6,0,r.z0+.3,r.x1-.2,1.5,r.z0+1.3,true);for(let i=0;i<4;i++)bb(M.art[i],r.x1-.62,.5+i*.25,r.z0+.4,r.x1-.6,.7+i*.25,r.z0+1.2);
   if(w>8)tv(r.x0+1.3,r.z0+.5,1.6,1,TILE.slides);
  }],
  'Coworking':['CAFÉ / PHONE BOOTHS',(r,cx,cz,w,d,g)=>{
   // the café counter, the phone booths, the long community table
   const cw=Math.min(3.2,w-2);bb(M.oak,cx-cw/2,0,r.z0+.4,cx+cw/2,1.05,r.z0+1.0,true);bb(M.stone,cx-cw/2-.03,1.05,r.z0+.36,cx+cw/2+.03,1.1,r.z0+1.05);
   coffeeMachine(cx-cw/2+.5,r.z0+.35,1,1.1);bb(M.glass,cx+.1,1.1,r.z0+.5,cx+cw/2-.2,1.45,r.z0+.95,true);for(let i=0;i<5;i++)bb(M.art[(i+2)%4],cx+.2+i*.22,1.12,r.z0+.6,cx+.36+i*.22,1.2,r.z0+.85);
   stand(cx-cw/2+.5,r.z0+1.55,0,'refreshment',g+':cafe');stand(cx,r.z0+1.55,0,'refreshment',g+':cafe');
   const n=Math.min(3,Math.floor((w-1.2)/1.4));for(let i=0;i<n&&d>6;i++){const x=r.x0+1.0+i*1.4,z=r.z1-1.0;for(const [a,b,c,e]of [[x-.6,z-.6,x-.56,z+.6],[x+.56,z-.6,x+.6,z+.6],[x-.6,z+.56,x+.6,z+.6]])box(M.glass,a,0,b,c,2.3,e,true);for(const sx of [-1,1])box(M.dark,x+sx*.6-.03,0,z-.63,x+sx*.6+.03,2.3,z-.57);box(M.dark,x-.6,2.3,z-.6,x+.6,2.38,z+.6);bb(M.oak,x-.5,.9,z+.3,x+.5,.94,z+.55);cyl(M.dark,x,0,z+.05,.18,.48,12);B.seats.push([x,z,Math.PI,true,.5,work('office worker','booth:'+i)]);}
   if(d>7&&w>6){const tx=cx+w*.18,tz=cz+.6,tw=Math.min(4.2,w*.45);table(tx,tz,tw,.95,.75);for(let x=tx-tw/2+.5;x<tx+tw/2-.3;x+=1.0){chair(x,tz-.85,Math.PI);B.seats.at(-1)[5]=work('meeting colleague','commons',0);chair(x,tz+.85,0);B.seats.at(-1)[5]=work('meeting colleague','commons',1);}}
  }],
  'Conference centre':['FOYER / CATERING',(r,cx,cz,w,d,g)=>{
   // the buffet under its cloths, coffee urns and cups, high tables to stand at
   const bw=Math.min(4.6,w-1.5);box(M.bed,cx-bw/2,0,r.z0+.4,cx+bw/2,.9,r.z0+1.2,true);
   for(let x=cx-bw/2+.4;x<cx+bw/2-.9;x+=.75){box(M.steel,x-.28,.9,r.z0+.55,x+.28,1.02,r.z0+1.0);box(M.steel,x-.3,1.02,r.z0+.53,x+.3,1.05,r.z0+1.02);}
   cyl(M.steel,cx+bw/2-.35,.9,r.z0+.8,.13,.42,14);for(let i=0;i<6;i++)cyl(M.bed,cx+bw/2-.75+(i%3)*.1,.9,r.z0+.6+Math.floor(i/3)*.12,.035,.08,8);perk('buffet',cx,r.z0+1.8,1);stats.amenities++;
   stand(cx-1,r.z0+1.75,0,'refreshment',g+':buffet');stand(cx+1,r.z0+1.75,0,'refreshment',g+':buffet');
   for(let i=0;i<4;i++){const x=r.x0+1.5+(i%2)*(w-3),z=cz+.6+Math.floor(i/2)*Math.min(3,d*.3);if(z>r.z1-1)continue;cyl(M.oak,x,1.02,z,.38,.04,18);cyl(M.steel,x,0,z,.04,1.02,8);cyl(M.steel,x,0,z,.25,.03,14);stand(x,z+.7,0,'refreshment',g+':high'+i);stand(x,z-.7,Math.PI,'refreshment',g+':high'+i);}
   if(w>8)tv(r.x1-1.3,r.z0+.5,1.6,1,TILE.calendar);
  }],
  'Executive offices':['BOARD LIBRARY',(r,cx,cz,w,d,g)=>{
   // the library walls, the chesterfield and its armchairs, the bar cabinet, a game of chess
   shelves(cx,r.z0+.22,1,w);
   if(d>4.5){sofa(cx,r.z1-1.2,2.2,1,M.sofa2);table(cx,r.z1-2.3,1.2,.6,.42);for(const k of [-1,1])armchair(cx+k*1.9,r.z1-2.4,1,M.sofa);rug(cx-2.5,r.z1-3.5,cx+2.5,r.z1-.6);}
   bb(M.oak,r.x1-1.6,0,cz-.3,r.x1-.3,1.0,cz+.3,true);for(let i=0;i<5;i++)cyl(M.art[i%4],r.x1-1.45+i*.25,1.0,cz,.04,.28,8);
   const qx=r.x0+1.6;if(w>5){table(qx,cz,.7,.7,.62);for(let i=0;i<16;i++)if((i+Math.floor(i/4))%2)box(M.dark,qx-.28+(i%4)*.14,.62,cz-.28+Math.floor(i/4)*.14,qx-.14+(i%4)*.14,.625,cz-.14+Math.floor(i/4)*.14);armchair(qx,cz-.95,-1);armchair(qx,cz+.95,1);}
  }],
 };
 FEATURE['Sky commons']=FEATURE['Coworking'];
 // a zone's own set takes the part of it by the aisle; the rest of a big zone is breakout
 const zoneSet=(r,fn,group,list)=>{
  const w=r.x1-r.x0,d=r.z1-r.z0;
  if(w<3||d<2.5)return;
  const out=r.x0<0?-1:1,mw=Math.min(w,9.5),md=Math.min(d,8.5),m=out>0?{x0:r.x0,x1:r.x0+mw,z0:r.z0,z1:r.z0+md}:{x0:r.x1-mw,x1:r.x1,z0:r.z0,z1:r.z0+md};
  fn(m,(m.x0+m.x1)/2,(m.z0+m.z1)/2,mw,md,group);
  fill(out>0?m.x1+.3:r.x0+.3,r.z0+.3,out>0?r.x1-.3:m.x0-.3,r.z1-.3,list,group+':side');
  fill(m.x0+.3,m.z1+.3,m.x1-.3,r.z1-.3,list,group+':front');
 };
 const feature=(r,label,fn,group)=>zoneSet(r,(m,cx,cz,w,d,g)=>{sign(label,cx,2.35,m.z0+.08,Math.min(3.4,w-.5),.32);fn(m,cx,cz,w,d,g);},group,brk);
 const gym=(r,cx,cz,w,d,g)=>{
  sign('GYM',cx,2.35,r.z0+.08,Math.min(2,w-.5),.32);
  // treadmills facing their screens, a bench, the weights, the mats, the mirror
  for(let i=0;i<Math.min(4,Math.floor((w-1)/1.1));i++){const x=r.x0+.9+i*1.1,z=r.z1-1.5;box(M.dark,x-.38,0,z-.9,x+.38,.18,z+.75,true);for(const s of [-1,1])box(M.steel,x+s*.36-.025,.18,z+.62,x+s*.36+.025,1.3,z+.68);box(M.dark,x-.36,1.2,z+.6,x+.36,1.42,z+.78);screen(x,1.31,z+.599,.3,.16,TILE.map,Math.PI);}
  if(d>4.5){const x=cx+w*.2,z=r.z0+1.6;box(M.dark,x-.15,.42,z-.6,x+.15,.5,z+.55,true);for(const s of [-1,1])box(M.steel,x+s*.55-.03,0,z-.62,x+s*.55+.03,1.25,z-.56);cyl(M.dark,x-.75,1.1,z-.59,.2,.06,14);cyl(M.dark,x+.75,1.1,z-.59,.2,.06,14);B.add(M.steel,new THREE.CylinderGeometry(.015,.015,1.7,6).rotateZ(Math.PI/2).translate(x,1.13,z-.59));}
  const rx=r.x0+.8;box(M.steel,rx-.6,0,r.z0+.3,rx+.6,.8,r.z0+.7,true);for(let i=0;i<6;i++)cyl(M.dark,rx-.5+i*.2,.8,r.z0+.5,.05+i*.006,.1,8);
  box(M.steel,r.x0+2,0,r.z0+.15,Math.min(r.x1-.5,r.x0+6),2.2,r.z0+.2);
  if(d>7.5)for(let i=0;i<3;i++){const x=cx-1.2+i*1.2,z=cz+.3;box(accent,x-.3,.022,z-.9,x+.3,.03,z+.9);stand(x,z,Math.PI,'break',g+':mat'+i);}
  water(r.x1-.5,r.z0+.6);firstAid(r.x1-1.5,r.z0+.25,1,1.2,true);
 };
 const games=(r,cx,cz,w,d,g)=>{
  sign('GAMES ROOM',cx,2.35,r.z0+.08,Math.min(3,w-.5),.32);
  // the pool table, two arcade cabinets, a foosball table, bean bags round the console
  if(w>8&&d>4){const x=cx-w*.15,z=cz;box(M.oak,x-1.4,.68,z-.8,x+1.4,.8,z+.8,true);box(M.green,x-1.25,.8,z-.65,x+1.25,.81,z+.65);for(const sx of [-1,1])for(const sz of [-1,1])box(M.oak,x+sx*1.2-.1,0,z+sz*.6-.1,x+sx*1.2+.1,.68,z+sz*.6+.1);for(let i=0;i<6;i++)B.add(M.art[i%4],new THREE.SphereGeometry(.03,8,6).translate(x-.4+i*.12,.84,z+(i%2)*.1));stand(x-1.95,z,-Math.PI/2,'break',g+':pool');stand(x+1.95,z,Math.PI/2,'break',g+':pool');}
  for(let i=0;i<2;i++){const x=r.x1-.7-i*.85,z=r.z0+.6;box(M.dark,x-.35,0,z-.35,x+.35,1.75,z+.35,true);box(accent,x-.36,1.6,z-.36,x+.36,1.85,z+.36);screen(x,1.3,z+.351,.48,.36,TILE.arcade);box(M.dark,x-.33,.9,z+.35,x+.33,.95,z+.6);stand(x,z+1.05,0,'break',g+':arcade'+i);}
  if(d>4){const x=r.x0+1.4,z=r.z0+1.2;box(M.oak,x-.65,.6,z-.4,x+.65,.92,z+.4,true);box(M.green,x-.6,.88,z-.36,x+.6,.9,z+.36);for(let i=0;i<4;i++)B.add(M.steel,new THREE.CylinderGeometry(.012,.012,1.3,6).rotateX(Math.PI/2).translate(x-.45+i*.3,.84,z));}
  tv(cx+w*.15,r.z1-.5,1.6,-1,TILE.sports);beanbags(cx+w*.15,r.z1-2.2,3);
  vending(r.x0+.75,r.z1-.2,-1);
 };
 // ---------- the lounge: a coffee point on the back line, sofas by the windows, a bar ledge ----------
 const lounge=(r,cx,cz,w,d,g,label)=>{
  sign(label,cx,2.35,r.z0+.08,Math.min(w-1,3.5),.35);
  coffeePoint(r.x0+.6,r.z0+.25,1,Math.min(w-1.2,7),g+':coffee');
  const out=r.x0<0?-1:1,fx=out<0?r.x0:r.x1;
  // sofa sets on rugs toward the windows, facing each other over a table
  let sets=0;
  for(let x=r.x0+1.6+(out<0?1.5:0);x<r.x1-1.4-(out>0?1.5:0)&&d>5;x+=4.6){const z1=r.z1-.9,z0=r.z1-3.5;if(z0<r.z0+2.6)break;sets++;rug(x-1.5,z0-.2,x+1.5,z1+.2);sofa(x,z1,2,1);sofa(x,z0,2,-1);table(x,(z0+z1)/2,1.1,.55,.42);}
  // a high ledge along the side window with its stools, a place to stand with a coffee
  if(d>4){const lx=fx-out*.32,za=r.z0+2.4,zb=Math.min(r.z1-1,za+4);if(zb>za+1){bb(M.oak,lx-out*.18,1.02,za,lx+out*.12,1.07,zb,true);for(let z=za+.5;z<zb-.2;z+=1.0){cyl(M.steel,lx-out*.5,0,z,.025,.72,8);cyl(M.dark,lx-out*.5,.72,z,.17,.06,14);stand(lx-out*.75,z,out<0?Math.PI/2:-Math.PI/2,'break',g+':ledge');}}}
  plant(fx-out*.5,r.z1-.5);
  // between the coffee point and the sofas, more to sit or stand at
  fill(out<0?r.x0+1.5:r.x0+.4,r.z0+2.0,out<0?r.x1-.4:r.x1-1.5,sets?r.z1-4.1:r.z1-.9,brk,g+':mid');
 };
 sign(`${L.n === 0 ? 'G' : L.n}  /  ${L.program}`,0,2.9,T.coreZ+.065,Math.min(T.coreW-1,7),.46);
 sign(`${T.region}  /  LIFTS`,0,2.58,T.coreZ+.067,3.2,.22);
 if(L.kind==='office') {
  // Carpet borders and continuous ceiling strips articulate the circulation spine.
  box(accent,-.035,.002,T.coreZ+2,.035,.008,T.hd-.8);
  box(M.panel,-.045,L.h-.31,T.coreZ+2,.045,L.h-.27,T.hd-.8);
  L.zones.forEach((r,zi)=>{
   const w=r.x1-r.x0,d=r.z1-r.z0,cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2,g=r.type+zi;
   box(r.type==='pantry'||r.type==='restroom'?M.stone:M.carpet,r.x0,.002,r.z0,r.x1,.01,r.z1);
   if(r.type==='work'){
    // pods of four by the windows, at most four pods; the aisle half a team corner
    const out=r.x0<0?-1:1,span0=Math.max(3.2,Math.min(w-3,w*.58));
    const nc=Math.min(2,1+Math.floor((span0-2.9)/4.1)),nr=Math.min(4/nc,1+Math.floor((d-2.85)/3.9)),span=Math.min(span0,3.1+(nc-1)*4.1),ax0=out<0?r.x0+.4:r.x1-.4-span,ax1=ax0+span;
    for(let i=0;i<nc;i++)for(let j=0;j<nr;j++)pod(out<0?ax0+1.5+i*4.1:ax1-1.5-i*4.1,r.z0+1.45+j*3.9);
    sign(L.program,out<0?ax0+span/2:ax1-span/2,2.35,r.z0+.08,Math.min(3,span-.5),.32);
    fill(ax0,r.z0+1.45+(nr-1)*3.9+2.0,ax1,r.z1-.3,brk,g+':pods');
    // the team corner beside the pods; past it, breakout to the aisle
    const ux0=out<0?ax1+.3:r.x0+.3,ux1=out<0?r.x1-.3:ax0-.3,uw=Math.min(ux1-ux0,6.5);
    const tx0=out<0?ux0:ux1-uw,tx1=out<0?ux0+uw:ux1,tw=tx1-tx0,tc=(tx0+tx1)/2;
    fill(out<0?tx1+.3:ux0,r.z0+.4,out<0?ux1:tx0-.3,r.z1-.4,brk,g+':aisle');
    if(tw>2.4){
     if(d>5)fill(tx0,r.z0+2.9,tx1,r.z1-3.1,brk,g+':team');
     if(d>5){sofa(tc,r.z1-.9,Math.min(2,tw-.6),1);table(tc,r.z1-1.95,1.0,.5,.42);rug(tc-1.3,r.z1-2.8,tc+1.3,r.z1-.4);}
     whiteboard(tc,r.z0+1.4,Math.min(1.8,tw-.6),1);stand(tc-.5,r.z0+2.4,0,'break',g+':board');stand(tc+.5,r.z0+2.4,0,'break',g+':board');
     bb(M.dark,tx0+.1,0,r.z0+.25,tx0+.75,.95,r.z0+.85,true);bb(M.bed,tx0+.12,.95,r.z0+.3,tx0+.73,1.05,r.z0+.8);
     if(tw>4)bb(accent,tx1-2.2,0,r.z0+.2,tx1-.7,1.9,r.z0+.6,true);
    }
    for(const x of [r.x0+.45,r.x1-.45])plant(x,r.z0+.45);
    if(T.profile.baffles)for(let x=r.x0+.3;x<r.x1;x+=.6)box(M.oak,x,L.h-.46,r.z0+.3,x+.06,L.h-.28,Math.min(r.z1-.3,r.z0+2));
   }else if(r.type==='feature'){
    const [label,fn]=FEATURE[L.program]||FEATURE.Coworking;feature(r,label,fn,g);
   }else if(r.type==='gym'){box(M.stoneD,r.x0+.3,.011,r.z0+.3,r.x1-.3,.022,r.z1-.3);zoneSet(r,gym,g,['bikes','mats']);}
   else if(r.type==='games')zoneSet(r,games,g,['pong','foosball','beanbags','armchairs']);
   else if(r.type==='meeting'){
    // glass rooms along the back, a breakout before their doors
    const md=Math.min(d,6.2),n=Math.max(1,Math.round(w/6)),rw=w/n;
    for(let j=0;j<n;j++){
     const q={x0:r.x0+j*rw+(j?.04:0),x1:r.x0+(j+1)*rw-(j<n-1?.04:0),z0:r.z0,z1:r.z0+md},qx=(q.x0+q.x1)/2,qz=(q.z0+q.z1)/2;
     room(q,'Meeting / '+String(L.n).padStart(2,'0')+(n>1?String.fromCharCode(65+j):''));
     const tw=Math.min(q.x1-q.x0-2,5),td=Math.min(md-2.1,1.65);
     if(tw>.8&&td>.5){box(M.oak,qx-tw/2,.73,qz-td/2,qx+tw/2,.79,qz+td/2,true);legs(qx,qz,tw,td,.73);for(let x=qx-tw/2+.45;x<qx+tw/2;x+=.85){chair(x,qz-td/2-.5,Math.PI);B.seats.at(-1)[5]=work('meeting colleague','meeting:'+qx+':'+qz,0);chair(x,qz+td/2+.5,0);B.seats.at(-1)[5]=work('meeting colleague','meeting:'+qx+':'+qz,1);stats.meetingSeats+=2;}}
     box(M.dark,qx-1.1,1.2,q.z0+.08,qx+1.1,2.45,q.z0+.15);
     screen(qx,1.825,q.z0+.152,2.08,1.13,[TILE.slides,TILE.dashboard,TILE.call,TILE.bars][Math.floor(H(qx,qz)*4)]);
    }
    fill(r.x0+.4,r.z0+md+1.2,r.x1-.4,r.z1-.3,brk,g+':out');
   }else if(r.type==='focus'||r.type==='private'){
    const n=Math.max(1,Math.floor(w/3.5)),md=Math.min(d,5.4);
    for(let j=0;j<n;j++){
     const q={x0:r.x0+j*w/n+.08,x1:r.x0+(j+1)*w/n-.08,z0:r.z0,z1:r.z0+md};room(q,r.type==='focus'?'Focus room':'Private office');
     if(md>3)desk((q.x0+q.x1)/2,r.z0+1.1,1,true);
     box(M.oak,q.x0+.2,0,r.z0+.15,q.x1-.2,.65,r.z0+.55,true);
     if(r.type==='private'&&md>4.2&&q.x1-q.x0>2.6)armchair(q.x0+.75,q.z1-.9,1);
    }
    fill(r.x0+.4,r.z0+md+1.2,r.x1-.4,r.z1-.3,brk,g+':out');
   }else if(r.type==='pantry'){
    room(r,T.region==='Japan'?'Tea pantry / Print':'Pantry / Print',false);
    B.seats.push([cx,r.z0+1.5,0,false,0,{...work('refreshment','pantry:'+cx+':'+cz),routineOnly:true}]);
    box(M.wall,r.x0+.2,0,r.z0+.2,r.x1-.2,.91,r.z0+.9,true);
    box(M.stoneD,r.x0+.18,.91,r.z0+.18,r.x1-.18,.96,r.z0+.93);
    coffeeMachine(r.x0+.65,r.z0+.2,1,.96);
    box(M.steel,r.x1-1,.96,r.z0+.25,r.x1-.35,.98,r.z0+.78);
    cyl(M.steel,r.x1-.6,.98,r.z0+.3,.024,.3,8);
    box(M.bed,r.x0+.2,1.55,r.z0+.2,r.x1-.2,2.2,r.z0+.5,true);
    if(d>3){box(M.dark,r.x0+.25,0,r.z1-1.1,r.x0+1.15,.85,r.z1-.3,true);box(M.bed,r.x0+.3,.85,r.z1-1.02,r.x0+1.1,1.0,r.z1-.4);fridge(r.x1-.7,r.z1-.25,-1);}
    if(w>4)water(r.x0+1.8,r.z1-.6);
   }else if(r.type==='restroom'){
    room(r,'RESTROOMS',true);
    for(let x=r.x0+.9;x<r.x1-.7;x+=1.4){box(M.wall,x-.62,0,r.z0+.1,x-.55,2.15,r.z0+1.9,true);cyl(M.bed,x,.14,r.z0+.65,.26,.27,16);box(M.bed,x-.28,.2,r.z0+.1,x+.28,.78,r.z0+.35);box(M.oak,x-.52,0,r.z0+1.85,x-.06,2.08,r.z0+1.92,true);}
   }else if(r.type==='lounge'){
    lounge(r,cx,cz,w,d,g,L.program==='Sky commons'?'SKY COMMONS':'LOUNGE');
   }
  });
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
