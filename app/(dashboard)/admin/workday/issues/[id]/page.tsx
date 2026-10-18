import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
export const dynamic='force-dynamic';
export default async function WorkdayIssuePage({params}:{params:Promise<{id:string}>}) {
 const admin=await getCurrentUser();
 if(!admin)redirect('/login');
 if(admin.role!=='ADMIN')redirect('/employee');
 const {id}=await params;
 const issue=/^\d+$/.test(id)?await prisma.workdayControlIssue.findUnique({where:{id:Number(id)},select:{id:true}}):null;
 if(!issue)redirect('/admin/workday');
 redirect(`/admin/workday?date=${getMoscowDateKey()}&control=all&view=attention&issue=${issue.id}#employees-control`);
}
