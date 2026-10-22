'use client';
import { useEffect, useState } from 'react';
import { employeePayrollMonthAt, employeePayrollMonthDelay } from '@/lib/employee-payroll-view';

export function useEmployeePayrollMonth(initial: string) {
  const [month, setMonth] = useState(initial);
  useEffect(() => {
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      const now = new Date();
      setMonth(employeePayrollMonthAt(now));
      timer = window.setTimeout(update, employeePayrollMonthDelay(now));
    };
    const resume = () => { if (document.visibilityState === 'visible') update(); };
    update();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, []);
  return month;
}
