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

/* ── เมทริกซ์ 32 ช่องหลังชั้น v9.26 (guardian/priest) + v9.29 (S4 1200% · heal/cut) ──
   [atom, ค่าที่ Lv1, ค่าที่ Lv5] — ลอกจาก kSet() ของ v9.26 + atom() ของ v9.29 ไม่ได้อ่านจากเกม */
const WANT = {
  assassin:   [ [['win',3.5,3.5],['dmg',200,240]],
                [['ultg',100,100],['tchn',2,2]],
                [['time',4,4],['wdn',20,30]],
                [['dmg',800,900],['bhp',8,15]] ],
  monarch:    [ [['win',5,5],['dmg',280,340]],
                [['ultg',100,100],['tchn',3,4]],
                [['time',5,6],['wdn',35,45]],
                [['dmg',800,900],['bhp',20,30]] ],
  blade:      [ [['dmg',220,260]],
                [['atk',5,10],['atkc',4,7]],
                [['dmg',280,320],['score',50,100]],
                [['dmg',900,1000]] ],
  slayer:     [ [['dmg',260,320]],
                [['atk',10,18],['atkc',6,10]],
                [['dmg',340,400],['score',80,150]],
                [['dmg',900,1000],['bhp',25,40]] ],
  guardian:   [ [['dmg',180,220],['hpsc',20,40]],
                [['wdn',20,30],['barr',10,15],['mpr',10,10],['shr',5,5]],
                [['wdn',30,45],['heal',35,35],['tdm',1,1],['sup',1,1]],
                [['heal',35,50],['barr',40,60],['sbst',15,20]] ],
  guard:      [ [['dmg',220,280],['hpsc',35,60]],
                [['wdn',35,45],['barr',20,30],['mpr',12,15],['shr',6,8]],
                [['wdn',50,65],['heal',35,35],['tdm',1,1],['sup',1,1]],
                [['heal',60,80],['barr',70,100],['sbst',20,25]] ],
  priest:     [ [['dmg',200,230],['mwd',60,60],['mwt',3,3]],
                [['heal',8,15]],
                [['mist',0,0],['cut',3,3],['spg',3,5]],
                [['heal',55,70],['jdg',3,3]] ],
  soulmaster: [ [['dmg',260,300],['mwd',60,75],['mwt',3,3]],
                [['heal',15,25],['score',10,20]],
                [['mist',0,0],['cut',3,3],['acut',20,30],['spg',5,8]],
                [['heal',80,100],['barr',30,50],['jdg',3,4]] ]
};
/* ชื่อสกิลตำนานไทยของ v9.29 — C1/C2 ใช้ชุดเดียวกันต่อสาย (เขียนซ้ำไว้ฝั่งเทสต์โดยตั้งใจ) */
const LORE = {
  priest:   ['ทัณฑ์อักขระสูบวิญญาณ', 'เนตรทิพย์กลืนวิญญาณ', 'หัตถ์เทวะสลายมนตรา', 'มหาจุติเนตรพิพากษา'],
  guardian: ['โล่ทมิฬสะท้อนธรณี', 'กายาหินผาอเวจี', 'มหาปราการคุ้มเทวา', 'ระเบิดศิลาโลกันตร์ทลาย'],
  assassin: ['เงาสังหารตัดกาลเวลา', 'สัญชาตญาณเนตรมรณะ', 'มีดบินทลายเกราะเหล็ก', 'ระบำเงาประหารไร้เขตขัณฑ์'],
  slayer:   ['ดาบผ่ามิติไร้เงา', 'ปราณโทสะคลั่งเหวสมุทร', 'เพลงดาบปล้นวิญญาณ', 'ทัณฑ์อเวจีผ่าโลกันตร์']
};
const LORE_ROLES = { priest: ['priest','soulmaster'], guardian: ['guardian','guard'],
                     assassin: ['assassin','monarch'], slayer: ['blade','slayer'] };
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
    eq('Lv3 อยู่กึ่งกลาง (assassin S1 dmg)', mid[0], 220);
    eq('Lv3 อยู่กึ่งกลาง (slayer S4 dmg 900→1000%)', mid[1], 950);
    eq('Lv2 ไล่เชิงเส้น (guardian S4 heal)', mid[2], 38.75);
    /* ชื่อตำนานไทยของ v9.29 ครบทั้ง 8 role (C1/C2) + สารบัญ BA_PL_CLASSES */
    const names = await b.page.evaluate(lr => {
      const o = {};
      Object.keys(lr).forEach(k => {
        o[k] = { roles: lr[k].map(r => [0,1,2,3].map(i => baResolveSkillEffects(r, null, i, 1).name)),
                 cls: (BA_PL_CLASSES.filter(c => c.id === k)[0] || { slots: [] }).slots.map(s => s.n) };
      });
      o._audit = (baBattleAudit().kitV929 || {}).names;
      return o;
    }, LORE_ROLES);
    Object.keys(LORE).forEach(k => {
      LORE_ROLES[k].forEach((r, j) => eq('ชื่อตำนาน ' + r + ' (' + (j ? 'C2' : 'C1') + ')', names[k].roles[j], LORE[k]));
      eq('ชื่อตำนานในสารบัญ BA_PL_CLASSES · ' + k, names[k].cls, LORE[k]);
    });
    eq('kitV929.names ตรงสเปก', names._audit, LORE);
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
    eq('ชื่อช่องของ C2 เป็นชื่อตำนาน v9.29 (C1/C2 ชุดเดียวกัน)', awk.names, LORE.assassin);
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
      /* priest ยังไม่มีไฟล์ท่ายืนต้นฉบับ (dash/s1-s4 ฝังแล้ว) · soulmaster ยังไม่มี
         ไฟล์ท่าสกิล s1-s4 ต้นฉบับ (idle/dash ฝังแล้ว) — เก็บไว้แยกกันเพราะคนละ
         ช่องที่ยังว่างจริง (ดูข้อคิดเห็นบล็อกนี้ก่อนแก้) */
      const soulS1 = baGetHeroSprite('soulmaster', null, 's1');
      /* เสียบภาพปลอมให้สายนักบวช C1 (ยังว่างจริง) แล้วต้องอ่านออกทันที (hot-plug) */
      const px = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      ba.assetRegistry.priest.c1.anim.idle.u = px;
      const after = baGetHeroSprite('priest', 'c1', 'idle');
      G.classId = 'guardian'; recalcStats();
      const anim  = baBattleAudit().dispatch.art;
      ba.assetRegistry.priest.c1.anim.idle.u = '';
      return { empty: empty, soulS1: soulS1, after: after === px, art: anim,
               imgs: document.querySelectorAll('#baArena img[src=""]').length };
    });
    /* Step 3 · Sprite Embedding (v8.7) + สไปรต์ 4 สาย (v8.8) — assassin/monarch/
       blade/slayer/guardian/guard ฝังภาพครบแล้ว · priest ฝัง dash/s1-s4 แล้ว
       เหลือ idle ว่าง · soulmaster ฝัง idle/dash แล้ว เหลือ s1-s4 ว่าง —
       เคสนี้เคยยืนยัน "ว่างทุก role" ซึ่งเป็นสถานะก่อนฝัง — พลิกด้านโดยตั้งใจ
       (precedent: v7.4 · v7.8 · v7.9 · v8.1-v8.4 พลิกกันมาแล้วทุกชั้น) */
    ok('role ที่ฝังภาพแล้ว → คืน data URI จริง (6 role: assassin·monarch·blade·slayer·guardian·guard)',
       ['assassin', 'monarch', 'blade', 'slayer', 'guardian', 'guard']
         .every(k => /^data:image\//.test(r.empty[k] || '')), r.empty);
    ok('priest ยังไม่มีท่ายืนต้นฉบับ → idle ว่าง', r.empty.priest === '', r.empty.priest);
    ok('soulmaster มีท่ายืนแล้ว (ฝังไปก่อนหน้านี้) → idle ไม่ว่าง',
       /^data:image\//.test(r.empty.soulmaster || ''), r.empty.soulmaster);
    ok('soulmaster ยังไม่มีท่าสกิลต้นฉบับ → ช่อง s1 ว่าง', r.soulS1 === '', r.soulS1);
    ok('ไม่มี <img> ว่างค้างในสนาม (ไม่มีรูปแตก)', r.imgs === 0, r.imgs);
    ok('เสียบ data URI แล้ว baGetHeroSprite อ่านออกทันที', r.after === true);
    ok('สายที่ฝังภาพแล้ว → art เป็น true (ผู้พิทักษ์)', r.art === true, r.art);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 6 · หนึ่งแหล่งความจริง — เลขบนจอ = เลขที่ทำงานจริง');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds6');
    /* ช่อง 1 · ดาเมจซ้ำ ต้องเท่ากับอะตอม dmg ของเมทริกซ์เป๊ะ (ตอบไวทันกรอบ)
       ⚠️ ตั้งแต่ Patch v9.1 · ACTIVE SKILL CAST ช่อง 1 (index 0) ถูกปิดไว้เป็น
       ค่าเริ่มต้น (baPlS1 คืน 0) จนกว่าจะ "armed" ผ่านการกดใช้จริง (BA_V91_ARM[0])
       เคสนี้จึงต้อง armed เองก่อนอ่าน — ทั้งสองเคสด้านล่างพลิกจากที่เคยยืนยันว่า
       "ทำงานอัตโนมัติตลอดเวลา" (ของ v8.8) เป็น "ทำงานเฉพาะรอบที่ armed" (ของ v9.1)
       ตามกติกาเดิมของ repo ที่ยอมให้แพตช์ถัดไปพลิกเคสเมื่อเปลี่ยนพฤติกรรมจริง
       (precedent: v7.4/v7.8/v7.9/v8.1-v8.4/v8.8) */
    const s1 = await b.page.evaluate(() => {
      G.classId = 'assassin'; G.level = 1;
      G.skills.assassin[0] = 3;
      G.questionStart = Date.now();
      BA_V91_ARM[0] = true;
      /* v8.5 กิน baPlS1 เป็น hunterAtk × (1 + v/100) — ตัวเลขของช่อง 1 ในสเปกคือ
         "ดาเมจรวม" (ขอบล่างของนักรบสังหาร = 100% พอดี = หมัดปกติ) จึงต้องส่ง
         "ส่วนที่เกินหมัดปกติ" ไป ไม่ใช่ยอดรวมทั้งก้อน */
      const want = baResolveSkillEffects('assassin', 'c1', 0, 3).fx.dmg - 100;
      return { want: want, got: baPlS1(G) };
    });
    eq('baPlS1 = ดาเมจรวมของเมทริกซ์ − 100 (Lv3) เมื่อ armed แล้ว', s1.got, s1.want);

    /* ยังไม่ armed → ต้องคืน 0 เสมอ ต่อให้อยู่ในกรอบเวลาก็ตาม (ของใหม่ v9.1) */
    const notArmed = await b.page.evaluate(() => {
      BA_V91_ARM[0] = false;
      G.questionStart = Date.now();
      return baPlS1(G);
    });
    eq('ยังไม่ได้กดใช้ (ไม่ armed) → baPlS1 คืน 0', notArmed, 0);

    /* กรอบ win — ตอบช้ากว่ากรอบต้องไม่ได้ แม้ armed อยู่ก็ตาม */
    const win = await b.page.evaluate(() => {
      BA_V91_ARM[0] = true;
      G.questionStart = Date.now() - 9000;
      return baPlS1(G);
    });
    eq('armed แต่ตอบช้ากว่ากรอบ win → ไม่ได้ดาเมจซ้ำ', win, 0);
    await b.page.evaluate(() => { BA_V91_ARM[0] = false; });

    /* ช่อง 4 · ท่าไม้ตาย — สายโจมตีใช้ dmg เป็นตัวคูณ · สายประคองใช้ heal เป็น % */
    const ult = await b.page.evaluate(() => {
      G.classId = 'assassin'; G.level = 1; G.skills.assassin[3] = 5;
      const atk = baPlUltAmt(G);
      G.classId = 'priest';  G.skills.priest = G.skills.priest || [1,1,1,1];
      G.skills.priest[3] = 5;
      const sup = baPlUltAmt(G);
      return { atk: atk, sup: sup };
    });
    eq('ท่าไม้ตายสายโจมตี = dmg/100 (assassin Lv5 900% → 9)', ult.atk, 9);
    eq('ท่าไม้ตายสายประคอง = heal % (Lv5 = 70)', ult.sup, 70);

    /* ข้อความบนแผงโปรไฟล์ต้องมาจากเมทริกซ์ก้อนเดียวกัน */
    const txt = await b.page.evaluate(() => {
      G.classId = 'guardian'; G.level = 1;
      G.skills.guardian = G.skills.guardian || [1,1,1,1];
      G.skills.guardian[1] = 5;
      return baPlSlotText(G, 1, 5);
    });
    ok('ข้อความช่อง 2 ผู้พิทักษ์อ้างเลขจากเมทริกซ์ (wdn Lv5 = 30%)', /30%/.test(txt) && /15%/.test(txt), txt);
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
      /* v9.29 · VERIFIED FX — เมทริกซ์ทั้ง 32 ช่องต้องใช้เฉพาะอะตอมที่เดินสายแล้ว
         ป้าย "ยังไม่ทำงาน" จึงต้องไม่โผล่บนแผงโปรไฟล์ของสายใดเลย */
      const deadUse = [], txts = [];
      ['assassin','slayer','guardian','priest'].forEach(c => {
        G.classId = c; G.skills[c] = G.skills[c] || [1,1,1,1];
        [1, BA_PL_TIER_LV].forEach(lv => {
          G.level = lv;
          for (let i = 0; i < 4; i++) {
            const e = baResolveSkillEffects(baDsRoleOf(G), null, i, 5);
            if (e.dead && e.dead.length) deadUse.push(e.role + ':' + i + ':' + e.dead.join(','));
            txts.push(baPlSlotText(G, i, 5));
          }
        });
      });
      return { wired: a.wired.length, dead: a.dead.length, bad: bad, deadUse: deadUse,
               labeled: txts.filter(t => /ยังไม่ทำงาน/.test(t)) };
    }, NO_SUBSYS);
    ok('อะตอมที่ไม่มีระบบให้เกาะ ไม่ถูกนับเป็น wired', r.bad.length === 0, r.bad);
    ok('มีอะตอมที่เดินสายแล้วจริง', r.wired > 0, r.wired);
    ok('พจนานุกรมยังเก็บอะตอมที่ยังไม่ทำงานไว้ (ไม่ถูกลบ)', r.dead > 0, r.dead);
    eq('เมทริกซ์ v9.29 ไม่มีช่องไหนใช้อะตอมที่ยังไม่ทำงาน', r.deadUse, []);
    eq('ไม่มีข้อความช่องไหนติดป้าย "ยังไม่ทำงาน" (32 ช่อง)', r.labeled, []);
    ok('ไม่มี pageerror', b.errs.length === 0, b.errs);
    await b.ctx.close();
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  head('บล็อก 7.1 · v9.29 · S1/S3 ร่ายทันที · S2 พาสซีฟ · S4 1200%');
  {
    const b = await boot(browser);
    await enterGame(b.page, 'ds71');
    /* ร่ายผ่านการคลิกปุ่มจริงบนแถบสกิล — ไม่เรียก answer() เลย (ต้องลงผลทันที) */
    const cast = await b.page.evaluate(() => {
      function prep(c) {
        G.classId = c; G.level = 1; baPlEnsure(G); recalcStats(); baSyncCurrentClassSkills(true);
        recalcStats(); G.mp = maxMpOf(G); G.hp = Math.round(G.maxHp * 0.7); G.locked = false;
        for (let i = 0; i < 4; i++) { BA_V91_CD[i] = 0; BA_V91_ARM[i] = false; }
        G.monsterHp = G.monsterMaxHp = 2e6; G.questionStart = Date.now();
      }
      function click(i) {
        const n0 = (baBattleAudit().kitV929 || { n: {} }).n.inst | 0;
        const c0 = G.correct | 0, w0 = G.wrong | 0, h0 = G.monsterHp, mp0 = G.mp, hp0 = G.hp;
        const ch0 = (G.currentMonster.choices || []).length, cost = baV91Cost(i);
        const el = document.querySelector('#gSkills .g-skill[data-ds="' + i + '"]');
        if (el) el.click();
        const k = baBattleAudit().kitV929;
        return { el: !!el, inst: (k.n.inst | 0) - n0, dr: k.dr, drop: Math.round(h0 - G.monsterHp),
                 mp: Math.round(mp0 - G.mp), cost: cost, hp: Math.round(G.hp - hp0),
                 ans: (G.correct | 0) - c0 + (G.wrong | 0) - w0, cut: ch0 - (G.currentMonster.choices || []).length,
                 cd: BA_V91_CD[i] };
      }
      const o = {};
      prep('assassin'); o.aS1 = click(0); o.aS3 = click(2);
      prep('slayer');   o.sS1 = click(0); o.sS3 = click(2);
      prep('guardian'); o.gS3 = click(2);
      prep('priest');   o.pS3 = click(2);
      prep('guardian'); o.gS2 = click(1);
      return o;
    });
    [['aS1','assassin S1'],['aS3','assassin S3'],['sS1','slayer S1'],['sS3','slayer S3']].forEach(([k, n]) => {
      const c = cast[k];
      ok(n + ' · ร่ายทันที (นับ inst)', c.el && c.inst === 1, c);
      ok(n + ' · ลงดาเมจทันทีโดยไม่ต้องตอบ', c.drop > 0 && c.ans === 0, c);
      eq(n + ' · หัก MP เท่าราคาช่อง', c.mp, c.cost);
    });
    ok('guardian S3 · ลดดาเมจที่รับ (DR) + ฟื้น HP ทันที', cast.gS3.inst === 1 && cast.gS3.dr === 1 && cast.gS3.hp > 0 && cast.gS3.ans === 0, cast.gS3);
    ok('priest S3 · ตัดตัวเลือกผิดทันที', cast.pS3.inst === 1 && cast.pS3.cut > 0 && cast.pS3.ans === 0, cast.pS3);
    ok('guardian S2 (พาสซีฟ) · คลิกไม่ร่าย · ไม่หัก MP', cast.gS2.inst === 0 && cast.gS2.mp === 0 && cast.gS2.drop === 0, cast.gS2);

    /* S2 พาสซีฟเมื่อตอบถูก — guardian ฟื้น MP · priest HP เต็ม = Overheal Smite */
    const pas = await b.page.evaluate(() => {
      function prep(c, full) {
        G.classId = c; G.level = 1; baPlEnsure(G); recalcStats(); baSyncCurrentClassSkills(true);
        G.mp = 1; G.hp = full ? G.maxHp : Math.round(G.maxHp * 0.5); G.locked = false; G.shield = 0;
        G.monsterHp = G.monsterMaxHp = 2e6; G.questionStart = Date.now(); BA_PR_UNTIL = 0;
      }
      function right() {
        const n = Object.assign({}, baBattleAudit().kitV929.n), h0 = G.monsterHp, mp0 = G.mp;
        answer(G.currentMonster.answer, null);
        const m = baBattleAudit().kitV929.n;
        return { passive: m.passive - n.passive, smite: m.smite - n.smite, mp: G.mp - mp0, drop: Math.round(h0 - G.monsterHp) };
      }
      const o = {};
      prep('guardian', false); o.g = right();
      return o;
    });
    ok('guardian S2 · ตอบถูกแล้วพาสซีฟ (+MP) ทำงาน', pas.g.passive === 1 && pas.g.mp > 0, pas.g);
    await b.page.waitForTimeout(1300);
    await clearOverlays(b.page);
    const sm = await b.page.evaluate(() => {
      G.locked = false;
      G.classId = 'priest'; G.level = 1; baPlEnsure(G); recalcStats(); baSyncCurrentClassSkills(true);
      G.hp = G.maxHp; G.shield = 0; G.monsterHp = G.monsterMaxHp = 2e6; G.questionStart = Date.now(); BA_PR_UNTIL = 0;
      const n = baBattleAudit().kitV929.n.smite, h0 = G.monsterHp;
      answer(G.currentMonster.answer, null);
      return { smite: baBattleAudit().kitV929.n.smite - n, drop: Math.round(h0 - G.monsterHp), atk: hunterAtk() };
    });
    ok('priest S2 · HP เต็มแล้วตอบถูก = Overheal Smite', sm.smite === 1 && sm.drop > 0, sm);

    /* S4 · 1200% — ตัวคูณท่าไม้ตายของสายโจมตี = 12 ทุกระดับ */
    const u4 = await b.page.evaluate(() => {
      const o = {};
      ['assassin', 'slayer'].forEach(c => {
        G.classId = c; [1, BA_PL_TIER_LV].forEach(lv => {
          G.level = lv; G.skills[c] = G.skills[c] || [1,1,1,1];
          [1, 5].forEach(sl => { G.skills[c][3] = sl; o[c + lv + '_' + sl] = baPlUltAmt(G); });
        });
      });
      return o;
    });
    eq('S4 สายโจมตี v9.30 · assassin 800→900% · slayer 900→1000% ทุกร่าง', Object.keys(u4).every(k => Math.abs(u4[k] - ((k.indexOf('assassin') === 0 ? 8 : 9) + (/_5$/.test(k) ? 1 : 0))) < 1e-9), true);
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
