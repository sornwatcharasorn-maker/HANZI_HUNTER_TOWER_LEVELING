/* ชุดทดสอบชั้น v5.2 · CLOUD SYNC (คำสั่ง Online Cloud Save & Data Sync Engine)
   ใช้คลาวด์ปลอมในหน้าเพจ (เขียนทับ window.fetch) เลียนแบบ PostgREST ของ Supabase
   จึงทดสอบได้ครบทั้งการส่ง · เน็ตหลุด · ข้อมูลชนกัน · ล็อกอินข้ามเครื่อง โดยไม่ต้องมีเซิร์ฟเวอร์จริง
   รัน: NODE_PATH=/opt/node22/lib/node_modules node test_cloud_sync.js */
const { chromium } = require('playwright');
const fs = require('fs');

const FILE = 'file:///home/user/HANZI_HUNTER_TOWER_LEVELING/hanzi_hunter_tower_v3_1_intro.html';
const LOG  = '/tmp/claude-0/-home-user-HANZI-HUNTER-TOWER-LEVELING/f5e39649-d8e5-5c3b-ae7c-c7e90122873f/scratchpad/test_cs.log';
try { fs.unlinkSync(LOG); } catch (e) {}
function log(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }

let PASS = 0, FAIL = 0;
function ok(name, cond, extra) {
  if (cond) { PASS++; log('  PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; log('  FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

/* ── คลาวด์ปลอม: รองรับชุดคำสั่งย่อยของ PostgREST เท่าที่ชั้น v5.2 ใช้จริง ───── */
const FAKE_CLOUD = function () {
  window.__CS = { rows: {}, fail: 0, log: [] };
  window.fetch = async function (url, opt) {
    url = String(url); opt = opt || {};
    const S = window.__CS, m = (opt.method || 'GET').toUpperCase();
    S.log.push(m + ' ' + url);
    if (S.fail) throw new TypeError('Failed to fetch');
    const par = {};
    (url.split('?')[1] || '').split('&').forEach(function (kv) {
      const i = kv.indexOf('='); if (i > 0) par[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    const body = opt.body ? JSON.parse(opt.body) : null;
    const rep = function (code, data) {
      return { ok: code < 400, status: code, text: async function () { return data == null ? '' : JSON.stringify(data); } };
    };
    const usr  = par.usr  ? String(par.usr).replace(/^eq\./, '')  : null;
    const room = par.room ? String(par.room).replace(/^eq\./, '') : null;
    const all  = function () { return Object.keys(S.rows).map(function (k) { return S.rows[k]; }); };
    if (m === 'GET') {
      if (usr)  { const r = S.rows[usr]; return rep(200, r ? [r] : []); }
      if (room) return rep(200, all().filter(function (r) { return r.room === room; }));
      return rep(200, []);
    }
    if (m === 'PATCH') {
      const lt = par.ts ? +String(par.ts).replace(/^lt\./, '') : Infinity;
      const cur = S.rows[usr];
      if (cur && (cur.ts || 0) < lt) { S.rows[usr] = body; return rep(200, [body]); }
      return rep(200, []);
    }
    if (m === 'POST') { S.rows[body.usr] = body; return rep(201, null); }
    return rep(405, null);
  };
};

async function newPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { errs.push(String(e)); log('  !! pageerror: ' + e); });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.addInitScript(FAKE_CLOUD);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  page._errs = errs;
  return page;
}

async function enter(page, name) {
  await page.evaluate(() => enterGate());
  await page.waitForTimeout(700);
  await page.evaluate(() => switchTab('register'));
  await page.evaluate((n) => {
    document.getElementById('reg-id').value = n;
    document.getElementById('reg-pw').value = 'pw123456';
    document.getElementById('reg-pw2').value = 'pw123456';
    handleSubmit();
  }, name);
  await page.waitForTimeout(900);
}

/* ปิดหน้าต่างจั่วการ์ดของ v4.7 แล้วเงียบ toast (กติกาเดียวกับชุดเทสต์ชั้นอื่น) */
async function settle(page) {
  const has = await page.evaluate(() => {
    const d = document.getElementById('cdDraft');
    return !!(d && d.classList.contains('active'));
  });
  if (has) {
    await page.evaluate(() => document.querySelector('#cdDraft .cd-card').click());
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => {
    G.maxFloor = FLOOR_MAX; recalcStats();
    document.getElementById('snLayer').innerHTML = '';
  });
  await page.waitForTimeout(100);
}

async function cloudOn(page) {
  await page.evaluate(() => csCfgSave({ provider: 'supabase', url: 'https://fake.test', key: 'anonkey', table: 'hunters', auto: true, strict: false }));
}
const rows  = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__CS.rows)));
const flush = page => page.evaluate(() => csFlush());

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ บล็อก 1 · ยังไม่ตั้งค่าคลาวด์ = ชั้นนี้ต้องเงียบสนิท ═══════════════
  log('\n[1] ยังไม่ตั้งค่าคลาวด์ — เกมต้องเหมือนเดิมทุกประการ');
  {
    const page = await newPage(browser);
    await enter(page, 'off01');
    await settle(page);
    const st = await page.evaluate(() => ({
      on: CS_ON, ver: CS_VER, st: CS_ST,
      chip: getComputedStyle(document.getElementById('csChip')).display,
      calls: window.__CS.log.length,
      playing: document.getElementById('gameScreen').classList.contains('active'),
      overflow: document.body.scrollWidth <= window.innerWidth
    }));
    ok('CS_ON เป็น false', st.on === false);
    ok('ป้ายรุ่นเป็น v5.2', st.ver === 'v5.2', st.ver);
    ok('สถานะเป็น off', st.st === 'off', st.st);
    ok('ชิปคลาวด์ถูกซ่อน', st.chip === 'none', st.chip);
    ok('ไม่มีคำขอออกเน็ตเลย', st.calls === 0, 'calls=' + st.calls);
    ok('เข้าเกมได้ตามปกติ', st.playing === true);
    ok('เลย์เอาต์ไม่ล้นแนวนอน', st.overflow === true);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ═══ บล็อก 2 · คอนฟิก ═══════════════════════════════════════════════
  log('\n[2] ตั้งค่าคลาวด์ — เก็บระดับเครื่อง ไม่ผูกบัญชี');
  {
    const page = await newPage(browser);
    await enter(page, 'cfg01');
    await settle(page);
    await cloudOn(page);
    const a = await page.evaluate(() => ({
      on: CS_ON, chip: getComputedStyle(document.getElementById('csChip')).display,
      raw: JSON.parse(localStorage.getItem('yao_cloud') || '{}')
    }));
    ok('CS_ON เป็น true หลังตั้งค่า', a.on === true);
    ok('ชิปคลาวด์โผล่บนแถบหัว', a.chip !== 'none');
    ok('คอนฟิกถูกเก็บที่ yao_cloud', a.raw.provider === 'supabase' && a.raw.url === 'https://fake.test');
    /* ปิดคลาวด์แล้วต้องยุบกลับ */
    await page.evaluate(() => csCfgSave({ provider: '' }));
    const b = await page.evaluate(() => ({ on: CS_ON, st: CS_ST, chip: getComputedStyle(document.getElementById('csChip')).display }));
    ok('ปิดคลาวด์แล้ว CS_ON กลับเป็น false', b.on === false && b.st === 'off');
    ok('ปิดคลาวด์แล้วชิปหายไป', b.chip === 'none');
    await page.context().close();
  }

  // ═══ บล็อก 3 · ส่งข้อมูลขึ้นคลาวด์ ═══════════════════════════════════
  log('\n[3] Auto-Save — ส่ง doc + an ขึ้นคลาวด์');
  {
    const page = await newPage(browser);
    await enter(page, 'push01');
    await settle(page);
    await cloudOn(page);
    await page.evaluate(() => {
      G.floor = 7; G.maxFloor = 9; G.gold = 1234; G.level = 5; G.correct = 40; G.wrong = 10;
      G.wordStats = { 1: { seen: 6, wrong: 4, totalMs: 0, lastSeen: Date.now(), recent: [] },
                      4: { seen: 5, wrong: 2, totalMs: 0, lastSeen: Date.now(), recent: [] },
                      9: { seen: 3, wrong: 0, totalMs: 0, lastSeen: Date.now(), recent: [] } };
      saveProgress();
    });
    const okFlush = await flush(page);
    const r = (await rows(page))['push01'];
    ok('ส่งสำเร็จ', okFlush === true);
    ok('มีแถวของผู้เล่นบนคลาวด์', !!r);
    ok('คีย์หลักคือ usr', r && r.usr === 'push01');
    ok('มีห้องเรียนติดไปด้วย', r && r.room === 'ม.4', r && r.room);
    ok('doc เก็บบัญชีทั้งก้อน', r && r.doc && r.doc.gold === 1234 && r.doc.maxFloor === 9);
    ok('doc ไม่มีรหัสผ่านตัวเป็น ๆ', r && r.doc && r.doc.pw === undefined);
    ok('มีแฮชรหัสผ่านแทน', r && typeof r.pwh === 'string' && r.pwh.length > 0);
    ok('an.lv ตรง', r && r.an.lv === 5, r && r.an.lv);
    ok('an.mfloor ตรง', r && r.an.mfloor === 9);
    ok('an.acc คำนวณถูก (40/50)', r && r.an.acc === 80, r && r.an.acc);
    ok('an มีอันดับแรงค์', r && typeof r.an.rank === 'string' && r.an.rank.length > 0, r && r.an.rank);
    ok('an มีค่าสถานะ AGI', r && typeof r.an.agi === 'number');
    ok('an มีความคืบหน้าเควส 2 ชุด', r && r.an.quest && r.an.tquest);
    ok('กล่องส่งออกว่างหลังส่งสำเร็จ', (await page.evaluate(() => csOutCount())) === 0);
    ok('ชิปขึ้นสถานะซิงก์แล้ว', (await page.evaluate(() => CS_ST)) === 'ok');

    /* คำที่ผิดซ้ำ ≥2 ครั้ง ต้องถูกส่งไปให้ครู เรียงจากผิดมากไปน้อย */
    const w = r.an.weak;
    ok('an.weak มี 2 คำ (ตัดคำที่ผิด 0 ครั้งออก)', w.length === 2, 'len=' + w.length);
    ok('an.weak เรียงจากผิดมากสุดก่อน', w[0].wrong === 4 && w[1].wrong === 2);
    ok('an.weak แนบอักษรจีนกับพินอิน', w[0].ch === '阿拉伯文' && !!w[0].py, w[0].ch + '/' + w[0].py);
    await page.context().close();
  }

  // ═══ บล็อก 4 · หน่วง/ยุบการเขียนถี่ ๆ ════════════════════════════════
  log('\n[4] Debounce — เขียนรัว ๆ ต้องไม่ยิงคำขอรัวตาม');
  {
    const page = await newPage(browser);
    await enter(page, 'deb01');
    await settle(page);
    await cloudOn(page);
    await flush(page);
    const before = await page.evaluate(() => window.__CS.log.length);
    await page.evaluate(() => { for (let i = 0; i < 12; i++) saveProgress(); });
    await page.waitForTimeout(400);
    const mid = await page.evaluate(() => ({ calls: window.__CS.log.length, pend: CS_T !== null, dirty: CS_DIRTY }));
    ok('เขียน 12 ครั้งแล้วยังไม่ยิงคำขอเพิ่ม', mid.calls === before, 'calls=' + (mid.calls - before));
    ok('ตั้งนาฬิกาหน่วงไว้แล้ว', mid.pend === true);
    ok('ทำเครื่องหมายว่ามีของค้าง', mid.dirty === true);
    await flush(page);
    ok('กล่องส่งออกยุบเหลือรายการเดียวต่อคน', (await page.evaluate(() => csOutCount())) === 0);
    ok('บนคลาวด์มีแถวเดียวของผู้เล่นคนนี้', Object.keys(await rows(page)).length === 1);
    await page.context().close();
  }

  // ═══ บล็อก 5 · เน็ตหลุด → พักไว้ในเครื่อง → ส่งเองเมื่อกลับมา ═════════
  log('\n[5] Fallback — เน็ตหลุดต้องไม่ทำข้อมูลหาย');
  {
    const page = await newPage(browser);
    await enter(page, 'net01');
    await settle(page);
    await cloudOn(page);
    await page.evaluate(() => { window.__CS.fail = 1; G.gold = 777; saveProgress(); });
    const r1 = await flush(page);
    const s1 = await page.evaluate(() => ({ out: csOutCount(), st: CS_ST, cls: document.getElementById('csChip').className, chip: document.getElementById('csChip').textContent }));
    ok('ส่งไม่สำเร็จคืน false', r1 === false);
    ok('ของค้างอยู่ในกล่องส่งออก 1 รายการ', s1.out === 1, 'out=' + s1.out);
    ok('สถานะเปลี่ยนเป็นส่งไม่สำเร็จ', s1.st === 'err', s1.st);
    ok('ชิปเปลี่ยนหน้าเป็นเตือน', /cs-err/.test(s1.cls) && /⚠️/.test(s1.chip), s1.chip);
    ok('บนคลาวด์ยังไม่มีแถว', Object.keys(await rows(page)).length === 0);
    ok('ข้อมูลยังอยู่ครบในเครื่อง', (await page.evaluate(() => loadStore()['net01'].gold)) === 777);

    /* สัญญาณกลับมา → เหตุการณ์ online ต้องดันคิวเองโดยไม่ต้องกดอะไร */
    await page.evaluate(() => { window.__CS.fail = 0; window.dispatchEvent(new Event('online')); });
    await page.waitForTimeout(600);
    const r = (await rows(page))['net01'];
    ok('พอสัญญาณกลับมา ระบบส่งให้เองอัตโนมัติ', !!r && r.doc.gold === 777);
    ok('กล่องส่งออกว่างแล้ว', (await page.evaluate(() => csOutCount())) === 0);
    ok('สถานะกลับเป็นซิงก์แล้ว', (await page.evaluate(() => CS_ST)) === 'ok');
    await page.context().close();
  }

  // ═══ บล็อก 6 · ล็อกอินข้ามเครื่อง — ดึงข้อมูลจากคลาวด์มาใช้ ═══════════
  log('\n[6] Cross-device — เครื่องใหม่ต้องได้ความคืบหน้าเดิมกลับมา');
  {
    const page = await newPage(browser);
    /* จำลอง "เครื่องใหม่" : ไม่มีบัญชีในเครื่องเลย แต่มีแถวอยู่บนคลาวด์ */
    await page.evaluate(() => {
      csCfgSave({ provider: 'supabase', url: 'https://fake.test', key: 'k', table: 'hunters', auto: true });
      const a = blankAccount('sky01', 'สกาย', 'pw123456', 'ม.4');
      a.maxFloor = 12; a.floor = 12; a.gold = 4321; a.level = 9; a.correct = 88;
      const doc = {}; Object.keys(a).forEach(k => { if (k !== 'pw') doc[k] = a[k]; });
      window.__CS.rows['sky01'] = { usr: 'sky01', room: 'ม.4', name: 'สกาย', pwh: csPwh('sky01', 'pw123456'),
                                    rev: 4, ts: Date.now() - 1000, dev: 'other', ver: 'v5.2', doc: doc, an: { mfloor: 12 } };
      localStorage.setItem('yao_students', '{}');
    });
    await page.evaluate(() => enterGate());
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'sky01';
      document.getElementById('login-pw').value = 'pw123456';
      handleSubmit();
    });
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => ({
      playing: document.getElementById('gameScreen').classList.contains('active'),
      user: CURRENT_USER, floor: G.maxFloor, gold: G.gold, lv: G.level,
      pw: (loadStore()['sky01'] || {}).pw, srv: CS_SRV
    }));
    ok('ล็อกอินเข้าเกมได้', st.playing === true && st.user === 'sky01');
    ok('ได้ชั้นสูงสุดจากคลาวด์', st.floor === 12, 'floor=' + st.floor);
    ok('ได้ทองจากคลาวด์', st.gold === 4321, 'gold=' + st.gold);
    ok('ได้เลเวลจากคลาวด์', st.lv === 9);
    ok('รหัสผ่านถูกเติมกลับจากที่ผู้เล่นพิมพ์', st.pw === 'pw123456');
    ok('จำ ts ของเซิร์ฟเวอร์ไว้แล้ว', st.srv > 0);
    ok('บันทึกเซสชันไว้ล็อกอินเงียบครั้งหน้า', !!(await page.evaluate(() => csSesLoad())));
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ═══ บล็อก 7 · ตรวจตัวตนกับคลาวด์ ════════════════════════════════════
  log('\n[7] Auth — รหัสผิด / สมัครทับ / ระงับสิทธิ์');
  {
    const page = await newPage(browser);
    await page.evaluate(() => {
      csCfgSave({ provider: 'supabase', url: 'https://fake.test', key: 'k', table: 'hunters' });
      const a = blankAccount('dup01', 'ดุ๊ก', 'pw123456', 'ม.4');
      const doc = {}; Object.keys(a).forEach(k => { if (k !== 'pw') doc[k] = a[k]; });
      window.__CS.rows['dup01'] = { usr: 'dup01', room: 'ม.4', name: 'ดุ๊ก', pwh: csPwh('dup01', 'pw123456'),
                                    rev: 1, ts: Date.now(), dev: 'other', doc: doc, an: {} };
      localStorage.setItem('yao_students', '{}');
    });
    await page.evaluate(() => enterGate());
    await page.waitForTimeout(700);

    await page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'dup01';
      document.getElementById('login-pw').value = 'wrongpw';
      handleSubmit();
    });
    await page.waitForTimeout(700);
    let s = await page.evaluate(() => ({ err: document.getElementById('login-err').textContent,
                                         playing: document.getElementById('gameScreen').classList.contains('active') }));
    ok('รหัสผิดเทียบกับคลาวด์แล้วเข้าไม่ได้', s.playing === false);
    ok('มีข้อความบอกว่ารหัสไม่ตรงกับคลาวด์', /คลาวด์/.test(s.err), s.err);

    await page.evaluate(() => {
      switchTab('register');
      document.getElementById('reg-id').value = 'dup01';
      document.getElementById('reg-pw').value = 'pw999999';
      document.getElementById('reg-pw2').value = 'pw999999';
      handleSubmit();
    });
    await page.waitForTimeout(700);
    s = await page.evaluate(() => ({ err: document.getElementById('login-err').textContent,
                                     playing: document.getElementById('gameScreen').classList.contains('active'),
                                     local: !!loadStore()['dup01'] }));
    ok('สมัครทับรหัสฮันเตอร์ที่มีบนคลาวด์ไม่ได้', s.playing === false && s.local === false);
    ok('มีข้อความบอกว่าถูกใช้แล้ว', /ถูกใช้แล้ว/.test(s.err), s.err);

    /* บัญชีที่ถูก GM ระงับจากอีกเครื่อง ต้องเข้าไม่ได้ทันทีที่นี่ */
    await page.evaluate(() => { window.__CS.rows['dup01'].doc.frozen = true; });
    await page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'dup01';
      document.getElementById('login-pw').value = 'pw123456';
      handleSubmit();
    });
    await page.waitForTimeout(700);
    s = await page.evaluate(() => ({ err: document.getElementById('login-err').textContent,
                                     playing: document.getElementById('gameScreen').classList.contains('active') }));
    ok('บัญชีที่ถูกระงับบนคลาวด์เข้าไม่ได้', s.playing === false);
    ok('มีข้อความบอกว่าถูกระงับ', /ระงับ/.test(s.err), s.err);
    await page.context().close();
  }

  // ═══ บล็อก 8 · ข้อมูลชนกัน — Timestamp-based Server Wins ═════════════
  log('\n[8] Conflict — เล่นสองเครื่องพร้อมกันต้องไม่เกิดการปั๊มของ');
  {
    const page = await newPage(browser);
    await enter(page, 'cf01');
    await settle(page);
    await cloudOn(page);
    await page.evaluate(() => { G.gold = 100; saveProgress(); });
    await flush(page);
    /* อีกเครื่องเล่นทีหลังแล้วเขียนก้อนที่ใหม่กว่าไว้ */
    await page.evaluate(() => {
      const r = window.__CS.rows['cf01'];
      const doc = JSON.parse(JSON.stringify(r.doc));
      doc.gold = 99999; doc.maxFloor = 15;
      window.__CS.rows['cf01'] = Object.assign({}, r, { doc: doc, ts: Date.now() + 600000, rev: r.rev + 5, dev: 'phone-b' });
      G.gold = 250; saveProgress();
    });
    const r2 = await flush(page);
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => ({
      gate: document.getElementById('snGate').classList.contains('active'),
      txt: document.getElementById('snGate').textContent,
      halt: CS_HALT, srvGold: window.__CS.rows['cf01'].doc.gold,
      bak: JSON.parse(localStorage.getItem('yao_cloud_bak') || 'null')
    }));
    ok('ตรวจเจอว่าคลาวด์ใหม่กว่า', r2 === true && g.halt === true);
    ok('ก้อนของเครื่องนี้ไม่ได้ถูกเขียนทับขึ้นไป', g.srvGold === 99999, 'srvGold=' + g.srvGold);
    ok('เด้งหน้าต่างบังคับกดยืนยัน', g.gate === true);
    ok('ข้อความบอกว่าเจอข้อมูลใหม่กว่า', /ใหม่กว่า/.test(g.txt));
    ok('สำรองก้อนของเครื่องนี้ไว้ก่อนเสมอ', !!g.bak && g.bak.user === 'cf01');
    await page.evaluate(() => snGateConfirm());
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({
      playing: document.getElementById('gameScreen').classList.contains('active'),
      gold: G.gold, floor: G.maxFloor, halt: CS_HALT, user: CURRENT_USER
    }));
    ok('กดยืนยันแล้วกลับเข้าเกมด้วยก้อนของคลาวด์', after.playing === true && after.user === 'cf01');
    ok('ทองเป็นของก้อนที่ใหม่กว่า', after.gold === 99999, 'gold=' + after.gold);
    ok('ชั้นสูงสุดเป็นของก้อนที่ใหม่กว่า', after.floor === 15);
    ok('ปลดสถานะหยุดส่งแล้ว', after.halt === false);
    await page.context().close();
  }

  // ═══ บล็อก 9 · ข้อมูลสดของทั้งห้อง → กระดานผู้นำ + ห้องควบคุม GM ══════
  log('\n[9] Live room data — กระดานผู้นำและตาราง GM ต้องเห็นข้อมูลสด');
  {
    const page = await newPage(browser);
    await enter(page, 'me01');
    await settle(page);
    await cloudOn(page);
    await page.evaluate(() => {
      G.gold = 500; G.correct = 30; saveProgress();
      ['mate1', 'mate2'].forEach(function (u, i) {
        const a = blankAccount(u, 'เพื่อน' + (i + 1), 'pw123456', 'ม.4');
        a.maxFloor = 10 + i; a.level = 6 + i; a.correct = 50; a.wrong = 5; a.gold = 900 + i;
        const doc = {}; Object.keys(a).forEach(k => { if (k !== 'pw') doc[k] = a[k]; });
        window.__CS.rows[u] = { usr: u, room: 'ม.4', name: 'เพื่อน' + (i + 1), pwh: 'x', rev: 1,
                                ts: Date.now(), dev: 'other', doc: doc,
                                an: { lv: 6 + i, mfloor: 10 + i, acc: 91, gold: 900 + i, words: 40 + i,
                                      weak: [{ id: 1, ch: '阿拉伯文', py: 'x', wrong: 3, seen: 5 }] } };
      });
    });
    await flush(page);                       /* ดันแถวของตัวเองขึ้นคลาวด์ก่อน ไม่งั้นห้องจะมีแค่เพื่อน */
    const got = await page.evaluate(() => csRoomPull('ม.4', true));
    ok('ดึงรายชื่อทั้งห้องได้', got.length === 3, 'rows=' + got.length);
    const store = await page.evaluate(() => Object.keys(loadStore()));
    ok('เพื่อนร่วมห้องถูกเขียนลงเครื่องนี้', store.indexOf('mate1') >= 0 && store.indexOf('mate2') >= 0, store.join(','));
    ok('บัญชีที่กำลังเล่นอยู่ไม่ถูกทับ', (await page.evaluate(() => loadStore()['me01'].gold)) === 500);

    await page.evaluate(() => { openBoard(); });
    await page.waitForTimeout(400);
    const b = await page.evaluate(() => ({
      body: document.getElementById('gBoardBody').textContent,
      scope: document.getElementById('gBoardScope').textContent
    }));
    ok('กระดานผู้นำเห็นเพื่อนจากคลาวด์', /เพื่อน1/.test(b.body) && /เพื่อน2/.test(b.body));
    ok('กระดานบอกว่าเป็นอันดับสด', /อันดับสด/.test(b.scope), b.scope);
    await page.evaluate(() => closeBoard());

    /* เรียก renderBoard ซ้ำ ๆ ต้องไม่สะสมข้อความ (กับดักข้อ 2) */
    await page.evaluate(() => { for (let i = 0; i < 5; i++) renderBoard(); });
    const dupB = await page.evaluate(() => (document.getElementById('gBoardScope').textContent.match(/อันดับสด/g) || []).length);
    ok('ข้อความอันดับสดไม่สะสมซ้ำ', dupB === 1, 'n=' + dupB);

    await page.evaluate(() => { openGm(); });
    await page.waitForTimeout(300);
    const gm = await page.evaluate(() => ({
      scope: document.getElementById('gcScope').textContent,
      table: document.querySelector('#gmPanel .gm-table').textContent,
      btn: document.querySelectorAll('#csGmBtn').length
    }));
    ok('ตาราง GM เห็นเพื่อนจากคลาวด์', /เพื่อน1/.test(gm.table));
    ok('หัวแผง GM บอกจำนวนข้อมูลสด', /ข้อมูลสดจากคลาวด์/.test(gm.scope), gm.scope.slice(-60));
    ok('ปุ่ม ☁️ คลาวด์ มีใบเดียว', gm.btn === 1);
    await page.evaluate(() => { for (let i = 0; i < 5; i++) gmRender(); });
    const dupG = await page.evaluate(() => (document.getElementById('gcScope').textContent.match(/ข้อมูลสดจากคลาวด์/g) || []).length);
    ok('ข้อความบนหัวแผง GM ไม่สะสมซ้ำ', dupG === 1, 'n=' + dupG);

    await page.evaluate(() => csGmOpen());
    await page.waitForTimeout(200);
    const cg = await page.evaluate(() => ({
      on: document.getElementById('csGm').classList.contains('active'),
      body: document.getElementById('csGmBody').textContent,
      rows: document.querySelectorAll('#csGmBody tbody tr').length,
      isModal: document.getElementById('csGm').classList.contains('g-modal')
    }));
    ok('แผงคลาวด์ของ GM เปิดได้', cg.on === true);
    ok('แผงคลาวด์เป็น .g-modal (v4.8.1 นับเป็นหน้าต่างระบบเอง)', cg.isModal === true);
    ok('ตารางข้อมูลสดมีครบทุกคน', cg.rows === 3, 'rows=' + cg.rows);
    ok('ตารางโชว์คำที่ผิดซ้ำให้ครู', /阿拉伯文/.test(cg.body));
    await page.evaluate(() => csGmClose());
    await page.context().close();
  }

  // ═══ บล็อก 10 · Auto Silent Relogin ══════════════════════════════════
  log('\n[10] Auto Silent Relogin — เปิดแอปแล้วเข้าเลย');
  {
    const page = await newPage(browser);
    await enter(page, 'ses01');
    await settle(page);
    await cloudOn(page);
    await page.evaluate(() => { G.gold = 321; saveProgress(); });
    await flush(page);
    /* startGame บันทึกเซสชันให้ตอนคลาวด์เปิดอยู่ */
    await page.evaluate(() => { exitGame(); });
    await page.waitForTimeout(400);
    ok('กดออกจากเกทแล้วลืมเครื่องนี้', (await page.evaluate(() => csSesLoad())) === null);

    await page.evaluate(() => { csSesSave('ses01', 'pw123456'); CS_GATE = false; });
    const done = await page.evaluate(() => csSilent());
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => ({
      playing: document.getElementById('gameScreen').classList.contains('active'),
      user: CURRENT_USER, gold: G.gold
    }));
    ok('ล็อกอินเงียบสำเร็จ', done === true && s.playing === true && s.user === 'ses01');
    ok('ได้ข้อมูลเดิมกลับมาครบ', s.gold === 321, 'gold=' + s.gold);

    /* กดเข้าเกทเองแล้วต้องไม่ถูกลากเข้าบัญชีอื่นกลางคัน */
    await page.evaluate(() => { exitGame(); csSesSave('ses01', 'pw123456'); CS_GATE = true; });
    await page.waitForTimeout(300);
    const blocked = await page.evaluate(() => csSilent());
    ok('กดเข้าเกทเองแล้วยกเลิกล็อกอินเงียบ', blocked === false);

    /* เซสชันหมดอายุต้องไม่ถูกใช้ */
    await page.evaluate(() => {
      CS_GATE = false;
      localStorage.setItem('yao_cloud_ses', JSON.stringify({ u: 'ses01', pw: 'pw123456', at: Date.now() - 30 * 864e5 }));
    });
    ok('เซสชันเกิน 14 วันถูกปัดตก', (await page.evaluate(() => csSilent())) === false);
    await page.context().close();
  }

  // ═══ บล็อก 11 · จุดยิงอัตโนมัติตามสเปก ═══════════════════════════════
  log('\n[11] Auto-Save Triggers — ตอบข้อ / เคลียร์ชั้น / ซื้อของ / สลับแอป');
  {
    const page = await newPage(browser);
    await enter(page, 'trg01');
    await settle(page);
    await cloudOn(page);
    await flush(page);

    const mark = () => page.evaluate(() => { window.__CS.log.length = 0; CS_DIRTY = false; });
    const pushed = () => page.evaluate(() => window.__CS.log.filter(function (l) { return /PATCH|POST/.test(l); }).length);

    await mark();
    await page.evaluate(() => { G.floor = 3; G.floorProgress = 0; clearFloor(false); });
    await page.waitForTimeout(500);
    ok('เคลียร์ชั้นแล้วส่งทันที', (await pushed()) > 0);

    await mark();
    await page.evaluate(() => { G.gold = 5000; renderStats(); buyItem('potion'); });
    await page.waitForTimeout(500);
    ok('ซื้อของแล้วส่งทันที', (await pushed()) > 0);

    await mark();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);
    ok('สลับแอป/ซ่อนแท็บแล้วส่งทันที', (await pushed()) > 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await mark();
    await page.evaluate(() => { saveProgress(); });
    await page.waitForTimeout(200);
    ok('ตอบจบข้อ (saveProgress) เข้าคิวแบบหน่วง ไม่ยิงทันที', (await pushed()) === 0);
    ok('แต่ทำเครื่องหมายค้างส่งไว้แล้ว', (await page.evaluate(() => CS_DIRTY)) === true);
    await page.context().close();
  }

  // ═══ บล็อก 12 · ข้อมูลบัญชี + ความปลอดภัยพื้นฐาน ═════════════════════
  log('\n[12] ฟิลด์บัญชี · idempotent · escape');
  {
    const page = await newPage(browser);
    await enter(page, 'mig01');
    await settle(page);
    const m = await page.evaluate(() => {
      const a = migrateAccount({ user: 'x', level: 1 });
      const b = JSON.stringify(migrateAccount(a).cs);
      migrateAccount(a);
      return { has: !!a.cs, same: b === JSON.stringify(a.cs), rev: a.cs.rev };
    });
    ok('migrateAccount เติมฟิลด์ cs ให้บัญชีเก่า', m.has === true);
    ok('เรียกซ้ำแล้วค่าไม่เพี้ยน (idempotent)', m.same === true && m.rev === 0);

    await cloudOn(page);
    await page.evaluate(() => {
      window.__CS.rows['evil'] = { usr: 'evil', room: 'ม.4', name: '<img src=x onerror="window.__pwn=1">',
                                   pwh: 'x', rev: 1, ts: Date.now(), dev: 'o',
                                   doc: { user: 'evil', level: 1, classroom: 'ม.4' }, an: { lv: 1, weak: [] } };
    });
    await page.evaluate(() => csRoomPull('ม.4', true));
    await page.evaluate(() => csGmOpen());
    await page.waitForTimeout(300);
    const x = await page.evaluate(() => ({ pwn: window.__pwn === 1, imgs: document.querySelectorAll('#csGmBody img').length }));
    ok('ชื่อจากคลาวด์ถูก escape ก่อนแสดง', x.pwn === false && x.imgs === 0);
    await page.evaluate(() => csGmClose());

    const cfg = await page.evaluate(() => {
      csCfgSave({ url: 'https://fake.test/', table: '  ' });
      return { url: CS_CFG.url, table: CS_CFG.table };
    });
    ok('ตัด / ท้าย URL ให้เอง', cfg.url === 'https://fake.test', cfg.url);
    ok('ชื่อตารางว่างตกกลับเป็นค่าเริ่มต้น', cfg.table === 'hunters', cfg.table);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ═══ บล็อก 13 · แผงสถานะฝั่งนักเรียน ═════════════════════════════════
  log('\n[13] ชิป + แผงสถานะของนักเรียน');
  {
    const page = await newPage(browser);
    await enter(page, 'ui01');
    await settle(page);
    await cloudOn(page);
    await flush(page);
    await page.evaluate(() => csPanel());
    await page.waitForTimeout(200);
    const p = await page.evaluate(() => ({
      on: document.getElementById('snPanel').classList.contains('active'),
      body: document.getElementById('snPanelBody').textContent,
      overflow: document.body.scrollWidth <= window.innerWidth
    }));
    ok('แผงสถานะคลาวด์เปิดได้', p.on === true);
    ok('บอกผู้ให้บริการที่ใช้อยู่', /supabase/.test(p.body));
    ok('บอกจำนวนที่ค้างส่ง', /ค้างส่ง/.test(p.body));
    ok('เลย์เอาต์ยังไม่ล้นแนวนอน', p.overflow === true);
    await page.evaluate(() => { csForget(); });
    ok('ปุ่มเลิกจำเครื่องนี้ล้างเซสชันจริง', (await page.evaluate(() => csSesLoad())) === null);
    await page.evaluate(() => snClosePanel());
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  await browser.close();
  log('\n═══════════════════════════════════');
  log('  PASS ' + PASS + ' · FAIL ' + FAIL);
  log('═══════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
