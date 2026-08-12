/* ชุดเทสต์ชั้นที่สิบเก้า — v5.7 · LIVE ROSTER BRIDGE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_live_roster.js            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'live_roster_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + extra : '')); }
}

/* stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   และเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง */
const STUB = `
  window.__NET = { hits: 0, sse: 0 };
  window.fetch = function (u, o) {
    window.__NET.hits++;
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve('{}'); },
                             json: function () { return Promise.resolve({}); } });
  };
  window.EventSource = function (url) {
    window.__NET.sse++;
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
`;

/* ตัวอย่าง payload ของ v5.3 (fbPayload) — ก้อนแบนราว 1KB ไม่ใช่บัญชีทั้งก้อน */
function live(u, over) {
  return Object.assign({
    u: u, name: 'ฮันเตอร์ ' + u, room: 'ม.4/1',
    lv: 7, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 8, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44,
    title: '', frozen: false,
    weak: [{ id: 3, ch: '你', py: 'nǐ', n: 4, seen: 9 }],
    at: Date.now(), dev: 'devX', ver: '5.3'
  }, over || {});
}

async function enterPanel(page) {
  /* ผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง แล้วเข้าห้องควบคุมด้วยรหัส GM */
  await page.evaluate(() => {
    const b = document.getElementById('rgBody');
    if (b) b.scrollTop = b.scrollHeight;
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.getElementById('teacher-code').value = TEACHER_PIN;
    openTeacherPanel();
  });
  await page.waitForTimeout(300);
}

async function fresh(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ── บล็อก 1: ทะเบียนว่าง + สัญญาณสด 2 คน → ตารางล่างต้องขึ้นครบ ──────────
  say('\n【บล็อก 1】ทะเบียนในเครื่องว่าง แต่มีเด็กออนไลน์ 2 คน');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    const before = await page.evaluate(() => ({
      store: Object.keys(loadStore()).length,
      rows: document.getElementById('gmBody').rows.length,
      empty: getComputedStyle(document.getElementById('gmEmpty')).display
    }));
    ok('ก่อนมีสัญญาณ: ทะเบียนว่างจริง', before.store === 0, JSON.stringify(before));
    ok('ก่อนมีสัญญาณ: ตารางล่างว่างและขึ้นข้อความ', before.rows === 0 && before.empty !== 'none',
       JSON.stringify(before));

    const after = await page.evaluate((rows) => {
      FB_LIVE = { a1: rows[0], b2: rows[1] };
      gmRender();
      const body = document.getElementById('gmBody');
      return {
        store: Object.keys(loadStore()).length,
        rows: body.rows.length,
        users: Array.prototype.map.call(body.rows, tr => tr.dataset.gcUser),
        empty: getComputedStyle(document.getElementById('gmEmpty')).display,
        text: body.textContent,
        kpi: document.getElementById('kpiStudents').textContent
      };
    }, [live('a1'), live('b2')]);

    ok('ตารางล่างแสดง 2 แถว', after.rows === 2, JSON.stringify(after.users));
    ok('ผูกรหัสฮันเตอร์ครบทั้งสองแถว', after.users.join(',') === 'a1,b2', JSON.stringify(after.users));
    ok('ข้อความ "ยังไม่มีฮันเตอร์ลงทะเบียน" หายไป', after.empty === 'none', after.empty);
    ok('ทะเบียนในเครื่องได้ 2 บัญชี', after.store === 2, after.store);
    ok('KPI จำนวนฮันเตอร์ = 2', after.kpi === '2', after.kpi);
    ok('เห็นชื่อฮันเตอร์บนตาราง', /ฮันเตอร์ a1/.test(after.text) && /ฮันเตอร์ b2/.test(after.text));

    const vals = await page.evaluate(() => {
      const a = loadStore()['a1'];
      return { lv: a.level, gold: a.gold, mfloor: a.maxFloor, floor: a.floor,
               corr: a.correct, wrong: a.wrong, room: a.classroom, hp: a.hp, mhp: a.maxHp,
               lrmhp: a.lrMaxHp, mp: a.mp, best: a.best, mirror: a.lrMirror === true,
               weak: (a.wordStats && a.wordStats[3]) ? a.wordStats[3].wrong : -1 };
    });
    ok('ค่าถูกผสานลงทะเบียนครบ', vals.lv === 7 && vals.gold === 1200 && vals.mfloor === 8 &&
       vals.floor === 6 && vals.corr === 90 && vals.wrong === 30 && vals.hp === 55 &&
       vals.mp === 30 && vals.best === 12, JSON.stringify(vals));
    /* maxHp เป็นค่าที่ v4.0 คำนวณใหม่ทุกครั้งที่ loadStore() ชั้นนี้จึงห้ามเขียนทับ
       แต่ต้องเก็บค่าที่เครื่องนักเรียนรายงานไว้ให้ครูดูได้ */
    ok('ไม่ไปเขียนทับ maxHp ที่ v4.0 คำนวณเอง', vals.mhp !== 190 && vals.mhp > 0, vals.mhp);
    ok('เก็บ HP สูงสุดที่นักเรียนรายงานไว้แยกฟิลด์', vals.lrmhp === 190, vals.lrmhp);
    ok('ห้องเรียนติดมาด้วย', vals.room === 'ม.4/1', vals.room);
    ok('ติดธงว่าเป็นแถวจากสัญญาณสด', vals.mirror);
    ok('คำที่ผิดซ้ำถูกปั้นกลับเป็น wordStats', vals.weak === 4, vals.weak);

    const badge = await page.evaluate(() =>
      document.querySelectorAll('#gmBody .lr-tag').length);
    ok('ทุกแถวสดมีป้าย 📡 สด', badge === 2, badge);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── บล็อก 2: ปุ่ม 📋 แฟ้มฮันเตอร์ และ 💊 เติม HP/MP ต้องกดได้จริง ──────────
  say('\n【บล็อก 2】ปุ่มของ v4.3 บนแถวที่มาจากสัญญาณสด');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await page.evaluate((r) => { FB_LIVE = { a1: r }; gmRender(); }, live('a1'));

    const btns = await page.evaluate(() => {
      const tr = document.getElementById('gmBody').rows[0];
      const b = tr.querySelectorAll('.gc-row-btn');
      return { n: b.length, txt: Array.prototype.map.call(b, x => x.textContent) };
    });
    ok('แถวมีปุ๊ม 📋 แฟ้มฮันเตอร์ + 💊 เติม HP/MP', btns.n === 2 &&
       /แฟ้มฮันเตอร์/.test(btns.txt[0]) && /เติม HP\/MP/.test(btns.txt[1]), JSON.stringify(btns));

    /* กดปุ่มจริงจากในตาราง ไม่ใช่เรียกฟังก์ชันตรง ๆ */
    const file = await page.evaluate(() => {
      document.querySelector('#gmBody tr .gc-row-btn').click();
      const m = document.getElementById('gcModal');
      return {
        active: !!(m && m.classList.contains('active')),
        title: (document.getElementById('gcTitle') || {}).textContent || '',
        tabs: document.querySelectorAll('#gcTabs .gc-tab').length,
        body: (document.getElementById('gcBody') || {}).textContent.length,
        note: !!document.querySelector('#gcBody .lr-note')
      };
    });
    ok('กด 📋 แล้วแฟ้มฮันเตอร์เปิดจริง', file.active, JSON.stringify(file));
    ok('หัวแฟ้มเป็นของฮันเตอร์คนนั้น', /a1/.test(file.title), file.title);
    ok('มีแท็บครบ 4 ใบ', file.tabs === 4, file.tabs);
    ok('เนื้อแฟ้มไม่ว่าง', file.body > 50, file.body);
    ok('มีคำอธิบายว่าแถวนี้มาจากสัญญาณสด', file.note);

    /* พิสูจน์ว่ามองเห็นจริง ไม่ใช่แค่มีคลาส active (กับดักข้อ 25) */
    const seen = await page.evaluate(() => {
      const box = document.querySelector('#gcModal .gc-box');
      if (!box) return { hit: 0, all: 0 };
      const r = box.getBoundingClientRect();
      let hit = 0, all = 0;
      for (let x = 0.15; x < 1; x += 0.2) {
        for (let y = 0.15; y < 1; y += 0.2) {
          const el = document.elementFromPoint(r.left + r.width * x, r.top + r.height * y);
          all++;
          if (el && el.closest('#gcModal')) hit++;
        }
      }
      return { hit: hit, all: all };
    });
    ok('แฟ้มฮันเตอร์มองเห็นจริงทุกจุดที่วัด', seen.all > 0 && seen.hit === seen.all, JSON.stringify(seen));

    await page.evaluate(() => gcClose());
    const heal = await page.evaluate(() => {
      const bt = document.querySelectorAll('#gmBody tr .gc-row-btn')[1];
      const before = loadStore()['a1'];
      const b = { hp: before.hp, mp: before.mp, mhp: before.maxHp };
      bt.click();
      const a = loadStore()['a1'];
      return { b: b, hp: a.hp, mp: a.mp, mhp: a.maxHp, mx: 0, log: (a.gcLog || []).length };
    });
    ok('กด 💊 แล้ว HP เต็มจริง', heal.hp === heal.mhp && heal.b.hp < heal.mhp, JSON.stringify(heal));
    ok('กด 💊 แล้ว MP ขยับขึ้น', heal.mp > heal.b.mp, JSON.stringify(heal));
    ok('บันทึกลงประวัติกิจกรรมของฮันเตอร์', heal.log > 0, heal.log);

    /* เครื่องมือชุดเดิมในคอลัมน์ ⚙️ จัดการ ต้องทำงานกับแถวสดด้วย */
    const gift = await page.evaluate(() => {
      const g0 = loadStore()['a1'].gold;
      gmGift('a1');
      document.getElementById('gmModalInput').value = '250';
      document.getElementById('gmModalOk').click();
      return { before: g0, after: loadStore()['a1'].gold };
    });
    ok('🎁 แจกทองใช้ได้กับแถวสด', gift.after === gift.before + 250, JSON.stringify(gift));

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── บล็อก 3: สัญญาณเข้ามาระหว่างเปิดแผง → ตารางล่างต้องตามทัน ───────────
  say('\n【บล็อก 3】สัญญาณสดเข้ามาตอนกางแผงอยู่');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await page.evaluate((r) => { FB_LIVE = { a1: r }; fbPaint(); }, live('a1'));
    await page.waitForTimeout(200);
    let n = await page.evaluate(() => document.getElementById('gmBody').rows.length);
    ok('คนแรกโผล่เองโดยไม่ต้องกดรีเฟรช', n === 1, n);

    await page.evaluate((r) => { FB_LIVE.b2 = r; fbPaint(); }, live('b2'));
    await page.waitForTimeout(200);
    n = await page.evaluate(() => document.getElementById('gmBody').rows.length);
    ok('คนที่สองโผล่ตามมาเอง', n === 2, n);

    const upd = await page.evaluate(() => {
      FB_LIVE.a1 = Object.assign({}, FB_LIVE.a1, { gold: 9999, lv: 11, at: Date.now() + 1000 });
      fbPaint();
      return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
        const a = loadStore()['a1'];
        res({ gold: a.gold, lv: a.level, txt: document.getElementById('gmBody').textContent });
      })));
    });
    ok('ค่าที่เปลี่ยนถูกอัปเดตลงทะเบียน', upd.gold === 9999 && upd.lv === 11, JSON.stringify(upd));
    ok('ตารางล่างวาดค่าใหม่แล้ว', /9999/.test(upd.txt));

    /* ต้องไม่วนไม่จบ: gmRender → fbPaint → lrSync → gmRender … */
    const loop = await page.evaluate(() => {
      let count = 0;
      const _g = gmRender;
      gmRender = function () { count++; return _g.apply(this, arguments); };
      gmRender();
      return new Promise(res => setTimeout(() => { gmRender = _g; res(count); }, 700));
    });
    ok('ไม่วนซ้ำไม่รู้จบ (เรียก gmRender ครั้งเดียว)', loop === 1, loop);

    const wr = await page.evaluate(() => {
      let w = 0;
      const _s = saveStore;
      saveStore = function () { w++; return _s.apply(this, arguments); };
      for (let i = 0; i < 12; i++) fbPaint();
      const r = w; saveStore = _s; return r;
    });
    ok('สัญญาณเดิมซ้ำ ๆ ไม่เขียน localStorage ฟรี', wr === 0, wr);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── บล็อก 4: ห้ามทับข้อมูลของจริง ──────────────────────────────────────
  say('\n【บล็อก 4】ขอบเขตการเขียนทับ');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    const keep = await page.evaluate(() => {
      const s = loadStore();
      s['real'] = blankAccount('real', 'ของจริง', 'pw12', 'ม.4/2');
      s['real'].gold = 777; s['real'].level = 3;
      s['real'].items = { potion: 4 }; s['real'].wordStats = { 9: { seen: 5, wrong: 1, recent: [1] } };
      s['real'].lastActive = Date.now() + 600000;      /* ในเครื่องใหม่กว่าสัญญาณ */
      saveStore(s);
      FB_LIVE = { real: { u: 'real', name: 'ปลอม', lv: 99, gold: 1, at: Date.now() } };
      gmRender();
      const a = loadStore()['real'];
      return { gold: a.gold, lv: a.level, pw: a.pw, items: a.items.potion, mirror: !!a.lrMirror };
    });
    ok('สัญญาณเก่ากว่าไม่ทับบัญชีของจริง', keep.gold === 777 && keep.lv === 3, JSON.stringify(keep));
    ok('รหัสผ่านและกระเป๋าของบัญชีจริงไม่ถูกแตะ', keep.pw === 'pw12' && keep.items === 4, JSON.stringify(keep));
    ok('บัญชีของจริงไม่ถูกติดธงแถวสด', keep.mirror === false);

    const newer = await page.evaluate(() => {
      FB_LIVE = { real: { u: 'real', name: 'ของจริง', lv: 9, gold: 4321, at: Date.now() + 900000,
                          weak: [] } };
      LR_SIG = '';
      gmRender();
      const a = loadStore()['real'];
      return { gold: a.gold, lv: a.level, items: a.items.potion, ws: !!(a.wordStats && a.wordStats[9]) };
    });
    ok('สัญญาณใหม่กว่าอัปเดตค่าที่แสดงผลได้', newer.gold === 4321 && newer.lv === 9, JSON.stringify(newer));
    ok('ของที่ payload ไม่มี (กระเป๋า · สถิติคำ) ไม่ถูกล้างทิ้ง', newer.items === 4 && newer.ws,
       JSON.stringify(newer));

    /* บัญชีที่กำลังเล่นบนเครื่องนี้ห้ามถูกแตะเด็ดขาด */
    const cur = await page.evaluate(async () => {
      closeGm();
      switchTab('register');
      document.getElementById('reg-id').value = 'me';
      document.getElementById('reg-name').value = 'ครู';
      document.getElementById('reg-pw').value = 'pw12';
      document.getElementById('reg-pw2').value = 'pw12';
      handleSubmit();
      return new Promise(res => setTimeout(() => {
        G.gold = 500; saveProgress();
        FB_LIVE = { me: { u: 'me', name: 'คนอื่น', lv: 77, gold: 3, at: Date.now() + 900000 } };
        LR_SIG = '';
        openGm();
        const a = loadStore()['me'];
        res({ user: CURRENT_USER, gold: a.gold, lv: a.level, name: a.name });
      }, 1200));
    });
    ok('บัญชีที่กำลังเล่นอยู่ไม่ถูกสัญญาณสดทับ',
       cur.user === 'me' && cur.gold === 500 && cur.lv !== 77, JSON.stringify(cur));

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── บล็อก 5: แถวสดต้องไม่ขวางการล็อกอิน/สมัคร ─────────────────────────
  say('\n【บล็อก 5】เครื่องที่ใช้ร่วมกัน');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await page.evaluate((r) => { FB_LIVE = { stu: r }; gmRender(); }, live('stu'));
    ok('มีแถวสดของ stu อยู่ในทะเบียน',
       await page.evaluate(() => !!loadStore()['stu'] && loadStore()['stu'].lrMirror === true));

    const reg = await page.evaluate(() => {
      closeGm();
      switchTab('register');
      document.getElementById('reg-id').value = 'stu';
      document.getElementById('reg-name').value = 'นักเรียนตัวจริง';
      document.getElementById('reg-pw').value = 'pw12';
      document.getElementById('reg-pw2').value = 'pw12';
      handleSubmit();
      return new Promise(res => setTimeout(() => res({
        err: document.getElementById('login-err').textContent,
        user: CURRENT_USER,
        game: document.getElementById('gameScreen').classList.contains('active'),
        mirror: !!(loadStore()['stu'] || {}).lrMirror,
        pw: (loadStore()['stu'] || {}).pw
      }), 1400));
    });
    ok('สมัครด้วยรหัสที่มีแถวสดอยู่ได้ตามปกติ', reg.user === 'stu' && reg.game === true,
       JSON.stringify(reg));
    ok('ไม่มีข้อความ "รหัสฮันเตอร์นี้มีผู้ใช้แล้ว"', !/มีผู้ใช้แล้ว/.test(reg.err), reg.err);
    ok('บัญชีกลายเป็นของจริง (ธงแถวสดหลุด · รหัสผ่านเป็นของนักเรียน)',
       reg.mirror === false && reg.pw === 'pw12', JSON.stringify(reg));

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── บล็อก 6: ล้างแถวสด + ตัวกรองกลุ่ม + ความสะอาดของจอ ────────────────
  say('\n【บล็อก 6】ล้างแถวสด · ตัวกรองกลุ่ม · เลย์เอาต์');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await page.evaluate((rows) => {
      const s = loadStore();
      s['real'] = blankAccount('real', 'ของจริง', 'pw12', 'ม.5/9');
      saveStore(s);
      FB_LIVE = { a1: rows[0], b2: rows[1] };
      gmRender();
    }, [live('a1'), live('b2', { room: 'ม.6/2' })]);

    const room = await page.evaluate(() => {
      GC_ROOM = 'ม.6/2';
      gmRender();
      const body = document.getElementById('gmBody');
      const shown = Array.prototype.filter.call(body.rows, tr => tr.style.display !== 'none');
      const r = { n: shown.length, u: shown.map(tr => tr.dataset.gcUser), kpi: document.getElementById('kpiStudents').textContent };
      GC_ROOM = '';
      gmRender();
      return r;
    });
    ok('ตัวกรองกลุ่มของ v4.3 ยังใช้ได้กับแถวสด', room.n === 1 && room.u[0] === 'b2', JSON.stringify(room));

    /* โหนดของ v5.3 ไม่มีใครลบแถวเก่าทิ้ง FB_LIVE จึงยังถือข้อมูลคนที่เลิกเล่นไปแล้วอยู่
       ปุ่มล้างต้องปิดปากไว้ด้วย ไม่งั้นรอบ hydrate ถัดไปจะปั้นกลับมาทันที */
    const purge = await page.evaluate(() => {
      const n = lrPurge(true);
      const s = loadStore();
      return { n: n, keys: Object.keys(s), rows: document.getElementById('gmBody').rows.length,
               empty: getComputedStyle(document.getElementById('gmEmpty')).display };
    });
    ok('🧹 ล้างแถวสดลบเฉพาะแถวที่ปั้นเอง', purge.n === 2 && purge.keys.join(',') === 'real',
       JSON.stringify(purge));
    ok('บัญชีของจริงยังอยู่ในตาราง', purge.rows === 1 && purge.empty === 'none', JSON.stringify(purge));

    const stay = await page.evaluate(() => {
      for (let i = 0; i < 3; i++) { fbPaint(); gmRender(); }
      return Object.keys(loadStore()).sort().join(',');
    });
    ok('ล้างแล้วไม่ถูกปั้นกลับมาเอง (ข้อมูลยังเป็นก้อนเดิม)', stay === 'real', stay);

    const back = await page.evaluate(() => {
      FB_LIVE.a1 = Object.assign({}, FB_LIVE.a1, { at: Date.now() + 5000 });   /* กลับมาเล่นจริง */
      LR_SIG = '';
      gmRender();
      return Object.keys(loadStore()).sort().join(',');
    });
    ok('คนที่กลับมาเล่นจริงโผล่กลับมาเอง', back === 'a1,real', back);

    const btn = await page.evaluate(() => {
      for (let i = 0; i < 5; i++) gmRender();
      const row = Array.prototype.filter.call(
        document.getElementById('gmBody').rows, tr => tr.dataset.gcUser === 'real')[0];
      return { purge: document.querySelectorAll('#lrPurgeBtn').length,
               realTag: row ? row.querySelectorAll('.lr-tag').length : -1,
               liveTag: document.querySelectorAll('#gmBody .lr-tag').length };
    });
    ok('ปุ่มล้างแถวสดแทรกครั้งเดียว (กับดักข้อ 2)', btn.purge <= 1, btn.purge);
    ok('บัญชีของจริงไม่มีป้าย 📡 สด', btn.realTag === 0, btn.realTag);
    ok('ป้ายไม่สะสมซ้ำเมื่อวาดหลายรอบ', btn.liveTag === 1, btn.liveTag);

    const lay = await page.evaluate(() => ({
      over: document.body.scrollWidth <= window.innerWidth,
      tables: document.querySelectorAll('#gmPanel .gm-table').length
    }));
    ok('เลย์เอาต์ไม่ล้นแนวนอน', lay.over, lay.over);
    ok('ไม่ได้ไปยืมคลาสตารางของชั้นล่าง (.gm-table ยังมีใบเดียว)', lay.tables === 1, lay.tables);

    const el = await page.evaluate(() => {
      let log = [];
      try { log = JSON.parse(localStorage.getItem('yao_errlog') || '[]'); } catch (e) {}
      return log.filter(x => /LR:/.test(String(x && x.msg || ''))).map(x => x.msg);
    });
    ok('ไม่มีรายการ LR: ใน Error Log', el.length === 0, el.join(' | '));

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── บล็อก 7: ปิดสัญญาณ = เงียบสนิทเหมือนก่อนมีชั้นนี้ ─────────────────
  say('\n【บล็อก 7】ไม่มีสัญญาณเลย');
  {
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    const q = await page.evaluate(() => {
      let w = 0;
      const _s = saveStore;
      saveStore = function () { w++; return _s.apply(this, arguments); };
      for (let i = 0; i < 6; i++) { gmRender(); fbPaint(); }
      const r = w; saveStore = _s;
      return { writes: r, store: Object.keys(loadStore()).length,
               rows: document.getElementById('gmBody').rows.length,
               empty: document.getElementById('gmEmpty').textContent };
    });
    ok('ไม่มีสัญญาณ = ไม่เขียนทะเบียนเลย', q.writes === 0 && q.store === 0, JSON.stringify(q));
    ok('ยังขึ้นข้อความเดิมของ v4.0 ตามปกติ', /ยังไม่มีฮันเตอร์ลงทะเบียนในเกท/.test(q.empty), q.empty);
    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  say('\n══════════════════════════════════');
  say('ผ่าน ' + PASS + ' · ตก ' + FAIL);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { say('FATAL ' + (e && e.stack || e)); process.exit(1); });
