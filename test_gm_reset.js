/* ชุดเทสต์ Patch v7.4 — GM MODULAR RESET · AUTH PRESERVATION · EXPLICIT LOOP COUNTER
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_gm_reset.js            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'gm_reset_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง */
const STUB = `
  window.__NET = { log: [] };
  window.fetch = function (u, o) {
    window.__NET.log.push({ url: String(u), method: (o && o.method) || 'GET' });
    return Promise.resolve({ ok: true, status: 200,
      text: function () { return Promise.resolve('null'); },
      json: function () { return Promise.resolve(null); } });
  };
  window.EventSource = function (url) {
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
`;

function live(u, over) {
  return Object.assign({
    u: u, name: 'ฮันเตอร์ ' + u, room: '',
    lv: 7, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 8, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44, loops: 0,
    title: '', frozen: false,
    weak: [{ id: 3, ch: '你', py: 'nǐ', n: 4, seen: 9 }],
    at: Date.now(), dev: 'devX', ver: '5.3'
  }, over || {});
}

/* ผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง แล้วเข้าห้องควบคุมด้วย TEACHER_PIN */
async function enterPanel(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(300);
}

async function seedLive(page, rows) {
  await page.evaluate(function (rs) {
    FB_LIVE = {};
    rs.forEach(function (r) { FB_LIVE[r.u] = r; });
    FB_MST = 'live';
    fbPaint();
  }, rows);
  await page.waitForTimeout(250);
}

/* บัญชีทดสอบในทะเบียนของเครื่อง — ตั้งค่าให้ "เล่นมาเยอะแล้ว" ทุกช่อง */
async function seedStore(page) {
  await page.evaluate(() => {
    const a = blankAccount('nut', 'ณัฐ ใจกล้า', '1234', 'ม.4/2');
    a.level = 30; a.exp = 250; a.gold = 5400; a.totalGoldEarned = 9000;
    a.floor = 15; a.maxFloor = 18; a.floorProgress = 2;
    a.bossClears = 4; a.towerClears = 3;
    a.correct = 300; a.wrong = 40; a.best = 22; a.streak = 5;
    a.wordStats = { 1: { seen: 5, wrong: 1 }, 2: { seen: 3, wrong: 0 } };
    a.items = { potion: 3 };
    a.createdAt = 111222333;
    a.gcLog = [{ t: 1, i: '🎁', m: 'เดิม' }];
    a.sessions = [{ s: 1, e: 2 }]; a.loginCount = 9; a.lastLogin = 55; a.playMs = 4321;
    a.trFloors = { '7': { n: 4, ok: 3, ids: [1] } };
    const s = loadStore(); s.nut = a; saveStore(s);
    gmRender();
  });
  await page.waitForTimeout(150);
}

async function acc(page, u) {
  return page.evaluate(function (k) {
    const a = loadStore()[k];
    if (!a) return null;
    return { user: a.user, name: a.name, pw: a.pw, classroom: a.classroom, createdAt: a.createdAt,
             frozen: !!a.frozen, level: a.level, exp: a.exp, gold: a.gold, tgold: a.totalGoldEarned,
             floor: a.floor, maxFloor: a.maxFloor, prog: a.floorProgress,
             boss: a.bossClears, loops: a.towerClears,
             correct: a.correct, wrong: a.wrong, best: a.best,
             words: Object.keys(a.wordStats || {}).length,
             items: (a.items && a.items.potion) || 0,
             tr: Object.keys(a.trFloors || {}).length,
             gcLog: (a.gcLog || []).length, sessions: (a.sessions || []).length,
             loginCount: a.loginCount, playMs: a.playMs,
             str: a.stats && a.stats.str, vit: a.stats && a.stats.vit };
  }, u);
}

async function fresh(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

async function confirmOk(page) {
  await page.waitForTimeout(120);
  await page.evaluate(() => { const b = document.getElementById('gmModalOk'); if (b) b.click(); });
  await page.waitForTimeout(350);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · สารบัญโหมด + ฟิลด์ Auth ═══════════════════════════════════════════
  {
    say('\n═══ 1 · สารบัญโหมดรีเซ็ต · ฟิลด์ Auth · ทางเข้าชุดเทสต์ ═══');
    const { ctx, page, errs } = await fresh(browser);

    eq('มีโหมดรีเซ็ต 4 แบบตามสเปก',
       await page.evaluate(() => BA_MR_MODES.map(m => m.id)), ['full', 'level', 'floor', 'gold']);
    eq('ฟิลด์ Auth ครบตามสเปก (u/name/pass/class/registeredAt) + frozen',
       await page.evaluate(() => BA_MR_AUTH),
       ['user', 'name', 'pw', 'classroom', 'createdAt', 'frozen']);
    ok('รายการที่ต้องคงไว้รวมประวัติฝั่งครูของ v4.3 ด้วย',
       await page.evaluate(() => ['gcLog', 'sessions', 'loginCount', 'lastLogin', 'playMs']
         .every(k => BA_MR_KEEP.indexOf(k) >= 0)),
       await page.evaluate(() => BA_MR_KEEP));
    ok('ไอคอนของแต่ละโหมดตรงสเปก 🧹👑🗼🪙',
       await page.evaluate(() => BA_MR_MODES.map(m => m.icon).join('')) === '🧹👑🗼🪙');

    const au = await page.evaluate(() => baBattleAudit().gmReset);
    eq('audit บอกรุ่น 7.4', au.ver, '7.4');
    eq('audit เริ่มที่ 0 ครั้ง', au.runs, 0);
    ok('สไตล์ของแพตช์ถูกติดตั้งตั้งแต่โหลดหน้า', au.dom.styled, au.dom);
    ok('ยังไม่มีโมดัลจนกว่าจะกดปุ่ม (แทรกแบบ lazy)', au.dom.modal === false, au.dom);

    const lc = await page.evaluate(() => baBattleAudit().loopCounter);
    eq('audit ตัวนับรอบบอกรุ่น 7.4', lc.ver, '7.4');

    eq('หนีบเลขให้เป็นจำนวนเต็มไม่ติดลบ',
       await page.evaluate(() => [baLcInt(0), baLcInt(-3), baLcInt(2.6), baLcInt(NaN), baLcInt(undefined)]),
       [0, 0, 3, 0, 0]);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 2 · Full Reset — ล้างสถานะเกมโดยไม่แตะ Auth ═══════════════════════════
  {
    say('\n═══ 2 · ล้างทั้งหมด (คง Auth) ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seedStore(page);

    const before = await acc(page, 'nut');
    const r = await page.evaluate(() => baMrApply('nut', 'full'));
    const after = await acc(page, 'nut');

    ok('คืนผลลัพธ์ของการรีเซ็ตกลับมา', !!r && r.mode === 'full', r);
    ok('รายงานว่า Auth ปลอดภัย', r && r.auth === true, r);

    eq('รหัสฮันเตอร์คงเดิม', after.user, before.user);
    eq('ชื่อคงเดิม', after.name, before.name);
    eq('รหัสผ่านลับคงเดิม', after.pw, '1234');
    eq('กลุ่มห้องเรียนคงเดิม', after.classroom, 'ม.4/2');
    eq('วันที่สมัครคงเดิม', after.createdAt, 111222333);

    eq('เลเวลกลับเป็น 1', after.level, 1);
    eq('EXP กลับเป็น 0', after.exp, 0);
    eq('ทองกลับเป็น 0', after.gold, 0);
    eq('ชั้นกลับเป็น 1', after.floor, 1);
    eq('ชั้นสูงสุดกลับเป็น 1 (migrateAccount ของ v4.0 หนีบ <1 ให้เอง)', after.maxFloor, 1);
    eq('รอบเคลียร์หอคอยกลับเป็น 0', after.loops, 0);
    eq('บอสที่ปราบกลับเป็น 0', after.boss, 0);
    eq('ตอบถูก/ผิดกลับเป็น 0', [after.correct, after.wrong], [0, 0]);
    eq('คลังคำศัพท์ถูกล้าง', after.words, 0);
    eq('กระเป๋าถูกล้าง', after.items, 0);
    eq('บันทึกรายชั้นของเรดาร์ถูกล้าง', after.tr, 0);
    eq('ค่าพลัง (atk/def ของสเปก) กลับเป็นฐาน', [after.str, after.vit], [10, 10]);

    eq('ประวัติกิจกรรมของครูไม่หาย (เพิ่มบรรทัดรีเซ็ตอีก 1)', after.gcLog, before.gcLog + 1);
    eq('รายการเซสชันไม่หาย', after.sessions, before.sessions);
    eq('จำนวนครั้งที่เข้าเกทไม่หาย', after.loginCount, 9);
    eq('เวลาเล่นสะสมไม่หาย', after.playMs, 4321);

    /* สถานะระงับสิทธิ์ต้องไม่ถูกปลดโดยไม่ตั้งใจ */
    await page.evaluate(() => { const s = loadStore(); s.nut.frozen = true; saveStore(s); });
    await page.evaluate(() => baMrApply('nut', 'full'));
    ok('❄️ ระงับสิทธิ์ไม่ถูกปลดตอนรีเซ็ต', (await acc(page, 'nut')).frozen === true);

    eq('ไม่พบไอดี = คืน null ไม่โยน error',
       await page.evaluate(() => baMrApply('ไม่มีคนนี้', 'full')), null);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 3 · Selective Reset 3 โหมด ════════════════════════════════════════════
  {
    say('\n═══ 3 · รีเซ็ตแยกส่วน 👑 Lv/EXP · 🗼 ชั้น · 🪙 ทอง ═══');

    { /* 👑 */
      const { ctx, page, errs } = await fresh(browser);
      await enterPanel(page); await seedStore(page);
      await page.evaluate(() => baMrApply('nut', 'level'));
      const a = await acc(page, 'nut');
      eq('👑 เลเวลกลับเป็น 1', a.level, 1);
      eq('👑 EXP กลับเป็น 0', a.exp, 0);
      eq('👑 ทองไม่ถูกแตะ', a.gold, 5400);
      eq('👑 ชั้นไม่ถูกแตะ', [a.floor, a.maxFloor], [15, 18]);
      eq('👑 รอบเคลียร์ไม่ถูกแตะ', a.loops, 3);
      eq('👑 คลังคำศัพท์ไม่ถูกแตะ', a.words, 2);
      eq('👑 รหัสผ่านลับคงเดิม', a.pw, '1234');
      ok('ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
    { /* 🗼 */
      const { ctx, page, errs } = await fresh(browser);
      await enterPanel(page); await seedStore(page);
      await page.evaluate(() => baMrApply('nut', 'floor'));
      const a = await acc(page, 'nut');
      eq('🗼 ชั้นกลับเป็น 1', a.floor, 1);
      eq('🗼 ชั้นสูงสุดกลับเป็นต้นหอคอย', a.maxFloor, 1);
      eq('🗼 ความคืบหน้าในชั้นกลับเป็น 0', a.prog, 0);
      eq('🗼 รอบเคลียร์กลับเป็น 0', a.loops, 0);
      eq('🗼 บอสที่ปราบกลับเป็น 0', a.boss, 0);
      eq('🗼 บันทึกรายชั้นของเรดาร์ถูกล้าง', a.tr, 0);
      eq('🗼 เลเวลไม่ถูกแตะ', a.level, 30);
      eq('🗼 ทองไม่ถูกแตะ', a.gold, 5400);
      eq('🗼 คลังคำศัพท์ไม่ถูกแตะ', a.words, 2);
      eq('🗼 รหัสผ่านลับคงเดิม', a.pw, '1234');
      ok('ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
    { /* 🪙 */
      const { ctx, page, errs } = await fresh(browser);
      await enterPanel(page); await seedStore(page);
      await page.evaluate(() => baMrApply('nut', 'gold'));
      const a = await acc(page, 'nut');
      eq('🪙 ทองกลับเป็น 0', a.gold, 0);
      eq('🪙 ทองสะสมตลอดชีพไม่ถูกแตะ (เควส L6 ของ v4.2 ใช้ค่านี้)', a.tgold, 9000);
      eq('🪙 เลเวลไม่ถูกแตะ', a.level, 30);
      eq('🪙 ชั้นไม่ถูกแตะ', [a.floor, a.maxFloor], [15, 18]);
      eq('🪙 รหัสผ่านลับคงเดิม', a.pw, '1234');
      ok('ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  // ═══ 4 · นักเรียนต้องล็อกอินด้วยรหัสเดิมได้ทันทีหลังรีเซ็ต ═══════════════════
  {
    say('\n═══ 4 · ล็อกอินด้วยรหัสเดิมหลังถูกรีเซ็ต ═══');
    const { ctx, page, errs } = await fresh(browser);

    await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(120);
    await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      switchTab('register');
      document.getElementById('reg-id').value = 'kim';
      document.getElementById('reg-pw').value = '4321';
      document.getElementById('reg-pw2').value = '4321';
      handleSubmit();
    });
    await page.waitForTimeout(900);
    ok('สมัครแล้วเข้าเกมได้', await page.evaluate(() => CURRENT_USER === 'kim'));

    await page.evaluate(() => { G.level = 12; G.gold = 800; G.floor = 7; G.maxFloor = 9; saveProgress(); exitGame(); });
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => baMrApply('kim', 'full'));
    ok('รีเซ็ตขณะไม่ได้อยู่ในเกมทำงานได้', !!r, r);

    await page.evaluate(() => { switchTab('login'); document.getElementById('login-id').value = 'kim'; document.getElementById('login-pw').value = '4321'; handleSubmit(); });
    await page.waitForTimeout(900);
    ok('ล็อกอินด้วยรหัสเดิมผ่าน', await page.evaluate(() => CURRENT_USER === 'kim'));
    eq('เข้ามาแล้วเป็นบัญชีที่ถูกล้างจริง',
       await page.evaluate(() => [G.level, G.gold, G.floor]), [1, 0, 1]);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 5 · เมนู GM แยกส่วน — ปุ่ม 🔄 ใบเดิม ═══════════════════════════════════
  {
    say('\n═══ 5 · เมนูเลือกโหมด (ไม่เพิ่มปุ่มในคอลัมน์ ⚙️ จัดการ) ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page); await seedStore(page);

    eq('คอลัมน์ ⚙️ จัดการ ยังมีปุ่ม 6 ใบเท่าเดิม (กับดักข้อ 9)',
       await page.evaluate(() => document.querySelectorAll('#gmBody tr:first-child .gm-row-btns .gm-btn').length), 6);

    /* กดปุ่มจริงจากในตาราง ไม่ใช่เรียกฟังก์ชันตรง ๆ */
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#gmBody tr .gm-row-btns .gm-btn'))
        .filter(x => /gmResetProgress/.test(x.getAttribute('onclick') || ''))[0];
      b.click();
    });
    await page.waitForTimeout(250);

    const st = await page.evaluate(() => {
      const m = document.getElementById('baMrModal');
      return { open: !!(m && m.classList.contains('active')),
               btns: document.querySelectorAll('#baMrModal .ba-mr-btn').length,
               who: (document.getElementById('baMrWho') || {}).textContent || '',
               user: BA_MR_USER };
    });
    ok('กด 🔄 แล้วเมนูเปิด', st.open, st);
    eq('เมนูมีปุ่มครบ 4 โหมด', st.btns, 4);
    eq('เมนูจำว่ากำลังทำกับใคร', st.user, 'nut');
    ok('หัวเมนูบอกชื่อ · เลเวล · ชั้นสูงสุด · รอบ', /nut/.test(st.who) && /รอบที่ 3/.test(st.who), st.who);

    /* กับดักข้อ 25 — ".active" ไม่ใช่หลักฐานว่ามองเห็น ต้องยิง elementFromPoint จริง */
    const seen = await page.evaluate(() => {
      const inner = document.querySelector('#baMrModal .g-modal-inner');
      const r = inner.getBoundingClientRect();
      let hit = 0, miss = 0;
      for (let x = 0.1; x < 1; x += 0.2) for (let y = 0.1; y < 1; y += 0.2) {
        const el = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
        if (el && el.closest && el.closest('#baMrModal')) hit++; else miss++;
      }
      return { hit, miss, z: getComputedStyle(document.getElementById('baMrModal')).zIndex };
    });
    ok('เมนูมองเห็นจริงทุกจุด ไม่ได้อยู่หลังห้องควบคุม', seen.miss === 0, seen);
    ok('z-index เหนือ #gmPanel(500) แต่ใต้ #gmModal(820)',
       +seen.z > 500 && +seen.z < 820, seen.z);

    /* เลือกโหมด 🪙 แล้วยืนยัน */
    await page.evaluate(() => document.querySelector('#baMrModal .ba-mr-btn[data-ba-mr="gold"]').click());
    await page.waitForTimeout(150);
    ok('กดโหมดแล้วเมนูปิดเอง เหลือแต่หน้าต่างยืนยัน',
       await page.evaluate(() => !document.getElementById('baMrModal').classList.contains('active')));
    ok('หน้าต่างยืนยันของ v4.0 เด้งขึ้นมา',
       await page.evaluate(() => document.getElementById('gmModal').classList.contains('active')));
    await confirmOk(page);
    eq('ยืนยันแล้วทองถูกล้างจริง', (await acc(page, 'nut')).gold, 0);
    eq('เลเวลไม่ถูกแตะ', (await acc(page, 'nut')).level, 30);

    /* กดยกเลิกต้องไม่มีผลข้างเคียง */
    await page.evaluate(() => { const s = loadStore(); s.nut.gold = 777; saveStore(s); gmRender(); });
    await page.evaluate(() => { gmResetProgress('nut'); });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('#baMrModal .ba-mr-btn[data-ba-mr="full"]').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => gmModalClose());
    await page.waitForTimeout(200);
    eq('กดยกเลิกแล้วไม่มีอะไรถูกล้าง', (await acc(page, 'nut')).gold, 777);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 6 · ตัวนับรอบในตาราง LIVE (#fbBody) ═══════════════════════════════════
  {
    say('\n═══ 6 · ตัวนับรอบเคลียร์หอคอย — ตาราง LIVE ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seedLive(page, [
      live('a1', { lv: 34, mfloor: 20, floor: 3, loops: 3 }),
      live('a2', { lv: 8,  mfloor: 12, floor: 12, loops: 0 }),
      live('a3', { lv: 5,  mfloor: 0,  floor: 1,  loops: 0 })
    ]);

    const cells = await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr')).map(tr =>
      ({ u: tr.dataset.baUser, t: tr.cells[3].textContent.replace(/\s+/g, ' ').trim(),
         b: (tr.cells[3].querySelector('b') || {}).textContent })));
    const a1 = cells.find(c => c.u === 'a1'), a2 = cells.find(c => c.u === 'a2'), a3 = cells.find(c => c.u === 'a3');

    ok('คนที่วน 3 รอบโชว์ "20 / 20 (รอบที่ 3)"', /^20 \/ 20 \(รอบที่ 3\)/.test(a1.t), a1.t);
    ok('คนที่ยังไม่วนรอบก็ยังโชว์ "(รอบที่ 0)" เสมอ', /\(รอบที่ 0\)/.test(a2.t), a2.t);
    ok('ชั้นสูงสุด 0 โชว์เป็น "0 / 20 (รอบที่ 0)" ตามสเปก',
       /^0 \/ 20 \(รอบที่ 0\)/.test(a3.t), a3.t);
    ok('บรรทัดล่างยังเป็น "ยืนอยู่ชั้น N"',
       /ยืนอยู่ชั้น 3/.test(a1.t) && /ยืนอยู่ชั้น 12/.test(a2.t), [a1.t, a2.t]);
    eq('<b> ยังหุ้มชั้นสูงสุดเป็นตัวเลขตัวแรกของช่อง (xpDomRows ของ v5.5 อ่านตรงนี้)',
       [a1.b, a2.b, a3.b], ['20', '12', '0']);
    eq('ยังเป็น 10 คอลัมน์เท่าเดิม ไม่ได้แทรกคอลัมน์ใหม่',
       await page.evaluate(() => document.querySelectorAll('#fbBody tr')[0].cells.length), 10);

    /* Export ของ v5.5 ต้องอ่านชั้นสูงสุดถูก ไม่ไปหยิบเลขรอบมาแทน */
    const xp = await page.evaluate(() => xpDomRows().map(r => ({ u: r.u, mfloor: r.mfloor })));
    eq('xpDomRows อ่านชั้นสูงสุดถูกทุกแถว',
       xp.map(r => r.mfloor), [20, 12, 0]);

    /* วาดซ้ำหลายรอบต้องไม่สะสมวงเล็บซ้อน (กับดักข้อ 2) */
    await page.evaluate(() => { fbPaint(); fbPaint(); fbPaint(); });
    await page.waitForTimeout(150);
    eq('วาดซ้ำแล้วมีวงเล็บรอบแถวละใบเดียว',
       await page.evaluate(() => document.querySelectorAll('#fbBody .ba-loop').length), 3);
    ok('ข้อความไม่ซ้อนกัน',
       await page.evaluate(() => /^20 \/ 20 \(รอบที่ 3\)/.test(
         document.querySelectorAll('#fbBody tr')[0].cells[3].textContent.replace(/\s+/g, ' ').trim())));

    /* สัญญาณอัปเดตรอบใหม่ ตัวเลขต้องขยับตามทันที */
    await page.evaluate(() => { FB_LIVE.a2.loops = 5; FB_LIVE.a2.mfloor = 20; fbPaint(); });
    await page.waitForTimeout(200);
    ok('สัญญาณรอบใหม่เข้ามาแล้วตัวเลขขยับตาม',
       await page.evaluate(() => Array.from(document.querySelectorAll('#fbBody tr'))
         .some(tr => /\(รอบที่ 5\)/.test(tr.cells[3].textContent))));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 7 · ตัวนับรอบในตารางจัดการ (#gmBody) ══════════════════════════════════
  {
    say('\n═══ 7 · ตัวนับรอบเคลียร์หอคอย — ตารางจัดการ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page); await seedStore(page);

    const t = await page.evaluate(() => {
      const tr = document.getElementById('gmBody').rows[0];
      return { t: tr.cells[2].textContent.replace(/\s+/g, ' ').trim(),
               b: (tr.cells[2].querySelector('b') || {}).textContent,
               sub: !!tr.cells[2].querySelector('.gm-sub'),
               firstSub: tr.querySelector('.gm-sub').textContent };
    });
    ok('โชว์ "18 / 20 (รอบที่ 3)"', /^18 \/ 20 \(รอบที่ 3\)/.test(t.t), t.t);
    ok('มีบรรทัดล่าง "ยืนอยู่ชั้น 15"', /ยืนอยู่ชั้น 15/.test(t.t), t.t);
    eq('<b> หุ้มชั้นสูงสุด', t.b, '18');
    ok('.gm-sub ใบแรกของแถวยังเป็นของคอลัมน์ชื่อ (v4.3/v5.7 อ่านตรงนี้)',
       /@nut/.test(t.firstSub), t.firstSub);

    await page.evaluate(() => { const s = loadStore(); s.nut.towerClears = 0; s.nut.maxFloor = 1; s.nut.floor = 1; saveStore(s); gmRender(); });
    await page.waitForTimeout(200);
    ok('รอบ 0 ก็ยังโชว์วงเล็บเสมอ',
       await page.evaluate(() => /\(รอบที่ 0\)/.test(document.getElementById('gmBody').rows[0].cells[2].textContent)));

    await page.evaluate(() => { gmRender(); gmRender(); });
    await page.waitForTimeout(150);
    eq('วาดซ้ำแล้วมีวงเล็บใบเดียว',
       await page.evaluate(() => document.querySelectorAll('#gmBody .ba-loop').length), 1);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 8 · ซิงค์ loops ผ่าน payload / lrApply / lrSig ═════════════════════════
  {
    say('\n═══ 8 · loops เดินทางจากเครื่องนักเรียนถึงตารางของครู ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page); await seedStore(page);

    eq('fbPayload พก loops ไปด้วย',
       await page.evaluate(() => fbPayload('nut', loadStore().nut).loops), 3);
    ok('lrSig รวม loops เข้าลายเซ็นด้วย',
       await page.evaluate(() => lrSig([{ u: 'x', words: 1, loops: 2 }]) !== lrSig([{ u: 'x', words: 1, loops: 9 }])));
    ok('lrApply เขียน loops ลง towerClears ของทะเบียน',
       await page.evaluate(() => { const a = { towerClears: 0 }; lrApply(a, { u: 'x', loops: 4 }); return a.towerClears; }) === 4);
    ok('baLiveMap ค้นได้ทั้งคีย์โหนดและรหัสฮันเตอร์ดิบ',
       await page.evaluate(() => {
         FB_LIVE = {}; FB_LIVE[encodeURIComponent('น้อง ก')] = { u: 'น้อง ก', loops: 2, mfloor: 5, floor: 5 };
         const m = baLiveMap();
         return !!m['น้อง ก'] && m['น้อง ก'].loops === 2;
       }));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 9 · ไม่กระทบหน้าจอเล่น ════════════════════════════════════════════════
  {
    say('\n═══ 9 · หน้าจอเล่นไม่ขยับแม้แต่พิกเซลเดียว ═══');
    for (const w of [320, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 844 } });
      await ctx.addInitScript(STUB);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String((e && e.message) || e)));
      await page.route('**fonts.googleapis.com**', r => r.abort());
      await page.goto(FILE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);

      await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(120);
      await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        switchTab('register');
        document.getElementById('reg-id').value = 'p' + Math.floor(Math.random() * 1e6);
        document.getElementById('reg-pw').value = '1111';
        document.getElementById('reg-pw2').value = '1111';
        handleSubmit();
      });
      await page.waitForTimeout(1200);
      /* ปิดหน้าต่างจั่วการ์ดของ v4.7 ที่คั่นตอนเข้าเกม */
      await page.evaluate(() => { const c = document.querySelector('#cdDraft.active .cd-card'); if (c) c.click(); });
      await page.waitForTimeout(800);

      const h = await page.evaluate(() => {
        /* บังคับคำ/ตัวเลือกให้คงที่ก่อนวัดเสมอ ไม่งั้นความสูงแกว่งตามความยาวข้อความ */
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        document.getElementById('gFeedback').textContent = '';
        const card = document.querySelector('.g-battle-card') || document.querySelector('.ac-battle');
        return card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : -1;
      });
      ok('จอ ' + w + ': การ์ดโจทย์สูง ' + h + 'px (' + (w === 320 ? '354.8' : '340.8') + ')',
         Math.abs(h - (w === 320 ? 354.8 : 340.8)) < 1.2, h);
      ok('จอ ' + w + ': ไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('จอ ' + w + ': ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  process.exit(FAIL ? 1 : 0);
})();
