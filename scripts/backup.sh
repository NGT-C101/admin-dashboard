#!/usr/bin/env bash
# نسخة احتياطية من قاعدة البيانات + المستندات (بيحتفظ بآخر 14 نسخة)
set -euo pipefail
cd "$(dirname "$0")/.."
source .env
DIR=/root/backups
mkdir -p "$DIR" uploads
STAMP=$(date +%F-%H%M)
docker compose exec -T db pg_dump -U "$POSTGRES_USER" admin_dashboard | gzip > "$DIR/db-$STAMP.sql.gz"
tar czf "$DIR/files-$STAMP.tar.gz" uploads
for kind in db files; do
  ls -1t "$DIR"/$kind-*.gz 2>/dev/null | tail -n +15 | xargs -r rm --
done
echo "✅ $DIR/db-$STAMP.sql.gz"
echo "✅ $DIR/files-$STAMP.tar.gz"
