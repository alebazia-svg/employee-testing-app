'use client';
import { observedEmployeeRequest } from './employee-request-observation';
import { workflowRequestEvent } from './employee-workflow-client';
/** Original response/errors/signals are preserved; the business call never waits for telemetry. */
export const employeeObservedFetch:typeof fetch=observedEmployeeRequest((...args)=>fetch(...args),workflowRequestEvent);
