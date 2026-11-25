#!/usr/bin/env bash
# نسخة احتياطية من قاعدة البيانات (بيحتفظ بآخر 14 نسخة)
set -euo pipefail
cd "$(dirname "$0")/.."
source .env
DIR=/root/backups
mkdir -p "$DIR"
FILE="$DIR/db-$(date +%F-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" admin_dashboard | gzip > "$FILE"
ls -1t "$DIR"/db-*.sql.gz | tail -n +15 | xargs -r rm --
echo "✅ $FILE"
