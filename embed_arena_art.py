# -*- coding: utf-8 -*-
"""embed_arena_art.py — ฝังฉากหลังสนามรบ 6 ฉาก + เฟรมฮีโร่จากสไปรต์ชีต (ชั้น v6.1)

    python3 embed_arena_art.py                  ฝังทุกอย่างที่หาไฟล์เจอ
    python3 embed_arena_art.py z1 z5 hero       ฝังเฉพาะบางอย่าง
    python3 embed_arena_art.py --clear          ถอดภาพทั้งหมด กลับไปใช้ฉากเกรเดียนต์ + ฮีโร่ SVG
    python3 embed_arena_art.py --q 52 --w 640   บังคับคุณภาพ/ความกว้างของฉาก (ข้ามบันได)
    python3 embed_arena_art.py --hq 68          บังคับคุณภาพของเฟรมฮีโร่
    python3 embed_arena_art.py --dry            ดูตัวเลขเฉย ๆ ไม่เขียนทับ
    python3 embed_arena_art.py --preview        พ่น arena_art_preview.png ไว้ตรวจงานด้วยตา

เขียนลง **ต้นฉบับ** เสมอ แล้วสั่ง build ให้เองปิดท้าย (กับดักข้อ 28)
ห้ามให้เขียนลงไฟล์แจกตรง ๆ — build รอบถัดไปจะทับทิ้งทั้งหมด

────────────────────────────────────────────────────────────────────────────
สองงานที่สคริปต์นี้ทำ

1) ฉากหลัง 6 ฉาก — ย่อ → WebP → base64 → เขียนลง BA_BG
   สารบัญอ่านจาก BA_SCENES ในตัวไฟล์เกมเอง (ฟิลด์ file = "คำขึ้นต้น" ของชื่อไฟล์)
   จึงไม่มีแผนที่ชุดที่สองให้ต้องซิงก์กัน — กติกาเดียวกับ embed_menu_icon_art.py
   ที่อ่าน MI_BTNS และ embed_icon_art.py ที่อ่าน SKILLS[].name

2) เฟรมฮีโร่ — สกัดจากสไปรต์ชีต HERO1/HERO2/HERO3 ที่รากrepo
   **ต้นฉบับเป็น PNG พื้นโปร่งที่ถูกแบนเป็น JPG มาแล้ว ลายตารางหมากรุกจึงติดมาในภาพ**
   (อาการเดียวกับไอคอนไอเทม 3 ตัวของ Item Asset Patch แต่หนักกว่ามาก เพราะลายกิน
   ทั้งใบ ไม่ใช่แค่ขอบ) strip_checker() ที่นี่จึงทำคนละท่ากับของ embed_item_art.py

   ท่าที่ใช้ และเหตุผลที่ท่าอื่นใช้ไม่ได้
     • ปั้นภาพ "ลายหมากรุก" ขึ้นมาทั้งใบจากสองสีที่วัดได้จริง แล้วดูว่าพิกเซลไหน
       ต่างจากลายเกินเกณฑ์ = เนื้อภาพ
     • ปิดรูด้วย morphological close (max→min) เพราะออร่าสีขาวของตัวละครมีค่าใกล้
       สีขาวของลาย จนบางเซลล์ถูกตัดสินว่าเป็นพื้นหลัง แล้วขึ้นเป็น "ลายหมากรุก
       โผล่กลางตัวออร่า" — close กลืนรูขนาดเล็กกว่าเคอร์เนลทิ้งให้หมด
     • ปิดรูที่เหลือด้วย binary_fill_holes (รูที่ไม่ติดขอบภาพ = อยู่ในตัวสไปรต์แน่นอน)
     • ทิ้งก้อนเล็กที่หลุดมาลอยอยู่ข้าง ๆ ด้วยการกรองขนาด connected component

   **ห้ามใช้ flood fill จากขอบภาพแบบ embed_item_art.py** — ลองแล้ว ออร่าสีขาว
   ทำให้ตัวเติมสีไหลทะลุเข้าไปในตัวละคร แล้วเหลือลายหมากรุกเป็นตารางในเนื้อออร่า
   **และห้ามใช้ luminance key (ขาว = โปร่ง)** เพราะจะกินออร่าขาวทั้งหมดหายไปด้วย

   ฮีโร่ต้อง **หันขวาเสมอ** (สเปกข้อ 2) ท่าไหนที่ต้นฉบับหันซ้ายจะถูกพลิกให้ตั้งแต่
   ตอนสกัดเฟรม ตัวเกมจึงไม่ต้องรู้เรื่องนี้เลยและไม่ต้องใช้ CSS scaleX() ตอนรัน
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

# ── ฉากหลัง ───────────────────────────────────────────────────────────────
# กรอบสนามรบสูง 170px และกว้างสุดราว 480px บนแท็บเล็ต 640px จึงเกิน DPR 2 อยู่แล้ว
# **อย่าดันขึ้นไปกว่านี้** ที่ได้มาคือไบต์ที่เสียเปล่า และ base64 ผ่าน terser ไปเฉย ๆ
# ไม่ถูกย่อแม้แต่ไบต์เดียว เติมกี่ไบต์ก็โตขึ้นเท่านั้นเป๊ะ (กติกาเดียวกับ AU_BGM_SRC ของ v5.1)
BG_W = 640
BG_LADDER = [66, 60, 56, 52, 48, 44, 40, 36]

BG_EXT = ('.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG')
BG_DIRS = ('', 'assets', os.path.join('assets', 'scenes'), os.path.join('assets', 'arena'))

# ── เฟรมฮีโร่ ─────────────────────────────────────────────────────────────
# กรอบบนจอคือ 98x60 CSS px (จอกว้าง 116) เฟรม 200x122 จึงคมถึง DPR ~2
HERO_W, HERO_H = 200, 122
HERO_LADDER = [78, 72, 66, 60, 54, 48]

# พิกัดของแต่ละท่าในสไปรต์ชีต — วัดจากภาพจริงทั้งหมด สคริปต์เดาแทนไม่ได้
#   (id, ชนิด, เลขชีต, กรอบ (x0,y0,x1,y1), พลิกซ้าย-ขวาไหม)
# ชนิด 'idle' = ท่ายืน (สลับวนลูปช้า ๆ ให้ออร่าขยับ) · 'act' = ท่าโจมตีที่ถูกสุ่ม
# **ท่ายืนต้องมีอย่างน้อย 1 ท่า** ไม่งั้นฮีโร่จะหายไปตอนไม่ได้โจมตี
HERO_FRAMES = [
    ('stand',  'idle', 1, (499,  27,  658,  320), False),
    ('guard',  'idle', 1, ( 48,  16,  207,  317), True),
    ('dash',   'act',  1, (331, 367,  640,  622), False),
    ('sweep',  'act',  1, (273, 673,  620,  907), False),
    ('ready',  'act',  1, (988,  17, 1216,  320), False),
    ('cross',  'act',  1, (660, 975,  943, 1227), False),
    ('burst',  'act',  1, ( 13, 928,  344, 1237), False),
    ('twin',   'act',  2, (669, 666,  903,  905), False),
    ('charge', 'act',  3, (765,  47, 1190,  405), False),
]
HERO_SHEET = 'HERO%d'
CELL = 16          # ขนาดช่องลายหมากรุกของต้นฉบับ (วัดจริงแล้วทั้งสามใบเท่ากัน)


# ══ ตัวช่วยไฟล์ ═══════════════════════════════════════════════════════════
def resolve(prefix):
    """หาไฟล์ที่ชื่อ 'ขึ้นต้นด้วย' prefix — ลองหลายโฟลเดอร์และหลายนามสกุล

    เจ้าของ repo อัปโหลดผ่านเว็บ GitHub ไฟล์จึงมาโผล่ที่รากrepo ได้
    (กติกาเดียวกับ resolve() ของ embed_card_art.py / embed_item_art.py)
    """
    for d in BG_DIRS:
        base = os.path.join(ROOT, d) if d else ROOT
        if not os.path.isdir(base):
            continue
        hits = [p for p in sorted(glob.glob(os.path.join(base, prefix + '*')))
                if os.path.splitext(p)[1] in BG_EXT]
        if hits:
            return hits[0]
    return None


def read_game():
    with io.open(GAME, encoding='utf-8') as f:
        return f.read()


def write_game(s):
    with io.open(GAME, 'w', encoding='utf-8') as f:
        f.write(s)


def scenes_of(src):
    """อ่านสารบัญฉากจาก BA_SCENES ในตัวไฟล์เกม — สารบัญอยู่ที่เดียว ไม่ต้องซิงก์สองที่"""
    m = re.search(r'const BA_SCENES = \[(.*?)\n    \];', src, re.S)
    if not m:
        sys.exit('หา BA_SCENES ในไฟล์เกมไม่เจอ — ชั้น v6.1 ถูกถอดออกไปหรือเปล่า')
    out = []
    for line in m.group(1).splitlines():
        k = re.search(r"id:\s*'([^']+)'.*?file:\s*'([^']+)'", line)
        if k:
            out.append((k.group(1), k.group(2)))
    if not out:
        sys.exit('BA_SCENES อ่านไม่ออก — รูปแบบบรรทัดเปลี่ยนไปหรือเปล่า')
    return out


# ══ ถอดลายหมากรุก ════════════════════════════════════════════════════════
def strip_checker(im, thr=9, close=15, minblob=6000):
    """คืน RGBA ที่พื้นลายหมากรุกกลายเป็นโปร่งใส — เหตุผลของแต่ละขั้นอยู่หัวไฟล์"""
    im = im.convert('RGB')
    a = np.asarray(im, np.float32)
    h, w = a.shape[:2]

    # ปั้นภาพลายขึ้นมาเทียบ — สองสีวัดจากพิกเซลที่ "ใกล้ขาวและไม่มีสี" ของแต่ละช่องคู่/คี่
    yy, xx = np.mgrid[0:h, 0:w]
    par = ((yy // CELL) + (xx // CELL)) % 2
    neutral = (a.max(axis=2) - a.min(axis=2)) <= 4
    pale = a.max(axis=2) >= 236
    k = np.zeros((h, w, 3), np.float32)
    for p in (0, 1):
        sel = (par == p) & neutral & pale
        if not sel.any():
            return im.convert('RGBA')          # ไม่ใช่ภาพลายหมากรุก — ปล่อยผ่าน
        k[par == p] = np.median(a[sel], axis=0)

    d = np.abs(a - k).max(axis=2)
    m = Image.fromarray(((d > thr) * 255).astype(np.uint8), 'L')
    m = m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    b = np.asarray(m) > 127

    lab, n = ndimage.label(b, np.ones((3, 3)))
    if n:
        sz = np.bincount(lab.ravel())
        sz[0] = 0
        b = np.isin(lab, np.nonzero(sz >= minblob)[0])
    b = ndimage.binary_fill_holes(b)

    al = Image.fromarray((b * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1.3))
    al = np.clip((np.asarray(al, np.float32) - 96) * (255.0 / 84.0), 0, 255)
    out = im.convert('RGBA')
    out.putalpha(Image.fromarray(al.astype(np.uint8), 'L'))
    return out


def make_frame(sheet, box, flip):
    """ครอปหนึ่งท่า → ตัดขอบว่างทิ้ง → พลิกให้หันขวา → วางชิดพื้นกลางเฟรม"""
    c = sheet.crop(box)
    bb = c.split()[3].getbbox()
    if bb:
        c = c.crop(bb)
    if flip:
        c = c.transpose(Image.FLIP_LEFT_RIGHT)
    r = min((HERO_W - 4) / float(c.width), (HERO_H - 4) / float(c.height))
    c = c.resize((max(1, int(round(c.width * r))), max(1, int(round(c.height * r)))),
                 Image.LANCZOS)
    f = Image.new('RGBA', (HERO_W, HERO_H), (0, 0, 0, 0))
    # ชิดพื้นเสมอ — ทุกท่าจึงยืนอยู่บนระดับเดียวกัน ไม่ลอยขึ้นลงตอนสลับท่า
    f.alpha_composite(c, ((HERO_W - c.width) // 2, HERO_H - c.height))
    return f


# ══ เข้ารหัส ═════════════════════════════════════════════════════════════
def webp(im, q):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6, exact=False, lossless=False)
    return b.getvalue()


def uri(raw):
    return 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii')


# ══ เขียนกลับลงไฟล์เกม ═══════════════════════════════════════════════════
def put_bg(src, table):
    body = ', '.join("%s: '%s'" % (k, v) for k, v in table)
    new = '    const BA_BG = { ' + body + ' };'
    out, n = re.subn(r'    const BA_BG = \{.*?\};', lambda m: new, src, count=1, flags=re.S)
    if n != 1:
        sys.exit('เขียน BA_BG ไม่สำเร็จ — หา anchor ไม่เจอ')
    return out


def put_hero(src, frames):
    """**ไม่แตะ BA_HERO อีกต่อไปตั้งแต่ชั้น v6.5** — เจ้าของบล็อกนี้คือ embed_hero_art.py

    ของเดิมเขียนบล็อกเป็น `const BA_HERO = [];` บรรทัดเดียวตอนไม่มีเฟรม ซึ่งทำให้
    เกิดความเสียหายจริงมาแล้ว: สคริปต์ตัวใหม่มองหาตัวปิดแบบหลายบรรทัด (`\\n    ];`)
    พอเจอบล็อกบรรทัดเดียวจึงวิ่งเลยไปจบที่ `];` ของ **BA_FOES** แล้วกลืนสารบัญอสูร
    ทั้งก้อนหายไปเงียบ ๆ · และต่อให้เขียนถูกรูปแบบ ของเดิมก็จะทิ้งฟิลด์ id ของเฟรม
    ชุดใหม่ทิ้ง (รู้จักแค่ k กับ d) แล้วลำดับใน BA_ANIM จะอ้างไม่ถึงสักเฟรม

    คืน src เดิมไปเฉย ๆ — ตัวเรียกทั้งสามจุดยังทำงานได้ตามเดิม เพราะทั้ง "ก้อนที่
    ถอดภาพออกแล้ว" และ "ก้อนผู้สมัคร" ต่างก็มีเฟรมฮีโร่อยู่เท่ากัน ส่วนต่างที่ใช้
    คิดเพดานจึงยังเป็นส่วนต่างของฉากล้วน ๆ เหมือนเดิม
    """
    return src


def cur_bg(src):
    m = re.search(r'    const BA_BG = \{(.*?)\};', src, re.S)
    return dict(re.findall(r"(\w+):\s*'([^']*)'", m.group(1))) if m else {}


def cur_hero(src):
    """เลิกอ่านเฟรมฮีโร่แล้ว — put_hero ไม่เขียนอะไรกลับไปอยู่แล้ว (ดูเหตุผลที่นั่น)"""
    return []


# ══ เพดาน — วัดจากไฟล์แจกจริง ไม่ใช่จากการประมาณ ═════════════════════════
# embed_common.budget_kb() ประมาณเพดานฝั่งต้นฉบับจาก "ส่วนต่างของไฟล์แจกใบที่มีอยู่"
# ซึ่งใช้ไม่ได้กับชั้นนี้ เพราะไฟล์แจกใบที่มีอยู่อาจย่อมาคนละโหมดกับที่จะได้จริง
# (ตั้งแต่ v6.1 การ build สลับ GENTLE↔HARD ให้เองตามขนาด — ส่วนต่างจึงต่างกันเกือบ 600KB)
#
# ที่นี่จึงถามตัว build ตรง ๆ ว่า "ถ้าไม่มีภาพเลย ไฟล์แจกจะได้กี่ไบต์" ทั้งสองโหมด
# แล้วบวก **ส่วนต่างของ base64 ที่จะเติมเข้าไป** ซึ่งผ่าน terser ไปเฉย ๆ ไม่ถูกย่อ
# สักไบต์ ตัวเลขที่ได้จึงตรงกับของจริงแทบเป๊ะ (เผื่อไว้ทางสูงเล็กน้อย = ปลอดภัย)
def base_sizes(cleared, original):
    """คืน (ขนาดไฟล์แจกโหมด GENTLE, โหมด HARD) ของต้นฉบับที่ยังไม่มีภาพ"""
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
    args = [a for a in sys.argv[1:]]
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

    force_q = flagval('--q')
    force_w = flagval('--w')
    force_hq = flagval('--hq')
    for f in ('--dry', '--clear', '--preview'):
        while f in args:
            args.remove(f)
    want = set(args)

    src = read_game()
    scenes = scenes_of(src)

    if clear:
        src = put_bg(src, [(sid, '') for sid, _ in scenes])
        src = put_hero(src, [])
        if dry:
            print('--dry: จะถอดภาพทั้งหมด (ฉาก %d ฉาก + เฟรมฮีโร่)' % len(scenes))
            return
        write_game(src)
        print('ถอดภาพทั้งหมดแล้ว — ฉากกลับไปใช้เกรเดียนต์ · ฮีโร่กลับไปใช้ SVG')
        embed_common.rebuild(ROOT)
        return

    keep_bg = cur_bg(src)
    keep_hero = cur_hero(src)

    # ── เตรียมฉาก ─────────────────────────────────────────────────────────
    bg_src = {}
    for sid, prefix in scenes:
        if want and sid not in want:
            continue
        p = resolve(prefix)
        if not p:
            print('  ข้าม %-6s — หาไฟล์ที่ขึ้นต้นด้วย "%s" ไม่เจอ' % (sid, prefix))
            continue
        bg_src[sid] = p

    # ── เตรียมเฟรมฮีโร่ ────────────────────────────────────────────────────
    # ตั้งแต่ชั้น v6.5 **เฟรมฮีโร่ย้ายไปเป็นของ embed_hero_art.py ทั้งก้อน**
    # (สไปรต์ชีตชุดใหม่ 43 เฟรม · พื้นดำ ไม่ใช่ลายหมากรุก · คนละรูปแบบข้อมูล)
    # ตัวนี้จึงไม่แตะ BA_HERO อีกต่อไป ถ้าปล่อยให้แตะ การรันโดยไม่ใส่ธงจะเขียน
    # เฟรมชุดเก่าที่ไม่มีฟิลด์ id ทับ แล้วลำดับแอนิเมชันใน BA_ANIM จะอ้างไม่ถึงสักเฟรม
    # (เกมไม่พังเพราะมีทางสำรองของ v6.3 รออยู่ แต่ท่าทั้ง 6 ชุดจะหายไปเงียบ ๆ)
    if 'hero' in want:
        print('  ⚠️  เฟรมฮีโร่ย้ายไปที่ embed_hero_art.py แล้วตั้งแต่ชั้น v6.5')
        print('     สั่ง: python3 embed_hero_art.py')
    do_hero = False
    hero_raw = []
    if do_hero:
        sheets = {}
        for _, _, sh, _, _ in HERO_FRAMES:
            if sh in sheets:
                continue
            p = resolve(HERO_SHEET % sh)
            if not p:
                print('  ข้าม hero — หาไฟล์ %s ไม่เจอ' % (HERO_SHEET % sh))
                sheets = {}
                break
            print('  ถอดลายหมากรุก %s …' % os.path.basename(p))
            sheets[sh] = strip_checker(Image.open(p))
        if sheets:
            for fid, kind, sh, box, flip in HERO_FRAMES:
                hero_raw.append((fid, kind, make_frame(sheets[sh], box, flip)))
        else:
            do_hero = False

    if not bg_src and not hero_raw:
        sys.exit('ไม่มีอะไรให้ฝัง — หาไฟล์ต้นฉบับไม่เจอสักไฟล์')

    # ── วัดเพดานจากไฟล์แจกจริง ──────────────────────────────────────────────
    cleared = put_hero(put_bg(src, [(sid, '') for sid, _ in scenes]), [])
    base = base_sizes(cleared, src)
    if base:
        print('  ไม่มีภาพเลย ไฟล์แจกได้ %s ไบต์ (GENTLE) · %s ไบต์ (HARD)'
              % (format(base[0], ','), format(base[1], ',')))
    cleared_bytes = len(cleared.encode('utf-8'))
    fallback_budget = embed_common.budget_kb(GAME, DIST) * 1024

    def fits(cand_bytes):
        """คืน (พอไหม, ชื่อโหมดที่จะได้, ที่เหลือเป็นไบต์)"""
        if not base:
            return (cand_bytes <= fallback_budget, 'ประมาณ',
                    int(fallback_budget - cand_bytes))
        add = cand_bytes - cleared_bytes           # base64 ผ่าน terser ไปเฉย ๆ
        for size, name in ((base[0], 'GENTLE'), (base[1], 'HARD')):
            if size + add <= embed_common.HARD_LIMIT:
                return True, name, embed_common.HARD_LIMIT - (size + add)
        return False, 'HARD', embed_common.HARD_LIMIT - (base[1] + add)

    # ── ไล่บันไดคุณภาพจนกว่าจะลงเพดาน ───────────────────────────────────────
    bg_lad = [force_q] if force_q else BG_LADDER
    h_lad = [force_hq] if force_hq else HERO_LADDER
    w = force_w or BG_W

    chosen = None
    for qi, q in enumerate(bg_lad):
        hq = h_lad[min(qi, len(h_lad) - 1)]
        table, hero, total = [], [], 0
        for sid, _ in scenes:
            if sid in bg_src:
                im = Image.open(bg_src[sid]).convert('RGB')
                c = im.resize((w, max(1, int(round(im.height * w / float(im.width))))),
                              Image.LANCZOS)
                raw = webp(c, q)
                total += len(raw)
                table.append((sid, uri(raw)))
            else:
                table.append((sid, keep_bg.get(sid, '')))
        if hero_raw:
            for fid, kind, f in hero_raw:
                raw = webp(f, hq)
                total += len(raw)
                hero.append((fid, kind, uri(raw)))
        else:
            hero = [('keep', k, d) for k, d in keep_hero]

        cand = put_hero(put_bg(src, table), hero)
        size = len(cand.encode('utf-8'))
        ok, mode, left = fits(size)
        chosen = (q, hq, table, hero, total, size, cand, ok, mode, left)
        if ok:
            break

    q, hq, table, hero, total, size, cand, ok, mode, left = chosen

    print('')
    print('ฉาก      %d ฉาก · กว้าง %dpx · WebP q%d' % (len(bg_src), w, q))
    print('ฮีโร่     %d เฟรม (%d ยืน · %d โจมตี) · %dx%d · WebP q%d'
          % (len(hero_raw),
             sum(1 for _, k, _ in hero_raw if k == 'idle'),
             sum(1 for _, k, _ in hero_raw if k == 'act'),
             HERO_W, HERO_H, hq))
    print('ภาพรวม   %s ไบต์ (base64 %s ไบต์)'
          % (format(total, ','), format(int(total * 4 / 3.0), ',')))
    print('ต้นฉบับ  %s ไบต์' % format(size, ','))
    print('ไฟล์แจก  จะย่อด้วยโหมด %s · เหลือถึงเพดาน 2,000,000 อีก %s ไบต์'
          % (mode, format(int(left), ',')))

    if not ok:
        sys.exit('\nหยุด: ทะลุเพดานแม้ที่คุณภาพต่ำสุดของบันได — ลด BG_W หรือตัดเฟรมฮีโร่ออก')

    if preview:
        sheet = Image.new('RGBA', (HERO_W * max(1, len(hero_raw)), HERO_H), (11, 20, 35, 255))
        for i, (_, _, f) in enumerate(hero_raw):
            sheet.alpha_composite(f, (i * HERO_W, 0))
        out = os.path.join(ROOT, 'arena_art_preview.png')
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
