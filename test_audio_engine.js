/* ────────────────────────────────────────────────────────────────
   ชุดทดสอบชั้น v5.1 · DYNAMIC AUDIO ENGINE
   รัน:  NODE_PATH=/opt/node22/lib/node_modules node test_audio_engine.js
   ผลลัพธ์เขียนลง test_audio_engine.log (stdout ถูกบัฟเฟอร์ ถ้าค้างจะไม่เห็นว่าค้างตรงไหน)
   ──────────────────────────────────────────────────────────────── */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const LOG  = path.resolve(__dirname, 'test_audio_engine.log');
try { fs.unlinkSync(LOG); } catch (e) {}

let PASS = 0, FAIL = 0;
function log(s) { fs.appendFileSync(LOG, s + '\n'); }
function ok(name, cond, extra) {
  if (cond) { PASS++; log('  ✅ ' + name); }
  else      { FAIL++; log('  ❌ ' + name + (extra ? '   → ' + extra : '')); }
}
function head(s) { log('\n══ ' + s + ' ' + '═'.repeat(Math.max(0, 62 - s.length))); }

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const errors = [];
  page.on('pageerror', e => { errors.push(String(e)); log('  ‼️ pageerror: ' + e); });
  page.on('console', m => { if (m.type() === 'error') log('  ⚠️ console.error: ' + m.text()); });
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());

  const ev = fn => page.evaluate(fn);
  const wait = ms => page.waitForTimeout(ms);

  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await wait(400);

  // ── ล็อกอินเข้าเกม ───────────────────────────────────────────
  /* v5.6 · RULES GATE บล็อก enterGate() ไว้จนกว่าจะรับทราบกติกา กล่องล็อกอินจึงยังไม่โผล่
     แล้ว page.fill() ด้านล่างจะค้างรอ actionability จนหมดเวลา
     ต้องเข้าทางเดียวกับที่นักเรียนทำจริง: เลื่อนอ่านให้สุด → rgAck() (ซึ่งเรียก enterGate() ให้เอง) */
  await ev(() => { const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight; });
  await wait(150);
  await ev(() => {
    try { rgScrollCheck(); } catch (e) {}
    if (typeof rgAck === 'function') rgAck(); else enterGate();
  });
  await wait(700);
  await ev(() => switchTab('register'));
  await page.fill('#reg-id', 'audiotest');
  await page.fill('#reg-pw', '123456');
  await page.fill('#reg-pw2', '123456');
  await ev(() => handleSubmit());
  await page.waitForFunction(() => document.getElementById('gameScreen').classList.contains('active'), { timeout: 8000 });

  /* หน้าต่างจั่วการ์ดของ v4.7 เด้งตอนเข้าชั้น 1 — ต้องเลือกให้จบก่อน แล้วรอเกิน CD_OUT_MS */
  async function clearDraft() {
    const open = await ev(() => !!document.getElementById('cdDraft') &&
                                document.getElementById('cdDraft').classList.contains('active'));
    if (!open) return;
    await ev(() => document.querySelector('#cdDraft .cd-card').click());
    await wait(900);
  }
  await clearDraft();
  await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 8000 });

  /* ปลดล็อกแรงค์ + สลับเป็นการ์ดที่ไม่ยุ่งกับนาฬิกา (🧘 สมาธิแน่วแน่จะแช่แข็งทุกข้อ
     แล้ว QUESTION_TIMER เป็น null โดยชอบธรรม เคสจะตกด้วยเหตุผลผิด) */
  await ev(() => {
    G.maxFloor = FLOOR_MAX; recalcStats();
    CD_CARD = CD_BY_ID['mana']; CD_BAND = cdBandOf(G.floor);
    CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
    cdPaintUi();
    clearQuestionTimer(); startQuestionTimer();
    auSetMute(false);
  });

  /* ตัวดักเสียง — auPlay ถูกเรียกโดยชื่อจากทุก wrapper จึงห่อทับได้ทั้งชุด */
  await ev(() => {
    window.AU_LOG = [];
    const _p = auPlay;
    auPlay = function (k) { window.AU_LOG.push(k); return _p.apply(this, arguments); };
    window.auLogReset = function () { window.AU_LOG.length = 0; AU_LAST = {}; };
  });
  const logReset = () => ev(() => window.auLogReset());
  const played   = () => ev(() => window.AU_LOG.slice());

  /* v4.8.1 หยุดเกมไว้ทันทีที่จอเลื่อนหนีโซนคำถาม-คำตอบ ซึ่งเกิดง่ายมากหลังเปิด/ปิดประตูวาป
     ถ้าไม่พาจอกลับมาก่อน เคสของบล็อก 10 จะตกด้วยเหตุผลผิด (เกมหยุดอยู่ ไม่ใช่เสียงพัง) */
  async function unpause() {
    await ev(() => {
      if (typeof AC_MANUAL !== 'undefined') AC_MANUAL = false;
      if (typeof AC_FOCUS  !== 'undefined') AC_FOCUS  = false;
      if (typeof acFocusQa === 'function') acFocusQa();
      if (typeof acSync === 'function') acSync(true);
    });
    await wait(160);
  }

  // ══ 1. ติดตั้งชั้นครบ ═══════════════════════════════════════════
  head('1. ติดตั้งชั้น v5.1 + คลังเสียง');
  {
    const info = await ev(() => ({
      ver: AU_VER, key: AU_KEY, ready: AU_READY,
      keys: Object.keys(AU_SFX_DEF),
      pool: AU_POOL_MAX,
      fns: ['auPlay','auSetMute','auMuted','auToggleMute','auBgmPlay','auBgmStop','auBgmFade',
            'auBgmSync','auBgmWant','auBgmState','auUnlock','auPauseSync','auDangerSync','auArmTime']
            .filter(n => typeof window[n] === 'function' || typeof eval(n) === 'function')
    }));
    ok('AU_VER = v5.1', info.ver === 'v5.1', info.ver);
    ok("localStorage key = 'yao_audio'", info.key === 'yao_audio', info.key);
    ok('ชั้นติดตั้งเสร็จ (AU_READY)', info.ready === true);

    const need = ['SFX_HIT_CORRECT','SFX_HIT_CRIT','SFX_TAKE_DAMAGE','SFX_CARD_FIRE',
                  'SFX_CARD_LIGHTNING','SFX_ITEM_POTION','SFX_LOW_HP_LOOP','SFX_TIME_WARNING_3S',
                  'SFX_QUEST_COMPLETE','SFX_LEVEL_UP','SFX_CLICK'];
    const miss = need.filter(k => info.keys.indexOf(k) === -1);
    ok('รหัสเสียงตามสเปกครบ 11 รายการ', miss.length === 0, 'ขาด ' + miss.join(','));
    ok('มีเสียงในคลังอย่างน้อย 20 รายการ', info.keys.length >= 20, String(info.keys.length));

    const shape = await ev(() => {
      const bad = [];
      Object.keys(AU_SFX_DEF).forEach(function (k) {
        const d = AU_SFX_DEF[k];
        if (!d || !Array.isArray(d.v) || !d.v.length) { bad.push(k); return; }
        d.v.forEach(function (p) {
          if (p.w !== 'noise' && !(p.f > 0)) bad.push(k + ':f');
          if (!(p.d > 0)) bad.push(k + ':d');
          if (p.f2 != null && !(p.f2 > 0)) bad.push(k + ':f2');
        });
      });
      return bad;
    });
    ok('ทุกพาร์เชียลมีค่าที่ Web Audio รับได้ (ความถี่/ความยาว > 0)', shape.length === 0, shape.join(','));
  }

  // ══ 2. สองช่องสัญญาณ + Audio Pooling ═══════════════════════════
  head('2. Dual Channel + Audio Pooling');
  {
    await ev(() => auUnlock());
    await wait(200);
    const g = await ev(() => ({
      ctx:   !!AU_CTX,
      state: AU_CTX ? AU_CTX.state : '',
      master:!!AU_MASTER,
      sfx:   !!AU_SFX_BUS,
      bgm:   !!AU_BGM_BUS,
      voices: AU_VOICES.length,
      sfxVol: AU_SFX_BUS ? Math.round(AU_SFX_BUS.gain.value * 100) / 100 : -1,
      shared: (typeof AUDIO_CTX !== 'undefined') && AUDIO_CTX === AU_CTX
    }));
    ok('สร้าง AudioContext ได้', g.ctx === true);
    ok('มีช่อง SFX แยกจาก BGM', g.sfx && g.bgm);
    ok('ทั้งสองช่องต่อผ่าน master เดียว', g.master === true);
    ok('พูลช่องเสียงเท่ากับ AU_POOL_MAX (16)', g.voices === 16, String(g.voices));
    ok('ระดับเสียงช่อง SFX = AU_VOL_SFX', g.sfxVol === 0.85, String(g.sfxVol));
    ok('ยกให้ chime() ของ v4.0 ใช้ context ตัวเดียวกัน', g.shared === true);

    /* กดรัว 300 ครั้งด้วยคีย์หลายตัว — ต้องไม่มี error และช่องต้องไม่บวมเกินพูล */
    const stress = await ev(() => {
      const keys = Object.keys(AU_SFX_DEF);
      let peak = 0, err = 0;
      for (let i = 0; i < 300; i++) {
        AU_LAST = {};                                   /* ปิด throttle เพื่อบีบพูลจริง ๆ */
        try { auPlay(keys[i % keys.length]); } catch (e) { err++; }
        let busy = 0;
        for (let k = 0; k < AU_VOICES.length; k++) if (AU_VOICES[k].busy) busy++;
        if (busy > peak) peak = busy;
      }
      return { peak: peak, err: err, len: AU_VOICES.length };
    });
    ok('ยิงเสียงรัว 300 ครั้งไม่มี error', stress.err === 0, String(stress.err));
    ok('ช่องเสียงไม่ล้นพูล (peak ≤ 16)', stress.peak <= 16, String(stress.peak));
    ok('พูลไม่งอกโหนดเพิ่ม', stress.len === 16, String(stress.len));

    await logReset();
    const thr = await ev(() => {
      AU_LAST = {};
      const a = auPlay('SFX_CLICK');
      const b = auPlay('SFX_CLICK');       /* ภายในระยะ gap เดียวกัน ต้องถูกปัดตก */
      return { a: a, b: b };
    });
    ok('throttle รายคีย์ทำงาน (ยิงซ้ำทันทีถูกปัดตก)', thr.a === true && thr.b === false,
       JSON.stringify(thr));
  }

  // ══ 3. สวิตช์ 🔊 หนึ่งคลิกจบ + จำลง localStorage ════════════════
  head('3. สวิตช์เสียง 🔊 + localStorage[yao_audio]');
  {
    await ev(() => auSetMute(false));
    await ev(() => toggleMute());
    const off = await ev(() => ({
      store: localStorage.getItem('yao_audio'),
      mute:  auMuted(),
      gm:    G.muted,
      btn:   document.getElementById('gMute').textContent,
      played: (AU_LAST = {}, auPlay('SFX_LEVEL_UP'))
    }));
    ok("กดปิด → localStorage = 'off'", off.store === 'off', off.store);
    ok('กดปิด → auMuted() = true', off.mute === true);
    ok('กดปิด → G.muted ตามไปด้วย (chime ของ v4.0 เงียบตาม)', off.gm === true);
    ok('ปุ่มเปลี่ยนเป็น 🔇', off.btn === '🔇', off.btn);
    ok('ปิดแล้ว auPlay ไม่ยิงเสียง', off.played === false);

    await ev(() => toggleMute());
    const on = await ev(() => ({
      store: localStorage.getItem('yao_audio'),
      mute: auMuted(), gm: G.muted,
      btn: document.getElementById('gMute').textContent,
      played: (AU_LAST = {}, auPlay('SFX_LEVEL_UP'))
    }));
    ok("กดเปิด → localStorage = 'on'", on.store === 'on', on.store);
    ok('กดเปิด → เสียงกลับมา', on.mute === false && on.played === true);
    ok('ปุ่มกลับเป็น 🔊', on.btn === '🔊', on.btn);

    const api = await ev(() => { const a = auToggleMute(); const b = auToggleMute(); return [a, b]; });
    ok('auToggleMute() สลับได้ทั้งไปและกลับ', api[0] === true && api[1] === false, JSON.stringify(api));
  }

  // ══ 4. Autoplay Safeguard ═════════════════════════════════════
  head('4. Web Audio Autoplay Safeguard');
  {
    const st = await ev(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return AU_CTX ? AU_CTX.state : '';
    });
    await wait(200);
    const st2 = await ev(() => AU_CTX ? AU_CTX.state : '');
    ok('แตะจอแล้ว context ไม่ค้างที่ suspended', st2 !== 'suspended', st + ' → ' + st2);
    ok('มี auUnlock() ให้เรียกซ้ำได้ไม่พัง', await ev(() => { auUnlock(); auUnlock(); return true; }));
  }

  // ══ 5. Trigger Mapping — BATTLE ════════════════════════════════
  head('5. Trigger Mapping · BATTLE');
  {
    await ev(() => { auSetMute(false); G.hp = G.maxHp; G.shield = 0; });

    // ตอบถูกธรรมดา (ปิดคริตทิ้ง)
    await ev(() => { critChance = () => 0; expDoubleChance = () => 0; });
    await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 8000 });
    await logReset();
    await ev(() => { G.questionStart = Date.now(); answer(G.currentMonster.answer, null); });
    await wait(120);
    let p = await played();
    ok('ตอบถูก → SFX_HIT_CORRECT', p.indexOf('SFX_HIT_CORRECT') !== -1, p.join(','));
    ok('ตอบถูกไม่คริต → ไม่มี SFX_HIT_CRIT', p.indexOf('SFX_HIT_CRIT') === -1, p.join(','));

    // ตอบถูกคริต
    await wait(1400);
    await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 9000 });
    await ev(() => { critChance = () => 100; });
    await logReset();
    await ev(() => { G.questionStart = Date.now(); answer(G.currentMonster.answer, null); });
    await wait(120);
    p = await played();
    ok('ตอบถูกแบบคริต → SFX_HIT_CRIT', p.indexOf('SFX_HIT_CRIT') !== -1, p.join(','));
    ok('คริตแล้วไม่ยิงเสียงตีปกติซ้ำ', p.indexOf('SFX_HIT_CORRECT') === -1, p.join(','));
    await ev(() => { critChance = () => 0; });

    // ตอบผิด → เสียเลือด
    await wait(1400);
    await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 9000 });
    await ev(() => { G.hp = G.maxHp; G.shield = 0; });
    await logReset();
    await ev(() => {
      const m = G.currentMonster;
      G.questionStart = Date.now();
      answer(m.choices.filter(c => c !== m.answer)[0], null);
    });
    await wait(120);
    p = await played();
    ok('ตอบผิดแล้ว HP ลด → SFX_TAKE_DAMAGE', p.indexOf('SFX_TAKE_DAMAGE') !== -1, p.join(','));

    // เกราะรับไว้ = HP ไม่ลด = ต้องไม่มีเสียงโดนตี
    await wait(1900);
    await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 9000 });
    await ev(() => { G.hp = G.maxHp; G.shield = 3; });
    await logReset();
    await ev(() => {
      const m = G.currentMonster;
      G.questionStart = Date.now();
      answer(m.choices.filter(c => c !== m.answer)[0], null);
    });
    await wait(120);
    p = await played();
    ok('เกราะรับไว้ (HP ไม่ลด) → ไม่ยิง SFX_TAKE_DAMAGE', p.indexOf('SFX_TAKE_DAMAGE') === -1, p.join(','));
    await wait(1900);
  }

  // ══ 6. Trigger Mapping — ITEMS / SKILLS / CARDS ════════════════
  head('6. Trigger Mapping · ITEMS · SKILLS · CARDS');
  {
    await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 9000 });
    await ev(() => { G.items = { potion: 3, focus: 2 }; G.hp = 10; renderItems(); });

    await logReset();
    await ev(() => useItem('potion'));
    let p = await played();
    ok('🧪 ยาฟื้นพลัง → SFX_ITEM_POTION', p.indexOf('SFX_ITEM_POTION') !== -1, p.join(','));

    /* HP เต็มแล้วกดซ้ำ = v4.0 คืนก่อนหักของ ต้องไม่มีเสียง */
    await ev(() => { G.hp = G.maxHp; });
    await logReset();
    await ev(() => useItem('potion'));
    p = await played();
    ok('กดยาตอน HP เต็ม (ของไม่ถูกหัก) → ไม่มีเสียงไอเทม',
       p.indexOf('SFX_ITEM_POTION') === -1, p.join(','));

    await logReset();
    await ev(() => useItem('focus'));
    p = await played();
    ok('ไอเทมอื่น → SFX_ITEM_USE', p.indexOf('SFX_ITEM_USE') !== -1, p.join(','));

    await ev(() => { G.mp = maxMpOf(G); G.skillCd = {}; });
    await logReset();
    await ev(() => useSkill('eye'));
    p = await played();
    ok('ร่ายสกิลติดจริง → SFX_SKILL_CAST', p.indexOf('SFX_SKILL_CAST') !== -1, p.join(','));

    await ev(() => { G.mp = 0; });
    await logReset();
    await ev(() => useSkill('ward'));
    p = await played();
    ok('MP ไม่พอ (ร่ายไม่ติด) → ไม่มีเสียงสกิล', p.indexOf('SFX_SKILL_CAST') === -1, p.join(','));

    /* การ์ด — ยิงเสียงประจำใบตอนเลือก */
    const card = await ev(() => {
      window.AU_LOG.length = 0; AU_LAST = {};
      CD_OPEN = true; CD_OFFER = [CD_BY_ID['inferno'], CD_BY_ID['curse'], CD_BY_ID['ward']];
      cdPick(0);
      const a = window.AU_LOG.slice();
      window.AU_LOG.length = 0; AU_LAST = {};
      CD_OPEN = true; CD_OFFER = [CD_BY_ID['inferno'], CD_BY_ID['curse'], CD_BY_ID['ward']];
      cdPick(1);
      const b = window.AU_LOG.slice();
      window.AU_LOG.length = 0; AU_LAST = {};
      CD_OPEN = true; CD_OFFER = [CD_BY_ID['inferno'], CD_BY_ID['curse'], CD_BY_ID['ward']];
      cdPick(2);
      return { fire: a, light: b, plain: window.AU_LOG.slice() };
    });
    ok('🔥 เปลวเพลิงล้างบาง → SFX_CARD_FIRE', card.fire.indexOf('SFX_CARD_FIRE') !== -1, card.fire.join(','));
    ok('⚡ คำสาปย้อนกลับ → SFX_CARD_LIGHTNING', card.light.indexOf('SFX_CARD_LIGHTNING') !== -1, card.light.join(','));
    ok('การ์ดใบอื่น → SFX_CARD_DRAW', card.plain.indexOf('SFX_CARD_DRAW') !== -1, card.plain.join(','));
    await wait(900);

    /* 🔥 เผาเกราะผนึกของ v4.6 — ยิงซ้ำต้องไม่มีเสียงเพิ่ม (ธง infernoBurned กันไว้) */
    await ev(() => {
      G.floor = 5; G.floorProgress = 0;
      CD_CARD = CD_BY_ID['inferno']; CD_BAND = cdBandOf(G.floor);
      CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
      CD_SKIP = G.floor;
      nextMonster();
    });
    await wait(300);
    const burn = await ev(() => {
      window.AU_LOG.length = 0; AU_LAST = {};
      const first = AB_SEAL ? AB_SEAL.infernoBurned : null;
      cdInfernoSealStrike();
      return { first: first, log: window.AU_LOG.slice() };
    });
    ok('🔥 เผาผนึกซ้ำหลังเผาไปแล้ว → ไม่ยิงเสียงซ้ำ',
       burn.first !== true || burn.log.indexOf('SFX_CARD_FIRE') === -1, JSON.stringify(burn));
  }

  // ══ 7. Trigger Mapping — SYSTEM ════════════════════════════════
  head('7. Trigger Mapping · SYSTEM');
  {
    await ev(() => { ncSetMode('all'); });

    await logReset();
    await ev(() => snShowToast({ tag:'TEST 01/01', tone:'good' }, 'เควสต์สำเร็จ', 'ทดสอบ'));
    let p = await played();
    ok('toast สีฟ้าโทน good → SFX_QUEST_COMPLETE', p.indexOf('SFX_QUEST_COMPLETE') !== -1, p.join(','));

    await logReset();
    await ev(() => snShowToast({ tag:'TEST 01/01', tone:'danger' }, 'อันตราย', 'ทดสอบ'));
    p = await played();
    ok('toast โทน danger → SFX_SYSTEM_ALERT', p.indexOf('SFX_SYSTEM_ALERT') !== -1, p.join(','));

    /* โหมด 🔕 ของ v4.9.1 ปัดตกทั้งใบ — ไม่มีการ์ดขึ้นจอ จึงต้องไม่มีเสียงด้วย */
    await ev(() => ncSetMode('off'));
    await logReset();
    await ev(() => snShowToast({ tag:'TEST 01/01', tone:'good' }, 'ไม่ควรได้ยิน', 'ทดสอบ'));
    p = await played();
    ok('โหมด 🔕 ปิดแจ้งเตือน → ไม่มีเสียง toast', p.length === 0, p.join(','));
    await ev(() => ncSetMode('all'));

    await logReset();
    const lv = await ev(() => {
      const before = G.level;
      G.exp = G.maxExp + 10;
      levelUpCheck();
      return { before: before, after: G.level };
    });
    p = await played();
    ok('เลเวลอัป → SFX_LEVEL_UP', lv.after > lv.before && p.indexOf('SFX_LEVEL_UP') !== -1,
       JSON.stringify(lv) + ' | ' + p.join(','));

    await logReset();
    await ev(() => levelUpCheck());
    p = await played();
    ok('เรียก levelUpCheck ตอนไม่ขึ้นเลเวล → เงียบ', p.indexOf('SFX_LEVEL_UP') === -1, p.join(','));

    /* ปุ่มทั่วเกม — ตัวดักคลิกระดับเอกสาร */
    await logReset();
    await ev(() => {
      const b = document.createElement('button');
      b.id = 'auTestBtn'; b.style.position = 'fixed'; b.style.left = '-9999px';
      document.body.appendChild(b);
      b.click();
      const got = window.AU_LOG.slice();
      window.AU_LOG.length = 0; AU_LAST = {};
      const d = document.createElement('div');
      document.body.appendChild(d);
      d.click();
      const none = window.AU_LOG.slice();
      b.remove(); d.remove();
      window.AU_LOG.length = 0;
      window.AU_LOG.push.apply(window.AU_LOG, got.concat(['|']).concat(none));
      return { got: got, none: none };
    });
    const clicks = await ev(() => window.AU_LOG.slice());
    ok('คลิกปุ่ม → SFX_CLICK', clicks.indexOf('SFX_CLICK') === 0, clicks.join(','));
    ok('คลิกพื้นที่ที่ไม่ใช่ปุ่ม → เงียบ',
       clicks.slice(clicks.indexOf('|') + 1).length === 0, clicks.join(','));
  }

  // ══ 8. Trigger Mapping — เคลียร์ชั้น / ร่วง / ชุบชีวิต ═══════════
  head('8. Trigger Mapping · FLOOR · DOWN · GUARD');
  {
    await ev(() => {
      CD_CARD = null; CD_ST = null; CD_BAND = cdBandOf(G.floor); cdPaintUi();
      G.practiceMode = false; G.hp = G.maxHp;
    });

    await ev(() => { G.floor = 3; G.floorProgress = MONSTERS_PER_FLOOR; });
    await logReset();
    await ev(() => clearFloor(false));
    let p = await played();
    ok('เคลียร์ชั้นธรรมดา → SFX_FLOOR_CLEAR', p.indexOf('SFX_FLOOR_CLEAR') !== -1, p.join(','));
    await wait(1800);

    await ev(() => { G.floor = 5; G.floorProgress = MONSTERS_PER_FLOOR; });
    await logReset();
    await ev(() => clearFloor(true));
    p = await played();
    ok('เคลียร์ชั้นบอส → SFX_BOSS_CLEAR', p.indexOf('SFX_BOSS_CLEAR') !== -1, p.join(','));
    await wait(1800);
    await ev(() => { if (G.warpOpen) warpGo(); });
    await wait(400);
    await ev(() => { if (typeof snGateConfirm === 'function' &&
                         document.getElementById('snGate').classList.contains('active')) snGateConfirm(); });
    await wait(600);
    await clearDraft();

    await ev(() => { G.items = { insurance: 2 }; G.hp = 1; CD_CARD = null; CD_ST = null; });
    await logReset();
    await ev(() => onHunterDown());
    p = await played();
    ok('🛡️ ประกันภัยชุบชีวิต → SFX_GUARD', p.indexOf('SFX_GUARD') !== -1, p.join(','));
    ok('ชุบชีวิตแล้วไม่ยิงเสียงร่วงชั้น', p.indexOf('SFX_HUNTER_DOWN') === -1, p.join(','));
    await wait(1800);
    await ev(() => { if (G.warpOpen) warpGo(); });
    await wait(500);
    await ev(() => { if (document.getElementById('snGate').classList.contains('active')) snGateConfirm(); });
    await wait(600);
    await clearDraft();

    await ev(() => { G.items = {}; G.hp = 1; });
    await logReset();
    await ev(() => onHunterDown());
    p = await played();
    ok('HP หมดจริง → SFX_HUNTER_DOWN', p.indexOf('SFX_HUNTER_DOWN') !== -1, p.join(','));
    await wait(1800);
    await ev(() => { if (G.warpOpen) warpGo(); });
    await wait(500);
    await ev(() => { if (document.getElementById('snGate').classList.contains('active')) snGateConfirm(); });
    await wait(700);
    await clearDraft();   /* ร่วงชั้นแล้วข้ามช่วงชั้น หน้าต่างจั่วการ์ดของ v4.7 จะเด้งมาคั่น */
  }

  // ══ 9. BGM State Manager ══════════════════════════════════════
  head('9. BGM Infrastructure (Future-Proof States)');
  {
    const slots = await ev(() => Object.keys(AU_BGM_SRC));
    ok('มีช่องเพลงครบ 4 สถานะตามสเปก',
       ['BGM_TITLE','BGM_BATTLE_NORMAL','BGM_BATTLE_BOSS','BGM_VICTORY']
         .every(k => slots.indexOf(k) !== -1), slots.join(','));
    ok('ทุกช่องยังว่าง (ยังไม่มีไฟล์เพลง) → ไฟล์รวมไม่โต',
       await ev(() => Object.keys(AU_BGM_SRC).every(k => AU_BGM_SRC[k] === '')));

    await page.waitForFunction(() => !G.locked && G.currentMonster, { timeout: 9000 }).catch(() => {});
    const want = await ev(() => {
      const out = {};
      G.practiceMode = false; G.warpOpen = false;
      G.floor = 3;  out.normal = auBgmWant();
      G.floor = 10; out.boss   = auBgmWant();
      G.warpOpen = true;
      if (typeof DW_WON !== 'undefined') DW_WON = { gold: 500, exp: 250 };
      out.victory = auBgmWant();
      G.warpOpen = false;
      if (typeof DW_WON !== 'undefined') DW_WON = null;
      G.floor = 3;
      return out;
    });
    ok('ชั้นมอนสเตอร์ทั่วไป → BGM_BATTLE_NORMAL', want.normal === 'BGM_BATTLE_NORMAL', want.normal);
    ok('ชั้นบอส 5/10/15/20 → BGM_BATTLE_BOSS', want.boss === 'BGM_BATTLE_BOSS', want.boss);
    ok('ยืนที่ประตูวาปหลังปราบบอส → BGM_VICTORY', want.victory === 'BGM_VICTORY', want.victory);

    const sync = await ev(() => {
      G.floor = 10; auBgmSync(true); const a = auBgmState();
      G.floor = 3;  auBgmSync(true); const b = auBgmState();
      return [a, b];
    });
    ok('auBgmSync() เปลี่ยนสถานะตามชั้นที่ยืนอยู่',
       sync[0] === 'BGM_BATTLE_BOSS' && sync[1] === 'BGM_BATTLE_NORMAL', JSON.stringify(sync));

    const fade = await ev(() => {
      const before = AU_BGM_BUS.gain.value;
      auBgmFade(0.4, 200);
      const mid = typeof AU_BGM_BUS.gain.linearRampToValueAtTime === 'function';
      auBgmFade(0, 200);
      return { before: before, mid: mid, err: false };
    });
    ok('auBgmFade() เรียกได้ไม่พังทั้งขาเข้าและขาออก', fade.mid === true);
    ok('ยังไม่มีเพลง → auBgmPlay คืน false แต่จำสถานะไว้',
       await ev(() => { const r = auBgmPlay('BGM_TITLE'); return r === false && auBgmState() === 'BGM_TITLE'; }));
  }

  // ══ 10. Control Constraint — Auto-Pause ของ v4.8.1 ══════════════
  head('10. Control Constraint · Auto-Pause (v4.8.1)');
  {
    await clearDraft();
    await ev(() => {
      G.floor = 3; G.floorProgress = 0; G.practiceMode = false;
      CD_CARD = CD_BY_ID['mana']; CD_BAND = cdBandOf(G.floor);
      CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0, paid:0 };
      cdPaintUi();
      G.locked = false;
      nextMonster();
    });
    await wait(500);
    await ev(() => { if (document.getElementById('snGate').classList.contains('active')) snGateConfirm(); });
    await wait(400);
    await ev(() => { clearQuestionTimer(); startQuestionTimer(); });
    await unpause();

    log('  ℹ️ สถานะก่อนวัด: ' + JSON.stringify(await ev(() => ({
      paused: acPaused(), man: AC_MANUAL, foc: AC_FOCUS, ovl: acOverlayOpen(), qa: acQaVisible(),
      held: AC_HELD, locked: G.locked, mon: !!G.currentMonster, warp: G.warpOpen,
      open: Array.prototype.slice.call(document.querySelectorAll(AC_OVL_SEL)).map(x => x.id || x.className)
    }))));
    const armed = await ev(() => ({ timer: QUESTION_TIMER !== null, watch: AU_TM_T !== 0, paused: acPaused() }));
    ok('ยืนยันว่านาฬิกาต่อข้อเดินอยู่จริงก่อนวัด',
       armed.timer === true && armed.paused === false, JSON.stringify(armed));
    ok('ขึ้นข้อใหม่ → ตัวเฝ้าเวลาใกล้หมดถูกตั้งไว้', armed.watch === true, JSON.stringify(armed));

    /* HP วิกฤต → ลูปเสียงหัวใจต้องเริ่มเดิน */
    await ev(() => { G.hp = Math.max(1, Math.round(G.maxHp * 0.1)); renderStats(); });
    const loopOn = await ev(() => ({ lv: abDangerLevel(), hp: AU_HP_T !== 0 }));
    ok('HP วิกฤต → SFX_LOW_HP_LOOP เริ่มลูป', loopOn.lv >= 2 && loopOn.hp === true, JSON.stringify(loopOn));

    /* กด ⏸️ พัก — ลูป HP ต้องดับ · BGM ถูกหรี่ · และห้ามมีเสียงลูปใดหลุดออกมาอีก
       (ตัวเฝ้าเวลายัง poll ต่อได้ตอนที่สถานะหยุดเกิดโดยไม่ผ่านรอยต่อ — สิ่งที่ต้องกันคือ "เสียง") */
    await ev(() => acTogglePause());
    await wait(120);
    const paused = await ev(() => ({
      acp: acPaused(), aup: AU_PAUSED, hp: AU_HP_T, tm: AU_TM_T, duck: AU_BGM_DUCKED
    }));
    ok('เข้าสถานะหยุด → ลูป HP ต่ำเงียบ', paused.acp === true && paused.hp === 0, JSON.stringify(paused));
    ok('เข้าสถานะหยุด → ตัวเตือนเวลาถูกปลดจากรอยต่อการหยุด', paused.tm === 0, JSON.stringify(paused));
    ok('เข้าสถานะหยุด → BGM ถูกหรี่/พัก', paused.duck === true, JSON.stringify(paused));

    const mutedWhilePaused = await ev(() => {
      window.AU_LOG.length = 0; AU_LAST = {};
      auHpTick(); auTimeTick(); auDangerSync(); auArmTime();
      return window.AU_LOG.slice();
    });
    ok('ระหว่างหยุด ต่อให้ลูปถูกปลุกก็ไม่ยิงเสียง', mutedWhilePaused.length === 0, mutedWhilePaused.join(','));

    await ev(() => acResumeClick());
    await unpause();
    const resumed = await ev(() => ({
      acp: acPaused(), aup: AU_PAUSED, hp: AU_HP_T !== 0, tm: AU_TM_T !== 0, duck: AU_BGM_DUCKED
    }));
    ok('เล่นต่อ → ลูป HP ต่ำกลับมา', resumed.acp === false && resumed.hp === true, JSON.stringify(resumed));
    ok('เล่นต่อ → ตัวเตือนเวลากลับมา', resumed.tm === true, JSON.stringify(resumed));
    ok('เล่นต่อ → BGM เลิกหรี่', resumed.duck === false, JSON.stringify(resumed));

    /* เปิดหน้าต่างระบบก็นับเป็นหยุดเหมือนกัน (ผ่าน acSync ตัวเดียวกัน) */
    await ev(() => openShop());
    await wait(250);
    const shop = await ev(() => {
      const s = { acp: acPaused(), hp: AU_HP_T };
      window.AU_LOG.length = 0; AU_LAST = {};
      auHpTick(); auTimeTick();
      s.log = window.AU_LOG.slice();
      return s;
    });
    ok('เปิดร้านค้า (หน้าต่างระบบ) → เสียงลูปเงียบด้วย',
       shop.acp === true && shop.hp === 0 && shop.log.length === 0, JSON.stringify(shop));
    await ev(() => closeShop());
    await wait(250);
    await unpause();

    await ev(() => { G.hp = G.maxHp; renderStats(); });
    const safe = await ev(() => AU_HP_T);
    ok('HP กลับมาปลอดภัย → ลูปหยุดเอง', safe === 0, String(safe));

    /* ปิดเสียงทั้งหมดต้องดับลูปด้วย */
    await ev(() => { G.hp = Math.max(1, Math.round(G.maxHp * 0.1)); renderStats(); });
    const before = await ev(() => AU_HP_T !== 0);
    await ev(() => auSetMute(true));
    const afterMute = await ev(() => AU_HP_T);
    ok('กด 🔇 → ลูปแจ้งเตือนดับตาม', before === true && afterMute === 0, String(afterMute));
    await ev(() => { auSetMute(false); G.hp = G.maxHp; renderStats(); });
  }

  // ══ 11. ไม่รบกวนของเดิม ═══════════════════════════════════════
  head('11. ไม่รบกวนชั้นล่างและเลย์เอาต์');
  {
    const layout = await ev(() => ({
      w: document.body.scrollWidth, iw: window.innerWidth,
      band: getComputedStyle(document.getElementById('gameScreen')).getPropertyValue('--nc-band').trim()
    }));
    ok('เลย์เอาต์ไม่ล้นแนวนอน', layout.w <= layout.iw, layout.w + ' > ' + layout.iw);
    ok('แถบปลอดภัยของ v4.9.1 ยังอยู่', layout.band !== '', layout.band);

    /* ค่าเสียงต้องรอดข้ามการล็อกอินใหม่ (เป็นค่าระดับเครื่อง ไม่ผูกบัญชี) */
    await ev(() => auSetMute(true));
    await ev(() => exitGame());
    await wait(400);
    await ev(() => enterGate());       /* exitGame พากลับหน้าแรก ต้องเข้าเกทใหม่ก่อน */
    await wait(700);
    await ev(() => switchTab('login'));
    await wait(200);
    await page.fill('#login-id', 'audiotest');
    await page.fill('#login-pw', '123456');
    await ev(() => handleSubmit());
    await page.waitForFunction(() => document.getElementById('gameScreen').classList.contains('active'), { timeout: 8000 });
    await wait(400);
    const kept = await ev(() => ({
      store: localStorage.getItem('yao_audio'), mute: auMuted(), gm: G.muted,
      btn: document.getElementById('gMute').textContent
    }));
    ok('ปิดเสียงแล้วล็อกอินใหม่ → ยังปิดอยู่', kept.store === 'off' && kept.mute === true, JSON.stringify(kept));
    ok('ล็อกอินใหม่ → G.muted กับปุ่มตรงกับค่าในเครื่อง',
       kept.gm === true && kept.btn === '🔇', JSON.stringify(kept));
    await ev(() => auSetMute(false));

    ok('ไม่มี pageerror ตลอดการทดสอบ', errors.length === 0, errors.join(' | '));
  }

  log('\n' + '═'.repeat(66));
  log('ผลรวม:  ✅ ผ่าน ' + PASS + '   ❌ ตก ' + FAIL);
  log('═'.repeat(66));

  await browser.close();
  console.log('PASS=' + PASS + ' FAIL=' + FAIL + '  (ดูรายละเอียดที่ ' + LOG + ')');
  process.exit(FAIL ? 1 : 0);
})().catch(e => {
  log('\n💥 CRASH: ' + (e && e.stack || e));
  console.log('CRASH: ' + e);
  process.exit(2);
});
