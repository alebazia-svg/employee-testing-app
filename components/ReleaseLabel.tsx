import { getReleaseInfo } from '@/lib/release-info';

export function ReleaseLabel() {
  const { version, date, revision, source, preview } = getReleaseInfo();
  return (
    <span className='flex flex-col gap-1 sm:text-right'>
      <span>Версия {version}{preview ? ' · тестовая' : ''}</span>
      {date && <span>Сборка {date} МСК</span>}
      <span className='text-[11px]'>
        {revision ? `${revision.slice(0, 8)}${source === 'modified' ? ' · с локальными изменениями' : ''}` : 'Исходный коммит не определён'}
      </span>
    </span>
  );
}
