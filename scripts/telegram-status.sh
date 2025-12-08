# @file: telegram-status.sh
# @description: Отправка статуса сервера/приложения в Telegram
# @project: SaaS Bonus System
# @dependencies: curl, coreutils, pm2 (опционально), systemd
# @created: 2025-12-08
# @author: AI Assistant + User
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
PM2_APP="${PM2_APP:-bonus-app}"
NGINX_ERR_LOG="${NGINX_ERR_LOG:-/var/log/nginx/error.log}"
PM2_ERR_LOG="${PM2_ERR_LOG:-/root/.pm2/logs/${PM2_APP}-error.log}"

if [[ -z "${BOT_TOKEN}" || -z "${CHAT_ID}" ]]; then
  echo "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required envs" >&2
  exit 1
fi

hostname_fqdn="$(hostname -f 2>/dev/null || hostname)"
uptime_human="$(uptime -p 2>/dev/null || true)"
load_avg="$(cut -d ' ' -f1-3 /proc/loadavg)"
mem_line="$(free -h | awk '/Mem:/ {print $2\" total, \" $3\" used, \" $4\" free\"}')"
swap_line="$(free -h | awk '/Swap:/ {print $2\" total, \" $3\" used, \" $4\" free\"}')"
disk_line="$(df -h / | awk 'NR==2 {print $2\" total, \" $3\" used, \" $4\" free (\"$5\")\"}')"

pm2_status="$(pm2 status "${PM2_APP}" --no-color 2>/dev/null | sed -e 's/[[:space:]]\+/ /g' | head -n 5 || true)"
pm2_tail="$(tail -n 15 "${PM2_ERR_LOG}" 2>/dev/null || echo 'no pm2 error log')"
nginx_tail="$(tail -n 15 "${NGINX_ERR_LOG}" 2>/dev/null || echo 'no nginx error log')"

health_status="skipped"
if curl -fsS --max-time 5 "${HEALTH_URL}" >/dev/null 2>&1; then
  health_status="ok"
else
  health_status="fail"
fi

msg=$(cat <<EOF
⚙️ Host: ${hostname_fqdn}
⏱ Uptime: ${uptime_human}
🧮 Load: ${load_avg}
💾 RAM: ${mem_line}
📦 Swap: ${swap_line}
💽 Disk /: ${disk_line}
🩺 Health (${HEALTH_URL}): ${health_status}
🟢 PM2 (${PM2_APP}): 
${pm2_status}

PM2 errors (tail):
${pm2_tail}

Nginx errors (tail):
${nginx_tail}
EOF
)

curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "disable_web_page_preview=true" \
  --data-urlencode "text=${msg}" >/dev/null

echo "Sent status to Telegram chat ${CHAT_ID}"

