import { usesRetailCashHandover } from './workday';

export function adaptWorkdayTemplate<T extends { tasks: Array<{ category: string; title: string }> }>(user: {department?: string; workdayControlMode?: string | null}, template: T | null): T | null {
  if (!template || !usesRetailCashHandover(user)) return template;
  return { ...template, tasks: template.tasks.filter(t => t.category === 'handover').map(t => ({ ...t, title: 'Пересчитать и передать кассу' })) };
}
export type HandoverCandidate = {id:number;userId:number;startedAt:Date;shiftEndMinutes:number|null;endedAt:Date|null;status:string;date:string;user:{id:number;name:string;isActive:boolean;role:string;department:string;workdayControlMode:string;oneCCashboxMapping:{isActive:boolean;oneCCashboxRef:string}|null};shiftControlRun:{status:string;tasks:Array<{category:string;status:string;handoverData:unknown}>}|null};
export function selectCashHandoverRecipient(rows:HandoverCandidate[], input:{senderId:number;sourceRef:string;date:string;minutes:number;now:Date}) {
  return rows.filter(d=>d.userId!==input.senderId && d.date===input.date && d.status==='active' && !d.endedAt && d.startedAt<=input.now
    && d.user.role==='EMPLOYEE' && d.user.isActive && d.user.department==='retail' && d.user.workdayControlMode!=='CASH_HANDOVER'
    && d.user.oneCCashboxMapping?.isActive && d.user.oneCCashboxMapping.oneCCashboxRef!==input.sourceRef
    && d.shiftControlRun?.status!=='completed' && !d.shiftControlRun?.tasks.some(t=>t.category==='handover' && (t.status==='done'||Boolean(t.handoverData))))
    .sort((a,b)=>(b.shiftEndMinutes ?? -1) - (a.shiftEndMinutes ?? -1) || +a.startedAt-+b.startedAt || a.userId-b.userId)[0] ?? null;
}
export function handoverMoney(value:unknown) {
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>999999999||Math.abs(value*100-Math.round(value*100))>0.00001) throw Error('Укажите сумму от 0 ₽ с точностью до копейки.');
  return Math.round(value*100)/100;
}
