type AdminIdentity = { role?: string } | null;

export function parseTerminalFiscalSummaryRequest(request: Request) {
  const params = new URL(request.url).searchParams;
  const mappingId = params.get('mappingId')?.trim() ?? '';
  const from = params.get('from')?.trim() ?? '';
  const to = params.get('to')?.trim() ?? '';
  const periodFrom = new Date(from);
  const periodTo = new Date(to);
  if (!mappingId || Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime()) || periodTo <= periodFrom) return null;
  if (periodTo.getTime() - periodFrom.getTime() > 7 * 24 * 60 * 60 * 1000) return null;
  return { mappingId, periodFrom, periodTo };
}

export async function handleTerminalFiscalSummaryRequest(input: {
  request: Request;
  admin: AdminIdentity;
  loadSummary: (query: { mappingId: string; periodFrom: Date; periodTo: Date }) => Promise<unknown>;
}) {
  if (!input.admin || input.admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const query = parseTerminalFiscalSummaryRequest(input.request);
  if (!query) return Response.json({ error: 'Invalid query' }, { status: 400 });
  const summary = await input.loadSummary(query);
  return Response.json({ summary }, { headers: { 'Cache-Control': 'private, no-store' } });
}
