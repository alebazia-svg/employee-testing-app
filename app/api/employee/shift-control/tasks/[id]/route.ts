import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { usesWorkdayShiftControl } from '@/lib/workday';

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

async function runHasAcquiringPayments(runId: number) {
  const acquiringTasks = await prisma.shiftControlTask.findMany({
    where: { runId, category: 'acquiring', status: 'done' },
    select: { integerValue: true, numericValue: true },
  });
  return acquiringTasks.some((task) => {
    if (task.integerValue === 1 || task.integerValue === 2) return true;
    return task.integerValue === null && task.numericValue !== null && Number(task.numericValue) > 0;
  });
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
  const existingStoreClosing = readRecord(existing, 'storeClosing') ?? {};
  const existingPhotos = readRecord(existing, 'photos') ?? {};

  const personalCashBalance = readFormNumber(formData, 'personalCashBalance');
  const discrepancyType = readFormString(formData, 'discrepancyType');
  const discrepancyAmount = readFormNumber(formData, 'discrepancyAmount');
  const hasSberbankAcquiring = readFormBoolean(formData, 'hasSberbankAcquiring');
  const sberbankTerminalTotal = readFormNumber(formData, 'sberbankTerminalTotal');
  const hasTbankCredit = readFormBoolean(formData, 'hasTbankCredit');
  const tbankTerminalTotal = readFormNumber(formData, 'tbankTerminalTotal');
  const encashmentAmount = readFormNumber(formData, 'encashmentAmount');
  const comment = readFormString(formData, 'comment');
  const photos = { ...existingPhotos };
  const photoFields = [
    ['personalStatementPhoto', 'personalStatement', 'personal-statement'],
    ['personalAcquiringReceiptsPhoto', 'personalAcquiringReceipts', 'personal-acquiring-receipts'],
    ['sberbankTerminalReportPhoto', 'sberbankTerminalReport', 'sberbank-terminal-report'],
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
      requiresEncashment: personalCashBalance !== null ? personalCashBalance > 50000 : Boolean(existingPersonalCash.requiresEncashment),
      encashmentAmount,
    },
    storeClosing: isClosingShift(task.run.workDayEntry.shiftCode)
      ? {
          ...existingStoreClosing,
          hasSberbankAcquiring: hasSberbankAcquiring ?? existingStoreClosing.hasSberbankAcquiring ?? null,
          sberbankTerminalTotal: hasSberbankAcquiring === false ? 0 : sberbankTerminalTotal,
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
    const storeClosing = readRecord(handoverData, 'storeClosing') ?? {};
    const personalCashBalance = readNumber(personalCash.cashBalance);
    const discrepancyType = typeof personalCash.discrepancyType === 'string' ? personalCash.discrepancyType : '';
    const discrepancyAmount = readNumber(personalCash.discrepancyAmount);
    const hasSberbankAcquiring = readBoolean(storeClosing.hasSberbankAcquiring);
    const sberbankTerminalTotal = readNumber(storeClosing.sberbankTerminalTotal);
    const hasTbankCredit = readBoolean(storeClosing.hasTbankCredit);
    const tbankTerminalTotal = readNumber(storeClosing.tbankTerminalTotal);
    const encashmentAmount = readNumber(personalCash.encashmentAmount);
    const comment = isRecord(handoverData) && typeof handoverData.comment === 'string' ? handoverData.comment.trim() : '';
    const isRetail = user.department === 'retail';
    const isClosingEmployee = isRetail && isClosingShift(task.run.workDayEntry.shiftCode);
    const requiresEncashment = personalCashBalance !== null && personalCashBalance > 50000;
    const requiresDiscrepancyComment =
      (discrepancyType === 'surplus' || discrepancyType === 'shortage') && discrepancyAmount !== null && discrepancyAmount > 300;
    const requiresAcquiringReceiptsPhoto = isRetail && (hasSberbankAcquiring === true || await runHasAcquiringPayments(task.runId));

    if (personalCashBalance === null) return Response.json({ error: 'Укажите остаток наличных в моей кассе' }, { status: 400 });
    if (!['none', 'surplus', 'shortage'].includes(discrepancyType)) return Response.json({ error: 'Укажите расхождение по моей кассе' }, { status: 400 });
    if (discrepancyType !== 'none' && discrepancyAmount === null) return Response.json({ error: 'Укажите сумму расхождения' }, { status: 400 });
    if (requiresDiscrepancyComment && !comment) return Response.json({ error: 'Добавьте комментарий: расхождение больше 300 ₽' }, { status: 400 });
    if (requiresAcquiringReceiptsPhoto && !hasSavedPhoto(handoverData, 'personalAcquiringReceipts')) {
      return Response.json({ error: 'Сделайте фото чеков оплат картой за смену' }, { status: 400 });
    }
    if (requiresEncashment) {
      if (encashmentAmount === null) return Response.json({ error: 'Укажите сумму инкассации' }, { status: 400 });
      if (!hasSavedPhoto(handoverData, 'encashmentDocument')) {
        return Response.json({ error: 'Сфотографируйте деньги перед помещением в резерв или депозитный сейф.' }, { status: 400 });
      }
    }
    if (isClosingEmployee) {
      if (hasSberbankAcquiring === null) return Response.json({ error: 'Укажите, были ли операции по терминалу Сбербанка' }, { status: 400 });
      if (hasSberbankAcquiring) {
        if (!hasSavedPhoto(handoverData, 'sberbankTerminalReport')) return Response.json({ error: 'Сделайте фото сверки итогов Сбербанка' }, { status: 400 });
        if (sberbankTerminalTotal === null) return Response.json({ error: 'Укажите сумму по сверке итогов Сбербанка' }, { status: 400 });
      }
      if (hasTbankCredit === null) return Response.json({ error: 'Укажите, были ли операции по терминалу Т-Банка' }, { status: 400 });
      if (hasTbankCredit) {
        if (!hasSavedPhoto(handoverData, 'tbankReceipts')) return Response.json({ error: 'Сделайте фото чеков Т-Банка за смену' }, { status: 400 });
        if (!hasSavedPhoto(handoverData, 'tbankTerminalReport')) return Response.json({ error: 'Сделайте фото сверки итогов Т-Банка' }, { status: 400 });
        if (tbankTerminalTotal === null) return Response.json({ error: 'Укажите сумму по сверке итогов Т-Банка' }, { status: 400 });
      }
      if (!hasSavedPhoto(handoverData, 'zReport')) return Response.json({ error: 'Сделайте фото чека закрытия смены' }, { status: 400 });
    }

    try {
      const photos = {
        personalStatement: savedPhoto(handoverData, 'personalStatement'),
        personalAcquiringReceipts: requiresAcquiringReceiptsPhoto ? savedPhoto(handoverData, 'personalAcquiringReceipts') : null,
        sberbankTerminalReport: isClosingEmployee && hasSberbankAcquiring ? savedPhoto(handoverData, 'sberbankTerminalReport') : null,
        tbankReceipts: isClosingEmployee && hasTbankCredit ? savedPhoto(handoverData, 'tbankReceipts') : null,
        tbankTerminalReport: isClosingEmployee && hasTbankCredit ? savedPhoto(handoverData, 'tbankTerminalReport') : null,
        zReport: isClosingEmployee ? savedPhoto(handoverData, 'zReport') : null,
        encashmentDocument: requiresEncashment ? savedPhoto(handoverData, 'encashmentDocument') : null,
      };
      const now = new Date();
      const finalHandoverData = {
        draft: false,
        shiftCode: task.run.workDayEntry.shiftCode,
        submittedAt: now.toISOString(),
        scope: {
          personalCash: true,
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
          requiresEncashment,
          encashmentAmount: requiresEncashment ? encashmentAmount : null,
        },
        storeClosing: isClosingEmployee
          ? {
              hasSberbankAcquiring,
              sberbankTerminalTotal,
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

      return Response.json({ ...result, message: 'Смена сдана, рабочий день завершён' });
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
      const updatedTask = await prisma.shiftControlTask.update({
        where: { id: task.id },
        data: {
          status: 'done',
          completedAt: new Date(),
          textValue: savedPhoto.storagePath,
          comment: 'Фото чека открытия смены прикреплено',
        },
      });

      return Response.json({ task: updatedTask });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить фото чека открытия смены' }, { status: 400 });
    }
  }

  const payload = await req.json().catch(() => ({}));
  const commentSource = typeof payload.comment === 'string' ? payload.comment : typeof payload.textValue === 'string' ? payload.textValue : '';
  const textValue = typeof payload.textValue === 'string' ? payload.textValue.trim() : null;

  const data: {
    status: 'done';
    completedAt: Date;
    comment: string;
    numericValue?: number | null;
    integerValue?: number | null;
    booleanValue?: boolean | null;
    textValue?: string | null;
  } = {
    status: 'done',
    completedAt: new Date(),
    comment: commentSource.trim(),
  };

  if (task.category === 'cash') {
    const numericValue = readNumber(payload.numericValue);
    if (numericValue === null) {
      return Response.json({ error: 'Укажите сумму' }, { status: 400 });
    }
    data.numericValue = numericValue;
  } else if (task.category === 'acquiring') {
    const numericValue = readNumber(payload.numericValue);
    const providedCheckStatus = readInteger(payload.integerValue);
    const checkStatus = providedCheckStatus ?? (numericValue !== null ? 1 : null);
    const hasDiscrepancy = checkStatus === 2;

    if (checkStatus === null || ![0, 1, 2].includes(checkStatus)) {
      return Response.json({ error: 'Выберите результат сверки оплат картой' }, { status: 400 });
    }
    if ((checkStatus === 1 || checkStatus === 2) && numericValue === null) {
      return Response.json({ error: 'Укажите сумму оплат по терминалу' }, { status: 400 });
    }
    if (hasDiscrepancy && !commentSource.trim()) {
      return Response.json({ error: 'Опишите расхождение по оплатам картой' }, { status: 400 });
    }
    data.integerValue = checkStatus;
    data.numericValue = checkStatus === 0 ? 0 : numericValue;
    data.booleanValue = !hasDiscrepancy;
    data.comment = checkStatus === 0 ? '' : commentSource.trim();
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
  } else {
    data.textValue = textValue;
  }

  const updatedTask = await prisma.shiftControlTask.update({
    where: { id: task.id },
    data,
  });

  return Response.json({ task: updatedTask });
}
