#!/usr/bin/env bash
# تحديث المنصة لآخر نسخة على GitHub:   bash scripts/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/backup.sh          # نسخة احتياطية قبل أي تحديث
git pull
docker compose up -d --build
docker image prune -f >/dev/null
# بقايا البناء تتراكم مع كل تحديث (وصلت 55 جيجا): نمسح الأقدم من يوم، ولا نلمس البيانات أو قاعدة البيانات
docker builder prune -af --filter "until=24h" >/dev/null || true
echo "✅ تم التحديث"
df -h / | awk 'NR==2 {print "💾 مساحة القرص: مستخدم " $3 " من " $2 " (" $5 ")، والمتاح " $4}'
