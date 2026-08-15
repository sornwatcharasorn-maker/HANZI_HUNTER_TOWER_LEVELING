# -*- coding: utf-8 -*-
"""embed_monster_art.py — ฝังเฟรมอสูรประจำชั้น 18 ตัวจากสไปรต์ชีต (ชั้น v6.2)

    python3 embed_monster_art.py                ฝังทุกตัวที่หาไฟล์เจอ
    python3 embed_monster_art.py m12 m53        ฝังเฉพาะบางตัว
    python3 embed_monster_art.py --clear        ถอดภาพทุกตัว กลับไปใช้อีโมจิของ v4.0
    python3 embed_monster_art.py --pal 40       บังคับจำนวนสีเอง (ข้ามบันได)
    python3 embed_monster_art.py --w 160 --h 105  บังคับขนาดเฟรม
    python3 embed_monster_art.py --dry          ดูตัวเลขเฉย ๆ ไม่เขียนทับ
    python3 embed_monster_art.py --preview      พ่น monster_art_preview.png ไว้ตรวจงานด้วยตา

เขียนลง **ต้นฉบับ** เสมอ แล้วสั่ง build ให้เองปิดท้าย (กับดักข้อ 28)
ห้ามให้เขียนลงไฟล์แจกตรง ๆ — build รอบถัดไปจะทับทิ้งทั้งหมด

────────────────────────────────────────────────────────────────────────────
สามเรื่องที่สคริปต์นี้ทำ และเหตุผลที่ท่าอื่นใช้ไม่ได้

1) **ถอดพื้นหลังมืด** — ต้นฉบับเป็น PNG พื้นโปร่งที่ถูกแบนเป็น JPG มาแล้ว
   พื้นจึงเป็นดำสนิท (บางใบเป็นกรมท่าเข้ม) พร้อม ringing ของ JPEG รอบขอบสไปรต์

   ท่าที่ใช้คือ **hysteresis + ปิดรูแบบมีเพดาน** ไม่ใช่การ key ค่าเดียวทั้งภาพ
     • วัดสีพื้นจากกรอบขอบของ "แต่ละเซลล์" ไม่ใช่ทั้งชีต (ดูข้อ 2 ว่าทำไม)
     • เก็บก้อนที่ผ่านเกณฑ์อ่อน (weak) เฉพาะก้อนที่มีพิกเซลผ่านเกณฑ์เข้ม (strong)
       อยู่ข้างใน — ตัวมืด ๆ อย่างพฤกษาพิษจึงไม่ถูกกินหายไปทั้งตัว ขณะที่ ringing
       ของ JPEG ที่ลอยอยู่โดด ๆ ถูกทิ้ง
     • ปิดรูเฉพาะรูที่ **ไม่ติดขอบเซลล์และเล็กกว่าเพดาน** — `binary_fill_holes`
       แบบเต็มสูบจะถมพื้นหลังที่บังเอิญถูกล้อมด้วยปีก/ออร่าจนกลายเป็นสี่เหลี่ยม
       ทึบ (เจอกับมังกรผลึกกับคิเมร่ามาแล้ว)
     • อัลฟาสุดท้าย = ตัวทึบ ∪ ขอบออร่าที่ยังไล่ระดับได้ แต่จำกัดให้อยู่ติดตัว
       เท่านั้น (`near`) ไม่งั้นจะได้ฝ้าจาง ๆ ของ ringing ลอยรอบตัวไปทั่ว

   **ห้ามใช้ luminance key (มืด = โปร่ง)** จะกินเงาในตัวสไปรต์หายไปหมด —
   ปีกข้างไกลของมังกรผลึกถูกวาดเป็นสีเกือบดำโดยตั้งใจ ตัวนั้นต้องอยู่

2) **หั่นกริด** — ทุกชีตในชุดนี้เป็นกริดสม่ำเสมอ (cols × rows) จึงหั่นด้วยการหาร
   ตรง ๆ ไม่ต้องเดาช่องว่างระหว่างเฟรม ซึ่งเดาไม่ได้อยู่แล้วเพราะหลายใบมีลำแสง/
   สายฟ้าพาดเชื่อมเฟรมติดกัน (ผู้พิทักษ์จักรกลเวท · โกเลมหินอันเดด)

   **ต้อง key ทีละเซลล์ ไม่ใช่ทั้งชีตรวดเดียว** — ปีกของมังกรสองตัวที่อยู่ติดกัน
   ในกริด 2×2 ไปบรรจบกันพอดีตรงรอยต่อ พื้นหลังตรงนั้นเลยกลายเป็น "รูปิด" ที่ไม่
   ติดขอบภาพ แล้วถูกถมเป็นแถบดำคาดกลางจอ (เจอมาแล้ว)

3) **อบขนาดตัวไว้ในภาพ** — สเกลคิดจากความสูงของกรอบตัวใน **เฟรมยืน** ตัวเดียว
   แล้วใช้สเกลนั้นกับทุกเฟรมของตัวนั้น พร้อมยึดจุดอ้างอิงเดียวกัน (กึ่งกลาง-ล่าง
   ของกรอบตัวในเฟรมยืน) ทะเบียนของอนิเมชันจึงตรงเป๊ะทุกเฟรม ตัวไม่กระโดดตอนสลับท่า

   **ห้ามใช้กรอบของแต่ละเฟรมเองมาคิดสเกล** เฟรมโจมตีมีออร่า/ลำแสงกินพื้นที่กว่าเท่าตัว
   ถ้าคิดจากกรอบตัวเอง ตัวอสูรจะหดลงทุกครั้งที่ฟาด แล้วขยายกลับตอนยืน

   บอสถูกอบให้สูงกว่าอสูรธรรมดา (BODY_BOSS vs BODY) **CSS จึงไม่ต้องรู้ว่าตัวไหน
   เป็นบอส** ใช้กรอบ .ba-mon ใบเดียวกันหมด ภาพเรนเดอร์อัตราส่วนเดียวเสมอ ไม่เบลอ

────────────────────────────────────────────────────────────────────────────
ทำไมเข้ารหัสเป็น "ลดจำนวนสี → WebP lossless" ไม่ใช่ WebP lossy ตามชุดอื่น

วัดจริงกับชุดนี้แล้ว lossy q72 ให้ไฟล์ **ใหญ่กว่า** pal48+lossless เกือบเท่าตัวใน
หลายตัว (พลาสมาแฟนทอม 10,318 → 5,228 ไบต์) เพราะเป็นพิกเซลอาร์ตที่มีขอบคมกับ
พื้นที่สีเรียบเยอะ ซึ่งเป็นเงื่อนไขที่ lossy ทำได้แย่ที่สุด (ringing รอบทุกขอบ)
และ **ยังคมกว่าด้วย** ไม่มีรอยเปื้อนรอบเส้นขอบดำ
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

# ── ขนาดเฟรม ──────────────────────────────────────────────────────────────
# กรอบบนจอคือ BA_MON_W × BA_MON_H = 109×72 CSS px (ประกาศไว้ในตัวเกม)
# 176×116 จึงเป็น DPR ~1.6 ซึ่งพอดีกับพิกเซลอาร์ตที่ตัวพิกเซลใหญ่อยู่แล้ว
# **อย่าดันขึ้นไปกว่านี้** base64 ผ่าน terser ไปเฉย ๆ ไม่ถูกย่อแม้แต่ไบต์เดียว
# เติมกี่ไบต์ก็โตขึ้นเท่านั้นเป๊ะ (กติกาเดียวกับ AU_BGM_SRC ของ v5.1)
FRAME_W, FRAME_H = 176, 116

# ความสูงของ "ตัว" ที่อบไว้ในเฟรม (พิกเซลของ FRAME_H)
# ฮีโร่สูงเต็ม 60/60 ของกรอบตัวเอง → อสูรธรรมดา 92/116×72 ≈ 57px บนจอ (เตี้ยกว่าฮีโร่นิด)
# บอส 100/116×72 ≈ 62px (สูงกว่าอสูรธรรมดาราว 9% และสูงกว่าฮีโร่เล็กน้อย)
#
# **เพดานของบอสคือ 65px และเป็นตัวเลขที่วัดมา ไม่ใช่เดา** — ช่องว่างจากขอบล่างพินอิน
# ลงมาถึงพื้นที่ยืนเหลือ 65.3px บนจอ 430+ (จอกว้างขึ้นแล้วอักษรจีนโตเป็น 37px
# แถบโจทย์เลยกินที่ลงมามากกว่าจอแคบ) ร่างแรกตั้ง BODY_BOSS = 112 แล้วหัวบอส
# ขึ้นไปคร่อมพินอิน 4.2px ซึ่งผิดข้อกำหนดข้อ 3 ตรง ๆ — verify_monsters.js จับได้
# **ขยับเมื่อไหร่ต้องรัน verify_monsters.js ใหม่ทุกครั้ง**
BODY, BODY_BOSS = 92, 100

# บันไดจำนวนสี — ไล่ลงจนกว่าไฟล์แจกจะลงเพดาน 2,000,000 โดยยังเหลือที่ตาม RESERVE
PAL_LADDER = [56, 48, 40, 32, 24]

# ที่ว่างขั้นต่ำที่ต้องเหลือหลังฝัง (ไบต์ของไฟล์แจก)
# **จำเป็น ไม่ใช่ความระแวง** — ถ้าปล่อยให้บันไดหยุดที่ขั้นแรกที่ "พอดีเป๊ะ" ชุดนี้จะกิน
# ที่จนเหลือ 1,504 ไบต์ แล้วการแก้ข้อความบรรทัดเดียวในรอบถัดไปจะดันไฟล์ทะลุเพดานทันที
# วัดจริงแล้วสายตาแยกไม่ออกระหว่าง 56 สีกับ 40 สีเลยสักตัว (พิกเซลอาร์ตใช้สีน้อยอยู่แล้ว)
# จึงไม่มีเหตุผลจะแลกที่ว่าง 56KB กับความต่างที่มองไม่เห็น
RESERVE = 50000

EXT = ('.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG')
DIRS = ('', 'assets', os.path.join('assets', 'monsters'), os.path.join('assets', 'arena'))

# ── สารบัญการสกัด — วัดจากภาพจริงทั้งหมด สคริปต์เดาแทนไม่ได้ ─────────────
#   id: (cols, rows, เซลล์ท่ายืน, เซลล์ท่าฟาด, พลิกซ้าย-ขวาไหม, เป็นบอสไหม, สเกลชดเชย)
#
# ดรรชนีเซลล์นับจากซ้าย→ขวา แล้วบนลงล่าง (row * cols + col)
#
# **ท่ายืนต้องมีอย่างน้อย 1 เซลล์เสมอ** เพราะเป็นทั้งท่าเริ่มต้นและท่าที่สแนป
# กลับมาตอนโดนฟัน · เลือกเซลล์ที่ "เอฟเฟกต์น้อยที่สุด" ของชีตนั้นเสมอ
# บางชีตไม่มีเฟรมเปล่าจริง ๆ เลยสักเฟรม (ผู้พิทักษ์จักรกลเวท · มังกรจักรพรรดิ)
# ก็เลือกเฟรมที่เอฟเฟกต์เบาที่สุดแทน
#
# สเกลชดเชยมีไว้แก้กรณีที่ท่ายืนของชีตนั้น "ชูแขนสูง" จนกรอบตัวสูงเกินจริง
# แล้วตัวถูกย่อลงเทียบกับตัวอื่น (โกเลมหินอันเดดชูก้อนหินเหนือหัว) — ค่า 1.0 = ไม่ชดเชย
FOE_FRAMES = {
    'm11': (1, 1, [0], [],     False, False, 1.00),
    'm12': (3, 1, [0], [1, 2], False, False, 1.14),
    'm13': (4, 1, [0], [1, 3], False, False, 1.00),
    'm14': (5, 1, [0], [3, 4], False, False, 1.00),
    'm15': (5, 1, [0], [1, 2], False, False, 1.00),
    'm16': (3, 2, [2], [3, 5], False, True,  1.00),
    'm21': (5, 1, [0], [1, 2], False, False, 1.00),
    'm22': (4, 1, [0], [2, 3], False, False, 1.00),
    'm23': (2, 2, [2], [1, 3], False, True,  1.00),
    'm31': (2, 1, [0], [1],    False, False, 1.00),
    # ผู้พิทักษ์จักรกลเวทเป็นตัวเดียวที่ต้นฉบับหันขวา → พลิกให้หันซ้ายตั้งแต่ตอนสกัด
    'm32': (4, 1, [0], [1, 3], True,  False, 1.00),
    # ลิชจอมคลังเวท: เซลล์ที่ 4 มีกำแพงไฟที่ถูกรอยต่อเซลล์ตัดขาดเป็นเส้นตรง จึงไม่ใช้
    'm33': (4, 1, [1], [0, 2], False, True,  1.00),
    'm41': (3, 1, [0], [1, 2], False, False, 1.00),
    'm42': (3, 1, [0], [1, 2], False, False, 1.00),
    'm43': (1, 3, [1], [0, 2], False, True,  1.00),
    'm51': (2, 2, [1], [2, 3], False, False, 1.00),
    'm52': (2, 1, [0], [1],    False, False, 1.00),
    'm53': (2, 2, [3], [0, 2], False, True,  1.00),
}


# ══ ตัวช่วยไฟล์ ═══════════════════════════════════════════════════════════
def resolve(prefix):
    """หาไฟล์ที่ชื่อ 'ขึ้นต้นด้วย' prefix — ลองหลายโฟลเดอร์และหลายนามสกุล

    เจ้าของ repo อัปโหลดผ่านเว็บ GitHub ไฟล์จึงมาโผล่ที่รากrepo ได้
    (กติกาเดียวกับ resolve() ของ embed_arena_art.py / embed_card_art.py)
    """
    for d in DIRS:
        base = os.path.join(ROOT, d) if d else ROOT
        if not os.path.isdir(base):
            continue
        hits = [p for p in sorted(glob.glob(os.path.join(base, prefix + '*')))
                if os.path.splitext(p)[1] in EXT]
        if hits:
            return hits[0]
    return None


def read_game():
    with io.open(GAME, encoding='utf-8') as f:
        return f.read()


def write_game(s):
    with io.open(GAME, 'w', encoding='utf-8') as f:
        f.write(s)


def foes_of(src):
    """อ่านสารบัญอสูรจาก BA_FOES ในตัวไฟล์เกม — สารบัญอยู่ที่เดียว ไม่ต้องซิงก์สองที่"""
    m = re.search(r'const BA_FOES = \[(.*?)\n    \];', src, re.S)
    if not m:
        sys.exit('หา BA_FOES ในไฟล์เกมไม่เจอ — ชั้น v6.2 ถูกถอดออกไปหรือเปล่า')
    out = []
    for line in m.group(1).splitlines():
        k = re.search(r"id:\s*'([^']+)'.*?file:\s*'([^']+)'", line)
        if k:
            out.append((k.group(1), k.group(2)))
    if not out:
        sys.exit('BA_FOES อ่านไม่ออก — รูปแบบบรรทัดเปลี่ยนไปหรือเปล่า')
    return out


# ══ ถอดพื้นหลังมืด ════════════════════════════════════════════════════════
def strip_dark(im, strong=34, weak=14, close=5, minblob=140, holecap=0.05):
    """คืน RGBA ที่พื้นหลังมืดกลายเป็นโปร่งใส — เหตุผลของแต่ละขั้นอยู่หัวไฟล์"""
    im = im.convert('RGB')
    a = np.asarray(im, np.float32)
    h, w = a.shape[:2]

    # สีพื้น = ค่ากลางของกรอบขอบเซลล์ (พื้นหลังกินขอบเสมอในชุดนี้)
    e = 2
    edge = np.concatenate([a[:e].reshape(-1, 3), a[-e:].reshape(-1, 3),
                           a[:, :e].reshape(-1, 3), a[:, -e:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(axis=2))

    # hysteresis — เก็บก้อน "อ่อน" เฉพาะก้อนที่มีพิกเซล "เข้ม" อยู่ข้างใน
    st = d > strong
    wk = d > weak
    lab, n = ndimage.label(wk, np.ones((3, 3)))
    if n:
        keep = np.zeros(n + 1, bool)
        keep[np.unique(lab[st])] = True
        keep[0] = False
        core = keep[lab]
    else:
        core = st

    m = Image.fromarray((core * 255).astype(np.uint8), 'L')
    m = m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    core = np.asarray(m) > 127

    lab, n = ndimage.label(core, np.ones((3, 3)))
    if n:
        sz = np.bincount(lab.ravel())
        sz[0] = 0
        core = np.isin(lab, np.nonzero(sz >= minblob)[0])

    # ปิดเฉพาะรูเล็กที่ไม่ติดขอบเซลล์ (ดูเหตุผลข้อ 1 ที่หัวไฟล์)
    lab, n = ndimage.label(~core, np.ones((3, 3)))
    if n:
        touch = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
        sz = np.bincount(lab.ravel())
        cap = holecap * h * w
        fill = np.zeros(n + 1, bool)
        for i in range(1, n + 1):
            if i not in touch and sz[i] <= cap:
                fill[i] = True
        core = core | fill[lab]

    solid = np.asarray(Image.fromarray((core * 255).astype(np.uint8), 'L')
                       .filter(ImageFilter.GaussianBlur(0.7)), np.float32)
    near = np.asarray(Image.fromarray((core * 255).astype(np.uint8), 'L')
                      .filter(ImageFilter.MaxFilter(9)), np.float32) / 255.0
    soft = np.clip((d - weak) / float(strong - weak), 0, 1) * 255.0 * near

    out = im.convert('RGBA')
    out.putalpha(Image.fromarray(np.clip(np.maximum(solid, soft), 0, 255).astype(np.uint8), 'L'))
    return out


def cells_of(im, cols, rows):
    """หั่นกริดด้วยการหารตรง ๆ — เศษที่หารไม่ลงตัวถูกยกให้เซลล์สุดท้ายของแถว/คอลัมน์"""
    w, h = im.size
    cw, ch = w // cols, h // rows
    out = []
    for r in range(rows):
        for c in range(cols):
            out.append(im.crop((c * cw, r * ch,
                                w if c == cols - 1 else (c + 1) * cw,
                                h if r == rows - 1 else (r + 1) * ch)))
    return out


def make_frames(path, spec, fw, fh):
    """คืน [(kind, Image)] ของอสูรหนึ่งตัว — ทุกเฟรมใช้สเกลกับจุดอ้างอิงเดียวกัน"""
    cols, rows, idle, act, flip, boss, tweak = spec
    im = Image.open(path).convert('RGB')
    cs = [strip_dark(c) for c in cells_of(im, cols, rows)]
    if flip:
        cs = [c.transpose(Image.FLIP_LEFT_RIGHT) for c in cs]

    need = idle + act
    if max(need) >= len(cs):
        sys.exit('เซลล์ที่ขอ (%d) เกินกริด %dx%d ของ %s'
                 % (max(need), cols, rows, os.path.basename(path)))

    ref = cs[idle[0]].split()[3].getbbox()
    if not ref:
        return []
    body = (BODY_BOSS if boss else BODY) * float(fh) / FRAME_H
    s = body * tweak / float(ref[3] - ref[1])
    # จุดอ้างอิง = กึ่งกลาง-ล่างของกรอบตัวในเฟรมยืน (คงทะเบียนอนิเมชันไว้เป๊ะ)
    ax = (ref[0] + ref[2]) / 2.0 * s
    ay = ref[3] * s

    out = []
    for kind, ids in (('idle', idle), ('act', act)):
        for i in ids:
            c = cs[i]
            n = c.resize((max(1, int(round(c.width * s))), max(1, int(round(c.height * s)))),
                         Image.LANCZOS)
            f = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            f.alpha_composite(n, (int(round(fw / 2.0 - ax)), int(round(fh - ay))))
            out.append((kind, f))
    return out


# ══ เข้ารหัส ═════════════════════════════════════════════════════════════
def webp(im, pal):
    """ลดจำนวนสี → WebP lossless (เหตุผลอยู่หัวไฟล์ — lossy ให้ไฟล์ใหญ่กว่าและเบลอกว่า)"""
    g = im.quantize(colors=pal, method=Image.FASTOCTREE).convert('RGBA') if pal else im
    b = io.BytesIO()
    g.save(b, 'WEBP', lossless=True, method=6, exact=False)
    return b.getvalue()


def uri(raw):
    return 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii')


# ══ เขียนกลับลงไฟล์เกม ═══════════════════════════════════════════════════
def put_mon(src, table):
    """table = [(id, [(kind, uri), ...]), ...] · ตัวที่ไม่มีเฟรมจะไม่ถูกเขียนคีย์เลย"""
    rows = []
    for mid, frames in table:
        if not frames:
            continue
        body = ',\n'.join("        { k: '%s', d: '%s' }" % (k, d) for k, d in frames)
        rows.append('      %s: [\n%s\n      ]' % (mid, body))
    new = '    const BA_MON = {};' if not rows else \
          '    const BA_MON = {\n' + ',\n'.join(rows) + '\n    };'
    out, n = re.subn(r'    const BA_MON = \{.*?\};', lambda m: new, src, count=1, flags=re.S)
    if n != 1:
        sys.exit('เขียน BA_MON ไม่สำเร็จ — หา anchor ไม่เจอ')
    return out


def cur_mon(src):
    m = re.search(r'    const BA_MON = \{(.*?)\n    \};', src, re.S)
    if not m:
        return {}
    out = {}
    for blk in re.finditer(r"(\w+):\s*\[(.*?)\n      \]", m.group(1), re.S):
        out[blk.group(1)] = re.findall(r"k:\s*'(\w+)'\s*,\s*d:\s*'([^']*)'", blk.group(2))
    return out


# ══ เพดาน — ถาม build ตรง ๆ ว่าไฟล์แจกจะได้กี่ไบต์ ════════════════════════
# เหตุผลเดียวกับ embed_arena_art.py: budget_kb() ประมาณจากส่วนต่างของไฟล์แจก
# ใบที่มีอยู่ ซึ่งใช้ไม่ได้เมื่อ build สลับโหมด GENTLE↔HARD ได้เอง (ต่างกันเกือบ 600KB)
def base_sizes(cleared, original):
    """คืน (ขนาดไฟล์แจกโหมด GENTLE, โหมด HARD) ของต้นฉบับที่ยังไม่มีภาพอสูร"""
    import subprocess
    script = os.path.join(ROOT, 'build_minify.js')
    if not os.path.exists(script):
        return None
    write_game(cleared)
    try:
        out = []
        for extra in (['--gentle'], ['--hard']):
            r = subprocess.run(['node', script, '--size'] + extra, cwd=ROOT,
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            if r.returncode != 0:
                return None
            out.append(int(r.stdout.decode('ascii', 'ignore').strip()))
        return tuple(out)
    except (OSError, ValueError):
        return None
    finally:
        write_game(original)          # คืนไฟล์เดิมเสมอ ต่อให้ตรงกลางพัง


# ══ หลัก ═════════════════════════════════════════════════════════════════
def main():
    args = list(sys.argv[1:])
    dry = '--dry' in args
    clear = '--clear' in args
    preview = '--preview' in args

    def flagval(name, cast=int):
        if name in args:
            i = args.index(name)
            if i + 1 >= len(args):
                sys.exit('ธง %s ต้องตามด้วยค่า' % name)
            v = cast(args[i + 1])
            del args[i:i + 2]
            return v
        return None

    force_pal = flagval('--pal')
    fw = flagval('--w') or FRAME_W
    fh = flagval('--h') or FRAME_H
    for f in ('--dry', '--clear', '--preview'):
        while f in args:
            args.remove(f)
    want = set(args)

    src = read_game()
    foes = foes_of(src)
    known = set(mid for mid, _ in foes)
    bad = want - known
    if bad:
        sys.exit('ไม่รู้จักอสูร: %s (มีให้เลือก: %s)' % (', '.join(sorted(bad)), ', '.join(sorted(known))))

    if clear:
        if dry:
            print('--dry: จะถอดภาพอสูรทั้ง %d ตัว' % len(foes))
            return
        write_game(put_mon(src, []))
        print('ถอดภาพอสูรทั้งหมดแล้ว — กลับไปใช้อีโมจิของ v4.0')
        embed_common.rebuild(ROOT)
        return

    keep = cur_mon(src)

    # ── สกัดเฟรม ──────────────────────────────────────────────────────────
    raw = {}
    for mid, prefix in foes:
        if want and mid not in want:
            continue
        spec = FOE_FRAMES.get(mid)
        if not spec:
            print('  ข้าม %-4s — ไม่มีพิกัดใน FOE_FRAMES' % mid)
            continue
        p = resolve(prefix)
        if not p:
            print('  ข้าม %-4s — หาไฟล์ที่ขึ้นต้นด้วย "%s" ไม่เจอ' % (mid, prefix))
            continue
        print('  ถอดพื้นหลัง %-4s ← %s' % (mid, os.path.basename(p)))
        fr = make_frames(p, spec, fw, fh)
        if fr:
            raw[mid] = fr

    if not raw:
        sys.exit('ไม่มีอะไรให้ฝัง — หาไฟล์ต้นฉบับไม่เจอสักไฟล์')

    # ── วัดเพดานจากไฟล์แจกจริง ─────────────────────────────────────────────
    cleared = put_mon(src, [])
    base = base_sizes(cleared, src)
    if base:
        print('\n  ไม่มีภาพอสูรเลย ไฟล์แจกได้ %s ไบต์ (GENTLE) · %s ไบต์ (HARD)'
              % (format(base[0], ','), format(base[1], ',')))
    cleared_bytes = len(cleared.encode('utf-8'))
    fallback_budget = embed_common.budget_kb(GAME, DIST) * 1024

    cap = embed_common.HARD_LIMIT - RESERVE

    def fits(cand_bytes):
        if not base:
            return (cand_bytes <= fallback_budget - RESERVE, 'ประมาณ',
                    int(fallback_budget - cand_bytes))
        add = cand_bytes - cleared_bytes        # base64 ผ่าน terser ไปเฉย ๆ
        for size, name in ((base[0], 'GENTLE'), (base[1], 'HARD')):
            if size + add <= cap:
                return True, name, embed_common.HARD_LIMIT - (size + add)
        return False, 'HARD', embed_common.HARD_LIMIT - (base[1] + add)

    # ── ไล่บันไดจำนวนสีจนกว่าจะลงเพดาน ─────────────────────────────────────
    chosen = None
    for pal in ([force_pal] if force_pal else PAL_LADDER):
        table, total, nf = [], 0, 0
        for mid, _ in foes:
            if mid in raw:
                fr = []
                for kind, im in raw[mid]:
                    b = webp(im, pal)
                    total += len(b)
                    nf += 1
                    fr.append((kind, uri(b)))
                table.append((mid, fr))
            else:
                table.append((mid, keep.get(mid, [])))
        cand = put_mon(src, table)
        size = len(cand.encode('utf-8'))
        ok, mode, left = fits(size)
        chosen = (pal, table, total, nf, size, cand, ok, mode, left)
        if ok:
            break

    pal, table, total, nf, size, cand, ok, mode, left = chosen

    print('')
    print('อสูร     %d ตัว · %d เฟรม · %dx%d · WebP lossless %d สี' % (len(raw), nf, fw, fh, pal))
    print('ภาพรวม   %s ไบต์ (base64 %s ไบต์)'
          % (format(total, ','), format(int(total * 4 / 3.0), ',')))
    print('ต้นฉบับ  %s ไบต์' % format(size, ','))
    print('ไฟล์แจก  จะย่อด้วยโหมด %s · เหลือถึงเพดาน 2,000,000 อีก %s ไบต์'
          % (mode, format(int(left), ',')))

    if not ok:
        sys.exit('\nหยุด: ทะลุเพดาน (เผื่อไว้ %s ไบต์) แม้ที่จำนวนสีต่ำสุดของบันได — '
                 'ลด FRAME_W/FRAME_H หรือตัดเฟรมท่าฟาดออกตัวละหนึ่งเฟรม'
                 % format(RESERVE, ','))

    if preview:
        wide = max(len(v) for v in raw.values())
        sheet = Image.new('RGBA', (fw * wide, fh * len(raw)), (11, 20, 35, 255))
        for j, mid in enumerate([m for m, _ in foes if m in raw]):
            for i, (_, im) in enumerate(raw[mid]):
                sheet.alpha_composite(im, (i * fw, j * fh))
        out = os.path.join(ROOT, 'monster_art_preview.png')
        sheet.convert('RGB').save(out)
        print('พรีวิว   → %s' % os.path.relpath(out, ROOT))

    if dry:
        print('\n(--dry: ไม่ได้เขียนทับอะไร)')
        return

    write_game(cand)
    print('\nเขียนลงต้นฉบับแล้ว → %s' % os.path.relpath(GAME, ROOT))
    embed_common.rebuild(ROOT)


if __name__ == '__main__':
    main()
