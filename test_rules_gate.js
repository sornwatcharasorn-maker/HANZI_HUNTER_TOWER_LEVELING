/* ชุดเทสต์ชั้น v5.6 · RULES GATE
   NODE_PATH=/opt/node22/lib/node_modules node test_rules_gate.js            */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'test_rules_gate.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function log(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { pass++; log('  ✅ ' + name); }
  else { fail++; log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

/* stub เน็ตทั้งหมด — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์สและเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า
   ไม่ stub = เทสต์ยิงเข้าฐานข้อมูลของห้องเรียนจริง */
const STUB = `
  window.__NET = { push: [], sse: 0 };
  const _f = window.fetch;
  window.fetch = function (u, o) {
    const s = String(u);
    if (/firebasedatabase\\.app|supabase|fake/.test(s)) {
      window.__NET.push.push({ u: s, m: (o && o.method) || 'GET' });
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return _f.apply(this, arguments);
  };
  window.EventSource = function (u) { window.__NET.sse++; this.url = u; this.readyState = 1;
    this.close = function () { this.readyState = 2; }; };
`;

async function fresh(browser, opt) {
  const ctx = await browser.newContext(opt || {});
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

const scrollBottom = page => page.evaluate(() => {
  const b = document.getElementById('rgBody');
  b.scrollTop = b.scrollHeight;
  b.dispatchEvent(new Event('scroll'));
});

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  // ── บล็อก 1 · ป๊อปอัปขึ้นตั้งแต่เปิดเว็บ และ "มองเห็นจริง" ──────────
  {
    log('\n[1] ป๊อปอัปกติกา — ขึ้นเองตั้งแต่เปิดเว็บ');
    const { ctx, page, errs } = await fresh(browser, { viewport: { width: 390, height: 844 } });

    ok('#rgGate มีอยู่และ active', await page.evaluate(() =>
      !!document.querySelector('#rgGate.active')));

    /* กับดักข้อ 25 — .active ไม่ใช่หลักฐานว่ามองเห็น ต้องพิสูจน์ด้วย elementFromPoint */
    const seen = await page.evaluate(() => {
      const box = document.querySelector('#rgGate .rg-box');
      const r = box.getBoundingClientRect();
      let hit = 0, miss = 0;
      for (let x = r.left + 8; x < r.right - 8; x += 24) {
        for (let y = r.top + 8; y < r.bottom - 8; y += 24) {
          const el = document.elementFromPoint(x, y);
          if (el && el.closest && el.closest('#rgGate')) hit++; else miss++;
        }
      }
      return { hit, miss, w: Math.round(r.width), h: Math.round(r.height) };
    });
    ok('ทุกจุดในกรอบเป็นลูกของ #rgGate (ไม่มีอะไรมาบัง)', seen.miss === 0 && seen.hit > 100, seen);

    ok('ป๊อปอัปอยู่เหนือหน้าต้อนรับ', await page.evaluate(() => {
      const z = n => parseInt(getComputedStyle(n).zIndex || 0, 10) || 0;
      return z(document.getElementById('rgGate')) >= 1000;
    }));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ── บล็อก 2 · เนื้อหาครบตามสเปก ────────────────────────────────────
  {
    log('\n[2] เนื้อหากติกา — ครบทุกหัวข้อ');
    const { ctx, page, errs } = await fresh(browser, { viewport: { width: 390, height: 844 } });
    const txt = await page.evaluate(() => document.getElementById('rgGate').innerText);

    ok('4 หัวข้อหลัก', await page.evaluate(() =>
      document.querySelectorAll('#rgBody .rg-sec').length === 4));

    [['Chrome', /Google Chrome/], ['Safari', /Safari/], ['ห้าม LINE', /LINE/],
     ['ห้าม Facebook', /Facebook/], ['ข้อมูลสลายหาย', /สลายหายไป/]]
      .forEach(([n, re]) => ok('คำเตือนอุปกรณ์: ' + n, re.test(txt)));

    [['Cloud Sync v5.5', /REALTIME CLOUD SYNC v5\.5/], ['อัตโนมัติ 100%', /อัตโนมัติ 100%/],
     ['Realtime', /Realtime/], ['GM Control Room', /GM Control Room/]]
      .forEach(([n, re]) => ok('คลาวด์ซิงก์: ' + n, re.test(txt)));

    const guide = ['QUESTS', 'STATUS', 'ANALYTICS', 'LEADERBOARD', 'SHOP',
                   'CODEX', 'SYSTEM CORE', 'ABYSS', 'SYSTEM SCAN'];
    guide.forEach(g => ok('คู่มือระบบ: ' + g, txt.includes(g)));
    ok('คู่มือครบ 9 รายการ', await page.evaluate(() =>
      document.querySelectorAll('#rgBody .rg-sec')[2].querySelectorAll('.rg-row').length === 9));

    [['หัวข้อ Anti-Cheat', /ANTI-CHEAT AUTO PAUSE/], ['ปุ่มกลับสู้', /กลับเข้าสู่การต่อสู้/],
     ['ส่งขึ้น GM', /ยิงขึ้น/]].forEach(([n, re]) => ok('ระบบพักหน้าจอ: ' + n, re.test(txt)));

    ok('ปุ่มยืนยันใช้ข้อความตามสเปก', await page.evaluate(() =>
      document.getElementById('rgOk').textContent.trim() ===
      '🔵 ยืนยันรับทราบกติกา · เข้าสู่เกท (登塔) ▶'));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ── บล็อก 3 · บังคับอ่านครบก่อนถึงกดได้ ────────────────────────────
  {
    log('\n[3] บังคับอ่าน — ปุ่มปลดล็อกเมื่อเลื่อนครบ');
    const { ctx, page, errs } = await fresh(browser, { viewport: { width: 390, height: 700 } });

    ok('เนื้อหายาวเกินกรอบจริง (ต้องเลื่อน)', await page.evaluate(() => {
      const b = document.getElementById('rgBody');
      return b.scrollHeight - b.clientHeight > 24;
    }));
    ok('ปุ่มยืนยันถูกล็อกไว้ก่อน', await page.evaluate(() =>
      document.getElementById('rgOk').disabled === true));
    ok('ป้าย "เลื่อนอ่านให้ครบ" โผล่', await page.evaluate(() => {
      const m = document.getElementById('rgMore');
      return getComputedStyle(m).display !== 'none';
    }));
    ok('กดทั้งที่ยังล็อก = ไม่มีอะไรเกิดขึ้น', await page.evaluate(() => {
      document.getElementById('rgOk').click();
      return document.querySelector('#rgGate.active') !== null &&
             getComputedStyle(document.querySelector('.login-box')).display === 'none';
    }));

    await scrollBottom(page);
    await page.waitForTimeout(80);
    ok('เลื่อนครบแล้วปุ่มปลดล็อก', await page.evaluate(() =>
      document.getElementById('rgOk').disabled === false));
    ok('ป้ายเตือนหายไป', await page.evaluate(() =>
      getComputedStyle(document.getElementById('rgMore')).display === 'none'));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ── บล็อก 4 · บล็อกทางเข้าเกททุกทาง ────────────────────────────────
  {
    log('\n[4] เข้าเกทไม่ได้จนกว่าจะรับทราบ');
    const { ctx, page, errs } = await fresh(browser, { viewport: { width: 390, height: 844 } });

    /* แตะหน้าต้อนรับ */
    await page.evaluate(() => enterGate());
    await page.waitForTimeout(500);
    ok('enterGate() ถูกบล็อก · หน้าต้อนรับยังอยู่', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.login-box')).display === 'none' &&
      !document.getElementById('introScreen').classList.contains('hide')));
    ok('ป๊อปอัปยังเปิดอยู่', await page.evaluate(() =>
      !!document.querySelector('#rgGate.active')));

    /* ปุ่ม "แตะเพื่อเข้าสู่ประตูมิติ" */
    await page.evaluate(() => document.querySelector('.intro-enter').click());
    await page.waitForTimeout(400);
    ok('ปุ่มบนหน้าต้อนรับก็ถูกบล็อก', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.login-box')).display === 'none'));

    /* กด Enter */
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    ok('กด Enter ทั้งที่ยังไม่อ่านครบ = ไม่ผ่าน', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.login-box')).display === 'none' &&
      !!document.querySelector('#rgGate.active')));

    /* อ่านครบ → ยืนยัน */
    await scrollBottom(page);
    await page.waitForTimeout(80);
    await page.evaluate(() => document.getElementById('rgOk').click());
    await page.waitForTimeout(700);
    ok('ยืนยันแล้วป๊อปอัปปิด', await page.evaluate(() =>
      !document.querySelector('#rgGate.active')));
    ok('เข้าสู่เกท (กล่องล็อกอินโผล่)', await page.evaluate(() =>
      getComputedStyle(document.querySelector('.login-box')).display === 'flex'));
    ok('หน้าต้อนรับถูกซ่อน', await page.evaluate(() =>
      document.getElementById('introScreen').style.display === 'none'));

    /* กดยืนยันแล้วต้องไม่เด้งซ้ำ */
    await page.evaluate(() => enterGate());
    await page.waitForTimeout(200);
    ok('เรียก enterGate ซ้ำ ป๊อปอัปไม่เด้งกลับมา', await page.evaluate(() =>
      !document.querySelector('#rgGate.active')));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ── บล็อก 5 · เข้าเกมได้จริง + ระบบพักหน้าจอ ────────────────────────
  {
    log('\n[5] ระบบพักหน้าจออัตโนมัติ + สะพานส่งข้อมูล GM');
    const { ctx, page, errs } = await fresh(browser, { viewport: { width: 390, height: 844 } });

    await scrollBottom(page);
    await page.waitForTimeout(80);
    await page.evaluate(() => document.getElementById('rgOk').click());
    await page.waitForTimeout(700);
    await page.evaluate(() => switchTab('register'));
    await page.evaluate(() => {
      document.getElementById('reg-id').value = 'rgtest';
      document.getElementById('reg-pw').value = '1234';
      document.getElementById('reg-pw2').value = '1234';
      handleSubmit();
    });
    await page.waitForTimeout(1400);

    /* หน้าต่างจั่วการ์ดของ v4.7 คั่นอยู่ ต้องเลือกให้จบก่อน */
    await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) c.click();
    });
    await page.waitForTimeout(900);
    await page.waitForFunction(() => !G.locked && G.currentMonster, null, { timeout: 15000 });

    /* ถ้าจั่วได้ 🧘 สมาธิแน่วแน่ ทุกข้อจะเริ่มด้วยการแช่แข็ง QUESTION_TIMER เป็น null
       โดยชอบธรรม แล้วเคสจะตกด้วยเหตุผลผิด — สลับเป็นใบที่ไม่ยุ่งกับนาฬิกาก่อนเสมอ
       (ตั้งเป็น null ไม่ได้ เพราะ "มือเปล่าบนชั้นแรกของช่วง" คือเงื่อนไขจั่วใหม่ของ v4.7) */
    await page.evaluate(() => {
      CD_CARD = null;
      CD_BAND = cdBandOf(G.floor);
      CD_SKIP = G.floor;
      cdPaintUi();
      clearQuestionTimer();
      startQuestionTimer();
    });
    await page.evaluate(() => { acFocusQa(); acSync(true); });
    await page.waitForTimeout(120);

    ok('เข้าหอคอยได้จริง', await page.evaluate(() =>
      document.getElementById('gameScreen').classList.contains('active')));
    ok('นาฬิกาต่อข้อเดินอยู่ก่อนทดสอบ', await page.evaluate(() => QUESTION_TIMER !== null));

    ok('window.syncStudentDataToGM ถูกเปิดเป็นสาธารณะ', await page.evaluate(() =>
      typeof window.syncStudentDataToGM === 'function'));

    /* หน้าต่างจั่วการ์ดของ v4.7 นับเป็น "หน้าต่างระบบเปิดค้าง" ของ v4.8.1 อยู่แล้ว
       ตอนเลือกการ์ดจึงมีการยิงขึ้น GM ไปหนึ่งรอบโดยชอบธรรม — ตัวหน่วงกันสแปมจะกลืน
       การพักครั้งถัดไปที่เกิดภายใน RG_SYNC_GAP ต้องล้างนาฬิกาหน่วงก่อนวัดเสมอ */
    ok('เคยยิงขึ้น GM มาแล้วตอนหน้าต่างจั่วการ์ดเปิด', await page.evaluate(() => RG_SYNC_T > 0));

    /* ดักการยิงขึ้น GM */
    await page.evaluate(() => {
      window.__SYNC = 0;
      RG_SYNC_T = 0;
      const _s = window.syncStudentDataToGM;
      window.syncStudentDataToGM = syncStudentDataToGM = function () {
        window.__SYNC++; return _s.apply(this, arguments);
      };
    });
    ok('สถานะพักรอบก่อนถูกล้างแล้ว (พร้อมจับรอยต่อ)', await page.evaluate(() => RG_PAUSED === false));

    /* จำลองสลับแท็บ */
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(250);

    ok('นาฬิกาถูกหยุด (ทั้ง TIMER และ TICK)', await page.evaluate(() =>
      QUESTION_TIMER === null && QUESTION_TICK === null));
    ok('ม่านหยุดเกมขึ้น', await page.evaluate(() =>
      document.getElementById('acVeil').classList.contains('active')));
    ok('โจทย์ถูกเบลอ (ac-mask)', await page.evaluate(() => {
      const f = getComputedStyle(document.getElementById('gWord')).filter;
      return /blur/.test(f);
    }));
    ok('ตัวเลือกกดไม่ได้ระหว่างหยุด', await page.evaluate(() =>
      getComputedStyle(document.getElementById('gChoices')).pointerEvents === 'none'));

    ok('หัวข้อบนม่านตรงสเปก', await page.evaluate(() =>
      document.getElementById('acVeilTitle').textContent ===
      '⏸️ SYSTEM PAUSED — ตรวจพบการเลื่อนออกจากหน้าต่างคำถาม'),
      await page.evaluate(() => document.getElementById('acVeilTitle').textContent));

    ok('ปุ่มบนม่านตรงสเปก', await page.evaluate(() =>
      document.querySelector('#acVeil .ac-btn').textContent === '▶️ กลับเข้าสู่การต่อสู้'),
      await page.evaluate(() => document.querySelector('#acVeil .ac-btn').textContent));

    ok('ม่านทึบพอที่จะเรียกว่าจอดำ', await page.evaluate(() => {
      const m = getComputedStyle(document.getElementById('acVeil')).backgroundColor
        .match(/[\d.]+/g).map(Number);
      return m[0] < 20 && m[1] < 20 && m[2] < 30 && (m[3] === undefined || m[3] >= 0.85);
    }), await page.evaluate(() => getComputedStyle(document.getElementById('acVeil')).backgroundColor));

    ok('ยิงข้อมูลขึ้น GM ตอนเข้าสถานะพัก', await page.evaluate(() => window.__SYNC >= 1),
      await page.evaluate(() => window.__SYNC));
    ok('มีคำขอออกไปที่ฐานข้อมูลจริง', await page.evaluate(() =>
      window.__NET.push.some(p => p.m === 'PUT' || p.m === 'PATCH' || p.m === 'POST')),
      await page.evaluate(() => window.__NET.push.slice(-4)));

    /* กลับเข้าสู่การต่อสู้ */
    const left = await page.evaluate(() => AC_LEFT);
    await page.evaluate(() => document.querySelector('#acVeil .ac-btn').click());
    await page.waitForTimeout(250);
    ok('กดปุ่มแล้วม่านปิด', await page.evaluate(() =>
      !document.getElementById('acVeil').classList.contains('active')));
    ok('นาฬิกาเดินต่อจากวินาทีเดิม', await page.evaluate(prev => {
      const now = QUESTION_ENDS - Date.now();
      return QUESTION_TIMER !== null && Math.abs(now - prev) < 400;
    }, left), left);
    ok('โจทย์กลับมาชัด', await page.evaluate(() =>
      !/blur/.test(getComputedStyle(document.getElementById('gWord')).filter)));

    /* ยิงซ้ำต้องถูกกันด้วยตัวหน่วง */
    const before = await page.evaluate(() => window.__SYNC);
    await page.evaluate(() => { acTogglePause(); });
    await page.waitForTimeout(200);
    ok('พักซ้ำในระยะหน่วง = ไม่ยิงซ้ำ', await page.evaluate(b => window.__SYNC === b, before));
    ok('หัวข้อโหมดกดพักเอง', await page.evaluate(() =>
      document.getElementById('acVeilTitle').textContent ===
      '⏸️ SYSTEM PAUSED — พักหน้าจอชั่วคราว'));
    await page.evaluate(() => acResumeClick());
    await page.waitForTimeout(150);

    /* เรียกตรง ๆ ต้องทำงานได้เสมอ */
    ok('เรียก window.syncStudentDataToGM() ตรง ๆ ได้ผล', await page.evaluate(() => {
      const n = window.__NET.push.length;
      const r = window.syncStudentDataToGM({});
      return r === true && window.__NET.push.length >= n;
    }));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ── บล็อก 6 · เลย์เอาต์ทุกความกว้าง ────────────────────────────────
  {
    log('\n[6] เลย์เอาต์ — ไม่ล้นแนวนอนทุกจอ');
    for (const w of [320, 360, 390, 430, 768]) {
      const { ctx, page, errs } = await fresh(browser, { viewport: { width: w, height: 760 } });
      const r = await page.evaluate(() => {
        const box = document.querySelector('#rgGate .rg-box');
        const b = document.getElementById('rgBody');
        return {
          over: document.body.scrollWidth - window.innerWidth,
          boxIn: box.getBoundingClientRect().right <= window.innerWidth + 1 &&
                 box.getBoundingClientRect().left >= -1,
          footIn: document.getElementById('rgOk').getBoundingClientRect().bottom <= window.innerHeight + 1,
          bodyScroll: b.scrollWidth - b.clientWidth
        };
      });
      ok('จอ ' + w + ' · ไม่ล้นแนวนอน', r.over <= 0, r);
      ok('จอ ' + w + ' · กรอบอยู่ในจอ', r.boxIn, r);
      ok('จอ ' + w + ' · ปุ่มยืนยันเห็นเสมอโดยไม่ต้องเลื่อน', r.footIn, r);
      ok('จอ ' + w + ' · เนื้อหาไม่ล้นแนวนอนในกล่อง', r.bodyScroll <= 0, r);
      ok('จอ ' + w + ' · ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  // ── บล็อก 7 · idempotent + Error Log สะอาด ─────────────────────────
  {
    log('\n[7] กันแทรกซ้ำ + Error Log');
    const { ctx, page, errs } = await fresh(browser, { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => { for (let i = 0; i < 20; i++) { rgOpen(); } });
    ok('เรียก rgOpen ซ้ำ 20 รอบ ยังมี #rgGate ใบเดียว', await page.evaluate(() =>
      document.querySelectorAll('#rgGate').length === 1));
    ok('มี #rgStyle ใบเดียว', await page.evaluate(() =>
      document.querySelectorAll('#rgStyle').length === 1));
    ok('มี .rg-sec 4 อันเท่าเดิม', await page.evaluate(() =>
      document.querySelectorAll('#rgBody .rg-sec').length === 4));

    const el = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('yao_errlog') || '[]'); } catch (e) { return []; }
    });
    const rules = el.filter(x => /RULES/.test(x.msg || ''));
    ok('Error Log ไม่มีรายการของชั้นนี้', rules.length === 0, rules.slice(0, 3));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  log('\n══════════════════════════════');
  log('ผ่าน ' + pass + ' · ตก ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { log('CRASH ' + e.stack); process.exit(1); });
