'use strict';
/* ===== ระบบเกม: ผู้เล่น ตกปลา แทงปลา ตัดไม้ สร้าง เอาชีวิตรอด ===== */
const V3=THREE.Vector3;
const P={x:0,y:0,z:0,vy:0,swim:false,under:false,o2:25,grounded:true,walkT:0,atk:0,atkKind:'',carry:null,moving:false};
const ctl={yaw:Math.PI/2,pitch:-.1};
const inp={mx:0,mz:0,act:false,up:false,down:false};
const G={paused:false,started:false,gYaw:0,gMode:0,gOff:0,shovel:'dig',shelT:0,hudT:0,rainT:0,saveT:0,msgPressureT:0,time:0};
const human=makeHuman({shirt:0x2f7fd0,pants:0x3a3a4a,skin:0xf0c49a,hair:0x3a2414});
scene.add(human.g);
const held=new THREE.Group();let heldObj=null,rodObj=null,heldKey='',mountFP=null;
const ray=new THREE.Raycaster(),V2c=new THREE.Vector2(0,0);

/* ---------- ถือไอเทม ---------- */
function toolList(){const a=['hand'];if(S.eq.spear)a.push('spear');if(S.eq.rod)a.push('rod');if(S.owned.axe)a.push('axe');if(S.owned.shovel)a.push('shovel');return a;}
const TOOL_BASE={rod:.55,spear:.3,axe:.8,shovel:.5,hand:0};
function refreshHeld(){
  if(!toolList().includes(S.tool))S.tool='hand';
  const key=S.tool+(S.tool==='rod'?S.eq.rod:S.tool==='spear'?S.eq.spear:'');
  if(key===heldKey)return;heldKey=key;
  if(heldObj){held.remove(heldObj);heldObj=null;}rodObj=null;
  if(S.tool==='rod'){rodObj=buildRod(ITEMS[S.eq.rod]);heldObj=rodObj.group;}
  else if(S.tool==='spear')heldObj=buildTool('spear',ITEMS[S.eq.spear]);
  else if(S.tool==='axe')heldObj=buildTool('axe');
  else if(S.tool==='shovel')heldObj=buildTool('shovel');
  if(heldObj)held.add(heldObj);
  held.rotation.set(TOOL_BASE[S.tool]||0,0,0);
  if(window.renderHotbar)renderHotbar();
}
function mountHeld(){
  const fp=S.set.cam==='fp'&&FS.state==='idle';
  if(fp&&mountFP!==true){camera.add(held);held.position.set(.3,-.3,-.45);mountFP=true;}
  else if(!fp&&mountFP!==false){human.armR.add(held);held.position.set(0,-.72,-.05);mountFP=false;}
  human.g.visible=!fp;
}
function setTool(id){
  if(FS.state!=='idle'){toast('กำลังตกปลาอยู่');return;}
  if(P.carry){toast('วางท่อนไม้ก่อน');return;}
  if(!toolList().includes(id))return;S.tool=id;refreshHeld();markDirty();
}

/* ---------- ปลาที่ว่ายอยู่ (ไว้แทง + ฉากหลัง) ---------- */
const LIVE=[];
function liveCenter(){return FS.state!=='idle'&&FS.state!=='fly'&&FS.state!=='retrieve'?FS.hook:P;}
function spawnLive(){
  const c=liveCenter(),hookMode=c===FS.hook;
  for(let n=0;n<8;n++){
    const a=Math.random()*6.28,r=6+Math.random()*30,x=c.x+Math.cos(a)*r,z=c.z+Math.sin(a)*r,fd=-gH(x,z);
    if(fd<1.3||Math.hypot(x,z)>195)continue;
    const maxD=hookMode?Math.max(FS.depth+3,8):22,d=.5+Math.pow(Math.random(),1.6)*Math.min(fd-.7,maxD);
    const dist=Math.hypot(x-P.x,z-P.z),sp=rollFish(dist,d,0,false),w=rollWeight(sp),len=fishLen(sp,w);
    if(len>22&&!hookMode&&Math.random()<.9)continue;
    const mesh=buildFish(sp);mesh.scale.setScalar(Math.max(len,.01));mesh.position.set(x,-d,z);scene.add(mesh);
    LIVE.push({mesh,sp,w,len,x,y:-d,z,hd:Math.random()*6.28,t:Math.random()*3,flee:0,spd:(.4+Math.random()*.8)*Math.pow(Math.max(len,.1),.35),ph:Math.random()*6});return;}
}
function updateLive(dt,time){
  const c=liveCenter(),want=S.set.gfx===1?12:18;
  for(let i=LIVE.length-1;i>=0;i--){const f=LIVE[i];
    if(Math.hypot(f.x-c.x,f.z-c.z)>75){scene.remove(f.mesh);LIVE.splice(i,1);continue;}
    f.t-=dt;if(f.t<=0){f.hd+=(Math.random()-.5)*2.2;f.t=1.5+Math.random()*3.5;}
    if(FS.state==='idle'||FS.state==='fly'){const dx=f.x-P.x,dz=f.z-P.z,dd=Math.hypot(dx,dz),dy=f.y-(P.y+1);
      if(dd<3.5+f.len&&Math.abs(dy)<4&&S.tool==='spear'){f.flee=1.4;f.hd=Math.atan2(-dz,dx);}}
    f.flee-=dt;const sp=f.flee>0?f.spd*3.2:f.spd;
    const nx=f.x+Math.cos(f.hd)*sp*dt,nz=f.z-Math.sin(f.hd)*sp*dt,fd=-gH(nx,nz);
    if(fd<-f.y+.5||Math.hypot(nx,nz)>195){f.hd+=Math.PI*.8;f.t=1;}else{f.x=nx;f.z=nz;}
    f.y=clamp(f.y+Math.sin(time*.8+f.ph)*.15*dt,-(Math.max(fd,1)-.4),-.35);
    f.mesh.position.set(f.x,f.y,f.z);f.mesh.rotation.y=f.hd;
    f.mesh.userData.tail.rotation.y=Math.sin(time*(6+sp*2)+f.ph)*.55;}
  if(LIVE.length<want)spawnLive();
}
function clearLive(){LIVE.forEach(f=>scene.remove(f.mesh));LIVE.length=0;}

/* ---------- กระเป๋า ---------- */
function bagCap(){return BAGS[S.bag].cap;}
function addFish(sp,w){
  if(S.fish.length>=bagCap())return false;
  S.fish.push({id:sp.id,w:+w.toFixed(5)});
  const d=S.dex[sp.id]||(S.dex[sp.id]={n:0,best:0});d.n++;if(w>d.best)d.best=w;
  markDirty();if(window.refreshPanel)refreshPanel();return true;
}

/* ---------- ตกปลา ---------- */
const FS={state:'idle',power:0,charging:false,t:0,dur:1,dist:0,depth:0,start:new V3(),target:new V3(),hook:new V3(),waitT:0,sp:null,w:0,len:1,fm:null,fa:0,p:30,tens:0,pull:false,pullT:1,camD:3.6,bend:0,biteT:0,rho:0,cap:1,landT:0,doom:false,fx:0};
const hookObj=new THREE.Group();
{const s=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),new THREE.MeshBasicMaterial({color:0xffffff}));hookObj.add(s);hookObj.userData.s=s;
 const t=new THREE.Mesh(new THREE.TorusGeometry(.07,.015,5,8,4.5),new THREE.MeshBasicMaterial({color:0xcccccc}));t.position.y=-.1;hookObj.add(t);hookObj.visible=false;scene.add(hookObj);}
const LN=14,lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(LN*3),3));
const lineMesh=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.85}));lineMesh.frustumCulled=false;lineMesh.visible=false;scene.add(lineMesh);
function rodTipPos(v){if(rodObj){rodObj.tip.updateWorldMatrix(true,false);rodObj.tip.getWorldPosition(v);}else v.set(P.x,P.y+1.6,P.z);return v;}
function eqRod(){return ITEMS[S.eq.rod];}
function baitDef(){return S.eq.bait&&S.baits[S.eq.bait]>0?ITEMS[S.eq.bait]:null;}
function fishStartCharge(){
  if(S.fish.length>=bagCap()){toast('กระเป๋าเต็ม! ไปขายปลาที่ร้านก่อน');return;}
  FS.charging=true;FS.power=0;FS.state='charge';
}
function fishRelease(){
  if(!FS.charging)return;FS.charging=false;
  const rod=eqRod(),line=ITEMS[S.eq.line||'line0'],power=Math.max(.05,FS.power);
  const dist=rod.dist*(.25+.75*power),dx=-Math.sin(ctl.yaw),dz=-Math.cos(ctl.yaw),tx=P.x+dx*dist,tz=P.z+dz*dist,fd=-gH(tx,tz);
  if(fd<1.6){toast('ตรงนั้นตื้นเกินไป โยนให้ไกลหรือหันไปทางทะเล');FS.state='idle';hudFish({show:false});return;}
  rodTipPos(FS.start);FS.target.set(tx,0,tz);FS.dist=dist;FS.depth=Math.max(1,Math.min(line.len,fd-.5));
  FS.dur=.5+dist/55;FS.t=0;FS.state='fly';FS.hook.copy(FS.start);FS.camD=3.6;ctl.pitch=-.22;FS.bend=0;
  hookObj.visible=true;lineMesh.visible=true;mountHeld();P.atk=.5;P.atkKind='cast';
  const h=ITEMS[S.eq.hook||'hook0'];hookObj.userData.s.material.color.set(h.col);
}
function fishRetrieve(msg){
  if(msg)toast(msg);
  if(FS.fm){scene.remove(FS.fm);FS.fm=null;}
  FS.state='retrieve';FS.t=0;FS.start.copy(FS.hook);FS.bend=0;
}
function fishEnd(){
  FS.state='idle';hookObj.visible=false;lineMesh.visible=false;hudFish({show:false});mountHeld();ENV.lightR=0;
}
function startApproach(){
  const hk=ITEMS[S.eq.hook||'hook0'],bd=baitDef(),luck=(bd?bd.luck:0)+hk.luck+Math.min(1,FS.depth/150)*.3;
  FS.sp=rollFish(FS.dist,FS.depth,luck,AUR.a>.5);FS.w=rollWeight(FS.sp);FS.len=Math.max(fishLen(FS.sp,FS.w),.008);
  if(bd){S.baits[bd.id]--;if(S.baits[bd.id]<=0){S.baits[bd.id]=0;S.eq.bait=null;toast('เหยื่อหมดแล้ว');}if(window.refreshPanel)refreshPanel();}
  const m=buildFish(FS.sp);m.scale.setScalar(FS.len);scene.add(m);FS.fm=m;
  const a=Math.random()*6.28,R=FS.len*1.6+9;FS.fx=a;FS.fa=0;
  FS.state='approach';FS.t=0;FS.biteDir=a;FS.R=R;
  const rod=eqRod(),line=ITEMS[S.eq.line||'line0'];FS.cap=Math.min(rod.maxW,line.maxW);FS.rho=FS.w/FS.cap;
}
function startFight(){
  FS.state='fight';FS.p=30;FS.tens=0;FS.pull=false;FS.pullT=1;FS.doom=FS.rho>1.6;FS.fa=Math.random()*6;
  toast(FS.doom?'ปลาตัวใหญ่มาก!! เบ็ดจะไหวไหม!?':'ติดแล้ว! กดค้างเพื่อดึง ปล่อยเมื่อปลากระชาก');
}
function rodBreak(){
  const id=S.eq.rod;S.owned[id]=0;S.eq.rod=null;if(S.tool==='rod')S.tool='hand';heldKey='';refreshHeld();markDirty();
  toast('💥 คันเบ็ดหัก! ต้องไปซื้อใหม่ที่ร้าน',3500);if(FS.fm){scene.remove(FS.fm);FS.fm=null;}fishEnd();
}
function fishAct(){
  switch(FS.state){
    case 'idle':fishStartCharge();break;
    case 'sink':case 'wait':fishRetrieve();break;
    case 'approach':toast('ดึงเร็วไป ปลาตกใจหนี!');if(FS.fm){scene.remove(FS.fm);FS.fm=null;}FS.state='wait';FS.waitT=3+Math.random()*5;break;
    case 'bite':startFight();break;
  }
}
function updateFishing(dt,time){
  const rod=S.eq.rod?eqRod():null;
  if(FS.state==='charge'){FS.power=Math.min(1,FS.power+dt/1.3);hudFish({show:true,txt:'ปล่อยเพื่อโยน',pow:FS.power});if(!inp.act&&FS.charging)fishRelease();return;}
  if(FS.state==='idle')return;
  if(!rod){fishEnd();return;}
  FS.t+=dt;const hk=ITEMS[S.eq.hook||'hook0'];
  ENV.lightR=hk.light;
  let txt='',tens=null,prog=null,alert=false;
  switch(FS.state){
    case 'fly':{const u=Math.min(1,FS.t/FS.dur);FS.hook.x=lerp(FS.start.x,FS.target.x,u);FS.hook.z=lerp(FS.start.z,FS.target.z,u);
      FS.hook.y=lerp(FS.start.y,0,u)+(2+FS.dist*.12)*4*u*(1-u);
      if(u>=1){ripple(FS.hook.x,FS.hook.z,1.2);FS.state='sink';FS.t=0;}txt='กำลังโยน...';break;}
    case 'sink':{FS.hook.y-=Math.min(6,2+FS.t*4)*dt;if(FS.hook.y<=-FS.depth){FS.hook.y=-FS.depth;FS.state='wait';const bd=baitDef();FS.waitT=(3+Math.random()*6)/(bd?bd.speed:.55);}
      txt='เบ็ดจมลง '+Math.abs(FS.hook.y).toFixed(0)+' m (กดเพื่อดึงกลับ)';break;}
    case 'wait':{FS.hook.y=-FS.depth+Math.sin(time*2)*.08;FS.waitT-=dt;txt='รอปลากินเบ็ด... '+(baitDef()?'':'(ไม่มีเหยื่อ จะช้ามาก)');
      if(FS.waitT<=0)startApproach();break;}
    case 'approach':{const u=Math.min(1,FS.t/1.9),R=FS.R*(1-u)+FS.len*.6,a=FS.biteDir;
      const px=FS.hook.x+Math.cos(a)*R,pz=FS.hook.z+Math.sin(a)*R,py=FS.hook.y+Math.sin(u*3)*.3;FS.fm.position.set(px,py,pz);
      FS.fm.rotation.y=Math.atan2(pz-FS.hook.z,-(px-FS.hook.x)*-1)*0+Math.atan2(-(FS.hook.z-pz),FS.hook.x-px);
      FS.fm.userData.tail.rotation.y=Math.sin(time*10)*.5;txt='มีบางอย่างเข้ามา...';
      if(u>=1){FS.state='bite';FS.t=0;}break;}
    case 'bite':{FS.hook.y=-FS.depth+Math.sin(time*40)*.12;FS.fm.position.set(FS.hook.x+FS.len*.5,FS.hook.y,FS.hook.z);
      txt='❗ กดเดี๋ยวนี้! ❗';alert=true;if(FS.t>1.5){toast('ปลาหนีไปแล้ว...');scene.remove(FS.fm);FS.fm=null;FS.state='wait';FS.waitT=3+Math.random()*5;}break;}
        case 'fight':{
      const f=clamp(.6+FS.rho*.9,.6,3), mult=FS.rho>1?1+(FS.rho-1)*2:1, reel=inp.act;
      FS.pullT-=dt;
      if(FS.pullT<=0){
        FS.pull=!FS.pull;
        FS.pullT=FS.pull?.9+Math.random():1.2+Math.random()*2;
        // สลับทิศทางที่ปลาพยายามดึงสายหนี
        FS.fa += (Math.random() - 0.5) * 2.5;
      }
      
      // ให้ปลาว่ายดึงสายเบ็ดไปรอบๆ ตามทิศทางที่มันดิ้น
      const pullForce = FS.pull ? 1.5 : 0.6;
      FS.hook.x += Math.cos(FS.fa) * pullForce * dt * 2;
      FS.hook.z += Math.sin(FS.fa) * pullForce * dt * 2;
      
      let dT,dP;
      if(FS.pull){if(reel){dT=40*f*mult;dP=-4;}else{dT=f*mult*3-10;dP=-6*f;}}
      else{if(reel){dT=14*f*mult;dP=16/(1+FS.rho*1.5);}else{dT=-35;dP=-2;}}
      if(FS.doom)dT+=45;
      
      FS.tens=clamp(FS.tens+dT*dt,0,100);
      FS.p+=dP*dt;
      
      // ให้ตัวปลาขยับว่ายวนรอบตะขอตามแรงดึง
      const rr=lerp(FS.len*1.2+2,FS.len*.25+.5,clamp(FS.p/100,0,1));
      FS.fm.position.set(FS.hook.x+Math.cos(FS.fa)*rr, FS.hook.y+Math.sin(FS.fa*1.7)*rr*.15, FS.hook.z+Math.sin(FS.fa)*rr);
      FS.fm.rotation.y=Math.atan2(-Math.cos(FS.fa),-Math.sin(FS.fa));
      FS.fm.userData.tail.rotation.y=Math.sin(time*(FS.pull?22:9))*.7;
      
      tens=FS.tens; prog=FS.p; alert=FS.pull;
      txt=FS.pull?'⚠️ ปลากระชากสายหนี! ปล่อยปุ่ม!':(reel?'กำลังดึงสายกลับ...':'กดค้างเพื่อดึง');
      
      if(FS.tens>=100){if(FS.rho>1){rodBreak();return;}toast('สายขาด! ปลาหลุดไป',2500);fishRetrieve();break;}
      if(FS.p<=0){toast('ปลาหลุดไปแล้ว...');fishRetrieve();break;}
      if(FS.p>=100){landFish();break;}
      break;}

    case 'landed':{
      // ดึงปลาขึ้นพร้อมกับให้ตัวปลาติดอยู่ที่ตะขอ
      const u = Math.min(1, FS.t / 1.5);
      rodTipPos(_v);
      FS.hook.lerpVectors(FS.start, _v, u);
      if(FS.fm){
        FS.fm.position.copy(FS.hook);
        FS.fm.rotation.y += dt * 6;
      }
      if(FS.t > 1.6){
        fishRetrieve(null, true);
      }
      txt='✨ สำเร็จ! กำลังดึงปลาขึ้นมา...';
      break;
    }

    case 'retrieve':{
      const u=Math.min(1,FS.t/.8);
      rodTipPos(_v);
      FS.hook.lerpVectors(FS.start,_v,u);
      FS.hook.y=Math.max(FS.hook.y,FS.start.y*(1-u)+_v.y*u);
      
      if(FS.fm){
        FS.fm.position.copy(FS.hook);
        FS.fm.rotation.y += dt * 5;
      }

      if(u>=1){
        if(FS.fm){scene.remove(FS.fm);FS.fm=null;}
        fishEnd();
        return;
      }
      txt=FS.fm?'เก็บปลาเข้ากระเป๋า...':'เก็บเบ็ด';
      break;
    }

  hudFish({show:true,txt,tens,prog,alert});
  // งอคัน
  const tgt=FS.state==='fight'?(FS.tens/100)*1.3+(FS.doom?.3:0):(FS.state==='bite'?.35:.05);
  FS.bend+=(tgt-FS.bend)*Math.min(1,dt*8);if(rodObj)rodObj.setBend(FS.bend);
  // กล้องตามตะขอ
  const wantD=(FS.state==='approach'||FS.state==='bite'||FS.state==='fight'||FS.state==='landed')?clamp(FS.len*1.1+3.6,3.6,90):3.6;
  FS.camD+=(wantD-FS.camD)*Math.min(1,dt*2);
  hookObj.position.copy(FS.hook);
  hookObj.userData.s.scale.setScalar(1+.15*Math.sin(time*6));
}
const _v=new V3(),_v2=new V3();
function landFish(){
  const sp=FS.sp,w=FS.w,price=fishPrice(sp,w);
  const ok=addFish(sp,w);showCatch(sp,w,price,ok);
  FS.state='landed';FS.t=0;ripple(FS.hook.x,FS.hook.z,2);
}
function updateLine(){
  if(!lineMesh.visible)return;
  rodTipPos(_v); const a=lineGeo.attributes.position;
  const sag = FS.state==='fight' ? 0.05 : clamp(_v.distanceTo(FS.hook)*.04, .1, 3);
  
  for(let i=0; i<LN; i++){
    const u = i / (LN - 1);
    let lx = lerp(_v.x, FS.hook.x, u);
    let lz = lerp(_v.z, FS.hook.z, u);
    let ly = lerp(_v.y, FS.hook.y, u) - Math.sin(u*Math.PI)*sag;
    
    // ตรวจสอบไม่ให้สายเบ็ดทะลุดิน (ถ้าตำแหน่งต่ำกว่าพื้น ให้แนบไปกับพื้นดิน)
    const groundH = gH(lx, lz);
    if(ly < groundH){
      ly = groundH + 0.04; // ให้ลอยเหนือพื้นดินเล็กน้อย
    }
    
    a.setXYZ(i, lx, ly, lz);
  }
  a.needsUpdate=true;
}


/* ---------- ฉมวก / ขวาน / จอบ ---------- */
function stab(){
  if(P.atk>0)return;P.atk=.4;P.atkKind='stab';
  const sp=ITEMS[S.eq.spear];camera.getWorldPosition(_v);camera.getWorldDirection(_v2);
  const eye=new V3(P.x,P.y+1.5,P.z);let best=null,bd=1e9;
  if(window.creatureStab&&creatureStab(sp,eye,_v2))return;
  for(const f of LIVE){const dv=_v.set(f.x-eye.x,f.y-eye.y,f.z-eye.z),d=dv.length();
    if(d<sp.reach+f.len*.5&&dv.clone().normalize().dot(_v2)>.8&&d<bd){bd=d;best=f;}}
  if(!best)return;
  if(best.w>sp.maxW){toast('ปลาตัวใหญ่เกินกว่า'+sp.nm+'จะแทงได้! ('+fmtW(best.w)+')');best.flee=2;return;}
  if(S.fish.length>=bagCap()){toast('กระเป๋าเต็ม!');return;}
  addFish(best.sp,best.w);showCatch(best.sp,best.w,fishPrice(best.sp,best.w),true);
  scene.remove(best.mesh);LIVE.splice(LIVE.indexOf(best),1);
}
function chop(){
  if(P.atk>0)return;P.atk=.45;P.atkKind='chop';
  camera.getWorldDirection(_v2);ray.setFromCamera(V2c,camera);ray.far=16;
  const hits=ray.intersectObjects([...trunkMeshes,...logMeshes],false);
  for(const h of hits){if(Math.hypot(h.point.x-P.x,h.point.z-P.z)>5.2)continue;
    if(h.object.userData.tree){const t=h.object.userData.tree;if(t.H<.7){toast('ตอไม้เตี้ยเกินตัดต่อ');return;}if(cutTree(t,h.point.y,P.x,P.z))toast('ตัดต้นไม้!');return;}
    if(h.object.userData.log){if(cutLog(h.object.userData.log,h.point))toast('ผ่าท่อนไม้');else toast('ตัดตรงนั้นสั้นเกินไป');return;}}
}
function rayGround(o,d,max){
  for(let s=.3;s<max;s+=.25){const x=o.x+d.x*s,y=o.y+d.y*s,z=o.z+d.z*s;if(y<groundY(x,z))return new V3(x,groundY(x,z),z);}return null;
}
function dig(){
  if(P.atk>0)return;P.atk=.5;P.atkKind='dig';
  camera.getWorldPosition(_v);camera.getWorldDirection(_v2);const hit=rayGround(_v,_v2,16);
  if(!hit||Math.hypot(hit.x-P.x,hit.z-P.z)>6.5){toast('เล็งพื้นดินใกล้ ๆ ตัว');return;}
  digAt(hit.x,hit.z,1.4,G.shovel==='dig'?-.4:.4);
}
function toggleShovel(){G.shovel=G.shovel==='dig'?'fill':'dig';toast(G.shovel==='dig'?'โหมดขุด':'โหมดถมดิน');if(window.updBuildBar)updBuildBar();}

/* ---------- ยกไม้ / วางไม้ ---------- */
const ghost=new THREE.Mesh(logGeo,new THREE.MeshBasicMaterial({color:0x7dff7d,transparent:true,opacity:.5,depthWrite:false}));ghost.visible=false;scene.add(ghost);
let ghostOK=false;
function pickLog(e){removeLog(e);P.carry={len:e.len,r:e.r};G.gYaw=ctl.yaw;G.gMode=e.mesh.quaternion.clone().multiply(new THREE.Quaternion()) && 0;G.gOff=0;ghost.scale.set(e.r,e.len,e.r);if(window.updBuildBar)updBuildBar();toast('ยกท่อนไม้แล้ว เล็งแล้วกดวาง');}
function ghostQuat(){const q=new THREE.Quaternion().setFromAxisAngle(_up,G.gYaw);const a=G.gMode===0?0:G.gMode===1?Math.PI/2:Math.PI/4;
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0,0,1),a));}
function updateGhost(){
  if(!P.carry){ghost.visible=false;return;}
  camera.getWorldPosition(_v);camera.getWorldDirection(_v2);
  ray.set(_v,_v2);ray.far=16;const lh=ray.intersectObjects(logMeshes,false)[0],gh=rayGround(_v,_v2,16);
  let hit=null,onGround=true;
  if(lh&&(!gh||lh.distance<gh.distanceTo(_v)+.3)){hit=lh.point.clone();onGround=false;}else if(gh)hit=gh;
  if(!hit||Math.hypot(hit.x-P.x,hit.z-P.z)>10){ghost.visible=false;ghostOK=false;return;}
  const q=ghostQuat(),axis=_up.clone().applyQuaternion(q),{len,r}=P.carry,half=len/2*Math.abs(axis.y)+r*Math.sqrt(Math.max(0,1-axis.y*axis.y));
  const emb=(G.gMode===0&&onGround)?.45:0;
  ghost.quaternion.copy(q);ghost.position.set(hit.x,hit.y+half-emb+G.gOff,hit.z);ghost.visible=true;ghostOK=true;
}
function placeLog(){
  if(!P.carry||!ghostOK){toast('เล็งไปที่พื้นหรือท่อนไม้');return;}
  addLog(ghost.position.clone(),ghost.quaternion.clone(),P.carry.len,P.carry.r);P.carry=null;ghost.visible=false;if(window.updBuildBar)updBuildBar();markDirty();
}
function dropLog(){
  if(!P.carry)return;const x=P.x-Math.sin(ctl.yaw)*1.5,z=P.z-Math.cos(ctl.yaw)*1.5;
  addLog(new V3(x,groundY(x,z)+P.carry.r,z),new THREE.Quaternion().setFromAxisAngle(new V3(0,0,1),Math.PI/2),P.carry.len,P.carry.r);P.carry=null;if(window.updBuildBar)updBuildBar();
}
function buildRot(d){G.gYaw+=d*Math.PI/12;}
function buildMode(){G.gMode=(G.gMode+1)%3;}
function buildH(d){G.gOff=clamp(G.gOff+d*.2,-1.5,4);}

  
  
/* ---------- ฝนปลา ---------- */
const RF=[],RFSP=FISH.filter(f=>f.r<=1&&f.z<=1&&f.w1<5);
function updateRainFish(dt){
  if(seasonIdx!==5){if(RF.length){RF.forEach(f=>scene.remove(f.m));RF.length=0;}return;}
  G.rainT-=dt;
  if(G.rainT<=0&&RF.length<45&&!ENV.under){G.rainT=.35;const sp=RFSP[(Math.random()*RFSP.length)|0],m=buildFish(sp),w=rollWeight(sp),len=Math.max(fishLen(sp,w),.05);
    m.scale.setScalar(Math.max(.35,len));m.rotation.z=Math.PI/2;m.position.set(P.x+(Math.random()-.5)*26,P.y+24,P.z+(Math.random()-.5)*26);scene.add(m);RF.push({m,sp,w,vy:0,lying:false,t:0});}
  for(let i=RF.length-1;i>=0;i--){const f=RF[i];
    if(f.lying){f.t+=dt;if(f.t>90){scene.remove(f.m);RF.splice(i,1);}continue;}
    f.vy-=16*dt;f.vy=Math.max(f.vy,-16);f.m.position.y+=f.vy*dt;f.m.rotation.x+=dt*4;
    const p=f.m.position,g=gH(p.x,p.z);
    if(!ENV.sheltered&&Math.abs(p.x-P.x)<.7&&Math.abs(p.z-P.z)<.7&&p.y<P.y+1.9&&p.y>P.y-.3){S.hp-=14;toast('🐟 ปลาหล่นใส่หัว! หาที่หลบด่วน',1800);scene.remove(f.m);RF.splice(i,1);continue;}
    if(p.y<=Math.max(g,0)+.12){if(g<-.1){scene.remove(f.m);RF.splice(i,1);ripple(p.x,p.z,.4);}else{f.lying=true;p.y=g+.1;f.m.rotation.set(Math.PI/2,Math.random()*6,0);f.m.scale.setScalar(Math.max(.3,f.m.scale.x));}}
  }
}
function checkShelter(){
  _v.set(P.x,P.y+1.9,P.z);ray.set(_v,_up);ray.far=25;ENV.sheltered=ray.intersectObjects(SHELTER,false).length>0;
}

/* ---------- ปฏิสัมพันธ์ (ปุ่ม E) ---------- */
function findInteract(){
  if(P.carry||FS.state!=='idle')return null;
  const d=(x,z)=>Math.hypot(P.x-x,P.z-z);
  if(d(STALL.x,STALL.z)<4.5)return{t:'shop',l:'คุยกับพ่อค้า (ซื้อของ/ขายปลา)'};
  if(d(CAMP.x,CAMP.z)<3.5)return{t:'camp',l:'กองไฟ: ย่าง/ต้มปลา'};
  if(d(HUT.bed.x,HUT.bed.z)<2.6&&Math.abs(P.y-HUT.hy)<1)return{t:'bed',l:'นอนพัก (ข้ามกลางคืน)'};
  for(const f of RF)if(f.lying&&Math.hypot(P.x-f.m.position.x,P.z-f.m.position.z)<2.4)return{t:'rf',o:f,l:'เก็บปลาที่ตกจากฟ้า'};
  ray.setFromCamera(V2c,camera);ray.far=14;
  const hits=ray.intersectObjects([...logMeshes,...trunkMeshes],false);
  for(const h of hits){if(Math.hypot(h.point.x-P.x,h.point.z-P.z)>4.6)continue;
    if(h.object.userData.log)return{t:'log',o:h.object.userData.log,l:'ยกท่อนไม้'};
    if(h.object.userData.tree&&!S.owned.sp0)return{t:'stick',l:'หักกิ่งไม้ทำไม้แหลม'};
    if(h.object.userData.tree)break;}
  return null;
}
function doInteract(){
  const it=findInteract();if(!it)return;
  if(it.t==='shop')openPanel('shop');
  else if(it.t==='camp')openPanel('inv');
  else if(it.t==='bed'){if(S.tod>=300||S.hp<100){if(S.tod>=300){S.tod=0;S.day++;checkSeason(true);AUR.on=false;}S.hp=100;S.food=Math.max(0,S.food-8);toast('😴 พักผ่อนเรียบร้อย');markDirty();}else toast('ยังไม่ง่วง');}
  else if(it.t==='rf'){if(addFish(it.o.sp,it.o.w)){showCatch(it.o.sp,it.o.w,fishPrice(it.o.sp,it.o.w),true);scene.remove(it.o.m);RF.splice(RF.indexOf(it.o),1);}else toast('กระเป๋าเต็ม!');}
  else if(it.t==='log')pickLog(it.o);
  else if(it.t==='stick'){S.owned.sp0=1;S.eq.spear='sp0';S.tool='spear';heldKey='';refreshHeld();markDirty();toast('ได้ไม้แหลมแล้ว! ลองไปแทงปลาในน้ำตื้น 🐟',3500);}
}

/* ---------- ปุ่มกระทำ (ACT) ---------- */
function actDown(){
  if(G.paused||!G.started)return;
  if(P.carry){placeLog();return;}
  switch(S.tool){case 'rod':fishAct();break;case 'spear':stab();break;case 'axe':chop();break;case 'shovel':dig();break;}
}
function actUp(){if(FS.charging)fishRelease();}

/* ---------- เคลื่อนที่ ---------- */
function movePlayer(dt){
  const lock=FS.state!=='idle';
  const mx=lock?0:inp.mx,mz=lock?0:inp.mz,fx=-Math.sin(ctl.yaw),fz=-Math.cos(ctl.yaw),rx=Math.cos(ctl.yaw),rz=-Math.sin(ctl.yaw);
  let vx=fx*mz+rx*mx,vz=fz*mz+rz*mx;const mag=Math.hypot(vx,vz);if(mag>1){vx/=mag;vz/=mag;}
  const th=gH(P.x,P.z),onPier=pierY(P.x,P.z)>-50;
  if(!onPier&&th<-.9&&!P.swim)P.swim=true;          // น้ำลึกเกินเอว (~0.9 m) = เริ่มว่ายน้ำ
  if(P.swim&&(th>-.7||onPier)){P.swim=false;P.vy=0;}
  const speed=P.swim?(P.under?2.8:3.5):(th<-.2?3.6:5.4);
  const t={x:P.x+vx*speed*dt,z:P.z+vz*speed*dt,y:P.y};
  collide(t,.35);
  const rr=Math.hypot(t.x,t.z);if(rr>210){t.x*=210/rr;t.z*=210/rr;}
  if(!P.swim&&groundY(t.x,t.z)-P.y>.75&&P.grounded){/* ชันเกินไป */}else{P.x=t.x;P.z=t.z;}
  P.moving=mag>.1&&!lock;
  if(P.swim){
    const surf=-.9;
    if(inp.up&&!lock&&P.x>48&&P.x<55&&Math.abs(P.z)<2.4){P.x=Math.min(P.x,53.4);P.z=clamp(P.z,-1,1);P.y=1.05;P.swim=false;P.vy=0;return;}
    if(P.y>surf+.05)P.vy-=18*dt;else if(inp.down&&!lock)P.vy=-2.8;else if(inp.up&&!lock)P.vy=3.2;else P.vy*=Math.max(0,1-dt*6);
    P.y+=P.vy*dt;if(P.y>surf&&P.vy<=0&&P.y-surf<.3){P.y=surf;P.vy=0;}
    const fl=gH(P.x,P.z)+.05;if(P.y<fl){P.y=fl;P.vy=Math.max(P.vy,0);}
    P.grounded=false;
  }else{
    const g=groundY(P.x,P.z);
    if(inp.up&&P.grounded&&!lock){P.vy=6.2;P.grounded=false;}
    P.vy-=18*dt;P.y+=P.vy*dt;
    if(P.y<=g){P.y=g;P.vy=0;P.grounded=true;}else if(P.grounded&&P.y-g<.35&&P.vy<=0)P.y=g;else P.grounded=false;
  }
}
/* ---------- เอาชีวิตรอด ---------- */
function survive(dt){
  S.food=Math.max(0,S.food-dt*(P.swim?.1:.075));
  if(S.food<=0)S.hp-=dt*1.5;else if(S.food>35&&S.hp<100)S.hp=Math.min(100,S.hp+dt*.5);
  const tk=TANKS[S.tank];P.under=P.y+1.55<-.05;
  if(P.under)P.o2=Math.max(0,P.o2-dt);else P.o2=Math.min(tk.o2,P.o2+dt*10);
  if(P.o2<=0&&P.under){S.hp-=dt*14;G.msgPressureT-=dt;if(G.msgPressureT<=0){toast('⚠️ ออกซิเจนหมด! ขึ้นผิวน้ำเร็ว',1500);G.msgPressureT=2;}}
  if(P.under&&-P.y>tk.depth+1){S.hp-=dt*10;G.msgPressureT-=dt;if(G.msgPressureT<=0){toast('⚠️ แรงดันน้ำสูงเกินไป! ต้องมีชุดดำน้ำที่ดีกว่า',1500);G.msgPressureT=2;}}
  if(S.hp<=0)die();
}
function die(){
  toast('💀 คุณสลบไป... ตื่นที่กระท่อม (เสียเหรียญ 10%)',3500);
  S.coins=Math.floor(S.coins*.9);S.hp=60;S.food=Math.max(S.food,50);
  if(FS.state!=='idle'){if(FS.fm){scene.remove(FS.fm);FS.fm=null;}fishEnd();}
  if(P.carry)dropLog();placePlayer(HUT.spawn.x,HUT.spawn.z);P.o2=TANKS[S.tank].o2;markDirty();
}
function placePlayer(x,z){P.x=x;P.z=z;P.vy=0;P.swim=false;const g=groundY(x,z);P.y=g<-.9?-.9:g;P.grounded=true;ctl.yaw=Math.PI/2;}
function checkSeason(announce){
  const si=Math.floor(S.day/SEASON_DAYS)%6;
  if(si!==seasonIdx){applySeason(si);if(announce)toast('เข้าสู่'+SEASONS[si].n,3500);}
}

/* ---------- กล้อง ---------- */
const _camT=new V3();
function updateCamera(dt,time){
  const hookMode=FS.state!=='idle'&&FS.state!=='charge';
  const fp=S.set.cam==='fp'&&!hookMode&&FS.state!=='charge';
  camera.rotation.order='YXZ'; camera.rotation.set(ctl.pitch,ctl.yaw,0);
  const look=new V3(-Math.sin(ctl.yaw)*Math.cos(ctl.pitch), Math.sin(ctl.pitch), -Math.cos(ctl.yaw)*Math.cos(ctl.pitch));
  
  if(hookMode){
    let targetCamD = FS.camD;
    
    // ถือกำลังดึงปลาขึ้นสำเร็จ (Landed/Retrieve) ให้กล้องแพนขึ้นตามตัวปลา
    if(FS.state === 'landed' || FS.state === 'retrieve'){
      _camT.copy(FS.hook).add(new V3(0, 0.8, -targetCamD * 0.8));
      camera.position.lerp(_camT, dt * 6);
    } else {
      // ระหว่างสู้กับปลา กล้องจะตามตะขอพร้อมสั่นตามแรงดึงของปลา
      camera.position.copy(FS.hook).addScaledVector(look,-targetCamD);
      if(FS.state==='fight' && (FS.tens>60 || FS.pull)){
        const shake = (FS.tens / 100) * 0.15;
        camera.position.x += (Math.random()-.5) * shake;
        camera.position.y += (Math.random()-.5) * shake;
      }
    }
    
    const fl=gH(camera.position.x,camera.position.z)+.15;
    if(camera.position.y<fl)camera.position.y=fl;
  }else if(fp){
    camera.position.set(P.x,P.y+1.55,P.z);
  }else{
    _camT.set(P.x,P.y+1.5,P.z); const d=P.carry?4.8:4.2;
    camera.position.copy(_camT).addScaledVector(look,-d);
    const fl=Math.max(gH(camera.position.x,camera.position.z),P.swim?-99:-.2)+.35;
    if(camera.position.y<fl&&!P.swim)camera.position.y=fl;
  }
  mountHeld();
}

/* ---------- แอนิเมชันตัวละคร ---------- */
function animPlayer(dt,time){
  const fpEff=S.set.cam==='fp'&&FS.state==='idle';
  // ท่าว่ายน้ำ: เอนตัวนอนคว่ำขนานผิวน้ำ (blend นุ่ม ๆ)
  P.sb=P.sb||0;P.sb+=((P.swim?1:0)-P.sb)*Math.min(1,dt*7);const sb=P.sb;
  P.swT=(P.swT||0)+dt*(P.moving?5.5:2.2);
  human.g.rotation.order='YXZ';human.g.rotation.y=ctl.yaw;human.g.rotation.x=-Math.PI/2*sb;
  human.g.position.set(P.x+Math.sin(ctl.yaw)*.9*sb,P.y+.8*sb+(P.swim?Math.sin(time*2)*.04:0),P.z+Math.cos(ctl.yaw)*.9*sb);
  if(P.moving)P.walkT+=dt*(P.swim?4:8);
  const sw=P.moving?Math.sin(P.walkT)*.7:0;
  const kick=Math.sin(time*(P.moving?9:4))*.5;
  human.legL.rotation.x=lerp(sw,kick,sb);human.legR.rotation.x=lerp(-sw,-kick,sb);
  const armLwalk=-sw*.8;let ar=0,stabP=0;
  if(S.tool!=='hand')ar=-1.15;
  if(P.atk>0){P.atk-=dt;const u=1-Math.max(0,P.atk)/(P.atkKind==='chop'?.45:P.atkKind==='dig'?.5:P.atkKind==='cast'?.5:.4);
    if(P.atkKind==='stab'){stabP=Math.sin(u*Math.PI);ar=-1.15-stabP*.5;held.position.z=-.05-stabP*.5;held.position.y=-.72;}
    else if(P.atkKind==='chop'||P.atkKind==='dig'){ar=-1.15-Math.sin(u*Math.PI)*.9;held.rotation.x=(TOOL_BASE[S.tool]||0)-Math.sin(u*Math.PI)*1.4;}
    else if(P.atkKind==='cast'){ar=-1.15-Math.sin(u*Math.PI)*.8;}
  }else{held.rotation.x=TOOL_BASE[S.tool]||0;if(mountFP===false){held.position.set(0,-.72,-.05);}else held.position.set(.3,-.3,-.45);}
  if(S.tool==='rod'&&FS.state==='charge')ar=-1.15+Math.sin(time*8)*.05-FS.power*.5;
  let armR=ar,armL=armLwalk,zL=0,zR=0;
  if(sb>.001){
    const ph=P.swT;let swR,swL;
    if(S.tool!=='hand'){ // ถือของ: แขนขวาชี้ของไปข้างหน้า แขนซ้ายกางออกข้างช่วยพยุงสมดุล
      swR=Math.PI/2;zR=.12;
      swL=Math.PI/2+Math.sin(ph*1.6)*.3-stabP*.7;zL=-1.2+Math.sin(ph*1.6)*.15-stabP*.2;
    }else{ // มือเปล่า: ท่าฟรีสไตล์ สลับแขน
      swR=ph%(Math.PI*2);swL=(ph+Math.PI)%(Math.PI*2);
    }
    armR=lerp(ar,swR,sb);armL=lerp(armLwalk,swL,sb);zL*=sb;zR*=sb;
  }
  human.armR.rotation.x=armR;human.armL.rotation.x=armL;human.armL.rotation.z=zL;human.armR.rotation.z=zR;
  human.g.visible=!fpEff;
  npc.head.rotation.y=Math.sin(G.time*.7)*.3;
}
/* ---------- วนลูปหลัก ---------- */
function tick(dt,time){
  G.time=time;
  S.tod+=dt;
  if(S.tod>=600){S.tod-=600;S.day++;AUR.on=false;checkSeason(true);markDirty();}
  if(S.tod>=300&&S.tod-dt<300){AUR.on=Math.random()<.5;if(AUR.on)toast('🌌 ออโรร่ามาแล้ว! โอกาสได้ปลาหายากเพิ่มขึ้น 10%',4500);}
  movePlayer(dt);survive(dt);
  G.shelT-=dt;if(G.shelT<=0){G.shelT=.3;checkShelter();}
  // ไฟส่องสว่างของผู้เล่น (ใต้น้ำ)
  if(FS.state==='idle'||FS.state==='charge'){const lp=S.eq.lamp?ITEMS[S.eq.lamp]:null;ENV.lightR=lp?lp.r:0;lamp.position.set(P.x,P.y+1.6,P.z);}
  else lamp.position.copy(FS.hook);
  updateFishing(dt,time);if(window.updateCreatures)updateCreatures(dt,time);updateLine();updateGhost();updateFalling(dt);updateLive(dt,time);updateRainFish(dt);
  animPlayer(dt,time);updateCamera(dt,time);
  updateEnv(dt,time);
  G.hudT-=dt;if(G.hudT<=0){G.hudT=.12;updHUD();}
}
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(G.started&&!G.paused)tick(dt,now/1000);
  else if(G.started){updateCamera(0,now/1000);}
  renderer.render(scene,camera);
}
function afterLoad(){
  checkSeason(false);if(S.x!=null)placePlayer(S.x,S.z);else placePlayer(HUT.spawn.x,HUT.spawn.z);
  P.o2=TANKS[S.tank].o2;heldKey='';refreshHeld();mountFP=null;setGfx(S.set.gfx);sun.castShadow=!!S.set.shadow;renderer.shadowMap.enabled=!!S.set.shadow;
  scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});
  if(window.refreshPanel)refreshPanel();if(window.renderHotbar)renderHotbar();
}
function newGame(){
  S=defaultState();resetWorld();clearLive();afterLoad();S.tod=20;markDirty();saveLocal();
}
function startGame(){
  initSupabase();
  const had=loadLocal();
  if(!had){S=defaultState();}
  afterLoad();if(!had){placePlayer(HUT.spawn.x,HUT.spawn.z);}
  S.tod=S.tod||20;
  G.started=true;
  toast(had?'ยินดีต้อนรับกลับ!':'เล็งไปทางทะเล กดค้างปุ่ม "ใช้" เพื่อโยนเบ็ด 🎣 (หักกิ่งไม้ปุ่ม E ได้ไม้แหลมไว้แทงปลา)',4500);
}
requestAnimationFrame(frame);
