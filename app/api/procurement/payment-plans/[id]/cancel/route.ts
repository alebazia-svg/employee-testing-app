import { getCurrentUser } from '@/lib/auth';
import { cancelPayment } from '@/lib/procurement-cancel-server';

export async function POST(req:Request, props:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user || user.role!=='EMPLOYEE' || user.portalArea!=='PROCUREMENT')return Response.json({error:'Нет доступа.'},{status:user?403:401});
  try {
    const body=await req.json();
    return Response.json(await cancelPayment((await props.params).id,user,body.version));
  } catch(error) {
    return Response.json({error:error instanceof Error && /^[А-ЯЁ]/.test(error.message)?error.message:'Не удалось проверить отмену. Обновите заявку.'},{status:409});
  }
}
