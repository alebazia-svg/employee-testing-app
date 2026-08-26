import { getCurrentUser } from '@/lib/auth';
import { createCashOperationFailureAlert } from '@/lib/cash-operation-admin-alert';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { createOneCCashExpenseOrder, getCashStatementDimensions, getCashStatementSummary } from '@/lib/one-c';
import { shiftControlEmployeeRevisionHistoryKey, shiftControlOneCAuditKey, stripShiftControlOneCAudit } from '@/lib/shift-control-one-c-audit';
import { employeeKkmReportPhotosRequired } from '@/lib/shift-control-policy';
import { usesWorkdayShiftControl } from '@/lib/workday';
import { findApprovedCloseException, findOpenRequiredWorkdayIssues } from '@/lib/workday-required-issues';
import { cashEncashmentExceptionPrefix } from '@/lib/workday-cash-encashment-exception';
import { resolveCarriedCashEncashmentExceptions } from '@/lib/workday-cash-encashment-resolution';
import { resolveCloseExceptionNotifications, resolveTaskNotifications } from '@/lib/workday-notifications';
import { readKkmShiftCloseSimulation, syncKkmShiftCloseIssue, verifyEmployeeKkmShiftClose } from '@/lib/kkm-shift-close-control';
import {
  appendCashRecountInputHistory,
  buildCashRecountComparison,
  decideCashRecountAction,
  syncCashRecountWorkdayControl,
  type CashRecountComparison,
  type CashRecountStage,
} from '@/lib/cash-recount-control';

const cashStatementOrganizationSearchName = 'оффоника';
const reserveCashboxSearchName = 'резерв под телефоны';
const depositSafeCashboxSearchName = 'сейф депозитный';
const employeeRevisionHistoryKey = shiftControlEmployeeRevisionHistoryKey;

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function readInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function readFormNumber(formData: FormData, key: string) {
  return readNumber(formData.get(key));
}

function readFormBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isClosingShift(shiftCode: string | null | undefined) {
  return shiftCode === '11_20' || shiftCode === '09_20';
}

function isPhoto(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? (value[key] as Record<string, unknown>) : null;
}

function hasSavedPhoto(handoverData: unknown, key: string) {
  const photos = readRecord(handoverData, 'photos');
  return Boolean(photos && photos[key]);
}

function savedPhoto(handoverData: unknown, key: string) {
  const photos = readRecord(handoverData, 'photos');
  return photos?.[key] ?? null;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function taskForEmployee<T extends { handoverData: unknown }>(task: T) {
  const handoverData = stripShiftControlOneCAudit(task.handoverData);
  const visibleHandoverData = isRecord(handoverData) ? { ...handoverData } : handoverData;
  if (isRecord(visibleHandoverData)) delete visibleHandoverData[employeeRevisionHistoryKey];
  return {
    ...task,
    handoverData: visibleHandoverData,
  };
}

function revisionHistory(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value[employeeRevisionHistoryKey])) return [];
  return value[employeeRevisionHistoryKey] as unknown[];
}

function withoutRevisionHistory(value: unknown) {
  if (!isRecord(value)) return value;
  const result = { ...value };
  delete result[employeeRevisionHistoryKey];
  return result;
}

function withEmployeeRevision(
  task: {
    status: string;
    completedAt: Date | null;
    numericValue: number | null;
    integerValue: number | null;
    booleanValue: boolean | null;
    textValue: string | null;
    comment: string;
    handoverData: unknown;
  },
  nextData: unknown,
  editedAt: Date,
) {
  if (task.status !== 'done') return nextData;
  const base = isRecord(nextData) ? { ...nextData } : {};
  base[employeeRevisionHistoryKey] = [
    ...revisionHistory(task.handoverData),
    {
      editedAt: editedAt.toISOString(),
      previous: {
        completedAt: task.completedAt?.toISOString() ?? null,
        numericValue: task.numericValue,
        integerValue: task.integerValue,
        booleanValue: task.booleanValue,
        textValue: task.textValue,
        comment: task.comment,
        handoverData: withoutRevisionHistory(task.handoverData),
      },
    },
  ];
  return base;
}

async function captureOneCCashAudit({
  userId,
  date,
  includeReserve,
  capturedAt,
}: {
  userId: number;
  date: string;
  includeReserve: boolean;
  capturedAt: Date;
}) {
  const unavailable = (cashboxName: string, error: string) => ({
    status: 'unavailable',
    cashboxName,
    balance: null,
    oneCCheckedAt: null,
    error,
  });

  try {
    const [mapping, dimensions] = await Promise.all([
      prisma.userOneCCashboxMapping.findUnique({ where: { userId } }),
      getCashStatementDimensions(),
    ]);
    if (!dimensions.ok) {
      const error = dimensions.error || dimensions.diagnostics.join('; ') || '1С не вернула список касс.';
      return {
        version: 1,
        capturedAt: capturedAt.toISOString(),
        personalCash: unavailable(mapping?.oneCCashboxName ?? '', error),
        reserveCash: includeReserve ? unavailable('', error) : null,
      };
    }

    const organization = dimensions.organizations.find((item) => (
      normalizeSearchText(item.name) === cashStatementOrganizationSearchName
    ));
    if (!organization) {
      return {
        version: 1,
        capturedAt: capturedAt.toISOString(),
        personalCash: unavailable(mapping?.oneCCashboxName ?? '', 'Организация ОФФОНИКА не найдена в 1С.'),
        reserveCash: includeReserve ? unavailable('', 'Организация ОФФОНИКА не найдена в 1С.') : null,
      };
    }

    const personalCashbox = mapping?.isActive
      ? dimensions.cashboxes.find((item) => item.ref === mapping.oneCCashboxRef)
        ?? { ref: mapping.oneCCashboxRef, name: mapping.oneCCashboxName, deleted: false }
      : null;
    const reserveCashbox = includeReserve
      ? dimensions.cashboxes.find((item) => normalizeSearchText(item.name) === reserveCashboxSearchName) ?? null
      : null;

    const readBalance = async (cashbox: { ref: string; name: string } | null, missingError: string) => {
      if (!cashbox) return unavailable('', missingError);
      const statement = await getCashStatementSummary({
        date,
        organizationRef: organization.ref,
        cashboxRef: cashbox.ref,
      });
      if (!statement.ok || statement.closingBalance === null) {
        return unavailable(
          cashbox.name,
          statement.error || statement.diagnostics.join('; ') || 'Текущий остаток кассы 1С не получен.',
        );
      }
      return {
        status: 'captured',
        cashboxName: cashbox.name,
        balance: statement.closingBalance,
        oneCCheckedAt: statement.checkedAt,
        error: null,
      };
    };

    const [personalCash, reserveCash] = await Promise.all([
      readBalance(personalCashbox, 'Касса сотрудника не привязана к 1С.'),
      includeReserve ? readBalance(reserveCashbox, 'Касса резерва не найдена в 1С.') : Promise.resolve(null),
    ]);
    return {
      version: 1,
      capturedAt: capturedAt.toISOString(),
      personalCash,
      reserveCash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось получить текущий остаток 1С.';
    return {
      version: 1,
      capturedAt: capturedAt.toISOString(),
      personalCash: unavailable('', message),
      reserveCash: includeReserve ? unavailable('', message) : null,
    };
  }
}

async function savePhoto(file: File, runId: number, taskId: number, key: string) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Добавьте фото');
  }

  const extension = file.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const directory = path.join(process.cwd(), 'uploads', 'shift-control', String(runId), String(taskId));
  await mkdir(directory, { recursive: true });

  const fileName = key + '-' + randomUUID() + '.' + extension;
  const absolutePath = path.join(directory, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    key,
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    storagePath: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'),
  };
}

async function saveHandoverDraft(
  formData: FormData,
  task: { id: number; runId: number; handoverData: unknown; run: { date: string; workDayEntry: { shiftCode: string } } },
  isRetail: boolean,
  includeReserve: boolean,
  userId: number,
  date: string,
) {
  const existing = isRecord(task.handoverData) ? task.handoverData : {};
  const existingPersonalCash = readRecord(existing, 'personalCash') ?? {};
  const existingReserveCash = readRecord(existing, 'reserveCash') ?? {};
  const existingPhotos = readRecord(existing, 'photos') ?? {};

  const personalCashBalance = readFormNumber(formData, 'personalCashBalance');
  const reserveCashBalance = readFormNumber(formData, 'reserveCashBalance');
  const terminalHadOperations = readFormBoolean(formData, 'terminalHadOperations');
  const terminalReconciliation = readFormString(formData, 'terminalReconciliation');
  const terminalComment = readFormString(formData, 'terminalComment');
  const encashmentAmount = readFormNumber(formData, 'encashmentAmount');
  const requestedEncashmentDirection = readFormString(formData, 'encashmentDirection');
  const encashmentDirection = !isRetail && personalCashBalance !== null && personalCashBalance > 50000
    ? 'deposit_safe'
    : requestedEncashmentDirection;
  const comment = readFormString(formData, 'comment');
  const photos = { ...existingPhotos };
  const photoFields = [
    ['personalStatementPhoto', 'personalStatement', 'personal-statement'],
    ['terminalReceiptsPhoto', 'terminalReceipts', 'terminal-receipts'],
    ['tbankReceiptsPhoto', 'tbankReceipts', 'tbank-receipts'],
    ['tbankTerminalReportPhoto', 'tbankTerminalReport', 'tbank-terminal-report'],
    ['zReportPhoto', 'zReport', 'z-report'],
    ['encashmentDocumentPhoto', 'encashmentDocument', 'encashment-document'],
  ] as const;

  for (const [formKey, dataKey, storageKey] of photoFields) {
    const file = formData.get(formKey);
    if (isPhoto(file)) {
      photos[dataKey] = await savePhoto(file, task.runId, task.id, storageKey);
    }
  }

  const existingAudit = isRecord(existing[shiftControlOneCAuditKey])
    ? existing[shiftControlOneCAuditKey] as Record<string, unknown>
    : null;
  const auditFactBalance = existingAudit ? readNumber(existingAudit.factCashBalance) : null;
  const oneCAudit = personalCashBalance !== null && (!existingAudit || auditFactBalance !== personalCashBalance)
    ? {
        ...await captureOneCCashAudit({ userId, date, includeReserve, capturedAt: new Date() }),
        factCashBalance: personalCashBalance,
      }
    : existingAudit;
  const personalAudit = oneCAudit ? readRecord(oneCAudit, 'personalCash') : null;
  const expectedCash = personalAudit?.status === 'captured' ? readNumber(personalAudit.balance) : null;
  const cashDifference = personalCashBalance !== null && expectedCash !== null ? personalCashBalance - expectedCash : null;
  const discrepancyMagnitude = cashDifference === null ? null : Math.abs(cashDifference);
  const calculatedDiscrepancyType = discrepancyMagnitude === null || discrepancyMagnitude === 0
    ? 'none'
    : cashDifference! > 0 ? 'surplus' : 'shortage';
  const calculatedDiscrepancyAmount = discrepancyMagnitude !== null && discrepancyMagnitude > 0 ? discrepancyMagnitude : null;

  const nextData = {
    ...existing,
    draft: true,
    shiftCode: task.run.workDayEntry.shiftCode,
    updatedAt: new Date().toISOString(),
    [shiftControlOneCAuditKey]: oneCAudit,
    personalCash: {
      ...existingPersonalCash,
      cashBalance: personalCashBalance,
      discrepancyType: expectedCash === null ? '' : calculatedDiscrepancyType,
      discrepancyAmount: expectedCash === null ? null : calculatedDiscrepancyAmount,
      requiresComment: false,
      hadWithdrawal: null,
      withdrawalAmount: null,
      cashOrderAmount: null,
      withdrawalDifference: null,
      hasTbankCredit: null,
      requiresEncashment: personalCashBalance !== null ? personalCashBalance > 50000 : Boolean(existingPersonalCash.requiresEncashment),
      encashmentAmount,
      encashmentDirection,
    },
    reserveCash: includeReserve
      ? {
          ...existingReserveCash,
          cashBalance: reserveCashBalance,
        }
      : null,
    terminalCheck: {
      hadOperations: terminalHadOperations,
      reconciliation: terminalHadOperations ? terminalReconciliation : 'not_required',
      comment: terminalReconciliation === 'discrepancy' ? terminalComment : '',
    },
    storeClosing: isClosingShift(task.run.workDayEntry.shiftCode)
      ? {
          zReportRequired: employeeKkmReportPhotosRequired,
          verification: 'one_c_cash_shift',
        }
      : null,
    comment,
    photos,
    cashRecountInputHistory: personalCashBalance === null
      ? existing.cashRecountInputHistory
      : appendCashRecountInputHistory(existing.cashRecountInputHistory, personalCashBalance, new Date().toISOString()),
  };

  const updatedTask = await prisma.shiftControlTask.update({
    where: { id: task.id },
    data: { handoverData: nextData as Prisma.InputJsonValue, comment },
  });

  return Response.json({ task: taskForEmployee(updatedTask) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!usesWorkdayShiftControl(user)) return Response.json({ error: 'Shift control is not required for this employee' }, { status: 403 });

  const taskId = Number(params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return Response.json({ error: 'Invalid task id' }, { status: 400 });
  }

  const task = await prisma.shiftControlTask.findFirst({
    where: {
      id: taskId,
      run: {
        userId: user.id,
        workDayEntry: {
          status: { in: ['active', 'missing_checkout'] },
          endedAt: null,
        },
      },
    },
    include: { run: { include: { workDayEntry: true } } },
  });

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  if (task.category === 'handover') {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return Response.json({ error: 'Заполните сдачу смены' }, { status: 400 });
    }

    if (readFormString(formData, 'intent') === 'draft') {
      try {
        const isRetail = user.department === 'retail';
        return await saveHandoverDraft(formData, task, isRetail, isRetail && isClosingShift(task.run.workDayEntry.shiftCode), user.id, task.run.date);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить шаг сдачи смены' }, { status: 400 });
      }
    }

    const isRetail = user.department === 'retail';
    const isClosingEmployee = isRetail && isClosingShift(task.run.workDayEntry.shiftCode);
    await saveHandoverDraft(formData, task, isRetail, isClosingEmployee, user.id, task.run.date);
    const savedDraftTask = await prisma.shiftControlTask.findUnique({ where: { id: task.id }, select: { handoverData: true } });
    if (!savedDraftTask) return Response.json({ error: 'Задача сдачи смены не найдена' }, { status: 404 });
    const handoverData = savedDraftTask.handoverData;
    const personalCash = readRecord(handoverData, 'personalCash') ?? {};
    const reserveCash = readRecord(handoverData, 'reserveCash') ?? {};
    const personalCashBalance = readNumber(personalCash.cashBalance);
    const reserveCashBalance = readNumber(reserveCash.cashBalance);
    const discrepancyType = typeof personalCash.discrepancyType === 'string' ? personalCash.discrepancyType : '';
    const discrepancyAmount = readNumber(personalCash.discrepancyAmount);
    const encashmentAmount = readNumber(personalCash.encashmentAmount);
    const encashmentDirection = typeof personalCash.encashmentDirection === 'string' ? personalCash.encashmentDirection : '';
    const comment = isRecord(handoverData) && typeof handoverData.comment === 'string' ? handoverData.comment.trim() : '';
    const requiresEncashment = personalCashBalance !== null && personalCashBalance > 50000;
    const requiresDiscrepancyComment = false;
    let kkmCloseCheckAudit = readRecord(isRecord(handoverData) ? handoverData : {}, 'kkmCloseCheck');

    const approvedCashEncashmentException = requiresEncashment
      ? await prisma.workdayCloseExceptionRequest.findFirst({
          where: {
            workDayEntryId: task.run.workDayEntryId,
            status: 'approved',
            consumedAt: null,
            reasonCode: { startsWith: cashEncashmentExceptionPrefix },
          },
          orderBy: { decidedAt: 'desc' },
        })
      : null;
    const canFinishWithoutEncashment = Boolean(approvedCashEncashmentException);

    if (personalCashBalance === null) return Response.json({ error: 'Укажите остаток наличных в моей кассе' }, { status: 400 });
    if (isClosingEmployee && reserveCashBalance === null) return Response.json({ error: 'Укажите остаток наличных в резерве' }, { status: 400 });
    if (discrepancyType && !['none', 'surplus', 'shortage'].includes(discrepancyType)) {
      return Response.json({ error: 'Не удалось определить расхождение по кассе' }, { status: 400 });
    }
    if (requiresEncashment && !canFinishWithoutEncashment) {
      if (encashmentAmount === null) return Response.json({ error: 'Укажите сумму инкассации' }, { status: 400 });
      const allowedDirections = isRetail ? ['phone_reserve', 'deposit_safe'] : ['deposit_safe'];
      if (!allowedDirections.includes(encashmentDirection)) {
        return Response.json({ error: isRetail ? 'Выберите направление инкассации' : 'Для опта доступна инкассация только в депозитный сейф' }, { status: 400 });
      }
      if (!hasSavedPhoto(handoverData, 'encashmentDocument')) {
        return Response.json({ error: isRetail
          ? 'Сфотографируйте деньги перед помещением в резерв или депозитный сейф.'
          : 'Сфотографируйте деньги перед помещением в депозитный сейф.' }, { status: 400 });
      }
    }
    if (isClosingEmployee && employeeKkmReportPhotosRequired) {
      if (!hasSavedPhoto(handoverData, 'zReport')) return Response.json({ error: 'Сделайте фото чека закрытия смены' }, { status: 400 });
    }

    if (isClosingEmployee) {
      const now = new Date();
      const handoverRecord = isRecord(handoverData) ? handoverData : {};
      const previousCheck = readRecord(handoverRecord, 'kkmCloseCheck');
      const previousStartedAt = previousCheck && typeof previousCheck.startedAt === 'string' ? Date.parse(previousCheck.startedAt) : Number.NaN;
      const startedAt = Number.isFinite(previousStartedAt) ? new Date(previousStartedAt) : now;
      const evidence = await verifyEmployeeKkmShiftClose({ db: prisma, userId: user.id, date: task.run.date, simulation: readKkmShiftCloseSimulation(handoverRecord.kkmCloseSimulation) });
      kkmCloseCheckAudit = {
        startedAt: startedAt.toISOString(),
        checkedAt: evidence.checkedAt,
        attempts: (readInteger(previousCheck?.attempts) ?? 0) + 1,
        status: evidence.status,
        evidence,
      };
      await prisma.shiftControlTask.update({
        where: { id: task.id },
        data: {
          handoverData: {
            ...handoverRecord,
            kkmCloseCheck: kkmCloseCheckAudit,
          } as Prisma.InputJsonValue,
        },
      });
      if (evidence.status === 'confirmed') {
        await syncKkmShiftCloseIssue(prisma, { userId: user.id, taskId: task.id, workDayEntryId: task.run.workDayEntryId, date: task.run.date, evidence, now });
      } else if (now.getTime() - startedAt.getTime() < 90_000) {
        return Response.json({
          error: 'Касса может передать чек с небольшой задержкой. Проверяем автоматически…',
          code: 'KKM_SHIFT_CHECK_PENDING',
          retryAfterMs: 15_000,
          startedAt: startedAt.toISOString(),
        }, { status: 409 });
      } else {
        await syncKkmShiftCloseIssue(prisma, { userId: user.id, taskId: task.id, workDayEntryId: task.run.workDayEntryId, date: task.run.date, evidence, now });
      }
    }

    const requiredIssues = await findOpenRequiredWorkdayIssues(prisma, user.id);
    const requiredIssueIds = requiredIssues.map((issue) => issue.id).sort((a, b) => a - b);
    const closeException = requiredIssueIds.length
      ? await findApprovedCloseException(prisma, task.run.workDayEntryId, requiredIssueIds)
      : null;
    if (requiredIssueIds.length && !closeException) {
      return Response.json({
        error: 'Есть обязательная неисправленная ошибка. Исправьте её или запросите разрешение администратора при технической невозможности.',
        code: 'OPEN_REQUIRED_ISSUES',
        issues: requiredIssues,
      }, { status: 409 });
    }

    try {
      let postedEncashmentOperation: { id: number; date: string; amount: number; createdAt: Date } | null = null;
      let encashmentDeferredToAdmin = false;
      if (requiresEncashment && !canFinishWithoutEncashment && encashmentAmount !== null) {
        const legacyIdempotencyKey = `00000000-0000-4000-8000-${task.id.toString(16).padStart(12, '0')}`;
        const compactIdempotencyKey = `h${task.id}`;
        const encashmentPhoto = savedPhoto(handoverData, 'encashmentDocument');
        const photoPath = isRecord(encashmentPhoto) && typeof encashmentPhoto.storagePath === 'string' ? encashmentPhoto.storagePath : '';
        let cashOperation = await prisma.cashOperation.findUnique({ where: { idempotencyKey: legacyIdempotencyKey } });
        cashOperation ??= await prisma.cashOperation.findUnique({ where: { idempotencyKey: compactIdempotencyKey } });
        const idempotencyKey = cashOperation?.idempotencyKey ?? compactIdempotencyKey;
        cashOperation ??= await prisma.cashOperation.create({
          data: {
            userId: user.id,
            workDayEntryId: task.run.workDayEntryId,
            date: task.run.date,
            department: user.department,
            direction: encashmentDirection,
            amount: encashmentAmount,
            photoPath,
            comment,
            status: 'pending_1c',
            idempotencyKey,
          },
        });
        if (cashOperation.amount !== encashmentAmount || cashOperation.direction !== encashmentDirection) {
          throw new Error('Параметры повторной инкассации не совпадают. Смена не завершена.');
        }
        const cashOperationId = cashOperation.id;
        const pairAlreadyPosted = cashOperation.status === 'posted_1c_pair' && Boolean(cashOperation.oneCDocumentRef) && Boolean(cashOperation.oneCReceiptDocumentRef);
        if (!pairAlreadyPosted) {
          const deferToAdmin = async (oneCError: string) => {
            cashOperation = await prisma.$transaction(async (tx) => {
              const failedOperation = await tx.cashOperation.update({ where: { id: cashOperationId }, data: { status: 'one_c_error', oneCError } });
              await createCashOperationFailureAlert({ db: tx, operation: failedOperation, employeeName: user.name, error: oneCError, occurredAt: new Date() });
              return failedOperation;
            });
            encashmentDeferredToAdmin = true;
          };
          const mapping = await prisma.userOneCCashboxMapping.findUnique({ where: { userId: user.id } });
          let dimensions: Awaited<ReturnType<typeof getCashStatementDimensions>> | null = null;
          let sourceError = '';
          try {
            dimensions = await getCashStatementDimensions();
          } catch (error) {
            sourceError = error instanceof Error ? error.message : 'Связь с 1С недоступна.';
          }
          const organization = dimensions?.organizations.find((item) => normalizeSearchText(item.name).includes(cashStatementOrganizationSearchName))
            ?? dimensions?.organizations[0]
            ?? null;
          const targetCashboxName = encashmentDirection === 'phone_reserve' ? reserveCashboxSearchName : depositSafeCashboxSearchName;
          const targetCashbox = dimensions?.cashboxes.find((item) => normalizeSearchText(item.name) === targetCashboxName) ?? null;
          const configurationError = sourceError
            || (!mapping?.isActive
              ? 'Касса сотрудника не привязана к 1С.'
              : !dimensions?.ok || !organization
                ? 'Организация или справочник касс 1С недоступны.'
                : !targetCashbox
                  ? 'Касса-получатель для инкассации не найдена в 1С.'
                  : '');
          if (configurationError) {
            await deferToAdmin(configurationError);
          } else if (mapping?.isActive && organization && targetCashbox) {
            let oneCResult: Awaited<ReturnType<typeof createOneCCashExpenseOrder>> | null = null;
            try {
              oneCResult = await createOneCCashExpenseOrder({
                idempotencyKey,
                organizationRef: organization.ref,
                cashboxRef: mapping.oneCCashboxRef,
                targetCashboxRef: targetCashbox.ref,
                employeeName: user.name,
                amount: encashmentAmount,
                direction: encashmentDirection as 'phone_reserve' | 'deposit_safe',
                employeeComment: comment,
              });
            } catch (error) {
              await deferToAdmin(error instanceof Error ? error.message : 'Связь с 1С прервалась при проведении инкассации.');
            }
            if (oneCResult && (!oneCResult.ok || !oneCResult.document || !oneCResult.receiptDocument || !oneCResult.pairComplete)) {
              await deferToAdmin(oneCResult.error || '1С не создала и не провела связанную пару РКО и ПКО.');
            } else if (oneCResult?.ok && oneCResult.document && oneCResult.receiptDocument && oneCResult.pairComplete) {
              cashOperation = await prisma.cashOperation.update({
                where: { id: cashOperation.id },
                data: {
                  status: 'posted_1c_pair',
                  oneCDocumentRef: oneCResult.document.ref,
                  oneCDocumentNumber: oneCResult.document.number,
                  oneCReceiptDocumentRef: oneCResult.receiptDocument.ref,
                  oneCReceiptDocumentNumber: oneCResult.receiptDocument.number,
                  oneCError: '',
                  oneCCreatedAt: new Date(),
                  oneCPostedAt: new Date(),
                },
              });
            }
          }
        }
        if (cashOperation.status === 'posted_1c_pair') {
          postedEncashmentOperation = {
            id: cashOperation.id,
            date: cashOperation.date,
            amount: cashOperation.amount,
            createdAt: cashOperation.createdAt,
          };
        }
      }

      const photos = {
        personalStatement: savedPhoto(handoverData, 'personalStatement'),
        zReport: isClosingEmployee ? savedPhoto(handoverData, 'zReport') : null,
        encashmentDocument: requiresEncashment && !canFinishWithoutEncashment ? savedPhoto(handoverData, 'encashmentDocument') : null,
      };
      const now = new Date();
      const handoverRecord = isRecord(handoverData) ? handoverData : {};
      const savedOneCAudit = isRecord(handoverRecord[shiftControlOneCAuditKey])
        ? handoverRecord[shiftControlOneCAuditKey]
        : await captureOneCCashAudit({ userId: user.id, date: task.run.date, includeReserve: isClosingEmployee, capturedAt: now });
      const finalHandoverData = {
        draft: false,
        shiftCode: task.run.workDayEntry.shiftCode,
        submittedAt: now.toISOString(),
        [shiftControlOneCAuditKey]: savedOneCAudit,
        kkmCloseCheck: kkmCloseCheckAudit ?? null,
        scope: {
          personalCash: true,
          reserveCash: isClosingEmployee,
          storeClosing: isClosingEmployee,
        },
        personalCash: {
          cashBalance: personalCashBalance,
          discrepancyType,
          discrepancyAmount: discrepancyType === 'none' ? null : discrepancyAmount,
          requiresComment: requiresDiscrepancyComment,
          hadWithdrawal: null,
          withdrawalAmount: null,
          cashOrderAmount: null,
          withdrawalDifference: null,
          hasTbankCredit: null,
          requiresEncashment,
          encashmentAmount: requiresEncashment && !canFinishWithoutEncashment ? encashmentAmount : null,
          encashmentDirection: requiresEncashment && !canFinishWithoutEncashment ? encashmentDirection : null,
          encashmentExceptionRequestId: approvedCashEncashmentException?.id ?? null,
        },
        reserveCash: isClosingEmployee ? { cashBalance: reserveCashBalance } : null,
        terminalCheck: null,
        storeClosing: isClosingEmployee
          ? {
              zReportRequired: employeeKkmReportPhotosRequired,
              verification: 'one_c_cash_shift_and_ofd_z_report',
            }
          : null,
        comment,
        photos,
        cashRecountInputHistory: handoverRecord.cashRecountInputHistory ?? [],
      };

      const result = await prisma.$transaction(async (tx) => {
        await tx.shiftControlTask.updateMany({
          where: {
            runId: task.runId,
            required: true,
            category: { notIn: ['handover', 'closing'] },
            status: { not: 'done' },
          },
          data: {
            status: 'missed',
            comment: 'Не выполнено до сдачи смены',
          },
        });
        const updatedTask = await tx.shiftControlTask.update({
          where: { id: task.id },
          data: {
            status: 'done',
            completedAt: now,
            numericValue: personalCashBalance,
            booleanValue: null,
            comment,
            handoverData: finalHandoverData as Prisma.InputJsonValue,
          },
        });
        await tx.shiftControlTask.updateMany({
          where: {
            runId: task.runId,
            category: 'closing',
            status: { not: 'done' },
          },
          data: {
            status: 'done',
            completedAt: now,
            comment: 'Фото чека закрытия смены загружено в мастере сдачи смены',
          },
        });
        const updatedRun = await tx.shiftControlRun.update({
          where: { id: task.runId },
          data: { status: 'completed', submittedAt: now, completedAt: now },
        });
        const workDay = await tx.workDayEntry.update({
          where: { id: task.run.workDayEntryId },
          data: { endedAt: now, status: 'completed' },
        });
        if (closeException) {
          await tx.workdayCloseExceptionRequest.update({ where: { id: closeException.id }, data: { consumedAt: now } });
        }
        if (requiresEncashment && !canFinishWithoutEncashment) {
          await tx.workdayCloseExceptionRequest.updateMany({
            where: {
              workDayEntryId: task.run.workDayEntryId,
              reasonCode: { startsWith: cashEncashmentExceptionPrefix },
              status: { in: ['pending', 'approved'] },
            },
            data: { status: 'resolved', consumedAt: now },
          });
        }
        if (postedEncashmentOperation) {
          await resolveCarriedCashEncashmentExceptions(tx, {
            employeeId: user.id,
            operationId: postedEncashmentOperation.id,
            operationDate: postedEncashmentOperation.date,
            operationAmount: postedEncashmentOperation.amount,
            operationCreatedAt: postedEncashmentOperation.createdAt,
          });
        }
        await resolveCloseExceptionNotifications(tx, {
          workDayEntryId: task.run.workDayEntryId,
          now,
          scope: 'all',
        });
        const tasks = await tx.shiftControlTask.findMany({
          where: { runId: task.runId },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        await resolveTaskNotifications(tx, tasks.map((item) => item.id), now);
        return { task: updatedTask, tasks, run: updatedRun, workDay };
      });

      return Response.json({
        ...result,
        task: taskForEmployee(result.task),
        tasks: result.tasks.map(taskForEmployee),
        message: encashmentDeferredToAdmin
          ? 'Смена завершена. Инкассация зафиксирована и передана администратору.'
          : 'Смена сдана, рабочий день завершён',
      });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить сдачу смены' }, { status: 400 });
    }
  }

  if (task.category === 'opening') {
    const formData = await req.formData().catch(() => null);
    const photo = formData?.get('openingReportPhoto') ?? null;
    if (!formData || !isPhoto(photo)) {
      return Response.json({ error: 'Сделайте фото чека открытия смены' }, { status: 400 });
    }

    try {
      const savedPhoto = await savePhoto(photo, task.runId, task.id, 'opening-report');
      const editedAt = new Date();
      const updatedTask = await prisma.shiftControlTask.update({
        where: { id: task.id },
        data: {
          status: 'done',
          completedAt: task.completedAt ?? editedAt,
          textValue: savedPhoto.storagePath,
          comment: 'Фото чека открытия смены прикреплено',
          handoverData: withEmployeeRevision(task, {
            photo: savedPhoto,
          }, editedAt) as Prisma.InputJsonValue,
        },
      });
      await resolveTaskNotifications(prisma, [task.id], editedAt);

      return Response.json({ task: updatedTask });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить фото чека открытия смены' }, { status: 400 });
    }
  }

  if (task.category === 'acquiring') {
    const formData = await req.formData().catch(() => null);
    if (!formData) return Response.json({ error: 'Заполните проверку операций терминала' }, { status: 400 });

    const checkStatus = readInteger(formData.get('integerValue'));
    const comment = readFormString(formData, 'comment');
    const photo = formData.get('terminalReceiptsPhoto');
    const existingPhoto = savedPhoto(task.handoverData, 'terminalReceipts');
    if (checkStatus === null || ![0, 1, 2].includes(checkStatus)) {
      return Response.json({ error: 'Ответьте на вопросы проверки терминала' }, { status: 400 });
    }
    if (checkStatus === 2 && !comment) {
      return Response.json({ error: 'Опишите расхождение по операциям терминала' }, { status: 400 });
    }
    if ((checkStatus === 1 || checkStatus === 2) && !isPhoto(photo) && !existingPhoto) {
      return Response.json({ error: 'Сфотографируйте новые чеки терминала' }, { status: 400 });
    }

    try {
      const previousTask = await prisma.shiftControlTask.findFirst({
        where: {
          runId: task.runId,
          category: 'acquiring',
          status: 'done',
          completedAt: { not: null },
          id: { not: task.id },
        },
        orderBy: { completedAt: 'desc' },
      });
      const editedAt = new Date();
      const completedAt = task.completedAt ?? editedAt;
      const receiptsPhoto = isPhoto(photo)
        ? await savePhoto(photo, task.runId, task.id, 'terminal-receipts')
        : existingPhoto;
      const nextHandoverData = {
        terminalCheck: {
          intervalFrom: previousTask?.completedAt?.toISOString() ?? task.run.workDayEntry.startedAt.toISOString(),
          intervalTo: completedAt.toISOString(),
          previousTaskId: previousTask?.id ?? null,
          hadOperations: checkStatus !== 0,
          reconciliation: checkStatus === 0 ? 'not_required' : checkStatus === 1 ? 'matched' : 'discrepancy',
          comment: checkStatus === 2 ? comment : '',
        },
        photos: { terminalReceipts: checkStatus === 0 ? null : receiptsPhoto },
      };
      const updatedTask = await prisma.shiftControlTask.update({
        where: { id: task.id },
        data: {
          status: 'done',
          completedAt,
          integerValue: checkStatus,
          numericValue: null,
          booleanValue: checkStatus !== 2,
          comment: checkStatus === 2 ? comment : '',
          handoverData: withEmployeeRevision(task, nextHandoverData, editedAt) as Prisma.InputJsonValue,
        },
      });
      await resolveTaskNotifications(prisma, [task.id], editedAt);
      return Response.json({ task: taskForEmployee(updatedTask) });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить проверку операций терминала' }, { status: 400 });
    }
  }

  const payload = await req.json().catch(() => ({}));
  const commentSource = typeof payload.comment === 'string' ? payload.comment : typeof payload.textValue === 'string' ? payload.textValue : '';
  const textValue = typeof payload.textValue === 'string' ? payload.textValue.trim() : null;
  const editedAt = new Date();
  const completedAt = task.completedAt ?? editedAt;

  const data: {
    status: 'done';
    completedAt: Date;
    comment: string;
    numericValue?: number | null;
    integerValue?: number | null;
    booleanValue?: boolean | null;
    textValue?: string | null;
    handoverData?: Prisma.InputJsonValue;
  } = {
    status: 'done',
    completedAt,
    comment: commentSource.trim(),
  };
  let cashComparison: CashRecountComparison | null = null;

  if (task.category === 'cash') {
    const numericValue = readNumber(payload.numericValue);
    if (numericValue === null) {
      return Response.json({ error: 'Укажите сумму' }, { status: 400 });
    }
    const existingData = isRecord(task.handoverData) ? task.handoverData : {};
    const existingStage = existingData.cashRecountStage === 'result_ready' || existingData.cashRecountStage === 'comment_required'
      ? existingData.cashRecountStage as CashRecountStage
      : 'initial';
    const existingAudit = isRecord(existingData[shiftControlOneCAuditKey])
      ? existingData[shiftControlOneCAuditKey] as Record<string, unknown>
      : null;
    const existingFact = existingAudit ? readNumber(existingAudit.factCashBalance) : null;
    const decisionStage = existingStage !== 'initial' && existingFact !== null && existingFact !== numericValue
      ? 'initial'
      : existingStage;
    const oneCAudit = existingStage === 'comment_required' && existingAudit && existingFact === numericValue
      ? existingAudit
      : {
          ...await captureOneCCashAudit({
          userId: user.id,
          date: task.run.date,
          includeReserve: false,
          capturedAt: completedAt,
          }),
          factCashBalance: numericValue,
        };
    const personalAudit = readRecord(oneCAudit, 'personalCash');
    const expected = personalAudit?.status === 'captured' ? readNumber(personalAudit.balance) : null;
    cashComparison = buildCashRecountComparison({
      actual: numericValue,
      expected,
      capturedAt: typeof oneCAudit.capturedAt === 'string' ? oneCAudit.capturedAt : editedAt.toISOString(),
      oneCCheckedAt: personalAudit && typeof personalAudit.oneCCheckedAt === 'string' ? personalAudit.oneCCheckedAt : null,
      cashboxName: personalAudit && typeof personalAudit.cashboxName === 'string' ? personalAudit.cashboxName : '',
      sourceError: personalAudit && typeof personalAudit.error === 'string' ? personalAudit.error : null,
    });
    let nextHandoverData: Record<string, unknown> = {
      ...existingData,
      [shiftControlOneCAuditKey]: oneCAudit,
      cashComparison,
      cashRecountInputHistory: appendCashRecountInputHistory(
        existingData.cashRecountInputHistory,
        numericValue,
        editedAt.toISOString(),
      ),
    };
    const decision = decideCashRecountAction({
      comparison: cashComparison,
      hasComment: Boolean(commentSource.trim()),
    });
    const completedWithDiscrepancy = decision === 'complete_mismatch';
    nextHandoverData = {
      ...nextHandoverData,
      cashRecountStage: completedWithDiscrepancy ? 'completed_with_discrepancy' : 'completed',
      cashRecountAttempt: decisionStage === 'initial' ? 1 : 2,
    };
    data.numericValue = numericValue;
    data.comment = '';
    data.handoverData = withEmployeeRevision(task, nextHandoverData, editedAt) as Prisma.InputJsonValue;
  } else if (task.category === 'credit') {
    const checkStatus = readInteger(payload.integerValue);
    const hasDiscrepancy = checkStatus === 2;

    if (checkStatus === null || ![0, 1, 2].includes(checkStatus)) {
      return Response.json({ error: 'Выберите результат сверки операций Т-Банка' }, { status: 400 });
    }
    if (hasDiscrepancy && !commentSource.trim()) {
      return Response.json({ error: 'Опишите проблему по операциям Т-Банка' }, { status: 400 });
    }
    data.integerValue = checkStatus;
    data.numericValue = null;
    data.booleanValue = !hasDiscrepancy;
    data.comment = checkStatus === 0 ? '' : commentSource.trim();
    data.handoverData = withEmployeeRevision(task, withoutRevisionHistory(task.handoverData), editedAt) as Prisma.InputJsonValue;
  } else {
    data.textValue = textValue;
    data.handoverData = withEmployeeRevision(task, withoutRevisionHistory(task.handoverData), editedAt) as Prisma.InputJsonValue;
  }

  const updatedTask = cashComparison
    ? await prisma.$transaction(async (tx) => {
        const updated = await tx.shiftControlTask.update({ where: { id: task.id }, data });
        await syncCashRecountWorkdayControl(tx, {
          userId: user.id,
          taskId: task.id,
          runId: task.runId,
          date: task.run.date,
          comment: data.comment,
          comparison: cashComparison!,
          now: editedAt,
        });
        return updated;
      })
    : await prisma.shiftControlTask.update({ where: { id: task.id }, data });

  await resolveTaskNotifications(prisma, [task.id], editedAt);

  return Response.json({ task: taskForEmployee(updatedTask) });
}
