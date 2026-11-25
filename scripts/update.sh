#!/usr/bin/env bash
# تحديث المنصة لآخر نسخة على GitHub:   bash scripts/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/backup.sh          # نسخة احتياطية قبل أي تحديث
git pull
docker compose up -d --build
docker image prune -f >/dev/null
echo "✅ تم التحديث"
