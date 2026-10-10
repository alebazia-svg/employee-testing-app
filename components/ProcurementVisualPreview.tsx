'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Development-only presentation slots. Production screens cannot enable them. */
export const ProcurementVisualPreview = createContext<{
  /** Isolated authenticated DB review: use the real receipt UI and API. */
  persistedReceipts?: boolean;
  toolbar?: ReactNode;
  labels?: Record<string, string>;
  methods?: Record<string, string>;
  historyWarnings?: Record<string, string>;
  hideRubleEstimate?: boolean;
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
