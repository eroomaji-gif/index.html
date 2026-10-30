'use strict';
/* ===== ข้อมูลเกม: ปลา ไอเทม ร้านค้า ===== */
const RAR=[
{n:'Normal',c:'#b8c0c6',w:100},{n:'Uncommon',c:'#5ccf5c',w:38},{n:'Rare',c:'#4aa3ff',w:13},
{n:'Epic',c:'#b266ff',w:3.6},{n:'Legendary',c:'#ffa726',w:.9},{n:'Mythic',c:'#ff4d6d',w:.2},{n:'Exotic',c:'#3df5e6',w:.045}];
const ZONES=[{n:'ชายฝั่ง',dist:22},{n:'แนวปะการัง',dist:45},{n:'ทะเลเปิด',dist:75},{n:'ทะเลลึก',dist:110},{n:'ห้วงมืดสุดขอบโลก',dist:1e9}];
const ZDEPTH=[6,15,35,70];
function zoneOf(dist,depth){let a=0;while(a<4&&dist>ZONES[a].dist)a++;let b=0;while(b<4&&depth>ZDEPTH[b])b++;return Math.max(a,b);}

// ชื่อ, rarity, zone, ความลึกต่ำสุด(m), น้ำหนักต่ำสุด, สูงสุด(kg), ความยาวที่น้ำหนักสูงสุด(cm), ราคา, สี, รูปทรง
// รูปทรง 0=ปกติ 1=เพรียว 2=อ้วนกลม 3=แบนแบบกระเบน 4=ยาวแบบไหล 5=ฉลาม
const F_ROWS=[
['ปลาจิ๋วทราย',0,0,0,.001,.02,4,3,'#d9c9a0',0],['ปลาซิว',0,0,0,.005,.05,8,4,'#c8d6e0',1],
['ปลากระดี่ทะเล',0,0,0,.02,.2,14,6,'#e6b86a',2],['ปลาข้างเหลือง',0,0,1,.05,.6,22,9,'#e8d44d',0],
['ปลาทราย',0,0,1,.1,1,28,10,'#cdb78a',1],['ปลากะตัก',0,0,1,.003,.04,9,5,'#a9c4d6',1],
['ปลาสลิดหิน',0,0,2,.1,1.2,24,12,'#6c7d8c',2],['ปลากระบอก',0,0,2,.3,3,45,14,'#9fb1bb',1],
['ปลาทู',0,1,2,.1,.8,28,15,'#6e9fb5',1],['ปลากะพงแดงเล็ก',0,1,3,.4,4,50,18,'#d96a5a',0],
['ปลาปักเป้าธรรมดา',0,1,3,.2,2,25,20,'#b9c46a',2],['ปลากระเบนจิ๋ว',0,1,3,.3,3.5,40,22,'#a68b6a',3],
['ปลาการ์ตูน',1,0,1,.02,.2,11,45,'#ff7a1a',2],['ปลานกแก้ว',1,1,3,.5,6,60,70,'#3ad1a0',2],
['ปลากะพงขาว',1,1,4,1,12,90,85,'#cfd8dc',0],['ปลาโอ',1,2,5,1,10,80,95,'#4f7fa8',1],
['ปลาจะละเม็ด',1,1,4,.8,8,75,80,'#8d99a6',0],['ปลาสินสมุทร',1,1,4,.5,4,40,110,'#ffd23f',2],
['ปลาหมอทะเลสีฟ้า',1,1,3,.2,2,30,75,'#3f9fff',0],['ปลากระเบนน้ำเงิน',1,2,6,2,20,110,120,'#3b6fd6',3],
['ปลาไหลมอเรย์',1,2,5,1,15,130,100,'#7a8a3a',4],['ปลาใบไม้',1,2,6,.4,3,35,105,'#6fbf73',2],
['ปลากะรังจุดฟ้า',2,1,5,2,30,100,300,'#2fd0c4',0],['ปลาเข็มยักษ์',2,2,8,3,40,160,380,'#7fc8ff',1],
['ปลากระเบนธง',2,2,8,8,80,200,450,'#5a5f8c',3],['ปลาทูน่าครีบเหลือง',2,2,12,10,100,190,520,'#e5c93a',0],
['ปลาสิงโต',2,1,6,.5,3,40,340,'#e8503a',2],['ปลาแมนดาริน',2,0,3,.02,.15,8,420,'#00c8ff',2],
['ปลาไหลไฟฟ้าทะเล',2,3,20,10,90,220,600,'#ffe14d',4],['ปลาตกเบ็ดโคมไฟ',2,3,30,3,40,90,560,'#4a3a5a',2],
['ฉลามหูดำ',2,2,10,15,120,230,480,'#7b8794',5],
['ฉลามเสือ',3,3,25,100,500,380,1800,'#a8935a',5],['กระเบนราหูยักษ์',3,3,20,150,900,600,2400,'#3f4f78',3],
['มาร์ลินน้ำเงิน',3,3,30,100,700,450,2900,'#2459d6',1],['ปลาพระจันทร์ส้ม',3,3,30,120,800,350,2100,'#ff6f61',2],
['ปักเป้ายักษ์หนาม',3,3,25,60,400,220,1600,'#c5d86d',2],['ไหลมังกรทะเล',3,3,35,80,500,520,2600,'#2fa56b',4],
['ปลาดาบเงิน',3,3,40,90,600,420,3000,'#cfd6ff',1],
['ฉลามขาวใหญ่',4,4,45,500,3000,650,14000,'#dfe6ec',5],['ฉลามวาฬ',4,3,40,1500,9000,1200,22000,'#3a5d8a',5],
['ปลาพระจันทร์ทอง',4,4,50,400,2500,500,16000,'#ffc94a',2],['ไหลสายฟ้า',4,4,55,300,2000,800,18000,'#b9f0ff',4],
['เสือโคร่งเพลิง',4,4,60,600,3000,520,15000,'#ff5a1f',5],['กระเบนมังกรหยก',4,4,50,800,4000,900,20000,'#1fd39a',3],
['เมกาโลดอน',5,4,70,8000,40000,1800,90000,'#6c7a89',5],['พญานาคทะเล',5,4,80,6000,30000,2500,120000,'#36d6c8',4],
['กระเบนจักรวาล',5,4,85,10000,50000,2000,110000,'#5b3fd6',3],['ปลาสุริยะทอง',5,4,90,4000,20000,1500,140000,'#ffd700',2],
['ปลาออโรร่า',6,4,95,20000,100000,3500,500000,'#7dffb0',1],['เลวีอาธาน',6,4,110,150000,900000,6000,1500000,'#274a6b',4],
['วาฬแห่งความว่างเปล่า',6,4,120,100000,600000,5000,2200000,'#7a3fff',2]];
const FISH=F_ROWS.map((a,i)=>({id:i,name:a[0],r:a[1],z:a[2],d:a[3],w0:a[4],w1:a[5],L:a[6],p:a[7],c:a[8],sh:a[9]}));
function fishLen(sp,w){return sp.L*Math.cbrt(Math.max(w,sp.w0*.5)/sp.w1)/100;} // เมตร
function fishPrice(sp,w){const f=Math.max(0,Math.min(1,(w-sp.w0)/(sp.w1-sp.w0)));return Math.max(1,Math.round(sp.p*(.5+1.5*Math.pow(f,.7))));}
function rollWeight(sp){let u=Math.random();u=Math.random()<.04?.7+.3*Math.random():Math.pow(u,3.2);return sp.w0+(sp.w1-sp.w0)*u;}
function fmtW(w){if(w<.1)return (w*1000).toFixed(1)+' g';if(w<1000)return w.toFixed(2)+' kg';return (w/1000).toFixed(2)+' ตัน';}
function fmtL(m){return m<.1?(m*100).toFixed(1)+' cm':m<2?(m*100).toFixed(0)+' cm':m.toFixed(1)+' m';}
function fmtN(n){return Math.round(n).toLocaleString('en-US');}
function rollFish(dist,depth,luck,aurora){
  const zn=zoneOf(dist,depth);let tot=0;const arr=[];
  for(const f of FISH){
    if(f.z>zn||f.d>depth+.01)continue;
    let w=RAR[f.r].w;if(f.r>=2)w*=(1+luck)*(aurora?1.1:1);
    w*=(f.z===zn?3:Math.pow(.35,zn-f.z));arr.push([f,w]);tot+=w;}
  if(!arr.length)return FISH[0];
  let r=Math.random()*tot;for(const a of arr){r-=a[1];if(r<=0)return a[0];}
  return arr[arr.length-1][0];
}

/* ===== ไอเทม ===== */
const RODS=[
{id:'rod1',nm:'คันไม้ไผ่',pr:100,dist:14,maxW:6,col:'#c8ad6b',L:2.4,ic:'🎋'},
{id:'rod2',nm:'คันไฟเบอร์',pr:800,dist:28,maxW:30,col:'#3fa7ff',L:2.8,ic:'🎣'},
{id:'rod3',nm:'คันคาร์บอน',pr:4500,dist:48,maxW:140,col:'#2b2f36',L:3.1,ic:'🎣'},
{id:'rod4',nm:'คันเหล็กทะเล',pr:22000,dist:72,maxW:700,col:'#9aa7b4',L:3.4,ic:'🎣'},
{id:'rod5',nm:'คันไทเทเนียม',pr:110000,dist:100,maxW:3500,col:'#b6d8ff',L:3.7,ic:'🎣'},
{id:'rod6',nm:'คันคริสตัลทะเลลึก',pr:600000,dist:130,maxW:20000,col:'#59e8ff',L:4,ic:'🔱'},
{id:'rod7',nm:'คันโพไซดอน',pr:3500000,dist:160,maxW:200000,col:'#ffd54a',L:4.3,ic:'🔱'},
{id:'rod8',nm:'คันออโรร่า',pr:18000000,dist:180,maxW:1500000,col:'#7dffb0',L:4.6,ic:'🌌'}];
const LINES=[
{id:'line0',nm:'เชือกป่าน',pr:0,len:6,maxW:5,ic:'🧵'},
{id:'line1',nm:'สายไนลอน',pr:300,len:14,maxW:40,ic:'🧵'},
{id:'line2',nm:'สายถัก',pr:2000,len:30,maxW:200,ic:'🧵'},
{id:'line3',nm:'สายไฟเบอร์',pr:12000,len:60,maxW:1200,ic:'🧵'},
{id:'line4',nm:'สายเหล็กกล้า',pr:70000,len:100,maxW:8000,ic:'⛓️'},
{id:'line5',nm:'สายไทเทเนียมถัก',pr:400000,len:150,maxW:50000,ic:'⛓️'},
{id:'line6',nm:'สายโซ่มังกร',pr:2500000,len:220,maxW:300000,ic:'⛓️'},
{id:'line7',nm:'สายออโรร่า',pr:12000000,len:350,maxW:1500000,ic:'✨'}];
const HOOKS=[
{id:'hook0',nm:'ตะขอเหล็กธรรมดา',pr:0,light:0,luck:0,col:'#c0c0c0',ic:'🪝'},
{id:'hook1',nm:'ตะขอเรืองแสงจาง',pr:400,light:6,luck:.05,col:'#9dff9d',ic:'🪝'},
{id:'hook2',nm:'ตะขอเรืองแสง',pr:3000,light:14,luck:.1,col:'#7de8ff',ic:'🪝'},
{id:'hook3',nm:'ตะขอแสงจันทร์',pr:25000,light:28,luck:.18,col:'#e8e0ff',ic:'🌙'},
{id:'hook4',nm:'ตะขอดวงอาทิตย์',pr:200000,light:55,luck:.3,col:'#ffd54a',ic:'☀️'},
{id:'hook5',nm:'ตะขอซุปเปอร์โนวา',pr:2000000,light:90,luck:.5,col:'#ff9ae8',ic:'💫'}];
const BAITS=[
{id:'bait1',nm:'ไส้เดือน',pr:30,pack:10,luck:0,speed:1,ic:'🪱'},
{id:'bait2',nm:'กุ้งฝอย',pr:150,pack:10,luck:.1,speed:1.2,ic:'🦐'},
{id:'bait3',nm:'หมึกสด',pr:900,pack:10,luck:.25,speed:1.4,ic:'🦑'},
{id:'bait4',nm:'เหยื่อเรืองแสง',pr:6000,pack:10,luck:.5,speed:1.7,ic:'🐛'},
{id:'bait5',nm:'เหยื่อทองคำ',pr:60000,pack:10,luck:1,speed:2,ic:'🥇'},
{id:'bait6',nm:'เหยื่ออัญมณีลึก',pr:500000,pack:10,luck:2,speed:2.5,ic:'💎'}];
const BAGS=[{cap:20,pr:0},{cap:30,pr:200},{cap:45,pr:700},{cap:65,pr:2500},{cap:90,pr:9000},{cap:130,pr:35000},{cap:200,pr:140000},{cap:300,pr:600000},{cap:500,pr:3000000}];
const TANKS=[
{nm:'กลั้นหายใจ',o2:25,depth:6,pr:0},{nm:'ชุดดำน้ำ+ถังเล็ก',o2:70,depth:15,pr:500},
{nm:'ถังมาตรฐาน',o2:150,depth:30,pr:3000},{nm:'ถังคู่',o2:300,depth:60,pr:20000},
{nm:'ถังไทเทเนียม',o2:600,depth:100,pr:150000},{nm:'ชุดดำน้ำลึกพิเศษ',o2:1200,depth:200,pr:1000000}];
const SPEARS=[
{id:'sp0',nm:'ไม้แหลม',pr:0,maxW:1.5,reach:2.4,ic:'🪵'},
{id:'sp1',nm:'ฉมวกเหล็ก',pr:600,maxW:40,reach:3,ic:'🔱'},
{id:'sp2',nm:'ฉมวกไทเทเนียม',pr:8000,maxW:400,reach:3.6,ic:'🔱'},
{id:'sp3',nm:'ฉมวกพลังงาน',pr:150000,maxW:5000,reach:4.2,ic:'⚡'}];
const TOOLS=[
{id:'axe',nm:'ขวาน',pr:300,ic:'🪓'},{id:'shovel',nm:'จอบ',pr:250,ic:'⛏️'}];
const LAMPS=[
{id:'lamp1',nm:'ไฟฉายดำน้ำ',pr:1500,r:10,ic:'🔦'},{id:'lamp2',nm:'ไฟหมวกกำลังสูง',pr:20000,r:22,ic:'🔦'},
{id:'lamp3',nm:'ไฟหัวใจทะเล',pr:150000,r:45,ic:'💡'}];
const ITEMS={};
[[RODS,'rod'],[LINES,'line'],[HOOKS,'hook'],[BAITS,'bait'],[SPEARS,'spear'],[TOOLS,'tool'],[LAMPS,'lamp']].forEach(([a,c])=>a.forEach(o=>{o.cat=c;ITEMS[o.id]=o;}));

/* ===== ฤดูกาล ===== */
const SEASONS=[
{id:'summer',n:'ฤดูร้อน ☀️',top:'#2f86dc',hor:'#bfe6ff',grass:'#62b03f',leaf:'#3c9a3a',water:'#2aa0d8',part:null,fog:520},
{id:'rainy',n:'ฤดูฝน 🌧️',top:'#4c5f70',hor:'#9aa8b3',grass:'#3f8f4a',leaf:'#2f7d44',water:'#2a7aa8',part:'rain',fog:230},
{id:'autumn',n:'ใบไม้ร่วง 🍂',top:'#5c8fc0',hor:'#f0d7b0',grass:'#b0883a',leaf:'#e0752a',water:'#2f86b8',part:'leaf',fog:480},
{id:'winter',n:'ฤดูหนาว ❄️',top:'#7f9cbd',hor:'#e6eef5',grass:'#e9f1f6',leaf:'#d4e6ee',water:'#3a86b0',part:'snow',fog:300},
{id:'spring',n:'ใบไม้ผลิ 🌸',top:'#4fa3e6',hor:'#ffe3ef',grass:'#7fd06c',leaf:'#f6a9c8',water:'#38a8d8',part:'petal',fog:500},
{id:'fish',n:'ฝนปลา 🐟',top:'#46497a',hor:'#a995c9',grass:'#4aa07a',leaf:'#3a8a7a',water:'#2a6fb8',part:'fish',fog:320}];
const SEASON_DAYS=2;

/* ===== อาหาร ===== */
function nutrition(w){return Math.min(60,4+12*Math.log10(1+w*3));}
