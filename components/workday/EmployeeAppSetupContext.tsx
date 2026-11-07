'use client';
import { createContext, useContext } from 'react';
export type SetupProposalState = 'safari' | 'notifications' | 'denied' | 'offline' | 'reconnect' | 'ready' | 'checking' | 'unsupported';
export type EmployeeAppSetup = { state: SetupProposalState; finishProposal: boolean; demo?: boolean; eveningPreview?: boolean; previousDayCard?: boolean; isPhone?: boolean; isIos?: boolean; busy?: boolean; error?: string; enable: () => void };
export const EmployeeAppSetupContext = createContext<EmployeeAppSetup | null>(null);
export const useAppSetupProposal = () => useContext(EmployeeAppSetupContext);
