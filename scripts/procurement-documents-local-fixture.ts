// Local acceptance only: refuses every database except the disposable test DB.
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {paymentEvidenceIdentity} from '../lib/procurement-evidence-continuity';
if(process.env.DATABASE_URL!=='postgresql://postgres@127.0.0.1:55467/payment_documents_test')throw Error('ISOLATED_DOCUMENTS_DATABASE_REQUIRED');
const db=new PrismaClient();
async function main(){
  const passwordHash=await bcrypt.hash('documents-local-only',10);
  const user=async(login:string,name:string,role:string)=>db.user.upsert({where:{login},update:{passwordHash},create:{login,name,role,passwordHash,portalArea:'PROCUREMENT'}});
  await user('documents-admin','Руководитель · локальная проверка','ADMIN');
  const buyer=await user('documents-buyer','Закупщик · локальная проверка','EMPLOYEE');
  for(const [id,method,amount,foreign] of [['documents-paid','USDT',468270,5445],['documents-qr','ACCOUNTABLE_QR',42200,null]] as const){
    const plan=await db.supplierPaymentPlan.upsert({where:{id},update:{},create:{id,planCode:`TEST-${id}`,managerUserId:buyer.id,supplierPartner:id==='documents-paid'?'Карго Юра · тест сохранения':'QR · тест сохранения',orderRefs:[],orderNumbers:[],plannedDate:new Date('2026-10-24'),plannedAmount:amount,condition:'Отдельная тестовая база. Рабочие заявки не меняются.',paymentMethod:method,foreignAmount:foreign,currency:foreign?'USDT':'RUB',exchangeRate:foreign?86:null,status:'APPROVED'}});
    const paid=id==='documents-paid';
    const evidence={state:paid?'ISSUED_BY_ONE_C':'NO_EVIDENCE',issuedAmount:paid?468300:0,paidAmount:0,paidForeignAmount:0,remainingAmount:paid?0:42200,remainingForeignAmount:null,actualExchangeRate:null,cashOrders:paid?[{ref:'local-rko',number:'00OF-001945',date:'24.10.2026 17:35:45',amount:468300,cashbox:'Тестовая касса'}]:[],currencyPayments:[],...(paid?{}:{qrFunding:{state:'confirmed',documentRef:'local-transfer',checkedAt:new Date().toISOString()}})};
    await db.supplierPaymentPlan.update({where:{id},data:{updatedAt:plan.updatedAt,oneCCashEvidence:{lastCompletePaymentView:{version:1,identity:paymentEvidenceIdentity(plan),readStartedAt:new Date().toISOString(),verifiedAt:new Date().toISOString(),evidence}}}});
  }
  for(const [method,label] of [['USDT','USDT'],['CNY','Alipay'],['BANK','Рубли'],['CASH','Наличные']] as const){
    const id=`documents-open-${method.toLowerCase()}`;
    const plan=await db.supplierPaymentPlan.upsert({where:{id},update:{},create:{id,planCode:`TEST-${method}`,managerUserId:buyer.id,supplierPartner:`Проверка документов · ${label}`,orderRefs:[],orderNumbers:[],plannedDate:new Date('2026-10-25'),plannedAmount:10000,condition:'Локальная проверка. Рабочие данные не меняются.',paymentMethod:method,foreignAmount:method==='USDT'?100:method==='CNY'?1000:null,currency:method==='USDT'?'USDT':method==='CNY'?'CNY':'RUB',exchangeRate:method==='USDT'?100:method==='CNY'?10:null,status:'APPROVED'}});
    const evidence={state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0,remainingAmount:10000,remainingForeignAmount:null,actualExchangeRate:null,cashOrders:[],currencyPayments:[]};
    await db.supplierPaymentPlan.update({where:{id},data:{updatedAt:plan.updatedAt,oneCCashEvidence:{lastCompletePaymentView:{version:1,identity:paymentEvidenceIdentity(plan),readStartedAt:new Date().toISOString(),verifiedAt:new Date().toISOString(),evidence}}}});
  }
  console.log('LOCAL_DOCUMENT_FIXTURES_READY');
}
main().finally(()=>db.$disconnect());
