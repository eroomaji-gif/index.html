'use strict';
/* ===== adminmode.js — โหมดแอดมิน: เสกฤดูกาลได้ทันที (+ ล็อกฤดู, ปรับเวลา, ออโรร่า, เงิน) =====
   วางไฟล์นี้ "ท้ายสุด" (หลัง ui.js / game.js / data.js) — ไม่ต้องแก้ไฟล์เดิม
   เปิดได้ที่ ตั้งค่า (⚙️) > แท็บ "🛡 แอดมิน"  ·  ตอนนี้ไม่ต้องใส่รหัส (โหมดเทส) · ถ้าอยากล็อกให้ตั้ง ADMIN_PASS ด้านล่าง
   หมายเหตุ: รหัสอยู่ในไฟล์ฝั่งเบราว์เซอร์ ใครเปิดดูโค้ดก็เห็น เหมาะกันกดพลาดเท่านั้น ไม่ใช่ระบบความปลอดภัยจริง */
(function () {
  if (typeof S === 'undefined' || typeof SEASONS === 'undefined' || typeof applySeason !== 'function' ||
    typeof checkSeason !== 'function' || typeof TABS === 'undefined' || typeof setBody !== 'function' || typeof renderPanel !== 'function') {
    console.warn('adminmode: ไม่พบระบบของเกม (game.js/ui.js/data.js) -> ข้าม'); return;
  }
  const ADMIN_PASS = '';            // '' = ไม่ต้องใส่รหัส (โหมดเทส) · ถ้าจะล็อกให้ใส่รหัสตรงนี้
  const COINS = 1000000;            // ปุ่ม "+เงิน" เพิ่มทีละเท่าไร

  const A = { ok: !ADMIN_PASS, lock: null };
  try { if (sessionStorage.getItem('adm_ok') === '1') A.ok = true; } catch (_) { }

  /* ล็อกฤดู: วันผ่านไปก็ไม่เปลี่ยนฤดู */
  const _cs = window.checkSeason;
  window.checkSeason = function (announce) {
    if (A.lock !== null) { if (seasonIdx !== A.lock) applySeason(A.lock); return; }
    return _cs.apply(this, arguments);
  };

  function setSeason(si) {
    si = +si; if (!SEASONS[si]) return;
    const cyc = SEASON_DAYS * SEASONS.length;
    S.day = Math.floor(S.day / cyc) * cyc + si * SEASON_DAYS; // อยู่รอบเดิม เปลี่ยนแค่ฤดู (ไม่ทำให้วันถอยหลัง)
    if (A.lock !== null) A.lock = si;
    if (seasonIdx !== si) applySeason(si);
    markDirty(); toast('🪄 เสกเป็น' + SEASONS[si].n, 3000); renderPanel();
  }
  function lockToggle() {
    A.lock = A.lock === null ? seasonIdx : null;
    toast(A.lock === null ? '🔓 ปลดล็อกฤดู ให้เปลี่ยนตามวัน' : '🔒 ล็อกฤดูไว้ที่' + SEASONS[A.lock].n, 2600); renderPanel();
  }
  function setTime(t) { S.tod = t; markDirty(); toast(t >= 300 ? '🌙 ตอนนี้กลางคืน' : '☀️ ตอนนี้กลางวัน'); renderPanel(); }
  function aurora() {
    if (typeof AUR === 'undefined') return;
    AUR.on = !AUR.on; if (AUR.on && S.tod < 300) S.tod = 300; // ออโรร่าโผล่ตอนกลางคืนเท่านั้น
    toast(AUR.on ? '🌌 เปิดออโรร่า (โอกาสปลาหายาก +10%)' : 'ปิดออโรร่า'); markDirty(); renderPanel();
  }
  function coins() { S.coins += COINS; markDirty(); toast('🪙 +' + fmtN(COINS)); renderPanel(); }
  function login() {
    const el = document.getElementById('admPass');
    if (el && el.value === ADMIN_PASS) { A.ok = true; try { sessionStorage.setItem('adm_ok', '1'); } catch (_) { } renderPanel(); }
    else toast('รหัสไม่ถูกต้อง');
  }
  function logout() { A.ok = !ADMIN_PASS; try { sessionStorage.removeItem('adm_ok'); } catch (_) { } renderPanel(); }

  window.ADM = { setSeason, lockToggle, setTime, aurora, coins, login, logout, state: A };

  if (!TABS.set.some(t => t[0] === 'admin')) TABS.set.push(['admin', '🛡 แอดมิน']);

  function adminHTML() {
    if (!A.ok) {
      return `<div class="sec">🛡 โหมดแอดมิน</div><p class="hint">ใส่รหัสเพื่อใช้งาน</p>
<div class="eqrow"><input id="admPass" type="password" placeholder="รหัส" autocomplete="off" style="flex:1;min-width:120px;padding:8px;border-radius:8px;border:1px solid #4a5a86;background:#1b2440;color:#fff"><button class="eqb" onclick="ADM.login()">เข้าสู่ระบบ</button></div>`;
    }
    let h = `<div class="sec">🪄 เสกฤดูกาล (ตอนนี้: ${SEASONS[seasonIdx].n}${A.lock !== null ? ' 🔒' : ''})</div><div class="eqrow">`;
    SEASONS.forEach((s, i) => h += `<button class="eqb ${seasonIdx === i ? 'on' : ''}" onclick="ADM.setSeason(${i})">${s.n}</button>`);
    h += `</div><div class="eqrow"><button class="eqb ${A.lock !== null ? 'on' : ''}" onclick="ADM.lockToggle()">${A.lock !== null ? '🔒 ฤดูถูกล็อก (กดเพื่อปลด)' : '🔓 ล็อกฤดูไว้ไม่ให้เปลี่ยน'}</button></div>`;
    h += `<div class="sec">🕒 เวลา / ท้องฟ้า</div><div class="eqrow"><button class="eqb" onclick="ADM.setTime(10)">☀️ เช้า</button><button class="eqb" onclick="ADM.setTime(300)">🌙 ค่ำ</button><button class="eqb ${typeof AUR !== 'undefined' && AUR.on ? 'on' : ''}" onclick="ADM.aurora()">🌌 ออโรร่า</button></div>`;
    h += `<div class="sec">🪙 อื่น ๆ</div><div class="eqrow"><button class="eqb" onclick="ADM.coins()">+${fmtN(COINS)} เหรียญ</button><button class="eqb" onclick="ADM.logout()">ออกจากแอดมิน</button></div>`;
    return h + '<p class="hint">ล็อกฤดูไว้ = วันผ่านไปฤดูก็ไม่เปลี่ยน ปลดล็อกแล้วจะกลับไปเปลี่ยนตามวันปกติ</p>';
  }
  const _sb = window.setBody;
  window.setBody = function () { return UI.tab === 'admin' ? adminHTML() : _sb.apply(this, arguments); };
})();
