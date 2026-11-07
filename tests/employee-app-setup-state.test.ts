import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeAppSetupState } from '../lib/employee-app-setup-state';
const base = { ios:false, inApp:true, supported:true, online:true, permission:'default' as NotificationPermission, connected:false, checking:false };
test('iPhone browser gets immediate install instructions; an app window does not',()=>{
 assert.equal(employeeAppSetupState({...base,ios:true,inApp:false,supported:false}), 'safari');
 assert.equal(employeeAppSetupState({...base,ios:true}), 'notifications');
});
test('only a confirmed granted connection hides the setup card',()=>{
 assert.equal(employeeAppSetupState({...base,permission:'granted'}), 'reconnect');
 assert.equal(employeeAppSetupState({...base,permission:'granted',connected:true}), 'ready');
 assert.equal(employeeAppSetupState({...base,permission:'denied',connected:true}), 'denied');
 assert.equal(employeeAppSetupState({...base,permission:'granted',connected:true,online:false}), 'ready');
});
test('loading, unavailable network and unsupported devices never pretend to be connected',()=>{
 assert.equal(employeeAppSetupState({...base,checking:true}), 'checking');
 assert.equal(employeeAppSetupState({...base,online:false}), 'offline');
 assert.equal(employeeAppSetupState({...base,supported:false,permission:'unsupported'}), 'unsupported');
});
