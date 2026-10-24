'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type {AdminForecastSources} from '@/lib/procurement-admin-forecast';

/** Development-only presentation slots. Production screens cannot enable them. */
export const ProcurementVisualPreview = createContext<{
  /** Isolated authenticated DB review: use the real receipt UI and API. */
  persistedReceipts?: boolean;
  toolbar?: ReactNode;
  receiptControl?: ReactNode;
  fundingPlan?: ReactNode;
  forecastReader?: () => Promise<AdminForecastSources>;
  initialAdminTab?: 'plan' | 'history';
  labels?: Record<string, string>;
  methods?: Record<string, string>;
  historyWarnings?: Record<string, string>;
  hideRubleEstimate?: boolean;
  plainPaymentDetails?: boolean;
  historyDetail?: (id: string) => ReactNode;
  detail?: (id: string) => ReactNode;
  badge?: (id: string) => ReactNode;
  add?: () => void;
  edit?: (id: string) => void;
  decide?: (id: string, action: 'APPROVE' | 'RETURN' | 'CANCEL', reason: string) => void;
} | undefined>(undefined);

export function useProcurementVisualPreview() {
  const preview = useContext(ProcurementVisualPreview);
  return process.env.NODE_ENV === 'development' ? preview : undefined;
}
