// Diagnostic harness: real Bay surveys and production terrain shader; synthetic road arrives before maps.
import * as T from 'three';
import {createBayArea,bayUniforms} from '../src/bay/terrain.js';
import {createBerms} from '../src/bay/berms.js';
import {toWorld} from '../src/bay/geo.js';
const renderer=new T.WebGLRenderer(); renderer.setSize(640,480);document.body.append(renderer.domElement);
const shared={uSunDir:{value:new T.Vector3(1,1,1).normalize()},uTime:{value:0},uWet:{value:0}};
const scene=new T.Scene(),BU=bayUniforms(), bay=createBayArea(shared,scene,{half:1000},BU), cam=new T.PerspectiveCamera(60,4/3,.1,100000);
const origin=toWorld(37.79,-122.45), road={drive:true,cls:'residential',w:10,pts:new Float32Array([origin.x,origin.z-400,origin.x,origin.z+400])};
const real={loaded:()=>true,inside:()=>true,version:()=>1,near:kind=>kind==='roads'?[road]:[]};
const unsafe=new URLSearchParams(location.search).has('unsafe');
const berms=createBerms(real,(x,z)=>bay.heightAt(x,z),(x,z)=>bay.fixedAt(x,z),{ready:()=>unsafe||bay.loaded()});
cam.position.set(origin.x,20,origin.z);berms.update(cam);
window.probeReady=bay.ready.then(()=>{
cam.position.z+=120;cam.position.y=bay.heightAt(cam.position.x,cam.position.z)+3;berms.update(cam);
const roadHeight=berms.apply(cam.position.x,cam.position.z,bay.heightAt(cam.position.x,cam.position.z));
const surveyHeight=bay.heightAt(cam.position.x,cam.position.z);

 window.probe=async()=>{
 const results=[];
 for(const [name,lat,lon] of [['SF',37.79,-122.45],['SanJose',37.333,-121.89],['SanRamon',37.765,-121.95],['Pacific',37.754,-122.515]]){
 const w=toWorld(lat,lon);cam.position.set(w.x,200,w.z);bay.update(cam,0);
 const mesh=bay.group.children.find(x=>x.isMesh&&x.material.userData.U2?.uHole.value===0),source=mesh.material;
 const pts=[];for(let j=-10;j<=10;j++)for(let i=-10;i<=10;i++)pts.push([w.x+i*23,w.z+j*23]);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pts.flatMap(([x,z])=>[x-mesh.position.x,0,z-mesh.position.z]),3));geometry.setAttribute('probeIndex',new T.Float32BufferAttribute(pts.map((_,i)=>i),1));
 const mat=new T.MeshStandardMaterial();mat.onBeforeCompile=sh=>{source.onBeforeCompile(sh);sh.vertexShader='attribute float probeIndex;\n'+sh.vertexShader;sh.vertexShader=sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ngl_Position=vec4((probeIndex+0.5)/'+pts.length+'.0*2.0-1.0,0.0,0.0,1.0);gl_PointSize=1.0;');sh.fragmentShader='varying float vBH;void main(){gl_FragColor=vec4(vBH,0.0,0.0,1.0);}';};
 const probeScene=new T.Scene(),obj=new T.Points(geometry,mat);obj.frustumCulled=false;probeScene.add(obj);
 const target=new T.WebGLRenderTarget(pts.length,1,{type:T.FloatType,format:T.RGBAFormat});renderer.setRenderTarget(target);renderer.render(probeScene,cam);const pixels=new Float32Array(pts.length*4);renderer.readRenderTargetPixels(target,0,0,pts.length,1,pixels);renderer.setRenderTarget(null);
 const samples=pts.map(([x,z],i)=>({x,z,cpu:berms.apply(x,z,bay.heightAt(x,z)),gpu:pixels[i*4]}));results.push({name,slots:['a','b','c'].map(k=>BU['uR'+k].value.toArray()),maxError:Math.max(...samples.map(s=>Math.abs(s.cpu-s.gpu))),worst:samples.sort((a,b)=>Math.abs(b.cpu-b.gpu)-Math.abs(a.cpu-a.gpu)).slice(0,5)});geometry.dispose();mat.dispose();target.dispose();
 }
 cam.position.set(origin.x+90,surveyHeight+140,origin.z+240);cam.lookAt(origin.x,surveyHeight-10,origin.z+120);bay.update(cam,0);
 scene.background=new T.Color(0x91b8cd);scene.add(new T.HemisphereLight(0xffffff,0x556644,2));
 const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(origin.x+100,500,origin.z+100);sun.target.position.set(origin.x,0,origin.z);scene.add(sun,sun.target);
 renderer.render(scene,cam);
 return {unsafe,roadHeight,surveyHeight,results,lost:renderer.getContext().isContextLost(),glError:renderer.getContext().getError(),failedPrograms:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};
 };return true;
});
