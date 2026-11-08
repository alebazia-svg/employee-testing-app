import { payrollDayReviewEnabled } from '@/lib/payroll-day-review';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminPayrollPage from './PayrollClient';
import { payrollFeatureState } from '@/lib/payroll-features';
import './payroll-settlement-preview.css';

export const dynamic = 'force-dynamic';

export default async function PayrollPage({searchParams}:{searchParams?:Promise<{period?:string;tab?:string}>}) {
  const query=await searchParams;
  const current=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Moscow"}).format(new Date()).slice(0,7);
  const initialPeriod=query?.period&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(query.period)&&query.period<=current?query.period:undefined;
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  return <AdminPayrollPage initialPeriod={initialPeriod} initialPaymentsTab={query?.tab==="payments"} liveWorkspace dayReviewEnabled={payrollDayReviewEnabled()} serverDraftsEnabled={payrollFeatureState().draftsEnabled} testEnvironment={process.env.PAYROLL_SETTLEMENT_PREVIEW === '1'} />;
}
