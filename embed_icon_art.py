#!/usr/bin/env python3
"""ฝังภาพไอคอนสกิล 4 ตัว + ภาพประตูวาป  (Asset Replacement Patch)

กฎไฟล์เดียวจบห้ามอ้างไฟล์ภายนอก ภาพพวกนี้จึงต้องถูกย่อ → WebP → base64 → ฝังเป็นค่าคงที่
เหมือน CD_CARDS[].img / TR_ART ที่ทำไว้แล้ว

    python3 embed_icon_art.py                 # ฝังทุกรูปที่หาไฟล์เจอ
    python3 embed_icon_art.py eye warp        # ฝังเฉพาะบางรูป

**ชื่อไฟล์คือชื่อสกิลภาษาไทยเป๊ะ ๆ** — สคริปต์อ่านฟิลด์ name ของ SKILLS ในตัวไฟล์เกมเอง
แล้วตัดคำนำหน้าข้างหน้า ':' ทิ้ง ('ทลายอักษร: ดาบโลหิต' → 'ดาบโลหิต.jpg')
สารบัญจึงอยู่ที่เดียวคือตัวเกม ไม่มีทางที่แผนที่สองที่จะไม่ตรงกัน
ส่วนภาพประตูวาปใช้ชื่อ 'วาป' ซึ่งไม่มีที่อยู่ในเกมให้อ่าน จึงประกาศไว้ที่ WARP_STEM

หาไฟล์ตามลำดับ: รากrepo → assets/ · ลองทั้ง .jpg .jpeg .png .webp
รูปไหนหาไม่เจอจะถูกข้าม (ของเดิมที่ฝังไว้อยู่แล้วไม่ถูกแตะ)
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

#   เดิมตั้งไว้ 2048 ซึ่งเป็น 2 MiB = 2,097,152 ไบต์ — หลวมกว่ากฎที่เขียนใน CLAUDE.md อยู่ ~97KB
#   บันไดคุณภาพจึงไม่เคยถูกไล่ลงเลยทั้งที่ไฟล์ทะลุเพดานตามเอกสารไปแล้ว

# ไอคอนสกิลแสดงที่ 26x26 CSS px (.g-skill-icon img) · 80px จึงคมพอถึง DPR 3.1
#   ย่อจาก 96px (DPR 3.7) ลงมาตอน Patch v8.3 เพื่อคืนที่ให้ชั้นนั้น — ยังสูงกว่า
#   มาตรฐาน DPR 2.9 ที่ v7.8 ตั้งไว้ให้ MI_ART (64px ที่ 22 CSS px) อยู่
# ภาพประตูวาปกว้างเต็มแผง (.wp-art img { width:100% }) จึงให้กว้างได้ถึง 720px
SKILL_W, SKILL_Q = 80, 80
WARP_W, WARP_Q = 720, 82
WARP_STEM = 'วาป'

# ฟิลด์ img ของสกิลแต่ละตัวใน SKILLS — ชื่อสกิลอยู่บรรทัดเดียวกันต่อท้าย img
SKILL_RE = re.compile(
    r"\{ key:'(?P<key>\w+)',(?P<head>[^\n]*?img:')(?P<data>[^']*)"
    r"(?P<mid>'[^\n]*?name:')(?P<name>[^']*)'")

WARP_RE = re.compile(r"(?P<head>const SN_WARP_ART\s*=\s*')(?P<data>[^']*)(?P<tail>')")

EXTS = ('.jpg', '.jpeg', '.png', '.webp')


def resolve(stem):
    """หาไฟล์จริงจากชื่อภาษาไทยของสกิล/ประตูวาป

    ยอมรับหลายนามสกุลและหลายตำแหน่ง เพราะเจ้าของ repo อัปโหลดผ่านเว็บ GitHub
    ไฟล์จึงมาโผล่ที่รากบ้าง เป็น .jpg แทน .png บ้าง — ตัวชี้ขาดคือ "ชื่อ" ไม่ใช่นามสกุล
    """
    for root in (HERE, os.path.dirname(HERE)):
        for d in ('', 'assets', 'assets/icons', 'assets/skills'):
            for e in EXTS:
                c = os.path.join(root, d, stem + e)
                if os.path.exists(c):
                    return c
    return None


def encode(path, max_w, quality):
    im = Image.open(path)
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
    w0, h0 = im.size
    w = min(max_w, w0)                              # ไม่ขยายเกินต้นฉบับ ขยายแล้วได้แต่ความเบลอ
    h = max(1, round(h0 * w / w0))
    if (w, h) != (w0, h0):
        im = im.resize((w, h), Image.LANCZOS)
    if im.mode == 'RGBA':                           # ภาพวางบนพื้นเข้ม ถมพื้นแล้วไฟล์เล็กกว่ามาก
        bg = Image.new('RGB', im.size, (12, 17, 28))
        bg.paste(im, mask=im.split()[3])
        im = bg
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue(), (w0, h0), (w, h)


def stem_of(name):
    """'ทลายอักษร: ดาบโลหิต' → 'ดาบโลหิต' · ชื่อที่ไม่มี ':' ใช้ทั้งชื่อ"""
    return name.split(':')[-1].strip()


def opt_int(argv, flag, default):
    """อ่านค่าตัวเลขจากธง เช่น --q 76 หรือ --q=76"""
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return int(argv[i + 1])
        if a.startswith(flag + '='):
            return int(a.split('=', 1)[1])
    return default


def main(argv):
    q = opt_int(argv, '--q', None)
    skip = set()
    for i, a in enumerate(argv):
        if a == '--q':
            skip.add(i)
            skip.add(i + 1)
    only = set(a for i, a in enumerate(argv) if not a.startswith('-') and i not in skip)

    src = io.open(GAME, encoding='utf-8').read()
    before = len(src.encode('utf-8'))

    slots = []                                      # (label, stem, max_w, quality, span ของ data)
    for m in SKILL_RE.finditer(src):
        slots.append((m.group('key'), stem_of(m.group('name')), SKILL_W, q or SKILL_Q,
                      m.span('data')))
    mw = WARP_RE.search(src)
    if mw:
        slots.append(('warp', WARP_STEM, WARP_W, q or WARP_Q, mw.span('data')))
    if not slots:
        sys.exit('หาฟิลด์ img ของ SKILLS / SN_WARP_ART ไม่เจอ — โครงไฟล์เกมถูกแก้ไปแล้วหรือเปล่า')
    print('พบช่องเสียบภาพ %d ช่อง' % len(slots))

    jobs, missing = [], []
    for label, stem, max_w, q, span in slots:
        if only and label not in only:
            continue
        real = resolve(stem)
        if real:
            jobs.append((label, stem, max_w, q, span, real))
        else:
            missing.append((label, stem))

    for label, stem in missing:
        print('  ข้าม %-6s ← ไม่พบไฟล์ %s.*' % (label, stem))
    if not jobs:
        sys.exit('\nไม่มีไฟล์ให้ฝังสักรูป — วางไฟล์ภาพตามชื่อสกิลก่อน')

    enc, report = {}, []
    for label, stem, max_w, q, span, real in jobs:
        raw, orig, used = encode(real, max_w, q)
        b64 = base64.b64encode(raw).decode()
        enc[label] = b64
        report.append('  %-6s %-16s %dx%d → %dx%d  WebP %.1f KB → base64 %.1f KB'
                      % (label, stem, orig[0], orig[1], used[0], used[1],
                         len(raw) / 1024, len(b64) / 1024))
    print('\n'.join(report))

    out, pos = [], 0
    for label, stem, max_w, q, span, real in sorted(jobs, key=lambda j: j[4][0]):
        out.append(src[pos:span[0]])
        out.append('data:image/webp;base64,' + enc[label])
        pos = span[1]
    out.append(src[pos:])
    out = ''.join(out)

    after = len(out.encode('utf-8'))
    print('\nไฟล์เกม %.0f KB → %.0f KB (เพดาน %d KB)' % (before / 1024, after / 1024, BUDGET_KB))
    if after / 1024 > BUDGET_KB:
        sys.exit('หยุด: ไฟล์รวมทะลุเพดานแล้ว ไม่เขียนทับ')

    io.open(GAME, 'w', encoding='utf-8').write(out)
    embed_common.rebuild(ROOT)          # ต้นฉบับเปลี่ยนแล้ว → ย่อไฟล์แจกใหม่
    print('ฝังภาพเรียบร้อย %d รูป%s'
          % (len(jobs), (' · ยังขาดอีก %d รูป' % len(missing)) if missing else ''))


if __name__ == '__main__':
    main(sys.argv[1:])
