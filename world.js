'use strict';
/* ===== โลก 3D: เกาะ ทะเล ท่าเรือ ฤดูกาล ท้องฟ้า ===== */
const isMobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||Math.min(innerWidth,innerHeight)<600;
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobile,alpha:true,powerPreference:'high-performance'});
renderer.setClearColor(0,0);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xbfe6ff,70,520);
const camera=new THREE.PerspectiveCamera(65,1,.08,1400);
scene.add(camera);
function setGfx(q){ // 1 ต่ำ 2 กลาง 3 สูง
  const pr=devicePixelRatio||1;renderer.setPixelRatio(Math.min(pr,q===1?1:q===2?(isMobile?1.4:1.8):2));
  renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  const ms=q===1?512:1024;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
}
addEventListener('resize',()=>setGfx(S.set.gfx));

const hemi=new THREE.HemisphereLight(0xffffff,0x6a7a55,.7);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2d0,1);sun.castShadow=true;
{const sc=sun.shadow.camera;sc.left=-38;sc.right=38;sc.top=38;sc.bottom=-38;sc.near=1;sc.far=300;sun.shadow.bias=-.0007;}
scene.add(sun,sun.target);
const lamp=new THREE.PointLight(0xffffff,0,1,1);scene.add(lamp);

function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rng=mulberry(20261030);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;

/* ---------- ความสูงของพื้น ---------- */
const IS=48,GN=128,GS=IS*2/GN,GW=GN+1;
const grid=new Float32Array(GW*GW),base0=new Float32Array(GW*GW);
function hash(a,b){const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  return hash(xi,zi)*(1-u)*(1-v)+hash(xi+1,zi)*u*(1-v)+hash(xi,zi+1)*(1-u)*v+hash(xi+1,zi+1)*u*v;}
function baseH(x,z){
  const r=Math.hypot(x,z);
  if(r>=50){const t=r-50;return -(2.19+.5*t+.004*t*t);}
  let w=(vnoise(x*.06,z*.06)-.5)*7*Math.min(1,r/30)*clamp((46-r)/10,0,1);
  if(x>0)w*=Math.min(1,Math.abs(z)/10);
  const rr=r+w;let h=3*(1-rr*rr/1444);
  h+=(vnoise(x*.18+9,z*.18)-.5)*.9*clamp(h/1.2,0,1);
  return h;
}
for(let j=0;j<GW;j++)for(let i=0;i<GW;i++){grid[j*GW+i]=base0[j*GW+i]=baseH(-IS+i*GS,-IS+j*GS);}
function gH(x,z){
  if(x<=-IS+.001||x>=IS-.001||z<=-IS+.001||z>=IS-.001)return baseH(x,z);
  const fx=(x+IS)/GS,fz=(z+IS)/GS,i=Math.floor(fx),j=Math.floor(fz),tx=fx-i,tz=fz-j,k=j*GW+i;
  return grid[k]*(1-tx)*(1-tz)+grid[k+1]*tx*(1-tz)+grid[k+GW]*(1-tx)*tz+grid[k+GW+1]*tx*tz;
}
function pierY(x,z){if(Math.abs(z)>1.3||x<36||x>54)return-99;if(x<36.6)return .5;if(x<37.2)return .78;return 1.05;}
function groundY(x,z){const h=gH(x,z),p=pierY(x,z);return p>h?p:h;}
function waveH(x,z,t){return .12*Math.sin(x*.21+t*1.1)+.09*Math.sin(z*.27-t*.9+x*.05)+.05*Math.sin((x+z)*.5+t*1.9);}

/* ---------- วัสดุ ---------- */
const mk=(c)=>new THREE.MeshLambertMaterial({color:c});
const M={trunk:mk(0x7a5230),leaf:mk(0x3c9a3a),bark:mk(0x6b4423),cap:mk(0xd9b27a),plank:mk(0x9a6b3c),plank2:mk(0x8a5d33),wall:mk(0xa87a48),roof:mk(0x7a3b2a),stone:mk(0x8a8f94),post:mk(0x5a3a20)};
const mkp=(c,s)=>new THREE.MeshPhongMaterial({color:c,shininess:s||10});

/* ---------- ภูมิประเทศ ---------- */
const tGeo=new THREE.PlaneGeometry(IS*2,IS*2,GN,GN);
tGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(GW*GW*3),3));
const terrain=new THREE.Mesh(tGeo,new THREE.MeshLambertMaterial({vertexColors:true}));
terrain.receiveShadow=true;scene.add(terrain);
let seasonIdx=0;
const _c1=new THREE.Color(),_c2=new THREE.Color(),_sand=new THREE.Color('#e6d6a0'),_sandD=new THREE.Color('#a8996c'),_g=new THREE.Color();
function paintTerrain(){
  const col=tGeo.attributes.color;_g.set(SEASONS[seasonIdx].grass);
  for(let j=0;j<GW;j++)for(let i=0;i<GW;i++){
    const k=j*GW+i,h=grid[k];
    _c1.copy(_sand).lerp(_g,clamp((h-.15)/.7,0,1));
    if(h<0)_c1.lerp(_sandD,clamp(-h/1.5,0,1));
    _c1.multiplyScalar(.93+hash(i,j)*.12);
    col.setXYZ(k,_c1.r,_c1.g,_c1.b);
  }
  col.needsUpdate=true;
}
function terrainSync(){
  const p=tGeo.attributes.position;
  for(let j=0;j<GW;j++)for(let i=0;i<GW;i++)p.setXYZ(j*GW+i,-IS+i*GS,grid[j*GW+i],-IS+j*GS);
  p.needsUpdate=true;tGeo.computeVertexNormals();tGeo.computeBoundingSphere();tGeo.computeBoundingBox();paintTerrain();
}
function digAt(x,z,rad,amt){
  const i0=Math.max(0,Math.floor((x-rad+IS)/GS)),i1=Math.min(GN,Math.ceil((x+rad+IS)/GS));
  const j0=Math.max(0,Math.floor((z-rad+IS)/GS)),j1=Math.min(GN,Math.ceil((z+rad+IS)/GS));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const d=Math.hypot(-IS+i*GS-x,-IS+j*GS-z);if(d>=rad)continue;
    let f=1-d/rad;f=f*f*(3-2*f);const k=j*GW+i;
    grid[k]=clamp(grid[k]+amt*f,base0[k]-2.2,base0[k]+3);
  }
  terrainSync();
}

/* ---------- พื้นทะเล + ของตกแต่ง ---------- */
{
  const g=new THREE.PlaneGeometry(900,900,120,120);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=baseH(x,z)-.1;p.setY(i,h);
    const d=clamp(-h/60,0,1);_c1.set('#c9b987').lerp(_c2.set('#2a3a4a'),d);col[i*3]=_c1.r;col[i*3+1]=_c1.g;col[i*3+2]=_c1.b;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshPhongMaterial({vertexColors:true,shininess:0}));m.receiveShadow=false;scene.add(m);
  const rockG=new THREE.IcosahedronGeometry(1,0),rockM=mkp(0x6e6a64,5);
  for(let i=0;i<26;i++){const a=rng()*6.28,r=50+rng()*100,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const m=new THREE.Mesh(rockG,rockM);const s=.8+rng()*2.2;m.scale.set(s,s*.7,s);m.position.set(x,baseH(x,z)+s*.2,z);m.rotation.y=rng()*6;scene.add(m);}
  const cc=['#ff6f91','#ffb347','#c77dff','#ff5e5e','#5ee6c8'];
  const coneG=new THREE.ConeGeometry(.35,1.4,5);
  for(let i=0;i<26;i++){const a=rng()*6.28,r=52+rng()*50,x=Math.cos(a)*r,z=Math.sin(a)*r,mat=mkp(cc[i%5],20);
    for(let k=0;k<3;k++){const m=new THREE.Mesh(coneG,mat);const s=.6+rng()*1.2;m.scale.set(s,s,s);m.position.set(x+rng()*1.6-.8,baseH(x,z)+.5*s,z+rng()*1.6-.8);scene.add(m);}}
  const kelpG=new THREE.BoxGeometry(.14,1,.14);kelpG.translate(0,.5,0);const kelpM=mkp(0x2f8f4a,5);
  for(let i=0;i<34;i++){const a=rng()*6.28,r=50+rng()*45,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const m=new THREE.Mesh(kelpG,kelpM);m.scale.y=2+rng()*4;m.position.set(x,baseH(x,z),z);m.rotation.z=(rng()-.5)*.3;scene.add(m);}
}

/* ---------- น้ำ ---------- */
const WC=[];{for(let i=-60;i<=60;i++){const a=Math.abs(i);const v=a<=40?a*2:80+(Math.pow(1.22,a-40)-1)/.22*2.4;WC.push(Math.sign(i)*v);}}
const waterGeo=new THREE.PlaneGeometry(1,1,120,120);
{const p=waterGeo.attributes.position;for(let j=0;j<=120;j++)for(let i=0;i<=120;i++)p.setXYZ(j*121+i,WC[i],0,WC[j]);}
const waterMat=new THREE.MeshPhongMaterial({color:0x2aa0d8,transparent:true,opacity:.8,shininess:90,specular:0x99ccff,flatShading:true,side:THREE.DoubleSide});
const water=new THREE.Mesh(waterGeo,waterMat);water.frustumCulled=false;scene.add(water);
const WSNAP=2;
function updateWater(t){
  const cx=Math.round(camera.position.x/WSNAP)*WSNAP,cz=Math.round(camera.position.z/WSNAP)*WSNAP;
  water.position.set(cx,0,cz);const p=waterGeo.attributes.position;
  for(let j=20;j<=100;j++)for(let i=20;i<=100;i++){
    const x=WC[i],z=WC[j],e=clamp(1-(Math.hypot(x,z)-55)/18,0,1);
    p.setY(j*121+i,e*waveH(x+cx,z+cz,t));}
  p.needsUpdate=true;
}
/* ฟองคลื่นที่ชายหาด */
const shoreR=[];
const foam=(()=>{const N=160,pos=new Float32Array((N+1)*2*3),idx=[];
  for(let k=0;k<=N;k++){const a=k/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a);let r=44;
    for(let q=24;q<49;q+=.25){if(baseH(c*q,s*q)<=0){r=q;break;}}
    shoreR.push(r);
    pos[k*6]=c*(r-.2);pos[k*6+1]=0;pos[k*6+2]=s*(r-.2);pos[k*6+3]=c*(r+.9);pos[k*6+4]=0;pos[k*6+5]=s*(r+.9);
    if(k<N){const a0=k*2;idx.push(a0,a0+1,a0+2,a0+1,a0+3,a0+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}));
  m.position.y=.04;m.frustumCulled=false;scene.add(m);return m;})();
/* วงน้ำกระเพื่อม */
const ripples=[];for(let i=0;i<6;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.8,1,24),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);ripples.push({m,t:9,s:1});}
let ripI=0;
function ripple(x,z,s){const r=ripples[ripI++%6];r.m.position.set(x,.06,z);r.t=0;r.s=s||1;r.m.visible=true;}

/* ---------- ท่าเรือไม้ ---------- */
const pier=new THREE.Group();
{const pg=new THREE.BoxGeometry(.55,.12,2.7);
  for(let x=36.6;x<54;x+=.6){const m=new THREE.Mesh(pg,x%1.2<.6?M.plank:M.plank2);m.position.set(x,.99,0);m.castShadow=m.receiveShadow=true;pier.add(m);}
  const st=new THREE.BoxGeometry(.6,.14,2.7);
  [[36.3,.44],[36.9,.72]].forEach(([x,y])=>{const m=new THREE.Mesh(st,M.plank);m.position.set(x,y-.07,0);m.castShadow=m.receiveShadow=true;pier.add(m);});
  const post=new THREE.CylinderGeometry(.13,.15,6,6);
  for(let x=37.5;x<=54;x+=3)for(const z of[-1.25,1.25]){const m=new THREE.Mesh(post,M.post);m.position.set(x,-1.8,z);m.castShadow=true;pier.add(m);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.3,6),M.post);t.position.set(x,1.1,z);pier.add(t);}
  const rail=new THREE.BoxGeometry(16.5,.08,.08);
  for(const z of[-1.28,1.28]){const m=new THREE.Mesh(rail,M.post);m.position.set(45.3,1.55,z);pier.add(m);}
  const lan=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),new THREE.MeshBasicMaterial({color:0xffd27a}));lan.position.set(54,1.9,1.25);pier.add(lan);
  const lp=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.9,5),M.post);lp.position.set(54,1.5,1.25);pier.add(lp);
}
scene.add(pier);

/* ---------- ตัวช่วยสร้างโมเดล ---------- */
const colliders=[],BOXES=[],SHELTER=[];
function box(w,h,d,mat,x,y,z,sh){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;if(sh)SHELTER.push(m);return m;}
function makeHuman(o){
  const g=new THREE.Group(),L=(w,h,d,c,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mk(c));m.position.set(x,y,z);m.castShadow=true;return m;};
  const body=L(.5,.7,.28,o.shirt,0,1.15,0),head=L(.34,.34,.34,o.skin,0,1.68,0);
  const hair=L(.37,.13,.37,o.hair,0,1.88,.01),back=L(.37,.3,.1,o.hair,0,1.74,.14);
  const e1=L(.05,.05,.02,'#222',-.08,1.7,-.175),e2=L(.05,.05,.02,'#222',.08,1.7,-.175);
  g.add(body,head,hair,back,e1,e2);
  const limb=(w,h,d,c,x,y,mid)=>{const p=new THREE.Group();p.position.set(x,y,0);const m=L(w,h,d,c,0,-mid,0);p.add(m);g.add(p);return p;};
  const legL=limb(.22,.8,.24,o.pants,-.13,.8,.4),legR=limb(.22,.8,.24,o.pants,.13,.8,.4);
  const armL=limb(.16,.7,.18,o.shirt,-.33,1.45,.3),armR=limb(.16,.7,.18,o.shirt,.33,1.45,.3);
  const hand=L(.14,.14,.14,o.skin,0,-.72,0);armR.add(hand);armL.add(hand.clone());
  return{g,body,head,armL,armR,legL,legR,parts:[body,head,hair,back,e1,e2,legL,legR,armL,armR]};
}
function buildRod(def){
  const g=new THREE.Group(),n=6,sl=def.L/n,segs=[];
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.45,8).rotateX(Math.PI/2),mk(0x2a1d14));grip.position.z=-.02;g.add(grip);
  const reel=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.07,10).rotateZ(Math.PI/2),mkp(0xb0b6bd,60));reel.position.set(0,-.07,-.12);g.add(reel);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.02,6,5),mk(0xd33));knob.position.set(.06,-.07,-.12);g.add(knob);
  const sm=mkp(def.col,40);let par=g;
  for(let i=0;i<n;i++){
    const r0=.02*(1-i/n*.72)+.005,r1=.02*(1-(i+1)/n*.72)+.005;
    const s=new THREE.Object3D();s.position.z=i===0?-.25:-sl;par.add(s);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,sl,6).rotateX(Math.PI/2).translate(0,0,-sl/2),sm);m.castShadow=true;s.add(m);
    if(i%2===1){const ring=new THREE.Mesh(new THREE.TorusGeometry(.028,.005,4,8),mk(0xdddddd));ring.position.set(0,.03,-sl*.5);s.add(ring);}
    segs.push(s);par=s;}
  const tip=new THREE.Object3D();tip.position.z=-sl;par.add(tip);
  return{group:g,segs,tip,setBend(a){const p=a/n;segs.forEach((s,i)=>s.rotation.x=-p*(i===0?.3:1));}};
}
function buildTool(kind,def){
  const g=new THREE.Group();
  if(kind==='spear'){
    const cols={sp0:[0x8a6a3c,0x8a6a3c],sp1:[0x6b4a2a,0xc0c6cc],sp2:[0x6b4a2a,0x9ad0ff],sp3:[0x2a2f40,0x58f0ff]};
    const c=cols[def.id]||cols.sp0,L=def.id==='sp0'?1.9:2.3;
    const s=new THREE.Mesh(new THREE.CylinderGeometry(.028,.032,L,6).rotateX(Math.PI/2),mk(c[0]));s.position.z=-L/2+.4;g.add(s);
    const t=new THREE.Mesh(new THREE.ConeGeometry(def.id==='sp0'?.03:.06,.34,6).rotateX(-Math.PI/2),def.id==='sp3'?new THREE.MeshBasicMaterial({color:c[1]}):mkp(c[1],60));t.position.z=-L+.4-.17;g.add(t);
    if(def.id!=='sp0'){for(const x of[-.07,.07]){const b=new THREE.Mesh(new THREE.ConeGeometry(.02,.22,4).rotateX(-Math.PI/2),mkp(c[1],60));b.position.set(x,0,-L+.4-.05);g.add(b);}}
  }else if(kind==='axe'){
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.03,.035,1,6).rotateX(Math.PI/2),mk(0x7a5230));h.position.z=-.3;g.add(h);
    const hd=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.24),mkp(0xaab2ba,70));hd.position.set(0,.06,-.78);g.add(hd);
  }else if(kind==='shovel'){
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.1,6).rotateX(Math.PI/2),mk(0x7a5230));h.position.z=-.35;g.add(h);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.24,.03,.32),mkp(0x9aa2aa,60));b.position.set(0,0,-1);g.add(b);
  }
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  return g;
}
const FM={};
function fmat(c,glow){const k=c+(glow?'g':'');return FM[k]||(FM[k]=new THREE.MeshPhongMaterial({color:c,shininess:30,emissive:glow?c:0x000000,emissiveIntensity:glow?.28:0}));}
const _sphG=new THREE.SphereGeometry(.5,8,6),_tailG=new THREE.ConeGeometry(.2,.28,4).rotateZ(-Math.PI/2),_finG=new THREE.ConeGeometry(.08,.18,4),_eyeG=new THREE.SphereGeometry(.03,5,4),_eyeM=new THREE.MeshBasicMaterial({color:0x111111});
function buildFish(sp){
  const g=new THREE.Group(),glow=sp.r>=4,m=fmat(sp.c,glow),sh=sp.sh;
  let h=.32,w=.22;if(sh===1){h=.2;w=.16;}else if(sh===2){h=.55;w=.3;}else if(sh===3){h=.1;w=.9;}else if(sh===4){h=.1;w=.1;}else if(sh===5){h=.26;w=.24;}
  const b=new THREE.Mesh(_sphG,m);b.scale.set(1,h,w);g.add(b);
  const tp=new THREE.Group();tp.position.x=-.5;g.add(tp);
  const t=new THREE.Mesh(_tailG,m);t.position.x=-.12;t.scale.set(1,Math.max(.6,h*2.4),.25);tp.add(t);
  const f=new THREE.Mesh(_finG,m);f.position.set(.05,h/2+.04,0);f.scale.set(1,sh===5?2.2:1,1);g.add(f);
  const e1=new THREE.Mesh(_eyeG,_eyeM),e2=e1.clone();e1.position.set(.36,h*.15,w*.42);e2.position.set(.36,h*.15,-w*.42);g.add(e1,e2);
  g.userData.tail=tp;return g;
}

/* ---------- ที่พัก / กองไฟ / ร้านค้า ---------- */
const HUT={cx:-14,cz:9,w:5,d:4};HUT.hy=groundY(HUT.cx,HUT.cz)+.12;
{const{cx,cz,w,d,hy}=HUT;
  const fl=box(w+.5,1.6,d+.5,M.stone,cx,hy-.8,cz);scene.add(fl);
  const fl2=box(w,.12,d,M.plank,cx,hy+.04,cz);scene.add(fl2);
  const H=2.4,t=.2;
  const back=box(t,H,d,M.wall,cx-w/2,hy+H/2,cz,true),l=box(w,H,t,M.wall,cx,hy+H/2,cz-d/2,true),r=box(w,H,t,M.wall,cx,hy+H/2,cz+d/2,true);
  const f1=box(t,H,(d/2-.6),M.wall,cx+w/2,hy+H/2,cz-(d/2+.6)/2,true),f2=box(t,H,(d/2-.6),M.wall,cx+w/2,hy+H/2,cz+(d/2+.6)/2,true);
  const lintel=box(t,.5,1.2,M.wall,cx+w/2,hy+H-.25,cz,true);
  scene.add(back,l,r,f1,f2,lintel);
  BOXES.push({x0:cx-w/2-.15,x1:cx-w/2+.15,z0:cz-d/2,z1:cz+d/2},{x0:cx-w/2,x1:cx+w/2,z0:cz-d/2-.15,z1:cz-d/2+.15},{x0:cx-w/2,x1:cx+w/2,z0:cz+d/2-.15,z1:cz+d/2+.15},
    {x0:cx+w/2-.15,x1:cx+w/2+.15,z0:cz-d/2,z1:cz-.6},{x0:cx+w/2-.15,x1:cx+w/2+.15,z0:cz+.6,z1:cz+d/2});
  const roof=new THREE.Mesh(new THREE.ConeGeometry(4.1,1.8,4),M.roof);roof.rotation.y=Math.PI/4;roof.scale.set(1.08,1,.88);roof.position.set(cx,hy+H+.9,cz);roof.castShadow=true;scene.add(roof);SHELTER.push(roof);
  const roofB=box(w+.6,.12,d+.6,M.roof,cx,hy+H+.06,cz,true);scene.add(roofB);
  const bed=box(1.9,.35,.95,mk(0xc9c2b0),cx-1.4,hy+.3,cz-1,false),bl=box(1.3,.12,.9,mk(0x3a6fd0),cx-1.0,hy+.52,cz-1,false);scene.add(bed,bl);
  HUT.bed={x:cx-1.4,z:cz-1};HUT.spawn={x:cx+w/2+1.5,z:cz};HUT.roof=roof;
}
const CAMP={x:-4,z:-9};CAMP.y=groundY(CAMP.x,CAMP.z);
const flame=new THREE.Group(),fireLight=new THREE.PointLight(0xff9a3c,0,16,1.2);
{for(let i=0;i<7;i++){const a=i/7*6.28,m=new THREE.Mesh(new THREE.IcosahedronGeometry(.22,0),M.stone);m.position.set(CAMP.x+Math.cos(a)*.7,CAMP.y+.12,CAMP.z+Math.sin(a)*.7);m.castShadow=true;scene.add(m);}
  for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.9,5).rotateZ(Math.PI/2),M.bark);m.position.set(CAMP.x,CAMP.y+.12,CAMP.z);m.rotation.y=i*1.05;scene.add(m);}
  const f1=new THREE.Mesh(new THREE.ConeGeometry(.3,.9,6),new THREE.MeshBasicMaterial({color:0xff7a1a})),f2=new THREE.Mesh(new THREE.ConeGeometry(.17,.6,6),new THREE.MeshBasicMaterial({color:0xffd84a}));
  f1.position.y=.5;f2.position.y=.38;flame.add(f1,f2);flame.position.set(CAMP.x,CAMP.y+.1,CAMP.z);scene.add(flame);
  fireLight.position.set(CAMP.x,CAMP.y+1.2,CAMP.z);scene.add(fireLight);
  const spit=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.8,5).rotateZ(Math.PI/2),M.post);spit.position.set(CAMP.x,CAMP.y+.9,CAMP.z+.01);scene.add(spit);
  for(const s of[-.9,.9]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.9,5),M.post);p.position.set(CAMP.x+s,CAMP.y+.45,CAMP.z);scene.add(p);}}
const STALL={x:30.5,z:6.5};STALL.y=groundY(STALL.x,STALL.z);
const npc=makeHuman({shirt:0xd9822b,pants:0x4a3a2a,skin:0xe3b58a,hair:0x2a1a10});
{const{x,z,y}=STALL;
  const c=box(.9,1,2.8,M.plank,x,y+.5,z);scene.add(c);
  for(const dz of[-1.5,1.5])for(const dx of[-.5,.9]){const p=box(.12,2.6,.12,M.post,x+dx,y+1.3,z+dz);scene.add(p);}
  const rf=box(2.6,.1,3.6,mk(0xd94a3a),x+.2,y+2.6,z);scene.add(rf);SHELTER.push(rf);
  npc.g.position.set(x+1.2,y,z);npc.g.rotation.y=Math.PI/2;scene.add(npc.g);
  const cv=document.createElement('canvas');cv.width=256;cv.height=96;const cx=cv.getContext('2d');cx.fillStyle='#5a3a20';cx.fillRect(0,0,256,96);cx.fillStyle='#ffe9b0';cx.font='bold 44px sans-serif';cx.textAlign='center';cx.fillText('ร้านเบ็ดปลา',128,62);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(2,.75),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)}));sg.position.set(x-.52,y+1.9,z);sg.rotation.y=-Math.PI/2;scene.add(sg);
  const gl=box(.8,.1,2.4,mk(0xcdb48a),x,y+1.05,z);scene.add(gl);
  colliders.push({x:x,z:z,r:1.6});}
colliders.push({x:CAMP.x,z:CAMP.z,r:.9});

/* ---------- ต้นไม้ พุ่มไม้ หญ้า ดอกไม้ ---------- */
const TREES=[],trunkMeshes=[];
const trunkGeo=new THREE.CylinderGeometry(.75,1,1,7);trunkGeo.translate(0,.5,0);
const lg=new THREE.IcosahedronGeometry(1,0);
function farFrom(x,z,list,d){return list.every(p=>Math.hypot(x-p[0],z-p[1])>d);}
{const avoid=[[HUT.cx,HUT.cz],[CAMP.x,CAMP.z],[STALL.x,STALL.z]];let n=0,tries=0;const placed=[];
  while(n<16&&tries++<500){const a=rng()*6.28,r=6+rng()*27,x=Math.cos(a)*r,z=Math.sin(a)*r,h=gH(x,z);
    if(h<1.1||(x>24&&Math.abs(z)<6)||!farFrom(x,z,avoid,7)||!farFrom(x,z,placed,4.5))continue;
    placed.push([x,z]);n++;
    const s=.8+rng()*.6,H=4+rng()*2.2,R=.32*s;
    const trunk=new THREE.Mesh(trunkGeo,M.trunk);trunk.scale.set(R,H,R);trunk.position.set(x,h-.1,z);trunk.castShadow=true;trunk.receiveShadow=true;scene.add(trunk);
    const can=new THREE.Group();can.position.set(x,h-.1+H,z);
    for(const[ox,oy,oz,sc]of[[0,.9,0,1.9],[.8,.1,.4,1.5],[-.7,.2,-.5,1.4]]){const m=new THREE.Mesh(lg,M.leaf);m.scale.set(sc*s,sc*s*.8,sc*s);m.position.set(ox*s,oy*s,oz*s);m.castShadow=true;can.add(m);}
    scene.add(can);
    const t={x,z,gy:h-.1,H0:H,H,r:R,trunk,canopy:can,idx:TREES.length};trunk.userData.tree=t;TREES.push(t);trunkMeshes.push(trunk);}
}
{const avoid=[[HUT.cx,HUT.cz],[CAMP.x,CAMP.z],[STALL.x,STALL.z]];let n=0,tries=0;
  while(n<22&&tries++<400){const a=rng()*6.28,r=4+rng()*30,x=Math.cos(a)*r,z=Math.sin(a)*r,h=gH(x,z);
    if(h<.8||(x>24&&Math.abs(z)<6)||!farFrom(x,z,avoid,5))continue;n++;
    const m=new THREE.Mesh(lg,M.leaf);const s=.5+rng()*.5;m.scale.set(s*1.2,s*.8,s*1.2);m.position.set(x,h+s*.3,z);m.castShadow=true;scene.add(m);}}
const grassGeo=new THREE.ConeGeometry(.07,.55,3);grassGeo.translate(0,.275,0);
const GRN=260,grass=new THREE.InstancedMesh(grassGeo,new THREE.MeshLambertMaterial({color:0xffffff}),GRN);
const grassBase=[];
{const d=new THREE.Object3D();let n=0,tries=0;
  while(n<GRN&&tries++<3000){const a=rng()*6.28,r=3+rng()*35,x=Math.cos(a)*r,z=Math.sin(a)*r,h=gH(x,z);
    if(h<.75||(x>26&&Math.abs(z)<4))continue;
    d.position.set(x,h,z);const s=.7+rng()*1.1;d.scale.set(s,s*(.8+rng()*.8),s);d.rotation.set((rng()-.5)*.3,rng()*6,(rng()-.5)*.3);d.updateMatrix();grass.setMatrixAt(n,d.matrix);grassBase.push(.8+rng()*.4);n++;}
  grass.count=n;grass.receiveShadow=true;scene.add(grass);}
const flowers=new THREE.InstancedMesh(new THREE.SphereGeometry(.1,6,4),new THREE.MeshLambertMaterial({color:0xffffff}),90);
{const d=new THREE.Object3D(),fc=['#ff6fa8','#ffe14a','#ffffff','#c77dff','#ff8a3c'];let n=0,tries=0;
  while(n<90&&tries++<1500){const a=rng()*6.28,r=3+rng()*33,x=Math.cos(a)*r,z=Math.sin(a)*r,h=gH(x,z);
    if(h<.9||(x>26&&Math.abs(z)<4))continue;d.position.set(x,h+.18,z);d.updateMatrix();flowers.setMatrixAt(n,d.matrix);flowers.setColorAt(n,_c1.set(fc[n%5]));n++;}
  flowers.count=n;scene.add(flowers);}

/* ---------- ท้องฟ้า ---------- */
const sunM=new THREE.Mesh(new THREE.SphereGeometry(16,12,8),new THREE.MeshBasicMaterial({color:0xfff2b0,fog:false}));
const moonM=new THREE.Mesh(new THREE.SphereGeometry(11,12,8),new THREE.MeshBasicMaterial({color:0xe8eeff,fog:false}));
scene.add(sunM,moonM);
const stars=(()=>{const n=420,p=new Float32Array(n*3);for(let i=0;i<n;i++){const u=Math.random()*6.28,v=Math.random()*.95+.05,r=900;p[i*3]=Math.cos(u)*r*Math.sqrt(1-v*v);p[i*3+1]=v*r;p[i*3+2]=Math.sin(u)*r*Math.sqrt(1-v*v);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));m.frustumCulled=false;scene.add(m);return m;})();
const clouds=[],cloudM=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.92});
for(let i=0;i<9;i++){const g=new THREE.Group();for(let k=0;k<4;k++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,7,5),cloudM);const s=10+rng()*10;m.scale.set(s*1.6,s*.55,s);m.position.set((k-1.5)*14,rng()*3,rng()*8-4);g.add(m);}
  g.position.set((rng()-.5)*700,75+rng()*25,(rng()-.5)*700);scene.add(g);clouds.push(g);}
const AUR={on:false,a:0,rib:[]};
for(let q=0;q<2;q++){const seg=48,rows=6,g=new THREE.PlaneGeometry(1,1,seg,rows);g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*3),3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false,fog:false}));
  m.frustumCulled=false;m.visible=false;scene.add(m);AUR.rib.push({m,seg,rows,ph:q*2.1});}
function updateAurora(t){
  AUR.rib.forEach((R,q)=>{R.m.visible=AUR.a>.01;if(!R.m.visible)return;
    const p=R.m.geometry.attributes.position,c=R.m.geometry.attributes.color,{seg,rows}=R;
    for(let j=0;j<=rows;j++)for(let i=0;i<=seg;i++){const k=j*(seg+1)+i,u=i/seg,v=1-j/rows;
      const x=(u-.5)*340,y=v*55+14*Math.sin(u*9+t*.4+R.ph),z=Math.sin(u*5+t*.25+R.ph)*25;
      p.setXYZ(k,x,y,z);
      const f=Math.pow(Math.sin(Math.PI*clamp(v,.001,.999)),.7)*(.45+.55*Math.sin(u*14+t*.8+R.ph))*Math.sin(Math.PI*u)*AUR.a*.9;
      c.setXYZ(k,(.2+.5*v)*f,(1-.4*v)*f,(.6+.4*v)*f);}
    p.needsUpdate=true;c.needsUpdate=true;
    R.m.position.set(camera.position.x+q*70-30,camera.position.y+30,camera.position.z-230-q*40);});
}

/* ---------- สภาพอากาศ ---------- */
const RN=320,rain={x:new Float32Array(RN),y:new Float32Array(RN),z:new Float32Array(RN)},FN=260,fl={x:new Float32Array(FN),y:new Float32Array(FN),z:new Float32Array(FN),ph:new Float32Array(FN)};
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(RN*6),3));
const rainMesh=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xaac8ff,transparent:true,opacity:.5}));rainMesh.frustumCulled=false;rainMesh.visible=false;scene.add(rainMesh);
const flGeo=new THREE.BufferGeometry();flGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(FN*3),3));
const flMat=new THREE.PointsMaterial({size:.25,color:0xffffff,transparent:true,depthWrite:false});
const flMesh=new THREE.Points(flGeo,flMat);flMesh.frustumCulled=false;flMesh.visible=false;scene.add(flMesh);
let wInit=false;
function updateWeather(dt){
  const part=SEASONS[seasonIdx].part,cx=camera.position.x,cy=Math.max(camera.position.y,.5),cz=camera.position.z;
  if(!wInit){wInit=true;for(let i=0;i<RN;i++){rain.y[i]=-99;}for(let i=0;i<FN;i++){fl.y[i]=-99;fl.ph[i]=Math.random()*6;}}
  const showR=(part==='rain'||part==='fish')&&!ENV.under;rainMesh.visible=showR;
  if(showR){const cnt=part==='rain'?RN:110;rainGeo.setDrawRange(0,cnt*2);const p=rainGeo.attributes.position.array;
    for(let i=0;i<cnt;i++){rain.y[i]-=32*dt;if(rain.y[i]<cy-8){rain.y[i]=cy+Math.random()*20-4;rain.x[i]=cx+(Math.random()-.5)*38;rain.z[i]=cz+(Math.random()-.5)*38;}
      const k=i*6;p[k]=rain.x[i];p[k+1]=rain.y[i];p[k+2]=rain.z[i];p[k+3]=rain.x[i]-.05;p[k+4]=rain.y[i]+.9;p[k+5]=rain.z[i];}
    rainGeo.attributes.position.needsUpdate=true;}
  const showF=(part==='snow'||part==='leaf'||part==='petal')&&!ENV.under;flMesh.visible=showF;
  if(showF){const cnt=part==='snow'?FN:part==='leaf'?110:150,sp=part==='snow'?1.6:part==='leaf'?1.3:.9;
    flMat.color.set(part==='snow'?'#ffffff':part==='leaf'?'#e0752a':'#ffb3d1');flMat.size=part==='snow'?.22:.36;
    flGeo.setDrawRange(0,cnt);const p=flGeo.attributes.position.array,t=performance.now()/1000;
    for(let i=0;i<cnt;i++){fl.y[i]-=sp*dt;if(fl.y[i]<cy-8){fl.y[i]=cy+Math.random()*16-2;fl.x[i]=cx+(Math.random()-.5)*34;fl.z[i]=cz+(Math.random()-.5)*34;}
      p[i*3]=fl.x[i]+Math.sin(t*.8+fl.ph[i])*.6;p[i*3+1]=fl.y[i];p[i*3+2]=fl.z[i]+Math.cos(t*.7+fl.ph[i])*.6;}
    flGeo.attributes.position.needsUpdate=true;}
}

/* ---------- ฤดูกาล ---------- */
function applySeason(i){
  seasonIdx=i;const s=SEASONS[i];
  M.leaf.color.set(s.leaf);
  waterMat.color.set(s.water);
  _g.set(s.grass);
  for(let k=0;k<grass.count;k++)grass.setColorAt(k,_c1.copy(_g).multiplyScalar(grassBase[k]));
  grass.instanceColor.needsUpdate=true;
  flowers.visible=(i===4||i===0);
  cloudM.color.set(i===1||i===5?0x8d98a3:0xffffff);
  terrainSync();
}

/* ---------- แสงสี กลางวัน-กลางคืน ---------- */
const ENV={under:false,depth:0,dl:1,lightR:0,sheltered:false};
const SKY=document.getElementById('sky');
const _top=new THREE.Color(),_hor=new THREE.Color(),_n1=new THREE.Color('#070d24'),_n2=new THREE.Color('#1c2748'),_dusk=new THREE.Color('#ff8a50'),_wc=new THREE.Color(),_blk=new THREE.Color(0,0,0);
const css=c=>`rgb(${(c.r*255)|0},${(c.g*255)|0},${(c.b*255)|0})`;
function updateEnv(dt,time){
  const t=S.tod,night=t>=300,ph=(night?t-300:t)/300,elev=Math.sin(ph*Math.PI),az=ph*Math.PI;
  const sv=new THREE.Vector3(Math.cos(az)*.9,Math.sin(az),.35).normalize();
  const dayF=night?0:clamp(elev*4,0,1),moonF=night?clamp(elev*3,0,1):0;
  ENV.dl=dayF;
  const s=SEASONS[seasonIdx];
  _top.set(s.top);_hor.set(s.hor);
  _top.lerp(_n1,1-dayF);_hor.lerp(_n2,1-dayF);
  if(!night){const tw=(1-clamp(elev/.3,0,1))*.65;_hor.lerp(_dusk,tw);}
  const cp=camera.position;
  ENV.depth=Math.max(0,-cp.y);ENV.under=cp.y<-.05;
  let hi=.12+.6*dayF+.12*moonF,si=dayF*1.0+moonF*.28;
  const above=!ENV.under;
  if(above){
    scene.fog.color.copy(_hor);scene.fog.near=60;scene.fog.far=s.fog*(night?.8:1);
    SKY.style.background=`linear-gradient(${css(_top)} 0%,${css(_hor)} 62%)`;
  }else{
    const k=1-Math.exp(-ENV.depth/20),lit=.12+.88*dayF+.15*moonF;
    _wc.set(s.water).multiplyScalar(lit).lerp(_blk,k);
    scene.fog.color.copy(_wc);scene.fog.near=.5;scene.fog.far=lerp(80,7,k)+ENV.lightR*1.8;
    SKY.style.background=css(_wc);
    hi*=Math.exp(-ENV.depth/30)+.04;si*=Math.exp(-ENV.depth/12);
  }
  hemi.intensity=hi;hemi.color.copy(night?_n2:_hor).lerp(new THREE.Color(1,1,1),.5);
  sun.intensity=si;sun.color.set(night?0x9fb4ff:0xfff2d0).lerp(_dusk,night?0:(1-clamp(elev/.35,0,1))*.5);
  const ctr=P.pos||camera.position;
  sun.position.set(ctr.x+sv.x*120,ctr.y+Math.max(sv.y,.15)*120,ctr.z+sv.z*120);sun.target.position.set(ctr.x,ctr.y,ctr.z);
  sunM.position.copy(cp).addScaledVector(sv,600);moonM.position.copy(cp).addScaledVector(sv,600);
  sunM.visible=!night&&above;moonM.visible=night&&above;
  stars.material.opacity=above?(1-dayF)*.9*(s.part==='rain'||s.part==='fish'?.3:1):0;stars.position.copy(cp);
  clouds.forEach(c=>{c.position.x+=dt*2.2;if(c.position.x>cp.x+450)c.position.x-=900;});
  cloudM.opacity=above?.92:0;cloudM.color.multiplyScalar(1);
  // กองไฟ
  const fl=.85+Math.sin(time*13)*.12+Math.sin(time*7.3)*.1;
  flame.scale.set(1,fl,1);flame.rotation.y=time*2;fireLight.intensity=1.1*fl*(1-dayF*.7);
  // ออโรร่า
  AUR.a+=((AUR.on&&night&&above?1:0)-AUR.a)*Math.min(1,dt*.6);updateAurora(time);
  // น้ำ / ฟอง / วงน้ำ
  updateWater(time);
  const sw=Math.sin(time*1.3);foam.material.opacity=.38+.22*sw;foam.scale.setScalar(1+.012*sw);
  ripples.forEach(r=>{if(r.t>2)return;r.t+=dt;const u=r.t/2;r.m.scale.setScalar(.5+u*4*r.s);r.m.material.opacity=.7*(1-u);if(u>=1)r.m.visible=false;});
  updateWeather(dt);
  // ไฟส่องใต้น้ำ
  lamp.distance=Math.max(1,ENV.lightR*1.7);lamp.intensity=ENV.lightR>0&&ENV.under?1.5:0;
}

/* ---------- ท่อนไม้ / ต้นไม้ล้ม ---------- */
const LOGS=[],logMeshes=[],FALLING=[];
const logGeo=new THREE.CylinderGeometry(1,1,1,9);
const logMats=[mk(0x6b4423),mk(0xd9b27a),mk(0xd9b27a)];
function addLog(pos,quat,len,r){
  const m=new THREE.Mesh(logGeo,logMats);m.scale.set(r,len,r);m.position.copy(pos);m.quaternion.copy(quat);m.castShadow=m.receiveShadow=true;scene.add(m);
  const e={mesh:m,len,r};m.userData.log=e;LOGS.push(e);logMeshes.push(m);SHELTER.push(m);return e;
}
function removeLog(e){scene.remove(e.mesh);let i=LOGS.indexOf(e);if(i>=0)LOGS.splice(i,1);i=logMeshes.indexOf(e.mesh);if(i>=0)logMeshes.splice(i,1);i=SHELTER.indexOf(e.mesh);if(i>=0)SHELTER.splice(i,1);}
const _up=new THREE.Vector3(0,1,0);
function cutTree(t,hitY,fromX,fromZ){
  let h=clamp(hitY-t.gy,.4,t.H-.25);const len=t.H-h;if(len<.3)return false;
  const r=t.r*(1-.25*(h/t.H0));
  t.H=h;t.trunk.scale.y=h;
  const can=t.canopy;t.canopy=null;if(can)scene.remove(can);
  let dx=t.x-fromX,dz=t.z-fromZ;const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
  const g=new THREE.Group();g.position.set(t.x,t.gy+h,t.z);
  const lm=new THREE.Mesh(logGeo,logMats);lm.scale.set(r,len,r);lm.position.y=len/2;lm.castShadow=true;g.add(lm);
  if(can){can.position.set(0,len,0);g.add(can);}
  scene.add(g);
  FALLING.push({g,len,r,dx,dz,t:0,can});
  return true;
}
function updateFalling(dt){
  for(let i=FALLING.length-1;i>=0;i--){const f=FALLING[i];f.t+=dt;const u=Math.min(1,f.t/1.3),th=Math.PI/2*u*u;
    f.g.quaternion.setFromAxisAngle(new THREE.Vector3(f.dz,0,-f.dx),th);
    if(u>=1){
      const base=f.g.position,c=new THREE.Vector3(base.x+f.dx*f.len/2,0,base.z+f.dz*f.len/2);c.y=groundY(c.x,c.z)+f.r*.9;
      const q=new THREE.Quaternion().setFromUnitVectors(_up,new THREE.Vector3(f.dx,0,f.dz));
      addLog(c,q,f.len,f.r);scene.remove(f.g);FALLING.splice(i,1);
      ripple(c.x,c.z,.1);
    }}
}
function cutLog(e,worldPoint){
  const lp=e.mesh.worldToLocal(worldPoint.clone());const t=clamp((lp.y+.5)*e.len,0,e.len);
  if(t<.15||e.len-t<.15)return false;
  const q=e.mesh.quaternion.clone(),axis=_up.clone().applyQuaternion(q),start=e.mesh.position.clone().addScaledVector(axis,-e.len/2);
  removeLog(e);
  addLog(start.clone().addScaledVector(axis,t/2-.03),q,t-.06,e.r);
  addLog(start.clone().addScaledVector(axis,t+(e.len-t)/2+.03),q,e.len-t-.06,e.r);
  return true;
}
/* ชนกับสิ่งก่อสร้าง */
function collide(p,rad){
  for(const c of colliders){const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),m=c.r+rad;if(d<m&&d>1e-4){p.x=c.x+dx/d*m;p.z=c.z+dz/d*m;}}
  for(const t of TREES){if(t.H<.7)continue;const dx=p.x-t.x,dz=p.z-t.z,d=Math.hypot(dx,dz),m=t.r+rad;if(d<m&&d>1e-4){p.x=t.x+dx/d*m;p.z=t.z+dz/d*m;}}
  for(const b of BOXES){const cx=clamp(p.x,b.x0,b.x1),cz=clamp(p.z,b.z0,b.z1),dx=p.x-cx,dz=p.z-cz,d=Math.hypot(dx,dz);
    if(d<rad){if(d>1e-4){p.x=cx+dx/d*rad;p.z=cz+dz/d*rad;}else{p.x+= (p.x<(b.x0+b.x1)/2?-1:1)*rad;}}}
  for(const e of LOGS){
    const axis=_up.clone().applyQuaternion(e.mesh.quaternion),c=e.mesh.position,hl=e.len/2;
    const ax=axis.x*hl,az=axis.z*hl,ay=axis.y*hl;
    const yMin=Math.min(c.y-Math.abs(ay),c.y+Math.abs(ay))-e.r,yMax=Math.max(c.y+Math.abs(ay),c.y-Math.abs(ay))+e.r;
    if(p.y+1.6<yMin||p.y>yMax-.25)continue;
    const sx=c.x-ax,sz=c.z-az,vx=2*ax,vz=2*az,L2=vx*vx+vz*vz;
    let u=L2>1e-6?((p.x-sx)*vx+(p.z-sz)*vz)/L2:0;u=clamp(u,0,1);
    const px=sx+vx*u,pz=sz+vz*u,dx=p.x-px,dz=p.z-pz,d=Math.hypot(dx,dz),m=e.r+rad;
    if(d<m){if(d>1e-4){p.x=px+dx/d*m;p.z=pz+dz/d*m;}else{p.x+=m;}}
  }
}
/* ---------- เซฟโลก ---------- */
function exportWorld(){
  const dig=[];for(let k=0;k<grid.length;k++){const d=grid[k]-base0[k];if(Math.abs(d)>.01)dig.push([k,Math.round(d*100)/100]);}
  const f=n=>+n.toFixed(3);
  return{trees:TREES.map(t=>[+t.H.toFixed(2),t.canopy?1:0]),logs:LOGS.map(l=>{const p=l.mesh.position,q=l.mesh.quaternion;return[f(p.x),f(p.y),f(p.z),f(q.x),f(q.y),f(q.z),f(q.w),f(l.len),f(l.r)];}),dig};
}
function importWorld(w){
  if(w.trees)w.trees.forEach((a,i)=>{const t=TREES[i];if(!t)return;t.H=a[0];t.trunk.scale.y=t.H;if(!a[1]&&t.canopy){scene.remove(t.canopy);t.canopy=null;}});
  if(w.logs){[...LOGS].forEach(removeLog);w.logs.forEach(a=>addLog(new THREE.Vector3(a[0],a[1],a[2]),new THREE.Quaternion(a[3],a[4],a[5],a[6]),a[7],a[8]));}
  grid.set(base0);if(w.dig)w.dig.forEach(a=>{grid[a[0]]=base0[a[0]]+a[1];});
  terrainSync();
}
function resetWorld(){
  TREES.forEach(t=>{t.H=t.H0;t.trunk.scale.y=t.H0;if(!t.canopy){const can=new THREE.Group();can.position.set(t.x,t.gy+t.H0,t.z);
    for(const[ox,oy,oz,sc]of[[0,.9,0,1.9],[.8,.1,.4,1.5],[-.7,.2,-.5,1.4]]){const m=new THREE.Mesh(lg,M.leaf);m.scale.set(sc,sc*.8,sc);m.position.set(ox,oy,oz);m.castShadow=true;can.add(m);}scene.add(can);t.canopy=can;}});
  [...LOGS].forEach(removeLog);grid.set(base0);terrainSync();
}
terrainSync();applySeason(0);
