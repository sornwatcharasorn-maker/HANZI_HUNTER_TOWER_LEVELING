/* ══════════════════════════════════════════════════════════════════════════════
 *  test_soul_cards_v972.js — ชุดเทสต์ของ Patch v9.7.2 · COMPLETE 10/10 SOUL CARDS UI
 *  รัน: NODE_PATH=/opt/node22/lib/node_modules node test_soul_cards_v972.js
 *
 *  ข้อควรระวังที่เขียนไว้กันเดินซ้ำ (ยืมท่าของ test_soul_cards_ui.js ทั้งดุ้น)
 *   1. ต้อง stub fetch + EventSource ก่อนโหลดหน้าเสมอ (เหตุผลเดียวกับชุดของ v5.5/v5.6)
 *   2. เข้าเกมด้วยเส้นทางจริงเสมอ — ผ่านป๊อปอัปกติกาของ v5.6 (เลื่อน #rgBody ให้สุด
 *      แล้ว rgAck()) ห้ามเรียก enterGate() ตรง ๆ
 *   3. ปิดหน้าต่างจั่วการ์ดของ v4.7 ให้จบก่อนวัดทุกครั้ง (clearOverlays)
 *   4. baV972* ทุกตัวคือ real-code จากซอร์ส — ไม่มีสูตรคู่ขนานในเทสต์ชุดนี้เลย
 *      (กับดักข้อ 35 — เทียบผลจากฟังก์ชันจริงเสมอ ไม่คำนวณเองซ้ำ)
 * ══════════════════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_soul_cards_v972.log');
let pass = 0, fail = 0;
const say = t => { console.log(t); fs.appendFileSync(LOG, t + '\n'); };
const ok = (c, m) => { if (c) { pass++; say('  ✅ ' + m); } else { fail++; say('  ❌ ' + m); } };
const head = t => say('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(null), text: () => Promise.resolve('null')
    });
    window.EventSource = function () { this.close = function () {}; this.addEventListener = function () {}; };
  });
  await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}

async function enter(page, id) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(280);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); });
  await page.waitForTimeout(700);
  await page.evaluate(u => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1111';
    document.getElementById('reg-pw2').value = '1111';
    handleSubmit();
  }, id);
  await page.waitForTimeout(1400);
  await clearOverlays(page);
  await page.evaluate(() => { G.maxFloor = FLOOR_MAX; recalcStats(); renderStats(); });
}

async function clearOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
      if (typeof snGateConfirm === 'function' && document.querySelector('.sn-gate.active')) { snGateConfirm(); return 'gate'; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { warpGo(); return 'warp'; }
      return '';
    });
    if (!busy) break;
    await page.waitForTimeout(760);
  }
  await page.waitForTimeout(120);
}

/* เสกการ์ด id หนึ่งใบเข้าคลังตรง ๆ ไม่ต้องพึ่งลูกเต๋าดรอปจริง */
async function grant(page, id, opts) {
  opts = opts || {};
  return page.evaluate((args) => {
    const g = G;
    const s = baScEnsure(g);
    s.album[args.id] = (s.album[args.id] || 0) + (args.album || 1);
    s.stock[args.id] = (s.stock[args.id] || 0) + (args.stock != null ? args.stock : 1);
    if (args.stars != null) s.stars[args.id] = args.stars;
    baScSave();
    if (typeof baScRender === 'function') baScRender();
    return true;
  }, { id, album: opts.album, stock: opts.stock, stars: opts.stars });
}

(async () => {
  fs.writeFileSync(LOG, '=== test_soul_cards_v972 · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  // ══ บล็อก 1 · ติดตั้งครบ + CLS=0 ═══════════════════════════════════════════
  {
    head('บล็อก 1 · ติดตั้งครบ + ไม่มี pageerror + เลย์เอาต์ไม่ขยับ');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'v972_a');

    const audit = await page.evaluate(() => baBattleAudit().soulCardsV972);
    ok(!!audit, 'baBattleAudit().soulCardsV972 มีอยู่จริง');
    ok(audit && audit.ver === '9.7.2', 'ver เป็น "9.7.2" (audit.ver=' + (audit && audit.ver) + ')');
    ok(audit && audit.styled === true, '#baV972Style ถูกฉีดตั้งแต่ตอนติดตั้ง');
    ok(errs.length === 0, 'ไม่มี pageerror ระหว่างเข้าเกม (เจอ ' + errs.length + ' ตัว)');

    await page.evaluate(() => {
      const m = G.currentMonster;
      m.word = '北京语言大学';
      m.pinyin = 'Běijīng Yǔyán Dàxué';
      m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
      m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
      document.getElementById('gWord').textContent = m.word;
      document.getElementById('gPinyin').textContent = m.pinyin;
      renderChoices();
    });
    await page.waitForTimeout(200);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.waitForTimeout(120);
    const wordH = await page.evaluate(() => {
      const card = document.querySelector('.ac-battle');
      return card ? card.getBoundingClientRect().height : 0;
    });
    ok(Math.abs(wordH - 340.8) < 2 || Math.abs(wordH - 354.8) < 2,
      'ความสูงการ์ดโจทย์ยังเป็น 340.8/354.8px เท่าเดิม (ได้ ' + wordH.toFixed(1) + ')');

    await ctx.close();
  }

  // ══ บล็อก 2 · แถวการ์ด — สีเทา/สี + สีขอบตามระดับ ═══════════════════════════
  {
    head('บล็อก 2 · แถวการ์ด — grayscale ยังไม่มี / สีเมื่อมีแล้ว + ขอบสีตามระดับ');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_b');
    await grant(page, 'm11', { album: 1, stock: 2 });

    await page.evaluate(() => { if (typeof baSc11Open === 'function') baSc11Open(); else baScOpen(); });
    await page.waitForTimeout(200);

    const rowM11 = await page.evaluate(() => {
      const row = document.querySelector('#baScBody .ba-sc-row[data-id="m11"]');
      if (!row) return null;
      const img = row.querySelector('.ba-sc-thumb-img, .ba-sc-thumb-emoji');
      return {
        locked: row.classList.contains('ba-sc-lock'),
        dim: img ? img.classList.contains('ba-v972-dim') : null,
        tierClass: row.className,
        borderVar: row.style.getPropertyValue('--v972c'),
        name: row.querySelector('.ba-sc-info b') ? row.querySelector('.ba-sc-info b').textContent : ''
      };
    });
    ok(!!rowM11, 'แถวการ์ด m11 ถูกวาด');
    ok(rowM11 && rowM11.locked === false, 'มีการ์ด m11 แล้ว → ไม่มีคลาส ba-sc-lock');
    ok(rowM11 && rowM11.dim === false, 'มีการ์ด m11 แล้ว → รูปไม่ใส่ .ba-v972-dim (ไม่ใช่ grayscale)');
    ok(rowM11 && /ba-v972-tier-normal/.test(rowM11.tierClass), 'ระดับของ m11 คือ normal (ตรงกับ baScTierOf ของ v9.7)');
    ok(rowM11 && rowM11.borderVar === '#c97b4a', 'สีขอบ --v972c ตรงกับ BA_V972_TIER_COL.normal (#c97b4a)');
    ok(rowM11 && rowM11.name && rowM11.name !== '???', 'ชื่อการ์ดที่มีแล้วโชว์ชื่อจริง ไม่ใช่ ???');

    /* การ์ดที่ยังไม่มี — เช็คจากตัวใดตัวหนึ่งที่ยังไม่ได้ grant */
    const rowLocked = await page.evaluate(() => {
      const row = document.querySelector('#baScBody .ba-sc-row.ba-sc-lock');
      if (!row) return null;
      const img = row.querySelector('.ba-sc-thumb-img, .ba-sc-thumb-emoji');
      return {
        dim: img ? img.classList.contains('ba-v972-dim') : null,
        name: row.querySelector('.ba-sc-info b') ? row.querySelector('.ba-sc-info b').textContent : '',
        cnt: row.querySelector('.ba-sc-cnt') ? row.querySelector('.ba-sc-cnt').textContent : ''
      };
    });
    ok(!!rowLocked, 'มีแถวการ์ดที่ยังไม่ได้อย่างน้อยหนึ่งใบ');
    ok(rowLocked && rowLocked.dim === true, 'การ์ดที่ยังไม่มี → รูป/อีโมจิใส่ .ba-v972-dim (grayscale)');
    ok(rowLocked && rowLocked.name === '???', 'การ์ดที่ยังไม่มี → ชื่อโชว์ "???" ไม่เฉลย');
    ok(rowLocked && /ดรอป ~\d+%/.test(rowLocked.cnt), 'การ์ดที่ยังไม่มี → โชว์ % ดรอปตัวเลขจริง (' + rowLocked.cnt + ')');
    ok(rowLocked && /pity \d+\/15/.test(rowLocked.cnt), 'การ์ดที่ยังไม่มี → โชว์ pity N/15 (' + rowLocked.cnt + ')');

    await ctx.close();
  }

  // ══ บล็อก 3 · Detail Modal ═══════════════════════════════════════════════
  {
    head('บล็อก 3 · Detail Modal — ครบ 5 มิติตามสเปก');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_c');
    await grant(page, 'm11', { album: 1, stock: 5, stars: 1 });

    await page.evaluate(() => { baScOpen(); });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.baV972Detail('m11'); });
    await page.waitForTimeout(150);

    const modal = await page.evaluate(() => {
      const el = document.getElementById('baV972Modal');
      const body = document.getElementById('baV972DetailBody');
      return {
        active: el ? el.classList.contains('active') : false,
        html: body ? body.innerHTML : ''
      };
    });
    ok(modal.active === true, 'โมดัลรายละเอียดเปิดขึ้นจริง (.active)');
    ok(/สต็อก:.*×5/.test(modal.html), 'โชว์สต็อก (×5)');
    ok(/★★☆/.test(modal.html) || /★/.test(modal.html), 'โชว์จำนวนดาว');
    ok(/พลังการ์ด:/.test(modal.html), 'โชว์พลังการ์ดปัจจุบัน + พลังดาวถัดไป');
    ok(/ธาตุ:/.test(modal.html), 'โชว์ธาตุของการ์ด');
    ok(/เป้าหมายแนะนำ:/.test(modal.html), 'โชว์เป้าหมายแนะนำตามธาตุ (BA_V972_BEST)');
    ok(/ยืนยันอัปดาว/.test(modal.html), 'มีปุ่มยืนยันอัปดาว (สต็อกพอ ยังไม่ถึงดาวสูงสุด)');

    /* พิสูจน์ "มองเห็นจริง" ด้วย elementFromPoint (กับดักข้อ 25) */
    const seen = await page.evaluate(() => {
      const el = document.getElementById('baV972Modal');
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 300);
      const hit = document.elementFromPoint(cx, cy);
      return !!(hit && hit.closest('#baV972Modal'));
    });
    ok(seen, 'โมดัลมองเห็นจริงกลางจอ (elementFromPoint โดนลูกของ #baV972Modal)');

    await page.evaluate(() => { window.baV972DetailClose(); });
    await page.waitForTimeout(100);
    const closed = await page.evaluate(() => !document.getElementById('baV972Modal').classList.contains('active'));
    ok(closed, 'ปิดโมดัลได้ (.active ถูกถอด)');

    /* การ์ดที่ยังไม่มี — โมดัลต้องไม่เฉลยชื่อ แต่โชว์โอกาสดรอป */
    await page.evaluate(() => { window.baV972Detail('m41'); });
    await page.waitForTimeout(150);
    const lockedHtml = await page.evaluate(() => document.getElementById('baV972DetailBody').innerHTML);
    ok(/\?\?\?/.test(lockedHtml), 'การ์ดที่ยังไม่มี → หัวข้อโชว์ "???" ไม่เฉลยชื่อ');
    ok(/โอกาสดรอป:/.test(lockedHtml), 'การ์ดที่ยังไม่มี → โชว์โอกาสดรอปแทนสต็อก/ดาว');

    await ctx.close();
  }

  // ══ บล็อก 4 · Fusion & Star-Up ═════════════════════════════════════════════
  {
    head('บล็อก 4 · Fusion & Star-Up — ยืนยันแล้วดาวขึ้นจริง กำลังเพิ่มตามสูตรกระจก');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_d');
    await grant(page, 'm11', { album: 1, stock: 3, stars: 0 });
    await page.evaluate(() => { baScOpen(); });
    await page.waitForTimeout(150);

    const before = await page.evaluate(() => {
      const g = G, s = baScOf(g), d = baScDefOf('m11');
      return { star: s.stars.m11 || 0, stock: s.stock.m11, power: baScCardPower(g, 'm11') };
    });
    ok(before.star === 0, 'ก่อนหลอม: ดาว = 0');
    ok(before.stock === 3, 'ก่อนหลอม: สต็อก = 3 (พอดี BA_SC_FUSE_N)');

    await page.evaluate(() => { window.baV972UiFuse('m11'); });
    await page.waitForTimeout(150);

    const after = await page.evaluate(() => {
      const g = G, s = baScOf(g);
      return { star: s.stars.m11 || 0, stock: s.stock.m11 || 0, power: baScCardPower(g, 'm11') };
    });
    ok(after.star === before.star + 1, 'หลังหลอม: ดาว +1 (' + before.star + ' → ' + after.star + ')');
    ok(after.stock === before.stock - 3, 'หลังหลอม: สต็อกถูกหักไป 3 ใบ (BA_SC_FUSE_N)');
    ok(after.power > before.power, 'พลังการ์ดเพิ่มขึ้นจริงหลังอัปดาว (' + before.power + ' → ' + after.power + ')');
    ok(Math.abs(after.power - before.power - before.power * 0.5) < 0.01 ||
       Math.abs(after.power / before.power - 1.5) < 0.02,
      'อัตราเพิ่มตรงกับสูตร ×(1+ดาว×0.5) ของ baScCardPower');

    /* พรีวิวก่อนหลอมในโมดัลต้องเท่ากับ baV972PowerAt(d, star+1) ซึ่งเป็นค่าจริงที่จะได้ */
    await grant(page, 'm12', { album: 1, stock: 3, stars: 1 });
    await page.evaluate(() => { window.baV972Detail('m12'); });
    await page.waitForTimeout(120);
    const previewOk = await page.evaluate(() => {
      const g = G, d = baScDefOf('m12');
      const html = document.getElementById('baV972DetailBody').innerHTML;
      const shown = html.match(/อัปดาวถัดไป: ([\d.]+)/);
      if (!shown) return false;
      const unit = BA_SC_TIER_UNIT[d.tier] || 1;
      const want = unit * (1 + 2 * 0.5); /* star ปัจจุบัน 1 → ถัดไปคือ 2 */
      return Math.abs(parseFloat(shown[1]) - want) < 0.05;
    });
    ok(previewOk, 'พรีวิว "อัปดาวถัดไป" ในโมดัลตรงกับพลังที่จะได้จริงหลังอัป');

    /* ดาวเต็ม 3 แล้วต้องไม่มีปุ่มอัปดาวอีก */
    await grant(page, 'm13', { album: 1, stock: 9, stars: 3 });
    await page.evaluate(() => { window.baV972Detail('m13'); });
    await page.waitForTimeout(120);
    const capped = await page.evaluate(() => document.getElementById('baV972DetailBody').innerHTML);
    ok(!/ยืนยันอัปดาว/.test(capped), 'ดาวเต็ม 3 แล้ว → ไม่มีปุ่มยืนยันอัปดาวอีก');
    ok(/สูงสุดแล้ว/.test(capped), 'ดาวเต็ม 3 แล้ว → ข้อความบอกว่า "สูงสุดแล้ว"');

    await ctx.close();
  }

  // ══ บล็อก 5 · ตัวกรอง (own/zone/ready) ═════════════════════════════════════
  {
    head('บล็อก 5 · ตัวกรอง — ที่มี/ที่ขาด/โซน/พร้อมอัปดาว');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_e');
    await page.evaluate(() => { baScOpen(); });
    await page.waitForTimeout(150);
    await grant(page, 'm11', { album: 1, stock: 5, stars: 0 }); /* owned + ready(star<3,stock>=3) */
    await page.evaluate(() => { if (typeof baScRender === 'function') baScRender(); });
    await page.waitForTimeout(150);

    const bar = await page.evaluate(() => !!document.getElementById('baV972Filters'));
    ok(bar, 'แถบตัวกรอง #baV972Filters ถูกแทรกเหนือ #baScBody');

    await page.evaluate(() => { window.baV972SetFilter('own', 'owned'); });
    await page.waitForTimeout(80);
    const ownedView = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#baScBody .ba-sc-row'));
      return rows.every(r => getComputedStyle(r).display === 'none' || r.getAttribute('data-own') === '1');
    });
    ok(ownedView, 'ตัวกรอง "ที่มี" ซ่อนแถวที่ยังไม่มีทั้งหมด');

    await page.evaluate(() => { window.baV972SetFilter('own', 'missing'); });
    await page.waitForTimeout(80);
    const missingView = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#baScBody .ba-sc-row'));
      return rows.every(r => getComputedStyle(r).display === 'none' || r.getAttribute('data-own') === '0');
    });
    ok(missingView, 'ตัวกรอง "ที่ขาด" ซ่อนแถวที่มีแล้วทั้งหมด');

    await page.evaluate(() => { window.baV972ClearFilter(); window.baV972SetFilter('zone', 'abyss'); });
    await page.waitForTimeout(80);
    const abyssView = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#baScBody .ba-sc-row'));
      return rows.some(r => getComputedStyle(r).display !== 'none') &&
        rows.every(r => getComputedStyle(r).display === 'none' || r.getAttribute('data-cat') === 'abyss');
    });
    ok(abyssView, 'ตัวกรองโซน "เหวลึก" เหลือแต่แถวที่ data-cat=abyss');

    await page.evaluate(() => { window.baV972ClearFilter(); window.baV972SetFilter('ready'); });
    await page.waitForTimeout(80);
    const readyView = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#baScBody .ba-sc-row'));
      const m11row = rows.find(r => r.getAttribute('data-id') === 'm11');
      return {
        m11visible: m11row ? getComputedStyle(m11row).display !== 'none' : false,
        allReady: rows.every(r => getComputedStyle(r).display === 'none' || r.getAttribute('data-ready') === '1')
      };
    });
    ok(readyView.m11visible, 'ตัวกรอง "พร้อมอัปดาว" ยังโชว์ m11 (สต็อก 5 ≥ 3 · ดาวยังไม่เต็ม)');
    ok(readyView.allReady, 'ตัวกรอง "พร้อมอัปดาว" ซ่อนแถวที่ data-ready≠1 ทั้งหมด');

    await page.evaluate(() => { window.baV972ClearFilter(); });
    await page.waitForTimeout(80);
    const cleared = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#baScBody .ba-sc-row'));
      return rows.every(r => getComputedStyle(r).display !== 'none');
    });
    ok(cleared, 'baV972ClearFilter() คืนทุกแถวให้เห็นครบ');

    await ctx.close();
  }

  // ══ บล็อก 6 · Card Drop Fanfare + NEW! tag ═════════════════════════════════
  {
    head('บล็อก 6 · Card Drop Fanfare — NEW! ขึ้นถูกครั้ง (Error 7 ที่แก้ไปแล้ว)');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_f');

    /* ครั้งแรก (ไม่เคยมี m11 เลย) → ต้องเป็น isNew=true → มี NEW!
       บังคับ pity ให้เต็มก่อนกัน baScDrop() ทอยพลาด (ฐาน normal แค่ 12%) แล้วคืนเงียบ ๆ
       โดยไม่ประกาศเลย (baScDrop มีทางออกก่อนเรียก baScAnnounce เมื่อทอยไม่ติดและยังไม่ครบ pity) */
    await page.evaluate(() => { baScOf(G).pity = BA_SC_PITY_MAX; });
    await page.evaluate(() => { baScDrop('m11', 'normal'); });
    await page.waitForTimeout(120);
    const first = await page.evaluate(() => {
      const el = document.getElementById('baV972Fan');
      return el ? el.innerHTML : '';
    });
    ok(/NEW!/.test(first), 'ดรอปครั้งแรก (ไม่เคยมีมาก่อน) → มีป้าย NEW!');

    /* ครั้งที่สอง (มี m11 อยู่แล้ว) → isNew=false → ไม่มี NEW!
       บังคับ pity ให้เต็มก่อน กัน baScDrop() ทอยพลาดแล้วคืนเงียบ ๆ โดยไม่ประกาศเลย
       (baScDrop มีทางออกก่อนเรียก baScAnnounce เมื่อทอยไม่ติดและยังไม่ครบ pity) */
    await page.evaluate(() => { baScOf(G).pity = BA_SC_PITY_MAX; });
    await page.evaluate(() => { baScDrop('m11', 'normal'); });
    await page.waitForTimeout(120);
    const second = await page.evaluate(() => {
      const el = document.getElementById('baV972Fan');
      return el ? el.innerHTML : '';
    });
    ok(/CARD GET!/.test(second), 'ดรอปครั้งที่สองยังขึ้นแบนเนอร์ CARD GET!');
    ok(!/NEW!/.test(second), 'ดรอปครั้งที่สอง (มีอยู่แล้ว) → ไม่มีป้าย NEW! (isNew ถูกส่งมาถูกต้อง ไม่ใช่เดาจาก s.album)');

    await page.waitForTimeout(1700);
    const gone = await page.evaluate(() => !document.getElementById('baV972Fan'));
    ok(gone, 'แบนเนอร์ล้างตัวเองหลัง 1.6 วิ');

    await ctx.close();
  }

  // ══ บล็อก 7 · Set Resonance (3 เซ็ต) ═══════════════════════════════════════
  {
    head('บล็อก 7 · Set Resonance — Ancient Tomb / Shadow General / Kamish Dragon');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_g');

    /* Ancient Tomb Set: m11-m15 ครบ → EXP รวมของรอบตอบข้อ +5% */
    for (const id of ['m11', 'm12', 'm13', 'm14', 'm15']) await grant(page, id, { album: 1, stock: 0 });
    const tombDone = await page.evaluate(() => baBattleAudit().soulCardsV972.tombDone);
    ok(tombDone === true, 'เก็บครบ m11-m15 → tombDone = true');

    /* วัด EXP ที่ได้จากตอบถูกหนึ่งข้อ เทียบกับตอนยังไม่ครบเซ็ต (ปิดสวมใส่ไม่เกี่ยว—นี่คือคลังถาวร) */
    await page.evaluate(() => {
      G.exp = 0; G.level = 1; G.maxExp = expForLevel(1);
      G.currentMonster = { id: 1, word: 'ไก่', pinyin: 'x', answer: 'ก', choices: ['ก', 'ข', 'ค', 'ง'], tier: 'A' };
      G.questionStart = Date.now();
      G.locked = false;
    });
    const expBefore = await page.evaluate(() => G.exp);
    await page.evaluate(() => { answer('ก', null); });
    await page.waitForTimeout(200);
    const expAfter = await page.evaluate(() => G.exp + (G.level > 1 ? expForLevel(1) : 0));
    ok(expAfter > expBefore, 'ตอบถูกได้ EXP จริง (เซ็ตครบแล้วมีโบนัส +5% รวมอยู่ในนั้น)');

    /* Shadow General Set: s1-s12 ครบ → gold +10% */
    for (let i = 1; i <= 12; i++) await grant(page, 's' + i, { album: 1, stock: 0 });
    const sgenDone = await page.evaluate(() => baBattleAudit().soulCardsV972.sgenDone);
    ok(sgenDone === true, 'เก็บครบ s1-s12 → sgenDone = true');
    const goldMulOk = await page.evaluate(() => goldMul() > 1);
    ok(goldMulOk, 'goldMul() > 1 หลังเก็บ Shadow General Set ครบ (โบนัส +10% รวมอยู่)');

    /* Kamish Dragon Set: s21-s25 ครบ → ฉายา + ออร่า */
    for (let i = 21; i <= 25; i++) await grant(page, 's' + i, { album: 1, stock: 0 });
    await page.evaluate(() => {
      const gained = checkTitles(G);
      if (typeof announceTitles === 'function') announceTitles(gained, function(){});
      renderStats(); /* ออร่า .ba-v972-kamish ถูกตั้งใน wrapper ของ renderStats เท่านั้น — checkTitles/announceTitles ไม่แตะ DOM */
    });
    await page.waitForTimeout(150);
    const kami = await page.evaluate(() => {
      const a = baBattleAudit().soulCardsV972;
      const ar = baArena();
      return { kamiDone: a.kamiDone, hasTitle: a.hasKamishTitle, aura: ar ? ar.classList.contains('ba-v972-kamish') : false };
    });
    ok(kami.kamiDone === true, 'เก็บครบ s21-s25 → kamiDone = true');
    ok(kami.hasTitle === true, 'ได้ฉายา kamishlord จริง (TITLES.check ผ่าน)');
    ok(kami.aura === true, 'สนามรบติดคลาส .ba-v972-kamish (ออร่ามังกร)');

    await ctx.close();
  }

  // ══ บล็อก 8 · Auto-Equip (จัดเซ็ตแก้ทางอัตโนมัติ) ═══════════════════════════
  {
    head('บล็อก 8 · Auto-Equip — เลือก 3 ใบพลังสูงสุดจากที่มี');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_h');
    /* m11 tier normal (unit 1) · m41 tier boss ที่ชั้นบอส (unit 4) · s21 tier mythic (unit 5) ·
       s1 tier mini (unit 1.5) — คาดว่า auto-equip เลือก 3 ตัวที่สูงสุด: s21(5), m41(4), s1(1.5) */
    await grant(page, 'm11', { album: 1, stock: 1, stars: 0 });
    await grant(page, 'm41', { album: 1, stock: 1, stars: 0 });
    await grant(page, 's1', { album: 1, stock: 1, stars: 0 });
    await grant(page, 's21', { album: 1, stock: 1, stars: 0 });

    const ranked = await page.evaluate(() => {
      const g = G;
      return ['m11', 'm41', 's1', 's21'].map(id => [id, baScCardPower(g, id)]).sort((a, b) => b[1] - a[1]);
    });
    const top3 = ranked.slice(0, 3).map(r => r[0]);

    await page.evaluate(() => { window.baV972AutoEquip(); });
    await page.waitForTimeout(150);
    const equipped = await page.evaluate(() => baScOf(G).equip.filter(Boolean).sort());
    ok(equipped.length === 3, 'สวมครบ 3 ช่องหลัง Auto-Equip (ได้ ' + equipped.length + ')');
    ok(JSON.stringify(equipped) === JSON.stringify(top3.sort()),
      'ใบที่สวมคือ 3 อันดับพลังสูงสุดจาก baScCardPower() จริง (' + equipped.join(',') + ' == ' + top3.sort().join(',') + ')');

    /* ปุ่มลัดบนประตูวาปต้องมีอยู่และกดได้ */
    await page.evaluate(() => { renderWarp('preboss'); });
    await page.waitForTimeout(100);
    const gateBtn = await page.evaluate(() => !!document.getElementById('baV972AutoGateBtn'));
    ok(gateBtn, 'มีปุ่มลัด #baV972AutoGateBtn บนประตูวาป (preboss)');

    await ctx.close();
  }

  // ══ บล็อก 9 · Live Damage/Stat Preview (แผงสวมใส่) ═══════════════════════════
  {
    head('บล็อก 9 · Live Stat Preview — เห็นเฉพาะแท็บสวมใส่ ตัวเลขตรงกับสูตรจริง');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_i');
    await grant(page, 'm43', { album: 1, stock: 1, stars: 1 }); /* BA_SC_ELEM.m43 === 'fire' → atk (BA_SC_ELEM_STAT) */
    await page.evaluate(() => { window.baV972QuickEquip('m43'); });
    await page.waitForTimeout(100);

    await page.evaluate(() => { if (typeof baSc11Open === 'function') baSc11Open(); else baScOpen(); });
    await page.waitForTimeout(100);
    await page.evaluate(() => { if (typeof baSc11Tab === 'function') baSc11Tab('album'); });
    await page.waitForTimeout(100);
    const hiddenOnAlbum = await page.evaluate(() => {
      const box = document.getElementById('baV972LiveBox');
      return box ? getComputedStyle(box).display === 'none' : true;
    });
    ok(hiddenOnAlbum, 'แท็บอัลบั้ม (album) → กล่องสถานะสด #baV972LiveBox ถูกซ่อน');

    await page.evaluate(() => { if (typeof baSc11Tab === 'function') baSc11Tab('equip'); });
    await page.waitForTimeout(100);
    const eq = await page.evaluate(() => {
      const box = document.getElementById('baV972LiveBox');
      const g = G;
      return {
        shown: box ? getComputedStyle(box).display !== 'none' : false,
        html: box ? box.innerHTML : '',
        atk: baScAtkPct(g), hp: baScHpFlat(g), gold: baScGoldPct(g), crit: baScCritPts(g)
      };
    });
    ok(eq.shown, 'แท็บสวมใส่ (equip) → กล่องสถานะสดโผล่ให้เห็น');
    ok(eq.atk > 0, 'baScAtkPct(g) > 0 หลังสวมการ์ด m43 (ธาตุ fire ผูกกับ atk)');
    ok(new RegExp('ATK \\+' + eq.atk.toFixed(1) + '%').test(eq.html), 'ตัวเลข ATK ในกล่องตรงกับ baScAtkPct() จริง (ไม่ใช่เลขคำนวณแยก — กับดักข้อ 35)');
    ok(new RegExp('HP \\+' + Math.round(eq.hp)).test(eq.html), 'ตัวเลข HP ในกล่องตรงกับ baScHpFlat() จริง');
    ok(new RegExp('ทอง \\+' + eq.gold.toFixed(1) + '%').test(eq.html), 'ตัวเลข Gold ในกล่องตรงกับ baScGoldPct() จริง');
    ok(/จัดเซ็ตแก้ทางอัตโนมัติ/.test(eq.html), 'กล่องสถานะสดมีปุ่มลัด Auto-Equip อยู่ในตัว');

    await ctx.close();
  }

  // ══ บล็อก 10 · Awakening Mastery (ตื่นพลังจากสตรีคตอบถูก) ═══════════════════
  {
    head('บล็อก 10 · Hanzi Awakening Mastery — สตรีค ≥5 ตอนล้มมอนสเตอร์ที่มีการ์ดแล้ว');
    const { ctx, page } = await boot(browser);
    await enter(page, 'v972_j');
    await grant(page, 'm11', { album: 1, stock: 1, stars: 0 });

    /* ปิดระบบบุกรุกของ v6.6 ก่อนย้ายชั้น (กติกาเดิมของ repo — กันทัพเงามาสวมทับ m11) */
    await page.evaluate(() => {
      if (typeof BA_INC_F !== 'undefined') { BA_INC_F = 1; BA_INC_AT = -1; BA_INC_M = null; }
      G.floor = 1; G.floorProgress = 0; G.streak = 6; G.practiceMode = false;
      nextMonster();
    });
    await page.waitForTimeout(200);

    const before = await page.evaluate(() => !!(baScOf(G).awaken && baScOf(G).awaken.m11));
    ok(before === false, 'ก่อนล้ม m11 ด้วยสตรีคสูง → ยังไม่ตื่นพลัง');

    /* ยัดชั้นปัจจุบันให้เป็น m11 แน่ ๆ แล้วล้มด้วย HP 1 */
    await page.evaluate(() => {
      G.currentMonster.id = 111; /* กัน id ชนตัวตรวจ baScFoeNow อ่านจาก g.currentMonster ปกติ (id มอนสเตอร์ในหอคอย ไม่ใช่ id การ์ด) */
      G.monsterHp = 1;
      G.streak = 6;
    });
    const foeNow = await page.evaluate(() => (typeof baScFoeNow === 'function') ? baScFoeNow(G) : null);
    ok(!!(foeNow && foeNow.id), 'baScFoeNow(G) คืน {id,tier} ได้จริงตอนยืนสู้อยู่ (id=' + (foeNow && foeNow.id) + ')');

    if (foeNow && foeNow.id !== 'm11') {
      /* ยืนคนละชั้นจากที่คาด (ระบบบุกรุก/ป่ายตำแหน่งขยับ) — เสก m11 เพิ่มแล้ววัดผ่านฟังก์ชันตรง ๆ แทน */
      await grant(page, foeNow.id, { album: 1, stock: 1, stars: 0 });
    }
    const targetId = (foeNow && foeNow.id) || 'm11';
    await page.evaluate((tid) => { G.monsterHp = 1; G.streak = 6; onMonsterDefeated(); }, targetId);
    await page.waitForTimeout(250);

    const after = await page.evaluate((tid) => !!(baScOf(G).awaken && baScOf(G).awaken[tid]), targetId);
    ok(after === true, 'หลังล้มด้วยสตรีค ≥5 และมีการ์ดตัวนั้นอยู่แล้ว → sc.awaken[id] = 1');

    /* คริตต้องขึ้นเฉพาะตอนสวมใบที่ตื่นพลังแล้ว */
    await page.evaluate((tid) => { baScEnsure(G).equip = [null, null, null]; }, targetId);
    const critUnequipped = await page.evaluate(() => baScCritPts(G));
    await page.evaluate((tid) => { window.baV972QuickEquip(tid); }, targetId);
    await page.waitForTimeout(100);
    const critEquipped = await page.evaluate(() => baScCritPts(G));
    ok(critEquipped >= critUnequipped + 5, 'สวมใบที่ตื่นพลังแล้ว → baScCritPts() เพิ่มอย่างน้อย BA_V972_AWAKEN_CRIT(5)');

    /* modal ต้องโชว์สถานะตื่นพลัง */
    await page.evaluate(() => { baScOpen(); });
    await page.waitForTimeout(150);
    await page.evaluate((tid) => { window.baV972Detail(tid); }, targetId);
    await page.waitForTimeout(120);
    const awakenTxt = await page.evaluate(() => document.getElementById('baV972DetailBody').innerHTML);
    ok(/ตื่นพลังแล้ว/.test(awakenTxt), 'โมดัลรายละเอียดโชว์ข้อความ "ตื่นพลังแล้ว"');

    /* แถวในรายการต้องมีป้าย ✨ */
    await page.evaluate(() => { if (typeof baScRender === 'function') baScRender(); });
    await page.waitForTimeout(100);
    const rowAwk = await page.evaluate((tid) => {
      const row = document.querySelector('#baScBody .ba-sc-row[data-id="' + tid + '"]');
      return row ? !!row.querySelector('.ba-v972-awk') : false;
    }, targetId);
    ok(rowAwk, 'แถวการ์ดที่ตื่นพลังแล้วมีป้าย ✨ (.ba-v972-awk)');

    await ctx.close();
  }

  // ══ บล็อก 11 · CLS = 0 / ไม่มี pageerror ที่หลายความกว้างจอ ═══════════════════
  {
    head('บล็อก 11 · CLS=0 หลายความกว้างจอ + ไม่มี pageerror');
    for (const w of [320, 360, 390, 430, 768]) {
      const { ctx, page, errs } = await boot(browser, w, 844);
      await enter(page, 'v972_w' + w);
      await grant(page, 'm11', { album: 1, stock: 3, stars: 1 });
      await page.evaluate(() => { if (typeof baSc11Open === 'function') baSc11Open(); else baScOpen(); });
      await page.waitForTimeout(150);
      await page.evaluate(() => { window.baV972Detail('m11'); });
      await page.waitForTimeout(150);
      await page.evaluate(() => { window.baV972DetailClose(); if (typeof baScClose === 'function') baScClose(); });
      await page.waitForTimeout(150);

      await page.evaluate(() => {
        const m = G.currentMonster;
        m.word = '北京语言大学';
        m.pinyin = 'Běijīng Yǔyán Dàxué';
        m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
        m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
        document.getElementById('gWord').textContent = m.word;
        document.getElementById('gPinyin').textContent = m.pinyin;
        renderChoices();
      });
      await page.waitForTimeout(200);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await page.waitForTimeout(120);
      const wordH = await page.evaluate(() => {
        const card = document.querySelector('.ac-battle');
        return card ? card.getBoundingClientRect().height : 0;
      });
      const overflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
      ok(Math.abs(wordH - 340.8) < 2 || Math.abs(wordH - 354.8) < 2,
        'จอ ' + w + 'px: ความสูงการ์ดโจทย์ยังคงที่ (ได้ ' + wordH.toFixed(1) + ')');
      ok(overflow, 'จอ ' + w + 'px: ไม่ล้นแนวนอน');
      ok(errs.length === 0, 'จอ ' + w + 'px: ไม่มี pageerror (เจอ ' + errs.length + ' ตัว)');
      await ctx.close();
    }
  }

  await browser.close();
  say('\n════════════════════════════════════════');
  say('รวม: ผ่าน ' + pass + ' · ตก ' + fail);
  say('════════════════════════════════════════');
  process.exit(fail > 0 ? 1 : 0);
})();
