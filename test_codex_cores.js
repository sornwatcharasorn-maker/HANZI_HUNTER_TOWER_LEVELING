/* ตรวจ Patch v7.9 · CODEX 4-STAT OVERHAUL & 7 SYSTEM CORE ENGINE
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node test_codex_cores.js [ไฟล์.html]
 *
 * กติกาของชุดนี้ (เหมือนชุดอื่นของ repo)
 *   · ต้อง stub fetch + EventSource ก่อนโหลดหน้าเสมอ — v5.4 ฝัง URL ฐานข้อมูลจริง
 *     ไว้ในซอร์สและเปิดสวิตช์ให้เองทุกครั้งที่เปิดหน้า ไม่ stub = ยิงเข้าห้องเรียนจริง
 *   · เข้าเกมด้วยเส้นทางจริงเสมอ — ผ่านป๊อปอัปกติกาของ v5.6 แล้วปิดหน้าต่างจั่วการ์ด
 *     ของ v4.7 ให้จบ ไม่งั้น canAct() เป็นเท็จแล้วทุกเคสจะตกด้วยเหตุผลผิด
 *   · อ่าน hunterAtk() / G.maxHp สดทุกเคส ห้ามแคชไว้ต้นไฟล์ (กับดักข้อ 20)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const LOG = path.join(__dirname, 'test_codex_cores.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let pass = 0, fail = 0;
function say(s) { console.log(s); try { fs.appendFileSync(LOG, s + '\n'); } catch (e) {} }
function ok(c, m) { if (c) { pass++; say('  ✅ ' + m); } else { fail++; say('  ❌ ' + m); } }
function head(s) { say('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 58 - s.length))); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.addInitScript(() => {
    window.fetch = () => Promise.resolve({ ok: true, status: 200,
      json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
    window.EventSource = function () { this.close = function () {}; };
  });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  /* ป๊อปอัปกติกาของ v5.6 — ทำเหมือนที่นักเรียนทำจริง ไม่ใช่ประตูหลัง */
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(150);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await page.waitForTimeout(700);

  const USER = 'c7' + Math.floor(Math.random() * 999999);
  await page.evaluate((u) => {
    switchTab('register');
    document.getElementById('reg-id').value = u;
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  }, USER);
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);

  /* ปลดล็อกแรงค์ให้ครบก่อนทุกเคส — ไม่งั้น abOpenCore() โดน showLock() ปัดตก */
  await page.evaluate(() => {
    G.maxFloor = FLOOR_MAX;
    recalcStats();
    G.ab.shards = 9999;
    renderStats();
  });

  const ev = fn => page.evaluate(fn);
  const evA = (fn, a) => page.evaluate(fn, a);

  // ══ บล็อก 1 · แกนกลางระบบมีครบ 7 เส้น ═══════════════════════════════
  head('บล็อก 1 · สารบัญแกนกลางระบบ 7 เส้น');
  {
    const a = await ev(() => baBattleAudit().core7);
    ok(a.n === 7, 'แกนกลางระบบมีครบ 7 เส้น — ได้ ' + a.n);
    ok(JSON.stringify(a.keys) === JSON.stringify(['mp', 'time', 'gold', 'hp', 'atk', 'shield', 'crit']),
      'ลำดับคีย์ถูกต้อง (สามเส้นเดิมของ v4.6 อยู่หน้าเสมอ) — ' + a.keys.join(','));
    ok(a.max === 6, 'ขั้นสูงสุดยังเป็น 6 เท่าเดิม');
    ok(a.caps.hp === 400, 'เพดานแกนชีวิต +400 — ได้ +' + a.caps.hp);
    ok(a.caps.atk === 40, 'เพดานแกนพิฆาต +40% — ได้ +' + a.caps.atk);
    ok(a.caps.shield === 24, 'เพดานแกนเกราะ −24% — ได้ −' + a.caps.shield);
    ok(a.caps.crit === 20, 'เพดานแกนสังหาร +20% — ได้ +' + a.caps.crit);

    const t = await ev(() => AB_CORES.map(c => [c.key, typeof c.icon, typeof c.name, typeof c.desc,
      typeof c.eff, typeof c.cap, c.eff(AB_CORE_MAX)]));
    ok(t.every(r => r[1] === 'string' && r[2] === 'string' && r[3] === 'string' &&
                    r[4] === 'function' && r[5] === 'string' && typeof r[6] === 'string'),
      'ทุกเส้นมีฟิลด์ครบตามที่ abRenderCore()/AB_CORE_UP ของ v4.6 ต้องใช้');
    const byKey = await ev(() => AB_CORES.every(c => AB_CORE_BY_KEY[c.key] === c));
    ok(byKey, 'AB_CORE_BY_KEY ชี้ตรงกับ AB_CORES ทุกเส้น (abEnsure จึงไม่กวาดคีย์ใหม่ทิ้ง)');
  }

  // ══ บล็อก 2 · แผงแกนกลางระบบวาดครบ 7 แทร็ก + กล่องผนึก 5 บาน ═════════
  head('บล็อก 2 · แผงแกนกลางระบบ + กล่องผนึก');
  {
    await ev(() => abOpenCore());
    await page.waitForTimeout(200);
    const r = await ev(() => {
      const box = document.getElementById('abCore');
      const inner = box.querySelector('.g-modal-inner');
      const cs = getComputedStyle(inner);
      return {
        active: box.classList.contains('active'),
        tracks: box.querySelectorAll('.ab-track').length,
        buys: box.querySelectorAll('.ab-buy').length,
        seals: box.querySelectorAll('.ab-seal-pill').length,
        sealHead: (box.querySelector('.ab-seal-h') || {}).textContent || '',
        overflow: cs.overflowY, maxH: cs.maxHeight,
        scrollable: inner.scrollHeight > inner.clientHeight
      };
    });
    ok(r.active, 'แผงเปิดจริง');
    ok(r.tracks === 7, 'วาดครบ 7 แทร็ก — ได้ ' + r.tracks);
    ok(r.buys === 7, 'มีปุ่มอัปครบ 7 ใบ — ได้ ' + r.buys);
    ok(r.seals === 5, 'กล่องผนึกมีครบ 5 บาน — ได้ ' + r.seals);
    ok(/0\/5/.test(r.sealHead), 'หัวกล่องผนึกเขียน N/5 ตามจำนวนประตูจริง — "' + r.sealHead.trim() + '"');
    ok(r.overflow === 'auto', 'แผงเลื่อนแนวตั้งได้ (overflow-y:auto ของ v4.0)');
    ok(r.scrollable, 'เนื้อหา 7 เส้นยาวเกินกรอบจริง → ต้องเลื่อนดู');

    /* พิสูจน์ว่า "มองเห็น" ไม่ใช่แค่ .active (กับดักข้อ 25) */
    const seen = await ev(() => {
      const inner = document.querySelector('#abCore .g-modal-inner');
      const b = inner.getBoundingClientRect();
      let hit = 0, n = 0;
      for (let x = 0.2; x <= 0.8; x += 0.3) for (let y = 0.1; y <= 0.6; y += 0.25) {
        const el = document.elementFromPoint(b.left + b.width * x, b.top + b.height * y);
        n++; if (el && el.closest('#abCore')) hit++;
      }
      return { hit, n };
    });
    ok(seen.hit === seen.n, 'ทุกจุดที่สุ่มวัดโดนลูกของแผงจริง (' + seen.hit + '/' + seen.n + ')');
    await ev(() => abCloseCore());
    await page.waitForTimeout(150);
  }

  // ══ บล็อก 3 · ซื้อขั้นแกนใหม่แล้วมีผลจริง ═══════════════════════════
  head('บล็อก 3 · ซื้อขั้นแกนใหม่');
  {
    const before = await ev(() => ({ shards: G.ab.shards, lv: G.ab.core.hp || 0, maxHp: G.maxHp }));
    await ev(() => abBuyCore('hp'));
    await page.waitForTimeout(120);
    const after = await ev(() => ({ shards: G.ab.shards, lv: G.ab.core.hp, maxHp: G.maxHp,
                                    eff: baBattleAudit().core7.eff.hp }));
    ok(after.lv === before.lv + 1, 'ขั้นแกนชีวิตเดินหน้าไป 1 ขั้น');
    ok(before.shards - after.shards === 8, 'หัก 💎 ตามตาราง AB_CORE_COST ขั้นแรก (8) — หักไป ' +
      (before.shards - after.shards));
    ok(after.eff === 70, 'ขั้น 1 ให้ HP +70 ตามตาราง — ได้ +' + after.eff);
    ok(after.maxHp === before.maxHp + 70, 'หลอดเลือดยืดจริงทันทีโดยไม่ต้องออกจากเกม (' +
      before.maxHp + ' → ' + after.maxHp + ')');

    /* ไล่ให้เต็มขั้นแล้วต้องตันที่เพดานเป๊ะ */
    await ev(() => { for (let i = 0; i < 8; i++) abBuyCore('hp'); });
    const full = await ev(() => ({ lv: G.ab.core.hp, eff: baBattleAudit().core7.eff.hp, maxHp: G.maxHp }));
    ok(full.lv === 6, 'อัปต่อไม่เกินขั้น 6');
    ok(full.eff === 400, 'เต็มขั้นได้ HP +400 พอดี — ได้ +' + full.eff);
    ok(full.maxHp === before.maxHp + 400, 'หลอดเลือดยืดครบ +400');
  }

  // ══ บล็อก 4 · แกนพิฆาต — มีผลเฉพาะตอนตัดสินข้อ ═══════════════════════
  head('บล็อก 4 · แกนพิฆาต (ATK) ต้องไม่ไปดัน HP อสูรตาม');
  {
    await ev(() => { G.ab.core.atk = 0; renderStats(); });
    const base = await ev(() => hunterAtk());
    await ev(() => { G.ab.core.atk = 6; renderStats(); });
    const idle = await ev(() => hunterAtk());
    ok(idle === base, 'นอกจังหวะตัดสินข้อ ดาเมจยังเท่าเดิม (' + base + ') → HP อสูรไม่พองตาม');

    /* v8.8 · ช่อง 1 ของสายอาชีพเป็นตัวคูณของ hunterAtk ระหว่าง BA_LIVE เหมือนกัน
       และมีเงื่อนไข "ตอบไวภายในหน้าต่างของสาย" — ปิดหน้าต่างก่อนวัด เพื่อให้เหลือ
       ผลของแกนพิฆาตล้วน ๆ ตามที่บล็อกนี้ตั้งใจวัด */
    await ev(() => { G.questionStart = 0; });
    const live = await ev(() => { BA_LIVE = true; const v = hunterAtk(); BA_LIVE = false; return v; });
    ok(live === Math.max(1, Math.round(base * 1.4)),
      'ระหว่างตัดสินข้อได้ +40% เต็มเพดาน — คาด ' + Math.round(base * 1.4) + ' ได้ ' + live);

    const half = await ev(() => { G.ab.core.atk = 3; BA_LIVE = true; const v = hunterAtk(); BA_LIVE = false; return v; });
    ok(half === Math.max(1, Math.round(base * 1.21)), 'ขั้น 3 ได้ +21% ตามตาราง — ได้ ' + half);

    /* HP อสูรต้องไม่ขยับตามขั้นแกน */
    const hp0 = await ev(() => { G.ab.core.atk = 0; renderStats(); return monsterHpFor(G.floor); });
    const hp6 = await ev(() => { G.ab.core.atk = 6; renderStats(); return monsterHpFor(G.floor); });
    ok(hp0 === hp6, 'HP อสูรเท่าเดิมทั้งที่แกนพิฆาตเต็ม (' + hp0 + ' = ' + hp6 + ')');
  }

  // ══ บล็อก 5 · แกนเกราะ — ลดดาเมจที่รับทุกทาง ══════════════════════════
  head('บล็อก 5 · แกนเกราะ (SHIELD)');
  {
    await ev(() => { G.ab.core.shield = 0; G.streak = 0; renderStats(); });
    const raw = await ev(() => wrongDamage());
    await ev(() => { G.ab.core.shield = 6; renderStats(); });
    const cut = await ev(() => wrongDamage());
    ok(cut === Math.max(1, Math.round(raw * 0.76)),
      'ตอบผิดเสีย HP น้อยลง 24% — คาด ' + Math.max(1, Math.round(raw * 0.76)) + ' ได้ ' + cut);

    const mid = await ev(() => { G.ab.core.shield = 3; renderStats(); return wrongDamage(); });
    ok(mid === Math.max(1, Math.round(raw * 0.88)), 'ขั้น 3 ลด 12% ตามตาราง — ได้ ' + mid);

    /* baHurtHero คือทางเดียวที่สกิลอสูร/ทัพเงา/คำสาปใช้ทำร้ายฮีโร่ */
    const hurt = await ev(() => {
      G.ab.core.shield = 6; G.hp = G.maxHp; G.shield = 0; G.practiceMode = false;
      const b = G.hp; baHurtHero(100); const lost = b - G.hp; G.hp = G.maxHp; return lost;
    });
    ok(hurt === 76, 'baHurtHero(100) เสียจริง 76 (ลด 24%) — ได้ ' + hurt);
    await ev(() => { G.ab.core.shield = 0; renderStats(); });
  }

  // ══ บล็อก 6 · แกนสังหาร + ดาเมจคริตของคลังอักขระ ══════════════════════
  head('บล็อก 6 · ดาเมจคริต (แกนสังหาร + คลังอักขระ)');
  {
    /* ยืนบนชั้นธรรมดา ไม่มีเพดานดาเมจของ v6.7 มาปน */
    await ev(() => {
      G.practiceMode = false;
      G.floor = 2; G.floorProgress = 0;
      G.wordStats = {};
      G.ab.core.crit = 0;
      /* **ปิดระบบบุกรุกของ v6.6 ก่อนเสมอ** (กติกาเดิมของทุกชุดที่พาไปยืนชั้นใดชั้นหนึ่ง)
         ทัพเงามีโอกาส 15% ต่อชั้นที่จะมายืนแทนอสูรประจำชั้น และตั้งแต่ Micro-Patch
         เหวลึกขั้นสุด ทัพเงาถูกนับเป็น "ไฟต์บอส" เต็มตัว → เครื่องยนต์ของ v6.7
         (รีเจนเลือด · เพดานดาเมจต่อข้อ) เปิดขึ้นมาด้วย แล้วเลือดอสูรจะขยับเองระหว่างวัด
         จนส่วนต่างติดลบ ซึ่งอ่านแล้วเหมือน baStrike พังทั้งที่ถูกทุกบรรทัด */
      BA_INC_F = G.floor; BA_INC_AT = -1; BA_INC_M = null;
      nextMonster();
      G.locked = false;
      G.monsterMaxHp = 100000; G.monsterHp = 100000;
    });
    await page.waitForTimeout(200);

    const none = await ev(() => { const b = G.monsterHp; baStrike(1000, true, false); return b - G.monsterHp; });
    ok(none === 0, 'ยังไม่ได้อัปอะไรเลย = ไม่มีดาเมจส่วนเกิน — ได้ ' + none);

    const full = await ev(() => {
      G.ab.core.crit = 6; renderStats();
      const b = G.monsterHp; baStrike(1000, true, false); return b - G.monsterHp;
    });
    ok(full === 200, 'แกนสังหารเต็มขั้น = คริตลงเพิ่ม 20% ของยอดที่ลงจริง — ได้ ' + full);

    const nocrit = await ev(() => { const b = G.monsterHp; baStrike(1000, false, false); return b - G.monsterHp; });
    ok(nocrit === 0, 'หมัดธรรมดาไม่ได้โบนัสสักหน่วย — ได้ ' + nocrit);

    const sup = await ev(() => { const b = G.monsterHp; baStrike(1000, false, true); return b - G.monsterHp; });
    ok(sup === 200, 'ท่าไม้ตายนับเป็นคริตด้วย — ได้ ' + sup);

    /* หนีบไม่ให้ฆ่า (กับดักข้อ 19) */
    const clamp = await ev(() => {
      G.monsterHp = 5;
      baStrike(1000, true, false);
      return G.monsterHp;
    });
    ok(clamp >= 1, 'หนีบไม่ให้ดาเมจส่วนเกินฆ่าอสูร (เหลือ ' + clamp + ' HP)');

    /* โหมดฝึกจุดอ่อนต้องไม่มีผล */
    const prac = await ev(() => {
      G.monsterHp = 100000; G.practiceMode = true;
      const b = G.monsterHp; baStrike(1000, true, false); const d = b - G.monsterHp;
      G.practiceMode = false; return d;
    });
    ok(prac === 0, 'โหมดฝึกจุดอ่อนไม่มีดาเมจส่วนเกิน — ได้ ' + prac);
    await ev(() => { G.ab.core.crit = 0; G.monsterHp = 100000; renderStats(); });
  }

  // ══ บล็อก 7 · คลังอักขระ 4 สเตตัส ════════════════════════════════════
  head('บล็อก 7 · คลังอักขระ 4 สเตตัส (กริด 2×2)');
  {
    const tab = await ev(() => ({ hp: BA_C7_CX_HP, cd: BA_C7_CX_CD, tiers: CX_MILES.length,
                                  total: CX_TOTAL, mp: CX_MP_CAP, gold: CX_GOLD_CAP }));
    ok(tab.hp.length === tab.tiers + 1, 'ตาราง HP มีครบทุกขั้น (' + tab.hp.length + ' ช่อง = 12 ขั้น + ขั้น 0)');
    ok(tab.cd.length === tab.tiers + 1, 'ตารางดาเมจคริตมีครบทุกขั้น');
    ok(tab.hp[tab.hp.length - 1] === 300, 'ขั้นสุดท้ายให้ HP +300 พอดี');
    ok(tab.cd[tab.cd.length - 1] === 35, 'ขั้นสุดท้ายให้ดาเมจคริต +35% พอดี');
    ok(tab.mp === 30 && tab.gold === 10, 'สองสเตตัสเดิมของ v4.4 ไม่ถูกแตะ (MP 30 · ทอง 10%)');
    const mono = await ev(() => {
      const up = t => t.every((v, i) => i === 0 ? v === 0 : v >= t[i - 1]);
      return up(BA_C7_CX_HP) && up(BA_C7_CX_CD);
    });
    ok(mono, 'ทุกขั้นไม่ถอยหลัง และขั้น 0 เป็นศูนย์');

    /* สะสมคำจริง ๆ แล้วดูว่าสี่สเตตัสขยับพร้อมกัน */
    await evA((n) => {
      G.wordStats = {};
      for (let i = 0; i < n; i++) G.wordStats[String(VOCAB[i][0])] = { seen: 1, wrong: 0, recent: [] };
      renderStats();
    }, 110);
    const at110 = await ev(() => baBattleAudit().codex4);
    ok(at110.words === 110, 'นับคำที่สะสมได้ถูก — ' + at110.words);
    ok(at110.tier === 6, 'สะสม 110 คำ = ขั้นที่ 6 ตาม CX_MILES — ได้ขั้น ' + at110.tier);
    ok(at110.hp === 150 && at110.cdmg === 18, 'ขั้น 6 ให้ HP +150 · คริต +18% — ได้ +' +
      at110.hp + ' / +' + at110.cdmg + '%');
    ok(at110.mp > 0 && at110.gold > 0, 'สองสเตตัสเดิมยังทำงานคู่กันไปด้วย (MP +' +
      at110.mp + ' · ทอง +' + at110.gold + '%)');

    /* HP สูงสุดต้องรวมโบนัสคลังอักขระเข้าไปแล้ว */
    const hp = await ev(() => {
      G.ab.core.hp = 0; recalcStats();
      const withCx = G.maxHp;
      const raw = 100 + (G.level - 1) * 10 + G.stats.vit * 2 + rankHpBonus();
      return { withCx, raw };
    });
    ok(hp.withCx - hp.raw >= 150, 'หลอดเลือดรวมโบนัสคลังอักขระแล้ว (ส่วนต่าง ' +
      (hp.withCx - hp.raw) + ' ≥ 150)');
  }

  // ══ บล็อก 8 · กริด 2×2 บนหน้าจอจริง ═════════════════════════════════
  head('บล็อก 8 · กริด 2×2 บนหน้าจอจริง');
  {
    await ev(() => cxOpenBoard());
    await page.waitForTimeout(250);
    const r = await ev(() => {
      const box = document.getElementById('cxBoard');
      const buff = box.querySelector('.cx-buff');
      const cells = Array.from(buff.querySelectorAll('.cx-buff-b'));
      const cs = getComputedStyle(buff);
      const rects = cells.map(c => c.getBoundingClientRect());
      return {
        n: cells.length,
        cols: cs.gridTemplateColumns.split(' ').length,
        texts: cells.map(c => c.textContent.replace(/\s+/g, ' ').trim()),
        rows: new Set(rects.map(b => Math.round(b.top))).size,
        wide: box.scrollWidth <= box.clientWidth + 1
      };
    });
    ok(r.n === 4, 'มีสี่ช่องพอดี — ได้ ' + r.n);
    ok(r.cols === 2, 'จัดเป็นสองคอลัมน์ (กริด 2×2) — ได้ ' + r.cols + ' คอลัมน์');
    ok(r.rows === 2, 'เรียงลงเป็นสองแถว — ได้ ' + r.rows + ' แถว');
    ok(/MP/.test(r.texts[0]) && /ทอง/.test(r.texts[1]), 'สองช่องแรกยังเป็นของ v4.4 ตามเดิม');
    ok(/HP/.test(r.texts[2]) && /เพดาน 300/.test(r.texts[2]), 'ช่องที่ 3 = ❤️ HP สูงสุด เพดาน 300');
    ok(/คริต/.test(r.texts[3]) && /เพดาน 35%/.test(r.texts[3]), 'ช่องที่ 4 = ⚡ ดาเมจคริต เพดาน 35%');
    ok(r.wide, 'แผงคลังอักขระไม่ล้นแนวนอน');

    /* วาดซ้ำต้องไม่งอกช่องเพิ่ม (กับดักข้อ 2) */
    const again = await ev(() => { for (let i = 0; i < 5; i++) cxRender();
      return document.querySelectorAll('#cxBoard .cx-buff .cx-buff-b').length; });
    ok(again === 4, 'วาดซ้ำ 5 รอบยังมีสี่ช่องเท่าเดิม — ได้ ' + again);
  }

  // ══ บล็อก 9 · Mastery XII ════════════════════════════════════════════
  head('บล็อก 9 · Mastery XII — ครบ 329 คำ');
  {
    const before = await ev(() => ({
      gilded: baBattleAudit().codex4.gilded,
      hasTitle: (G.titles || []).indexOf('codexmaster') !== -1,
      titleInList: TITLES.some(t => t.key === 'codexmaster')
    }));
    ok(before.titleInList, 'ฉายาถูก push เข้า TITLES แล้ว');
    ok(!before.gilded, 'ยังไม่ครบเล่ม การ์ดยังไม่เป็นกรอบทอง');

    await ev(() => {
      G.wordStats = {};
      VOCAB.forEach(v => { G.wordStats[String(v[0])] = { seen: 1, wrong: 0, recent: [] }; });
      renderStats();
      cxRender();
    });
    await page.waitForTimeout(200);
    const a = await ev(() => baBattleAudit().codex4);
    ok(a.words === a.total, 'สะสมครบทั้งเล่ม ' + a.words + '/' + a.total);
    ok(a.tier === 12, 'ถึงขั้น XII — ได้ขั้น ' + a.tier);
    ok(a.mastered === true, 'ธง Mastery ขึ้นแล้ว');
    ok(a.hp === 300 && a.cdmg === 35, 'สองสเตตัสใหม่เต็มเพดานพอดี (+' + a.hp + ' / +' + a.cdmg + '%)');
    ok(a.mp === 30 && a.gold === 10, 'สองสเตตัสเดิมเต็มเพดานพอดีเช่นกัน');
    ok(a.title === 'ปราชญ์อักขระนิรันดร์', 'ชื่อฉายาตรงสเปก — ' + a.title);
    ok(a.gilded, 'แผงคลังอักขระติดคลาสกรอบทองแล้ว');

    const gold = await ev(() => {
      const cell = document.querySelector('#cxBoard .cx-cell:not(.lock)');
      const lock = document.querySelector('#cxBoard .cx-cell.lock');
      const cs = cell ? getComputedStyle(cell) : null;
      return { border: cs ? cs.borderTopColor : '', shadow: cs ? cs.boxShadow : '', hasLock: !!lock };
    });
    ok(/255,\s*200,\s*69/.test(gold.border), 'การ์ดคำที่สะสมแล้วเป็นกรอบทอง — ' + gold.border);
    ok(/rgba?\(/.test(gold.shadow) && gold.shadow !== 'none', 'การ์ดมีแสงเรืองรอบกรอบ');

    const unlocked = await ev(() => {
      checkTitles(G);
      return { got: (G.titles || []).indexOf('codexmaster') !== -1,
               chk: TITLES.find(t => t.key === 'codexmaster').check(G) };
    });
    ok(unlocked.chk === true, 'เงื่อนไขฉายาผ่านแล้ว');
    ok(unlocked.got, 'ฉายา 👑 ปราชญ์อักขระนิรันดร์ ถูกปลดล็อกจริง');

    const safe = await ev(() => {
      const t = TITLES.find(x => x.key === 'codexmaster');
      let a = null, b = null;
      try { a = t.check({}); } catch (e) { a = 'throw'; }
      try { b = t.check(null); } catch (e) { b = 'throw'; }
      return { a, b };
    });
    ok(safe.a === false && safe.b === false, 'check ทนกับบัญชีที่ยังไม่มี wordStats ได้ (กับดักข้อ 8)');
  }

  // ══ บล็อก 10 · Diamond HUD ═══════════════════════════════════════════
  head('บล็อก 10 · ชิป 💎 บนแถบหัวหน้าจอเล่น');
  {
    await ev(() => { const b = document.getElementById('cxBoard'); if (b) b.classList.remove('active'); });
    await ev(() => { G.ab.shards = 1234; renderStats(); });
    await page.waitForTimeout(150);
    const r = await ev(() => {
      const el = document.getElementById('baC7Gem');
      const bar = el ? el.closest('.g-topbar') : null;
      const b = el ? el.getBoundingClientRect() : null;
      return {
        has: !!el, text: el ? el.textContent : '',
        inTopbar: !!bar,
        inGame: !!(el && el.closest('#gameScreen')),
        vis: !!(b && b.width > 0 && b.height > 0),
        n: document.querySelectorAll('#baC7Gem').length,
        overflow: document.body.scrollWidth <= window.innerWidth
      };
    });
    ok(r.has, 'ชิปถูกแทรกจริง');
    ok(r.n === 1, 'มีชิปใบเดียว ไม่งอกซ้ำ — ได้ ' + r.n);
    ok(r.inTopbar && r.inGame, 'อยู่บนแถบหัวของหน้าจอเล่น');
    ok(r.text === '💎 1234', 'โชว์จำนวนเศษคริสตัลถูกต้อง — "' + r.text + '"');
    ok(r.vis, 'มองเห็นจริง (มีขนาดบนจอ)');
    ok(r.overflow, 'ไม่ทำให้แถบหัวล้นแนวนอน');

    await ev(() => { G.ab.shards = 7; renderStats(); });
    const t2 = await ev(() => document.getElementById('baC7Gem').textContent);
    ok(t2 === '💎 7', 'ตัวเลขตามทุกครั้งที่ 💎 ขยับ — "' + t2 + '"');

    /* Micro-Patch เควสประจำวันเปลี่ยนปลายทางของชิปมาที่กระดานเควส
       (สเปกสั่งไว้ตรง ๆ ว่า "แตะชิป 💎 → เปิดแผงเควส") แกนกลางระบบยังเข้าได้
       ตามเดิมจากปุ่ม ⚙️ SYSTEM CORE ในแถวปุ่มล่าง และจากปุ่มลัดท้ายกระดานเควส
       — เคสนี้จึงพิสูจน์ "ทางเข้าทั้งสองทางยังใช้ได้จริง" แทนของเดิมที่พิสูจน์ทางเดียว
       (precedent: v7.4 พลิกเคสของ test_gm_admin · v7.8 พลิกเคสของ test_menu_icons) */
    const opens = await ev(() => {
      document.getElementById('baC7Gem').click();
      const quest = document.getElementById('baQdBoard');
      const onQuest = !!(quest && quest.classList.contains('active'));
      if (typeof baQdClose === 'function') baQdClose();
      abOpenCore();
      const onCore = document.getElementById('abCore').classList.contains('active');
      abCloseCore();
      return onQuest && onCore;
    });
    ok(opens, 'แตะชิปแล้วเปิดกระดานเควส และแกนกลางระบบยังเปิดได้ตามเดิม');
  }

  // ══ บล็อก 11 · ข้อมูลต้องรอดข้ามการล็อกอิน ═══════════════════════════
  head('บล็อก 11 · ขั้นแกนใหม่ต้องรอดข้ามการล็อกอิน (กับดักข้อ 16)');
  {
    await ev(() => {
      G.ab.shards = 500;
      G.ab.core.hp = 4; G.ab.core.atk = 3; G.ab.core.shield = 2; G.ab.core.crit = 5;
      saveProgress();
      exitGame();
    });
    await page.waitForTimeout(700);
    await evA((u) => {
      switchTab('login');
      document.getElementById('login-id').value = u;
      document.getElementById('login-pw').value = '1234';
      handleSubmit();
    }, USER);
    await page.waitForTimeout(1100);
    await ev(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
    await page.waitForTimeout(800);

    const r = await ev(() => baBattleAudit().core7);
    ok(r.lv.hp === 4 && r.lv.atk === 3 && r.lv.shield === 2 && r.lv.crit === 5,
      'ขั้นแกนใหม่ทั้งสี่เส้นยังอยู่ครบหลังล็อกอินใหม่ — ' + JSON.stringify(r.lv));
    ok(r.lv.mp === 0 && r.lv.time === 0 && r.lv.gold === 0, 'สามเส้นเดิมไม่ถูกรบกวน');
    ok(r.eff.hp === 280 && r.eff.crit === 17, 'ผลของขั้นที่เซฟไว้คำนวณถูก (HP +' +
      r.eff.hp + ' · คริต +' + r.eff.crit + '%)');

    const store = await evA((u) => {
      const a = loadStore()[u];
      return { core: a.ab.core, keys: Object.keys(a.ab.core).sort().join(',') };
    }, USER);
    ok(store.keys === 'atk,crit,gold,hp,mp,shield,time',
      'abEnsure() ไม่กวาดคีย์ใหม่ทิ้ง — ' + store.keys);

    /* ค่าเพี้ยนต้องถูกซ่อมให้อยู่ในช่วง */
    const fixed = await evA((u) => {
      const s = loadStore(); s[u].ab.core.hp = 99; s[u].ab.core.crit = -3;
      s[u].ab.core.ghost = 4;
      saveStore(s);
      const a = loadStore()[u];
      return { hp: a.ab.core.hp, crit: a.ab.core.crit, ghost: a.ab.core.ghost };
    }, USER);
    ok(fixed.hp === 6, 'ขั้นเกินเพดานถูกหนีบเหลือ 6 — ได้ ' + fixed.hp);
    ok(fixed.crit === 0, 'ขั้นติดลบถูกซ่อมเป็น 0 — ได้ ' + fixed.crit);
    ok(fixed.ghost === undefined, 'คีย์แกนที่ไม่มีจริงถูกกวาดทิ้งตามเดิม');
  }

  // ══ บล็อก 12 · เลย์เอาต์ไม่ขยับ ══════════════════════════════════════
  head('บล็อก 12 · การ์ดโจทย์ต้องไม่โตขึ้นแม้แต่พิกเซลเดียว');
  {
    for (const w of [320, 390]) {
      const p2 = await ctx.newPage();
      p2.on('pageerror', e => errs.push(e.message));
      await p2.setViewportSize({ width: w, height: w === 320 ? 568 : 844 });
      await p2.route('**fonts.googleapis.com**', r => r.abort());
      await p2.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
      await p2.waitForTimeout(700);
      await p2.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
      await p2.waitForTimeout(120);
      await p2.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
      await p2.waitForTimeout(700);
      await p2.evaluate(() => {
        switchTab('register');
        document.getElementById('reg-id').value = 'z' + Math.floor(Math.random() * 999999);
        document.getElementById('reg-pw').value = '1234';
        document.getElementById('reg-pw2').value = '1234';
        handleSubmit();
      });
      await p2.waitForTimeout(900);
      await p2.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
      await p2.waitForTimeout(900);
      /* บังคับคำ/ตัวเลือกให้คงที่ + ล้างบรรทัดผลลัพธ์ ไม่งั้นความสูงแกว่งเอง */
      await p2.evaluate(() => {
        const m = G.currentMonster;
        m.word = '北京语言大学'; m.pinyin = 'Běijīng Yǔyán Dàxué';
        m.choices = ['มหาวิทยาลัยภาษาปักกิ่ง', 'โรงเรียน', 'ห้องสมุด', 'ร้านค้า'];
        m.answer = 'มหาวิทยาลัยภาษาปักกิ่ง';
        document.getElementById('gWord').textContent = m.word;
        document.getElementById('gPinyin').textContent = m.pinyin;
        document.getElementById('gFeedback').textContent = '';
        renderChoices();
      });
      await p2.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await p2.waitForTimeout(200);
      const r = await p2.evaluate(() => ({
        card: +document.querySelector('.ac-battle').getBoundingClientRect().height.toFixed(1),
        over: document.body.scrollWidth <= window.innerWidth,
        gem: !!document.getElementById('baC7Gem')
      }));
      const want = w === 320 ? 354.8 : 340.8;
      ok(r.card === want, 'จอ ' + w + ' · การ์ดโจทย์ ' + r.card + 'px (ต้องเป็น ' + want + 'px)');
      ok(r.over, 'จอ ' + w + ' · ไม่ล้นแนวนอนทั้งที่มีชิป 💎 เพิ่มมา');
      ok(r.gem, 'จอ ' + w + ' · ชิป 💎 ถูกแทรกครบ');
      await p2.close();
    }
  }

  // ══ บล็อก 13 · ไม่มี error หลุด ═══════════════════════════════════════
  head('บล็อก 13 · ความมั่นคง');
  {
    const log = await ev(() => {
      try { return JSON.parse(localStorage.getItem('yao_errlog') || '[]')
        .filter(r => /c7/.test(r.where || r.msg || '')); } catch (e) { return []; }
    });
    ok(errs.length === 0, 'ไม่มี pageerror ตลอดชุดเทสต์' + (errs.length ? ' — ' + errs[0] : ''));
    ok(log.length === 0, 'ไม่มีรายการของชั้นนี้ตกลง Error Log ของ v4.3 (' + log.length + ' รายการ)');
  }

  say('\n═══════════════════════════════════');
  say('ผ่าน ' + pass + '  ตก ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
