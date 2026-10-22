import 'server-only';
import {getAttendanceRows,getScheduleRows} from './google-sheets';
import {retailAttendanceSource} from './retail-attendance-source';
import {googleDay} from './team-control';
import {retailWorkplaceHint} from './retail-workplace-hint';
import {prisma} from './prisma';
import {runTerminalFiscalHistoricalDryRun} from './terminal-fiscal-runner';
import {technicalHash, aqsiTerminalIdForPortalKey} from './terminal-fiscal-sources';
import {isFiscalChainReason} from './terminal-fiscal-chain-review';
import type {FiscalChainEvidence} from './terminal-fiscal-chain-review';
import {TERMINAL_FISCAL_ADMIN_FIRST, fiscalProposedRecipients} from './terminal-fiscal-admin-gate';
import {terminalFiscalAdminReviewView} from './terminal-fiscal-employee-review-view';
export async function loadFiscalReviewData(id:string,currentUserId:number) {
  const review = await prisma.terminalFiscalEmployeeReview.findUnique({
    where: { id: id },
    include: {
      employee: { select: { name: true } },
      mapping: { select: { label: true, terminalKey: true, oneCCashRegisterRef:true, workstation: {select:{label:true}} } },
      participants: { include: { user: { select: { name: true } } }, orderBy: { user: { name: 'asc' } } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } },
    },
  });
  if (!review) return null;
  const open = review.status === 'open';
  const match = await prisma.terminalFiscalMatch.findUnique({
    where: { matchingId: review.matchingHash },
    select: { status: true, reasonCode: true, bankOperationRawType: true, oneCSourceRef: true, timeDifferenceSeconds: true,
      tbankComplete: true, oneCComplete: true, ofdComplete: true, oneCCashierRef:true },
  });
  const elapsedMinutes = Math.max(0, Math.floor((review.lastCheckedAt.getTime() - review.bankOperationAt.getTime()) / 60_000));
  const view = terminalFiscalAdminReviewView({
    status: review.status,
    bankOperationAt: review.bankOperationAt,
    amountKopecks: review.amountKopecks,
    match,
  });
  const resolved = view.tone === 'resolved';
  const shared = review.assignmentScope === 'retail_shift' || review.assignmentScope === 'retail_day';
  const pendingAdmin = TERMINAL_FISCAL_ADMIN_FIRST && review.status === 'admin_review' && !resolved;
  const proposed = pendingAdmin ? await fiscalProposedRecipients(prisma, review.bankOperationAt, review.mappingId) : null;
  const simpleCheck = pendingAdmin && !match?.oneCSourceRef && match?.reasonCode === 'ONE_C_CANDIDATE_NOT_FOUND'
    && match.tbankComplete && match.oneCComplete;
  const showDiscussion = (!pendingAdmin && !resolved) || review.messages.length > 0;
  let chain: FiscalChainEvidence | undefined;
  let chainUnavailable = false;
  if (pendingAdmin && review.mappingId && isFiscalChainReason(match?.reasonCode ?? review.reasonCode)) {
    try {
      const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow'}).format(review.bankOperationAt);
      const from = new Date(`${day}T00:00:00+03:00`);
      const result = await runTerminalFiscalHistoricalDryRun({mappingId:review.mappingId,periodFrom:from,
        periodTo:new Date(from.getTime()+86400000),persist:false,includeEvidence:true});
      if (result.acquired) chain = result.output?.records.find(r=>technicalHash(r.matchingKey)===review.matchingHash)?.evidence.chain;
      chainUnavailable = !chain;
    } catch { chainUnavailable = true; }
  }

  const cashier = match?.oneCCashierRef ? await prisma.userOneCCashboxMapping.findUnique({where:{oneCCashierRef:match.oneCCashierRef},select:{isActive:true,user:{select:{name:true}}}}) : null;
  let googleHint:ReturnType<typeof retailWorkplaceHint>=null;
  const dateKey=(at:Date)=>at.toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
  if(!cashier?.isActive && !resolved && review.mapping && dateKey(review.bankOperationAt)===dateKey(new Date())) {
    const read=(async()=>{
      const users=await prisma.user.findMany({where:{role:'EMPLOYEE',department:'retail',isActive:true},select:{id:true,name:true,oneCCashboxMapping:{select:{isActive:true,oneCCashRegisterRef:true}}}});
      const day=dateKey(review.bankOperationAt);
      const [appMarks,appPlans]=await Promise.all([
        prisma.workDayEntry.findMany({where:{date:day,userId:{in:users.map(u=>u.id)},status:{in:['active','completed']}},select:{userId:true,startedAt:true,endedAt:true,status:true}}),
        prisma.workScheduleEntry.findMany({where:{date:day,userId:{in:users.map(u=>u.id)}},select:{userId:true,status:true}}),
      ]);
      const unavailable={mode:'unavailable',rows:[]};
      let googleTimer:ReturnType<typeof setTimeout>|undefined;
      const [marks,plans]=await Promise.race([
        Promise.all([getAttendanceRows().catch(()=>unavailable),getScheduleRows().catch(()=>unavailable)]),
        new Promise<[typeof unavailable,typeof unavailable]>(resolve=>{googleTimer=setTimeout(()=>resolve([unavailable,unavailable]),1500);}),
      ]).finally(()=>{if(googleTimer)clearTimeout(googleTimer);});
      const googleReady=marks.mode==='google-sheets'&&plans.mode==='google-sheets';
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(review.bankOperationAt);
      const minute=Number(parts.find(p=>p.type==='hour')?.value)*60+Number(parts.find(p=>p.type==='minute')?.value);
      return retailWorkplaceHint(users.map(u=>{
        const raw=googleDay(u.name,day,googleReady?plans.rows:[],googleReady?marks.rows:[]);
        const attendance=retailAttendanceSource(raw,appMarks.find(m=>m.userId===u.id)??null,appPlans.find(p=>p.userId===u.id)?.status);
        return {name:u.name,homeKkm:u.oneCCashboxMapping?.isActive?u.oneCCashboxMapping.oneCCashRegisterRef:null,...attendance};
      }),review.mapping!.oneCCashRegisterRef,minute);
    })().catch(()=>null);
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {googleHint=await Promise.race([read,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),3000);})]);}finally{if(timer)clearTimeout(timer);}
  }
  const aqsi = review.mapping ? aqsiTerminalIdForPortalKey({portalTerminalKey:review.mapping.terminalKey,mappings:process.env.AQSI_TERMINAL_MAPPINGS,legacyPortalTerminalKey:process.env.AQSI_PORTAL_TERMINAL_KEY,legacyTerminalId:process.env.AQSI_TERMINAL_ID}) : null;
  return {
    id:review.id,currentUserId,open,resolved,pendingAdmin,simpleCheck,elapsedMinutes,view,
    amount:`${(review.amountKopecks/100).toLocaleString('ru-RU',{maximumFractionDigits:2})} ₽`,
    at:review.bankOperationAt.toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
    workstation:review.mapping?.workstation?.label || review.mapping?.label || null,
    terminal:aqsi ? `aQsi · ${aqsi}` : review.mapping ? `Терминал · ${review.mapping.terminalKey}` : null,
    manager:cashier?.isActive ? cashier.user.name : null,
    googleHint,
    proposed:proposed ?? {users:[],primary:null,confidence:'uncertain' as const},
    recipientLabel:review.assignmentScope==='admin_gate'?'Сотрудникам не передано':shared?review.participants.map(p=>p.user.name).join(', '):review.employee.name,
    showDiscussion,chain:chain??null,chainUnavailable,
    canApprove:pendingAdmin&&!match?.oneCSourceRef&&match?.reasonCode!=='ONE_C_POSSIBLE_SPLIT_SALE'&&!isFiscalChainReason(match?.reasonCode??'')&&!isFiscalChainReason(review.reasonCode),
    canReconcileDay:pendingAdmin&&!isFiscalChainReason(match?.reasonCode??review.reasonCode),
    canTest:pendingAdmin&&!match?.oneCSourceRef,
    hasOneCCheck:Boolean(match?.oneCSourceRef),
    reasonCode:match?.reasonCode??review.reasonCode,
    sources:{bank:match?.tbankComplete??null,oneC:match?.oneCComplete??null,ofd:match?.ofdComplete??null},
    checkedAt:review.lastCheckedAt.toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),
    rawType:match?.reasonCode==='BANK_OPERATION_UNSUPPORTED'?match.bankOperationRawType:null,
    message:match?.oneCSourceRef?view.message.replace(` ${match.oneCSourceRef}`,''):view.message,
    messages:review.messages.map(m=>({...m,createdAt:m.createdAt.toISOString()})),
  };
}
export type FiscalReviewData=NonNullable<Awaited<ReturnType<typeof loadFiscalReviewData>>>;
