'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';

type User = {
  id: number;
  name: string;
  login: string;
  role: string;
  department: string;
  isActive: boolean;
  payrollName: string | null;
  todayState: string;
  attentionCount: number;
};

type Draft = User & { password: string };

const departmentLabels: Record<string, string> = {
  retail: 'Розница',
  wholesale: 'Опт',
  operations: 'Операции',
};

const emptyDraft: Draft = {
  id: 0,
  name: '',
  login: '',
  password: '',
  role: 'EMPLOYEE',
  department: 'retail',
  isActive: true,
  payrollName: '',
  todayState: 'no_schedule',
  attentionCount: 0,
};

const todayStateLabels: Record<string, { label: string; className: string }> = {
  working: { label: 'Работает', className: 'bg-green-100 text-green-800' },
  completed: { label: 'Завершил день', className: 'bg-slate-100 text-slate-700' },
  not_started: { label: 'Ещё не начал', className: 'bg-amber-100 text-amber-800' },
  off: { label: 'Выходной', className: 'bg-slate-100 text-slate-600' },
  no_schedule: { label: 'Без графика', className: 'bg-slate-100 text-slate-600' },
  admin: { label: 'ADMIN', className: 'bg-blue-100 text-blue-800' },
};

export default function EmployeesClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'employees' | 'admins' | 'inactive'>('employees');
  const adminCount = users.filter((user) => user.role === 'ADMIN' && user.isActive).length;
  const employeeCount = users.filter((user) => user.role !== 'ADMIN' && user.isActive).length;
  const activeCount = users.filter((user) => user.isActive).length;
  const workingCount = users.filter((user) => user.todayState === 'working').length;
  const attentionCount = users.reduce((sum, user) => sum + user.attentionCount, 0);
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

  function startCreate() {
    setError('');
    setEditingId('new');
    setDraft(emptyDraft);
  }

  function startEdit(user: User) {
    setError('');
    setEditingId(user.id);
    setDraft({ ...user, payrollName: user.payrollName ?? '', password: '' });
  }

  async function save() {
    setError('');
    const url = editingId === 'new' ? '/api/admin/employees' : `/api/admin/employees/${editingId}`;
    const method = editingId === 'new' ? 'POST' : 'PATCH';
    const response = await fetch(url, { method, body: JSON.stringify(draft) });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Не удалось сохранить сотрудника');
      return;
    }

    const saved = await response.json();
    setUsers((current) => {
      const previous = editingId === 'new' ? null : current.find((user) => user.id === saved.id) ?? null;
      const normalizedSaved: User = {
        ...saved,
        todayState: previous?.todayState ?? 'no_schedule',
        attentionCount: previous?.attentionCount ?? 0,
      };
      const next = editingId === 'new' ? [...current, normalizedSaved] : current.map((user) => (user.id === saved.id ? normalizedSaved : user));
      return next.sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.role.localeCompare(right.role) || left.name.localeCompare(right.name, 'ru'));
    });
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function remove(userId: number) {
    if (!window.confirm('Удалить сотрудника?')) return;
    const response = await fetch(`/api/admin/employees/${userId}`, { method: 'DELETE' });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Не удалось удалить сотрудника');
      return;
    }

    setUsers((current) => current.filter((user) => user.id !== userId));
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <AdminMetricCard icon={Users} label='Активные сотрудники' value={employeeCount} detail={`Всего активных аккаунтов: ${activeCount}`} tone='green' />
        <AdminMetricCard icon={BriefcaseBusiness} label='Работают сейчас' value={workingCount} detail='По данным текущего рабочего дня' tone='green' />
        <AdminMetricCard icon={AlertTriangle} label='Активные проблемы' value={attentionCount} detail={attentionCount ? 'Требуют контроля или исправления' : 'У команды нет активных проблем'} tone={attentionCount ? 'amber' : 'slate'} />
      </div>

      <Card className='flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='relative min-w-0 flex-1 lg:max-w-md'>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Найти сотрудника' className='pl-9' />
        </div>
        <div className='flex flex-wrap gap-2'>
          {([
            ['employees', `Сотрудники · ${employeeCount}`],
            ['admins', `ADMIN · ${adminCount}`],
            ['inactive', `Отключены · ${users.filter((user) => !user.isActive).length}`],
          ] as const).map(([key, label]) => <button key={key} type='button' onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-xs font-extrabold ring-1 transition ${filter === key ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}>{label}</button>)}
        </div>
        <Button className='gap-2' onClick={startCreate}>
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
            <Input placeholder={editingId === 'new' ? 'Пароль' : 'Новый пароль, если нужно'} type='password' value={draft.password} onChange={(event) => setDraft((value) => ({ ...value, password: event.target.value }))} />
            <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value }))}>
              <option value='ADMIN'>Администратор</option>
              <option value='EMPLOYEE'>Сотрудник</option>
            </select>
            <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20' value={draft.department} onChange={(event) => setDraft((value) => ({ ...value, department: event.target.value }))}>
              <option value='retail'>Розница</option>
              <option value='wholesale'>Опт</option>
              <option value='operations'>Операции</option>
            </select>
            <label className='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700'>
              <input type='checkbox' checked={draft.isActive} onChange={(event) => setDraft((value) => ({ ...value, isActive: event.target.checked }))} />
              Активен
            </label>
          </div>
          {error && <p className='mt-3 text-sm text-red-600'>{error}</p>}
          <div className='mt-4 flex gap-2'>
            <Button disabled={!draft.name.trim() || !draft.login.trim() || (editingId === 'new' && !draft.password.trim())} onClick={save}>Сохранить</Button>
            <Button className='bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800' onClick={() => setEditingId(null)}>Отмена</Button>
          </div>
        </Card>
      )}

      <Card className='overflow-hidden p-0'>
        <Table>
          <thead className='bg-slate-50 text-slate-500'>
            <tr className='text-left'>
              <th className='px-5 py-4'>Сотрудник</th>
              <th className='px-5 py-4'>Отдел</th>
              <th className='px-5 py-4'>Сегодня</th>
              <th className='px-5 py-4'>Требует внимания</th>
              <th className='px-5 py-4'>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const todayState = todayStateLabels[user.todayState] ?? todayStateLabels.no_schedule;
              return (
              <tr key={user.id} className='border-t border-slate-200/80'>
                <td className='px-5 py-4'><p className='font-bold text-slate-950'>{user.name}</p><p className='mt-0.5 text-xs font-semibold text-slate-500'>{user.role === 'ADMIN' ? 'Администратор' : `Логин: ${user.login}`}</p></td>
                <td className='px-5 py-4 text-slate-700'>{departmentLabels[user.department] ?? user.department}</td>
                <td className='px-5 py-4'>
                  <Badge className={user.isActive ? todayState.className : 'bg-slate-100 text-slate-500'}>{user.isActive ? todayState.label : 'Отключён'}</Badge>
                </td>
                <td className='px-5 py-4'>{user.attentionCount > 0 ? <span className='inline-flex items-center gap-1.5 text-sm font-bold text-amber-800'><AlertTriangle className='h-4 w-4' />{user.attentionCount}</span> : <span className='text-sm font-semibold text-slate-400'>Нет</span>}</td>
                <td className='px-5 py-4'>
                  <div className='flex gap-2'>
                  {user.role !== 'ADMIN' && <Link href={`/admin/workday?control=all&employee=${user.id}#employees-control`} className='inline-flex h-9 items-center rounded-lg bg-white px-3 text-xs font-bold text-slate-700 ring-1 ring-border hover:bg-slate-50'>Открыть день</Link>}
                  <Button className='h-9 w-9 bg-white p-0 text-slate-700 ring-1 ring-border hover:bg-slate-50 hover:text-slate-900' onClick={() => startEdit(user)}>
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button className='h-9 w-9 bg-white p-0 text-red-600 ring-1 ring-border hover:bg-red-50 hover:text-red-700' onClick={() => remove(user.id)}>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                  </div>
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
