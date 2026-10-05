/* ชุดเทสต์ Patch v9.25 — TRUE BIDIRECTIONAL GM COMMAND WRITEBACK
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_gm_writeback.js

   สองเครื่องจริง (สอง context = localStorage คนละก้อน) ใช้คลาวด์ปลอมก้อนเดียวกัน
   ซึ่งอยู่ฝั่ง Node (exposeBinding) และรองรับ GET/PUT/PATCH/DELETE ทุกความลึกของ path
   เคสหลักคือ: ครูสั่ง → คำสั่งลงกล่อง /students/<u>/gmq → heartbeat ของนักเรียนใช้คำสั่ง
   → แนบ gmAck → กล่องถูกล้าง → ค่าบนเครื่องนักเรียนเปลี่ยนจริง */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'gm_writeback_log.txt');
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

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  const A = await fresh(browser), B = await fresh(browser);
  const stu = A.page, gm = B.page; GM_PAGE = gm;

  say('\n═══ 1 · ติดตั้ง ═══');
  const au = await stu.evaluate(() => baBattleAudit().gmWriteback);
  ok('มีก้อน gmWriteback ใน audit', !!au && au.ver === '9.25', au);
  ok('ช่องทางเรียลไทม์เปิดอยู่ (v5.4 seed)', au && au.on === true, au);

  await register(stu, 'stu', 'pw1234');
  await beat(stu);
  ok('แถวนักเรียนขึ้นคลาวด์', !!(ROW('stu') && ROW('stu').u === 'stu'), ROW('stu'));
  await gmPanel(gm);
  await gmSee(gm);
  ok('เครื่องครูเห็นแถวสดของนักเรียนลงทะเบียน', await gm.evaluate(() => !!loadStore().stu), null);

  say('\n═══ 2 · ทอง · 💎 · ไอเทม · เลเวล ═══');
  const s0 = await S(stu);
  await gm.evaluate(() => withStudent('stu', a => {
    a.gold += 500; a.items.potion = (a.items.potion || 0) + 2;
    a.ab = a.ab || {}; a.ab.shards = (a.ab.shards || 0) + 50; a.level = 7;
  }));
  const q1 = Object.values((ROW('stu') || {}).gmq || {});
  eq('มีคำสั่งเดียวลงกล่อง /students/stu/gmq', q1.length, 1);
  const c1 = q1[0] || {};
  eq('คำสั่งเป็นส่วนต่าง (ไม่ใช่ค่าสัมบูรณ์)', [c1.t, c1.gold, c1.gem, (c1.items || {}).potion, c1.lv], ['edit', 500, 50, 2, 7]);
  ok('ไม่ได้ส่ง PUT ทับแถวนักเรียนจากเครื่องครู',
     !NET.some(n => n.method === 'PUT' && /\/students\/stu\.json/.test(n.url) && n.body.indexOf('"gold":' + (s0.gold + 500)) >= 0));
  ok('ครูถือคำสั่งค้างไว้รอ gmAck', await gm.evaluate(() => Object.keys((baBattleAudit().gmWriteback.pend.stu) || {}).length === 1));

  await beat(stu);
  const s1 = await S(stu);
  eq('ทองเพิ่ม 500 บนเครื่องนักเรียน', s1.gold - s0.gold, 500);
  eq('ยาฟื้นพลังเพิ่ม 2', s1.pot - s0.pot, 2);
  eq('💎 เพิ่ม 50 (ไม่ติดเพดานรายวัน)', s1.gem - s0.gem, 50);
  eq('เลเวลเป็น 7', s1.lv, 7);
  const r1 = ROW('stu') || {};
  ok('กล่องคำสั่งถูกล้างใน PUT เดียวกัน', !r1.gmq || !Object.keys(r1.gmq).length, r1.gmq);
  ok('แถวคลาวด์มี gmAck ของคำสั่งนั้น', Array.isArray(r1.gmAck) && r1.gmAck.indexOf(c1.id) >= 0, r1.gmAck);
  eq('แถวคลาวด์รายงานทองใหม่', r1.gold, s1.gold);
  ok('ไม่มีรหัสผ่านตัวจริงในแถว', r1.pw === undefined, Object.keys(r1));
  const st1 = await stu.evaluate(() => loadStore().stu);
  eq('store ของนักเรียนเป็นค่าใหม่ (heartbeat ถัดไปไม่ทับคืน)', [st1.gold, st1.level], [s1.gold, 7]);

  await beat(stu);
  eq('heartbeat รอบสองไม่ใช้ซ้ำ', (await S(stu)).gold, s1.gold);
  await gmSee(gm);
  ok('ครูทิ้งคำสั่งเมื่อเห็น gmAck', await gm.evaluate(() => !(baBattleAudit().gmWriteback.pend.stu)));

  say('\n═══ 3 · เติม HP เต็ม · re-assert ═══');
  await stu.evaluate(() => { G.hp = 5; saveProgress(); });
  await beat(stu); await gmSee(gm);
  await gm.evaluate(() => gcHeal('stu', 'hp'));
  const qh = Object.values((ROW('stu') || {}).gmq || {})[0] || {};
  eq('คำสั่งเติม HP = -1 (เต็มหลอดตาม maxHp ของนักเรียนเอง)', qh.hp, -1);
  /* จำลองคำสั่งหายระหว่างทาง: PUT ของเครื่องอื่นมาลบกล่องโดยไม่มี gmAck */
  delete DB.students.stu.gmq;
  const rs0 = await gm.evaluate(() => baBattleAudit().gmWriteback.n.resend);
  await gm.evaluate(() => { Object.keys(BA_GQ_SEEN).forEach(k => BA_GQ_SEEN[k] = 0); });
  await gmSee(gm);
  ok('ครูยิงคำสั่งที่หายซ้ำเอง', (await gm.evaluate(() => baBattleAudit().gmWriteback.n.resend)) > rs0);
  ok('คำสั่งกลับมาอยู่ในกล่อง', !!(ROW('stu').gmq && ROW('stu').gmq[qh.id]));
  await beat(stu);
  const sh = await S(stu);
  eq('HP เต็มหลอดบนเครื่องนักเรียน', sh.hp, sh.mhp);

  say('\n═══ 4 · รีเซ็ตแยกส่วน (ทอง) ไม่ล้างทั้งบัญชี ═══');
  await gmSee(gm);
  const lvB = (await S(stu)).lv;
  await gm.evaluate(() => baMrApply('stu', 'gold'));
  ok('ไม่ได้ยิง resetSignal (นั่นคือล้างทั้งบัญชี)', !(ROW('stu') || {}).resetSignal, ROW('stu').resetSignal);
  const qr = Object.values((ROW('stu') || {}).gmq || {})[0] || {};
  eq('ส่งคำสั่ง reset โหมด gold', [qr.t, qr.mode], ['reset', 'gold']);
  ok('ครูไม่ได้ PUT /wordbank ด้วยก้อนภาพสะท้อน',
     !NET.some(n => n.gm && n.method === 'PUT' && /\/wordbank\//.test(n.url)));
  await beat(stu);
  const sr = await S(stu);
  eq('ทองเป็น 0', sr.gold, 0);
  eq('เลเวลคงเดิม', sr.lv, lvB);
  eq('ยังล็อกอินอยู่ (ไม่ถูกเตะ)', sr.user, 'stu');

  say('\n═══ 5 · ระงับสิทธิ์ → ปลดที่หน้าล็อกอิน ═══');
  await gmSee(gm);
  await gm.evaluate(() => withStudent('stu', a => { a.frozen = true; }));
  ok('แถวคลาวด์ frozen=true ทันที (v5.8 ปฏิเสธเครื่องอื่น)', ROW('stu').frozen === true);
  await beat(stu);
  await stu.waitForTimeout(400);
  ok('นักเรียนถูกพาออกจากเกม', await stu.evaluate(() => !CURRENT_USER));
  ok('store ของนักเรียนติดธงระงับ', await stu.evaluate(() => loadStore().stu.frozen === true));
  await gmSee(gm);
  await gm.evaluate(() => withStudent('stu', a => { a.frozen = false; }));
  ok('แถวคลาวด์ frozen=false', ROW('stu').frozen === false);
  await stu.evaluate(() => { try { enterGate(); } catch (e) {} });
  await stu.waitForTimeout(700);
  await stu.evaluate(() => {
    switchTab('login');
    document.getElementById('login-id').value = 'stu';
    document.getElementById('login-pw').value = 'pw1234';
    handleSubmit();
  });
  await stu.waitForTimeout(2500);
  await clearOverlays(stu);
  ok('ล็อกอินได้อีกครั้งหลังปลดระงับ', await stu.evaluate(() => CURRENT_USER === 'stu'));
  ok('ธงระงับในเครื่องถูกปลด', await stu.evaluate(() => loadStore().stu.frozen !== true));

  say('\n═══ 6 · ลบไอดี → เครื่องนักเรียนล้างบัญชี ═══');
  await beat(stu); await gmSee(gm);
  await gm.evaluate(() => baPurgeUser('stu'));
  await gm.waitForTimeout(600);
  const rd = ROW('stu') || {};
  ok('แถวคลาวด์เหลือแต่ป้ายหลุมศพ (ไม่มี u/at)', !rd.u && !rd.at && rd.gmq && Object.values(rd.gmq).some(c => c.t === 'del'), rd);
  ok('ลบ /wordbank ของนักเรียนด้วย', NET.some(n => n.method === 'DELETE' && /\/wordbank\/stu\.json/.test(n.url)));
  const putsB = NET.filter(n => n.method === 'PUT' && /\/students\/stu\.json/.test(n.url)).length;
  await stu.evaluate(() => { try { fbPush('stu'); } catch (e) {} });
  await stu.waitForTimeout(1500);
  eq('heartbeat ไม่ PUT แถวเก่ากลับขึ้นไป', NET.filter(n => n.method === 'PUT' && /\/students\/stu\.json/.test(n.url)).length, putsB);
  ok('บัญชีบนเครื่องนักเรียนถูกลบ', await stu.evaluate(() => !loadStore().stu));
  ok('แถวคลาวด์ยังไม่ถูกปลุกคืน', !(ROW('stu') || {}).u);
  await gmSee(gm);
  ok('ตาราง LIVE ของครูไม่มีแถวหลุมศพ', await gm.evaluate(() => !FB_LIVE.stu), await gm.evaluate(() => FB_LIVE.stu));

  say('\n═══ 7 · CLS · ไม่มี pageerror ═══');
  ok('เครื่องนักเรียนไม่มี pageerror', A.errs.length === 0, A.errs);
  ok('เครื่องครูไม่มี pageerror', B.errs.length === 0, B.errs);

  await A.ctx.close(); await B.ctx.close();
  await browser.close();
  say('\n══════════════════════════════════\n  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL + '\n══════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})().catch(e => { say('CRASH ' + (e && e.stack || e)); process.exit(2); });
