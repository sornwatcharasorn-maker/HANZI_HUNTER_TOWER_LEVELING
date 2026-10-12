/* ═══════════════════════════════════════════════════════════════════
   ชุดทดสอบ Patch v9.36 · CLASS MID-SESSION PULL & STALE-PUSH GUARD
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_class_midsession.js

   สองบริบทเบราว์เซอร์ (มือถือ 390×844 + คอม 1280×800) ใช้คลาวด์ปลอมร่วมกัน
   ผ่าน page.exposeBinding — ตัวคลาวด์ปลอมแยกโหนด /students กับ /wordbank
   ═══════════════════════════════════════════════════════════════════ */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const FILE  = 'file://' + '/home/user/HANZI_HUNTER_TOWER_LEVELING/hanzi_hunter_tower_v3_1_intro.html';
const LOG   = '/tmp/claude-0/test_class_midsession.log';
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


const SENT = () => {
  const a = loadStore()[CURRENT_USER];
  return a;
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--disable-dev-shm-usage'] });
  // ONE shared fake cloud across two contexts via exposeBinding
  const cloud = { rows: {} };
  async function mk(vp) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('pageerror', e => say('PAGEERR ' + (e.message||e)));
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.route('**fonts.gstatic.com**', r => r.abort());
    await page.exposeBinding('__cloud', (_s, m, p, body) => {
      let seg = p.split('/').filter(Boolean); const user = seg[1] ? seg[0]+'/'+seg[1] : null; const field = seg[2]||null;
      let out = null;
      if (m==='PUT' && user) { if (field) { (cloud.rows[user]=cloud.rows[user]||{})[field]=body; } else cloud.rows[user]=body; out=body; }
      else if (m==='PATCH' && user) { cloud.rows[user]=Object.assign({},cloud.rows[user]||{},body||{}); out=body; }
      else if (m==='DELETE' && user) { delete cloud.rows[user]; }
      else if (m==='GET') { if (user&&field) out=(cloud.rows[user]||{})[field]; else if (user) out=cloud.rows[user]||null; else out=cloud.rows; }
      return out===undefined?null:out;
    });
    await page.addInitScript(`(function(){const base=${JSON.stringify(FBURL)};const _f=window.fetch;
      window.fetch=function(url,opt){const u=String(url&&url.url?url.url:url);if(u.indexOf(base)!==0)return _f.apply(this,arguments);
        const o=opt||{};const m=(o.method||'GET').toUpperCase();const p=u.slice(base.length).replace(/\\?.*$/,'').replace(/\\.json$/,'').split('/').map(decodeURIComponent).join('/');
        return window.__cloud(m,p,o.body?JSON.parse(o.body):null).then(r=>new Response(JSON.stringify(r),{status:200,headers:{'Content-Type':'application/json'}}));};
      function ES(){this.readyState=1}ES.prototype.addEventListener=function(){};ES.prototype.close=function(){};window.EventSource=ES;})();`);
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await sleep(800);
    await passGate(page);
    return page;
  }
  const A = await mk({ width: 390, height: 844 });
  const B = await mk({ width: 1280, height: 800 });
  const cls = p => p.evaluate(() => G.classId);
  const R = (t,c,x)=>{ say((c?'  ✓ ':'  ✗ ')+t+(c?'':'  → '+JSON.stringify(x))); };
  try {
    say('S1 B(คอม) สมัคร+เล่น, A(มือถือ) ล็อกอิน เปลี่ยนสาย');
    await register(B, 'cl1', 'pw1234', 'x');
    await B.evaluate(()=>{ VOCAB.slice(0,10).forEach(v=>{G.wordStats[String(v[0])]={seen:2,wrong:0,totalMs:0,lastSeen:0,recent:[]};}); G.level=4; saveProgress(); });
    await leave(B);
    const r1 = await tryLogin(A,'cl1','pw1234',2500); R('A เข้าได้', r1.inGame, r1.err);
    R('A ได้สายเริ่มต้น', (await cls(A))==='assassin', await cls(A));
    R('A เปลี่ยนเป็น guardian', await doSwitch(A,'guardian'));
    await sleep(600);
    say('S2 B ล็อกอินใหม่ (มีข้อมูลเก่า ไม่สะอาด)');
    const r2 = await tryLogin(B,'cl1','pw1234',3000); await sleep(1000);
    R('B ได้ guardian', (await cls(B))==='guardian', await cls(B));
    say('S3 A ปิดแท็บโดยไม่ออกเกม หลังเปลี่ยนเป็น priest');
    await doSwitch(A,'priest'); await sleep(800);
    R('คลาวด์เป็น priest ทันที', cloud.rows['wordbank/cl1'].classId==='priest', cloud.rows['wordbank/cl1'].classId);

    say('S4 B ปิด/เปิดหน้าใหม่ (ไม่มี silent relogin) แล้วล็อกอิน → ต้องได้ priest');
    await leave(B);
    await B.reload({waitUntil:'domcontentloaded'}); await sleep(1200); await passGate(B);
    const r4 = await tryLogin(B,'cl1','pw1234',3000); await sleep(1000);
    R('B เข้าเกมได้', r4.inGame, r4.err);
    R('B ได้ priest หลังล็อกอินใหม่', (await cls(B))==='priest', await cls(B));
    say('S5 B เปิดค้าง (priest) → A เปลี่ยนเป็น slayer → B ไม่ล็อกอินใหม่ แค่สลับแท็บกลับมา');
    await doSwitch(A,'slayer'); await sleep(800);
    R('คลาวด์เป็น slayer', cloud.rows['wordbank/cl1'].classId==='slayer', cloud.rows['wordbank/cl1'].classId);
    await B.evaluate(()=>{ document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    await sleep(4000);
    R('B ตามมาเป็น slayer โดยไม่ล็อกอินใหม่', (await cls(B))==='slayer', await cls(B));
    say('S7 เครื่อง B ค้างสายเก่า แล้ว "ออกเกม" ก่อนที่จะรู้ → ห้ามทับคลาวด์');
    await doSwitch(A,'guardian'); await sleep(800);
    R('คลาวด์เป็น guardian (จาก A)', cloud.rows['wordbank/cl1'].classId==='guardian', cloud.rows['wordbank/cl1'].classId);
    const atBefore = cloud.rows['wordbank/cl1'].classAt;
    await B.evaluate(()=>{ try{ saveProgress(); exitGame(); }catch(e){} }); await sleep(1500);
    R('คลาวด์ยังเป็น guardian หลัง B ออกเกม', cloud.rows['wordbank/cl1'].classId==='guardian', cloud.rows['wordbank/cl1'].classId);
    R('classAt บนคลาวด์ไม่ถอยหลัง', cloud.rows['wordbank/cl1'].classAt>=atBefore, [cloud.rows['wordbank/cl1'].classAt, atBefore]);
    const r7 = await tryLogin(B,'cl1','pw1234',3000); await sleep(1000);
    R('B ล็อกอินกลับมาได้ guardian', (await cls(B))==='guardian', await cls(B));
    R('A เองยังเป็น guardian', (await cls(A))==='guardian', await cls(A));
    say('S8 A เปลี่ยนสาย แล้วปิดแท็บทันที (ไม่ออกเกม) → B ล็อกอินใหม่ได้สายล่าสุด');
    await doSwitch(A,'priest'); await sleep(800);
    await leave(B);
    const r8 = await tryLogin(B,'cl1','pw1234',3000); await sleep(1000);
    R('B ได้ priest', (await cls(B))==='priest', await cls(B));
  } catch (e) { say('✗ พัง: ' + (e && e.stack || e)); }
  await browser.close();
})();
