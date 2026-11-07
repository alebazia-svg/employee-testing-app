'use client';
import { employeeSetupError, type EmployeeUiObservation } from './employee-ui-observation';
export const employeeUiEvent='portal-employee-ui';
let current:Omit<EmployeeUiObservation,'sampledAt'>|null=null;
export function reportEmployeeUi(next:Omit<EmployeeUiObservation,'sampledAt'|'error'>&{error?:string}) {
 const value={...next,error:employeeSetupError(next.error)};
 if(JSON.stringify(value)===JSON.stringify(current))return;
 current=value;window.dispatchEvent(new Event(employeeUiEvent));
}
export function clearEmployeeUi(){current=null;}
export function employeeUiObservation():EmployeeUiObservation|undefined {
 return current ? {...current,sampledAt:new Date().toISOString()}:undefined;
}
