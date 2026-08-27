/* ชุดเทสต์ Patch v8.6 — SOFTENED EXP CURVE · RETROACTIVE BATCH LEVEL-UP SYNC
                        · TOWER & BOSS CLEAR EXP INJECTIONS
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_progression.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส)
       และ fetch ต้อง "ตอบกลับ" ไม่ใช่ค้าง ไม่งั้น v5.8 รอตลอดกาล ล็อกอินไม่มีวันสำเร็จ
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7
       → ผ่านประตูกรองชั้น 20 ของ v8.2)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F/BA_INC_AT)
     · อ่านค่าสดทุกเคส ห้ามแคชไว้ต้นไฟล์ (กับดักข้อ 20)
     · ทดสอบความคงทนต้องผ่าน exitGame() แล้วล็อกอินใหม่จริง (กับดักข้อ 16 · 38)      */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'progression_log.txt');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }
function near(name, got, want, tol) { ok(name, Math.abs(got - want) <= tol, { got: got, want: want, tol: tol }); }

/* สูตรของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ — เป็น "สารบัญชุดที่สอง" ที่จำเป็น
   ถ้าอ่านค่าคงที่ในเกมมาคูณเอง เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนสูตรไปแล้ว */
function wantReq(lv) {
  const n = Math.max(1, Math.min(99, Math.floor(lv)));
  return Math.floor(85 * Math.pow(n, 1.25) + n * 35);
}
function wantCum(lv) {
  const n = Math.max(1, Math.min(99, Math.floor(lv)));
  let t = 0;
  for (let i = 1; i < n; i++) t += wantReq(i);
  return t;
}
/* เส้นโค้งเดิมของ v7.6 — ใช้คำนวณว่า "บัญชีเก่าเคยหา EXP มาแล้วเท่าไร" */
function legacyReq(lv) {
  const n = Math.max(1, Math.min(99, Math.floor(lv)));
  return Math.floor(300 * Math.pow(n, 1.65) + 50 * Math.pow(n, 2.0));
}
function legacyCum(lv) {
  const n = Math.max(1, Math.min(99, Math.floor(lv)));
  let t = 0;
  for (let i = 1; i < n; i++) t += legacyReq(i);
  return t;
}
function wantLevelOf(total) {
  let lv = 1;
  while (lv < 99 && total >= wantCum(lv + 1)) lv++;
  return lv;
}

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(null), text: () => Promise.resolve('null')
    });
    window.EventSource = function () { this.close = function () {}; this.addEventListener = function () {}; };
  });
  await page.goto('file://' + FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  return { ctx: ctx, page: page, errs: errs };
}

async function ackRules(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(280);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} if (typeof rgAck === 'function') rgAck(); });
  await page.waitForTimeout(700);
}

/* ปิดทุกหน้าต่างที่คั่นอยู่ — หน้าต่างจั่วของ v4.7 · gate ของ v4.1/v4.6 · ประตูวาป
   ของ v4.9.2 · ประตูกรองชั้น 20 ของ v8.2 (ไม่กดผ่านจะค้างในสถานะหยุดของ v4.8.1) */
async function clearOverlays(page) {
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
      const gt = document.getElementById('baWvGate');
      if (gt && gt.classList.contains('active') && typeof baWvGateGo === 'function') { baWvGateGo(); return 'apex'; }
      if (typeof snGateConfirm === 'function' && document.querySelector('.sn-gate.active')) { snGateConfirm(); return 'gate'; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { warpGo(); return 'warp'; }
      return '';
    });
    if (!busy) break;
    await page.waitForTimeout(760);
  }
  await page.waitForTimeout(120);
}

async function enterGame(page, id) {
  await ackRules(page);
  await page.evaluate(u => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1111';
    document.getElementById('reg-pw2').value = '1111';
    handleSubmit();
  }, id);
  await page.waitForTimeout(1400);
  await clearOverlays(page);
  await page.evaluate(() => { G.maxFloor = FLOOR_MAX; recalcStats(); });
}

/* ยัดบัญชีรุ่นเก่า (ยังไม่มีตรารุ่น xpv) ลง localStorage ตรง ๆ */
async function seedLegacy(page, u, over) {
  await page.evaluate(function (arg) {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('yao_students') || '{}'); } catch (e) {}
    s[arg.u] = Object.assign({
      user: arg.u, name: 'ฮันเตอร์ ' + arg.u, pw: '1111', classroom: 'ม.4',
      level: 10, exp: 0, maxExp: 100, gold: 0,
      createdAt: Date.now(), lastActive: Date.now()
    }, arg.over || {});
    localStorage.setItem('yao_students', JSON.stringify(s));
  }, { u: u, over: over || null });
}

async function loginAs(page, u) {
  await page.evaluate(function (id) {
    switchTab('login');
    document.getElementById('login-id').value = id;
    document.getElementById('login-pw').value = '1111';
    handleSubmit();
  }, u);
  await page.waitForTimeout(1400);
  await clearOverlays(page);
}

(async () => {
  fs.writeFileSync(LOG, '=== test_progression · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ติดตั้ง · ค่าคงที่ · ทางเข้าสาธารณะ ═════════════════════════
  {
    head('บล็อก 1 · ติดตั้ง · ค่าคงที่ · ทางเข้าสาธารณะ');
    const b = await boot(browser);

    const api = await b.page.evaluate(() => ({
      req: typeof baGetRequiredExp, cum: typeof baGetCumulativeExp,
      init: typeof baInitProgression, audit: typeof baBattleAudit
    }));
    eq('ฟังก์ชันตามชื่อในสเปกมีครบทั้งสามตัว',
       [api.req, api.cum, api.init], ['function', 'function', 'function']);

    const a = await b.page.evaluate(() => baBattleAudit().progression);
    ok('baBattleAudit().progression มีอยู่จริง', !!a);
    eq('รุ่นของแพตช์', a.ver, '8.6');
    eq('เพดานเลเวล', a.max, 99);
    eq('ตัวคูณของเส้นโค้งตรงสเปก', [a.curve.k, a.curve.p, a.curve.lin], [85, 1.25, 35]);
    eq('ตาราง EXP ตอนเคลียร์ตรงสเปก',
       [a.clear.floor, a.clear.zone, a.clear.apex, a.clear.flaw], [350, 1500, 4000, 1.5]);
    eq('เกณฑ์ตื่นพลังคือ Lv 50 (ของ v8.5)', a.tierLv, 50);

    /* v8.6 ทับค่าที่ v7.6 รายงานไว้ให้ตรงกับเส้นโค้งที่ทำงานจริง */
    const lv = await b.page.evaluate(() => baBattleAudit().lvScale);
    eq('audit ของ v7.6 รายงานเส้นโค้งที่ทำงานจริง',
       [lv.exp.k, lv.exp.p, lv.exp.k2, lv.exp.p2], [85, 1.25, 35, 1]);
    eq('lvScale.exp.live ตรงกับ expForLevel จริง', lv.exp.live, wantReq(1));

    ok('ไม่ได้เพิ่มปุ่มในแถวปุ่มล่างสักใบ (ยังเป็น 10 ใบของ v8.5)',
       await b.page.evaluate(() => document.querySelectorAll('.g-actions .g-btn').length) === 10);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 2 · เส้นโค้ง EXP ชุดใหม่ + ตารางสะสม ════════════════════════════
  {
    head('บล็อก 2 · Softened Curve 85·lv^1.25 + lv·35');
    const b = await boot(browser);

    const lvs = [1, 2, 3, 5, 10, 20, 30, 45, 50, 72, 90, 99];
    eq('เพดาน EXP ตรงสูตรของสเปกทุกเลเวลที่สุ่มมา',
       await b.page.evaluate(ns => ns.map(n => expForLevel(n)), lvs), lvs.map(wantReq));
    eq('baGetRequiredExp กับ expForLevel เป็นเส้นโค้งเดียวกัน',
       await b.page.evaluate(ns => ns.map(n => baGetRequiredExp(n) === expForLevel(n)), lvs),
       lvs.map(() => true));
    ok('เส้นโค้งโตขึ้นเรื่อย ๆ ไม่มีช่วงไหนแบนหรือย้อน',
       await b.page.evaluate(() => {
         for (let n = 1; n < 99; n++) if (expForLevel(n + 1) <= expForLevel(n)) return false;
         return true;
       }));
    eq('เลเวลเกิน 99 ใช้เพดานของ 99',
       await b.page.evaluate(() => [expForLevel(100), expForLevel(400)]),
       [wantReq(99), wantReq(99)]);
    eq('ค่าเพี้ยนตกกลับไปที่เลเวล 1 ไม่โยน error',
       await b.page.evaluate(() => [expForLevel(0), expForLevel(-9), expForLevel(NaN), expForLevel(undefined)]),
       [wantReq(1), wantReq(1), wantReq(1), wantReq(1)]);

    const cums = [1, 2, 10, 50, 99];
    eq('ตาราง EXP สะสมตรงกับผลรวมของเพดานทุกขั้น',
       await b.page.evaluate(ns => ns.map(n => baGetCumulativeExp(n)), cums), cums.map(wantCum));
    eq('EXP สะสมถึง Lv 1 เป็น 0', await b.page.evaluate(() => baGetCumulativeExp(1)), 0);

    /* ── เป้าของสเปก: Lv 50 ภายใน 15–20 รอบหอคอยเต็ม ── */
    const per = await b.page.evaluate(() => baBattleAudit().progression.clear.perRun);
    eq('EXP จากการเคลียร์ครบหนึ่งรอบหอคอย', per, 15 * 350 + 4 * 1500 + 4000);
    const runs = wantCum(50) / per;
    ok('ถึง Lv 50 ภายใน 15-20 รอบหอคอยเต็มตามเป้าของสเปก (ได้ ' + runs.toFixed(1) + ' รอบ)',
       runs >= 15 && runs <= 20, { runs: runs, need: wantCum(50), per: per });
    ok('เส้นโค้งใหม่ผ่อนกว่าของ v7.6 อย่างมีนัย (ผ่อนลง ' +
       (legacyCum(50) / wantCum(50)).toFixed(1) + ' เท่า)', legacyCum(50) / wantCum(50) > 5);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 3 · Absolute Retroactive Batch Level-Up Sync ════════════════════
  {
    head('บล็อก 3 · แปลงเลเวลย้อนหลังจาก EXP สะสมตลอดชีพ');
    const b = await boot(browser);
    await ackRules(b.page);

    for (const src of [3, 5, 10, 15]) {
      await seedLegacy(b.page, 'old' + src, { level: src, exp: 0 });
      const got = await b.page.evaluate(u => {
        const a = loadStore()[u];
        return { lv: a.level, exp: a.exp, maxExp: a.maxExp, xpv: a.xpv };
      }, 'old' + src);
      const want = wantLevelOf(legacyCum(src));
      eq('บัญชีเก่า Lv ' + src + ' ถูกตีค่าใหม่เป็น Lv ' + want, got.lv, want);
      eq('เพดาน EXP ของเลเวลใหม่ตรงเส้นโค้ง (Lv ' + src + ')', got.maxExp, wantReq(want));
      eq('EXP ที่เหลือคือเศษที่ยังไม่ครบขั้นถัดไป (Lv ' + src + ')',
         got.exp, legacyCum(src) - wantCum(want));
      eq('ปั๊มตรารุ่นไว้กันแปลงซ้ำ (Lv ' + src + ')', got.xpv, '8.6');
    }

    /* อ่านซ้ำต้องได้ผลเท่าเดิมเป๊ะ — การแปลงเป็น deterministic ล้วน */
    const twice = await b.page.evaluate(() => {
      const a1 = loadStore()['old10'], r1 = { lv: a1.level, exp: a1.exp };
      const a2 = loadStore()['old10'], r2 = { lv: a2.level, exp: a2.exp };
      const a3 = loadStore()['old10'], r3 = { lv: a3.level, exp: a3.exp };
      return [r1, r2, r3];
    });
    eq('อ่านซ้ำสามรอบได้ผลเท่าเดิมทุกครั้ง', [twice[1], twice[2]], [twice[0], twice[0]]);

    /* บัญชีที่แปลงแล้วและถูกเซฟลง store ต้องไม่ถูกแปลงซ้ำอีกรอบ */
    const sealed = await b.page.evaluate(() => {
      const s = loadStore();
      localStorage.setItem('yao_students', JSON.stringify(s));   /* xpv ติดไปด้วย */
      const a = loadStore()['old10'];
      return { lv: a.level, xpv: a.xpv };
    });
    eq('บัญชีที่มีตรารุ่นแล้วไม่ถูกแปลงซ้ำ', sealed.lv, twice[0].lv);

    /* ไม่มีวันลดขั้น แม้ยัดค่าเพี้ยนเข้าไป */
    await seedLegacy(b.page, 'weird', { level: 40, exp: -500 });
    const weird = await b.page.evaluate(() => {
      const a = loadStore()['weird'];
      return { lv: a.level, exp: a.exp };
    });
    ok('ค่าเพี้ยน (exp ติดลบ) ไม่ทำให้เลเวลลดลง', weird.lv >= 40, weird);
    ok('EXP ที่เหลือไม่ติดลบ', weird.exp >= 0, weird);

    /* เพดาน 99 — บัญชีที่แรงเกินเส้นต้องหยุดที่ 99 และหลอดต้องไม่ล้น */
    await seedLegacy(b.page, 'godlike', { level: 60, exp: 0 });
    const god = await b.page.evaluate(() => {
      const a = loadStore()['godlike'];
      return { lv: a.level, exp: a.exp, maxExp: a.maxExp };
    });
    eq('บัญชีที่แรงเกินเส้นหยุดที่ Lv 99 พอดี', god.lv, 99);
    ok('หลอด EXP ที่เพดานไม่ล้น (กัน levelUpCheck ของ v4.0 ดันทะลุ 99)',
       god.exp < god.maxExp, god);

    /* แถวสดของ v5.7 เป็นจอแสดงผล ห้ามแตะ */
    const mirror = await b.page.evaluate(() => {
      const a = { user: 'mir', level: 12, exp: 7, lrMirror: true };
      const r = baInitProgression(a);
      return { r: r, lv: a.level, exp: a.exp };
    });
    eq('แถวสดของ v5.7 ไม่ถูกแปลงเลย', [mirror.r, mirror.lv, mirror.exp], [null, 12, 7]);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 4 · ค่าพลัง · แต้มอิสระ · ป้ายแรงค์ โตตามอัตโนมัติ ══════════════
  {
    head('บล็อก 4 · Auto-grant growth + free points + ป้ายแรงค์');
    const b = await boot(browser);
    await ackRules(b.page);
    await seedLegacy(b.page, 'grow1', { level: 10, exp: 0, classId: 'slayer' });

    const g = await b.page.evaluate(() => {
      const a = loadStore()['grow1'];
      const c = BA_PL_BY_ID[a.classId || BA_PL_DEF_ID];
      return { lv: a.level, stats: a.stats, base: c.base, grow: c.grow,
               free: baPlFree(a), maxHp: a.maxHp, rank: baLvRank(a.level).label };
    });
    const stepsGrow = g.lv - 1;
    eq('ค่าพลังหลัก (+2/เลเวล) โตตามเลเวลใหม่ให้เอง',
       g.stats.str, g.base.str + g.grow.str * stepsGrow);
    eq('ค่าพลังรอง (+1/เลเวล) โตตามเลเวลใหม่ให้เอง',
       g.stats.vit, g.base.vit + g.grow.vit * stepsGrow);
    eq('ค่าพลังที่สายนี้ไม่ได้โตเองยังเท่าฐานเดิม', g.stats.agi, g.base.agi);
    eq('แต้มอิสระได้ +2 ต่อเลเวลครบทุกขั้นที่ข้ามมา', g.free, stepsGrow * 2);
    ok('HP สูงสุดถูกคำนวณใหม่ตามเลเวล/VIT ใหม่แล้ว', g.maxHp > 750, g);
    ok('ป้ายแรงค์ตามเลเวลขยับตามด้วย (ได้ ' + g.rank + ')', g.rank !== 'E-RANK', g);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 5 · ตื่นพลัง C1 → C2 + toast ประกาศ ═════════════════════════════
  {
    head('บล็อก 5 · Auto-awaken ที่ Lv 50 และ toast ประกาศ');
    const b = await boot(browser);
    await enterGame(b.page, 'awk1');

    const before = await b.page.evaluate(() => {
      G.level = 49; G.exp = 0; G.maxExp = expForLevel(49); recalcStats();
      const el = document.getElementById('snLayer'); if (el) el.innerHTML = '';
      return { tier: baBattleAudit().progression.tier, n: baBattleAudit().progression.n.awaken };
    });
    eq('ก่อนถึงเกณฑ์ยังเป็นร่างต้น C1', before.tier, 'c1');

    const after = await b.page.evaluate(() => {
      G.exp = G.maxExp + 5;
      levelUpCheck();
      const a = baBattleAudit().progression;
      return { lv: G.level, tier: a.tier, n: a.n.awaken,
               toast: document.querySelectorAll('#snLayer .sn').length,
               tag: (document.querySelector('#snLayer .sn') || { textContent: '' }).textContent };
    });
    eq('ข้าม Lv 50 แล้วเป็นร่างตื่นพลัง C2 ทันที', [after.lv, after.tier], [50, 'c2']);
    eq('ยิงประกาศตื่นพลังหนึ่งครั้ง', after.n - before.n, 1);
    ok('ประกาศเป็น toast ไม่ใช่ gate (นาฬิกาต่อข้ออาจเดินอยู่)',
       after.toast >= 1 && !(await b.page.evaluate(() => !!document.querySelector('.sn-gate.active'))));
    ok('ป้ายกำกับของ toast เป็นสารบัญของชั้นนี้ (LEVEL 02/02)',
       /LEVEL 02\/02/.test(after.tag), after.tag);

    /* ชื่อ/สกิลของร่าง C2 เป็นของ v8.5 ที่คิดสดจากเลเวล — ต้องเลื่อนตามให้เอง */
    const nm = await b.page.evaluate(() => {
      const c = baPlClass(G);
      return { tier: baPlTier(G), en: c.c2.en };
    });
    eq('v8.5 เลื่อนร่างให้เองโดยชั้นนี้ไม่ต้องสลับอะไร', nm.tier, 'c2');

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6 · Tower & Boss Clear EXP Injections ═══════════════════════════
  {
    head('บล็อก 6 · EXP ตอนเคลียร์ชั้น · บอสโซน · ยอดหอคอย · ไร้ที่ติ ×1.5');
    const b = await boot(browser);
    await enterGame(b.page, 'clr1');

    async function run(floor, boss, miss) {
      return await b.page.evaluate(function (arg) {
        G.practiceMode = false; G.locked = false;
        G.floor = arg.f; G.floorProgress = 0;
        BA_INC_F = arg.f; BA_INC_AT = -1;            /* ปิดระบบบุกรุกของ v6.6 */
        BA_XP_MISS_F = arg.f; BA_XP_MISS = arg.m;
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
        const e0 = G.exp, l0 = G.level;
        clearFloor(arg.b);
        let d = G.exp - e0;
        for (let l = l0; l < G.level; l++) d += expForLevel(l);
        const a = baBattleAudit().progression;
        return { gained: d, clear: a.lastClear, fb: (fb ? fb.textContent : '') };
      }, { f: floor, b: boss, m: miss });
    }

    const f3 = await run(3, false, 1);
    eq('ชั้นมอนสเตอร์ทั่วไปได้ +350 EXP จากชั้นนี้', f3.clear.base, 350);
    eq('ยอดรวมที่ได้ = ของ v4.0 (60) + ก้อนใหม่', f3.gained, f3.clear.early + 350);
    ok('เขียนบรรทัดผลลัพธ์บอกยอดที่เติมให้', /\+350 EXP/.test(f3.fb), f3.fb);

    const f8 = await run(8, true, 1);
    eq('บอสประจำโซนได้ +1500 EXP', f8.clear.base, 1500);
    eq('ระบุชนิดเป็น zone', f8.clear.kind, 'zone');

    const f20 = await run(20, true, 1);
    eq('ยอดหอคอยได้ +4000 EXP', f20.clear.base, 4000);
    eq('ระบุชนิดเป็น apex', f20.clear.kind, 'apex');

    /* ไร้ที่ติ — ×1.5 ของ "ยอดรวมของรอบนั้น" ทั้งก้อน */
    const flaw = await run(3, false, 0);
    ok('ไร้ที่ติทั้งชั้นถูกตรวจจับ', flaw.clear.flawless === true, flaw.clear);
    eq('โบนัสไร้ที่ติ = 50% ของ (ของชั้นล่าง + ก้อนใหม่)',
       flaw.clear.bonus, Math.round((flaw.clear.early + 350) * 0.5));
    eq('ยอดรวมของรอบไร้ที่ติ = 1.5 เท่าของรอบธรรมดา',
       flaw.gained, flaw.clear.early + 350 + flaw.clear.bonus);
    ok('เขียนบรรทัดผลลัพธ์บอกโบนัสไร้ที่ติ', /ไร้ที่ติ ×1.5/.test(flaw.fb), flaw.fb);

    /* ตัวนับ "ไร้ที่ติ" ต้องผูกกับเลขชั้น ไม่ใช่กับรอบการเล่น — ตอบข้อแรกของชั้นใหม่
       แล้วตัวนับต้องรีเซ็ตให้เอง · **ชั้นที่ยังไม่มีใครตอบสักข้อไม่นับว่าไร้ที่ติ**
       (พิสูจน์ไม่ได้ว่าไม่พลาด) ซึ่งเป็นพฤติกรรมที่ตั้งใจ ไม่ใช่บั๊ค */
    const carry = await b.page.evaluate(() => {
      BA_XP_MISS_F = 7; BA_XP_MISS = 3;
      G.floor = 8; G.floorProgress = 0; G.locked = false;
      BA_INC_F = 8; BA_INC_AT = -1;
      const stale = baXpFlawless(8);
      const m = G.currentMonster;
      G.questionStart = Date.now();
      resolveAnswer(m.answer, null, false);      /* ตอบถูกข้อแรกของชั้น 8 */
      return { stale: stale, f: BA_XP_MISS_F, miss: BA_XP_MISS,
               now: baXpFlawless(8), old: baXpFlawless(7) };
    });
    ok('ชั้นที่ยังไม่มีใครตอบสักข้อไม่นับว่าไร้ที่ติ', carry.stale === false, carry);
    eq('ตอบข้อแรกของชั้นใหม่แล้วตัวนับรีเซ็ตให้เอง', [carry.f, carry.miss], [8, 0]);
    eq('พลาดในชั้น 7 ไม่ตามไปตัดสิทธิ์ชั้น 8', [carry.old, carry.now], [false, true]);

    /* โหมดฝึกจุดอ่อนไม่ได้ EXP ก้อนนี้เลย */
    const prac = await b.page.evaluate(() => {
      G.practiceMode = true; G.floor = 5; G.floorProgress = 0; G.locked = false;
      BA_INC_F = 5; BA_INC_AT = -1;
      const e0 = G.exp, l0 = G.level, n0 = baBattleAudit().progression.n.award;
      clearFloor(false);
      let d = G.exp - e0;
      for (let l = l0; l < G.level; l++) d += expForLevel(l);
      G.practiceMode = false;
      return { gained: d, paid: baBattleAudit().progression.n.award - n0 };
    });
    eq('โหมดฝึกจุดอ่อนไม่ได้ EXP ก้อนของชั้นนี้สักหน่วย', prac.paid, 0);

    /* 💀 พันธสัญญาโลหิตทมิฬห้ามฟื้นทุกทาง — levelUpCheck เซ็ต hp = maxHp ตอนขึ้นเลเวล */
    const vow = await b.page.evaluate(() => {
      CD_CARD = CD_BY_ID['vow']; CD_BAND = cdBandOf(G.floor);
      CD_ST = { ward: false, noItem: true, noHeal: true, atk: 0, perfect: true, hit: 0, miss: 0 };
      G.hp = 1;
      const hp0 = G.hp;
      baXpPay(expForLevel(G.level) * 2);
      const r = { hp: G.hp, hp0: hp0 };
      CD_CARD = null; CD_BAND = -1;
      return r;
    });
    eq('ถือ 💀 อยู่แล้วขึ้นเลเวล HP ต้องไม่ถูกฟื้น', vow.hp, vow.hp0);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 7 · ความคงทน — exitGame แล้วล็อกอินใหม่จริง ═════════════════════
  {
    head('บล็อก 7 · เลเวลที่แปลงแล้วต้องรอดข้ามการล็อกอิน');
    const b = await boot(browser);
    await ackRules(b.page);
    await seedLegacy(b.page, 'keep1', { level: 12, exp: 0 });
    await loginAs(b.page, 'keep1');

    const want = wantLevelOf(legacyCum(12));
    /* v4.9.1 ตั้ง NC_MAX = 1 (Single Active Replace) การ์ดใบใหม่ล้างใบเก่าทันที
       จึงเช็กจาก #snLayer อย่างเดียวไม่ได้ — ต้องอ่านตัวนับของชั้นนี้แทน */
    const inGame = await b.page.evaluate(() => {
      const a = baBattleAudit().progression;
      return { lv: G.level, exp: G.exp, maxExp: G.maxExp, ann: a.n.ann, pending: a.pending };
    });
    eq('ล็อกอินแล้ว G ได้เลเวลที่แปลงแล้ว', inGame.lv, want);
    eq('เพดาน EXP ของ G ตรงเส้นโค้งใหม่', inGame.maxExp, wantReq(want));
    ok('ยิงประกาศการปรับระดับย้อนหลัง', inGame.ann >= 1, inGame);
    eq('คิวประกาศถูกหยิบไปใช้แล้ว ไม่ค้าง', inGame.pending, 0);

    await b.page.evaluate(() => { saveProgress(); exitGame(); });
    await b.page.waitForTimeout(700);
    const stored = await b.page.evaluate(() =>
      JSON.parse(localStorage.getItem('yao_students'))['keep1']);
    eq('store เก็บเลเวลใหม่ไว้จริง', stored.level, want);
    eq('store เก็บตรารุ่นไว้จริง', stored.xpv, '8.6');

    await b.page.evaluate(() => { switchTab('login'); });
    await loginAs(b.page, 'keep1');
    const back = await b.page.evaluate(() => {
      const a = baBattleAudit().progression;
      return { lv: G.level, exp: G.exp, ann: a.n.ann };
    });
    eq('ล็อกอินรอบสองยังเป็นเลเวลเดิม ไม่ถูกแปลงซ้ำ', back.lv, want);
    eq('รอบสองไม่ประกาศซ้ำอีก (แปลงไปแล้ว)', back.ann, inGame.ann);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 8 · เลย์เอาต์ต้องไม่ขยับ (CLS = 0) ══════════════════════════════
  {
    head('บล็อก 8 · การ์ดโจทย์ต้องสูงเท่าเดิมทุกความกว้าง');
    for (const w of [320, 390]) {
      const b = await boot(browser, w, 844);
      await enterGame(b.page, 'cls' + w);
      await b.page.evaluate(() => {
        const m = G.currentMonster;
        if (m) {
          m.word = '北京语言大学';
          m.pinyin = 'Běijīng Yǔyán Dàxué';
          m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
          m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
          document.getElementById('gWord').textContent = m.word;
          document.getElementById('gPinyin').textContent = m.pinyin;
          renderChoices();
        }
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
      });
      await b.page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await b.page.waitForTimeout(250);
      const h = await b.page.evaluate(() => {
        const card = document.querySelector('.ac-battle');
        return card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : -1;
      });
      eq('ความสูงการ์ดโจทย์บนจอ ' + w, h, w === 320 ? 354.8 : 340.8);
      ok('ไม่ล้นแนวนอนบนจอ ' + w,
         await b.page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('ไม่มี pageerror บนจอ ' + w, b.errs.length === 0, b.errs);
      await b.ctx.close();
    }
  }

  say('\n══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════');
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
