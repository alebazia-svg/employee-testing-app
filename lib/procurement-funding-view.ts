import type {AdminForecastInput, AdminForecastSources} from './procurement-admin-forecast';
import type {FundingEvidence} from './procurement-funding-scenario';
import {isFinishedPaymentState} from './procurement-small-remainder';
import {OWNER_MONEY_ACCOUNTS} from './procurement-cash-forecast-source';
import {paymentPreparationDate} from './procurement-schedule';

export function retainDatedBankEvidence(next:AdminForecastSources, previous?:AdminForecastSources):AdminForecastSources {
  if(next.datedTbank?.status==='verified'||previous?.datedTbank?.status!=='verified')return next;
  return {...next,datedTbank:{...previous.datedTbank,current:false}};
}

function ownerSourcesComplete(source: AdminForecastSources) {
  const money=source.owner?.money;
  // Extra accounts outside the approved funding scope (e.g. expense safe) are
  // deliberately not spendable. Their presence does not invalidate individually
  // reconciled known accounts; all other source errors still block acceptance.
  return !!money && money.warnings.every(w=>w==='new_owner_account_needs_mapping') &&
    OWNER_MONEY_ACCOUNTS.every(({name})=>{
      const index=money.accountNames.indexOf(name),p=money.positions[index];
      return index>=0 && money.accountNames.lastIndexOf(name)===index && p?.verified && Number.isSafeInteger(p.balanceMinor);
    });
}

export function fundingSourcesComplete(input: AdminForecastInput, source: AdminForecastSources) {
  return source.asOf===input.todayKey && input.plansComplete && ownerSourcesComplete(source) &&
    source.payroll?.sourceComplete===true && !!source.manager &&
    input.plansWithOrderContext.every(p=>p.evidence.verification!=='last-confirmed');
}

/** Consume existing reconciled evidence only. Never match, close or mutate a plan. */
export function fundingEvidenceView(input: AdminForecastInput, source: AdminForecastSources): FundingEvidence {
  const manager=source.manager;
  const owner=source.owner?.money;
  return {
    asOf:source.asOf,capturedAt:source.checkedAt??'',observedAt:source.checkedAt??'',
    owner:owner?{...owner,positions:owner.positions.map(p=>({...p,verified:p.verified&&ownerSourcesComplete(source)}))}:{accountNames:[],positions:[]},
    payroll:source.payroll??{sourceComplete:false,warnings:['unavailable']},
    manager:manager??{checkedAt:'',cashboxes:[],unassignedCount:0,unassignedAmount:0,reviewCount:0},
    managerAvailable:!!manager,
    forecastPolicy:{excludedCount:manager?.excludedCount??0},
    balances:{usdt:input.usdtBalance,accountable:input.accountableBalance},
    rate:{rate:input.usdtRateReference?.rate??null,conversionAt:''},extraCash:manager?.extraCash??[],
    tbank:source.datedTbank??{status:'unavailable',statementDate:source.asOf,current:false,periodFrom:source.asOf,renewsOn:source.asOf,freeRemainingMinor:null,tierOneRemainingMinor:null,transferredMinor:null,freeLimitMinor:null},
    plans:input.plansWithOrderContext.filter(p=>['SUBMITTED','APPROVED'].includes(p.status)&&!isFinishedPaymentState(p.evidence.state)).map(p=>{
      const e=p.evidence, paid=e.issuedAmount+e.paidAmount;
      const known=p.plannedAmount.trim()!==''&&Number.isFinite(paid)&&paid>=0&&e.state!=='MISMATCH'&&!e.paymentAmountNeedsConfirmation&&e.verification!=='last-confirmed';
      const remaining=e.remainingAmount??(Number(p.plannedAmount)-paid);
      const partialForeign=['USDT','CNY'].includes(p.paymentMethod)&&paid>0;
      // RUB equivalent of a partially paid foreign transfer cannot be derived proportionally.
      const amount=known&&!partialForeign&&Number.isFinite(remaining)&&remaining>=0?remaining.toFixed(2):'';
      return {id:p.id,supplier:p.supplierPartner,status:p.status,paymentMethod:p.paymentMethod,plannedDate:paymentPreparationDate(p)||'',
        requestedRub:amount,foreignAmount:p.foreignAmount===null?null:Number(p.foreignAmount)};
    }),
  };
}
