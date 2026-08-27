/* test_combo_reflex.js — ชุดเทสต์ของชั้น v6.9
   (Combo Milestone Passives · Perfect Speed Reflex)

   NODE_PATH=/opt/node22/lib/node_modules node test_combo_reflex.js

   ทุกเคสวัดจาก **ไฟล์แจก** ที่รากrepo ตามกติกาของ repo (ต้อง build ก่อนรันเสมอ)   */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_combo_reflex.log');
let pass = 0, fail = 0;
function ok(c, m) { (c ? pass++ : fail++); const l = (c ? '✅ ' : '❌ ') + m; fs.appendFileSync(LOG, l + '\n'); console.log(l); }
function blk(t) { fs.appendFileSync(LOG, '\n── ' + t + ' ──\n'); console.log('\n── ' + t + ' ──'); }

/* กันเน็ตออกนอกเครื่องทุกทาง — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส */
const STUB = `
  window.__NET = [];
  window.fetch = function (u) {
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
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
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
  await page.evaluate(() => { try { acFocusQa(); acSync(true); } catch (e) {} });
  await page.waitForTimeout(120);
}

/* พาไปยืนชั้นที่ต้องการโดยไม่ต้องไต่จริง
   **ปิดระบบบุกรุกของ v6.6 ทุกครั้ง** (กติกาเดิมของชุด v6.2/v6.3/v6.5/v6.7/v6.8) */
async function goFloor(page, f, opt) {
  await page.evaluate((a) => {
    const fl = a.f;
    G.practiceMode = !!a.practice;
    G.floor = fl;
    G.maxFloor = Math.max(G.maxFloor || 1, fl);
    G.floorProgress = 0;
    G.hp = G.maxHp; G.shield = 0; G.streak = 0;
    if (typeof CD_BAND !== 'undefined') CD_BAND = cdBandOf(fl);
    if (typeof CD_CARD !== 'undefined') CD_CARD = null;
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = fl; BA_INC_AT = -1; BA_INC_M = null; }
    recalcStats();
    nextMonster();
  }, { f: f, practice: !!(opt && opt.practice) });
  await page.waitForTimeout(300);
  await clearOverlays(page);
}

async function audit(page) { return await page.evaluate(() => baBattleAudit()); }

/* ตั้งคอมโบแล้วให้แถบไอคอน/ธงบัฟตามให้ทัน */
async function setCombo(page, n) {
  await page.evaluate((v) => { G.streak = v; renderStats(); baCbSync(); }, n);
  await page.waitForTimeout(60);
}

(async () => {
  fs.writeFileSync(LOG, 'test_combo_reflex · ' + new Date().toISOString() + '\n');
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
  await enter(page, 'cb01');

  // ═══ 1) ค่าคงที่ตรงสเปกทุกตัว ═══════════════════════════════════════
  blk('1 · ค่าคงที่ของสเปก');
  const K = await page.evaluate(() => ({
    w: [BA_CB_W1, BA_CB_W2, BA_CB_W3, BA_CB_W4], cap: BA_CB_CAP,
    ward: BA_CB_WARD, keep: BA_CB_KEEP, pierce: BA_CB_PIERCE, vamp: BA_CB_VAMP,
    prMs: BA_PR_MS, prPush: BA_PR_PUSH, prWin: BA_PR_WIN,
    fastMs: BA_FAST_MS,
    en: BA_CB_DEF.map(d => d.en), at: BA_CB_DEF.map(d => d.at),
    desc: BA_CB_DEF.map(d => d.desc).join(' | ')
  }));
  ok(K.w.join(',') === '5,10,15,20', 'ขั้นคอมโบ 5/10/15/20 ตามสเปก [' + K.w.join(',') + ']');
  ok(K.cap === 25, 'หยุดสเกลบัฟที่คอมโบ x25 [' + K.cap + ']');
  ok(K.ward === 15, 'Shadow Ward ลดดาเมจ 15% [' + K.ward + ']');
  ok(K.keep === 5, 'Combo Shield ลดคอมโบแค่ -5 [' + K.keep + ']');
  ok(K.pierce === 50, 'Abyssal Pierce เจาะเกราะ 50% [' + K.pierce + ']');
  ok(K.vamp === 5, 'Vampiric Monarch ดูดเลือด 5% Max HP [' + K.vamp + ']');
  ok(K.prMs === 1000, 'Perfect Speed Reflex เส้นแบ่ง 1.0 วิ [' + K.prMs + ']');
  ok(K.prPush === 30, 'Parry ดันเกจถอย 30% [' + K.prPush + ']');
  ok(K.fastMs === 3000 && K.prMs !== K.fastMs,
     'เส้น 1.0 วิ แยกจากเส้น "ตอบไว" 3 วิ ของ v6.3 [' + K.prMs + '/' + K.fastMs + ']');
  ok(K.en.join(',') === 'Shadow Ward,Clarity Mind,Abyssal Pierce,Vampiric Monarch',
     'ชื่อบัฟครบสี่ขั้นตามสเปก');
  ok(K.at.join(',') === '5,10,15,20', 'สารบัญบัฟผูกกับค่าคงที่เดียวกัน');
  ok(/15%/.test(K.desc) && /50%/.test(K.desc) && /5% Max HP/.test(K.desc) && /x25/.test(K.desc),
     'ข้อความบนไอคอน/แบนเนอร์ประกอบจากค่าคงที่เอง (เลขบนจอตรงกับที่ทำงานจริง)');

  // ═══ 2) บันไดขั้นบัฟ ════════════════════════════════════════════════
  blk('2 · บันไดขั้นบัฟตามคอมโบ');
  await goFloor(page, 2);
  const ladder = [[0, 0], [4, 0], [5, 1], [9, 1], [10, 2], [14, 2], [15, 3], [19, 3], [20, 4], [25, 4], [40, 4]];
  for (const [n, want] of ladder) {
    await setCombo(page, n);
    const a = await audit(page);
    ok(a.combo.lv === want, 'คอมโบ x' + n + ' → ขั้น ' + want + ' [' + a.combo.lv + ']');
  }
  await setCombo(page, 40);
  const capA = await audit(page);
  ok(capA.combo.combo === 25, 'คอมโบเกิน 25 ถูกหนีบไว้ที่ 25 (หยุดสเกล) [' + capA.combo.combo + ']');

  // ═══ 3) แถบไอคอนแสดงสถานะบัฟ ═══════════════════════════════════════
  blk('3 · แถบไอคอนแสดงสถานะบัฟ');
  await setCombo(page, 0);
  let a = await audit(page);
  ok(a.combo.shown === false, 'คอมโบ 0 = ไม่มีแถบไอคอน');
  await setCombo(page, 5);
  a = await audit(page);
  ok(a.combo.shown === true && a.combo.icons === 2, 'คอมโบ 5 = ป้ายคอมโบ + ไอคอน 1 ใบ [' + a.combo.icons + ']');
  await setCombo(page, 15);
  a = await audit(page);
  ok(a.combo.icons === 5, 'คอมโบ 15 = ป้าย + ไอคอน 3 ใบ + โล่ [' + a.combo.icons + ']');
  await setCombo(page, 20);
  a = await audit(page);
  ok(a.combo.icons === 6, 'คอมโบ 20 = ป้าย + ไอคอน 4 ใบ + โล่ [' + a.combo.icons + ']');
  const txt = await page.evaluate(() => (document.getElementById('baCombo') || {}).textContent || '');
  ok(/COMBO x20/.test(txt), 'ป้ายบนแถบบอกคอมโบปัจจุบัน [' + txt + ']');
  const pos = await page.evaluate(() => {
    const el = document.getElementById('baCombo');
    const py = document.getElementById('gPinyin');
    const ch = document.getElementById('gChoices');
    const ar = document.getElementById('baArena');
    if (!el || !py || !ar) return null;
    const a = ar.getBoundingClientRect(), e = el.getBoundingClientRect();
    const p = py.getBoundingClientRect(), c = ch ? ch.getBoundingClientRect() : null;
    return { py: Math.round(p.bottom - e.top),
             ch: c ? Math.round(e.bottom - c.top) : -999,
             inside: (e.top >= a.top - 1 && e.bottom <= a.bottom + 1) };
  });
  ok(pos && pos.py <= 0, 'แถบไอคอนไม่คร่อมพินอิน [' + (pos ? pos.py : 'n/a') + 'px]');
  ok(pos && pos.ch <= 0, 'แถบไอคอนไม่คร่อมแถวตัวเลือก [' + (pos ? pos.ch : 'n/a') + 'px]');
  ok(pos && pos.inside === true, 'แถบไอคอนอยู่ในกรอบสนามรบ (absolute · ไม่ดันเลย์เอาต์)');

  // ═══ 4) ขั้น I · Shadow Ward ═══════════════════════════════════════
  blk('4 · ขั้น I · Shadow Ward ลดดาเมจ 15%');
  await goFloor(page, 12);
  const w0 = await page.evaluate(() => { G.streak = 0; return wrongDamage(); });
  const w5 = await page.evaluate(() => { G.streak = 5; return wrongDamage(); });
  ok(w0 > 0 && w5 === Math.max(1, Math.round(w0 * 0.85)),
     'wrongDamage ลดลง 15% ตอนคอมโบ ≥5 [' + w0 + ' → ' + w5 + ']');
  const w4 = await page.evaluate(() => { G.streak = 4; return wrongDamage(); });
  ok(w4 === w0, 'คอมโบ 4 ยังไม่ลดดาเมจ [' + w4 + ']');
  const hurt = await page.evaluate(() => {
    G.streak = 5; G.hp = G.maxHp; G.shield = 0;
    const b = G.hp; const got = baHurtHero(100);
    return { got: got, lost: b - G.hp };
  });
  ok(hurt.got === 85 && hurt.lost === 85, 'baHurtHero(100) เหลือ 85 ตอนคอมโบ ≥5 [' + hurt.got + ']');
  const hurt0 = await page.evaluate(() => {
    G.streak = 0; G.hp = G.maxHp;
    const b = G.hp; baHurtHero(100); return b - G.hp;
  });
  ok(hurt0 === 100, 'คอมโบ 0 รับดาเมจเต็ม 100 [' + hurt0 + ']');
  /* ตอบผิดจริง — v4.0 ล้าง G.streak เป็น 0 ก่อนเรียก wrongDamage() หนึ่งบรรทัด
     ภาพนิ่งที่ล็อกไว้ก่อนเข้า resolveAnswer จึงเป็นตัวเดียวที่ทำให้บัฟทำงานได้ */
  const real = await page.evaluate(() => {
    const out = {};
    for (const s of [0, 5]) {
      G.streak = s; G.hp = G.maxHp; G.shield = 0; G.locked = false;
      G.monsterMaxHp = 999999; G.monsterHp = 999999;
      const m = G.currentMonster;
      const b = G.hp;
      resolveAnswer(m.choices.filter(c => c !== m.answer)[0], null, false);
      out[s] = b - G.hp;
    }
    return out;
  });
  await page.waitForTimeout(2000);
  await clearOverlays(page);
  ok(real[0] > 0 && real[5] < real[0],
     'ตอบผิดจริงเสีย HP น้อยลงตอนคอมโบ ≥5 [' + real[0] + ' → ' + real[5] + ']');

  // ═══ 5) ขั้น II · Clarity Mind ═════════════════════════════════════
  blk('5 · ขั้น II · Clarity Mind');
  await goFloor(page, 6);
  const cl0 = await page.evaluate(() => {
    G.streak = 0; renderStats();
    baBlind(); baBlackout(4000);
    return { blind: document.getElementById('gameScreen').classList.contains('ba-blind'),
             black: (document.getElementById('baBlack') || { classList: { contains: () => false } }).classList.contains('on') };
  });
  ok(cl0.blind === true && cl0.black === true, 'คอมโบ 0 ยังติด Blind/Blackout ได้ตามปกติ');
  const cl10 = await page.evaluate(() => {
    G.streak = 10; renderStats(); baCbSync();
    return { blind: document.getElementById('gameScreen').classList.contains('ba-blind'),
             black: (document.getElementById('baBlack') || { classList: { contains: () => false } }).classList.contains('on') };
  });
  ok(cl10.blind === false && cl10.black === false, 'แตะคอมโบ 10 = ล้างสถานะบดบังสายตาทันที');
  const cl10b = await page.evaluate(() => {
    baBlind(); baBlackout(4000);
    return { blind: document.getElementById('gameScreen').classList.contains('ba-blind'),
             black: (document.getElementById('baBlack') || { classList: { contains: () => false } }).classList.contains('on') };
  });
  ok(cl10b.blind === false && cl10b.black === false, 'คอมโบ ≥10 ป้องกัน Blind/Blackout ไม่ให้ติดอีก');
  const smoke = await page.evaluate(() => {
    G.streak = 0; renderStats();
    baShSmoke(4000);
    const on0 = document.getElementById('gameScreen').classList.contains('ba-smoke');
    G.streak = 10; renderStats(); baCbSync();
    const cleared = !document.getElementById('gameScreen').classList.contains('ba-smoke');
    baShSmoke(4000);
    const blocked = !document.getElementById('gameScreen').classList.contains('ba-smoke');
    return { on0: on0, cleared: cleared, blocked: blocked };
  });
  ok(smoke.on0 === true, 'คอมโบ 0 ยังติดควันดำของทัพเงาได้ตามปกติ');
  ok(smoke.cleared === true, 'แตะคอมโบ 10 = ล้างควันดำทันที (หมวดบดบังสายตาชุดเดียวกัน)');
  ok(smoke.blocked === true, 'คอมโบ ≥10 ป้องกันควันดำไม่ให้ติดอีก');

  const cl4 = await page.evaluate(() => {
    G.streak = 4; renderStats();
    baBlind();
    const r = document.getElementById('gameScreen').classList.contains('ba-blind');
    baCbClarity();
    return r;
  });
  ok(cl4 === true, 'คอมโบตกต่ำกว่า 10 แล้วกลับมาติด Blind ได้เหมือนเดิม');

  // ═══ 6) ขั้น II · Combo Shield ═════════════════════════════════════
  blk('6 · ขั้น II · Combo Shield');
  await goFloor(page, 6);
  await setCombo(page, 10);
  a = await audit(page);
  ok(a.combo.shield === true && a.combo.granted === true, 'แตะคอมโบ 10 = ได้ Combo Shield 1 ครั้ง');
  const sh1 = await page.evaluate(() => {
    CD_CARD = null;   /* 🛡️ โล่พิพากษาของ v4.7 คืนสตรีคให้ก่อน โล่ใบนี้จึงยังไม่ต้องสลาย */
    G.streak = 10; G.hp = G.maxHp; G.shield = 0; G.locked = false;
    G.monsterMaxHp = 999999; G.monsterHp = 999999;
    const m = G.currentMonster;
    resolveAnswer(m.choices.filter(c => c !== m.answer)[0], null, false);
    return { streak: G.streak, shield: BA_CB_SH };
  });
  await page.waitForTimeout(2000); await clearOverlays(page);
  ok(sh1.streak === 5, 'ตอบผิดขณะถือโล่ = คอมโบลดแค่ -5 (10 → 5) [' + sh1.streak + ']');
  ok(sh1.shield === false, 'โล่ถูกใช้ไปแล้วหนึ่งครั้ง');
  const sh2 = await page.evaluate(() => {
    CD_CARD = null;
    G.hp = G.maxHp; G.shield = 0; G.locked = false;
    G.monsterMaxHp = 999999; G.monsterHp = 999999;
    const m = G.currentMonster;
    resolveAnswer(m.choices.filter(c => c !== m.answer)[0], null, false);
    return G.streak;
  });
  await page.waitForTimeout(2000); await clearOverlays(page);
  ok(sh2 === 0, 'ตอบผิดซ้ำโดยไม่มีโล่ = คอมโบถูกล้างเป็น 0 ตามเดิม [' + sh2 + ']');
  const regrant = await page.evaluate(() => {
    CD_CARD = null;
    G.streak = 23; renderStats(); baCbSync();
    const got = BA_CB_SH;
    G.hp = G.maxHp; G.shield = 0; G.locked = false;
    G.monsterMaxHp = 999999; G.monsterHp = 999999;
    const m = G.currentMonster;
    resolveAnswer(m.choices.filter(c => c !== m.answer)[0], null, false);
    return { got: got, streak: G.streak, shield: BA_CB_SH, granted: BA_CB_SHG };
  });
  await page.waitForTimeout(2000); await clearOverlays(page);
  ok(regrant.got === true && regrant.streak === 18,
     'คอมโบ 23 โล่สลาย → เหลือ 18 (ไม่ใช่ 0) [' + regrant.streak + ']');
  ok(regrant.shield === false && regrant.granted === true,
     'โล่ไม่ถูกแจกใหม่ทันทีทั้งที่คอมโบยังเกิน 10 (กันโล่ไม่มีวันหมด)');
  const reset = await page.evaluate(() => {
    G.streak = 0; renderStats();
    const cleared = !BA_CB_SHG;
    G.streak = 10; renderStats(); baCbSync();
    return { cleared: cleared, shield: BA_CB_SH };
  });
  ok(reset.cleared === true && reset.shield === true,
     'คอมโบตกต่ำกว่า 10 แล้วไต่กลับขึ้นไปใหม่ = ได้โล่ใบใหม่');

  // ═══ 7) ขั้น III · Abyssal Pierce ══════════════════════════════════
  blk('7 · ขั้น III · Abyssal Pierce');
  await goFloor(page, 4);
  const bar = await page.evaluate(() => ({ left: baBarLeft(), on: !!(typeof BA_BAR !== 'undefined' && BA_BAR) }));
  ok(bar.on === true && bar.left > 0, 'ชั้นบอสมีเกราะบาเรียตั้งอยู่จริง [' + bar.left + ']');
  const pz = await page.evaluate(() => {
    G.streak = 15; renderStats(); baCbSync();
    const b = { hp: G.monsterHp, bar: baBarLeft() };
    const ex = baCbPierce(100);
    return { ex: ex, drop: b.hp - G.monsterHp, barDrop: b.bar - baBarLeft() };
  });
  ok(pz.ex === 50 && pz.drop === 50, 'เจาะเกราะ 50% ของ 100 = ลด HP อสูรอีก 50 [' + pz.ex + ']');
  ok(pz.barDrop === 0, 'ดาเมจเจาะทะลุลงข้างใต้ เกราะบาเรียไม่ยุบตาม [' + pz.barDrop + ']');
  const pzOff = await page.evaluate(() => {
    G.streak = 14; renderStats(); baCbSync();
    const b = G.monsterHp;
    const lv = baCbLv();
    return { lv: lv, drop: b - G.monsterHp };
  });
  ok(pzOff.lv === 2 && pzOff.drop === 0, 'คอมโบ 14 ยังไม่ได้เจาะเกราะ');
  const kill = await page.evaluate(() => {
    G.streak = 15; renderStats(); baCbSync();
    G.monsterHp = 20;
    const ex = baCbPierce(999);
    return { ex: ex, hp: G.monsterHp };
  });
  ok(kill.hp >= 1, 'ดาเมจเจาะถูกหนีบไม่ให้ฆ่า (เหลืออย่างน้อย 1 HP) [' + kill.hp + ']');
  await goFloor(page, 2);
  const noBar = await page.evaluate(() => {
    G.streak = 20; renderStats(); baCbSync();
    const b = G.monsterHp;
    const ex = baCbPierce(100);
    return { left: (typeof baBarLeft === 'function') ? baBarLeft() : 0, ex: ex, drop: b - G.monsterHp };
  });
  ok(noBar.left === 0 && noBar.ex === 0 && noBar.drop === 0, 'ชั้นที่ไม่มีเกราะบาเรีย = ไม่มีอะไรให้เจาะ');

  // ═══ 8) ขั้น IV · Vampiric Monarch ═════════════════════════════════
  blk('8 · ขั้น IV · Vampiric Monarch');
  await goFloor(page, 9);
  const vp = await page.evaluate(() => {
    G.streak = 20; renderStats(); baCbSync();
    G.hp = Math.max(1, G.maxHp - 500);
    const b = G.hp;
    const h = baCbVamp();
    return { h: h, gain: G.hp - b, want: Math.max(1, Math.round(G.maxHp * 5 / 100)) };
  });
  ok(vp.h === vp.want && vp.gain === vp.want, 'ดูดเลือดคืน 5% Max HP ต่อข้อ [' + vp.h + '/' + vp.want + ']');
  const vpFull = await page.evaluate(() => { G.hp = G.maxHp; return baCbVamp(); });
  ok(vpFull === 0, 'HP เต็มแล้วไม่ล้นออกนอกหลอด');
  const vpVow = await page.evaluate(() => {
    G.hp = Math.max(1, G.maxHp - 500);
    CD_CARD = CD_BY_ID['ward']; CD_BAND = cdBandOf(G.floor);
    CD_ST = { ward: false, noItem: true, noHeal: true, atk: 0, perfect: true, hit: 0, miss: 0 };
    const b = G.hp; const h = baCbVamp();
    CD_CARD = null; CD_BAND = -1;
    return { h: h, gain: G.hp - b };
  });
  ok(vpVow.h === 0 && vpVow.gain === 0,
     '💀 พันธสัญญาโลหิตทมิฬ (ห้ามฟื้นทุกทาง) บล็อกการดูดเลือดได้ [' + vpVow.h + ']');
  const vpOff = await page.evaluate(() => {
    G.streak = 19; renderStats(); baCbSync();
    return baCbLv();
  });
  ok(vpOff === 3, 'คอมโบ 19 ยังไม่ถึงขั้นดูดเลือด [' + vpOff + ']');

  // ═══ 9) Perfect Speed Reflex ═══════════════════════════════════════
  blk('9 · Perfect Speed Reflex · Parry Strike');
  await goFloor(page, 9);
  const pr = await page.evaluate(() => {
    BA_ATB = 80; BA_BAT = 90; BA_PR_UNTIL = 0;
    const n0 = BA_PR_N;
    const got = baCbParry();
    return { atb: BA_ATB, bat: BA_BAT, n: BA_PR_N - n0, on: baPrOn(), cleansed: got };
  });
  ok(pr.atb === 50 && pr.bat === 60, 'Parry ดันเกจท่าไม้ตายและเกจโจมตีปกติถอย 30% [' + pr.atb + '/' + pr.bat + ']');
  ok(pr.n === 1 && pr.on === true, 'Parry เปิดหน้าต่างยกเลิกเทิร์นโจมตี');
  const cancel = await page.evaluate(() => {
    G.hp = G.maxHp; G.shield = 0;
    BA_PR_UNTIL = Date.now() + 1500;
    BA_BAT = 99; BA_ATB = 99;
    const hp0 = G.hp;
    baBatFire();
    baFire();
    return { bat: BA_BAT, atb: BA_ATB, hp0: hp0 };
  });
  await page.waitForTimeout(500);
  const cancelHp = await page.evaluate(() => G.hp);
  ok(cancel.bat === 0 && cancel.atb === 0, 'เทิร์นโจมตีที่ถูกยกเลิกล้างเกจทิ้งจริง');
  ok(cancelHp === cancel.hp0, 'อสูรไม่ได้ทำดาเมจเลยระหว่างหน้าต่าง Parry [' + cancelHp + '/' + cancel.hp0 + ']');
  const normal = await page.evaluate(() => {
    BA_PR_UNTIL = 0;
    G.hp = G.maxHp; G.shield = 0;
    const hp0 = G.hp;
    baBatFire();
    return hp0;
  });
  await page.waitForTimeout(500);
  const normalHp = await page.evaluate(() => G.hp);
  ok(normalHp < normal, 'พ้นหน้าต่าง Parry แล้วอสูรฟาดได้ตามปกติ [' + (normal - normalHp) + ']');
  const cleanse = await page.evaluate(() => {
    G.streak = 0; renderStats();
    G.locked = false;
    BA_PR_UNTIL = 0;
    BA_FORT = true; BA_CONDEMN = true;
    BA_SH_SEAL = Date.now() + 9000; BA_SH_SCAN = Date.now() + 9000; BA_SH_IRN = true;
    baStone(9000); baBlind(); baShSmoke(9000); baToxin(1, 5, 4000);
    const before = {
      fort: BA_FORT, blind: document.getElementById('gameScreen').classList.contains('ba-blind'),
      stone: document.querySelectorAll('#gChoices .g-choice.ba-stone').length,
      tox: !!BA_TOX_T
    };
    const n = baCbCleanse();
    return { before: before, n: n,
             fort: BA_FORT, condemn: BA_CONDEMN, irn: BA_SH_IRN,
             seal: BA_SH_SEAL > Date.now(), scan: BA_SH_SCAN > Date.now(),
             blind: document.getElementById('gameScreen').classList.contains('ba-blind'),
             smoke: document.getElementById('gameScreen').classList.contains('ba-smoke'),
             stone: document.querySelectorAll('#gChoices .g-choice.ba-stone').length,
             tox: !!BA_TOX_T,
             enabled: document.querySelectorAll('#gChoices .g-choice:not([disabled])').length };
  });
  ok(cleanse.before.fort && cleanse.before.blind && cleanse.before.stone > 0 && cleanse.before.tox,
     'ตั้งสถานะผิดปกติหลายตัวไว้ก่อนล้างได้จริง');
  ok(cleanse.n >= 6, 'Cleanse ล้างสถานะได้หลายอย่างในครั้งเดียว [' + cleanse.n + ']');
  ok(!cleanse.fort && !cleanse.condemn && !cleanse.irn && !cleanse.seal && !cleanse.scan,
     'ล้างสถานะของ v6.3/v6.6 ที่แปะไว้กับฮีโร่ครบ');
  ok(!cleanse.blind && !cleanse.smoke && cleanse.stone === 0 && !cleanse.tox,
     'ล้างตาบอด · ควันดำ · ปุ่มกลายเป็นหิน · พิษ ครบ');
  ok(cleanse.enabled > 0, 'ปุ่มคำตอบถูกปลดล็อกคืนเมื่อยังไม่ล็อกเทิร์น [' + cleanse.enabled + ']');
  const mirage = await page.evaluate(() => {
    const b = document.querySelector('#gChoices .g-choice');
    const orig = b ? b.innerHTML : '';
    baMirage(4);
    const masked = b ? b.textContent : '';
    baCbCleanse();
    return { orig: orig, masked: masked, back: b ? b.innerHTML : '' };
  });
  ok(mirage.masked === '???' && mirage.back === mirage.orig,
     'Cleanse คืนข้อความช้อยส์ที่ถูก Mirrored Mirage เปลี่ยนเป็น ???');
  /* ล้าง Parry ที่ค้างจากบล็อกนี้ก่อนไปต่อ */
  await page.evaluate(() => { BA_PR_UNTIL = 0; });

  // ═══ 10) Parry ยิงจากการเล่นจริง ════════════════════════════════════
  blk('10 · Parry จากการตอบจริง');
  await goFloor(page, 9);
  const fast = await page.evaluate(() => {
    G.streak = 0; G.hp = G.maxHp; G.shield = 999; G.locked = false;
    G.monsterMaxHp = 999999; G.monsterHp = 999999;
    G.questionStart = Date.now();          /* ตอบทันทีภายใน 1.0 วิ */
    BA_ATB = 90; BA_BAT = 90;
    const n0 = BA_PR_N;
    resolveAnswer(G.currentMonster.answer, null, false);
    return { n: BA_PR_N - n0, atb: BA_ATB, bat: BA_BAT };
  });
  await page.waitForTimeout(1500); await clearOverlays(page);
  ok(fast.n === 1, 'ตอบถูกภายใน 1.0 วิ = Parry Strike ทำงาน');
  ok(fast.atb <= 60 && fast.bat <= 60,
     'เกจทั้งสองถูกดันถอย (30% ของ Parry + แรงดันปกติ) [' + fast.atb + '/' + fast.bat + ']');
  const slow = await page.evaluate(() => {
    G.streak = 0; G.hp = G.maxHp; G.shield = 999; G.locked = false;
    G.monsterMaxHp = 999999; G.monsterHp = 999999;
    G.questionStart = Date.now() - 2500;   /* ช้ากว่า 1.0 วิ แต่ยังเร็วกว่า 3 วิ */
    const n0 = BA_PR_N;
    resolveAnswer(G.currentMonster.answer, null, false);
    return BA_PR_N - n0;
  });
  await page.waitForTimeout(1500); await clearOverlays(page);
  ok(slow === 0, 'ตอบถูกช้ากว่า 1.0 วิ ไม่ได้ Parry [' + slow + ']');
  const miss = await page.evaluate(() => {
    G.streak = 0; G.hp = G.maxHp; G.shield = 999; G.locked = false;
    G.monsterMaxHp = 999999; G.monsterHp = 999999;
    G.questionStart = Date.now();
    const n0 = BA_PR_N;
    const m = G.currentMonster;
    resolveAnswer(m.choices.filter(c => c !== m.answer)[0], null, false);
    return BA_PR_N - n0;
  });
  await page.waitForTimeout(2000); await clearOverlays(page);
  ok(miss === 0, 'ตอบผิดไวแค่ไหนก็ไม่ได้ Parry [' + miss + ']');

  // ═══ 11) โหมดฝึกจุดอ่อนไม่มีบัฟเลยสักตัว ═══════════════════════════
  blk('11 · โหมดฝึกจุดอ่อน');
  await goFloor(page, 9, { practice: true });
  const pr2 = await page.evaluate(() => {
    G.streak = 25;
    renderStats();
    return { combo: baCbCombo(), lv: baCbLv(), vamp: baCbVamp(), pierce: baCbPierce(100),
             shown: !!(document.getElementById('baCombo') || { classList: { contains: () => false } }).classList.contains('on') };
  });
  ok(pr2.combo === 0 && pr2.lv === 0, 'โหมดฝึกไม่นับคอมโบเป็นบัฟ');
  ok(pr2.vamp === 0 && pr2.pierce === 0, 'โหมดฝึกไม่ได้ดูดเลือดและไม่ได้เจาะเกราะ');
  ok(pr2.shown === false, 'โหมดฝึกไม่โชว์แถบไอคอนบัฟ');
  await page.evaluate(() => { G.practiceMode = false; G.streak = 0; renderStats(); });

  // ═══ 12) ล้างสถานะตอนออกจากเกม ═════════════════════════════════════
  blk('12 · ล้างสถานะตอนออกจากเกม');
  await goFloor(page, 9);
  await setCombo(page, 20);
  const beforeExit = await audit(page);
  await page.evaluate(() => { try { exitGame(); } catch (e) {} });
  await page.waitForTimeout(400);
  const afterExit = await page.evaluate(() => ({
    sh: BA_CB_SH, shg: BA_CB_SHG, ann: BA_CB_ANN, pr: BA_PR_UNTIL,
    shown: !!(document.getElementById('baCombo') || { classList: { contains: () => false } }).classList.contains('on')
  }));
  ok(beforeExit.combo.lv === 4, 'ก่อนออกจากเกมถือบัฟครบสี่ขั้น');
  ok(!afterExit.sh && !afterExit.shg && afterExit.ann === 0 && afterExit.pr === 0,
     'ออกจากเกมแล้วสถานะบัฟถูกล้างครบ ไม่ค้างข้ามรอบการเล่น');
  ok(afterExit.shown === false, 'แถบไอคอนถูกล้างตอนออกจากเกม');

  // ═══ 13) เลย์เอาต์ · ความปลอดภัยรวม ════════════════════════════════
  blk('13 · เลย์เอาต์และความปลอดภัยรวม');
  await enter(page, 'cb02');
  await goFloor(page, 9);
  await setCombo(page, 25);
  for (const w of [320, 360, 390, 430, 768]) {
    await page.setViewportSize({ width: w, height: w === 320 ? 640 : 844 });
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => ({
      w: document.body.scrollWidth, v: window.innerWidth,
      over: (function () {
        const el = document.getElementById('baCombo');
        const py = document.getElementById('gPinyin');
        if (!el || !py) return -999;
        return Math.round(py.getBoundingClientRect().bottom - el.getBoundingClientRect().top);
      })()
    }));
    ok(m.w <= m.v, 'จอ ' + w + ' ไม่ล้นแนวนอน [' + m.w + '/' + m.v + ']');
    ok(m.over <= 0, 'จอ ' + w + ' แถบไอคอนไม่คร่อมพินอิน [' + m.over + 'px]');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);

  const net = await page.evaluate(() => (window.__NET || []).length);
  ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุด [' + errs.slice(0, 2).join(' | ') + ']');
  const bad = await page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('yao_errlog') || '[]') || [])
        .filter(e => /cb[A-Z]|install69/.test(String((e && e.where) || ''))).length;
    } catch (e) { return -1; }
  });
  ok(bad === 0, 'Error Log ไม่มีรายการของชั้น v6.9 [' + bad + ']');
  fs.appendFileSync(LOG, '\n(คำขอเน็ตที่ถูก stub ไว้ ' + net + ' ครั้ง)\n');

  fs.appendFileSync(LOG, '\n══ สรุป ══\nผ่าน ' + pass + ' · ตก ' + fail + '\n');
  console.log('\n══════════════════════════════════\nผ่าน ' + pass + ' · ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
