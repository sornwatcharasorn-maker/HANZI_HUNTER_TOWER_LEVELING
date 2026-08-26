/* ชุดเทสต์ Micro-Patch — DAILY QUESTS & DIAMOND DROPS  (เนมสเปซ ba)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_daily_quests.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส)
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F = ชั้น; BA_INC_AT = -1;)
     · พิสูจน์ว่าแผง "มองเห็นจริง" ด้วย elementFromPoint ไม่ใช่เช็กแค่ .active (กับดักข้อ 25)
     · วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนเสมอ          */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'daily_quests_log.txt');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }

/* ตารางของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ — เป็น "สารบัญชุดที่สอง" ที่จำเป็น
   ถ้าอ่านค่าคงที่ในเกมมาเทียบกับตัวเอง เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนตารางไปแล้ว */
const WANT_ABYSS = [
  { to: 10, k: 4,  p: 2, c: 3  },
  { to: 20, k: 6,  p: 3, c: 4  },
  { to: 24, k: 8,  p: 4, c: 5  },
  { to: 25, k: 15, p: 5, c: 10 }
];
const WANT_QUESTS = [
  { id: 'f20',    goal: 1,  rw: 20 },
  { id: 'abyss',  goal: 5,  rw: 50 },
  { id: 'mini',   goal: 50, rw: 30 },
  { id: 'dragon', goal: 1,  rw: 20 }
];

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

async function clearOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
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
  /* ปลดล็อกแรงค์ให้ครบก่อนเสมอ ไม่งั้นแผงแกนกลางระบบโดน showLock ปัดตก */
  await page.evaluate(() => { G.maxFloor = FLOOR_MAX; recalcStats(); });
}

/* พาไปยืนชั้นที่ต้องการโดยไม่ให้ลูกเต๋าบุกรุกของ v6.6 มาแทรก
   (ปั๊ม BA_INC_F ให้ตรงชั้น = ทอยไปแล้ว จะไม่ถูกทอยซ้ำใน baIncSync) */
async function goFloor(page, f, abyss) {
  await page.evaluate(o => {
    const b = abOf(G);
    if (b) b.abyss = !!o.abyss;
    G.floor = o.f;
    G.floorProgress = 0;
    G.practiceMode = false;
    BA_INC_F = o.f; BA_INC_AT = -1; BA_INC_ID = ''; BA_INC_M = null;
    nextMonster();
    G.locked = false;
  }, { f: f, abyss: !!abyss });
  await page.waitForTimeout(220);
  await clearOverlays(page);
  await page.evaluate(() => { G.locked = false; });
}

/* วัดส่วนต่าง 💎 คร่อมการล้มอสูรหนึ่งตัวผ่านทางจริง (onMonsterDefeated) */
async function slay(page, perfect) {
  return await page.evaluate(p => {
    BA_QD_PF = !!p; BA_QD_PF_M = G.currentMonster;
    const before = abShards(G);
    onMonsterDefeated();
    return { got: abShards(G) - before, floor: G.floor };
  }, perfect !== false);
}

(async () => {
  fs.writeFileSync(LOG, '=== test_daily_quests · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ติดตั้ง · ตารางค่าคงที่ · ทางเข้าสาธารณะ ═══════════════════
  {
    head('บล็อก 1 · ติดตั้ง · ตารางค่าคงที่ · ทางเข้าสาธารณะ');
    const b = await boot(browser);

    const a = await b.page.evaluate(() => baBattleAudit());
    ok('baBattleAudit().daily มีอยู่จริง', !!a.daily);
    ok('baBattleAudit().gems มีอยู่จริง', !!a.gems);
    eq('รุ่นของแพตช์', a.daily.ver, '1.0');
    ok('สไตล์ถูกแทรกตั้งแต่โหลดหน้า', a.daily.styled === true);

    eq('ชั้นบอสทั่วไปได้ 💎', a.gems.boss, 2);
    eq('ปราบผู้บุกรุกได้ 💎', a.gems.inc, 4);
    eq('ผู้บุกรุกไร้ที่ติบวกเพิ่ม', a.gems.incPerfect, 1);
    eq('สามเฟสของบอสยอดหอคอย', a.gems.f20, [3, 4, 5]);
    eq('เคลียร์ยอดหอคอย', a.gems.f20Clear, 3);
    eq('รวมบอสชั้นสุดท้ายได้ 15 💎 พอดีตามสเปก',
       a.gems.f20[0] + a.gems.f20[1] + a.gems.f20[2] + a.gems.f20Clear, 15);
    eq('ตารางเหวลึกครบสี่ระดับ', a.gems.abyss, WANT_ABYSS);
    eq('โอกาสหีบสมบัติ', a.gems.chest, 35);
    eq('จบรอบเหวลึกได้ 💎', a.gems.allClear, 25);

    eq('เควสครบ 5 รายการ (4 + โบนัสเก็บครบ)', a.daily.defs.length, 4);
    eq('เป้าหมาย/รางวัลของทั้งสี่เควส', a.daily.defs, WANT_QUESTS);
    eq('โบนัสเก็บครบทั้งวัน', a.daily.allRw, 50);
    eq('รวมรางวัลเควสทั้งวัน = 170 💎',
       a.daily.defs.reduce((s, q) => s + q.rw, 0) + a.daily.allRw, 170);

    ok('ทางเข้าสาธารณะเป็นฟังก์ชันครบทุกตัว',
       await b.page.evaluate(() => ['baQdOpen', 'baQdClose', 'baQdClaim', 'baQdRender', 'baQdEnsure']
         .every(k => typeof window[k] === 'function' || typeof eval(k) === 'function')));

    ok('ยังไม่เข้าเกม = ยังไม่มีข้อมูลเควส', a.daily.c === null, a.daily.c);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 2 · ข้อมูล · รอบวัน · ซ่อมข้อมูลเพี้ยน ════════════════════════
  {
    head('บล็อก 2 · ข้อมูล · รอบวัน · ซ่อมข้อมูลเพี้ยน');
    const b = await boot(browser);
    await enterGame(b.page, 'dq_a');

    const a = await b.page.evaluate(() => baBattleAudit().daily);
    eq('รอบวันของวันนี้ตรงกับ qDayKey ของ v4.2',
       a.day, await b.page.evaluate(() => qDayKey()));
    eq('ตัวนับเริ่มจากศูนย์ทั้งสี่', a.c, { f20: 0, abyss: 0, mini: 0, dragon: 0 });
    eq('ยังไม่ได้รับรางวัลอะไรเลย', a.done, []);

    /* idempotent — เรียกซ้ำสิบรอบต้องไม่ทำให้อะไรขยับ */
    eq('baQdEnsure เรียกซ้ำแล้วค่าไม่ขยับ',
       await b.page.evaluate(() => {
         G.dq.c.mini = 7; G.dq.done = ['f20'];
         for (let i = 0; i < 10; i++) baQdEnsure(G);
         return { mini: G.dq.c.mini, done: G.dq.done.slice() };
       }), { mini: 7, done: ['f20'] });

    /* ข้อมูลเพี้ยนต้องถูกซ่อม ไม่ใช่ทำให้พัง */
    eq('ตัวนับติดลบ/ไม่ใช่ตัวเลข/เกินเป้า ถูกหนีบให้อยู่ในช่วง',
       await b.page.evaluate(() => {
         G.dq.c = { f20: -5, abyss: 'x', mini: 9999, dragon: 1.7 };
         baQdEnsure(G);
         return G.dq.c;
       }), { f20: 0, abyss: 0, mini: 50, dragon: 1 });

    eq('id ที่ไม่มีจริงกับ id ซ้ำ ถูกกวาดทิ้ง',
       await b.page.evaluate(() => {
         G.dq.done = ['f20', 'f20', 'ผี', 'all', 'mini'];
         baQdEnsure(G);
         return G.dq.done;
       }), ['f20', 'all', 'mini']);

    eq('รอบวันหมดอายุ = ล้างตัวนับและรางวัลที่รับไปแล้วทั้งชุด',
       await b.page.evaluate(() => {
         G.dq.c.mini = 33; G.dq.done = ['f20', 'mini'];
         G.dq.day = '2000-01-01';
         baQdEnsure(G);
         return { day: G.dq.day === qDayKey(), c: G.dq.c, done: G.dq.done };
       }), { day: true, c: { f20: 0, abyss: 0, mini: 0, dragon: 0 }, done: [] });

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 3 · เม็ด 💎 ในหอคอยปกติ ═══════════════════════════════════════
  {
    head('บล็อก 3 · เม็ด 💎 ในหอคอยปกติ');
    const b = await boot(browser);
    await enterGame(b.page, 'dq_b');

    await goFloor(b.page, 2, false);
    eq('อสูรธรรมดาไม่ให้ 💎 เลยสักเม็ด', (await slay(b.page, true)).got, 0);

    for (const f of [4, 8, 12, 16]) {
      await goFloor(b.page, f, false);
      eq('บอสประจำชั้น ' + f + ' ให้ 💎 +2', (await slay(b.page, true)).got, 2);
      await clearOverlays(b.page);
    }

    /* ชั้นบอสจริงของแผนผังหอคอยตั้งแต่ v6.4 คือ 4/8/12/16/20 */
    eq('ชั้นบอสยังเป็นชุดของ v6.4',
       await b.page.evaluate(() => [1,2,3,4,5,8,10,12,15,16,20].filter(f => isBossFloor(f))),
       [4, 8, 12, 16, 20]);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 4 · บอสยอดหอคอยสามเฟส + เคลียร์ ═══════════════════════════════
  {
    head('บล็อก 4 · บอสยอดหอคอยสามเฟส + เคลียร์');
    const b = await boot(browser);
    await enterGame(b.page, 'dq_c');
    await goFloor(b.page, 20, false);

    const ph = await b.page.evaluate(() => {
      const out = [];
      const max = G.monsterMaxHp;
      const step = f => { const s0 = abShards(G); G.monsterHp = Math.round(max * f); baQdPhaseCheck(); return abShards(G) - s0; };
      out.push(step(0.80));   /* ยังไม่ถึงเส้นแรก */
      out.push(step(0.60));   /* ข้ามเส้น 66% */
      out.push(step(0.50));   /* ยังอยู่ช่วงเดิม */
      out.push(step(0.30));   /* ข้ามเส้น 33% */
      out.push(step(0.10));   /* จ่ายครบแล้ว */
      return out;
    });
    eq('จ่ายเฉพาะตอนข้ามเส้น 66% และ 33% ครั้งเดียวต่อเฟส', ph, [0, 3, 0, 4, 0]);

    eq('ล้มบอสยอดหอคอยได้เฟสที่สาม +5 (ไม่ทับกับ +2 ของบอสทั่วไป)',
       await b.page.evaluate(() => {
         BA_QD_PF = true; BA_QD_PF_M = G.currentMonster;
         const s0 = abShards(G);
         const f0 = G.floor;
         onMonsterDefeated();     /* ชั้นบอส → เรียก clearFloor(true) ต่อข้างในเอง */
         return { got: abShards(G) - s0, was: f0 };
       }), { got: 8, was: 20 });   /* 5 (เฟสสุดท้าย) + 3 (เคลียร์ยอดหอคอย) */

    eq('เควส 🗼 กับ 🐲 ขยับพร้อมกัน',
       await b.page.evaluate(() => ({ f20: G.dq.c.f20, dragon: G.dq.c.dragon })),
       { f20: 1, dragon: 1 });

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 5 · ผู้บุกรุกทัพเงาในหอคอยปกติ ════════════════════════════════
  {
    head('บล็อก 5 · ผู้บุกรุกทัพเงาในหอคอยปกติ');
    const b = await boot(browser);
    await enterGame(b.page, 'dq_d');
    await goFloor(b.page, 3, false);

    /* บังคับให้ตัวที่ยืนอยู่เป็นผู้บุกรุก (ลูกเต๋า 15% ของ v6.6 ออกแล้ว) */
    const inc = await b.page.evaluate(() => {
      BA_INC_ID = BA_SH_MINI[0]; BA_INC_M = G.currentMonster; BA_INC_AT = 0; BA_INC_F = G.floor;
      return { on: baIncOn(), tier: (baShNow() || {}).tier };
    });
    eq('กำลังถูกบุกรุกอยู่จริง และเป็นทัพเงาระดับมินิบอส', inc, { on: true, tier: 'mini' });

    /* **Micro-Patch ULTIMATE ABYSS พลิกสามเคสนี้โดยตั้งใจ** — สเปกของชั้นนั้นสั่ง
       "High 💎 crystal drops" จึงบวก BA_AX_GEM ทับตารางของ Micro-Patch เควสประจำวัน
       ทุกครั้งที่ล้มทัพเงา · ยังอ่านจากค่าคงที่จริง ไม่ได้พิมพ์เลขทับ
       (precedent: v7.4 พลิกเคสของ test_gm_admin · v7.8 พลิกเคสของ test_menu_icons) */
    const axGem = await b.page.evaluate(() => (typeof BA_AX_GEM !== 'undefined' ? BA_AX_GEM : 0));

    eq('ปราบผู้บุกรุกแบบไร้ที่ติ = 4 + 1 + ' + axGem, (await slay(b.page, true)).got, 5 + axGem);
    eq('เควส 💀 มินิบอสขยับ 1', await b.page.evaluate(() => G.dq.c.mini), 1);

    await goFloor(b.page, 3, false);
    await b.page.evaluate(() => {
      BA_INC_ID = BA_SH_MINI[1]; BA_INC_M = G.currentMonster; BA_INC_AT = 0; BA_INC_F = G.floor;
    });
    eq('ปราบผู้บุกรุกแบบพลาดไปแล้ว = 4 + ' + axGem, (await slay(b.page, false)).got, 4 + axGem);

    /* ธงไร้ที่ติเป็นของ "ไฟต์ที่กำลังสู้อยู่" — ตอบผิดแล้วต้องตก */
    ok('ตอบผิดหนึ่งข้อแล้วธงไร้ที่ติตกทันที',
       await b.page.evaluate(() => {
         G.floor = 2; G.floorProgress = 0;
         BA_INC_F = 2; BA_INC_AT = -1; BA_INC_M = null;
         nextMonster(); G.locked = false;
         const m = G.currentMonster;
         const wrong = m.choices.filter(c => c !== m.answer)[0];
         G.questionStart = Date.now();
         resolveAnswer(wrong, null, false);
         return BA_QD_PF === false;
       }));

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6 · เม็ด 💎 ในโหมดเหวลึก ═══════════════════════════════════════
  {
    head('บล็อก 6 · เม็ด 💎 ในโหมดเหวลึก');
    const b = await boot(browser);
    await enterGame(b.page, 'dq_e');

    /* ทัพเงาที่โผล่ในเหวลึกเลือกจาก "ชั้น + m.id" ซึ่ง m.id มาจากคำที่สุ่มได้
       การไล่หาชั้นที่ลำดับที่ต้องการโผล่จึงไม่แน่นอน — ตารางระดับจึงพิสูจน์ด้วย
       การป้อนภาพนิ่งเข้า baQdSlay() ตรง ๆ (เป็นทางเดียวกับที่ wrapper ใช้จริง)
       แล้วมีเคสยิงผ่าน onMonsterDefeated จริงอีกหนึ่งเคสยืนยันการต่อสาย */
    await b.page.evaluate(() => { window.__rand = baRand; baRand = () => 99; });   /* ปิดหีบก่อน */

    for (const t of WANT_ABYSS) {
      const got = await b.page.evaluate(o => {
        const foe = BA_FOES_ABYSS.filter(x => x.n === o.n)[0];
        const s0 = abShards(G);
        baQdSlay({ floor: 5, boss: false, last: false, abyss: true, inc: false, foe: foe, perfect: false });
        const plain = abShards(G) - s0;
        const s1 = abShards(G);
        baQdSlay({ floor: 5, boss: false, last: false, abyss: true, inc: false, foe: foe, perfect: true });
        return { plain: plain, perfect: abShards(G) - s1 };
      }, { n: t.to });
      eq('ลำดับ ' + t.to + ' · สังหารธรรมดา / ไร้ที่ติ', got, { plain: t.k, perfect: t.k + t.p });
    }

    /* ขอบเขตของแต่ละระดับต้องคมพอดี ไม่เหลื่อมกัน */
    eq('เส้นแบ่งระดับคมพอดีที่ 10|11 และ 20|21 และ 24|25',
       await b.page.evaluate(() => [10, 11, 20, 21, 24, 25].map(n => {
         const foe = BA_FOES_ABYSS.filter(x => x.n === n)[0];
         const s0 = abShards(G);
         baQdSlay({ floor: 5, boss: false, last: false, abyss: true, inc: false, foe: foe, perfect: false });
         return abShards(G) - s0;
       })), [4, 6, 6, 8, 8, 15]);

    await b.page.evaluate(() => { baRand = () => 0; });   /* บังคับให้หีบออกเสมอ */
    eq('หีบสมบัติ 35% บวกตามระดับ',
       await b.page.evaluate(() => [10, 20, 24, 25].map(n => {
         const foe = BA_FOES_ABYSS.filter(x => x.n === n)[0];
         const s0 = abShards(G);
         baQdSlay({ floor: 5, boss: false, last: false, abyss: true, inc: false, foe: foe, perfect: false });
         return abShards(G) - s0;
       })), [4 + 3, 6 + 4, 8 + 5, 15 + 10]);

    ok('ไม่ได้แตะ Math.random สักครั้ง',
       await b.page.evaluate(() => {
         let n = 0; const _r = Math.random; Math.random = function () { n++; return _r(); };
         const foe = BA_FOES_ABYSS.filter(x => x.n === 3)[0];
         const s0 = abShards(G);
         baQdSlay({ floor: 5, boss: false, last: false, abyss: true, inc: false, foe: foe, perfect: true });
         Math.random = _r;
         return n === 0 && abShards(G) > s0;
       }));

    /* ยิงผ่านทางจริงหนึ่งเคส — เปิดเหวลึกแล้วล้มอสูรที่ยืนอยู่
       **ต้องปิดหีบสมบัติไว้ก่อน** ไม่งั้นยอดที่วัดได้จะบวกหีบมาแบบสุ่ม
       แล้วเคสจะตกเป็นครั้งคราวโดยที่โค้ดถูกทุกบรรทัด */
    await b.page.evaluate(() => { baRand = () => 99; });
    await goFloor(b.page, 3, true);
    const real = await b.page.evaluate(() => {
      const e = baShNow();
      if (!e) return { wired: false };
      const t = [10, 20, 24, 25].filter(x => e.n <= x)[0];
      /* Patch v8.3 เติม 💎 การันตีของเหวลึกเฉพาะกิจทับตารางเดิมอีกก้อน
         (+BA_OD_GEM · ไร้ที่ติได้ +BA_OD_GEM_PF อีก — ปิดธงไร้ที่ติของ v8.1 ให้นิ่งก่อนวัด) */
      const want = { 10: 4, 20: 6, 24: 8, 25: 15 }[t] +
                   (typeof BA_AX_GEM !== 'undefined' ? BA_AX_GEM : 0) +
                   (typeof BA_OD_GEM !== 'undefined' ? BA_OD_GEM : 0);
      G.locked = false; BA_QD_PF = false; BA_QD_PF_M = G.currentMonster;
      if (typeof BA_AX_MPF !== 'undefined') { BA_AX_MPF = false; BA_AX_MPF_M = G.currentMonster; }
      const s0 = abShards(G);
      onMonsterDefeated();
      return { wired: true, n: e.n, got: abShards(G) - s0, want: want, mini: G.dq.c.mini };
    });
    ok('เปิดเหวลึกแล้วล้มอสูรจริง ได้ 💎 ตามระดับของทัพเงาตัวนั้น',
       real.wired === true && real.got === real.want, real);
    ok('เควส 💀 มินิบอสขยับตามไปด้วย', real.mini >= 1, real);

    await b.page.evaluate(() => { baRand = window.__rand; });

    eq('จบรอบเหวลึก = +25 💎 และเควส 🕳️ ขยับ',
       await b.page.evaluate(() => {
         const bb = abOf(G); bb.abyss = true;
         G.dq.c.abyss = 0;
         G.floor = FLOOR_MAX; G.floorProgress = MONSTERS_PER_FLOOR - 1;
         const s0 = abShards(G);
         clearFloor(true);
         return { q: G.dq.c.abyss, gem: abShards(G) - s0 };
       }), { q: 1, gem: 25 });

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 7 · กระดานเควส · ปุ่มรับรางวัล · โบนัสเก็บครบ ═════════════════
  {
    head('บล็อก 7 · กระดานเควส · ปุ่มรับรางวัล · โบนัสเก็บครบ');
    const b = await boot(browser);
    await enterGame(b.page, 'dq_f');

    /* ชิป 💎 ของ v7.9 ต้องถูกเปลี่ยนปลายทางมาที่กระดานเควส */
    const chip = await b.page.evaluate(() => {
      const el = document.getElementById('baC7Gem');
      return { has: !!el, click: el ? el.getAttribute('onclick') : '' };
    });
    eq('ชิป 💎 ชี้มาที่กระดานเควสแล้ว', chip, { has: true, click: 'baQdOpen()' });

    await b.page.evaluate(() => document.getElementById('baC7Gem').click());
    await b.page.waitForTimeout(260);

    /* **ต้องพิสูจน์ว่ามองเห็นจริง ไม่ใช่แค่มี .active** (กับดักข้อ 25) */
    const vis = await b.page.evaluate(() => {
      const el = document.getElementById('baQdBoard');
      if (!el || !el.classList.contains('active')) return { active: false };
      const inner = el.querySelector('.g-modal-inner');
      const r = inner.getBoundingClientRect();
      let hit = 0, miss = 0;
      for (let x = 0.15; x <= 0.85; x += 0.175) {
        for (let y = 0.1; y <= 0.9; y += 0.16) {
          const n = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
          if (n && n.closest && n.closest('#baQdBoard')) hit++; else miss++;
        }
      }
      return { active: true, hit: hit, miss: miss, rows: el.querySelectorAll('.ba-qd-q').length };
    });
    ok('แผงเปิดแล้วมองเห็นจริงทุกจุดที่สุ่มวัด', vis.active === true && vis.miss === 0, vis);
    eq('มีการ์ดเควส 5 ใบ (4 เควส + โบนัสเก็บครบ)', vis.rows, 5);

    /* ปุ่มต้องกดไม่ได้ตอนยังทำไม่ครบ */
    eq('ยังทำไม่ครบ = ปุ่มรับรางวัลถูก disabled ทุกใบ',
       await b.page.evaluate(() => [].filter.call(
         document.querySelectorAll('#baQdBody .ba-qd-btn'), x => !x.disabled).length), 0);

    eq('กดรับรางวัลที่ยังไม่ครบแล้วต้องไม่มีอะไรเกิดขึ้น',
       await b.page.evaluate(() => {
         const s0 = abShards(G);
         baQdClaim('mini');
         return { gem: abShards(G) - s0, done: G.dq.done.length };
       }), { gem: 0, done: 0 });

    /* ทำครบทั้งสี่แล้วกดรับทีละใบ */
    const claim = await b.page.evaluate(() => {
      G.dq.c = { f20: 1, abyss: 5, mini: 50, dragon: 1 };
      G.dq.done = [];
      baQdRender();
      const out = { each: [], gems: 0 };
      const s0 = abShards(G);
      ['f20', 'abyss', 'mini', 'dragon'].forEach(id => {
        const before = abShards(G);
        baQdClaim(id);
        out.each.push(abShards(G) - before);
      });
      out.allRdyBefore = baQdAllOk();
      const beforeAll = abShards(G);
      baQdClaim('all');
      out.all = abShards(G) - beforeAll;
      out.gems = abShards(G) - s0;
      out.done = G.dq.done.slice();
      return out;
    });
    eq('รับรางวัลรายเควสได้ตามตาราง', claim.each, [20, 50, 30, 20]);
    ok('ครบสี่แล้วโบนัสเก็บครบพร้อมรับ', claim.allRdyBefore === true);
    eq('โบนัสเก็บครบจ่าย 50', claim.all, 50);
    eq('รวมทั้งวันได้ 170 💎', claim.gems, 170);
    eq('บันทึกว่ารับไปแล้วครบทั้งห้า', claim.done, ['f20', 'abyss', 'mini', 'dragon', 'all']);

    eq('กดรับซ้ำใบเดิมแล้วไม่ได้อะไรเพิ่ม',
       await b.page.evaluate(() => {
         const s0 = abShards(G);
         ['f20', 'abyss', 'mini', 'dragon', 'all'].forEach(id => baQdClaim(id));
         return abShards(G) - s0;
       }), 0);

    /* ความคืบหน้าต้องรอดข้ามการล็อกอิน (กับดักข้อ 16) */
    await b.page.evaluate(() => { G.dq.c.mini = 17; G.dq.done = ['f20']; baQdSave(); exitGame(); });
    await b.page.waitForTimeout(600);
    await b.page.evaluate(() => { enterGate(); });
    await b.page.waitForTimeout(700);
    await b.page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'dq_f';
      document.getElementById('login-pw').value = '1111';
      handleSubmit();
    });
    await b.page.waitForTimeout(1500);
    await clearOverlays(b.page);
    eq('ความคืบหน้าเควสรอดข้ามการล็อกอิน',
       await b.page.evaluate(() => ({ mini: G.dq.c.mini, done: G.dq.done.slice() })),
       { mini: 17, done: ['f20'] });

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 8 · เลย์เอาต์ไม่ขยับ ═══════════════════════════════════════════
  {
    head('บล็อก 8 · เลย์เอาต์ไม่ขยับ');
    for (const w of [320, 360, 390, 430]) {
      const b = await boot(browser, w, w === 320 ? 568 : 844);
      await enterGame(b.page, 'dq_g' + w);

      /* บังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนวัดเสมอ
         (บทเรียนเดิมของชุด v7.2/v7.4/v7.5/v7.8) */
      const h = await b.page.evaluate(() => {
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        document.getElementById('gFeedback').textContent = '';
        G.currentMonster.choices = ['หนึ่ง', 'สอง', 'สาม', 'สี่'];
        G.currentMonster.answer = 'หนึ่ง';
        renderChoices();
        const c = document.querySelector('.ac-battle');
        return c ? Math.round(c.getBoundingClientRect().height * 10) / 10 : 0;
      });
      eq('จอ ' + w + ' · การ์ดโจทย์สูงเท่าเดิม', h, w === 320 ? 354.8 : 340.8);

      eq('จอ ' + w + ' · ไม่ล้นแนวนอน',
         await b.page.evaluate(() => document.body.scrollWidth <= window.innerWidth), true);

      /* เปิดแผงเควสแล้วปิด — เลย์เอาต์ต้องกลับมาเท่าเดิมเป๊ะ */
      await b.page.evaluate(() => baQdOpen());
      await b.page.waitForTimeout(200);
      const wide = await b.page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
      await b.page.evaluate(() => baQdClose());
      await b.page.waitForTimeout(200);
      const h2 = await b.page.evaluate(() => {
        const c = document.querySelector('.ac-battle');
        return c ? Math.round(c.getBoundingClientRect().height * 10) / 10 : 0;
      });
      ok('จอ ' + w + ' · เปิดแผงเควสแล้วไม่ล้นแนวนอน', wide === true);
      eq('จอ ' + w + ' · ปิดแผงแล้วการ์ดโจทย์สูงเท่าเดิม', h2, h);

      ok('จอ ' + w + ' · ไม่มี pageerror', b.errs.length === 0, b.errs);
      await b.ctx.close();
    }
  }

  say('\n══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════');
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
