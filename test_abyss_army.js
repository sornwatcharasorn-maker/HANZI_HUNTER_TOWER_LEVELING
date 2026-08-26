/* test_abyss_army.js — ชุดเทสต์ของชั้น v6.6 · HYBRID INCURSION & ABYSSAL SHADOW ARMY
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_abyss_army.js
 *
 * ชี้ไปที่ **ไฟล์แจก** ที่รากrepo โดยเจตนา เหมือนอีก 15 ชุด — ต้องพิสูจน์ของที่
 * นักเรียนได้ใช้จริง ไม่ใช่ต้นฉบับที่ไม่มีใครได้ใช้ (แก้ต้นฉบับแล้วต้อง build ก่อน)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * สี่เรื่องที่ต้องรู้ก่อนแก้ชุดนี้
 *
 * 1) **ห้ามพาไปยืนชั้น 1/6/11/16** — เป็นรอยต่อช่วงชั้นของ v4.7 nextMonster()
 *    จะเด้งหน้าต่างจั่วการ์ดแทนการขึ้นมอนสเตอร์ แล้วทุกเคสหลังจากนั้นจะวัดกับ
 *    มอนสเตอร์ตัวเก่า (เจอมาแล้วรอบแรก — อ่านผลแล้วนึกว่าระบบบุกรุกไม่ทำงาน)
 *    ถ้าจำเป็นต้องไปจริง ๆ ให้ปั๊ม CD_BAND = cdBandOf(ชั้นนั้น) ก่อน
 *
 * 2) **ต้องปั๊ม BA_INC_F ให้ตรงชั้นก่อนบังคับผลบุกรุก** ไม่งั้น baIncSync จะเห็นว่า
 *    ชั้นเปลี่ยนแล้วทอยลูกเต๋าใหม่ทับค่าที่เพิ่งตั้งไว้
 *
 * 3) **ต้องผ่านป๊อปอัปกติกาของ v5.6 แบบที่นักเรียนทำจริง** (เลื่อน #rgBody ให้สุด
 *    แล้ว rgAck()) ห้ามเรียก enterGate() ตรง ๆ ซึ่งถูกบล็อกไว้
 *
 * 4) **ต้อง stub fetch + EventSource ก่อนโหลดหน้าเสมอ** เพราะ v5.4 ฝัง URL
 *    ฐานข้อมูลจริงไว้ในซอร์สและเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_abyss_army.log');
let pass = 0, fail = 0;

function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(c, n, x) {
  if (c) { pass++; say('  ✅ ' + n); }
  else { fail++; say('  ❌ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); }
}

(async () => {
  fs.writeFileSync(LOG, '');
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.addInitScript(() => {
    window.fetch = () => Promise.reject(new Error('offline'));
    window.EventSource = function () { this.close = function () {}; };
  });
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const el = document.getElementById('rgBody'); if (el) el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    switchTab('register');
    document.getElementById('reg-id').value = 'shadowtest';
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    const n = document.getElementById('reg-name'); if (n) n.value = 'เงา';
    handleSubmit();
  });
  await page.waitForTimeout(1200);
  /* หน้าต่างจั่วการ์ดของ v4.7 คั่นตอนเข้าเกม — ต้องเลือกให้จบก่อนเสมอ */
  for (let i = 0; i < 4; i++) {
    const opened = await page.evaluate(() => {
      const d = document.getElementById('cdDraft'); return !!(d && d.classList.contains('active'));
    });
    if (!opened) break;
    await page.evaluate(() => { const c = document.querySelector('#cdDraft .cd-card'); if (c) c.click(); });
    await page.waitForTimeout(800);
  }
  /* การ์ดที่ยุ่งกับนาฬิกา (🧘 สมาธิแน่วแน่) ทำให้ QUESTION_TIMER เป็น null โดยชอบธรรม
     สลับเป็นใบที่ไม่แตะนาฬิกาก่อน แล้วทุกเคสที่วัดสถานะ "กำลังสู้" จะเชื่อถือได้ */
  await page.evaluate(() => {
    CD_CARD = CD_BY_ID.mana; CD_BAND = cdBandOf(G.floor); cdPaintUi();
    G.maxFloor = FLOOR_MAX; recalcStats();
  });
  await page.waitForTimeout(300);

  // ══ 1 · สารบัญและสไปรต์ ══════════════════════════════════════════
  say('\n[1] สารบัญทัพเงาและสไปรต์');
  const a1 = await page.evaluate(() => baBattleAudit().shadow);
  ok(a1.army === 25, 'ทัพเงา 25 ตัวในสารบัญ BA_FOES_ABYSS', a1.army);
  ok(a1.mini === 20, 'Mini Boss ลำดับ 1-20', a1.mini);
  ok(a1.myth === 5, 'Mythic Kamish ลำดับ 21-25', a1.myth);
  ok(a1.art === 25, 'ฝังสไปรต์ครบทั้ง 25 ตัว', a1.art);
  ok(a1.chance === 15, 'โอกาสบุกรุก 15% ต่อชั้น', a1.chance);

  const frames = await page.evaluate(() => {
    const k = Object.keys(BA_SH_ART);
    return { n: k.reduce((s, x) => s + BA_SH_ART[x].length, 0),
             noIdle: k.filter(x => !BA_SH_ART[x].some(f => f.k === 'idle')),
             noAct: k.filter(x => !BA_SH_ART[x].some(f => f.k === 'act')) };
  });
  ok(frames.n === 50, 'รวม 50 เฟรม (ตัวละ ท่ายืน+ท่าฟาด)', frames.n);
  ok(frames.noIdle.length === 0, 'ทุกตัวมีท่ายืน', frames.noIdle);
  ok(frames.noAct.length === 0, 'ทุกตัวมีท่าฟาด', frames.noAct);

  /* data URI เสียจะเงียบสนิท ไม่มี error ให้เห็น — ต้องรอ decode แล้ววัด naturalWidth */
  const broken = await page.evaluate(async () => {
    const out = [];
    for (const k of Object.keys(BA_SH_ART)) {
      for (const f of BA_SH_ART[k]) {
        const good = await new Promise(res => {
          const im = new Image();
          im.onload = () => res(im.naturalWidth > 0);
          im.onerror = () => res(false);
          im.src = f.d;
        });
        if (!good) out.push(k);
      }
    }
    return out;
  });
  ok(broken.length === 0, 'ทุกเฟรม decode ได้จริง (naturalWidth > 0)', broken);

  const meta = await page.evaluate(() => BA_FOES_ABYSS
    .filter(e => !e.id || !e.en || !e.name || !e.file || !e.tier ||
                 !e.sk || !e.sk.name || !e.sk.en || !e.sk.desc || !e.sk.s || !e.sk.fx ||
                 typeof e.sk.run !== 'function')
    .map(e => e.id || '?'));
  ok(meta.length === 0, 'ทุกตัวมีชื่อ/ไฟล์/ระดับ/สกิล/เสียง/เอฟเฟกต์ครบ', meta);

  const tone = await page.evaluate(() => Object.values(BA_SH_TONE).filter(k => !AU_SFX_DEF[k]));
  ok(tone.length === 0, 'เสียงสังเคราะห์ครบ 6 โทนในคลังของ v5.1', tone);
  const fxmap = await page.evaluate(() => BA_FOES_ABYSS.filter(e => !BA_ATK_FX[e.id]).map(e => e.id));
  ok(fxmap.length === 0, 'ทุกตัวถูกลงทะเบียนใน BA_ATK_FX ของ v6.4', fxmap);

  // ══ 2 · ระบบบุกรุก ═══════════════════════════════════════════════
  say('\n[2] ระบบบุกรุก (Abyssal Incursion)');
  const inc = await page.evaluate(() => {
    G.floor = 7; G.floorProgress = 0; G.locked = false; CD_BAND = cdBandOf(7);
    G.monsterMaxHp = 99999; G.monsterHp = 99999;
    BA_INC_F = 7; BA_INC_AT = 0; BA_INC_ID = 's7'; BA_INC_M = null;
    nextMonster();
    const au = baBattleAudit().shadow;
    const nm = document.getElementById('baFoeName');
    return { on: au.incursion, id: au.id, tier: au.tier, atb: au.atb,
             txt: nm.textContent, cls: nm.className,
             arena: document.getElementById('baArena').className,
             imgs: document.getElementById('baFoe').getElementsByClassName('ba-mon').length };
  });
  ok(inc.on === true, 'บุกรุกทำงานที่มอนสเตอร์ตัวที่จับสลากไว้', inc.on);
  ok(inc.id === 's7' && inc.tier === 'mini', 'ทัพเงาตัวที่สุ่มไว้มายืนแทน', inc);
  ok(inc.atb === 4000, 'เกจสกิลเร่งตามโซนที่ไปโผล่ (โซน 2 = 4.0 วิ)', inc.atb);
  ok(/💀/.test(inc.txt) && /Shadow Lancer/.test(inc.txt), 'ป้ายชื่อ 💀 [ชื่ออังกฤษ]', inc.txt);
  ok(/ba-name-miniboss/.test(inc.cls), 'ใช้คลาส .ba-name-miniboss', inc.cls);
  ok(/ba-invade/.test(inc.arena), 'กรอบสนามติดคลาส ba-invade (ป้ายเตือนม่วง)', inc.arena);
  ok(inc.imgs > 0, 'สไปรต์ทัพเงาถูกแขวนขึ้นจอจริง', inc.imgs);

  const inv = await page.evaluate(() => {
    const st = getComputedStyle(document.querySelector('#baArena .ba-foe .ba-plate .ba-name'));
    return { color: st.color, weight: st.fontWeight, align: st.textAlign };
  });
  ok(inv.color === 'rgb(192, 132, 252)', 'สีป้าย Mini Boss = #c084fc ตามสเปก', inv.color);
  ok(inv.align === 'right', 'ป้ายชิดขวา', inv.align);

  /* ไม่บุกรุก = ต้องกลับไปเป็นอสูรหอคอยปกติทันที */
  const off = await page.evaluate(() => {
    G.floor = 9; G.floorProgress = 0; G.locked = false; CD_BAND = cdBandOf(9);
    G.monsterMaxHp = 99999; G.monsterHp = 99999;
    BA_INC_F = 9; BA_INC_AT = -1; BA_INC_M = null;      /* ปิดบุกรุกของชั้นนี้ */
    nextMonster();
    const au = baBattleAudit().shadow;
    return { on: au.incursion, id: au.id, name: document.getElementById('baFoeName').textContent };
  });
  ok(off.on === false && !off.id, 'ชั้นที่ไม่ถูกบุกรุกยังเป็นอสูรหอคอยตามเดิม', off);
  ok(!/💀/.test(off.name), 'ป้ายชื่อกลับไปเป็นของ v6.5', off.name);

  /* โหมดฝึกจุดอ่อนต้องไม่มีการบุกรุกเลย */
  const prac = await page.evaluate(() => {
    G.practiceMode = true; G.floor = 7; G.floorProgress = 0;
    BA_INC_F = 7; BA_INC_AT = 0; BA_INC_ID = 's7'; BA_INC_M = null;
    baIncSync();
    const r = { on: baIncOn(), sh: !!baShNow() };
    G.practiceMode = false;
    return r;
  });
  ok(prac.on === false && prac.sh === false, 'โหมดฝึกจุดอ่อนไม่มีทัพเงาเลย', prac);

  /* อัตราการบุกรุกจริง — ทอย 4000 ชั้น แล้วต้องเข้าใกล้ 15% */
  const rate = await page.evaluate(() => {
    let hit = 0;
    for (let i = 0; i < 4000; i++) { baIncRoll(1 + (i % 20)); if (BA_INC_AT >= 0) hit++; }
    BA_INC_AT = -1; BA_INC_M = null;
    return hit / 4000 * 100;
  });
  ok(Math.abs(rate - 15) < 2.5, 'อัตราบุกรุกจริงเข้าใกล้ 15% (วัด 4,000 ชั้น)', +rate.toFixed(2));

  /* กับดักข้อ 32 — ห้ามกินคิวของ Math.random ที่ชุดเทสต์ของ v4.7 ยึดไว้ */
  const rnd = await page.evaluate(() => {
    const real = Math.random; let n = 0;
    Math.random = function () { n++; return real(); };
    try { for (let i = 0; i < 50; i++) baIncRoll(5); baIncSync(); baShNow(); baShTag(); }
    finally { Math.random = real; }
    BA_INC_AT = -1; BA_INC_M = null;
    return n;
  });
  ok(rnd === 0, 'ตรรกะทัพเงาไม่เรียก Math.random สักครั้ง (กับดักข้อ 32)', rnd);

  // ══ 3 · รางวัลผู้ชนะการบุกรุก ════════════════════════════════════
  say('\n[3] รางวัลผู้ชนะการบุกรุก');
  const rw = await page.evaluate(() => {
    G.floor = 7; G.floorProgress = 0; G.locked = false; CD_BAND = cdBandOf(7);
    G.monsterMaxHp = 99999; G.monsterHp = 99999;
    BA_INC_F = 7; BA_INC_AT = 0; BA_INC_ID = 's13'; BA_INC_M = null;
    nextMonster();
    G.hp = Math.round(G.maxHp * 0.4);
    const hp0 = G.hp, g0 = G.gold, t0 = G.totalGoldEarned || 0;
    BA_INC_G = 120;                     /* จำลองว่าหาทองได้ 120 ระหว่างสู้ผู้บุกรุก */
    G.monsterHp = 1;
    onMonsterDefeated();
    return { dg: G.gold - g0, dt: (G.totalGoldEarned || 0) - t0, dh: G.hp - hp0,
             want: Math.round(G.maxHp * 0.20), still: baIncOn() };
  });
  ok(rw.dg === 120, 'ทอง x2 = จ่ายเพิ่มเท่ากับที่หาได้ระหว่างสู้', rw);
  ok(rw.dt === 120, 'ทองโบนัสบวกเข้ายอดสะสมตลอดชีพด้วย (มาจากหอคอยจริง)', rw);
  ok(rw.dh === rw.want, 'ฟื้น HP +20% ของหลอดเต็ม', rw);
  ok(rw.still === false, 'ผู้บุกรุกถูกปลดหลังถูกปราบ', rw.still);

  /* 💀 พันธสัญญาโลหิตทมิฬของ v4.7 ห้ามฟื้นพลังทุกทาง — รางวัลนี้ต้องเคารพด้วย */
  const noheal = await page.evaluate(() => {
    G.floor = 7; G.floorProgress = 0; G.locked = false;
    G.monsterMaxHp = 99999; G.monsterHp = 99999;
    BA_INC_F = 7; BA_INC_AT = 0; BA_INC_ID = 's13'; BA_INC_M = null;
    nextMonster();
    CD_CARD = CD_BY_ID.vow; CD_BAND = cdBandOf(G.floor); CD_ST.noHeal = 1;
    G.hp = 1; const hp0 = G.hp;
    BA_INC_G = 40; G.monsterHp = 1; onMonsterDefeated();
    const out = G.hp - hp0;
    CD_ST.noHeal = 0; CD_CARD = CD_BY_ID.mana;
    return out;
  });
  ok(noheal === 0, 'ห้ามฟื้นพลังตอนถือ 💀 พันธสัญญาโลหิตทมิฬ', noheal);

  // ══ 4 · โหมดเหวลึก + Boss Rush ของ Kamish ════════════════════════
  say('\n[4] โหมดเหวลึก + Boss Rush ของ Kamish');
  const kam = await page.evaluate(() => {
    G.practiceMode = false; G.ab.abyss = true;
    G.floor = 20; G.floorProgress = 0; G.locked = false; CD_BAND = cdBandOf(20);
    G.monsterMaxHp = 4000; G.monsterHp = 4000;
    nextMonster();
    const au = baBattleAudit().shadow;
    const nm = document.getElementById('baFoeName');
    return { id: au.id, tier: au.tier, atb: au.atb, bat: au.bat, pct: au.pct,
             bar: BA_BAR ? Math.round(BA_BAR.max / BA_BAR.base * 100) : 0,
             want: Math.round((typeof BA_AX_BAR !== 'undefined' ? BA_AX_BAR
                              : (typeof BA_RS_BAR !== 'undefined' ? BA_RS_BAR : BA_KAM_BAR)) * 100),
             txt: nm.textContent, cls: nm.className };
  });
  ok(kam.tier === 'mythic', 'ชั้นบอสในเหวลึกได้ Kamish', kam);
  ok(kam.atb === 5000, 'หลอดท่าไม้ตายเต็มทุก 5.0 วิ', kam.atb);
  ok(kam.bat === 2000, 'หลอดโจมตีปกติเต็มทุก 2.0 วิ', kam.bat);
  ok(kam.pct === 30, 'โจมตีปกติ -30% HP', kam.pct);
  /* ชั้น v6.7 ทับเกราะของบอส *ทุกตัว* ให้เป็น 70% ของเนื้อบอส (BA_RS_BAR)
     รวม Kamish ด้วย — สเปกของชั้นนั้นสั่งค่าเดียวทุกบอส BA_KAM_BAR ของ v6.6
     จึงถูกกลบตั้งแต่ต้นไฟต์ ไม่ใช่บั๊ค · เทียบกับค่าคงที่จริงเสมอ อย่าพิมพ์เลขทับ

     **Micro-Patch ULTIMATE ABYSS พลิกเคสนี้โดยตั้งใจ** — ทัพเงาทั้ง 25 ตัวถูกหั่นลง
     ครึ่งหนึ่งของบอสหอคอยตามสเปก (Master Ratio 0.5x) เกราะจึงเป็น BA_AX_BAR = 35%
     ไม่ใช่ 70% อีกต่อไป · ยังอ่านจากค่าคงที่จริงเหมือนเดิม ไม่ได้พิมพ์เลขทับ
     (precedent: v7.4 พลิกเคสของ test_gm_admin · v7.8 พลิกเคสของ test_menu_icons) */
  ok(kam.bar === kam.want,
     'Heavy Abyssal Barrier = ' + kam.want + '% ของ Max HP (v6.7 ทับ BA_KAM_BAR)', kam.bar);
  ok(/👁️/.test(kam.txt), 'ป้ายชื่อ 👁️ [ชื่ออังกฤษ]', kam.txt);
  ok(/ba-name-secret/.test(kam.cls), 'ใช้คลาส .ba-name-secret', kam.cls);

  const rush = await page.evaluate(() => {
    const out = {};
    for (const f of BA_BOSS_FLOORS) {
      G.floor = f; G.floorProgress = 0; G.locked = false; CD_BAND = cdBandOf(f);
      G.monsterMaxHp = 4000; G.monsterHp = 4000;
      nextMonster();
      out[f] = (baShNow() || {}).id || '';
    }
    return out;
  });
  const rushIds = Object.values(rush);
  ok(new Set(rushIds).size === 5 && rushIds.every(x => /^s2[1-5]$/.test(x)),
     'ประตูบอสทั้งห้าชั้นได้ Kamish คนละท่า (Boss Rush)', rush);

  const push = await page.evaluate(() => ({ tier: baTierNow(), boss: BA_PUSH.boss }));
  ok(push.tier === 'boss' && push.boss === 10, 'ตอบถูกดันเกจถอยได้แค่ 10% (นับเป็นบอส)', push);

  const ctr = await page.evaluate(() => {
    G.hp = G.maxHp; const hp0 = G.hp; G.streak = 7;
    baAfterAnswer(false, false, false, G.currentMonster, 0);
    return { lost: hp0 - G.hp, want: Math.round(G.maxHp * 0.35), streak: G.streak };
  });
  ok(Math.abs(ctr.lost - ctr.want) <= 1, 'Abyssal Counter — ตอบผิดโดนสวน -35% HP', ctr);
  ok(ctr.streak === 0, 'Abyssal Counter ล้างหลอดคอมโบ', ctr.streak);

  const mini = await page.evaluate(() => {
    G.floor = 9; G.floorProgress = 0; G.locked = false; CD_BAND = cdBandOf(9);
    G.monsterMaxHp = 99999; G.monsterHp = 99999;
    nextMonster();
    const e = baShNow();
    return { tier: e ? e.tier : '', id: e ? e.id : '' };
  });
  ok(mini.tier === 'mini', 'ชั้นธรรมดาในเหวลึกได้ทัพเงาลำดับ 1-20', mini);

  const stable = await page.evaluate(() => {
    const a = (baShNow() || {}).id;
    for (let i = 0; i < 6; i++) renderMonster();
    return { a: a, b: (baShNow() || {}).id };
  });
  ok(stable.a === stable.b, 'อสูรไม่เปลี่ยนหน้าเมื่อ renderMonster ถูกเรียกซ้ำ', stable);

  await page.evaluate(() => { G.ab.abyss = false; });

  // ══ 5 · สกิลเฉพาะตัวทั้ง 25 ═══════════════════════════════════════
  say('\n[5] สกิลเฉพาะตัวทั้ง 25');
  const runAll = await page.evaluate(() => {
    const bad = [];
    for (const e of BA_FOES_ABYSS) {
      try { G.hp = G.maxHp; G.gold = 5000; e.sk.run(); }
      catch (err) { bad.push(e.id + ': ' + err.message); }
    }
    baClearFight();
    return bad;
  });
  ok(runAll.length === 0, 'ทั้ง 25 สกิลทำงานจบโดยไม่โยน error', runAll);

  const burst = await page.evaluate(() => {
    const bad = [];
    for (const e of BA_FOES_ABYSS) { try { baFxBurst(e.sk.fx); } catch (err) { bad.push(e.id); } }
    return bad;
  });
  ok(burst.length === 0, 'เอฟเฟกต์ภาพทั้ง 25 ยิงได้', burst);

  const each = await page.evaluate(() => {
    const out = {};
    /* ต้องขึ้นข้อใหม่จริงทุกครั้งก่อนวัด — เคสก่อนหน้าทิ้งปุ่มที่ถูก disable ไว้ได้
       (ปุ่มถูกปิดหลังตัดสินข้อ · ถูกหนามรัด · ถูกกลายเป็นหิน) แล้วเคสที่นับ
       "ปิดไปกี่ปุ่ม" จะได้ 0 ทั้งที่สกิลทำงานถูกต้อง */
    const st = () => {
      G.floor = 7; G.floorProgress = 0; G.locked = false;
      CD_BAND = cdBandOf(7); BA_INC_F = 7; BA_INC_AT = -1; BA_INC_M = null;
      G.monsterMaxHp = 99999; G.monsterHp = 50000;
      nextMonster();
      G.monsterMaxHp = 99999; G.monsterHp = 50000; G.hp = G.maxHp; G.locked = false;
    };
    /* 1 · ควันดำบังการ์ดโจทย์ */
    st(); BA_SH_BY_ID.s1.sk.run();
    out.smoke = document.getElementById('gameScreen').classList.contains('ba-smoke');
    baClearQ();
    /* 4 · ล็อกปิดปุ่ม */
    st(); const n0 = [...document.querySelectorAll('#gChoices .g-choice')].filter(x => !x.disabled).length;
    BA_SH_BY_ID.s4.sk.run();
    out.jail = n0 - [...document.querySelectorAll('#gChoices .g-choice')].filter(x => !x.disabled).length;
    baClearQ();
    /* 5 · ห้ามกด SYSTEM SCAN */
    st(); BA_SH_BY_ID.s5.sk.run();
    out.scanLocked = baShScanLocked();
    const g0 = G.gold; showHint(); out.scanBlocked = (G.gold === g0);
    BA_SH_SCAN = 0;
    /* 9 · เร่งหลอดโจมตีปกติ */
    st(); const bf = baBatFull(); BA_SH_BY_ID.s9.sk.run();
    out.rage = bf / baBatFull(); BA_SH_RAGE = 0;
    /* 10 · ดาเมจฮีโร่ลดลง 50% */
    st(); BA_LIVE = true; const atk0 = hunterAtk();
    BA_SH_BY_ID.s10.sk.run(); out.iron = +(hunterAtk() / atk0).toFixed(2);
    BA_SH_IRN = false; BA_LIVE = false;
    /* 15 · ห้ามคริต */
    st(); BA_SH_BY_ID.s15.sk.run(); BA_LIVE = true;
    out.seal = critChance(); BA_LIVE = false; BA_SH_SEAL = 0;
    /* 17 · ล้างคอมโบ */
    st(); G.streak = 9; BA_SH_BY_ID.s17.sk.run(); out.combo = G.streak;
    /* 18 · เผาทอง */
    st(); G.gold = 900; BA_SH_BY_ID.s18.sk.run(); out.gold = 900 - G.gold;
    /* 19 · โบนัสดาเมจสะสม */
    st(); BA_SH_HRD = 0; const p0 = baBatPct();
    BA_SH_BY_ID.s19.sk.run(); out.horde = baBatPct() > p0; BA_SH_HRD = 0;
    /* 20 · สลับปุ่มไขว้กากบาท */
    st(); const before = [...document.querySelectorAll('#gChoices .g-choice')].map(x => x.dataset.choice);
    BA_SH_BY_ID.s20.sk.run();
    const after = [...document.querySelectorAll('#gChoices .g-choice')].map(x => x.dataset.choice);
    out.invert = before.length > 1 && before.join('|') === after.slice().reverse().join('|');
    /* 25 · ฟื้นเลือด + ประสานเกราะ */
    st(); const hp0 = G.monsterHp; BA_SH_BY_ID.s25.sk.run();
    out.rebirth = G.monsterHp > hp0;
    baClearFight();
    return out;
  });
  ok(each.smoke === true, '1 · Shadow Blind Slash บังการ์ดโจทย์จริง', each.smoke);
  ok(each.jail === 2, '4 · Dual Claw Cleave ปิดตัวเลือก 2 ปุ่ม', each.jail);
  ok(each.scanLocked && each.scanBlocked, '5 · Silence Sigil ห้ามกด SYSTEM SCAN จริง', each);
  ok(each.rage === 2, '9 · Berserk Rampage เร่งหลอดโจมตีปกติ x2', each.rage);
  ok(each.iron === 0.5, '10 · Iron Fortress ลดดาเมจฮีโร่ 50%', each.iron);
  ok(each.seal === 0, '15 · Seal of Precision กดคริตเป็น 0', each.seal);
  ok(each.combo === 0, '17 · Combo Breaker ล้างคอมโบ', each.combo);
  ok(each.gold === 200, '18 · Molten Ruin เผาทอง 200', each.gold);
  ok(each.horde === true, '19 · Shadow Horde เพิ่มดาเมจโจมตีปกติ', each.horde);
  ok(each.invert === true, '20 · Gale Inversion สลับปุ่มไขว้กากบาท', each.invert);
  ok(each.rebirth === true, '25 · Shadow Monarch Rebirth ฟื้นเลือดอสูร', each.rebirth);

  /* ทุกสกิลที่ทำร้ายฮีโร่ต้องผ่าน baHurtHero() ซึ่งสั่งคิวเทิร์นเองถ้าฮีโร่ร่วง
     (กับดักข้อ 19 — สกิลยิงนอกจังหวะ resolveAnswer) */
  const lethal = await page.evaluate(() => {
    G.floor = 7; G.floorProgress = 0; G.locked = false;
    G.monsterMaxHp = 99999; G.monsterHp = 50000;
    G.hp = 2; G.items = {};
    BA_SH_BY_ID.s21.sk.run();
    const r = { hp: G.hp, locked: G.locked, timer: (typeof QUESTION_TIMER !== 'undefined') && !!QUESTION_TIMER };
    baClearFight();
    return r;
  });
  ok(lethal.hp <= 0 && lethal.locked === true && lethal.timer === false,
     'สกิลที่ฆ่าฮีโร่ดับนาฬิกาและล็อกจอให้ครบ (กับดักข้อ 19)', lethal);

  // ══ 6 · ล้างสถานะ ════════════════════════════════════════════════
  say('\n[6] ล้างสถานะ');
  const cleared = await page.evaluate(() => {
    BA_SH_RAGE = Date.now() + 9000; BA_SH_SEAL = Date.now() + 9000;
    BA_SH_SCAN = Date.now() + 9000; BA_SH_IRN = true; BA_SH_HRD = 25; BA_INC_G = 99;
    document.getElementById('gameScreen').classList.add('ba-smoke');
    baClearFight();
    baClearQ();
    return { rage: BA_SH_RAGE, seal: BA_SH_SEAL, scan: BA_SH_SCAN, irn: BA_SH_IRN,
             hrd: BA_SH_HRD, smoke: document.getElementById('gameScreen').classList.contains('ba-smoke'),
             arena: document.getElementById('baArena').className };
  });
  ok(cleared.rage === 0 && cleared.seal === 0 && cleared.scan === 0 && !cleared.irn && cleared.hrd === 0,
     'baClearFight ล้างสถานะทัพเงาครบทุกตัว', cleared);
  ok(cleared.smoke === false, 'baClearQ ล้างควันดำทุกข้อ', cleared.smoke);
  ok(!/ba-invade|ba-shadow/.test(cleared.arena), 'ถอดคลาสบุกรุกออกจากกรอบสนาม', cleared.arena);

  const exited = await page.evaluate(() => {
    BA_INC_F = 5; BA_INC_AT = 1; BA_INC_ID = 's3'; BA_INC_G = 77;
    exitGame();
    return { f: BA_INC_F, at: BA_INC_AT, id: BA_INC_ID, g: BA_INC_G, m: !!BA_INC_M };
  });
  ok(exited.f === -1 && exited.at === -1 && !exited.id && exited.g === 0 && !exited.m,
     'ออกจากเกมแล้วสถานะบุกรุกถูกล้างครบ', exited);

  // ══ 7 · เลย์เอาต์ ════════════════════════════════════════════════
  say('\n[7] เลย์เอาต์และความปลอดภัย');
  const wide = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
  ok(wide, 'ไม่ล้นแนวนอน');
  const veil = await page.evaluate(() => {
    const el = document.getElementById('baVeil');
    const bl = document.getElementById('baBlack');
    const s1 = el ? getComputedStyle(el) : null, s2 = bl ? getComputedStyle(bl) : null;
    return { v: s1 ? s1.pointerEvents : 'none', b: s2 ? s2.pointerEvents : 'none' };
  });
  ok(veil.v === 'none' && veil.b === 'none', 'ม่านเอฟเฟกต์ไม่ขวางการกดปุ่ม', veil);
  /* ชั้นนี้เขียน Error Log ผ่าน baErr() ทุกจุด — ถ้ามีรายการที่ขึ้นต้นด้วย ba
     แปลว่ามี wrapper ตัวไหนโยน error จริงระหว่างเทสต์ ต้องไม่มีเลย */
  const errLog = await page.evaluate(() => {
    try {
      const all = JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [];
      return all.map(x => (x && (x.msg || x.m || x.where || JSON.stringify(x))) || '')
                .filter(t => /shTag|incSync|shRepaint|shAfter|incReward|incGold|kamishBar|scanLockPaint|install66/.test(t));
    } catch (e) { return ['อ่าน Error Log ไม่ได้']; }
  });
  ok(errLog.length === 0, 'ไม่มี error จาก wrapper ของชั้น v6.6 ใน Error Log', errLog);
  ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุด', errs.slice(0, 3));

  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { say('CRASH ' + e.stack); process.exit(2); });
