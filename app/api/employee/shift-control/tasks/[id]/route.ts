import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { getCashStatementDimensions, getCashStatementSummary } from '@/lib/one-c';
import { shiftControlEmployeeRevisionHistoryKey, shiftControlOneCAuditKey, stripShiftControlOneCAudit } from '@/lib/shift-control-one-c-audit';
import { usesWorkdayShiftControl } from '@/lib/workday';

const cashStatementOrganizationSearchName = 'оффоника';
const reserveCashboxSearchName = 'резерв под телефоны';
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
  return shiftCode === '11_20';
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

async function saveHandoverDraft(formData: FormData, task: { id: number; runId: number; handoverData: unknown; run: { workDayEntry: { shiftCode: string } } }) {
  const existing = isRecord(task.handoverData) ? task.handoverData : {};
  const existingPersonalCash = readRecord(existing, 'personalCash') ?? {};
  const existingReserveCash = readRecord(existing, 'reserveCash') ?? {};
  const existingStoreClosing = readRecord(existing, 'storeClosing') ?? {};
  const existingPhotos = readRecord(existing, 'photos') ?? {};

  const personalCashBalance = readFormNumber(formData, 'personalCashBalance');
  const reserveCashBalance = readFormNumber(formData, 'reserveCashBalance');
  const discrepancyType = readFormString(formData, 'discrepancyType');
  const discrepancyAmount = readFormNumber(formData, 'discrepancyAmount');
  const terminalHadOperations = readFormBoolean(formData, 'terminalHadOperations');
  const terminalReconciliation = readFormString(formData, 'terminalReconciliation');
  const terminalComment = readFormString(formData, 'terminalComment');
  const hasTbankCredit = readFormBoolean(formData, 'hasTbankCredit');
  const tbankTerminalTotal = readFormNumber(formData, 'tbankTerminalTotal');
  const encashmentAmount = readFormNumber(formData, 'encashmentAmount');
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

  const nextData = {
    ...existing,
    draft: true,
    shiftCode: task.run.workDayEntry.shiftCode,
    updatedAt: new Date().toISOString(),
    personalCash: {
      ...existingPersonalCash,
      cashBalance: personalCashBalance,
      discrepancyType: discrepancyType || existingPersonalCash.discrepancyType || '',
      discrepancyAmount: discrepancyType === 'none' ? null : discrepancyAmount,
      hadWithdrawal: null,
      withdrawalAmount: null,
      cashOrderAmount: null,
      withdrawalDifference: null,
      hasTbankCredit: hasTbankCredit ?? existingPersonalCash.hasTbankCredit ?? null,
      requiresEncashment: personalCashBalance !== null ? personalCashBalance > 50000 : Boolean(existingPersonalCash.requiresEncashment),
      encashmentAmount,
    },
    reserveCash: {
      ...existingReserveCash,
      cashBalance: reserveCashBalance,
    },
    terminalCheck: {
      hadOperations: terminalHadOperations,
      reconciliation: terminalHadOperations ? terminalReconciliation : 'not_required',
      comment: terminalReconciliation === 'discrepancy' ? terminalComment : '',
    },
    storeClosing: isClosingShift(task.run.workDayEntry.shiftCode)
      ? {
          ...existingStoreClosing,
          hasTbankCredit: hasTbankCredit ?? existingStoreClosing.hasTbankCredit ?? null,
          tbankTerminalTotal: hasTbankCredit ? tbankTerminalTotal : null,
          zReportRequired: true,
        }
      : null,
    comment,
    photos,
  };

  const updatedTask = await prisma.shiftControlTask.update({
    where: { id: task.id },
    data: { handoverData: nextData as Prisma.InputJsonValue, comment },
  });

  return Response.json({ task: updatedTask });
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
        return await saveHandoverDraft(formData, task);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить шаг сдачи смены' }, { status: 400 });
      }
    }

    const draftResponse = await saveHandoverDraft(formData, task);
    const draftPayload = await draftResponse.json();
    const handoverData = draftPayload.task.handoverData;
    const personalCash = readRecord(handoverData, 'personalCash') ?? {};
    const reserveCash = readRecord(handoverData, 'reserveCash') ?? {};
    const storeClosing = readRecord(handoverData, 'storeClosing') ?? {};
    const personalCashBalance = readNumber(personalCash.cashBalance);
    const reserveCashBalance = readNumber(reserveCash.cashBalance);
    const discrepancyType = typeof personalCash.discrepancyType === 'string' ? personalCash.discrepancyType : '';
    const discrepancyAmount = readNumber(personalCash.discrepancyAmount);
    const terminalCheck = readRecord(handoverData, 'terminalCheck') ?? {};
    const terminalHadOperations = readBoolean(terminalCheck.hadOperations);
    const terminalReconciliation = typeof terminalCheck.reconciliation === 'string' ? terminalCheck.reconciliation : '';
    const terminalComment = typeof terminalCheck.comment === 'string' ? terminalCheck.comment.trim() : '';
    const hasTbankCredit = readBoolean(personalCash.hasTbankCredit ?? storeClosing.hasTbankCredit);
    const tbankTerminalTotal = readNumber(storeClosing.tbankTerminalTotal);
    const encashmentAmount = readNumber(personalCash.encashmentAmount);
    const comment = isRecord(handoverData) && typeof handoverData.comment === 'string' ? handoverData.comment.trim() : '';
    const isRetail = user.department === 'retail';
    const isClosingEmployee = isRetail && isClosingShift(task.run.workDayEntry.shiftCode);
    const requiresEncashment = personalCashBalance !== null && personalCashBalance > 50000;
    const requiresDiscrepancyComment =
      (discrepancyType === 'surplus' || discrepancyType === 'shortage') && discrepancyAmount !== null && discrepancyAmount > 300;

    if (personalCashBalance === null) return Response.json({ error: 'Укажите остаток наличных в моей кассе' }, { status: 400 });
    if (reserveCashBalance === null) return Response.json({ error: 'Укажите остаток наличных в резерве' }, { status: 400 });
    if (!['none', 'surplus', 'shortage'].includes(discrepancyType)) return Response.json({ error: 'Укажите расхождение по моей кассе' }, { status: 400 });
    if (discrepancyType !== 'none' && discrepancyAmount === null) return Response.json({ error: 'Укажите сумму расхождения' }, { status: 400 });
    if (requiresDiscrepancyComment && !comment) return Response.json({ error: 'Добавьте комментарий: расхождение больше 300 ₽' }, { status: 400 });
    if (isRetail) {
      if (terminalHadOperations === null) return Response.json({ error: 'Укажите, были ли новые операции терминала' }, { status: 400 });
      if (terminalHadOperations && !['matched', 'discrepancy'].includes(terminalReconciliation)) {
        return Response.json({ error: 'Укажите результат сверки терминала с 1С' }, { status: 400 });
      }
      if (terminalHadOperations && terminalReconciliation === 'discrepancy' && !terminalComment) {
        return Response.json({ error: 'Опишите расхождение по операциям терминала' }, { status: 400 });
      }
      if (terminalHadOperations && !hasSavedPhoto(handoverData, 'terminalReceipts')) {
        return Response.json({ error: 'Сфотографируйте новые чеки терминала' }, { status: 400 });
      }
      if (hasTbankCredit === null) return Response.json({ error: 'Укажите, были ли операции через терминал Т-Банка' }, { status: 400 });
      if (hasTbankCredit && !hasSavedPhoto(handoverData, 'tbankReceipts')) {
        return Response.json({ error: 'Сделайте фото чеков Т-Банка за смену' }, { status: 400 });
      }
    }
    if (requiresEncashment) {
      if (encashmentAmount === null) return Response.json({ error: 'Укажите сумму инкассации' }, { status: 400 });
      if (!hasSavedPhoto(handoverData, 'encashmentDocument')) {
        return Response.json({ error: 'Сфотографируйте деньги перед помещением в резерв или депозитный сейф.' }, { status: 400 });
      }
    }
    if (isClosingEmployee) {
      if (hasTbankCredit) {
        if (!hasSavedPhoto(handoverData, 'tbankTerminalReport')) return Response.json({ error: 'Сделайте фото сверки итогов Т-Банка' }, { status: 400 });
        if (tbankTerminalTotal === null) return Response.json({ error: 'Укажите сумму по сверке итогов Т-Банка' }, { status: 400 });
      }
      if (!hasSavedPhoto(handoverData, 'zReport')) return Response.json({ error: 'Сделайте фото чека закрытия смены' }, { status: 400 });
    }

    try {
      const previousTerminalTask = await prisma.shiftControlTask.findFirst({
        where: {
          runId: task.runId,
          category: 'acquiring',
          status: 'done',
          completedAt: { not: null },
        },
        orderBy: { completedAt: 'desc' },
      });
      const photos = {
        personalStatement: savedPhoto(handoverData, 'personalStatement'),
        terminalReceipts: isRetail && terminalHadOperations ? savedPhoto(handoverData, 'terminalReceipts') : null,
        tbankReceipts: isRetail && hasTbankCredit ? savedPhoto(handoverData, 'tbankReceipts') : null,
        tbankTerminalReport: isClosingEmployee && hasTbankCredit ? savedPhoto(handoverData, 'tbankTerminalReport') : null,
        zReport: isClosingEmployee ? savedPhoto(handoverData, 'zReport') : null,
        encashmentDocument: requiresEncashment ? savedPhoto(handoverData, 'encashmentDocument') : null,
      };
      const now = new Date();
      const oneCAudit = await captureOneCCashAudit({
        userId: user.id,
        date: task.run.date,
        includeReserve: true,
        capturedAt: now,
      });
      const finalHandoverData = {
        draft: false,
        shiftCode: task.run.workDayEntry.shiftCode,
        submittedAt: now.toISOString(),
        [shiftControlOneCAuditKey]: oneCAudit,
        scope: {
          personalCash: true,
          reserveCash: true,
          storeClosing: isClosingEmployee,
        },
        personalCash: {
          cashBalance: personalCashBalance,
          discrepancyType,
          discrepancyAmount: discrepancyType === 'none' ? null : discrepancyAmount,
          hadWithdrawal: null,
          withdrawalAmount: null,
          cashOrderAmount: null,
          withdrawalDifference: null,
          hasTbankCredit,
          requiresEncashment,
          encashmentAmount: requiresEncashment ? encashmentAmount : null,
        },
        reserveCash: {
          cashBalance: reserveCashBalance,
        },
        terminalCheck: isRetail ? {
          intervalFrom: previousTerminalTask?.completedAt?.toISOString() ?? task.run.workDayEntry.startedAt.toISOString(),
          intervalTo: now.toISOString(),
          previousTaskId: previousTerminalTask?.id ?? null,
          hadOperations: terminalHadOperations,
          reconciliation: terminalHadOperations ? terminalReconciliation : 'not_required',
          comment: terminalReconciliation === 'discrepancy' ? terminalComment : '',
        } : null,
        storeClosing: isClosingEmployee
          ? {
              hasTbankCredit,
              tbankTerminalTotal: hasTbankCredit ? tbankTerminalTotal : null,
              zReportRequired: true,
            }
          : null,
        comment,
        photos,
      };

      const result = await prisma.$transaction(async (tx) => {
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
        const tasks = await tx.shiftControlTask.findMany({
          where: { runId: task.runId },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        return { task: updatedTask, tasks, run: updatedRun, workDay };
      });

      return Response.json({
        ...result,
        task: taskForEmployee(result.task),
        tasks: result.tasks.map(taskForEmployee),
        message: 'Смена сдана, рабочий день завершён',
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

  if (task.category === 'cash') {
    const numericValue = readNumber(payload.numericValue);
    if (numericValue === null) {
      return Response.json({ error: 'Укажите сумму' }, { status: 400 });
    }
    const existingData = isRecord(task.handoverData) ? task.handoverData : {};
    const existingAudit = existingData[shiftControlOneCAuditKey];
    const oneCAudit = task.status === 'done' && existingAudit
      ? existingAudit
      : await captureOneCCashAudit({
          userId: user.id,
          date: task.run.date,
          includeReserve: false,
          capturedAt: completedAt,
        });
    data.numericValue = numericValue;
    data.handoverData = withEmployeeRevision(task, {
      ...existingData,
      [shiftControlOneCAuditKey]: oneCAudit,
    }, editedAt) as Prisma.InputJsonValue;
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

  const updatedTask = await prisma.shiftControlTask.update({
    where: { id: task.id },
    data,
  });

  return Response.json({ task: taskForEmployee(updatedTask) });
}
