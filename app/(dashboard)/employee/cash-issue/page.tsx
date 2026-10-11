import { redirect } from 'next/navigation';

export default async function EmployeeCashIssuePage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  redirect(request ? `/employee?cashIssue=${encodeURIComponent(request)}` : '/employee');
}
