/* test_boss_resilience.js — ชุดเทสต์ของชั้น v6.7
   (Layered Boss Resilience & Regeneration — เลือด x2.5 · เกราะ 70% · คริตถูกลดทอน
    · Progressive Damage Gate · Abyssal Life Pulse · Phase 2 Iron Shell · Soul Siphon)

   NODE_PATH=/opt/node22/lib/node_modules node test_boss_resilience.js

   ทุกเคสวัดจาก **ไฟล์แจก** ที่รากrepo ตามกติกาของ repo (ต้อง build ก่อนรันเสมอ)   */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_boss_resilience.log');
let pass = 0, fail = 0;
function ok(c, m) { (c ? pass++ : fail++); const l = (c ? '✅ ' : '❌ ') + m; fs.appendFileSync(LOG, l + '\n'); console.log(l); }
function blk(t) { fs.appendFileSync(LOG, '\n── ' + t + ' ──\n'); console.log('\n── ' + t + ' ──'); }
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

/* กันเน็ตออกนอกเครื่องทุกทาง — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส */
const STUB = `
  window.__NET = [];
  window.fetch = function (u) {
    window.__NET.push(String(u));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null),
                             text: () => Promise.resolve('null') });
  };
  window.EventSource = function () {
    this.close = function () {}; this.readyState = 1;
    setTimeout(() => { if (this.onerror) this.onerror({}); }, 50);
  };
`;

async function enter(page, user) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgAck(); } catch (e) { enterGate(); } });
  await page.waitForTimeout(700);
  await page.evaluate((u) => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    document.getElementById('reg-name').value = 'TEST';
    handleSubmit();
  }, user);
  await page.waitForTimeout(900);
  await clearOverlays(page);
}

/* ปิดทุกหน้าต่างที่ค้างอยู่ แล้วพาจอกลับมาที่โจทย์ — baFighting() เป็นเท็จทันที
   ที่มีหน้าต่างเปิดค้าง (หน้าต่างจั่วการ์ดของ v4.7 · gate ของ v4.1/v4.6 · ประตูวาป) */
async function clearOverlays(page) {
  for (let i = 0; i < 14; i++) {
    const done = await page.evaluate(() => {
      const card = document.querySelector('#cdDraft.active .cd-card');
      if (card) { card.click(); return false; }
      if (document.querySelector('#snGate.active')) { try { snGateConfirm(); } catch (e) {} return false; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { try { warpGo(); } catch (e) {} return false; }
      return !(typeof acOverlayOpen === 'function' && acOverlayOpen());
    });
    await page.waitForTimeout(done ? 60 : 700);
    if (done) break;
  }
  await page.evaluate(() => { try { acFocusQa(); acSync(true); } catch (e) {} });
  await page.waitForTimeout(120);
}

/* พาไปยืนชั้นที่ต้องการโดยไม่ต้องไต่จริง
   **ปิดระบบบุกรุกของ v6.6 ทุกครั้ง** — ทัพเงามีโอกาส 15% ต่อชั้นที่จะมายืนแทน
   อสูรประจำชั้น ซึ่งเปลี่ยนทั้งเกจ · สกิล · ป้ายชื่อ แล้วชุดนี้จะตกแบบสุ่ม
   ปั๊ม BA_INC_F ให้ตรงชั้น = ลูกเต๋าถูกทอยไปแล้ว จะไม่ถูกทอยซ้ำใน baIncSync */
async function goFloor(page, f) {
  await page.evaluate((fl) => {
    G.floor = fl;
    G.maxFloor = Math.max(G.maxFloor || 1, fl);
    G.floorProgress = 0;
    G.hp = G.maxHp; G.shield = 0;
    if (typeof CD_BAND !== 'undefined') CD_BAND = cdBandOf(fl);   /* กันหน้าต่างจั่วเด้ง */
    if (typeof CD_CARD !== 'undefined') { CD_CARD = null; }        /* การ์ดไม่มายุ่งกับดาเมจ */
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = fl; BA_INC_AT = -1; BA_INC_M = null; }
    recalcStats();
    nextMonster();
  }, f);
  await page.waitForTimeout(300);
  await clearOverlays(page);
}

/* ตอบถูกหนึ่งครั้งแล้วคืนยอดดาเมจจริง — fast=true บังคับคริตของ v6.3 (ตอบใน 3 วิ) */
async function hit(page, fast, opt) {
  const r = await page.evaluate(([f, o]) => {
    const g = G;
    if (typeof ba_crit !== 'undefined') ba_crit = 0;   /* กันท่าไม้ตายมาปนกลางทาง */
    g.hp = g.maxHp; g.shield = 0;   /* หลอดโจมตีปกติของ v6.5 ฆ่าฮีโร่ระหว่างวัดได้ */
    /* ล้างสตรีค = ปิดดาเมจพิเศษของความแม่นยำ (AB_PREC ของ v4.6) ซึ่งบวกเข้าเกราะผนึก
       ทีละ 60-120% แล้วทำให้สองหมัดที่ควรเท่ากันวัดออกมาไม่เท่ากัน */
    if (o && o.noStreak) g.streak = 0;
    g.questionStart = f ? Date.now() : (Date.now() - 9000);
    g.locked = false;
    const before = g.monsterHp;
    const m = g.currentMonster;
    resolveAnswer(m.answer, null, false);
    return { dealt: before - g.monsterHp, hp: g.monsterHp, max: g.monsterMaxHp,
             fb: (document.getElementById('gFeedback') || {}).textContent || '' };
  }, [!!fast, opt || null]);
  await page.waitForTimeout(1400);
  await clearOverlays(page);
  return r;
}

async function audit(page) { return await page.evaluate(() => baBattleAudit()); }

/* เดินเวลาโดยประคองไฟต์ไว้ — หลอดโจมตีปกติของ v6.5 ฟาดฮีโร่ทุก 2.5 วิ ที่ชั้น 20
   (25% HP ต่อครั้ง) ฮีโร่จะตายภายใน ~10 วินาที แล้ว baFighting() กลายเป็นเท็จ
   ทำให้ Life Pulse หยุดเดินโดยไม่เกี่ยวกับสิ่งที่กำลังวัดเลย · และนาฬิกาข้อบอส
   หมดที่ 12 วินาที ต้องต่ออายุให้ด้วยถ้าวัดนานกว่านั้น */
async function tick(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.evaluate(() => {
      const g = G;
      g.hp = g.maxHp;
      if (typeof QUESTION_TIMER !== 'undefined' && !QUESTION_TIMER && !g.warpOpen && g.currentMonster) {
        g.locked = false;
        try { startQuestionTimer(); } catch (e) {}
      }
    });
    await page.waitForTimeout(Math.min(280, Math.max(40, end - Date.now())));
  }
}

(async () => {
  fs.writeFileSync(LOG, 'test_boss_resilience · ' + new Date().toISOString() + '\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await enter(page, 'rs01');

  // ═══ 1) ค่าคงที่ตรงสเปกทุกตัว ═══════════════════════════════════════
  blk('1 · ค่าคงที่ของสเปก');
  const K = await page.evaluate(() => ({
    hp: BA_RS_HP, bar: BA_RS_BAR, crit: BA_RS_CRIT_CUT,
    hi: BA_RS_GATE_HI, lo: BA_RS_GATE_LO, half: BA_RS_HALF,
    regen: BA_RS_REGEN, ms: BA_RS_REGEN_MS, supp: BA_RS_SUPP_MS,
    p2: BA_RS_P2, siphon: BA_RS_SIPHON
  }));
  ok(K.hp === 2.5, 'เลือดบอส x2.5 [' + K.hp + ']');
  ok(K.bar === 0.70, 'Heavy Abyssal Barrier 70% [' + K.bar + ']');
  ok(K.crit === 0.50, 'คริตถูกลดทอน 50% [' + K.crit + ']');
  ok(K.hi === 0.15, 'เพดานดาเมจช่วงเลือด >50% = 15% [' + K.hi + ']');
  ok(K.lo === 0.10, 'เพดานดาเมจช่วงเลือด <50% = 10% [' + K.lo + ']');
  ok(K.half === 0.50, 'เส้นแบ่งเฟส 50% [' + K.half + ']');
  ok(K.regen === 0.006 && K.ms === 1000, 'Life Pulse +0.6% ทุก 1 วินาที [' + K.regen + '/' + K.ms + ']');
  ok(K.supp === 2000, 'โดนคริตแล้วระงับรีเจน 2.0 วิ [' + K.supp + ']');
  ok(K.p2 === 0.35, 'Phase 2 Iron Shell +35% [' + K.p2 + ']');
  ok(K.siphon === 0.05, 'Soul Siphon +5% [' + K.siphon + ']');

  // ═══ 2) สเตตัสพื้นฐาน — เลือด x2.5 + เกราะ 70% ═════════════════════
  blk('2 · เลือดบอส x2.5 + Heavy Abyssal Barrier 70%');
  for (const f of [4, 8, 12, 16, 20]) {
    await goFloor(page, f);
    const s = await page.evaluate((fl) => {
      const atk = hunterAtk();
      const raw = hitsForFloor(fl, true) * atk;         /* เลือดบอสตามสูตรของ v4.0 */
      const seal = (typeof AB_SEAL !== 'undefined' && AB_SEAL) ? AB_SEAL.max : 0;
      return { raw: raw, seal: seal, base: BA_BAR ? BA_BAR.base : 0,
               barMax: BA_BAR ? BA_BAR.max : 0, tier: BA_BAR ? BA_BAR.tier : '',
               max: G.monsterMaxHp, hp: G.monsterHp, sealLeft: abSealLeft(),
               a: baBattleAudit().resil, wv: baBattleAudit().superBoss };
    }, f);
    /* เนื้อบอสถูกคูณ 2.5 แล้วผนึกของ v4.6 วางทับ */
    const wantBase = Math.round(s.raw * 2.5) + s.seal;
    ok(near(s.base, wantBase, 3),
       'ชั้น ' + f + ' เนื้อบอส x2.5 [base=' + s.base + ' ต้องการ ' + wantBase + ']');
    /* **เกราะเริ่มต้นเปลี่ยนจาก 70% คงที่ เป็น 50-65% ไล่ระดับตามบานประตูบอส
       ตั้งแต่ Patch v8.2 · Wave 5 Super-Boss Tier** — อ่านเป้าจาก audit ของชั้นนั้น
       ตรง ๆ ไม่พิมพ์ตัวเลขทับไว้ ถ้าค่าคงที่ขยับ เคสนี้จะขยับตามเอง */
    const wantBar = Math.round(s.base * s.wv.bar);
    ok(near(s.barMax, wantBar, 2),
       'ชั้น ' + f + ' เกราะ ' + Math.round(s.wv.bar * 100) + '% ของเนื้อบอส [' +
       s.barMax + '/' + wantBar + ']');
    ok(s.hp === s.max && s.max === s.base + s.barMax,
       'ชั้น ' + f + ' หลอดเต็มใบ = เนื้อ + เกราะ [' + s.max + ']');
    ok(near(s.sealLeft, s.seal, 2),
       'ชั้น ' + f + ' แถบผนึกของ v4.6 ไม่เพี้ยน [' + s.sealLeft + '/' + s.seal + ']');
    ok(s.a.on === true && s.a.mhp === s.max, 'ชั้น ' + f + ' ระบบต้านทานทำงาน');
  }

  // ═══ 3) Progressive Damage Gate ════════════════════════════════════
  blk('3 · เพดานดาเมจต่อข้อ 15% / 10%');
  await goFloor(page, 20);
  let a = await audit(page);
  ok(near(a.resil.gateHi, Math.round(a.resil.mhp * 0.15), 2),
     'เพดานช่วงบน = 15% ของหลอด [' + a.resil.gateHi + ']');
  ok(near(a.resil.gateLo, Math.round(a.resil.mhp * 0.10), 2),
     'เพดานช่วงล่าง = 10% ของหลอด [' + a.resil.gateLo + ']');
  ok(a.resil.gate === a.resil.gateHi, 'เลือดเต็ม → ใช้เพดานช่วงบน');

  /* ดันดาเมจให้ทะลุเพดานด้วยการอัปเลเวล **หลัง** ตั้งเลือดบอสแล้ว
     (เลือดบอสคิดจาก hunterAtk ตอน nextMonster ค่าจึงถูกตรึงไว้ก่อนแล้ว) */
  /* **ต้องยัด STR หลัง recalcStats() เสมอ** — ตั้งแต่ v8.5 computeStats คิดค่าพลัง
     ใหม่ทั้งชุดจากสายอาชีพ+เลเวล ค่าที่ยัดไว้ก่อนจะถูกทับทิ้ง และการดันเลเวลอย่างเดียว
     ก็ทะลุเพดานไม่ได้แล้ว เพราะ ATK ของ v8.5 ไม่ได้โตตามเลเวล (ตัวคูณของ v7.6
     ตันที่ ×2.47 ตอนเลเวล 99) ตัวที่ดันดาเมจได้จริงคือ STR ตามสูตร 1000*(1+STR*0.005) */
  /* **ห้ามยัดเลเวลเกิน 99 อีกแล้ว** — ตั้งแต่ v8.6 wrapper ของ levelUpCheck หนีบ
     เลเวลกลับที่ 99 แล้วเรียก recalcStats() ให้ค่าพลังตรงกับเลเวลที่หนีบ ซึ่งจะล้าง
     STR ที่ยัดไว้ทิ้งตอนตอบข้อแรกจบ แล้วดาเมจของเคสถัดไปจะร่วงกลับเป็นค่าปกติ
     · ตัวที่ดันดาเมจได้จริงคือ STR อยู่แล้ว เลเวลจึงตั้งที่เพดาน 99 พอ */
  await page.evaluate(() => { G.level = 99; recalcStats(); G.stats.str = 900; });
  let r = await hit(page, false);
  a = await audit(page);
  ok(near(r.dealt, a.resil.gateHi, 2),
     'ดาเมจล้นถูกหนีบที่ 15% [ลงจริง ' + r.dealt + ' เพดาน ' + a.resil.gateHi + ']');
  ok(/เกราะเบื้องลึกต้านไว้/.test(r.fb),
     'บรรทัดผลลัพธ์บอกว่าถูกต้านทาน [' + r.fb.slice(-52) + ']');

  /* ช่วงเลือดต่ำกว่าครึ่ง → เพดานลดเหลือ 10%  (ปั๊ม p2 ไว้ก่อนเพื่อวัดเพดานล้วน ๆ) */
  await page.evaluate(() => {
    BA_RS.p2 = true;
    G.monsterHp = Math.round(G.monsterMaxHp * 0.40);
    renderMonsterHp();
  });
  a = await audit(page);
  ok(a.resil.gate === a.resil.gateLo, 'เลือดต่ำกว่าครึ่ง → สลับไปเพดานช่วงล่าง');
  r = await hit(page, false);
  ok(near(r.dealt, a.resil.gateLo, 2),
     'ดาเมจล้นถูกหนีบที่ 10% [ลงจริง ' + r.dealt + ' เพดาน ' + a.resil.gateLo + ']');

  /* เพดานต้องกันไม่ให้บอสตายก่อนเวลา และต้องสั่งคิวเทิร์นใหม่เองด้วย */
  await page.evaluate(() => { G.monsterHp = Math.round(BA_RS.mhp * 0.30); renderMonsterHp(); });
  r = await hit(page, false);
  ok(r.hp > 0, 'เพดานกันบอสตายในหมัดเดียว [เหลือ ' + r.hp + ']');
  const alive = await page.evaluate(() => ({ locked: G.locked, m: !!G.currentMonster,
                                             t: (typeof QUESTION_TIMER !== 'undefined') && !!QUESTION_TIMER }));
  ok(alive.m && !alive.locked, 'คิวเทิร์นถูกสั่งใหม่ — เกมเดินต่อได้ ไม่ค้าง');

  // ═══ 4) คริติคอลถูกลดทอน 50% ขณะเกราะยังอยู่ ══════════════════════
  blk('4 · เกราะยังอยู่ → คริตถูกลดทอนครึ่งหนึ่ง');
  await goFloor(page, 20);
  /* ตั้งดาเมจให้ต่ำกว่าเพดานมาก ๆ เพื่อวัดผลของการลดทอนล้วน ๆ */
  await page.evaluate(() => { G.level = 1; G.stats.str = 0; recalcStats(); });
  /* v8.8 ผูกโบนัสของช่อง 1 (สายนักลอบสังหาร ดาเมจซ้ำ 120%) ไว้กับ "ตอบไวไม่เกิน 3.5 วิ"
     ซึ่งเป็นเงื่อนไขเดียวกับที่ v6.3 ใช้บังคับคริต — แยกคริตด้วยความไวเหมือนเดิมไม่ได้อีก
     เพราะสองหมัดจะต่างกันที่โบนัสช่อง 1 ด้วย ไม่ใช่ที่การลดทอนคริตล้วน
     ต้องบังคับ critChance ตรง ๆ แล้วให้ทั้งสองหมัด "ไวเท่ากัน" (ท่าเดียวกับชุดของ v6.3) */
  await page.evaluate(() => { window.__CC = critChance; critChance = () => 0; });
  const normal = await hit(page, true, { noStreak: true });
  await page.evaluate(() => { critChance = () => 100; });
  const critUp = await hit(page, true, { noStreak: true });
  await page.evaluate(() => { critChance = window.__CC; });
  ok(/CRITICAL/.test(critUp.fb) && !/CRITICAL/.test(normal.fb),
     'บังคับคริตติด/ไม่ติดได้จริงตามที่สั่ง');
  ok(near(critUp.dealt, normal.dealt, Math.max(2, Math.round(normal.dealt * 0.12))),
     'เกราะยังอยู่: คริตลงเท่าหมัดธรรมดา [' + critUp.dealt + ' vs ' + normal.dealt + ']');

  /* พังเกราะทิ้งแล้ววัดใหม่ — คริตต้องกลับมาเป็นสองเท่า */
  await page.evaluate(() => {
    G.monsterHp = Math.max(1, BA_BAR.base - 5);   /* เกราะหมดแล้ว */
    BA_RS.p2 = true;                              /* กันเกราะระลอกสองมากางทับ */
    renderMonsterHp(); baBarSync();
  });
  await page.waitForTimeout(120);
  const barLeft = await page.evaluate(() => baBarLeft());
  ok(barLeft === 0, 'เกราะถูกทลายแล้วจริง [' + barLeft + ']');
  const critNoBar = await hit(page, true, { noStreak: true });
  ok(critNoBar.dealt > normal.dealt * 1.5,
     'เกราะแตกแล้ว: คริตกลับมาเต็มแรง [' + critNoBar.dealt + ' vs ' + normal.dealt + ']');

  // ═══ 5) Abyssal Life Pulse ═════════════════════════════════════════
  blk('5 · รีเจน +0.6% ทุก 1 วินาที · โดนคริตแล้วระงับ 2 วิ');
  await goFloor(page, 20);
  a = await audit(page);
  ok(a.resil.pulsing === true, 'นาฬิการีเจนติดอาวุธแล้วตอนเข้าไฟต์บอส');
  ok(near(a.resil.regen, Math.round(a.resil.mhp * 0.006), 2),
     'ยอดรีเจนต่อจังหวะ = 0.6% ของหลอด [' + a.resil.regen + ']');

  await page.evaluate(() => { G.monsterHp = Math.round(G.monsterMaxHp * 0.80); renderMonsterHp(); });
  const hp0 = await page.evaluate(() => G.monsterHp);
  await tick(page, 3400);
  const hp1 = await page.evaluate(() => G.monsterHp);
  const step = await page.evaluate(() => baBattleAudit().resil.regen);
  ok(hp1 > hp0, 'บอสฟื้นเลือดเองระหว่างข้อ [' + hp0 + ' → ' + hp1 + ']');
  ok(near(hp1 - hp0, step * 3, step * 1.6),
     'ฟื้นราว 3 จังหวะใน 3.4 วินาที [+' + (hp1 - hp0) + ' ต่อจังหวะ ' + step + ']');

  /* โดน Critical Strike → ระงับ 2 วินาที */
  await page.evaluate(() => { baStrike(1, true, false); });
  a = await audit(page);
  ok(a.resil.suppressed === true, 'โดนคริต → รีเจนถูกระงับทันที');
  const hp2 = await page.evaluate(() => G.monsterHp);
  await tick(page, 1400);
  const hp3 = await page.evaluate(() => G.monsterHp);
  ok(hp3 === hp2, 'ระหว่างถูกระงับ เลือดไม่ขยับเลย [' + hp2 + ' → ' + hp3 + ']');
  await tick(page, 2400);
  const hp4 = await page.evaluate(() => G.monsterHp);
  ok(hp4 > hp3, 'พ้น 2 วินาทีแล้วรีเจนกลับมาเดินต่อ [' + hp3 + ' → ' + hp4 + ']');

  /* หยุดเกมแล้วรีเจนต้องหยุดตาม (ข้ามจังหวะ ไม่ใช่ทบ) */
  await page.evaluate(() => { try { acTogglePause(); } catch (e) {} });
  await page.waitForTimeout(160);
  const hp5 = await page.evaluate(() => G.monsterHp);
  await page.waitForTimeout(2600);
  const hp6 = await page.evaluate(() => G.monsterHp);
  ok(hp6 === hp5, 'เกมหยุด → รีเจนหยุดตาม ไม่ทบย้อนหลัง [' + hp5 + ' → ' + hp6 + ']');
  await page.evaluate(() => { try { acResumeClick(); } catch (e) {} });
  await page.waitForTimeout(200);
  await clearOverlays(page);

  // ═══ 6) Phase 2 Iron Shell ═════════════════════════════════════════
  blk('6 · เลือดแตะครึ่งหลอดครั้งแรก → กางเกราะ +35%');
  await goFloor(page, 20);
  const p0 = await page.evaluate(() => {
    G.monsterHp = Math.round(G.monsterMaxHp * 0.60);
    renderMonsterHp();
    return { hp: G.monsterHp, max: G.monsterMaxHp, p2: BA_RS.p2, add: baBattleAudit().resil.p2Add };
  });
  ok(p0.p2 === false, 'เลือด 60% ยังไม่กางเกราะระลอกสอง');
  const p1 = await page.evaluate(() => {
    G.monsterHp = Math.round(BA_RS.mhp * 0.48);
    renderMonsterHp();
    return { hp: G.monsterHp, max: G.monsterMaxHp, p2: BA_RS.p2, bar: baBarLeft() };
  });
  ok(p1.p2 === true, 'แตะครึ่งหลอด → กางเกราะระลอกสองทันที');
  ok(near(p1.max - p0.max, p0.add, 2),
     'หลอดยาวขึ้นเท่ากับ 35% ของ Max HP [+' + (p1.max - p0.max) + '/' + p0.add + ']');
  ok(p1.bar > 0, 'แถบเกราะกลับมาเต็มอีกครั้ง [' + p1.bar + ']');
  /* ต้องอ่านแบนเนอร์ **ก่อน** จะไปกินเกราะให้แตก ไม่งั้น ARMOR BREAK ของ v6.4
     จะเขียนทับป้ายเดียวกันตามหน้าที่ของมัน (ไม่ใช่บั๊ค) */
  ok(/PHASE 2/.test(await page.evaluate(() => (document.getElementById('baSkill') || {}).textContent || '')),
     'แบนเนอร์ประกาศ PHASE 2 ขึ้นจริง');
  const p2b = await page.evaluate(() => {
    G.monsterHp = Math.round(BA_RS.mhp * 0.20);
    renderMonsterHp();
    return { max: G.monsterMaxHp, p2: BA_RS.p2 };
  });
  ok(p2b.max === p1.max, 'กางได้ครั้งเดียวตลอดไฟต์ ไม่กางซ้ำ [' + p2b.max + ']');

  // ═══ 7) Soul Siphon Penalty ════════════════════════════════════════
  /* **Patch v8.2 · Wave 5 Absolute Punishment เขียนทับกติกานี้ในห้องบอส**
     ตอบผิดในห้องบอสประจำชั้นทำให้บอสฟื้นเต็มหลอด (+100%) ไม่ใช่ +5% อีกต่อไป
     และแบนเนอร์เป็น ABSOLUTE PUNISHMENT แทน SOUL SIPHON
     · ตัว Soul Siphon ของ v6.7 ยังทำงานตามเดิมทุกประการในไฟต์ทัพเงา
       (ซึ่งไม่ใช่ Wave 5) — ชุดของ v8.1 เป็นคนพิสูจน์ส่วนนั้น */
  blk('7 · ตอบผิดในห้องบอส → บทลงโทษสมบูรณ์แบบ (v8.2 ทับ Soul Siphon)');
  await goFloor(page, 20);
  const s0 = await page.evaluate(() => {
    G.monsterHp = Math.round(G.monsterMaxHp * 0.70);
    G.hp = G.maxHp; G.shield = 0;
    renderMonsterHp();
    const before = G.monsterHp;
    const m = G.currentMonster;
    const wrong = m.choices.filter(c => c !== m.answer)[0];
    G.locked = false;
    resolveAnswer(wrong, null, false);
    return { gain: G.monsterHp - before, want: baBattleAudit().resil.siphon,
             hp: G.hp, full: G.monsterHp === G.monsterMaxHp,
             streak: G.streak, lock: baBattleAudit().superBoss.skillLocked };
  });
  ok(s0.full, 'บอสฟื้นกลับมาเต็มหลอดทันทีที่ตอบผิดในห้องบอส [+' + s0.gain + ']');
  ok(s0.gain > s0.want, 'ฟื้นมากกว่า Soul Siphon เดิม (+' + s0.gain + ' > +' + s0.want + ')');
  ok(s0.streak === 0, 'คอมโบคูณดาเมจถูกรีเซ็ตเป็น 0');
  ok(s0.lock === true, 'สกิลถูกผนึกหนึ่งข้อ');
  ok(/ABSOLUTE PUNISHMENT/.test(await page.evaluate(() => (document.getElementById('baSkill') || {}).textContent || '')),
     'แบนเนอร์ประกาศ ABSOLUTE PUNISHMENT ขึ้นจริง');
  await page.waitForTimeout(1800);
  await clearOverlays(page);

  // ═══ 8) ขอบเขต — ชั้นธรรมดา · อีลีท · โหมดฝึก · ออกจากเกม ══════════
  blk('8 · ขอบเขตของแพตช์');
  await goFloor(page, 2);
  const n1 = await page.evaluate(() => {
    const atk = hunterAtk();
    const w = baBattleAudit().wave;
    return { on: baBattleAudit().resil.on, max: G.monsterMaxHp,
             raw: hitsForFloor(2, false) * atk, pulsing: baBattleAudit().resil.pulsing,
             hpK: w.hp, armPct: w.armPct, arm: w.arm.max };
  });
  ok(n1.on === false, 'ชั้นมอนสเตอร์ธรรมดาไม่โดนระบบต้านทาน');
  /* **Patch v8.2 · Nightmare Rebalance บวกตัวคูณ HP ตามแบนด์ และวางเกราะ
     ชั้นนอกทับอีกชั้น** (เกราะเป็น HP ชั้นนอกแบบเดียวกับผนึกของ v4.6 เป๊ะ)
     เคสนี้จึงเทียบกับสูตรเดิม x ตัวคูณ + เกราะ โดยอ่านทั้งสองค่าจาก audit */
  const wantN = Math.round(n1.raw * n1.hpK) + n1.arm;
  ok(near(n1.max, wantN, 2),
     'ชั้นธรรมดา เลือด = สูตรเดิม x' + n1.hpK + ' + เกราะ ' +
     Math.round(n1.armPct * 100) + '% [' + n1.max + '/' + wantN + ']');
  ok(n1.pulsing === false, 'ชั้นธรรมดาไม่มีนาฬิการีเจนเดินอยู่');

  await goFloor(page, 19);   /* อีลีท — ยังใช้กติกาของ v6.4 ตามเดิม */
  const e1 = await page.evaluate(() => ({ on: baBattleAudit().resil.on,
                                          tier: BA_BAR ? BA_BAR.tier : '' }));
  ok(e1.on === false && e1.tier === 'elite', 'อีลีทไม่โดนระบบต้านทาน ยังเป็นของ v6.4 [' + e1.tier + ']');

  const pm = await page.evaluate(() => {
    G.practiceMode = true;
    G.floor = 20; if (typeof BA_INC_F !== 'undefined') { BA_INC_F = 20; BA_INC_AT = -1; }
    nextMonster();
    const o = { on: baBattleAudit().resil.on, pulsing: baBattleAudit().resil.pulsing };
    G.practiceMode = false;
    return o;
  });
  ok(pm.on === false && pm.pulsing === false, 'โหมดฝึกจุดอ่อนไม่โดนระบบต้านทาน');

  await page.waitForTimeout(300);
  await clearOverlays(page);
  await goFloor(page, 20);
  const stopped = await page.evaluate(() => {
    exitGame();
    return { pulsing: !!BA_RS_T, rs: BA_RS === null, m: BA_RS_M === null };
  });
  ok(stopped.pulsing === false && stopped.rs && stopped.m,
     'ออกจากเกม → นาฬิการีเจนดับและสถานะถูกล้างครบ');

  // ═══ 9) ไม่มี pageerror · ไม่มีเน็ตออกนอกเครื่อง · เลย์เอาต์ไม่ล้น ═══
  blk('9 · ความปลอดภัยรวม');
  const net = await page.evaluate(() => (window.__NET || []).length);
  ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุด [' + errs.slice(0, 2).join(' | ') + ']');
  const el = await page.evaluate(() => ({ w: document.body.scrollWidth, v: window.innerWidth }));
  ok(el.w <= el.v, 'เลย์เอาต์ไม่ล้นแนวนอน [' + el.w + '/' + el.v + ']');
  const bad = await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
            .filter(e => /rs[A-Z]/.test(String(e && e.where || ''))).length; } catch (e) { return -1; }
  });
  ok(bad === 0, 'Error Log ไม่มีรายการของชั้น v6.7 [' + bad + ']');
  fs.appendFileSync(LOG, '\n(คำขอเน็ตที่ถูก stub ไว้ ' + net + ' ครั้ง)\n');

  fs.appendFileSync(LOG, '\n══ สรุป ══\n✅ ผ่าน ' + pass + '\n❌ ตก ' + fail + '\n');
  console.log('\n══ สรุป ══  ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
