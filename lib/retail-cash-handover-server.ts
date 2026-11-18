import 'server-only';
import { WORKDAY_END_REMINDER_KIND,WORKDAY_END_REMINDER_OFFSETS,workdayEndReminderKey } from './workday-end-policy';
import { randomUUID,createHmac,timingSafeEqual } from 'node:crypto';
import { Prisma, type PrismaClient, type RetailCashHandover } from '@prisma/client';
import { getMoscowDateKey, getMoscowMinutes, usesRetailCashHandover } from './workday';
import { getCashStatementSummary, getCashStatementDimensions } from './one-c';
import { postRetailHandoverPair } from './retail-cash-handover-one-c';
import { handoverMoney, selectCashHandoverRecipient } from './retail-cash-handover-policy';

type Db=PrismaClient;
const terminal=['posted','zero'];
export class HandoverError extends Error { constructor(message:string,readonly status=409){super(message);} }
export function serializeRetailHandover(h:RetailCashHandover|null) {
  if(!h)return null;
  return {reviewReason:h.status==='review'&&Object.values(reviewReasons).includes(h.error??'')?h.error:null,id:h.id,revision:h.revision,status:h.status,actual:Number(h.actual),countedAt:h.countedAt.toISOString(),recipientName:h.recipientName,recipientUserId:h.recipientUserId,preparedUntil:h.preparedUntil?.toISOString()??null,handedAt:h.handedAt?.toISOString()??null,expenseNumber:h.expenseNumber,receiptNumber:h.receiptNumber};
}
function recipientAllowed(ref:string|undefined){
  return Boolean(ref && (process.env.RETAIL_CASH_RECIPIENT_REFS??'').split(',').includes(ref));
}
async function lock(tx:Prisma.TransactionClient,dayId:number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73118118, ${dayId}::integer)`;
  await tx.$queryRaw`SELECT id FROM "WorkDayEntry" WHERE id=${dayId} FOR UPDATE`;
}
async function dayFor(tx:Prisma.TransactionClient,userId:number,dayId:number,now:Date,allowClosed=false){
  const d=await tx.workDayEntry.findFirst({where:{id:dayId,userId},include:{user:true,shiftControlRun:{include:{tasks:true}}}});
  if(!d||!usesRetailCashHandover(d.user)||!d.user.isActive||d.user.role!=='EMPLOYEE')throw new HandoverError('Режим сдачи кассы недоступен.',403);
  if(!allowClosed&&(d.date!==getMoscowDateKey(now)||d.endedAt||d.status!=='active'))throw new HandoverError('Нет активного сегодняшнего рабочего дня.');
  const task=d.shiftControlRun?.tasks.find(t=>t.category==='handover');
  if(!task)throw new HandoverError('Проверка сдачи смены не настроена.');
  return {day:d,task};
}
async function issue(tx:Prisma.TransactionClient,d:{userId:number;date:string},taskId:number,h:RetailCashHandover,rule:string,detail:string,severity='warning'){
  await tx.workdayControlIssue.upsert({where:{fingerprint:`retail-handover:${h.id}:${rule}`},create:{userId:d.userId,taskId,fingerprint:`retail-handover:${h.id}:${rule}`,ruleKey:rule,title:rule==='cash_handover_mismatch'?'Расхождение наличных в кассе':'Передача кассы: требуется проверка',detail,severity,status:'open',employeeActionRequired:false,sourceData:{date:d.date,handoverId:h.id,actual:Number(h.actual),expected:h.expected===null?null:Number(h.expected)}},update:{detail,severity,status:'open',resolvedAt:null}});
}
export async function recountRetailCash(db:Db,userId:number,dayId:number,p:{amount:unknown;requestKey:string;revision:number|null;offerToken?:string},now=new Date()){
  const amount=handoverMoney(p.amount);
  const offer=p.offerToken?readOffer(p.offerToken,userId,dayId):null;
  if(offer && amount<=0)throw new HandoverError('Укажите сумму передачи.');
  if(!/^[\w-]{16,80}$/.test(p.requestKey))throw new HandoverError('Не найден идентификатор пересчёта.',400);
  const prior=await db.retailCashHandover.findUnique({where:{workDayEntryId:dayId}});
  if(prior?.countRequestKey===p.requestKey){if(Number(prior.actual)!==amount)throw new HandoverError('Параметры повторного запроса изменились.');const d=await db.workDayEntry.findUnique({where:{id:dayId}});if(d?.userId!==userId)throw new HandoverError('Нет доступа.',403);return prior;}
  const {day}=await dayFor(db as unknown as Prisma.TransactionClient,userId,dayId,now,true);
  const mapping=await db.userOneCCashboxMapping.findUnique({where:{userId}});
  const organizationRef=process.env.RETAIL_CASH_ORGANIZATION_REF??'';
  if(!mapping?.isActive||!organizationRef)throw new HandoverError('Не настроена личная касса или организация 1С.');
  const sourceRef=offer?.source??mapping.oneCCashboxRef;
  let expected:number|null=null,error='';
  try{const r=await getCashStatementSummary({date:day.date,organizationRef,cashboxRef:sourceRef});if(r.ok&&r.closingBalance!==null)expected=r.closingBalance;else error='Остаток 1С недоступен в момент пересчёта.';}catch{error='Остаток 1С недоступен в момент пересчёта.';}
  const snapshot={actual:amount,expected,capturedAt:now.toISOString(),sourceRef,organizationRef,error};
  return db.$transaction(async tx=>{
    await lock(tx,dayId);const {day:d,task}=await dayFor(tx,userId,dayId,now,true);
    const old=await tx.retailCashHandover.findUnique({where:{workDayEntryId:dayId}});
    if(old?.countRequestKey===p.requestKey){if(Number(old.actual)!==amount)throw new HandoverError('Параметры повторного запроса изменились.');return old;}
    if(d.endedAt||d.status!=='active'||d.date!==getMoscowDateKey(now))throw new HandoverError('День уже завершён.');
    if(old?.handedAt||old&&old.status==='posted')throw new HandoverError('Передача уже зафиксирована. Пересчёт изменить нельзя.');
    if((old?.revision??null)!==p.revision)throw new HandoverError('Пересчёт изменён в другом окне. Обновите экран.');
    const history=[...(Array.isArray(old?.countHistory)?old.countHistory:[]),snapshot];
    const data={countRequestKey:p.requestKey,actual:amount,expected,snapshot,countHistory:history,countedAt:now,status:amount===0?'zero':'counted',organizationRef,sourceCashboxRef:sourceRef,recipientUserId:null,recipientWorkDayId:null,recipientName:null,targetCashboxRef:null,preparedUntil:null,error};
    const h=old?await tx.retailCashHandover.update({where:{id:old.id},data:{...data,revision:{increment:1}}}):await tx.retailCashHandover.create({data:{...data,workDayEntryId:dayId}});
    await tx.shiftControlTask.update({where:{id:task.id},data:{numericValue:amount,status:amount===0?'done':'pending',completedAt:amount===0?now:null,handoverData:{retailCashHandoverId:h.id,draft:amount!==0}}});
    // Retain historical discrepancies. A transfer or next day's count never
    // rewrites an earlier confirmed count into a matching zero.
    if(expected!==null&&Math.abs(amount-expected)>.001)await issue(tx,d,task.id,h,'cash_handover_mismatch',`${amount<expected?'Недостача':'Излишек'} ${Math.abs(amount-expected)} ₽. Факт ${amount} ₽, остаток 1С ${expected} ₽. Пересчёт ${now.toISOString()}.`, 'error');
    if(amount===0)await tx.shiftControlRun.update({where:{id:task.runId},data:{status:'completed',completedAt:now}});
    if(offer){
      const ready=await tx.retailCashHandover.update({where:{id:h.id},data:{status:'ready',recipientUserId:offer.recipient,recipientWorkDayId:offer.receiverDay,recipientName:offer.name,targetCashboxRef:offer.target,preparedUntil:new Date(offer.until)}});
      return recordPhysicalTransfer(tx,ready,d,task,now);
    }
    return h;
  });
}
async function selectRecipient(db:Pick<Db,'workDayEntry'>,userId:number,sourceRef:string,now:Date){
    const rows=await db.workDayEntry.findMany({where:{department:'retail',date:getMoscowDateKey(now)},include:{user:{include:{oneCCashboxMapping:true}},shiftControlRun:{include:{tasks:{select:{category:true,status:true,handoverData:true}}}}}});
    const c=selectCashHandoverRecipient(rows.filter(row=>recipientAllowed(row.user.oneCCashboxMapping?.oneCCashboxRef)),{senderId:userId,sourceRef,date:getMoscowDateKey(now),minutes:getMoscowMinutes(now),now});
    if(!c)throw new HandoverError('Нет подходящего менеджера на смене. Обратитесь к администратору.');
    return c;
}
type Offer={dayId:number;userId:number;source:string;target:string;recipient:number;receiverDay:number;name:string;until:number};
function signature(data:string){
 const key=process.env.PORTAL_SESSION_SECRET;if(!key)throw Error('Missing signing key');
 return createHmac('sha256',key).update('handover-offer:'+data).digest('base64url');
}
export async function recipientOffer(db:Db,userId:number,dayId:number,now=new Date()){
 await dayFor(db as unknown as Prisma.TransactionClient,userId,dayId,now);
 const source=await db.userOneCCashboxMapping.findUnique({where:{userId}});
 if(!source?.isActive)throw new HandoverError('Личная касса не настроена.');
 const c=await selectRecipient(db,userId,source.oneCCashboxRef,now);
 const target=c.user.oneCCashboxMapping!.oneCCashboxRef;
 const dims=await getCashStatementDimensions();
 if(!dims.ok||!dims.organizations.some(x=>x.ref===process.env.RETAIL_CASH_ORGANIZATION_REF)||![source.oneCCashboxRef,target].every(ref=>dims.cashboxes.some(x=>x.ref===ref)))throw new HandoverError('Кассы 1С недоступны.');
 const offer:Offer={dayId,userId,source:source.oneCCashboxRef,target,recipient:c.userId,receiverDay:c.id,name:c.user.name,until:+now+300000};
 const data=Buffer.from(JSON.stringify(offer)).toString('base64url');
 return {name:offer.name,token:data+'.'+signature(data)};
}
function readOffer(token:string,userId:number,dayId:number):Offer{
 const [data,mac]=token.split('.');const expected=signature(data);
 if(!mac||Buffer.byteLength(mac)!==expected.length||!timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))throw new HandoverError('Обновите данные получателя.');
 const offer:Offer=JSON.parse(Buffer.from(data,'base64url').toString());
 if(offer.dayId!==dayId||offer.userId!==userId)throw new HandoverError('Получатель относится к другой смене.');
 return offer;
}
export async function prepareRetailCash(db:Db,userId:number,dayId:number,revision:number,now=new Date()){
  const dims=await getCashStatementDimensions();
  return db.$transaction(async tx=>{
    await lock(tx,dayId);await dayFor(tx,userId,dayId,now);
    const h=await tx.retailCashHandover.findUnique({where:{workDayEntryId:dayId}});
    if(!h||h.revision!==revision)throw new HandoverError('Обновите сохранённый пересчёт.');
    if(h.handedAt||terminal.includes(h.status))return h;
    const source=await tx.userOneCCashboxMapping.findUnique({where:{userId}});
    if(!source?.isActive||source.oneCCashboxRef!==h.sourceCashboxRef)throw new HandoverError('Привязка вашей кассы изменилась. Обратитесь к администратору.');
    if(!dims.ok||!dims.organizations.some(o=>o.ref===h.organizationRef)||!dims.cashboxes.some(c=>c.ref===h.sourceCashboxRef))throw new HandoverError('Не удалось проверить кассы 1С. Попробуйте позже.');
    const c=await selectRecipient(tx,userId,h.sourceCashboxRef,now);
    if(!dims.cashboxes.some(x=>x.ref===c.user.oneCCashboxMapping!.oneCCashboxRef))throw new HandoverError('Касса получателя недоступна.');
    return tx.retailCashHandover.update({where:{id:h.id},data:{status:'ready',revision:{increment:1},recipientUserId:c.userId,recipientWorkDayId:c.id,recipientName:c.user.name,targetCashboxRef:c.user.oneCCashboxMapping!.oneCCashboxRef,preparedUntil:new Date(+now+5*60000)}});
  });
}
export async function confirmRetailCash(db:Db,userId:number,dayId:number,revision:number,handed:boolean,now=new Date()){
  if(handed!==true)throw new HandoverError('Подтвердите фактическую передачу наличных.',400);
  return db.$transaction(async tx=>{
    await lock(tx,dayId);const {day,task}=await dayFor(tx,userId,dayId,now,true);
    const h=await tx.retailCashHandover.findUnique({where:{workDayEntryId:dayId}});
    if(!h)throw new HandoverError('Сначала сохраните пересчёт.');
    if(h.handedAt)return h;
    if(day.endedAt||day.status!=='active'||day.date!==getMoscowDateKey(now))throw new HandoverError('День уже завершён.');
    if(h.revision!==revision||h.status!=='ready'||!h.recipientWorkDayId||!h.targetCashboxRef)throw new HandoverError('Проверьте сохранённого получателя перед передачей.');
    return recordPhysicalTransfer(tx,h,day,task,now);
  });
}
const reviewReasons={
 source:'Привязка вашей кассы изменилась. Администратор проверит передачу.',
 target:'Привязка кассы получателя изменилась. Администратор проверит передачу.',
 shift:'Смена получателя больше не подходит для приёма наличных. Администратор проверит передачу.',
};
async function recordPhysicalTransfer(tx:Prisma.TransactionClient,h:RetailCashHandover,day:{id:number;date:string;userId:number},task:{id:number},now:Date){
    const userId=day.userId;
    if(!h.recipientWorkDayId)throw new HandoverError('Нет получателя.');
    await tx.$queryRaw`SELECT id FROM "WorkDayEntry" WHERE id=${h.recipientWorkDayId} FOR UPDATE`;
    const target=await tx.workDayEntry.findUnique({where:{id:h.recipientWorkDayId},include:{user:{include:{oneCCashboxMapping:true}},shiftControlRun:{include:{tasks:{select:{category:true,status:true,handoverData:true}}}}}});
    const source=await tx.userOneCCashboxMapping.findUnique({where:{userId}});
    const reason=!source?.isActive||source.oneCCashboxRef!==h.sourceCashboxRef ? reviewReasons.source
      : !target?.user.oneCCashboxMapping?.isActive || target.user.oneCCashboxMapping.oneCCashboxRef!==h.targetCashboxRef || !recipientAllowed(h.targetCashboxRef??undefined) ? reviewReasons.target
      : !selectCashHandoverRecipient([target],{senderId:userId,sourceRef:h.sourceCashboxRef,date:day.date,minutes:getMoscowMinutes(now),now}) ? reviewReasons.shift : '';
    const next=await tx.retailCashHandover.update({where:{id:h.id},data:{status:reason?'review':'confirmed',handedAt:now,revision:{increment:1},error:reason}});
    await tx.shiftControlTask.update({where:{id:task.id},data:{status:'done',completedAt:now,handoverData:{retailCashHandoverId:h.id,draft:false}}});
    await tx.shiftControlRun.updateMany({where:{workDayEntryId:day.id},data:{status:'completed',completedAt:now}});
    await tx.workDayEntry.update({where:{id:day.id},data:{status:'completed',endedAt:now}});
    await tx.workdayNotification.updateMany({where:{userId,kind:WORKDAY_END_REMINDER_KIND,fingerprint:{in:WORKDAY_END_REMINDER_OFFSETS.map((_,i)=>workdayEndReminderKey(day.id,i))},status:{in:['pending','sent']}},data:{status:'resolved',pushStatus:'cancelled',nextPushAttemptAt:null}});
    if(reason)await issue(tx,day,task.id,next,'cash_handover_review',reason,'error');
    return next;
}
export async function processRetailCash(db:Db,userId:number,dayId:number,now=new Date(),postPair=postRetailHandoverPair, attempt: 'initial' | 'admin' = 'admin'){
  const token=randomUUID();
  const claimed=await db.$transaction(async tx=>{
    await lock(tx,dayId);
    // Once handed over, settlement belongs to the closed day and its recorded
    // owner. Later changes to login access do not cancel a physical transfer.
    const day = await tx.workDayEntry.findFirst({
      where: { id: dayId, userId },
      select: { id: true, userId: true, date: true, status: true, endedAt: true },
    });
    if (!day) throw new HandoverError('Рабочий день не найден.', 404);
    const h=await tx.retailCashHandover.findUnique({where:{workDayEntryId:dayId}});
    if(!h)throw new HandoverError('Передача не найдена.');
    if((attempt==='initial' && h.status!=='confirmed')||terminal.includes(h.status)||h.status==='review')return {h,run:false as const};
    if(day.status !== 'completed' || !day.endedAt || !h.handedAt || !h.targetCashboxRef)throw new HandoverError('Фактическая передача ещё не подтверждена.');
    if(h.status==='posting'&&h.processingStartedAt&&+now-+h.processingStartedAt<120000)return {h,run:false as const};
    return {h:await tx.retailCashHandover.update({where:{id:h.id},data:{status:'posting',processingToken:token,processingStartedAt:now}}),day,run:true as const};
  });
  if(!claimed.run)return claimed.h;
  const h=claimed.h;
  try{
    const r=await postPair({idempotencyKey:h.operationKey,organizationRef:h.organizationRef,cashboxRef:h.sourceCashboxRef,targetCashboxRef:h.targetCashboxRef!,employeeName:'Сдача личной кассы',amount:Number(h.actual),direction:'employee_handover',employeeComment:`Передача ${h.id}`},h.expected===null?null:Number(h.expected),claimed.day.date);
    if(!r.ok||!r.pairComplete||!r.document||!r.receiptDocument||r.document.posted!==true||r.receiptDocument.posted!==true||r.document.cashbox.ref!==h.sourceCashboxRef||r.receiptDocument.cashbox.ref!==h.targetCashboxRef||r.receiptDocument.baseDocument.ref!==r.document.ref||r.document.amount!==Number(h.actual)||r.receiptDocument.amount!==Number(h.actual))throw Error(r.error||'Пара РКО → ПКО не подтверждена.');
    return db.$transaction(async tx=>{
      await lock(tx,dayId);const current=await tx.retailCashHandover.findUniqueOrThrow({where:{id:h.id}});if(current.processingToken!==token)return current;
      const done=await tx.retailCashHandover.update({where:{id:h.id},data:{status:'posted',expenseRef:r.document!.ref,expenseNumber:r.document!.number,receiptRef:r.receiptDocument!.ref,receiptNumber:r.receiptDocument!.number,error:'',processingToken:null}});
      await tx.workdayControlIssue.updateMany({where:{fingerprint:`retail-handover:${h.id}:cash_handover_1c`},data:{status:'resolved',resolvedAt:now}});
      return done;
    });
  }catch(e){
    const error=e instanceof Error?e.message:'1С недоступна.';
    const review=/requires_review|Остаток кассы изменился|Пара РКО → ПКО не подтверждена/.test(error);
    return db.$transaction(async tx=>{
      await lock(tx,dayId);
      const current=await tx.retailCashHandover.findUniqueOrThrow({where:{id:h.id}});
      if(current.processingToken!==token)return current;
      const failed=await tx.retailCashHandover.update({where:{id:h.id},data:{status:review?'review':'error',error,processingToken:null}});
      const day = claimed.day;
      const task = await tx.shiftControlTask.findFirstOrThrow({ where: { run: { workDayEntryId: day.id }, category: 'handover' }, select: { id: true } });
      await issue(tx,day,task.id,failed,'cash_handover_1c',error,'error');
      return failed;
    });
  }
}
