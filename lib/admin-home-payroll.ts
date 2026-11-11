import 'server-only';
import { prisma } from './prisma';
import { getMoscowDateKey } from './workday';
import { buildPayrollEmployeeDirectory, applyPayrollBonuses } from './payroll-calculation-engine';
import { buildDailyPayrollBase, prepareDailyPayrollInputs } from './payroll-daily-calculation';
import { aggregatePayrollOneCControlSlices, isPayrollOneCControlSlice, listDates } from './payroll-one-c-control-snapshots';
import { buildPayrollSalesCompactSnapshot, type PayrollSalesClassificationRule } from './payroll-sales-classification';
import { buildPayrollPurchaseSupplierPreview } from './payroll-purchase-suppliers';
import { readPayrollAttendanceSnapshotPayload } from './payroll-attendance-snapshot';
import { payrollDraftForAutomaticEstimate, validatePayrollDraft } from './payroll-draft';
import { validatePayrollBonuses } from './payroll-compensation';
import { overlayApprovedDays } from './payroll-day-review-store';
import { payrollReviewPresentation } from './payroll-review-presentation';
import { homePayrollAggregate } from './admin-home-payroll-source';
import type { HomeAction, HomePayroll } from './admin-home';

/** ADMIN summary uses the same persisted sources and pure engine as PayrollClient.
 * Unsaved browser edits are intentionally not a second server source of truth. */
export async function loadHomePayroll(now=new Date()):Promise<HomePayroll> {
 const period=getMoscowDateKey(now).slice(0,7);
 const source=await prisma.$transaction(async tx=>{
  const [users,slices,attendance,saved,finbox,rules,suppliers,run,aggregate]=await Promise.all([
   tx.user.findMany(),
   tx.payrollOneCControlSnapshot.findMany({where:{periodKey:period,kind:'DAILY'},orderBy:{dateFrom:'asc'}}),
   tx.payrollAttendanceSnapshot.findUnique({where:{periodKey:period}}),
   tx.payrollDraftRevision.findFirst({where:{periodKey:period},orderBy:{revision:'desc'}}),
   tx.payrollFinboxRevision.findFirst({where:{periodKey:period},orderBy:{revision:'desc'}}),
   tx.payrollClassificationRule.findMany({orderBy:[{priority:'asc'},{id:'asc'}]}),
   tx.payrollPurchaseSupplierRule.findMany({orderBy:[{isActive:'desc'},{supplierName:'asc'}]}),
   tx.payrollRun.findFirst({where:{period:{periodKey:period},status:{in:['FINAL','DRAFT']}},orderBy:[{status:'desc'},{createdAt:'desc'}],include:{employeeResults:true}}),
   tx.payrollOneCControlSnapshot.findFirst({where:{periodKey:period,kind:'AGGREGATE_DAILY'},orderBy:{updatedAt:'desc'},select:{payload:true}}),
  ]);
  const raw=attendance?readPayrollAttendanceSnapshotPayload(attendance.payload,period):null;
  return {users,slices,attendance,attended:raw?await overlayApprovedDays(tx,raw):null,saved,finbox,rules,suppliers,run,aggregate};
 },{isolationLevel:'RepeatableRead'});
 const base:HomePayroll={period,amount:null,through:null,sourceAt:null,provisional:true,label:'Данные расчёта не получены',reviews:[],missing:[],names:[]};
 if(source.run?.status==='FINAL')return {...base,amount:source.run.grossPay,provisional:false,label:'Финальная ведомость',sourceAt:source.run.updatedAt.toISOString(),names:source.run.employeeResults.map(r=>r.employeeName)};
 const valid=source.slices.filter(row=>isPayrollOneCControlSlice(row.payload));
 const aggregate=homePayrollAggregate(source.aggregate?.payload,period,source.suppliers,source.slices,getMoscowDateKey(now));
 const through=aggregate?.period.verifiedThrough??valid.at(-1)?.dateTo;
 const complete=through&&valid.length===source.slices.length&&listDates(`${period}-01`,through).every((date,index)=>valid[index]?.dateFrom===date&&valid[index]?.dateTo===date)&&listDates(`${period}-01`,through).length===valid.length;
 if(!aggregate&&!complete){
  // A saved working run is dated evidence, never relabelled a fresh calculation.
  if(!source.run)return base;
  const issues=source.run.employeeResults.flatMap(row=>Array.isArray(row.reasons)?row.reasons.filter((reason):reason is string=>typeof reason==='string').map((reason,i)=>({id:`saved-${row.id}-${i}`,title:row.employeeName,detail:reason,href:`/admin/payroll?period=${period}`})):[]);
  const summary=source.run.sourceSummary as {through?:string}|null;
  return {...base,amount:source.run.grossPay,label:'Сохранённый рабочий расчёт',through:summary?.through&&/^20\d{2}-\d{2}-\d{2}$/.test(summary.through)&&summary.through.startsWith(period)?summary.through:null,sourceAt:source.run.updatedAt.toISOString(),reviews:issues.filter(row=>/классифи|поставщик/iu.test(row.detail)).map(row=>({...row,title:`Администратору: ${payrollReviewPresentation(row.detail).action.charAt(0).toLocaleLowerCase('ru-RU')+payrollReviewPresentation(row.detail).action.slice(1)}`})),missing:issues.filter(row=>!/классифи|поставщик/iu.test(row.detail)),names:source.run.employeeResults.map(r=>r.employeeName)};
 }
 const combined=aggregate??aggregatePayrollOneCControlSlices(valid.map(row=>{if(!isPayrollOneCControlSlice(row.payload))throw Error('Invalid payroll slice');return row.payload;}));
 const compact=buildPayrollSalesCompactSnapshot(combined.sales.rows.map(row=>({...row,registrar:'',registrars:[],profitability:row.revenue?row.grossProfit/row.revenue*100:0,sourceCostReviewRows:row.costReviewRows,sourceCostCalculationPendingRows:row.costCalculationPendingRows})),source.rules as unknown as PayrollSalesClassificationRule[],period);
 const directory=buildPayrollEmployeeDirectory(source.users,period,new Set(compact.managerSummaries.map(row=>row.manager)),true);
 const draft=validatePayrollDraft(payrollDraftForAutomaticEstimate(period,source.saved,now)!.payload);
 const purchase=aggregate?.purchases??buildPayrollPurchaseSupplierPreview('settlements' in combined.purchases?combined.purchases.settlements:[],source.suppliers);
 const attendance=source.attended&&source.attendance?{...source.attended,snapshot:{servedFrom:'stored' as const,sourceCheckedAt:source.attendance.sourceCheckedAt.toISOString(),savedAt:source.attendance.updatedAt.toISOString()}}:null;
 const manual=prepareDailyPayrollInputs({directory,manual:draft.manual,attendance,periodKey:period,finboxAmount:source.finbox?(source.finbox.amountCents/100).toFixed(2):null});
 const rows=buildDailyPayrollBase({periodKey:period,directory,users:source.users,summaries:compact.managerSummaries,manual,fixed:draft.fixed,purchase:draft.purchase,purchaseBase:purchase.approvedBase,attendance});
 const result=applyPayrollBonuses(rows,validatePayrollBonuses(draft.bonuses,rows.map(row=>row.manager)));
 const messages=[...(compact.unresolvedRows?['Нужно выбрать правила классификации товаров']:[]),...(!purchase.ready?['Нужно проверить поставщиков закупок']:[]),...(!source.attended?['Не обновлены дни и опоздания']:[])];
 const href=`/admin/payroll?period=${period}`;
 const reviews:HomeAction[]=messages.map((message,i)=>{const view=payrollReviewPresentation(message);return{id:`payroll-rule-${i}`,title:`Администратору: ${view.action.charAt(0).toLocaleLowerCase('ru-RU')+view.action.slice(1)}`,detail:view.reason,href};});
 const missing:HomeAction[]=result.flatMap(row=>row.payrollReasons.map((reason,i)=>({id:`payroll-${row.manager}-${i}`,title:row.manager,detail:reason,href})));
 return {...base,amount:Math.round(result.reduce((sum,row)=>sum+row.grossPay,0)*100)/100,through:through!,sourceAt:aggregate?.snapshot.storedAt??source.slices.map(row=>row.updatedAt.toISOString()).sort().at(-1)??null,label:'Предварительные начисления',reviews,missing,names:result.map(row=>row.manager)};
}
