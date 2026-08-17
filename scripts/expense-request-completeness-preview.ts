import { readFile } from 'node:fs/promises';
import {
  evaluateExpenseRequestCompleteness,
  expenseRequestStructuredDataIsSufficient,
  type ExpenseRequestCompletenessEvaluation,
  type ExpenseRequestInput,
} from '../lib/expense-request-completeness';

type Snapshot = ExpenseRequestInput[] | { rows?: ExpenseRequestInput[] };

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function countBy(values: string[]) {
  return Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((value) => value === key).length]));
}

function parseMappings(raw: string | undefined) {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as Record<string, number>;
  return Object.fromEntries(Object.entries(parsed).filter(([ref, id]) => ref && Number.isInteger(id) && id > 0));
}

function summary(rows: ExpenseRequestInput[], evaluations: ExpenseRequestCompletenessEvaluation[]) {
  const reasonCodes = evaluations.flatMap((row) => row.reasonCodes);
  const questions = evaluations.filter((row) => row.question);
  const unambiguousQuestions = questions.filter((row) => !row.ambiguous && row.confidence !== 'low');
  const structuredSufficient = rows.map((row, index) => ({ row, evaluation: evaluations[index] }))
    .filter(({ row }) => expenseRequestStructuredDataIsSufficient(row));
  const falsePositives = structuredSufficient.filter(({ evaluation }) => evaluation.completenessState !== 'complete');
  const rescuedBlankOrGenericComments = structuredSufficient.filter(({ row, evaluation }) => {
    const comment = String(row.comment ?? '').trim().toLocaleLowerCase('ru-RU');
    return evaluation.completenessState === 'complete' && (!comment || ['qr', 'доставка', '1 коробка'].includes(comment));
  });
  const categoryStates = Object.fromEntries(
    [...new Set(evaluations.map((row) => row.category))].sort().map((category) => {
      const categoryRows = evaluations.filter((row) => row.category === category);
      return [category, countBy(categoryRows.map((row) => row.completenessState))];
    }),
  );
  const employeeQuestions = evaluations.filter((row) => row.precheck.employeeQuestionEligible && row.question);
  const adminOnly = evaluations.filter((row) => row.precheck.target === 'admin');
  const questionsByConfirmedReasonCode = Object.fromEntries(
    [...new Set(employeeQuestions.flatMap((row) => row.precheck.confirmedReasonCodes))].sort().map((reason) => [
      reason,
      countBy(employeeQuestions.filter((row) => row.precheck.confirmedReasonCodes.includes(reason)).map((row) => row.question as string)),
    ]),
  );

  return {
    source: { rows: rows.length, uniqueRefs: new Set(rows.map((row) => row.ref)).size },
    completenessStates: countBy(evaluations.map((row) => row.completenessState)),
    evidenceStates: countBy(evaluations.map((row) => row.evidenceState)),
    categories: countBy(evaluations.map((row) => row.category)),
    categoryStates,
    reasonCodes: countBy(reasonCodes),
    questions: { total: questions.length, unambiguous: unambiguousQuestions.length },
    routing: countBy(evaluations.map((row) => row.routing.target)),
    reasonPolicy: {
      confirmedBusinessRules: countBy(evaluations.flatMap((row) => row.precheck.confirmedReasonCodes)),
      adminHypotheses: countBy(evaluations.flatMap((row) => row.precheck.hypothesisReasonCodes)),
      adminSafety: countBy(evaluations.flatMap((row) => row.precheck.safetyReasonCodes)),
    },
    precheck: {
      complete: evaluations.filter((row) => row.precheck.target === 'none').length,
      confirmedEmployeeQuestions: employeeQuestions.length,
      adminOnly: adminOnly.length,
      confirmedReasonCodes: countBy(employeeQuestions.flatMap((row) => row.precheck.confirmedReasonCodes)),
      adminHypothesisReasonCodes: countBy(adminOnly.flatMap((row) => row.precheck.hypothesisReasonCodes)),
      adminSafetyReasonCodes: countBy(adminOnly.flatMap((row) => row.precheck.safetyReasonCodes)),
      exactEmployeeQuestions: countBy(employeeQuestions.map((row) => row.question as string)),
      questionsByConfirmedReasonCode,
      employeeQuestionCountsByEmployeeId: countBy(employeeQuestions.map((row) => String(row.precheck.employeeId))),
    },
    ambiguity: {
      ambiguous: evaluations.filter((row) => row.ambiguous).length,
      lowConfidence: evaluations.filter((row) => row.confidence === 'low').length,
    },
    falsePositiveReview: {
      structuredSufficient: structuredSufficient.length,
      incorrectlyMarkedIncomplete: falsePositives.length,
      protectedFromNaiveCommentRule: rescuedBlankOrGenericComments.length,
    },
    examplesByCategory: Object.fromEntries(
      [...new Set(evaluations.map((row) => row.category))].sort().map((category) => {
        const examples = evaluations.filter((row) => row.category === category)
          .slice(0, 3)
          .map((row) => ({
            completenessState: row.completenessState,
            evidenceState: row.evidenceState,
            missingInformation: row.missingInformation,
            question: row.question,
            confidence: row.confidence,
            ambiguous: row.ambiguous,
            routing: row.routing.target,
          }));
        return [category, examples];
      }),
    ),
  };
}

async function main() {
  const fileIndex = process.argv.indexOf('--file');
  const raw = fileIndex >= 0
    ? await readFile(process.argv[fileIndex + 1], 'utf8')
    : await readStdin();
  if (!raw.trim()) throw new Error('Pass a read-only /expense-requests snapshot via stdin or --file <path>');
  const snapshot = JSON.parse(raw) as Snapshot;
  const rows = Array.isArray(snapshot) ? snapshot : snapshot.rows ?? [];
  const requestedByEmployeeIds = parseMappings(process.env.EXPENSE_REQUEST_REQUESTED_BY_MAPPING_JSON);
  const evaluations = rows.map((row) => evaluateExpenseRequestCompleteness(row, { requestedByEmployeeIds }));
  process.stdout.write(`${JSON.stringify(summary(rows, evaluations), null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
