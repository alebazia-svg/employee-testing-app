import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { DELIVERY_CREATE_CONTRACT, DELIVERY_CREATE_TEST_CONTRACT, deliveryCreateMode, type DeliveryCreatePlan } from './procurement-delivery-create-policy';
export const deliveryCreateEnabled = () => deliveryCreateMode() !== null;
// Explicit opt-in only; the live identity and installed command contract must match.
export async function deliveryCreationApi(path: string, body?: unknown) {
  const mode = deliveryCreateMode();
  if (!mode) throw Error('CREATION_DISABLED');
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw Error('CREATION_CONFIG_MISSING');
  const read = async (endpoint: string, payload?: unknown) => {
    const response = await fetch(`${env.baseUrl}/${endpoint}`, { method: payload === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(45000), headers: { Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || result.ok === false) {
      const code = ['insufficient_cash', 'existing_accountable_request', 'unallocated_obligations', 'selected_cashbox_obligations_invalid', 'accountable_cashflow_article_missing', 'report_date_before_payment', 'preview_expired', 'action_not_allowed'].find(c => typeof result.error === 'string' && result.error.includes(c));
      throw Error(code === 'action_not_allowed' ? 'CREATION_COMMAND_NOT_INSTALLED' : code || 'NATIVE_CREATION_REJECTED');
    }
    return result;
  };
  const version = await read('version');
  const expectedBase = mode === 'test' ? 'trade83_ut11_Test' : 'Teleinvest_UT11';
  if (version.environment !== mode || version.base !== expectedBase) throw Error('CREATION_BASE_MISMATCH');
  const advertised = version.expense_request_commands;
  const stable = advertised?.contract === 'expense-request-admin-v1' && advertised?.create_contract === DELIVERY_CREATE_CONTRACT && Array.isArray(advertised.actions) && advertised.actions.includes('create_accountable');
  if (mode === 'production' && !stable) throw Error('CREATION_COMMAND_NOT_INSTALLED');
  const contract = stable ? DELIVERY_CREATE_CONTRACT : DELIVERY_CREATE_TEST_CONTRACT;
  const result = await read(path, body);
  if (path.startsWith('expense-request-admin') && result.contract !== contract) throw Error('CREATION_COMMAND_NOT_INSTALLED');
  return result;
}
export function readDeliveryCreation(ref: string) { return deliveryCreationApi(`expense-request-admin?creation_ref=${encodeURIComponent(ref)}`); }
export function previewDeliveryCreation(plan: DeliveryCreatePlan) { return deliveryCreationApi('expense-request-admin', { ...plan, confirm: false }); }
export function confirmDeliveryCreation(plan: DeliveryCreatePlan, token: string) { return deliveryCreationApi('expense-request-admin', { ...plan, confirm: true, preview_token: token }); }
