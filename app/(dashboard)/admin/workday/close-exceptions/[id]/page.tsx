import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readIssueIds } from '@/lib/workday-required-issues';
import { cashEncashmentReasonLabel, isCashEncashmentException } from '@/lib/workday-cash-encashment-exception';
import { CloseExceptionDecisionClient } from './CloseExceptionDecisionClient';

export const dynamic = 'force-dynamic';

const reasonLabels: Record<string, string> = { power: 'Нет света', internet: 'Нет интернета', one_c: 'Не работает 1С', kkm: 'Не работает ККМ', other: 'Другая техническая причина' };
const statusLabels: Record<string, string> = { pending: 'Ожидает решения', approved: 'Разрешено', rejected: 'Отклонено', resolved: 'Устранено' };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function zReportPhotoPath(value: unknown) {
  const photos = record(record(value)?.photos);
  const photo = record(photos?.zReport);
  return typeof photo?.storagePath === 'string' ? photo.storagePath : '';
}

export default async function AdminCloseExceptionPage({ params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const request = await prisma.workdayCloseExceptionRequest.findUnique({
    where: { id: params.id },
    include: { employee: { select: { name: true } }, decidedBy: { select: { name: true } }, workDayEntry: { select: { date: true } } },
  });
  if (!request) redirect('/admin/workday');
  const cashEncashmentException = isCashEncashmentException(request.reasonCode);
  const issueIds = readIssueIds(request.issueIds);
  const issues = issueIds.length ? await prisma.workdayControlIssue.findMany({ where: { id: { in: issueIds } }, include: { task: { select: { handoverData: true } } }, orderBy: { detectedAt: 'asc' } }) : [];
  const kkmIssue = issues.find((issue) => issue.ruleKey === 'kkm_shift_not_closed') ?? null;
  const zReportPath = zReportPhotoPath(kkmIssue?.task?.handoverData);
  const zReportHref = zReportPath ? `/api/admin/workday/shift-control-photo?path=${encodeURIComponent(zReportPath)}` : '';
  return (
    <AdminShell>
      <AdminBreadcrumbs current={cashEncashmentException ? 'Инкассация' : 'Запрос на завершение дня'} />
      <Card className='max-w-3xl border-amber-200 bg-amber-50'>
        <div className='flex items-start gap-3'><ShieldAlert className='mt-0.5 h-6 w-6 text-amber-700' /><div><p className='text-xs font-extrabold uppercase text-amber-700'>{cashEncashmentException ? 'Инкассация не выполнена' : 'Техническое исключение'}</p><h1 className='mt-1 text-2xl font-black text-slate-950'>{request.employee.name} · {request.workDayEntry.date}</h1><div className='mt-3'><Badge>{statusLabels[request.status] ?? request.status}</Badge></div></div></div>
        <dl className='mt-5 grid gap-3 text-sm sm:grid-cols-2'><div><dt className='font-semibold text-slate-500'>Причина</dt><dd className='font-extrabold text-slate-950'>{cashEncashmentException ? cashEncashmentReasonLabel(request.reasonCode) : reasonLabels[request.reasonCode] ?? request.reasonCode}</dd></div><div><dt className='font-semibold text-slate-500'>Комментарий сотрудника</dt><dd className='font-extrabold text-slate-950'>{request.comment}</dd></div></dl>
        {cashEncashmentException ? <p className={`mt-5 rounded-xl bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-700 ring-1 ${request.status === 'resolved' ? 'ring-green-200' : 'ring-amber-200'}`}>{request.status === 'resolved' ? 'Ситуация устранена последующей подтверждённой инкассацией. Исходное исключение сохранено в истории.' : 'Если разрешить завершение дня, РКО и ПКО не будут созданы. Это не подтверждает инкассацию: ситуация останется у администратора на контроле до фактического устранения.'}</p> : <div className='mt-5 space-y-2'><h2 className='text-sm font-extrabold text-slate-900'>Незакрытые проблемы на момент запроса</h2>{issues.map((issue) => <Link key={issue.id} href={`/admin/workday/issues/${issue.id}`} className='block rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 ring-1 ring-amber-200'>{issue.title} · {issue.status === 'open' && issue.employeeActionRequired ? 'ещё требует действия' : 'уже исправлено'}</Link>)}{kkmIssue && <div className='rounded-xl bg-white p-4 ring-1 ring-amber-200'><p className='text-sm font-black text-slate-950'>Резервное подтверждение кассы</p>{zReportHref ? <a href={zReportHref} target='_blank' rel='noreferrer' className='mt-3 block overflow-hidden rounded-xl ring-1 ring-slate-200'><img src={zReportHref} alt='Фото чека закрытия смены' className='max-h-[32rem] w-full object-contain' /></a> : <p className='mt-2 text-sm font-semibold text-slate-600'>Фото не приложено: сотрудник сообщил, что чек не распечатался, либо ещё не отправил подтверждение.</p>}</div>}</div>}
        {request.status === 'pending' ? <CloseExceptionDecisionClient requestId={request.id} approveLabel={cashEncashmentException ? 'Разрешить без инкассации' : undefined} /> : <div className='mt-5 border-t border-amber-200 pt-4 text-sm font-semibold text-slate-700'><p>Состояние: {statusLabels[request.status] ?? request.status}</p>{request.decisionComment && <p className='mt-1'>Комментарий: {request.decisionComment}</p>}{request.decidedBy && <p className='mt-1'>Администратор: {request.decidedBy.name}</p>}<p className='mt-2'>{cashEncashmentException ? request.status === 'resolved' ? 'Активного действия больше не требуется.' : 'Разрешение не создаёт кассовые документы и не подтверждает инкассацию.' : 'Разрешение не закрывает саму проблему и действует только для этого рабочего дня и этого набора ошибок.'}</p></div>}
      </Card>
    </AdminShell>
  );
}
