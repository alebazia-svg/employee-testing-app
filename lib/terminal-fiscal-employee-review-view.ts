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
