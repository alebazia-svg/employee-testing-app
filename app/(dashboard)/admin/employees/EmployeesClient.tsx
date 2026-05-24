'use client';

import { useState } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';

type User = { id: number; name: string; login: string; role: string };

const emptyDraft = { id: 0, name: '', login: '', password: '', role: 'EMPLOYEE' };

export default function EmployeesClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');

  function startCreate() {
    setError('');
    setEditingId('new');
    setDraft(emptyDraft);
  }

  function startEdit(user: User) {
    setError('');
    setEditingId(user.id);
    setDraft({ ...user, password: '' });
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
    setUsers((current) => (editingId === 'new' ? [...current, saved] : current.map((user) => (user.id === saved.id ? saved : user))));
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
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button className='gap-2' onClick={startCreate}>
          <UserPlus className='h-4 w-4' />
          Создать сотрудника
        </Button>
      </div>

      {editingId && (
        <Card>
          <h2 className='mb-3 text-lg font-semibold text-slate-900'>{editingId === 'new' ? 'Новый сотрудник' : 'Редактирование сотрудника'}</h2>
          <div className='grid gap-3 md:grid-cols-2'>
            <Input placeholder='Имя' value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
            <Input placeholder='Логин' value={draft.login} onChange={(event) => setDraft((value) => ({ ...value, login: event.target.value }))} />
            <Input placeholder={editingId === 'new' ? 'Пароль' : 'Новый пароль, если нужно'} type='password' value={draft.password} onChange={(event) => setDraft((value) => ({ ...value, password: event.target.value }))} />
            <select className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm' value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value }))}>
              <option value='ADMIN'>Администратор</option>
              <option value='EMPLOYEE'>Сотрудник</option>
            </select>
          </div>
          {error && <p className='mt-3 text-sm text-red-600'>{error}</p>}
          <div className='mt-4 flex gap-2'>
            <Button disabled={!draft.name.trim() || !draft.login.trim() || (editingId === 'new' && !draft.password.trim())} onClick={save}>Сохранить</Button>
            <Button className='bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800' onClick={() => setEditingId(null)}>Отмена</Button>
          </div>
        </Card>
      )}

      <Card className='p-0'>
        <Table>
          <thead className='bg-slate-50 text-slate-500'>
            <tr className='text-left'>
              <th className='px-5 py-4'>Имя</th>
              <th className='px-5 py-4'>Логин</th>
              <th className='px-5 py-4'>Роль</th>
              <th className='px-5 py-4'>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className='border-t border-border/70'>
                <td className='px-5 py-4 font-medium text-slate-900'>{user.name}</td>
                <td className='px-5 py-4 text-slate-700'>{user.login}</td>
                <td className='px-5 py-4'>
                  <Badge className={user.role === 'ADMIN' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                    {user.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}
                  </Badge>
                </td>
                <td className='flex gap-2 px-5 py-4'>
                  <Button className='h-9 w-9 bg-white p-0 text-slate-700 ring-1 ring-border hover:bg-slate-50 hover:text-slate-900' onClick={() => startEdit(user)}>
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button className='h-9 w-9 bg-white p-0 text-red-600 ring-1 ring-border hover:bg-red-50 hover:text-red-700' onClick={() => remove(user.id)}>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
