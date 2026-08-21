/* ชุดเทสต์ Micro-Patch — CLASSROOM LEADERBOARD FULL SYNC & FLEX SHOWCASE (เนมสเปซ ba)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_classroom_lb.js

   ห้ามรันขนานกับชุดอื่น — บล็อก 6 วัดจังหวะส่งขึ้นคลาวด์ด้วยเวลาจริง                     */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'classroom_lb_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* คลาวด์ปลอม — ต้องติดตั้งก่อนโหลดหน้าเสมอ เพราะ v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   และเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง
   __NET.rooms  = โหนด /rooms/{ห้อง}/leaderboard   ·  __NET.students = โหนด /students   */
const STUB = `
  window.__NET = { log: [], rooms: {}, students: {}, puts: [], fail: 0 };
  window.fetch = function (u, o) {
    u = String(u); const m = (o && o.method) || 'GET';
    window.__NET.log.push({ url: u, method: m });
    if (m === 'PUT' && /\\/rooms\\//.test(u)) {
      let b = null; try { b = JSON.parse(o.body); } catch (e) {}
      window.__NET.puts.push({ url: u, body: b });
      if (b && (b.id || b.u)) window.__NET.rooms[b.id || b.u] = b;
    }
    if (window.__NET.fail) return Promise.reject(new Error('simulated network down'));
    let d = null;
    if (m === 'GET' && /\\/rooms\\/[^/]*\\/leaderboard\\.json/.test(u)) d = window.__NET.rooms;
    else if (m === 'GET' && /\\/students\\.json/.test(u))               d = window.__NET.students;
    return Promise.resolve({ ok: true, status: 200,
      text: function () { return Promise.resolve(JSON.stringify(d)); },
      json: function () { return Promise.resolve(d); } });
  };
  window.EventSource = function (url) {
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
`;

/* payload ของ v5.3 — คีย์ตรงกับ fbPayload + loops ที่ v7.2 เติมให้ */
function live(u, over) {
  return Object.assign({
    u: u, name: 'ฮันเตอร์ ' + u, room: 'ม.4',
    lv: 7, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 8, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44, loops: 2,
    title: '', frozen: false, weak: [], at: Date.now(), dev: 'devX', ver: '5.3'
  }, over || {});
}

async function fresh(browser, vw) {
  const ctx = await browser.newContext({ viewport: { width: vw || 390, height: 844 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

/* ผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง ห้ามเรียก enterGate() ตรง ๆ */
async function pastRules(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
}

async function enterPanel(page) {
  await pastRules(page);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(300);
}

/* สมัคร + เข้าเกม แล้วปิดหน้าต่างจั่วการ์ดของ v4.7 ให้จบ ไม่งั้นเกมค้างในสถานะหยุด */
async function play(page, id) {
  await pastRules(page);
  await page.evaluate(() => { switchTab('register'); });
  await page.evaluate(function (u) {
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1111';
    document.getElementById('reg-pw2').value = '1111';
    handleSubmit();
  }, id);
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card'); if (c) c.click();
      try { snGateConfirm(); } catch (e) {}
    });
    await page.waitForTimeout(500);
  }
}

async function seedLive(page, rows) {
  await page.evaluate(function (rs) {
    FB_LIVE = {};
    rs.forEach(function (r) { FB_LIVE[r.u] = r; });
    FB_MST = 'live';
    fbPaint();
  }, rows);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · ติดตั้ง · เงียบสนิทจนกว่าจะถูกเรียก ══════════════════════════════
  {
    say('\n═══ 1 · ติดตั้ง ═══');
    const { ctx, page, errs } = await fresh(browser);
    const a = await page.evaluate(() => baBattleAudit().leaderboard);
    eq('เลขรุ่นถูกต้อง', a.ver, '7.8.1');
    ok('สไตล์ถูกติดตั้งตั้งแต่โหลดหน้า', a.styled, a);
    eq('ยังไม่มีแถวจากคลาวด์', a.cloud, 0);
    eq('ยังไม่เคยดึง/ส่งสักครั้ง', [a.n.pull, a.n.pub, a.n.paint], [0, 0, 0]);
    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 2 · Dashboard Floor & Loop Fix ══════════════════════════════════════
  {
    say('\n═══ 2 · คอลัมน์หอคอยของตารางรวม ═══');
    const { ctx, page, errs } = await fresh(browser, 1200);
    await enterPanel(page);

    /* ปั้นทะเบียนในเครื่องให้มีค่าจริง แล้วส่งสัญญาณที่ "ขาดฟิลด์" เข้ามาทับ
       — สภาพจริงของเครื่องนักเรียนที่ยังเป็นบิลด์เก่ากว่า v7.2 (ไม่มี loops เลย) */
    await page.evaluate(() => {
      const s = loadStore();
      ['a1', 'a2', 'a3'].forEach(function (u, i) {
        const a = blankAccount(u, 'ฮันเตอร์ ' + u, 'p', 'ม.4');
        a.maxFloor = [16, 11, 1][i]; a.floor = [15, 9, 1][i];
        a.towerClears = [4, 3, 0][i]; a.level = 20 + i;
        s[u] = a;
      });
      saveStore(s);
    });

    const noLoop = live('a1', { mfloor: 16, floor: 15 }); delete noLoop.loops;
    const noFloor = live('a2', { loops: 3 }); delete noFloor.mfloor;
    await seedLive(page, [noLoop, noFloor, live('a3', { mfloor: 0, floor: 1, loops: 0 })]);

    const cells = await page.evaluate(() => {
      const out = {};
      Array.prototype.forEach.call(document.querySelectorAll('#baUniBody tr'), function (tr) {
        out[tr.getAttribute('data-ba-u')] = tr.cells[2].textContent.replace(/\s+/g, ' ').trim();
      });
      return out;
    });
    ok('สัญญาณไม่มี loops → เติมรอบจากทะเบียนแทนการค้างที่ 0',
       /^16 \/ 20 \(รอบที่ 4\)/.test(cells.a1), cells.a1);
    ok('สัญญาณไม่มี mfloor → เติมชั้นสูงสุดจากทะเบียนแทนการค้างที่ 1',
       /^11 \/ 20 \(รอบที่ 3\)/.test(cells.a2), cells.a2);
    ok('สัญญาณบอก mfloor เป็น 0 ชัดเจน → ต้องโชว์ 0 ไม่ถูกเติมย้อน (กติกาของ v7.4)',
       /^0 \/ 20 \(รอบที่ 0\)/.test(cells.a3), cells.a3);

    const st = await page.evaluate(() => ({
      a1: [baMsOf('a1').mfloor, baMsOf('a1').loops],
      a2: [baMsOf('a2').mfloor, baMsOf('a2').loops],
      fmtObj: baFormatFloor(baMasterState['a1']),
      fmtNum: baFormatFloor(16, 4, 15)
    }));
    eq('สถานะกลางของ v7.7 ถือค่าเดียวกับที่วาด', [st.a1, st.a2], [[16, 4], [11, 3]]);
    ok('baFormatFloor(baMasterState[id]) ให้ผลเท่ากับแบบสามพารามิเตอร์เดิมเป๊ะ',
       st.fmtObj === st.fmtNum, [st.fmtObj, st.fmtNum]);

    /* เคสอาการจริง — เรคคอร์ดกลางค้างที่ค่าตั้งต้นของเรคคอร์ดเปล่า (1/0)
       ทั้งที่ทะเบียนรู้ค่าจริงอยู่ · จุดเรนเดอร์ต้องกู้กลับมาให้เองในรอบวาดถัดไป */
    const heal = await page.evaluate(() => {
      const before = baBattleAudit().leaderboard.n.fix;
      baMasterState['a1'].mfloor = 1; baMasterState['a1'].loops = 0; baMasterState['a1'].floor = 1;
      const row = baUniRowHtml(Object.assign({}, baMasterState['a1'],
                                             { mfloor: 1, loops: 0, floor: 1, weak: [] }));
      return { row: row.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '),
               fix: baBattleAudit().leaderboard.n.fix - before,
               fmt: baFormatFloor(baMasterState['a1']).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') };
    });
    ok('เรคคอร์ดค้างที่ 1/20 (รอบที่ 0) → จุดเรนเดอร์กู้เป็น 16/20 (รอบที่ 4)',
       /16 \/ 20 \(รอบที่ 4\)/.test(heal.row), heal.row.slice(0, 160));
    ok('baFormatFloor(เรคคอร์ดที่ค้าง) ก็กู้ค่าให้เหมือนกัน',
       /16 \/ 20 \(รอบที่ 4\)/.test(heal.fmt), heal.fmt);
    ok('ตัวนับการซ่อมเดินจริงเมื่อมีอะไรให้ซ่อม', heal.fix > 0, heal.fix);

    /* ไฟล์ Export ของ v5.5 ยังอ่านเลขตัวแรกของช่องได้ถูกทุกแถว */
    await page.evaluate(() => { baMsSync(); fbPaint(); });
    await page.waitForTimeout(200);
    const xp = await page.evaluate(() => (typeof xpDomRows === 'function' ? xpDomRows() : [])
      .map(r => r.mfloor).sort(function (a, b) { return a - b; }));
    eq('xpDomRows ของ v5.5 ยังอ่านชั้นสูงสุดถูกทุกแถว', xp, [0, 11, 16]);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 3 · ดึงกระดานจากคลาวด์ + Unique ID Deduplication ═════════════════════
  {
    say('\n═══ 3 · ซิงค์ข้ามเครื่อง + ยุบซ้ำ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await play(page, 'me1');

    await page.evaluate(() => {
      const now = Date.now();
      /* m1 อยู่ทั้งสองโหนด — โหนด /rooms ใหม่กว่า จึงต้องชนะและเหลือแถวเดียว */
      window.__NET.rooms = {
        m1: { id: 'm1', name: 'เพื่อนหนึ่ง', room: G.classroom, lv: 40, exp: 5, mexp: 300,
              mfloor: 15, loops: 2, acc: 80, ans: 200, best: 21, title: '', rank: 'C-RANK',
              buff: '🔥 เปลวเพลิงล้างบาง', at: now },
        m2: { id: 'm2', name: 'เพื่อนสอง', room: G.classroom, lv: 55, exp: 9, mexp: 400,
              mfloor: 20, loops: 5, acc: 65, ans: 300, best: 9, title: '', rank: 'B-RANK', at: now }
      };
      window.__NET.students = {
        m1: { u: 'm1', name: 'เพื่อนหนึ่ง (เก่า)', room: G.classroom, lv: 12, mfloor: 3,
              loops: 0, acc: 40, corr: 20, wrong: 30, best: 2, at: now - 600000 },
        m3: { u: 'm3', name: 'เพื่อนสาม', room: G.classroom, lv: 22, exp: 1, mexp: 250,
              mfloor: 9, loops: 0, acc: 91, corr: 91, wrong: 9, best: 30, at: now },
        zz: { u: 'zz', name: 'คนละห้อง', room: 'ม.5', lv: 99, mfloor: 20, loops: 9,
              acc: 99, corr: 990, wrong: 10, best: 99, at: now }
      };
      G.correct = 80; G.wrong = 20; G.maxFloor = 6; G.level = 12; G.best = 7; saveProgress();
      openBoard();
    });
    await page.waitForTimeout(1400);

    const a = await page.evaluate(() => baBattleAudit().leaderboard);
    ok('ดึงเพื่อนมาได้ครบสามคน', a.cloud >= 3, a.cloud);
    ok('ตัวนับการยุบซ้ำเดินจริง', a.n.dup > 0, a.n);
    const m1 = await page.evaluate(() => BA_LB_ROWS['m1']);
    ok('m1 ที่มาจากสองโหนดเหลือแถวเดียวและเป็นแถวที่ใหม่กว่า',
       m1 && m1.name === 'เพื่อนหนึ่ง' && m1.maxFloor === 15, m1);
    eq('รายชื่อรวมของห้อง = เพื่อน 3 + ตัวเราเอง', a.all, 4);
    eq('วาดครบทุกแถว', a.dom.rows, 4);

    const txt = await page.evaluate(() => document.getElementById('gBoardBody').textContent);
    ok('เห็นเพื่อนที่มาจากโหนด /rooms', /เพื่อนหนึ่ง/.test(txt) && /เพื่อนสอง/.test(txt), txt.slice(0, 200));
    ok('เห็นเพื่อนที่มาจากโหนด /students ด้วย (ตาข่ายรองรับ)', /เพื่อนสาม/.test(txt));
    ok('แถวเก่าของคนเดียวกันถูกทิ้ง ไม่โผล่ซ้อน', !/เพื่อนหนึ่ง \(เก่า\)/.test(txt));
    ok('คนละห้องไม่ถูกนับเข้ามา', !/คนละห้อง/.test(txt));
    eq('ป้าย `คุณ` ของผู้เล่นยังอยู่ใบเดียว', a.dom.me, 1);
    ok('มีบรรทัดบอกสถานะซิงค์', a.dom.sync === 1);

    /* แถบหัวกระดานของ v5.2 ต้องไม่ถูกเขียนทับ */
    const scope = await page.evaluate(() => document.getElementById('gBoardScope').textContent);
    ok('แถบหัวกระดานนับรวมคนจากคลาวด์แล้ว', /ฮันเตอร์ในห้อง 4 คน/.test(scope), scope);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 4 · Flex Showcase ════════════════════════════════════════════════════
  {
    say('\n═══ 4 · ของโชว์กระตุ้นการแข่งขัน ═══');
    const { ctx, page, errs } = await fresh(browser);
    await play(page, 'me1');
    await page.evaluate(() => {
      const now = Date.now();
      window.__NET.rooms = {
        m1: { id: 'm1', name: 'ที่หนึ่ง', room: G.classroom, lv: 62, mfloor: 20, loops: 6,
              acc: 90, ans: 400, best: 44, title: 'grandmaster', rank: 'A-RANK',
              buff: '🩸 พันธะโลหิต', at: now },
        m2: { id: 'm2', name: 'ที่สอง', room: G.classroom, lv: 47, mfloor: 18, loops: 3,
              acc: 70, ans: 300, best: 20, title: '', at: now },
        m3: { id: 'm3', name: 'ที่สาม', room: G.classroom, lv: 20, mfloor: 12, loops: 1,
              acc: 60, ans: 200, best: 5, title: '', at: now }
      };
      G.correct = 30; G.wrong = 30; G.maxFloor = 4; G.level = 5; saveProgress();
      openBoard();
    });
    await page.waitForTimeout(1400);

    const flex = await page.evaluate(() => {
      const rows = Array.prototype.map.call(document.querySelectorAll('#gBoardBody .g-lb-row'), function (d) {
        return { cls: d.className, rank: d.querySelector('.g-lb-rank').textContent,
                 badges: Array.prototype.map.call(d.querySelectorAll('.bl-b'), b => b.textContent),
                 glow: getComputedStyle(d).boxShadow };
      });
      const first = document.querySelector('#gBoardBody .bl-b');
      return { rows: rows, rk1: first ? getComputedStyle(first).color : '' };
    });
    eq('อันดับ 1-3 ได้ไอคอนเหรียญตามสเปก',
       flex.rows.slice(0, 3).map(r => r.rank), ['👑', '🥈', '🥉']);
    ok('อันดับ 1-3 ได้กรอบเรืองแสงคนละคลาส',
       /bl-1/.test(flex.rows[0].cls) && /bl-2/.test(flex.rows[1].cls) && /bl-3/.test(flex.rows[2].cls),
       flex.rows.map(r => r.cls));
    ok('กรอบเรืองแสงมี box-shadow จริง ไม่ใช่แค่ชื่อคลาส',
       flex.rows[0].glow !== 'none' && flex.rows[0].glow.length > 4, flex.rows[0].glow);
    ok('อันดับ 4 ลงไปไม่มีกรอบพิเศษ', !/bl-[123]/.test(flex.rows[3].cls), flex.rows[3].cls);
    ok('แถวแรกมีป้ายแรงค์ + รอบหอคอย + สตรีค + บัฟ ครบ',
       /RANK|Level|Monarch/.test(flex.rows[0].badges[0]) &&
       flex.rows[0].badges.some(b => /🔁 รอบที่ 6/.test(b)) &&
       flex.rows[0].badges.some(b => /🔥 44 ข้อ/.test(b)) &&
       flex.rows[0].badges.some(b => /พันธะโลหิต/.test(b)), flex.rows[0].badges);
    ok('ป้ายแรงค์ถูกย้อมสีเฉพาะของแรงค์นั้น',
       flex.rk1 && flex.rk1 !== 'rgb(207, 224, 242)', flex.rk1);
    ok('คนที่ยังไม่วนรอบ/ไม่มีบัฟ ไม่ขึ้นป้ายเปล่า',
       flex.rows[3].badges.every(b => !/รอบที่ 0/.test(b)), flex.rows[3].badges);

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 5 · สามแท็บจัดอันดับ ═════════════════════════════════════════════════
  {
    say('\n═══ 5 · 🗼 หอคอย · 🎯 ความแม่นยำ · 👑 เลเวล ═══');
    const { ctx, page, errs } = await fresh(browser);
    await play(page, 'me1');
    await page.evaluate(() => {
      const now = Date.now();
      window.__NET.rooms = {
        /* ชั้นต่ำกว่าแต่วนหอคอยมากกว่า — แท็บหอคอยต้องยกให้คนนี้ */
        loop: { id: 'loop', name: 'สายวนรอบ', room: G.classroom, lv: 30, mfloor: 12, loops: 4,
                acc: 55, ans: 300, best: 4, at: now },
        high: { id: 'high', name: 'สายชั้นสูง', room: G.classroom, lv: 35, mfloor: 20, loops: 1,
                acc: 60, ans: 300, best: 6, at: now },
        aim:  { id: 'aim',  name: 'สายแม่น', room: G.classroom, lv: 25, mfloor: 5, loops: 0,
                acc: 98, ans: 250, best: 40, at: now },
        few:  { id: 'few',  name: 'ตอบน้อย', room: G.classroom, lv: 90, mfloor: 6, loops: 0,
                acc: 100, ans: 3, best: 3, at: now }
      };
      G.correct = 10; G.wrong = 10; G.maxFloor = 2; G.level = 3; saveProgress();
      openBoard();
    });
    await page.waitForTimeout(1400);

    const names = () => page.evaluate(() =>
      Array.prototype.map.call(document.querySelectorAll('#gBoardBody .g-lb-name'),
        n => n.textContent.split(' Lv.')[0].trim()));

    eq('แท็บหอคอย — รอบมาก่อนชั้น', (await names()).slice(0, 2), ['สายวนรอบ', 'สายชั้นสูง']);
    const v1 = await page.evaluate(() => document.querySelector('#gBoardBody .g-lb-val').textContent);
    ok('แท็บหอคอยโชว์เลขชั้นตามสูตรของ v4.2', /ชั้น 12 \/ 20/.test(v1), v1);

    await page.evaluate(() => setBoardMode('acc'));
    await page.waitForTimeout(300);
    eq('แท็บความแม่นยำ — คนแม่นสุดขึ้นก่อน', (await names())[0], 'สายแม่น');
    ok('คนตอบไม่ถึงเกณฑ์ถูกกันออกตาม LB_MIN_ANSWERS',
       !(await names()).includes('ตอบน้อย'), await names());
    const v2 = await page.evaluate(() => document.querySelector('#gBoardBody .g-lb-val').textContent);
    ok('แท็บความแม่นยำโชว์ % และจำนวนข้อ', /98% · 250 ข้อ/.test(v2), v2);

    await page.evaluate(() => setBoardMode('level'));
    await page.waitForTimeout(300);
    eq('แท็บเลเวล — เลเวลสูงสุดขึ้นก่อน', (await names())[0], 'ตอบน้อย');
    const v3 = await page.evaluate(() => document.querySelector('#gBoardBody .g-lb-val').textContent);
    ok('แท็บเลเวลโชว์ EXP สะสม', /Lv\.90 · \d+\/\d+ EXP/.test(v3), v3);

    await page.evaluate(() => setBoardMode('floor'));
    await page.waitForTimeout(300);
    ok('สลับกลับแท็บเดิมได้ครบวง', (await names())[0] === 'สายวนรอบ');

    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 6 · จังหวะส่งขึ้นคลาวด์ ══════════════════════════════════════════════
  {
    say('\n═══ 6 · Publisher — คุมจังหวะไม่ให้กินโควตา ═══');
    const { ctx, page, errs } = await fresh(browser);
    await play(page, 'me1');
    await page.evaluate(() => { window.__NET.puts = []; });

    await page.evaluate(() => { openBoard(); });
    await page.waitForTimeout(900);
    let puts = await page.evaluate(() => window.__NET.puts);
    eq('เปิดกระดาน = ประกาศตัวเองทันที 1 ครั้ง', puts.length, 1);
    ok('ยิงไปที่โหนด /rooms/{ห้อง}/leaderboard/{รหัส} ตามสเปก',
       /\/rooms\/[^/]+\/leaderboard\/me1\.json/.test(puts[0].url), puts[0].url);

    const body = puts[0].body;
    ok('ก้อนที่ส่งมีฟิลด์ครบตามสเปก',
       ['id', 'name', 'lv', 'mfloor', 'loops', 'acc', 'title', 'rank', 'best', 'buff', 'at']
         .every(k => body[k] !== undefined), Object.keys(body));
    ok('ใช้คีย์ id ไม่ใช่ u — ไม่งั้น caIsRowPut ของ v5.8 จะผนึกแฮชรหัสผ่านลงก้อนให้',
       body.u === undefined, Object.keys(body));
    ok('ไม่มีรหัสผ่านหรือแฮชขึ้นคลาวด์เด็ดขาด',
       !('pw' in body) && !('pwh' in body) && !JSON.stringify(body).match(/1111/), body);

    /* หัวใจ 5 วิ ของ v5.4 เรียก fbPush ถี่มาก — ต้องไม่ยิงตามทุกครั้ง */
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) { G.gold += 10; await fbPush('me1'); } });
    await page.waitForTimeout(700);
    puts = await page.evaluate(() => window.__NET.puts);
    eq('ยิง fbPush รัว 6 ครั้งในช่วงเว้นระยะ = ไม่ส่งเพิ่มสักครั้ง', puts.length, 1);

    /* เน็ตล่มต้องไม่ทำเกมพัง และต้องลงสมุด Error Log ของ v4.3 */
    await page.evaluate(() => { window.__NET.fail = 1; BA_LB_PUT = 0; BA_LB_AT = 0; });
    await page.evaluate(() => { openBoard(); });
    await page.waitForTimeout(900);
    const alive = await page.evaluate(() => ({
      rows: document.querySelectorAll('#gBoardBody .g-lb-row').length,
      err: (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
             .filter(x => /lb:/.test(x.s || '')).length
    }));
    ok('เน็ตล่มแล้วกระดานยังวาดรายชื่อในเครื่องได้', alive.rows >= 1, alive);
    ok('ความผิดพลาดถูกจดลง Error Log ของ v4.3', alive.err > 0, alive);
    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 7 · ปิดคลาวด์ = เงียบสนิท แต่กระดานยังใช้ได้ ═════════════════════════
  {
    say('\n═══ 7 · โหมดออฟไลน์ ═══');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(STUB);
    await ctx.addInitScript(`localStorage.setItem('yao_fbrt_man', '1');
                             localStorage.setItem('yao_fbrt', JSON.stringify({ on: false, url: '', node: 'students' }));`);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String((e && e.message) || e)));
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.goto(FILE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await play(page, 'solo');

    await page.evaluate(() => { window.__NET.log = []; openBoard(); });
    await page.waitForTimeout(900);
    const off = await page.evaluate(() => ({
      on: baBattleAudit().leaderboard.on,
      net: window.__NET.log.length,
      rows: document.querySelectorAll('#gBoardBody .g-lb-row').length,
      txt: document.getElementById('gBoardBody').textContent
    }));
    ok('ตัวชั้นนี้รู้ว่าต่อคลาวด์ไม่ได้', off.on === false, off.on);
    eq('ไม่มีคำขอออกเน็ตแม้แต่ครั้งเดียว', off.net, 0);
    ok('กระดานยังโชว์ตัวเราเองจากข้อมูลในเครื่อง', off.rows >= 1, off);
    ok('บอกผู้เล่นตรง ๆ ว่าอยู่โหมดออฟไลน์', /ออฟไลน์/.test(off.txt));
    ok('ไม่มี pageerror', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ═══ 8 · ไม่แตะหน้าจอเล่นเลยแม้แต่พิกเซลเดียว ════════════════════════════
  {
    say('\n═══ 8 · หน้าจอเล่นต้องไม่ขยับ ═══');
    for (const [vw, want] of [[390, 340.8], [320, 354.8]]) {
      const { ctx, page, errs } = await fresh(browser, vw);
      await play(page, 'zz1');
      const h = await page.evaluate(() => {
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        const m = G.currentMonster;
        if (m) { m.choices = ['ก', 'ข', 'ค', 'ง']; m.answer = 'ก'; renderChoices(); }
        document.getElementById('gFeedback').innerHTML = '';
        const card = document.querySelector('.ac-battle');
        return card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : -1;
      });
      ok('จอ ' + vw + ' · การ์ดโจทย์ยัง ' + want + 'px', h === want, h);
      ok('จอ ' + vw + ' · หน้าเล่นไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));

      await page.evaluate(() => { openBoard(); });
      await page.waitForTimeout(800);
      ok('จอ ' + vw + ' · เปิดกระดานแล้วยังไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      await page.evaluate(() => { closeBoard(); });
      await page.waitForTimeout(300);
      const h2 = await page.evaluate(() => {
        const card = document.querySelector('.ac-battle');
        return card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : -1;
      });
      ok('จอ ' + vw + ' · ปิดกระดานแล้วการ์ดโจทย์ยังเท่าเดิม', h2 === want, h2);
      ok('จอ ' + vw + ' · ไม่มี pageerror', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }

  say('\n══════════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════════');
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
