import { AdminShell } from '@/components/AdminShell';

// Sections with a more specific loading.tsx keep their own wording.
export default function AdminSectionLoading() {
  return <AdminShell pageTitle="Открываем раздел">
    <section aria-busy="true" aria-label="Загрузка раздела" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <p role="status" aria-live="polite" className="text-sm text-slate-600">Загружаем данные раздела…</p>
    </section>
  </AdminShell>;
}
