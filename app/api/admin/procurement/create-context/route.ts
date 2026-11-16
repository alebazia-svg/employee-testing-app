import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveProcurementCreator } from '@/lib/procurement-plan-creator';
import { readAdminPlans, sameAdminPlanVersions } from '@/lib/procurement-admin-plans';
import { fetchRequestOrderCatalogue } from '@/lib/procurement-request-catalogue';
import { fetchManagerSupplierNames } from '@/lib/procurement-supplier-roster';
import { fetchSupplierSettlements, summarizeSupplierSettlements } from '@/lib/procurement-supplier-settlements';
import { ordersForManager } from '@/lib/procurement-payment-source';
import { freshEvidence } from '@/lib/procurement-plan-revision-server';
import { creationOrderChoices } from '@/lib/procurement-create-view';
import { cargoManagerAllowed } from '@/lib/procurement-cargo';
import { getLatestProcurementUsdtRate } from '@/lib/procurement-usdt-rate';
import { getProcurementCnyRate } from '@/lib/procurement-cny-rate';
import { getProcurementUsdtBalance } from '@/lib/procurement-currency-balance';
import { usdtReservedByPlans } from '@/lib/procurement-usdt-reserve';
import { expenseRequestMoscowCalendarDate } from '@/lib/expense-request-source';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'private, no-store'}});

/** Read only, loaded on opening the admin form. The submit routes independently
 * re-read ownership, debt, funding and overlaps inside the existing workflow. */
export async function GET(req: Request) {
  const actor = await getCurrentUser();
  if (!actor) return reply({error:'Необходим вход'},401);
  if (actor.role !== 'ADMIN') return reply({error:'Нет доступа'},403);
  const selected = new URL(req.url).searchParams.get('managerUserId');
  if (selected === null) {
    const managers = await prisma.user.findMany({where:{role:'EMPLOYEE',portalArea:'PROCUREMENT',isActive:true},select:{id:true,name:true},orderBy:{name:'asc'}});
    return reply({managers});
  }
  const creator = await resolveProcurementCreator(actor, /^\d+$/.test(selected) ? Number(selected) : Number.NaN);
  if (!creator.ok) return reply({error:creator.error},creator.status);
  const manager = creator.manager;
  const managerName = manager.oneCManagerName?.trim() || manager.name;
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  try {
    const plans = await readAdminPlans();
    const [source, settlements, names, evidence, rate, balance, cnyRateReference] = await Promise.all([
      fetchRequestOrderCatalogue(), fetchSupplierSettlements(), fetchManagerSupplierNames(managerName), freshEvidence(),
      getLatestProcurementUsdtRate(todayKey).catch(()=>undefined), getProcurementUsdtBalance(todayKey).catch(()=>null),
      getProcurementCnyRate(plans.filter(p=>p.managerUserId===manager.id && p.status!=='CANCELLED' && p.paymentMethod!=='USDT')
        .map(p=>({comment:p.condition,date:p.createdAt,knownCny:p.paymentMethod==='CNY',sourceLabel:'Комментарий заявки',documentNumber:p.planCode}))).catch(()=>undefined),
    ]);
    const summary = summarizeSupplierSettlements(settlements.rows,names);
    if (!source.complete || !settlements.complete || summary.unsupportedCurrencyRows) return reply({error:'Данные поставщиков из 1С пока не подтверждены. Повторите загрузку.'},503);
    if (evidence.versions.size !== plans.length || plans.some(p=>evidence.versions.get(p.id)!==p.updatedAt.toISOString() || !evidence.has(p.id))
      || !sameAdminPlanVersions(plans,await readAdminPlans())) return reply({error:'Список оплат изменился во время проверки. Повторите загрузку.'},409);
    const allPlans = plans.map(p=>({...p,plannedAmount:Number(p.plannedAmount),foreignAmount:p.foreignAmount==null?null:Number(p.foreignAmount),evidence:evidence.get(p.id)!}));
    const choices = creationOrderChoices(ordersForManager(source.rows,managerName),allPlans.filter(p=>p.managerUserId===manager.id),todayKey);
    const reserve = usdtReservedByPlans(allPlans,rate?.rate??null);
    return reply({...choices,manager:{id:manager.id,name:manager.name},todayKey,cargoAllowed:cargoManagerAllowed(managerName),supplierBalances:summary.bySupplier,
      usdtRateReference:rate,cnyRateReference,availableUsdt:balance && !balance.error && balance.balance!=null && reserve!=null ? Math.max(0,balance.balance-reserve) : null});
  } catch {
    return reply({error:'Не удалось проверить поставщиков и действующие оплаты. Повторите загрузку.'},503);
  }
}
