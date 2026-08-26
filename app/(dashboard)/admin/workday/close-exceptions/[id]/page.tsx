import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateLabel } from '@/lib/workday';
import { readIssueIds } from '@/lib/workday-required-issues';
import { cashEncashmentReasonLabel, isCashEncashmentException } from '@/lib/workday-cash-encashment-exception';
import { CloseExceptionDecisionClient } from './CloseExceptionDecisionClient';

export const dynamic = 'force-dynamic';

const reasonLabels: Record<string, string> = { power: 'Нет света', internet: 'Нет интернета', one_c: 'Не работает 1С', kkm: 'Не работает касса', other: 'Другая техническая причина' };
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
  const requestDate = formatDateLabel(request.workDayEntry.date);
  return (
    <AdminShell>
      <AdminBreadcrumbs current={cashEncashmentException ? 'Инкассация' : 'Запрос на завершение дня'} />
      <Card className='max-w-3xl border-amber-200 bg-amber-50 pb-24 md:pb-6'>
        <div className='flex items-start gap-3'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-200'><ShieldAlert className='h-5 w-5' /></div>
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-extrabold uppercase tracking-wide text-amber-700'>{cashEncashmentException ? 'Инкассация не выполнена' : 'Требуется решение'}</p>
            <h1 className='mt-1 text-2xl font-black leading-tight text-slate-950'>{cashEncashmentException ? 'Разрешение без инкассации' : 'Разрешение завершить день'}</h1>
            <p className='mt-1 text-sm font-semibold text-slate-600'>{request.employee.name} · {requestDate}</p>
            <div className='mt-3'><Badge>{statusLabels[request.status] ?? request.status}</Badge></div>
          </div>
        </div>
        <dl className='mt-5 grid gap-3 text-sm sm:grid-cols-2'>
          <div><dt className='font-semibold text-slate-500'>Причина</dt><dd className='mt-0.5 font-extrabold text-slate-950'>{cashEncashmentException ? cashEncashmentReasonLabel(request.reasonCode) : reasonLabels[request.reasonCode] ?? request.reasonCode}</dd></div>
          {request.comment ? <div><dt className='font-semibold text-slate-500'>Комментарий сотрудника</dt><dd className='mt-0.5 break-words font-extrabold text-slate-950'>{request.comment}</dd></div> : null}
        </dl>
        {cashEncashmentException ? <p className={`mt-5 rounded-xl bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-700 ring-1 ${request.status === 'resolved' ? 'ring-green-200' : 'ring-amber-200'}`}>{request.status === 'resolved' ? 'Ситуация устранена последующей подтверждённой инкассацией. Исходное исключение сохранено в истории.' : 'Если разрешить завершение дня, РКО и ПКО не будут созданы. Это не подтверждает инкассацию: ситуация останется у администратора на контроле до фактического устранения.'}</p> : (
          <div className='mt-5 space-y-4 border-t border-amber-200 pt-4'>
            <section>
              <h2 className='text-xs font-extrabold uppercase tracking-wide text-slate-500'>Что осталось исправить</h2>
              <div className='mt-2 space-y-2'>{issues.map((issue) => <Link key={issue.id} href={`/admin/workday/issues/${issue.id}`} className='flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200 transition hover:ring-amber-300'><span>{issue.title}</span><span className={issue.status === 'open' && issue.employeeActionRequired ? 'shrink-0 text-xs text-amber-700' : 'shrink-0 text-xs text-green-700'}>{issue.status === 'open' && issue.employeeActionRequired ? 'Не исправлено' : 'Исправлено'}</span></Link>)}</div>
            </section>
            {kkmIssue ? <section>
              <h2 className='text-xs font-extrabold uppercase tracking-wide text-slate-500'>Подтверждение закрытия кассы</h2>
              {zReportHref ? <a href={zReportHref} target='_blank' rel='noreferrer' className='mt-2 block overflow-hidden rounded-xl bg-white ring-1 ring-slate-200'><img src={zReportHref} alt='Фото чека закрытия смены' className='max-h-[32rem] w-full object-contain' /></a> : <p className='mt-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200'>Чек не распечатался, фото отсутствует.</p>}
            </section> : null}
          </div>
        )}
        {request.status === 'pending' ? <CloseExceptionDecisionClient requestId={request.id} approveLabel={cashEncashmentException ? 'Разрешить без инкассации' : undefined} /> : <div className='mt-5 border-t border-amber-200 pt-4 text-sm font-semibold text-slate-700'><p>Состояние: {statusLabels[request.status] ?? request.status}</p>{request.decisionComment && <p className='mt-1'>Комментарий: {request.decisionComment}</p>}{request.decidedBy && <p className='mt-1'>Администратор: {request.decidedBy.name}</p>}<p className='mt-2'>{cashEncashmentException ? request.status === 'resolved' ? 'Активного действия больше не требуется.' : 'Разрешение не создаёт кассовые документы и не подтверждает инкассацию.' : 'Разрешение не закрывает саму проблему и действует только для этого рабочего дня и этого набора ошибок.'}</p></div>}
      </Card>
    </AdminShell>
  );
}
