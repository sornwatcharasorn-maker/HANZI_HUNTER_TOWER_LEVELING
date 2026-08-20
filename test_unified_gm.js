/* ชุดเทสต์ Patch v7.8 — ZERO-SCROLL UNIFIED SINGLE-TABLE GM DASHBOARD
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_unified_gm.js            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'unified_gm_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง */
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

function live(u, over) {
  return Object.assign({
    u: u, name: 'ฮันเตอร์ ' + u, room: '',
    lv: 7, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 8, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44, loops: 2,
    title: '', frozen: false,
    weak: [{ id: 3, ch: '你', py: 'nǐ', n: 4, seen: 9 },
           { id: 5, ch: '好', py: 'hǎo', n: 2, seen: 8 }],
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

async function seed(page, rows) {
  await page.evaluate(function (rs) {
    FB_LIVE = {};
    rs.forEach(function (r) { FB_LIVE[r.u] = r; });
    FB_MST = 'live';
    fbPaint();
  }, rows);
  await page.waitForTimeout(300);
}

async function fresh(browser, vw) {
  const ctx = await browser.newContext({ viewport: { width: vw || 1200, height: 950 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

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

  // ═══ 1 · ติดตั้ง · โครงตาราง 8 คอลัมน์ · ตารางเดิมถูกซ่อนแต่ยังอยู่ ═══════
  {
    say('\n═══ 1 · โครงตารางเดี่ยว 8 คอลัมน์ ═══');
    const { ctx, page, errs } = await fresh(browser);

    ok('เครื่องนักเรียนยังไม่มีตารางรวม (ห้องควบคุมยังไม่กาง)',
       await page.evaluate(() => !document.getElementById('baUni')));
    ok('สไตล์ถูกติดตั้งตั้งแต่โหลดหน้า',
       await page.evaluate(() => !!document.getElementById('baUniStyle')));

    await enterPanel(page);
    await seed(page, [live('a1'), live('b2', { lv: 45, mfloor: 14, acc: 92, words: 120 })]);

    const a = await page.evaluate(() => baBattleAudit().unified);
    eq('เลขรุ่นถูกต้อง', a.ver, '7.8');
    eq('มี 8 คอลัมน์พอดี', a.cols, 8);
    ok('ตารางถูกแทรกแล้ว', a.mounted, a);
    eq('วาดครบ 2 แถว', a.rows, 2);
    ok('ตารางสดเดิมถูกซ่อน', a.hidden.live, a.hidden);
    ok('ตารางจัดการเดิมถูกซ่อน', a.hidden.gm, a.hidden);
    ok('แต่แถวของตารางเดิม "ยังอยู่ครบ" ทั้งสองใบ (xpDomRows ของ v5.5 ยังอ่านได้)',
       a.kept.live === 2 && a.kept.gm === 2, a.kept);

    const heads = await page.evaluate(() =>
      Array.prototype.map.call(document.querySelectorAll('#baUni thead th'), th => th.textContent.trim()));
    ok('หัวคอลัมน์ครบตามสเปก',
       /ฮันเตอร์/.test(heads[0]) && /Lv/.test(heads[1]) && /ฉายา/.test(heads[2]) &&
       /พลังกาย/.test(heads[3]) && /THP/.test(heads[4]) && /คำศัพท์/.test(heads[5]) &&
       /ผิดซ้ำ/.test(heads[6]) && /จัดการ/.test(heads[7]), heads);

    eq('ทุกแถวมี 8 ช่องเท่ากัน',
       await page.evaluate(() =>
         Array.prototype.map.call(document.querySelectorAll('#baUniBody tr'), tr => tr.cells.length)), [8, 8]);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 2 · เนื้อในช่อง — ใช้สูตรชุดเดียวกับ v7.7 ═════════════════════════════
  {
    say('\n═══ 2 · เนื้อในช่องทั้ง 8 ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [live('a1', { room: 'ม.4', lv: 88, exp: 2415, mexp: 3580,
                                   gold: 6040, mfloor: 20, floor: 12, loops: 3,
                                   corr: 3398, wrong: 413, acc: 89, best: 66, words: 320 })]);

    const c = await page.evaluate(() => {
      const tr = document.querySelector('#baUniBody tr');
      return Array.prototype.map.call(tr.cells, td => td.textContent.replace(/\s+/g, ' ').trim());
    });
    ok('1 · ชื่อ + กลุ่ม + @รหัส + เวลาอัปเดต + ปุ่มลัดสองใบ',
       /ฮันเตอร์ a1/.test(c[0]) && /ม\.4/.test(c[0]) && /@a1/.test(c[0]) &&
       /วินาทีที่แล้ว/.test(c[0]) && /แฟ้มฮันเตอร์/.test(c[0]) && /เติม HP\/MP/.test(c[0]), c[0]);
    ok('2 · เลเวล + ป้ายแรงค์ตามเลเวลของ v7.6/v7.2', /88/.test(c[1]) && /SS-RANK/.test(c[1]), c[1]);
    ok('3 · "20 / 20 (รอบที่ 3)" + "ยืนอยู่ชั้น 12" + ฉายา',
       /20 \/ 20/.test(c[2]) && /\(รอบที่ 3\)/.test(c[2]) && /ยืนอยู่ชั้น 12/.test(c[2]), c[2]);
    ok('4 · EXP 2415/3580 + % + ❤️ HP · 🔮 MP (เรนเดอร์เสมอ)',
       /2415\/3580/.test(c[3]) && /67%/.test(c[3]) && /❤️ 55\/190/.test(c[3]) && /🔮 30/.test(c[3]), c[3]);
    ok('5 · ทอง 6040 (ไม่มีตัวคั่นหลักพัน) + 🏆 THP',
       /6040/.test(c[4]) && !/6,040/.test(c[4]) && /🏆/.test(c[4]), c[4]);
    ok('6 · 3398 / 413 + แม่นยำ 89% + 🔥 สตรีค + 📚 คำศัพท์',
       /3398/.test(c[5]) && /413/.test(c[5]) && /แม่นยำ 89%/.test(c[5]) &&
       /🔥 66/.test(c[5]) && /📚 320/.test(c[5]), c[5]);
    ok('7 · ป้ายคำที่ผิดซ้ำพร้อมตัวเลขความถี่', /你/.test(c[6]) && /4/.test(c[6]), c[6]);
    ok('8 · ป้ายสถานะ + ปุ่มควบคุม 6 ใบ',
       /Active/.test(c[7]) && await page.evaluate(() =>
         document.querySelectorAll('#baUniBody tr .gm-row-btns button').length) === 6, c[7]);

    const thp = await page.evaluate(() => {
      const r = baMsOf('a1');
      return [baThp(320, 89, 3), document.querySelector('#baUniBody tr').cells[4].textContent];
    });
    ok('THP ในช่องตรงกับสูตร baThp ของ v7.2', thp[1].indexOf(String(thp[0])) >= 0, thp);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 3 · Zero-Scroll — กว้างไม่เกิน 1150px และไม่มีการเลื่อนแนวนอน ═════════
  {
    say('\n═══ 3 · Zero-Scroll ═══');
    for (const vw of [1000, 1200, 1440]) {
      const { ctx, page, errs } = await fresh(browser, vw);
      await enterPanel(page);
      await seed(page, [
        live('a1', { name: 'ฮันเตอร์ชื่อยาวมากมายเหลือเกินจริง ๆ', room: 'ม.4/12' }),
        live('b2', { lv: 99, gold: 999999, corr: 99999, wrong: 88888, words: 329, best: 250,
                     weak: [1,2,3,4,5,6,7,8].map(i => ({ id: i, ch: '難', py: 'nán', n: 15 })) })
      ]);
      const m = await page.evaluate(() => {
        const a = baBattleAudit().unified;
        return { w: a.width, scroll: a.scroll, body: document.body.scrollWidth <= window.innerWidth,
                 tw: document.querySelector('#baUni .ba-uni-t').scrollWidth,
                 cw: document.querySelector('#baUni .ba-uni-wrap').clientWidth };
      });
      ok('จอ ' + vw + ' · กรอบตารางกว้างไม่เกิน 1150px', m.w <= 1150, m);
      ok('จอ ' + vw + ' · ตารางไม่ล้นกรอบ (ไม่ต้องเลื่อนแนวนอน)', m.scroll <= 0 && m.tw <= m.cw + 1, m);
      ok('จอ ' + vw + ' · หน้าไม่ล้นแนวนอน', m.body, m);
      ok('จอ ' + vw + ' · ไม่มี pageerror', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }

  // ═══ 4 · ปุ่มทุกใบทำงานจริง (Action Handlers) ══════════════════════════════
  {
    say('\n═══ 4 · ปุ่มลัด · ปุ่มควบคุม · โมดัลทั้งสองใบ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [live('a1')]);

    /* 📑 แฟ้มฮันเตอร์ — ต้องเปิดจริงและมีครบ 4 แท็บตามสเปก */
    await page.evaluate(() => document.querySelector('#baUniBody tr button[data-a="file"]').click());
    await page.waitForTimeout(300);
    const file = await page.evaluate(() => ({
      active: document.getElementById('gcModal').classList.contains('active'),
      title: (document.querySelector('#gcModal .gc-title') || {}).textContent || '',
      tabs: document.querySelectorAll('#gcModal .gc-tab').length,
      body: (document.querySelector('#gcModal .gc-body') || { textContent: '' }).textContent.length
    }));
    ok('📑 แฟ้มฮันเตอร์เปิดจริงจากตารางรวม', file.active, file);
    ok('มีแท็บครบ 4 ใบ (ประวัติ · คลังไอเทม · สถานะ · กู้คืน)', file.tabs === 4, file.tabs);
    ok('เนื้อแฟ้มไม่ว่าง', file.body > 50, file.body);

    /* พิสูจน์ว่ามองเห็นจริง ไม่ใช่แค่มีคลาส active (กับดักข้อ 25) */
    const seen = await page.evaluate(() => {
      const box = document.querySelector('#gcModal .gc-box');
      if (!box) return { hit: 0, all: 0 };
      const r = box.getBoundingClientRect();
      let hit = 0, all = 0;
      for (let x = 0.15; x < 1; x += 0.2) for (let y = 0.15; y < 1; y += 0.2) {
        const el = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
        all++; if (el && el.closest('#gcModal')) hit++;
      }
      return { hit: hit, all: all };
    });
    ok('แฟ้มฮันเตอร์มองเห็นจริงทุกจุดที่วัด', seen.all > 0 && seen.hit === seen.all, seen);
    await page.evaluate(() => gcClose());

    /* 💊 เติม HP/MP */
    await page.evaluate(() => {
      const s = loadStore(); s.a1 = s.a1 || {}; s.a1.hp = 1; s.a1.mp = 1; saveStore(s);
    });
    await page.evaluate(() => document.querySelector('#baUniBody tr button[data-a="heal"]').click());
    await page.waitForTimeout(300);
    const healed = await page.evaluate(() => {
      const a = loadStore().a1;
      return { hp: a.hp, mhp: a.maxHp, mp: a.mp };
    });
    ok('💊 เติม HP/MP เต็มจริง', healed.hp === healed.mhp && healed.mp > 1, healed);

    /* 🎁 แจกทอง (มีโมดัลกรอกตัวเลข) */
    const g0 = await page.evaluate(() => loadStore().a1.gold);
    await page.evaluate(() => document.querySelector('#baUniBody tr button[data-a="gift"]').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => { document.getElementById('gmModalInput').value = '500'; });
    await confirmOk(page);
    const g1 = await page.evaluate(() => loadStore().a1.gold);
    ok('🎁 แจกทองเข้าจริง', g1 === g0 + 500, { g0, g1 });

    /* ❄️ ระงับสิทธิ์ → ป้ายในตารางรวมต้องเปลี่ยนตาม */
    await page.evaluate(() => document.querySelector('#baUniBody tr button[data-a="frz"]').click());
    await confirmOk(page);
    const frz = await page.evaluate(() => ({
      f: loadStore().a1.frozen,
      cell: document.querySelector('#baUniBody tr').cells[7].textContent
    }));
    ok('❄️ ระงับสิทธิ์มีผลจริง', frz.f === true, frz);
    ok('ป้ายสถานะในตารางรวมเปลี่ยนเป็น "ระงับสิทธิ์" ทันที', /ระงับสิทธิ์/.test(frz.cell), frz.cell);
    await page.evaluate(() => document.querySelector('#baUniBody tr button[data-a="frz"]').click());
    await confirmOk(page);

    /* 🔄 รีเซ็ต — เมนู 4 โหมดของ v7.4 */
    await page.evaluate(() => document.querySelector('#baUniBody tr button[data-a="rst"]').click());
    await page.waitForTimeout(250);
    const mr = await page.evaluate(() => ({
      open: !!document.querySelector('#baMrModal.active'),
      modes: document.querySelectorAll('#baMrModal .ba-mr-btn').length
    }));
    ok('🔄 เปิดเมนูรีเซ็ตของ v7.4 ได้', mr.open, mr);
    eq('เมนูรีเซ็ตมีครบ 4 โหมด', mr.modes, 4);
    await page.evaluate(() => { const m = document.getElementById('baMrModal'); if (m) m.classList.remove('active'); });

    /* ✏️ / 🔑 — ต้องเรียกฟังก์ชันจริงของชั้นล่าง */
    const called = await page.evaluate(() => {
      const hit = [];
      const _lv = gmEditLevel, _pw = gmResetPw;
      gmEditLevel = function (u) { hit.push('lv:' + u); };
      gmResetPw   = function (u) { hit.push('pw:' + u); };
      document.querySelector('#baUniBody tr button[data-a="lv"]').click();
      document.querySelector('#baUniBody tr button[data-a="pw"]').click();
      gmEditLevel = _lv; gmResetPw = _pw;
      return hit;
    });
    eq('✏️ และ 🔑 ส่งรหัสฮันเตอร์ถูกคน', called, ['lv:a1', 'pw:a1']);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 5 · ตัวกรอง · ตัวเรียง · การซิงก์สองทาง ═══════════════════════════════
  {
    say('\n═══ 5 · กรองกลุ่ม · ค้นหา · เรียง · ซิงก์ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [
      live('a1', { room: 'ม.4', words: 10, acc: 30, mfloor: 4,  lv: 5 }),
      live('b2', { room: 'ม.5', words: 90, acc: 95, mfloor: 12, lv: 40 }),
      live('c3', { room: 'ม.4', words: 50, acc: 60, mfloor: 8,  lv: 20 })
    ]);
    const users = () => page.evaluate(() =>
      Array.prototype.map.call(document.querySelectorAll('#baUniBody tr'), tr => tr.dataset.baU));

    eq('ค่าเริ่มต้นเรียงตามชั้นสูงสุด', await users(), ['b2', 'c3', 'a1']);

    await page.evaluate(() => baSetSort('words'));
    await page.waitForTimeout(250);
    eq('ปุ่ม 📖 จำนวนคำ ของ v7.2 เรียงตารางรวมด้วย', await users(), ['b2', 'c3', 'a1']);

    await page.evaluate(() => baSetSort('acc'));
    await page.waitForTimeout(250);
    eq('ปุ่ม 🎯 แม่นยำ เรียงถูก', await users(), ['b2', 'c3', 'a1']);
    await page.evaluate(() => baSetSort('live'));
    await page.waitForTimeout(250);

    await page.evaluate(() => { GC_ROOM = 'ม.4'; gcFilterRows(); });
    await page.waitForTimeout(250);
    eq('กรองกลุ่มห้องเรียนของ v4.3 มีผลกับตารางรวม', (await users()).sort(), ['a1', 'c3']);
    await page.evaluate(() => { GC_ROOM = ''; gcFilterRows(); });
    await page.waitForTimeout(250);

    await page.evaluate(() => { document.getElementById('gmSearch').value = 'b2'; gmRender(); });
    await page.waitForTimeout(300);
    eq('ช่องค้นหาของ v4.0 มีผลกับตารางรวม', await users(), ['b2']);
    await page.evaluate(() => { document.getElementById('gmSearch').value = ''; gmRender(); });
    await page.waitForTimeout(300);

    /* สัญญาณใหม่เข้ามา → ตารางรวมต้องขยับตาม */
    await page.evaluate(() => { fbApply('put', JSON.stringify({ path: '/a1/gold', data: 7777 })); });
    await page.waitForTimeout(350);
    ok('สัญญาณ RTDB รายฟิลด์ดันค่าเข้าตารางรวม',
       /7777/.test(await page.evaluate(() =>
         document.querySelector('#baUniBody tr[data-ba-u="a1"]').cells[4].textContent)));

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 6 · ไม่ทำของเดิมพัง — Export bridge · KPI · ลบไอดี ═══════════════════
  {
    say('\n═══ 6 · ความเข้ากันได้กับชั้นล่าง ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [live('a1', { gold: 4321, exp: 90, mexp: 100, mfloor: 7, loops: 2 }),
                      live('b2')]);

    const xp = await page.evaluate(() => (typeof xpDomRows === 'function') ? xpDomRows() : null);
    ok('สะพาน Export ของ v5.5 ยังอ่านตารางสด (ที่ซ่อนอยู่) ได้ครบ', xp && xp.length === 2, xp && xp.length);
    const xa = xp && xp.filter(function (r) { return r.u === 'a1'; })[0];
    ok('และอ่านตัวเลขถูกช่อง',
       !!xa && xa.gold === 4321 && xa.mfloor === 7 && xa.exp === 90, xa);

    eq('KPI ของ v4.0/v4.3 ยังนับถูก',
       await page.evaluate(() => document.getElementById('kpiStudents').textContent), '2');

    /* ลบไอดี — แถวต้องหายจากทั้งสามที่ */
    await page.evaluate(() => { gmDelete('b2'); });
    await confirmOk(page);
    await page.waitForTimeout(400);
    const gone = await page.evaluate(() => ({
      uni: document.querySelectorAll('#baUniBody tr[data-ba-u="b2"]').length,
      live: document.querySelectorAll('#fbBody tr').length,
      store: Object.keys(loadStore()).indexOf('b2')
    }));
    ok('🗑️ ลบไอดีแล้วแถวหายจากตารางรวมทันที', gone.uni === 0, gone);
    ok('และหายจากทะเบียนในเครื่องด้วย', gone.store < 0, gone);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 7 · ไม่แตะหน้าจอเล่นเลยแม้แต่พิกเซลเดียว ═════════════════════════════
  {
    say('\n═══ 7 · หน้าจอเล่นต้องไม่ขยับ ═══');
    for (const [vw, want] of [[390, 340.8], [320, 354.8]]) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: 844 } });
      await ctx.addInitScript(STUB);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String((e && e.message) || e)));
      await page.route('**fonts.googleapis.com**', r => r.abort());
      await page.goto(FILE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);

      /* เข้าเกมด้วยเส้นทางจริง — ผ่านป๊อปอัปกติกาของ v5.6 ก่อนเสมอ */
      await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(120);
      await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
      await page.waitForTimeout(700);
      await page.evaluate(() => { switchTab('register'); });
      await page.evaluate(() => {
        document.getElementById('reg-id').value = 'zz1';
        document.getElementById('reg-pw').value = '1111';
        document.getElementById('reg-pw2').value = '1111';
        handleSubmit();
      });
      await page.waitForTimeout(900);
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
          const c = document.querySelector('#cdDraft.active .cd-card'); if (c) c.click();
          try { snGateConfirm(); } catch (e) {}
        });
        await page.waitForTimeout(700);
      }
      /* บังคับคำ/ตัวเลือกให้คงที่แล้วล้างบรรทัดผลลัพธ์ ก่อนวัดเสมอ */
      const h = await page.evaluate(() => {
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        const m = G.currentMonster;
        if (m) { m.choices = ['ก', 'ข', 'ค', 'ง']; m.answer = 'ก'; renderChoices(); }
        document.getElementById('gFeedback').innerHTML = '';
        const card = document.querySelector('.ac-battle');
        return card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : -1;
      });
      ok('จอ ' + vw + ' · การ์ดโจทย์ยัง ' + want + 'px', h === want, h);
      ok('จอ ' + vw + ' · หน้าเล่นไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('จอ ' + vw + ' · ไม่มีตารางรวมโผล่ในหน้าเล่น',
         await page.evaluate(() => !document.getElementById('baUni')));
      ok('จอ ' + vw + ' · ไม่มี pageerror', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }

  // ═══ 8 · ต้นทุน — ไม่วาดฟรีบนเครื่องนักเรียน ══════════════════════════════
  {
    say('\n═══ 8 · ต้นทุน ═══');
    const { ctx, page, errs } = await fresh(browser);
    const n0 = await page.evaluate(() => baBattleAudit().unified.n.paint);
    await page.evaluate(() => { for (let i = 0; i < 20; i++) { try { fbPaint(); } catch (e) {} } });
    const n1 = await page.evaluate(() => baBattleAudit().unified.n.paint);
    eq('ห้องควบคุมไม่ได้กาง = ไม่วาดสักครั้ง', n1 - n0, 0);
    ok('และไม่แทรก DOM ให้เครื่องนักเรียน',
       await page.evaluate(() => !document.getElementById('baUni')));
    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  say('\n══════════════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
