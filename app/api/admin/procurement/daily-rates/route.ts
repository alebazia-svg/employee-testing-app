import {requireAdminApi} from '@/lib/admin-api-auth';
import {previewDailyRate,confirmDailyRate} from '@/lib/procurement-daily-rate-server';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const auth=await requireAdminApi();if(!auth.ok)return auth.response;
 if(!auth.user.isActive)return Response.json({error:'Нет доступа.'},{status:403});
 try{const origin=new URL(req.headers.get('origin')||'');if(!['http:','https:'].includes(origin.protocol)||origin.host!==(req.headers.get('host')||new URL(req.url).host))throw Error();}catch{return Response.json({error:'Недопустимый источник запроса.'},{status:403});}
 try{
  const body=await req.json();
  if(!body||!['PREVIEW','CONFIRM'].includes(body.action)||Object.keys(body).some(k=>!['action','day','currency','rate','fingerprint'].includes(k)))return Response.json({error:'Проверьте действие.'},{status:400});
  return Response.json(body.action==='PREVIEW'?await previewDailyRate(body):await confirmDailyRate(body,auth.user.id),{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  // Never expose Prisma/1C payloads, credentials or SQL details.
  const message=error instanceof Error?error.message:'';
  const safe=/^(Проверьте|Укажите|Прошедший|Сначала|Заявк|Не удалось проверить оплат|Нет права|Индивидуальный|Выдача|Завершённая|Данные оплат)/.test(message)&&message.length<240;
  return Response.json({error:safe?message:'Не удалось сохранить курс. Повторите позже.'},{status:409});
 }
}
