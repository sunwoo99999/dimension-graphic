import React, { useEffect, useMemo, useRef, useState } from "react";

// 키보드 화살표로 회전 + Ctrl+트랙패드/휠로 줌

const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const qMul=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const qNorm=q=>{const n=Math.hypot(...q)||1;return q.map(x=>x/n)};
const qFromAxisAngle=(ax,ay,az,th)=>{const n=Math.hypot(ax,ay,az)||1, s=Math.sin(th/2);return qNorm([Math.cos(th/2),(ax/n)*s,(ay/n)*s,(az/n)*s])};
const qToMat3=([w,x,y,z])=>{const xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;return [1-2*(yy+zz),2*(xy-wz),2*(xz+wy),2*(xy+wz),1-2*(xx+zz),2*(yz-wx),2*(xz-wy),2*(yz+wx),1-2*(xx+yy)]};
const applyMat3=(m,[x,y,z])=>[m[0]*x+m[1]*y+m[2]*z,m[3]*x+m[4]*y+m[5]*z,m[6]*x+m[7]*y+m[8]*z];
const proj3Dto2D=(x,y,z,W,H,S,p,z0=3)=>{let sx=x,sy=y; if(p){const f=S/Math.max(0.1,z0+z); sx=x*f; sy=y*f;} else {sx=x*S*0.5; sy=y*S*0.5;} return [W*0.5+sx, H*0.5-sy]};

const hypercube=(n)=>{const N=1<<n,V=Array(N);for(let i=0;i<N;i++){const v=new Float64Array(n);for(let b=0;b<n;b++)v[b]=((i>>b)&1)?1:-1;V[i]=v}const E=[];for(let i=0;i<N;i++)for(let b=0;b<n;b++){const j=i^(1<<b);if(i<j)E.push([i,j])}return{vertices:V,edges:E}};
const simplex=(n)=>{const V=[];for(let i=0;i<n;i++){const v=new Float64Array(n);v[i]=1;V.push(v)}const vn=new Float64Array(n);for(let i=0;i<n;i++)vn[i]=-1/Math.max(1,n-1);V.push(vn);const E=[];for(let i=0;i<V.length;i++)for(let j=i+1;j<V.length;j++)E.push([i,j]);return{vertices:V,edges:E}};
const hypersphere=(n,k=600)=>{const V=Array(k);for(let i=0;i<k;i++){const v=new Float64Array(n);let s=0;for(let d=0;d<n;d++){const g=randn();v[d]=g;s+=g*g}const inv=1/Math.sqrt(s||1);for(let d=0;d<n;d++)v[d]*=inv;V[i]=v}return{vertices:V,edges:[]}};

const makeProj=(n)=>{const R=[new Float64Array(n),new Float64Array(n),new Float64Array(n)];for(const r of R)for(let i=0;i<n;i++)r[i]=randn();const dot=(a,b)=>{let s=0;for(let i=0;i<n;i++)s+=a[i]*b[i];return s};const norm=(a)=>Math.sqrt(dot(a,a))||1;const sub=(a,b,c)=>{for(let i=0;i<n;i++)a[i]-=c*b[i]};const u0=R[0];for(let i=0;i<n;i++)u0[i]/=norm(u0);const u1=R[1];sub(u1,u0,dot(u1,u0));for(let i=0;i<n;i++)u1[i]/=norm(u1);const u2=R[2];sub(u2,u0,dot(u2,u0));sub(u2,u1,dot(u2,u1));for(let i=0;i<n;i++)u2[i]/=norm(u2);return[u0,u1,u2]};
const ndTo3D=(v,[u0,u1,u2])=>{let x=0,y=0,z=0;for(let i=0;i<v.length;i++){const t=v[i];x+=t*u0[i];y+=t*u1[i];z+=t*u2[i];}return[x,y,z]};

export default function DimensionExplorer(){
  const cvs=useRef(null);
  const [dim,setDim]=useState(4);
  const [shape,setShape]=useState("hypercube");
  const [persp,setPersp]=useState(true);
  const [edges,setEdges]=useState(true);
  const [pt,setPt]=useState(3);
  const [zoom,setZoom]=useState(1);
  const [proj,setProj]=useState(()=>makeProj(4));

  const data=useMemo(()=>shape==="hypercube"?hypercube(dim):shape==="simplex"?simplex(dim):hypersphere(dim),[dim,shape]);
  useEffect(()=>setProj(makeProj(dim)),[dim]);

  const [size,setSize]=useState({w:900,h:560});
  useEffect(()=>{const onR=()=>{const p=cvs.current?.parentElement, pad=24, w=Math.max(320,(p?.clientWidth||900)-pad), h=Math.max(260,Math.min(680,Math.floor(w*0.6))); setSize({w,h})}; onR(); addEventListener('resize',onR); return ()=>removeEventListener('resize',onR)},[]);

  // 회전 상태 (쿼터니언)
  const q=useRef([1,0,0,0]);
  useEffect(()=>{
    const onKey=e=>{
      let dq=null;
      if(e.key==='ArrowUp') dq=qFromAxisAngle(1,0,0,0.1);
      if(e.key==='ArrowDown') dq=qFromAxisAngle(1,0,0,-0.1);
      if(e.key==='ArrowLeft') dq=qFromAxisAngle(0,1,0,0.1);
      if(e.key==='ArrowRight') dq=qFromAxisAngle(0,1,0,-0.1);
      if(dq) q.current=qNorm(qMul(dq,q.current));
    };
    const onWheel=e=>{
      if(!e.ctrlKey) return; // Ctrl 눌렀을 때만 줌
      e.preventDefault();
      setZoom(z=>Math.min(4,Math.max(.25,z*(e.deltaY>0?.9:1.1))));
    };
    addEventListener('keydown',onKey);
    window.addEventListener('wheel',onWheel,{passive:false});
    return ()=>{removeEventListener('keydown',onKey);window.removeEventListener('wheel',onWheel)}
  },[]);

  useEffect(()=>{const c=cvs.current;if(!c)return;const ctx=c.getContext('2d');
    const draw=()=>{const {w,h}=size;const dpr=Math.max(1,Math.min(3,devicePixelRatio||1));c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.fillStyle='#0b1020';ctx.fillRect(0,0,w,h);
      const R=qToMat3(q.current), S=Math.min(w,h)*.9*zoom;
      const P=data.vertices, pts=new Array(P.length);
      for(let i=0;i<P.length;i++){const [x,y,z]=ndTo3D(P[i],proj);pts[i]=applyMat3(R,[x,y,z])}
      const zs=pts.map(p=>p[2]);const zmin=Math.min(...zs),zmax=Math.max(...zs);
      if(edges&&data.edges.length){ctx.lineWidth=1.1;ctx.lineCap='round';for(const[i,j]of data.edges){const[x1,y1,z1]=pts[i],[x2,y2,z2]=pts[j];const[sx1,sy1]=proj3Dto2D(x1,y1,z1,w,h,S,persp),[sx2,sy2]=proj3Dto2D(x2,y2,z2,w,h,S,persp);const depth=((z1+z2)*.5-zmin)/Math.max(1e-6,zmax-zmin);const g=Math.floor(120+120*(1-depth));ctx.strokeStyle=`rgba(${g},${g},255,.8)`;ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(sx2,sy2);ctx.stroke();}}
      for(let i=0;i<pts.length;i++){const[x,y,z]=pts[i];const[sx,sy]=proj3Dto2D(x,y,z,w,h,S,persp);const d=(z-zmin)/Math.max(1e-6,zmax-zmin);const r=Math.max(1,pt+(d-.5)*2);const g=Math.floor(160+90*(1-d));ctx.fillStyle=`rgb(${g},${g},255)`;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='12px ui-monospace, Menlo, monospace';ctx.fillText(`${dim}D · ${shape} · V:${P.length}`+(data.edges.length?` · E:${data.edges.length}`:''),12,20);
      requestAnimationFrame(draw)};requestAnimationFrame(draw)
  },[size,data,dim,persp,edges,pt,zoom,proj]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 select-none">
      <h1 className="text-2xl font-semibold mb-3">차원 시각화 실험실</h1>
      <p className="text-sm text-white/70 mb-4">화살표키=회전, Ctrl+트랙패드/휠=줌</p>

      <div className="grid md:grid-cols-[320px,1fr] gap-4 items-start">
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 space-y-3">
          <div>
            <label className="text-sm">모양</label>
            <select value={shape} onChange={e=>setShape(e.target.value)} className="w-full mt-1 rounded-xl bg-slate-800/80 border border-slate-700 p-2">
              <option value="hypercube">하이퍼큐브</option>
              <option value="simplex">심플렉스</option>
              <option value="sphere">초구</option>
            </select>
          </div>
          <div>
            <label className="text-sm">차원: {dim}D</label>
            <input type="range" min={1} max={8} value={dim} onChange={e=>setDim(parseInt(e.target.value))} className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={persp} onChange={e=>setPersp(e.target.checked)} />원근 투영</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={edges} onChange={e=>setEdges(e.target.checked)} disabled={shape==='sphere'} />엣지 표시</label>
          </div>
          <div>
            <label className="text-sm">점 크기: {pt}px</label>
            <input type="range" min={1} max={8} value={pt} onChange={e=>setPt(parseInt(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setProj(makeProj(dim))} className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">재투영</button>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-xl overflow-hidden">
          <canvas ref={cvs} className="w-full h-full block" />
        </div>
      </div>
    </div>
  );
}
