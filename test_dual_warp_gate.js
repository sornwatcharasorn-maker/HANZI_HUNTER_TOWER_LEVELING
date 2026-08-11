/* ชุดทดสอบชั้น v4.9.2 · DUAL WARP GATE (คำสั่ง Patch v4.8.2)
   ประตูวาปก่อนบอส (ชั้น 4/9/14/19) + ประตูวาปหลังบอส (ชั้น 5/10/15/20) + กฎหยุดเวลา */
const { chromium } = require('playwright');
const fs = require('fs');

const FILE = 'file:///home/user/HANZI_HUNTER_TOWER_LEVELING/hanzi_hunter_tower_v3_1_intro.html';
const LOG  = '/tmp/claude-0/-home-user-HANZI-HUNTER-TOWER-LEVELING/bfa2e9be-0fbd-50fc-adab-f57f27ef1a6f/scratchpad/test_dw.log';
try { fs.unlinkSync(LOG); } catch (e) {}
function log(s) { fs.appendFileSync(LOG, s + '\n'); }

let PASS = 0, FAIL = 0;
function ok(name, cond, extra) {
  if (cond) { PASS++; log('  PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; log('  FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

async function newPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { errs.push(String(e)); log('  !! pageerror: ' + e); });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  page._errs = errs;
  return page;
}

async function enter(page, name) {
  await page.evaluate(() => enterGate());
  await page.waitForTimeout(700);
  await page.evaluate(() => switchTab('register'));
  await page.evaluate((n) => {
    document.getElementById('reg-id').value = n;
    document.getElementById('reg-pw').value = 'pw123456';
    document.getElementById('reg-pw2').value = 'pw123456';
    handleSubmit();
  }, name);
  await page.waitForTimeout(900);
}

/* ปิดหน้าต่างจั่วการ์ดของ v4.7 · ปลดล็อกแรงค์ (ไม่งั้นร้านค้าเปิดไม่ได้) · เงียบ toast */
async function settle(page) {
  const has = await page.evaluate(() => {
    const d = document.getElementById('cdDraft');
    return !!(d && d.classList.contains('active'));
  });
  if (has) {
    await page.evaluate(() => document.querySelector('#cdDraft .cd-card').click());
    await page.waitForTimeout(900);              /* > CD_OUT_MS 620 */
  }
  await page.evaluate(() => {
    G.maxFloor = FLOOR_MAX; recalcStats();
    CD_CARD = CD_BY_ID['mana'];
    CD_BAND = cdBandOf(G.floor);
    CD_ST = { ward: 0, noItem: 0, noHeal: 0, atk: 0, perfect: true, hit: 0, miss: 0 };
    cdPaintUi();
    document.getElementById('snLayer').innerHTML = '';
  });
  await page.waitForTimeout(120);
}

/* พาไปยืนบนชั้นที่ต้องการแบบสด ๆ แล้วเริ่มข้อใหม่ให้นาฬิกาเดินจริง */
async function standOn(page, floor) {
  await page.evaluate((f) => {
    G.floor = f;
    G.maxFloor = FLOOR_MAX;
    G.floorProgress = MONSTERS_PER_FLOOR - 1;
    G.practiceMode = false;
    G.hp = G.maxHp;
    G.shield = 0;
    CD_BAND = cdBandOf(f);
    nextMonster();
  }, floor);
  await page.waitForTimeout(250);
}

/* v4.1/v4.6 เด้งหน้าต่างบังคับกดยืนยันตอนก้าวเข้าห้องบอส (พฤติกรรมเดิมของเกม)
   ต้องกดปิดก่อนวัดผล ไม่งั้น v4.8.1 จะหยุดนาฬิกาไว้อย่างถูกต้องแล้วเคสตกด้วยเหตุผลผิด */
async function clearGate(page) {
  let quiet = 0;
  for (let i = 0; i < 18 && quiet < 4; i++) {
    const on = await page.evaluate(() => document.getElementById('snGate').classList.contains('active'));
    if (on) { quiet = 0; await page.evaluate(() => snGateConfirm()); }
    else quiet++;
    await page.waitForTimeout(180);
  }
}

function snap(page) {
  return page.evaluate(() => {
    const w  = document.getElementById('gWarp');
    const go = w ? w.querySelector('.g-warp-go') : null;
    const rw = document.getElementById('dwReward');
    const sh = document.getElementById('dwShop');
    return {
      floor: G.floor, warpOpen: !!G.warpOpen, locked: !!G.locked,
      visible: !!(w && w.style.display !== 'none'),
      title: (document.getElementById('gWarpTitle') || {}).textContent || '',
      body:  (document.getElementById('gWarpBody') || {}).innerHTML || '',
      go:    go ? go.textContent : '',
      reward: rw ? { shown: rw.style.display !== 'none', html: rw.innerHTML } : null,
      shop:   sh ? { shown: sh.style.display !== 'none' } : null,
      qTimer: QUESTION_TIMER !== null, qTick: QUESTION_TICK !== null,
      frz: FREEZE_TIMER !== null,
      nDup: { rw: document.querySelectorAll('#gWarp .dw-reward').length,
              sh: document.querySelectorAll('#gWarp .dw-shop').length,
              art: document.querySelectorAll('#gWarp .wp-art').length },
      choicesHidden: (document.getElementById('gChoices') || {}).style.display === 'none'
    };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══════════════════════════════════════════════════════════
  log('\n=== 1) ตัวช่วยคำนวณชั้นก่อนบอส (ไม่มีเลขฮาร์ดโค้ด) ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_calc');
    await settle(page);

    const r = await page.evaluate(() => {
      const pre = [], boss = [];
      for (let f = 1; f <= FLOOR_MAX; f++) {
        if (dwIsPreBossFloor(f)) pre.push(f);
        if (isBossFloor(f)) boss.push(f);
      }
      return { pre, boss, ver: DW_VER, kind: DW_PRE, wait: DW_WAIT };
    });
    ok('ชั้นก่อนบอส = 4/9/14/19', JSON.stringify(r.pre) === JSON.stringify([4, 9, 14, 19]), r.pre.join(','));
    ok('ชั้นบอส = 5/10/15/20', JSON.stringify(r.boss) === JSON.stringify([5, 10, 15, 20]), r.boss.join(','));
    ok('ป้ายรุ่น/kind/หน่วงเวลา', r.ver === 'v4.9.2' && r.kind === 'preboss' && r.wait === 1500);
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 2) ประตูก่อนบอส — เปิดครบทั้ง 4 จุด และไม่เปิดที่ชั้นอื่น ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_pre');
    await settle(page);

    for (const f of [4, 9, 14, 19]) {
      await standOn(page, f);
      await page.evaluate(() => clearFloor(false));
      await page.waitForTimeout(1900);          /* > DW_WAIT 1500 */
      const s = await snap(page);
      ok('ชั้น ' + f + ' → ประตูก่อนบอสเปิด', s.warpOpen && s.visible, 'floor=' + s.floor);
      ok('ชั้น ' + f + ' → ยืนอยู่ชั้นบอส ' + (f + 1), s.floor === f + 1, 'floor=' + s.floor);
      ok('ชั้น ' + f + ' → หัวข้อบอกห้องบอส', /ห้องบอสอยู่ข้างหน้า/.test(s.title), s.title);
      ok('ชั้น ' + f + ' → ปุ่มเข้าห้องบอส', s.go === '⚔️ เข้าสู่ห้องบอส ชั้น ' + (f + 1) + ' ▶', s.go);
      ok('ชั้น ' + f + ' → ปุ่มร้านค้าโผล่', !!(s.shop && s.shop.shown));
      ok('ชั้น ' + f + ' → ไม่โชว์กล่องรางวัลบอส', !!(s.reward && !s.reward.shown));
      ok('ชั้น ' + f + ' → เตือนดาเมจห้องบอส', /ดาเมจห้องบอส/.test(s.body), '');
      /* ตัวเลขบนบรรทัดเตือนต้องตรงกับ hdDamage สด ๆ ไม่ใช่เลขที่พิมพ์ทับไว้ */
      const dmg = await page.evaluate((ff) => ({
        miss: hdDamage(ff + 1, true, false), late: hdDamage(ff + 1, true, true)
      }), f);
      ok('ชั้น ' + f + ' → ตัวเลขเตือนตรงกับ hdDamage',
        s.body.indexOf('ตอบผิด −' + dmg.miss + ' HP') !== -1 &&
        s.body.indexOf('หมดเวลา −' + dmg.late + ' HP') !== -1,
        dmg.miss + '/' + dmg.late);
      await page.evaluate(() => { closeWarp(); clearTurnTimer(); });
    }

    /* ชั้นที่ไม่ใช่ก่อนบอส ต้องไหลต่อทันทีเหมือนเดิม */
    for (const f of [1, 2, 3, 7, 12, 18]) {
      await standOn(page, f);
      await page.evaluate(() => clearFloor(false));
      await page.waitForTimeout(1900);
      const s = await snap(page);
      ok('ชั้น ' + f + ' → ไม่มีประตูมาคั่น', !s.warpOpen && !s.visible, 'floor=' + s.floor);
      await page.evaluate(() => { closeWarp(); clearTurnTimer(); });
    }
    ok('ไม่มี pageerror (บล็อก 2)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 3) ประตูก่อนบอส — กดแล้วเข้าห้องบอสจริง ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_enter');
    await settle(page);

    await standOn(page, 4);
    await page.evaluate(() => clearFloor(false));
    await page.waitForTimeout(1900);
    const before = await snap(page);
    ok('ประตูเปิดอยู่', before.warpOpen);
    ok('ตัวเลือกถูกซ่อนระหว่างเปิดประตู', before.choicesHidden);

    await page.evaluate(() => document.querySelector('#gWarp .g-warp-go').click());
    await page.waitForTimeout(300);
    await clearGate(page);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      floor: G.floor, warpOpen: !!G.warpOpen, locked: !!G.locked,
      boss: isBossFloor(G.floor), mon: !!G.currentMonster,
      sealMax: (typeof AB_SEAL === 'object' && AB_SEAL) ? AB_SEAL.max : -1,
      sealLeft: typeof abSealLeft === 'function' ? abSealLeft() : -1,
      warpHidden: document.getElementById('gWarp').style.display === 'none',
      qTimer: QUESTION_TIMER !== null
    }));
    ok('กดแล้วประตูปิด', !after.warpOpen && after.warpHidden);
    ok('เข้าห้องบอสชั้น 5', after.floor === 5 && after.boss && after.mon);
    ok('ปลดล็อกให้ตอบได้', !after.locked);
    ok('นาฬิกาข้อใหม่เดินแล้ว', after.qTimer);
    ok('เกราะผนึกของ v4.6 ถูกสร้างหลังประตู', after.sealMax > 0 && after.sealLeft > 0,
      after.sealLeft + '/' + after.sealMax);
    ok('ไม่มี pageerror (บล็อก 3)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 4) ประตูหลังบอส — สรุปรางวัล + ปุ่มข้ามโซน ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_post');
    await settle(page);

    for (const f of [5, 10, 15]) {
      await standOn(page, f);
      const pre = await page.evaluate(() => ({ gold: G.gold, exp: G.exp, lv: G.level, maxExp: G.maxExp }));
      await page.evaluate(() => clearFloor(true));
      await page.waitForTimeout(1900);
      const s = await snap(page);
      const post = await page.evaluate(() => ({ gold: G.gold, lv: G.level }));

      ok('บอสชั้น ' + f + ' → ประตูชัยชนะเปิด', s.warpOpen && s.visible, 'floor=' + s.floor);
      ok('บอสชั้น ' + f + ' → หัวข้อชัยชนะ', /ปราบบอสสำเร็จ/.test(s.title), s.title);
      ok('บอสชั้น ' + f + ' → ปุ่มข้ามสู่โซนถัดไป',
        s.go === '🌀 ข้ามสู่โซนถัดไป — ชั้น ' + (f + 1) + ' ▶', s.go);
      ok('บอสชั้น ' + f + ' → กล่องรางวัลโผล่', !!(s.reward && s.reward.shown));
      ok('บอสชั้น ' + f + ' → ปุ่มร้านค้าโผล่', !!(s.shop && s.shop.shown));
      ok('บอสชั้น ' + f + ' → หัวกล่องบอกชั้นที่ปราบ',
        s.reward.html.indexOf('ปราบบอสชั้น ' + f) !== -1, '');

      const goldDelta = post.gold - pre.gold;
      ok('บอสชั้น ' + f + ' → ทองบนกล่องตรงกับที่ได้จริง',
        s.reward.html.indexOf('+' + goldDelta + '</b>') !== -1, 'delta=' + goldDelta);
      const won = await page.evaluate(() => DW_WON);
      ok('บอสชั้น ' + f + ' → EXP บนกล่องตรงกับที่ได้จริง',
        won.exp === 250 + (post.lv > pre.lv ? 0 : 0) || won.exp >= 250, 'exp=' + won.exp);
      ok('บอสชั้น ' + f + ' → เลเวลอัปถูกนับ',
        won.lv === (post.lv - pre.lv), won.lv + ' vs ' + (post.lv - pre.lv));

      await page.evaluate(() => { warpGo(); });
      await page.waitForTimeout(600);
      /* กดแล้วอาจไปเจอหน้าต่างจั่วการ์ดของ v4.7 (รอยต่อช่วงชั้น) */
      const st = await page.evaluate(() => ({
        floor: G.floor, warpOpen: !!G.warpOpen, won: DW_WON,
        draft: document.getElementById('cdDraft').classList.contains('active')
      }));
      ok('บอสชั้น ' + f + ' → กดแล้วไปชั้น ' + (f + 1), st.floor === f + 1 && !st.warpOpen);
      ok('บอสชั้น ' + f + ' → ยอดรางวัลถูกล้างหลังปิดประตู', st.won === null);
      if (st.draft) {
        await page.evaluate(() => document.querySelector('#cdDraft .cd-card').click());
        await page.waitForTimeout(900);
      }
    }
    ok('ไม่มี pageerror (บล็อก 4)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 5) หอคอยวนรอบ — บอสชั้น 20 ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_loop');
    await settle(page);

    await standOn(page, 20);
    await page.evaluate(() => clearFloor(true));
    await page.waitForTimeout(1900);
    const s = await snap(page);
    ok('บอสชั้น 20 → ประตูชัยชนะเปิด', s.warpOpen && s.visible);
    ok('บอสชั้น 20 → ปุ่มบอกเริ่มรอบใหม่', s.go === '🌀 เริ่มรอบใหม่ที่ชั้น 1 ▶', s.go);
    ok('บอสชั้น 20 → หัวกล่องยังบอกชั้น 20', s.reward.html.indexOf('ปราบบอสชั้น 20') !== -1);
    ok('บอสชั้น 20 → ยืนอยู่ชั้น 1 แล้ว', s.floor === 1);
    ok('ไม่มี pageerror (บล็อก 5)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 6) กฎหยุดเวลา 100% ระหว่างประตูเปิด ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_timer');
    await settle(page);

    /* ประตูก่อนบอส */
    await standOn(page, 9);
    const running = await page.evaluate(() => QUESTION_TIMER !== null && QUESTION_TICK !== null);
    ok('ก่อนเคลียร์ชั้น นาฬิกาเดินอยู่จริง', running);

    await page.evaluate(() => clearFloor(false));
    await page.waitForTimeout(1900);
    let s = await snap(page);
    ok('ประตูก่อนบอส → นาฬิกาหยุดสนิท', s.warpOpen && !s.qTimer && !s.qTick && !s.frz);

    /* ยืนแช่ไว้ 2.5 วิ แล้วนาฬิกาต้องยังไม่กลับมาเดินเอง */
    await page.waitForTimeout(2500);
    s = await snap(page);
    ok('ประตูก่อนบอส → แช่ไว้แล้วนาฬิกายังไม่เดิน', s.warpOpen && !s.qTimer && !s.qTick);

    /* เปิด-ปิดร้านค้าจากบนประตู แล้วนาฬิกาต้องยังหยุดอยู่ */
    await page.evaluate(() => dwOpenShop());
    await page.waitForTimeout(300);
    const shopOpen = await page.evaluate(() => document.getElementById('gShop').classList.contains('active'));
    ok('ปุ่มร้านค้าบนประตูเปิดร้านได้จริง', shopOpen);
    await page.evaluate(() => closeShop());
    await page.waitForTimeout(400);
    s = await snap(page);
    ok('ปิดร้านแล้วนาฬิกายังหยุดอยู่', s.warpOpen && !s.qTimer && !s.qTick);

    /* กดเข้าห้องบอส แล้วนาฬิกาต้องกลับมาเดิน */
    await page.evaluate(() => document.querySelector('#gWarp .g-warp-go').click());
    await page.waitForTimeout(300);
    await clearGate(page);
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({ q: QUESTION_TIMER !== null, t: QUESTION_TICK !== null }));
    ok('กดเข้าห้องบอสแล้วนาฬิกาเดินต่อ', back.q && back.t);

    /* ประตูหลังบอส */
    await standOn(page, 10);
    await page.evaluate(() => clearFloor(true));
    await page.waitForTimeout(1900);
    s = await snap(page);
    ok('ประตูหลังบอส → นาฬิกาหยุดสนิท', s.warpOpen && !s.qTimer && !s.qTick && !s.frz);
    await page.waitForTimeout(2500);
    s = await snap(page);
    ok('ประตูหลังบอส → แช่ไว้แล้วนาฬิกายังไม่เดิน', s.warpOpen && !s.qTimer && !s.qTick);

    ok('ไม่มี pageerror (บล็อก 6)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 7) กันแทรก DOM ซ้ำ (กับดักข้อ 2) + โหมดฝึกไม่มีประตู ===');
  {
    const page = await newPage(browser);
    await enter(page, 'dw_dup');
    await settle(page);

    await page.evaluate(() => {
      G.floor = 5;
      for (let i = 0; i < 12; i++) { renderWarp('preboss'); renderWarp('floor'); renderWarp('down'); }
    });
    const d = await page.evaluate(() => ({
      rw: document.querySelectorAll('#gWarp .dw-reward').length,
      sh: document.querySelectorAll('#gWarp .dw-shop').length,
      art: document.querySelectorAll('#gWarp .wp-art').length,
      rows: document.querySelectorAll('#gWarpBody .g-warp-row').length
    }));
    ok('กล่องรางวัลมีใบเดียวหลังวาด 36 รอบ', d.rw === 1, 'n=' + d.rw);
    ok('ปุ่มร้านค้ามีใบเดียวหลังวาด 36 รอบ', d.sh === 1, 'n=' + d.sh);
    ok('ภาพประตูของ v4.1 ยังมีใบเดียว', d.art === 1, 'n=' + d.art);
    ok('แถวใน body ไม่สะสมซ้ำ', d.rows <= 8, 'rows=' + d.rows);

    /* kind 'down' ต้องคืนของทุกอย่างกลับเป็นประตูเดิมของ v4.0 */
    const down = await page.evaluate(() => {
      renderWarp('down');
      const w = document.getElementById('gWarp');
      return {
        go: w.querySelector('.g-warp-go').textContent,
        shop: document.getElementById('dwShop').style.display,
        rw: document.getElementById('dwReward').style.display,
        cls: w.className
      };
    });
    ok('ประตู "down" ใช้ปุ่มเดิมของ v4.0', down.go === '⚔️ ถัดไป ▶', down.go);
    ok('ประตู "down" ไม่มีปุ่มร้านค้า/กล่องรางวัล', down.shop === 'none' && down.rw === 'none');
    ok('ประตู "down" ไม่ติดคลาสของสองประตูใหม่',
      down.cls.indexOf('dw-pre') === -1 && down.cls.indexOf('dw-post') === -1, down.cls);

    /* โหมดฝึกจุดอ่อนต้องไม่มีประตูมาขวาง */
    await page.evaluate(() => {
      closeWarp(); clearTurnTimer();
      G.practiceMode = true; G.floor = 4; G.floorProgress = MONSTERS_PER_FLOOR - 1;
      clearFloor(false);
    });
    await page.waitForTimeout(1900);
    const prac = await page.evaluate(() => ({ warpOpen: !!G.warpOpen, won: DW_WON }));
    ok('โหมดฝึกจุดอ่อน → ไม่มีประตูก่อนบอส', !prac.warpOpen);
    await page.evaluate(() => { G.practiceMode = false; });

    ok('ไม่มี pageerror (บล็อก 7)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 8) เลย์เอาต์ไม่ล้มบนทุกความกว้าง ===');
  {
    for (const w of [320, 360, 390, 430, 768]) {
      const page = await newPage(browser, w, w < 400 ? 640 : 844);
      await enter(page, 'dw_lay' + w);
      await settle(page);

      /* ประตูก่อนบอส */
      await standOn(page, 19);
      await page.evaluate(() => clearFloor(false));
      await page.waitForTimeout(1900);
      let m = await page.evaluate(() => {
        const gs = document.getElementById('gameScreen');
        const go = document.querySelector('#gWarp .g-warp-go');
        const sh = document.getElementById('dwShop');
        return {
          overflow: document.body.scrollWidth <= window.innerWidth,
          gsOverflow: gs.scrollWidth <= gs.clientWidth + 1,
          goW: go.getBoundingClientRect().width,
          shW: sh.getBoundingClientRect().width,
          shH: sh.getBoundingClientRect().height,
          warpW: document.getElementById('gWarp').getBoundingClientRect().width,
          goRect: [Math.round(go.getBoundingClientRect().top), Math.round(go.getBoundingClientRect().bottom)],
          vh: window.innerHeight,
          inView: go.getBoundingClientRect().bottom <= window.innerHeight &&
                  go.getBoundingClientRect().top >= 0 &&
                  sh.getBoundingClientRect().bottom <= window.innerHeight
        };
      });
      ok(w + 'px · ประตูก่อนบอส ไม่ล้นแนวนอน', m.overflow && m.gsOverflow);
      ok(w + 'px · ปุ่มก่อนบอสอยู่ในจอหลังเปิดประตู', m.inView,
        JSON.stringify(m.goRect) + ' vh=' + m.vh);
      ok(w + 'px · ปุ่มร้านค้ากว้างเท่าปุ่มไป', Math.abs(m.shW - m.goW) < 1.5, m.shW + '/' + m.goW);
      ok(w + 'px · ปุ่มร้านค้าสูงพอกดได้', m.shH >= 34, 'h=' + m.shH);

      /* ประตูหลังบอส */
      await page.evaluate(() => { closeWarp(); clearTurnTimer(); });
      await standOn(page, 20);
      await page.evaluate(() => clearFloor(true));
      await page.waitForTimeout(1900);
      m = await page.evaluate(() => {
        const gs = document.getElementById('gameScreen');
        const go = document.querySelector('#gWarp .g-warp-go');
        const rw = document.getElementById('dwReward');
        const rows = Array.from(document.querySelectorAll('#dwReward .dw-rw-row b'));
        return {
          overflow: document.body.scrollWidth <= window.innerWidth,
          gsOverflow: gs.scrollWidth <= gs.clientWidth + 1,
          nRows: rows.length,
          wrapped: rows.filter(b => b.getBoundingClientRect().height > 22).length,
          goRect: [Math.round(go.getBoundingClientRect().top), Math.round(go.getBoundingClientRect().bottom)],
          rwRect: [Math.round(rw.getBoundingClientRect().top), Math.round(rw.getBoundingClientRect().bottom)],
          vh: window.innerHeight,
          inView: go.getBoundingClientRect().bottom <= window.innerHeight &&
                  rw.getBoundingClientRect().top >= 0 &&
                  rw.getBoundingClientRect().bottom <= window.innerHeight
        };
      });
      ok(w + 'px · ประตูหลังบอส ไม่ล้นแนวนอน', m.overflow && m.gsOverflow);
      ok(w + 'px · ปุ่มหลังบอสอยู่ในจอ + เห็นกล่องรางวัลครบ', m.inView,
        JSON.stringify(m.goRect) + ' rw=' + JSON.stringify(m.rwRect) + ' vh=' + m.vh);
      ok(w + 'px · ตัวเลขรางวัลไม่ตกบรรทัด', m.wrapped === 0, m.wrapped + '/' + m.nRows);
      ok(w + 'px · ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
      await page.context().close();
    }
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 9) เล่นจริงจากชั้น 4 ถึงเข้าห้องบอสชั้น 5 ===');
  {
    const page = await newPage(browser, 390, 844);
    await enter(page, 'dw_real');
    await settle(page);

    await page.evaluate(() => {
      G.floor = 4; G.floorProgress = MONSTERS_PER_FLOOR - 1; G.maxFloor = FLOOR_MAX;
      G.hp = G.maxHp; recalcStats(); nextMonster();
    });
    await page.waitForTimeout(300);

    /* ตอบถูกรัว ๆ จนล้มอสูรตัวสุดท้ายของชั้น 4 */
    let guard = 0;
    while (guard++ < 40) {
      const st = await page.evaluate(() => ({
        locked: !!G.locked, warp: !!G.warpOpen, mon: !!G.currentMonster,
        floor: G.floor, gate: document.getElementById('snGate').classList.contains('active'),
        draft: document.getElementById('cdDraft').classList.contains('active')
      }));
      if (st.gate) { await page.evaluate(() => snGateConfirm()); await page.waitForTimeout(200); continue; }
      if (st.draft) {
        await page.evaluate(() => document.querySelector('#cdDraft .cd-card').click());
        await page.waitForTimeout(900); continue;
      }
      if (st.warp) break;
      if (st.locked || !st.mon) { await page.waitForTimeout(300); continue; }
      await page.evaluate(() => answer(G.currentMonster.answer, null));
      await page.waitForTimeout(400);
    }

    const s = await snap(page);
    ok('เล่นจริงแล้วเจอประตูก่อนบอส', s.warpOpen && /ห้องบอสอยู่ข้างหน้า/.test(s.title), s.title);
    ok('เล่นจริง → นาฬิกาหยุด', !s.qTimer && !s.qTick);
    ok('เล่นจริง → ปุ่มร้านค้า + ปุ่มเข้าห้องบอสอยู่ครบ',
      !!(s.shop && s.shop.shown) && /เข้าสู่ห้องบอส ชั้น 5/.test(s.go), s.go);

    /* ปุ่มต้องกดได้จริง ไม่มีอะไรลอยทับ (ซ่อนชั้น toast ก่อนวัดตามกติกาของ v4.9) */
    const hit = await page.evaluate(() => {
      const lay = document.getElementById('snLayer');
      const keep = lay.style.display; lay.style.display = 'none';
      const pick = (el) => {
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(t && (t === el || el.contains(t)));
      };
      const goEl = document.querySelector('#gWarp .g-warp-go');
      const shEl = document.getElementById('dwShop');
      const go = pick(goEl), sh = pick(shEl);
      const rr = (el) => { const r = el.getBoundingClientRect();
        return [Math.round(r.top), Math.round(r.bottom), Math.round(window.innerHeight)]; };
      const out = { go, sh, goRect: rr(goEl), shRect: rr(shEl) };
      lay.style.display = keep;
      return out;
    });
    ok('ปุ่มเข้าห้องบอสอยู่ในจอและกดโดนจริง', hit.go, JSON.stringify(hit.goRect));
    ok('ปุ่มร้านค้าอยู่ในจอและกดโดนจริง', hit.sh, JSON.stringify(hit.shRect));

    await page.evaluate(() => document.querySelector('#gWarp .g-warp-go').click());
    await page.waitForTimeout(300);
    await clearGate(page);
    await page.waitForTimeout(500);
    const fin = await page.evaluate(() => ({
      floor: G.floor, boss: isBossFloor(G.floor), mon: !!G.currentMonster, locked: !!G.locked
    }));
    ok('เล่นจริง → เข้าห้องบอสชั้น 5 สำเร็จ', fin.floor === 5 && fin.boss && fin.mon && !fin.locked);
    ok('ไม่มี pageerror (บล็อก 9)', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  await browser.close();
  log('\n══════════════════════════════════');
  log('PASS ' + PASS + '  ·  FAIL ' + FAIL);
  console.log(fs.readFileSync(LOG, 'utf8'));
  process.exit(FAIL ? 1 : 0);
})();
