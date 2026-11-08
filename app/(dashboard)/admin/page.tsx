import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminShell } from '@/components/AdminShell';
import { AdminHome } from './home/AdminHome';
export const dynamic='force-dynamic';
export default async function AdminPage(){
 const admin=await getCurrentUser();if(!admin)redirect('/login');if(admin.role!=='ADMIN')redirect('/employee');
 return <AdminShell pageTitle="Сегодня" pageDescription="Работа сегодня, ваши действия и финансовый контроль."><AdminHome localPreview={process.env.NODE_ENV==='development'&&process.env.ADMIN_HOME_LOCAL_DEMO==='1'}/></AdminShell>;
}
