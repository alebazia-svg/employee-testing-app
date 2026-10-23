import 'server-only';
import { prisma } from '@/lib/prisma';

export const employeePreviewLifetimeMs = 30 * 60_000;
export const employeePreviewHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };
export function previewEmployeeAllowed(user: { role: string; isActive: boolean; portalArea: string }) {
  return user.isActive && user.role === 'EMPLOYEE' && ['WORKDAY', 'PROCUREMENT'].includes(user.portalArea);
}
/** The visit id has no authority without the original administrator's live session. */
export async function readEmployeePreview(adminId: number, visitId: string, now = new Date()) {
  const visit = await prisma.employeePreviewVisit.findFirst({ where: { id: visitId, adminId, expiresAt: { gt: now } } });
  if (!visit) return null;
  const employee = await prisma.user.findUnique({ where: { id: visit.employeeId }, select: { id: true, name: true, department: true, role: true, isActive: true, portalArea: true, oneCManagerName: true, qrScanMode: true } });
  if (!employee || !previewEmployeeAllowed(employee)) return null;
  return { visit, employee };
}
