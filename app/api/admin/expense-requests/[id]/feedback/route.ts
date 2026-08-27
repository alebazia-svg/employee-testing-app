import type { ExpenseRequestReasonCode } from '@/lib/expense-request-completeness';
import { validateExpenseRequestFeedback } from '@/lib/expense-request-admin-feedback';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision ?? '').trim();
  const scope = String(body.scope ?? 'overall').trim();
  const reasonCode = String(body.reasonCode ?? '').trim() || null;
  const comment = String(body.comment ?? '').trim();
  const validationError = validateExpenseRequestFeedback({ decision, scope, reasonCode, comment });
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  const caseRow = await prisma.expenseRequestAdminCase.findUnique({
    where: { id: (await context.params).id },
    include: { evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 } },
  });
  if (!caseRow) return Response.json({ error: 'Заявка не найдена.' }, { status: 404 });
  const evaluation = caseRow.evaluations[0] ?? null;
  if (scope === 'reason') {
    const codes = Array.isArray(evaluation?.reasonCodes) ? evaluation.reasonCodes.map(String) as ExpenseRequestReasonCode[] : [];
    if (!evaluation || !codes.includes(reasonCode as ExpenseRequestReasonCode)) {
      return Response.json({ error: 'Подсказка не относится к текущей оценке.' }, { status: 400 });
    }
  }
  const now = new Date();
  const feedback = await prisma.$transaction(async (db) => {
    const created = await db.expenseRequestAdminFeedback.create({
      data: {
        caseId: caseRow.id, evaluationId: evaluation?.id ?? null, scope, reasonCode, decision, comment, reviewedById: admin.id,
      },
      include: { reviewedBy: { select: { id: true, name: true } } },
    });
    if (scope === 'overall') {
      await db.expenseRequestAdminCase.update({
        where: { id: caseRow.id },
        data: { reviewedAt: now, reviewedById: admin.id, seenAt: caseRow.seenAt ?? now, seenById: caseRow.seenById ?? admin.id },
      });
    }
    return created;
  });
  return Response.json({ feedback }, { headers: { 'Cache-Control': 'private, no-store' } });
}
