/* test_triple_gauge.js — ชุดเทสต์ของชั้น v6.8
   (Triple Gauge · Deterministic Curse Rotation · Dynamic Question Flow)

   NODE_PATH=/opt/node22/lib/node_modules node test_triple_gauge.js

   ทุกเคสวัดจาก **ไฟล์แจก** ที่รากrepo ตามกติกาของ repo (ต้อง build ก่อนรันเสมอ)   */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_triple_gauge.log');
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
   **ปิดระบบบุกรุกของ v6.6 ทุกครั้ง** (กติกาเดิมของชุด v6.2/v6.3/v6.5/v6.7) */
async function goFloor(page, f, opt) {
  await page.evaluate((a) => {
    const fl = a.f;
    G.practiceMode = !!a.practice;
    G.floor = fl;
    G.maxFloor = Math.max(G.maxFloor || 1, fl);
    G.floorProgress = 0;
    G.hp = G.maxHp; G.shield = 0;
    if (typeof CD_BAND !== 'undefined') CD_BAND = cdBandOf(fl);
    if (typeof CD_CARD !== 'undefined') CD_CARD = null;
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = fl; BA_INC_AT = -1; BA_INC_M = null; }
    recalcStats();
    nextMonster();
  }, { f: f, practice: !!(opt && opt.practice) });
  await page.waitForTimeout(300);
  await clearOverlays(page);
}

async function audit(page) { return await page.evaluate(() => baBattleAudit()); }

/* ตอบหนึ่งข้อโดยประคองให้อสูรรอด แล้วรอจนข้อถัดไปขึ้นจอจริง */
async function answerOne(page, correct) {
  const before = await page.evaluate(() => {
    const g = G;
    g.monsterMaxHp = 999999; g.monsterHp = 999999;   /* อสูรต้องรอดเพื่อให้มีข้อถัดไป */
    g.hp = g.maxHp; g.shield = 999;                  /* ฮีโร่ต้องรอดเหมือนกัน */
    g.locked = false;
    g.questionStart = Date.now() - 9000;
    const m = g.currentMonster;
    return { word: m.word, id: m.id, ans: m.answer,
             wrong: m.choices.filter(c => c !== m.answer)[0],
             foe: (typeof baFoeIdOf === 'function') ? baFoeIdOf(g) : '',
             skill: (typeof baSkillNow === 'function' && baSkillNow()) ? baSkillNow().en : '',
             barM: (typeof BA_BAR !== 'undefined' && BA_BAR) ? (BA_BAR.m === m) : null,
             obj: null };
  });
  await page.evaluate((a) => {
    resolveAnswer(a.correct ? a.ans : a.wrong, null, false);
  }, { correct: correct, ans: before.ans, wrong: before.wrong });
  await page.waitForTimeout(correct ? 1500 : 2000);
  await clearOverlays(page);
  const after = await page.evaluate(() => {
    const g = G;
    const m = g.currentMonster;
    return { word: m.word, id: m.id,
             foe: (typeof baFoeIdOf === 'function') ? baFoeIdOf(g) : '',
             skill: (typeof baSkillNow === 'function' && baSkillNow()) ? baSkillNow().en : '',
             barM: (typeof BA_BAR !== 'undefined' && BA_BAR) ? (BA_BAR.m === m) : null,
             pin: (typeof m.baPin === 'number') ? m.baPin : null,
             left: (typeof QUESTION_ENDS !== 'undefined') ? (QUESTION_ENDS - Date.now()) : 0,
             full: (typeof questionMs === 'function') ? questionMs() : 0,
             marked: document.querySelectorAll('#gChoices .g-choice.right,#gChoices .g-choice.wrong').length,
             disabled: document.querySelectorAll('#gChoices .g-choice[disabled]').length,
             count: document.querySelectorAll('#gChoices .g-choice').length,
             shown: (document.getElementById('gWord') || {}).textContent || '' };
  });
  return { before: before, after: after };
}

(async () => {
  fs.writeFileSync(LOG, 'test_triple_gauge · ' + new Date().toISOString() + '\n');
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
    ms: BA_CUR_MS, push: BA_CUR_PUSH, blk: BA_CUR_BLK, seal: BA_CUR_SEAL, hast: BA_CUR_HAST,
    order: BA_CURSES.map(c => c.id), n: BA_CURSES.length,
    desc: BA_CURSES.map(c => c.desc).join(' | ')
  }));
  ok(K.ms === 7000, 'หลอดคำสาปเต็มทุก 7.0 วิ [' + K.ms + ']');
  ok(K.push === 10, 'ตอบถูกดันถอยได้เพียง 10% [' + K.push + ']');
  ok(K.blk === 2000, 'Abyssal Blackout จอดับ 2.0 วิ [' + K.blk + ']');
  ok(K.seal === 4000, 'Seal of Silence ล็อกปุ่ม 4.0 วิ [' + K.seal + ']');
  ok(K.hast === 2500, 'Panic Haste เวลาข้อถัดไปเหลือ 2.5 วิ [' + K.hast + ']');
  ok(K.n === 3 && K.order.join(',') === 'blackout,seal,haste',
     'คิวคำสาปเรียง 1-2-3 ตามสเปก [' + K.order.join(',') + ']');
  ok(/2\.0 วิ/.test(K.desc) && /4\.0 วิ/.test(K.desc) && /2\.5 วิ/.test(K.desc),
     'ข้อความบนแบนเนอร์ประกอบจากค่าคงที่เอง (เลขบนจอตรงกับเลขที่ทำงานจริง)');

  // ═══ 2) หลอดที่สามโผล่เฉพาะไฟต์บอส ═════════════════════════════════
  blk('2 · หลอดที่สามโผล่เฉพาะบอส');
  for (const f of [4, 8, 12, 16, 20]) {
    await goFloor(page, f);
    const a = await audit(page);
    ok(a.curse.on === true && a.curse.shown === true && a.curse.bar === true,
       'ชั้น ' + f + ' (บอสประจำโซน) มีหลอดคำสาปครบ');
  }
  for (const f of [3, 7, 11, 15, 19]) {
    await goFloor(page, f);
    const a = await audit(page);
    ok(a.curse.on === false && a.curse.shown === false, 'ชั้น ' + f + ' (อีลีท) ไม่มีหลอดคำสาป');
  }
  for (const f of [1, 2, 5, 9, 13, 17]) {
    await goFloor(page, f);
    const a = await audit(page);
    ok(a.curse.on === false, 'ชั้น ' + f + ' (อสูรทั่วไป) ไม่มีหลอดคำสาป');
  }

  // ═══ 3) Kamish 21-25 ของโหมดเหวลึกก็ต้องมีหลอดคำสาป ════════════════
  blk('3 · Kamish (โหมดเหวลึก) มีหลอดคำสาป');
  for (const f of [4, 12, 20]) {
    /* **Patch v8.3 · ทัพเงาผูกกับลำดับ account.ax.idx ไม่ผูกกับชั้นอีกแล้ว**
       ตั้งลำดับเป็นช่วง Kamish (21-25) เอง แล้ววนยืนคนละชั้นเพื่อพิสูจน์ว่า
       หลอดคำสาปมาจากระดับของทัพเงา ไม่ได้มาจากเลขชั้น */
    await page.evaluate(i => {
      if (G.ab) G.ab.abyss = true;
      if (typeof baAxMine === 'function' && baAxMine()) baAxMine().idx = i;
    }, 21 + [4, 12, 20].indexOf(f));
    await goFloor(page, f);
    const a = await page.evaluate(() => {
      const o = baBattleAudit();
      return { on: o.curse.on, myth: (typeof baShMythic === 'function') ? baShMythic() : false,
               id: (typeof baShNow === 'function' && baShNow()) ? baShNow().id : '' };
    });
    ok(a.myth === true && a.on === true, 'เหวลึกชั้น ' + f + ' = Kamish ' + a.id + ' มีหลอดคำสาป');
  }
  await page.evaluate(() => { if (G.ab) G.ab.abyss = false; });

  // ═══ 4) รางหลอด 3 เส้น — เรียงเรียบร้อยในแถวเดียว ไม่ดันเลย์เอาต์ ═══
  blk('4 · เรขาคณิตของราง 3 เส้น');
  await goFloor(page, 12);
  /* บังคับคำและตัวเลือกให้คงที่ก่อนวัดการ์ด — ความสูงการ์ดขึ้นกับความยาวข้อความ
     ของคำที่สุ่มได้ ถ้าไม่บังคับ ตัวเลขจะแกว่งโดยไม่เกี่ยวกับโค้ดเลย
     (ชุดเดียวกับที่ verify_arena.js ใช้ — คำที่ยาวที่สุดใน VOCAB) */
  await page.evaluate(() => {
    const m = G.currentMonster;
    m.word = '北京语言大学';
    m.pinyin = 'Běijīng Yǔyán Dàxué';
    m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
    m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
    document.getElementById('gWord').textContent = m.word;
    document.getElementById('gPinyin').textContent = m.pinyin;
    document.getElementById('gQuestion').textContent = 'เลือกความหมายภาษาไทยที่ถูกต้อง';
    const fb = document.getElementById('gFeedback');
    fb.textContent = ''; fb.className = 'g-feedback';
    renderChoices();
  });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForTimeout(250);
  const geo = await page.evaluate(() => {
    const R = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height, w: b.width }; };
    const plate = document.querySelector('#baArena .ba-foe .ba-plate');
    return {
      bat: R(document.getElementById('baBatBar')),
      atb: R(document.getElementById('baAtbBar')),
      cur: R(document.getElementById('baCurBar')),
      plate: R(plate),
      arena: R(document.getElementById('baArena')),
      card: R(document.querySelector('.ac-battle'))
    };
  });
  ok(geo.bat && geo.atb && geo.cur, 'หลอดครบทั้งสามใบบนจอ');
  ok(Math.abs(geo.bat.t - geo.atb.t) < 0.6 && Math.abs(geo.atb.t - geo.cur.t) < 0.6,
     'ทั้งสามใบอยู่ราวเดียวกัน (แบ่งราง ไม่ได้ต่อลงล่าง)');
  ok(Math.abs(geo.bat.h - 3) < 0.6 && Math.abs(geo.atb.h - 3) < 0.6 && Math.abs(geo.cur.h - 3) < 0.6,
     'สูงใบละ 3px เท่าเดิมทั้งชุด');
  ok(geo.bat.r <= geo.atb.l + 0.5 && geo.atb.r <= geo.cur.l + 0.5, 'เรียงซ้าย→ขวาโดยไม่ทับกันเลย');
  ok(geo.cur.r <= geo.plate.r + 0.5 && geo.bat.l >= geo.plate.l - 0.5, 'ทั้งชุดอยู่ในแผ่นป้าย');
  ok(geo.cur.b <= geo.arena.b + 0.5, 'ไม่ล้นออกนอกกรอบสนาม (overflow:hidden จะตัดหัวขาด)');
  /* **ห้องบอสการ์ดสูง 387.8px มาตั้งแต่ก่อนแพตช์นี้แล้ว** เพราะแถบเกราะผนึกของ v4.6
     งอกเพิ่มเข้ามาเฉพาะชั้นบอส — วัดเทียบกับไฟล์แจกใบก่อนหน้าแล้วได้ตัวเลขเดียวกันเป๊ะ
     ส่วนค่าอ้างอิง 340.8px ของทั้ง repo เป็นของชั้นที่ไม่ใช่บอส (เช็กต่อข้างล่าง) */
  ok(Math.abs(geo.card.h - 387.8) < 0.6, 'ห้องบอส · การ์ดโจทย์สูง 387.8px เท่าก่อนแพตช์ [' + geo.card.h.toFixed(1) + ']');

  await goFloor(page, 2);
  await page.evaluate(() => {
    const m = G.currentMonster;
    m.word = '北京语言大学';
    m.pinyin = 'Běijīng Yǔyán Dàxué';
    m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
    m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
    document.getElementById('gWord').textContent = m.word;
    document.getElementById('gPinyin').textContent = m.pinyin;
    document.getElementById('gQuestion').textContent = 'เลือกความหมายภาษาไทยที่ถูกต้อง';
    const fb = document.getElementById('gFeedback');
    fb.textContent = ''; fb.className = 'g-feedback';
    renderChoices();
  });
  await page.waitForTimeout(250);
  const cardN = await page.evaluate(() => {
    const c = document.querySelector('.ac-battle');
    return c ? c.getBoundingClientRect().height : 0;
  });
  ok(Math.abs(cardN - 340.8) < 0.6, 'ชั้นปกติ · การ์ดโจทย์ยังสูง 340.8px เท่าเดิม [' + cardN.toFixed(1) + ']');

  const geo2 = await page.evaluate(() => {
    const R = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; };
    if (typeof BA_CUR !== 'undefined') { BA_CUR = 0; }
    const a = document.getElementById('baArena');
    a.classList.remove('ba-curse');
    const o = { bat: R(document.getElementById('baBatBar')), atb: R(document.getElementById('baAtbBar')),
                cur: getComputedStyle(document.getElementById('baCurBar')).display };
    baCurPaint();
    return o;
  });
  ok(geo2.cur === 'none', 'ไม่มีคลาส ba-curse = หลอดคำสาปถูกซ่อน');
  ok(geo2.atb.r - geo2.bat.l > 0, 'ไฟต์ที่ไม่ใช่บอสกลับไปเป็นหลอดคู่ของ v6.5');

  // ═══ 5) เกจเดินจริง + ตอบถูกดันถอยแค่ 10% ══════════════════════════
  blk('5 · เกจเดินจริง · แรงดันกลับ 10%');
  await goFloor(page, 12);
  const run = await page.evaluate(async () => {
    BA_CUR = 0; baCurPaint();
    await new Promise(r => setTimeout(r, 1500));
    return { g: BA_CUR, fighting: baFighting() };
  });
  ok(run.fighting === true, 'อยู่ในสถานะสู้จริง (เงื่อนไขของเกจ)');
  ok(run.g > 12 && run.g < 32, 'เดินไป ~1.5 วิ ได้เกจราว 21% [' + run.g.toFixed(1) + ']');

  const push = await page.evaluate(() => {
    BA_CUR = 60; baCurPaint();
    const before = BA_CUR;
    baCurPush(BA_CUR_PUSH);
    return { before: before, after: BA_CUR };
  });
  ok(Math.abs((push.before - push.after) - 10) < 0.001, 'ดันถอย 10% พอดี [' + push.before + '→' + push.after + ']');

  const pushAns = await page.evaluate(() => {
    BA_CUR = 80; baCurPaint();
    baAfterAnswer(true, false, false, G.currentMonster, 0);
    return BA_CUR;
  });
  ok(Math.abs(pushAns - 70) < 0.001, 'ตอบถูกจริงดันถอย 10% [80→' + pushAns + ']');

  const pushMiss = await page.evaluate(() => {
    BA_CUR = 80; baCurPaint();
    baAfterAnswer(false, false, false, G.currentMonster, 0);
    return BA_CUR;
  });
  ok(Math.abs(pushMiss - 80) < 0.001, 'ตอบผิดไม่ดันถอยเลย [' + pushMiss + ']');

  // ═══ 6) คิวคำสาปวนลูป 1-2-3 แน่นอน 100% ════════════════════════════
  blk('6 · คิววนลูปแน่นอน ไม่มีสุ่มดวง');
  await goFloor(page, 12);
  const seq = await page.evaluate(() => {
    const real = Math.random; let n = 0;
    Math.random = function () { n++; return real(); };
    const out = [];
    try {
      BA_CUR_K = 0; BA_CUR_N = 0;
      for (let i = 0; i < 6; i++) {
        out.push(baBattleAudit().curse.next);
        BA_CUR = 100;
        baCurFire();
        baClearQ();                                   /* ปลดล็อกปุ่มก่อนรอบถัดไป */
        const bl = document.getElementById('baBlack');
        if (bl) bl.classList.remove('on');
      }
    } finally { Math.random = real; }
    BA_CUR_HZ = false;
    return { out: out, rnd: n, fired: BA_CUR_N };
  });
  ok(seq.out.join(',') === 'blackout,seal,haste,blackout,seal,haste',
     'ปล่อยคำสาปวนลูป 1-2-3 เป๊ะหกรอบติด [' + seq.out.join(',') + ']');
  ok(seq.fired === 6, 'นับจำนวนครั้งที่ปล่อยได้ถูกต้อง [' + seq.fired + ']');
  ok(seq.rnd === 0, 'ตรรกะคำสาปไม่เรียก Math.random สักครั้ง (กับดักข้อ 32) [' + seq.rnd + ']');

  // ═══ 7) คำสาปทั้งสามใบทำงานจริงบนหน้าจอ ════════════════════════════
  blk('7 · คำสาปสามใบทำงานจริง');
  await goFloor(page, 12);
  await page.evaluate(() => { BA_CUR_K = 0; BA_CUR = 100; baCurFire(); });
  /* **ต้องรอ transition ของม่านให้จบก่อนวัด opacity** — อ่านทันทีที่เพิ่งเติมคลาส
     จะได้ "ค่าเริ่มต้นของทรานซิชัน" ไม่ใช่ค่าปลายทาง (บทเรียนของชุด v6.5) */
  await page.waitForTimeout(420);
  const c1 = await page.evaluate(() => {
    const bl = document.getElementById('baBlack');
    const cs = bl ? getComputedStyle(bl) : null;
    return { on: !!(bl && bl.classList.contains('on')),
             op: cs ? +cs.opacity : 0, fixed: cs ? cs.position : '',
             z: cs ? +cs.zIndex : 0, next: baBattleAudit().curse.next };
  });
  ok(c1.on === true && c1.op > 0.9, '① Abyssal Blackout — จอดับจริง (opacity ' + c1.op + ')');
  ok(c1.fixed === 'fixed' && c1.z >= 140, 'ม่านดับเป็น fixed ทับทั้งจอ (z=' + c1.z + ')');
  ok(c1.next === 'seal', 'คิวเลื่อนไปใบที่ 2 แล้ว');
  await page.waitForTimeout(1900);
  const c1b = await page.evaluate(() => !!(document.getElementById('baBlack') || {}).classList.contains('on'));
  ok(c1b === false, 'จอสว่างคืนเองหลัง 2.0 วิ');

  /* **ต้องล้าง Grace Period ของ v6.11 ก่อนยิงคำสาปใบถัดไปแบบติด ๆ กัน** —
     Anti-Chain Stun มอบเกราะ 1.5 วิ ทุกครั้งที่หลุดจาก Blackout/Seal แล้วกัน
     debuff ปิดกั้นใบถัดไปไว้โดยชอบธรรม · ในการเล่นจริงไม่มีทางชนกันเลย เพราะเกจ
     คำสาปเต็มทุก 7.0 วิ (BA_CUR_MS) ซึ่งห่างจากเกราะ 1.5 วิ อยู่มาก
     ที่ชนคือเทสต์ยิงเองสองใบห่างกันแค่ ~0.3 วิ เท่านั้น */
  const c2 = await page.evaluate(() => {
    if (typeof BA_GP_UNTIL !== 'undefined') BA_GP_UNTIL = 0;
    BA_CUR = 100;
    baCurFire();
    const list = Array.from(document.querySelectorAll('#gChoices .g-choice'));
    return { n: list.length, dis: list.filter(b => b.disabled).length,
             gray: list.filter(b => b.classList.contains('ba-stone')).length,
             timer: !!QUESTION_TIMER, next: baBattleAudit().curse.next };
  });
  ok(c2.n > 0 && c2.dis === c2.n && c2.gray === c2.n,
     '② Seal of Silence — ล็อกปุ่มทั้งหมดเป็นสีเทา [' + c2.dis + '/' + c2.n + ']');
  ok(c2.timer === true, 'หลอดเวลา/หลอดโจมตียังเดินตามปกติระหว่างถูกผนึก');
  ok(c2.next === 'haste', 'คิวเลื่อนไปใบที่ 3 แล้ว');
  const c2b = await page.evaluate(() => baFighting());
  ok(c2b === true, 'ระหว่างถูกผนึก เกจทั้งสามยังเดินอยู่ (baFighting เป็นจริง)');
  await page.waitForTimeout(4300);
  const c2c = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('#gChoices .g-choice'));
    return list.filter(b => b.disabled).length;
  });
  ok(c2c === 0, 'ปลดล็อกปุ่มคืนเองหลัง 4.0 วิ');

  const c3 = await page.evaluate(() => {
    if (typeof BA_GP_UNTIL !== 'undefined') BA_GP_UNTIL = 0;   /* เหตุผลเดียวกับ c2 */
    BA_CUR = 100;
    baCurFire();
    return { hz: BA_CUR_HZ, next: baBattleAudit().curse.next };
  });
  ok(c3.hz === true, '③ Panic Haste — ตั้งธงรอ "ข้อถัดไป" แล้ว');
  ok(c3.next === 'blackout', 'คิววนกลับไปใบที่ 1 ครบรอบ');
  const c3b = await page.evaluate(() => {
    G.locked = false;
    startQuestionTimer();
    return { left: QUESTION_ENDS - Date.now(), full: questionMs(), hz: BA_CUR_HZ,
             timers: !!QUESTION_TIMER && !!QUESTION_TICK };
  });
  ok(c3b.left > 2100 && c3b.left <= 2600, 'เวลาข้อถัดไปถูกบีบเหลือ 2.5 วิ [' + Math.round(c3b.left) + 'ms จากเต็ม ' + c3b.full + ']');
  ok(c3b.hz === false, 'ธงถูกกินไปแล้ว ไม่ค้างไปข้อถัด ๆ ไป');
  ok(c3b.timers === true, 'นาฬิกาข้อถูกตั้งใหม่ครบทั้งตัวจับเวลาและตัวนับ');
  const c3c = await page.evaluate(() => {
    G.locked = false;
    startQuestionTimer();
    return QUESTION_ENDS - Date.now();
  });
  ok(c3c > 4000, 'ข้อถัดจากนั้นได้เวลาเต็มตามปกติ [' + Math.round(c3c) + 'ms]');

  // ═══ 8) หลอดคำสาปไม่เดินตอนไม่ใช่บอส / ตอนเกมหยุด ═══════════════════
  blk('8 · เกจหยุดตามกติกาเดิมของ baFighting');
  await goFloor(page, 2);
  const off = await page.evaluate(async () => {
    BA_CUR = 40; baCurPaint();
    await new Promise(r => setTimeout(r, 900));
    return { g: BA_CUR, on: baCurOn() };
  });
  ok(off.on === false && off.g === 0, 'ชั้นที่ไม่ใช่บอส เกจถูกล้างเป็น 0 และไม่เดิน [' + off.g + ']');

  await goFloor(page, 12);
  const paused = await page.evaluate(async () => {
    BA_CUR = 30; baCurPaint();
    acTogglePause();
    const b = BA_CUR;
    await new Promise(r => setTimeout(r, 900));
    const a = BA_CUR;
    acResumeClick();
    return { b: b, a: a, paused: true };
  });
  ok(Math.abs(paused.a - paused.b) < 0.001, 'เกมหยุด = เกจคำสาปหยุดตาม [' + paused.b + '→' + paused.a + ']');
  await clearOverlays(page);

  // ═══ 9) Dynamic Question Flow — ตอบถูกก็เปลี่ยน ตอบผิดก็เปลี่ยน ═════
  blk('9 · เปลี่ยนโจทย์ทุกครั้งที่ตอบจบข้อ');
  for (const spec of [{ f: 2, t: 'อสูรทั่วไป' }, { f: 7, t: 'อีลีท' }, { f: 12, t: 'บอส' }]) {
    await goFloor(page, spec.f);
    const rc = await answerOne(page, true);
    ok(rc.after.word !== rc.before.word, spec.t + ' · ตอบถูกแล้วได้โจทย์คำใหม่ [' + rc.before.word + '→' + rc.after.word + ']');
    ok(rc.after.shown === rc.after.word, spec.t + ' · คำใหม่ถูกวาดลงจอจริง');
    const rw = await answerOne(page, false);
    ok(rw.after.word !== rw.before.word, spec.t + ' · ตอบผิดแล้วได้โจทย์คำใหม่ [' + rw.before.word + '→' + rw.after.word + ']');
    ok(rw.after.marked === 0 && rw.after.disabled === 0 && rw.after.count >= 2,
       spec.t + ' · ปุ่มชอยส์ถูกล้างสีและกดได้ทันที [' + rw.after.count + ' ปุ่ม]');
    ok(rw.after.left > rw.after.full * 0.85,
       spec.t + ' · หลอดเวลาถูกรีเซ็ตเต็มหลอด [' + Math.round(rw.after.left) + '/' + rw.after.full + ']');
  }

  // ═══ 10) เปลี่ยนโจทย์ต้องไม่ทำให้ "ไฟต์" เปลี่ยนตาม ════════════════
  blk('10 · หน้าอสูร · สกิล · เกราะ ต้องไม่เปลี่ยนตามโจทย์');
  await goFloor(page, 12);
  const keep = await page.evaluate(() => {
    const g = G;
    g.monsterMaxHp = 999999; g.monsterHp = 999999;
    return { m: (g.currentMonster === (BA_BAR ? BA_BAR.m : null)), bar: BA_BAR ? BA_BAR.max : 0 };
  });
  const k1 = await answerOne(page, true);
  const k2 = await answerOne(page, false);
  ok(k1.after.foe === k1.before.foe && k2.after.foe === k2.before.foe,
     'หน้าอสูรถูกปักหมุดไว้ ไม่เปลี่ยนตามคำ [' + k1.before.foe + ']');
  ok(k1.after.skill === k1.before.skill && k2.after.skill === k2.before.skill,
     'สกิลประจำตัวถูกปักหมุดไว้เหมือนกัน [' + k1.before.skill + ']');
  ok(typeof k2.after.pin === 'number' && k2.after.pin !== k2.after.id,
     'หมุด baPin ถูกตั้งไว้และแยกจาก id ของคำ [pin=' + k2.after.pin + ' id=' + k2.after.id + ']');
  const keep2 = await page.evaluate(() => ({
    same: !!(BA_BAR && BA_BAR.m === G.currentMonster),
    rs: (typeof BA_RS !== 'undefined' && BA_RS) ? (BA_RS.m === G.currentMonster) : null,
    curseOn: baBattleAudit().curse.on,
    fired: baBattleAudit().curse.fired
  }));
  ok(keep.m === true && keep2.same === true, 'เกราะของ v6.4/v6.7 ยังผูกกับไฟต์เดิม (ไม่ถูกตั้งใหม่)');
  ok(keep2.rs !== false, 'สถานะต้านทานของ v6.7 ยังผูกกับไฟต์เดิม');
  ok(keep2.curseOn === true, 'หลอดคำสาปยังอยู่ครบหลังเปลี่ยนโจทย์สองรอบ');

  // ═══ 11) โหมดฝึกจุดอ่อนไม่เปลี่ยนโจทย์ ═════════════════════════════
  blk('11 · โหมดฝึกจุดอ่อนไม่ถูกแตะ');
  await goFloor(page, 3, { practice: true });
  const pr = await page.evaluate(() => {
    const g = G;
    g.monsterMaxHp = 999999; g.monsterHp = 999999;
    g.locked = false;
    const m = g.currentMonster;
    const w = m.word;
    resolveAnswer(m.choices.filter(c => c !== m.answer)[0], null, false);
    return { w: w, curse: baBattleAudit().curse.on, pend: baBattleAudit().flow.pending };
  });
  await page.waitForTimeout(2000);
  const pr2 = await page.evaluate(() => G.currentMonster.word);
  ok(pr.pend === false, 'โหมดฝึกไม่ตั้งธงเปลี่ยนโจทย์');
  ok(pr2 === pr.w, 'โหมดฝึกยังวนคำเดิมจนกว่าจะตอบถูก [' + pr.w + ']');
  ok(pr.curse === false, 'โหมดฝึกไม่มีหลอดคำสาป');
  await page.evaluate(() => { G.practiceMode = false; });

  // ═══ 12) เปลี่ยนไฟต์ = ล้างคิวคำสาปกลับไปเริ่มที่ใบที่ 1 ════════════
  blk('12 · ล้างสถานะตอนเปลี่ยนไฟต์/ออกจากเกม');
  await goFloor(page, 12);
  await page.evaluate(() => { BA_CUR = 55; BA_CUR_K = 2; BA_CUR_N = 9; BA_CUR_HZ = true; baCurPaint(); });
  await goFloor(page, 16);
  const reset = await audit(page);
  /* เกจถูกล้างเป็น 0 แล้วเริ่มเดินใหม่ทันที กว่าจะอ่านค่าได้จึงขยับไปบ้างแล้ว
     สิ่งที่ต้องพิสูจน์คือ "เริ่มนับใหม่" ไม่ใช่ "ค้างที่ 0" — เทียบกับ 55 ที่ยัดไว้ */
  ok(reset.curse.gauge < 30 && reset.curse.k === 0 && reset.curse.next === 'blackout',
     'ไฟต์ใหม่ = เกจเริ่มนับใหม่และคิวกลับไปใบที่ 1 [' + reset.curse.gauge + '/' + reset.curse.next + ']');
  ok(reset.curse.haste === false && reset.curse.fired === 0, 'ธง Panic Haste กับตัวนับถูกล้างด้วย');

  const bye = await page.evaluate(() => {
    exitGame();
    return { g: BA_CUR, k: BA_CUR_K, hz: BA_CUR_HZ, dq: baBattleAudit().flow.pending };
  });
  ok(bye.g === 0 && bye.k === 0 && bye.hz === false && bye.dq === false,
     'ออกจากเกม = สถานะของชั้นนี้ถูกล้างครบ');

  // ═══ 13) เลย์เอาต์ · ความปลอดภัยรวม ════════════════════════════════
  blk('13 · เลย์เอาต์และความปลอดภัยรวม');
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(200);
  const nar = await page.evaluate(() => ({
    w: document.body.scrollWidth, v: window.innerWidth,
  }));
  ok(nar.w <= nar.v, 'จอ 320 ไม่ล้นแนวนอน [' + nar.w + '/' + nar.v + ']');
  /* ความสูงการ์ดรายความกว้างเป็นหน้าที่ของ verify_arena.js ซึ่งเปิดหน้าเพจใหม่
     ต่อหนึ่งความกว้างตามกติกาของ repo — ที่นี่วัดแค่ว่าไม่ล้นแนวนอน */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);

  const net = await page.evaluate(() => (window.__NET || []).length);
  ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุด [' + errs.slice(0, 2).join(' | ') + ']');
  const bad = await page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
        .filter(e => /cur[A-Z]|dq[A-Z]|curse:/.test(String((e && e.where) || ''))).length;
    } catch (e) { return -1; }
  });
  ok(bad === 0, 'Error Log ไม่มีรายการของชั้น v6.8 [' + bad + ']');
  fs.appendFileSync(LOG, '\n(คำขอเน็ตที่ถูก stub ไว้ ' + net + ' ครั้ง)\n');

  fs.appendFileSync(LOG, '\n══ สรุป ══\nผ่าน ' + pass + ' · ตก ' + fail + '\n');
  console.log('\n══════════════════════════════════\nผ่าน ' + pass + ' · ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
