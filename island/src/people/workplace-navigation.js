// One lazy, bounded navigation grid per furnished floor. All coordinates are local.
export function createWorkplaceNavigation({width,depth,solids,holes=[],toLocal=p=>p,toWorld=p=>p}) {
	const radius=.32, step=Math.max(.5,Math.sqrt(width*depth/24000));
	const nx=Math.ceil(width/step), nz=Math.ceil(depth/step), count=nx*nz;
	const walls=solids.filter(c=>c[4]<1.75 && c[5]>.25);
	const clear=(p,pad=radius)=>Number.isFinite(p.x+p.z) && Math.abs(p.x)<width/2-pad && Math.abs(p.z)<depth/2-pad &&
		!holes.some(h=>p.x>h.x0-pad&&p.x<h.x1+pad&&p.z>h.z0-pad&&p.z<h.z1+pad) &&
		!walls.some(c=>p.x>c[0]-pad&&p.x<c[2]+pad&&p.z>c[1]-pad&&p.z<c[3]+pad);
	const segment=(a,b,pad=radius)=>{
		const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.12));
		for(let i=0;i<=n;i++)if(!clear({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},pad))return false;
		return true;
	};
	const point=i=>({x:-width/2+(i%nx+.5)*step,z:-depth/2+(Math.floor(i/nx)+.5)*step});
	let grid=null;
	function node(p) {
		const x=Math.floor((p.x+width/2)/step),z=Math.floor((p.z+depth/2)/step);
		let best=-1,distance=Infinity;
		for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
			const xx=x+dx,zz=z+dz,i=zz*nx+xx;
			if(xx<0||xx>=nx||zz<0||zz>=nz||!grid[i])continue;
			const q=point(i),d=Math.hypot(q.x-p.x,q.z-p.z);
			if(d<distance&&segment(p,q)){best=i;distance=d;}
		}
		return best;
	}
	function route(from,to) {
		const a=toLocal(from),b=toLocal(to);
		if(!clear(a)||!clear(b))return null;
		if(segment(a,b))return [toWorld(b)];
		if(!grid){grid=new Uint8Array(count);for(let i=0;i<count;i++)grid[i]=clear(point(i),.42)?1:0;}
		const start=node(a),end=node(b);if(start<0||end<0)return null;
		const parent=new Int32Array(count).fill(-1),queue=new Int32Array(count);let head=0,tail=1;
		queue[0]=start;parent[start]=start;
		while(head<tail&&parent[end]<0){
			const i=queue[head++],x=i%nx,z=Math.floor(i/nx);
			for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
				const xx=x+dx,zz=z+dz,j=zz*nx+xx;
				if(xx<0||xx>=nx||zz<0||zz>=nz||!grid[j]||parent[j]>=0||!segment(point(i),point(j),.42))continue;
				parent[j]=i;queue[tail++]=j;
			}
		}
		if(parent[end]<0)return null;
		const path=[b];for(let i=end;i!==start;i=parent[i])path.push(point(i));path.push(point(start));path.reverse();
		const smooth=[];let prev=a;
		for(let i=0;i<path.length;){let j=i;while(j+1<path.length&&segment(prev,path[j+1],.42))j++;smooth.push(path[j]);prev=path[j];i=j+1;}
		return smooth.map(toWorld);
	}
	return {route,clear:p=>clear(toLocal(p)),segment:(a,b)=>segment(toLocal(a),toLocal(b)),get nodes(){return grid?.length||0;}};
}
