'use strict';
/* ===== admin.js — โหมดแอดมิน (วางไว้ "ท้ายสุด" หลัง ui.js) =====
   กดปุ่ม 👑 มุมขวาบนเพื่อเปิด/ปิด (หรือพิมพ์ ADMIN.toggle() ในคอนโซล)
   เปิดแล้วจะได้ + สวมให้ทันที:
   - 👑 คันแอดมิน   : รับน้ำหนักได้ทุกขนาด (ไม่หัก) โยนไกล 200 m
   - 👑 สายแอดมิน   : ยาวสุด 1000 m (ลึกสุดเท่าที่ทะเลมี) รับน้ำหนักไม่จำกัด สายไม่ขาด
   - ปลากินเบ็ดทันที + ได้ปลาที่หนักที่สุดในเกม น้ำหนักสูงสุดของชนิดนั้นทุกครั้ง
   ใช้ได้เฉพาะตอนสวมคันแอดมิน ถ้าสลับไปคันอื่นเกมจะเล่นปกติ */
(function () {
  const ADMIN = window.ADMIN = {
    fishId: null,       // null = ปลาที่หนักที่สุด หรือใส่เลข id ปลา (0-48) ตามลำดับใน data.js
    instantBite: true,  // ปลากินเบ็ดทันที (ข้ามรอ/ปลาเข้ามา/ให้กด)
    autoLand: true,     // ดึงปลาขึ้นทันที  (false = ต้องสู้เอง แต่สายไม่ขาด คันไม่หัก)
    get on() { return !!S.admin; }
  };
  const BIG = 1e9; // กก. มากกว่าปลาใหญ่สุดในเกม (900,000) -> ไม่มีทางหนักเกิน

  const rod = { id: 'rodAdmin', nm: 'คันแอดมิน', pr: 0, dist: 200, maxW: BIG, col: '#ff4d6d', L: 5, ic: '👑', cat: 'rod' };
  const line = { id: 'lineAdmin', nm: 'สายแอดมิน', pr: 0, len: 1000, maxW: BIG, ic: '👑', cat: 'line' };
  [[rod, RODS], [line, LINES]].forEach(([it, list]) => { ITEMS[it.id] = it; list.push(it); }); // pr=0 -> ไม่โผล่ในร้านค้า

  const active = () => ADMIN.on && S.eq.rod === rod.id;
  function species() {
    if (ADMIN.fishId != null && FISH[ADMIN.fishId]) return FISH[ADMIN.fishId];
    return FISH.reduce((a, b) => b.w1 > a.w1 ? b : a);
  }

  /* ปลากินเบ็ดทันที + สายไม่ขาด */
  const _uf = window.updateFishing;
  window.updateFishing = function () {
    if (active()) {
      switch (FS.state) {
        case 'sink': FS.hook.y = -FS.depth + .01; break;                  // ข้ามการรอเบ็ดจมลง
        case 'wait': if (ADMIN.instantBite) FS.waitT = 0; break;
        case 'approach': if (ADMIN.instantBite) FS.t = 2; break;
        case 'bite': if (ADMIN.instantBite) startFight(); break;
        case 'fight': FS.tens = 0; if (ADMIN.autoLand) FS.p = 1e6; break;
      }
    }
    return _uf.apply(this, arguments);
  };

  /* ปลาที่ติดเบ็ด = ปลาที่หนักที่สุด น้ำหนักเต็ม */
  const _sa = window.startApproach;
  window.startApproach = function () {
    _sa.apply(this, arguments);
    if (!active()) return;
    if (FS.fm) { scene.remove(FS.fm); FS.fm = null; }
    const sp = species();
    FS.sp = sp; FS.w = sp.w1; FS.len = Math.max(fishLen(sp, FS.w), .008);
    const m = buildFish(sp); m.scale.setScalar(FS.len); scene.add(m); FS.fm = m;
    FS.R = FS.len * 1.6 + 9; FS.rho = 0; FS.cap = BIG;
  };

  function toggle() {
    if (FS.state !== 'idle') { toast('เก็บเบ็ดก่อนค่อยสลับโหมดแอดมิน'); return; }
    S.admin = !S.admin;
    if (S.admin) {
      S.owned[rod.id] = 1; S.owned[line.id] = 1;
      S.eq.rod = rod.id; S.eq.line = line.id; S.tool = 'rod';
    } else {
      delete S.owned[rod.id]; delete S.owned[line.id];
      if (S.eq.rod === rod.id) S.eq.rod = null;
      if (S.eq.line === line.id) S.eq.line = 'line0';
    }
    heldKey = ''; refreshHeld(); markDirty();
    if (window.refreshPanel) refreshPanel();
    if (window.renderHotbar) renderHotbar();
    paint();
    toast(S.admin ? '👑 เปิดโหมดแอดมินแล้ว' : 'ปิดโหมดแอดมินแล้ว', 2500);
  }
  ADMIN.toggle = toggle;

  /* ปุ่ม 👑 */
  const btn = document.createElement('button');
  btn.textContent = '👑';
  Object.assign(btn.style, { position: 'fixed', right: 'calc(8px + env(safe-area-inset-right))', top: '52px', zIndex: 9, pointerEvents: 'auto',
    border: '1px solid rgba(255,255,255,.3)', borderRadius: '12px', padding: '6px 10px', fontSize: '15px', color: '#fff' });
  function paint() { btn.style.background = S.admin ? 'rgba(255,77,109,.85)' : 'rgba(0,0,0,.5)'; }
  btn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); toggle(); });
  document.body.appendChild(btn);
  paint();
  setInterval(paint, 1000); // ซิงก์สีปุ่มหลังโหลดเซฟ
})();
