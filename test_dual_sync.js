/* ชุดเทสต์ Patch v7.7 — DUAL-TABLE REAL-TIME SYNCHRONIZATION ENGINE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_dual_sync.js

   ต้อง stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง (กติกาเดียวกับชุดของ v5.5/v5.6/v7.2)             */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'dual_sync_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

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

/* payload ของ v5.3 + ฟิลด์ loops ที่ v7.2 เติมเข้ามา */
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

async function fresh(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 1200, height: h || 950 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

/* เข้าห้องควบคุมด้วยเส้นทางจริงเสมอ — ผ่านป๊อปอัปกติกาของ v5.6 แล้วกรอก TEACHER_PIN */
async function enterPanel(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(300);
}

async function seed(page, rows) {
  await page.evaluate(function (rs) {
    FB_LIVE = {};
    rs.forEach(function (r) { FB_LIVE[r.u] = r; });
    FB_MST = 'live';
    fbPaint();
  }, rows);
  await page.waitForTimeout(250);
}

/* ปั้นบัญชีจริงลงทะเบียนของเครื่องนี้ (ไม่ใช่แถวสดของ v5.7) */
async function seedStore(page, u, over) {
  await page.evaluate(function (arg) {
    const s = loadStore();
    const a = blankAccount(arg.u, 'ท้องถิ่น ' + arg.u, '1234', 'ม.4');
    Object.assign(a, arg.over || {});
    s[arg.u] = a;
    saveStore(s);
  }, { u: u, over: over || {} });
}

function cellText(page, sel) { return page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · Unified Data Formatters ════════════════════════════════════════
  {
    say('\n═══ 1 · สูตรจัดรูปแบบชุดเดียว ═══');
    const { ctx, page, errs } = await fresh(browser);

    const f = await page.evaluate(() => ({
      floor: baFormatFloor(7, 2, 3),
      floor0: baFormatFloor(0, 0, 0),
      exp: baFormatExp(90, 100),
      exp0: baFormatExp(0, 0),
      gold: baFormatGold(4321),
      goldBig: baFormatGold(1234567),
      pw: baFormatPower({ hp: 55, mhp: 190, mp: 30, mmp: 120 }),
      pwLive: baFormatPower({ hp: 55, mhp: 190, mp: 30 }),
      pwNone: baFormatPower({ hp: 0, mhp: 0, mp: 0 }),
      pwNull: baFormatPower(null)
    }));

    ok('ชั้นสูงสุดอยู่ใน <b> เป็นเลขตัวแรกของช่อง', /^<b>7<\/b> \/ 20/.test(f.floor), f.floor);
    ok('มีตัวนับรอบเสมอแม้รอบเป็น 0', /class="ba-loop">\(รอบที่ 0\)/.test(f.floor0), f.floor0);
    ok('มีบรรทัดรอง "ยืนอยู่ชั้น"', /ยืนอยู่ชั้น 3</.test(f.floor), f.floor);
    ok('EXP เป็น "90/100" ติดกัน (ชุดเทสต์ v5.3 จับ /90\\/100/)',
       /<b class="ba-ms-n">90<\/b>\/100/.test(f.exp), f.exp);
    ok('EXP มีเปอร์เซ็นต์ต่อท้าย', /gm-sub">90%</.test(f.exp), f.exp);
    ok('EXP หารศูนย์ไม่พัง', /<b class="ba-ms-n">0<\/b>\/100/.test(f.exp0), f.exp0);
    ok('ทองเป็นเลขตัวแรกของช่อง', /^<b class="ba-ms-g">4321<\/b> 🪙$/.test(f.gold), f.gold);
    ok('ห้ามใส่ตัวคั่นหลักพันเด็ดขาด', f.goldBig.indexOf(',') < 0 && /1234567/.test(f.goldBig), f.goldBig);
    ok('ค่าพลังโชว์ HP/MP พร้อมเพดานเมื่อมีข้อมูล',
       /❤️ 55\/190 · 🔮 30\/120/.test(f.pw), f.pw);
    ok('แถวที่มีแต่สัญญาณสด — ตัดท่อนเพดาน MP ทิ้ง ไม่เดาเลขปลอม',
       /❤️ 55\/190 · 🔮 30$/.test(f.pwLive.replace(/<[^>]*>/g, '')), f.pwLive);
    eq('ไม่มีข้อมูลค่าพลัง = ไม่แสดงอะไรเลย', [f.pwNone, f.pwNull], ['', '']);

    ok('baLcCell ของ v7.4 มาเรียกสูตรเดียวกัน (เหลือสูตรเดียวจริง)',
       await page.evaluate(() => baLcCell(7, 2, 3) === baFormatFloor(7, 2, 3)));
    ok('baBattleAudit รายงานว่าผูกกันแล้ว', await page.evaluate(() => baBattleAudit().dualSync.linked));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 2 · Shared State Store ═════════════════════════════════════════════
  {
    say('\n═══ 2 · ตัวแปรกลาง baMasterState ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await seedStore(page, 'loc1', { level: 12, gold: 900, exp: 33, maxExp: 400, hp: 40, maxHp: 260, mp: 15, towerClears: 1, correct: 30, wrong: 10 });
    await seed(page, [live('sig1', { lv: 5, gold: 777, exp: 10, mexp: 250 })]);

    const st = await page.evaluate(() => { baMsSync(); return baMasterState; });
    ok('มีทั้งคนที่มาจากสัญญาณและคนที่มีแต่ทะเบียนในเครื่อง',
       !!st.sig1 && !!st.loc1, Object.keys(st));
    eq('เรคคอร์ดจากสัญญาณอ่านค่าครบ',
       [st.sig1.lv, st.sig1.gold, st.sig1.exp, st.sig1.mexp, st.sig1.src], [5, 777, 10, 250, 'live']);
    eq('เรคคอร์ดจากทะเบียนอ่านค่าครบ',
       [st.loc1.lv, st.loc1.gold, st.loc1.mfloor, st.loc1.loops, st.loc1.src], [12, 900, 1, 1, 'local']);
    ok('บัญชีในเครื่องได้เพดาน MP มาด้วย (maxMpOf ของ v4.4/v4.6)', st.loc1.mmp > 0, st.loc1.mmp);
    ok('แถวที่มีแต่สัญญาณไม่มีเพดาน MP (payload ไม่ได้ส่งมา)', st.sig1.mmp === 0, st.sig1.mmp);
    eq('ความแม่นยำคำนวณจากถูก/ผิดของทะเบียน', st.loc1.acc, 75);

    /* สัญญาณต้องชนะทะเบียน — เพราะทะเบียนของครูคือภาพสะท้อนที่ v5.7 ปั้นจากสัญญาณอยู่แล้ว */
    await page.evaluate(() => { FB_LIVE.loc1 = { u: 'loc1', lv: 40, gold: 5555, at: Date.now() }; baMsSync(); });
    const ov = await page.evaluate(() => baMasterState.loc1);
    eq('สัญญาณทับทะเบียนเฉพาะฟิลด์ที่ส่งมาจริง', [ov.lv, ov.gold], [40, 5555]);
    ok('ฟิลด์ที่ payload ไม่ได้ส่งยังอยู่ครบ (เพดาน MP ของทะเบียน)', ov.mmp > 0, ov.mmp);
    eq('ชั้นสูงสุดของทะเบียนไม่ถูกล้างทิ้ง', ov.mfloor, 1);

    /* v5.7 ปั้นแถวสดลงทะเบียนของเครื่องครูไปแล้ว สัญญาณหายไปเฉย ๆ จึงยังเหลือแถวไว้ให้ครูดู
       (พฤติกรรมที่ถูกต้องของ v5.7) — ที่ต้องหายจริงคือคนที่ถูกลบออกจากทั้งสองที่ */
    ok('สัญญาณหาย แต่แถวที่ v5.7 ปั้นไว้ยังอยู่ให้ครูดู',
       await page.evaluate(() => { FB_LIVE = {}; baMsSync(); return !!baMasterState.sig1 && !!baMasterState.loc1; }));
    ok('ลบออกจากทั้งสองที่แล้วต้องหายจากสถานะกลาง',
       await page.evaluate(() => {
         const s = loadStore(); delete s.sig1; saveStore(s);
         baMsSync();
         return !baMasterState.sig1 && !!baMasterState.loc1;
       }));
    ok('ไม่ได้เพิ่มฟิลด์ในบัญชีสักตัว',
       await page.evaluate(() => {
         const a = loadStore().loc1 || {};
         return Object.keys(a).filter(k => /^baMs|^BA_MS/.test(k)).length === 0;
       }));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 3 · สองตารางแสดงชุดเดียวกัน ════════════════════════════════════════
  {
    say('\n═══ 3 · ตารางบนกับตารางล่างต้องตรงกันเป๊ะ ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await seedStore(page, 'duo', { level: 9, gold: 3210, exp: 55, maxExp: 300, hp: 70, maxHp: 240, mp: 22, maxFloor: 11, floor: 10, towerClears: 2 });
    await seed(page, [live('duo', { lv: 9, gold: 3210, exp: 55, mexp: 300, hp: 70, mhp: 240, mp: 22, mfloor: 11, floor: 10, loops: 2 })]);
    await page.evaluate(() => gmRender());
    await page.waitForTimeout(350);

    const pair = await page.evaluate(() => {
      const pick = function (sel, idx) {
        const tr = [].filter.call(document.querySelectorAll(sel), function (x) { return /duo/.test(x.textContent); })[0];
        return tr && tr.cells[idx] ? tr.cells[idx].innerHTML : '';
      };
      return {
        liveFloor: pick('#fbBody tr', 3), gmFloor: pick('#gmBody tr', 2),
        liveExp: pick('#fbBody tr', 2), gmExp: pick('#gmBody tr', 4),
        liveGold: pick('#fbBody tr', 5), gmGold: pick('#gmBody tr', 5)
      };
    });
    ok('ช่องชั้นสูงสุดเหมือนกันทุกตัวอักษร', pair.liveFloor === pair.gmFloor && !!pair.liveFloor,
       [pair.liveFloor, pair.gmFloor]);
    ok('ช่อง EXP เหมือนกันทุกตัวอักษร', pair.liveExp === pair.gmExp && !!pair.liveExp,
       [pair.liveExp, pair.gmExp]);
    ok('ช่องทองเหมือนกันทุกตัวอักษร', pair.liveGold === pair.gmGold && !!pair.liveGold,
       [pair.liveGold, pair.gmGold]);
    ok('ทั้งสองตารางมีบรรทัดค่าพลัง', /ba-ms-pw/.test(pair.liveExp) && /ba-ms-pw/.test(pair.gmExp));
    ok('ตัวนับรอบขึ้นทั้งสองตาราง', /รอบที่ 2/.test(pair.liveFloor) && /รอบที่ 2/.test(pair.gmFloor));

    /* ห้ามแทรกคอลัมน์ — xpDomRows ของ v5.5 อ่าน td ตามตำแหน่งตายตัวถึง td[8] */
    const dom = await page.evaluate(() => xpDomRows()[0]);
    eq('xpDomRows ยังอ่านเลเวลถูก', dom.lv, 9);
    eq('xpDomRows ยังอ่าน EXP ถูก', dom.exp, 55);
    eq('xpDomRows ยังอ่านชั้นสูงสุดถูก', dom.mfloor, 11);
    eq('xpDomRows ยังอ่านทองถูก', dom.gold, 3210);
    eq('xpDomRows ยังอ่านความแม่นยำถูก', dom.acc, 75);
    eq('จำนวนคอลัมน์ของตารางสดเท่าเดิม (9 + THP ของ v7.2)',
       await page.evaluate(() => document.querySelector('#fbBody tr').cells.length), 10);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 4 · Firebase Listener → State → วาดสองตาราง ═════════════════════════
  {
    say('\n═══ 4 · สัญญาณเข้า → สถานะกลาง → วาดพร้อมกัน ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);
    await seed(page, [live('rt1', { gold: 100 })]);

    const n0 = await page.evaluate(() => baBattleAudit().dualSync.n);
    await page.evaluate(() => fbApply('put', JSON.stringify({ path: '/rt1/gold', data: 4321 })));
    await page.waitForTimeout(300);
    const n1 = await page.evaluate(() => baBattleAudit().dualSync.n);
    ok('ตัวรับสัญญาณถูกดักจริง', n1.apply > n0.apply, [n0.apply, n1.apply]);
    ok('สถานะกลางถูกปั้นใหม่', n1.sync > n0.sync, [n0.sync, n1.sync]);
    ok('สั่งวาดหลังค่าเปลี่ยน', n1.paint > n0.paint, [n0.paint, n1.paint]);
    eq('ทองในสถานะกลางตรงกับสัญญาณ', await page.evaluate(() => baMasterState.rt1.gold), 4321);
    ok('ตารางบนโชว์ทองใหม่', /4321/.test(await cellText(page, '#fbBody tr td:nth-child(6)')));

    /* ยิงซ้ำด้วยค่าเดิม = ลายเซ็นไม่เปลี่ยน = ไม่วาดซ้ำ */
    const p0 = await page.evaluate(() => baBattleAudit().dualSync.n.paint);
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) fbApply('put', JSON.stringify({ path: '/rt1/gold', data: 4321 }));
    });
    await page.waitForTimeout(300);
    eq('ค่าไม่เปลี่ยน = ไม่วาดเพิ่มสักครั้ง',
       await page.evaluate(() => baBattleAudit().dualSync.n.paint), p0);

    /* ห้ามให้ #gmBody ถูกสั่งวาดใหม่ฟรี (test_gm_admin บล็อก 12.6 เฝ้าไว้) */
    const r0 = await page.evaluate(() => baBattleAudit().gmAdmin.sync.renders);
    await page.evaluate(() => { for (let i = 0; i < 6; i++) fbPaint(); });
    await page.waitForTimeout(400);
    eq('ไม่สั่งวาด #gmBody ฟรี', await page.evaluate(() => baBattleAudit().gmAdmin.sync.renders), r0);

    /* สัญญาณที่มาเป็นฟิลด์เดี่ยวต้องไม่ล้างฟิลด์อื่นทิ้ง */
    await page.evaluate(() => fbApply('put', JSON.stringify({ path: '/rt1/lv', data: 44 })));
    await page.waitForTimeout(250);
    const rec = await page.evaluate(() => baMasterState.rt1);
    eq('ฟิลด์เดี่ยวเปลี่ยนแค่ตัวเดียว', [rec.lv, rec.gold], [44, 4321]);
    eq('ป้ายแรงค์ตามเลเวลใหม่',
       await cellText(page, '#fbBody tr td:nth-child(2) .gm-sub'), 'C-RANK');
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 5 · Cross-Table Event Bridge ═══════════════════════════════════════
  {
    say('\n═══ 5 · คำสั่ง GM เด้งถึงอีกตารางทันที ═══');
    const { ctx, page, errs } = await fresh(browser);
    await enterPanel(page);

    await seedStore(page, 'br1', { level: 6, gold: 500, exp: 20, maxExp: 300, hp: 10, maxHp: 300, mp: 5, maxFloor: 7, floor: 7 });
    await seed(page, [live('br1', { lv: 6, gold: 500, exp: 20, mexp: 300, hp: 10, mhp: 300, mp: 5, mfloor: 7, floor: 7 })]);
    await page.evaluate(() => gmRender());
    await page.waitForTimeout(300);

    /* 5.1 🎁 แจกทอง (ผ่าน withStudent ของ v4.3) */
    const b0 = await page.evaluate(() => baBattleAudit().dualSync.n.bridge);
    await page.evaluate(() => gmGift('br1'));
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const i = document.getElementById('gmModalInput'); if (i) i.value = '250';
      const b = document.getElementById('gmModalOk'); if (b) b.click();
    });
    await page.waitForTimeout(400);
    ok('สะพานทำงาน', await page.evaluate(() => baBattleAudit().dualSync.n.bridge) > b0);
    eq('ทะเบียนถูกแก้จริง', await page.evaluate(() => loadStore().br1.gold), 750);
    ok('ตารางบนขยับทันทีโดยไม่ต้องรอสัญญาณรอบถัดไป',
       /750/.test(await cellText(page, '#fbBody tr td:nth-child(6)')),
       await cellText(page, '#fbBody tr td:nth-child(6)'));
    ok('ตารางล่างขยับด้วย',
       /750/.test(await page.evaluate(() => {
         const tr = [].filter.call(document.querySelectorAll('#gmBody tr'), x => /@br1/.test(x.textContent))[0];
         return tr ? tr.cells[5].textContent : '';
       })));

    /* 5.2 💊 เติมสถานะ (gcHeal เขียน store เองไม่ผ่าน withStudent) */
    await page.evaluate(() => gcHeal('br1', 'all'));
    await page.waitForTimeout(400);
    /* **ห้ามคาดหวังเลข maxHp ที่ยัดเข้าไปเอง** — migrateAccount ของ v4.0 คำนวณ maxHp
       ใหม่จากเลเวล + VIT ทุกครั้งที่อ่าน store (กับดักข้อ 20) เทียบว่า "เต็มหลอด" แทน */
    const full = /❤️ (\d+)\/\1 · 🔮 (\d+)\/\2/;
    const pw = await cellText(page, '#fbBody tr td:nth-child(3)');
    ok('ค่าพลังบนตารางบนเต็มหลอดทันที', full.test(pw), pw);
    const pwGm = await page.evaluate(() => {
      const tr = [].filter.call(document.querySelectorAll('#gmBody tr'), x => /@br1/.test(x.textContent))[0];
      return tr ? tr.cells[4].textContent.replace(/\s+/g, ' ').trim() : '';
    });
    ok('ค่าพลังบนตารางล่างตรงกัน', full.test(pwGm), pwGm);

    /* 5.3 🔄 รีเซ็ตแยกส่วนของ v7.4 */
    await page.evaluate(() => baMrApply('br1', 'gold'));
    await page.waitForTimeout(400);
    eq('ทองในทะเบียนถูกล้าง', await page.evaluate(() => loadStore().br1.gold), 0);
    ok('ตารางบนเห็นการล้างทันที',
       /^0 🪙$/.test(await cellText(page, '#fbBody tr td:nth-child(6)')),
       await cellText(page, '#fbBody tr td:nth-child(6)'));

    /* 5.4 สัญญาณที่ใหม่กว่าคำสั่ง = คำสั่งหมดอายุไปเอง (ยังสั่งกลับเครื่องนักเรียนไม่ได้)

       **Micro-Patch Force Nuclear Reset เพิ่ม GM Write-Lock 20 วินาทีมาคั่นตรงนี้**
       สัญญาณที่มาถึงระหว่างล็อกถูกปฏิเสธทั้งหมด ต่อให้ประทับเวลาใหม่กว่าก็ตาม —
       นั่นคือทั้งหมดที่ล็อกมีไว้ทำ (Student Heartbeat Race ของสเปกนั้น)
       กติกาของ v7.7 ยังเป็นจริงทุกประการ แค่ถูกเลื่อนออกไปจนล็อกหมดอายุ
       เทสต์จึงพิสูจน์ทั้งสองด้าน: ระหว่างล็อกต้องกัน · พ้นล็อกแล้วต้องยอมตามเดิม */
    eq('มีคำสั่งค้างอยู่ 1 รายการ', await page.evaluate(() => baBattleAudit().dualSync.edits), 1);
    const sig = () => page.evaluate(() => fbApply('put', JSON.stringify({
      path: '/br1', data: { u: 'br1', name: 'br1', lv: 6, gold: 9999, at: Date.now() + 60000 }
    })));
    ok('ล็อกยังทำงานอยู่หลังรีเซ็ต',
       await page.evaluate(() => baBattleAudit().nuke.locked.indexOf('br1') >= 0));
    await sig();
    await page.waitForTimeout(300);
    eq('สัญญาณที่มาระหว่างล็อกถูกปฏิเสธ',
       await page.evaluate(() => baMasterState.br1.gold), 0);

    await page.evaluate(() => { BA_FN_LOCK = {}; BA_FN_CLEAN = {}; });
    await sig();
    await page.waitForTimeout(300);
    eq('คำสั่งถูกปลดเมื่อสัญญาณใหม่กว่ามาถึง',
       await page.evaluate(() => baBattleAudit().dualSync.edits), 0);
    eq('ตารางบนกลับไปใช้ค่าจากสัญญาณ',
       await page.evaluate(() => baMasterState.br1.gold), 9999);

    /* 5.5 ลบไอดีแล้วคำสั่งที่ค้างต้องหายตาม */
    await page.evaluate(() => { baMsBridge('br1', 'test'); });
    await page.evaluate(() => { const s = loadStore(); delete s.br1; saveStore(s); FB_LIVE = {}; baMsSync(); });
    eq('ไม่มีคำสั่งค้างของคนที่ถูกลบ', await page.evaluate(() => baBattleAudit().dualSync.edits), 0);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 6 · เครื่องนักเรียนต้องไม่มีต้นทุน ══════════════════════════════════
  {
    say('\n═══ 6 · ห้องควบคุมไม่ได้กางอยู่ = เงียบสนิท ═══');
    const { ctx, page, errs } = await fresh(browser);

    eq('ยังไม่ได้กางแผง = baMsOn เป็นเท็จ', await page.evaluate(() => baMsOn()), false);
    const n0 = await page.evaluate(() => baBattleAudit().dualSync.n);
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) fbApply('put', JSON.stringify({ path: '/z1', data: { u: 'z1', gold: i } }));
    });
    await page.waitForTimeout(250);
    const n1 = await page.evaluate(() => baBattleAudit().dualSync.n);
    eq('ไม่ปั้นสถานะกลางเลย', n1.sync, n0.sync);
    eq('ไม่วาดเลย', n1.paint, n0.paint);
    eq('สถานะกลางยังว่าง', await page.evaluate(() => Object.keys(baMasterState).length), 0);
    ok('ของเดิมยังทำงานปกติ (FB_LIVE ยังรับสัญญาณ)',
       await page.evaluate(() => !!FB_LIVE.z1));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 7 · เลย์เอาต์ฝั่งนักเรียนต้องไม่ขยับ ════════════════════════════════
  {
    say('\n═══ 7 · การ์ดโจทย์ยังสูงเท่าเดิมทุกจอ ═══');
    for (const w of [320, 360, 390, 430]) {
      const { ctx, page, errs } = await fresh(browser, w, 844);
      await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(120);
      await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        switchTab('register');
        document.getElementById('reg-id').value = 'lay' + Date.now().toString(36);
        document.getElementById('reg-pw').value = '1234';
        document.getElementById('reg-pw2').value = '1234';
        handleSubmit();
      });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const c = document.querySelector('#cdDraft.active .cd-card'); if (c) c.click(); });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        const m = G.currentMonster;
        m.word = '北京语言大学';
        m.pinyin = 'Běijīng Yǔyán Dàxué';
        m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
        m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
        document.getElementById('gWord').textContent = m.word;
        document.getElementById('gPinyin').textContent = m.pinyin;
        document.getElementById('gFeedback').textContent = '';
        renderChoices();
      });
      await page.waitForTimeout(250);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await page.waitForTimeout(150);
      const h = await page.evaluate(() => {
        const q = document.querySelector('.ac-battle');
        return q ? Math.round(q.getBoundingClientRect().height * 10) / 10 : -1;
      });
      const want = w <= 320 ? 354.8 : 340.8;
      ok('จอ ' + w + ' — การ์ดโจทย์ยังสูง ' + want + 'px', Math.abs(h - want) < 0.6, h);
      ok('จอ ' + w + ' — ไม่ล้นแนวนอน',
         await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('จอ ' + w + ' — ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  // ═══ 8 · ทางเข้าสาธารณะสำหรับชุดเทสต์ ═══════════════════════════════════
  {
    say('\n═══ 8 · baBattleAudit().dualSync ═══');
    const { ctx, page, errs } = await fresh(browser);
    const a = await page.evaluate(() => baBattleAudit().dualSync);
    eq('รายงานเลขรุ่น', a.ver, '7.7');
    eq('เริ่มต้นยังไม่มีคนในสถานะกลาง', a.users, 0);
    eq('เริ่มต้นไม่มีคำสั่งค้าง', a.edits, 0);
    ok('รายงานสไตล์ที่ติดตั้งแล้ว', a.styled);
    ok('รายงานตัวอย่างผลของสูตรครบทั้งสี่',
       !!(a.fmt.floor && a.fmt.exp && a.fmt.gold && a.fmt.power), a.fmt);
    ok('ก้อนอื่นของ baBattleAudit ยังอยู่ครบ',
       await page.evaluate(() => {
         const o = baBattleAudit();
         return !!(o.gmAdmin && o.gmReset && o.loopCounter && o.lvScale && o.shop &&
                   o.curse && o.combo && o.hiTier && o.resil && o.shadow);
       }));
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  say('\n══════════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
