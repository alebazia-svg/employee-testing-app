import { getCurrentUser } from '@/lib/auth';
import { cancelDayReview } from '@/lib/payroll-day-review-store';
import { dayReviewHeaders, dayReviewFailure } from '@/lib/payroll-day-review-http';
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser();if(!user?.isActive||user.role!=='EMPLOYEE'||user.portalArea!=='WORKDAY')return Response.json({error:'Недостаточно прав.'},{status:user?403:401,headers:dayReviewHeaders});
 try{const r=await cancelDayReview((await params).id,user.id);return Response.json({id:r.id,status:r.status},{headers:dayReviewHeaders});}catch(e){return dayReviewFailure(e);}
}
