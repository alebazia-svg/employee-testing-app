import { getCurrentUser } from '@/lib/auth';
import { readDayReview, submitDayReview } from '@/lib/payroll-day-review-store';
import { dayReviewHeaders, dayReviewFailure } from '@/lib/payroll-day-review-http';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const user=await getCurrentUser();if(!user?.isActive||user.role!=='EMPLOYEE'||user.portalArea!=='WORKDAY')return Response.json({error:'Недостаточно прав.'},{status:user?403:401,headers:dayReviewHeaders});
 const query=new URL(req.url).searchParams;
 if([...query.keys()].some(k=>k!=='month')||query.getAll('month').length!==1)return Response.json({error:'Некорректный запрос.'},{status:400,headers:dayReviewHeaders});
 try{return Response.json(await readDayReview(user.id,query.get('month')!),{headers:dayReviewHeaders});}catch(e){return dayReviewFailure(e);}
}
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user?.isActive||user.role!=='EMPLOYEE'||user.portalArea!=='WORKDAY')return Response.json({error:'Недостаточно прав.'},{status:user?403:401,headers:dayReviewHeaders});
 const body=await req.json().catch(()=>null);
 if(!body||Object.keys(body).some(k=>!['month','dates'].includes(k))||typeof body.month!=='string')return Response.json({error:'Некорректный запрос.'},{status:400,headers:dayReviewHeaders});
 try {const r=await submitDayReview(user.id,body.month,body.dates);return Response.json({id:r.id,status:r.status},{headers:{...dayReviewHeaders,'X-Portal-Activity-Ref':r.id}});}catch(e){return dayReviewFailure(e);}
}
