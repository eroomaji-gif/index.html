'use strict';
/* ===== fishtest.js — เมนูเสกปลาเพื่อเช็กโมเดล (วางหลัง admin.js) =====
   เปิดโหมดแอดมิน (👑) แล้วจะมีปุ่ม 🐟 ใต้ปุ่ม 👑 กดเพื่อเปิดเมนู
   แตะชื่อปลา -> ปลาหล่นจากฟ้า 28 m ลงมาตรงหน้าคุณ (ไม่ทำอันตรายผู้เล่น)
   เมนูแสดงเฉพาะชนิดที่ผูกโมเดลไว้ (เปิด "แสดงทั้งหมด" เพื่อดูแบบโค้ดเดิมด้วย) */
(function () {
  const FALL = [];
  let realSize = false, showAll = false;

  /* ---------- เสกปลา ---------- */
  function spawn(sp) {
    const len = realSize ? Math.max(fishLen(sp, sp.w1), .05) : 1.6;
    const m = buildFish(sp); m.scale.setScalar(len);
    const x = P.x - Math.sin(ctl.yaw) * 3.5, z = P.z - Math.cos(ctl.yaw) * 3.5;
    m.position.set(x, P.y + 28, z); m.rotation.y = ctl.yaw;
    scene.add(m);
    FALL.push({ m, len, x, z, yaw: ctl.yaw, vy: 0, t: 0, done: false, water: false, rest: 0 });
    while (FALL.length > 10) scene.remove(FALL.shift().m);
    toast('🐟 เสก ' + sp.name + (m.userData.model ? ' (โมเดล ' + m.userData.model + ')' : ' (แบบโค้ดเดิม)'), 2200);
  }
  function clearAll() { FALL.forEach(f => scene.remove(f.m)); FALL.length = 0; }

  function step(dt) {
    for (let i = FALL.length - 1; i >= 0; i--) {
      const f = FALL[i]; f.t += dt;
      if (f.done) {
        if (f.water) f.m.position.y = f.rest + Math.sin(f.t * 2) * .05;
        if (f.t > 120) { scene.remove(f.m); FALL.splice(i, 1); }
        continue;
      }
      f.vy = Math.max(f.vy - 18 * dt, -30);
      f.m.position.y += f.vy * dt;
      f.m.rotation.z = Math.sin(f.t * 4) * .35;
      const g = groundY(f.x, f.z), rest = Math.max(g, 0) + f.len * .12;
      if (f.m.position.y <= rest) {
        f.m.position.y = rest; f.rest = rest; f.done = true; f.t = 0;
        f.m.rotation.set(0, f.yaw, 0);
        if (g < 0) { f.water = true; ripple(f.x, f.z, Math.min(3, f.len)); }
        else f.m.rotateX(Math.PI / 2); // นอนตะแคงบนพื้น
      }
    }
  }
  let last = performance.now();
  (function loop(now) { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; step(dt); })(last);

  /* ---------- รายชื่อปลา ---------- */
  function entries() {
    return FISH.map(sp => ({ sp, key: buildFish(sp).userData.model || null })).filter(e => showAll || e.key);
  }

  /* ---------- เมนู ---------- */
  const menu = document.createElement('div');
  Object.assign(menu.style, { position: 'fixed', inset: '0', zIndex: 25, display: 'none', background: 'rgba(0,0,0,.6)', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' });
  document.body.appendChild(menu);

  function render() {
    const all = FISH.map(sp => ({ sp, key: buildFish(sp).userData.model || null }));
    const bound = all.filter(e => e.key), list = showAll ? all : bound;
    const keys = new Set(bound.map(e => e.key));
    const b = 'background:#243252;border:0;color:#fff;border-radius:8px;padding:8px 10px;font-size:13px;';
    let h = `<div style="width:min(96vw,640px);height:min(92vh,520px);background:#141b2b;border:2px solid #34456b;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;color:#fff;font-family:inherit">
      <div style="display:flex;gap:8px;align-items:center;padding:8px 12px;background:#1d2840"><b>🐟 เสกปลา (ทดสอบโมเดล)</b><span style="margin-left:auto;font-size:12px;color:#ffd54a">โมเดลติด ${keys.size} แบบ · ${bound.length}/${FISH.length} ชนิด</span><button data-a="close" style="${b}background:#3a2a2a">✕</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding:6px 8px;background:#182036">
        <button data-a="size" style="${b}">ขนาด: ${realSize ? 'จริง (สูงสุด)' : '1.6 ม. ทุกตัว'}</button>
        <button data-a="all" style="${b}">${showAll ? 'แสดงเฉพาะที่ผูกโมเดล' : 'แสดงทั้งหมด (รวมแบบโค้ดเดิม)'}</button>
        <button data-a="clear" style="${b}">🗑 ลบปลาที่เสก</button></div>
      <div style="flex:1;overflow-y:auto;padding:8px 10px;-webkit-overflow-scrolling:touch;touch-action:pan-y">`;
    if (!bound.length) h += '<p style="font-size:13px;color:#f88">ยังไม่พบปลาที่ผูกโมเดลเลย — เช็กว่า model.js / fishmodel.js โหลดครบ และอยู่ในลำดับที่ถูกต้องใน index.html (ดูคอนโซล)</p>';
    let cur = '';
    list.sort((a, c) => String(a.key).localeCompare(String(c.key)) || a.sp.id - c.sp.id).forEach(e => {
      if (e.key !== cur) { cur = e.key; h += `<div style="margin:10px 0 4px;font-size:13px;color:#ffd54a">${cur || 'แบบโค้ดเดิม (ไม่มีโมเดล)'}</div>`; }
      const r = RAR[e.sp.r];
      h += `<button data-sp="${e.sp.id}" style="${b}margin:0 6px 6px 0;border-left:4px solid ${r.c}">${e.sp.name}</button>`;
    });
    menu.innerHTML = h + '</div></div>';
  }
  function open() {
    if (typeof UI !== 'undefined' && UI.kind) return;
    if (FS.state !== 'idle') { toast('เก็บเบ็ดก่อนค่อยเปิดเมนูเสกปลา'); return; }
    G.paused = true; inp.act = false; inp.mx = inp.mz = 0;
    render(); menu.style.display = 'flex';
  }
  function close() { menu.style.display = 'none'; G.paused = false; }
  menu.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.sp != null) { close(); spawn(FISH[+t.dataset.sp]); return; }
    const a = t.dataset.a;
    if (a === 'close') close();
    else if (a === 'size') { realSize = !realSize; render(); }
    else if (a === 'all') { showAll = !showAll; render(); }
    else if (a === 'clear') clearAll();
  });

  /* ปุ่ม 🐟 (โผล่เมื่อเปิดโหมดแอดมิน) */
  const btn = document.createElement('button');
  btn.textContent = '🐟';
  Object.assign(btn.style, { position: 'fixed', right: 'calc(8px + env(safe-area-inset-right))', top: '96px', zIndex: 9, pointerEvents: 'auto', display: 'none',
    background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.3)', borderRadius: '12px', padding: '6px 10px', fontSize: '15px', color: '#fff' });
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); open(); });
  document.body.appendChild(btn);
  setInterval(() => { btn.style.display = (!window.ADMIN || ADMIN.on) ? 'block' : 'none'; }, 500);

  window.FISHTEST = { spawn, step, clearAll, FALL };
})();
