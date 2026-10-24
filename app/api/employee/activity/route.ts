import { cookies } from 'next/headers';
import { accessSessionIdentity } from '@/lib/portal-access-journal';
import { sessionCookieName } from '@/lib/session';
import { passwordRequestAllowed } from '@/lib/password-access';
import { getCurrentUser } from '@/lib/auth';
import { parseActivityInput } from '@/lib/employee-activity-policy';
import { writeEmployeeActivity } from '@/lib/employee-activity';
export async function POST(req: Request) {
  // Browsers send Origin for same-origin POST. Reject cross-site and oversized payloads.
  if (!passwordRequestAllowed(req)) return new Response(null, { status: 403 });
  if (Number(req.headers.get('content-length') || 0) > 512) return new Response(null, { status: 413 });
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  if (user.role !== 'EMPLOYEE' || !user.isActive) return new Response(null, { status: 403 });
  const text = await req.text();
  if (text.length > 512) return new Response(null, { status: 413 });
  let value: unknown; try { value = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const input = parseActivityInput(value);
  if (!input) return new Response(null, { status: 400 });
  const identity = accessSessionIdentity((await cookies()).get(sessionCookieName)?.value, user.id);
  const saved = identity ? await writeEmployeeActivity(user.id, identity.sessionHash, input) : false;
  return Response.json({ recorded: saved }, { headers: { 'Cache-Control': 'no-store' } });
}
