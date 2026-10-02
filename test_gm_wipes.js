/* ชุดเทสต์ Patch v9.21 — GM WIPE ENGINE (3-TIER) · 6 โหมดใหม่ · 🏛️ ผนึก
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_gm_wipes.js
   พิสูจน์ว่าหลังกดล้างแล้ว saveProgress + รีโหลดหน้า ข้อมูลไม่ถูกเขียนทับกลับ (ghost) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
let PASS = 0, FAIL = 0;
function ok(n, c, x) { if (c) { PASS++; console.log('  ✅ ' + n); } else { FAIL++; console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } }
const STUB = `window.__RT={log:[]};window.EventSource=function(){this.close=function(){};this.addEventListener=function(){}};
window.fetch=function(u,o){window.__RT.log.push({url:String(u),method:(o&&o.method)||'GET',body:(o&&o.body)||''});
return Promise.resolve({ok:true,status:200,text:function(){return Promise.resolve('null')},json:function(){return Promise.resolve(null)}});};`;

async function boot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}
const RICH = () => {
  const s = loadStore();
  ['zed', 'bob'].forEach(u => {
    const a = s[u];
    a.level = 30; a.exp = 500; a.gold = 5000; a.totalGoldEarned = 9000; a.floor = 12; a.maxFloor = 15;
    a.towerClears = 3; a.bossClears = 4; a.correct = 300; a.wrong = 50; a.best = 20;
    a.wordStats = { 1: { seen: 6, wrong: 2, recent: [false, true] }, 2: { seen: 5, wrong: 0, recent: [true] } };
    a.items = { potion: 3 }; a.ab = a.ab || {}; a.ab.shards = 900; a.ab.core = { mp: 3, time: 2, gold: 1 };
    a.r20 = { assassin: 1 }; a.pureRole = 'assassin'; a.skills = { assassin: [3, 3, 3, 3] }; a.ult = 4;
    a.codex = { ms: 2, first: { 1: 1 } };
  });
  saveStore(s);
};
const SNAP = () => JSON.parse(JSON.stringify(loadStore()));
const WS_SEEN_NET = ws => Object.keys(ws || {}).reduce((n, k) => n + ((ws[k].seen - ws[k].wrong) > 0 ? 1 : 0), 0);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const MODES = ['full', 'level', 'floor', 'gold', 'vocab', 'wrongs', 'p4', 'skills', 'gems', 'core'];
  const CHECK = {
    full:   a => a.level === 1 && a.gold === 0 && a.maxFloor === 1 && a.correct === 0 && a.totalGoldEarned === 0 && !Object.keys(a.wordStats || {}).length && a.ab.shards === 0 && !Object.keys(a.r20 || {}).length,
    level:  a => a.level === 1 && a.exp === 0 && a.gold === 5000 && a.maxFloor === 15,
    floor:  a => a.maxFloor === 1 && a.towerClears === 0 && a.bossClears === 0 && a.level === 30,
    gold:   a => a.gold === 0 && a.level === 30 && a.totalGoldEarned === 9000,
    vocab:  a => !Object.keys(a.wordStats || {}).length && a.codex.ms === -1 && a.level === 30 && a.ab.shards === 900,
    wrongs: a => Object.keys(a.wordStats || {}).every(k => a.wordStats[k].wrong === 0) && WS_SEEN_NET(a.wordStats) === 2 && a.level === 30,
    p4:     a => JSON.stringify(a.r20) === '{}' && !a.pureRole && a.skills.assassin[0] === 3,
    skills: a => Object.keys(a.skills).every(c => a.skills[c].every(v => v === 1)) && (!a.ult || !a.ult.pips) && !!a.r20.assassin,
    gems:   a => a.ab.shards === 0 && a.ab.core.mp === 3,
    core:   a => a.ab.shards === 0 && Object.keys(a.ab.core).every(k => a.ab.core[k] === 0) && a.level === 30
  };
  for (const active of [true, false]) {
    console.log(active ? '── เซสชันที่กำลังเล่น (ghost เสี่ยงสุด)' : '── บัญชีที่ไม่ได้เล่นอยู่');
    for (const mode of MODES) {
      const { ctx, page, errs } = await boot(browser);
      await page.evaluate(() => { switchTab('register'); document.getElementById('reg-id').value = 'zed'; document.getElementById('reg-pw').value = '1111'; document.getElementById('reg-pw2').value = '1111'; handleSubmit(); });
      await page.waitForTimeout(800);
      await page.evaluate(() => exitGame()); await page.waitForTimeout(250);
      await page.evaluate(() => { switchTab('register'); document.getElementById('reg-id').value = 'bob'; document.getElementById('reg-pw').value = '2222'; document.getElementById('reg-pw2').value = '2222'; handleSubmit(); });
      await page.waitForTimeout(800);
      await page.evaluate(() => exitGame()); await page.waitForTimeout(250);
      await page.evaluate(RICH);
      const target = active ? 'zed' : 'bob';
      await page.evaluate(() => { switchTab('login'); document.getElementById('login-id').value = 'zed'; document.getElementById('login-pw').value = '1111'; handleSubmit(); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => { const d = document.querySelector('#cdDraft.active .cd-card'); if (d) d.click(); });
      await page.waitForTimeout(800);
      await page.evaluate(m => { document.querySelectorAll('.g-modal.active').forEach(x => x.classList.remove('active')); }, mode);
      await page.evaluate(([u, m]) => { baMrApply(u, m); saveProgress(); }, [target, mode]);
      await page.waitForTimeout(200);
      await page.evaluate(() => { try { saveProgress(); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
      const after = (await page.evaluate(SNAP))[target];
      ok((active ? 'active ' : 'inactive ') + mode + ' ล้างจริงหลังรีโหลด', CHECK[mode](after), { lv: after.level, g: after.gold, ab: after.ab, ws: after.wordStats, r20: after.r20, sk: after.skills, ult: after.ult });
      ok('  auth รอด (pw) ' + mode, after.pw === (active ? '1111' : '2222'));
      ok('  ไม่มี pageerror ' + mode, errs.length === 0, errs);
      await ctx.close();
    }
  }
  /* คลาวด์ + โมดัลผนึก */
  {
    const { ctx, page, errs } = await boot(browser);
    await page.evaluate(() => { switchTab('register'); document.getElementById('reg-id').value = 'zed'; document.getElementById('reg-pw').value = '1111'; document.getElementById('reg-pw2').value = '1111'; handleSubmit(); });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => { __RT.log.length = 0; baMrApply('zed', 'vocab'); return { on: fbOn(), log: __RT.log.map(l => l.method + ' ' + l.url) }; });
    ok('fbOn + PUT /wordbank/zed หลังล้างคลังคำ', info.on && info.log.some(l => /^PUT .*wordbank.*zed/.test(l)), info);
    await page.evaluate(() => { const s = loadStore(); s.zed.level = 99; s.zed.wordStats = { 1: { seen: 3, wrong: 0 }, 2: { seen: 3, wrong: 0 } }; saveStore(s); G.level = 99; G.wordStats = JSON.parse(JSON.stringify(s.zed.wordStats)); document.getElementById('teacher-code').value = TEACHER_PIN; openTeacherPanel(); });
    await page.waitForTimeout(500);
    const row = await page.evaluate(() => { fbPaint(); baUniPaint(); return { btn: !!document.querySelector('#baUniBody button[data-a="seal"]') }; });
    ok('ปุ่ม 🏛️ ผนึก อยู่ในแถว', row.btn);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    ok('ตารางไม่ล้นแนวนอน', sw);
    await page.evaluate(() => { document.querySelector('#baUniBody button[data-a="seal"]').click(); });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const el = document.getElementById('baGwSeal'); const r = el.querySelector('.g-modal-inner').getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + 30);
      return { active: el.classList.contains('active'), vis: !!(top && top.closest('#baGwSeal')), sum: document.getElementById('baGwSealSum').textContent,
               rows: document.querySelectorAll('#baGwSeal .ba-gw-p').length, lv: document.querySelector('#baGwSeal [data-id="level"]').textContent, codex: document.querySelector('#baGwSeal [data-id="codex"]').textContent };
    });
    ok('โมดัลผนึกเปิดและมองเห็นจริง', m.active && m.vis, m);
    ok('12 เสา + สรุป X/12', m.rows === 12 && /ปลดแล้ว: \d+\/12/.test(m.sum), m);
    ok('เสาเลเวล 99/99 ผ่าน', /✅.*99\/99/.test(m.lv), m.lv);
    ok('เสาคลัง 2/329 ยังไม่สำเร็จ', /⏳.*2\/329/.test(m.codex), m.codex);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }
  console.log('\nผ่าน ' + PASS + ' · ตก ' + FAIL);
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
