import {payroll} from '../economy/payroll.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function releaseWorkplaceRoutine(p) {
	const r=p.workRoutine;
	if(r?.home.commerce?.customer===p){r.home.commerce.customer=null;r.home.commerce.sceneTime=0;}
	if(r?.target && r.target!==r.home)r.target.taken=false;
	p.workRoutine=null;p.P.workConstrain=null;p.workWalking=false;
}
export function pauseWorkplaceRoutine(p) {
	p.P.workConstrain=null;p.workWalking=false;
	if(p.engaged){p.M.want.speed=0;p.M.S.speed.v=0;p.M.S.speed.dv=0;}
	if(p.workBubble)p.workBubble.visible=false;
	if(p.workRoutine)p.workRoutine.interrupted=true;
}
// where other workplaces' people go between spells at their posts, by role (services/roles.js:
// a nurse to a patient check, an officer to the evidence room): role -> (trip number) -> roles
export const WORK_TRIPS={};
function destinations(r) {
	const role=r.home.work.role,slots=r.home.navigation.spots;
	if(r.target!==r.home)return [r.home];
	let roles;
	if(WORK_TRIPS[role])roles=WORK_TRIPS[role](r.trip);
	else if(role==='shopper')roles=['browse','refreshment'];
	else if(role==='vendor')roles=['stock check'];
	else roles=r.trip%2?['refreshment','break']:['meeting colleague','refreshment','break'];
	return slots.filter(s=>s!==r.home&&!s.taken&&roles.includes(s.work?.role)&&
		(role!=='vendor'||s.work.group===r.home.work.group)&&Math.abs(s.y-r.home.y)<.2);
}
// Intent timers advance only while this actor is available, never while talking or fleeing.
export function stepWorkplaceRoutine(p,dt,actors=[],cam=null) {
	const home=p.workRoutine?.home||p.workSpot;
	if(!home?.navigation)return false;
	const seed=p.P.dna.seed>>>0,nav=home.navigation;
	const r=p.workRoutine||(p.workRoutine={home,target:home,wait:home.work.role==='shopper'?65:home.work.role==='vendor'?90:12+seed%31,trip:0,elapsed:0,path:null,travel:0});
	dt=Math.max(0,Math.min(.05,dt));r.elapsed+=dt;r.retry=Math.max(0,(r.retry||0)-dt);
	const M=p.M,pos=M.S.pos;
	if(Math.abs(pos.y-home.y)>.75){M.want.speed=0;M.stand();p.P.workConstrain=null;return true;}
	p.P.workConstrain=null;p.workWalking=false;
	if(r.interrupted){r.interrupted=false;r.path=null;if(distance(pos,r.target)>.18)r.path=nav.route(pos,r.target);}
	if(!r.path&&distance(pos,r.target)>.25){if(!r.retry){r.path=nav.route(pos,r.target);if(!r.path)r.retry=2;}if(!r.path){M.want.speed=0;M.stand();M.setPose('rest');p.workContext={...home.work,activity:'waiting for a clear route'};return true;}}
	if(!r.path && (r.wait-=dt)<=0){
		const choices=destinations(r),offset=choices.length?(seed+r.trip)%choices.length:0;
		for(let i=0;i<Math.min(choices.length,8);i++){
			const target=choices[(i+offset)%choices.length],path=nav.route(pos,target);
			if(!path)continue;
			if(r.target!==home)r.target.taken=false;
			if(r.target===home && home.commerce?.customer===p){home.commerce.customer=null;home.commerce.sceneTime=0;}
			r.target=target;target.taken=true;r.path=path;r.travel=0;r.trip++;break;
		}
		r.wait=15+seed%13;
	}
	if(!r.path)return false;
	M.stand();M.setPose('rest');M.feel?.('anger',0);M.S.talk=0;M.S.look.target=null;
	if(p.workBubble)p.workBubble.visible=false;
	p.workWalking=true;r.travel+=dt;
	p.workContext={...home.work,activity:'walking to '+(r.target.work.role==='meeting colleague'?'a meeting':r.target===home?'their '+(home.work.role==='shopper'?'checkout':'workstation'):r.target.work.role)};
	const q=r.path[0],d=distance(pos,q);
	if(d<.045){
		M.want.speed=0;M.S.speed.v=0;M.S.speed.dv=0;r.path.shift();
		if(!r.path.length){r.path=null;p.workSpot=r.target;p.workWalking=false;
			// (a meeting reached or the stock checked: a task done for the employer, economy/payroll.js)
			const done=r.target.work?.role;if(home.work.role!=='shopper'&&(done==='meeting colleague'||done==='stock check'))payroll.taskDone('npc:'+(p.P.dna.seed>>>0),done==='stock check'?'stock check':'meeting',home);r.wait=r.target===home?(home.work.role==='shopper'?65:home.work.role==='vendor'?90:40+seed%35):18+seed%17;}
		return true;
	}
	M.want.heading=Math.atan2(q.x-pos.x,q.z-pos.z);
	const blocked=(cam&&Math.abs(cam.y-pos.y-1.7)<1&&distance(cam,pos)<.9)||actors.some(a=>a!==p&&a.active&&Math.abs(a.M.S.pos.y-pos.y)<1&&distance(a.M.S.pos,pos)<.7&&
		Math.abs(wrap(Math.atan2(a.M.S.pos.x-pos.x,a.M.S.pos.z-pos.z)-M.want.heading))<.9);
	M.want.speed=blocked||M.S.sitK.v>.12||Math.abs(wrap(M.want.heading-M.S.heading))>.2?0:Math.min(.9+(seed%7)*.035,d*2.2);
	const before={x:pos.x,z:pos.z};
	p.P.workConstrain=next=>{if(!nav.segment(before,next)){next.x=before.x;next.z=before.z;M.S.speed.v=0;M.S.speed.dv=0;r.path=null;}};
	// A blocked aisle can be retried, without teleporting the actor into their chair.
	if(r.travel>80){r.path=null;r.travel=0;r.wait=5;}
	return true;
}

// Ambient customers spend their own bounded budget. This never touches the player's wallet.
export function settleWorkplaceSale(commerce,customer,receipt,price=12) {
	if(!Number.isFinite(price)||price<=0||!receipt||!commerce||!customer||commerce.lastReceipt===receipt||commerce.stock<=0)return false;
	if(!Number.isFinite(customer.workBudget))customer.workBudget=36+(customer.P.dna.seed%5)*12;
	if(customer.workBudget<price)return false;
	customer.workBudget-=price;commerce.stock--;commerce.sales++;commerce.revenue=(commerce.revenue||0)+price;commerce.lastReceipt=receipt;
	customer.workPurchases=(customer.workPurchases||0)+1;
	return true;
}
