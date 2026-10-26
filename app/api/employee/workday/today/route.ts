import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getEmployeeWorkdaySnapshot } from '@/lib/employee-workday-snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
};

export async function GET(req:Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  const checkId=new URL(req.url).searchParams.get('checkWorkDayId');
  if(checkId!==null && (!/^\d+$/.test(checkId) || !Number.isSafeInteger(Number(checkId)) || Number(checkId)<1))return Response.json({error:'Некорректный номер смены'},{status:400,headers:noStoreHeaders});
  const snapshot = await getEmployeeWorkdaySnapshot({ id: user.id, department: user.department });
  const checkedWorkDay=checkId===null?undefined:await prisma.workDayEntry.findFirst({where:{id:Number(checkId),userId:user.id},select:{id:true,date:true,status:true,endedAt:true}});
  return Response.json({...snapshot,...(checkId===null?{}:{checkedWorkDay})}, { headers: noStoreHeaders });
}
