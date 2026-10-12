import {requireAdminApi} from '@/lib/admin-api-auth';
import {editApprovedPlan} from '@/lib/procurement-approved-edit-server';
export async function PATCH(req:Request,props:{params:Promise<{id:string}>}) {
  const access=await requireAdminApi();if(!access.ok)return access.response;
  try{return Response.json(await editApprovedPlan((await props.params).id,access.user.id,await req.json().catch(()=>null)));}
  catch(error){return Response.json({error:error instanceof Error&&/^[А-ЯЁ]/.test(error.message)?error.message:'Не удалось сохранить изменения. Повторите позже.'},{status:409});}
}
