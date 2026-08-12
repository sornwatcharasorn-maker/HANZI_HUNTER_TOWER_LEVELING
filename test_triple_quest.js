/* ชุดทดสอบชั้น v4.9.3 · TRIPLE QUEST ENGINE — เควสต์ 3 สายหลัก
   รัน:  NODE_PATH=/opt/node22/lib/node_modules node test_triple_quest.js
   บันทึกผลลง test_triple_quest.log (stdout ถูกบัฟเฟอร์ ถ้าค้างจะไม่เห็นว่าค้างตรงไหน) */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'test_triple_quest.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function log(s) { fs.appendFileSync(LOG, s + '\n'); }
function ok(name, cond, extra) {
  if (cond) { pass++; log('  PASS  ' + name); }
  else { fail++; log('  FAIL  ' + name + (extra !== undefined ? '   → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name + ' (=' + JSON.stringify(want) + ')', got === want, got); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const pageErrors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => { pageErrors.push(String(e)); log('  !! pageerror: ' + e); });

  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });

  const USER = 'tqtest';

  // ── เข้าเกม ────────────────────────────────────────────────────
  async function login(user, isNew) {
    await page.evaluate(() => enterGate());
    await page.waitForTimeout(700);               /* enterGate มี setTimeout 360ms — กับดักข้อ 4 */
    if (isNew) {
      await page.evaluate(() => switchTab('register'));
      await page.evaluate(u => {
        document.getElementById('reg-id').value  = u;
        document.getElementById('reg-pw').value  = '1234';
        document.getElementById('reg-pw2').value = '1234';
      }, user);
    } else {
      await page.evaluate(() => switchTab('login'));
      await page.evaluate(u => {
        document.getElementById('login-id').value = u;
        document.getElementById('login-pw').value = '1234';
      }, user);
    }
    await page.evaluate(() => handleSubmit());
    await page.waitForTimeout(900);
    await pickCard();
  }

  /* หน้าต่างจั่วการ์ดของ v4.7 เด้งตอนก้าวเข้าช่วงชั้นใหม่ — ต้องเลือกให้จบก่อนทำอย่างอื่น
     และต้องรอเกิน CD_OUT_MS (620ms) ก่อนไปต่อ */
  async function pickCard() {
    const open = await page.evaluate(() => {
      const el = document.getElementById('cdDraft');
      return !!(el && el.classList.contains('active'));
    });
    if (!open) return;
    await page.evaluate(() => { const c = document.querySelector('#cdDraft .cd-card'); if (c) c.click(); });
    await page.waitForTimeout(800);
  }

  /* สลับเป็นการ์ดที่ไม่ยุ่งกับนาฬิกา — 🧘 สมาธิแน่วแน่ทำให้ทุกข้อเริ่มด้วยการแช่แข็ง
     แล้ว QUESTION_TIMER เป็น null โดยชอบธรรม เคสจะตกด้วยเหตุผลผิด */
  async function safeCard() {
    await page.evaluate(() => {
      CD_CARD = CD_BY_ID['mana'];
      CD_BAND = cdBandOf(G.floor);
      CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
      cdPaintUi();
    });
  }

  async function freshQuestion() {
    await page.evaluate(() => { G.locked = false; nextMonster(); });
    await page.waitForTimeout(120);
  }

  async function answerRight() {
    await page.evaluate(() => {
      G.locked = false;
      G.questionStart = Date.now();
      answer(G.currentMonster.answer, null);
    });
    await page.waitForTimeout(120);
  }

  async function answerWrong() {
    await page.evaluate(() => {
      G.locked = false;
      G.questionStart = Date.now();
      const m = G.currentMonster;
      answer(m.choices.filter(c => c !== m.answer)[0], null);
    });
    await page.waitForTimeout(120);
  }

  const tq = () => page.evaluate(() => JSON.parse(JSON.stringify(G.tq)));

  log('══ v4.9.3 TRIPLE QUEST ENGINE — ' + new Date().toISOString() + ' ══\n');
  await login(USER, true);

  // ── 1. ติดตั้งครบ ────────────────────────────────────────────
  log('[1] โครงสร้างชั้น');
  const meta = await page.evaluate(() => ({
    ver: TQ_VER,
    n: TQ_DEFS.length,
    tracks: TQ_DEFS.map(d => d.track),
    ids: TQ_DEFS.map(d => d.id),
    tags: Object.keys(TQ_NOTIF).map(k => TQ_NOTIF[k].tag),
    gates: Object.keys(TQ_NOTIF).filter(k => TQ_NOTIF[k].gate),
    hasTq: !!G.tq,
    scar: TQ_BY_ID.T8.goal,
    scarCond: TQ_BY_ID.T8.cond
  }));
  eq('เควสครบ 9 รายการ', meta.n, 9);
  eq('สาย 1 มี 3 รายการ', meta.tracks.filter(t => t === 'daily').length, 3);
  eq('สาย 2 มี 3 รายการ', meta.tracks.filter(t => t === 'hunter').length, 3);
  eq('สาย 3 มี 3 รายการ', meta.tracks.filter(t => t === 'tower').length, 3);
  ok('สารบัญเป็น TRACK 01/05-05/05 ไม่ทับของชั้นอื่น',
     meta.tags.join(',') === 'TRACK 01/05,TRACK 02/05,TRACK 03/05,TRACK 04/05,TRACK 05/05', meta.tags);
  eq('ไม่มี gate สักใบ (กับดักข้อ 18)', meta.gates.length, 0);
  ok('บัญชีใหม่ได้ก้อน tq', meta.hasTq);
  eq('🛡️ สายไร้รอยขีดข่วน = 3 ชั้น', meta.scar, 3);
  ok('เงื่อนไข T8 ระบุชั้น 5, 10, 15', /5, 10, 15/.test(meta.scarCond), meta.scarCond);

  // ── 2. Daily Unlocking Requirement ───────────────────────────
  log('\n[2] Daily Unlocking Requirement — ยังไม่เคลียร์ชั้น = ไม่นับ');
  await safeCard();
  await freshQuestion();
  let t = await tq();
  eq('เริ่มมายังไม่ปลดล็อก', t.unlocked, false);

  await answerRight();
  await answerRight();
  t = await tq();
  eq('ตอบถูก 2 ข้อแล้วตัวนับสาย 1 ยังเป็น 0', t.d.ans || 0, 0);

  /* สาย 2 ไม่มีธง lock จึงต้องเดินได้ตั้งแต่ยังไม่ปลดล็อกรอบวัน */
  const unlockedTrack2 = await page.evaluate(() => {
    const b = G.tq.d.a1 || 0;
    tqAdd('a1', 1);
    const r = G.tq.d.a1 || 0;
    const bw = G.tq.d.weak || 0;
    tqAdd('weak', 1);
    return { a1: r - b, weak: (G.tq.d.weak || 0) - bw, locked: tqDailyOn(G.tq) };
  });
  eq('ยังไม่ปลดล็อกรอบวันจริง', unlockedTrack2.locked, false);
  eq('สาย 2 · 📖 เซียน A1 ยังนับได้ (ไม่ถูก lock)', unlockedTrack2.a1, 1);
  eq('สาย 2 · 📚 ล้างคลังศัพท์ ยังนับได้', unlockedTrack2.weak, 1);

  /* ตัวนับ a1 ผูกกับ onMonsterDefeated — ต้องล้มมอนสเตอร์จริงถึงจะขยับ */
  const killed = await page.evaluate(() => {
    G.tq.d.a1 = 0;
    G.locked = false; nextMonster();
    G.monsterHp = 1;                 /* ให้ตายด้วยการตอบถูกครั้งเดียว */
    G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    return G.tq.d.a1 || 0;
  });
  await page.waitForTimeout(1400);
  eq('ล้มมอนสเตอร์ 1 ตัว → นับคำ A1 ให้ 1', await page.evaluate(() => G.tq.d.a1 || 0), 1);
  await page.waitForTimeout(600);
  await pickCard();

  // ปลดล็อกด้วยการเคลียร์ชั้นจริง
  await page.evaluate(() => { G.floorProgress = 0; clearFloor(false); });
  await page.waitForTimeout(1800);
  await pickCard();
  t = await tq();
  eq('เคลียร์ 1 ชั้นแล้วปลดล็อก', t.unlocked, true);

  await safeCard();
  await freshQuestion();
  await answerRight();
  t = await tq();
  ok('ปลดล็อกแล้วตัวนับสาย 1 เดิน', (t.d.ans || 0) >= 1, t.d);

  // ── 3. Anti-Farm Skill Logic ─────────────────────────────────
  log('\n[3] Anti-Farm Skill Logic — ร่ายสกิลนอก Battle State ไม่นับ');
  await page.evaluate(() => { G.maxFloor = FLOOR_MAX; recalcStats(); });
  await freshQuestion();

  const skillOut = await page.evaluate(() => {
    G.mp = maxMpOf(G); G.skillCd = {};
    const before = (G.tq.d.cast || 0);
    openShop();                       /* หน้าต่างระบบเปิดค้าง = ไม่ใช่ Battle State */
    const inb = tqInBattle();
    useSkill('eye');
    const after = (G.tq.d.cast || 0);
    closeShop();
    return { inb, before, after };
  });
  eq('เปิดร้านค้าอยู่ → tqInBattle() = false', skillOut.inb, false);
  eq('ร่ายสกิลตอนหน้าต่างเปิดค้าง ไม่ถูกนับ', skillOut.after, skillOut.before);

  await page.waitForTimeout(200);
  await freshQuestion();
  const skillIn = await page.evaluate(() => {
    G.mp = maxMpOf(G); G.skillCd = {}; G.locked = false;
    const before = (G.tq.d.cast || 0);
    const inb = tqInBattle();
    useSkill('eye');
    return { inb, before, after: (G.tq.d.cast || 0) };
  });
  eq('อยู่ในสนามรบ → tqInBattle() = true', skillIn.inb, true);
  eq('ร่ายสกิลขณะต่อสู้จริง ถูกนับ', skillIn.after, skillIn.before + 1);

  // ── 4. สายช็อป ───────────────────────────────────────────────
  log('\n[4] สายช็อป — ซื้อไอเทมจากร้านค้า');
  const shop = await page.evaluate(() => {
    G.gold = 5000; G.items = {};
    const before = (G.tq.d.shop || 0);
    buyItem('potion');
    return { before, after: (G.tq.d.shop || 0), pot: G.items.potion || 0 };
  });
  eq('ซื้อของสำเร็จนับ 1 ครั้ง', shop.after, shop.before + 1);
  eq('ของเข้ากระเป๋าจริง', shop.pot, 1);

  const shopFail = await page.evaluate(() => {
    G.gold = 0;
    const before = (G.tq.d.shop || 0);
    buyItem('insurance');            /* ทองไม่พอ — ไม่ควรถูกนับ */
    return { before, after: (G.tq.d.shop || 0) };
  });
  eq('ซื้อไม่สำเร็จ (ทองไม่พอ) ไม่ถูกนับ', shopFail.after, shopFail.before);

  // ── 5. รางวัลจ่ายอัตโนมัติ + ไม่ปั๊ม totalGoldEarned ─────────
  log('\n[5] จ่ายรางวัลอัตโนมัติ (auto-grant)');
  const pay = await page.evaluate(() => {
    G.tq.done.d = []; G.tq.pend = [];
    G.tq.d.ans = TQ_FIT_GOAL - 1;
    G.gold = 1000;
    G.totalGoldEarned = 777;
    tqSeedSeen();
    const goldBefore = G.gold;
    tqAdd('ans', 1); tqAfter();
    return { gold: G.gold - goldBefore, tge: G.totalGoldEarned,
             done: G.tq.done.d.indexOf('T1') !== -1 };
  });
  eq('🎯 สายฟิตครบ → +200 ทองทันที', pay.gold, 200);
  eq('ทองรางวัลเควสไม่บวกเข้า totalGoldEarned', pay.tge, 777);
  ok('ถูกบันทึกว่าสำเร็จแล้ว', pay.done);

  const mp = await page.evaluate(() => {
    G.tq.done.d = G.tq.done.d.filter(x => x !== 'T2');
    G.tq.d.cast = TQ_CAST_GOAL - 1;
    G.mp = 10;
    tqSeedSeen();
    tqAdd('cast', 1); tqAfter();
    return { mp: G.mp, cap: maxMpOf(G) };
  });
  eq('⚡ สายร่ายครบ → +30 MP', mp.mp, Math.min(mp.cap, 40));

  const expR = await page.evaluate(() => {
    G.tq.done.d = G.tq.done.d.filter(x => x !== 'T3');
    G.tq.d.shop = 0; G.exp = 0;
    tqSeedSeen();
    tqAdd('shop', 1); tqAfter();
    return { exp: G.exp, lv: G.level };
  });
  ok('🛒 สายช็อปครบ → +100 EXP (หรือดันเลเวลขึ้น)', expR.exp >= 100 || expR.lv > 1, expR);

  // ── 6. สาย 2 · ฮันเตอร์ ──────────────────────────────────────
  log('\n[6] สายฮันเตอร์');
  const weak = await page.evaluate(async () => {
    G.tq.done.d = []; G.tq.d.weak = 0; tqSeedSeen();
    G.locked = false; nextMonster();
    const id = G.currentMonster.id;
    G.wordStats[String(id)] = { seen: 9, wrong: TQ_WEAK_WRONG, totalMs: 0, lastSeen: 0, recent: [] };
    const before = G.tq.d.weak || 0;
    G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    return { before, after: G.tq.d.weak || 0 };
  });
  eq('📚 ตอบถูกในคำคลังทบทวน นับให้ 1', weak.after, weak.before + 1);

  const notWeak = await page.evaluate(() => {
    G.locked = false; nextMonster();
    G.wordStats[String(G.currentMonster.id)] = { seen: 1, wrong: 0, totalMs: 0, lastSeen: 0, recent: [] };
    const before = G.tq.d.weak || 0;
    G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    return { before, after: G.tq.d.weak || 0 };
  });
  eq('คำที่ไม่เคยผิด ไม่นับเข้าคลังทบทวน', notWeak.after, notWeak.before);

  const acc = await page.evaluate(() => {
    G.tq.done.d = G.tq.done.d.filter(x => x !== 'T5');
    G.tq.d.acc = 0; G.items = {}; tqSeedSeen();
    TQ_SES = { ok: 0, n: 0 };
    /* ยังไม่ถึงขั้นต่ำ 20 ข้อ — ต่อให้ 100% ก็ยังไม่เข้าเงื่อนไข */
    TQ_SES = { ok: 5, n: 5 };
    G.locked = false; nextMonster(); G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    const early = G.tq.d.acc || 0;
    TQ_SES = { ok: 24, n: 27 };      /* 88.9% จาก 28 ข้อหลังตอบข้อถัดไป */
    G.locked = false; nextMonster(); G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    return { early, late: G.tq.d.acc || 0, pot: G.items.potion || 0, ses: TQ_SES };
  });
  eq('ต่ำกว่าขั้นต่ำ 20 ข้อ ยังไม่ติด', acc.early, 0);
  eq('เกิน 80% จาก ≥20 ข้อ → ติดเงื่อนไข', acc.late, 1);
  eq('ได้ 🧪 ยาฟื้นพลัง 1 ชิ้น', acc.pot, 1);

  const a1 = await page.evaluate(() => {
    G.tq.done.d = G.tq.done.d.filter(x => x !== 'T6');
    G.tq.d.a1 = TQ_A1_GOAL - 1; G.gold = 0; tqSeedSeen();
    tqAdd('a1', 1); tqAfter();
    return { gold: G.gold, done: G.tq.done.d.indexOf('T6') !== -1 };
  });
  eq('📖 เซียน A1 ครบ → +300 ทอง', a1.gold, 300);
  ok('T6 สำเร็จ', a1.done);

  // ── 7. สาย 3 · พิชิตหอคอย ────────────────────────────────────
  log('\n[7] สายพิชิตหอคอย');
  const sboss = await page.evaluate(() => {
    G.tq.done.L = []; G.tq.L.sboss = 0; G.gold = 0; tqSeedSeen();
    G.floor = FLOOR_MAX; G.floorProgress = 0;
    TQ_HIT_F = FLOOR_MAX; TQ_HITS = TQ_SBOSS_ROUND;
    clearFloor(true);
    return { gold: G.gold, sboss: G.tq.L.sboss, done: G.tq.done.L.indexOf('T7') !== -1,
             card: CD_CARD ? CD_CARD.id : null, band: CD_BAND,
             rw: TQ_RW_SBOSS, pool: TQ_RARE_POOL.slice() };
  });
  ok('👑 ล้มยักษ์ครบ 6 รอบ → สำเร็จ', sboss.done, sboss);
  ok('ได้ทองรางวัลอย่างน้อย 500 บวกกับทองเคลียร์ชั้น', sboss.gold >= sboss.rw, sboss.gold);
  ok('ได้การ์ดหายากใส่มือ', !!sboss.card && sboss.pool.indexOf(sboss.card) !== -1, sboss.card);

  const sbossShort = await page.evaluate(() => {
    G.tq.done.L = []; G.tq.L.sboss = 0; tqSeedSeen();
    G.floor = FLOOR_MAX; G.floorProgress = 0;
    TQ_HIT_F = FLOOR_MAX; TQ_HITS = TQ_SBOSS_ROUND - 1;
    clearFloor(true);
    return G.tq.done.L.indexOf('T7') !== -1;
  });
  eq('ตอบถูกไม่ครบ 6 รอบ → ไม่สำเร็จ', sbossShort, false);

  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (G.warpOpen) warpGo(); });
  await page.waitForTimeout(400);
  await pickCard();

  const scar = await page.evaluate(() => {
    G.tq.done.L = []; G.tq.L.nopot = []; G.gold = 0; tqSeedSeen();
    const out = [];
    [5, 10, 15].forEach(f => {
      G.floor = f; G.floorProgress = 0; TQ_POT_F = 0;
      clearFloor(true);
      out.push(G.tq.L.nopot.slice());
    });
    return { out, gold: G.gold, done: G.tq.done.L.indexOf('T8') !== -1, rw: TQ_RW_SCAR };
  });
  eq('ผ่านครบ 3 ชั้นบอสโดยไม่ใช้ยา → สำเร็จ', scar.done, true);
  ok('เก็บครบ [5,10,15]', JSON.stringify(scar.out[2]) === '[5,10,15]', scar.out);
  ok('ได้ทองรวม ≥ 1,000 จากรางวัล', scar.gold >= scar.rw, scar.gold);

  const scarPot = await page.evaluate(() => {
    G.tq.done.L = []; G.tq.L.nopot = []; tqSeedSeen();
    G.floor = 5; G.floorProgress = 0;
    TQ_POT_F = 5;                       /* กดยาฟื้นพลังบนชั้นนี้ไปแล้ว */
    clearFloor(true);
    return G.tq.L.nopot.slice();
  });
  eq('กดยาฟื้นพลังบนชั้นนั้น → ไม่ได้เครดิต', scarPot.length, 0);

  const potFlag = await page.evaluate(() => {
    G.floor = 7; G.hp = 10; G.items = { potion: 2 }; G.maxFloor = FLOOR_MAX;
    recalcStats(); G.locked = false; nextMonster(); G.locked = false;
    TQ_POT_F = 0;
    useItem('potion');
    return { flag: TQ_POT_F, left: G.items.potion };
  });
  eq('ใช้ยาฟื้นพลังแล้วธงชี้ที่ชั้นปัจจุบัน', potFlag.flag, 7);
  eq('ยาถูกหักจริง', potFlag.left, 1);

  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (G.warpOpen) warpGo(); });
  await page.waitForTimeout(400);
  await pickCard();

  const streak = await page.evaluate(async () => {
    G.tq.done.L = []; G.tq.L.streak = 0; G.items = {}; tqSeedSeen();
    G.floor = 3; G.floorProgress = 0; G.hp = G.maxHp;
    CD_CARD = CD_BY_ID['mana']; CD_BAND = cdBandOf(G.floor);
    CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
    G.streak = TQ_STREAK_GOAL - 1;
    G.locked = false; nextMonster();
    G.streak = TQ_STREAK_GOAL - 1;
    G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    return { streak: G.tq.L.streak, done: G.tq.done.L.indexOf('T9') !== -1,
             ins: G.items.insurance || 0 };
  });
  eq('🔥 สตรีคถึง 10 → บันทึกไว้', streak.streak, 10);
  ok('T9 สำเร็จ', streak.done, streak);
  eq('ได้ 🛡️ ประกันภัยฮันเตอร์ 1 ชิ้น', streak.ins, 1);

  // ── 8. Silence Mode Constraint ───────────────────────────────
  log('\n[8] Silence Mode Constraint — กัก toast ระหว่างนับเวลาตอบ');
  await page.evaluate(() => { ncSetMode('all'); document.getElementById('snLayer').innerHTML = ''; });
  await safeCard();
  await freshQuestion();

  const hold = await page.evaluate(() => {
    document.getElementById('snLayer').innerHTML = '';
    TQ_HOLD = [];
    const running = QUESTION_TIMER !== null;
    tqNotify('DONE', { name:'ทดสอบ', cond:'x', track:'t', reward:'+1 Gold', wallet:0, extra:'' });
    return { running, held: TQ_HOLD.length, onScreen: document.getElementById('snLayer').children.length };
  });
  eq('นาฬิกาต่อข้อเดินอยู่จริง', hold.running, true);
  eq('toast ถูกกักไว้ ไม่เด้งทับโจทย์', hold.onScreen, 0);
  eq('เข้าคิวไว้ 1 ใบ', hold.held, 1);

  const flushed = await page.evaluate(() => {
    tqNotify('DONE', { name:'ทดสอบ2', cond:'x', track:'t', reward:'+2 Gold', wallet:0, extra:'' });
    const held = TQ_HOLD.length;
    G.locked = false; G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    return { held, after: TQ_HOLD.length, onScreen: document.getElementById('snLayer').children.length };
  });
  eq('กักได้หลายใบ', flushed.held, 2);
  eq('ตอบจบแล้วคิวถูกปล่อยหมด', flushed.after, 0);
  eq('รวมเป็นการ์ดใบเดียว (NC_MAX = 1)', flushed.onScreen, 1);

  const immediate = await page.evaluate(() => {
    clearQuestionTimer();
    document.getElementById('snLayer').innerHTML = '';
    TQ_HOLD = [];
    tqNotify('DONE', { name:'ทดสอบ3', cond:'x', track:'t', reward:'+3 Gold', wallet:0, extra:'' });
    return { held: TQ_HOLD.length, onScreen: document.getElementById('snLayer').children.length };
  });
  eq('ไม่มีนาฬิกาเดิน → ยิงสดทันที', immediate.onScreen, 1);
  eq('ไม่เข้าคิว', immediate.held, 0);

  const text = await page.evaluate(() => {
    document.getElementById('snLayer').innerHTML = '';
    tqFire('DONE', { name:'สายไร้รอยขีดข่วน', cond:'x', track:'เควสต์ไต่หอคอย',
                     reward:'+1,000 Gold', wallet:1234, extra:'' });
    const el = document.querySelector('#snLayer .sn');
    return el ? el.textContent : '';
  });
  ok('ข้อความตรงสเปก "✨ เควสต์สำเร็จ!: … — รับรางวัล +1,000 Gold"',
     /✨ เควสต์สำเร็จ!: สายไร้รอยขีดข่วน — รับรางวัล \+1,000 Gold/.test(text), text.slice(0, 120));
  ok('การ์ดโชว์รหัสอ้างอิงเต็ม TRACK 01/05', /TRACK 01\/05/.test(text), text.slice(0, 80));

  // ── 9. กระเป๋าเต็ม → พักรางวัลไว้ ────────────────────────────
  log('\n[9] กระเป๋าเต็ม — รางวัลถูกพักไว้ ไม่หาย');
  const bag = await page.evaluate(() => {
    G.items = { potion: BAG_SLOTS };
    G.tq.done.d = G.tq.done.d.filter(x => x !== 'T5');
    G.tq.pend = []; G.tq.d.acc = 0; tqSeedSeen();
    tqSet('acc', 1); tqAfter();
    return { pend: G.tq.pend.slice(), done: G.tq.done.d.indexOf('T5') !== -1, badge: document.getElementById('qBadge').textContent };
  });
  ok('ถูกพักไว้ที่ pend', bag.pend.indexOf('T5') !== -1, bag);
  eq('ยังไม่นับว่าจ่ายแล้ว', bag.done, false);

  const claimed = await page.evaluate(() => {
    G.items = { potion: 1 };            /* เคลียร์ช่องว่างแล้ว */
    tqClaim('T5');
    return { pend: G.tq.pend.length, done: G.tq.done.d.indexOf('T5') !== -1, pot: G.items.potion };
  });
  eq('กดรับแล้ว pend ว่าง', claimed.pend, 0);
  eq('ถูกบันทึกว่าสำเร็จ', claimed.done, true);
  eq('ได้ของจริง', claimed.pot, 2);

  // ── 10. กระดานภารกิจ — กันแทรกซ้ำ ───────────────────────────
  log('\n[10] กระดานภารกิจ');
  const board = await page.evaluate(() => {
    qOpenBoard();
    for (let i = 0; i < 30; i++) qRenderBoard();
    return {
      blocks: document.querySelectorAll('#tqBlock').length,
      rows: document.querySelectorAll('#tqBlock .q-row').length,
      secs: document.querySelectorAll('#tqBlock .g-sec-title').length,
      v42rows: document.querySelectorAll('#qBoardBody .q-row').length,
      open: document.getElementById('qBoard').classList.contains('active')
    };
  });
  eq('บล็อกของชั้นนี้มีใบเดียวหลังเรนเดอร์ 30 รอบ', board.blocks, 1);
  eq('แถวเควส 9 แถว', board.rows, 9);
  eq('หัวข้อ 3 สาย', board.secs, 3);
  eq('20 เควสของ v4.2 ยังอยู่ครบ', board.v42rows, 20 + 9);
  ok('กระดานเปิดอยู่', board.open);

  const layout = await page.evaluate(() => ({
    w: document.body.scrollWidth, iw: window.innerWidth,
    inner: (() => { const el = document.querySelector('#qBoard .g-modal-inner'); return el ? el.scrollWidth <= el.clientWidth + 1 : true; })()
  }));
  ok('ไม่ล้นแนวนอน', layout.w <= layout.iw, layout);
  ok('กระดานไม่ล้นแนวนอนในโมดัล', layout.inner);
  await page.evaluate(() => qCloseBoard());

  // ── 11. ความคืบหน้ารอดข้ามการล็อกอิน ────────────────────────
  log('\n[11] ค่าถาวรไม่หายหลัง exitGame + login ใหม่ (กับดักข้อ 16)');
  const before = await page.evaluate(() => {
    G.tq.d.ans = 7; G.tq.d.a1 = 4; G.tq.L.streak = TQ_STREAK_GOAL;
    G.tq.unlocked = true;
    TQ_DIRTY = true; tqSave();
    return JSON.parse(JSON.stringify(G.tq));
  });
  await page.evaluate(() => exitGame());
  await page.waitForTimeout(600);
  await login(USER, false);
  const after = await tq();
  eq('ตัวนับ ans รอด', after.d.ans, before.d.ans);
  eq('ตัวนับ a1 รอด', after.d.a1, before.d.a1);
  eq('สตรีคสะสมรอด', after.L.streak, before.L.streak);
  eq('สถานะปลดล็อกรอด', after.unlocked, true);
  ok('รายการที่สำเร็จแล้วรอด', after.done.L.length === before.done.L.length, [after.done.L, before.done.L]);

  const stored = await page.evaluate(u => !!(loadStore()[u] && loadStore()[u].tq), USER);
  ok('เขียนลง localStorage จริง', stored);

  // ── 12. รีเซ็ตรอบวัน ─────────────────────────────────────────
  log('\n[12] รีเซ็ตเที่ยงคืน');
  const reset = await page.evaluate(() => {
    G.tq.day = '2000-01-01';
    G.tq.d.ans = 99; G.tq.done.d = ['T1']; G.tq.unlocked = true;
    G.tq.done.L = ['T9']; G.tq.L.streak = TQ_STREAK_GOAL;
    tqSync();
    return JSON.parse(JSON.stringify(G.tq));
  });
  eq('ตัวนับรายวันถูกล้าง', reset.d.ans, 0);
  eq('รายการรายวันที่สำเร็จถูกล้าง', reset.done.d.length, 0);
  eq('สถานะปลดล็อกกลับเป็นล็อก', reset.unlocked, false);
  eq('รอบวันเป็นวันนี้', reset.day, await page.evaluate(() => qDayKey()));
  ok('สายพิชิตหอคอย (ตลอดชีพ) ไม่ถูกรีเซ็ต',
     reset.done.L.indexOf('T9') !== -1 && reset.L.streak === 10, reset.L);

  // ── 13. idempotent + ข้อมูลเพี้ยน ───────────────────────────
  log('\n[13] tqEnsure ทนข้อมูลเพี้ยน + idempotent');
  const dirty = await page.evaluate(() => {
    /* day ต้องเป็นวันนี้ ไม่งั้นจะโดนรีเซ็ตรอบวันก่อน แล้วไม่ได้ทดสอบตัวกรอง id ซ้ำ */
    const bad = { day: qDayKey(), d: { ans: -9, cast: 'x', zzz: 1 }, unlocked: 'yes',
                  done: { d: ['T1', 'T1', 'T9', 'NOPE'], L: ['T7', 'T7'] },
                  pend: ['T1', 'ZZZ'], L: { sboss: 99, streak: 999, nopot: [5, 5, 7, 20, 'x'] } };
    const a = tqEnsure(bad);
    const b = tqEnsure(JSON.parse(JSON.stringify(a)));

    /* day ที่ไม่ใช่สตริงต้องถูกซ่อมและถือเป็นรอบใหม่ (ล้างตัวนับรายวัน) */
    const c = tqEnsure({ day: 5, d: { ans: 9 }, unlocked: true, done: { d: ['T1'], L: ['T7'] } });
    return { a: JSON.parse(JSON.stringify(a)), same: JSON.stringify(a) === JSON.stringify(b),
             c: JSON.parse(JSON.stringify(c)), today: qDayKey() };
  });
  eq('day เพี้ยนถูกซ่อมเป็นวันนี้', dirty.c.day, dirty.today);
  eq('day เพี้ยน → ถือเป็นรอบใหม่ ล้างตัวนับรายวัน', dirty.c.d.ans, 0);
  ok('day เพี้ยน → ของตลอดชีพยังอยู่', dirty.c.done.L.indexOf('T7') !== -1, dirty.c.done);
  eq('ตัวนับติดลบถูกซ่อม', dirty.a.d.ans, 0);
  eq('ตัวนับเป็นสตริงถูกซ่อม', dirty.a.d.cast, 0);
  eq('id ซ้ำ/ผิดหมวดถูกกรอง', dirty.a.done.d.length, 1);
  eq('id ตลอดชีพซ้ำถูกกรอง', dirty.a.done.L.length, 1);
  eq('sboss ถูกหนีบไม่เกิน 1', dirty.a.L.sboss, 1);
  eq('สตรีคถูกหนีบที่เพดาน', dirty.a.L.streak, 10);
  ok('nopot เหลือเฉพาะชั้นบอส 5/10/15 ไม่ซ้ำ', JSON.stringify(dirty.a.L.nopot) === '[5]', dirty.a.L.nopot);
  ok('เรียกซ้ำได้ผลเท่าเดิม (idempotent)', dirty.same);

  // ── 14. โหมดฝึกจุดอ่อนไม่นับ ────────────────────────────────
  log('\n[14] โหมดฝึกจุดอ่อนไม่นับความคืบหน้า');
  const practice = await page.evaluate(() => {
    G.practiceMode = true;
    G.tq.unlocked = true;
    const b = { ans: G.tq.d.ans || 0, a1: G.tq.d.a1 || 0 };
    G.locked = false; nextMonster(); G.questionStart = Date.now();
    answer(G.currentMonster.answer, null);
    const r = { ans: G.tq.d.ans || 0, a1: G.tq.d.a1 || 0 };
    G.practiceMode = false;
    return { b, r };
  });
  eq('โหมดฝึก — ans ไม่ขยับ', practice.r.ans, practice.b.ans);
  eq('โหมดฝึก — a1 ไม่ขยับ', practice.r.a1, practice.b.a1);

  // ── 15. ไม่มี pageerror ─────────────────────────────────────
  log('\n[15] สรุป');
  ok('ไม่มี pageerror ตลอดการทดสอบ', pageErrors.length === 0, pageErrors.slice(0, 3));

  log('\n══ PASS ' + pass + ' · FAIL ' + fail + ' ══');
  await browser.close();
  console.log('PASS ' + pass + ' · FAIL ' + fail + '  (ดูรายละเอียดที่ ' + LOG + ')');
  process.exit(fail ? 1 : 0);
})().catch(e => { log('CRASH: ' + (e && e.stack || e)); console.log('CRASH: ' + e); process.exit(1); });
