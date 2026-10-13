import {deliveryFundingForManagerCashboxes, type DeliveryFunding} from './procurement-delivery-funding';

// Owner-approved shared manager-accessible reserve. Confirmed by a read-only
// production cash-funding-context response on 2026-10-13. Never match by name.
export const DELIVERY_PHONE_RESERVE_REF = '7e102389-3ccb-11ed-8f49-0025901e48ee';

/** Only the top-up flow includes this manual source; general forecast unchanged.
 * Input must already be reconciled and restricted to live RUB cashboxes in the
 * fixed organization by deliveryFundingFromEvidence. Never synthesize balances.
 */
export function deliveryFundingForTopup(data: DeliveryFunding, managerRefs: readonly string[]): DeliveryFunding {
  const managers = deliveryFundingForManagerCashboxes(data, managerRefs);
  const reserve = data.cashboxes.find(box => box.ref === DELIVERY_PHONE_RESERVE_REF);
  return {...managers, cashboxes: [
    ...managers.cashboxes.filter(box => box.ref !== DELIVERY_PHONE_RESERVE_REF),
    ...(reserve ? [{...reserve, manualOnly: true, shift: {
      state: 'shared' as const, employee: '', checkedAt: data.checkedAt,
      version: `shared-reserve-v1:${DELIVERY_PHONE_RESERVE_REF}`,
    }}] : []),
  ]};
}
