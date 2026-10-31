/** Retry only the source lock conflict; never retry arbitrary source failures. */
export async function requestPayrollControl(
  request: () => Promise<Response>,
  isCurrent: () => boolean,
  pause: (milliseconds: number) => Promise<void>,
): Promise<Response | null> {
  if (!isCurrent()) return null;
  let response = await request();
  for (let attempt = 0; response.status === 409 && attempt < 3; attempt += 1) {
    await pause((attempt + 1) * 2000);
    if (!isCurrent()) return null;
    response = await request();
  }
  return isCurrent() ? response : null;
}
