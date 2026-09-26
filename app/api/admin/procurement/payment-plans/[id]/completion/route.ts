import { requireAdminApi } from '@/lib/admin-api-auth';
import { previewPaymentCompletion, decidePaymentCompletion } from '@/lib/procurement-payment-completion-server';
type Props={params:Promise<{id:string}>};
const failure=(error:unknown)=>Response.json({error:error instanceof Error&&/^[А-ЯЁ]/.test(error.message)?error.message:'Не удалось проверить оплаты. Повторите позже.'},{status:409});
export async function GET(req:Request,props:Props){
  const access=await requireAdminApi();if(!access.ok)return access.response;
  const action=new URL(req.url).searchParams.get('action');
  if(action!=='COMPLETE'&&action!=='REOPEN')return Response.json({error:'Выберите действие.'},{status:400});
  try{const p=await previewPaymentCompletion((await props.params).id,action);return Response.json({quote:p.quote,remainingAmount:p.remainingAmount,remainingForeignAmount:p.remainingForeignAmount},{headers:{'Cache-Control':'no-store'}});}catch(error){return failure(error);}
}
export async function POST(req:Request,props:Props){
  const access=await requireAdminApi();if(!access.ok)return access.response;
  const body=await req.json().catch(()=>null);
  if(!body||!['COMPLETE','REOPEN'].includes(body.action)||typeof body.quote!=='string'||typeof body.reason!=='string')return Response.json({error:'Проверьте действие и причину.'},{status:400});
  try{return Response.json(await decidePaymentCompletion((await props.params).id,access.user.id,body));}catch(error){return failure(error);}
}
