import { terminalPaymentCopy, terminalReceiptNumber } from './terminal-payment-copy';
import type { OneCCheck } from './terminal-fiscal-matching';

export const ACQUIRING_RECEIPT_NOT_FOUND = 'ACQUIRING_RECEIPT_NOT_FOUND';

export function acquiringReceiptDocumentNumber(check?: OneCCheck) {
  const number = check?.documentNumber ?? /Эквайринговая операция\s+([\p{L}\d-]+)/u.exec(check?.sourceRef ?? '')?.[1];
  return number && /^[\p{L}\d-]{1,40}$/u.test(number) ? number : null;
}

export function acquiringReceiptMetadata(notices: Array<{body:string;title?:string}>) {
  for (const notice of notices) {
    const number=/(?:Эквайринг|эквайринга|Эквайринговая операция) № ([\p{L}\d-]{1,40})(?:\.|\s|$)/u.exec(`${notice.title ?? ''}\n${notice.body}`)?.[1];
    if(number)return number;
  }
  return null;
}

export function acquiringReceiptCopy(input: Parameters<typeof terminalPaymentCopy>[0] & {documentNumber?:string|null}) {
  const payment = terminalPaymentCopy(input);
  const document = input.documentNumber ? `Эквайринг № ${input.documentNumber}.` : 'Эквайринг в 1С есть.';
  const problem = document;
  const at=new Date(input.operationAt), now=input.now??new Date();
  const day=(date:Date)=>date.toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
  const date=input.relative!==false&&day(at)===day(now)?'сегодня':at.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'});
  const method=input.method==='TERM_CARD'?'картой':input.method==='TERM_SBP'?'СБП':null;
  const number=terminalReceiptNumber(input.receiptNumber);
  const action=`Пробейте чек с эквайринга${input.documentNumber?` № ${input.documentNumber}`:''}.`;
  const body=[action,`${payment.amount} · ${[method,`${date}, ${payment.time}`].filter(Boolean).join(' · ')}`,number?`Чек терминала № ${number}.`:null].filter(Boolean).join('\n');
  return {...payment,title:'Нет чека по эквайрингу',problem,body};
}
