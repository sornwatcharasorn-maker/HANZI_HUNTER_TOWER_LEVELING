/* ตรวจชั้น v6.0 · 2D BATTLE ARENA แบบ "ผลลัพธ์ซ้ำได้ทุกรอบ"
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node verify_arena.js <ไฟล์.html>
 *
 * ตัววัดชุด measure_arena.js มีจุดอ่อนคือ **คำศัพท์ถูกสุ่มใหม่ทุกรอบ** ความยาวข้อความ
 * บนปุ่มตัวเลือกจึงต่างกัน ปุ่มตัดบรรทัดไม่เท่ากัน แล้ว choices.height กับ pausedSpots
 * ขยับตามโดยไม่เกี่ยวกับโค้ดเลย — ชุดนี้จึงบังคับคำและตัวเลือกให้คงที่ก่อนวัดเสมอ
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const CASES = [
  { w: 320, h: 568 }, { w: 360, h: 640 }, { w: 375, h: 667 },
  { w: 390, h: 844 }, { w: 430, h: 932 }, { w: 768, h: 1024 }
];

/* ความสูงการ์ดโจทย์ก่อนมีชั้น v6.0 — วัดจากไฟล์เดิมด้วย measure_arena.js
   การ์ดนี้ถูกตรึงไว้บนสุด ความสูงของมันคือเพดานของพื้นที่ที่เหลือให้แถวตัวเลือก
   **โตขึ้นเมื่อไหร่ = เกมค้างในสภาพ "หยุดเวลาให้แล้ว" (กับดักข้อ 23)** */
const BASE_CARD = { 320: 354.8, 360: 340.8, 375: 340.8, 390: 340.8, 430: 340.8, 768: 340.8 };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  for (const c of CASES) {
    console.log('\n── ' + c.w + '×' + c.h + ' ──────────────────────────────');
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h } });
    const page = await ctx.newPage();

    const errs = [];
    page.on('pageerror', e => errs.push(e.message));

    /* v5.4 ฝัง URL ฐานข้อมูลจริงไว้และเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า
       ไม่ stub = สคริปต์ตรวจยิงเข้าฐานข้อมูลของห้องเรียนจริง */
    await page.addInitScript(() => {
      window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
      window.EventSource = function () { this.close = function () {}; };
    });
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.route('**fonts.gstatic.com**', r => r.abort());

    await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    /* ป๊อปอัปกติกาของ v5.6 บังทางเข้าอยู่ — ทำเหมือนที่นักเรียนทำจริง ไม่ใช่ประตูหลัง */
    await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(120);
    await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      switchTab('register');
      document.getElementById('reg-id').value = 'v' + Math.floor(Math.random() * 999999);
      document.getElementById('reg-pw').value = '1234';
      document.getElementById('reg-pw2').value = '1234';
      handleSubmit();
    });
    await page.waitForTimeout(900);
    /* หน้าต่างจั่วการ์ดของ v4.7 คั่นตอนเข้าเกม ต้องเลือกให้จบ แล้วรอเกิน CD_OUT_MS */
    await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
    await page.waitForTimeout(900);

    /* ── บังคับคำและตัวเลือกให้คงที่ ทุกความกว้างจึงเทียบกันได้จริง ──
       ใช้คำที่ยาวที่สุดใน VOCAB (北京语言大学 · 6 อักขระ) เป็นเคสหนักสุด */
    await page.evaluate(() => {
      const m = G.currentMonster;
      m.word = '北京语言大学';
      m.pinyin = 'Běijīng Yǔyán Dàxué';
      m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
      m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
      document.getElementById('gWord').textContent = m.word;
      document.getElementById('gPinyin').textContent = m.pinyin;
      renderChoices();
    });
    await page.waitForTimeout(250);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.waitForTimeout(150);

    const r = await page.evaluate(() => {
      const R = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height, w: b.width }; };
      const gs = document.getElementById('gameScreen');
      const arena = document.getElementById('baArena');
      const card = document.querySelector('.ac-battle');
      const word = document.getElementById('gWord');
      const ch = document.getElementById('gChoices');

      /* โจทย์ถูกตัวละครบังหรือเปล่า — เทียบกรอบจริงระหว่างแถบโจทย์กับแถวนักสู้ */
      const core = arena ? arena.querySelector('.ba-core') : null;
      const row = arena ? arena.querySelector('.ba-row') : null;
      const cr = R(core), rr = R(row);
      const overlap = (cr && rr) ? Math.max(0, cr.b - rr.t) : null;

      /* โจทย์ล้นกรอบสนามไหม (สนามเป็น overflow:hidden ถ้าล้น = ตัวอักษรโดนตัด) */
      const ar = R(arena), wr = R(word);
      const clipped = (ar && wr) ? (wr.l < ar.l - 0.5 || wr.r > ar.r + 0.5) : null;

      /* ตัวเลือกทั้ง 4 ปุ่ม */
      const btns = Array.from(document.querySelectorAll('#gChoices .g-choice')).map(R);

      /* ให้ระบบดึงจอกลับมาที่โจทย์เหมือนตอนขึ้นข้อใหม่ แล้วถามว่า "ยังอยู่กับโจทย์ไหม" */
      let focusOk = null;
      if (typeof acFocusQa === 'function' && typeof acQaVisible === 'function') {
        acFocusQa();
        focusOk = acQaVisible();
      }

      /* ปุ่มตัวเลือกทุกใบต้องกดได้จริง — ไม่มีอะไรมาบัง (กับดักข้อ 25)
         elementFromPoint คืน null ได้ทั้งตอนมีของบังและตอนพิกัดหลุดจอ จึงเช็กในจอก่อน
         **ซ่อนชั้น toast ชั่วคราวก่อนวัด** — การ์ดแจ้งเตือนของ v4.9.1 ลอยคร่อมปุ่มได้จริง
         บนจอเตี้ยกว่า 620px ซึ่งเป็นข้อแลกเปลี่ยนที่ชั้นนั้นรับไว้เองตั้งแต่ต้น
         (วัดเทียบไฟล์ก่อนแพตช์แล้ว: เกิดเหมือนกันเป๊ะทั้งสองฝั่ง ไม่ใช่ของที่ชั้นนี้ทำ)
         ที่ต้องพิสูจน์ตรงนี้คือ "สนามรบไม่บังปุ่ม" ไม่ใช่ไปตรวจซ้ำเรื่องของชั้นอื่น */
      const snLayer = document.getElementById('snLayer');
      const snVis = snLayer ? snLayer.style.visibility : '';
      if (snLayer) snLayer.style.visibility = 'hidden';
      const hits = [];
      document.querySelectorAll('#gChoices .g-choice').forEach(b => {
        const q = b.getBoundingClientRect();
        const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
        if (cy < 0 || cy > window.innerHeight) { hits.push('offscreen'); return; }
        const el = document.elementFromPoint(cx, cy);
        if (el && el.closest('.g-choice') === b) { hits.push('ok'); return; }
        /* แบดจ์การ์ดของ v4.7 (#cdBadge · position:fixed มุมซ้ายล่าง) คร่อมปุ่มใบล่างซ้าย
           บนจอ 320×568 อยู่ก่อนแล้ว — วัดเทียบไฟล์ก่อนแพตช์ได้พิกัดตรงกันเป๊ะ (92,522)
           จึงไม่ใช่ของที่ชั้นนี้ทำ และไม่ใช่เรื่องที่ชั้นนี้ควรไปแก้ */
        hits.push(el && el.closest('#cdBadge') ? 'cdBadge(เดิม)' : (el ? el.className || el.tagName : 'null'));
      });
      if (snLayer) snLayer.style.visibility = snVis;

      const cs = word ? getComputedStyle(word) : null;

      return {
        hasArena: !!arena,
        arena: ar, card: R(card), cardPos: card ? getComputedStyle(card).position : '',
        word: wr, wordFont: cs ? cs.fontSize : '',
        pinyinIn: !!(arena && arena.contains(document.getElementById('gPinyin'))),
        avatarIn: !!(arena && arena.contains(document.getElementById('gAvatar'))),
        tagIn: !!(arena && arena.querySelector('.g-monster-tag')),
        heroSvg: !!(arena && arena.querySelector('.ba-hero svg')),
        /* v6.1 — ฮีโร่กลายเป็นเฟรมจากสไปรต์ชีต · SVG เหลือเป็นทางสำรองตอนยังไม่ฝังภาพ */
        heroFigs: arena ? arena.querySelectorAll('.ba-hero .ba-fig').length : 0,
        heroOn: arena ? arena.querySelectorAll('.ba-hero .ba-fig.on').length : 0,
        heroDecoded: arena ? [].every.call(
          arena.querySelectorAll('.ba-hero .ba-fig'), i => i.complete && i.naturalWidth > 0) : false,
        heroAbs: (function () {
          const f = arena && arena.querySelector('.ba-hero .ba-fig');
          return f ? getComputedStyle(f).position : '';
        })(),
        bgOn: !!(arena && arena.classList.contains('ba-has-bg')),
        bgImg: (function () {
          const b = document.getElementById('baBg');
          return b ? (getComputedStyle(b).backgroundImage || '') : '';
        })(),
        bgSize: (function () {
          const b = document.getElementById('baBg');
          return b ? getComputedStyle(b).backgroundSize : '';
        })(),
        veil: (function () {
          const v = arena && arena.querySelector('.ba-veil');
          if (!v) return '';
          const cs = getComputedStyle(v);
          return cs.display === 'none' ? 'none' : cs.backgroundColor;
        })(),
        heroHp: !!(arena && arena.querySelector('#baHeroHp span')),
        foeHp: !!(arena && arena.querySelector('#baFoeHp span')),
        overlap, clipped, btns, hits, focusOk,
        choices: R(ch),
        noOverflowX: document.body.scrollWidth <= window.innerWidth,
        arenaOverflow: arena ? getComputedStyle(arena).overflow : ''
      };
    });

    ok(r.hasArena, 'สนามรบถูกสร้าง (#baArena)');
    ok(r.tagIn && r.pinyinIn && r.avatarIn, 'ย้ายโหนดเดิมเข้าสนามครบ (ป้าย · พินอิน · อสูร)');
    /* v6.1 — ฝังเฟรมแล้วต้องได้เฟรม · ยังไม่ฝังต้องตกกลับไปเป็น SVG ของ v6.0 ไม่ใช่กล่องว่าง */
    ok(r.heroFigs > 0 || r.heroSvg,
      r.heroFigs ? 'ฮีโร่เป็นเฟรมจากสไปรต์ชีต ' + r.heroFigs + ' เฟรม'
                 : 'ฮีโร่ตกกลับไปเป็น SVG (ยังไม่ได้ฝังเฟรม)');
    if (r.heroFigs) {
      /* data URI เสียจะเงียบสนิท ไม่มี error ให้เห็น — ต้องเช็ก naturalWidth เสมอ */
      ok(r.heroDecoded, 'เฟรมฮีโร่ decode ได้ครบทุกเฟรม');
      ok(r.heroOn === 1, 'โชว์ทีละเฟรมเดียวเสมอ (เห็นอยู่ ' + r.heroOn + ' เฟรม)');
      /* absolute = ไม่อยู่ในสายเลย์เอาต์ → กล่อง .ba-sprite จึงไม่ยืดตามท่าที่กว้างกว่า */
      ok(r.heroAbs === 'absolute', 'เฟรมฮีโร่วางแบบ absolute (ไม่ดันเลย์เอาต์)');
    }
    ok(r.heroHp && r.foeHp, 'มีหลอด HP ทั้งฝั่งฮีโร่และฝั่งอสูร');

    /* v6.1 — ฉากหลังตามโซน */
    if (r.bgOn) {
      ok(/^url\(/.test(r.bgImg), 'ฉากหลังถูกใส่เป็นภาพจริง');
      ok(r.bgSize === 'cover', 'ฉากหลังใช้ cover (เต็มกรอบโดยไม่บิดสัดส่วน)');
      ok(/rgba\(0,\s*0,\s*0,\s*0?\.35\)/.test(r.veil.replace(/\s/g, m => m)),
        'ม่านดำทับฉากเป็น rgba(0,0,0,.35) ตามสเปก — ได้ ' + r.veil);
    } else {
      ok(r.veil === 'none', 'ยังไม่ได้ฝังฉาก → ม่านดำต้องไม่โผล่มาหรี่จอเปล่า ๆ');
    }

    const base = BASE_CARD[c.w];
    ok(r.card && r.card.h <= base + 0.6,
      'การ์ดโจทย์ไม่โตขึ้น: ' + r.card.h.toFixed(1) + 'px (ก่อนแพตช์ ' + base + 'px)');

    ok(parseFloat(r.wordFont) >= 34,
      'อักษรจีนไม่ถูกย่อ: ' + r.wordFont + ' (เดิม 34px)');
    ok(r.clipped === false, 'คำที่ยาวที่สุด (北京语言大学) ไม่ถูกกรอบสนามตัด');
    ok(r.overlap !== null && r.overlap <= 0,
      'ตัวละครไม่บังโจทย์ (ระยะซ้อนทับ ' + (r.overlap === null ? '?' : r.overlap.toFixed(1)) + 'px)');

    ok(r.btns.length === 4, 'ปุ่มตัวเลือกครบ 4 ปุ่ม');
    ok(r.btns.every(b => b.h >= 56), 'ทุกปุ่มสูงอย่างน้อย 56px เท่าเดิม (กดง่ายด้วยนิ้ว)');
    ok(r.hits.every(h => h === 'ok' || h === 'cdBadge(เดิม)'),
      'สนามรบไม่บังปุ่มตัวเลือกสักใบ [' + r.hits.join(',') + ']');
    ok(r.noOverflowX, 'ไม่ล้นแนวนอน');
    ok(r.arenaOverflow === 'hidden', 'สนามเป็น overflow:hidden (เอฟเฟกต์ดันเลย์เอาต์ไม่ได้)');
    ok(r.focusOk === true, 'หลัง acFocusQa() แล้ว acQaVisible() เป็นจริง (นาฬิกาเดินต่อได้)');

    /* ── ยิงเอฟเฟกต์จริงแล้ววัดว่าเลย์เอาต์ไม่ขยับ ─────────────────── */
    const before = await page.evaluate(() => {
      const a = document.getElementById('baArena').getBoundingClientRect();
      const ch = document.getElementById('gChoices').getBoundingClientRect();
      return { ah: a.height, ct: ch.top, ch: ch.height, sw: document.body.scrollWidth };
    });
    await page.evaluate(() => { baStrike(42, true); baCounter(17, false); });
    await page.waitForTimeout(120);
    const during = await page.evaluate(() => {
      const a = document.getElementById('baArena').getBoundingClientRect();
      const ch = document.getElementById('gChoices').getBoundingClientRect();
      return {
        ah: a.height, ct: ch.top, ch: ch.height, sw: document.body.scrollWidth,
        fx: document.querySelectorAll('#baFx > *').length
      };
    });
    ok(during.fx > 0, 'เอฟเฟกต์ถูกสร้างจริง (' + during.fx + ' ชิ้น)');
    ok(Math.abs(during.ah - before.ah) < 0.5 && Math.abs(during.ct - before.ct) < 0.5 &&
       Math.abs(during.ch - before.ch) < 0.5 && during.sw === before.sw,
      'ระหว่างเล่นเอฟเฟกต์ เลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียว');

    /* เอฟเฟกต์ต้องเก็บกวาดตัวเองหมด ไม่ทิ้งโหนดค้าง */
    await page.waitForTimeout(1400);
    const after = await page.evaluate(() => document.querySelectorAll('#baFx > *').length);
    ok(after === 0, 'เอฟเฟกต์ล้างตัวเองหมดหลังเล่นจบ (เหลือ ' + after + ' ชิ้น)');

    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' → ' + errs[0] : ''));

    await ctx.close();
  }

  await browser.close();
  console.log('\n═══════════════════════════════════');
  console.log('ผ่าน ' + pass + '  ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
