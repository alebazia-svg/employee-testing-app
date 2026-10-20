import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AdminShell} from '@/components/AdminShell';
import {getCurrentUser} from '@/lib/auth';
import {loadFiscalReviewData} from '@/lib/fiscal-review-data';
import {FiscalReviewContent} from '@/components/FiscalReviewContent';
export const dynamic='force-dynamic';
export default async function AdminPaymentCheckPage({params}:{params:Promise<{id:string}>}) {
 const admin=await getCurrentUser();
 if(!admin)redirect('/login');
 if(admin.role!=='ADMIN')redirect('/employee');
 const detail=await loadFiscalReviewData((await params).id,admin.id);
 if(!detail)redirect('/admin/workday');
 return <AdminShell pageTitle="Проверка чека"><div className="mx-auto w-full max-w-3xl"><Link href="/admin/inbox?view=attention" className="mb-4 inline-flex rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">← К уведомлениям</Link><div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6"><FiscalReviewContent detail={detail}/></div></div></AdminShell>;
}
