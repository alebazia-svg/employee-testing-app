import { getCurrentUser } from '@/lib/auth';
import { readAdminDayReview, decideDayReview } from '@/lib/payroll-day-review-store';
import { dayReviewHeaders, dayReviewFailure } from '@/lib/payroll-day-review-http';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser();if(!user?.isActive||user.role!=='ADMIN')return Response.json({error:'Недостаточно прав.'},{status:403,headers:dayReviewHeaders});
 try{return Response.json(await readAdminDayReview((await params).id),{headers:dayReviewHeaders});}catch(e){return dayReviewFailure(e);}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser();if(!user?.isActive||user.role!=='ADMIN')return Response.json({error:'Недостаточно прав.'},{status:403,headers:dayReviewHeaders});
 const body=await req.json().catch(()=>null);
 if(!body||Object.keys(body).some(k=>!['action','comment','fingerprint'].includes(k))||!['approved','rejected'].includes(body.action)||typeof body.comment!=='string'||typeof body.fingerprint!=='string')return Response.json({error:'Некорректный запрос.'},{status:400,headers:dayReviewHeaders});
 try{const r=await decideDayReview((await params).id,user.id,body.action,body.comment,body.fingerprint);return Response.json({id:r.id,status:r.status},{headers:dayReviewHeaders});}catch(e){return dayReviewFailure(e);}
}
