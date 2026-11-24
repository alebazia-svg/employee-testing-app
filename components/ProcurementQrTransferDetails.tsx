import {qrMovementTime, type QrFunding} from '@/lib/procurement-qr-funding';

const formatDate = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', timeZone: 'Europe/Moscow'});
const formatMoney = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0});

export function ProcurementQrTransferDetails({funding, plannedAmount}: {funding?: QrFunding; plannedAmount: number}) {
  if (funding?.state !== 'confirmed' || !funding.amount) return null;
  const timestamp = qrMovementTime(funding.date);
  const difference = Math.round(Math.abs(plannedAmount - funding.amount) * 100) / 100;
  return <p className="text-sm text-slate-700">
    Перемещение в 1С{Number.isFinite(timestamp) ? ` · ${formatDate.format(timestamp)}` : ''} · {formatMoney.format(funding.amount)}
    {difference > 0 && <> · Разница с заявкой {formatMoney.format(difference)}</>}
  </p>;
}
