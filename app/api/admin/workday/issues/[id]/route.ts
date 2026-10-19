import { getCurrentAdmin } from '@/lib/auth';
import { getAdminWorkdayIssueDetail } from '@/lib/admin-workday-issue-detail';
export async function GET(_request: Request, context: {params:Promise<{id:string}>}) {
  if (!await getCurrentAdmin()) return Response.json({error:'Forbidden'}, {status:403});
  const {id} = await context.params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id)<1) return Response.json({error:'Некорректное замечание.'},{status:400});
  const issue = await getAdminWorkdayIssueDetail(Number(id));
  if (!issue) return Response.json({error:'Замечание не найдено.'},{status:404});
  return Response.json(issue,{headers:{'Cache-Control':'private, no-store'}});
}
