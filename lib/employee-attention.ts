/** Current work, independent of notification read/delivery state. */
export type EmployeeAttentionItem = {
  id: string; title: string; listTitle?: string; listSubtitle?: string; kind: 'receipt' | 'cash' | 'encashment' | 'closing' | 'cash_issue' | 'schedule';
  state: 'action' | 'waiting'; status: string; priority: number; date: string;
  detail: string; closingScope?: 'encashment' | 'closing'; facts?: Array<[string, string]>; reply?: string; replyAuthor?: { name: string; at: string }; shared?: boolean;
  notificationIds?: number[];
  scheduleNoticeId?: number; scheduleExpectedStatus?: 'off' | null; scheduleDate?: string; scheduleAction?: 'fill' | 'replacement';
  endpoint?: string; actions?: Array<{ label: string; action: string }>;
};
export function orderEmployeeAttention(items: EmployeeAttentionItem[]) {
  return [...new Map(items.map(item => [item.id, item])).values()].sort((a,b) =>
    Number(a.state === 'waiting') - Number(b.state === 'waiting') || a.priority - b.priority || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function employeeAttentionSummary(action: number, waiting: number, loading: boolean, failed: boolean) {
  if (!action && !waiting) return loading ? 'Загружаем замечания…' : failed ? 'Список временно недоступен' : 'Открытых замечаний нет';
  return action ? `Нужно сделать: ${action}${waiting ? ` · на проверке: ${waiting}` : ''}` : `На проверке: ${waiting}`;
}
export function employeeReviewState(input: { response?: string; handler?: string; adminRepliedAfterResponse: boolean }) {
  if (input.adminRepliedAfterResponse) return { state: 'action' as const, status: 'Есть ответ' };
  if (input.response === 'help') return { state: 'waiting' as const, status: 'Ожидает ответа' };
  if (input.response === 'not_mine') return { state: 'waiting' as const, status: 'Ответственный уточняется' };
  if (input.handler) return { state: 'waiting' as const, status: `Проверяет ${input.handler}` };
  return { state: 'action' as const, status: 'Нужно проверить' };
}
