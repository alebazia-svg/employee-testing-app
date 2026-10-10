/** Owner-approved carrier; identities verified read-only in 1C on 2026-10-10. */
export const PROCUREMENT_CARGO = {
  supplierPartner: 'Карго Юра',
  supplierCounterparty: 'Карго Юра',
  partnerRef: '5ca58254-4e19-11ed-8315-0025901e48ee',
  counterpartyRef: '5ca58256-4e19-11ed-8315-0025901e48ee',
  contractRef: 'b2b6f816-4edb-11ed-8315-0025901e48ee',
  contractName: 'Договор доставки Юра',
} as const;

export function isCargoPayment(plan:{paymentPurpose?:string}) { return plan.paymentPurpose==='DELIVERY'; }
export function cargoManagerAllowed(manager:string) {
  return manager.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g,' ')==='астемир тохов';
}

/** No arbitrary supplier names or synthetic orders can be submitted as delivery. */
export function cargoRequestError(input:{supplierPartner?:unknown;orderRefs?:unknown;orderNumbers?:unknown},manager:string) {
  if(!cargoManagerAllowed(manager))return 'Оплата перевозчику недоступна для этого сотрудника.';
  if(input.supplierPartner!==PROCUREMENT_CARGO.supplierPartner)return 'Выберите перевозчика из списка.';
  if(!Array.isArray(input.orderRefs)||input.orderRefs.length||!Array.isArray(input.orderNumbers)||input.orderNumbers.length)return 'Для доставки не выбирайте заказ.';
  return null;
}
