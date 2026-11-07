import type { ReactNode } from 'react';
import { supportsScheduleNearReminders } from '@/lib/schedule-near-reminder';
import { EmployeeAppSetupProvider } from './EmployeeAppSetupProvider';
import { EmployeeWorkHelpProvider } from './EmployeeWorkHelp';

/** One approved PWA presentation for ordinary employee routes and ADMIN inspection.
 * Providers adapt effects/reads through EmployeePreviewProvider, never a second UI. */
export function EmployeeExperienceProvider({department,attendanceOnly,children}:{department:string;attendanceOnly:boolean;children:ReactNode}) {
  const enabled = supportsScheduleNearReminders(department);
  return <EmployeeAppSetupProvider enabled={enabled}><EmployeeWorkHelpProvider department={department} attendanceOnly={attendanceOnly} enabled={enabled}>{children}</EmployeeWorkHelpProvider></EmployeeAppSetupProvider>;
}
