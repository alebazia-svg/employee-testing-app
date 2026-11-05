import {getCurrentUser} from '@/lib/auth';
import {readDailyRates} from '@/lib/procurement-daily-rate-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const user=await getCurrentUser();
 if(!user?.isActive||!(user.role==='ADMIN'||user.role==='EMPLOYEE'&&user.portalArea==='PROCUREMENT'))return Response.json({error:'Нет доступа.'},{status:403});
 try{return Response.json({quotes:await readDailyRates(new URL(req.url).searchParams.get('day')??'')},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Курсы временно недоступны.'},{status:503});}
}
