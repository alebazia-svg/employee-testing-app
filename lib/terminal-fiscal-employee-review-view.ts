const moscowTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatKopecks(value: number) {
  const rubles = value / 100;
  return `${rubles.toLocaleString('ru-RU', {
    minimumFractionDigits: Number.isInteger(rubles) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₽`;
}

export function terminalFiscalEmployeeReviewSummary(input: {
  bankOperationAt: string | Date;
  amountKopecks: number;
}) {
  return {
    title: 'Проверьте продажу',
    meta: `${moscowTimeFormatter.format(new Date(input.bankOperationAt))} · ${formatKopecks(input.amountKopecks)}`,
  };
}

const moscowDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function delayLabel(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value <= 0) return '';
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return [minutes ? `${minutes} мин` : '', seconds ? `${seconds} сек` : ''].filter(Boolean).join(' ');
}

export function terminalFiscalAdminReviewView(input: {
  status: string;
  bankOperationAt: string | Date;
  amountKopecks: number;
  match?: {
    status: string;
    reasonCode: string;
    oneCSourceRef: string | null;
    timeDifferenceSeconds: number | null;
  } | null;
}) {
  const operationMeta = `${moscowDateTimeFormatter.format(new Date(input.bankOperationAt))} · ${formatKopecks(input.amountKopecks)}`;
  if (input.status === 'resolved') {
    const check = input.match?.oneCSourceRef ? ` ${input.match.oneCSourceRef}` : '';
    const delay = input.match?.reasonCode === 'MATCH_CONFIRMED_LATE'
      ? delayLabel(input.match.timeDifferenceSeconds)
      : '';
    const message = input.match?.status === 'confirmed'
      ? `Чек${check} найден в 1С и подтверждён ОФД.${delay ? ` Он пробит через ${delay} после оплаты.` : ''}`
      : 'По итоговой сверке операция покрыта чеками 1С. Действий не требуется.';
    return {
      tone: 'resolved' as const,
      statusLabel: 'Проверка завершена',
      title: 'Оплата и чек сверены',
      operationMeta,
      message,
      discussionMessage: 'Проверка завершена. История сообщений сохранена.',
    };
  }
  if (input.status === 'admin_review') {
    return {
      tone: 'admin' as const,
      statusLabel: 'Требуется проверить ADMIN',
      title: 'Неоднозначная сверка',
      operationMeta,
      message: 'Автоматическая сверка не смогла однозначно связать оплату с чеком 1С. Сотруднику ничего делать не нужно.',
      discussionMessage: 'Это не закрытая ошибка. Случай оставлен для проверки ADMIN.',
    };
  }
  return {
    tone: 'open' as const,
    statusLabel: 'Требуется проверить',
    title: 'Проверьте продажу',
    operationMeta,
    message: `Чек ${moscowTimeFormatter.format(new Date(input.bankOperationAt))} — ${formatKopecks(input.amountKopecks)} в 1С не найден. Проверьте продажу.`,
    discussionMessage: '',
  };
}
