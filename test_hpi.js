/* ชุดเทสต์ Patch v9.43 HPI
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_unified_gm.js            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'hpi_log.txt');
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

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const { ctx, page, errs } = await fresh(browser, 1200);
  await enterPanel(page);
  const rich = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, ch: 'x', py: 'x', n: 3, seen: 9 }));
  const hp = [650, 700, 500, 300, 400];
  await seed(page, [
    live('a1', { hpi: [600, 650, 700, 500, 300, 400], at: Date.now() }),
    live('a2', { corr: 5, wrong: 5, acc: 50, at: Date.now() - 5 * 86400000 })
  ]);
  const a = await page.evaluate(() => baBattleAudit().hpi943);
  ok('audit hpi943 มี', !!a && a.ver === 'v9.43', a);
  ok('มีปุ่มเรียง HPI', a && a.sorts >= 7, a);
  const html = await page.evaluate(() => document.getElementById('baUni') ? document.getElementById('baUni').innerHTML : '');
  ok('ตารางรวมมีเรดาร์ HPI', /ba-hpi/.test(html));
  ok('คนตอบน้อยขึ้น ยังไม่จัดอันดับ หรือไม่มี HPI', /ยังไม่จัดอันดับ|😴/.test(html));
  ok('มีแถบสรุปห้อง', await page.evaluate(() => !!document.getElementById('baHpiRoom')));
  const head = await page.evaluate(() => XP_HEAD.length);
  ok('XP_HEAD เพิ่ม 6 คอลัมน์', head >= 17, head);
  const lb = await page.evaluate(() => ({ modes: LB_MODES.map(m => m.key), hasHpi: LB_MODES.some(m => m.key === 'hpi') }));
  ok('LB_MODES มีแท็บ hpi', lb.hasHpi, lb);
  const row = await page.evaluate(() => { const r = xpRecToRow({ u: 'z', name: 'z', hpi: [600, 650, 700, 500, 300, 400] }); return r.length; });
  ok('xpRecToRow ยาวเท่า XP_HEAD', row === head, { row, head });
  ok('ไม่มี pageerror', errs.length === 0, errs);
  say('ผ่าน ' + PASS + '  ตก ' + FAIL);
  await browser.close();
})();
