import 'server-only';
import {prisma} from './prisma';
import {getCashFundingContext} from './one-c';
import {DELIVERY_PERSON} from './procurement-delivery-policy';
import {deliveryFundingForManagerCashboxes} from './procurement-delivery-funding';
import {forecastFundingWithExclusions} from './procurement-funding-exclusions';
import {FUNDING_POLICY_EFFECTIVE_FROM, LEGACY_FUNDING_EXCLUSIONS} from './procurement-funding-owner-policy';

/** Read-only forecast projection; delivery approval/reservation rules are untouched. */
export async function loadForecastManagerCash(asOf: string) {
  const [raw, mappings] = await Promise.all([
    getCashFundingContext(DELIVERY_PERSON.organizationRef),
    prisma.userOneCCashboxMapping.findMany({
      where: {isActive:true,user:{isActive:true,role:'EMPLOYEE',portalArea:'WORKDAY',department:{in:['retail','wholesale']}}},
      select:{oneCCashboxRef:true},
    }),
  ]);
  if(!mappings.length)throw Error('FUNDING_MANAGER_MAPPING_UNAVAILABLE');
  const evidence = forecastFundingWithExclusions(raw, asOf >= FUNDING_POLICY_EFFECTIVE_FROM ? LEGACY_FUNDING_EXCLUSIONS : []);
  const filtered = deliveryFundingForManagerCashboxes(evidence, mappings.map(m=>m.oneCCashboxRef));
  const managerRefs=new Set(filtered.cashboxes.map(b=>b.ref));
  const otherPending=evidence.cashboxes.filter(b=>!managerRefs.has(b.ref)&&(b.pending===null||b.pending>0));
  // Do not send unrelated recipient/request details to the forecast client.
  return {checkedAt:filtered.checkedAt,cashboxes:filtered.cashboxes,
    extraCash:evidence.cashboxes.filter(b=>b.name.trim()==='Сейф Расходный').map(b=>({name:b.name,balance:b.balance})),
    unassignedCount:filtered.unassignedCount,unassignedAmount:filtered.unassignedAmount,reviewCount:filtered.reviewCount+otherPending.length,
    excludedCount:evidence.excludedCount};
}
