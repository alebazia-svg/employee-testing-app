import { getCurrentUser } from '@/lib/auth';
import { getTerminalFiscalAuditSummary } from '@/lib/terminal-fiscal-summary';
import { handleTerminalFiscalSummaryRequest } from '@/lib/terminal-fiscal-summary-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleTerminalFiscalSummaryRequest({
    request,
    admin: await getCurrentUser(),
    loadSummary: getTerminalFiscalAuditSummary,
  });
}
