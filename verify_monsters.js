/* ตรวจชั้น v6.2 · MONSTER SPRITE SHEETS แบบ "ผลลัพธ์ซ้ำได้ทุกรอบ"
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node verify_monsters.js <ไฟล์.html>
 *
 * verify_arena.js วัด "ตัวละครบังโจทย์ไหม" จากกรอบของ .ba-row ซึ่งเป็นกล่องแถว
 * ไม่ใช่ตัวภาพ — ภาพอสูรเป็น absolute ที่ยื่นพ้นกล่องแถวขึ้นไปได้ ชุดนี้จึงวัดจาก
 * **ขอบบนของตัวอสูรจริง ๆ** (คำนวณจากสัดส่วนที่อบไว้ในเฟรม) เทียบกับขอบล่างพินอิน
 *
 * และตรวจสามเรื่องที่ชุดอื่นไม่ได้ตรวจให้: จับคู่อสูรตรงชั้นไหม · อสูรคงที่ตลอด
 * การต่อสู้ตัวเดิมไหม · ถอดภาพออกแล้วอีโมจิของ v4.0 กลับมาไหม
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE = process.argv[2] || 'hanzi_hunter_tower_v3_1_intro.html';
const CASES = [
  { w: 320, h: 568 }, { w: 360, h: 640 }, { w: 390, h: 844 }, { w: 430, h: 932 }
];

/* สัดส่วนความสูง "ตัว" ต่อความสูงเฟรม — ต้องตรงกับ BODY/BODY_BOSS ÷ FRAME_H
   ของ embed_monster_art.py (92/116 และ 100/116) ถ้าขยับที่นั่นต้องขยับที่นี่ด้วย */
const BODY = 92 / 116, BODY_BOSS = 100 / 116;

/* ชั้นไหนควรได้อสูรตัวไหน — สารบัญชุดที่สองโดยตั้งใจ เพื่อให้เทสต์จับได้ถ้า
   BA_FOES ในเกมถูกแก้โดยไม่ได้ตั้งใจ (ถ้าอ่านจากเกมมาเทียบกับเกม จะไม่มีวันตก) */
const WANT = {
  1: ['m11', 'm12'], 2: ['m11', 'm12'], 3: ['m13', 'm14', 'm15'], 4: ['m16'],
  5: ['m21'], 6: ['m21'], 7: ['m22'], 8: ['m23'],
  9: ['m31'], 10: ['m31'], 11: ['m32'], 12: ['m33'],
  13: ['m41'], 14: ['m41'], 15: ['m42'], 16: ['m43'],
  17: ['m51'], 18: ['m51'], 19: ['m52'], 20: ['m53']
};
const BOSS_ART = ['m16', 'm23', 'm33', 'm43', 'm53'];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

async function enter(page) {
  await page.evaluate(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { if (typeof rgAck === 'function') rgAck(); else enterGate(); });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    switchTab('register');
    document.getElementById('reg-id').value = 'v' + Math.floor(Math.random() * 999999);
    document.getElementById('reg-pw').value = '1234';
    document.getElementById('reg-pw2').value = '1234';
    handleSubmit();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const x = document.querySelector('#cdDraft.active .cd-card'); if (x) x.click(); });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  for (const c of CASES) {
    console.log('\n── ' + c.w + '×' + c.h + ' ──────────────────────────────');
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));

    /* v5.4 ฝัง URL ฐานข้อมูลจริงไว้ — ไม่ stub = ยิงเข้าฐานข้อมูลห้องเรียนจริง */
    await page.addInitScript(() => {
      window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve('null') });
      window.EventSource = function () { this.close = function () {}; };
    });
    await page.route('**fonts.googleapis.com**', r => r.abort());
    await page.route('**fonts.gstatic.com**', r => r.abort());
    await page.goto('file://' + path.resolve(FILE), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await enter(page);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });

    /* ── ฝังภาพครบ 18 ตัวหรือยัง ─────────────────────────────────────── */
    const cat = await page.evaluate(() => ({
      foes: BA_FOES.map(f => ({ id: f.id, floors: f.floors })),
      art: BA_FOES.filter(f => BA_MON[f.id] && BA_MON[f.id].length).map(f => f.id),
      frames: Object.keys(BA_MON).reduce((a, k) => (a[k] = BA_MON[k].map(x => x.k), a), {})
    }));
    ok(cat.foes.length === 18, 'สารบัญมีอสูรครบ 18 ตัว (ได้ ' + cat.foes.length + ')');
    ok(cat.art.length === 18, 'ฝังภาพครบทั้ง 18 ตัว (ได้ ' + cat.art.length + ')');

    const mapOk = cat.foes.every(f => f.floors.every(fl => (WANT[fl] || []).indexOf(f.id) >= 0)) &&
      Object.keys(WANT).every(fl => WANT[fl].every(id =>
        (cat.foes.find(x => x.id === id) || { floors: [] }).floors.indexOf(+fl) >= 0));
    ok(mapOk, 'จับคู่อสูรกับชั้น 1-20 ตรงตามที่สั่งทุกช่อง');

    const everyHasIdle = Object.keys(cat.frames).every(k => cat.frames[k].some(x => x !== 'act'));
    ok(everyHasIdle, 'ทุกตัวมีท่ายืนอย่างน้อยหนึ่งเฟรม');
    const actCount = Object.keys(cat.frames).filter(k => cat.frames[k].some(x => x === 'act')).length;
    ok(actCount >= 17, 'มีท่าฟาดอย่างน้อย 17 ตัว (ได้ ' + actCount + ') — เหลือแค่ตัวที่ต้นฉบับมีเฟรมเดียว');

    /* ── ไล่ทีละชั้น 1-20 ────────────────────────────────────────────── */
    const bad = [];
    const overlaps = [];
    const notRight = [];
    const brokenImg = [];
    const multiOn = [];

    for (let fl = 1; fl <= 20; fl++) {
      const r = await page.evaluate((floor) => {
        G.floor = floor;
        G.floorProgress = 0;
        G.monsterMaxHp = 99999; G.monsterHp = 99999;
        /* ปิดระบบบุกรุกของชั้น v6.6 ระหว่างวัดชุดนี้ — ทัพเงามีโอกาส 15% ต่อชั้น
           ที่จะมายืนแทนอสูรประจำชั้น ซึ่งเป็นพฤติกรรมที่ถูกต้อง แต่ทำให้ชุดนี้
           (ที่พิสูจน์ว่า "ชั้นไหนได้อสูรตัวไหน") ตกแบบสุ่มโดยไม่มีอะไรพังจริง
           ปั๊ม BA_INC_F ให้ตรงชั้นก่อน = ลูกเต๋าถูกทอยไปแล้ว จะไม่ถูกทอยซ้ำ */
        if (typeof BA_INC_F !== 'undefined') { BA_INC_F = floor; BA_INC_AT = -1; BA_INC_M = null; }
        nextMonster();
        const box = document.getElementById('baFoe');
        const imgs = [...box.getElementsByClassName('ba-mon')];
        const on = imgs.filter(i => i.classList.contains('on'));
        const arena = document.getElementById('baArena');
        const hero = document.getElementById('baHero');
        const py = document.getElementById('gPinyin');
        const el = on[0] || imgs[0] || null;
        const eb = el ? el.getBoundingClientRect() : null;
        const pb = py ? py.getBoundingClientRect() : null;
        return {
          id: BA_FOE_ID,
          n: imgs.length,
          onCount: on.length,
          decoded: imgs.every(i => i.complete && i.naturalWidth > 0),
          pos: el ? getComputedStyle(el).position : '',
          // ขอบบนของ "ตัว" จริง ๆ = ขอบล่างกรอบ − สัดส่วนตัวที่อบไว้ × ความสูงกรอบ
          elBottom: eb ? eb.bottom : null,
          elHeight: eb ? eb.height : null,
          pinyinBottom: pb ? pb.bottom : null,
          foeX: box.getBoundingClientRect().left,
          heroX: hero.getBoundingClientRect().left,
          arenaMid: arena.getBoundingClientRect().left + arena.getBoundingClientRect().width / 2,
          emojiHidden: getComputedStyle(document.getElementById('gAvatar')).display === 'none',
          bodyH: document.body.scrollWidth
        };
      }, fl);
      /* data URI ยัง decode ไม่เสร็จตอนเพิ่งแขวน — ต้องรอก่อนวัดเสมอ ไม่งั้นจะอ่านได้
         naturalWidth 0 แล้วสรุปผิดว่าภาพเสีย (กติกาเดียวกับชุดทดสอบไอคอนไอเทม/เมนู) */
      await page.waitForFunction(() => {
        const i = [...document.getElementById('baFoe').getElementsByClassName('ba-mon')];
        return i.length === 0 || i.every(x => x.complete && x.naturalWidth > 0);
      }, null, { timeout: 5000 }).catch(() => {});
      const dec = await page.evaluate(() => [...document.getElementById('baFoe')
        .getElementsByClassName('ba-mon')].every(x => x.complete && x.naturalWidth > 0));
      r.decoded = dec;

      const want = WANT[fl];
      if (!want.includes(r.id)) bad.push(fl + ':' + r.id);
      if (!r.decoded) brokenImg.push(fl);
      if (r.onCount !== 1) multiOn.push(fl + ':' + r.onCount);
      if (r.foeX <= r.arenaMid || r.heroX >= r.arenaMid) notRight.push(fl);

      const ratio = BOSS_ART.includes(r.id) ? BODY_BOSS : BODY;
      const bodyTop = r.elBottom - ratio * r.elHeight;
      overlaps.push({ fl, id: r.id, gap: +(bodyTop - r.pinyinBottom).toFixed(1), pos: r.pos, emoji: r.emojiHidden });
    }

    ok(bad.length === 0, 'ทุกชั้นได้อสูรของชั้นตัวเอง' + (bad.length ? ' — ผิด: ' + bad.join(', ') : ''));
    ok(brokenImg.length === 0, 'ทุกเฟรม decode ได้จริง (data URI ไม่เสีย)' + (brokenImg.length ? ' — ชั้น ' + brokenImg.join(',') : ''));
    ok(multiOn.length === 0, 'โชว์ทีละเฟรมเดียวเสมอทั้ง 20 ชั้น' + (multiOn.length ? ' — ' + multiOn.join(',') : ''));
    ok(notRight.length === 0, 'อสูรอยู่ฝั่งขวา · ฮีโร่อยู่ฝั่งซ้าย ครบทั้ง 20 ชั้น');
    ok(overlaps.every(o => o.pos === 'absolute'), 'ภาพอสูรเป็น absolute (ดันเลย์เอาต์ไม่ได้)');
    ok(overlaps.every(o => o.emoji), 'มีภาพแล้วอีโมจิของ v4.0 ถูกซ่อนทุกชั้น');

    const worst = overlaps.reduce((a, b) => (b.gap < a.gap ? b : a));
    ok(worst.gap >= 0,
      'ตัวอสูรไม่ขึ้นไปคร่อมพินอินสักชั้น — แคบสุดชั้น ' + worst.fl + ' (' + worst.id + ') เหลือ ' + worst.gap + 'px');

    /* ── อสูรต้องคงที่ตลอดการต่อสู้ตัวเดิม (renderMonster ถูกเรียกซ้ำตอนตอบผิด) ── */
    const stable = await page.evaluate(() => {
      G.floor = 3; G.floorProgress = 0; G.monsterMaxHp = 99999; G.monsterHp = 99999;
      nextMonster();
      const first = BA_FOE_ID;
      const seen = [];
      for (let i = 0; i < 8; i++) { renderMonster(); seen.push(BA_FOE_ID); }
      return { first, same: seen.every(x => x === first) };
    });
    ok(stable.same, 'อสูรไม่เปลี่ยนหน้าเมื่อ renderMonster ถูกเรียกซ้ำ (' + stable.first + ')');

    /* ── ห้ามกินคิวของ Math.random (กับดักข้อ 32) ─────────────────────── */
    const rnd = await page.evaluate(() => {
      const real = Math.random;
      let n = 0;
      Math.random = function () { n++; return real(); };
      try { baFoeAct(300); baMountFoe(true); baFoeHurt(); } finally { Math.random = real; }
      return n;
    });
    ok(rnd === 0, 'ตรรกะอสูรไม่เรียก Math.random สักครั้ง (ได้ ' + rnd + ')');

    /* ── ท่าฟาด/สแนปกลับท่ายืน ──────────────────────────────────────── */
    const anim = await page.evaluate(() => {
      G.floor = 20; G.floorProgress = 0; G.monsterMaxHp = 99999; G.monsterHp = 99999;
      nextMonster();
      const idle = BA_FOE_FR;
      baFoeAct(4000);
      const act = BA_FOE_FR;
      baFoeHurt();
      const back = BA_FOE_FR;
      return { idle, act, back, kinds: BA_MON[BA_FOE_ID].map(x => x.k) };
    });
    ok(anim.act !== anim.idle && anim.kinds[anim.act] === 'act', 'สั่งท่าฟาดแล้วสลับไปเฟรมท่าฟาดจริง');
    ok(anim.back === anim.idle, 'โดนฟันแล้วสแนปกลับท่ายืนทันที');

    /* ── ถอดภาพออก → อีโมจิของ v4.0 ต้องกลับมาครบ ────────────────────── */
    const fallback = await page.evaluate(() => {
      const keep = {};
      Object.keys(BA_MON).forEach(k => { keep[k] = BA_MON[k]; BA_MON[k] = []; });
      G.floor = 8; G.floorProgress = 0; G.monsterMaxHp = 99999; G.monsterHp = 99999;
      /* ต้องปิดการบุกรุกของ v6.6 ด้วย ไม่งั้นสไปรต์ทัพเงาจะยังแขวนอยู่ทั้งที่
         ถอดภาพอสูรหอคอยออกหมดแล้ว (คนละช่องเสียบกัน — BA_SH_ART ไม่ใช่ BA_MON) */
      if (typeof BA_INC_F !== 'undefined') { BA_INC_F = 8; BA_INC_AT = -1; BA_INC_M = null; }
      nextMonster();
      const box = document.getElementById('baFoe');
      const out = {
        imgs: box.getElementsByClassName('ba-mon').length,
        emoji: getComputedStyle(document.getElementById('gAvatar')).display !== 'none',
        text: document.getElementById('gAvatar').textContent.trim().length > 0
      };
      Object.keys(keep).forEach(k => { BA_MON[k] = keep[k]; });
      return out;
    });
    ok(fallback.imgs === 0, 'ถอดภาพแล้วไม่เหลือ <img> ค้างในสนาม');
    ok(fallback.emoji && fallback.text, 'ถอดภาพแล้วอีโมจิของ v4.0 กลับมาโชว์ตามเดิม');

    const flow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
    ok(flow, 'ไม่ล้นแนวนอน');
    ok(errs.length === 0, 'ไม่มี pageerror' + (errs.length ? ' — ' + errs[0] : ''));

    await ctx.close();
  }

  await browser.close();
  console.log('\n═══════════════════════════════════');
  console.log('ผ่าน ' + pass + '  ตก ' + fail);
  process.exit(fail ? 1 : 0);
})();
