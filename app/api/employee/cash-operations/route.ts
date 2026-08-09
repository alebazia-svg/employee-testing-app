import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';
import { createOneCCashExpenseOrder, getCashStatementDimensions } from '@/lib/one-c';

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
  if (!file.type.startsWith('image/')) {
    throw new Error('Добавьте фото');
  }

  const extension = file.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
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

  const date = getMoscowDateKey();
  const workDay = await prisma.workDayEntry.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });
  if (!workDay) {
    return Response.json({ error: 'Сначала начните рабочий день' }, { status: 400 });
  }

  try {
    const existing = await prisma.cashOperation.findUnique({ where: { idempotencyKey } });
    if (existing && existing.userId !== user.id) return Response.json({ error: 'Конфликт ключа операции' }, { status: 409 });
    const operation = existing ?? await (async () => {
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

    if (operation.amount !== amount || operation.direction !== direction || operation.workDayEntryId !== workDay.id) {
      return Response.json({ error: 'Параметры повторной операции не совпадают с первоначальными' }, { status: 409 });
    }

    if (!operation.oneCDocumentRef) {
      const [mapping, dimensions] = await Promise.all([
        prisma.userOneCCashboxMapping.findUnique({ where: { userId: user.id } }),
        getCashStatementDimensions(),
      ]);
      const organization = dimensions.organizations.find((item) => normalizeSearchText(item.name).includes('оффоника')) ?? dimensions.organizations[0] ?? null;
      const targetCashboxName = targetCashboxNameByDirection[direction as keyof typeof targetCashboxNameByDirection];
      const targetCashbox = dimensions.cashboxes.find((item) => normalizeSearchText(item.name) === targetCashboxName) ?? null;
      if (!mapping?.isActive || !organization || !targetCashbox || !dimensions.ok) {
        const message = !mapping?.isActive
          ? 'Касса сотрудника не привязана к 1С.'
          : !targetCashbox
            ? 'Касса-получатель для выбранного направления не найдена в 1С.'
            : 'Организация или справочник касс 1С недоступны.';
        await prisma.cashOperation.update({ where: { id: operation.id }, data: { status: 'one_c_error', oneCError: message } });
        return Response.json({ error: message }, { status: 409 });
      }
      const result = await createOneCCashExpenseOrder({
        idempotencyKey,
        organizationRef: organization.ref,
        cashboxRef: mapping.oneCCashboxRef,
        targetCashboxRef: targetCashbox.ref,
        employeeName: user.name,
        amount,
        direction: direction as 'phone_reserve' | 'deposit_safe',
        employeeComment: operation.comment,
      });
      if (!result.ok || !result.document) {
        const message = result.error || '1С не создала РКО.';
        await prisma.cashOperation.update({ where: { id: operation.id }, data: { status: 'one_c_error', oneCError: message } });
        return Response.json({ error: `Операция сохранена, но РКО не создан: ${message}`, operationId: operation.id }, { status: 502 });
      }
      await prisma.cashOperation.update({
        where: { id: operation.id },
        data: {
          status: 'created_1c',
          oneCDocumentRef: result.document.ref,
          oneCDocumentNumber: result.document.number,
          oneCError: '',
          oneCCreatedAt: new Date(),
        },
      });
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      for (const admin of admins) {
        await prisma.workdayNotification.upsert({
          where: { fingerprint: `cash-operation:${operation.id}:admin:${admin.id}` },
          create: {
            userId: admin.id,
            fingerprint: `cash-operation:${operation.id}:admin:${admin.id}`,
            kind: 'cash_operation_created',
            title: 'Инкассация',
            body: `${user.name} · ${mapping.oneCCashboxName} · ${amount.toLocaleString('ru-RU')} ₽ · ${direction === 'phone_reserve' ? 'Резерв на телефоны' : 'Депозитный сейф'} · РКО №${result.document.number}`,
            scheduledAt: new Date(),
          },
          update: {},
        });
      }
    }

    const savedOperation = await prisma.cashOperation.findUniqueOrThrow({ where: { id: operation.id } });

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
