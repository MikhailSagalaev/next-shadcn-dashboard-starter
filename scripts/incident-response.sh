#!/usr/bin/env bash
/**
 * @file: incident-response.sh
 * @description: Быстрый аудит/очистка после инцидента и минимальное hardening
 * @project: SaaS Bonus System
 * @dependencies: coreutils, findutils, sshd, systemd (Ubuntu 24.04+)
 * @created: 2025-12-08
 * @author: AI Assistant + User
 */

set -euo pipefail
IFS=$'\n\t'

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
WORKDIR="/root/incident-${TIMESTAMP}"
REPORT_DIR="${WORKDIR}/reports"
QUAR_DIR="${WORKDIR}/quarantine"

mkdir -p "${REPORT_DIR}" "${QUAR_DIR}"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*" | tee -a "${WORKDIR}/report.log"
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

HARDEN_SSH=${HARDEN_SSH:-true}            # Отключить парольный вход и root-пароль
QUARANTINE_SUSPICIOUS=${QUARANTINE_SUSPICIOUS:-true}  # Перемещать файлы из /tmp*/dev/shm
KILL_TMP_PROCS=${KILL_TMP_PROCS:-true}    # Останавливать процессы, запущенные из /tmp*/dev/shm

log "Incident response started. Workdir: ${WORKDIR}"

capture() {
  local name="$1"; shift
  log "Capture: ${name}"
  ("$@" || true) > "${REPORT_DIR}/${name}.log" 2>&1
}

# Общая информация и журналы
capture "system-info" uname -a
capture "date" date -u
capture "who" who
capture "last" last -n 30
capture "ps" ps auxww
capture "ss" ss -tulpn
capture "crontab-root" crontab -l
capture "timers" systemctl list-timers --all
capture "services" systemctl list-units --type=service --state=running
capture "journal-syslog" journalctl -n 300
capture "journal-auth" journalctl -u ssh -u sshd -n 200
capture "nginx-error" tail -n 400 /var/log/nginx/error.log
capture "nginx-access" tail -n 400 /var/log/nginx/access.log
capture "pm2-status" pm2 status
capture "pm2-logs-bonus-app" pm2 logs bonus-app --lines 200 --nostream

# Бэкап критичных конфигов
log "Backing up sshd_config and nginx configs"
cp /etc/ssh/sshd_config "${WORKDIR}/sshd_config.bak" || true
cp /etc/nginx/nginx.conf "${WORKDIR}/nginx.conf.bak" || true
cp -r /etc/nginx/sites-enabled "${WORKDIR}/nginx-sites-enabled.bak" || true

# Поиск подозрительных файлов в временных директориях
log "Scanning /tmp /var/tmp /dev/shm for recent files"
SUSP_FILES=()
while IFS= read -r f; do
  SUSP_FILES+=("$f")
done < <(find /tmp /var/tmp /dev/shm -maxdepth 2 -type f -mtime -7 -size +0c 2>/dev/null | sort || true)

if [[ ${#SUSP_FILES[@]} -gt 0 ]]; then
  log "Found ${#SUSP_FILES[@]} recent files; details in ${REPORT_DIR}/suspicious-files.log"
  : > "${REPORT_DIR}/suspicious-files.log"
  for f in "${SUSP_FILES[@]}"; do
    {
      echo "---- ${f}"
      ls -l "${f}"
      file "${f}"
      sha256sum "${f}" || true
    } >> "${REPORT_DIR}/suspicious-files.log"
    if [[ "${QUARANTINE_SUSPICIOUS}" == "true" ]]; then
      dest="${QUAR_DIR}/$(basename "${f}")"
      mv "${f}" "${dest}" && log "Quarantined ${f} -> ${dest}" || true
    fi
  done
else
  log "No recent files in temp locations"
fi

# Килл процессов, запущенных из /tmp|/var/tmp|/dev/shm
if [[ "${KILL_TMP_PROCS}" == "true" ]]; then
  log "Killing processes started from temp dirs"
  ps auxww | awk '/\/tmp|\/var\/tmp|\/dev\/shm/ && $0 !~ /awk/ {print $2, $11, $0}' > "${REPORT_DIR}/tmp-processes.log" || true
  while read -r pid _; do
    if [[ -n "${pid}" ]]; then
      kill -9 "${pid}" 2>/dev/null && log "Killed PID ${pid} (tmp-based)" || true
    fi
  done < <(cut -d' ' -f1-2 "${REPORT_DIR}/tmp-processes.log" | sed 's/ \+/\t/; s/\t$//' || true)
fi

# Удаление известных вредоносных артефактов из логов инцидента
for fname in bot pew63 h437; do
  for path in "/tmp/${fname}" "/var/tmp/${fname}" "/dev/shm/${fname}" "/root/${fname}"; do
    if [[ -f "${path}" ]]; then
      mv "${path}" "${QUAR_DIR}/$(basename "${path}")" && log "Quarantined known artifact ${path}"
    fi
  done
done

# Усиление SSH: отключить парольный вход и root-пароль (если включено)
if [[ "${HARDEN_SSH}" == "true" ]]; then
  log "Hardening SSH (PasswordAuthentication no, PermitRootLogin prohibit-password)"
  sed -i 's/^[#[:space:]]*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^[#[:space:]]*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload sshd || systemctl reload ssh || true
fi

# Проверка слушающих портов, вывод только необычных (не 22/80/443/3000/5432)
log "Filtering uncommon listening ports"
ss -tulpn 2>/dev/null | grep -Ev ':(22|80|443|3000|5432)\b' | tee "${REPORT_DIR}/uncommon-ports.log" || true

log "Done. Reports: ${REPORT_DIR}, Quarantine: ${QUAR_DIR}"
log "Review uncommon ports, tmp-processes.log, suspicious-files.log, and rotate all secrets (DB, bots, webhooks, JWT)."


