import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {freshEvidence} from '@/lib/procurement-plan-revision-server';
import {prepareShareManifest,SharePreparationError} from '@/lib/procurement-share-manifest';
export const runtime='nodejs';
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return Response.json({error:'Необходим вход.'},{status:401});
 if(user.role!=='ADMIN')return Response.json({error:'Нет доступа.'},{status:403});
 try{const origin=new URL(req.headers.get('origin')||'');if(!['http:','https:'].includes(origin.protocol)||origin.host!==(req.headers.get('host')||new URL(req.url).host))throw Error();}catch{return Response.json({error:'Недопустимый источник запроса.'},{status:403});}
 const body=await req.json().catch(()=>null);
 try{return Response.json(await prepareShareManifest(prisma,user,body?.selection,freshEvidence,body?.stamp),{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){return Response.json({error:e instanceof SharePreparationError?e.message:'Не удалось проверить оплаты в 1С. Повторите подготовку позже.'},{status:e instanceof SharePreparationError?e.status:503});}
}
