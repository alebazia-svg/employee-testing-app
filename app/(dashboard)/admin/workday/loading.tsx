import { AdminShell } from '@/components/AdminShell';

export default function WorkdayLoading() {
  return <AdminShell pageTitle="Контроль дня" pageDescription="План, фактические отметки и проверки смен по отделам.">
    <section aria-busy="true" aria-label="Загрузка контроля дня" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <p role="status" aria-live="polite" className="text-sm text-slate-600">Открываем контроль дня — загружаем смены и результаты проверок…</p>
    </section>
  </AdminShell>;
}
