/* ══════════════════════════════════════════════════════════════════════════════
 *  test_soul_cards_ui.js — ชุดเทสต์ของ Patch v9.7.1 · AUDIT & EXPOSE SOUL CARDS UI
 *  รัน: NODE_PATH=/opt/node22/lib/node_modules node test_soul_cards_ui.js
 *
 *  ข้อควรระวังที่เขียนไว้กันเดินซ้ำ
 *   1. ต้อง stub fetch + EventSource ก่อนโหลดหน้าเสมอ (เหตุผลเดียวกับชุดของ v5.5/v5.6)
 *   2. เข้าเกมด้วยเส้นทางจริงเสมอ — ผ่านป๊อปอัปกติกาของ v5.6 (เลื่อน #rgBody ให้สุด
 *      แล้ว rgAck()) ห้ามเรียก enterGate() ตรง ๆ
 *   3. ปิดหน้าต่างจั่วการ์ดของ v4.7 ให้จบก่อนวัดทุกครั้ง (clearOverlays)
 *   4. #gWarp ทดสอบด้วยการเรียก renderWarp(kind) ตรง ๆ — dwG() ต้องการแค่ G ที่มีอยู่
 *      หลังล็อกอิน ไม่ต้องไต่หอคอยจริงถึงจะทดสอบปุ่มบนประตูวาปได้
 * ══════════════════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_soul_cards_ui.log');
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

(async () => {
  fs.writeFileSync(LOG, '=== test_soul_cards_ui · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  // ══ บล็อก 1 · ปุ่มใน Lobby (.g-actions) ═══════════════════════════════════
  {
    head('บล็อก 1 · ปุ่ม Lobby');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'scu_a');

    const before = await page.evaluate(() => document.querySelectorAll('.g-actions .g-btn').length);
    ok(before >= 11, 'มีปุ่มใน .g-actions อย่างน้อย 11 ใบ (เดิม 10 + ของแพตช์นี้ 1) ได้ ' + before);

    const btn = await page.evaluate(() => {
      const b = document.getElementById('baScMenuBtn');
      if (!b) return null;
      const cs = getComputedStyle(b);
      return { text: b.textContent, gridColumn: b.style.gridColumn, display: cs.display };
    });
    ok(!!btn, 'ปุ่ม #baScMenuBtn ถูกแทรกใน .g-actions');
    ok(btn && /คลังการ์ดวิญญาณ/.test(btn.text), 'ข้อความปุ่มมีคำว่า "คลังการ์ดวิญญาณ"');
    ok(btn && btn.gridColumn === '1 / -1', 'ปุ่มบังคับ grid-column:1/-1 (เต็มแถวของตัวเอง — กันช่องว่างครึ่งแถว กับดักข้อ 11)');

    /* ปุ่มเดิม 10 ใบต้องยังอยู่ครบ ไม่ถูกลบ/แก้ */
    const old = await page.evaluate(() => ({
      status: !!document.querySelector('.g-actions .g-btn[onclick*="openStatus"]'),
      analytics: !!document.querySelector('.g-actions .g-btn[onclick*="openAnalytics"]'),
      board: !!document.querySelector('.g-actions .g-btn[onclick*="openBoard"]'),
      shop: !!document.querySelector('.g-actions .g-btn[onclick*="openShop"]'),
      scan: !!document.querySelector('.g-actions .g-btn[onclick*="showHint"]'),
      quests: !!document.getElementById('qBoardBtn'),
      codex: !!document.getElementById('cxBoardBtn'),
      core: !!document.getElementById('abCoreBtn'),
      abyss: !!document.getElementById('abAbyssBtn'),
      profile: !!document.getElementById('baPlProfile')
    }));
    Object.keys(old).forEach(k => ok(old[k], 'ปุ่มเดิม "' + k + '" ยังอยู่ครบ ไม่ถูกลบ/แก้'));

    /* กดปุ่มจริงต้องเปิดโมดัลได้ */
    await page.evaluate(() => document.getElementById('baScMenuBtn').click());
    await page.waitForTimeout(150);
    const open1 = await page.evaluate(() => {
      const el = document.getElementById('baScBoard');
      return !!(el && el.classList.contains('active'));
    });
    ok(open1, 'กดปุ่ม Lobby แล้ว #baScBoard เปิดจริง (.active)');

    /* ต้อง "มองเห็นจริง" ด้วย elementFromPoint ไม่ใช่แค่ .active (กับดักข้อ 25)
       ต้องซ่อน #snLayer ชั่วคราวก่อนวัดเสมอ — z-index:400 ของมันสูงกว่า .g-modal
       (200) การ recalcStats()/renderStats() ตอน enter() ปลดล็อกฟีเจอร์เต็มแรงค์
       ทำให้การ์ดแจ้งเตือน "สกิลพร้อมใช้" ลอยขึ้นมาได้พอดีจังหวะที่วัด (กับดักข้อ 23) */
    const visible = await page.evaluate(() => {
      const layer = document.getElementById('snLayer');
      const prevDisplay = layer ? layer.style.display : '';
      if (layer) layer.style.display = 'none';
      const r = document.getElementById('baScBoard').querySelector('.g-modal-inner').getBoundingClientRect();
      let hit = 0, total = 0;
      for (let x = r.left + 4; x < r.right; x += 30) {
        for (let y = r.top + 4; y < r.bottom; y += 30) {
          total++;
          const el = document.elementFromPoint(x, y);
          if (el && el.closest('#baScBoard')) hit++;
        }
      }
      if (layer) layer.style.display = prevDisplay;
      return { hit, total };
    });
    ok(visible.total > 0 && visible.hit === visible.total,
       'โมดัลมองเห็นจริงทุกจุด (' + visible.hit + '/' + visible.total + ') ไม่มีอะไรมาบัง');

    await page.evaluate(() => baScClose());
    await ctx.close();
  }

  // ══ บล็อก 2 · ปุ่มในร้านค้า #gShop ═══════════════════════════════════════
  {
    head('บล็อก 2 · ปุ่มร้านค้า');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'scu_b');

    const has = await page.evaluate(() => !!document.getElementById('baScShopBtn'));
    ok(has, '#baScShopBtn ถูกแทรกไว้ในเปลือก #gShop ตั้งแต่ตอนติดตั้ง');

    const pos = await page.evaluate(() => {
      const shop = document.getElementById('gShop');
      const btn = document.getElementById('baScShopBtn');
      const close = shop.querySelector('.g-btn[onclick*="closeShop"]');
      if (!shop || !btn || !close) return null;
      const kids = Array.from(shop.querySelectorAll('.g-modal-inner > *'));
      return { btnIdx: kids.indexOf(btn), closeIdx: kids.indexOf(close) };
    });
    ok(pos && pos.btnIdx >= 0 && pos.btnIdx < pos.closeIdx, 'ปุ่มอยู่ก่อนปุ่ม "✕ ปิดร้านค้า" ในลำดับ DOM');

    /* เปิดร้านค้าจริงแล้วกดปุ่มต้องเปิดคลังการ์ดได้ (ปุ่มไม่หายหลัง openShop() วาด #gShopBody) */
    await page.evaluate(() => openShop());
    await page.waitForTimeout(150);
    const stillThere = await page.evaluate(() => !!document.getElementById('baScShopBtn'));
    ok(stillThere, 'เปิดร้านค้าแล้วปุ่มยังอยู่ (เปลือกไม่ถูก innerHTML ทับ)');

    await page.evaluate(() => document.getElementById('baScShopBtn').click());
    await page.waitForTimeout(150);
    const opened = await page.evaluate(() => document.getElementById('baScBoard').classList.contains('active'));
    ok(opened, 'กดปุ่มจากในร้านค้าแล้วคลังการ์ดเปิดจริง');

    await page.evaluate(() => { baScClose(); closeShop(); });
    await ctx.close();
  }

  // ══ บล็อก 3 · ปุ่มบนประตูวาป #gWarp (มิเรอร์ dwShop) ═════════════════════
  {
    head('บล็อก 3 · ปุ่มประตูวาป');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'scu_c');

    const r1 = await page.evaluate(() => {
      renderWarp('preboss');
      const btn = document.getElementById('baScGateBtn');
      return btn ? getComputedStyle(btn).display : 'missing';
    });
    ok(r1 === 'block', 'renderWarp("preboss") → ปุ่มโชว์ (display:block) ได้ ' + r1);

    const r2 = await page.evaluate(() => {
      renderWarp('floor');
      const btn = document.getElementById('baScGateBtn');
      return btn ? getComputedStyle(btn).display : 'missing';
    });
    ok(r2 === 'block', 'renderWarp("floor") [DW_POST] → ปุ่มโชว์ได้ ' + r2);

    const r3 = await page.evaluate(() => {
      renderWarp('down');
      const btn = document.getElementById('baScGateBtn');
      return btn ? getComputedStyle(btn).display : 'missing';
    });
    ok(r3 === 'none', 'renderWarp("down") [checkpoint] → ปุ่มซ่อน (display:none) เหมือน dwShop ได้ ' + r3);

    /* ต้องยังมีแค่ปุ่มเดียวหลังเรียก renderWarp ซ้ำหลายรอบ (กันแทรกซ้ำ — กับดักข้อ 2) */
    await page.evaluate(() => { for (let i = 0; i < 6; i++) renderWarp('preboss'); });
    const dupCount = await page.evaluate(() => document.querySelectorAll('#baScGateBtn').length);
    ok(dupCount === 1, 'renderWarp ซ้ำหลายรอบไม่แทรกปุ่มซ้ำ (เหลือ ' + dupCount + ' ใบ)');

    const dwShopStill = await page.evaluate(() => document.querySelectorAll('#dwShop').length);
    ok(dwShopStill === 1, 'ปุ่ม #dwShop เดิมของ v4.9.2 ยังทำงานปกติ (' + dwShopStill + ' ใบ) ไม่ถูกแตะ');

    await page.evaluate(() => document.getElementById('baScGateBtn').click());
    await page.waitForTimeout(150);
    const opened = await page.evaluate(() => document.getElementById('baScBoard').classList.contains('active'));
    ok(opened, 'กดปุ่มจากประตูวาปแล้วคลังการ์ดเปิดจริง');

    await page.evaluate(() => baScClose());
    await ctx.close();
  }

  // ══ บล็อก 4 · Console Fallback ═══════════════════════════════════════════
  {
    head('บล็อก 4 · Console Fallback');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'scu_d');

    const typeOk = await page.evaluate(() =>
      typeof ba === 'object' && ba && typeof ba.openSoulCardsModal === 'function');
    ok(typeOk, 'ba.openSoulCardsModal เป็นฟังก์ชันจริง เรียกจาก Console ได้');

    await page.evaluate(() => ba.openSoulCardsModal());
    await page.waitForTimeout(150);
    const opened = await page.evaluate(() =>
      !!document.getElementById('baScBoard') && document.getElementById('baScBoard').classList.contains('active'));
    ok(opened, 'ba.openSoulCardsModal() เด้งหน้าต่างขึ้นมาได้ทันที');

    /* เรียกซ้ำต้องไม่พัง แม้โมดัลเปิดอยู่แล้ว */
    let threw = false;
    try { await page.evaluate(() => { ba.openSoulCardsModal(); ba.openSoulCardsModal(); }); }
    catch (e) { threw = true; }
    ok(!threw, 'เรียกซ้ำหลายครั้งไม่พัง');

    await ctx.close();
  }

  // ══ บล็อก 5 · แท็บ 1/2 — ไม่แก้ baScRow/baScRender ของ v9.7 ═════════════════
  {
    head('บล็อก 5 · แท็บสมุดภาพ/สวมใส่');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'scu_e');

    /* ปั้นบัญชีให้มีการ์ดจริง 1 ใบเพื่อให้เห็นปุ่มสวม/หลอมของ v9.7 */
    await page.evaluate(() => {
      const cat = baScCat();
      const id = cat[0].id;
      const s = baScEnsure(G);
      s.album[id] = 2; s.stock[id] = 2; s.stars[id] = 0;
      baScOpen();
    });
    await page.waitForTimeout(150);

    const dom = await page.evaluate(() => ({
      board: !!document.getElementById('baScBoard'),
      tabs: !!document.getElementById('baScTabs'),
      inlayBox: !!document.getElementById('baScInlayBox'),
      equipBox: !!document.getElementById('baScEquipBox'),
      defaultTab: document.getElementById('baScBoard').dataset.tab,
      tabBtns: document.querySelectorAll('#baScTabs .ba-sc-tabbtn').length
    }));
    ok(dom.board, 'โมดัลถูกสร้าง');
    ok(dom.tabs, 'แถบแท็บ #baScTabs ถูกแทรก');
    ok(dom.inlayBox, '#baScInlayBox ถูกแทรก');
    ok(dom.equipBox, '#baScEquipBox ถูกแทรก');
    ok(dom.defaultTab === 'album', 'แท็บเริ่มต้นคือ "album" (สมุดภาพ) ได้ ' + dom.defaultTab);
    ok(dom.tabBtns === 2, 'มีปุ่มแท็บครบ 2 ใบ');

    /* แท็บ 1 (album) — กล่องสรุปโบนัสถาวรต้องโชว์ ปุ่มสวม/หลอมต้องถูกซ่อน */
    const tab1 = await page.evaluate(() => {
      const ib = document.getElementById('baScInlayBox');
      const eb = document.getElementById('baScEquipBox');
      const btns = document.querySelector('#baScBody .ba-sc-btns');
      return {
        ibVisible: getComputedStyle(ib).display !== 'none',
        ebVisible: getComputedStyle(eb).display !== 'none',
        btnsVisible: btns ? getComputedStyle(btns).display !== 'none' : null,
        ibText: ib.textContent
      };
    });
    ok(tab1.ibVisible, 'แท็บสมุดภาพ: กล่องโบนัสถาวรโชว์อยู่');
    ok(!tab1.ebVisible, 'แท็บสมุดภาพ: กล่องช่องสวมถูกซ่อน');
    ok(tab1.btnsVisible === false, 'แท็บสมุดภาพ: ปุ่มสวม/หลอมของแต่ละแถวถูกซ่อน (ไม่แตะ DOM ของแถว)');
    ok(/HP \+\d/.test(tab1.ibText) && /ดาเมจ \+\d/.test(tab1.ibText) && /ทอง \+\d/.test(tab1.ibText),
       'กล่องโบนัสถาวรมีตัวเลข HP/ดาเมจ/ทอง — อ่านจาก baScInlay ของ v9.7 ตรง ๆ');

    /* สลับไปแท็บ 2 (equip) */
    await page.evaluate(() => baSc11Tab('equip'));
    await page.waitForTimeout(80);
    const tab2 = await page.evaluate(() => {
      const board = document.getElementById('baScBoard');
      const ib = document.getElementById('baScInlayBox');
      const eb = document.getElementById('baScEquipBox');
      const btns = document.querySelector('#baScBody .ba-sc-btns');
      const on = Array.from(document.querySelectorAll('#baScTabs .ba-sc-tabbtn'))
        .map(b => ({ t: b.getAttribute('data-t'), on: b.classList.contains('on') }));
      return {
        dataTab: board.dataset.tab,
        ibVisible: getComputedStyle(ib).display !== 'none',
        ebVisible: getComputedStyle(eb).display !== 'none',
        btnsVisible: btns ? getComputedStyle(btns).display !== 'none' : null,
        ebText: eb.textContent,
        on
      };
    });
    ok(tab2.dataTab === 'equip', 'สลับแท็บสำเร็จ data-tab เป็น "equip"');
    ok(!tab2.ibVisible, 'แท็บสวมใส่: กล่องโบนัสถาวรถูกซ่อน');
    ok(tab2.ebVisible, 'แท็บสวมใส่: กล่องช่องสวมโชว์อยู่');
    ok(tab2.btnsVisible === true, 'แท็บสวมใส่: ปุ่มสวม/หลอมของแต่ละแถวโชว์กลับมา');
    ok(/ช่อง 1/.test(tab2.ebText) && /ช่อง 2/.test(tab2.ebText) && /ช่อง 3/.test(tab2.ebText),
       'กล่องช่องสวมแสดงครบทั้ง 3 ช่อง');
    const onBtn = tab2.on.filter(b => b.t === 'equip')[0];
    const offBtn = tab2.on.filter(b => b.t === 'album')[0];
    ok(onBtn && onBtn.on, 'ปุ่มแท็บ "สวมใส่" ได้คลาส .on');
    ok(offBtn && !offBtn.on, 'ปุ่มแท็บ "สมุดภาพ" คลาส .on ถูกถอด');

    /* กดสวมจริงผ่านปุ่มเดิมของ v9.7 (ไม่ถูกแก้เลย) แล้ววัดว่ากล่องช่องสวมอัปเดตตาม */
    await page.evaluate(() => {
      const cat = baScCat();
      const id = cat[0].id;
      baScUiEquip(0, id);
    });
    await page.waitForTimeout(80);
    const afterEquip = await page.evaluate(() => document.getElementById('baScEquipBox').textContent);
    ok(!/ช่อง 1: — ว่าง —/.test(afterEquip), 'สวมการ์ดช่อง 1 แล้วกล่องสรุปอัปเดตตาม (ไม่ว่างแล้ว)');

    /* baScRow ของ v9.7 (ปุ่มสวม/ถอด/หลอม) ต้องยังทำงานปกติ ไม่ถูกแก้เลยสักบรรทัด */
    const rowIntact = await page.evaluate(() => {
      const row = document.querySelector('#baScBody .ba-sc-row:not(.ba-sc-lock)');
      return row ? row.querySelector('.ba-sc-btn.on') !== null : false;
    });
    ok(rowIntact, 'แถวการ์ดของ v9.7 ยังมีปุ่ม "สวมอยู่ ช่อง 1 ✕" ตามตรรกะเดิมทุกประการ');

    await ctx.close();
  }

  // ══ บล็อก 6 · CSS/CLS + audit hook + ไม่มี pageerror ═══════════════════════
  {
    head('บล็อก 6 · CLS = 0 · audit · pageerror');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'scu_f');

    ok(await page.evaluate(() => !!document.getElementById('baSc11Style')), 'มีสไตล์ #baSc11Style ของตัวเอง');

    /* tabs/inlayBox/equipBox ถูกแทรกแบบ lazy ตอน baScDom() ทำงานครั้งแรก
       (ตอนเปิดโมดัลครั้งแรก) ต้องเปิดโมดัลอย่างน้อยหนึ่งครั้งก่อนถึงจะตรวจ audit
       เห็นของพวกนี้ได้ — เปิดผ่าน Console Fallback แล้วปิดกลับก่อนวัดส่วนที่เหลือ */
    await page.evaluate(() => { ba.openSoulCardsModal(); });
    await page.waitForTimeout(120);
    await page.evaluate(() => { if (typeof baScClose === 'function') baScClose(); });
    await page.waitForTimeout(80);

    const audit = await page.evaluate(() => baBattleAudit().soulCardsUi);
    ok(!!audit, 'baBattleAudit().soulCardsUi มีอยู่จริง');
    ok(audit && audit.ver === '9.7.1', 'audit รายงานรุ่น 9.7.1');
    ok(audit && audit.menuBtn, 'audit: menuBtn = true');
    ok(audit && audit.shopBtn, 'audit: shopBtn = true');
    ok(audit && audit.tabs, 'audit: tabs = true');
    ok(audit && audit.inlayBox && audit.equipBox, 'audit: inlayBox/equipBox = true');
    ok(audit && audit.styled, 'audit: styled = true');
    ok(audit && audit.consoleFallback, 'audit: consoleFallback = true');

    /* บังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนวัดความสูงการ์ดโจทย์เสมอ
       (บทเรียนเดิมของชุด v7.2/v7.4/v7.5/v7.8/v7.9 — เปิดโมดัลคลังการ์ดต้องไม่กระทบ
       เลย์เอาต์ของหน้าเล่นเลยแม้แต่พิกเซลเดียว) */
    const heights = await page.evaluate(() => {
      const fb = document.getElementById('gFeedback');
      if (fb) fb.textContent = '';
      document.getElementById('gWord').textContent = '北京语言大学';
      document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
      const before = document.querySelector('.ac-battle') ? document.querySelector('.ac-battle').getBoundingClientRect().height : 0;
      document.getElementById('baScMenuBtn').click();
      return before;
    });
    await page.waitForTimeout(150);
    const afterHeight = await page.evaluate(() => {
      const el = document.querySelector('.ac-battle');
      return el ? el.getBoundingClientRect().height : 0;
    });
    ok(Math.abs(heights - afterHeight) < 0.5,
       'เปิดคลังการ์ดแล้วการ์ดโจทย์ไม่ขยับ (' + heights.toFixed(1) + 'px → ' + afterHeight.toFixed(1) + 'px)');

    const overflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
    ok(overflow, 'ไม่ล้นแนวนอน');

    ok(errs.length === 0, 'ไม่มี pageerror (' + errs.length + ')');

    await ctx.close();
  }

  await browser.close();
  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
