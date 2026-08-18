# -*- coding: utf-8 -*-
"""embed_abyss_art.py — ฝังเฟรมทัพเงา 25 ตัวจากสไปรต์ชีต (ชั้น v6.6)

    python3 embed_abyss_art.py                  ฝังทุกตัวที่หาไฟล์เจอ
    python3 embed_abyss_art.py s1 s21           ฝังเฉพาะบางตัว
    python3 embed_abyss_art.py --clear          ถอดภาพทุกตัว กลับไปใช้อีโมจิของ v4.0
    python3 embed_abyss_art.py --pal 24         บังคับจำนวนสีเอง (ข้ามบันได)
    python3 embed_abyss_art.py --w 128 --h 84   บังคับขนาดเฟรม
    python3 embed_abyss_art.py --dry            ดูตัวเลขเฉย ๆ ไม่เขียนทับ
    python3 embed_abyss_art.py --preview        พ่น abyss_art_preview.png ไว้ตรวจงานด้วยตา

เขียนลง **ต้นฉบับ** เสมอ แล้วสั่ง build ให้เองปิดท้าย (กับดักข้อ 28)
ห้ามให้เขียนลงไฟล์แจกตรง ๆ — build รอบถัดไปจะทับทิ้งทั้งหมด

────────────────────────────────────────────────────────────────────────────
ทำไมตัวนี้ import เครื่องมือของ embed_monster_art.py มาใช้ซ้ำแทนที่จะคัดลอกมา

ทัพเงาเป็นสไปรต์ชุดเดียวกับอสูรประจำชั้นทุกประการ — PNG พื้นโปร่งที่ถูกแบนเป็น JPG
พื้นดำสนิทพร้อม ringing ของ JPEG รอบขอบ · หั่นกริดสม่ำเสมอ · ต้องอบขนาดตัวไว้ในภาพ
ตรรกะ `strip_dark()` (hysteresis + ปิดรูแบบมีเพดาน) ใช้เวลาปรับจูนไปมากและมีบทเรียน
เขียนไว้ครบที่หัวไฟล์นั้น **การคัดลอกมาไว้อีกที่คือการสร้างของที่ต้องซิงก์สองที่**
ซึ่งเป็นสิ่งที่ทั้ง repo หลีกเลี่ยงมาตลอด (สารบัญอยู่ที่เดียวเสมอ)

สิ่งที่ตัวนี้มีเป็นของตัวเอง คือ **สารบัญการสกัด (SH_FRAMES) กับขนาดเฟรม** เท่านั้น

────────────────────────────────────────────────────────────────────────────
สองเรื่องที่ตั้งค่าต่างจาก embed_monster_art.py และเหตุผล

1) **กรอบเฟรมเล็กกว่า (140x92 เทียบ 176x116)** — ไม่ใช่เพราะอยากให้เบลอ แต่เพราะ
   ชุดนี้มี 25 ตัวเทียบ 18 ตัว และไฟล์แจกเหลือที่จำกัด วัดจริงแล้วที่ 140x92
   ตัวอสูรบนจอยังคมกว่าจอ DPR 1 อยู่ราว 1.3 เท่า และทัพเงาเป็นเงาทึบโทนม่วง-ดำ
   รายละเอียดเส้นน้อยกว่าอสูรหอคอยมาก การลดลงมาจึงแทบไม่เห็นความต่าง

2) **RESERVE เล็กกว่า (20KB เทียบ 50KB)** — ชั้น v6.6 คืนที่มาจากภาพสี่ชุด
   (หอคอย · มาสคอต · ฉากหลัง · เฟรมฮีโร่ที่ไม่ถูกอ้างถึง) ได้ราว 120KB ซึ่งเกือบ
   ทั้งหมดถูกใช้ไปกับทัพเงาชุดนี้ **ที่เหลือหลังฝังจึงเป็นที่ว่างจริงที่ต้องระวัง**
   ถ้าชั้นถัดไปต้องการที่ ให้ลดที่ภาพเท่านั้น (กฎเดิมของ repo)
"""

import io
import os
import re
import sys

import embed_common
import embed_hero_art as HA            # ยืม drop_bleed (ทิ้งเศษของเฟรมข้างเคียง)
import embed_monster_art as MA          # ยืม strip_dark / cells_of / webp / uri / resolve

try:
    from PIL import Image
except ImportError:
    sys.exit('ต้องมี Pillow ก่อน — pip install Pillow')

HERE = os.path.dirname(os.path.abspath(__file__))
GAME, DIST, ROOT = embed_common.resolve_game(HERE)

# ── ขนาดเฟรม (ดูเหตุผลข้อ 1 ที่หัวไฟล์) ───────────────────────────────────
FRAME_W, FRAME_H = 140, 92

# ความสูงของ "ตัว" ที่อบไว้ในเฟรม — คิดเป็นสัดส่วนของกรอบเดียวกับ v6.2
# จึงได้ตัวที่สูงเท่าอสูรหอคอยบนจอเป๊ะ ทั้งที่กรอบเฟรมเล็กลง
BODY      = int(round(92 * FRAME_H / 116.0))    # ทัพเงาลำดับ 1-20 (Mini Boss)
BODY_MYTH = int(round(100 * FRAME_H / 116.0))   # Kamish ลำดับ 21-25 (Mythic Boss)

PAL_LADDER = [32, 28, 24, 20, 16]
RESERVE = 18000

# ── จำนวนสีเพิ่มรายตัว — จ่ายไบต์ตรงที่มันเห็นผลจริงเท่านั้น ──────────────
# ทัพเงาเกือบทั้งชุดเป็นเงาทึบโทนม่วง-ดำ ลดจำนวนสีลงแทบไม่เห็นความต่างเลย
# **ยกเว้นตัวที่มีสีผิว/หนังสัตว์อยู่ด้วย** — ทรราชเงามีผ้าคาดเอวสีน้ำตาลกับ
# กล้ามเนื้อไล่เฉด พอเหลือ 24 สีผ้าคาดเอวหายไปทั้งผืนจนตัวแบนเป็นเงาทึบ
# วัดจริงแล้วการบวกให้ตัวเดียวกินเพิ่มไม่ถึง 600 ไบต์ ซึ่งถูกกว่าการดันทั้งชุด
# ขึ้นหนึ่งขั้น (ราว 17KB) อยู่ราว 30 เท่า
PAL_BUMP = {'s9': 8}

# ── สารบัญการสกัด — วัดจากภาพจริงทั้งหมด สคริปต์เดาแทนไม่ได้ ─────────────
#   id: (cols, rows, เซลล์ท่ายืน, เซลล์ท่าฟาด, พลิกซ้าย-ขวาไหม, สเกลชดเชย)
#
# ดรรชนีเซลล์นับจากซ้าย→ขวา แล้วบนลงล่าง (row * cols + col) เหมือน FOE_FRAMES
# ทุกชีตของชุดนี้เป็น "แถวเดียว" ยกเว้นสองตัวที่เป็นกริด 3x2 (เบฮีมอธ · ทรราช)
#
# **ท่ายืนเลือกเซลล์ที่เอฟเฟกต์น้อยที่สุดเสมอ** เพราะเป็นทั้งท่าเริ่มต้นและท่าที่
# สแนปกลับตอนโดนฟัน · ท่าฟาดเลือกเซลล์ที่ "อ่านออกว่ากำลังปล่อยพลัง" ชัดที่สุด
# บางชีตมีเฟรมที่เป็นลูกไฟ/ลมพุ่งล้วนโดยไม่มีตัวอสูรอยู่เลย — **ห้ามใช้เป็นท่าฟาด**
# เพราะพอสแนปกลับท่ายืน ผู้เล่นจะเห็นอสูรหายไปหนึ่งจังหวะแล้วโผล่กลับมา
SH_FRAMES = {
    's1':  (5, 1, [0], [3], False, 1.00),
    's2':  (5, 1, [0], [4], False, 1.00),
    's3':  (3, 2, [0], [4], False, 1.00),
    's4':  (5, 1, [0], [4], False, 1.00),
    's5':  (5, 1, [0], [4], False, 1.00),
    's6':  (5, 1, [0], [3], False, 1.00),
    # ทวนเงา: เซลล์แรกเป็นท่านอนราบเตี้ยมาก ถ้าใช้เป็นท่ายืนตัวจะถูกขยายจนล้นกรอบ
    's7':  (5, 1, [1], [4], False, 1.00),
    # ทัพหน้าเงา: เซลล์ที่ 2 เป็นวงประตูมิติล้วน ไม่มีตัวอสูร จึงข้ามไป
    's8':  (5, 1, [2], [4], False, 1.00),
    's9':  (3, 2, [3], [5], False, 1.00),
    's10': (5, 1, [0], [4], False, 1.00),
    's11': (5, 1, [1], [0], False, 1.00),
    's12': (5, 1, [0], [3], False, 1.00),
    's13': (5, 1, [0], [4], False, 1.00),
    's14': (5, 1, [1], [2], False, 1.00),
    's15': (5, 1, [0], [4], False, 1.00),
    's16': (5, 1, [1], [4], False, 1.00),
    's17': (5, 1, [0], [4], False, 1.00),
    # เดรกเงา: เซลล์สุดท้ายเป็นลูกไฟล้วน ใช้เซลล์ที่ 3 ซึ่งยังเห็นตัวมังกรอยู่
    's18': (4, 1, [1], [2], False, 1.00),
    's19': (4, 1, [0], [3], False, 1.00),
    # ไวเวิร์นเงา: เซลล์แรกเป็นลมพุ่งล้วน จึงไม่แตะเลย
    's20': (4, 1, [2], [3], False, 1.00),
    # ลมหายใจคามิช: เซลล์ที่ 3 เป็นท่ากำลังพ่นลำแสงอยู่แล้ว ใช้เป็นท่ายืนไม่ได้
    's21': (4, 1, [1], [3], False, 1.00),
    's22': (5, 1, [1], [4], False, 1.00),
    's23': (5, 1, [1], [4], False, 1.00),
    's24': (5, 1, [1], [3], False, 1.00),
    's25': (6, 1, [2], [5], False, 1.00),
}


def read_game():
    with io.open(GAME, encoding='utf-8') as f:
        return f.read()


def write_game(s):
    with io.open(GAME, 'w', encoding='utf-8') as f:
        f.write(s)


def foes_of(src):
    """อ่านสารบัญทัพเงาจาก BA_FOES_ABYSS ในตัวไฟล์เกม — สารบัญอยู่ที่เดียว

    ต้องจับ **ทั้งบล็อกของแต่ละตัว** ไม่ใช่ไล่ทีละบรรทัด เพราะ entry หนึ่งตัว
    เขียนคร่อมหลายบรรทัด (id/en อยู่บรรทัดแรก · file อยู่บรรทัดเดียวกัน · sk
    ต่อลงไปอีกสามบรรทัด) การอ่านทีละบรรทัดจะเจอแค่ตัวที่บังเอิญเขียนบรรทัดเดียว
    """
    m = re.search(r"const BA_FOES_ABYSS = \[(.*?)\n    \];", src, re.S)
    if not m:
        sys.exit('หา BA_FOES_ABYSS ในไฟล์เกมไม่เจอ — ชั้น v6.6 ถูกถอดออกไปหรือเปล่า')
    out = re.findall(r"id:\s*'([^']+)'[\s\S]*?file:\s*'([^']+)'", m.group(1))
    if not out:
        sys.exit('BA_FOES_ABYSS อ่านไม่ออก — รูปแบบบรรทัดเปลี่ยนไปหรือเปล่า')
    return out


def make_frames(path, spec, myth, fw, fh):
    """คืน [(kind, Image)] ของทัพเงาหนึ่งตัว — ทุกเฟรมใช้สเกลกับจุดอ้างอิงเดียวกัน

    ท่าเดียวกับ make_frames ของ embed_monster_art.py ทุกข้อ: คิดสเกลจากกรอบตัวใน
    **เฟรมยืน** ตัวเดียวแล้วใช้กับทุกเฟรม พร้อมยึดจุดอ้างอิงเดียวกัน (กึ่งกลาง-ล่าง)
    ทะเบียนอนิเมชันจึงตรงเป๊ะ ตัวไม่กระโดดตอนสลับท่า
    **ห้ามใช้กรอบของแต่ละเฟรมเองมาคิดสเกล** เฟรมโจมตีมีออร่ากินพื้นที่กว่าเท่าตัว
    """
    cols, rows, idle, act, flip, tweak = spec
    im = Image.open(path).convert('RGB')
    # ทิ้ง "เศษของเฟรมข้างเคียง" ทุกเซลล์ — ตัวอสูรในชีตชุดนี้ล้นกรอบช่องของ
    # ตัวเองได้ ตอนตัดตามกริดจึงมีปีก/ดาบ/ลำแสงของเฟรมข้าง ๆ ติดมาเป็นก้อนลอยริมขอบ
    # (เห็นชัดที่ทัพหน้าเงา · อสูรกายเงา ตอนลองรอบแรก) ใช้ตัวเดียวกับ v6.5 ของฮีโร่
    cs = [HA.drop_bleed(MA.strip_dark(c)) for c in MA.cells_of(im, cols, rows)]
    if flip:
        cs = [c.transpose(Image.FLIP_LEFT_RIGHT) for c in cs]

    need = idle + act
    if max(need) >= len(cs):
        sys.exit('เซลล์ที่ขอ (%d) เกินกริด %dx%d ของ %s'
                 % (max(need), cols, rows, os.path.basename(path)))

    ref = cs[idle[0]].split()[3].getbbox()
    if not ref:
        return []
    body = float(BODY_MYTH if myth else BODY)
    s = body * tweak / float(ref[3] - ref[1])
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


def put_art(src, table):
    """table = [(id, [(kind, uri), ...]), ...] · ตัวที่ไม่มีเฟรมจะไม่ถูกเขียนคีย์เลย

    **ผูกตัวปิดบล็อกด้วย `[^\\[\\]]*` ไม่ใช่ `.*?`** (กับดักข้อ 35) — เนื้อในบล็อกนี้
    ไม่มีวงเล็บเหลี่ยมเลยสักตัว (base64 ใช้แค่ A-Za-z0-9+/=) regex จึงข้ามไปจบที่
    อาร์เรย์ก้อนอื่นไม่ได้ ไม่ว่าบล็อกจะถูกเขียนไว้เป็นบรรทัดเดียวหรือหลายบรรทัด
    """
    rows = []
    for mid, frames in table:
        if not frames:
            continue
        body = ',\n'.join("        { k: '%s', d: '%s' }" % (k, d) for k, d in frames)
        rows.append('      %s: [\n%s\n      ]' % (mid, body))
    new = '    const BA_SH_ART = {};' if not rows else \
          '    const BA_SH_ART = {\n' + ',\n'.join(rows) + '\n    };'
    out, n = re.subn(r'    const BA_SH_ART = \{[^\[\]]*?\};', lambda m: new, src, count=1, flags=re.S)
    if n != 1:
        out, n = re.subn(r'    const BA_SH_ART = \{\n(?:      \w+: \[\n(?:[^\[\]]*\n)*?      \],?\n)*    \};',
                         lambda m: new, src, count=1)
    if n != 1:
        sys.exit('เขียน BA_SH_ART ไม่สำเร็จ — หา anchor ไม่เจอ')
    return out


def cur_art(src):
    m = re.search(r'    const BA_SH_ART = \{(.*?)\n    \};', src, re.S)
    if not m:
        return {}
    out = {}
    for blk in re.finditer(r"(\w+):\s*\[(.*?)\n      \]", m.group(1), re.S):
        out[blk.group(1)] = re.findall(r"k:\s*'(\w+)'\s*,\s*d:\s*'([^']*)'", blk.group(2))
    return out


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
        sys.exit('ไม่รู้จักทัพเงา: %s (มีให้เลือก: %s)'
                 % (', '.join(sorted(bad)), ', '.join(sorted(known))))

    if clear:
        if dry:
            print('--dry: จะถอดภาพทัพเงาทั้ง %d ตัว' % len(foes))
            return
        write_game(put_art(src, []))
        print('ถอดภาพทัพเงาทั้งหมดแล้ว — กลับไปใช้อีโมจิของ v4.0')
        embed_common.rebuild(ROOT)
        return

    keep = cur_art(src)
    myth = set(mid for mid, _ in foes[20:])          # ลำดับ 21-25 คือ Kamish

    raw = {}
    for mid, prefix in foes:
        if want and mid not in want:
            continue
        spec = SH_FRAMES.get(mid)
        if not spec:
            print('  ข้าม %-4s — ไม่มีพิกัดใน SH_FRAMES' % mid)
            continue
        p = MA.resolve(prefix)
        if not p:
            print('  ข้าม %-4s — หาไฟล์ที่ขึ้นต้นด้วย "%s" ไม่เจอ' % (mid, prefix))
            continue
        print('  ถอดพื้นหลัง %-4s ← %s' % (mid, os.path.basename(p)))
        fr = make_frames(p, spec, mid in myth, fw, fh)
        if fr:
            raw[mid] = fr

    if not raw:
        sys.exit('ไม่มีอะไรให้ฝัง — หาไฟล์ต้นฉบับไม่เจอสักไฟล์')

    # ── วัดเพดานจากไฟล์แจกจริง (ท่าเดียวกับ embed_monster_art.py) ────────────
    cleared = put_art(src, [])
    base = MA.base_sizes(cleared, src)
    if base:
        print('\n  ไม่มีภาพทัพเงาเลย ไฟล์แจกได้ %s ไบต์ (GENTLE) · %s ไบต์ (HARD)'
              % (format(base[0], ','), format(base[1], ',')))
    cleared_bytes = len(cleared.encode('utf-8'))
    fallback_budget = embed_common.budget_kb(GAME, DIST) * 1024
    cap = embed_common.HARD_LIMIT - RESERVE

    def fits(cand_bytes):
        if not base:
            return (cand_bytes <= fallback_budget - RESERVE, 'ประมาณ',
                    int(fallback_budget - cand_bytes))
        add = cand_bytes - cleared_bytes            # base64 ผ่าน terser ไปเฉย ๆ
        for size, name in ((base[0], 'GENTLE'), (base[1], 'HARD')):
            if size + add <= cap:
                return True, name, embed_common.HARD_LIMIT - (size + add)
        return False, 'HARD', embed_common.HARD_LIMIT - (base[1] + add)

    chosen = None
    for pal in ([force_pal] if force_pal else PAL_LADDER):
        table, total, nf = [], 0, 0
        for mid, _ in foes:
            if mid in raw:
                fr = []
                for kind, im in raw[mid]:
                    b = MA.webp(im, min(64, pal + PAL_BUMP.get(mid, 0)))
                    total += len(b)
                    nf += 1
                    fr.append((kind, MA.uri(b)))
                table.append((mid, fr))
            else:
                table.append((mid, keep.get(mid, [])))
        cand = put_art(src, table)
        size = len(cand.encode('utf-8'))
        ok, mode, left = fits(size)
        chosen = (pal, table, total, nf, size, cand, ok, mode, left)
        if ok:
            break

    pal, table, total, nf, size, cand, ok, mode, left = chosen

    print('')
    print('ทัพเงา   %d ตัว · %d เฟรม · %dx%d · WebP lossless %d สี' % (len(raw), nf, fw, fh, pal))
    print('ภาพรวม   %s ไบต์ (base64 %s ไบต์)'
          % (format(total, ','), format(int(total * 4 / 3.0), ',')))
    print('ต้นฉบับ  %s ไบต์' % format(size, ','))
    print('ไฟล์แจก  จะย่อด้วยโหมด %s · เหลือถึงเพดาน 2,000,000 อีก %s ไบต์'
          % (mode, format(int(left), ',')))

    if not ok:
        sys.exit('\nหยุด: ทะลุเพดาน (เผื่อไว้ %s ไบต์) แม้ที่จำนวนสีต่ำสุดของบันได — '
                 'ลด FRAME_W/FRAME_H ลงอีก หรือคืนที่จากภาพชุดอื่นก่อน'
                 % format(RESERVE, ','))

    if preview:
        wide = max(len(v) for v in raw.values())
        order = [m for m, _ in foes if m in raw]
        sheet = Image.new('RGBA', (fw * wide, fh * len(order)), (11, 20, 35, 255))
        for j, mid in enumerate(order):
            for i, (_, im) in enumerate(raw[mid]):
                sheet.alpha_composite(im, (i * fw, j * fh))
        out = os.path.join(ROOT, 'abyss_art_preview.png')
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
