'use strict';
/* ===== fishmodel.js — ใช้โมเดลปลา 3D (GLB จาก model.js) แทนปลาที่สร้างจากโค้ด =====
   วางไฟล์นี้ "หลัง world.js" (ไม่ต้องแก้ world.js / game.js)
   - ถ้าโมเดลโหลดไม่ได้ หรือชนิดปลานั้นไม่มีโมเดล จะใช้ปลาแบบโค้ดเดิมอัตโนมัติ
   - ปรับการจับคู่ชนิดปลา -> โมเดลได้ที่ BY_ID / BY_SHAPE ด้านล่าง */
(function () {
  if (!window.MODELS || !THREE.GLTFLoader || !THREE.SkeletonUtils) {
    console.warn('fishmodel: ไม่พบ model.js / GLTFLoader / SkeletonUtils -> ใช้ปลาแบบโค้ดเดิม');
    return;
  }

  /* 1) จับคู่ชนิดปลา -> key ใน model.js
        BY_ID   : เจาะจงตาม id ในตาราง F_ROWS (data.js)
        BY_SHAPE: ตามรูปทรง sh (0 ปกติ,1 เพรียว,2 อ้วนกลม,3 กระเบน,4 ไหล,5 ฉลาม)
                  ถ้ามีหลายตัว จะสลับตาม id ปลา
        ชนิดที่ไม่เข้าเงื่อนไขใด (กระเบน/ไหล) จะใช้ปลาแบบโค้ดเดิม */
  const BY_ID = { 10: 'blobfish', 12: 'clownfish', 17: 'butterflyFish', 26: 'blackLionFish', 27: 'butterflyFish', 29: 'anglerfish' };
  const BY_SHAPE = {
    0: ['cardinalFish', 'fish', 'butterflyFish'],
    1: ['fish'],
    2: ['blueGoldfish', 'blobfish'],
    5: ['dolphin']
  };
  const SWIM_CLIPS = ['Swimming_Normal', 'Swim', 'Swim.001'];

  function pickKey(sp) {
    if (BY_ID[sp.id]) return BY_ID[sp.id];
    const list = BY_SHAPE[sp.sh];
    return list ? list[sp.id % list.length] : null;
  }

  /* 2) โหลดเฉพาะโมเดลที่ใช้ */
  const keys = new Set(Object.values(BY_ID));
  Object.values(BY_SHAPE).forEach(a => a.forEach(k => keys.add(k)));
  const CACHE = {};
  const loader = new THREE.GLTFLoader();
  keys.forEach(key => {
  loader.parse(MODELS.buffer(key), '', gltf => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root), size = new THREE.Vector3(), ctr = new THREE.Vector3();
      box.getSize(size); box.getCenter(ctr);
      root.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false; // SkinnedMesh ถูกตัดทิ้งผิดพลาดได้ถ้าเปิดไว้
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.metalness = 0; m.roughness = .75; });
      });
      const clip = gltf.animations.find(a => SWIM_CLIPS.includes(a.name.split('|').pop()));
      // ความยาวปลาอยู่แกน Z และหัวไปทาง +Z -> ปรับให้ยาว 1 หน่วยและหัวไป +X (ตามที่เกมต้องการ)
      CACHE[key] = { root, clip, offset: ctr.clone().negate(), k: 1 / size.z };
    }, err => console.warn('fishmodel: โหลด ' + key + ' ไม่ได้', err));
  });

  /* 3) แทนที่ buildFish */
  const MIX = [];
  const buildFishProc = window.buildFish;
  window.buildFish = function (sp) {
    const key = pickKey(sp), D = key && CACHE[key];
    if (!D) return buildFishProc(sp);
    const inst = THREE.SkeletonUtils.clone(D.root);
    inst.position.copy(D.offset);
    const inner = new THREE.Group();
    inner.add(inst);
    inner.scale.setScalar(D.k);
    inner.rotation.y = Math.PI / 2;
    const g = new THREE.Group();
    g.add(inner);
    g.userData.tail = new THREE.Object3D(); // เกมสั่งหางปลาที่นี่ -> ไม่มีผลกับโมเดลจริง (ใช้แอนิเมชันในไฟล์แทน)
    g.userData.model = key;
    if (D.clip) {
      const mixer = new THREE.AnimationMixer(inst);
      mixer.clipAction(D.clip).play();
      mixer.update(Math.random() * D.clip.duration);
      MIX.push({ mixer, obj: g, age: 0 });
    }
    return g;
  };

  /* 4) อัปเดตแอนิเมชัน (ลูปของตัวเอง ไม่ต้องแก้ game.js) */
  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (let i = MIX.length - 1; i >= 0; i--) {
      const m = MIX[i]; m.age += dt;
      if (!m.obj.parent) { if (m.age > 1) MIX.splice(i, 1); continue; } // ปลาถูกลบออกจากฉากแล้ว
      m.mixer.update(dt);
    }
  })(last);
})();
