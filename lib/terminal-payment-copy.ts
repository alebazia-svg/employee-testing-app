/** Only the printed terminal check number is shown; never substitute RRN or an internal ID. */
export function terminalReceiptNumber(value: unknown): string | null {
  return typeof value === 'string' && /^\d{1,12}$/.test(value) ? value : null;
}
export function terminalPaymentMetadata(notices: Array<{body:string}> = []) {
  const body = notices.find(n => /Чек терминала № \d+/.test(n.body))?.body ?? notices[0]?.body ?? '';
  return { receiptNumber: terminalReceiptNumber(/Чек терминала № (\d+)/.exec(body)?.[1]),
    method: /картой/.test(body) ? 'TERM_CARD' : /СБП/.test(body) ? 'TERM_SBP' : undefined };
}
export function terminalPaymentCopy(input: { amountKopecks:number; operationAt:Date|string; receiptNumber?:string|null; method?:string; now?:Date; relative?:boolean; shared?:boolean }) {
  const at = new Date(input.operationAt), now = input.now ?? new Date();
  const day = (date:Date) => date.toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
  const date = input.relative !== false && day(at) === day(now) ? 'Сегодня' : at.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'});
  const time = at.toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
  const amount = `${(input.amountKopecks/100).toLocaleString('ru-RU')} ₽`;
  const method = input.method === 'TERM_CARD' ? 'картой ' : input.method === 'TERM_SBP' ? 'через СБП ' : '';
  const number = terminalReceiptNumber(input.receiptNumber);
  const payment = `${date} в ${time} ${input.shared ? 'на терминале вашей смены' : 'на вашем терминале'} оплатили ${method}${amount}.${number ? ` Чек терминала № ${number}.` : ''}`;
  return {title:'В 1С не найден чек продажи',payment,problem:'Кассовый чек по этой оплате в 1С не найден.',body:`${payment}\nКассовый чек по этой оплате в 1С не найден.`,amount,time};
}
export const TERMINAL_FISCAL_HELP_TYPE = 'terminal_fiscal_review.help_requested';
export function terminalFiscalHelpCopy(input: {name:string;amountKopecks:number;operationAt:Date;receiptNumber?:string|null}) {
  const date=input.operationAt.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'});
  const time=input.operationAt.toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});
  const amount=`${(input.amountKopecks/100).toLocaleString('ru-RU')} ₽`;
  const number=terminalReceiptNumber(input.receiptNumber);
  return {title:`${input.name} просит помочь · ${amount}`,body:`Оплата на терминале ${date} в ${time}.${number?` Чек терминала № ${number}.`:''} Нужна помощь с чеком в 1С.`};
}
