'use strict';
/* ===== สัตว์อันตราย: จระเข้ 🐊 (น้ำตื้น/ริมหาด) + ฉลาม 🦈 (น้ำลึก) ===== */
const CRE={ready:false,pw:false,deep:false,wC:0,wS:0,crocs:[],sharks:[]};
const SPDMG={sp0:1,sp1:2,sp2:4,sp3:8};
const CROC_MAXD=4.5,SHARK_MIND=5;   // จระเข้อยู่น้ำลึกไม่เกิน 4.5 m / ฉลามอยู่น้ำลึกตั้งแต่ 5 m ขึ้นไป

/* จอแดงเวลาโดนกัด */
const hurtEl=document.createElement('div');
hurtEl.style.cssText='position:fixed;inset:0;z-index:9;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 35%,rgba(200,0,0,.7) 100%)';
document.body.appendChild(hurtEl);
function biteP(dmg,msg){
  S.hp-=dmg;hurtEl.style.transition='none';hurtEl.style.opacity='1';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{hurtEl.style.transition='opacity .7s';hurtEl.style.opacity='0';}));
  if(msg)toast(msg,1800);
}

/* ---------- โมเดล ---------- */
function buildCroc(){
  const g=new THREE.Group(),skin=mk(0x4d5d2c),dark=mk(0x36421f),belly=mk(0xc2b983);
  const add=(geo,mat,x,y,z,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;(par||g).add(m);return m;};
  add(new THREE.BoxGeometry(.5,.15,.22),skin,0,0,0);
  add(new THREE.BoxGeometry(.46,.05,.18),belly,0,-.07,0);
  add(new THREE.BoxGeometry(.18,.1,.2),dark,.26,.01,0);
  add(new THREE.BoxGeometry(.3,.07,.13),skin,.38,-.02,0);
  add(new THREE.BoxGeometry(.26,.04,.12),belly,.37,-.065,0);
  for(const z of[-.06,.06]){add(new THREE.SphereGeometry(.04,6,5),dark,.25,.075,z);add(_eyeG,new THREE.MeshBasicMaterial({color:0xffd23a}),.27,.09,z*1.05);}
  for(let i=0;i<6;i++)for(const z of[-.045,.045])add(new THREE.BoxGeometry(.04,.035,.05),dark,.17-i*.1,.09,z);
  for(const sx of[.13,-.16])for(const sz of[-1,1]){const l=add(new THREE.BoxGeometry(.1,.07,.06),dark,sx,-.07,sz*.15);l.rotation.y=sz*.5;}
  const tp=new THREE.Group();tp.position.set(-.25,0,0);g.add(tp);
  add(new THREE.BoxGeometry(.3,.1,.17),skin,-.15,0,0,tp);
  const tp2=new THREE.Group();tp2.position.set(-.3,0,0);tp.add(tp2);
  add(new THREE.BoxGeometry(.28,.07,.11),skin,-.14,0,0,tp2);
  add(new THREE.BoxGeometry(.2,.04,.07),dark,-.38,0,0,tp2);
  g.userData.tail=tp;g.userData.tail2=tp2;return g;
}
function buildShark(){
  const g=new THREE.Group(),gray=mkp(0x6f7f8c,20),white=mkp(0xeef3f6,10);
  const add=(geo,mat,x,y,z,par)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;(par||g).add(m);return m;};
  add(_sphG,gray,0,0,0).scale.set(1,.21,.2);
  add(_sphG,white,.02,-.04,0).scale.set(.9,.12,.17);
  add(new THREE.ConeGeometry(.1,.3,8).rotateZ(-Math.PI/2),gray,.5,0,0).scale.set(1,.7,.7);
  const fin=add(new THREE.ConeGeometry(.08,.26,4),gray,.05,.14,0);fin.rotation.z=.35;fin.scale.set(1,1,.45);
  for(const z of[-1,1]){const p=add(new THREE.ConeGeometry(.06,.22,4),gray,.18,-.07,z*.14);p.rotation.set(z*1.1,0,1.3);p.scale.set(1,1,.35);}
  for(const z of[-.07,.07])add(_eyeG,_eyeM,.38,.04,z);
  const tp=new THREE.Group();tp.position.set(-.5,0,0);g.add(tp);
  add(new THREE.ConeGeometry(.1,.34,4).rotateZ(-Math.PI/2),gray,-.12,0,0,tp).scale.set(1,2.6,.3);
  g.userData.tail=tp;return g;
}

/* ---------- ตัวช่วยเคลื่อนที่ ---------- */
const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
function steer(c,tx,tz,dt,rate){const want=Math.atan2(-(tz-c.z),tx-c.x);c.hd+=clamp(wrapA(want-c.hd),-rate*dt,rate*dt);}
function stepCroc(c,spd,dt){
  const nx=c.x+Math.cos(c.hd)*spd*dt,nz=c.z-Math.sin(c.hd)*spd*dt,fd=-gH(nx,nz),land=-gH(c.x,c.z)<=.22;
  if(fd<CROC_MAXD&&(fd>.22||land)){c.x=nx;c.z=nz;return true;}
  c.hd+=(Math.random()<.5?1:-1)*(1.2+Math.random());return false;
}
function stepShark(s,spd,dt){
  const nx=s.x+Math.cos(s.hd)*spd*dt,nz=s.z-Math.sin(s.hd)*spd*dt;
  if(-gH(nx,nz)>=SHARK_MIND-.5&&Math.hypot(nx,nz)<200){s.x=nx;s.z=nz;return true;}
  steer(s,s.x*2,s.z*2,dt,3);return false;
}
function inWaterNow(){return pierY(P.x,P.z)<-50&&(P.swim||gH(P.x,P.z)<-.35);}

/* ---------- สร้างสัตว์ ---------- */
function newShark(){
  for(let t=0;t<30;t++){
    const a=Math.random()*6.28,r=66+Math.random()*70,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(-gH(x,z)<SHARK_MIND+1)continue;
    const len=3.2+Math.random()*1.8,m=buildShark();m.scale.setScalar(len);scene.add(m);
    return{kind:'shark',m,len,x,z,y:-2.5,hd:Math.random()*6.28,st:'patrol',t:0,cd:0,fl:0,ig:0,lost:0,retreat:0,hp:12,max:12,dead:0,ph:Math.random()*6,reward:600};
  }
  return null;
}
function initCreatures(){
  CRE.ready=true;
  [1.55,3.25,4.75].forEach((a,i)=>{
    const k=Math.round(a/(Math.PI*2)*160)%161,rs=shoreR[k],ca=Math.cos(a),sa=Math.sin(a);
    let r=rs-1.6;while(gH(ca*r,sa*r)<.12&&r>rs-6)r-=.4;
    const len=3+i*.45,m=buildCroc();m.scale.setScalar(len/1.56);scene.add(m);
    CRE.crocs.push({kind:'croc',m,len,a,hx:ca*r,hz:sa*r,x:ca*r,z:sa*r,y:0,hd:-a,st:'bask',t:25+Math.random()*50,tm:0,cd:0,fl:0,ig:0,lost:0,hp:8,max:8,dead:0,ph:Math.random()*6,reward:250});
  });
  for(let i=0;i<3;i++){const s=newShark();if(s)CRE.sharks.push(s);}
}

/* ---------- ถูกฉมวกแทง ---------- */
function killC(c){
  S.coins+=c.reward;markDirty();
  toast((c.kind==='croc'?'🐊 ล่าจระเข้สำเร็จ!':'🦈 ล่าฉลามสำเร็จ!')+' +🪙'+fmtN(c.reward),3000);
  c.st='dead';c.dead=70+Math.random()*50;c.m.visible=false;
}
function creatureStab(sp,eye,dir){
  let best=null,bd=1e9;
  for(const c of[...CRE.crocs,...CRE.sharks]){
    if(c.st==='dead')continue;
    const vx=c.x-eye.x,vy=c.y-eye.y,vz=c.z-eye.z,d=Math.hypot(vx,vy,vz);
    if(d<.001||d>sp.reach+c.len*.5)continue;
    if((vx*dir.x+vy*dir.y+vz*dir.z)/d<.8)continue;
    if(d<bd){bd=d;best=c;}
  }
  if(!best)return false;
  best.hp-=SPDMG[sp.id]||1;
  if(best.hp<=0)killC(best);
  else{best.st='flee';best.fl=best.kind==='shark'?6:5;best.ig=4;toast('แทงโดน! '+(best.kind==='croc'?'🐊':'🦈')+' เหลือเลือด '+best.hp+'/'+best.max,1500);}
  return true;
}

/* ---------- จระเข้ ---------- */
function updCroc(c,dt,time){
  if(c.st==='dead'){c.dead-=dt;if(c.dead<=0){c.st='bask';c.hp=c.max;c.x=c.hx;c.z=c.hz;c.hd=-c.a;c.t=40+Math.random()*40;c.m.visible=true;}return;}
  c.cd-=dt;c.ig-=dt;
  const dxp=P.x-c.x,dzp=P.z-c.z,dp=Math.hypot(dxp,dzp),fd=-gH(c.x,c.z),onLand=fd<=.22;
  if(CRE.pw&&dp<48&&c.ig<=0&&c.st!=='hunt'&&c.st!=='flee'){
    c.st='hunt';c.lost=0;
    if(CRE.wC<=0){toast('🐊 จระเข้เห็นคุณแล้ว! รีบขึ้นจากน้ำ!',2200);CRE.wC=10;}
  }
  let moving=false;
  switch(c.st){
    case 'bask':{
      c.t-=dt;
      if(!CRE.pw){
        if(dp<2.4+c.len*.25&&c.cd<=0){biteP(12,'🐊 จระเข้งับ! (-12)');c.cd=3;c.st='patrol';c.t=25;c.ig=3;}
        else if(dp<6&&CRE.wC<=0){toast('🐊 จระเข้นอนอาบแดดอยู่ใกล้ ๆ ระวัง!',1800);CRE.wC=12;}
      }
      if(c.t<=0){c.st='patrol';c.t=30+Math.random()*40;}
      break;}
    case 'patrol':{
      c.t-=dt;c.tm-=dt;if(c.tm<=0){c.hd+=(Math.random()-.5)*2;c.tm=2+Math.random()*3;}
      if(Math.hypot(c.x-c.hx,c.z-c.hz)>28)steer(c,c.hx,c.hz,dt,2);
      moving=stepCroc(c,onLand?1.6:1.3,dt);
      if(c.t<=0)c.st='return';
      break;}
    case 'return':{
      steer(c,c.hx,c.hz,dt,2);moving=stepCroc(c,onLand?1.8:2.2,dt);
      if(Math.hypot(c.x-c.hx,c.z-c.hz)<1.3){c.st='bask';c.t=40+Math.random()*50;c.hd=-c.a;}
      break;}
    case 'hunt':{
      if(!CRE.pw){c.lost+=dt;if(c.lost>5){c.st='patrol';c.t=30;}}else c.lost=0;
      steer(c,P.x,P.z,dt,4.5);
      moving=stepCroc(c,onLand?3:(dp<6?6:4.6),dt);
      if(dp<1.6+c.len*.45&&c.cd<=0&&CRE.pw&&Math.abs((P.y+.8)-c.y)<2.4){biteP(18,'🐊 จระเข้งับ! (-18)');c.cd=1.6;}
      break;}
    case 'flee':{
      c.fl-=dt;steer(c,c.x+(c.x-P.x)*3,c.z+(c.z-P.z)*3,dt,4);moving=stepCroc(c,onLand?3:5,dt);
      if(c.fl<=0){c.st='patrol';c.t=30;}
      break;}
  }
  const nfd=-gH(c.x,c.z),nLand=nfd<=.22;
  c.y=nLand?gH(c.x,c.z)+.17:Math.max(-.1+Math.sin(time*1.5+c.ph)*.04,-nfd+.2);
  const wag=moving?9:1.2,amp=moving?.5:.12;
  c.m.userData.tail.rotation.y=Math.sin(time*wag+c.ph)*amp;c.m.userData.tail2.rotation.y=Math.sin(time*wag+c.ph-1)*amp*1.2;
  const br=c.st==='bask'?1+Math.sin(time*1.4+c.ph)*.012:1;
  c.m.scale.setScalar(c.len/1.56*br);
  c.m.position.set(c.x,c.y,c.z);c.m.rotation.y=c.hd;
}

/* ---------- ฉลาม ---------- */
function updShark(s,dt,time){
  if(s.st==='dead'){s.dead-=dt;if(s.dead<=0){const n=newShark();if(n){scene.remove(s.m);Object.assign(s,n);}else s.dead=10;}return;}
  s.cd-=dt;s.ig-=dt;
  const fd=Math.max(-gH(s.x,s.z),1),dxp=P.x-s.x,dzp=P.z-s.z,dp=Math.hypot(dxp,dzp);
  if(CRE.deep&&dp<160&&s.ig<=0&&s.st==='patrol'){
    s.st='hunt';s.lost=0;
    if(CRE.wS<=0){toast('🦈 ฉลามกำลังมา! รีบว่ายกลับเข้าฝั่ง!',2500);CRE.wS=12;}
  }
  let spd=2.4,ty=-2.2+Math.sin(time*.5+s.ph)*.6,pitchK=1;
  switch(s.st){
    case 'patrol':{
      s.t-=dt;if(s.t<=0){s.hd+=(Math.random()-.5)*1.6;s.t=2+Math.random()*4;}
      const r=Math.hypot(s.x,s.z);
      if(r<62||fd<SHARK_MIND+.5)steer(s,s.x*2,s.z*2,dt,1.5);else if(r>150)steer(s,0,0,dt,1.5);
      stepShark(s,spd,dt);break;}
    case 'hunt':{
      if(!CRE.deep){s.lost+=dt;if(s.lost>3){s.st='patrol';s.ig=3;}}else s.lost=0;
      steer(s,P.x,P.z,dt,3.2);spd=dp<10?7.6:6.4;stepShark(s,spd,dt);
      ty=clamp(P.y+.9,-(fd-.6),-.3);
      const dy=(P.y+.9)-s.y,d3=Math.hypot(dxp,dzp,dy);
      if(d3<1.8+s.len*.35&&s.cd<=0&&CRE.pw){biteP(30,'🦈 ฉลามงับ! (-30)');s.cd=2.2;s.st='retreat';s.retreat=2.6;}
      break;}
    case 'retreat':{
      s.retreat-=dt;steer(s,s.x+(s.x-P.x)*3,s.z+(s.z-P.z)*3,dt,3);spd=7;stepShark(s,spd,dt);ty=-3;
      if(s.retreat<=0)s.st=CRE.deep?'hunt':'patrol';
      break;}
    case 'flee':{
      s.fl-=dt;steer(s,s.x+(s.x-P.x)*3,s.z+(s.z-P.z)*3,dt,4);spd=8;stepShark(s,spd,dt);ty=-5;
      if(s.fl<=0)s.st='patrol';
      break;}
  }
  ty=Math.min(ty,-.3);ty=Math.max(ty,-(fd-.6));
  const oy=s.y;s.y+=(ty-s.y)*Math.min(1,dt*2);
  s.m.userData.tail.rotation.y=Math.sin(time*(3+spd*1.1)+s.ph)*.5;
  s.m.position.set(s.x,s.y,s.z);s.m.rotation.y=s.hd;
  s.m.rotation.z=clamp((s.y-oy)/Math.max(dt,.001)*.12,-.4,.4)*pitchK;
}

/* ---------- ลูปหลัก ---------- */
function updateCreatures(dt,time){
  if(!CRE.ready)initCreatures();
  CRE.wC-=dt;CRE.wS-=dt;
  CRE.pw=inWaterNow();
  CRE.deep=CRE.pw&&-gH(P.x,P.z)>=SHARK_MIND;
  for(const c of CRE.crocs)updCroc(c,dt,time);
  for(const s of CRE.sharks)updShark(s,dt,time);
}
