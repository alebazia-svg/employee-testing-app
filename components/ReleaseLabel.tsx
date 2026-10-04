import { getReleaseInfo } from '@/lib/release-info';

export function ReleaseLabel() {
  const { version, date, preview } = getReleaseInfo();
  return (
    <span className='flex flex-col gap-1 sm:text-right'>
      <span>Версия {version}{preview ? ' · тестовая' : ''}</span>
      {date && <span>Сборка {date} МСК</span>}
    </span>
  );
}
