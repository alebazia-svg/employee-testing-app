import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, portalHomePath } from '@/lib/auth';
import { accessBrowserCookie, accessConnectionCode } from '@/lib/portal-access-identity';

export const dynamic = 'force-dynamic';

/** Own connection only. This page cannot rename devices or classify visits. */
export default async function ConnectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const code = accessConnectionCode((await cookies()).get(accessBrowserCookie)?.value);
  return <main className='access-screen mx-auto max-w-xl px-5 py-10'>
    <h1 className='text-2xl font-semibold'>Это подключение</h1>
    <p className='mt-3'>Кабинет: {user.name}</p>
    <section className='access-delivery-detail mt-6'>
      <h2>Код подключения</h2>
      {code ? <code className='block break-all mt-3 text-sm select-all'>{code}</code> : <p>Код пока не получен. Откройте свой кабинет, затем вернитесь на эту страницу.</p>}
    </section>
    <p className='access-note'>Администратор может сверить этот код в подробностях устройства. Совпадение определяет именно этот браузер или приложение — не владельца компьютера. Назначение подтверждается отдельно.</p>
    <Link className='access-secondary inline-flex mt-6' href={portalHomePath(user)}>Вернуться в портал</Link>
  </main>;
}
