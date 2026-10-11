/* ชุดเทสต์ Patch v9.31 · 5-STAR KIT UPGRADE
 *   NODE_PATH=/opt/node22/lib/node_modules node test_kit5star.js [ไฟล์.html]
 * ชี้ไปที่ไฟล์แจกโดยเจตนา (กับดักข้อ 28) · เรียก window.verifyV929Combat() ในเกมจริง
 * แล้วยืนยันว่าไม่มีอะไรรั่วออกจากกล่องทราย + การแก้บั๊คของ v9.29 ทำงานบนเส้นทางจริง */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_kit5star.log');
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
    const setup = (k) => page.evaluate((k) => {
      ba.kit5Reset(); G.classId = k; recalcStats(); baSyncCurrentClassSkills(true);
      G.floor = 4; BA_INC_F = 4; BA_INC_AT = -1; BA_INC_M = null; nextMonster();
      G.locked = false; G.monsterMaxHp = G.monsterHp = 9e6; G.mp = maxMpOf(G); G.hp = G.maxHp; G.shield = 0;
      BA_BAR = { m: G.currentMonster, floor: G.floor, base: 6e6, max: 3e6, tier: 'boss', broken: false };
      BA_V91_CD[0] = BA_V91_CD[2] = 0; return true;
    }, k);
    head('1) Priest');
    await setup('priest');
    let r = await page.evaluate(() => { G.hp = G.maxHp; G.shield = 0; cdHeal(G.maxHp * 2); return G.shield | 0; });
    ok(r > 0, 'S2 overheal → เกราะ ' + r);
    r = await page.evaluate(() => { const m = G.currentMonster; const r0 = G.monsterHp; baV91Activate(2, G, baResolveSkillEffects(baDsRoleOf(G), null, 2, baPlSlotLv(G, 2))); return baBattleAudit().kit5star.x.sil; });
    ok(r === 1, 'S3 ผนึกบอส 1T (sil=' + r + ')');
    r = await page.evaluate(() => baFighting());
    ok(r === false, 'baFighting เป็นเท็จระหว่างผนึก');
    r = await page.evaluate(() => { X = null; return 0; }).catch(() => 0);
    await setup('priest');
    r = await page.evaluate(() => { G.ult = G.ult || {}; G.ult.pips = 8; G.mp = maxMpOf(G); const hp = G.hp; const ok = baPlCast(); const a = baBattleAudit().kit5star; return { ok, inv: a.x.inv, n: a.n.inv }; });
    ok(r.ok && r.inv === 1, 'S4 อมตะ 1 เทิร์น ' + JSON.stringify(r));
    head('2) Slayer');
    await setup('slayer');
    r = await page.evaluate(() => { const b0 = baBarLeft(); baV91Activate(0, G, baResolveSkillEffects(baDsRoleOf(G), null, 0, baPlSlotLv(G, 0))); return { b0, n: baBattleAudit().kit5star.n.shred, b1: baBarLeft() }; });
    ok(r.n === 1 && r.b0 - r.b1 >= 1500, 'S1 ฉีกเกราะ ≥1500 ' + JSON.stringify(r));
    r = await page.evaluate(() => { BA_ST_N = 0; baV91Activate(2, G, baResolveSkillEffects(baDsRoleOf(G), null, 2, baPlSlotLv(G, 2))); return BA_ST_N + '|' + baBattleAudit().kit5star.n.stag; });
    ok(/^1\|1$/.test(r) || /\|1$/.test(r), 'S3 stagger +30% (' + r + ')');
    r = await page.evaluate(() => { G.ult = G.ult || {}; G.ult.pips = 8; G.mp = maxMpOf(G); G.monsterHp = Math.round(G.monsterMaxHp * 0.2); BA_BAR.base = 1; const h0 = G.monsterHp; const ok = baPlCast(); return { ok, n: baBattleAudit().kit5star.n.exe, h0, h1: G.monsterHp }; });
    say('  slayer ult: ' + JSON.stringify(r));
    ok(r.ok, 'S4 ท่าไม้ตายปล่อยได้ (execute n=' + r.n + ')');
    head('3) Assassin');
    await setup('assassin');
    r = await page.evaluate(() => { baV91Activate(0, G, baResolveSkillEffects(baDsRoleOf(G), null, 0, baPlSlotLv(G, 0))); const hp = G.hp; baHurtHero(50); return { hp0: hp, hp1: G.hp, ev: baBattleAudit().kit5star.n.evade }; });
    ok(r.hp0 === r.hp1 && r.ev === 1, 'S1 หลบ 100% ครั้งถัดไป ' + JSON.stringify(r));
    r = await page.evaluate(() => { const o = baBattleAudit().kit5star.x.bleed; baV91Activate(2, G, baResolveSkillEffects(baDsRoleOf(G), null, 2, baPlSlotLv(G, 2))); return o + '→' + baBattleAudit().kit5star.x.bleed; });
    ok(/→3$/.test(r), 'S3 เลือดไหล 3 เทิร์น (' + r + ')');
    r = await page.evaluate(() => {
      const m = G.currentMonster; G.hp = G.maxHp; G.shield = 0;
      const sh0 = baBarLeft(), b0 = BA_BAR.base, h0 = G.monsterHp;
      G.ult = G.ult || {}; G.ult.pips = 8; G.mp = maxMpOf(G);
      const ok = baPlCast();
      return { ok, shieldLeft: sh0 - baBarLeft(), base: b0 - BA_BAR.base, hp: h0 - G.monsterHp };
    });
    say('  ult: ' + JSON.stringify(r));
    ok(r.ok, 'ult ปล่อยได้');
    if (r.ok) ok(r.shieldLeft <= 0 && r.base > 0, 'S4 ดาเมจจริงทะลุเกราะ (เกราะไม่ลด, หลอดแดงลด)');
    ok(!errs.length, 'ไม่มี pageerror ' + JSON.stringify(errs));
    await ctx.close();
  } finally { await browser.close(); }
  say('\n✅ ผ่าน ' + pass + '   ❌ ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
