'use strict';
/* ===== logphysics.js — ฟิสิกส์ท่อนไม้สมจริง (วางไว้ "ท้ายสุด" หลัง ui.js / admin.js / fishtest.js) =====
   ไม่ต้องแก้ world.js / game.js / ui.js — ไฟล์นี้ครอบฟังก์ชันเดิมเอง
   ทำอะไรบ้าง
   1) ตัดต้นไม้ -> ท่อนไม้เป็นวัตถุอิสระทันที ล้มจากตอ กระแทกพื้น กลิ้งตามเนิน ลอยน้ำได้
   2) เดินชน -> ดันท่อนไม้ (ไม้หนักดันยาก ไม้เบาดันไปไกล)
   3) ปุ่ม E ที่ท่อนไม้ -> ยิงลำแสงดึงไม้ (ลำแสงโค้งห้อยตามน้ำหนัก) ลากกล้องเร็ว ๆ = ไม้แกว่งตาม
      กด "ปล่อย" ตอนกำลังแกว่ง = โยนไปตามแรงเหวี่ยง หรือกด "ขว้าง" ให้พุ่งไปข้างหน้า
   4) ระหว่างถือไม้มีวงแหวน 3 ชั้น X/Y/Z ที่มุมขวา ลากวนเพื่อหมุนไม้ แล้วกด "ใช้"/"วาง" = วางและเชื่อมติดที่
      (ท่อนที่เชื่อมแล้วเป็นสิ่งก่อสร้างแข็ง ไม่ขยับ จนกว่าจะยกใหม่)
   ปรับค่าได้ที่ CFG ด้านล่าง */
(function () {
  if (typeof LOGS === 'undefined' || typeof addLog !== 'function' || typeof groundY !== 'function' || typeof THREE === 'undefined' ||
    typeof scene === 'undefined' || typeof camera === 'undefined' || typeof ctl === 'undefined' || typeof P === 'undefined' ||
    typeof logMeshes === 'undefined' || typeof removeLog !== 'function' || typeof cutLog !== 'function') {
    console.warn('logphysics: ไม่พบระบบท่อนไม้ของเกม -> ข้าม'); return;
  }
  ['updateFalling', 'cutLog', 'removeLog', 'addLog', 'collide', 'digAt', 'exportWorld', 'importWorld', 'resetWorld'].forEach(n => {
    if (typeof window[n] !== 'function') console.warn('logphysics: window.' + n + ' ไม่ใช่ฟังก์ชันระดับ global — การครอบอาจไม่ทำงาน');
  });
  const markDirtySafe = () => { if (typeof markDirty === 'function') markDirty(); };
  // water = ระดับผิวน้ำ (แกน Y) ปรับให้ตรงกับเกมถ้าน้ำไม่ได้อยู่ที่ y=0
  const CFG = { dens: 500, grav: 18, pmass: 80, prad: .4, vmax: 28, snap: true, water: 0 };
  const DEG15 = Math.PI / 12;

  /* ---------- คณิตศาสตร์เวกเตอร์/ควอเทอร์เนียน (ใช้อาร์เรย์ล้วน) ---------- */
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len3 = a => Math.hypot(a[0], a[1], a[2]);
  const addTo = (a, b, s) => { a[0] += b[0] * s; a[1] += b[1] * s; a[2] += b[2] * s; };
  const qmul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qconj = q => [-q[0], -q[1], -q[2], q[3]];
  const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
  const qaxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
  function qrot(q, v) {
    const x = v[0], y = v[1], z = v[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
  }
  /* inverse inertia (โลก) ของทรงกระบอก แกนยาว = แกน Y ของโมเดล */
  function iw(b, v) {
    const l = qrot(qconj(b.q), v);
    return qrot(b.q, [l[0] * b.ip, l[1] * b.ia, l[2] * b.ip]);
  }

  /* ---------- สร้าง/โหลด/เซฟสถานะวัตถุ ---------- */
  function loadFromMesh(e) {
    const m = e.mesh, b = e.b;
    b.p = [m.position.x, m.position.y, m.position.z];
    b.q = qnorm([m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w]);
    e.sph = null;
  }
  function storeToMesh(e) {
    const b = e.b, m = e.mesh;
    m.position.set(b.p[0], b.p[1], b.p[2]); m.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]);
  }
  function initBody(e, welded) {
    const m = CFG.dens * Math.PI * e.r * e.r * e.len;
    e.b = { m, im: 1 / m, ip: 12 / (m * (3 * e.r * e.r + e.len * e.len)), ia: 2 / (m * e.r * e.r), v: [0, 0, 0], w: [0, 0, 0], p: [0, 0, 0], q: [0, 0, 0, 1], sl: 0, asleep: false, cnt: 0, S: null, rip: 0 };
    e.welded = !!welded; e.R = e.len / 2 + e.r; e.canopy = e.canopy || null; e.canT = 0; e._off = null;
    loadFromMesh(e); return e;
  }
  const body = e => e.b || initBody(e, true);
  const wake = e => { if (e.b) { e.b.asleep = false; e.b.sl = 0; } e.sph = null; };
  const wakeAll = () => { for (const e of LOGS) if (!e.welded) wake(e); };

  /* ---------- ลูกกลมเรียงตามแกนท่อน (ใช้ชนแทนทรงกระบอก ทำให้กลิ้งได้จริง) ---------- */
  function offsets(e) {
    if (e._off) return e._off;
    const span = e.len - 2 * e.r;
    if (span <= e.r * .3) return (e._off = [0]);
    const stp = Math.max(e.r * 1.1, span / 11), n = Math.ceil(span / stp) + 1, a = [];
    for (let i = 0; i < n; i++) a.push(-span / 2 + i * span / (n - 1));
    return (e._off = a);
  }
  function computeSph(e) {
    const b = e.b, ax = qrot(b.q, [0, 1, 0]), off = offsets(e), c = [], ra = [];
    for (const o of off) { const r = [ax[0] * o, ax[1] * o, ax[2] * o]; ra.push(r); c.push([b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2]]); }
    return { c, ra, ax };
  }
  function sph(e) {
    const b = body(e);
    if (e.welded || b.asleep) { if (!e.sph) e.sph = computeSph(e); return e.sph; }
    return computeSph(e);
  }

  /* ---------- สร้างจุดสัมผัส ---------- */
  const terrN = (x, z) => {
    const E = .35, gx = (groundY(x + E, z) - groundY(x - E, z)) / (2 * E), gz = (groundY(x, z + E) - groundY(x, z - E)) / (2 * E), l = Math.hypot(gx, 1, gz);
    return [-gx / l, 1 / l, -gz / l];
  };
  function sphereVsCyl(c, r, cx, cz, cr, y0, y1) { // ทรงกระบอกตั้ง (ต้นไม้/ตอ/เสา)
    const dx = c[0] - cx, dz = c[2] - cz, d = Math.hypot(dx, dz);
    if (d > cr + r) return null;
    const k = d > 1e-6 ? Math.min(d, cr) / d : 0, px = cx + dx * k, pz = cz + dz * k, py = cl(c[1], y0, y1);
    const vx = c[0] - px, vy = c[1] - py, vz = c[2] - pz, dist = Math.hypot(vx, vy, vz);
    if (dist >= r + .01) return null;
    if (dist < 1e-5) { // จุดศูนย์กลางอยู่ในทรงกระบอก
      if (c[1] > y1 - .3) return { n: [0, 1, 0], d: r + (y1 - c[1]) };
      return d > 1e-6 ? { n: [dx / d, 0, dz / d], d: r + (cr - d) } : { n: [1, 0, 0], d: r + cr };
    }
    return { n: [vx / dist, vy / dist, vz / dist], d: r - dist };
  }
  function sphereVsBox(c, r, b, y0, y1) {
    const px = cl(c[0], b.x0, b.x1), pz = cl(c[2], b.z0, b.z1), py = cl(c[1], y0, y1);
    const vx = c[0] - px, vy = c[1] - py, vz = c[2] - pz, dist = Math.hypot(vx, vy, vz);
    if (dist >= r + .01) return null;
    if (dist < 1e-5) {
      const o = [[c[0] - b.x0, [-1, 0, 0]], [b.x1 - c[0], [1, 0, 0]], [c[2] - b.z0, [0, 0, -1]], [b.z1 - c[2], [0, 0, 1]]].sort((a, z) => a[0] - z[0])[0];
      return { n: o[1], d: r + o[0] };
    }
    return { n: [vx / dist, vy / dist, vz / dist], d: r - dist };
  }
  let PV = [0, 0], HELD = null;

  function pushC(out, e, c, n, depth, mu, res, other, extra) {
    const b = e.b, r = e.r, pt = [c[0] - n[0] * r, c[1] - n[1] * r, c[2] - n[2] * r];
    const o = { a: b, ra: [pt[0] - b.p[0], pt[1] - b.p[1], pt[2] - b.p[2]], n, depth, mu, res, b: null, rb: null, kin: false, kv: null, wake: null, jn: 0, jt: [0, 0, 0], bias: 0, kn: 1 };
    if (other) {
      if (other.welded || other.b.asleep) o.wake = other.welded ? null : other;
      else { o.b = other.b; o.rb = [pt[0] - other.b.p[0], pt[1] - other.b.p[1], pt[2] - other.b.p[2]]; }
    }
    if (extra) Object.assign(o, extra);
    b.cnt++; out.push(o);
  }

  function genContacts(e, out) {
    const b = e.b, S = b.S, r = e.r;
    const held = HELD && HELD.e === e;
    const cols = typeof colliders !== 'undefined' ? colliders : [], boxes = typeof BOXES !== 'undefined' ? BOXES : [], trees = typeof TREES !== 'undefined' ? TREES : [];
    const others = HELD && HELD.e !== e ? LOGS.concat([HELD.e]) : LOGS;
    for (let i = 0; i < S.c.length; i++) {
      const c = S.c[i];
      /* พื้น */
      const g = groundY(c[0], c[2]), n = terrN(c[0], c[2]), dist = (c[1] - g) * n[1];
      if (dist < r + .01) pushC(out, e, c, n, r - dist, .6, .15, null);
      /* ต้นไม้/ตอไม้ */
      for (const t of trees) {
        if (t.H < .3) continue;
        const dx = c[0] - t.x, dz = c[2] - t.z; if (dx * dx + dz * dz > (t.r + r + .05) * (t.r + r + .05)) continue;
        const k = sphereVsCyl(c, r, t.x, t.z, t.r * .9, t.gy - 1, t.gy + t.H);
        if (k) pushC(out, e, c, k.n, k.d, .5, .1, null);
      }
      for (const q of cols) {
        const dx = c[0] - q.x, dz = c[2] - q.z; if (dx * dx + dz * dz > (q.r + r + .05) * (q.r + r + .05)) continue;
        const gg = groundY(q.x, q.z), k = sphereVsCyl(c, r, q.x, q.z, q.r, gg - 2, gg + 3.2);
        if (k) pushC(out, e, c, k.n, k.d, .5, .1, null);
      }
      for (const bx of boxes) {
        if (c[0] < bx.x0 - r - .1 || c[0] > bx.x1 + r + .1 || c[2] < bx.z0 - r - .1 || c[2] > bx.z1 + r + .1) continue;
        const gg = groundY((bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2), k = sphereVsBox(c, r, bx, gg - 2, gg + 3.6);
        if (k) pushC(out, e, c, k.n, k.d, .5, .1, null);
      }
      /* ท่อนไม้อื่น */
      for (const o of others) {
        if (o === e) continue; const ob = body(o);
        const dx = b.p[0] - ob.p[0], dy = b.p[1] - ob.p[1], dz = b.p[2] - ob.p[2], R = e.R + o.R + .05;
        if (dx * dx + dy * dy + dz * dz > R * R) continue;
        if (o.b.asleep || o.welded) o.sph = o.sph || computeSph(o);
        const OS = (o.welded || ob.asleep) ? o.sph : (ob.S || computeSph(o));
        for (const c2 of OS.c) {
          const vx = c[0] - c2[0], vy = c[1] - c2[1], vz = c[2] - c2[2], d = Math.hypot(vx, vy, vz), m = r + o.r;
          if (d >= m + .01) continue;
          const nn = d > 1e-6 ? [vx / d, vy / d, vz / d] : [0, 1, 0];
          pushC(out, e, c, nn, m - d, .5, .1, o);
        }
      }
      /* ผู้เล่น (ไม่ชนตอนไม้ที่ถืออยู่) */
      if (!held && typeof P !== 'undefined') {
        const y0 = P.y + .3, y1 = P.y + 1.45, py = cl(c[1], y0, y1), vx = c[0] - P.x, vy = c[1] - py, vz = c[2] - P.z, d = Math.hypot(vx, vy, vz), m = r + CFG.prad;
        if (d < m) {
          const nn = d > 1e-6 ? [vx / d, vy / d, vz / d] : [1, 0, 0];
          pushC(out, e, c, nn, m - d, .3, 0, null, { kin: true, kv: [PV[0], 0, PV[1]], pl: true });
        }
      }
    }
  }

  /* ---------- ตัวแก้การชน (sequential impulses) ---------- */
  function effK(c, n) {
    const a = c.a; let k = a.im + dot(cross(iw(a, cross(c.ra, n)), c.ra), n);
    if (c.b) k += c.b.im + dot(cross(iw(c.b, cross(c.rb, n)), c.rb), n); else if (c.kin) k += 1 / CFG.pmass;
    return k;
  }
  function relV(c) {
    const a = c.a, va = [a.v[0] + a.w[1] * c.ra[2] - a.w[2] * c.ra[1], a.v[1] + a.w[2] * c.ra[0] - a.w[0] * c.ra[2], a.v[2] + a.w[0] * c.ra[1] - a.w[1] * c.ra[0]];
    let vb = [0, 0, 0];
    if (c.b) { const b = c.b; vb = [b.v[0] + b.w[1] * c.rb[2] - b.w[2] * c.rb[1], b.v[1] + b.w[2] * c.rb[0] - b.w[0] * c.rb[2], b.v[2] + b.w[0] * c.rb[1] - b.w[1] * c.rb[0]]; }
    else if (c.kv) vb = c.kv;
    return [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]];
  }
  function applyJ(c, J) {
    const a = c.a; addTo(a.v, J, a.im); addTo(a.w, iw(a, cross(c.ra, J)), 1);
    if (c.b) { addTo(c.b.v, J, -c.b.im); addTo(c.b.w, iw(c.b, cross(c.rb, J)), -1); }
  }
  function solve(cs) {
    for (const c of cs) { c.kn = effK(c, c.n); c.bias = -1; }
    for (let it = 0; it < 6; it++) for (const c of cs) {
      const n = c.n; let rel = relV(c), vn = dot(rel, n);
      if (c.bias < 0) { c.bias = vn < -2.2 ? -c.res * vn : 0; if (c.wake && vn < -.4) wake(c.wake); }
      let j = (c.bias - vn) / c.kn; const old = c.jn; c.jn = Math.max(0, old + j); j = c.jn - old;
      if (j) applyJ(c, [n[0] * j, n[1] * j, n[2] * j]);
      rel = relV(c); vn = dot(rel, n);
      const vt = [rel[0] - n[0] * vn, rel[1] - n[1] * vn, rel[2] - n[2] * vn], sp = len3(vt);
      if (sp > 1e-6) {
        const t = [vt[0] / sp, vt[1] / sp, vt[2] / sp], jt = -sp / effK(c, t), nw = [c.jt[0] + t[0] * jt, c.jt[1] + t[1] * jt, c.jt[2] + t[2] * jt], mx = c.mu * c.jn, l = len3(nw);
        if (l > mx) { const s = mx / l; nw[0] *= s; nw[1] *= s; nw[2] *= s; }
        const d = [nw[0] - c.jt[0], nw[1] - c.jt[1], nw[2] - c.jt[2]]; c.jt = nw; applyJ(c, d);
      }
    }
  }
  function correct(c) {
    const d = Math.min(.25, c.depth - .004); if (d <= 0) return;
    const ia = c.a.im, ib = c.b ? c.b.im : c.kin ? 1 / CFG.pmass : 0, s = ia + ib, k = .7;
    addTo(c.a.p, c.n, d * k * ia / s);
    if (c.b) addTo(c.b.p, c.n, -d * k * ib / s);
    else if (c.kin && typeof P !== 'undefined') { P.x -= c.n[0] * d * k * ib / s; P.z -= c.n[2] * d * k * ib / s; }
  }

  /* ---------- แรงต่าง ๆ ---------- */
  function waterForces(e, h) {
    const b = e.b, S = b.S, n = S.c.length; let sub = 0;
    for (let i = 0; i < n; i++) {
      const f = cl((CFG.water + e.r - S.c[i][1]) / (2 * e.r), 0, 1); if (f <= 0) continue; sub += f;
      const J = [0, (b.m / n) * CFG.grav * 2 * f * h, 0];
      b.v[1] += J[1] * b.im; addTo(b.w, iw(b, cross(S.ra[i], J)), 1);
      if (b.rip <= 0 && Math.abs(b.v[1]) > 2 && typeof ripple === 'function') { ripple(S.c[i][0], S.c[i][2], Math.min(2.5, e.len * .3 + .3)); b.rip = .5; }
    }
    b.rip -= h;
    if (sub > 0) { const fa = sub / n, dv = Math.exp(-1.8 * fa * h), dw = Math.exp(-2.5 * fa * h); for (let i = 0; i < 3; i++) { b.v[i] *= dv; b.w[i] *= dw; } if (fa > .3) b.cnt++; }
  }
  function heldForces(e, h) {
    const b = e.b, H = HELD, m = b.m;
    b.v[1] -= CFG.grav * h * (1 - 1 / (1 + m / 1500)) ; // ไม้หนักห้อยลง (ลำแสงรับไม่หมด)
    const K = 45, Cd = 2 * Math.sqrt(K) * .9, amax = 140 / (1 + m / 350);
    const a = [(H.T[0] - b.p[0]) * K - b.v[0] * Cd, (H.T[1] - b.p[1]) * K - b.v[1] * Cd, (H.T[2] - b.p[2]) * K - b.v[2] * Cd], al = len3(a);
    if (al > amax) { const s = amax / al; a[0] *= s; a[1] *= s; a[2] *= s; }
    addTo(b.v, a, h);
    let dq = qmul(H.tq, qconj(b.q)); if (dq[3] < 0) dq = [-dq[0], -dq[1], -dq[2], -dq[3]];
    const ang = 2 * Math.acos(cl(dq[3], -1, 1)), sn = Math.sqrt(Math.max(0, 1 - dq[3] * dq[3])), rate = 7 / (1 + m / 900);
    const want = (ang > 1e-4 && sn > 1e-6) ? [dq[0] / sn * ang * rate, dq[1] / sn * ang * rate, dq[2] / sn * ang * rate] : [0, 0, 0], k = 1 - Math.exp(-10 * h);
    for (let i = 0; i < 3; i++) b.w[i] += (want[i] - b.w[i]) * k;
  }
  function integrate(e, h) {
    const b = e.b;
    if (b.cnt > 0) { const dv = Math.exp(-.4 * h), dw = Math.exp(-.9 * h); /* ความฝืดการกลิ้ง */ for (let i = 0; i < 3; i++) { b.v[i] *= dv; b.w[i] *= dw; } }
    let s = len3(b.v); if (s > CFG.vmax) { const k = CFG.vmax / s; b.v[0] *= k; b.v[1] *= k; b.v[2] *= k; }
    s = len3(b.w); if (s > 25) { const k = 25 / s; b.w[0] *= k; b.w[1] *= k; b.w[2] *= k; }
    addTo(b.p, b.v, h);
    const dq = qmul([b.w[0], b.w[1], b.w[2], 0], b.q);
    b.q = qnorm([b.q[0] + .5 * h * dq[0], b.q[1] + .5 * h * dq[1], b.q[2] + .5 * h * dq[2], b.q[3] + .5 * h * dq[3]]);
    const gy = groundY(b.p[0], b.p[2]); if (b.p[1] < gy - 1.2) { b.p[1] = gy + e.r + .2; b.v[1] = 0; }
  }

  function simulate(h, bodies) {
    for (const e of bodies) {
      const b = e.b, held = HELD && HELD.e === e;
      b.cnt = 0;
      if (held) heldForces(e, h); else b.v[1] -= CFG.grav * h;
      b.S = computeSph(e); waterForces(e, h);
    }
    const cs = []; for (const e of bodies) genContacts(e, cs);
    solve(cs);
    for (const e of bodies) integrate(e, h);
    for (const c of cs) correct(c);
    for (const e of bodies) {
      const b = e.b, held = HELD && HELD.e === e;
      if (!held && b.cnt > 0 && len3(b.v) < .15 && len3(b.w) < .2) b.sl += h; else b.sl = 0;
      if (b.sl > .6 && !held) { b.asleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0]; e.sph = null; storeToMesh(e); }
    }
  }

  /* ---------- ลำแสงดึงไม้ ---------- */
  const BN = 22, BR = 6, bPos = new Float32Array((BN + 1) * BR * 3), bGeo = new THREE.BufferGeometry(), bIdx = [];
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  for (let i = 0; i < BN; i++) for (let j = 0; j < BR; j++) { const a = i * BR + j, b2 = i * BR + (j + 1) % BR, c = (i + 1) * BR + j, d = (i + 1) * BR + (j + 1) % BR; bIdx.push(a, b2, c, b2, d, c); }
  bGeo.setIndex(bIdx);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(bGeo, beamMat); beam.frustumCulled = false; beam.visible = false; scene.add(beam);
  const glowGeo = new THREE.SphereGeometry(1, 8, 6), gA = new THREE.Mesh(glowGeo, beamMat), gB = new THREE.Mesh(glowGeo, beamMat);
  gA.visible = gB.visible = false; scene.add(gA); scene.add(gB);

  function updateBeam(t) {
    if (!HELD) { beam.visible = gA.visible = gB.visible = false; return; }
    const e = HELD.e, b = e.b, m = b.m, yaw = ctl.yaw;
    const S = [P.x + Math.cos(yaw) * .4 - Math.sin(yaw) * .45, P.y + 1.15, P.z - Math.sin(yaw) * .4 - Math.cos(yaw) * .45], E = b.p.slice();
    const mid = [(S[0] + E[0]) / 2, (S[1] + E[1]) / 2, (S[2] + E[2]) / 2], dist = Math.hypot(E[0] - S[0], E[1] - S[1], E[2] - S[2]);
    const sag = cl(.12 + m / 1200, .12, 1.4) * (dist * .18 + .1), tgt = [mid[0], mid[1] - sag, mid[2]];
    if (!HELD.cp) HELD.cp = tgt.slice();
    const kf = Math.min(1, (t - (HELD.bt || t)) * (6 / (1 + m / 600)) + .02); HELD.bt = t;
    for (let i = 0; i < 3; i++) HELD.cp[i] += (tgt[i] - HELD.cp[i]) * kf;
    const C = HELD.cp, wob = .025;
    for (let i = 0; i <= BN; i++) {
      const u = i / BN, v = 1 - u;
      const pt = [v * v * S[0] + 2 * v * u * C[0] + u * u * E[0], v * v * S[1] + 2 * v * u * C[1] + u * u * E[1], v * v * S[2] + 2 * v * u * C[2] + u * u * E[2]];
      let T = [2 * v * (C[0] - S[0]) + 2 * u * (E[0] - C[0]), 2 * v * (C[1] - S[1]) + 2 * u * (E[1] - C[1]), 2 * v * (C[2] - S[2]) + 2 * u * (E[2] - C[2])];
      const tl = len3(T) || 1; T = [T[0] / tl, T[1] / tl, T[2] / tl];
      let sd = cross(T, [0, 1, 0]); const sl = len3(sd); sd = sl > 1e-4 ? [sd[0] / sl, sd[1] / sl, sd[2] / sl] : [1, 0, 0];
      const up = cross(sd, T), env = Math.sin(Math.PI * u), off = Math.sin(u * 18 - t * 16) * wob * env;
      const rad = .03 + .035 * env * (.8 + .2 * Math.sin(t * 20 + u * 9));
      for (let j = 0; j < BR; j++) {
        const a = j / BR * Math.PI * 2, cs = Math.cos(a) * rad, sn = Math.sin(a) * rad, k = (i * BR + j) * 3;
        bPos[k] = pt[0] + sd[0] * (cs + off) + up[0] * sn; bPos[k + 1] = pt[1] + sd[1] * (cs + off) + up[1] * sn; bPos[k + 2] = pt[2] + sd[2] * (cs + off) + up[2] * sn;
      }
    }
    bGeo.attributes.position.needsUpdate = true; beam.visible = gA.visible = gB.visible = true;
    beamMat.color.setHex(m < 400 ? 0x7df9ff : m < 1000 ? 0xc6ff6b : 0xffa24a);
    gA.position.set(S[0], S[1], S[2]); gA.scale.setScalar(.08 + .02 * Math.sin(t * 18));
    gB.position.set(E[0], E[1], E[2]); gB.scale.setScalar(.12 + .03 * Math.sin(t * 15));
  }

  /* ---------- วงแหวนหมุนไม้ X/Y/Z ---------- */
  const GSZ = 118, RINGS = [{ k: 'Y', R: 52, c: '#5dff8a' }, { k: 'X', R: 38, c: '#ff6b6b' }, { k: 'Z', R: 24, c: '#6ba8ff' }];
  const gim = document.createElement('canvas'); gim.width = gim.height = GSZ;
  Object.assign(gim.style, { position: 'fixed', right: 'calc(10px + env(safe-area-inset-right))', bottom: '184px', width: GSZ + 'px', height: GSZ + 'px', zIndex: 9, pointerEvents: 'auto', touchAction: 'none', display: 'none', borderRadius: '50%', background: 'rgba(0,0,0,.35)' });
  document.body.appendChild(gim);
  const gctx = gim.getContext('2d'), gAng = { X: 0, Y: 0, Z: 0 };
  function drawGim() {
    const x = gctx, c = GSZ / 2; x.clearRect(0, 0, GSZ, GSZ);
    RINGS.forEach(r => {
      x.lineWidth = 8; x.strokeStyle = r.c; x.globalAlpha = .55; x.beginPath(); x.arc(c, c, r.R, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
      const a = gAng[r.k] - Math.PI / 2; x.fillStyle = '#fff'; x.beginPath(); x.arc(c + Math.cos(a) * r.R, c + Math.sin(a) * r.R, 5, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#000'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(r.k, c + Math.cos(a) * r.R, c + Math.sin(a) * r.R);
    });
    x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(CFG.snap ? '15°' : 'อิสระ', c, c);
  }
  let drag = null;
  const axisOf = k => k === 'Y' ? [0, 1, 0] : k === 'X' ? [Math.cos(ctl.yaw), 0, -Math.sin(ctl.yaw)] : [-Math.sin(ctl.yaw), 0, -Math.cos(ctl.yaw)];
  function rotateHeld(k, ang) {
    if (!HELD) return;
    HELD.tq = qnorm(qmul(qaxis(axisOf(k), k === 'Y' ? -ang : ang), HELD.tq)); gAng[k] += ang; drawGim();
  }
  const angAt = e => { const r = gim.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  gim.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    const r = gim.getBoundingClientRect(), rr = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) * (GSZ / (r.width || GSZ));
    if (rr < 13) { CFG.snap = !CFG.snap; drawGim(); if (window.updBuildBar) updBuildBar(); return; }
    let best = null, bd = 1e9; RINGS.forEach(q => { const d = Math.abs(rr - q.R); if (d < bd) { bd = d; best = q; } });
    if (!best || bd > 11) return;
    drag = { id: e.pointerId, k: best.k, last: angAt(e), acc: 0 }; try { gim.setPointerCapture(e.pointerId); } catch (_) { }
  });
  gim.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return; e.preventDefault();
    const a = angAt(e); let d = a - drag.last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; drag.last = a;
    if (!CFG.snap) { rotateHeld(drag.k, d); return; }
    drag.acc += d; while (Math.abs(drag.acc) >= DEG15) { const s = Math.sign(drag.acc); rotateHeld(drag.k, s * DEG15); drag.acc -= s * DEG15; }
  });
  const gEnd = e => { if (drag && e.pointerId === drag.id) drag = null; };
  gim.addEventListener('pointerup', gEnd); gim.addEventListener('pointercancel', gEnd);

  /* ---------- ถือ / วาง / ปล่อย / ขว้าง ---------- */
  function detach(e) {
    let i = LOGS.indexOf(e); if (i >= 0) LOGS.splice(i, 1);
    i = logMeshes.indexOf(e.mesh); if (i >= 0) logMeshes.splice(i, 1);
    if (typeof SHELTER !== 'undefined') { i = SHELTER.indexOf(e.mesh); if (i >= 0) SHELTER.splice(i, 1); }
  }
  function attach(e) {
    if (LOGS.indexOf(e) < 0) LOGS.push(e);
    if (logMeshes.indexOf(e.mesh) < 0) logMeshes.push(e.mesh);
    if (typeof SHELTER !== 'undefined' && SHELTER.indexOf(e.mesh) < 0) SHELTER.push(e.mesh);
  }
  function dropCanopy(e) { if (e.canopy) { scene.remove(e.canopy); e.canopy = null; } }
  function pick(e) {
    if (HELD) return;
    body(e); detach(e); dropCanopy(e); e.welded = false; wake(e); loadFromMesh(e); wakeAll();
    const d = Math.hypot(e.b.p[0] - P.x, e.b.p[2] - P.z);
    HELD = { e, tq: e.b.q.slice(), lastYaw: ctl.yaw, dist: cl(Math.max(d, 2.2 + e.len * .35), 3, 6.5), T: e.b.p.slice(), cp: null, bt: 0 };
    P.carry = { len: e.len, r: e.r, held: true };
    G.gYaw = ctl.yaw; G.gMode = 3; G.gOff = 0; ghost.scale.set(e.r, e.len, e.r);
    gAng.X = gAng.Y = gAng.Z = 0; drag = null; drawGim(); gim.style.display = 'block';
    if (window.updBuildBar) updBuildBar();
    toast('ยกท่อนไม้ด้วยลำแสง — ลากกล้องเร็ว ๆ เพื่อเหวี่ยง · วงแหวนขวา = หมุนไม้ · "ใช้" = วางเชื่อม', 4200);
  }
  function finish() { P.carry = null; ghost.visible = false; HELD = null; gim.style.display = 'none'; drag = null; if (window.updBuildBar) updBuildBar(); }
  function release(mode) {
    if (!HELD) return;
    const e = HELD.e, b = e.b; attach(e); e.welded = false; wake(e);
    if (mode === 'throw') {
      camera.getWorldDirection(_dir); const sp = Math.min(22, 20 / (1 + b.m / 600));
      b.v[0] = b.v[0] * .5 + _dir.x * sp; b.v[1] = b.v[1] * .5 + _dir.y * sp + 1.5; b.v[2] = b.v[2] * .5 + _dir.z * sp;
      b.w = [(Math.random() - .5) * 4, (Math.random() - .5) * 4, (Math.random() - .5) * 4];
    } else { for (let i = 0; i < 3; i++) b.v[i] *= 1.2; } // ปล่อยกลางแกว่ง = ไม้พุ่งตามแรงเหวี่ยง
    finish(); markDirtySafe();
  }
  function place() {
    if (!HELD) return;
    if (!ghostOK) { toast('เล็งไปที่พื้นหรือท่อนไม้'); return; }
    const e = HELD.e;
    e.mesh.position.copy(ghost.position); e.mesh.quaternion.copy(ghost.quaternion);
    attach(e); e.welded = true; e.b.v = [0, 0, 0]; e.b.w = [0, 0, 0]; loadFromMesh(e); wakeAll();
    finish(); markDirtySafe(); toast('🔗 วางและเชื่อมติดที่แล้ว');
  }
  const _dir = new THREE.Vector3();
  function heldStep(dt) {
    const H = HELD, e = H.e, b = e.b;
    const dy = ctl.yaw - H.lastYaw; if (dy) { H.tq = qnorm(qmul(qaxis([0, 1, 0], dy), H.tq)); H.lastYaw = ctl.yaw; } // ไม้หมุนตามทิศที่หัน
    camera.getWorldDirection(_dir);
    const T = [P.x + _dir.x * H.dist, P.y + 1.5 + _dir.y * H.dist, P.z + _dir.z * H.dist];
    T[1] = Math.max(T[1], groundY(T[0], T[2]) + e.r + .25); H.T = T;
    const ax = qrot(H.tq, [0, 1, 0]); G.gMode = Math.abs(ax[1]) > .95 ? 0 : 3;
    if (Math.hypot(b.p[0] - P.x, b.p[2] - P.z) > 14) { toast('ไม้ไกลเกินลำแสง — ปล่อยแล้ว'); release('drop'); }
  }

  /* ---------- ลูปหลัก (ผูกกับ updateFalling ที่เกมเรียกทุกเฟรม) ---------- */
  let prevP = null;
  function step(dt) {
    if (!(dt > 0)) return;
    if (prevP) { PV = [cl((P.x - prevP[0]) / dt, -8, 8), cl((P.z - prevP[1]) / dt, -8, 8)]; }
    if (HELD) heldStep(dt);
    const near = e => Math.hypot(e.b.p[0] - P.x, e.b.p[2] - P.z) < e.R + 1.2;
    for (const e of LOGS) { // ปลุกไม้ที่นอนอยู่ถ้าผู้เล่นเดินเข้าใกล้
      if (e.welded || !e.b || !e.b.asleep || !near(e)) continue;
      const S = sph(e);
      for (const c of S.c) { const py = cl(c[1], P.y + .3, P.y + 1.45); if (Math.hypot(c[0] - P.x, c[1] - py, c[2] - P.z) < e.r + CFG.prad + .02) { wake(e); break; } }
    }
    const n = Math.min(5, Math.max(1, Math.ceil(dt / .01))), h = dt / n;
    for (let k = 0; k < n; k++) {
      const bodies = []; for (const e of LOGS) if (!e.welded && e.b && !e.b.asleep) bodies.push(e);
      if (HELD) bodies.push(HELD.e);
      if (!bodies.length) break;
      simulate(h, bodies);
    }
    for (let i = LOGS.length - 1; i >= 0; i--) {
      const e = LOGS[i]; if (e.welded || !e.b || e.b.asleep && !e.canopy) continue;
      if (!e.b.asleep) storeToMesh(e);
      if (e.canopy) {
        const tp = qrot(e.b.q, [0, e.len / 2, 0]); e.canT += dt;
        e.canopy.position.set(e.b.p[0] + tp[0], e.b.p[1] + tp[1], e.b.p[2] + tp[2]); e.canopy.quaternion.set(e.b.q[0], e.b.q[1], e.b.q[2], e.b.q[3]);
        if (e.canT > 4.5 || (e.b.asleep && e.canT > 1.2)) dropCanopy(e);
      }
      if (e.b.p[1] < -25) removeLog(e);
    }
    if (HELD) storeToMesh(HELD.e);
    updateBeam(performance.now() / 1000);
    prevP = [P.x, P.z];
  }

  /* ---------- ครอบฟังก์ชันเดิมของเกม ---------- */
  const _uf = window.updateFalling;
  window.updateFalling = function (dt) { if (_uf) _uf.apply(this, arguments); step(dt); };

  const _add = window.addLog, CTX = { welded: false };
  window.addLog = function () { const e = _add.apply(this, arguments); initBody(e, CTX.welded); return e; };

  const _rm = window.removeLog;
  window.removeLog = function (e) { dropCanopy(e); const r = _rm.apply(this, arguments); wakeAll(); return r; };

  const _cut = window.cutLog;
  window.cutLog = function (e) {
    const w = !!(e.welded || !e.b), n0 = LOGS.length; CTX.welded = w;
    try { const r = _cut.apply(this, arguments); if (r) for (const o of LOGS.slice(-2)) if (!o.welded) wake(o); return r; }
    finally { CTX.welded = false; }
  };

  /* ต้นไม้ล้ม = กลายเป็นวัตถุอิสระทันที (แทนแอนิเมชันล้มแบบเดิม) */
  window.cutTree = function (t, hitY, fromX, fromZ) {
    const h = cl(hitY - t.gy, .4, t.H - .25), len = t.H - h; if (len < .3) return false;
    const r = t.r * (1 - .25 * (h / t.H0));
    t.H = h; t.trunk.scale.y = h;
    const can = t.canopy; t.canopy = null;
    let dx = t.x - fromX, dz = t.z - fromZ; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const e = _add.call(window, new THREE.Vector3(t.x, t.gy + h + len / 2, t.z), new THREE.Quaternion(), len, r);
    initBody(e, false); e.canopy = can || null;
    e.b.v = [dx * .8, 0, dz * .8]; e.b.w = [dz * 1.2, 0, -dx * 1.2];
    return true;
  };

  const _col = window.collide;
  window.collide = function (p, rad) {
    let free = false; for (const e of LOGS) if (!e.welded) { free = true; break; }
    if (!free) return _col.call(this, p, rad);
    const all = LOGS.slice(), keep = all.filter(e => e.welded);
    LOGS.length = 0; for (const e of keep) LOGS.push(e); // เหลือเฉพาะท่อนที่เชื่อมเป็นกำแพงตัน
    try { return _col.call(this, p, rad); } finally { LOGS.length = 0; for (const e of all) LOGS.push(e); }
  };

  const _dig = window.digAt;
  window.digAt = function () { const r = _dig.apply(this, arguments); wakeAll(); return r; };

  window.pickLog = function (e) { pick(e); };
  const _place = window.placeLog;
  window.placeLog = function () { if (HELD) place(); else if (_place) return _place.apply(this, arguments); };
  window.dropLog = function () { if (HELD) release('drop'); };
  const _gq = window.ghostQuat;
  window.ghostQuat = function () { return HELD ? new THREE.Quaternion(HELD.tq[0], HELD.tq[1], HELD.tq[2], HELD.tq[3]) : _gq.apply(this, arguments); };
  const _br = window.buildRot, _bm = window.buildMode;
  window.buildRot = function (d) { if (HELD) rotateHeld('Y', d * DEG15); else if (_br) _br(d); };
  window.buildMode = function () { if (HELD) rotateHeld('X', Math.PI / 2); else if (_bm) _bm(); };

  const _ub = window.updBuildBar;
  window.updBuildBar = function () {
    if (P.carry && P.carry.held) {
      const b = document.getElementById('buildbar'); if (!b) return;
      b.style.display = 'flex';
      b.innerHTML = '<button onpointerdown="LOGP.place()">✅ วาง/เชื่อม</button><button onpointerdown="LOGP.release()">✋ ปล่อย</button><button onpointerdown="LOGP.throwIt()">💨 ขว้าง</button>' +
        '<button onpointerdown="buildH(1)">▲</button><button onpointerdown="buildH(-1)">▼</button>';
      return;
    }
    return _ub ? _ub.apply(this, arguments) : undefined;
  };

  /* เซฟ/โหลด: เก็บสถานะ "เชื่อมแล้ว" เป็นช่องที่ 10 ของแต่ละท่อน */
  const _ex = window.exportWorld;
  window.exportWorld = function () {
    const w = _ex.apply(this, arguments), f = n => +n.toFixed(3);
    w.logs.forEach((a, i) => a.push(LOGS[i] && LOGS[i].welded ? 1 : 0));
    if (HELD) { const b = HELD.e.b; w.logs.push([f(b.p[0]), f(b.p[1]), f(b.p[2]), f(b.q[0]), f(b.q[1]), f(b.q[2]), f(b.q[3]), f(HELD.e.len), f(HELD.e.r), 0]); }
    return w;
  };
  const _im = window.importWorld;
  window.importWorld = function (w) {
    if (HELD) { dropCanopy(HELD.e); scene.remove(HELD.e.mesh); finish(); }
    CTX.welded = true;
    try { _im.apply(this, arguments); } finally { CTX.welded = false; }
    if (w && w.logs) w.logs.forEach((a, i) => { const e = LOGS[i]; if (!e) return; e.welded = a.length > 9 ? !!a[9] : true; if (!e.welded) wake(e); });
  };
  const _rs = window.resetWorld;
  window.resetWorld = function () { if (HELD) { scene.remove(HELD.e.mesh); finish(); } LOGS.forEach(dropCanopy); return _rs.apply(this, arguments); };

  LOGS.forEach(e => body(e));
  window.LOGP = { place, release: () => release('drop'), throwIt: () => release('throw'), step, CFG, get held() { return HELD; } };
})();
