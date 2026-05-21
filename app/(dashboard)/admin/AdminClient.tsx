'use client';
import { useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export default function AdminClient() {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Tabs
      tabs={[
        {
          key: 'employees',
          label: 'Сотрудники',
          content: (
            <div className='space-y-3'>
              <Button onClick={() => setOpen(true)}>Добавить сотрудника</Button>
              <Dialog open={open}>
                <h3 className='mb-3 text-lg font-semibold text-slate-800'>Новый сотрудник</h3>
                <div className='space-y-3'>
                  <Input placeholder='Логин' value={login} onChange={(e) => setLogin(e.target.value)} />
                  <Input placeholder='Пароль' value={password} onChange={(e) => setPassword(e.target.value)} />
                  <div className='flex gap-2'>
                    <Button
                      onClick={async () => {
                        await fetch('/api/admin/employees', { method: 'POST', body: JSON.stringify({ login, password }) });
                        setOpen(false);
                        location.reload();
                      }}
                    >
                      Сохранить
                    </Button>
                    <Button className='bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800' onClick={() => setOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              </Dialog>
            </div>
          ),
        },
        {
          key: 'tests',
          label: 'Тесты',
          content: <p className='text-sm text-slate-600'>Демо-тесты созданы через seed. API для создания тестов: /api/admin/tests.</p>,
        },
      ]}
    />
  );
}
