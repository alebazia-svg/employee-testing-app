type CancelledPlan={id:string;status:string;supplierPartner:string;planCode?:string;updatedAt?:string;events?:{action:string;createdAt:string;snapshot:unknown}[]};
export function ProcurementCancelledHistory({plans,query=''}:{plans:CancelledPlan[];query?:string}){
  const rows=plans.filter(p=>p.status==='CANCELLED'&&[p.supplierPartner,p.planCode].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
    .map(p=>({p,event:p.events?.find(e=>e.action==='CANCELLED')})).sort((a,b)=>(b.event?.createdAt||'').localeCompare(a.event?.createdAt||''));
  if(!rows.length)return null;
  return <details className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Отменённые заявки · {rows.length}</summary><ul className="mt-2 divide-y">{rows.map(({p,event})=>{
    const actor=(event?.snapshot as {actorName?:string}|null)?.actorName;
    const date=event?.createdAt||p.updatedAt;
    return <li key={p.id} className="py-2 text-sm"><strong>{p.supplierPartner}</strong> · {p.planCode}<div className="text-slate-600">{[date&&new Date(date).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}),actor].filter(Boolean).join(' · ')}</div></li>;
  })}</ul></details>;
}
