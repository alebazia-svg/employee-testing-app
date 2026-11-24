import {qrMovementTime, type QrFunding} from '@/lib/procurement-qr-funding';

// Transfer destination confirmed by the owner for this specific 1C expense order.
const V12_CARD_TRANSFER_REF = '0067f446-e705-11f1-95c2-002590803daf';

const formatDate = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', timeZone: 'Europe/Moscow'});
const formatMoney = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0});

export function ProcurementQrTransferDetails({funding, plannedAmount, buyer = false}: {funding?: QrFunding; plannedAmount: number; buyer?: boolean}) {
  if (funding?.state !== 'confirmed' || !funding.amount) return null;
  const showCardTransfer = buyer && funding.documentRef === V12_CARD_TRANSFER_REF;
  const timestamp = qrMovementTime(funding.date);
  const difference = Math.round(Math.abs(plannedAmount - funding.amount) * 100) / 100;
  return <p className="text-sm text-slate-700">
    {showCardTransfer ? 'Переведено на карту' : 'Перемещение в 1С'}{Number.isFinite(timestamp) ? ` · ${formatDate.format(timestamp)}` : ''} · {formatMoney.format(funding.amount)}
    {!showCardTransfer && difference > 0 && <> · Разница с заявкой {formatMoney.format(difference)}</>}
  </p>;
}
