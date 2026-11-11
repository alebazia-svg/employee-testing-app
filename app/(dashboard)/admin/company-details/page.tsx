import { AdminShell } from '@/components/AdminShell';
import { CompanyCardActions } from './CompanyCardActions';

const companyDetails = [
  ['Полное наименование', 'Индивидуальный предприниматель Кештова Бэла Руслановна'],
  ['ИНН', '071306665560'],
  ['ОГРНИП', '324070000023338'],
  ['Адрес торговой точки', 'Кабардино-Балкарская Республика, г. Нальчик, ул. Ногмова, д. 37'],
  ['Налоговый режим', 'УСН «Доходы»'],
] as const;

const bankCards = [
  {
    name: 'Т-Банк',
    rows: [
      ['Расчётный счёт', '40802810200006310115'],
      ['Банк', 'АО «ТБанк»'],
      ['БИК', '044525974'],
      ['Корреспондентский счёт', '30101810145250000974'],
    ],
    pdfPath: '/documents/company-card-ip-keshtova.pdf',
    docxPath: '/documents/company-card-ip-keshtova.docx',
    downloadName: 'Карточка предприятия ИП Кештова Бэла Руслановна — Т-Банк.docx',
  },
  {
    name: 'Альфа-Банк',
    rows: [
      ['Расчётный счёт', '40802810181210006676'],
      ['Банк', 'АО «АЛЬФА-БАНК»'],
      ['БИК', '044525593'],
      ['Корреспондентский счёт', '30101810200000000593'],
    ],
    pdfPath: '/documents/company-card-ip-keshtova-alfa-bank.pdf',
    docxPath: '/documents/company-card-ip-keshtova-alfa-bank.docx',
    downloadName: 'Карточка предприятия ИП Кештова Бэла Руслановна — Альфа-Банк.docx',
  },
] as const;

function DetailsList({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl className='divide-y divide-slate-100'>
      {rows.map(([label, value]) => (
        <div key={label} className='grid gap-1 px-4 py-3.5 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-5 sm:px-5'>
          <dt className='text-sm font-bold text-slate-600'>{label}</dt>
          <dd className='break-words text-sm font-semibold text-slate-950 sm:text-right sm:[font-variant-numeric:tabular-nums]'>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function CompanyDetailsPage() {
  return (
    <AdminShell pageTitle="Реквизиты компании" pageDescription="Актуальная карточка предприятия для договоров, счетов и отправки контрагентам.">
      <div className='mt-5'>
        <section className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
          <div className='border-b border-slate-200 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Сведения об ИП</h2>
          </div>
          <DetailsList rows={companyDetails} />
        </section>
      </div>

      <div className='mt-5 grid gap-5 xl:grid-cols-2'>
        {bankCards.map((bank) => (
          <section key={bank.name} className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
            <div className='border-b border-slate-200 px-5 py-4'>
              <p className='text-xs font-bold uppercase tracking-[0.12em] text-slate-500'>Банковские реквизиты</p>
              <h2 className='mt-1 text-lg font-extrabold text-slate-950'>{bank.name}</h2>
            </div>
            <DetailsList rows={bank.rows} />
            <div className='border-t border-slate-200 px-4 py-4 sm:px-5'>
              <CompanyCardActions
                bankName={bank.name}
                pdfPath={bank.pdfPath}
                docxPath={bank.docxPath}
                downloadName={bank.downloadName}
              />
            </div>
          </section>
        ))}
      </div>

      <p className='mt-5 text-sm font-medium text-slate-500'>Выберите банк и отправьте соответствующий PDF. Word оставлен как редактируемая копия на случай изменения реквизитов.</p>
    </AdminShell>
  );
}
