// Run in the candidate portal after migrations. Preview by default.
import { Prisma, PrismaClient } from '@prisma/client';
import { getCashStatementDimensions } from '../lib/one-c';
import { FILM_TRAINEE_NAME } from '../lib/payroll-trainee';

const db = new PrismaClient();
const login = 't.nazranov';
const cashboxRef = '26ac1e8f-e36b-11f1-95c1-002590803daf';

async function configure() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== '--apply')) throw Error('Допустимый параметр: --apply');
  const apply = args[0] === '--apply';
  const dimensions = await getCashStatementDimensions();
  const cashbox = dimensions.cashboxes.find(row => row.ref === cashboxRef && row.name === 'Касса Назранов' && row.deleted === false);
  if (!dimensions.ok || !cashbox) throw Error('Личная касса Тимура не подтверждена справочником 1С.');

  return db.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { login }, include: { oneCCashboxMapping: true } });
    if (user.name !== 'Назранов Тимур' || user.role !== 'EMPLOYEE' || user.department !== 'retail' ||
        user.portalArea !== 'WORKDAY' || user.payrollName !== FILM_TRAINEE_NAME || user.qrScanMode !== 'SCAN') {
      throw Error('Профиль или зарплатная привязка расходится с согласованной карточкой.');
    }
    const template = await tx.shiftControlTemplate.findFirst({
      where: { department: 'retail', shiftCode: 'cash_handover', isActive: true },
      orderBy: { version: 'desc' }, include: { tasks: true },
    });
    if (template?.tasks.length !== 1 || template.tasks[0].category !== 'handover') throw Error('Шаблон смены не готов.');
    const conflict = await tx.userOneCCashboxMapping.findFirst({
      where: { oneCCashboxRef: cashboxRef, userId: { not: user.id }, isActive: true },
    });
    const mapping = user.oneCCashboxMapping;
    if (conflict || (mapping && (mapping.oneCCashboxRef !== cashboxRef || !mapping.isActive))) {
      throw Error('Конфликт существующей привязки кассы.');
    }
    const configured = Boolean(mapping) && user.workdayControlMode === 'CASH_HANDOVER';
    if (!configured && (user.isActive || !['STANDARD', 'CASH_HANDOVER'].includes(user.workdayControlMode))) {
      throw Error('Первичная настройка возможна только для подготовленной отключённой записи.');
    }
    if (apply && !configured) {
      if (!mapping) await tx.userOneCCashboxMapping.create({ data: { userId: user.id, oneCCashboxRef: cashbox.ref, oneCCashboxName: cashbox.name } });
      await tx.user.update({ where: { id: user.id }, data: { workdayControlMode: 'CASH_HANDOVER' } });
    }
    return { login, cashbox: cashbox.name, active: user.isActive, status: configured ? 'already-configured' : apply ? 'configured' : 'preview' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

configure().then(console.log).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
