# -*- coding: utf-8 -*-
"""ฝังสไปรต์สกิลของชั้น v8.7 · SKILL SPRITE ANIMATION ENGINE

    python3 embed_skill_art.py --dry           ดูตัวเลขเฉย ๆ ไม่เขียนทับ
    python3 embed_skill_art.py --q 52 --w 128  ฝังจริง (บังคับคุณภาพ/ความกว้าง)
    python3 embed_skill_art.py c1 idle dash    ฝังเฉพาะบางสถานะ
    python3 embed_skill_art.py --clear         ถอดภาพทุกใบกลับไปใช้เฟรมของ v6.5

**สารบัญอยู่ในตัวไฟล์เกมเอง** — สคริปต์อ่านฟิลด์ f ของ BA_ANM_DEF แล้วหาไฟล์ตามชื่อนั้น
จึงไม่มีแผนที่ชุดที่สองให้ต้องซิงก์กัน (กติกาเดียวกับ MI_BTNS[].file ของ v5.9
· BA_SCENES[].file ของ v6.1) · เขียนลง "ต้นฉบับ" แล้วสั่ง build ให้เองปิดท้าย

⚠️ ชื่อไฟล์บนดิสก์มีเว้นวรรคคู่อยู่หลายใบ (`5.Shadow Assassin  - BATTLE IDLE.jpg`)
   ส่วนทะเบียนในเกมเก็บชื่อตามสเปก (เว้นวรรคเดี่ยว) — resolve() จึงยุบเว้นวรรค
   ทั้งสองฝั่งก่อนจับคู่เสมอ **อย่าถอดออก** ไม่งั้นจะหาไฟล์ไม่เจอทั้งชุด

⚠️ ตอนเขียนสคริปต์นี้ **ไฟล์แจกยังไม่เหลือที่ให้ฝังสักใบ** — สไปรต์ 6 ใบของ C1
   รวมกัน ~204KB (base64 ~272KB) ส่วนที่ว่างมีราว 16KB · สคริปต์จึงหยุดให้เอง
   พร้อมบอกว่าเกินไปเท่าไร **ต้องคืนที่ "ที่ภาพ" ก่อนเสมอ ห้ามลบคอมเมนต์ในต้นฉบับ**
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

GAME, DIST, ROOT = embed_common.resolve_game(HERE)
BUDGET_KB = embed_common.budget_kb(GAME, DIST)

# ความกว้าง "ต่อหนึ่งเฟรม" ไม่ใช่ของทั้งแถบ — สไปรต์บางใบเป็นแถบหลายเฟรม
# (ท่ายืน 3 เฟรม · ท่าพุ่ง 4 เฟรม) จำนวนเฟรมอ่านจากฟิลด์ n ของทะเบียนในเกม
W_DEF = 112          # #baHero กว้าง 62 CSS px (86-116 ตามความกว้างจอ) → 1.3 เท่าตามแถบ v6.5
LADDER = [52, 46, 40, 34]            # บันไดคุณภาพ ถ้าที่ไม่พอ
EXT = ('.jpg', '.jpeg', '.png', '.webp')
DIRS = ('', 'assets', os.path.join('assets', 'skills'), os.path.join('assets', 'sprites'))

# ── ตำแหน่งของบล็อกทะเบียนในไฟล์เกม ──────────────────────────────────────
BLOCK_RE = re.compile(r'(const BA_ANM_DEF = \{)(.*?)(\n    \};)', re.S)
# ผูกตัวปิดด้วย "สิ่งที่เนื้อในเป็นไปไม่ได้" ไม่ใช่ .*? ลอย ๆ — บทเรียนข้อ 35


def norm(s):
    """ยุบเว้นวรรคทุกชนิดให้เหลือช่องเดียว แล้วตัดหัวท้าย (ใช้จับคู่ชื่อไฟล์)"""
    return re.sub(r'\s+', ' ', s).strip().lower()


def resolve(name):
    """หาไฟล์ต้นฉบับจากชื่อในสารบัญ — ยุบเว้นวรรคทั้งสองฝั่งก่อนเทียบเสมอ

    ลองสองชั้นตามลำดับ

      1 · ชื่อตรงกันเป๊ะหลังตัดนามสกุลออกทั้งสองฝั่ง (ทางปกติ)
      2 · **ชื่อบนดิสก์ "ขึ้นต้นด้วย" ชื่อเต็มในสารบัญ (รวมนามสกุล)** — เจ้าของ repo
          อัปโหลดผ่านเว็บ GitHub แล้วชื่อไฟล์มีหางต่อท้ายมาได้จริง เช่น
          `shadow_monarch_c2_idle.png .ba-monarch-idle.jpg` ซึ่งเป็นชื่อในสารบัญ
          (`shadow_monarch_c2_idle.png`) บวกชื่อคลาส CSS ต่อท้ายแล้วบันทึกเป็น .jpg
          **ห้ามแก้ด้วยการเปลี่ยนชื่อไฟล์บนดิสก์แทน** เพราะรอบหน้าที่เจ้าของ repo
          อัปโหลดทับ ชื่อจะกลับมาเป็นแบบเดิมแล้วสคริปต์จะหาไม่เจออีก
          (กติกาเดียวกับการยุบเว้นวรรคข้างบน — ตัวสารบัญยังอยู่ในเกมที่เดียวเหมือนเดิม)
    """
    full = norm(name)
    stem = norm(os.path.splitext(name)[0])
    loose = None
    for d in DIRS:
        base = os.path.join(ROOT, d) if d else ROOT
        if not os.path.isdir(base):
            continue
        for f in sorted(os.listdir(base)):
            n, e = os.path.splitext(f)
            if e.lower() not in EXT:
                continue
            if norm(n) == stem:
                return os.path.join(base, f)
            if loose is None and norm(n).startswith(full):
                loose = os.path.join(base, f)
    return loose


def webp(path, fw, frames, q):
    """ย่อให้ "หนึ่งเฟรม" กว้าง fw แล้วคีย์พื้นดำออกก่อนเข้ารหัส

    ต้นฉบับทั้ง 6 ใบเป็น PNG พื้นโปร่งที่ถูกแบนเป็น JPG มาแล้ว พื้นจึงเป็นดำสนิท
    ถ้าไม่คีย์ออก จะได้กล่องดำทับฉากหลังสนามรบเต็ม ๆ · ยืม black_key() ของ
    embed_hero_art.py มาใช้ซ้ำ **ห้ามคัดลอกมาไว้อีกที่** (จะกลายเป็นสองก้อนที่ต้องซิงก์กัน)
    ตัวมันลบเฉพาะ "ดำที่ต่อเนื่องมาจากขอบภาพ" ด้วย connected component
    **ห้ามใช้เกณฑ์ความสว่างกวาดทั้งใบ** เสื้อโค้ทของตัวละครก็ดำเกือบสนิทเหมือนกัน"""
    im = Image.open(path).convert('RGB')
    try:
        import embed_hero_art
        im = embed_hero_art.black_key(im)
    except Exception as e:
        print('  ⚠️  คีย์พื้นดำไม่สำเร็จ (%s) — ฝังทั้งพื้นดำไปก่อน' % e)
    w = fw * max(1, frames)
    if im.width != w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    return buf.getvalue(), im.size


def parse(block):
    """คืน [(ร่าง, คีย์, ชื่อไฟล์, จำนวนเฟรม, ตำแหน่งของ u: '' ในสตริง)] ตามลำดับที่พบ"""
    out = []
    tier = ''
    for m in re.finditer(r"^\s*(c1|c2):\s*\{|^\s*(idle|dash|s[1-4]):\s*\{"
                         r"|f:\s*'([^']*)'|n:\s*(\d+)|u:\s*'([^']*)'", block, re.M):
        if m.group(1):
            tier = m.group(1)
        elif m.group(2):
            out.append([tier, m.group(2), '', 1, None])
        elif m.group(3) is not None and out:
            out[-1][2] = m.group(3)
        elif m.group(4) is not None and out:
            out[-1][3] = int(m.group(4))
        elif m.group(5) is not None and out:
            out[-1][4] = m.span()
    return [x for x in out if x[4]]


def main(argv):
    dry = '--dry' in argv
    clear = '--clear' in argv
    q = opt_int(argv, '--q', None)
    w = opt_int(argv, '--w', W_DEF)
    pick = [a.lower() for a in argv if not a.startswith('--') and not a.isdigit()]
    pick = [a for a in pick if not a.isdigit()]

    src = open(GAME, encoding='utf-8').read()
    mb = BLOCK_RE.search(src)
    if not mb:
        sys.exit('หาบล็อก BA_ANM_DEF ไม่เจอ — ชั้น v8.7 ถูกถอดออกไปแล้วหรือเปล่า')
    block = mb.group(2)
    rows = parse(block)
    if not rows:
        sys.exit('อ่านทะเบียนไม่ออก')

    if clear:
        nb = re.sub(r"u:\s*'[^']*'", "u: ''", block)
        write(src, mb, nb, dry)
        print('ถอดภาพทุกใบแล้ว — ตกกลับไปใช้เฟรมฮีโร่ของ v6.5')
        return

    todo = []
    for tier, key, name, frames, span in rows:
        if pick and tier not in pick and key not in pick and (tier + '.' + key) not in pick:
            continue
        path = resolve(name)
        if not path:
            print('  ✗ %-3s %-5s ไม่เจอไฟล์  %s' % (tier, key, name))
            continue
        todo.append((tier, key, name, frames, span, path))

    if not todo:
        sys.exit('\nไม่มีไฟล์ให้ฝังเลย — อัปโหลดสไปรต์เข้ารากrepoก่อน (ดูชื่อในสารบัญ)')

    base = len(src.encode('utf-8'))
    for qq in ([q] if q else LADDER):
        parts, tot = {}, 0
        for tier, key, name, frames, span, path in todo:
            data, size = webp(path, w, frames, qq)
            uri = 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii')
            parts[(tier, key)] = (uri, size, len(data))
            tot += len(uri)
        after = (base + tot) / 1024.0
        print('\nq%-3d w%-4d รวม base64 %.1f KB → ต้นฉบับ %.0f KB (เพดาน %.0f KB)'
              % (qq, w, tot / 1024.0, after, BUDGET_KB))
        if after <= BUDGET_KB:
            break
    else:
        sys.exit('\n⚠️  ทะลุเพดานทุกขั้นของบันได — **ต้องคืนที่ "ที่ภาพ" ก่อน**\n'
                 '    เกินไป %.1f KB · ห้ามลบคอมเมนต์ในต้นฉบับเพื่อประหยัดที่เด็ดขาด'
                 % (after - BUDGET_KB))
    if after > BUDGET_KB:
        sys.exit('\n⚠️  ทะลุเพดาน %.1f KB — ต้องคืนที่ "ที่ภาพ" ก่อน' % (after - BUDGET_KB))

    nb, off = block, 0
    for tier, key, name, frames, span, path in todo:
        uri, size, raw = parts[(tier, key)]
        a, b = span[0] + off, span[1] + off
        rep = "u: '" + uri + "'"
        nb = nb[:a] + rep + nb[b:]
        off += len(rep) - (b - a)
        print('  ✓ %-3s %-5s %dx%d (%d เฟรม) · %.1f KB  ←  %s'
              % (tier, key, size[0], size[1], frames, raw / 1024.0, os.path.basename(path)))
    write(src, mb, nb, dry)


def write(src, mb, nb, dry):
    if dry:
        print('\n(--dry: ไม่ได้เขียนทับ)')
        return
    out = src[:mb.start(2)] + nb + src[mb.end(2):]
    open(GAME, 'w', encoding='utf-8').write(out)
    print('\nเขียนลงต้นฉบับแล้ว → %s' % os.path.basename(GAME))
    embed_common.rebuild(ROOT)


def opt_int(argv, flag, default):
    for i, a in enumerate(argv):
        if a == flag and i + 1 < len(argv):
            return int(argv[i + 1])
        if a.startswith(flag + '='):
            return int(a.split('=', 1)[1])
    return default


if __name__ == '__main__':
    main(sys.argv[1:])
