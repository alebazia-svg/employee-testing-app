export type ScheduleCoverageState = 'full' | 'reduced' | 'empty';

export type ScheduleCoverage = {
  targetCount: number;
  workingCount: number;
  state: ScheduleCoverageState;
  needsReplacement: boolean;
};

export function departmentScheduleTarget(department: string) {
  return department === 'retail' || department === 'wholesale' ? 2 : 1;
}

export function scheduleCoverage(department: string, workingCount: number): ScheduleCoverage {
  const targetCount = departmentScheduleTarget(department);
  const normalizedCount = Math.max(0, Math.trunc(workingCount));
  return {
    targetCount,
    workingCount: normalizedCount,
    state: normalizedCount === 0 ? 'empty' : normalizedCount < targetCount ? 'reduced' : 'full',
    needsReplacement: normalizedCount < targetCount,
  };
}

export function scheduleWorkingCountAfterChange(input: {
  workingBefore: number;
  previousStatus: string | null | undefined;
  nextStatus: 'working' | 'off';
}) {
  return Math.max(
    0,
    Math.trunc(input.workingBefore)
      - (input.previousStatus === 'working' ? 1 : 0)
      + (input.nextStatus === 'working' ? 1 : 0),
  );
}

export function shouldRequestScheduleReplacement(input: {
  previousStatus: string | null | undefined;
  nextStatus: 'working' | 'off';
  coverage: ScheduleCoverage;
}) {
  return input.previousStatus === 'working'
    && input.nextStatus === 'off'
    && input.coverage.needsReplacement;
}

export function scheduleCoverageCopy(coverage: ScheduleCoverage) {
  if (coverage.state === 'empty') {
    return {
      title: 'В отделе никого не будет',
      body: 'Коллегам придёт просьба выйти на замену.',
      action: 'Сохранить выходной',
    };
  }
  if (coverage.state === 'reduced') {
    return {
      title: 'Останется один сотрудник',
      body: 'Коллегам придёт просьба выйти на замену.',
      action: 'Сохранить выходной',
    };
  }
  return {
    title: 'Состав отдела сохранён',
    body: 'После изменения в отделе остаётся полный состав.',
    action: 'Сохранить',
  };
}

export function schedulePersonName(name: string) {
  const normalized = name.split('/').pop()?.trim() || name.trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return normalized;
  return parts[1] || parts[0];
}

export function schedulePersonLabel(name: string, departmentNames: string[]) {
  const firstName = schedulePersonName(name);
  const duplicateCount = departmentNames.filter((item) => schedulePersonName(item) === firstName).length;
  if (duplicateCount < 2) return firstName;
  const normalized = name.split('/').pop()?.trim() || name.trim();
  const surname = normalized.split(/\s+/).filter(Boolean)[0] || '';
  return surname ? `${firstName} ${surname.charAt(0).toUpperCase()}.` : firstName;
}
