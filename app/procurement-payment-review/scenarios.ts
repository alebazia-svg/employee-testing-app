import type { ComponentProps } from 'react';
import type Calendar from '../(dashboard)/procurement/ProcurementPaymentCalendarClient';

/** Synthetic, local UI scenarios. Never submitted or mixed with production rows. */
export function buyerReviewScenario(name: string, today: string): ComponentProps<typeof Calendar> | null {
  if (!['lifecycle', 'plans-unavailable', 'payments-unavailable', 'order-evidence'].includes(name)) return null;
  const stamp = `${today}T10:00:00Z`;
  const evidence = {state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0,remainingAmount:100000,
    remainingForeignAmount:null,actualExchangeRate:null};
  const base = {planCode:'DEMO',supplierPartner:'Учебный поставщик',supplierCounterparty:'',orderRefs:['demo-order'],orderNumbers:['DEMO-001'],
    plannedDate:`${today}T00:00:00Z`,plannedAmount:'100000',condition:'Подготовить к обеду',paymentMethod:'CASH',currency:'RUB',
    foreignAmount:null,exchangeRate:null,commissionAmount:null,exchangerName:'',supplierConfirmation:'',status:'APPROVED',
    createdAt:stamp,updatedAt:stamp,evidence};
  return {initialOrders:[{ref:'demo-order',number:'DEMO-001',date:today,supplierPartner:base.supplierPartner,supplierCounterparty:'',
    amount:900000,receiptAmount:100000,paymentAmount:40000,orderPaymentGap:60000,supplierDebt:60000,currentState:'',controlGroup:'',controlReason:'',orderComment:'',planningState:'needs_review'}],
    initialPlans:['plans-unavailable', 'order-evidence'].includes(name) ? [] : [
      {...base,id:'demo-partial',evidence:{...evidence,state:'PARTIALLY_ISSUED',issuedAmount:40000,remainingAmount:60000},
        condition:'Нужна сверка перед оплатой. Сумма указана закупщиком, не подтверждена как долг заказа. Заказ DEMO-001: служебная проверка\nОснование закупщика: Подготовить к обеду'},
      {...base,id:'demo-submitted',supplierPartner:'Учебная заявка на согласовании',orderRefs:[],orderNumbers:[],status:'SUBMITTED'},
      {...base,id:'demo-correction',supplierPartner:'Учебная заявка на исправлении',orderRefs:[],orderNumbers:[],status:'NEEDS_CHANGES',correctionReason:'Уточните сумму у поставщика'},
      {...base,id:'demo-paid',supplierPartner:'Учебная оплаченная заявка',orderRefs:[],orderNumbers:[],evidence:{...evidence,state:'ISSUED_BY_ONE_C',issuedAmount:100000,remainingAmount:0}},
      {...base,id:'demo-cancelled',supplierPartner:'Учебная отменённая заявка',orderRefs:[],orderNumbers:[],status:'CANCELLED'},
    ], checkedAt:stamp,sourceError:'',plansSourceError:name === 'plans-unavailable',evidenceSourceError:name === 'payments-unavailable',
    managerMappingError:false,supplierBalances:{},supplierDebtTotal:null,supplierDebtError:true,
    accountableBalance:{balance:25000,checkedAt:stamp,sourceLabel:'Учебные данные',error:''},
    usdtBalance:{balance:1000,checkedAt:stamp,sourceLabel:'Учебные данные',error:''},otherUsdtReserve:0,todayKey:today,basisPreview:true};
}
