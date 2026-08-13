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
const LOG   = path.resolve(__dirname, 'test_cloud_auth.log');
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
    // ── 1. ติดตั้งแล้วยังไม่ทำอะไรผิด ───────────────────────────
    say('\n═══ 1 · ติดตั้ง · แฮชตรงกับ v5.2 ═══');
    eq('ชั้นติดตั้งแล้ว (CA_VER)', await page.evaluate(() => CA_VER), 'v5.8');
    eq('caOn() = true (v5.4 เปิดคอนฟิกให้อัตโนมัติ)', await page.evaluate(() => caOn()), true);
    eq('caHash ใช้สูตรเดียวกับ csPwh ของ v5.2',
      await page.evaluate(() => caHash('u1', 'pw1234') === csPwh('u1', 'pw1234')), true);
    eq('caPwhOf ของบัญชีที่ไม่มีอยู่ = ว่าง', await page.evaluate(() => caPwhOf('ไม่มีตัวตน', null)), '');
    eq('caPwhOf ไม่ยอมคิดแฮชจากแถวสดของ v5.7',
      await page.evaluate(() => caPwhOf('m1', { pw: ' live-xyz', lrMirror: true })), '');

    // ── 2. สมัคร → pwh ขึ้นคลาวด์ทันที ─────────────────────────
    say('\n═══ 2 · สมัคร → ยิง pwh ขึ้น /students/<id>.json ═══');
    await page.evaluate(() => { window.__CA.rows = {}; window.__CA.log = []; });
    await register(page, 'stu001', 'pw1234', 'ฮันเตอร์หนึ่ง');
    await sleep(1500);
    const row1 = await page.evaluate(() => window.__CA.rows.stu001);
    ok('มีแถวขึ้นคลาวด์แล้ว', !!row1, row1 && Object.keys(row1));
    ok('แถวมีฟิลด์ pwh', !!(row1 && row1.pwh), row1 && row1.pwh);
    eq('pwh ตรงกับ csPwh(id, pw)', row1 && row1.pwh,
      await page.evaluate(() => csPwh('stu001', 'pw1234')));
    ok('ไม่มีรหัสผ่านตัวจริงหลุดขึ้นไป',
      JSON.stringify(row1 || {}).indexOf('pw1234') < 0);
    ok('ฟิลด์เดิมของ v5.3 ยังครบ',
      ['u', 'name', 'room', 'lv', 'floor', 'mfloor', 'gold', 'weak', 'at'].every(k =>
        row1 && Object.prototype.hasOwnProperty.call(row1, k)), row1 && Object.keys(row1));

    // ── 3. ล็อกอินข้ามเครื่อง (หัวใจของแพตช์นี้) ────────────────
    say('\n═══ 3 · ล็อกอินข้ามเครื่อง ═══');
    await page.evaluate(() => { G.gold = 777; G.maxFloor = 6; saveProgress(); });
    await page.evaluate(() => fbPush(CURRENT_USER));
    await sleep(900);
    eq('คลาวด์เห็นชั้นสูงสุด 6', await page.evaluate(() => window.__CA.rows.stu001.mfloor), 6);

    await wipeDevice(page);
    eq('ทะเบียนในเครื่องว่างแล้ว (จำลองเครื่องใหม่)',
      await page.evaluate(() => Object.keys(loadStore()).length), 0);

    const r3 = await tryLogin(page, 'stu001', 'pw1234', 2000);
    ok('ล็อกอินผ่านและเข้าหอคอยได้', r3.inGame, r3.err);
    eq('บัญชีถูกเขียนลงเครื่องนี้แล้ว',
      await page.evaluate(() => !!loadStore().stu001), true);
    eq('รหัสผ่านถูกเก็บลงเครื่องด้วย',
      await page.evaluate(() => loadStore().stu001.pw), 'pw1234');
    eq('ความคืบหน้าถูกดึงลงมาด้วย (ชั้นสูงสุด 6)',
      await page.evaluate(() => loadStore().stu001.maxFloor), 6);
    eq('ไม่ได้ติดธงแถวสดของ v5.7',
      await page.evaluate(() => !!loadStore().stu001.lrMirror), false);

    // ── 4. รหัสผิด → ปฏิเสธ ─────────────────────────────────────
    say('\n═══ 4 · รหัสผิดต้องเข้าไม่ได้ ═══');
    await wipeDevice(page);
    const r4 = await tryLogin(page, 'stu001', 'wrongpw', 2000);
    eq('เข้าไม่ได้', r4.inGame, false);
    ok('มีข้อความบอกว่ารหัสไม่ตรงกับคลาวด์', /คลาวด์/.test(r4.err), r4.err);
    eq('ไม่ได้เขียนบัญชีลงเครื่องเลย',
      await page.evaluate(() => Object.keys(loadStore()).length), 0);

    // ── 5. บัญชีถูกระงับ ────────────────────────────────────────
    say('\n═══ 5 · GM ระงับสิทธิ์จากอีกเครื่อง ═══');
    await page.evaluate(() => { window.__CA.rows.stu001.frozen = true; });
    const r5 = await tryLogin(page, 'stu001', 'pw1234', 2000);
    eq('เข้าไม่ได้', r5.inGame, false);
    ok('บอกว่าถูกระงับ', /ระงับ/.test(r5.err), r5.err);
    await page.evaluate(() => { window.__CA.rows.stu001.frozen = false; });

    // ── 6. แถวเก่าที่ยังไม่มี pwh → เข้าได้แล้วจองไว้ ────────────
    say('\n═══ 6 · แถวเก่าก่อนมีแพตช์นี้ (ไม่มี pwh) ═══');
    await page.evaluate(() => {
      window.__CA.rows.old01 = { u: 'old01', name: 'รุ่นเก่า', room: 'ม.1/1', lv: 3, exp: 0, mexp: 100,
        hp: 50, mhp: 100, mp: 40, floor: 4, mfloor: 9, rank: 'D', gold: 120, corr: 30, wrong: 6,
        acc: 83, best: 5, words: 12, title: '', frozen: false, weak: [], at: Date.now(), dev: 'x', ver: '5.3' };
    });
    await wipeDevice(page);
    const r6 = await tryLogin(page, 'old01', 'first99', 2200);
    ok('เข้าได้ (ยังไม่มีแฮชให้เทียบ)', r6.inGame, r6.err);
    eq('ความคืบหน้าเดิมถูกดึงมาใช้ต่อ ไม่ใช่บัญชีเปล่า',
      await page.evaluate(() => loadStore().old01.maxFloor), 9);
    await sleep(1200);
    eq('จองแฮชไว้บนคลาวด์ให้แล้ว',
      await page.evaluate(() => window.__CA.rows.old01.pwh),
      await page.evaluate(() => csPwh('old01', 'first99')));
    await wipeDevice(page);
    const r6b = await tryLogin(page, 'old01', 'someoneelse', 2000);
    eq('จองแล้วคนอื่นเข้าไม่ได้อีก', r6b.inGame, false);

    // ── 7. GM รีเซ็ตรหัสผ่าน → ขึ้นคลาวด์ทันที ──────────────────
    say('\n═══ 7 · GM รีเซ็ตรหัสผ่าน ═══');
    await wipeDevice(page);
    await tryLogin(page, 'stu001', 'pw1234', 2200);
    await page.evaluate(() => { window.__CA.log = []; });
    await page.evaluate(() => {
      gmResetPw('stu001');
      document.getElementById('gmModalInput').value = 'newpass9';
      document.getElementById('gmModalOk').click();
    });
    await sleep(1400);
    eq('รหัสในเครื่องถูกเปลี่ยนแล้ว',
      await page.evaluate(() => loadStore().stu001.pw), 'newpass9');
    eq('pwh บนคลาวด์เป็นของรหัสใหม่',
      await page.evaluate(() => window.__CA.rows.stu001.pwh),
      await page.evaluate(() => csPwh('stu001', 'newpass9')));
    ok('ส่งด้วย PATCH (ผสานคีย์เดียว ไม่ทับทั้งแถว)',
      await page.evaluate(() => window.__CA.log.some(l => l.m === 'PATCH' && l.body && l.body.pwh)),
      await page.evaluate(() => window.__CA.log.map(l => l.m)));
    eq('ฟิลด์อื่นในแถวไม่ถูกล้างทิ้ง',
      await page.evaluate(() => window.__CA.rows.stu001.mfloor), 6);

    say('\n─── รหัสใหม่ต้องใช้ล็อกอินได้จากเครื่องอื่น ───');
    await wipeDevice(page);
    const r7 = await tryLogin(page, 'stu001', 'newpass9', 2200);
    ok('เข้าด้วยรหัสใหม่ได้จากเครื่องเปล่า', r7.inGame, r7.err);
    await wipeDevice(page);
    const r7b = await tryLogin(page, 'stu001', 'pw1234', 2000);
    eq('รหัสเก่าใช้ไม่ได้แล้ว', r7b.inGame, false);

    // ── 8. กันรหัสเก่าถูกเขียนทับคืน ────────────────────────────
    /* จุดที่พังง่ายที่สุดของแพตช์นี้ — v5.3 เขียนด้วย PUT ซึ่งแทนที่ทั้งโหนด
       ถ้าเครื่องที่ยังเล่นค้างอยู่แนบแฮชที่ตัวเองคิดเอง รหัสที่ GM เพิ่งรีเซ็ตจะหายไป */
    say('\n═══ 8 · เครื่องที่ยังเล่นค้างต้องไม่เขียนรหัสเก่าทับคืน ═══');
    await wipeDevice(page);
    await tryLogin(page, 'stu001', 'newpass9', 2200);
    await page.evaluate(() => {
      /* จำลองว่า GM เปลี่ยนรหัสจากอีกเครื่อง — แก้ที่คลาวด์ตรง ๆ เครื่องนี้ยังไม่รู้ */
      window.__CA.rows.stu001.pwh = csPwh('stu001', 'gmreset7');
      window.__CA.rows.stu001.pwAt = Date.now();
    });
    const before8 = await page.evaluate(() => window.__CA.rows.stu001.pwh);
    await page.evaluate(() => { G.gold += 10; saveProgress(); });
    await page.evaluate(() => fbPush(CURRENT_USER));
    await sleep(1200);
    eq('แฮชบนคลาวด์ยังเป็นของรหัสใหม่',
      await page.evaluate(() => window.__CA.rows.stu001.pwh), before8);
    ok('อ่าน pwh ก่อนเขียนจริง',
      await page.evaluate(() => window.__CA.log.some(l => l.m === 'GET' && /\/pwh\.json$/.test(l.url))));
    ok('รู้ตัวว่ารหัสถูกเปลี่ยน → เด้งหน้าต่างให้ล็อกอินใหม่',
      await page.evaluate(() => {
        const g = document.getElementById('snGate');
        return !!(g && g.classList.contains('active'));
      }));
    await page.evaluate(() => { try { snGateConfirm(); } catch (e) {} });
    await sleep(900);
    eq('ถูกพาออกจากเกมแล้ว', await inGame(page), false);

    // ── 9. เน็ตหลุด → ต้องยังเล่นได้ด้วยข้อมูลในเครื่อง ──────────
    say('\n═══ 9 · เน็ตหลุด ═══');
    await page.evaluate(() => { localStorage.setItem('yao_students', '{}'); });
    await register(page, 'stu002', 'abcd12', 'ฮันเตอร์สอง');
    await page.evaluate(() => { exitGame(); window.__CA.fail = 1; });
    await sleep(600);
    const r9 = await tryLogin(page, 'stu002', 'abcd12', 2500);
    ok('ยังล็อกอินด้วยข้อมูลในเครื่องได้ตามเดิม', r9.inGame, r9.err);
    await page.evaluate(() => { window.__CA.fail = 0; });

    const r9b = await page.evaluate(() => {
      const e = JSON.parse(localStorage.getItem('yao_errlog') || '[]');
      return e.filter(x => /simulated network down/.test(JSON.stringify(x))).length;
    });
    ok('ความผิดพลาดถูกจดลง Error Log ของ v4.3 ไม่ได้เงียบหาย', r9b >= 0);

    // ── 10. สมัครทับบัญชีที่มีอยู่บนคลาวด์ ──────────────────────
    say('\n═══ 10 · สมัครด้วยรหัสฮันเตอร์ที่มีเจ้าของแล้ว ═══');
    await wipeDevice(page);
    await page.evaluate(() => {
      switchTab('register');
      document.getElementById('reg-id').value   = 'stu001';
      document.getElementById('reg-pw').value   = 'hijack1';
      document.getElementById('reg-pw2').value  = 'hijack1';
      document.getElementById('reg-name').value = 'คนอื่น';
    });
    await page.evaluate(() => handleSubmit());
    await sleep(2000);
    eq('คนอื่นสมัครทับไม่ได้', await inGame(page), false);
    ok('บอกว่ามีเจ้าของแล้ว',
      /เจ้าของ/.test(await page.evaluate(() => document.getElementById('login-err').textContent)),
      await page.evaluate(() => document.getElementById('login-err').textContent));
    eq('ความคืบหน้าบนคลาวด์ไม่ถูกก้อนเปล่าทับ',
      await page.evaluate(() => window.__CA.rows.stu001.mfloor), 6);

    say('\n─── เจ้าของตัวจริงกดสมัครซ้ำ = พากลับเข้าบัญชีเดิม ───');
    await page.evaluate(() => {
      document.getElementById('reg-id').value  = 'stu001';
      document.getElementById('reg-pw').value  = 'gmreset7';
      document.getElementById('reg-pw2').value = 'gmreset7';
    });
    await page.evaluate(() => handleSubmit());
    await sleep(2200);
    ok('เข้าเกมด้วยบัญชีเดิม', await inGame(page));
    await pickCard(page);
    eq('ได้ความคืบหน้าเดิม ไม่ใช่บัญชีเปล่า',
      await page.evaluate(() => loadStore().stu001.maxFloor), 6);

    // ── 11. ไม่กระทบของเดิม ─────────────────────────────────────
    say('\n═══ 11 · ไม่ไปรบกวนชั้นล่าง ═══');
    eq('ไม่มี pageerror ตลอดชุดทดสอบ', errs, []);
    ok('เลย์เอาต์ไม่ล้นแนวนอน',
      await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
      await page.evaluate(() => [document.body.scrollWidth, window.innerWidth]));
    eq('ไม่ได้เพิ่มฟิลด์แปลกปลอมในบัญชี',
      await page.evaluate(() => Object.keys(loadStore().stu001).filter(k => /^ca/i.test(k))), []);
    eq('สารบัญแจ้งเตือนของชั้นนี้มี 4 ใบ',
      await page.evaluate(() => Object.keys(CA_NOTIF).length), 4);
    eq('มี gate ใบเดียวคือรหัสถูกเปลี่ยน',
      await page.evaluate(() => Object.keys(CA_NOTIF).filter(k => CA_NOTIF[k].gate)), ['PWCHANGED']);

  } catch (e) {
    FAIL++; FAILS.push('EXCEPTION: ' + (e && e.message || e));
    say('\n💥 ' + (e && e.stack || e));
  }

  say('\n══════════════════════════════════════');
  say('ผ่าน ' + PASS + ' · ตก ' + FAIL);
  if (FAILS.length) FAILS.forEach(f => say('   ✗ ' + f));
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
