#!/bin/bash
# รันชุดเทสต์ทั้ง 21 ชุด แล้วสรุปผ่าน/ตกเป็นบรรทัดเดียวต่อชุด (glob test_*.js — ชุดใหม่ถูกเก็บเอง)
#   ./run_all_tests.sh <โฟลเดอร์เก็บผล>
#
# แต่ละชุดใช้สัญลักษณ์คนละแบบ (✅/❌ · PASS/FAIL · ✓/✗ · ผ่าน/ตก)
# และบางชุดเขียนผลลง .log อย่างเดียวไม่ออก stdout — จึงนับจากทั้งสองที่
cd "$(dirname "$0")" || exit 1
OUT=${1:-/tmp/testrun}
mkdir -p "$OUT"
for t in test_*.js; do
  n=$(basename "$t" .js)
  rm -f "$n.log"
  NODE_PATH=/opt/node22/lib/node_modules timeout 1800 node "$t" > "$OUT/$n.out" 2>&1
  rc=$?
  cat "$OUT/$n.out" > "$OUT/$n.all"
  [ -f "$n.log" ] && cat "$n.log" >> "$OUT/$n.all"
  p=$(grep -c -e '✅' -e '  PASS ' -e '  ✓ ' "$OUT/$n.all")
  f=$(grep -c -e '❌' -e '  FAIL ' -e '  ✗ ' "$OUT/$n.all")
  echo "$n rc=$rc pass=$p fail=$f"
done
