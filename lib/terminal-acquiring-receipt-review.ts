import { terminalPaymentCopy } from './terminal-payment-copy';
import type { OneCCheck } from './terminal-fiscal-matching';

export const ACQUIRING_RECEIPT_NOT_FOUND = 'ACQUIRING_RECEIPT_NOT_FOUND';

export function acquiringReceiptDocumentNumber(check?: OneCCheck) {
  const number = check?.documentNumber ?? /Эквайринговая операция\s+([\p{L}\d-]+)/u.exec(check?.sourceRef ?? '')?.[1];
  return number && /^[\p{L}\d-]{1,40}$/u.test(number) ? number : null;
}

export function acquiringReceiptMetadata(notices: Array<{body:string}>) {
  return /Эквайринговая операция № ([\p{L}\d-]{1,40})\./u.exec(notices.find(notice => notice.body.includes('Эквайринговая операция № '))?.body ?? '')?.[1] ?? null;
}

export function acquiringReceiptCopy(input: Parameters<typeof terminalPaymentCopy>[0] & {documentNumber?:string|null}) {
  const payment = terminalPaymentCopy(input);
  const document = input.documentNumber ? `Эквайринговая операция № ${input.documentNumber}.` : 'Эквайринговая операция в 1С есть.';
  const problem = `${document} Кассовый чек по ней не найден. Проверьте, пробит ли он из этой операции.`;
  return {...payment,title:'Не найден кассовый чек по эквайрингу',problem,body:`${payment.payment}\n${problem}`};
}
