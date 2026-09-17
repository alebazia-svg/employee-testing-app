import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { CompanyCardActions } from './CompanyCardActions';

const companyDetails = [
  ['Полное наименование', 'Индивидуальный предприниматель Кештова Бэла Руслановна'],
  ['ИНН', '071306665560'],
  ['ОГРНИП', '324070000023338'],
  ['Адрес торговой точки', 'Кабардино-Балкарская Республика, г. Нальчик, ул. Ногмова, д. 37'],
  ['НДС', 'Без НДС'],
] as const;

const bankDetails = [
  ['Расчётный счёт', '40802810300810112690'],
  ['Банк', 'Филиал «Центральный» Банка ВТБ (ПАО) в г. Москве'],
  ['БИК', '044525411'],
  ['Корреспондентский счёт', '30101810145250000411'],
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
    <AdminShell>
      <AdminBreadcrumbs current='Реквизиты' />
      <div className='mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
        <div>
          <h1 className='text-[26px] font-extrabold tracking-normal text-slate-950 md:text-[28px]'>Реквизиты компании</h1>
          <p className='mt-1 text-sm font-medium text-slate-500'>Актуальная карточка предприятия для договоров, счетов и отправки контрагентам.</p>
        </div>
        <CompanyCardActions />
      </div>

      <div className='mt-5 grid gap-5 xl:grid-cols-2'>
        <section className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
          <div className='border-b border-slate-200 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Сведения об ИП</h2>
          </div>
          <DetailsList rows={companyDetails} />
        </section>

        <section className='overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
          <div className='border-b border-slate-200 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Банковские реквизиты</h2>
          </div>
          <DetailsList rows={bankDetails} />
        </section>
      </div>

      <p className='mt-5 text-sm font-medium text-slate-500'>Для пересылки используйте PDF. Word оставлен как редактируемая копия на случай изменения реквизитов.</p>
    </AdminShell>
  );
}
