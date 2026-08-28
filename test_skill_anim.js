/* ชุดเทสต์ Patch v8.7 — UNIFIED 1:1 SKILL SPRITE ANIMATION ENGINE
                        (ASSASSIN C1 · SHADOW MONARCH C2)
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_skill_anim.js

   ข้อควรระวังที่เขียนไว้ใน CLAUDE.md และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ และ fetch ต้อง "ตอบกลับ" ไม่ใช่ค้าง
       ไม่งั้น v5.8 รอตลอดกาลแล้วล็อกอินไม่มีวันสำเร็จ (บทเรียนของชุด v8.5)
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7
       → ผ่านประตูกรองชั้น 20 ของ v8.2)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F/BA_INC_AT)
     · ตารางความยาวท่าเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ — ถ้าอ่านค่าคงที่ในเกมมาเทียบกับ
       ตัวเอง เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนตัวเลขไปแล้ว (บทเรียนของชุด v7.6)   */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'skill_anim_log.txt');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }

/* ── สารบัญของสเปก เขียนซ้ำไว้ฝั่งเทสต์ (จำเป็น ดูหัวไฟล์) ─────────────── */
const WANT = {
  c1: {
    idle: { cls: 'ba-assassin-idle',  ms: 0,   rush: false, n: 3 },
    dash: { cls: 'ba-assassin-dash',  ms: 380, rush: true,  n: 4 },
    s1:   { cls: 'ba-assassin-slot1', ms: 350, rush: true,  n: 1 },
    s2:   { cls: 'ba-assassin-slot2', ms: 300, rush: false, n: 1 },
    s3:   { cls: 'ba-assassin-slot3', ms: 400, rush: false, n: 1 },
    s4:   { cls: 'ba-assassin-slot4', ms: 600, rush: false, n: 1 }
  },
  c2: {
    idle: { cls: 'ba-monarch-idle',   ms: 0,   rush: false, n: 1 },
    s1:   { cls: 'ba-monarch-slot1',  ms: 380, rush: true,  n: 1 },
    s2:   { cls: 'ba-monarch-slot2',  ms: 320, rush: false, n: 1 },
    s3:   { cls: 'ba-monarch-slot3',  ms: 420, rush: false, n: 1 },
    s4:   { cls: 'ba-monarch-slot4',  ms: 650, rush: false, n: 1 }
  }
};
const WANT_FILE = {
  c1: {
    idle: '5.Shadow Assassin - BATTLE IDLE.jpg',
    dash: '6.Shadow Assassin - Dash Attack Dash Strike Critical Strike.jpg',
    s1:   '1.Shadow Assassin- Slot 1 Shadow Strike Purple Glow Blade Slash.jpg',
    s2:   '2.Shadow Assassin - Slot 2 Phantom Step.jpg',
    s3:   '3.Shadow Assassin - Slot 3 Poison Dagger Toxic Acid Green.jpg',
    s4:   '4.Shadow Assassin - Slot 4 Death Mark.jpg'
  },
  c2: {
    idle: 'shadow_monarch_c2_idle.png',
    s1:   'shadow_monarch_c2_slot1_sonic_flurry.png',
    s2:   'shadow_monarch_c2_slot2_precision.png',
    s3:   'shadow_monarch_c2_slot3_extraction.png',
    s4:   'shadow_monarch_c2_slot4_transcendent.png'
  }
};

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
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
      const gt = document.getElementById('baWvGate');
      if (gt && gt.classList.contains('active') && typeof baWvGateGo === 'function') { baWvGateGo(); return 'apex'; }
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
  /* ปลดล็อกแรงค์ + พาไปยืนชั้นธรรมดาที่ปิดระบบบุกรุกของ v6.6 ไว้แล้ว */
  await page.evaluate(() => {
    G.maxFloor = FLOOR_MAX; recalcStats();
    G.floor = 2; G.floorProgress = 0;
    BA_INC_F = 2; BA_INC_AT = -1; BA_INC_M = null;
    nextMonster();
    G.locked = false;
  });
  await clearOverlays(page);
  await page.evaluate(() => { G.locked = false; });
}

const A = page => page.evaluate(() => baBattleAudit().skillAnim);
const cls = page => page.evaluate(() => {
  const el = document.getElementById('baHero');
  return el ? Array.from(el.classList) : [];
});

(async () => {
  fs.writeFileSync(LOG, 'ชุดเทสต์ v8.7 · SKILL SPRITE ANIMATION ENGINE\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══ บล็อก 1 · ทะเบียนภาพ + คลาส CSS ════════════════════════════════════
  head('บล็อก 1 · Dual-Tier Asset & CSS Class Registry');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'anm1');
    const a = await A(b.page);
    ok('ชั้น v8.7 ติดตั้งแล้ว', a && a.ver === '8.7', a && a.ver);
    ok('เปิดใช้กับสายนักลอบสังหาร (ค่าเริ่มต้น)', a.on === true);
    eq('ร่างเริ่มต้นคือ C1', a.tier, 'c1');
    ok('ทะเบียนเสียบใต้ ba.assetRegistry ของ v8.5 แล้ว', a.registry === true);
    ok('มีก้อน CSS ของชั้นนี้บนจอ', a.styled === true);

    for (const t of ['c1', 'c2']) {
      const reg = await b.page.evaluate(x => {
        const d = ba.assetRegistry.assassin[x].anim, o = {};
        Object.keys(d).forEach(k => { o[k] = { cls: d[k].c, ms: d[k].ms, rush: !!d[k].r, n: d[k].n || 1, file: d[k].f, art: !!d[k].u }; });
        return o;
      }, t);
      eq('จำนวนสถานะของร่าง ' + t, Object.keys(reg).length, Object.keys(WANT[t]).length);
      for (const k of Object.keys(WANT[t])) {
        eq(t + '.' + k + ' → คลาส', reg[k] && reg[k].cls, WANT[t][k].cls);
        eq(t + '.' + k + ' → ความยาวท่า', reg[k] && reg[k].ms, WANT[t][k].ms);
        eq(t + '.' + k + ' → พุ่งเต็มระยะ', reg[k] && reg[k].rush, WANT[t][k].rush);
        eq(t + '.' + k + ' → สารบัญชื่อไฟล์', reg[k] && reg[k].file, WANT_FILE[t][k]);
        eq(t + '.' + k + ' → จำนวนเฟรมในแถบ', reg[k] && reg[k].n, WANT[t][k].n);
        /* Step 3 · Sprite Embedding — สไปรต์ถูกฝังครบทั้ง 11 ช่องแล้ว
           เคสนี้เคยยืนยัน "ยังไม่ฝัง (u ว่าง)" ซึ่งเป็นสถานะก่อนฝัง — พลิกด้าน
           โดยตั้งใจ (precedent: v7.4 · v7.8 · v7.9 · v8.1-v8.4 พลิกกันมาแล้วทุกชั้น) */
        ok(t + '.' + k + ' → ฝัง data URI แล้ว (ช่อง u ไม่ว่าง)', reg[k] && reg[k].art === true);
      }
    }
    /* v8.5 ยังอ่านทะเบียนของตัวเองได้ครบ — ห้ามทับคีย์ male/female */
    const keep = await b.page.evaluate(() =>
      ['male', 'female'].every(g => typeof ba.assetRegistry.assassin.c1[g] === 'string') &&
      typeof baPlArt(G) === 'string');
    ok('คีย์ male/female ของ v8.5 ไม่ถูกแตะ', keep === true);

    /* ทุกคลาสในทะเบียนต้องมีกฎ CSS จริง ไม่ใช่ชื่อลอย ๆ */
    const css = await b.page.evaluate(() => {
      const st = document.getElementById('baAnmStyle');
      return st ? st.textContent : '';
    });
    for (const c of Object.values(WANT.c1).concat(Object.values(WANT.c2)).map(x => x.cls)) {
      ok('มีกฎ CSS ของคลาส ' + c, css.indexOf('.' + c) >= 0);
    }
    ok('มีคีย์เฟรมท่าพุ่งสองเฟส', css.indexOf('@keyframes baAnmIn') >= 0 && css.indexOf('@keyframes baAnmOut') >= 0);
    ok('ใช้ will-change:transform ตามข้อกำหนดข้อ 3', css.indexOf('will-change:transform') >= 0);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 2 · ตัวส่งท่า + Atomic Duration Lock ═════════════════════════
  head('บล็อก 2 · Deterministic Dispatcher & Atomic Duration Lock');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'anm2');

    for (const [slot, key] of [[1, 's1'], [2, 's2'], [3, 's3'], [4, 's4'], [0, 'dash'], ['normal', 'dash']]) {
      const r = await b.page.evaluate(s => {
        baAnimRevert();
        const fired = baTriggerSkillAnim('c1', s, false);
        const a = baBattleAudit().skillAnim;
        return { fired: fired, key: a.key, left: a.left, cls: Array.from(document.getElementById('baHero').classList) };
      }, slot);
      ok('slot ' + JSON.stringify(slot) + ' → ท่า ' + key, r.fired === true && r.key === key, r);
      ok('slot ' + JSON.stringify(slot) + ' → ใส่คลาสถูกใบ', r.cls.indexOf(WANT.c1[key].cls) >= 0, r.cls);
      ok('slot ' + JSON.stringify(slot) + ' → ล็อกยาวเท่าตารางสเปก',
         Math.abs(r.left - WANT.c1[key].ms) <= 30, { left: r.left, want: WANT.c1[key].ms });
    }

    /* ลำดับความสำคัญ — ท่าที่ไม่สำคัญกว่าถูกปฏิเสธทั้งใบ ไม่ใช่เล่นทับครึ่งทาง */
    const pr = await b.page.evaluate(() => {
      baAnimRevert();
      const n0 = baBattleAudit().skillAnim.n;
      baTriggerSkillAnim('c1', 3, false);          /* s3 · pr 4 */
      const lowSame = baTriggerSkillAnim('c1', 3, false);
      const lower   = baTriggerSkillAnim('c1', 1, false);
      const keyMid  = baBattleAudit().skillAnim.key;
      const higher  = baTriggerSkillAnim('c1', 4, false);
      const a = baBattleAudit().skillAnim;
      return { lowSame: lowSame, lower: lower, keyMid: keyMid, higher: higher,
               keyEnd: a.key, block: a.n.block - n0.block };
    });
    ok('ท่าเดิม/ท่าที่ต่ำกว่า ถูกปฏิเสธระหว่างล็อก', pr.lowSame === false && pr.lower === false, pr);
    ok('ระหว่างล็อกท่าเดิมยังคาอยู่ ไม่ถูกทับครึ่งทาง', pr.keyMid === 's3', pr);
    ok('ท่าที่สำคัญกว่าแย่งได้ (s4 ทับ s3)', pr.higher === true && pr.keyEnd === 's4', pr);
    eq('ตัวนับการถูกปฏิเสธเดินขึ้น 2 ครั้ง', pr.block, 2);

    /* คืนท่ายืนทันทีที่เล่นจบ */
    await b.page.evaluate(() => { baAnimRevert(); baTriggerSkillAnim('c1', 2, false); });
    const during = await cls(b.page);
    ok('ระหว่างเล่นมีคลาสของท่าอยู่', during.indexOf('ba-assassin-slot2') >= 0, during);
    await b.page.waitForTimeout(WANT.c1.s2.ms + 260);
    const after = await cls(b.page);
    const a2 = await A(b.page);
    ok('เล่นจบแล้วถอดคลาสคืนทั้งหมด', after.indexOf('ba-assassin-slot2') < 0, after);
    ok('เล่นจบแล้วปลดล็อก', a2.locked === false && a2.key === '', a2);
    ok('ตัวนับ revert เดินขึ้นจริง', a2.n.revert > 0, a2.n);

    /* ล็อกเฟรมของ v6.1/v6.5 ไม่ให้นาฬิกาท่ายืนมาแย่งกลางท่า */
    const held = await b.page.evaluate(() => {
      baAnimRevert();
      baTriggerSkillAnim('c1', 4, false);
      return BA_ACT_TO - Date.now();
    });
    ok('จองเฟรมด้วย BA_ACT_TO ตลอดความยาวท่า', held > WANT.c1.s4.ms - 60, held);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 3 · พุ่งเต็มระยะ + จังหวะตรงกับตัวเลขดาเมจ ═══════════════════
  head('บล็อก 3 · Full-Range Melee Dash');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'anm3');

    const r = await b.page.evaluate(() => {
      baAnimRevert();
      const gap = (() => { const a = baSpot('baHero'), c = baSpot('baFoe'); return Math.round(c.x - a.x); })();
      const dx = baFullMeleeStrike(380, false);
      const el = document.getElementById('baHero');
      return { gap: gap, dx: dx, cls: Array.from(el.classList),
               vdx: el.style.getPropertyValue('--ba-anm-dx'),
               vin: el.style.getPropertyValue('--ba-anm-in'),
               vout: el.style.getPropertyValue('--ba-anm-out'),
               impact: baBattleAudit().skillAnim.impact };
    });
    ok('พุ่งไปถึงกล่องชนของอสูรจริง (ระยะ > 60% ของช่องว่าง)', r.dx > r.gap * 0.6, r);
    ok('ระยะพุ่งวัดสดจากพิกัดจริง ไม่ได้ฮาร์ดโค้ด', r.vdx === r.dx + 'px', r);
    ok('เฟสเข้ายาวเท่า BA_IMPACT ของ v6.0 เป๊ะ', r.vin === r.impact + 'ms', r);
    ok('เฟสออกยาวเท่าที่เหลือของท่า', r.vout === (380 - r.impact) + 'ms', r);
    ok('เฟสเข้าใส่คลาส ba-anm-in', r.cls.indexOf('ba-anm-in') >= 0, r.cls);
    ok('ถอดท่าพุ่งของ v6.3 ออกก่อนเสมอ (กัน transform ชนกัน)',
       r.cls.indexOf('ba-atk') < 0 && r.cls.indexOf('ba-atk2') < 0, r.cls);

    await b.page.waitForTimeout(r.impact + 90);
    const mid = await cls(b.page);
    ok('ถึงจังหวะปะทะแล้วสลับเป็นเฟสออก', mid.indexOf('ba-anm-out') >= 0 && mid.indexOf('ba-anm-in') < 0, mid);

    /* คริต = สเกลตอนปะทะกว้างกว่าปกติ (isCrit ถูกใช้จริง ไม่ใช่พารามิเตอร์หลอก) */
    const sc = await b.page.evaluate(() => {
      const el = document.getElementById('baHero');
      baAnimRevert(); baFullMeleeStrike(380, false);
      const a = el.style.getPropertyValue('--ba-anm-sc');
      baAnimRevert(); baFullMeleeStrike(380, true);
      const c = el.style.getPropertyValue('--ba-anm-sc');
      return { a: parseFloat(a), c: parseFloat(c) };
    });
    ok('isCrit ทำให้สเกลตอนปะทะกว้างขึ้นจริง', sc.c > sc.a, sc);

    /* GPU ล้วน — อนิเมชันแตะแค่ transform */
    const gpu = await b.page.evaluate(() => {
      const st = document.getElementById('baAnmStyle').textContent;
      const kf = st.slice(st.indexOf('@keyframes baAnmIn'));
      return { hasLeft: /@keyframes baAnm[^}]*(left:|top:|width:|height:|margin)/.test(kf),
               hasTransform: kf.indexOf('transform:translateX') >= 0 };
    });
    ok('คีย์เฟรมใช้ transform อย่างเดียว ไม่แตะกล่อง', gpu.hasTransform && !gpu.hasLeft, gpu);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 4 · จุดยิงอัตโนมัติ ═══════════════════════════════════════════
  head('บล็อก 4 · จุดยิงอัตโนมัติ (ตอบถูก · ท่าไม้ตาย)');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'anm4');

    /* ── เคสชุดนี้ถูกพลิกโดยตั้งใจตอนชั้น v8.8 ────────────────────────────
       เดิมวัดด้วย "ระดับช่อง" (Lv1 = เส้นฐานไม่ให้โบนัส · Lv2 ขึ้นไปถึงมีผล)
       ตั้งแต่ v8.8 เมทริกซ์ของสเปกให้ช่อง 1 ของนักลอบสังหารมีอะตอม win = 3.5 วิ
       ตัวตัดสินจึงกลายเป็น "ตอบไวทันกรอบไหม" ไม่ใช่ "อัประดับหรือยัง"
       (สเปกให้ดาเมจ 120% ตั้งแต่ Lv1 อยู่แล้ว) */

    /* ตอบช้ากว่ากรอบ 3.5 วิ → ช่อง 1 ไม่ทำงาน ได้ท่าโจมตีปกติ */
    const n1 = await b.page.evaluate(() => {
      baAnimRevert();
      G.questionStart = Date.now() - 6000;         /* ช้ากว่ากรอบ = ไม่เข้าเงื่อนไข */
      baStrike(12, false, false);
      const a = baBattleAudit().skillAnim;
      return { key: a.key, s1: baPlS1(G) };
    });
    eq('ตอบช้ากว่ากรอบ win → ช่อง 1 ไม่ให้ดาเมจซ้ำ', n1.s1, 0);
    eq('ตอบถูกธรรมดา → ท่าโจมตีปกติ (dash)', n1.key, 'dash');

    /* ตอบไวทันกรอบ → ช่อง 1 ทำงาน กลายเป็น Shadow Strike */
    const s1 = await b.page.evaluate(() => {
      G.skills.assassin[0] = 2;
      G.questionStart = Date.now();                /* ไวทันกรอบ 3.5 วิ */
      baAnimRevert();
      baStrike(12, false, false);
      const a = baBattleAudit().skillAnim;
      return { key: a.key, s1: baPlS1(G), cls: Array.from(document.getElementById('baHero').classList) };
    });
    ok('ตอบไวทันกรอบ win → ช่อง 1 ให้ดาเมจซ้ำจริง', s1.s1 > 0, s1);
    eq('ตอบถูกขณะช่อง 1 ทำงาน → ท่า Shadow Strike', s1.key, 's1');
    ok('ได้คลาส ba-assassin-slot1', s1.cls.indexOf('ba-assassin-slot1') >= 0, s1.cls);

    /* ท่าไม้ตายช่อง 4 — ยิงเฉพาะตอนปล่อยสำเร็จจริง */
    const ult = await b.page.evaluate(() => {
      baAnimRevert();
      G.ult = { pips: 0, locked: false };
      const failed = baPlCast();                    /* เกจยังไม่เต็ม → ต้องไม่ยิง */
      const k0 = baBattleAudit().skillAnim.key;
      baPlPipSet(G, BA_PL_PIP_MAX);
      G.monsterHp = 999999; G.monsterMaxHp = 999999;
      const done = baPlCast();
      const a = baBattleAudit().skillAnim;
      return { failed: failed, k0: k0, done: done, key: a.key, left: a.left };
    });
    ok('เกจยังไม่เต็ม → ไม่ปล่อยและไม่เล่นท่า', ult.failed === false && ult.k0 === '', ult);
    ok('ปล่อยท่าไม้ตายสำเร็จ → เล่นท่าช่อง 4', ult.done === true && ult.key === 's4', ult);
    ok('ท่าช่อง 4 ล็อกยาว 600ms ตามสเปก', Math.abs(ult.left - 600) <= 40, ult.left);

    /* ขึ้นข้อใหม่ = ล้างท่าค้างทิ้งเสมอ (baClearFx ของ v6.0) */
    const cleared = await b.page.evaluate(() => {
      baTriggerSkillAnim('c1', 3, false);
      baClearFx();
      const a = baBattleAudit().skillAnim;
      return { key: a.key, locked: a.locked, cls: Array.from(document.getElementById('baHero').classList) };
    });
    ok('baClearFx ล้างท่าค้างครบ ไม่ค้างข้ามข้อ',
       cleared.key === '' && cleared.locked === false &&
       cleared.cls.indexOf('ba-assassin-slot3') < 0, cleared);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 5 · ร่าง C2 · Shadow Monarch ═════════════════════════════════
  head('บล็อก 5 · ร่าง C2 (Shadow Monarch)');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'anm5');
    const c2 = await b.page.evaluate(() => {
      G.level = BA_PL_TIER_LV; recalcStats();
      const a = baBattleAudit().skillAnim;
      baAnimRevert();
      const normal = baTriggerSkillAnim('', 0, false);
      const k = baBattleAudit().skillAnim;
      return { tier: a.tier, ms: a.ms, normal: normal, key: k.key,
               left: k.left, cls: Array.from(document.getElementById('baHero').classList) };
    });
    eq('เลเวลถึงเกณฑ์ → ร่างเป็น C2', c2.tier, 'c2');
    eq('ตารางความยาวท่าของ C2 ตรงสเปก', c2.ms.c2,
       { idle: 0, s1: 380, s2: 320, s3: 420, s4: 650 });
    eq('ตารางความยาวท่าของ C1 ยังตรงสเปก', c2.ms.c1,
       { idle: 0, dash: 380, s1: 350, s2: 300, s3: 400, s4: 600 });
    ok('C2 ไม่มีภาพ Dash แยก → ท่าโจมตีปกติตกไปใช้ Slot 1 (380ms)',
       c2.normal === true && c2.key === 'dash' && Math.abs(c2.left - 380) <= 30, c2);
    ok('C2 ใช้คลาสของราชันเงา', c2.cls.indexOf('ba-monarch-slot1') >= 0, c2.cls);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6 · สายอื่นไม่ถูกแตะ (ก่อนมี v8.8) / ยังไม่มีภาพจึงตกกลับ ══════
  head('บล็อก 6 · สายที่ยังไม่มีภาพ (priest) ยังตกกลับไปใช้ท่า v6.3 เหมือนเดิม');
  {
    /* ตั้งแต่ v8.8 · UNIVERSAL HOT-PLUG ASSET ENGINE ห่อ baAnimOn ให้เปิดเครื่อง
       อนิเมชันของชั้นนี้ให้ "ทุกสายที่มีภาพจริง" ไม่ใช่แค่ assassin อีกต่อไป —
       เคสนี้จึงต้องทดสอบกับสายที่ **ยังไม่มีไฟล์ต้นฉบับจริง ๆ** (priest/soulmaster)
       เพื่อยืนยันว่า "ไม่มีภาพ = ตกกลับไปใช้ท่าพุ่งของ v6.3" ยังทำงานถูกต้อง
       (พลิกจากเดิมที่ใช้ guardian ซึ่งได้ภาพไปแล้วตอนฝังสไปรต์ 4 สายเพิ่ม —
       precedent: v7.4 · v7.8 · v7.9 · v8.1-v8.4 พลิกกันมาแล้วทุกชั้น) */
    const b = await boot(browser);
    await enterGame(b.page, 'anm6');
    const other = await b.page.evaluate(() => {
      baPlSwitch('priest');
      baAnimRevert();
      const on = baBattleAudit().skillAnim.on;
      G.questionStart = Date.now() - 6000;
      baStrike(12, false, false);
      const a = baBattleAudit().skillAnim;
      return { on: on, key: a.key, cls: Array.from(document.getElementById('baHero').classList) };
    });
    ok('สายนักบวช (ยังไม่มีภาพ) ไม่เข้าเงื่อนไขของชั้นนี้', other.on === false, other);
    eq('ตอบถูกแล้วไม่มีท่าของชั้นนี้เล่น', other.key, '');
    ok('ท่าพุ่งของ v6.3 ยังทำงานตามเดิม',
       other.cls.indexOf('ba-atk') >= 0 || other.cls.indexOf('ba-atk2') >= 0, other.cls);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 6.1 · v8.8 เปิดเครื่องอนิเมชันให้สายที่มีภาพจริงแล้ว ═════════════
  head('บล็อก 6.1 · v8.8 · สายที่ฝังภาพแล้ว (guardian) ได้เครื่องอนิเมชันของตัวเอง');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'anm61');
    const other = await b.page.evaluate(() => {
      baPlSwitch('guardian');
      baAnimRevert();
      const on = baBattleAudit().skillAnim.on;
      G.questionStart = Date.now() - 6000;
      baStrike(12, false, false);
      const a = baBattleAudit().skillAnim;
      return { on: on, key: a.key, cls: Array.from(document.getElementById('baHero').classList) };
    });
    ok('สายผู้พิทักษ์ (มีภาพแล้ว) เข้าเงื่อนไขของ v8.8', other.on === true, other);
    ok('ตอบถูกแล้วมีท่าของตัวเองเล่น (dash/s1)', other.key === 'dash' || other.key === 's1', other);
    ok('คลาสที่ติดคือของผู้พิทักษ์ ไม่ใช่ของนักลอบสังหาร',
       other.cls.some(c => c.indexOf('ba-guardian-') === 0)
         && !other.cls.some(c => c.indexOf('ba-assassin-') === 0 || c.indexOf('ba-monarch-') === 0),
       other.cls);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  // ══ บล็อก 7 · CLS = 0 ═════════════════════════════════════════════════
  head('บล็อก 7 · CLS Guard (ความสูงการ์ดโจทย์ · ไม่เพิ่ม DOM ในสนามรบ)');
  for (const w of [320, 360, 390, 430]) {
    const b = await boot(browser, w, 844);
    await enterGame(b.page, 'cls' + w);

    const dom = await b.page.evaluate(() => {
      const ar = document.getElementById('baArena');
      const before = ar.getElementsByTagName('*').length;
      const h0 = document.querySelector('.ac-battle').getBoundingClientRect().height;
      baAnimRevert();
      baTriggerSkillAnim('c1', 1, true);
      const during = ar.getElementsByTagName('*').length;
      const h1 = document.querySelector('.ac-battle').getBoundingClientRect().height;
      return { before: before, during: during, h0: h0, h1: h1 };
    });
    eq('จอ ' + w + ' · ไม่เพิ่ม DOM ในสนามรบสักโหนด', dom.during, dom.before);
    ok('จอ ' + w + ' · ความสูงการ์ดโจทย์ไม่ขยับระหว่างเล่นท่า',
       Math.abs(dom.h1 - dom.h0) < 0.01, dom);

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
    eq('จอ ' + w + ' · ความสูงการ์ดโจทย์', h, w === 320 ? 354.8 : 340.8);
    ok('จอ ' + w + ' · ไม่ล้นแนวนอน',
       await b.page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
    ok('จอ ' + w + ' · ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  say('\n══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════');
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
