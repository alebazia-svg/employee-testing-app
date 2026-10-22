import {getCurrentUser} from '@/lib/auth';
import {changePaymentSchedule} from '@/lib/procurement-schedule-server';
export async function PATCH(req:Request,props:{params:Promise<{id:string}>}){
 const user=await getCurrentUser();
 if(!user)return Response.json({error:'Необходим вход.'},{status:401});
 if(!user.isActive||!(user.role==='ADMIN'||user.role==='EMPLOYEE'&&user.portalArea==='PROCUREMENT'))return Response.json({error:'Нет доступа.'},{status:403});
 try{return Response.json(await changePaymentSchedule((await props.params).id,user,await req.json().catch(()=>null)));}
 catch(error){return Response.json({error:error instanceof Error&&/^[А-ЯЁ]/.test(error.message)?error.message:'Не удалось сохранить изменение. Повторите позже.'},{status:409});}
}
