/* ชุดเทสต์ Patch v7.3 — REFRESH BUTTON FEEDBACK (ปุ่ม 🔄 รีเฟรชข้อมูล)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_refresh_btn.js            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'refresh_btn_log.txt');
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
  window.__NET = { log: [], body: 'null' };
  window.fetch = function (u, o) {
    window.__NET.log.push({ url: String(u), method: (o && o.method) || 'GET' });
    const t = window.__NET.body;
    return Promise.resolve({ ok: true, status: 200,
      text: function () { return Promise.resolve(t); },
      json: function () { return Promise.resolve(JSON.parse(t)); } });
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
    lv: 12, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 9, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44, loops: 1,
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

const rf = () => page => page.evaluate(() => baBattleAudit().refresh);
async function audit(page) { return page.evaluate(() => baBattleAudit().refresh); }
async function click(page) { await page.evaluate(() => document.getElementById('baRfBtn').click()); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · ติดตั้ง · ค่าคงที่ · โครงปุ่ม ═══════════════════════════════════
  {
    say('\n═══ 1 · ติดตั้ง · ค่าคงที่ · โครงปุ่ม ═══');
    const { ctx, page, errs } = await fresh(browser);

    const a = await audit(page);
    eq('รุ่นของแพตช์', a.ver, '7.3');
    eq('หมุนอย่างน้อยหนึ่งรอบเต็ม 600ms', a.spin, 600);
    eq('ค้างข้อความสำเร็จ 1200ms', a.ok, 1200);
    ok('มีเพดานรอเน็ต', a.cap > 0, a.cap);
    ok('แทรกสไตล์แล้วตั้งแต่โหลดหน้า', a.styled);
    ok('เจอปุ่มและตกแต่งให้แล้วตั้งแต่โหลดหน้า', a.mounted);
    eq('สถานะเริ่มต้นคือ idle', a.state, 'idle');
    eq('ยังไม่ถูกกดสักครั้ง', a.runs, 0);
    eq('ข้อความเริ่มต้น', a.text, '🔄 รีเฟรชข้อมูล');
    ok('ปุ่มยังกดได้', !a.disabled);

    ok('ไอคอนถูกแยกออกมาเป็น span ของตัวเอง',
       await page.evaluate(() => !!document.querySelector('#baRfBtn .ba-rf-ico')));
    ok('ข้อความถูกแยกออกมาเป็น span ของตัวเอง',
       await page.evaluate(() => !!document.querySelector('#baRfBtn .ba-rf-tx')));
    eq('ปุ่มยังเรียก gmRefresh ตามเดิม',
       await page.evaluate(() => document.getElementById('baRfBtn').getAttribute('onclick')), 'gmRefresh()');
    ok('ปุ่มยังอยู่บนหัวแผง GM ที่เดิม',
       await page.evaluate(() => !!document.querySelector('#gmPanel .gm-head-btns #baRfBtn')));
    eq('ไม่ได้เพิ่ม/ลดปุ่มบนหัวแผง',
       await page.evaluate(() => document.querySelectorAll('#gmPanel .gm-head-btns .gm-btn').length >= 5), true);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 2 · สถานะกำลังทำงาน (busy) ═══════════════════════════════════════
  {
    say('\n═══ 2 · สถานะกำลังทำงาน — ไอคอนหมุน · ล็อกปุ่ม · เปลี่ยนข้อความ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await click(page);
    await page.waitForTimeout(150);

    const a = await audit(page);
    eq('สถานะเป็น busy', a.state, 'busy');
    ok('ปุ่มถูกล็อก disabled', a.disabled);
    eq('ข้อความตามสเปก', a.text, '🔄 กำลังดึงข้อมูล...');
    ok('ติดคลาสหมุนไอคอน', a.spinning);
    eq('นับการกดแล้ว', a.runs, 1);

    const anim = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#baRfBtn .ba-rf-ico')).animationName);
    eq('ไอคอนวิ่งคีย์เฟรม baRfSpin', anim, 'baRfSpin');
    eq('คาบการหมุน 0.6 วินาที', await page.evaluate(() =>
      getComputedStyle(document.querySelector('#baRfBtn .ba-rf-ico')).animationDuration), '0.6s');
    eq('หมุนต่อเนื่องระหว่างดึงข้อมูล', await page.evaluate(() =>
      getComputedStyle(document.querySelector('#baRfBtn .ba-rf-ico')).animationIterationCount), 'infinite');

    /* กดซ้อนระหว่างทำงานต้องไม่เริ่มรอบใหม่ */
    await page.evaluate(() => { try { gmRefresh(); } catch (e) {} });
    eq('กดซ้อนไม่เริ่มรอบใหม่', (await audit(page)).runs, 1);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 3 · สถานะสำเร็จ (ok) แล้วคืนสถานะเดิม ═══════════════════════════════
  {
    say('\n═══ 3 · ไฟเขียวยืนยัน แล้วคืนสถานะเดิม ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await click(page);
    await page.waitForTimeout(900);

    const a = await audit(page);
    eq('สถานะเป็น ok', a.state, 'ok');
    eq('ข้อความตามสเปก', a.text, '✅ ซิงค์ข้อมูลแล้ว!');
    ok('ปลดล็อกปุ่มแล้ว', !a.disabled);
    ok('ติดคลาสไฟเขียว', a.glow);
    ok('ไอคอนหยุดหมุนแล้ว', !a.spinning);

    const css = await page.evaluate(() => {
      const s = getComputedStyle(document.getElementById('baRfBtn'));
      return { bc: s.borderTopColor, an: s.animationName, dur: s.animationDuration, it: s.animationIterationCount };
    });
    eq('ขอบเป็นเขียว #10b981', css.bc, 'rgb(16, 185, 129)');
    eq('เล่นคีย์เฟรม baRfGlow', css.an, 'baRfGlow');
    eq('ไฟกระพริบยาว 0.4 วินาที', css.dur, '0.4s');
    eq('กระพริบครั้งเดียวจบ ไม่ใช่วนซ้ำ', css.it, '1');

    await page.waitForTimeout(1400);
    const b = await audit(page);
    eq('คืนสถานะเดิมแล้ว', b.state, 'idle');
    eq('ข้อความกลับเป็นของเดิม', b.text, '🔄 รีเฟรชข้อมูล');
    ok('ไม่เหลือคลาสหมุน/ไฟเขียวค้าง', !b.spinning && !b.glow);
    ok('ปุ่มกดได้ตามปกติ', !b.disabled);
    eq('กดใหม่ได้อีกรอบ', await page.evaluate(async () => {
      document.getElementById('baRfBtn').click();
      return 1;
    }), 1);
    await page.waitForTimeout(200);
    eq('รอบที่สองเริ่มจริง', (await audit(page)).runs, 2);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 4 · ดึงข้อมูลสดจริง แล้ววาดสองตารางใหม่ ═══════════════════════════
  {
    say('\n═══ 4 · ดึงข้อมูลสด (lrApply / fbPayload) แล้ววาด #fbBody + #gmBody ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    /* แถวสดที่ยังไม่มีในทะเบียนของเครื่องนี้ — ยัดลง FB_LIVE ตรง ๆ โดยไม่วาด
       เพื่อพิสูจน์ว่าปุ่มเป็นคนพาลงทะเบียนและวาดตารางให้ */
    await page.evaluate(function (r) { FB_LIVE = {}; FB_LIVE[r.u] = r; FB_MST = 'live'; }, live('sd1'));
    eq('ก่อนกด — ทะเบียนยังไม่รู้จักคนนี้',
       await page.evaluate(() => !!loadStore()['sd1']), false);

    await click(page);
    await page.waitForTimeout(900);

    ok('กดแล้วแถวสดถูกปั้นลงทะเบียนผ่าน lrApply',
       await page.evaluate(() => !!loadStore()['sd1']));
    eq('รอบเคลียร์หอคอยเดินทางมาด้วย',
       await page.evaluate(() => (loadStore()['sd1'] || {}).towerClears), 1);
    ok('ตารางสด #fbBody มีแถวของคนนี้',
       await page.evaluate(() => /sd1/.test(document.getElementById('fbBody').textContent)));
    ok('ตารางจัดการ #gmBody มีแถวของคนนี้',
       await page.evaluate(() => /sd1/.test(document.getElementById('gmBody').textContent)));

    /* ค่าที่ขยับรอบถัดไปต้องถึงตารางเมื่อกดซ้ำ (lrHydrate ถูกบังคับ force) */
    await page.waitForTimeout(1200);
    await page.evaluate(() => { FB_LIVE.sd1.gold = 9999; FB_LIVE.sd1.at = Date.now() + 1000; });
    await click(page);
    await page.waitForTimeout(900);
    ok('กดซ้ำแล้วค่าที่ขยับถึงทะเบียนจริง',
       await page.evaluate(() => (loadStore()['sd1'] || {}).gold) === 9999);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 5 · กันแทรกซ้ำ · ทางสำรอง · ไม่กระทบเลย์เอาต์ ══════════════════════
  {
    say('\n═══ 5 · กันแทรกซ้ำ · ทนของพัง · เลย์เอาต์ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await page.evaluate(() => { for (let i = 0; i < 12; i++) { gmRender(); openGm(); } });
    eq('ปุ่มยังมีใบเดียว', await page.evaluate(() => document.querySelectorAll('#baRfBtn').length), 1);
    eq('ไอคอนยังมีอันเดียว', await page.evaluate(() => document.querySelectorAll('#baRfBtn .ba-rf-ico').length), 1);
    eq('ข้อความยังมีอันเดียว', await page.evaluate(() => document.querySelectorAll('#baRfBtn .ba-rf-tx').length), 1);
    eq('สไตล์ยังมีก้อนเดียว', await page.evaluate(() => document.querySelectorAll('#baRfStyle').length), 1);
    eq('ข้อความไม่เพี้ยนหลังวาดซ้ำ', (await audit(page)).text, '🔄 รีเฟรชข้อมูล');

    /* ขั้นดึงข้อมูลพังกลางคัน — ปุ่มต้องไม่ค้าง disabled */
    await page.evaluate(() => { window.__lrh = lrHydrate; lrHydrate = function () { throw new Error('boom'); }; });
    await click(page);
    await page.waitForTimeout(900);
    const a = await audit(page);
    ok('ยังปลดล็อกปุ่มให้ตามปกติ', !a.disabled);
    eq('ยังเด้งไฟเขียวปิดท้าย', a.state, 'ok');
    await page.evaluate(() => { lrHydrate = window.__lrh; });

    await page.waitForTimeout(1400);
    ok('คืนสถานะเดิมได้แม้เพิ่งพัง', (await audit(page)).state === 'idle');
    ok('ข้อผิดพลาดถูกเขียนลง Error Log ของ v4.3',
       await page.evaluate(() => /rf73/.test(localStorage.getItem('yao_errlog') || '')));

    eq('ไม่ล้นแนวนอน',
       await page.evaluate(() => document.body.scrollWidth <= window.innerWidth), true);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('═══════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
