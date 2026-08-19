/* ชุดเทสต์ Patch v7.2 — GM ADMINISTRATION
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_gm_admin.js            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'gm_admin_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง · จดทุกคำขอไว้ที่ window.__NET.log */
const STUB = `
  window.__NET = { log: [] };
  window.fetch = function (u, o) {
    window.__NET.log.push({ url: String(u), method: (o && o.method) || 'GET' });
    return Promise.resolve({ ok: true, status: 200,
      text: function () { return Promise.resolve('null'); },
      json: function () { return Promise.resolve(null); } });
  };
  window.EventSource = function (url) {
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
`;

/* payload ของ v5.3 + ฟิลด์ loops ที่ v7.2 เติมเข้ามา */
function live(u, over) {
  return Object.assign({
    u: u, name: 'ฮันเตอร์ ' + u, room: '',
    lv: 7, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 8, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44, loops: 0,
    title: '', frozen: false,
    weak: [{ id: 3, ch: '你', py: 'nǐ', n: 4, seen: 9 }],
    at: Date.now(), dev: 'devX', ver: '5.3'
  }, over || {});
}

async function enterPanel(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(300);
}

/* ยัดแถวสดลง FB_LIVE ตรง ๆ แล้ววาด — เร็วกว่าและนิ่งกว่าการยิงผ่าน SSE ปลอม */
async function seed(page, rows) {
  await page.evaluate(function (rs) {
    FB_LIVE = {};
    rs.forEach(function (r) { FB_LIVE[r.u] = r; });
    FB_MST = 'live';
    fbPaint();
  }, rows);
  await page.waitForTimeout(250);
}

async function fresh(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

/* กด gmConfirm ให้ยืนยัน — โมดัลของ v4.3 ผูก onclick แบบซิงโครนัส สั่งได้ตรง ๆ */
async function confirmOk(page) {
  await page.waitForTimeout(120);
  await page.evaluate(() => { const b = document.getElementById('gmModalOk'); if (b) b.click(); });
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · สูตรและตารางค่าคงที่ (ไม่ต้องเข้าห้องควบคุม) ═══════════════════
  {
    say('\n═══ 1 · THP · แรงค์ Lv 1-99 · เกณฑ์แถบเตือน ═══');
    const { ctx, page, errs } = await fresh(browser);

    eq('มีบันไดแรงค์ 10 ขั้น', await page.evaluate(() => BA_LVRANK.length), 10);
    eq('ขั้นสุดท้ายจบที่เลเวล 99', await page.evaluate(() => BA_LVRANK[BA_LVRANK.length - 1].to), 99);
    eq('ป้ายครบตามสเปก', await page.evaluate(() => BA_LVRANK.map(r => r.label)),
       ['E-RANK','D-RANK','C-RANK','B-RANK','A-RANK','S-RANK','SS-RANK','SSS-RANK','National Level','Shadow Monarch']);
    eq('ขอบเขตขั้นละ 10 เลเวลพอดี', await page.evaluate(() => BA_LVRANK.map(r => r.to)),
       [10,20,30,40,50,60,70,80,90,99]);
    eq('เลเวล 1/10/11/20/21 ตกขั้นถูก',
       await page.evaluate(() => [1,10,11,20,21].map(n => baLvRank(n).key)), ['E','E','D','D','C']);
    eq('เลเวล 41/51/61/71/81/91 ตกขั้นถูก',
       await page.evaluate(() => [41,51,61,71,81,91].map(n => baLvRank(n).key)), ['A','S','SS','SSS','NL','SM']);
    eq('หนีบค่าเพี้ยนให้อยู่ใน 1-99 เสมอ',
       await page.evaluate(() => [0,-5,120,NaN].map(n => baLvRank(n).key)), ['E','E','SM','E']);

    eq('THP = คำ × แม่นยำ × (1 + รอบ/10)', await page.evaluate(() => baThp(100, 80, 0)), 80);
    eq('THP รอบเคลียร์ 5 รอบ = ×1.5', await page.evaluate(() => baThp(100, 80, 5)), 120);
    eq('THP แม่นยำ 0 = 0', await page.evaluate(() => baThp(300, 0, 9)), 0);
    eq('THP คำ 0 = 0', await page.evaluate(() => baThp(0, 100, 9)), 0);
    ok('THP หนีบแม่นยำไม่ให้เกิน 100', await page.evaluate(() => baThp(100, 400, 0)) === 100);
    ok('THP ไม่รับค่าติดลบ', await page.evaluate(() => baThp(-9, -9, -9)) === 0);

    ok('แม่นยำต่ำ + เลเวลสูง + ตอบครบขั้นต่ำ = เข้าข่าย',
       await page.evaluate(() => baSusp({ acc: 30, lv: 40, corr: 30, wrong: 70 })));
    ok('ตอบยังไม่ถึงขั้นต่ำ = ไม่เข้าข่าย (กันบัญชีที่เพิ่งสมัคร)',
       await page.evaluate(() => baSusp({ acc: 0, lv: 40, corr: 0, wrong: 1 })) === false);
    ok('แม่นยำสูง = ไม่เข้าข่าย',
       await page.evaluate(() => baSusp({ acc: 90, lv: 40, corr: 90, wrong: 10 })) === false);
    ok('เลเวลต่ำ = ไม่เข้าข่าย',
       await page.evaluate(() => baSusp({ acc: 10, lv: 5, corr: 10, wrong: 90 })) === false);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 2 · RANKS ของ v4.0 ต้องไม่ถูกแตะ ═══════════════════════════════════
  {
    say('\n═══ 2 · แรงค์เดิมที่ผูกกับการปลดล็อกต้องไม่ขยับ ═══');
    const { ctx, page, errs } = await fresh(browser);
    eq('RANKS ของ v4.0 ยังมี 6 ขั้นเท่าเดิม', await page.evaluate(() => RANKS.length), 6);
    eq('ร้านค้ายังปลดที่ D-RANK', await page.evaluate(() => FEATURE_RANK.shop), 'D');
    eq('Analytics ยังปลดที่ S-RANK', await page.evaluate(() => FEATURE_RANK.analytics), 'S');
    eq('rankOfFloor ยังอิงชั้น ไม่ใช่เลเวล',
       await page.evaluate(() => [1, 6, 11, 16, 19, 20].map(f => rankOfFloor(f).key)),
       ['E','D','C','B','A','S']);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 3 · ตารางสด — คอลัมน์ THP · รอบเคลียร์ · แรงค์ Lv ═══════════════════
  {
    say('\n═══ 3 · ตาราง LIVE MONITOR ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [
      live('a1', { lv: 34, mfloor: 20, floor: 3, loops: 3, words: 100, acc: 80, corr: 80, wrong: 20 }),
      live('a2', { lv: 8,  mfloor: 12, floor: 12, loops: 0, words: 40,  acc: 90, corr: 90, wrong: 10 }),
      live('a3', { lv: 55, mfloor: 15, floor: 15, loops: 0, words: 60,  acc: 20, corr: 20, wrong: 80 })
    ]);

    ok('หัวคอลัมน์ 🏆 THP ถูกเติมให้', await page.evaluate(() => !!document.getElementById('baThpTh')));
    eq('หัวตารางมี 10 คอลัมน์',
       await page.evaluate(() => document.querySelectorAll('#fbLive .fb-tb thead th').length), 10);
    eq('แถวข้อมูลมี 10 ช่อง',
       await page.evaluate(() => document.querySelectorAll('#fbBody tr')[0].cells.length), 10);

    const cells = await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(tr =>
      ({ u: tr.dataset.baUser, td: Array.from(tr.cells).map(c => c.textContent.trim()) })));
    ok('ทุกแถวถูกตีตรารหัสฮันเตอร์', cells.every(c => !!c.u), cells.map(c => c.u));

    const a1 = cells.find(c => c.u === 'a1');
    ok('ชั้นสูงสุดโชว์ "20 / 20 (รอบที่ 3)"', /20\s*\/\s*20\s*\(รอบที่ 3\)/.test(a1.td[3]), a1.td[3]);
    ok('คนที่ยังไม่วนรอบไม่ขึ้นวงเล็บ',
       !/รอบที่/.test(cells.find(c => c.u === 'a2').td[3]), cells.find(c => c.u === 'a2').td[3]);
    ok('ยังคงบรรทัด "ยืนอยู่ชั้น" ของเดิมไว้', /ยืนอยู่ชั้น 3/.test(a1.td[3]), a1.td[3]);

    eq('THP ของ a1 = 100 × 0.80 × 1.3', a1.td[9], '104');
    eq('THP ของ a2 = 40 × 0.90', cells.find(c => c.u === 'a2').td[9], '36');

    const sub1 = await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(tr =>
      ({ u: tr.dataset.baUser, rk: tr.cells[1].querySelector('.gm-sub').textContent.trim() })));
    eq('แรงค์ในตารางสดอ่านจากเลเวล 1-99',
       sub1.sort((x, y) => x.u < y.u ? -1 : 1).map(x => x.u + ':' + x.rk),
       ['a1:B-RANK', 'a2:E-RANK', 'a3:S-RANK']);

    ok('แถบเตือนขึ้นเฉพาะ a3 (แม่นยำ 20% เลเวล 55)',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr.ba-susp'))
         .map(t => t.dataset.baUser).join(',')) === 'a3');
    ok('มีป้ายอธิบายเหตุผลบนแถวที่ถูกเตือน',
       await page.evaluate(() => !!document.querySelector('#fbBody tr.ba-susp .ba-flag')));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 4 · ลูกศร Rank Shift ═══════════════════════════════════════════════
  {
    say('\n═══ 4 · Rank Shift ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [
      live('r1', { mfloor: 5 }), live('r2', { mfloor: 10 }), live('r3', { mfloor: 15 })
    ]);
    const first = await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr'))
      .map(t => t.cells[1].querySelector('.ba-rk').textContent.trim()));
    eq('รอบแรกยังไม่มีอะไรให้เทียบ = ขีดเทาทุกแถว', first, ['-', '-', '-']);
    eq('ทุกแถวได้คลาสกลาง', await page.evaluate(() =>
      document.querySelectorAll('#fbBody tr .ba-rk.ba-rk0').length), 3);

    /* r1 แซงขึ้นบนสุด (ชั้น 5 → 20) · r3 ตกลงมาล่างสุด */
    await page.evaluate(() => { FB_LIVE.r1.mfloor = 20; fbPaint(); });
    await page.waitForTimeout(250);
    const shift = await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(t =>
      ({ u: t.dataset.baUser, txt: t.cells[1].querySelector('.ba-rk').textContent.trim(),
         cls: t.cells[1].querySelector('.ba-rk').className })));
    const r1 = shift.find(x => x.u === 'r1'), r3 = shift.find(x => x.u === 'r3');
    eq('คนที่แซงขึ้น 2 อันดับได้ ▲ +2', r1.txt, '▲ +2');
    ok('ลูกศรขึ้นใช้คลาสสีเขียว', /ba-rku/.test(r1.cls), r1.cls);
    eq('คนที่ตกลง 1 อันดับได้ ▼ -1', r3.txt, '▼ -1');
    ok('ลูกศรลงใช้คลาสสีแดง', /ba-rkd/.test(r3.cls), r3.cls);

    /* วาดซ้ำโดยข้อมูลไม่ขยับ = ลูกศรต้องค้างไว้ ไม่ใช่กลับเป็นขีดทันที */
    await page.evaluate(() => fbPaint());
    await page.waitForTimeout(200);
    eq('วาดซ้ำแล้วลูกศรยังอยู่ (ค้างไว้ให้ครูอ่านทัน)',
       await page.evaluate(() => document.querySelector('#fbBody tr[data-ba-user="r1"] .ba-rk').textContent.trim()),
       '▲ +2');

    /* สลับโหมดเรียง = ล้างลูกศรทิ้ง ไม่งั้นจะยิงลูกศรปลอมให้ทุกคนพร้อมกัน */
    await page.evaluate(() => baSetSort('thp'));
    await page.waitForTimeout(250);
    eq('สลับโหมดเรียงแล้วลูกศรถูกล้างทิ้งทั้งชุด',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr .ba-rk'))
         .map(e => e.textContent.trim())), ['-', '-', '-']);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 5 · ปุ่มเรียงตารางสด ════════════════════════════════════════════════
  {
    say('\n═══ 5 · ปุ่ม Sort ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [
      live('s1', { mfloor: 20, words: 10,  acc: 95, loops: 0 }),   /* THP 10  */
      live('s2', { mfloor: 12, words: 200, acc: 50, loops: 0 }),   /* THP 100 */
      live('s3', { mfloor: 4,  words: 80,  acc: 90, loops: 5 })    /* THP 108 */
    ]);

    eq('มีปุ่มเรียงครบ 4 โหมด',
       await page.evaluate(() => document.querySelectorAll('#baGmTools .ba-sort').length), 4);
    eq('ค่าเริ่มต้นคือลำดับเดิมของ v5.3 (เรียงตามชั้น)',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(t => t.dataset.baUser)),
       ['s1', 's2', 's3']);
    ok('ปุ่มค่าเริ่มต้นถูกไฮไลต์',
       await page.evaluate(() => document.querySelector('#baGmTools .ba-sort[data-ba-sort="live"]').classList.contains('on')));

    await page.evaluate(() => baSetSort('thp'));
    await page.waitForTimeout(250);
    eq('เรียงตาม THP',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(t => t.dataset.baUser)),
       ['s3', 's2', 's1']);
    ok('ปุ่ม THP ถูกไฮไลต์แทน',
       await page.evaluate(() => document.querySelector('#baGmTools .ba-sort[data-ba-sort="thp"]').classList.contains('on')));

    await page.evaluate(() => baSetSort('acc'));
    await page.waitForTimeout(250);
    eq('เรียงตามแม่นยำ %',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(t => t.dataset.baUser)),
       ['s1', 's3', 's2']);

    await page.evaluate(() => baSetSort('words'));
    await page.waitForTimeout(250);
    eq('เรียงตามจำนวนคำ',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(t => t.dataset.baUser)),
       ['s2', 's3', 's1']);

    await page.evaluate(() => baSetSort('ไม่มีโหมดนี้'));
    await page.waitForTimeout(250);
    eq('โหมดที่ไม่มีจริงตกกลับเป็นค่าเริ่มต้น', await page.evaluate(() => BA_SORT), 'live');

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 6 · ลบไอดีถาวร ═════════════════════════════════════════════════════
  {
    say('\n═══ 6 · Data Purge — ปุ่ม 🗑️ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await page.evaluate(() => {
      /* บัญชีของจริงในเครื่อง 2 คน — ผ่าน blankAccount ให้ฟิลด์ครบเหมือนของจริง */
      const s = {};
      ['d1', 'd2'].forEach(function (u, i) {
        const a = blankAccount(u, 'ชื่อ ' + u, '1234', '');
        a.correct = 60; a.wrong = 40; a.level = 5 + i; a.lastActive = Date.now();
        s[u] = a;
      });
      saveStore(s);
      gmRender();
    });
    await page.waitForTimeout(300);
    await seed(page, [live('d1', {}), live('d2', {})]);
    await page.evaluate(() => gmRender());
    await page.waitForTimeout(300);

    eq('เริ่มต้นมี 2 คนในตารางจัดการ',
       await page.evaluate(() => document.querySelectorAll('#gmBody tr').length), 2);
    eq('ยอดสรุปนับ 2 คน',
       await page.evaluate(() => document.getElementById('kpiStudents').textContent), '2');
    eq('ตารางสดมี 2 แถว',
       await page.evaluate(() => document.querySelectorAll('#fbBody tr').length), 2);

    await page.evaluate(() => { window.__NET.log = []; gmDelete('d1'); });
    await confirmOk(page);

    ok('ลบคีย์ออกจากทะเบียนในเครื่องแล้ว',
       await page.evaluate(() => !loadStore().d1));
    ok('ลบออกจากแคชสด FB_LIVE แล้ว',
       await page.evaluate(() => !FB_LIVE.d1));
    ok('ปิดปากไว้กัน v5.7 ปั้นแถวคืน (LR_MUTE)',
       await page.evaluate(() => typeof LR_MUTE.d1 === 'number'));
    eq('แถวหายจากตารางจัดการทันที',
       await page.evaluate(() => Array.from(document.querySelectorAll('#gmBody tr'))
         .map(t => t.dataset.gcUser)), ['d2']);
    eq('แถวหายจาก LIVE MONITOR ทันที',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr'))
         .map(t => t.dataset.baUser)), ['d2']);
    eq('ยอดสรุปหักลบทันที',
       await page.evaluate(() => document.getElementById('kpiStudents').textContent), '1');

    const del = await page.evaluate(() => window.__NET.log.filter(l => l.method === 'DELETE'));
    ok('ยิงคำสั่งลบคีย์บนฐานข้อมูลกลางด้วย', del.length >= 1, del);
    ok('ลบตรงคีย์ของคนนั้นจริง ๆ', del.some(l => /\/students\/d1\.json/.test(l.url)), del.map(d => d.url));

    /* วาดซ้ำหลายรอบต้องไม่ปั้นแถวกลับมา */
    await page.evaluate(() => { fbPaint(); gmRender(); fbPaint(); });
    await page.waitForTimeout(400);
    ok('วาดซ้ำแล้วไม่โผล่กลับมา', await page.evaluate(() => !loadStore().d1 &&
       !document.querySelector('#gmBody tr[data-gc-user="d1"]')));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 7 · Auto Inactive Purge ════════════════════════════════════════════
  {
    say('\n═══ 7 · ล้างไอดีที่เงียบเกินกำหนด ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await page.evaluate(() => {
      const day = 86400000, now = Date.now(), s = {};
      const mk = function (u, ago) {
        const a = blankAccount(u, 'ชื่อ ' + u, '1234', '');
        a.correct = 10; a.wrong = 5; a.lastActive = now - ago;
        s[u] = a;
      };
      mk('fresh1', 60000);         /* เพิ่งเล่นเมื่อ 1 นาทีก่อน */
      mk('old1', day * 3);         /* เงียบ 3 วัน */
      mk('old2', day * 10);        /* เงียบ 10 วัน */
      saveStore(s);
      gmRender();
    });
    await page.waitForTimeout(300);

    ok('มีช่องกรอกจำนวนวัน', await page.evaluate(() => !!document.getElementById('baPgDays')));
    eq('ค่าเริ่มต้นคือ 1 วัน',
       await page.evaluate(() => document.getElementById('baPgDays').value), '1');
    ok('มีปุ่มล้าง', await page.evaluate(() => !!document.getElementById('baPgBtn')));

    eq('รายชื่อที่เข้าข่ายเมื่อกำหนด 1 วัน',
       await page.evaluate(() => baIdleList(Date.now() - 86400000)), ['old1', 'old2']);
    eq('กำหนด 5 วัน เหลือคนเดียว',
       await page.evaluate(() => baIdleList(Date.now() - 5 * 86400000)), ['old2']);
    eq('กำหนด 30 วัน ไม่เหลือใคร',
       await page.evaluate(() => baIdleList(Date.now() - 30 * 86400000)), []);

    await page.evaluate(() => { window.__NET.log = []; document.getElementById('baPgBtn').click(); });
    await confirmOk(page);

    eq('ล้างแล้วเหลือเฉพาะคนที่ยังเล่นอยู่',
       await page.evaluate(() => Object.keys(loadStore()).sort()), ['fresh1']);
    eq('ตารางจัดการเหลือแถวเดียว',
       await page.evaluate(() => document.querySelectorAll('#gmBody tr').length), 1);
    eq('ยอดสรุปเหลือ 1 คน',
       await page.evaluate(() => document.getElementById('kpiStudents').textContent), '1');
    const del = await page.evaluate(() => window.__NET.log.filter(l => l.method === 'DELETE').map(l => l.url));
    ok('ยิงลบทั้งสองคนบนฐานข้อมูลกลาง',
       del.some(u => /old1\.json/.test(u)) && del.some(u => /old2\.json/.test(u)), del);
    ok('ไม่ไปแตะคนที่ยังเล่นอยู่', !del.some(u => /fresh1/.test(u)), del);

    /* บัญชีที่กำลังเล่นบนเครื่องนี้ต้องไม่ถูกกวาดไปด้วย */
    await page.evaluate(() => {
      const s = loadStore();
      const a = blankAccount('meNow', 'ครู', '1234', '');
      a.lastActive = Date.now() - 86400000 * 99;
      s.meNow = a; saveStore(s);
      CURRENT_USER = 'meNow';
    });
    eq('บัญชีที่กำลังเล่นอยู่ไม่เข้าข่ายเด็ดขาด',
       await page.evaluate(() => baIdleList(Date.now()).indexOf('meNow')), -1);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 8 · เคารพกลุ่มห้องเรียนที่ครูกรองอยู่ ═══════════════════════════════
  {
    say('\n═══ 8 · ขอบเขตกลุ่มห้องเรียน ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await page.evaluate(() => {
      const day = 86400000, now = Date.now(), s = {};
      const mk = function (u, room) {
        const a = blankAccount(u, 'ชื่อ ' + u, '1234', room);
        a.lastActive = now - day * 9;
        s[u] = a;
      };
      mk('m4a', 'ม.4/1'); mk('m4b', 'ม.4/1'); mk('m5a', 'ม.5/1');
      saveStore(s); gmRender();
    });
    await page.waitForTimeout(250);
    eq('ไม่กรองกลุ่ม = เข้าข่ายทั้งหมด',
       await page.evaluate(() => baIdleList(Date.now() - 86400000).sort()), ['m4a', 'm4b', 'm5a']);
    await page.evaluate(() => { GC_ROOM = 'ม.4/1'; });
    eq('กรองกลุ่มอยู่ = เข้าข่ายเฉพาะในกลุ่ม',
       await page.evaluate(() => baIdleList(Date.now() - 86400000).sort()), ['m4a', 'm4b']);
    await page.evaluate(() => { GC_ROOM = ''; });
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 9 · ต้องไม่ทำของชั้นล่างพัง ════════════════════════════════════════
  {
    say('\n═══ 9 · ความเข้ากันได้กับ v5.3 / v5.5 / v5.7 ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [
      live('c1', { mfloor: 17, acc: 88, exp: 90, mexp: 100, gold: 4321, words: 12, loops: 2 }),
      live('c2', { mfloor: 9 })
    ]);

    /* xpDomRows ของ v5.5 อ่าน td ตามตำแหน่ง — td[8] ต้องยังเป็น "อัปเดตเมื่อ" */
    const dom = await page.evaluate(() => xpDomRows());
    eq('xpDomRows ยังอ่านครบ 2 แถว', dom.length, 2);
    const c1 = dom.find(r => r.u === 'c1');
    eq('อ่านเลเวลถูก (ลูกศรไม่ไปกวน td[1])', c1.lv, 7);
    eq('อ่านชั้นสูงสุดถูก (วงเล็บรอบไม่ไปกวน td[3])', c1.mfloor, 17);
    eq('อ่านแม่นยำถูก', c1.acc, 88);
    eq('อ่านทองถูก', c1.gold, 4321);
    eq('อ่านจำนวนคำถูก', c1.words, 12);
    ok('อ่านคำที่ผิดซ้ำจาก td[7] ได้เหมือนเดิม', /你/.test(c1.xpWeak), c1.xpWeak);
    ok('td[8] ยังเป็นเวลาอัปเดต ไม่ใช่ THP', /ที่แล้ว|—/.test(c1.xpAt), c1.xpAt);

    /* v5.7 ต้องปั้นแถวสดลงทะเบียนได้เหมือนเดิม และพารอบเคลียร์ไปด้วย */
    await page.evaluate(() => { LR_SIG = ''; lrHydrate(true); });
    await page.waitForTimeout(200);
    ok('v5.7 ยังปั้นแถวสดลงทะเบียนได้', await page.evaluate(() => !!loadStore().c1));
    eq('พารอบเคลียร์หอคอยไปลงทะเบียนด้วย',
       await page.evaluate(() => loadStore().c1.towerClears), 2);

    /* fbPayload ต้องแนบ loops ขึ้นไปกับสัญญาณ */
    const pl = await page.evaluate(() => {
      const a = blankAccount('px', 'px', '1234', '');
      a.towerClears = 4;
      return fbPayload('px', a);
    });
    eq('fbPayload แนบ loops ขึ้นคลาวด์', pl.loops, 4);
    ok('ฟิลด์เดิมของ v5.3 ยังครบ',
       ['u','name','room','lv','exp','mexp','floor','mfloor','rank','gold','corr','wrong','acc','words','at']
         .every(k => k in pl), Object.keys(pl));
    ok('ยังไม่มีรหัสผ่านตัวจริงขึ้นคลาวด์', !('pw' in pl), Object.keys(pl));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 10 · หน้าจอเล่นต้องไม่ขยับ ═════════════════════════════════════════
  {
    say('\n═══ 10 · เลย์เอาต์ฝั่งนักเรียน ═══');
    for (const w of [320, 360, 390, 430]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 844 } });
      await ctx.addInitScript(STUB);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String((e && e.message) || e)));
      await page.route('**fonts.googleapis.com**', r => r.abort());
      await page.goto(FILE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(120);
      await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        switchTab('register');
        document.getElementById('reg-id').value = 'lay' + Date.now().toString(36);
        document.getElementById('reg-pw').value = '1234';
        document.getElementById('reg-pw2').value = '1234';
        handleSubmit();
      });
      await page.waitForTimeout(900);
      /* เลือกการ์ดของ v4.7 ให้จบก่อน แล้วบังคับคำให้คงที่ก่อนวัดความสูง */
      await page.evaluate(() => {
        const c = document.querySelector('#cdDraft.active .cd-card');
        if (c) c.click();
      });
      await page.waitForTimeout(800);
      /* บังคับคำและตัวเลือกให้คงที่แบบเดียวกับ verify_arena.js เป๊ะ
         **ห้ามเรียก renderMonster()** ข้อความใน #gFeedback ที่ค้างจากจังหวะเลือกการ์ด
         จะดันการ์ดสูงขึ้นราว 44px แล้วตัวเลขจะไม่ตรงกับตัววัดหลัก */
      await page.evaluate(() => {
        const m = G.currentMonster;
        m.word = '北京语言大学';
        m.pinyin = 'Běijīng Yǔyán Dàxué';
        m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
        m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
        document.getElementById('gWord').textContent = m.word;
        document.getElementById('gPinyin').textContent = m.pinyin;
        document.getElementById('gFeedback').textContent = '';
        renderChoices();
      });
      await page.waitForTimeout(250);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await page.waitForTimeout(150);
      const h = await page.evaluate(() => {
        const q = document.querySelector('.ac-battle');
        return q ? Math.round(q.getBoundingClientRect().height * 10) / 10 : -1;
      });
      const want = w <= 320 ? 354.8 : 340.8;
      ok('จอ ' + w + ' — การ์ดโจทย์ยังสูง ' + want + 'px', Math.abs(h - want) < 0.6, h);
      ok('จอ ' + w + ' — ไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('จอ ' + w + ' — ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  // ═══ 11 · ทางเข้าสาธารณะสำหรับชุดเทสต์ ══════════════════════════════════
  {
    say('\n═══ 11 · baBattleAudit().gmAdmin ═══');
    const { ctx, page, errs } = await fresh(browser);
    const a = await page.evaluate(() => baBattleAudit().gmAdmin);
    eq('รายงานเลขรุ่น', a.ver, '7.2');
    eq('รายงานโหมดเรียงเริ่มต้น', a.sort, 'live');
    eq('รายงานโหมดที่มีทั้งหมด', a.sorts, ['live', 'thp', 'acc', 'words']);
    eq('รายงานเพดานเลเวล', a.rank.max, 99);
    eq('รายงานจำนวนขั้นแรงค์', a.rank.tiers, 10);
    eq('รายงานเกณฑ์แถบเตือน', [a.susp.acc, a.susp.lv, a.susp.min], [50, 20, 20]);
    eq('รายงานค่าเริ่มต้นของช่องจำนวนวัน', a.days, 1);
    ok('ก้อนอื่นของ baBattleAudit ยังอยู่ครบ',
       await page.evaluate(() => {
         const o = baBattleAudit();
         return !!(o.curse && o.combo && o.parry && o.hiTier && o.telegraph && o.debuff && o.resil && o.shadow);
       }));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  say('\n══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
