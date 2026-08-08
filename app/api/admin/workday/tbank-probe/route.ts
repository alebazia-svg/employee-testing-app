import { getCurrentUser } from '@/lib/auth';
import { getTBankTerminalOperations, getTBankTerminals } from '@/lib/tbank-acquiring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const terminalKey = url.searchParams.get('terminalKey')?.trim() || '';
  if (!terminalKey) {
    const result = await getTBankTerminals();
    return Response.json(result, { status: result.ok ? 200 : 503 });
  }

  const till = url.searchParams.get('till')?.trim() || new Date().toISOString();
  const tillDate = new Date(till);
  const defaultFrom = Number.isNaN(tillDate.getTime())
    ? till
    : new Date(tillDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const from = url.searchParams.get('from')?.trim() || defaultFrom;
  const limitParam = Number(url.searchParams.get('limit') ?? 1000);
  const limit = Number.isFinite(limitParam) ? limitParam : 1000;
  const result = await getTBankTerminalOperations({ terminalKey, from, till, limit });

  return Response.json(result, { status: result.ok ? 200 : 503 });
}
