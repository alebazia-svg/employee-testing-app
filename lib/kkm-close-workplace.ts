import 'server-only';
import type { PrismaClient, Prisma } from '@prisma/client';
import { retailHomeTerminalKey, isRetailWorkstationReplacement } from './retail-workstation-responsibility';
import { fiscalProposedRecipients } from './terminal-fiscal-admin-gate';

type Db = PrismaClient | Prisma.TransactionClient;
export async function resolveKkmCloseWorkplace(db: Db, userId: number, date: string) {
  const day = await db.workDayEntry.findUnique({where:{userId_date:{userId,date}},include:{user:{select:{name:true,department:true}}}});
  if (!day || day.user.department !== 'retail' || !day.startedAt) return null;
  const at = day.endedAt ? new Date(+day.endedAt - 1) : new Date();
  const mappings = await db.terminalFiscalMapping.findMany({where:{isActive:true,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
  const unique = (rows: typeof mappings, basis: string) => {
    const keys = new Set(rows.map(row=>`${row.oneCCashRegisterRef}|${row.kktRegistrationNumber}`));
    return keys.size===1 && rows[0]?.oneCCashRegisterRef && rows[0].kktRegistrationNumber
      ? {cashRegisterRef:rows[0].oneCCashRegisterRef,kktRegistrationNumber:rows[0].kktRegistrationNumber,basis} : null;
  };
  const assignments = await db.workdayKkmAssignment.findMany({where:{userId,date,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
  const assigned = [...new Set(assignments.flatMap(row=>row.oneCCashRegisterRef?[row.oneCCashRegisterRef]:[]))];
  if (assigned.length) return assigned.length===1 ? unique(mappings.filter(row=>row.oneCCashRegisterRef===assigned[0]),'manual_kkm_assignment') : null;
  const home = await db.userOneCCashboxMapping.findUnique({where:{userId}});
  if (home?.isActive && home.oneCCashRegisterRef) return unique(mappings.filter(row=>row.oneCCashRegisterRef===home.oneCCashRegisterRef),'explicit_home_kkm');
  const terminalKey = retailHomeTerminalKey(day.user.name);
  if (terminalKey) return unique(mappings.filter(row=>row.terminalKey===terminalKey),'home_workstation');
  if (!isRetailWorkstationReplacement(day.user.name)) return null;
  // Reuse the existing replacement rule at observed shift boundaries. Do not
  // infer a workplace from schedule plans or from the employee's surname.
  const entries = await db.workDayEntry.findMany({where:{date,department:'retail',user:{role:'EMPLOYEE',isActive:true}},select:{userId:true,startedAt:true,endedAt:true}});
  const overlapping=entries.filter(entry=>entry.startedAt<=at&&(!entry.endedAt||entry.endedAt>=day.startedAt));
  if(new Set(overlapping.map(entry=>entry.userId)).size>2)return null;
  const moments = [...new Set([+day.startedAt + 1,+at,...entries.flatMap(entry=>entry.startedAt?[+entry.startedAt+1]:[])])]
    .filter(time=>time>=+day.startedAt && time<=+at);
  const proposed: typeof mappings = [];
  for (const mapping of mappings) {
    for (const time of moments) {
      const recipients = await fiscalProposedRecipients(db,new Date(time),mapping.id);
      if (recipients.confidence==='high' && recipients.primary?.id===userId) {proposed.push(mapping);break;}
    }
  }
  return unique(proposed,'floating_employee');
}
