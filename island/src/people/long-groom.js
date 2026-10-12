import * as THREE from 'three';
import recipes from '../../assets/people/hair/long-grooms.json' with { type: 'json' };
import { fittedHairFrame } from './hair-frame.js';

export const LONG_GROOMS=recipes.styles;
let texture;
// A reusable strand-coverage atlas authored mathematically: no borrowed imagery.
export function groomStyle(id){
 if(!texture){
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x/(size-1),v=y/(size-1),strand=Math.sin(u*410+Math.sin(v*8+u*35)*.7),fine=Math.sin(u*977+v*.8);
   const edge=THREE.MathUtils.smoothstep(u,0,.08)*(1-THREE.MathUtils.smoothstep(u,.92,1));
   const end=1-THREE.MathUtils.smoothstep(v,.84+.075*Math.sin(u*63)**2,1);
   const k=(y*size+x)*4,c=Math.round(155+strand*18+fine*8);data[k]=data[k+1]=data[k+2]=c;data[k+3]=Math.round(255*edge*end*(.78+.22*(strand*.5+.5)));
  }
  texture=new THREE.DataTexture(data,size,size);texture.flipY=false;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 }
 return {groom:LONG_GROOMS[id],tex:texture,grain:1};
}

export function groomChunk(P,recipe,volume=1){
 const K=P.skull,c=K.c,scale=P.height/1.75,rows=26,across=4,V=[],UV=[],HK=[],SI=[],SW=[],I=[],N=[],T=[];
 const head=P.map.head,neck=P.map.neck01,spine=P.map.spine01;
 const rng=i=>{const x=Math.sin(i*137.13+17.7)*43758.5;return x-Math.floor(x);};
 const dir=new THREE.Vector3(),point=new THREE.Vector3(),before=new THREE.Vector3(),after=new THREE.Vector3(),tangent=new THREE.Vector3(),cross=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let g=0;g<recipe.guides;g++){
  const layer=g%recipe.layers,k=Math.floor(g/recipe.layers),per=recipe.guides/recipe.layers;
  // Roots follow the part, with side/back trajectories forming overlapping shells.
  const phi=(k+.5)/per*Math.PI*2,side=Math.sin(phi)>=0?1:-1,front=Math.max(0,Math.cos(phi));
  const endpointPhi=side*(.84+Math.abs(Math.atan2(Math.sin(phi),Math.cos(phi)))*.73);
  const length=recipe.length*scale*(.83+.17*rng(g))*(1-front*.21);
  const sample=t=>{
   if(t<.43){
    const q=t/.43,theta=.13+q*1.51;
    dir.set(Math.sin(endpointPhi)*Math.sin(theta),Math.cos(theta),Math.cos(endpointPhi)*Math.sin(theta));
    const r=K.radius(dir)+(.009+layer*.008)*scale;
    point.copy(dir).multiplyScalar(r).add(c);point.x+=recipe.part*(1-q)+side*.003;
   }else{
    const q=(t-.43)/.57,theta=1.64;
    dir.set(Math.sin(endpointPhi)*Math.sin(theta),Math.cos(theta),Math.cos(endpointPhi)*Math.sin(theta));
    const r=K.radius(dir)+(.009+layer*.008)*scale;
    point.copy(dir).multiplyScalar(r).add(c);
    point.y-=length*q;
    // Locks clear the cheeks, then settle behind the shoulder instead of covering the face.
    point.z-=front*.10*scale*THREE.MathUtils.smoothstep(q,0,.5);
    point.x+=side*(.015+front*.042)*scale*Math.sin(q*Math.PI*.7);
    const wave=recipe.wave*scale*Math.sin(q*recipe.frequency*Math.PI*2+phi*.5)*Math.sin(q*Math.PI*.8);
    point.x+=wave;point.z+=wave*.45;
   }
   point.x=c.x+(point.x-c.x)*volume;point.z=c.z+(point.z-c.z)*volume;
   return point;
  };
  const base=V.length/3;
  for(let j=0;j<=rows;j++){
   const t=j/rows;before.copy(sample(Math.max(0,t-.002)));after.copy(sample(Math.min(1,t+.002)));tangent.subVectors(after,before).normalize();const center=sample(t).clone();
   normal.set(center.x-c.x,.08,center.z-c.z).normalize();cross.crossVectors(tangent,normal).normalize();normal.crossVectors(cross,tangent).normalize();
   const width=recipe.width*scale*(.6+.4*rng(g+11))*(.24+.76*Math.sin(Math.min(1,t/.12)*Math.PI/2))*(1-THREE.MathUtils.smoothstep(t,.77,1)*.92);
   for(let a=0;a<=across;a++){
    const u=a/across,lateral=(u-.5)*width,bulge=Math.sin(u*Math.PI)*width*.18;
    V.push(center.x+cross.x*lateral+normal.x*bulge,center.y+cross.y*lateral+normal.y*bulge,center.z+cross.z*lateral+normal.z*bulge);
    N.push(normal.x,normal.y,normal.z);T.push(tangent.x,tangent.y,tangent.z);UV.push(u,t);HK.push(1-t,0,rng(g+91));
    const body=THREE.MathUtils.smoothstep(t,.48,1)*.38;SI.push(head,neck,spine,0);SW.push(1-body,body*.35,body*.65,0);
    if(j<rows&&a<across){const v=base+j*(across+1)+a;I.push(v,v+1,v+across+1,v+1,v+across+2,v+across+1);}
   }
  }
 }
 const F={I,UV,T,N};const frame=fittedHairFrame(V,F,1,K);
 return {n:V.length/3,V,UV,K:HK,SI,SW,I,...frame};
}
