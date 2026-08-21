import { getCurrentUser } from './auth';

export async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.role !== 'ADMIN') {
    return { ok: false as const, response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const, user };
}
