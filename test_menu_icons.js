/* test_menu_icons.js — ชุดเทสต์ของชั้น v5.9 · MENU ICON ART
   NODE_PATH=/opt/node22/lib/node_modules node test_menu_icons.js

   ชี้ไปที่ "ไฟล์แจก" ที่รากrepo โดยเจตนา เหมือนอีก 11 ชุด — ต้องพิสูจน์ของที่นักเรียนได้ใช้จริง
   **แก้ต้นฉบับแล้วต้อง `node build_minify.js` ก่อนรันเสมอ** (กับดักข้อ 28)

   สิ่งที่ชุดนี้เฝ้าไว้
     1. ไอคอนครบ 9 ใบ · เป็น data URI ไม่มีคำขอออกเน็ต · decode ได้จริง
        (data URI เสียจะเงียบสนิท ไม่มี error ให้เห็น — บทเรียนเดียวกับ Item Asset Patch)
     2. อีโมจิเดิมถูก "แทนที่" ไม่ใช่ "ซ้อน"
     3. ⚙️/🕳️ ที่ v4.6 เขียน innerHTML ทับทุกครั้งที่วาดสถานะ ต้องได้ภาพคืนทันที
     4. โครง .g-actions ไม่ถูกแตะ — SYSTEM SCAN ยังเป็นลูกตัวสุดท้ายที่กินเต็มแถว
     5. เรียกซ้ำไม่แทรกซ้อน (กติกาข้อ 2 ของ CLAUDE.md)
     6. ไม่ล้นแนวนอนทุกความกว้าง และโซนคำถาม-คำตอบไม่ขยับ
     7. ไม่มี pageerror และ Error Log ไม่มีรายการของชั้นนี้                                */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_menu_icons.log');
const WIDTHS = [320, 360, 390, 430, 768];

/* อีโมจิเดิมของแต่ละปุ่ม เรียงตามลำดับบนจอ — ต้องไม่เหลือค้างอยู่หน้าข้อความหลังใส่ภาพ */
const EMOJI = ['📜', '📊', '📈', '🏆', '🎒', '📖', '⚙️', '🕳️', '👁️'];

fs.writeFileSync(LOG, '');
let PASS = 0, FAIL = 0;
const log = (s) => { fs.appendFileSync(LOG, s + '\n'); };   /* stdout ถูกบัฟเฟอร์ — เขียนไฟล์เสมอ */
function ok(msg, cond, extra) {
  if (cond) { PASS++; log('  ✅ ' + msg); }
  else { FAIL++; log('  ❌ ' + msg + (extra ? ' → ' + JSON.stringify(extra) : '')); }
}

/* ทางเข้าเกม — ต้องผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง (เลื่อนอ่านครบแล้วกดยืนยัน)
   ห้ามเรียก enterGate() ตรง ๆ เพราะ wrapper ของ v5.6 บล็อกไว้ก่อน */
async function enterGame(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(150);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => switchTab('register'));
  const id = 'mi' + Math.floor(Math.random() * 90000 + 10000);
  await page.evaluate((id) => {
    document.getElementById('reg-id').value = id;
    document.getElementById('reg-name').value = 'ทดสอบไอคอน';
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  }, id);
  await page.waitForTimeout(900);
  /* หน้าต่างจั่วการ์ดของ v4.7 คั่นตอนเข้าเกม ต้องเลือกให้จบก่อนเสมอ */
  await page.evaluate(() => { const c = document.querySelector('#cdDraft.active .cd-card'); if (c) c.click(); });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  for (const w of WIDTHS) {
    log('\n[ viewport ' + w + 'px ]');
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    /* บล็อกฟอนต์ + คลาวด์จริง — v5.4 ฝัง URL ฐานข้อมูลของห้องเรียนไว้ในซอร์ส
       ไม่ stub = เทสต์ยิงเข้าฐานข้อมูลจริง (กติกาเดียวกับชุดของ v5.5/v5.6) */
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.route('**fonts.gstatic.com**', r => r.abort());
    await page.addInitScript(() => {
      const _f = window.fetch;
      window.fetch = function (u) {
        if (/firebasedatabase\.app|supabase/.test(String(u)))
          return Promise.resolve(new Response('null', { status: 200 }));
        return _f.apply(this, arguments);
      };
      window.EventSource = function () { this.readyState = 1; this.close = function () {}; };
    });
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await enterGame(page);

    /* data URI ยัง decode ไม่เสร็จตอนวัดได้ — ต้องรอให้ complete ก่อนเสมอ */
    await page.waitForFunction(() => {
      const im = document.querySelectorAll('.g-actions .mi-ico img');
      return im.length === 9 && Array.prototype.every.call(im, i => i.complete && i.naturalWidth > 0);
    }, null, { timeout: 6000 }).catch(() => {});

    // ── 1 · ไอคอนครบและใช้ได้จริง ────────────────────────────────────
    const info = await page.evaluate(() => {
      const act = document.querySelector('.g-actions');
      const btns = Array.prototype.map.call(act.children, (b) => {
        const ico = b.querySelector('.mi-ico');
        const img = ico && ico.querySelector('img');
        const r = b.getBoundingClientRect();
        const ir = ico ? ico.getBoundingClientRect() : null;
        return {
          text: b.textContent.trim(),
          tag: b.id || (b.getAttribute('onclick') || ''),
          hasIco: !!ico,
          natural: img ? img.naturalWidth : 0,
          decoded: !!(img && img.complete && img.naturalWidth > 0),
          isData: !!(img && img.getAttribute('src').indexOf('data:image/webp;base64,') === 0),
          inside: ir ? (ir.left >= r.left - 0.5 && ir.right <= r.right + 0.5 &&
                        ir.top >= r.top - 0.5 && ir.bottom <= r.bottom + 0.5) : false,
          icoBox: ir ? Math.round(ir.width) + 'x' + Math.round(ir.height) : ''
        };
      });
      const gs = document.getElementById('gameScreen');
      return {
        btns,
        icoCount: document.querySelectorAll('.g-actions .mi-ico').length,
        styleCount: document.querySelectorAll('#miStyle').length,
        actH: Math.round(act.getBoundingClientRect().height),
        bodyOverflowX: document.body.scrollWidth - window.innerWidth,
        gsOverflowX: gs ? gs.scrollWidth - gs.clientWidth : 0,
        lastIsScan: (act.lastElementChild.getAttribute('onclick') || '').indexOf('showHint') !== -1,
        lastFullRow: getComputedStyle(act.lastElementChild).gridColumnStart === '1',
        actChildren: act.children.length,
        wordTop: Math.round(document.getElementById('gWord').getBoundingClientRect().top),
        choicesH: Math.round(document.getElementById('gChoices').getBoundingClientRect().height)
      };
    });

    ok('ปุ่มใน .g-actions ครบ 9 ใบ', info.actChildren === 9, info.actChildren);
    ok('ไอคอนครบ 9 ใบ', info.icoCount === 9, info.icoCount);
    ok('สไตล์ #miStyle มีใบเดียว', info.styleCount === 1, info.styleCount);
    ok('ภาพ decode ได้ครบทุกใบ', info.btns.every(b => b.decoded));
    ok('ภาพต้นทาง 72px ครบทุกใบ', info.btns.every(b => b.natural === 72),
       info.btns.map(b => b.natural));
    ok('เป็น data URI WebP ทุกใบ (ไม่มีคำขอออกเน็ต)', info.btns.every(b => b.isData));
    ok('ไอคอนอยู่ในกรอบปุ่ม ไม่ล้นออกไป', info.btns.every(b => b.inside));

    // ── 2 · อีโมจิถูกแทนที่ ไม่ใช่ซ้อน ──────────────────────────────
    const left = info.btns.filter((b, i) => b.text.indexOf(EMOJI[i]) === 0).map(b => b.tag);
    ok('อีโมจิเดิมถูกตัดออกครบทั้ง 9 ใบ', left.length === 0, left);
    ok('ข้อความบนปุ่มยังอ่านออก (ไม่ถูกตัดเกิน)',
       info.btns.every(b => b.text.length > 3), info.btns.map(b => b.text));

    // ── 3 · โครงกริดไม่ถูกแตะ (กับดักข้อ 11) ────────────────────────
    ok('SYSTEM SCAN ยังเป็นลูกตัวสุดท้ายของ .g-actions', info.lastIsScan);
    ok('ปุ่มสุดท้ายยังกินเต็มแถว', info.lastFullRow);

    // ── 4 · ไม่ล้นแนวนอน + โซนคำถาม-คำตอบไม่ขยับ ────────────────────
    ok('body ไม่ล้นแนวนอน', info.bodyOverflowX <= 0, info.bodyOverflowX);
    ok('#gameScreen ไม่ล้นแนวนอน', info.gsOverflowX <= 0, info.gsOverflowX);
    /* หัวโซนคำถามเป็นตัววัดที่นิ่งจริง — ความสูง #gChoices ขยับตามความยาวคำแปลที่สุ่มได้
       (ตัวเลือกยาวจะตัดเป็นสองบรรทัด) จึงเอามาเทียบเป็นเลขตายตัวไม่ได้ ให้บันทึกไว้ดูเฉย ๆ */
    ok('โซนคำถามยังอยู่ที่เดิม (ไม่ถูกดันลงมา)', info.wordTop <= 180, info.wordTop);
    log('     กรอบไอคอน ' + info.btns[0].icoBox + ' · แถวปุ่มสูง ' + info.actH +
        'px · gWord.top ' + info.wordTop + ' · choicesH ' + info.choicesH);

    // ── 5 · v4.6 เขียนทับแล้วต้องได้ภาพคืน ──────────────────────────
    const after = await page.evaluate(() => {
      renderStats(); abSyncButtons(); renderStats();
      const co = document.getElementById('abCoreBtn');
      const ab = document.getElementById('abAbyssBtn');
      const cls = (el) => (el && el.firstElementChild) ? el.firstElementChild.className : '';
      return {
        n: document.querySelectorAll('.g-actions .mi-ico').length,
        co: cls(co), ab: cls(ab),
        coText: co ? co.textContent.trim() : '', abText: ab ? ab.textContent.trim() : '',
        badge: !!(co && co.querySelector('.ab-badge'))
      };
    });
    ok('หลัง renderStats/abSyncButtons ไอคอนยังครบ 9', after.n === 9, after.n);
    ok('ไอคอน ⚙️ SYSTEM CORE ถูกใส่คืน', after.co === 'mi-ico', after.co);
    ok('ไอคอน 🕳️ ABYSS ถูกใส่คืน', after.ab === 'mi-ico', after.ab);
    ok('อีโมจิ ⚙️/🕳️ ไม่กลับมาซ้อน',
       after.coText.indexOf('⚙️') !== 0 && after.abText.indexOf('🕳️') !== 0,
       [after.coText, after.abText]);
    ok('ป้าย 💎 ของ v4.6 ยังอยู่ครบ', after.badge);

    // ── 6 · สลับโหมด ABYSS (ปุ่มถูกเขียนข้อความใหม่ทั้งใบ) ───────────
    const tog = await page.evaluate(() => {
      abToggleAbyss();
      const ab = document.getElementById('abAbyssBtn');
      return { first: ab.firstElementChild ? ab.firstElementChild.className : '', text: ab.textContent.trim() };
    });
    ok('กดสลับ ABYSS แล้วไอคอนยังอยู่', tog.first === 'mi-ico', tog);
    /* หน้าต่างที่อาจเด้งขึ้นมาตอนยังไม่ปลดล็อกแรงค์ ต้องปิดก่อนวัดต่อ */
    await page.evaluate(() => { const b = document.querySelector('#gLock.active .g-btn'); if (b) b.click(); });
    await page.waitForTimeout(300);

    // ── 7 · เรียกซ้ำต้องไม่แทรกซ้อน (กติกาข้อ 2) ────────────────────
    const rep = await page.evaluate(() => {
      for (let i = 0; i < 30; i++) miPaint();
      return {
        ico: document.querySelectorAll('.g-actions .mi-ico').length,
        img: document.querySelectorAll('.g-actions .mi-ico img').length,
        st: document.querySelectorAll('#miStyle').length,
        act: document.querySelector('.g-actions').children.length
      };
    });
    ok('เรียก miPaint 30 รอบไม่แทรกซ้ำ',
       rep.ico === 9 && rep.img === 9 && rep.st === 1 && rep.act === 9, rep);

    // ── 8 · ปุ่มยังกดได้จริง (ภาพไม่ขวางการกด) ──────────────────────
    /* ต้องเลื่อนปุ่มเข้ามาในจอก่อนเสมอ — elementFromPoint คืน null ทั้งตอน "มีอะไรมาบัง"
       และตอน "พิกัดหลุดกรอบ" ซึ่งเป็นคนละอาการกันคนละทางแก้ (บทเรียนของ dwGoInView ใน v4.9.2) */
    await page.evaluate(() => {
      const b = Array.prototype.filter.call(document.querySelector('.g-actions').children,
        (x) => (x.getAttribute('onclick') || '').indexOf('openStatus') !== -1)[0];
      b.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);
    const click = await page.evaluate(() => {
      const b = Array.prototype.filter.call(document.querySelector('.g-actions').children,
        (x) => (x.getAttribute('onclick') || '').indexOf('openStatus') !== -1)[0];
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      const onBtn = !!(hit && hit.closest && hit.closest('.g-actions .g-btn') === b);
      b.click();
      const open = !!document.querySelector('#gStatus.active');
      if (open) closeStatus();
      return { onBtn, open };
    });
    ok('ไม่มีอะไรมาบังปุ่ม (elementFromPoint โดนปุ่มจริง)', click.onBtn);
    ok('กดปุ่ม STATUS แล้วแผงเปิดได้ตามปกติ', click.open);

    // ── 9 · ไม่มี error หลงเหลือ ────────────────────────────────────
    ok('ไม่มี pageerror', errs.length === 0, errs);
    const el = await page.evaluate(() => {
      try {
        const raw = JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [];
        return raw.filter(e => JSON.stringify(e).indexOf('menuicon') !== -1).length;
      } catch (e) { return -1; }
    });
    ok('Error Log ไม่มีรายการของ menuicon', el === 0, el);

    await ctx.close();
  }

  // ── 10 · ถอดภาพออกแล้วต้องตกกลับไปใช้อีโมจิได้สนิท ────────────────
  {
    log('\n[ ไม่มีภาพฝัง — ต้องตกกลับไปใช้อีโมจิ ]');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.route('**fonts.gstatic.com**', r => r.abort());
    await page.addInitScript(() => {
      window.EventSource = function () { this.readyState = 1; this.close = function () {}; };
      const _f = window.fetch;
      window.fetch = function (u) {
        if (/firebasedatabase\.app|supabase/.test(String(u)))
          return Promise.resolve(new Response('null', { status: 200 }));
        return _f.apply(this, arguments);
      };
    });
    /* **ต้องล้าง MI_ART ตั้งแต่ในตัวไฟล์ ไม่ใช่ล้างทีหลังด้วย page.evaluate**
       ชั้นนี้ทาสีตั้งแต่ตอนโหลด (miInstall เป็น IIFE) กว่า evaluate จะได้ทำงาน อีโมจิก็ถูกตัด
       ไปแล้ว เทสต์จะตกด้วยเหตุผลผิดทั้งที่โค้ดถูก — จึงต้องปั้นไฟล์ชั่วคราวที่ไม่มีภาพฝัง */
    const bareFile = path.join(require('os').tmpdir(), 'hh_menu_icons_bare.html');
    const html = fs.readFileSync(path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html'), 'utf8');
    const m = html.match(/MI_ART = \{[\s\S]*?\n\}/);
    if (!m) { ok('หาก้อน MI_ART ในไฟล์แจกเจอ', false); }
    else {
      fs.writeFileSync(bareFile,
        html.replace(m[0], m[0].replace(/"data:image\/webp;base64,[^"]*"/g, '""')));
    }
    await page.goto('file://' + bareFile, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await enterGame(page);
    const bare = await page.evaluate(() => {
      miPaint();
      const act = document.querySelector('.g-actions');
      return {
        ico: document.querySelectorAll('.g-actions .mi-ico').length,
        img: document.querySelectorAll('.g-actions img').length,
        texts: Array.prototype.map.call(act.children, b => b.textContent.trim()),
        overflowX: document.body.scrollWidth - window.innerWidth
      };
    });
    ok('MI_ART ว่าง → ไม่มีไอคอนถูกแทรกเลย', bare.ico === 0, bare.ico);
    ok('MI_ART ว่าง → ไม่มี <img> ในแถวปุ่ม (ไม่มีรูปแตก)', bare.img === 0, bare.img);
    ok('MI_ART ว่าง → อีโมจิเดิมอยู่ครบทั้ง 9 ใบ',
       bare.texts.every((t, i) => t.indexOf(EMOJI[i]) === 0), bare.texts);
    ok('MI_ART ว่าง → ยังไม่ล้นแนวนอน', bare.overflowX <= 0, bare.overflowX);
    ok('MI_ART ว่าง → ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  log('\n══════════════════════════════════════');
  log('  ผ่าน ' + PASS + ' · ตก ' + FAIL);
  console.log('test_menu_icons: pass=' + PASS + ' fail=' + FAIL + ' → ' + LOG);
  process.exit(FAIL ? 1 : 0);
})();
