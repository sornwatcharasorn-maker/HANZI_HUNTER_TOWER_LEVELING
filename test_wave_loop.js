/* ชุดเทสต์ Patch v8.2 — MASTER SEQUENTIAL COMBAT LOOP · NIGHTMARE REBALANCE
   SEQUENTIAL ABYSS PROGRESSION · FLOOR 20 APEX GATE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_wave_loop.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
       ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง)
     · เข้าเกมด้วยเส้นทางจริงเสมอ — ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7
     · ปลดล็อกแรงค์ก่อนเทสต์ไอเทม/สกิล (G.maxFloor = FLOOR_MAX; recalcStats())
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น ยกเว้นบล็อกที่ตั้งใจวัด Wave 4
     · อ่าน hunterAtk / G.maxHp สดทุกเคส ห้ามแคชไว้ต้นไฟล์ (กับดักข้อ 20)
     · วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนเสมอ    */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'test_wave_loop.log');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }
function near(name, got, want, tol) { ok(name, Math.abs(got - want) <= tol, { got: got, want: want, tol: tol }); }

async function boot(browser, w, h) {
  const ctx  = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
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

/* ปิดทุกหน้าต่างที่คั่นอยู่ — รวมประตูกรองของแพตช์นี้ด้วย ไม่งั้นเกมจะค้าง
   ในสถานะหยุดของ v4.8.1 แล้วทุกเคสหลังจากนั้นจะตกด้วยเหตุผลผิด */
async function clearOverlays(page) {
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
      if (typeof snGateConfirm === 'function' && document.querySelector('.sn-gate.active')) { snGateConfirm(); return 'gate'; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { warpGo(); return 'warp'; }
      if (document.querySelector('#baWvGate.active')) { baWvGateGo(); return 'apex'; }
      return '';
    });
    if (!busy) break;
    await page.waitForTimeout(740);
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

/* ย้ายชั้นแบบไม่ให้ลูกเต๋าบุกรุกของ v6.6 มาแทรก (กติกาเดิมของชุด v6.2-v6.8)
   · inc = true คือ "ปล่อยให้ Wave 4 ของ v8.2 บังคับรอยแยกตามปกติ" */
async function goFloor(page, f, prog, inc) {
  await page.evaluate(a => {
    G.floor = a.f;
    G.maxFloor = Math.max(G.maxFloor || 1, a.f);
    G.floorProgress = a.p || 0;
    if (typeof CD_BAND !== 'undefined') CD_BAND = cdBandOf(a.f);
    if (!a.inc && typeof BA_INC_F !== 'undefined') { BA_INC_F = a.f; BA_INC_AT = -1; BA_INC_M = null; }
    G.locked = false;
    recalcStats();
    nextMonster();
  }, { f: f, p: prog || 0, inc: !!inc });
  await page.waitForTimeout(280);
  await clearOverlays(page);
  await page.evaluate(() => { G.locked = false; });
}

const audit = page => page.evaluate(() => baBattleAudit());

(async () => {
  fs.writeFileSync(LOG, '=== test_wave_loop · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ติดตั้ง · ตารางเวฟ · ทางเข้าสาธารณะ ═══════════════════════
  {
    head('บล็อก 1 · ติดตั้ง · ตารางเวฟ · ทางเข้าสาธารณะ');
    const b = await boot(browser);
    const a = await b.page.evaluate(() => baBattleAudit());
    ok('baBattleAudit().wave มีอยู่จริง', !!a.wave);
    eq('รุ่นของแพตช์', a.wave.ver, '8.2');
    ok('มีก้อน rift · superBoss · apex ครบ', !!a.rift && !!a.superBoss && !!a.apex);
    ok('สไตล์ถูกฝังตั้งแต่โหลดหน้า', a.apex.styled === true);
    eq('หนึ่งแบนด์ = 4 ชั้น (อ่านจาก BA_BAND ของ v6.1)', a.wave.size, 4);
    eq('ตัวสุดท้ายของชั้นคือลำดับที่ 3', a.wave.last, 3);

    /* ตารางเวฟทั้ง 20 ชั้น — เขียนคำตอบไว้ฝั่งเทสต์เอง ไม่ได้อ่านจากเกมมาเทียบกับเกม */
    const waves = await b.page.evaluate(() => {
      const out = [];
      for (let f = 1; f <= FLOOR_MAX; f++) {
        out.push([baWvOf({ floor: f, floorProgress: 0 }), baWvOf({ floor: f, floorProgress: 3 })]);
      }
      return out;
    });
    const want = [];
    for (let f = 1; f <= 20; f++) {
      const w = ((f - 1) % 4) + 1;
      const boss = (f % 4 === 0);
      const pre  = ((f + 1) % 4 === 0) && f < 20;
      want.push([boss ? 5 : Math.min(3, w), boss ? 5 : (pre ? 4 : Math.min(3, w))]);
    }
    eq('ตารางเวฟครบ 20 ชั้น (ตัวแรกของชั้น / ตัวสุดท้ายของชั้น)', waves, want);

    const prac = await b.page.evaluate(() => baWvOf({ floor: 3, floorProgress: 3, practiceMode: true }));
    eq('โหมดฝึกจุดอ่อนอยู่นอกลูปเวฟทั้งหมด', prac, 0);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 2 · Wave 1-3 · Nightmare Scaling ══════════════════════════════
  {
    head('บล็อก 2 · Wave 1-3 · HP · เกราะ · Speed Window');
    const b = await boot(browser);
    await enterGame(b.page, 'wv2');

    /* ตัวคูณ HP ต้องคิดจากสูตรของ v4.0 คูณตารางของแบนด์ — อ่าน hunterAtk สดทุกชั้น */
    for (const f of [2, 6, 10, 14, 18]) {
      await goFloor(b.page, f);
      const s = await b.page.evaluate(fl => {
        const w = baBattleAudit().wave;
        return { raw: hitsForFloor(fl, false) * hunterAtk(), max: G.monsterMaxHp,
                 k: w.hp, arm: w.arm.max, armPct: w.armPct, on: w.arm.on, w: w.w };
      }, f);
      ok('ชั้น ' + f + ' อยู่ใน Wave 1-3 [' + s.w + ']', s.w >= 1 && s.w <= 3);
      near('ชั้น ' + f + ' HP = สูตรเดิม x' + s.k + ' + เกราะ ' + Math.round(s.armPct * 100) + '%',
           s.max, Math.round(s.raw * s.k) + s.arm, 2);
      near('ชั้น ' + f + ' เกราะ = ' + Math.round(s.armPct * 100) + '% ของ HP หลังคูณ',
           s.arm, Math.round(Math.round(s.raw * s.k) * s.armPct), 2);
      ok('ชั้น ' + f + ' บัญชีเกราะติดตั้งจริง', s.on === true);
    }

    /* ตอบไวกว่าหน้าต่างของแบนด์ = เจาะเกราะที่เหลือทิ้งทันที
       **ต้องวัดในโซน 4-5** เพราะเกราะของโซน 1 คิดเป็น 15% ของเลือดที่บางมาก
       (3 หมัด) หมัดเดียวก็ทะลุหมดแล้ว จึงไม่เหลืออะไรให้เจาะและวัดไม่ได้ */
    await goFloor(b.page, 18);
    const pierce = await b.page.evaluate(() => {
      const w0 = baBattleAudit().wave;
      const m = G.currentMonster;
      G.questionStart = Date.now();      /* ตอบทันที = ไวกว่าหน้าต่างแน่นอน */
      G.locked = false;
      const n0 = baBattleAudit().wave.n.pierce;
      resolveAnswer(m.answer, null, false);
      const w1 = baBattleAudit().wave;
      return { before: w0.arm.left, after: w1.arm.left, n0: n0, n1: w1.n.pierce, hp: G.monsterHp };
    });
    ok('ก่อนเจาะมีเกราะเหลืออยู่จริง [' + pierce.before + ']', pierce.before > 0);
    eq('ตอบไวแล้วเกราะถูกเจาะจนหมด', pierce.after, 0);
    eq('ตัวนับการเจาะเกราะเดินหน้า', pierce.n1, pierce.n0 + 1);
    ok('มอนสเตอร์ยังไม่ตายจากการเจาะ (ไม่ต้องสั่งคิวเทิร์นเพิ่ม)', pierce.hp > 0);

    /* ตอบช้ากว่าหน้าต่าง = เกราะยังอยู่ */
    await goFloor(b.page, 18);
    const slow = await b.page.evaluate(() => {
      const m = G.currentMonster;
      G.questionStart = Date.now() - (baBattleAudit().wave.speed + 900);
      G.locked = false;
      resolveAnswer(m.answer, null, false);
      return baBattleAudit().wave.arm.left;
    });
    ok('ตอบช้ากว่าหน้าต่างแล้วเกราะยังเหลืออยู่ [' + slow + ']', slow > 0);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 3 · Wave 1-3 · รางวัล x1.5 · สลับทิศทาง · ตัวลวงใกล้เคียง ═════
  {
    head('บล็อก 3 · รางวัล x1.5 · ทิศทางโจทย์ · พินอิน');
    const b = await boot(browser);
    await enterGame(b.page, 'wv3');
    await goFloor(b.page, 2);

    /* วัดจากส่วนต่างจริงคร่อม resolveAnswer แล้วเทียบว่าเกินยอดฐาน 50% พอดี
       ต้องปิดสุ่มคริต/EXP คู่ก่อน ไม่งั้นยอดฐานแกว่งจนเทียบไม่ได้ */
    const rw = await b.page.evaluate(() => {
      critChance = () => 0; expDoubleChance = () => 0;
      const out = [];
      for (let i = 0; i < 2; i++) {
        const g0 = { gold: G.gold, exp: G.exp, lv: G.level, tg: G.totalGoldEarned || 0 };
        const m = G.currentMonster;
        G.questionStart = Date.now() - 5000;   /* ช้าพอที่จะไม่เจาะเกราะ */
        G.locked = false;
        const n0 = baBattleAudit().wave.n.rw;
        resolveAnswer(m.answer, null, false);
        out.push({ dg: G.gold - g0.gold, dtg: (G.totalGoldEarned || 0) - g0.tg,
                   rw: baBattleAudit().wave.n.rw - n0 });
        G.monsterHp = G.monsterMaxHp;
      }
      return out;
    });
    ok('รางวัลถูกบวกจริงทุกข้อ', rw.every(r => r.rw === 1), rw);
    ok('ทองที่ได้เป็น 1.5 เท่าของยอดฐาน (ยอดฐาน = dg / 1.5)',
       rw.every(r => r.dg > 0 && Math.abs(r.dg / (r.dg / 1.5) - 1.5) < 0.001), rw);
    ok('ทองโบนัสบวกเข้ายอดสะสมตลอดชีพด้วย', rw.every(r => r.dtg === r.dg), rw);

    /* Patch v8.4 · คืนพินอินกับตัวลวงมาตรฐานให้ชั้นมอนสเตอร์ทั่วไป (F1-F19)
       — เคสชุดนี้ถูกพลิกจากของ v8.2 โดยตั้งใจ (precedent: v7.4 · v7.8 · v8.1 · v8.2) */
    await goFloor(b.page, 18);
    const near5 = await b.page.evaluate(() => {
      const w = baBattleAudit().wave, sf = baBattleAudit().softening;
      return { near: w.near, np: w.noPinyin, n: w.n.near, sf: sf,
               hidden: !!(baScreen() && baScreen().classList.contains('ba-wv-np')),
               vis: getComputedStyle(document.getElementById('gPinyin')).visibility,
               h: document.getElementById('gPinyin').getBoundingClientRect().height };
    });
    ok('โซน 4-5 เลิกใช้ตัวลวงใกล้เคียงสูงแล้ว', near5.near === false && near5.sf.near === false, near5);
    ok('โซน 4-5 เห็นพินอินเต็ม ๆ', near5.np === false && near5.hidden === false, near5);
    eq('พินอินมองเห็นได้จริง', near5.vis, 'visible');
    ok('กล่องพินอินยังคงความสูงไว้ (เลย์เอาต์ไม่ขยับ) [' + near5.h + ']', near5.h > 0);
    ok('ไม่มีการสร้างตัวลวงใกล้เคียงสูงสักข้อ', near5.n === 0, near5);
    ok('audit รายงานว่าพินอินถูกคืนแล้ว', near5.sf.pinyin === true, near5.sf);

    /* Patch v8.4 · สลับทิศทาง ไทย➔จีน ถูกปิดทั้งชุด เพราะโหมดนั้นบังคับซ่อนพินอินเสมอ
       (ไม่งั้นพินอินของคำตอบจะเฉลยให้ทันที) ซึ่งขัดกับข้อกำหนด "พินอินเห็นเต็มทุกชั้นทั่วไป"
       — บังคับทอยให้ต่ำสุดแล้วก็ยังต้องไม่สลับ */
    await goFloor(b.page, 6);
    const flip = await b.page.evaluate(() => {
      const _r = baRand;
      baRand = () => 0;                       /* ทอยได้ 0 = ต่ำกว่าโอกาส 50% เสมอ */
      G.floorProgress = 0; G.locked = false;
      nextMonster();
      const w = baBattleAudit().wave;
      const m = G.currentMonster;
      const shown = document.getElementById('gWord').textContent;
      const span = !!document.querySelector('#gWord .ba-wv-th');
      const noDup = new Set(m.choices).size === m.choices.length;
      baRand = _r;
      return { flipped: w.flipped, flipP: w.flipP, shown: shown, word: m.word, span: span,
               noDup: noDup, ans: m.answer, sf: baBattleAudit().softening.flip,
               hidden: !!(baScreen() && baScreen().classList.contains('ba-wv-np')) };
    });
    ok('โอกาสสลับทิศทางถูกปิดทุกโซน', flip.flipP === 0 && flip.sf === false, flip);
    ok('บังคับทอยต่ำสุดแล้วก็ยังไม่สลับ', flip.flipped === false, flip);
    ok('ตัวเลือกไม่ซ้ำกันเลย (กับดักข้อ 7)', flip.noDup === true);
    eq('สิ่งที่อยู่บนจอยังเท่ากับ m.word เป๊ะ (กติกาของ v6.8)', flip.shown, flip.word);
    ok('ไม่มี span ภาษาไทยของ v8.2 หลงเหลืออยู่', flip.span === false);
    ok('พินอินไม่ถูกซ่อนในชั้นมอนสเตอร์ทั่วไป', flip.hidden === false, flip);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 4 · Wave 4 · รอยแยกไต่ระดับอิสระ 1 → 25 ═══════════════════════
  {
    head('บล็อก 4 · Wave 4 · Decoupled Abyss Progression');
    const b = await boot(browser);
    await enterGame(b.page, 'wv4');

    const init = await b.page.evaluate(() => ({ idx: G.abyss_incursion_idx, a: baBattleAudit().rift }));
    eq('บัญชีใหม่เริ่มที่ทัพเงาลำดับที่ 1', init.idx, 1);
    eq('เพดานคือ 25 ตัว', init.a.max, 25);

    /* ชั้นก่อนประตูบอสต้องบังคับรอยแยกที่ตัวสุดท้ายของชั้นเสมอ */
    const forced = await b.page.evaluate(() => {
      const out = [];
      for (const f of [3, 7, 11, 15, 19]) {
        baIncRoll(f);
        out.push([BA_INC_AT, BA_INC_ID]);
      }
      const idx = G.abyss_incursion_idx;
      const want = BA_FOES_ABYSS[idx - 1].id;
      return { out: out, want: want, last: baBattleAudit().wave.last };
    });
    ok('รอยแยกโผล่ที่ตัวสุดท้ายของชั้นทุกบานประตู',
       forced.out.every(r => r[0] === forced.last), forced.out);
    ok('ทัพเงาที่โผล่คือลำดับที่ abyss_incursion_idx เสมอ (ไม่ผูกกับชั้น)',
       forced.out.every(r => r[1] === forced.want), forced);

    /* ยืนหน้ารอยแยกจริง แล้ววัดสเกล 75% */
    await goFloor(b.page, 3, 3, true);
    const rift = await b.page.evaluate(() => {
      const a = baBattleAudit();
      return { w: a.wave.w, w4: a.wave.w4, sh: !!baShNow(), ratio: a.rift.ratio,
               cur: a.rift.curMs, dd: a.rift.ddMs, id: (baShNow() || {}).id };
    });
    eq('ตัวสุดท้ายของชั้น 3 คือ Wave 4', rift.w, 4);
    ok('มีทัพเงายืนอยู่ตรงหน้าจริง', rift.w4 === true && rift.sh === true, rift);
    eq('ทัพเงาที่โผล่ตรงกับลำดับปัจจุบัน', rift.id, forced.want);
    eq('Master Ratio ของรอยแยก = 75%', rift.ratio, 0.75);
    eq('หลอดคำสาปของรอยแยก = 8.0 วิ', rift.cur, 8000);
    eq('Doomsday ของรอยแยก = 10.0 วิ', rift.dd, 10000);

    /* HP ของรอยแยก = 75% ของบอสหอคอยชั้นเดียวกัน */
    /* **เนื้อบอสอ่านจาก BA_BAR.base ไม่ใช่ AB_SEAL.base** — ชั้นก่อนประตูบอส
       ไม่มีเกราะผนึกของ v4.6 (ผนึกตั้งเฉพาะชั้นบอสจริง) AB_SEAL.base จึงเป็น 0
       ส่วน BA_BAR.base คือเส้นฐานใต้เกราะ = เนื้อบอสพอดี

       **ตัวหารต้องเป็น "ยอดที่เครื่องยนต์บอสจะให้มอนสเตอร์ตัวเดียวกันนี้"**
       ไม่ใช่ยอดของบอสประจำชั้น — ชั้นก่อนประตูบอย (3/7/11/15/19) เป็นชั้นอีลีท
       ของ v6.4 อยู่แล้ว ตัวคูณ BA_ELITE_HP จึงอยู่ในสายด้วย และมอนสเตอร์ที่รอยแยก
       สวมทับใช้สูตร "ไม่ใช่บอส" ของ v4.0 เป็นฐาน · สายที่วิ่งจริงคือ
         v4.0 (ไม่ใช่บอส) → v6.4 อีลีท x1.8 → v8.2 x1.5 → v8.1 x0.5 → v6.7 x2.5
       ซึ่งยุบเหลือ "ฐาน x BA_RS_HP x 0.75" พอดีตามสเปก 75% Master Ratio */
    const scale = await b.page.evaluate(() => {
      const body  = (typeof BA_BAR !== 'undefined' && BA_BAR) ? BA_BAR.base : 0;
      const elite = (typeof BA_ELITE_HP === 'number') ? BA_ELITE_HP : 1;
      const raw   = hitsForFloor(G.floor, false) * hunterAtk() * elite;
      return { body: body, engine: raw * BA_RS_HP, elite: elite,
               step: BA_WV_AX_R / BA_AX_R };
    });
    near('เนื้อบอสของรอยแยก = 75% ของยอดที่เครื่องยนต์บอสให้ตัวเดียวกัน',
         scale.body / (scale.engine || 1), 0.75, 0.03);
    near('อัตราส่วนที่แพตช์นี้ยกจากฐาน 50% ของ v8.1 คือ 1.5 เท่าพอดี', scale.step, 1.5, 0.0001);

    /* ปราบแล้วดัชนีต้องเดินหน้าหนึ่ง และ Soul Codex ต้องถูกจด */
    const won = await b.page.evaluate(async () => {
      const before = G.abyss_incursion_idx;
      const soul0 = (baAxMine() || {}).soul | 0;
      G.monsterHp = 1; G.locked = false;
      const m = G.currentMonster;
      critChance = () => 0;
      resolveAnswer(m.answer, null, false);
      await new Promise(r => setTimeout(r, 1500));
      return { before: before, after: G.abyss_incursion_idx,
               soul0: soul0, soul1: (baAxMine() || {}).soul | 0,
               n: baBattleAudit().wave.n.rift };
    });
    eq('ปราบรอยแยกแล้วดัชนีเดินหน้าหนึ่งลำดับ', won.after, won.before + 1);
    ok('บิต Soul Codex ของลำดับที่ปราบถูกจดไว้',
       (won.soul1 & (1 << (won.before - 1))) !== 0, won);
    ok('ตัวนับรอยแยกเดินหน้า', won.n >= 1);

    /* แพ้แล้วต้องคงค่าเดิม ไม่ลดทอน */
    const lost = await b.page.evaluate(() => {
      const before = G.abyss_incursion_idx;
      onHunterDown();
      return { before: before, after: G.abyss_incursion_idx };
    });
    eq('ตกรอบแล้วดัชนีคงค่าเดิม ไม่ลดทอน', lost.after, lost.before);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 5 · Wave 5 · Super-Boss Tier ══════════════════════════════════
  {
    head('บล็อก 5 · Wave 5 · เกราะ · เวลา · สตัน · บทลงโทษ');
    const b = await boot(browser);
    await enterGame(b.page, 'wv5');

    /* เกราะเริ่มต้นไล่ระดับ 50% → 65% ตามบานประตูบอส */
    const bars = [];
    for (const f of [4, 8, 12, 16, 20]) {
      await goFloor(b.page, f);
      bars.push(await b.page.evaluate(() => ({
        f: G.floor, want: baBattleAudit().superBoss.bar,
        got: BA_BAR && BA_BAR.base ? BA_BAR.max / BA_BAR.base : 0,
        w5: baBattleAudit().wave.w5
      })));
    }
    eq('ทุกชั้นบอสถูกนับเป็น Wave 5', bars.map(r => r.w5), [true, true, true, true, true]);
    eq('บันไดเกราะเริ่มต้นไล่จาก 50% ถึง 65%',
       bars.map(r => +r.want.toFixed(4)), [0.5, 0.5375, 0.575, 0.6125, 0.65]);
    ok('เกราะที่ตั้งจริงตรงกับบันได', bars.every(r => Math.abs(r.got - r.want) < 0.012), bars);

    /* Patch v8.4 · ตัดเวลาได้ไม่เกิน 1.0 วิ และตรึงพื้นไว้ที่ 5.0 วิ */
    await goFloor(b.page, 12);
    const ms = await b.page.evaluate(() => {
      const boss = questionMs();
      G.floor = 11; const normal = questionMs(); G.floor = 12;
      return { boss: boss, normal: normal, cut: baBattleAudit().superBoss.cut,
               min: baBattleAudit().superBoss.min };
    });
    ok('ห้องบอสเวลาน้อยกว่าชั้นธรรมดาอย่างน้อยเท่าที่ตัด',
       ms.normal - ms.boss >= ms.cut - 1 || ms.boss === ms.min, ms);
    ok('เวลาต่อข้อในห้องบอสไม่ต่ำกว่าพื้นที่ตรึงไว้', ms.boss >= ms.min, ms);
    eq('เพดานการตัดเวลาถูกผ่อนเหลือ 1.0 วิ', ms.cut, 1000);
    eq('พื้นเวลาต่ำสุดถูกยกเป็น 5.0 วิ', ms.min, 5000);
    ok('หน้าต่างคิดคำตอบจริงยังกว้างกว่าพื้นเสมอ [' + ms.boss + ']', ms.boss >= 5000, ms);

    /* ภูมิคุ้มกันสตัน 100% */
    const stun = await b.page.evaluate(() => {
      BA_BREAK_UNTIL = Date.now() + 5000;
      BA_ST_UNTIL    = Date.now() + 5000;
      const r = { stunned: baStunned(), st: baStOn(), immune: baBattleAudit().superBoss.stunImmune };
      BA_BREAK_UNTIL = 0; BA_ST_UNTIL = 0;
      return r;
    });
    ok('ตั้งเวลาสตันไว้แล้วบอสยังไม่ชะงัก (Armor Break)', stun.stunned === false, stun);
    ok('ตั้งเวลาสตันไว้แล้วบอสยังไม่ชะงัก (Stagger ของ v7.0)', stun.st === false, stun);
    ok('audit รายงานว่าอยู่ในสถานะภูมิคุ้มกัน', stun.immune === true);

    /* Patch v8.4 · แบนเนอร์ประกาศ Wave 5 ต้องบอกเวลาที่ตัดจริง (1.0 วิ) */
    await goFloor(b.page, 16);
    const ann = await b.page.evaluate(() => ({
      t: (document.getElementById('baSkill') || {}).textContent || '',
      cut: baBattleAudit().superBoss.cut, min: baBattleAudit().superBoss.min
    }));
    ok('แบนเนอร์บอกเวลาที่ตัดตรงกับค่าที่ทำงานจริง',
       /WAVE 5\/5/.test(ann.t) && /-1\.0 วิ/.test(ann.t) && /5\.0 วิ/.test(ann.t), ann);
    ok('ไม่มีเลขชุดเก่า (2.5 วิ) หลงเหลืออยู่บนแบนเนอร์', !/2\.5 วิ/.test(ann.t), ann);

    /* บทลงโทษสมบูรณ์แบบ */
    await goFloor(b.page, 12);
    const pen = await b.page.evaluate(() => {
      G.hp = G.maxHp; G.shield = 0; G.streak = 5;
      if (typeof ba_crit !== 'undefined') ba_crit = 80;
      G.monsterHp = Math.round(G.monsterMaxHp * 0.35);
      renderMonsterHp();
      const hp0 = G.hp, mhp0 = G.monsterHp;
      const m = G.currentMonster;
      const wrong = m.choices.filter(c => c !== m.answer)[0];
      G.locked = false;
      resolveAnswer(wrong, null, false);
      const sf = baBattleAudit().softening;
      const bar = (typeof BA_BAR !== 'undefined' && BA_BAR) ? BA_BAR : null;
      return { full: G.monsterHp === G.monsterMaxHp, mhp0: mhp0, mhp1: G.monsterHp,
               heal: sf.heal, barPct: sf.bar, last: sf.last, healN: sf.n.heal,
               broken: bar ? bar.broken : null,
               streak: G.streak, crit: (typeof ba_crit !== 'undefined') ? ba_crit : -1,
               lock: baBattleAudit().superBoss.skillLocked,
               lostHp: hp0 - G.hp, pen: baBattleAudit().superBoss.penHp,
               n: baBattleAudit().wave.n.pen };
    });
    ok('บอสไม่ฟื้นเต็มหลอดอีกแล้ว (v8.4)', pen.full === false, pen);
    ok('บอสยังฟื้นขึ้นจริงจากยอดก่อนหน้า', pen.mhp1 > pen.mhp0, pen);
    eq('ผ่อนเป็นฟื้น 30% ของหลอด', pen.heal, 0.30);
    eq('กู้เกราะคืน 50% ของความจุ', pen.barPct, 0.50);
    ok('ยอดที่ฟื้นตรงกับสูตร max(HP ก่อนหน้า + 30% ของหลอด, พื้นเกราะ 50%)',
       !!pen.last && pen.last.to ===
         Math.min(pen.last.max, Math.max(pen.last.from + Math.round(pen.last.max * pen.heal),
                                         pen.last.bar)), pen);
    ok('เกราะที่กู้คืนมาแล้วถูกปลดธง broken ให้ด้วย', pen.broken === false, pen);
    ok('ตัวนับการฟื้นแบบผ่อนแล้วเดินหน้า', pen.healN >= 1, pen);
    eq('คอมโบคูณดาเมจถูกรีเซ็ตเป็น 0', pen.streak, 0);
    eq('เกจคริตของ v6.3 ถูกรีเซ็ตเป็น 0', pen.crit, 0);
    ok('สกิลถูกผนึกหนึ่งข้อ', pen.lock === true);
    ok('เสีย HP มากกว่าดาเมจปกติ (มีค่าปรับซ้อนเข้ามา) [' + pen.lostHp + ' ≥ ' + pen.pen + ']',
       pen.lostHp >= pen.pen, pen);
    ok('ตัวนับบทลงโทษเดินหน้า', pen.n >= 1);

    /* สกิลที่ถูกผนึกต้องกดไม่ติด แล้วปลดเองตอนขึ้นข้อใหม่ */
    const lock = await b.page.evaluate(() => {
      G.mp = maxMpOf(G); G.skillCd = {};
      const mp0 = G.mp;
      useSkill('eye');
      const blocked = G.mp === mp0;
      startQuestionTimer();
      const after = baBattleAudit().superBoss.skillLocked;
      return { blocked: blocked, after: after };
    });
    ok('ระหว่างถูกผนึก ร่ายสกิลไม่ติด (MP ไม่ถูกหัก)', lock.blocked === true, lock);
    ok('ขึ้นข้อใหม่แล้วผนึกถูกปลดเอง', lock.after === false);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6 · Floor 20 Apex Gate ════════════════════════════════════════
  {
    head('บล็อก 6 · ประตูกรอง · Doom Counter · จำกัดยา · ภาษีเวลา');
    const b = await boot(browser);
    await enterGame(b.page, 'wv6');

    /* ยังไม่มีข้อสะสมพอ ประตูต้องเงียบ (ไม่ตัดสินจากความว่างเปล่า) */
    await goFloor(b.page, 20);
    const quiet = await b.page.evaluate(() => baBattleAudit().apex);
    ok('ข้อสะสมยังไม่ถึงขั้นต่ำ ประตูจึงไม่เด้ง', quiet.open === false && quiet.ready === false, quiet);

    /* แม่นยำต่ำกว่าเกณฑ์ → ล็อกปุ่มเข้า เหลือแต่ปุ่มส่งกลับ */
    await b.page.evaluate(() => { G.correct = 50; G.wrong = 50; });
    await goFloor(b.page, 20);
    /* clearOverlays ของตัวช่วยกดผ่านประตูไปแล้วเพื่อไม่ให้เกมค้าง — ล้างตราแล้ว
       เรียกตัวตรวจของจริงอีกครั้ง เพื่อพิสูจน์ว่ามันเปิดประตูเองได้จริง */
    await b.page.evaluate(() => { BA_WV_GATE = -1; baWvGateCheck(); });
    await b.page.waitForTimeout(240);
    const low = await b.page.evaluate(() => {
      const a = baBattleAudit().apex;
      const box = document.getElementById('baWvGate');
      const btns = [].slice.call(box.querySelectorAll('button'));
      /* พิสูจน์ว่า "มองเห็นจริง" ด้วย elementFromPoint เป็นกริดทั่วกรอบ (กับดักข้อ 25) */
      const inner = box.querySelector('.g-modal-inner').getBoundingClientRect();
      let hit = 0, tot = 0;
      for (let x = 0.12; x <= 0.88; x += 0.19) {
        for (let y = 0.12; y <= 0.88; y += 0.19) {
          tot++;
          const el = document.elementFromPoint(inner.left + inner.width * x, inner.top + inner.height * y);
          if (el && el.closest && el.closest('#baWvGate')) hit++;
        }
      }
      return { acc: a.acc, need: a.need, open: a.open,
               active: box.classList.contains('active'),
               seen: hit === tot, tot: tot,
               go: btns.filter(x => /เข้าสู่ห้องบอส/.test(x.textContent)).length,
               locked: btns.filter(x => x.disabled).length,
               back: btns.filter(x => /ทบทวน/.test(x.textContent)).length,
               paused: (typeof acPaused === 'function') ? acPaused() : null };
    });
    eq('ความแม่นยำที่ประตูอ่านได้', low.acc, 50);
    ok('ประตูเปิดขึ้นจริงและมองเห็นได้ทั่วกรอบ', low.open === true && low.active === true && low.seen === true, low);
    eq('ไม่ผ่าน → ไม่มีปุ่มเข้าห้องบอส', low.go, 0);
    ok('ไม่ผ่าน → ปุ่มถูกล็อก', low.locked >= 1, low);
    eq('ไม่ผ่าน → มีปุ่มส่งกลับไปทบทวน', low.back, 1);
    ok('ประตูเป็นหน้าต่างระบบ นาฬิกาต่อข้อจึงถูกหยุดให้เอง (v4.8.1)', low.paused === true, low);

    /* Patch v8.4 · กล่องกติกาบนประตูต้องบอกโควตาชุดใหม่ (3 / 3) ไม่ใช่ของ v8.2 (2 / 2)
       — ข้อความกับตัวเลขที่ทำงานจริงต้องเป็นก้อนเดียวกันเสมอ (กติกาของ v4.7.9.1) */
    const rule = await b.page.evaluate(() => {
      const el = document.querySelector('#baWvGateBody .ba-wv-gr');
      const a  = baBattleAudit().apex;
      return { t: el ? el.textContent : '', doomMax: a.doomMax, potMax: a.potMax };
    });
    ok('กล่องกติกาบอกโควตาความผิดพลาดชุดใหม่ [' + rule.doomMax + ']',
       new RegExp('ไม่เกิน ' + rule.doomMax + ' ครั้ง').test(rule.t), rule);
    ok('กล่องกติกาบอกโควตาน้ำยาชุดใหม่ [' + rule.potMax + ']',
       new RegExp('ฟื้นฟูได้ไม่เกิน ' + rule.potMax + ' ครั้ง').test(rule.t), rule);
    ok('ไม่มีเลขโควตาชุดเก่าหลงเหลืออยู่บนจอ', !/ไม่เกิน 2 ครั้ง/.test(rule.t), rule);

    const back = await b.page.evaluate(() => { baWvGateBack(); return { f: G.floor, open: baBattleAudit().apex.open }; });
    await b.page.waitForTimeout(320);
    await clearOverlays(b.page);
    eq('กดส่งกลับแล้วไปยืนที่ชั้นทบทวน', back.f, 17);
    ok('ประตูถูกปิดหลังกดปุ่ม', back.open === false);

    /* แม่นยำถึงเกณฑ์ → เข้าได้ และไม่เด้งซ้ำในรอบเดียวกัน */
    await b.page.evaluate(() => { G.correct = 190; G.wrong = 10; });
    await goFloor(b.page, 20);
    await b.page.evaluate(() => { BA_WV_GATE = -1; baWvGateCheck(); });
    await b.page.waitForTimeout(240);
    const hi = await b.page.evaluate(() => {
      const a = baBattleAudit().apex;
      const btns = [].slice.call(document.querySelectorAll('#baWvGate button'));
      return { acc: a.acc, open: a.open, go: btns.filter(x => /เข้าสู่ห้องบอส/.test(x.textContent)).length };
    });
    eq('ความแม่นยำถึงเกณฑ์', hi.acc, 95);
    ok('ผ่าน → มีปุ่มเข้าห้องบอสให้กด', hi.open === true && hi.go === 1, hi);
    await b.page.evaluate(() => baWvGateGo());
    await b.page.waitForTimeout(200);
    const again = await b.page.evaluate(() => {
      G.floorProgress = 0; G.locked = false; nextMonster();
      return baBattleAudit().apex;
    });
    ok('ผ่านแล้วไม่เด้งซ้ำในรอบหอคอยเดียวกัน', again.open === false && again.passed === true, again);

    /* ซ่อนพินอิน 100% ตลอดชั้น 20 */
    const np = await b.page.evaluate(() => ({
      on: baBattleAudit().apex.on,
      hidden: !!(baScreen() && baScreen().classList.contains('ba-wv-np')),
      vis: getComputedStyle(document.getElementById('gPinyin')).visibility
    }));
    ok('ชั้น 20 ซ่อนพินอิน 100%', np.on === true && np.hidden === true && np.vis === 'hidden', np);

    /* Patch v8.4 · ตัวนับความผิดพลาดผ่อนเป็น 3 ครั้ง — ครั้งที่ 4 คือจบเกม */
    const doom = await b.page.evaluate(async () => {
      const steps = [];
      G.hp = G.maxHp; G.shield = 0; G.items = {};
      for (let i = 0; i < 4; i++) {
        G.monsterHp = G.monsterMaxHp;
        G.locked = false;
        const m = G.currentMonster;
        const wrong = m.choices.filter(c => c !== m.answer)[0];
        G.hp = G.maxHp;                      /* กันตายจากดาเมจปกติ เพื่อวัดตัวนับล้วน */
        resolveAnswer(wrong, null, false);
        steps.push({ n: baBattleAudit().apex.doom, hp: G.hp });
        await new Promise(r => setTimeout(r, 60));
      }
      return { steps: steps, max: baBattleAudit().apex.doomMax,
               n: baBattleAudit().wave.n.doom, grace: baBattleAudit().softening.n.grace };
    });
    eq('โควตาความผิดพลาดถูกผ่อนเป็น 3 ครั้ง', doom.max, 3);
    eq('ตัวนับเดินครบสี่ครั้ง', doom.steps.map(s => s.n), [1, 2, 3, 4]);
    ok('ผิดสามครั้งแรกยังรอด (ผ่อนโทษให้)',
       doom.steps.slice(0, 3).every(s => s.hp > 0), doom);
    ok('ผิดครั้งที่ ' + (doom.max + 1) + ' ตัดเข้าสถานะจบเกมทันที (HP เหลือ 0)',
       doom.steps[3].hp <= 0, doom);
    ok('ตัวนับ GameOver ของแพตช์เดินหน้า', doom.n >= 1, doom);
    ok('ตัวนับโอกาสที่ผ่อนให้เดินหน้าอย่างน้อยหนึ่งครั้ง', doom.grace >= 1, doom);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 7 · จำกัดยา · ภาษีเวลา · ค่าถาวรรอดข้ามการล็อกอิน ═════════════
  {
    head('บล็อก 7 · จำกัดยา · ภาษีเวลา · ค่าถาวร');
    const b = await boot(browser);
    await enterGame(b.page, 'wv7');
    await b.page.evaluate(() => { G.correct = 190; G.wrong = 10; });
    await goFloor(b.page, 20);
    await clearOverlays(b.page);

    const pot = await b.page.evaluate(() => {
      G.items = { potion: 9 };
      const used = [];
      for (let i = 0; i < 5; i++) {
        G.hp = Math.max(1, Math.round(G.maxHp * 0.3));
        const n0 = G.items.potion;
        useItem('potion');
        used.push(n0 - G.items.potion);
      }
      return { used: used, cap: baBattleAudit().apex.potMax, n: baBattleAudit().apex.pot };
    });
    eq('โควตาน้ำยาถูกผ่อนเป็น 3 ครั้ง', pot.cap, 3);
    eq('ดื่มได้สามครั้งแรก ครั้งที่สี่เป็นต้นไปถูกบล็อก', pot.used, [1, 1, 1, 0, 0]);
    eq('ตัวนับการดื่มหยุดที่เพดาน', pot.n, pot.cap);

    /* ภาษีเวลา — วัดสองเรื่องแยกกัน
       (ก) ผลของภาษีล้วน ๆ ต้องวัดโดยขยับ BA_WV_TAXA เองในทิกเดียวกัน
           **ห้ามวัดจากการตอบจริงหลายข้อติดกัน** เพราะ AGI ของ v4.0 ไหลตามเวลา
           ที่ใช้ตอบ แล้วโบนัสเวลาจาก AGI จะกลบผลของภาษีจนอ่านไม่ออก
       (ข) การตอบช้าจริงต้องทำให้ภาษีสะสมเพิ่มขึ้นตามจำนวนครั้ง */
    const tax = await b.page.evaluate(() => {
      const a0 = baBattleAudit().apex;
      const keep = BA_WV_TAXA;
      BA_WV_TAXA = 0;        const base = questionMs();
      BA_WV_TAXA = a0.tax;   const one  = questionMs();
      BA_WV_TAXA = 999999;   const bot  = questionMs();
      BA_WV_TAXA = keep;
      const steps = [];
      for (let i = 0; i < 4; i++) {
        G.monsterHp = G.monsterMaxHp;
        G.locked = false;
        const m = G.currentMonster;
        G.questionStart = Date.now() - (a0.taxAt + 800);
        resolveAnswer(m.answer, null, false);
        steps.push(baBattleAudit().apex.taxed);
      }
      return { base: base, one: one, bot: bot, steps: steps,
               min: a0.taxMin, bmin: baBattleAudit().superBoss.min,
               tax: a0.tax, n: baBattleAudit().wave.n.tax };
    });
    ok('ภาษีหนึ่งครั้งตัดเวลาลงเท่ากับค่าคงที่พอดี [' + tax.base + '→' + tax.one + ']',
       tax.base - tax.one === tax.tax, tax);
    /* Patch v8.4 · พื้นของห้องบอส (5.0 วิ) ถูกใส่เป็นลำดับสุดท้าย จึงครอบภาษีเวลา
       ของชั้น 20 ไปด้วย — ภาษีกดเวลาลงต่ำกว่านั้นไม่ได้ไม่ว่าจะโดนไปกี่ครั้ง */
    ok('ภาษีกดเวลาลงต่ำกว่าพื้นห้องบอสไม่ได้ [' + tax.bot + ']', tax.bot === tax.bmin, tax);
    ok('พื้นใหม่สูงกว่าพื้นภาษีเดิมของ v8.2', tax.bmin > tax.min, tax);
    ok('ตอบช้าจริงแล้วภาษีสะสมเพิ่มขึ้นทุกครั้ง',
       tax.steps.every((v, i) => i === 0 || v === tax.steps[i - 1] + tax.tax), tax);
    ok('ตัวนับภาษีเวลาเดินหน้า', tax.n >= 4, tax);

    /* ค่าถาวรต้องรอดข้ามการล็อกอินจริง (กับดักข้อ 16 · ข้อ 38) */
    const saved = await b.page.evaluate(() => {
      G.abyss_incursion_idx = 9;
      baWvSave();
      return (loadStore()['wv7'] || {}).abyss_incursion_idx;
    });
    eq('ค่าถูกเขียนลง store จริง', saved, 9);

    await b.page.evaluate(() => exitGame());
    await b.page.waitForTimeout(700);
    await b.page.evaluate(() => { enterGate(); });
    await b.page.waitForTimeout(700);
    await b.page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'wv7';
      document.getElementById('login-pw').value = '1111';
      handleSubmit();
    });
    await b.page.waitForTimeout(1500);
    await clearOverlays(b.page);
    const relog = await b.page.evaluate(() => ({
      idx: G.abyss_incursion_idx, a: baBattleAudit().rift.idx,
      doom: baBattleAudit().apex.doom, pot: baBattleAudit().apex.pot
    }));
    eq('ล็อกอินใหม่แล้วดัชนีรอยแยกยังอยู่ครบ', relog.idx, 9);
    eq('audit อ่านค่าเดียวกัน', relog.a, 9);
    ok('ตัวนับของชั้น 20 ถูกล้างตอนเข้าเกมใหม่', relog.doom === 0 && relog.pot === 0, relog);

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 8 · ขอบเขต · เลย์เอาต์ ════════════════════════════════════════
  {
    head('บล็อก 8 · โหมดฝึก · ความสูงการ์ดโจทย์');
    const b = await boot(browser);
    await enterGame(b.page, 'wv8');

    /* โหมดฝึกจุดอ่อนต้องไม่โดนอะไรของแพตช์นี้เลย */
    const prac = await b.page.evaluate(() => {
      G.practiceMode = true;
      G.floor = 18; G.floorProgress = 0;
      const w = baBattleAudit().wave;
      const f20 = baBattleAudit().apex.on;
      G.practiceMode = false;
      return { w: w.w, w123: w.w123, w5: w.w5, f20: f20 };
    });
    eq('โหมดฝึกอยู่นอกลูปเวฟ', prac.w, 0);
    ok('โหมดฝึกไม่โดนกติกาของเวฟไหนเลย', prac.w123 === false && prac.w5 === false && prac.f20 === false, prac);

    /* ความสูงการ์ดโจทย์ต้องเท่าเดิมทุกความกว้าง — บังคับคำ/ตัวเลือกให้คงที่
       และล้าง #gFeedback ก่อนเสมอ (บทเรียนของชุด v7.2/v7.4/v7.5/v7.8/v7.9) */
    const WANT = { 320: 354.8, 360: 340.8, 390: 340.8, 430: 340.8 };
    for (const w of [320, 360, 390, 430]) {
      const bb = await boot(browser, w, 844);
      await enterGame(bb.page, 'wvL' + w);
      const h = await bb.page.evaluate(() => {
        G.floor = 2; G.floorProgress = 0;
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng Yǔyán Dàxué';
        document.getElementById('gQuestion').textContent = 'เลือกความหมายภาษาไทยที่ถูกต้อง';
        const fb = document.getElementById('gFeedback');
        if (fb) { fb.textContent = ''; fb.className = 'g-feedback'; }
        G.currentMonster.choices = ['มหาวิทยาลัยภาษาและวัฒนธรรมปักกิ่ง', 'ปักกิ่ง', 'ภาษาจีน', 'นักเรียน'];
        renderChoices();
        const card = document.querySelector('.ac-battle') ||
                     document.querySelector('#gameScreen .g-card');
        return card ? +card.getBoundingClientRect().height.toFixed(1) : -1;
      });
      near('จอ ' + w + ' · ความสูงการ์ดโจทย์เท่าเดิม', h, WANT[w], 0.6);
      const flow = await bb.page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
      ok('จอ ' + w + ' · ไม่ล้นแนวนอน', flow === true);
      ok('จอ ' + w + ' · ไม่มี pageerror', bb.errs.length === 0, bb.errs);
      await bb.ctx.close();
    }

    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('═══════════════════════════════════');
})();
