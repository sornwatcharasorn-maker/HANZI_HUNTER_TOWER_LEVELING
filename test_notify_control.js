/* ชุดทดสอบชั้น v4.9 · NOTIFY CONTROL */
const { chromium } = require('playwright');
const fs = require('fs');

const FILE = 'file:///home/user/HANZI_HUNTER_TOWER_LEVELING/hanzi_hunter_tower_v3_1_intro.html';
const LOG = '/tmp/claude-0/-home-user-HANZI-HUNTER-TOWER-LEVELING/adadb5f0-8615-592d-a39a-72673d0b16bf/scratchpad/test_nc.log';
try { fs.unlinkSync(LOG); } catch (e) {}
function log(s) { fs.appendFileSync(LOG, s + '\n'); }

let PASS = 0, FAIL = 0;
function ok(name, cond, extra) {
  if (cond) { PASS++; log('  PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; log('  FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

const rafx2 = 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))';

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

/* เคลียร์หน้าต่างจั่วการ์ดของ v4.7 ให้จบ แล้วสลับเป็นใบที่ไม่ยุ่งกับนาฬิกา */
async function settle(page) {
  const has = await page.evaluate(() => {
    const d = document.getElementById('cdDraft');
    return !!(d && d.classList.contains('active'));
  });
  if (has) {
    await page.evaluate(() => document.querySelector('#cdDraft .cd-card').click());
    await page.waitForTimeout(900);          /* > CD_OUT_MS 620 */
  }
  await page.evaluate(() => {
    CD_CARD = CD_BY_ID['mana'];
    CD_BAND = cdBandOf(G.floor);
    CD_ST = { ward:0, noItem:0, noHeal:0, atk:0, perfect:true, hit:0, miss:0 };
    cdPaintUi();
    clearQuestionTimer(); startQuestionTimer();
    document.getElementById('snLayer').innerHTML = '';
  });
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  // ══════════════════════════════════════════════════════════
  log('\n=== 1) สารบัญ + ตารางหมวดวิกฤต ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_idx');
    await settle(page);

    const r = await page.evaluate(() => ({
      sysCount: Object.keys(SYS_NOTIF).length,
      sysTags:  Object.keys(SYS_NOTIF).map(k => SYS_NOTIF[k].tag),
      sysKeys:  Object.keys(SYS_NOTIF).map(k => Object.keys(SYS_NOTIF[k]).length),
      ncCount:  Object.keys(NC_NOTIF).length,
      ncTags:   Object.keys(NC_NOTIF).map(k => NC_NOTIF[k].tag),
      critN:    NC_CRIT.length,
      critHasCombo:  NC_CRIT.indexOf(SYS_NOTIF.BTL_COMBO5) !== -1,
      critHasWard:   NC_CRIT.indexOf(SYS_NOTIF.SKL_READY_WARD) !== -1,
      critHasDanger: NC_CRIT.indexOf(AB_NOTIF.AB_DANGER) !== -1,
      critHasQuake:  NC_CRIT.indexOf(AB_NOTIF.AB_QUAKE) !== -1,
      critHasNoMp:   NC_CRIT.indexOf(SYS_NOTIF.SKL_NO_MP) !== -1,
      critHasSale:   NC_CRIT.indexOf(SYS_NOTIF.ECO_SALE) !== -1,
      critHasEye:    NC_CRIT.indexOf(SYS_NOTIF.SKL_READY_EYE) !== -1,
      ver: NC_VER
    }));
    log('  ' + JSON.stringify({ ver: r.ver, sys: r.sysCount, nc: r.ncCount, crit: r.critN }));

    ok('SYS_NOTIF ยังตรึงที่ 25 entry', r.sysCount === 25, 'got ' + r.sysCount);
    const nums = r.sysTags.map(t => t.split(' ').pop()).sort();
    const want = []; for (let i = 1; i <= 25; i++) want.push((i < 10 ? '0' : '') + i + '/25');
    ok('แท็บดรรชนี 01/25-25/25 ครบไม่ซ้ำ', JSON.stringify(nums) === JSON.stringify(want.sort()));
    ok('SYS_NOTIF ทุก entry ยังมีไม่เกิน 6 คีย์', r.sysKeys.every(n => n <= 6), 'max ' + Math.max(...r.sysKeys));
    ok('NC_NOTIF มีสารบัญของตัวเอง 3 รายการ', r.ncCount === 3 && r.ncTags.join(',') === 'NOTIFY 01/03,NOTIFY 02/03,NOTIFY 03/03', r.ncTags.join(','));
    ok('วิกฤต: คอมโบ 5 ข้อ (BTL_COMBO5)', r.critHasCombo);
    ok('วิกฤต: สกิลชุบชีวิตพร้อม (SKL_READY_WARD)', r.critHasWard);
    ok('วิกฤต: HP ต่ำวิกฤต (AB_DANGER)', r.critHasDanger);
    ok('วิกฤต: สตรีคสะเทือน (AB_QUAKE)', r.critHasQuake);
    ok('วิกฤต: มานาไม่พอ (ตอบสนองการกดปุ่ม)', r.critHasNoMp);
    ok('ทั่วไป: ยอดขายไอเทมไม่ใช่วิกฤต', !r.critHasSale);
    ok('ทั่วไป: สกิลอื่นพร้อมใช้ไม่ใช่วิกฤต', !r.critHasEye);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 2) Safe Zone — toast ห้ามทับโจทย์/พินอิน/ตัวเลือก ===');
  for (const [w, h] of [[320, 720], [360, 800], [390, 844], [430, 932], [768, 1024]]) {
    const page = await newPage(browser, w, h);
    await enter(page, 'nc_sz' + w);
    await settle(page);

    /* ยิง toast ทั่วไปแบบไม่มีนาฬิกาเดิน แล้ววัดพิกัดจริง */
    const r = await page.evaluate(async () => {
      const gs = document.getElementById('gameScreen');
      clearQuestionTimer();                       /* ปิดนาฬิกา → toast ทั่วไปผ่านตัวกรอง */
      gs.scrollTop = gs.scrollHeight;             /* เลื่อนสุด — การ์ดโจทย์ติดหนึบบนสุด */
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      sysNotify('ECO_SALE', { item:'🧪 ยาฟื้นพลัง', amount:112, rate:75, gold:900, free:6 });
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));

      const t = document.querySelector('#snLayer .sn');
      if (!t) return { none: true };
      const tr = t.getBoundingClientRect();

      /* วัดว่า toast บัง "ของที่มองเห็นจริง" หรือไม่ — ต้องคิดการซ้อนทับด้วย
         การ์ดโจทย์ติดหนึบมีพื้นทึบ + z-index 6 แถวตัวเลือกที่เลื่อนมุดอยู่ใต้การ์ด
         จึงถูกบังไปแล้วตั้งแต่ต้น เทียบแค่กรอบสี่เหลี่ยมจะได้ผลบวกลวง
         วิธี: ซ่อนชั้น toast ชั่วคราว แล้วยิง elementFromPoint ทั่วพื้นที่ที่ toast ครอบ */
      const PROT = ['gWord', 'gPinyin', 'gQuestion', 'gChoices'];
      const layer = document.getElementById('snLayer');
      const vis = layer.style.visibility;
      layer.style.visibility = 'hidden';
      const covered = {};
      for (let x = tr.left + 2; x < tr.right - 2; x += 6) {
        for (let y = tr.top + 2; y < tr.bottom - 2; y += 6) {
          let el = document.elementFromPoint(x, y);
          while (el) {
            if (PROT.indexOf(el.id) !== -1) { covered[el.id] = true; break; }
            el = el.parentElement;
          }
        }
      }
      layer.style.visibility = vis;

      const pick = id => {
        const e = document.getElementById(id);
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return b.height > 0 ? { id, top: b.top, bottom: b.bottom } : null;
      };
      return {
        toast: { top: tr.top, bottom: tr.bottom, h: tr.height },
        prot: PROT.map(pick).filter(Boolean),
        covered: Object.keys(covered),
        mini: t.classList.contains('sn-mini'),
        band: getComputedStyle(gs).getPropertyValue('--nc-band').trim(),
        count: document.querySelectorAll('#snLayer .sn').length,
        bodyOverflow: document.body.scrollWidth <= window.innerWidth
      };
    });

    if (r.none) { ok('จอ ' + w + ': มี toast ขึ้น', false); await page.context().close(); continue; }
    log('  จอ ' + w + 'x' + h + ' band=' + r.band + ' toast h=' + r.toast.h.toFixed(1) +
        ' bottom=' + r.toast.bottom.toFixed(1) +
        ' prot=' + r.prot.map(p => p.id + '@' + p.top.toFixed(0)).join(',') +
        ' covered=' + (r.covered.join(',') || '-'));
    ok('จอ ' + w + ': toast ไม่บังโซนคำถาม-ตัวเลือกที่มองเห็นอยู่', r.covered.length === 0, r.covered.join(','));
    ok('จอ ' + w + ': แบนเนอร์ทรงคอมแพกต์', r.mini === true);
    ok('จอ ' + w + ': แบนเนอร์สูงไม่เกินแถบปลอดภัย', r.toast.h <= 42, r.toast.h.toFixed(1));
    ok('จอ ' + w + ': ไม่ล้นแนวนอน', r.bodyOverflow);
    ok('จอ ' + w + ': ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 2b) Safe Zone — กวาดทุกตำแหน่งเลื่อน (รวมจอเตี้ยที่ปิด sticky) ===');
  for (const [w, h] of [[390, 844], [360, 800], [390, 620], [390, 600], [640, 420]]) {
    const page = await newPage(browser, w, h);
    await enter(page, 'nc_scan' + w + 'x' + h);
    await settle(page);

    const r = await page.evaluate(async () => {
      const gs = document.getElementById('gameScreen');
      const layer = document.getElementById('snLayer');
      clearQuestionTimer();
      layer.innerHTML = ''; NC_Q = [];
      sysNotify('ECO_SALE', { item:'x', amount:1, rate:75, gold:1, free:1 });
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const t = document.querySelector('#snLayer .sn');
      if (!t) return { none: true };
      const tr = t.getBoundingClientRect();
      const PROT = ['gWord', 'gPinyin', 'gQuestion', 'gChoices'];
      const bad = [];
      const max = gs.scrollHeight - gs.clientHeight;
      const keep = gs.scrollTop;
      for (let s = 0; s <= max; s += 20) {
        gs.scrollTop = s;
        layer.style.visibility = 'hidden';
        const hit = {};
        for (let x = tr.left + 3; x < tr.right - 3; x += 10) {
          for (let y = tr.top + 2; y < tr.bottom - 2; y += 6) {
            let el = document.elementFromPoint(x, y);
            while (el) { if (PROT.indexOf(el.id) !== -1) { hit[el.id] = true; break; } el = el.parentElement; }
          }
        }
        layer.style.visibility = '';
        if (Object.keys(hit).length) bad.push(s + ':' + Object.keys(hit).join('+'));
      }
      gs.scrollTop = keep;
      return { bad, max, sticky: getComputedStyle(document.querySelector('.ac-battle')).position,
               hOverflow: document.body.scrollWidth <= window.innerWidth };
    });
    if (r.none) { ok('จอ ' + w + 'x' + h + ': มี toast ขึ้น', false); await page.context().close(); continue; }
    log('  จอ ' + w + 'x' + h + ' sticky=' + r.sticky + ' ช่วงเลื่อน 0-' + r.max +
        ' ละเมิด=' + (r.bad.length ? r.bad.slice(0, 6).join(' ') : '-'));
    ok('จอ ' + w + 'x' + h + ': ไม่มีตำแหน่งเลื่อนไหนที่ toast บังโจทย์/ตัวเลือก', r.bad.length === 0, r.bad.slice(0, 6).join(' '));
    ok('จอ ' + w + 'x' + h + ': ไม่ล้นแนวนอน', r.hOverflow === true);
    ok('จอ ' + w + 'x' + h + ': ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 3) Mode A — สูงสุด 1 ใบ + อายุ 1.5-2.0 วิ ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_modea');
    await settle(page);

    const r = await page.evaluate(async () => {
      clearQuestionTimer();
      const layer = document.getElementById('snLayer');
      layer.innerHTML = '';
      NC_Q = [];                      /* คิวที่ค้างจากตอนเริ่มเกมจะไหลออกมาระหว่างรอ ถ้าไม่ล้างก่อน */
      sysNotify('ECO_SALE', { item:'A', amount:1, rate:75, gold:1, free:1 });
      sysNotify('ECO_SALE', { item:'B', amount:2, rate:75, gold:1, free:1 });
      sysNotify('INV_DROP_RATE', { rate:35, zone:'โซน 1', floor:1 });
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const after = layer.querySelectorAll('.sn:not(.sn-out)').length;
      const txt = (layer.querySelector('.sn-title') || {}).textContent || '';
      return { after, txt, life: NC_LIFE, lifeCrit: NC_LIFE_CRIT, max: NC_MAX_GAME };
    });
    log('  ' + JSON.stringify(r));
    ok('ในหน้าเล่นเกมเหลือ toast 1 ใบ', r.after === 1, 'got ' + r.after);
    ok('ใบใหม่แทนใบเก่า (เห็นใบล่าสุด)', /เรทเซน|ดรอป/.test(r.txt), r.txt.slice(0, 40));
    ok('อายุ toast อยู่ในช่วง 1.5-2.0 วิ', r.life >= 1500 && r.life <= 2000 && r.lifeCrit >= 1500 && r.lifeCrit <= 2000, r.life + '/' + r.lifeCrit);

    /* จางหายเองจริง */
    await page.waitForTimeout(2400);
    const gone = await page.evaluate(() => ({
      n: document.querySelectorAll('#snLayer .sn').length,
      txt: [...document.querySelectorAll('#snLayer .sn-title')].map(e => e.textContent).join(' / ')
    }));
    ok('จางหายเองหลังหมดอายุ', gone.n === 0, 'เหลือ ' + gone.n + ' ' + gone.txt);

    /* นอกหน้าเล่นเกม (หน้าเกท) ยังใช้ toast เต็มใบ + ซ้อนได้ 3 */
    await page.evaluate(() => exitGame());
    await page.waitForTimeout(500);
    const outg = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      layer.innerHTML = '';
      sysNotify('ECO_SALE', { item:'A', amount:1, rate:75, gold:1, free:1 });
      sysNotify('ECO_SALE', { item:'B', amount:2, rate:75, gold:1, free:1 });
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      return { n: layer.querySelectorAll('.sn').length,
               mini: !!layer.querySelector('.sn-mini'),
               body: !!layer.querySelector('.sn-body') };
    });
    log('  นอกเกม: ' + JSON.stringify(outg));
    ok('นอกหน้าเล่นเกมยังซ้อนได้ >1 ใบ', outg.n > 1, 'got ' + outg.n);
    ok('นอกหน้าเล่นเกมยังเป็น toast เต็มใบ', outg.mini === false && outg.body === true);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 4) Smart Critical Filter ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_filter');
    await settle(page);

    const r = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      const wait = () => new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const out = {};

      clearQuestionTimer(); startQuestionTimer();
      out.timerLive = !!QUESTION_TIMER;

      /* ทั่วไประหว่างนาฬิกาเดิน → ต้องถูกกักคิว */
      layer.innerHTML = ''; NC_Q = [];
      sysNotify('ECO_SALE', { item:'A', amount:1, rate:75, gold:1, free:1 });
      await wait();
      out.generalShown = layer.querySelectorAll('.sn').length;
      out.queued = NC_Q.length;

      /* วิกฤตระหว่างนาฬิกาเดิน → ต้องผ่าน */
      layer.innerHTML = '';
      sysNotify('BTL_COMBO5', { streak:5, bonusMp:15, best:5, per:5 });
      await wait();
      out.critShown = layer.querySelectorAll('.sn').length;
      out.critClass = !!layer.querySelector('.sn.nc-crit');

      /* หมดข้อ → คิวต้องถูกปล่อย */
      layer.innerHTML = '';
      NC_LAST_AT = 0;
      clearQuestionTimer();
      await new Promise(r2 => setTimeout(r2, 700));
      out.flushed = layer.querySelectorAll('.sn').length;
      out.queueLeft = NC_Q.length;
      return out;
    });
    log('  ' + JSON.stringify(r));
    ok('นาฬิกาเดินอยู่จริงก่อนทดสอบ', r.timerLive === true);
    ok('Toast ทั่วไปถูกกักไว้ระหว่างนาฬิกาเดิน', r.generalShown === 0 && r.queued === 1, 'shown=' + r.generalShown + ' q=' + r.queued);
    ok('Toast วิกฤตผ่านได้ระหว่างนาฬิกาเดิน', r.critShown === 1, 'got ' + r.critShown);
    ok('ใบวิกฤตติดคลาส nc-crit', r.critClass === true);
    ok('คิวถูกปล่อยหลังข้อจบ', r.flushed === 1 && r.queueLeft === 0, 'shown=' + r.flushed + ' q=' + r.queueLeft);

    /* ตัวจับเวลาของคิวต้องดับตัวเองเมื่อคิวหมด (กับดักข้อ 22) */
    const pump = await page.evaluate(() => NC_PUMP);
    ok('ตัวจับเวลาคิวดับเองเมื่อคิวหมด', pump === 0, 'NC_PUMP=' + pump);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 5) สวิตช์ 3 ระดับ + localStorage ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_mode');
    await settle(page);

    const r = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      const wait = () => new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const out = { steps: [] };
      clearQuestionTimer();

      for (const m of ['all', 'crit', 'off']) {
        ncSetMode(m);
        layer.innerHTML = '';
        sysNotify('ECO_SALE', { item:'A', amount:1, rate:75, gold:1, free:1 });
        await wait();
        const gen = layer.querySelectorAll('.sn').length;
        layer.innerHTML = '';
        sysNotify('BTL_COMBO5', { streak:5, bonusMp:15, best:5, per:5 });
        await wait();
        const crit = layer.querySelectorAll('.sn').length;
        out.steps.push({ m, gen, crit,
                         store: localStorage.getItem('yao_notify'),
                         band: getComputedStyle(document.getElementById('gameScreen')).getPropertyValue('--nc-band').trim(),
                         bell: (document.getElementById('ncBell') || {}).textContent });
      }

      /* Gate ต้องขึ้นทุกโหมด แม้โหมดปิดทั้งหมด */
      ncSetMode('off');
      sysNotify('ECO_PRICEY', { name:'📜 ม้วนคัมภีร์', price:500 });
      await wait();
      out.gateOnWhenOff = document.getElementById('snGate').classList.contains('active');
      snGateConfirm();
      ncSetMode('all');
      return out;
    });
    r.steps.forEach(s => log('  ' + JSON.stringify(s)));
    const [a, c, o] = r.steps;
    ok('🔔 ALL ON: เห็นทั้งทั่วไปและวิกฤต', a.gen === 1 && a.crit === 1);
    ok('⚠️ CRITICAL ONLY: ซ่อนทั่วไป เหลือวิกฤต', c.gen === 0 && c.crit === 1);
    ok('🔕 ALL OFF: ซ่อนทั้งหมด', o.gen === 0 && o.crit === 0);
    ok('บันทึกโหมดลง localStorage', a.store === 'all' && c.store === 'crit' && o.store === 'off');
    ok('ไอคอนกระดิ่งเปลี่ยนตามโหมด', a.bell === '🔔' && c.bell === '⚠️' && o.bell === '🔕', [a.bell, c.bell, o.bell].join(','));
    ok('โหมดปิดทั้งหมดคืนแถบปลอดภัยให้เกม', o.band === '0px' && a.band === '42px', a.band + '/' + o.band);
    ok('Gate ยังบังคับขึ้นแม้โหมดปิดทั้งหมด', r.gateOnWhenOff === true);

    /* ปุ่มกระดิ่งวนโหมดได้ + อยู่ในแถบหัวหน้าจอเล่น */
    const bell = await page.evaluate(() => {
      const b = document.getElementById('ncBell');
      const before = NC_MODE;
      b.click();
      return { before, after: NC_MODE, inHeader: !!b.closest('.g-topbar'), visible: b.getBoundingClientRect().width > 0 };
    });
    log('  bell ' + JSON.stringify(bell));
    ok('ปุ่มกระดิ่งวนโหมดได้', bell.before !== bell.after, bell.before + '->' + bell.after);
    ok('ปุ่มกระดิ่งอยู่ในแถบหัวหน้าจอเล่น', bell.inHeader && bell.visible);

    /* จำค่าข้ามการรีโหลดหน้า */
    await page.evaluate(() => ncSetMode('crit'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const kept = await page.evaluate(() => NC_MODE);
    ok('จำโหมดไว้ข้ามการรีโหลด', kept === 'crit', kept);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 6) Notification Batching (MP พร้อมใช้) ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_batch');
    await settle(page);

    const r = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      const wait = () => new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      clearQuestionTimer();
      G.maxFloor = FLOOR_MAX; recalcStats();
      const out = {};

      /* หลายสกิลพร้อมพร้อมกัน → ใบเดียว */
      SN_MP_SEEN = {}; G.skillCd = {}; G.mp = maxMpOf(G);
      layer.innerHTML = '';
      snCheckMpReady();
      await wait();
      out.manyN = layer.querySelectorAll('.sn').length;
      out.manyTitle = (layer.querySelector('.sn-title') || {}).textContent || '';
      out.manyTag = (layer.querySelector('.sn-tag') || {}).textContent || '';

      /* สกิลเดียวพร้อม → ต้องคงดรรชนีเดิม 17-20/25 */
      SN_MP_SEEN = {}; G.skillCd = {}; G.mp = 40;   /* พอสำหรับ eye (35) เท่านั้น */
      layer.innerHTML = '';
      snCheckMpReady();
      await wait();
      out.oneN = layer.querySelectorAll('.sn').length;
      out.oneTag = (layer.querySelector('.sn-tag') || {}).textContent || '';
      out.oneTitle = (layer.querySelector('.sn-title') || {}).textContent || '';

      /* edge-trigger ยังทำงาน — เรียกซ้ำต้องไม่ยิงใหม่ */
      layer.innerHTML = '';
      snCheckMpReady(); snCheckMpReady();
      await wait();
      out.repeat = layer.querySelectorAll('.sn').length;
      return out;
    });
    log('  ' + JSON.stringify(r));
    ok('สกิลพร้อมหลายตัว → รวบเป็น toast ใบเดียว', r.manyN === 1, 'got ' + r.manyN);
    ok('หัวข้อรวบเป็น "สกิลพร้อมใช้งาน [.. / ..]"', /สกิลพร้อมใช้งาน \[.+ \/ .+\]/.test(r.manyTitle), r.manyTitle);
    ok('ใบรวบใช้ดรรชนีของชั้นนี้ (03/03)', r.manyTag === '03/03', r.manyTag);
    ok('สกิลพร้อมตัวเดียว → คงดรรชนีเดิม 20/25', r.oneN === 1 && r.oneTag === '20/25', r.oneTag);
    ok('edge-trigger ยังกันแจ้งซ้ำ', r.repeat === 0, 'got ' + r.repeat);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 7) เตือนเวลาใกล้หมด 3 วิ + เกราะ/ชุบชีวิต ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_low');
    await settle(page);

    /* บีบเวลาให้เหลือ 3.2 วิ แล้วรอ */
    const r = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      layer.innerHTML = '';
      clearQuestionTimer(); startQuestionTimer();
      QUESTION_ENDS = Date.now() + 3400;
      ncDisarmLow(); ncLowTick();
      await new Promise(r2 => setTimeout(r2, 900));
      const t = layer.querySelector('.sn-title');
      return { n: layer.querySelectorAll('.sn').length,
               txt: t ? t.textContent : '',
               tag: (layer.querySelector('.sn-tag') || {}).textContent || '',
               fired: NC_LOW_FIRED };
    });
    log('  timelow ' + JSON.stringify(r));
    ok('เตือนเวลาใกล้หมดยิงตอนเหลือ ~3 วิ', r.n === 1 && /เหลือเวลาอีก/.test(r.txt), r.txt);
    ok('ใช้ดรรชนี NOTIFY 01/03', r.tag === '01/03', r.tag);

    /* ต้องยิงครั้งเดียวต่อข้อ */
    const twice = await page.evaluate(async () => {
      document.getElementById('snLayer').innerHTML = '';
      ncLowTick();
      await new Promise(r2 => setTimeout(r2, 300));
      return document.querySelectorAll('#snLayer .sn').length;
    });
    ok('เตือนเวลาใกล้หมดยิงครั้งเดียวต่อข้อ', twice === 0, 'got ' + twice);

    /* ข้อใหม่ = ธงต้องถูกล้าง */
    const reset = await page.evaluate(() => { startQuestionTimer(); return { fired: NC_LOW_FIRED, armed: NC_LOW_T !== 0 }; });
    ok('ขึ้นข้อใหม่แล้วธงเตือนเวลาถูกล้าง', reset.fired === false && reset.armed === true, JSON.stringify(reset));

    /* 🛡️ ประกันภัยฮันเตอร์ทำงาน */
    const ins = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      layer.innerHTML = '';
      clearQuestionTimer();
      G.maxFloor = FLOOR_MAX; recalcStats();
      G.items = { insurance: 2 };
      G.hp = 1; G.shield = 0;
      CD_ST.noHeal = 0;
      const before = G.items.insurance;
      onHunterDown();
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      return { before, after: G.items.insurance,
               n: layer.querySelectorAll('.sn').length,
               txt: (layer.querySelector('.sn-title') || {}).textContent || '',
               tag: (layer.querySelector('.sn-tag') || {}).textContent || '' };
    });
    log('  insurance ' + JSON.stringify(ins));
    ok('ประกันภัยทำงานแล้วมีแจ้งเตือน', ins.after === ins.before - 1 && ins.n === 1 && /ประกันภัย/.test(ins.txt), JSON.stringify(ins));
    ok('ใช้ดรรชนี NOTIFY 02/03', ins.tag === '02/03', ins.tag);

    /* เกราะเพิ่งตั้งขึ้น */
    const sh = await page.evaluate(async () => {
      const layer = document.getElementById('snLayer');
      layer.innerHTML = '';
      NC_SHIELD_SEEN = 0; G.shield = 0; renderStats();
      layer.innerHTML = '';
      G.shield = 30; renderStats();
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const first = layer.querySelectorAll('.sn').length;
      layer.innerHTML = '';
      renderStats(); renderStats();
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      return { first, repeat: layer.querySelectorAll('.sn').length };
    });
    log('  shield ' + JSON.stringify(sh));
    ok('เกราะตั้งขึ้นแล้วแจ้งเตือน 1 ครั้ง', sh.first === 1, 'got ' + sh.first);
    ok('เกราะเดิมไม่แจ้งซ้ำ (edge-trigger)', sh.repeat === 0, 'got ' + sh.repeat);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 8) ไม่ทำของเดิมพัง (v4.8.1 + เลย์เอาต์) ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_regress');
    await settle(page);

    const r = await page.evaluate(async () => {
      const gs = document.getElementById('gameScreen');
      const wait = () => new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      const out = {};

      /* ปลดล็อกแรงค์ก่อน ไม่งั้น openShop จะเปิด #gLock (หน้าต่างฟีเจอร์ล็อก) แทนร้านค้า
         แล้ว closeShop() ปิดไม่ลง เกมค้างหยุดอยู่ — เทสต์จะตกด้วยเหตุผลผิด */
      G.maxFloor = FLOOR_MAX; recalcStats();

      /* หยุดเวลาด้วยปุ่ม ⏸️ ยังทำงาน */
      clearQuestionTimer(); startQuestionTimer();
      out.liveBefore = !!QUESTION_TIMER;
      acTogglePause();
      out.pausedTimer = QUESTION_TIMER === null && QUESTION_TICK === null;
      out.mask = gs.classList.contains('ac-mask');
      out.veil = document.getElementById('acVeil').classList.contains('active');
      acResumeClick();
      await wait();
      out.resumed = !!QUESTION_TIMER;

      /* เปิดหน้าต่างระบบยังหยุดเวลาให้ */
      openShop();
      await wait();
      out.shopOpened = [...document.querySelectorAll('.g-modal.active')].map(e => e.id).join(',');
      out.shopPaused = QUESTION_TIMER === null;
      closeShop();
      await wait();
      out.shopResumed = !!QUESTION_TIMER;

      /* การ์ดโจทย์ยังติดหนึบ + ตัวเลือกยังเห็นพร้อมโจทย์ */
      gs.scrollTop = gs.scrollHeight;
      await wait();
      const card = document.querySelector('.ac-battle');
      out.sticky = getComputedStyle(card).position;
      out.cardTop = card.getBoundingClientRect().top;
      out.band = parseFloat(getComputedStyle(gs).getPropertyValue('--nc-band')) || 0;
      const wr = document.getElementById('gWord').getBoundingClientRect();
      out.wordVisible = wr.top >= 0 && wr.bottom <= window.innerHeight;

      /* กลับมาที่โจทย์ก่อนแล้วค่อยวัดตัวเลือก — เลื่อนสุดจอคือสภาพ "ละจากโซนคำถาม"
         ซึ่ง v4.8.1 ตั้งใจให้หยุดเวลาและเบลอโจทย์อยู่แล้ว ไม่ใช่สภาพที่ต้องเห็นตัวเลือกครบ */
      acFocusQa();
      await wait();
      const cr = document.getElementById('gChoices').getBoundingClientRect();
      out.choiceVis = (Math.min(cr.bottom, window.innerHeight) -
                       Math.max(cr.top, card.getBoundingClientRect().bottom)) / cr.height;
      out.bodyLocked = document.body.scrollHeight <= window.innerHeight + 1;
      out.noHOverflow = document.body.scrollWidth <= window.innerWidth;
      return out;
    });
    log('  ' + JSON.stringify(r));
    ok('ปุ่ม ⏸️ ยังหยุดนาฬิกาได้', r.liveBefore && r.pausedTimer && r.mask && r.veil);
    ok('กดเล่นต่อแล้วนาฬิกาเดินต่อ', r.resumed === true);
    ok('เปิด/ปิดร้านค้ายังหยุด-เดินต่อถูก',
       r.shopOpened === 'gShop' && r.shopPaused === true && r.shopResumed === true, 'opened=' + r.shopOpened);
    ok('การ์ดโจทย์ยังติดหนึบ', r.sticky === 'sticky', r.sticky);
    ok('การ์ดโจทย์ติดที่ใต้แถบปลอดภัยพอดี', Math.abs(r.cardTop - r.band) < 2, 'cardTop=' + r.cardTop.toFixed(1) + ' band=' + r.band);
    ok('โจทย์จีนยังอยู่ในจอหลังเลื่อนสุด', r.wordVisible === true);
    ok('ตัวเลือกยังเห็นเกิน 60% พร้อมโจทย์', r.choiceVis >= 0.6, r.choiceVis.toFixed(2));
    ok('body ยังไม่เลื่อน (Viewport Lock)', r.bodyLocked === true);
    ok('ไม่ล้นแนวนอน', r.noHOverflow === true);

    /* acFocusQa ยังดึงจอกลับมาที่โจทย์ได้ครบ */
    const focus = await page.evaluate(async () => {
      const gs = document.getElementById('gameScreen');
      gs.scrollTop = gs.scrollHeight;
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      startQuestionTimer();                       /* เรียก acFocusQa ข้างใน */
      await new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
      return { visible: acQaVisible(), paused: acPaused() };
    });
    log('  focusQa ' + JSON.stringify(focus));
    ok('ขึ้นข้อใหม่แล้วจอกลับมาที่โจทย์ (ไม่เริ่มมาในสภาพหยุด)', focus.visible === true && focus.paused === false);

    /* แผงตั้งค่าในแผงสถานะ + ไม่แทรกซ้ำ */
    const set = await page.evaluate(async () => {
      renderStatus(); renderStatus(); renderStatus();
      const b = document.getElementById('gStatusBody');
      return { blocks: b.querySelectorAll('.nc-set').length, opts: b.querySelectorAll('.nc-opt').length,
               on: b.querySelectorAll('.nc-opt.on').length };
    });
    log('  settings ' + JSON.stringify(set));
    ok('แผงตั้งค่ามีชุดเดียว ไม่แทรกซ้ำ (กับดักข้อ 2)', set.blocks === 1, 'got ' + set.blocks);
    ok('มีตัวเลือกครบ 3 ระดับ และเลือกอยู่ 1', set.opts === 3 && set.on === 1);

    /* ต้นทุน MutationObserver ของ v4.8.1 ยังเป็น 0 */
    const cost = await page.evaluate(async () => {
      /* ตั้งนาฬิกาให้เรียบร้อยก่อนค่อยเริ่มนับ — startQuestionTimer ของ v4.8.1
         เรียก acSync(true) เองหนึ่งครั้งโดยชอบธรรม ไม่ใช่การถูกปลุกฟรี */
      clearQuestionTimer(); startQuestionTimer();
      await new Promise(r2 => setTimeout(r2, 250));
      let n = 0;
      const real = acSync;
      acSync = function () { n++; return real.apply(this, arguments); };
      await new Promise(r2 => setTimeout(r2, 5000));
      acSync = real;
      return n;
    });
    ok('acSync ยังไม่ถูกปลุกฟรีระหว่างเล่น 5 วิ', cost === 0, 'got ' + cost);
    ok('ไม่มี pageerror', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  // ══════════════════════════════════════════════════════════
  log('\n=== 9) เล่นจริง — ไต่หอคอยด้วยการกดปุ่ม ===');
  {
    const page = await newPage(browser);
    await enter(page, 'nc_play');
    let steps = 0;
    for (let i = 0; i < 30; i++) {
      const st = await page.evaluate(() => ({
        draft: !!(document.getElementById('cdDraft') || {}).classList &&
               document.getElementById('cdDraft').classList.contains('active'),
        gate: document.getElementById('snGate').classList.contains('active'),
        warp: !!G.warpOpen,
        locked: G.locked,
        mon: !!G.currentMonster,
        paused: acPaused()
      }));
      if (st.draft) { await page.evaluate(() => document.querySelector('#cdDraft .cd-card').click()); await page.waitForTimeout(800); continue; }
      if (st.gate) { await page.evaluate(() => snGateConfirm()); await page.waitForTimeout(300); continue; }
      if (st.warp) { await page.evaluate(() => warpGo()); await page.waitForTimeout(600); continue; }
      if (st.locked || !st.mon) { await page.waitForTimeout(250); continue; }
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('#gChoices .g-choice')]
          .filter(x => x.dataset.choice === G.currentMonster.answer)[0];
        if (b) b.click();
      });
      steps++;
      await page.waitForTimeout(500);
    }
    const fin = await page.evaluate(() => ({
      floor: G.floor, correct: G.correct, toasts: document.querySelectorAll('#snLayer .sn').length,
      hOverflow: document.body.scrollWidth <= window.innerWidth
    }));
    log('  ' + JSON.stringify({ steps, ...fin }));
    ok('เล่นจริงได้และตอบถูกสะสมขึ้น', fin.correct > 0, 'correct=' + fin.correct);
    ok('ระหว่างเล่นมี toast ไม่เกิน 1 ใบ', fin.toasts <= 1, 'got ' + fin.toasts);
    ok('เล่นจริงแล้วไม่ล้นแนวนอน', fin.hOverflow === true);
    ok('ไม่มี pageerror ระหว่างเล่นจริง', page._errs.length === 0, page._errs.join(' | '));
    await page.context().close();
  }

  await browser.close();
  log('\n══════════════════════════════════');
  log('  PASS ' + PASS + '   FAIL ' + FAIL);
  log('══════════════════════════════════');
  console.log(fs.readFileSync(LOG, 'utf8'));
  process.exit(FAIL ? 1 : 0);
})().catch(e => { log('CRASH: ' + (e && e.stack || e)); console.log(fs.readFileSync(LOG, 'utf8')); process.exit(2); });
