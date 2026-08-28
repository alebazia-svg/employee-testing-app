#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/offonika-portal}
MAX_BACKUP_AGE_HOURS=${MAX_BACKUP_AGE_HOURS:-36}
MAX_DISK_USED_PERCENT=${MAX_DISK_USED_PERCENT:-85}
CHECKS_FILE=$(mktemp)
trap 'rm -f "$CHECKS_FILE"' EXIT

add_check() {
  local key=$1 label=$2 ok=$3 detail=$4
  printf '%s\t%s\t%s\t%s\n' "$key" "$label" "$ok" "${detail//$'\t'/ }" >> "$CHECKS_FILE"
}

disk_used=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')
if (( disk_used < MAX_DISK_USED_PERCENT )); then
  add_check disk "Место на сервере" true "Занято ${disk_used}%"
else
  add_check disk "Место на сервере" false "Занято ${disk_used}%, предел ${MAX_DISK_USED_PERCENT}%"
fi

latest_backup=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '*.tmp' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 || true)
if [[ -n "$latest_backup" ]]; then
  backup_epoch=${latest_backup%% *}
  backup_path=${latest_backup#* }
  backup_age_hours=$(( ($(date +%s) - ${backup_epoch%.*}) / 3600 ))
  if (( backup_age_hours <= MAX_BACKUP_AGE_HOURS )) && [[ -s "$backup_path/postgres.dump" && -s "$backup_path/uploads.tar.gz" && -s "$backup_path/SHA256SUMS" ]]; then
    add_check backup "Резервная копия портала" true "Последняя копия ${backup_age_hours} ч назад"
  else
    add_check backup "Резервная копия портала" false "Последняя пригодная копия старше ${MAX_BACKUP_AGE_HOURS} ч или неполная"
  fi
else
  add_check backup "Резервная копия портала" false "Резервная копия не найдена"
fi

container_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' portal-app 2>/dev/null || true)
[[ "$container_health" == healthy ]] \
  && add_check portal "Портал" true "Контейнер healthy" \
  || add_check portal "Портал" false "Состояние контейнера: ${container_health:-не найден}"

units=(
  ausn-report-cache-refresh
  bank-statement-engine
  bank-statement-engine-vtb-import
  bank-statement-engine-vtb-resolver
  offonika-admin-inbox-telegram
  offonika-cash-operation-retry
  offonika-credit-realization-shadow
  offonika-dependency-watchdog
  offonika-expense-request-sync
  offonika-portal-offsite-backup
  offonika-terminal-fiscal-current
  offonika-terminal-fiscal-final
  offonika-terminal-fiscal-owner-report
  offonika-workday-notifications
)
declare -A unit_labels=(
  [ausn-report-cache-refresh]="Обновление данных АУСН"
  [bank-statement-engine]="Загрузка выписки Т-Банка"
  [bank-statement-engine-vtb-import]="Загрузка выписки ВТБ"
  [bank-statement-engine-vtb-resolver]="Проверка документов ВТБ"
  [offonika-admin-inbox-telegram]="Отправка важных сообщений в Telegram"
  [offonika-cash-operation-retry]="Повторная проверка инкассаций"
  [offonika-credit-realization-shadow]="Проверка кредитных продаж"
  [offonika-dependency-watchdog]="Контроль подключений к внешним сервисам"
  [offonika-expense-request-sync]="Проверка заявок на расходы"
  [offonika-portal-offsite-backup]="Внешняя резервная копия портала"
  [offonika-terminal-fiscal-current]="Текущая сверка оплат по терминалу"
  [offonika-terminal-fiscal-final]="Итоговая сверка оплат по терминалу"
  [offonika-terminal-fiscal-owner-report]="Отчёт владельцу по оплатам"
  [offonika-workday-notifications]="Отправка уведомлений сотрудникам"
)
for unit in "${units[@]}"; do
  timer_state=$(systemctl is-active "$unit.timer" 2>/dev/null || true)
  service_state=$(systemctl is-active "$unit.service" 2>/dev/null || true)
  service_result=$(systemctl show "$unit.service" -p Result --value 2>/dev/null || true)
  if [[ "$timer_state" == active && ( "$service_state" == active || "$service_state" == activating ) ]]; then
    add_check "unit.$unit" "${unit_labels[$unit]}" true "Расписание активно, проверка выполняется сейчас"
  elif [[ "$timer_state" == active && ( "$service_result" == success || -z "$service_result" ) ]]; then
    add_check "unit.$unit" "${unit_labels[$unit]}" true "Расписание активно, последняя проверка успешна"
  else
    add_check "unit.$unit" "${unit_labels[$unit]}" false "Расписание: ${timer_state:-не найден}; служба: ${service_state:-не найдена}; результат: ${service_result:-нет}"
  fi
done

checks_json=$(python3 - "$CHECKS_FILE" <<'PY'
import csv, json, sys
with open(sys.argv[1], encoding='utf-8') as source:
    rows = list(csv.reader(source, delimiter='\t'))
print(json.dumps([{'key': key, 'label': label, 'ok': ok == 'true', 'detail': detail} for key, label, ok, detail in rows], ensure_ascii=False))
PY
)
docker exec --env "INFRASTRUCTURE_CHECKS_JSON=$checks_json" portal-app node --conditions=react-server --import tsx scripts/infrastructure-watchdog.ts
