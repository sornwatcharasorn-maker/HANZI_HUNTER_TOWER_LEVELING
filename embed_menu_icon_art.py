#!/usr/bin/env python3
"""ฝังภาพไอคอนของปุ่มเมนูหลัก 9 ใบ  (v5.9 · MENU ICON ART)

กฎไฟล์เดียวจบห้ามอ้างไฟล์ภายนอก ภาพพวกนี้จึงต้องถูกย่อ → WebP → base64 → ฝังเป็นค่าคงที่
เหมือน CD_CARDS[].img / ITEMS[].img / TR_ART ที่ทำไว้แล้ว

    python3 embed_menu_icon_art.py                # ฝังทุกรูปที่หาไฟล์เจอ
    python3 embed_menu_icon_art.py quests shop    # ฝังเฉพาะบางใบ
    python3 embed_menu_icon_art.py --clear        # ถอดภาพทุกใบกลับไปใช้อีโมจิ
    python3 embed_menu_icon_art.py --q 66 --w 64  # บังคับคุณภาพ/ความกว้างเอง
    python3 embed_menu_icon_art.py --dry          # ดูตัวเลขเฉย ๆ ไม่เขียนทับ

**สารบัญอยู่ในตัวเกมที่เดียว** — สคริปต์อ่าน MI_BTNS ของชั้น v5.9 เอง แล้วรู้ว่าคีย์ไหน
ใช้ไฟล์ชื่ออะไร (ฟิลด์ file) ไม่มีแผนที่ชุดที่สองให้ต้องซิงก์กัน

หาไฟล์ตามลำดับ: รากrepo → assets/ → assets/menu/ → assets/icons/
ลองทั้ง .jpg .jpeg .png .webp เพราะเจ้าของ repo อัปโหลดผ่านเว็บ GitHub
ไฟล์จึงมาโผล่ที่รากได้และเปลี่ยนนามสกุลได้ — ตัวชี้ขาดคือ "ชื่อ" ไม่ใช่นามสกุล

ขนาดที่ตั้งไว้: 72px WebP q72
ไอคอนแสดงจริงแค่ 22 CSS px (จอ ≤360px เหลือ 20) 72px จึงคมถึง DPR 3.2 แล้ว
ดันขึ้นไปอีกได้แต่ไบต์ที่เสียเปล่า และ base64 ผ่าน terser ไปเฉย ๆ ไม่ถูกย่อสักไบต์
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
# (ฝังลงไฟล์แจกตรง ๆ จะถูกการย่อรอบถัดไปทับทิ้ง — กับดักข้อ 28)
GAME, DIST, ROOT = embed_common.resolve_game(HERE)

# เพดานฝั่งต้นฉบับที่เทียบเท่า 2,000,000 ไบต์ของไฟล์แจก (ดู embed_common.py)
BUDGET_KB = embed_common.budget_kb(GAME, DIST)

ICON_W, ICON_Q = 72, 72

# บันไดคุณภาพ — ไล่ลงเองถ้าไฟล์รวมจะทะลุเพดาน (กติกาเดียวกับ embed_card_art.py)
LADDER = [(72, 72), (72, 66), (64, 66), (64, 60), (56, 58)]

# พื้นหลังที่ใช้ถมภาพโปร่งใส = สีพื้นการ์ดของเกม
FLAT_BG = (12, 17, 28)

EXTS = ('.jpg', '.jpeg', '.png', '.webp')
DIRS = ('', 'assets', 'assets/menu', 'assets/icons')

# หนึ่งบรรทัดของ MI_BTNS — key กับ file อยู่บรรทัดเดียวกันเสมอ
BTN_RE = re.compile(r"\{\s*key:\s*'(?P<key>\w+)',[^\n]*?file:\s*'(?P<file>[^']*)'\s*\}")

# ก้อน MI_ART ทั้งบล็อก (ตัวที่จะถูกเขียนทับ)
ART_RE = re.compile(r"(?P<head>const MI_ART\s*=\s*\{)(?P<body>.*?)(?P<tail>\n    \};)", re.S)


def resolve(stem):
    """หาไฟล์จริงจากชื่อในสารบัญ ยอมรับหลายนามสกุลและหลายตำแหน่ง"""
    for root in (HERE, os.path.dirname(HERE)):
        for d in DIRS:
            for e in EXTS:
                c = os.path.join(root, d, stem + e)
                if os.path.exists(c):
                    return c
    return None


def encode(path, size, quality):
    """ย่อเป็นจัตุรัส size x size แล้วบีบเป็น WebP

    ต้นฉบับทั้ง 9 ใบเป็นจัตุรัสอยู่แล้ว (350x350) จึงย่อตรง ๆ ได้โดยไม่เสียสัดส่วน
    ถ้าวันหนึ่งมีภาพที่ไม่ใช่จัตุรัสเข้ามา จะถูกครอบจากกึ่งกลางให้เป็นจัตุรัสก่อน
    เพราะกรอบไอคอนบนจอเป็นจัตุรัสและ CSS ใช้ object-fit:cover อยู่แล้ว
    """
    im = Image.open(path)
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
    w0, h0 = im.size
    if w0 != h0:                                    # ครอบกึ่งกลางให้เป็นจัตุรัส
        s = min(w0, h0)
        l, t = (w0 - s) // 2, (h0 - s) // 2
        im = im.crop((l, t, l + s, t + s))
    if im.mode == 'RGBA':                           # ภาพวางบนพื้นเข้ม ถมพื้นแล้วไฟล์เล็กกว่ามาก
        bg = Image.new('RGB', im.size, FLAT_BG)
        bg.paste(im, mask=im.split()[3])
        im = bg
    side = min(size, im.size[0])                    # ไม่ขยายเกินต้นฉบับ ขยายแล้วได้แต่ความเบลอ
    if im.size != (side, side):
        im = im.resize((side, side), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue(), (w0, h0), side


def opt_int(argv, flag, default):
    """อ่านค่าตัวเลขจากธง เช่น --q 66 หรือ --q=66"""
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return int(argv[i + 1])
        if a.startswith(flag + '='):
            return int(a.split('=', 1)[1])
    return default


def write_art(src, values):
    """เขียนก้อน MI_ART ใหม่ทั้งบล็อก โดยคงลำดับคีย์เดิมไว้เป๊ะ"""
    m = ART_RE.search(src)
    if not m:
        sys.exit('หาก้อน MI_ART ไม่เจอ — ชั้น v5.9 ถูกถอดออกไปแล้วหรือเปล่า')
    keys = re.findall(r"^\s*(\w+):\s*'", m.group('body'), re.M)
    lines = []
    for i, k in enumerate(keys):
        tail = ',' if i < len(keys) - 1 else ''
        lines.append("      %s: '%s'%s" % (k, values.get(k, ''), tail))
    body = '\n' + '\n'.join(lines)
    return src[:m.start('body')] + body + src[m.end('body'):], keys


def main(argv):
    clear = '--clear' in argv
    dry = '--dry' in argv
    q = opt_int(argv, '--q', None)
    w = opt_int(argv, '--w', None)

    skip = set()
    for i, a in enumerate(argv):
        if a in ('--q', '--w'):
            skip.add(i)
            skip.add(i + 1)
    only = set(a for i, a in enumerate(argv) if not a.startswith('-') and i not in skip)

    src = io.open(GAME, encoding='utf-8').read()
    before = len(src.encode('utf-8'))

    m = ART_RE.search(src)
    if not m:
        sys.exit('หาก้อน MI_ART ไม่เจอ — ชั้น v5.9 ถูกถอดออกไปแล้วหรือเปล่า')
    cur = dict(re.findall(r"^\s*(\w+):\s*'([^']*)'", m.group('body'), re.M))

    slots = [(x.group('key'), x.group('file')) for x in BTN_RE.finditer(src)]
    if not slots:
        sys.exit('หาสารบัญ MI_BTNS ไม่เจอ — โครงไฟล์เกมถูกแก้ไปแล้วหรือเปล่า')
    print('พบช่องเสียบภาพ %d ช่อง' % len(slots))

    if clear:
        out, keys = write_art(src, {})
        after = len(out.encode('utf-8'))
        print('ถอดภาพออกทั้ง %d ใบ · ไฟล์เกม %.0f KB → %.0f KB' % (len(keys), before / 1024, after / 1024))
        if not dry:
            io.open(GAME, 'w', encoding='utf-8').write(out)
            embed_common.rebuild(ROOT)
        return

    jobs, missing = [], []
    for key, stem in slots:
        if only and key not in only:
            continue
        real = resolve(stem)
        if real:
            jobs.append((key, stem, real))
        else:
            missing.append((key, stem))

    for key, stem in missing:
        print('  ข้าม %-12s ← ไม่พบไฟล์ %s.*' % (key, stem))
    if not jobs:
        sys.exit('\nไม่มีไฟล์ให้ฝังสักรูป — วางไฟล์ภาพตามชื่อในสารบัญ MI_BTNS ก่อน')

    # ไล่บันไดคุณภาพจนกว่าไฟล์รวมจะอยู่ใต้เพดาน (ธง --q / --w = ข้ามบันได)
    ladder = [(w or ICON_W, q or ICON_Q)] if (q or w) else LADDER
    for side, qual in ladder:
        values = dict(cur)
        report, total = [], 0
        for key, stem, real in jobs:
            raw, orig, used = encode(real, side, qual)
            b64 = base64.b64encode(raw).decode()
            values[key] = 'data:image/webp;base64,' + b64
            total += len(b64)
            report.append('  %-12s %-16s %dx%d → %dx%d  WebP %.1f KB → base64 %.1f KB'
                          % (key, stem, orig[0], orig[1], used, used,
                             len(raw) / 1024, len(b64) / 1024))
        out, _ = write_art(src, values)
        after = len(out.encode('utf-8'))
        if after / 1024 <= BUDGET_KB:
            break
        print('  ↓ %dpx q%d ยังทะลุเพดาน — ลดคุณภาพลงอีกขั้น' % (side, qual))
    else:
        sys.exit('หยุด: ไฟล์รวมทะลุเพดานทุกขั้นของบันได ไม่เขียนทับ')

    print('\n'.join(report))
    print('\nรวม base64 ของไอคอนเมนู %d ใบ = %.1f KB  (%dpx q%d)'
          % (len(jobs), total / 1024, side, qual))
    print('ไฟล์เกม %.0f KB → %.0f KB (เพดาน %.0f KB · เหลือ %.0f KB)'
          % (before / 1024, after / 1024, BUDGET_KB, BUDGET_KB - after / 1024))

    if dry:
        print('\n--dry: ไม่เขียนทับ')
        return

    io.open(GAME, 'w', encoding='utf-8').write(out)
    embed_common.rebuild(ROOT)          # ต้นฉบับเปลี่ยนแล้ว → ย่อไฟล์แจกใหม่
    print('ฝังภาพเรียบร้อย %d ใบ%s'
          % (len(jobs), (' · ยังขาดอีก %d ใบ' % len(missing)) if missing else ''))


if __name__ == '__main__':
    main(sys.argv[1:])
