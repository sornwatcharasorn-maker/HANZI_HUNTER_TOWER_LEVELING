/* ═══════════════════════════════════════════════════════════════════
   ชุดทดสอบชั้นที่ยี่สิบเอ็ด — v5.8 · CLOUD AUTH SYNC
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_cloud_auth.js

   ไม่ต้องมี Firebase จริง — ใช้ RTDB ปลอมที่เขียนทับ window.fetch และ
   window.EventSource ผ่าน page.addInitScript (ต้องติดตั้ง "ก่อน" หน้าโหลด
   เพราะ v5.4 บังคับเปิดคอนฟิกตั้งแต่โหลดหน้า)

   ตัว RTDB ปลอมของชุดนี้ต้องรองรับมากกว่าของ v5.3 อีกสองอย่าง
     • PATCH — ผสานเฉพาะคีย์ที่ส่งมา (ทางที่ GM ใช้รีเซ็ตรหัสผ่าน)
     • GET ลึกถึงคีย์ย่อย /students/<u>/pwh.json (ทางที่ใช้อ่านก่อนเขียน)

   window.__CA.rows — แถวทั้งหมดบนโหนด /students
   window.__CA.log  — คำขอ REST ทุกครั้ง { m, url, body }
   window.__CA.fail — ตั้งเป็น 1 เพื่อจำลองเน็ตหลุด
   ═══════════════════════════════════════════════════════════════════ */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const FILE  = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG   = path.resolve(__dirname, 'test_cross_device_vocab.log');
const FBURL = 'https://hanzi-hunter-tower-leveling-default-rtdb.asia-southeast1.firebasedatabase.app';

let PASS = 0, FAIL = 0;
const FAILS = [];
try { fs.unlinkSync(LOG); } catch (e) {}
const say = m => { fs.appendFileSync(LOG, m + '\n'); process.stdout.write(m + '\n'); };
const ok  = (n, c, extra) => {
  if (c) { PASS++; say('  ✓ ' + n); }
  else   { FAIL++; FAILS.push(n); say('  ✗ ' + n + (extra != null ? '   → ' + JSON.stringify(extra) : '')); }
};
const eq  = (n, a, b) => ok(n + '  [' + JSON.stringify(a) + ' = ' + JSON.stringify(b) + ']',
                            JSON.stringify(a) === JSON.stringify(b));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── RTDB ปลอม ─────────────────────────────────────────────────── */
const FAKE = (base) => `
  (function () {
    const S = { rows: {}, log: [], fail: 0, base: ${JSON.stringify(base)} };
    window.__CA = S;

    const _fetch = window.fetch;
    window.fetch = function (url, opt) {
      const u = String(url && url.url ? url.url : url);
      if (u.indexOf(S.base) !== 0) return _fetch.apply(this, arguments);
      const o = opt || {};
      const m = (o.method || 'GET').toUpperCase();
      S.log.push({ m: m, url: u, body: o.body ? JSON.parse(o.body) : null });
      if (S.fail) return Promise.reject(new Error('simulated network down'));

      /* /students/<user>/<field>.json → แตกเป็นชิ้นเพื่อรองรับการอ่านลึกถึงคีย์ย่อย */
      const p = u.slice(S.base.length).replace(/\\?.*$/, '').replace(/\\.json$/, '');
      const seg = p.split('/').filter(Boolean);        /* [node, user?, field?] */
      const user  = seg[1] ? decodeURIComponent(seg[1]) : null;
      const field = seg[2] ? decodeURIComponent(seg[2]) : null;
      const body  = o.body ? JSON.parse(o.body) : null;

      let out = null;
      if (m === 'PUT' && user) {
        if (field) { S.rows[user] = S.rows[user] || {}; S.rows[user][field] = body; out = body; }
        else { S.rows[user] = body; out = body; }
      } else if (m === 'PATCH' && user) {
        S.rows[user] = Object.assign({}, S.rows[user] || {}, body || {});
        out = body;
      } else if (m === 'DELETE' && user) { delete S.rows[user]; out = null; }
      else if (m === 'GET') {
        if (user && field) out = (S.rows[user] || {})[field];
        else if (user) out = S.rows[user] || null;
        else out = S.rows;
      }
      if (out === undefined) out = null;
      return Promise.resolve(new Response(JSON.stringify(out),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };

    /* EventSource ปลอมแบบง่าย — ชุดนี้ไม่ได้ทดสอบจอครูสด แค่กันไม่ให้ต่อเน็ตจริง */
    function FakeES(url) {
      this.url = url; this.readyState = 1; this._h = {};
      this.onopen = null; this.onerror = null; this.onmessage = null;
      const self = this;
      setTimeout(function () { if (self.onopen) self.onopen({}); }, 0);
    }
    FakeES.prototype.addEventListener = function (t, fn) { (this._h[t] = this._h[t] || []).push(fn); };
    FakeES.prototype.removeEventListener = function () {};
    FakeES.prototype.close = function () { this.readyState = 2; };
    FakeES.CONNECTING = 0; FakeES.OPEN = 1; FakeES.CLOSED = 2;
    window.EventSource = FakeES;
  })();
`;

/* ── ตัวช่วย ───────────────────────────────────────────────────── */

/* ผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง (ห้ามเรียก enterGate ตรง ๆ) */
async function passGate(page) {
  await page.evaluate(() => {
    const b = document.getElementById('rgBody');
    if (b) b.scrollTop = b.scrollHeight;
  });
  await sleep(140);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} try { rgAck(); } catch (e) {} });
  await sleep(700);
}

/* หน้าต่างจั่วการ์ดของ v4.7 คั่นอยู่ — ต้องเลือกให้จบก่อนเสมอ */
async function pickCard(page) {
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => {
      const d = document.getElementById('cdDraft');
      return !!(d && d.classList.contains('active'));
    });
    if (!open) break;
    await page.evaluate(() => { const c = document.querySelector('#cdDraft .cd-card'); if (c) c.click(); });
    await sleep(750);
  }
}

const inGame = page => page.evaluate(() =>
  document.getElementById('gameScreen').classList.contains('active'));

async function register(page, id, pw, name) {
  await page.evaluate(([i, p, n]) => {
    switchTab('register');
    document.getElementById('reg-id').value   = i;
    document.getElementById('reg-pw').value   = p;
    document.getElementById('reg-pw2').value  = p;
    document.getElementById('reg-name').value = n || i;
  }, [id, pw, name]);
  await page.evaluate(() => handleSubmit());
  await page.waitForFunction(() => document.getElementById('gameScreen').classList.contains('active'),
    { timeout: 9000 });
  await pickCard(page);
}

/* พยายามล็อกอิน แล้วคืนว่าเข้าเกมได้หรือไม่ พร้อมข้อความบนช่องเตือน */
async function tryLogin(page, id, pw, waitMs) {
  await page.evaluate(([i, p]) => {
    switchTab('login');
    document.getElementById('login-id').value = i;
    document.getElementById('login-pw').value = p;
  }, [id, pw]);
  await page.evaluate(() => handleSubmit());
  await sleep(waitMs || 1400);
  const got = await inGame(page);
  if (got) await pickCard(page);
  return { inGame: got, err: await page.evaluate(() => document.getElementById('login-err').textContent) };
}

/* จำลอง "ย้ายไปเครื่องใหม่" — ล้างทะเบียนในเครื่องทิ้ง แต่แถวบนคลาวด์ยังอยู่ */
async function wipeDevice(page) {
  await page.evaluate(() => {
    try { if (typeof CURRENT_USER === 'string' && CURRENT_USER) exitGame(); } catch (e) {}
    localStorage.setItem('yao_students', '{}');
    localStorage.removeItem('yao_cloud_ses');
  });
  await sleep(500);
}

/* ═══════════════════════════════════════════════════════════════ */
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.addInitScript(FAKE(FBURL));
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await passGate(page);

  try {
    say('\n═══ 1 · เครื่อง 1: เก็บคำศัพท์ + ความคืบหน้า → ขึ้นคลาวด์ ═══');
    await register(page, 'vx01', 'pw1234', 'ฮันเตอร์ซิงก์');
    const snap = await page.evaluate(() => {
      G.wordStats = {};
      VOCAB.slice(0, 120).forEach((v, i) => { G.wordStats[String(v[0])] = { seen: 4 + (i % 3), wrong: i % 4 === 0 ? 1 : 0, totalMs: 0, lastSeen: 0, recent: [] }; });
      /* คำที่เรียนรู้แล้วแต่ผิดมาก: seen 5 wrong 5 → ไม่ถูกเลย */
      G.wordStats[String(VOCAB[130][0])] = { seen: 5, wrong: 5, totalMs: 0, lastSeen: 0, recent: [] };
      G.level = 7; G.exp = 123; G.gold = 4321; G.maxFloor = 9; G.towerClears = 3; G.bossClears = 5; G.totalGoldEarned = 9000;
      G.ab = G.ab || {}; G.ab.shards = 77; G.ab.core = Object.assign({}, G.ab.core, { mp: 3, gold: 2 });
      G.ab.seals = G.ab.seals || {}; G.ab.seals['4'] = { broken: true, flawless: true };
      G.r20 = { monarch: 1 }; G.pureRole = 'monarch';
      G.mn = G.mn || { sh: 0, at: 0 }; G.mn.sh = 0b10110; G.mn.at = 1234567890123;
      saveProgress();
      return { words: cxCount(G), ws: Object.keys(G.wordStats).length };
    });
    await page.evaluate(() => { fbPush(CURRENT_USER); });
    await sleep(1200);
    const row = await page.evaluate(() => window.__CA.rows.vx01);
    ok('แถวคลาวด์มี ws', !!(row && typeof row.ws === 'string' && row.ws.length > 100), row && row.ws && row.ws.length);
    ok('แถวคลาวด์มี ex', !!(row && row.ex && row.ex.co), row && row.ex);
    ok('ไม่มีรหัสผ่านจริงหลุดขึ้นไป', JSON.stringify(row).indexOf('pw1234') < 0);
    ok('ขนาดแถว < 6KB', JSON.stringify(row).length < 6000, JSON.stringify(row).length);

    say('\n═══ 2 · เครื่อง 2 (ว่างเปล่า) ล็อกอินไอดีเดิม ═══');
    await wipeDevice(page);
    eq('ทะเบียนเครื่องใหม่ว่าง', await page.evaluate(() => Object.keys(loadStore()).length), 0);
    const r2 = await tryLogin(page, 'vx01', 'pw1234', 2200);
    ok('เข้าเกมได้', r2.inGame, r2.err);
    const g2 = await page.evaluate(() => ({
      words: cxCount(G), lv: G.level, gold: G.gold, mf: G.maxFloor, tc: G.towerClears, bc: G.bossClears,
      sh: G.ab.shards, co: G.ab.core, se: G.ab.seals['4'], r20: G.r20, pr: G.pureRole, ms: G.mn && G.mn.sh,
      w130: G.wordStats[String(VOCAB[130][0])], w5: G.wordStats[String(VOCAB[5][0])]
    }));
    eq('จำนวนคำในคลัง (cxCount) ตรงเป๊ะ', g2.words, snap.words);
    eq('เลเวล', g2.lv, 7); eq('ทอง', g2.gold, 4321); eq('ชั้นสูงสุด', g2.mf, 9);
    eq('รอบเคลียร์ (loops)', g2.tc, 3); eq('บอสที่ปราบ', g2.bc, 5);
    eq('เศษคริสตัล', g2.sh, 77); eq('แกน mp', g2.co.mp, 3); eq('แกน gold', g2.co.gold, 2);
    eq('ผนึกชั้น 4 (broken+flawless)', [g2.se.broken, g2.se.flawless], [true, true]);
    eq('r20', g2.r20.monarch, 1); eq('pureRole', g2.pr, 'monarch');
    eq('ผนึกจอมราชัน (บิตแมสก์ sh)', g2.ms, 0b10110);
    eq('คำที่ผิด 5/5 ยังมีบันทึก', [g2.w130.seen, g2.w130.wrong], [5, 5]);
    ok('คำปกติมี seen ครบ (ไม่ใช่แค่คำอ่อน)', !!g2.w5 && g2.w5.seen >= 4, g2.w5);

    say('\n═══ 3 · เครื่อง 3 ว่างเปล่า + ต่อคลาวด์ไม่ได้ตอนล็อกอิน → ห้ามล้างคลาวด์ ═══');
    await wipeDevice(page);
    await page.evaluate(() => { window.__CA.fail = 1; });
    const r3 = await tryLogin(page, 'vx01', 'pw1234', 1800);
    await page.evaluate(() => { window.__CA.fail = 0; });
    if (!r3.inGame) {
      /* ล็อกอินออฟไลน์ไม่ได้เพราะไม่มีบัญชีในเครื่อง → สมัครบัญชีเปล่าด้วยไอดีเดิมตอนออฟไลน์ */
      await page.evaluate(() => { window.__CA.fail = 1; });
      await register(page, 'vx01', 'pw1234', 'ฮันเตอร์ซิงก์').catch(() => {});
      await page.evaluate(() => { window.__CA.fail = 0; });
    }
    await page.evaluate(() => { CA_MG = {}; });
    const blank = await page.evaluate(() => ({ in: document.getElementById('gameScreen').classList.contains('active'), words: cxCount(G) }));
    say('  (สถานะเครื่อง 3 ก่อน push: ' + JSON.stringify(blank) + ')');
    await page.evaluate(() => { fbPush(CURRENT_USER); });
    await sleep(1600);
    const row3 = await page.evaluate(() => window.__CA.rows.vx01);
    const cloudWords = await page.evaluate(r => { const a = { wordStats: {} }; caUnion(a, r); return cxCount(a); }, row3);
    ok('คลาวด์ยังมีคำศัพท์ครบหลังเครื่องเปล่า push ทับ', cloudWords >= snap.words, [cloudWords, snap.words]);
    eq('คลาวด์ยังมีเศษคริสตัล 77', row3.shards, 77);
    eq('คลาวด์ยังมีผนึกชั้น 4', row3.ex && row3.ex.se && row3.ex.se['4'], 2);
    ok('เครื่องเปล่าได้ของคลาวด์คืนเข้าเครื่องผ่าน Union', await page.evaluate(() => cxCount(G)) >= snap.words);

    say('\n═══ 4 · ผสาน Union: ถูกต้องไม่ถูกกลบด้วยก้อนที่ผิดมากกว่า ═══');
    const u = await page.evaluate(() => {
      const a = { wordStats: { 9: { seen: 3, wrong: 0, recent: [] } } };
      caUnion(a, { ws: '9.0.5,10.2.1' });
      return { w9: a.wordStats[9], w10: a.wordStats[10], own9: cxHas(a, 9) };
    });
    eq('คำ 9: ถูก 3 ผิด 5 → seen 8', [u.w9.seen, u.w9.wrong], [8, 5]);
    ok('คำ 9 ยังอยู่ในคลัง (correct=3 ไม่หลุด)', u.own9);
    eq('คำ 10 ถูกเติมเข้ามา', [u.w10.seen, u.w10.wrong], [3, 1]);
    const bad = await page.evaluate(() => { const a = {}; return caUnion(a, { ws: 'x.1.1,,5', ex: 'junk' }) + '|' + JSON.stringify(a); });
    ok('ข้อมูลเพี้ยนจากคลาวด์ไม่ทำให้พัง', typeof bad === 'string', bad);

    say('\n═══ 5 · ไม่มี pageerror · ไม่แตะเลย์เอาต์ ═══');
    eq('pageerror = 0', errs.length, 0);
    const h = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
    ok('ไม่ล้นแนวนอน', h);
  } catch (e) { FAIL++; say('✗ พัง: ' + (e && e.stack || e)); }

  await browser.close();
  say('\n══════════════════════════════════════');
  say('ผ่าน ' + PASS + ' · ตก ' + FAIL);
  if (FAILS.length) say('ตก: ' + FAILS.join(' | '));
  process.exit(FAIL ? 1 : 0);
})();
