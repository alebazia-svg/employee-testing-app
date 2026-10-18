// Stable department cues shared by working and saved payroll overviews.
export function payrollDepartmentTone(department: string): string {
  const tones: Record<string, string> = {
    'Закупки': 'bg-amber-50 text-amber-950',
    'Оптовые продажи': 'bg-blue-50 text-blue-950',
    'Розничные продажи': 'bg-emerald-50 text-emerald-950',
    'Операционное управление': 'bg-violet-50 text-violet-950',
    'Фиксированный оклад': 'bg-slate-100 text-slate-800',
  };
  return tones[department] ?? 'bg-slate-100 text-slate-800';
}
