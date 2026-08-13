#!/usr/bin/env python3
"""ฝังภาพหอคอยเรนเดอร์ลงชั้น v4.5 · TOWER RADAR

กฎไฟล์เดียวจบห้ามอ้างไฟล์ภายนอก ภาพจึงต้องถูกย่อ → WebP → base64 → ฝังเป็นค่าคงที่ TR_ART
สคริปต์นี้ทำให้ครบทั้งกระบวนการ พร้อมเขียนค่า TR_ART_AR ให้อัตโนมัติ

    python3 embed_tower_art.py TOWER.png            # ฝังที่คุณภาพเริ่มต้น q82
    python3 embed_tower_art.py TOWER.png --q 76     # บังคับคุณภาพเอง (สัดส่วนภาพไม่เปลี่ยน)
    python3 embed_tower_art.py TOWER.png --ruler    # ขอไม้บรรทัดไว้วัด TR_ART_Z ใหม่

ค่า TR_ART_Z (จุดยืนของแต่ละโซนบนภาพ) ยังต้องวัดเอง — สคริปต์จะพิมพ์โครงร่างให้
พร้อมภาพตัวช่วย tools/tower_art_ruler.png ที่ขีดเส้นบอกสัดส่วนความสูงไว้ทุก 5%
เปิดดูแล้วอ่านว่าพื้นที่ยืนของแต่ละโซนอยู่ที่กี่เปอร์เซ็นต์ แล้วกรอกกลับเข้าไปในไฟล์เกม
"""
import base64
import io
import os
import re
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import embed_common
# ตั้งแต่มีขั้นตอนย่อไฟล์ ต้องฝังลง "ต้นฉบับ" เสมอ แล้วสั่งย่อใหม่ปิดท้าย
# (ฝังลงไฟล์แจกตรง ๆ จะถูกการย่อรอบถัดไปทับทิ้ง)
GAME, DIST, ROOT = embed_common.resolve_game(HERE)

TARGET_W = 800      # เพดานความกว้าง — ไม่ขยายภาพเกินขนาดต้นฉบับ (ขยายแล้วได้แต่ความเบลอกับไฟล์ที่ใหญ่ขึ้น)
QUALITY = 82        # เท่ากับ SN_WARP_ART ที่ใช้อยู่
# เพดานฝั่งต้นฉบับที่เทียบเท่า 2,000,000 ไบต์ของไฟล์แจก (ดู embed_common.py)
BUDGET_KB = embed_common.budget_kb(GAME, DIST)

#   เดิมตั้งไว้ 2048 ซึ่งเป็น 2 MiB = 2,097,152 ไบต์ — หลวมกว่ากฎที่เขียนใน CLAUDE.md อยู่ ~97KB
#   บันไดคุณภาพจึงไม่เคยถูกไล่ลงเลยทั้งที่ไฟล์ทะลุเพดานตามเอกสารไปแล้ว


def opt_int(argv, flag, default):
    """อ่านค่าตัวเลขจากธง เช่น --q 76 หรือ --q=76"""
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return int(argv[i + 1])
        if a.startswith(flag + '='):
            return int(a.split('=', 1)[1])
    return default

def main(path, quality=None, ruler_on=False):
    quality = quality or QUALITY
    im = Image.open(path).convert('RGB')
    w0, h0 = im.size
    w = min(TARGET_W, w0)
    h = round(h0 * w / w0)
    if (w, h) != (w0, h0):
        im = im.resize((w, h), Image.LANCZOS)

    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    raw = buf.getvalue()
    b64 = base64.b64encode(raw).decode()
    ar = round(h / w, 4)

    print('ภาพต้นฉบับ  %dx%d' % (w0, h0))
    print('ใช้ขนาด    %dx%d  (สัดส่วน สูง/กว้าง = %.4f)' % (w, h, ar))
    print('WebP q%d    %.1f KB  →  base64 %.1f KB' % (quality, len(raw) / 1024, len(b64) / 1024))

    # ภาพตัวช่วยวัดสัดส่วน — ทำเฉพาะตอนสั่ง --ruler เพราะการฝังใหม่ที่คุณภาพอื่น
    # ไม่ได้เปลี่ยนสัดส่วนภาพ จึงไม่ต้องวัด TR_ART_Z ใหม่
    ruler_path = None
    if ruler_on:
      ruler = im.copy()
      d = ImageDraw.Draw(ruler)
      for pct in range(0, 101, 5):
        y = h * pct / 100
        strong = pct % 25 == 0
        d.line([(0, y), (w, y)], fill=(255, 60, 60) if strong else (255, 220, 0), width=2 if strong else 1)
        d.text((4, max(0, y - 12)), '%d%%' % pct, fill=(255, 255, 255))
      d.line([(w / 2, 0), (w / 2, h)], fill=(0, 255, 255), width=1)
      ruler_path = os.path.join(HERE, 'tower_art_ruler.png')
      ruler.save(ruler_path)
      print('ไม้บรรทัดวัดสัดส่วน → %s' % ruler_path)

    src = io.open(GAME, encoding='utf-8').read()
    before = len(src.encode('utf-8'))

    art_re = re.compile(r"(    const TR_ART    = )'[^']*'(;)")
    ar_re = re.compile(r"(    const TR_ART_AR = )[0-9.]+(;)")
    if not art_re.search(src) or not ar_re.search(src):
        sys.exit('หา TR_ART / TR_ART_AR ในไฟล์เกมไม่เจอ — ชั้น v4.5 ถูกแก้โครงไปแล้วหรือเปล่า')

    src = art_re.sub(lambda m: m.group(1) + "'data:image/webp;base64," + b64 + "'" + m.group(2), src, count=1)
    src = ar_re.sub(lambda m: m.group(1) + str(ar) + m.group(2), src, count=1)

    after = len(src.encode('utf-8'))
    print('ไฟล์เกม %.0f KB → %.0f KB' % (before / 1024, after / 1024))
    if after / 1024 > BUDGET_KB:
        sys.exit('หยุด: ไฟล์รวมทะลุเพดาน %d KB แล้ว ลด TARGET_W หรือ QUALITY ลง' % BUDGET_KB)

    io.open(GAME, 'w', encoding='utf-8').write(src)
    embed_common.rebuild(ROOT)          # ต้นฉบับเปลี่ยนแล้ว → ย่อไฟล์แจกใหม่
    if not ruler_path:
        print('\nฝังภาพเรียบร้อย — สัดส่วนภาพเท่าเดิม จึงไม่ต้องวัด TR_ART_Z ใหม่')
        return
    print('\nฝังภาพเรียบร้อย — เหลืออีกขั้นเดียว: กรอก TR_ART_Z')
    print('เปิด %s แล้ววัดว่าแต่ละโซนมีพื้นที่ยืนอยู่ที่ความสูงกี่ %%' % os.path.basename(ruler_path))
    print("""
    const TR_ART_Z = [
      { y0: ?, y1: ?, w0: ?, w1: ? },   /* I   ชั้น 1-4   ฐานป้อมปราการ (ล่างสุดของภาพ) */
      { y0: ?, y1: ?, w0: ?, w1: ? },   /* II  ชั้น 5-8   คุกใต้ดิน */
      { y0: ?, y1: ?, w0: ?, w1: ? },   /* III ชั้น 9-12  ห้องโถงอัศวิน */
      { y0: ?, y1: ?, w0: ?, w1: ? },   /* IV  ชั้น 13-16 ห้องทดลองอาร์เคน */
      { y0: ?, y1: ?, w0: ?, w1: ? }    /* V   ชั้น 17-20 ยอดคริสตัล (บนสุดของภาพ) */
    ];

  y0 = พื้นที่ยืนของชั้นล่างสุดในโซน (ค่ามากกว่า — อยู่ต่ำกว่าในภาพ)
  y1 = พื้นที่ยืนของชั้นบนสุดในโซน  (ค่าน้อยกว่า)
  w0 / w1 = ครึ่งความกว้างของตัวหอคอยตรงระดับนั้น เทียบความกว้างภาพ (เช่น .28)
  ทุกค่าเป็นสัดส่วน 0-1 · ชั้นทั้ง 4 ในโซนถูกไล่ระดับเชิงเส้นระหว่าง y0 → y1
""")


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    flags = sys.argv[1:]
    qv = opt_int(flags, '--q', None)
    if qv is not None and args and args[-1] == str(qv):
        args = args[:-1]                            # ค่าที่ตามหลัง --q ไม่ใช่ชื่อไฟล์
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], qv, '--ruler' in flags)
