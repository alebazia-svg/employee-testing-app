import 'server-only';
import type {Prisma} from '@prisma/client';
import {getProcurementUsdtBalance} from './procurement-currency-balance';
import {expenseRequestMoscowCalendarDate} from './expense-request-source';
import {usdtReservedByPlans} from './procurement-usdt-reserve';
import {walletFundingAvailable} from './procurement-usdt-funding';
import type {freshEvidence} from './procurement-plan-revision-server';

type Request={paymentMethod:string;fundingSource?:string|null;foreignAmount:number|null};
export async function readFundingBalance(requests:Request[]) {
  if(!requests.some(p=>p.paymentMethod==='USDT'&&p.fundingSource==='WALLET'))return null;
  const result=await getProcurementUsdtBalance(expenseRequestMoscowCalendarDate(new Date()));
  if(result.error||result.balance==null)throw new Error('Не удалось подтвердить остаток кассы USDT. Выберите наличные для обмена или повторите позже.');
  return result.balance;
}
/** Called under the existing planning lock. Unknown legacy reservations fail closed. */
export async function assertFundingBalance(tx:Prisma.TransactionClient,requests:Request[],balance:number|null,evidence:Awaited<ReturnType<typeof freshEvidence>>,excludeId?:string) {
  const wallet=requests.filter(p=>p.paymentMethod==='USDT'&&p.fundingSource==='WALLET');
  if(!wallet.length)return;
  const plans=await tx.supplierPaymentPlan.findMany({where:{status:{in:['SUBMITTED','APPROVED','NEEDS_CHANGES']},...(excludeId?{id:{not:excludeId}}:{})}});
  const reserve=usdtReservedByPlans(plans.map(p=>({
    ...p,plannedAmount:Number(p.plannedAmount),foreignAmount:p.foreignAmount==null?null:Number(p.foreignAmount),
    evidence:evidence.versions?.get(p.id)===p.updatedAt.toISOString()?evidence.get(p.id):undefined,
  })),null);
  const amount=wallet.reduce((sum,p)=>sum+Number(p.foreignAmount||0),0);
  if(!walletFundingAvailable(amount,balance==null||reserve==null?null:balance-reserve))throw new Error('Недостаточно подтверждённого остатка кассы USDT с учётом других заявок. Выберите наличные для обмена.');
}
