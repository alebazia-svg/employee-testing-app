import type {SupplierCurrencyPaymentRow} from './procurement-currency-payment-source';
import {parseOneCDateTime} from './one-c-date';

/** Whole RKO evidence: one advance order, or an exact RUB acquisition allocation.
 * The matcher requires a unique plan covering every allocated order. */
export function attachSettlementOrderLinks(payments:SupplierCurrencyPaymentRow[],details:Record<string,any>[],now=new Date()) {
  const candidates=new Map<string,Set<string>>();
  const normalize=(s:string)=>s.trim().toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ');
  const currency=(s:string)=>['руб','rub','₽'].includes(normalize(s))?'rub':normalize(s);
  for(const d of details){
    const at=parseOneCDateTime(d.as_of),o=d.order?.[0];
    if(d.ok!==true||d.complete!==true||d.truncated===true||d.write_operations!==false||d.contract_version!=='supplier-document-evidence-v1'||!at||Math.abs(now.getTime()-at.getTime())>15*60000||d.order?.length!==1||typeof o.posted!=='boolean'||typeof o.deleted!=='boolean'||!Array.isArray(d.due_date_movements)||d.due_date_movements.length>=1000)throw Error('SETTLEMENT_LINK_SOURCE_INCOMPLETE');
    // An explicitly inactive order is valid source data, not a failed read.
    // Leave it unlinked without preventing reconciliation of other requests.
    if(!o.posted||o.deleted)continue;
    for(const p of payments){
      if(p.baseDocumentRef||!p.posted||p.deleted||!['РУБ','RUB','USDT'].includes(p.documentCurrency)||!Number.isFinite(p.documentAmount)||p.documentAmount<=0||!p.supplier||normalize(p.supplier)!==normalize(o.supplier_name||''))continue;
      const paidAt=parseOneCDateTime(p.date);
      const rows=d.due_date_movements.filter((r:any)=>r.source_recorder_ref===p.ref&&r.settlement_object_ref===o.order_ref);
      if(rows.length!==1||!paidAt||paidAt>now)continue;
      const r=rows[0];
      if(r.settlement_document_ref!==p.ref||r.movement_type!=='Приход'||r.raw_debt!==0||typeof r.raw_prepayment!=='number'||!Number.isFinite(r.raw_prepayment)||r.raw_prepayment<=0||parseOneCDateTime(r.movement_date)?.getTime()!==paidAt.getTime())continue;
      // Foreign document money and settlement money are different units. The
      // independent per-RKO register total must prove the WHOLE allocation;
      // never multiply USDT by a guessed/accounting exchange rate.
      const foreign=p.documentCurrency==='USDT';
      const expected=foreign?p.settlementAmount:p.documentAmount;
      if(foreign && (p.settlementMovementsCount!==1 || !p.settlementCurrency))continue;
      if(typeof expected!=='number'||!Number.isFinite(expected)||expected<=0||currency(r.currency_name||'')!==currency(foreign?p.settlementCurrency!:'rub')||Math.round(r.raw_prepayment*100)!==Math.round(expected*100))continue;
      candidates.set(p.ref,new Set([...(candidates.get(p.ref)||[]),o.order_ref]));
    }
  }
  return payments.map(p=>{
    const refs=candidates.get(p.ref);
    const linked={...p,settlementOrderRef:refs?.size===1?[...refs][0]:undefined,settlementOrderRefs:undefined as string[]|undefined};
    // Payment of acquisitions is a debt reduction, not an advance movement.
    // Preserve one whole RKO: only a complete RUB allocation may prove its orders.
    if(p.baseDocumentRef||!p.posted||p.deleted||!['РУБ','RUB'].includes(p.documentCurrency)||!Number.isFinite(p.documentAmount)||p.documentAmount<=0||!p.supplier)return linked;
    const paidAt=parseOneCDateTime(p.date);
    if(!paidAt||paidAt>now)return linked;
    const seen=new Set<string>(),orderRefs=new Set<string>();let total=0,invalid=false;
    for(const d of details){
      const o=d.order[0];
      const rows=d.due_date_movements.filter((r:any)=>r.source_recorder_ref===p.ref);
      for(const r of rows){
        const identity=JSON.stringify([r.recorder_ref,r.line_number]);
        if(!o.posted||o.deleted||normalize(p.supplier)!==normalize(o.supplier_name||'')||
          !r.recorder_ref||!Number.isInteger(r.line_number)||r.line_number<=0||seen.has(identity)||
          r.settlement_object_ref!==o.order_ref||r.movement_type!=='Расход'||r.raw_prepayment!==0||
          typeof r.raw_debt!=='number'||!Number.isFinite(r.raw_debt)||r.raw_debt<=0||currency(r.currency_name||'')!=='rub'||
          parseOneCDateTime(r.movement_date)?.getTime()!==paidAt.getTime()||
          !Array.isArray(d.receipts)||d.receipts.filter((receipt:any)=>receipt.receipt_ref===r.settlement_document_ref&&receipt.posted===true).length!==1){invalid=true;continue;}
        seen.add(identity);orderRefs.add(o.order_ref);total+=Math.round(r.raw_debt*100);
      }
    }
    if(!invalid&&orderRefs.size&&total===Math.round(p.documentAmount*100))linked.settlementOrderRefs=[...orderRefs].sort();
    return linked;
  });
}
