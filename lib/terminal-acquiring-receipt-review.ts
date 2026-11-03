import { terminalPaymentCopy } from './terminal-payment-copy';
import type { OneCCheck } from './terminal-fiscal-matching';

export const ACQUIRING_RECEIPT_NOT_FOUND = 'ACQUIRING_RECEIPT_NOT_FOUND';

export function acquiringReceiptDocumentNumber(check?: OneCCheck) {
  const number = check?.documentNumber ?? /Эквайринговая операция\s+([\p{L}\d-]+)/u.exec(check?.sourceRef ?? '')?.[1];
  return number && /^[\p{L}\d-]{1,40}$/u.test(number) ? number : null;
}

export function acquiringReceiptMetadata(notices: Array<{body:string}>) {
  return /(?:Эквайринг|Эквайринговая операция) № ([\p{L}\d-]{1,40})\./u.exec(notices.find(notice => /(?:Эквайринг|Эквайринговая операция) № /.test(notice.body))?.body ?? '')?.[1] ?? null;
}

export function acquiringReceiptCopy(input: Parameters<typeof terminalPaymentCopy>[0] & {documentNumber?:string|null}) {
  const payment = terminalPaymentCopy(input);
  const document = input.documentNumber ? `Эквайринг № ${input.documentNumber}.` : 'Эквайринг в 1С есть.';
  const problem = document;
  return {...payment,title:'Пробейте чек',problem,body:`${payment.payment}\n${problem}`};
}
