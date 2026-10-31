'use strict';
/* ===== fishhold.js — ปลาที่ตกได้ไปอยู่ "ช่องถือ" + ถือปลา 3D + กระเป๋าแบบช่อง + ปลากินเบ็ดตามระดับเบ็ด =====
   วางไฟล์นี้ "ท้ายสุด" (หลัง ui.js / logphysics.js) — ไม่ต้องแก้ไฟล์เดิม
   1) ตกปลาได้ -> ปลาเข้า "ช่องถือ" (S.hold) ที่แถบด้านล่าง ยังไม่เข้ากระเป๋า (ปลาตัวเก่าในช่องจะถูกย้ายเข้ากระเป๋าให้เอง)
   2) กดช่องปลา = ถือปลา: ปลาเล็กถือมือเดียว (ห้อยหาง สะบัดตามกล้อง/การเดิน)
      ปลาที่ยาวกว่าตัวละครยกสองมือเหนือหัว  ·  กดช่องซ้ำ/เปลี่ยนไอเทม = เลิกถือ
   3) กระเป๋า > แท็บปลา: การ์ดปลามีโมเดล 3D หมุนช้า ๆ กรอบสีตามความแรร์
      กดค้างแล้วลากปลาไปวางที่ "ช่องถือ" เพื่อสลับ  ·  กดที่ปลา = ดูรายละเอียด/กิน/ขาย
   4) ปลากินเบ็ดตามระดับคัน+สาย: เบ็ดแพงขึ้น ปลาตัวเล็กจิ๋วจะมากินน้อยลง ปลาใหญ่/หายากมีโอกาสมากขึ้น
   ปรับค่าที่ CFG ด้านล่าง */
(function () {
  if (typeof S === 'undefined' || typeof FISH === 'undefined' || typeof buildFish !== 'function' || typeof toolList !== 'function' ||
    typeof human === 'undefined' || typeof held === 'undefined' || typeof scene === 'undefined' || typeof renderHotbar !== 'function' ||
    typeof invBody !== 'function' || typeof renderPanel !== 'function' || typeof landFish !== 'function') {
    console.warn('fishhold: ไม่พบระบบของเกม (game.js/ui.js/data.js) -> ข้าม'); return;
  }
  ['toolList', 'refreshHeld', 'setTool', 'renderHotbar', 'invBody', 'shopBody', 'renderPanel', 'landFish', 'animPlayer', 'updateCamera', 'startGame', 'newGame', 'startApproach'].forEach(n => {
    if (typeof window[n] !== 'function') console.warn('fishhold: window.' + n + ' ไม่ใช่ฟังก์ชันระดับ global — การครอบอาจไม่ทำงาน');
  });

  const CFG = {
    human: 1.75,      // ปลายาวกว่านี้ (เมตร) = ยกสองมือเหนือหัว
    minVis: .08,      // ขนาดต่ำสุดที่แสดงตอนถือ (เมตร) กันปลาจิ๋วมองไม่เห็น
    maxVis: 4.5,      // ขนาดสูงสุดที่แสดงตอนยกเหนือหัว (ปลาใหญ่กว่านี้ย่อให้พอดี)
    gearFit: true     // ปลากินเบ็ดตามระดับคัน/สาย
  };
  const KEY = 'fishhold_v1';
  const FH = { sel: null, fresh: false, ready: false };
  const getHold = () => (S && S.hold && FISH[S.hold.id] && isFinite(S.hold.w)) ? S.hold : null;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const $$ = id => document.getElementById(id);
  TOOL_BASE.fish = 0;

  /* ---------- เซฟ/โหลดช่องถือ (แยกจาก save.js เพื่อไม่ต้องแก้) ---------- */
  let lastJ = '';
  function persist() {
    if (!FH.ready) return;
    try { const j = JSON.stringify(getHold() ? { id: S.hold.id, w: S.hold.w } : null); if (j !== lastJ) { localStorage.setItem(KEY, j); lastJ = j; } } catch (_) { }
  }
  setInterval(persist, 1500);
  function restore() {
    if (!getHold()) {
      S.hold = null;
      try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && FISH[j.id] && isFinite(j.w)) S.hold = { id: j.id, w: +j.w }; } catch (_) { }
    }
  }

  /* ---------- ครอบฟังก์ชันของเกม ---------- */
  const _tl = window.toolList;
  window.toolList = function () { const a = _tl.apply(this, arguments); if (getHold()) a.push('fish'); return a; };

  const _st = window.setTool;
  window.setTool = function (id) { if (id === 'fish' && S.tool === 'fish') id = 'hand'; return _st.call(this, id); };

  const _sg = window.startGame;
  window.startGame = function () {
    const r = _sg.apply(this, arguments);
    restore(); FH.ready = true; lastJ = ''; persist();
    heldKey = ''; refreshHeld(); renderHotbar();
    return r;
  };
  const _ng = window.newGame;
  window.newGame = function () {
    const r = _ng.apply(this, arguments);
    S.hold = null; FH.sel = null; lastJ = ''; try { localStorage.removeItem(KEY); } catch (_) { }
    heldKey = ''; refreshHeld(); renderHotbar(); return r;
  };

  /* ตกปลาได้ -> เข้าช่องถือ (ปลาตัวเก่าในช่องย้ายเข้ากระเป๋า) */
  const _land = window.landFish;
  window.landFish = function () {
    if (getHold() && S.fish.length >= bagCap()) return _land.apply(this, arguments); // กระเป๋าเต็ม -> ใช้ระบบเดิม
    const sp = FS.sp, w = FS.w, price = fishPrice(sp, w);
    if (getHold()) S.fish.push(S.hold);
    S.hold = { id: sp.id, w: +w.toFixed(5) };
    const d = S.dex[sp.id] || (S.dex[sp.id] = { n: 0, best: 0 }); d.n++; if (w > d.best) d.best = w;
    showCatch(sp, w, price, true);
    FS.state = 'landed'; FS.t = 0; FS.start.copy(FS.hook); ripple(FS.hook.x, FS.hook.z, 2);
    FH.fresh = true; markDirty(); persist();
    if (window.refreshPanel) refreshPanel();
    renderHotbar();
    toast('🐟 ปลาอยู่ในช่องถือ — กดช่องปลาที่แถบด้านล่างเพื่อถือ', 3200);
  };

  /* ---------- ปลาที่ถืออยู่ (3D) ---------- */
  const pivot = new THREE.Group(), ovr = new THREE.Group();
  held.add(pivot); scene.add(ovr); pivot.visible = ovr.visible = false;
  let rig = null, armB = 0;

  function clearRig() { if (rig && rig.fish.parent) rig.fish.parent.remove(rig.fish); rig = null; }
  function syncHeld() {
    const h = S.tool === 'fish' ? getHold() : null;
    if (!h) { clearRig(); return; }
    const key = h.id + ':' + h.w;
    if (rig && rig.key === key) return;
    clearRig();
    const sp = FISH[h.id], len = fishLen(sp, h.w), big = len > CFG.human, vis = big ? Math.min(len, CFG.maxVis) : Math.max(len, CFG.minVis);
    const fish = buildFish(sp); fish.scale.setScalar(vis);
    if (big) { ovr.add(fish); fish.rotation.set(0, 0, 0); fish.position.set(0, 0, 0); }
    else { pivot.add(fish); fish.rotation.set(0, 0, -Math.PI / 2); fish.position.set(0, -vis / 2, 0); } // ห้อยหาง หัวชี้ลง
    rig = { key, sp, fish, len, vis, big, phi: 0, psi: 0, vphi: 0, vpsi: 0, fy: 0, fp: 0, fvf: 0, fvr: 0 };
  }
  const _rh = window.refreshHeld;
  window.refreshHeld = function () { const r = _rh.apply(this, arguments); syncHeld(); return r; };

  /* แขนสองข้างยกขึ้นเหนือหัวเมื่อถือปลาตัวใหญ่ */
  const _ap = window.animPlayer;
  window.animPlayer = function (dt) {
    const r = _ap.apply(this, arguments);
    const want = (S.tool === 'fish' && rig && rig.big && !P.swim) ? 1 : 0;
    armB += (want - armB) * Math.min(1, (dt || .016) * 9);
    if (armB > .01) {
      human.armR.rotation.x = lerp(human.armR.rotation.x, -2.85, armB); human.armL.rotation.x = lerp(human.armL.rotation.x, -2.85, armB);
      human.armR.rotation.z = lerp(human.armR.rotation.z, .16, armB); human.armL.rotation.z = lerp(human.armL.rotation.z, -.16, armB);
    }
    return r;
  };

  /* ฟิสิกส์สะบัดของปลา + จัดท่า (ทำหลังกล้องอัปเดต) */
  const AY = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), qP = new THREE.Quaternion();
  let pY = 0, pP = 0, pX = 0, pZ = 0, first = true, hintT = 0;
  function spring(a, v, T, k, c, dt) { v += (-k * (a - T) - c * v) * dt; a += v * dt; return [cl(a, -1.2, 1.2), v]; }
  function updateRig(dt, time) {
    const hold = getHold();
    if (S.tool !== 'fish' || !hold) { ovr.visible = pivot.visible = false; first = true; return; }
    if (P.swim) { S.tool = 'hand'; heldKey = ''; refreshHeld(); renderHotbar(); toast('ว่ายน้ำอยู่ — เก็บปลาเข้าช่องถือ'); return; }
    if (!rig) syncHeld(); if (!rig) return;
    const R = rig, hide = !!P.carry;
    pivot.visible = !R.big && !hide; ovr.visible = R.big && !hide;
    if (first) { pY = ctl.yaw; pP = ctl.pitch; pX = P.x; pZ = P.z; first = false; }
    let ty = 0, tp = 0, tvf = 0, tvr = 0;
    if (dt > 0) {
      ty = wrapA(ctl.yaw - pY) / dt; tp = (ctl.pitch - pP) / dt;
      const vx = (P.x - pX) / dt, vz = (P.z - pZ) / dt, fx = -Math.sin(ctl.yaw), fz = -Math.cos(ctl.yaw);
      tvf = vx * fx + vz * fz; tvr = vx * Math.cos(ctl.yaw) + vz * -Math.sin(ctl.yaw);
      pY = ctl.yaw; pP = ctl.pitch; pX = P.x; pZ = P.z;
      const s = Math.min(1, dt * 14); R.fy += (cl(ty, -14, 14) - R.fy) * s; R.fp += (cl(tp, -10, 10) - R.fp) * s;
      R.fvf += (cl(tvf, -8, 8) - R.fvf) * s; R.fvr += (cl(tvr, -8, 8) - R.fvr) * s;
    }
    const heavy = 1 / (1 + R.len * (R.big ? .25 : .6)), bob = P.moving ? 1 : 0;
    const rest = R.big ? 0 : 1.15 * Math.pow(cl((R.len - .2) / 1.5, 0, 1), .8);
    const tPhi = rest - R.fvf * .05 * heavy + R.fp * .05 * heavy + Math.sin(P.walkT) * .11 * bob * heavy;
    const tPsi = R.fy * .11 * heavy - R.fvr * .05 * heavy + Math.cos(P.walkT * .5) * .07 * bob * heavy;
    if (dt > 0) {
      const k = (R.big ? 34 : 70) / (1 + R.len * .35), c = (R.big ? 4.2 : 5.5) / (1 + R.len * .1), sub = Math.min(4, Math.ceil(dt / .01)), h = dt / sub;
      for (let i = 0; i < sub; i++) { [R.phi, R.vphi] = spring(R.phi, R.vphi, tPhi, k, c, h); [R.psi, R.vpsi] = spring(R.psi, R.vpsi, tPsi, k, c, h); }
    }
    const act = cl(Math.abs(R.fy) * .12 + Math.abs(R.fvf) * .12 + Math.abs(R.vphi) * .3, 0, 1);
    if (R.fish.userData && R.fish.userData.tail) R.fish.userData.tail.rotation.y = Math.sin(time * (8 + act * 8)) * (.2 + .55 * act);
    if (R.big) {
      ovr.position.set(P.x, P.y + 2.15 + .14 * R.vis + Math.sin(time * 2) * .02, P.z);
      ovr.rotation.order = 'YXZ'; ovr.rotation.set(R.psi * .5, ctl.yaw + Math.PI / 2, R.phi * .35);
    } else {
      q1.setFromAxisAngle(AY, ctl.yaw); q2.setFromAxisAngle(AX, R.phi); q3.setFromAxisAngle(AZ, R.psi);
      q1.multiply(q2).multiply(q3);                    // ท่าที่ต้องการในโลก (ห้อยลงตามแรงโน้มถ่วง)
      held.getWorldQuaternion(qP);                     // หมุนของมือ/กล้องตอนนี้
      pivot.quaternion.copy(qP.invert()).multiply(q1); // แปลงกลับเป็นพิกัดท้องถิ่นของ held
    }
  }
  const _uc = window.updateCamera;
  window.updateCamera = function () {
    const r = _uc.apply(this, arguments);
    try { updateRig(arguments[0], arguments[1]); } catch (e) { if (!FH.err) { FH.err = 1; console.error('fishhold:', e); } }
    return r;
  };

  /* ---------- ช่องปลาในแถบด้านล่าง ---------- */
  const _rhb = window.renderHotbar;
  window.renderHotbar = function () { const r = _rhb.apply(this, arguments); try { decorateHotbar(); } catch (_) { } return r; };
  function decorateHotbar() {
    const h = getHold(); if (!h) return;
    const idx = toolList().indexOf('fish'), bar = $$('hotbar'), b = bar && bar.children[idx]; if (!b) return;
    const sp = FISH[h.id], r = RAR[sp.r];
    b.innerHTML = fishIco(sp) + '<i>' + (idx + 1) + '</i>';
    if (S.tool !== 'fish') b.style.borderColor = r.c;
    b.style.boxShadow = '0 0 10px ' + r.c + '99';
    if (FH.fresh) { b.classList.add('fhNew'); FH.fresh = false; }
  }
  addEventListener('keydown', e => { // ปุ่ม 6-9 เลือกช่องที่เกิน 5
    if (e.target.tagName === 'INPUT' || UI.kind) return;
    const n = parseInt(e.key); if (n > 5 && n <= 9) { const l = toolList(); if (l[n - 1]) setTool(l[n - 1]); }
  });

  /* ---------- ขายปลาที่อยู่ในช่องถือ ---------- */
  const _shop = window.shopBody;
  window.shopBody = function () {
    const h = getHold(), base = _shop.apply(this, arguments);
    if (UI.tab !== 'sell' || !h) return base;
    const sp = FISH[h.id], r = RAR[sp.r];
    return row(fishIco(sp), `<span style="color:${r.c}">${sp.name}</span> ✋`, `${r.n} · ${fmtW(h.w)} · อยู่ในช่องถือ`, btn('ขาย 🪙' + fmtN(fishPrice(sp, h.w)), 'FHX.sell()')) + base;
  };

  /* ---------- แลกเปลี่ยนระหว่างช่องถือ/กระเป๋า ---------- */
  function afterChange() {
    FH.sel = null; persist(); markDirty(); heldKey = ''; refreshHeld(); renderHotbar(); if (UI.kind) renderPanel();
  }
  function toHand(i) {
    const f = S.fish[i]; if (!f) return;
    if (getHold()) { const old = S.hold; S.fish[i] = old; S.hold = f; } else { S.fish.splice(i, 1); S.hold = f; }
    toast('✋ ย้ายไปช่องถือแล้ว'); afterChange();
  }
  function toBag(j) {
    if (!getHold()) return;
    if (j != null && S.fish[j]) { const old = S.fish[j]; S.fish[j] = S.hold; S.hold = old; }
    else { if (S.fish.length >= bagCap()) { toast('กระเป๋าเต็ม!'); return; } S.fish.push(S.hold); S.hold = null; }
    afterChange();
  }
  function withHold(fn) { // ใช้ฟังก์ชันกิน/ขายของเดิมกับปลาในช่องถือ
    const h = getHold(); if (!h) return;
    S.fish.push(h); S.hold = null; const n = S.fish.length;
    try { fn(n - 1); } finally { if (S.fish.length >= n && S.fish[n - 1] === h) { S.fish.pop(); S.hold = h; } }
    afterChange();
  }
  window.FHX = {
    toHand, toBag,
    eat: (i, m) => { FH.sel = null; eatFish(i, m); },
    sellOne: i => { FH.sel = null; sellOne(i); },
    eatHold: m => withHold(i => eatFish(i, m)),
    sell: () => withHold(i => sellOne(i))
  };

  /* ---------- แท็บปลาในกระเป๋า ---------- */
  const css = document.createElement('style');
  css.textContent = `
.fhtop{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.fhslot{width:130px;flex-shrink:0}.fhinfo{flex:1;min-width:170px;background:#1b2440;border:1px solid #26324f;border-radius:10px;padding:8px;font-size:13px;line-height:1.55}
.fhdrop{min-height:132px;border:2px dashed #4a5a86;border-radius:12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;color:#97a3c4;font-size:12px}
.fhdrop.has{border-style:solid;border-color:#ffd54a;padding:0}
.fhgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;padding:2px;border-radius:10px;min-height:60px}
.fhc{position:relative;border:2px solid var(--c);border-radius:10px;background:#1b2440;box-shadow:0 0 8px var(--c);padding:3px;text-align:center;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;cursor:grab;font-size:11px;line-height:1.25}
.fhc canvas{width:100%;height:auto;display:block;pointer-events:none;background:radial-gradient(ellipse at center,#27345a,#141b2b 75%);border-radius:7px}
.fhc .fhn{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;pointer-events:none}.fhc small{color:#aab5d4;pointer-events:none}
.fhc.sel{outline:3px solid #ffd54a}.fhc.fhdrag{opacity:.35}.fhover{outline:3px dashed #7dff7d!important}
.fhdrop.fhover{background:rgba(125,255,125,.12)}
.fhr6,.fhr7{animation:fhg 1.8s ease-in-out infinite}.fhr8,.fhr9{animation:fhg 1s ease-in-out infinite}
@keyframes fhg{50%{box-shadow:0 0 20px var(--c),0 0 4px #fff}}
.fhNew{animation:fhp .55s ease-in-out 5}@keyframes fhp{50%{transform:scale(1.22)}}
.fhghost{position:fixed;z-index:80;pointer-events:none;width:92px;border:2px solid var(--c);border-radius:10px;background:#1b2440;box-shadow:0 6px 18px #000a;transform:translate(-50%,-60%) rotate(-4deg);padding:3px}
.fhghost canvas{width:100%;display:block;border-radius:7px}`;
  document.head.appendChild(css);

  function cardHTML(f, src, i) {
    const sp = FISH[f.id], r = RAR[sp.r], sel = FH.sel && FH.sel.src === src && (src === 'hold' || FH.sel.i === i);
    return `<div class="fhc fhr${sp.r}${sel ? ' sel' : ''}" data-src="${src}" data-i="${i}" style="--c:${r.c}"><canvas class="fv" width="160" height="120" data-id="${sp.id}" data-ph="${(i + 1) * 1.7}"></canvas><div class="fhn" style="color:${r.c}">${sp.name}</div><small>${r.n} · ${fmtW(f.w)}</small></div>`;
  }
  function infoHTML() {
    const s = FH.sel, f = s ? (s.src === 'hold' ? getHold() : S.fish[s.i]) : null;
    if (!f) return '<span class="hint">กดที่ปลาเพื่อดูรายละเอียด<br>กดค้างแล้วลากเพื่อสลับกับช่องถือ ✋<br>(หรือกด “ถือ” ในรายละเอียด)</span>';
    const sp = FISH[f.id], r = RAR[sp.r], near = Math.hypot(P.x - CAMP.x, P.z - CAMP.z) < 5.5, nearS = Math.hypot(P.x - STALL.x, P.z - STALL.z) > 8, hold = s.src === 'hold';
    let h = `<b style="color:${r.c}">${sp.name}</b> · ${r.n}<br><small>${fmtW(f.w)} · ยาว ${fmtL(fishLen(sp, f.w))} · 🍖+${Math.round(nutrition(f.w))} · 💰${fmtN(fishPrice(sp, f.w))}</small><div class="rr" style="justify-content:flex-start;margin-top:6px">`;
    h += hold ? btn('🎒 เก็บเข้ากระเป๋า', 'FHX.toBag()') : btn('✋ ถือ', `FHX.toHand(${s.i})`);
    h += hold ? btn('กินดิบ', "FHX.eatHold('raw')") + btn('ย่าง', "FHX.eatHold('grill')", !near) + btn('ต้ม', "FHX.eatHold('boil')", !near) + btn('ขาย', 'FHX.sell()', nearS, 'g')
      : btn('กินดิบ', `FHX.eat(${s.i},'raw')`) + btn('ย่าง', `FHX.eat(${s.i},'grill')`, !near) + btn('ต้ม', `FHX.eat(${s.i},'boil')`, !near) + btn('ขาย', `FHX.sellOne(${s.i})`, nearS, 'g');
    return h + '</div>';
  }
  const _inv = window.invBody;
  window.invBody = function () {
    if (UI.tab !== 'fish') return _inv.apply(this, arguments);
    const near = Math.hypot(P.x - CAMP.x, P.z - CAMP.z) < 5.5, hold = getHold(), MAX = 120;
    let h = `<p class="hint">ความหิว ${Math.round(S.food)}% · เลือด ${Math.round(S.hp)}% ${near ? '· 🔥 อยู่ใกล้กองไฟ ย่าง/ต้มได้' : '· ไปที่กองไฟเพื่อย่าง/ต้ม'}</p>`;
    h += `<div class="fhtop"><div class="fhslot"><div class="sec">✋ ช่องถือ</div><div class="fhdrop ${hold ? 'has' : ''}" data-drop="hand">${hold ? cardHTML(hold, 'hold', 0) : 'ลากปลามาวางที่นี่<br>ปลาที่ตกได้จะมาอยู่ช่องนี้'}</div></div><div class="fhinfo" id="fhInfo">${infoHTML()}</div></div>`;
    h += `<div class="sec">🎒 ปลาในกระเป๋า ${S.fish.length}/${bagCap()}</div>`;
    if (!S.fish.length) h += '<div class="fhgrid" data-drop="bag"><span class="hint">กระเป๋าว่าง (ลากปลาจากช่องถือมาวางตรงนี้เพื่อเก็บ)</span></div>';
    else { h += '<div class="fhgrid" data-drop="bag">'; S.fish.slice(0, MAX).forEach((f, i) => h += cardHTML(f, 'bag', i)); h += '</div>'; if (S.fish.length > MAX) h += `<p class="hint">แสดง ${MAX} ตัวแรก</p>`; }
    return h;
  };
  const _rp = window.renderPanel;
  window.renderPanel = function () {
    const r = _rp.apply(this, arguments);
    if (UI.kind === 'inv' && UI.tab === 'fish') { try { pvStart(); } catch (e) { console.warn('fishhold preview:', e); } }
    return r;
  };

  /* ---------- พรีวิวโมเดลปลาหมุน (renderer เล็กตัวเดียว วาดลงการ์ดทีละใบ) ---------- */
  const PV = { r: null, sc: null, cam: null, objs: {}, run: false, vis: [], vt: 0, rr: 0, fail: false };
  function pvInit() {
    if (PV.r || PV.fail) return !PV.fail;
    try {
      const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      r.setPixelRatio(1); r.setSize(160, 120); r.setClearColor(0x000000, 0);
      const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight(0xffffff, .85));
      const dl = new THREE.DirectionalLight(0xffffff, .9); dl.position.set(1.5, 2, 2); sc.add(dl);
      const cam = new THREE.PerspectiveCamera(32, 160 / 120, .1, 20); cam.position.set(0, .15, 1.95); cam.lookAt(0, 0, 0);
      PV.r = r; PV.sc = sc; PV.cam = cam;
    } catch (e) { PV.fail = true; console.warn('fishhold: สร้างพรีวิว 3D ไม่ได้ -> ใช้ไอคอนแทน', e); }
    return !PV.fail;
  }
  function pvDraw(c, now) {
    const id = +c.dataset.id; let o = PV.objs[id];
    if (!o) { o = PV.objs[id] = buildFish(FISH[id]); o.visible = false; PV.sc.add(o); }
    o.visible = true; o.rotation.y = now / 1000 * .6 + (+c.dataset.ph || 0);
    PV.r.render(PV.sc, PV.cam); o.visible = false;
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(PV.r.domElement, 0, 0, c.width, c.height);
  }
  function pvStart() {
    const cs = document.querySelectorAll('#panel canvas.fv');
    if (!cs.length) return;
    if (!pvInit()) { cs.forEach(c => { const x = c.getContext('2d'); x.font = '56px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🐟', c.width / 2, c.height / 2); }); return; }
    const now = performance.now(); let n = 0; cs.forEach(c => { if (n++ < 14) pvDraw(c, now); }); // วาดชุดแรกทันที กันกระพริบ
    if (!PV.run) { PV.run = true; requestAnimationFrame(pvTick); }
  }
  function pvTick(now) {
    if (!(UI.kind === 'inv' && UI.tab === 'fish')) { PV.run = false; return; }
    requestAnimationFrame(pvTick);
    if (now - PV.vt > 250) { // หาการ์ดที่มองเห็นในจอ
      PV.vt = now; const body = document.querySelector('#panel .pbody'), br = body ? body.getBoundingClientRect() : { top: 0, bottom: innerHeight };
      PV.vis = [...document.querySelectorAll('#panel canvas.fv')].filter(c => { const r = c.getBoundingClientRect(); return r.bottom > br.top && r.top < br.bottom; });
    }
    const n = PV.vis.length; if (!n) return;
    for (let k = 0; k < Math.min(4, n); k++) { PV.rr = (PV.rr + 1) % n; const c = PV.vis[PV.rr]; if (c && c.isConnected) pvDraw(c, now); }
  }

  /* ---------- กดค้างแล้วลาก ---------- */
  let D = null, ghost = null, hoverEls = [];
  function clearHover() { hoverEls.forEach(e => e.classList.remove('fhover')); hoverEls = []; }
  function targetAt(x, y) { return document.elementFromPoint(x, y); }
  function startDrag() {
    if (!D || D.on) return; D.on = true;
    const cv = D.c.querySelector('canvas'), g = document.createElement('div'); g.className = 'fhghost'; g.style.setProperty('--c', D.c.style.getPropertyValue('--c'));
    if (cv) { const k = document.createElement('canvas'); k.width = cv.width; k.height = cv.height; k.getContext('2d').drawImage(cv, 0, 0); g.appendChild(k); }
    document.body.appendChild(g); ghost = g; moveGhost(); D.c.classList.add('fhdrag');
    try { navigator.vibrate && navigator.vibrate(12); } catch (_) { }
  }
  function moveGhost() { if (ghost && D) { ghost.style.left = D.x + 'px'; ghost.style.top = D.y + 'px'; } }
  function endDrag() {
    clearTimeout(D && D.timer); clearHover();
    if (ghost) { ghost.remove(); ghost = null; }
    if (D && D.c) D.c.classList.remove('fhdrag'); D = null;
  }
  function onDown(e) {
    if (!(UI.kind === 'inv' && UI.tab === 'fish') || e.button > 0) return;
    const c = e.target.closest && e.target.closest('.fhc'); if (!c || !c.dataset.src) return;
    if (D) endDrag();
    D = { c, src: c.dataset.src, i: +c.dataset.i, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, on: false, moved: false, touch: e.pointerType !== 'mouse' };
    if (D.touch) D.timer = setTimeout(() => { if (D && !D.moved) startDrag(); }, 320); // กดค้าง = เริ่มลาก (ปัดเฉย ๆ = เลื่อนรายการ)
  }
  function onMove(e) {
    if (!D || e.pointerId !== D.id) return;
    D.x = e.clientX; D.y = e.clientY;
    if (!D.on) {
      if (Math.hypot(D.x - D.x0, D.y - D.y0) > (D.touch ? 10 : 5)) { D.moved = true; if (D.touch) { endDrag(); return; } startDrag(); }
      return;
    }
    moveGhost(); clearHover();
    const el = targetAt(D.x, D.y), t = el && el.closest && (el.closest('[data-drop="hand"]') || el.closest('.fhc') || el.closest('[data-drop="bag"]'));
    if (t) { t.classList.add('fhover'); hoverEls.push(t); }
  }
  function onUp(e) {
    if (!D || e.pointerId !== D.id) return;
    const d = D;
    if (d.on) {
      const el = targetAt(d.x, d.y), hand = el && el.closest('[data-drop="hand"]'), card = el && el.closest('.fhc'), bag = el && el.closest('[data-drop="bag"]');
      endDrag();
      if (d.src === 'bag' && hand) toHand(d.i);
      else if (d.src === 'hold' && card && card.dataset.src === 'bag') toBag(+card.dataset.i);
      else if (d.src === 'hold' && bag) toBag();
    } else if (!d.moved) {
      endDrag(); // แตะ = เลือกปลา
      FH.sel = { src: d.src, i: d.i };
      document.querySelectorAll('#panel .fhc').forEach(x => x.classList.toggle('sel', x === d.c));
      const info = $$('fhInfo'); if (info) info.innerHTML = infoHTML();
    } else endDrag();
  }
  const panel = $$('panel');
  panel.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', e => { if (D && e.pointerId === D.id) endDrag(); });
  document.addEventListener('touchmove', e => { if (D && D.on && e.cancelable) e.preventDefault(); }, { passive: false }); // ลากอยู่ ห้ามเลื่อนหน้า

  /* ---------- ปลากินเบ็ดตามระดับคัน/สาย ---------- */
  function gearCap() {
    const rod = S.eq.rod ? ITEMS[S.eq.rod] : null, line = ITEMS[S.eq.line || 'line0'];
    return rod ? Math.min(rod.maxW, line.maxW) : 1;
  }
  function gearRoll(dist, depth, luck, aurora) { // เหมือน rollFish เดิม + ให้น้ำหนักตามความเหมาะกับเบ็ด
    const zn = zoneOf(dist, depth), cap = gearCap(); let tot = 0; const arr = [];
    for (const f of FISH) {
      if (f.z > zn || f.d > depth + .01) continue;
      let w = RAR[f.r].w; if (f.r >= 2) w *= (1 + luck) * (aurora ? 1.1 : 1);
      w *= (f.z === zn ? 3 : Math.pow(.35, zn - f.z));
      const fit = f.w1 / cap;                  // ปลาตัวเล็กจิ๋วเมื่อเทียบกับเบ็ด = ไม่ค่อยมากิน
      if (fit < .003) w *= .04; else if (fit < .02) w *= .15; else if (fit < .1) w *= .45;
      arr.push([f, w]); tot += w;
    }
    if (!arr.length) return FISH[0];
    let r = Math.random() * tot; for (const a of arr) { r -= a[1]; if (r <= 0) return a[0]; }
    return arr[arr.length - 1][0];
  }
  function gearWeight(sp) { // เบ็ดดีขึ้น/เหยื่อดี = ได้ตัวหนักขึ้น
    const rod = S.eq.rod ? ITEMS[S.eq.rod] : null, idx = rod ? (parseInt(rod.id.replace('rod', '')) || 1) - 1 : 0, bd = baitDef();
    const boost = Math.min(1.2, idx * .08 + (bd ? bd.luck * .15 : 0));
    let u = Math.random(); u = Math.random() < .04 + idx * .006 ? .7 + .3 * Math.random() : Math.pow(u, 3.2 / (1 + boost));
    return sp.w0 + (sp.w1 - sp.w0) * u;
  }
  const _sa = window.startApproach;
  if (CFG.gearFit && typeof _sa === 'function') {
    window.startApproach = function () {
      const rf = window.rollFish, rw = window.rollWeight; window.rollFish = gearRoll; window.rollWeight = gearWeight;
      try { return _sa.apply(this, arguments); } finally { window.rollFish = rf; window.rollWeight = rw; }
    };
  }

  window.FH = FH; window.FHCFG = CFG;
})();
