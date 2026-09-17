import type { PaymentRevision } from '@/lib/procurement-plan-revision';
export type PlanChangeEvent = {id:string;action:string;createdAt:string;snapshot:unknown};
export function ProcurementChangeHistory({events=[]}:{events?:PlanChangeEvent[]}) {
  const rows=events.filter(e=>['REVISION_REQUESTED','REVISION_APPROVED','REVISION_REJECTED','COMMENT_UPDATED'].includes(e.action));
  if(!rows.length)return null;
  const titles:Record<string,string>={REVISION_REQUESTED:'Изменения отправлены',REVISION_APPROVED:'Изменения согласованы',REVISION_REJECTED:'Оставлены прежние условия',COMMENT_UPDATED:'Комментарий изменён'};
  return <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">История изменений</summary><div className="mt-2 space-y-3">{rows.map(row=>{const snapshot=row.snapshot as {revision?:PaymentRevision;reason?:string};return <div key={row.id}><p className="font-semibold">{titles[row.action]} · {new Date(row.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}</p><p>{snapshot.reason||snapshot.revision?.reason}</p>{snapshot.revision?.changes.map(c=><p key={c.label}>{c.label}: {c.before||'—'} → {c.after||'—'}</p>)}</div>;})}</div></details>;
}
