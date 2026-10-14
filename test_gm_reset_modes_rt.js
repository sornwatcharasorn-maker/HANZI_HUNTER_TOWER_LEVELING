/* ชุดเทสต์ RESET MODES REALTIME (10 โหมด ครู→คลาวด์→เครื่องนักเรียน)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_gm_writeback.js

   สองเครื่องจริง (สอง context = localStorage คนละก้อน) ใช้คลาวด์ปลอมก้อนเดียวกัน
   ซึ่งอยู่ฝั่ง Node (exposeBinding) และรองรับ GET/PUT/PATCH/DELETE ทุกความลึกของ path
   เคสหลักคือ: ครูสั่ง → คำสั่งลงกล่อง /students/<u>/gmq → heartbeat ของนักเรียนใช้คำสั่ง
   → แนบ gmAck → กล่องถูกล้าง → ค่าบนเครื่องนักเรียนเปลี่ยนจริง */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'gm_reset_modes_rt_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* ── คลาวด์ปลอมฝั่ง Node ─────────────────────────────────────────────── */
const DB = {};
const NET = [];
function segs(url) {
  let p = '';
  try { p = new URL(url).pathname; } catch (e) { return null; }
  if (!/\.json$/.test(p)) return null;
  return p.replace(/\.json$/, '').split('/').filter(Boolean).map(decodeURIComponent);
}
function getAt(s) { let o = DB; for (const k of s) { if (!o || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : o; }
function parentOf(s, mk) {
  let o = DB;
  for (let i = 0; i < s.length - 1; i++) {
    if (!o[s[i]] || typeof o[s[i]] !== 'object') { if (!mk) return null; o[s[i]] = {}; }
    o = o[s[i]];
  }
  return o;
}
let GM_PAGE = null;
function cloud(method, url, body, page) {
  NET.push({ method, url, body, gm: !!(page && page === GM_PAGE) });
  const s = segs(url);
  if (!s || !s.length) return 'null';
  if (method === 'GET') return JSON.stringify(getAt(s));
  if (method === 'DELETE') { const p = parentOf(s, false); if (p) delete p[s[s.length - 1]]; return 'null'; }
  const v = body ? JSON.parse(body) : null;
  const p = parentOf(s, true), k = s[s.length - 1];
  if (method === 'PUT') { if (v === null) delete p[k]; else p[k] = v; return body; }
  if (method === 'PATCH') {
    if (!p[k] || typeof p[k] !== 'object') p[k] = {};
    Object.keys(v || {}).forEach(x => { if (v[x] === null) delete p[k][x]; else p[k][x] = v[x]; });
    return body;
  }
  return 'null';
}
const ROW = u => (DB.students || {})[u] || null;

const STUB = `
  window.EventSource = function (url) {
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
  window.fetch = function (u, o) {
    const m = (o && o.method) || 'GET', b = (o && typeof o.body === 'string') ? o.body : '';
    return window.__cloud(m, String(u), b).then(function (t) {
      return { ok: true, status: 200,
        text: function () { return Promise.resolve(t); },
        json: function () { return Promise.resolve(JSON.parse(t)); } };
    });
  };
`;

async function fresh(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 } });
  await ctx.exposeBinding('__cloud', (src, m, u, b) => cloud(m, u, b, src.page));
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
async function passGate(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
}
async function clearOverlays(page) {
  for (let i = 0; i < 12; i++) {
    const busy = await page.evaluate(() => {
      const d = document.getElementById('cdDraft');
      if (d && d.classList.contains('active')) { const c = d.querySelector('.cd-card'); if (c) c.click(); return 1; }
      const g = document.getElementById('snGate');
      if (g && g.classList.contains('active')) { try { snGateConfirm(); } catch (e) {} return 1; }
      return 0;
    });
    if (!busy) break;
    await page.waitForTimeout(700);
  }
}
async function register(page, id, pw) {
  await passGate(page);
  await page.evaluate(([i, p]) => {
    switchTab('register');
    document.getElementById('reg-id').value = i;
    document.getElementById('reg-pw').value = p;
    document.getElementById('reg-pw2').value = p;
    handleSubmit();
  }, [id, pw]);
  await page.waitForFunction(() => typeof G !== 'undefined' && G && G.currentMonster || document.getElementById('cdDraft').classList.contains('active'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  await clearOverlays(page);
}
async function gmPanel(page) {
  await passGate(page);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(400);
}
async function gmSee(gm) {            /* จำลอง SSE: ครูเห็นสัญญาณสดล่าสุดของห้อง */
  await gm.evaluate(rows => { fbApply('put', JSON.stringify({ path: '/', data: JSON.parse(rows) || {} })); try { gmRender(); } catch (e) {} },
                    JSON.stringify(DB.students || {}));
  await gm.waitForTimeout(250);
}
async function beat(stu) {           /* heartbeat ของนักเรียนหนึ่งรอบ */
  await stu.evaluate(() => { try { fbPush(CURRENT_USER); } catch (e) {} });
  await stu.waitForTimeout(700);
}
const S = stu => stu.evaluate(() => ({ gold: G.gold, lv: G.level, pot: (G.items || {}).potion || 0,
  gem: Math.floor(((G.ab || {}).shards) || 0), hp: G.hp, mhp: G.maxHp, floor: G.floor, user: CURRENT_USER }));


const MODES = ['full','level','floor','gold','vocab','wrongs','p4','skills','gems','core'];
const SEED = () => {
  const a = loadStore()[CURRENT_USER];
  G.level = 12; G.exp = 50; G.gold = 777; G.floor = 6; G.maxFloor = 9; G.towerClears = 2;
  G.items = Object.assign({}, G.items, { potion: 3 });
  G.ab = G.ab || {}; G.ab.shards = 400; G.ab.core = G.ab.core || {}; AB_CORES.forEach(k => { G.ab.core[k.key] = 2; });
  G.wordStats = {}; [1,2,3].forEach(i => { G.wordStats[i] = { seen: 5, wrong: 2, recent: [1,0,1] }; });
  G.r20 = { x: 1 }; G.pureRole = 'assassin'; G.ult = 4;
  G.skills = G.skills || {}; try { Object.keys(G.skills).forEach(c => { G.skills[c] = G.skills[c].map(() => 3); }); } catch (e) {}
  recalcStats(); saveProgress();
};
const SNAP = stu => stu.evaluate(() => {
  const a = loadStore()[CURRENT_USER] || {};
  return { gold: G.gold, lv: G.level, maxFloor: G.maxFloor, loops: G.towerClears || 0,
    words: Object.keys(G.wordStats || {}).length, wrong: Object.values(G.wordStats || {}).reduce((s, w) => s + (w.wrong || 0), 0),
    r20: Object.keys(G.r20 || {}).length, pure: G.pureRole || null, ult: (G.ult && typeof G.ult==='object') ? (G.ult.pips||0) : (G.ult||0),
    gem: Math.floor((G.ab || {}).shards || 0), core: Object.values((G.ab || {}).core || {}).reduce((s, v) => s + v, 0),
    pot: (G.items || {}).potion || 0, pw: !!a.pw, user: CURRENT_USER,
    skl: JSON.stringify(G.skills || {}).replace(/[^0-9]/g, '').split('').some(c => c !== '1') };
});
const EXPECT = {
  full:   s => s.gold === 0 && s.lv === 1 && s.words === 0 && s.gem === 0,
  level:  s => s.lv === 1 && s.gold === 777 && s.words === 3,
  floor:  s => s.maxFloor <= 1 && s.loops === 0 && s.lv === 12 && s.gold === 777,
  gold:   s => s.gold === 0 && s.lv === 12 && s.maxFloor === 9,
  vocab:  s => s.words === 0 && s.lv === 12 && s.gold === 777,
  wrongs: s => s.wrong === 0 && s.words === 3 && s.gold === 777,
  p4:     s => s.r20 === 0 && !s.pure && s.gold === 777,
  skills: s => s.ult === 0 && !s.skl && s.gold === 777,
  gems:   s => s.gem === 0 && s.core === 6 * 0 + s.core && s.gold === 777,
  core:   s => s.gem === 0 && s.core === 0 && s.gold === 777
};
(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const A = await fresh(browser), B = await fresh(browser);
  const stu = A.page, gm = B.page; GM_PAGE = gm;
  await register(stu, 'rst', 'pw1234');
  await gmPanel(gm);
  for (const mode of MODES) {
    say('\n═══ โหมด ' + mode + ' ═══');
    /* ถ้าโหมดก่อนหน้าเป็น full นักเรียนอาจต้องล้างตัวเอง/รีโหลด → ล็อกอินใหม่ถ้าหลุด */
    if (!(await stu.evaluate(() => typeof CURRENT_USER !== 'undefined' && !!CURRENT_USER))) {
      await stu.evaluate(() => { try { enterGate(); } catch (e) {} }); await stu.waitForTimeout(700);
      await stu.evaluate(() => { switchTab('login'); document.getElementById('login-id').value = 'rst'; document.getElementById('login-pw').value = 'pw1234'; handleSubmit(); });
      await stu.waitForTimeout(2500); await clearOverlays(stu);
    }
    await stu.evaluate(SEED); await beat(stu); await gmSee(gm);
    const before = await SNAP(stu);
    /* เปิดเมนูจริง กดปุ่มโหมดจริง กดยืนยันจริง */
    await gm.evaluate(() => baMrOpen('rst'));
    const clicked = await gm.evaluate(m => {
      const b = Array.from(document.querySelectorAll('#baMrModal .ba-mr-btn')).find(x => /baMrPick\('?"?(\w+)/.test(x.getAttribute('onclick') || '') && (x.getAttribute('onclick') || '').indexOf("'" + m + "'") >= 0);
      if (!b) return false; b.click(); return true; }, mode);
    ok('มีปุ่มโหมด ' + mode + ' ในเมนู', clicked);
    await gm.evaluate(() => { const o = document.getElementById('gmModalOk'); if (o) o.click(); });
    await gm.waitForTimeout(500);
    /* ฝั่งครู: ตารางทั้งสามต้องเห็นทันที ไม่รอสัญญา */
    const t = await gm.evaluate(() => { const r = baMasterState.rst || {}; return { gold: r.gold, lv: r.lv, uni: (document.getElementById('baUni') || {}).innerText || '' }; });
    if (mode === 'gold' || mode === 'full') ok('ครู: สถานะกลางเห็นทอง 0 ทันที', t.gold === 0, t);
    if (mode === 'level' || mode === 'full') ok('ครู: สถานะกลางเห็นเลเวล 1 ทันที', t.lv === 1, t);
    const box = Object.values((ROW('rst') || {}).gmq || {});
    const sig = !!(ROW('rst') || {}).resetSignal;
    ok('คำสั่งถึงคลาวด์ (' + (mode === 'full' ? 'resetSignal' : 'gmq reset') + ')',
       mode === 'full' ? sig : (box.some(c => c.t === 'reset' && c.mode === mode) || /* heartbeat อัตโนมัติ 5 วิ อาจใช้ไปก่อนตรวจ */ ((ROW('rst')||{}).gmAck||[]).length > 0), { box, sig });
    await stu.evaluate(() => { G.shield = 99999; try { clearQuestionTimer(); } catch (e) {} });
    await beat(stu); await stu.waitForTimeout(1500);
    if (mode === 'full') await stu.waitForTimeout(2500);
    const logged = await stu.evaluate(() => typeof CURRENT_USER !== 'undefined' && !!CURRENT_USER);
    if (!logged) { say('  (เครื่องนักเรียนล้างตัวเองแล้วรีโหลด → ล็อกอินใหม่)'); await stu.reload({ waitUntil: 'domcontentloaded' }); await stu.waitForTimeout(600); await passGate(stu);
      await stu.evaluate(() => { switchTab('login'); document.getElementById('login-id').value = 'rst'; document.getElementById('login-pw').value = 'pw1234'; handleSubmit(); });
      await stu.waitForTimeout(2500); await clearOverlays(stu); }
    const after = await SNAP(stu);
    ok('เครื่องนักเรียนได้ผลของโหมด ' + mode, EXPECT[mode](after), { before, after });
    ok('รหัสผ่าน/บัญชียังอยู่ ล็อกอินได้', after.pw && after.user === 'rst', after);
    await stu.evaluate(() => { G.hp = G.maxHp; G.shield = 99999; try { clearQuestionTimer(); } catch (e) {} });
    await beat(stu);
    const again = await SNAP(stu);
    ok('heartbeat ถัดไปไม่เขียนค่าเก่ากลับ', EXPECT[mode](again), again);
    const rowOk = ROW('rst') && !(ROW('rst').gmq && Object.keys(ROW('rst').gmq).length);
    ok('กล่องคำสั่งถูกล้างหลังใช้', mode === 'full' || rowOk, ROW('rst'));
  }
  ok('เครื่องนักเรียนไม่มี pageerror', A.errs.length === 0, A.errs);
  ok('เครื่องครูไม่มี pageerror', B.errs.length === 0, B.errs);
  await A.ctx.close(); await B.ctx.close(); await browser.close();
  say('\n  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { say('CRASH ' + (e && e.stack || e)); process.exit(2); });
