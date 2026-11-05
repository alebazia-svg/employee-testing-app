"use client";
import React from 'react';
import {requestEquivalent} from '@/components/ProcurementRequestEquivalent';
import {paymentListRemainder} from '@/lib/procurement-list-amount';
type Plan=Parameters<typeof requestEquivalent>[0];
const rub=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
export function ProcurementRequestMoney({plan}:{plan:Plan}){
 const equivalent=requestEquivalent(plan),remainder=paymentListRemainder(plan);
 const foreignPrimary=['USDT','CNY'].includes(plan.paymentMethod)&&(!!remainder||Number(plan.foreignAmount)>0);
 const primary=remainder?.replace(/^Доплатить /,'')||(foreignPrimary?`${Number(plan.foreignAmount).toLocaleString('ru-RU',{maximumFractionDigits:4})} ${plan.paymentMethod}`:`${rub.format(Number(plan.plannedAmount))} ₽`);
 const left=foreignPrimary?primary:equivalent&&equivalent.currency!=='RUB'?`≈ ${equivalent.amount.toLocaleString('ru-RU',{maximumFractionDigits:4})} ${equivalent.currency}`:({BANK:'Перевод на карту',CASH:'Наличные',ACCOUNTABLE_QR:'Оплата по QR',USDT:'USDT',CNY:'CNY'} as Record<string,string>)[plan.paymentMethod]||plan.paymentMethod;
 const right=foreignPrimary?(equivalent?.currency==='RUB'?`≈ ${rub.format(equivalent.amount)} ₽`:'—'):primary;
 return <div className="procurement-money-columns"><span className={foreignPrimary?'procurement-money-original':'procurement-money-method'}>{left}</span><span className={foreignPrimary?'procurement-money-equivalent':'procurement-money-original'}>{right}</span></div>;
}
