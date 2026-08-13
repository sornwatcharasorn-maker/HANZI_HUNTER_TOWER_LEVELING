# -*- coding: utf-8 -*-
"""ตัวช่วยที่ใช้ร่วมกันของสคริปต์ฝังภาพทั้ง 5 ตัว

ตั้งแต่มีขั้นตอนย่อไฟล์ (build_minify.js) repo นี้มีไฟล์เกม **สองใบ**

    src/hanzi_hunter_tower_v3_1_intro.src.html   ← ต้นฉบับ อ่านง่าย มีคอมเมนต์ครบ (แก้ที่นี่)
    hanzi_hunter_tower_v3_1_intro.html           ← ไฟล์แจกนักเรียน (ย่อแล้ว · ห้ามแก้มือ)

สคริปต์ฝังภาพต้องเขียนลง **ต้นฉบับ** เสมอ แล้วสั่งย่อใหม่ปิดท้าย
ถ้าไปเขียนไฟล์แจกตรง ๆ การย่อรอบถัดไปจะทับทิ้งทั้งหมด

เพดาน 2,000,000 ไบต์ยังเป็นเพดานของ **ไฟล์แจก** เหมือนเดิม ไม่ใช่ของต้นฉบับ
`budget_kb()` จึงแปลงเพดานนั้นกลับมาเป็นเพดานฝั่งต้นฉบับให้ โดยบวก
"ส่วนที่ย่อทิ้งได้" (คอมเมนต์ + ช่องว่าง) เข้าไป — ค่านี้คงที่เมื่อสลับรูป
เพราะ base64 ผ่าน terser ไปเฉย ๆ ไม่ถูกย่อแม้แต่ไบต์เดียว
ตรรกะบันไดคุณภาพของแต่ละสคริปต์จึงไม่ต้องแก้อะไรเลย
"""

import os
import subprocess
import sys

HARD_LIMIT = 2000000          # เพดานจริงของไฟล์แจก (ไบต์) ตาม CLAUDE.md
FALLBACK_KB = 1953            # ใช้ตอนยังไม่มีไฟล์แจก = พฤติกรรมเดิมก่อนมีขั้นตอนย่อ

SRC_REL = os.path.join('src', 'hanzi_hunter_tower_v3_1_intro.src.html')
DIST_REL = 'hanzi_hunter_tower_v3_1_intro.html'


def _roots(here):
    """ลองทั้งโฟลเดอร์ของสคริปต์เองและโฟลเดอร์แม่ (เผื่อสคริปต์ถูกย้ายไป tools/)"""
    return [here, os.path.dirname(here)]


def resolve_game(here):
    """คืน (ไฟล์ที่ต้องแก้, ไฟล์แจก, รากrepo)

    มีต้นฉบับ → แก้ต้นฉบับ · ไม่มี → ตกกลับไปแก้ไฟล์แจกตรง ๆ แบบเดิม
    """
    for root in _roots(here):
        src = os.path.join(root, SRC_REL)
        if os.path.exists(src):
            return src, os.path.join(root, DIST_REL), root
    for root in _roots(here):
        dist = os.path.join(root, DIST_REL)
        if os.path.exists(dist):
            return dist, dist, root
    sys.exit('หาไฟล์เกมไม่เจอ — ต้องมี %s หรือ %s' % (SRC_REL, DIST_REL))


def budget_kb(game, dist):
    """เพดานฝั่งต้นฉบับ (KB) ที่เทียบเท่าเพดาน 2,000,000 ไบต์ของไฟล์แจก"""
    if game != dist and os.path.exists(dist) and os.path.exists(game):
        overhead = os.path.getsize(game) - os.path.getsize(dist)
        if overhead > 0:
            return (HARD_LIMIT + overhead) / 1024.0
    return float(FALLBACK_KB)


def rebuild(root, quiet=False):
    """สั่ง build_minify.js ย่อไฟล์ใหม่หลังฝังรูปเสร็จ

    ไม่มี node / ไม่มี node_modules → เตือนแล้วปล่อยผ่าน (ต้นฉบับถูกแก้ไปแล้ว
    ไฟล์แจกแค่ยังไม่ถูกอัปเดต ซึ่งซ่อมได้ด้วยการรัน `node build_minify.js` เอง)
    """
    script = os.path.join(root, 'build_minify.js')
    if not os.path.exists(script):
        return False
    try:
        r = subprocess.run(['node', script], cwd=root,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    except OSError:
        print('\n⚠️  ไม่มี node ในเครื่อง — ต้นฉบับถูกแก้แล้ว แต่ยังไม่ได้ย่อเป็นไฟล์แจก')
        print('   สั่งเองภายหลังด้วย: node build_minify.js')
        return False
    out = r.stdout.decode('utf-8', 'replace').strip()
    if r.returncode != 0:
        print('\n⚠️  ย่อไฟล์ไม่สำเร็จ — ต้นฉบับถูกแก้แล้ว แต่ไฟล์แจกยังเป็นของเดิม')
        print(out)
        return False
    if not quiet:
        print('\n— ย่อไฟล์แจกใหม่แล้ว —')
        print(out)
    return True
