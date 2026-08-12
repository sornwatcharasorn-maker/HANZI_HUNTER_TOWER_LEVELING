/* ─────────────────────────────────────────────────────────────
   ชุดทดสอบชั้นที่สิบเจ็ด — v5.4 · AUTO-SYNC ENGINE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_auto_sync.js

   ใช้ RTDB ปลอมที่เขียนทับทั้ง window.fetch และ window.EventSource
   ผ่าน page.addInitScript (ต้องติดตั้งก่อนหน้าโหลด เพราะชั้นนี้ยิงตั้งแต่ติดตั้ง)
     window.__RT.rows  แถวทั้งหมดที่ถูก PUT ขึ้นไป
     window.__RT.log   คำขอ REST ทุกครั้ง [method, url]
     window.__RT.sse   URL ของสาย EventSource ล่าสุด
     window.__RT.fail  ตั้งเป็น 1 เพื่อจำลองเน็ตหลุด
   ───────────────────────────────────────────────────────────── */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const GAME = 'file://' + path.join(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.join(__dirname, 'test_auto_sync.log');
const DB   = 'https://hanzi-hunter-tower-leveling-default-rtdb.asia-southeast1.firebasedatabase.app';

let pass = 0, fail = 0;
try { fs.unlinkSync(LOG); } catch (e) {}
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { pass++; say('  ✅ ' + name); }
  else { fail++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

const FAKE = () => {
  window.__RT = { rows: {}, log: [], sse: '', esCount: 0, fail: 0 };
  const real = window.fetch;
  window.fetch = function (url, opt) {
    const u = String(url), o = opt || {}, m = (o.method || 'GET').toUpperCase();
    if (u.indexOf('firebasedatabase.app') < 0) return real.apply(this, arguments);
    window.__RT.log.push([m, u]);
    if (window.__RT.fail) return Promise.reject(new Error('simulated network down'));
    if (m === 'PUT') {
      const id = decodeURIComponent((u.split('/students/')[1] || '').split('.json')[0]);
      try { window.__RT.rows[id] = JSON.parse(o.body); } catch (e) {}
      return Promise.resolve(new Response(o.body || '{}', { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify(window.__RT.rows), { status: 200 }));
  };
  window.EventSource = function (url) {
    window.__RT.sse = String(url); window.__RT.esCount++;
    this.readyState = 1; this.url = String(url);
    this._l = {};
    this.addEventListener = (t, f) => { (this._l[t] = this._l[t] || []).push(f); };
    this.removeEventListener = () => {};
    this.close = () => { this.readyState = 2; };
    this.emit = (t, d) => { (this._l[t] || []).forEach(f => f({ data: JSON.stringify(d) })); };
    window.__RT.es = this;
    setTimeout(() => { if (this.onopen) this.onopen(); }, 5);
  };
  window.EventSource.prototype = {};
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const errs = [];
  async function newPage(ctxOpt) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, ctxOpt || {}));
    const page = await ctx.newPage();
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.route('**fonts.gstatic.com**', r => r.abort());
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(FAKE);
    return { ctx, page };
  }

  async function login(page, id) {
    await page.evaluate(() => enterGate());
    await wait(700);
    await page.evaluate(u => {
      switchTab('register');
      document.getElementById('reg-id').value = u;
      document.getElementById('reg-pw').value = '1234';
      document.getElementById('reg-pw2').value = '1234';
      handleSubmit();
    }, id);
    await wait(900);
    // การ์ดของ v4.7 คั่นตอนเข้าเกม — เลือกให้จบก่อน
    await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) c.click();
    });
    await wait(800);
  }

  // ══════════ 1 · บังคับเขียนคอนฟิกตอนเปิดหน้า ══════════
  say('\n[1] Forced config on page open');
  {
    const { ctx, page } = await newPage();
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(700);

    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('yao_fbrt') || '{}'));
    ok('yao_fbrt.on = true', cfg.on === true, cfg);
    ok('yao_fbrt.url ตรงกับ RTDB ที่กำหนด', cfg.url === DB, cfg.url);
    ok('yao_fbrt.node = students', cfg.node === 'students', cfg.node);
    ok('yao_fbrt.pub = true', cfg.pub === true, cfg.pub);
    ok('yao_fbrt_pub = "1"', await page.evaluate(() => localStorage.getItem('yao_fbrt_pub')) === '1');
    ok('fbOn() เป็น true ทันทีโดยไม่ต้องตั้งค่าเอง', await page.evaluate(() => fbOn()));
    ok('FB_CFG.url ถูกโหลดเข้าตัวแปรจริง', await page.evaluate(() => FB_CFG.url) === DB);
    ok('ยังไม่ล็อกอิน = ยังไม่มีคำขอออกเน็ต',
       (await page.evaluate(() => window.__RT.log.length)) === 0,
       await page.evaluate(() => window.__RT.log));
    await ctx.close();
  }

  // ══════════ 2 · ล้างคอนฟิกเก่าทิ้งแล้วยังบังคับได้ ══════════
  say('\n[2] Stale config from older version is overwritten');
  {
    const { ctx, page } = await newPage();
    await page.addInitScript(() => {
      localStorage.setItem('yao_fbrt', JSON.stringify({ on: false, url: '', node: 'old_node', pub: false }));
    });
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(700);
    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('yao_fbrt') || '{}'));
    ok('on:false ของเดิมถูกเปิดกลับ', cfg.on === true, cfg);
    ok('node เก่าถูกเขียนทับเป็น students', cfg.node === 'students', cfg.node);
    ok('pub:false ของเดิมถูกดันกลับเป็น true', cfg.pub === true, cfg.pub);
    ok('fbOn() ใช้งานได้', await page.evaluate(() => fbOn()));
    await ctx.close();
  }

  // ══════════ 3 · ปลดการบล็อกจากคอนฟิก v5.2 (fbClash) ══════════
  say('\n[3] v5.2 clash is repaired, not left blocking');
  {
    const { ctx, page } = await newPage();
    await page.addInitScript(db => {
      localStorage.setItem('yao_cloud', JSON.stringify({
        provider: 'firebase', url: db, key: '', table: 'students', auto: true, strict: false
      }));
    }, DB);
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(700);
    ok('fbClash() ถูกปลดแล้ว', (await page.evaluate(() => fbClash())) === false);
    ok('fbOn() ไม่ถูกบล็อก', await page.evaluate(() => fbOn()));
    const cs = await page.evaluate(() => JSON.parse(localStorage.getItem('yao_cloud') || '{}'));
    ok('v5.2 ถูกย้ายไปโหนด hunters', cs.table === 'hunters', cs);
    ok('v5.2 ยังเป็น provider firebase เหมือนเดิม (ไม่ได้ปิดทิ้ง)', cs.provider === 'firebase', cs);
    await ctx.close();
  }

  // ══════════ 3.5 · ครูตั้ง URL เองแล้วต้องไม่ถูกเขียนทับ ══════════
  say('\n[3.5] Teacher override survives the forced seed');
  {
    const { ctx, page } = await newPage();
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(600);
    ok('เริ่มต้นยังไม่ใช่โหมดตั้งเอง', (await page.evaluate(() => asManual())) === false);

    await page.evaluate(() => fbCfgSave({ url: 'https://other-db.test', node: 'room9' }));
    ok('ปักธงตั้งเองแล้ว', await page.evaluate(() => asManual()));
    await page.evaluate(() => { asSeed(); });
    ok('asSeed ไม่เขียนทับ URL ของครู',
       (await page.evaluate(() => FB_CFG.url)) === 'https://other-db.test',
       await page.evaluate(() => FB_CFG.url));
    ok('asSeed ไม่เขียนทับโหนดของครู', (await page.evaluate(() => FB_CFG.node)) === 'room9');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(300);
    ok('สลับแท็บกลับมาก็ยังไม่ถูกเขียนทับ',
       (await page.evaluate(() => FB_CFG.url)) === 'https://other-db.test');

    await page.evaluate(() => fbCfgSave({ url: '' }));
    ok('ล้าง URL ให้ว่าง = กลับสู่โหมดอัตโนมัติ', (await page.evaluate(() => asManual())) === false);
    await page.evaluate(() => asSeed());
    ok('แล้ว asSeed ดันค่าอัตโนมัติกลับมา', (await page.evaluate(() => FB_CFG.url)) === DB,
       await page.evaluate(() => FB_CFG.url));
    ok('โหนดกลับเป็น students', (await page.evaluate(() => FB_CFG.node)) === 'students');
    await ctx.close();
  }

  // ══════════ 4 · ยิงข้อมูลทุก 5 วินาที ══════════
  say('\n[4] 5-second heartbeat → PUT /students/<id>.json');
  {
    const { ctx, page } = await newPage();
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(500);
    await login(page, 'beat01');

    ok('AS_TICK = 5000', (await page.evaluate(() => AS_TICK)) === 5000);
    ok('หัวใจเริ่มเต้นแล้ว', (await page.evaluate(() => AS_T !== null)));

    await page.evaluate(() => { window.__RT.log.length = 0; window.__RT.rows = {}; });
    const t0 = Date.now();
    await wait(11500);
    const log = await page.evaluate(() => window.__RT.log.slice());
    const puts = log.filter(l => l[0] === 'PUT');
    say('    PUT ใน ' + ((Date.now() - t0) / 1000).toFixed(1) + ' วิ = ' + puts.length + ' ครั้ง');
    ok('ยิงอย่างน้อย 2 ครั้งใน ~11 วินาที', puts.length >= 2, puts.length);
    ok('ไม่ยิงถี่เกินจริง (≤ 4 ครั้ง)', puts.length <= 4, puts.length);
    ok('endpoint = ${db}/students/${hunterId}.json',
       puts.length > 0 && puts[0][1] === DB + '/students/beat01.json', puts[0]);

    const row = await page.evaluate(() => window.__RT.rows['beat01']);
    ok('payload มี Level', row && typeof row.lv === 'number', row && row.lv);
    ok('payload มี Floor', row && typeof row.floor === 'number' && typeof row.mfloor === 'number');
    ok('payload มี EXP', row && typeof row.exp === 'number');
    ok('payload มี Gold', row && typeof row.gold === 'number');
    ok('payload มี Accuracy', row && typeof row.acc === 'number');
    ok('payload มี at (นาฬิกาให้ครูดูว่าใครออนไลน์)', row && typeof row.at === 'number');
    ok('payload ไม่มีรหัสผ่าน', row && !('pw' in row) && !('pwh' in row), row && Object.keys(row));

    // ค่าที่ขยับต้องตามขึ้นไปด้วย
    await page.evaluate(() => { G.gold = 4321; saveProgress(); });
    await wait(6000);
    ok('ค่าที่เปลี่ยนถูกส่งตามขึ้นไป',
       (await page.evaluate(() => window.__RT.rows['beat01'].gold)) === 4321,
       await page.evaluate(() => window.__RT.rows['beat01'].gold));
    await ctx.close();
  }

  // ══════════ 5 · beforeunload / visibilitychange ══════════
  say('\n[5] Immediate push on beforeunload + visibilitychange');
  {
    const { ctx, page } = await newPage();
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(500);
    await login(page, 'evt01');

    await page.evaluate(() => { window.__RT.log.length = 0; });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    await wait(400);
    let n = await page.evaluate(() => window.__RT.log.filter(l => l[0] === 'PUT').length);
    ok('beforeunload ยิงทันที', n >= 1, n);
    ok('beforeunload ดับหัวใจด้วย (ไม่ยิงซ้ำหลังหน้าเพจตาย)',
       (await page.evaluate(() => AS_T === null)));

    await page.evaluate(() => { AS_T = null; asStart(); window.__RT.log.length = 0; });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(400);
    n = await page.evaluate(() => window.__RT.log.filter(l => l[0] === 'PUT').length);
    ok('พับจอ/สลับแอป ยิงทันที', n >= 1, n);

    await page.evaluate(() => { window.__RT.log.length = 0; });
    await wait(6000);
    n = await page.evaluate(() => window.__RT.log.filter(l => l[0] === 'PUT').length);
    ok('ระหว่างอยู่หลังจอ หัวใจไม่ยิงซ้ำ (ประหยัดแบต)', n === 0, n);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await wait(500);
    n = await page.evaluate(() => window.__RT.log.filter(l => l[0] === 'PUT').length);
    ok('กลับมาที่จอ ยิงทันทีหนึ่งครั้ง', n >= 1, n);
    ok('คอนฟิกยังถูกต้องหลังกลับมา', await page.evaluate(() => fbOn()));
    await ctx.close();
  }

  // ══════════ 6 · ฝั่งครู — SSE ที่โหนด /students ══════════
  say('\n[6] GM side subscribes to /students');
  {
    const { ctx, page } = await newPage();
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(500);
    await login(page, 'gm01');

    await page.evaluate(() => {
      document.getElementById('teacher-code').value = TEACHER_PIN;
      openTeacherPanel();
    });
    await wait(700);

    const sse = await page.evaluate(() => window.__RT.sse);
    ok('เปิดสาย SSE ตอนกางแผง GM', !!sse, sse);
    ok('สาย SSE ชี้ที่โหนด /students', sse === DB + '/students.json', sse);
    ok('FB_MON เปิดอยู่', await page.evaluate(() => FB_MON === true));

    // ป้อนข้อมูลปลอมเข้าสายแล้วต้องขึ้นตาราง
    await page.evaluate(() => {
      window.__RT.es.emit('put', { path: '/', data: {
        stu_a: { u: 'stu_a', name: 'สมชาย', room: '', lv: 7, exp: 40, mexp: 100,
                 floor: 3, mfloor: 4, gold: 900, corr: 20, wrong: 5, acc: 80,
                 words: 12, rank: 'E', at: Date.now(), weak: [] }
      }});
    });
    await wait(400);
    const html = await page.evaluate(() => document.getElementById('fbBody').innerHTML);
    ok('แถวนักเรียนขึ้นตารางสด', html.indexOf('สมชาย') >= 0);
    ok('ตารางสดแสดงอยู่จริง',
       (await page.evaluate(() => getComputedStyle(document.getElementById('fbLive')).display)) !== 'none');

    // เฉพาะฟิลด์เดียวขยับ ต้องผสมเข้าแถวเดิม
    await page.evaluate(() => {
      window.__RT.es.emit('put', { path: '/stu_a/gold', data: 1234 });
    });
    await wait(300);
    ok('อัปเดตรายฟิลด์ผสมเข้าแถวเดิม',
       (await page.evaluate(() => FB_LIVE.stu_a.gold)) === 1234);

    ok('ปุ่มสลับโหมดเครื่องมีใบเดียว',
       (await page.evaluate(() => document.querySelectorAll('#asPubBtn').length)) === 1);
    await page.evaluate(() => gmRender());
    await page.evaluate(() => gmRender());
    ok('เรียก gmRender ซ้ำแล้วปุ่มไม่งอกเพิ่ม (กับดักข้อ 2)',
       (await page.evaluate(() => document.querySelectorAll('#asPubBtn').length)) === 1);

    // ปลดธงผู้เผยแพร่บนเครื่องครู
    await page.evaluate(() => asSetPub(false));
    await wait(200);
    ok('ปลดธงแล้ว yao_fbrt_pub = "0"',
       (await page.evaluate(() => localStorage.getItem('yao_fbrt_pub'))) === '0');
    ok('ปลดธงแล้ว asAlive() เป็น false', (await page.evaluate(() => asAlive())) === false);
    await page.evaluate(() => { window.__RT.log.length = 0; });
    await wait(6000);
    ok('เครื่องที่ปลดธงแล้วไม่ส่งอะไรขึ้นไปเลย',
       (await page.evaluate(() => window.__RT.log.filter(l => l[0] === 'PUT').length)) === 0);
    ok('แต่ยังรับสัญญาณอยู่ (ครูยังเห็นตาราง)', await page.evaluate(() => !!window.__RT.es));

    await page.evaluate(() => asSetPub(true));
    ok('เปิดธงกลับได้', (await page.evaluate(() => asAlive())) === true);

    await page.evaluate(() => closeGm());
    await wait(300);
    ok('พับแผงแล้วตัดสาย', (await page.evaluate(() => FB_ES === null && FB_MON === false)));
    await ctx.close();
  }

  // ══════════ 7 · เน็ตหลุดต้องไม่ทำเกมพัง ══════════
  say('\n[7] Offline resilience');
  {
    const { ctx, page } = await newPage();
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    await wait(500);
    await login(page, 'off01');
    await page.evaluate(() => { window.__RT.fail = 1; });
    await wait(6000);
    ok('เน็ตหลุดแล้วเกมยังเล่นได้', await page.evaluate(() => !!G && G.hp > 0));
    ok('ไม่มี pageerror จากเน็ตหลุด', errs.length === 0, errs.slice(0, 2));
    await page.evaluate(() => { window.__RT.fail = 0; window.__RT.log.length = 0; });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await wait(600);
    ok('สัญญาณกลับมาแล้วดันของค้างเอง',
       (await page.evaluate(() => window.__RT.log.filter(l => l[0] === 'PUT').length)) >= 1);
    const el = await page.evaluate(() => (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
      .filter(r => !/simulated network down/.test(JSON.stringify(r))).length);
    ok('Error Log ไม่มีอะไรนอกจากเน็ตหลุดที่จำลองไว้', el === 0, el);
    await ctx.close();
  }

  // ══════════ 8 · เลย์เอาต์ไม่ขยับ ══════════
  say('\n[8] No layout regression');
  {
    for (const w of [320, 360, 390, 430]) {
      const { ctx, page } = await newPage({ viewport: { width: w, height: 844 } });
      await page.goto(GAME, { waitUntil: 'domcontentloaded' });
      await wait(400);
      await login(page, 'lay' + w);
      const over = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
      ok('จอ ' + w + ' ไม่ล้นแนวนอน', over <= 0, over);
      await ctx.close();
    }
  }

  say('\n' + '─'.repeat(50));
  say('pageerror: ' + errs.length + (errs.length ? ' → ' + errs.slice(0, 3).join(' | ') : ''));
  ok('ไม่มี pageerror ตลอดทั้งชุด', errs.length === 0);
  say('ผ่าน ' + pass + ' · ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { say('CRASH: ' + e.stack); process.exit(1); });
