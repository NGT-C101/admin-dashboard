#!/usr/bin/env bash
# استرجاع نسخة احتياطية:   bash scripts/restore.sh /root/backups/db-XXXX.sql.gz
# ⚠️ بيمسح البيانات الحالية ويحط مكانها النسخة
set -euo pipefail
cd "$(dirname "$0")/.."
source .env
[ -f "${1:-}" ] || { echo "اكتب مسار ملف النسخة"; ls -1t /root/backups 2>/dev/null; exit 1; }
read -rp "متأكد؟ البيانات الحالية هتتمسح (اكتب yes): " ok
[ "$ok" = yes ] || exit 1
docker compose stop app
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE admin_dashboard WITH (FORCE);" -c "CREATE DATABASE admin_dashboard;"
gunzip -c "$1" | docker compose exec -T db psql -q -U "$POSTGRES_USER" admin_dashboard
docker compose start app
echo "✅ تم الاسترجاع"
