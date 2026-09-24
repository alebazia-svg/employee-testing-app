/** Source availability is independent of whether the returned list is empty. */
export function procurementSourceHealth(
  plans: PromiseSettledResult<unknown>,
  requests: PromiseSettledResult<{ complete: boolean }>,
  payments: PromiseSettledResult<{ complete: boolean; rubPaymentsSupported?: boolean }>,
) {
  return {
    plansSourceError: plans.status !== 'fulfilled',
    evidenceSourceError: requests.status !== 'fulfilled' || !requests.value.complete
      || payments.status !== 'fulfilled' || !payments.value.complete || !payments.value.rubPaymentsSupported,
  };
}
