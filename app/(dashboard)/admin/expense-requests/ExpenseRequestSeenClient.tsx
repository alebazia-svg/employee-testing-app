'use client';

import { useEffect } from 'react';

export function ExpenseRequestSeenClient({ caseId }: { caseId: string }) {
  useEffect(() => {
    void fetch(`/api/admin/expense-requests/${encodeURIComponent(caseId)}/seen`, { method: 'POST' });
  }, [caseId]);
  return null;
}
