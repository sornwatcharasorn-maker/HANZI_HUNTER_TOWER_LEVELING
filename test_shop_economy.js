/* ══════════════════════════════════════════════════════════════════════════════
 *  test_shop_economy.js — ชุดเทสต์ของ Patch v7.5 · SHOP ECONOMY & AUTO/ACTIVE BUFFS
 *  รัน: NODE_PATH=/opt/node22/lib/node_modules node test_shop_economy.js
 *
 *  ข้อควรระวังที่เขียนไว้กันเดินซ้ำ
 *   1. **ต้อง stub fetch + EventSource ก่อนโหลดหน้าเสมอ** — v5.4 ฝัง URL ฐานข้อมูล
 *      จริงไว้ในซอร์สและเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า ไม่ stub = ยิงเข้าห้องเรียนจริง
 *   2. **เข้าเกมด้วยเส้นทางจริงเสมอ** — ผ่านป๊อปอัปกติกาของ v5.6 (เลื่อน #rgBody
 *      ให้สุดแล้ว rgAck()) ห้ามเรียก enterGate() ตรง ๆ เพราะ v5.6 บล็อกไว้
 *   3. **ปิดหน้าต่างจั่วการ์ดของ v4.7 ให้จบก่อนวัดทุกครั้ง** ไม่งั้น canAct() เป็นเท็จ
 *      แล้ว useItem จะถูกปัดตกด้วยเหตุผลผิด
 *   4. **ปลดล็อกแรงค์ก่อนเทสต์ไอเทมเสมอ** (G.maxFloor = FLOOR_MAX; recalcStats())
 *      ไม่งั้น FEATURE_RANK ของ v4.0 ปัดตกตั้งแต่บรรทัดแรก
 *   5. **cdHeal หนีบที่ maxHp** — ถังของ 🔮 จึงลดเท่ากับ "HP ที่ฟื้นได้จริง"
 *      ไม่ใช่ 250 เป๊ะเสมอไป (จงใจ ไม่เผาถังทิ้งกับการฮีลล้นหลอด)
 *   6. **วัดความสูงการ์ดโจทย์ต้องบังคับคำ/ตัวเลือกให้คงที่ก่อน** และล้าง #gFeedback
 *      ไม่งั้นข้อความที่ค้างจากจังหวะเลือกการ์ดจะดันการ์ดสูงขึ้น แล้วเคสตกด้วยเหตุผลผิด
 * ══════════════════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_shop_economy.log');
let pass = 0, fail = 0;
const say = t => { console.log(t); fs.appendFileSync(LOG, t + '\n'); };
const ok = (c, m) => { if (c) { pass++; say('  ✅ ' + m); } else { fail++; say('  ❌ ' + m); } };
const head = t => say('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length)));

/* ราคาชุดใหม่ตามสเปก — ตารางนี้เป็น "สารบัญชุดที่สอง" โดยตั้งใจ
   ถ้าอ่านค่าจาก BA_SE_DEF มาเทียบกับ BA_SE_DEF จะไม่มีวันตก */
const WANT = [
  { key: 'potion',    icon: '🧪', price: 650,  name: 'น้ำยาสมานแผลฮันเตอร์', en: 'Large HP Potion' },
  { key: 'freeze',    icon: '⏳', price: 1200, name: 'ทรายหยุดเวลา',        en: 'Time Sandglass' },
  { key: 'mystery',   icon: '📦', price: 1200, name: 'กล่องเสบียงเตรียมรบ',  en: 'Hunter Vanguard Cache' },
  { key: 'glass',     icon: '🔍', price: 2200, name: 'แว่นเนตรหยั่งรู้',     en: 'Clarity Lens' },
  { key: 'scroll',    icon: '📜', price: 2500, name: 'ม้วนคัมภีร์ตัดชอยส์',  en: 'Scroll of Elimination' },
  { key: 'focus',     icon: '🔮', price: 3600, name: 'คริสตัลฟื้นฟูอัตโนมัติ', en: 'Abyssal Auto-Elixir' },
  { key: 'insurance', icon: '🛡️', price: 5000, name: 'ตราประทับชุบชีวิต',    en: 'Hunter Insurance' }
];

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

/* เข้าเกมด้วยเส้นทางจริง — กติกา v5.6 → v4.0 → ปิดหน้าต่างจั่วของ v4.7 */
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
  fs.writeFileSync(LOG, '=== test_shop_economy · ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  // ══ บล็อก 1 · สารบัญไอเทม ราคา และการขายคืน 50% ═══════════════════════════
  {
    head('บล็อก 1 · ราคา · ชื่อ · ไอคอน · ขายคืน 50%');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_a');

    const a = await page.evaluate(() => baBattleAudit().shop);
    ok(!!a && a.ver === '7.5', 'baBattleAudit().shop รายงานรุ่น 7.5');
    ok(a.sell === 0.5, 'อัตราขายคืนเป็น 50% (' + a.sell + ')');
    WANT.forEach(w => {
      const it = a.items.filter(x => x.key === w.key)[0];
      ok(!!it, 'มีไอเทมคีย์ ' + w.key + ' อยู่ในสารบัญ');
      if (!it) return;
      ok(it.price === w.price, w.icon + ' ราคา ' + it.price + ' (ต้อง ' + w.price + ')');
      ok(it.sell === Math.floor(w.price * 0.5), w.icon + ' ขายคืน ' + it.sell +
         ' (ต้อง ' + Math.floor(w.price * 0.5) + ')');
      ok(it.name === w.name, w.icon + ' ชื่อไทย "' + it.name + '"');
      ok(it.icon === w.icon, w.key + ' ใช้ไอคอน ' + it.icon);
      ok(it.en === w.en, w.icon + ' ชื่ออังกฤษ ' + it.en);
    });

    /* ข้อความบนหน้าร้านต้องประกอบจากค่าคงที่ ไม่ใช่พิมพ์เลขทับไว้ */
    const txt = await page.evaluate(() => {
      const o = {};
      ITEMS.forEach(it => { o[it.key] = it.effect + ' ' + it.how; });
      return o;
    });
    ok(/\+35% ของ HP สูงสุด/.test(txt.potion), '🧪 ข้อความบอก +35% ของ HP สูงสุด');
    ok(/\+4\.0s ต่อข้อ นาน 5 ข้อ/.test(txt.freeze), '⏳ ข้อความบอก +4.0s ต่อข้อ นาน 5 ข้อ');
    ok(/\+40 MP/.test(txt.mystery) && /สตรีค 1/.test(txt.mystery), '📦 ข้อความบอก +40 MP + สตรีค 1');
    ok(/100%/.test(txt.glass) && /\+3\.0s/.test(txt.glass), '🔍 ข้อความบอกกัน 100% + หน่วง 3.0s');
    ok(/1 ชอยส์/.test(txt.scroll) && /นาน 3 ข้อ/.test(txt.scroll), '📜 ข้อความบอกตัด 1 ชอยส์ นาน 3 ข้อ');
    ok(/1000 HP/.test(txt.focus) && /\+250 HP/.test(txt.focus), '🔮 ข้อความบอกถัง 1000 · ฮีล 250');
    ok(/\+30% HP/.test(txt.insurance), '🛡️ ข้อความบอกฟื้น +30% HP');

    /* image ต้องไม่ถูกแตะ — เป็นสารบัญของ embed_item_art.py */
    const imgs = await page.evaluate(() => ITEMS.map(i => [i.key, i.image, !!i.img]));
    ok(imgs.every(r => /^assets\/items\//.test(r[1])), 'ฟิลด์ image ยังชี้ assets/items/ ครบทุกใบ');
    ok(imgs.every(r => r[2]), 'ภาพที่ฝังไว้ (img) ยังอยู่ครบทุกใบ');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 2 · บัฟรายข้อ ⏳ 🔍 📜 + Badge Counter ═══════════════════════════
  {
    head('บล็อก 2 · บัฟรายข้อ + Badge Counter');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_b');

    const r = await page.evaluate(() => {
      G.gold = 99999;
      G.items = { potion: 0, scroll: 1, freeze: 1, focus: 0, glass: 1, insurance: 0, mystery: 0 };
      renderItems();
      const o = { steps: [] };
      useItem('freeze'); useItem('glass'); useItem('scroll');
      const b = baBattleAudit().shop.buff;
      o.time = b.time; o.lens = b.lens; o.scroll = b.scroll;
      o.badges = baBattleAudit().shop.dom.badges;
      o.hudOn = baBattleAudit().shop.dom.hudOn;
      o.base = questionMs();
      /* เดินตัวนับทีละข้อโดยไม่ต้องเล่นจริง */
      for (let i = 0; i < 6; i++) {
        startQuestionTimer();
        const s = baBattleAudit().shop.buff;
        o.steps.push([s.time, s.lens, s.scroll, questionMs()]);
      }
      clearQuestionTimer();
      return o;
    });
    ok(r.time === 5, '⏳ ตั้งตัวนับ 5 ข้อ · ได้ ' + r.time);
    ok(r.lens === 5, '🔍 ตั้งตัวนับ 5 ข้อ · ได้ ' + r.lens);
    ok(r.scroll === 3, '📜 ตั้งตัวนับ 3 ข้อ · ได้ ' + r.scroll);
    ok(r.badges === 3, 'Badge Counter โผล่ครบ 3 ใบ · ได้ ' + r.badges);
    ok(r.hudOn === true, 'แถบ Badge ติดคลาส .on');
    ok(r.steps[0][3] === r.base + 4000, '⏳ ข้อที่ 1 ได้ +4000ms (' + r.base + ' → ' + r.steps[0][3] + ')');
    ok(r.steps[4][3] === r.base + 4000, '⏳ ข้อที่ 5 ยังได้ +4000ms');
    ok(r.steps[5][3] === r.base, '⏳ ข้อที่ 6 หมดฤทธิ์แล้ว (' + r.steps[5][3] + ')');
    ok(r.steps[5][0] === 0 && r.steps[5][1] === 0 && r.steps[5][2] === 0,
       'ตัวนับทั้งสามหมดพอดีตามจำนวนข้อที่สเปกสั่ง');

    const gone = await page.evaluate(() => baBattleAudit().shop.dom.hudOn);
    ok(gone === false, 'บัฟหมดแล้ว Badge หายไปเอง');

    /* 📜 ตัดชอยส์ให้จริง */
    const cut = await page.evaluate(async () => {
      G.items.scroll = 1; renderItems();
      useItem('scroll');
      await new Promise(r => setTimeout(r, 60));
      const before = G.currentMonster ? G.currentMonster.choices.length : 0;
      startQuestionTimer();
      const after = G.currentMonster ? G.currentMonster.choices.length : 0;
      clearQuestionTimer();
      return { before: before, after: after,
               btns: document.querySelectorAll('#gChoices .g-choice').length,
               hasAnswer: !!(G.currentMonster && G.currentMonster.choices.indexOf(G.currentMonster.answer) >= 0) };
    });
    ok(cut.after < cut.before || cut.before <= 3, '📜 ตัดชอยส์ผิดออกจริง ' + cut.before + ' → ' + cut.after);
    ok(cut.hasAnswer, '📜 เฉลยยังอยู่ในตัวเลือกเสมอ');
    ok(cut.btns === cut.after, '📜 ปุ่มบนจอตรงกับจำนวนตัวเลือกจริง (' + cut.btns + ')');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 3 · 🔍 กันกับดักโจทย์ + หน่วงจอดำ ═══════════════════════════════
  {
    head('บล็อก 3 · 🔍 กันกับดัก Mirror Cipher / Vanishing Choices + หน่วงจอดำ');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_c');

    const r = await page.evaluate(() => {
      /* ยืนบนชั้นบอสจริงของ v6.4 แล้วปิดระบบบุกรุกของ v6.6 กันสุ่มทับ */
      G.floor = 20; G.floorProgress = 0;
      BA_INC_F = 20; BA_INC_AT = -1; BA_INC_M = null;
      nextMonster();
      /* nextMonster บนชั้นบอสล็อกเทิร์นไว้ (G.locked = true) ซึ่ง canAct() ของ v4.0
         ปัดตกอย่างถูกต้อง — ปลดเองก่อนวัด ไม่งั้นเคสจะตกด้วยเหตุผลผิด */
      G.locked = false;
      const o = {};
      /* ไม่มีแว่น = กับดักต้องยิงได้ (บังคับด้วยการเรียกซ้ำจนติด) */
      G.items = { glass: 1, potion: 0, scroll: 0, freeze: 0, focus: 0, insurance: 0, mystery: 0 };
      renderItems();
      let hit = 0;
      for (let i = 0; i < 200; i++) { if (baTrapRoll()) hit++; }
      o.without = hit;
      o.blkWithout = baDbBlkMs(2000);

      useItem('glass');
      let hit2 = 0;
      for (let i = 0; i < 200; i++) { if (baTrapRoll()) hit2++; }
      o.with = hit2;
      o.blkWith = baDbBlkMs(2000);
      o.trapN = baBattleAudit().shop.n.trap;
      o.cls = document.getElementById('gameScreen').className;
      return o;
    });
    ok(r.without > 0, 'ไม่มีแว่น = กับดักยังยิงได้ (' + r.without + '/200)');
    ok(r.with === 0, '🔍 มีแว่นแล้วกับดักไม่ติดเลยสักครั้ง (' + r.with + '/200)');
    ok(r.trapN >= 200, '🔍 นับการกันไว้ครบ (' + r.trapN + ')');
    ok(!/ba-cipher/.test(r.cls), '🔍 ไม่มีคลาส ba-cipher ค้างบนจอ');
    ok(r.blkWith === Math.max(200, r.blkWithout - 3000),
       '🔍 หน่วงจอดำ ' + r.blkWithout + ' → ' + r.blkWith + ' ms');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 4 · 🧪 ฟื้น 35% · 📦 กล่องเสบียง ════════════════════════════════
  {
    head('บล็อก 4 · 🧪 ฟื้น 35% · 📦 กล่องเสบียงเตรียมรบ');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_d');

    const p = await page.evaluate(() => {
      CD_CARD = null;                       /* กันการ์ด 💀 มาบล็อกการฟื้น */
      G.items = { potion: 2, scroll: 0, freeze: 0, focus: 0, glass: 0, insurance: 0, mystery: 0 };
      renderItems();
      G.hp = 1;
      const before = G.hp;
      useItem('potion');
      return { before: before, after: G.hp, want: Math.round(G.maxHp * 0.35), max: G.maxHp,
               left: G.items.potion };
    });
    ok(p.after - p.before === p.want, '🧪 ฟื้น ' + (p.after - p.before) + ' HP (35% = ' + p.want + ')');
    ok(p.left === 1, '🧪 ถูกหักออกจากกระเป๋า 1 ชิ้น');

    const full = await page.evaluate(() => {
      G.hp = G.maxHp;
      const n = G.items.potion;
      useItem('potion');
      return { n: n, left: G.items.potion };
    });
    ok(full.left === full.n, '🧪 HP เต็มแล้วกดใช้ไม่ได้ ของไม่ถูกกินทิ้ง');

    const c = await page.evaluate(() => {
      G.items.mystery = 1; renderItems();
      G.mp = 0; G.streak = 0;
      /* แปะดีบัฟไว้ให้กล่องล้าง */
      document.getElementById('gameScreen').classList.add('ba-blind');
      BA_FORT = true;
      useItem('mystery');
      return { mp: G.mp, streak: G.streak, maxMp: maxMpOf(G),
               blind: document.getElementById('gameScreen').classList.contains('ba-blind'),
               fort: BA_FORT, left: G.items.mystery };
    });
    ok(c.mp === Math.min(c.maxMp, 40), '📦 ได้ MP ' + c.mp + ' (เพดาน ' + c.maxMp + ')');
    ok(c.streak === 1, '📦 เริ่มด้วยสตรีค 1 · ได้ ' + c.streak);
    ok(c.blind === false, '📦 ล้างดีบัฟตาบอดให้');
    ok(c.fort === false, '📦 ล้าง Heavy Fortress ให้');
    ok(c.left === 0, '📦 ถูกหักออกจากกระเป๋า');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 5 · 🔮 Auto-Elixir ══════════════════════════════════════════════
  {
    head('บล็อก 5 · 🔮 คริสตัลฟื้นฟูอัตโนมัติ');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_e');

    const r = await page.evaluate(() => {
      CD_CARD = null;
      G.items = { potion: 0, scroll: 0, freeze: 0, focus: 0, glass: 0, insurance: 0, mystery: 0 };
      addItem('focus', 1);
      renderStats();
      const o = { tank0: baBattleAudit().shop.elixir.tank, ticks: [] };
      /* HP 50% ไม่ควรทริกเกอร์ */
      G.hp = Math.round(G.maxHp * 0.5);
      renderStats();
      o.hp50 = G.hp; o.tank50 = baBattleAudit().shop.elixir.tank;
      /* HP 25% ต้องทริกเกอร์ */
      G.hp = Math.round(G.maxHp * 0.25);
      const before = G.hp;
      renderStats();
      o.healed = G.hp - before;
      o.tankAfter = baBattleAudit().shop.elixir.tank;
      o.elxOn = baBattleAudit().shop.dom.elxOn;
      return o;
    });
    ok(r.tank0 === 1000, '🔮 ได้ของมา = ถังเต็ม 1000 · ได้ ' + r.tank0);
    ok(r.tank50 === 1000, '🔮 HP 50% ยังไม่ทริกเกอร์ (ถัง ' + r.tank50 + ')');
    ok(r.healed > 0, '🔮 HP 25% ทริกเกอร์ฮีล +' + r.healed);
    ok(r.tankAfter === 1000 - r.healed, '🔮 ถังลดเท่าที่ฮีลจริง (' + r.tankAfter + ')');
    ok(r.elxOn, '🔮 ยอดถังโผล่ข้างหลอด HP');

    /* ถังหมด = คริสตัลสลาย */
    const drain = await page.evaluate(() => {
      let guard = 0;
      while (baBattleAudit().shop.elixir.tank > 0 && guard++ < 60) {
        G.hp = 1;
        renderStats();
      }
      return { tank: baBattleAudit().shop.elixir.tank, have: G.items.focus,
               elxOn: baBattleAudit().shop.dom.elxOn, n: baBattleAudit().shop.n.elx };
    });
    ok(drain.tank === 0, '🔮 ถังหมดจริง');
    ok(drain.have === 0, '🔮 ถังหมดแล้วคริสตัลสลายไปจากกระเป๋า');
    ok(drain.elxOn === false, '🔮 ยอดถังหายไปจากข้างหลอด HP');
    ok(drain.n > 1, '🔮 ฮีลไปหลายรอบ (' + drain.n + ' ครั้ง)');

    /* พกได้ 1 ชิ้น */
    const cap = await page.evaluate(() => {
      G.items.focus = 0; G.items.insurance = 0;
      addItem('focus', 5); addItem('insurance', 5);
      renderStats();
      return { f: G.items.focus, i: G.items.insurance };
    });
    ok(cap.f === 1, '🔮 พกได้สูงสุด 1 ชิ้น (addItem 5 → ' + cap.f + ')');
    ok(cap.i === 1, '🛡️ พกได้สูงสุด 1 ชิ้น (addItem 5 → ' + cap.i + ')');

    /* ล็อกห้ามซื้อซ้ำในหน้าร้าน */
    const shop = await page.evaluate(() => {
      G.gold = 99999;
      openShop();
      const rows = document.querySelectorAll('#gShopBody .g-shop-buy');
      const out = [];
      rows.forEach(b => {
        if (b.classList.contains('sell')) return;
        const m = /buyItem\('([^']+)'\)/.exec(b.getAttribute('onclick') || '');
        if (m) out.push([m[1], b.disabled, b.textContent.trim()]);
      });
      closeShop();
      return out;
    });
    const fo = shop.filter(r => r[0] === 'focus')[0];
    const io = shop.filter(r => r[0] === 'insurance')[0];
    ok(fo && fo[1] === true && /มีแล้ว/.test(fo[2]), '🔮 มีแล้ว → ปุ่มซื้อถูกล็อก (' + (fo ? fo[2] : '?') + ')');
    ok(io && io[1] === true && /มีแล้ว/.test(io[2]), '🛡️ มีแล้ว → ปุ่มซื้อถูกล็อก (' + (io ? io[2] : '?') + ')');
    const po = shop.filter(r => r[0] === 'potion')[0];
    ok(po && po[1] === false, '🧪 ที่ไม่ใช่ unique ยังซื้อได้ตามปกติ');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 6 · 🛡️ ชุบชีวิต 30% ที่เดิม ═════════════════════════════════════
  {
    head('บล็อก 6 · 🛡️ ตราประทับชุบชีวิต');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_f');

    const r = await page.evaluate(() => {
      CD_CARD = null;
      G.floor = 18; G.floorProgress = 1;
      G.items = { potion: 0, scroll: 0, freeze: 0, focus: 0, glass: 0, insurance: 1, mystery: 0 };
      renderItems();
      G.hp = 1;
      const floorBefore = G.floor;
      onHunterDown();
      return { hp: G.hp, max: G.maxHp, ins: G.items.insurance,
               floor: G.floor, floorBefore: floorBefore,
               fb: (document.getElementById('gFeedback') || {}).textContent || '',
               n: baBattleAudit().shop.n.ins };
    });
    ok(r.ins === 0, '🛡️ ถูกใช้ไป 1 ชิ้น');
    ok(r.hp === Math.max(1, Math.round(r.max * 0.30)),
       '🛡️ ฟื้น 30% ของหลอด = ' + r.hp + '/' + r.max);
    ok(r.floor === r.floorBefore, '🛡️ ยืนอยู่ชั้นเดิม (' + r.floor + ')');
    ok(/30%/.test(r.fb), '🛡️ บรรทัดผลลัพธ์บอก 30% · "' + r.fb.slice(0, 60) + '"');
    ok(r.n === 1, '🛡️ นับการชุบชีวิตไว้ 1 ครั้ง');

    const none = await page.evaluate(() => {
      CD_CARD = null;
      G.items.insurance = 0;
      G.floor = 18; G.floorProgress = 1;
      G.hp = 1;
      onHunterDown();
      return { floor: G.floor, zone: zoneOf(18).from };
    });
    ok(none.floor !== 18, 'ไม่มี 🛡️ = ยังร่วงกลับตามกติกาเดิมของ v4.0/v6.4 (ชั้น ' + none.floor + ')');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 7 · ถังรอดข้ามการล็อกอิน + กติกาของชั้นล่างยังอยู่ ════════════════
  {
    head('บล็อก 7 · ถัง 🔮 รอดข้ามการล็อกอิน · Flag ของ v4.7 ยังบล็อกได้');
    const { ctx, page, errs } = await boot(browser);
    await enter(page, 'se_g');

    await page.evaluate(() => {
      CD_CARD = null;
      G.items = { potion: 0, scroll: 0, freeze: 0, focus: 0, glass: 0, insurance: 0, mystery: 0 };
      addItem('focus', 1);
      renderStats();
      G.hp = Math.round(G.maxHp * 0.2);
      renderStats();          /* ใช้ถังไปหนึ่งงวด */
      saveProgress();
    });
    const mid = await page.evaluate(() => baBattleAudit().shop.elixir.tank);
    ok(mid > 0 && mid < 1000, 'ใช้ถังไปบางส่วนแล้ว (' + mid + ')');

    await page.evaluate(() => exitGame());
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      switchTab('login');
      document.getElementById('login-id').value = 'se_g';
      document.getElementById('login-pw').value = '1111';
      handleSubmit();
    });
    await page.waitForTimeout(1400);
    await clearOverlays(page);
    const back = await page.evaluate(() => ({
      tank: baBattleAudit().shop.elixir.tank, have: G.items.focus,
      ready: baBattleAudit().shop.elixir.ready
    }));
    ok(back.have === 1, 'ล็อกอินกลับมาแล้วคริสตัลยังอยู่');
    ok(back.tank === mid, 'ถังไม่ถูกเติมเต็มฟรี — ' + mid + ' → ' + back.tank);
    ok(back.ready === true, 'สวิตช์ BA_SE_READY เปิดหลังอ่านค่าจาก store ครบ');

    /* Flag ห้ามใช้ไอเทมของ 🚫 ผนึกพ็อกเก็ต (v4.7) ต้องยังบล็อกไอเทมสายบัฟได้ */
    const blocked = await page.evaluate(() => {
      G.maxFloor = FLOOR_MAX; recalcStats();
      G.items.freeze = 1; renderItems();
      CD_CARD = CD_BY_ID['seal'];
      CD_BAND = cdBandOf(G.floor);
      CD_ST = { ward: 0, noItem: 1, noHeal: 0, atk: 0, perfect: true, hit: 0, miss: 0, paid: 0 };
      const before = G.items.freeze;
      useItem('freeze');
      const out = { before: before, after: G.items.freeze,
                    buff: baBattleAudit().shop.buff.time,
                    msg: (document.getElementById('gItemMsg') || {}).textContent || '' };
      CD_CARD = null; CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
      return out;
    });
    ok(blocked.after === blocked.before, '🚫 ผนึกพ็อกเก็ตยังบล็อกไอเทมสายบัฟได้ (ของไม่ถูกกิน)');
    ok(blocked.buff === 0, '🚫 ถูกบล็อกแล้วไม่ได้บัฟ');
    ok(/ผนึกพ็อกเก็ต/.test(blocked.msg), '🚫 บอกเหตุผลให้ผู้เล่นรู้');

    /* 💀 พันธสัญญาโลหิตทมิฬต้องยังกัน 🔮 ฮีลออโต้ได้ */
    const noHeal = await page.evaluate(() => {
      G.items.focus = 0; renderStats();
      addItem('focus', 1); renderStats();
      CD_CARD = CD_BY_ID['vow'];
      CD_BAND = cdBandOf(G.floor);
      CD_ST = { ward: 0, noItem: 0, noHeal: 1, atk: 0, perfect: true, hit: 0, miss: 0, paid: 0 };
      const tank = baBattleAudit().shop.elixir.tank;
      G.hp = 1;
      renderStats();
      const out = { hp: G.hp, tank0: tank, tank1: baBattleAudit().shop.elixir.tank };
      CD_CARD = null; CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
      return out;
    });
    ok(noHeal.hp === 1, '💀 พันธสัญญาโลหิตทมิฬยังกัน 🔮 ไม่ให้ฟื้น');
    ok(noHeal.tank1 === noHeal.tank0, '💀 ถังไม่ถูกเผาทิ้งฟรีตอนฟื้นไม่ได้');

    ok(errs.length === 0, 'ไม่มี pageerror · ' + JSON.stringify(errs.slice(0, 2)));
    await ctx.close();
  }

  // ══ บล็อก 8 · เลย์เอาต์ไม่ขยับ ════════════════════════════════════════════
  {
    head('บล็อก 8 · การ์ดโจทย์ไม่โตขึ้น · ไม่ล้มแนวนอน');
    const BASE = { 320: 354.8, 360: 340.8, 390: 340.8, 430: 340.8 };
    for (const w of [320, 360, 390, 430]) {
      const { ctx, page, errs } = await boot(browser, w, w === 320 ? 568 : 844);
      await enter(page, 'se_l' + w);
      const r = await page.evaluate(() => {
        /* บังคับคำ/ตัวเลือกให้คงที่ก่อนวัดเสมอ + ล้างบรรทัดผลลัพธ์ที่ค้างอยู่ */
        G.items = { potion: 0, scroll: 1, freeze: 1, focus: 0, glass: 1, insurance: 0, mystery: 0 };
        addItem('focus', 1);
        renderItems(); renderStats();
        useItem('freeze'); useItem('glass'); useItem('scroll');
        startQuestionTimer();
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        const fb = document.getElementById('gFeedback');
        if (fb) { fb.textContent = ''; fb.className = 'g-feedback'; }
        const card = document.querySelector('.ac-battle');
        return { h: card ? card.getBoundingClientRect().height : 0,
                 over: document.body.scrollWidth > window.innerWidth,
                 badges: document.querySelectorAll('#baSeHud i').length,
                 hudR: (function () {
                   const a = document.getElementById('baArena'), e = document.getElementById('baSeHud');
                   if (!a || !e) return null;
                   const ab = a.getBoundingClientRect(), eb = e.getBoundingClientRect();
                   return { inside: eb.right <= ab.right + 0.6 && eb.top >= ab.top - 0.6 &&
                                    eb.bottom <= ab.bottom + 0.6 };
                 })(),
                 cbOverlap: (function () {
                   const a = document.getElementById('baCombo'), b = document.getElementById('baSeHud');
                   if (!a || !b) return false;
                   const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
                   if (!x.width || !y.width) return false;
                   return !(x.right <= y.left || y.right <= x.left);
                 })() };
      });
      ok(r.h <= BASE[w] + 0.6, 'จอ ' + w + ' · การ์ดโจทย์ ' + r.h.toFixed(1) + 'px (เพดาน ' + BASE[w] + ')');
      ok(!r.over, 'จอ ' + w + ' · ไม่ล้นแนวนอน');
      ok(r.badges === 3, 'จอ ' + w + ' · Badge ครบ 3 ใบ');
      ok(r.hudR && r.hudR.inside, 'จอ ' + w + ' · แถบ Badge อยู่ในกรอบสนามครบ');
      ok(r.cbOverlap === false, 'จอ ' + w + ' · ไม่ทับแถบบัฟคอมโบของ v6.9');
      ok(errs.length === 0, 'จอ ' + w + ' · ไม่มี pageerror');
      await ctx.close();
    }
  }

  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
