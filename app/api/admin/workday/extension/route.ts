import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { approveWorkdayExtension, ExtensionChanged, type ExtensionProposal } from '@/lib/workday-extension';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request) {
  const admin=await getCurrentUser();
  if(!admin||admin.role!=='ADMIN') return Response.json({error:'Нет доступа.'},{status:admin?403:401,headers});
  const p=await request.json().catch(()=>null) as ExtensionProposal|null;
  if(!p||!Number.isSafeInteger(p.workDayId)||!Number.isSafeInteger(p.userId)||!Number.isSafeInteger(p.departedId)||typeof p.date!=='string'||p.fromShiftCode!=='09_18'||p.toShiftCode!=='09_20'||p.endMinutes!==1200)
    return Response.json({error:'Некорректное предложение.'},{status:400,headers});
  try {return Response.json({ok:true,...await approveWorkdayExtension(prisma,{adminId:admin.id,proposal:p})},{headers});}
  catch(error) {if(error instanceof ExtensionChanged)return Response.json({error:error.message},{status:409,headers});throw error;}
}
