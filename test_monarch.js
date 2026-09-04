/* ชุดเทสต์ Patch v8.0 — MONARCH ASCENSION & GRAND QUEST ENGINE  (เนมสเปซ ba)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_monarch.js

   ข้อควรระวังที่ CLAUDE.md เขียนไว้และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส)
       — คลาวด์ปลอมของชุดนี้ "จำแถวไว้จริง" เพราะเคสสำคัญที่สุดคือ *อะไรถูกส่งขึ้นไปบ้าง*
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F = ชั้น; BA_INC_AT = -1;)
     · พิสูจน์ว่าแผง "มองเห็นจริง" ด้วย elementFromPoint ไม่ใช่เช็กแค่ .active (กับดักข้อ 25)
     · วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนเสมอ        */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'monarch_log.txt');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }

/* สารบัญของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ — ถ้าอ่านค่าคงที่ในเกมมาเทียบกับตัวเอง
   เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนเป้าหมายของเสาหลักไปแล้ว */
const WANT_PILL = ['codex', 'core', 'seal', 'level', 'acc', 'abyss'];
const WANT_GOAL = { codex: 329, core: 42, seal: 5, level: 99, acc: 95, abyss: 25 };

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.addInitScript(() => {
    /* คลาวด์ปลอม — เก็บโหนด /rooms/<ห้อง>/monarch ไว้จริง แล้วเสิร์ฟ GET กลับ
       ทุกคำขอถูกจดไว้ที่ __MN.log เพราะเคสสำคัญคือ "มีอะไรหลุดขึ้นคลาวด์บ้าง" */
    window.__MN = { log: [], node: {} };
    function nav(root, parts, make) {
      let o = root;
      for (const p of parts) {
        if (!p) continue;
        if (o[p] === undefined) { if (!make) return undefined; o[p] = {}; }
        o = o[p];
      }
      return o;
    }
    window.fetch = function (url, opt) {
      const u = String(url), o = opt || {};
      const method = String(o.method || 'GET').toUpperCase();
      window.__MN.log.push({ url: u, method: method, body: String(o.body || '') });
      let out = null;
      const m = u.match(/\/rooms\/[^/]+\/monarch([^?]*)\.json/);
      if (m) {
        const parts = decodeURIComponent(m[1] || '').split('/').filter(Boolean);
        if (method === 'PUT') {
          let body = null; try { body = JSON.parse(o.body || 'null'); } catch (e) {}
          if (!parts.length) window.__MN.node = body || {};
          else {
            const par = nav(window.__MN.node, parts.slice(0, -1), true);
            par[parts[parts.length - 1]] = body;
          }
          out = body;
        } else {
          const v = parts.length ? nav(window.__MN.node, parts, false) : window.__MN.node;
          out = (v === undefined) ? null : v;
        }
      }
      const txt = JSON.stringify(out === undefined ? null : out);
      return Promise.resolve({ ok: true, status: 200,
                               json: () => Promise.resolve(out), text: () => Promise.resolve(txt) });
    };
    window.EventSource = function () { this.close = function () {}; this.addEventListener = function () {}; };
  });
  await page.goto('file://' + FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  return { ctx: ctx, page: page, errs: errs };
}

async function ackRules(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(280);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} if (typeof rgAck === 'function') rgAck(); });
  await page.waitForTimeout(700);
}

async function clearOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
      if (typeof snGateConfirm === 'function' && document.querySelector('.sn-gate.active')) { snGateConfirm(); return 'gate'; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { warpGo(); return 'warp'; }
      return '';
    });
    if (!busy) break;
    await page.waitForTimeout(760);
  }
  await page.waitForTimeout(120);
}

async function enterGame(page, id) {
  await ackRules(page);
  await page.evaluate(u => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1111';
    document.getElementById('reg-pw2').value = '1111';
    handleSubmit();
  }, id);
  await page.waitForTimeout(1400);
  await clearOverlays(page);
  await page.evaluate(() => { G.maxFloor = FLOOR_MAX; recalcStats(); });
}

async function audit(page) { return await page.evaluate(() => baBattleAudit().monarch); }

/* ปั้นเสาหลักให้ครบทีละต้น — ทุกต้นอ่านจากฟิลด์ของชั้นล่างตรง ๆ จึงเสกได้หมด */
async function fill(page, which) {
  await page.evaluate(w => {
    /* Patch v9.6 เขียนทับความหมายของผนึกดวงที่ 1 — ตอนนี้นับเฉพาะคำที่ถึง
       Tier 4 (netScore=seen-2*wrong>=30 · ผ่านด่านชั้น 12+/เหวลึก · ไวติดกัน
       3 ครั้งล่าสุด) จึงต้องปั้นฟิกซ์เจอร์ให้ผ่านทั้งสามเงื่อนไข · enterGame()
       ตั้ง G.maxFloor = FLOOR_MAX ให้แล้วเสมอ ด่านชั้นจึงผ่านโดยอัตโนมัติ ·
       G.correct ต้องพอสำหรับด่านถูกของ baSmAllGold (>= 329×30) ด้วย เพราะ
       ฉายา 👑 ผู้หยั่งรู้รากอักขระ (ซึ่งขับพิธีขึ้นครองบัลลังก์ทั้งบล็อก 4/6)
       เช็กเงื่อนไขนั้นแยกจากตัวนับของหลอดผนึก */
    if (w.codex) {
      G.wordStats = {};
      VOCAB.forEach(v => { G.wordStats[v[0]] = { seen: 30, wrong: 0, recent: [], fastStreak: 3 }; });
      G.correct = Math.max(G.correct || 0, VOCAB.length * 30);
      /* correct=9870 กับ wrong เดิม (มักเป็น 0) จะดันความแม่นยำเป็น 100% เอง
         ทำให้ผนึก "acc" ติดไปด้วยทั้งที่ไม่ได้ขอ (isolation ของบล็อก 2/3 พัง)
         ดัน wrong ให้พอดันความแม่นยำลงต่ำกว่า 95% ไว้ก่อน — ถ้า w.acc ถูกขอ
         มาด้วยในคำสั่งเดียวกัน บล็อกของมันซึ่งรันทีหลังจะรีเซ็ตกลับเป็น 0 ทับอยู่ดี */
      if (!w.acc) G.wrong = Math.max(G.wrong || 0, 1000);
    }
    if (w.core)  { const b = abOf(G) || abEnsure(G); AB_CORES.forEach(c => { b.core[c.key] = AB_CORE_MAX; }); }
    if (w.seal)  { const b = abOf(G) || abEnsure(G);
                   AB_SEAL_FLOORS.forEach(f => { b.seals[String(f)] = { broken: true, flawless: true }; }); }
    if (w.level) { G.level = BA_LV_MAX; recalcStats(); }
    if (w.acc)   { G.correct = Math.max(G.correct || 0, 200); G.wrong = 0; }
    if (w.abyss) { const m = baMnOf(G) || baMnEnsure(G); m.sh = (1 << BA_MN_SH) - 1; }
    renderStats();
  }, which || {});
  await page.waitForTimeout(120);
}

async function run() {
  try { fs.unlinkSync(LOG); } catch (e) {}
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ บล็อก 1 — ริบบิ้นบนหัว HUD ═══════════════════════════════════════
  {
    head('1 · ริบบิ้น [END GAME] บนหัว HUD');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn1');
    const r = await page.evaluate(() => {
      const el = document.getElementById('baMnBar');
      const card = el ? el.closest('.g-card') : null;
      const top = document.querySelector('#gameScreen .g-topbar');
      return {
        mounted: !!el,
        inStatusCard: !!(card && top && card.contains(top)),
        afterTopbar: !!(el && el.previousElementSibling === null ? false : true),
        prevIsTopbar: !!(el && el.previousElementSibling && el.previousElementSibling.classList.contains('g-topbar')),
        txt: el ? el.textContent.trim() : '',
        pct: (document.getElementById('baMnPct') || {}).textContent || '',
        fill: (document.getElementById('baMnFill') || {}).style.width || '',
        clickable: !!(el && el.getAttribute('onclick') || '').toString().indexOf('baMnOpen') >= 0,
        styled: !!document.getElementById('baMnStyle'),
        overflow: document.body.scrollWidth <= window.innerWidth
      };
    });
    ok('ริบบิ้นถูกแทรกจริง (#baMnBar)', r.mounted);
    ok('อยู่ในการ์ดสถานะ (คนละใบกับการ์ดโจทย์)', r.inStatusCard);
    ok('วางไว้ใต้แถบหัวจอพอดี', r.prevIsTopbar, r);
    ok('มีข้อความ [END GAME] + หนทางสู่บัลลังก์จักรพรรดิเงา',
       /\[END GAME\]/.test(r.txt) && /บัลลังก์จักรพรรดิเงา/.test(r.txt), r.txt);
    ok('โชว์เปอร์เซ็นต์สด', /%$/.test(r.pct.trim()) || /%/.test(r.pct), r.pct);
    ok('แถบความคืบหน้ามีความกว้างตามเปอร์เซ็นต์', /%$/.test(r.fill), r.fill);
    ok('แตะแล้วเปิดแผงผนึก', r.clickable);
    ok('สไตล์ถูกแทรกครั้งเดียว (#baMnStyle)', r.styled);
    ok('ไม่ล้นแนวนอน', r.overflow);

    /* กันแทรกซ้ำ (กับดักข้อ 2) — renderStats วิ่งถี่มาก */
    const dup = await page.evaluate(() => {
      for (let i = 0; i < 40; i++) renderStats();
      return { bars: document.querySelectorAll('#gameScreen .ba-mn-bar').length,
               styles: document.querySelectorAll('#baMnStyle').length };
    });
    eq('วาดซ้ำ 40 รอบแล้วยังมีริบบิ้นใบเดียว', dup.bars, 1);
    eq('สไตล์ไม่งอกซ้ำ', dup.styles, 1);

    /* ลายเซ็นกันวาดฟรี — ค่าไม่เปลี่ยน = ไม่วาดเพิ่มสักครั้ง */
    const n = await page.evaluate(() => {
      const a = baBattleAudit().monarch.n.paint;
      for (let i = 0; i < 20; i++) renderStats();
      return { a: a, b: baBattleAudit().monarch.n.paint };
    });
    eq('ค่าไม่เปลี่ยน = ไม่วาดริบบิ้นซ้ำ', n.b - n.a, 0);

    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 2 — เสาหลัก 6 ต้น ═══════════════════════════════════════════
  {
    head('2 · เสาหลัก 6 ต้นและเปอร์เซ็นต์รวม');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn2');
    let a = await audit(page);
    eq('มีเสาหลักครบ 6 ต้นตามสเปก', a.pillars.map(p => p.id), WANT_PILL);
    const goals = {}; a.pillars.forEach(p => { goals[p.id] = p.d; });
    eq('เป้าหมายของแต่ละต้นตรงสเปก (คลัง 329 · แกน 42 · ผนึก 5 · Lv.99 · แม่นยำ 95 · เหวลึก 25)',
       goals, WANT_GOAL);
    ok('บัญชีใหม่ยังไม่ผนึกสักดวง', a.sealed === 0 && a.pct < 100, a);
    ok('ยังไม่ขึ้นครองบัลลังก์', a.asc === false && a.at === 0, a);

    await fill(page, { codex: true });
    a = await audit(page);
    ok('เก็บคำครบทั้งเล่ม → ผนึกคลังอักขระติด', a.pillars[0].ok && a.sealed === 1, a.pillars[0]);
    await fill(page, { core: true, seal: true });
    a = await audit(page);
    ok('อัปแกนครบ 7 เส้น + ทลายผนึกครบ 5 บาน → ผนึกติดเพิ่มสองดวง', a.sealed === 3, a.pillars);
    await fill(page, { level: true, acc: true });
    a = await audit(page);
    ok('Lv.99 + แม่นยำ ≥95% → ผนึกติดครบห้าดวง', a.sealed === 5, a.pillars);
    ok('ยังไม่ถึง 100% ตราบใดที่ยังไม่ครบทั้งหก', a.pct < 100 && a.done === false, a.pct);
    ok('เปอร์เซ็นต์เดินตามจำนวนที่ทำได้จริง', a.pct >= 80, a.pct);
    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 3 — แผงหกเหลี่ยม + ฉากหลังไล่ระดับ ═════════════════════════
  {
    head('3 · แผงหกเหลี่ยม 6 ผนึก + ฉากหลังไล่ระดับ');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn3');
    await page.evaluate(() => { document.getElementById('baMnBar').click(); });
    await page.waitForTimeout(320);

    const r = await page.evaluate(() => {
      const b = document.getElementById('baMnBoard');
      const inner = document.getElementById('baMnInner');
      const svg = document.querySelector('#baMnBoard .ba-mn-hex');
      /* พิสูจน์ว่า "มองเห็นจริง" ด้วย elementFromPoint เป็นกริดทั่วกรอบ (กับดักข้อ 25) */
      let hit = 0, miss = 0;
      if (inner) {
        const q = inner.getBoundingClientRect();
        for (let x = 0.12; x <= 0.9; x += 0.13) for (let y = 0.1; y <= 0.9; y += 0.13) {
          const e = document.elementFromPoint(q.left + q.width * x, q.top + q.height * y);
          if (e && e.closest && e.closest('#baMnBoard')) hit++; else miss++;
        }
      }
      return {
        active: !!(b && b.classList.contains('active')),
        hit: hit, miss: miss,
        polys: document.querySelectorAll('#baMnBoard .ba-mn-hex polygon').length,
        seals: document.querySelectorAll('#baMnBoard .ba-mn-hex circle').length,
        on: document.querySelectorAll('#baMnBoard .ba-mn-hex circle.on').length,
        rows: document.querySelectorAll('#baMnBoard .ba-mn-p').length,
        cls: inner ? inner.className : '',
        hof: !!document.querySelector('#baMnBoard .ba-mn-hof'),
        aura: !!document.querySelector('#baMnBoard .ba-mn-aura'),
        go: !!document.querySelector('#baMnBoard .ba-mn-go'),
        goOff: !!(document.querySelector('#baMnBoard .ba-mn-go') || {}).disabled
      };
    });
    ok('แผงเปิดอยู่จริง', r.active);
    ok('แผงมองเห็นจริงทั่วกรอบ (' + r.hit + ' จุด · พลาด ' + r.miss + ')', r.hit > 20 && r.miss === 0, r);
    eq('ดาวหกแฉก = สามเหลี่ยมสองรูป', r.polys, 2);
    eq('ผนึกครบหกดวงบนยอดหกเหลี่ยม', r.seals, 6);
    eq('ยังไม่มีดวงไหนติด', r.on, 0);
    eq('แถวเสาหลักครบหกแถว', r.rows, 6);
    ok('ฉากหลังเริ่มที่ขั้นซากปรักหักพัง (b0)', / b0$/.test(r.cls), r.cls);
    ok('มีกล่องออร่าห้องเรียนกับหอเกียรติยศ', r.aura && r.hof);
    ok('ปุ่มประกอบพิธีถูกล็อกไว้ตอนยังไม่ครบ', r.go && r.goOff);

    await fill(page, { codex: true, core: true, seal: true });
    await page.evaluate(() => baMnRender());
    const mid = await page.evaluate(() => ({
      on: document.querySelectorAll('#baMnBoard .ba-mn-hex circle.on').length,
      okRows: document.querySelectorAll('#baMnBoard .ba-mn-p.ok').length,
      cls: document.getElementById('baMnInner').className
    }));
    eq('ผนึกติดสามดวงตามที่ทำได้', mid.on, 3);
    eq('แถวเสาหลักติดสถานะครบตามกัน', mid.okRows, 3);
    ok('ฉากหลังอัปเกรดขึ้นขั้นที่สูงกว่า', / b[12]$/.test(mid.cls), mid.cls);

    await page.evaluate(() => baMnClose());
    const closed = await page.evaluate(() => document.getElementById('baMnBoard').classList.contains('active'));
    ok('ปิดแผงได้', closed === false);
    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 4 — พิธีขึ้นครองบัลลังก์ ═══════════════════════════════════
  {
    head('4 · พิธีขึ้นครองบัลลังก์ (100% Awakening)');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn4');
    await fill(page, { codex: true, core: true, seal: true, level: true, acc: true });
    let a = await audit(page);
    ok('ครบห้าต้นแล้วยังไม่ประกอบพิธี', a.asc === false && a.done === false, a.sealed);

    await fill(page, { abyss: true });
    await page.waitForTimeout(400);
    a = await audit(page);
    ok('ครบทั้งหกต้น → 100%', a.pct === 100 && a.done === true, a.pct);
    ok('ประกอบพิธีให้เองทันที (100% Awakening)', a.asc === true && a.at > 0, a);
    eq('พิธีเกิดขึ้นครั้งเดียว', a.n.asc, 1);
    ok('แสงพิธีเต็มจอถูกสร้าง', a.flash);

    const fx = await page.evaluate(() => {
      const el = document.getElementById('baMnFlash');
      const cs = el ? getComputedStyle(el) : null;
      const mid = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return { pos: cs ? cs.position : '', pe: cs ? cs.pointerEvents : '',
               it: cs ? cs.animationIterationCount : '', name: cs ? cs.animationName : '',
               blocks: !!(mid && mid.id === 'baMnFlash') };
    });
    eq('แสงพิธีเป็น position:fixed (ไม่กินเลย์เอาต์)', fx.pos, 'fixed');
    eq('pointer-events:none (ไม่บังการกดของใคร)', fx.pe, 'none');
    ok('อนิเมชันเล่นรอบเดียว ไม่ใช่ infinite (กับดักข้อ 31)',
       fx.it === '1' && fx.name === 'baMnFl', fx);
    ok('แสงพิธีไม่ขวาง elementFromPoint', fx.blocks === false);

    const bar = await page.evaluate(() => ({
      done: document.getElementById('baMnBar').classList.contains('done'),
      pct: document.getElementById('baMnPct').textContent
    }));
    ok('ริบบิ้นติดสถานะครบและโชว์ 100%', bar.done && /100%/.test(bar.pct), bar);

    /* ประกอบซ้ำไม่ได้ */
    const again = await page.evaluate(() => { const r = baMnAscend(); return { r: r, n: baBattleAudit().monarch.n.asc }; });
    ok('เรียกพิธีซ้ำไม่มีผล', again.r === false && again.n === 1, again);
    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 5 — ออร่าห้องเรียน + หอเกียรติยศบนคลาวด์ ═══════════════════
  {
    head('5 · ออร่าจอมราชัน + หอเกียรติยศ (RTDB)');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn5');
    await fill(page, { codex: true, core: true, seal: true, level: true, acc: true, abyss: true });
    await page.waitForTimeout(700);

    const c = await page.evaluate(() => ({
      log: window.__MN.log.filter(l => /monarch/.test(l.url)),
      node: window.__MN.node,
      m: baBattleAudit().monarch
    }));
    const puts = c.log.filter(l => l.method === 'PUT');
    ok('ส่งขึ้นโหนด /rooms/<ห้อง>/monarch จริง', puts.length >= 2, puts.map(p => p.url));
    ok('บันทึกหอเกียรติยศรายคน', puts.some(p => /\/hof\//.test(p.url)), puts.map(p => p.url));
    ok('ปลุกออร่าของห้อง', puts.some(p => /\/aura\.json/.test(p.url)), puts.map(p => p.url));
    /* **ห้ามมีคีย์ `u` เป็นสตริงในก้อนที่ PUT** — caIsRowPut ของ v5.8 จะผนึกแฮชรหัสผ่านลงไปให้ */
    const bad = puts.filter(p => { try { const b = JSON.parse(p.body || '{}'); return typeof b.u === 'string'; } catch (e) { return false; } });
    eq('ไม่มีก้อนไหนใช้คีย์ u (กันแฮชรหัสผ่านหลุดขึ้นคลาวด์)', bad.length, 0);
    const anyPw = puts.some(p => /pwh|"pw"/.test(p.body || ''));
    ok('ไม่มีรหัสผ่าน/แฮชขึ้นโหนดนี้แม้แต่ตัวเดียว', anyPw === false);

    ok('ออร่าติดในเครื่องหลังพิธี', c.m.aura === true && c.m.auraAt > Date.now(), c.m.auraAt);
    /* ต้องวัดสองค่าที่ "สถานะเดียวกันเป๊ะ" ต่างกันแค่ออร่า ไม่งั้นโบนัสทองของ v4.4/v4.6/v7.6
       ที่เพิ่งได้มาพร้อมเสาหลักจะปนเข้ามาแล้วเคสตกด้วยเหตุผลผิด */
    const gold = await page.evaluate(() => {
      const keep = BA_MN_AT;
      const on = goldMul();
      BA_MN_AT = 0;
      const off = goldMul();
      BA_MN_AT = keep;
      return { on: on, off: off };
    });
    ok('ทองทั้งห้อง +5% ระหว่างมีออร่า (' + gold.off.toFixed(3) + ' → ' + gold.on.toFixed(3) + ')',
       Math.abs((gold.on - gold.off) - 0.05) < 1e-9, gold);

    /* ดึงกลับมาใหม่ — หอเกียรติยศต้องอ่านได้และเรียงจากคนแรกก่อน */
    await page.evaluate(() => {
      window.__MN.node.hof = window.__MN.node.hof || {};
      window.__MN.node.hof.zz = { id: 'zz', name: 'รุ่นพี่', at: 1 };
      window.__MN.node.hof.yy = { id: 'yy', name: 'รุ่นกลาง', at: 2 };
      return baMnPull(true);
    });
    await page.waitForTimeout(400);
    const h = await page.evaluate(() => baBattleAudit().monarch.hof);
    eq('หอเกียรติยศเรียงตามลำดับผู้พิชิต (1st/2nd/3rd)', h.slice(0, 2).map(x => x.id), ['zz', 'yy']);
    const podium = await page.evaluate(() => {
      baMnOpen();
      return Array.from(document.querySelectorAll('#baMnBoard .ba-mn-hr')).map(e => e.textContent.trim());
    });
    ok('แสดงโพเดียม 3 อันดับบนแผง', podium.length === 3 && /🥇/.test(podium[0]) && /🥉/.test(podium[2]), podium);

    /* ออร่าหมดอายุแล้วต้องหยุดให้ทอง */
    const gold2 = await page.evaluate(() => { BA_MN_AT = Date.now() - 1000; return goldMul(); });
    ok('ออร่าหมดอายุแล้วโบนัสหายไป', Math.abs(gold2 - gold.off) < 1e-9, { off: gold.off, gold2: gold2 });
    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 6 — ฉายาต่อท้ายชื่อบนกระดานผู้นำ ═══════════════════════════
  {
    head('6 · ฉายา · จอมราชันเงาไร้พ่าย บนกระดานผู้นำ');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn6');
    const before = await page.evaluate(() => {
      G.correct = 60; G.wrong = 0;
      const rows = baLbAll();
      return (rows.find(r => r.user === CURRENT_USER) || {}).name || '';
    });
    ok('ก่อนขึ้นครองบัลลังก์ ชื่อยังไม่มีฉายาต่อท้าย', before.indexOf('จอมราชัน') < 0, before);

    await fill(page, { codex: true, core: true, seal: true, level: true, acc: true, abyss: true });
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const rows = baLbAll();
      const me = rows.find(r => r.user === CURRENT_USER) || {};
      const w = baLbWire(baLbMine());
      /* เรียกซ้ำต้องไม่ต่อฉายาซ้ำสองรอบ */
      baLbAll(); baLbAll();
      const me2 = (baLbAll().find(r => r.user === CURRENT_USER) || {}).name || '';
      return { name: me.name || '', wire: w.name || '', twice: me2 };
    });
    ok('ชื่อบนกระดานได้ฉายาต่อท้าย', /· จอมราชันเงาไร้พ่าย$/.test(after.name), after.name);
    ok('ก้อนที่ส่งขึ้นคลาวด์ก็ได้ฉายาไปด้วย', /· จอมราชันเงาไร้พ่าย$/.test(after.wire), after.wire);
    eq('เรียกซ้ำหลายรอบไม่ต่อฉายาซ้ำ',
       (after.twice.match(/จอมราชันเงาไร้พ่าย/g) || []).length, 1);

    await page.evaluate(() => openBoard());
    await page.waitForTimeout(400);
    const dom = await page.evaluate(() => {
      const n = document.querySelector('#gBoardBody .g-lb-row.me .g-lb-name');
      return n ? n.textContent : '';
    });
    ok('กระดานผู้นำวาดฉายาออกมาจริง', /จอมราชันเงาไร้พ่าย/.test(dom), dom);
    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 7 — ทัพเงา 25 ตัว + เซฟข้ามการล็อกอิน ══════════════════════
  {
    head('7 · ทัพเงา 25 ตัว · บิตแมสก์ · รอดข้ามการล็อกอิน');
    const { ctx, page, errs } = await boot(browser);
    await enterGame(page, 'mn7');

    /* ล้มทัพเงาผ่านทางจริง (onMonsterDefeated) โดยยึดตัวที่ต้องการไว้ก่อน */
    const kill = async (n) => await page.evaluate(id => {
      const b = abOf(G); if (b) b.abyss = false;
      G.practiceMode = false;
      BA_INC_F = G.floor; BA_INC_AT = -1;
      BA_INC_ID = id; BA_INC_M = G.currentMonster;
      G.monsterHp = 0;
      onMonsterDefeated();
      G.locked = false;
      return baBattleAudit().monarch.shN;
    }, n);

    const a1 = await kill('s1'); await clearOverlays(page);
    ok('ปราบทัพเงาตัวแรกแล้วนับได้ 1', a1 === 1, a1);
    await page.evaluate(() => { G.floor = 1; G.floorProgress = 0; nextMonster(); G.locked = false; });
    await clearOverlays(page);
    const a2 = await kill('s1'); await clearOverlays(page);
    ok('ตัวเดิมซ้ำไม่นับเพิ่ม (บิตแมสก์)', a2 === 1, a2);
    await page.evaluate(() => { G.floor = 1; G.floorProgress = 0; nextMonster(); G.locked = false; });
    await clearOverlays(page);
    const a3 = await kill('s7'); await clearOverlays(page);
    ok('ตัวใหม่นับเพิ่ม', a3 === 2, a3);

    /* โหมดฝึกจุดอ่อนไม่นับความคืบหน้าเลยสักตัว */
    await page.evaluate(() => { G.floor = 1; G.floorProgress = 0; nextMonster(); G.locked = false; });
    await clearOverlays(page);
    const a4 = await page.evaluate(() => {
      G.practiceMode = true;
      BA_INC_ID = 's9'; BA_INC_M = G.currentMonster; BA_INC_F = G.floor; BA_INC_AT = -1;
      G.monsterHp = 0;
      try { onMonsterDefeated(); } catch (e) {}
      G.practiceMode = false; G.locked = false;
      return baBattleAudit().monarch.shN;
    });
    ok('โหมดฝึกจุดอ่อนไม่นับ', a4 === 2, a4);

    /* ต้องผ่าน exitGame แล้วล็อกอินใหม่จริง ๆ (กับดักข้อ 16) */
    const saved = await page.evaluate(() => (loadStore()[CURRENT_USER] || {}).mn);
    ok('บันทึกลง store แล้ว', !!saved && saved.sh > 0, saved);
    await page.evaluate(() => exitGame());
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      if (typeof enterGate === 'function') enterGate();
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'mn7';
      document.getElementById('login-pw').value = '1111';
      handleSubmit();
    });
    await page.waitForTimeout(1400);
    await clearOverlays(page);
    const back = await audit(page);
    ok('ล็อกอินใหม่แล้วความคืบหน้าทัพเงายังอยู่ครบ', back.shN === 2, back);
    ok('ไม่มี pageerror', errs.length === 0, errs[0]);
    await ctx.close();
  }

  // ═══ บล็อก 8 — เลย์เอาต์ต้องไม่ขยับ ═══════════════════════════════════
  {
    head('8 · การ์ดโจทย์ต้องสูงเท่าเดิมทุกความกว้าง');
    for (const w of [320, 360, 390, 430]) {
      const { ctx, page, errs } = await boot(browser, w, w === 320 ? 568 : 844);
      await enterGame(page, 'mnL' + w);
      await fill(page, { codex: true, core: true, seal: true, level: true, acc: true, abyss: true });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        /* บังคับคำ/ตัวเลือกให้คงที่ + ล้างบรรทัดผลลัพธ์ก่อนวัดเสมอ */
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        G.currentMonster.choices = ['ก', 'ข', 'ค', 'ง'];
        G.currentMonster.answer = 'ก';
        renderChoices();
        const card = document.querySelector('.ac-battle');
        return { h: card ? +card.getBoundingClientRect().height.toFixed(1) : 0,
                 sw: document.body.scrollWidth, iw: window.innerWidth };
      });
      const want = w <= 359 ? 354.8 : 340.8;
      ok('จอ ' + w + ' — การ์ดโจทย์สูง ' + m.h + 'px (ต้องเป็น ' + want + ')', Math.abs(m.h - want) < 0.6, m);
      ok('จอ ' + w + ' — ไม่ล้นแนวนอน', m.sw <= m.iw, m);
      ok('จอ ' + w + ' — ไม่มี pageerror', errs.length === 0, errs[0]);
      await ctx.close();
    }
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('ผ่าน ' + PASS + '  ตก ' + FAIL);
}

run().catch(e => { say('พัง: ' + (e && e.stack || e)); process.exit(1); });
