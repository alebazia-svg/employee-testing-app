'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { rememberEmployeePayroll, type EmployeePayrollView } from '@/lib/employee-payroll-view';

type Store = { values: ReadonlyMap<string, EmployeePayrollView>; remember: (value: EmployeePayrollView, months: readonly string[]) => void; clear: () => void };
const Context = createContext<Store | null>(null);
// Account/inspection-keyed layout owns this small volatile store. Never persist
// authenticated salary data in localStorage, sessionStorage or a service worker.
export function EmployeePayrollSnapshots({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<ReadonlyMap<string, EmployeePayrollView>>(() => new Map());
  const remember = useCallback((value: EmployeePayrollView, months: readonly string[]) => setValues(previous => rememberEmployeePayroll(previous, value, months)), []);
  const clear = useCallback(() => setValues(new Map()), []);
  return <Context.Provider value={{ values, remember, clear }}>{children}</Context.Provider>;
}
export const useEmployeePayrollSnapshots = () => useContext(Context);
