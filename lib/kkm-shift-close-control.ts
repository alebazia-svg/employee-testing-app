import 'server-only';
import { kkmCloseConfirmation } from './kkm-close-confirmation';

import type { Prisma, PrismaClient } from '@prisma/client';
import { getCashShifts } from '@/lib/one-c';
import { loadOneCKkmChecks, loadPlatformaOfdZReports, loadPlatformaOfdReceipts, type PlatformaOfdZReport } from '@/lib/terminal-fiscal-sources';
import { resolveObsoleteKkmRequests } from '@/lib/workday-kkm-exception-resolution';
import {resolveKkmCloseWorkplace} from './kkm-close-workplace';
import {loadKkmCloseReports} from './kkm-close-report-cache';
import { loadKkmShiftActivity, proveKkmNotOpened, proveKkmNotOpenedInOneC, type KkmNotOpenedProof, type KkmOneCNotOpenedProof } from './kkm-not-opened';

type Db = PrismaClient | Prisma.TransactionClient;

export function firstKkmCloseEvidence(previous: unknown, evidence: KkmShiftCloseEvidence) {
  const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const source=record(previous);
  for(const value of [source.firstEvidence,source.evidence]){const saved=record(value);if(typeof saved.checkedAt==='string'&&Number.isFinite(Date.parse(saved.checkedAt))&&typeof saved.status==='string')return saved;}
  return evidence;
}

export type KkmShiftCloseEvidence = {
  status: 'confirmed' | 'not_opened' | 'one_c_not_opened' | 'one_c_open' | 'ofd_missing' | 'unavailable';
  notOpenedProof?: KkmNotOpenedProof;
  oneCNotOpenedProof?: KkmOneCNotOpenedProof;
  checkedAt: string;
  cashierRef: string;
  cashRegisterRef: string;
  cashRegisterName: string;
  kktRegistrationNumber: string;
  oneCShiftNumber: string;
  fiscalShiftNumber: string;
  oneCOpenedAt: string;
  oneCClosedAt: string;
  ofdOpenedAt: string;
  ofdClosedAt: string;
  ofdDocumentLink: string;
  ofdClosures?: Array<{ shiftNumber: string; openedAt: string; closedAt: string }>;
  lastFiscalCheck?: { sourceRef: string; sourceType: string; fiscalDocumentNumber: string; fiscalDateTime: string; documentDateTime: string };
  sourceError: string;
  workplaceBasis?: string;
  ofdReceiptRead?: {checkedAt:string;complete:boolean;newerReceipts:number;lastReceiptAt?:string;fiscalDriveNumber?:string;fiscalDocumentNumber?:string;fiscalShiftNumber?:string};
  ofdRead?: { storedEvidence?: boolean; liveReadComplete?: boolean; requestedAt: string; receivedAt: string; providerFetchedAt?: string; durationMs: number; complete: boolean; fromCache: boolean; shiftNumbers: string[]; errorCode?: string };
  simulated?: boolean;
};

export type KkmShiftCloseSimulationScenario = 'confirmed' | 'delayed' | 'one_c_open' | 'ofd_missing' | 'one_c_unavailable' | 'ofd_unavailable';
export type KkmShiftCloseSimulation = { scenario: KkmShiftCloseSimulationScenario; activatedAt: string };

const simulationScenarios = new Set<KkmShiftCloseSimulationScenario>(['confirmed', 'delayed', 'one_c_open', 'ofd_missing', 'one_c_unavailable', 'ofd_unavailable']);

export function readKkmShiftCloseSimulation(value: unknown): KkmShiftCloseSimulation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.scenario !== 'string' || !simulationScenarios.has(source.scenario as KkmShiftCloseSimulationScenario)) return null;
  if (typeof source.activatedAt !== 'string' || !Number.isFinite(Date.parse(source.activatedAt))) return null;
  return { scenario: source.scenario as KkmShiftCloseSimulationScenario, activatedAt: source.activatedAt };
}

export function simulateKkmShiftClose(simulation: KkmShiftCloseSimulation, now = new Date()): KkmShiftCloseEvidence {
  const common = {
    checkedAt: now.toISOString(), cashierRef: 'DEV-CASHIER', cashRegisterRef: 'DEV-CASHBOX', cashRegisterName: 'Тестовая касса',
    kktRegistrationNumber: '0000000000000000', oneCShiftNumber: 'DEV-1', fiscalShiftNumber: '777',
    oneCOpenedAt: simulation.activatedAt, oneCClosedAt: now.toISOString(), ofdOpenedAt: '', ofdClosedAt: '', ofdDocumentLink: '', simulated: true as const,
  };
  const delayedConfirmed = simulation.scenario === 'delayed' && now.getTime() - Date.parse(simulation.activatedAt) >= 45_000;
  if (simulation.scenario === 'confirmed' || delayedConfirmed) return { ...common, status: 'confirmed', ofdOpenedAt: simulation.activatedAt, ofdClosedAt: now.toISOString(), ofdDocumentLink: 'dev://z-report', sourceError: '' };
  if (simulation.scenario === 'one_c_open') return { ...common, oneCClosedAt: '', status: 'one_c_open', sourceError: 'Dev/Test: смена в 1С осталась открыта.' };
  if (simulation.scenario === 'one_c_unavailable') return { ...common, oneCClosedAt: '', status: 'unavailable', sourceError: 'Dev/Test: 1С временно недоступна.' };
  if (simulation.scenario === 'ofd_unavailable') return { ...common, status: 'unavailable', sourceError: 'Dev/Test: сервис проверки чеков временно недоступен.' };
  return { ...common, status: 'ofd_missing', sourceError: 'Dev/Test: чек закрытия смены не найден.' };
}

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00+03:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
}

function moscowPeriod(date: string) {
  return { from: `${date}T00:00:00+03:00`, to: `${nextDate(date)}T00:00:00+03:00` };
}

export function kkmShiftCloseOneCPeriod(date: string) {
  return { fromDate: date, toDate: nextDate(date) };
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Source-only warmup before the existing receipt/cash handover checks. */
export async function prefetchEmployeeKkmClose(db:Db,userId:number,date:string) {
  const place=await resolveKkmCloseWorkplace(db,userId,date);
  if(place)await loadKkmCloseReports({kktRegistrationNumber:place.kktRegistrationNumber,...moscowPeriod(date)});
}

export async function verifyEmployeeKkmShiftClose(input: { db: Db; userId: number; date: string; simulation?: KkmShiftCloseSimulation | null }, sources: {loadOneCKkmChecks:typeof loadOneCKkmChecks;getCashShifts:typeof getCashShifts;loadPlatformaOfdZReports:typeof loadKkmCloseReports;loadPlatformaOfdReceipts?:typeof loadPlatformaOfdReceipts;loadKkmShiftActivity?:typeof loadKkmShiftActivity} = { loadOneCKkmChecks, getCashShifts, loadPlatformaOfdZReports: loadKkmCloseReports, loadPlatformaOfdReceipts, loadKkmShiftActivity }): Promise<KkmShiftCloseEvidence> {
  const checkedAt = new Date().toISOString();
  const empty = { checkedAt, cashierRef: '', cashRegisterRef: '', cashRegisterName: '', kktRegistrationNumber: '', oneCShiftNumber: '', fiscalShiftNumber: '', oneCOpenedAt: '', oneCClosedAt: '', ofdOpenedAt: '', ofdClosedAt: '', ofdDocumentLink: '' };
  const identity = await input.db.userOneCCashboxMapping.findUnique({ where: { userId: input.userId } });
  const cashierRef = identity?.oneCCashierRef?.trim() || '';
  if (!cashierRef) return { ...empty, status: 'unavailable', sourceError: 'Кассир сотрудника не сопоставлен с 1С.' };

  // Start OFD immediately for the agreed workplace. 1C supplies independent
  // device/receipt/reopening guards; its document closure is never a prerequisite.
  const knownWorkplace = 'terminalFiscalMapping' in input.db
    ? await resolveKkmCloseWorkplace(input.db,input.userId,input.date) : null;
  const period = moscowPeriod(input.date);
  const readOfd = async (kktRegistrationNumber: string) => {
    const requestedAt = new Date().toISOString(), start = Date.now();
    const snapshot = await sources.loadPlatformaOfdZReports({kktRegistrationNumber,...period})
      .catch(()=>({complete:false as const,checkedAt:requestedAt,data:[],errorCode:'OFD_REQUEST_FAILED'}));
    return {snapshot,observation:{requestedAt,receivedAt:new Date().toISOString(),durationMs:Date.now()-start,
      ...('storedEvidence' in snapshot&&snapshot.storedEvidence?{storedEvidence:true,liveReadComplete:snapshot.liveReadComplete}:{}),
      complete:snapshot.complete,fromCache:'fromCache' in snapshot&&snapshot.fromCache===true,
      ...('providerFetchedAt' in snapshot&&typeof snapshot.providerFetchedAt==='string'?{providerFetchedAt:snapshot.providerFetchedAt}:{}),
      shiftNumbers:snapshot.data.map(row=>row.shiftNumber),...(snapshot.errorCode?{errorCode:snapshot.errorCode}:{})}};
  };
  const earlyOfd = knownWorkplace ? readOfd(knownWorkplace.kktRegistrationNumber) : null;
  const shiftsPending = sources.getCashShifts(input.date).catch(() => ({ ok: false as const, dateFrom: input.date, dateTo: input.date, shifts: [], error: 'ONE_C_REQUEST_FAILED' }));
  const checksStarted=Date.now();
  const readChecks=()=>sources.loadOneCKkmChecks({...kkmShiftCloseOneCPeriod(input.date),timeoutMs:3000}).catch(() => ({ complete: false as const, checkedAt, data: [], errorCode: 'ONE_C_REQUEST_FAILED' }));
  let checks = await readChecks();
  if(!checks.complete&&Date.now()-checksStarted<1000){await new Promise(resolve=>setTimeout(resolve,200));checks=await readChecks();}
  const shifts = await shiftsPending;
  if (!checks.complete) return { ...empty, cashierRef,...(earlyOfd?{ofdRead:(await earlyOfd).observation}:{}), status: 'unavailable', sourceError: 'Не удалось получить полный список чеков 1С.' };
  const employeeChecks = checks.data.filter((check) => check.cashier.ref === cashierRef).sort((a, b) => Date.parse(a.fiscalDateTime || a.dateTime) - Date.parse(b.fiscalDateTime || b.dateTime));
  const lastCheck = employeeChecks.at(-1) ?? null;
  const completeCheckIdentity=Boolean(lastCheck?.cashRegisterRef&&lastCheck.kktRegistrationNumber);
  const workplace = !completeCheckIdentity && 'terminalFiscalMapping' in input.db
    ? knownWorkplace : null;
  if(workplace&&lastCheck&&((lastCheck.cashRegisterRef&&lastCheck.cashRegisterRef!==workplace.cashRegisterRef)
    ||(lastCheck.kktRegistrationNumber&&lastCheck.kktRegistrationNumber!==workplace.kktRegistrationNumber))) {
    return {...empty,cashierRef,status:'unavailable',sourceError:'Данные чека и рабочего места указывают разные ККТ. Требуется однозначное подтверждение.'};
  }
  const cashRegisterRef=(completeCheckIdentity?lastCheck?.cashRegisterRef:workplace?.cashRegisterRef)||'';
  const kktRegistrationNumber=(completeCheckIdentity?lastCheck?.kktRegistrationNumber:workplace?.kktRegistrationNumber)||'';
  if (!cashRegisterRef || !kktRegistrationNumber) {
    return { ...empty, cashierRef, status: 'unavailable', sourceError: 'По чекам 1С не удалось определить ККТ сотрудника за этот день.' };
  }

  const candidates = (shifts.ok ? shifts.shifts : []).filter((shift) => shift.cashRegister.ref === cashRegisterRef && shift.posted !== false && shift.deletionMark !== true);
  const shift = [...candidates].sort((a, b) => Date.parse(b.closedAt || b.openedAt || b.datetime) - Date.parse(a.closedAt || a.openedAt || a.datetime))[0] ?? null;
  const common = { ...empty, cashierRef, cashRegisterRef, cashRegisterName: shift?.cashRegister.name || '', kktRegistrationNumber, oneCShiftNumber: shift?.number || '', fiscalShiftNumber: shift?.fiscalShiftNumber || '', oneCOpenedAt: shift?.openedAt || '', oneCClosedAt: shift?.closedAt || '',...(workplace?{workplaceBasis:workplace.basis}:{}) };
  const oneCClosed = Boolean(shift?.closedAt) && normalized(shift?.status || '').includes('закрыт');

  const noOpeningScope = async () => {
    if (!workplace || lastCheck) return null;
    const day = await input.db.workDayEntry.findUnique({ where: { userId_date: { userId: input.userId, date: input.date } } });
    if (!day?.startedAt) return null;
    const through = new Date(Math.min(Date.now(), Date.parse(period.to) - 1, day.endedAt ? +day.endedAt : Infinity)).toISOString();
    const assignments = await input.db.workdayKkmAssignment.findMany({ where: { userId: input.userId, date: input.date,
      effectiveFrom: { lte: new Date(through) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: day.startedAt } }] } });
    if (!assignments.every(a => a.kkmMode !== 'server' && a.oneCCashRegisterRef === cashRegisterRef)) return null;
    return { through, historyFrom: new Date(Date.parse(period.from) - 6 * 86_400_000).toISOString() };
  };
  const oneCFallback = async () => {
    const scope = await noOpeningScope();
    if (!scope) return null;
    const historyShifts = await sources.getCashShifts(new Date(scope.historyFrom).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }), input.date).catch(() => null);
    const proof = historyShifts ? proveKkmNotOpenedInOneC({ cashRegisterRef, kktRegistrationNumber, from: period.from,
      through: scope.through, shifts: historyShifts, checks }) : null;
    return proof ? { ...common, status: 'one_c_not_opened' as const, oneCNotOpenedProof: proof,
      sourceError: 'ОФД недоступен. По полным данным 1С кассовая смена не открывалась; подтверждение ОФД ожидается.' } : null;
  };

  const loadedOfd = earlyOfd && kktRegistrationNumber===knownWorkplace?.kktRegistrationNumber
    ? await earlyOfd : await readOfd(kktRegistrationNumber);
  const ofd=loadedOfd.snapshot;
  Object.assign(common,{ofdRead:loadedOfd.observation});
  if (!ofd.complete) {
    // Transport failure alone permits the explicitly provisional 1C fallback.
    // A returned malformed/open OFD shift is not an unavailable provider.
    if (ofd.errorCode === 'OFD_REQUEST_FAILED' || ofd.errorCode === 'OFD_PROXY_NOT_CONFIGURED') {
      const fallback = await oneCFallback();
      if (fallback) return fallback;
    }
    return { ...common, status: 'unavailable', sourceError: 'Платформа OFD временно не ответила полностью.' };
  }
  const refreshCached = () => verifyEmployeeKkmShiftClose(input,{...sources,loadPlatformaOfdZReports:arg=>sources.loadPlatformaOfdZReports(arg,{force:true})});
  const cached = 'fromCache' in ofd && ofd.fromCache===true && !('storedEvidence' in ofd&&ofd.storedEvidence);
  // Read the fiscal stream after the earliest saved closure, not the delayed 1C receipt stream.
  let latestOfdReceipt:Awaited<ReturnType<typeof loadPlatformaOfdReceipts>>['data'][number]|undefined;
  if(sources.loadPlatformaOfdReceipts&&ofd.data.length){
    const from=ofd.data.map(r=>r.closedAt).sort((a,b)=>Date.parse(a)-Date.parse(b))[0];
    const receipts=await sources.loadPlatformaOfdReceipts({kktRegistrationNumber,from,to:period.to},{attempts:1,timeoutMs:3000})
      .catch(()=>({complete:false,checkedAt:new Date().toISOString(),data:[]}));
    const invalid=receipts.data.some(r=>r.kktRegistrationNumber!==kktRegistrationNumber||!r.fiscalDriveNumber
      ||!r.fiscalDocumentNumber||!r.fiscalSign||!Number.isFinite(Date.parse(r.receiptAt)));
    Object.assign(common,{ofdReceiptRead:{checkedAt:receipts.checkedAt,complete:receipts.complete,newerReceipts:receipts.data.length}});
    if(!receipts.complete||invalid)return {...common,status:'unavailable',sourceError:'Не удалось проверить новые чеки ОФД. Подтвердите закрытие чеком; автоматическая сверка продолжится.'};
    latestOfdReceipt=[...receipts.data].sort((a,b)=>{
      const time=Date.parse(a.receiptAt)-Date.parse(b.receiptAt);if(time)return time;
      if(a.fiscalDriveNumber===b.fiscalDriveNumber&&/^\d+$/.test(a.fiscalDocumentNumber)&&/^\d+$/.test(b.fiscalDocumentNumber))
        return BigInt(a.fiscalDocumentNumber)<BigInt(b.fiscalDocumentNumber)?-1:BigInt(a.fiscalDocumentNumber)>BigInt(b.fiscalDocumentNumber)?1:0;
      return 0;
    }).at(-1);
    if(latestOfdReceipt)Object.assign(common,{ofdReceiptRead:{checkedAt:receipts.checkedAt,complete:true,newerReceipts:receipts.data.length,lastReceiptAt:latestOfdReceipt.receiptAt,fiscalDriveNumber:latestOfdReceipt.fiscalDriveNumber,fiscalDocumentNumber:latestOfdReceipt.fiscalDocumentNumber,...(latestOfdReceipt.fiscalShiftNumber?{fiscalShiftNumber:latestOfdReceipt.fiscalShiftNumber}:{})}});
    if(latestOfdReceipt&&receipts.data.some(r=>r.receiptAt===latestOfdReceipt!.receiptAt&&(r.fiscalDriveNumber!==latestOfdReceipt!.fiscalDriveNumber
      ||receipts.data.filter(x=>x.receiptAt===r.receiptAt).length>1&&!/^\d+$/.test(r.fiscalDocumentNumber)
      ||r.fiscalDocumentNumber===latestOfdReceipt!.fiscalDocumentNumber&&(r.fiscalSign!==latestOfdReceipt!.fiscalSign||r.fiscalShiftNumber!==latestOfdReceipt!.fiscalShiftNumber))))
      return {...common,status:'unavailable',sourceError:'Последний чек ОФД неоднозначен. Автоматическая сверка продолжится.'};
  }
  if (!latestOfdReceipt && !lastCheck && !checks.data.some(c=>c.kktRegistrationNumber===kktRegistrationNumber)) {
    const reports=ofd.data.filter(r=>r.kktRegistrationNumber===kktRegistrationNumber&&r.fiscalDriveNumber
      &&r.shiftNumber===shift?.fiscalShiftNumber&&Date.parse(r.openedAt)<=Date.parse(r.closedAt)
      &&Date.parse(r.closedAt)>=Date.parse(period.from)&&Date.parse(r.closedAt)<Date.parse(period.to));
    if(reports.length===1){const r=reports[0];return {...common,status:'confirmed',ofdOpenedAt:r.openedAt,ofdClosedAt:r.closedAt,ofdDocumentLink:r.documentLink,ofdClosures:[{shiftNumber:r.shiftNumber,openedAt:r.openedAt,closedAt:r.closedAt}],sourceError:''};}
    if (workplace && sources.loadKkmShiftActivity && sources.loadPlatformaOfdReceipts && shifts.ok && 'complete' in shifts && shifts.complete === true
      && !shifts.shifts.some(s => s.cashRegister.ref === cashRegisterRef && s.deletionMark !== true)) {
      const scope = await noOpeningScope();
      if (scope) {
        // Seven days supply a recent last CLOSED fiscal anchor. If no anchor is
        // available, remain unavailable rather than assuming a carried shift away.
        const [activity, receipts] = await Promise.all([
          sources.loadKkmShiftActivity({ kktRegistrationNumber, from: scope.historyFrom, to: period.to }).catch(() => null),
          sources.loadPlatformaOfdReceipts({ kktRegistrationNumber, ...period }, { attempts: 1, timeoutMs: 3000 }).catch(() => null),
        ]);
        const proof = activity && receipts ? proveKkmNotOpened({ cashRegisterRef, kktRegistrationNumber, from: period.from, through: scope.through,
          activity, receipts, shifts, checks, existingReports: ofd.data, now: new Date() }) : null;
        if (proof) return { ...common, status: 'not_opened', notOpenedProof: proof, sourceError: '' };
        if (activity?.errorCode === 'OFD_OPENING_EVIDENCE_UNAVAILABLE') {
          const fallback = await oneCFallback();
          if (fallback) return fallback;
        }
      }
    }
    if(cached)return refreshCached();
    return {...common,status:'unavailable',sourceError:'Проверяем закрытие кассы по рабочему месту. Однозначное подтверждение ОФД пока не получено.'};
  }
  // The same physical KKT and fiscal shift may already be closed even while 1C lags.
  // Never accept another shift or a closing report older than the employee's last check.
  // Compare KKT events on the fiscal clock: the 1C document clock can be ahead
  // of the receipt and Z-report. Without fiscal evidence remain conservative.
  const kktChecks = checks.data.filter(c => c.kktRegistrationNumber === kktRegistrationNumber);
  const latestOneCCheckAt = Math.max(...kktChecks.map(c => Date.parse(c.fiscalDateTime || c.dateTime)));
  const ofdIsLatest=Boolean(latestOfdReceipt&&Date.parse(latestOfdReceipt.receiptAt)>=latestOneCCheckAt);
  const latestKktCheckAt = Math.max(latestOneCCheckAt,latestOfdReceipt?Date.parse(latestOfdReceipt.receiptAt):-Infinity);
  const latestChecks = kktChecks.filter(c => Date.parse(c.fiscalDateTime || c.dateTime) === latestOneCCheckAt);
  const latestCheck = latestChecks.at(-1);
  const fiscalIdentity = ofdIsLatest || Boolean(latestCheck?.fiscalDateTime && latestCheck.fiscalDriveNumber
    && latestCheck.fiscalDocumentNumber && latestCheck.fiscalSign && !latestCheck.fiscalConflict);
  // A credit realization may omit cashier and 1C KKM refs. The employee's own
  // check establishes the KKT; the final exact fiscal receipt establishes which
  // reopened shift must be closed. Never attribute that receipt to the employee.
  if (!Number.isFinite(latestKktCheckAt) || (!latestCheck&&!ofdIsLatest) || latestChecks.some(c => c.fiscalConflict)
    || new Set(latestChecks.flatMap(c => c.fiscalDriveNumber ? [c.fiscalDriveNumber] : [])).size > 1
    || latestCheck !== lastCheck && !fiscalIdentity) {
    return { ...common, status: 'unavailable', sourceError: 'Последний чек этой ККТ не удалось однозначно связать с фискальной сменой. Сверка повторится автоматически.' };
  }
  const fiscalDriveNumber = ofdIsLatest?latestOfdReceipt!.fiscalDriveNumber:latestCheck?.fiscalDriveNumber || lastCheck?.fiscalDriveNumber;
  const validReport = (item: PlatformaOfdZReport) => item.kktRegistrationNumber === kktRegistrationNumber
    && Number.isFinite(Date.parse(item.closedAt))
    && Date.parse(item.openedAt) <= Date.parse(item.closedAt)
    && Date.parse(item.closedAt) >= latestKktCheckAt
    && (!fiscalDriveNumber || item.fiscalDriveNumber === fiscalDriveNumber)
    && Date.parse(item.closedAt) >= Date.parse(period.from)
    && Date.parse(item.closedAt) < Date.parse(period.to);
  const receiptShift=ofdIsLatest?latestOfdReceipt?.fiscalShiftNumber:undefined;
  const matchesReceiptShift=(item:PlatformaOfdZReport)=>!receiptShift||item.shiftNumber===receiptShift;
  const coveringReports = ofd.data.filter(item => validReport(item) && matchesReceiptShift(item) && Date.parse(item.openedAt) <= latestKktCheckAt);
  if (fiscalIdentity && coveringReports.length > 1) return { ...common, status: 'unavailable', sourceError: 'ОФД вернул неоднозначное подтверждение смены. Сверка повторится автоматически.' };
  const exactReports = ofd.data.filter(item => Boolean(shift?.fiscalShiftNumber)
    && item.shiftNumber === shift?.fiscalShiftNumber && validReport(item)
    && (matchesReceiptShift(item) && Date.parse(item.openedAt) <= latestKktCheckAt
      // Reopening and closing an empty shift is also legitimate. Its exact 1C
      // fiscal number and the preceding OFD closure establish the sequence.
      || fiscalIdentity && coveringReports.some(prior => prior.shiftNumber !== item.shiftNumber
        && Date.parse(prior.closedAt) <= Date.parse(item.openedAt))));
  if (exactReports.length > 1) return { ...common, status: 'unavailable', sourceError: 'ОФД вернул неоднозначное подтверждение смены. Сверка повторится автоматически.' };
  let report: PlatformaOfdZReport | null = exactReports[0] ?? null;
  if (!report && fiscalIdentity) {
    // A 1C shift's fiscal identity can lag behind the actual fiscal evidence.
    // Bind the actual fiscal receipt to one unique OFD shift on the same FN/KKT.
    // Include other cashiers' later checks on this physical KKT in the time guard.
    const fiscalReports = coveringReports;
    if (fiscalReports.length === 1) {
      report = fiscalReports[0];
    }
  }
  // The fiscal date is the KKT clock, unlike the later 1C document timestamp.
  if(report&&shift?.fiscalShiftNumber&&shift.fiscalShiftNumber!==report.shiftNumber
    &&Date.parse(shift.fiscalShiftDate)>Date.parse(report.closedAt))report=null;
  const exactEmptyReopening=Boolean(report&&receiptShift&&shift?.fiscalShiftNumber===report.shiftNumber&&coveringReports.some(prior=>prior.shiftNumber!==report!.shiftNumber&&Date.parse(prior.closedAt)<=Date.parse(report!.openedAt)));
  if(report&&ofdIsLatest&&latestOfdReceipt?.receiptAt===report.closedAt&&(!receiptShift||!matchesReceiptShift(report)&&!exactEmptyReopening))return {...common,status:'unavailable',sourceError:'Время нового чека и закрытия ОФД совпало. Однозначное подтверждение пока не получено.'};
  if(!report&&cached)return refreshCached();
  if (!report && !oneCClosed) return { ...common, status: 'unavailable', sourceError: 'Закрытие ОФД пока не подтверждено. Открытый или запаздывающий документ 1С не доказывает, что касса не закрыта. Портал повторит проверку автоматически.' };
  if (!report) return { ...common, status: 'ofd_missing', sourceError: '1С закрыла смену, но Z‑отчёт этой ККТ не найден в OFD.' };
  const ofdClosures = ofd.data.filter(item => item.kktRegistrationNumber === report.kktRegistrationNumber
    && item.fiscalDriveNumber === report.fiscalDriveNumber && item.shiftNumber
    && Date.parse(item.openedAt) <= Date.parse(item.closedAt)
    && Date.parse(item.closedAt) >= Date.parse(period.from)
    && Date.parse(item.closedAt) <= Date.parse(report.closedAt))
    .sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt))
    .map(({ shiftNumber, openedAt, closedAt }) => ({ shiftNumber, openedAt, closedAt }));
  return { ...common, status: 'confirmed', fiscalShiftNumber: report.shiftNumber, ofdOpenedAt: report.openedAt, ofdClosedAt: report.closedAt, ofdDocumentLink: report.documentLink, ofdClosures,
    ...(fiscalIdentity && latestCheck ? { lastFiscalCheck: { sourceRef: latestCheck.sourceRef, sourceType: latestCheck.sourceType, fiscalDocumentNumber: latestCheck.fiscalDocumentNumber!, fiscalDateTime: latestCheck.fiscalDateTime!, documentDateTime: latestCheck.dateTime } } : {}), sourceError: '' };
}

export function kkmShiftCloseFingerprint(workDayEntryId: number) {
  return `kkm-shift-close:${workDayEntryId}`;
}

export function kkmShiftCloseRequiresEmployeeAction(evidence: KkmShiftCloseEvidence) {
  return evidence.status === 'one_c_open' || evidence.status === 'ofd_missing';
}

type KkmSyncInput = { userId:number; taskId:number; workDayEntryId:number; date:string; evidence:KkmShiftCloseEvidence; now:Date; confirmationMethod?:'photo'|'not_printed'; workdayCompleted?:boolean; expectedTaskUpdatedAt?:Date; expectedHandoverData?:unknown };

// Network reads happen before this short transaction. Use the same workday-first
// lock order as employee/admin completion, then read the current employee response.
async function applyKkmShiftCloseIssue(db:Db,input:KkmSyncInput) {
  const apply = async (tx:Db) => {
    let currentInput=input;
    if (typeof tx.$queryRaw==='function') {
      await tx.$queryRaw`SELECT id FROM "WorkDayEntry" WHERE id = ${input.workDayEntryId} FOR UPDATE`;
      const task=await tx.shiftControlTask.findUnique({where:{id:input.taskId},include:{run:{include:{workDayEntry:true}}}});
      if (!task || task.run.userId!==input.userId || task.run.workDayEntryId!==input.workDayEntryId) return {applied:false,issue:null};
      if (input.expectedTaskUpdatedAt && +task.updatedAt!==+input.expectedTaskUpdatedAt || 'expectedHandoverData' in input && JSON.stringify(task.handoverData)!==JSON.stringify(input.expectedHandoverData)) return {applied:false,issue:null};
      const confirmation=kkmCloseConfirmation(task.handoverData);
      currentInput={...input,confirmationMethod:confirmation?.userId===input.userId?confirmation.method:undefined,workdayCompleted:Boolean(task.run.workDayEntry.endedAt || task.run.workDayEntry.status==='completed')};
      if (kkmShiftCloseAllowsHandover(input.evidence) && task.category==='handover') {
        const data=task.handoverData && typeof task.handoverData==='object' && !Array.isArray(task.handoverData)?task.handoverData as Record<string,unknown>:{};
        const prior=data.kkmCloseCheck && typeof data.kkmCloseCheck==='object' && !Array.isArray(data.kkmCloseCheck)?data.kkmCloseCheck as Record<string,unknown>:{};
        if (prior.status!==input.evidence.status || prior.checkedAt!==input.evidence.checkedAt) {
          const saved=await tx.shiftControlTask.updateMany({where:{id:task.id,updatedAt:task.updatedAt},data:{handoverData:{...data,kkmCloseCheck:{...prior,status:input.evidence.status,checkedAt:input.evidence.checkedAt,evidence:input.evidence,firstEvidence:firstKkmCloseEvidence(prior,input.evidence)}} as unknown as Prisma.InputJsonValue}});
          if(!saved.count)return {applied:false,issue:null};
        }
      }
    }
    return {applied:true,issue:await syncKkmShiftCloseIssueSource(tx,currentInput)};
  };
  return '$transaction' in db ? db.$transaction(tx=>apply(tx)) : apply(db);
}
export async function syncKkmShiftCloseIssue(db:Db,input:KkmSyncInput) { return (await applyKkmShiftCloseIssue(db,input)).issue; }

async function syncKkmShiftCloseIssueSource(db:Db,input:KkmSyncInput) {
  const fingerprint = kkmShiftCloseFingerprint(input.workDayEntryId);
  const existing = await db.workdayControlIssue.findUnique({ where: { fingerprint } });
  if (kkmShiftCloseSatisfied(input.evidence)) {
    if (existing?.status === 'open') {
      await db.workdayControlIssue.update({ where: { id: existing.id }, data: { status: 'resolved', resolvedAt: input.now, lastDetectedAt: input.now, nextReminderAt: null, sourceData: input.evidence as unknown as Prisma.InputJsonValue } });
      await db.workdayNotification.updateMany({ where: { issueId: existing.id, status: 'pending' }, data: { status: 'cancelled' } });
    }
    if (existing && ['open', 'resolved'].includes(existing.status)) {
      await resolveObsoleteKkmRequests(db, input.userId, existing.id);
    }
    return null;
  }
  const provisionalNoOpening = input.evidence.status === 'one_c_not_opened';
  const employeeActionRequired = !provisionalNoOpening && !input.confirmationMethod && !input.workdayCompleted;
  const nextReminderAt = employeeActionRequired ? existing?.nextReminderAt ?? new Date(input.now.getTime()+15*60_000) : null;
  const existingSource = existing?.sourceData && typeof existing.sourceData==='object' && !Array.isArray(existing.sourceData) ? existing.sourceData as Record<string,unknown> : {};
  const ownerVerificationRequired = Boolean(provisionalNoOpening || input.confirmationMethod || employeeActionRequired || existingSource.ownerVerificationRequired===true);
  const severity = 'warning';
  const title = provisionalNoOpening ? 'По 1С смена не открывалась · ожидаем ОФД' : input.confirmationMethod ? input.confirmationMethod==='photo' ? 'Чек закрытия приложен' : 'Чек закрытия не распечатался' : employeeActionRequired ? 'Подтвердите закрытие кассы' : 'Закрытие кассы не подтверждено ОФД';
  const detail = provisionalNoOpening ? 'По полным данным 1С кассовая смена не открывалась. Закрытие от сотрудника не требуется; сверка ОФД продолжается автоматически.' : input.confirmationMethod==='photo' ? 'Сотрудник подтвердил закрытие бумажным чеком. Сверка ОФД продолжается автоматически.'
    : input.confirmationMethod==='not_printed' ? 'Сотрудник сообщил, что чек не распечатался. Закрытие кассы проверяется по ОФД.'
    : employeeActionRequired ? 'Сфотографируйте чек закрытия смены или нажмите «Чек не распечатался».'
    : 'День завершён, но закрытие кассы ещё не подтверждено ОФД. Портал повторяет проверку автоматически.';
  const issue = await db.workdayControlIssue.upsert({
    where: { fingerprint },
    create: { userId: input.userId, taskId: input.taskId, fingerprint, ruleKey: 'kkm_shift_not_closed', severity, status: 'open', title, detail, sourceData: { ...input.evidence, ownerVerificationRequired, confirmationMethod: input.confirmationMethod || null } as unknown as Prisma.InputJsonValue, employeeActionRequired, nextReminderAt, originDate: input.date, detectedAt: input.now, lastDetectedAt: input.now },
    update: { userId: input.userId, taskId: input.taskId, severity, status: 'open', title, detail, sourceData: { ...input.evidence, ownerVerificationRequired, confirmationMethod: input.confirmationMethod || null } as unknown as Prisma.InputJsonValue, employeeActionRequired, nextReminderAt, originDate: input.date, resolvedAt: null, lastDetectedAt: input.now },
  });
  if (!employeeActionRequired) {
    await db.workdayNotification.updateMany({
      where: { issueId: issue.id, status: 'pending' },
      data: { status: 'cancelled' },
    });
  }
  if (employeeActionRequired && existing?.nextReminderAt && existing.nextReminderAt <= input.now) {
    const day = await db.workDayEntry.findUnique({where:{id:input.workDayEntryId},select:{status:true,endedAt:true}});
    if (day?.status==='active' && !day.endedAt && input.date===input.now.toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'})) {
      const bucket=Math.floor(input.now.getTime()/(15*60_000));
      await db.workdayNotification.upsert({where:{fingerprint:`issue:${issue.id}:kkm-reminder:${bucket}`},update:{},create:{userId:input.userId,issueId:issue.id,fingerprint:`issue:${issue.id}:kkm-reminder:${bucket}`,kind:'issue_reminder',title:'Подтвердите закрытие кассы',body:'Сфотографируйте чек закрытия смены или нажмите «Чек не распечатался».',scheduledAt:input.now}});
      await db.workdayControlIssue.update({where:{id:issue.id},data:{nextReminderAt:new Date(input.now.getTime()+15*60_000)}});
    }
  }
  const [employee, admins] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ]);
  const event = await db.adminInboxEvent.upsert({
    where: { eventKey: `kkm_shift_close:${input.workDayEntryId}:attention` },
    create: {
      eventKey: `kkm_shift_close:${input.workDayEntryId}:attention`,
      type: 'workday.kkm_shift_close_attention',
      title: provisionalNoOpening ? 'По 1С смена не открывалась · ожидаем ОФД' : 'Закрытие кассы не подтверждено',
      body: `${employee?.name || 'Сотрудник'} · ${input.evidence.cashRegisterName || 'ККТ не определена'} · ${input.evidence.sourceError}`,
      href: `/admin/workday/issues/${issue.id}`,
      sourceType: 'workday_control_issue',
      sourceId: String(issue.id),
      occurredAt: input.now,
    },
    update: {
      title: provisionalNoOpening ? 'По 1С смена не открывалась · ожидаем ОФД' : 'Закрытие кассы не подтверждено',
      body: `${employee?.name || 'Сотрудник'} · ${input.evidence.cashRegisterName || 'ККТ не определена'} · ${input.evidence.sourceError}`,
      occurredAt: existing?.detectedAt ?? input.now,
    },
  });
  if (admins.length) await db.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
  return issue;
}

export async function recheckOpenKkmShiftCloseIssues(now = new Date(), sources?: Parameters<typeof verifyEmployeeKkmShiftClose>[1]) {
  const { prisma } = await import('@/lib/prisma');
  const issues = await prisma.workdayControlIssue.findMany({
    where: { ruleKey: 'kkm_shift_not_closed', status: 'open' },
    include: { task: { select: { id: true, updatedAt: true, handoverData: true, run: { select: { date: true, workDayEntryId: true, workDayEntry:{select:{status:true,endedAt:true}} } } } } },
    orderBy: [{lastDetectedAt:'asc'},{id:'asc'}],
    take: 5,
  });
  let resolved = 0;
  for (const issue of issues) {
    if (!issue.task) continue;
    const handover = issue.task.handoverData && typeof issue.task.handoverData === 'object' && !Array.isArray(issue.task.handoverData) ? issue.task.handoverData as Record<string, unknown> : null;
    const evidence = await verifyEmployeeKkmShiftClose({ db: prisma, userId: issue.userId, date: issue.task.run.date, simulation: readKkmShiftCloseSimulation(handover?.kkmCloseSimulation) }, sources);
    const applied=await applyKkmShiftCloseIssue(prisma, {userId:issue.userId,taskId:issue.task.id,workDayEntryId:issue.task.run.workDayEntryId,date:issue.task.run.date,evidence,now,expectedTaskUpdatedAt:issue.task.updatedAt,expectedHandoverData:issue.task.handoverData});
    if(applied.applied && kkmShiftCloseSatisfied(evidence))resolved+=1;
  }
  return { checked: issues.length, resolved };
}

export function kkmShiftCloseSatisfied(evidence: Pick<KkmShiftCloseEvidence, 'status'>) {
  return evidence.status === 'confirmed' || evidence.status === 'not_opened';
}
export function kkmShiftCloseAllowsHandover(evidence: Pick<KkmShiftCloseEvidence, 'status'>) {
  return kkmShiftCloseSatisfied(evidence) || evidence.status === 'one_c_not_opened';
}
