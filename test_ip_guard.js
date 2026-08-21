/* ชุดเทสต์ Micro-Patch — INTELLECTUAL PROPERTY GUARD · ANTI-TAMPER · TAB TITLE
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_ip_guard.js

   สามเรื่องที่ชุดนี้ทำต่างจากชุดอื่น และเป็นเหตุผลที่มันจับบั๊คได้
   1. **จำลองโดเมนด้วย page.route** — เสิร์ฟไฟล์แจกใบเดิมเป๊ะที่ URL ปลอม
      จึงวัด location.hostname ของจริงได้โดยไม่ต้องตั้งเซิร์ฟเวอร์
   2. **ปั้นไฟล์ที่ถูกดัดแปลงจริง ๆ** (แทนที่ base64 ลิขสิทธิ์แล้วปล่อย Checksum
      ค้างไว้) เพื่อพิสูจน์ว่า Game Loop หยุดจริง — const แก้ตอนรันไม่ได้
      เคสนี้จึงเป็นเคสเดียวที่พิสูจน์ข้อกำหนดข้อ 1 ได้แบบครบวงจร
   3. **ยืนยันว่า file:// ยังผ่านเสมอ** ซึ่งเป็นช่องทางแจกหลักของเกม            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const FILE = 'file://' + DIST;
const HTML = fs.readFileSync(DIST, 'utf8');
const LOG  = path.resolve(__dirname, 'ip_guard_log.txt');
try { fs.unlinkSync(LOG); } catch (e) {}

/* base64 ของข้อความลิขสิทธิ์ที่ฝังอยู่ — ตรงกับ BA_IP_B64 ในซอร์ส */
const B64 = 'wqkgMjAyNiDguITguKPguLnguKfguLHguIrguKPguKrguKMgwrcgSEFOWkkgSFVOVEVSIOKAlCBUT1dFUiBMRVZFTElORyDCtyDguKrguIfguKfguJnguKXguLTguILguKrguLTguJfguJjguLTguYw=';
const OWNER = Buffer.from(B64, 'base64').toString('utf8');
const TITLE = 'Hanzi Hunter 🗼';

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra != null ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want }); }

/* stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริงไว้ในซอร์ส
   ไม่ stub = เทสต์ยิงเข้าห้องเรียนจริง · จดทุกคำขอไว้ที่ window.__NET.log */
const STUB = `
  window.__NET = { log: [] };
  window.fetch = function (u, o) {
    window.__NET.log.push({ url: String(u), method: (o && o.method) || 'GET' });
    return Promise.resolve({ ok: true, status: 200,
      text: function () { return Promise.resolve('null'); },
      json: function () { return Promise.resolve(null); } });
  };
  window.EventSource = function (url) {
    this.url = url; this.readyState = 1;
    this.close = function () { this.readyState = 2; };
    this.addEventListener = function () {}; this.removeEventListener = function () {};
  };
`;

async function open(browser, url, body, vw) {
  const ctx = await browser.newContext({ viewport: { width: vw || 1200, height: vw ? 850 : 950 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  if (body) await page.route(url, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
const audit = page => page.evaluate(() => baBattleAudit().ipGuard);

/* กดอีเวนต์จริงแล้วดูว่าถูก preventDefault ไหม */
const fire = (page, sel, type) => page.evaluate(([s, t]) => {
  const el = s ? document.querySelector(s) : document;
  if (!el) return null;
  return !el.dispatchEvent(new Event(t, { bubbles: true, cancelable: true }));
}, [sel, type]);

const key = (page, k, mods) => page.evaluate(([k, m]) => {
  const e = new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, m || {}));
  return !document.dispatchEvent(e);
}, [k, mods]);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ═══ 1 · ป้ายแท็บ · ลายเซ็นลิขสิทธิ์ · Checksum ════════════════════════════
  {
    say('\n═══ 1 · ป้ายแท็บ · ลายเซ็นลิขสิทธิ์ · Checksum ═══');
    const { ctx, page, errs } = await open(browser, FILE);

    eq('แท็บใช้ชื่อ Hanzi Hunter 🗼', await page.title(), TITLE);
    eq('<title> ในไฟล์ถูกตั้งเป็นชื่อเดียวกัน',
       /<title>([^<]*)<\/title>/.exec(HTML)[1], TITLE);

    const a = await audit(page);
    eq('document.title ตรงกับค่าที่ตั้งไว้', a.title, a.want);
    eq('ถอดรหัสข้อความลิขสิทธิ์ได้ตรงกับต้นทาง', a.owner, OWNER);
    ok('ข้อความลิขสิทธิ์ไม่ว่าง', a.owner.length > 10, a.owner);
    ok('Checksum ตรง', a.ok, { sum: a.sum });
    eq('ยังไม่ถูกล็อก', a.dead, '');
    eq('ยังไม่มีการบล็อกสักครั้ง', a.n.block, 0);
    eq('ยังไม่พบการดัดแปลง', a.n.tamper, 0);

    ok('ป้ายลิขสิทธิ์ถูกวางบนจอจริง', a.credit);
    const cs = await page.evaluate(() => {
      const c = document.getElementById('baIpCredit'), s = getComputedStyle(c);
      return { pos: s.position, pe: s.pointerEvents, txt: c.textContent, z: s.zIndex };
    });
    eq('ป้ายเป็น position:fixed (ไม่กินเลย์เอาต์)', cs.pos, 'fixed');
    eq('ป้ายเป็น pointer-events:none (ไม่ขวาง elementFromPoint)', cs.pe, 'none');
    eq('ป้ายแสดงชื่อเจ้าของครบทั้งข้อความ', cs.txt, OWNER);

    /* ถอดป้ายตอนรัน = ปั้นคืนให้เอง + นับไว้ แต่ไม่หยุดเกม (DOM ถูกกวาดโดยสุจริตได้) */
    const heal = await page.evaluate(() => {
      document.getElementById('baIpCredit').remove();
      const before = baBattleAudit().ipGuard.n.tamper;
      baIpCheck();
      const g = baBattleAudit().ipGuard;
      return { before, after: g.n.tamper, credit: g.credit, dead: g.dead };
    });
    ok('ถอดป้ายแล้วถูกนับว่าดัดแปลง', heal.after === heal.before + 1, heal);
    ok('ถอดป้ายแล้วถูกปั้นคืนให้เอง', heal.credit);
    eq('ถอดป้ายตอนรันไม่หยุดเกม (ปั้นคืนชนะการลบอยู่แล้ว)', heal.dead, '');

    /* แก้ข้อความบนป้ายตอนรันก็ถูกเขียนกลับเป็นของจริง */
    const back = await page.evaluate(() => {
      document.getElementById('baIpCredit').textContent = 'hacked';
      baIpCheck();
      return document.getElementById('baIpCredit').textContent;
    });
    eq('แก้ข้อความบนป้ายแล้วถูกเขียนกลับ', back, OWNER);

    /* เปลี่ยนชื่อแท็บตอนรันก็ถูกตั้งกลับ */
    eq('เปลี่ยนชื่อแท็บแล้วถูกตั้งกลับ',
       await page.evaluate(() => { document.title = 'x'; baIpCheck(); return document.title; }), TITLE);

    eq('base64 ลิขสิทธิ์รอดผ่านการย่อไฟล์มาครบ (เจอ 1 ครั้ง)',
       HTML.split(B64).length - 1, 1);
    ok('ชื่อเจ้าของไม่โผล่เป็นตัวอักษรตรง ๆ ในไฟล์แจก (Lightweight Obfuscation)',
       HTML.indexOf(OWNER) < 0);

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 2 · ยามโดเมน ═════════════════════════════════════════════════════════
  {
    say('\n═══ 2 · ยามโดเมน ═══');

    /* 2.1 file:// — ช่องทางแจกหลักของเกม ต้องผ่านเสมอ */
    {
      const { ctx, page } = await open(browser, FILE);
      const a = await audit(page);
      eq('file:// อ่าน hostname ได้เป็นค่าว่าง', a.host, '');
      ok('file:// ผ่านยามโดเมน', a.hostOk);
      eq('file:// ไม่ถูกล็อก', a.dead, '');
      await ctx.close();
    }

    /* 2.2 GitHub Pages */
    {
      const url = 'https://sornwatcharasorn-maker.github.io/hanzi.html';
      const { ctx, page } = await open(browser, url, HTML);
      const a = await audit(page);
      eq('อ่าน hostname ของ github.io ได้', a.host, 'sornwatcharasorn-maker.github.io');
      ok('*.github.io ผ่านยามโดเมน', a.hostOk);
      eq('*.github.io ไม่ถูกล็อก', a.dead, '');
      await ctx.close();
    }

    /* 2.3 Dev Host Bypass */
    {
      const { ctx, page } = await open(browser, 'http://localhost:9/x.html', HTML);
      const a = await audit(page);
      ok('localhost ผ่านยามโดเมน', a.hostOk);
      ok('localhost ถูกนับเป็นเครื่องทดสอบ', a.devHost);
      eq('localhost ไม่ถูกล็อก', a.dead, '');
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, 'http://127.0.0.1:9/x.html', HTML);
      const a = await audit(page);
      ok('127.0.0.1 ผ่านยามโดเมน', a.hostOk);
      ok('127.0.0.1 ถูกนับเป็นเครื่องทดสอบ', a.devHost);
      await ctx.close();
    }

    /* 2.4 โดเมนที่ไม่ได้รับอนุญาต — ต้องหยุด Game Loop ทันที */
    {
      const url = 'https://stolen-copy.example.com/hanzi.html';
      const { ctx, page } = await open(browser, url, HTML);
      const a = await audit(page);
      eq('อ่าน hostname ของโดเมนแปลกปลอมได้', a.host, 'stolen-copy.example.com');
      ok('โดเมนแปลกปลอมไม่ผ่านยามโดเมน', !a.hostOk);
      ok('โดเมนแปลกปลอมถูกล็อกทันทีตั้งแต่โหลดหน้า', a.dead !== '', a.dead);

      const veil = await page.evaluate(() => {
        const v = document.getElementById('baIpVeil');
        if (!v) return null;
        const b = v.getBoundingClientRect(), s = getComputedStyle(v);
        return { w: b.width, h: b.height, disp: s.display, txt: v.textContent };
      });
      ok('ม่านล็อกถูกวางและมองเห็นเต็มจอ', !!veil && veil.w > 100 && veil.h > 100, veil);
      ok('ม่านล็อกบอกเหตุผลเป็นภาษาไทย', !!veil && veil.txt.indexOf('SYSTEM LOCKED') >= 0);
      ok('ม่านล็อกยังประกาศชื่อเจ้าของ', !!veil && veil.txt.indexOf(OWNER) >= 0);

      /* Game Loop ต้องเดินไม่ได้เลย */
      const blocked = await page.evaluate(() => {
        const b0 = baBattleAudit().ipGuard.n.block;
        enterGate(); startGame(); answer('x', null); scheduleTurn(function () {}, 10);
        return { b0, b1: baBattleAudit().ipGuard.n.block,
                 playing: !!document.getElementById('gameScreen').classList.contains('active') };
      });
      ok('ทุกทางเข้า Game Loop ถูกบล็อก', blocked.b1 - blocked.b0 >= 4, blocked);
      ok('เข้าหน้าเล่นไม่ได้', !blocked.playing);
      await ctx.close();
    }
  }

  // ═══ 3 · แก้ข้อความลิขสิทธิ์ในไฟล์ = หยุด Game Loop ════════════════════════
  {
    say('\n═══ 3 · แก้ข้อความลิขสิทธิ์ในไฟล์ = หยุด Game Loop ═══');
    const fake = Buffer.from('© 2026 ขโมยเอาไปเป็นของตัวเอง', 'utf8').toString('base64');
    const bad = HTML.replace(B64, fake);
    ok('ปั้นไฟล์ที่ถูกดัดแปลงได้จริง', bad !== HTML && bad.indexOf(fake) > 0);

    const tmp = path.join(require('os').tmpdir(), 'ip_tampered.html');
    fs.writeFileSync(tmp, bad);
    const { ctx, page, errs } = await open(browser, 'file://' + tmp);

    const a = await audit(page);
    ok('Checksum ไม่ตรงทันทีที่ข้อความถูกแก้', !a.ok, { sum: a.sum, want: a.wantSum });
    ok('ถูกนับว่าดัดแปลง', a.n.tamper > 0, a.n);
    ok('Game Loop ถูกหยุดทันที', a.dead !== '', a.dead);
    ok('ม่านล็อกขึ้นจอ', await page.evaluate(() => !!document.getElementById('baIpVeil')));

    const blocked = await page.evaluate(() => {
      enterGate(); startGame();
      return document.getElementById('gameScreen').classList.contains('active');
    });
    ok('เข้าเกมไม่ได้เลย', !blocked);
    ok('ไม่มี pageerror (ล็อกอย่างสุภาพ ไม่ใช่พังทั้งหน้า)', errs.length === 0, errs);

    try { fs.unlinkSync(tmp); } catch (e) {}
    await ctx.close();
  }

  // ═══ 4 · กันคัดลอกทรัพย์สิน · ยกเว้นช่องกรอกเสมอ ═══════════════════════════
  {
    say('\n═══ 4 · กันคัดลอกทรัพย์สิน · ยกเว้นช่องกรอกเสมอ ═══');
    const { ctx, page, errs } = await open(browser, FILE);

    for (const ev of ['contextmenu', 'selectstart', 'copy', 'cut', 'dragstart']) {
      ok('บล็อก ' + ev + ' บน UI ทั่วไป', await fire(page, '#introScreen', ev));
    }

    /* ยกเว้นช่องกรอก — นักเรียนต้องพิมพ์รหัสฮันเตอร์/รหัสผ่านได้ตามปกติ */
    await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(120);
    await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
    await page.waitForTimeout(700);

    for (const ev of ['contextmenu', 'selectstart', 'copy', 'cut']) {
      ok('ยกเว้น ' + ev + ' ที่ <input>', (await fire(page, '#login-id', ev)) === false);
    }
    ok('พิมพ์ลงช่องรหัสฮันเตอร์ได้จริง', await page.evaluate(() => {
      const el = document.getElementById('login-id');
      el.focus(); el.value = 'student01';
      return document.activeElement === el && el.value === 'student01';
    }));
    ok('เลือกข้อความในช่องกรอกได้ (execCommand copy ของ v5.3.1 ยังทำงาน)',
       await page.evaluate(() => {
         const el = document.getElementById('login-id');
         el.select();
         return el.selectionEnd - el.selectionStart === el.value.length;
       }));

    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 5 · บล็อกคีย์ลัด Inspect / View Source ════════════════════════════════
  {
    say('\n═══ 5 · บล็อกคีย์ลัด Inspect / View Source ═══');
    const { ctx, page, errs } = await open(browser, FILE);

    ok('บล็อก F12', await key(page, 'F12'));
    ok('บล็อก Ctrl+Shift+I', await key(page, 'I', { ctrlKey: true, shiftKey: true }));
    ok('บล็อก Ctrl+Shift+J', await key(page, 'J', { ctrlKey: true, shiftKey: true }));
    ok('บล็อก Ctrl+Shift+C', await key(page, 'C', { ctrlKey: true, shiftKey: true }));
    ok('บล็อก Ctrl+U (View Source)', await key(page, 'u', { ctrlKey: true }));
    ok('บล็อก Ctrl+S (Save Page)', await key(page, 's', { ctrlKey: true }));
    ok('บล็อก Cmd+Shift+I บนแมค', await key(page, 'I', { metaKey: true, shiftKey: true }));

    /* ปุ่มปกติต้องไม่ถูกยามชั้นนี้แตะเลย — วัดที่ตัวนับของเราเอง ไม่ใช่ที่ defaultPrevented
       เพราะหน้าต้อนรับของ v5.6 ดัก Enter/Space ไปเข้าเกทเองอยู่แล้วโดยชอบธรรม */
    const quiet = async (k, m) => {
      const n0 = (await audit(page)).n.dev;
      await key(page, k, m);
      return (await audit(page)).n.dev === n0;
    };
    ok('ไม่แตะปุ่ม Enter (หน้าต้อนรับของ v5.6 ยังใช้เข้าเกทได้)', await quiet('Enter'));
    ok('ไม่แตะลูกศร', await quiet('ArrowDown'));
    ok('ไม่แตะ Ctrl+C (คัดลอกทั่วไปจัดการที่อีเวนต์ copy)', await quiet('c', { ctrlKey: true }));
    ok('ไม่แตะการพิมพ์ตัวอักษรธรรมดา', await quiet('a'));

    const a = await audit(page);
    ok('นับจำนวนครั้งที่กันคีย์ลัดไว้', a.n.dev >= 7, a.n);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 6 · ปิดผนึกคลังคำศัพท์ ═══════════════════════════════════════════════
  {
    say('\n═══ 6 · ปิดผนึกคลังคำศัพท์ ═══');
    const { ctx, page, errs } = await open(browser, FILE);

    const a = await audit(page);
    ok('VOCAB ถูกแช่แข็ง', a.frozen);

    const seal = await page.evaluate(() => {
      const w0 = VOCAB[0][1], m0 = THAI_MEANINGS['1'], n0 = VOCAB.length;
      try { VOCAB[0][1] = 'โกง'; } catch (e) {}
      try { VOCAB.push([999, 'x', 'x']); } catch (e) {}
      try { THAI_MEANINGS['1'] = 'เฉลย'; } catch (e) {}
      try { VOCAB_BY_ID[1] = null; } catch (e) {}
      return {
        word: VOCAB[0][1] === w0, len: VOCAB.length === n0,
        mean: THAI_MEANINGS['1'] === m0, byId: !!VOCAB_BY_ID[1],
        frozen: [Object.isFrozen(VOCAB), Object.isFrozen(VOCAB[0]),
                 Object.isFrozen(THAI_MEANINGS), Object.isFrozen(VOCAB_BY_ID),
                 Object.isFrozen(CX_LORE), Object.isFrozen(CX_WORD)]
      };
    });
    ok('เขียนทับคำศัพท์ผ่านคอนโซลไม่ได้', seal.word);
    ok('ยัดคำใหม่เข้า VOCAB ไม่ได้', seal.len);
    ok('เขียนทับคำแปล (เฉลย) ไม่ได้', seal.mean);
    ok('ล้างดัชนี VOCAB_BY_ID ไม่ได้', seal.byId);
    eq('แช่แข็งครบทั้ง 6 ก้อน', seal.frozen, [true, true, true, true, true, true]);

    /* ของที่ชั้นบนแก้ในที่โดยชอบธรรม ต้อง **ไม่** ถูกแช่แข็ง */
    const live = await page.evaluate(() => ({
      items: Object.isFrozen(ITEMS), titles: Object.isFrozen(TITLES),
      seals: Object.isFrozen(AB_SEAL_FLOORS), lvrank: Object.isFrozen(BA_LVRANK),
      sfx: Object.isFrozen(AU_SFX_DEF), clean: Object.isFrozen(MEANING_CLEAN)
    }));
    eq('ไม่แช่แข็ง ITEMS (v7.5 เขียนทับในที่)', live.items, false);
    eq('ไม่แช่แข็ง TITLES (หลายชั้น push ฉายาเข้าไป)', live.titles, false);
    eq('ไม่แช่แข็ง AB_SEAL_FLOORS (v6.4 ย้ายชั้นผนึก)', live.seals, false);
    eq('ไม่แช่แข็ง BA_LVRANK (v7.6 ขยับบันไดแรงค์)', live.lvrank, false);
    eq('ไม่แช่แข็ง AU_SFX_DEF (v6.4/v6.6/v6.11 เติมเสียง)', live.sfx, false);
    eq('ไม่แช่แข็ง MEANING_CLEAN (เป็นแคช ต้องเขียนได้)', live.clean, false);

    /* คำถามยังสร้างได้ครบหลังแช่แข็ง */
    const q = await page.evaluate(() => {
      let bad = 0;
      for (let i = 0; i < 200; i++) {
        const m = getMonster._build(VOCAB[i % VOCAB.length], 'A');
        if (!m || !m.choices || m.choices.length !== 4 || m.choices.indexOf(m.answer) < 0) bad++;
      }
      return bad;
    });
    eq('สร้างคำถามได้ครบ 200 ข้อหลังแช่แข็ง', q, 0);
    ok('ไม่มี pageerror', errs.length === 0, errs);
    await ctx.close();
  }

  // ═══ 7 · ล็อกดาวน์ฐานข้อมูล ═══════════════════════════════════════════════
  {
    say('\n═══ 7 · ล็อกดาวน์ฐานข้อมูล ═══');

    /* โดเมนที่ได้รับอนุญาต — fbFetch ต้องวิ่งถึง fetch ตามปกติ */
    {
      const { ctx, page } = await open(browser, FILE);
      const r = await page.evaluate(async () => {
        const n0 = window.__NET.log.length;
        await fbFetch('https://x.firebasedatabase.app/students/a1.json', { method: 'PUT', body: '{}' });
        return { n0, n1: window.__NET.log.length };
      });
      ok('โดเมนที่อนุญาต เขียนฐานข้อมูลได้ตามปกติ', r.n1 > r.n0, r);
      await ctx.close();
    }

    /* โดเมนแปลกปลอม — ห้ามมีคำขอออกไปแม้แต่ครั้งเดียว */
    {
      const { ctx, page } = await open(browser, 'https://stolen-copy.example.com/g.html', HTML);
      const r = await page.evaluate(async () => {
        const n0 = window.__NET.log.length;
        const out = await fbFetch('https://x.firebasedatabase.app/students/a1.json',
                                  { method: 'PUT', body: '{"u":"a1"}' });
        return { n0, n1: window.__NET.log.length, out: out };
      });
      eq('โดเมนแปลกปลอมไม่มีคำขอออกไปสักครั้ง', r.n1, r.n0);
      eq('fbFetch คืน null อย่างสุภาพ (ชั้นบนไม่พัง)', r.out, null);
      await ctx.close();
    }
  }

  // ═══ 8 · เลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียว ═════════════════════════════════
  {
    say('\n═══ 8 · เลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียว ═══');
    const BASE = { 320: 354.8, 360: 340.8, 390: 340.8, 430: 340.8 };

    for (const w of [320, 360, 390, 430]) {
      const { ctx, page, errs } = await open(browser, FILE, null, w);

      await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(120);
      await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} rgAck(); });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        switchTab('register');
        document.getElementById('reg-id').value = 'ip' + Math.floor(Math.random() * 999999);
        document.getElementById('reg-pw').value = '1234';
        document.getElementById('reg-pw2').value = '1234';
        handleSubmit();
      });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
      await page.waitForTimeout(900);

      /* บังคับคำ/ตัวเลือกให้คงที่ + ล้างบรรทัดผลลัพธ์ ทุกความกว้างจึงเทียบกันได้ */
      await page.evaluate(() => {
        const m = G.currentMonster;
        m.word = '北京语言大学';
        m.pinyin = 'Běijīng Yǔyán Dàxué';
        m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
        m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
        document.getElementById('gWord').textContent = m.word;
        document.getElementById('gPinyin').textContent = m.pinyin;
        document.getElementById('gFeedback').textContent = '';
        renderChoices();
      });
      await page.waitForTimeout(250);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await page.waitForTimeout(150);

      const r = await page.evaluate(() => {
        const c = document.querySelector('.ac-battle');
        const cr = document.getElementById('baIpCredit');
        return {
          card: c ? c.getBoundingClientRect().height : -1,
          over: document.body.scrollWidth - window.innerWidth,
          creditHidden: cr ? getComputedStyle(cr).display === 'none' : null,
          creditFixed: cr ? getComputedStyle(cr).position === 'fixed' : null
        };
      });
      ok('จอ ' + w + ': การ์ดโจทย์ไม่โตขึ้น (' + r.card.toFixed(1) + 'px · อ้างอิง ' + BASE[w] + 'px)',
         Math.abs(r.card - BASE[w]) < 0.6, r.card);
      ok('จอ ' + w + ': ไม่ล้นแนวนอน', r.over <= 0, r.over);
      ok('จอ ' + w + ': ป้ายลิขสิทธิ์ซ่อนตัวเองในหน้าเล่น', r.creditHidden === true);
      ok('จอ ' + w + ': ป้ายยังเป็น fixed', r.creditFixed === true);
      ok('จอ ' + w + ': ไม่มี pageerror', errs.length === 0, errs);
      await ctx.close();
    }
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('ผ่าน ' + PASS + '  ตก ' + FAIL);
  process.exit(FAIL ? 1 : 0);
})();
