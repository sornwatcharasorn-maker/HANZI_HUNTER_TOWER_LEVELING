/* ═══════════════════════════════════════════════════════════════════
   ชุดทดสอบชั้นที่สิบหก — v5.3 · FIREBASE GM REALTIME
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_fb_realtime.js

   ไม่ต้องมี Firebase จริง — ใช้ RTDB ปลอมที่เขียนทับ window.fetch และ
   window.EventSource ผ่าน page.addInitScript (ต้องติดตั้ง "ก่อน" หน้าโหลด
   เพราะ fbInstall ผูก listener ตั้งแต่ตอนโหลด)

   window.__FB.log  — คำขอ REST ทุกครั้ง { m, url, body }
   window.__FB.fail — ตั้งเป็น 1 เพื่อจำลองเน็ตหลุด
   window.__FB.es   — EventSource ตัวล่าสุดที่ถูกเปิด (มี .emit(type, data))
   ═══════════════════════════════════════════════════════════════════ */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'test_fb_realtime.log');
const FBURL = 'https://fake-rtdb.test';

let PASS = 0, FAIL = 0;
const FAILS = [];
try { fs.unlinkSync(LOG); } catch (e) {}
const say = m => { fs.appendFileSync(LOG, m + '\n'); process.stdout.write(m + '\n'); };
const ok  = (n, c, extra) => {
  if (c) { PASS++; say('  ✓ ' + n); }
  else   { FAIL++; FAILS.push(n); say('  ✗ ' + n + (extra != null ? '   → ' + JSON.stringify(extra) : '')); }
};
const eq  = (n, a, b) => ok(n + '  [' + JSON.stringify(a) + ' = ' + JSON.stringify(b) + ']', JSON.stringify(a) === JSON.stringify(b));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── RTDB ปลอม ─────────────────────────────────────────────────── */
const FAKE = (base) => `
  (function () {
    const S = { rows: {}, log: [], fail: 0, es: null, esOpened: 0, esClosed: 0, base: ${JSON.stringify(base)} };
    window.__FB = S;

    const _fetch = window.fetch;
    window.fetch = function (url, opt) {
      const u = String(url && url.url ? url.url : url);
      if (u.indexOf(S.base) !== 0) return _fetch.apply(this, arguments);
      const o = opt || {};
      const m = (o.method || 'GET').toUpperCase();
      S.log.push({ m: m, url: u, body: o.body ? JSON.parse(o.body) : null });
      if (S.fail) return Promise.reject(new Error('simulated network down'));

      const nodeAndPath = u.slice(S.base.length).replace(/\\?.*$/, '').replace(/\\.json$/, '');
      const seg = nodeAndPath.split('/').filter(Boolean);   /* [node, user?] */
      const user = seg[1] ? decodeURIComponent(seg[1]) : null;

      let out = null;
      if (m === 'PUT' && user)      { S.rows[user] = o.body ? JSON.parse(o.body) : null; out = S.rows[user]; }
      else if (m === 'DELETE' && user) { delete S.rows[user]; out = null; }
      else if (m === 'GET') {
        if (user) out = S.rows[user] || null;
        else if (/shallow=true/.test(u)) { out = {}; Object.keys(S.rows).forEach(k => out[k] = true); }
        else out = S.rows;
      }
      return Promise.resolve(new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };

    /* EventSource ปลอม — ทดสอบ path semantics ของ RTDB ได้โดยไม่ต้องมีเซิร์ฟเวอร์ */
    function FakeES(url) {
      this.url = url; this.readyState = 0; this._h = {};
      this.onopen = null; this.onerror = null; this.onmessage = null;
      S.es = this; S.esOpened++;
      const self = this;
      setTimeout(function () {
        if (self.readyState === 2) return;
        self.readyState = 1;
        if (self.onopen) self.onopen({});
      }, 0);
    }
    FakeES.prototype.addEventListener = function (t, fn) { (this._h[t] = this._h[t] || []).push(fn); };
    FakeES.prototype.removeEventListener = function (t, fn) {
      const a = this._h[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    };
    FakeES.prototype.close = function () { this.readyState = 2; S.esClosed++; };
    FakeES.prototype.emit = function (t, data) {
      (this._h[t] || []).forEach(fn => fn({ data: typeof data === 'string' ? data : JSON.stringify(data) }));
    };
    FakeES.prototype.die = function () { this.readyState = 2; if (this.onerror) this.onerror({}); };
    FakeES.CONNECTING = 0; FakeES.OPEN = 1; FakeES.CLOSED = 2;
    window.EventSource = FakeES;
  })();
`;

/* ── ตัวช่วยเข้าเกม ─────────────────────────────────────────────── */
async function register(page, id, pw) {
  await page.evaluate(() => enterGate());
  await sleep(650);
  await page.evaluate(() => switchTab('register'));
  await page.evaluate(([i, p]) => {
    document.getElementById('reg-id').value  = i;
    document.getElementById('reg-pw').value  = p;
    document.getElementById('reg-pw2').value = p;
  }, [id, pw]);
  await page.evaluate(() => handleSubmit());
  await page.waitForFunction(() => document.getElementById('gameScreen').classList.contains('active'), { timeout: 8000 });
  await pickCard(page);
}

/* หน้าต่างจั่วการ์ดของ v4.7 คั่นอยู่ — ต้องเลือกให้จบก่อนเสมอ ไม่งั้นเกมค้างหยุดโดยชอบธรรม */
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

async function cfgOn(page, extra) {
  await page.evaluate(([url, ex]) => {
    fbCfgSave(Object.assign({ on: true, url: url, node: 'students', auth: '', pub: true }, ex || {}));
  }, [FBURL, extra || {}]);
}

/* ═══════════════════════════════════════════════════════════════ */
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.addInitScript(FAKE(FBURL));
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(700);

  try {
    // ── 1. ยังไม่ตั้งค่า = เงียบสนิท ────────────────────────────
    say('\n═══ 1 · ยังไม่ตั้งค่า → ต้องเงียบสนิท ═══');
    eq('คอนฟิกเริ่มต้น on = false', await page.evaluate(() => FB_CFG.on), false);
    eq('โหนดเริ่มต้น = students', await page.evaluate(() => FB_CFG.node), 'students');
    eq('fbOn() = false', await page.evaluate(() => fbOn()), false);
    eq('ไม่มี URL ฝังในซอร์ส', await page.evaluate(() => FB_CFG.url), '');

    await register(page, 'stu001', 'pw1234');
    await page.evaluate(() => saveProgress());
    await sleep(6600);
    eq('ไม่มีคำขอออกเน็ตแม้แต่ครั้งเดียว', await page.evaluate(() => window.__FB.log.length), 0);

    await page.evaluate(() => openGm());
    await sleep(200);
    eq('ไม่เปิด EventSource ตอนกางแผง GM', await page.evaluate(() => window.__FB.esOpened), 0);
    ok('#fbLive ถูกซ่อนไว้', await page.evaluate(() => {
      const b = document.getElementById('fbLive');
      return !!b && b.style.display === 'none';
    }));
    await page.evaluate(() => closeGm());

    // ── 2. คอนฟิก + ตัวกันชนกับ v5.2 ──────────────────────────
    say('\n═══ 2 · คอนฟิก · ตัวกันชนกับ CLOUD SYNC ═══');
    await cfgOn(page);
    eq('เปิดแล้ว fbOn() = true', await page.evaluate(() => fbOn()), true);
    eq('เก็บที่ localStorage yao_fbrt', await page.evaluate(() =>
      JSON.parse(localStorage.getItem('yao_fbrt')).url), FBURL);
    eq('URL ตัด .json / ท้าย ทิ้ง', await page.evaluate(() => {
      fbCfgSave({ url: 'https://x.test/' }); const u = FB_CFG.url; fbCfgSave({ url: 'https://fake-rtdb.test' }); return u;
    }), 'https://x.test');

    await page.evaluate(() => csCfgSave({ provider: 'firebase', url: 'https://fake-rtdb.test', key: '', table: 'students' }));
    eq('ชื่อโหนดชนกับ v5.2 → fbClash() = true', await page.evaluate(() => fbClash()), true);
    eq('ชนแล้วต้องปิดตัวเอง fbOn() = false', await page.evaluate(() => fbOn()), false);
    await page.evaluate(() => csCfgSave({ provider: '', url: '', key: '', table: 'hunters' }));
    eq('ปิด v5.2 แล้วหายชน', await page.evaluate(() => fbClash()), false);
    eq('กลับมาทำงาน fbOn() = true', await page.evaluate(() => fbOn()), true);

    // ── 3. ผู้เผยแพร่ฝั่งนักเรียน — หน่วง 6 วินาที ───────────────
    say('\n═══ 3 · Student Publisher · หน่วง 6 วินาที ═══');
    await page.evaluate(() => { window.__FB.log = []; window.__FB.rows = {}; });
    await page.evaluate(() => { saveProgress(); saveProgress(); saveProgress(); });
    await sleep(1200);
    eq('ยังไม่ส่งภายใน ~1 วิ (หน่วงอยู่)', await page.evaluate(() => window.__FB.log.length), 0);
    ok('มีนาฬิกาหน่วงตั้งค้างไว้', await page.evaluate(() => FB_T !== null));
    await sleep(5800);
    eq('ยิงรวดเดียวหลังครบ 6 วิ (ยุบ 3 ครั้งเป็น 1)', await page.evaluate(() => window.__FB.log.length), 1);
    eq('เป็น PUT', await page.evaluate(() => window.__FB.log[0].m), 'PUT');
    ok('ยิงไปที่ /students/<รหัสฮันเตอร์>.json', await page.evaluate(() =>
      /\/students\/stu001\.json$/.test(window.__FB.log[0].url)),
      await page.evaluate(() => window.__FB.log[0].url));

    const pay = await page.evaluate(() => window.__FB.rows.stu001);
    ok('payload มีครบทุกฟิลด์ที่จอครูต้องใช้', ['u','name','room','lv','exp','mexp','floor','mfloor','acc','gold','corr','wrong','words','weak','at']
      .every(k => pay && Object.prototype.hasOwnProperty.call(pay, k)), Object.keys(pay || {}));
    eq('u = รหัสฮันเตอร์', pay.u, 'stu001');
    ok('weak เป็นอาร์เรย์', Array.isArray(pay.weak));
    ok('payload เล็ก (< 3KB) — ไม่ใช่บัญชีทั้งก้อน',
      JSON.stringify(pay).length < 3000, JSON.stringify(pay).length);
    ok('ไม่มีรหัสผ่านหลุดขึ้นคลาวด์',
      !/"pw"/.test(JSON.stringify(pay)) && !/pw1234/.test(JSON.stringify(pay)));

    // ── 4. ความถูกต้องของตัวเลขใน payload ────────────────────────
    say('\n═══ 4 · ความถูกต้องของตัวเลข ═══');
    await page.evaluate(() => {
      const s = loadStore(); const a = s[CURRENT_USER];
      a.correct = 80; a.wrong = 20; a.maxFloor = 12; a.level = 7; a.exp = 55;
      a.wordStats = { '1': { seen: 9, wrong: 5 }, '2': { seen: 4, wrong: 3 }, '3': { seen: 3, wrong: 1 } };
      localStorage.setItem('yao_students', JSON.stringify(s));
      window.__FB.log = [];
    });
    await page.evaluate(() => fbPush(CURRENT_USER));
    await sleep(300);
    const p2 = await page.evaluate(() => window.__FB.rows.stu001);
    eq('ความแม่นยำ 80/100 = 80%', p2.acc, 80);
    eq('ชั้นสูงสุด', p2.mfloor, 12);
    eq('เลเวล', p2.lv, 7);
    eq('EXP', p2.exp, 55);
    eq('คำที่ผิดซ้ำ (wrong >= 2) มี 2 คำ', p2.weak.length, 2);
    eq('เรียงจากผิดมากสุดก่อน', p2.weak.map(w => w.n), [5, 3]);
    ok('แนบอักษรจีน + พินอินไปด้วย', !!p2.weak[0].ch && !!p2.weak[0].py, p2.weak[0]);
    ok('เพดาน FB_WEAK_MAX', await page.evaluate(() => FB_WEAK_MAX) === 8);

    // ── 5. เน็ตหลุด → backoff แล้วส่งต่อเมื่อกลับมา ───────────────
    say('\n═══ 5 · เน็ตหลุด · backoff ═══');
    await page.evaluate(() => { window.__FB.fail = 1; window.__FB.log = []; });
    await page.evaluate(() => fbPush(CURRENT_USER));
    await sleep(400);
    eq('สถานะเป็น err', await page.evaluate(() => FB_ST), 'err');
    ok('มีข้อความบอกเหตุ', await page.evaluate(() => FB_MSG.length > 0));
    ok('ตั้งคิวส่งใหม่ไว้ (backoff)', await page.evaluate(() => FB_T !== null));
    ok('ธง dirty ถูกยกกลับมา', await page.evaluate(() => FB_DIRTY === true));
    await page.evaluate(() => { window.__FB.fail = 0; });
    await sleep(4600);
    eq('ส่งสำเร็จเองหลัง backoff', await page.evaluate(() => FB_ST), 'ok');
    eq('เกมไม่พังเพราะคลาวด์', errs.length, 0, errs);

    // ── 6. ออกจากเกม = ส่งทันที ไม่รอหน่วง ───────────────────────
    say('\n═══ 6 · ออกจากเกม → ส่งทันที ═══');
    await page.evaluate(() => { window.__FB.log = []; });
    await page.evaluate(() => exitGame());
    await sleep(500);
    ok('มี PUT ออกไปตอนออกจากเกม', await page.evaluate(() =>
      window.__FB.log.filter(l => l.m === 'PUT').length >= 1),
      await page.evaluate(() => window.__FB.log.length));
    ok('ยังส่งด้วยรหัสฮันเตอร์ที่ถูกต้อง', await page.evaluate(() =>
      window.__FB.log.some(l => /\/students\/stu001\.json/.test(l.url))));

    // ── 7. ปลดสวิตช์เผยแพร่ = เครื่องครูล้วนต้องเงียบ ─────────────
    say('\n═══ 7 · เครื่องครูล้วน (pub = false) ═══');
    await page.evaluate(() => enterGate());
    await sleep(650);
    await page.evaluate(() => switchTab('login'));
    await page.evaluate(() => {
      document.getElementById('login-id').value = 'stu001';
      document.getElementById('login-pw').value = 'pw1234';
      handleSubmit();
    });
    await page.waitForFunction(() => document.getElementById('gameScreen').classList.contains('active'), { timeout: 8000 });
    await pickCard(page);
    await page.evaluate(() => { fbCfgSave({ pub: false }); window.__FB.log = []; });
    await page.evaluate(() => saveProgress());
    await sleep(6600);
    eq('ไม่ส่งอะไรเลยเมื่อปลดสวิตช์เผยแพร่', await page.evaluate(() => window.__FB.log.length), 0);
    await page.evaluate(() => fbCfgSave({ pub: true }));

    // ── 8. ผู้รับฟังฝั่งครู — เปิด/ปิดตามแผง GM ────────────────────
    say('\n═══ 8 · GM Live Monitor · เปิดตอนกาง ปิดตอนพับ ═══');
    await page.evaluate(() => { window.__FB.esOpened = 0; window.__FB.esClosed = 0; });
    await page.evaluate(() => openGm());
    await sleep(200);
    eq('กางแผง GM → เปิด EventSource 1 สาย', await page.evaluate(() => window.__FB.esOpened), 1);
    ok('ต่อไปที่ /students.json', await page.evaluate(() => /\/students\.json/.test(window.__FB.es.url)),
      await page.evaluate(() => window.__FB.es.url));
    eq('สถานะสาย = live', await page.evaluate(() => FB_MST), 'live');
    ok('ตารางสดโผล่ขึ้นมา', await page.evaluate(() => {
      const b = document.getElementById('fbLive'); return !!b && b.style.display !== 'none';
    }));

    await page.evaluate(() => closeGm());
    await sleep(150);
    eq('พับแผง → ตัดสายทันที', await page.evaluate(() => window.__FB.esClosed), 1);
    eq('FB_ES ถูกล้าง', await page.evaluate(() => FB_ES === null), true);
    eq('คืน RAM — ล้างข้อมูลที่ถือไว้', await page.evaluate(() => Object.keys(FB_LIVE).length), 0);
    eq('นาฬิการีเฟรชถูกหยุด', await page.evaluate(() => FB_TICK === null), true);

    // ── 9. path semantics ของ RTDB (put / patch) ─────────────────
    say('\n═══ 9 · put / patch · path semantics ═══');
    await page.evaluate(() => openGm());
    await sleep(150);
    const mk = (u, o) => Object.assign({ u, name: u, room: 'ม.4', lv: 1, exp: 0, mexp: 100,
      floor: 1, mfloor: 1, rank: 'F', gold: 0, corr: 0, wrong: 0, acc: 0, words: 0, weak: [], at: Date.now() }, o || {});

    await page.evaluate(rows => window.__FB.es.emit('put', { path: '/', data: rows }), {
      a1: mk('a1', { lv: 5, mfloor: 9, acc: 71, exp: 40 }),
      a2: mk('a2', { lv: 2, mfloor: 3, acc: 33 })
    });
    await sleep(120);
    eq('put ที่ราก = แทนที่ทั้งก้อน', await page.evaluate(() => Object.keys(FB_LIVE).sort()), ['a1', 'a2']);

    await page.evaluate(row => window.__FB.es.emit('put', { path: '/a3', data: row }), mk('a3', { lv: 9, mfloor: 17 }));
    await sleep(120);
    eq('put รายคน = เพิ่มคนใหม่', await page.evaluate(() => Object.keys(FB_LIVE).length), 3);

    await page.evaluate(() => window.__FB.es.emit('put', { path: '/a2', data: null }));
    await sleep(120);
    eq('put ค่า null = ลบคนนั้นออก', await page.evaluate(() => Object.keys(FB_LIVE).sort()), ['a1', 'a3']);

    await page.evaluate(() => window.__FB.es.emit('put', { path: '/a1/gold', data: 4321 }));
    await sleep(120);
    eq('put รายฟิลด์ = แก้เฉพาะฟิลด์', await page.evaluate(() => FB_LIVE.a1.gold), 4321);
    eq('ฟิลด์อื่นไม่ถูกแตะ', await page.evaluate(() => FB_LIVE.a1.lv), 5);

    await page.evaluate(() => window.__FB.es.emit('patch', { path: '/a1', data: { acc: 88, exp: 90 } }));
    await sleep(120);
    eq('patch = ผสมเฉพาะคีย์ที่ส่งมา', await page.evaluate(() => [FB_LIVE.a1.acc, FB_LIVE.a1.exp, FB_LIVE.a1.gold]), [88, 90, 4321]);

    await page.evaluate(() => window.__FB.es.emit('patch', { path: '/', data: { a4: { u: 'a4', name: 'a4', room: 'ม.4', lv: 3, mfloor: 2, acc: 10, weak: [], at: Date.now() } } }));
    await sleep(120);
    eq('patch ที่ราก = ผสมรายคน', await page.evaluate(() => Object.keys(FB_LIVE).sort()), ['a1', 'a3', 'a4']);
    ok('ข้อมูลพัง (JSON เสีย) ต้องไม่ทำให้พัง', await page.evaluate(() => {
      try { window.__FB.es.emit('put', '{{{ไม่ใช่ json'); return true; } catch (e) { return false; }
    }));

    // ── 10. ตารางบนจอครู ─────────────────────────────────────────
    say('\n═══ 10 · ตารางข้อมูลสดบนจอครู ═══');
    await sleep(200);
    const tbl = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#fbBody tr'));
      return rows.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
    });
    eq('มี 3 แถวบนตาราง', tbl.length, 3);
    ok('เรียงจากชั้นสูงสุดลงมา (a3 = 17 อยู่บนสุด)', /a3/.test(tbl[0][0]), tbl.map(r => r[0]));
    ok('แสดงความแม่นยำ %', tbl.some(r => /88%/.test(r[4])), tbl.map(r => r[4]));
    ok('แสดง EXP', tbl.some(r => /90\/100/.test(r[2])), tbl.map(r => r[2]));
    ok('แสดงชั้นสูงสุด', tbl.some(r => /17/.test(r[3])), tbl.map(r => r[3]));
    ok('แสดงทองที่เพิ่งอัปเดตสด', tbl.some(r => /4321/.test(r[5])), tbl.map(r => r[5]));

    await page.evaluate(() => window.__FB.es.emit('put', {
      path: '/a1/weak', data: [{ id: 1, ch: '你', py: 'nǐ', n: 6 }, { id: 2, ch: '好', py: 'hǎo', n: 3 }]
    }));
    await sleep(200);
    const weakCell = await page.evaluate(() => {
      const tr = Array.from(document.querySelectorAll('#fbBody tr')).find(t => /a1/.test(t.textContent));
      return tr ? tr.querySelectorAll('td')[7].textContent.replace(/\s+/g, '') : '';
    });
    ok('คำที่ผิดซ้ำรายคนขึ้นบนตาราง', /你6/.test(weakCell) && /好3/.test(weakCell), weakCell);

    ok('แถวที่เพิ่งขยับได้คลาสไฮไลต์', await page.evaluate(() =>
      document.querySelectorAll('#fbBody tr.fb-hot').length > 0));

    // กรองด้วยกลุ่มห้องเรียนของ v4.3
    await page.evaluate(() => window.__FB.es.emit('put', {
      path: '/a3/room', data: 'ม.5'
    }));
    await page.evaluate(() => { GC_ROOM = 'ม.4'; fbPaint(); });
    await sleep(150);
    eq('กรองตามกลุ่มห้องเรียนที่ครูเลือก', await page.evaluate(() =>
      document.querySelectorAll('#fbBody tr').length), 2);
    await page.evaluate(() => { GC_ROOM = ''; fbPaint(); });

    // กรองด้วยช่องค้นหาของ v4.0
    await page.evaluate(() => { document.getElementById('gmSearch').value = 'a4'; fbPaint(); });
    await sleep(150);
    eq('กรองตามช่องค้นหา', await page.evaluate(() =>
      document.querySelectorAll('#fbBody tr').length), 1);
    await page.evaluate(() => { document.getElementById('gmSearch').value = ''; fbPaint(); });

    // ── 11. สายหลุด → ต่อกลับเอง ─────────────────────────────────
    say('\n═══ 11 · สายหลุด → ต่อกลับเอง ═══');
    await page.evaluate(() => { window.__FB.esOpened = 0; });
    await page.evaluate(() => window.__FB.es.die());
    await sleep(120);
    eq('รู้ตัวว่าสายหลุด', await page.evaluate(() => FB_MST), 'wait');
    await sleep(1400);
    eq('ต่อกลับให้เองโดยไม่ต้องกด', await page.evaluate(() => window.__FB.esOpened), 1);
    eq('กลับมา live', await page.evaluate(() => FB_MST), 'live');

    await page.evaluate(() => window.__FB.es.emit('cancel', ''));
    await sleep(150);
    eq('เซิร์ฟเวอร์สั่ง cancel → ขึ้นสถานะ err', await page.evaluate(() => FB_MST), 'err');
    ok('บอกให้ไปดู RTDB Rules', await page.evaluate(() => /\.read/.test(FB_MSG)), await page.evaluate(() => FB_MSG));

    // ปุ่มหยุด/รับต่อ
    await page.evaluate(() => { FB_MSG = ''; fbMonToggle(); });
    await sleep(120);
    ok('กดรับสัญญาณต่อได้', await page.evaluate(() => FB_ES !== null));
    await page.evaluate(() => fbMonToggle());
    await sleep(120);
    ok('กดหยุดรับสัญญาณได้', await page.evaluate(() => FB_ES === null && FB_RT === null));
    await page.evaluate(() => fbMonToggle());
    await sleep(120);

    // ── 12. แผงตั้งค่าใต้ปุ่ม ☁️ คลาวด์ ─────────────────────────────
    say('\n═══ 12 · แผงตั้งค่าใต้ปุ่ม ☁️ คลาวด์ ═══');
    await page.evaluate(() => csGmOpen());
    await sleep(200);
    ok('มีส่วนตั้งค่า v5.3 ต่อท้ายแผงคลาวด์', await page.evaluate(() => !!document.getElementById('fbForm')));
    ok('มีตัวเลือกโหมด Firebase RTDB', await page.evaluate(() =>
      /Firebase RTDB/.test(document.getElementById('fbFo').innerHTML)));
    eq('ช่อง URL โหลดค่าที่บันทึกไว้', await page.evaluate(() => document.getElementById('fbFu').value), FBURL);
    ok('placeholder ไม่มี URL จริงฝังอยู่', await page.evaluate(() =>
      /&lt;project&gt;|<project>/.test(document.getElementById('fbFu').getAttribute('placeholder'))),
      await page.evaluate(() => document.getElementById('fbFu').getAttribute('placeholder')));

    ok('ตัวอย่าง RTDB Rules อ่านออก ไม่มี &quot; โผล่', await page.evaluate(() => {
      const t = document.querySelector('#csGmBody .cs-note:last-of-type').textContent;
      return /\{ "rules": \{ "students": \{ "\.read": true, "\.write": true \} \} \}/.test(t);
    }), await page.evaluate(() => {
      const m = document.querySelector('#csGmBody .cs-note:last-of-type').textContent.match(/\{ "rules".{0,80}/);
      return m ? m[0] : '(ไม่พบ)';
    }));

    for (let i = 0; i < 6; i++) await page.evaluate(() => csGmRender());
    eq('เรียกซ้ำหลายรอบต้องไม่แทรกซ้ำ (กับดักข้อ 2)', await page.evaluate(() =>
      document.querySelectorAll('#csGmBody #fbForm').length), 1);

    await page.evaluate(() => { document.getElementById('fbFn').value = 'live_room'; fbFormSave(); });
    await sleep(150);
    eq('บันทึกชื่อโหนดใหม่ได้', await page.evaluate(() => FB_CFG.node), 'live_room');
    await page.evaluate(() => { document.getElementById('fbFn').value = 'students'; fbFormSave(); });

    await page.evaluate(() => fbFormTest());
    await sleep(400);
    ok('ปุ่มทดสอบการเชื่อมต่อรายงานผลสำเร็จ', await page.evaluate(() =>
      /เชื่อมต่อได้/.test(document.querySelector('#csGmBody .cs-msg').textContent)),
      await page.evaluate(() => (document.querySelector('#csGmBody .cs-msg') || {}).textContent));

    // โค้ดตั้งค่า
    await page.evaluate(() => fbFormCode());
    await sleep(200);
    const code = await page.evaluate(() => document.getElementById('fbFc').value);
    ok('ได้โค้ดตั้งค่าออกมา', !!code && code.length > 10, code);
    await page.evaluate(() => fbCfgSave({ on: false, url: '', node: 'students', auth: '' }));
    eq('ล้างค่าแล้ว fbOn() = false', await page.evaluate(() => fbOn()), false);
    await page.evaluate(c => { csGmRender(); document.getElementById('fbFc').value = c; fbCodeUse(); }, code);
    await sleep(200);
    eq('วางโค้ดแล้วได้ URL กลับมา', await page.evaluate(() => FB_CFG.url), FBURL);
    eq('วางโค้ดแล้วเปิดใช้งานเอง', await page.evaluate(() => fbOn()), true);
    await page.evaluate(() => csGmClose());

    // ── 13. Zero-Mutation + เลย์เอาต์ ────────────────────────────
    say('\n═══ 13 · Zero-Mutation · เลย์เอาต์ ═══');
    ok('ชั้นนี้ไม่เพิ่มฟิลด์ในบัญชีเลย', await page.evaluate(() => {
      const a = loadStore().stu001 || {};
      return !('fb' in a) && !('fbv' in a) && !('fbrt' in a);
    }));
    ok('ตาราง GM เดิมของ v4.3 ยังทำงาน', await page.evaluate(() => {
      gmRender(); return document.querySelectorAll('#gmBody tr').length >= 1;
    }));
    ok('KPI เดิมยังถูกคำนวณ', await page.evaluate(() =>
      document.getElementById('kpiStudents').textContent !== ''));
    ok('ปุ่มในคอลัมน์ ⚙️ จัดการ ยังเป็น 6 ปุ่มเท่าเดิม (กับดักข้อ 9)', await page.evaluate(() =>
      document.querySelectorAll('#gmBody tr:first-child .gm-row-btns .gm-btn').length),
      await page.evaluate(() => document.querySelectorAll('#gmBody tr:first-child .gm-row-btns .gm-btn').length));
    eq('จำนวนปุ่มจัดการ = 6', await page.evaluate(() =>
      document.querySelectorAll('#gmBody tr:first-child .gm-row-btns .gm-btn').length), 6);
    await page.evaluate(() => closeGm());

    for (const w of [320, 360, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.evaluate(() => openGm());
      await sleep(150);
      const over = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
      ok('จอ ' + w + 'px ไม่ล้นแนวนอนขณะกางแผง GM', !over,
        await page.evaluate(() => [document.body.scrollWidth, window.innerWidth]));
      await page.evaluate(() => closeGm());
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // ── 14. ปิดคลาวด์กลางคัน = ต้องเงียบทันที ─────────────────────
    say('\n═══ 14 · ปิดกลางคัน → เงียบทันที ═══');
    await page.evaluate(() => { fbCfgSave({ on: false }); window.__FB.log = []; window.__FB.esOpened = 0; });
    await page.evaluate(() => openGm());
    await sleep(200);
    eq('ปิดแล้วไม่เปิดสายอีก', await page.evaluate(() => window.__FB.esOpened), 0);
    await page.evaluate(() => saveProgress());
    await sleep(6600);
    eq('ปิดแล้วไม่ส่งอะไรอีก', await page.evaluate(() => window.__FB.log.length), 0);
    await page.evaluate(() => closeGm());

    // ── 15. ไม่มี pageerror ───────────────────────────────────────
    say('\n═══ 15 · ไม่มี pageerror ═══');
    eq('pageerror = 0', errs.length, 0, errs);
    /* บล็อก 5 จงใจทำให้เน็ตล่ม ตัวที่ถูกจดเข้า Error Log จากเหตุนั้นจึงถูกต้องแล้ว
       ที่ต้องเป็นศูนย์คือ error อื่นที่ไม่ได้ตั้งใจให้เกิด */
    const elog = await page.evaluate(() => {
      try { return (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || []).filter(e => e.ty === 'fbrt'); }
      catch (e) { return []; }
    });
    const unexpected = elog.filter(e => !/simulated network down/.test(String(e.m || '')));
    eq('Error Log ของชั้นนี้ไม่มี error ที่ไม่ได้ตั้งใจ', unexpected.length, 0, unexpected.map(e => e.m));
    ok('เน็ตล่มที่จำลองไว้ถูกจดลง Error Log อย่างถูกต้อง',
      elog.length - unexpected.length >= 1, elog.map(e => e.m));

  } catch (e) {
    FAIL++; FAILS.push('EXCEPTION: ' + (e && e.message));
    say('\n💥 EXCEPTION: ' + (e && e.stack || e));
  }

  say('\n═══════════════════════════════════');
  say('ผ่าน ' + PASS + ' · ตก ' + FAIL);
  if (FAIL) say('ที่ตก:\n  - ' + FAILS.join('\n  - '));
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
