'use strict';
/* ===== UI: HUD, ร้านค้า, กระเป๋า, ตั้งค่า, ปุ่มควบคุม ===== */
const $=id=>document.getElementById(id);
function toast(t,ms){const m=$('msg'),d=document.createElement('div');d.className='toast';d.textContent=t;m.appendChild(d);setTimeout(()=>d.remove(),ms||2400);while(m.children.length>4)m.firstChild.remove();}
function ico(key,emoji,cls){return IMGS[key]?`<img class="ii ${cls||''}" src="${IMGS[key]}">`:`<span class="ie ${cls||''}">${emoji}</span>`;}
function fishIco(sp){return IMGS['fish'+sp.id]?`<img class="ii" src="${IMGS['fish'+sp.id]}">`:`<span class="ie" style="background:${sp.c}33;border:2px solid ${sp.c}">🐟</span>`;}
function itemIco(it){return ico(it.id,it.ic||'📦');}

/* ---------- การ์ดปลาที่จับได้ ---------- */
let catchT=0;
function showCatch(sp,w,price,ok){
  const r=RAR[sp.r],c=$('catch');
  c.innerHTML=`<div class="cc" style="border-color:${r.c};box-shadow:0 0 24px ${r.c}88">${fishIco(sp)}<div><b style="color:${r.c}">${r.n}</b> · ${sp.name}<br>${fmtW(w)} · ยาว ${fmtL(fishLen(sp,w))}<br>💰 ${fmtN(price)} ${ok?'':'<br><span style="color:#f66">กระเป๋าเต็ม! ปลาหลุดกลับน้ำ</span>'}</div></div>`;
  c.classList.add('show');clearTimeout(catchT);catchT=setTimeout(()=>c.classList.remove('show'),sp.r>=4?4200:2600);
}
function hudFish(o){
  const h=$('fishhud');if(!o.show){h.style.display='none';return;}
  h.style.display='flex';$('fstat').textContent=o.txt||'';$('fstat').className=o.alert?'alert':'';
  $('powbar').style.display=o.pow!=null?'block':'none';if(o.pow!=null)$('powf').style.width=(o.pow*100)+'%';
  $('fightbars').style.display=o.tens!=null?'block':'none';
  if(o.tens!=null){$('tensf').style.width=o.tens+'%';$('tensf').style.background=o.tens>70?'#ff4040':o.tens>45?'#ffb020':'#4cd964';$('progf').style.width=clamp(o.prog,0,100)+'%';}
}
/* ---------- HUD ---------- */
let lastPrompt='';
function updHUD(){
  $('hpf').style.width=clamp(S.hp,0,100)+'%';$('fdf').style.width=clamp(S.food,0,100)+'%';
  const tk=TANKS[S.tank];$('o2bar').style.display=(P.under||P.o2<tk.o2-.5)?'block':'none';$('o2f').style.width=(P.o2/tk.o2*100)+'%';
  $('coin').textContent='🪙 '+fmtN(S.coins);
  const night=S.tod>=300;$('clock').textContent=(night?'🌙':'☀️')+' วัน '+(S.day+1)+' · '+SEASONS[seasonIdx].n+(AUR.on&&night?' 🌌':'');
  $('bag').textContent='🎒 '+S.fish.length+'/'+bagCap();
  const it=findInteract(),p=it?it.l:'';if(p!==lastPrompt){lastPrompt=p;$('prompt').textContent=p?('E · '+p):'';$('prompt').style.display=p?'block':'none';$('bUse').classList.toggle('hot',!!p);}
  $('bDown').style.display=P.swim?'flex':'none';
  $('bUp').textContent=P.swim?'⬆':'⤒';
  const ss=SEASONS[seasonIdx];
  $('cross').style.display=(P.carry||S.tool==='axe'||S.tool==='shovel'||S.tool==='spear')&&FS.state==='idle'?'block':'none';
}
function renderHotbar(){
  const h=$('hotbar');h.innerHTML='';
  toolList().forEach((t,i)=>{
    const d=document.createElement('button');d.className='hb'+(S.tool===t?' on':'');
    let ic='✋';if(t==='spear')ic=itemIco(ITEMS[S.eq.spear]);else if(t==='rod')ic=itemIco(ITEMS[S.eq.rod]);else if(t==='axe')ic=ico('axe','🪓');else if(t==='shovel')ic=ico('shovel','⛏️');
    d.innerHTML=ic+'<i>'+(i+1)+'</i>';d.onpointerdown=e=>{e.stopPropagation();setTool(t);};h.appendChild(d);});
  updBuildBar();
}
function updBuildBar(){
  const b=$('buildbar');
  if(P.carry){b.style.display='flex';b.innerHTML=`<button onpointerdown="buildRot(-1)">⟲</button><button onpointerdown="buildRot(1)">⟳</button><button onpointerdown="buildMode()">↕ ท่า</button><button onpointerdown="buildH(1)">▲</button><button onpointerdown="buildH(-1)">▼</button><button onpointerdown="dropLog()">ทิ้ง</button>`;}
  else if(S.tool==='shovel'){b.style.display='flex';b.innerHTML=`<button onpointerdown="toggleShovel()">${G.shovel==='dig'?'⛏️ โหมดขุด':'🟫 โหมดถม'} (แตะสลับ)</button>`;}
  else b.style.display='none';
}

/* ---------- แผง ---------- */
const UI={kind:null,tab:null};
function openPanel(kind,tab){
  if(FS.state!=='idle'&&FS.state!=='charge'){toast('กำลังตกปลาอยู่');return;}
  UI.kind=kind;UI.tab=tab||(kind==='shop'?'sell':kind==='inv'?'fish':'main');G.paused=true;inp.act=false;inp.mx=inp.mz=0;renderPanel();$('panel').style.display='flex';
}
function closePanel(){UI.kind=null;G.paused=false;$('panel').style.display='none';saveLocal();}
function refreshPanel(){if(UI.kind)renderPanel();}
function setTab(t){UI.tab=t;renderPanel();}
const TABS={shop:[['sell','💰 ขายปลา'],['rod','🎣 เบ็ด'],['line','🧵 สาย'],['hook','🪝 ตะขอ'],['bait','🪱 เหยื่อ'],['bag','🎒 กระเป๋า'],['tank','🤿 ออกซิเจน'],['tool','🛠 เครื่องมือ']],
  inv:[['fish','🐟 ปลา/ครัว'],['equip','🎯 อุปกรณ์'],['dex','📖 สมุดปลา']],set:[['main','⚙️ ทั่วไป'],['acct','☁️ บัญชี'],['img','🖼 รูปไอเทม']]};
function renderPanel(){
  const k=UI.kind;if(!k)return;
  const title=k==='shop'?'🏪 ร้านค้า':k==='inv'?'🎒 กระเป๋า':'⚙️ ตั้งค่า';
  let h=`<div class="pbox"><div class="phead"><b>${title}</b><span>🪙 ${fmtN(S.coins)}</span><button class="x" onclick="closePanel()">✕</button></div><div class="ptabs">`;
  TABS[k].forEach(t=>h+=`<button class="${UI.tab===t[0]?'on':''}" onclick="setTab('${t[0]}')">${t[1]}</button>`);
  h+='</div><div class="pbody">';
  const f=({shop:shopBody,inv:invBody,set:setBody})[k];h+=f();h+='</div></div>';
  const keep=$('panel').querySelector('.pbody');const sc=keep?keep.scrollTop:0;
  $('panel').innerHTML=h;const nb=$('panel').querySelector('.pbody');if(nb)nb.scrollTop=sc;
}
function row(ic,name,desc,right){return `<div class="row"><div class="ri">${ic}</div><div class="rt"><b>${name}</b><br><small>${desc}</small></div><div class="rr">${right}</div></div>`;}
function btn(txt,fn,dis,cls){return `<button class="b ${cls||''}" ${dis?'disabled':''} onclick="${fn}">${txt}</button>`;}
function shopBody(){
  const t=UI.tab;let h='';
  if(t==='sell'){
    if(!S.fish.length)return'<p class="hint">ยังไม่มีปลาในกระเป๋า ไปตกหรือแทงปลามาก่อนนะ 🎣</p>';
    let tot=0;S.fish.forEach(f=>tot+=fishPrice(FISH[f.id],f.w));
    h+=`<div class="bar2">${btn('ขายทั้งหมด 🪙 '+fmtN(tot),'sellAll()',false,'g')}</div>`;
    const idx=S.fish.map((f,i)=>i).sort((a,b)=>fishPrice(FISH[S.fish[b].id],S.fish[b].w)-fishPrice(FISH[S.fish[a].id],S.fish[a].w)).slice(0,80);
    idx.forEach(i=>{const f=S.fish[i],sp=FISH[f.id],r=RAR[sp.r];h+=row(fishIco(sp),`<span style="color:${r.c}">${sp.name}</span>`,`${r.n} · ${fmtW(f.w)}`,btn('ขาย 🪙'+fmtN(fishPrice(sp,f.w)),`sellOne(${i})`));});
    if(S.fish.length>80)h+='<p class="hint">แสดง 80 ตัวที่แพงที่สุด</p>';return h;}
  const lists={rod:RODS,line:LINES,hook:HOOKS,bait:BAITS,tool:[...SPEARS.slice(1),...TOOLS,...LAMPS]};
  if(t==='bag'){const n=BAGS[S.bag+1];h+=`<p class="hint">ความจุปัจจุบัน ${bagCap()} ตัว</p>`;
    if(!n)return h+'<p class="hint">กระเป๋าสุดยอดแล้ว!</p>';return h+row('🎒','อัปเกรดกระเป๋า → '+n.cap+' ตัว','ราคาเพิ่มขึ้นทุกระดับ',btn('🪙 '+fmtN(n.pr),'buyBag()',S.coins<n.pr));}
  if(t==='tank'){const n=TANKS[S.tank+1];h+=`<p class="hint">ตอนนี้: ${TANKS[S.tank].nm} · อากาศ ${TANKS[S.tank].o2}s · ดำได้ลึก ${TANKS[S.tank].depth} m</p>`;
    if(!n)return h+'<p class="hint">ชุดดำน้ำสุดยอดแล้ว!</p>';return h+row('🤿',n.nm,`อากาศ ${n.o2} วินาที · ดำได้ลึก ${n.depth} m`,btn('🪙 '+fmtN(n.pr),'buyTank()',S.coins<n.pr));}
  (lists[t]||[]).forEach(it=>{
    if(it.pr===0)return;
    let d='';
    if(it.cat==='rod')d=`โยนได้ไกล ${it.dist} m · รับปลาได้ ${fmtW(it.maxW)}`;
    else if(it.cat==='line')d=`ปล่อยลึก ${it.len} m · แรงดึง ${fmtW(it.maxW)}`;
    else if(it.cat==='hook')d=`ไฟส่อง ${it.light} m · โชค +${Math.round(it.luck*100)}%`;
    else if(it.cat==='bait')d=`10 ชิ้น · โชค +${Math.round(it.luck*100)}% · กินเร็ว x${it.speed} (มี ${S.baits[it.id]||0})`;
    else if(it.cat==='spear')d=`แทงปลาหนักได้ ${fmtW(it.maxW)} · ระยะ ${it.reach} m`;
    else if(it.cat==='lamp')d=`ส่องสว่างใต้น้ำ ${it.r} m`;
    else if(it.id==='axe')d='ตัดต้นไม้/ผ่าท่อนไม้ได้ทุกตำแหน่ง';else d='ขุด/ถมดิน';
    const own=S.owned[it.id]&&it.cat!=='bait';
    h+=row(itemIco(it),it.nm,d,own?'<small>มีแล้ว ✔</small>':btn('🪙 '+fmtN(it.pr),`buy('${it.id}')`,S.coins<it.pr));});
  return h||'<p class="hint">-</p>';
}
function buy(id){
  const it=ITEMS[id];if(!it||S.coins<it.pr){toast('เหรียญไม่พอ');return;}
  if(it.cat==='bait'){S.coins-=it.pr;S.baits[id]=(S.baits[id]||0)+it.pack;S.eq.bait=id;toast('ซื้อ '+it.nm+' x'+it.pack);}
  else{if(S.owned[id])return;S.coins-=it.pr;S.owned[id]=1;
    if(it.cat==='rod')S.eq.rod=id;else if(it.cat==='line')S.eq.line=id;else if(it.cat==='hook')S.eq.hook=id;else if(it.cat==='spear')S.eq.spear=id;else if(it.cat==='lamp')S.eq.lamp=id;
    toast('ซื้อ '+it.nm+' แล้ว!');}
  heldKey='';refreshHeld();markDirty();renderPanel();
}
function buyBag(){const n=BAGS[S.bag+1];if(n&&S.coins>=n.pr){S.coins-=n.pr;S.bag++;toast('กระเป๋าใหญ่ขึ้น '+n.cap+' ช่อง');markDirty();renderPanel();}}
function buyTank(){const n=TANKS[S.tank+1];if(n&&S.coins>=n.pr){S.coins-=n.pr;S.tank++;P.o2=n.o2;toast('ได้ '+n.nm);markDirty();renderPanel();}}
function sellOne(i){const f=S.fish[i];if(!f)return;S.coins+=fishPrice(FISH[f.id],f.w);S.fish.splice(i,1);markDirty();renderPanel();}
function sellAll(){let t=0;S.fish.forEach(f=>t+=fishPrice(FISH[f.id],f.w));S.coins+=t;toast('ขายปลาได้ 🪙 '+fmtN(t));S.fish=[];markDirty();saveLocal();renderPanel();}

function invBody(){
  const t=UI.tab;let h='';
  if(t==='fish'){
    const near=Math.hypot(P.x-CAMP.x,P.z-CAMP.z)<5.5;
    h+=`<p class="hint">ความหิว ${Math.round(S.food)}% · เลือด ${Math.round(S.hp)}% ${near?'· 🔥 อยู่ใกล้กองไฟ ย่าง/ต้มได้':'· ไปที่กองไฟเพื่อย่าง/ต้ม'}</p>`;
    if(!S.fish.length)return h+'<p class="hint">กระเป๋าว่าง</p>';
    S.fish.slice(0,80).forEach((f,i)=>{const sp=FISH[f.id],r=RAR[sp.r];
      h+=row(fishIco(sp),`<span style="color:${r.c}">${sp.name}</span>`,`${r.n} · ${fmtW(f.w)} · 🍖+${Math.round(nutrition(f.w))}`,
        btn('กินดิบ',`eatFish(${i},'raw')`)+btn('ย่าง',`eatFish(${i},'grill')`,!near)+btn('ต้ม',`eatFish(${i},'boil')`,!near)+btn('ขาย',`sellOne(${i})`,Math.hypot(P.x-STALL.x,P.z-STALL.z)>8,'g'));});
    return h;}
  if(t==='equip'){
    const sec=(label,list,cur,fn,none)=>{let s=`<div class="sec">${label}</div><div class="eqrow">`;
      if(none)s+=`<button class="eqb ${!cur?'on':''}" onclick="${fn}(null)">ไม่ใช้</button>`;
      list.forEach(it=>{const own=S.owned[it.id]||(it.cat==='bait'&&S.baits[it.id]>0);if(!own)return;
        s+=`<button class="eqb ${cur===it.id?'on':''}" onclick="${fn}('${it.id}')">${itemIco(it)}<small>${it.nm}${it.cat==='bait'?' x'+S.baits[it.id]:''}</small></button>`;});return s+'</div>';};
    h+=sec('คันเบ็ด',RODS,S.eq.rod,'equipRod',false)+sec('สายเบ็ด',LINES,S.eq.line,'equipLine',false)+sec('ตะขอ',HOOKS,S.eq.hook,'equipHook',false)+sec('เหยื่อ',BAITS,S.eq.bait,'equipBait',true)+sec('อาวุธแทงปลา',SPEARS,S.eq.spear,'equipSpear',false)+sec('ไฟส่องใต้น้ำ',LAMPS,S.eq.lamp,'equipLamp',true);
    const rod=S.eq.rod?ITEMS[S.eq.rod]:null,line=ITEMS[S.eq.line||'line0'];
    h+=`<p class="hint">รับน้ำหนักจริง = ค่าต่ำกว่าระหว่างคันกับสาย: ${rod?fmtW(Math.min(rod.maxW,line.maxW)):'-'}<br>⚠️ ปลาหนักเกินจะทำให้เบ็ดหัก!</p>`;return h;}
  if(t==='dex'){
    let got=0;FISH.forEach(f=>{if(S.dex[f.id])got++;});
    h+=`<p class="hint">เก็บได้ ${got}/${FISH.length} ชนิด</p><div class="dex">`;
    FISH.forEach(sp=>{const d=S.dex[sp.id],r=RAR[sp.r];h+=`<div class="dx" style="border-color:${d?r.c:'#444'}">${d?fishIco(sp):'<span class="ie">❔</span>'}<small style="color:${d?r.c:'#888'}">${d?sp.name:'???'}</small><small>${d?fmtW(d.best):r.n}</small></div>`;});
    return h+'</div>';}
  return'';
}
const eqf=(c,k)=>id=>{S.eq[k]=id;if(k==='rod'||k==='spear'){heldKey='';refreshHeld();}markDirty();renderPanel();};
const equipRod=eqf('rod','rod'),equipLine=eqf('line','line'),equipHook=eqf('hook','hook'),equipBait=eqf('bait','bait'),equipSpear=eqf('spear','spear'),equipLamp=eqf('lamp','lamp');
function eatFish(i,mode){
  const f=S.fish[i];if(!f)return;const n=nutrition(f.w),sp=FISH[f.id];
  if(mode!=='raw'&&Math.hypot(P.x-CAMP.x,P.z-CAMP.z)>5.5){toast('ต้องอยู่ใกล้กองไฟ');return;}
  if(mode==='raw'){S.food=Math.min(100,S.food+n*.6);S.hp=Math.max(1,S.hp-4);toast('กินปลาดิบ… คาวนิดหน่อย (เลือด -4)');}
  else if(mode==='grill'){S.food=Math.min(100,S.food+n*1.3);toast('ปลาย่างหอมกรุ่น! 🍖 +'+Math.round(n*1.3));}
  else{S.food=Math.min(100,S.food+n*1.1);S.hp=Math.min(100,S.hp+10+n*.4);toast('ต้มปลาร้อน ๆ ฟื้นพลัง ❤️');}
  S.fish.splice(i,1);markDirty();renderPanel();
}
/* ---------- ตั้งค่า ---------- */
let imgTarget=null;
function setBody(){
  const t=UI.tab;let h='';
  if(t==='main'){
    h+=`<div class="sec">มุมกล้อง</div><div class="eqrow"><button class="eqb ${S.set.cam==='tp'?'on':''}" onclick="setCam('tp')">👤 บุคคลที่ 3</button><button class="eqb ${S.set.cam==='fp'?'on':''}" onclick="setCam('fp')">👁 บุคคลที่ 1</button></div>`;
    h+=`<div class="sec">กราฟิก (เครื่องช้าให้เลือกต่ำ)</div><div class="eqrow">${[1,2,3].map(q=>`<button class="eqb ${S.set.gfx===q?'on':''}" onclick="setQ(${q})">${['','ต่ำ','กลาง','สูง'][q]}</button>`).join('')}<button class="eqb ${S.set.shadow?'on':''}" onclick="setShadow()">เงา ${S.set.shadow?'เปิด':'ปิด'}</button></div>`;
    h+=`<div class="sec">อื่น ๆ</div><div class="eqrow"><button class="eqb" onclick="skipSeason()">⏭ ข้ามฤดู</button><button class="eqb" onclick="goFull()">⛶ เต็มจอ</button><button class="eqb" onclick="if(confirm('เริ่มเกมใหม่ทั้งหมด?'))newGame()">🗑 เริ่มใหม่</button></div>`;
    h+=`<p class="hint">เกมจะเซฟอัตโนมัติในเครื่อง และขึ้นคลาวด์ถ้าล็อกอินบัญชี<br>ควบคุมคีย์บอร์ด: WASD เดิน · ลากเมาส์หมุนกล้อง · F ใช้งาน · E โต้ตอบ · Space กระโดด/ว่ายขึ้น · C ดำลง · 1-5 เปลี่ยนของ · I กระเป๋า · Z/X หมุนไม้ · V ท่า · T/Y สูงต่ำ · G ทิ้ง</p>`;
    return h;}
  if(t==='acct'){
    h+=`<p class="hint" id="acctStat">${sb?(sbUser?'เข้าสู่ระบบ: '+sbUser.email:'ยังไม่ได้ล็อกอิน (เล่นออฟไลน์ได้ เซฟในเครื่อง)'):'ยังไม่ได้ตั้งค่า Supabase — ใส่ SUPABASE_URL/KEY ในไฟล์ save.js'}</p>`;
    h+=`<input id="em" type="email" placeholder="อีเมล" autocomplete="email"><input id="pw" type="password" placeholder="รหัสผ่าน (6 ตัวขึ้นไป)" autocomplete="current-password"><div class="eqrow"><button class="eqb" onclick="doAuth('in')">เข้าสู่ระบบ</button><button class="eqb" onclick="doAuth('up')">สมัครบัญชี</button><button class="eqb" onclick="doAuth('out')">ออก</button><button class="eqb" onclick="cloudSave().then(()=>toast('เซฟขึ้นคลาวด์แล้ว'))">☁️ เซฟตอนนี้</button></div>`;
    return h;}
  if(t==='img'){
    h+='<p class="hint">อัปโหลดรูป .png ให้ไอเทม/ปลาแต่ละอย่าง (ใช้เป็นไอคอนใน UI) · โมเดล 3D ในเกมเขียนจากโค้ด</p>';
    const all=[...Object.values(ITEMS).map(i=>({k:i.id,n:i.nm,ic:itemIco(i)})),{k:'axe',n:'ขวาน',ic:ico('axe','🪓')},{k:'shovel',n:'จอบ',ic:ico('shovel','⛏️')},...FISH.map(f=>({k:'fish'+f.id,n:f.name,ic:fishIco(f)}))];
    all.forEach(a=>{h+=row(a.ic,a.n,IMGS[a.k]?'ใช้รูปที่อัปโหลด':'ใช้ไอคอนเริ่มต้น',btn('อัปโหลด',`pickImg('${a.k}')`)+(IMGS[a.k]?btn('ลบ',`delImg('${a.k}')`):''));});
    return h;}
  return'';
}
function setCam(c){S.set.cam=c;mountFP=null;markDirty();renderPanel();}
function setQ(q){S.set.gfx=q;setGfx(q);markDirty();renderPanel();}
function setShadow(){S.set.shadow=S.set.shadow?0:1;sun.castShadow=!!S.set.shadow;renderer.shadowMap.enabled=!!S.set.shadow;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});markDirty();renderPanel();}
function skipSeason(){S.day=(Math.floor(S.day/SEASON_DAYS)+1)*SEASON_DAYS;S.tod=10;checkSeason(true);markDirty();renderPanel();}
function goFull(){try{document.documentElement.requestFullscreen().then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{})).catch(()=>{});}catch(e){}}
function doAuth(k){const em=$('em')?$('em').value.trim():'',pw=$('pw')?$('pw').value:'';
  authDo(k,em,pw).then(m=>{toast(m,3500);if(window.refreshAccountUI)refreshAccountUI();});}
window.refreshAccountUI=()=>{if(UI.kind==='set'&&UI.tab==='acct')renderPanel();};
function pickImg(k){imgTarget=k;$('fileIn').value='';$('fileIn').click();}
function delImg(k){delete IMGS[k];saveImgs();renderPanel();renderHotbar();}
function saveImgs(){try{localStorage.setItem(IMG_KEY,JSON.stringify(IMGS));}catch(e){toast('พื้นที่เก็บรูปเต็ม');}}
$('fileIn').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f||!imgTarget)return;const rd=new FileReader();
  rd.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');
    const s=Math.max(96/im.width,96/im.height),w=im.width*s,h=im.height*s;x.drawImage(im,(96-w)/2,(96-h)/2,w,h);
    IMGS[imgTarget]=c.toDataURL('image/png');saveImgs();renderPanel();renderHotbar();toast('อัปโหลดรูปแล้ว');};im.src=rd.result;};rd.readAsDataURL(f);});

/* ---------- ควบคุม ---------- */
function setupControls(){
  const joyZone=$('joyzone'),knob=$('knob'),base=$('joy');let jid=null,jx=0,jy=0;
  joyZone.addEventListener('pointerdown',e=>{if(jid!==null)return;jid=e.pointerId;joyZone.setPointerCapture(jid);jx=e.clientX;jy=e.clientY;base.style.left=(jx-50)+'px';base.style.top=(jy-50)+'px';base.style.display='block';knob.style.transform='translate(0,0)';});
  joyZone.addEventListener('pointermove',e=>{if(e.pointerId!==jid)return;let dx=e.clientX-jx,dy=e.clientY-jy;const d=Math.hypot(dx,dy),R=46;if(d>R){dx*=R/d;dy*=R/d;}
    knob.style.transform=`translate(${dx}px,${dy}px)`;inp.mx=dx/R;inp.mz=-dy/R;if(Math.hypot(inp.mx,inp.mz)<.15){inp.mx=0;inp.mz=0;}});
  const jend=e=>{if(e.pointerId!==jid)return;jid=null;inp.mx=inp.mz=0;base.style.display='none';};
  joyZone.addEventListener('pointerup',jend);joyZone.addEventListener('pointercancel',jend);
  const lz=$('lookzone');let lid=null,lx=0,ly=0;
  lz.addEventListener('pointerdown',e=>{if(lid!==null)return;lid=e.pointerId;lz.setPointerCapture(lid);lx=e.clientX;ly=e.clientY;});
  lz.addEventListener('pointermove',e=>{if(e.pointerId!==lid)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;
    ctl.yaw-=dx*.0055;ctl.pitch=clamp(ctl.pitch-dy*.0045,-1.45,1.45);});
  const lend=e=>{if(e.pointerId===lid)lid=null;};lz.addEventListener('pointerup',lend);lz.addEventListener('pointercancel',lend);
  const hold=(id,on,off)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);on();});['pointerup','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>off()));};
  hold('bAct',()=>{inp.act=true;actDown();},()=>{if(inp.act){inp.act=false;actUp();}});
  hold('bUse',()=>doInteract(),()=>{});
  hold('bUp',()=>inp.up=true,()=>inp.up=false);hold('bDown',()=>inp.down=true,()=>inp.down=false);
  $('bBag').onclick=()=>openPanel('inv');$('bSet').onclick=()=>openPanel('set');
  const keys={};
  const upd=()=>{inp.mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);inp.mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);};
  addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT')return;
    if(e.code==='Escape'){if(UI.kind)closePanel();return;}
    if(UI.kind){if(e.code==='KeyI')closePanel();return;}
    keys[e.code]=true;upd();
    if(e.code==='Space'){inp.up=true;e.preventDefault();}if(e.code==='KeyC'||e.code==='ShiftLeft')inp.down=true;
    if((e.code==='KeyF'||e.code==='Enter')&&!e.repeat){inp.act=true;actDown();}
    if(e.code==='KeyE'&&!e.repeat)doInteract();if(e.code==='KeyI')openPanel('inv');
    if(e.code==='KeyZ')buildRot(-1);if(e.code==='KeyX')buildRot(1);if(e.code==='KeyV')buildMode();if(e.code==='KeyT')buildH(1);if(e.code==='KeyY')buildH(-1);if(e.code==='KeyG')dropLog();
    const n=parseInt(e.key);if(n>=1&&n<=5){const l=toolList();if(l[n-1])setTool(l[n-1]);}
  });
  addEventListener('keyup',e=>{keys[e.code]=false;upd();if(e.code==='Space')inp.up=false;if(e.code==='KeyC'||e.code==='ShiftLeft')inp.down=false;
    if(e.code==='KeyF'||e.code==='Enter'){if(inp.act){inp.act=false;actUp();}}});
  let md=false,mx0=0,my0=0;
  canvas.addEventListener('mousedown',e=>{md=true;mx0=e.clientX;my0=e.clientY;});addEventListener('mouseup',()=>md=false);
  addEventListener('mousemove',e=>{if(!md||UI.kind)return;ctl.yaw-=(e.clientX-mx0)*.005;ctl.pitch=clamp(ctl.pitch-(e.clientY-my0)*.004,-1.45,1.45);mx0=e.clientX;my0=e.clientY;});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('gesturestart',e=>e.preventDefault());
}
function initUI(){
  setupControls();
  $('start').addEventListener('click',()=>{$('start').style.display='none';goFull();setGfx(2);startGame();renderHotbar();},{once:true});
  setGfx(S.set.gfx);
}
initUI();
