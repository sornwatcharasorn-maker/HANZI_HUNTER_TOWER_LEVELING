#!/usr/bin/env python3
"""ฝังภาพประกอบไอเทมใช้งานลง ITEMS ของชั้น v4.0  (Item Asset Patch)

กฎไฟล์เดียวจบห้ามอ้างไฟล์ภายนอก ภาพไอเทมจึงต้องถูกย่อ → WebP → base64 → ฝังเป็นค่าคงที่
เหมือน SKILLS[].img / SN_WARP_ART / TR_ART / CD_CARDS[].img ที่ทำไว้แล้ว

    python3 embed_item_art.py                  # ฝังทุกตัวที่หาไฟล์เจอ
    python3 embed_item_art.py potion mystery   # ฝังเฉพาะบางตัว
    python3 embed_item_art.py --clear          # ถอดภาพทุกตัวกลับไปใช้อีโมจิ

สารบัญชื่อไฟล์อยู่ในตัวไฟล์เกมเอง — ฟิลด์ image ของไอเทมแต่ละตัวใน ITEMS
สคริปต์นี้อ่านจากตรงนั้น จึงไม่มีทางที่แผนที่สองที่จะไม่ตรงกัน

หาไฟล์ตามลำดับ: path ในฟิลด์ image → assets/items/ → assets/cards/ → รากrepo
ลองทั้ง .jpg .jpeg .png .webp · ตัวไหนหาไม่เจอจะถูกข้าม (ฟิลด์ img ยังว่าง =
ไอเทมตัวนั้นใช้อีโมจิเหมือนเดิม ไม่มีรูปแตกและไม่มีคำขอเน็ตออกไปข้างนอก)
"""
import base64
import io
import os
import re
import sys
from collections import Counter, deque

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, 'hanzi_hunter_tower_v3_1_intro.html')
if not os.path.exists(GAME):                       # เผื่อวางสคริปต์ไว้ในโฟลเดอร์ย่อย
    GAME = os.path.join(os.path.dirname(HERE), 'hanzi_hunter_tower_v3_1_intro.html')

BUDGET_KB = 1953    # เพดานไฟล์รวมตาม CLAUDE.md = 2,000,000 ไบต์ (~2MB แบบทศนิยม) — นักเรียนโหลดผ่านเน็ตมือถือ

#   เดิมตั้งไว้ 2048 ซึ่งเป็น 2 MiB = 2,097,152 ไบต์ — หลวมกว่ากฎที่เขียนใน CLAUDE.md อยู่ ~97KB
#   บันไดคุณภาพจึงไม่เคยถูกไล่ลงเลยทั้งที่ไฟล์ทะลุเพดานตามเอกสารไปแล้ว

# ภาพถูกใช้ 3 ขนาด: ช่องกระเป๋า 28px · ตราในแถบรายละเอียด 20px · ไอคอนร้านค้า 44px
# 160px จึงคมถึง DPR 3.6 บนจุดที่ใหญ่ที่สุด · ถ้ารวมกันทะลุเพดานจะไล่ลดตามบันไดนี้เอง
LADDER = [(160, 82), (160, 74), (144, 74), (128, 70), (112, 66), (96, 62)]

# พื้นหลังที่ใช้ถมแทนลายตารางหมากรุก — โทนเดียวกับพื้นการ์ด/แผงในเกม
BG = (12, 17, 28)

# ตำแหน่งฟิลด์ image/img ของไอเทมแต่ละตัว — จับ key/name มาด้วยเพื่อรายงานให้คนอ่านรู้เรื่อง
ITEM_RE = re.compile(
    r"\{ key:'(?P<id>\w+)',[^\n]*name:'(?P<name>[^']*)'[^\n]*\n"
    r"(?:[^\n]*\n)*?"
    r"(?P<head>\s*image:')(?P<path>[^']*)(?P<mid>', img:')(?P<data>[^']*)(?P<tail>' \},?)")


# ── ลายตารางหมากรุก ────────────────────────────────────────────────────
# ต้นฉบับบางตัวเป็น PNG พื้นโปร่งที่ถูกแบนเป็น JPG มาแล้ว ลายตารางจึงติดมาในภาพจริง ๆ
# (ยาฟื้นพลัง = ลายสีอ่อน เห็นชัดมาก · แว่นขยายสัจธรรม กับ กล่องสุ่มปริศนา = ลายสีเข้ม)
# ถ้าฝังไปตรง ๆ ไอคอนจะกลายเป็นตารางเทา ๆ หลุดธีมทันที จึงต้องถมพื้นก่อนย่อ
#
# วิธีตรวจ: ดูกรอบนอกของภาพว่าเป็น "เทาล้วนสองระดับที่ห่างกันพอสมควรและมีพอ ๆ กัน"
# ภาพพื้นดำสนิท (ม้วนคัมภีร์ · หยุดเวลา · ยาเพิ่มสมาธิ · ประกันภัยฮันเตอร์) จะไม่เข้าเงื่อนไข
# แล้วถูกปล่อยผ่านโดยไม่แตะเลย

def checker_levels(im):
    """คืนสองระดับเทาของลายตาราง หรือ None ถ้ากรอบนอกไม่ใช่ลายตาราง"""
    px = im.load()
    w, h = im.size
    edge = []
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            edge.append(px[x, y])
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            edge.append(px[x, y])

    grays = [p for p in edge if max(p) - min(p) <= 8]
    if len(grays) < 0.70 * len(edge):        # ขอบมีสีสัน = ภาพเต็มกรอบ ไม่ใช่พื้นโปร่ง
        return None
    vals = [sum(p) / 3.0 for p in grays]
    top = [v for v, _ in Counter(round(v / 4) * 4 for v in vals).most_common(4)]
    lo, hi = min(top), max(top)
    if hi - lo < 20:                         # พื้นเรียบสีเดียว (ดำสนิท) ไม่ใช่ลายตาราง
        return None
    near_lo = sum(1 for v in vals if abs(v - lo) <= 10)
    near_hi = sum(1 for v in vals if abs(v - hi) <= 10)
    if near_lo < 0.2 * len(vals) or near_hi < 0.2 * len(vals):
        return None                          # ระดับเดียวครองพื้นที่ = ไม่ใช่ตารางสลับ
    return lo, hi


def strip_checker(im, pad=16):
    """ถมลายตารางด้วยสีพื้นเกม — คืน (ภาพ, จำนวนพิกเซลที่ถม)

    ใช้การไล่ระบายจากขอบเข้ามา (flood fill) ไม่ใช่การกวาดทั้งภาพ
    ส่วนที่เป็นตัวไอเทมซึ่งบังเอิญเป็นเทาระดับเดียวกันจึงไม่โดนลบตามไปด้วย
    เพราะมันไม่ได้ต่อกับขอบภาพ
    """
    lv = checker_levels(im)
    if not lv:
        return im, 0
    lo, hi = lv
    px = im.load()
    w, h = im.size

    def isbg(p):
        if max(p) - min(p) > 14:             # มีสี = เป็นตัวไอเทม ไม่ใช่พื้น
            return False
        g = sum(p) / 3.0
        return lo - pad <= g <= hi + pad

    seen = [bytearray(h) for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[x][y] and isbg(px[x, y]):
                seen[x][y] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[x][y] and isbg(px[x, y]):
                seen[x][y] = 1
                q.append((x, y))

    n = 0
    while q:
        x, y = q.popleft()
        n += 1
        px[x, y] = BG
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = x + dx, y + dy
            if 0 <= a < w and 0 <= b < h and not seen[a][b] and isbg(px[a, b]):
                seen[a][b] = 1
                q.append((a, b))
    return im, n


def corner_color(im, k=10):
    """สีพื้นของภาพ — เอามัธยฐานของสี่มุม กันมุมใดมุมหนึ่งบังเอิญมีของอยู่"""
    px = im.load()
    w, h = im.size
    k = min(k, w // 2, h // 2) or 1
    samples = []
    for ox, oy in ((0, 0), (w - k, 0), (0, h - k), (w - k, h - k)):
        for x in range(ox, ox + k):
            for y in range(oy, oy + k):
                samples.append(px[x, y])
    samples.sort(key=lambda p: sum(p))
    return samples[len(samples) // 2]


def pad_square(im):
    """ยืดผืนผ้าใบให้เป็นจัตุรัสด้วยสีพื้นของภาพเอง

    ต้นฉบับสัดส่วนต่างกันสุดขั้ว (0.50 ถึง 1.84) แต่กรอบไอคอนบนจอเป็นจัตุรัสหมด
    ถ้าปล่อยให้ object-fit:cover ไปครอบเอง ตัวที่ผอมสูงอย่าง 🧪 ยาเพิ่มสมาธิ
    จะเหลือแต่ท่อนกลางขวดจนดูไม่ออกว่าเป็นอะไร · ถมพื้นให้เป็นจัตุรัสตั้งแต่ตอนฝัง
    ของทั้งชิ้นจึงอยู่ครบในกรอบ และเพราะถมด้วยสีพื้นของภาพเอง รอยต่อจึงมองไม่เห็น
    """
    w, h = im.size
    if w == h:
        return im
    s = max(w, h)
    out = Image.new('RGB', (s, s), corner_color(im))
    out.paste(im, ((s - w) // 2, (s - h) // 2))
    return out


def encode(path, max_w, quality):
    im = Image.open(path)
    if im.mode == 'RGBA':                           # ไอคอนวางบนพื้นเข้ม ถมพื้นแล้วไฟล์เล็กกว่ามาก
        bg = Image.new('RGB', im.size, BG)
        bg.paste(im, mask=im.split()[3])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')

    im, stripped = strip_checker(im)
    orig = im.size                                  # ขนาดต้นฉบับจริง ไว้รายงานให้คนอ่านเห็น
    im = pad_square(im)

    w0, h0 = im.size
    w = min(max_w, w0)                              # ไม่ขยายเกินต้นฉบับ ขยายแล้วได้แต่ความเบลอ
    h = max(1, round(h0 * w / w0))
    if (w, h) != (w0, h0):
        im = im.resize((w, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue(), orig, (w, h), stripped


EXTS = ('.jpg', '.jpeg', '.png', '.webp')


def resolve(path):
    """หาไฟล์จริงจาก path ที่ประกาศไว้ในฟิลด์ image

    ยอมรับนามสกุลอื่นและตำแหน่งอื่นด้วย เพราะเจ้าของ repo อัปโหลดผ่านเว็บ GitHub
    ไฟล์จึงมาโผล่ที่รากบ้าง เป็น .jpg แทน .png บ้าง — ตัวชี้ขาดคือ "ชื่อไอเทม" ไม่ใช่นามสกุล
    """
    roots = [HERE, os.path.dirname(HERE)]
    stem = os.path.splitext(os.path.basename(path))[0]
    cand = []
    for r in roots:
        cand.append(os.path.join(r, path))                       # ตามที่ประกาศไว้เป๊ะ ๆ
    for r in roots:
        for d in (os.path.dirname(path), 'assets/items', 'assets/cards', ''):
            for e in EXTS:
                cand.append(os.path.join(r, d, stem + e))
    for c in cand:
        if os.path.exists(c):
            return c
    return None


def main(argv):
    only = set(a for a in argv if not a.startswith('-'))
    clear = '--clear' in argv

    src = io.open(GAME, encoding='utf-8').read()
    before = len(src.encode('utf-8'))
    items = list(ITEM_RE.finditer(src))
    if not items:
        sys.exit('หาฟิลด์ image/img ใน ITEMS ไม่เจอ — โครง ITEMS ถูกแก้ไปแล้วหรือเปล่า')
    print('พบไอเทมที่ผูกภาพไว้ %d ตัว' % len(items))

    if clear:
        out = ITEM_RE.sub(lambda m: m.group(0)[:m.start('data') - m.start()] +
                          m.group(0)[m.end('data') - m.start():], src)
        io.open(GAME, 'w', encoding='utf-8').write(out)
        print('ถอดภาพออกครบทุกตัวแล้ว — ไอเทมกลับไปใช้อีโมจิเหมือนเดิม')
        return

    # หาไฟล์ให้ครบก่อน แล้วค่อยเลือกคุณภาพที่ทำให้ไฟล์รวมไม่ทะลุเพดาน
    jobs, missing = [], []
    for m in items:
        if only and m.group('id') not in only:
            continue
        real = resolve(m.group('path'))
        if real:
            jobs.append((m, real))
        else:
            missing.append((m.group('id'), m.group('name'), m.group('path')))

    for iid, name, path in missing:
        print('  ข้าม %-10s %-20s ← ไม่พบไฟล์ %s' % (iid, name, path))
    if not jobs:
        sys.exit('\nไม่มีไฟล์ให้ฝังสักตัว — วางไฟล์ภาพตามชื่อในฟิลด์ image ก่อน')

    kept = sum(len(m.group('data')) for m in items) - sum(len(m.group('data')) for m, _ in jobs)
    for max_w, quality in LADDER:
        enc, total = {}, 0
        for m, real in jobs:
            raw, orig, used, stripped = encode(real, max_w, quality)
            b64 = base64.b64encode(raw).decode()
            enc[m.group('id')] = (b64, raw, orig, used, stripped)
            total += len(b64)
        projected = (before - sum(len(m.group('data')) for m, _ in jobs) + total) / 1024
        print('\nลอง %dpx q%d → ภาพรวม %.0f KB · ไฟล์เกมจะเป็น %.0f KB'
              % (max_w, quality, total / 1024, projected))
        if projected <= BUDGET_KB:
            break
    else:
        sys.exit('หยุด: ต่อให้บีบสุดบันไดแล้วไฟล์รวมก็ยังทะลุเพดาน %d KB' % BUDGET_KB)

    for m, real in jobs:
        b64, raw, orig, used, stripped = enc[m.group('id')]
        print('  %-10s %-20s %dx%d → %dx%d  WebP %.1f KB → base64 %.1f KB%s'
              % (m.group('id'), m.group('name'), orig[0], orig[1], used[0], used[1],
                 len(raw) / 1024, len(b64) / 1024,
                 ('  · ถมลายตาราง %d px' % stripped) if stripped else ''))

    def swap(m):
        e = enc.get(m.group('id'))
        if not e:
            return m.group(0)
        s = m.start()
        return (m.group(0)[:m.start('data') - s] + 'data:image/webp;base64,' + e[0] +
                m.group(0)[m.end('data') - s:])

    out = ITEM_RE.sub(swap, src)
    after = len(out.encode('utf-8'))
    print('\nไฟล์เกม %.0f KB → %.0f KB (เพดาน %d KB)' % (before / 1024, after / 1024, BUDGET_KB))
    if after / 1024 > BUDGET_KB:
        sys.exit('หยุด: ไฟล์รวมทะลุเพดานแล้ว ไม่เขียนทับ')

    io.open(GAME, 'w', encoding='utf-8').write(out)
    print('ฝังภาพเรียบร้อย %d ตัว%s'
          % (len(jobs), (' · ยังขาดอีก %d ตัว' % len(missing)) if missing else ''))
    if kept:
        print('(ตัวที่ไม่ได้สั่งฝังรอบนี้ ภาพเดิมยังอยู่ครบ)')


if __name__ == '__main__':
    main(sys.argv[1:])
