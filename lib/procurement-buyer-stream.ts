import type {ComponentProps} from 'react';
import type Calendar from '@/app/(dashboard)/procurement/ProcurementPaymentCalendarClient';
type Props=ComponentProps<typeof Calendar>;
export type BuyerStreamPart='planning'|'balances'|'delivery'|'evidence';
export type BuyerStreamUpdate={generation:string;part:BuyerStreamPart;data:Partial<Props>|null};
export type BuyerStreamResult={generation:string;patch:Partial<Props>;done:Partial<Record<BuyerStreamPart,boolean>>};
export function mergeBuyerStream(old:BuyerStreamResult|null,value:BuyerStreamUpdate,current:string):BuyerStreamResult|null {
  if(value.generation!==current)return old;
  const same=old?.generation===current;
  return {generation:current,patch:{...(same?old.patch:{}),...value.data},done:{...(same?old.done:{}),[value.part]:true}};
}
export function timeoutBuyerStream(old:BuyerStreamResult|null,generation:string):BuyerStreamResult {
  const same=old?.generation===generation;
  return {generation,patch:{...(same?old.patch:{}),...(!same||!old.done.balances?{balancesRefreshing:false,balancesUnavailable:true}:{})},done:{planning:true,balances:true,delivery:true,evidence:true}};
}
