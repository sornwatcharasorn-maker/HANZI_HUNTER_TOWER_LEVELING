/* build_minify.js — ย่อไฟล์ต้นฉบับที่อ่านง่าย ให้กลายเป็นไฟล์แจกจริงที่เล็กที่สุด
   ────────────────────────────────────────────────────────────────────────────
     ต้นฉบับ (แก้ที่นี่)  src/hanzi_hunter_tower_v3_1_intro.src.html
     ไฟล์แจก (ห้ามแก้มือ) hanzi_hunter_tower_v3_1_intro.html

   วิธีใช้
     npm install                 # ครั้งเดียว — ลง terser + clean-css
     node build_minify.js        # ย่อแล้วเขียนทับไฟล์แจก
     node build_minify.js --check  # ดูตัวเลขเฉย ๆ ไม่เขียนทับ
     node build_minify.js --size   # พิมพ์ขนาดไฟล์แจกที่จะได้ (ไบต์) บรรทัดเดียว
                                   # สคริปต์ฝังภาพเรียกโหมดนี้ไปเช็กเพดาน 2MB

   สามอย่างที่สคริปต์นี้ทำ และเหตุผลที่ "ไม่ทำ" อย่างอื่น
   ────────────────────────────────────────────────────────────────────────────
   1) JavaScript → terser (คอมเมนต์ + ช่องว่าง + เปลี่ยนชื่อตัวแปรเฉพาะในฟังก์ชัน)
      **ปิดการอินไลน์ฟังก์ชันทิ้งทั้งหมด** เพราะสถาปัตยกรรม 20 ชั้นของเกมนี้คือ
      `const _x = f; f = function(){...}` ทุกจุดเรียกต้องวิ่งผ่าน binding ตัวจริง
      ถ้า terser เอาเนื้อฟังก์ชันไปแปะที่จุดเรียก ชั้นบนจะห่อไม่ติดทันที
      และเทสต์ที่ทับ `critChance` / `expDoubleChance` ก็จะไม่มีผล — ดู MINIFY_OPTS
   2) CSS ในหัวไฟล์ → clean-css ระดับ 1 (ช่องว่าง/คอมเมนต์/ค่าสั้นลง)
      **ไม่ใช้ระดับ 2** เพราะมันจัดกลุ่ม/สลับลำดับกฎ ซึ่งเปลี่ยนลำดับ cascade ได้
   3) HTML → ตัดคอมเมนต์ + ยุบช่องว่าง
      **ยุบเหลือ 1 ตัวอักษรเสมอ ไม่เคยลบทิ้งหมด** เพราะช่องว่างระหว่าง element
      แบบ inline เรนเดอร์เป็นเว้นวรรค 1 ที่ ลบหมดแล้วเลย์เอาต์ขยับ

   ที่ไม่แตะเลย: base64 ของรูปทั้ง 31 ก้อน (ตรวจสอบว่าครบเป๊ะทุกครั้งหลังย่อ)   */

'use strict';
const fs   = require('fs');
const path = require('path');

const HERE = __dirname;
const SRC  = path.join(HERE, 'src', 'hanzi_hunter_tower_v3_1_intro.src.html');
const DIST = path.join(HERE, 'hanzi_hunter_tower_v3_1_intro.html');
const BUDGET = 2000000;            /* เพดานตาม CLAUDE.md = 2,000,000 ไบต์ ไม่ใช่ 2 MiB */

let terser, CleanCSS;
try {
  terser   = require('terser');
  CleanCSS = require('clean-css');
} catch (e) {
  console.error('ขาดเครื่องมือ — สั่ง `npm install` ในโฟลเดอร์ repo ก่อน (terser + clean-css)');
  process.exit(1);
}

/* ตัวเลือกของ terser — ทุกบรรทัดที่ปิดไว้มีเหตุผล อย่าเปิดโดยไม่รันชุดเทสต์ครบ 10 ชุด */
const MINIFY_OPTS = {
  ecma: 2020,
  compress: {
    inline:        false,   /* ⭐ ห้ามเอาเนื้อฟังก์ชันไปแปะที่จุดเรียก — ชั้นบนจะห่อไม่ติด */
    reduce_funcs:  false,   /* ⭐ ด้วยเหตุผลเดียวกัน */
    reduce_vars:   false,   /* ⭐ ห้ามแทนค่าตัวแปรที่โค้ด/เทสต์ทับทีหลังได้ */
    evaluate:      false,   /* ⭐ ด้วยเหตุผลเดียวกัน */
    collapse_vars: false,
    unused:        false,   /* ห้ามลบของที่ "ดูเหมือนไม่ถูกใช้" — เทสต์เรียกผ่าน global */
    toplevel:      false,   /* ห้ามแตะสิ่งที่ประกาศไว้ระดับบนสุด */
    keep_fargs:    true
  },
  mangle: {
    toplevel: false         /* ⭐ ชื่อระดับบนสุดต้องคงเดิม — inline onclick / เทสต์ / wrapper อ่านจากชื่อ */
  },
  format: {
    comments: false,
    inline_script: true     /* หนี `</script` ในสตริงให้ ไม่งั้น HTML ขาดกลางคัน */
  }
};

/* ── ยุบช่องว่างของ HTML แบบไม่ทำให้เลย์เอาต์ขยับ ─────────────────────────────
   สแกนเอง ไม่ใช้ regex ก้อนเดียว เพราะ `>` โผล่ในค่าแอตทริบิวต์ได้ (onclick="a>b")
   • คอมเมนต์ HTML — ตัดทิ้ง
   • เนื้อในแท็ก — คัดลอกดิบ ๆ ไม่แตะ (กันไปยุ่งกับ JS ใน onclick)
   • เนื้อความ — ยุบช่องว่างติดกันให้เหลือตัวเดียว (\n ถ้ามีขึ้นบรรทัดใหม่ปนอยู่)     */
function minifyHtml(html) {
  let out = '', i = 0, n = html.length;
  while (i < n) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (html[i] === '<' && /[a-zA-Z\/!?]/.test(html[i + 1] || '')) {
      const tagStart = i;
      i++;
      let quote = 0;
      while (i < n) {                               /* หาปิดแท็กโดยเคารพเครื่องหมายคำพูด */
        const c = html[i];
        if (quote) { if (c === quote) quote = 0; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '>') { i++; break; }
        i++;
      }
      const tag = html.slice(tagStart, i);
      out += tag;
      const nameMatch = /^<\s*([a-zA-Z0-9]+)/.exec(tag);
      const name = nameMatch ? nameMatch[1].toLowerCase() : '';
      if (name === 'style' || name === 'script' || name === 'pre' || name === 'textarea') {
        const close = '</' + name;
        const end = html.toLowerCase().indexOf(close, i);
        const body = html.slice(i, end < 0 ? n : end);
        out += (name === 'style') ? minifyCss(body) : body;
        i = end < 0 ? n : end;
      }
      continue;
    }
    /* เนื้อความ */
    let j = i;
    while (j < n && html[j] !== '<') j++;
    out += html.slice(i, j).replace(/\s+/g, m => (m.indexOf('\n') >= 0 ? '\n' : ' '));
    i = j;
  }
  return out;
}

function minifyCss(css) {
  const r = new CleanCSS({ level: 1, format: false, rebase: false }).minify(css);
  if (r.errors && r.errors.length) throw new Error('CSS: ' + r.errors.join('; '));
  return r.styles;
}

/* ── ตรวจว่าย่อแล้วไม่มีอะไรหาย ────────────────────────────────────────────── */
function dataUris(s) {
  return (s.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g) || []);
}

async function build(srcText) {
  const i = srcText.indexOf('<script');
  const j = srcText.indexOf('>', i) + 1;
  const k = srcText.lastIndexOf('</script>');
  if (i < 0 || k < 0) throw new Error('หาแท็ก <script> ก้อนหลักไม่เจอ');

  const head = srcText.slice(0, i);
  const openTag = srcText.slice(i, j);
  const js = srcText.slice(j, k);
  const tail = srcText.slice(k);

  const res = await terser.minify(js, MINIFY_OPTS);
  if (res.error) throw res.error;

  const out = minifyHtml(head) + openTag + res.code + tail.replace(/\s+$/, '\n');

  /* รูปต้องครบและเหมือนเดิมเป๊ะทุกก้อน */
  const a = dataUris(srcText), b = dataUris(out);
  if (a.length !== b.length) throw new Error('รูปหาย: ต้นฉบับ ' + a.length + ' ก้อน → ได้ ' + b.length);
  for (let x = 0; x < a.length; x++) if (a[x] !== b[x]) throw new Error('รูปก้อนที่ ' + x + ' ไม่เหมือนเดิม');

  /* syntax ของ JS ที่ย่อแล้วต้องผ่าน */
  new Function(res.code);   // eslint-disable-line no-new-func

  return out;
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error('ไม่เจอไฟล์ต้นฉบับ: ' + SRC);
    process.exit(1);
  }
  const srcText = fs.readFileSync(SRC, 'utf8');
  const out = await build(srcText);
  const before = Buffer.byteLength(srcText, 'utf8');
  const after = Buffer.byteLength(out, 'utf8');

  if (process.argv.includes('--size')) { console.log(after); return; }

  const pct = ((1 - after / before) * 100).toFixed(1);
  console.log('ต้นฉบับ  %s ไบต์', before.toLocaleString());
  console.log('ไฟล์แจก  %s ไบต์  (−%s%% · เหลือถึงเพดาน 2,000,000 อีก %s ไบต์)',
    after.toLocaleString(), pct, (BUDGET - after).toLocaleString());

  if (after > BUDGET) {
    console.error('หยุด: ไฟล์แจกทะลุเพดาน 2,000,000 ไบต์');
    process.exit(1);
  }
  if (process.argv.includes('--check')) { console.log('(--check: ไม่ได้เขียนทับไฟล์แจก)'); return; }

  fs.writeFileSync(DIST, out);
  console.log('เขียนแล้ว → ' + path.relative(HERE, DIST));
})().catch(e => { console.error('พัง: ' + (e && e.message || e)); process.exit(1); });
