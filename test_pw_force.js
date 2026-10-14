/* ชุดเทสต์ Patch v9.39 — GM TEMP PASSWORD → FORCED SELF-SET PASSWORD
   ตรวจครบทั้ง 6 ปุ่มใน ⚙️ จัดการ + รีเซ็ตรหัสผ่าน → หน้าบังคับตั้งรหัสใหม่
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_pw_force.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'pw_force_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}
let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(n, c, x) { if (c) { PASS++; say('  ✅ ' + n); } else { FAIL++; say('  ❌ ' + n + (x != null ? '  → ' + JSON.stringify(x) : '')); } }

/* RTDB ปลอมในหน้าเพจ: GET/PUT/PATCH/DELETE ที่ /students/<u>(.json | /<key>.json) */
const STUB = `
  window.__DB = {}; window.__LOG = [];
  window.fetch = function (u, o) {
    const m = ((o && o.method) || 'GET').toUpperCase(); u = String(u);
    const mm = u.match(/\\/students\\/([^\\/?]+?)(?:\\/([^\\/?]+?))?\\.json/);
    let out = null;
    if (mm) {
      const k = decodeURIComponent(mm[1]), sub = mm[2];
      const body = (o && o.body) ? JSON.parse(o.body) : null;
      window.__LOG.push({ m: m, k: k, sub: sub || '', body: body });
      if (m === 'GET') { const r = window.__DB[k]; out = sub ? (r ? (r[sub] === undefined ? null : r[sub]) : null) : (r || null); }
      else if (m === 'PUT') window.__DB[k] = body;
      else if (m === 'PATCH') { const r = window.__DB[k] = window.__DB[k] || {}; Object.keys(body).forEach(function (q) { if (body[q] === null) delete r[q]; else r[q] = body[q]; }); }
      else if (m === 'DELETE') delete window.__DB[k];
    }
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(out)); }, json: function () { return Promise.resolve(out); } });
  };
  window.EventSource = function (url) { this.url = url; this.readyState = 1; this.close = function () { this.readyState = 2; }; this.addEventListener = function () {}; this.removeEventListener = function () {}; };
`;
async function newPage(browser, db) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 } });
  await ctx.addInitScript(STUB);
  if (db) await ctx.addInitScript('window.__DB = ' + JSON.stringify(db) + ';');
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  page.__errs = errs;
  return page;
}
async function rules(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
}
async function openPanel(page) {
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(300);
}
async function seed(page, u, pw) {
  await page.evaluate(([u, pw]) => {
    const a = blankAccount(u, 'ณัฐ', pw, 'ม.4/2'); a.level = 5; a.gold = 100;
    const s = loadStore(); s[u] = a; saveStore(s); gmRender();
  }, [u, pw]);
  await page.waitForTimeout(150);
}
/* กดปุ่มจริงในตาราง (data-ba-u ของตารางรวม v7.8) หรือเรียกฟังก์ชันที่ปุ่มเรียก */
async function gmDo(page, fn, u, input) {
  await page.evaluate(([fn, u]) => { window[fn](u); }, [fn, u]);
  await page.waitForTimeout(120);
  if (input !== undefined) await page.evaluate(v => { const i = document.getElementById('gmModalInput'); if (i) i.value = v; }, input);
  await page.evaluate(() => document.getElementById('gmModalOk').click());
  await page.waitForTimeout(250);
}
const A = (page, u) => page.evaluate(k => { const a = loadStore()[k]; return a ? { pw: a.pw, pwTemp: a.pwTemp === true, gold: a.gold, level: a.level, frozen: !!a.frozen, floor: a.floor } : null; }, u);
async function login(page, id, pw) {
  if (!(await page.evaluate(() => { const e = document.getElementById('login-id'); return !!(e && e.offsetParent); }))) { await page.evaluate(() => { try { enterGate(); } catch (e) {} }); await page.waitForTimeout(700); }
  await page.evaluate(([id, pw]) => { switchTab('login'); document.getElementById('login-id').value = id; document.getElementById('login-pw').value = pw; handleSubmit(); }, [id, pw]);
  await page.waitForTimeout(1500);
}
const playing = page => page.evaluate(() => !!(typeof CURRENT_USER !== 'undefined' && CURRENT_USER));
const modalOn = page => page.evaluate(() => { const e = document.getElementById('baPtForce'); return !!(e && e.classList.contains('active')); });
async function setNew(page, a, b) {
  await page.evaluate(([a, b]) => { document.getElementById('baPtP1').value = a; document.getElementById('baPtP2').value = b; document.getElementById('baPtOk').click(); }, [a, b]);
  await page.waitForTimeout(300);
}
async function leave(page) { await page.evaluate(() => { try { exitGame(); } catch (e) {} }); await page.waitForTimeout(500); await page.evaluate(() => { try { enterGate(); } catch (e) {} }); await page.waitForTimeout(500); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  say('── 1 · ปุ่มทั้ง 6 ใน ⚙️ จัดการ (ผ่านหน้าต่างจริง + ยืนยัน) ──');
  let p = await newPage(browser);
  await rules(p); await openPanel(p); await seed(p, 'nut', 'abcd');
  await gmDo(p, 'gmGift', 'nut', '500');
  let a = await A(p, 'nut'); ok('🎁 แจกทอง +500 (100→600)', a.gold === 600, a);
  await gmDo(p, 'gmEditLevel', 'nut', '12');
  a = await A(p, 'nut'); ok('✏️ แก้เลเวลเป็น 12', a.level === 12, a);
  await gmDo(p, 'gmFreeze', 'nut');
  a = await A(p, 'nut'); ok('❄️ ระงับสิทธิ์', a.frozen === true, a);
  await gmDo(p, 'gmFreeze', 'nut');
  a = await A(p, 'nut'); ok('❄️ ปลดระงับ', a.frozen === false, a);
  await gmDo(p, 'gmResetPw', 'nut', '1234');
  a = await A(p, 'nut'); ok('🔑 รีเซ็ตรหัส = 1234 + ติดธง pwTemp', a.pw === '1234' && a.pwTemp === true, a);
  await gmDo(p, 'gmResetProgress', 'nut');
  await p.waitForTimeout(200);
  const hasMenu = await p.evaluate(() => !!document.getElementById('baMrModal') && document.getElementById('baMrModal').classList.contains('active'));
  ok('🔄 เปิดเมนูรีเซ็ตหลายโหมด', hasMenu);
  if (hasMenu) {
    await p.evaluate(() => { const b = document.querySelector('#baMrModal [data-mode="gold"], #baMrModal .ba-mr-btn'); b && b.click(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById('gmModalOk') && document.getElementById('gmModalOk').click());
    await p.waitForTimeout(400);
    a = await A(p, 'nut'); ok('🔄 รีเซ็ตแล้วรหัส+ธง pwTemp ยังอยู่', a.pw === '1234' && a.pwTemp === true, a);
  }
  await seed(p, 'del1', 'zzzz');
  await gmDo(p, 'gmDelete', 'del1');
  a = await A(p, 'del1'); ok('🗑️ ลบไอดี', a === null, a);

  say('── 2 · เข้าด้วยรหัสชั่วคราว → หน้าบังคับตั้งรหัสใหม่ ──');
  await seed(p, 'bee', 'abcd');
  await gmDo(p, 'gmResetPw', 'bee', '1234');
  await p.evaluate(() => closeGm());
  await p.waitForTimeout(300);
  await login(p, 'bee', 'abcd');
  ok('รหัสเก่า abcd เข้าไม่ได้', !(await playing(p)));
  await login(p, 'bee', '1234');
  ok('เข้าด้วย 1234 ได้', await playing(p));
  ok('หน้าตั้งรหัสใหม่ขึ้นทันที', await modalOn(p));
  const vis = await p.evaluate(() => { const r = document.querySelector('#baPtForce .g-modal-inner').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!(e && e.closest('#baPtForce')); });
  ok('หน้าต่างมองเห็นจริงอยู่บนสุด', vis);
  await setNew(p, 'ab', 'ab'); ok('สั้นไป → ไม่ผ่าน/ยังเปิด', (await modalOn(p)) && (await A(p, 'bee')).pw === '1234');
  await setNew(p, 'newpass9', 'newpass8'); ok('ยืนยันไม่ตรง → ไม่ผ่าน', (await modalOn(p)) && (await A(p, 'bee')).pw === '1234');
  await setNew(p, '1234', '1234'); ok('ซ้ำรหัสชั่วคราว → ไม่ผ่าน', (await modalOn(p)) && (await A(p, 'bee')).pw === '1234');
  const clk = await p.evaluate(() => { document.getElementById('baPtForce').click(); return document.getElementById('baPtForce').classList.contains('active'); });
  ok('คลิกพื้นหลังปิดไม่ได้', clk);
  await setNew(p, 'newpass9', 'newpass9');
  a = await A(p, 'bee'); ok('ตั้งรหัสใหม่สำเร็จ + ธงหาย', a.pw === 'newpass9' && a.pwTemp === false, a);
  ok('หน้าต่างปิดแล้ว', !(await modalOn(p)));
  await leave(p);
  await login(p, 'bee', '1234'); ok('1234 ใช้ไม่ได้อีก', !(await playing(p)));
  await login(p, 'bee', 'newpass9'); ok('เข้าด้วยรหัสใหม่ได้ ไม่มีหน้าตั้งรหัสซ้ำ', (await playing(p)) && !(await modalOn(p)));
  ok('ไม่มี pageerror', p.__errs.length === 0, p.__errs);

  say('── 3 · ปิดเกมกลางคันตอนยังไม่ตั้งรหัส → ครั้งต่อไปยังบังคับ ──');
  p = await newPage(browser);
  await rules(p); await openPanel(p); await seed(p, 'bo', 'old1');
  await gmDo(p, 'gmResetPw', 'bo', '1234'); await p.evaluate(() => closeGm());
  await login(p, 'bo', '1234'); ok('ขึ้นหน้าตั้งรหัส', await modalOn(p));
  await leave(p); await login(p, 'bo', '1234');
  ok('ออกไปแล้วเข้าใหม่ยังต้องตั้ง', await modalOn(p));

  say('── 4 · คลาวด์ข้ามเครื่อง ──');
  const pg = await newPage(browser);                       /* เครื่องครู */
  await rules(pg); await openPanel(pg);
  await pg.evaluate(() => { FB_LIVE = { live1: { u: 'live1', name: 'สด', room: '', lv: 3, exp: 1, mexp: 100, hp: 50, mhp: 100, mp: 10, floor: 2, mfloor: 2, gold: 10, corr: 5, wrong: 1, acc: 80, best: 2, words: 3, loops: 0, frozen: false, weak: [], at: Date.now(), pwh: 'OLDHASH' } }; FB_MST = 'live'; fbPaint(); lrHydrate(true); gmRender(); });
  await pg.waitForTimeout(400);
  const isMirror = await pg.evaluate(() => !!(loadStore().live1 && loadStore().live1.lrMirror));
  ok('(เตรียม) แถวสดเป็น mirror ในเครื่องครู', isMirror);
  await gmDo(pg, 'gmResetPw', 'live1', '1234');
  await pg.waitForTimeout(400);
  const row = await pg.evaluate(() => window.__DB.live1);
  ok('รีเซ็ตแถวสด → คลาวด์ได้ pwh ใหม่ + pwTemp', row && row.pwTemp === true && typeof row.pwh === 'string' && row.pwh !== 'OLDHASH', row);
  const hash = await pg.evaluate(() => caHash('live1', '1234'));
  ok('pwh บนคลาวด์ = แฮชของ 1234', row && row.pwh === hash, { row, hash });

  /* เครื่องนักเรียนใหม่ (localStorage ว่าง) แต่คลาวด์มีบัญชี */
  const db = await pg.evaluate(() => { const r = Object.assign({}, window.__DB.live1); return { stud: r }; });
  const st = await newPage(browser, { stud: db.stud, live1: db.stud });
  await rules(st);
  await login(st, 'live1', '1234');
  ok('เครื่องใหม่: เข้าด้วย 1234 ได้', await playing(st));
  ok('เครื่องใหม่: ขึ้นหน้าตั้งรหัสใหม่ (ธงมาจากคลาวด์)', await modalOn(st));
  await setNew(st, 'mine5678', 'mine5678');
  await st.waitForTimeout(500);
  const row2 = await st.evaluate(() => window.__DB.live1);
  const h2 = await st.evaluate(() => caHash('live1', 'mine5678'));
  ok('คลาวด์ได้ pwh ใหม่ของนักเรียน + ธงถูกล้าง', row2 && row2.pwh === h2 && row2.pwTemp === undefined, row2);
  /* heartbeat ต้องไม่เตะ/ไม่ย้อนธง */
  await st.evaluate(() => fbPush(CURRENT_USER)); await st.waitForTimeout(700);
  const row3 = await st.evaluate(() => window.__DB.live1);
  ok('หัวใจ (PUT) หลังตั้งรหัส: pwh คงที่ ไม่มีธงกลับมา', row3 && row3.pwh === h2 && !row3.pwTemp, row3);
  ok('ไม่ถูกเตะออกจากเกม', await playing(st));
  await leave(st);
  await login(st, 'live1', '1234'); ok('คลาวด์: 1234 ใช้ไม่ได้อีก', !(await playing(st)));
  await login(st, 'live1', 'mine5678'); ok('คลาวด์: รหัสใหม่เข้าได้ ไม่มีหน้าตั้งซ้ำ', (await playing(st)) && !(await modalOn(st)));

  say('── 5 · เลย์เอาต์ ──');
  const h = await st.evaluate(() => { const c = document.getElementById('gQuestion'); return document.body.scrollWidth <= window.innerWidth; });
  ok('ไม่ล้นแนวนอน', h);

  say('\n  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
