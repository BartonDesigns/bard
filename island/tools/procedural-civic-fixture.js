import {Kit,frame} from '../src/planet/alienkit.js';
import {colliders} from '../src/planet/alien.js';
import {hub,station} from '../src/planet/colony/parts.js';
import {COLONY} from '../src/planet/colony/styles.js';
import {mulberry32} from '../src/noise.js';
export function civicColonyFixture(phone=false){
 const X={K:new Kit(),S:COLONY.MOON,P:{...COLONY.MOON.parts,habs:phone?4:6,dome:'armour',towers:0},H:()=>10,col:colliders(),r:mulberry32(421),det:phone?.6:1,sg:[],pools:[],plumes:[],panels:[],radiators:[],doors:[],railH:6,rooms:{modules:[],towers:[],cab:null,dome:null},vol:[],spots:[],terminals:[],lifts:[],airlocks:[],civic:{surfaces:[],decks:[]}};
 hub(X,{x:0,y:10,z:0,yaw:.3,r:70});station(X,frame(80,12,20,-.3));return X;
}
