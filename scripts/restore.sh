#!/usr/bin/env bash
# استرجاع نسخة احتياطية:   bash scripts/restore.sh /root/backups/db-XXXX.sql.gz
# لو فيه ملف مستندات بنفس التاريخ (files-XXXX.tar.gz) بيترجع هو كمان
# ⚠️ بيمسح البيانات الحالية ويحط مكانها النسخة
set -euo pipefail
cd "$(dirname "$0")/.."
source .env
[ -f "${1:-}" ] || { echo "اكتب مسار ملف النسخة"; ls -1t /root/backups 2>/dev/null; exit 1; }
FILES="${1/db-/files-}"; FILES="${FILES%.sql.gz}.tar.gz"
read -rp "متأكد؟ البيانات الحالية هتتمسح (اكتب yes): " ok
[ "$ok" = yes ] || exit 1
docker compose stop app
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE admin_dashboard WITH (FORCE);" -c "CREATE DATABASE admin_dashboard;"
gunzip -c "$1" | docker compose exec -T db psql -q -U "$POSTGRES_USER" admin_dashboard
if [ -f "$FILES" ]; then
  rm -rf uploads && tar xzf "$FILES"
  echo "✅ المستندات اترجعت"
fi
docker compose start app
echo "✅ تم الاسترجاع"
