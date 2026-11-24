'use client';

import { useEffect, useMemo, useState } from 'react';
import './employee-discoverability.css';
import { resolvePayrollEmployeeSalaryType } from '@/lib/payroll-employee-rules';
import { useRouter } from 'next/navigation';
import { ChevronDown, Eye, History, KeyRound, Pencil, Search, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import EmployeeActivityDialog from './EmployeeActivityDialog';
import EmployeeAccessDialog, { type AccessUser, type IssuedAccess } from './EmployeeAccessDialog';

type User = AccessUser & {
  id: number;
  name: string;
  login: string;
  role: string;
  department: string;
  isActive: boolean;
  payrollName: string | null;
  payrollSalaryType: string | null;
  payrollReportGroup: string | null;
  payrollFixedSalary: number | null;
  payrollRuleFrom: string | null;
  payrollRuleThrough: string | null;
  portalArea: string;
  oneCManagerName: string | null;
  qrScanMode: string;
};

type Draft = Omit<User, 'payrollFixedSalary' | 'sessionVersion'> & { payrollFixedSalary: string };

const departmentLabels: Record<string, string> = {
  retail: 'Розница',
  wholesale: 'Опт',
  operations: 'Операции',
  procurement: 'Закупки',
};

const payrollRuleLabels: Record<string, string> = {
  purchase_manager: 'Закупки',
  purchase_daily: 'Закупки · оплата по дням',
  wholesale_percent: 'Оптовые продажи',
  retail_sales_bonus: 'Розничные продажи',
  vl_percent: 'Операционное управление',
  fixed_salary: 'Фиксированный оклад',
};

const emptyDraft: Draft = {
  id: 0,
  name: '',
  login: '',
  role: 'EMPLOYEE',
  department: 'retail',
  isActive: true,
  payrollName: '',
  payrollSalaryType: '',
  payrollReportGroup: '',
  payrollFixedSalary: '',
  payrollRuleFrom: '',
  payrollRuleThrough: '',
  portalArea: 'WORKDAY',
  oneCManagerName: '',
  qrScanMode: 'SCAN',
};

export default function EmployeesClient({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: number }) {
  const router = useRouter();
  const [activityUser, setActivityUser] = useState<User | null>(null);
  const [previewBusy, setPreviewBusy] = useState<number | null>(null);
  const [users, setUsers] = useState(initialUsers);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
  const [issuedAccess, setIssuedAccess] = useState<IssuedAccess | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'employees' | 'admins' | 'inactive'>('employees');
  const adminCount = users.filter((user) => user.role === 'ADMIN' && user.isActive).length;
  const employeeCount = users.filter((user) => user.role !== 'ADMIN' && user.isActive).length;
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
    return users.filter((user) => {
      if (filter === 'employees' && (user.role === 'ADMIN' || !user.isActive)) return false;
      if (filter === 'admins' && (user.role !== 'ADMIN' || !user.isActive)) return false;
      if (filter === 'inactive' && user.isActive) return false;
      if (!normalizedQuery) return true;
      return `${user.name} ${user.login} ${departmentLabels[user.department] ?? user.department}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery);
    });
  }, [filter, query, users]);

  useEffect(() => {
    const dismiss = () => document.querySelector<HTMLElement>('.employee-desktop-popup:popover-open')?.hidePopover();
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, []);

  function startCreate() {
    setError('');
    setEditingId('new');
    setDraft(emptyDraft);
  }

  function closeManagement() {
    document.querySelectorAll<HTMLDetailsElement>('details.employee-management[open]').forEach(menu => {
      menu.open = false;
      menu.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    });
  }

  function startEdit(user: User) {
    closeManagement();
    setError('');
    setEditingId(user.id);
    setDraft({
      ...user,
      payrollName: user.payrollName ?? '',
      payrollSalaryType: resolvePayrollEmployeeSalaryType(user.payrollName?.trim() || user.name, user.payrollSalaryType) ?? '',
      payrollReportGroup: user.payrollReportGroup ?? '',
      payrollFixedSalary: user.payrollFixedSalary === null ? '' : String(user.payrollFixedSalary),
      payrollRuleFrom: user.payrollRuleFrom ?? '',
      payrollRuleThrough: user.payrollRuleThrough ?? '',
        });
  }

  function openAccess(user: AccessUser) {
    closeManagement();
    setIssuedAccess(null);
    setAccessUser(user);
  }

  function accessChanged(access: IssuedAccess) {
    setUsers((current) => current.map((user) => user.id === access.userId ? {
      ...user, sessionVersion: access.sessionVersion,
    } : user));
  }

  async function save() {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const url = editingId === 'new' ? '/api/admin/employees' : `/api/admin/employees/${editingId}`;
      const response = await fetch(url, { method: editingId === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Не удалось сохранить сотрудника'); return; }
      const { issuedAccess: access, ...saved } = data;
      setUsers((current) => {
        const next = editingId === 'new' ? [...current, saved] : current.map((user) => user.id === saved.id ? saved : user);
        return next.sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.role.localeCompare(right.role) || left.name.localeCompare(right.name, 'ru'));
      });
      setEditingId(null);
      setDraft(emptyDraft);
      if (access) { setAccessUser(saved); setIssuedAccess(access); }
    } catch {
      setError('Не удалось получить ответ. Обновите список и проверьте, сохранился ли сотрудник, перед повторной попыткой.');
    } finally { setSaving(false); }
  }

  async function openPreview(user: User) {
    if (previewBusy !== null) return;
    setPreviewBusy(user.id); setError('');
    try {
      const response = await fetch(`/api/admin/employees/${user.id}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Не удалось открыть просмотр.');
      router.push(body.href);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось открыть просмотр.'); }
    finally { setPreviewBusy(null); }
  }

  function cabinetAction(user: User) {
    if (user.role !== 'EMPLOYEE' || !['WORKDAY', 'PROCUREMENT'].includes(user.portalArea)) return null;
    return <Button disabled={!user.isActive || previewBusy !== null} aria-label={`Посмотреть кабинет: ${user.name}`} title='Просмотр кабинета сотрудника' className='employee-cabinet-action h-9 gap-2 bg-white px-3 text-slate-700 ring-1 ring-border hover:bg-slate-50' onClick={() => void openPreview(user)}><Eye className='h-4 w-4'/>{previewBusy === user.id ? 'Открываем…' : 'Посмотреть кабинет'}</Button>;
  }

  function accessAction(user: User, desktopMenu = false) {
    if (user.id === currentUserId) return <span className='self-center text-xs text-slate-500'>Ваш аккаунт</span>;
    const Control = desktopMenu ? 'button' : Button;
    return <Control type='button' disabled={!user.isActive} className={desktopMenu ? undefined : 'h-9 gap-2 whitespace-nowrap bg-white px-3 text-slate-700 ring-1 ring-border hover:bg-slate-50 hover:text-slate-900'} onClick={() => openAccess(user)}><KeyRound className='h-4 w-4' />Выдать доступ</Control>;
  }

  function desktopManagement(user: User) {
    const id = `employee-management-${user.id}`;
    return <>
      <button type="button" className="employee-desktop-trigger" popoverTarget={id}
        aria-label={`Управление сотрудником: ${user.name}`}
        onClick={event => {
          const menu = document.getElementById(id);
          if (!menu) return;
          const rect = event.currentTarget.getBoundingClientRect();
          menu.style.right = `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`;
          const below = window.innerHeight - rect.bottom >= 132;
          menu.style.top = below ? `${rect.bottom + 4}px` : 'auto';
          menu.style.bottom = below ? 'auto' : `${window.innerHeight - rect.top + 4}px`;
        }}>
        Управление <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={id} popover="auto" className="employee-desktop-popup"
        role="group" aria-label={`Доступ и настройки: ${user.name}`}
        onClickCapture={event => {
          if (event.target instanceof Element && event.target.closest('button:enabled')) event.currentTarget.hidePopover();
        }}>
        {user.role === 'EMPLOYEE' && (
          <button type="button" onClick={() => setActivityUser(user)}>
            <History size={16} aria-hidden="true" />
            История действий
          </button>
        )}
        {accessAction(user, true)}
        <button type="button" onClick={() => startEdit(user)}><Pencil size={16} />Настройки сотрудника</button>
      </div>
    </>;
  }

  function managementActions(user: User) {
    return <details className='employee-management' onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector<HTMLElement>('summary')?.focus(); }
    }}>
      <summary aria-label={`Управление сотрудником: ${user.name}`}>Управление<ChevronDown size={14} aria-hidden='true'/></summary>
      <div className='employee-management-items' role='group' aria-label={`Доступ и настройки: ${user.name}`}>
        {accessAction(user)}
        <Button className='h-9 gap-2 bg-white px-3 text-slate-700 ring-1 ring-border hover:bg-slate-50' onClick={() => startEdit(user)}><Pencil className='h-4 w-4'/>Настройки сотрудника</Button>
      </div>
    </details>;
  }

  return (
    <div className='employee-discoverability space-y-5'>
      {activityUser && <EmployeeActivityDialog user={activityUser} onClose={() => setActivityUser(null)} />}
      {accessUser && <EmployeeAccessDialog user={accessUser} initialAccess={issuedAccess} onIssued={accessChanged} onClose={() => { setAccessUser(null); setIssuedAccess(null); }} />}
      <nav className='admin-section-tabs' aria-label='Группы сотрудников'>
        {([
          ['employees', 'Сотрудники', employeeCount],
          ['admins', 'Администраторы', adminCount],
          ['inactive', 'Отключены', users.filter((user) => !user.isActive).length],
        ] as const).map(([key, label, count]) => (
          <button key={key} type='button' aria-pressed={filter === key} onClick={() => setFilter(key)} className={`admin-section-tab${filter === key ? ' is-active' : ''}`}>
            {label}<span>{count}</span>
          </button>
        ))}
      </nav>
      <Card className='flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='relative min-w-0 flex-1 lg:max-w-md'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Найти сотрудника' className='pl-9' />
        </div>
        <Button className='gap-2' data-portal-secondary={Boolean(editingId)} onClick={startCreate}>
          <UserPlus className='h-4 w-4' />
          Создать сотрудника
        </Button>
      </Card>

      {editingId && (
        <Card>
          <h2 className='mb-3 text-lg font-semibold text-slate-900'>{editingId === 'new' ? 'Новый сотрудник' : 'Редактирование сотрудника'}</h2>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            <Input placeholder='Отображаемое имя' value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
            <Input placeholder='Логин' value={draft.login} onChange={(event) => setDraft((value) => ({ ...value, login: event.target.value }))} />
            <Input placeholder='ФИО в payroll, если отличается' value={draft.payrollName ?? ''} onChange={(event) => setDraft((value) => ({ ...value, payrollName: event.target.value }))} />
            <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value }))}>
              <option value='ADMIN'>Администратор</option>
              <option value='EMPLOYEE'>Сотрудник</option>
            </select>
            <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.department} onChange={(event) => setDraft((value) => ({ ...value, department: event.target.value }))}>
              <option value='retail'>Розница</option>
              <option value='wholesale'>Опт</option>
              <option value='operations'>Операции</option><option value='procurement'>Закупки</option>
            </select>
            {draft.role === 'EMPLOYEE' ? <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.portalArea} onChange={(event) => setDraft((value) => ({ ...value, portalArea: event.target.value }))}>
              <option value='WORKDAY'>Рабочий день розницы</option>
              <option value='PROCUREMENT'>Закупки и оплаты</option>
            </select> : null}
            {draft.role === 'EMPLOYEE' && draft.portalArea === 'PROCUREMENT' ? <Input placeholder='Имя менеджера в 1С, точно' value={draft.oneCManagerName ?? ''} onChange={(event) => setDraft((value) => ({ ...value, oneCManagerName: event.target.value }))} /> : null}
            <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.payrollSalaryType ?? ''} onChange={(event) => setDraft((value) => ({ ...value, payrollSalaryType: event.target.value, payrollReportGroup: payrollRuleLabels[event.target.value] ?? '', payrollFixedSalary: event.target.value === 'fixed_salary' ? value.payrollFixedSalary : '' }))}>
              <option value=''>Зарплата: требует настройки</option>
              <option value='purchase_manager'>Закупки</option>
              {((draft.payrollName?.trim() || draft.name.trim()) === 'Кумыков Мухаммед' || draft.payrollSalaryType === 'purchase_daily') && <option value='purchase_daily'>Закупки · оплата по дням</option>}
              <option value='wholesale_percent'>Оптовые продажи</option>
              <option value='retail_sales_bonus'>Розничные продажи</option>
              <option value='vl_percent'>Операционное управление</option>
              <option value='fixed_salary'>Фиксированный оклад</option>
            </select>
            {draft.payrollSalaryType === 'fixed_salary' && <Input placeholder='Оклад, ₽' inputMode='decimal' value={draft.payrollFixedSalary} onChange={(event) => setDraft((value) => ({ ...value, payrollFixedSalary: event.target.value }))} />}
            <label className='grid gap-1 text-xs font-bold text-slate-600'>Правило действует с
              <Input type='month' value={draft.payrollRuleFrom ?? ''} onChange={(event) => setDraft((value) => ({ ...value, payrollRuleFrom: event.target.value }))} />
            </label>
            <label className='grid gap-1 text-xs font-bold text-slate-600'>Действует по (необязательно)
              <Input type='month' value={draft.payrollRuleThrough ?? ''} onChange={(event) => setDraft((value) => ({ ...value, payrollRuleThrough: event.target.value }))} />
            </label>
            {draft.role === 'EMPLOYEE' && draft.portalArea === 'WORKDAY' && (
              <label className='flex flex-col gap-2 text-sm font-semibold text-slate-700'>
                Способ чтения QR
                <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.qrScanMode} onChange={(event) => setDraft((value) => ({ ...value, qrScanMode: event.target.value }))}>
                  <option value='SCAN'>Сканирование камерой</option>
                  <option value='PHOTO'>Фотография QR</option>
                </select>
                <span className='text-xs font-normal text-slate-500'>Если сканер показывает чёрный экран, выберите фотографию. Сотруднику нужно заново открыть страницу рабочего дня после сохранения.</span>
              </label>
            )}
            <label className='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700'>
              <input type='checkbox' checked={draft.isActive} onChange={(event) => setDraft((value) => ({ ...value, isActive: event.target.checked }))} />
              Разрешить вход в портал
            </label>
          </div>
          {editingId === 'new' && <p className='mt-3 text-sm text-slate-500'>Пароль будет создан автоматически после сохранения. Данные для входа можно скопировать и передать сотруднику.</p>}
          {error && <p className='mt-3 text-sm text-red-600'>{error}</p>}
          <div className='mt-4 flex gap-2'>
            <Button disabled={saving || !draft.name.trim() || !draft.login.trim()} onClick={save}>{saving ? 'Сохраняем…' : 'Сохранить'}</Button>
            <Button className='bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800' disabled={saving} onClick={() => setEditingId(null)}>Отмена</Button>
          </div>
        </Card>
      )}

      <div className='grid gap-3 md:hidden'>
        {filteredUsers.map((user) => (
          <Card key={user.id} className='admin-material-card employee-mobile-card p-4'>
            <div className='employee-mobile-header'>
              <div className='min-w-0'>
                <p className='employee-person-name font-extrabold text-slate-950'>{user.name}</p><div className='employee-mobile-actions'>{cabinetAction(user)}{user.role === 'EMPLOYEE' && <button onClick={() => setActivityUser(user)} className='mt-1 min-h-9 text-sm font-semibold text-[#945e3b] hover:underline'>История действий</button>}</div>
                <p className='mt-0.5 text-xs font-semibold text-slate-500'>Логин: {user.login}</p>
              </div>
              <Badge className={user.isActive ? 'shrink-0 bg-green-100 text-green-800' : 'shrink-0 bg-slate-100 text-slate-500'}>{user.isActive ? 'Вход разрешён' : 'Вход отключён'}</Badge>
            </div>
            <div className='employee-mobile-facts mt-4 grid grid-cols-2 gap-3 text-sm'>
              <div><p className='text-[10px] font-extrabold uppercase tracking-wide text-slate-400'>Отдел</p><p className='mt-1 font-bold text-slate-700'>{departmentLabels[user.department] ?? user.department}</p></div>
              <div><p className='text-[10px] font-extrabold uppercase tracking-wide text-slate-400'>Роль</p><p className='mt-1 font-bold text-slate-700'>{user.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}</p></div>
              <div className='col-span-2'><p className='text-[10px] font-extrabold uppercase tracking-wide text-slate-400'>Кабинет сотрудника</p><p className='mt-1 font-bold text-slate-700'>{user.role === 'ADMIN' ? 'Админка' : user.portalArea === 'PROCUREMENT' ? 'Закупки и оплаты' : 'Рабочий день'}</p></div>
                <details className="col-span-2 employee-management">
                  <summary>
                    <span>Для зарплаты{!user.payrollReportGroup && <span className="ml-2 text-amber-700">Требует настройки</span>}</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  {user.payrollName?.trim() && user.payrollName.trim() !== user.name.trim() && <p>{user.payrollName}</p>}
                  {user.payrollReportGroup && <p className="text-slate-700">{user.payrollReportGroup}</p>}
                </details>
            </div>
            <div className='employee-access-group mt-4'>{managementActions(user)}</div>
          </Card>
        ))}
        {!filteredUsers.length && <Card className='p-8 text-center text-sm font-medium text-slate-500'>По выбранному фильтру сотрудников нет.</Card>}
      </div>

      <Card className='hidden overflow-hidden p-0 md:block'>
        <Table>
          <thead className='bg-slate-50 text-slate-500'>
            <tr className='text-left'>
              <th className='px-5 py-4'>Сотрудник</th>
              <th className='px-5 py-4'>Отдел</th>
              <th className='px-5 py-4'>Роль</th>
              <th className='px-5 py-4'>Кабинет сотрудника</th>
              <th className='px-5 py-4'>Для зарплаты</th>
              <th className='px-5 py-4'>Статус доступа</th>
              <th className='px-5 py-4'>Управление</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              return (
              <tr key={user.id} className='border-t border-slate-200/80'>
                <td className='px-5 py-4'><div className='employee-person-heading'><p className='employee-person-name font-bold text-slate-950'>{user.name}</p>{cabinetAction(user)}</div><p className='mt-0.5 text-xs font-semibold text-slate-500'>Логин: {user.login}</p></td>
                <td className='px-5 py-4 text-slate-700'>{departmentLabels[user.department] ?? user.department}</td>
                <td className='px-5 py-4 text-sm font-semibold text-slate-700'>{user.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}</td>
                <td className='px-5 py-4 text-sm font-semibold text-slate-700'>{user.role === 'ADMIN' ? 'Админка' : user.portalArea === 'PROCUREMENT' ? 'Закупки и оплаты' : 'Рабочий день'}</td>
                <td className='px-5 py-4'>{(user.payrollName?.trim() && user.payrollName.trim() !== user.name.trim()) && <p className='text-sm font-semibold text-slate-700'>{user.payrollName?.trim() || user.name}</p>}<p className={`mt-0.5 text-xs font-medium ${user.payrollSalaryType ? 'text-slate-400' : 'text-amber-700'}`}>{user.payrollReportGroup || 'Требует настройки'}</p></td>
                <td className='px-5 py-4'><Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}>{user.isActive ? 'Вход разрешён' : 'Вход отключён'}</Badge></td>
                <td className='px-5 py-4'>
                  {desktopManagement(user)}
                </td>
              </tr>
            )})}
          </tbody>
        </Table>
        {!filteredUsers.length && <p className='p-8 text-center text-sm font-medium text-slate-500'>По выбранному фильтру сотрудников нет.</p>}
      </Card>
    </div>
  );
}
