#!/usr/bin/env bash
# =============================================================
#  تثبيت منصة الإدارة على سيرفر Ubuntu جديد
#  التشغيل (من جوه فولدر المشروع):   sudo bash scripts/install.sh
# =============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

green() { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }

[ "$(id -u)" = 0 ] || { echo "شغّل السكريبت بـ sudo"; exit 1; }

green "==> 1/6 تحديث النظام"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -y -qq

green "==> 2/6 تثبيت Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

green "==> 3/6 الجدار الناري (يسمح بـ SSH و HTTP و HTTPS بس)"
apt-get install -y -qq ufw
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

green "==> 4/6 ذاكرة إضافية (Swap) عشان البناء ميقفش"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

green "==> 5/6 الإعدادات"
if [ ! -f .env ]; then
  IP=$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
  DEFAULT_DOMAIN="$(echo "$IP" | tr . -).sslip.io"
  echo
  yellow "لو عندك دومين (زي admin.company.com) ووجّهته على IP السيرفر ($IP) اكتبه."
  yellow "لو معندكش، دوس Enter وهنستخدم: $DEFAULT_DOMAIN"
  read -rp "الدومين: " DOMAIN
  DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
  read -rp "إيميل حساب المدير [admin@company.com]: " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@company.com}

  rand() { openssl rand -hex "$1"; }   # $1 بايت = ضعفها حروف
  ADMIN_PASSWORD=$(rand 8)
  cat > .env <<ENV
DOMAIN=$DOMAIN
POSTGRES_USER=admin
POSTGRES_PASSWORD=$(rand 16)
SESSION_SECRET=$(rand 32)
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV
  chmod 600 .env
fi
source .env

green "==> 6/6 بناء وتشغيل المنصة (أول مرة بتاخد 5-10 دقايق)"
docker compose up -d --build

# نسخة احتياطية يومية الساعة 3 الفجر
CRON="0 3 * * * cd $(pwd) && bash scripts/backup.sh >> /var/log/admin-backup.log 2>&1"
( { crontab -l 2>/dev/null || true; } | { grep -v 'scripts/backup.sh' || true; }; echo "$CRON" ) | crontab -

echo
green "============================================================"
green "  ✅ المنصة اشتغلت!"
green "  افتح:  https://$DOMAIN"
# بيانات الدخول بتظهر لحد أول تثبيت ناجح بس
if [ ! -f .installed ]; then
  green "  الإيميل:       $ADMIN_EMAIL"
  green "  كلمة المرور:   $ADMIN_PASSWORD"
  yellow "  ⚠️  احفظ كلمة المرور دي في مكان آمن دلوقتي"
  touch .installed
fi
green "  (لو الصفحة مفتحتش، استنى دقيقة لحد ما شهادة HTTPS تتعمل)"
green "============================================================"
