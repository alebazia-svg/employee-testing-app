import 'server-only';
import { buyerPaymentComment } from './procurement-buyer-comment';
import { isSupplierDebtPlan } from './procurement-debt-request';
import { fetchRequestOrderCatalogue } from './procurement-request-catalogue';
import { ordersForManager } from './procurement-payment-source';
import { ordersForRequest, reviewRequestCondition } from './procurement-order-selection';
import { fetchManagerSupplierNames } from './procurement-supplier-roster';
import { fetchSupplierSettlements, summarizeSupplierSettlements } from './procurement-supplier-settlements';
import { buyerOrderPurpose, supplierPosition } from './procurement-supplier-position';
import { planningSubmissionError } from './procurement-planning-submit';
import type { RevisionData } from './procurement-plan-revision';

/** Revalidate the new basis both on submission and on approval; never create a second plan. */
export async function validateBasisChangeTarget(before: { supplierPartner: string }, input: RevisionData, managerName: string): Promise<RevisionData> {
  if (input.supplierPartner !== before.supplierPartner) throw new Error('При смене основания оставьте того же поставщика.');
  const [settlements, supplierNames] = await Promise.all([fetchSupplierSettlements(), fetchManagerSupplierNames(managerName)]);
  if (!supplierNames.includes(input.supplierPartner)) throw new Error('Этот поставщик недоступен для вашей заявки.');
  const balances = settlements?.complete ? summarizeSupplierSettlements(settlements.rows, supplierNames) : null;
  if (!balances || balances.unsupportedCurrencyRows) throw new Error('Данные взаиморасчётов недоступны. Изменения не сохранены.');
  const balance = balances.bySupplier[input.supplierPartner];
  const data = { ...input, condition: buyerPaymentComment(input.condition) };
  if (isSupplierDebtPlan(data)) {
    if (supplierPosition(balance) !== 'debt') throw new Error('Подтверждённого долга поставщику нет. Оставьте оплату по заказу.');
    return { ...data, orderNumbers: [], supplierCounterparty: '' };
  }
  const source = await fetchRequestOrderCatalogue();
  if (!source.complete) throw new Error('Заказы 1С получены не полностью. Изменения не сохранены.');
  const allowed = ordersForRequest(ordersForManager(source.rows, managerName));
  const selected = data.orderRefs.map(ref => allowed.find(order => order.ref === ref && order.supplierPartner === data.supplierPartner));
  if (new Set(data.orderRefs).size !== data.orderRefs.length || selected.some(order => !order)) throw new Error('Выберите доступные заказы этого поставщика без повторов.');
  const orders = selected.filter(order => order !== undefined);
  if (orders.some(order => !['order', 'prepayment'].includes(buyerOrderPurpose(order, balance)))) throw new Error('Заказ не предлагается для новой оплаты. Обновите список.');
  let verifiedOrders = orders;
  const error = await planningSubmissionError(orders, [{ refs: data.orderRefs, amount: data.plannedAmount!, condition: data.condition }], verified => {
    verifiedOrders = verified;
    data.condition = reviewRequestCondition(verified, data.condition);
  });
  if (error) throw new Error(error);
  if (verifiedOrders.some(order => !['order', 'prepayment'].includes(buyerOrderPurpose(order, balance)))) throw new Error('Заказ больше не предлагается для оплаты. Обновите список.');
  return { ...data, orderNumbers: orders.map(order => order.number), supplierCounterparty: orders[0]?.supplierCounterparty || '' };
}
