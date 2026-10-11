/* ชุดเทสต์ Patch v9.29b · GUARDIAN S1 1T CD + SHIELD ABSORB FIX
 *   NODE_PATH=/opt/node22/lib/node_modules node test_v929b_shield_cd.js [ไฟล์.html]
 * ชี้ไปที่ไฟล์แจกโดยเจตนา (กับดักข้อ 28) · เรียก window.verifyV929Combat() ในเกมจริง
 * แล้วยืนยันว่าไม่มีอะไรรั่วออกจากกล่องทราย + การแก้บั๊คของ v9.29 ทำงานบนเส้นทางจริง */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_v929b_shield_cd.log');
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
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
    window.EventSource = function () { this.close = function () {}; };
  });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    switchTab('register');
    document.getElementById('reg-id').value = 'v929' + Math.floor(Math.random() * 9999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    if (typeof CD_BAND !== 'undefined') { CD_CARD = null; CD_BAND = cdBandOf(G.floor); CD_SKIP = G.floor; }
    if (typeof BA_INC_F !== 'undefined') { BA_INC_F = G.floor; BA_INC_AT = -1; BA_INC_M = null; }
    G.maxFloor = FLOOR_MAX; recalcStats(); renderStats();
    try { acFocusQa(); acSync(true); } catch (e) {}
  });
  return { ctx, page, errs };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const { ctx, page, errs } = await boot(browser);
    head('1) Guardian S1 · CD 1 เทิร์นหลังร่าย');
    const r1 = await page.evaluate(() => {
      G.classId = 'guardian'; recalcStats(); baSyncCurrentClassSkills(true);
      G.monsterMaxHp = G.monsterHp = 9e7; G.mp = maxMpOf(G); G.locked = false;
      BA_V91_CD[0] = 0; BA_V91_ARM[0] = false;
      const ok1 = baV91Activate(0, G, baResolveSkillEffects(baDsRoleOf(G), null, 0, baPlSlotLv(G, 0)));
      const cd1 = BA_V91_CD[0];
      G.mp = maxMpOf(G);
      const ok2 = baV91Activate(0, G, baResolveSkillEffects(baDsRoleOf(G), null, 0, baPlSlotLv(G, 0)));
      return { ok1, cd1, ok2, audit: baBattleAudit().kitV929.gcd };
    });
    ok(r1.ok1 === true, 'ร่ายครั้งแรกสำเร็จ (ทันที)');
    ok(r1.cd1 === 1, 'หลังร่าย CD ช่อง 1 = 1 เทิร์น [' + r1.cd1 + ']');
    ok(r1.ok2 === false, 'กดซ้ำในข้อเดียวกันถูกบล็อก (ไม่สแปม)');
    ok(r1.audit === 1, 'audit kitV929.gcd = 1');
    const r2 = await page.evaluate(() => {
      G.locked = false; G.questionStart = Date.now() - 4000;
      const m = G.currentMonster; resolveAnswer(m.answer, null, false);
      return BA_V91_CD[0];
    });
    ok(r2 === 0, 'ผ่านไป 1 ข้อ → CD กลับเป็น 0 [' + r2 + ']');

    head('2) เกราะรับดาเมจจาก baHurtHero ก่อน HP');
    const r3 = await page.evaluate(() => {
      G.practiceMode = false; G.hp = G.maxHp; G.shield = 2; renderStats();
      const hp0 = G.hp, a = baHurtHero(50);
      const s1 = G.shield, hp1 = G.hp;
      baHurtHero(50); const s2 = G.shield, hp2 = G.hp;
      baHurtHero(50); const s3 = G.shield, hp3 = G.hp;
      const seg = document.querySelector('#baHeroHp .ba-shield');
      return { hp0, a, s1, hp1, s2, hp2, s3, hp3, w: seg ? seg.style.width : '-', h: seg ? seg.style.height : '-' };
    });
    ok(r3.a === 0 && r3.s1 === 1 && r3.hp1 === r3.hp0, 'โจมตีครั้งแรก: เกราะ 2→1 · HP ไม่ลด');
    ok(r3.s2 === 0 && r3.hp2 === r3.hp0, 'ครั้งที่สอง: เกราะ 1→0 · HP ไม่ลด');
    ok(r3.s3 === 0 && r3.hp3 < r3.hp0, 'ครั้งที่สาม: ไม่มีเกราะ → HP ลด [' + r3.hp0 + '→' + r3.hp3 + ']');
    ok(r3.w === '0%', 'แถบฟ้าหายเมื่อเกราะหมด [' + r3.w + ']');
    const r4 = await page.evaluate(() => { G.shield = 1; renderStats(); const s = document.querySelector('#baHeroHp .ba-shield'); return { w: s.style.width, h: s.style.height }; });
    ok(r4.w === '25%' && r4.h === '40%', 'มีเกราะ → แถบฟ้าบาง 40% ไม่ทับหลอดแดงมิด [' + r4.w + ' / ' + r4.h + ']');
    ok(!errs.length, 'ไม่มี pageerror ' + JSON.stringify(errs));
    await ctx.close();
  } finally { await browser.close(); say('\n✅ ผ่าน ' + pass + '   ❌ ตก ' + fail); }
})();
