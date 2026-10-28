import 'server-only';
import type {PrismaClient} from '@prisma/client';
import {fiscalProposedRecipients} from './terminal-fiscal-admin-gate';
import {fiscalManager, type FiscalManager} from './terminal-fiscal-manager';
export async function loadFiscalManager(db:PrismaClient,input:{at:Date;mappingId?:string|null;cashiers:Array<{ref:string;name:string}>}):Promise<FiscalManager>{
  const proposed=await fiscalProposedRecipients(db,input.at,input.mappingId);
  const expected=proposed.confidence==='high'?proposed.primary:null;
  const people=await db.userOneCCashboxMapping.findMany({where:{isActive:true,OR:[{oneCCashierRef:{in:input.cashiers.map(c=>c.ref).filter(Boolean)}},...(expected?[{userId:expected.id}]:[])]},select:{userId:true,oneCCashierRef:true,user:{select:{name:true}}}});
  const mapped=people.map(p=>({id:p.userId,name:p.user.name,cashierRef:p.oneCCashierRef}));
  return fiscalManager({expected:expected?{...expected,cashierRef:mapped.find(p=>p.id===expected.id)?.cashierRef}:null,cashiers:input.cashiers,people:mapped});
}
