// Twenty authored silhouettes, not recolors of the shop rifle. Geometry stays merged by
// Kit; only the existing hand, charging-handle and replaceable-cell rigs are shared.
import * as THREE from 'three';
import { buildLegendaryDetails } from './legendary-details.js';

// Identity belongs to the relic, not its shop-base rarity finish. In particular the
// void relics must read as obsidian, and their cores must not bleach the whole gun.
export function legendaryFinish(F, relic) {
	const colors = {
		'sunbreak-testament':0xb6a885, 'black-tide':0x30372e, 'stormglass-repeater':0x34424c,
		'widows-meridian':0x393442, 'orchard-of-ashes':0x30251e, 'pilgrims-last-light':0xc6bda1,
		'event-horizon':0x21202d, 'copper-saint':0x916348, 'moth-kings-lantern':0x39303d,
		'choir-of-thorns':0x453d2c, 'dawn-engine':0x8b6542, 'winter-debt':0x465d70,
		'cathedral-of-sparks':0x30343a, 'gravesong-resonator':0x34313a, 'hearth-of-the-exile':0x79513b,
		'gargantuas-whisper':0x24222e, 'wildfire-canticle':0x9e633c, 'oathkeeper-lattice':0x9da9a9,
		'hollow-crown':0x29242f, 'first-morning':0xc8bea2,
	};
	const s=(base,c,r,m,tile,glow=0)=>({...base,c:new THREE.Color(c),r,m,tile,glow,wear:.38});
	return {...F,main:s(F.main,colors[relic.id],.48,.68,11),trim:s(F.trim,0xb39358,.4,.85,1),
		alt:s(F.alt,0x302b28,.86,.02,3),core:s(F.core,relic.color,.26,.15,0,.8),coreHex:relic.color};
}

export function buildLegendary(k, F, relic, muzzle) {
	const tip=muzzle[0], y=muzzle[1], L=tip-.09, seg=k.hi?20:10;
	const metal=F.main, gold=F.trim, light=F.core;
	const surface=(c,r,m,tile=0)=>({...metal,c:new THREE.Color(c),r,m,tile,glow:0});
	const wood=surface(0x473426,.83,.02,3), ivory=surface(0xc7c0a4,.65,.08), copper=surface(0x99623f,.53,.7), cloth=surface(0x665349,.95,0,13);
	const box=(x,h,w,d,s=metal,z=0,a=0)=>k.add(new THREE.BoxGeometry(w,h,d),s,x,y,z,0,0,a);
	const rod=(pts,r=.015,s=metal)=>k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x,v,z=0])=>new THREE.Vector3(x,y+v,z))),pts.length===2?1:Math.min(k.hi?24:12,pts.length*4),r,k.hi?8:6,false),s);
	const arc=(x,v,r,s=gold,start=0,end=Math.PI*2,z=0)=>{
		const pts=Array.from({length:seg+1},(_,n)=>[x+Math.cos(start+(end-start)*n/seg)*r,v+Math.sin(start+(end-start)*n/seg)*r,z]);rod(pts,.012,s);
	};
	const gem=(x,v,r=.035,s=light,z=0)=>k.add(new THREE.OctahedronGeometry(r,0),s,x,y+v,z);
	const plate=(pts,d=.03,s=metal,z=0)=>{
		const shape=new THREE.Shape(pts.map(([x,v])=>new THREE.Vector2(x,y+v)));
		k.add(new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.004,bevelThickness:.004}),s,0,0,z-d/2);
		// Beaten edge piping on both faces, rather than featureless flat polygons.
		if(k.hi)for(const side of [-1,1])for(let i=0;i<pts.length;i++)rod([pts[i],pts[(i+1)%pts.length]].map(([x,v])=>[x,v,z+side*(d/2+.004)]),.0025,gold);
	};
	const fan=(x,v,r,count,s=gold)=>{for(let n=0;n<count;n++){const a=.18+n*(Math.PI-.36)/(count-1);rod([[x+Math.cos(a)*r*.45,v+Math.sin(a)*r*.45],[x+Math.cos(a)*r,v+Math.sin(a)*r]],.009,s);}};
	// A narrow structural spine connects the actual palms and muzzle, never a stock chassis.
	rod([[0,0],[tip,0]],.014,metal);
	plate([[-.045,-.09],[-.055,.035],[.14,.035],[.19,-.015],[.13,-.055],[.025,-.055]],.045,metal);
	rod([[-.04,-.05],[-.065,-.12],[.04,-.13],[.055,-.06]],.005,copper);
	for(const side of [-1,1]) {
		rod([[-.03,-.02,side*.027],[.035,.01,side*.027],[.11,-.02,side*.027]],.003,copper);
		for(let n=0;n<3;n++)k.add(new THREE.SphereGeometry(.004,k.hi?8:4,4),gold,n*.045,-.01+y,side*.029);
	}
	switch(relic.id) {
		case 'sunbreak-testament':
			arc(-.13,-.015,.15,gold,.6,5.4);plate([[-.12,-.04],[0,-.07],[.05,.03],[-.06,.07]],.045,ivory);
			for(let n=0;n<3;n++){const x=.14+n*L*.23;plate([[x,-.02],[x,.08+n*.02],[x+.035,.08+n*.02],[x+.05,-.02]],.045,gold);}
			fan(tip*.6,.02,.1,7);break;
		case 'black-tide':
			rod([[-.29,-.06],[-.2,.045],[-.07,.015],[L,.0]],.034,wood);
			plate([[L*.8,0],[tip,-.035],[tip,.015],[L*.8,.07]],.018,ivory);
			for(let n=0;n<5;n++)rod([[.1+n*.04,-.025],[.11+n*.04,.065]],.006,copper);
			plate([[-.22,0],[-.17,-.14],[-.11,-.08],[-.04,-.18],[.01,-.03]],.006,cloth);gem(L*.65,.04);break;
		case 'stormglass-repeater':
			for(const s of [-1,1])rod([[.05,s*.08],[L*.5,s*.12],[tip,s*.065]],.021,gold);
			arc(-.11,-.02,.105,metal);gem(L*.6,0,.075);plate([[.05,.02],[.18,.17],[.23,.04]],.02,ivory);break;
		case 'widows-meridian':
			for(let n=0;n<3;n++){const x=.07+n*L*.32,r=.09-n*.02;arc(x,0,r,gold);rod([[x-r*.6,0],[x+r*.6,0]],.004,gold);gem(x,0,.015);}
			rod([[-.25,-.04],[-.19,.065],[-.08,.04],[0,0]],.022,wood);rod([[L,-.02],[tip,0]],.008,ivory);break;
		case 'orchard-of-ashes':
			for(const s of [-1,1])rod([[-.24,-.03],[-.12,.02],[.08,-.02],[L*.6,s*.09],[tip,s*.035]],.026,wood);
			gem(L*.7,0,.065);for(let n=0;n<4;n++)rod([[.06+n*.05,.025],[.11+n*.05,.13]],.009,wood);break;
		case 'pilgrims-last-light':
			plate([[-.06,-.025],[L,-.025],[L,.1],[-.06,.1]],.075,ivory);
			for(let n=0;n<3;n++)gem(.07+n*L*.25,.04,.028,light,.045);
			rod([[-.1,.02],[-.07,.19],[L*.6,.19],[L,.02]],.012,gold);arc(-.2,-.06,.085,gold,0,Math.PI*1.6);break;
		case 'event-horizon':
			arc(L*.75,.025,.15,metal);arc(L*.75,.025,.128,gold);gem(L*.75,.025,.025);
			for(const s of [-1,1])rod([[-.28,s*.07],[-.12,0],[.04,0]],.014,metal);break;
		case 'copper-saint':
			plate([[.04,.16],[L,.13],[tip,0],[L,-.13],[.04,-.16],[.09,0]],.06,copper);
			arc(L*.7,0,.03,light);box(-.15,.08,.23,.055,wood);break;
		case 'moth-kings-lantern':
			for(const s of [-1,1]){plate([[.01,0],[L*.3,s*.24],[L*.65,s*.18],[tip,s*.025],[L*.5,s*.06]],.012,ivory);rod([[.03,0],[L*.45,s*.1],[tip,0]],.008,gold);}
			gem(L*.55,0,.075);break;
		case 'choir-of-thorns':
			for(let n=0;n<3;n++){const x=.08+n*L*.3,r=.055+n*.025;arc(x,0,r,wood);for(let j=0;j<5;j++){const a=j*Math.PI*.4;rod([[x+Math.cos(a)*r,Math.sin(a)*r],[x+Math.cos(a)*r*1.4,Math.sin(a)*r*1.4]],.008,ivory);}}
			gem(L*.6,0,.04);break;
		case 'dawn-engine':
			arc(L*.55,0,.13,copper);arc(L*.55,0,.095,gold);gem(L*.55,0,.055);
			for(let n=0;n<12;n++){const a=n*Math.PI/6;rod([[L*.55+Math.cos(a)*.11,Math.sin(a)*.11],[L*.55+Math.cos(a+.12)*.18,Math.sin(a+.12)*.18]],.012,gold);}break;
		case 'winter-debt':
			for(let n=0;n<3;n++){const end=tip-n*.055,v=(n-1)*.06;plate([[.04,v-.018],[end,v],[end-.06,v+.03],[.08,v+.02]],.025,ivory);}
			gem(L*.4,0,.07);rod([[.05,-.1],[.1,0],[.05,.1]],.018,gold);break;
		case 'cathedral-of-sparks':
			box(L*.5,.065,L,.1,wood);for(let n=0;n<5;n++){const x=.04+n*L*.2,h=.12+(.08*Math.sin(n*1.2));rod([[x,-.015],[x,h]],.021,gold);gem(x,h-.025,.012,light,.022);}break;
		case 'gravesong-resonator':
			for(const s of [-1,1])rod([[0,0],[L*.2,s*.1],[L*.7,s*.17],[tip,s*.13]],.022,ivory);
			arc(L*.32,0,.075,metal);for(let n=0;n<3;n++)gem(L*.6+n*.045,-.05-n*.025,.025,copper);break;
		case 'hearth-of-the-exile':
			plate([[.02,-.09],[L,-.09],[L,.06],[.02,.06]],.16,copper);rod([[0,.02],[.06,.2],[L*.85,.2],[tip,.02]],.014,gold);
			for(let n=0;n<3;n++){gem(.08+n*L*.22,-.015,.03,light,.085);rod([[.07+n*.05,.06],[.07+n*.05,.13]],.018,metal);}break;
		case 'gargantuas-whisper':
			arc(L*.55,.045,.17,metal,-1.1,1.1);arc(L*.55,.045,.17,metal,2.1,4.2);gem(L*.55,.045,.075,metal);gem(L*.55,.045,.085,light,.003);
			plate([[0,0],[.08,-.16],[.12,-.04]],.02,gold);break;
		case 'wildfire-canticle':
			k.add(new THREE.CylinderGeometry(.115,.028,L*.65,seg,1,true),copper,tip-L*.325,y,0,0,0,-Math.PI/2);
			for(let n=0;n<3;n++)arc(.04+n*.05,0,.055,copper);gem(.08,0,.055);break;
		case 'oathkeeper-lattice':
			rod([[0,0],[L*.55,.16],[tip,0],[L*.55,-.16],[0,0]],.018,ivory);
			for(let n=1;n<4;n++){const x=L*n/4;rod([[x,-.07],[x+.1,.07]],.008,gold);}gem(L*.55,0,.05);break;
		case 'hollow-crown':
			arc(L*.5,0,.09,light);for(let n=0;n<5;n++){const x=n*L*.22;plate([[x,-.07],[x-.015,.06],[x+.015,.19+(n%2)*.045],[x+.05,.04],[x+.065,-.07]],.028,metal);}gem(L*.5,-.06,.025,gold);break;
		case 'first-morning':
			for(let n=0;n<3;n++){arc(L*.52,0,.075+n*.035,n%2?gold:ivory,0,Math.PI);fan(L*.52,0,.1+n*.035,7,ivory);}
			gem(L*.52,0,.075);plate([[.02,-.035],[tip,-.035],[L*.7,-.11],[.05,-.1]],.04,gold);break;
		default: throw new Error(`Missing legendary silhouette: ${relic.id}`);
	}
	buildLegendaryDetails(k,F,relic,muzzle);
}
