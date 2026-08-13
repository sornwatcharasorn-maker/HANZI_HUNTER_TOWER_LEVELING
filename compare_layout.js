/* compare_layout.js — พิสูจน์ว่า "ย่อไฟล์แล้วเลย์เอาต์ไม่ขยับแม้แต่พิกเซลเดียว"
   NODE_PATH=/opt/node22/lib/node_modules node compare_layout.js

   ชุดเทสต์ทั้ง 10 ชุดพิสูจน์ "กลไก" แต่ไม่ได้พิสูจน์ "การวางตัวบนจอ"
   ส่วนที่ย่อ HTML/CSS จึงต้องมีตัววัดของมันเอง

   วิธีวัด: เปิดต้นฉบับกับไฟล์แจกด้วยเงื่อนไขเดียวกันเป๊ะ (สุ่มถูกล็อกด้วย Math.random ปลอม)
   แล้วเทียบ getBoundingClientRect + computed style ของ **ทุก element ในหน้า** ทีละตัว
   ผ่านทั้ง 3 ฉาก × 5 ความกว้าง                                                        */
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const SRC  = 'file://' + path.resolve(__dirname, 'src/hanzi_hunter_tower_v3_1_intro.src.html');
const DIST = 'file://' + path.resolve(__dirname, 'hanzi_hunter_tower_v3_1_intro.html');
const WIDTHS = [320, 360, 390, 430, 768];

/* ล็อกทุกอย่างที่ไม่แน่นอน: สุ่ม · เวลา · เน็ต — ไม่งั้นสองฝั่งจะต่างกันเพราะเหตุอื่น */
const STUB = `
  (function () {
    let s = 12345;
    Math.random = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const _f = window.fetch;
    window.fetch = function (u) {
      if (/firebasedatabase\\.app|supabase/.test(String(u)))
        return Promise.resolve(new Response('{}', { status: 200 }));
      return _f.apply(this, arguments);
    };
    window.EventSource = function () { this.readyState = 1; this.close = function () {}; };
  })();
`;

/* เก็บ "รูปร่างของหน้า" ทั้งใบ — ตำแหน่ง ขนาด และสไตล์ที่มีผลต่อการมองเห็น
   ⚠️ ต้องแช่อนิเมชันก่อนวัดเสมอ — ไฟล์นี้มีอนิเมชันวิ่งตลอดเวลาหลายตัว
   (จุดสถานะกะพริบ `.sn-dot` · มาสคอตลอยขึ้นลง `.intro-mascot`)
   ถ้าไม่แช่ สองฝั่งจะถูกวัดคนละเสี้ยววินาที แล้ว opacity/transform ต่างกันที่ทศนิยมตำแหน่งท้าย ๆ
   ซึ่งไม่ใช่เลย์เอาต์ขยับ แต่จะทำให้ผลเทียบเต็มไปด้วยสัญญาณลวง */
const SNAP = `(() => {
  let f = document.getElementById('__freeze');
  if (!f) {
    f = document.createElement('style');
    f.id = '__freeze';
    f.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.appendChild(f);
  }
  const out = [];
  const all = document.querySelectorAll('*');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const c = getComputedStyle(el);
    out.push([
      el.tagName, el.id || '', (el.className && el.className.baseVal !== undefined
        ? el.className.baseVal : String(el.className || '')),
      Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100,
      Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100,
      c.display, c.position, c.fontSize, c.fontWeight, c.color, c.backgroundColor,
      c.margin, c.padding, c.borderWidth, c.zIndex, c.opacity, c.overflow,
      c.flexDirection, c.gridTemplateColumns, c.textAlign, c.whiteSpace, c.transform
    ].join('|'));
  }
  return {
    n: all.length,
    scrollW: document.body.scrollWidth,
    innerW: window.innerWidth,
    rows: out
  };
})()`;

async function scenes(url, width) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  await page.route('**fonts.googleapis.com**', r => r.abort());
  await page.route('**fonts.gstatic.com**', r => r.abort());
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const got = {};
  got.rules = await page.evaluate(SNAP);                    /* ฉาก 1 · ป๊อปอัปกติกา v5.6 */

  /* ฉาก 2 · หน้าเกท (ล็อกอิน) */
  await page.evaluate(() => {
    const b = document.getElementById('rgBody'); if (b) b.scrollTop = b.scrollHeight;
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    try { rgScrollCheck(); } catch (e) {}
    if (typeof rgAck === 'function') rgAck(); else enterGate();
  });
  await page.waitForTimeout(900);
  got.gate = await page.evaluate(SNAP);

  /* ฉาก 3 · ในเกม ชั้น 1 (หน้าต่างจั่วการ์ดของ v4.7 เปิดอยู่ — เป็นฉากที่ตึงที่สุดของเลย์เอาต์) */
  await page.evaluate(() => {
    switchTab('register');
    document.getElementById('reg-id').value = 'layoutcmp';
    document.getElementById('reg-pw').value = '123456';
    document.getElementById('reg-pw2').value = '123456';
    handleSubmit();
  });
  await page.waitForTimeout(1200);
  got.draft = await page.evaluate(SNAP);

  /* ฉาก 4 · จอต่อสู้จริง หลังเลือกการ์ดใบแรก */
  await page.evaluate(() => {
    const c = document.querySelector('#cdDraft .cd-card'); if (c) c.click();
  });
  await page.waitForTimeout(1400);
  got.battle = await page.evaluate(SNAP);

  got.errs = errs;
  await browser.close();
  return got;
}

(async () => {
  let bad = 0, checked = 0;
  for (const w of WIDTHS) {
    const a = await scenes(SRC, w);
    const b = await scenes(DIST, w);
    for (const scene of ['rules', 'gate', 'draft', 'battle']) {
      const A = a[scene], B = b[scene];
      checked++;
      const head = `w=${w} ${scene}`;
      if (A.n !== B.n) { console.log(`❌ ${head}: จำนวน element ต่างกัน ${A.n} → ${B.n}`); bad++; continue; }
      if (A.scrollW !== B.scrollW) { console.log(`❌ ${head}: scrollWidth ${A.scrollW} → ${B.scrollW}`); bad++; continue; }
      if (B.scrollW > B.innerW) { console.log(`❌ ${head}: ไฟล์แจกล้นแนวนอน ${B.scrollW} > ${B.innerW}`); bad++; continue; }
      let diff = 0, first = null;
      for (let i = 0; i < A.rows.length; i++) {
        if (A.rows[i] !== B.rows[i]) { diff++; if (!first) first = { i, a: A.rows[i], b: B.rows[i] }; }
      }
      if (diff) {
        console.log(`❌ ${head}: ต่างกัน ${diff}/${A.n} element`);
        console.log('   ต้นฉบับ : ' + first.a);
        console.log('   ไฟล์แจก : ' + first.b);
        bad++;
      } else {
        console.log(`✅ ${head}: ตรงกันครบ ${A.n} element (scrollWidth ${A.scrollW})`);
      }
    }
    if (a.errs.length || b.errs.length) {
      console.log(`   pageerror ต้นฉบับ ${a.errs.length} · ไฟล์แจก ${b.errs.length}`);
      if (b.errs.length > a.errs.length) { console.log('   ' + b.errs.join(' | ')); bad++; }
    }
  }
  console.log(`\n${bad ? '❌' : '✅'} ฉากที่เทียบ ${checked} · ต่างกัน ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
