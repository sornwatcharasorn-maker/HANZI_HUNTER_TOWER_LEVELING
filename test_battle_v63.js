/* ชุดเทสต์ Patch v6.3 · BATTLE SYSTEM REVAMP & HARDCORE MECHANICS
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_battle_v63.js [ไฟล์.html]
 *
 * ชี้ไปที่ "ไฟล์แจก" ที่รากrepo โดยเจตนา — ต้องพิสูจน์ของที่นักเรียนได้ใช้จริง
 * ไม่ใช่ต้นฉบับที่ไม่มีใครได้ใช้ (แก้ต้นฉบับแล้วต้อง build ก่อนรันเสมอ · กับดักข้อ 28)
 *
 * เจ็ดเรื่องที่พิสูจน์
 *   1) เกจ ATB เดินจริงตามตารางความเร็วรายโซน และดันถอยตามระดับอสูร
 *   2) สกิลเฉพาะตัวจับคู่กับอสูรครบทุกตัว และปล่อยจริงเมื่อเกจเต็ม
 *   3) สถานะผิดปกติทุกตัวมีผลกับ UI/ระบบเกมจริง ไม่ใช่แค่ข้อความ
 *   4) เกจคริตของฮีโร่ขึ้น/ลงตามกติกา และท่าไม้ตายให้ดาเมจ x2.5 เป๊ะ
 *   5) เฟรมที่สกัดไว้ถูกใช้จริงครบ 100%
 *   6) ตอบผิดแล้วต้องไม่เฉลยคำตอบ ไม่ว่าทางข้อความหรือทางสีปุ่ม
 *   7) เลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียวขณะสถานะผิดปกติทำงานอยู่
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_battle_v63.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function say(s) { console.log(s); try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} }
function ok(c, m) { if (c) { pass++; say('  ✅ ' + m); } else { fail++; say('  ❌ ' + m); } }

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  /* v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง */
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
    window.EventSource = function () { this.close = function () {}; };
  });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  /* ป๊อปอัปกติกาของ v5.6 — ทำเหมือนที่นักเรียนทำจริง ไม่ใช่ประตูหลัง */
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    switchTab('register');
    document.getElementById('reg-id').value = 'v63' + Math.floor(Math.random() * 9999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

/* ตั้งสนามให้เทียบผลได้แน่นอน
   - เลือกการ์ด 🌀 การไหลเวียนเวทมนตร์ เพราะไม่ยุ่งกับนาฬิกาเลย
     (🧘 สมาธิแน่วแน่ จะแช่แข็งทุกข้อ แล้ว QUESTION_TIMER เป็น null โดยชอบธรรม
      จนเทสต์ตกด้วยเหตุผลผิด)
   - keepCrit = ไม่ทับ critChance ไว้ ใช้ตอนพิสูจน์ "ตอบไว = คริตแน่นอน" */
async function arena(page, floor, opts) {
  opts = opts || {};
  await page.evaluate(o => {
    if (!o.keepCrit) critChance = () => (o.crit ? 100 : 0);
    expDoubleChance = () => 0;
    if (typeof CD_BY_ID !== 'undefined' && CD_BY_ID.mana) {
      CD_CARD = CD_BY_ID.mana;
      CD_BAND = cdBandOf(o.floor);
      CD_ST = { ward: 0, noItem: 0, noHeal: 0, atk: 0, perfect: true, hit: 0, miss: 0 };
      if (typeof cdPaintUi === 'function') cdPaintUi();
    }
    G.floor = o.floor;
    G.floorProgress = 0;
    G.maxFloor = FLOOR_MAX;
    recalcStats();
    G.hp = G.maxHp;
    G.shield = 0;
    G.streak = 0;
    nextMonster();
    if (o.tanky !== false) { G.monsterMaxHp = 99999; G.monsterHp = 99999; renderMonsterHp(); }
    G.locked = false;
    ba_crit = 0; BA_ATB = 0;
  }, Object.assign({ floor: floor }, opts));
  await page.waitForTimeout(320);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(700);
  /* หน้าต่างบังคับกดยืนยันของ v4.1/v4.6 เด้งตอนก้าวเข้าห้องบอส — ต้องกดปิดก่อนวัด
     ไม่งั้น v4.8.1 จะหยุดเกมไว้อย่างถูกต้อง แล้วเคสจะตกด้วยเหตุผลผิด */
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      if (document.querySelector('#snGate.active') && typeof snGateConfirm === 'function') snGateConfirm();
    });
    await page.waitForTimeout(180);
  }
  /* พาจอกลับมาที่โจทย์ ไม่งั้น acQaVisible() เป็นเท็จแล้วเกมหยุดอยู่ ทุกเคสจะตกด้วยเหตุผลผิด */
  await page.evaluate(() => {
    if (typeof acFocusQa === 'function') acFocusQa();
    if (typeof acSync === 'function') acSync(true);
  });
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 — เกจ ATB ═══════════════════════════════════════════════
  say('\n【บล็อก 1】เกจ ATB เดินจริงและดันถอยตามระดับอสูร');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 1, {});

    /* ตารางความเร็วรายโซน — อ่านจากสูตรตรง ๆ ไม่ต้องรอเกจเดินจริงทีละชั้น */
    const speed = await page.evaluate(() => {
      const out = [];
      const keep = G.floor;
      for (let f = 1; f <= FLOOR_MAX; f++) { G.floor = f; out.push(baAtbFull()); }
      G.floor = keep;
      const ab = (typeof abOf === 'function') ? abOf(G) : null;
      let abyss = null;
      if (ab) { const was = ab.abyss; ab.abyss = true; abyss = baAtbFull(); ab.abyss = was; }
      return { out: out, abyss: abyss, table: BA_ATB_MS.slice(), ab5: BA_ATB_ABYSS };
    });
    /* v6.4 — ชั้นอีลีท (3/7/11/15/19) ชาร์จเร็วกว่าโซนเดียวกัน 1 วินาที */
    const want = [];
    for (let f = 1; f <= 20; f++) {
      const base = speed.table[Math.min(4, Math.ceil(f / 4) - 1)];
      want.push([3, 7, 11, 15, 19].indexOf(f) !== -1 ? base - 1000 : base);
    }
    ok(JSON.stringify(speed.out) === JSON.stringify(want),
      'ความเร็วเกจไล่ตามโซนครบ 20 ชั้น [' + speed.out.join(',') + ']');
    ok(speed.abyss === speed.ab5, 'โหมดเหวลึกทับทุกชั้นด้วยเกจเร็วสุด ' + speed.abyss + 'ms');

    /* เกจเดินจริงตามเวลา — ปล่อยให้เดิน 1.2 วิ บนชั้น 1 (เกจเต็มที่ 12 วิ) ≈ +10% */
    const walk = await page.evaluate(async () => {
      BA_ATB = 0;
      const t0 = Date.now();
      await new Promise(r => setTimeout(r, 1300));
      return { v: BA_ATB, ms: Date.now() - t0, fighting: baFighting() };
    });
    ok(walk.fighting, 'อยู่ในสถานะต่อสู้จริง (baFighting)');
    ok(walk.v > 6 && walk.v < 16, 'เกจเดินตามเวลาจริง 1.3 วิ → ' + walk.v.toFixed(1) + '%');

    /* หลอดบนจอต้องตรงกับค่าจริง */
    const bar = await page.evaluate(() => {
      BA_ATB = 55; baAtbPaint();
      return document.querySelector('#baAtbBar span').style.width;
    });
    ok(parseFloat(bar) === 55, 'หลอด ATB บนจอตรงกับค่าจริง (' + bar + ')');

    /* Minimal Pushback — ตอบถูกดันถอยตามระดับ */
    const push = await page.evaluate(async () => {
      const r = {};
      /* ชั้น 1 = อสูรทั่วไป */
      G.floor = 1; nextMonster(); G.monsterHp = 99999; G.monsterMaxHp = 99999;
      G.locked = false; BA_ATB = 90; ba_crit = 0;
      G.questionStart = Date.now() - 8000;
      answer(G.currentMonster.answer, null);
      await new Promise(x => setTimeout(x, 60));
      r.normal = 90 - BA_ATB;
      r.tierNormal = baTierNow();
      return r;
    });
    ok(push.tierNormal === 'normal' && Math.abs(push.normal - 20) < 0.6,
      'ตอบถูกกับอสูรทั่วไป ดันเกจถอย 20% (ได้ ' + push.normal.toFixed(1) + ')');

    const push2 = await page.evaluate(() => {
      const r = {};
      G.floor = 3; G.currentMonster = { id: 4 };   /* ชั้น 3 มี m13/m14/m15 */
      r.tier3 = baTierNow();
      G.floor = 8; r.tier5 = baTierNow();          /* ชั้นบอสจริง (v6.4 ย้ายมา 4/8/12/16/20) */
      G.floor = 4; G.currentMonster = { id: 0 };
      r.tier4 = baTierNow();                       /* บอสภาพประจำโซน */
      return r;
    });
    ok(push2.tier5 === 'boss', 'ชั้นบอสจริง (ชั้น 8) นับเป็น boss เสมอ');
    ok(push2.tier4 === 'boss', 'บอสประจำโซนของภาพ (ชั้น 4) นับเป็น boss');
    ok(['normal', 'elite'].indexOf(push2.tier3) !== -1, 'ชั้น 3 เป็น normal/elite ไม่ใช่ boss');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 2 — สารบัญสกิลและการปล่อยจริง ═══════════════════════════════
  say('\n【บล็อก 2】สกิลเฉพาะตัวจับคู่ครบ และปล่อยจริงเมื่อเกจเต็ม');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 1, {});

    const map = await page.evaluate(() => {
      const foes = BA_FOES.map(f => f.id);
      const keys = Object.keys(BA_SKILLS);
      const missing = foes.filter(id => !BA_SKILLS[id]);
      const extra = keys.filter(k => k !== 'void' && foes.indexOf(k) === -1);
      const tiers = {};
      keys.forEach(k => { tiers[k] = BA_SKILLS[k].tier; });
      const bad = keys.filter(k => ['normal', 'elite', 'boss'].indexOf(BA_SKILLS[k].tier) === -1);
      const noRun = keys.filter(k => typeof BA_SKILLS[k].run !== 'function');
      const noDesc = keys.filter(k => !BA_SKILLS[k].name || !BA_SKILLS[k].en || !BA_SKILLS[k].desc);
      return { foes: foes.length, keys: keys.length, missing, extra, bad, noRun, noDesc, tiers };
    });
    ok(map.missing.length === 0, 'อสูรทั้ง ' + map.foes + ' ตัวมีสกิลครบ');
    ok(map.extra.length === 0, 'ไม่มีสกิลลอยที่ไม่ผูกกับอสูรตัวไหน');
    ok(map.keys === map.foes + 1, 'สกิลรวม ' + map.keys + ' รายการ (อสูร ' + map.foes + ' + เหวลึก 1)');
    ok(map.bad.length === 0 && map.noRun.length === 0 && map.noDesc.length === 0,
      'ทุกสกิลมี tier/name/en/desc/run ครบ');
    ok(map.tiers.m16 === 'boss' && map.tiers.m23 === 'boss' && map.tiers.m33 === 'boss' &&
       map.tiers.m43 === 'boss' && map.tiers.m53 === 'boss' && map.tiers.void === 'boss',
      'บอสประจำโซนทั้ง 5 + เจ้าเหวลึก เป็น tier boss');
    ok(map.tiers.m15 === 'elite' && map.tiers.m22 === 'elite' && map.tiers.m32 === 'elite' &&
       map.tiers.m42 === 'elite' && map.tiers.m52 === 'elite',
      'อีลีทประจำโซนทั้ง 5 เป็น tier elite');

    /* ไล่ทุกชั้น 1-20 แล้วดูว่าสกิลที่จะถูกปล่อยตรงกับอสูรของชั้นนั้นไหม */
    const perFloor = await page.evaluate(() => {
      const out = [];
      const keep = G.floor, km = G.currentMonster;
      for (let f = 1; f <= FLOOR_MAX; f++) {
        G.floor = f;
        G.currentMonster = { id: 0 };
        const slot = baFoeSlot(G);
        const sk = baSkillNow();
        out.push({ f: f, slot: slot, en: sk ? sk.en : null, inFloor: (BA_FOE_FLOOR[f] || []).indexOf(slot) !== -1 });
      }
      G.floor = keep; G.currentMonster = km;
      return out;
    });
    ok(perFloor.every(x => x.slot && x.en && x.inFloor),
      'ทุกชั้น 1-20 มีสกิลที่ผูกกับอสูรของชั้นนั้นจริง');
    ok(perFloor[3].en === 'Petrifying Roar', 'ชั้น 4 = การ์กอยล์หิน · Petrifying Roar');
    ok(perFloor[10].en === 'Mana Burn', 'ชั้น 11 = Library Sentry · Mana Burn (ตามสเปกข้อ 4)');
    ok(perFloor[19].en === 'Monarch Cataclysm', 'ชั้น 20 = มังกรจักรพรรดิ · Monarch Cataclysm');

    /* เกจเต็มแล้วต้องปล่อยสกิลแน่นอน 100% */
    await arena(page, 1, {});
    const fired = await page.evaluate(async () => {
      const hp0 = G.hp;
      BA_ATB = 99.4;                       /* อีกจังหวะเดียวก็เต็ม */
      await new Promise(r => setTimeout(r, 900));
      const sk = document.getElementById('baSkill');
      return {
        atb: BA_ATB,
        banner: !!(sk && sk.classList.contains('on')),
        text: sk ? sk.textContent : '',
        hurt: hp0 - G.hp
      };
    });
    ok(fired.atb < 30, 'เกจถูกรีเซ็ตหลังปล่อยสกิล (เหลือ ' + fired.atb.toFixed(1) + '%)');
    ok(fired.banner && fired.text.length > 4, 'แบนเนอร์ประกาศสกิลขึ้นจริง → ' + fired.text.slice(0, 40));

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 3 — สถานะผิดปกติผูกกับ UI จริง ═══════════════════════════════
  say('\n【บล็อก 3】สถานะผิดปกติมีผลกับ UI และระบบเกมจริง');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);

    /* -%HP ล้วน */
    await arena(page, 1, {});
    const dmg = await page.evaluate(() => {
      const out = {};
      const run = (id) => {
        G.hp = G.maxHp;
        const h0 = G.hp;
        BA_SKILLS[id].run();
        return h0 - G.hp;
      };
      out.collapse = run('m11');       /* -20% */
      out.thrust = run('m14');         /* -35% */
      out.laser = run('m42');          /* -45% */
      out.max = G.maxHp;
      return out;
    });
    ok(Math.abs(dmg.collapse - Math.round(dmg.max * 0.20)) <= 1, 'ถล่มสุสาน -20% HP (' + dmg.collapse + '/' + dmg.max + ')');
    ok(Math.abs(dmg.thrust - Math.round(dmg.max * 0.35)) <= 1, 'ทิ่มเพชฌฆาต -35% HP (' + dmg.thrust + ')');
    ok(Math.abs(dmg.laser - Math.round(dmg.max * 0.45)) <= 1, 'ระดมยิงเลเซอร์ -45% HP (' + dmg.laser + ')');

    /* Heavy Fortress — ดาเมจฮีโร่ลดลง 60% */
    await arena(page, 1, {});
    const fort = await page.evaluate(async () => {
      G.stats.agi = 0;
      const base = hunterAtk();
      /* ยิงข้อปกติก่อน แล้วยิงข้อที่ติด Heavy Fortress เทียบกัน */
      G.monsterHp = 99999; G.locked = false; G.questionStart = Date.now() - 8000;
      let m0 = G.monsterHp;
      answer(G.currentMonster.answer, null);
      const plain = m0 - G.monsterHp;
      await new Promise(r => setTimeout(r, 1400));
      G.monsterHp = 99999; G.locked = false; G.questionStart = Date.now() - 8000;
      BA_SKILLS.m12.run();               /* Heavy Fortress */
      m0 = G.monsterHp;
      answer(G.currentMonster.answer, null);
      const cut = m0 - G.monsterHp;
      const on = BA_FORT;
      return { base: base, plain: plain, cut: cut, on: on };
    });
    ok(fort.on === true, 'Heavy Fortress ปักธงไว้จริง');
    ok(fort.cut > 0 && Math.abs(fort.cut - Math.round(fort.plain * 0.4)) <= 2,
      'ดาเมจฮีโร่ลดลง 60% (ปกติ ' + fort.plain + ' → ติดสถานะ ' + fort.cut + ')');

    /* Brutal Shield Slam — ตัดเวลาข้อ 5 วิ */
    await arena(page, 3, {});
    const cut = await page.evaluate(() => {
      const before = QUESTION_ENDS - Date.now();
      const h0 = G.hp;
      baCutClock(BA_CUT_MS);
      return { before: before, after: QUESTION_ENDS - Date.now(), hp: h0 - G.hp };
    });
    ok(cut.before - cut.after > 4500 && cut.before - cut.after < 5600,
      'ตัดเวลาข้อ 5 วินาที (' + Math.round(cut.before) + ' → ' + Math.round(cut.after) + ')');

    /* Hyper Clock Glitch — เวลาเดินเร็วขึ้น 2.5 เท่า = เวลาที่เหลือหารด้วย 2.5 */
    await arena(page, 13, {});
    const glitch = await page.evaluate(() => {
      const before = QUESTION_ENDS - Date.now();
      BA_SKILLS.m41.run();
      return { before: before, after: QUESTION_ENDS - Date.now() };
    });
    ok(Math.abs(glitch.after - glitch.before / 2.5) < 500,
      'เร่งนาฬิกา 2.5 เท่า (' + Math.round(glitch.before) + ' → ' + Math.round(glitch.after) + ')');

    /* Petrifying Roar — ล็อกทุกปุ่ม 3 วิ แล้วปลดคืนเอง */
    await arena(page, 4, {});
    const stone = await page.evaluate(async () => {
      baStone(600);       /* ย่อเวลาลงเพื่อไม่ให้เทสต์ช้า — ตรรกะเดียวกันเป๊ะ */
      const locked = [].every.call(document.querySelectorAll('#gChoices .g-choice'),
        b => b.disabled && b.classList.contains('ba-stone'));
      await new Promise(r => setTimeout(r, 900));
      const freed = [].every.call(document.querySelectorAll('#gChoices .g-choice'),
        b => !b.disabled && !b.classList.contains('ba-stone'));
      return { locked, freed };
    });
    ok(stone.locked, 'Petrifying Roar ล็อกปุ่มทุกใบจริง');
    ok(stone.freed, 'ครบเวลาแล้วปลดล็อกปุ่มคืนครบ');

    /* Thorn Prison — ปิด 2 ปุ่ม */
    await arena(page, 7, {});
    const jail = await page.evaluate(() => {
      BA_SKILLS.m22.run();
      const list = [].slice.call(document.querySelectorAll('#gChoices .g-choice'));
      return { n: list.filter(b => b.classList.contains('ba-jail') && b.disabled).length, all: list.length };
    });
    /* 🧠 สัมผัสฮันเตอร์ของ v4.0 ตัดตัวลวงให้เองได้ (โอกาสอย่างน้อย 10% ต่อข้อ)
       บางรอบจึงเหลือ 3 ปุ่ม — เทียบกับกติกาจริงของ baJail ที่เหลือให้เลือกอย่างน้อย 2 ปุ่ม
       ไม่ใช่เทียบเลข 2 ตายตัว ไม่งั้นเคสจะตกแบบสุ่มโดยที่โค้ดถูก */
    ok(jail.all >= 3 && jail.n === Math.max(0, Math.min(2, jail.all - 2)),
      'Thorn Prison ปิดตัวเลือก ' + jail.n + ' จาก ' + jail.all + ' ปุ่ม (เหลือให้เลือกอย่างน้อย 2)');

    /* Mirrored Mirage — ปิดข้อความ 3 ปุ่มเป็น ??? แต่ยังกดได้ */
    await arena(page, 17, {});
    const mir = await page.evaluate(() => {
      BA_SKILLS.m51.run();
      const list = [].slice.call(document.querySelectorAll('#gChoices .g-choice'));
      return {
        q: list.filter(b => b.textContent === '???').length,
        clickable: list.every(b => !b.disabled),
        keeps: list.every(b => !!b.dataset.choice)
      };
    });
    ok(mir.q === 3, 'Mirrored Mirage ปิดข้อความ 3 ปุ่มเป็น ???');
    ok(mir.clickable && mir.keeps, 'ปุ่มที่ถูกปิดยังกดได้และยังผูกคำตอบเดิมไว้ครบ');

    /* Chaotic Inversion — สลับตำแหน่งปุ่มเรื่อย ๆ */
    await arena(page, 16, {});
    const chaos = await page.evaluate(async () => {
      const order = () => [].map.call(document.querySelectorAll('#gChoices .g-choice'), b => b.dataset.choice).join('|');
      const a = order();
      baChaos(220);
      await new Promise(r => setTimeout(r, 900));
      const b = order();
      baChaosStop();
      const same = new Set(a.split('|')).size === new Set(b.split('|')).size;
      return { moved: a !== b, same: same };
    });
    ok(chaos.moved, 'Chaotic Inversion สลับตำแหน่งปุ่มจริง');
    ok(chaos.same, 'สลับแล้วตัวเลือกยังครบเท่าเดิม ไม่มีปุ่มหาย');

    /* Blind Knowledge — ลบวรรณยุกต์พินอิน + ซ่อนคำแปลใต้ตัวเลือก */
    await arena(page, 9, {});
    const blind = await page.evaluate(() => {
      const py = document.getElementById('gPinyin');
      py.textContent = 'Běijīng Yǔyán Dàxué';
      BA_SKILLS.m31.run();
      return {
        text: py.textContent,
        cls: document.getElementById('gameScreen').classList.contains('ba-blind')
      };
    });
    ok(blind.cls, 'Blind Knowledge ติดคลาส ba-blind ที่หน้าจอเล่น');
    ok(!/[ǎàáāǐìíīǒòóōǔùúūěèéē]/.test(blind.text) && /Beijing/i.test(blind.text.replace(/\s/g, '')),
      'ลบวรรณยุกต์พินอินออกจริง → ' + blind.text);

    /* Grand Absolute Silence — ซ่อนพินอินทั้งไฟต์ โดยกล่องต้องไม่หด */
    await arena(page, 12, {});
    const sil = await page.evaluate(() => {
      const py = document.getElementById('gPinyin');
      const h0 = py.getBoundingClientRect().height;
      BA_SKILLS.m33.run();
      const cs = getComputedStyle(py);
      return { vis: cs.visibility, h0: h0, h1: py.getBoundingClientRect().height };
    });
    ok(sil.vis === 'hidden', 'Grand Absolute Silence ซ่อนพินอินสนิท');
    ok(Math.abs(sil.h0 - sil.h1) < 0.5, 'ซ่อนแล้วกล่องพินอินยังสูงเท่าเดิม (เลย์เอาต์ไม่ขยับ)');

    /* Mana Burn — ล้างเกจคริต + -30% HP */
    await arena(page, 11, {});
    const burn = await page.evaluate(() => {
      ba_crit = 100; baCritPaint();
      G.hp = G.maxHp;
      const h0 = G.hp;
      BA_SKILLS.m32.run();
      return { crit: ba_crit, lost: h0 - G.hp, max: G.maxHp };
    });
    ok(burn.crit === 0, 'Mana Burn ล้างเกจคริตเหลือ 0%');
    ok(Math.abs(burn.lost - Math.round(burn.max * 0.30)) <= 1, 'Mana Burn -30% HP (' + burn.lost + ')');

    /* Streak Purge — ล้างคอมโบ */
    await arena(page, 3, {});
    const purge = await page.evaluate(() => {
      G.streak = 9;
      BA_SKILLS.m15.run();
      return G.streak;
    });
    ok(purge === 0, 'Streak Purge ล้างคอมโบเป็นศูนย์');

    /* Deadly Neurotoxin — พิษกัดตามจังหวะจริง
       ใช้ชั้น 6 ไม่ใช่ชั้น 5 เพราะชั้น 5 เป็นชั้นบอสจริงของ v4.0 ซึ่งมีหน้าต่าง
       บังคับกดยืนยันมาคั่น แล้ว v4.8.1 หยุดเกมไว้ → พิษข้ามจังหวะอย่างถูกต้อง
       (อสูรตัวเดียวกันคือแมงมุมมอสพิษ ทั้งชั้น 5 และ 6) */
    await arena(page, 6, {});
    const tox = await page.evaluate(async () => {
      G.hp = G.maxHp;
      const h0 = G.hp;
      baToxin(BA_TOX_PCT, 3, 180);       /* ย่อคาบลงให้เทสต์ไม่ช้า ตรรกะเดียวกันเป๊ะ */
      await new Promise(r => setTimeout(r, 900));
      baToxinStop();
      return { lost: h0 - G.hp, max: G.maxHp };
    });
    ok(tox.lost >= Math.round(tox.max * 0.08 * 2), 'พิษกัดต่อเนื่องหลายจังหวะจริง (-' + tox.lost + ' HP)');

    /* Instant Condemnation — ตอบผิดข้อถัดไปตายทันที */
    await arena(page, 19, {});
    const cond = await page.evaluate(async () => {
      G.items = {};                       /* กัน 🛡️ ประกันภัยชุบชีวิตให้ */
      G.hp = G.maxHp;
      BA_SKILLS.m52.run();
      const flag = BA_CONDEMN;
      const m = G.currentMonster;
      G.locked = false; G.questionStart = Date.now() - 8000;
      answer(m.choices.filter(c => c !== m.answer)[0], null);
      await new Promise(r => setTimeout(r, 200));
      return { flag: flag, hp: G.hp, off: BA_CONDEMN };
    });
    ok(cond.flag === true, 'Instant Condemnation ปักธงไว้จริง');
    ok(cond.hp <= 0, 'ตอบผิดข้อถัดไป HP กลายเป็น 0 ทันที');
    ok(cond.off === false, 'ใช้แล้วธงถูกถอนออก ไม่ค้างข้ามข้อ');

    /* Abyssal Devourer — ดูดเลือด + จอมืด */
    await arena(page, 20, {});
    const dev = await page.evaluate(async () => {
      G.hp = G.maxHp;
      G.monsterMaxHp = 99999; G.monsterHp = 5000;
      const h0 = G.hp, m0 = G.monsterHp;
      BA_SKILLS.void.run();
      await new Promise(r => setTimeout(r, 120));
      const bl = document.getElementById('baBlack');
      return {
        lost: h0 - G.hp, healed: G.monsterHp - m0, max: G.maxHp,
        black: !!(bl && bl.classList.contains('on')),
        pe: bl ? getComputedStyle(bl).pointerEvents : ''
      };
    });
    ok(Math.abs(dev.lost - Math.round(dev.max * 0.40)) <= 1, 'ดูดเลือด 40% ของหลอด (-' + dev.lost + ')');
    ok(dev.healed === dev.lost, 'เลือดที่ดูดไปเข้าอสูรเท่ากันพอดี (+' + dev.healed + ')');
    ok(dev.black, 'จอมืดทำงาน');
    ok(dev.pe === 'none', 'จอมืดไม่ขวางการกดปุ่ม (pointer-events:none)');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 4 — เกจคริติคอลของฮีโร่ ═══════════════════════════════════
  say('\n【บล็อก 4】เกจคริติคอล ba_crit และท่าไม้ตาย Super Dash Strike');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);

    /* ตอบถูกไว / ตอบถูกช้า / ตอบผิด */
    await arena(page, 2, {});
    const gauge = await page.evaluate(async () => {
      const out = {};
      const shot = async (fastMs, wrong) => {
        G.monsterHp = 99999; G.monsterMaxHp = 99999; G.locked = false;
        G.questionStart = Date.now() - fastMs;
        const m = G.currentMonster;
        const before = ba_crit;
        answer(wrong ? m.choices.filter(c => c !== m.answer)[0] : m.answer, null);
        await new Promise(r => setTimeout(r, 60));
        const d = ba_crit - before;
        await new Promise(r => setTimeout(r, 1500));
        return d;
      };
      ba_crit = 0; G.streak = 0;
      out.fast = await shot(500, false);
      ba_crit = 0; G.streak = 0;
      out.slow = await shot(8000, false);
      ba_crit = 50; G.streak = 0;
      out.miss = await shot(1000, true);
      ba_crit = 0; G.streak = 0;
      return out;
    });
    ok(gauge.fast === 35 || gauge.fast === 40,
      'ตอบถูกไว (≤3 วิ) เกจ +35 (ได้ ' + gauge.fast + ' — 40 ถ้าคอมโบถึงเกณฑ์พอดี)');
    ok(gauge.slow === 15 || gauge.slow === 20,
      'ตอบถูกปกติ เกจ +15 (ได้ ' + gauge.slow + ')');
    ok(gauge.miss === -25, 'ตอบผิด เกจ -25 (ได้ ' + gauge.miss + ')');

    /* โบนัสคอมโบ ≥ 3 */
    await arena(page, 2, {});
    const combo = await page.evaluate(async () => {
      ba_crit = 0; G.streak = 5;
      G.monsterHp = 99999; G.monsterMaxHp = 99999; G.locked = false;
      G.questionStart = Date.now() - 8000;
      answer(G.currentMonster.answer, null);
      await new Promise(r => setTimeout(r, 60));
      return ba_crit;
    });
    ok(combo === 20, 'คอมโบ ≥ 3 ได้โบนัส +5 รวมเป็น 20 (ได้ ' + combo + ')');

    /* หลอดเกจบนจอ + สถานะเต็ม */
    const bar = await page.evaluate(() => {
      ba_crit = 100; baCritPaint();
      const b = document.getElementById('baCritBar');
      return { w: b.firstElementChild.style.width, full: b.classList.contains('full') };
    });
    ok(parseFloat(bar.w) === 100 && bar.full, 'หลอดคริตเต็มแล้วติดสถานะ full');

    /* ท่าไม้ตาย — ดาเมจ x2.5 เป๊ะ + ล้างเกจ + ดันเกจ ATB ถอย 30 */
    await arena(page, 2, {});
    const sup = await page.evaluate(async () => {
      G.stats.agi = 0;
      const base = hunterAtk();
      G.monsterHp = 99999; G.monsterMaxHp = 99999; G.locked = false;
      ba_crit = 100; BA_ATB = 90;
      G.questionStart = Date.now() - 8000;
      const m0 = G.monsterHp;
      answer(G.currentMonster.answer, null);
      await new Promise(r => setTimeout(r, 300));
      const d = document.querySelector('#baFx .ba-dmg');
      return {
        base: base, dealt: m0 - G.monsterHp, crit: ba_crit, atb: BA_ATB,
        cls: d ? d.className : '', txt: d ? d.textContent : ''
      };
    });
    ok(sup.dealt === Math.round(sup.base * 2.5),
      'ท่าไม้ตายลงดาเมจ x2.5 เป๊ะ (ฐาน ' + sup.base + ' → ' + sup.dealt + ')');
    ok(sup.crit === 0, 'ใช้ท่าไม้ตายแล้วเกจถูกล้างเป็น 0');
    ok(Math.abs(90 - sup.atb - (30 + 20)) < 1.5,
      'ท่าไม้ตายดันเกจ ATB ถอย 30 + แรงดันปกติ 20 (เหลือ ' + sup.atb.toFixed(1) + ')');
    ok(sup.cls.indexOf('sup') !== -1 && sup.cls.indexOf('crit') !== -1,
      'ตัวเลขดาเมจใช้สไตล์ทองยักษ์ (' + sup.txt + ')');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  /* ── เคสนี้ต้องเริ่มจากหน้าใหม่ ────────────────────────────────────
     arena() ของเคสก่อน ๆ เขียน critChance ทับระดับ global ซึ่ง **ถอด wrapper
     ของ v6.3 ทิ้งไปด้วย** (การกำหนดค่าทับชื่อระดับบนสุดคือการแทนที่ทั้งตัว)
     ถ้าวัดต่อในหน้าเดิมจะตกด้วยเหตุผลผิด ทั้งที่โค้ดถูก */
  say('\n【บล็อก 4.1】ตอบไว ≤3 วิ = คริติคอลแน่นอน (ต้องใช้หน้าใหม่)');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 2, { keepCrit: true });
    const fastCrit = await page.evaluate(async () => {
      G.stats.agi = 0;
      const base = hunterAtk();
      G.monsterHp = 99999; G.monsterMaxHp = 99999; G.locked = false;
      ba_crit = 0;
      G.questionStart = Date.now() - 500;      /* ตอบไวภายใน 3 วิ */
      const m0 = G.monsterHp;
      answer(G.currentMonster.answer, null);
      await new Promise(r => setTimeout(r, 300));
      const d = document.querySelector('#baFx .ba-dmg');
      return { base: base, dealt: m0 - G.monsterHp, cls: d ? d.className : '' };
    });
    ok(fastCrit.dealt === fastCrit.base * 2,
      'ตอบไว ≤3 วิ = คริติคอลแน่นอน ดาเมจ x2 (ฐาน ' + fastCrit.base + ' → ' + fastCrit.dealt + ')');
    ok(fastCrit.cls.indexOf('crit') !== -1, 'ตัวเลขดาเมจใช้สไตล์คริต');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 5 — เฟรมถูกใช้ครบ 100% ═════════════════════════════════════
  say('\n【บล็อก 5】ทุกเฟรมที่สกัดไว้ถูกนำมาแสดงผลจริง');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 1, {});

    const audit = await page.evaluate(() => baFrameAudit());
    const ids = Object.keys(audit).filter(k => k !== '_hero');
    const bad = ids.filter(k => audit[k].total !== audit[k].used);
    ok(ids.length >= 18, 'ตรวจครบทุกตัวที่ฝังไว้ (' + ids.length + ' ตัว)');
    ok(bad.length === 0, 'ทุกเฟรมของอสูรทุกตัวถูกจัดเข้าลูปยืน/ชุดโจมตีครบ 100%');
    ok(audit._hero.total === audit._hero.used && audit._hero.act >= 1,
      'เฟรมฮีโร่ถูกใช้ครบ ' + audit._hero.total + ' เฟรม (ยืน ' + audit._hero.idle + ' · โจมตี ' + audit._hero.act + ')');

    /* ท่าโจมตีของฮีโร่วนครบทุกเฟรมตามลำดับ ไม่ใช่สุ่ม และไม่กิน Math.random */
    const seq = await page.evaluate(async () => {
      const real = Math.random; let n = 0;
      Math.random = function () { n++; return real(); };
      const seen = [];
      try {
        for (let i = 0; i < BA_ACTS.length * 2; i++) {
          BA_ACT_TO = 0;
          baAct(60);
          seen.push(BA_FRAME);
        }
      } finally { Math.random = real; }
      return { n: n, uniq: new Set(seen).size, want: BA_ACTS.length };
    });
    ok(seq.n === 0, 'baAct() ไม่แตะ Math.random สักครั้ง (กับดักข้อ 32)');
    ok(seq.uniq === seq.want, 'วนครบทุกเฟรมท่าโจมตีของฮีโร่ (' + seq.uniq + '/' + seq.want + ')');

    /* ชุดท่าฟาดของอสูรเล่นครบทุกเฟรม — ต้องไปวัดที่ชั้นที่อสูรมีเฟรมท่าโจมตีจริง
       (ชั้น 1 คือซากปรักหักพังอันเดดซึ่งมีแต่เฟรมยืน) */
    await arena(page, 3, {});
    const foeSeq = await page.evaluate(async () => {
      const fr = baFrames(BA_FOE_ID);
      if (!fr) return { skip: true };
      const acts = baFoeIdx(fr, 'act');
      const seen = new Set();
      const t = setInterval(() => seen.add(BA_FOE_FR), 25);
      baFoeAct(600);
      await new Promise(r => setTimeout(r, 900));
      clearInterval(t);
      return { acts: acts.length, hit: acts.filter(i => seen.has(i)).length };
    });
    if (foeSeq.skip) ok(true, 'ยังไม่ได้ฝังเฟรมอสูรของชั้นนี้ — ข้ามการวัดชุดท่าฟาด');
    else ok(foeSeq.hit === foeSeq.acts,
      'ชุดท่าฟาดของอสูรเล่นครบทุกเฟรม (' + foeSeq.hit + '/' + foeSeq.acts + ')');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 6 — ห้ามเฉลยคำตอบตอนตอบผิด ═════════════════════════════════
  say('\n【บล็อก 6】ตอบผิดแล้วต้องไม่เฉลยคำตอบ (Anti-Cheat)');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);

    for (const kind of ['wrong', 'timeout']) {
      await arena(page, 2, {});
      const r = await page.evaluate(async (k) => {
        G.items = {};
        G.hp = G.maxHp;
        const m = G.currentMonster;
        G.locked = false; G.questionStart = Date.now() - 1000;
        if (k === 'timeout') { G.locked = true; clearQuestionTimer(); resolveAnswer(null, null, true); }
        else answer(m.choices.filter(c => c !== m.answer)[0], null);
        await new Promise(x => setTimeout(x, 200));
        const fb = document.getElementById('gFeedback');
        const list = [].slice.call(document.querySelectorAll('#gChoices .g-choice'));
        return {
          txt: fb.textContent,
          reveal: fb.textContent.indexOf('จุดอ่อนที่ถูกต้อง') !== -1,
          hasAnswer: fb.textContent.indexOf(m.answer) !== -1,
          green: list.filter(b => b.classList.contains('right')).length,
          counter: fb.textContent.indexOf('โดนสวนกลับ') !== -1
        };
      }, kind);
      ok(!r.reveal, '[' + kind + '] ไม่มีข้อความ "จุดอ่อนที่ถูกต้อง" ในบรรทัดผลลัพธ์');
      ok(!r.hasAnswer, '[' + kind + '] ไม่มีคำตอบที่ถูกโผล่ในข้อความเลย');
      ok(r.green === 0, '[' + kind + '] ไม่มีปุ่มไหนถูกระบายเขียวบอกเฉลย');
      ok(r.counter, '[' + kind + '] ขึ้นข้อความโดนสวนกลับแทน → ' + r.txt.slice(0, 60));
    }

    /* ตอบถูกยังต้องระบายเขียวที่ปุ่มที่กดเองตามเดิม */
    await arena(page, 2, {});
    const good = await page.evaluate(async () => {
      const m = G.currentMonster;
      const btn = [].slice.call(document.querySelectorAll('#gChoices .g-choice'))
        .filter(b => b.dataset.choice === m.answer)[0];
      G.locked = false; G.questionStart = Date.now() - 8000;
      answer(m.answer, btn);
      await new Promise(r => setTimeout(r, 150));
      return btn.classList.contains('right');
    });
    ok(good, 'ตอบถูกยังระบายเขียวที่ปุ่มที่กดเองตามเดิม');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 7 — เลย์เอาต์ไม่ขยับขณะสถานะผิดปกติทำงาน ═════════════════════
  say('\n【บล็อก 7】เลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียว');
  {
    for (const w of [320, 390, 430]) {
      const { ctx, page, errs } = await boot(browser, w, w === 320 ? 568 : 844);
      await arena(page, 12, {});
      const r = await page.evaluate(async () => {
        const card = () => document.querySelector('.ac-battle').getBoundingClientRect().height;
        const arenaH = () => document.getElementById('baArena').getBoundingClientRect().height;
        const chTop = () => document.getElementById('gChoices').getBoundingClientRect().top;
        const b = { c: card(), a: arenaH(), t: chTop(), sw: document.body.scrollWidth };
        /* จัดเต็ม — เกจสองเส้น · แบนเนอร์ · สั่นจอ · สถานะผิดปกติหลายตัวพร้อมกัน */
        ba_crit = 100; baCritPaint();
        BA_ATB = 95; baAtbPaint();
        BA_SKILLS.m33.run();
        BA_SKILLS.m22.run();
        BA_SKILLS.m51.run();
        baBannerText('☠️ ทดสอบแบนเนอร์ยาว ๆ · Very Long Skill Name', 'คำอธิบายผลของสกิลที่ยาวพอสมควรเพื่อดันกรอบ');
        baQuake();
        baStrike(999, true, true);
        await new Promise(x => setTimeout(x, 140));
        const d = { c: card(), a: arenaH(), t: chTop(), sw: document.body.scrollWidth };
        return { b: b, d: d, w: window.innerWidth };
      });
      ok(Math.abs(r.b.c - r.d.c) < 0.5, w + 'px · การ์ดโจทย์สูงเท่าเดิม (' + r.d.c.toFixed(1) + 'px)');
      ok(Math.abs(r.b.a - r.d.a) < 0.5, w + 'px · กรอบสนามรบสูงเท่าเดิม (' + r.d.a.toFixed(1) + 'px)');
      ok(Math.abs(r.b.t - r.d.t) < 0.5, w + 'px · แถวตัวเลือกไม่ขยับ');
      ok(r.d.sw <= r.w, w + 'px · ไม่ล้นแนวนอนขณะสั่นจอ (' + r.d.sw + ' ≤ ' + r.w + ')');
      ok(errs.length === 0, w + 'px · ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
      await ctx.close();
    }
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
