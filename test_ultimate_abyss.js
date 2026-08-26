/* ชุดเทสต์ Micro-Patch — ULTIMATE ABYSS OVERHAUL & 25-MINIBOSS ENGINE  (เนมสเปซ ba)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_ultimate_abyss.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส)
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F = ชั้น; BA_INC_AT = -1;)
     · สลับการ์ดเป็นใบที่ไม่ยุ่งกับนาฬิกาก่อนวัดหลอดเสมอ (🧘 แช่แข็งทุกข้อโดยชอบธรรม)
     · ค่าถาวรต้องพิสูจน์ด้วย exitGame() แล้วล็อกอินใหม่จริง (กับดักข้อ 16)
     · วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนเสมอ

   **ตัวเลขของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ** — ถ้าอ่านค่าคงที่ในเกมมาเทียบกับตัวเอง
   เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนตัวเลขไปแล้ว                                        */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'ultimate_abyss_log.txt');

/* ตารางของสเปก — สารบัญชุดที่สองที่จำเป็น */
const SPEC = {
  ratio: 0.5, hp: 1.25, bar: 0.35, p2: 0.175, regen: 0.003, siphon: 0.025,
  curMs: 10000, blk: 1000, seal: 2000, trap: 11, ddMs: 14000, ddNeed: 1,
  keys: 5, pot: 50, extBar: 10, extStun: 1000,
  odN: 6, odPct: 20, odMs: 8000, sbN: 12, sbStun: 1500,
  rou: 5, soul: 10, soulN: 25
};

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }
function near(name, got, want, tol) { ok(name, Math.abs(got - want) <= tol, { got: got, want: want, tol: tol }); }

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

async function login(page, id, mode) {
  await page.evaluate(o => {
    switchTab(o.mode);
    if (o.mode === 'register') {
      document.getElementById('reg-id').value = o.id;
      document.getElementById('reg-pw').value = '1111';
      document.getElementById('reg-pw2').value = '1111';
    } else {
      document.getElementById('login-id').value = o.id;
      document.getElementById('login-pw').value = '1111';
    }
    handleSubmit();
  }, { id: id, mode: mode || 'register' });
  await page.waitForTimeout(1400);
  await clearOverlays(page);
  await page.evaluate(() => {
    G.maxFloor = FLOOR_MAX; recalcStats();
    /* 🧘 สมาธิแน่วแน่แช่แข็งทุกข้อโดยชอบธรรม — สลับเป็นใบที่ไม่ยุ่งกับนาฬิกา */
    try { CD_CARD = CD_BY_ID['mana']; CD_BAND = cdBandOf(G.floor); cdPaintUi(); } catch (e) {}
  });
}

async function enterGame(page, id) { await ackRules(page); await login(page, id, 'register'); }

async function goFloor(page, f, abyss) {
  await page.evaluate(o => {
    const b = abOf(G);
    if (b) b.abyss = !!o.abyss;
    G.floor = o.f; G.floorProgress = 0; G.practiceMode = false;
    BA_INC_F = o.f; BA_INC_AT = -1; BA_INC_ID = ''; BA_INC_M = null;
    nextMonster();
    G.locked = false;
  }, { f: f, abyss: !!abyss });
  await page.waitForTimeout(220);
  await clearOverlays(page);
  await page.evaluate(() => { G.locked = false; });
}

async function liveQ(page) {
  const r = await page.evaluate(() => {
    G.locked = false; G.hp = G.maxHp;
    if (typeof BA_BREAK_UNTIL !== 'undefined') BA_BREAK_UNTIL = 0;
    if (typeof BA_ST_UNTIL !== 'undefined') BA_ST_UNTIL = 0;
    try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}
    try { acFocusQa(); acSync(true); } catch (e) {}
    return { f: baFighting(), qt: !!QUESTION_TIMER };
  });
  await page.waitForTimeout(120);
  return r;
}

(async () => {
  fs.writeFileSync(LOG, '');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ค่าคงที่ · ทางเข้าสาธารณะ · ของบนจอ ════════════════════════
  {
    head('บล็อก 1 · ค่าคงที่ · ทางเข้าสาธารณะ · ของบนจอ');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_a');
    const a = await b.page.evaluate(() => baBattleAudit().abyssX);
    ok('baBattleAudit().abyssX มีอยู่จริง', !!a, a && a.ver);
    eq('Master Ratio = 0.5', a.ratio, SPEC.ratio);
    eq('เลือด 1.25x · เกราะ 35%', { hp: a.scale.hp, bar: a.scale.bar }, { hp: SPEC.hp, bar: SPEC.bar });
    eq('เฟส 2 +17.5% · รีเจน 0.3%/วิ · พลาด +2.5%',
       { p2: +a.scale.p2.toFixed(4), rg: +a.scale.regen.toFixed(4), si: +a.scale.siphon.toFixed(4) },
       { p2: SPEC.p2, rg: SPEC.regen, si: SPEC.siphon });
    eq('เกจที่ผ่อนแล้วครบชุด',
       { c: a.gauge.curMs, b: a.gauge.blk, s: a.gauge.seal, t: a.gauge.trap,
         d: a.gauge.ddMs, n: a.gauge.ddNeed },
       { c: SPEC.curMs, b: SPEC.blk, s: SPEC.seal, t: SPEC.trap, d: SPEC.ddMs, n: SPEC.ddNeed });
    eq('กุญแจวันละ 5 ดอก · ยังไม่ได้ใช้', { m: a.keys.max, l: a.keys.left }, { m: SPEC.keys, l: SPEC.keys });
    eq('ค่าของแปดเสาตรงสเปก',
       { eb: a.pillar.extBar, es: a.pillar.extStun, on: a.pillar.odN, op: a.pillar.odPct,
         om: a.pillar.odMs, sb: a.pillar.sbN, ro: a.pillar.rou, so: a.soul.pct, sn: a.soul.max },
       { eb: SPEC.extBar, es: SPEC.extStun, on: SPEC.odN, op: SPEC.odPct, om: SPEC.odMs,
         sb: SPEC.sbN, ro: SPEC.rou, so: SPEC.soul, sn: SPEC.soulN });
    ok('ฉายา 👑 ผู้คุมวิญญาณเหวลึก ถูกลงทะเบียนแล้ว', a.soul.listed === true, a.soul);
    ok('สไตล์กับชิปบัฟถูกติดตั้งลงสนามแล้ว', a.dom.styled === true && a.dom.hud === true, a.dom);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 2 · 50% Master Ratio (เทียบกับบอสหอคอยชั้นเดียวกัน) ═════════════
  {
    head('บล็อก 2 · 50% Master Ratio');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_b');

    await goFloor(b.page, 4, false);
    const tower = await b.page.evaluate(() => ({
      boss: baRsBossFight(G), body: AB_SEAL ? AB_SEAL.base : 0,
      bar: BA_BAR ? +(BA_BAR.max / BA_BAR.base).toFixed(3) : 0,
      regen: baRsAmt(BA_RS_REGEN), mhp: BA_RS ? BA_RS.mhp : 0
    }));
    await goFloor(b.page, 4, true);
    const abyss = await b.page.evaluate(() => ({
      foe: (baShNow() || {}).tier, boss: baRsBossFight(G),
      body: AB_SEAL ? AB_SEAL.base : 0,
      bar: BA_BAR ? +(BA_BAR.max / BA_BAR.base).toFixed(3) : 0,
      regen: baRsAmt(BA_RS_REGEN), mhp: BA_RS ? BA_RS.mhp : 0,
      want: Math.max(1, Math.round((BA_RS ? BA_RS.mhp : 0) * BA_RS_REGEN * BA_AX_R))
    }));
    ok('ชั้นบอสในเหวลึกได้ Kamish และเป็นไฟต์บอส', abyss.foe === 'mythic' && abyss.boss === true, abyss);
    near('เนื้อบอสของทัพเงา = ครึ่งหนึ่งของบอสหอคอยชั้นเดียวกัน',
         abyss.body / (tower.body || 1), SPEC.ratio, 0.02);
    near('เกราะบอสหอคอย = 70%', tower.bar, 0.70, 0.01);
    near('เกราะทัพเงา = 35%', abyss.bar, SPEC.bar, 0.01);
    eq('รีเจนของทัพเงา = ครึ่งหนึ่งของสูตรเดิม', abyss.regen, abyss.want);
    ok('รีเจนของบอสหอคอยไม่ถูกแตะ',
       tower.regen === Math.max(1, Math.round(tower.mhp * 0.006)), tower);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 3 · 25-Miniboss Engine ════════════════════════════════════════
  {
    head('บล็อก 3 · 25-Miniboss Engine');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_c');
    /* ชั้น 7 เป็นอีลีทของ v6.4 ซึ่งมีเกราะอยู่แล้ว — ใช้ชั้น 6 ที่เป็นชั้นธรรมดาแท้ */
    await goFloor(b.page, 6, false);
    const plain = await b.page.evaluate(() => ({ boss: baRsBossFight(G), cur: baCurOn(), ht: baHtBoss(),
                                                 bar: BA_BAR ? BA_BAR.max : 0 }));
    await goFloor(b.page, 7, true);
    const mini = await b.page.evaluate(() => ({ tier: (baShNow() || {}).tier, boss: baRsBossFight(G),
                                                cur: baCurOn(), ht: baHtBoss(),
                                                bar: BA_BAR ? BA_BAR.max : 0 }));
    eq('ชั้นธรรมดาในหอคอยปกติยังไม่ใช่ไฟต์บอส',
       { b: plain.boss, c: plain.cur, h: plain.ht }, { b: false, c: false, h: false });
    ok('ชั้นธรรมดาในเหวลึกได้มินิบอส และเครื่องยนต์บอสทั้งสามเปิดครบ',
       mini.tier === 'mini' && mini.boss === true && mini.cur === true && mini.ht === true, mini);
    ok('มินิบอสมีเกราะจริง (ชั้นธรรมดาไม่มี)', mini.bar > 0 && plain.bar === 0, { mini: mini.bar, plain: plain.bar });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 4 · Softened Gauges ═══════════════════════════════════════════
  {
    head('บล็อก 4 · Softened Gauges');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_d');

    await goFloor(b.page, 4, false);
    const tw = await b.page.evaluate(() => ({ blk: baDbBlkMs(9999) }));
    await goFloor(b.page, 4, true);
    const q = await liveQ(b.page);
    ok('มีนาฬิกาต่อข้อเดินอยู่จริงก่อนวัดหลอด', q.qt === true, q);

    const g = await b.page.evaluate(() => {
      const out = { blk: baDbBlkMs(9999) };
      /* ผนึกความเงียบงัน — ยึดเวลามาคุมเองที่ BA_DB_SEAL_END */
      baDbClear(false); BA_GP_UNTIL = 0;
      const t0 = Date.now(); baStone(BA_DB_SEAL_MS);
      out.seal = Math.round((BA_DB_SEAL_END - t0) / 100) * 100;
      baDbClear(false);
      /* หลอดคำสาป — ป้อนส่วนต่าง 1.0 วิ แล้วดูว่าเกจขยับกี่ % */
      BA_CUR = 0; BA_CUR_LAST = Date.now() - 1000; baCurTick();
      out.cur = Math.round(BA_CUR);
      out.fight = baFighting();
      /* Doomsday */
      BA_DD_LEFT = 0; BA_DD_NEXT = 0; G.monsterHp = Math.round(G.monsterMaxHp * 0.1);
      out.dd = baDdStart();
      out.ddLeft = BA_DD_LEFT; out.ddHits = BA_DD_HITS; out.ddNeed = BA_DD_NEED;
      baDdClear();
      return out;
    });
    eq('จอดำ — บอสหอคอย 2.0 วิ · ทัพเงา 1.0 วิ', { t: tw.blk, a: g.blk }, { t: 2000, a: SPEC.blk });
    eq('ผนึกความเงียบงันเหลือ 2.0 วิ', g.seal, SPEC.seal);
    ok('หลอดคำสาปเต็มที่ 10.0 วิ (1 วิ = 10%)', g.fight === true && Math.abs(g.cur - 10) <= 1, g);
    ok('Doomsday 14.0 วิ และเหลือต้องตอบถูกอีกข้อเดียว',
       g.dd === true && g.ddLeft === SPEC.ddMs && (g.ddNeed - g.ddHits) === SPEC.ddNeed, g);

    /* อัตรากับดัก — ทอยจริง 400 รอบด้วย baRand ของเกม (ห้ามแตะ Math.random) */
    const trap = await b.page.evaluate(() => {
      let n = 0, mr = 0;
      const _mr = Math.random; Math.random = function () { mr++; return _mr(); };
      for (let i = 0; i < 400; i++) { if (baTrapRoll()) n++; baTrapClear(); }
      Math.random = _mr;
      return { pct: n / 4, mr: mr };
    });
    near('กับดักโจทย์ราว 11% ต่อข้อ', trap.pct, SPEC.trap, 5);
    eq('ตัวทอยกับดักไม่แตะ Math.random สักครั้ง', trap.mr, 0);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 5 · กุญแจรายวัน · จุดเซฟ · ข้ามการล็อกอิน ══════════════════════
  {
    head('บล็อก 5 · กุญแจรายวัน · จุดเซฟ · ข้ามการล็อกอิน');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_e');
    await goFloor(b.page, 9, false);

    const k1 = await b.page.evaluate(() => {
      abToggleAbyss();
      return { on: abyssOn(G), left: baAxKeysLeft(), run: baBattleAudit().abyssX.run };
    });
    eq('เปิดเหวลึกครั้งแรก = กินกุญแจหนึ่งดอก และรันเริ่มแล้ว',
       k1, { on: true, left: SPEC.keys - 1, run: true });

    const k2 = await b.page.evaluate(() => {
      for (let i = 0; i < 12; i++) {
        if (abyssOn(G)) abToggleAbyss(); else abToggleAbyss();
      }
      return { on: abyssOn(G), left: baAxKeysLeft() };
    });
    eq('กุญแจหมดแล้วเปิดไม่ได้อีก', k2, { on: false, left: 0 });

    const cp = await b.page.evaluate(() => {
      const x = baAxMine();
      x.keys = 0;                       /* คืนกุญแจให้ทดสอบจุดเซฟต่อ */
      G.floor = 12; G.floorProgress = 0;
      BA_INC_F = 12; BA_INC_AT = -1; BA_INC_M = null;
      abToggleAbyss();
      const before = G.floor;
      G.items.insurance = 0; G.hp = 1;
      onHunterDown();
      return { before: before, saved: baAxMine().floor, on: abyssOn(G), floor: G.floor };
    });
    ok('ตกรอบในเหวลึก = จดจุดเซฟไว้ที่ชั้นเดิม แล้วปิดรันให้',
       cp.saved === cp.before && cp.on === false, cp);

    await b.page.evaluate(() => { saveProgress(); exitGame(); });
    await b.page.waitForTimeout(900);
    await b.page.evaluate(() => { if (typeof enterGate === 'function') enterGate(); });
    await b.page.waitForTimeout(700);
    await login(b.page, 'ax_e', 'login');
    const back = await b.page.evaluate(() => {
      const a = baBattleAudit().abyssX;
      return { floor: a.save.floor, keys: a.keys.used, ready: a.save.ready };
    });
    eq('จุดเซฟกับกุญแจรอดข้ามการล็อกอิน', { f: back.floor, r: back.ready }, { f: 12, r: true });

    const resume = await b.page.evaluate(() => {
      G.floor = 1; G.floorProgress = 0; G.locked = true;   /* ล็อกเทิร์นไว้ = ห้ามกระโดดข้อทันที */
      BA_INC_F = 1; BA_INC_AT = -1; BA_INC_M = null;
      baAxMine().keys = 0;
      abToggleAbyss();
      return { floor: G.floor, on: abyssOn(G) };
    });
    eq('ลงรอบใหม่ = กลับไปยืนที่จุดเซฟทันที', resume, { floor: 12, on: true });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6 · แปดเสา — จิตเงา · สภาวะคลั่ง · บัญชาจักรพรรดิ · ชิปบัฟ ═════
  {
    head('บล็อก 6 · แปดเสาของ Spectacle & Educational Buff');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_f');
    await goFloor(b.page, 8, true);
    await liveQ(b.page);

    const ext = await b.page.evaluate(() => {
      /* ตั้งสภาพ "กำลังสู้อยู่จริง" ในทิกเดียวกับที่วัด — ระหว่างสองทิก v6.5 ฟาดได้
         และ v4.8.1 หยุดเกมได้จากตำแหน่งเลื่อนจอ แล้ว baFighting() จะเป็นเท็จโดยชอบธรรม */
      G.locked = false; G.hp = G.maxHp;
      BA_ST_UNTIL = 0; BA_BREAK_UNTIL = 0;
      try { clearQuestionTimer(); startQuestionTimer(); acFocusQa(); acSync(true); } catch (e) {}
      BA_AX_EXT = 1;
      BA_BREAK_UNTIL = 0;
      const max = BA_BAR ? BA_BAR.max : 0, b0 = baBarLeft(), hp0 = G.monsterHp;
      const done = baAxExtract();
      return { done: done, fight: baFighting(), max: max, cut: b0 - baBarLeft(), want: Math.round(max * 0.10),
               stun: BA_BREAK_UNTIL > Date.now(), left: BA_AX_EXT, alive: G.monsterHp > 0,
               dmg: hp0 - G.monsterHp };
    });
    ok('🗡️ จิตเงาโจมตีเจาะเกราะ 10% และทำให้ชะงัก',
       ext.done === true && Math.abs(ext.cut - ext.want) <= 1 && ext.stun === true && ext.alive, ext);
    eq('🗡️ ใช้ได้ครั้งเดียวต่อรัน', ext.left, 0);
    const ext2 = await b.page.evaluate(() => baAxExtract());
    eq('🗡️ กดซ้ำในรันเดิมไม่ทำงาน', ext2, false);

    const od = await b.page.evaluate(() => {
      BA_LIVE = true; const a0 = hunterAtk();
      BA_AX_OD = Date.now() + 5000; const a1 = hunterAtk();
      BA_AX_OD = 0; BA_LIVE = false;
      const a2 = hunterAtk();
      BA_AX_OD = Date.now() + 5000; const a3 = hunterAtk();
      BA_AX_OD = 0;
      return { live: +(a1 / a0).toFixed(2), idle: +(a3 / a2).toFixed(2) };
    });
    eq('⚡ สภาวะคลั่ง +20% เฉพาะระหว่างตัดสินข้อ', od, { live: 1.2, idle: 1 });

    const sb = await b.page.evaluate(() => {
      BA_BREAK_UNTIL = 0;
      G.monsterHp = G.monsterMaxHp;
      const b0 = baBarLeft();
      BA_AX_SG = 12;
      baAxBurst();
      return { b0: b0, left: baBarLeft(), sg: BA_AX_SG,
               stun: BA_BREAK_UNTIL - Date.now(), alive: G.monsterHp > 0 };
    });
    ok('👑 บัญชาจักรพรรดิทำลายเกราะ 100% · ชะงัก 1.5 วิ · ไม่ฆ่าอสูร',
       sb.b0 > 0 && sb.left === 0 && sb.sg === 0 && sb.alive === true &&
       sb.stun >= SPEC.sbStun, sb);   /* Armor Break ของ v6.4 ยาวกว่า → Math.max เก็บใบยาวไว้ */

    const hud = await b.page.evaluate(() => {
      BA_AX_EXT = 1; BA_AX_PF = 3; BA_AX_SG = 4; BA_AX_OD = Date.now() + 4000;
      baAxHud(true);
      const el = document.getElementById('baAxHud');
      const chips = [...el.querySelectorAll('i')];
      return { on: el.classList.contains('on'), n: chips.length,
               tips: chips.every(c => (c.getAttribute('title') || '').length > 10),
               ext: !!el.querySelector('[data-ax="ext"]'),
               grow: el.getBoundingClientRect().height };
    });
    ok('ชิปบัฟโผล่ครบพร้อมคำอธิบายทุกใบ', hud.on && hud.n >= 3 && hud.tips === true && hud.ext, hud);

    const p2 = await b.page.evaluate(() => {
      BA_RS.p2 = false;
      G.monsterHp = Math.round(G.monsterMaxHp * 0.4);
      baRsPhase2();
      const gs = document.getElementById('gameScreen');
      const sk = document.getElementById('baSkill');
      return { rage: gs.classList.contains('ba-ax-rage'), p2: BA_RS.p2,
               txt: sk ? sk.textContent : '' };
    });
    ok('🩸 Boss Evolution — ออร่าแดงเข้ม + ประกาศตอนแตะครึ่งหลอด',
       p2.p2 === true && p2.rage === true && /บอสคลั่ง/.test(p2.txt), p2);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 7 · รางวัล · การ์ดวิญญาณ · ฉายา ════════════════════════════════
  {
    head('บล็อก 7 · รางวัล · การ์ดวิญญาณ · ฉายา');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_g');
    await goFloor(b.page, 7, true);

    const loot = await b.page.evaluate(() => {
      const _r = baRand; baRand = () => 0;      /* บังคับให้ดรอปทุกอย่างติด */
      const foe = baShNow();
      const pot0 = G.items.potion || 0, s0 = abShards(G);
      G.locked = false;
      BA_AX_MPF_M = G.currentMonster; BA_AX_MPF = true;
      onMonsterDefeated();
      baRand = _r;
      const a = baBattleAudit().abyssX;
      return { n: foe ? foe.n : 0, pot: (G.items.potion || 0) - pot0,
               gem: abShards(G) - s0, soul: a.soul.n, mask: a.soul.mask };
    });
    ok('ล้มทัพเงาแล้วได้ยา · 💎 · การ์ดวิญญาณครบ',
       loot.pot >= 1 && loot.gem > 0 && loot.soul === 1 &&
       loot.mask === (1 << (loot.n - 1)), loot);

    const title = await b.page.evaluate(() => {
      baAxMine().soul = (1 << 25) - 1;
      checkTitles(G);
      const t = TITLES.filter(x => x.key === BA_AX_TKEY)[0];
      return { n: baAxSoulN(), unlocked: !!(t && t.check(G)),
               owned: (G.titles || []).indexOf(BA_AX_TKEY) !== -1,
               other: !!(t && t.check({ user: 'x' })) };
    });
    ok('สะสมครบ 25 ใบ = ปลดล็อกฉายา 👑 ผู้คุมวิญญาณเหวลึก',
       title.n === SPEC.soulN && title.unlocked === true && title.owned === true, title);
    eq('check ไม่แจกฉายาให้บัญชีที่ไม่มีคลังวิญญาณ', title.other, false);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 8 · แท็บ 🕳️ ABYSS — แยกขาดจากกระดานผู้นำสามใบเดิม ═══════════════
  {
    head('บล็อก 8 · แท็บ Abyss Speedrun');
    const b = await boot(browser);
    await enterGame(b.page, 'ax_h');
    const tab = await b.page.evaluate(() => {
      const x = baAxMine();
      x.best = 95000; x.clears = 1; x.soul = 7;
      openBoard();
      const t0 = [...document.querySelectorAll('#gBoardTabs .g-lb-tab')];
      setBoardMode('abyss');
      const t1 = [...document.querySelectorAll('#gBoardTabs .g-lb-tab')];
      const body = document.getElementById('gBoardBody').textContent;
      const on = document.querySelector('.ba-ax-tab.on');
      setBoardMode('floor');
      const back = document.getElementById('gBoardBody').textContent;
      closeBoard();
      return { modes: LB_MODES.length, tabs0: t0.length, tabs1: t1.length,
               on: !!on, body: body, back: back };
    });
    eq('LB_MODES ของ v4.2 ยังเป็นสามใบเท่าเดิม', tab.modes, 3);
    eq('แท็บบนกระดานกลายเป็นสี่ใบ (สามเดิม + Abyss)', { a: tab.tabs0, b: tab.tabs1 }, { a: 4, b: 4 });
    ok('เลือกแท็บ Abyss แล้วขึ้นโพเดียมของตัวเอง',
       tab.on === true && /1:35/.test(tab.body) && /วิญญาณ 3\/25/.test(tab.body), tab);
    ok('สลับกลับไปกระดานเดิมแล้วเนื้อหาเป็นของ v4.2 ตามเดิม',
       /ชั้น/.test(tab.back) && !/วิญญาณ/.test(tab.back), tab.back.slice(0, 90));
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 9 · เลย์เอาต์ — ความสูงการ์ดโจทย์ห้ามขยับ ══════════════════════
  {
    head('บล็อก 9 · เลย์เอาต์');
    for (const w of [320, 390, 430]) {
      const b = await boot(browser, w, 844);
      await enterGame(b.page, 'ax_l' + w);
      await goFloor(b.page, 7, true);
      const m = await b.page.evaluate(() => {
        /* บังคับคำ/ตัวเลือกให้คงที่ + ล้างบรรทัดผลลัพธ์ก่อนวัดเสมอ */
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        const fb = document.getElementById('gFeedback');
        if (fb) fb.textContent = '';
        G.currentMonster.choices = ['หนึ่ง', 'สอง', 'สาม', 'สี่'];
        renderChoices();
        const card = document.querySelector('.ac-battle');
        return { h: card ? +card.getBoundingClientRect().height.toFixed(1) : 0,
                 sw: document.body.scrollWidth, iw: window.innerWidth };
      });
      const want = w === 320 ? 354.8 : 340.8;
      near('จอ ' + w + ' — การ์ดโจทย์สูงเท่าเดิม', m.h, want, 0.6);
      ok('จอ ' + w + ' — ไม่ล้นแนวนอน', m.sw <= m.iw, m);
      ok('จอ ' + w + ' — ไม่มี pageerror', b.errs.length === 0, b.errs);
      await b.ctx.close();
    }
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('═══════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
