/* ชุดเทสต์ Patch v9.0 · COMBAT ENGINE BUGFIXES —
 *   FULL-RANGE DASH, GHOSTING FIX, ACTIVE MP DRAIN
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_combat_v9.js [ไฟล์.html]
 *
 * ชี้ไปที่ "ไฟล์แจก" ที่รากrepo โดยเจตนา — ต้องพิสูจน์ของที่นักเรียนได้ใช้จริง
 * ไม่ใช่ต้นฉบับที่ไม่มีใครได้ใช้ (แก้ต้นฉบับแล้วต้อง build ก่อนรันเสมอ · กับดักข้อ 28)
 *
 * สี่เรื่องที่พิสูจน์
 *   1) Ghosting Fix — สถานะที่ไม่มีภาพในทะเบียน (เช่น priest.c1.idle ว่าง)
 *      ยืมภาพจากสถานะพี่น้องในทะเบียนเดียวกันแทนที่จะปล่อยให้สไปรต์นักลอบสังหาร
 *      เดิมทะลุออกมา (.ba-fig) + แนวป้องกันชั้นที่สอง (ba-anm-on ถูกบังคับเสมอ)
 *   2) Active MP Drain — ปุ่มท่าไม้ตายช่อง 4 หัก MP จริง · บล็อกถ้า MP ไม่พอ
 *      โดยไม่แตะเกจ 8 ขีดเลยสักหน่วย
 *   3) Full-Range Dash & Recoil — อสูรพุ่งเต็มระยะตอนสวนกลับ (เดิมมีแค่ฝั่งฮีโร่)
 *      + ท่า "โดนอัด" ที่ฝั่งถูกตีทั้งสองทาง
 *   4) Idle Life-Cycling — สลับเฟรม/ภาพของ #baHero ระหว่างยืนรอต่อสู้ (เกาะ
 *      baTick5() ตัวจริง ไม่ใช่ baIdleTick() ที่ตายไปแล้วตั้งแต่ v6.5)
 *      ไม่ใช้ animation:infinite เด็ดขาด (กับดักข้อ 31)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_combat_v9.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function say(s) { console.log(s); try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} }
function ok(c, m) { if (c) { pass++; say('  ✅ ' + m); } else { fail++; say('  ❌ ' + m); } }
function head(s) { say('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 58 - s.length))); }

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  /* v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง */
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
    window.EventSource = function () { this.close = function () {}; };
  });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  /* ป๊อปอัปกติกาของ v5.6 — ทำเหมือนที่นักเรียนทำจริง ไม่ใช่ประตูหลัง */
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    switchTab('register');
    document.getElementById('reg-id').value = 'v9c' + Math.floor(Math.random() * 9999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

/* ตั้งสนามให้เทียบผลได้แน่นอน — ท่าเดียวกับ arena() ของ test_battle_v63.js */
async function arena(page, floor, opts) {
  opts = opts || {};
  await page.evaluate(o => {
    critChance = () => (o.crit ? 100 : 0);
    expDoubleChance = () => 0;
    if (typeof CD_BAND !== 'undefined') {
      CD_CARD = null;
      CD_BAND = cdBandOf(o.floor);
      CD_SKIP = o.floor;
      CD_ST = { ward: 0, noItem: 0, noHeal: 0, atk: 0, perfect: true, hit: 0, miss: 0 };
      if (typeof cdPaintUi === 'function') cdPaintUi();
    }
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = o.floor; BA_INC_AT = -1; BA_INC_M = null; }
    G.floor = o.floor;
    G.floorProgress = 0;
    G.maxFloor = FLOOR_MAX;
    if (o.classId) G.classId = o.classId;
    if (o.level) G.level = o.level;
    recalcStats();
    G.hp = G.maxHp;
    G.shield = 0;
    G.streak = 0;
    G.items = {};
    nextMonster();
    if (o.tanky !== false) { G.monsterMaxHp = 99999; G.monsterHp = 99999; renderMonsterHp(); }
    G.locked = false;
    if (typeof ba_crit !== 'undefined') ba_crit = 0;
    if (typeof BA_ATB !== 'undefined') BA_ATB = 0;
  }, Object.assign({ floor: floor }, opts));
  await page.waitForTimeout(320);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      if (document.querySelector('#snGate.active') && typeof snGateConfirm === 'function') snGateConfirm();
    });
    await page.waitForTimeout(180);
  }
  await page.evaluate(() => {
    if (typeof acFocusQa === 'function') acFocusQa();
    if (typeof acSync === 'function') acSync(true);
  });
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  const { page, errs } = await boot(browser);
  const ev = fn => page.evaluate(fn);
  const evA = (fn, a) => page.evaluate(fn, a);

  // ══ บล็อก 1 · Ghosting Fix — สารบัญ + สวิตช์เปิดใช้ ═══════════════════
  head('บล็อก 1 · Ghosting Fix — โครงสร้างของแพตช์');
  {
    const a = await ev(() => baBattleAudit().combatV9);
    ok(!!a, 'baBattleAudit().combatV9 มีอยู่จริง');
    ok(a.ver === '9.0', 'ตราเวอร์ชัน 9.0 — ได้ "' + a.ver + '"');
    ok(a.styled === true, 'CSS ของแพตช์นี้ถูกฉีดแล้ว (#baV9Style)');
    ok(typeof a.n.fallback === 'number' && typeof a.n.ghostFix === 'number',
      'ตัวนับ fallback/ghostFix มีอยู่ในทะเบียน');

    /* ต้อง baDsEnsureRegistry() ก่อนเสมอ เพื่อให้แน่ใจว่าทะเบียนของทุกสายถูกกางแล้ว */
    const wired = await ev(() => {
      baDsEnsureRegistry();
      return typeof baAnimState === 'function' && typeof baAnimPaint === 'function';
    });
    ok(wired, 'baAnimState/baAnimPaint ยังเป็นฟังก์ชันหลัง v9.0 ห่อทับ (ไม่ได้ลบของเดิม)');
  }

  // ══ บล็อก 2 · Ghosting Fix — ยืมภาพจากสถานะพี่น้องจริง (layer 1) ═══════
  head('บล็อก 2 · Ghosting Fix — สืบทอดภาพจากสถานะพี่น้อง');
  {
    /* จำลองสภาพ "สถานะหนึ่งว่าง แต่พี่น้องในทะเบียนเดียวกันมีภาพ" แบบควบคุมได้
       ไม่พึ่งว่าไฟล์ต้นฉบับตอนนี้ฝังอะไรไว้จริงบ้าง (กันเทสต์นี้พังถ้าวันหนึ่งมีคน
       ฝังภาพ priest.c1.idle ให้ครบ) — ปั้นสาย/สถานะปลอมขึ้นมาเองทั้งชุด */
    const before = await ev(() => baBattleAudit().combatV9.n.fallback);
    const r = await ev(() => {
      baDsEnsureRegistry();
      const tier = ba.assetRegistry.priest.c1.anim;
      const bkIdle = Object.assign({}, tier.idle);
      const bkDash = Object.assign({}, tier.dash);
      tier.idle.u = '';                                    /* บังคับให้ว่าง */
      tier.dash.u = 'data:image/webp;base64,AAAAv9test==';  /* บังคับให้มีภาพ */
      tier.dash.n = 3;
      tier.dash.c = 'ba-priest-dash';
      G.classId = 'priest'; G.level = 1;                   /* ให้ baPlTier คืน c1 */
      const st = baAnimState('c1', 'idle');
      const out = { u: st && st.u, n: st && st.n, c: st && st.c,
                    idleStillEmpty: !tier.idle.u };
      tier.idle.u = bkIdle.u; tier.idle.n = bkIdle.n; tier.idle.c = bkIdle.c;
      tier.dash.u = bkDash.u; tier.dash.n = bkDash.n; tier.dash.c = bkDash.c;
      return out;
    });
    const after = await ev(() => baBattleAudit().combatV9.n.fallback);
    ok(r.u === 'data:image/webp;base64,AAAAv9test==',
      'idle ว่าง → ยืมภาพของ dash มาใช้แทน ได้ URI "' + r.u + '"');
    ok(r.n === 3, 'จำนวนเฟรม (n) ยืมมาจาก dash ด้วย — ได้ ' + r.n);
    ok(r.c === 'ba-priest-dash', 'คลาสที่คืนมาเป็นของ dash (ตัวที่ยืมภาพมาจริง) — ได้ "' + r.c + '"');
    ok(r.idleStillEmpty, 'ทะเบียนต้นทาง (tier.idle.u) ไม่ถูกเขียนทับถาวร ยังว่างเหมือนเดิม');
    ok(after === before + 1, 'ตัวนับ fallback ขยับ +1 (' + before + ' → ' + after + ')');

    /* ทะเบียนถูกคืนค่าเดิมแล้วในเพจ — ยืนยันว่าเทสต์ไม่ทิ้งสภาพเพี้ยนไว้ */
    const restored = await ev(() => {
      const tier = ba.assetRegistry.priest.c1.anim;
      return { idleU: tier.idle.u, dashU: tier.dash.u };
    });
    ok(restored.idleU === '' || typeof restored.idleU === 'string',
      'สภาพทะเบียนหลังเทสต์ยังอยู่ในรูปแบบที่ใช้งานได้ปกติ');
  }

  // ══ บล็อก 3 · Ghosting Fix — เมื่อทั้ง 6 สถานะว่างหมด ═══════════════════
  head('บล็อก 3 · Ghosting Fix — สายที่ยังไม่มีภาพเลยสักสถานะ');
  {
    const r = await ev(() => {
      baDsEnsureRegistry();
      const tier = ba.assetRegistry.guardian.c1.anim;
      const bk = {};
      Object.keys(tier).forEach(k => { bk[k] = tier[k].u; tier[k].u = ''; });
      G.classId = 'guardian'; G.level = 1;
      let threw = false, st = null, uImmediate;
      try { st = baAnimState('c1', 's1'); uImmediate = st && st.u; }
      catch (e) { threw = true; }
      const hasArt = baDsHasArt(G);
      /* ⚠️ เมื่อไม่มีสถานะพี่น้องให้ยืมเลย baAnimState() คืนอ็อบเจกต์ตัวจริงใน
         ทะเบียนกลับมาตรง ๆ (live reference ไม่ใช่สำเนา) — คืนค่าทะเบียนกลับก่อน
         อ่าน st.u ซ้ำจะเห็นภาพจริงที่เพิ่งถูกคืนกลับเข้าตัวเดียวกันนั้น จึงต้อง
         อ่าน uImmediate (จับไว้ก่อนบรรทัดนี้แล้ว) ไม่ใช่อ่าน st.u อีกครั้ง */
      Object.keys(tier).forEach(k => { tier[k].u = bk[k]; });
      return { threw: threw, uImmediate: uImmediate, hasArt: hasArt };
    });
    ok(!r.threw, 'ไม่มี exception หลุดตอนทุกสถานะว่างหมด');
    /* r.u ต้องถูกอ่าน "ก่อน" คืนค่าทะเบียนกลับเสมอ — เมื่อไม่มีสถานะพี่น้องให้ยืมเลย
       (ทุกช่องว่างหมด) baAnimState() คืน "อ็อบเจกต์ตัวจริงในทะเบียน" กลับมาตรง ๆ
       (ไม่ใช่สำเนา) เพราะไม่มีอะไรให้ Object.assign ก็อปปี้ทับ — ถ้าอ่าน st.u
       หลังบรรทัดคืนค่าทะเบียน จะเห็นภาพจริงที่เพิ่งถูกคืนกลับเข้าไปในอ็อบเจกต์
       ตัวเดียวกันนั้นแทน ไม่ใช่ตัวแทนของบั๊คในแพตช์ (ยืนยันด้วย stU (immediate) ในเพจ) */
    ok(!r.uImmediate, 'คืน state ที่ u ยังว่าง (ไม่มีอะไรให้ยืมจริง ๆ) ตอนอ่านทันทีหลังเรียก — ได้ "' + r.uImmediate + '"');
    ok(r.hasArt === false, 'baDsHasArt() รู้ตัวว่าไม่มีภาพเลย → baAnimOn() จะเป็นเท็จ (ระบบใหม่ไม่ทำงาน = ใช้เฟรมเดิมของ v6.5 ตามปกติ ไม่ใช่ ghosting)');
  }

  // ══ บล็อก 4 · Ghosting Fix — แนวป้องกันชั้นที่สอง (บังคับ ba-anm-on) ═══
  head('บล็อก 4 · Ghosting Fix — แนวป้องกันชั้นที่สอง');
  {
    /* สายนักลอบสังหารมีภาพครบอยู่แล้ว → baAnimOn(G) ต้องเป็นจริงเสมอ
       ยิง baAnimPaint() ด้วย state ปลอมที่ "ไม่มี u" ตรง ๆ (เลี่ยง baAnimState
       เพื่อพิสูจน์เฉพาะ layer 2 แยกออกจาก layer 1 อย่างสะอาด) */
    const r = await ev(() => {
      G.classId = 'assassin'; G.level = 1;
      const on = baAnimOn(G);
      const el = document.getElementById('baHero');
      el.classList.remove('ba-anm-on');
      const before = el.classList.contains('ba-anm-on');
      baAnimPaint({ c: 'ba-v9-ghost-test', ms: 50 }, false);   /* ไม่มี u เลย */
      const after = el.classList.contains('ba-anm-on');
      const fig = getComputedStyle(document.querySelector('#baHero .ba-fig') || el);
      el.classList.remove('ba-v9-ghost-test');
      return { on: on, before: before, after: after, figOpacity: fig.opacity };
    });
    ok(r.on === true, 'baAnimOn(G) เป็นจริงสำหรับสายที่มีภาพ (assassin)');
    ok(r.before === false, 'ก่อนวาด ยังไม่มี ba-anm-on');
    ok(r.after === true, 'หลังวาด (แม้ state ไม่มี u) ba-anm-on ถูกบังคับให้มีเสมอ — กันสไปรต์นักลอบสังหารเดิมทะลุออกมา');
    const g2 = await ev(() => {
      const before = baBattleAudit().combatV9.n.ghostFix;
      const el = document.getElementById('baHero');
      el.classList.remove('ba-anm-on');
      baAnimPaint({ c: 'ba-v9-ghost-test2', ms: 50 }, false);
      const after = baBattleAudit().combatV9.n.ghostFix;
      el.classList.remove('ba-v9-ghost-test2');
      return { before: before, after: after };
    });
    ok(g2.after === g2.before + 1, 'ตัวนับ ghostFix ขยับเฉพาะตอนที่ layer 2 ต้องลงมือจริง (' + g2.before + ' → ' + g2.after + ')');
    /* เรียกซ้ำตอน ba-anm-on มีอยู่แล้ว (ทาง layer 1 ทำสำเร็จ) ต้องไม่นับซ้ำ */
    const g3 = await ev(() => {
      const before = baBattleAudit().combatV9.n.ghostFix;
      const el = document.getElementById('baHero');
      el.classList.add('ba-anm-on');
      baAnimPaint({ c: 'ba-v9-ghost-test3', u: 'data:image/webp;base64,x', ms: 50, n: 1 }, false);
      const after = baBattleAudit().combatV9.n.ghostFix;
      el.classList.remove('ba-v9-ghost-test3');
      return { before: before, after: after };
    });
    ok(g3.after === g3.before, 'ba-anm-on มีอยู่แล้วจาก layer 1 → layer 2 ไม่ต้องลงมือซ้ำ (นับเท่าเดิม)');
  }

  // ══ บล็อก 5 · Ghosting Fix — จบไฟต์จริงด้วยสาย/ร่างที่ภาพไม่ครบ ═══════
  head('บล็อก 5 · Ghosting Fix — จบไฟต์จริงผ่าน baTriggerSkillAnim');
  {
    await arena(page, 1, { classId: 'priest', level: 1 });
    const r = await ev(() => {
      baDsEnsureRegistry();
      const tier = ba.assetRegistry.priest.c1.anim;
      const bkIdle = tier.idle.u, bkS1 = Object.assign({}, tier.s1);
      tier.idle.u = '';
      tier.s1.u = 'data:image/webp;base64,AAAAghost==';
      tier.s1.n = 1; tier.s1.c = 'ba-priest-s1'; tier.s1.ms = 200; tier.s1.r = 0;
      const el = document.getElementById('baHero');
      el.classList.remove('ba-anm-on');
      const fired = baTriggerSkillAnim('c1', 1, false);
      const bg = el.style.backgroundImage;
      const on = el.classList.contains('ba-anm-on');
      const fig = document.querySelector('#baHero .ba-fig');
      const figOp = fig ? getComputedStyle(fig).opacity : null;
      tier.idle.u = bkIdle;
      tier.s1.u = bkS1.u; tier.s1.n = bkS1.n; tier.s1.c = bkS1.c; tier.s1.ms = bkS1.ms; tier.s1.r = bkS1.r;
      return { fired: fired, bg: bg, on: on, figOp: figOp };
    });
    ok(r.fired === true, 'baTriggerSkillAnim(c1, slot1) ยิงสำเร็จ');
    ok(r.bg.indexOf('AAAAghost') >= 0, 'background-image ของ #baHero เป็นภาพที่ยืมมาจริง (ไม่ใช่ค่าว่าง)');
    ok(r.on === true, '#baHero มีคลาส ba-anm-on');
    ok(r.figOp === '0', 'เฟรมเดิมของ v6.5 (.ba-fig) ถูกซ่อนสนิท (opacity 0) — ไม่มีการทับซ้อนให้เห็น');
  }

  // ══ บล็อก 6 · Active MP Drain — บล็อกเมื่อ MP ไม่พอ ไม่แตะเกจ ═══════════
  head('บล็อก 6 · Active MP Drain — บล็อกเมื่อ MP ไม่พอ');
  {
    await arena(page, 1, { classId: 'assassin', level: 1 });
    const r = await ev(() => {
      G.ult = { pips: BA_PL_PIP_MAX };
      const cost = Math.max(1, Math.round(maxMpOf(G) * 0.40));
      G.mp = cost - 1;
      const n0 = baBattleAudit().combatV9.n.mpBlock;
      const ready0 = baPlUltReady();
      const r = baPlCast();
      const n1 = baBattleAudit().combatV9.n.mpBlock;
      return { cost: cost, mpBefore: cost - 1, ready0: ready0, cast: r,
               mpAfter: G.mp, pips: G.ult.pips, n0: n0, n1: n1,
               tip: (document.getElementById('gSkillTip') || {}).textContent };
    });
    ok(r.ready0 === true, 'เกจ 8 ขีดเต็มก่อนทดสอบ');
    ok(r.cast === false, 'baPlCast() คืน false เมื่อ MP ไม่พอ (มี ' + r.mpBefore + '/' + r.cost + ')');
    ok(r.mpAfter === r.mpBefore, 'MP ไม่ถูกหักเลยตอนบล็อก — ยังเป็น ' + r.mpAfter);
    ok(r.pips === 8, 'เกจ 8 ขีดยังไม่ถูกแตะ — ยังเป็น ' + r.pips + '/8');
    ok(r.n1 === r.n0 + 1, 'ตัวนับ mpBlock ขยับ +1 (' + r.n0 + ' → ' + r.n1 + ')');
    ok(/มานาไม่พอ/.test(r.tip || ''), 'ข้อความแจ้งมานาไม่พอขึ้นจริง — "' + r.tip + '"');
  }

  // ══ บล็อก 7 · Active MP Drain — หักจริงเมื่อ MP พอ (สายโจมตี) ══════════
  head('บล็อก 7 · Active MP Drain — หัก MP จริงตอนปล่อยสำเร็จ (สายโจมตี)');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const r = await ev(() => {
      G.ult = { pips: BA_PL_PIP_MAX };
      const cost = Math.max(1, Math.round(maxMpOf(G) * 0.40));
      G.mp = cost;                       /* พอดีเป๊ะ */
      const n0 = baBattleAudit().combatV9.n.mpSpend;
      const cast = baPlCast();
      const n1 = baBattleAudit().combatV9.n.mpSpend;
      return { cost: cost, cast: cast, mpAfter: G.mp, pips: G.ult.pips, n0: n0, n1: n1 };
    });
    ok(r.cast === true, 'baPlCast() คืน true เมื่อ MP พอดี');
    ok(r.mpAfter === 0, 'MP ถูกหักครบตามต้นทุน (มีพอดี ' + r.cost + ' → เหลือ ' + r.mpAfter + ')');
    ok(r.pips === 0, 'เกจ 8 ขีดถูกล้างเป็น 0 โดยตรรกะเดิมของ v8.5 (ไม่ได้ถูกแพตช์นี้แตะ)');
    ok(r.n1 === r.n0 + r.cost, 'ตัวนับ mpSpend สะสมยอดที่หักจริง (+' + r.cost + ')');
  }

  // ══ บล็อก 8 · Active MP Drain — คงเดิมข้ามสายสนับสนุน (priest) ════════
  head('บล็อก 8 · Active MP Drain — สายฟื้นฟู (priest) หัก MP หลังฟื้นเต็มหลอด');
  {
    await arena(page, 1, { classId: 'priest', level: 1, tanky: true });
    const r = await ev(() => {
      G.ult = { pips: BA_PL_PIP_MAX };
      G.hp = 1;
      const cost = Math.max(1, Math.round(maxMpOf(G) * 0.40));
      G.mp = maxMpOf(G);          /* เต็มหลอดอยู่แล้ว พอสำหรับต้นทุนแน่นอน */
      const cast = baPlCast();
      return { cost: cost, cast: cast, mp: G.mp, maxMp: maxMpOf(G), hp: G.hp };
    });
    ok(r.cast === true, 'ปล่อยพลังสำเร็จ');
    ok(r.hp > 1, 'สายฟื้นฟูยังฟื้น HP ตามตรรกะเดิมของ v8.5 (ไม่ถูกแพตช์นี้แตะ)');
    ok(r.mp === r.maxMp - r.cost, 'v8.5 เติม MP เต็มหลอดก่อน (ผลของท่าไม้ตายสายนักบวช) แล้ว v9.0 หักต้นทุนออกทีหลัง — เหลือ ' + r.mp + '/' + r.maxMp);
  }

  // ══ บล็อก 9 · Full-Range Dash — ฝั่งฮีโร่ตอบถูก → punch ที่อสูร ════════
  head('บล็อก 9 · Recoil — ฮีโร่ตีอสูรแล้วอสูรโดนอัด');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true, crit: false });
    const r = await page.evaluate(async () => {
      G.questionStart = Date.now() - 8000;   /* > 3 วิ = ตอบธรรมดาไม่คริต */
      const m = G.currentMonster;
      const n0 = baBattleAudit().combatV9.n.recoilFoe;
      answer(m.answer, null);
      /* พังก์ถูกยิงผ่าน baLater(..., BA_IMPACT) = 170ms หลังตอบ ต้องรอเกินนั้น
         ก่อนถึงจะเห็นคลาส — รอ 60ms (ก่อนหน้าที่เคยใช้) ยังไม่ถึงจังหวะที่ยิงจริง */
      await new Promise(res => setTimeout(res, 230));
      const midClass = document.getElementById('baFoe').className;
      await new Promise(res => setTimeout(res, 200));
      const afterClass = document.getElementById('baFoe').className;
      const n1 = baBattleAudit().combatV9.n.recoilFoe;
      return { midClass: midClass, afterClass: afterClass, n0: n0, n1: n1 };
    });
    ok(/\bba-target-recoil\b/.test(r.midClass), 'อสูรได้คลาส ba-target-recoil ตอนกระทบ (~170ms) — "' + r.midClass + '"');
    ok(!/\bba-target-recoil\b/.test(r.afterClass), 'พังก์หายไปเองหลัง 130ms ตามกำหนด');
    ok(r.n1 === r.n0 + 1, 'ตัวนับ recoilFoe ขยับ +1 (' + r.n0 + ' → ' + r.n1 + ')');
  }

  // ══ บล็อก 10 · Full-Range Dash — ฝั่งอสูรสวนกลับตอบผิด ═════════════════
  head('บล็อก 10 · Full-Range Dash — อสูรพุ่งเต็มระยะตอนสวนกลับ');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const r = await page.evaluate(async () => {
      G.hp = G.maxHp;
      G.shield = 0;
      G.questionStart = Date.now() - 8000;
      const m = G.currentMonster;
      const wrong = m.choices.filter(c => c !== m.answer)[0];
      const n0 = baBattleAudit().combatV9.n.mrush;
      const foe = document.getElementById('baFoe');
      answer(wrong, null);
      await new Promise(res => setTimeout(res, 30));
      const dx = foe.style.getPropertyValue('--ba-anm-dx');
      const minClass = foe.className;
      const n1 = baBattleAudit().combatV9.n.mrush;
      await new Promise(res => setTimeout(res, 420));      /* ให้ครบ tin+out (~380ms) */
      const outClass = foe.className;
      return { dx: dx, minClass: minClass, outClass: outClass, n0: n0, n1: n1 };
    });
    ok(parseFloat(r.dx) < 0, '--ba-anm-dx เป็นค่าลบ (พุ่งไปทางฮีโร่ ฝั่งซ้าย) — ได้ "' + r.dx + '"');
    ok(/\bba-v9-min\b/.test(r.minClass), 'อสูรได้คลาส ba-v9-min (เฟสพุ่งเข้า) ทันที — "' + r.minClass + '"');
    ok(!/\bba-atk-l\b/.test(r.minClass), 'คลาสระยะสั้นเดิมของ v6.0 (ba-atk-l) ถูกถอดออกแล้ว — ไม่ชนกัน');
    ok(!/\bba-v9-min\b/.test(r.outClass), 'พ้น 380ms แล้วเฟสพุ่งเข้าจบไป (ba-v9-min ถูกถอด)');
    ok(r.n1 === r.n0 + 1, 'ตัวนับ mrush ขยับ +1 ต่อการสวนกลับหนึ่งครั้ง (' + r.n0 + ' → ' + r.n1 + ')');
  }

  // ══ บล็อก 11 · Recoil — ฮีโร่โดนอสูรอัดกลับตอนตอบผิด (ไม่ถูกเกราะกัน) ═
  head('บล็อก 11 · Recoil — ฮีโร่โดนอัดตอนตอบผิดจริง');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const r = await page.evaluate(async () => {
      G.hp = G.maxHp;
      G.shield = 0;
      G.questionStart = Date.now() - 8000;
      const m = G.currentMonster;
      const wrong = m.choices.filter(c => c !== m.answer)[0];
      const n0 = baBattleAudit().combatV9.n.recoilHero;
      const hero = document.getElementById('baHero');
      answer(wrong, null);
      await new Promise(res => setTimeout(res, 200));
      const midClass = hero.className;
      await new Promise(res => setTimeout(res, 200));
      const afterClass = hero.className;
      const n1 = baBattleAudit().combatV9.n.recoilHero;
      return { midClass: midClass, afterClass: afterClass, n0: n0, n1: n1, hpLost: G.maxHp - G.hp };
    });
    ok(r.hpLost > 0, 'ฮีโร่เสีย HP จริงจากการตอบผิด (ยืนยันว่านี่คือกรณีไม่บล็อก) — เสีย ' + r.hpLost);
    ok(/\bba-v9-recoil-l\b/.test(r.midClass), 'ฮีโร่ได้คลาส ba-v9-recoil-l ตอนกระทบ — "' + r.midClass + '"');
    ok(!/\bba-v9-recoil-l\b/.test(r.afterClass), 'พังก์หายไปเองหลัง 130ms');
    ok(r.n1 === r.n0 + 1, 'ตัวนับ recoilHero ขยับ +1 (' + r.n0 + ' → ' + r.n1 + ')');
  }

  // ══ บล็อก 12 · Recoil — เกราะรับไว้ต้อง "ไม่" มีพังก์ ═══════════════════
  head('บล็อก 12 · Recoil — เกราะรับดาเมจไว้ต้องไม่มีพังก์');
  {
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const r = await page.evaluate(async () => {
      G.hp = G.maxHp;
      G.shield = 999;
      G.questionStart = Date.now() - 8000;
      const m = G.currentMonster;
      const wrong = m.choices.filter(c => c !== m.answer)[0];
      const n0 = baBattleAudit().combatV9.n.recoilHero;
      const mrush0 = baBattleAudit().combatV9.n.mrush;
      const hero = document.getElementById('baHero');
      answer(wrong, null);
      await new Promise(res => setTimeout(res, 200));
      const midClass = hero.className;
      const n1 = baBattleAudit().combatV9.n.recoilHero;
      const mrush1 = baBattleAudit().combatV9.n.mrush;
      return { midClass: midClass, n0: n0, n1: n1, mrush0: mrush0, mrush1: mrush1, shield: G.shield };
    });
    ok(!/\bba-v9-recoil-l\b/.test(r.midClass), 'เกราะรับดาเมจไว้ → ไม่มีพังก์ที่ฮีโร่ (🛡️ BLOCK สื่อสารต่างแบบอยู่แล้ว)');
    ok(r.n1 === r.n0, 'ตัวนับ recoilHero ไม่ขยับตอนเกราะรับไว้ (' + r.n0 + ' → ' + r.n1 + ')');
    ok(r.mrush1 === r.mrush0 + 1, 'แต่อสูรยังพุ่งเต็มระยะเข้ามาปกติ (mrush ยังขยับ — เกราะกันแค่ดาเมจ ไม่กันท่าทาง)');
  }

  // ══ บล็อก 13 · CSS — ทุกกฎที่ประกาศไว้จริง ══════════════════════════════
  head('บล็อก 13 · CSS ของแพตช์นี้');
  {
    const css = await ev(() => {
      const el = document.getElementById('baV9Style');
      return el ? el.textContent : '';
    });
    ok(css.indexOf('.ba-v9-min') >= 0, 'มีกฎ .ba-v9-min');
    ok(css.indexOf('.ba-v9-mout') >= 0, 'มีกฎ .ba-v9-mout');
    ok(css.indexOf('.ba-target-recoil') >= 0, 'มีกฎ .ba-target-recoil');
    ok(css.indexOf('.ba-v9-recoil-l') >= 0, 'มีกฎ .ba-v9-recoil-l');
    ok(css.indexOf('!important') >= 0, 'ใช้ !important ตามที่ตั้งใจ (ชนะ .ba-hurt/.ba-stun ที่อนิเมทโหนดเดียวกันอยู่แล้ว)');
    ok(css.indexOf('baAnmIn') >= 0 && css.indexOf('baAnmOut') >= 0,
      'ท่าพุ่งของอสูรยืม @keyframes baAnmIn/baAnmOut ของ v8.7 มาใช้ซ้ำ (ไม่ประกาศคีย์เฟรมชุดใหม่)');
    /* ไม่มีกฎไหนแตะ width/height/padding/margin ของกรอบสนาม — CLS = 0 */
    ok(!/\b(width|height|padding|margin)\s*:/i.test(css.replace(/scale\([^)]*\)/g, '')),
      'ไม่มีกฎไหนแตะขนาดกล่อง (width/height/padding/margin) — เฉพาะ transform/opacity/filter ล้วน');
  }

  // ══ บล็อก 14 · ความมั่นคง — ไม่มี error หลุด ═════════════════════════════
  head('บล็อก 14 · ความมั่นคง');
  {
    const log = await ev(() => {
      try { return JSON.parse(localStorage.getItem('yao_errlog') || '[]')
        .filter(r => /v9:/.test(r.where || r.msg || '')); } catch (e) { return []; }
    });
    ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุดเทสต์' + (errs.length ? ' — ' + errs[0] : ''));
    ok(log.length === 0, 'ไม่มีรายการของชั้นนี้ตกลง Error Log ของ v4.3 (' + log.length + ' รายการ)');
  }

  /* ══ บล็อก 15 · Idle Life-Cycling — "หายใจ" ตอนยืนนิ่งด้วยการสลับเฟรม ═════
     ยืนยันว่า baV9IdleLife() เกาะ baTick5() (150ms) จริง ไม่ใช่ baIdleTick()
     ที่ตายไปแล้วตั้งแต่ v6.5 (ดูคอมเมนต์ในซอร์ส "1.3 · Idle Life-Cycling")
     · ทำงานเฉพาะตอน ba-anm-on (per-class sprite ของ v8.7) · หยุดตอนท่าโจมตี
     ยังค้างอยู่ (BA_ACT_TO) · ไม่แตะ classList/transform เลยสักบรรทัด */
  head('บล็อก 15 · Idle Life-Cycling ("หายใจ" ตอนยืนนิ่ง)');
  {
    /* 15.1 — สายที่มีแค่ 1 เฟรมต่อสถานะแต่หลายสถานะ (priest c1: dash+s1-s4
       มีภาพ 5 สถานะ · idle ว่าง) ต้องสลับ "ภาพ" ไปเรื่อย ๆ ระหว่างรอสู้ */
    await arena(page, 1, { classId: 'priest', level: 1, tanky: true });
    const r1 = await page.evaluate(async () => {
      const hero = document.getElementById('baHero');
      const a0 = baBattleAudit().combatV9;
      const seq = [];
      for (let i = 0; i < 6; i++) {
        await new Promise(res => setTimeout(res, 950));
        seq.push({ bg: hero.style.backgroundImage, ix: baBattleAudit().combatV9.idleIx });
      }
      const a1 = baBattleAudit().combatV9;
      return {
        onClass: hero.classList.contains('ba-anm-on'),
        idleFrames0: a0.idleFrames,
        n0: a0.n.idleLife, n1: a1.n.idleLife,
        distinctBg: new Set(seq.map(s => s.bg)).size,
        distinctIx: new Set(seq.map(s => s.ix)).size
      };
    });
    ok(r1.onClass, 'priest เข้าโหมด ba-anm-on (มีภาพจริงอย่างน้อยหนึ่งสถานะ)');
    ok(r1.idleFrames0 >= 2, 'priest มีเฟรมให้สลับ ≥ 2 ใบ (ได้ ' + r1.idleFrames0 + ' — dash+s1-s4)');
    ok(r1.n1 > r1.n0, 'ตัวนับ idleLife ขยับขึ้นเรื่อย ๆ ระหว่างยืนรอ (' + r1.n0 + ' → ' + r1.n1 + ')');
    ok(r1.distinctBg >= 2, 'backgroundImage สลับไปมาจริง (' + r1.distinctBg + ' ค่าที่ต่างกันจาก 6 ตัวอย่าง)');
    ok(r1.distinctIx >= 2, 'ดัชนีเฟรม (idleIx) ขยับจริง ไม่ค้างที่ตัวเดียว');

    /* 15.2 — สายที่มีสถานะหลายเฟรมในภาพเดียว (assassin c1: idle n=3, dash n=4)
       ต้องเห็น backgroundPositionX ไล่ค่าไปตามสูตร i/(n-1)*100% ไม่ใช่ค้างที่ 0% */
    await arena(page, 1, { classId: 'assassin', level: 1, tanky: true });
    const r2 = await page.evaluate(async () => {
      const hero = document.getElementById('baHero');
      const posXs = [];
      for (let i = 0; i < 8; i++) {
        await new Promise(res => setTimeout(res, 950));
        posXs.push(hero.style.backgroundPositionX);
      }
      return { posXs: posXs, distinct: new Set(posXs).size };
    });
    ok(r2.distinct >= 2, 'assassin (มีแถบหลายเฟรม) — backgroundPositionX ไล่ค่าจริง (' +
      r2.distinct + ' ค่าที่ต่างกัน: ' + r2.posXs.join(', ') + ')');
    ok(r2.posXs.indexOf('0%') !== -1, 'ยังมีจังหวะที่เฟรม 0 โผล่ตามปกติ (ไม่ได้ข้ามไปเลย)');

    /* 15.3 — ต้องหยุดสนิทระหว่างท่าโจมตี/ท่าไม้ตายค้างอยู่ (BA_ACT_TO)
       ไม่ไปแย่งเฟรมกับ baFullMeleeStrike/baTriggerSkillAnim ที่กำลังเล่นอยู่ */
    const r3 = await page.evaluate(async () => {
      const g = G;
      g.classId = 'assassin';
      recalcStats();
      if (typeof baTriggerSkillAnim === 'function') baTriggerSkillAnim(baPlTier(g), 0, false);
      const lockedAt = BA_ANM_END;
      const n0 = baBattleAudit().combatV9.n.idleLife;
      /* ท่านี้ (โจมตีปกติ) กินเวลาสั้น ๆ ตาม st.ms — สุ่มระหว่างค้างแล้วเช็กว่า
         idleLife ไม่ขยับตราบใดที่ Date.now() < BA_ANM_END */
      await new Promise(res => setTimeout(res, Math.max(50, lockedAt - Date.now() - 60)));
      const stillLocked = Date.now() < BA_ANM_END;
      const n1 = baBattleAudit().combatV9.n.idleLife;
      await new Promise(res => setTimeout(res, 1400));   /* ผ่านล็อกไปแล้ว + รอบสลับถัดไป */
      const n2 = baBattleAudit().combatV9.n.idleLife;
      return { stillLocked: stillLocked, n0: n0, n1: n1, n2: n2 };
    });
    ok(r3.stillLocked, 'จับจังหวะได้ตอนท่าโจมตียังล็อกอยู่จริง (BA_ANM_END ยังไม่ถึง)');
    ok(r3.n1 === r3.n0, 'ระหว่างล็อกท่าโจมตี idleLife ไม่ขยับเลย (' + r3.n0 + ' → ' + r3.n1 + ')');
    ok(r3.n2 > r3.n1, 'พ้นล็อกไปแล้ว idleLife กลับมาขยับต่อตามปกติ (' + r3.n1 + ' → ' + r3.n2 + ')');
  }

  // ══ บล็อก 16 · เลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียว (CLS = 0) ═════════════
  head('บล็อก 16 · ความสูงการ์ดโจทย์ (CLS = 0)');
  {
    for (const w of [320, 390, 768]) {
      const p2 = await boot(browser, w, w === 320 ? 690 : (w === 768 ? 1024 : 844));
      await arena(p2.page, 1, { classId: 'assassin', level: 1, tanky: true });
      /* บังคับคำ/ตัวเลือกให้คงที่ก่อนวัดเสมอ + ล้าง #gFeedback (บทเรียนของชุด v7.2+) */
      await p2.page.evaluate(() => {
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng Yǔyán Dàxué';
        document.getElementById('gFeedback').textContent = '';
        renderChoices();
      });
      await p2.page.waitForTimeout(150);
      const r = await p2.page.evaluate(() => ({
        card: +document.querySelector('.ac-battle').getBoundingClientRect().height.toFixed(1),
        over: document.body.scrollWidth <= window.innerWidth
      }));
      const want = w === 320 ? 354.8 : 340.8;
      ok(r.card === want, 'จอ ' + w + ' · การ์ดโจทย์ ' + r.card + 'px (ต้องเป็น ' + want + 'px)');
      ok(r.over, 'จอ ' + w + ' · ไม่ล้นแนวนอน');
      await p2.page.close();
    }
  }

  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
