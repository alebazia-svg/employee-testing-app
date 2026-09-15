import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from './prisma';
import { loadOwnerCashForecastShadow } from './procurement-cash-forecast-loader';
import { fetchProcurementPriorityDebts } from './procurement-cash-forecast-settlements';
import { expenseRequestMoscowCalendarDate } from './expense-request-source';
import {
  buildProcurementForecastSnapshot,
  procurementForecastSnapshotHash,
  procurementForecastSnapshotReady,
  type ProcurementForecastSnapshotPayload,
} from './procurement-forecast-snapshot';
import { fetchPayrollForecastEvidence } from './procurement-payroll-one-c';
import { fetchSupplierOrderFinance, normalizeManagerName, ordersRequiringPayment } from './procurement-payment-source';
import { fetchTBankOwnerTransferControl } from './tbank-owner-transfer-one-c';

const RENT_ESTIMATE_MINOR = 23_500_000;

function rublesToMinor(value: string) {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('FORECAST_SNAPSHOT_INVALID_RUBLES');
  const [rubles, kopecks = ''] = value.split('.');
  const sign = rubles.startsWith('-') ? -1 : 1;
  const result = Number(rubles) * 100 + sign * Number(kopecks.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('FORECAST_SNAPSHOT_INVALID_RUBLES');
  return result;
}

export async function collectProcurementForecastSnapshot(now = new Date()) {
  const asOf = expenseRequestMoscowCalendarDate(now);
  const [shadowResult, debtsResult, payrollResult, tbankResult, ordersResult, managersResult] = await Promise.allSettled([
    loadOwnerCashForecastShadow(asOf),
    fetchProcurementPriorityDebts(asOf),
    fetchPayrollForecastEvidence(asOf),
    fetchTBankOwnerTransferControl(asOf),
    fetchSupplierOrderFinance(),
    prisma.user.findMany({
      where: { portalArea: 'PROCUREMENT', isActive: true },
      select: { name: true, oneCManagerName: true },
    }),
  ]);
  const shadow = shadowResult.status === 'fulfilled' ? shadowResult.value : null;
  const debts = debtsResult.status === 'fulfilled' ? debtsResult.value : null;
  const payroll = payrollResult.status === 'fulfilled' ? payrollResult.value : null;
  const tbank = tbankResult.status === 'fulfilled' ? tbankResult.value : null;
  const orders = ordersResult.status === 'fulfilled' && ordersResult.value.complete ? ordersResult.value : null;
  const managers = managersResult.status === 'fulfilled' ? managersResult.value : [];
  const managerNames = new Set(managers
    .map((manager) => normalizeManagerName(manager.oneCManagerName || manager.name))
    .filter((name) => name.includes('астемир')));
  const managerOrders = orders && managerNames.size
    ? ordersRequiringPayment(orders.rows).filter((order) => managerNames.has(normalizeManagerName(order.manager)))
    : [];
  const plans = shadow?.portalPlans ?? [];
  const scopedSuppliers = new Set([
    ...managerOrders.map((order) => normalizeManagerName(order.supplierPartner || order.supplierCounterparty)),
    ...plans.map((plan) => normalizeManagerName(plan.supplier)),
  ]);
  const money = shadow?.money?.complete ? shadow.money : null;
  const accounts = money ? money.positions.map((position, index) => ({
    name: money.accountNames[index] ?? position.bucketId,
    balanceMinor: position.balanceMinor,
  })) : [];
  const sourceStatus: ProcurementForecastSnapshotPayload['sources'] = {
    ownerMoney: money !== null,
    supplierOrders: orders !== null,
    supplierDebts: debts !== null,
    payroll: Boolean(payroll?.sourceComplete),
    tbank: tbank?.status ?? 'unavailable',
    procurementManagerMapping: managerNames.size > 0,
  };
  const payload = buildProcurementForecastSnapshot({
    asOf,
    sourceStatus,
    accounts,
    salaryPayableMinor: payroll?.sourceComplete ? payroll.payableMinor : null,
    rentEstimateMinor: RENT_ESTIMATE_MINOR,
    plans: plans.map((plan) => {
      const requestedMinor = rublesToMinor(plan.requestedRub);
      const issuedMinor = plan.issuedRub === null ? 0 : rublesToMinor(plan.issuedRub);
      return {
        id: plan.id,
        code: plan.planCode,
        supplier: plan.supplier,
        date: plan.plannedDate,
        status: plan.status,
        requestedMinor,
        issuedMinor,
        outstandingMinor: Math.max(0, requestedMinor - issuedMinor),
        paymentMethod: plan.paymentMethod,
        currency: plan.currency,
      };
    }),
    orders: managerOrders.map((order) => ({
      supplier: order.supplierPartner || order.supplierCounterparty,
      orderPaymentGapMinor: Math.round(order.orderPaymentGap * 100),
    })),
    debts: (debts?.supplierDebts ?? [])
      .filter((debt) => scopedSuppliers.has(normalizeManagerName(debt.name)))
      .map((debt) => ({
        supplier: debt.name,
        debtMinor: Math.round(debt.amountRub * 100),
        verified: debts!.calculationReady,
      })),
    tbank: {
      renewsOn: tbank?.renewsOn ?? '',
      transferredMinor: tbank?.transferredMinor ?? null,
      packagesPurchased: tbank?.packagesPurchased ?? null,
      freeRemainingMinor: tbank?.freeRemainingMinor ?? null,
      tierOneRemainingMinor: tbank?.tierOneRemainingMinor ?? null,
      tierFiveRemainingMinor: tbank?.tierFiveRemainingMinor ?? null,
      currentRateBps: tbank?.currentRateBps ?? null,
    },
  });
  return {
    payload,
    contentHash: procurementForecastSnapshotHash(payload),
    sourceCheckedAt: now,
  };
}

export async function persistProcurementForecastSnapshot(input: Awaited<ReturnType<typeof collectProcurementForecastSnapshot>>) {
  return prisma.$transaction(async (transaction) => {
    const latest = await transaction.procurementForecastSnapshot.findFirst({ orderBy: { id: 'desc' } });
    if (latest?.contentHash === input.contentHash) {
      await transaction.procurementForecastSnapshot.update({
        where: { id: latest.id },
        data: { sourceCheckedAt: input.sourceCheckedAt },
      });
      return { changed: false, id: latest.id, revision: latest.revision };
    }
    const created = await transaction.procurementForecastSnapshot.create({
      data: {
        snapshotDate: input.payload.asOf,
        payloadVersion: input.payload.version,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        contentHash: input.contentHash,
        revision: (latest?.revision ?? 0) + 1,
        sourceCheckedAt: input.sourceCheckedAt,
      },
    });
    return { changed: true, id: created.id, revision: created.revision };
  });
}

export async function runProcurementForecastSnapshot(input: { persist: boolean; now?: Date }) {
  const snapshot = await collectProcurementForecastSnapshot(input.now);
  if (!input.persist) return {
    persisted: false,
    changed: null,
    snapshotDate: snapshot.payload.asOf,
    contentHash: snapshot.contentHash,
    sourceStatus: snapshot.payload.sources,
    suppliers: snapshot.payload.suppliers.length,
    plans: snapshot.payload.commitments.plans.length,
  };
  if (!procurementForecastSnapshotReady(snapshot.payload)) {
    throw new Error('PROCUREMENT_FORECAST_CORE_SOURCE_INCOMPLETE');
  }
  const result = await persistProcurementForecastSnapshot(snapshot);
  return {
    persisted: true,
    ...result,
    snapshotDate: snapshot.payload.asOf,
    contentHash: snapshot.contentHash,
    sourceStatus: snapshot.payload.sources,
    suppliers: snapshot.payload.suppliers.length,
    plans: snapshot.payload.commitments.plans.length,
  };
}
