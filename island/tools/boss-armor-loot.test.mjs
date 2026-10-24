import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LEGENDARIES, LEGENDARY_ARMOR, BOSS_RELICS, relicBoss } from '../src/gameplay/legendary-items.js';
import { ARMS_CATALOG, createInventoryState, applyInventoryTransaction, serializeInventory, deserializeInventory } from '../src/gameplay/arms.js';
import { armorReward, bossRelics, rollEncounter } from '../src/combat/encounter-loot.js';
import { createLoot, equipmentItems } from '../src/combat/loot.js';
import { armorPickupModel } from '../src/combat/armor-pickup.js';
import { statsOf } from '../src/gameplay/gear-levels.js';
import { gearMagic, attunement, ALTERATIONS } from '../src/gameplay/gear-magic.js';
import { armourOf } from '../src/magic/stats.js';
import { LOOKS, wearCode, wornOfCode } from '../src/people/armor-looks.js';
import { itemModel, triangles } from '../src/crysis/held-items.js';

test('every boss awards its own weapon and armor, across both ends of its pool',()=>{
	for(const boss of Object.keys(BOSS_RELICS)) for(const r of [0,.999]) {
		const [w,a]=bossRelics(boss,'bossrelic',25,()=>r);
		assert.ok(BOSS_RELICS[boss].includes(w.i));assert.equal(relicBoss(w.i),boss);assert.equal(relicBoss(a.i),boss);
		assert.equal(ARMS_CATALOG[a.i].kind,'garment');assert.notEqual(w.u,a.u);assert.equal(w.t,4);assert.equal(a.t,4);
		const all=[...equipmentItems(w),...equipmentItems(a)];assert.equal(new Set(all.map(x=>x.u)).size,all.length,'fallback ammo never collides with armor');
	}
});
test('eight armor relics have persistent equippable slots, visible looks, stats and working school alterations',()=>{
	assert.equal(LEGENDARY_ARMOR.length,8);
	for(const [n,d] of LEGENDARY_ARMOR.entries()) {
		const x=armorReward('armor123',15,()=> (n+.5)/8);assert.equal(x.i,d.id);
		let state=createInventoryState('player');
		const loot=createLoot({apply:tx=>{const r=applyInventoryTransaction(state,tx);if(r.ok)state=r.state;return r;}});
		const drop=loot.addCache({id:x.u,name:'Boss reward',pos:{x:0,y:0,z:0},weapon:x});
		assert.equal(drop.items.length,1,'armor creates no phantom ammunition');
		assert.equal(loot.take(x.u,{x:0,y:1,z:0}).ok,true);assert.equal(loot.take(x.u,{x:0,y:1,z:0}).ok,false);
		const worn=applyInventoryTransaction(state,{id:'weararmor',kind:'equip',uid:x.u,slot:d.slot});assert.ok(worn.ok);
		state=deserializeInventory(serializeInventory(worn.state),'player');assert.equal(state.worn[d.slot],x.u);
		assert.ok(LOOKS[x.i]);assert.ok(statsOf(x).length);assert.equal(attunement(x),d.school);
		assert.ok(gearMagic([x]).alter[ALTERATIONS[d.school].spell]);
		assert.equal(wornOfCode(wearCode({[d.slot]:x}))[d.slot],d.id);
		const model=armorPickupModel(x.i);assert.ok(model.children.length);assert.ok(model.userData.ownedArmor);
		if(d.base==='plate-cuirass'||d.base==='plate-carrier')assert.ok(armourOf([x]).armor>0,'actual protection, not just a stat label');
	}
});
test('ordinary enemies roll both rare armor and legendary armor with unchanged pity progress',()=>{
	const enemy={kind:'creature',dead:true,T:{kind:'hostile'},H:{max:100}};
	for(const [band,t] of [[.2,2],[.1,3],[.01,4]]) {
		const rolls=[band,.9,0];const r=rollEncounter(enemy,'rollarmor',{rare:0,legendary:0},()=>rolls.shift()??0);
		assert.equal(r.item.t,t);assert.equal(ARMS_CATALOG[r.item.i].kind,'garment');
	}
});
test('twenty distinct geometry fingerprints at both LODs, bounded triangles and finite positions',()=>{
	const previousDocument=globalThis.document;
	globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
	try {
	for(const lod of ['low','high']) {
		const fingerprints=new Set();
		for(const d of LEGENDARIES){
			const m=itemModel(d.id,{tier:4,level:15,lod,plain:true}),h=createHash('sha256');
			assert.ok(triangles(m)<20000,`${d.id} ${lod}`);
			m.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position.array;assert.ok([...p].every(Number.isFinite));h.update(Buffer.from(p.buffer,p.byteOffset,p.byteLength));}});
			fingerprints.add(h.digest('hex'));
		}assert.equal(fingerprints.size,20);
	}
	} finally { if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument; }
});
