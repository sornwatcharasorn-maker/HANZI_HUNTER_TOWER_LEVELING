#!/usr/bin/env python3
"""ฝังภาพประกอบการ์ดลงชั้น v4.7 · CARD DRAFTING  (Asset Mapping v4.7.3)

กฎไฟล์เดียวจบห้ามอ้างไฟล์ภายนอก ภาพการ์ดจึงต้องถูกย่อ → WebP → base64 → ฝังเป็นค่าคงที่
เหมือน SKILLS[].img / SN_WARP_ART / TR_ART ที่ทำไว้แล้ว

    python3 embed_card_art.py                 # ฝังทุกใบที่หาไฟล์เจอ (ไล่บันไดคุณภาพให้พอดีเพดาน)
    python3 embed_card_art.py ward edge       # ฝังเฉพาะบางใบ
    python3 embed_card_art.py --q 72          # บังคับคุณภาพเอง (ข้ามบันได) · --w 260 บังคับความกว้าง
    python3 embed_card_art.py --clear         # ถอดภาพทุกใบกลับไปใช้อีโมจิ

สารบัญชื่อไฟล์อยู่ในตัวไฟล์เกมเอง — ฟิลด์ image ของการ์ดแต่ละใบใน CD_CARDS
สคริปต์นี้อ่านจากตรงนั้น จึงไม่มีทางที่แผนที่สองที่จะไม่ตรงกัน

หาไฟล์ตามลำดับ: path ในฟิลด์ image → assets/cards/ → รากrepo · ลองทั้ง .jpg .jpeg .png .webp
ใบไหนหาไม่เจอจะถูกข้าม (ฟิลด์ img ยังว่าง = การ์ดใบนั้นใช้อีโมจิเหมือนเดิม ไม่มีรูปแตก)
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

# ภาพถูกใช้ 2 ขนาด: ตราข้างชื่อการ์ด 28px และภาพพื้นหลังราวครึ่งใบการ์ด (~230px บนจอใหญ่สุด)
# 300px จึงเหลือเฟือแล้ว · ถ้ารวมกันทะลุเพดาน สคริปต์จะไล่ลดตามบันไดนี้ให้เอง
LADDER = [(300, 80), (300, 72), (260, 72), (240, 68), (220, 62), (200, 58)]

# ตำแหน่งฟิลด์ image/img ของการ์ดแต่ละใบ — จับ id มาด้วยเพื่อรายงานเป็นชื่อที่คนอ่านรู้เรื่อง
CARD_RE = re.compile(
    r"\{ id:'(?P<id>\w+)',[^\n]*\n"
    r"\s*name:'(?P<name>[^']*)',[^\n]*\n"
    r"(?P<head>\s*image:')(?P<path>[^']*)(?P<mid>', img:')(?P<data>[^']*)(?P<tail>',)")


def find_cards(src):
    out = []
    for m in CARD_RE.finditer(src):
        out.append(m)
    return out


def encode(path, max_w, quality):
    im = Image.open(path)
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
    w0, h0 = im.size
    w = min(max_w, w0)                              # ไม่ขยายเกินต้นฉบับ ขยายแล้วได้แต่ความเบลอ
    h = max(1, round(h0 * w / w0))
    if (w, h) != (w0, h0):
        im = im.resize((w, h), Image.LANCZOS)
    if im.mode == 'RGBA':                           # การ์ดวางบนพื้นเข้ม ถมพื้นแล้วไฟล์เล็กกว่ามาก
        bg = Image.new('RGB', im.size, (12, 17, 28))
        bg.paste(im, mask=im.split()[3])
        im = bg
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue(), (w0, h0), (w, h)


EXTS = ('.jpg', '.jpeg', '.png', '.webp')


def resolve(path):
    """หาไฟล์จริงจาก path ที่ประกาศไว้ในฟิลด์ image

    ยอมรับนามสกุลอื่นและตำแหน่งอื่นด้วย เพราะเจ้าของ repo อัปโหลดผ่านเว็บ GitHub
    ไฟล์จึงมาโผล่ที่รากบ้าง เป็น .jpg แทน .png บ้าง — ตัวชี้ขาดคือ "ชื่อการ์ด" ไม่ใช่นามสกุล
    """
    roots = [HERE, os.path.dirname(HERE)]
    stem = os.path.splitext(os.path.basename(path))[0]
    cand = []
    for r in roots:
        cand.append(os.path.join(r, path))                       # ตามที่ประกาศไว้เป๊ะ ๆ
    for r in roots:
        for d in (os.path.dirname(path), 'assets/cards', ''):    # โฟลเดอร์ที่ควรอยู่ → ราก repo
            for e in EXTS:
                cand.append(os.path.join(r, d, stem + e))
    for c in cand:
        if os.path.exists(c):
            return c
    return None


def opt_int(argv, flag, default):
    """อ่านค่าตัวเลขจากธง --q / --w (รองรับทั้ง '--q 72' และ '--q=72')"""
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return int(argv[i + 1])
        if a.startswith(flag + '='):
            return int(a.split('=', 1)[1])
    return default


def main(argv):
    clear = '--clear' in argv
    q = opt_int(argv, '--q', None)
    w = opt_int(argv, '--w', None)
    # ตัดธงกับค่าที่ตามหลังธงออก ที่เหลือคือรายชื่อ id ที่สั่งฝังเฉพาะบางใบ
    skip = set()
    for i, a in enumerate(argv):
        if a in ('--q', '--w'):
            skip.add(i)
            skip.add(i + 1)
    only = set(a for i, a in enumerate(argv)
               if not a.startswith('-') and i not in skip)
    ladder = [(w or 300, q)] if q else ([(w, qq) for _, qq in LADDER] if w else LADDER)

    src = io.open(GAME, encoding='utf-8').read()
    before = len(src.encode('utf-8'))
    cards = find_cards(src)
    if not cards:
        sys.exit('หาฟิลด์ image/img ใน CD_CARDS ไม่เจอ — ชั้น v4.7 ถูกแก้โครงไปแล้วหรือเปล่า')
    print('พบการ์ดที่ผูกภาพไว้ %d ใบ' % len(cards))

    if clear:
        out = CARD_RE.sub(lambda m: m.group(0)[:m.start('data') - m.start()] +
                          m.group(0)[m.end('data') - m.start():], src)
        io.open(GAME, 'w', encoding='utf-8').write(out)
        embed_common.rebuild(ROOT)          # ต้นฉบับเปลี่ยนแล้ว → ย่อไฟล์แจกใหม่
        print('ถอดภาพออกครบทุกใบแล้ว — การ์ดกลับไปใช้อีโมจิเหมือนเดิม')
        return

    # หาไฟล์ให้ครบก่อน แล้วค่อยเลือกคุณภาพที่ทำให้ไฟล์รวมไม่ทะลุเพดาน
    jobs, missing = [], []
    for m in cards:
        if only and m.group('id') not in only:
            continue
        real = resolve(m.group('path'))
        if real:
            jobs.append((m, real))
        else:
            missing.append((m.group('id'), m.group('name'), m.group('path')))

    for cid, name, path in missing:
        print('  ข้าม %-9s %-22s ← ไม่พบไฟล์ %s' % (cid, name, path))
    if not jobs:
        sys.exit('\nไม่มีไฟล์ให้ฝังสักใบ — วางไฟล์ภาพตามชื่อในฟิลด์ image ก่อน')

    kept = sum(len(m.group('data')) for m in cards) - sum(len(m.group('data')) for m, _ in jobs)
    for max_w, quality in ladder:
        enc, total = {}, 0
        for m, real in jobs:
            raw, orig, used = encode(real, max_w, quality)
            b64 = base64.b64encode(raw).decode()
            enc[m.group('id')] = (b64, raw, orig, used)
            total += len(b64)
        projected = (before - sum(len(m.group('data')) for m, _ in jobs) + total) / 1024
        print('\nลอง %dpx q%d → ภาพรวม %.0f KB · ไฟล์เกมจะเป็น %.0f KB'
              % (max_w, quality, total / 1024, projected))
        if projected <= BUDGET_KB:
            break
    else:
        sys.exit('หยุด: ต่อให้บีบสุดบันไดแล้วไฟล์รวมก็ยังทะลุเพดาน %d KB' % BUDGET_KB)
    if q and projected > BUDGET_KB:
        sys.exit('หยุด: คุณภาพที่สั่งมาเองทำให้ไฟล์รวมทะลุเพดาน %d KB' % BUDGET_KB)

    for m, real in jobs:
        b64, raw, orig, used = enc[m.group('id')]
        print('  %-9s %-22s %dx%d → %dx%d  WebP %.1f KB → base64 %.1f KB'
              % (m.group('id'), m.group('name'), orig[0], orig[1], used[0], used[1],
                 len(raw) / 1024, len(b64) / 1024))

    def swap(m):
        e = enc.get(m.group('id'))
        if not e:
            return m.group(0)
        s = m.start()
        return (m.group(0)[:m.start('data') - s] + 'data:image/webp;base64,' + e[0] +
                m.group(0)[m.end('data') - s:])

    out = CARD_RE.sub(swap, src)
    after = len(out.encode('utf-8'))
    print('\nไฟล์เกม %.0f KB → %.0f KB (เพดาน %d KB)' % (before / 1024, after / 1024, BUDGET_KB))
    if after / 1024 > BUDGET_KB:
        sys.exit('หยุด: ไฟล์รวมทะลุเพดานแล้ว ไม่เขียนทับ')

    io.open(GAME, 'w', encoding='utf-8').write(out)
    embed_common.rebuild(ROOT)          # ต้นฉบับเปลี่ยนแล้ว → ย่อไฟล์แจกใหม่
    print('ฝังภาพเรียบร้อย %d ใบ%s' % (len(jobs), (' · ยังขาดอีก %d ใบ' % len(missing)) if missing else ''))
    if kept:
        print('(ใบที่ไม่ได้สั่งฝังรอบนี้ ภาพเดิมยังอยู่ครบ)')


if __name__ == '__main__':
    main(sys.argv[1:])
