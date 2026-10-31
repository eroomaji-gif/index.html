'use strict';
/* =====================================================================
   models.js  —  เปลี่ยนต้นไม้ / พุ่มไม้ / หญ้า / ดอกไม้ ให้เป็นโมเดล .glb
                 และเพิ่มของที่ของเก่าไม่มี (ปาล์ม, เฟิร์น, พืชใบ)
   วิธีใช้: ใส่ <script src="models.js"></script> "ต่อจาก world.js"
            แล้วอัปโหลดไฟล์ .glb ไว้ในโฟลเดอร์ models/ (ตั้งชื่อโฟลเดอร์ที่ DIR)
   ถ้าไฟล์ไหนโหลดไม่ได้ ของเก่าในเกมจะยังอยู่ตามเดิม ไม่พัง
   ===================================================================== */
(function(){
if(typeof TREES==='undefined'||typeof scene==='undefined'||typeof applySeason==='undefined'){
  console.error('[models] ต้องใส่ models.js ต่อจาก world.js');return;}

const DIR='models/';                 // โฟลเดอร์ที่วางไฟล์ .glb
const MAXTEX=isMobile?512:1024;      // ย่อรูปพื้นผิวไม่ให้ใหญ่เกินนี้ (ประหยัดแรมมือถือ)

/* ชื่อไฟล์ = ชื่อเดิมที่คุณส่งมา (ตัดรหัสหน้าชื่อออก)
   merge = รวมทั้งไฟล์เป็นชิ้นเดียว | ไม่ใส่ = แยกเป็นหลายแบบ (1 mesh = 1 แบบ)
   fit   = 'h' ปรับตามความสูง | 'w' ปรับตามความกว้าง   tint = ให้สีเปลี่ยนตามฤดู */
const SPEC={
  treeA:{f:'Tree_by_Quaternius_-_aVOxaHRPWe.glb',merge:1,fit:'h',tint:'leaf'},
  treeB:{f:'Tree_by_Quaternius_-_YWjGDJ9F7g.glb',merge:1,fit:'h',tint:'leaf'},
  bush: {f:'Bush_with_Flowers_by_Quaternius_-_U1ymDy8tbY.glb',merge:1,fit:'h',tint:'leaf'},
  plant:{f:'Plant_by_Quaternius_-_NrJN7UcglF.glb',merge:1,fit:'h',tint:'leaf'},
  fern1:{f:'Fern_by_Quaternius_-_jqcanvH7D6.glb',merge:1,fit:'w',tint:'leaf'},
  fern2:{f:'fern_plant_by_Geoffrey_Bell_-_fQ9cPdkwvAY.glb',merge:1,fit:'h',center:1,tint:'leaf'},
  grass:{f:'Grass_by_Quaternius_-_UGTOzcO3P2.glb',fit:'h',tint:'grass'},
  flower:{f:'Flowers_by_Quaternius_-_NBUxHir6FJ.glb',fit:'h'},
  palmA:{f:'Palm_Tree_by_Quaternius_-_A6cKJYFsIb.glb',merge:1,fit:'h'},
  palmB:{f:'Palm_Trees_by_Quaternius_-_VYslw9DEi6.glb',fit:'h'},
  palmC:{f:'Palm_tree_by_Poly_by_Google_-_1l79utpMAy0.glb',merge:1,fit:'h',center:1}
};

const WM=window.WM={leafMats:[],grassMats:[],trees:null,flowers:null,palms:[],grassI:[]};

/* ---------- ตัวอ่านไฟล์ .glb (ไม่ต้องพึ่ง GLTFLoader) ---------- */
const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const NORM={5120:127,5121:255,5122:32767,5123:65535};
async function parseGLB(url){
  const res=await fetch(url);if(!res.ok)throw new Error(url+' → '+res.status);
  const buf=await res.arrayBuffer(),dv=new DataView(buf);
  if(dv.getUint32(0,true)!==0x46546C67)throw new Error('ไม่ใช่ไฟล์ .glb: '+url);
  let json,bin,off=12;
  while(off+8<=buf.byteLength){
    const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;
    if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,off,len)));
    else if(type===0x004E4942&&!bin)bin=buf.slice(off,off+len);
    off+=len;
  }
  const acc=(i,toFloat)=>{
    const a=json.accessors[i],bv=json.bufferViews[a.bufferView],T=CT[a.componentType],nc=NC[a.type],bs=T.BYTES_PER_ELEMENT;
    const stride=bv.byteStride||nc*bs,start=(bv.byteOffset||0)+(a.byteOffset||0);
    let out;
    if(stride===nc*bs&&start%bs===0)out=new T(bin,start,a.count*nc).slice();
    else{out=new T(a.count*nc);const d=new DataView(bin),g='get'+T.name.replace('Array','');
      for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++)out[n*nc+c]=d[g](start+n*stride+c*bs,true);}
    if(toFloat&&T!==Float32Array){const f=new Float32Array(out.length),m=a.normalized?NORM[a.componentType]:1;for(let n=0;n<out.length;n++)f[n]=Math.max(out[n]/m,-1);out=f;}
    return{data:out,nc};
  };
  /* พื้นผิว */
  const texC={};
  const tex=ti=>texC[ti]||(texC[ti]=(async()=>{
    const im=json.images[json.textures[ti].source],bv=json.bufferViews[im.bufferView];
    const blob=new Blob([new Uint8Array(bin,bv.byteOffset||0,bv.byteLength)],{type:im.mimeType||'image/png'});
    let src;
    try{
      let bm=await createImageBitmap(blob,{premultiplyAlpha:'none'});const mx=Math.max(bm.width,bm.height);
      if(mx>MAXTEX){const k=MAXTEX/mx;if(bm.close)bm.close();
        bm=await createImageBitmap(blob,{premultiplyAlpha:'none',resizeWidth:Math.max(1,Math.round(bm.width*k)),resizeHeight:Math.max(1,Math.round(bm.height*k)),resizeQuality:'high'});}
      src=bm;
    }catch(e){ // เบราว์เซอร์เก่า: ใช้ canvas แทน
      const u=URL.createObjectURL(blob),img=new Image();img.src=u;await img.decode();
      const k=Math.min(1,MAXTEX/Math.max(img.width,img.height)),c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);src=c;
    }
    const T=new THREE.Texture(src);T.flipY=false;T.wrapS=T.wrapT=THREE.RepeatWrapping;
    if(THREE.SRGBColorSpace!==undefined)T.colorSpace=THREE.SRGBColorSpace;
    else if(typeof renderer!=='undefined'&&renderer.outputEncoding===THREE.sRGBEncoding)T.encoding=THREE.sRGBEncoding;
    T.needsUpdate=true;return T;})());
  /* วัสดุ */
  const matC={},mats=[];
  const mat=async(mi,vc)=>{
    const key=mi+'|'+vc;if(matC[key])return matC[key];
    const m=json.materials[mi]||{},p=m.pbrMetallicRoughness||{},bc=p.baseColorFactor||[1,1,1,1];
    const cut=m.alphaMode==='BLEND'||m.alphaMode==='MASK';
    const o={color:new THREE.Color(bc[0],bc[1],bc[2]),vertexColors:!!vc,side:(cut||m.doubleSided)?THREE.DoubleSide:THREE.FrontSide};
    if(cut)o.alphaTest=m.alphaMode==='MASK'?(m.alphaCutoff!=null?m.alphaCutoff:.5):.5; // ตัดขอบใบแบบคม (ไม่ต้องเรียงลำดับความโปร่ง)
    const x=new THREE.MeshLambertMaterial(o);x.name=m.name||'';
    if(p.baseColorTexture)x.map=await tex(p.baseColorTexture.index);
    if(cut&&x.map){ // ให้เงาตามรูปใบไม้ ไม่ใช่เงาสี่เหลี่ยม
      x.userData.depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:x.map,alphaTest:x.alphaTest,side:THREE.DoubleSide});}
    mats.push(x);return matC[key]=x;
  };
  /* เดินตามโหนดแล้วอบตำแหน่ง/หมุน/ขนาดลงในเรขาคณิตเลย */
  const parts=[],nodes=json.nodes||[];
  const walk=async(ni,pm)=>{
    const n=nodes[ni],lm=new THREE.Matrix4();
    if(n.matrix)lm.fromArray(n.matrix);
    else lm.compose(new THREE.Vector3().fromArray(n.translation||[0,0,0]),new THREE.Quaternion().fromArray(n.rotation||[0,0,0,1]),new THREE.Vector3().fromArray(n.scale||[1,1,1]));
    const wm=pm.clone().multiply(lm);
    if(n.mesh!=null){
      const prims=[];
      for(const pr of json.meshes[n.mesh].primitives){
        if((pr.mode!=null?pr.mode:4)!==4)continue;
        const A=pr.attributes,g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.BufferAttribute(acc(A.POSITION,true).data,3));
        if(A.NORMAL)g.setAttribute('normal',new THREE.BufferAttribute(acc(A.NORMAL,true).data,3));
        if(A.TEXCOORD_0)g.setAttribute('uv',new THREE.BufferAttribute(acc(A.TEXCOORD_0,true).data,2));
        let vc=false;
        if(A.COLOR_0){const c=acc(A.COLOR_0,true);let d=c.data;
          if(c.nc===4){const s=new Float32Array(d.length/4*3);for(let q=0,r=0;q<d.length;q+=4,r+=3){s[r]=d[q];s[r+1]=d[q+1];s[r+2]=d[q+2];}d=s;}
          g.setAttribute('color',new THREE.BufferAttribute(d,3));vc=true;}
        if(pr.indices!=null){let ix=acc(pr.indices).data;if(ix instanceof Uint8Array)ix=Uint16Array.from(ix);g.setIndex(new THREE.BufferAttribute(ix,1));}
        if(!A.NORMAL)g.computeVertexNormals();
        g.applyMatrix4(wm);
        prims.push({geo:g,mat:await mat(pr.material!=null?pr.material:0,vc)});
      }
      parts.push({prims,anchor:new THREE.Vector3().setFromMatrixPosition(wm)});
    }
    for(const c of n.children||[])await walk(c,wm);
  };
  for(const r of json.scenes[json.scene||0].nodes)await walk(r,new THREE.Matrix4());
  return{parts,mats};
}

/* ---------- โหลด + ปรับขนาดให้ "สูง/กว้าง = 1" และเท้าอยู่ที่ y=0 ---------- */
const cache={};
const load=key=>cache[key]||(cache[key]=build(key));
async function build(key){
  const sp=SPEC[key],raw=await parseGLB(DIR+sp.f);
  let parts=raw.parts;
  if(sp.merge)parts=[{prims:[].concat(...parts.map(p=>p.prims)),anchor:new THREE.Vector3()}];
  let big=0;
  parts.forEach(p=>{const b=new THREE.Box3();p.prims.forEach(q=>{q.geo.computeBoundingBox();b.union(q.geo.boundingBox);});
    const s=b.getSize(new THREE.Vector3());p.box=b;p.ext=sp.fit==='w'?Math.max(s.x,s.z):s.y;big=Math.max(big,p.ext);});
  const k=1/big;
  parts.forEach(p=>{const c=p.box.getCenter(new THREE.Vector3()),ax=sp.center?c.x:p.anchor.x,az=sp.center?c.z:p.anchor.z;
    p.prims.forEach(q=>{q.geo.translate(-ax,-p.box.min.y,-az);q.geo.scale(k,k,k);q.geo.computeBoundingSphere();});
    p.h=(p.box.max.y-p.box.min.y)*k;});
  raw.mats.forEach(m=>{if(sp.tint&&!/bark|trunk|flower/i.test(m.name))(sp.tint==='grass'?WM.grassMats:WM.leafMats).push(m);});
  WM.season(seasonIdx);
  return{parts};
}
const meshes=(part,cast,recv)=>{const g=new THREE.Group();
  part.prims.forEach(q=>{const m=new THREE.Mesh(q.geo,q.mat);m.castShadow=cast;m.receiveShadow=recv;
    if(cast&&q.mat.userData.depth)m.customDepthMaterial=q.mat.userData.depth;g.add(m);});return g;};
const _col=new THREE.Color();
function instanced(part,list,cast){ // list: [{x,y,z,s,sy,ry,c}]
  const d=new THREE.Object3D(),out=[];
  part.prims.forEach(q=>{
    const im=new THREE.InstancedMesh(q.geo,q.mat,list.length);
    list.forEach((o,j)=>{d.position.set(o.x,o.y,o.z);d.rotation.set(0,o.ry,0);d.scale.set(o.s,o.s*(o.sy||1),o.s);d.updateMatrix();
      im.setMatrixAt(j,d.matrix);if(o.c!=null)im.setColorAt(j,_col.setRGB(o.c,o.c,o.c));});
    im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;
    im.frustumCulled=false;im.castShadow=!!cast;im.receiveShadow=true;
    if(cast&&q.mat.userData.depth)im.customDepthMaterial=q.mat.userData.depth;
    out.push(im);});
  return out;
}

/* ---------- สีตามฤดู: คูณสีพื้นผิวด้วย "สีฤดูนี้ ÷ สีฤดูแรก" (ฤดูแรกจะเห็นสีจริงของโมเดล) ---------- */
const lim=v=>Math.min(1.5,Math.max(.3,v));
function ratio(key,i){const a=new THREE.Color(SEASONS[i][key]),b=new THREE.Color(SEASONS[0][key]);
  return new THREE.Color(lim(a.r/Math.max(b.r,.04)),lim(a.g/Math.max(b.g,.04)),lim(a.b/Math.max(b.b,.04)));}
WM.season=function(i){
  const lc=ratio('leaf',i),gc=ratio('grass',i);
  WM.leafMats.forEach(m=>m.color.copy(lc));WM.grassMats.forEach(m=>m.color.copy(gc));
  if(WM.flowers)WM.flowers.visible=(i===4||i===0);
};
const _apply=window.applySeason;
window.applySeason=function(i){_apply.apply(this,arguments);WM.season(i);};

/* ---------- ต้นไม้ (ตัดได้เหมือนเดิม) ---------- */
const INVIS=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}); // ลำต้นเดิมกลายเป็นตัวรับการฟัน มองไม่เห็น
function syncTrunks(){TREES.forEach(t=>{const g=!!(t.canopy&&t.canopy.userData.glb);t.trunk.material=g?INVIS:M.trunk;t.trunk.castShadow=!g;});}
function makeCanopy(t){
  const src=WM.trees[t.idx%WM.trees.length].parts[0],total=t.H+2.6; // สูงรวมยอด = ลำต้นเดิม + 2.6
  const can=new THREE.Group(),inner=meshes(src,true,true);
  can.position.set(t.x,t.gy+t.H,t.z);               // ตำแหน่งเดียวกับพุ่มใบเดิม → cutTree เดิมใช้ได้เลย
  inner.scale.setScalar(total);inner.position.y=-t.H-total*.02;inner.rotation.y=(t.idx*2.399)%6.283;
  can.add(inner);can.userData.glb=true;return can;
}
function swapTree(t){
  if(!WM.trees||!t.canopy||t.canopy.userData.glb)return;
  scene.remove(t.canopy);t.canopy=makeCanopy(t);scene.add(t.canopy);
}
async function doTrees(){
  WM.trees=(await Promise.all([load('treeA'),load('treeB')]));
  TREES.forEach(swapTree);syncTrunks();
}
/* ต้นไม้ล้ม: ตัดส่วนโคนที่อยู่ใต้รอยตัดทิ้ง ให้เหลือแต่ท่อนบนที่ล้ม */
const _upv=new THREE.Vector3(0,1,0),_nv=new THREE.Vector3();
function prepFall(f){
  try{
    renderer.localClippingEnabled=true;
    const pl=new THREE.Plane().setFromNormalAndCoplanarPoint(_upv,f.g.position);f.plane=pl;
    f.g.children[0].visible=false;                  // ท่อนไม้ทรงกระบอกเดิม (จะโผล่ตอนล้มเสร็จ)
    f.can.traverse(o=>{if(!o.isMesh)return;
      o.material=o.material.clone();o.material.clippingPlanes=[pl];o.material.clipShadows=true;
      if(o.customDepthMaterial)o.customDepthMaterial=o.customDepthMaterial.clone();});
  }catch(e){console.warn('[models] clip fail',e);}
}
const _cut=window.cutTree;
window.cutTree=function(t,hitY,fx,fz){
  const had=!!(t.canopy&&t.canopy.userData.glb),n=FALLING.length;
  const ok=_cut.apply(this,arguments);
  if(ok&&had&&FALLING.length>n)prepFall(FALLING[FALLING.length-1]);
  syncTrunks();return ok;
};
const _upd=window.updateFalling;
window.updateFalling=function(dt){
  _upd.apply(this,arguments);
  for(const f of FALLING)if(f.plane){_nv.copy(_upv).applyQuaternion(f.g.quaternion);f.plane.setFromNormalAndCoplanarPoint(_nv,f.g.position);}
};
const _reset=window.resetWorld;
window.resetWorld=function(){_reset.apply(this,arguments);TREES.forEach(swapTree);syncTrunks();};
const _imp=window.importWorld;
window.importWorld=function(){_imp.apply(this,arguments);syncTrunks();};

/* ---------- พุ่มไม้ → พุ่มดอก / พืชใบ / เฟิร์น (ตำแหน่งเดิมของพุ่มเก่า) ---------- */
async function doBushes(){
  const olds=scene.children.filter(o=>o.isMesh&&o.geometry===lg&&o.material===M.leaf);
  const L=await Promise.all(['bush','plant','fern1','fern2'].map(load));
  const size=[1.5,1.0,1.8,1.5],r=mulberry(4242);
  olds.forEach((o,i)=>{
    const k=i%4,s=size[k]*(.75+r()*.5),g=meshes(L[k].parts[0],true,true);
    g.position.set(o.position.x,gH(o.position.x,o.position.z)-.02,o.position.z);
    g.rotation.y=r()*6.283;g.scale.setScalar(s);scene.add(g);scene.remove(o);});
}

/* ---------- หญ้า (แทน 260 กรวย) ---------- */
async function doGrass(){
  const L=await load('grass'),r=mulberry(777),m4=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  const lists=L.parts.map(()=>[]),step=isMobile?2:1;
  for(let k=0;k<grass.count;k+=step){
    grass.getMatrixAt(k,m4);m4.decompose(p,q,sc);
    lists[Math.floor(r()*lists.length)].push({x:p.x,y:p.y-.02,z:p.z,s:.55*sc.x*(.85+r()*.3),sy:.85+r()*.4,ry:r()*6.283,c:grassBase[k]});}
  L.parts.forEach((part,i)=>{if(!lists[i].length)return;instanced(part,lists[i],false).forEach(im=>{scene.add(im);WM.grassI.push(im);});});
  scene.remove(grass);
}

/* ---------- ดอกไม้ (แทน 90 ลูกกลม) ---------- */
async function doFlowers(){
  const L=await load('flower'),r=mulberry(909),m4=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  const lists=L.parts.map(()=>[]),step=isMobile?2:1;
  for(let k=0;k<flowers.count;k+=step){
    flowers.getMatrixAt(k,m4);m4.decompose(p,q,sc);
    lists[Math.floor(r()*lists.length)].push({x:p.x,y:p.y-.18,z:p.z,s:.5*(.8+r()*.6),ry:r()*6.283});}
  const grp=new THREE.Group();
  L.parts.forEach((part,i)=>{if(lists[i].length)instanced(part,lists[i],false).forEach(im=>grp.add(im));});
  grp.visible=(seasonIdx===4||seasonIdx===0);scene.add(grp);WM.flowers=grp;scene.remove(flowers);
}

/* ---------- ปาล์ม (ของใหม่ — ริมหาด) ---------- */
async function doPalms(){
  const L=await Promise.all(['palmA','palmB','palmC'].map(load)),V=[];
  L[0].parts.forEach(p=>V.push([p,7]));L[1].parts.forEach(p=>V.push([p,7.5]));L[2].parts.forEach(p=>V.push([p,8.5]));
  const r=mulberry(31337),avoid=[[HUT.cx,HUT.cz],[CAMP.x,CAMP.z],[STALL.x,STALL.z]],placed=TREES.map(t=>[t.x,t.z]);
  const want=isMobile?9:14;let n=0,tries=0;
  while(n<want&&tries++<900){
    const a=r()*6.283,rr=29+r()*14,x=Math.cos(a)*rr,z=Math.sin(a)*rr,h=gH(x,z);
    if(h<.3||h>1.1||(x>24&&Math.abs(z)<7)||!farFrom(x,z,avoid,8)||!farFrom(x,z,placed,5))continue;
    const v=V[Math.floor(r()*V.length)],g=meshes(v[0],true,true);
    g.position.set(x,h-.05,z);g.rotation.y=r()*6.283;g.scale.setScalar(v[1]*(.85+r()*.35));
    scene.add(g);WM.palms.push(g);placed.push([x,z]);colliders.push({x,z,r:.45});n++;}
}

/* ---------- เริ่มโหลด (แต่ละอย่างโหลดแยกกัน พังอันหนึ่งไม่กระทบอันอื่น) ---------- */
const run=(name,fn)=>fn().catch(e=>console.warn('[models] '+name+' โหลดไม่สำเร็จ — ใช้ของเดิมต่อ:',e));
WM.ready=Promise.all([run('trees',doTrees),run('bushes',doBushes),run('grass',doGrass),run('flowers',doFlowers),run('palms',doPalms)])
  .then(()=>{WM.season(seasonIdx);console.log('[models] เสร็จ');});
WM._parse=parseGLB;WM._load=load;
})();
