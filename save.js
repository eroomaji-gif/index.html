'use strict';
/* ===== เซฟ: localStorage + Supabase =====
ตั้งค่า Supabase: ใส่ URL และ anon key ด้านล่าง แล้วรัน SQL นี้ใน Supabase > SQL Editor

create table if not exists game_saves(
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now());
alter table game_saves enable row level security;
create policy "own save select" on game_saves for select using (auth.uid()=user_id);
create policy "own save insert" on game_saves for insert with check (auth.uid()=user_id);
create policy "own save update" on game_saves for update using (auth.uid()=user_id);
*/
const SUPABASE_URL='';      // เช่น https://xxxx.supabase.co
const SUPABASE_KEY='';      // anon public key
const SAVE_KEY='fishgame_save_v1', IMG_KEY='fishgame_imgs_v1';

function defaultState(){return{
  coins:0,owned:{line0:1,hook0:1,rod1:1},eq:{rod:'rod1',line:'line0',hook:'hook0',bait:null,spear:null,lamp:null},
  baits:{},tank:0,bag:0,fish:[],dex:{},hp:100,food:100,x:null,z:null,tod:20,day:0,
  tool:'rod',set:{cam:'tp',gfx:2,shadow:1},ver:2};}
let S=defaultState();
let sb=null,sbUser=null,cloudDirty=false,lastCloud=0;
let IMGS={};try{IMGS=JSON.parse(localStorage.getItem(IMG_KEY)||'{}');}catch(e){}

function initSupabase(){
  try{if(SUPABASE_URL&&SUPABASE_KEY&&window.supabase){sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    sb.auth.getSession().then(r=>{if(r.data&&r.data.session){sbUser=r.data.session.user;cloudLoad();}if(window.refreshAccountUI)refreshAccountUI();});}}catch(e){console.warn(e);}
}
function packSave(){
  const d=JSON.parse(JSON.stringify(S));
  d.x=P.x;d.z=P.z;d.hp=S.hp;d.world=exportWorld();d.t=Date.now();return d;
}
function applySave(d){
  S=Object.assign(defaultState(),d);S.set=Object.assign({cam:'tp',gfx:2,shadow:1},d.set||{});
  S.eq=Object.assign({rod:null,line:'line0',hook:'hook0',bait:null,spear:null,lamp:null},d.eq||{});
  if((d.ver||1)<2){if(!RODS.some(r=>S.owned[r.id])){S.owned.rod1=1;S.eq.rod='rod1';}S.ver=2;}
  if(d.world)importWorld(d.world);
}
function saveLocal(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(packSave()));}catch(e){console.warn('save fail',e);}}
function loadLocal(){try{const t=localStorage.getItem(SAVE_KEY);if(t){applySave(JSON.parse(t));return true;}}catch(e){console.warn(e);}return false;}
async function cloudSave(){
  if(!sb||!sbUser)return;
  try{const r=await sb.from('game_saves').upsert({user_id:sbUser.id,data:packSave(),updated_at:new Date().toISOString()});
    if(r.error)console.warn(r.error);else{cloudDirty=false;lastCloud=Date.now();}}catch(e){console.warn(e);}
}
async function cloudLoad(){
  if(!sb||!sbUser)return false;
  try{const r=await sb.from('game_saves').select('data').eq('user_id',sbUser.id).maybeSingle();
    if(r.data&&r.data.data){applySave(r.data.data);afterLoad();toast('โหลดข้อมูลจากบัญชีแล้ว ☁️');return true;}
    else{await cloudSave();toast('สร้างเซฟบนคลาวด์แล้ว ☁️');}}catch(e){console.warn(e);}
  return false;
}
function markDirty(){cloudDirty=true;}
setInterval(()=>{if(typeof P==='undefined')return;saveLocal();if(cloudDirty&&sb&&sbUser)cloudSave();},12000);
window.addEventListener('beforeunload',()=>{if(typeof P!=='undefined')saveLocal();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&typeof P!=='undefined'){saveLocal();if(sb&&sbUser)cloudSave();}});
async function authDo(kind,email,pass){
  if(!sb)return'ยังไม่ได้ตั้งค่า Supabase (ใส่ URL/KEY ใน save.js)';
  try{
    if(kind==='up'){const r=await sb.auth.signUp({email,password:pass});if(r.error)return r.error.message;
      if(r.data.session){sbUser=r.data.user;await cloudLoad();return'สมัครสำเร็จ ✅';}return'สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';}
    if(kind==='in'){const r=await sb.auth.signInWithPassword({email,password:pass});if(r.error)return r.error.message;sbUser=r.data.user;await cloudLoad();return'เข้าสู่ระบบสำเร็จ ✅';}
    if(kind==='out'){await sb.auth.signOut();sbUser=null;return'ออกจากระบบแล้ว';}
  }catch(e){return String(e.message||e);}
}
