import { after } from 'next/server';
import { handoverEnvironment } from '@/lib/retail-cash-handover-environment';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { usesRetailCashHandover, getMoscowDateKey } from '@/lib/workday';
import { recipientOffer,HandoverError,serializeRetailHandover,recountRetailCash,prepareRetailCash,confirmRetailCash,processRetailCash } from '@/lib/retail-cash-handover-server';
export const dynamic='force-dynamic';
async function context(req:Request){
 const user=await getCurrentUser();if(!user||!usesRetailCashHandover(user)||!handoverEnvironment())throw new HandoverError('Нет доступа к сдаче кассы.',403);
 const dayId=Number(new URL(req.url).searchParams.get('workDayId'));
 if(!Number.isSafeInteger(dayId)||dayId<=0)throw new HandoverError('Рабочий день не найден.',400);
 const day=await prisma.workDayEntry.findFirst({where:{id:dayId,userId:user.id}});if(!day)throw new HandoverError('Рабочий день не найден.',404);
 return {user,day};
}
function failure(e:unknown){return Response.json({error:e instanceof HandoverError?e.message:'Не удалось сохранить действие. Обновите данные перед повтором.'},{status:e instanceof HandoverError?e.status:500});}
export async function GET(req:Request){try{const {day}=await context(req);return Response.json({handover:serializeRetailHandover(await prisma.retailCashHandover.findUnique({where:{workDayEntryId:day.id}}))},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const {user,day}=await context(req);const p=await req.json();
 if(day.date!==getMoscowDateKey()&&p.action!=='retry')throw new HandoverError('Пересчёт доступен только для сегодняшнего дня.');
 let h;
 if(p.action==='recipient')return Response.json(await recipientOffer(prisma,user.id,day.id));
 if(p.action==='handoff'){
   if(typeof p.token!=='string'||!p.token)throw new HandoverError('Получатель не подтверждён.');
   h=await recountRetailCash(prisma,user.id,day.id,{amount:p.amount,requestKey:p.requestKey,revision:p.revision??null,offerToken:p.token});
 }else if(p.action==='count')h=await recountRetailCash(prisma,user.id,day.id,{amount:p.amount,requestKey:p.requestKey,revision:p.revision??null});
 else if(p.action==='prepare')h=await prepareRetailCash(prisma,user.id,day.id,p.revision);
 else if(p.action==='confirm'){h=await confirmRetailCash(prisma,user.id,day.id,p.revision,p.handed===true);}

 else throw new HandoverError('Неизвестное действие.',400);
 if ((p.action === 'handoff' || p.action === 'confirm') && h.status === 'confirmed' && h.handedAt) {
   after(async () => {
     await processRetailCash(prisma, user.id, day.id, new Date(), undefined, 'initial');
   });
 }
 return Response.json({handover:serializeRetailHandover(h)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
