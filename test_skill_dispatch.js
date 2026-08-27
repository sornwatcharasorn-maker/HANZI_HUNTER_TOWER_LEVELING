/* ชุดเทสต์ Patch v8.8 — UNIVERSAL HOT-PLUG ASSET & DYNAMIC SKILL DISPATCHER
   รันด้วย: NODE_PATH=/opt/node22/lib/node_modules node test_skill_dispatch.js

   ข้อควรระวังที่ CLAUDE.md เขียนไว้ และชุดนี้เคารพครบ
     · stub fetch + EventSource ก่อนโหลดหน้าเสมอ และ fetch ต้อง "ตอบกลับ" ไม่ใช่ค้าง
       ไม่งั้น v5.8 รอตลอดกาลแล้วล็อกอินไม่มีวันสำเร็จ (บทเรียนของชุด v8.5)
     · เข้าเกมด้วยเส้นทางจริงเสมอ (ป๊อปอัปกติกาของ v5.6 → เกท → ปิดหน้าต่างจั่วของ v4.7
       → ผ่านประตูกรองชั้น 20 ของ v8.2)
     · ปิดระบบบุกรุกของ v6.6 ทุกครั้งที่ย้ายชั้น (BA_INC_F/BA_INC_AT)
     · **ตารางของสเปกเขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ** — ถ้าอ่านเมทริกซ์ในเกมมาเทียบ
       กับตัวเอง เทสต์จะผ่านทุกครั้งต่อให้เกมเปลี่ยนตัวเลขไปแล้ว (บทเรียนของชุด v7.6)
     · ห้ามแตะ Math.random (กับดักข้อ 32) — มีเคสยืนยันว่าเรียกไป 0 ครั้ง            */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'skill_dispatch_log.txt');

let PASS = 0, FAIL = 0;
function say(s) { fs.appendFileSync(LOG, s + '\n'); console.log(s); }
function head(s) { say('\n═══ ' + s + ' ═══'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; say('  ✅ ' + name); }
  else { FAIL++; say('  ❌ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), { got: got, want: want }); }

/* ── เมทริกซ์ของสเปก 32 ช่อง เขียนซ้ำไว้ฝั่งเทสต์ (จำเป็น ดูหัวไฟล์) ────────
   [atom, ค่าที่ Lv1, ค่าที่ Lv5] — ตัวเลขลอกจากสเปกตรง ๆ ไม่ได้อ่านจากเกม */
const WANT = {
  assassin:   [ [['win',3.5,3.5],['dmg',120,140]],
                [['ultg',10,20],['tchn',1.5,1.5]],
                [['dot',10,20],['eatk',10,20]],
                [['dmg',160,230],['nxt',50,100]] ],
  monarch:    [ [['win',2.5,2.5],['hit2',0,0],['dmg',120,150]],
                [['crit',10,20],['cdm',150,170]],
                [['sc2',10,20],['dot',10,20]],
                [['dmg',180,250],['bhp',15,30]] ],
  blade:      [ [['dmg',100,120],['shred',20,40]],
                [['atkc',5,10]],
                [['dmg',115,140],['edef',5,12]],
                [['dmg',150,215],['stun',2,3.5]] ],
  slayer:     [ [['dmg',110,130],['armor',2,4]],
                [['pierce',15,35],['team',5,15]],
                [['atk',15,35],['tcrit',8,20]],
                [['dmg',170,230],['brk',40,75],['stunt',1,2]] ],
  guardian:   [ [['dmg',70,90],['eatk',15,30]],
                [['wdn',20,35]],
                [['abs',50,100]],
                [['heal',15,30],['refl',20,40]] ],
  guard:      [ [['dmg',80,100],['time',1,2]],
                [['barr',8,20],['bult',15,30]],
                [['blk',100,100],['heal',0,10],['tcov',60,100]],
                [['imm',4,8],['refl',20,40]] ],
  priest:     [ [['dmg',80,100],['score',10,20]],
                [['pin',15,30]],
                [['mist',0,0],['cut',1,1]],
                [['heal',20,35]] ],
  soulmaster: [ [['dmg',90,110],['time',1,2]],
                [['acut',20,40],['tcd',10,20]],
                [['mist',0,0],['cut',1,2],['pins',3,6],['heal',0,10]],
                [['heal',15,35],['rev',0,0]] ]
};
const ROLES = Object.keys(WANT);
/* อะตอมที่ไม่มีระบบให้เกาะในเกมนี้ (ไม่มีปาร์ตี้/เรด) — ต้องติดธง w:0 เสมอ */
const NO_SUBSYS = ['team', 'tcrit', 'tcov', 'tcd', 'rev'];

async function boot(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w || 390, height: h || 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String((e && e.message) || e)));
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(null), text: () => Promise.resolve('null')
    });
    window.EventSource = function () { this.close = function () {}; this.addEventListener = function () {}; };
  });
  await page.goto('file://' + FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  return { ctx: ctx, page: page, errs: errs };
}
async function ackRules(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(280);
  await page.evaluate(() => { try { rgScrollCheck(); } catch (e) {} if (typeof rgAck === 'function') rgAck(); });
  await page.waitForTimeout(700);
}
async function clearOverlays(page) {
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const c = document.querySelector('#cdDraft.active .cd-card');
      if (c) { c.click(); return 'card'; }
      const gt = document.getElementById('baWvGate');
      if (gt && gt.classList.contains('active') && typeof baWvGateGo === 'function') { baWvGateGo(); return 'apex'; }
      if (typeof snGateConfirm === 'function' && document.querySelector('.sn-gate.active')) { snGateConfirm(); return 'gate'; }
      if (typeof G !== 'undefined' && G && G.warpOpen) { warpGo(); return 'warp'; }
      return '';
    });
    if (!busy) break;
    await page.waitForTimeout(760);
  }
  await page.waitForTimeout(120);
}
async function enterGame(page, id) {
  await ackRules(page);
  await page.evaluate(u => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1111';
    document.getElementById('reg-pw2').value = '1111';
    handleSubmit();
  }, id);
  await page.waitForTimeout(1400);
  await clearOverlays(page);
  await page.evaluate(() => {
    G.maxFloor = FLOOR_MAX; recalcStats();
    G.floor = 2; G.floorProgress = 0;
    BA_INC_F = 2; BA_INC_AT = -1; BA_INC_M = null;
    nextMonster();
    G.locked = false;
  });
  await clearOverlays(page);
  await page.evaluate(() => { G.locked = false; });
}

(async () => {
  fs.writeFileSync(LOG, '=== test_skill_dispatch (v8.8) ' + new Date().toISOString() + ' ===\n');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 1 · เมทริกซ์ตรงสเปกครบ 32 ช่อง (Lv1 = lo · Lv5 = hi)');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds1');
    const got = await b.page.evaluate(roles => {
      const o = {};
      roles.forEach(r => {
        o[r] = [0, 1, 2, 3].map(i => {
          const lo = baResolveSkillEffects(r, null, i, 1);
          const hi = baResolveSkillEffects(r, null, i, 5);
          return lo.list.map(a => [a.id, lo.fx[a.id], hi.fx[a.id]]);
        });
      });
      return o;
    }, ROLES);
    ROLES.forEach(r => {
      for (let i = 0; i < 4; i++) eq('เมทริกซ์ ' + r + ' ช่อง ' + (i + 1), got[r][i], WANT[r][i]);
    });
    /* ไล่เชิงเส้น — Lv3 ต้องอยู่กึ่งกลางของ lo..hi พอดี */
    const mid = await b.page.evaluate(() => [
      baResolveSkillEffects('assassin', 'c1', 0, 3).fx.dmg,
      baResolveSkillEffects('slayer', 'c2', 3, 3).fx.dmg,
      baResolveSkillEffects('guardian', 'c1', 3, 2).fx.heal
    ]);
    eq('Lv3 อยู่กึ่งกลาง (assassin S1 dmg)', mid[0], 130);
    eq('Lv3 อยู่กึ่งกลาง (slayer S4 dmg)', mid[1], 200);
    eq('Lv2 ไล่เชิงเส้น (guardian S4 heal)', mid[2], 18.75);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 2 · role key ครบ 4 สาย × 2 ร่าง + คลาส CSS .ba-{role}-{state}');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds2');
    const r = await b.page.evaluate(() => {
      const a = baBattleAudit().dispatch;
      const css = document.getElementById('baDsStyle');
      return { roles: a.roles, states: a.states, styled: a.styled, registry: a.registry,
               css: css ? css.textContent : '' };
    });
    eq('role key ของ assassin ตรงกับที่ v8.7 ใช้อยู่', r.roles.assassin, ['assassin', 'monarch']);
    eq('role key ของ slayer', r.roles.slayer, ['blade', 'slayer']);
    eq('role key ของ guardian', r.roles.guardian, ['guardian', 'guard']);
    eq('role key ของ priest', r.roles.priest, ['priest', 'soulmaster']);
    ok('ทะเบียนสไปรต์ครบ 4 สาย × 2 ร่าง', r.registry === true, r.registry);
    ok('แทรก CSS ของชั้นนี้แล้ว', r.styled === true);
    let miss = [];
    ROLES.forEach(role => r.states.forEach(s => {
      if (r.css.indexOf('.ba-' + role + '-' + s) < 0) miss.push(role + '-' + s);
    }));
    ok('มีคลาส .ba-{role}-{state} ครบทุกช่อง (' + (ROLES.length * r.states.length) + ' คลาส)',
       miss.length === 0, miss);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 3 · Skill Bar Override — ล้างสกิลชุดเดิม วาดของสายอาชีพ');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds3');
    const r = await b.page.evaluate(() => {
      const a = baBattleAudit().dispatch;
      const box = document.getElementById('gSkills');
      return { bar: a.bar, legacy: a.legacy,
               names: Array.from(box.querySelectorAll('[data-ds] .g-skill-name')).map(x => x.textContent),
               tags: Array.from(box.querySelectorAll('[data-ds] .g-skill-mp')).map(x => x.textContent) };
    });
    eq('แถบสกิลมี 4 ช่องของสายอาชีพ', r.bar, 4);
    eq('สกิลชุดเดิมของ v4.0 ถูกล้างออกหมด', r.legacy, 0);
    ok('ชื่อช่องครบ 4 ชื่อและไม่ว่าง', r.names.length === 4 && r.names.every(n => n && n.length), r.names);
    ok('ช่องสุดท้ายเป็นท่าไม้ตาย (โชว์เกจ ไม่ใช่ CD)', /\d+ \/ \d+|พร้อม/.test(r.tags[3]), r.tags);

    /* renderSkills ของ v4.0 ถูกเรียกซ้ำ → ต้องยังเหลือ 4 ช่องของสาย ไม่กลับไปเป็นชุดเดิม */
    const again = await b.page.evaluate(() => {
      renderSkills(); renderSkills();
      const a = baBattleAudit().dispatch;
      return { bar: a.bar, legacy: a.legacy };
    });
    eq('เรียก renderSkills ซ้ำ → ยังเป็นของสายอาชีพ', again, { bar: 4, legacy: 0 });
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 4 · เปลี่ยนสาย/ตื่นพลัง แล้วแถบกับเมทริกซ์ตามทันที');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds4');
    const sw = await b.page.evaluate(() => {
      const out = {};
      ['assassin', 'slayer', 'guardian', 'priest'].forEach(cid => {
        G.classId = cid;
        baSyncCurrentClassSkills(true);
        const a = baBattleAudit().dispatch;
        out[cid] = { role: a.role, bar: a.bar,
                     names: Array.from(document.querySelectorAll('#gSkills [data-ds] .g-skill-name'))
                              .map(x => x.textContent) };
      });
      return out;
    });
    eq('สลับไป assassin → role assassin (C1)', sw.assassin.role, 'assassin');
    eq('สลับไป slayer → role blade (C1)', sw.slayer.role, 'blade');
    eq('สลับไป guardian → role guardian (C1)', sw.guardian.role, 'guardian');
    eq('สลับไป priest → role priest (C1)', sw.priest.role, 'priest');
    ok('ชื่อช่องเปลี่ยนตามสายจริง (ไม่ค้างของสายก่อน)',
       JSON.stringify(sw.assassin.names) !== JSON.stringify(sw.guardian.names),
       [sw.assassin.names, sw.guardian.names]);

    /* ตื่นพลัง C2 ที่ Lv50 — role ต้องข้ามไปร่างที่สอง */
    const awk = await b.page.evaluate(() => {
      G.classId = 'assassin'; G.level = 1;  baSyncCurrentClassSkills(true);
      const c1 = baBattleAudit().dispatch.role;
      G.level = BA_PL_TIER_LV;              baSyncCurrentClassSkills(true);
      const c2 = baBattleAudit().dispatch;
      return { c1: c1, c2: c2.role, tier: c2.tier,
               names: c2.slots.map(s => s.name) };
    });
    eq('Lv 1 → ร่าง C1 (assassin)', awk.c1, 'assassin');
    eq('Lv 50 → ร่าง C2 (monarch)', awk.c2, 'monarch');
    eq('tier รายงานเป็น c2', awk.tier, 'c2');
    ok('ชื่อช่องของ C2 เป็นชุดของตัวเอง', awk.names[0] === 'โซนิคฟลูรี', awk.names);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 5 · Hot-Plug Asset — ยังไม่ฝังภาพต้องตกกลับอย่างนุ่มนวล');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds5');
    const r = await b.page.evaluate(() => {
      const empty = {};
      ['assassin', 'monarch', 'blade', 'slayer', 'guardian', 'guard', 'priest', 'soulmaster']
        .forEach(role => { empty[role] = baGetHeroSprite(role, null, 'idle'); });
      /* เสียบภาพปลอมให้สายผู้พิทักษ์ C1 แล้วต้องอ่านออกทันที (hot-plug) */
      const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      ba.assetRegistry.guardian.c1.anim.idle.u = px;
      const after = baGetHeroSprite('guardian', 'c1', 'idle');
      const anim  = baBattleAudit().dispatch.art;
      ba.assetRegistry.guardian.c1.anim.idle.u = '';
      return { empty: empty, after: after === px, art: anim,
               imgs: document.querySelectorAll('#baArena img[src=""]').length };
    });
    /* Step 3 · Sprite Embedding — assassin (C1) กับ monarch (C2) ฝังภาพครบแล้ว
       ที่เหลืออีก 6 role ยังว่างอยู่ตามเดิม · เคสนี้เคยยืนยัน "ว่างทุก role"
       ซึ่งเป็นสถานะก่อนฝัง — พลิกด้านโดยตั้งใจ
       (precedent: v7.4 · v7.8 · v7.9 · v8.1-v8.4 พลิกกันมาแล้วทุกชั้น) */
    ok('role ที่ฝังภาพแล้ว → คืน data URI จริง (assassin · monarch)',
       ['assassin', 'monarch'].every(k => /^data:image\//.test(r.empty[k] || '')), r.empty);
    ok('role ที่ยังไม่มีภาพ → คืนค่าว่าง (ไม่ใช่ undefined)',
       ['blade', 'slayer', 'guardian', 'guard', 'priest', 'soulmaster']
         .every(k => r.empty[k] === ''), r.empty);
    ok('ไม่มี <img> ว่างค้างในสนาม (ไม่มีรูปแตก)', r.imgs === 0, r.imgs);
    ok('เสียบ data URI แล้ว baGetHeroSprite อ่านออกทันที', r.after === true);
    ok('สายที่ฝังภาพแล้ว → art เป็น true', r.art === true, r.art);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 6 · หนึ่งแหล่งความจริง — เลขบนจอ = เลขที่ทำงานจริง');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds6');
    /* ช่อง 1 · ดาเมจซ้ำ ต้องเท่ากับอะตอม dmg ของเมทริกซ์เป๊ะ (ตอบไวทันกรอบ) */
    const s1 = await b.page.evaluate(() => {
      G.classId = 'assassin'; G.level = 1;
      G.skills.assassin[0] = 3;
      G.questionStart = Date.now();
      /* v8.5 กิน baPlS1 เป็น hunterAtk × (1 + v/100) — ตัวเลขของช่อง 1 ในสเปกคือ
         "ดาเมจรวม" (ขอบล่างของนักรบสังหาร = 100% พอดี = หมัดปกติ) จึงต้องส่ง
         "ส่วนที่เกินหมัดปกติ" ไป ไม่ใช่ยอดรวมทั้งก้อน */
      const want = baResolveSkillEffects('assassin', 'c1', 0, 3).fx.dmg - 100;
      return { want: want, got: baPlS1(G) };
    });
    eq('baPlS1 = ดาเมจรวมของเมทริกซ์ − 100 (Lv3)', s1.got, s1.want);

    /* กรอบ win — ตอบช้ากว่ากรอบต้องไม่ได้ */
    const win = await b.page.evaluate(() => {
      G.questionStart = Date.now() - 9000;
      return baPlS1(G);
    });
    eq('ตอบช้ากว่ากรอบ win → ไม่ได้ดาเมจซ้ำ', win, 0);

    /* ช่อง 4 · ท่าไม้ตาย — สายโจมตีใช้ dmg เป็นตัวคูณ · สายประคองใช้ heal เป็น % */
    const ult = await b.page.evaluate(() => {
      G.classId = 'assassin'; G.level = 1; G.skills.assassin[3] = 5;
      const atk = baPlUltAmt(G);
      G.classId = 'priest';  G.skills.priest = G.skills.priest || [1,1,1,1];
      G.skills.priest[3] = 5;
      const sup = baPlUltAmt(G);
      return { atk: atk, sup: sup };
    });
    eq('ท่าไม้ตายสายโจมตี = dmg/100 (230% → 2.3)', ult.atk, 2.3);
    eq('ท่าไม้ตายสายประคอง = heal % (35)', ult.sup, 35);

    /* ข้อความบนแผงโปรไฟล์ต้องมาจากเมทริกซ์ก้อนเดียวกัน */
    const txt = await b.page.evaluate(() => {
      G.classId = 'guardian'; G.level = 1;
      G.skills.guardian = G.skills.guardian || [1,1,1,1];
      G.skills.guardian[1] = 5;
      return baPlSlotText(G, 1, 5);
    });
    ok('ข้อความช่อง 2 ผู้พิทักษ์อ้างเลขจากเมทริกซ์ (35%)', /35/.test(txt), txt);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 7 · อะตอมที่ยังไม่ได้เดินสายต้องติดป้ายบอกตรง ๆ');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds7');
    const r = await b.page.evaluate(no => {
      const a = baBattleAudit().dispatch.atoms;
      const bad = no.filter(k => a.wired.indexOf(k) >= 0);
      /* ช่อง 2 ของนักรบเหวลึกมีอะตอม team ซึ่งไม่มีระบบให้เกาะ */
      G.classId = 'slayer'; G.level = BA_PL_TIER_LV;
      G.skills.slayer = G.skills.slayer || [1,1,1,1];
      const txt = baPlSlotText(G, 1, 5);
      return { wired: a.wired.length, dead: a.dead.length, bad: bad, txt: txt };
    }, NO_SUBSYS);
    ok('อะตอมที่ไม่มีระบบให้เกาะ ไม่ถูกนับเป็น wired', r.bad.length === 0, r.bad);
    ok('มีอะตอมที่เดินสายแล้วจริง', r.wired > 0, r.wired);
    ok('มีอะตอมที่ประกาศไว้แต่ยังไม่ทำงาน', r.dead > 0, r.dead);
    ok('ข้อความติดป้าย "ยังไม่ทำงาน" ให้อะตอมที่ยังไม่ได้เดินสาย',
       /ยังไม่ทำงาน/.test(r.txt), r.txt);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 8 · ห้ามแตะ Math.random (กับดักข้อ 32)');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds8');
    const n = await b.page.evaluate(() => {
      let hits = 0;
      const real = Math.random;
      Math.random = function () { hits++; return real.apply(this, arguments); };
      baSyncCurrentClassSkills(true);
      for (let i = 0; i < 4; i++) baResolveSkillEffects('soulmaster', 'c2', i, 3);
      baGetHeroSprite('guardian', 'c1', 'idle');
      baDsText('monarch', 'c2', 0, 4);
      const h = hits;
      Math.random = real;
      return h;
    });
    eq('วาดแถบ + คำนวณเมทริกซ์ ไม่เรียก Math.random สักครั้ง', n, 0);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 9 · CLS = 0 — ความสูงการ์ดโจทย์ต้องไม่ขยับ');
  {
    for (const w of [320, 360, 390, 430]) {
      const b = await boot(browser, w, 844);
      await enterGame(b.page, 'ds9_' + w);
      const h = await b.page.evaluate(() => {
        /* บังคับคำ/ตัวเลือกให้คงที่ + ล้าง #gFeedback ก่อนวัดเสมอ
           (บทเรียนเดิมของชุด v7.2/v7.4/v7.5/v7.8/v7.9) */
        document.getElementById('gWord').textContent = '北京语言大学';
        document.getElementById('gPinyin').textContent = 'Běijīng yǔyán dàxué';
        const fb = document.getElementById('gFeedback'); if (fb) fb.textContent = '';
        renderChoices();
        const card = document.querySelector('.ac-battle') ||
                     document.getElementById('gWord').closest('.g-card');
        return Math.round(card.getBoundingClientRect().height * 10) / 10;
      });
      const want = (w <= 320) ? 354.8 : 340.8;
      eq('การ์ดโจทย์สูงเท่าเดิมที่จอ ' + w, h, want);
      ok('ไม่ล้นแนวนอนที่จอ ' + w,
         await b.page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
      ok('ไม่มี pageerror ที่จอ ' + w, b.errs.length === 0, b.errs);
      await b.ctx.close();
    }
  }

  await browser.close();
  say('\n══════════════════════════════════');
  say('  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  say('══════════════════════════════════');
  process.exit(FAIL ? 1 : 0);
})();
