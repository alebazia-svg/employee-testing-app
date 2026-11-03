import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {handoverReviewRequestAllowed} from '@/lib/workday-handover-review';
import {acknowledgeHandoverReview} from '@/lib/workday-handover-review-server';
export async function POST(request:Request) {
  const admin = await getCurrentUser();
  if(!admin || admin.role !== 'ADMIN') return Response.json({error:'Forbidden'},{status:403});
  if(!handoverReviewRequestAllowed(request)) return Response.json({error:'Forbidden'},{status:403});
  const body=await request.json().catch(()=>null);
  const taskId=body?.taskId;
  if(typeof taskId !== 'number' || !Number.isSafeInteger(taskId) || taskId<1 || taskId>2147483647) return Response.json({error:'Некорректная сдача смены.'},{status:400});
  try {
    const result=await prisma.$transaction(tx=>acknowledgeHandoverReview(tx,taskId,admin.id,new Date()));
    return result.ok ? Response.json({review:result.review}) : Response.json({error:result.error},{status:result.status});
  } catch {
    return Response.json({error:'Не удалось сохранить проверку. Повторите попытку.'},{status:500});
  }
}
