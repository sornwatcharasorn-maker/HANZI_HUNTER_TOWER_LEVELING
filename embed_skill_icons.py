# -*- coding: utf-8 -*-
"""ฝังไอคอนปุ่มสกิลของชั้น v8.9 · DYNAMIC SKILL ICON UI

    python3 embed_skill_icons.py --dry           ดูตัวเลขเฉย ๆ ไม่เขียนทับ
    python3 embed_skill_icons.py --q 55 --w 40   ฝังจริง (บังคับคุณภาพ/ความกว้าง)
    python3 embed_skill_icons.py assassin blade  ฝังเฉพาะบางสาย
    python3 embed_skill_icons.py --clear         ถอดภาพทุกใบกลับไปใช้อีโมจิของคลาส

**สารบัญอยู่ในตัวไฟล์เกมเอง** — สคริปต์อ่านฟิลด์ f ของ BA_DS_ICO แล้วหาไฟล์ตามชื่อนั้น
จึงไม่มีแผนที่ชุดที่สองให้ต้องซิงก์กัน (กติกาเดียวกับ MI_BTNS[].file ของ v5.9 ·
BA_SCENES[].file ของ v6.1 · BA_ANM_DEF[].f ของ v8.7) · เขียนลง "ต้นฉบับ" แล้วสั่ง
build ให้เองปิดท้าย

**คนละก้อนกับ BA_DS_ART/BA_ANM_DEF ของ v8.7/v8.8 โดยตั้งใจ** — ก้อนนั้นเก็บสไปรต์
ต่อสู้เต็มท่า (idle/dash/s1-s4 หลายเฟรม) ส่วน BA_DS_ICO เก็บภาพนิ่งช็อตเดียวต่อสล็อต
สำหรับวาดบนปุ่มแถบสกิล/Diamond Matrix เท่านั้น ไฟล์ต้นฉบับเป็นคนละชุดกันจริง —
ไฟล์ไอคอนชื่อขึ้นต้นด้วยเลข 1-32 ไม่มีคำต่อท้ายบรรยายยาว ๆ แบบไฟล์สไปรต์

ต้นฉบับทั้ง 32 ใบพื้นเป็นสีดำสนิท (PNG โปร่งใสที่ถูกแบนเป็น JPG มาแล้ว เหมือนสไปรต์
ทุกชุดในเกมนี้) ต้องคีย์พื้นดำออกก่อนเสมอ ไม่งั้นไอคอนจะกลายเป็นกล่องดำทึบทับพื้น
กราเดียนต์กรมท่าของปุ่ม .g-skill (#1b2745→#0d131d ไม่ใช่ดำสนิท จึงเห็นรอยขอบ)
ยืม black_key() ของ embed_hero_art.py มาใช้ซ้ำ **ห้ามคัดลอกมาไว้อีกที่**
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

W_DEF = 40                            # แสดงจริงแค่ 26 CSS px (.g-skill-icon img)
LADDER = [55, 48, 42, 36]             # บันไดคุณภาพ ถ้าที่ไม่พอ
EXT = ('.jpg', '.jpeg', '.png', '.webp')
DIRS = ('', 'assets', os.path.join('assets', 'skills'), os.path.join('assets', 'icons'))

BLOCK_RX = re.compile(r'(const BA_DS_ICO = \{)(.*?)(\n    \};)', re.S)
# ผูกตัวปิดด้วย "สิ่งที่เนื้อในเป็นไปไม่ได้" ไม่ใช่ .*? ลอย ๆ — บทเรียนข้อ 35


def norm(s):
    """ยุบเว้นวรรคทุกชนิดให้เหลือช่องเดียว แล้วตัดหัวท้าย (ใช้จับคู่ชื่อไฟล์)"""
    return re.sub(r'\s+', ' ', s).strip().lower()


def resolve(name):
    """หาไฟล์ต้นฉบับจากชื่อในสารบัญ — ยุบเว้นวรรคทั้งสองฝั่งก่อนเทียบเสมอ
    (กติกาเดียวกับ resolve() ของ embed_skill_art.py)"""
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


def webp(path, w, q):
    """ย่อเป็นสี่เหลี่ยมจัตุรัสกว้าง w แล้วคีย์พื้นดำออกก่อนเข้ารหัส (RGBA + alpha)"""
    im = Image.open(path).convert('RGB')
    try:
        import embed_hero_art
        im = embed_hero_art.black_key(im)
    except Exception as e:
        print('  ⚠️  คีย์พื้นดำไม่สำเร็จ (%s) — ฝังทั้งพื้นดำไปก่อน' % e)
        im = im.convert('RGBA')
    if im.size != (w, w):
        im = im.resize((w, w), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    return buf.getvalue(), im.size


def parse(block):
    """คืน [(role, slot 0-3, ชื่อไฟล์, ตำแหน่งของ u: '...' ในสตริง)] ตามลำดับที่พบ
    แยกด้วยระดับการย่อหน้า (6 ช่อง = role · รายการในอาร์เรย์ = สล็อต) เหมือน
    parse() ของ embed_skill_art.py"""
    out = []
    role = ''
    idx = 0
    # f:/u: ค่าอาจมีอัญประกาศเดี่ยวหลุด (เช่นชื่อไฟล์ "Monarch's Precision") ที่ถูก
    # escape ไว้เป็น \' ในสตริง JS — จับ (?:[^'\\]|\\.)* แทน [^']* ธรรมดา แล้ว unescape ทีหลัง
    for m in re.finditer(r"^ {6}([a-z]+):\s*\["
                         r"|f:\s*'((?:[^'\\]|\\.)*)'|u:\s*'((?:[^'\\]|\\.)*)'", block, re.M):
        if m.group(1):
            role = m.group(1)
            idx = 0
        elif m.group(2) is not None:
            fname = re.sub(r"\\(.)", r"\1", m.group(2))
            out.append([role, idx, fname, None])
            idx += 1
        elif m.group(3) is not None and out:
            out[-1][3] = m.span()
    heads = len(out)
    us = len(re.findall(r"u:\s*'[^']*'", block))
    if heads != us:
        sys.exit('อ่านทะเบียนไม่ตรงกัน — เจอ f: %d ช่อง แต่มีช่อง u %d ช่อง\n'
                 '    เช็กการจัดรูปแบบของ BA_DS_ICO ก่อน' % (heads, us))
    return [x for x in out if x[3]]


def main(argv):
    dry = '--dry' in argv
    clear = '--clear' in argv
    q = opt_int(argv, '--q', None)
    w = opt_int(argv, '--w', W_DEF)
    pick = [a.lower() for a in argv if not a.startswith('--') and not a.isdigit()]

    src = open(GAME, encoding='utf-8').read()
    mb = BLOCK_RX.search(src)
    if not mb:
        sys.exit('หาบล็อก BA_DS_ICO ไม่เจอ — ชั้น v8.9 ถูกถอดออกไปแล้วหรือเปล่า')
    rows = parse(mb.group(2))
    if not rows:
        sys.exit('อ่านทะเบียนไม่ออก')

    if clear:
        nb = re.sub(r"u:\s*'[^']*'", "u: ''", mb.group(2))
        src = src[:mb.start(2)] + nb + src[mb.end(2):]
        write_src(src, dry)
        print('ถอดไอคอนทุกใบแล้ว — ตกกลับไปใช้อีโมจิของคลาส')
        return

    todo = []
    for role, slot, fname, span in rows:
        if pick and role not in pick:
            continue
        if not fname:
            continue
        path = resolve(fname)
        if not path:
            print('  ✗ %-11s สล็อต %d ไม่เจอไฟล์  %s' % (role, slot + 1, fname))
            continue
        todo.append((role, slot, fname, span, path))

    if not todo:
        sys.exit('\nไม่มีไฟล์ให้ฝังเลย — อัปโหลดไอคอนเข้ารากrepoก่อน (ดูชื่อในสารบัญ)')

    base = len(src.encode('utf-8')) - sum(sp[1] - sp[0] for _, _, _, sp, _ in todo)
    for qq in ([q] if q else LADDER):
        parts, tot = {}, 0
        for role, slot, fname, span, path in todo:
            data, size = webp(path, w, qq)
            uri = 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii')
            parts[(role, slot)] = (uri, size, len(data))
            tot += len(uri) + 7
        after = (base + tot) / 1024.0
        print('\nq%-3d w%-4d รวม base64 %.1f KB → ต้นฉบับ %.0f KB (เพดาน %.0f KB)'
              % (qq, w, tot / 1024.0, after, BUDGET_KB))
        if after <= BUDGET_KB:
            break
    else:
        sys.exit('\n⚠️  ทะลุเพดานทุกขั้นของบันได — **ต้องคืนที่ "ที่ภาพ" ก่อน**\n'
                 '    เกินไป %.1f KB' % (after - BUDGET_KB))
    if after > BUDGET_KB:
        sys.exit('\n⚠️  ทะลุเพดาน %.1f KB — ต้องคืนที่ "ที่ภาพ" ก่อน' % (after - BUDGET_KB))

    nb, off = mb.group(2), 0
    for role, slot, fname, span, path in todo:
        uri, size, raw = parts[(role, slot)]
        a, b = span[0] + off, span[1] + off
        rep = "u: '" + uri + "'"
        nb = nb[:a] + rep + nb[b:]
        off += len(rep) - (b - a)
        print('  ✓ %-11s สล็อต %d  %dx%d · %.1f KB  ←  %s'
              % (role, slot + 1, size[0], size[1], raw / 1024.0, os.path.basename(path)))
    src = src[:mb.start(2)] + nb + src[mb.end(2):]
    write_src(src, dry)


def write_src(out, dry):
    if dry:
        print('\n(--dry: ไม่ได้เขียนทับ)')
        return
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
