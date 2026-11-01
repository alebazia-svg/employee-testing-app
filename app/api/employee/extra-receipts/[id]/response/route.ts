import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {respondToExtraReceipt,validExtraReceiptResponse} from '@/lib/terminal-extra-receipt-response';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await getCurrentUser();if(!user||user.role!=='EMPLOYEE')return Response.json({error:'Нет доступа'},{status:403});
 const id=Number((await params).id),body=await req.json().catch(()=>null);
 if(!Number.isSafeInteger(id)||id<=0||!validExtraReceiptResponse(body?.action))return Response.json({error:'Некорректный ответ'},{status:400});
 try{return Response.json({ok:true,...await respondToExtraReceipt(prisma,id,user.id,body.action)},{headers:{'Cache-Control':'private, no-store'}});}
 catch(e){if(e instanceof Error&&['FORBIDDEN','ISSUE_NOT_AVAILABLE','RESPONSE_CHANGED'].includes(e.message))return Response.json({error:'Проверка изменилась или недоступна. Обновите экран.'},{status:e.message==='FORBIDDEN'?403:409});throw e;}
}
