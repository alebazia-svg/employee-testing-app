import 'server-only';
import { evaluateCashInventory, type CashInventoryCount, type CashInventoryResolution } from './cash-inventory-resolution';
import { getCashStatementSummary, type OneCCashStatementSummaryResult } from './one-c';
import { getMoscowDateKey } from './workday';
import { prisma } from './prisma';
const addDays=(date:string,n:number)=>getMoscowDateKey(new Date(+new Date(`${date}T12:00:00+03:00`)+n*86400000));
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** Shared per-read caches; no new endpoint, persisted balance or financial mutation. */
export function createCashInventoryLookup(options:{organizationRef:string;now?:Date;load?:typeof getCashStatementSummary;db?:Pick<typeof prisma,'shiftControlTask'>}) {
 const now=options.now??new Date(),started=Date.now(),clock=()=>new Date(+now+Date.now()-started),load=options.load??getCashStatementSummary,db=options.db??prisma;
 const statements=new Map<string,Promise<OneCCashStatementSummaryResult>>(),counts=new Map<string,Promise<CashInventoryCount[]>>();
 return async (input:CashInventoryCount & {statement:OneCCashStatementSummaryResult|null}):Promise<CashInventoryResolution|null>=>{
  if(!Number.isFinite(Date.parse(input.capturedAt))||input.actual===null||input.expected===null||input.actual===input.expected||!input.cashboxRef||!input.statement?.ok)return null;
  const from=getMoscowDateKey(new Date(input.capturedAt));
  const through=[getMoscowDateKey(now),addDays(from,31)].sort()[0];
  if(!counts.has(from))counts.set(from,db.shiftControlTask.findMany({where:{category:{in:['cash','handover']},run:{date:{gte:from,lte:through}}},select:{category:true,numericValue:true,handoverData:true}}).then(rows=>rows.flatMap(t=>{
   const data=record(t.handoverData),audit=record(data.oneCAudit);if(typeof audit.capturedAt!=='string')return [];
   return (t.category==='cash'?['personalCash']:['personalCash','reserveCash']).flatMap(scope=>{const snapshot=record(audit[scope]),actual=t.category==='cash'?t.numericValue:record(data[scope]).cashBalance;return typeof actual==='number'&&snapshot.status==='captured'&&typeof snapshot.balance==='number'&&typeof snapshot.cashboxRef==='string'?[{actual,expected:snapshot.balance,capturedAt:audit.capturedAt as string,cashboxRef:snapshot.cashboxRef}]:[];});
  })));
  const laterCounts=await counts.get(from)!;
  const followingStatements:OneCCashStatementSummaryResult[]=[];
  for(let date=from;date<=through;date=addDays(date,1)){
   const result=evaluateCashInventory({...input,followingStatements,laterCounts},clock());
   if(result.resolution)return result.resolution;
   if(!result.canContinue)return null;
   if(date===through)break;
   const next=addDays(date,1),key=input.cashboxRef+':'+next;
   if(!statements.has(key))statements.set(key,load({date:next,organizationRef:options.organizationRef,cashboxRef:input.cashboxRef}));
   const statement=await statements.get(key)!;if(!statement.ok)return null;
   followingStatements.push(statement);
  }
  return null;
 };
}
