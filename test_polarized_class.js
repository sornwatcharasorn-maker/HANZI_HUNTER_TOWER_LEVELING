/* test_polarized_class.js — ชุดเทสต์ของ Patch v8.5 · 4-CLASS POLARIZED ENGINE
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_polarized_class.js
 *
 * กติกาที่ชุดนี้ต้องทำตาม (จาก CLAUDE.md)
 *   • stub fetch + EventSource **ก่อนโหลดหน้าเสมอ** — v5.4 ฝัง URL ฐานข้อมูลจริง
 *     ไว้ในซอร์ส ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง · และ **ห้าม stub แบบค้าง**
 *     (Promise ที่ไม่ยอม settle) เพราะ v5.8 รอผลตรวจตัวตนก่อนปล่อยให้ล็อกอิน
 *   • เข้าเกมด้วยเส้นทางจริง — ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7
 *     → กดผ่านประตูกรองชั้น 20 ของ v8.2
 *   • วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนเสมอ
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const GAME = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'test_polarized_class.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function log(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { pass++; log('  ✅ ' + name); }
  else { fail++; log('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name + ' [' + JSON.stringify(got) + ']', JSON.stringify(got) === JSON.stringify(want), { got, want }); }
function near(name, got, want, tol) { ok(name + ' [' + got + '≈' + want + ']', Math.abs(got - want) <= tol, { got, want }); }

async function openGame(browser, user, vw, vh) {
  const p = await browser.newPage({ viewport: { width: vw || 390, height: vh || 844 } });
  p.on('pageerror', e => { fail++; log('  ❌ PAGEERROR: ' + e.message); });
  await p.route('**fonts.googleapis.com**', r => r.abort());
  await p.addInitScript(() => {
    window.fetch = () => Promise.reject(new Error('offline-test'));
    window.EventSource = function () { this.close = () => {}; this.addEventListener = () => {}; };
  });
  await p.goto(GAME, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const e = document.getElementById('rgBody'); if (e) e.scrollTop = e.scrollHeight; });
  await p.waitForTimeout(200);
  await p.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await p.waitForTimeout(650);
  await p.evaluate(u => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1111';
    document.getElementById('reg-pw2').value = '1111';
    handleSubmit(new Event('submit'));
  }, user);
  await p.waitForTimeout(1100);
  await clearOverlays(p);
  return p;
}

async function clearOverlays(p) {
  for (let i = 0; i < 14; i++) {
    const done = await p.evaluate(() => {
      const d = document.querySelector('#cdDraft.active .cd-card'); if (d) { d.click(); return false; }
      if (document.querySelector('#snGate.active') && typeof snGateConfirm === 'function') { snGateConfirm(); return false; }
      if (document.querySelector('#baWvGate.active') && typeof baWvGateGo === 'function') { baWvGateGo(); return false; }
      if (typeof G !== 'undefined' && G && G.warpOpen && typeof warpGo === 'function') { warpGo(); return false; }
      return !(typeof acOverlayOpen === 'function' && acOverlayOpen());
    });
    if (done) return;
    await p.waitForTimeout(680);
  }
}

/* พาไปยืนชั้นที่ต้องการ — ปิดลูกเต๋าบุกรุกของ v6.6 ทุกครั้ง ไม่งั้นทัพเงาจะโผล่มา
   แทนอสูรประจำชั้นแล้วเคสจะตกแบบสุ่มโดยไม่มีอะไรพังจริง */
async function goFloor(p, f) {
  await p.evaluate(fl => {
    G.floor = fl; G.floorProgress = 0;
    if (typeof CD_BAND !== 'undefined' && typeof cdBandOf === 'function') CD_BAND = cdBandOf(fl);
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = fl; BA_INC_AT = -1; BA_INC_M = null; }
    nextMonster(); G.locked = false;
  }, f);
  await p.waitForTimeout(180);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · สารบัญสายอาชีพ + ฐานค่าพลังที่ Lv 1 ═══════════════════════
  log('\n── บล็อก 1 · 4 สายอาชีพ · ฐานค่าพลังขั้วตรงข้าม (Lv 1) ──');
  {
    const p = await openGame(browser, 'plA', 390, 844);
    const a = await p.evaluate(() => baBattleAudit().polarized);
    eq('มีครบ 4 สาย', a.classes, ['assassin', 'slayer', 'guardian', 'priest']);
    ok('ทะเบียนภาพ ba.assetRegistry มีจริง', a.registry === true);
    eq('สายเริ่มต้นคือ assassin', a.classId, 'assassin');
    eq('ร่างต้นที่ Lv 1', a.tier, 'c1');

    const WANT = {
      assassin: { str: 12, vit: 8,  agi: 25, int: 10, luk: 15 },
      slayer:   { str: 25, vit: 15, agi: 12, int: 5,  luk: 13 },
      guardian: { str: 10, vit: 30, agi: 5,  int: 15, luk: 10 },
      priest:   { str: 5,  vit: 10, agi: 10, int: 30, luk: 15 }
    };
    const GROW = { assassin: { agi: 2, luk: 1 }, slayer: { str: 2, vit: 1 },
                   guardian: { vit: 2, int: 1 }, priest: { int: 2, agi: 1 } };
    for (const id of Object.keys(WANT)) {
      const got = await p.evaluate(cid => {
        G.classId = cid; G.level = 1; G.freeAlloc = {}; recalcStats();
        return { base: baBattleAudit().polarized.base, grow: baBattleAudit().polarized.grow, live: G.stats };
      }, id);
      eq(id + ' · ฐาน Lv 1', got.base, WANT[id]);
      eq(id + ' · ค่าพลังสดตรงกับฐาน', got.live, WANT[id]);
      eq(id + ' · ค่าที่โตเอง (+3/เลเวล)', got.grow, GROW[id]);
      const sum = Object.values(GROW[id]).reduce((s, v) => s + v, 0);
      eq(id + ' · ค่าที่โตเองรวม = 3', sum, 3);
    }

    /* ขั้วตรงข้ามจริง — สายที่เด่นแต่ละแกนต้องเป็นคนละสายกัน */
    const best = {};
    ['str', 'vit', 'agi', 'int'].forEach(k => {
      let top = null;
      Object.keys(WANT).forEach(id => { if (!top || WANT[id][k] > WANT[top][k]) top = id; });
      best[k] = top;
    });
    eq('แกนเด่นของแต่ละสายไม่ซ้ำกัน', best, { str: 'slayer', vit: 'guardian', agi: 'assassin', int: 'priest' });
    await p.close();
  }

  // ══ บล็อก 2 · ร่างที่สอง (C2) และการโตอัตโนมัติ ══════════════════════════
  log('\n── บล็อก 2 · C1 Lv 1-49 → C2 Lv 50-99 · โตเอง +3 · อิสระ +2 ──');
  {
    const p = await openGame(browser, 'plB', 390, 844);
    const t = await p.evaluate(() => {
      const o = {};
      [1, 49, 50, 99].forEach(lv => { G.level = lv; recalcStats(); o[lv] = baBattleAudit().polarized.tier; });
      return o;
    });
    eq('Lv 1 = c1',  t['1'],  'c1');
    eq('Lv 49 = c1', t['49'], 'c1');
    eq('Lv 50 = c2', t['50'], 'c2');
    eq('Lv 99 = c2', t['99'], 'c2');

    const nm = await p.evaluate(() => {
      const o = {};
      [['assassin', 'Monarch'], ['slayer', 'Abyssal Slayer'], ['guardian', 'Abyssal Guard'], ['priest', 'Soul Master']]
        .forEach(([id, en]) => { G.classId = id; G.level = 50; recalcStats(); o[id] = [baBattleAudit().polarized.name, en]; });
      return o;
    });
    Object.keys(nm).forEach(id => {
      ok('ร่างที่สองของ ' + id + ' คือ ' + nm[id][1], nm[id][0].indexOf(nm[id][1]) >= 0, nm[id]);
    });

    const g = await p.evaluate(() => {
      G.classId = 'assassin'; G.level = 11; G.freeAlloc = {}; recalcStats();
      return { stats: Object.assign({}, G.stats), free: baBattleAudit().polarized.free };
    });
    eq('assassin Lv 11 · AGI 25+2×10', g.stats.agi, 45);
    eq('assassin Lv 11 · LUK 15+1×10', g.stats.luk, 25);
    eq('assassin Lv 11 · STR ไม่โตเอง', g.stats.str, 12);
    eq('Lv 11 มีแต้มอิสระ 20 แต้ม', g.free, 20);

    const al = await p.evaluate(() => {
      baPlAlloc('str'); baPlAlloc('str'); baPlAlloc('vit');
      return { str: G.stats.str, vit: G.stats.vit, free: baBattleAudit().polarized.free };
    });
    eq('แจกอิสระเข้า STR 2 แต้ม', al.str, 14);
    eq('แจกอิสระเข้า VIT 1 แต้ม', al.vit, 8 + 1);
    eq('แต้มอิสระเหลือ 17', al.free, 17);

    const over = await p.evaluate(() => {
      for (let i = 0; i < 50; i++) baPlAlloc('luk');
      return baBattleAudit().polarized.free;
    });
    eq('แจกเกินโควตาไม่ได้ (เหลือ 0)', over, 0);
    await p.close();
  }

  // ══ บล็อก 3 · สูตรทั้งสิบ ═══════════════════════════════════════════════
  log('\n── บล็อก 3 · สูตรทั้งสิบของสเปก ──');
  {
    const p = await openGame(browser, 'plC', 390, 844);
    await goFloor(p, 2);
    const r = await p.evaluate(() => {
      /* ตัวคูณทองของการ์ด v4.7 (🪙 พ่อค้า · ⛓️ โซ่ตรวน) กับออร่าห้องเรียนของ v8.0
         คูณทับ goldMul ตามกติกาเดิมของมันอย่างถูกต้อง — เคสนี้วัด "ส่วนที่ LUK
         ให้" ล้วน ๆ จึงต้องปลดการ์ดออกก่อน ไม่งั้นค่าจะแกว่งตามใบที่จั่วได้ */
      try { CD_CARD = null; CD_BAND = -1; } catch (e) {}
      G.classId = 'guardian'; G.level = 1; G.freeAlloc = {}; recalcStats();
      const s = Object.assign({}, G.stats);
      const probe = (k, v) => { const o = G.stats[k]; G.stats[k] = v; const r = {}; 
        r.atk = hunterAtk(); r.crit = critChance(); r.heal = floorHeal(); r.cut = autoCutChance();
        r.drop = dropChance(); r.gold = goldMul(); r.exp2 = expDoubleChance();
        r.qms = questionMs(); r.wrong = wrongDamage(); G.stats[k] = o; return r; };
      return { s, maxHp: G.maxHp, str0: probe('str', 0), str100: probe('str', 100),
               agi100: probe('agi', 100), int40: probe('int', 40), int200: probe('int', 200),
               luk40: probe('luk', 40), vit0: probe('vit', 0), vit200: probe('vit', 200) };
    });
    eq('ATK = 1000*(1+STR*0.005) · STR 0',   r.str0.atk,   1000);
    eq('ATK = 1000*(1+STR*0.005) · STR 100', r.str100.atk, 1500);
    /* HP: สูตรของสเปกเป็น "ส่วนของค่าพลัง" — ของที่ตั้งฉากกับค่าพลังยังบวกทับต่อได้
       (v7.6 +5/เลเวล · v7.9 HP จากคลังอักขระ/แกนชีวิต · พาสซีฟช่อง 3 ของผู้พิทักษ์)
       จึงวัดสองอย่าง: ค่าฐานของสายที่ไม่มีพาสซีฟ HP และ **ความชันต่อ VIT 1 แต้ม** */
    const hp = await p.evaluate(() => {
      G.classId = 'assassin'; G.level = 1; G.freeAlloc = {}; recalcStats();
      const base = G.maxHp;
      const slope = [];
      for (const v of [10, 11, 50, 51]) { G.stats.vit = v; slope.push(maxHpFor(1, v, 0)); }
      recalcStats();
      return { base, d1: slope[1] - slope[0], d2: slope[3] - slope[2] };
    });
    eq('HP = 750+VIT*15 · assassin VIT 8 ที่ Lv 1', hp.base, 750 + 8 * 15);
    eq('HP ชันขึ้น 15 ต่อ VIT 1 แต้ม', [hp.d1, hp.d2], [15, 15]);
    eq('Crit% = AGI*0.25 · AGI 100',         r.agi100.crit, 25);
    eq('Heal/Floor = floor(INT*0.5) · INT 40',  r.int40.heal, 20);
    eq('CutChoice% = min(25, INT*0.25) · INT 40',  r.int40.cut, 10);
    eq('CutChoice% เพดาน 25 · INT 200',      r.int200.cut, 25);
    eq('Drop% = LUK*0.45 · LUK 40',          r.luk40.drop, 18);
    eq('2xEXP% = LUK*0.2 · LUK 40',          r.luk40.exp2, 8);
    eq('Gold% = floor(LUK*1.12) · LUK 40',   +(r.luk40.gold).toFixed(4), +(1 + Math.floor(40 * 1.12) / 100).toFixed(4));
    ok('WrongDmg ฐาน = max(15, 60-VIT*0.3) · VIT 0 แรงกว่า VIT 200',
       r.vit0.wrong > r.vit200.wrong, { v0: r.vit0.wrong, v200: r.vit200.wrong });

    const sec = await p.evaluate(() => {
      const o = {}; const s = G.stats.agi;
      [0, 25, 60, 100, 200].forEach(a => { G.stats.agi = a; o[a] = questionMs(); });
      G.stats.agi = s; return o;
    });
    ok('BonusSec = min(4, floor(AGI/25)) · เพดาน 4 วิ',
       (sec['200'] - sec['0']) === 4000 && (sec['100'] - sec['0']) === 4000 && (sec['60'] - sec['0']) === 2000,
       sec);
    await p.close();
  }

  // ══ บล็อก 4 · เมทริกซ์คริสตัล 4 ช่อง ════════════════════════════════════
  log('\n── บล็อก 4 · 4 Slots & Diamond Matrix ──');
  {
    const p = await openGame(browser, 'plD', 390, 844);
    const a = await p.evaluate(() => baBattleAudit().polarized);
    eq('ช่อง 1 ราคา',  a.slots[0].cost, [0, 40, 80, 160, 300]);
    eq('ช่อง 2 ราคา',  a.slots[1].cost, [0, 40, 80, 160, 300]);
    eq('ช่อง 3 ราคา',  a.slots[2].cost, [0, 60, 120, 220, 450]);
    eq('ช่อง 4 ราคา',  a.slots[3].cost, [0, 100, 200, 350, 700]);
    eq('ช่อง 1 คูลดาวน์ 3', a.slots[0].cd, 3);
    eq('ช่อง 2 เป็นพาสซีฟ', a.slots[1].cd, 0);
    eq('ช่อง 3 คูลดาวน์ 4', a.slots[2].cd, 4);
    eq('อัปเต็มทั้งสาย = 3,360 💎', a.maxout, 3360);
    eq('ทุกช่องเริ่มที่ Lv 1', a.slots.map(s => s.lv), [1, 1, 1, 1]);

    const buy = await p.evaluate(() => {
      const b = abOf(G); b.shards = 5000;
      const before = abShards(G);
      const okBuy = baPlBuy(0);
      return { okBuy, before, after: abShards(G), lv: baBattleAudit().polarized.slots[0].lv };
    });
    ok('ซื้อ Lv1→2 สำเร็จ', buy.okBuy === true);
    eq('หัก 💎 40 พอดี', buy.before - buy.after, 40);
    eq('ช่อง 1 เป็น Lv 2', buy.lv, 2);

    const full = await p.evaluate(() => {
      const b = abOf(G); b.shards = 99999;
      let spent = 0;
      for (let i = 0; i < 4; i++) {
        while (baBattleAudit().polarized.slots[i].lv < 5) {
          const c = baBattleAudit().polarized.slots[i].next;
          const s0 = abShards(G); baPlBuy(i); spent += s0 - abShards(G);
        }
      }
      return { spent, lv: baBattleAudit().polarized.slots.map(s => s.lv),
               again: baPlBuy(0), next: baBattleAudit().polarized.slots[0].next };
    });
    eq('อัปเต็มทั้ง 4 ช่องได้ Lv 5', full.lv, [5, 5, 5, 5]);
    eq('ยอด 💎 ที่จ่ายทั้งหมด (หัก 40 ที่จ่ายไปแล้ว)', full.spent + 40, 3360);
    ok('ช่องที่เต็มแล้วซื้อต่อไม่ได้', full.again === false);
    eq('ช่องเต็มแล้วราคาถัดไป = 0', full.next, 0);

    const poor = await p.evaluate(() => {
      G.classId = 'slayer'; baPlEnsure(G);
      const b = abOf(G); b.shards = 10;
      const r = baPlBuy(0);
      return { r, lv: baBattleAudit().polarized.slots[0].lv, shards: abShards(G) };
    });
    ok('💎 ไม่พอ ซื้อไม่ได้', poor.r === false);
    eq('💎 ไม่ถูกหักเมื่อซื้อไม่สำเร็จ', poor.shards, 10);
    eq('เมทริกซ์แยกตามสาย — slayer ยังเป็น Lv 1', poor.lv, 1);

    const back = await p.evaluate(() => { G.classId = 'assassin'; baPlEnsure(G);
      return baBattleAudit().polarized.slots.map(s => s.lv); });
    eq('สลับกลับมา assassin เมทริกซ์เดิมยังอยู่', back, [5, 5, 5, 5]);
    await p.close();
  }

  // ══ บล็อก 5 · เกจปล่อยพลัง 8 ขีด ════════════════════════════════════════
  log('\n── บล็อก 5 · Persistent Slot 4 Ultimate (8 pips) ──');
  {
    const p = await openGame(browser, 'plE', 390, 844);
    await goFloor(p, 2);
    const step = await p.evaluate(() => {
      const set = n => { baPlPipSet(G, n); };
      const out = [];
      set(0);
      for (let i = 0; i < 10; i++) { baPlAfter(G, true); out.push(baPlPips()); }
      return out;
    });
    eq('ตอบถูกเดินทีละ 1 และหยุดที่ 8', step, [1, 2, 3, 4, 5, 6, 7, 8, 8, 8]);

    const wrong = await p.evaluate(() => {
      baPlPipSet(G, 5); baPlAfter(G, false);
      const a = baPlPips();
      baPlPipSet(G, 8); baPlAfter(G, false);
      const b = baPlPips();
      return { a, b, locked: baBattleAudit().polarized.locked };
    });
    eq('ตอบผิดตอนเกจยังไม่เต็ม → รีเซ็ต 0', wrong.a, 0);
    eq('ตอบผิดตอนเกจเต็ม → ยังเต็มอยู่ (ล็อก)', wrong.b, 8);
    ok('เกจเต็ม = สถานะล็อก', wrong.locked === true);

    const cast = await p.evaluate(() => {
      G.classId = 'assassin'; baPlEnsure(G); recalcStats();
      baPlPipSet(G, 8);
      G.monsterMaxHp = 9e7; G.monsterHp = 9e7; G.locked = false;
      const hp0 = G.monsterHp;
      const done = baPlCast();
      return { done, dealt: hp0 - G.monsterHp, pips: baPlPips(), n: baBattleAudit().polarized.n.cast };
    });
    ok('ปล่อยพลังสำเร็จตอนเกจเต็ม', cast.done === true);
    ok('ลงดาเมจจริง', cast.dealt > 0, cast);
    eq('ปล่อยแล้วเกจกลับเป็น 0', cast.pips, 0);

    const noCast = await p.evaluate(() => { baPlPipSet(G, 7); return baPlCast(); });
    ok('เกจไม่เต็ม ปล่อยไม่ได้', noCast === false);

    const heal = await p.evaluate(() => {
      G.classId = 'guardian'; baPlEnsure(G); recalcStats();
      G.hp = 1; baPlPipSet(G, 8);
      const h0 = G.hp; const done = baPlCast();
      return { done, gained: G.hp - h0, pips: baPlPips() };
    });
    ok('สายประคอง ปล่อยพลังแล้วฟื้น HP', heal.done === true && heal.gained > 0, heal);
    eq('สายประคอง ปล่อยแล้วเกจกลับเป็น 0', heal.pips, 0);

    const prac = await p.evaluate(() => {
      G.practiceMode = true; baPlPipSet(G, 3); baPlAfter(G, true);
      const r = baPlPips(); G.practiceMode = false; return r;
    });
    eq('โหมดฝึกจุดอ่อนไม่เดินเกจ', prac, 3);
    await p.close();
  }

  // ══ บล็อก 6 · เปลี่ยนสายอาชีพ ═══════════════════════════════════════════
  /* Critical Bug Fix — เปลี่ยนสายอาชีพฟรีทุกครั้ง ไม่มีค่า 💎 อีกต่อไป
     (ของเดิมคิด 100,000 ตั้งแต่ครั้งที่สอง ซึ่งเกินเพดานเศษคริสตัลของ v4.6
     ที่ 99,999 อยู่ 1 หน่วย ทำให้เปลี่ยนสายครั้งที่สองเป็นไปไม่ได้ในทางปฏิบัติ)
     บล็อกนี้จึงยืนยันว่าเปลี่ยนได้ไม่จำกัดครั้งโดยไม่มี 💎 เลยสักหน่วย */
  log('\n── บล็อก 6 · Class Switch (Free Class Change — ทุกครั้งไม่มีค่า 💎) ──');
  {
    const p = await openGame(browser, 'plF', 390, 844);
    const a0 = await p.evaluate(() => baBattleAudit().polarized);
    eq('เริ่มต้นเปลี่ยนไป 0 ครั้ง', a0.switches, 0);
    eq('ครั้งแรกราคา 0 💎', a0.swCost, 0);
    eq('ราคาครั้งถัดไปก็ยังเป็น 0 💎', a0.swPaid, 0);

    const first = await p.evaluate(() => {
      G.level = 30; recalcStats();
      const b = abOf(G); b.shards = 0;
      const before = { lv: G.level, sh: abShards(G) };
      const done = baPlSwitch('guardian');
      const a = baBattleAudit().polarized;
      return { done, before, sh: abShards(G), classId: a.classId, switches: a.switches,
               swCost: a.swCost, lv: G.level, stats: Object.assign({}, G.stats), maxHp: G.maxHp };
    });
    ok('เปลี่ยนสายครั้งแรกสำเร็จโดยไม่มี 💎 เลย', first.done === true);
    eq('ครั้งแรกไม่หัก 💎', first.sh, 0);
    eq('สายเปลี่ยนเป็น guardian', first.classId, 'guardian');
    eq('ตัวนับเดินเป็น 1', first.switches, 1);
    eq('ราคาครั้งถัดไปยังเป็น 0 💎 (ไม่มีค่าใช้จ่ายเลยแม้แต่ครั้งที่สอง)', first.swCost, 0);
    eq('เลเวลถูกคงไว้', first.lv, 30);
    eq('ค่าพลังคิดใหม่เป็นของ guardian (VIT 30+2×29)', first.stats.vit, 30 + 29 * 2);
    /* สูตรของสเปกให้ 750+VIT*15 · ที่เหลือเป็นของที่ตั้งฉากกับค่าพลังซึ่งบวกทับต่อ
       (v7.6 +5 ต่อเลเวล · พาสซีฟช่อง 3 ของผู้พิทักษ์ +60 ที่ Lv 1) */
    ok('HP คิดใหม่จากสูตร 750+VIT*15 แล้วบวกของที่ตั้งฉากทับ',
       first.maxHp >= 750 + first.stats.vit * 15, { got: first.maxHp, spec: 750 + first.stats.vit * 15 });
    const slope = await p.evaluate(() => [maxHpFor(30, 100, 0), maxHpFor(30, 101, 0)]);
    eq('HP ยังชันขึ้น 15 ต่อ VIT 1 แต้ม หลังเปลี่ยนสาย', slope[1] - slope[0], 15);

    const second = await p.evaluate(() => {
      const b = abOf(G); b.shards = 0;      /* ไม่มี 💎 เลยสักหน่วยก็ยังต้องเปลี่ยนได้ */
      const done = baPlSwitch('priest');
      const a = baBattleAudit().polarized;
      return { done, classId: a.classId, switches: a.switches, sh: abShards(G) };
    });
    ok('เปลี่ยนสายครั้งที่สองก็ยังฟรี — ไม่มี 💎 เลยก็เปลี่ยนสำเร็จ', second.done === true);
    eq('สายเปลี่ยนเป็น priest', second.classId, 'priest');
    eq('ตัวนับเดินเป็น 2', second.switches, 2);
    eq('💎 ไม่ถูกหักแม้แต่หน่วยเดียว', second.sh, 0);

    const same = await p.evaluate(() => baPlSwitch('priest'));
    ok('เปลี่ยนเป็นสายเดิมไม่นับ', same === false);
    await p.close();
  }

  // ══ บล็อก 7 · แถวปุ่มล่างสองคอลัมน์ + SYSTEM SCAN ═══════════════════════
  log('\n── บล็อก 7 · Bottom Menu 2-Col + SYSTEM SCAN 🪙 5,000 ──');
  {
    const p = await openGame(browser, 'plG', 390, 844);
    const m = await p.evaluate(() => {
      const bs = [...document.querySelectorAll('.g-actions .g-btn')];
      const last = bs[bs.length - 1], prev = bs[bs.length - 2];
      const cs = getComputedStyle(last), cs2 = getComputedStyle(prev);
      const rl = last.getBoundingClientRect(), rp = prev.getBoundingClientRect();
      return { n: bs.length, lastTxt: last.textContent.trim(), prevTxt: prev.textContent.trim(),
               lastSpan: cs.gridColumn, prevSpan: cs2.gridColumn,
               sameRow: Math.abs(rl.top - rp.top) < 3,
               sideBySide: rp.right <= rl.left + 2, price: baScanPrice(),
               id: last.id, gridCols: getComputedStyle(document.querySelector('.g-actions')).gridTemplateColumns };
    });
    eq('ปุ่มในแถวล่างครบ 10 ใบ', m.n, 10);
    ok('คอลัมน์ซ้ายคือ SYSTEM SCAN', /SYSTEM SCAN/.test(m.prevTxt), m.prevTxt);
    eq('ป้าย SYSTEM SCAN มีราคา 🪙 5,000', m.prevTxt, 'SYSTEM SCAN — เฉลยอักขระ (🪙 5,000)');
    ok('คอลัมน์ขวาคือ PROFILE', /PROFILE/.test(m.lastTxt), m.lastTxt);
    eq('ปุ่มขวาคือ 👤 PROFILE — ข้อมูลตัวละคร', m.lastTxt, '👤 PROFILE — ข้อมูลตัวละคร');
    eq('ปุ่มสุดท้ายไม่กินเต็มแถวแล้ว', m.lastSpan, 'auto');
    ok('สองปุ่มอยู่แถวเดียวกัน', m.sameRow === true, m);
    ok('เรียงซ้าย-ขวาจริง', m.sideBySide === true, m);
    eq('ราคาสแกนคงที่ 5,000', m.price, 5000);

    /* กันแทรกซ้ำ (กับดักข้อ 2) */
    const dup = await p.evaluate(() => { for (let i = 0; i < 8; i++) baPlMenu();
      return document.querySelectorAll('#baPlProfile').length; });
    eq('เรียก baPlMenu ซ้ำแล้วปุ่มยังมีใบเดียว', dup, 1);

    /* ราคาที่หักจริงต้องตรงกับป้าย */
    const charge = await p.evaluate(() => {
      G.gold = 20000; G.locked = false; G.hintText = '';
      const g0 = G.gold; showHint();
      return { spent: g0 - G.gold, label: [...document.querySelectorAll('.g-actions .g-btn')]
                 .find(b => /SYSTEM SCAN/.test(b.textContent)).textContent.trim() };
    });
    eq('กดสแกนแล้วหักทอง 5,000 ตรงกับป้าย', charge.spent, 5000);
    await p.close();
  }

  // ══ บล็อก 8 · แผงโปรไฟล์ "มองเห็นจริง" ══════════════════════════════════
  log('\n── บล็อก 8 · Profile Modal (กับดักข้อ 25 — ต้องพิสูจน์ว่ามองเห็น) ──');
  {
    const p = await openGame(browser, 'plH', 390, 844);
    await p.evaluate(() => baPlOpen());
    await p.waitForTimeout(260);
    const v = await p.evaluate(() => {
      const el = document.getElementById('baPlBoard');
      const inner = el.querySelector('.g-modal-inner');
      /* ซ่อนชั้น toast ของ v4.9.1 ชั่วคราวก่อนวัด — การ์ดแจ้งเตือนลอยเหนือโมดัล
         โดยชอบธรรมอยู่แล้ว ถ้าไม่ซ่อนจะนับเป็น "ถูกบัง" ทั้งที่ไม่ใช่ปัญหาของแผงนี้
         (กติกาเดียวกับที่ CLAUDE.md ใช้พิสูจน์แถบปลอดภัยของ v4.9.1) */
      const sn = document.getElementById('snLayer');
      const snVis = sn ? sn.style.display : null;
      if (sn) sn.style.display = 'none';
      const r = inner.getBoundingClientRect();
      let hit = 0, miss = 0;
      for (let x = r.left + 6; x < r.right - 6; x += 24) {
        for (let y = r.top + 6; y < r.bottom - 6; y += 24) {
          const e = document.elementFromPoint(x, y);
          if (e && e.closest && e.closest('#baPlBoard')) hit++; else miss++;
        }
      }
      if (sn) sn.style.display = snVis;
      return { active: el.classList.contains('active'), hit, miss,
               w: Math.round(r.width), h: Math.round(r.height),
               cls: document.querySelectorAll('#baPlBoard .ba-pl-cc').length,
               slots: document.querySelectorAll('#baPlBoard .ba-pl-sl').length,
               stats: document.querySelectorAll('#baPlBoard .ba-pl-st').length,
               derived: document.querySelectorAll('#baPlBoard .ba-pl-dv span').length,
               pips: document.querySelectorAll('#baPlBoard .ba-pl-ug .ba-pl-lp i').length,
               gender: document.querySelectorAll('#baPlBoard .ba-pl-gb').length };
    });
    ok('แผงเปิดอยู่', v.active === true);
    ok('มองเห็นจริงทุกจุดที่สุ่มวัด (' + v.hit + ' จุด)', v.hit > 20 && v.miss === 0, v);
    eq('มีการ์ดสายอาชีพครบ 4 ใบ', v.cls, 4);
    eq('มีเมทริกซ์ครบ 4 ช่อง', v.slots, 4);
    eq('มีค่าพลังสดครบ 5 แถว', v.stats, 5);
    eq('มีผลที่ได้จริงครบ 10 บรรทัด', v.derived, 10);
    eq('เกจปล่อยพลังแสดง 8 ขีด', v.pips, 8);
    eq('มีปุ่มเลือกเพศ 2 ใบ', v.gender, 2);

    const gd = await p.evaluate(() => { baPlSetGender('female');
      return { g: G.gender, art: baBattleAudit().polarized.art }; });
    eq('สลับเพศได้', gd.g, 'female');
    eq('ทะเบียนภาพยังว่าง (ยังไม่ฝังภาพ) จึงตกไปใช้อีโมจิ', gd.art, '');

    const close = await p.evaluate(() => { baPlClose();
      return document.getElementById('baPlBoard').classList.contains('active'); });
    ok('ปิดแผงได้', close === false);

    /* แผงใช้โครง .g-modal จึงถูก AC_OVL_SEL ของ v4.8.1 นับเป็นหน้าต่างระบบ */
    const paused = await p.evaluate(() => { baPlOpen();
      const r = (typeof acOverlayOpen === 'function') ? acOverlayOpen() : null; baPlClose(); return r; });
    ok('เปิดแผงแล้ว v4.8.1 หยุดนาฬิกาให้เอง', paused === true);
    await p.close();
  }

  // ══ บล็อก 9 · รอดข้ามการล็อกอิน ═════════════════════════════════════════
  log('\n── บล็อก 9 · ต้องรอด exitGame + ล็อกอินใหม่จริง (กับดักข้อ 16 · 38) ──');
  {
    const p = await openGame(browser, 'plI', 390, 844);
    await p.evaluate(() => {
      const b = abOf(G); b.shards = 5000;
      baPlSwitch('priest');
      baPlBuy(0); baPlBuy(0); baPlBuy(2);
      baPlSetGender('female');
      baPlPipSet(G, 6);
      G.level = 55; recalcStats();
      saveProgress();
    });
    await p.waitForTimeout(200);
    await p.evaluate(() => exitGame());
    await p.waitForTimeout(700);
    await p.evaluate(() => { enterGate(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'plI';
      document.getElementById('login-pw').value = '1111';
      handleSubmit(new Event('submit'));
    });
    await p.waitForTimeout(1200);
    await clearOverlays(p);
    const a = await p.evaluate(() => baBattleAudit().polarized);
    eq('สายอาชีพรอด', a.classId, 'priest');
    eq('ตัวนับเปลี่ยนสายรอด', a.switches, 1);
    eq('เพศรอด', a.gender, 'female');
    eq('เมทริกซ์รอด (ช่อง 1 = Lv 3 · ช่อง 3 = Lv 2)', [a.slots[0].lv, a.slots[2].lv], [3, 2]);
    eq('เกจปล่อยพลังรอด', a.pips, 6);
    eq('ร่างที่สองยังเป็น c2 ที่ Lv 55', a.tier, 'c2');
    ok('BA_PL_READY เปิดแล้วหลังล็อกอิน', a.ready === true);
    await p.close();
  }

  // ══ บล็อก 10 · เลย์เอาต์ — การ์ดโจทย์ห้ามขยับ ═══════════════════════════
  log('\n── บล็อก 10 · CLS = 0 · ความสูงการ์ดโจทย์ต้องเท่าเดิม ──');
  {
    for (const [w, h, want] of [[320, 568, 354.8], [360, 800, 340.8], [390, 844, 340.8], [430, 932, 340.8]]) {
      const p = await openGame(browser, 'plL' + w, w, h);
      await goFloor(p, 2);
      const r = await p.evaluate(() => {
        document.querySelectorAll('*').forEach(e => {
          e.style.animation = 'none'; e.style.transition = 'none';
        });
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        G.currentMonster.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'หอพัก'];
        G.currentMonster.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
        renderChoices();
        const card = document.querySelector('.ac-battle') ||
                     document.getElementById('gWord').closest('.g-card');
        const noHScroll = document.body.scrollWidth <= window.innerWidth;
        return { hgt: +card.getBoundingClientRect().height.toFixed(1), noHScroll,
                 ult: !!document.getElementById('baPlUlt') };
      });
      eq('จอ ' + w + ' · การ์ดโจทย์สูงเท่าเดิม', r.hgt, want);
      ok('จอ ' + w + ' · ไม่ล้นแนวนอน', r.noHScroll === true);
      ok('จอ ' + w + ' · ชิปเกจอยู่จริง (position:fixed ไม่กินเลย์เอาต์)', r.ult === true);
      await p.close();
    }
  }

  await browser.close();
  log('\n════════════════════════════════════════');
  log('  ✅ ผ่าน ' + pass + '   ❌ ตก ' + fail);
  log('════════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
