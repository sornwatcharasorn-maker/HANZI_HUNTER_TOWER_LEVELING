/* test_battle_v65.js — ชุดเทสต์ของชั้น v6.5
   (SYSTEM SCAN ราคาก้าวหน้า · ป้ายชื่อกระชับ · หลอดคู่ · เครื่องเล่นเฟรม 43 เฟรม)

   NODE_PATH=/opt/node22/lib/node_modules node test_battle_v65.js

   ทุกเคสวัดจาก **ไฟล์แจก** ที่รากrepo ตามกติกาของ repo (ต้อง build ก่อนรันเสมอ)   */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_battle_v65.log');
let pass = 0, fail = 0;
function ok(c, m) { (c ? pass++ : fail++); fs.appendFileSync(LOG, (c ? '✅ ' : '❌ ') + m + '\n'); }
function blk(t) { fs.appendFileSync(LOG, '\n── ' + t + ' ──\n'); }

/* กันเน็ตออกนอกเครื่องทุกทาง — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   ไม่ stub = เทสต์ยิงเข้าฐานข้อมูลของห้องเรียนจริง (กติกาเดียวกับชุดของ v5.5/v5.6) */
const STUB = `
  window.__NET = [];
  window.fetch = function (u, o) {
    window.__NET.push(String(u));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null),
                             text: () => Promise.resolve('null') });
  };
  window.EventSource = function () {
    this.close = function () {}; this.readyState = 1;
    setTimeout(() => { if (this.onerror) this.onerror({}); }, 50);
  };
`;

async function enter(page, user) {
  /* เข้าเกมด้วยเส้นทางจริงของนักเรียน — ป๊อปอัปกติกาของ v5.6 บล็อก enterGate ไว้ */
  await page.evaluate(() => {
    const b = document.getElementById('rgBody');
    if (b) b.scrollTop = b.scrollHeight;
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgAck(); } catch (e) { enterGate(); } });
  await page.waitForTimeout(700);
  await page.evaluate((u) => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    document.getElementById('reg-name').value = 'TEST';
    handleSubmit();
  }, user);
  await page.waitForTimeout(900);
  await clearOverlays(page);
}

/* ปิดทุกหน้าต่างที่ค้างอยู่ แล้วพาจอกลับมาที่โจทย์
   **ต้องทำก่อนวัดเสียง/เกจทุกครั้ง** — baFighting() เป็นเท็จทันทีที่มีหน้าต่างเปิดค้าง
   (หน้าต่างจั่วการ์ดของ v4.7 · gate ของ v4.1/v4.6 · ประตูวาปของ v4.9.2) */
async function clearOverlays(page) {
  for (let i = 0; i < 14; i++) {
    const done = await page.evaluate(() => {
      const card = document.querySelector('#cdDraft.active .cd-card');
      if (card) { card.click(); return false; }
      if (document.querySelector('#snGate.active')) { try { snGateConfirm(); } catch (e) {} return false; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { try { warpGo(); } catch (e) {} return false; }
      return !(typeof acOverlayOpen === 'function' && acOverlayOpen());
    });
    await page.waitForTimeout(done ? 60 : 700);
    if (done) break;
  }
  await page.evaluate(() => {
    try { acFocusQa(); acSync(true); } catch (e) {}
  });
  await page.waitForTimeout(120);
}

/* พาไปยืนชั้นที่ต้องการโดยไม่ต้องไต่จริง */
async function goFloor(page, f) {
  await page.evaluate((fl) => {
    G.floor = fl;
    G.maxFloor = Math.max(G.maxFloor || 1, fl);
    G.floorProgress = 0;
    if (typeof CD_BAND !== 'undefined') CD_BAND = cdBandOf(fl);   /* กันหน้าต่างจั่วเด้ง */
    /* ปิดระบบบุกรุกของชั้น v6.6 — ทัพเงามีโอกาส 15% ต่อชั้นที่จะมายืนแทนอสูร
       ประจำชั้น ซึ่งถูกต้องตามกติกา แต่ทำให้ชุดนี้ (ที่พิสูจน์ป้ายชื่อ/เกจของ v6.5)
       ตกแบบสุ่มโดยไม่มีอะไรพังจริง · ปั๊ม BA_INC_F ให้ตรงชั้น = ลูกเต๋าถูกทอยแล้ว
       จะไม่ถูกทอยซ้ำใน baIncSync (ชุดของ v6.6 เป็นคนพิสูจน์การบุกรุกเอง) */
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = fl; BA_INC_AT = -1; BA_INC_M = null; }
    recalcStats();
    nextMonster();
  }, f);
  await page.waitForTimeout(260);
  await clearOverlays(page);
}

(async () => {
  fs.writeFileSync(LOG, 'test_battle_v65 · ' + new Date().toISOString() + '\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await enter(page, 'v65a');

  // ═══ 1) เครื่องเล่นเฟรมฮีโร่ ═══════════════════════════════════════
  blk('1 · เครื่องเล่นเฟรมฮีโร่');
  await page.waitForFunction(() => {
    const f = document.querySelectorAll('#baArena .ba-hero .ba-fig');
    return f.length > 0 && [].every.call(f, i => i.complete && i.naturalWidth > 0);
  }, { timeout: 20000 }).catch(() => {});

  const fr = await page.evaluate(() => ({
    figs: document.querySelectorAll('#baArena .ba-hero .ba-fig').length,
    on: document.querySelectorAll('#baArena .ba-hero .ba-fig.on').length,
    decoded: [].every.call(document.querySelectorAll('#baArena .ba-hero .ba-fig'),
                           i => i.complete && i.naturalWidth > 0),
    hero: BA_HERO.length,
    ids: BA_HERO.filter(f => f && f.id).length,
    audit: baFrameAudit()._hero,
    anim: baBattleAudit().anim
  }));
  /* ตั้งแต่ชั้น v6.6 embed_hero_art.py ฝังเฉพาะเฟรมที่ BA_ANIM อ้างถึงจริง (33 เฟรม)
     อีก 10 เฟรมที่ไม่มีลำดับไหนเรียกใช้ถูกตัดออกเพื่อคืนที่ ~27KB ให้ทัพเงา 25 ตัว
     **เกณฑ์ที่ถูกคือ "ทุกเฟรมที่ลำดับอ้างถึงต้องมีอยู่จริง" ไม่ใช่ "ต้องมี 43 ใบ"**
     (สั่ง `python3 embed_hero_art.py --all` เพื่อฝังครบทุกเฟรมเหมือนเดิม) */
  ok(fr.figs === fr.hero && fr.figs > 0,
     'แขวนเฟรมฮีโร่ครบเท่าที่ฝังไว้ (ได้ ' + fr.figs + '/' + fr.hero + ')');
  ok(fr.ids === fr.hero, 'ทุกเฟรมมีชื่อกำกับ (ได้ ' + fr.ids + '/' + fr.hero + ')');
  ok(fr.anim.missing === 0,
     'ไม่มีลำดับไหนอ้างถึงเฟรมที่ไม่ได้ฝัง (ขาด ' + fr.anim.missing + ')');
  ok(fr.decoded, 'ทุกเฟรม decode ได้จริง (data URI ไม่เสีย)');
  ok(fr.on === 1, 'โชว์ทีละเฟรมเดียวเสมอ (ได้ ' + fr.on + ')');
  ok(fr.audit.total === fr.audit.used && fr.audit.act >= 1,
     'เฟรมถูกจัดหมวดครบ ' + fr.audit.total + ' (ยืน ' + fr.audit.idle + ' · อื่น ' + fr.audit.act + ')');
  ok(fr.anim.seq === 6, 'มีลำดับแอนิเมชันครบ 6 ชุด (ได้ ' + fr.anim.seq + ')');
  ok(fr.anim.missing === 0, 'ทุกเฟรมที่ลำดับอ้างถึงมีอยู่จริง (ขาด ' + fr.anim.missing + ')');

  /* เฟรมต้องขยับเองตลอดเวลา — เก็บดัชนีเฟรมที่โชว์ทุก 120ms */
  const seen = new Set();
  for (let i = 0; i < 22; i++) {
    seen.add(await page.evaluate(() => BA_FRAME));
    await page.waitForTimeout(120);
  }
  ok(seen.size >= 3, 'ท่ายืนวนหลายเฟรมเองตลอดเวลา (เห็น ' + seen.size + ' เฟรม)');

  /* อสูรต้องวนลูปเฟรมของตัวเองด้วย — ใช้ชั้นที่อสูรมีหลายเฟรม */
  await goFloor(page, 3);
  const foeSeen = new Set();
  for (let i = 0; i < 20; i++) {
    foeSeen.add(await page.evaluate(() => BA_FOE_FR));
    await page.waitForTimeout(120);
  }
  const foeN = await page.evaluate(() => (BA_MON[BA_FOE_ID] || []).length);
  ok(foeN < 2 || foeSeen.size >= 2,
     'อสูรวนลูปเฟรมเอง (มี ' + foeN + ' เฟรม · เห็น ' + foeSeen.size + ')');

  /* ห้ามแตะ Math.random (กับดักข้อ 32) */
  const rnd = await page.evaluate(() => {
    const r = Math.random; let n = 0;
    Math.random = function () { n++; return r.apply(this, arguments); };
    try {
      for (let i = 0; i < 8; i++) { BA_ACT_TO = 0; baAct(120); }
      for (let i = 0; i < 8; i++) { baSeqPlay('critical_strike', 120); }
      baHeroPose(); baFoeCycle();
    } finally { Math.random = r; }
    return n;
  });
  ok(rnd === 0, 'เครื่องเล่นเฟรมไม่แตะ Math.random สักครั้ง (เรียกไป ' + rnd + ')');

  // ═══ 2) ป้ายชื่ออสูรแบบกระชับ ══════════════════════════════════════
  blk('2 · ป้ายชื่ออสูร');
  const want = [
    [1, '🟢', 'Undead', 'ba-name-normal'],
    [3, '🟣', 'Undead', 'ba-name-elite'],
    [4, '👑', 'Stone Gargoyle', 'ba-name-boss'],
    [12, '👑', 'Archivist Lich', 'ba-name-boss'],
    [20, '🔥', 'Crystal Monarch Dragon', 'ba-name-boss']
  ];
  for (const [f, ico, name, cls] of want) {
    await goFloor(page, f);
    const d = await page.evaluate(() => {
      const n = document.getElementById('baFoeName');
      const st = getComputedStyle(n);
      return { t: n.textContent, c: n.className, align: st.textAlign,
               w: n.scrollWidth, box: n.clientWidth, color: st.color };
    });
    ok(d.t.indexOf(ico) === 0, 'ชั้น ' + f + ' ขึ้นต้นด้วย ' + ico + ' (ได้ "' + d.t + '")');
    ok(d.t.indexOf(name) >= 0, 'ชั้น ' + f + ' โชว์ชื่ออังกฤษ ' + name);
    ok(!/[ก-๙]/.test(d.t), 'ชั้น ' + f + ' ไม่มีภาษาไทยปนบนป้าย');
    ok(d.c.indexOf(cls) >= 0, 'ชั้น ' + f + ' ได้คลาส ' + cls);
    ok(d.align === 'right', 'ชั้น ' + f + ' ชิดขวา');
    ok(d.w <= d.box + 1, 'ชั้น ' + f + ' ชื่อไม่ล้นป้าย (' + d.w + '/' + d.box + 'px)');
  }
  await goFloor(page, 20);
  const secret = await page.evaluate(() => {
    G.ab = G.ab || {}; G.ab.abyss = true;
    /* **Patch v8.3 · ทัพเงาผูกกับลำดับ account.ax.idx ไม่ผูกกับชั้นแล้ว**
       ป้าย 👁️ บอสลับเป็นของ Kamish (21-25) จึงต้องตั้งลำดับเองก่อนวาดป้าย */
    if (typeof baAxMine === 'function' && baAxMine()) baAxMine().idx = 23;
    baNamePaint();
    const n = document.getElementById('baFoeName');
    const r = { t: n.textContent, c: n.className };
    G.ab.abyss = false; baNamePaint();
    return r;
  });
  /* ตั้งแต่ชั้น v6.6 โหมดเหวลึกเป็นบ้านของทัพเงา 25 ตัว ชื่อบนป้ายจึงเป็นชื่อของ
     ตัวที่ยืนอยู่จริง (Kamish ที่ชั้นบอส · ทัพเงาลำดับ 1-20 ที่ชั้นอื่น)
     ไม่ใช่ 'Void Sovereign' ของ v6.5 ซึ่งเป็นค่าตกกลับตอนยังไม่มีทัพเงา
     **สิ่งที่ยังต้องคงเดิมคือไอคอน 👁️ กับคลาส ba-name-secret** */
  ok(secret.t.indexOf('👁️') === 0 && secret.t.length > 3,
     'โหมดเหวลึกได้ป้าย 👁️ พร้อมชื่อบอสลับ (ได้ "' + secret.t + '")');
  ok(secret.c.indexOf('ba-name-secret') >= 0, 'โหมดเหวลึกได้คลาส ba-name-secret');

  // ═══ 3) SYSTEM SCAN — ราคาก้าวหน้า ════════════════════════════════
  blk('3 · SYSTEM SCAN');
  /* **ราคาก้าวหน้าตามชั้น + ทวีคูณในชั้นเดิม ถูกชั้น v8.5 แทนที่ด้วยราคาคงที่
     🪙 5,000 ตามสเปกโดยเจตนา** (precedent การพลิกเคส: v7.4 · v7.8 · v7.9 · v8.1-v8.4)
     สิ่งที่เคสชุดนี้ยังต้องพิสูจน์คือ **ราคาบนปุ่มกับยอดที่หักจริงเป็นค่าเดียวกันเสมอ**
     และ **ตรรกะเฉลยของเดิมไม่ถูกแตะ** ซึ่งเป็นข้อกำหนดของสเปกตรง ๆ (keep legacy logic) */
  const FLAT = 5000;
  for (const f of [1, 2, 3, 4, 5, 7, 9, 11, 12, 13, 15, 17, 19, 20]) {
    await goFloor(page, f);
    const got = await page.evaluate(() => baScanPrice());
    ok(got === FLAT, 'ชั้น ' + f + ' ราคาคงที่ ' + FLAT + ' (ได้ ' + got + ')');
  }

  await goFloor(page, 1);
  const mul = await page.evaluate(() => {
    G.gold = 999999; renderStats();
    const out = [baScanPrice()];
    for (let i = 0; i < 3; i++) {
      showHint(); closeHint();
      out.push(baScanPrice());
    }
    return out;
  });
  ok(mul.every(v => v === FLAT),
     'กดซ้ำในชั้นเดิมราคาไม่ทวีคูณอีกแล้ว (ได้ ' + mul.join('→') + ')');

  await goFloor(page, 2);
  const reset = await page.evaluate(() => baScanPrice());
  ok(reset === FLAT, 'ข้ามชั้นแล้วราคายังคงที่ (ได้ ' + reset + ')');

  /* ยอดที่หักจริงต้องเท่ากับราคาบนปุ่มเป๊ะ — จุดที่พังง่ายที่สุดของการตรึงราคา */
  const spend = await page.evaluate(() => {
    G.gold = 999999; renderStats();
    const before = G.gold;
    showHint(); closeHint();
    return before - G.gold;
  });
  ok(spend === FLAT, 'หักทองจริงเท่าราคาบนปุ่ม (หักไป ' + spend + ')');

  const label = await page.evaluate(() => {
    G.gold = 999999; renderStats();
    const b = baScanBtn();
    return { txt: b.textContent, img: b.querySelectorAll('img').length, dis: b.disabled };
  });
  ok(/SYSTEM SCAN/.test(label.txt) && /5,000/.test(label.txt),
     'ปุ่มโชว์ราคาจริง (ได้ "' + label.txt.trim() + '")');
  ok(label.img >= 1, 'ไอคอนภาพของ v5.9 ยังอยู่บนปุ่ม (ได้ ' + label.img + ')');
  ok(!label.dis, 'ทองพอ = ปุ่มกดได้');

  await page.evaluate(() => { G.gold = 10; renderStats(); });
  /* **ต้องรอให้ transition ของปุ่มจบก่อนวัด** — .g-btn มี transition อยู่แล้ว
     อ่าน getComputedStyle ทันทีที่เพิ่งเติมคลาสจะได้ "ค่าเริ่มต้นของทรานซิชัน"
     (opacity 1 · grayscale(0)) ซึ่งไม่ใช่ค่าปลายทาง */
  await page.waitForTimeout(420);
  const poor = await page.evaluate(() => {
    const b = baScanBtn();
    const st = getComputedStyle(b);
    return { dis: b.disabled, cls: b.className, op: parseFloat(st.opacity) };
  });
  ok(poor.dis, 'ทองไม่พอ = ปุ่มถูกปิด');
  ok(poor.cls.indexOf('ba-poor') >= 0 && poor.op < 0.6,
     'ทองไม่พอ = ปุ่มหรี่ลง (opacity ' + poor.op + ')');

  const guard = await page.evaluate(() => {
    const g0 = G.gold;
    showHint();
    return { gold: G.gold, same: G.gold === g0,
             open: document.getElementById('gModal').classList.contains('active') };
  });
  ok(guard.same && !guard.open, 'ทองไม่พอแล้วกด = ไม่เสียทองและไม่เปิดเฉลย');

  // ═══ 4) บทลงโทษของข้อที่กดเฉลย ════════════════════════════════════
  blk('4 · บทลงโทษเมื่อกดเฉลย');
  await goFloor(page, 1);
  const pen = await page.evaluate(async () => {
    G.gold = 999999; G.hp = G.maxHp; ba_crit = 80; G.streak = 4;
    const best = G.bestStreak || 0;
    baCritPaint();
    showHint(); closeHint();
    const critAfter = ba_crit;
    const scanned = BA_SCAN_Q;
    const st = G.streak;
    G.questionStart = Date.now();          /* ตอบไวมาก = ปกติต้องได้โบนัสความไว */
    const m = G.currentMonster;
    resolveAnswer(m.answer, null, false);
    return { critAfter, scanned, streakBefore: st, streakAfter: G.streak,
             best: G.bestStreak || 0, best0: best, crit: ba_crit };
  });
  ok(pen.critAfter === 0, 'กดเฉลยแล้วเกจคริตถูกรีเซ็ตเป็น 0 ทันที (ได้ ' + pen.critAfter + ')');
  ok(pen.scanned, 'ธง "ข้อนี้กดเฉลยแล้ว" ถูกปั๊ม');
  ok(pen.streakAfter === pen.streakBefore,
     'ข้อที่กดเฉลยไม่นับเพิ่มคอมโบ (' + pen.streakBefore + '→' + pen.streakAfter + ')');
  ok(pen.best <= pen.best0, 'สถิติคอมโบสูงสุดไม่ถูกดันขึ้นด้วย');
  /* ตอบไวปกติได้ BA_CRIT_FAST (35) · ถูกตัดเหลือ BA_CRIT_SLOW (15)
     ส่วน +5 ของคอมโบยังได้อยู่ เพราะสตรีคที่ ≥3 เป็นของที่สะสมมาก่อนหน้าแล้ว
     ไม่ใช่ "โบนัสความไว" ที่สเปกสั่งให้ตัด */
  ok(pen.crit === 20,
     'ข้อที่กดเฉลยได้แต้มเกจแบบตอบช้า ไม่ได้โบนัสความไว (ได้ ' + pen.crit + ' · คาด 20)');

  await clearOverlays(page);
  const cleared = await page.evaluate(() => {
    startQuestionTimer();
    return BA_SCAN_Q;
  });
  ok(cleared === false, 'ขึ้นข้อใหม่แล้วธงถูกล้าง');

  // ═══ 5) หลอดคู่ ═══════════════════════════════════════════════════
  blk('5 · หลอดโจมตีปกติ + หลอดท่าไม้ตาย');
  const bars = await page.evaluate(() => {
    const a = document.getElementById('baAtbBar');
    const b = document.getElementById('baBatBar');
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const row = document.querySelector('#baArena .ba-row').getBoundingClientRect();
    const ar = document.getElementById('baArena').getBoundingClientRect();
    return { both: !!(a && b), overlap: rb.right > ra.left + 1,
             sameTop: Math.abs(ra.top - rb.top) < 1,
             inside: ra.bottom <= ar.bottom + 0.6 && rb.bottom <= ar.bottom + 0.6,
             belowRow: rb.top >= row.bottom - 0.6 };
  });
  ok(bars.both, 'มีหลอดครบสองใบ');
  ok(!bars.overlap, 'หลอดสองใบไม่ทับกัน');
  ok(bars.sameTop, 'หลอดสองใบอยู่ระดับเดียวกัน (ไม่ได้ต่อลงล่าง)');
  ok(bars.inside, 'หลอดทั้งคู่ยังอยู่ในกรอบสนาม ไม่ถูกตัดหัวท้าย');
  ok(bars.belowRow, 'หลอดอยู่ใต้แถวนักสู้ตามเดิม');

  const spd = await page.evaluate(() => {
    const out = [];
    for (const f of [1, 5, 9, 13, 17]) { G.floor = f; out.push([baBatFull(), baBatPct()]); }
    G.ab = G.ab || {}; G.ab.abyss = true;
    const ab = [baBatFull(), baBatPct()];
    G.ab.abyss = false; G.floor = 1;
    return { out, ab };
  });
  ok(JSON.stringify(spd.out) === JSON.stringify([[4500, 12], [4000, 15], [3500, 18], [3000, 22], [2500, 25]]),
     'ตารางหลอดโจมตีปกติตรงสเปกทุกโซน (ได้ ' + JSON.stringify(spd.out) + ')');
  ok(spd.ab[0] === 2000 && spd.ab[1] === 30, 'โหมดเหวลึก 2.0 วิ · -30% HP');

  const ult = await page.evaluate(() => {
    const out = [];
    for (const f of [1, 5, 9, 13, 17]) { G.floor = f; out.push(baAtbFull()); }
    G.floor = 1;
    return { out, push: JSON.parse(JSON.stringify(BA_PUSH)) };
  });
  ok(JSON.stringify(ult.out) === JSON.stringify([12000, 10000, 9000, 7000, 6000]),
     'หลอดท่าไม้ตายยังใช้สูตรเดิมของ v6.3 (ได้ ' + JSON.stringify(ult.out) + ')');
  ok(ult.push.normal === 20 && ult.push.elite === 15 && ult.push.boss === 10,
     'Pushback ของหลอดท่าไม้ตายยังเป็น 20/15/10');

  await goFloor(page, 1);
  await clearOverlays(page);
  const run = await page.evaluate(async () => {
    BA_BAT = 0; BA_ATB = 0;
    const t0 = Date.now();
    await new Promise(r => setTimeout(r, 1400));
    return { bat: BA_BAT, atb: BA_ATB, ms: Date.now() - t0, fighting: baFighting() };
  });
  ok(run.fighting, 'อยู่ในสถานะสู้จริงตอนวัด');
  ok(run.bat > 12 && run.bat < 60, 'เกจโจมตีปกติเดินจริง (' + run.bat.toFixed(1) + '% ใน ' + run.ms + 'ms)');
  ok(run.atb > 3 && run.atb < run.bat, 'เกจท่าไม้ตายเดินช้ากว่าเกจโจมตีปกติ (' + run.atb.toFixed(1) + '%)');

  /* **ต้องตอบช้ากว่า BA_PR_MS (1.0 วิ) ของ v6.9** ไม่งั้น Parry Strike จะดันเกจ
     ถอยเพิ่มอีก 30% แล้วเคสนี้จะวัดแรงดันของ v6.5 ปนกับของ v6.9 (90→35 แทน 90→65) */
  const push = await page.evaluate(() => {
    BA_BAT = 90;
    const before = BA_BAT;
    G.questionStart = Date.now() - 2500;
    const m = G.currentMonster;
    resolveAnswer(m.answer, null, false);
    return { before, after: BA_BAT };
  });
  ok(Math.abs((push.before - push.after) - 25) < 6,
     'ตอบถูกดันเกจโจมตีปกติถอย ~25% (' + push.before + '→' + push.after.toFixed(1) + ')');

  await clearOverlays(page);
  /* ปิดหน้าต่าง Parry ของ v6.9 ก่อนเสมอ — ระหว่างหน้าต่างนั้นเทิร์นโจมตีของอสูร
     ถูกยกเลิกโดยเจตนา ถ้าไม่ปิดจะวัดได้ว่า "อสูรไม่ฟาด" ทั้งที่ระบบทำงานถูก */
  const fire = await page.evaluate(async () => {
    if (typeof BA_PR_UNTIL !== 'undefined') BA_PR_UNTIL = 0;
    G.streak = 0;   /* Shadow Ward ของ v6.9 หักดาเมจที่รับ 15% ตั้งแต่คอมโบ 5 */
    G.hp = G.maxHp;
    const hp0 = G.hp;
    BA_BAT = 99.9;
    await new Promise(r => setTimeout(r, 900));
    return { hp0, hp: G.hp, want: Math.round(G.maxHp * 0.12), bat: BA_BAT };
  });
  ok(fire.hp < fire.hp0, 'เกจเต็มแล้วอสูรฟาดจริง (HP ' + fire.hp0 + '→' + fire.hp + ')');
  ok(Math.abs((fire.hp0 - fire.hp) - fire.want) <= 2,
     'ดาเมจโจมตีปกติ = 12% ของหลอดในโซน 1 (เสีย ' + (fire.hp0 - fire.hp) + ' · คาด ' + fire.want + ')');
  ok(fire.bat < 50, 'ฟาดแล้วเกจเริ่มนับรอบใหม่ (ได้ ' + fire.bat.toFixed(1) + '%)');

  // ═══ 6) เลย์เอาต์ต้องไม่ขยับ ═══════════════════════════════════════
  blk('6 · เลย์เอาต์');
  /* ขึ้นข้อใหม่สด ๆ ก่อนวัดเสมอ — #gQuestion ถูกประกอบใหม่ตอน nextMonster()
     ถ้าวัดต่อจากข้อที่เพิ่งตอบไป ข้อความที่ค้างอยู่จะดันการ์ดสูงขึ้น
     แล้วตัวเลขจะไม่เทียบกับ verify_arena.js ได้ */
  await goFloor(page, 1);
  /* **ต้องบังคับคำศัพท์ให้คงที่ก่อนวัดเสมอ** — ความสูงการ์ดขึ้นกับความยาวตัวเลือก
     ซึ่งสุ่มใหม่ทุกข้อ ถ้าไม่ตรึงไว้ตัวเลขจะแกว่งโดยไม่เกี่ยวกับโค้ดเลย
     (กติกาเดียวกับ verify_arena.js — ใช้คำที่ยาวที่สุดใน VOCAB เป็นเคสหนักสุด) */
  await page.evaluate(() => {
    const m = G.currentMonster;
    m.word = '北京语言大学';
    m.pinyin = 'Běijīng Yǔyán Dàxué';
    m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
    m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
    document.getElementById('gWord').textContent = m.word;
    document.getElementById('gPinyin').textContent = m.pinyin;
    renderChoices();
    /* บรรทัดผลลัพธ์อยู่ในการ์ดโจทย์ — ข้อความยาวจากการตอบรอบก่อนดันการ์ดสูงขึ้นได้
       verify_arena.js วัดตอนยังไม่เคยตอบ จึงต้องล้างให้อยู่สภาพเดียวกันก่อนเทียบ */
    const fb = document.getElementById('gFeedback');
    if (fb) fb.textContent = '';
  });
  await page.waitForTimeout(250);
  const lay = await page.evaluate(() => {
    const card = document.querySelector('.g-monster-area') ||
                 document.querySelector('#baArena').parentElement;
    const battle = document.querySelector('.ac-battle') ||
                   document.querySelector('.g-battle-card');
    const ar = document.getElementById('baArena').getBoundingClientRect();
    const row = document.querySelector('#baArena .ba-row').getBoundingClientRect();
    const core = document.getElementById('baCore').getBoundingClientRect();
    return {
      arena: Math.round(ar.height),
      card: battle ? Math.round(battle.getBoundingClientRect().height * 10) / 10 : 0,
      gap: Math.round((row.top - core.bottom) * 10) / 10,
      overflowX: document.body.scrollWidth <= window.innerWidth,
      choices: document.querySelectorAll('#gChoices .g-choice').length
    };
  });
  ok(lay.arena === 170, 'กรอบสนามยังสูง 170px เท่าเดิม (ได้ ' + lay.arena + ')');
  ok(Math.abs(lay.card - 340.8) < 1.5, 'การ์ดโจทย์ยังสูง ~340.8px (ได้ ' + lay.card + ')');
  ok(lay.gap >= 0, 'แถวนักสู้ยังไม่ชนขอบล่างแถบโจทย์ (เหลือ ' + lay.gap + 'px)');
  ok(lay.overflowX, 'ไม่ล้นแนวนอน');
  ok(lay.choices === 4, 'ตัวเลือกยังครบ 4 ปุ่ม');

  ok(errs.length === 0, 'ไม่มี pageerror (' + errs.slice(0, 2).join(' | ') + ')');

  fs.appendFileSync(LOG, '\n=== ผ่าน ' + pass + ' · ตก ' + fail + ' ===\n');
  console.log('pass=' + pass + ' fail=' + fail + ' → ' + LOG);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
