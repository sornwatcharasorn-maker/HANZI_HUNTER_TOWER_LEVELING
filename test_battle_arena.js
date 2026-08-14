/* ชุดเทสต์ชั้นที่ยี่สิบสาม — v6.0 · 2D BATTLE ARENA
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_battle_arena.js
 *
 * เน้นพิสูจน์สามเรื่องที่พังแล้วเจ็บที่สุด
 *   1) การ์ดโจทย์ต้องไม่โตขึ้นแม้แต่พิกเซลเดียว (ไม่งั้นเกมค้าง — กับดักข้อ 23)
 *   2) เอฟเฟกต์ต้องยิงจาก "การเล่นจริง" ไม่ใช่แค่ตอนเรียกฟังก์ชันตรง ๆ
 *   3) ตัวเลขดาเมจต้องตรงกับ HP ที่หายไปจริง หลังทุกชั้นตัดสินผลเสร็จแล้ว
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_battle_arena.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
/* เขียนลงไฟล์ด้วย appendFileSync ไม่ใช่ console.log อย่างเดียว
   เพราะ stdout ถูกบัฟเฟอร์จนกว่าโปรเซสจะจบ ถ้าค้างจะไม่เห็นว่าค้างตรงไหน */
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
    document.getElementById('reg-id').value = 'a' + Math.floor(Math.random() * 9999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  /* หน้าต่างจั่วการ์ดของ v4.7 คั่นอยู่ ต้องเลือกให้จบ แล้วรอเกิน CD_OUT_MS (620ms) */
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

/* ตั้งสนามให้เทียบผลได้แน่นอน — ปิดการสุ่มทุกตัวที่กวนการวัดดาเมจ
   และเลือกการ์ดที่ไม่ยุ่งกับนาฬิกา (🧘 สมาธิแน่วแน่ จะแช่แข็งทุกข้อ
   แล้ว QUESTION_TIMER เป็น null โดยชอบธรรม จนเทสต์ตกด้วยเหตุผลผิด) */
async function arena(page, floor, opts) {
  opts = opts || {};
  await page.evaluate(o => {
    critChance = () => (o.crit ? 100 : 0);
    expDoubleChance = () => 0;
    if (typeof CD_BY_ID !== 'undefined' && CD_BY_ID.mana) {
      CD_CARD = CD_BY_ID.mana;
      CD_BAND = cdBandOf(o.floor);
      CD_ST = { ward: 0, noItem: 0, noHeal: 0, atk: 0, perfect: true, hit: 0, miss: 0 };
      if (typeof cdPaintUi === 'function') cdPaintUi();
    }
    G.floor = o.floor;
    G.floorProgress = 0;
    G.maxFloor = FLOOR_MAX;      /* ปลดล็อกแรงค์ ไม่งั้นไอเทม/ร้านค้าถูกปัดตกก่อน */
    recalcStats();
    G.hp = G.maxHp;
    G.shield = o.shield || 0;
    nextMonster();
    /* กันมอนสเตอร์ตายกลางเทสต์ — จะได้วัดดาเมจต่อครั้งได้สะอาด ๆ */
    if (o.tanky) { G.monsterMaxHp = 99999; G.monsterHp = 99999; renderMonsterHp(); }
    G.locked = false;
  }, Object.assign({ floor: floor }, opts));
  await page.waitForTimeout(320);
  /* เลือกการ์ดที่อาจเด้งตอนข้ามช่วงชั้น */
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 — โครงสร้างสนามรบ ═══════════════════════════════════════
  say('\n【บล็อก 1】โครงสร้างสนามรบ');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    const r = await page.evaluate(() => {
      const a = document.getElementById('baArena');
      return {
        exists: !!a,
        wordIn: !!(a && a.contains(document.getElementById('gWord'))),
        pinyinIn: !!(a && a.contains(document.getElementById('gPinyin'))),
        avatarIn: !!(a && a.contains(document.getElementById('gAvatar'))),
        tagIn: !!(a && a.querySelector('.g-monster-tag')),
        /* v6.1 — ฮีโร่กลายเป็นเฟรมจากสไปรต์ชีต · SVG เหลือเป็นทางสำรองตอนยังไม่ฝังภาพ
           เช็ก "มีตัวฮีโร่จริง" ไม่ใช่ "เป็น SVG" ไม่งั้นเคสจะตกทุกครั้งที่ฝังเฟรมเข้าไป */
        hero: !!(a && (a.querySelector('.ba-hero .ba-fig') || a.querySelector('.ba-hero svg'))),
        heroFigs: a ? a.querySelectorAll('.ba-hero .ba-fig').length : 0,
        heroOn: a ? a.querySelectorAll('.ba-hero .ba-fig.on').length : 0,
        heroDecoded: a ? [].every.call(a.querySelectorAll('.ba-hero .ba-fig'),
          i => i.complete && i.naturalWidth > 0) : true,
        heroLeft: (() => {
          const h = a && a.querySelector('.ba-hero'), f = a && a.querySelector('.ba-foe');
          return h && f ? h.getBoundingClientRect().left < f.getBoundingClientRect().left : null;
        })(),
        bars: !!(a && a.querySelector('#baHeroHp span') && a.querySelector('#baFoeHp span')),
        /* หลอดจริงของ v4.0 ต้องยังอยู่ครบ ไม่ได้ถูกย้าย/ลบ */
        realBars: !!(document.getElementById('gHpBar') && document.getElementById('gMhpBar')),
        inCard: !!(a && a.closest('.ac-battle'))
      };
    });
    ok(r.exists, 'สร้าง #baArena ตั้งแต่โหลดหน้า');
    ok(r.wordIn && r.pinyinIn && r.avatarIn && r.tagIn, 'ย้ายโหนดเดิมเข้าสนามครบทั้ง 4 (ไม่ได้สร้างใหม่ทับ)');
    ok(r.hero, r.heroFigs ? 'ฮีโร่เป็นเฟรมจากสไปรต์ชีต ' + r.heroFigs + ' เฟรม (v6.1)'
                          : 'ฮีโร่เป็น SVG (ยังไม่ได้ฝังเฟรม — ทางสำรองของ v6.0)');
    if (r.heroFigs) {
      /* data URI เสียจะเงียบสนิท ไม่มี error ให้เห็น — ต้องเช็ก naturalWidth เสมอ */
      ok(r.heroDecoded, 'เฟรมฮีโร่ decode ได้ครบทุกเฟรม');
      ok(r.heroOn === 1, 'โชว์ทีละเฟรมเดียวเสมอ (เห็นอยู่ ' + r.heroOn + ' เฟรม)');
    }
    ok(r.heroLeft === true, 'ฮีโร่อยู่ซ้าย · อสูรอยู่ขวา (มุมมองด้านข้าง)');
    ok(r.bars, 'มีหลอด HP ย่อยทั้งสองฝั่งในสนาม');
    ok(r.realBars, 'หลอดจริงของ v4.0 (#gHpBar · #gMhpBar) ยังอยู่ครบ ไม่ถูกแตะ');
    ok(r.inCard, 'สนามอยู่ในการ์ดที่ v4.8.1 ตรึงไว้ (.ac-battle)');

    /* สร้างซ้ำต้องไม่งอกของซ้ำ (กับดักข้อ 2) */
    const dup = await page.evaluate(() => {
      for (let i = 0; i < 6; i++) baBuild();
      return {
        arenas: document.querySelectorAll('#baArena').length,
        /* v6.1 — ตัวฮีโร่คือ SVG หนึ่งใบ หรือชุดเฟรมเท่าจำนวนที่ฝังไว้ ไม่ใช่ทั้งสองอย่าง */
        heroes: document.querySelectorAll('.ba-hero svg').length
                + (document.querySelectorAll('.ba-hero .ba-fig').length ? 1 : 0),
        figs: document.querySelectorAll('.ba-hero .ba-fig').length,
        want: (typeof BA_HERO !== 'undefined' && BA_HERO.length) ? BA_HERO.length : 0,
        bgs: document.querySelectorAll('#baArena .ba-bg').length,
        veils: document.querySelectorAll('#baArena .ba-veil').length,
        words: document.querySelectorAll('#gWord').length,
        styles: document.querySelectorAll('#baStyle').length
      };
    });
    ok(dup.arenas === 1 && dup.heroes === 1 && dup.words === 1 && dup.styles === 1
       && dup.figs === dup.want && dup.bgs <= 1 && dup.veils <= 1,
      'baBuild() idempotent — เรียกซ้ำ 6 รอบไม่งอกของซ้ำ');

    /* ── v6.1 · ฉากหลังตามโซน ─────────────────────────────────────────
       สลับด้วย G.floor + baSyncScene() ตรง ๆ ไม่ต้องไต่จริง */
    const scenes = await page.evaluate(() => {
      const out = [];
      for (let f = 1; f <= FLOOR_MAX; f++) { G.floor = f; baSyncScene(); out.push(BA_SCENE); }
      G.ab.abyss = true; baSyncScene();
      const ab = BA_SCENE;
      G.ab.abyss = false; G.floor = 1; baSyncScene();   /* ต้องคืนค่าให้เคสถัดไปเสมอ */
      return { out, ab, back: BA_SCENE, bands: BA_BAND, zones: BA_ZONES };
    });
    const wantScene = [];
    for (let f = 1; f <= 20; f++) wantScene.push('z' + Math.min(scenes.zones, Math.ceil(f / scenes.bands)));
    ok(scenes.out.join(',') === wantScene.join(','),
      'ฉากหลังเปลี่ยนตามโซนครบทั้ง 20 ชั้น (โซนละ ' + scenes.bands + ' ชั้น)');
    ok(scenes.ab === 'abyss', 'โหมดเหวลึกใช้ฉากของตัวเอง');
    ok(scenes.back === 'z1', 'ปิดโหมดเหวลึกแล้วกลับมาใช้ฉากตามชั้นเดิม');

    const bg = await page.evaluate(() => {
      const b = document.getElementById('baBg');
      const v = document.querySelector('#baArena .ba-veil');
      const cs = b ? getComputedStyle(b) : null;
      const vs = v ? getComputedStyle(v) : null;
      return {
        has: !!(typeof BA_BG !== 'undefined' && BA_BG.z1),
        size: cs ? cs.backgroundSize : '', pos: cs ? cs.position : '',
        veil: vs ? (vs.display === 'none' ? 'none' : vs.backgroundColor) : '',
        cls: document.getElementById('baArena').classList.contains('ba-has-bg')
      };
    });
    if (bg.has) {
      ok(bg.size === 'cover', 'ฉากหลังใช้ cover (เต็มกรอบโดยไม่บิดสัดส่วน)');
      ok(bg.pos === 'absolute', 'ฉากหลังวางแบบ absolute (ไม่ดันเลย์เอาต์)');
      ok(/rgba\(0,\s*0,\s*0,\s*0?\.35\)/.test(bg.veil),
        'ม่านดำเป็น rgba(0,0,0,.35) ตามสเปก — ได้ ' + bg.veil);
    } else {
      ok(bg.veil === 'none' && !bg.cls, 'ยังไม่ฝังฉาก → ม่านดำต้องไม่โผล่มาหรี่จอเปล่า ๆ');
    }

    /* ── v6.1 · สุ่มท่าห้ามกิน Math.random ของชุดเทสต์ชั้นล่าง (กับดักข้อ 32) ── */
    const rnd = await page.evaluate(() => {
      const real = Math.random;
      let n = 0;
      Math.random = function () { n++; return real(); };
      try { for (let i = 0; i < 12; i++) { BA_ACT_TO = 0; baAct(200); } }
      finally { Math.random = real; }
      return n;
    });
    ok(rnd === 0, 'baAct() ไม่เรียก Math.random สักครั้ง (เรียกไป ' + rnd + ')');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 2 — เอฟเฟกต์จากการเล่นจริง ═════════════════════════════════
  say('\n【บล็อก 2】เอฟเฟกต์ยิงจากการเล่นจริง');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);

    /* ตอบถูก (ไม่คริต) — มอนสเตอร์อึด จะได้ไม่ตายกลางทาง */
    await arena(page, 3, { tanky: true, crit: false });
    const hit = await page.evaluate(async () => {
      const before = G.monsterHp;
      const m = G.currentMonster;
      G.questionStart = Date.now();
      answer(m.answer, null);
      await new Promise(r => setTimeout(r, 260));
      const d = document.querySelector('#baFx .ba-dmg');
      return {
        dealt: before - G.monsterHp,
        txt: d ? d.textContent : null,
        cls: d ? d.className : null,
        foeHurt: !!document.querySelector('#baFoe.ba-hurt'),
        slash: document.querySelectorAll('#baFx .ba-slash').length,
        bolt: document.querySelectorAll('#baFx .ba-bolt').length,
        mirror: document.querySelector('#baFoeHp span').style.width,
        expect: (G.monsterHp / G.monsterMaxHp * 100)
      };
    });
    ok(hit.dealt > 0, 'ตอบถูกแล้วมอนสเตอร์เสีย HP จริง (' + hit.dealt + ')');
    ok(hit.txt === '-' + hit.dealt, 'ตัวเลขดาเมจตรงกับ HP ที่หายไปจริง (' + hit.txt + ')');
    ok(hit.cls && hit.cls.indexOf('good') !== -1 && hit.cls.indexOf('crit') === -1,
      'ไม่คริต → ใช้สไตล์ปกติ ไม่ใช่สไตล์คริต');
    ok(hit.foeHurt, 'อสูรสั่น/กระพริบตอนโดน');
    ok(hit.slash === 1 && hit.bolt >= 0, 'มีรอยฟันดาบพุ่งใส่อสูร');
    ok(Math.abs(parseFloat(hit.mirror) - hit.expect) < 0.6, 'หลอด HP อสูรในสนามตรงกับค่าจริง');

    /* ตอบถูกแบบคริติคอล */
    await arena(page, 3, { tanky: true, crit: true });
    const crit = await page.evaluate(async () => {
      const m = G.currentMonster;
      G.questionStart = Date.now();
      answer(m.answer, null);
      await new Promise(r => setTimeout(r, 260));
      const d = document.querySelector('#baFx .ba-dmg');
      return { cls: d ? d.className : null, txt: d ? d.textContent : null };
    });
    ok(crit.cls && crit.cls.indexOf('crit') !== -1,
      'คริติคอลใช้สไตล์คริต (' + crit.txt + ')');

    /* ตอบผิด */
    await arena(page, 3, { tanky: true });
    const bad = await page.evaluate(async () => {
      const m = G.currentMonster;
      const wrong = m.choices.filter(c => c !== m.answer)[0];
      const hp0 = G.hp;
      G.questionStart = Date.now();
      answer(wrong, null);
      await new Promise(r => setTimeout(r, 300));
      const d = document.querySelector('#baFx .ba-dmg');
      return {
        taken: hp0 - G.hp, txt: d ? d.textContent : null, cls: d ? d.className : null,
        heroHurt: !!document.querySelector('#baHero.ba-hurt'),
        foeAtk: !!document.querySelector('#baFoe'),
        mirror: document.querySelector('#baHeroHp span').style.width,
        expect: (G.hp / G.maxHp * 100)
      };
    });
    ok(bad.taken > 0, 'ตอบผิดแล้วฮันเตอร์เสีย HP จริง (' + bad.taken + ')');
    ok(bad.txt === '-' + bad.taken, 'ตัวเลขดาเมจสีแดงตรงกับ HP ที่เสียจริง (' + bad.txt + ')');
    ok(bad.cls && bad.cls.indexOf('bad') !== -1, 'ใช้สไตล์ดาเมจสีแดง');
    ok(bad.heroHurt, 'ฮีโร่กระพริบแดงตอนโดน');
    ok(Math.abs(parseFloat(bad.mirror) - bad.expect) < 0.6, 'หลอด HP ฮีโร่ในสนามตรงกับค่าจริง');

    /* เกราะรับไว้ = ไม่เสีย HP จริง ต้องขึ้น BLOCK ไม่ใช่เงียบ */
    await arena(page, 3, { tanky: true, shield: 999 });
    const blk = await page.evaluate(async () => {
      const m = G.currentMonster;
      const wrong = m.choices.filter(c => c !== m.answer)[0];
      const hp0 = G.hp;
      G.questionStart = Date.now();
      answer(wrong, null);
      await new Promise(r => setTimeout(r, 300));
      const d = document.querySelector('#baFx .ba-dmg');
      return { taken: hp0 - G.hp, cls: d ? d.className : null, txt: d ? d.textContent : null };
    });
    ok(blk.taken === 0, 'เกราะรับดาเมจไว้ HP ไม่ลด');
    ok(blk.cls && blk.cls.indexOf('block') !== -1, 'ขึ้น 🛡️ BLOCK แทนตัวเลขแดง (' + blk.txt + ')');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 3 — อยู่ร่วมกับระบบหยุดเวลาของ v4.8.1 ═══════════════════════
  say('\n【บล็อก 3】ระบบหยุดเวลา (v4.8.1) ยังทำงานครบ');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 2, { tanky: true });

    const st = await page.evaluate(() => {
      clearQuestionTimer(); startQuestionTimer();
      return { running: QUESTION_TIMER !== null };
    });
    ok(st.running, 'นาฬิกาต่อข้อเดินอยู่จริงก่อนวัด');

    const paused = await page.evaluate(async () => {
      acTogglePause();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const gs = document.getElementById('gameScreen');
      const w = document.getElementById('gWord');
      return {
        held: AC_HELD, timer: QUESTION_TIMER === null,
        masked: gs.classList.contains('ac-mask'),
        /* อักษรจีนต้องยังถูกเบลอ ทั้งที่ย้ายเข้าสนามไปแล้ว
           (CSS ของ v4.8.1 เลือกด้วย id จึงตามไปเอง) */
        blurred: (getComputedStyle(w).filter || '').indexOf('blur') !== -1,
        arena: !!document.getElementById('baArena')
      };
    });
    ok(paused.held && paused.timer, 'กด ⏸️ แล้วนาฬิกาถูกหยุดจริง');
    ok(paused.masked, '#gameScreen ได้คลาส ac-mask');
    ok(paused.blurred, 'อักษรจีนยังถูกเบลอตอนหยุด แม้จะย้ายเข้าสนามแล้ว');
    ok(paused.arena, 'สนามรบยังอยู่ระหว่างหยุด');

    const resumed = await page.evaluate(async () => {
      acResumeClick();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { running: QUESTION_TIMER !== null, held: AC_HELD };
    });
    ok(resumed.running && !resumed.held, 'กดเล่นต่อแล้วนาฬิกาเดินต่อได้');

    /* จอถูกพับ = ห้ามเล่นเอฟเฟกต์ (กันกินแบตเครื่องนักเรียนฟรี ๆ) */
    const hidden = await page.evaluate(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      baClearFx();
      baStrike(50, false);
      await new Promise(r => setTimeout(r, 240));
      const n = document.querySelectorAll('#baFx > *').length;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      return n;
    });
    ok(hidden === 0, 'จอถูกพับอยู่ = ไม่เล่นเอฟเฟกต์เลย');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  // ══ บล็อก 4 — เก็บกวาด + สวิตช์ปิด ══════════════════════════════════
  say('\n【บล็อก 4】เก็บกวาดทรัพยากร และสวิตช์ปิดสนามรบ');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 4, { tanky: true });

    const cleaned = await page.evaluate(async () => {
      baStrike(30, true); baCounter(20, false);
      const during = document.querySelectorAll('#baFx > *').length;
      const timers = BA_T.length;
      exitGame();
      await new Promise(r => setTimeout(r, 120));
      return { during, timers, after: document.querySelectorAll('#baFx > *').length, tAfter: BA_T.length };
    });
    ok(cleaned.during > 0 && cleaned.timers > 0, 'เอฟเฟกต์และนาฬิกาถูกสร้างจริง');
    ok(cleaned.after === 0 && cleaned.tAfter === 0,
      'ออกจากเกมแล้วล้างเอฟเฟกต์และนาฬิกาหมด (ไม่ค้างข้ามรอบการเล่น)');

    /* ชั้นบอสต้องเปลี่ยนโทนสนาม */
    await page.waitForTimeout(300);
    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }
  {
    /* สวิตช์ปิด — โซนโจทย์ต้องกลับไปหน้าตาเดิมของ v4.0 ทุกประการ */
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
      window.EventSource = function () { this.close = function () {}; };
      try { localStorage.setItem('yao_arena', 'off'); } catch (e) {}
    });
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const off = await page.evaluate(() => ({
      arena: !!document.getElementById('baArena'),
      word: !!document.getElementById('gWord'),
      inArea: !!(document.getElementById('gWord') || {}).closest &&
              !!document.getElementById('gWord').closest('.g-monster-area')
    }));
    ok(!off.arena, 'ตั้ง yao_arena=off แล้วไม่สร้างสนามรบเลย');
    ok(off.word && off.inArea, 'โจทย์ยังอยู่ที่เดิมของ v4.0 ครบ (ทางถอยฉุกเฉินใช้ได้จริง)');
    await ctx.close();
  }

  // ══ บล็อก 5 — ชั้นบอส ═══════════════════════════════════════════════
  say('\n【บล็อก 5】ชั้นบอสเปลี่ยนโทนสนาม');
  {
    const { ctx, page, errs } = await boot(browser, 390, 844);
    await arena(page, 5, { tanky: true });
    const boss = await page.evaluate(() => ({
      cls: document.getElementById('baArena').classList.contains('ba-boss'),
      name: (document.getElementById('baFoeName') || {}).textContent,
      avatar: (document.getElementById('gAvatar') || {}).textContent
    }));
    ok(boss.cls, 'ชั้นบอสได้คลาส ba-boss');
    ok(/บอส/.test(boss.name || ''), 'ป้ายชื่อบอกว่าเป็นบอส (' + boss.name + ')');
    ok(boss.avatar === '👑', 'อสูรกลายเป็น 👑 ตามกติกาเดิมของ v4.0');

    await arena(page, 3, { tanky: true });
    const norm = await page.evaluate(() => document.getElementById('baArena').classList.contains('ba-boss'));
    ok(!norm, 'กลับชั้นปกติแล้วถอดคลาสบอสคืน');
    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));
    await ctx.close();
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
