/* ชุดเทสต์ Micro-Patch — FORCE NUCLEAR RESET & DEEP FIELD PURGE ENGINE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_nuclear_reset.js

   สามต้นเหตุที่ชุดนี้เฝ้าไว้ (ถ้าใครถอดออกทีหลัง เคสพวกนี้คือตัวเดียวที่จับได้)
     1. Merge Leak    — baMasterState ต้องถูก "แทนที่ทั้งก้อน" ไม่ใช่ merge ทับ
     2. Cloud Partial — ต้องเป็น PUT ทั้งกิ่ง (ไม่ใช่ PATCH) และ pwh ต้องไม่หาย
     3. Heartbeat Race— สัญญาณที่มาระหว่าง GM Write-Lock 20 วิ ต้องถูกปฏิเสธ
   บวกข้อ 4 ที่ทำให้การรีเซ็ต "ติดถาวร" จริง — resetSignal สั่งเครื่องนักเรียนล้างตัวเอง */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'nuclear_reset_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* คลาวด์ปลอมที่ "จำแถวไว้จริง" — เคสสำคัญที่สุดของชุดนี้คือ *อะไรถูกเขียนขึ้นไปบ้าง*
   จึงต้องเสิร์ฟ GET คีย์ย่อยได้ด้วย (v5.8 อ่าน /pwh · แพตช์นี้อ่าน /resetSignal) */
const STUB = `
  window.__RT = { rows: {}, log: [], fail: 0 };
  window.EventSource = function (url) {
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
  window.fetch = function (u, o) {
    const url = String(u), m = (o && o.method) || 'GET';
    window.__RT.log.push({ url: url, method: m, body: (o && o.body) || '' });
    const rep = function (t) {
      return Promise.resolve({ ok: true, status: 200,
        text: function () { return Promise.resolve(t); },
        json: function () { return Promise.resolve(JSON.parse(t)); } });
    };
    if (window.__RT.fail) return Promise.reject(new Error('simulated network down'));
    const mm = /\\/students\\/([^/?.]+)(?:\\/([^/?.]+))?\\.json/.exec(url);
    if (!mm) return rep('null');
    const key = decodeURIComponent(mm[1]), sub = mm[2] ? decodeURIComponent(mm[2]) : '';
    if (m === 'PUT')   { window.__RT.rows[key] = JSON.parse(o.body); return rep(o.body); }
    if (m === 'PATCH') { window.__RT.rows[key] = Object.assign(window.__RT.rows[key] || {}, JSON.parse(o.body)); return rep(o.body); }
    if (m === 'DELETE'){ delete window.__RT.rows[key]; return rep('null'); }
    const row = window.__RT.rows[key] || null;
    if (!row) return rep('null');
    return rep(JSON.stringify(sub ? (row[sub] === undefined ? null : row[sub]) : row));
  };
`;

async function fresh(browser, vw, vh) {
  const ctx = await browser.newContext({ viewport: { width: vw || 1200, height: vh || 950 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

/* ผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง (ห้ามเรียก enterGate ตรง ๆ) */
async function passGate(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
}

async function enterPanel(page) {
  await passGate(page);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(400);
}

/* บัญชี "เล่นมาเยอะแล้ว" พร้อมก้อนคำผิด/สถิติสะสม/ฟิลด์แถวสดของ v5.7 ครบทุกช่อง */
async function seed(page) {
  await page.evaluate(() => {
    const a = blankAccount('nut', 'ณัฐ ใจกล้า', '1234', 'ม.4/2');
    a.level = 30; a.exp = 250; a.gold = 5400; a.totalGoldEarned = 9000;
    a.floor = 15; a.maxFloor = 18; a.floorProgress = 2;
    a.bossClears = 4; a.towerClears = 3;
    a.correct = 300; a.wrong = 40; a.best = 22; a.streak = 5;
    a.wordStats = { 1: { seen: 5, wrong: 3 }, 2: { seen: 9, wrong: 4 }, 3: { seen: 2, wrong: 2 } };
    a.items = { potion: 3 }; a.createdAt = 111222333;
    a.gcLog = [{ t: 1, i: '🎁', m: 'เดิม' }];
    a.sessions = [{ s: 1, e: 2 }]; a.loginCount = 9; a.lastLogin = 55; a.playMs = 4321;
    a.trFloors = { '7': { n: 4, ok: 3, ids: [1] } };
    a.lrWords = 44; a.lrMaxHp = 190; a.lrAt = Date.now(); a.lrMirror = true;
    const s = loadStore(); s.nut = a; saveStore(s);
    FB_LIVE = { nut: { u: 'nut', name: 'ณัฐ ใจกล้า', room: 'ม.4/2', lv: 30, exp: 250, mexp: 900,
                       hp: 100, mhp: 400, mp: 60, gold: 5400, floor: 15, mfloor: 18, loops: 3,
                       corr: 300, wrong: 40, acc: 88, words: 44, best: 22,
                       weak: [{ id: 1, ch: '你', py: 'nǐ', n: 3, seen: 5 }],
                       at: Date.now(), ver: '5.3' } };
    FB_MST = 'live';
    gmRender();
  });
  await page.waitForTimeout(300);
}

const A = (page, u) => page.evaluate(function (k) {
  const a = loadStore()[k];
  if (!a) return null;
  return { user: a.user, name: a.name, pw: a.pw, classroom: a.classroom, createdAt: a.createdAt,
           frozen: !!a.frozen, level: a.level, exp: a.exp, gold: a.gold,
           floor: a.floor, maxFloor: a.maxFloor, loops: a.towerClears,
           correct: a.correct, wrong: a.wrong, best: a.best, streak: a.streak,
           words: Object.keys(a.wordStats || {}).length,
           items: Object.keys(a.items || {}).reduce(function (n, k) { return n + (a.items[k] || 0); }, 0),
           gcFirst: !!((a.gcLog || [])[0] && (a.gcLog || [])[0].m === 'เดิม'),
           tr: Object.keys(a.trFloors || {}).length,
           gcLog: (a.gcLog || []).length, loginCount: a.loginCount,
           lr: ['lrWords', 'lrMaxHp', 'lrAt', 'lrMirror'].filter(function (x) { return a[x] !== undefined; }) };
}, u);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · ค่าคงที่ + ทางเข้าชุดเทสต์ ═════════════════════════════════════════
  {
    say('\n═══ 1 · ค่าคงที่ · ทางเข้า audit ═══');
    const { ctx, page, errs } = await fresh(browser);
    const n = await page.evaluate(() => baBattleAudit().nuke);
    ok('มีก้อน nuke ใน baBattleAudit', !!n, n);
    eq('GM Write-Lock 20 วินาทีตามสเปก', n.lockMs, 20000);
    eq('ยังไม่มีใครถูกล็อกตอนเปิดหน้า', n.locked, []);
    eq('ยังไม่ halt', n.halt, false);
    eq('สารบัญฟิลด์ที่ต้องกวาดทิ้งครบ', n.strip,
       ['lrMirror', 'lrAt', 'lrMaxHp', 'lrWords', 'resetSignal']);
    eq('ตัวนับเริ่มจากศูนย์', n.n, { purge: 0, cloud: 0, block: 0, wipe: 0 });
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 2 · Deep Field Purge — ทะเบียนในเครื่อง ═══════════════════════════════
  {
    say('\n═══ 2 · ล้างลึก · Auth Safe 100% ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page);
    const b4 = await A(page, 'nut');
    eq('ก่อนล้าง: ฟิลด์แถวสดของ v5.7 ฝังอยู่ครบ 4 ตัว', b4.lr.length, 4);

    await page.evaluate(() => baMrApply('nut', 'full'));
    await page.waitForTimeout(500);
    const a = await A(page, 'nut');

    eq('รหัสฮันเตอร์คงเดิม', a.user, 'nut');
    eq('ชื่อคงเดิม', a.name, 'ณัฐ ใจกล้า');
    eq('รหัสผ่านคงเดิม', a.pw, '1234');
    eq('ห้องเรียนคงเดิม', a.classroom, 'ม.4/2');
    eq('วันที่สมัครคงเดิม', a.createdAt, 111222333);
    /* v7.4 จดบรรทัด "GM รีเซ็ต — …" ต่อท้ายให้เองอีกหนึ่ง ของเดิมจึงต้องยังอยู่ครบ ไม่ใช่เท่าเดิม */
    ok('ประวัติฝั่งครูไม่หาย', a.gcFirst && a.gcLog >= 2 && a.loginCount === 9, [a.gcLog, a.gcFirst, a.loginCount]);

    eq('เลเวลกลับเป็น 1', a.level, 1);
    eq('EXP เป็น 0', a.exp, 0);
    eq('ทองเป็น 0', a.gold, 0);
    eq('ชั้น/ชั้นสูงสุดกลับต้นหอคอย', [a.floor, a.maxFloor], [1, 1]);
    eq('รอบเคลียร์เป็น 0', a.loops, 0);
    eq('สถิติถูก/ผิดเป็น 0', [a.correct, a.wrong], [0, 0]);
    eq('สตรีคดีสุด/สตรีคปัจจุบันเป็น 0', [a.best, a.streak], [0, 0]);
    eq('ก้อนคำผิดถูกกวาดทิ้ง', a.words, 0);
    eq('กระเป๋าว่าง (นับจำนวนชิ้น ไม่ใช่จำนวนคีย์ — migrateAccount เติมคีย์ครบ 7 ตัวให้เสมอ)', a.items, 0);
    eq('บันทึกรายชั้นของเรดาร์ถูกล้าง', a.tr, 0);
    eq('ฟิลด์แถวสดของ v5.7 ถูกกวาดทิ้งครบ', a.lr, []);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 3 · Merge Leak — สถานะกลางต้องถูกแทนที่ทั้งก้อน ═══════════════════════
  {
    say('\n═══ 3 · baMasterState แทนที่ทั้งก้อน ไม่ merge ทับ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page);
    /* ปลอมฟิลด์แปลกปลอมที่ "ไม่ได้ถูกส่งไปล้าง" — merge ทับจะเหลือค้าง แทนที่ทั้งก้อนจะหาย */
    await page.evaluate(() => { baMsSync(); baMasterState.nut.__leak = 'stale'; });
    await page.evaluate(() => baMrApply('nut', 'full'));
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => baMasterState.nut);
    ok('ฟิลด์แปลกปลอมไม่เหลือค้าง', r.__leak === undefined, r.__leak);
    eq('เลเวล/ทอง/ชั้น/รอบ ในสถานะกลางเป็นศูนย์หมด',
       [r.lv, r.gold, r.mfloor, r.loops, r.corr, r.wrong, r.words], [1, 0, 1, 0, 0, 0, 0]);
    eq('ตัวนับการล้างลึกเดินไป 1 ครั้ง', await page.evaluate(() => baBattleAudit().nuke.n.purge), 1);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 4 · Cloud Overwrite — PUT ทั้งกิ่ง ไม่ใช่ PATCH ═══════════════════════
  {
    say('\n═══ 4 · เขียนทับทั้งกิ่งบนคลาวด์ + resetSignal + pwh ไม่หาย ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    /* แถวเก่าบนคลาวด์ที่มีทั้งก้อนคำผิดและแฮชรหัสผ่านค้างอยู่ */
    await page.evaluate(() => {
      window.__RT.rows.nut = { u: 'nut', name: 'ณัฐ ใจกล้า', lv: 30, gold: 5400,
                               corr: 300, wrong: 40, words: 44, best: 22, loops: 3,
                               weak: [{ id: 1, ch: '你', py: 'nǐ', n: 3, seen: 5 }],
                               mistakes: { 1: 3 }, history: [1, 2, 3],
                               pwh: 'HASH-OLD', at: Date.now() };
      window.__RT.log.length = 0;
    });
    await seed(page);
    await page.evaluate(() => baMrApply('nut', 'full'));
    await page.waitForTimeout(900);

    const puts = await page.evaluate(() => window.__RT.log.filter(
      l => l.method === 'PUT' && /\/students\/nut\.json/.test(l.url)));
    ok('มีคำสั่งเขียนทับแถวนักเรียน', puts.length >= 1, puts.length);
    eq('ไม่ได้ใช้ PATCH กับแถวนักเรียนเลย',
       await page.evaluate(() => window.__RT.log.filter(
         l => l.method === 'PATCH' && /\/students\/nut\.json/.test(l.url)).length), 0);

    const row = await page.evaluate(() => window.__RT.rows.nut);
    eq('เลเวล/ทอง/สถิติบนคลาวด์เป็นศูนย์', [row.lv, row.gold, row.corr, row.wrong], [1, 0, 0, 0]);
    eq('ชั้น/รอบบนคลาวด์กลับต้นหอคอย', [row.mfloor, row.loops || 0], [1, 0]);
    eq('ก้อนคำผิดบนคลาวด์ว่าง', (row.weak || []).length, 0);
    ok('คีย์เก่าที่ payload ใหม่ไม่มีถูกกวาดทิ้งหมด',
       row.mistakes === undefined && row.history === undefined, [row.mistakes, row.history]);
    ok('มี resetSignal ติดไปด้วย', typeof row.resetSignal === 'number' && row.resetSignal > 0, row.resetSignal);
    eq('แฮชรหัสผ่านไม่หาย (v5.8 ผนึกคืนให้)', row.pwh, 'HASH-OLD');
    eq('ตัวนับเขียนคลาวด์เดินไป 1 ครั้ง', await page.evaluate(() => baBattleAudit().nuke.n.cloud), 1);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 5 · GM Write-Lock 20 วินาที ═══════════════════════════════════════════
  {
    say('\n═══ 5 · Write-Lock ปฏิเสธ heartbeat เก่า แต่แถวต้องไม่หาย ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page);
    await page.evaluate(() => baMrApply('nut', 'full'));
    await page.waitForTimeout(500);

    const n1 = await page.evaluate(() => baBattleAudit().nuke);
    eq('ฮันเตอร์คนนั้นถูกล็อกอยู่', n1.locked, ['nut']);
    eq('มีหมุดก้อนสะอาดปักไว้', n1.pinned, ['nut']);

    /* heartbeat ก้อนเก่าจากเครื่องนักเรียนที่ยังเปิดค้าง — ประทับเวลาใหม่กว่าเสมอ */
    await page.evaluate(() => fbApply('put', JSON.stringify({
      path: '/nut', data: { u: 'nut', name: 'ณัฐ ใจกล้า', lv: 30, gold: 5400,
                            corr: 300, wrong: 40, mfloor: 18, loops: 3, at: Date.now() + 60000 }
    })));
    await page.waitForTimeout(300);
    eq('สัญญาณเก่าไม่ทะลุเข้าสถานะกลาง',
       await page.evaluate(() => [baMasterState.nut.lv, baMasterState.nut.gold]), [1, 0]);
    eq('สัญญาณเก่าไม่ทะลุเข้าทะเบียน',
       await page.evaluate(() => { const a = loadStore().nut; return [a.level, a.gold]; }), [1, 0]);
    ok('ตัวนับการปฏิเสธเดินขึ้น', await page.evaluate(() => baBattleAudit().nuke.n.block) > 0);

    /* ต้อง "ปฏิเสธค่า" ไม่ใช่ "ลบแถว" — ลบแล้วครูจะอ่านว่าเด็กหลุดจากห้อง */
    const rows = await page.evaluate(() => ({
      live: [].filter.call(document.querySelectorAll('#fbBody tr'), x => /@?nut/.test(x.textContent)).length,
      uni:  [].filter.call(document.querySelectorAll('#baUni tbody tr'), x => /nut/.test(x.textContent)).length
    }));
    ok('แถวยังอยู่ในตาราง LIVE', rows.live >= 1, rows);
    ok('แถวยังอยู่ในตารางรวมของ v7.8', rows.uni >= 1, rows);

    /* พ้นล็อกแล้วสัญญาณต้องกลับมาชนะตามกติกาเดิมของ v7.7 */
    await page.evaluate(() => { BA_FN_LOCK = {}; BA_FN_CLEAN = {}; BA_MS_EDIT = {}; });
    await page.evaluate(() => fbApply('put', JSON.stringify({
      path: '/nut', data: { u: 'nut', name: 'ณัฐ ใจกล้า', lv: 9, gold: 777, at: Date.now() + 90000 }
    })));
    await page.waitForTimeout(300);
    eq('พ้นล็อกแล้วสัญญาณชนะตามเดิม',
       await page.evaluate(() => [baMasterState.nut.lv, baMasterState.nut.gold]), [9, 777]);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 6 · resetSignal — เครื่องนักเรียนล้างตัวเองทันที ══════════════════════
  {
    say('\n═══ 6 · resetSignal สั่งเครื่องนักเรียนล้างตัวเอง ═══');
    const { ctx, page, errs } = await fresh(browser);
    await passGate(page);
    await page.evaluate(() => {
      switchTab('register');
      document.getElementById('reg-id').value = 'stu9';
      document.getElementById('reg-pw').value = '1111';
      document.getElementById('reg-pw2').value = '1111';
      handleSubmit();
    });
    await page.waitForTimeout(900);
    eq('เข้าเกมด้วยบัญชีนักเรียนแล้ว', await page.evaluate(() => CURRENT_USER), 'stu9');

    await page.evaluate(() => {
      const s = loadStore(); const a = s.stu9;
      a.level = 12; a.gold = 3300; a.correct = 120; a.wrong = 20;
      a.wordStats = { 5: { seen: 4, wrong: 2 } }; a.maxFloor = 9; a.towerClears = 2;
      s.stu9 = a; saveStore(s);
      /* ครูเพิ่งกดรีเซ็ตจากอีกเครื่อง — บนคลาวด์จึงมี resetSignal ก้อนใหม่รออยู่ */
      window.__RT.rows.stu9 = { u: 'stu9', lv: 1, gold: 0, resetSignal: Date.now(), at: Date.now() };
      window.__RT.log.length = 0;
    });
    eq('ยังไม่เคยรับทราบสัญญาณไหน',
       await page.evaluate(() => Object.keys(baBattleAudit().nuke.ack).length), 0);

    await page.evaluate(() => fbPush('stu9'));
    await page.waitForTimeout(350);
    const n = await page.evaluate(() => baBattleAudit().nuke);
    eq('เครื่องนักเรียนล้างตัวเองไป 1 ครั้ง', n.n.wipe, 1);
    eq('ปิดประตูเขียนทะเบียนแล้ว (รอรีโหลด)', n.halt, true);
    ok('จดสัญญาณที่รับทราบไว้แล้ว', !!n.ack.stu9, n.ack);
    eq('ความคืบหน้าในเครื่องถูกล้างจริง',
       await page.evaluate(() => { const a = loadStore().stu9;
         return [a.level, a.gold, a.correct, a.maxFloor, Object.keys(a.wordStats || {}).length]; }),
       [1, 0, 0, 1, 0]);
    eq('รหัสผ่านยังเป็นของเดิม — ล็อกอินซ้ำได้ทันที',
       await page.evaluate(() => loadStore().stu9.pw), '1111');
    eq('บัญชีคนอื่นบนเครื่องเดียวกันต้องไม่ถูกกวาดไปด้วย',
       await page.evaluate(() => { const s = loadStore(); s.other = blankAccount('other', 'อื่น', '9', 'x');
         return Object.keys(s).indexOf('stu9') >= 0; }), true);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 7 · ปั๊มสัญญาณเดิมซ้ำต้องไม่ล้างซ้ำ (กันวนไม่รู้จบ) ═══════════════════
  {
    say('\n═══ 7 · สัญญาณเดิมซ้ำ = ไม่ล้างซ้ำ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await passGate(page);
    await page.evaluate(() => {
      switchTab('register');
      document.getElementById('reg-id').value = 'stu8';
      document.getElementById('reg-pw').value = '2222';
      document.getElementById('reg-pw2').value = '2222';
      handleSubmit();
    });
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const sig = 1700000000000;
      window.__RT.rows.stu8 = { u: 'stu8', resetSignal: sig, at: Date.now() };
      localStorage.setItem('yao_reset_ack', JSON.stringify({ stu8: sig }));
    });
    await page.evaluate(() => fbPush('stu8'));
    await page.waitForTimeout(350);
    const n = await page.evaluate(() => baBattleAudit().nuke);
    eq('ไม่ล้างซ้ำเพราะรับทราบไปแล้ว', n.n.wipe, 0);
    eq('ไม่ halt', n.halt, false);
    ok('resetSignal ยังอยู่บนคลาวด์ ไม่ถูก PUT ของ heartbeat ลบทิ้ง',
       await page.evaluate(() => window.__RT.rows.stu8.resetSignal) === 1700000000000,
       await page.evaluate(() => window.__RT.rows.stu8));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 8 · เน็ตหลุด/ยังไม่ตั้งคลาวด์ ต้องไม่ลามไปทำเกมพัง ═════════════════════
  {
    say('\n═══ 8 · เน็ตหลุด · คลาวด์ปิด ต้องยังรีเซ็ตในเครื่องได้ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page);
    await page.evaluate(() => { window.__RT.fail = 1; });
    await page.evaluate(() => baMrApply('nut', 'full'));
    await page.waitForTimeout(600);
    eq('ทะเบียนยังถูกล้างครบ',
       await page.evaluate(() => { const a = loadStore().nut; return [a.level, a.gold, a.maxFloor]; }),
       [1, 0, 1]);
    ok('ล็อกยังถูกตั้ง', await page.evaluate(() => baBattleAudit().nuke.locked).then(l => l.indexOf('nut') >= 0));
    ok('ไม่มี pageerror', errs.length === 0, errs);

    await page.evaluate(() => { window.__RT.fail = 0; FB_CFG.on = false; BA_FN_LOCK = {}; });
    await page.evaluate(() => baMrApply('nut', 'gold'));
    await page.waitForTimeout(400);
    eq('คลาวด์ปิดอยู่ก็ยังล้างในเครื่องได้', await page.evaluate(() => loadStore().nut.gold), 0);
    ok('ไม่มี pageerror หลังปิดคลาวด์', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 9 · เลย์เอาต์หน้าเล่นห้ามขยับ ═════════════════════════════════════════
  {
    say('\n═══ 9 · การ์ดโจทย์คงที่ 340.8 / 354.8px ═══');
    for (const w of [320, 390]) {
      const { ctx, page, errs } = await fresh(browser, w, 844);
      await passGate(page);
      await page.evaluate(() => {
        switchTab('register');
        document.getElementById('reg-id').value = 'ly' + Math.floor(Math.random() * 1e6);
        document.getElementById('reg-pw').value = '1234';
        document.getElementById('reg-pw2').value = '1234';
        handleSubmit();
      });
      await page.waitForTimeout(1000);
      /* ปิดหน้าต่างจั่วการ์ดของ v4.7 ให้จบก่อน แล้วบังคับคำ/ตัวเลือกให้คงที่
         + ล้าง #gFeedback (ข้อความค้างจะดันการ์ดสูงขึ้น — บทเรียนของชุด v7.2/v7.4) */
      await page.evaluate(() => {
        const c = document.querySelector('#cdDraft.active .cd-card'); if (c) c.click();
      });
      await page.waitForTimeout(800);
      const h = await page.evaluate(() => {
        const st = document.createElement('style');
        st.textContent = '*{animation:none!important;transition:none!important}';
        document.head.appendChild(st);
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        document.getElementById('gFeedback').innerHTML = '';
        const m = G.currentMonster;
        if (m) { m.choices = ['หนึ่ง', 'สอง', 'สาม', 'สี่']; m.answer = 'หนึ่ง'; renderChoices(m); }
        const el = document.querySelector('.g-card.ac-battle') || document.querySelector('.ac-battle');
        return el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : -1;
      });
      eq('จอ ' + w + ': ความสูงการ์ดโจทย์', h, w <= 359 ? 354.8 : 340.8);
      ok('จอ ' + w + ': ไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('จอ ' + w + ': ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  await browser.close();
  say('\n══════════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
