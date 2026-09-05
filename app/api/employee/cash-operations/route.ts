import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { createCashOperationFailureAlert } from '@/lib/cash-operation-admin-alert';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';
import { resolveCarriedCashEncashmentExceptions } from '@/lib/workday-cash-encashment-resolution';
import { createOneCCashExpenseOrder, getCashStatementDimensions } from '@/lib/one-c';
import { requestBodyTooLarge, validateEmployeeImage } from '@/lib/image-upload';

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

const targetCashboxNameByDirection = {
  phone_reserve: 'резерв под телефоны',
  deposit_safe: 'сейф депозитный',
} as const;

function readNumber(value: FormDataEntryValue | null) {
  if (value === null || value === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveInteger(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function readDateKey(value: FormDataEntryValue | null) {
  const date = readString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function readClientDateKey(value: FormDataEntryValue | null) {
  const timestamp = readString(value);
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : getMoscowDateKey(date);
}

function isPhoto(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function canUseDirection(user: { department: string; name?: string | null; login?: string | null }, direction: string) {
  if (!usesWorkdayShiftControl(user)) return false;
  if (direction === 'deposit_safe') return user.department === 'retail' || user.department === 'wholesale';
  if (direction === 'phone_reserve') return user.department === 'retail';
  return false;
}

async function savePhoto(file: File, workDayId: number, direction: string) {
  const { extension } = await validateEmployeeImage(file);
  const directory = path.join(process.cwd(), 'uploads', 'cash-operations', String(workDayId));
  await mkdir(directory, { recursive: true });

  const fileName = `${direction}-${randomUUID()}.${extension}`;
  const absolutePath = path.join(directory, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (requestBodyTooLarge(req)) return Response.json({ error: 'Фото слишком большое. Максимальный размер — 8 МБ.' }, { status: 413 });
  const formData = await req.formData().catch(() => null);
  if (!formData) return Response.json({ error: 'Invalid form data' }, { status: 400 });

  const direction = readString(formData.get('direction'));
  if (!canUseDirection(user, direction)) {
    return Response.json({ error: 'Недоступное направление кассовой операции' }, { status: 403 });
  }

  const amount = readNumber(formData.get('amount'));
  if (amount === null) return Response.json({ error: 'Укажите сумму' }, { status: 400 });

  const idempotencyKey = readString(formData.get('idempotencyKey'));
  if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
    return Response.json({ error: 'Не удалось сформировать безопасный ключ операции. Повторите действие.' }, { status: 400 });
  }

  const photo = formData.get('photo');
  if (!isPhoto(photo)) return Response.json({ error: 'Сделайте фото' }, { status: 400 });

  try {
    const existing = await prisma.cashOperation.findUnique({ where: { idempotencyKey } });
    if (existing && existing.userId !== user.id) return Response.json({ error: 'Конфликт ключа операции' }, { status: 409 });
    if (existing) {
      if (existing.amount !== amount || existing.direction !== direction) {
        return Response.json({ error: 'Параметры повторной операции не совпадают с первоначальными' }, { status: 409 });
      }
      // A device retry acknowledges the original durable record, even tomorrow.
      // Only the server retry/control workflow may reprocess it in 1C: that
      // workflow owns the lease and respects administrator manual takeover.
      const posted = existing.status === 'posted_1c_pair'
        && Boolean(existing.oneCDocumentRef && existing.oneCReceiptDocumentRef);
      if (posted) {
        await resolveCarriedCashEncashmentExceptions(prisma, {
          employeeId: user.id, operationId: existing.id, operationDate: existing.date,
          operationAmount: existing.amount, operationCreatedAt: existing.createdAt,
        });
      }
      return Response.json({
        operation: { ...existing, createdAt: existing.createdAt.toISOString(), updatedAt: existing.updatedAt.toISOString() },
        message: 'Инкассация уже сохранена в портале.',
      }, { status: posted || existing.status === 'resolved_manual' ? 200 : 202 });
    }

    const submittedWorkDayId = readPositiveInteger(formData.get('workDayEntryId'));
    const submittedWorkDayDate = readDateKey(formData.get('workDayDate'));
    const clientDate = readClientDateKey(formData.get('clientCreatedAt'));
    if ((submittedWorkDayId === null) !== (submittedWorkDayDate === null)) {
      return Response.json({ error: 'Не удалось подтвердить исходную смену операции' }, { status: 400 });
    }

    const currentDate = getMoscowDateKey();
    let date = submittedWorkDayId === null && clientDate ? clientDate : currentDate;
    let workDay = submittedWorkDayId === null
      ? await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } })
      : await prisma.workDayEntry.findUnique({ where: { id: submittedWorkDayId } });

    if (workDay && submittedWorkDayId !== null) {
      if (workDay.userId !== user.id || workDay.date !== submittedWorkDayDate) {
        return Response.json({ error: 'Исходная смена операции не принадлежит сотруднику' }, { status: 409 });
      }
      date = workDay.date;
    }
    if (!workDay) {
      return Response.json({
        error: submittedWorkDayId === null && date === currentDate ? 'Сначала начните рабочий день' : 'Исходная смена операции не найдена',
      }, { status: submittedWorkDayId === null && date === currentDate ? 400 : 409 });
    }
    const operation = await (async () => {
      const photoPath = await savePhoto(photo, workDay.id, direction);
      return prisma.cashOperation.create({
        data: {
          userId: user.id,
          workDayEntryId: workDay.id,
          date,
          department: user.department,
          direction,
          amount,
          photoPath,
          comment: readString(formData.get('comment')),
          status: 'pending_1c',
          idempotencyKey,
        },
      });
    })();

    const deferToAdmin = async (message: string) => {
      const failedOperation = await prisma.$transaction(async (tx) => {
        const saved = await tx.cashOperation.update({ where: { id: operation.id }, data: { status: 'one_c_error', oneCError: message } });
        await createCashOperationFailureAlert({ db: tx, operation: saved, employeeName: user.name, error: message, occurredAt: new Date() });
        return saved;
      });
      return Response.json({
        operation: { ...failedOperation, createdAt: failedOperation.createdAt.toISOString(), updatedAt: failedOperation.updatedAt.toISOString() },
        manualControl: true,
        message: 'Инкассация зафиксирована и передана администратору.',
      }, { status: 202 });
    };

    // Once the originating shift is closed (or its calendar day has passed),
    // an administrator may already have created the cash documents manually.
    // Preserve the employee's amount and photo, but never race that manual work
    // with a delayed automatic 1C write.
    if (workDay.date !== currentDate || workDay.status !== 'active' || workDay.endedAt) {
      return deferToAdmin('Операция поступила после завершения исходной смены. Автоматическое проведение отключено; требуется решение администратора.');
    }

    if (operation.status !== 'posted_1c_pair' || !operation.oneCDocumentRef || !operation.oneCReceiptDocumentRef) {
      const mapping = await prisma.userOneCCashboxMapping.findUnique({ where: { userId: user.id } });
      let dimensions: Awaited<ReturnType<typeof getCashStatementDimensions>>;
      try {
        dimensions = await getCashStatementDimensions();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Связь с 1С недоступна.';
        return deferToAdmin(message);
      }
      const organization = dimensions.organizations.find((item) => normalizeSearchText(item.name).includes('оффоника')) ?? dimensions.organizations[0] ?? null;
      const targetCashboxName = targetCashboxNameByDirection[direction as keyof typeof targetCashboxNameByDirection];
      const targetCashbox = dimensions.cashboxes.find((item) => normalizeSearchText(item.name) === targetCashboxName) ?? null;
      if (!mapping?.isActive || !organization || !targetCashbox || !dimensions.ok) {
        const message = !mapping?.isActive
          ? 'Касса сотрудника не привязана к 1С.'
          : !targetCashbox
            ? 'Касса-получатель для выбранного направления не найдена в 1С.'
            : 'Организация или справочник касс 1С недоступны.';
        return deferToAdmin(message);
      }
      let result: Awaited<ReturnType<typeof createOneCCashExpenseOrder>>;
      try {
        result = await createOneCCashExpenseOrder({
          idempotencyKey,
          organizationRef: organization.ref,
          cashboxRef: mapping.oneCCashboxRef,
          targetCashboxRef: targetCashbox.ref,
          employeeName: user.name,
          amount,
          direction: direction as 'phone_reserve' | 'deposit_safe',
          employeeComment: operation.comment,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Связь с 1С прервалась при проведении инкассации.';
        return deferToAdmin(message);
      }
      if (!result.ok || !result.document || !result.receiptDocument || !result.pairComplete) {
        const message = result.error || '1С не создала и не провела связанную пару РКО и ПКО.';
        return deferToAdmin(message);
      }
      await prisma.cashOperation.update({
        where: { id: operation.id },
        data: {
          status: 'posted_1c_pair',
          oneCDocumentRef: result.document.ref,
          oneCDocumentNumber: result.document.number,
          oneCReceiptDocumentRef: result.receiptDocument.ref,
          oneCReceiptDocumentNumber: result.receiptDocument.number,
          oneCError: '',
          oneCCreatedAt: new Date(),
          oneCPostedAt: new Date(),
        },
      });
    }

    const savedOperation = await prisma.cashOperation.findUniqueOrThrow({ where: { id: operation.id } });
    await resolveCarriedCashEncashmentExceptions(prisma, {
      employeeId: user.id,
      operationId: savedOperation.id,
      operationDate: savedOperation.date,
      operationAmount: savedOperation.amount,
      operationCreatedAt: savedOperation.createdAt,
    });

    return Response.json({
      operation: {
        ...savedOperation,
        createdAt: savedOperation.createdAt.toISOString(),
        updatedAt: savedOperation.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить операцию' }, { status: 400 });
  }
}
