import 'server-only';
import { prisma } from './prisma';
import { issueSource, workdayIssueView } from './workday-control-issue-view';
import { formatDateLabel, formatTime, getMoscowDateKey } from './workday';

// The same evidence as the issue card, without reloading the daily source snapshots.
export async function getAdminWorkdayIssueDetail(id: number) {
  const issue = await prisma.workdayControlIssue.findUnique({where:{id},include:{user:{select:{name:true}},task:{select:{handoverData:true}},messages:{orderBy:{createdAt:'asc'},include:{author:{select:{id:true,name:true,role:true}}}},notifications:{where:{kind:'workday_issue_reply'},orderBy:{createdAt:'desc'},take:5}}});
  if (!issue) return null;
  const view = workdayIssueView(issue), kkm = issue.ruleKey === 'kkm_shift_not_closed';
  const open = issue.status === 'open' && (kkm || issue.employeeActionRequired);
  const siblings = await prisma.workdayControlIssue.findMany({where:{userId:issue.userId,status:'open',employeeActionRequired:true},orderBy:{detectedAt:'asc'}});
  const data=issueSource(issue.sourceData),handover=issueSource(issue.task?.handoverData),photos=issueSource(handover.photos),photo=issueSource(photos.zReport);
  const instruction=view.instruction.trim(), fallbackAmount=instruction.match(/([\d\s\u00a0]+)\s*₽/);
  const amount=view.amount || (fallbackAmount ? `${Number(fallbackAmount[1].replace(/\s/g,'' )).toLocaleString('ru-RU')} ₽` : '');
  const useful=/[А-Яа-яЁё]/.test(instruction) && instruction!==`${view.documentNumber} · ${view.amount}` && instruction!==view.summaryMeta;
  return {
    id:issue.id, title:kkm?issue.title:'Чек по кредитной продаже', userName:issue.user.name, open, kkm,
    state:open?kkm&&!issue.employeeActionRequired?'Ожидает сверки ОФД':view.verificationPending?'Не удалось проверить':'Исправляет сотрудник':'Закрыто',
    siblings:siblings.map(item=>({id:item.id,label:workdayIssueView(item).documentNumber||`Замечание ${item.id}`})),
    document:kkm?String(data.cashRegisterName||'Не определена'):view.documentNumber||'Номер не указан', amount:amount||'Сумма не указана',
    instruction:kkm&&data.confirmationMethod?issue.detail:view.verificationPending?'Повторная проверка не завершена. Предыдущее замечание остаётся на контроле.':kkm?issue.detail:useful?instruction:'Причина не указана. Проверьте чек в 1С.',
    photoHref:typeof photo.storagePath==='string'?`/api/admin/workday/shift-control-photo?path=${encodeURIComponent(photo.storagePath)}`:'',
    origin:formatDateLabel(issue.originDate), checked:`${formatDateLabel(getMoscowDateKey(issue.lastDetectedAt))} · ${formatTime(issue.lastDetectedAt)}`,
    receiptCashierName:view.receiptCashierName, receiptDelayMinutes:view.receiptDelayMinutes,
    kkt:String(data.kktRegistrationNumber||'Не определена'), source:String(data.sourceError||issue.detail),
    deliveries:issue.notifications.map(n=>n.readAt?'Сообщение прочитано':n.pushStatus==='delivered'?'Доставлено на устройство':n.pushStatus==='no_subscription'?'Сообщение доступно в портале':n.status==='pending'?'Ожидает отправки':'Сообщение сохранено'),
    messages:issue.messages.map(message=>({id:message.id,body:message.body,author:message.author,createdAt:message.createdAt.toISOString()})),
    canDismiss:open&&issue.ruleKey==='credit_realization_mismatch',
  };
}
export type AdminWorkdayIssueDetail = NonNullable<Awaited<ReturnType<typeof getAdminWorkdayIssueDetail>>>;
