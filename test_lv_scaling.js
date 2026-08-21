/* ชุดเทสต์ Patch v7.6 — EXP SCALING · REBALANCED RANK BRACKETS · LEVEL-UP IMPACT
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_lv_scaling.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส)
     · เข้าเกม/ห้องควบคุมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่ว)
     · อ่าน hunterAtk / G.maxHp สดทุกเคส ห้ามแคชไว้ต้นไฟล์ (กับดักข้อ 20)                */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'lv_scaling_log.txt');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }

/* สูตรของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ — เป็น "สารบัญชุดที่สอง" ที่จำเป็น
   ถ้าอ่านค่าคงที่ในเกมมาคูณเอง เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนสูตรไปแล้ว */
function wantExp(lv) {
  const n = Math.max(1, Math.min(99, Math.floor(lv)));
  return Math.floor(300 * Math.pow(n, 1.65) + 50 * Math.pow(n, 2.0));
}
const WANT_TO = [15, 30, 45, 60, 72, 82, 90, 95, 98, 99];
const WANT_LABEL = ['E-RANK', 'D-RANK', 'C-RANK', 'B-RANK', 'A-RANK',
                    'S-RANK', 'SS-RANK', 'SSS-RANK', 'National Level', 'Shadow Monarch'];

function live(u, over) {
  return Object.assign({
    u: u, name: 'ฮันเตอร์ ' + u, room: '',
    lv: 7, exp: 40, mexp: 200, hp: 55, mhp: 190, mp: 30,
    floor: 6, mfloor: 8, rank: 'D', gold: 1200,
    corr: 90, wrong: 30, acc: 75, best: 12, words: 44, loops: 0,
    title: '', frozen: false, weak: [],
    at: Date.now(), dev: 'devX', ver: '5.3'
  }, over || {});
}

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(null), text: () => Promise.resolve('null')
    });
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
}

async function enterPanel(page) {
  await ackRules(page);
  await page.evaluate(() => { document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
  await page.waitForTimeout(300);
}

(async () => {
  fs.writeFileSync(LOG, '=== test_lv_scaling · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ติดตั้ง · ค่าคงที่ · ทางเข้าสาธารณะ ═════════════════════════
  {
    head('บล็อก 1 · ติดตั้ง · ค่าคงที่ · ทางเข้าสาธารณะ');
    const b1 = await boot(browser);

    const a = await b1.page.evaluate(() => baBattleAudit().lvScale);
    ok('baBattleAudit().lvScale มีอยู่จริง', !!a);
    eq('รุ่นของแพตช์', a.ver, '7.6');
    eq('เพดานเลเวลของสูตรทั้งชุด', a.max, 99);
    eq('Base Max HP ต่อเลเวลตามสเปก', a.gain.hp, 15);
    eq('ส่วนต่างที่ตัวห่อบวกจริง (ของ v4.0 ให้ 10 อยู่แล้ว)', a.gain.hpAdd, 5);
    eq('ATK ต่อเลเวล', a.gain.atk, 0.015);
    eq('อัตราทองต่อเลเวล', a.gain.gold, 0.005);
    eq('ตัวคูณของเส้นโค้ง EXP', [a.exp.k, a.exp.p, a.exp.k2, a.exp.p2], [300, 1.65, 50, 2.0]);
    ok('ปรับบันไดแรงค์ให้ตรงชุดใหม่แล้วตั้งแต่โหลดหน้า', a.synced === true, a.tiers);
    eq('ช่องเก็บของยังเป็น 10 ช่องเดิม (สเปกสั่งห้ามแตะ)', a.bag, 10);

    ok('getBaLvRank เป็นฟังก์ชันตามชื่อในสเปก',
       await b1.page.evaluate(() => typeof getBaLvRank === 'function'));
    ok('getBaLvRank ให้ผลเดียวกับ baLvRank ของ v7.2 ทุกเลเวล 1-99',
       await b1.page.evaluate(() => {
         for (let n = 1; n <= 99; n++) if (getBaLvRank(n) !== baLvRank(n)) return false;
         return true;
       }));

    ok('ไม่มี pageerror', b1.errs.length === 0, b1.errs);
    await b1.ctx.close();
  }

  // ══ บล็อก 2 · บันไดแรงค์ชุดใหม่ ═══════════════════════════════════════════
  {
    head('บล็อก 2 · บันไดแรงค์ E 1-15 … Shadow Monarch 99');
    const b2 = await boot(browser);

    eq('ยังมีสิบขั้นเท่าเดิม (ไม่ได้เพิ่ม/ลดขั้น)',
       await b2.page.evaluate(() => BA_LVRANK.length), 10);
    eq('ป้ายทั้งสิบขั้นยังเป็นของ v7.2 ทุกใบ',
       await b2.page.evaluate(() => BA_LVRANK.map(r => r.label)), WANT_LABEL);
    eq('ขอบบนของทุกขั้นตรงสเปก',
       await b2.page.evaluate(() => BA_LVRANK.map(r => r.to)), WANT_TO);
    eq('ขอบล่างถูกอนุมานจากขั้นก่อนหน้า',
       await b2.page.evaluate(() => BA_LVRANK.map(r => baLvRankFrom(r))),
       [1, 16, 31, 46, 61, 73, 83, 91, 96, 99]);

    /* ไล่ทุกเลเวล 1-99 เทียบกับตารางที่เทสต์ถือไว้เอง — เจอขอบเขตเพี้ยนแม้ระดับเดียว */
    const wrong = await b2.page.evaluate(function (o) {
      const wt = o.to, wl = o.label, bad = [];
      for (let n = 1; n <= 99; n++) {
        let want = wl[wl.length - 1];
        for (let i = 0; i < wt.length; i++) if (n <= wt[i]) { want = wl[i]; break; }
        if (getBaLvRank(n).label !== want) bad.push([n, getBaLvRank(n).label, want]);
      }
      return bad;
    }, { to: WANT_TO, label: WANT_LABEL });
    eq('ไล่ครบ 1-99 ไม่มีเลเวลไหนตกขั้นผิด', wrong, []);

    eq('เลเวลขอบเขตทุกจุดตกขั้นถูก',
       await b2.page.evaluate(() => [15, 16, 30, 31, 45, 46, 60, 61, 72, 73, 82, 83, 90, 91, 95, 96, 98, 99]
         .map(n => getBaLvRank(n).key)),
       ['E', 'D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S', 'SS', 'SS', 'SSS', 'SSS', 'NL', 'NL', 'SM']);
    eq('หนีบค่าเพี้ยนให้อยู่ใน 1-99 เสมอ',
       await b2.page.evaluate(() => [0, -5, 120, NaN, null].map(n => getBaLvRank(n).key)),
       ['E', 'E', 'SM', 'E', 'E']);
    ok('บันไดขั้นละ 10 เลเวลของ v7.2 ถูกแทนที่แล้วจริง',
       await b2.page.evaluate(() => BA_LVRANK[0].to !== 10 && BA_LVRANK[1].to !== 20));

    ok('เรียก baLvSyncTiers ซ้ำได้ไม่เพี้ยน (idempotent)',
       await b2.page.evaluate(() => {
         for (let i = 0; i < 5; i++) baLvSyncTiers();
         return baBattleAudit().lvScale.synced === true && BA_LVRANK.length === 10;
       }));

    ok('ไม่มี pageerror', b2.errs.length === 0, b2.errs);
    await b2.ctx.close();
  }

  // ══ บล็อก 3 · เส้นโค้ง EXP ════════════════════════════════════════════════
  {
    head('บล็อก 3 · เส้นโค้ง EXP 300·lv^1.65 + 50·lv^2.0 (Ragnarok Classic)');
    const b3 = await boot(browser);

    const lvs = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 72, 82, 90, 95, 98, 99];
    const got = await b3.page.evaluate(ns => ns.map(n => expForLevel(n)), lvs);
    eq('เพดาน EXP ตรงสูตรของสเปกทุกเลเวลที่สุ่มมา', got, lvs.map(wantExp));
    ok('เส้นโค้งโตขึ้นเรื่อย ๆ ไม่มีช่วงไหนแบนหรือย้อน',
       await b3.page.evaluate(() => {
         for (let n = 1; n < 99; n++) if (expForLevel(n + 1) <= expForLevel(n)) return false;
         return true;
       }));
    eq('เลเวลเกิน 99 ใช้เพดานของ 99 (สเปกนิยามไว้แค่ 1-99)',
       await b3.page.evaluate(() => [expForLevel(100), expForLevel(150), expForLevel(99)]),
       [wantExp(99), wantExp(99), wantExp(99)]);
    eq('ค่าเพี้ยนตกกลับไปที่เลเวล 1 ไม่โยน error',
       await b3.page.evaluate(() => [expForLevel(0), expForLevel(-9), expForLevel(NaN), expForLevel(undefined)]),
       [wantExp(1), wantExp(1), wantExp(1), wantExp(1)]);

    /* บัญชีที่อ่านผ่าน migrateAccount ต้องได้เพดานชุดใหม่ทันที ไม่ต้อง migrate อะไรเลย */
    await enterGame(b3.page, 'lv_exp');
    eq('บัญชีที่เพิ่งสมัครได้เพดานของเลเวล 1 ตามเส้นโค้งใหม่',
       await b3.page.evaluate(() => G.maxExp), wantExp(1));

    /* ขึ้นเลเวลจริงผ่าน levelUpCheck ของ v4.0 — เพดานต้องเดินตามเส้นโค้งใหม่ทุกขั้น */
    const climb = await b3.page.evaluate(function (want) {
      G.level = 1; G.exp = 0; G.maxExp = expForLevel(1);
      G.exp = want[0] + want[1] + want[2];      /* พอขึ้นสามเลเวลพอดี */
      const gained = levelUpCheck();
      return { gained: gained, level: G.level, exp: G.exp, maxExp: G.maxExp };
    }, [wantExp(1), wantExp(2), wantExp(3)]);
    eq('ได้ EXP ก้อนใหญ่แล้วขึ้นสามเลเวลรวดเดียว', climb.gained, 3);
    eq('เลเวลไปหยุดที่ 4', climb.level, 4);
    eq('EXP ที่เหลือเป็น 0 พอดี', climb.exp, 0);
    eq('เพดานของเลเวลใหม่ตรงเส้นโค้ง', climb.maxExp, wantExp(4));

    ok('ไม่มี pageerror', b3.errs.length === 0, b3.errs);
    await b3.ctx.close();
  }

  // ══ บล็อก 4 · ผลของการอัปเลเวล — HP · ATK · ทอง ═══════════════════════════
  {
    head('บล็อก 4 · Base Max HP +15 · ATK +1.5% · Gold Rate +0.5% ต่อเลเวล');
    const b4 = await boot(browser);
    await enterGame(b4.page, 'lv_gain');

    /* 4.1 HP — เทียบกับสูตรที่เทสต์ถือเอง 100 + (lv-1)*15 + vit*2 + โบนัสแรงค์ */
    const hp = await b4.page.evaluate(() => {
      const out = [];
      [1, 2, 10, 30, 60, 99].forEach(function (n) {
        out.push({ lv: n, got: maxHpFor(n, 10, 0), want: 100 + (n - 1) * 15 + 20 });
      });
      return out;
    });
    hp.forEach(function (r) { eq('maxHpFor เลเวล ' + r.lv, r.got, r.want); });
    /* โบนัสของแพตช์นี้หยุดที่ 99 ส่วนฐาน (lv-1)*10 ของ v4.0 ไม่ถูกแตะ จึงโตต่อได้ตามเดิม */
    eq('เลเวลเกิน 99 — โบนัสของแพตช์นี้หยุดเพิ่มแล้ว',
       await b4.page.evaluate(() => [110, 120, 300].map(n => maxHpFor(n, 10, 0) - (100 + (n - 1) * 10 + 20))),
       [98 * 5, 98 * 5, 98 * 5]);
    ok('VIT กับโบนัสแรงค์ของ v4.0 ยังบวกเข้ามาครบ (ไม่ได้เขียนสูตรใหม่ทับ)',
       await b4.page.evaluate(() => maxHpFor(10, 40, 30) - maxHpFor(10, 10, 0) === 30 * 2 + 30));

    /* 4.2 HP จริงในเกม — recalcStats ของ v4.0 ต้องได้ค่าตามสูตรใหม่ */
    const live4 = await b4.page.evaluate(() => {
      G.level = 20; recalcStats();
      return { max: G.maxHp, want: maxHpFor(20, G.stats.vit, rankHpBonus()) };
    });
    eq('G.maxHp หลัง recalcStats ตรงกับ maxHpFor', live4.max, live4.want);

    /* 4.3 ATK — ตัวคูณต้องเป็น 1 + 1.5% × (เลเวล-1) ของยอดฐานที่ชั้นล่างคืนมา */
    const atk = await b4.page.evaluate(() => {
      const out = [];
      [1, 2, 25, 50, 99].forEach(function (n) {
        G.level = n; recalcStats();
        const base = Math.round((15 + G.level * 3) * (1 + G.stats.str / 200));
        out.push({ lv: n, got: hunterAtk(), want: Math.max(1, Math.round(base * (1 + 0.015 * (n - 1)))) });
      });
      return out;
    });
    atk.forEach(function (r) { eq('hunterAtk เลเวล ' + r.lv, r.got, r.want); });
    eq('เลเวล 1 ยังไม่มีโบนัส (ตัวคูณ = 1)',
       await b4.page.evaluate(() => { G.level = 1; recalcStats(); return baLvAtkMul(); }), 1);
    ok('เลเวล 99 ได้ตัวคูณ +147%',
       await b4.page.evaluate(() => { G.level = 99; recalcStats(); return Math.round(baLvAtkMul() * 1000); }) === 2470);

    /* 4.4 ทอง — บวกเข้าตัวคูณตรง ๆ ส่วนต่างจึงเท่ากับ 0.5% × (เลเวล-1) เป๊ะ */
    const gold = await b4.page.evaluate(() => {
      G.level = 1; recalcStats();
      const one = goldMul();
      const out = [];
      [1, 2, 21, 51, 99].forEach(function (n) {
        G.level = n; recalcStats();
        out.push({ lv: n, d: Math.round((goldMul() - one) * 100000) / 100000, want: Math.round(0.005 * (n - 1) * 100000) / 100000 });
      });
      return out;
    });
    gold.forEach(function (r) { eq('ส่วนต่างอัตราทองที่เลเวล ' + r.lv, r.d, r.want); });
    ok('ไม่ได้คูณทับโบนัสก้อนอื่น — เลเวล 99 บวกเข้ามา +49% พอดี',
       await b4.page.evaluate(() => { G.level = 99; recalcStats(); return Math.round(baLvGoldAdd() * 1000); }) === 490);

    /* 4.5 หมัดที่ต้องตีไม่ขยับ — HP มอนสเตอร์คิดจาก hunterAtk ตัวเดียวกัน */
    const hits = await b4.page.evaluate(() => {
      const out = [];
      [1, 40, 99].forEach(function (n) {
        G.level = n; recalcStats();
        out.push(Math.round(monsterHpFor(3) / hunterAtk()));
      });
      return out;
    });
    ok('จำนวนหมัดที่ต้องตีเท่ากันทุกเลเวล', hits[0] === hits[1] && hits[1] === hits[2], hits);

    ok('ไม่มี pageerror', b4.errs.length === 0, b4.errs);
    await b4.ctx.close();
  }

  // ══ บล็อก 5 · ไม่ทำลายของเดิม (v4.0-v7.5) ═════════════════════════════════
  {
    head('บล็อก 5 · ของเดิมของ v4.0-v7.5 ต้องไม่ขยับสักตัว');
    const b5 = await boot(browser);

    eq('RANKS ของ v4.0 (แรงค์ตามชั้น) ยังเป็นชุดเดิมทุกขั้น',
       await b5.page.evaluate(() => RANKS.map(r => [r.key, r.from, r.to])),
       [['E', 1, 5], ['D', 6, 10], ['C', 11, 15], ['B', 16, 18], ['A', 19, 19], ['S', 20, 20]]);
    eq('FEATURE_RANK ยังปลดล็อกที่แรงค์เดิมทุกรายการ',
       await b5.page.evaluate(() => ['statPoints', 'shop', 'potion', 'titles', 'scroll', 'freeze', 'autoCut', 'analytics']
         .map(k => FEATURE_RANK[k])),
       ['D', 'D', 'D', 'C', 'C', 'B', 'A', 'S']);
    eq('ช่องเก็บของยังเป็น 10', await b5.page.evaluate(() => BAG_SLOTS), 10);
    eq('เพดานชั้นยังเป็น 20', await b5.page.evaluate(() => FLOOR_MAX), 20);
    eq('ชั้นบอสยังเป็นชุดของ v6.4',
       await b5.page.evaluate(() => [1,2,3,4,5,8,12,16,20].map(f => isBossFloor(f))),
       [false, false, false, true, false, true, true, true, true]);
    eq('ราคาร้านค้าของ v7.5 ไม่ขยับ',
       await b5.page.evaluate(() => ['potion', 'freeze', 'mystery', 'glass', 'scroll', 'focus', 'insurance']
         .map(k => (itemOf(k) || {}).price)),
       [650, 1200, 1200, 2200, 2500, 3600, 5000]);

    /* การ์ดโจทย์ห้ามขยับแม้แต่พิกเซลเดียว — ข้อจำกัดหลักของทุกชั้นตั้งแต่ v6.0 */
    for (const w of [320, 390]) {
      const b = await boot(browser, w, 844);
      await enterGame(b.page, 'lv_h' + w);
      /* บังคับคำ/ตัวเลือกให้คงที่ + แช่อนิเมชัน ก่อนวัดเสมอ (กติกาเดียวกับ verify_arena) */
      await b.page.evaluate(() => {
        const m = G.currentMonster;
        if (m) {
          m.word = '北京语言大学';
          m.pinyin = 'Běijīng Yǔyán Dàxué';
          m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
          m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
          document.getElementById('gWord').textContent = m.word;
          document.getElementById('gPinyin').textContent = m.pinyin;
          renderChoices();
        }
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
      });
      await b.page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await b.page.waitForTimeout(250);
      const h = await b.page.evaluate(() => {
        const card = document.querySelector('.ac-battle');
        return card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : -1;
      });
      eq('ความสูงการ์ดโจทย์บนจอ ' + w, h, w === 320 ? 354.8 : 340.8);
      await b.ctx.close();
    }

    ok('ไม่มี pageerror', b5.errs.length === 0, b5.errs);
    await b5.ctx.close();
  }

  // ══ บล็อก 6 · ป้ายแรงค์ในตารางครูสองใบต้องตรงกัน 100% ═════════════════════
  {
    head('บล็อก 6 · #fbBody กับ #gmBody บอกแรงค์คนเดียวกันตรงกัน');
    const b6 = await boot(browser, 1200, 950);
    await enterPanel(b6.page);

    const sample = [[8, 'E-RANK'], [15, 'E-RANK'], [16, 'D-RANK'], [40, 'C-RANK'], [55, 'B-RANK'],
                    [66, 'A-RANK'], [80, 'S-RANK'], [88, 'SS-RANK'], [94, 'SSS-RANK'],
                    [97, 'National Level'], [99, 'Shadow Monarch']];

    await b6.page.evaluate(function (rows) {
      FB_LIVE = {};
      rows.forEach(function (r) { FB_LIVE['u' + r[0]] = r[1]; });
      FB_MST = 'live';
      fbPaint();
    }, sample.map(function (s) { return [s[0], live('u' + s[0], { lv: s[0], mfloor: 9 })]; }));
    await b6.page.waitForTimeout(400);

    const fb = await b6.page.evaluate(() => {
      const o = {};
      [].forEach.call(document.querySelectorAll('#fbBody tr'), function (tr) {
        if (!tr.cells || tr.cells.length < 2) return;
        const b = tr.cells[1].querySelector('b');
        const sub = tr.cells[1].querySelector('.gm-sub');
        if (b && sub) o[b.textContent.trim()] = sub.textContent.trim();
      });
      return o;
    });
    sample.forEach(function (s) { eq('#fbBody · Lv ' + s[0], fb[String(s[0])], s[1]); });

    await b6.page.evaluate(() => { gmRender(); });
    await b6.page.waitForTimeout(400);
    const gm = await b6.page.evaluate(() => {
      const o = {};
      [].forEach.call(document.querySelectorAll('#gmBody tr'), function (tr) {
        if (!tr.cells || tr.cells.length < 2) return;
        const b = tr.cells[1].querySelector('b');
        const sub = tr.cells[1].querySelector('.gm-sub');
        if (b && sub) o[b.textContent.trim()] = sub.textContent.trim();
      });
      return o;
    });
    const both = Object.keys(gm).filter(function (k) { return fb[k] !== undefined; });
    ok('#gmBody มีแถวให้เทียบจริง', both.length >= 5, { gm: gm, fb: fb });
    eq('สองตารางบอกแรงค์ตรงกันทุกแถว',
       both.filter(function (k) { return gm[k] !== fb[k]; }), []);

    eq('ทูลทิปบอกช่วงเลเวลของขั้นนั้นถูก',
       await b6.page.evaluate(() => {
         const tr = [].filter.call(document.querySelectorAll('#fbBody tr'),
           t => t.cells && t.cells[1] && t.cells[1].querySelector('b') &&
                t.cells[1].querySelector('b').textContent.trim() === '66')[0];
         return tr ? tr.cells[1].querySelector('.gm-sub').title : '';
       }), 'เลเวล 61-72 · ระดับอีลิท');

    ok('ไม่มี pageerror', b6.errs.length === 0, b6.errs);
    await b6.ctx.close();
  }

  say('\n══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════');
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
