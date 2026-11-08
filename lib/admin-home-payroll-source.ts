import { readPayrollOneCControlAggregate, getPayrollOneCSourceFingerprint, getPayrollOneCSupplierRulesFingerprint } from './payroll-one-c-control-aggregate';
import type { PayrollOneCControlSlice } from './payroll-one-c-control-snapshots';

type Row = PayrollOneCControlSlice['sales']['rows'][number];
export type HomePayrollAggregate = {
  ok:true;mode:'control';affectsPayroll:false;
  period:{periodKey:string;dateFrom:string;verifiedThrough:string};
  sales:{rows:Row[]};purchases:{ready:boolean;approvedBase:number};
  snapshot:{kind:'DAILY';storedAt:string};
};
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
function valid(value:unknown):value is HomePayrollAggregate {
 if(!record(value)||value.ok!==true||value.mode!=='control'||value.affectsPayroll!==false||!record(value.period)||!record(value.sales)||!record(value.purchases)||!record(value.snapshot))return false;
 const {period,sales,purchases,snapshot}=value;
 return typeof period.periodKey==='string'&&typeof period.dateFrom==='string'&&typeof period.verifiedThrough==='string'
  && Array.isArray(sales.rows)&&sales.rows.every(row=>record(row)&&['manager','client','category','item'].every(k=>typeof row[k]==='string')&&['revenue','cost','grossProfit'].every(k=>typeof row[k]==='number'&&Number.isFinite(row[k])))
  && typeof purchases.ready==='boolean'&&typeof purchases.approvedBase==='number'&&Number.isFinite(purchases.approvedBase)
  && snapshot.kind==='DAILY'&&typeof snapshot.storedAt==='string'&&Number.isFinite(Date.parse(snapshot.storedAt));
}
/** Read the same persisted aggregate as Payroll, without warming/writing its cache.
 * If raw slices exist, an out-of-date aggregate cannot override them. */
export function homePayrollAggregate(value:unknown,period:string,suppliers:Parameters<typeof getPayrollOneCSupplierRulesFingerprint>[0],slices:Parameters<typeof getPayrollOneCSourceFingerprint>[0],today:string) {
 const result=readPayrollOneCControlAggregate(value,{periodKey:period,sourceKind:'DAILY',supplierRulesFingerprint:getPayrollOneCSupplierRulesFingerprint(suppliers)},valid);
 if(!result)return null;
 const view=result.response;
 if(view.period.periodKey!==period||view.period.dateFrom!==`${period}-01`||!/^20\d{2}-\d{2}-\d{2}$/.test(view.period.verifiedThrough)||!Number.isFinite(Date.parse(view.period.verifiedThrough))||new Date(view.period.verifiedThrough).toISOString().slice(0,10)!==view.period.verifiedThrough||!view.period.verifiedThrough.startsWith(period+'-')||view.period.verifiedThrough>today)return null;
 if(slices.length&&result.sourceFingerprint!==getPayrollOneCSourceFingerprint(slices))return null;
 return view;
}
