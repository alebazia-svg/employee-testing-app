import type {SupplierCurrencyPaymentRow} from './procurement-currency-payment-source';
import {parseOneCDateTime} from './one-c-date';

/** Conservative fallback: one whole RUB RKO, one order, exact original movement.
 * Split/mixed/repeated allocations remain unlinked; never infer by similar money/date. */
export function attachSettlementOrderLinks(payments:SupplierCurrencyPaymentRow[],details:Record<string,any>[],now=new Date()) {
  const candidates=new Map<string,Set<string>>();
  const normalize=(s:string)=>s.trim().toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ');
  for(const d of details){
    const at=parseOneCDateTime(d.as_of),o=d.order?.[0];
    if(d.ok!==true||d.complete!==true||d.truncated===true||d.write_operations!==false||d.contract_version!=='supplier-document-evidence-v1'||!at||Math.abs(now.getTime()-at.getTime())>15*60000||d.order?.length!==1||typeof o.posted!=='boolean'||typeof o.deleted!=='boolean'||!Array.isArray(d.due_date_movements)||d.due_date_movements.length>=1000)throw Error('SETTLEMENT_LINK_SOURCE_INCOMPLETE');
    // An explicitly inactive order is valid source data, not a failed read.
    // Leave it unlinked without preventing reconciliation of other requests.
    if(!o.posted||o.deleted)continue;
    for(const p of payments){
      if(p.baseDocumentRef||!p.posted||p.deleted||!['РУБ','RUB'].includes(p.documentCurrency)||!p.supplier||normalize(p.supplier)!==normalize(o.supplier_name||''))continue;
      const paidAt=parseOneCDateTime(p.date);
      const rows=d.due_date_movements.filter((r:any)=>r.source_recorder_ref===p.ref&&r.settlement_object_ref===o.order_ref);
      if(rows.length!==1||!paidAt||paidAt>now)continue;
      const r=rows[0];
      if(r.settlement_document_ref!==p.ref||r.movement_type!=='Приход'||r.raw_debt!==0||typeof r.raw_prepayment!=='number'||!Number.isFinite(r.raw_prepayment)||r.raw_prepayment<=0||!['руб','rub','₽'].includes(normalize(r.currency_name||''))||parseOneCDateTime(r.movement_date)?.getTime()!==paidAt.getTime())continue;
      if(Math.round(r.raw_prepayment*100)!==Math.round(p.documentAmount*100))continue;
      candidates.set(p.ref,new Set([...(candidates.get(p.ref)||[]),o.order_ref]));
    }
  }
  return payments.map(p=>{const refs=candidates.get(p.ref);return refs?.size===1?{...p,settlementOrderRef:[...refs][0]}:{...p};});
}
