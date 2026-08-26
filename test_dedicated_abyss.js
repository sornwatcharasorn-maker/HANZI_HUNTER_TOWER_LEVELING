/* ชุดเทสต์ Patch v8.3 — DECOUPLED DEDICATED ABYSS ENGINE (1–25) & EXP OVERDRIVE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_dedicated_abyss.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ (v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส)
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F = ชั้น; BA_INC_AT = -1;)
     · สลับการ์ดเป็นใบที่ไม่ยุ่งกับนาฬิกาก่อนวัดหลอดเสมอ (🧘 แช่แข็งทุกข้อโดยชอบธรรม)
     · ค่าถาวรต้องพิสูจน์ด้วย exitGame() แล้วล็อกอินใหม่จริง (กับดักข้อ 16 · 38)
     · วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนเสมอ

   **ตัวเลขของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ** — ถ้าอ่านค่าคงที่ในเกมมาเทียบกับตัวเอง
   เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนตัวเลขไปแล้ว                                        */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'dedicated_abyss_log.txt');

/* ตารางของสเปก — สารบัญชุดที่สองที่จำเป็น */
const SPEC = { max: 25, exp: 8.0, gold: 3.0, gem: 4, gemPf: 2 };
const CARD = { w: 340.8, narrow: 354.8 };

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }

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
      const gt = document.querySelector('#baWvGate.active');
      if (gt && typeof baWvGateGo === 'function') { baWvGateGo(); return 'apex'; }
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
    try { CD_CARD = CD_BY_ID['mana']; CD_BAND = cdBandOf(G.floor); cdPaintUi(); } catch (e) {}
  });
}

async function enterGame(page, id) { await ackRules(page); await login(page, id, 'register'); }

/* ย้ายชั้น + สลับโหมดเหวลึกแบบ "เขียนธงตรง ๆ" — ไม่ผ่านปุ่ม จึงไม่กินกุญแจของ v8.1
   (เทสต์ที่ต้องการพิสูจน์การกินกุญแจใช้ abToggleAbyss จริงในบล็อกของมันเอง) */
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

async function setIdx(page, v) {
  await page.evaluate(n => { const x = baAxMine(); if (x) x.idx = n; }, v);
}

(async () => {
  fs.writeFileSync(LOG, '');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ค่าคงที่ · ทางเข้าสาธารณะ · ไม่เพิ่ม DOM/CSS ════════════════
  {
    head('บล็อก 1 · ค่าคงที่ · ทางเข้าสาธารณะ · ไม่เพิ่มของบนจอ');
    const b = await boot(browser);
    await enterGame(b.page, 'od_a');

    const a = await b.page.evaluate(() => baBattleAudit().dedicated);
    ok('baBattleAudit().dedicated มีอยู่จริง', !!a, a);
    eq('ค่าคงที่ตรงสเปกทุกตัว',
       { max: a.max, exp: a.exp, gold: a.gold, gem: a.gem, gemPf: a.gemPerfect },
       { max: SPEC.max, exp: SPEC.exp, gold: SPEC.gold, gem: SPEC.gem, gemPf: SPEC.gemPf });
    eq('ดัชนีเริ่มต้นคือ 1', a.idx, 1);
    eq('ยังไม่ได้กดเข้าเหวลึก = โหมดปิด', a.on, false);
    eq('สวิตช์เซฟเปิดแล้วหลังเข้าเกม', a.ready, true);

    const dom = await b.page.evaluate(() => ({
      styles: [...document.querySelectorAll('style')].map(s => s.id).filter(x => /baOd/i.test(x)).length,
      nodes: document.querySelectorAll('[id^="baOd"],[class*="ba-od"]').length,
      btns: document.querySelectorAll('.g-actions .g-btn').length
    }));
    eq('ไม่เพิ่ม <style> ของตัวเองสักก้อน', dom.styles, 0);
    eq('ไม่เพิ่มโหนดบนจอสักตัว', dom.nodes, 0);
    eq('แถวปุ่มล่างยังครบ 9 ใบเท่าเดิม (กับดักข้อ 11)', dom.btns, 9);

    const wired = await b.page.evaluate(() => ({
      ax: (baAxMine() || {}).idx, floor: (baAxMine() || {}).floor,
      store: ((loadStore()[CURRENT_USER] || {}).ax || {}).idx
    }));
    eq('ดัชนีอยู่ใน account.ax.idx และถูกเซฟลง store แล้ว',
       { ax: wired.ax, store: wired.store }, { ax: 1, store: 1 });
    eq('จุดเซฟแบบผูกชั้นของ v8.1 ถูกตรึงเป็น 0', wired.floor, 0);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 2 · ทัพเงาที่โผล่ = ลำดับ ax.idx เสมอ ไม่ผูกกับชั้น ══════════════
  {
    head('บล็อก 2 · ทัพเงาที่โผล่ผูกกับดัชนี ไม่ผูกกับชั้น');
    const b = await boot(browser);
    await enterGame(b.page, 'od_b');

    /* ยืนคนละชั้นหกชั้น (รวมชั้นบอสทั้งห้า) ด้วยดัชนีเดียวกัน ต้องได้ตัวเดียวกันทุกชั้น */
    await setIdx(b.page, 7);
    const same = [];
    for (const f of [2, 4, 7, 12, 16, 20]) {
      await goFloor(b.page, f, true);
      same.push(await b.page.evaluate(() => {
        const e = baShNow();
        return { f: G.floor, id: e ? e.id : '', n: e ? e.n : 0, tier: e ? e.tier : '' };
      }));
    }
    ok('ยืนชั้นไหนก็เจอทัพเงาลำดับเดียวกัน (7)',
       same.every(r => r.n === 7 && r.id === same[0].id), same);
    ok('ชั้นบอสไม่ได้บังคับให้เป็น Kamish อีกแล้ว',
       same.filter(r => [4, 12, 16, 20].indexOf(r.f) >= 0).every(r => r.tier === 'mini'), same);

    /* ไล่ดัชนีครบทั้ง 25 ตัวโดยยืนอยู่ชั้นเดียวตลอด */
    const ladder = await b.page.evaluate(max => {
      const out = [];
      for (let i = 1; i <= max; i++) {
        baAxMine().idx = i;
        const e = baShAbyssOf(G);
        out.push({ i: i, n: e ? e.n : 0, tier: e ? e.tier : '' });
      }
      baAxMine().idx = 1;
      return out;
    }, SPEC.max);
    ok('ลำดับ 1-25 ชี้ไปที่ทัพเงาตัวที่ตรงกันทุกตัว',
       ladder.every(r => r.n === r.i), ladder.filter(r => r.n !== r.i));
    ok('ลำดับ 1-20 เป็นมินิบอส · 21-25 เป็น Kamish',
       ladder.every(r => r.tier === (r.i <= 20 ? 'mini' : 'mythic')), ladder);

    const rnd = await b.page.evaluate(() => {
      let n = 0; const _r = Math.random; Math.random = () => { n++; return 0.5; };
      for (let i = 0; i < 30; i++) baShAbyssOf(G);
      Math.random = _r;
      return n;
    });
    eq('ไม่แตะ Math.random สักครั้ง (กับดักข้อ 32)', rnd, 0);

    /* หอคอยปกติ (ไม่ได้กดเหวลึก) ต้องไม่ถูกแตะเลย */
    await goFloor(b.page, 9, false);
    const tower = await b.page.evaluate(() => ({
      sh: !!baShNow(), on: baBattleAudit().dedicated.on, mon: !!G.currentMonster
    }));
    eq('หอคอยปกติยังไม่มีทัพเงามายืนแทนอสูรประจำชั้น',
       { sh: tower.sh, on: tower.on, mon: tower.mon }, { sh: false, on: false, mon: true });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 3 · หัวข้อประกาศ — ไม่มีเลขชั้นในข้อความ ════════════════════════
  {
    head('บล็อก 3 · หัวข้อประกาศตามสเปก');
    const b = await boot(browser);
    await enterGame(b.page, 'od_c');
    await setIdx(b.page, 13);
    await goFloor(b.page, 17, true);

    const ann = await b.page.evaluate(() => {
      const el = document.getElementById('baSkill');
      if (el) el.innerHTML = '';
      BA_SH_M = null;                 /* บังคับให้ประกาศตัวใหม่ */
      baIncSync();
      const t = el ? (el.querySelector('.ba-skill-t') || {}).textContent || '' : '';
      const s = el ? (el.querySelector('.ba-skill-s') || {}).textContent || '' : '';
      return { t: t, s: s, n: baBattleAudit().dedicated.n.ann };
    });
    eq('หัวข้อตรงรูปแบบของสเปกเป๊ะ',
       ann.t, '[ระบบ] 🌌 ทัพเงาเหวลึก ตัวที่ 13 / 25 ปรากฏ!');
    ok('ตัวนับการประกาศเดินจริง', ann.n >= 1, ann);
    ok('ไม่มีคำว่า "ชั้น" หรือเลขชั้นในหัวข้อ',
       ann.t.indexOf('ชั้น') === -1 && ann.t.indexOf('17') === -1, ann);
    ok('บรรทัดรองบอกชื่อทัพเงากับสกิลของมัน', ann.s.length > 4, ann);

    /* หอคอยปกติยังใช้ป้ายเดิมของ v6.6 ทุกตัวอักษร */
    const inc = await b.page.evaluate(() => {
      const b2 = abOf(G); if (b2) b2.abyss = false;
      const el = document.getElementById('baSkill'); if (el) el.innerHTML = '';
      const e = BA_SH_BY_ID['s3'];
      baShAnnounce(e);
      return (el.querySelector('.ba-skill-t') || {}).textContent || '';
    });
    ok('นอกเหวลึกยังเป็นป้าย [MINI BOSS] ของ v6.6 ตามเดิม',
       /MINI BOSS|ABYSS INVADER/.test(inc), inc);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 4 · ชนะ = ไต่ลำดับ + ปลดล็อก Codex + 💎 การันตี ════════════════
  {
    head('บล็อก 4 · ชนะแล้วไต่ลำดับ · Codex · 💎');
    const b = await boot(browser);
    await enterGame(b.page, 'od_d');
    await setIdx(b.page, 4);
    await goFloor(b.page, 6, true);

    const win = await b.page.evaluate(() => {
      const _r = baRand; baRand = () => 99;      /* ปิดดรอปสุ่มของ v8.1 ให้หมด */
      const s0 = abShards(G), soul0 = baAxSoulN();
      G.locked = false;
      BA_AX_MPF_M = G.currentMonster; BA_AX_MPF = true;   /* ไร้ที่ติ */
      onMonsterDefeated();
      baRand = _r;
      const a = baBattleAudit().dedicated;
      return { idx: a.idx, gem: abShards(G) - s0, soul: baAxSoulN() - soul0,
               mask4: !!(baAxMine().soul & (1 << 3)), win: a.n.win,
               store: ((loadStore()[CURRENT_USER] || {}).ax || {}).idx };
    });
    eq('ชนะแล้วดัชนีเดินหน้าหนึ่งขั้น', win.idx, 5);
    eq('ดัชนีใหม่ถูกเซฟลง store ทันที', win.store, 5);
    ok('ปลดล็อก Codex ของตัวที่เพิ่งปราบแบบการันตี',
       win.soul === 1 && win.mask4 === true, win);
    ok('ได้ 💎 อย่างน้อยตามสเปก (การันตี 4 + ไร้ที่ติ 2)',
       win.gem >= SPEC.gem + SPEC.gemPf, win);

    /* ไม่ไร้ที่ติ = ได้แค่ก้อนการันตี */
    const plain = await b.page.evaluate(() => {
      const _r = baRand; baRand = () => 99;
      const s0 = abShards(G);
      G.locked = false;
      BA_AX_MPF_M = G.currentMonster; BA_AX_MPF = false;
      onMonsterDefeated();
      baRand = _r;
      return { gem: abShards(G) - s0, idx: baBattleAudit().dedicated.idx };
    });
    eq('ไม่ไร้ที่ติก็ยังไต่ลำดับ', plain.idx, 6);
    ok('💎 การันตียังได้ครบ', plain.gem >= SPEC.gem, plain);

    const cap = await b.page.evaluate(() => {
      baAxMine().idx = 25;
      const _r = baRand; baRand = () => 99;
      G.locked = false;
      onMonsterDefeated();
      baRand = _r;
      return baBattleAudit().dedicated.idx;
    });
    eq('ลำดับสุดท้ายไม่ไหลเกิน 25', cap, 25);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 5 · แพ้ = คงลำดับเดิม · ไม่จดชั้น · ไม่ย้ายชั้นให้ ══════════════
  {
    head('บล็อก 5 · ตกรอบแล้วลำดับไม่ถูกลดทอน');
    const b = await boot(browser);
    await enterGame(b.page, 'od_e');
    await setIdx(b.page, 11);
    /* **ต้องเลือกชั้นที่ "ตกรอบแล้วชั้นขยับจริง"** — v8.1 ใช้การเทียบชั้นก่อน/หลัง
       เป็นตัวชี้ว่าตกรอบ ชั้น 14 เป็นต้นโซนอยู่แล้ว v4.0 จึงไม่ย้ายไปไหน */
    await goFloor(b.page, 6, true);

    const down = await b.page.evaluate(() => {
      const f0 = G.floor, i0 = baBattleAudit().dedicated.idx;
      G.items.insurance = 0; G.hp = 1;
      onHunterDown();
      const a = baBattleAudit().dedicated;
      return { i0: i0, idx: a.idx, on: a.on, f0: f0, saved: baAxMine().floor,
               store: ((loadStore()[CURRENT_USER] || {}).ax || {}).idx };
    });
    eq('ตกรอบแล้วลำดับคงเดิม ไม่ลดทอน', { was: down.i0, now: down.idx }, { was: 11, now: 11 });
    eq('ลำดับเดิมถูกเซฟลง store', down.store, 11);
    eq('ไม่จดเลขชั้นเป็นจุดเซฟอีกแล้ว', down.saved, 0);
    eq('v8.1 ปิดรันให้ตามเดิม', down.on, false);

    /* ลงรอบใหม่ต้องไม่ลากผู้เล่นย้ายชั้น */
    const resume = await b.page.evaluate(() => {
      G.floor = 3; G.floorProgress = 0; G.locked = true;
      BA_INC_F = 3; BA_INC_AT = -1; BA_INC_M = null;
      baAxMine().keys = 0;
      abToggleAbyss();
      return { floor: G.floor, on: abyssOn(G), idx: baBattleAudit().dedicated.idx };
    });
    eq('ลงรอบใหม่ = ยืนชั้นเดิม ไม่ถูกย้าย และเจอลำดับเดิม',
       resume, { floor: 3, on: true, idx: 11 });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6 · EXP Overdrive x8 · ทอง x3 ══════════════════════════════════
  {
    head('บล็อก 6 · EXP x8 · ทอง x3');
    const b = await boot(browser);
    await enterGame(b.page, 'od_f');
    await goFloor(b.page, 6, true);

    const math = await b.page.evaluate(() => {
      G.level = 20; G.exp = 0; G.gold = 1000;
      const g0 = G.gold, e0 = G.exp;
      baOdPay({ gold: g0 - 100, exp: e0 - 10, lv: G.level });   /* แกล้งว่าเพิ่งได้ทอง 100 · EXP 10 */
      return { gold: G.gold - g0, exp: G.exp - e0, lv: G.level };
    });
    eq('ทองถูกเติมจนครบ x3 (ได้มา 100 → เติมอีก 200)', math.gold, 200);
    eq('EXP ถูกเติมจนครบ x8 (ได้มา 10 → เติมอีก 70)', math.exp, 70);
    eq('ยอดเล็ก ๆ ไม่ดันเลเวลใน 1 ข้อ', math.lv, 20);

    const live = await b.page.evaluate(() => {
      G.hp = G.maxHp; G.locked = false; G.level = 20; G.exp = 0;
      const n0 = baBattleAudit().dedicated.n;
      const g0 = G.gold, e0 = G.exp;
      try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}
      const m = G.currentMonster;
      G.monsterHp = G.monsterMaxHp = 99999;      /* อสูรต้องรอด ไม่งั้นจะไปเข้าทางเคลียร์ชั้น */
      answer(m.answer, null);
      const n1 = baBattleAudit().dedicated.n;
      return { dg: G.gold - g0, de: G.exp - e0, gold: n1.gold - n0.gold, exp: n1.exp - n0.exp };
    });
    ok('ตอบถูกในเหวลึกแล้วตัวคูณทำงานจริงทั้งทองและ EXP',
       live.gold > 0 && live.exp > 0 && live.dg > 0 && live.de > 0, live);

    /* นอกเหวลึกต้องไม่มีการเติมสักบาท */
    const off = await b.page.evaluate(() => {
      const b2 = abOf(G); if (b2) b2.abyss = false;
      G.hp = G.maxHp; G.locked = false;
      const n0 = baBattleAudit().dedicated.n;
      try { clearQuestionTimer(); startQuestionTimer(); } catch (e) {}
      const m = G.currentMonster;
      G.monsterHp = G.monsterMaxHp = 99999;
      answer(m.answer, null);
      const n1 = baBattleAudit().dedicated.n;
      return { gold: n1.gold - n0.gold, exp: n1.exp - n0.exp };
    });
    eq('นอกเหวลึกไม่มีตัวคูณของชั้นนี้เลย', off, { gold: 0, exp: 0 });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 7 · รอดข้ามการล็อกอิน (กับดักข้อ 16 · 38) ══════════════════════
  {
    head('บล็อก 7 · ดัชนีรอดข้ามการล็อกอิน');
    const b = await boot(browser);
    await enterGame(b.page, 'od_g');
    await setIdx(b.page, 18);
    await b.page.evaluate(() => { baOdSave(); saveProgress(); });
    const beforeExit = await b.page.evaluate(() =>
      ((loadStore()['od_g'] || {}).ax || {}).idx);
    eq('เซฟแล้วดัชนีอยู่ใน store', beforeExit, 18);

    await b.page.evaluate(() => { exitGame(); });
    await b.page.waitForTimeout(900);
    const afterExit = await b.page.evaluate(() =>
      ((loadStore()['od_g'] || {}).ax || {}).idx);
    eq('ออกจากเกมแล้ว baAxSave ของ v8.1 ไม่ได้ลบดัชนีทิ้ง', afterExit, 18);

    await b.page.evaluate(() => { if (typeof enterGate === 'function') enterGate(); });
    await b.page.waitForTimeout(700);
    await login(b.page, 'od_g', 'login');
    const back = await b.page.evaluate(() => ({
      idx: baBattleAudit().dedicated.idx,
      store: ((loadStore()['od_g'] || {}).ax || {}).idx,
      foe: (baShAbyssOf(G) || {}).n
    }));
    eq('ล็อกอินใหม่แล้วยังอยู่ที่ลำดับเดิม', { i: back.idx, s: back.store, f: back.foe },
       { i: 18, s: 18, f: 18 });

    /* เล่นต่อแล้ว saveProgress ของทุกข้อต้องไม่กลืนดัชนีทิ้ง */
    const keep = await b.page.evaluate(() => {
      for (let i = 0; i < 5; i++) { saveProgress(); baAxSave(); }
      return ((loadStore()['od_g'] || {}).ax || {}).idx;
    });
    eq('saveProgress/baAxSave ซ้ำ ๆ แล้วดัชนียังอยู่', keep, 18);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 8 · ตัดกติกาที่ผูกกับชั้นของ v8.2 ออกจากเหวลึก ══════════════════
  {
    head('บล็อก 8 · Wave 4 · ประตูกรองชั้น 20 ไม่ทำงานในเหวลึก');
    const b = await boot(browser);
    await enterGame(b.page, 'od_h');

    /* ชั้น 3 = ชั้นก่อนประตูบอส · ตัวสุดท้ายของชั้น = ตำแหน่งรอยแยกของ v8.2 */
    await goFloor(b.page, 3, false);
    const wv = await b.page.evaluate(() => {
      /* ปล่อยให้ v8.2 บังคับลูกเต๋าบุกรุกเองด้วยการล้าง BA_INC_F ให้ทอยใหม่
         (goFloor ของชุดนี้ปิดการบุกรุกไว้ตามกติกาของ CLAUDE.md) */
      G.floorProgress = MONSTERS_PER_FLOOR - 1;
      BA_INC_F = -1; BA_INC_M = null;
      nextMonster(); G.locked = false;
      const off = { w4: baWvW4(), sh: !!baShNow() };
      const b2 = abOf(G); if (b2) b2.abyss = true;
      const on = { w4: baWvW4(), sh: !!baShNow() };
      if (b2) b2.abyss = false;
      return { off: off, on: on };
    });
    ok('หอคอยปกติ: รอยแยก Wave 4 ยังทำงานเหมือนเดิม', wv.off.w4 === true, wv);
    ok('ในเหวลึก: Wave 4 ถูกปิด ไม่ไปดันดัชนีรอยแยกและไม่พองเป็น 75%',
       wv.on.w4 === false && wv.on.sh === true, wv);

    const rift = await b.page.evaluate(() => {
      const b2 = abOf(G); if (b2) b2.abyss = true;
      G.abyss_incursion_idx = 5;
      G.locked = false;
      const _r = baRand; baRand = () => 99;
      onMonsterDefeated();
      baRand = _r;
      const out = G.abyss_incursion_idx;
      if (b2) b2.abyss = false;
      return out;
    });
    eq('ปราบทัพเงาในเหวลึกไม่ดันดัชนีรอยแยกของ v8.2', rift, 5);

    await goFloor(b.page, 20, false);
    const apex = await b.page.evaluate(() => {
      const off = baWvF20();
      const b2 = abOf(G); if (b2) b2.abyss = true;
      const on = baWvF20();
      if (b2) b2.abyss = false;
      return { off: off, on: on };
    });
    eq('ประตูกรองชั้น 20 ทำงานเฉพาะนอกเหวลึก', apex, { off: true, on: false });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 9 · เลย์เอาต์ไม่ขยับ (ข้อจำกัดหลักของ v6.0) ════════════════════
  {
    head('บล็อก 9 · ความสูงการ์ดโจทย์ · ไม่ล้นแนวนอน');
    for (const w of [320, 360, 390, 430]) {
      const b = await boot(browser, w, 844);
      await enterGame(b.page, 'od_i' + w);
      await goFloor(b.page, 6, true);
      const m = await b.page.evaluate(() => {
        /* บังคับคำ/ตัวเลือกให้คงที่ + ล้างบรรทัดผลลัพธ์ก่อนวัดเสมอ */
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        G.currentMonster.choices = ['หนึ่ง', 'สอง', 'สาม', 'สี่'];
        G.currentMonster.answer = 'หนึ่ง';
        renderChoices();
        const card = document.querySelector('.ac-battle');
        return { h: card ? +card.getBoundingClientRect().height.toFixed(1) : 0,
                 over: document.body.scrollWidth - window.innerWidth };
      });
      const want = w <= 320 ? CARD.narrow : CARD.w;
      ok('จอ ' + w + ' · การ์ดโจทย์สูงเท่าเดิม (' + want + ')',
         Math.abs(m.h - want) <= 0.6, m);
      ok('จอ ' + w + ' · ไม่ล้นแนวนอน', m.over <= 0, m);
      ok('จอ ' + w + ' · ไม่มี pageerror', b.errs.length === 0, b.errs);
      await b.ctx.close();
    }
  }

  await browser.close();
  say('\n═══ สรุป ═══');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  process.exit(FAIL ? 1 : 0);
})();
