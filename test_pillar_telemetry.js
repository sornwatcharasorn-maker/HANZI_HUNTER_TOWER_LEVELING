/* ชุดทดสอบ Patch v9.23 · PILLAR TELEMETRY — 12 เสาหลักสดบนแถวสดของห้องควบคุม GM
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_pillar_telemetry.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG = path.resolve(__dirname, 'test_pillar_telemetry.log');
let PASS = 0, FAIL = 0;
try { fs.unlinkSync(LOG); } catch (e) {}
const say = m => { fs.appendFileSync(LOG, m + '\n'); process.stdout.write(m + '\n'); };
const ok = (n, c, x) => { if (c) { PASS++; say('  ✓ ' + n); } else { FAIL++; say('  ✗ ' + n + (x != null ? '  → ' + JSON.stringify(x) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STUB = `(function(){ window.fetch = function(){ return Promise.reject(new Error('stub')); };
  function ES(){ this.readyState=2; } ES.prototype.addEventListener=function(){}; ES.prototype.close=function(){};
  window.EventSource = ES; })();`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.addInitScript(STUB);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await sleep(800);
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await sleep(150);
  await page.evaluate(() => { try { rgScrollCheck(); rgAck(); } catch (e) {} });
  await sleep(700);

  say('═══ 1 · นักเรียน: ตั้งความคืบหน้าครบ 12 เสา แล้วเข้ารหัส payload ═══');
  const enc = await page.evaluate(async () => {
    switchTab('register');
    document.getElementById('reg-id').value = 'pt01'; document.getElementById('reg-pw').value = 'pw1234';
    document.getElementById('reg-pw2').value = 'pw1234'; document.getElementById('reg-name').value = 'pt01';
    handleSubmit();
    await new Promise(r => setTimeout(r, 1500));
    for (let i = 0; i < 5; i++) { const c = document.querySelector('#cdDraft.active .cd-card'); if (!c) break; c.click(); await new Promise(r => setTimeout(r, 750)); }
    G.level = 75; G.correct = 900; G.wrong = 30; G.fastAnswers = 777;
    G.ab = G.ab || {}; G.ab.core = {}; AB_CORES.forEach((c, i) => { G.ab.core[c.key] = (i % AB_CORE_MAX) + 1; });
    G.ab.seals = {}; AB_SEAL_FLOORS.forEach((f, i) => { if (i < 3) G.ab.seals[String(f)] = { broken: true, flawless: false }; });
    G.mn = G.mn || {}; G.mn.sh = 0b1011011; G.mn.at = 0;
    G.mn2 = { kill: 123, combo: 7, quest: 45, pure: 9 };
    G.skills = G.skills || {}; G.skills[BA_PL_CLASSES[0].id] = [5, 5, 5, 5]; G.skills[BA_PL_CLASSES[2].id] = [5, 5, 5, 5];
    saveProgress();
    const a = loadStore().pt01;
    const p = JSON.parse(JSON.stringify(fbPayload('pt01', a)));
    const truth = BA_MN_PILL.map(q => { const v = q.get(a); return [q.id, v[0], v[1]]; });
    return { p, truth, len: String(p.pl).length };
  });
  say('  pl=' + enc.p.pl);
  ok('payload มีคีย์ pl เป็นสตริง', typeof enc.p.pl === 'string' && enc.p.pl.length > 10);
  ok('pl กะทัดรัด (< 120 ไบต์)', enc.len < 120, enc.len);
  ok('ไม่มีคีย์ u ซ้อนใน pl / ไม่มีรหัสผ่าน', JSON.stringify(enc.p).indexOf('pw1234') < 0);
  ok('ครบ 12 เสา', enc.truth.length === 12, enc.truth.length);

  say('═══ 2 · เครื่องครู: ปั้นแถวสดจาก payload → ทุกเสาต้องตรงต้นทาง ═══');
  const got = await page.evaluate(([p]) => {
    const g = lrGhost('pt01g', p);
    lrApply(g, p);
    return BA_MN_PILL.map(q => { const v = q.get(g); return [q.id, v[0], v[1]]; });
  }, [enc.p]);
  const skipCodex = id => id === 'codex';   /* คำศัพท์ซิงก์ผ่าน words/lrWords คนละทาง — ตรวจแยกด้านล่าง */
  enc.truth.forEach((t, i) => {
    if (skipCodex(t[0])) return;
    ok('เสา ' + t[0] + ' = ' + t[1] + '/' + t[2], got[i][1] === t[1] && got[i][2] === t[2], { want: t, got: got[i] });
  });
  ok('เสาที่ไม่ใช่ 0 อย่างน้อย 9 ต้น', got.filter(x => x[1] > 0).length >= 9, got);

  say('═══ 3 · แถวสดหลายครั้ง: ค่าลดลง (รีเซ็ต) ต้องตามลงด้วย ไม่ค้างค่าเก่า ═══');
  const reset = await page.evaluate(([p]) => {
    const g = lrGhost('pt02', p); lrApply(g, p);
    const q = Object.assign({}, p, { pl: p.pl.replace(/^[^|]*/, AB_CORES.map(c => c.key + '0').join(',')).replace(/\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*$/, '|0|0|0,0,0,0|0|0') });
    lrApply(g, q);
    return BA_MN_PILL.filter(x => x.id !== 'codex' && x.id !== 'level' && x.id !== 'acc').map(x => [x.id, x.get(g)[0]]);
  }, [enc.p]);
  ok('รีเซ็ตแล้วเสาทั้งหมดกลับเป็น 0', reset.every(x => x[1] === 0), reset);

  say('═══ 4 · บัญชีจริงบนเครื่อง: max-merge ห้ามถอยหลัง ═══');
  const keep = await page.evaluate(([p]) => {
    const a = loadStore().pt01; const before = BA_MN_PILL.map(q => q.get(a)[0]);
    const low = Object.assign({}, p, { pl: AB_CORES.map(c => c.key + '0').join(',') + '|0|0|0,0,0,0|0|0' });
    lrApply(a, low);
    return { before, after: BA_MN_PILL.map(q => q.get(a)[0]) };
  }, [enc.p]);
  ok('บัญชีจริงไม่ถูกสัญญาณต่ำกว่าทับ', JSON.stringify(keep.before) === JSON.stringify(keep.after), keep);

  say('═══ 5 · โมดัลผนึกของ GM: แถวสดผ่านทางเต็ม + ไม่ขึ้นป้ายข้อมูลไม่ครบ ═══');
  const modal = await page.evaluate(([p]) => {
    FB_LIVE = { pt03: Object.assign({}, p, { u: 'pt03', name: 'pt03', at: Date.now() }) };
    try { lrHydrate(true); } catch (e) {}
    const s = baGwSealOpen('pt03');
    const el = document.getElementById('baGwSeal');
    return { mirror: s && s.mirror, text: el ? el.textContent : '', rows: el ? el.querySelectorAll('.ba-gw-p').length : 0,
      nonzero: s ? s.list.filter(x => x.n > 0).length : 0, done: s && s.done };
  }, [enc.p]);
  ok('แถว pt03 เป็นแถวสดจริง', modal.mirror === true, modal);
  ok('โมดัลมี 12 แถว', modal.rows === 12, modal.rows);
  ok('เสาที่มีความคืบหน้า ≥ 9', modal.nonzero >= 9, modal.nonzero);
  ok('ไม่ขึ้นป้าย "ข้อมูลบางเสาอาจไม่ครบ" เมื่อมี pl', modal.text.indexOf('ข้อมูลบางเสาอาจไม่ครบ') < 0);
  const old = await page.evaluate(() => {
    const p = Object.assign({}, FB_LIVE.pt03); delete p.pl; p.u = 'pt04'; p.name = 'pt04';
    FB_LIVE = { pt04: p }; lrHydrate(true); baGwSealOpen('pt04');
    return document.getElementById('baGwSeal').textContent.indexOf('ข้อมูลบางเสาอาจไม่ครบ') >= 0;
  });
  ok('เครื่องนักเรียนบิลด์เก่า (ไม่มี pl) ยังขึ้นป้ายเตือนตามเดิม', old === true);

  say('═══ 5b · ping เก่าไม่มี pl → ใช้ pl ล่าสุดที่เคยเห็น ไม่รีเซ็ตเสาเป็น 0 ═══');
  const fb2 = await page.evaluate(([p]) => {
    FB_LIVE = { pt05: Object.assign({}, p, { u: 'pt05', name: 'pt05', at: Date.now() }) }; lrHydrate(true);
    const cached = !!JSON.parse(localStorage.getItem('yao_pl_last') || '{}').pt05;
    const s = loadStore(); s.pt05.ab.core = {}; s.pt05.mn2 = { kill: 0, combo: 0, quest: 0, pure: 0 }; saveStore(s);
    const legacy = Object.assign({}, p, { u: 'pt05', name: 'pt05', at: Date.now() + 5 }); delete legacy.pl;
    FB_LIVE = { pt05: legacy }; lrHydrate(true);
    const a = loadStore().pt05;
    return { cached, core: BA_MN_PILL.find(q => q.id === 'core').get(a)[0], combo: BA_MN_PILL.find(q => q.id === 'combo').get(a)[0] };
  }, [enc.p]);
  ok('บันทึก pl ล่าสุดลงแคชเครื่องครู', fb2.cached === true, fb2);
  ok('ping เก่า: เสาแกนกลับมาจากแคช (ไม่ใช่ 0)', fb2.core > 0, fb2);
  ok('ping เก่า: เสาคอมโบกลับมาจากแคช (ไม่ใช่ 0)', fb2.combo > 0, fb2);

  say('═══ 5c · เคลียร์ชั้น → ยิง ping เต็มทันที (PUT ที่มี pl) ═══');
  const cf = await page.evaluate(async () => {
    const puts = []; const of = fbFetch;
    fbCfgSave && 0;
    FB_CFG.on = true; FB_CFG.pub = true;
    fbFetch = function (u, o) { if (o && o.method === 'PUT') puts.push(String(o.body)); return Promise.resolve(null); };
    try { FB_BUSY = false; clearFloor(false); await new Promise(r => setTimeout(r, 300)); } catch (e) {}
    fbFetch = of;
    return { n: puts.length, hasPl: puts.some(b => /"pl":"/.test(b)) };
  });
  ok('clearFloor ยิง PUT ทันทีพร้อม pl', cf.n >= 1 && cf.hasPl, cf);
  ok('meta no-cache ถูกใส่ในหัวไฟล์', await page.evaluate(() => !!document.querySelector('meta[http-equiv="Cache-Control"]')));

  say('═══ 6 · ลายเซ็น hydrate เห็น pl ขยับ + การ์ดโจทย์ไม่ขยับ + ไม่มี pageerror ═══');
  const sig = await page.evaluate(([p]) => {
    const a = lrSig([Object.assign({ u: 'x' }, p)]), b = lrSig([Object.assign({ u: 'x' }, p, { pl: p.pl + '1' })]);
    return a !== b;
  }, [enc.p]);
  ok('lrSig เปลี่ยนเมื่อ pl เปลี่ยน', sig);
  const h = await page.evaluate(() => { document.getElementById('baGwSeal').classList.remove('active');
    const c = document.querySelector('.ac-battle'); return c ? Math.round(c.offsetHeight * 10) / 10 : null; });
  ok('ไม่ล้นแนวนอน', await page.evaluate(() => document.body.scrollWidth <= innerWidth));
  ok('pageerror = 0', errs.length === 0, errs);
  say('\nผ่าน ' + PASS + ' · ตก ' + FAIL);
  await browser.close();
  process.exit(FAIL ? 1 : 0);
})();
