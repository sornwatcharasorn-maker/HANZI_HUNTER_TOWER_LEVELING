/* test_high_tier_boss.js — ชุดเทสต์ของชั้น v7.0
   (High-Tier Boss Encounter Mechanics — Stagger & Break · Question Traps
    · Enrage Berserk · Doomsday DPS Check)

   NODE_PATH=/opt/node22/lib/node_modules node test_high_tier_boss.js

   ทุกเคสวัดจาก **ไฟล์แจก** ที่รากrepo ตามกติกาของ repo (ต้อง build ก่อนรันเสมอ)  */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_high_tier_boss.log');
let pass = 0, fail = 0;
function ok(c, m) { (c ? pass++ : fail++); const l = (c ? '✅ ' : '❌ ') + m; fs.appendFileSync(LOG, l + '\n'); console.log(l); }
function blk(t) { fs.appendFileSync(LOG, '\n── ' + t + ' ──\n'); console.log('\n── ' + t + ' ──'); }

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
   **ปิดระบบบุกรุกของ v6.6 ทุกครั้ง** (กติกาเดิมของชุด v6.2/v6.3/v6.5/v6.7/v6.8) */
async function goFloor(page, f) {
  await page.evaluate((fl) => {
    G.floor = fl;
    G.maxFloor = Math.max(G.maxFloor || 1, fl);
    G.floorProgress = 0;
    G.hp = G.maxHp; G.shield = 0; G.streak = 0;
    if (typeof CD_BAND !== 'undefined') CD_BAND = cdBandOf(fl);
    if (typeof CD_CARD !== 'undefined') { CD_CARD = null; }
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = fl; BA_INC_AT = -1; BA_INC_M = null; }
    recalcStats();
    nextMonster();
  }, f);
  await page.waitForTimeout(300);
  await clearOverlays(page);
}

/* ตั้งเลือดบอสเป็นสัดส่วนที่ต้องการโดยไม่ผ่านการตอบ — ใช้ตรวจเส้นแบ่งเฟส
   **ต้องเรียก renderMonsterHp() เอง** เพราะนั่นคือทางที่ baHtSync ของ v7.0 เกาะอยู่ */
async function setHp(page, frac) {
  /* **ต้องตั้งซ้ำจนสัดส่วนนิ่ง** — Phase 2 Iron Shell ของ v6.7 กางเกราะ +35%
     ตอนข้ามเส้น 50% ครั้งแรก ซึ่งดันทั้ง monsterHp และ monsterMaxHp ขึ้นพร้อมกัน
     ตั้งรอบเดียวแล้ววัดจะได้สัดส่วนที่สูงกว่าที่สั่งไปเกือบเท่าตัว (เจอมาแล้ว) */
  for (let i = 0; i < 4; i++) {
    const f = await page.evaluate((x) => {
      G.monsterHp = Math.max(1, Math.round(G.monsterMaxHp * x));
      renderMonsterHp();
      return G.monsterHp / G.monsterMaxHp;
    }, frac);
    await page.waitForTimeout(120);
    if (Math.abs(f - frac) < 0.02) break;
  }
}

/* ตอบหนึ่งข้อ — fast=true คือตอบภายใน 1.0 วิ (เข้าเงื่อนไข Stagger + Parry)
   ประคองไม่ให้อสูรตายและไม่ให้ฮีโร่ตายระหว่างวัด */
async function answer(page, correct, fast, keepHp) {
  const r = await page.evaluate((o) => {
    const g = G;
    const m = g.currentMonster;
    if (!m) return null;
    if (o.keepHp) { g.monsterHp = Math.max(g.monsterHp, Math.round(g.monsterMaxHp * 0.9)); }
    g.shield = 0;
    g.questionStart = o.fast ? Date.now() : (Date.now() - 9000);
    g.locked = false;
    const hp0 = g.hp, mhp0 = g.monsterHp;
    const pick = o.correct ? m.answer : m.choices.filter(c => c !== m.answer)[0];
    resolveAnswer(pick, null, false);
    return { hp0: hp0, hp: g.hp, mhp0: mhp0, mhp: g.monsterHp,
             fb: (document.getElementById('gFeedback') || {}).textContent || '',
             a: baBattleAudit().hiTier };
  }, { correct: !!correct, fast: !!fast, keepHp: keepHp !== false });
  await page.waitForTimeout(1500);
  await clearOverlays(page);
  return r;
}

async function audit(page) { return await page.evaluate(() => baBattleAudit().hiTier); }

/* เปิดข้อใหม่แบบสด ๆ ให้ baFighting() เป็นจริงจริง ๆ (ไม่ล็อก · นาฬิกาเดินอยู่) */
async function liveQ(page) {
  return await page.evaluate(() => {
    G.locked = false;
    G.hp = G.maxHp;
    /* **ต้องล้างสถานะชะงักจาก Armor Break ของ v6.4 ด้วย** — การตั้งเลือดบอสเองใน
       เทสต์ทำให้เกราะแตกแล้วบอสยืนซวนเซ 4 วินาที ซึ่ง baFighting() นับเป็นเท็จ
       อย่างถูกต้อง แต่ไม่ใช่สิ่งที่เคสนี้ตั้งใจวัด (เจอมาแล้ว: ทุกองค์ประกอบของ
       baFighting ดูปกติหมดแต่ผลรวมยังเป็นเท็จ เพราะ wrapper ของ v6.4 อีกชั้น) */
    if (typeof BA_BREAK_UNTIL !== 'undefined') BA_BREAK_UNTIL = 0;
    try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}
    /* **ต้องพาจอกลับมาที่โซนโจทย์ด้วย** ไม่งั้น acQaVisible() ของ v4.8.1 เป็นเท็จ
       แล้ว baFighting() ก็เป็นเท็จตาม — เกจกับนับถอยหลังจะนิ่งโดยไม่เกี่ยวกับโค้ดเลย */
    try { acFocusQa(); acSync(true); } catch (e) {}
    return { f: baFighting(), qt: !!QUESTION_TIMER, locked: !!G.locked, warp: !!G.warpOpen,
             cm: !!G.currentMonster, paused: baPaused(), play: baCanPlay(),
             frz: !!(typeof FREEZE_TIMER !== 'undefined' && FREEZE_TIMER), st: baStOn() };
  });
}

(async () => {
  fs.writeFileSync(LOG, 'test_high_tier_boss · ' + new Date().toISOString() + '\n');
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
  await enter(page, 'ht01');

  // ═══ 1) ค่าคงที่ตรงสเปกทุกตัว ═══════════════════════════════════════
  blk('1 · ค่าคงที่ของสเปก');
  const K = await page.evaluate(() => ({
    stHits: BA_ST_HITS, stMs: BA_ST_MS, prMs: BA_PR_MS,
    trapP: BA_TRAP_P, trapFade: BA_TRAP_FADE,
    enAt: BA_EN_AT, enAtb: BA_EN_ATB, enHit: BA_EN_HIT, enDrain: BA_EN_DRAIN,
    ddAt: BA_DD_AT, ddMs: BA_DD_MS, ddNeed: BA_DD_NEED, ddHit: BA_DD_HIT
  }));
  ok(K.stHits === 3, 'Stagger ต้องตอบถูกเข้าเงื่อนไขติดกัน 3 ข้อ [' + K.stHits + ']');
  ok(K.stMs === 3000, 'Stagger นาน 3.0 วินาที [' + K.stMs + ']');
  ok(K.prMs === 1000, 'เส้น Speed Reflex 1.0 วินาที (ใช้ BA_PR_MS ของ v6.9) [' + K.prMs + ']');
  ok(K.trapFade === 1500, 'Vanishing Choices จางหายใน 1.5 วินาที [' + K.trapFade + ']');
  ok(K.trapP > 0 && K.trapP <= 100, 'โอกาสปล่อยกับดักอยู่ในช่วงที่ใช้ได้ [' + K.trapP + '%]');
  ok(K.enAt === 0.30, 'Enrage ที่เลือดต่ำกว่า 30% [' + K.enAt + ']');
  ok(K.enAtb === 1.5, 'Fast ATB เร็วขึ้น 1.5 เท่า [' + K.enAtb + ']');
  ok(K.enHit === 40, 'เคาน์เตอร์เฟสคลั่ง -40% HP [' + K.enHit + ']');
  ok(K.enDrain === 15, 'บอสดูดเลือดคืน +15% HP [' + K.enDrain + ']');
  ok(K.ddAt === 0.20, 'Doomsday ที่เลือดต่ำกว่า 20% [' + K.ddAt + ']');
  ok(K.ddMs === 10000, 'นับถอยหลัง 10.0 วินาที [' + K.ddMs + ']');
  ok(K.ddNeed === 2, 'ต้องตอบถูก 2 ข้อเพื่อขัดขวาง [' + K.ddNeed + ']');
  ok(K.ddHit === 60, 'ขัดขวางไม่ทัน -60% HP [' + K.ddHit + ']');

  // ═══ 2) Stagger — ตัวนับและเงื่อนไขกระตุ้น ══════════════════════════
  blk('2 · Stagger & Break — ตัวนับ');
  await goFloor(page, 8);
  const isBoss = await page.evaluate(() => baBattleAudit().hiTier.boss);
  ok(isBoss === true, 'ชั้น 8 ถูกนับเป็นไฟต์บอส');

  await page.evaluate(() => { critChance = () => 0; expDoubleChance = () => 0; });
  await page.evaluate(() => { baHtReset(); });

  const a1 = await answer(page, true, true);
  ok(a1.a.stagger.n === 1, 'ตอบถูกไวข้อที่ 1 → ตัวนับ 1 [' + a1.a.stagger.n + ']');
  const a2 = await answer(page, true, true);
  ok(a2.a.stagger.n === 2, 'ตอบถูกไวข้อที่ 2 → ตัวนับ 2 [' + a2.a.stagger.n + ']');
  const a3 = await audit(page);
  ok(a3.stagger.total === 0, 'ยังไม่ครบ 3 ข้อ จึงยังไม่ชะงัก [' + a3.stagger.total + ']');

  const a4 = await answer(page, true, false);
  ok(a4.a.stagger.n === 0, 'ตอบถูกแบบช้า (ไม่ไว ไม่คริต) → ตัวนับถูกล้าง [' + a4.a.stagger.n + ']');

  await answer(page, true, true);
  const a5 = await answer(page, false, false);
  ok(a5.a.stagger.n === 0, 'ตอบผิด → ตัวนับถูกล้าง [' + a5.a.stagger.n + ']');

  blk('2.1 · Stagger — กระตุ้นจริง');
  await goFloor(page, 8);
  await page.evaluate(() => { critChance = () => 0; baHtReset(); });
  await answer(page, true, true);
  await answer(page, true, true);
  const st = await answer(page, true, true);
  /* **Patch v8.2 · Wave 5 Super-Boss Tier ให้บอสประจำชั้นภูมิคุ้มกันสตัน 100%**
     ตัวนับยังเดินครบสามข้อตามเดิม แต่ baStFire ถูกปิดที่ต้นทาง บอสจึงไม่ชะงัก
     และขึ้นแบนเนอร์ STUN IMMUNE แทน · Stagger ยังทำงานเต็มรูปแบบในไฟต์ทัพเงา
     (ซึ่งไม่ใช่ Wave 5) ซึ่งชุดของ v8.1 เป็นคนพิสูจน์ */
  ok(st.a.stagger.total === 0, 'บอสประจำชั้นภูมิคุ้มกันสตัน — ไม่ชะงักสักครั้ง [' + st.a.stagger.total + ']');
  ok(st.a.stagger.on === false, 'สถานะชะงักไม่ติด (ภูมิคุ้มกัน 100%)');
  ok(/STUN IMMUNE/.test(await page.evaluate(() => (document.getElementById('baSkill') || {}).textContent || '')),
     'แบนเนอร์ STUN IMMUNE ขึ้นบอกผู้เล่นว่าคอมโบนับติดแต่บอสสลัดทิ้ง');
  ok(st.a.stagger.n === 0, 'ตัวนับถูกล้างหลังกระตุ้น [' + st.a.stagger.n + ']');

  blk('2.2 · Stagger — คริติคอลก็เข้าเงื่อนไข');
  await goFloor(page, 8);
  await page.evaluate(() => { critChance = () => 100; baHtReset(); });
  const c1 = await answer(page, true, false);
  ok(c1.a.stagger.n === 1, 'ตอบถูกแบบคริต (แต่ช้า) ก็นับ [' + c1.a.stagger.n + ']');
  await page.evaluate(() => { critChance = () => 0; });

  blk('2.3 · Stagger — ผลระหว่างชะงัก (วัดในไฟต์ทัพเงา)');
  /* **Patch v8.2 ให้บอสประจำชั้นภูมิคุ้มกันสตัน 100%** — ผลของ Stagger จึงต้อง
     ไปวัดในไฟต์ที่ยังโดนสตันได้ คือไฟต์ทัพเงา (baShNow() ไม่เป็น null) ซึ่ง
     Micro-Patch เหวลึกขั้นสุดทำให้ถูกนับเป็นไฟต์บอสของ v7.0 อยู่แล้ว
     บังคับให้ผู้บุกรุกโผล่ที่มอนสเตอร์ตัวแรกของชั้น แล้วกลไกที่เหลือของ v6.6
     จะพาสไปรต์/สกิล/สถานะมาให้ครบเอง */
  await goFloor(page, 8);
  await page.evaluate(() => {
    BA_INC_F = 8; BA_INC_AT = 0; BA_INC_ID = BA_SH_MINI[0];
    G.floorProgress = 0;
    nextMonster();
  });
  await page.waitForTimeout(280);
  await clearOverlays(page);
  const shadowOn = await page.evaluate(() => !!baShNow() && baHtBoss() === true);
  ok(shadowOn, 'ตั้งฉากได้: ยืนอยู่หน้าทัพเงา และยังนับเป็นไฟต์บอสของ v7.0');
  const liveOk = await liveQ(page);
  ok(liveOk.f === true, 'ตั้งฉากทดสอบได้: มีข้อสด ๆ และ baFighting() เป็นจริง ' + JSON.stringify(liveOk));
  const froze = await page.evaluate(() => {
    const before = baFighting();
    baStFire();
    const after = baFighting();
    return { before: before, after: after, supp: BA_RS_SUPP > Date.now(),
             cls: !!(baArena() && baArena().classList.contains('ba-stagger')) };
  });
  ok(froze.before === true, 'ก่อนชะงัก baFighting() เป็นจริง (เกจเดินอยู่)');
  ok(froze.after === false, 'ระหว่างชะงัก baFighting() เป็นเท็จ → เกจทั้งสามหลอดแช่แข็ง');
  ok(froze.supp === true, 'ระหว่างชะงัก รีเจนของ v6.7 ถูกระงับ (BA_RS_SUPP)');
  ok(froze.cls === true, 'กรอบสนามติดคลาส ba-stagger ให้เห็นบนจอ');

  const gauges = await page.evaluate(async () => {
    const a0 = BA_ATB, b0 = BA_BAT, c0 = BA_CUR;
    for (let i = 0; i < 6; i++) { baAtbTick(); baBatTick(); await new Promise(r => setTimeout(r, 90)); }
    return { atb: BA_ATB - a0, bat: BA_BAT - b0, cur: BA_CUR - c0 };
  });
  ok(gauges.atb === 0 && gauges.bat === 0 && gauges.cur === 0,
     'ปล่อยเวลาผ่านไประหว่างชะงัก เกจทั้งสามหลอดไม่ขยับเลย [' +
     gauges.atb.toFixed(2) + '/' + gauges.bat.toFixed(2) + '/' + gauges.cur.toFixed(2) + ']');

  const gate = await page.evaluate(() => {
    const hp = G.monsterHp;
    const raw = Math.round(G.monsterMaxHp * 0.9);      /* ยอดที่เกินเพดานแน่นอน */
    const onSt = baRsGate(raw, false, false);
    G.monsterHp = hp;
    BA_ST_UNTIL = 0;                                    /* ปลดชะงักแล้ววัดซ้ำ */
    const offSt = baRsGate(raw, false, false);
    G.monsterHp = hp;
    return { onSt: onSt, offSt: offSt, raw: raw };
  });
  ok(gate.onSt === gate.raw, 'ระหว่างชะงัก Damage Gate ถูกปลดล็อก — ดาเมจเข้าเต็ม 100% [' +
     gate.onSt + '/' + gate.raw + ']');
  ok(gate.offSt < gate.raw, 'พ้นสถานะชะงักแล้ว เพดานดาเมจของ v6.7 กลับมาทำงาน [' +
     gate.offSt + '/' + gate.raw + ']');

  const gone = await page.evaluate(async () => {
    baStFire();
    await new Promise(r => setTimeout(r, BA_ST_MS + 220));
    return { on: baStOn(), cls: !!(baArena() && baArena().classList.contains('ba-stagger')),
             fight: baFighting() };
  });
  ok(gone.on === false, 'ครบ 3.0 วินาที สถานะชะงักหมดอายุเอง');
  ok(gone.cls === false, 'คลาส ba-stagger ถูกถอดคืนเอง');

  blk('2.4 · Stagger — ไม่ทำงานนอกไฟต์บอส');
  await goFloor(page, 2);
  await page.evaluate(() => { baHtReset(); critChance = () => 0; });
  await answer(page, true, true);
  await answer(page, true, true);
  const nb = await answer(page, true, true);
  ok(nb.a.boss === false, 'ชั้น 2 ไม่ใช่ไฟต์บอส');
  ok(nb.a.stagger.total === 0 && nb.a.stagger.n === 0,
     'ชั้นธรรมดาตอบไวติดกัน 3 ข้อก็ไม่ทำให้ชะงัก [' + nb.a.stagger.total + ']');

  // ═══ 3) Question Traps ═════════════════════════════════════════════
  blk('3 · Question Traps');
  await goFloor(page, 12);
  const trapRoll = await page.evaluate(() => {
    let mir = 0, van = 0, none = 0, calls = 0;
    const _r = Math.random;
    Math.random = function () { calls++; return _r.apply(this, arguments); };
    for (let i = 0; i < 400; i++) {
      const k = baTrapRoll();
      if (k === 'mirror') mir++; else if (k === 'vanish') van++; else none++;
    }
    Math.random = _r;
    baTrapClear();
    return { mir: mir, van: van, none: none, calls: calls };
  });
  const hitRate = (trapRoll.mir + trapRoll.van) / 400 * 100;
  ok(Math.abs(hitRate - K.trapP) <= 6,
     'อัตราปล่อยกับดักราว ' + K.trapP + '% [วัดได้ ' + hitRate.toFixed(1) + '%]');
  ok(trapRoll.mir > 0 && trapRoll.van > 0, 'ออกทั้งสองแบบจริง [🪞' + trapRoll.mir + ' 👻' + trapRoll.van + ']');
  ok(trapRoll.calls === 0, 'ตัวสุ่มกับดักไม่แตะ Math.random สักครั้ง (กับดักข้อ 32) [' + trapRoll.calls + ']');

  /* **ต้องรอ transition ให้จบก่อนอ่าน computed transform** ไม่งั้นจะได้
     "ค่าเริ่มต้นของทรานซิชัน" (matrix เอกลักษณ์) ไม่ใช่ค่าปลายทาง — บทเรียนของชุด v6.5 */
  await page.evaluate(() => { baTrapClear(); baScreen().classList.add('ba-cipher'); BA_TRAP_NOW = 'mirror'; });
  await page.waitForTimeout(320);
  const mir = await page.evaluate(() => {
    const w = document.getElementById('gWord');
    const p = document.getElementById('gPinyin');
    return { w: getComputedStyle(w).transform, p: getComputedStyle(p).transform,
             a: baBattleAudit().hiTier.trap };
  });
  ok(/matrix\(-1,/.test(mir.w), 'Mirror Cipher พลิกอักษรจีนแนวนอนจริง [' + mir.w + ']');
  ok(/matrix\(-1,/.test(mir.p), 'Mirror Cipher พลิกพินอินด้วย [' + mir.p + ']');
  ok(mir.a.mirror === true && mir.a.now === 'mirror', 'ทางเข้าเทสต์รายงานกับดักที่ติดอยู่ถูกต้อง');

  const van = await page.evaluate(() => {
    baTrapClear();
    const ch = document.getElementById('gChoices');
    ch.classList.add('ba-vanish');
    BA_TRAP_NOW = 'vanish';
    const b = ch.querySelector('.g-choice');
    const cs = b ? getComputedStyle(b) : null;
    return { name: cs ? cs.animationName : '', dur: cs ? cs.animationDuration : '',
             fill: cs ? cs.animationFillMode : '', pe: cs ? cs.pointerEvents : '',
             it: cs ? cs.animationIterationCount : '' };
  });
  ok(van.name === 'baVanish', 'Vanishing Choices ใส่อนิเมชันจางหายจริง [' + van.name + ']');
  ok(van.dur === '1.5s', 'จางหายภายใน 1.5 วินาที [' + van.dur + ']');
  ok(van.fill === 'forwards', 'จางแล้วค้างไว้ (forwards) [' + van.fill + ']');
  ok(van.it === '1', 'ไม่ใช่อนิเมชันวนไม่รู้จบ (กับดักข้อ 31) [' + van.it + ']');
  ok(van.pe !== 'none', 'ปุ่มยังกดได้ระหว่างจางหาย [' + van.pe + ']');

  const clr = await page.evaluate(() => {
    const ch = document.getElementById('gChoices');
    ch.classList.add('ba-vanish');
    baScreen().classList.add('ba-cipher');
    clearQuestionTimer();
    const midVan = ch.classList.contains('ba-vanish');
    startQuestionTimer();
    return { midVan: midVan,
             mirror: baScreen().classList.contains('ba-cipher'),
             vanish: ch.classList.contains('ba-vanish') };
  });
  ok(clr.midVan === false, 'ข้อจบแล้วตัวเลือกกลับมาให้เห็น (ไม่บังแถบเฉลย)');
  await page.evaluate(() => { baTrapClear(); });

  const cleanse = await page.evaluate(() => {
    baScreen().classList.add('ba-cipher');
    BA_TRAP_NOW = 'mirror';
    const n = baCbCleanse();
    return { n: n, now: BA_TRAP_NOW, cls: baScreen().classList.contains('ba-cipher') };
  });
  ok(cleanse.now === '' && cleanse.cls === false,
     'Parry ของ v6.9 ล้างกับดักของ v7.0 ให้ด้วย');

  const noTrap = await page.evaluate(() => {
    G.floor = 2; baTrapClear();
    let n = 0;
    for (let i = 0; i < 300; i++) if (baTrapRoll()) n++;
    baTrapClear();
    return n;
  });
  ok(noTrap === 0, 'ชั้นที่ไม่ใช่บอสไม่มีกับดักเลยสักครั้ง [' + noTrap + ']');

  // ═══ 4) Enrage Berserk ═════════════════════════════════════════════
  blk('4 · Enrage Berserk (เลือด < 30%)');
  await goFloor(page, 16);
  const en0 = await page.evaluate(() => ({ on: baEnOn(), bat: baBatFull() }));
  await setHp(page, 0.5);
  const en1 = await page.evaluate(() => ({ on: baEnOn(), bat: baBatFull() }));
  ok(en1.on === false, 'เลือด 50% ยังไม่เข้าเฟสคลั่ง');
  await setHp(page, 0.25);
  const en2 = await page.evaluate(() => ({ on: baEnOn(), bat: baBatFull(),
                                           ann: baBattleAudit().hiTier.enrage.announced }));
  ok(en2.on === true, 'เลือด 25% เข้าเฟสคลั่ง');
  ok(en2.ann === true, 'ประกาศเฟสคลั่งให้ผู้เล่นเห็นแล้ว');
  ok(Math.abs(en2.bat - Math.round(en1.bat / 1.5)) <= 1,
     'หลอด Fast ATB เร็วขึ้น 1.5 เท่า [' + en1.bat + ' → ' + en2.bat + ']');

  await page.evaluate(() => { G.hp = G.maxHp; renderStats(); });
  const enHit = await answer(page, false, false, false);
  const lost = enHit.hp0 - enHit.hp;
  const base = await page.evaluate(() => ({ mx: G.maxHp, pct: baPct(BA_EN_HIT) }));
  ok(lost > base.pct, 'ตอบผิดในเฟสคลั่ง เสีย HP มากกว่าดาเมจปกติ (โดนเคาน์เตอร์ซ้ำ) [' +
     lost + ' > ' + base.pct + ']');
  ok(/ENRAGE/.test(enHit.fb), 'บรรทัดผลลัพธ์บอกว่าโดนเคาน์เตอร์เฟสคลั่ง');
  ok(enHit.mhp > enHit.mhp0, 'บอสดูดเลือดฟื้นตัวเองจริง [' + enHit.mhp0 + ' → ' + enHit.mhp + ']');

  const noEn = await page.evaluate(() => {
    G.floor = 2; G.monsterHp = Math.round(G.monsterMaxHp * 0.1);
    const r = baEnOn();
    G.floor = 16;
    return r;
  });
  ok(noEn === false, 'ชั้นธรรมดาเลือดเหลือ 10% ก็ไม่เข้าเฟสคลั่ง');

  // ═══ 5) Doomsday DPS Check ═════════════════════════════════════════
  blk('5 · Doomsday DPS Check (เลือด < 20%)');
  await goFloor(page, 16);
  await page.evaluate(() => { baHtReset(); });
  await setHp(page, 0.25);
  const d0 = await audit(page);
  ok(d0.doom.on === false, 'เลือด 25% ยังไม่ร่ายมหาเวท');
  await setHp(page, 0.15);
  const d1 = await audit(page);
  ok(d1.doom.on === true, 'เลือด 15% บอสเริ่มร่ายมหาเวท');
  ok(d1.doom.left > 9000, 'นับถอยหลังเริ่มที่ ~10 วินาที [' + (d1.doom.left / 1000).toFixed(1) + ' วิ]');
  ok(d1.doom.shown === true, 'แถบนับถอยหลังโผล่กลางจอ');

  const bar = await page.evaluate(() => {
    const el = document.getElementById('baDoom');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { pos: cs.position, pe: cs.pointerEvents, z: cs.zIndex,
             w: r.width, vw: window.innerWidth,
             sw: document.body.scrollWidth, iw: window.innerWidth };
  });
  ok(bar.pos === 'fixed', 'แถบนับถอยหลังเป็น position:fixed (ไม่กินเลย์เอาต์) [' + bar.pos + ']');
  ok(bar.pe === 'none', 'แถบนับถอยหลังไม่ขวางการกดปุ่ม [' + bar.pe + ']');
  ok(Number(bar.z) === 146, 'z-index 146 — เหนือจอมืด (145) แต่ใต้ม่านหยุดเกม (190) [' + bar.z + ']');
  ok(bar.w <= bar.vw, 'แถบไม่กว้างเกินจอ [' + Math.round(bar.w) + '/' + bar.vw + ']');
  ok(bar.sw <= bar.iw, 'มีแถบอยู่แล้วเลย์เอาต์ยังไม่ล้นแนวนอน [' + bar.sw + '/' + bar.iw + ']');

  const pause = await page.evaluate(async () => {
    G.locked = true;                       /* เกมไม่ได้อยู่ในสถานะสู้ */
    const a = BA_DD_LEFT;
    await new Promise(r => setTimeout(r, 700));
    const b = BA_DD_LEFT;
    G.locked = false;
    return { a: a, b: b };
  });
  ok(pause.a === pause.b, 'เกมไม่ได้อยู่ในสถานะสู้ นับถอยหลังหยุดนิ่ง (ไม่ทบเวลา) [' +
     pause.a + '→' + pause.b + ']');

  const fighting = await liveQ(page);
  ok(fighting.f === true, 'เปิดข้อใหม่แล้ว baFighting() กลับมาเป็นจริง ' + JSON.stringify(fighting));
  const run = await page.evaluate(async () => {
    const a = BA_DD_LEFT;
    await new Promise(r => setTimeout(r, 700));
    return { a: a, b: BA_DD_LEFT, fight: baFighting() };
  });
  ok(run.b < run.a, 'กลับมาสู้แล้วนับถอยหลังเดินต่อ [' + run.a + '→' + run.b +
     ' · fighting=' + run.fight + ']');

  const intr = await page.evaluate(() => {
    BA_DD_FRESH = false;
    G.monsterHp = Math.round(G.monsterMaxHp * 0.15);
    G.locked = false;
    const m = G.currentMonster;
    G.questionStart = Date.now() - 5000;
    resolveAnswer(m.answer, null, false);
    return baBattleAudit().hiTier.doom;
  });
  ok(intr.hits === 1 && intr.on === true, 'ตอบถูกข้อแรกระหว่างร่าย → นับ 1/2 แล้วยังร่ายอยู่ [' +
     intr.hits + '/' + intr.need + ']');
  await page.waitForTimeout(1400);
  await clearOverlays(page);

  const intr2 = await page.evaluate(() => {
    BA_DD_FRESH = false;
    G.monsterHp = Math.round(G.monsterMaxHp * 0.15);
    G.locked = false;
    const m = G.currentMonster;
    G.questionStart = Date.now() - 5000;
    resolveAnswer(m.answer, null, false);
    const a = baBattleAudit().hiTier.doom;
    return { a: a, fb: (document.getElementById('gFeedback') || {}).textContent || '' };
  });
  ok(intr2.a.on === false, 'ตอบถูกครบ 2 ข้อ → ขัดขวางมหาเวทสำเร็จ');
  ok(intr2.a.next > Date.now(), 'ขัดขวางแล้วต้องเว้นระยะก่อนร่ายซ้ำ (ไม่ร่ายรัว)');
  ok(/ขัดขวาง/.test(intr2.fb), 'บรรทัดผลลัพธ์บอกว่าขัดขวางสำเร็จ');
  await page.waitForTimeout(1400);
  await clearOverlays(page);

  blk('5.1 · Doomsday — ขัดขวางไม่ทัน');
  await goFloor(page, 16);
  await page.evaluate(() => { baHtReset(); });
  const boom = await page.evaluate(() => {
    G.hp = G.maxHp; G.shield = 0;
    G.monsterHp = Math.round(G.monsterMaxHp * 0.15);
    renderMonsterHp();
    const hp0 = G.hp;
    const want = baPct(BA_DD_HIT);
    baDdBoom();
    return { hp0: hp0, hp: G.hp, want: want, on: baDdOn(),
             next: BA_DD_NEXT > Date.now() };
  });
  ok(boom.hp0 - boom.hp === boom.want,
     'ขัดขวางไม่ทัน → ฮีโร่เสีย HP 60% ของหลอดพอดี [' + (boom.hp0 - boom.hp) + '/' + boom.want + ']');
  ok(boom.on === false, 'มหาเวทลงแล้วการร่ายจบลง');
  ok(boom.next === true, 'ร่ายจบแล้วเว้นระยะก่อนร่ายซ้ำ');
  await page.waitForTimeout(1200);
  await clearOverlays(page);

  const noDd = await page.evaluate(() => {
    G.floor = 2;
    G.monsterHp = Math.round(G.monsterMaxHp * 0.05);
    baHtReset();
    renderMonsterHp();
    const r = baDdOn();
    G.floor = 16;
    return r;
  });
  ok(noDd === false, 'ชั้นธรรมดาเลือดเหลือ 5% ก็ไม่มี Doomsday');

  // ═══ 6) โหมดฝึกจุดอ่อน + การล้างสถานะ ═══════════════════════════════
  blk('6 · โหมดฝึกจุดอ่อน · การล้างสถานะ');
  const pm = await page.evaluate(() => {
    G.practiceMode = true;
    const r = { boss: baHtBoss(), en: baEnOn(), trap: baTrapRoll() };
    G.practiceMode = false;
    return r;
  });
  ok(pm.boss === false && pm.en === false && pm.trap === '',
     'โหมดฝึกจุดอ่อนไม่มีกลไกของชั้นนี้เลยสักอย่าง');

  await goFloor(page, 16);
  const reset = await page.evaluate(() => {
    baStFire();
    baScreen().classList.add('ba-cipher');
    BA_TRAP_NOW = 'mirror';
    BA_DD_LEFT = 5000;
    baClearFight();
    return { st: baStOn(), trap: BA_TRAP_NOW, dd: baDdOn(),
             cls: baScreen().classList.contains('ba-cipher'),
             arena: !!(baArena() && baArena().classList.contains('ba-stagger')) };
  });
  ok(reset.st === false && reset.trap === '' && reset.dd === false &&
     reset.cls === false && reset.arena === false,
     'เปลี่ยนไฟต์ → สถานะของชั้นนี้ถูกล้างครบทุกตัว');

  const exited = await page.evaluate(() => {
    baStFire(); BA_DD_LEFT = 5000;
    exitGame();
    return { st: baStOn(), dd: baDdOn(), t: !!BA_DD_T,
             shown: !!(document.getElementById('baDoom') || {}).classList &&
                    document.getElementById('baDoom').classList.contains('on') };
  });
  ok(exited.st === false && exited.dd === false && exited.t === false && exited.shown === false,
     'ออกจากเกม → นาฬิกาดับและแถบนับถอยหลังถูกซ่อนครบ');

  // ═══ 7) ความปลอดภัยรวม ═════════════════════════════════════════════
  blk('7 · ความปลอดภัยรวม');
  const net = await page.evaluate(() => (window.__NET || []).length);
  ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุด [' + errs.slice(0, 2).join(' | ') + ']');
  const el = await page.evaluate(() => ({ w: document.body.scrollWidth, v: window.innerWidth }));
  ok(el.w <= el.v, 'เลย์เอาต์ไม่ล้นแนวนอน [' + el.w + '/' + el.v + ']');
  const bad = await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
            .filter(e => /^(ht|st|en|dd|trap)[A-Z]|install70/.test(String(e && e.where || ''))).length; }
    catch (e) { return -1; }
  });
  ok(bad === 0, 'Error Log ไม่มีรายการของชั้น v7.0 [' + bad + ']');
  fs.appendFileSync(LOG, '\n(คำขอเน็ตที่ถูก stub ไว้ ' + net + ' ครั้ง)\n');

  fs.appendFileSync(LOG, '\n══ สรุป ══\n✅ ผ่าน ' + pass + '\n❌ ตก ' + fail + '\n');
  console.log('\n══ สรุป ══  ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
