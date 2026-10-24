// Authored volume and construction detail derived from the retained turnaround sheets.
// Static pieces join Kit's one body mesh: no additional draw calls or texture requests.
import * as THREE from 'three';

export function buildLegendaryDetails(k,F,relic,muzzle) {
 const L=muzzle[0]-.09,y=muzzle[1],hi=k.hi,N=hi?16:8;
 const mat=(c,r,m,tile=0)=>({...F.main,c:new THREE.Color(c),r,m,tile,glow:0});
 const brass=F.trim, dark=mat(0x25262c,.58,.6,4), bone=mat(0xc9bea1,.66,.04,11),
  leather=mat(0x473326,.87,.02,2), cloth=mat(0x302d3d,.93,0,13), copper=mat(0x946044,.48,.8,4),
  patina=mat(0x456d64,.81,.28,4), silver=mat(0xaab1af,.37,.8,1), wood=mat(0x51402d,.88,.02,3);
 const add=(g,s,x=0,v=0,z=0,rx=0,ry=0,rz=0)=>k.add(g,s,x,y+v,z,rx,ry,rz);
 const line=(p,r=.003,s=brass)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(a=>new THREE.Vector3(...a))),p.length===2?1:hi?16:8,r,hi?6:4,false),s);
 const panel=(p,d,s,z=0)=>add(new THREE.ExtrudeGeometry(new THREE.Shape(p.map(a=>new THREE.Vector2(...a))),{depth:d,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1}),s,0,0,z-d/2);
 const ring=(x,v,r,z=0,s=brass,t=.004)=>add(new THREE.TorusGeometry(r,t,hi?6:4,N),s,x,v,z);
 const boss=(x,v,r,z,s=brass,depth=.009)=>add(new THREE.CylinderGeometry(r*.86,r,depth,N),s,x,v,z,Math.PI/2);
 const gem=(x,v,r,z=0,s=F.core)=>add(new THREE.OctahedronGeometry(r,0),s,x,v,z);
 const seam=(p,s=brass,r=.003)=>line(p,r,s);
 const window=(x,v,w,h,z,s=brass)=>{
  const p=[[x-w/2,v-h/2],[x-w/2,v+h*.2],[x,v+h/2],[x+w/2,v+h*.2],[x+w/2,v-h/2]];
  panel(p,.005,dark,z);seam([...p,p[0]].map(([a,b])=>[a,b,z+Math.sign(z)*.004]),s);
 };
 const wrap=(x,v,r,s=leather)=>add(new THREE.CylinderGeometry(r,r,.014,N,1,true),s,x,v,0,0,0,Math.PI/2);
 const leaf=(x,v,w,h,z,s=bone)=>panel([[x,v-h/2],[x-w/2,v],[x-w*.28,v+h*.28],[x,v+h/2],[x+w/2,v]],.008,s,z);
 // Bezel and fastener depth is present on both sides, not a decal on one face.
 for(const side of [-1,1]){
  panel([[-.04,-.065],[.01,-.02],[.125,-.025],[.105,-.063]],.008,leather,side*.028);
  if(hi)for(const x of [0,.065,.105])boss(x,-.045,.0035,side*.035,silver,.003);
 }
 switch(relic.id){
 case 'sunbreak-testament':
  for(let n=0;n<3;n++){
   const x=.14+n*L*.23,h=.08+n*.02;
   add(new THREE.CylinderGeometry(.024,.031,h,N),bone,x+.022,h/2,0);
   add(new THREE.ConeGeometry(.032,.037,N),brass,x+.022,h+.018,0);
   for(const side of [-1,1])window(x+.022,h*.6,.021,h*.57,side*.032);
  }
  for(let n=0;n<3;n++)wrap(-.11+n*.025,-.015,.046);
  break;
 case 'black-tide':
  panel([[-.28,-.05],[-.34,.035],[-.25,.003],[-.19,.08],[-.21,-.065]],.052,wood);
  for(let n=0;n<7;n++)wrap(.06+n*.025,.02,.038,leather);
  for(const s of [-1,1]){
   panel([[L*.78,.0],[muzzle[0]-.012,.015],[L*.91,.055],[L*.93,.024]],.012,silver,s*.018);
   seam([[.15,.045,s*.032],[L*.8,.038,s*.026]],copper,.002);
   gem(-.14,-.13,.017,s*.024);ring(-.14,-.101,.008,s*.024);
  }break;
 case 'stormglass-repeater':
  for(const s of [-1,1]){
   panel([[.06,s*.065],[L*.5,s*.105],[L*.92,s*.064],[L*.7,s*.04],[.12,s*.04]],.048,dark);
   add(new THREE.CylinderGeometry(.028,.028,.12,N),silver,L*.38,s*.065,0,0,0,Math.PI/2);
   gem(L*.38,s*.065,.032,s*.028);
  }
  for(const z of [-.04,.04])seam([[.08,.06,z],[L*.5,.105,z],[L,.06,z]],silver);
  break;
 case 'widows-meridian':
  for(let n=0;n<3;n++){
   const x=.07+n*L*.32,r=.077-n*.02;
   boss(x,0,r,0,dark,.035);
   for(const s of [-1,1]){
    ring(x,0,r,s*.022,copper);boss(x,0,.012,s*.028);
    for(let j=0;j<(hi?12:6);j++){const a=j*Math.PI*2/(hi?12:6);seam([[x+Math.cos(a)*r*.78,Math.sin(a)*r*.78,s*.027],[x+Math.cos(a)*r*.9,Math.sin(a)*r*.9,s*.027]],bone,.0018);}
   }
  }break;
 case 'orchard-of-ashes':
  for(let n=0;n<5;n++){
   const x=.045+n*L*.14;
   wrap(x,0,.037,copper);
   leaf(x,.10+(n%2)*.03,.045,.08,(n%2?1:-1)*.035,wood);
  }
  for(const s of [-1,1])seam([[L*.5,s*.06,.025],[L*.65,s*.09,.05],[L*.85,s*.035,.025]],copper,.005);
  break;
 case 'pilgrims-last-light':
  for(const s of [-1,1])for(let n=0;n<3;n++){
   const x=.07+n*L*.25;window(x,.04,.055,.105,s*.043);
   gem(x,.028,.012,s*.052);boss(x,-.02,.0035,s*.049);
  }
  for(let n=0;n<4;n++)add(new THREE.ConeGeometry(.018,.04,4),brass,.02+n*L*.29,.12);
  break;
 case 'event-horizon':
  for(let j=0;j<8;j++){
   const a=j*Math.PI/4,x=L*.75+Math.cos(a)*.158,v=.025+Math.sin(a)*.158;
   add(new THREE.BoxGeometry(.038,.016,.055),dark,x,v,0,0,0,a+Math.PI/2);
   for(const s of [-1,1])boss(x,v,.007,s*.032,brass,.005);
  }
  for(let n=0;n<3;n++)wrap(.015+n*.032,0,.026,silver);
  break;
 case 'copper-saint':
  for(const s of [-1,1]){
   panel([[.09,.12],[L,.095],[L+.045,0],[L,-.095],[.09,-.12],[.13,0]],.018,copper,s*.043);
   leaf(L*.6,0,.09,.20,s*.057,patina);boss(L*.6,.047,.022,s*.071);
   for(let n=0;n<6;n++){const a=n*Math.PI/3;seam([[L*.6+Math.cos(a)*.03,.047+Math.sin(a)*.03,s*.06],[L*.6+Math.cos(a)*.06,.047+Math.sin(a)*.06,s*.06]],brass);}
   for(const v of [-.105,.105])for(const x of [.13,L*.85])boss(x,v,.005,s*.056,silver,.004);
  }break;
 case 'moth-kings-lantern':
  for(const s of [-1,1]){
   panel([[.03,0],[L*.3,s*.23],[L*.41,s*.19],[L*.48,s*.20],[L*.59,s*.15],[L*.7,s*.17],[L*.86,s*.065],[L*.5,s*.04]],.018,cloth);
   for(const z of [-.014,.014])for(const end of [.3,.48,.7])seam([[L*.53,0,z],[L*end,s*(end<.5?.17:.13),z]],brass,.0025);
  }
  for(const z of [-.05,.05]){ring(L*.55,0,.068,z);for(const a of [-1,1])seam([[L*.55+a*.035,-.06,z],[L*.55+a*.06,0,z],[L*.55+a*.035,.06,z]],brass,.004);}
  break;
 case 'choir-of-thorns':
  for(let n=0;n<3;n++){
   const x=.08+n*L*.3,r=.055+n*.025;
   for(const s of [-1,1]){ring(x,0,r,s*.018,wood,.009);leaf(x,-r,.025,.045,s*.021,bone);}
   for(let j=0;j<4;j++){const a=j*Math.PI/2;add(new THREE.ConeGeometry(.012,.045,5),bone,x+Math.cos(a)*r,Math.sin(a)*r,0,0,0,a-Math.PI/2);}
  }break;
 case 'dawn-engine':
  for(const s of [-1,1]){
   boss(L*.55,0,.068,s*.029,copper,.022);ring(L*.55,0,.085,s*.035,brass,.008);
   for(let n=0;n<10;n++){const a=n*Math.PI/5;boss(L*.55+Math.cos(a)*.073,Math.sin(a)*.073,.005,s*.044,silver,.004);}
  }
  for(let n=0;n<12;n++){
   const a=n*Math.PI/6,c=L*.55;
   panel([[c+Math.cos(a)*.12,Math.sin(a)*.12],[c+Math.cos(a+.12)*.18,Math.sin(a+.12)*.18],[c+Math.cos(a+.25)*.13,Math.sin(a+.25)*.13]],.024,bone);
  }break;
 case 'winter-debt':
  for(const s of [-1,1]){
   panel([[.10,-.035],[L*.6,-.055],[L*.9,.015],[L*.58,.01],[L*.72,.065],[.12,.04]],.018,silver,s*.035);
   for(let n=0;n<3;n++)gem(.13+n*L*.17,(n%2?1:-1)*.025,.023,s*.05);
  }
  for(let n=0;n<5;n++)wrap(-.04+n*.022,-.008,.031,bone);
  break;
 case 'cathedral-of-sparks':
  for(let n=0;n<5;n++){
   const x=.04+n*L*.2,h=.12+.08*Math.sin(n*1.2);
   add(new THREE.CylinderGeometry(.026,.026,.015,N,1,true),copper,x,h);
   // Dark inset caps below the rim make the pipes read hollow.
   add(new THREE.CircleGeometry(.02,N),dark,x,h+.003,0,-Math.PI/2);
   for(const s of [-1,1])window(x,.015,.026,.068,s*.055,silver);
  }break;
 case 'gravesong-resonator':
  for(const s of [-1,1]){
   seam([[.03,s*.03,.026],[L*.3,s*.11,.026],[L*.7,s*.16,.026],[L,s*.13,.026]],brass,.003);
   for(let n=0;n<3;n++)leaf(L*.23+n*.035,-.09-n*.025,.025,.1,s*.02,cloth);
  }
  for(let n=0;n<3;n++){const x=L*.6+n*.045;add(new THREE.CylinderGeometry(.008,.022,.032,N,1,true),copper,x,-.05-n*.025);}
  break;
 case 'hearth-of-the-exile':
  for(const s of [-1,1])for(let n=0;n<3;n++){
   const x=.08+n*L*.22;window(x,-.015,.048,.105,s*.087,copper);
   for(const d of [-.011,.011])seam([[x+d,-.06,s*.096],[x+d,.025,s*.096]],brass,.002);
  }
  for(const x of [.03,L-.01])for(const s of [-1,1])add(new THREE.BoxGeometry(.018,.17,.018),brass,x,-.01,s*.086);
  break;
 case 'gargantuas-whisper':
  for(const s of [-1,1]){
   const points=Array.from({length:9},(_,n)=>{const a=-1.1+n*2.2/8;return [L*.55+Math.cos(a)*.17*s,.045+Math.sin(a)*.17];});
   const inner=[...points].reverse().map(([x,v])=>[L*.55+(x-L*.55)*.78,.045+(v-.045)*.78]);
   panel([...points,...inner],.063,dark);
   for(const z of [-.037,.037])seam(points.map(([x,v])=>[x,v,z]),brass,.003);
  }
  add(new THREE.DodecahedronGeometry(.048,0),dark,L*.55,.045,0);
  break;
 case 'wildfire-canticle':
  // Horn mouth lies in YZ, perpendicular to the muzzle (not a side-facing hoop).
  add(new THREE.TorusGeometry(.115,.007,6,N),brass,muzzle[0],0,0,0,Math.PI/2);
  for(let n=0;n<3;n++){
   const x=.08+n*.048;add(new THREE.CylinderGeometry(.008,.008,.07,N),brass,x,.085);
   add(new THREE.CylinderGeometry(.018,.018,.006,N),bone,x,.122);
  }
  wrap(.05,0,.061,copper);break;
 case 'oathkeeper-lattice':
  for(const s of [-1,1]){
   seam([[0,0,s*.035],[L*.55,.155,s*.035],[muzzle[0],0,s*.035],[L*.55,-.155,s*.035],[0,0,s*.035]],silver,.009);
   for(let n=1;n<4;n++){const x=L*n/4;leaf(x,.005,.03,.10,s*.038,patina);boss(x,.005,.006,s*.05);}
  }break;
 case 'hollow-crown':
  for(let n=0;n<5;n++)for(const s of [-1,1]){
   const x=n*L*.22;panel([[x,-.065],[x+.01,.03],[x+.022,.11],[x+.04,.015],[x+.047,-.065]],.015,dark,s*.025);
   seam([[x+.01,-.04,s*.035],[x+.025,.04,s*.035],[x+.035,-.02,s*.035]],brass,.002);
  }
  for(const s of [-1,1])ring(L*.5,-.045,.035,s*.044,copper,.005);break;
 case 'first-morning':
  for(let n=0;n<3;n++){
   const c=L*.52,r=.12+n*.045,z=(n-1)*.032;
   const outer=Array.from({length:9},(_,i)=>{const a=.15+i*(Math.PI-.3)/8;return [c+Math.cos(a)*r,Math.sin(a)*r];});
   const inner=[...outer].reverse().map(([x,v])=>[c+(x-c)*.55,v*.55]);
   panel([...outer,...inner],.009,bone,z);
   for(const s of [-1,1])seam(outer.map(([x,v])=>[x,v,z+s*.008]),brass,.0025);
  }
  // The living eye remains unobstructed at z +/- .079; the bezel sits behind it.
  for(const s of [-1,1])ring(L*.52,0,.069,s*.071,brass,.005);
  gem(L+.025,0,.04,0,bone);break;
 default:throw new Error(`Missing relic construction: ${relic.id}`);
 }
}
