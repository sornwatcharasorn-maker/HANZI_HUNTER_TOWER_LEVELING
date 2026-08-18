# -*- coding: utf-8 -*-
"""embed_hero_art.py — ฝังเฟรมฮีโร่ 43 เฟรมจากสไปรต์ชีตชุดใหม่ (ชั้น v6.5)

    python3 embed_hero_art.py                   ฝังครบทั้ง 43 เฟรม
    python3 embed_hero_art.py S1_01 S3_16       ฝังเฉพาะบางเฟรม
    python3 embed_hero_art.py --clear           ถอดเฟรมทั้งหมด กลับไปใช้ฮีโร่ SVG ของ v6.0
    python3 embed_hero_art.py --pal 40          บังคับจำนวนสีเอง (ข้ามบันได)
    python3 embed_hero_art.py --w 140 --h 88    บังคับขนาดกรอบเฟรมเอง
    python3 embed_hero_art.py --dry             ดูตัวเลขเฉย ๆ ไม่เขียนทับ
    python3 embed_hero_art.py --dry --preview   พ่น hero_art_preview.png ไว้ตรวจงานด้วยตา

เขียนลง **ต้นฉบับ** เสมอ แล้วสั่ง build ให้เองปิดท้าย (กับดักข้อ 28)
ห้ามให้เขียนลงไฟล์แจกตรง ๆ — build รอบถัดไปจะทับทิ้งทั้งหมด

────────────────────────────────────────────────────────────────────────────
ตัวนี้มาแทน "ส่วนฮีโร่" ของ embed_arena_art.py ทั้งก้อน (ชีต HERO1-3 ชุดเก่า)
ส่วนฉากหลัง 6 ฉากยังเป็นของ embed_arena_art.py เหมือนเดิม ไม่ได้ถูกแตะเลย

สามเรื่องที่ตัวนี้ทำคนละท่ากับ embed_arena_art.py และเหตุผล

1) **พื้นหลังเป็นสีดำสนิท ไม่ใช่ลายหมากรุก** — ชีตชุดใหม่เป็น JPG พื้นดำล้วน
   (วัดจริง: ขอบภาพมีค่าสูงสุด 3 · 65% ของทั้งใบมีค่า ≤ 2) จึงใช้ black_key()
   ซึ่งลบเฉพาะ "สีดำที่ต่อเนื่องมาจากขอบภาพ" ด้วย connected component
   **ห้ามใช้เกณฑ์ความสว่างกวาดทั้งใบเด็ดขาด** เสื้อโค้ทของตัวละครก็ดำเกือบสนิท
   เหมือนกัน (ลองมาแล้วด้วย thr=26 — โค้ทหายไปครึ่งตัวทุกเฟรม เหลือแต่ดาบลอย)
   เกณฑ์ที่ใช้จริงคือ **6** ซึ่งอยู่เหนือ noise ของ JPEG แต่ต่ำกว่าเนื้อโค้ท

   ปิดท้ายด้วย binary_closing + binary_fill_holes เพื่อกู้ "ดำสนิทที่อยู่ข้างใน
   เส้นขอบตัวละคร" กลับมา (รูที่ไม่ติดขอบภาพ = อยู่ในตัวสไปรต์แน่นอน)
   แล้วทิ้งจุดจิ๋วที่เป็น noise ล้วนด้วยการกรองขนาด connected component

2) **เข้ารหัสด้วย "ลดจำนวนสี → WebP lossless" ไม่ใช่ WebP lossy**
   วัดจริงกับเฟรมชุดนี้ทั้ง 43 เฟรมที่กรอบ 128x80:
       lossy q50  = 111,746 ไบต์ base64
       pal48 lossless = 104,248 ไบต์ base64   ← เล็กกว่า **และคมกว่า**
   เพราะอาร์ตชุดนี้เป็นสีเข้มจัดโทนเดียว (ดำ-ม่วง-ฟ้า) มีพื้นที่สีเรียบเยอะ
   และมีขอบคมของดาบ ซึ่งเป็นเงื่อนไขที่ lossy ทำได้แย่ที่สุด (ringing รอบดาบ)
   บทเรียนเดียวกับที่ embed_monster_art.py ของ v6.2 เจอมาก่อน

3) **หันขวาเสมอ** — ฮีโร่ยืนฝั่งซ้ายของสนาม สคริปต์จึงพลิกให้ตั้งแต่ตอนสกัด
   ตัวเกมไม่ต้องรู้เรื่องนี้เลยและไม่ต้องใช้ CSS scaleX() ตอนรัน (ซึ่งจะไปชนกับ
   .ba-atk ที่ใช้ transform อยู่แล้ว แล้วท่าพุ่งจะกลับด้าน)
   ทิศทางเดาเองไม่ได้ **FACE_LEFT คือรายชื่อเฟรมที่ต้นฉบับหันซ้าย วัดจากภาพจริง**
   (กติกาเดียวกับ HERO_FRAMES ของ v6.1 · FOE_FRAMES ของ v6.2 · TR_ART_Z ของ v4.5)

────────────────────────────────────────────────────────────────────────────
พิกัดกริดอยู่ที่ HERO_GRID ในสคริปต์นี้ **ไม่ได้อยู่ในตัวเกม** เพราะเป็นเรื่องของ
"ตอนสกัด" ล้วน ๆ ตัวเกมได้เฟรมที่ตัดเสร็จแล้วไปใช้ ไม่เคยเห็นสไปรต์ชีตเลย
(กติกาเดียวกับ FOE_FRAMES ของ v6.2) · สิ่งที่อยู่ในเกมคือ "ชื่อเฟรม + ภาพ"
กับ "ลำดับแอนิเมชัน" (BA_ANIM) ซึ่งเป็นเรื่องของตอนรันจริง ๆ
"""

import base64
import glob
import io
import os
import re
import sys

import embed_common

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('ต้องมี Pillow ก่อน — pip install Pillow')
try:
    import numpy as np
    from scipy import ndimage
except ImportError:
    sys.exit('ต้องมี numpy + scipy ก่อน — pip install numpy scipy')

HERE = os.path.dirname(os.path.abspath(__file__))
GAME, DIST, ROOT = embed_common.resolve_game(HERE)

# ── กรอบเฟรมบนจอ ──────────────────────────────────────────────────────────
# .ba-fig แสดงจริงที่ 98x60 CSS px (จอแคบ 86 · จอกว้าง 116) กรอบ 128x80 จึงอยู่ราว
# DPR 1.3 ซึ่งเป็นเพดานที่ "43 เฟรม" พาไปได้ภายใต้เพดานไฟล์ 2MB
# **อย่าดันขึ้นไปกว่านี้โดยไม่วัดที่ว่างก่อน** ทุก 4px ของความกว้างกินราว 3KB
FRAME_W, FRAME_H = 128, 80

# บันไดจำนวนสี — ไล่ลงจนกว่าไฟล์รวมจะไม่ทะลุเพดาน
PAL_LADDER = [64, 56, 48, 40, 32, 24]

# กันที่ว่างขั้นต่ำหลังฝังเสร็จ — เหตุผลเดียวกับ RESERVE ของ embed_monster_art.py
# ถ้าปล่อยให้บันไดหยุดที่ขั้น "พอดีเป๊ะ" การแก้ข้อความบรรทัดเดียวในรอบถัดไป
# จะดันไฟล์ทะลุเพดานทันที
RESERVE = 20000

SHEET_FILES = {1: 'sung jin woo1', 2: 'sung jin woo2', 3: 'sung jin woo3'}
SHEET_EXT = ('.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG')
SHEET_DIRS = ('', 'assets', os.path.join('assets', 'hero'), os.path.join('assets', 'arena'))


def _grid():
    """พิกัดตัดเฟรมเป็น % ของขนาดชีต — ตรงกับสารบัญที่สเปกให้มาทุกช่อง

    ชีต 1 = กริด 4x4 เท่ากันหมด (16 เฟรม)
    ชีต 2 = แถวบน 4 ช่อง (กว้าง 25%) · อีกสองแถวแถวละ 3 ช่อง (กว้าง 33.33%) = 10 เฟรม
    ชีต 3 = แถวบน 5 ช่อง (กว้าง 20%) · อีกสามแถวแถวละ 4 ช่อง (กว้าง 25%) = 17 เฟรม
    """
    g = []
    for i in range(16):                       # S1_01 .. S1_16
        g.append(('S1_%02d' % (i + 1), 1, (i % 4) * 25.0, (i // 4) * 25.0, 25.0, 25.0))
    for i in range(4):                        # S2_01 .. S2_04
        g.append(('S2_%02d' % (i + 1), 2, i * 25.0, 0.0, 25.0, 100.0 / 3))
    for i in range(6):                        # S2_05 .. S2_10
        g.append(('S2_%02d' % (i + 5), 2, (i % 3) * (100.0 / 3),
                  100.0 / 3 + (i // 3) * (100.0 / 3), 100.0 / 3, 100.0 / 3))
    for i in range(5):                        # S3_01 .. S3_05
        g.append(('S3_%02d' % (i + 1), 3, i * 20.0, 0.0, 20.0, 25.0))
    for i in range(12):                       # S3_06 .. S3_17
        g.append(('S3_%02d' % (i + 6), 3, (i % 4) * 25.0, 25.0 + (i // 4) * 25.0, 25.0, 25.0))
    return g


HERO_GRID = _grid()

# เฟรมที่ต้นฉบับ "หันซ้าย" → ต้องพลิกให้หันขวา  (วัดจากภาพจริงทีละเฟรม)
# เฟรมที่หันหน้าตรงเข้าหาคนดู (ท่ายืนกลางเปลวไฟ) ไม่ต้องอยู่ในรายการนี้
FACE_LEFT = {
    'S1_05', 'S1_06', 'S1_07', 'S1_09', 'S1_15',
    'S2_05', 'S2_06', 'S2_07',
    'S3_06', 'S3_07', 'S3_10', 'S3_11', 'S3_12',
}

BLACK_THR = 6        # เกณฑ์ "ดำจนถือว่าเป็นพื้นหลัง" — ดูเหตุผลข้อ 1 ที่หัวไฟล์
CLOSE_IT = 2         # ปิดรอยแยกบาง ๆ ก่อนถมรูข้างใน
MIN_BLOB = 60        # จุดที่เล็กกว่านี้คือ noise ของ JPEG ล้วน


# ══ ตัวช่วยไฟล์ ═══════════════════════════════════════════════════════════
def resolve(prefix):
    """หาไฟล์ที่ชื่อ 'ขึ้นต้นด้วย' prefix — ลองหลายโฟลเดอร์และหลายนามสกุล

    เจ้าของ repo อัปโหลดผ่านเว็บ GitHub ไฟล์จึงมาโผล่ที่รากrepo ได้
    (กติกาเดียวกับ resolve() ของ embed_arena_art.py / embed_card_art.py)
    """
    for d in SHEET_DIRS:
        base = os.path.join(ROOT, d) if d else ROOT
        if not os.path.isdir(base):
            continue
        hits = [p for p in sorted(glob.glob(os.path.join(base, prefix + '*')))
                if os.path.splitext(p)[1] in SHEET_EXT]
        if hits:
            return hits[0]
    return None


def read_game():
    with io.open(GAME, encoding='utf-8') as f:
        return f.read()


def write_game(s):
    with io.open(GAME, 'w', encoding='utf-8') as f:
        f.write(s)


def anim_ids(src):
    """อ่าน BA_ANIM ในตัวไฟล์เกม → คืน (ชุด id ของท่ายืน, ชุด id ที่ถูกอ้างถึงทั้งหมด)

    สารบัญลำดับแอนิเมชันอยู่ในเกมที่เดียว สคริปต์อ่านไปใช้ตัดสินว่าเฟรมไหนเป็น
    'idle' เฟรมไหนเป็น 'act' จึงไม่มีแผนที่ชุดที่สองให้ต้องซิงก์กัน
    (กติกาเดียวกับที่ embed_arena_art.py อ่าน BA_SCENES)
    """
    m = re.search(r'const BA_ANIM = \{(.*?)\n    \};', src, re.S)
    if not m:
        return set(), set()
    idle, used = set(), set()
    # **ต้องจับข้ามบรรทัด** — normal_attack กับ critical_strike เขียนคร่อมหลายบรรทัด
    # ถ้าไล่ทีละบรรทัดจะอ่านเจอแค่ชุดที่เขียนบรรทัดเดียว แล้วเฟรมที่เหลือจะถูกตีตรา
    # ว่า "ไม่ถูกอ้างถึง" ทั้งที่ใช้อยู่จริง (เจอมาแล้วตอนรันรอบแรก — รายงานผิด 19 เฟรม)
    for k, body in re.findall(r"([a-z_]+)\s*:\s*\[([^\]]*)\]", m.group(1), re.S):
        ids = re.findall(r"'([A-Z0-9_]+)'", body)
        used.update(ids)
        if k == 'idle':
            idle.update(ids)
    return idle, used


# ══ ถอดพื้นดำ ════════════════════════════════════════════════════════════
def black_key(im, thr=BLACK_THR, close=CLOSE_IT, minblob=MIN_BLOB, feather=0.8):
    """คืน RGBA ที่พื้นดำของสไปรต์ชีตกลายเป็นโปร่งใส — เหตุผลของแต่ละขั้นอยู่หัวไฟล์"""
    a = np.asarray(im.convert('RGB'), np.int32)
    dark = a.max(axis=2) <= thr

    # พื้นหลัง = สีดำที่ "ต่อเนื่องมาจากขอบภาพ" เท่านั้น
    # ดำที่อยู่ข้างในตัวละคร (เสื้อโค้ท) ไม่ติดขอบ จึงรอด
    lab, n = ndimage.label(dark, np.ones((3, 3)))
    bg = np.zeros_like(dark)
    if n:
        edge = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
        edge.discard(0)
        if edge:
            bg = np.isin(lab, list(edge))

    fg = ~bg
    if close:
        fg = ndimage.binary_closing(fg, ndimage.generate_binary_structure(2, 1), iterations=close)
    fg = ndimage.binary_fill_holes(fg)

    lab, n = ndimage.label(fg, np.ones((3, 3)))
    if n:
        sz = np.bincount(lab.ravel())
        sz[0] = 0
        fg = np.isin(lab, np.nonzero(sz >= minblob)[0])

    al = Image.fromarray((fg * 255).astype(np.uint8), 'L')
    if feather:
        al = al.filter(ImageFilter.GaussianBlur(feather))
    out = im.convert('RGBA')
    out.putalpha(al)
    return out


def cut(sheet, x, y, w, h):
    """ครอปหนึ่งช่องของกริดจากพิกัดที่เป็น % ของขนาดชีต"""
    W, H = sheet.size
    return sheet.crop((int(round(x / 100.0 * W)), int(round(y / 100.0 * H)),
                       int(round(min(100.0, x + w) / 100.0 * W)),
                       int(round(min(100.0, y + h) / 100.0 * H))))


def drop_bleed(cell_im, keep_ratio=0.18):
    """ทิ้ง "เศษของเฟรมข้างเคียง" ที่ล้ำเข้ามาในช่องนี้

    ตัวละครในชีตต้นฉบับล้นกรอบช่องของตัวเองได้ ตอนตัดตามกริดจึงมีไหล่/ดาบของ
    เฟรมข้าง ๆ ติดมาเป็นก้อนลอย ๆ ริมขอบ (เห็นชัดที่ S1_02 · S1_03 ตอนลองรอบแรก)

    เกณฑ์: เก็บก้อนที่ใหญ่ที่สุดไว้เสมอ แล้วเก็บก้อนอื่นเฉพาะที่ **ใหญ่พอ**
    (>= keep_ratio ของก้อนหลัก) **หรือซ้อนอยู่ในกรอบของก้อนหลัก** — ดาบ/ลำแสง
    ที่หลุดออกมาลอยจะยังอยู่ครบ เพราะมันพาดอยู่ในกรอบของตัวละครเสมอ
    ส่วนเศษของเฟรมข้างเคียงจะอยู่ริมสุดนอกกรอบนั้น
    """
    al = np.asarray(cell_im.split()[3])
    lab, n = ndimage.label(al > 8, np.ones((3, 3)))
    if n <= 1:
        return cell_im
    sz = np.bincount(lab.ravel())
    sz[0] = 0
    main = int(np.argmax(sz))
    sl = ndimage.find_objects(lab)
    my, mx = sl[main - 1]
    keep = np.zeros(len(sz), bool)
    for i in range(1, len(sz)):
        if not sz[i]:
            continue
        y, x = sl[i - 1]
        inside = x.start >= mx.start and x.stop <= mx.stop and y.start >= my.start and y.stop <= my.stop
        keep[i] = (i == main) or inside or sz[i] >= sz[main] * keep_ratio
    m = keep[lab]
    out = cell_im.copy()
    out.putalpha(Image.fromarray((np.asarray(cell_im.split()[3]) * m).astype(np.uint8), 'L'))
    return out


def make_frame(sheet, box, flip, fw, fh):
    """ครอปหนึ่งท่า → ทิ้งเศษของเฟรมข้างเคียง → ตัดขอบว่าง → พลิกให้หันขวา → ชิดพื้น"""
    c = drop_bleed(cut(sheet, *box))
    bb = c.split()[3].getbbox()
    if bb:
        c = c.crop(bb)
    if flip:
        c = c.transpose(Image.FLIP_LEFT_RIGHT)
    r = min((fw - 2) / float(c.width), (fh - 2) / float(c.height))
    c = c.resize((max(1, int(round(c.width * r))), max(1, int(round(c.height * r)))),
                 Image.LANCZOS)
    f = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    # ชิดพื้นเสมอ — ทุกท่าจึงยืนอยู่บนระดับเดียวกัน ไม่ลอยขึ้นลงตอนสลับท่า
    f.alpha_composite(c, ((fw - c.width) // 2, fh - c.height))
    return f


# ══ เข้ารหัส ═════════════════════════════════════════════════════════════
def encode(im, pal):
    """ลดจำนวนสี → WebP lossless — เหตุผลว่าทำไมไม่ใช่ lossy อยู่ข้อ 2 ที่หัวไฟล์"""
    q = im.convert('RGBA').quantize(colors=pal, method=Image.FASTOCTREE)
    b = io.BytesIO()
    q.convert('RGBA').save(b, 'WEBP', lossless=True, quality=100, method=6)
    return b.getvalue()


def uri(raw):
    return 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii')


# ══ เขียนกลับลงไฟล์เกม ═══════════════════════════════════════════════════
# **ตัวคั่นคือ [^\[\]]* โดยจำเป็น ไม่ใช่ .*?** — เนื้อในบล็อกไม่มีวงเล็บเหลี่ยมเลย
# (base64 ใช้แค่ A-Za-z0-9+/= · แต่ละแถวเป็น { id: '…', k: '…', d: '…' })
# การผูกแบบนี้ทำให้ regex **ข้ามไปจบที่อาร์เรย์ก้อนอื่นไม่ได้เลยไม่ว่าบล็อกจะถูก
# เขียนไว้รูปแบบไหน** — ของเดิมใช้ `(.*?)(\n    \];)` แล้วพังจริงมาแล้ว: พอเจอบล็อก
# ที่ถูกเขียนเป็นบรรทัดเดียว (`const BA_HERO = [];` ซึ่ง embed_arena_art.py เคยเขียน)
# ตัวปิดแบบหลายบรรทัดจะไม่ตรง regex จึงวิ่งเลยไปจบที่ `];` ของ BA_FOES
# แล้วกลืนสารบัญอสูรทั้งก้อนหายไปโดยไม่มี error ให้เห็น
BLOCK_RE = re.compile(r'(const BA_HERO = \[)([^\[\]]*)(\];)')


def write_block(src, frames, idle_ids):
    """frames = [(id, data_uri)] เรียงตามลำดับของ HERO_GRID"""
    if not BLOCK_RE.search(src):
        sys.exit('หา const BA_HERO ในไฟล์เกมไม่เจอ — ชั้นสนามรบถูกถอดออกไปหรือเปล่า')
    if not frames:
        body = ''
    else:
        rows = []
        for fid, d in frames:
            k = 'idle' if fid in idle_ids else 'act'
            rows.append("      { id: '%s', k: '%s', d: '%s' }" % (fid, k, d))
        body = '\n' + ',\n'.join(rows) + '\n    '
    return BLOCK_RE.sub(lambda m: m.group(1) + body + m.group(3), src, count=1)


def current_bytes(src):
    m = BLOCK_RE.search(src)
    return len(m.group(2)) if m else 0


def block_b64(src):
    """ผลรวมความยาว data URI ของบล็อกฮีโร่ที่ฝังอยู่ในต้นฉบับตอนนี้"""
    m = BLOCK_RE.search(src)
    if not m:
        return 0
    return sum(len(x) for x in re.findall(r'data:image/[a-z]+;base64,[A-Za-z0-9+/=]+', m.group(2)))


def dist_after(src, new_b64, n_new):
    """เดาขนาดไฟล์แจกหลังฝัง — คืน None ถ้ายังไม่มีไฟล์แจกให้เทียบ

    **แม่นเพราะ base64 ผ่าน terser ไปเฉย ๆ ไม่ถูกย่อแม้แต่ไบต์เดียว** ส่วนต่างของ
    ไฟล์แจกจึงเท่ากับส่วนต่างของ base64 เป๊ะ บวกโครงสร้างต่อรายการอีกราว 26 ไบต์
    ({id:"S1_01",k:"act",d:""},) ซึ่งคิดตามจำนวนเฟรมที่เปลี่ยนไป

    ของเดิมใช้ embed_common.budget_kb() ซึ่งเดาจาก "ส่วนต่างต้นฉบับ-ไฟล์แจก"
    ค่านั้นเพี้ยนทันทีที่มีการเพิ่มคอมเมนต์เข้าไปในต้นฉบับ (ชั้น v6.5 เพิ่มไปเยอะ)
    รอบแรกจึงเลือกจำนวนสีสูงเกินไปแล้วเหลือที่แค่ 10KB
    """
    if not os.path.exists(DIST):
        return None
    try:
        cur = os.path.getsize(DIST)
    except OSError:
        return None
    n_old = len(re.findall(r"id:\s*'[A-Z0-9_]+'", BLOCK_RE.search(src).group(2))) if BLOCK_RE.search(src) else 0
    return cur - block_b64(src) + new_b64 + (n_new - n_old) * 26


def main():
    args = sys.argv[1:]
    dry = '--dry' in args
    clear = '--clear' in args
    preview = '--preview' in args
    pal_force = None
    fw, fh = FRAME_W, FRAME_H
    for flag, cast in (('--pal', int), ('--w', int), ('--h', int)):
        if flag in args:
            i = args.index(flag)
            v = cast(args[i + 1])
            if flag == '--pal':
                pal_force = v
            elif flag == '--w':
                fw = v
            else:
                fh = v
            del args[i:i + 2]
    keep_all = '--all' in args
    only = [a for a in args if not a.startswith('--')]

    src = read_game()
    idle_ids, used_ids = anim_ids(src)
    if not idle_ids:
        print('⚠️  อ่าน BA_ANIM ไม่ได้ — จะตีตราทุกเฟรมเป็นท่าโจมตี')

    if clear:
        out = write_block(src, [], idle_ids)
        if dry:
            print('(--dry: ไม่ได้เขียนทับอะไร)')
            return
        write_game(out)
        print('ถอดเฟรมฮีโร่ออกครบทุกเฟรม — กลับไปใช้ฮีโร่ SVG ของ v6.0')
        embed_common.rebuild(HERE)
        return

    # ── โหลดชีตแล้วถอดพื้นดำทีเดียว ────────────────────────────────────
    sheets = {}
    for n, pre in SHEET_FILES.items():
        p = resolve(pre)
        if not p:
            sys.exit('หาไฟล์สไปรต์ชีตไม่เจอ: %s* (วางไว้ที่รากrepo ได้เลย)' % pre)
        print('  ถอดพื้นดำ %s …' % os.path.basename(p))
        sheets[n] = black_key(Image.open(p))

    # ── ฝังเฉพาะเฟรมที่ BA_ANIM อ้างถึงจริง (ค่าเริ่มต้นตั้งแต่ชั้น v6.6) ──────
    # ต้นฉบับมี 43 เฟรม แต่ BA_ANIM อ้างถึงแค่ 33 อีก 10 เฟรมถูกฝังไว้เผื่อลำดับ
    # ใหม่ในอนาคต ซึ่งกินที่ราว 27KB ของไฟล์แจกโดยไม่มีใครได้เห็นสักครั้ง
    # ชั้น v6.6 ต้องการที่คืนไปให้ทัพเงา 25 ตัว จึงตัดออกเป็นค่าเริ่มต้น
    # **สั่ง --all เพื่อฝังครบทุกเฟรมเหมือนเดิม** และการระบุชื่อเฟรมมาเองยังชนะเสมอ
    grid = [g for g in HERO_GRID if not only or g[0] in only]
    if not only and not keep_all and used_ids:
        drop = [g[0] for g in grid if g[0] not in used_ids]
        if drop:
            print('  ข้าม %d เฟรมที่ BA_ANIM ไม่ได้อ้างถึง: %s' % (len(drop), ' '.join(drop)))
            print('  (สั่ง --all ถ้าต้องการฝังครบทุกเฟรมเหมือนเดิม)')
        grid = [g for g in grid if g[0] in used_ids]
    if not grid:
        sys.exit('ไม่มีเฟรมไหนตรงกับที่สั่งมาเลย — ชื่อเฟรมคือ S1_01 … S3_17')

    tiles = []
    for fid, sh, x, y, w, h in grid:
        tiles.append((fid, make_frame(sheets[sh], (x, y, w, h), fid in FACE_LEFT, fw, fh)))

    if preview:
        cols = 8
        rows = (len(tiles) + cols - 1) // cols
        pv = Image.new('RGBA', (cols * fw, rows * fh), (18, 20, 30, 255))
        for i, (fid, f) in enumerate(tiles):
            pv.alpha_composite(f, ((i % cols) * fw, (i // cols) * fh))
        out = os.path.join(HERE, 'hero_art_preview.png')
        pv.convert('RGB').save(out)
        print('  พ่นภาพตรวจงาน %s' % out)

    # ── ไล่บันไดจำนวนสีจนกว่าจะไม่ทะลุเพดาน ─────────────────────────────
    budget = embed_common.budget_kb(GAME, DIST) * 1024
    base = len(src) - current_bytes(src)
    ladder = [pal_force] if pal_force else PAL_LADDER
    picked, enc, guess = None, None, None
    for pal in ladder:
        enc = [(fid, uri(encode(f, pal))) for fid, f in tiles]
        size = sum(len(d) for _, d in enc) + len(enc) * 46      # เผื่อ id/คีย์ต่อบรรทัด
        guess = dist_after(src, sum(len(d) for _, d in enc), len(enc))
        ok = (guess + RESERVE <= embed_common.HARD_LIMIT) if guess is not None \
            else (base + size + RESERVE <= budget)
        if pal_force or ok:
            picked = pal
            break
    if picked is None:
        picked = ladder[-1]
    total = sum(len(d) for _, d in enc)

    print('')
    print('เฟรม     %d เฟรม · กรอบ %dx%d · ลดสีเหลือ %d สี → WebP lossless'
          % (len(enc), fw, fh, picked))
    print('ท่ายืน   %d เฟรม · ท่าอื่น %d เฟรม'
          % (sum(1 for f, _ in enc if f in idle_ids), sum(1 for f, _ in enc if f not in idle_ids)))
    if used_ids:
        miss = [f for f, _ in enc if f not in used_ids]
        if miss:
            print('หมายเหตุ  %d เฟรมยังไม่ถูกอ้างใน BA_ANIM: %s' % (len(miss), ' '.join(miss)))
    print('ภาพรวม   %s ไบต์ base64 (เฉลี่ย %d/เฟรม)' % (format(total, ','), total // max(1, len(enc))))
    if guess is not None:
        print('ไฟล์แจก  จะได้ราว %s ไบต์ · เหลือถึงเพดาน %s อีกราว %s ไบต์'
              % (format(guess, ','), format(embed_common.HARD_LIMIT, ','),
                 format(embed_common.HARD_LIMIT - guess, ',')))

    out = write_block(src, enc, idle_ids)
    print('ต้นฉบับ  %s ไบต์' % format(len(out), ','))
    if dry:
        print('')
        print('(--dry: ไม่ได้เขียนทับอะไร)')
        return
    write_game(out)
    print('เขียนลงต้นฉบับแล้ว — กำลังย่อไฟล์แจก …')
    embed_common.rebuild(HERE)


if __name__ == '__main__':
    main()
