#!/usr/bin/env python3
"""บีบภาพมาสคอต CHAR_IMG_SRC ให้เล็กลง (ชั้น v4.0 · หน้า intro / เกทล็อกอิน)

    python3 embed_mascot_art.py --q 76        # บีบใหม่ที่คุณภาพ 76
    python3 embed_mascot_art.py --q 46 --w 560 # ย่อความกว้างด้วย (คืนที่ได้เยอะกว่าลดคุณภาพมาก)
    python3 embed_mascot_art.py --q 76 --dry  # ลองดูตัวเลขเฉย ๆ ไม่เขียนทับ

⚠ ต่างจากสคริปต์ฝังภาพอีก 4 ตัวตรงที่ **ไม่มีไฟล์ต้นฉบับอยู่ใน repo**
มาสคอตถูกฝังไว้ตั้งแต่ก่อนมีสคริปต์พวกนี้ และต้นฉบับไม่เคยถูกอัปโหลดขึ้นมา
สคริปต์นี้จึงต้องถอด base64 ที่ฝังอยู่ออกมาบีบซ้ำ = **บีบทับของที่ถูกบีบมาแล้ว**

ผลที่ตามมา 2 ข้อ ต้องรู้ก่อนใช้:
  1. รันซ้ำหลายรอบ คุณภาพจะลดลงสะสมทุกรอบ — ห้ามรันวนเล่น
     ถ้าจะลองหลายคุณภาพ ให้ `git checkout` ไฟล์เกมกลับก่อนทุกครั้ง
  2. ย้อนกลับได้ทางเดียวคือดึงจากประวัติ git
     git show <commit>:hanzi_hunter_tower_v3_1_intro.html > เก่า.html

**ห้ามลดขนาดภาพ (ความกว้าง/สูง) เด็ดขาด — ให้ลดได้แค่คุณภาพ**
มาสคอตถูกใช้ 3 จุดและจุดที่กินความละเอียดสูงสุดไม่ใช่วงกลมหน้า intro:
  · #introImg   วงกลมหน้าแรก        ~208 CSS px (object-fit: cover)
  · #bannerImg  แถบซ้ายของกล่องล็อกอิน  กว้าง 300 CSS px เต็มความสูงกล่อง (จอ > 720px)
  · #badgeImg   ตราบนจอมือถือ         (จอ ≤ 720px)
แถบซ้ายเป็นกล่องสูง ภาพจึงถูกขยายตามความสูงแล้ว crop ข้าง = ใช้ความกว้างจริงราว 370 CSS px
ซึ่งบนจอ DPR 2-3 เท่ากับ 740-1110 พิกเซล ขนาดที่ฝังอยู่ (640) ต่ำกว่านั้นอยู่แล้ว
"""
import base64
import io
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import embed_common
# ตั้งแต่มีขั้นตอนย่อไฟล์ ต้องฝังลง "ต้นฉบับ" เสมอ แล้วสั่งย่อใหม่ปิดท้าย
# (ฝังลงไฟล์แจกตรง ๆ จะถูกการย่อรอบถัดไปทับทิ้ง)
GAME, DIST, ROOT = embed_common.resolve_game(HERE)

# เพดานฝั่งต้นฉบับที่เทียบเท่า 2,000,000 ไบต์ของไฟล์แจก (ดู embed_common.py)
BUDGET_KB = embed_common.budget_kb(GAME, DIST)

MASCOT_RE = re.compile(r'(const CHAR_IMG_SRC = ")data:image/webp;base64,([A-Za-z0-9+/=]+)(")')


def opt_int(argv, flag, default):
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return int(argv[i + 1])
        if a.startswith(flag + '='):
            return int(a.split('=', 1)[1])
    return default


def main(argv):
    q = opt_int(argv, '--q', None)
    if not q:
        sys.exit(__doc__)
    w = opt_int(argv, '--w', None)      # ย่อความกว้างด้วย — ท่าเดียวกับ embed_tower_art.py
    dry = '--dry' in argv

    src = io.open(GAME, encoding='utf-8').read()
    before = len(src.encode('utf-8'))
    m = MASCOT_RE.search(src)
    if not m:
        sys.exit('หา CHAR_IMG_SRC ในไฟล์เกมไม่เจอ — โครงไฟล์ถูกแก้ไปแล้วหรือเปล่า')

    cur = m.group(2)
    im = Image.open(io.BytesIO(base64.b64decode(cur))).convert('RGB')
    src_size = im.size
    # ── ย่อความกว้าง (ถ้าสั่ง) ────────────────────────────────────────────────
    # มาสคอตถูกวางด้วย object-fit:cover ในกรอบขนาดตายตัวทั้งสามจุดที่ใช้
    # (วงแหวนหน้า intro · ตราบนมือถือ · แบนเนอร์ฝั่งซ้ายบนเดสก์ท็อป)
    # **สัดส่วนภาพไม่เปลี่ยน** เพราะย่อทั้งสองแกนตามกัน เลย์เอาต์จึงไม่ขยับ
    # และคืนที่ได้เยอะกว่าการลดคุณภาพมาก (บทเรียนเดียวกับ --w ของ embed_tower_art.py)
    if w and w < im.size[0]:
        im = im.resize((w, round(im.size[1] * w / float(im.size[0]))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    raw = buf.getvalue()
    b64 = base64.b64encode(raw).decode()

    print('มาสคอต %dx%d → %dx%d · base64 %.1f KB → %.1f KB (q%d)'
          % (src_size[0], src_size[1], im.size[0], im.size[1],
             len(cur) / 1024, len(b64) / 1024, q))
    if len(b64) >= len(cur):
        sys.exit('หยุด: บีบแล้วไม่เล็กลง — ของเดิมถูกบีบมาต่ำกว่านี้แล้ว')

    # group(2) คือตัว base64 ล้วน — คำนำหน้า data:image/webp;base64, อยู่นอกกลุ่มและยังอยู่ในไฟล์แล้ว
    # ถ้าเติมคำนำหน้าซ้ำตรงนี้จะได้ 'data:image/webp;base64,data:image/webp;base64,...' = ภาพเสียเงียบ ๆ
    out = src[:m.start(2)] + b64 + src[m.end(2):]
    after = len(out.encode('utf-8'))
    print('ไฟล์เกม %.0f KB → %.0f KB (เพดาน %d KB)' % (before / 1024, after / 1024, BUDGET_KB))
    if after / 1024 > BUDGET_KB:
        sys.exit('หยุด: ไฟล์รวมทะลุเพดานแล้ว ไม่เขียนทับ')
    if dry:
        print('(--dry: ไม่ได้เขียนทับ)')
        return

    io.open(GAME, 'w', encoding='utf-8').write(out)
    embed_common.rebuild(ROOT)          # ต้นฉบับเปลี่ยนแล้ว → ย่อไฟล์แจกใหม่
    print('เขียนทับเรียบร้อย — สัดส่วนภาพเท่าเดิม (object-fit:cover) เลย์เอาต์ไม่ขยับ')
    print('⚠ นี่คือการบีบทับของที่ถูกบีบมาแล้ว ห้ามรันซ้ำโดยไม่ checkout ไฟล์กลับก่อน')


if __name__ == '__main__':
    main(sys.argv[1:])
