'use client';
import { createContext, useContext, type ReactNode } from 'react';
const AdminIdentity = createContext<string>('Администратор портала');
export function AdminIdentityProvider({ name, children }: { name: string; children: ReactNode }) {
  return <AdminIdentity.Provider value={name}>{children}</AdminIdentity.Provider>;
}
export function useAdminIdentity() { return useContext(AdminIdentity); }
