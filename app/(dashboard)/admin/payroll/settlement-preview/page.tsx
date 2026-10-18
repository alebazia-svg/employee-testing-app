import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminPayrollPage from '../PayrollClient';
import { septemberCalculation } from './september-calculation';
import '../payroll-settlement-preview.css';
import { readFile } from 'node:fs/promises';

export const dynamic = 'force-dynamic';
export default async function SettlementPreviewPage() {
  if (process.env.PAYROLL_SETTLEMENT_PREVIEW !== '1') notFound();
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const evidenceDirectory = process.env.PAYROLL_SETTLEMENT_EVIDENCE_DIR;
  const settlementEvidence = evidenceDirectory ? {
    run: JSON.parse(await readFile(`${evidenceDirectory}/september-final-run.json`, 'utf8')),
    source: JSON.parse(await readFile(`${evidenceDirectory}/september-source.json`, 'utf8')),
    rules: JSON.parse(await readFile(`${evidenceDirectory}/september-rules.json`, 'utf8')),
  } : undefined;
  if (settlementEvidence && (settlementEvidence.run.period?.periodKey !== '2026-09' || settlementEvidence.run.status !== 'FINAL' || settlementEvidence.source.period?.periodKey !== '2026-09' || !Array.isArray(settlementEvidence.source.sales?.rows) || !Array.isArray(settlementEvidence.rules))) {
    throw new Error('Данные карточки не соответствуют сентябрьской ведомости.');
  }
  // Authenticated, local-only approval snapshot. No payment mutations.
  return <AdminPayrollPage settlementEvidence={settlementEvidence} settlementRows={[
    { name: 'Кештова Бэла', paid: 0, remaining: 208300 },
    { name: 'Кумахова Диана', paid: 0, remaining: 15000, first: 7800, firstDocument: '00OF-001805' },
    { name: 'Ахобекова Залина', paid: 106000, remaining: 0, document: '00OF-001901', first: 10000, advance: 13000, advancePayments: [{date: '1 октября', amount: 13000, doc: '00OF-001802'}] },
    { name: 'Тохов Астемир', paid: 98000, remaining: 0, document: '00OF-001901', first: 30000 },
    { name: 'Чеченова Милана', paid: 76500, remaining: 0, document: '00OF-001901', first: 12500 },
    { name: 'Костеренко Магомед', paid: 61000, remaining: 0, document: '00OF-001901', first: 12500 },
    { name: 'Стажёр розницы · поклейка', paid: 19500, remaining: 0, document: '00OF-001901', first: 24500, advance: 20000 },
    { name: 'Хурзокова Лиана', paid: 0, remaining: 0, first: 130500 },
    { name: 'Абшаева Зухра', paid: 0, remaining: 0, first: 64000, advance: 2000 },
    { name: 'Жамбекова Саида', paid: 0, remaining: 0, first: 30000, firstDocument: '00OF-001805' },
    { name: 'Атабиева Марианна', paid: 0, remaining: 0, first: 50000, firstDocument: '00OF-001804' },
    { name: 'Улубиев Марат', paid: 0, remaining: 0, other: 10000 },
    { name: 'Кумыков Мухаммед', paid: 7500, remaining: 0, document: '00OF-001901', accrual: 7500, note: 'В 1С: СтажерЗакупка. По вашему пояснению — оплата работы 12–16 октября.' },
    { name: 'Татьяна', paid: 15000, remaining: 0, document: '00OF-001900' },
  ].map(row => ({...row, calculation: septemberCalculation[row.name]}))} />;
}
