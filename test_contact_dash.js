/* ชุดเทสต์ Patch v9.3 · UNIVERSAL CONTACT DASH & IMPACT SLASH VFX —
 *   ทางสำรองพุ่งเต็มระยะฝั่งฮีโร่ (สายที่ยังไม่มีภาพสไปรต์) + เอฟเฟกต์ Slash VFX
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_contact_dash.js [ไฟล์.html]
 *
 * ชี้ไปที่ "ไฟล์แจก" ที่รากrepo โดยเจตนา — ต้องพิสูจน์ของที่นักเรียนได้ใช้จริง
 * ไม่ใช่ต้นฉบับที่ไม่มีใครได้ใช้ (แก้ต้นฉบับแล้วต้อง build ก่อนรันเสมอ · กับดักข้อ 28)
 *
 * สามเรื่องที่พิสูจน์
 *   1) โครงสร้าง — baBattleAudit().contactDash มีอยู่จริง · CSS ถูกฉีดแล้ว
 *   2) ทางสำรองพุ่งเต็มระยะ — ยิงเฉพาะตอน !baAnimOn(g) (สายไม่มีภาพสไปรต์)
 *      ไม่ยิงซ้ำทับตอนสายมีภาพอยู่แล้ว (กันชนกับ baTriggerSkillAnim ของ v8.7)
 *   3) Slash VFX — เกิดที่จังหวะ BA_IMPACT ทั้งสองฝั่ง (ยกเว้นฝั่งฮีโร่ตอนเกราะ
 *      บล็อกไว้) แล้วล้างตัวเองหมดโดยไม่ทิ้งอะไรค้างใน #baFx (CLS = 0)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_contact_dash.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function say(s) { console.log(s); try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} }
function ok(c, m) { if (c) { pass++; say('  ✅ ' + m); } else { fail++; say('  ❌ ' + m); } }
function head(s) { say('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 58 - s.length))); }

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
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
    document.getElementById('reg-id').value = 'v93' + Math.floor(Math.random() * 9999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

/* ตั้งสนามให้เทียบผลได้แน่นอน — ท่าเดียวกับ arena() ของ test_combat_v9.js */
async function arena(page, floor, opts) {
  opts = opts || {};
  await page.evaluate(o => {
    critChance = () => (o.crit ? 100 : 0);
    expDoubleChance = () => 0;
    if (typeof CD_BAND !== 'undefined') {
      CD_CARD = null;
      CD_BAND = cdBandOf(o.floor);
      CD_SKIP = o.floor;
      CD_ST = { ward: 0, noItem: 0, noHeal: 0, atk: 0, perfect: true, hit: 0, miss: 0 };
      if (typeof cdPaintUi === 'function') cdPaintUi();
    }
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = o.floor; BA_INC_AT = -1; BA_INC_M = null; }
    G.floor = o.floor;
    G.floorProgress = 0;
    G.maxFloor = FLOOR_MAX;
    if (o.classId) G.classId = o.classId;
    if (o.level) G.level = o.level;
    recalcStats();
    G.hp = G.maxHp;
    G.shield = o.shield || 0;
    G.streak = 0;
    G.items = {};
    nextMonster();
    if (o.tanky !== false) { G.monsterMaxHp = 99999; G.monsterHp = 99999; renderMonsterHp(); }
    G.locked = false;
    if (typeof ba_crit !== 'undefined') ba_crit = 0;
    if (typeof BA_ATB !== 'undefined') BA_ATB = 0;
  }, Object.assign({ floor: floor }, opts));
  await page.waitForTimeout(320);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      if (document.querySelector('#snGate.active') && typeof snGateConfirm === 'function') snGateConfirm();
    });
    await page.waitForTimeout(180);
  }
  await page.evaluate(() => {
    if (typeof acFocusQa === 'function') acFocusQa();
    if (typeof acSync === 'function') acSync(true);
  });
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  const { page, errs } = await boot(browser);
  const ev = fn => page.evaluate(fn);
  const evA = (fn, a) => page.evaluate(fn, a);

  // ══ บล็อก 1 · โครงสร้างของแพตช์ ═══════════════════════════════════════
  head('บล็อก 1 · โครงสร้างของแพตช์');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const a = await ev(() => baBattleAudit().contactDash);
    ok(!!a, 'baBattleAudit().contactDash มีอยู่จริง');
    ok(a.ver === '9.3', 'ตราเวอร์ชัน 9.3 — ได้ "' + a.ver + '"');
    ok(a.styled === true, 'CSS ของแพตช์นี้ถูกฉีดแล้ว (#baV93Style)');
    ok(typeof a.n.fallback === 'number' && typeof a.n.slashFoe === 'number' &&
       typeof a.n.slashHero === 'number', 'ตัวนับ fallback/slashFoe/slashHero มีอยู่ในทะเบียน');
    const css = await ev(() => document.getElementById('baV93Style').textContent);
    ok(css.indexOf('.ba-slash-vfx') >= 0 && css.indexOf('@keyframes baSlashVfx') >= 0,
      'มีกฎ .ba-slash-vfx และคีย์เฟรม baSlashVfx');
    ok(css.indexOf('cqw') < 0, 'ไม่มี container query units (cqw) ในกฎที่ฉีดจริง — ใช้ baSpot() แทน');
  }

  // ══ บล็อก 2 · ทางสำรองพุ่งเต็มระยะ — สายที่ไม่มีภาพสไปรต์ ═════════════
  head('บล็อก 2 · ทางสำรองพุ่งเต็มระยะ (!baAnimOn)');
  {
    /* เคลียร์ทะเบียนของสาย priest ทิ้งชั่วคราวเองในเทสต์ (ท่าเดียวกับ
       test_skill_anim บล็อก 6 / test_skill_dispatch บล็อก 5) แล้วคืนค่าเดิมกลับ */
    await arena(page, 1, { classId: 'priest', level: 1, tanky: true });
    const before = await ev(() => baBattleAudit().contactDash.n.fallback);
    const r = await ev(() => {
      baPlSwitch('priest');
      const backup = JSON.parse(JSON.stringify(ba.assetRegistry.priest.c1.anim));
      Object.keys(ba.assetRegistry.priest.c1.anim).forEach(k => {
        ba.assetRegistry.priest.c1.anim[k].u = '';
      });
      baAnimRevert();
      const on = baBattleAudit().skillAnim.on;
      G.questionStart = Date.now() - 6000;
      baStrike(12, false, false);
      const cls = Array.from(document.getElementById('baHero').classList);
      const nAfter = baBattleAudit().contactDash.n.fallback;
      Object.keys(backup).forEach(k => { ba.assetRegistry.priest.c1.anim[k].u = backup[k].u; });
      return { on: on, cls: cls, nAfter: nAfter };
    });
    ok(r.on === false, 'baAnimOn(G) เป็นเท็จตอนไม่มีภาพเลยสักสถานะ');
    ok(r.nAfter === before + 1, 'ตัวนับ fallback ขยับ +1 (' + before + ' → ' + r.nAfter + ')');
    ok(r.cls.indexOf('ba-anm-in') >= 0, 'ได้คลาสท่าพุ่งเต็มระยะของ baFullMeleeStrike (ba-anm-in)');
    ok(r.cls.indexOf('ba-atk') < 0 && r.cls.indexOf('ba-atk2') < 0,
      'ท่าพุ่งสั้นเดิมของ v6.3 ไม่เหลืออยู่ (ba-atk/ba-atk2 ถูกถอดแล้ว)');
  }

  // ══ บล็อก 3 · ไม่ยิงทางสำรองซ้ำตอนสายมีภาพอยู่แล้ว ══════════════════
  head('บล็อก 3 · ไม่ยิงทางสำรองซ้ำตอนสายมีภาพสไปรต์อยู่แล้ว');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const before = await ev(() => baBattleAudit().contactDash.n.fallback);
    const r = await ev(() => {
      G.questionStart = Date.now() - 6000;
      const on = baBattleAudit().skillAnim.on;
      baStrike(12, false, false);
      return { on: on, nAfter: baBattleAudit().contactDash.n.fallback };
    });
    ok(r.on === true, 'baAnimOn(G) เป็นจริงสำหรับสาย assassin ที่มีภาพฝังแล้ว');
    ok(r.nAfter === before, 'ตัวนับ fallback ไม่ขยับเลย (' + before + ' → ' + r.nAfter + ') — ไม่ชนกับ v8.7');
  }

  // ══ บล็อก 4 · Slash VFX — ฝั่งอสูรตอนฮีโร่ตอบถูก ═════════════════════
  head('บล็อก 4 · Slash VFX ที่ตัวอสูรตอน baStrike');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    await ev(() => { document.getElementById('baFx').innerHTML = ''; });
    const before = await ev(() => baBattleAudit().contactDash.n.slashFoe);
    await ev(() => { G.questionStart = Date.now() - 6000; baStrike(12, false, false); });
    await page.waitForTimeout(230); /* > BA_IMPACT (170ms) */
    const mid = await ev(() => ({
      n: baBattleAudit().contactDash.n.slashFoe,
      slash: document.querySelector('#baFx .ba-slash-vfx'),
      left: document.querySelector('#baFx .ba-slash-vfx') ? parseFloat(document.querySelector('#baFx .ba-slash-vfx').style.left) : NaN,
      top: document.querySelector('#baFx .ba-slash-vfx') ? parseFloat(document.querySelector('#baFx .ba-slash-vfx').style.top) : NaN
    }));
    ok(mid.n === before + 1, 'ตัวนับ slashFoe ขยับ +1 (' + before + ' → ' + mid.n + ') ที่จังหวะ BA_IMPACT');
    ok(!!mid.slash, 'มี .ba-slash-vfx โผล่ในสนามจริง');
    ok(!isNaN(mid.left) && !isNaN(mid.top), 'ตำแหน่งวางด้วย baSpot() (left/top เป็นตัวเลขจริง ไม่ใช่ NaN)');
    await page.waitForTimeout(400); /* > อายุ 260ms ที่ตั้งไว้ */
    const gone = await ev(() => document.querySelectorAll('#baFx .ba-slash-vfx').length);
    eq0(gone, 'เอฟเฟกต์ล้างตัวเองหมดหลังเล่นจบ (เหลือ 0 ชิ้น)');
  }
  function eq0(v, m) { ok(v === 0, m + ' — ได้ ' + v); }

  // ══ บล็อก 5 · Slash VFX — ฝั่งฮีโร่ตอนอสูรสวนกลับ (ไม่บล็อก) ═════════
  head('บล็อก 5 · Slash VFX ที่ตัวฮีโร่ตอน baCounter (ไม่บล็อก)');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true, shield: 0 });
    await ev(() => { document.getElementById('baFx').innerHTML = ''; });
    const before = await ev(() => baBattleAudit().contactDash.n.slashHero);
    await ev(() => {
      G.hp = G.maxHp; G.shield = 0; G.questionStart = Date.now() - 8000;
      const m = G.currentMonster;
      answer(m.choices.filter(c => c !== m.answer)[0], null);
    });
    await page.waitForTimeout(230);
    const mid = await ev(() => ({
      n: baBattleAudit().contactDash.n.slashHero,
      count: document.querySelectorAll('#baFx .ba-slash-vfx').length
    }));
    ok(mid.n === before + 1, 'ตัวนับ slashHero ขยับ +1 (' + before + ' → ' + mid.n + ')');
    ok(mid.count >= 1, 'มี .ba-slash-vfx โผล่ที่ฝั่งฮีโร่');
    await page.waitForTimeout(400);
    const gone = await ev(() => document.querySelectorAll('#baFx .ba-slash-vfx').length);
    eq0(gone, 'เอฟเฟกต์ฝั่งฮีโร่ล้างตัวเองหมด');
  }

  // ══ บล็อก 6 · เกราะบล็อกไว้ = ไม่มี Slash VFX ที่ฝั่งฮีโร่ ═══════════
  head('บล็อก 6 · เกราะรับดาเมจไว้ต้องไม่มี Slash VFX ที่ฮีโร่');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true, shield: 9999 });
    await ev(() => { document.getElementById('baFx').innerHTML = ''; });
    const before = await ev(() => baBattleAudit().contactDash.n.slashHero);
    await ev(() => {
      G.hp = G.maxHp; G.shield = 9999; G.questionStart = Date.now() - 8000;
      const m = G.currentMonster;
      answer(m.choices.filter(c => c !== m.answer)[0], null);
    });
    await page.waitForTimeout(230);
    const n = await ev(() => baBattleAudit().contactDash.n.slashHero);
    ok(n === before, 'ตัวนับ slashHero ไม่ขยับตอนเกราะรับไว้ (' + before + ' → ' + n + ')');
  }

  // ══ บล็อก 7 · ความมั่นคง ═════════════════════════════════════════════
  head('บล็อก 7 · ความมั่นคง');
  {
    ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุดเทสต์ — ' + JSON.stringify(errs));
    const logCount = await ev(() => {
      try {
        const raw = localStorage.getItem('yao_errlog');
        if (!raw) return 0;
        return JSON.parse(raw).filter(e => (e.w || e.where || '').indexOf('v93:') >= 0).length;
      } catch (e) { return -1; }
    });
    ok(logCount === 0, 'ไม่มีรายการของชั้นนี้ตกลง Error Log ของ v4.3 (0 รายการ)');
    const randHits = await ev(() => {
      let n = 0;
      const orig = Math.random;
      Math.random = function () { n++; return orig(); };
      G.questionStart = Date.now() - 6000;
      baStrike(5, false, false);
      Math.random = orig;
      return n;
    });
    ok(randHits === 0, 'ตรรกะของชั้นนี้ไม่เรียก Math.random สักครั้ง (ได้ ' + randHits + ')');
  }

  // ══ บล็อก 8 · ความสูงการ์ดโจทย์ (CLS = 0) ═══════════════════════════
  head('บล็อก 8 · ความสูงการ์ดโจทย์ (CLS = 0)');
  {
    for (const w of [320, 390, 768]) {
      const p2 = await boot(browser, w, 844);
      await arena(p2.page, 1, { classId: 'assassin', level: 1, tanky: true });
      await p2.page.evaluate(() => {
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng Yǔyán Dàxué';
        document.getElementById('gFeedback').textContent = '';
        renderChoices();
      });
      await p2.page.waitForTimeout(150);
      const before = await p2.page.evaluate(() =>
        +document.querySelector('.ac-battle').getBoundingClientRect().height.toFixed(1));
      /* ยิงทั้งสองฝั่งพร้อมกัน แล้ววัดระหว่างเล่นเอฟเฟกต์ */
      await p2.page.evaluate(() => {
        G.questionStart = Date.now() - 6000;
        baStrike(12, false, false);
      });
      await p2.page.waitForTimeout(190);
      const during = await p2.page.evaluate(() => ({
        card: +document.querySelector('.ac-battle').getBoundingClientRect().height.toFixed(1),
        over: document.body.scrollWidth <= window.innerWidth
      }));
      ok(during.card === before, 'จอ ' + w + ' · การ์ดโจทย์ไม่ขยับระหว่างเล่นเอฟเฟกต์: ' + during.card + 'px');
      ok(during.over, 'จอ ' + w + ' · ไม่ล้นแนวนอน');
      await p2.page.close();
    }
  }

  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
