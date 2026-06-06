import { readFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

function isShiftControlUploadPath(value: string) {
  const normalized = value.replace(/\\/g, '/');
  return normalized.startsWith('uploads/shift-control/') && !normalized.includes('..');
}

function contentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/jpeg';
}

export async function GET(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const storagePath = url.searchParams.get('path') ?? '';
  if (!isShiftControlUploadPath(storagePath)) {
    return Response.json({ error: 'Invalid photo path' }, { status: 400 });
  }

  const root = path.join(process.cwd(), 'uploads', 'shift-control');
  const absolutePath = path.resolve(process.cwd(), storagePath);
  if (!absolutePath.startsWith(root)) {
    return Response.json({ error: 'Invalid photo path' }, { status: 400 });
  }

  try {
    const file = await readFile(absolutePath);
    return new Response(file, {
      headers: {
        'Content-Type': contentType(absolutePath),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return Response.json({ error: 'Photo not found' }, { status: 404 });
  }
}
