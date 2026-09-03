/* ชุดเทสต์ Patch v9.3.2 · HERO COMBAT SPRITE CROPPING & ASPECT-RATIO MISMATCH FIX
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_sprite_fit.js [ไฟล์.html]
 *
 * ชี้ไปที่ "ไฟล์แจก" ที่รากrepo โดยเจตนา — ต้องพิสูจน์ของที่นักเรียนได้ใช้จริง
 * ไม่ใช่ต้นฉบับที่ไม่มีใครได้ใช้ (แก้ต้นฉบับแล้วต้อง build ก่อนรันเสมอ · กับดักข้อ 28)
 *
 * ห้าเรื่องที่พิสูจน์
 *   1) โครงสร้าง — baBattleAudit().spriteFit มีอยู่จริง · CSS ถูกฉีดแล้ว
 *      · วัดสัดส่วนครบทุกใบในทะเบียนตั้งแต่ตอนโหลดหน้า
 *   2) ไม่ถูก Crop — เวที (#baHero::before) กว้างเท่าที่เฟรมต้องการจริงเสมอ
 *      (กว้าง ÷ สูง = สัดส่วนของเฟรมเป๊ะ) และไม่หลุดขอบสนามสักพิกเซล
 *      **ครบทุก role · ทุกสถานะ · ทุกความกว้างจอ**
 *   3) ความสูงสม่ำเสมอ — ทุกสถานะสูงเท่ากรอบเป๊ะ (hm = 1) ไม่มีท่าไหนหด/บวม
 *   4) เท้ายืนพื้นเดิม — ขอบล่างเวที = ขอบล่างกรอบ .ba-sprite ทุกสถานะ
 *   5) CLS = 0 — กรอบ .ba-sprite · #baArena · การ์ดโจทย์ ไม่ขยับสักพิกเซล
 *      และเวทีเป็น absolute จึงไม่กลายเป็น flex item ของ .ba-sprite
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_sprite_fit.log');
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
    document.getElementById('reg-id').value = 'sf' + Math.floor(Math.random() * 9999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

/* ตั้งสนามให้เทียบผลได้แน่นอน — ท่าเดียวกับ arena() ของ test_contact_dash.js
   **ต้องปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น** ไม่งั้นทัพเงามายืนแทน */
async function arena(page, floor, opts) {
  opts = opts || {};
  await page.evaluate(o => {
    critChance = () => 0;
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
    G.streak = 0;
    G.items = {};
    nextMonster();
    G.monsterMaxHp = 99999; G.monsterHp = 99999; renderMonsterHp();
    G.locked = false;
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

/* วาดสถานะหนึ่งแล้ววัดเรขาคณิตของเวทีเทียบกรอบสนาม
   ⚠️ วัดจุดกึ่งกลางฮีโร่จาก offsetLeft ไม่ใช่ rect เพราะ rect รวม transform
   ของท่าพุ่งที่อาจยังวิ่งอยู่ (บทเรียนเดียวกับกับดักข้อ 30) */
const MEASURE = k => {
  baAnimStrip();
  const st = baAnimState('', k);
  if (!st || !st.u) return null;
  baAnimPaint(st, false);
  const el = document.getElementById('baHero');
  const ar = document.getElementById('baArena');
  const cs = getComputedStyle(el, '::before');
  const f = baBattleAudit().spriteFit;
  const w = parseFloat(cs.width), h = parseFloat(cs.height);
  let ox = 0, p = el;
  while (p && p !== ar) { ox += p.offsetLeft; p = p.offsetParent; }
  const cx = ox + el.offsetWidth / 2;
  const sc = parseFloat(getComputedStyle(el).scale) || 1;
  const L = cx - f.c * w * sc, R = L + w * sc;
  return {
    k: k, on: f.on, ar: f.ar, c: f.c, hm: f.hm, wm: f.wm,
    w: w, h: h, boxH: el.clientHeight, boxW: el.clientWidth,
    stageAr: h > 0 ? w / h : 0,
    bottom: cs.bottom, pos: cs.position,
    overL: Math.max(0, -L), overR: Math.max(0, R - ar.clientWidth),
    bgOff: getComputedStyle(el).backgroundImage === 'none',
    bgOn: (cs.backgroundImage || 'none') !== 'none',
    scale: sc
  };
};

const ROLES = [
  { cid: 'assassin', lv: 1, role: 'assassin' },
  { cid: 'assassin', lv: 60, role: 'monarch' },
  { cid: 'slayer', lv: 1, role: 'blade' },
  { cid: 'slayer', lv: 60, role: 'slayer' },
  { cid: 'guardian', lv: 1, role: 'guardian' },
  { cid: 'guardian', lv: 60, role: 'guard' },
  { cid: 'priest', lv: 1, role: 'priest' }
];
const KEYS = ['idle', 'dash', 's1', 's2', 's3', 's4'];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · โครงสร้างของแพตช์ ═══════════════════════════════════════
  head('บล็อก 1 · โครงสร้างของแพตช์');
  const { ctx, page, errs } = await boot(browser);
  const ev = fn => page.evaluate(fn);
  {
    await arena(page, 1, { classId: 'slayer', level: 60 });
    const a = await ev(() => baBattleAudit().spriteFit);
    ok(!!a, 'baBattleAudit().spriteFit มีอยู่จริง');
    ok(a && a.ver === 'v9.3.2', 'ป้ายรุ่นเป็น v9.3.2 (ได้ ' + (a && a.ver) + ')');
    ok(a && a.styled, 'ฉีด #baV932Style แล้ว');
    ok(a && a.maxAr === 3.2 && a.ar0 === 1.3, 'ค่าคงที่ maxAr/ar0 ตรงสเปก');
    ok(a && a.cached >= 30, 'อุ่นเครื่องอ่านทะเบียนครบ (' + (a && a.cached) + ' ใบ)');
    ok(a && a.measured >= 30, 'วัดสัดส่วนสำเร็จแล้ว (' + (a && a.measured) + ' ใบ)');
    ok(a && a.measured === a.cached, 'ไม่มีใบไหนวัดไม่ผ่าน (' + (a && a.measured) + '/' + (a && a.cached) + ')');
    ok(a && a.on === true, 'สายที่มีภาพจริงเข้าเงื่อนไข ba-v932-on');
    const st = await ev(() => { const c = getComputedStyle(document.getElementById('baHero'), '::before'); return { p: c.position, b: c.bottom, r: c.backgroundRepeat }; });
    ok(st.p === 'absolute', 'เวทีเป็น position:absolute (ไม่กลายเป็น flex item · CLS = 0)');
    ok(parseFloat(st.b) === 0, 'เวทียึดขอบล่างของกรอบ (bottom = 0)');
    ok(st.r === 'no-repeat', 'ไม่ปูภาพซ้ำ');
  }

  // ══ บล็อก 2 · ไม่ถูก Crop — เวทีกว้างเท่าสัดส่วนจริงของเฟรม ═════════════
  head('บล็อก 2 · เวทีกว้างเท่าสัดส่วนจริงของเฟรม (ไม่ถูก Crop)');
  {
    let n = 0, bad = 0, worst = 0, wide = 0;
    for (const r of ROLES) {
      await arena(page, 1, { classId: r.cid, level: r.lv });
      for (const k of KEYS) {
        const m = await page.evaluate(MEASURE, k);
        if (!m || !m.on) continue;
        n++;
        const d = Math.abs(m.stageAr - m.ar);
        if (d > worst) worst = d;
        if (d > 0.02) { bad++; say('    ⚠️ ' + r.role + '/' + k + ' stageAR=' + m.stageAr.toFixed(2) + ' frameAR=' + m.ar.toFixed(2)); }
        if (m.ar > 2) wide++;
      }
    }
    ok(n >= 30, 'วัดครบทุก role/สถานะที่มีภาพ (' + n + ' ช่อง)');
    ok(bad === 0, 'ทุกช่อง: สัดส่วนเวที = สัดส่วนเฟรมเป๊ะ (คลาดสูงสุด ' + worst.toFixed(4) + ')');
    ok(wide >= 6, 'มีเฟรมแนวนอนยาวพิเศษ (AR > 2) อยู่จริงในชุดข้อมูล (' + wide + ' ช่อง)');
    /* เฟรมกว้าง 2.95 ในกรอบ 62px = ของเดิมเห็นแค่ ~35% — ตรวจว่ากว้างเกินกรอบจริง */
    await arena(page, 1, { classId: 'assassin', level: 60 });
    const m1 = await page.evaluate(MEASURE, 's1');
    ok(m1 && m1.ar > 2.9, 'ba-monarch-slot1 คือเฟรมกว้างที่สุด (AR ' + (m1 && m1.ar.toFixed(2)) + ')');
    ok(m1 && m1.w > m1.boxW * 2.5, 'เวทีกว้างกว่ากรอบ .ba-sprite หลายเท่า (' +
      (m1 && Math.round(m1.w)) + 'px เทียบกรอบ ' + (m1 && m1.boxW) + 'px)');
    ok(m1 && m1.bgOff, 'กล่อง #baHero เลิกวาดพื้นหลังเอง (ไม่มีผีภาพที่ถูกตัดซ้อน)');
    ok(m1 && m1.bgOn, 'เวทีเป็นคนวาดภาพแทน');
    const inline = await ev(() => {
      const el = document.getElementById('baHero');
      return { img: /url\(/.test(el.style.backgroundImage), sz: el.style.backgroundSize };
    });
    ok(inline.img, 'inline backgroundImage ของ #baHero ยังอยู่ครบ (ชุดเทสต์ของ v9.0 อ่านตัวนี้)');
    ok(inline.sz === 'auto 100%', 'inline backgroundSize ยังเป็น auto 100% ของ v9.2.1 (ได้ ' + inline.sz + ')');
  }

  // ══ บล็อก 3 · ความสูงสม่ำเสมอ + เท้ายืนพื้นเดิม ════════════════════════
  head('บล็อก 3 · ความสูงสม่ำเสมอทุกสถานะ + เท้ายืนพื้นเดิม');
  {
    let n = 0, hBad = 0, footBad = 0, hs = [];
    for (const r of ROLES) {
      await arena(page, 1, { classId: r.cid, level: r.lv });
      for (const k of KEYS) {
        const m = await page.evaluate(MEASURE, k);
        if (!m || !m.on) continue;
        n++;
        hs.push(m.h);
        if (Math.abs(m.h - m.boxH) > 0.6) { hBad++; say('    ⚠️ ' + r.role + '/' + k + ' สูง ' + m.h + ' เทียบกรอบ ' + m.boxH); }
        if (parseFloat(m.bottom) !== 0) footBad++;
      }
    }
    const lo = Math.min.apply(null, hs), hi = Math.max.apply(null, hs);
    ok(hBad === 0, 'ทุกสถานะสูงเท่ากรอบเป๊ะ — ไม่มีท่าไหนหด/บวม (' + n + ' ช่อง)');
    ok(hi - lo < 0.6, 'ความสูงของทุกสถานะเท่ากันหมด (' + lo + '–' + hi + 'px)');
    ok(footBad === 0, 'ทุกสถานะเท้ายืนแนบระนาบพื้นเดิม (bottom = 0)');
    const sc = await ev(() => parseFloat(getComputedStyle(document.getElementById('baHero')).scale) || 1);
    ok(Math.abs(sc - 1.2) < 0.001, 'scale 1.2 ของ v9.2 ยังคูณทับเวทีตามเดิม (ความสูง = BA_MON_H)');
  }

  // ══ บล็อก 4 · ไม่หลุดขอบสนาม ครบทุกความกว้างจอ ═════════════════════════
  head('บล็อก 4 · ไม่หลุดขอบสนามสักพิกเซล ครบทุกความกว้างจอ');
  await ctx.close();
  {
    for (const vw of [320, 360, 390, 430, 768]) {
      const s = await boot(browser, vw, 844);
      let n = 0, over = 0, worst = 0;
      for (const r of ROLES) {
        await arena(s.page, 1, { classId: r.cid, level: r.lv });
        for (const k of KEYS) {
          const m = await s.page.evaluate(MEASURE, k);
          if (!m || !m.on) continue;
          n++;
          const o = m.overL + m.overR;
          if (o > worst) worst = o;
          if (o > 0.5) { over++; say('    ⚠️ ' + vw + ' ' + r.role + '/' + k + ' ล้น ' + o.toFixed(1) + 'px'); }
        }
      }
      ok(over === 0, 'จอ ' + vw + ' — ไม่มีเฟรมไหนหลุดขอบสนาม (' + n + ' ช่อง · เกินสูงสุด ' + worst.toFixed(2) + 'px)');
      ok(s.errs.length === 0, 'จอ ' + vw + ' — ไม่มี pageerror');
      await s.ctx.close();
    }
  }

  // ══ บล็อก 5 · CLS = 0 · เลย์เอาต์ไม่ขยับ ═══════════════════════════════
  head('บล็อก 5 · CLS = 0 · เลย์เอาต์ไม่ขยับสักพิกเซล');
  {
    for (const vw of [320, 390, 430]) {
      const s = await boot(browser, vw, 844);
      await arena(s.page, 1, { classId: 'assassin', level: 60 });
      /* บังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนวัดเสมอ
         (บทเรียนเดิมของชุด v7.2/v7.4/v7.5/v7.8/v7.9) */
      const geo = k => s.page.evaluate(kk => {
        if (kk) { baAnimStrip(); const st = baAnimState('', kk); if (st && st.u) baAnimPaint(st, false); }
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        document.getElementById('gFeedback').textContent = '';
        const card = document.querySelector('.ac-battle') || document.getElementById('gWord').closest('.g-card');
        const r = c => { const b = c.getBoundingClientRect(); return [Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10]; };
        return {
          card: card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : 0,
          arena: r(document.getElementById('baArena')),
          hero: r(document.getElementById('baHero')),
          /* กรอบระดับเลย์เอาต์ — ต้องอ่านด้วย offsetWidth/offsetHeight เท่านั้น
             getBoundingClientRect() คืนกรอบ "หลัง transform" ซึ่งรวม scale 1.2
             ของ v9.2 เข้ามาด้วย (62×60 → 74.4×72) แล้วจะเทียบกับ 62×60 ไม่ได้เลย
             (กับดักข้อ 30) */
          box: [document.getElementById('baHero').offsetWidth,
                document.getElementById('baHero').offsetHeight],
          row: r(document.querySelector('#baArena .ba-row')),
          scrollX: document.body.scrollWidth <= window.innerWidth
        };
      }, k);
      const base = await geo('idle');
      let same = true, detail = '';
      for (const k of ['dash', 's1', 's4']) {
        const g = await geo(k);
        if (JSON.stringify(g) !== JSON.stringify(base)) { same = false; detail = k + ' ' + JSON.stringify(g) + ' ≠ ' + JSON.stringify(base); }
      }
      ok(same, 'จอ ' + vw + ' — สลับสถานะแล้วกรอบ/การ์ดโจทย์ไม่ขยับสักพิกเซล' + (same ? '' : ' — ' + detail));
      ok(base.scrollX, 'จอ ' + vw + ' — ไม่ล้นแนวนอน');
      ok(base.box[0] === (vw <= 359 ? 56 : 62) && base.box[1] === (vw <= 359 ? 58 : 60),
        'จอ ' + vw + ' — กรอบ .ba-sprite ระดับเลย์เอาต์ยังเป็น ' + base.box.join('×') + ' เท่าเดิม');
      await s.ctx.close();
    }
  }

  // ══ บล็อก 6 · ทางสำรอง — ยังวัดไม่ได้/ไม่มีภาพ ต้องตกกลับทางเดิม ═══════
  head('บล็อก 6 · ทางสำรอง — ไม่มีภาพ = ตกกลับทางเดิมของ v9.2.1');
  {
    const s = await boot(browser, 390, 844);
    await arena(s.page, 1, { classId: 'priest', level: 60 });   /* soulmaster s1-s4 ยังว่าง */
    const r = await s.page.evaluate(() => {
      const el = document.getElementById('baHero');
      baAnimStrip();
      const before = el.classList.contains('ba-v932-on');
      /* อ่านทะเบียนตรง ๆ — ห้ามอ่านผ่าน baAnimState() เพราะ Ghosting Fix ของ v9.0
         ยืมภาพจากสถานะพี่น้องมาให้ (ซึ่งเป็นพฤติกรรมที่ถูกต้องของชั้นนั้น) */
      baDsEnsureRegistry();
      const raw = ba.assetRegistry.priest.c2.s1;
      const st = baAnimState('', 's1');
      return { empty: !(raw && raw.u), lent: !!(st && st.u),
               after: el.classList.contains('ba-v932-on'), before: before };
    });
    ok(r.empty, 'soulmaster/s1 ยังไม่มีภาพจริงในทะเบียน (ช่อง u ว่าง)');
    ok(r.lent, 'v9.0 ยืมภาพจากสถานะพี่น้องมาให้แทน — v9.3.2 จึงยังวาดเวทีได้ตามปกติ');
    ok(r.after === false, 'ล้างท่าแล้วคลาส ba-v932-on ถูกถอดออก (ไม่ค้าง)');
    /* กล่องเปล่า = กลับไปใช้เฟรมของ v6.5 ตามเดิมทุกประการ */
    const back = await s.page.evaluate(() => getComputedStyle(document.getElementById('baHero')).backgroundImage);
    ok(back === 'none', 'ไม่มีภาพค้างบนกล่องหลังล้างท่า');
    ok(s.errs.length === 0, 'ไม่มี pageerror');
    await s.ctx.close();
  }

  say('\n' + '═'.repeat(35));
  say('ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(0);
})();
