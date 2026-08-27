import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function OpenAdminInboxEventPage(props: { params: Promise<{ eventId: string }> }) {
  const params = await props.params;
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');

  const receipt = await prisma.adminInboxReceipt.findFirst({
    where: { eventId: params.eventId, userId: admin.id },
    include: { event: { select: { href: true } } },
  });
  if (!receipt) redirect('/admin/inbox');
  if (!receipt.readAt) await prisma.adminInboxReceipt.update({ where: { id: receipt.id }, data: { readAt: new Date() } });
  redirect(receipt.event.href);
}
