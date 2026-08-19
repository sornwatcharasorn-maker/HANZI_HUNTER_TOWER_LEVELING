/* test_telegraph_grace.js — ชุดเทสต์ของ Patch v6.11
   (Attack Telegraphing · Anti-Chain Stun · Debuff Timing Audit)

   NODE_PATH=/opt/node22/lib/node_modules node test_telegraph_grace.js

   ทุกเคสวัดจาก **ไฟล์แจก** ที่รากrepo ตามกติกาของ repo (ต้อง build ก่อนรันเสมอ)  */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_telegraph_grace.log');
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

/* พาไปยืนชั้นที่ต้องการ — **ปิดระบบบุกรุกของ v6.6 ทุกครั้ง**
   (กติกาเดิมของชุด v6.2/v6.3/v6.5/v6.7/v6.8/v7.0) */
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

/* เปิดข้อใหม่แบบสด ๆ ให้ baFighting() เป็นจริงจริง ๆ */
async function liveQ(page) {
  const r = await page.evaluate(() => {
    G.locked = false;
    G.hp = G.maxHp;
    /* Armor Break ของ v6.4 ทำให้ baFighting() เป็นเท็จโดยชอบธรรม — ไม่ใช่สิ่งที่วัด */
    if (typeof BA_BREAK_UNTIL !== 'undefined') BA_BREAK_UNTIL = 0;
    if (typeof BA_ST_UNTIL !== 'undefined') BA_ST_UNTIL = 0;
    try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}
    try { acFocusQa(); acSync(true); } catch (e) {}
    return { f: baFighting(), qt: !!QUESTION_TIMER };
  });
  await page.waitForTimeout(120);
  return r;
}

async function A(page) { return await page.evaluate(() => baBattleAudit()); }

(async () => {
  fs.writeFileSync(LOG, 'test_telegraph_grace · ' + new Date().toISOString() + '\n');
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
  await enter(page, 'tg01');

  // ═══ 1) ค่าคงที่ตรงสเปกทุกตัว ═══════════════════════════════════════
  blk('1 · ค่าคงที่ของสเปก');
  const K = await page.evaluate(() => ({
    lead: BA_TG_LEAD, gap: BA_TG_GAP, gp: BA_GP_MS,
    blkBoss: BA_DB_BLK_BOSS, blkMini: BA_DB_BLK_MINI, seal: BA_DB_SEAL_MS,
    tone: BA_TG_TONE.glint_ping,
    curBlk: BA_CUR_BLK, curSeal: BA_CUR_SEAL, shFlare: BA_SH_FLARE_MS
  }));
  ok(K.lead === 500, 'เตือนล่วงหน้า 0.5 วินาที [' + K.lead + ']');
  ok(K.gp === 1500, 'Grace Period 1.5 วินาที [' + K.gp + ']');
  ok(K.blkBoss === 2000, 'จอดำของบอส 2.0 วินาที [' + K.blkBoss + ']');
  ok(K.blkMini === 1500, 'จอดำของมินิบอส 1.5 วินาที [' + K.blkMini + ']');
  ok(K.seal === 4000, 'Seal of Silence 4.0 วินาที [' + K.seal + ']');
  ok(K.tone === 'BA_TG_PING', 'รหัสเสียง glint_ping แปลงเป็นคีย์ในคลังได้ [' + K.tone + ']');
  ok(K.curBlk === 2000 && K.curSeal === 4000,
     'ค่าของ v6.8 ยังตรงกับสเปกเดิม [blk=' + K.curBlk + ' seal=' + K.curSeal + ']');
  ok(K.shFlare === 1500, 'Blackout Flare ของมินิบอส v6.6 ยังเป็น 1.5 วินาที [' + K.shFlare + ']');

  const S = await page.evaluate(() => {
    const d = (typeof AU_SFX_DEF !== 'undefined' && AU_SFX_DEF) ? AU_SFX_DEF.BA_TG_PING : null;
    return { has: !!d, n: d && d.v ? d.v.length : 0, w: d && d.v ? d.v[0].w : '' };
  });
  ok(S.has, 'เสียง glint_ping ถูกลงทะเบียนในคลังของ v5.1 แล้ว');
  ok(S.n >= 2 && S.w === 'sine', 'เสียงสังเคราะห์ล้วน (พาร์เชียล ' + S.n + ' ชั้น · ' + S.w + ')');

  // ═══ 2) Attack Telegraphing ═════════════════════════════════════════
  blk('2 · Attack Telegraphing');
  await goFloor(page, 12);          /* ชั้นบอส — มีทั้ง Fast ATB และ Curse Gauge */
  await liveQ(page);

  const mount = await page.evaluate(() => {
    const el = document.getElementById('baTgEye');
    const cs = el ? getComputedStyle(el) : null;
    return { has: !!el, pe: cs ? cs.pointerEvents : '', pos: cs ? cs.position : '',
             kids: el ? el.children.length : 0,
             inFoe: !!(el && el.closest('#baFoe')) };
  });
  ok(mount.has && mount.inFoe, 'overlay ตาบอสถูกแทรกไว้ใน #baFoe แล้ว');
  ok(mount.pe === 'none', 'overlay เป็น pointer-events:none ตามสเปก [' + mount.pe + ']');
  ok(mount.pos === 'absolute', 'overlay เป็น absolute จึงไม่กินเลย์เอาต์ [' + mount.pos + ']');
  ok(mount.kids === 2, 'มีดวงตาสองดวง [' + mount.kids + ']');

  /* กันแทรกซ้ำ (กับดักข้อ 2) */
  const dup = await page.evaluate(() => {
    for (let i = 0; i < 20; i++) baTgEnsure();
    return document.querySelectorAll('#baFoe .ba-tg').length;
  });
  ok(dup === 1, 'เรียก baTgEnsure() ซ้ำ 20 รอบแล้วยังเหลือ overlay ใบเดียว [' + dup + ']');

  /* เกจยังไกลจากเต็ม = ต้องไม่เตือน */
  const far = await page.evaluate(() => {
    BA_BAT = 0; BA_CUR = 0; BA_TG_ON = false; BA_TG_AT = 0;
    baTgSync();
    return baBattleAudit().telegraph;
  });
  ok(far.on === false && far.shown === false, 'เกจยังไกลจากเต็ม = ไม่เตือน');
  ok(far.left > 500, 'เวลาที่เหลือคำนวณได้ถูกต้อง [' + Math.round(far.left) + 'ms]');

  /* ดันเกจ Fast ATB ให้เหลือ ~0.3 วิ = ต้องเตือน + ยิงเสียง */
  const near = await page.evaluate(() => {
    const hits = [];
    const _p = auPlay; auPlay = function (k) { hits.push(k); return _p.apply(this, arguments); };
    const full = baBatFull();
    BA_BAT = 100 - (300 / full * 100);      /* เหลืออีก ~300ms */
    BA_CUR = 0;
    BA_TG_ON = false; BA_TG_AT = 0;
    baTgSync();
    const a = baBattleAudit().telegraph;
    auPlay = _p;
    return { a: a, hits: hits, full: full };
  });
  ok(near.a.left <= 500, 'Fast ATB เหลือน้อยกว่า 0.5 วิ [' + Math.round(near.a.left) + 'ms]');
  ok(near.a.on === true, 'เข้าหน้าต่างเตือนแล้ว');
  ok(near.a.shown === true, 'ไฟแดงที่ตาบอสถูกเปิดจริง (คลาส on)');
  ok(near.hits.indexOf('BA_TG_PING') !== -1, 'ยิงเสียง glint_ping แล้ว [' + near.hits.join(',') + ']');

  /* edge-trigger — อยู่ในหน้าต่างเดิมต้องไม่ยิงเสียงซ้ำ */
  const again = await page.evaluate(() => {
    const hits = [];
    const _p = auPlay; auPlay = function (k) { hits.push(k); return _p.apply(this, arguments); };
    for (let i = 0; i < 8; i++) baTgSync();
    auPlay = _p;
    return { hits: hits, n: baBattleAudit().telegraph.n };
  });
  ok(again.hits.length === 0, 'เรียกซ้ำในหน้าต่างเดิม = ไม่ยิงเสียงซ้ำ [' + again.hits.length + ']');

  /* ตอบถูกดันเกจถอย → ออกจากหน้าต่างเตือน → ไฟต้องดับ */
  const off = await page.evaluate(() => {
    BA_BAT = 0; BA_CUR = 0;
    baTgSync();
    return baBattleAudit().telegraph;
  });
  ok(off.on === false && off.shown === false, 'เกจถูกดันถอย = ไฟเตือนดับเอง');

  /* หลอดคำสาปก็ต้องเตือนได้เหมือนกัน */
  const cur = await page.evaluate(() => {
    BA_BAT = 0;
    BA_CUR = 100 - (300 / BA_CUR_MS * 100);
    BA_TG_ON = false; BA_TG_AT = 0;
    baTgSync();
    return { a: baBattleAudit().telegraph, on: baCurOn() };
  });
  ok(cur.on === true, 'ชั้น 12 เป็นไฟต์บอส หลอดคำสาปจึงทำงาน');
  ok(cur.a.on === true && cur.a.shown === true, 'หลอดคำสาปใกล้เต็มก็เตือนเหมือนกัน');

  /* ไฟต์ทั่วไปต้องไม่ถูกเตือนจากหลอดคำสาปที่ไม่มีอยู่บนจอ */
  await goFloor(page, 2);
  await liveQ(page);
  const plain = await page.evaluate(() => {
    BA_BAT = 0; BA_CUR = 99; BA_TG_ON = false;
    baTgSync();
    return { cur: baCurOn(), a: baBattleAudit().telegraph };
  });
  ok(plain.cur === false, 'ชั้น 2 ไม่ใช่ไฟต์บอส = ไม่มีหลอดคำสาป');
  ok(plain.a.on === false, 'ไฟต์ทั่วไปไม่ถูกเตือนจากหลอดคำสาปที่ไม่ได้ใช้');

  /* ไม่มี infinite animation (กับดักข้อ 31) */
  const anim = await page.evaluate(() => {
    const el = document.getElementById('baTgEye');
    if (!el || !el.firstElementChild) return { it: '', ok: false };
    const cs = getComputedStyle(el.firstElementChild);
    return { it: cs.animationIterationCount, name: cs.animationName };
  });
  ok(anim.it !== 'infinite', 'อนิเมชันไฟเตือนมีจำนวนรอบตายตัว ไม่ใช่ infinite [' + anim.it + ']');

  // ═══ 3) Debuff Timing — จอดำ ════════════════════════════════════════
  blk('3 · Debuff Timing · จอดำ');
  await goFloor(page, 12);
  await liveQ(page);

  const blkBoss = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0;
    G.streak = 0;                       /* กัน Clarity Mind ของ v6.9 */
    const d = baBlackout(9999);         /* ขอมาเกินจริง — ต้องถูกหนีบเป็น 2.0 วิ */
    const el = document.getElementById('baBlack');
    return { d: d, on: !!(el && el.classList.contains('on')),
             a: baBattleAudit().debuff };
  });
  ok(blkBoss.d === 2000, 'ไฟต์บอส → จอดำถูกหนีบเป็น 2.0 วิ เป๊ะ [' + blkBoss.d + ']');
  ok(blkBoss.on === true, 'จอดำถูกเปิดจริง');
  ok(blkBoss.a.blackArmed === true, 'นาฬิกาของแพตช์นี้ถูกติดอาวุธแล้ว');

  /* หัวใจของการซ่อม — baClearFx() ฆ่านาฬิกาของ v6.3 ทิ้งได้ แต่ฆ่าของเราไม่ได้ */
  const survive = await page.evaluate(() => {
    baClearFx();                        /* คือสิ่งที่ renderMonster ทำทุกครั้งที่เปลี่ยนโจทย์ */
    const el = document.getElementById('baBlack');
    return { on: !!(el && el.classList.contains('on')),
             armed: baBattleAudit().debuff.blackArmed };
  });
  ok(survive.on === true && survive.armed === true,
     'baClearFx() ฆ่านาฬิกาจอดำของแพตช์นี้ไม่ได้ (ต้นตอของบั๊คเดิม)');

  await page.waitForTimeout(2200);
  const blkEnd = await page.evaluate(() => {
    const el = document.getElementById('baBlack');
    return { on: !!(el && el.classList.contains('on')), a: baBattleAudit() };
  });
  ok(blkEnd.on === false, 'จอดำถอดคืนตรงเวลา 2.0 วิ เป๊ะ');
  ok(blkEnd.a.debuff.blackEnd === 0 && blkEnd.a.debuff.blackArmed === false,
     'ไม่มี timeout ตกค้างหลังจอดำหมดอายุ');
  ok(blkEnd.a.grace.on === true, 'หลุดจากจอดำแล้วได้ Grace Period ทันที');

  /* จอดำต้องรอดข้ามการเปลี่ยนโจทย์ (Dynamic Question Flow ของ v6.8) */
  const acrossQ = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0; G.streak = 0;
    baBlackout(2000);
    try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}   /* = ขึ้นข้อใหม่ */
    const el = document.getElementById('baBlack');
    return { on: !!(el && el.classList.contains('on')), a: baBattleAudit().debuff };
  });
  ok(acrossQ.on === true && acrossQ.a.blackArmed === true,
     'เปลี่ยนข้อกลางจอดำ → จอยังดำอยู่และนาฬิกาถูกตั้งใหม่ให้ตรงเวลาที่เหลือ');
  ok(acrossQ.a.blackLeft <= 2000, 'เวลาที่เหลือไม่ถูกรีเซ็ตเป็น 2.0 วิ ใหม่ [' +
     Math.round(acrossQ.a.blackLeft) + 'ms]');
  await page.waitForTimeout(2200);
  const acrossEnd = await page.evaluate(() => {
    const el = document.getElementById('baBlack');
    return !!(el && el.classList.contains('on'));
  });
  ok(acrossEnd === false, 'จอดำที่ข้ามข้อมาก็ยังหมดอายุตรงเวลา ไม่ค้างถาวร');

  /* มินิบอสของทัพเงา = 1.5 วิ */
  await goFloor(page, 3);
  await liveQ(page);
  const blkMini = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0; G.streak = 0;
    /* บังคับให้ทัพเงามินิบอสยืนอยู่ตรงหน้า (ลูกเต๋าถูกทอยไปแล้ว) */
    BA_INC_F = G.floor; BA_INC_AT = G.floorProgress; BA_INC_ID = 's1';
    BA_INC_M = G.currentMonster;
    const sh = baShNow();
    const d = baDbBlkMs(9999);
    return { tier: sh ? sh.tier : '', d: d };
  });
  ok(blkMini.tier === 'mini', 'จับทัพเงามินิบอสให้ยืนอยู่ตรงหน้าได้ [' + blkMini.tier + ']');
  ok(blkMini.d === 1500, 'มินิบอส → จอดำ 1.5 วิ เป๊ะ [' + blkMini.d + ']');

  await page.evaluate(() => { BA_INC_M = null; BA_INC_ID = ''; });

  // ═══ 4) Debuff Timing — Seal of Silence ═════════════════════════════
  blk('4 · Debuff Timing · Seal of Silence');
  await goFloor(page, 12);
  await liveQ(page);

  const seal = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0;
    const d = baStone(BA_CUR_SEAL);
    const list = baChoices();
    let lock = 0;
    for (let i = 0; i < list.length; i++) if (list[i].disabled) lock++;
    return { d: d, lock: lock, all: list.length, a: baBattleAudit().debuff };
  });
  ok(seal.d === 4000, 'ผนึกความเงียบงันตั้งอายุ 4.0 วิ [' + seal.d + ']');
  ok(seal.lock === seal.all && seal.all > 0,
     'ปุ่มถูกล็อกครบทุกใบ [' + seal.lock + '/' + seal.all + ']');
  ok(seal.a.sealArmed === true, 'นาฬิกาผนึกของแพตช์นี้ถูกติดอาวุธแล้ว');
  ok(seal.a.stoneStale === false, 'นาฬิกาเก่าของ v6.3 ถูกล้างทิ้งแล้ว (ไม่มี timeout ซ้อน)');

  /* ผนึกต้องรอดข้ามการเปลี่ยนโจทย์ และคงเวลาที่เหลือไว้ ไม่เริ่มนับใหม่ */
  const sealQ = await page.evaluate(() => {
    try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}
    const list = baChoices();
    let lock = 0;
    for (let i = 0; i < list.length; i++) if (list[i].disabled) lock++;
    return { lock: lock, all: list.length, a: baBattleAudit().debuff };
  });
  ok(sealQ.lock === sealQ.all && sealQ.all > 0,
     'เปลี่ยนข้อกลางผนึก → ปุ่มชุดใหม่ถูกล็อกต่อครบ [' + sealQ.lock + '/' + sealQ.all + ']');
  ok(sealQ.a.sealLeft <= 4000 && sealQ.a.sealLeft > 0,
     'เวลาที่เหลือไม่ถูกรีเซ็ตเป็น 4.0 วิ ใหม่ [' + Math.round(sealQ.a.sealLeft) + 'ms]');
  ok(sealQ.a.stoneStale === false, 'ยังไม่มี timeout ของ v6.3 ตกค้าง');

  await page.waitForTimeout(4300);
  const sealEnd = await page.evaluate(() => {
    const list = baChoices();
    let lock = 0;
    for (let i = 0; i < list.length; i++) if (list[i].disabled) lock++;
    return { lock: lock, all: list.length, a: baBattleAudit() };
  });
  ok(sealEnd.lock === 0, 'ปุ่มปลดล็อกครบตรง 4.0 วิ [' + sealEnd.lock + ' ใบยังล็อก]');
  ok(sealEnd.a.debuff.sealEnd === 0 && sealEnd.a.debuff.sealArmed === false,
     'ไม่มี timeout ตกค้างหลังผนึกหมดอายุ');
  ok(sealEnd.a.grace.on === true, 'หลุดจากผนึกแล้วได้ Grace Period ทันที');

  // ═══ 5) Anti-Chain Stun ═════════════════════════════════════════════
  blk('5 · Anti-Chain Stun · Grace Period');
  await goFloor(page, 12);
  await liveQ(page);

  const chain = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0; G.streak = 0;
    baBlackout(2000);
    baDbBlkEnd();                       /* จำลองว่าเพิ่งหลุดออกมาเดี๋ยวนี้ */
    const g0 = baBattleAudit().grace;
    const d1 = baBlackout(2000);        /* ต้องถูกกันไว้ */
    const d2 = baStone(4000);           /* ต้องถูกกันไว้เหมือนกัน */
    const el = document.getElementById('baBlack');
    const list = baChoices();
    let lock = 0;
    for (let i = 0; i < list.length; i++) if (list[i].disabled) lock++;
    return { g0: g0, d1: d1, d2: d2, lock: lock,
             on: !!(el && el.classList.contains('on')), a: baBattleAudit() };
  });
  ok(chain.g0.on === true && chain.g0.left > 1200,
     'หลุดจากจอดำ → ได้เกราะ 1.5 วิ [' + Math.round(chain.g0.left) + 'ms]');
  ok(chain.d1 === 0 && chain.on === false, 'จอดำใบที่สองถูกกันไว้ (ไม่มีการติดซ้อน)');
  ok(chain.d2 === 0 && chain.lock === 0, 'ผนึกใบถัดมาถูกกันไว้ด้วย (ข้ามชนิดกันได้)');
  ok(chain.a.grace.n >= 1, 'ตัวนับ Grace เดินหน้าแล้ว [' + chain.a.grace.n + ']');

  await page.waitForTimeout(1700);
  const after = await page.evaluate(() => {
    const g = baBattleAudit().grace;
    G.streak = 0;
    const d = baBlackout(2000);
    return { g: g, d: d };
  });
  ok(after.g.on === false, 'เกราะหมดอายุตรง 1.5 วิ');
  ok(after.d === 2000, 'พ้นเกราะแล้วติด debuff ได้ตามปกติ [' + after.d + ']');
  await page.evaluate(() => { baDbClear(false); BA_GP_UNTIL = 0; });

  /* เกราะต้องไม่กันของที่ไม่ใช่ debuff ปิดกั้น */
  const other = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0;
    baBlackout(2000); baDbBlkEnd();     /* ติดเกราะ */
    baBlind();
    const gs = document.getElementById('gameScreen');
    return { grace: baGpOn(), blind: !!(gs && gs.classList.contains('ba-blind')) };
  });
  ok(other.grace === true && other.blind === true,
     'เกราะไม่ได้กัน Blind Knowledge (ยังเล่นต่อได้ จึงไม่ใช่ debuff ปิดกั้น)');
  await page.evaluate(() => {
    const gs = document.getElementById('gameScreen');
    if (gs) gs.classList.remove('ba-blind');
    baDbClear(false); BA_GP_UNTIL = 0;
  });

  // ═══ 6) Speed Reflex ล้าง timeout ทันที ═════════════════════════════
  blk('6 · Speed Reflex ล้าง timeout ตกค้าง');
  await goFloor(page, 12);
  await liveQ(page);

  const parry = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0; G.streak = 0;
    baBlackout(2000);
    baStone(4000);
    const b0 = baBattleAudit().debuff;
    const n = baCbCleanse();            /* คือทางผ่านเดียวของ Parry Strike (v6.9) */
    const el = document.getElementById('baBlack');
    const list = baChoices();
    let lock = 0;
    for (let i = 0; i < list.length; i++) if (list[i].disabled) lock++;
    return { b0: b0, n: n, lock: lock,
             on: !!(el && el.classList.contains('on')), a: baBattleAudit() };
  });
  ok(parry.b0.blackArmed === true && parry.b0.sealArmed === true,
     'ตั้ง debuff สองใบพร้อมกันได้ก่อนวัด');
  ok(parry.on === false && parry.lock === 0,
     'Speed Reflex สำเร็จ → จอดำดับและปุ่มปลดล็อกทันที');
  ok(parry.a.debuff.blackArmed === false && parry.a.debuff.sealArmed === false,
     'ไม่มี timeout ตกค้างหลัง Speed Reflex');
  ok(parry.a.debuff.blackEnd === 0 && parry.a.debuff.sealEnd === 0,
     'เวลาสิ้นสุดถูกล้างเป็นศูนย์ครบทั้งสองใบ');
  ok(parry.a.grace.on === true, 'Speed Reflex สำเร็จก็ได้ Grace Period เหมือนกัน');
  ok(parry.n >= 1, 'baCbCleanse คืนจำนวนสถานะที่ล้างได้ [' + parry.n + ']');

  /* ต้องไม่มีนาฬิกาเก่ามาปลด/ปิดอะไรทีหลัง */
  await page.waitForTimeout(2300);
  const late = await page.evaluate(() => {
    const el = document.getElementById('baBlack');
    return { on: !!(el && el.classList.contains('on')), a: baBattleAudit().debuff };
  });
  ok(late.on === false && late.a.blackArmed === false,
     'ผ่านไป 2.3 วิ ไม่มีนาฬิกาเก่ามาเปิดจอดำซ้ำ');

  // ═══ 7) เปลี่ยนไฟต์ / ออกจากเกม = คืนทรัพยากรครบ ═══════════════════
  blk('7 · คืนทรัพยากร');
  await goFloor(page, 12);
  await liveQ(page);
  const fightSwap = await page.evaluate(() => {
    baDbClear(false); BA_GP_UNTIL = 0; G.streak = 0;
    baBlackout(2000); baStone(4000);
    baClearFight();
    const el = document.getElementById('baBlack');
    return { on: !!(el && el.classList.contains('on')), a: baBattleAudit() };
  });
  ok(fightSwap.on === false, 'เปลี่ยนไฟต์ → จอดำถูกถอดทันที');
  ok(fightSwap.a.debuff.blackArmed === false && fightSwap.a.debuff.sealArmed === false,
     'เปลี่ยนไฟต์ → ไม่มี timeout ตกค้าง');
  ok(fightSwap.a.grace.on === false, 'เปลี่ยนไฟต์ไม่ได้แจก Grace ให้ฟรี');
  ok(fightSwap.a.debuff.stoneStale === false, 'นาฬิกาของ v6.3 ก็ไม่เหลือ');

  const exited = await page.evaluate(() => {
    baBlackout(2000); baStone(4000);
    exitGame();
    const el = document.getElementById('baBlack');
    return { on: !!(el && el.classList.contains('on')), a: baBattleAudit() };
  });
  ok(exited.on === false, 'ออกจากเกม → จอดำถูกถอด');
  ok(exited.a.debuff.blackArmed === false && exited.a.debuff.sealArmed === false,
     'ออกจากเกม → นาฬิกาดับครบ');
  ok(exited.a.telegraph.shown === false && exited.a.telegraph.on === false,
     'ออกจากเกม → ไฟเตือนดับ');

  // ═══ 8) ความปลอดภัยรวม ═════════════════════════════════════════════
  blk('8 · ความปลอดภัยรวม');
  const rnd = await page.evaluate(() => {
    let n = 0;
    const _r = Math.random;
    Math.random = function () { n++; return _r(); };
    for (let i = 0; i < 40; i++) { baTgSync(); baGpOn(); baDbBlkMs(0); }
    Math.random = _r;
    return n;
  });
  ok(rnd === 0, 'ไม่แตะ Math.random สักครั้ง (กับดักข้อ 32) [' + rnd + ']');

  ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุด [' + errs.slice(0, 2).join(' | ') + ']');
  const el2 = await page.evaluate(() => ({ w: document.body.scrollWidth, v: window.innerWidth }));
  ok(el2.w <= el2.v, 'เลย์เอาต์ไม่ล้นแนวนอน [' + el2.w + '/' + el2.v + ']');
  const bad = await page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
            .filter(e => /^(tg|gp|db)[A-Z]|install611/.test(String(e && e.where || ''))).length; }
    catch (e) { return -1; }
  });
  ok(bad === 0, 'Error Log ไม่มีรายการของแพตช์ v6.11 [' + bad + ']');
  const net = await page.evaluate(() => (window.__NET || []).length);
  fs.appendFileSync(LOG, '\n(คำขอเน็ตที่ถูก stub ไว้ ' + net + ' ครั้ง)\n');

  fs.appendFileSync(LOG, '\n══ สรุป ══\n✅ ผ่าน ' + pass + '\n❌ ตก ' + fail + '\n');
  console.log('\n══ สรุป ══  ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
