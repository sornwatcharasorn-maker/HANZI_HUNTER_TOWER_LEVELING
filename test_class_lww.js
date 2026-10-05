/* ═══════════════════════════════════════════════════════════════════
   ชุดทดสอบ Patch v9.24 · CLASS STATE LAST-WRITE-WINS
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_class_lww.js
   เครื่อง B (ค้าง Slayer) ต้องกลายเป็น Guardian หลังดึงคลาวด์ที่เครื่อง A เปลี่ยนไว้

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
const LOG   = path.resolve(__dirname, 'test_class_lww.log');
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
      const user  = seg[1] ? decodeURIComponent(seg[0]) + '/' + decodeURIComponent(seg[1]) : null;
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
async function doSwitch(page, cls) {
  await page.evaluate((c) => {
    G.gold = (G.gold || 0) + 40000;
    if (G.ab) G.ab.shards = (G.ab.shards || 0) + 500;
    try { if (typeof gatOf === 'function') gatOf(G).swToken = 1; } catch (e) {}
    window.__swr = baPlSwitch(c);
  }, cls);
  await sleep(250);
  await page.evaluate(() => { const b = document.getElementById('gmModalOk'); const m = document.getElementById('gmModal'); if (b && m && m.classList.contains('active')) b.click(); });
  await sleep(500);
  return page.evaluate((c) => G.classId === c, cls);
}
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


const DEV_KEYS = ['yao_students', 'yao_cloud_ses'];
async function snapDevice(page) {
  return page.evaluate(k => { const o = {}; k.forEach(x => { o[x] = localStorage.getItem(x); }); return o; }, DEV_KEYS);
}
async function loadDevice(page, snap) {
  await page.evaluate(([k, s]) => {
    try { if (typeof CURRENT_USER === 'string' && CURRENT_USER) exitGame(); } catch (e) {}
    k.forEach(x => { if (s[x] == null) localStorage.removeItem(x); else localStorage.setItem(x, s[x]); });
  }, [DEV_KEYS, snap]);
  await sleep(500);
}
async function leave(page) {
  await page.evaluate(() => { try { saveProgress(); exitGame(); } catch (e) {} });
  await sleep(900);
}
const state = page => page.evaluate(() => ({
  cls: G.classId, at: G.classAt || 0, lv: G.level, gold: G.gold,
  words: cxCount(G), st: loadStore()[CURRENT_USER].classId,
  name: baPlName(G), bar: document.querySelectorAll('#gSkills .g-skill').length,
  dsCls: (baBattleAudit().dispatch || {}).cls, sync: baBattleAudit().classSync
}));

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
    say('\n═══ 1 · เครื่อง B: สมัคร → เลือก Slayer → เล่น → ออก ═══');
    await register(page, 'cls1', 'pw1234', 'ฮันเตอร์สองเครื่อง');
    const okSw = await doSwitch(page, 'slayer');
    ok('B เปลี่ยนเป็น slayer ได้ (ครั้งแรกฟรี)', okSw);
    await page.evaluate(() => {
      VOCAB.slice(0, 20).forEach(v => { G.wordStats[String(v[0])] = { seen: 3, wrong: 0, totalMs: 0, lastSeen: 0, recent: [] }; });
      G.level = 6; G.exp = 10; G.gold = 800; saveProgress();
    });
    await leave(page);
    const wb1 = await page.evaluate(() => window.__CA.rows['wordbank/cls1']);
    eq('คลาวด์ wordbank = slayer', wb1 && wb1.classId, 'slayer');
    ok('payload มี classAt', wb1 && wb1.classAt > 0, wb1 && wb1.classAt);
    const devB = await snapDevice(page);

    say('\n═══ 2 · เครื่อง A (ใหม่): ล็อกอิน → เปลี่ยนเป็น Guardian ═══');
    await sleep(30);
    await loadDevice(page, { yao_students: '{}', yao_cloud_ses: null });
    const rA = await tryLogin(page, 'cls1', 'pw1234', 2400);
    ok('A เข้าเกมได้', rA.inGame, rA.err);
    eq('A รับ slayer จากคลาวด์ (เครื่องสะอาด)', await page.evaluate(() => G.classId), 'slayer');
    const swA = await doSwitch(page, 'guardian');
    ok('A เปลี่ยนเป็น guardian ได้', swA);
    await sleep(500);
    const wb2 = await page.evaluate(() => window.__CA.rows['wordbank/cls1']);
    eq('เปลี่ยนสายแล้วยิง wordbank ทันที (ไม่ต้องรอ exit)', wb2 && wb2.classId, 'guardian');
    await page.evaluate(() => {
      VOCAB.slice(40, 50).forEach(v => { G.wordStats[String(v[0])] = { seen: 2, wrong: 0, totalMs: 0, lastSeen: 0, recent: [] }; });
      G.level = 8; G.maxExp = expForLevel(8); G.exp = 5; G.gold = 2222; saveProgress();
    });
    await leave(page);
    const devA = await snapDevice(page);

    say('\n═══ 3 · เครื่อง B (ค้าง Slayer) ล็อกอินกลับ → ต้องเป็น Guardian ═══');
    await loadDevice(page, devB);
    eq('ก่อนล็อกอิน ทะเบียน B ยังเป็น slayer', await page.evaluate(() => loadStore().cls1.classId), 'slayer');
    const rB = await tryLogin(page, 'cls1', 'pw1234', 2800);
    ok('B เข้าเกมได้', rB.inGame, rB.err);
    await sleep(800);
    const sB = await state(page);
    eq('G.classId = guardian', sB.cls, 'guardian');
    eq('ทะเบียน B ถูกเซฟเป็น guardian', sB.st, 'guardian');
    eq('แถบสกิลรีบายด์เป็นสาย guardian', sB.dsCls, 'guardian');
    eq('แถบสกิลยังครบ 4 ช่อง', sB.bar, 4);
    ok('ชื่อร่างเป็นของผู้พิทักษ์', /Guard/i.test(sB.name), sB.name);
    eq('เลเวล (LWW จากเครื่องที่ใหม่กว่า)', sB.lv, 8);
    eq('ทอง (LWW)', sB.gold, 2222);
    ok('คลังคำศัพท์ union ไม่หาย (B 20 + A 10)', sB.words >= 30, sB.words);
    ok('audit นับการรับสาย', sB.sync && sB.sync.n.lww >= 1, sB.sync);
    const wb3 = await page.evaluate(() => window.__CA.rows['wordbank/cls1']);
    eq('คลาวด์ยังเป็น guardian (pushback ของชั้นในไม่ทับคืน)', wb3 && wb3.classId, 'guardian');

    say('\n═══ 4 · ย้อนทาง: B เปลี่ยนเป็น Priest → A (ค้าง Guardian) ต้องตาม ═══');
    await doSwitch(page, 'priest');
    await leave(page);
    await loadDevice(page, devA);
    const rA2 = await tryLogin(page, 'cls1', 'pw1234', 2800);
    ok('A เข้าเกมได้', rA2.inGame, rA2.err);
    await sleep(800);
    eq('A ได้ priest', await page.evaluate(() => G.classId), 'priest');

    say('\n═══ 5 · เครื่องที่เปลี่ยนสายใหม่กว่าคลาวด์ต้องชนะและดันขึ้นคลาวด์ ═══');
    await page.evaluate(() => { window.__CA.rows['wordbank/cls1'].classId = 'slayer'; window.__CA.rows['wordbank/cls1'].classAt = 1; });
    await leave(page);
    await page.evaluate(() => { window.__CA.rows['wordbank/cls1'].classId = 'slayer'; window.__CA.rows['wordbank/cls1'].classAt = 1; });
    const rA3 = await tryLogin(page, 'cls1', 'pw1234', 2800);
    ok('เข้าเกมได้', rA3.inGame, rA3.err);
    await sleep(800);
    eq('ยังเป็น priest (classAt ในเครื่องใหม่กว่า)', await page.evaluate(() => G.classId), 'priest');
    eq('คลาวด์ถูกดันกลับเป็น priest', await page.evaluate(() => window.__CA.rows['wordbank/cls1'].classId), 'priest');

    say('\n═══ 6 · ไม่มี pageerror · ไม่ล้น ═══');
    eq('pageerror = 0', errs.length, 0);
    ok('ไม่ล้นแนวนอน', await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
    if (errs.length) say('  ' + errs.join('\n  '));
  } catch (e) { FAIL++; say('✗ พัง: ' + (e && e.stack || e)); }

  await browser.close();
  say('\n══════════════════════════════════════');
  say('ผ่าน ' + PASS + ' · ตก ' + FAIL);
  if (FAILS.length) say('ตก: ' + FAILS.join(' | '));
  process.exit(FAIL ? 1 : 0);
})();
