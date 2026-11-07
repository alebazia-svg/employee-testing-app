export type EmployeeSetupState = 'checking' | 'safari' | 'ready' | 'offline' | 'unsupported' | 'denied' | 'notifications' | 'reconnect';
export function employeeAppSetupState(input: { ios: boolean; inApp: boolean; supported: boolean; online: boolean; permission: NotificationPermission | 'unsupported'; connected: boolean; checking: boolean }): EmployeeSetupState {
  if (input.ios && !input.inApp) return 'safari';
  if (input.permission === 'granted' && input.connected) return 'ready';
  if (input.checking) return 'checking';
  if (!input.online) return 'offline';
  if (!input.supported) return 'unsupported';
  if (input.permission === 'denied') return 'denied';
  return input.permission === 'granted' ? 'reconnect' : 'notifications';
}
