import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

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

function canUseDirection(department: string, direction: string) {
  if (direction === 'deposit_safe') return department === 'retail' || department === 'wholesale';
  if (direction === 'phone_reserve') return department === 'retail';
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
  if (!canUseDirection(user.department, direction)) {
    return Response.json({ error: 'Недоступное направление кассовой операции' }, { status: 403 });
  }

  const amount = readNumber(formData.get('amount'));
  if (amount === null) return Response.json({ error: 'Укажите сумму' }, { status: 400 });

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
    const photoPath = await savePhoto(photo, workDay.id, direction);
    const operation = await prisma.cashOperation.create({
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
      },
    });

    return Response.json({
      operation: {
        ...operation,
        createdAt: operation.createdAt.toISOString(),
        updatedAt: operation.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Не удалось сохранить операцию' }, { status: 400 });
  }
}
