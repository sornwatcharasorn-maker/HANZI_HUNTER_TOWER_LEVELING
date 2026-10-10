/* ชุดเทสต์ Patch v9.29 · IN-GAME COMBAT VERIFICATION + QUICK FIXES
 *   NODE_PATH=/opt/node22/lib/node_modules node test_v929_verify.js [ไฟล์.html]
 * ชี้ไปที่ไฟล์แจกโดยเจตนา (กับดักข้อ 28) · เรียก window.verifyV929Combat() ในเกมจริง
 * แล้วยืนยันว่าไม่มีอะไรรั่วออกจากกล่องทราย + การแก้บั๊คของ v9.29 ทำงานบนเส้นทางจริง */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_v929_verify.log');
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
    head('1) ตัวตรวจในเกม verifyV929Combat()');
    const pre = await page.evaluate(() => ({ cls: G.classId, gold: G.gold, exp: G.exp, floor: G.floor, hp: G.hp, mp: G.mp,
      mhp: G.monsterHp, m: G.currentMonster && G.currentMonster.word, shards: G.ab && G.ab.shards, fn: typeof window.verifyV929Combat,
      ls: JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k).replace(/"lastActive":\d+/g, '"lastActive":0')])) }));
    ok(pre.fn === 'function', 'window.verifyV929Combat ถูกเปิดไว้');
    const rep = await page.evaluate(() => window.verifyV929Combat());
    say('    casts: ' + JSON.stringify(rep.casts));
    say('    shield: ' + JSON.stringify(rep.shield) + ' pulse: ' + JSON.stringify(rep.pulse));
    say('    passive: ' + JSON.stringify(rep.passive) + ' smite: ' + JSON.stringify(rep.smite));
    say('    cls: ' + JSON.stringify(rep.cls) + ' decay: ' + rep.decay + ' errors: ' + JSON.stringify(rep.errors));
    ok(rep.casts.length === 8, 'ร่ายครบ 8 ครั้ง (4 สาย × S1/S3)');
    rep.casts.forEach(c => ok(c.pass, c.cls + ' ' + c.slot + ' ' + c.name + ' ทำงานทันที · ' + c.ms + 'ms · HP อสูร −' + c.hpDrop));
    ok(rep.casts.every(c => c.ms < 50), 'ทุกการร่ายจบภายใน 50ms (ไม่มีการหน่วง)');
    ok(rep.shield.full && rep.shield.full.ok, 'แถบเกราะมองเห็นตอน HP เต็ม (w=' + (rep.shield.full || {}).w + ')');
    ok(rep.shield.half && rep.shield.half.ok, 'แถบเกราะมองเห็นตอน HP ครึ่ง');
    ok(rep.pulse.ok, 'ชีพจรเขียว 0 0 18px #00ff66 บนฮีโร่');
    ok(rep.passive.ok, 'พาสซีฟ S2 → แบนเนอร์ + ชีพจรบนปุ่ม S2 และฮีโร่');
    ok(rep.smite.ok, 'Overheal Smite ลงดาเมจ + แบนเนอร์');
    ok(rep.cls.ok, 'ไม่มี layout shift (L0 = L1 = L2)');
    ok(rep.cls.L0.hscroll === false, 'ไม่ล้นแนวนอน');
    ok(rep.decay, 'เงาเรืองคืนค่าเดิมหลัง 600ms');
    ok(rep.ok === true, 'รายงานรวม ok');
    const post = await page.evaluate(() => ({ cls: G.classId, gold: G.gold, exp: G.exp, floor: G.floor, hp: G.hp, mp: G.mp,
      mhp: G.monsterHp, m: G.currentMonster && G.currentMonster.word, shards: G.ab && G.ab.shards, fn: typeof window.verifyV929Combat,
      ls: JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k).replace(/"lastActive":\d+/g, '"lastActive":0')])) }));
    ['cls', 'gold', 'exp', 'floor', 'hp', 'mp', 'mhp', 'm', 'shards'].forEach(k => ok(pre[k] === post[k], 'กล่องทรายไม่รั่ว: ' + k + ' ' + pre[k] + ' → ' + post[k]));
    { const A = new Map(JSON.parse(pre.ls)), B = new Map(JSON.parse(post.ls)); const d = [];
      new Set([...A.keys(), ...B.keys()]).forEach(k => { if (A.get(k) !== B.get(k)) d.push(k + ':' + String(A.get(k)).slice(0, 120) + ' → ' + String(B.get(k)).slice(0, 120)); });
      if (d.length) say('    ls diff: ' + d.map(x => x.slice(0, 40)).join(' | '));
      try { const a = JSON.parse(A.get('yao_students')), b = JSON.parse(B.get('yao_students')); const u = Object.keys(a)[0];
        const fd = Object.keys(Object.assign({}, a[u], b[u])).filter(k => JSON.stringify(a[u][k]) !== JSON.stringify(b[u][k]));
        say('    fields: ' + fd.map(k => k + '=' + JSON.stringify(a[u][k]).slice(0, 60) + '→' + JSON.stringify(b[u][k]).slice(0, 60)).join(' ; ')); } catch (e) {}
      ok(!d.length, 'localStorage เหมือนเดิมทุกคีย์ (ยกเว้นเวลา lastActive ที่ saveProgress ประทับตอนวาดคืน)'); }
    const st = await page.evaluate(() => ({ save: typeof saveStore, ext: extendQuestionTimer.toString().indexOf('spy') < 0, audit: !!(baBattleAudit().kitV929 || {}).verify }));
    ok(st.save === 'function' && st.ext, 'ฟังก์ชันที่ถูกสตับคืนค่าเดิมครบ');
    ok(st.audit, 'baBattleAudit().kitV929.verify มีรายงาน');

    head('2) แก้บั๊ค: S1 ของนักลอบสังหารลงดาเมจจริงบนเส้นทางจริง');
    const r2 = await page.evaluate(() => {
      G.classId = 'assassin'; baPlEnsure(G); recalcStats(); baSyncCurrentClassSkills(true);
      G.locked = false; G.mp = 999; BA_V91_CD[0] = 0; BA_V91_ARM[0] = false;
      G.monsterMaxHp = G.monsterHp = 1e6;
      const h0 = G.monsterHp;
      const r = baResolveSkillEffects(baDsRoleOf(G), null, 0, baPlSlotLv(G, 0));
      const ok = baV91Activate(0, G, r);
      return { ok, drop: h0 - G.monsterHp, n: baBattleAudit().kitV929.n };
    });
    ok(r2.ok && r2.drop > 0, 'ร่าย S1 แล้วเลือดอสูรลดทันที (−' + r2.drop + ')');

    head('3) Kill-lock — ร่ายจนอสูรตายต้องล็อกเทิร์น');
    const r3 = await page.evaluate(() => {
      G.locked = false; G.mp = 999; BA_V91_CD[0] = 0; G.monsterHp = 1; G.monsterMaxHp = Math.max(G.monsterMaxHp, 10);
      if (typeof BA_BAR !== 'undefined' && BA_BAR) { BA_BAR.base = 0; BA_BAR.max = 0; BA_BAR.broken = true; }
      const m = G.currentMonster;
      const r = baResolveSkillEffects(baDsRoleOf(G), null, 0, baPlSlotLv(G, 0));
      baV91Activate(0, G, r);
      return { hp: G.monsterHp, locked: G.locked, same: G.currentMonster === m };
    });
    ok(r3.hp <= 0 || !r3.same, 'อสูรล้มจากการร่าย');
    ok(r3.locked || !r3.same, 'เทิร์นถูกล็อกกันหมดเวลาตัดสินกับศพ');
    await page.waitForFunction(() => G.currentMonster && G.monsterHp > 0 && !G.locked, null, { timeout: 6000 }).catch(() => {});
    const r3b = await page.evaluate(() => ({ locked: G.locked, hp: G.monsterHp }));
    ok(!r3b.locked && r3b.hp > 0, 'อสูรตัวใหม่มาและปลดล็อกเอง');

    head('4) ความสูงการ์ดโจทย์ (CLS)');
    const card = await page.evaluate(() => { const e = document.querySelector('.ac-battle'); document.getElementById('gFeedback').textContent = ''; return e ? e.offsetHeight : 0; });
    say('    card offsetHeight = ' + card);
    ok(errs.length === 0, 'ไม่มี pageerror ' + JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  } catch (e) { fail++; say('  ❌ CRASH ' + e.stack); }
  await browser.close();
  say('\n✅ ผ่าน ' + pass + '   ❌ ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
