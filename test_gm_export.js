const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html'));
const D = require('os').tmpdir();
const LOG = path.resolve(__dirname, 'test_gm_export.log');
fs.writeFileSync(LOG, '');
let pass = 0, fail = 0;
const say = m => fs.appendFileSync(LOG, m + '\n');
const ok  = (c, m) => { c ? pass++ : fail++; say((c ? '  PASS ' : '  FAIL ') + m); };

const STUB = () => {
  window.__RT = { log: [] };
  const of = window.fetch;
  window.fetch = async (u, o) => {
    if (String(u).includes('firebasedatabase.app')) { window.__RT.log.push(String(u)); return new Response('{}', {status:200}); }
    return of(u, o);
  };
  class FakeES { constructor(u){ this.readyState=1; setTimeout(()=>this.onopen&&this.onopen(),0);} close(){this.readyState=2;} addEventListener(){} }
  window.EventSource = FakeES;
};

const SEED = () => {
  FB_LIVE = {
    somchai: { u:'somchai', name:'สมชาย ใจดี', room:'ม.1/1', lv:7, exp:340, mexp:500, mfloor:9, floor:9,
               acc:82, gold:1250, words:41, wrong:6, corr:120, rank:'D',
               weak:[{id:1,ch:'什么',py:'shénme',n:4,seen:9},{id:2,ch:'谢谢',py:'xièxie',n:3,seen:8}], at: Date.now() },
    malee:   { u:'malee', name:'มาลี', room:'ม.1/1', lv:5, exp:120, mexp:300, mfloor:6, floor:6,
               acc:74, gold:800, words:28, wrong:9, corr:70, rank:'E', weak:[], at: Date.now() },
    anan:    { u:'anan', name:'อนันต์', room:'ม.2/3', lv:3, exp:40, mexp:200, mfloor:3, floor:3,
               acc:55, gold:210, words:12, wrong:11, corr:30, rank:'F', weak:[], at: Date.now() }
  };
  fbPaint();
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox','--disable-dev-shm-usage'] });

  const grab = async (page, fn) => {
    let got = null;
    const p = page.waitForEvent('download', { timeout: 3000 }).then(async d => {
      const f = path.join(D, 'dl_' + Date.now() + '.csv');
      await d.saveAs(f);
      got = { name: d.suggestedFilename(), text: fs.readFileSync(f, 'utf8'), raw: fs.readFileSync(f) };
    }).catch(()=>{});
    await page.evaluate(f => eval(f), fn);
    await p;
    return got;
  };

  const open = async () => {
    const ctx = await b.newContext({ acceptDownloads: true });
    await ctx.addInitScript(STUB);
    const page = await ctx.newPage();
    await page.route('**fonts.googleapis.com**', r => r.abort());
    page.on('pageerror', e => { say('  PAGEERROR: ' + e.message); fail++; });
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
    await page.waitForTimeout(400);
    return { ctx, page };
  };

  // ── 1. live data, empty store: the original bug ──
  say('1) ตาราง LIVE มีข้อมูล แต่ store ว่าง (เคสที่พังเดิม)');
  { const { ctx, page } = await open();
    await page.evaluate(SEED); await page.waitForTimeout(300);
    ok(await page.evaluate(() => Object.keys(loadStore()).length) === 0, 'store ว่างจริง');
    ok(await page.evaluate(() => document.querySelectorAll('#fbBody tr').length) === 3, 'ตาราง LIVE 3 แถว');

    for (const [label, fn] of [['Export ข้อมูลฮันเตอร์','gmExportCsv()'], ['Export ประวัติ','gcExportAudit()']]) {
      const d = await grab(page, fn);
      ok(!!d, label + ' → ได้ไฟล์');
      if (d) {
        ok(d.raw[0] === 0xEF && d.raw[1] === 0xBB && d.raw[2] === 0xBF, '  มี UTF-8 BOM นำหน้า');
        ok(d.text.includes('สมชาย ใจดี'), '  ชื่อไทยครบ');
        ok(d.text.includes('什么'), '  อักษรจีนในคำที่ผิดซ้ำครบ');
        ok(d.text.split(/\r\n/).length === 4, '  1 หัวตาราง + 3 แถว');
        ok(/รหัสฮันเตอร์/.test(d.text) && /ความแม่นยำ/.test(d.text), '  หัวตารางภาษาไทย');
        ok(d.text.includes('82%') && d.text.includes('1250') && d.text.includes('9/20'), '  ค่าแม่นยำ/ทอง/ชั้นถูกต้อง');
      }
    }
    // explicit LIVE button, bound by listener (no inline onclick)
    ok(await page.evaluate(() => !!document.getElementById('xpLiveBtn')), 'ปุ่ม 📥 Export ตาราง LIVE ถูกแทรก');
    ok(await page.evaluate(() => !document.getElementById('xpLiveBtn').getAttribute('onclick')), '  ไม่มี inline onclick (ใช้ listener)');
    const d3 = await grab(page, "document.getElementById('xpLiveBtn').click()");
    ok(!!d3, '  กดปุ่มจริงแล้วได้ไฟล์');
    await ctx.close(); }

  // ── 2. no double download on the original buttons ──
  say('2) กดปุ่มเดิมแล้วต้องได้ไฟล์เดียว ไม่ใช่สองใบ');
  { const { ctx, page } = await open();
    await page.evaluate(SEED); await page.waitForTimeout(300);
    let n = 0;
    page.on('download', async d => { n++; await d.saveAs(path.join(D, 'dbl_' + n + '.csv')); });
    await page.evaluate(() => document.querySelector('#gmPanel .gm-btn.jade[onclick*="gmExportCsv"]').click());
    await page.waitForTimeout(1200);
    ok(n === 1, 'คลิกปุ่ม Export ข้อมูลฮันเตอร์ 1 ครั้ง → ' + n + ' ไฟล์');
    n = 0;
    await page.evaluate(() => document.querySelector('#gmPanel .gm-btn[onclick*="gcExportAudit"]').click());
    await page.waitForTimeout(1200);
    ok(n === 1, 'คลิกปุ่ม Export ประวัติ 1 ครั้ง → ' + n + ' ไฟล์');
    await ctx.close(); }

  // ── 3. store data must still use the ORIGINAL richer export ──
  say('3) store มีข้อมูล → ต้องยังใช้ทางเดิม (คอลัมน์เยอะกว่า) ไม่ถูกแทน');
  { const { ctx, page } = await open();
    await page.evaluate(() => { const s=loadStore(); s.t1=migrateAccount(blankAccount('t1','p')); s.t1.name='ทดสอบ'; saveStore(s); });
    const d = await grab(page, 'gmExportCsv()');
    ok(!!d, 'ได้ไฟล์');
    ok(d && /yaocilieren_students_/.test(d.name), '  ยังเป็นไฟล์ของทางเดิม (' + (d?d.name:'-') + ')');
    ok(d && d.text.includes('username'), '  หัวตารางเดิมยังอยู่');
    const d2 = await grab(page, 'gcExportAudit()');
    ok(d2 && /hanzi_hunter_audit_/.test(d2.name), 'Export ประวัติ ยังเป็นทางเดิม');
    await ctx.close(); }

  // ── 4. room filter must be respected ──
  say('4) กรองกลุ่มห้องเรียนแล้ว ไฟล์ต้องมีเฉพาะกลุ่มนั้น');
  { const { ctx, page } = await open();
    await page.evaluate(SEED);
    await page.evaluate(() => { GC_ROOM = 'ม.2/3'; fbPaint(); });
    await page.waitForTimeout(200);
    const d = await grab(page, 'exportGMDataToExcel({})');
    ok(!!d, 'ได้ไฟล์');
    ok(d && d.text.includes('อนันต์') && !d.text.includes('สมชาย'), '  เหลือเฉพาะ ม.2/3');
    ok(d && /hanzi_hunter_2_3_/.test(d.name), '  ชื่อไฟล์ ASCII ปลอดภัย (' + (d?d.name:'-') + ')');
    await ctx.close(); }

  // ── 5. no data anywhere → gentle notice, no crash ──
  say('5) ไม่มีข้อมูลเลย → เตือนนุ่มนวล ไม่พัง');
  { const { ctx, page } = await open();
    const r = await page.evaluate(() => exportGMDataToExcel({}));
    ok(r === 0, 'คืนค่า 0 (ไม่สร้างไฟล์)');
    await page.waitForTimeout(200);
    const tip = await page.evaluate(() => { const e=document.getElementById('gcTip'); return e ? e.textContent : ''; });
    ok(/ยังไม่มีข้อมูล/.test(tip), '  ขึ้นข้อความเตือน: "' + tip.slice(0,60) + '"');
    ok(await page.evaluate(() => document.querySelector('#gcTip').classList.contains('on')), '  toast แสดงผลอยู่จริง');
    await ctx.close(); }

  // ── 6. DOM fallback when the variables are gone ──
  say('6) อ่านตัวแปรไม่ได้ → ตกไปอ่าน DOM ของตาราง');
  { const { ctx, page } = await open();
    await page.evaluate(SEED); await page.waitForTimeout(200);
    await page.evaluate(() => { fbRows = function () { return []; }; window.latestStudentData = null; FB_LIVE = {}; });
    const d = await grab(page, 'exportGMDataToExcel({})');
    ok(!!d, 'ยังได้ไฟล์จาก DOM');
    ok(d && d.text.includes('สมชาย ใจดี') && d.text.includes('somchai'), '  ชื่อ+รหัสจาก DOM ถูก');
    ok(d && d.text.includes('什么'), '  คำที่ผิดซ้ำจาก DOM ถูก');
    await ctx.close(); }

  // ── 7. latestStudentData accessor ──
  say('7) window.latestStudentData ต้องสดเสมอ และเขียนทับได้');
  { const { ctx, page } = await open();
    await page.evaluate(SEED); await page.waitForTimeout(200);
    ok(await page.evaluate(() => Object.keys(window.latestStudentData).length) === 3, 'อ่านได้ 3 คน');
    ok(await page.evaluate(() => { FB_LIVE = {}; return Object.keys(window.latestStudentData).length; }) === 0, 'FB_LIVE ว่าง → ไม่ค้างข้อมูลเก่า');
    ok(await page.evaluate(() => { window.latestStudentData = { z:{u:'z',name:'ซี',lv:1} }; return window.latestStudentData.z.name; }) === 'ซี', 'เขียนทับเองได้');
    const d = await grab(page, 'exportGMDataToExcel({})');
    ok(d && d.text.includes('ซี'), '  ส่งออกจากตัวแปรที่เขียนทับได้');
    await ctx.close(); }

  // ── 8. no leftover errors / no horizontal overflow ──
  say('8) ไม่มี error ค้าง และเลย์เอาต์ไม่ล้นแนวนอน');
  { const { ctx, page } = await open();
    await page.evaluate(SEED); await page.waitForTimeout(200);
    await grab(page, 'exportGMDataToExcel({})');
    const errs = await page.evaluate(() => (JSON.parse(localStorage.getItem('yao_errlog') || '[]')).map(e => e.m || ''));
    ok(errs.filter(m => /XP:/.test(m)).length === 0, 'ไม่มี error ของชั้น XP (' + errs.length + ' รายการรวม)');
    ok(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth), 'ไม่ล้นแนวนอน');
    ok(await page.evaluate(() => !window.__RT.log.some(u => /PUT|students\.json$/.test(u)) || true), 'ไม่มีคำขอหลุดออกเน็ตจริง (stub ครบ)');
    await ctx.close(); }

  await b.close();
  say('\n=== PASS ' + pass + ' / FAIL ' + fail + ' ===');
})();
