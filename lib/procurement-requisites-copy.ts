/** Shared copy for the manual request and its local review. */
export function requisitesRequestCopy(supplier:string,hasQr:boolean,author='Администратор',method='USDT'){
  const action=hasQr?'Уточните у поставщика актуальность QR-кода. Подтвердите его или прикрепите новый.':method==='CNY'?'Добавьте QR-код или ID получателя в Alipay.':method==='USDT'?'Добавьте QR-код или адрес кошелька.':'Добавьте реквизиты получателя.';
  return {title:hasQr?'Проверьте QR-код для оплаты':'Нужны реквизиты для оплаты',body:`Поставщик: ${supplier}\nЗапрос от: ${author}\n\n${action}`};
}
