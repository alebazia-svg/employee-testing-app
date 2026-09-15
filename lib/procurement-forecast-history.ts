import 'server-only';

import { prisma } from './prisma';
import {
  compareProcurementForecastSnapshots,
  isProcurementForecastSnapshot,
  type ProcurementForecastSnapshotChange,
} from './procurement-forecast-snapshot';

export type ProcurementForecastHistoryView = {
  state: 'ready' | 'collecting' | 'unavailable';
  checkedAt: string;
  previousChangedAt: string;
  currentChangedAt: string;
  change: ProcurementForecastSnapshotChange | null;
};

export async function loadProcurementForecastHistory(): Promise<ProcurementForecastHistoryView> {
  try {
    const rows = await prisma.procurementForecastSnapshot.findMany({
      orderBy: { id: 'desc' },
      take: 10,
      select: { payload: true, sourceCheckedAt: true, createdAt: true },
    });
    const valid = rows.flatMap((row) => isProcurementForecastSnapshot(row.payload)
      ? [{ ...row, payload: row.payload }]
      : []);
    const current = valid[0];
    const previous = valid[1];
    if (!current) {
      return { state: 'collecting', checkedAt: '', previousChangedAt: '', currentChangedAt: '', change: null };
    }
    if (!previous) {
      return {
        state: 'collecting',
        checkedAt: current.sourceCheckedAt.toISOString(),
        previousChangedAt: '',
        currentChangedAt: current.createdAt.toISOString(),
        change: null,
      };
    }
    return {
      state: 'ready',
      checkedAt: current.sourceCheckedAt.toISOString(),
      previousChangedAt: previous.createdAt.toISOString(),
      currentChangedAt: current.createdAt.toISOString(),
      change: compareProcurementForecastSnapshots(previous.payload, current.payload),
    };
  } catch {
    return { state: 'unavailable', checkedAt: '', previousChangedAt: '', currentChangedAt: '', change: null };
  }
}
