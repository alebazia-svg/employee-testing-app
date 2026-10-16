import React from 'react';
import type {SupplierBalance} from '@/lib/procurement-supplier-settlements';
import type {OrderReceiptSettlement} from '@/lib/procurement-planning-verification';
import {supplierPosition} from '@/lib/procurement-supplier-position';
import {isSupplierChoice} from '@/lib/procurement-supplier-advance';

type Order={ref:string;number:string;amount?:number;planningState?:string;receiptSettlement?:OrderReceiptSettlement;noAcquisitions?:{checkedAt:string}};
const rub=(value:number)=>value.toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
const hasConfirmedDebt=(order:Order)=>Boolean(order.receiptSettlement&&!order.receiptSettlement.requiresAdvanceReview&&order.planningState!=='needs_review'&&Number.isFinite(order.receiptSettlement.debtRub)&&order.receiptSettlement.debtRub>=0);
/** Supplier balance and order amounts have different scopes; never add them together. */
export function ProcurementPaymentDebtSummary({balance,unavailable=false,orders,onRemoveOrder,disabled=false}:{balance?:SupplierBalance;unavailable?:boolean;orders:Order[];onRemoveOrder?:(ref:string)=>void;disabled?:boolean}){
  const verified=!unavailable&&supplierPosition(balance)!=='review';
  const selected=orders.filter(o=>!isSupplierChoice(o.ref));
  return <div className="mt-3 border-t border-[var(--portal-border)] pt-3" aria-label="Долг и суммы по 1С">
    <dl className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-sm text-slate-600">Общий долг поставщику <span className="text-xs text-slate-500">· по 1С</span></dt>
      <dd className="text-base font-bold tabular-nums">{verified?rub(balance!.debt):'Данные недоступны'}</dd>
    </dl>
    {verified&&balance!.advance>0.009?<dl className="mt-1 flex flex-wrap justify-between gap-2 text-sm"><dt className="text-slate-600">Аванс поставщику</dt><dd className="font-semibold tabular-nums">{rub(balance!.advance)}</dd></dl>:null}
    {selected.length>1?<div className="mt-3">
      <div className={`grid items-center gap-x-3 text-xs text-slate-500 ${onRemoveOrder?'grid-cols-[minmax(0,1fr)_auto_2rem]':'grid-cols-[minmax(0,1fr)_auto]'}`}><span>Заказ</span><span>Сумма заказа</span>{onRemoveOrder?<span/>:null}</div>
      <ul className="divide-y divide-[var(--portal-border)]">
        {selected.map(order=><li key={order.ref} className="py-2 text-sm">
          <div className={`grid items-center gap-x-3 ${onRemoveOrder?'grid-cols-[minmax(0,1fr)_auto_2rem]':'grid-cols-[minmax(0,1fr)_auto]'}`}>
            <span className="min-w-0 break-words">№ {order.number}</span>
            <span className="font-semibold tabular-nums">{order.amount!=null&&Number.isFinite(order.amount)?rub(order.amount):'—'}</span>
            {onRemoveOrder?<button type="button" disabled={disabled} aria-label={'Убрать заказ '+order.number} onClick={()=>onRemoveOrder(order.ref)} className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-40">×</button>:null}
          </div>
          {hasConfirmedDebt(order)?<dl className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-600"><dt>Долг по приобретениям</dt><dd className="font-semibold tabular-nums">{rub(order.receiptSettlement!.debtRub)}</dd></dl>:order.noAcquisitions?<p className="mt-1 text-xs text-slate-600">Приобретений пока нет · предоплата</p>:null}
        </li>)}
      </ul>
    </div>:selected.map(order=>{
      const evidence=order.receiptSettlement;
      const confirmed=hasConfirmedDebt(order);
      return <div key={order.ref} className="mt-2 text-xs text-slate-600">
        <dl className="flex flex-wrap justify-between gap-2"><dt>Сумма заказа</dt><dd className="font-semibold tabular-nums">{order.amount!=null&&Number.isFinite(order.amount)?rub(order.amount):'—'}</dd></dl>
        {confirmed?<dl className="mt-1 flex flex-wrap justify-between gap-2"><dt>Долг по приобретениям</dt><dd className="font-semibold tabular-nums">{rub(evidence!.debtRub)}</dd></dl>:order.noAcquisitions?<p className="mt-1">Приобретений пока нет · предоплата</p>:null}
      </div>;
    })}
  </div>;
}
