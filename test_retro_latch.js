/* ชุดทดสอบ Patch v9.38 · PILLAR LATCH + RETROACTIVE BACKFILL
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_retro_latch.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_retro_latch.log');
let PASS = 0, FAIL = 0;
try { fs.unlinkSync(LOG); } catch (e) {}
const say = m => { fs.appendFileSync(LOG, m + '\n'); process.stdout.write(m + '\n'); };
const ok = (n, c, x) => { if (c) { PASS++; say('  ✓ ' + n); } else { FAIL++; say('  ✗ ' + n + (x != null ? '  → ' + JSON.stringify(x) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STUB = `(function(){ window.fetch = function(){ return Promise.reject(new Error('stub')); };
  function ES(){ this.readyState=2; } ES.prototype.addEventListener=function(){}; ES.prototype.close=function(){};
  window.EventSource = ES; })();`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.addInitScript(STUB);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await sleep(150);
  await page.evaluate(() => { try { rgScrollCheck(); rgAck(); } catch (e) {} });
  await sleep(700);

  const login = async (id) => {
    await page.evaluate(async (id) => {
      switchTab('login');
      document.getElementById('login-id').value = id; document.getElementById('login-pw').value = 'pw1234';
      handleSubmit();
      await new Promise(r => setTimeout(r, 1500));
      for (let i = 0; i < 5; i++) { const c = document.querySelector('#cdDraft.active .cd-card'); if (!c) break; c.click(); await new Promise(r => setTimeout(r, 750)); }
    }, id);
  };

  say('═══ 1 · สมัคร + latch ติดเมื่อผ่าน และคงอยู่แม้ค่าตก ═══');
  await page.evaluate(async () => {
    switchTab('register');
    document.getElementById('reg-id').value = 'lt01'; document.getElementById('reg-pw').value = 'pw1234';
    document.getElementById('reg-pw2').value = 'pw1234'; document.getElementById('reg-name').value = 'lt01';
    handleSubmit();
    await new Promise(r => setTimeout(r, 1500));
    for (let i = 0; i < 5; i++) { const c = document.querySelector('#cdDraft.active .cd-card'); if (!c) break; c.click(); await new Promise(r => setTimeout(r, 750)); }
  });
  const a1 = await page.evaluate(() => {
    const idx = BA_MN_PILL.map(p => p.id).indexOf('level');
    G.level = BA_LV_MAX; baMnStat();
    const set = (G.mnLt >> idx) & 1;
    G.level = 5;
    const s = baMnStat().list.find(x => x.id === 'level');
    return { set, ok: s.ok, n: s.n, d: s.d, n12: BA_MN_PILL.length };
  });
  ok('มี 12 เสา', a1.n12 === 12, a1);
  ok('ผ่านครั้งเดียว บิตติด', a1.set === 1, a1);
  ok('เลเวลตกเหลือ 5 แต่ผนึกยัง ok', a1.ok && a1.n === a1.d, a1);

  say('═══ 2 · ความแม่นยำต้อง ≥ 20 ข้อก่อนล็อก ═══');
  const a2 = await page.evaluate(() => {
    const idx = BA_MN_PILL.map(p => p.id).indexOf('acc');
    G.correct = 1; G.wrong = 0; baMnStat();
    const early = (G.mnLt >> idx) & 1;
    G.correct = 100; G.wrong = 0; baMnStat();
    return { early, late: (G.mnLt >> idx) & 1 };
  });
  ok('1 ข้อถูกยังไม่ล็อก', a2.early === 0, a2);
  ok('100 ข้อถูกล็อก', a2.late === 1, a2);

  say('═══ 3 · รอดออก-เข้าเกมใหม่ + บันทึกลง store ═══');
  await page.evaluate(() => { saveProgress(); });
  const st1 = await page.evaluate(() => loadStore().lt01.mnLt);
  ok('store มี mnLt > 0', st1 > 0, st1);
  await page.evaluate(() => { exitGame(); }); await sleep(600);
  await page.evaluate(async () => { enterGate(); await new Promise(r => setTimeout(r, 700)); });
  await login('lt01');
  const a3 = await page.evaluate(() => {
    const s = baMnStat().list;
    return { lv: s.find(x => x.id === 'level').ok, acc: s.find(x => x.id === 'acc').ok, lvNow: G.level };
  });
  ok('หลังล็อกอินใหม่ level ยัง ok ทั้งที่เลเวลต่ำ', a3.lv && a3.lvNow < 99, a3);
  ok('acc ยัง ok', a3.acc, a3);

  say('═══ 4 · ย้อนหลัง: สมัครบัญชีเก่าที่มีประวัติ แล้วล็อกอินครั้งแรก ═══');
  await page.evaluate(() => { exitGame(); }); await sleep(600);
  await page.evaluate(async () => {
    const st = loadStore();
    const a = JSON.parse(JSON.stringify(st.lt01)); a.user = 'lt02'; a.name = 'lt02'; a.pw = 'pw1234';
    delete a.mnBf; a.mnLt = 0; a.mn2 = { kill: 0, combo: 0, quest: 0, pure: 0 };
    a.level = 3; a.correct = 5; a.wrong = 5; a.best = 22; a.maxFloor = 8; a.floor = 8; a.towerClears = 0;
    a.quest = { day: qDayKey(), week: qWeekKey(), d: {}, w: {}, done: { d: ['D1'], w: ['W1'], L: ['L1', 'L2'] } };
    a.wordStats = { 1: { seen: 4, wrong: 1, totalMs: 0, lastSeen: 1, recent: [false, true, true] },
                    2: { seen: 3, wrong: 0, totalMs: 0, lastSeen: 1, recent: [true, true, true] },
                    3: { seen: 3, wrong: 2, totalMs: 0, lastSeen: 1, recent: [true, false, true] } };
    st.lt02 = a; saveStore(st);
    enterGate(); await new Promise(r => setTimeout(r, 700));
  });
  await login('lt02');
  const a4 = await page.evaluate(() => ({ m: JSON.parse(JSON.stringify(G.mn2)), bf: loadStore().lt02.mnBf, sv: loadStore().lt02.mn2 }));
  ok('combo = 1 จาก bestStreak 22', a4.m.combo === 1, a4);
  ok('quest = 4 จากเควสที่รับแล้ว', a4.m.quest === 4, a4);
  ok('pure = 1 (เฉพาะคำที่เคยผิดแล้วถูก 2 ครั้งล่าสุด)', a4.m.pure === 1, a4);
  ok('kill = 7 (ขอบล่างจากชั้นที่เคลียร์)', a4.m.kill === 7, a4);
  ok('บันทึก mnBf และ mn2 ลง store', a4.bf === 1 && a4.sv.kill === 7, a4);
  await page.evaluate(() => { exitGame(); }); await sleep(600);
  await page.evaluate(async () => { enterGate(); await new Promise(r => setTimeout(r, 700)); });
  await page.evaluate(() => { const st = loadStore(); st.lt02.mn2.kill = 99; saveStore(st); });
  await login('lt02');
  const a5 = await page.evaluate(() => G.mn2.kill);
  ok('ล็อกอินรอบสองไม่ย้อนหลังซ้ำ (kill คงที่ 99)', a5 === 99, a5);

  say('═══ 5 · ส่งถึงแถวสดของครู (ฟิลด์ที่ 7 ของ pl) ═══');
  const a6 = await page.evaluate(() => {
    G.level = BA_LV_MAX; baMnStat();
    const a = loadStore().lt02; a.mnLt = G.mnLt;
    const p = fbPayload('lt02', a);
    const f = String(p.pl).split('|');
    const ghost = lrGhost('lt02', p);
    lrApply(ghost, p);
    const idx = BA_MN_PILL.map(x => x.id).indexOf('level');
    const s = BA_MN_PILL[idx].get(ghost);
    return { f: f.length, seventh: +f[6], hasBit: ((+f[6]) >> idx) & 1, ghostLt: ghost.mnLt, ok: s[0] === s[1], len: String(p.pl).length };
  });
  ok('pl มี 7 ฟิลด์', a6.f === 7, a6);
  ok('บิต level อยู่ในฟิลด์ที่ 7', a6.hasBit === 1, a6);
  ok('แถวสดของครูได้ mnLt และเสา level ผ่าน', a6.ghostLt > 0 && a6.ok, a6);
  ok('pl ยังกะทัดรัด < 120 ไบต์', a6.len < 120, a6.len);

  say('═══ 6 · audit + การ์ดโจทย์ไม่ขยับ + ไม่มี pageerror ═══');
  const au = await page.evaluate(() => baBattleAudit().latch938);
  ok('audit latch938 มีอยู่', au && au.ver === 'v9.38' && Array.isArray(au.pass), au);
  ok('pageerror = 0', errs.length === 0, errs);

  say('\nผล: ผ่าน ' + PASS + ' · ตก ' + FAIL);
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
